#!/usr/bin/env python3
# =============================================================================
# NOBLE ARCHITECTURE - CAD AUDIT TOOLS API ROUTES
# =============================================================================
#
# FILE      : Na__LocalServer__ApiRoutes__.py
# MODULE    : LocalServer.ApiRoutes
# AUTHOR    : Adam Noble - Noble Architecture
# PURPOSE   : Flask API route handlers for upload, conversion, save, and export
# CREATED   : 07-Jul-2026
#
# DESCRIPTION:
# - Registers API route handlers on the Flask app instance from AppSetup.
# - Imports this module in Na__LocalServer__Main__ to activate routes.
# - Routes:
#     GET  /api/health           — Server health check (used by silent launcher)
#     POST /api/upload           — Upload DWG/DXF, convert if needed, return entity JSON
#     GET  /api/upload-status    — Poll live progress of a background upload job
#     POST /api/upload-cancel    — Cancel an in-flight upload/conversion job
#     GET  /api/open-local       — Load a DWG/DXF straight from an absolute disk path
#     POST /api/save             — Legacy prune-and-save into saved projects root
#     POST /api/project-save     — Versioned project save (DXF + JSON metadata pair)
#     GET  /api/projects         — List saved projects and versions
#     POST /api/export-dxf       — Prune current DXF and return as browser download
#     POST /api/prune-working    — Hard-delete: physically prune the working DXF in place
#     POST /api/restore-working  — Undo a hard-delete by restoring its working-file backup
#     POST /api/undo-cache       — Persist an undo/redo snapshot to the hot cache
#
# @delegate: Na__LocalServer__DwgConversion__.py
# @delegate: Na__LocalServer__DxfEngine__.py
# @delegate: Na__LocalServer__ProjectCache__.py
# @delegate: Na__LocalServer__JobManager__.py
#
# -----------------------------------------------------------------------------
#
# DEVELOPMENT LOG:
# 07-Jul-2026 - Version 0.3.3
# - Added /api/prune-working + /api/restore-working for undoable hard-delete
#   (Shift+Delete physically removes entities from the working DXF on disk).
#
# 07-Jul-2026 - Version 0.3.2
# - Reworked /api/upload into a background job (JobManager) with live progress
#   polling and cancellation, so large DWG/DXF uploads no longer time out.
#
# 07-Jul-2026 - Version 0.3.0
# - Added open-local, project-save, projects, export-dxf, and undo-cache routes.
# - Upload route reports precise converter errors from the hardened pipeline.
#
# 07-Jul-2026 - Version 0.1.0
# - Initial scaffold release — route signatures wired, handlers stubbed.
#
# =============================================================================

import os
import time
import threading

try:
    from flask import request, jsonify, send_file
except ImportError:
    pass  # <-- AppSetup handles the ImportError and exits if Flask is missing

from Na__LocalServer__AppSetup__      import app                                        # <-- Flask app instance from AppSetup
from Na__LocalServer__Config__        import ALLOWED_EXTENSIONS                         # <-- Valid file extensions
from Na__LocalServer__DwgConversion__ import na_convert_dwg_to_dxf                      # <-- DWG → DXF converter
from Na__LocalServer__DxfEngine__     import na_parse_dxf_to_entity_json, na_prune_and_save_dxf  # <-- DXF parse and save
from Na__LocalServer__ProjectCache__  import (
    na_save_upload_to_temp_cache,                                                        # <-- Cache path helpers
    na_get_save_path,
    na_get_project_version_paths,
    na_list_saved_projects,
    na_write_hot_cache_state,
    na_sanitise_filename,
    na_create_working_backup,                                                            # <-- Hard-delete backup/restore
    na_restore_working_backup,
)
from Na__LocalServer__JobManager__    import (
    na_create_job,                                                                       # <-- Background job registry
    na_update_job,
    na_finish_job,
    na_fail_job,
    na_cancel_job,
    na_get_cancel_event,
    na_is_cancelled,
    na_get_job_public,
)


# #region ---------------------------------------------------------------------
# REGION | Health Check Route
# -----------------------------------------------------------------------------

