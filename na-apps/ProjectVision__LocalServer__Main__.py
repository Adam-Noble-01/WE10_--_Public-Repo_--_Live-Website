#!/usr/bin/env python3
# =============================================================================
# NOBLE ARCHITECTURE - PROJECT VISION LOCAL DEVELOPMENT SERVER (FLASK)
# =============================================================================
#
# FILE       : ProjectVision__LocalServer__Main__.py
# MODULE     : LocalDevServer
# AUTHOR     : Adam Noble - Noble Architecture
# PURPOSE    : Flask-based HTTP server for local testing of Project Vision
# CREATED    : 27-Feb-2026
#
# DESCRIPTION:
# - Serves static files from the repository root with CORS support
# - Auto-opens browser to the Project Vision landing page
# - Supports hot-reloading in debug mode
# - Provides health-check API endpoint
#
# USAGE:
#   python ProjectVision__LocalServer__Main__.py
#   python ProjectVision__LocalServer__Main__.py --debug
#   python ProjectVision__LocalServer__Main__.py --port 3000
#   python ProjectVision__LocalServer__Main__.py --project NP03
#   python ProjectVision__LocalServer__Main__.py --no-browser
#
# =============================================================================


# #region ---------------------------------------------------------------------
# REGION | Imports
# -----------------------------------------------------------------------------

import os
import sys
import webbrowser
import threading
import time
import platform
import argparse

try:
    from flask import Flask, send_from_directory, jsonify, abort
    from flask_cors import CORS
except ImportError:
    print("\n" + "=" * 60)
    print("  ERROR: Flask dependencies not installed!")
    print("=" * 60)
    print("\n  Please install required packages:")
    print("    pip install flask flask-cors")
    print("=" * 60 + "\n")
    sys.exit(1)

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Configuration
# -----------------------------------------------------------------------------

PORT                     = 8090                                      # <-- Default port (avoids 8080 used by Project Admin)
HOST                     = '127.0.0.1'                               # <-- Localhost only
DEBUG_MODE               = False                                     # <-- Flask debug mode

CORE_APP_PATH            = '/na-apps/05__ProjectVision__CoreAppCode/'

DEFAULT_PROJECT          = 'NP03'                                    # <-- Project code
DEFAULT_YEAR             = '26'                                      # <-- Year folder (2026)


def get_server_url():
    """Get full URL with default project parameters."""
    return f"http://localhost:{PORT}{CORE_APP_PATH}index.html?project={DEFAULT_PROJECT}"


def get_base_url():
    """Get base URL without project parameters."""
    return f"http://localhost:{PORT}{CORE_APP_PATH}"

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Flask Application Setup
# -----------------------------------------------------------------------------

SCRIPT_DIR               = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT                = os.path.abspath(os.path.join(SCRIPT_DIR, '..'))

app                      = Flask(__name__)

CORS(app, resources={
    r"/*": {
        "origins"        : "*",
        "methods"        : ["GET", "OPTIONS"],
        "allow_headers"  : ["Content-Type"]
    }
})

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Route Handlers
# -----------------------------------------------------------------------------

@app.route('/')
def index():
    """Redirect root to default project."""
    url = get_server_url()
    return f'''
    <html>
    <head>
        <meta http-equiv="refresh" content="0; url={url}" />
    </head>
    <body>
        <p>Redirecting to <a href="{url}">Project Vision ({DEFAULT_PROJECT})</a>...</p>
    </body>
    </html>
    '''


@app.route('/api/health')
def health_check():
    """Health check endpoint for local server."""
    return jsonify({
        'status'         : 'ok',
        'service'        : 'na-projectvision-local-dev',
        'port'           : PORT,
        'repoRoot'       : REPO_ROOT
    })

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Static File Serving
# -----------------------------------------------------------------------------

