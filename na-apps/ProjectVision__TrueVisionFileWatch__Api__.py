#!/usr/bin/env python3
# =============================================================================
# PROJECTVISION LOCAL SERVER - TRUEVISION LOCAL FILE PARITY API
# =============================================================================
#
# FILE       : ProjectVision__TrueVisionFileWatch__Api__.py
# NAMESPACE  : ProjectVision
# MODULE     : TrueVision Local File Parity - File Versions, File Watch and the Write Guard
# AUTHOR     : Adam Noble - Noble Architecture
# PURPOSE    : Tell the app when a project's data files change on disk outside it, and refuse a write that would overwrite such a change unseen
# CREATED    : 22-Sep-2026
#
# DESCRIPTION:
# - THE FAULT. An agent edits TrueVision__DrawingNotes__.json (or the project
#   data, or a statement) on disk while the app is open. The app still holds
#   the copy it loaded, and the next Save Sheets, Sync or quiet statement save
#   writes that older copy straight over the agent's work. Nothing on either
#   side could tell the two apart: the write routes took whatever they were
#   sent. ("It's too easy to save over the agent's work, as I keep doing" -
#   Adam, 22-Sep-2026.)
# - VERSIONS ARE CONTENT, NOT CLOCKS. A file's version is the first 16 hex
#   digits of the SHA-1 of its bytes, so a file rewritten with the same
#   content keeps its version (no false alarm) and any real edit gets a new
#   one whatever the clock says. A missing file's version is 'missing'.
#   Hashing is cached on (mtime, size) and redone only when either moves.
# - WHAT IS WATCHED. Per project, under 30__TrueVision__AppContent: the three
#   data files the app writes - TrueVision__ProjectData__.json,
#   TrueVision__DrawingNotes__.json and TrueVision__StatementDocs__.json - and
#   every markdown file under 10__StatementDocs. A JSON file also reports a
#   hash per top-level key, so the app can say WHICH part of the project data
#   moved (model groups from a build sync are not the drawings a save writes),
#   its stamp, and a count or two for the modal.
# - THE STATE ROUTE. GET /api/truevision/file-watch/state answers every
#   watched file's version, size, modified time and the last write any
#   TrueVision window made to it through this server. The app polls it.
# - EVERY READ AND EVERY WRITE IS STAMPED. A successful read of a watched file
#   (the static route, or the sibling-file route) and a successful write of
#   one (the project-data, sibling-file and statement-file routes) carry the
#   file's version in X-Na-File-Version, so the app knows exactly which
#   version it loaded and which one its own save produced. A write's JSON
#   answer also gains fileVersion. A write is remembered with the window that
#   made it (X-Na-Client-Id), so another TrueVision window's save is named as
#   such rather than blamed on an agent.
# - THE WRITE GUARD. A write that says which version it was made from
#   (X-Na-Base-Version) is refused with 409 when the file on disk is no longer
#   that version: someone else changed it since the window read it, and the
#   write would bury that change. A write that names no base is let through
#   exactly as before, so an older app and every other caller are unaffected.
# - NOTHING HERE WRITES A FILE. It reads, hashes and answers. The routes that
#   write are the ones that always did; this only stands in front of them and
#   stamps what they did.
#
# INTEGRATION:
# - Registered by ProjectVision__LocalServer__Main__ alongside the scrapbook,
#   statement and sheet-image blueprints. Its before/after hooks are app-wide
#   (before_app_request / after_app_request) because the routes it guards and
#   stamps belong to the main module and to the statements blueprint.
# - Read by 63__System__LocalFileParity/Na__FileParity__Watcher__.js (the
#   poll and the modal) and Na__FileParity__Registry__.js (the headers).
# - THE SERVER DOES NOT RELOAD ITS ROUTES. Started without --debug it keeps
#   the routes it started with; the app treats a missing state route as "file
#   watch off" and says the server needs a restart.
#
# -----------------------------------------------------------------------------
#
# DEVELOPMENT LOG:
# 22-Sep-2026 - Version 1.0.0
# - Initial implementation: file versions, the state route, read and write
#   stamps, the app-write register and the base-version write guard.
#
# =============================================================================


# #region ---------------------------------------------------------------------
# REGION | Imports
# -----------------------------------------------------------------------------

