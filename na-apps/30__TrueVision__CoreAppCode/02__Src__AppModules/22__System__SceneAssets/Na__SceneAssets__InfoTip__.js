// =============================================================================
// TRUEVISION3D - PLACED ASSETS - THE (i) INFO ICON AND ITS TOOLTIP
// =============================================================================
//
// FILE       : Na__SceneAssets__InfoTip__.js
// NAMESPACE  : Na__SceneInfo
// MODULE     : System - Placed Assets
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : A small navy (i) whose hover tooltip holds a panel's standing instructions, so
//              the panel shows no paragraph of notes
// CREATED    : 26-Nov-2026
//
// DESCRIPTION:
// - THE DESIGN PRINCIPLE (Adam, 26-Nov-2026): "no overwhelming notes in the UI, info is tghere if
//   you need it by hoveer over intuitivie tooltips". How to use a panel or a tool goes in an (i);
//   only what is happening right now (a card armed, a path being drawn) is a visible line.
// - A BUTTON, so a keyboard reaches it: the tooltip shows after a short hover or on focus.
// - CSS ONLY. The look is in ./Na__SceneAssets__Styles__.css (.na-scene-info), added here on
//   first use, so any panel can call this without loading the stylesheet itself.
// - THE TIP OPENS LEFTWARDS from the icon, so put the (i) at the right end of a row: it then
//   stays inside the 296 px panel.
//
// INTEGRATION:
// - Used by the Entourage and Vegetation asset browsers and the Brush and Line Tools.
// - Staff only: nothing on a client's path imports this file.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 02__Src__AppModules/22__System__SceneAssets/Na__SceneAssets__InfoTip__.js
// - Source version: 0.0.1 (ValeVision3D v2.99.3, 26-Nov-2026, uncommitted when copied)
// - Divergences   : the banner, and the callers named (TrueVision has no Furnishings).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 26-Nov-2026 - Version 0.0.1-tv.1 (TrueVision3D v2.189.8)
// - Ported from ValeVision 3D (Adam: "do the same with TrueVision same princple applies").
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Placed Assets Stylesheet
    // ------------------------------------------------------------
    import { Na__SceneChanges__AddStyles } from './Na__SceneAssets__ChangesPanel__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Variables
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | A Count, for Each Tooltip's Own Id
    // ------------------------------------------------------------
    let Na__SceneInfo__Count = 0;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The (i)
// -----------------------------------------------------------------------------

    // FUNCTION | An (i) With Its Tooltip, Ready to Append at the Right End of a Row
    // ------------------------------------------------------------
    // text : the instructions. label : what a screen reader calls the button.
    // ------------------------------------------------------------
    function Na__SceneInfo__Tip(text, label) {
        Na__SceneChanges__AddStyles();
        Na__SceneInfo__Count += 1;
        const tipId = 'naSceneInfoTip' + Na__SceneInfo__Count;

        const wrap = document.createElement('span');
        wrap.className = 'na-scene-info';

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'na-scene-info__button';
        button.setAttribute('aria-label', label || 'How to use this');
        button.setAttribute('aria-describedby', tipId);
        button.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">'
            + '<circle cx="12" cy="12" r="9.25" fill="none" stroke="currentColor" stroke-width="1.6"/>'
            + '<line x1="12" y1="11" x2="12" y2="16.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'
            + '<circle cx="12" cy="7.6" r="1.15" fill="currentColor"/>'
            + '</svg>';

        const tip = document.createElement('span');
        tip.className = 'na-scene-info__tip';
        tip.id = tipId;
        tip.setAttribute('role', 'tooltip');
        tip.textContent = text;

        wrap.appendChild(button);
        wrap.appendChild(tip);
        return wrap;
    }
    // ------------------------------------------------------------


    // FUNCTION | Change What an (i) Says
    // ------------------------------------------------------------
    function Na__SceneInfo__SetText(wrap, text) {
        const tip = wrap && wrap.querySelector('.na-scene-info__tip');
        if (tip) tip.textContent = text;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Info Tip API
    // ------------------------------------------------------------
    export {
        Na__SceneInfo__Tip,
        Na__SceneInfo__SetText
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
