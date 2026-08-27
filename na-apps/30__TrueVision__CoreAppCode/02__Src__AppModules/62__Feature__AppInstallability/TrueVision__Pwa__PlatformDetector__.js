// =============================================================================
// TRUEVISION3D - PWA PLATFORM DETECTOR
// =============================================================================
//
// FILE       : TrueVision__Pwa__PlatformDetector__.js
// NAMESPACE  : TrueVision3D
// MODULE     : TrueVision__Pwa__PlatformDetector
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Classify the runtime device, OS and browser for install handling
// CREATED    : 27-Aug-2026
//
// DESCRIPTION:
// - Produces a single canonical platform identifier consumed by the install
//   controller to pick the correct platform-specific handler.
// - Robust against the iPad-as-Mac user agent quirk (iPadOS reports MacIntel
//   so we fall back to maxTouchPoints to disambiguate). This matters a great
//   deal here because iPad is the single most common device clients use to
//   look at a TrueVision model.
// - Detects standalone mode using both the modern display-mode media query
//   and the legacy iOS navigator.standalone flag.
// - Recognises Chromium-based Edge, Samsung Internet and Opera so they get
//   the same handler as Chrome.
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

    // MODULE CONSTANTS | Platform Identifier Tokens
    // ------------------------------------------------------------
    const PLATFORM_ID_CHROMIUM_DESKTOP_WINDOWS  = 'chromium-desktop-windows';                                                       // <-- Windows Chrome / Edge / Opera
    const PLATFORM_ID_CHROMIUM_DESKTOP_MAC      = 'chromium-desktop-mac';                                                           // <-- macOS Chrome / Edge / Opera
    const PLATFORM_ID_CHROMIUM_DESKTOP_LINUX    = 'chromium-desktop-linux';                                                         // <-- Linux Chrome / Edge / Opera
    const PLATFORM_ID_CHROMIUM_ANDROID          = 'chromium-android';                                                               // <-- Android Chrome / Edge / Samsung Internet
    const PLATFORM_ID_FIREFOX_DESKTOP           = 'firefox-desktop';                                                                // <-- Desktop Firefox (no install prompt)
    const PLATFORM_ID_FIREFOX_ANDROID           = 'firefox-android';                                                                // <-- Android Firefox (manual install)
    const PLATFORM_ID_IOS_SAFARI_IPHONE         = 'ios-safari-iphone';                                                              // <-- iPhone Safari
    const PLATFORM_ID_IOS_SAFARI_IPAD           = 'ios-safari-ipad';                                                                // <-- iPadOS Safari
    const PLATFORM_ID_IOS_NON_SAFARI            = 'ios-non-safari';                                                                 // <-- Chrome / Edge / Firefox on iOS (WebKit-bound)
    const PLATFORM_ID_MAC_SAFARI                = 'mac-safari';                                                                     // <-- macOS Safari
    const PLATFORM_ID_INSTALLED_STANDALONE      = 'installed-standalone';                                                           // <-- Already running as an installed app
    const PLATFORM_ID_UNKNOWN                   = 'unknown';                                                                        // <-- Fallback for unrecognised UAs
    // ------------------------------------------------------------


    // MODULE CONSTANTS | User Agent Patterns
    // ------------------------------------------------------------
    const UA_PATTERN_CHROME                     = /Chrome\/[0-9]/;                                                                  // <-- Chrome family marker
    const UA_PATTERN_EDGE                       = /Edg(A|iOS)?\//;                                                                  // <-- Edge across surfaces
    const UA_PATTERN_OPERA                      = /OPR\//;                                                                          // <-- Opera Chromium-based
    const UA_PATTERN_SAMSUNG                    = /SamsungBrowser\//;                                                               // <-- Samsung Internet
    const UA_PATTERN_FIREFOX                    = /Firefox\//;                                                                      // <-- Desktop / Android Firefox
    const UA_PATTERN_FIREFOX_IOS                = /FxiOS\//;                                                                        // <-- Firefox on iOS (WebKit)
    const UA_PATTERN_CHROME_IOS                 = /CriOS\//;                                                                        // <-- Chrome on iOS (WebKit)
    const UA_PATTERN_EDGE_IOS                   = /EdgiOS\//;                                                                       // <-- Edge on iOS (WebKit)
    const UA_PATTERN_SAFARI_GENERIC             = /Safari\//;                                                                       // <-- Safari engine token
    const UA_PATTERN_ANDROID                    = /Android/;                                                                        // <-- Android OS
    const UA_PATTERN_IPHONE                     = /iPhone/;                                                                         // <-- iPhone device class
    const UA_PATTERN_IPOD                       = /iPod/;                                                                           // <-- iPod touch
    const UA_PATTERN_IPAD                       = /iPad/;                                                                           // <-- Pre iPadOS 13 iPad UA
    const UA_PATTERN_WINDOWS                    = /Windows NT/;                                                                     // <-- Windows OS
    const UA_PATTERN_MAC                        = /Macintosh/;                                                                      // <-- macOS UA marker
    const UA_PATTERN_LINUX                      = /Linux/;                                                                          // <-- Linux UA marker
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Internal Detection Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Read User Agent String Safely
    // ---------------------------------------------------------------
    function TrueVision__Pwa__PlatformDetector__GetUserAgent() {
        if (typeof navigator === 'undefined' || !navigator.userAgent) return '';                                                    // <-- Guard non-DOM contexts
        return navigator.userAgent;                                                                                                 // <-- Raw user agent string
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Read Platform String Safely
    // ---------------------------------------------------------------
    function TrueVision__Pwa__PlatformDetector__GetPlatformString() {
        if (typeof navigator === 'undefined' || !navigator.platform) return '';                                                     // <-- Guard non-DOM contexts
        return navigator.platform;                                                                                                  // <-- navigator.platform string
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Read Max Touch Points Safely
    // ---------------------------------------------------------------
    function TrueVision__Pwa__PlatformDetector__GetMaxTouchPoints() {
        if (typeof navigator === 'undefined') return 0;                                                                             // <-- Guard non-DOM contexts
        return Number(navigator.maxTouchPoints || 0);                                                                               // <-- Touch point count for iPad-as-Mac detection
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Detect Standalone PWA Display Mode
    // ---------------------------------------------------------------
    function TrueVision__Pwa__PlatformDetector__IsStandaloneDisplay() {
        if (typeof window === 'undefined') return false;                                                                            // <-- Guard non-window contexts

        const isDisplayStandalone    = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;                // <-- Modern API
        const isDisplayMinimalUi     = window.matchMedia && window.matchMedia('(display-mode: minimal-ui)').matches;                // <-- Minimal-UI is standalone-like
        const isDisplayFullscreen    = window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches;                // <-- Fullscreen is standalone-like
        const isDisplayWindowOverlay = window.matchMedia && window.matchMedia('(display-mode: window-controls-overlay)').matches;   // <-- Windows desktop PWA shell
        const isIosLegacyStandalone  = window.navigator && window.navigator.standalone === true;                                    // <-- Legacy iOS Safari signal

        return Boolean(isDisplayStandalone || isDisplayMinimalUi || isDisplayFullscreen || isDisplayWindowOverlay || isIosLegacyStandalone);
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Detect iPad on iPadOS 13+ (Mac UA Quirk)
    // ---------------------------------------------------------------
    function TrueVision__Pwa__PlatformDetector__IsIpadOsAsMac() {
        const platformString    = TrueVision__Pwa__PlatformDetector__GetPlatformString();                                           // <-- Read platform string
        const maxTouchPoints    = TrueVision__Pwa__PlatformDetector__GetMaxTouchPoints();                                           // <-- Read touch point count
        const userAgent         = TrueVision__Pwa__PlatformDetector__GetUserAgent();                                                // <-- Read user agent

        const looksLikeMac      = platformString === 'MacIntel' || UA_PATTERN_MAC.test(userAgent);                                   // <-- Mac-claiming environment
        const hasMultiTouch     = maxTouchPoints > 1;                                                                                // <-- Multi-touch typical for iPad
        return Boolean(looksLikeMac && hasMultiTouch);                                                                               // <-- iPad masquerading as Mac
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Detect Any iOS Device
    // ---------------------------------------------------------------
    function TrueVision__Pwa__PlatformDetector__IsAnyIosDevice() {
        const userAgent         = TrueVision__Pwa__PlatformDetector__GetUserAgent();                                                // <-- Read user agent
        if (UA_PATTERN_IPHONE.test(userAgent)) return true;                                                                         // <-- iPhone match
        if (UA_PATTERN_IPOD.test(userAgent)) return true;                                                                           // <-- iPod touch match
        if (UA_PATTERN_IPAD.test(userAgent)) return true;                                                                           // <-- Legacy iPad UA match
        if (TrueVision__Pwa__PlatformDetector__IsIpadOsAsMac()) return true;                                                        // <-- Modern iPadOS quirk
        return false;                                                                                                               // <-- Otherwise not iOS
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Detect iPad Specifically
    // ---------------------------------------------------------------
    function TrueVision__Pwa__PlatformDetector__IsIpadDevice() {
        const userAgent         = TrueVision__Pwa__PlatformDetector__GetUserAgent();                                                // <-- Read user agent
        if (UA_PATTERN_IPAD.test(userAgent)) return true;                                                                           // <-- Legacy iPad UA match
        if (TrueVision__Pwa__PlatformDetector__IsIpadOsAsMac()) return true;                                                        // <-- iPadOS Mac UA quirk
        return false;                                                                                                               // <-- Otherwise not iPad
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Detect WebKit Engine on an iOS Non-Safari Browser
    // ---------------------------------------------------------------
    function TrueVision__Pwa__PlatformDetector__IsIosNonSafariBrowser(userAgent) {
        if (UA_PATTERN_CHROME_IOS.test(userAgent)) return true;                                                                     // <-- Chrome on iOS
        if (UA_PATTERN_EDGE_IOS.test(userAgent)) return true;                                                                       // <-- Edge on iOS
        if (UA_PATTERN_FIREFOX_IOS.test(userAgent)) return true;                                                                    // <-- Firefox on iOS
        return false;                                                                                                               // <-- Otherwise treated as Safari
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Detect Chromium Family Browser
    // ---------------------------------------------------------------
    function TrueVision__Pwa__PlatformDetector__IsChromiumFamily(userAgent) {
        if (UA_PATTERN_CHROME.test(userAgent) && !UA_PATTERN_CHROME_IOS.test(userAgent)) return true;                               // <-- Chrome on non-iOS
        if (UA_PATTERN_EDGE.test(userAgent) && !UA_PATTERN_EDGE_IOS.test(userAgent)) return true;                                   // <-- Edge on non-iOS
        if (UA_PATTERN_OPERA.test(userAgent)) return true;                                                                          // <-- Chromium-based Opera
        if (UA_PATTERN_SAMSUNG.test(userAgent)) return true;                                                                        // <-- Samsung Internet on Android
        return false;                                                                                                               // <-- Otherwise non-Chromium
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Detect Safari Engine on macOS
    // ---------------------------------------------------------------
    function TrueVision__Pwa__PlatformDetector__IsMacSafari(userAgent) {
        const looksLikeMac      = UA_PATTERN_MAC.test(userAgent) && !TrueVision__Pwa__PlatformDetector__IsIpadOsAsMac();            // <-- Real macOS, not the iPadOS quirk
        if (!looksLikeMac) return false;                                                                                            // <-- Bail if not macOS
        if (TrueVision__Pwa__PlatformDetector__IsChromiumFamily(userAgent)) return false;                                           // <-- Chromium variants are not Safari
        if (UA_PATTERN_FIREFOX.test(userAgent)) return false;                                                                       // <-- Firefox is not Safari
        return UA_PATTERN_SAFARI_GENERIC.test(userAgent);                                                                           // <-- Genuine Safari signature
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Label the Browser Engine for Diagnostics
    // ---------------------------------------------------------------
    function TrueVision__Pwa__PlatformDetector__GetBrowserEngineLabel(userAgent) {
        if (UA_PATTERN_EDGE.test(userAgent)) return 'edge';                                                                         // <-- Edge variants
        if (UA_PATTERN_OPERA.test(userAgent)) return 'opera';                                                                       // <-- Opera Chromium-based
        if (UA_PATTERN_SAMSUNG.test(userAgent)) return 'samsung';                                                                   // <-- Samsung Internet
        if (UA_PATTERN_CHROME_IOS.test(userAgent)) return 'chrome';                                                                 // <-- Chrome on iOS (WebKit)
        if (UA_PATTERN_FIREFOX_IOS.test(userAgent)) return 'firefox';                                                               // <-- Firefox on iOS (WebKit)
        if (UA_PATTERN_FIREFOX.test(userAgent)) return 'firefox';                                                                   // <-- Firefox engine
        if (UA_PATTERN_CHROME.test(userAgent)) return 'chrome';                                                                     // <-- Chrome non-iOS
        return 'safari';                                                                                                            // <-- Default to Safari engine
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Build Composite Platform Descriptor
    // ------------------------------------------------------------
    function TrueVision__Pwa__PlatformDetector__GetPlatformDescriptor() {
        const userAgent             = TrueVision__Pwa__PlatformDetector__GetUserAgent();                                            // <-- Snapshot UA once
        const isStandaloneNow       = TrueVision__Pwa__PlatformDetector__IsStandaloneDisplay();                                     // <-- Standalone runtime flag
        const isAnyIosDevice        = TrueVision__Pwa__PlatformDetector__IsAnyIosDevice();                                          // <-- iOS family flag
        const isIpadDevice          = TrueVision__Pwa__PlatformDetector__IsIpadDevice();                                            // <-- iPad-specific flag
        const browserEngineLabel    = TrueVision__Pwa__PlatformDetector__GetBrowserEngineLabel(userAgent);                          // <-- Browser label

        let platformId              = PLATFORM_ID_UNKNOWN;                                                                          // <-- Default identifier

        if (isStandaloneNow) {
            platformId              = PLATFORM_ID_INSTALLED_STANDALONE;                                                             // <-- Already installed, suppress prompts
        }
        else if (isAnyIosDevice) {
            if (TrueVision__Pwa__PlatformDetector__IsIosNonSafariBrowser(userAgent)) {
                platformId          = PLATFORM_ID_IOS_NON_SAFARI;                                                                   // <-- iOS Chrome / Edge / Firefox
            }
            else if (isIpadDevice) {
                platformId          = PLATFORM_ID_IOS_SAFARI_IPAD;                                                                  // <-- iPadOS Safari
            }
            else {
                platformId          = PLATFORM_ID_IOS_SAFARI_IPHONE;                                                                // <-- iPhone Safari
            }
        }
        else if (UA_PATTERN_ANDROID.test(userAgent)) {
            if (UA_PATTERN_FIREFOX.test(userAgent)) {
                platformId          = PLATFORM_ID_FIREFOX_ANDROID;                                                                  // <-- Android Firefox
            }
            else {
                platformId          = PLATFORM_ID_CHROMIUM_ANDROID;                                                                 // <-- Android Chromium family (incl. Samsung tablets)
            }
        }
        else if (TrueVision__Pwa__PlatformDetector__IsMacSafari(userAgent)) {
            platformId              = PLATFORM_ID_MAC_SAFARI;                                                                       // <-- macOS Safari
        }
        else if (TrueVision__Pwa__PlatformDetector__IsChromiumFamily(userAgent)) {
            if (UA_PATTERN_WINDOWS.test(userAgent)) {
                platformId          = PLATFORM_ID_CHROMIUM_DESKTOP_WINDOWS;                                                         // <-- Windows Chromium family
            }
            else if (UA_PATTERN_MAC.test(userAgent)) {
                platformId          = PLATFORM_ID_CHROMIUM_DESKTOP_MAC;                                                             // <-- macOS Chromium family
            }
            else if (UA_PATTERN_LINUX.test(userAgent)) {
                platformId          = PLATFORM_ID_CHROMIUM_DESKTOP_LINUX;                                                           // <-- Linux Chromium family
            }
        }
        else if (UA_PATTERN_FIREFOX.test(userAgent)) {
            platformId              = PLATFORM_ID_FIREFOX_DESKTOP;                                                                  // <-- Desktop Firefox
        }

        return {                                                                                                                    // <-- Composite descriptor
            platformId          : platformId,
            isStandalone        : isStandaloneNow,
            isAnyIosDevice      : isAnyIosDevice,
            isIpadDevice        : isIpadDevice,
            browserEngineLabel  : browserEngineLabel,
            userAgentSnapshot   : userAgent
        };
    }
    // ---------------------------------------------------------------


    // FUNCTION | Subscribe to Display Mode Changes
    // ------------------------------------------------------------
    function TrueVision__Pwa__PlatformDetector__SubscribeStandaloneChanges(callback) {
        if (typeof window === 'undefined' || typeof callback !== 'function') return () => {};                                       // <-- Guard non-DOM and bad callbacks

        const mediaQueryList    = window.matchMedia('(display-mode: standalone)');                                                  // <-- Watch standalone display mode
        const changeHandler     = (event) => callback(Boolean(event.matches));                                                      // <-- Forward boolean status

        if (mediaQueryList.addEventListener) {
            mediaQueryList.addEventListener('change', changeHandler);                                                               // <-- Modern listener API
            return () => mediaQueryList.removeEventListener('change', changeHandler);                                               // <-- Disposer
        }

        if (mediaQueryList.addListener) {
            mediaQueryList.addListener(changeHandler);                                                                              // <-- Legacy listener API
            return () => mediaQueryList.removeListener(changeHandler);                                                              // <-- Legacy disposer
        }

        return () => {};                                                                                                            // <-- No-op disposer if APIs unavailable
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Global Exposure
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Global Platform Detector Namespace
    // ------------------------------------------------------------
    function TrueVision__Pwa__PlatformDetector__InitializeGlobalNamespace() {
        if (typeof window === 'undefined') return;                                                                                  // <-- Guard non-window contexts

        window.TrueVision__Pwa__PlatformDetector = {                                                                                // <-- Public API surface
            getPlatformDescriptor       : TrueVision__Pwa__PlatformDetector__GetPlatformDescriptor,
            subscribeStandaloneChanges  : TrueVision__Pwa__PlatformDetector__SubscribeStandaloneChanges,
            isStandaloneDisplay         : TrueVision__Pwa__PlatformDetector__IsStandaloneDisplay,
            PlatformIds : {
                ChromiumDesktopWindows  : PLATFORM_ID_CHROMIUM_DESKTOP_WINDOWS,
                ChromiumDesktopMac      : PLATFORM_ID_CHROMIUM_DESKTOP_MAC,
                ChromiumDesktopLinux    : PLATFORM_ID_CHROMIUM_DESKTOP_LINUX,
                ChromiumAndroid         : PLATFORM_ID_CHROMIUM_ANDROID,
                FirefoxDesktop          : PLATFORM_ID_FIREFOX_DESKTOP,
                FirefoxAndroid          : PLATFORM_ID_FIREFOX_ANDROID,
                IosSafariIphone         : PLATFORM_ID_IOS_SAFARI_IPHONE,
                IosSafariIpad           : PLATFORM_ID_IOS_SAFARI_IPAD,
                IosNonSafari            : PLATFORM_ID_IOS_NON_SAFARI,
                MacSafari               : PLATFORM_ID_MAC_SAFARI,
                InstalledStandalone     : PLATFORM_ID_INSTALLED_STANDALONE,
                Unknown                 : PLATFORM_ID_UNKNOWN
            }
        };
    }
    // ---------------------------------------------------------------


    TrueVision__Pwa__PlatformDetector__InitializeGlobalNamespace();                                                                 // <-- Mount on window immediately

// endregion -------------------------------------------------------------------

})();
