#!/usr/bin/env python3
# =============================================================================
# PROJECTVISION LOCAL SERVER - TRUEVISION STATEMENT WRITER API
# =============================================================================
#
# FILE       : ProjectVision__TrueVisionStatements__Api__.py
# NAMESPACE  : ProjectVision
# MODULE     : TrueVision Statement Writer - Local File Routes
# AUTHOR     : Adam Noble - Noble Architecture
# PURPOSE    : Read, write and tidy the statement documents in a project folder
# CREATED    : 20-Sep-2026
#
# DESCRIPTION:
# - A BROWSER CANNOT WRITE A FILE, so the Statement Writer saves through these
#   routes while it is running on localhost. R2 is the record; the copy in the
#   project folder is the one Adam can open in Typora without launching the
#   app at all, which is the whole reason a statement is a markdown file and
#   not a key in a JSON document.
# - EVERYTHING IS FENCED INTO ONE FOLDER. Every path these routes touch must
#   resolve inside
#       na-project-portal/<year>-Projects/<folder>/30__TrueVision__AppContent/10__StatementDocs
#   and is checked after resolution, not before, so a path that climbs out with
#   .. or through a symbolic link is refused rather than cleaned up and obeyed.
# - THE TREE ROUTE EXISTS BECAUSE A STATIC SERVER CANNOT LIST A FOLDER. The
#   publisher needs to know which pictures are on disk and where, the manager
#   needs to know which statements exist, and the tidy-up needs to know what is
#   no longer used. One listing answers all three.
# - WHAT IT WRITES. Text files - a statement's markdown, the HTML built from
#   it - and the one kind of picture it has to: a picture DRAGGED ONTO the
#   editor, which the browser hands over as bytes rather than as a path, so
#   there is no other way for it to reach the folder. Pictures already on disk
#   are never rewritten; they are read where they are and published from there.
# - WHAT IT WILL NOT DO: delete anything without the caller naming it exactly,
#   or touch a single byte outside that one folder.
#
# INTEGRATION:
# - Registered by ProjectVision__LocalServer__Main__ alongside the project
#   manager and scrapbook blueprints.
# - Called by Na__LayoutEditor__Statement__Data__Transport__ and
#   Na__LayoutEditor__Statement__Publish__.
# - THE SERVER DOES NOT RELOAD ITS ROUTES. Started without --debug it holds
#   whatever routes it had when it started, so a route added here answers 405
#   until the 8090 server is restarted.
#
# =============================================================================


# #region ---------------------------------------------------------------------
# REGION | Imports
# -----------------------------------------------------------------------------

import base64
import os
import re
import shutil

from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Configuration
# -----------------------------------------------------------------------------

SCRIPT_DIR              = os.path.dirname(os.path.abspath(__file__))
PORTAL_ROOT             = os.path.abspath(os.path.join(SCRIPT_DIR, '..', 'na-project-portal'))

TV_CONTENT_DIR          = '30__TrueVision__AppContent'
STATEMENTS_DIR          = '10__StatementDocs'

YEAR_PATTERN            = re.compile(r'^\d{2}$')
FOLDER_PATTERN          = re.compile(r'^[A-Za-z0-9_\-.]{1,120}$')
SEGMENT_PATTERN         = re.compile(r'^[A-Za-z0-9_\-. &()\[\]]{1,140}$')

TEXT_SUFFIXES           = ('.md', '.html', '.json', '.txt', '.note')
IMAGE_SUFFIXES          = ('.jpg', '.jpeg', '.png', '.webp', '.gif', '.tif', '.tiff', '.bmp', '.svg', '.heic')
MAX_TEXT_BYTES          = 8 * 1024 * 1024                            # <-- A statement is tens of kilobytes; this only stops a runaway request
MAX_IMAGE_BYTES         = 64 * 1024 * 1024                           # <-- A 6144x4096 render is about 13 MB; this leaves room and still stops a runaway request
MAX_TREE_ENTRIES        = 6000

truevision_statements_api = Blueprint('truevision_statements_api', __name__)

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Helpers
# -----------------------------------------------------------------------------

