#!/usr/bin/env python3
# =============================================================================
# TRUEVISION3D - TEST - PROJECT DATA SAVE GUARD AND BACKUPS
# =============================================================================
#
# FILE       : Na__Test__ProjectDataSaveGuard__.test.py
# MODULE     : ProjectDataSaveGuardTest
# AUTHOR     : Adam Noble - Noble Architecture
# PURPOSE    : Prove the local server keeps a copy of every project file it
#              overwrites, and refuses a drawings save built on a block that is
#              no longer the one on disk
# CREATED    : 22-Sep-2026
#
# DESCRIPTION:
# - Drives na-apps/ProjectVision__LocalServer__Main__.py through Flask's test
#   client. No server is started and no port is used.
# - NO REAL PROJECT IS WRITTEN AND NO REAL BACKUP IS MADE. The server reads its
#   portal root and its backup root from module constants at call time; the
#   test points both at temporary folders holding one made-up project.
# - THE FINGERPRINT: the same drawings block fingerprints the same however the
#   file is formatted; a file with no block answers none.
# - THE GUARD: a save carrying the fingerprint it loaded lands; the same save
#   sent again after the file changed - by another save, or by a hand on the
#   file itself - is refused with 409 and the file is left alone; a save
#   carrying no fingerprint is never judged; "none" matches only a file with
#   no block.
# - THE BACKUPS: the copy overwritten is kept byte for byte, outside the
#   portal, in a folder mirroring the file's path; only the newest KEEP stay;
#   the drawing notes are kept too; the listing is newest first.
#
# USAGE:
#     python 80__Testing__PrototypeEnvironment/Na__Test__ProjectDataSaveGuard__.test.py
#
#   Exit 0 = every check passed. Exit 1 = at least one did not.
#
# -----------------------------------------------------------------------------
#
# DEVELOPMENT LOG:
# 22-Sep-2026 - Version 1.0.0
# - Written with the project data save guard and backups (TrueVision3D v2.146.0).
#
# =============================================================================

import sys
sys.dont_write_bytecode = True                                        # <-- The na-apps __pycache__ is tracked; a test must not touch it
import os, json, tempfile, shutil, time

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
NA_APPS    = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))
sys.path.insert(0, NA_APPS)

import ProjectVision__LocalServer__Main__ as srv                      # noqa: E402

failures = 0
def check(label, ok, extra=''):
    global failures
    print(('PASS ' if ok else 'FAIL ') + label + ((' :: ' + str(extra)) if (extra and not ok) else ''))
    if not ok:
        failures += 1

def read_text(path):
    with open(path, 'r', encoding='utf-8', newline='') as handle:
        return handle.read()

def write_text(path, text):
    with open(path, 'w', encoding='utf-8', newline='') as handle:
        handle.write(text)

def project_doc(sheet_names, saved_iso=None, other='camera-1'):
    block = {
        'LayoutEditor__DrawingsData__Version' : 1,
        'LayoutEditor__DrawingsData__Sheets'  : [ { 'Sheet__Id' : f'Sheet_{i + 1:03d}', 'Sheet__Name' : name } for i, name in enumerate(sheet_names) ]
    }
    if saved_iso:
        block['LayoutEditor__DrawingsData__SavedIso'] = saved_iso
    return { 'projectCode' : 'XX01', 'Camera__DefaultPosition' : other, 'LayoutEditor__DrawingsData' : block }