import hashlib
import json
import os
import re
import threading
import time

from collections import OrderedDict

from flask import Blueprint, jsonify, request

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Configuration
# -----------------------------------------------------------------------------

SCRIPT_DIR              = os.path.dirname(os.path.abspath(__file__))
PORTAL_ROOT             = os.path.abspath(os.path.join(SCRIPT_DIR, '..', 'na-project-portal'))   # <-- Read at call time, so a test can point it elsewhere
PORTAL_URL_PREFIX       = '/na-project-portal/'

TV_CONTENT_DIR          = '30__TrueVision__AppContent'
STATEMENTS_DIR          = '10__StatementDocs'

DATA_FILES              = (                                                   # <-- (key the app uses, file name), in the order the modal lists them
    ('project-data',    'TrueVision__ProjectData__.json'),
    ('drawing-notes',   'TrueVision__DrawingNotes__.json'),
    ('statement-index', 'TrueVision__StatementDocs__.json'),
)
DATA_FILE_KEYS          = {name: key for key, name in DATA_FILES}
STAMP_KEYS              = {                                                   # <-- The key inside each document that holds its own saved-at stamp
    'drawing-notes'   : 'ProjectSpecification__UpdatedIso',
    'statement-index' : 'Statement__UpdatedIso',
}
STATEMENT_PREFIX        = 'statement:'                                        # <-- A statement file's key: statement:<path inside 10__StatementDocs>
STATEMENT_SUFFIXES      = ('.md',)
MAX_STATEMENT_FILES     = 500
MAX_WALK_DEPTH          = 8
HISTORY_PER_FILE        = 16                                                  # <-- Versions remembered per data file, so a poll can say what moved since the window's own

YEAR_PATTERN            = re.compile(r'^\d{2}$')
YEAR_FOLDER_PATTERN     = re.compile(r'^\d{2}-Projects$')
FOLDER_PATTERN          = re.compile(r'^[A-Za-z0-9_\-.]{1,120}$')
SEGMENT_PATTERN         = re.compile(r'^[A-Za-z0-9_\-. &()\[\]]{1,140}$')   # <-- The statements blueprint's own rule for a path segment
PROJECT_ROUTE           = re.compile(r'^/api/projects/[A-Za-z]{2}[0-9]{2}$')
SIBLING_ROUTE           = re.compile(r'^/api/projects/[A-Za-z]{2}[0-9]{2}/files/(?P<name>[^/]+)$')
STATEMENT_FILE_ROUTE    = '/api/truevision/statements/file'

HEADER_VERSION          = 'X-Na-File-Version'
HEADER_MTIME            = 'X-Na-File-Mtime-Ms'
HEADER_BASE             = 'X-Na-Base-Version'
HEADER_CLIENT           = 'X-Na-Client-Id'
MISSING_VERSION         = 'missing'
CLIENT_PATTERN          = re.compile(r'^[A-Za-z0-9_\-]{1,64}$')

API_VERSION             = 1

truevision_file_watch_api = Blueprint('truevision_file_watch_api', __name__)

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Module State
# -----------------------------------------------------------------------------
#
# The development server answers requests on threads, so both registers sit
# behind one lock. Both live only as long as the server process: a restart
# forgets which window wrote what, and the app then names a write it did not
# make as "outside TrueVision" - the cautious reading.
#
# -----------------------------------------------------------------------------

_LOCK                   = threading.Lock()
_STATE_CACHE            = {}                                                  # <-- real path -> ((mtime_ns, size), state)
_APP_WRITES             = {}                                                  # <-- real path -> { version, atMs, clientId }
_HISTORY                = {}                                                  # <-- real path -> OrderedDict(version -> { keys, summary, stamp, size })

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Paths
# -----------------------------------------------------------------------------

def _now_ms():
    """Milliseconds since the epoch, the unit the app keeps its times in."""
    return int(time.time() * 1000)


def _is_inside(candidate_path, parent_path):
    """True when candidate_path resolves to somewhere inside parent_path."""
    parent = os.path.realpath(parent_path)
    candidate = os.path.realpath(candidate_path)
    return candidate == parent or candidate.startswith(parent + os.sep)


