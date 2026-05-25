// =============================================================================
// TRUEVISION3D - DEV MENU (LOCALHOST ONLY)
// =============================================================================
//
// FILE       : Na__UiFeature__DevMenu__LocalhostOnly.js
// NAMESPACE  : Na__UiFeature
// MODULE     : DevMenu LocalhostOnly
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Reveal local development menu only on localhost
// CREATED    : 25-May-2026
//
// DESCRIPTION:
// - Reveals the dedicated Dev Tools dropdown only when TrueVision3D is running
//   on a localhost environment.
// - Keeps developer-facing controls hidden on live deployments.
// - Provides a drag-resize handle on the bottom-right corner so the panel
//   width can be adjusted at runtime without page reload.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 25-May-2026 - Version 1.0.0
// - Moved Dev Tools menu controller into the dedicated DevTools system folder.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Project Loader Utilities
    // ------------------------------------------------------------
    import { Na__AppUtils__IsRunningOnLocalhost } from '../03__AppUtils/Na__AppUtils__ProjectLoader.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Localhost Dev Menu Initialization
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Dev Menu DOM IDs
    // ------------------------------------------------------------
    const Na__DevMenu__ContainerId    = 'naDevToolsMenuContainer';              // <-- Root container for localhost-only menu
    const Na__DevMenu__ResizeHandleId = 'naDevMenuResizeHandle';                // <-- Drag-resize handle element
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Resize Constraints
    // ------------------------------------------------------------
    const Na__DevMenu__ResizeMinWidth = 220;                                    // <-- Minimum panel width in px
    const Na__DevMenu__ResizeMaxWidth = 640;                                    // <-- Maximum panel width in px
    // ------------------------------------------------------------


    // HELPER FUNCTION | Initialize Drag-Resize Behaviour
    // ------------------------------------------------------------
    function Na__DevMenu__InitializeResizeHandle(devMenuContainer) {
        const handle = document.getElementById(Na__DevMenu__ResizeHandleId);
        if (!handle) return;

        let isDragging = false;
        let startX     = 0;
        let startWidth = 0;

        handle.addEventListener('mousedown', (event) => {
            isDragging = true;
            startX     = event.clientX;
            startWidth = devMenuContainer.offsetWidth;

            document.body.style.userSelect = 'none';
            event.preventDefault();
        });

        document.addEventListener('mousemove', (event) => {
            if (!isDragging) return;

            const delta    = event.clientX - startX;
            const newWidth = Math.min(
                Na__DevMenu__ResizeMaxWidth,
                Math.max(Na__DevMenu__ResizeMinWidth, startWidth + delta)
            );

            devMenuContainer.style.width = `${newWidth}px`;
        });

        document.addEventListener('mouseup', () => {
            if (!isDragging) return;

            isDragging = false;
            document.body.style.userSelect = '';
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Initialize Localhost Dev Menu Visibility
    // ------------------------------------------------------------
    function Na__UiFeature__InitializeLocalhostDevMenu() {
        const devMenuContainer = document.getElementById(Na__DevMenu__ContainerId);
        if (!devMenuContainer) return;

        if (!Na__AppUtils__IsRunningOnLocalhost()) {
            devMenuContainer.style.display = 'none';
            return;
        }

        devMenuContainer.style.display = '';
        Na__DevMenu__InitializeResizeHandle(devMenuContainer);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Localhost Dev Menu API
    // ------------------------------------------------------------
    export {
        Na__UiFeature__InitializeLocalhostDevMenu
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
