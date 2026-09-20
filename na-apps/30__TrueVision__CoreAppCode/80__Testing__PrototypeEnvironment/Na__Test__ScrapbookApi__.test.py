#!/usr/bin/env python3
# =============================================================================
# TRUEVISION3D - TEST - CUSTOM SCRAPBOOK API
# =============================================================================
#
# FILE       : Na__Test__ScrapbookApi__.test.py
# MODULE     : CustomScrapbookApiTest
# AUTHOR     : Adam Noble - Noble Architecture
# PURPOSE    : Prove the Custom Scrapbook's save, list and delete routes, and everything they must refuse
# CREATED    : 19-Sep-2026
#
# DESCRIPTION:
# - Drives na-apps/ProjectVision__TrueVisionScrapbook__Api__.py through Flask's
#   test client. No server is started and no port is used.
# - THE REAL SCRAPBOOK FOLDER IS NEVER WRITTEN. The blueprint reads its folder
#   from a module constant at call time, so the test points that constant at a
#   temporary folder before the first request, and checks at the end that it
#   stayed pointed there.
#
# USAGE:
#     python 80__Testing__PrototypeEnvironment/Na__Test__ScrapbookApi__.test.py
#
#   Exit 0 = every check passed. Exit 1 = at least one did not. Needs flask.
#
# -----
#
# DEVELOPMENT LOG:
# 19-Sep-2026 - Version 1.0.0
# - Written with the Custom Scrapbook.
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

import ProjectVision__TrueVisionScrapbook__Api__ as api           # noqa: E402
from flask import Flask                                             # noqa: E402

ROUTE     = '/api/truevision/scrapbook'
GENERAL   = '01__ScrapbookItems__General'
DIMS      = '02__ScrapbookItems__Dimensions'

real_dir  = api.SCRAPBOOK_DIR
temp_dir  = tempfile.mkdtemp(prefix='na_scrapbook_api_')
for folder in (GENERAL, DIMS):
    os.makedirs(os.path.join(temp_dir, folder))
api.SCRAPBOOK_DIR = temp_dir                                        # <-- Read at call time by every route

app = Flask(__name__)
app.register_blueprint(api.truevision_scrapbook_api)
client = app.test_client()

failed = 0


def check(name, passed, detail=''):
    global failed
    if not passed:
        failed += 1
    print(('  PASS  ' if passed else '  FAIL  ') + name + (('   ' + str(detail)) if (detail and not passed) else ''))


def item_document():
    return {
        'UserScrapbookItem__Meta'    : {'Meta__Version': '1.0.0'},
        'UserScrapbookItem__SizeMm'  : {'WidthMm': 100, 'HeightMm': 7.3},
        'UserScrapbookItem__Roots'   : [{'kind': 'group', 'id': 'Group_001'}],
        'UserScrapbookItem__Entries' : [
            {'kind': 'shape', 'id': 'Shape_001', 'record': {'Shape__Points': [[0, 0], [20, 0], [20, 1], [0, 1]], 'Shape__Closed': True}},
            {'kind': 'annotation', 'id': 'Text_001', 'record': {'Annotation__Text': '0'}},
            {'kind': 'group', 'id': 'Group_001', 'record': {'Group__Members': [{'kind': 'shape', 'id': 'Shape_001'}, {'kind': 'annotation', 'id': 'Text_001'}]}}
        ],
        'UserScrapbookItem__Id': 'FORGED', 'UserScrapbookItem__Name': 'FORGED'
    }


print('\nTrueVision3D - custom scrapbook api\n')

# READ | an empty library
answer = client.get(ROUTE)
body = answer.get_json()
check('an empty library lists nothing and names its categories', answer.status_code == 200 and body['index']['UserScrapbook__Index__Items'] == [] and body['categories'] == [GENERAL, DIMS], body)
check('the first read writes the index file', os.path.isfile(os.path.join(temp_dir, api.INDEX_FILE_NAME)))

# SAVE | the server names the file and owns the identity keys
answer = client.post(ROUTE + '/items', json={'category': GENERAL, 'name': 'Drawing title + bar', 'item': item_document()})
body = answer.get_json()
check('a save answers ok', answer.status_code == 200 and body.get('status') == 'ok', body)
entry = body['item']
check('the file is named by the server, in PascalCase', entry['Item__File'].startswith(GENERAL + '/UserScrapbookItem__DrawingTitleBar__') and entry['Item__File'].endswith('.json'), entry['Item__File'])
with open(os.path.join(temp_dir, *entry['Item__File'].split('/')), encoding='utf-8') as handle:
    saved = json.load(handle)