def _content_dir(project_folder, year_code):
    """
    The project's 30__TrueVision__AppContent folder, or None. The year named
    is tried first; only when the project is not filed there are the other
    NN-Projects folders searched, as the main module's project-data route
    does, so a project filed under another year is still found.
    """
    folder = (project_folder or '').strip()
    if not FOLDER_PATTERN.match(folder) or folder in ('.', '..'):
        return None

    def candidate(year_folder):
        path = os.path.join(PORTAL_ROOT, year_folder, folder, TV_CONTENT_DIR)
        return path if os.path.isdir(path) and _is_inside(path, PORTAL_ROOT) else None

    named = f'{str(year_code).strip()}-Projects' if YEAR_PATTERN.match(str(year_code or '').strip()) else None
    if named:
        found = candidate(named)
        if found:
            return found
    try:
        others = [name for name in sorted(os.listdir(PORTAL_ROOT)) if YEAR_FOLDER_PATTERN.match(name) and name != named]
    except OSError:
        return None
    for year_folder in others:
        found = candidate(year_folder)
        if found:
            return found
    return None


def _statement_path(content_dir, relative_path):
    """
    A path inside 10__StatementDocs, or None. Checked segment by segment and
    again after resolution, the statements blueprint's own rule, so neither ..
    nor a link gets out.
    """
    if content_dir is None or relative_path is None:
        return None
    text = str(relative_path).replace('\\', '/').strip().strip('/')
    segments = [segment for segment in text.split('/') if segment != '']
    if not segments or len(segments) > MAX_WALK_DEPTH:
        return None
    for segment in segments:
        if segment in ('.', '..') or not SEGMENT_PATTERN.match(segment):
            return None
    root = os.path.join(content_dir, STATEMENTS_DIR)
    target = os.path.join(root, *segments)
    if not _is_inside(target, root):
        return None
    return target


def _relative_statement(content_dir, absolute_path):
    """A statement file's path inside 10__StatementDocs, with forward slashes."""
    root = os.path.join(content_dir, STATEMENTS_DIR)
    return os.path.relpath(absolute_path, root).replace('\\', '/')

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | File State
# -----------------------------------------------------------------------------

def _hash_bytes(data):
    """A file's version: the first 16 hex digits of the SHA-1 of its bytes."""
    return hashlib.sha1(data).hexdigest()[:16]


def _hash_value(value):
    """A top-level JSON key's fingerprint: its canonical text, hashed."""
    text = json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':'))
    return hashlib.sha1(text.encode('utf-8')).hexdigest()[:12]


def _summary(key, document):
    """A count or two for the modal to put beside the file's name."""
    try:
        if key == 'project-data':
            block = document.get('LayoutEditor__DrawingsData') or {}
            sheets = block.get('LayoutEditor__DrawingsData__Sheets')
            return {'sheets': len(sheets)} if isinstance(sheets, list) else None
        if key == 'drawing-notes':
            groups = document.get('ProjectSpecification__Groups')
            if not isinstance(groups, list):
                return None
            notes = sum(len(group.get('Group__Notes') or []) for group in groups if isinstance(group, dict))
            return {'groups': len(groups), 'notes': notes}
        if key == 'statement-index':
            documents = document.get('Statement__Documents')
            return {'documents': len(documents)} if isinstance(documents, list) else None
    except (AttributeError, TypeError):
        return None
    return None


def _missing_state():
    return {
        'exists'  : False,
        'size'    : 0,
        'mtimeMs' : None,
        'version' : MISSING_VERSION,
        'valid'   : True,
        'keys'    : None,
        'stamp'   : None,
        'summary' : None,
    }


