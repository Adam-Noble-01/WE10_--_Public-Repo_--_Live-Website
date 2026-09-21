#!/usr/bin/env python3
# =============================================================================
# PROJECTVISION LOCAL SERVER - TRUEVISION SHEET IMAGES API
# =============================================================================
#
# FILE       : ProjectVision__TrueVisionSheetImages__Api__.py
# NAMESPACE  : ProjectVision
# MODULE     : TrueVision Layout Editor Sheet Images - Local File Routes
# AUTHOR     : Adam Noble - Noble Architecture
# PURPOSE    : Store the pictures placed on Layout Editor sheets in the project
#              folder, filed by the document id of the drawing each is on
# CREATED    : 21-Sep-2026
#
# DESCRIPTION:
# - A BROWSER CANNOT WRITE A FILE, so a picture dropped on a sheet reaches the
#   repository through these routes while the editor runs on localhost. R2 is
#   where the live site reads it from (the editor's save pushes it there); the
#   copy in the project folder is the repository's record of it and the
#   GitHub Pages fallback.
# - EVERYTHING IS FENCED INTO ONE FOLDER:
#       na-project-portal/<year>-Projects/<folder>/30__TrueVision__AppContent/05__Layout__DrawingDocs__Images
#   with one level of document-id folders under it (RB05_T01_D01, ...) and
#   the save's own 00__Archive. Every path is checked after resolution, so
#   neither .. nor a link gets out.
# - FOLDERS ARE MADE ON DEMAND. The build script never makes the images
#   folder: most projects never have a picture on a sheet. The first upload
#   makes it, and the first picture on a drawing makes that drawing's folder.
# - A STORED NAME IS ITS CONTENT. A picture this feature stores is named
#   <slug>__<first ten hex digits of its SHA-256>.<type>, and the upload
#   refuses bytes that do not hash to their name - so a name never means two
#   pictures, a picture dropped twice is stored once, and a copy of a file
#   found anywhere under the images folder is known to be the right one.
# - RECONCILE IS WHAT KEEPS THE FOLDERS FILED BY DRAWING NUMBER. The editor
#   sends every picture its drawings use with the folder its drawing's
#   document id names; each is copied there from wherever it is found. Only
#   after the drawings pointing at the new folders are written does the
#   editor ask for the rest to be archived - moved to 00__Archive, never
#   deleted - and only files this feature stored are ever moved: anything
#   else in the folder is somebody's own and is left where it is.
#
# INTEGRATION:
# - Registered by ProjectVision__LocalServer__Main__ alongside the project
#   manager, scrapbook and statement blueprints.
# - Called by Na__LayoutEditor__SheetImages__Store__.
# - THE SERVER DOES NOT RELOAD ITS ROUTES. Started without --debug it holds
#   whatever routes it had when it started, so these answer 405/404 until the
#   8090 server is restarted.
#
# DEVELOPMENT LOG:
# 21-Sep-2026 - Version 1.0.0
# - Initial implementation: upload, reconcile (with archive), list.
#
# =============================================================================


# #region ---------------------------------------------------------------------
# REGION | Imports
# -----------------------------------------------------------------------------

import hashlib
import os
import re
import shutil
import tempfile
import time

from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Configuration
# -----------------------------------------------------------------------------

SCRIPT_DIR              = os.path.dirname(os.path.abspath(__file__))
PORTAL_ROOT             = os.path.abspath(os.path.join(SCRIPT_DIR, '..', 'na-project-portal'))

TV_CONTENT_DIR          = '30__TrueVision__AppContent'
IMAGES_DIR              = '05__Layout__DrawingDocs__Images'                # <-- Never changes; the R2 client names it too (Na__CfApi__SHEET_IMAGES_DIR)
ARCHIVE_DIR             = '00__Archive'

YEAR_PATTERN            = re.compile(r'^\d{2}$')
PROJECT_PATTERN         = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_\-.]{0,119}$')   # <-- Letter or digit first, so "." and ".." never name a project
FOLDER_PATTERN          = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_\-.]{0,119}$')
FILE_PATTERN            = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_\-.]{0,159}\.(webp|jpg|jpeg|png)$', re.IGNORECASE)
MANAGED_PATTERN         = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_\-.]*__([0-9a-f]{10})\.(webp|jpg|png)$')

