#!/usr/bin/env python3
# =============================================================================
# NOBLE ARCHITECTURE - PROJECT MANAGER API (FLASK BLUEPRINT)
# =============================================================================
#
# FILE       : ProjectVision__ProjectManager__Api__.py
# MODULE     : ProjectManagerApi
# AUTHOR     : Adam Noble - Noble Architecture
# PURPOSE    : Multi-project admin endpoints for the Studio Project Manager tab
# CREATED    : 19-Sep-2026
#
# DESCRIPTION:
# - Backs the Project Manager table: list, edit, rename and delete projects,
#   keeping the local folder, the master project index and the Cloudflare R2
#   bucket in step with one another.
# - Registered by ProjectVision__LocalServer__Main__.py. Localhost only; the
#   public website has no such server and cannot reach any of this.
#
# DESTRUCTIVE OPERATIONS:
# - Every mutating call requires a `confirm` field holding the project code,
#   typed by the operator. A call without it is refused, so nothing here can
#   fire from a stray fetch or a mis-click.
# - "Delete local" never unlinks anything. It moves the project folder into
#   na-project-portal/00__Deleted__Quarantine/, which is outside the year-folder
#   pattern the launcher scans, so the project leaves the gallery but the files
#   remain on disk until the folder is emptied by hand.
# - "Delete R2" does delete, because an object store has no quarantine. It is
#   always preceded by a listing of exactly what will go.
#
# SOURCE OF TRUTH:
# - ProjectAdmin__ProjectConfig__.json is authoritative for projectName and
#   projectCode. The PlanVision and TrueVision project data files are generated
#   from it by the build script, so they are never written here - a rebuild
#   would overwrite anything this module put in them.
# - Address and description live per quotation, so they are written to every
#   quotation entry in whichever of the two quotation file names exists.
#
# -----
#
# DEVELOPMENT LOG:
# 19-Sep-2026 - Version 1.0.0
# - Initial implementation
#
# =============================================================================


# #region ---------------------------------------------------------------------
# REGION | Imports
# -----------------------------------------------------------------------------

import os
import re
import sys
import json
import shutil
import traceback

from datetime import datetime

from flask import Blueprint, jsonify, request

import ProjectVision__DevLauncher__Shared__ as dev_launcher

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Configuration
# -----------------------------------------------------------------------------

SCRIPT_DIR              = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT               = os.path.abspath(os.path.join(SCRIPT_DIR, '..'))
PORTAL_ROOT             = os.path.join(REPO_ROOT, 'na-project-portal')
CORE_APP_DIR            = os.path.join(SCRIPT_DIR, '05__ProjectVision__CoreAppCode')

QUARANTINE_DIR_NAME     = '00__Deleted__Quarantine'
PROJECT_CODE_PATTERN    = re.compile(r'^[A-Z]{2}[0-9]{2}$')
PROJECT_FOLDER_PATTERN  = re.compile(r'^[A-Za-z0-9_\-]{3,120}$')
YEAR_PATTERN            = re.compile(r'^[0-9]{2}$')

ADMIN_CONTENT_DIR       = dev_launcher.PROJECT_ADMIN_CONTENT_DIR
ADMIN_CONFIG_FILE       = dev_launcher.PROJECT_ADMIN_CONFIG_FILE
QUOTE_FILE_NAMES        = ('ProjectAdmin__Quotation__.json', 'ProjectAdmin__Quotations__.json')

MASTER_INDEX_PATH       = os.path.join(SCRIPT_DIR, dev_launcher.MASTER_INDEX_RELPATH)

R2_BASE_PREFIX          = 'NaProjectPortal'

project_manager_api     = Blueprint('project_manager_api', __name__)

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Cloudflare R2 Access
# -----------------------------------------------------------------------------
#
# The sync script owns the credentials and the client. It is imported rather
# than reimplemented so there is one definition of the bucket and the prefix.
#
# -----------------------------------------------------------------------------

def _load_r2_module():
    """Import the R2 sync script, or return None when it cannot be loaded."""
    if CORE_APP_DIR not in sys.path:
        sys.path.insert(0, CORE_APP_DIR)

    try:
        import CloudflareR2__ModelSync__Main__ as r2_sync
        return r2_sync
    except Exception:
        traceback.print_exc()
        return None


