#!/usr/bin/env python3
# =============================================================================
# TRUEVISION3D - TEST - SHEET IMAGES API
# =============================================================================
#
# FILE       : Na__Test__SheetImagesApi__.test.py
# MODULE     : SheetImagesApiTest
# AUTHOR     : Adam Noble - Noble Architecture
# PURPOSE    : Prove the sheet picture routes: folders made on demand, pictures
#              stored by content, filed by document id, archived never deleted
# CREATED    : 21-Sep-2026
#
# DESCRIPTION:
# - Drives na-apps/ProjectVision__TrueVisionSheetImages__Api__.py through
#   Flask's test client. No server is started and no port is used.
# - NO REAL PROJECT IS WRITTEN. The blueprint reads the portal root from a
#   module constant at call time; the test points it at a temporary folder
#   holding one made-up project before the first request.
# - Covers: the images folder made by the first upload and never by a read;
#   the same picture twice is stored once; a name whose hash does not match
#   its bytes, a type that does not match its name, and every escape (..,
#   the archive folder, a slash, a project of "..") refused; a renumber
#   copied into the new folder and the old copy archived only when asked;
#   an undone delete restored from anywhere; a swap of two numbers; a file
#   that is not ours never archived; empty folders tidied.
#
# USAGE:
#     python 80__Testing__PrototypeEnvironment/Na__Test__SheetImagesApi__.test.py
#
#   Exit 0 = every check passed. Exit 1 = at least one did not. Needs flask.
#
# -----
#
# DEVELOPMENT LOG:
# 21-Sep-2026 - Version 1.0.0
# - Written with Sheet Images (TrueVision3D v2.116.0).
#
# =============================================================================

import sys
sys.dont_write_bytecode = True                                        # <-- The na-apps __pycache__ is tracked; a test must not touch it
import os, hashlib, tempfile, shutil

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
NA_APPS    = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))
sys.path.insert(0, NA_APPS)

import ProjectVision__TrueVisionSheetImages__Api__ as api            # noqa: E402
from flask import Flask                                               # noqa: E402

failures = 0
def check(label, ok, extra=''):
    global failures
    print(('PASS ' if ok else 'FAIL ') + label + ((' :: ' + str(extra)) if (extra and not ok) else ''))
    if not ok:
        failures += 1

