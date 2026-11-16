// =============================================================================
// TRUEVISION3D - DEV TOOLS - THE ASSETS SECTION
// =============================================================================
//
// FILE       : Na__UiFeature__AssetsSection__DevControls__.js
// NAMESPACE  : Na__DevAssets
// MODULE     : Dev Tools
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Dev Tools > Assets: the one row that holds Entourage, Vegetation and
//              Furnishings, each with its own switch
// CREATED    : 05-Nov-2026
//
// DESCRIPTION:
// - Adam, 05-Nov-2026: "in the dev menu nest vegetation in a new "Assets" section and have
//   entourage, vegetation and furnishings as sub sections (funiture assets to come) then each has
//   a toggle and nicely nested otherwise the menuy will get too large".
// - THIS FILE ONLY OPENS AND CLOSES THE OUTER ROW. Each system fills its own sub section, from
//   its own Dev controls, so a system's Dev code stays with the system. Furnishings is a greyed
//   row in the markup until its assets come.
// - CALLED BY EACH SYSTEM'S DEV SECTION, for an author only. Whichever comes first wires it.
//
// INTEGRATION:
// - Markup: #naAssetsDevItem, #naAssetsDevToggle, #naAssetsDevPanel in Index.html.
// - Used by 28__System__Entourage/10__Ui__Panels/Na__Entourage__DevControls__.js and
//   24__System__Vegetation/10__Ui__Panels/Na__Vegetation__DevControls__.js.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 70__System__DevTools/Na__UiFeature__AssetsSection__DevControls__.js 1.0.0 (v2.88.0)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : identical (header and the Entourage folder's number apart)
// - Divergences   : TrueVision's Entourage is 28__System__Entourage (its 23 is Scene Sync).
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 15-Nov-2026 - TrueVision3D v2.185.0
// - Ported from ValeVision 3D with the vegetation and entourage systems.
//
// 05-Nov-2026 - Version 1.0.0 (ValeVision3D v2.88.0)
// - Initial build.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants and Variables
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Markup Ids and the Event
    // ------------------------------------------------------------
    const Na__DevAssets__ITEM_ID      = 'naAssetsDevItem';
    const Na__DevAssets__TOGGLE_ID    = 'naAssetsDevToggle';
    const Na__DevAssets__PANEL_ID     = 'naAssetsDevPanel';
    const Na__DevAssets__OPENED_EVENT = 'na-assets-dev-opened';                // <-- Each system's switch reads how things stand when this opens
    // ------------------------------------------------------------

    // MODULE VARIABLES | Has It Been Wired?
    // ------------------------------------------------------------
    let Na__DevAssets__Wired = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Show the Row, and Make It Open and Close
    // ------------------------------------------------------------
    function Na__DevAssets__Initialize() {
        if (Na__DevAssets__Wired) return true;
        const item   = document.getElementById(Na__DevAssets__ITEM_ID);
        const toggle = document.getElementById(Na__DevAssets__TOGGLE_ID);
        const panel  = document.getElementById(Na__DevAssets__PANEL_ID);
        if (!item || !toggle || !panel) return false;                          // <-- Markup absent: nothing to mount into
        Na__DevAssets__Wired = true;

        item.style.display = '';                                               // <-- Reveal alongside the other dev tools
        toggle.addEventListener('click', () => {
            const isOpen = panel.classList.contains('is-open');
            panel.classList.toggle('is-open', !isOpen);
            toggle.setAttribute('aria-expanded', String(!isOpen));
            if (!isOpen) window.dispatchEvent(new CustomEvent(Na__DevAssets__OPENED_EVENT));
        });
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Assets Section API
    // ------------------------------------------------------------
    export {
        Na__DevAssets__OPENED_EVENT,
        Na__DevAssets__Initialize
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
