#!/usr/bin/env python3
# =============================================================================
# NOBLE ARCHITECTURE - CAD AUDIT TOOLS LOCAL SERVER APP SETUP
# =============================================================================
#
# FILE      : Na__LocalServer__AppSetup__.py
# MODULE    : LocalServer.AppSetup
# AUTHOR    : Adam Noble - Noble Architecture
# PURPOSE   : Flask app creation, CORS, route handlers, banner, browser launch
# CREATED   : 07-Jul-2026
#
# DESCRIPTION:
# - Creates and configures the Flask application instance.
# - Registers static file routes for serving the app shell.
# - Provides startup banner printed to console on server start.
# - Provides open_browser() utility called by the main entry point.
# - API routes are registered by Na__LocalServer__ApiRoutes__.
#
# -----------------------------------------------------------------------------
#
# DEVELOPMENT LOG:
# 07-Jul-2026 - Version 0.1.0
# - Initial scaffold release.
#
# =============================================================================

import os
import sys
import webbrowser

try:
    from flask import Flask, send_file, send_from_directory
    from flask_cors import CORS
except ImportError:
    print("\n" + "=" * 70)
    print("  ERROR: Flask dependencies not installed!")
    print("=" * 70)
    print("\n  Please install required packages:")
    print("    pip install flask flask-cors ezdxf")
    print("  Or run: Na__LocalServer__Main__.bat")
    print("=" * 70 + "\n")
    sys.exit(1)

from Na__LocalServer__Config__ import PORT, HOST, APP_DIR, INDEX_FILENAME, MAX_UPLOAD_MB  # <-- Config SSOT


# #region ---------------------------------------------------------------------
# REGION | Flask Application Setup
# -----------------------------------------------------------------------------

app = Flask(__name__, static_folder=APP_DIR)                         # <-- Root Flask app at project dir
app.config['MAX_CONTENT_LENGTH'] = MAX_UPLOAD_MB * 1024 * 1024      # <-- Enforce upload size limit

CORS(app, resources={
    r"/*": {
        "origins"       : "*",                                       # <-- Allow all origins for localhost dev
        "methods"       : ["GET", "POST", "OPTIONS"],
        "allow_headers" : ["Content-Type"]
    }
})

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Static File Route Handlers
# -----------------------------------------------------------------------------

@app.route('/')
def na_route_index():
    """Serve the Na__App__.html entry point from the project root."""
    return send_file(os.path.join(APP_DIR, INDEX_FILENAME))          # <-- Serve namespaced entry HTML


@app.route('/Na__App__.html')
def na_route_app_html():
    """Serve Na__App__.html explicitly (for direct URL access)."""
    return send_file(os.path.join(APP_DIR, INDEX_FILENAME))


@app.route('/<path:filepath>')
def na_route_static(filepath):
    """Serve all static assets (JS, CSS, JSON, manifests) from the project directory."""
    full_path = os.path.join(APP_DIR, filepath)                      # <-- Resolve absolute path

    if os.path.isfile(full_path):                                     # <-- File exists — serve it
        return send_from_directory(os.path.dirname(full_path), os.path.basename(full_path))

    return f"File not found: {filepath}", 404                        # <-- Missing file — 404

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Browser Launch
# -----------------------------------------------------------------------------

def open_browser():
    """Open the default system browser to the local server URL."""
    url = f"http://{HOST}:{PORT}/"                                   # <-- Construct server root URL
    try:
        webbrowser.open(url)                                         # <-- Launch browser tab
    except Exception as err:
        print(f"  Note: Could not auto-open browser: {err}")
        print(f"  Please manually open: {url}")

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Startup Banner
# -----------------------------------------------------------------------------

def print_banner():
    """Print startup information banner to the console."""
    print("")
    print("=" * 70)
    print("  NOBLE ARCHITECTURE | CAD Audit Tools - Local Development Server")
    print("=" * 70)
    print(f"  Server URL   : http://{HOST}:{PORT}/")
    print(f"  Serving from : {APP_DIR}")
    print("")
    print("  Static Asset Routes:")
    print(f"    - http://{HOST}:{PORT}/                    (Na__App__.html)")
    print(f"    - http://{HOST}:{PORT}/03__AppStyles/      (CSS)")
    print(f"    - http://{HOST}:{PORT}/03__AppModules/     (JS modules)")
    print(f"    - http://{HOST}:{PORT}/02__AppData/        (config JSON)")
    print("")
    print("  API Routes:")
    print(f"    - POST http://{HOST}:{PORT}/api/upload     (Upload DWG/DXF)")
    print(f"    - POST http://{HOST}:{PORT}/api/save       (Save pruned DXF)")
    print(f"    - GET  http://{HOST}:{PORT}/api/health     (Health check)")
    print("")
    print("  Press Ctrl+C to stop the server")
    print("=" * 70)
    print("")

# endregion -------------------------------------------------------------------
