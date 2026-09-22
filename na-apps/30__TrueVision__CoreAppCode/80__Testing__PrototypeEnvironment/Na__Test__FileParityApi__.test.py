#!/usr/bin/env python3
# =============================================================================
# TRUEVISION3D - TEST - LOCAL FILE PARITY API (FILE WATCH AND WRITE GUARD)
# =============================================================================
#
# FILE       : Na__Test__FileParityApi__.test.py
# MODULE     : LocalFileParityApiTest
# AUTHOR     : Adam Noble - Noble Architecture
# PURPOSE    : Prove that the local server can tell a file changed on disk by someone else, stamps every read and write with the file's version, and refuses a write that would bury a change the window never saw
# CREATED    : 22-Sep-2026
#
# DESCRIPTION:
# - Drives na-apps/ProjectVision__TrueVisionFileWatch__Api__.py through
#   Flask's test client. No server is started and no port is used.
# - THE REAL PORTAL IS NEVER TOUCHED. The blueprint reads PORTAL_ROOT at call
#   time, so the test points it (and the statements blueprint's) at a
#   temporary portal holding one project, ZZ99__ParityTest, before the first
#   request, and checks at the end that both stayed pointed there.
# - The main module's project-data and sibling-file routes, and its static
#   route, are stood in for by three small routes that write and serve the
#   same files the same way, because importing the main module would bring
#   its real portal with it. The statements blueprint is the real one.
# - WHAT MUST NEVER REGRESS:
#     1. A write made from the version on disk goes through, and its answer
#        says which version it produced.
#     2. A write made from an older version is refused (409) and the file on
#        disk is left exactly as the other writer left it.
#     3. A write that names no base goes through as it always did.
#     4. A file rewritten with the same content keeps its version.
#
# USAGE:
#     python 80__Testing__PrototypeEnvironment/Na__Test__FileParityApi__.test.py
#
#   Exit 0 = every check passed. Exit 1 = at least one did not. Needs flask.
#
# -----------------------------------------------------------------------------
#
# DEVELOPMENT LOG:
# 22-Sep-2026 - Version 1.0.0
# - Written with the Local File Parity guard.
#
# =============================================================================

import os
import sys
import json
import shutil
import tempfile

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
NA_APPS    = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))
sys.path.insert(0, NA_APPS)

import ProjectVision__TrueVisionFileWatch__Api__ as api            # noqa: E402
import ProjectVision__TrueVisionStatements__Api__ as statements     # noqa: E402
from flask import Flask, jsonify, request, send_from_directory      # noqa: E402


# -----------------------------------------------------------------------------
# REGION | A Temporary Portal With One Project
# -----------------------------------------------------------------------------

FOLDER     = 'ZZ99__ParityTest'
YEAR       = '26'
QUERY      = f'?project-folder={FOLDER}&year={YEAR}'
temp_root  = tempfile.mkdtemp(prefix='na_file_parity_api_')
portal     = os.path.join(temp_root, 'na-project-portal')
content    = os.path.join(portal, f'{YEAR}-Projects', FOLDER, '30__TrueVision__AppContent')
statement  = os.path.join(content, '10__StatementDocs', '01__PreApp__Statement')
os.makedirs(statement)
os.makedirs(os.path.join(content, '05__Layout__DrawingDocs__Images'))

DATA_PATH  = os.path.join(content, 'TrueVision__ProjectData__.json')
NOTES_PATH = os.path.join(content, 'TrueVision__DrawingNotes__.json')
INDEX_PATH = os.path.join(content, 'TrueVision__StatementDocs__.json')
DOC_PATH   = os.path.join(statement, 'ZZ99_T01_S01__Statement__.md')
IMAGE_PATH = os.path.join(content, '05__Layout__DrawingDocs__Images', 'picture.png')


def write_json(path, document):
    with open(path, 'w', encoding='utf-8', newline='\n') as handle:
        json.dump(document, handle, indent=4, ensure_ascii=False)
        handle.write('\n')