MAX_IMAGE_BYTES         = 96 * 1024 * 1024                              # <-- A stored picture is a few MB; this only stops a runaway request
MAX_KEEP_ITEMS          = 5000
REPLACE_RETRY_DELAYS_S  = (0.05, 0.1, 0.2, 0.4, 0.8)                    # <-- A file held open by a reader can refuse a rename for a moment

truevision_sheet_images_api = Blueprint('truevision_sheet_images_api', __name__)

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


def _context():
    """The project folder and year from the query string or the JSON body."""
    body = request.get_json(silent=True) if request.is_json else None
    body = body if isinstance(body, dict) else {}
    folder = request.args.get('project-folder') or body.get('projectFolder')
    year = request.args.get('year') or body.get('year')
    return (folder or '').strip(), (str(year) if year is not None else '').strip()


def _images_root(project_folder, year_code):
    """
    The one folder these routes may touch, or None when the project is not
    there. NOT created here: a project with no pictures has no images folder,
    and only a write that needs it makes it.
    """
    if not project_folder or not PROJECT_PATTERN.match(project_folder) or '..' in project_folder:
        return None
    if not year_code or not YEAR_PATTERN.match(str(year_code)):
        return None
    year_dir = os.path.join(PORTAL_ROOT, f'{year_code}-Projects')
    project_dir = os.path.join(year_dir, project_folder)
    if not os.path.isdir(project_dir) or not _is_inside(project_dir, year_dir) or os.path.realpath(project_dir) == os.path.realpath(year_dir):
        return None
    root = os.path.join(project_dir, TV_CONTENT_DIR, IMAGES_DIR)
    if not _is_inside(root, PORTAL_ROOT):
        return None
    return root


def _valid_folder(folder):
    return isinstance(folder, str) and FOLDER_PATTERN.match(folder) is not None and folder != ARCHIVE_DIR and '..' not in folder


def _valid_file(name):
    return isinstance(name, str) and FILE_PATTERN.match(name) is not None and '..' not in name


def _target(root, folder, name):
    """root/folder/name when both parts are allowed and it stays inside root, else None."""
    if not _valid_folder(folder) or not _valid_file(name):
        return None
    path = os.path.join(root, folder, name)
    if not _is_inside(os.path.dirname(path), root):
        return None
    return path


def _refuse(message, status=400):
    return jsonify({'error': message}), status


def _sniff_type(data):
    """The picture type the bytes actually are, or None."""
    if len(data) >= 12 and data[0:4] == b'RIFF' and data[8:12] == b'WEBP':
        return 'webp'
    if len(data) >= 8 and data[0:8] == b'\x89PNG\r\n\x1a\n':
        return 'png'
    if len(data) >= 3 and data[0:3] == b'\xff\xd8\xff':
        return 'jpg'
    return None


