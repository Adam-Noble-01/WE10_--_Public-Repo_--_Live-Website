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
# - Provides API endpoints for editor tools integration
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
# 31-Jan-2026 - Version 2.0.0
# - Added Editor Tools API endpoints
#   - /api/project/<year>/<code>/files - List project files
#   - /api/project/<year>/<code>/<filename> - Read/write project files
#   - /api/project/create - Create new project with full structure
#   - /api/projects/scan - Scan for all projects
#   - /api/config/project-index - Update project index
#
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
import json
import re
from datetime import datetime

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

# endregion -----


# #region -----
# REGION | Project API Endpoints
# -----

def get_project_portal_path():
    """Get the path to na-project-portal directory."""
    return os.path.join(REPO_ROOT, 'na-project-portal')


def get_project_path(year, code):
    """Get the path to a specific project folder."""
    portal_path = get_project_portal_path()
    year_folder = f"{year}-Projects"
    
    # First check if we have an index mapping
    index_path = os.path.join(
        REPO_ROOT, 
        'na-apps', 
        '10__NaProjectAdmin__DocumentSystem__CoreAppCode',
        '03__Src__AppModules',
        '02__AppData',
        'AppConfiguration__ProjectKeysIndex__.json'
    )
    
    folder_name = None
    if os.path.exists(index_path):
        try:
            with open(index_path, 'r', encoding='utf-8') as f:
                index = json.load(f)
                folder_name = index.get(year, {}).get(code.upper())
        except Exception:
            pass
    
    if folder_name:
        project_path = os.path.join(portal_path, year_folder, folder_name)
        if os.path.exists(project_path):
            return project_path
    
    # Fallback: scan year folder for matching project
    year_path = os.path.join(portal_path, year_folder)
    if os.path.exists(year_path):
        for folder in os.listdir(year_path):
            if folder.upper().startswith(code.upper()):
                return os.path.join(year_path, folder)
    
    return None


def get_admin_content_path(year, code):
    """Get the path to a project's 10__ProjectAdmin__AppContent folder."""
    project_path = get_project_path(year, code)
    if project_path:
        admin_path = os.path.join(project_path, '10__ProjectAdmin__AppContent')
        if os.path.exists(admin_path):
            return admin_path
    return None


@app.route('/api/project/<year>/<code>/files')
def list_project_files(year, code):
    """List all files in a project's admin content folder."""
    admin_path = get_admin_content_path(year, code)
    
    if not admin_path:
        return jsonify({
            'success'    : False,
            'error'      : f'Project {code} not found for year {year}'
        }), 404
    
    try:
        files = []
        for filename in os.listdir(admin_path):
            filepath = os.path.join(admin_path, filename)
            if os.path.isfile(filepath):
                stat = os.stat(filepath)
                files.append({
                    'name'       : filename,
                    'size'       : stat.st_size,
                    'modified'   : datetime.fromtimestamp(stat.st_mtime).isoformat()
                })
        
        return jsonify({
            'success'    : True,
            'projectCode': code.upper(),
            'year'       : year,
            'path'       : admin_path,
            'files'      : files
        })
    except Exception as e:
        return jsonify({
            'success'    : False,
            'error'      : str(e)
        }), 500