def _get_r2_client():
    """
    Build an R2 client. Returns (client, bucket_name, error_message).
    A missing .env or missing boto3 is reported, never raised, so the Project
    Manager still lists and edits projects with the R2 actions disabled.
    """
    r2_sync = _load_r2_module()
    if not r2_sync:
        return None, None, 'The Cloudflare R2 sync module could not be imported.'

    try:
        ok, credentials = r2_sync.load_r2_credentials()
    except Exception as error:
        return None, None, f'Reading R2 credentials failed: {type(error).__name__}: {error}'

    if not ok:
        return None, None, 'R2 credentials are missing or still placeholders.'

    client = r2_sync.create_r2_client(credentials)
    if not client:
        return None, None, 'The R2 client could not be created.'

    return client, credentials['bucket_name'], None


def _r2_project_prefix(project_year, project_folder):
    """The R2 prefix holding everything for one project."""
    return f"{R2_BASE_PREFIX}/{project_year}-Projects/{project_folder}/"


def _r2_list_prefix(client, bucket_name, prefix):
    """Every object key under a prefix, with its size."""
    objects      = []
    continuation = None

    while True:
        list_kwargs = {'Bucket': bucket_name, 'Prefix': prefix, 'MaxKeys': 1000}
        if continuation:
            list_kwargs['ContinuationToken'] = continuation

        response = client.list_objects_v2(**list_kwargs)

        for entry in response.get('Contents', []):
            objects.append({'key': entry['Key'], 'size': entry.get('Size', 0)})

        if response.get('IsTruncated'):
            continuation = response['NextContinuationToken']
        else:
            break

    return objects

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Safety Helpers
# -----------------------------------------------------------------------------

def _is_inside(candidate_path, parent_path):
    """True when candidate_path sits inside parent_path. Blocks traversal."""
    candidate = os.path.realpath(candidate_path)
    parent    = os.path.realpath(parent_path)
    return candidate == parent or candidate.startswith(parent + os.sep)


def _project_dir(project_year, project_folder):
    """Absolute path to a project folder, or None when it escapes the portal."""
    if not project_year or not project_folder:
        return None

    candidate = os.path.join(PORTAL_ROOT, f"{project_year}-Projects", project_folder)
    return candidate if _is_inside(candidate, PORTAL_ROOT) else None


def _find_project(project_code):
    """Locate one project in the merged launcher payload."""
    code    = (project_code or '').strip().upper()
    payload = dev_launcher.collect_dev_projects(REPO_ROOT)

    for entry in payload['projects']:
        if entry['projectCode'] == code:
            return entry

    return None


def _require_confirmation(body, project_code):
    """
    Every mutating call must carry the project code, typed by the operator.
    Returns an error string, or None when the call may proceed.
    """
    supplied = str((body or {}).get('confirm') or '').strip().upper()

    if not supplied:
        return 'This operation requires a typed confirmation.'

    if supplied != project_code.upper():
        return f'The typed confirmation "{supplied}" does not match "{project_code}".'

    return None


def _folder_stats(directory_path):
    """File count and total bytes for a folder tree."""
    file_count = 0
    total_size = 0

    if not directory_path or not os.path.isdir(directory_path):
        return {'files': 0, 'bytes': 0, 'exists': False}

    for root, _dirs, files in os.walk(directory_path):
        for filename in files:
            file_count += 1
            try:
                total_size += os.path.getsize(os.path.join(root, filename))
            except OSError:
                pass

    return {'files': file_count, 'bytes': total_size, 'exists': True}

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | JSON File Helpers
# -----------------------------------------------------------------------------

def _read_json(file_path):
    """Read a JSON file, returning None when missing or unreadable."""
    if not os.path.isfile(file_path):
        return None

    try:
        with open(file_path, 'r', encoding='utf-8-sig') as handle:
            return json.load(handle)
    except (OSError, json.JSONDecodeError):
        return None


def _detect_newline(file_path):
    """
    The line ending a file already uses. Two writers are at work in this system:
    the build script pins LF, while the Project Admin app writes CRLF. Rewriting
    a file in the other style changes every line of it in git, so whatever is
    there is kept. New files get LF, matching the build script.
    """
    try:
        with open(file_path, 'rb') as handle:
            sample = handle.read(65536)
    except OSError:
        return '\n'

    return '\r\n' if b'\r\n' in sample else '\n'


