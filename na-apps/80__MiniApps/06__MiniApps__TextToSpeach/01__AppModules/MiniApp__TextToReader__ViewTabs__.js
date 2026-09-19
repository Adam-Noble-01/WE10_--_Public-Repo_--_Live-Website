// =============================================================================
// NOBLE ARCHITECTURE - TEXT TO READER - VIEW TABS
// =============================================================================
//
// FILE    : MiniApp__TextToReader__ViewTabs__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Simple / Edit / Read view switching
// CREATED : 19-Sep-2026
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module-Level Variables
// -----------------------------------------------------------------------------

 let Na__TextToReader__ActiveMode    = "simple";
 let Na__TextToReader__TabButtons    = [];
 let Na__TextToReader__OnModeChange  = null;

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Internal Helpers
// -----------------------------------------------------------------------------

// FUNCTION | Paint the active tab and persist the mode on the body
// ------------------------------------------------------------
function Na__TextToReader__PaintActiveMode(Na__Mode) {
    Na__TextToReader__ActiveMode = Na__Mode;
    document.body.setAttribute("data-ttr-mode", Na__Mode);

    Na__TextToReader__TabButtons.forEach((Na__Button) => {
        const Na__IsActive = Na__Button.getAttribute("data-ttr-tab") === Na__Mode;
        Na__Button.classList.toggle("TTR__tab--active", Na__IsActive === true);
    });
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Exports
// -----------------------------------------------------------------------------

// FUNCTION | Return the current view mode
// ------------------------------------------------------------
export function Na__TextToReader__GetActiveMode() {
    return Na__TextToReader__ActiveMode;
}
// ------------------------------------------------------------


// FUNCTION | Switch view and notify the controller
// ------------------------------------------------------------
export function Na__TextToReader__SetActiveMode(Na__Mode) {
    if (!Na__Mode) return;

    Na__TextToReader__PaintActiveMode(Na__Mode);

    if (typeof Na__TextToReader__OnModeChange === "function") {
        Na__TextToReader__OnModeChange(Na__Mode);
    }
}
// ------------------------------------------------------------


// FUNCTION | Wire tab buttons to the view switcher
// ------------------------------------------------------------
export function Na__TextToReader__InitialiseViewTabs(Na__Config) {
    const {
        tabButtons,
        defaultMode,
        onModeChange
    } = Na__Config || {};

    Na__TextToReader__TabButtons   = Array.from(tabButtons || []);
    Na__TextToReader__OnModeChange = onModeChange;

    const Na__InitialMode = defaultMode || "simple";

    Na__TextToReader__TabButtons.forEach((Na__Button) => {
        Na__Button.addEventListener("click", () => {
            const Na__Mode = Na__Button.getAttribute("data-ttr-tab");
            Na__TextToReader__SetActiveMode(Na__Mode);
        });
    });

    Na__TextToReader__PaintActiveMode(Na__InitialMode);
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