@app.route('/<path:filepath>')
def serve_static(filepath):
    """Serve static files from repository root."""
    full_path = os.path.join(REPO_ROOT, filepath)

    if os.path.isdir(full_path):
        index_path = os.path.join(full_path, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(full_path, 'index.html')
        else:
            abort(404)

    if os.path.exists(full_path):
        directory = os.path.dirname(full_path)
        filename = os.path.basename(full_path)
        return send_from_directory(directory, filename)

    abort(404)

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Browser Launch
# -----------------------------------------------------------------------------

def open_browser():
    """Open browser after short delay to ensure server is ready."""
    time.sleep(1.5)

    url = get_server_url()
    print(f"  Opening browser to {url}...")

    try:
        webbrowser.open(url)

        if platform.system() == 'Windows':
            time.sleep(0.5)
            try:
                import subprocess
                subprocess.run([
                    'powershell', '-Command',
                    "(New-Object -ComObject WScript.Shell).AppActivate((Get-Process | "
                    "Where-Object {$_.MainWindowTitle -like '*localhost*' -or "
                    "$_.ProcessName -like '*chrome*' -or "
                    "$_.ProcessName -like '*firefox*' -or "
                    "$_.ProcessName -like '*msedge*'} | "
                    "Select-Object -First 1).Id)"
                ], capture_output=True, timeout=2)
            except Exception:
                pass

        elif platform.system() == 'Darwin':
            time.sleep(0.5)
            try:
                import subprocess
                subprocess.run([
                    'osascript', '-e',
                    'tell application "System Events" to set frontmost of '
                    'first process whose frontmost is true to false'
                ])
                subprocess.run([
                    'osascript', '-e',
                    'tell application "System Events" to set frontmost of '
                    'first process whose name contains "Chrome" or '
                    'name contains "Firefox" or name contains "Safari" to true'
                ])
            except Exception:
                pass

    except Exception as e:
        print(f"  Note: Could not auto-open browser: {e}")
        print(f"  Please manually open: {url}")

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Startup Banner
# -----------------------------------------------------------------------------

def print_banner():
    """Print startup banner with server information."""
    base_url = get_base_url()
    server_url = get_server_url()

    print("\n" + "=" * 70)
    print("  Noble Architecture - Project Vision Development Server (Flask)")
    print("=" * 70)
    print(f"\n  Serving from: {REPO_ROOT}")
    print(f"\n  Server running at: http://localhost:{PORT}/")
    print(f"\n  Default project: {DEFAULT_PROJECT} (Year: {DEFAULT_YEAR})")
    print(f"  Debug mode: {'ON' if DEBUG_MODE else 'OFF'}")

    print("\n  Test URLs:")
    print(f"    - Default ({DEFAULT_PROJECT}): {server_url}")
    print(f"    - Example (AA00): {base_url}index.html?project=AA00")
    print(f"    - Example (BH03): {base_url}index.html?project=BH03")

    print("\n  Sub-Application URLs (via Project Vision):")
    print(f"    - Project Admin: http://localhost:{PORT}/na-apps/10__NaProjectAdmin__DocumentSystem__CoreAppCode/?project={DEFAULT_PROJECT}")
    print(f"    - PlanVision:    http://localhost:{PORT}/na-apps/20__PlanVision__CoreAppCode/PlanVision__WebApp__Main__.html?project={DEFAULT_PROJECT}")
    print(f"    - TrueVision:    http://localhost:{PORT}/na-apps/30__TrueVision__CoreAppCode/Index.html?project={DEFAULT_PROJECT}")

    print(f"\n  API:")
    print(f"    - Health: http://localhost:{PORT}/api/health")

    print("\n  Press Ctrl+C to stop the server")
    print("=" * 70 + "\n")

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Command Line Arguments
# -----------------------------------------------------------------------------

def parse_arguments():
    """Parse command line arguments."""
    global PORT, DEBUG_MODE, DEFAULT_PROJECT, DEFAULT_YEAR

    parser = argparse.ArgumentParser(
        description='Noble Architecture - Project Vision Local Development Server'
    )

    parser.add_argument(
        '--port', '-p',
        type=int,
        default=8090,
        help='Port to run server on (default: 8090)'
    )

    parser.add_argument(
        '--debug', '-d',
        action='store_true',
        help='Enable Flask debug mode with hot-reloading'
    )

    parser.add_argument(
        '--project',
        type=str,
        default='NP03',
        help='Default project code to open (default: NP03)'
    )

    parser.add_argument(
        '--year',
        type=str,
        default='26',
        help='Default year folder (default: 26)'
    )

    parser.add_argument(
        '--no-browser',
        action='store_true',
        help='Do not auto-open browser on startup'
    )

    args = parser.parse_args()

    PORT            = args.port
    DEBUG_MODE      = args.debug
    DEFAULT_PROJECT = args.project
    DEFAULT_YEAR    = args.year

    return args

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Main Entry Point
# -----------------------------------------------------------------------------

def main():
    """Main entry point for the development server."""
    args = parse_arguments()

    if not os.path.exists(REPO_ROOT):
        print(f"\n  ERROR: Repository root not found: {REPO_ROOT}")
        print("  Please run this script from the correct location.\n")
        sys.exit(1)

    print_banner()

    if not args.no_browser:
        browser_thread = threading.Thread(target=open_browser, daemon=True)
        browser_thread.start()

    try:
        app.run(
            host         = HOST,
            port         = PORT,
            debug        = DEBUG_MODE,
            use_reloader = DEBUG_MODE
        )
    except KeyboardInterrupt:
        print("\n\nServer stopped.")
        sys.exit(0)


if __name__ == "__main__":
    main()

# endregion -------------------------------------------------------------------