tmp = tempfile.mkdtemp(prefix='sheetimg_')
try:
    project = os.path.join(tmp, '26-Projects', 'XX01__Test', '30__TrueVision__AppContent')
    os.makedirs(project)
    api.PORTAL_ROOT = tmp
    app = Flask(__name__)
    app.register_blueprint(api.truevision_sheet_images_api)
    client = app.test_client()
    q = 'project-folder=XX01__Test&year=26'
    root = os.path.join(project, '05__Layout__DrawingDocs__Images')

    r = client.get('/api/truevision/sheet-images/list?' + q)
    check('list before any picture: exists False', r.status_code == 200 and r.get_json()['exists'] is False, r.get_json())
    check('no images folder made by a list', not os.path.exists(root))

    # A tiny valid WebP header + payload (only the magic bytes are sniffed)
    webp = b'RIFF' + (100).to_bytes(4, 'little') + b'WEBP' + b'VP8 ' + os.urandom(90)
    h = hashlib.sha256(webp).hexdigest()[:10]
    name = 'FrontCgi__' + h + '.webp'

    r = client.post('/api/truevision/sheet-images/upload?' + q + '&folder=RB05_T01_D01&name=' + name, data=webp, content_type='image/webp')
    check('upload creates', r.status_code == 200 and r.get_json()['created'] is True, r.get_json())
    check('images folder made on demand', os.path.isfile(os.path.join(root, 'RB05_T01_D01', name)))

    r = client.post('/api/truevision/sheet-images/upload?' + q + '&folder=RB05_T01_D01&name=' + name, data=webp, content_type='image/webp')
    check('same picture again: created False', r.status_code == 200 and r.get_json()['created'] is False, r.get_json())

    r = client.post('/api/truevision/sheet-images/upload?' + q + '&folder=RB05_T01_D01&name=Other__0123456789.webp', data=webp, content_type='image/webp')
    check('hash mismatch refused', r.status_code == 400, r.get_json())

    r = client.post('/api/truevision/sheet-images/upload?' + q + '&folder=RB05_T01_D01&name=Bad__' + h + '.png', data=webp, content_type='image/png')
    check('type mismatch refused', r.status_code == 400, r.get_json())

    r = client.post('/api/truevision/sheet-images/upload?' + q + '&folder=..&name=' + name, data=webp)
    check('folder .. refused', r.status_code == 400)
    r = client.post('/api/truevision/sheet-images/upload?' + q + '&folder=00__Archive&name=' + name, data=webp)
    check('archive folder refused', r.status_code == 400)
    r = client.post('/api/truevision/sheet-images/upload?' + q + '&folder=A%2FB&name=' + name, data=webp)
    check('slash in folder refused', r.status_code == 400)
    r = client.post('/api/truevision/sheet-images/upload?project-folder=..&year=26&folder=A&name=' + name, data=webp)
    check('project .. refused', r.status_code == 404)

    # Somebody's own file in the folder (not managed) must never be archived
    own = os.path.join(root, 'RB05_T01_D01', 'RB03_T01_V10__FrontFascade__.png')
    with open(own, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + b'0' * 20)

    # Renumber: D01 -> D02. Reconcile copies into the new folder from the hint.
    r = client.post('/api/truevision/sheet-images/reconcile?' + q, json={'keep': [{'folder': 'RB05_T01_D02', 'file': name, 'from': ['RB05_T01_D01']}]})
    res = r.get_json()
    check('reconcile copies into the new folder', r.status_code == 200 and res['results'][0]['state'] == 'copied' and res['results'][0]['source'] == 'RB05_T01_D01', res)
    check('old copy still there (copy, not move)', os.path.isfile(os.path.join(root, 'RB05_T01_D01', name)))
    check('nothing archived without archive flag', res['archived'] == [])

    # Archive after the save: the old folder's copy goes to 00__Archive; the unmanaged file stays.
    r = client.post('/api/truevision/sheet-images/reconcile?' + q, json={'keep': [{'folder': 'RB05_T01_D02', 'file': name}], 'archive': True})
    res = r.get_json()
    check('archive moves the unused managed copy', res['archived'] == ['RB05_T01_D01/' + name], res)
    check('archived file exists', os.path.isfile(os.path.join(root, '00__Archive', 'RB05_T01_D01', name)))
    check('unmanaged file left alone', os.path.isfile(own))
    check('folder with the unmanaged file kept', 'RB05_T01_D01' not in res['removedFolders'])

    # Undo brings the D01 reference back: reconcile restores from the archive.
    r = client.post('/api/truevision/sheet-images/reconcile?' + q, json={'keep': [{'folder': 'RB05_T01_D01', 'file': name, 'from': []}]})
    res = r.get_json()
    check('restored from anywhere (live copy preferred over archive)', res['results'][0]['state'] == 'copied' and res['results'][0]['source'] == 'RB05_T01_D02', res)

    # Missing picture reported
    r = client.post('/api/truevision/sheet-images/reconcile?' + q, json={'keep': [{'folder': 'RB05_T01_D05', 'file': 'Nope__abcdefabcd.webp'}]})
    check('missing reported', r.get_json()['results'][0]['state'] == 'missing', r.get_json())

    # Swap D01 <-> D02 with two pictures; both end up where wanted.
    webp2 = b'RIFF' + (100).to_bytes(4, 'little') + b'WEBP' + b'VP8 ' + os.urandom(90)
    name2 = 'RearCgi__' + hashlib.sha256(webp2).hexdigest()[:10] + '.webp'
    client.post('/api/truevision/sheet-images/upload?' + q + '&folder=RB05_T01_D02&name=' + name2, data=webp2)
    r = client.post('/api/truevision/sheet-images/reconcile?' + q, json={'keep': [
        {'folder': 'RB05_T01_D02', 'file': name, 'from': ['RB05_T01_D01']},
        {'folder': 'RB05_T01_D01', 'file': name2, 'from': ['RB05_T01_D02']}], 'archive': True})
    res = r.get_json()
    check('swap: both present in new homes', os.path.isfile(os.path.join(root, 'RB05_T01_D02', name)) and os.path.isfile(os.path.join(root, 'RB05_T01_D01', name2)), res)
    check('swap: stale copies archived', sorted(res['archived']) == sorted(['RB05_T01_D01/' + name, 'RB05_T01_D02/' + name2]), res)

    r = client.get('/api/truevision/sheet-images/list?' + q)
    entries = r.get_json()['entries']
    check('list reports archive entries marked', any(e['archived'] for e in entries) and any(not e['archived'] for e in entries), entries)

    # Empty keep + archive archives everything managed and removes empty folders
    r = client.post('/api/truevision/sheet-images/reconcile?' + q, json={'keep': [], 'archive': True})
    res = r.get_json()
    check('delete all: RB05_T01_D02 removed when empty', 'RB05_T01_D02' in res['removedFolders'], res)
finally:
    shutil.rmtree(tmp, ignore_errors=True)

print('FAILURES:', failures)
sys.exit(1 if failures else 0)
