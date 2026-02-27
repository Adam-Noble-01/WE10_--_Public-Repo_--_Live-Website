# =============================================================================
# TRUEVISION3D - TEST ENVIRONMENT FLASK SERVER
# =============================================================================
#
# FILE       : TestEnv__FlaskLocalServer.py
# NAMESPACE  : TrueVision3D
# MODULE     : Test Environment Flask Server
# AUTHOR     : Adam Noble - Noble Architecture
# PURPOSE    : Self-contained Flask server for the prototype testing sandbox
# CREATED    : 14-Feb-2026
#
# DESCRIPTION:
# - Lightweight Flask server dedicated to the TrueVision3D testing environment.
# - Serves the test sandbox HTML/JS/CSS from the local folder.
# - Serves engine scripts from the parent TrueVision3D directory (no duplication).
# - Serves GLB model files from the local TestEnv__GlbFiles folder.
# - Provides an API endpoint to list available GLB files for auto-discovery.
# - Runs on port 5500 to avoid conflict with the Whitecardopedia server (8000).
# - Uses bundled Flask dependencies from the Whitecardopedia third-party folder.
#
# API ENDPOINTS:
# - GET  /                                       : Serve test environment HTML
# - GET  /api/glb-files                          : List available .glb files
# - GET  /glb-assets/<filename>                  : Serve GLB files from local folder
# - GET  /TestEnv__*                             : Serve local test environment files
# - GET  /assets__CommonApplicationAssets/<path>  : Serve shared assets
# - GET  /<path>                                 : Fallback to TrueVision3D root
#
# =============================================================================

import os
import sys
import json
from pathlib import Path

# -----------------------------------------------------------------------------
# REGION | Dependency Path Setup
# -----------------------------------------------------------------------------

    # MODULE CONSTANTS | Directory Paths
    # ------------------------------------------------------------
SCRIPT_DIR             = os.path.dirname(os.path.abspath(__file__))          # <-- This test environment folder
TRUEVISION_ROOT        = os.path.dirname(SCRIPT_DIR)                         # <-- Parent TrueVision3D folder
WEBAPPS_ROOT           = os.path.dirname(TRUEVISION_ROOT)                    # <-- WebApps folder (contains shared assets)
GLB_DIR                = os.path.join(SCRIPT_DIR, 'TestEnv__GlbFiles')       # <-- Local GLB file storage
FEATURE_SCRIPTS_DIR    = os.path.join(SCRIPT_DIR, 'TestEnv__CurrentFeatureTestScripts')  # <-- Feature test scripts folder
    # ------------------------------------------------------------


    # HELPER FUNCTION | Add Bundled Flask Dependencies to Path
    # ------------------------------------------------------------
BUNDLED_DEPS_PATH = os.path.join(
    WEBAPPS_ROOT,
    'Whitecardopedia',
    'src',
    'ThirdParty__VersionLockedDependencies',
    'SERVER__FlaskServerDepencies'
)
if os.path.exists(BUNDLED_DEPS_PATH):
    sys.path.insert(0, BUNDLED_DEPS_PATH)                                    # <-- Add bundled deps to Python path
    # ------------------------------------------------------------

# endregion -------------------------------------------------------------------


from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS


# -----------------------------------------------------------------------------
# REGION | Flask Application Configuration
# -----------------------------------------------------------------------------

    # MODULE CONSTANTS | Server Configuration
    # ------------------------------------------------------------
SERVER_PORT            = 5500                                                # <-- Test environment server port
SERVER_HOST            = '127.0.0.1'                                         # <-- Localhost binding
    # ------------------------------------------------------------


    # INITIALIZATION | Create Flask Application
    # ------------------------------------------------------------
app = Flask(__name__, static_folder=TRUEVISION_ROOT)                         # <-- Static root is TrueVision3D parent
CORS(app)                                                                    # <-- Enable CORS for all routes
    # ------------------------------------------------------------

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | API Endpoints
# -----------------------------------------------------------------------------

    # API ENDPOINT | Save Default Camera View to Config
    # ------------------------------------------------------------
