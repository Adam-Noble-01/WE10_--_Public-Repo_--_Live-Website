# =============================================================================
# PROJECTVISION - TRUEVISION PUBLISHED DOCUMENTS API
# =============================================================================
#
# FILE       : ProjectVision__TrueVisionPublished__Api__.py
# MODULE     : TrueVision Published Documents - Local Filing
# AUTHOR     : Adam Noble - Noble Architecture
# PURPOSE    : File a published drawing's baked files into the project folder, archive a superseded revision, and prune what a re-publish no longer names
# SCHEMA REF : na-project-portal/26-Projects/AA00__ExampleProjectStructure/
#              30__TrueVision__AppContent/06__Layout__PublishedDocuments
#              ^ The readable schema. CHANGE A NAME HERE, CHANGE IT THERE.
# CREATED    : 23-Sep-2026
#
# DESCRIPTION:
# - THE ONE FOLDER THESE ROUTES MAY TOUCH is a project's
#       na-project-portal/<year>-Projects/<folder>/30__TrueVision__AppContent/06__Layout__PublishedDocuments
#   Every path is validated segment by segment and resolved to be inside it,
#   exactly as the sheet-images routes guard 05__Layout__DrawingDocs__Images.
# - WRITES ARE ATOMIC. A file goes to a temp name beside its target and is renamed
#   into place, so the reader - or the R2 sync - never sees half a file.
# - THE ARCHIVE IS MADE HERE, NOT IN THE BROWSER. Python's zipfile is one call and
#   there is no zip library in the app to vendor for it. A revision change zips the
#   whole document folder into 00__Archive__Revisions and removes the folder so
#   the new revision is built clean. An archive is NEVER overwritten: a second
#   archive of the same revision gets a timestamp, because the whole point of the
#   archive is that an issued revision cannot be lost.
# - 00__Archive__Revisions IS LOCAL ONLY. The R2 sync skips every folder whose
#   name starts with 00__ (SKIP_FOLDER_PREFIXES in CloudflareR2__ModelSync__Main__.py),
#   and the write route refuses to put anything into it - only the archive route
#   writes there.
# - PRUNE IS SCOPED TO ONE DOCUMENT. After a same-revision re-publish the files the
#   new manifest names are kept and the rest of THAT document's folder goes. It
#   never walks the published root, so a pruning mistake can cost one drawing's
#   old files and nothing else.
# - THE SERVER DOES NOT RELOAD ITS ROUTES. Registered in
#   ProjectVision__LocalServer__Main__.py; the server must be restarted before these
#   answer anything but 405.
#
# ROUTES:
#   POST|PUT /api/truevision/published/file      raw bytes -> 06__.../<path>
#   GET      /api/truevision/published/file      a JSON file back (manifest, index)
#   GET      /api/truevision/published/list      every file under the root or one document
#   POST     /api/truevision/published/archive   zip a document folder, then remove it
#   POST     /api/truevision/published/prune     delete what a document no longer names
#
# -----------------------------------------------------------------------------
#
# DEVELOPMENT LOG:
# 23-Sep-2026 - Version 1.0.0
# - Created with Phase 5 of TrueVision__PLAN__PublishingSystem__.md.
#
# =============================================================================


# #region ---------------------------------------------------------------------
# REGION | Imports
# -----------------------------------------------------------------------------

import hashlib
import json
import os
import re
import shutil
import tempfile
import time
import zipfile

from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Configuration
# -----------------------------------------------------------------------------

SCRIPT_DIR              = os.path.dirname(os.path.abspath(__file__))
PORTAL_ROOT             = os.path.abspath(os.path.join(SCRIPT_DIR, '..', 'na-project-portal'))

TV_CONTENT_DIR          = '30__TrueVision__AppContent'
PUBLISHED_DIR           = '06__Layout__PublishedDocuments'               # <-- Never changes; Na__PubSchema__ and the R2 client name it too
ARCHIVE_DIR             = '00__Archive__Revisions'                       # <-- 00__ keeps it off R2 and out of every sync

YEAR_PATTERN            = re.compile(r'^\d{2}$')
PROJECT_PATTERN         = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_\-.]{0,119}$')
SEGMENT_PATTERN         = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_\-.]{0,159}$')   # <-- Letter or digit first, so "." and ".." never name a segment
DOCUMENT_PATTERN        = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_\-]{2,79}$')
REVISION_PATTERN        = re.compile(r'^[A-Za-z0-9]{1,8}$')
ALLOWED_EXTENSIONS      = ('.json', '.svg', '.webp', '.png', '.pdf', '.md', '.note')