def file_state(path):
    """
    { exists, size, mtimeMs, version, valid, keys, stamp, summary } for one
    file. Cached on (mtime, size); a file that moves while it is being read is
    answered but not cached, so the next ask reads it again whole. Which stamp
    and counts a JSON file reports follows from its name, so the cache holds
    one answer per file whoever asks.
    """
    try:
        before = os.stat(path)
    except OSError:
        return _missing_state()
    if not os.path.isfile(path):
        return _missing_state()

    signature = (before.st_mtime_ns, before.st_size)
    real_path = os.path.realpath(path)
    with _LOCK:
        cached = _STATE_CACHE.get(real_path)
        if cached and cached[0] == signature:
            return dict(cached[1])

    try:
        with open(path, 'rb') as file_handle:
            data = file_handle.read()
    except OSError:
        return _missing_state()

    state = {
        'exists'  : True,
        'size'    : len(data),
        'mtimeMs' : before.st_mtime_ns // 1_000_000,
        'version' : _hash_bytes(data),
        'valid'   : True,
        'keys'    : None,
        'stamp'   : None,
        'summary' : None,
    }

    if path.lower().endswith('.json'):
        try:
            document = json.loads(data.decode('utf-8-sig'))
        except (ValueError, UnicodeDecodeError):
            state['valid'] = False                                            # <-- Mid-write, or broken: the modal says so
        else:
            if isinstance(document, dict):
                state['keys'] = {name: _hash_value(value) for name, value in document.items()}
                key = DATA_FILE_KEYS.get(os.path.basename(path))
                stamp_key = STAMP_KEYS.get(key)
                if stamp_key and isinstance(document.get(stamp_key), str):
                    state['stamp'] = document[stamp_key]
                state['summary'] = _summary(key, document)
            else:
                state['valid'] = False                                        # <-- Every file the app writes is a JSON object

    try:
        after = os.stat(path)
        settled = (after.st_mtime_ns, after.st_size) == signature
    except OSError:
        settled = False
    with _LOCK:
        if settled:
            _STATE_CACHE[real_path] = (signature, dict(state))
        if state['keys'] is not None or state['summary'] is not None:
            history = _HISTORY.setdefault(real_path, OrderedDict())
            history[state['version']] = {
                'keys'    : state['keys'],
                'summary' : state['summary'],
                'stamp'   : state['stamp'],
                'size'    : state['size'],
            }
            history.move_to_end(state['version'])
            while len(history) > HISTORY_PER_FILE:
                history.popitem(last=False)
    return state


def _remembered(path, version):
    """What an earlier version of a data file held, if this server read it."""
    with _LOCK:
        entry = (_HISTORY.get(os.path.realpath(path)) or {}).get(version)
        return dict(entry) if entry else None


def _last_app_write(path):
    with _LOCK:
        entry = _APP_WRITES.get(os.path.realpath(path))
        return dict(entry) if entry else None


def _record_app_write(path, client_id):
    """Remember that a TrueVision window wrote this file, and what it wrote."""
    state = file_state(path)
    entry = {'version': state['version'], 'atMs': _now_ms(), 'clientId': client_id or None}
    with _LOCK:
        _APP_WRITES[os.path.realpath(path)] = entry
    return state

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Which Watched File a Request Touches
# -----------------------------------------------------------------------------

def _context():
    """The project folder and year from the query string, else the JSON body."""
    body = request.get_json(silent=True) if request.is_json else None
    body = body if isinstance(body, dict) else {}
    folder = request.args.get('project-folder') or request.args.get('project_folder') or body.get('projectFolder') or ''
    year = request.args.get('year') or body.get('year') or ''
    return str(folder).strip(), str(year).strip()


def _static_target(path):
    """
    A static read of a watched file:
      /na-project-portal/<yy>-Projects/<folder>/30__TrueVision__AppContent/<data file>
      /na-project-portal/<yy>-Projects/<folder>/30__TrueVision__AppContent/10__StatementDocs/<...>.md
    Answers (absolute path, key) or None. Every other file under a project -
    pictures, models, anything - is turned away on its URL alone, before the
    disk is touched, because this runs on every static request.
    """
    if not path.startswith(PORTAL_URL_PREFIX):
        return None
    parts = path[len(PORTAL_URL_PREFIX):].split('/')                         # <-- request.path arrives percent-decoded already
    if len(parts) < 4 or not YEAR_FOLDER_PATTERN.match(parts[0]) or parts[2] != TV_CONTENT_DIR:
        return None
    rest = parts[3:]
    is_data = len(rest) == 1 and rest[0] in DATA_FILE_KEYS
    is_statement = len(rest) >= 2 and rest[0] == STATEMENTS_DIR and rest[-1].lower().endswith(STATEMENT_SUFFIXES)
    if not (is_data or is_statement) or not FOLDER_PATTERN.match(parts[1]) or parts[1] in ('.', '..'):
        return None

    content_dir = os.path.join(PORTAL_ROOT, parts[0], parts[1], TV_CONTENT_DIR)  # <-- The URL names the exact folder: no year search for a read
    if not os.path.isdir(content_dir) or not _is_inside(content_dir, PORTAL_ROOT):
        return None
    if is_data:
        return os.path.join(content_dir, rest[0]), DATA_FILE_KEYS[rest[0]]
    target = _statement_path(content_dir, '/'.join(rest[1:]))
    return (target, STATEMENT_PREFIX + _relative_statement(content_dir, target)) if target else None


