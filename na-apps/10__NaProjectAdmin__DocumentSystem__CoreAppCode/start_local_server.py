#!/usr/bin/env python3
# =============================================================================
# NOBLE ARCHITECTURE - LOCAL DEVELOPMENT SERVER (FLASK)
# =============================================================================
#
# FILE       : start_local_server.py
# MODULE     : LocalDevServer
# AUTHOR     : Adam Noble - Noble Architecture
# PURPOSE    : Flask-based HTTP server for local development and testing
# CREATED    : 31-Jan-2026
#
# DESCRIPTION:
# - Serves static files with CORS support for local development
# - Auto-opens browser to default project on startup
# - Provides foundation for future API endpoints and features
# - Supports hot-reloading in debug mode
#
# USAGE:
#   python start_local_server.py
#   python start_local_server.py --debug
#   python start_local_server.py --port 3000
#
# -----
#
# DEVELOPMENT LOG:
# 31-Jan-2026 - Version 1.2.0
# - Fixed static file serving for directories
# - Auto-serves index.html for directory requests
# - Fixed route ordering (specific routes before catch-all)
#
# 31-Jan-2026 - Version 1.1.0
# - Migrated from http.server to Flask
# - Added CORS support via flask-cors
# - Added command-line arguments
# - Implemented regional code structure
#
# 31-Jan-2026 - Version 1.0.0
# - Initial release with basic HTTP server
#
# =============================================================================


# #region -----
# REGION | Imports
# -----

import os
import sys
import webbrowser
import threading
import time
import platform
import argparse

try:
    from flask import Flask, send_from_directory, request, jsonify, abort
    from flask_cors import CORS
except ImportError:
    print("\n" + "=" * 60)
    print("  ERROR: Flask dependencies not installed!")
    print("=" * 60)
    print("\n  Please install required packages:")
    print("    pip install flask flask-cors")
    print("\n  Or run:")
    print("    pip install -r requirements.txt")
    print("=" * 60 + "\n")
    sys.exit(1)

# endregion -----


# #region -----
# REGION | Configuration
# -----

# Server Settings
PORT                     = 8080                                      # <-- Default port
HOST                     = '127.0.0.1'                               # <-- Localhost only
DEBUG_MODE               = False                                     # <-- Flask debug mode

# Path Settings
CORE_APP_PATH            = '/na-apps/10__NaProjectAdmin__DocumentSystem__CoreAppCode/'

# Default Project (John Smith)
DEFAULT_PROJECT          = 'JS01'                                    # <-- Project code
DEFAULT_YEAR             = '26'                                      # <-- Year folder (2026)


def get_server_url():
    """Get full URL with default project parameters."""
    return f"http://localhost:{PORT}{CORE_APP_PATH}?project={DEFAULT_PROJECT}&year={DEFAULT_YEAR}"


def get_base_url():
    """Get base URL without project parameters."""
    return f"http://localhost:{PORT}{CORE_APP_PATH}"

# endregion -----


# #region -----
# REGION | Flask Application Setup
# -----

# Determine repository root (2 levels up from script)
SCRIPT_DIR               = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT                = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))

# Create Flask app (no static_folder - we handle it manually)
app                      = Flask(__name__)

# Enable CORS for all routes
CORS(app, resources={
    r"/*": {
        "origins"        : "*",                                      # <-- Allow all origins
        "methods"        : ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers"  : ["Content-Type", "Authorization"]
    }
})

# endregion -----


# #region -----
# REGION | Route Handlers
# -----

@app.route('/')
def index():
    """Redirect root to default project."""
    return f'''
    <html>
    <head>
        <meta http-equiv="refresh" content="0; url={get_server_url()}" />
    </head>
    <body>
        <p>Redirecting to <a href="{get_server_url()}">{DEFAULT_PROJECT}</a>...</p>
    </body>
    </html>
    '''


@app.route('/api/health')
def health_check():
    """Health check endpoint for local server."""
    return jsonify({
        'status'         : 'ok',
        'service'        : 'na-projectadmin-local-dev',
        'port'           : PORT,
        'repoRoot'       : REPO_ROOT
    })


@app.route('/api/config')
def get_config_endpoint():
    """Return current server configuration."""
    return jsonify({
        'defaultProject' : DEFAULT_PROJECT,
        'defaultYear'    : DEFAULT_YEAR,
        'coreAppPath'    : CORE_APP_PATH,
        'serverUrl'      : get_server_url(),
        'baseUrl'        : get_base_url()
    })


