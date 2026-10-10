#!/usr/bin/env python3
# =============================================================================
# NOBLE ARCHITECTURE - PROJECT ADMIN EDITOR TOOLS API (FLASK BLUEPRINT)
# =============================================================================
#
# FILE       : ProjectVision__ProjectAdminEditors__Api__.py
# MODULE     : ProjectAdminEditorsApi
# AUTHOR     : Adam Noble - Noble Architecture
# PURPOSE    : The file routes behind Project Admin's Editor Tools, registered by both local servers
# CREATED    : 10-Oct-2026
#
# DESCRIPTION:
# - WHAT THE EDITORS NEED. Project Admin's Editor Tools (Project Config, Quotation,
#   Invoice and Contract Managers, the Terms Editor and the Project Manager) live in
#   10__NaProjectAdmin__DocumentSystem__CoreAppCode/04__EditorTools. A browser cannot
#   write a file, so they load and save the JSON in a project's
#   10__ProjectAdmin__AppContent folder through these routes.
# - ONE COPY, TWO SERVERS. The routes were written into the Project Admin dev server
#   (start_local_server.py, port 8081) and existed nowhere else, so Project Admin
#   opened in the Noble Architecture Studio (ProjectVision__LocalServer__Main__.py,
#   port 8090, the server that starts with Windows) could only show what a client
#   sees. Both servers now register this blueprint.
# - THE APP ASKS FOR THE CAPABILITY, NOT THE SERVER. Every server that registers this
#   blueprint lists EDITOR_TOOLS_CAPABILITY under "capabilities" in its /api/health
#   answer, and the app's menu (UserInterface__Navigation__.js) and the editors
#   (Editor__SharedUtils__.js) show and enable the Editor Tools wherever it is listed.
#   A server process started before this file existed does not list it, so the app
#   keeps the client's view there instead of offering editors that could not save.
# - MOVED, NOT REWRITTEN. The routes are start_local_server.py's code as it stood at
#   its Version 2.1.0, unchanged. A save is written exactly as before - json.dumps
#   with a four-space indent and a trailing newline, in text mode, so CRLF on
#   Windows - and a file saved in the Studio is byte-identical to one saved on 8081.
# - LOCALHOST ONLY. Both servers bind 127.0.0.1. The public website has no server,
#   so these routes do not exist there and Project Admin is read-only.
#
# ROUTES:
#   GET    /api/project/<year>/<code>/files          { success, files : [{ name, size, modified }] }
#   GET    /api/project/<year>/<code>/<filename>     { success, data | content, isJson }
#   PUT    /api/project/<year>/<code>/<filename>     Write the JSON body to that file
#   POST   /api/project/create                       Scaffold a new project folder and index it
#   DELETE /api/project/<year>/<code>                Delete a project folder, found by its code
#   DELETE /api/project-folder/<year>/<folder>       Delete a project folder, by its exact name
#   GET    /api/projects/scan                        Every project under na-project-portal
#   PUT    /api/config/project-index                 Replace AppConfiguration__ProjectKeysIndex__.json
#
# -----
#
# DEVELOPMENT LOG:
# 10-Oct-2026 - Version 1.0.0
# - Moved out of start_local_server.py unchanged, into a blueprint both local
#   servers register, with EDITOR_TOOLS_CAPABILITY for their /api/health
#   (Admin & Doc System 0.7.7, Project Vision 0.5.0).
#
# =============================================================================


# #region ---------------------------------------------------------------------
# REGION | Imports
# -----------------------------------------------------------------------------

import os
import re
import json
import shutil

from datetime import datetime

from flask import Blueprint, current_app, jsonify, request

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Configuration
# -----------------------------------------------------------------------------

SCRIPT_DIR               = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT                = os.path.abspath(os.path.join(SCRIPT_DIR, '..'))   # <-- na-apps sits at the repository root

