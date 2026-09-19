#!/usr/bin/env python3
# =============================================================================
# NOBLE ARCHITECTURE - TRUEVISION CUSTOM SCRAPBOOK API (FLASK BLUEPRINT)
# =============================================================================
#
# FILE       : ProjectVision__TrueVisionScrapbook__Api__.py
# MODULE     : TrueVisionScrapbookApi
# AUTHOR     : Adam Noble - Noble Architecture
# PURPOSE    : Save, list and delete the TrueVision Layout Editor's Custom Scrapbook items
# CREATED    : 19-Sep-2026
#
# DESCRIPTION:
# - The Custom Scrapbook is a folder of JSON files, one per item, in category
#   folders under:
#       na-apps/30__TrueVision__CoreAppCode/51__LayoutEditor__UserScrapbookContent/
#   A browser cannot write a file, so the app saves through these routes.
# - Registered by ProjectVision__LocalServer__Main__.py. Localhost only; the
#   public website has no such server, and there the library is read-only.
# - Every change rewrites UserScrapbook__Index__.json at the folder's root
#   FROM WHAT IS ACTUALLY IN THE FOLDERS, so a file Adam adds, renames or
#   removes by hand is picked up on the next read. The index is what lets the
#   live website list the library, which has no directory listing to read.
#
# WHAT THIS MODULE WILL AND WILL NOT WRITE:
# - It saves only into category folders that already exist and are named
#   NN__ScrapbookItems__Name. It never creates a category: the folders are
#   Adam's, and a typo in a request must not grow the tree.
# - It names every file itself, UserScrapbookItem__<Name>__<yyyymmdd-hhmmss>.json,
#   from a sanitised name. Nothing in a request is ever used as a path.
# - A delete never unlinks. The file moves to 00__Deleted__Quarantine inside
#   the scrapbook folder - the Project Manager's rule - where the index does
#   not look, and stays on disk until the folder is emptied by hand.
#
# ROUTES:
#   GET  /api/truevision/scrapbook                  the index, rebuilt first
#   POST /api/truevision/scrapbook/items            { category, name, item }
#   POST /api/truevision/scrapbook/items/delete     { file }  'Category/File.json'
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
import json
import shutil
import traceback

from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Configuration
# -----------------------------------------------------------------------------

SCRIPT_DIR              = os.path.dirname(os.path.abspath(__file__))
TRUEVISION_APP_DIR      = os.path.join(SCRIPT_DIR, '30__TrueVision__CoreAppCode')
SCRAPBOOK_DIR           = os.path.join(TRUEVISION_APP_DIR, '51__LayoutEditor__UserScrapbookContent')

INDEX_FILE_NAME         = 'UserScrapbook__Index__.json'
QUARANTINE_DIR_NAME     = '00__Deleted__Quarantine'                  # <-- Outside the category pattern, so the index never lists it
CATEGORY_PATTERN        = re.compile(r'^[0-9]{2}__ScrapbookItems__[A-Za-z0-9]{1,60}$')
ITEM_FILE_PATTERN       = re.compile(r'^UserScrapbookItem__[A-Za-z0-9]{1,60}__[0-9]{8}-[0-9]{6}(?:-[0-9]{1,3})?\.json$')
ITEM_FILE_PREFIX        = 'UserScrapbookItem__'
ITEM_KEY_PREFIX         = 'UserScrapbookItem__'                      # <-- The item document's own key prefix

MAX_NAME_LENGTH         = 80
MAX_FILE_NAME_PART      = 48                                         # <-- Of the name, inside the file name
MAX_ITEM_BYTES          = 4 * 1024 * 1024                            # <-- A drawn item is kilobytes; this only stops a runaway request
MAX_ITEM_ENTRIES        = 5000
ALLOWED_ENTRY_KINDS     = frozenset({'shape', 'annotation', 'leader', 'dimension', 'group'})
ITEM_BODY_KEY_ORDER     = tuple(ITEM_KEY_PREFIX + key for key in ('SourceProject', 'SourceSheet', 'SizeMm', 'Roots', 'Entries'))   # <-- After the identity keys the server writes

truevision_scrapbook_api = Blueprint('truevision_scrapbook_api', __name__)

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Helpers
# -----------------------------------------------------------------------------

def _is_inside(candidate_path, parent_path):
    """True when candidate_path resolves to somewhere inside parent_path."""
    parent = os.path.realpath(parent_path)
    candidate = os.path.realpath(candidate_path)
    return candidate == parent or candidate.startswith(parent + os.sep)


def _now_iso():
    """The current time as the app writes it: UTC, milliseconds, Z."""
    now = datetime.now(timezone.utc)                                 # <-- Read once, so the seconds and the milliseconds are the same instant
    return now.strftime('%Y-%m-%dT%H:%M:%S.') + f'{now.microsecond // 1000:03d}Z'


def _list_categories():
    """The category folders that exist, in name order."""
    if not os.path.isdir(SCRAPBOOK_DIR):
        return []
    return sorted(
        name for name in os.listdir(SCRAPBOOK_DIR)
        if CATEGORY_PATTERN.match(name) and os.path.isdir(os.path.join(SCRAPBOOK_DIR, name))
    )