def _write_json(file_path, payload):
    """Write JSON back with the indentation and line endings the file already uses."""
    newline = _detect_newline(file_path)

    with open(file_path, 'w', encoding='utf-8', newline=newline) as handle:
        json.dump(payload, handle, indent=4, ensure_ascii=False)
        handle.write('\n')


def _stamp_modified(config_data):
    """Match the timestamp shape the Project Admin app writes."""
    config_data['lastModified'] = datetime.now().strftime('%d-%b-%Y at %H:%M')

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Field Writers
# -----------------------------------------------------------------------------

def _apply_admin_config_fields(project_dir, fields, changes):
    """Write projectName, projectCode, projectPin and description to the config."""
    config_path = os.path.join(project_dir, ADMIN_CONTENT_DIR, ADMIN_CONFIG_FILE)
    config_data = _read_json(config_path)

    if not isinstance(config_data, dict):
        return                                                   # <-- No Project Admin content to write to

    touched = False

    for key in ('projectName', 'projectCode', 'projectPin', 'projectDescription'):
        if key not in fields:
            continue

        new_value = fields[key]
        if config_data.get(key) == new_value:
            continue

        changes.append({
            'file'  : os.path.relpath(config_path, REPO_ROOT).replace('\\', '/'),
            'field' : key,
            'from'  : config_data.get(key),
            'to'    : new_value
        })
        config_data[key] = new_value
        touched = True

    if touched:
        _stamp_modified(config_data)
        _write_json(config_path, config_data)


def _apply_quotation_fields(project_dir, fields, changes):
    """
    Address and description live per quotation. Both quotation file names are in
    use across the portal, so whichever exists is written, and every quotation
    entry inside it gets the same value - they all describe one project.
    """
    address     = fields.get('address')
    description = fields.get('projectDescription')

    if address is None and description is None:
        return

    for filename in QUOTE_FILE_NAMES:
        quote_path = os.path.join(project_dir, ADMIN_CONTENT_DIR, filename)
        quote_data = _read_json(quote_path)

        if not isinstance(quote_data, dict):
            continue

        entries = quote_data['quotations'] if isinstance(quote_data.get('quotations'), list) else [quote_data]
        touched = False

        for entry in entries:
            if not isinstance(entry, dict):
                continue

            for key, new_value in (('projectAddress', address), ('projectDescription', description)):
                if new_value is None or entry.get(key) == new_value:
                    continue

                changes.append({
                    'file'  : os.path.relpath(quote_path, REPO_ROOT).replace('\\', '/'),
                    'field' : key,
                    'from'  : entry.get(key),
                    'to'    : new_value
                })
                entry[key] = new_value
                touched = True

        if touched:
            _write_json(quote_path, quote_data)

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Master Index Maintenance
# -----------------------------------------------------------------------------

def _update_master_index(old_code, new_entry):
    """
    Rewrite one project's entry in the master index so the gallery agrees with
    disk immediately. Passing new_entry as None removes the project.
    The build script remains the authority and will agree on its next run.
    """
    index_data = _read_json(MASTER_INDEX_PATH)

    if not isinstance(index_data, dict) or not isinstance(index_data.get('projects'), dict):
        return False

    projects = index_data['projects']
    existing = projects.pop(old_code, None)

    if new_entry is not None:
        merged = dict(existing) if isinstance(existing, dict) else {}
        merged.update(new_entry)
        projects[merged['projectCode']] = merged

    _write_json(MASTER_INDEX_PATH, index_data)
    return True

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Route | Project Listing
# -----------------------------------------------------------------------------

@project_manager_api.route('/api/manager/projects')
def manager_projects():
    """Every project, with local footprint, for the Project Manager table."""
    try:
        payload = dev_launcher.collect_dev_projects(REPO_ROOT)
    except Exception as error:
        traceback.print_exc()
        return jsonify({'error': f'{type(error).__name__}: {error}'}), 500

    for entry in payload['projects']:
        directory = _project_dir(entry['projectYear'], entry['projectFolder'])
        entry['local'] = _folder_stats(directory)

    payload['quarantine'] = _list_quarantine()

    response = jsonify(payload)
    response.headers['Cache-Control'] = 'no-store'
    return response