def read_text(path):
    with open(path, 'r', encoding='utf-8', newline='') as handle:
        return handle.read()


write_json(DATA_PATH, {
    'modelGroups'                : [{'name': 'Main', 'modelUrls': []}],
    'LayoutEditor__DrawingsData' : {'LayoutEditor__DrawingsData__Sheets': [{'Sheet__Name': 'One'}, {'Sheet__Name': 'Two'}]},
})
write_json(NOTES_PATH, {
    'ProjectSpecification__UpdatedIso' : '2026-09-22T01:15:38.959Z',
    'ProjectSpecification__Groups'     : [{'Group__Prefix': 'GN', 'Group__Notes': [{'Note__Id': 'SpecNote_001'}, {'Note__Id': 'SpecNote_002'}]}],
})
write_json(INDEX_PATH, {'Statement__UpdatedIso': '2026-09-22T00:36:11.466Z', 'Statement__Documents': [{'Doc__Id': 1}]})
with open(DOC_PATH, 'w', encoding='utf-8', newline='') as handle:
    handle.write('# Statement\n\nFirst draft.\n')
with open(IMAGE_PATH, 'wb') as handle:
    handle.write(b'\x89PNG\r\n\x1a\n')

real_portal            = api.PORTAL_ROOT
real_statements_portal = statements.PORTAL_ROOT
api.PORTAL_ROOT        = portal                                     # <-- Read at call time by every route and hook
statements.PORTAL_ROOT = portal

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | The App: the Blueprint Under Test, the Real Statements Blueprint and Stand-ins for the Main Routes
# -----------------------------------------------------------------------------

app = Flask(__name__)
app.register_blueprint(api.truevision_file_watch_api)
app.register_blueprint(statements.truevision_statements_api)


def project_file(name):
    folder = request.args.get('project-folder')
    year = request.args.get('year')
    return os.path.join(portal, f'{year}-Projects', folder, '30__TrueVision__AppContent', name)


@app.route('/api/projects/<code>', methods=['GET', 'POST'])
def stand_in_project(code):
    path = project_file('TrueVision__ProjectData__.json')
    if request.method == 'GET':
        with open(path, encoding='utf-8') as handle:
            return jsonify(json.load(handle))
    write_json(path, request.get_json())
    return jsonify({'status': 'ok', 'projectFile': path})


@app.route('/api/projects/<code>/files/<path:filename>', methods=['GET', 'POST'])
def stand_in_sibling(code, filename):
    path = project_file(filename)
    if request.method == 'GET':
        with open(path, encoding='utf-8') as handle:
            return jsonify(json.load(handle))
    write_json(path, request.get_json())
    return jsonify({'status': 'ok', 'projectFile': path})


@app.route('/na-project-portal/<path:filepath>')
def stand_in_static(filepath):
    full = os.path.join(portal, *filepath.split('/'))
    return send_from_directory(os.path.dirname(full), os.path.basename(full))


client = app.test_client()

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | Checks
# -----------------------------------------------------------------------------

failed = 0


def check(label, condition, detail=''):
    global failed
    if condition:
        print(f'  PASS  {label}')
    else:
        failed += 1
        print(f'  FAIL  {label}' + (f'  ({detail})' if detail else ''))


def state():
    answer = client.get('/api/truevision/file-watch/state' + QUERY)
    return answer.status_code, (answer.get_json() or {})


def entry(document, key):
    return next((item for item in document.get('files', []) if item.get('key') == key), None)


def version_of(key):
    return entry(state()[1], key)['version']


STATIC_DATA = f'/na-project-portal/{YEAR}-Projects/{FOLDER}/30__TrueVision__AppContent/TrueVision__ProjectData__.json'
STATIC_DOC  = f'/na-project-portal/{YEAR}-Projects/{FOLDER}/30__TrueVision__AppContent/10__StatementDocs/01__PreApp__Statement/ZZ99_T01_S01__Statement__.md'
STATIC_IMG  = f'/na-project-portal/{YEAR}-Projects/{FOLDER}/30__TrueVision__AppContent/05__Layout__DrawingDocs__Images/picture.png'
DOC_KEY     = 'statement:01__PreApp__Statement/ZZ99_T01_S01__Statement__.md'

