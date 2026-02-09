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

# -----------------------------------------------------------------------------
# FLASK APP SETUP
# -----------------------------------------------------------------------------
app = Flask(__name__, static_folder=BASE_DIR)
CORS(app)  # Enable CORS for all routes (mimics CDN behavior)

# -----------------------------------------------------------------------------
# ROUTES
# -----------------------------------------------------------------------------

@app.route('/')
def index():
    """Serve the main PlanVision WebApp"""
    return send_file(os.path.join(BASE_DIR, 'JH03__PlanVision__WebApp.html'))


@app.route('/JH03__PlanVision__WebApp.html')
@app.route('/JH03__PlanVision__WebApp')
def planvision():
    """Serve PlanVision WebApp (multiple URL patterns)"""
    return send_file(os.path.join(BASE_DIR, 'JH03__PlanVision__WebApp.html'))


@app.route('/JH03_-_DATA_-_Document-Library.json')
def document_library():
    """Serve the JSON document library"""
    return send_file(
        os.path.join(BASE_DIR, 'JH03_-_DATA_-_Document-Library.json'),
        mimetype='application/json'
    )


@app.route('/AppModules/<path:filename>')
def app_modules(filename):
    """Serve files from AppModules directory"""
    return send_from_directory(os.path.join(BASE_DIR, 'AppModules'), filename)


@app.route('/DesignPhase01/<path:filename>')
def design_phase_01(filename):
    """Serve files from DesignPhase01 directory"""
    return send_from_directory(os.path.join(BASE_DIR, 'DesignPhase01'), filename)


@app.route('/DesignPhase02/<path:filename>')
def design_phase_02(filename):
    """Serve files from DesignPhase02 directory"""
    return send_from_directory(os.path.join(BASE_DIR, 'DesignPhase02'), filename)


@app.route('/DesignPhase03/<path:filename>')
def design_phase_03(filename):
    """Serve files from DesignPhase03 directory"""
    return send_from_directory(os.path.join(BASE_DIR, 'DesignPhase03'), filename)


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
    print("")
    print("=" * 70)
    print("  NOBLE ARCHITECTURE | PlanVision Local Development Server")
    print("=" * 70)
    print(f"  Server running at: http://{HOST}:{PORT}/")
    print(f"  Base directory:    {BASE_DIR}")
    print("")
    print("  Available routes:")
    print(f"    - http://{HOST}:{PORT}/")
    print(f"    - http://{HOST}:{PORT}/JH03__PlanVision__WebApp.html")
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

