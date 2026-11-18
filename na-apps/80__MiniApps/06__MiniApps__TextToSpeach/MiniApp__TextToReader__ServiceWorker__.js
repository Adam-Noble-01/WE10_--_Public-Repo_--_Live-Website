// =============================================================================
// NOBLE ARCHITECTURE - TEXT TO READER - OFFLINE APPLICATION SHELL
// =============================================================================


// REGION | Configuration
// --------------------------------------------------------
const Na__Reader__ShellCacheName = "NaTextToReader__Shell__v1.9.7";
const Na__Reader__RuntimeBase = "./02__PhononRuntime/";
const Na__Reader__ShellFiles = [
    "./MiniApp__TextToReader__Main__.html",
    // Versioned like the scripts: Main.js asks for the config by its release's ?v=
    "./MiniApp__TextToReader__AppConfig__.json?v=1.9.7",
    "./MiniApp__TextToReader__Manifest__.webmanifest",
    "./MiniApp__TextToReader__Style__.css?v=1.9.7",
    "./MiniApp__TextToReader__MarkdownStyle__.css?v=1.9.7",
    "./MiniApp__TextToReader__ReadAloud__.css?v=1.9.7",
    "./01__AppModules/MiniApp__TextToReader__Main__.js?v=1.9.7",
    "./01__AppModules/MiniApp__TextToReader__ViewTabs__.js?v=1.9.7",
    "./01__AppModules/MiniApp__TextToReader__FileUpload__.js?v=1.9.7",
    "./01__AppModules/MiniApp__TextToReader__PdfRenderer__.js?v=1.9.7",
    "./01__AppModules/MiniApp__TextToReader__DragDrop__.js?v=1.9.7",
    "./01__AppModules/MiniApp__TextToReader__PdfOcr__.js?v=1.9.7",
    "./01__AppModules/MiniApp__TextToReader__OcrModal__.js?v=1.9.7",
    // The OCR module starts its worker with its own ?v=, so the worker is cached in that form
    "./01__AppModules/MiniApp__TextToReader__PdfOcrWorker__.js?v=1.9.7",
    "./01__AppModules/MiniApp__TextToReader__MarkdownRender__.js?v=1.9.7",
    "./01__AppModules/MiniApp__TextToReader__WhatsAppParser__.js?v=1.9.7",
    "./01__AppModules/MiniApp__TextToReader__CsvTable__.js?v=1.9.7",
    "./01__AppModules/MiniApp__TextToReader__CompactTransport__.js?v=1.9.7",
    "./01__AppModules/MiniApp__TextToReader__ReadAloud__.js?v=1.9.7",
    "./01__AppModules/MiniApp__TextToReader__SpeechEngines__.js?v=1.9.7",
    "./01__AppModules/MiniApp__TextToReader__ActivityLog__.js?v=1.9.7",
    "./01__AppModules/MiniApp__TextToReader__Highlight__.js?v=1.9.7",
    "./01__AppModules/MiniApp__TextToReader__Sections__.js?v=1.9.7",
    "./01__AppModules/MiniApp__TextToReader__SourceModal__.js?v=1.9.7",
    "./01__AppModules/MiniApp__TextToReader__WordJump__.js?v=1.9.7",
    "./01__AppModules/MiniApp__TextToReader__UserConfig__.js?v=1.9.7",
    "./01__AppAssets__TextToReader/UiIcons__MenuIcons__ReadAloud/Icon__ReadAloud__Play__.svg",
    "./01__AppAssets__TextToReader/UiIcons__MenuIcons__ReadAloud/Icon__ReadAloud__Pause__.svg",
    "./01__AppAssets__TextToReader/UiIcons__MenuIcons__ReadAloud/Icon__ReadAloud__PlayFromStart__.svg",
    "./01__AppAssets__TextToReader/UiIcons__MenuIcons__ReadAloud/Icon__ReadAloud__PasteClipboard__.svg",
    "./01__AppAssets__TextToReader/UiIcons__MenuIcons__ReadAloud/Icon__ReadAloud__OpenFile__.svg",
    "./01__AppAssets__TextToReader/UiIcons__MenuIcons__ReadAloud/Icon__ReadAloud__SpeedDial__.svg",
    "./01__AppAssets__TextToReader/UiIcons__MenuIcons__ReadAloud/Icon__ReadAloud__PlayPause__.svg",
    "./01__AppAssets__TextToReader/UiIcons__MenuIcons__ReadAloud/Icon__ReadAloud__Prepare__.svg",
    "./01__AppAssets__TextToReader/UiIcons__MenuIcons__ReadAloud/Icon__ReadAloud__Stop__.svg",
    "./01__AppAssets__TextToReader/UiIcons__MenuIcons__ReadAloud/Icon__ReadAloud__DownloadVoiceModel__.svg",
    "./01__AppAssets__TextToReader/UiIcons__MenuIcons__ReadAloud/Icon__ReadAloud__AudioPlaying__.svg",
    "./01__AppAssets__TextToReader/UiIcons__MenuIcons__ReadAloud/Icon__ReadAloud__VoiceModel__.svg",
    "./01__AppAssets__TextToReader/UiIcons__MenuIcons__ReadAloud/Icon__ReadAloud__Info__.svg",
    "./01__AppAssets__TextToReader/UiIcons__MenuIcons__ReadAloud/Icon__ReadAloud__FullScreen__.svg",
    "./01__AppAssets__TextToReader/UiIcons__MenuIcons__ReadAloud/Icon__ReadAloud__FullScreenExit__.svg",
    "./01__AppAssets__TextToReader/UiIcons__MenuIcons__ReadAloud/Icon__ReadAloud__Sections__.svg",
    "./01__AppAssets__TextToReader/UiIcons__MenuIcons__ReadAloud/Icon__ReadAloud__Pitch__.svg",
    "./01__AppAssets__TextToReader/Logos__NobleArchitecture/Logo__NobleArchitecture__ProfileMark__GreyBg__.svg",
    "../../../assets/AD02_-_STYL_-_Common_-_StyleSheets/AD02_30_-_STYL_-_Core-Default-Web-Utility-App-Stylesheet.css",
    "../../01__Assets__NaApps__CommonAssets/NaApps__CommonIcons/CommonIcon__NaLogoFavicon__PNG-h192px.png",
    "../../01__Assets__NaApps__CommonAssets/NaApps__CommonIcons/CommonIcon__NaLogoFavicon__PNG-h512px.png",
    Na__Reader__RuntimeBase + "marked.esm.js",
    Na__Reader__RuntimeBase + "index.js",
    Na__Reader__RuntimeBase + "hub.js",
    Na__Reader__RuntimeBase + "wav.js",
    Na__Reader__RuntimeBase + "fetch.js",
    Na__Reader__RuntimeBase + "worker.js",
    Na__Reader__RuntimeBase + "threads.js",
    Na__Reader__RuntimeBase + "device.js",
    Na__Reader__RuntimeBase + "simd.js",
    Na__Reader__RuntimeBase + "wasm/phonon_tts.js",
    Na__Reader__RuntimeBase + "wasm/phonon_tts_bg.wasm",
    Na__Reader__RuntimeBase + "wasm/phonon_tts_simd_bg.wasm",
    Na__Reader__RuntimeBase + "wasm-threads/phonon_tts.js",
    Na__Reader__RuntimeBase + "wasm-threads/phonon_tts_bg.wasm",
    Na__Reader__RuntimeBase + "wasm-threads/phonon_tts_simd_bg.wasm",
    // The thread workers' own script (wasm-bindgen-rayon); without it threads fail offline
    Na__Reader__RuntimeBase + "wasm-threads/snippets/wasm-bindgen-rayon-38edf6e439f6d70d/src/workerHelpers.js"
];

