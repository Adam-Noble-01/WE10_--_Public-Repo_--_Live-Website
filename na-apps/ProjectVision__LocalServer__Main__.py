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
# - Serves the Noble Architecture Studio shell at the server root (localhost only)
#   from 02__ProjectVision__StudioShell__AppCode, and the card-based project
#   gallery at /gallery inside it
# - Injects the Studio shell bridge into every HTML page it serves, which is how
#   the sub-applications gain the shell without a single edit to their source
# - Opens a chromeless application window on startup
# - Supports hot-reloading in debug mode
# - Provides health-check, project-data and drawing-notes API endpoints
#
# USAGE:
#   python ProjectVision__LocalServer__Main__.py
#   python ProjectVision__LocalServer__Main__.py --debug
#   python ProjectVision__LocalServer__Main__.py --port 3000
#   python ProjectVision__LocalServer__Main__.py --project NP03
#   python ProjectVision__LocalServer__Main__.py --no-browser
#   python ProjectVision__LocalServer__Main__.py --no-app-window
#   python ProjectVision__LocalServer__Main__.py --silent --log-file <name>
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
import argparse
import traceback
import shutil
import subprocess

from urllib.parse import quote

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ProjectVision__DevLauncher__Shared__ as dev_launcher      # <-- Shared with the Project Admin dev server
from ProjectVision__ProjectManager__Api__ import project_manager_api   # <-- Multi-project admin endpoints

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
YEAR_FOLDER_PATTERN      = re.compile(r'^(\d{2})-Projects$')

TRUEVISION_CONTENT_DIR    = '30__TrueVision__AppContent'
TRUEVISION_DATA_FILENAME  = 'TrueVision__ProjectData__.json'
TRUEVISION_SIBLING_FILES  = frozenset({
    'TrueVision__DrawingNotes__.json',
})

# SUB-APPLICATION ENTRYPOINTS | Shared with the Project Admin dev server
SUB_APP_PATHS            = dev_launcher.SUB_APP_PATHS

DEFAULT_PROJECT          = None                                      # <-- Project code (None = open dev landing)
DEFAULT_YEAR             = '26'                                      # <-- Year folder (2026)

# STUDIO SHELL | Localhost-only application shell wrapped around every sub-app
STUDIO_SHELL_DIR_NAME    = '02__ProjectVision__StudioShell__AppCode'
STUDIO_SHELL_URL_PREFIX  = '/__na-studio/'
STUDIO_SHELL_PAGE        = 'NaStudioShell__AppShell__.html'
STUDIO_SHELL_BRIDGE      = '02__Src__AppModules/NaStudioShell__HostedPageBridge__.js'
STUDIO_SHELL_MARKER      = 'NaStudioShell__HostedPageBridge__.js'    # <-- Appears in the injected tag itself
GALLERY_PATH             = '/gallery'                                # <-- Project gallery, inside the shell frame
MANAGER_PATH             = '/project-manager'                        # <-- Project Manager table, inside the frame
MANAGER_PAGE             = 'NaStudioShell__ProjectManager__.html'

SILENT_MODE              = False                                     # <-- True when launched with no console
APP_WINDOW_MODE          = True                                      # <-- Open a chromeless PWA-style window
OUTPUT_LOG_HANDLE        = None                                      # <-- Held open for the lifetime of the process


def get_landing_url():
    """Get the Studio shell URL - the single entry point for every local app."""
    return f"http://localhost:{PORT}/"


def get_server_url():
    """Get the startup URL - the Studio shell, deep-linked when a project was named."""
    if not DEFAULT_PROJECT:
        return get_landing_url()

    inner_path = f"{CORE_APP_PATH}index.html?project={DEFAULT_PROJECT}"
    return f"http://localhost:{PORT}/#{quote(inner_path, safe='')}"


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

app.register_blueprint(project_manager_api)                      # <-- /api/manager/... Project Manager tab

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


def _write_json_file(file_path, payload):
    """Write a JSON object to disk with project-standard formatting."""
    directory = os.path.dirname(file_path)
    os.makedirs(directory, exist_ok=True)
    with open(file_path, 'w', encoding='utf-8', newline='\n') as file_handle:
        json.dump(payload, file_handle, indent=4, ensure_ascii=False)
        file_handle.write('\n')


def _sanitize_sibling_filename(filename):
    """Allow only known TrueVision sibling JSON files beside project data."""
    safe_name = os.path.basename((filename or '').strip())
    if safe_name != (filename or '').strip():
        return None
    if safe_name not in TRUEVISION_SIBLING_FILES:
        return None
    return safe_name


