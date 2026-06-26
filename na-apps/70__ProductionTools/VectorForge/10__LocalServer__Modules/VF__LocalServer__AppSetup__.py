#!/usr/bin/env python3
# =============================================================================
# NOBLE ARCHITECTURE - VECTORFORGE LOCAL SERVER APP SETUP
# =============================================================================
#
# FILE       : VF__LocalServer__AppSetup__.py
# MODULE     : LocalServer.AppSetup
# AUTHOR     : Adam Noble - Noble Architecture
# PURPOSE    : Flask app creation, CORS, route handlers, banner, browser launch
# CREATED    : 26-Jun-2026
#
# DESCRIPTION:
# - Creates and configures the Flask application instance
# - Registers all HTTP routes for serving VectorForge static assets
# - Provides startup banner printed to console on server start
# - Provides open_browser() utility called by the main entry point
# - Imported exclusively by VF__LocalServer__Main__
#
# -----------------------------------------------------------------------------
#
# DEVELOPMENT LOG:
# 26-Jun-2026 - Version 1.0.0
# - Initial release
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
    print("    pip install flask flask-cors")
    print("=" * 70 + "\n")
    sys.exit(1)

from VF__LocalServer__Config__ import PORT, HOST, APP_DIR, INDEX_FILENAME  # <-- Config SSOT


# #region ---------------------------------------------------------------------
# REGION | Flask Application Setup
# -----------------------------------------------------------------------------

app = Flask(__name__, static_folder=APP_DIR)                         # <-- Root Flask app at VectorForge project dir

CORS(app, resources={
    r"/*": {
        "origins"        : "*",                                      # <-- Allow all origins (mirrors GitHub Pages / CDN behaviour)
        "methods"        : ["GET", "OPTIONS"],
        "allow_headers"  : ["Content-Type"]
    }
})

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Route Handlers
# -----------------------------------------------------------------------------

@app.route('/')
def na_route_index():
    """Serve the VectorForge index.html entry point from the project root."""
    return send_file(os.path.join(APP_DIR, INDEX_FILENAME))          # <-- Serve index.html


@app.route('/<path:filepath>')
def na_route_static(filepath):
    """Serve all other static assets (JS modules, CSS, JSON) from the project directory."""
    full_path = os.path.join(APP_DIR, filepath)                      # <-- Resolve absolute path

    if os.path.isfile(full_path):                                     # <-- File exists — serve it
        return send_from_directory(os.path.dirname(full_path), os.path.basename(full_path))

    return f"File not found: {filepath}", 404                        # <-- File missing — return 404

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Browser Launch
# -----------------------------------------------------------------------------

def open_browser():
    """Open the default system browser to the local server URL."""
    url = f"http://{HOST}:{PORT}/"                                    # <-- Construct server root URL
    try:
        webbrowser.open(url)                                          # <-- Open browser tab
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
    print("  NOBLE ARCHITECTURE | VectorForge - Local Development Server")
    print("=" * 70)
    print(f"  Server URL   : http://{HOST}:{PORT}/")
    print(f"  Serving from : {APP_DIR}")
    print("")
    print("  Static Asset Routes:")
    print(f"    - http://{HOST}:{PORT}/                   (index.html)")
    print(f"    - http://{HOST}:{PORT}/03__AppStyles/     (CSS)")
    print(f"    - http://{HOST}:{PORT}/03__AppModules/    (JS modules)")
    print(f"    - http://{HOST}:{PORT}/02__AppData/       (config JSON)")
    print("")
    print("  Press Ctrl+C to stop the server")
    print("=" * 70)
    print("")

# endregion -------------------------------------------------------------------