// PDF.js (pdfjs-dist, pinned) has its own cache, named by its version, which outlasts app
// releases. Its main module and worker carry the version in their URL and must always
// match, so a new PDF.js version is a new cache and the old one is deleted. The files a
// PDF needs to open offline are stored at install; cMaps (CJK PDFs only) when first used.
const Na__Reader__PdfJsVersion   = "6.5.438";
const Na__Reader__PdfJsBase      = "./04__PdfJsRuntime/";
const Na__Reader__PdfJsCacheName = "NaTextToReader__PdfJsRuntime__" + Na__Reader__PdfJsVersion;
const Na__Reader__PdfJsFiles = [
    "build/pdf.min.mjs?v=" + Na__Reader__PdfJsVersion,
    "build/pdf.worker.min.mjs?v=" + Na__Reader__PdfJsVersion,
    "wasm/jbig2.wasm",
    "wasm/openjpeg.wasm",
    "wasm/qcms_bg.wasm",
    "iccs/CGATS001Compat-v2-micro.icc",
    "standard_fonts/FoxitDingbats.pfb",
    "standard_fonts/FoxitFixed.pfb",
    "standard_fonts/FoxitFixedBold.pfb",
    "standard_fonts/FoxitFixedBoldItalic.pfb",
    "standard_fonts/FoxitFixedItalic.pfb",
    "standard_fonts/FoxitSerif.pfb",
    "standard_fonts/FoxitSerifBold.pfb",
    "standard_fonts/FoxitSerifBoldItalic.pfb",
    "standard_fonts/FoxitSerifItalic.pfb",
    "standard_fonts/FoxitSymbol.pfb",
    "standard_fonts/LiberationSans-Bold.ttf",
    "standard_fonts/LiberationSans-BoldItalic.ttf",
    "standard_fonts/LiberationSans-Italic.ttf",
    "standard_fonts/LiberationSans-Regular.ttf"
].map((Na__Path) => Na__Reader__PdfJsBase + Na__Path);