@app.route('/api/save-default-view', methods=['POST'])
def save_default_view():
    """Patch TestEnv__DefaultView into the test environment config JSON and save to disk"""
    config_path = os.path.join(SCRIPT_DIR, 'TestEnv__SubAppData__Config.json')  # <-- Config file path

    try:
        payload = request.get_json(force=True)                                  # <-- Parse incoming camera data
        if not payload:
            return jsonify({ 'error': 'No JSON payload received' }), 400

        with open(config_path, 'r', encoding='utf-8') as f:                     # <-- Read existing config
            config_data = json.load(f)

        config_data['TestEnv__DefaultView'] = payload                           # <-- Merge new view data

        with open(config_path, 'w', encoding='utf-8') as f:                     # <-- Write updated config
            json.dump(config_data, f, indent=4)

        return jsonify({ 'success': True })

    except Exception as e:
        return jsonify({
            'error': f'Error saving default view: {str(e)}'                    # <-- Error response
        }), 500
    # ------------------------------------------------------------


    # API ENDPOINT | List Available GLB Files
    # ------------------------------------------------------------
@app.route('/api/glb-files', methods=['GET'])
def list_glb_files():
    """Return JSON array of all .glb files in TestEnv__GlbFiles folder"""
    try:
        if not os.path.exists(GLB_DIR):                                      # <-- Check GLB folder exists
            return jsonify({ 'files': [] })                                  # <-- Return empty if missing

        glb_files = [
            f for f in os.listdir(GLB_DIR)                                   # <-- Scan directory
            if f.lower().endswith('.glb') and os.path.isfile(os.path.join(GLB_DIR, f))
        ]
        glb_files.sort()                                                     # <-- Sort alphabetically

        return jsonify({ 'files': glb_files })                               # <-- Return file list

    except Exception as e:
        return jsonify({
            'error': f'Error listing GLB files: {str(e)}'                    # <-- Error response
        }), 500
    # ------------------------------------------------------------

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | Static File Serving
# -----------------------------------------------------------------------------

    # ROUTE HANDLER | Serve Test Environment HTML (Index)
    # ------------------------------------------------------------
@app.route('/', methods=['GET'])
def serve_index():
    """Serve the test environment HTML as the index page"""
    return send_from_directory(
        SCRIPT_DIR,                                                          # <-- From test environment folder
        'TestEnv__PrototypeTestingSandbox__DomAndLayout.html'                # <-- Test sandbox HTML
    )
    # ------------------------------------------------------------


    # ROUTE HANDLER | Serve GLB Assets from Local Folder
    # ------------------------------------------------------------
@app.route('/glb-assets/<path:filename>', methods=['GET'])
def serve_glb_assets(filename):
    """Serve GLB model files from TestEnv__GlbFiles directory"""
    try:
        if not os.path.exists(GLB_DIR):                                      # <-- Check GLB folder exists
            return jsonify({
                'error': 'GLB assets directory not found'                    # <-- Folder missing
            }), 404

        return send_from_directory(GLB_DIR, filename)                        # <-- Serve GLB file

    except Exception as e:
        return jsonify({
            'error': f'Error serving GLB asset: {str(e)}'                   # <-- Error response
        }), 500
    # ------------------------------------------------------------


    # ROUTE HANDLER | Serve Local Test Environment Files
    # ------------------------------------------------------------
@app.route('/TestEnv__<path:filename>', methods=['GET'])
def serve_test_env_files(filename):
    """Serve JS, CSS, JSON and other files from the test environment folder"""
    full_filename = f'TestEnv__{filename}'                                   # <-- Reconstruct original filename
    return send_from_directory(SCRIPT_DIR, full_filename)                    # <-- Serve from test folder
    # ------------------------------------------------------------


    # ROUTE HANDLER | Serve Local Na__ Test Environment Files
    # ------------------------------------------------------------