@app.route('/api/project/<year>/<code>/<filename>', methods=['GET', 'PUT'])
def project_file(year, code, filename):
    """Read or write a specific project file."""
    admin_path = get_admin_content_path(year, code)
    
    # For PUT requests, create path if it doesn't exist
    if request.method == 'PUT' and not admin_path:
        project_path = get_project_path(year, code)
        if project_path:
            admin_path = os.path.join(project_path, '10__ProjectAdmin__AppContent')
            os.makedirs(admin_path, exist_ok=True)
    
    if not admin_path:
        return jsonify({
            'success'    : False,
            'error'      : f'Project {code} not found for year {year}'
        }), 404
    
    filepath = os.path.join(admin_path, filename)
    
    # Validate filename (prevent directory traversal)
    if '..' in filename or '/' in filename or '\\' in filename:
        return jsonify({
            'success'    : False,
            'error'      : 'Invalid filename'
        }), 400
    
    if request.method == 'GET':
        # Read file
        if not os.path.exists(filepath):
            return jsonify({
                'success'    : False,
                'error'      : f'File {filename} not found'
            }), 404
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Try to parse as JSON
            try:
                data = json.loads(content)
                return jsonify({
                    'success'    : True,
                    'filename'   : filename,
                    'path'       : filepath,
                    'data'       : data,
                    'isJson'     : True
                })
            except json.JSONDecodeError:
                return jsonify({
                    'success'    : True,
                    'filename'   : filename,
                    'path'       : filepath,
                    'content'    : content,
                    'isJson'     : False
                })
        except Exception as e:
            return jsonify({
                'success'    : False,
                'error'      : str(e)
            }), 500
    
    else:  # PUT
        # Write file
        try:
            data = request.get_json()
            
            if data is None:
                return jsonify({
                    'success'    : False,
                    'error'      : 'No JSON data provided'
                }), 400
            
            # Format JSON with indentation
            content = json.dumps(data, indent=4, ensure_ascii=False)
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
                f.write('\n')  # <-- Add trailing newline
            
            return jsonify({
                'success'    : True,
                'filename'   : filename,
                'path'       : filepath,
                'message'    : f'File {filename} saved successfully'
            })
        except Exception as e:
            return jsonify({
                'success'    : False,
                'error'      : str(e)
            }), 500