tmp     = tempfile.mkdtemp(prefix='savegrd_')
backups = tempfile.mkdtemp(prefix='savegrd_bak_')
try:
    content = os.path.join(tmp, '26-Projects', 'XX01__Test', '30__TrueVision__AppContent')
    os.makedirs(content)
    data_path  = os.path.join(content, 'TrueVision__ProjectData__.json')
    notes_path = os.path.join(content, 'TrueVision__DrawingNotes__.json')
    srv.PORTAL_ROOT         = tmp
    srv.PROJECT_BACKUP_ROOT = backups
    srv.PROJECT_BACKUP_KEEP = 3
    client = srv.app.test_client()
    QUERY  = '?project-folder=XX01__Test&year=26'
    HEADER = srv.DRAWINGS_BASE_HEADER

    # THE FINGERPRINT
    # ------------------------------------------------------------
    doc = project_doc(['D01', 'D02'])
    write_text(data_path, json.dumps(doc, indent=4) + '\n')
    answer = client.get('/api/projects/XX01/drawings-fingerprint' + QUERY).get_json()
    digest_pretty = answer['drawings']['digest']
    check('the fingerprint route answers the block\'s digest', isinstance(digest_pretty, str) and digest_pretty.startswith('sha1:') and len(digest_pretty) == 45, answer)
    check('...and no saved stamp when the block has none', answer['drawings']['savedIso'] is None)
    write_text(data_path, json.dumps(doc, separators=(',', ':')))     # <-- The same drawings, formatted differently
    digest_compact = client.get('/api/projects/XX01/drawings-fingerprint' + QUERY).get_json()['drawings']['digest']
    check('the same drawings fingerprint the same however the file is formatted', digest_compact == digest_pretty)
    doc_other = project_doc(['D01', 'D02'], other='camera-2')
    write_text(data_path, json.dumps(doc_other, indent=4) + '\n')
    check('a change outside the block does not change the fingerprint', client.get('/api/projects/XX01/drawings-fingerprint' + QUERY).get_json()['drawings']['digest'] == digest_pretty)
    write_text(data_path, json.dumps({ 'projectCode' : 'XX01' }, indent=4) + '\n')
    check('a file with no block answers none', client.get('/api/projects/XX01/drawings-fingerprint' + QUERY).get_json()['drawings'] == { 'savedIso' : None, 'digest' : None })
    check('an unknown project is 404', client.get('/api/projects/ZZ99/drawings-fingerprint?project-folder=ZZ99__None&year=26').status_code == 404)

    # THE GUARD
    # ------------------------------------------------------------
    write_text(data_path, json.dumps(doc, indent=4) + '\n')
    base = client.get('/api/projects/XX01/drawings-fingerprint' + QUERY).get_json()['drawings']['digest']
    saved_a = project_doc(['D01', 'D02', 'D03'], saved_iso='2026-09-22T11:00:00.000Z')
    answer = client.post('/api/projects/XX01' + QUERY, json=saved_a, headers={ HEADER : base })
    check('a save built on the block on disk lands', answer.status_code == 200, (answer.status_code, answer.get_json()))
    body = answer.get_json()
    after_a = client.get('/api/projects/XX01/drawings-fingerprint' + QUERY).get_json()['drawings']
    check('...and answers the fingerprint the file has now', body['drawings'] == after_a and after_a['digest'] != base, (body.get('drawings'), after_a))
    check('...with the stamp the app wrote', after_a['savedIso'] == '2026-09-22T11:00:00.000Z')
    on_disk_a = read_text(data_path)

    saved_stale = project_doc(['D01', 'D02', 'STALE'], saved_iso='2026-09-22T11:05:00.000Z')
    answer = client.post('/api/projects/XX01' + QUERY, json=saved_stale, headers={ HEADER : base })
    check('the same base sent again after the file changed is refused with 409', answer.status_code == 409, answer.status_code)
    body = answer.get_json() or {}
    check('...naming the conflict and the fingerprint on disk', body.get('conflict') is True and body.get('drawings') == after_a, body)
    check('...and the file is left exactly as it was', read_text(data_path) == on_disk_a)
    check('...and no copy was kept for a save that did not land', len(srv._list_backups(data_path)) == 1, len(srv._list_backups(data_path)))

    write_text(data_path, on_disk_a.replace('"D03"', '"D03 edited by hand"'))          # <-- An agent, or a git checkout, changes the file itself
    answer = client.post('/api/projects/XX01' + QUERY, json=saved_a, headers={ HEADER : after_a['digest'] })
    check('a file changed by hand since the app loaded it refuses the save too', answer.status_code == 409, answer.status_code)
    check('...and keeps the hand edit', '"D03 edited by hand"' in read_text(data_path))

    hand = client.get('/api/projects/XX01/drawings-fingerprint' + QUERY).get_json()['drawings']['digest']
    answer = client.post('/api/projects/XX01' + QUERY, json=saved_stale, headers={ HEADER : hand })
    check('a save built on the file as it is now lands', answer.status_code == 200, answer.status_code)

    answer = client.post('/api/projects/XX01' + QUERY, json=project_doc(['NO HEADER']))
    check('a save carrying no fingerprint is never judged', answer.status_code == 200, answer.status_code)
    check('...and its answer still carries the fingerprint written', answer.get_json()['drawings']['digest'] == client.get('/api/projects/XX01/drawings-fingerprint' + QUERY).get_json()['drawings']['digest'])

    answer = client.post('/api/projects/XX01' + QUERY, json=project_doc(['X']), headers={ HEADER : 'none' })
    check('"none" against a file that has a block is refused', answer.status_code == 409, answer.status_code)
    write_text(data_path, json.dumps({ 'projectCode' : 'XX01' }, indent=4) + '\n')
    answer = client.post('/api/projects/XX01' + QUERY, json=project_doc(['FIRST']), headers={ HEADER : 'none' })
    check('"none" against a file with no block lands: the first drawings a project gets', answer.status_code == 200, answer.status_code)

    # THE BACKUPS
    # ------------------------------------------------------------
    backup_dir = srv._backup_dir_for(data_path)
    expected_dir = os.path.join(backups, '26-Projects', 'XX01__Test', '30__TrueVision__AppContent')
    check('backups go under the backup root, mirroring the file\'s path in the portal', os.path.normcase(backup_dir) == os.path.normcase(expected_dir), backup_dir)
    check('...never inside the portal', not os.path.normcase(os.path.abspath(backup_dir)).startswith(os.path.normcase(os.path.abspath(tmp))))
    listing = client.get('/api/projects/XX01/backups' + QUERY).get_json()
    kept = listing['files']['TrueVision__ProjectData__.json']
    check('every overwrite so far kept a copy, capped at KEEP', len(kept) == 3 and listing['keep'] == 3, (len(kept), listing.get('keep')))
    check('the listing is newest first', [ entry['file'] for entry in kept ] == sorted((entry['file'] for entry in kept), reverse=True))

    before = read_text(data_path)
    time.sleep(0.002)
    answer = client.post('/api/projects/XX01' + QUERY, json=project_doc(['AFTER']))
    body = answer.get_json()
    check('the answer names the copy it kept', isinstance(body.get('backup'), str) and os.path.isfile(body['backup']), body.get('backup'))
    check('...and the copy is the overwritten file byte for byte', read_text(body['backup']) == before)
    kept = client.get('/api/projects/XX01/backups' + QUERY).get_json()['files']['TrueVision__ProjectData__.json']
    check('the oldest went as the new one came: still KEEP copies', len(kept) == 3 and kept[0]['file'] == os.path.basename(body['backup']), [ entry['file'] for entry in kept ])

    write_text(notes_path, json.dumps({ 'ProjectSpecification__Notes' : [] }) + '\n')
    notes_before = read_text(notes_path)
    answer = client.post('/api/projects/XX01/files/TrueVision__DrawingNotes__.json' + QUERY, json={ 'ProjectSpecification__Notes' : [ { 'id' : 'EW01' } ] })
    check('the drawing notes file is kept before it is overwritten too', answer.status_code == 200 and isinstance(answer.get_json().get('backup'), str), answer.get_json())
    check('...byte for byte', read_text(answer.get_json()['backup']) == notes_before)
    check('...and listed beside the project data', len(client.get('/api/projects/XX01/backups' + QUERY).get_json()['files']['TrueVision__DrawingNotes__.json']) == 1)

    check('a first write of a file that does not exist yet keeps nothing and lands', srv._backup_before_overwrite(os.path.join(content, 'TrueVision__StatementDocs__.json')) is None)

finally:
    shutil.rmtree(tmp, ignore_errors=True)
    shutil.rmtree(backups, ignore_errors=True)

print('FAILURES:', failures)
sys.exit(1 if failures else 0)