def _resolve_project_sibling_path(project_code, filename):
    """Resolve a sibling JSON path in the same folder as TrueVision__ProjectData__.json."""
    project_file_path = _resolve_project_data_path(project_code)
    if not project_file_path:
        return None
    return os.path.join(os.path.dirname(project_file_path), filename)


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
    """Serve the Studio shell - the single entry point for every local app."""
    shell_dir  = os.path.join(SCRIPT_DIR, STUDIO_SHELL_DIR_NAME)
    shell_page = os.path.join(shell_dir, STUDIO_SHELL_PAGE)

    if not os.path.isfile(shell_page):
        return (
            f"<h1>Studio shell missing</h1>"
            f"<p>Expected: na-apps/{STUDIO_SHELL_DIR_NAME}/{STUDIO_SHELL_PAGE}</p>",
            500
        )

    response = send_from_directory(shell_dir, STUDIO_SHELL_PAGE)
    response.headers['Cache-Control'] = 'no-store'
    return response


@app.route(GALLERY_PATH)
def gallery():
    """Serve the project gallery - a card view of every project."""
    landing = dev_launcher.get_landing_file(REPO_ROOT)

    if not landing:
        return (
            f"<h1>Project gallery page missing</h1>"
            f"<p>Expected: na-apps/{dev_launcher.DEV_LANDING_FILENAME}</p>",
            500
        )

    response = send_from_directory(landing[0], landing[1])
    response.headers['Cache-Control'] = 'no-store'
    return response


@app.route(MANAGER_PATH)
def project_manager_page():
    """Serve the Project Manager table - multi-project admin, inside the shell."""
    shell_dir    = os.path.join(SCRIPT_DIR, STUDIO_SHELL_DIR_NAME)
    manager_page = os.path.join(shell_dir, MANAGER_PAGE)

    if not os.path.isfile(manager_page):
        return (
            f"<h1>Project Manager page missing</h1>"
            f"<p>Expected: na-apps/{STUDIO_SHELL_DIR_NAME}/{MANAGER_PAGE}</p>",
            500
        )

    response = send_from_directory(shell_dir, MANAGER_PAGE)
    response.headers['Cache-Control'] = 'no-store'
    return response


@app.route(STUDIO_SHELL_URL_PREFIX + '<path:filename>')
def studio_shell_asset(filename):
    """Serve the Studio shell assets - stylesheet, controls, bridge and manifest."""
    shell_dir = os.path.join(SCRIPT_DIR, STUDIO_SHELL_DIR_NAME)
    full_path = os.path.join(shell_dir, filename)

    if not os.path.isfile(full_path):
        abort(404)

    response = send_from_directory(shell_dir, filename)

    # The shell is edited live, so it must never be served from the HTTP cache.
    response.headers['Cache-Control'] = 'no-store'

    if filename.endswith('.webmanifest'):
        response.headers['Content-Type'] = 'application/manifest+json'

    return response


@app.route('/api/dev/projects')
def dev_projects_api():
    """Merged project list for the local dev launcher page."""
    try:
        payload = dev_launcher.collect_dev_projects(REPO_ROOT, DEFAULT_YEAR)
    except Exception as error:
        traceback.print_exc()
        return jsonify({'error': f'{type(error).__name__}: {error}'}), 500

    payload['server'] = {
        'port'       : PORT,
        'service'    : 'na-projectvision-local-dev',
        'repoRoot'   : REPO_ROOT,
        'portalRoot' : PORTAL_ROOT
    }

    response = jsonify(payload)
    response.headers['Cache-Control'] = 'no-store'
    return response


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
        _write_json_file(project_file_path, payload)
    except Exception as error:
        print(f"[LocalServer] Failed to write project data file: {project_file_path}")
        print(f"[LocalServer] {type(error).__name__}: {error}")
        return jsonify({'error': 'Failed to write project data file'}), 500

    return jsonify({
        'status': 'ok',
        'message': f'Project data updated for {safe_project_code}',
        'projectFile': project_file_path
    })