MAX_FILE_BYTES          = 256 * 1024 * 1024                              # <-- A baked A1 PDF can be large; this only stops a runaway request
REPLACE_RETRY_DELAYS_S  = (0.05, 0.1, 0.2, 0.4, 0.8)

truevision_published_api = Blueprint('truevision_published_api', __name__)

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Helpers
# -----------------------------------------------------------------------------

def _now_iso():
    now = datetime.now(timezone.utc)
    return now.strftime('%Y-%m-%dT%H:%M:%S.') + f'{now.microsecond // 1000:03d}Z'


def _is_inside(candidate_path, parent_path):
    parent = os.path.realpath(parent_path)
    candidate = os.path.realpath(candidate_path)
    return candidate == parent or candidate.startswith(parent + os.sep)


def _context():
    body = request.get_json(silent=True) if request.is_json else None
    body = body if isinstance(body, dict) else {}
    folder = request.args.get('project-folder') or body.get('projectFolder')
    year = request.args.get('year') or body.get('year')
    return (folder or '').strip(), (str(year) if year is not None else '').strip()


def _published_root(project_folder, year_code):
    """
    The published documents folder of a project that exists, or None. NOT
    created here - only a write that needs it makes it.
    """
    if not project_folder or not PROJECT_PATTERN.match(project_folder) or '..' in project_folder:
        return None
    if not year_code or not YEAR_PATTERN.match(str(year_code)):
        return None
    year_dir = os.path.join(PORTAL_ROOT, f'{year_code}-Projects')
    project_dir = os.path.join(year_dir, project_folder)
    if not os.path.isdir(project_dir) or not _is_inside(project_dir, year_dir) \
            or os.path.realpath(project_dir) == os.path.realpath(year_dir):
        return None
    root = os.path.join(project_dir, TV_CONTENT_DIR, PUBLISHED_DIR)
    return root if _is_inside(root, PORTAL_ROOT) else None


def _relative_parts(relative_path):
    """A published relative path split into validated segments, or None."""
    if not isinstance(relative_path, str) or not relative_path.strip():
        return None
    parts = [part for part in relative_path.replace('\\', '/').strip('/').split('/') if part != '']
    if not parts or len(parts) > 6:
        return None
    for part in parts:
        if part in ('.', '..') or not SEGMENT_PATTERN.match(part):
            return None
    return parts


def _target(root, relative_path, allow_archive=False):
    """root/<relative path> when every segment is allowed and it stays inside root, else None."""
    parts = _relative_parts(relative_path)
    if not parts:
        return None
    if parts[0] == ARCHIVE_DIR and not allow_archive:
        return None                                                               # <-- Only the archive route writes into the archive
    if not parts[-1].lower().endswith(ALLOWED_EXTENSIONS):
        return None
    path = os.path.join(root, *parts)
    return path if _is_inside(os.path.dirname(path), root) else None


def _refuse(message, status=400):
    return jsonify({'error': message}), status


def _sniff(data, extension):
    """True when the bytes are what the extension says they are."""
    head = data[:16]
    if extension == '.png':
        return head[:8] == b'\x89PNG\r\n\x1a\n'
    if extension == '.webp':
        return len(head) >= 12 and head[0:4] == b'RIFF' and head[8:12] == b'WEBP'
    if extension == '.pdf':
        return head[:5] == b'%PDF-'
    if extension == '.json':
        try:
            json.loads(data.decode('utf-8'))
            return True
        except (UnicodeDecodeError, ValueError):
            return False
    if extension == '.svg':
        text = data[:2048].decode('utf-8', errors='replace').lstrip()
        return text.startswith('<svg') or text.startswith('<?xml') or text.startswith('<!--')
    return True                                                                   # <-- .md / .note: text, taken as given


def _replace_with_retry(source, target):
    for delay in REPLACE_RETRY_DELAYS_S + (None,):
        try:
            os.replace(source, target)
            return
        except PermissionError:
            if delay is None:
                raise
            time.sleep(delay)


def _write_bytes(path, data):
    """Write through a temp file beside the target, then rename it into place."""
    directory = os.path.dirname(os.path.abspath(path))
    os.makedirs(directory, exist_ok=True)
    handle, temp_path = tempfile.mkstemp(prefix=os.path.basename(path) + '.', suffix='.writing', dir=directory)
    try:
        with os.fdopen(handle, 'wb') as file_handle:
            file_handle.write(data)
        _replace_with_retry(temp_path, path)
    except BaseException:
        try:
            os.remove(temp_path)
        except OSError:
            pass
        raise