@app.route('/Na__<path:filename>', methods=['GET'])
def serve_na_test_env_files(filename):
    """Serve Na__* local test files from the test environment folder"""
    full_filename = f'Na__{filename}'                                        # <-- Reconstruct original filename
    return send_from_directory(SCRIPT_DIR, full_filename)                    # <-- Serve from test folder
    # ------------------------------------------------------------


    # ROUTE HANDLER | Serve Feature Test Scripts
    # ------------------------------------------------------------
@app.route('/feature-scripts/<path:filename>', methods=['GET'])
def serve_feature_scripts(filename):
    """Serve feature test scripts from TestEnv__CurrentFeatureTestScripts"""
    try:
        if not os.path.exists(FEATURE_SCRIPTS_DIR):                          # <-- Check folder exists
            return jsonify({
                'error': 'Feature scripts directory not found'               # <-- Folder missing
            }), 404

        return send_from_directory(FEATURE_SCRIPTS_DIR, filename)            # <-- Serve script file

    except Exception as e:
        return jsonify({
            'error': f'Error serving feature script: {str(e)}'              # <-- Error response
        }), 500
    # ------------------------------------------------------------


    # ROUTE HANDLER | Serve Shared Assets from Common Directory
    # ------------------------------------------------------------
@app.route('/assets__CommonApplicationAssets/<path:filename>', methods=['GET'])
def serve_shared_assets(filename):
    """Serve static assets from assets__CommonApplicationAssets directory"""
    try:
        assets_dir = os.path.join(WEBAPPS_ROOT, 'assets__CommonApplicationAssets')  # <-- Build assets path

        if not os.path.exists(assets_dir):                                   # <-- Check assets dir exists
            return jsonify({
                'error': 'Assets directory not found'                        # <-- Assets missing
            }), 404

        return send_from_directory(assets_dir, filename)                     # <-- Serve asset file

    except Exception as e:
        return jsonify({
            'error': f'Error serving asset: {str(e)}'                       # <-- Error response
        }), 500
    # ------------------------------------------------------------


    # ROUTE HANDLER | Catch-All for TrueVision3D Engine Files
    # ------------------------------------------------------------
@app.route('/<path:filename>', methods=['GET'])
def serve_engine_files(filename):
    """Fallback: serve engine scripts and styles from TrueVision3D root"""
    try:
        file_path = os.path.join(TRUEVISION_ROOT, filename)                  # <-- Build full path

        if os.path.isfile(file_path):
            return send_from_directory(TRUEVISION_ROOT, filename)            # <-- Serve from TrueVision3D root
        else:
            return jsonify({
                'error': f'File not found: {filename}'                       # <-- File not found
            }), 404

    except Exception as e:
        return jsonify({
            'error': f'Error serving file: {str(e)}'                        # <-- Error response
        }), 500
    # ------------------------------------------------------------

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | Server Initialization
# -----------------------------------------------------------------------------

    # MAIN | Start Flask Development Server
    # ------------------------------------------------------------
if __name__ == '__main__':
    print('=' * 77)
    print(' TRUEVISION3D - TEST ENVIRONMENT SERVER')
    print('=' * 77)
    print()
    print(f' Server running at: http://{SERVER_HOST}:{SERVER_PORT}')
    print(f' GLB assets folder: {GLB_DIR}')
    print(f' Engine root:       {TRUEVISION_ROOT}')
    print()
    print(f' Press Ctrl+C to stop the server')
    print()
    print('=' * 77)
    print()

    # Ensure GLB folder exists
    os.makedirs(GLB_DIR, exist_ok=True)                                      # <-- Create GLB folder if missing

    app.run(
        host=SERVER_HOST,                                                    # <-- Bind to localhost
        port=SERVER_PORT,                                                    # <-- Use port 5500
        debug=True                                                           # <-- Enable debug mode
    )
    # ------------------------------------------------------------

# endregion -------------------------------------------------------------------