// The OCR runtime and models (05__PaddleOcrRuntime) are installed into their own cache,
// NaTextToReader__PaddleOcr__v1, by the OCR module once the user agrees (SHA-256 checked);
// this worker only serves them from there, never copying tens of megabytes into the shell
// cache, and PurgeOldShells never deletes that cache.
const Na__Reader__OcrBase = "./05__PaddleOcrRuntime/";

// Cross-origin isolation: the page may only share memory with its worker threads
// (SharedArrayBuffer, which multi-threaded WebAssembly needs) when it is served with
// these headers. GitHub Pages cannot set them, so every same-origin response this
// worker hands out carries them. Model files come from cdn.noble-architecture.com,
// which answers with CORS, as require-corp needs.
const Na__Reader__IsolationHeaders = {
    "Cross-Origin-Opener-Policy"   : "same-origin",
    "Cross-Origin-Embedder-Policy" : "require-corp",
    "Cross-Origin-Resource-Policy" : "same-origin"
};
// endregion -------------------------------------------------------------------


// REGION | Installation And Activation
// --------------------------------------------------------

// FUNCTION | CacheShell - Install all dependencies required by offline mode
// --------------------------------------------------------
async function Na__Reader__CacheShell() {
    const Na__Cache = await caches.open(Na__Reader__ShellCacheName);
    await Na__Cache.addAll(Na__Reader__ShellFiles.map((Na__Path) =>
        new URL(Na__Path, self.registration.scope)
    ));
}
// --------------------------------------------------------


// FUNCTION | CachePdfJsRuntime - Store PDF.js for offline use; a missing file never blocks install
// --------------------------------------------------------
async function Na__Reader__CachePdfJsRuntime() {
    const Na__Cache = await caches.open(Na__Reader__PdfJsCacheName);
    await Promise.all(Na__Reader__PdfJsFiles.map(async (Na__Path) => {
        const Na__Url = new URL(Na__Path, self.registration.scope);
        if (await Na__Cache.match(Na__Url)) return;
        try {
            const Na__Response = await fetch(Na__Url);
            if (Na__Response.ok) await Na__Cache.put(Na__Url, Na__Response);
        } catch { /* offline at install: cached on first use instead */ }
    }));
}
// --------------------------------------------------------


// FUNCTION | PurgeOldShells - Preserve the voice caches (Phonon, Kokoro and its runtime)
// and NaTextToReader__UserConfig, which holds this user's settings file
// --------------------------------------------------------
async function Na__Reader__PurgeOldShells() {
    const Na__Names = await caches.keys();
    await Promise.all(Na__Names.filter((Na__Name) =>
        (Na__Name.startsWith("NaTextToReader__Shell__") && Na__Name !== Na__Reader__ShellCacheName) ||
        (Na__Name.startsWith("NaTextToReader__PdfJsRuntime__") && Na__Name !== Na__Reader__PdfJsCacheName)
    ).map((Na__Name) => caches.delete(Na__Name)));
}
// --------------------------------------------------------