def _write_target():
    """
    A write of a watched file through one of the app's routes. Answers
    (absolute path, key) or None. The project folder and year are the ones
    the app sends with every write; without them the file cannot be named
    and the write is left alone, exactly as before this module.
    """
    if request.method != 'POST':
        return None
    folder, year = _context()

    if PROJECT_ROUTE.match(request.path):
        content_dir = _content_dir(folder, year)
        return (os.path.join(content_dir, 'TrueVision__ProjectData__.json'), 'project-data') if content_dir else None

    sibling = SIBLING_ROUTE.match(request.path)
    if sibling:
        name = sibling.group('name')
        if name not in DATA_FILE_KEYS:
            return None
        content_dir = _content_dir(folder, year)
        return (os.path.join(content_dir, name), DATA_FILE_KEYS[name]) if content_dir else None

    if request.path == STATEMENT_FILE_ROUTE:
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return None
        content_dir = _content_dir(folder, year)
        target = _statement_path(content_dir, body.get('path'))
        if not target or not target.lower().endswith(STATEMENT_SUFFIXES):
            return None
        return target, STATEMENT_PREFIX + _relative_statement(content_dir, target)

    return None


def _read_target():
    """A read of a watched file: the static route or the sibling-file route."""
    if request.method not in ('GET', 'HEAD'):
        return None
    static = _static_target(request.path)
    if static:
        return static
    sibling = SIBLING_ROUTE.match(request.path)
    if sibling:
        name = sibling.group('name')
        if name in DATA_FILE_KEYS:
            folder, year = _context()
            content_dir = _content_dir(folder, year)
            if content_dir:
                return os.path.join(content_dir, name), DATA_FILE_KEYS[name]
    return None


def _client_id():
    value = (request.headers.get(HEADER_CLIENT) or '').strip()
    return value if CLIENT_PATTERN.match(value) else None

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | The Write Guard and the Stamps (app-wide hooks)
# -----------------------------------------------------------------------------

@truevision_file_watch_api.before_app_request
def guard_watched_write():
    """
    Refuse a write made from a version that is no longer the one on disk.
    Only a write that names its base is judged; any other passes untouched.
    """
    base = (request.headers.get(HEADER_BASE) or '').strip()
    if not base:
        return None
    try:
        target = _write_target()
    except Exception:                                                         # noqa: BLE001 - the guard must never be the thing that breaks a save
        return None
    if not target:
        return None

    path, key = target
    state = file_state(path)
    if state['version'] == base:
        return None

    last = _last_app_write(path)
    by_window = bool(last and last['version'] == state['version'])
    who = 'another TrueVision window' if by_window else 'another program (an agent, an editor or a sync)'
    name = os.path.basename(path)
    print(f'[FileWatch] Refused a write of {name}: it changed on disk since this window read it '
          f'(window had {base}, disk has {state["version"]}, changed by {who}).')
    response = jsonify({
        'error'       : f'{name} was changed on disk by {who} since this window read it. '
                        f'It was NOT overwritten: load the new version first (Local File Updates Detected).',
        'conflict'    : True,
        'key'         : key,
        'fileName'    : name,
        'baseVersion' : base,
        'file'        : dict(state, lastAppWrite=last),
    })
    response.status_code = 409
    response.headers['Cache-Control'] = 'no-store'
    return response