def _walk(root, start):
    """Every file under start, as root-relative forward-slash paths."""
    found = []
    if not os.path.isdir(start):
        return found
    for folder, _dirs, files in os.walk(start):
        for name in files:
            if name.endswith(('.writing', '.copying')):
                continue                                                          # <-- A half-written temp is nobody's file
            full = os.path.join(folder, name)
            found.append(os.path.relpath(full, root).replace('\\', '/'))
    return sorted(found)


def _remove_empty_dirs(start, stop):
    """Remove empty folders from start upwards, never at or above stop."""
    for folder, _dirs, _files in sorted(os.walk(start), key=lambda item: -len(item[0])):
        if os.path.realpath(folder) == os.path.realpath(stop):
            continue
        try:
            if not os.listdir(folder):
                os.rmdir(folder)
        except OSError:
            pass

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Routes - Reading
# -----------------------------------------------------------------------------

@truevision_published_api.route('/api/truevision/published/list', methods=['GET'])
def published_list():
    """Every file under the published root, or under one document when ?document= names it."""
    project_folder, year_code = _context()
    root = _published_root(project_folder, year_code)
    if not root:
        return _refuse(f'Project not found: {project_folder} ({year_code})', 404)
    document = (request.args.get('document') or '').strip()
    if document and not DOCUMENT_PATTERN.match(document):
        return _refuse(f'Refused document id "{document}"')
    start = os.path.join(root, document) if document else root
    files = []
    for relative in _walk(root, start):
        full = os.path.join(root, *relative.split('/'))
        try:
            size = os.path.getsize(full)
        except OSError:
            continue
        files.append({'path': relative, 'bytes': size})
    return jsonify({'status': 'ok', 'root': PUBLISHED_DIR, 'document': document or None, 'files': files})


@truevision_published_api.route('/api/truevision/published/file', methods=['GET'])
def published_read():
    """A published JSON file, read fresh - the publisher reads the old manifest to decide on a revision."""
    project_folder, year_code = _context()
    root = _published_root(project_folder, year_code)
    if not root:
        return _refuse(f'Project not found: {project_folder} ({year_code})', 404)
    relative = (request.args.get('path') or '').strip()
    target = _target(root, relative, allow_archive=False)
    if not target or not target.lower().endswith('.json'):
        return _refuse(f'Refused path "{relative}"')
    if not os.path.isfile(target):
        return _refuse(f'Not published: {relative}', 404)
    try:
        with open(target, 'r', encoding='utf-8') as handle:
            return jsonify({'status': 'ok', 'path': relative, 'json': json.load(handle)})
    except (OSError, ValueError) as error:
        return _refuse(f'Could not read {relative}: {error}', 500)

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Routes - Writing
# -----------------------------------------------------------------------------

@truevision_published_api.route('/api/truevision/published/file', methods=['POST', 'PUT'])
def published_write():
    """
    One baked file, as raw bytes, into 06__Layout__PublishedDocuments/<path>.
    The bytes must be what the extension says; the archive folder is refused.
    """
    project_folder, year_code = _context()
    root = _published_root(project_folder, year_code)
    if not root:
        return _refuse(f'Project not found: {project_folder} ({year_code})', 404)

    relative = (request.args.get('path') or '').strip()
    target = _target(root, relative, allow_archive=False)
    if not target:
        return _refuse(f'Refused published path "{relative}"')

    length = request.content_length
    if length is not None and length > MAX_FILE_BYTES:
        return _refuse('That file is larger than this route will take', 413)
    data = request.get_data(cache=False)
    if not data:
        return _refuse('No file in the request')
    if len(data) > MAX_FILE_BYTES:
        return _refuse('That file is larger than this route will take', 413)

    extension = os.path.splitext(target)[1].lower()
    if not _sniff(data, extension):
        return _refuse(f'Those bytes are not a valid {extension} file')

    digest = hashlib.sha256(data).hexdigest()
    same = False
    if os.path.exists(target):
        try:
            with open(target, 'rb') as handle:
                same = hashlib.sha256(handle.read()).hexdigest() == digest
        except OSError:
            same = False
    if not same:
        try:
            _write_bytes(target, data)
        except Exception as error:                                              # noqa: BLE001 - reported, never raised at the browser
            print(f'[Published] Failed to write {target}')
            print(f'[Published] {type(error).__name__}: {error}')
            return _refuse('Failed to write the file', 500)

    return jsonify({'status': 'ok', 'path': relative, 'bytes': len(data), 'sha256': digest,
                    'unchanged': same, 'written': _now_iso()})