def _now_iso():
    """The current time as the app writes it: UTC, milliseconds, Z."""
    now = datetime.now(timezone.utc)
    return now.strftime('%Y-%m-%dT%H:%M:%S.') + f'{now.microsecond // 1000:03d}Z'


def _is_inside(candidate_path, parent_path):
    """True when candidate_path resolves to somewhere inside parent_path."""
    parent = os.path.realpath(parent_path)
    candidate = os.path.realpath(candidate_path)
    return candidate == parent or candidate.startswith(parent + os.sep)


def _statements_root(project_folder, year_code):
    """
    The one folder these routes may touch, or None when the project is not
    there. The folder itself is NOT created here: a project with no statements
    yet answers "not found" to a read and is created by the folder route.
    """
    if not project_folder or not FOLDER_PATTERN.match(project_folder):
        return None
    if not year_code or not YEAR_PATTERN.match(str(year_code)):
        return None

    project_dir = os.path.join(PORTAL_ROOT, f'{year_code}-Projects', project_folder)
    if not os.path.isdir(project_dir):
        return None

    root = os.path.join(project_dir, TV_CONTENT_DIR, STATEMENTS_DIR)
    if not _is_inside(root, PORTAL_ROOT):
        return None
    return root


def _context():
    """The project folder and year from the query string or the JSON body."""
    body = request.get_json(silent=True) or {}
    folder = request.args.get('project-folder') or body.get('projectFolder')
    year = request.args.get('year') or body.get('year')
    return (folder or '').strip(), (str(year) if year is not None else '').strip()


def _resolve(root, relative_path):
    """
    A caller-supplied path inside the statements folder, or None when it is not
    one. Every segment is checked by pattern AND the result is checked to be
    inside the root after resolution, so neither .. nor a link gets out.
    """
    if relative_path is None:
        return None
    text = str(relative_path).replace('\\', '/').strip().strip('/')
    if text == '':
        return root
    segments = [segment for segment in text.split('/') if segment != '']
    if not segments or len(segments) > 8:
        return None
    for segment in segments:
        if segment in ('.', '..') or not SEGMENT_PATTERN.match(segment):
            return None
    target = os.path.join(root, *segments)
    if not _is_inside(os.path.dirname(target) or root, root) and not _is_inside(target, root):
        return None
    return target


def _refuse(message, status=400):
    return jsonify({'error': message}), status


def _kind_of(name):
    lower = name.lower()
    if lower.endswith(TEXT_SUFFIXES):
        return 'text'
    if lower.endswith(IMAGE_SUFFIXES):
        return 'image'
    return 'other'

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Routes - Reading
# -----------------------------------------------------------------------------

