// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET TOOLS - HOVER TOOLTIP
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetTools__HoverTooltip__.js
// NAMESPACE  : Na__LeHoverTip
// MODULE     : Layout Editor - Sheet Tools - Hover Tooltip
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : A small text tooltip that follows the pointer, for hover feedback the hit test wants to explain (a broken specification bubble, a bubble's note)
// CREATED    : 18-Sep-2026
//
// DESCRIPTION:
// - One shared element, made on first use and reused after: Show sets its
//   text and moves it next to the pointer, Hide tucks it away. Nothing here
//   reads the model, the markup or the specification - the caller decides
//   what the text says and when to call, so this stays reusable for whatever
//   else the hover pass wants to explain later.
// - A LEAD. options.lead puts a few words in bold before the text - a
//   bubble's code before its note's title ("EW01  Loggia Arcade").
// - IT STAYS IN THE WINDOW. Near the right or the bottom edge it flips to
//   the other side of the pointer rather than running off the screen.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__PointerDrag__ (the hover pass, OnMove) and
//   Na__LayoutEditor__SheetTools__NoteTooltip__ (a bubble's note).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.1.0
// - options.lead, a bold lead-in before the text, for a bubble's code.
// - Kept inside the window: flipped to the other side of the pointer near
//   the right or the bottom edge. The element is only rewritten when what it
//   says changes, so a label following the pointer only moves.
//
// 18-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Shared Element, What It Says, and Its Offset From the Pointer
    // ------------------------------------------------------------
    let Na__LeHoverTip__El   = null;
    let Na__LeHoverTip__Says = '';                                              // <-- lead + text last written, so a move only moves it
    const Na__LeHoverTip__OFFSET_PX = 14;
    const Na__LeHoverTip__EDGE_PX   = 4;                                        // <-- Never nearer the window's edge than this
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Show and Hide
// -----------------------------------------------------------------------------

    // FUNCTION | Show the Tooltip Next to the Pointer (empty text hides it)
    // ------------------------------------------------------------
    // options: { lead } - words in bold before the text.
    // ------------------------------------------------------------
    function Na__LeHoverTip__Show(text, clientX, clientY, options) {
        if (!text) { Na__LeHoverTip__Hide(); return; }
        const lead = (options && typeof options.lead === 'string') ? options.lead : '';
        if (!Na__LeHoverTip__El) {
            Na__LeHoverTip__El = document.createElement('div');
            Na__LeHoverTip__El.className = 'na-le-hovertip';
            document.body.appendChild(Na__LeHoverTip__El);
        }
        const el   = Na__LeHoverTip__El;
        const says = lead + '\u0000' + text;
        if (says !== Na__LeHoverTip__Says) {
            Na__LeHoverTip__Says = says;
            el.textContent = '';
            if (lead) {
                const strong = document.createElement('span');
                strong.className   = 'na-le-hovertip__lead';
                strong.textContent = lead;
                el.appendChild(strong);
            }
            el.appendChild(document.createTextNode(text));
        }
        el.hidden = false;
        el.style.left = '0px';                                                 // <-- Measured where nothing narrows it: left near the right edge, it would wrap early
        el.style.top  = '0px';
        let left = clientX + Na__LeHoverTip__OFFSET_PX;
        let top  = clientY + Na__LeHoverTip__OFFSET_PX;
        const box = el.getBoundingClientRect();
        if (left + box.width > window.innerWidth - Na__LeHoverTip__EDGE_PX)   left = Math.max(Na__LeHoverTip__EDGE_PX, clientX - Na__LeHoverTip__OFFSET_PX - box.width);
        if (top + box.height > window.innerHeight - Na__LeHoverTip__EDGE_PX) top  = Math.max(Na__LeHoverTip__EDGE_PX, clientY - Na__LeHoverTip__OFFSET_PX - box.height);
        el.style.left = left + 'px';
        el.style.top  = top + 'px';
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
