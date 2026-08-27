// =============================================================================
// TRUEVISION3D - PWA PER-PROJECT MANIFEST BUILDER
// =============================================================================
//
// FILE       : TrueVision__Pwa__Manifest__Builder__.js
// NAMESPACE  : TrueVision3D
// MODULE     : TrueVision__Pwa__Manifest
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Generate a unique web app manifest for the project in the URL
// CREATED    : 27-Aug-2026
//
// DESCRIPTION:
// - THIS IS THE MODULE THAT MAKES EACH CLIENT'S INSTALL UNIQUE.
//
//   TrueVision is one static app serving every project, selected by query
//   string. A single static .webmanifest file would therefore install ONE
//   generic app for everybody, launching at a project-less URL. Instead this
//   module builds the manifest in memory at boot, stamps it with the project
//   from the URL, and injects it as a data: URL manifest link.
//
//   The result, per project:
//       id          -> .../Index.html?project=RB05&project-folder=RB05__WestFarm&year=26
//       start_url   -> the same absolute URL, so the icon opens THAT model
//       name        -> "West Farm - TrueVision 3D"
//       short_name  -> "West Farm"          (the home-screen label)
//
//   Because the manifest id differs per project, a device can hold several
//   TrueVision installs side by side - one per project - without them
//   colliding or overwriting each other.
//
// - Every URL inside the manifest MUST be absolute. A data: URL has no base,
//   so relative paths would fail to resolve. TrueVision__Pwa__Url supplies the
//   absolute forms.
//
// - iOS note: Safari's Add to Home Screen bookmarks the page the user is
//   standing on, so a client installing from their own project link lands on
//   their own project whether or not Safari honours start_url. The Apple meta
//   tags injected below carry the per-project home-screen label.
//
// - This script is loaded as a BLOCKING classic script in <head> so the
//   manifest link is in the DOM before the browser evaluates installability.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 27-Aug-2026 - Version 1.0.0
// - Initial release.
//
// =============================================================================