@app.route('/<path:filepath>')
def serve_static(filepath):
    """Serve static files from repository root."""
    # Build full path
    full_path = os.path.join(REPO_ROOT, filepath)
    
    # If it's a directory, look for index.html
    if os.path.isdir(full_path):
        index_path = os.path.join(full_path, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(full_path, 'index.html')
        else:
            # Directory listing or 404
            abort(404)
    
    # If file exists, serve it
    if os.path.exists(full_path):
        directory = os.path.dirname(full_path)
        filename = os.path.basename(full_path)
        return send_from_directory(directory, filename)
    
    # File not found
    abort(404)

# endregion -----


# #region -----
# REGION | Browser Launch
# -----

def open_browser():
    """Open browser after short delay to ensure server is ready."""
    time.sleep(1.5)                                                  # <-- Wait for server
    
    url = get_server_url()
    print(f"  Opening browser to {url}...")
    
    try:
        webbrowser.open(url)
        
        # Platform-specific focus handling
        if platform.system() == 'Windows':
            time.sleep(0.5)                                          # <-- Wait for browser
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
                pass                                                 # <-- Fail silently
                
        elif platform.system() == 'Darwin':                          # <-- macOS
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

# endregion -----


# #region -----
# REGION | Startup Banner
# -----

def print_banner():
    """Print startup banner with server information."""
    base_url = get_base_url()
    server_url = get_server_url()
    
    print("\n" + "=" * 70)
    print("  Noble Architecture - Project Admin Development Server (Flask)")
    print("=" * 70)
    print(f"\n  Serving from: {REPO_ROOT}")
    print(f"\n  Server running at: {base_url}")
    print(f"\n  Default project: {DEFAULT_PROJECT} (Year: {DEFAULT_YEAR})")
    print(f"  Debug mode: {'ON' if DEBUG_MODE else 'OFF'}")
    
    print("\n  Test URLs:")
    print(f"    - Default (JS01): {server_url}")
    print(f"    - Main app: {base_url}")
    print(f"    - Example: {base_url}?project=AA00&year=26")
    
    print("\n  Editor Tools:")
    print(f"    - Project Index: {base_url}04__EditorTools/Editor__ProjectIndexBuilder__.html")
    print(f"    - Project Config: {base_url}04__EditorTools/Editor__ProjectConfig__.html")
    print(f"    - Quotation Builder: {base_url}04__EditorTools/Editor__QuotationBuilder__.html")
    print(f"    - Terms Editor: {base_url}04__EditorTools/Editor__TermsEditor__.html")
    
    print("\n  API Endpoints (Local):")
    print(f"    - Health: http://localhost:{PORT}/api/health")
    print(f"    - Config: http://localhost:{PORT}/api/config")
    
    print("\n" + "-" * 70)
    print("  Cloudflare Workers:")
    print("    - Deploy: cd 05__CloudflareWorkers && deploy.bat")
    print("    - URL: https://na-projectadmin-api.adam-fb3.workers.dev/")
    print("    - Guide: 05__CloudflareWorkers/SETUP_GUIDE.md")
    print("-" * 70)
    
    print("\n  Press Ctrl+C to stop the server")
    print("=" * 70 + "\n")

# endregion -----


# #region -----
# REGION | Command Line Arguments
# -----

def parse_arguments():
    """Parse command line arguments."""
    global PORT, DEBUG_MODE, DEFAULT_PROJECT, DEFAULT_YEAR
    
    parser = argparse.ArgumentParser(
        description='Noble Architecture - Local Development Server'
    )
    
    parser.add_argument(
        '--port', '-p',
        type=int,
        default=8080,
        help='Port to run server on (default: 8080)'
    )
    
    parser.add_argument(
        '--debug', '-d',
        action='store_true',
        help='Enable Flask debug mode with hot-reloading'
    )
    
    parser.add_argument(
        '--project',
        type=str,
        default='JS01',
        help='Default project code to open (default: JS01)'
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

# endregion -----


# #region -----
# REGION | Main Entry Point
# -----

def main():
    """Main entry point for the development server."""
    args = parse_arguments()
    
    # Verify repo root exists
    if not os.path.exists(REPO_ROOT):
        print(f"\n  ERROR: Repository root not found: {REPO_ROOT}")
        print("  Please run this script from the correct location.\n")
        sys.exit(1)
    
    # Print startup banner
    print_banner()
    
    # Start browser in background thread (unless --no-browser)
    if not args.no_browser:
        browser_thread = threading.Thread(target=open_browser, daemon=True)
        browser_thread.start()
    
    # Run Flask server
    try:
        app.run(
            host         = HOST,
            port         = PORT,
            debug        = DEBUG_MODE,
            use_reloader = DEBUG_MODE                                # <-- Hot reload in debug
        )
    except KeyboardInterrupt:
        print("\n\nServer stopped.")
        sys.exit(0)


if __name__ == "__main__":
    main()

# endregion -----