self.addEventListener("install", (Na__Event) => {
    Na__Event.waitUntil(Na__Reader__CacheShell()
        .then(() => Na__Reader__CachePdfJsRuntime().catch(() => {}))
        .then(() => self.skipWaiting()));
});

self.addEventListener("activate", (Na__Event) => {
    Na__Event.waitUntil(Na__Reader__PurgeOldShells().then(() => self.clients.claim()));
});
// endregion -------------------------------------------------------------------


// REGION | Fetch
// --------------------------------------------------------

// FUNCTION | WithIsolationHeaders - Copy a response, adding the cross-origin isolation headers
// --------------------------------------------------------
// A redirected or opaque response is passed on untouched: re-wrapping a redirect would
// show the page at the wrong address, and an opaque body cannot be read.
function Na__Reader__WithIsolationHeaders(Na__Response) {
    if (!Na__Response || Na__Response.type === "opaque" || Na__Response.type === "opaqueredirect" ||
        Na__Response.redirected || Na__Response.status === 0) {
        return Na__Response;
    }
    const Na__Headers = new Headers(Na__Response.headers);
    for (const [Na__Name, Na__Value] of Object.entries(Na__Reader__IsolationHeaders)) {
        Na__Headers.set(Na__Name, Na__Value);
    }
    return new Response(Na__Response.body, {
        status     : Na__Response.status,
        statusText : Na__Response.statusText,
        headers    : Na__Headers
    });
}
// --------------------------------------------------------


// FUNCTION | ServeLocalShell - Prefer offline cache, refresh navigations online
// --------------------------------------------------------
// Files missing from the versioned shell are looked up in every cache, which is where
// the Kokoro runtime lives once its voice is downloaded (it outlasts app releases).
async function Na__Reader__ServeLocalShell(Na__Request) {
    const Na__Path = new URL(Na__Request.url).pathname;
    const Na__Scope = new URL(self.registration.scope).pathname;
    if (Na__Path.startsWith(Na__Scope + Na__Reader__PdfJsBase.slice(2))) return Na__Reader__ServeFromCache(Na__Request, Na__Reader__PdfJsCacheName);
    if (Na__Path.startsWith(Na__Scope + Na__Reader__OcrBase.slice(2))) return (await caches.match(Na__Request)) || fetch(Na__Request);

    const Na__Cache = await caches.open(Na__Reader__ShellCacheName);
    const Na__Cached = await Na__Cache.match(Na__Request) ||
        (Na__Request.mode === "navigate" ? undefined : await caches.match(Na__Request));

    if (Na__Request.mode === "navigate") {
        try {
            const Na__Response = await fetch(Na__Request);
            if (Na__Response.ok) await Na__Cache.put(Na__Request, Na__Response.clone());
            return Na__Response;

        } catch (Na__Error) {
            if (Na__Cached) return Na__Cached;
            return (await Na__Cache.match(new URL(
                "./MiniApp__TextToReader__Main__.html",
                self.registration.scope
            ))) || Response.error();
        }
    }

    if (Na__Cached) return Na__Cached;

    const Na__Response = await fetch(Na__Request);
    if (Na__Response.ok && Na__Response.type === "basic") {
        await Na__Cache.put(Na__Request, Na__Response.clone()).catch(() => {});
    }
    return Na__Response;
}
// --------------------------------------------------------


// FUNCTION | ServeFromCache - Cache-first from one named cache, filling it on a miss
// --------------------------------------------------------
async function Na__Reader__ServeFromCache(Na__Request, Na__CacheName) {
    const Na__Cache = await caches.open(Na__CacheName);
    const Na__Cached = await Na__Cache.match(Na__Request);
    if (Na__Cached) return Na__Cached;
    const Na__Response = await fetch(Na__Request);
    if (Na__Response.ok && Na__Response.type === "basic") {
        await Na__Cache.put(Na__Request, Na__Response.clone()).catch(() => {});
    }
    return Na__Response;
}
// --------------------------------------------------------


self.addEventListener("fetch", (Na__Event) => {
    if (Na__Event.request.method !== "GET") return;
    if (new URL(Na__Event.request.url).origin !== self.location.origin) return;
    Na__Event.respondWith(Na__Reader__ServeLocalShell(Na__Event.request).then(Na__Reader__WithIsolationHeaders));
});
// endregion -------------------------------------------------------------------
