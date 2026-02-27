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
import re
import json
import webbrowser
import threading
import time
import platform
import argparse
import traceback

try:
    from flask import Flask, send_from_directory, jsonify, abort, request
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
PORTAL_ROOT              = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'na-project-portal'))
PROJECTVISION_CORE_DIR   = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '05__ProjectVision__CoreAppCode'))
TRUEVISION_CONTENT_DIR   = '30__TrueVision__AppContent'
TRUEVISION_DATA_FILENAME = 'TrueVision__ProjectData__.json'
YEAR_FOLDER_PATTERN      = re.compile(r'^(\d{2})-Projects$')

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
# REGION | Path Resolution Helpers
# -----------------------------------------------------------------------------

def resolve_case_insensitive_path(base_path, relative_path):
    """
    Resolve a repo-relative path in a case-insensitive way.
    Useful in mixed-case entrypoint requests (Index.html vs index.html).
    Returns absolute path when resolved, else None.
    """
    normalized = relative_path.replace('\\', '/').strip('/')
    if not normalized:
        return base_path

    current_path = base_path
    for segment in normalized.split('/'):
        exact_path = os.path.join(current_path, segment)
        if os.path.exists(exact_path):
            current_path = exact_path
            continue

        if not os.path.isdir(current_path):
            return None

        lower_segment = segment.lower()
        try:
            entries = os.listdir(current_path)
        except OSError:
            return None

        matched_entry = next((entry for entry in entries if entry.lower() == lower_segment), None)
        if not matched_entry:
            return None

        current_path = os.path.join(current_path, matched_entry)

    return current_path

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
        "methods"        : ["GET", "POST", "OPTIONS"],
        "allow_headers"  : ["Content-Type"]
    }
})

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Route Handlers
# -----------------------------------------------------------------------------

def _sanitize_project_code(project_code):
    """Normalize and validate project code from route parameter."""
    normalized = (project_code or '').strip().upper()
    if not re.match(r'^[A-Z]{2}[0-9]{2}$', normalized):
        return None
    return normalized


def _extract_project_context():
    """
    Read project context from query params/body.
    Priority order:
    - Query string (?project-folder=...&year=...)
    - JSON body ({ projectFolder, year })
    """
    body = request.get_json(silent=True) or {}
    project_folder = (
        request.args.get('project-folder')
        or request.args.get('project_folder')
        or body.get('projectFolder')
        or body.get('project-folder')
    )
    year_code = request.args.get('year') or body.get('year')
    return project_folder, year_code


def _find_project_file_by_folder(project_code, project_folder, year_code=None):
    """Resolve project data path directly from a known project folder."""
    if not project_folder:
        return None

    # Folder names are expected like NP03__AshnessClose; block traversal.
    safe_folder = os.path.basename(project_folder.strip())
    if safe_folder != project_folder.strip():
        return None

    if not safe_folder.startswith(project_code + '__') and not safe_folder.startswith(project_code + '_-_'):
        return None

    year_folder = f"{year_code}-Projects" if year_code else None
    candidate_years = []

    if year_folder:
        candidate_years.append(year_folder)
    if f"{DEFAULT_YEAR}-Projects" not in candidate_years:
        candidate_years.append(f"{DEFAULT_YEAR}-Projects")

    for yf in candidate_years:
        candidate = os.path.join(
            PORTAL_ROOT,
            yf,
            safe_folder,
            TRUEVISION_CONTENT_DIR,
            TRUEVISION_DATA_FILENAME
        )
        if os.path.isfile(candidate):
            return candidate

    # Fallback: search all years.
    if not os.path.isdir(PORTAL_ROOT):
        return None

    for year_entry in sorted(os.listdir(PORTAL_ROOT)):
        if not YEAR_FOLDER_PATTERN.match(year_entry):
            continue
        candidate = os.path.join(
            PORTAL_ROOT,
            year_entry,
            safe_folder,
            TRUEVISION_CONTENT_DIR,
            TRUEVISION_DATA_FILENAME
        )
        if os.path.isfile(candidate):
            return candidate

    return None


def _find_project_file_by_code(project_code, year_code=None):
    """Resolve project data path by scanning project folders for matching code."""
    if not os.path.isdir(PORTAL_ROOT):
        return None

    preferred_years = []
    if year_code:
        preferred_years.append(f"{year_code}-Projects")
    preferred_years.append(f"{DEFAULT_YEAR}-Projects")

    discovered_years = [name for name in sorted(os.listdir(PORTAL_ROOT)) if YEAR_FOLDER_PATTERN.match(name)]

    ordered_years = []
    for year_name in preferred_years + discovered_years:
        if year_name not in ordered_years:
            ordered_years.append(year_name)

    for year_folder in ordered_years:
        year_path = os.path.join(PORTAL_ROOT, year_folder)
        if not os.path.isdir(year_path):
            continue

        for project_folder in sorted(os.listdir(year_path)):
            if not (
                project_folder.startswith(project_code + '__')
                or project_folder.startswith(project_code + '_-_')
            ):
                continue

            candidate = os.path.join(
                year_path,
                project_folder,
                TRUEVISION_CONTENT_DIR,
                TRUEVISION_DATA_FILENAME
            )
            if os.path.isfile(candidate):
                return candidate

    return None