@app.route('/api/health', methods=['GET'])
def na_route_health():
    """Simple health check — returns 200 OK with server status."""
    return jsonify({
        'status'  : 'ok',
        'app'     : 'Noble CAD Audit Tools',
        'version' : '0.3.0',
    })

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Shared File-Load Pipeline
# -----------------------------------------------------------------------------

def na_load_cad_file_to_entity_json(file_path, display_filename, progress_cb=None, cancel_event=None):
    """
    Shared pipeline: DWG conversion (if needed) → DXF parse → entity JSON.

    Args:
        file_path        (str)  : Absolute path to a .dwg or .dxf on disk.
        display_filename (str)  : Filename to report back to the frontend.
        progress_cb      (func) : Optional callback(stage, message, percent) for
                                  live progress reporting to a background job.
        cancel_event            : Optional threading.Event signalling cancellation.

    Returns:
        tuple(dict | None, str, int): (payload, error message, http status).
        A cancelled load returns (None, '__cancelled__', 499).
    """
    def report(stage, message, percent=None):
        if progress_cb:
            progress_cb(stage, message, percent)                        # <-- Push live status onto the job

    ext = file_path.rsplit('.', 1)[-1].lower() if '.' in file_path else ''

    if ext == 'dwg':
        report('converting', 'Converting DWG to DXF — this can take a while for large drawings…', None)
        converted_path, conv_error = na_convert_dwg_to_dxf(file_path, cancel_event)  # <-- ezdwg primary, ODA fallback
        if converted_path is None:
            if conv_error == '__cancelled__':
                return None, '__cancelled__', 499
            return None, f"DWG to DXF conversion failed — {conv_error}", 500
        file_path = converted_path

    if cancel_event is not None and cancel_event.is_set():
        return None, '__cancelled__', 499                               # <-- Bail before the expensive parse

    report('parsing', 'Parsing DXF entities…', None)
    entity_data = na_parse_dxf_to_entity_json(file_path)                # <-- dict with entities, layers, counts

    entity_data['filename'] = display_filename                          # <-- Source filename for UI display
    entity_data['tempPath'] = file_path                                 # <-- Working DXF path for save/export

    report('finalising', 'Preparing drawing…', 95)
    return entity_data, '', 200


def _na_run_upload_job(job_id, temp_path, display_filename):
    """
    Background worker: run the file-load pipeline for a job, streaming progress
    into the job registry and honouring cancellation. Runs on its own thread.
    """
    cancel_event = na_get_cancel_event(job_id)

    def progress(stage, message, percent=None):
        na_update_job(job_id, stage=stage, message=message, percent=percent)

    try:
        payload, error, _status = na_load_cad_file_to_entity_json(
            temp_path, display_filename, progress_cb=progress, cancel_event=cancel_event
        )

        if na_is_cancelled(job_id) or error == '__cancelled__':
            return                                                      # <-- Job already flagged cancelled

        if payload is None:
            na_fail_job(job_id, error)
            return

        na_finish_job(job_id, payload)

    except Exception as err:
        print(f"[Na__ApiRoutes] Error during background upload job: {err}")
        na_fail_job(job_id, f"Upload processing failed: {err}")

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Upload Route — Start Background Conversion Job
# -----------------------------------------------------------------------------

