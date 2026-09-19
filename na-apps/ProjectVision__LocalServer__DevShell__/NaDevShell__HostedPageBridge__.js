// =============================================================================
// NOBLE ARCHITECTURE - STUDIO SHELL HOSTED PAGE BRIDGE
// =============================================================================
//
// FILE       : NaDevShell__HostedPageBridge__.js
// NAMESPACE  : NaDevShell
// MODULE     : Studio Shell
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Tiny companion script injected into every page the local server
//              serves, so the Studio shell can host it properly
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - Injected by ProjectVision__LocalServer__Main__.py into localhost HTML only.
//   The public website never sees it, and no application source was changed.
// - Inside the Studio frame: forwards the shell shortcuts to the parent and
//   does nothing else. It adds no styling and touches no application state.
// - Opened directly in a browser tab: shows a small "Open in Studio" pill in
//   the bottom-right corner so there is always a way back to the launcher.
//
// -----
//
// DEVELOPMENT LOG:
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation
//
// =============================================================================

(function Na__DevShell__HostedPageBridge() {
    'use strict';

    // #region ------------------------------------------------
    // CONSTANTS | Module Configuration
    // --------------------------------------------------------

        const SHELL_ORIGIN  = window.location.origin;
        const PILL_ELEMENT  = 'na-devshell-open-pill';
        const SHORTCUT_KEYS = ['ArrowLeft', 'ArrowRight', 'Home'];

    // endregion ----------------------------------------------


    // #region ------------------------------------------------
    // FUNCTION | Framed Mode - Forward Shell Shortcuts
    // --------------------------------------------------------

        // FUNCTION | Pass the shell shortcuts up to the bar
        // ------------------------------------------------------------
        // Only the four shell chords are forwarded. Everything else is left
        // alone so an application hotkey manager keeps every key it owns.
        function bindShortcutForwarding() {
            window.addEventListener('keydown', function(event) {
                const isShellChord = (event.altKey && SHORTCUT_KEYS.indexOf(event.key) !== -1)
                                  || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k');

                if (!isShellChord) return;

                event.preventDefault();

                window.parent.postMessage({
                    source  : 'na-devshell-bridge',
                    type    : 'shortcut',
                    key     : event.key,
                    altKey  : Boolean(event.altKey),
                    ctrlKey : Boolean(event.ctrlKey || event.metaKey)
                }, SHELL_ORIGIN);
            }, true);                                                            // <-- Capture phase: ahead of app hotkey managers
        }
        // ------------------------------------------------------------

    // endregion ----------------------------------------------


    // #region ------------------------------------------------
    // FUNCTION | Standalone Mode - Return Pill
    // --------------------------------------------------------

        // FUNCTION | Draw a small corner pill linking back into the Studio shell
        function renderReturnPill() {
            if (document.getElementById(PILL_ELEMENT)) return;

            const target = '/#' + encodeURIComponent(window.location.pathname + window.location.search);

            const pill = document.createElement('a');
            pill.id          = PILL_ELEMENT;
            pill.href        = target;
            pill.textContent = 'Open in Studio';
            pill.title       = 'Reopen this page inside the Noble Architecture Studio shell';

            pill.style.cssText = [
                'position:fixed',
                'right:12px',
                'bottom:12px',
                'z-index:2147483646',
                'display:inline-flex',
                'align-items:center',
                'height:28px',
                'padding:0 12px',
                'border:1px solid #2e4a5f',
                'border-radius:14px',
                'background:#172b3a',
                'color:#ffffff',
                'font:12px "Segoe UI",system-ui,sans-serif',
                'text-decoration:none',
                'box-shadow:0 4px 14px rgba(0,0,0,0.35)',
                'opacity:0.55',
                'transition:opacity 140ms ease'
            ].join(';');

            pill.addEventListener('mouseenter', function() { pill.style.opacity = '1'; });
            pill.addEventListener('mouseleave', function() { pill.style.opacity = '0.55'; });

            document.body.appendChild(pill);
        }
        // ------------------------------------------------------------

    // endregion ----------------------------------------------


    // #region ------------------------------------------------
    // FUNCTION | Boot
    // --------------------------------------------------------

        function boot() {
            const isFramed = window.top !== window.self;

            if (isFramed) {
                bindShortcutForwarding();
                return;
            }

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', renderReturnPill, { once: true });
            } else {
                renderReturnPill();
            }
        }

        boot();

    // endregion ----------------------------------------------

})();
