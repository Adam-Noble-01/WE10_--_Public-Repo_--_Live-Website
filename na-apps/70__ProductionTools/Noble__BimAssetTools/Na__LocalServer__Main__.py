#!/usr/bin/env python3
# =============================================================================
# NOBLE BIM ASSET TOOLS | LOCAL DEVELOPMENT SERVER
# =============================================================================
#
# FILE       : Na__LocalServer__Main__.py
# NAMESPACE  : Na__BimAssetTools
# AUTHOR     : Adam Noble - Noble Architecture
# PURPOSE    : Serve the application over HTTP with correct MIME types for WASM
# CREATED    : 14-Aug-2026
#
# DESCRIPTION:
# - The application cannot run from file:// because ES modules, import maps and
#   WebAssembly streaming instantiation all require an HTTP origin.
# - Python's stock http.server does not know the application/wasm MIME type. It
#   serves .wasm as application/octet-stream, and WebAssembly.instantiateStreaming
#   then fails with "Incorrect response MIME type" - an error that reads like a
#   missing file and wastes a good half hour if you have not met it before. The
#   handler below registers the correct type explicitly.
#
# USAGE:
#     python Na__LocalServer__Main__.py [--port 8009] [--no-browser]
#
# =============================================================================

import argparse
import http.server
import json
import mimetypes
import os
import socket
import socketserver
import sys
import urllib.parse
import webbrowser

# =============================================================================
# REGION | Configuration
# =============================================================================

DEFAULT_PORT     = 8009
APP_ENTRY_POINT  = "Na__BimAssetTools__App__.html"
PROJECT_ROOT     = os.path.dirname(os.path.abspath(__file__))

# The Revit conversion broker lives in its own module so the static server stays
# readable. Imported by path because the server is run as a script, not a package.
sys.path.insert(0, os.path.join(PROJECT_ROOT, "10__LocalServer__Modules"))
import Na__LocalServer__RevitConvert__ as RevitConvert     # noqa: E402

# Largest upload accepted for conversion. A Revit project of this size already
# takes minutes to convert.
MAX_UPLOAD_BYTES = 512 * 1024 * 1024

# MIME types the stock library gets wrong or does not know at all.
EXTRA_MIME_TYPES = {
    ".wasm"        : "application/wasm",
    ".mjs"         : "text/javascript",
    ".js"          : "text/javascript",
    ".json"        : "application/json",
    ".webmanifest" : "application/manifest+json",
}

# endregion -------------------------------------------------------------------


# =============================================================================
# REGION | Request Handler
# =============================================================================