@app.route('/api/projects/<project_code>/files/<path:filename>', methods=['GET', 'POST'])
def project_sibling_file_api(project_code, filename):
    """Read or replace a TrueVision sibling JSON file beside the project data."""
    safe_project_code = _sanitize_project_code(project_code)
    if not safe_project_code:
        return jsonify({'error': 'Invalid project code'}), 400

    safe_filename = _sanitize_sibling_filename(filename)
    if not safe_filename:
        return jsonify({'error': f'Refused project file "{filename}"'}), 400

    sibling_path = _resolve_project_sibling_path(safe_project_code, safe_filename)
    if not sibling_path:
        return jsonify({'error': f'Project not found: {safe_project_code}'}), 404

    if request.method == 'GET':
        if not os.path.isfile(sibling_path):
            return jsonify({'error': f'{safe_filename} is not on disk yet', 'missing': True}), 404
        try:
            with open(sibling_path, 'r', encoding='utf-8') as file_handle:
                sibling_data = json.load(file_handle)
            return jsonify(sibling_data)
        except Exception as error:
            print(f"[LocalServer] Failed to read sibling file: {sibling_path}")
            print(f"[LocalServer] {type(error).__name__}: {error}")
            return jsonify({'error': 'Failed to read project file'}), 500

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({'error': 'Request body must be a JSON object'}), 400

    try:
        _write_json_file(sibling_path, payload)
    except Exception as error:
        print(f"[LocalServer] Failed to write sibling file: {sibling_path}")
        print(f"[LocalServer] {type(error).__name__}: {error}")
        return jsonify({'error': 'Failed to write project file'}), 500

    return jsonify({
        'status': 'ok',
        'message': f'{safe_filename} updated for {safe_project_code}',
        'projectFile': sibling_path
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
# REGION | Studio Shell Injection
# -----------------------------------------------------------------------------
#
# Every HTML page this server returns gets one small script tag appended, which
# lets the Studio shell host the sub-applications without a single edit to their
# source. This runs on localhost only - the public website serves the very same
# files untouched, because it never runs this server.
#
# -----------------------------------------------------------------------------

@app.after_request
def inject_studio_shell_bridge(response):
    """Append the Studio shell bridge script to HTML responses."""
    if response.status_code != 200:
        return response

    if response.mimetype != 'text/html':
        return response

    # ESCAPE HATCH | ?studio=off serves the page exactly as the live site does
    if request.args.get('studio') == 'off':
        return response

    # The shell hosts the bridge; it must never be given one of its own.
    if request.path == '/' or request.path.startswith(STUDIO_SHELL_URL_PREFIX):
        return response

    try:
        response.direct_passthrough = False                          # <-- send_from_directory streams by default
        html = response.get_data(as_text=True)
    except (RuntimeError, UnicodeDecodeError):
        return response

    if STUDIO_SHELL_MARKER in html:
        return response

    lowered    = html.lower()
    insert_at  = lowered.rfind('</body>')

    if insert_at == -1:
        return response

    script_tag = (
        f'\n<!-- Injected by the Project Vision local dev server: Studio shell bridge -->\n'
        f'<script src="{STUDIO_SHELL_URL_PREFIX}{STUDIO_SHELL_BRIDGE}" defer></script>\n'
    )

    response.set_data(html[:insert_at] + script_tag + html[insert_at:])
    response.headers['Cache-Control'] = 'no-store'                   # <-- The body no longer matches the file on disk

    return response

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Browser Launch
# -----------------------------------------------------------------------------

CHROMIUM_CANDIDATES = [
    # EDGE | The machine default, and the browser the Studio PWA installs into
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
    # CHROME | Fallback when Edge is absent
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
]


def find_chromium_browser():
    """
    Locate a Chromium browser that understands --app=, which is what turns the
    Studio shell into a chromeless application window. Returns None when none
    is installed, in which case the ordinary browser is used instead.
    """
    for candidate in CHROMIUM_CANDIDATES:
        if os.path.isfile(candidate):
            return candidate

    for executable in ('msedge', 'chrome'):
        resolved = shutil.which(executable)
        if resolved:
            return resolved

    return None


def open_app_window(url):
    """
    Open the Studio shell in a chromeless application window.
    Returns True when the window was launched, False to fall back to a tab.
    """
    browser_path = find_chromium_browser()

    if not browser_path:
        return False

    try:
        subprocess.Popen(
            [
                browser_path,
                f'--app={url}',                                      # <-- No tab strip, no address bar
                '--window-size=1680,1000'
            ],
            stdout = subprocess.DEVNULL,
            stderr = subprocess.DEVNULL
        )
        return True
    except Exception as error:
        print(f"  Note: Could not open the application window: {error}")
        return False


def open_browser():
    """Open the Studio shell once the server is ready."""
    time.sleep(1.5)

    url   = get_server_url()
    label = 'Studio shell' if not DEFAULT_PROJECT else f'Studio shell - project {DEFAULT_PROJECT}'

    if APP_WINDOW_MODE and open_app_window(url):
        print(f"  Opening application window at {url}  ({label})...")
        return

    print(f"  Opening browser to {url}  ({label})...")

    try:
        webbrowser.open(url)
    except Exception as error:
        print(f"  Note: Could not auto-open browser: {error}")
        print(f"  Please manually open: {url}")

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Startup Banner
# -----------------------------------------------------------------------------

def print_banner():
    """Print startup banner with server information."""
    base_url = get_base_url()

    print("\n" + "=" * 70)
    print("  Noble Architecture - Project Vision Development Server (Flask)")
    print("=" * 70)
    print(f"\n  Serving from: {REPO_ROOT}")
    print(f"  Debug mode:   {'ON' if DEBUG_MODE else 'OFF'}")

    print("\n  NOBLE ARCHITECTURE STUDIO (start here):")
    print(f"    {get_landing_url()}")
    print("    One window over the whole ecosystem - project gallery, then any")
    print("    sub-app, with Back, Forward and a project switcher in the bar.")
    print(f"    Gallery on its own:  http://localhost:{PORT}{GALLERY_PATH}")

    if DEFAULT_PROJECT:
        print(f"\n  Startup project override: {DEFAULT_PROJECT} (Year: {DEFAULT_YEAR})")
        print(f"    {get_server_url()}")

    try:
        summary = dev_launcher.collect_dev_projects(REPO_ROOT, DEFAULT_YEAR)
        live    = sum(1 for item in summary['projects'] if item['isLive'])
        print(f"\n  Projects found: {len(summary['projects'])} ({live} with app content)")
    except Exception as error:
        print(f"\n  Projects found: unavailable ({type(error).__name__}: {error})")

    print("\n  Direct URLs (any project code):")
    print(f"    - Project Vision: {base_url}index.html?project=XX00")
    print(f"    - Project Admin:  http://localhost:{PORT}/na-apps/{SUB_APP_PATHS['projectAdmin']}?project=XX00")
    print(f"    - PlanVision:     http://localhost:{PORT}/na-apps/{SUB_APP_PATHS['planVision']}?project=XX00")
    print(f"    - TrueVision:     http://localhost:{PORT}/na-apps/{SUB_APP_PATHS['trueVision']}?project=XX00")

    print("\n  API:")
    print(f"    - Health:         http://localhost:{PORT}/api/health")
    print(f"    - Projects:       http://localhost:{PORT}/api/dev/projects")
    print(f"    - Project data:   POST /api/projects/<code>")
    print(f"    - Drawing notes:  GET/POST /api/projects/<code>/files/TrueVision__DrawingNotes__.json")

    print("\n  Press Ctrl+C to stop the server")
    print("=" * 70 + "\n")

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Command Line Arguments
# -----------------------------------------------------------------------------

def configure_output_streams(silent_mode, log_file_name):
    """
    Redirect stdout and stderr to a log file for console-less launches.
    Mirrors the ValePlanner and ValeSpec silent servers so the Windows startup
    shortcut can run this under pythonw.exe with nowhere to print.
    """
    global OUTPUT_LOG_HANDLE

    should_redirect = silent_mode or sys.stdout is None or sys.stderr is None

    if not should_redirect:
        return

    log_file_path = os.path.abspath(os.path.join(SCRIPT_DIR, log_file_name))

    try:
        os.makedirs(os.path.dirname(log_file_path), exist_ok=True)
        OUTPUT_LOG_HANDLE = open(log_file_path, 'a', encoding='utf-8', buffering=1)
    except OSError:
        return                                                       # <-- Never let logging stop the server

    sys.stdout = OUTPUT_LOG_HANDLE
    sys.stderr = OUTPUT_LOG_HANDLE

    print("")
    print("=" * 70)
    print(f"  PROJECT VISION - SILENT SERVER OUTPUT REDIRECT -> {log_file_path}")
    print(f"  Started: {time.strftime('%d-%b-%Y %H:%M:%S')}")
    print("=" * 70)


def parse_arguments():
    """Parse command line arguments."""
    global PORT, DEBUG_MODE, DEFAULT_PROJECT, DEFAULT_YEAR, SILENT_MODE, APP_WINDOW_MODE

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
        default=None,
        help='Open this project directly instead of the project launcher (e.g. NP03)'
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
        help='Do not auto-open the Studio shell on startup'
    )

    parser.add_argument(
        '--no-app-window',
        action='store_true',
        help='Open an ordinary browser tab instead of a chromeless app window'
    )

    parser.add_argument(
        '--silent',
        action='store_true',
        help='Console-less launch: redirect all output to the log file'
    )

    parser.add_argument(
        '--log-file',
        type=str,
        default='ProjectVision__LocalServer__Startup__.log',
        help='Log file path, relative to na-apps (used with --silent)'
    )

    args = parser.parse_args()

    PORT            = args.port
    DEBUG_MODE      = args.debug
    DEFAULT_PROJECT = args.project.strip().upper() if args.project else None
    DEFAULT_YEAR    = args.year
    SILENT_MODE     = args.silent
    APP_WINDOW_MODE = not args.no_app_window

    configure_output_streams(SILENT_MODE, args.log_file)

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

    # A silent startup server is a background service: it never opens a window.
    # The Start Menu shortcut opens the Studio window against the running server.
    if not args.no_browser and not SILENT_MODE:
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