@app.route('/api/project/create', methods=['POST'])
def create_project():
    """Create a new project with full folder structure."""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success'    : False,
                'error'      : 'No JSON data provided'
            }), 400
        
        # Extract required fields
        code         = data.get('projectCode', '').upper()
        project_name = data.get('projectName', '')
        client_name  = data.get('clientName', '')
        year         = data.get('year', DEFAULT_YEAR)
        
        # Validate project code format (XX00)
        if not re.match(r'^[A-Z]{2}\d{2}$', code):
            return jsonify({
                'success'    : False,
                'error'      : 'Invalid project code format. Must be 2 letters + 2 digits (e.g., JS01)'
            }), 400
        
        if not project_name:
            return jsonify({
                'success'    : False,
                'error'      : 'Project name is required'
            }), 400
        
        # Create folder name
        folder_name = f"{code}__{project_name.replace(' ', '')}"
        
        # Check if project already exists
        portal_path = get_project_portal_path()
        year_folder = f"{year}-Projects"
        year_path = os.path.join(portal_path, year_folder)
        project_path = os.path.join(year_path, folder_name)
        
        if os.path.exists(project_path):
            return jsonify({
                'success'    : False,
                'error'      : f'Project {code} already exists at {project_path}'
            }), 409
        
        # Create year folder if needed
        os.makedirs(year_path, exist_ok=True)
        
        # Create folder structure
        folders_to_create = [
            '01__Archive',
            '10__ProjectAdmin__AppContent',
            '20__PlanVision__AppContent',
            '30__TrueVision__AppContent'
        ]
        
        for folder in folders_to_create:
            os.makedirs(os.path.join(project_path, folder), exist_ok=True)
        
        # Create placeholder files
        placeholders = {
            '01__Archive/OldVersion__FilesHere__.txt': 
                'This folder contains archived/old versions of project files.',
            '20__PlanVision__AppContent/PlanVisionContent__FilesHere__.txt': 
                'This folder contains PlanVision application content.',
            '30__TrueVision__AppContent/TrueVisionContent__FilesHere__.txt': 
                'This folder contains TrueVision application content.'
        }
        
        for rel_path, content in placeholders.items():
            filepath = os.path.join(project_path, rel_path)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
        
        # Create project config JSON
        now_uk = datetime.now().strftime('%d-%b-%Y')
        now_uk_time = datetime.now().strftime('%d-%b-%Y at %H:%M')
        
        # NOTE: PII (address, email, phone) stored in encrypted R2, not here
        project_config = {
            'projectCode'    : code,
            'projectName'    : project_name,
            'clientName'     : client_name or 'Client Name',
            'projectPin'     : '1234',
            'contracts'      : {                                         # <-- Multi-contract system v0.5.0
                'general-business': {
                    'enabled'        : True,
                    'signed'         : False,
                    'signatureRef'   : None,
                    'signedDate'     : None,
                    'specialTermsFile': None
                },
                'concept-design': {
                    'enabled'        : True,
                    'signed'         : False,
                    'signatureRef'   : None,
                    'signedDate'     : None,
                    'specialTermsFile': None
                }
            },
            'documents'      : {
                'quotation'      : True
            },
            'clientDataId'   : f'{code}_{year}',                         # <-- Reference to R2 encrypted data
            'createdDate'    : now_uk,
            'lastModified'   : now_uk_time
        }
        
        config_path = os.path.join(project_path, '10__ProjectAdmin__AppContent', 
                                   'ProjectAdmin__ProjectConfig__.json')
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(project_config, f, indent=4)
            f.write('\n')
        
        # Create quotation template
        # NOTE: Client address/email/phone stored in encrypted R2, not here
        quotation = {
            'quotationRef'       : f'QUO-{code}-{datetime.now().year}-001',
            'quotationDate'      : now_uk,
            'projectAddress'     : '',                                   # <-- Site address from R2
            'projectDescription' : 'Project description goes here',
            'clientDetails'      : {
                'name'           : client_name or 'Client Name'
                # Address, email, phone fetched from R2 at render time
            },
            'lineItems'          : [
                {
                    'description': 'Initial design consultation',
                    'quantity'   : 1,
                    'unit'       : 'item',
                    'rate'       : 0,
                    'group'      : 'Design Phase'
                }
            ],
            'totals'             : {
                'subtotal'       : 0,
                'vatRate'        : 0,
                'vat'            : 0,
                'grandTotal'     : 0
            },
            'additionalTerms'    : '',
            'createdDate'        : now_uk_time
        }
        
        quotation_path = os.path.join(project_path, '10__ProjectAdmin__AppContent',
                                      'ProjectAdmin__Quotation__.json')
        with open(quotation_path, 'w', encoding='utf-8') as f:
            json.dump(quotation, f, indent=4)
            f.write('\n')
        
        # Create special terms template
        special_terms = {
            'sectionTitle'   : 'Special Terms for This Project',
            'introduction'   : 'The following special conditions apply to this project.',
            'terms'          : [
                {
                    'title'      : 'Payment Schedule',
                    'content'    : 'Payment terms to be agreed.'
                }
            ],
            'lastUpdated'    : now_uk_time
        }
        
        terms_path = os.path.join(project_path, '10__ProjectAdmin__AppContent',
                                  'ProjectAdmin__SpecialTerms__.json')
        with open(terms_path, 'w', encoding='utf-8') as f:
            json.dump(special_terms, f, indent=4)
            f.write('\n')
        
        # Update project index
        index_path = os.path.join(
            REPO_ROOT,
            'na-apps',
            '10__NaProjectAdmin__DocumentSystem__CoreAppCode',
            '03__Src__AppModules',
            '02__AppData',
            'AppConfiguration__ProjectKeysIndex__.json'
        )
        
        try:
            if os.path.exists(index_path):
                with open(index_path, 'r', encoding='utf-8') as f:
                    index = json.load(f)
            else:
                index = {}
            
            if year not in index:
                index[year] = {}
            
            index[year][code] = folder_name
            
            with open(index_path, 'w', encoding='utf-8') as f:
                json.dump(index, f, indent=4)
                f.write('\n')
        except Exception as e:
            print(f"Warning: Could not update project index: {e}")
        
        return jsonify({
            'success'        : True,
            'projectCode'    : code,
            'projectName'    : project_name,
            'folderName'     : folder_name,
            'path'           : project_path,
            'message'        : f'Project {code} created successfully'
        })
        
    except Exception as e:
        return jsonify({
            'success'    : False,
            'error'      : str(e)
        }), 500


