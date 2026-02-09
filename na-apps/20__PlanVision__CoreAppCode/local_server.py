# -----------------------------------------------------------------------------
# LOCAL DEVELOPMENT SERVER | Noble Architecture - PlanVision WebApp
# -----------------------------------------------------------------------------
# Flask server for local testing of the PlanVision WebApp
# Serves static files and mimics the GitHub Pages environment
#
# Usage: python local_server.py
# Or use: start_local_server.bat
# -----------------------------------------------------------------------------

from flask import Flask, send_from_directory, send_file, jsonify
from flask_cors import CORS
import os
import webbrowser
import threading

# -----------------------------------------------------------------------------
# CONFIGURATION
# -----------------------------------------------------------------------------
PORT = 5900                                                                     # <-- Port number for local server
HOST = '127.0.0.1'                                                              # <-- Localhost only
AUTO_OPEN_BROWSER = True                                                        # <-- Auto-open browser on start

# Get the directory where this script is located
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(os.path.dirname(BASE_DIR))
PROJECT_PORTAL_DIR = os.path.join(REPO_ROOT, 'na-project-portal')
APP_ENTRY_FILENAME = 'PlanVision__WebApp__Main__.html'
INDEX_FILENAME = 'index.html'

# -----------------------------------------------------------------------------
# FLASK APP SETUP
# -----------------------------------------------------------------------------
app = Flask(__name__, static_folder=BASE_DIR)
CORS(app)  # Enable CORS for all routes (mimics CDN behavior)

# -----------------------------------------------------------------------------
# ROUTES
# -----------------------------------------------------------------------------

@app.route('/')
def root():
    """Serve index.html if it exists, otherwise serve the main app file"""
    index_path = os.path.join(BASE_DIR, INDEX_FILENAME)
    if os.path.exists(index_path):
        return send_file(index_path)
    return send_file(os.path.join(BASE_DIR, APP_ENTRY_FILENAME))


@app.route('/index.html')
def index_file():
    """Serve index.html (redirect page)"""
    return send_file(os.path.join(BASE_DIR, INDEX_FILENAME))


@app.route('/PlanVision__WebApp__Main__.html')
@app.route('/PlanVision__WebApp__Main__')
@app.route('/JH03__PlanVision__WebApp.html')
@app.route('/JH03__PlanVision__WebApp')
def main_app():
    """Serve the main PlanVision WebApp directly"""
    return send_file(os.path.join(BASE_DIR, APP_ENTRY_FILENAME))


@app.route('/na-project-portal/<path:filename>')
def project_portal_files(filename):
    """Serve project portal files from a separate local root"""
    return send_from_directory(PROJECT_PORTAL_DIR, filename)


@app.route('/na-apps/20__PlanVision__CoreAppCode/<path:filename>')
def core_app_files(filename):
    """Serve core app files using the production-like web root"""
    return send_from_directory(BASE_DIR, filename)


@app.route('/na-apps/01__Assets__NaApps__CommonAssets/<path:filename>')
def common_assets(filename):
    """Serve common assets (fonts, icons, graphics) from the shared assets directory"""
    assets_dir = os.path.join(REPO_ROOT, 'na-apps', '01__Assets__NaApps__CommonAssets')
    return send_from_directory(assets_dir, filename)


@app.route('/AppModules/<path:filename>')
def app_modules(filename):
    """Serve files from AppModules directory"""
    return send_from_directory(os.path.join(BASE_DIR, 'AppModules'), filename)


@app.route('/<path:filename>')
def serve_static(filename):
    """Serve any other static files from the base directory"""
    file_path = os.path.join(BASE_DIR, filename)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return send_from_directory(BASE_DIR, filename)
    return f"File not found: {filename}", 404


# -----------------------------------------------------------------------------
# HELPER FUNCTIONS
# -----------------------------------------------------------------------------

def open_browser():
    """Open the default browser to the local server URL"""
    webbrowser.open(f'http://{HOST}:{PORT}/')


def print_startup_banner():
    """Print startup information"""
    assets_dir = os.path.join(REPO_ROOT, 'na-apps', '01__Assets__NaApps__CommonAssets')
    index_exists = os.path.exists(os.path.join(BASE_DIR, INDEX_FILENAME))
    
    print("")
    print("=" * 70)
    print("  NOBLE ARCHITECTURE | PlanVision Local Development Server")
    print("=" * 70)
    print(f"  Server running at: http://{HOST}:{PORT}/")
    print(f"  Base directory:    {BASE_DIR}")
    print(f"  Project portal:    {PROJECT_PORTAL_DIR}")
    print(f"  Common assets:     {assets_dir}")
    print("")
    print("  Entry Points:")
    if index_exists:
        print(f"    - http://{HOST}:{PORT}/ (redirects via index.html)")
        print(f"    - http://{HOST}:{PORT}/index.html (redirect page)")
    else:
        print(f"    - http://{HOST}:{PORT}/ (direct to main app)")
    print(f"    - http://{HOST}:{PORT}/PlanVision__WebApp__Main__.html (main app)")
    print("")
    print("  Additional Routes:")
    print(f"    - http://{HOST}:{PORT}/na-project-portal/25-Projects/... (project files)")
    print(f"    - http://{HOST}:{PORT}/na-apps/01__Assets__NaApps__CommonAssets/... (assets)")
    print("")
    print("  Press Ctrl+C to stop the server")
    print("=" * 70)
    print("")


# -----------------------------------------------------------------------------
# MAIN ENTRY POINT
# -----------------------------------------------------------------------------

if __name__ == '__main__':
    print_startup_banner()
    
    # Auto-open browser after a short delay
    if AUTO_OPEN_BROWSER:
        threading.Timer(1.0, open_browser).start()
    
    # Start the Flask development server
    app.run(
        host=HOST,
        port=PORT,
        debug=True,
        use_reloader=True  # Auto-reload on file changes
    )