@truevision_file_watch_api.after_app_request
def stamp_watched_file(response):
    """
    Put the file's version on every successful read and write of a watched
    file, remember a write as the app's own, and add fileVersion to a write's
    JSON answer. Never changes a failed response.
    """
    try:
        if response.status_code in (200, 304) and request.method in ('GET', 'HEAD'):
            target = _read_target()
            if target:
                state = file_state(target[0])
                response.headers[HEADER_VERSION] = state['version']
                if state['mtimeMs'] is not None:
                    response.headers[HEADER_MTIME] = str(state['mtimeMs'])
            return response

        if response.status_code == 200 and request.method == 'POST':
            target = _write_target()
            if not target:
                return response
            state = _record_app_write(target[0], _client_id())
            response.headers[HEADER_VERSION] = state['version']
            if state['mtimeMs'] is not None:
                response.headers[HEADER_MTIME] = str(state['mtimeMs'])
            if response.mimetype == 'application/json':
                response.direct_passthrough = False
                answer = json.loads(response.get_data(as_text=True) or 'null')
                if isinstance(answer, dict):
                    answer['fileVersion'] = state['version']
                    response.set_data(json.dumps(answer))
    except Exception as error:                                                # noqa: BLE001 - a stamp is a courtesy; the answer goes out regardless
        print(f'[FileWatch] Could not stamp {request.path}: {type(error).__name__}: {error}')
    return response

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | The State Route
# -----------------------------------------------------------------------------

def _statement_files(content_dir):
    """Every markdown file under 10__StatementDocs, capped, in a stable order."""
    root = os.path.join(content_dir, STATEMENTS_DIR)
    if not os.path.isdir(root):
        return []
    found = []
    for current, folders, files in os.walk(root):
        depth = 0 if current == root else os.path.relpath(current, root).count(os.sep) + 1
        folders.sort()
        if depth >= MAX_WALK_DEPTH:
            folders[:] = []
        for name in sorted(files):
            if name.lower().endswith(STATEMENT_SUFFIXES):
                found.append(os.path.join(current, name))
                if len(found) >= MAX_STATEMENT_FILES:
                    return found
    return found


def _entry(content_dir, path, key, kind, base_version=None):
    state = file_state(path)
    relative = os.path.relpath(path, content_dir).replace(os.sep, '/')
    entry = dict(
        state,
        key          = key,
        kind         = kind,
        name         = os.path.basename(path),
        path         = relative,
        lastAppWrite = _last_app_write(path),
    )
    if base_version and base_version != state['version']:
        before = _remembered(path, base_version)                              # <-- What the window's own version held: the modal says what moved
        if before:
            entry['baseKeys'] = before['keys']
            entry['baseSummary'] = before['summary']
            entry['baseStamp'] = before['stamp']
            entry['baseSize'] = before['size']
    return entry


def _base_versions():
    """The window's base version of each data file: ?base=project-data:<v>,drawing-notes:<v>."""
    wanted = {}
    for pair in (request.args.get('base') or '').split(','):
        key, _, version = pair.strip().rpartition(':')
        if key in DATA_FILE_KEYS.values() and re.match(r'^[0-9a-f]{16}$', version):
            wanted[key] = version
    return wanted


@truevision_file_watch_api.route('/api/truevision/file-watch/state')
def file_watch_state():
    """
    The version of every watched file in one project, for the app's poll.
    Query: project-folder=<RB05__WestFarm>&year=<26>, and optionally
    base=<key>:<version>,... - the versions the window holds - so a data file
    that has moved also answers what the window's version held (baseKeys,
    baseSummary, baseStamp, baseSize), when this server has read it.
    """
    folder, year = _context()
    content_dir = _content_dir(folder, year)
    if not content_dir:
        response = jsonify({'ok': False, 'error': f'Project not found: {folder} ({year})'})
        response.status_code = 404
        response.headers['Cache-Control'] = 'no-store'
        return response

    bases = _base_versions()
    files = [_entry(content_dir, os.path.join(content_dir, name), key, 'data', bases.get(key)) for key, name in DATA_FILES]
    for path in _statement_files(content_dir):
        files.append(_entry(content_dir, path, STATEMENT_PREFIX + _relative_statement(content_dir, path), 'statement'))

    response = jsonify({
        'ok'            : True,
        'service'       : 'file-watch',
        'apiVersion'    : API_VERSION,
        'serverTimeMs'  : _now_ms(),
        'projectFolder' : folder,
        'year'          : year,
        'files'         : files,
    })
    response.headers['Cache-Control'] = 'no-store'
    return response

# endregion -------------------------------------------------------------------
