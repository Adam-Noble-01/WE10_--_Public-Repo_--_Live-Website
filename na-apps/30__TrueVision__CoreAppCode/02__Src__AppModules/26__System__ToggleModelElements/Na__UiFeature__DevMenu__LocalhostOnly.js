// =============================================================================
// TRUEVISION3D - DEV MENU (LOCALHOST ONLY)
// =============================================================================
//
// FILE       : Na__UiFeature__DevMenu__LocalhostOnly.js
// NAMESPACE  : Na__UiFeature
// MODULE     : DevMenu LocalhostOnly
// PURPOSE    : Reveal local development menu only on localhost
//
// =============================================================================

// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    import { Na__AppUtils__IsRunningOnLocalhost } from '../03__AppUtils/Na__AppUtils__ProjectLoader.js';

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Localhost Dev Menu Initialization
// -----------------------------------------------------------------------------

    function Na__UiFeature__InitializeLocalhostDevMenu() {
        const devMenuContainer = document.getElementById('naDevToolsMenuContainer');
        if (!devMenuContainer) return;

        if (!Na__AppUtils__IsRunningOnLocalhost()) {
            devMenuContainer.style.display = 'none';
            return;
        }

        devMenuContainer.style.display = '';
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    export {
        Na__UiFeature__InitializeLocalhostDevMenu
    };

// endregion -------------------------------------------------------------------