def _safe_name_part(name):
    """
    A display name as the middle of a file name: the words run together in
    PascalCase, letters and digits only. 'Drawing title + bar' gives
    'DrawingTitleBar'. Empty when nothing usable is left.
    """
    words = re.findall(r'[A-Za-z0-9]+', name or '')
    joined = ''.join(word[:1].upper() + word[1:] for word in words)
    return joined[:MAX_FILE_NAME_PART]


def _read_json(file_path):
    """Read a JSON object, or None when it is missing, unreadable or not an object."""
    try:
        with open(file_path, 'r', encoding='utf-8') as file_handle:
            data = json.load(file_handle)
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def _write_json(file_path, payload):
    """Write a JSON object with project-standard formatting."""
    with open(file_path, 'w', encoding='utf-8', newline='\n') as file_handle:
        json.dump(payload, file_handle, indent=4, ensure_ascii=False)
        file_handle.write('\n')


def _index_entry(category, file_name, item):
    """One index entry for an item file that has been read."""
    name = item.get(ITEM_KEY_PREFIX + 'Name')
    return {
        'Item__Id'         : item.get(ITEM_KEY_PREFIX + 'Id') or os.path.splitext(file_name)[0],
        'Item__Name'       : name if isinstance(name, str) and name.strip() else os.path.splitext(file_name)[0],
        'Item__Category'   : category,
        'Item__File'       : f'{category}/{file_name}',
        'Item__UpdatedIso' : item.get(ITEM_KEY_PREFIX + 'UpdatedIso') or item.get(ITEM_KEY_PREFIX + 'CreatedIso') or ''
    }


def _rebuild_index():
    """
    Rewrite the index from the folders and return it. A file that is not an
    item - wrong name, not JSON, not an object - is left where it is and left
    out. The index is only written when its items have changed, so reading the
    library never dirties the repository.
    """
    items = []
    for category in _list_categories():
        category_dir = os.path.join(SCRAPBOOK_DIR, category)
        for file_name in sorted(os.listdir(category_dir)):
            if not ITEM_FILE_PATTERN.match(file_name):
                continue
            item = _read_json(os.path.join(category_dir, file_name))
            if item is None:
                continue
            items.append(_index_entry(category, file_name, item))

    index_path = os.path.join(SCRAPBOOK_DIR, INDEX_FILE_NAME)
    existing = _read_json(index_path) or {}
    if existing.get('UserScrapbook__Index__Items') == items:
        return existing

    index = {
        'UserScrapbook__Index__Meta': {
            'Meta__FileName'    : INDEX_FILE_NAME,
            'Meta__Description' : (
                'Every item in the TrueVision Layout Editor Custom Scrapbook. Written by the ProjectVision '
                'local server (ProjectVision__TrueVisionScrapbook__Api__.py) from what is in the category '
                'folders, on every save and delete and whenever the library is read locally. Do not edit by '
                'hand: add or remove item files instead, and the next read puts this right. The live website '
                'reads this file, since it has no directory listing.'
            ),
            'Meta__Author'      : 'Adam Noble - Noble Architecture'
        },
        'UserScrapbook__Index__UpdatedIso' : _now_iso(),
        'UserScrapbook__Index__Items'      : items
    }
    if os.path.isdir(SCRAPBOOK_DIR):
        _write_json(index_path, index)
    return index


def _validate_item(item):
    """Return an error message for an item document that must not be saved, else None."""
    if not isinstance(item, dict):
        return 'The item must be a JSON object'
    entries = item.get(ITEM_KEY_PREFIX + 'Entries')
    if not isinstance(entries, list) or not entries:
        return 'The item has no entries'
    if len(entries) > MAX_ITEM_ENTRIES:
        return f'The item has more than {MAX_ITEM_ENTRIES} entries'
    for entry in entries:
        if not isinstance(entry, dict) or not isinstance(entry.get('record'), dict) or not isinstance(entry.get('id'), str):
            return 'An entry is not a { kind, id, record } object'
        if entry.get('kind') not in ALLOWED_ENTRY_KINDS:
            return f'An entry of kind "{entry.get("kind")}" cannot be saved'
    if not isinstance(item.get(ITEM_KEY_PREFIX + 'Roots'), list):
        return 'The item has no roots'
    return None


def _free_file_name(category_dir, name_part, stamp):
    """A file name nothing in the category already uses."""
    candidate = f'{ITEM_FILE_PREFIX}{name_part}__{stamp}.json'
    serial = 1
    while os.path.exists(os.path.join(category_dir, candidate)):
        candidate = f'{ITEM_FILE_PREFIX}{name_part}__{stamp}-{serial}.json'     # <-- Two saves of one name inside a second
        serial += 1
    return candidate

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Route Handlers
# -----------------------------------------------------------------------------

@truevision_scrapbook_api.route('/api/truevision/scrapbook')
def scrapbook_index():
    """The library's index, rebuilt from the folders first."""
    try:
        index = _rebuild_index()
    except Exception as error:
        traceback.print_exc()
        return jsonify({'error': f'The scrapbook index could not be built: {type(error).__name__}'}), 500

    return jsonify({
        'status'     : 'ok',
        'writable'   : os.path.isdir(SCRAPBOOK_DIR),
        'categories' : _list_categories(),
        'index'      : index
    })


