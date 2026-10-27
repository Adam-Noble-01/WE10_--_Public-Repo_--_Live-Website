"""
Text To Reader - local development server.

Serves the WHOLE SITE ROOT (the app links ../../../assets and ../../01__Assets...)
on http://localhost:8765/ (override with --port), opening the reader, with:
  - no-store caching, so edits show on a plain reload
  - correct MIME types for .js/.mjs/.wasm/.webmanifest/.json
  - cross-origin isolation headers (COOP/COEP) so the threaded Phonon WASM can run
  - 02__PhononRuntime fetched on first run (phonon-tts + marked via npm, as in
    .github/workflows/static.yml); it is git-ignored, never committed
  - 03__KokoroRuntime fetched on first run too (kokoro-js + ONNX Runtime wasm),
    also git-ignored
  - the app's cache-first service worker replaced by one that removes itself and
    clears the app-shell cache (the downloaded voice model is kept), so edits are
    never hidden behind a stale cache; pass --with-sw to test the real offline worker
  - a '/__dev__/sw-reset' page that unregisters service workers and clears caches,
    for when a stale service worker is serving old files

Usage:  python MiniApp__TextToReader__DevServer__.py [--port 8765] [--no-browser] [--with-sw]
"""
import argparse
import functools
import http.server
import os
import shutil
import socketserver
import subprocess
import tarfile
import tempfile
import webbrowser

Na__Dev__AppDir = os.path.dirname(os.path.abspath(__file__))
Na__Dev__SiteRoot = os.path.normpath(os.path.join(Na__Dev__AppDir, "..", "..", ".."))
Na__Dev__MainPage = "/na-apps/80__MiniApps/06__MiniApps__TextToSpeach/MiniApp__TextToReader__Main__.html"
Na__Dev__RuntimeDir = os.path.join(Na__Dev__AppDir, "02__PhononRuntime")
Na__Dev__PhononPkg = "phonon-tts@0.4.0"
Na__Dev__MarkedPkg = "marked@15.0.12"
Na__Dev__KokoroDir = os.path.join(Na__Dev__AppDir, "03__KokoroRuntime")
Na__Dev__KokoroPkg = "kokoro-js@1.2.1"
Na__Dev__TransformersPkg = "@huggingface/transformers@3.5.1"   # supplies ONNX Runtime's wasm


def Na__Dev__NpmPackExtract(pkg, dest, strip=1):
    """npm pack <pkg> and extract it into dest, dropping the leading 'package/' folder."""
    with tempfile.TemporaryDirectory() as tmp:
        name = subprocess.run(["npm", "pack", pkg, "--pack-destination", tmp, "--silent"],
                              check=True, capture_output=True, text=True, shell=(os.name == "nt")
                              ).stdout.strip().splitlines()[-1]
        os.makedirs(dest, exist_ok=True)
        with tarfile.open(os.path.join(tmp, name)) as tf:
            for m in tf.getmembers():
                parts = m.name.split("/")[strip:]
                if not parts or not m.isfile():
                    continue
                target = os.path.join(dest, *parts)
                os.makedirs(os.path.dirname(target), exist_ok=True)
                with tf.extractfile(m) as src, open(target, "wb") as out:
                    shutil.copyfileobj(src, out)


def Na__Dev__EnsureRuntime():
    needed = ["index.js", "worker.js", "marked.esm.js",
              os.path.join("wasm", "phonon_tts_bg.wasm"),
              os.path.join("wasm-threads", "phonon_tts_bg.wasm")]
    if all(os.path.getsize(os.path.join(Na__Dev__RuntimeDir, n)) > 0
           if os.path.exists(os.path.join(Na__Dev__RuntimeDir, n)) else False for n in needed):
        return
    print("Fetching Phonon + Marked runtime into 02__PhononRuntime (first run only)...")
    try:
        Na__Dev__NpmPackExtract(Na__Dev__PhononPkg, Na__Dev__RuntimeDir)
        with tempfile.TemporaryDirectory() as tmp:
            Na__Dev__NpmPackExtract(Na__Dev__MarkedPkg, tmp)
            shutil.copy(os.path.join(tmp, "lib", "marked.esm.js"),
                        os.path.join(Na__Dev__RuntimeDir, "marked.esm.js"))
    except (OSError, subprocess.CalledProcessError) as e:
        print(f"WARNING: could not fetch the runtime ({e}). Needs Node/npm and internet; "
              "the app will not start without marked.esm.js.")