def _list_quarantine():
    """Folders previously moved aside by a local delete."""
    quarantine_root = os.path.join(PORTAL_ROOT, QUARANTINE_DIR_NAME)

    if not os.path.isdir(quarantine_root):
        return []

    entries = []
    for name in sorted(os.listdir(quarantine_root), reverse=True):
        full_path = os.path.join(quarantine_root, name)
        if not os.path.isdir(full_path):
            continue
        stats = _folder_stats(full_path)
        entries.append({'name': name, 'files': stats['files'], 'bytes': stats['bytes']})

    return entries


@project_manager_api.route('/api/manager/r2/summary')
def manager_r2_summary():
    """One R2 listing, bucketed by project folder, for the R2 column."""
    client, bucket_name, error = _get_r2_client()

    if error:
        return jsonify({'available': False, 'reason': error, 'byProject': {}})

    try:
        objects = _r2_list_prefix(client, bucket_name, R2_BASE_PREFIX + '/')
    except Exception as error:
        traceback.print_exc()
        return jsonify({'available': False, 'reason': f'{type(error).__name__}: {error}', 'byProject': {}})

    by_project = {}

    for entry in objects:
        # Key shape: NaProjectPortal/<year>-Projects/<folder>/...
        parts = entry['key'].split('/')
        if len(parts) < 4:
            continue

        bucket_key = f"{parts[1]}/{parts[2]}"
        summary    = by_project.setdefault(bucket_key, {'objects': 0, 'bytes': 0})
        summary['objects'] += 1
        summary['bytes']   += entry['size']

    response = jsonify({'available': True, 'bucket': bucket_name, 'byProject': by_project})
    response.headers['Cache-Control'] = 'no-store'
    return response

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Route | Preview a Destructive Operation
# -----------------------------------------------------------------------------

@project_manager_api.route('/api/manager/projects/<project_code>/preview', methods=['POST'])
def manager_preview(project_code):
    """
    Report exactly what a delete would remove, before anything is confirmed.
    The second confirmation modal shows these numbers, so the operator is
    agreeing to a specific quantity of files rather than to a phrase.
    """
    body    = request.get_json(silent=True) or {}
    scope   = str(body.get('scope') or '').strip().lower()
    project = _find_project(project_code)

    if not project:
        return jsonify({'error': f'No project found with code {project_code}.'}), 404

    if scope not in ('local', 'r2', 'both'):
        return jsonify({'error': 'Scope must be local, r2 or both.'}), 400

    preview = {
        'projectCode'   : project['projectCode'],
        'projectName'   : project['projectName'],
        'projectFolder' : project['projectFolder'],
        'projectYear'   : project['projectYear'],
        'scope'         : scope,
        'local'         : None,
        'r2'            : None
    }

    if scope in ('local', 'both'):
        directory       = _project_dir(project['projectYear'], project['projectFolder'])
        preview['local'] = _folder_stats(directory)
        preview['local']['path'] = os.path.relpath(directory, REPO_ROOT).replace('\\', '/') if directory else ''

    if scope in ('r2', 'both'):
        client, bucket_name, error = _get_r2_client()

        if error:
            preview['r2'] = {'available': False, 'reason': error, 'objects': 0, 'bytes': 0}
        else:
            prefix = _r2_project_prefix(project['projectYear'], project['projectFolder'])
            try:
                objects = _r2_list_prefix(client, bucket_name, prefix)
                preview['r2'] = {
                    'available' : True,
                    'prefix'    : prefix,
                    'objects'   : len(objects),
                    'bytes'     : sum(item['size'] for item in objects),
                    'sample'    : [item['key'].replace(prefix, '') for item in objects[:12]]
                }
            except Exception as error:
                traceback.print_exc()
                preview['r2'] = {'available': False, 'reason': f'{type(error).__name__}: {error}',
                                 'objects': 0, 'bytes': 0}

    return jsonify(preview)

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Route | Delete
# -----------------------------------------------------------------------------