def _resolve_project_data_path(project_code):
    """Resolve the TrueVision project data file path from route + request context."""
    project_folder, year_code = _extract_project_context()

    path = _find_project_file_by_folder(project_code, project_folder, year_code)
    if path:
        return path

    return _find_project_file_by_code(project_code, year_code)


def _extract_project_folder_from_project_file(project_file_path):
    """Infer project folder from .../{year}-Projects/{project_folder}/30__TrueVision__AppContent/..."""
    normalized = project_file_path.replace('\\', '/')
    marker = f"/{TRUEVISION_CONTENT_DIR}/{TRUEVISION_DATA_FILENAME}"
    if marker not in normalized:
        return None

    prefix = normalized.split(marker)[0]
    return os.path.basename(prefix)


def _run_targeted_r2_sync(project_folder):
    """Run ProjectVision R2 sync for one project folder."""
    if not os.path.isdir(PROJECTVISION_CORE_DIR):
        return False, f'ProjectVision core directory not found: {PROJECTVISION_CORE_DIR}'

    if PROJECTVISION_CORE_DIR not in sys.path:
        sys.path.insert(0, PROJECTVISION_CORE_DIR)

    try:
        from CloudflareR2__ModelSync__Main__ import run_r2_sync
    except Exception as error:
        traceback.print_exc()
        return False, f'Failed to import R2 sync module: {type(error).__name__}: {error}'

    try:
        exit_code = run_r2_sync(
            target_project=project_folder,
            dry_run_only=False,
            auto_confirm_upload=True
        )
        if exit_code == 0:
            return True, 'CDN sync complete'
        return False, f'CDN sync failed with exit code {exit_code}'
    except Exception as error:
        traceback.print_exc()
        return False, f'CDN sync raised {type(error).__name__}: {error}'

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


@app.route('/api/projects/<project_code>', methods=['GET', 'POST'])
def project_data_api(project_code):
    """Read or update TrueVision__ProjectData__.json for a project."""
    safe_project_code = _sanitize_project_code(project_code)
    if not safe_project_code:
        return jsonify({'error': 'Invalid project code'}), 400

    project_file_path = _resolve_project_data_path(safe_project_code)
    if not project_file_path:
        return jsonify({'error': f'Project not found: {safe_project_code}'}), 404

    if request.method == 'GET':
        try:
            with open(project_file_path, 'r', encoding='utf-8') as file_handle:
                project_data = json.load(file_handle)
            return jsonify(project_data)
        except Exception as error:
            print(f"[LocalServer] Failed to read project data file: {project_file_path}")
            print(f"[LocalServer] {type(error).__name__}: {error}")
            return jsonify({'error': 'Failed to read project data file'}), 500

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({'error': 'Request body must be a JSON object'}), 400

    try:
        with open(project_file_path, 'w', encoding='utf-8', newline='\n') as file_handle:
            json.dump(payload, file_handle, indent=4, ensure_ascii=False)
            file_handle.write('\n')
    except Exception as error:
        print(f"[LocalServer] Failed to write project data file: {project_file_path}")
        print(f"[LocalServer] {type(error).__name__}: {error}")
        return jsonify({'error': 'Failed to write project data file'}), 500

    return jsonify({
        'status': 'ok',
        'message': f'Project data updated for {safe_project_code}',
        'projectFile': project_file_path
    })


@app.route('/api/projects/<project_code>/sync-cdn', methods=['POST'])
def project_sync_cdn_api(project_code):
    """Trigger targeted CDN sync for the resolved project folder."""
    safe_project_code = _sanitize_project_code(project_code)
    if not safe_project_code:
        return jsonify({'error': 'Invalid project code'}), 400

    project_file_path = _resolve_project_data_path(safe_project_code)
    if not project_file_path:
        return jsonify({'error': f'Project not found: {safe_project_code}'}), 404

    project_folder = _extract_project_folder_from_project_file(project_file_path)
    if not project_folder:
        return jsonify({'error': 'Could not resolve project folder for CDN sync'}), 500

    success, message = _run_targeted_r2_sync(project_folder)
    if not success:
        return jsonify({'error': message, 'projectFolder': project_folder}), 500

    return jsonify({
        'status': 'ok',
        'message': message,
        'projectCode': safe_project_code,
        'projectFolder': project_folder
    })

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Static File Serving
# -----------------------------------------------------------------------------

@app.route('/<path:filepath>')
def serve_static(filepath):
    """Serve static files from repository root."""
    normalized_path = filepath.replace('\\', '/')

    # CANONICAL ENTRYPOINT | Prefer lowercase index.html when mixed-case is requested
    # -------------------------------------------------------------------------
    if normalized_path.endswith('/Index.html') or normalized_path == 'Index.html':
        normalized_path = normalized_path[:-10] + 'index.html' if normalized_path.endswith('/Index.html') else 'index.html'

    full_path = resolve_case_insensitive_path(REPO_ROOT, normalized_path)
    if not full_path:
        abort(404)

    if os.path.isdir(full_path):
        index_path_lower = os.path.join(full_path, 'index.html')
        index_path_upper = os.path.join(full_path, 'Index.html')
        if os.path.exists(index_path_lower):
            return send_from_directory(full_path, 'index.html')
        if os.path.exists(index_path_upper):
            return send_from_directory(full_path, 'Index.html')
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
    print(f"    - TrueVision:    http://localhost:{PORT}/na-apps/30__TrueVision__CoreAppCode/index.html?project={DEFAULT_PROJECT}")

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
