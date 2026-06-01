// =============================================================================
// NOBLE ARCHITECTURE - TOAST NOTIFICATION SYSTEM
// =============================================================================
//
// FILE       : UserInterface__ToastNotification__.js
// NAMESPACE  : NaPlanVision.ToastNotification
// MODULE     : ToastNotification
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Transient on-screen notifications for load source warnings
// CREATED    : 08-Mar-2026
//
// DESCRIPTION:
// - Displays temporary toast messages that auto-fade
// - Used to warn when CDN is unavailable and legacy loader is active
// - Supports warning (red), info (blue), and success (green) types
// - Creates its own DOM container on first use
//
// -----
//
// DEVELOPMENT LOG:
// 01-Jun-2026 - Version 1.1.0
// - Repositioned toast container to horizontally centred top of screen
// - Changed entry/exit animation to vertical drop-in/out
//
// 08-Mar-2026 - Version 1.0.0
// - Initial release
//   - Toast container creation
//   - Show/hide with auto-fade
//   - Warning, info, success types
//
// =============================================================================

// #region ------------------------------------------------
// MODULE | Toast Notification System
// --------------------------------------------------------

    (function () {
        'use strict';

        // #Region ------------------------------------------------
        // CONSTANTS | Styling and Defaults
        // --------------------------------------------------------

            const NaToastDuration__Default = 5000;

            const NaToastTypeStyles = {
                warning : { background: '#c0392b', color: '#ffffff', border: '#a93226' },
                info    : { background: '#2980b9', color: '#ffffff', border: '#2471a3' },
                success : { background: '#27ae60', color: '#ffffff', border: '#229954' }
            };

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // STATE | Container Reference
        // --------------------------------------------------------

            let toastContainer = null;

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // DOM | Container Creation
        // --------------------------------------------------------

            // FUNCTION | Ensure Toast Container Exists in the DOM
            // ------------------------------------------------------------
            function ensureContainer() {
                if (toastContainer && document.body.contains(toastContainer)) {
                    return toastContainer;
                }

                toastContainer = document.createElement('div');
                toastContainer.id = 'na-toast-container';

                const style = toastContainer.style;
                style.position       = 'fixed';
                style.top            = '24px';
                style.left           = '50%';
                style.transform      = 'translateX(-50%)';
                style.zIndex         = '99999';
                style.display        = 'flex';
                style.flexDirection  = 'column';
                style.alignItems     = 'center';
                style.gap            = '8px';
                style.pointerEvents  = 'none';

                document.body.appendChild(toastContainer);
                return toastContainer;
            }
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // PUBLIC API | Toast Display
        // --------------------------------------------------------

            // FUNCTION | Show a Toast Notification
            // ------------------------------------------------------------
            const Na__Toast__Show = function (message, type, durationMs) {
                const container = ensureContainer();
                const duration  = typeof durationMs === 'number' ? durationMs : NaToastDuration__Default;
                const typeStyle = NaToastTypeStyles[type] || NaToastTypeStyles.info;

                const toast = document.createElement('div');

                const s = toast.style;
                s.padding         = '12px 20px';
                s.borderRadius    = '6px';
                s.fontFamily      = "'Open Sans', Arial, sans-serif";
                s.fontSize        = '13px';
                s.fontWeight      = '600';
                s.lineHeight      = '1.4';
                s.maxWidth        = '380px';
                s.boxShadow       = '0 4px 12px rgba(0,0,0,0.25)';
                s.pointerEvents   = 'auto';
                s.opacity         = '0';
                s.transform       = 'translateY(-12px)';
                s.transition      = 'opacity 0.25s ease, transform 0.25s ease';
                s.background      = typeStyle.background;
                s.color           = typeStyle.color;
                s.borderLeft      = '4px solid ' + typeStyle.border;

                toast.textContent = message;
                container.appendChild(toast);

                requestAnimationFrame(function () {
                    toast.style.opacity   = '1';
                    toast.style.transform = 'translateY(0)';
                });

                setTimeout(function () {
                    toast.style.opacity   = '0';
                    toast.style.transform = 'translateY(-12px)';

                    setTimeout(function () {
                        if (toast.parentNode) {
                            toast.parentNode.removeChild(toast);
                        }
                    }, 350);
                }, duration);
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EXPORTS | Module API
        // --------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.ToastNotification = {
                Na__Toast__Show : Na__Toast__Show
            };

            if (window.NaPlanVision.ModuleDependencyManager) {
                window.NaPlanVision.ModuleDependencyManager.markModuleLoaded('ToastNotification');
            }

            console.log('[ToastNotification] Module loaded and registered');

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