@truevision_published_api.route('/api/truevision/published/archive', methods=['POST'])
def published_archive():
    """
    A revision change: zip <document> into 00__Archive__Revisions/<document>__Revision__<old>.zip,
    then remove the document folder so the new revision is built clean. An
    existing archive of the same name is never overwritten.
    """
    project_folder, year_code = _context()
    root = _published_root(project_folder, year_code)
    if not root:
        return _refuse(f'Project not found: {project_folder} ({year_code})', 404)
    document = (request.args.get('document') or '').strip()
    revision = (request.args.get('revision') or '').strip()
    if not DOCUMENT_PATTERN.match(document):
        return _refuse(f'Refused document id "{document}"')
    if not REVISION_PATTERN.match(revision):
        return _refuse(f'Refused revision "{revision}"')

    source = os.path.join(root, document)
    if not os.path.isdir(source) or not _is_inside(source, root):
        return jsonify({'status': 'ok', 'archived': None, 'note': 'nothing published under that document yet'})

    archive_dir = os.path.join(root, ARCHIVE_DIR)
    os.makedirs(archive_dir, exist_ok=True)
    name = f'{document}__Revision__{revision}.zip'
    target = os.path.join(archive_dir, name)
    if os.path.exists(target):                                                   # <-- NEVER overwrite an issued revision
        stamp = datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')
        name = f'{document}__Revision__{revision}__{stamp}.zip'
        target = os.path.join(archive_dir, name)

    temp_handle, temp_path = tempfile.mkstemp(prefix=name + '.', suffix='.writing', dir=archive_dir)
    os.close(temp_handle)
    try:
        count = 0
        with zipfile.ZipFile(temp_path, 'w', zipfile.ZIP_DEFLATED) as bundle:
            for relative in _walk(source, source):
                bundle.write(os.path.join(source, *relative.split('/')), relative)
                count += 1
        _replace_with_retry(temp_path, target)
    except Exception as error:                                                  # noqa: BLE001
        try:
            os.remove(temp_path)
        except OSError:
            pass
        print(f'[Published] Archive of {document} failed: {type(error).__name__}: {error}')
        return _refuse('Failed to archive the document', 500)

    # THE ZIP IS WHOLE AND IN PLACE before a single file of the folder goes.
    try:
        shutil.rmtree(source)
    except OSError as error:
        return _refuse(f'Archived to {name}, but the old folder could not be removed: {error}', 500)

    print(f'[Published] Archived {document} revision {revision} -> {ARCHIVE_DIR}/{name} ({count} files)')
    return jsonify({'status': 'ok', 'archived': f'{ARCHIVE_DIR}/{name}', 'files': count, 'written': _now_iso()})


@truevision_published_api.route('/api/truevision/published/prune', methods=['POST'])
def published_prune():
    """
    After a same-revision re-publish: delete every file under ONE document's
    folder that the new manifest does not name. Scoped to that folder, always.
    """
    project_folder, year_code = _context()
    root = _published_root(project_folder, year_code)
    if not root:
        return _refuse(f'Project not found: {project_folder} ({year_code})', 404)
    body = request.get_json(silent=True) or {}
    document = (request.args.get('document') or body.get('document') or '').strip()
    keep = body.get('keep')
    if not DOCUMENT_PATTERN.match(document):
        return _refuse(f'Refused document id "{document}"')
    if not isinstance(keep, list) or not all(isinstance(one, str) for one in keep):
        return _refuse('keep must be a list of paths relative to the published root')

    folder = os.path.join(root, document)
    if not os.path.isdir(folder) or not _is_inside(folder, root):
        return jsonify({'status': 'ok', 'removed': []})

    wanted = set(path.replace('\\', '/').strip('/') for path in keep)
    removed = []
    for relative in _walk(root, folder):
        if relative in wanted:
            continue
        full = os.path.join(root, *relative.split('/'))
        if not _is_inside(full, folder):
            continue
        try:
            os.remove(full)
            removed.append(relative)
        except OSError as error:
            print(f'[Published] Could not prune {relative}: {error}')
    _remove_empty_dirs(folder, folder)
    if removed:
        print(f'[Published] Pruned {len(removed)} stale file(s) from {document}')
    return jsonify({'status': 'ok', 'removed': removed})

# endregion -------------------------------------------------------------------
