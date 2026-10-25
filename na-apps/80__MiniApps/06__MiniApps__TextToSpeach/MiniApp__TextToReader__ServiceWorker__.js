// =============================================================================
// NOBLE ARCHITECTURE - TEXT TO READER - OFFLINE APPLICATION SHELL
// =============================================================================


// REGION | Configuration
// --------------------------------------------------------
const Na__Reader__ShellCacheName = "NaTextToReader__Shell__v1.7.0";
const Na__Reader__RuntimeBase = "./02__PhononRuntime/";
const Na__Reader__ShellFiles = [
    "./MiniApp__TextToReader__Main__.html",
    "./MiniApp__TextToReader__AppConfig__.json",
    "./MiniApp__TextToReader__Manifest__.webmanifest",
    "./MiniApp__TextToReader__Style__.css?v=1.7.0",
    "./MiniApp__TextToReader__MarkdownStyle__.css?v=1.7.0",
    "./MiniApp__TextToReader__ReadAloud__.css?v=1.7.0",
    "./01__AppModules/MiniApp__TextToReader__Main__.js?v=1.7.0",
    "./01__AppModules/MiniApp__TextToReader__ViewTabs__.js?v=1.7.0",
    "./01__AppModules/MiniApp__TextToReader__FileUpload__.js?v=1.7.0",
    "./01__AppModules/MiniApp__TextToReader__MarkdownRender__.js?v=1.7.0",
    "./01__AppModules/MiniApp__TextToReader__WhatsAppParser__.js?v=1.7.0",
    "./01__AppModules/MiniApp__TextToReader__CsvTable__.js?v=1.7.0",
    "./01__AppModules/MiniApp__TextToReader__ReadAloud__.js?v=1.7.0",
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
    Na__Reader__RuntimeBase + "wasm-threads/phonon_tts_simd_bg.wasm"
];
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


// FUNCTION | PurgeOldShells - Preserve Phonon's independent model cache
// --------------------------------------------------------
async function Na__Reader__PurgeOldShells() {
    const Na__Names = await caches.keys();
    await Promise.all(Na__Names.filter((Na__Name) =>
        Na__Name.startsWith("NaTextToReader__Shell__") &&
        Na__Name !== Na__Reader__ShellCacheName
    ).map((Na__Name) => caches.delete(Na__Name)));
}
// --------------------------------------------------------


self.addEventListener("install", (Na__Event) => {
    Na__Event.waitUntil(Na__Reader__CacheShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (Na__Event) => {
    Na__Event.waitUntil(Na__Reader__PurgeOldShells().then(() => self.clients.claim()));
});
// endregion -------------------------------------------------------------------


// REGION | Fetch
// --------------------------------------------------------

// FUNCTION | ServeLocalShell - Prefer offline cache, refresh navigations online
// --------------------------------------------------------
async function Na__Reader__ServeLocalShell(Na__Request) {
    const Na__Cache = await caches.open(Na__Reader__ShellCacheName);
    const Na__Cached = await Na__Cache.match(Na__Request);

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


self.addEventListener("fetch", (Na__Event) => {
    if (Na__Event.request.method !== "GET") return;
    if (new URL(Na__Event.request.url).origin !== self.location.origin) return;
    Na__Event.respondWith(Na__Reader__ServeLocalShell(Na__Event.request));
});
// endregion -------------------------------------------------------------------
