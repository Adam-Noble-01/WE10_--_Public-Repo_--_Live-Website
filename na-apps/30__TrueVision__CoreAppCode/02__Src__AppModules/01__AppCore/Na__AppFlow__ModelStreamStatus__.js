// =============================================================================
// TRUEVISION3D - APP FLOW - MODEL STREAM STATUS
// =============================================================================
//
// FILE       : Na__AppFlow__ModelStreamStatus__.js
// NAMESPACE  : Na__StreamStatus
// MODULE     : AppFlow - Model Stream Status
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : A small status over the 3D view while a model's heavier tiers are still arriving
// CREATED    : 15-Nov-2026
//
// DESCRIPTION:
// - The model is shown as soon as the building is in, and the fixtures, the
//   furniture and the interior decor arrive after it. While they do, this pill
//   sits in the top left of the 3D view and says what is loading ("Loading
//   furniture..."), so a reader who sees a room fill up knows why. It takes no
//   pointer and goes when the model is whole.
// - Pure DOM: one element, built on first use, placed against the canvas.
//
// INTEGRATION:
// - Na__AppFlow__LoadingSequence.js shows it after the first look and hides it
//   when the model is whole.
// - Styled by 03__Style__AppStylesheets/Na__UiFeature__Styles__PhaseCompare__.css.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (15-Nov-2026)
// - ValeVision    : not yet ported.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 15-Nov-2026 - Version 1.0.0 (v2.186.0)
// - Initial implementation, for the staged model load.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | DOM
    // ------------------------------------------------------------
    const Na__StreamStatus__ELEMENT_ID = 'naModelStreamStatus';
    const Na__StreamStatus__CANVAS_ID  = 'renderCanvas';
    const Na__StreamStatus__TABS_ID    = 'naLayoutEditorTabStrip';             // <-- The 3D Model / Drawings tab strip, which lies over the top of the 3D view on a project with documents
    const Na__StreamStatus__ON_CLASS   = 'na-model-stream-status--on';
    const Na__StreamStatus__INSET_PX   = 14;                                   // <-- From the 3D view's top left corner
    const Na__StreamStatus__PLACE_EVERY_MS = 400;                              // <-- How often the pill is placed again while it is on
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Pill
    // ------------------------------------------------------------
    let Na__StreamStatus__Element    = null;
    let Na__StreamStatus__Text       = null;
    let Na__StreamStatus__PlaceTimer = null;                                   // <-- Runs only while the pill is on
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the Pill (once)
    // ------------------------------------------------------------
    function Na__StreamStatus__Ensure() {
        if (Na__StreamStatus__Element) return Na__StreamStatus__Element;

        const element = document.createElement('div');
        element.id        = Na__StreamStatus__ELEMENT_ID;
        element.className = 'na-model-stream-status';
        element.setAttribute('role', 'status');
        element.setAttribute('aria-live', 'polite');

        const spinner = document.createElement('span');
        spinner.className = 'na-model-stream-status__spinner';
        const text = document.createElement('span');
        text.className = 'na-model-stream-status__text';

        element.appendChild(spinner);
        element.appendChild(text);
        document.body.appendChild(element);

        Na__StreamStatus__Element = element;
        Na__StreamStatus__Text    = text;
        return element;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put the Pill in the 3D View's Top Left Corner
    // ------------------------------------------------------------
    // Under the tab strip where there is one, never on it. The strip is the
    // Layout Editor's and can arrive after the pill is first shown, so the
    // pill is placed again every so often for as long as it is on.
    // ------------------------------------------------------------
    function Na__StreamStatus__Place() {
        const element = Na__StreamStatus__Element;
        if (!element) return;
        const canvas  = document.getElementById(Na__StreamStatus__CANVAS_ID);
        const rect    = canvas ? canvas.getBoundingClientRect() : { left : 0, top : 0 };
        const tabs    = document.getElementById(Na__StreamStatus__TABS_ID);
        const tabsBox = (tabs && getComputedStyle(tabs).display !== 'none') ? tabs.getBoundingClientRect() : null;
        const top     = Math.max(rect.top, (tabsBox && tabsBox.height > 0) ? tabsBox.bottom : 0);

        element.style.left = (rect.left + Na__StreamStatus__INSET_PX) + 'px';  // <-- The 3D view starts under the top bar
        element.style.top  = (top + Na__StreamStatus__INSET_PX) + 'px';
    }
    // ------------------------------------------------------------


    // FUNCTION | Show the Status, or Change Its Words
    // ------------------------------------------------------------
    function Na__StreamStatus__Show(message) {
        const element = Na__StreamStatus__Ensure();
        Na__StreamStatus__Place();
        Na__StreamStatus__Text.textContent = String(message || '');
        element.classList.add(Na__StreamStatus__ON_CLASS);
        if (Na__StreamStatus__PlaceTimer === null) {
            Na__StreamStatus__PlaceTimer = window.setInterval(Na__StreamStatus__Place, Na__StreamStatus__PLACE_EVERY_MS);
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Take the Status Away
    // ------------------------------------------------------------
    function Na__StreamStatus__Hide() {
        if (Na__StreamStatus__PlaceTimer !== null) {
            window.clearInterval(Na__StreamStatus__PlaceTimer);
            Na__StreamStatus__PlaceTimer = null;
        }
        if (Na__StreamStatus__Element) Na__StreamStatus__Element.classList.remove(Na__StreamStatus__ON_CLASS);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Model Stream Status API
    // ------------------------------------------------------------
    export {
        Na__StreamStatus__Show,
        Na__StreamStatus__Hide
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