@truevision_scrapbook_api.route('/api/truevision/scrapbook/items', methods=['POST'])
def scrapbook_save_item():
    """Save an item as a new file in an existing category folder."""
    if request.content_length is not None and request.content_length > MAX_ITEM_BYTES:
        return jsonify({'error': 'The item is too large to save'}), 413

    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({'error': 'Request body must be a JSON object'}), 400

    category = body.get('category')
    if not isinstance(category, str) or category not in _list_categories():
        return jsonify({'error': f'There is no scrapbook category folder "{category}"'}), 400

    name = body.get('name')
    name = name.strip()[:MAX_NAME_LENGTH] if isinstance(name, str) else ''
    name_part = _safe_name_part(name)
    if not name or not name_part:
        return jsonify({'error': 'The item needs a name with a letter or a digit in it'}), 400

    item = body.get('item')
    problem = _validate_item(item)
    if problem:
        return jsonify({'error': problem}), 400

    category_dir = os.path.join(SCRAPBOOK_DIR, category)
    if not _is_inside(category_dir, SCRAPBOOK_DIR):
        return jsonify({'error': 'Refused category path'}), 400

    now = datetime.now()
    file_name = _free_file_name(category_dir, name_part, now.strftime('%Y%m%d-%H%M%S'))
    stamp_iso = _now_iso()

    # The server owns the identity keys, so a request cannot forge them. They
    # are written first so they head the file, above the records.
    document = {
        ITEM_KEY_PREFIX + 'Meta'       : item.get(ITEM_KEY_PREFIX + 'Meta') if isinstance(item.get(ITEM_KEY_PREFIX + 'Meta'), dict) else {},
        ITEM_KEY_PREFIX + 'Id'         : os.path.splitext(file_name)[0],
        ITEM_KEY_PREFIX + 'Name'       : name,
        ITEM_KEY_PREFIX + 'Category'   : category,
        ITEM_KEY_PREFIX + 'CreatedIso' : stamp_iso,
        ITEM_KEY_PREFIX + 'UpdatedIso' : stamp_iso
    }
    document[ITEM_KEY_PREFIX + 'Meta']['Meta__FileName'] = file_name
    for key in ITEM_BODY_KEY_ORDER:                                  # <-- The order is the server's too, whatever order the request came in
        if key in item and key not in document:
            document[key] = item[key]
    for key in sorted(item.keys()):                                  # <-- Anything a later version of the app adds is kept, after the known keys
        if key not in document:
            document[key] = item[key]
    document[ITEM_KEY_PREFIX + 'Entries'] = document.pop(ITEM_KEY_PREFIX + 'Entries')   # <-- The records are the bulk of the file, so they close it

    try:
        _write_json(os.path.join(category_dir, file_name), document)
        index = _rebuild_index()
    except Exception as error:
        traceback.print_exc()
        return jsonify({'error': f'The item could not be written: {type(error).__name__}'}), 500

    print(f'[Scrapbook] Saved {category}/{file_name}')
    return jsonify({
        'status' : 'ok',
        'item'   : _index_entry(category, file_name, document),
        'index'  : index
    })


@truevision_scrapbook_api.route('/api/truevision/scrapbook/items/delete', methods=['POST'])
def scrapbook_delete_item():
    """Move an item file into the quarantine folder. Nothing is unlinked."""
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({'error': 'Request body must be a JSON object'}), 400

    relative = body.get('file')
    parts = relative.split('/') if isinstance(relative, str) else []
    if len(parts) != 2 or not CATEGORY_PATTERN.match(parts[0]) or not ITEM_FILE_PATTERN.match(parts[1]):
        return jsonify({'error': f'Refused scrapbook file "{relative}"'}), 400

    source_path = os.path.join(SCRAPBOOK_DIR, parts[0], parts[1])
    if not _is_inside(source_path, SCRAPBOOK_DIR):
        return jsonify({'error': 'Refused scrapbook path'}), 400
    if not os.path.isfile(source_path):
        return jsonify({'error': f'{relative} is not on disk'}), 404

    quarantine_dir = os.path.join(SCRAPBOOK_DIR, QUARANTINE_DIR_NAME)
    try:
        os.makedirs(quarantine_dir, exist_ok=True)
        base, extension = os.path.splitext(parts[1])
        target_name = f'{parts[0]}__{base}__deleted-{datetime.now().strftime("%Y%m%d-%H%M%S")}{extension}'
        shutil.move(source_path, os.path.join(quarantine_dir, target_name))
        index = _rebuild_index()
    except Exception as error:
        traceback.print_exc()
        return jsonify({'error': f'The item could not be moved to quarantine: {type(error).__name__}'}), 500

    print(f'[Scrapbook] Quarantined {relative} as {target_name}')
    return jsonify({
        'status'      : 'ok',
        'quarantined' : f'{QUARANTINE_DIR_NAME}/{target_name}',
        'index'       : index
    })

# endregion -------------------------------------------------------------------
