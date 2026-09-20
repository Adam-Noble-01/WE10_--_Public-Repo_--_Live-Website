#!/usr/bin/env python3
# =============================================================================
# TRUEVISION3D - TEST - STATEMENT WRITER END-TO-END SERVER
# =============================================================================
#
# FILE       : Na__Test__StatementServer__.py
# MODULE     : StatementWriterTestServer
# AUTHOR     : Adam Noble - Noble Architecture
# PURPOSE    : Serve the app for an in-browser test of the Statement Writer that saves for real and never writes the real statement
# CREATED    : 20-Sep-2026
#
# DESCRIPTION:
# - Serves the repository root, uncached, like a static server - so TrueVision
#   loads a real project with ?project=, ?project-folder= and ?year=.
# - Registers the REAL Statement Writer blueprint, pointed at a TEMPORARY
#   portal root holding a throwaway copy of the project's statements folder.
#   Every save, rename, move and delete therefore round-trips through the real
#   code, and the statement Adam is actually writing is never touched.
# - THE COPY IS CHEAP. The markdown files are copied; the photography is HARD
#   LINKED, which is instant and costs no disk - RB05's statements folder is
#   713 MB and copying it for a test would be absurd. A hard link reads as the
#   real file and MOVING one moves only the link, so even the tidy-up test
#   cannot disturb the originals. Where a link cannot be made the file is
#   copied instead.
# - Answers /api/health as the ProjectVision local server does, so the app
#   treats the statements folder as writable.
# - IT CANNOT STOP THE APP TALKING TO CLOUDFLARE. Publish writes to R2, which
#   is real. A browser test must guard fetch against /r2/write itself before
#   pressing Publish.
#
# USAGE:
#     python 80__Testing__PrototypeEnvironment/Na__Test__StatementServer__.py [port] [project-folder] [year]
#
#   Default port 8841, project RB05__WestFarm, year 26.
#   .claude/launch.json has it as "tv-statement".
#
# -----
#
# DEVELOPMENT LOG:
# 20-Sep-2026 - Version 1.0.0
# - Written with the Statement Writer.
#
# =============================================================================

import json
import os
import sys
import shutil
import tempfile

sys.dont_write_bytecode = True                                       # <-- Never leave a __pycache__ behind in a tracked folder

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
NA_APPS    = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))
REPO_ROOT  = os.path.abspath(os.path.join(NA_APPS, '..'))

PORT           = int(sys.argv[1]) if len(sys.argv) > 1 else 8841
PROJECT_FOLDER = sys.argv[2] if len(sys.argv) > 2 else 'RB05__WestFarm'
YEAR           = sys.argv[3] if len(sys.argv) > 3 else '26'

sys.path.insert(0, NA_APPS)
import ProjectVision__TrueVisionStatements__Api__ as statements_api  # noqa: E402
from flask import Flask, request, send_from_directory, abort, jsonify  # noqa: E402


# #region ---------------------------------------------------------------------
# REGION | The Throwaway Portal
# -----------------------------------------------------------------------------

REAL_PORTAL = os.path.join(REPO_ROOT, 'na-project-portal')
REAL_STMTS  = os.path.join(REAL_PORTAL, f'{YEAR}-Projects', PROJECT_FOLDER,
                           statements_api.TV_CONTENT_DIR, statements_api.STATEMENTS_DIR)

TEMP_PORTAL = tempfile.mkdtemp(prefix='na_statements_live_')
TEMP_STMTS  = os.path.join(TEMP_PORTAL, f'{YEAR}-Projects', PROJECT_FOLDER,
                           statements_api.TV_CONTENT_DIR, statements_api.STATEMENTS_DIR)
os.makedirs(TEMP_STMTS, exist_ok=True)

copied = linked = failed = 0
if os.path.isdir(REAL_STMTS):
    for current, directories, files in os.walk(REAL_STMTS):
        relative = os.path.relpath(current, REAL_STMTS)
        target_dir = TEMP_STMTS if relative == '.' else os.path.join(TEMP_STMTS, relative)
        os.makedirs(target_dir, exist_ok=True)
        for name in files:
            source = os.path.join(current, name)
            target = os.path.join(target_dir, name)
            if name.lower().endswith(statements_api.TEXT_SUFFIXES):
                shutil.copy2(source, target)                         # <-- The writing is copied, so a test may rewrite it freely
                copied += 1
                continue
            try:
                os.link(source, target)                              # <-- The photography is linked: instant, and moving a link moves only the link
                linked += 1
            except OSError:
                try:
                    shutil.copy2(source, target)
                    copied += 1
                except OSError:
                    failed += 1

# THE BLUEPRINT IS POINTED AT THE COPY. Its routes read this at call time.
statements_api.PORTAL_ROOT = TEMP_PORTAL

