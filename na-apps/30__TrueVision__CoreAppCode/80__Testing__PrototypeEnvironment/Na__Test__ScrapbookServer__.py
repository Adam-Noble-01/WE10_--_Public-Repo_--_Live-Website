#!/usr/bin/env python3
# =============================================================================
# TRUEVISION3D - TEST - SCRAPBOOK END-TO-END SERVER
# =============================================================================
#
# FILE       : Na__Test__ScrapbookServer__.py
# MODULE     : ScrapbookTestServer
# AUTHOR     : Adam Noble - Noble Architecture
# PURPOSE    : Serve the app for an in-browser test of the Custom Scrapbook that saves for real and never writes the real scrapbook folder
# CREATED    : 19-Sep-2026
#
# DESCRIPTION:
# - Serves the repository root, uncached, like a static server - so TrueVision
#   loads a real project with ?project=, ?project-folder= and ?year=.
# - Registers the REAL Custom Scrapbook blueprint, pointed at a TEMPORARY
#   folder holding empty copies of the category folders, and serves
#   .../51__LayoutEditor__UserScrapbookContent/... from that same folder. A
#   save, the index and the item files therefore all round-trip through the
#   real code, and the real scrapbook folder is never touched.
# - Answers /api/health as the ProjectVision local server does, so the app
#   treats the library as writable.
# - HAS NO /api/projects ROUTES: a local mirror write finds nothing to write
#   to. A browser test must STILL guard fetch against /r2/write - this server
#   cannot stop the app talking to Cloudflare.
#
# USAGE:
#     python 80__Testing__PrototypeEnvironment/Na__Test__ScrapbookServer__.py [port]
#
#   Default port 8683. .claude/launch.json has it as "tv-scrapbook".
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
import shutil
import tempfile

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
NA_APPS    = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))
REPO_ROOT  = os.path.abspath(os.path.join(NA_APPS, '..'))
PORT       = int(sys.argv[1]) if len(sys.argv) > 1 else 8683
CONTENT    = 'na-apps/30__TrueVision__CoreAppCode/51__LayoutEditor__UserScrapbookContent/'

sys.path.insert(0, NA_APPS)
import ProjectVision__TrueVisionScrapbook__Api__ as scrapbook_api  # noqa: E402
from flask import Flask, send_from_directory, abort, jsonify       # noqa: E402

TEMP_DIR = tempfile.mkdtemp(prefix='na_scrapbook_live_')
for name in sorted(os.listdir(scrapbook_api.SCRAPBOOK_DIR)):
    if scrapbook_api.CATEGORY_PATTERN.match(name):
        os.makedirs(os.path.join(TEMP_DIR, name), exist_ok=True)   # <-- The same categories, empty
scrapbook_api.SCRAPBOOK_DIR = TEMP_DIR                             # <-- Read at call time by every route
print(f'[ScrapbookTestServer] scrapbook folder for this run: {TEMP_DIR}', flush=True)

app = Flask(__name__, static_folder=None)
app.register_blueprint(scrapbook_api.truevision_scrapbook_api)


@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'service': 'na-projectvision-local-dev', 'port': PORT, 'test': True})


@app.route('/', defaults={'filepath': ''})
@app.route('/<path:filepath>')
def static_files(filepath):
    normalized = filepath.replace('\\', '/')
    if normalized.startswith(CONTENT):
        return send_from_directory(TEMP_DIR, normalized[len(CONTENT):])
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
        shutil.rmtree(TEMP_DIR, ignore_errors=True)
