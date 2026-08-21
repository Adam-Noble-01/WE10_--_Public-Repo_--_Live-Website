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
import shutil
import threading

try:
    from flask import request, jsonify, send_file
except ImportError:
    pass  # <-- AppSetup handles the ImportError and exits if Flask is missing

from Na__LocalServer__AppSetup__      import app                                        # <-- Flask app instance from AppSetup
from Na__LocalServer__Config__        import ALLOWED_EXTENSIONS                         # <-- Valid file extensions
from Na__LocalServer__DwgConversion__ import na_convert_dwg_to_dxf                      # <-- DWG → DXF converter
from Na__LocalServer__DxfEngine__     import (
    na_parse_dxf_to_entity_json,                                                         # <-- Non-interactive DXF parse
    na_parse_dxf_with_image_decision,                                                    # <-- Parse with embedded-image prompt hook
    na_prune_and_save_dxf,                                                               # <-- Prune-and-save
    na_export_audited_dxf,                                                               # <-- Audited export: standards excluded + clean rebuild
)
from Na__LocalServer__ProjectCache__  import (
    na_save_upload_to_temp_cache,                                                        # <-- Cache path helpers
    na_get_save_path,
    na_get_project_version_paths,
    na_list_saved_projects,
    na_open_project_working_copy,                                                        # <-- Load a saved project
    na_write_hot_cache_state,
    na_sanitise_filename,
    na_create_working_backup,                                                            # <-- Hard-delete backup/restore
    na_restore_working_backup,
)
from Na__LocalServer__NativeDialogs__  import na_pick_save_path                          # <-- Native OS Save-As picker
from Na__LocalServer__JobManager__    import (
    na_create_job,                                                                       # <-- Background job registry
    na_update_job,
    na_finish_job,
    na_fail_job,
    na_cancel_job,
    na_get_cancel_event,
    na_is_cancelled,
    na_get_job_public,
    na_request_decision,                                                                  # <-- Pause a job to ask the user
    na_provide_decision,                                                                  # <-- Deliver the user's answer
    na_wait_for_decision,                                                                 # <-- Block the worker for the answer
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
        'version' : '0.4.8',
    })

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Shared File-Load Pipeline
# -----------------------------------------------------------------------------

