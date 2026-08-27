// =============================================================================
// TRUEVISION3D - PWA URL CONSTRUCTOR
// =============================================================================
//
// FILE       : TrueVision__Pwa__Url__Constructor__.js
// NAMESPACE  : TrueVision3D
// MODULE     : TrueVision__Pwa__Url
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Single source of truth for every absolute URL the PWA needs
// CREATED    : 27-Aug-2026
//
// DESCRIPTION:
// - Every URL inside a dynamically generated (data: URL) web app manifest has
//   to be ABSOLUTE, because a data: URL carries no base to resolve against.
//   This module is the one place that builds those absolute URLs.
// - The app root is found by walking the current pathname until the
//   "30__TrueVision__CoreAppCode" folder token is located. This resolves
//   identically on:
//     * localhost dev server serving the repo root (http://localhost:8081/)
//     * production custom domain (https://www.noble-architecture.com/)
//     * GitHub Pages project-page hosting (https://<user>.github.io/<repo>/)
// - Falls back to the directory of the current document if the folder token is
//   missing, so a relocated or renamed deployment still resolves sanely.
// - The service worker script deliberately lives at the app root so its scope
//   covers the whole TrueVision app. GitHub Pages cannot emit a
//   Service-Worker-Allowed header, so script location IS the scope.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 27-Aug-2026 - Version 1.0.0
// - Initial release, ported from the ValeVision3D / Whitecardopedia PWA stack.
//
// =============================================================================