(function () {

// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Manifest Branding Values
    // ------------------------------------------------------------
    const MANIFEST_THEME_COLOUR         = '#172b3a';                                                                                // <-- Noble Architecture brand blue (matches app header)
    const MANIFEST_BACKGROUND_COLOUR    = '#ffffff';                                                                                // <-- Splash background, matches the app canvas
    const MANIFEST_LANGUAGE             = 'en-GB';                                                                                  // <-- UK English
    const MANIFEST_CATEGORIES           = ['business', 'productivity', 'utilities'];                                                // <-- Store category hints
    const MANIFEST_MIME_TYPE            = 'data:application/manifest+json,';                                                        // <-- Data URL prefix for an inline manifest
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Injected Meta Tag Values
    // ------------------------------------------------------------
    const MANIFEST_APPLE_STATUS_BAR     = 'default';                                                                                // <-- Opaque status bar; app header must not slide under it
    const MANIFEST_ELEMENT_ID_PREFIX    = 'TrueVision__Pwa__Manifest__';                                                            // <-- Prefix for every element this module owns
    // ------------------------------------------------------------


    // MODULE VARIABLES | Injection State
    // ------------------------------------------------------------
    let TrueVision__Pwa__Manifest__LastBuiltObject   = null;                                                                        // <-- Last manifest object, kept for diagnostics
    let TrueVision__Pwa__Manifest__UsingFallbackFile = false;                                                                       // <-- True once we have degraded to the static file
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Manifest Construction
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the Description Line for This Project
    // ---------------------------------------------------------------
    function TrueVision__Pwa__Manifest__BuildDescription(contextData) {
        if (contextData.displayName) {
            return `Explore the ${contextData.displayName} design in full 3D. `                                                     // <-- Project specific description
                 + 'Walk through the model, look around from any angle and see the scheme as it will be built.';
        }

        return 'Explore Noble Architecture designs in full 3D. '                                                                    // <-- Generic description
             + 'Walk through the model, look around from any angle and see the scheme as it will be built.';
    }
    // ---------------------------------------------------------------


    // FUNCTION | Build the Complete Manifest Object for the Current Project
    // ------------------------------------------------------------
    function TrueVision__Pwa__Manifest__BuildObject() {
        const urlHelper     = window.TrueVision__Pwa__Url || null;                                                                  // <-- Absolute URL helper
        const contextModule = window.TrueVision__Pwa__ProjectContext || null;                                                       // <-- Project context helper
        if (!urlHelper || !contextModule) return null;                                                                              // <-- Dependencies missing, caller falls back

        const contextData   = contextModule.get();                                                                                  // <-- Project descriptor
        const launchUrl     = contextModule.getLaunchUrl();                                                                         // <-- Absolute Index.html plus launch query
        const scopeUrl      = urlHelper.getAppRoot();                                                                               // <-- Absolute app root
        const iconUrls      = urlHelper.getIconUrls();                                                                              // <-- Absolute shared icon URLs

        return {
            id                  : launchUrl,                                                                                        // <-- PER-PROJECT IDENTITY (this is the key line)
            name                : contextData.appName,                                                                              // <-- "West Farm - TrueVision 3D"
            short_name          : contextData.shortName,                                                                            // <-- Home-screen label, e.g. "West Farm"
            description         : TrueVision__Pwa__Manifest__BuildDescription(contextData),
            start_url           : launchUrl,                                                                                        // <-- Icon opens straight into this project
            scope               : scopeUrl,                                                                                         // <-- Whole TrueVision app stays in-app
            display             : 'standalone',                                                                                     // <-- No browser chrome
            display_override    : ['standalone', 'minimal-ui', 'browser'],                                                           // <-- Graceful degradation order
            orientation         : 'any',                                                                                            // <-- 3D viewer works in both orientations
            lang                : MANIFEST_LANGUAGE,
            dir                 : 'ltr',
            categories          : MANIFEST_CATEGORIES,
            theme_color         : MANIFEST_THEME_COLOUR,
            background_color    : MANIFEST_BACKGROUND_COLOUR,
            prefer_related_applications : false,
            launch_handler      : {
                client_mode     : 'navigate-existing'                                                                               // <-- Re-use an already open window
            },
            icons               : [
                { src: iconUrls.icon192, sizes: '192x192', type: 'image/png', purpose: 'any'      },
                { src: iconUrls.icon192, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
                { src: iconUrls.icon512, sizes: '512x512', type: 'image/png', purpose: 'any'      },
                { src: iconUrls.icon512, sizes: '512x512', type: 'image/png', purpose: 'maskable' }
            ]
        };
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Encode a Manifest Object as a Data URL
    // ---------------------------------------------------------------
    function TrueVision__Pwa__Manifest__EncodeAsDataUrl(manifestObject) {
        const jsonText      = JSON.stringify(manifestObject);                                                                       // <-- Serialise to JSON
        return `${MANIFEST_MIME_TYPE}${encodeURIComponent(jsonText)}`;                                                              // <-- Percent-encode into a data URL
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | DOM Injection
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Upsert a Meta Tag by Name
    // ---------------------------------------------------------------
    function TrueVision__Pwa__Manifest__UpsertMetaTag(metaName, metaContent) {
        if (!metaContent) return;                                                                                                   // <-- Never write an empty tag

        let metaElement     = document.querySelector(`meta[name="${metaName}"]`);                                                   // <-- Look for an existing tag

        if (!metaElement) {
            metaElement     = document.createElement('meta');                                                                       // <-- Create when absent
            metaElement.setAttribute('name', metaName);
            document.head.appendChild(metaElement);
        }

        metaElement.setAttribute('content', metaContent);                                                                           // <-- Write or overwrite the value
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Upsert the Apple Touch Icon Link
    // ---------------------------------------------------------------
    // iOS ignores SVG apple-touch-icons. The static markup points at the NA
    // SVG favicon, which would leave an installed iPhone icon blank, so this
    // rewrites it to the 192px PNG.
    // ---------------------------------------------------------------
    function TrueVision__Pwa__Manifest__UpsertAppleTouchIcon(iconUrl) {
        if (!iconUrl) return;                                                                                                       // <-- Nothing to point at

        let linkElement     = document.querySelector('link[rel="apple-touch-icon"]');                                               // <-- Look for an existing link

        if (!linkElement) {
            linkElement     = document.createElement('link');                                                                       // <-- Create when absent
            linkElement.setAttribute('rel', 'apple-touch-icon');
            document.head.appendChild(linkElement);
        }

        linkElement.setAttribute('sizes', '192x192');                                                                               // <-- Declare the size explicitly
        linkElement.setAttribute('href', iconUrl);                                                                                  // <-- PNG, not SVG
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Upsert the Manifest Link Element
    // ---------------------------------------------------------------
    function TrueVision__Pwa__Manifest__UpsertManifestLink(manifestHref) {
        let linkElement     = document.querySelector('link[rel="manifest"]');                                                       // <-- Look for an existing link

        if (!linkElement) {
            linkElement     = document.createElement('link');                                                                       // <-- Create when absent
            linkElement.setAttribute('rel', 'manifest');
            linkElement.id  = `${MANIFEST_ELEMENT_ID_PREFIX}Link`;
            document.head.appendChild(linkElement);
        }

        linkElement.setAttribute('href', manifestHref);                                                                             // <-- Point at the freshly built manifest
        return linkElement;                                                                                                         // <-- Return for callers that need the handle
    }
    // ---------------------------------------------------------------


    // FUNCTION | Fall Back to the Static Manifest File
    // ------------------------------------------------------------
    // Used when the data: URL manifest cannot be built or is blocked by a
    // Content Security Policy manifest-src directive. The generic manifest
    // loses per-project identity, but the app stays installable.
    // ------------------------------------------------------------
    function TrueVision__Pwa__Manifest__UseFallbackFile() {
        if (TrueVision__Pwa__Manifest__UsingFallbackFile) return;                                                                   // <-- Already degraded, nothing to do

        const urlHelper     = window.TrueVision__Pwa__Url || null;                                                                  // <-- Absolute URL helper
        if (!urlHelper) return;                                                                                                     // <-- Cannot resolve the file path

        TrueVision__Pwa__Manifest__UsingFallbackFile = true;                                                                        // <-- Latch so we never bounce back and forth
        TrueVision__Pwa__Manifest__UpsertManifestLink(urlHelper.getFallbackManifestUrl());                                          // <-- Swap the link to the static file
        console.warn('[TrueVision3D PWA] Inline manifest unavailable - using the static fallback manifest.');
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Watch for a CSP Block on the Inline Manifest
    // ---------------------------------------------------------------
    function TrueVision__Pwa__Manifest__WatchForCspBlock() {
        if (typeof document === 'undefined' || !document.addEventListener) return;                                                  // <-- Guard non-DOM contexts

        document.addEventListener('securitypolicyviolation', (violationEvent) => {
            if (violationEvent.violatedDirective !== 'manifest-src') return;                                                        // <-- Only care about manifest blocks
            TrueVision__Pwa__Manifest__UseFallbackFile();                                                                           // <-- Degrade to the static file
        });
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Build and Inject the Per-Project Manifest
    // ------------------------------------------------------------
    function TrueVision__Pwa__Manifest__Apply() {
        if (typeof document === 'undefined') return false;                                                                          // <-- Guard non-DOM contexts

        try {
            const manifestObject = TrueVision__Pwa__Manifest__BuildObject();                                                        // <-- Build for the current project
            if (!manifestObject) {
                TrueVision__Pwa__Manifest__UseFallbackFile();                                                                       // <-- Dependencies missing
                return false;
            }

            if (TrueVision__Pwa__Manifest__UsingFallbackFile) return false;                                                         // <-- Already latched to the static file

            TrueVision__Pwa__Manifest__LastBuiltObject = manifestObject;                                                            // <-- Retain for diagnostics
            TrueVision__Pwa__Manifest__UpsertManifestLink(TrueVision__Pwa__Manifest__EncodeAsDataUrl(manifestObject));              // <-- Inject the inline manifest

            const contextData    = window.TrueVision__Pwa__ProjectContext.get();                                                    // <-- Project descriptor
            const iconUrls       = window.TrueVision__Pwa__Url.getIconUrls();                                                       // <-- Absolute icon URLs

            TrueVision__Pwa__Manifest__UpsertAppleTouchIcon(iconUrls.icon192);                                                       // <-- iOS home-screen artwork
            TrueVision__Pwa__Manifest__UpsertMetaTag('apple-mobile-web-app-capable', 'yes');                                         // <-- iOS standalone launch
            TrueVision__Pwa__Manifest__UpsertMetaTag('mobile-web-app-capable', 'yes');                                               // <-- Modern equivalent
            TrueVision__Pwa__Manifest__UpsertMetaTag('apple-mobile-web-app-status-bar-style', MANIFEST_APPLE_STATUS_BAR);
            TrueVision__Pwa__Manifest__UpsertMetaTag('apple-mobile-web-app-title', contextData.shortName);                            // <-- PER-PROJECT iOS home-screen label
            TrueVision__Pwa__Manifest__UpsertMetaTag('application-name', contextData.shortName);                                      // <-- PER-PROJECT Windows / Android label

            return true;                                                                                                            // <-- Inline manifest is live
        } catch (error) {
            console.warn('[TrueVision3D PWA] Manifest injection failed:', error);                                                    // <-- Never break app boot
            TrueVision__Pwa__Manifest__UseFallbackFile();                                                                           // <-- Degrade to the static file
            return false;
        }
    }
    // ---------------------------------------------------------------


    // FUNCTION | Rebuild the Manifest After a Late Project Name Refinement
    // ------------------------------------------------------------
    function TrueVision__Pwa__Manifest__Refresh() {
        if (TrueVision__Pwa__Manifest__UsingFallbackFile) return false;                                                             // <-- Static file in force, nothing to rebuild
        return TrueVision__Pwa__Manifest__Apply();                                                                                  // <-- Rebuild with the current context
    }
    // ---------------------------------------------------------------


    // FUNCTION | Read the Last Built Manifest Object (Diagnostic)
    // ------------------------------------------------------------
    function TrueVision__Pwa__Manifest__GetLastBuilt() {
        return TrueVision__Pwa__Manifest__LastBuiltObject;                                                                          // <-- Expose for console inspection
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Global Exposure and Bootstrap
// -----------------------------------------------------------------------------

    // SUB FUNCTION | Bootstrap Manifest Injection
    // ---------------------------------------------------------------
    function TrueVision__Pwa__Manifest__Bootstrap() {
        if (typeof window === 'undefined') return;                                                                                  // <-- Guard non-window contexts

        window.TrueVision__Pwa__Manifest = {                                                                                        // <-- Public API surface
            apply           : TrueVision__Pwa__Manifest__Apply,
            refresh         : TrueVision__Pwa__Manifest__Refresh,
            buildObject     : TrueVision__Pwa__Manifest__BuildObject,
            getLastBuilt    : TrueVision__Pwa__Manifest__GetLastBuilt,
            useFallbackFile : TrueVision__Pwa__Manifest__UseFallbackFile
        };

        TrueVision__Pwa__Manifest__WatchForCspBlock();                                                                              // <-- Arm the CSP degrade path first

        if (document.head) {
            TrueVision__Pwa__Manifest__Apply();                                                                                     // <-- Head already parsed, inject now
            return;
        }

        document.addEventListener('DOMContentLoaded', TrueVision__Pwa__Manifest__Apply, { once: true });                             // <-- Otherwise wait for the DOM
    }
    // ---------------------------------------------------------------


    TrueVision__Pwa__Manifest__Bootstrap();                                                                                          // <-- Kick off bootstrap

// endregion -------------------------------------------------------------------

})();
