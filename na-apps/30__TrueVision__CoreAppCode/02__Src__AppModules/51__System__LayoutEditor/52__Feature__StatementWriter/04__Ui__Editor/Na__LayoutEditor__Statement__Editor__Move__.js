// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - STATEMENT EDITOR - MOVING A SECTION
// =============================================================================
//
// FILE       : Na__LayoutEditor__Statement__Editor__Move__.js
// NAMESPACE  : Na__LeStmtMove
// MODULE     : Layout Editor - Statement Writer - Drag a Standard Section to Another Place
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Pick a standard section up by its Move handle and put it down at another section boundary
// CREATED    : 29-Sep-2026
//
// DESCRIPTION:
// - WHY. A standard section lands where its placement rule puts it, and Adam,
//   29-Sep-2026: "I might need to drag it around". Nothing in the editor could
//   move a block before this - the picture's corner grip resizes.
// - IT MOVES AS A SECTION. A standard section sits between two major dividers
//   (Adam: "an HR above and below it ... so this is its own section"), so it
//   is only ever put down straight under a divider - at the start of a
//   section - and the divider under it travels with it:
//     - taken out from between two dividers, it takes the lower one with it,
//       so no two dividers are left touching where it was;
//     - put down under a divider, it gets that divider back under itself
//       unless the next block is already one.
//   The drop line therefore only ever shows at a section boundary.
// - A MOVE IS A FEW DOM MOVES. The page's top-level children ARE the document,
//   in order, each carrying its own source and the blank lines under it, so
//   moving elements moves exactly their lines and nothing is re-rendered. The
//   blocks either side are made to end with a blank line, so nothing is glued
//   to its neighbour in the markdown.
// - POINTER EVENTS, NOT HTML DRAG AND DROP. The page is contenteditable: the
//   browser's own drag would carry text and fire input events. The handle
//   captures the pointer, a line shows where the section will land, and the
//   page scrolls by itself while the pointer is held near the top or bottom
//   of the view. Escape puts it back; nothing changes until the button is let
//   go over the page.
//
// INTEGRATION:
// - Na__LayoutEditor__Statement__Editor__Cards__ gives a movable standard
//   section's card a Move handle and calls Begin from its pointerdown.
// - The line and the grabbing cursor are styled in
//   Na__LayoutEditor__Styles__Statement__.css (Standard Sections and Moving a Block).
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (29-Sep-2026).
// - ValeVision    : not yet ported (ValeVision has no statement tab).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 29-Sep-2026 - Version 1.1.0
// - Moves as a section: drops only under a divider and carries its own.
//
// 29-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Scrolling While Dragging, and What a Divider Looks Like
    // ------------------------------------------------------------
    const Na__LeStmtMove__EDGE_PX     = 70;                                     // <-- How near the top or bottom of the view starts the scroll
    const Na__LeStmtMove__MAX_STEP_PX = 28;                                     // <-- Fastest scroll, per tick, with the pointer at the very edge
    const Na__LeStmtMove__TICK_MS     = 16;
    const Na__LeStmtMove__DIVIDER     = /^<div style=" \/\* \| - - - .*Horizontal Page Divider Line/;
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Move in Progress
    // ------------------------------------------------------------
    let Na__LeStmtMove__Drag = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Whether a Top-Level Block Is a Major Divider
    // ------------------------------------------------------------
    function Na__LeStmtMove__IsDivider(el) {
        return !!el && el.hasAttribute && el.hasAttribute('data-na-stmt-src') &&
               Na__LeStmtMove__DIVIDER.test(el.getAttribute('data-na-stmt-src') || '');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Element That Scrolls the Page
    // ------------------------------------------------------------
    function Na__LeStmtMove__Scroller(root) {
        for (let node = root.parentElement; node; node = node.parentElement) {
            const overflow = getComputedStyle(node).overflowY;
            if ((overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight) return node;
        }
        return document.scrollingElement || document.documentElement;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Make a Block's Source End With a Blank Line
    // ------------------------------------------------------------
    function Na__LeStmtMove__EndWithBlank(el) {
        if (!el || !el.hasAttribute || !el.hasAttribute('data-na-stmt-src')) return;
        const src = el.getAttribute('data-na-stmt-src');
        if (!/\n[ \t]*$/.test(src)) el.setAttribute('data-na-stmt-src', src + '\n');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Fresh Copy of a Divider Card
    // ------------------------------------------------------------
    // Its source and its drawing, without the editor's tool row: a copied
    // button would carry none of the original's listeners. The caller has the
    // cards decorated again after the move.
    // ------------------------------------------------------------
    function Na__LeStmtMove__Copy(divider) {
        const copy = divider.cloneNode(true);
        copy.classList.remove('is-selected');
        for (const chrome of Array.from(copy.querySelectorAll(':scope > .na-le-stmt-frozen__tools, :scope > .na-le-stmt-std-badge, :scope > .na-le-stmt-frozen__raw'))) chrome.remove();
        return copy;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Divider the Section Owns (the one under it, between two)
    // ------------------------------------------------------------
    function Na__LeStmtMove__OwnDivider(card) {
        const above = card.previousElementSibling;
        const below = card.nextElementSibling;
        return (Na__LeStmtMove__IsDivider(above) && Na__LeStmtMove__IsDivider(below)) ? below : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Work Out Which Divider It Would Land Under and Draw the Line There
    // ------------------------------------------------------------
    // The nearest section boundary to the pointer, never the section's own
    // two dividers (landing there changes nothing).
    // ------------------------------------------------------------
    function Na__LeStmtMove__Locate() {
        const drag = Na__LeStmtMove__Drag;
        if (!drag) return;
        let best = null;
        for (const el of Array.from(drag.root.children)) {
            if (!Na__LeStmtMove__IsDivider(el)) continue;
            const rect = el.getBoundingClientRect();
            if (rect.height <= 0) continue;
            const distance = Math.abs(drag.y - rect.bottom);
            if (!best || distance < best.distance) best = { el, rect, distance };
        }
        if (!best) { drag.target = null; drag.line.hidden = true; return; }

        const stays = best.el === drag.card.previousElementSibling || best.el === drag.own;
        drag.target = stays ? null : best.el;
        const paper = drag.root.getBoundingClientRect();
        drag.line.style.top   = Math.round(best.rect.bottom - 1) + 'px';
        drag.line.style.left  = Math.round(paper.left + 14) + 'px';
        drag.line.style.width = Math.round(paper.width - 28) + 'px';
        drag.line.classList.toggle('is-home', stays);
        drag.line.hidden = false;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Scroll While the Pointer Is Held Near an Edge
    // ------------------------------------------------------------
    function Na__LeStmtMove__Tick() {
        const drag = Na__LeStmtMove__Drag;
        if (!drag) return;
        const view = (drag.scroller === document.scrollingElement || drag.scroller === document.documentElement)
            ? { top : 0, bottom : window.innerHeight }
            : drag.scroller.getBoundingClientRect();
        let step = 0;
        if (drag.y < view.top + Na__LeStmtMove__EDGE_PX)         step = -Na__LeStmtMove__MAX_STEP_PX * (1 - Math.max(0, drag.y - view.top) / Na__LeStmtMove__EDGE_PX);
        else if (drag.y > view.bottom - Na__LeStmtMove__EDGE_PX) step =  Na__LeStmtMove__MAX_STEP_PX * (1 - Math.max(0, view.bottom - drag.y) / Na__LeStmtMove__EDGE_PX);
        if (step !== 0) {
            drag.scroller.scrollTop += Math.round(step);
            Na__LeStmtMove__Locate();
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put the Section Down Under a Divider
    // ------------------------------------------------------------
    function Na__LeStmtMove__Place(card, own, target) {
        if (own) own.remove();                                                  // <-- It leaves no two dividers touching behind it
        target.after(card);
        let below = card.nextElementSibling;
        if (!Na__LeStmtMove__IsDivider(below)) {
            below = own || Na__LeStmtMove__Copy(target);                        // <-- Its own divider travels with it
            card.after(below);
        }
        Na__LeStmtMove__EndWithBlank(target);
        Na__LeStmtMove__EndWithBlank(card);
        Na__LeStmtMove__EndWithBlank(below);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Finish, Moving the Section or Not
    // ------------------------------------------------------------
    function Na__LeStmtMove__End(commit) {
        const drag = Na__LeStmtMove__Drag;
        if (!drag) return;
        Na__LeStmtMove__Drag = null;

        clearInterval(drag.timer);
        drag.handle.removeEventListener('pointermove', drag.onMove);
        drag.handle.removeEventListener('pointerup', drag.onUp);
        drag.handle.removeEventListener('pointercancel', drag.onCancel);
        window.removeEventListener('keydown', drag.onKey, true);
        try { drag.handle.releasePointerCapture(drag.pointerId); } catch (error) { /* already released */ }
        drag.line.remove();
        drag.card.classList.remove('is-moving');
        document.documentElement.classList.remove('na-le-stmt-is-moving');

        if (!commit || !drag.target) return;
        Na__LeStmtMove__Place(drag.card, drag.own, drag.target);

        drag.card.classList.add('is-landed');
        setTimeout(() => drag.card.classList.remove('is-landed'), 900);
        if (typeof drag.onMoved === 'function') drag.onMoved();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Start Moving a Section From Its Handle's Pointerdown
    // ------------------------------------------------------------
    // event   : the pointerdown on the handle.
    // card    : the section's top-level block (a child of root).
    // root    : the editable page.
    // onMoved : called once, after the section has moved.
    // ------------------------------------------------------------
    function Na__LeStmtMove__Begin(event, card, root, onMoved) {
        if (!event || event.button !== 0 || !card || !root || card.parentElement !== root) return;
        event.preventDefault();                                                 // <-- No text selection, no caret moved
        event.stopPropagation();
        if (Na__LeStmtMove__Drag) Na__LeStmtMove__End(false);

        const handle = event.currentTarget;
        const line   = document.createElement('div');
        line.className = 'na-le-stmt-move__line';
        line.hidden = true;
        document.body.appendChild(line);

        const drag = {
            card, root, onMoved, handle, line,
            own       : Na__LeStmtMove__OwnDivider(card),
            pointerId : event.pointerId,
            y         : event.clientY,
            target    : null,
            scroller  : Na__LeStmtMove__Scroller(root)
        };
        drag.onMove   = (move) => { drag.y = move.clientY; Na__LeStmtMove__Locate(); };
        drag.onUp     = () => Na__LeStmtMove__End(true);
        drag.onCancel = () => Na__LeStmtMove__End(false);
        drag.onKey    = (key) => { if (key.key === 'Escape') { key.preventDefault(); key.stopPropagation(); Na__LeStmtMove__End(false); } };
        drag.timer    = setInterval(Na__LeStmtMove__Tick, Na__LeStmtMove__TICK_MS);

        try { handle.setPointerCapture(event.pointerId); } catch (error) { /* a synthetic event in a test */ }
        handle.addEventListener('pointermove', drag.onMove);
        handle.addEventListener('pointerup', drag.onUp);
        handle.addEventListener('pointercancel', drag.onCancel);
        window.addEventListener('keydown', drag.onKey, true);

        card.classList.add('is-moving');
        document.documentElement.classList.add('na-le-stmt-is-moving');
        Na__LeStmtMove__Drag = drag;
        Na__LeStmtMove__Locate();
    }
    // ------------------------------------------------------------


    // FUNCTION | Move a Section Under a Given Divider, Without a Pointer
    // ------------------------------------------------------------
    // The same rule as a drop, for a test (or a keyboard command). Returns
    // true when it moved.
    // ------------------------------------------------------------
    function Na__LeStmtMove__MoveUnder(card, target) {
        if (!card || !Na__LeStmtMove__IsDivider(target)) return false;
        const own = Na__LeStmtMove__OwnDivider(card);
        if (target === card.previousElementSibling || target === own) return false;
        Na__LeStmtMove__Place(card, own, target);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Whether a Move Is Under Way
    // ------------------------------------------------------------
    function Na__LeStmtMove__IsMoving() { return Na__LeStmtMove__Drag !== null; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Statement Editor Section Move API
    // ------------------------------------------------------------
    export {
        Na__LeStmtMove__Begin,
        Na__LeStmtMove__MoveUnder,
        Na__LeStmtMove__IsMoving
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
