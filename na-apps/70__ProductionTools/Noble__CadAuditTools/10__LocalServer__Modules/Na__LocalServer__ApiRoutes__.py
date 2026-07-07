#!/usr/bin/env python3
# =============================================================================
# NOBLE ARCHITECTURE - CAD AUDIT TOOLS API ROUTES
# =============================================================================
#
# FILE      : Na__LocalServer__ApiRoutes__.py
# MODULE    : LocalServer.ApiRoutes
# AUTHOR    : Adam Noble - Noble Architecture
# PURPOSE   : Flask API route handlers for file upload, conversion, and save
# CREATED   : 07-Jul-2026
#
# DESCRIPTION:
# - Registers API route handlers on the Flask app instance from AppSetup.
# - Imports this module in Na__LocalServer__Main__ to activate routes.
# - Routes:
#     GET  /api/health   — Server health check
#     POST /api/upload   — Upload a DWG or DXF file, convert if needed, return entity JSON
#     POST /api/save     — Accept deleted entity handles, prune DXF, save to cache
#
# @delegate: Na__LocalServer__DwgConversion__.py
# @delegate: Na__LocalServer__DxfEngine__.py
# @delegate: Na__LocalServer__ProjectCache__.py
#
# -----------------------------------------------------------------------------
#
# DEVELOPMENT LOG:
# 07-Jul-2026 - Version 0.1.0
# - Initial scaffold release — route signatures wired, handlers stubbed.
#
# =============================================================================

import os

try:
    from flask import request, jsonify
except ImportError:
    pass  # <-- AppSetup handles the ImportError and exits if Flask is missing

from Na__LocalServer__AppSetup__    import app                                         # <-- Flask app instance from AppSetup
from Na__LocalServer__Config__      import ALLOWED_EXTENSIONS                          # <-- Valid file extensions
from Na__LocalServer__DwgConversion__ import na_convert_dwg_to_dxf                    # <-- DWG → DXF converter
from Na__LocalServer__DxfEngine__   import na_parse_dxf_to_entity_json, na_prune_and_save_dxf  # <-- DXF parse and save
from Na__LocalServer__ProjectCache__ import na_save_upload_to_temp_cache, na_get_save_path     # <-- Cache path helpers


# #region ---------------------------------------------------------------------
# REGION | Health Check Route
# -----------------------------------------------------------------------------

@app.route('/api/health', methods=['GET'])
def na_route_health():
    """Simple health check — returns 200 OK with server status."""
    return jsonify({
        'status'  : 'ok',
        'app'     : 'Noble CAD Audit Tools',
        'version' : '0.1.0',
    })

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Upload Route — Receive DWG/DXF and Return Entity JSON
# -----------------------------------------------------------------------------

@app.route('/api/upload', methods=['POST'])
def na_route_upload():
    """
    Accept a DWG or DXF file upload.
    - DWG: runs ODA File Converter via Na__LocalServer__DwgConversion__
    - DXF: saves directly to temp cache
    Returns entity JSON for the frontend to render.
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
        # SAVE UPLOAD TO TEMP CACHE
        temp_path = na_save_upload_to_temp_cache(uploaded_file, filename) # <-- Write upload to disk

        # CONVERT DWG → DXF IF NEEDED
        if ext == 'dwg':
            temp_path = na_convert_dwg_to_dxf(temp_path)               # <-- Returns path to converted DXF
            if temp_path is None:
                return jsonify({'error': 'DWG to DXF conversion failed. Check ODA File Converter is installed.'}), 500

        # PARSE DXF TO ENTITY JSON
        entity_data = na_parse_dxf_to_entity_json(temp_path)           # <-- Returns dict with entities, layers, counts

        entity_data['filename'] = filename                               # <-- Include source filename in response
        entity_data['tempPath'] = temp_path                             # <-- Include temp path for save step

        return jsonify(entity_data)

    except Exception as err:
        print(f"[Na__ApiRoutes] Error during upload processing: {err}")
        return jsonify({'error': f'Upload processing failed: {str(err)}'}), 500

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Save Route — Prune Deleted Entities and Write Audited DXF
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