EDITOR_TOOLS_CAPABILITY  = 'projectadmin-editor-tools'               # <-- Each server lists this in /api/health; the app looks for it
DEFAULT_YEAR_CONFIG_KEY  = 'NA_PROJECTADMIN_DEFAULT_YEAR'            # <-- app.config: the server's --year
DEFAULT_YEAR_FALLBACK    = '26'                                      # <-- Both servers' --year default

project_admin_editors_api = Blueprint('project_admin_editors_api', __name__)


def get_default_year():
    """The year a project created without one goes into: the server's --year."""
    return current_app.config.get(DEFAULT_YEAR_CONFIG_KEY) or DEFAULT_YEAR_FALLBACK

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Project API Endpoints
# -----------------------------------------------------------------------------

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


@project_admin_editors_api.route('/api/project/<year>/<code>/files')
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


@project_admin_editors_api.route('/api/project/<year>/<code>/<filename>', methods=['GET', 'PUT'])
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


@project_admin_editors_api.route('/api/project/create', methods=['POST'])
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
        year         = data.get('year', get_default_year())
        
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
        
        # Create empty invoices file
        invoices_data = {
            'invoices'   : []
        }
        
        invoices_path = os.path.join(project_path, '10__ProjectAdmin__AppContent',
                                     'ProjectAdmin__Invoices__.json')
        with open(invoices_path, 'w', encoding='utf-8') as f:
            json.dump(invoices_data, f, indent=4)
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


@project_admin_editors_api.route('/api/project/<year>/<code>', methods=['DELETE'])
def delete_project(year, code):
    """Delete a project folder from local disk."""
    project_path = get_project_path(year, code)

    if not project_path:
        return jsonify({
            'success'    : False,
            'error'      : f'Project {code} not found for year {year}'
        }), 404

    portal_path = get_project_portal_path()
    project_path_abs = os.path.abspath(project_path)
    portal_path_abs = os.path.abspath(portal_path)

    if not project_path_abs.startswith(portal_path_abs):
        return jsonify({
            'success'    : False,
            'error'      : 'Refusing to delete outside project portal'
        }), 400

    try:
        shutil.rmtree(project_path_abs)
        return jsonify({
            'success'    : True,
            'projectCode': code.upper(),
            'year'       : year,
            'path'       : project_path_abs,
            'message'    : 'Project folder deleted'
        })
    except Exception as e:
        return jsonify({
            'success'    : False,
            'error'      : str(e)
        }), 500


@project_admin_editors_api.route('/api/project-folder/<year>/<folder>', methods=['DELETE'])
def delete_project_by_folder(year, folder):
    """Delete a project folder by exact folder name (local disk)."""
    if '..' in folder or '/' in folder or '\\' in folder:
        return jsonify({
            'success'    : False,
            'error'      : 'Invalid folder name'
        }), 400

    portal_path = get_project_portal_path()
    year_folder = f"{year}-Projects"
    project_path = os.path.join(portal_path, year_folder, folder)

    if not os.path.exists(project_path):
        return jsonify({
            'success'    : False,
            'error'      : f'Project folder not found: {folder}'
        }), 404

    project_path_abs = os.path.abspath(project_path)
    portal_path_abs = os.path.abspath(portal_path)

    if not project_path_abs.startswith(portal_path_abs):
        return jsonify({
            'success'    : False,
            'error'      : 'Refusing to delete outside project portal'
        }), 400

    try:
        shutil.rmtree(project_path_abs)
        return jsonify({
            'success'    : True,
            'folder'     : folder,
            'year'       : year,
            'path'       : project_path_abs,
            'message'    : 'Project folder deleted'
        })
    except Exception as e:
        return jsonify({
            'success'    : False,
            'error'      : str(e)
        }), 500


@project_admin_editors_api.route('/api/projects/scan')
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


@project_admin_editors_api.route('/api/config/project-index', methods=['PUT'])
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

# endregion -------------------------------------------------------------------