@truevision_statements_api.route('/api/truevision/statements/tree')
def statements_tree():
    """
    Every folder and file under 10__StatementDocs, with sizes and modified
    times. A static server cannot list a folder, so this is how the manager
    finds the statements, how the publisher finds the pictures a statement
    links to, and how the tidy-up finds the ones it does not.
    """
    project_folder, year_code = _context()
    root = _statements_root(project_folder, year_code)
    if not root:
        return _refuse(f'Project not found: {project_folder} ({year_code})', 404)
    if not os.path.isdir(root):
        return jsonify({'status': 'ok', 'root': STATEMENTS_DIR, 'exists': False, 'entries': []})

    entries = []
    truncated = False
    for current, directories, files in os.walk(root):
        directories.sort()
        relative_dir = os.path.relpath(current, root).replace('\\', '/')
        if relative_dir == '.':
            relative_dir = ''
        for name in sorted(files):
            if len(entries) >= MAX_TREE_ENTRIES:
                truncated = True
                break
            full = os.path.join(current, name)
            try:
                stat = os.stat(full)
            except OSError:
                continue
            entries.append({
                'path'     : (relative_dir + '/' + name).lstrip('/'),
                'folder'   : relative_dir,
                'name'     : name,
                'kind'     : _kind_of(name),
                'bytes'    : stat.st_size,
                'modified' : datetime.fromtimestamp(stat.st_mtime, timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
            })
        if truncated:
            break

    return jsonify({
        'status'    : 'ok',
        'root'      : STATEMENTS_DIR,
        'exists'    : True,
        'truncated' : truncated,
        'entries'   : entries
    })

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Routes - Writing
# -----------------------------------------------------------------------------

@truevision_statements_api.route('/api/truevision/statements/file', methods=['POST'])
def statements_write_file():
    """
    Write one text file - a statement's markdown, its generated HTML - into the
    statements folder. The folders on the way to it are created; the file is
    written whole, with the newline convention the app writes everywhere.
    """
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return _refuse('Request body must be a JSON object')

    project_folder, year_code = _context()
    root = _statements_root(project_folder, year_code)
    if not root:
        return _refuse(f'Project not found: {project_folder} ({year_code})', 404)

    target = _resolve(root, body.get('path'))
    if not target or target == root:
        return _refuse(f'Refused statement path "{body.get("path")}"')
    if not target.lower().endswith(TEXT_SUFFIXES):
        return _refuse('Only markdown, HTML, JSON and text files are written through this route')

    text = body.get('text')
    if not isinstance(text, str):
        return _refuse('"text" must be a string')
    if len(text.encode('utf-8')) > MAX_TEXT_BYTES:
        return _refuse('That file is larger than this route will take')

    try:
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, 'w', encoding='utf-8', newline='') as file_handle:    # <-- newline='' so the markdown keeps its own line endings
            file_handle.write(text)
    except Exception as error:                                                  # noqa: BLE001 - reported, never raised at the browser
        print(f'[Statements] Failed to write {target}')
        print(f'[Statements] {type(error).__name__}: {error}')
        return _refuse('Failed to write the statement file', 500)

    return jsonify({
        'status'   : 'ok',
        'path'     : os.path.relpath(target, root).replace('\\', '/'),
        'bytes'    : len(text.encode('utf-8')),
        'written'  : _now_iso()
    })


@truevision_statements_api.route('/api/truevision/statements/image', methods=['POST'])
def statements_write_image():
    """
    Put a dropped picture into the statement's own pictures folder.

    A picture dragged onto the editor comes from wherever it happens to live
    on this machine - a camera roll, a render output folder - and the browser
    hands over its bytes, never its path. So the bytes come through here as
    base64 and land beside the statement, which is what makes the link in the
    markdown work in Typora as well as in the app.
    """
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return _refuse('Request body must be a JSON object')

    project_folder, year_code = _context()
    root = _statements_root(project_folder, year_code)
    if not root:
        return _refuse(f'Project not found: {project_folder} ({year_code})', 404)

    target = _resolve(root, body.get('path'))
    if not target or target == root:
        return _refuse(f'Refused statement path "{body.get("path")}"')
    if not target.lower().endswith(IMAGE_SUFFIXES):
        return _refuse('Only pictures are written through this route')

    encoded = body.get('dataBase64')
    if not isinstance(encoded, str) or not encoded:
        return _refuse('"dataBase64" must be a base64 string')

    try:
        blob = base64.b64decode(encoded, validate=True)
    except Exception:                                                           # noqa: BLE001
        return _refuse('"dataBase64" is not valid base64')
    if len(blob) > MAX_IMAGE_BYTES:
        return _refuse('That picture is larger than this route will take')

    # A PICTURE IS NEVER WRITTEN OVER. Two shots can easily share a name, and
    # the one already in the folder may be the one the statement links to, so
    # a clash gets a suffix and the caller is told what the file ended up as.
    final = target
    if os.path.exists(final):
        stem, suffix = os.path.splitext(target)
        index = 2
        while os.path.exists(f'{stem}__{index:02d}{suffix}') and index < 100:
            index += 1
        final = f'{stem}__{index:02d}{suffix}'

    try:
        os.makedirs(os.path.dirname(final), exist_ok=True)
        with open(final, 'wb') as file_handle:
            file_handle.write(blob)
    except Exception as error:                                                  # noqa: BLE001
        print(f'[Statements] Failed to write {final}')
        print(f'[Statements] {type(error).__name__}: {error}')
        return _refuse('Failed to write the picture', 500)

    return jsonify({
        'status' : 'ok',
        'path'   : os.path.relpath(final, root).replace('\\', '/'),
        'bytes'  : len(blob),
        'renamed': final != target
    })