class Na__LocalServer__Handler(http.server.SimpleHTTPRequestHandler):
    """Static file handler with the MIME types this application needs."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PROJECT_ROOT, **kwargs)

    # -------------------------------------------------------------------------
    # FUNCTION | Resolve the Content Type for a Path
    # -------------------------------------------------------------------------
    def guess_type(self, path):
        extension = os.path.splitext(path)[1].lower()
        if extension in EXTRA_MIME_TYPES:
            return EXTRA_MIME_TYPES[extension]
        return super().guess_type(path)

    # -------------------------------------------------------------------------
    # FUNCTION | Add Headers Needed for Local Development
    # -------------------------------------------------------------------------
    def end_headers(self):
        # Development server: never let a stale module or config be cached, or an
        # edit appears not to have taken effect.
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    # -------------------------------------------------------------------------
    # FUNCTION | Quieten the Per-Request Console Noise
    # -------------------------------------------------------------------------
    def log_message(self, format, *args):
        # A single page load pulls in a few hundred module files. Only failures
        # are worth printing.
        status = str(args[1]) if len(args) > 1 else ""
        if status.startswith(("4", "5")):
            sys.stderr.write(f"  [{status}] {args[0]}\n")

    # =========================================================================
    # REGION | JSON and Binary Response Helpers
    # =========================================================================

    def Na__Handler__SendJson(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def Na__Handler__SendBinary(self, body, content_type, file_name):
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Na-Filename", file_name)
        self.end_headers()
        self.wfile.write(body)

    def Na__Handler__SendError(self, message, status=400):
        self.Na__Handler__SendJson({"error": message}, status)

    # endregion ---------------------------------------------------------------

    # =========================================================================
    # REGION | API Routing
    # =========================================================================

    # -------------------------------------------------------------------------
    # FUNCTION | Route GET Requests, Falling Through to Static Files
    # -------------------------------------------------------------------------
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)

        if not parsed.path.startswith("/api/"):
            return super().do_GET()

        query = urllib.parse.parse_qs(parsed.query)

        # -- What this server is able to do -----------------------------------
        # The browser calls this at boot so it can offer conversion only when a
        # converter is actually reachable, rather than promising it and failing.
        if parsed.path == "/api/capabilities":
            return self.Na__Handler__SendJson(RevitConvert.Na__RevitConvert__Capabilities())

        # -- Poll a running conversion ----------------------------------------
        if parsed.path == "/api/convert/status":
            job_id = (query.get("job") or [""])[0]
            status = RevitConvert.Na__RevitConvert__StatusOf(job_id)
            if status is None:
                return self.Na__Handler__SendError("Unknown or expired job id.", 404)
            return self.Na__Handler__SendJson(status)

        # -- Collect the finished IFC -----------------------------------------
        if parsed.path == "/api/convert/result":
            job_id = (query.get("job") or [""])[0]
            try:
                body, name = RevitConvert.Na__RevitConvert__ResultOf(job_id)
            except KeyError as error:
                return self.Na__Handler__SendError(str(error), 404)
            except Exception as error:
                return self.Na__Handler__SendError(str(error), 409)
            return self.Na__Handler__SendBinary(body, "application/x-step", name)

        return self.Na__Handler__SendError("Unknown API route.", 404)

    # -------------------------------------------------------------------------
    # FUNCTION | Route POST Requests
    # -------------------------------------------------------------------------
    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path != "/api/convert/start":
            return self.Na__Handler__SendError("Unknown API route.", 404)

        try:
            content_length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            return self.Na__Handler__SendError("Content-Length header was not a number.", 400)

        if content_length <= 0:
            return self.Na__Handler__SendError("No file content was uploaded.", 400)

        if content_length > MAX_UPLOAD_BYTES:
            return self.Na__Handler__SendError(
                f"Upload is {content_length // 1048576} MB, over the "
                f"{MAX_UPLOAD_BYTES // 1048576} MB limit.", 413
            )

        # The body is the raw file. The original name travels in a header so it
        # never has to be parsed out of a multipart envelope, and it is treated
        # as untrusted by the broker regardless.
        file_bytes  = self.rfile.read(content_length)
        client_name = self.headers.get("X-Na-Filename") or "model.rvt"

        try:
            job_id = RevitConvert.Na__RevitConvert__StartJob(file_bytes, client_name)
        except FileNotFoundError as error:
            return self.Na__Handler__SendError(str(error), 503)
        except Exception as error:
            return self.Na__Handler__SendError(f"Could not start conversion: {error}", 500)

        return self.Na__Handler__SendJson({"jobId": job_id}, 202)

    # endregion ---------------------------------------------------------------

# endregion -------------------------------------------------------------------


# =============================================================================
# REGION | Server Bootstrap
# =============================================================================

class Na__LocalServer__ThreadedServer(socketserver.ThreadingTCPServer):
    """Threaded so a slow WASM download cannot block the rest of the page."""
    daemon_threads      = True
    allow_reuse_address = True


# -----------------------------------------------------------------------------
# FUNCTION | Find the First Free Port at or After a Starting Point
# -----------------------------------------------------------------------------
def Na__LocalServer__FindFreePort(preferred_port, attempts=20):
    for offset in range(attempts):
        candidate = preferred_port + offset
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            if probe.connect_ex(("127.0.0.1", candidate)) != 0:
                return candidate
    raise RuntimeError(f"No free port found between {preferred_port} and {preferred_port + attempts - 1}.")


# -----------------------------------------------------------------------------
# FUNCTION | Verify the Vendored Dependencies Are Actually Present
# -----------------------------------------------------------------------------
def Na__LocalServer__CheckDependencies():
    required = [
        "04__Src__Dependencies__VersionLocked/01__Vendor__ThreeJs__v0.184.0/build/three.module.js",
        "04__Src__Dependencies__VersionLocked/02__Vendor__WebIfc__v0.0.77/web-ifc-api.js",
        "04__Src__Dependencies__VersionLocked/02__Vendor__WebIfc__v0.0.77/web-ifc.wasm",
        "04__Src__Dependencies__VersionLocked/03__Vendor__OcctImportJs__v0.0.23/occt-import-js.js",
        "04__Src__Dependencies__VersionLocked/03__Vendor__OcctImportJs__v0.0.23/occt-import-js.wasm",
    ]

    missing = [path for path in required if not os.path.exists(os.path.join(PROJECT_ROOT, path))]

    if missing:
        print("  WARNING - version-locked dependencies are missing:")
        for path in missing:
            print(f"    - {path}")
        print("  Run 'npm ci' then re-vendor, or restore from source control.\n")
        return False
    return True


# -----------------------------------------------------------------------------
# FUNCTION | Start the Server
# -----------------------------------------------------------------------------
def Na__LocalServer__Start(preferred_port, open_browser):
    for extension, mime_type in EXTRA_MIME_TYPES.items():
        mimetypes.add_type(mime_type, extension)

    port = Na__LocalServer__FindFreePort(preferred_port)
    url  = f"http://localhost:{port}/{APP_ENTRY_POINT}"

    print("=" * 70)
    print("  NOBLE BIM ASSET TOOLS - LOCAL SERVER")
    print("=" * 70)
    print(f"  Root : {PROJECT_ROOT}")
    print(f"  URL  : {url}")
    if port != preferred_port:
        print(f"  Note : port {preferred_port} was busy, using {port} instead.")
    print("=" * 70)

    Na__LocalServer__CheckDependencies()

    # -- Report whether Revit conversion is available at this start ------------
    capabilities = RevitConvert.Na__RevitConvert__Capabilities()
    if capabilities["converterFound"]:
        print(f"  Revit to IFC : ENABLED  ({capabilities['converterName']})")
    else:
        print("  Revit to IFC : UNAVAILABLE - converter not found.")
        print("                 RVT and RFA files will still be audited for metadata.")

    print("=" * 70)
    print("  Ctrl+C to stop.\n")

    if open_browser:
        webbrowser.open(url)

    with Na__LocalServer__ThreadedServer(("127.0.0.1", port), Na__LocalServer__Handler) as server:
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\n  Server stopped.")


# -----------------------------------------------------------------------------
# ENTRY POINT
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Local server for Noble BIM Asset Tools.")
    parser.add_argument("--port",       type=int, default=DEFAULT_PORT, help=f"Preferred port (default {DEFAULT_PORT}).")
    parser.add_argument("--no-browser", action="store_true",            help="Do not open a browser window on start.")
    arguments = parser.parse_args()

    Na__LocalServer__Start(arguments.port, not arguments.no_browser)

# endregion -------------------------------------------------------------------