def Na__Dev__EnsureKokoroRuntime():
    """kokoro-js web bundle + ONNX Runtime wasm into 03__KokoroRuntime, as the Pages workflow does."""
    needed = ["kokoro.web.js", "ort-wasm-simd-threaded.jsep.mjs", "ort-wasm-simd-threaded.jsep.wasm"]
    if all(os.path.exists(os.path.join(Na__Dev__KokoroDir, n)) and
           os.path.getsize(os.path.join(Na__Dev__KokoroDir, n)) > 0 for n in needed):
        return
    print("Fetching Kokoro runtime into 03__KokoroRuntime (first run only)...")
    try:
        os.makedirs(Na__Dev__KokoroDir, exist_ok=True)
        with tempfile.TemporaryDirectory() as tmp:
            Na__Dev__NpmPackExtract(Na__Dev__KokoroPkg, os.path.join(tmp, "kokoro"))
            Na__Dev__NpmPackExtract(Na__Dev__TransformersPkg, os.path.join(tmp, "transformers"))
            shutil.copy(os.path.join(tmp, "kokoro", "dist", "kokoro.web.js"), Na__Dev__KokoroDir)
            for name in needed[1:]:
                shutil.copy(os.path.join(tmp, "transformers", "dist", name), Na__Dev__KokoroDir)
    except (OSError, subprocess.CalledProcessError) as e:
        print(f"WARNING: could not fetch the Kokoro runtime ({e}). Phonon voices still work.")

Na__Dev__ServiceWorkerPath = Na__Dev__MainPage.rsplit("/", 1)[0] + "/MiniApp__TextToReader__ServiceWorker__.js"
Na__Dev__UseRealServiceWorker = False

Na__Dev__KillSwitchWorker = b"""// Dev server stand-in: remove the app-shell cache and this worker, keep the Phonon model cache
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil((async () => {
  for (const name of await caches.keys()) {
    if (name.startsWith("NaTextToReader__Shell__")) await caches.delete(name);
  }
  await self.registration.unregister();
})()));
"""

Na__Dev__SwResetHtml = b"""<!doctype html><meta charset="utf-8"><title>SW reset</title>
<body style="font:16px system-ui;padding:2rem"><pre id="o">Resetting...</pre><script>
(async () => {
  const o = document.getElementById('o'); let log = [];
  for (const r of await navigator.serviceWorker.getRegistrations()) { await r.unregister(); log.push('unregistered ' + r.scope); }
  for (const k of await caches.keys()) { await caches.delete(k); log.push('deleted cache ' + k); }
  o.textContent = (log.join('\\n') || 'Nothing to clear.') + '\\n\\nDone. <a>';
  o.innerHTML = o.textContent.replace('<a>', '<a href="/">Open the app</a>');
})();
</script></body>"""


class Na__Dev__Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".wasm": "application/wasm",
        ".webmanifest": "application/manifest+json",
        ".json": "application/json",
        ".md": "text/markdown; charset=utf-8",
    }

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/":
            self.send_response(302)
            self.send_header("Location", Na__Dev__MainPage)
            self.end_headers()
            return
        if path == Na__Dev__ServiceWorkerPath and not Na__Dev__UseRealServiceWorker:
            self.send_response(200)
            self.send_header("Content-Type", "text/javascript")
            self.send_header("Content-Length", str(len(Na__Dev__KillSwitchWorker)))
            self.end_headers()
            self.wfile.write(Na__Dev__KillSwitchWorker)
            return
        if path == "/__dev__/sw-reset":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(Na__Dev__SwResetHtml)))
            self.end_headers()
            self.wfile.write(Na__Dev__SwResetHtml)
            return
        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "credentialless")
        super().end_headers()


class Na__Dev__Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--no-browser", action="store_true")
    ap.add_argument("--with-sw", action="store_true", help="serve the real offline service worker")
    args = ap.parse_args()
    global Na__Dev__UseRealServiceWorker
    Na__Dev__UseRealServiceWorker = args.with_sw

    Na__Dev__EnsureRuntime()
    Na__Dev__EnsureKokoroRuntime()
    handler = functools.partial(Na__Dev__Handler, directory=Na__Dev__SiteRoot)
    with Na__Dev__Server(("127.0.0.1", args.port), handler) as srv:
        url = f"http://localhost:{args.port}/"
        print(f"Text To Reader dev server: {url}")
        print(f"Serving {Na__Dev__SiteRoot}")
        print("Service worker: " + ("REAL (offline caching on)" if args.with_sw else "disabled for development"))
        print(f"Stale service worker? {url}__dev__/sw-reset")
        if not args.no_browser:
            webbrowser.open(url)
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