@project_manager_api.route('/api/manager/projects/<project_code>/delete', methods=['POST'])
def manager_delete(project_code):
    """Quarantine the local folder, delete the R2 prefix, or both."""
    body    = request.get_json(silent=True) or {}
    scope   = str(body.get('scope') or '').strip().lower()
    project = _find_project(project_code)

    if not project:
        return jsonify({'error': f'No project found with code {project_code}.'}), 404

    if scope not in ('local', 'r2', 'both'):
        return jsonify({'error': 'Scope must be local, r2 or both.'}), 400

    refusal = _require_confirmation(body, project['projectCode'])
    if refusal:
        return jsonify({'error': refusal}), 400

    performed = []

    # LOCAL | Move aside rather than unlink, so a mistake is recoverable
    if scope in ('local', 'both'):
        directory = _project_dir(project['projectYear'], project['projectFolder'])

        if not directory or not os.path.isdir(directory):
            performed.append({'step': 'local', 'status': 'skipped', 'detail': 'No folder on disk.'})
        else:
            quarantine_root = os.path.join(PORTAL_ROOT, QUARANTINE_DIR_NAME)
            os.makedirs(quarantine_root, exist_ok=True)

            stamp       = datetime.now().strftime('%Y-%m-%d_%H%M%S')
            destination = os.path.join(quarantine_root, f"{stamp}__{project['projectFolder']}")

            try:
                shutil.move(directory, destination)
                performed.append({
                    'step'   : 'local',
                    'status' : 'quarantined',
                    'detail' : os.path.relpath(destination, REPO_ROOT).replace('\\', '/')
                })
            except OSError as error:
                return jsonify({
                    'error'     : f'The project folder could not be moved: {error}',
                    'performed' : performed
                }), 500

    # R2 | An object store has no quarantine, so this really does delete
    if scope in ('r2', 'both'):
        client, bucket_name, error = _get_r2_client()

        if error:
            performed.append({'step': 'r2', 'status': 'unavailable', 'detail': error})
        else:
            prefix = _r2_project_prefix(project['projectYear'], project['projectFolder'])

            try:
                objects = _r2_list_prefix(client, bucket_name, prefix)
                deleted = 0

                for entry in objects:
                    client.delete_object(Bucket=bucket_name, Key=entry['key'])
                    deleted += 1

                performed.append({
                    'step'   : 'r2',
                    'status' : 'deleted',
                    'detail' : f'{deleted} object(s) under {prefix}'
                })
            except Exception as error:
                traceback.print_exc()
                performed.append({'step': 'r2', 'status': 'failed', 'detail': f'{type(error).__name__}: {error}'})

    # INDEX | Drop the entry only when the project has left the portal
    if scope in ('local', 'both'):
        if _update_master_index(project['projectCode'], None):
            performed.append({'step': 'index', 'status': 'updated', 'detail': 'Entry removed from the master index.'})

    return jsonify({
        'ok'          : True,
        'projectCode' : project['projectCode'],
        'scope'       : scope,
        'performed'   : performed
    })

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Route | Edit and Rename
# -----------------------------------------------------------------------------

