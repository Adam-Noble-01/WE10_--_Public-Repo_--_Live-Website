// =============================================================================
// TRUEVISION3D - USER INSTRUCTIONS MENU ITEM
// =============================================================================
//
// FILE       : Na__UiFeature__UserInstructions__MenuItem.js
// NAMESPACE  : Na__UiFeature
// MODULE     : UserInstructions - Menu Item
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Menu button registration and click event hookup for User Guide
// CREATED    : 27-Feb-2026
//
// DESCRIPTION:
// - Resolves the User Guide button in the Tools dropdown menu.
// - Attaches a click listener that calls the supplied open function.
// - Deliberately has no imports — purely a DOM hookup layer so the
//   SystemLogic module remains decoupled from the menu structure.
//
// INTEGRATION:
// - Call Na__UiFeature__InitializeUserInstructionsMenuItem(openFn) once
//   after the DOM is ready, passing Na__UserInstructions__Open as the
//   open function from Na__UserInstructions__SystemLogic.js.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Menu Item Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize User Instructions Menu Item
    // ------------------------------------------------------------
    function Na__UiFeature__InitializeUserInstructionsMenuItem(openFn) {
        const toggleButton = document.getElementById('naUserInstructionsToggle');   // <-- Menu button

        if (!toggleButton) return;                                                  // <-- Guard: button not found

        toggleButton.addEventListener('click', () => {
            const toolsMenu = document.getElementById('naToolsMenu');               // <-- Close tools dropdown
            if (toolsMenu) {
                toolsMenu.removeAttribute('open');                                  // <-- Collapse menu before overlay opens
            }

            if (typeof openFn === 'function') {
                openFn();                                                            // <-- Delegate open to SystemLogic
            }
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | User Instructions Menu Item API
    // ------------------------------------------------------------
    export {
        Na__UiFeature__InitializeUserInstructionsMenuItem
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
