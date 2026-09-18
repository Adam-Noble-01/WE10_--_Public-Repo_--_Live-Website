// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET TOOLS - HOVER TOOLTIP
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetTools__HoverTooltip__.js
// NAMESPACE  : Na__LeHoverTip
// MODULE     : Layout Editor - Sheet Tools - Hover Tooltip
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : A small text tooltip that follows the pointer, for hover feedback the hit test wants to explain (a broken specification bubble, so far)
// CREATED    : 18-Sep-2026
//
// DESCRIPTION:
// - One shared element, made on first use and reused after: Show sets its
//   text and moves it next to the pointer, Hide tucks it away. Nothing here
//   reads the model, the markup or the specification - the caller decides
//   what the text says and when to call, so this stays reusable for whatever
//   else the hover pass wants to explain later.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__PointerDrag__ (the hover pass, OnMove).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 18-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Shared Element and Its Offset From the Pointer
    // ------------------------------------------------------------
    let Na__LeHoverTip__El = null;
    const Na__LeHoverTip__OFFSET_PX = 14;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Show and Hide
// -----------------------------------------------------------------------------

    // FUNCTION | Show the Tooltip Next to the Pointer (empty text hides it)
    // ------------------------------------------------------------
    function Na__LeHoverTip__Show(text, clientX, clientY) {
        if (!text) { Na__LeHoverTip__Hide(); return; }
        if (!Na__LeHoverTip__El) {
            Na__LeHoverTip__El = document.createElement('div');
            Na__LeHoverTip__El.className = 'na-le-hovertip';
            document.body.appendChild(Na__LeHoverTip__El);
        }
        Na__LeHoverTip__El.textContent = text;
        Na__LeHoverTip__El.style.left  = (clientX + Na__LeHoverTip__OFFSET_PX) + 'px';
        Na__LeHoverTip__El.style.top   = (clientY + Na__LeHoverTip__OFFSET_PX) + 'px';
        Na__LeHoverTip__El.hidden = false;
    }
    // ------------------------------------------------------------


    // FUNCTION | Hide the Tooltip
    // ------------------------------------------------------------
    function Na__LeHoverTip__Hide() {
        if (Na__LeHoverTip__El) Na__LeHoverTip__El.hidden = true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Sheet Tools Hover Tooltip API
    // ------------------------------------------------------------
    export {
        Na__LeHoverTip__Show,
        Na__LeHoverTip__Hide
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