@project_manager_api.route('/api/manager/projects/<project_code>/edit', methods=['POST'])
def manager_edit(project_code):
    """
    Apply field edits, and when the code, folder or year changed, migrate the
    local folder, the R2 prefix and the master index together.
    """
    body    = request.get_json(silent=True) or {}
    project = _find_project(project_code)

    if not project:
        return jsonify({'error': f'No project found with code {project_code}.'}), 404

    refusal = _require_confirmation(body, project['projectCode'])
    if refusal:
        return jsonify({'error': refusal}), 400

    fields = body.get('fields') if isinstance(body.get('fields'), dict) else {}

    new_code   = str(fields.get('projectCode')   or project['projectCode']).strip().upper()
    new_folder = str(fields.get('projectFolder') or project['projectFolder']).strip()
    new_year   = str(fields.get('projectYear')   or project['projectYear']).strip()

    # VALIDATE | Identity fields decide where every file and R2 key lives
    if not PROJECT_CODE_PATTERN.match(new_code):
        return jsonify({'error': f'"{new_code}" is not a valid project code. Use two letters then two digits, e.g. PS03.'}), 400

    if not PROJECT_FOLDER_PATTERN.match(new_folder):
        return jsonify({'error': f'"{new_folder}" is not a valid folder name.'}), 400

    if not YEAR_PATTERN.match(new_year):
        return jsonify({'error': f'"{new_year}" is not a valid year folder. Use two digits, e.g. 26.'}), 400

    identity_changed = (new_code   != project['projectCode']
                        or new_folder != project['projectFolder']
                        or new_year   != project['projectYear'])

    if identity_changed and new_code != project['projectCode'] and _find_project(new_code):
        return jsonify({'error': f'Project code {new_code} is already in use.'}), 409

    old_dir = _project_dir(project['projectYear'], project['projectFolder'])
    new_dir = _project_dir(new_year, new_folder)

    if not new_dir:
        return jsonify({'error': 'The new folder path escapes the project portal.'}), 400

    performed = []
    changes   = []

    # MOVE | Rename the folder before writing fields, so the writes land in it
    if identity_changed:
        if not old_dir or not os.path.isdir(old_dir):
            return jsonify({'error': 'The project folder is not on disk, so it cannot be renamed.'}), 409

        if os.path.exists(new_dir):
            return jsonify({'error': f'A folder already exists at {new_year}-Projects/{new_folder}.'}), 409

        try:
            os.makedirs(os.path.dirname(new_dir), exist_ok=True)
            shutil.move(old_dir, new_dir)
            performed.append({
                'step'   : 'folder',
                'status' : 'renamed',
                'detail' : f"{project['projectYear']}-Projects/{project['projectFolder']}  ->  {new_year}-Projects/{new_folder}"
            })
        except OSError as error:
            return jsonify({'error': f'The project folder could not be renamed: {error}'}), 500

    working_dir = new_dir if identity_changed else old_dir

    # FIELDS | Write to the authoritative files only
    if working_dir and os.path.isdir(working_dir):
        writable = {}

        if 'projectName' in fields:
            writable['projectName'] = str(fields['projectName']).strip()

        if 'projectPin' in fields:
            writable['projectPin'] = str(fields['projectPin']).strip()

        if 'description' in fields:
            writable['projectDescription'] = str(fields['description']).strip()

        if 'address' in fields:
            writable['address'] = str(fields['address']).strip()

        if identity_changed:
            writable['projectCode'] = new_code

        _apply_admin_config_fields(working_dir, writable, changes)
        _apply_quotation_fields(working_dir, writable, changes)

        if changes:
            performed.append({'step': 'fields', 'status': 'written', 'detail': f'{len(changes)} field(s) updated.'})

    # R2 | Migrate the prefix so the bucket matches the new identity
    if identity_changed:
        client, bucket_name, error = _get_r2_client()

        if error:
            performed.append({'step': 'r2', 'status': 'unavailable', 'detail': error})
        else:
            old_prefix = _r2_project_prefix(project['projectYear'], project['projectFolder'])
            new_prefix = _r2_project_prefix(new_year, new_folder)

            try:
                objects = _r2_list_prefix(client, bucket_name, old_prefix)

                for entry in objects:
                    destination_key = new_prefix + entry['key'][len(old_prefix):]
                    client.copy_object(
                        Bucket     = bucket_name,
                        CopySource = {'Bucket': bucket_name, 'Key': entry['key']},
                        Key        = destination_key
                    )

                for entry in objects:
                    client.delete_object(Bucket=bucket_name, Key=entry['key'])

                performed.append({
                    'step'   : 'r2',
                    'status' : 'migrated' if objects else 'nothing-to-move',
                    'detail' : f'{len(objects)} object(s)  {old_prefix}  ->  {new_prefix}'
                })
            except Exception as error:
                traceback.print_exc()
                performed.append({'step': 'r2', 'status': 'failed', 'detail': f'{type(error).__name__}: {error}'})

    # INDEX | Keep the gallery honest without waiting for the next build
    index_entry = {
        'projectCode'   : new_code,
        'projectFolder' : new_folder,
        'projectYear'   : new_year
    }

    if 'projectName' in fields:
        index_entry['projectName'] = str(fields['projectName']).strip()

    if _update_master_index(project['projectCode'], index_entry):
        performed.append({'step': 'index', 'status': 'updated', 'detail': 'Master index rewritten.'})

    return jsonify({
        'ok'          : True,
        'projectCode' : new_code,
        'performed'   : performed,
        'changes'     : changes
    })

# endregion -------------------------------------------------------------------