# THE PROJECT DATA has to exist for the temp project to resolve at all
real_project = os.path.join(REAL_PORTAL, f'{YEAR}-Projects', PROJECT_FOLDER)
temp_project = os.path.join(TEMP_PORTAL, f'{YEAR}-Projects', PROJECT_FOLDER)
for name in ('TrueVision__ProjectData__.json', 'TrueVision__DrawingNotes__.json', 'TrueVision__StatementDocs__.json'):
    source = os.path.join(real_project, statements_api.TV_CONTENT_DIR, name)
    if os.path.isfile(source):
        os.makedirs(os.path.join(temp_project, statements_api.TV_CONTENT_DIR), exist_ok=True)
        shutil.copy2(source, os.path.join(temp_project, statements_api.TV_CONTENT_DIR, name))

SCRATCH_DIR = os.path.join(TEMP_PORTAL, '__test_output')            # <-- Where a file the browser made is put down for inspection

print(f'[StatementTestServer] statements folder for this run: {TEMP_STMTS}', flush=True)
print(f'[StatementTestServer] files the browser hands back go to: {SCRATCH_DIR}', flush=True)
print(f'[StatementTestServer] {copied} file(s) copied, {linked} linked, {failed} could not be brought over', flush=True)

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | The Server
# -----------------------------------------------------------------------------

PORTAL_URL = 'na-project-portal/'

app = Flask(__name__, static_folder=None)
app.register_blueprint(statements_api.truevision_statements_api)


@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'service': 'na-projectvision-local-dev', 'port': PORT, 'test': True})


@app.route('/api/projects/<project_code>/files/<path:filename>', methods=['POST'])
def project_sibling_file(project_code, filename):
    """
    The statement index is a sibling file beside the project data, and it is
    written through the ProjectVision server's own route rather than the
    statement routes. Without a stand-in here the index would live only in the
    browser, and a reload would forget every statement in the list - which is
    exactly what happened the first time this was tested.

    Only the statement index is accepted: nothing else belongs to this test.
    """
    if filename != 'TrueVision__StatementDocs__.json':
        return jsonify({'error': f'This test server only writes the statement index, not "{filename}"'}), 400

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({'error': 'Request body must be a JSON object'}), 400

    target = os.path.join(temp_project, statements_api.TV_CONTENT_DIR, filename)
    os.makedirs(os.path.dirname(target), exist_ok=True)
    with open(target, 'w', encoding='utf-8', newline='\n') as file_handle:
        json.dump(payload, file_handle, indent=4, ensure_ascii=False)
        file_handle.write('\n')
    return jsonify({'status': 'ok', 'projectFile': target})


@app.route('/api/test/save', methods=['POST'])
def test_save():
    """
    Take a file the BROWSER made - a baked PDF, a resized picture - and put it
    somewhere it can be opened and measured. A statement PDF is megabytes of
    rasterised page; it cannot be carried back as text, and it is the only
    proof that the exporter actually works rather than merely running.

    Writes only into this run's own scratch folder, which goes when the server
    does.
    """
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({'error': 'Request body must be a JSON object'}), 400

    name = os.path.basename(str(body.get('name') or 'output.bin'))
    if not name or name.startswith('.'):
        return jsonify({'error': 'Give the file a name'}), 400

    encoded = body.get('dataBase64')
    if not isinstance(encoded, str) or not encoded:
        return jsonify({'error': '"dataBase64" must be a base64 string'}), 400

    import base64 as b64
    try:
        blob = b64.b64decode(encoded, validate=True)
    except Exception:                                                # noqa: BLE001
        return jsonify({'error': 'not valid base64'}), 400

    os.makedirs(SCRATCH_DIR, exist_ok=True)
    target = os.path.join(SCRATCH_DIR, name)
    with open(target, 'wb') as file_handle:
        file_handle.write(blob)
    return jsonify({'status': 'ok', 'path': target, 'bytes': len(blob)})


@app.route('/', defaults={'filepath': ''})
@app.route('/<path:filepath>')
def static_files(filepath):
    """
    The repository, with one substitution: anything under the project portal is
    served from the throwaway copy FIRST, so the app reads the statements this
    run is allowed to change. Anything the copy does not hold - every other
    project, every model, every drawing - falls through to the real repository.
    """
    normalized = filepath.replace('\\', '/')

    if normalized.startswith(PORTAL_URL):
        inside = normalized[len(PORTAL_URL):]
        candidate = os.path.join(TEMP_PORTAL, *inside.split('/')) if inside else TEMP_PORTAL
        if os.path.isfile(candidate):
            return send_from_directory(os.path.dirname(candidate), os.path.basename(candidate))

    full_path = os.path.join(REPO_ROOT, *normalized.split('/')) if normalized else REPO_ROOT
    if os.path.isdir(full_path):
        for index_name in ('index.html', 'Index.html'):
            if os.path.isfile(os.path.join(full_path, index_name)):
                return send_from_directory(full_path, index_name)
        abort(404)
    if os.path.isfile(full_path):
        return send_from_directory(os.path.dirname(full_path), os.path.basename(full_path))
    abort(404)


@app.after_request
def no_cache(response):
    response.headers['Cache-Control'] = 'no-store, max-age=0'
    return response


if __name__ == '__main__':
    try:
        app.run(host='127.0.0.1', port=PORT, debug=False, threaded=True)
    finally:
        shutil.rmtree(TEMP_PORTAL, ignore_errors=True)

# endregion -------------------------------------------------------------------