@app.route('/api/upload', methods=['POST'])
def na_route_upload():
    """
    Accept a DWG or DXF file upload and start a BACKGROUND job that converts
    (if needed) and parses it. Returns a jobId immediately (HTTP 202) so the
    request never blocks — the frontend polls /api/upload-status/<jobId> for
    live progress and collects the result when the job completes.
    - DWG: converted via the hardened conversion pipeline (ezdwg → ODA)
    - DXF: parsed directly from temp cache
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file part in request'}), 400

    uploaded_file = request.files['file']

    if not uploaded_file.filename:
        return jsonify({'error': 'No file selected'}), 400

    filename = uploaded_file.filename
    ext      = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''

    if ext not in ALLOWED_EXTENSIONS:
        return jsonify({'error': f'File type ".{ext}" not supported. Please upload .dxf or .dwg'}), 400

    try:
        temp_path = na_save_upload_to_temp_cache(uploaded_file, filename)  # <-- Write upload to disk (fast, local)
    except Exception as err:
        print(f"[Na__ApiRoutes] Error saving upload: {err}")
        return jsonify({'error': f'Could not save upload: {str(err)}'}), 500

    job_id = na_create_job(filename)                                    # <-- Register the job
    worker = threading.Thread(                                          # <-- Process off the request thread
        target = _na_run_upload_job,
        args   = (job_id, temp_path, filename),
        daemon = True,
    )
    worker.start()

    return jsonify({'jobId': job_id, 'filename': filename}), 202        # <-- 202 Accepted — processing started

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Upload Status Route — Poll Live Job Progress
# -----------------------------------------------------------------------------

@app.route('/api/upload-status/<job_id>', methods=['GET'])
def na_route_upload_status(job_id):
    """
    Return the live status of a background upload job:
        { id, filename, status, stage, message, percent, result, error }
    status is one of: running | done | error | cancelled.
    When status == 'done', 'result' holds the entity JSON payload.
    """
    job = na_get_job_public(job_id)
    if job is None:
        return jsonify({'error': 'Unknown or expired job', 'status': 'expired'}), 404
    return jsonify(job)

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Upload Cancel Route — Abort an In-Flight Job
# -----------------------------------------------------------------------------

@app.route('/api/upload-cancel/<job_id>', methods=['POST'])
def na_route_upload_cancel(job_id):
    """
    Signal cancellation of a running job. The pipeline polls the cancel event
    and terminates any running conversion subprocess.
    """
    if na_cancel_job(job_id):
        return jsonify({'status': 'cancelled', 'jobId': job_id})
    return jsonify({'error': 'Unknown or expired job'}), 404

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Open-Local Route — Load a CAD File Straight from Disk
# -----------------------------------------------------------------------------

@app.route('/api/open-local', methods=['GET'])
def na_route_open_local():
    """
    Load a DWG/DXF directly from an absolute path on this machine.
    Used by the Windows right-click Open-With integration:
    the launcher opens the app at /?openFile=<path> and the frontend calls here.
    """
    file_path = request.args.get('path', '').strip()

    if not file_path:
        return jsonify({'error': 'path query parameter is required'}), 400

    file_path = os.path.abspath(file_path)

    ext = file_path.rsplit('.', 1)[-1].lower() if '.' in file_path else ''
    if ext not in ALLOWED_EXTENSIONS:
        return jsonify({'error': f'File type ".{ext}" not supported. Only .dxf and .dwg files can be opened'}), 400

    if not os.path.isfile(file_path):
        return jsonify({'error': f'File not found: {file_path}'}), 404

    try:
        payload, error, status = na_load_cad_file_to_entity_json(file_path, os.path.basename(file_path))
        if payload is None:
            return jsonify({'error': error}), status
        return jsonify(payload)

    except Exception as err:
        print(f"[Na__ApiRoutes] Error during open-local processing: {err}")
        return jsonify({'error': f'Open failed: {str(err)}'}), 500

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Save Route — Legacy Prune and Save (Flat Output)
# -----------------------------------------------------------------------------

@app.route('/api/save', methods=['POST'])
def na_route_save():
    """
    Accept deleted entity handles and produce a pruned DXF file.
    Expects JSON body: { tempDxfPath, deletedHandles[], outputFilename }
    Returns the path of the saved audited DXF.
    """
    payload = request.get_json(silent=True)

    if not payload:
        return jsonify({'error': 'Request body must be JSON'}), 400

    temp_dxf_path    = payload.get('tempDxfPath')
    deleted_handles  = payload.get('deletedHandles', [])
    output_filename  = payload.get('outputFilename', 'drawing__audited.dxf')

    if not temp_dxf_path:
        return jsonify({'error': 'tempDxfPath is required'}), 400

    if not os.path.isfile(temp_dxf_path):
        return jsonify({'error': f'Source DXF not found at: {temp_dxf_path}'}), 404

    try:
        save_path   = na_get_save_path(output_filename)                 # <-- Resolve output path in saved projects cache
        saved_file  = na_prune_and_save_dxf(temp_dxf_path, deleted_handles, save_path) # <-- Prune and save

        return jsonify({
            'status'     : 'saved',
            'savedPath'  : saved_file,
            'pruned'     : len(deleted_handles),
        })

    except Exception as err:
        print(f"[Na__ApiRoutes] Error during save: {err}")
        return jsonify({'error': f'Save failed: {str(err)}'}), 500

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Project Save Route — Versioned DXF + JSON Metadata Pair
# -----------------------------------------------------------------------------

@app.route('/api/project-save', methods=['POST'])
def na_route_project_save():
    """
    Save the audited drawing into a per-project subfolder with versioning:
      02__SavedProjects__AuditedDxfFiles/<Project>/<Project>__vNNN__.dxf
      02__SavedProjects__AuditedDxfFiles/<Project>/<Project>__vNNN__.json

    Expects JSON body: { tempDxfPath, deletedHandles[], projectName,
                         sourceFilename, layers{}, dimensions[] }
    """
    payload = request.get_json(silent=True)

    if not payload:
        return jsonify({'error': 'Request body must be JSON'}), 400

    temp_dxf_path   = payload.get('tempDxfPath')
    deleted_handles = payload.get('deletedHandles', [])
    project_name    = payload.get('projectName', 'UntitledProject')
    source_filename = payload.get('sourceFilename', '')
    layers          = payload.get('layers', {})
    dimensions      = payload.get('dimensions', [])

    if not temp_dxf_path:
        return jsonify({'error': 'tempDxfPath is required'}), 400

    if not os.path.isfile(temp_dxf_path):
        return jsonify({'error': f'Source DXF not found at: {temp_dxf_path}'}), 404

    try:
        version_info = na_get_project_version_paths(project_name)       # <-- Auto-incremented version paths

        na_prune_and_save_dxf(temp_dxf_path, deleted_handles, version_info['dxfPath'])  # <-- Write pruned DXF

        metadata = {
            'projectName'    : project_name,
            'version'        : version_info['versionLabel'],
            'savedAt'        : time.strftime('%Y-%m-%d %H:%M:%S'),
            'sourceFilename' : source_filename,
            'sourceDxfPath'  : temp_dxf_path,
            'deletedCount'   : len(deleted_handles),
            'deletedHandles' : deleted_handles,
            'layers'         : layers,
            'dimensions'     : dimensions,
        }
        with open(version_info['jsonPath'], 'w', encoding='utf-8') as f:
            import json as _json
            _json.dump(metadata, f, indent=2)

        print(f"[Na__ApiRoutes] Project saved: {project_name} {version_info['versionLabel']}")
        return jsonify({
            'status'       : 'saved',
            'projectName'  : project_name,
            'version'      : version_info['versionLabel'],
            'dxfPath'      : version_info['dxfPath'],
            'jsonPath'     : version_info['jsonPath'],
            'pruned'       : len(deleted_handles),
        })

    except Exception as err:
        print(f"[Na__ApiRoutes] Error during project save: {err}")
        return jsonify({'error': f'Project save failed: {str(err)}'}), 500


@app.route('/api/projects', methods=['GET'])
def na_route_projects():
    """List saved projects and their versions."""
    try:
        return jsonify({'projects': na_list_saved_projects()})
    except Exception as err:
        return jsonify({'error': f'Project listing failed: {str(err)}'}), 500

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Export Route — Pruned DXF as Browser Download
# -----------------------------------------------------------------------------

@app.route('/api/export-dxf', methods=['POST'])
def na_route_export_dxf():
    """
    Prune the working DXF with the current deleted handles and return the
    result as a file download attachment.
    Expects JSON body: { tempDxfPath, deletedHandles[], outputFilename }
    """
    payload = request.get_json(silent=True)

    if not payload:
        return jsonify({'error': 'Request body must be JSON'}), 400

    temp_dxf_path   = payload.get('tempDxfPath')
    deleted_handles = payload.get('deletedHandles', [])
    output_filename = na_sanitise_filename(payload.get('outputFilename', 'drawing__export.dxf'))

    if not temp_dxf_path:
        return jsonify({'error': 'tempDxfPath is required'}), 400

    if not os.path.isfile(temp_dxf_path):
        return jsonify({'error': f'Source DXF not found at: {temp_dxf_path}'}), 404

    try:
        export_path = temp_dxf_path.rsplit('.', 1)[0] + '__export.dxf'  # <-- Scratch file beside working DXF
        na_prune_and_save_dxf(temp_dxf_path, deleted_handles, export_path)

        return send_file(
            export_path,
            as_attachment = True,
            download_name = output_filename,
            mimetype      = 'application/dxf',
        )

    except Exception as err:
        print(f"[Na__ApiRoutes] Error during export: {err}")
        return jsonify({'error': f'Export failed: {str(err)}'}), 500

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Prune-Working Route — Undoable Hard-Delete of the Working DXF
# -----------------------------------------------------------------------------

@app.route('/api/prune-working', methods=['POST'])
def na_route_prune_working():
    """
    Physically remove entities from the WORKING DXF in place (Shift+Delete).
    Unlike /api/save or /api/export-dxf, this OVERWRITES tempDxfPath itself so
    the working file — and every subsequent edit/render pass over it — gets
    smaller and faster on very large drawings.

    The working file is backed up before the prune so the frontend UndoManager
    can restore it via /api/restore-working.

    Expects JSON body: { tempDxfPath, handles[] }
    Returns: { status, removed, backupId }
    """
    payload = request.get_json(silent=True)

    if not payload:
        return jsonify({'error': 'Request body must be JSON'}), 400

    temp_dxf_path = payload.get('tempDxfPath')
    handles       = payload.get('handles', [])

    if not temp_dxf_path:
        return jsonify({'error': 'tempDxfPath is required'}), 400

    if not os.path.isfile(temp_dxf_path):
        return jsonify({'error': f'Working DXF not found at: {temp_dxf_path}'}), 404

    if not handles:
        return jsonify({'error': 'handles array is required and must not be empty'}), 400

    try:
        backup_info = na_create_working_backup(temp_dxf_path)           # <-- Snapshot BEFORE mutating the working file
        na_prune_and_save_dxf(temp_dxf_path, handles, temp_dxf_path)    # <-- In-place prune (saveas over itself)

        print(f"[Na__ApiRoutes] Hard-deleted {len(handles)} handles from working file (backup {backup_info['backupId']})")
        return jsonify({
            'status'   : 'pruned',
            'removed'  : len(handles),
            'backupId' : backup_info['backupId'],
        })

    except Exception as err:
        print(f"[Na__ApiRoutes] Error during prune-working: {err}")
        return jsonify({'error': f'Hard delete failed: {str(err)}'}), 500

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Restore-Working Route — Undo a Hard-Delete Prune
# -----------------------------------------------------------------------------

@app.route('/api/restore-working', methods=['POST'])
def na_route_restore_working():
    """
    Restore the working DXF from a backup created by /api/prune-working —
    the server side of undoing a hard-delete.

    Expects JSON body: { tempDxfPath, backupId }
    Returns: { status, backupId }
    """
    payload = request.get_json(silent=True)

    if not payload:
        return jsonify({'error': 'Request body must be JSON'}), 400

    temp_dxf_path = payload.get('tempDxfPath')
    backup_id     = payload.get('backupId')

    if not temp_dxf_path or not backup_id:
        return jsonify({'error': 'tempDxfPath and backupId are required'}), 400

    try:
        na_restore_working_backup(backup_id, temp_dxf_path)
        print(f"[Na__ApiRoutes] Restored working file from backup {backup_id}")
        return jsonify({'status': 'restored', 'backupId': backup_id})

    except FileNotFoundError as err:
        return jsonify({'error': str(err)}), 404
    except Exception as err:
        print(f"[Na__ApiRoutes] Error during restore-working: {err}")
        return jsonify({'error': f'Restore failed: {str(err)}'}), 500

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Undo Cache Route — Persist Undo/Redo Snapshots
# -----------------------------------------------------------------------------

@app.route('/api/undo-cache', methods=['POST'])
def na_route_undo_cache():
    """
    Persist an undo/redo state snapshot to the hot cache folder.
    Fire-and-forget from the frontend — always returns quickly.
    Expects JSON body: arbitrary undo state payload.
    """
    payload = request.get_json(silent=True)

    if not payload:
        return jsonify({'error': 'Request body must be JSON'}), 400

    try:
        file_path = na_write_hot_cache_state(payload)                   # <-- Write snapshot + trim old files
        return jsonify({'status': 'cached', 'path': file_path})
    except Exception as err:
        print(f"[Na__ApiRoutes] Undo cache write failed: {err}")
        return jsonify({'error': f'Undo cache failed: {str(err)}'}), 500

# endregion -------------------------------------------------------------------