try:
    print('\nTHE STATE ROUTE')
    status, doc = state()
    check('answers 200 for a project that exists', status == 200, status)
    check('names itself and its version', doc.get('service') == 'file-watch' and doc.get('apiVersion') == 1)
    data = entry(doc, 'project-data')
    notes = entry(doc, 'drawing-notes')
    index = entry(doc, 'statement-index')
    stmt = entry(doc, DOC_KEY)
    check('lists the three data files and the statement', all([data, notes, index, stmt]))
    check('a version is 16 hex digits', data and len(data['version']) == 16 and all(c in '0123456789abcdef' for c in data['version']))
    check('the project data reports a hash per top-level key', data and set(data['keys']) == {'modelGroups', 'LayoutEditor__DrawingsData'})
    check('the project data counts its sheets', data and data['summary'] == {'sheets': 2}, data and data['summary'])
    check('the notes report their stamp', notes and notes['stamp'] == '2026-09-22T01:15:38.959Z')
    check('the notes count groups and notes', notes and notes['summary'] == {'groups': 1, 'notes': 2}, notes and notes['summary'])
    check('the statement index counts its documents', index and index['summary'] == {'documents': 1})
    check('the statement is a statement, with a forward-slash path', stmt and stmt['kind'] == 'statement' and stmt['path'] == '10__StatementDocs/01__PreApp__Statement/ZZ99_T01_S01__Statement__.md')
    check('nothing has been written by the app yet', data and data['lastAppWrite'] is None)
    missing = client.get('/api/truevision/file-watch/state?project-folder=ZZ00__Nowhere&year=26')
    check('a project that is not there answers 404', missing.status_code == 404)
    refused = client.get('/api/truevision/file-watch/state?project-folder=..&year=26')
    check('a folder of .. is refused', refused.status_code == 404)

    print('\nEVERY READ OF A WATCHED FILE IS STAMPED')
    read = client.get(STATIC_DATA)
    check('the static read of the project data carries its version', read.headers.get('X-Na-File-Version') == data['version'], read.headers.get('X-Na-File-Version'))
    check('and its modified time', (read.headers.get('X-Na-File-Mtime-Ms') or '').isdigit())
    etag = read.headers.get('ETag')
    again = client.get(STATIC_DATA, headers={'If-None-Match': etag} if etag else {})
    check('a 304 revalidation still carries the version', again.status_code == 304 and again.headers.get('X-Na-File-Version') == data['version'], again.status_code)
    doc_read = client.get(STATIC_DOC)
    check('a statement read carries its version', doc_read.headers.get('X-Na-File-Version') == stmt['version'])
    image = client.get(STATIC_IMG)
    check('a picture is not a watched file and is not stamped', image.status_code == 200 and 'X-Na-File-Version' not in image.headers)
    sibling_read = client.get('/api/projects/ZZ99/files/TrueVision__DrawingNotes__.json' + QUERY)
    check('the sibling-file read of the notes is stamped too', sibling_read.headers.get('X-Na-File-Version') == notes['version'])

    print('\nA WRITE MADE FROM THE VERSION ON DISK')
    base = data['version']
    document = json.loads(read_text(DATA_PATH))
    document['LayoutEditor__DrawingsData']['LayoutEditor__DrawingsData__Sheets'].append({'Sheet__Name': 'Three'})
    saved = client.post('/api/projects/ZZ99' + QUERY, json=document, headers={'X-Na-Base-Version': base, 'X-Na-Client-Id': 'window_A'})
    answer = saved.get_json() or {}
    after = entry(state()[1], 'project-data')
    check('goes through', saved.status_code == 200, saved.status_code)
    check('its answer names the version it produced', answer.get('fileVersion') == after['version'] and answer.get('fileVersion') != base)
    check('so does its header', saved.headers.get('X-Na-File-Version') == after['version'])
    check('the write is remembered with the window that made it', after['lastAppWrite'] and after['lastAppWrite']['clientId'] == 'window_A' and after['lastAppWrite']['version'] == after['version'])
    check('the other keys the stand-in wrote are still answered', answer.get('status') == 'ok')

    print('\nSOMEONE ELSE CHANGES THE FILE ON DISK')
    own = after['version']
    on_disk = json.loads(read_text(DATA_PATH))
    on_disk['LayoutEditor__DrawingsData']['LayoutEditor__DrawingsData__Sheets'][0]['Sheet__Name'] = 'One (edited by an agent)'
    write_json(DATA_PATH, on_disk)
    agent_text = read_text(DATA_PATH)
    changed = entry(state()[1], 'project-data')
    check('the version moves', changed['version'] != own)
    check('and it is not the last version the app wrote', changed['lastAppWrite']['version'] != changed['version'])
    check('only the drawings key moved', [k for k in changed['keys'] if changed['keys'][k] != after['keys'].get(k)] == ['LayoutEditor__DrawingsData'])

    print('\nTHE STATE ROUTE DESCRIBES THE WINDOW\'S OWN VERSION')
    described = client.get('/api/truevision/file-watch/state' + QUERY + f'&base=project-data:{own}').get_json() or {}
    was = entry(described, 'project-data') or {}
    check('a moved data file answers what the window\'s version held', was.get('baseSummary') == {'sheets': 3} and was.get('baseKeys') == after['keys'], was.get('baseSummary'))
    check('and its size then', was.get('baseSize') == after['size'])
    check('with no base asked for, nothing extra is answered', 'baseKeys' not in entry(state()[1], 'project-data'))
    junk = client.get('/api/truevision/file-watch/state' + QUERY + '&base=project-data:not-a-version,../../x:0123456789abcdef')
    check('a malformed base is ignored', junk.status_code == 200 and 'baseKeys' not in entry(junk.get_json(), 'project-data'))

    print('\nA WRITE MADE FROM THE OLDER VERSION')
    stale = client.post('/api/projects/ZZ99' + QUERY, json=document, headers={'X-Na-Base-Version': own, 'X-Na-Client-Id': 'window_A'})
    refusal = stale.get_json() or {}
    check('is refused with 409', stale.status_code == 409, stale.status_code)
    check('says it is a conflict and which file', refusal.get('conflict') is True and refusal.get('key') == 'project-data')
    check('blames another program, not a window', 'another program' in (refusal.get('error') or ''))
    check('reports the version now on disk', (refusal.get('file') or {}).get('version') == changed['version'])
    check('and leaves the file exactly as the other writer left it', read_text(DATA_PATH) == agent_text)

    print('\nA WRITE THAT NAMES NO BASE')
    legacy = client.post('/api/projects/ZZ99' + QUERY, json=document)
    check('goes through as it always did', legacy.status_code == 200 and read_text(DATA_PATH) != agent_text)
    check('and is remembered with no window', entry(state()[1], 'project-data')['lastAppWrite']['clientId'] is None)

    print('\nANOTHER TRUEVISION WINDOW SAVED FIRST')
    notes_base = version_of('drawing-notes')
    notes_doc = json.loads(read_text(NOTES_PATH))
    notes_doc['ProjectSpecification__Groups'][0]['Group__Notes'].append({'Note__Id': 'SpecNote_003'})
    first = client.post('/api/projects/ZZ99/files/TrueVision__DrawingNotes__.json' + QUERY, json=notes_doc, headers={'X-Na-Base-Version': notes_base, 'X-Na-Client-Id': 'window_B'})
    check('window B writes the notes from the version on disk', first.status_code == 200)
    second = client.post('/api/projects/ZZ99/files/TrueVision__DrawingNotes__.json' + QUERY, json={'ProjectSpecification__Groups': []}, headers={'X-Na-Base-Version': notes_base, 'X-Na-Client-Id': 'window_A'})
    check('window A, still on the old version, is refused', second.status_code == 409)
    check('and told it was another TrueVision window', 'another TrueVision window' in ((second.get_json() or {}).get('error') or ''))
    check('window B\'s notes are still on disk', len(json.loads(read_text(NOTES_PATH))['ProjectSpecification__Groups'][0]['Group__Notes']) == 3)

    print('\nA STATEMENT, THROUGH THE REAL STATEMENTS BLUEPRINT')
    doc_base = version_of(DOC_KEY)
    path_in = '01__PreApp__Statement/ZZ99_T01_S01__Statement__.md'
    typed = client.post('/api/truevision/statements/file' + QUERY, json={'path': path_in, 'text': '# Statement\n\nSecond draft.\n'}, headers={'X-Na-Base-Version': doc_base, 'X-Na-Client-Id': 'window_A'})
    typed_answer = typed.get_json() or {}
    check('a quiet save from the version on disk goes through', typed.status_code == 200, typed.status_code)
    check('and names the version it produced', typed_answer.get('fileVersion') == version_of(DOC_KEY))
    check('the statements blueprint\'s own answer is kept', typed_answer.get('path') == path_in and typed_answer.get('status') == 'ok')
    with open(DOC_PATH, 'w', encoding='utf-8', newline='') as handle:
        handle.write('# Statement\n\nSecond draft, with a section the agent wrote.\n')
    buried = client.post('/api/truevision/statements/file' + QUERY, json={'path': path_in, 'text': '# Statement\n\nThird draft.\n'}, headers={'X-Na-Base-Version': typed_answer.get('fileVersion') or '', 'X-Na-Client-Id': 'window_A'})
    check('a quiet save from before the agent\'s edit is refused', buried.status_code == 409)
    check('the agent\'s section is still in the file', 'the agent wrote' in read_text(DOC_PATH))
    climb = client.post('/api/truevision/statements/file' + QUERY, json={'path': '../../TrueVision__ProjectData__.json', 'text': 'x'}, headers={'X-Na-Base-Version': 'abc'})
    check('a path that climbs out is not guarded here, and the statements route refuses it', climb.status_code == 400)

    print('\nCONTENT, NOT CLOCKS')
    before_touch = version_of('statement-index')
    text = read_text(INDEX_PATH)
    with open(INDEX_PATH, 'w', encoding='utf-8', newline='') as handle:
        handle.write(text)
    stat = os.stat(INDEX_PATH)
    os.utime(INDEX_PATH, ns=(stat.st_atime_ns, stat.st_mtime_ns + 5_000_000_000))
    check('a file rewritten with the same content keeps its version', version_of('statement-index') == before_touch)
    with open(INDEX_PATH, 'w', encoding='utf-8', newline='') as handle:
        handle.write('{ "Statement__Documents": [ ')
    broken = entry(state()[1], 'statement-index')
    check('a JSON file caught mid-write is reported as not valid', broken['valid'] is False and broken['version'] != before_touch)
    os.remove(INDEX_PATH)
    gone = entry(state()[1], 'statement-index')
    check('a file that is not there is reported missing', gone['exists'] is False and gone['version'] == 'missing')

    print('\nTHE TEST STAYED IN ITS OWN PORTAL')
    check('the parity blueprint still points at the temporary portal', api.PORTAL_ROOT == portal)
    check('so does the statements blueprint', statements.PORTAL_ROOT == portal)
    check('the real portal path was not the temporary one', real_portal != portal and real_statements_portal != portal)

finally:
    api.PORTAL_ROOT = real_portal
    statements.PORTAL_ROOT = real_statements_portal
    shutil.rmtree(temp_root, ignore_errors=True)

print('')
print('ALL CHECKS PASSED' if failed == 0 else f'{failed} CHECK(S) FAILED')
sys.exit(0 if failed == 0 else 1)

# endregion -------------------------------------------------------------------