def _sha256_of_file(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def _replace_with_retry(source, target):
    """os.replace, retried briefly while a reader holds the target open."""
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


def _copy_file(source, target):
    """Copy through a temp file beside the target, so a half copy is never seen."""
    directory = os.path.dirname(os.path.abspath(target))
    os.makedirs(directory, exist_ok=True)
    handle, temp_path = tempfile.mkstemp(prefix=os.path.basename(target) + '.', suffix='.copying', dir=directory)
    os.close(handle)
    try:
        shutil.copy2(source, temp_path)
        _replace_with_retry(temp_path, target)
    except BaseException:
        try:
            os.remove(temp_path)
        except OSError:
            pass
        raise


def _walk_pictures(root, include_archive):
    """Every picture file under root as (folder_relative, name, full_path); archive last."""
    found = []
    archived = []
    for current, directories, files in os.walk(root):
        directories.sort()
        relative = os.path.relpath(current, root).replace('\\', '/')
        in_archive = relative == ARCHIVE_DIR or relative.startswith(ARCHIVE_DIR + '/')
        if in_archive and not include_archive:
            directories[:] = []
            continue
        if relative == '.':
            continue                                                     # <-- Nothing is filed in the images folder itself
        for name in sorted(files):
            if not FILE_PATTERN.match(name):
                continue
            entry = (relative, name, os.path.join(current, name))
            (archived if in_archive else found).append(entry)
    return found + archived

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Routes - Reading
# -----------------------------------------------------------------------------

@truevision_sheet_images_api.route('/api/truevision/sheet-images/list')
def sheet_images_list():
    """Every picture under the images folder, the archive included and marked."""
    project_folder, year_code = _context()
    root = _images_root(project_folder, year_code)
    if not root:
        return _refuse(f'Project not found: {project_folder} ({year_code})', 404)
    if not os.path.isdir(root):
        return jsonify({'status': 'ok', 'root': IMAGES_DIR, 'exists': False, 'entries': []})

    entries = []
    for relative, name, full in _walk_pictures(root, include_archive=True):
        try:
            stat = os.stat(full)
        except OSError:
            continue
        entries.append({
            'folder'   : relative,
            'file'     : name,
            'bytes'    : stat.st_size,
            'modified' : datetime.fromtimestamp(stat.st_mtime, timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'managed'  : MANAGED_PATTERN.match(name) is not None,
            'archived' : relative == ARCHIVE_DIR or relative.startswith(ARCHIVE_DIR + '/')
        })
    return jsonify({'status': 'ok', 'root': IMAGES_DIR, 'exists': True, 'entries': entries})

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Routes - Writing
# -----------------------------------------------------------------------------

@truevision_sheet_images_api.route('/api/truevision/sheet-images/upload', methods=['POST', 'PUT'])
def sheet_images_upload():
    """
    One stored picture, as raw bytes, into 05__Layout__DrawingDocs__Images/<folder>/<name>.
    The images folder and the document folder are made on the way. The same
    name with the same bytes already there is success (created: false); the
    same name with different bytes is refused - it cannot happen to a name
    that carries its own hash, so it means something is wrong.
    """
    project_folder, year_code = _context()
    root = _images_root(project_folder, year_code)
    if not root:
        return _refuse(f'Project not found: {project_folder} ({year_code})', 404)

    folder = (request.args.get('folder') or '').strip()
    name = (request.args.get('name') or '').strip()
    target = _target(root, folder, name)
    if not target:
        return _refuse(f'Refused picture path "{folder}/{name}"')

    length = request.content_length
    if length is not None and length > MAX_IMAGE_BYTES:
        return _refuse('That picture is larger than this route will take', 413)
    data = request.get_data(cache=False)
    if not data:
        return _refuse('No picture in the request')
    if len(data) > MAX_IMAGE_BYTES:
        return _refuse('That picture is larger than this route will take', 413)

    kind = _sniff_type(data)
    if not kind:
        return _refuse('Those bytes are not a WebP, PNG or JPEG picture')
    extension = name.rsplit('.', 1)[-1].lower().replace('jpeg', 'jpg')
    if extension != kind:
        return _refuse(f'The picture is a {kind.upper()} but is named .{extension}')

    digest = hashlib.sha256(data).hexdigest()
    managed = MANAGED_PATTERN.match(name)
    if managed and managed.group(1) != digest[:10]:
        return _refuse('The bytes do not match the hash in the picture\'s name')

    if os.path.exists(target):
        try:
            same = os.path.getsize(target) == len(data) and _sha256_of_file(target) == digest
        except OSError:
            same = False
        if same:
            return jsonify({'status': 'ok', 'folder': folder, 'file': name, 'bytes': len(data), 'created': False, 'sha256': digest})
        return _refuse(f'A different picture is already stored as "{folder}/{name}"', 409)

    try:
        _write_bytes(target, data)
    except Exception as error:                                                  # noqa: BLE001 - reported, never raised at the browser
        print(f'[SheetImages] Failed to write {target}')
        print(f'[SheetImages] {type(error).__name__}: {error}')
        return _refuse('Failed to write the picture', 500)

    print(f'[SheetImages] Stored {folder}/{name} ({len(data)} bytes)')
    return jsonify({
        'status'  : 'ok',
        'folder'  : folder,
        'file'    : name,
        'bytes'   : len(data),
        'created' : True,
        'sha256'  : digest,
        'written' : _now_iso()
    })


@truevision_sheet_images_api.route('/api/truevision/sheet-images/reconcile', methods=['POST'])
def sheet_images_reconcile():
    """
    Body: { keep: [{ folder, file, from: [folder, ...] }], archive: bool }.

    Every picture in keep is made to exist in its folder: left alone when it
    is there, otherwise copied from the first folder in `from` that has it,
    otherwise from anywhere under the images folder - the archive last. A
    copy, never a move, because an undo can point a drawing back at the old
    folder at any moment until the save has written the new one.

    With archive, every picture this feature stored that is NOT in keep is
    then moved into 00__Archive/<folder>/, and document folders left empty are
    removed. The editor asks for that only after the drawings are written.
    """
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return _refuse('Request body must be a JSON object')

    project_folder, year_code = _context()
    root = _images_root(project_folder, year_code)
    if not root:
        return _refuse(f'Project not found: {project_folder} ({year_code})', 404)

    keep = body.get('keep') if isinstance(body.get('keep'), list) else []
    if len(keep) > MAX_KEEP_ITEMS:
        return _refuse('Too many pictures in one reconcile')
    archive = body.get('archive') is True

    if not keep and not os.path.isdir(root):
        return jsonify({'status': 'ok', 'results': [], 'archived': [], 'removedFolders': []})

    index = None                                                               # <-- Built on first need: name -> [ (folder, full path) ], archive last
    results = []
    wanted = set()
    for item in keep:
        if not isinstance(item, dict):
            continue
        folder = item.get('folder')
        name = item.get('file')
        target = _target(root, folder, name)
        if not target:
            results.append({'folder': folder, 'file': name, 'state': 'refused'})
            continue
        wanted.add((folder, name))
        if os.path.isfile(target):
            results.append({'folder': folder, 'file': name, 'state': 'present'})
            continue

        source = None
        for hint in (item.get('from') if isinstance(item.get('from'), list) else []):
            candidate = _target(root, hint, name) if isinstance(hint, str) else None
            if candidate and os.path.isfile(candidate):
                source = (hint, candidate)
                break
        if not source and os.path.isdir(root):
            if index is None:
                index = {}
                for relative, found_name, full in _walk_pictures(root, include_archive=True):
                    index.setdefault(found_name, []).append((relative, full))
            options = index.get(name) or []
            if options:
                source = options[0]
        if not source:
            results.append({'folder': folder, 'file': name, 'state': 'missing'})
            continue

        try:
            _copy_file(source[1], target)
        except Exception as error:                                              # noqa: BLE001
            print(f'[SheetImages] Failed to copy {source[1]} -> {target}')
            print(f'[SheetImages] {type(error).__name__}: {error}')
            results.append({'folder': folder, 'file': name, 'state': 'failed', 'source': source[0]})
            continue
        print(f'[SheetImages] Filed {name} under {folder} (from {source[0]})')
        results.append({'folder': folder, 'file': name, 'state': 'copied', 'source': source[0]})

    archived = []
    removed_folders = []
    if archive and os.path.isdir(root):
        for relative, name, full in _walk_pictures(root, include_archive=False):
            if (relative, name) in wanted or '/' in relative or not MANAGED_PATTERN.match(name):
                continue                                                       # <-- In use, nested oddly, or not ours: left exactly where it is
            destination = os.path.join(root, ARCHIVE_DIR, relative, name)
            try:
                if os.path.exists(destination):
                    if os.path.getsize(destination) == os.path.getsize(full):
                        os.remove(full)                                        # <-- The archive already holds this very picture
                    else:
                        stem, suffix = os.path.splitext(destination)
                        count = 2
                        while os.path.exists(f'{stem}__{count:02d}{suffix}') and count < 100:
                            count += 1
                        os.makedirs(os.path.dirname(destination), exist_ok=True)
                        _replace_with_retry(full, f'{stem}__{count:02d}{suffix}')
                else:
                    os.makedirs(os.path.dirname(destination), exist_ok=True)
                    _replace_with_retry(full, destination)
                archived.append(f'{relative}/{name}')
            except Exception as error:                                          # noqa: BLE001
                print(f'[SheetImages] Could not archive {full}: {type(error).__name__}: {error}')
        for entry in sorted(os.listdir(root)):
            path = os.path.join(root, entry)
            if entry == ARCHIVE_DIR or not os.path.isdir(path):
                continue
            try:
                if not os.listdir(path):
                    os.rmdir(path)
                    removed_folders.append(entry)
            except OSError:
                pass
        if archived:
            print(f'[SheetImages] Archived {len(archived)} picture(s) no drawing uses: {", ".join(archived[:6])}{"..." if len(archived) > 6 else ""}')

    return jsonify({'status': 'ok', 'results': results, 'archived': archived, 'removedFolders': removed_folders})

# endregion -------------------------------------------------------------------