@app.route('/api/projects/scan')
def scan_projects():
    """Scan na-project-portal for all projects."""
    portal_path = get_project_portal_path()
    
    if not os.path.exists(portal_path):
        return jsonify({
            'success'    : False,
            'error'      : f'Project portal not found at {portal_path}'
        }), 404
    
    try:
        projects = {}
        
        # Iterate through year folders
        for year_folder in os.listdir(portal_path):
            year_match = re.match(r'^(\d{2})-Projects$', year_folder)
            if not year_match:
                continue
            
            year = year_match.group(1)
            year_path = os.path.join(portal_path, year_folder)
            
            if not os.path.isdir(year_path):
                continue
            
            projects[year] = {}
            
            # Iterate through project folders
            for project_folder in os.listdir(year_path):
                project_path = os.path.join(year_path, project_folder)
                
                if not os.path.isdir(project_path):
                    continue
                
                # Try to find project config
                config_path = os.path.join(
                    project_path, 
                    '10__ProjectAdmin__AppContent',
                    'ProjectAdmin__ProjectConfig__.json'
                )
                
                project_data = {
                    'folder'     : project_folder,
                    'clientName' : 'Unknown'
                }
                
                if os.path.exists(config_path):
                    try:
                        with open(config_path, 'r', encoding='utf-8') as f:
                            config = json.load(f)
                        project_data['clientName'] = config.get('clientName', 'Unknown')
                        project_data['projectName'] = config.get('projectName', '')
                        code = config.get('projectCode', '').upper()
                        
                        if code:
                            projects[year][code] = project_data
                    except Exception:
                        # Extract code from folder name
                        code_match = re.match(r'^([A-Z]{2}\d{2})', project_folder.upper())
                        if code_match:
                            projects[year][code_match.group(1)] = project_data
                else:
                    # Extract code from folder name
                    code_match = re.match(r'^([A-Z]{2}\d{2})', project_folder.upper())
                    if code_match:
                        projects[year][code_match.group(1)] = project_data
        
        return jsonify({
            'success'    : True,
            'portalPath' : portal_path,
            'projects'   : projects
        })
        
    except Exception as e:
        return jsonify({
            'success'    : False,
            'error'      : str(e)
        }), 500


@app.route('/api/config/project-index', methods=['PUT'])
def update_project_index():
    """Update the ProjectKeysIndex.json file."""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success'    : False,
                'error'      : 'No JSON data provided'
            }), 400
        
        index_path = os.path.join(
            REPO_ROOT,
            'na-apps',
            '10__NaProjectAdmin__DocumentSystem__CoreAppCode',
            '03__Src__AppModules',
            '02__AppData',
            'AppConfiguration__ProjectKeysIndex__.json'
        )
        
        with open(index_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4)
            f.write('\n')
        
        return jsonify({
            'success'    : True,
            'path'       : index_path,
            'message'    : 'Project index updated successfully'
        })
        
    except Exception as e:
        return jsonify({
            'success'    : False,
            'error'      : str(e)
        }), 500

# endregion -----


# #region -----
# REGION | Static File Serving
# -----

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
    print(f"    - Contract Manager: {base_url}04__EditorTools/Editor__ContractManager__.html")
    print(f"    - Terms Editor: {base_url}04__EditorTools/Editor__TermsEditor__.html")
    
    print("\n  API Endpoints (Local):")
    print(f"    - Health: http://localhost:{PORT}/api/health")
    print(f"    - Config: http://localhost:{PORT}/api/config")
    print(f"    - Project Files: http://localhost:{PORT}/api/project/<year>/<code>/files")
    print(f"    - Project File: http://localhost:{PORT}/api/project/<year>/<code>/<filename>")
    print(f"    - Create Project: http://localhost:{PORT}/api/project/create (POST)")
    print(f"    - Scan Projects: http://localhost:{PORT}/api/projects/scan")
    print(f"    - Update Index: http://localhost:{PORT}/api/config/project-index (PUT)")
    
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