def na_load_cad_file_to_entity_json(file_path, display_filename, progress_cb=None, cancel_event=None,
                                    decision_cb=None, image_action='keep'):
    """
    Shared pipeline: DWG conversion (if needed) → DXF parse → entity JSON.

    Args:
        file_path        (str)  : Absolute path to a .dwg or .dxf on disk.
        display_filename (str)  : Filename to report back to the frontend.
        progress_cb      (func) : Optional callback(stage, message, percent) for
                                  live progress reporting to a background job.
        cancel_event            : Optional threading.Event signalling cancellation.
        decision_cb      (func) : Optional callback(images)->'keep'|'purge'|None used
                                  when the DXF contains raster images. None = cancel.
        image_action     (str)  : Default action when no decision_cb is supplied
                                  ('keep' renders images; 'purge' strips them).

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
    entity_data, parse_status = na_parse_dxf_with_image_decision(       # <-- Resilient parse + image prompt hook
        file_path, decision_cb=decision_cb, default_action=image_action
    )
    if parse_status == 'cancelled':
        return None, '__cancelled__', 499                               # <-- User declined at the image prompt

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

    def decision(images):
        # Pause the job and let the frontend choose how to handle embedded images.
        na_request_decision(job_id, 'image-decision', {
            'imageCount' : len(images),
            'images'     : images[:20],                                 # <-- Cap the payload for huge files
        })
        return na_wait_for_decision(job_id, cancel_event)               # <-- 'keep' | 'purge' | None (cancel/timeout)

    try:
        payload, error, _status = na_load_cad_file_to_entity_json(
            temp_path, display_filename, progress_cb=progress,
            cancel_event=cancel_event, decision_cb=decision
        )

        if na_is_cancelled(job_id) or error == '__cancelled__':
            # A '__cancelled__' with no user cancel flagged means the image
            # decision timed out — surface that instead of hanging on the poll.
            if error == '__cancelled__' and not na_is_cancelled(job_id):
                na_fail_job(job_id, 'Timed out waiting for your choice about embedded images. '
                                    'Please load the file again.')
            return                                                      # <-- Otherwise the user cancelled — stay quiet

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
# REGION | Upload Decision Route — Answer a Mid-Job Prompt (Embedded Images)
# -----------------------------------------------------------------------------

@app.route('/api/upload-decision/<job_id>', methods=['POST'])
def na_route_upload_decision(job_id):
    """
    Deliver the user's answer to a paused upload job that is 'awaiting-decision'.
    Currently used for the embedded-image prompt.

    Expects JSON body: { action: 'keep' | 'purge' }
    Returns: { status: 'accepted', action } on success.
    """
    payload = request.get_json(silent=True) or {}
    action  = payload.get('action')

    if action not in ('keep', 'purge'):
        return jsonify({'error': 'action must be "keep" or "purge"'}), 400

    if na_provide_decision(job_id, action):
        return jsonify({'status': 'accepted', 'action': action, 'jobId': job_id})
    return jsonify({'error': 'Unknown or expired job, or it is not awaiting a decision'}), 404

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
# REGION | Export-to-Folder Route — Native Save-As Picker + Write-Once + Copy
# -----------------------------------------------------------------------------

@app.route('/api/export-pick', methods=['POST'])
def na_route_export_pick():
    """
    Open the native OS "Save As" file explorer so the user picks where the
    exported DXF should go. Returns the chosen absolute path, or a cancelled
    status if the dialog was dismissed.

    Expects JSON body: { defaultName }
    Returns: { status: 'picked', destPath } | { status: 'cancelled' }
    """
    payload      = request.get_json(silent=True) or {}
    default_name = na_sanitise_filename(payload.get('defaultName', 'drawing__export.dxf'))

    try:
        chosen = na_pick_save_path(default_name=default_name, title='Export DXF As')
        if not chosen:
            return jsonify({'status': 'cancelled'})
        return jsonify({'status': 'picked', 'destPath': chosen})

    except Exception as err:
        print(f"[Na__ApiRoutes] Error opening save dialog: {err}")
        return jsonify({'error': f'Could not open save dialog: {str(err)}'}), 500


@app.route('/api/export-write', methods=['POST'])
def na_route_export_write():
    """
    Write the pruned DXF ONCE to the internal export cache (the app's own working
    copy), then OS-copy that single file to the user's chosen destination — so
    the geometry is only serialised once and simply copied to its final home.

    stripAnnotations: true switches the write into SketchUp mode — text,
    dimensions, leaders, hatches, and the rest of the configured annotation
    types are removed from the export (see Config__DxfExport).

    Expects JSON body: { tempDxfPath, deletedHandles[], outputFilename, destPath,
                         stripAnnotations? }
    Returns: { status: 'exported', savedPath, destPath }
    """
    payload = request.get_json(silent=True)

    if not payload:
        return jsonify({'error': 'Request body must be JSON'}), 400

    temp_dxf_path     = payload.get('tempDxfPath')
    deleted_handles   = payload.get('deletedHandles', [])
    dest_path         = payload.get('destPath')
    strip_annotations = bool(payload.get('stripAnnotations', False))
    output_filename   = na_sanitise_filename(payload.get('outputFilename', 'drawing__export.dxf'))

    if not temp_dxf_path:
        return jsonify({'error': 'tempDxfPath is required'}), 400
    if not dest_path:
        return jsonify({'error': 'destPath is required'}), 400
    if not os.path.isfile(temp_dxf_path):
        return jsonify({'error': f'Source DXF not found at: {temp_dxf_path}'}), 404

    try:
        # WRITE ONCE — audited export (user deletions + standards exclusion +
        # clean rebuild) into a scratch file beside the working DXF, so a failed
        # write can never leave a partial file at the user's chosen destination
        scratch_suffix = '__export-su.dxf' if strip_annotations else '__export.dxf'
        export_path    = temp_dxf_path.rsplit('.', 1)[0] + scratch_suffix
        stats = na_export_audited_dxf(temp_dxf_path, deleted_handles, export_path,
                                      strip_annotations=strip_annotations)

        # COPY — hand the single written file to the user's chosen location
        dest_dir = os.path.dirname(dest_path)
        if dest_dir:
            os.makedirs(dest_dir, exist_ok=True)
        shutil.copy2(export_path, dest_path)                            # <-- OS copy, no second serialise

        try:
            os.remove(export_path)                                      # <-- Scratch copy served its purpose — the
        except Exception:                                               #     temp cache was hoarding 100 MB per export
            pass

        print(f"[Na__ApiRoutes] Exported DXF -> {dest_path} ({stats['fileSizeMb']} MB, "
              f"stripAnnotations={strip_annotations})")
        return jsonify({
            'status'              : 'exported',
            'destPath'            : dest_path,
            'pruned'              : stats['userPruned'],
            'standardsRemoved'    : stats['standardsRemoved'],
            'entityCount'         : stats['entityCount'],
            'fileSizeMb'          : stats['fileSizeMb'],
            'skippedTypes'        : stats['skippedTypes'],              # <-- e.g. { REGION: 17 } — types ezdxf cannot rebuild
            'annotationsStripped' : stats['annotationsStripped'],       # <-- SketchUp mode: text/dim/leader/etc removed
            'dimBlocksRepaired'   : stats['dimBlocksRepaired'],         # <-- *D geometry blocks rebuilt after the Importer
            'emptyInsertsDropped' : stats['emptyInsertsDropped'],       # <-- INSERTs of empty block definitions removed
        })

    except Exception as err:
        print(f"[Na__ApiRoutes] Error during export-write: {err}")
        return jsonify({'error': f'Export failed: {str(err)}'}), 500

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Open-Project Route — Load a Saved Project as a Fresh Working Copy
# -----------------------------------------------------------------------------

@app.route('/api/open-project', methods=['POST'])
def na_route_open_project():
    """
    Open a saved project version. The archived DXF is copied into the temp cache
    as a fresh working file (so later edits never mutate the archive), then parsed
    to entity JSON. The sidecar metadata (dimensions, project name) rides along so
    the frontend can restore annotations.

    Expects JSON body: { project, version }
    Returns: entity JSON + { projectName, version, dimensions }
    """
    payload = request.get_json(silent=True)

    if not payload:
        return jsonify({'error': 'Request body must be JSON'}), 400

    project_name  = payload.get('project')
    version_label = payload.get('version')

    if not project_name or not version_label:
        return jsonify({'error': 'project and version are required'}), 400

    opened = na_open_project_working_copy(project_name, version_label)
    if opened is None:
        return jsonify({'error': f'Saved project not found: {project_name} {version_label}'}), 404

    try:
        payload_out, error, status = na_load_cad_file_to_entity_json(
            opened['workingPath'], opened['filename']
        )
        if payload_out is None:
            return jsonify({'error': error}), status

        metadata = opened.get('metadata', {}) or {}
        payload_out['projectName'] = metadata.get('projectName', project_name)  # <-- For the file chip / re-save
        payload_out['version']     = metadata.get('version', version_label)
        payload_out['dimensions']  = metadata.get('dimensions', [])             # <-- Frontend restores annotations
        return jsonify(payload_out)

    except Exception as err:
        print(f"[Na__ApiRoutes] Error during open-project: {err}")
        return jsonify({'error': f'Open project failed: {str(err)}'}), 500

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