@truevision_statements_api.route('/api/truevision/statements/folder', methods=['POST'])
def statements_make_folder():
    """Create a folder inside the statements folder, and its parents with it."""
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return _refuse('Request body must be a JSON object')

    project_folder, year_code = _context()
    root = _statements_root(project_folder, year_code)
    if not root:
        return _refuse(f'Project not found: {project_folder} ({year_code})', 404)

    target = _resolve(root, body.get('path'))
    if not target:
        return _refuse(f'Refused statement path "{body.get("path")}"')

    try:
        os.makedirs(target, exist_ok=True)
    except Exception as error:                                                  # noqa: BLE001
        print(f'[Statements] Failed to create {target}')
        print(f'[Statements] {type(error).__name__}: {error}')
        return _refuse('Failed to create the folder', 500)

    return jsonify({'status': 'ok', 'path': os.path.relpath(target, root).replace('\\', '/')})


@truevision_statements_api.route('/api/truevision/statements/move', methods=['POST'])
def statements_move():
    """
    Move or rename a file or folder inside the statements folder. This is what
    renames a statement and what parks a picture the document no longer uses
    in its 00__Images folder. It will not write over something already there.
    """
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return _refuse('Request body must be a JSON object')

    project_folder, year_code = _context()
    root = _statements_root(project_folder, year_code)
    if not root:
        return _refuse(f'Project not found: {project_folder} ({year_code})', 404)

    source = _resolve(root, body.get('from'))
    target = _resolve(root, body.get('to'))
    if not source or source == root:
        return _refuse(f'Refused source "{body.get("from")}"')
    if not target or target == root:
        return _refuse(f'Refused destination "{body.get("to")}"')
    if not os.path.exists(source):
        return _refuse(f'Nothing at "{body.get("from")}"', 404)
    if os.path.exists(target):
        return _refuse(f'Something is already at "{body.get("to")}"', 409)

    try:
        os.makedirs(os.path.dirname(target), exist_ok=True)
        shutil.move(source, target)
    except Exception as error:                                                  # noqa: BLE001
        print(f'[Statements] Failed to move {source} -> {target}')
        print(f'[Statements] {type(error).__name__}: {error}')
        return _refuse('Failed to move it', 500)

    return jsonify({
        'status' : 'ok',
        'from'   : os.path.relpath(source, root).replace('\\', '/'),
        'to'     : os.path.relpath(target, root).replace('\\', '/')
    })


@truevision_statements_api.route('/api/truevision/statements/delete', methods=['POST'])
def statements_delete():
    """
    Delete a file, or a whole statement folder. The caller must send back the
    exact path as "confirm" as well as "path": deleting a statement takes a
    folder of somebody's writing with it, and a mistyped path that happens to
    exist is not an instruction.
    """
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return _refuse('Request body must be a JSON object')

    project_folder, year_code = _context()
    root = _statements_root(project_folder, year_code)
    if not root:
        return _refuse(f'Project not found: {project_folder} ({year_code})', 404)

    asked = body.get('path')
    if body.get('confirm') != asked:
        return _refuse('The delete was not confirmed: "confirm" must repeat "path" exactly')

    target = _resolve(root, asked)
    if not target or target == root:
        return _refuse(f'Refused statement path "{asked}"')
    if not os.path.exists(target):
        return _refuse(f'Nothing at "{asked}"', 404)

    try:
        if os.path.isdir(target):
            shutil.rmtree(target)
        else:
            os.remove(target)
    except Exception as error:                                                  # noqa: BLE001
        print(f'[Statements] Failed to delete {target}')
        print(f'[Statements] {type(error).__name__}: {error}')
        return _refuse('Failed to delete it', 500)

    return jsonify({'status': 'ok', 'deleted': os.path.relpath(target, root).replace('\\', '/')})

# endregion -------------------------------------------------------------------