(function () {

// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Path Segments and Filenames
    // ------------------------------------------------------------
    const PWA_URL_APP_FOLDER_TOKEN      = '30__TrueVision__CoreAppCode';                                                            // <-- Folder that anchors the TrueVision app root
    const PWA_URL_APP_ENTRY_FILENAME    = 'Index.html';                                                                             // <-- Application entry document
    const PWA_URL_SERVICE_WORKER_FILE   = 'Na__Pwa__ServiceWorker__.js';                                                            // <-- SW stub sitting at the app root
    const PWA_URL_MODULE_PATH           = '02__Src__AppModules/62__Feature__AppInstallability/';                                    // <-- This module folder, relative to app root
    const PWA_URL_FALLBACK_MANIFEST     = 'TrueVision__Pwa__Manifest__Fallback__.webmanifest';                                      // <-- Static manifest used when the builder cannot run
    const PWA_URL_META_BASE_OVERRIDE    = 'truevision-pwa-base';                                                                    // <-- Optional meta tag override for odd deployments
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Shared Noble Architecture Icon Assets
    // ------------------------------------------------------------
    const PWA_URL_NA_APPS_TOKEN         = 'na-apps';                                                                                // <-- Folder that anchors the shared na-apps root
    const PWA_URL_ICON_FOLDER           = '01__Assets__NaApps__CommonAssets/NaApps__CommonIcons/';                                   // <-- Shared icon folder under na-apps
    const PWA_URL_ICON_192_FILENAME     = 'CommonIcon__NaLogoFavicon__PNG-h192px.png';                                              // <-- 192x192 square PNG
    const PWA_URL_ICON_512_FILENAME     = 'CommonIcon__NaLogoFavicon__PNG-h512px.png';                                              // <-- 512x512 square PNG
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Internal Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Ensure Trailing Slash on URL
    // ---------------------------------------------------------------
    function TrueVision__Pwa__Url__EnsureTrailingSlash(targetUrl) {
        if (!targetUrl) return targetUrl;                                                                                           // <-- Pass through falsy values untouched
        return targetUrl.endsWith('/') ? targetUrl : `${targetUrl}/`;                                                               // <-- Append slash when missing
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Read Optional Meta Tag Override
    // ---------------------------------------------------------------
    function TrueVision__Pwa__Url__ReadMetaOverride() {
        if (typeof document === 'undefined') return null;                                                                           // <-- Guard non-DOM contexts
        const metaTag       = document.querySelector(`meta[name="${PWA_URL_META_BASE_OVERRIDE}"]`);                                  // <-- Locate optional override
        if (!metaTag) return null;                                                                                                  // <-- No override declared

        const overrideValue = (metaTag.getAttribute('content') || '').trim();                                                       // <-- Pull and trim value
        if (!overrideValue) return null;                                                                                            // <-- Empty value treated as absent

        return TrueVision__Pwa__Url__EnsureTrailingSlash(new URL(overrideValue, window.location.href).href);                        // <-- Normalise to absolute plus trailing slash
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Resolve App Root by Folder Token Probe
    // ---------------------------------------------------------------
    function TrueVision__Pwa__Url__ResolveAppRootByPathname() {
        const pathname      = window.location.pathname || '/';                                                                      // <-- Current pathname
        const segments      = pathname.split('/').filter(Boolean);                                                                  // <-- Drop empty splits
        const tokenIndex    = segments.indexOf(PWA_URL_APP_FOLDER_TOKEN);                                                           // <-- Locate the app folder anchor
        if (tokenIndex === -1) return null;                                                                                         // <-- Token absent, caller falls back

        const upToToken     = segments.slice(0, tokenIndex + 1).join('/');                                                          // <-- Keep everything up to the token inclusive
        return `${window.location.origin}/${upToToken}/`;                                                                           // <-- Absolute app root with trailing slash
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Resolve App Root from Current Document Directory
    // ---------------------------------------------------------------
    function TrueVision__Pwa__Url__ResolveAppRootByDocumentDirectory() {
        const documentUrl   = new URL(window.location.href);                                                                        // <-- Parse current document URL
        const directoryPath = documentUrl.pathname.replace(/[^/]*$/, '');                                                           // <-- Strip the filename, keep the folder
        return `${documentUrl.origin}${TrueVision__Pwa__Url__EnsureTrailingSlash(directoryPath)}`;                                  // <-- Absolute directory URL
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Resolve Shared na-apps Root by Folder Token Probe
    // ---------------------------------------------------------------
    function TrueVision__Pwa__Url__ResolveNaAppsRoot() {
        const pathname      = window.location.pathname || '/';                                                                      // <-- Current pathname
        const segments      = pathname.split('/').filter(Boolean);                                                                  // <-- Drop empty splits
        const tokenIndex    = segments.indexOf(PWA_URL_NA_APPS_TOKEN);                                                              // <-- Locate the na-apps anchor
        if (tokenIndex === -1) return null;                                                                                         // <-- Token absent, caller falls back

        const upToToken     = segments.slice(0, tokenIndex + 1).join('/');                                                          // <-- Keep everything up to na-apps inclusive
        return `${window.location.origin}/${upToToken}/`;                                                                           // <-- Absolute na-apps root with trailing slash
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Resolve TrueVision App Root URL
    // ------------------------------------------------------------
    function TrueVision__Pwa__Url__GetAppRoot() {
        const overrideUrl   = TrueVision__Pwa__Url__ReadMetaOverride();                                                             // <-- Honour explicit override first
        if (overrideUrl) return overrideUrl;

        const tokenRoot     = TrueVision__Pwa__Url__ResolveAppRootByPathname();                                                     // <-- Probe pathname for the app folder token
        if (tokenRoot) return tokenRoot;

        return TrueVision__Pwa__Url__ResolveAppRootByDocumentDirectory();                                                           // <-- Final fallback: current document folder
    }
    // ---------------------------------------------------------------


    // FUNCTION | Resolve Application Entry Document URL (no query string)
    // ------------------------------------------------------------
    function TrueVision__Pwa__Url__GetAppEntryUrl() {
        return `${TrueVision__Pwa__Url__GetAppRoot()}${PWA_URL_APP_ENTRY_FILENAME}`;                                                // <-- Absolute Index.html URL
    }
    // ---------------------------------------------------------------


    // FUNCTION | Resolve PWA Module Folder URL
    // ------------------------------------------------------------
    function TrueVision__Pwa__Url__GetModuleRoot() {
        return `${TrueVision__Pwa__Url__GetAppRoot()}${PWA_URL_MODULE_PATH}`;                                                       // <-- Absolute module folder URL
    }
    // ---------------------------------------------------------------


    // FUNCTION | Build Absolute URL from a Module-Relative Path
    // ------------------------------------------------------------
    function TrueVision__Pwa__Url__BuildModuleUrl(relativePath) {
        const cleanRelative = String(relativePath || '').replace(/^\/+/, '');                                                       // <-- Strip any leading slashes
        return `${TrueVision__Pwa__Url__GetModuleRoot()}${cleanRelative}`;                                                          // <-- Concatenate onto module root
    }
    // ---------------------------------------------------------------


    // FUNCTION | Resolve Service Worker Script URL
    // ------------------------------------------------------------
    function TrueVision__Pwa__Url__GetServiceWorkerUrl() {
        return `${TrueVision__Pwa__Url__GetAppRoot()}${PWA_URL_SERVICE_WORKER_FILE}`;                                               // <-- SW stub lives at the app root
    }
    // ---------------------------------------------------------------


    // FUNCTION | Resolve Service Worker Scope URL
    // ------------------------------------------------------------
    function TrueVision__Pwa__Url__GetServiceWorkerScope() {
        return TrueVision__Pwa__Url__GetAppRoot();                                                                                  // <-- Scope equals app root (max scope without headers)
    }
    // ---------------------------------------------------------------


    // FUNCTION | Resolve Static Fallback Manifest URL
    // ------------------------------------------------------------
    function TrueVision__Pwa__Url__GetFallbackManifestUrl() {
        return TrueVision__Pwa__Url__BuildModuleUrl(PWA_URL_FALLBACK_MANIFEST);                                                     // <-- Static manifest inside this module folder
    }
    // ---------------------------------------------------------------


    // FUNCTION | Resolve Shared Application Icon URLs
    // ------------------------------------------------------------
    function TrueVision__Pwa__Url__GetIconUrls() {
        const naAppsRoot    = TrueVision__Pwa__Url__ResolveNaAppsRoot();                                                            // <-- Shared na-apps root when discoverable

        const iconFolder    = naAppsRoot
            ? `${naAppsRoot}${PWA_URL_ICON_FOLDER}`                                                                                 // <-- Same-origin shared icon folder
            : `${TrueVision__Pwa__Url__GetAppRoot()}../${PWA_URL_ICON_FOLDER}`;                                                     // <-- Relative hop up from the app root

        const normalisedUrl = new URL(iconFolder, window.location.href).href;                                                       // <-- Collapse any parent-folder segments

        return {
            icon192 : `${normalisedUrl}${PWA_URL_ICON_192_FILENAME}`,                                                               // <-- 192x192 absolute URL
            icon512 : `${normalisedUrl}${PWA_URL_ICON_512_FILENAME}`                                                                // <-- 512x512 absolute URL
        };
    }
    // ---------------------------------------------------------------


    // FUNCTION | Detect Localhost Runtime
    // ------------------------------------------------------------
    function TrueVision__Pwa__Url__IsLocalhost() {
        if (typeof window === 'undefined') return false;                                                                            // <-- Guard non-window contexts
        const hostname      = window.location.hostname || '';                                                                       // <-- Current hostname
        return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';                                      // <-- Recognised localhost hostnames
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Global Exposure
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Global URL Helper Namespace
    // ------------------------------------------------------------
    function TrueVision__Pwa__Url__InitializeGlobalNamespace() {
        if (typeof window === 'undefined') return;                                                                                  // <-- Guard non-window contexts

        window.TrueVision__Pwa__Url = {                                                                                             // <-- Public API surface
            getAppRoot              : TrueVision__Pwa__Url__GetAppRoot,
            getAppEntryUrl          : TrueVision__Pwa__Url__GetAppEntryUrl,
            getModuleRoot           : TrueVision__Pwa__Url__GetModuleRoot,
            buildModuleUrl          : TrueVision__Pwa__Url__BuildModuleUrl,
            getServiceWorkerUrl     : TrueVision__Pwa__Url__GetServiceWorkerUrl,
            getServiceWorkerScope   : TrueVision__Pwa__Url__GetServiceWorkerScope,
            getFallbackManifestUrl  : TrueVision__Pwa__Url__GetFallbackManifestUrl,
            getIconUrls             : TrueVision__Pwa__Url__GetIconUrls,
            isLocalhost             : TrueVision__Pwa__Url__IsLocalhost
        };
    }
    // ---------------------------------------------------------------


    TrueVision__Pwa__Url__InitializeGlobalNamespace();                                                                              // <-- Mount on window immediately

// endregion -------------------------------------------------------------------

})();