check('the identity keys are the server\'s, not the request\'s', saved['UserScrapbookItem__Name'] == 'Drawing title + bar' and saved['UserScrapbookItem__Id'] != 'FORGED' and saved['UserScrapbookItem__Category'] == GENERAL)
check('identity first, records last, whatever order the request came in', list(saved.keys())[:6] == ['UserScrapbookItem__' + key for key in ('Meta', 'Id', 'Name', 'Category', 'CreatedIso', 'UpdatedIso')] and list(saved.keys())[-1] == 'UserScrapbookItem__Entries', list(saved.keys()))
check('the records are written as they arrived', saved['UserScrapbookItem__Entries'] == item_document()['UserScrapbookItem__Entries'])
second = client.post(ROUTE + '/items', json={'category': GENERAL, 'name': 'Drawing title + bar', 'item': item_document()}).get_json()
check('a second save of one name in one second gets a file of its own', second['item']['Item__File'] != entry['Item__File'], second['item']['Item__File'])

# REFUSALS | nothing in a request is ever a path
for name, payload in (
    ('a category that does not exist is refused', {'category': '09__ScrapbookItems__Made', 'name': 'x1', 'item': item_document()}),
    ('a traversal category is refused',            {'category': '../../05__ProjectVision__CoreAppCode', 'name': 'x1', 'item': item_document()}),
    ('a name with no letter or digit is refused',  {'category': GENERAL, 'name': ' ../ ', 'item': item_document()}),
    ('an item with no entries is refused',         {'category': GENERAL, 'name': 'empty', 'item': {'UserScrapbookItem__Roots': [], 'UserScrapbookItem__Entries': []}}),
):
    answer = client.post(ROUTE + '/items', json=payload)
    check(name, answer.status_code == 400 and 'error' in (answer.get_json() or {}), answer.get_json())
check('...and no category folder was made', not os.path.exists(os.path.join(temp_dir, '09__ScrapbookItems__Made')))
viewport = item_document()
viewport['UserScrapbookItem__Entries'][0]['kind'] = 'viewport'
check('a viewport entry is refused', client.post(ROUTE + '/items', json={'category': GENERAL, 'name': 'vp', 'item': viewport}).status_code == 400)

# THE INDEX FOLLOWS THE FOLDERS | a file added by hand is listed; junk is not
with open(os.path.join(temp_dir, DIMS, 'UserScrapbookItem__ByHand__20260101-120000.json'), 'w', encoding='utf-8') as handle:
    json.dump({'UserScrapbookItem__Name': 'By hand', 'UserScrapbookItem__Entries': []}, handle)
with open(os.path.join(temp_dir, DIMS, 'notes.txt'), 'w', encoding='utf-8') as handle:
    handle.write('not an item')
with open(os.path.join(temp_dir, DIMS, 'UserScrapbookItem__Broken__20260101-120001.json'), 'w', encoding='utf-8') as handle:
    handle.write('{ not json')
names = sorted(item['Item__Name'] for item in client.get(ROUTE).get_json()['index']['UserScrapbook__Index__Items'])
check('a hand-added file is listed; a text file and broken JSON are not', names == ['By hand', 'Drawing title + bar', 'Drawing title + bar'], names)
stamp = os.path.getmtime(os.path.join(temp_dir, api.INDEX_FILE_NAME))
client.get(ROUTE)
check('a read that changes nothing does not rewrite the index', os.path.getmtime(os.path.join(temp_dir, api.INDEX_FILE_NAME)) == stamp)

# DELETE | quarantine, never unlink
answer = client.post(ROUTE + '/items/delete', json={'file': entry['Item__File']})
body = answer.get_json()
check('a delete answers ok', answer.status_code == 200 and body.get('status') == 'ok', body)
check('the file has left its category', not os.path.exists(os.path.join(temp_dir, *entry['Item__File'].split('/'))))
check('...and sits in quarantine, not erased', os.path.isfile(os.path.join(temp_dir, *body['quarantined'].split('/'))), body['quarantined'])
check('the index dropped it, and never lists the quarantine', len(body['index']['UserScrapbook__Index__Items']) == 2)
for name, payload in (
    ('a traversal delete is refused',                {'file': '../ProjectVision__LocalServer__Main__.py'}),
    ('a delete outside the item pattern is refused', {'file': GENERAL + '/' + api.INDEX_FILE_NAME}),
    ('a delete inside the quarantine is refused',    {'file': api.QUARANTINE_DIR_NAME + '/x.json'}),
):
    check(name, client.post(ROUTE + '/items/delete', json=payload).status_code == 400)
check('deleting what has already gone is a 404', client.post(ROUTE + '/items/delete', json={'file': entry['Item__File']}).status_code == 404)

check('the real scrapbook folder was never the target', api.SCRAPBOOK_DIR == temp_dir and real_dir.endswith('51__LayoutEditor__UserScrapbookContent'), real_dir)
shutil.rmtree(temp_dir, ignore_errors=True)

print('\n  ' + (('FAIL - %d check(s) did not pass.' % failed) if failed else 'PASS - the scrapbook api saves, lists, quarantines and refuses as it should.') + '\n')
sys.exit(1 if failed else 0)
