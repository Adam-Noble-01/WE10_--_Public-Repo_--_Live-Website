// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SPECIFICATION EDITOR - NOTE DRAG
// =============================================================================
//
// FILE       : Na__LayoutEditor__SpecEditor__NoteDrag__.js
// NAMESPACE  : Na__LeSpecEd
// MODULE     : Layout Editor - Specification Editor - Note Drag
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Dragging a note by its grip to reorder its group
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - A press on a grip measures the group's rows once. The row follows the
//   pointer, the rows it passes slide aside, and the page scrolls when the
//   pointer nears its top or foot.
// - Releasing moves the note and renumbers its group in one step. A cancel,
//   Escape or the window losing focus puts the rows back.
// - A grip does nothing while a filter is on or in a read-only session.
//
// INTEGRATION:
// - Na__LayoutEditor__SpecEditor__ listens for the press on the page's root
//   and ends a drag in flight when the page is hidden;
//   Na__LayoutEditor__SpecEditor__Actions__ ends it when the view changes.
// - A rebuild asked for during the drag is left to its end: the move's own
//   announcement rebuilds, or Schedule (__Render__) when nothing moved.
// - Assigns the drag through Na__LayoutEditor__SpecEditor__State__'s accessor.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the ValeVision3D v2.47.0 split of the same module (same unit, same functions)
// - Parity        : verbatim (moved code)
// - Divergences   : n/a
// - Back-port     : n/a (ValeVision3D's copy is already split into the same units)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__SpecEditor__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Specification
    // ------------------------------------------------------------
    import { Na__LeSpec__MoveNote } from './Na__LayoutEditor__SpecData__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Specification Editor Units: State and Rendering
    // ------------------------------------------------------------
    import {
        Na__LeSpecEd__DRAG_START_PX,
        Na__LeSpecEd__AUTOSCROLL_PX,
        Na__LeSpecEd__Scroll,
        Na__LeSpecEd__Filter,
        Na__LeSpecEd__Editable,
        Na__LeSpecEd__Drag,
        Na__LeSpecEd__AssignDrag
    } from './Na__LayoutEditor__SpecEditor__State__.js';
    import { Na__LeSpecEd__Schedule } from './Na__LayoutEditor__SpecEditor__Render__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Dragging a Note by Its Grip
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Press on a Grip: Measure the Group's Rows Once
    // ------------------------------------------------------------
    // The rows and the pointer are both measured from the top of the list, so a
    // page that scrolls during the drag still lines up (the same rule as the
    // Drawing Layers grip). Rows can be any height; a row passed moves by the
    // height of the one being dragged.
    // ------------------------------------------------------------
    function Na__LeSpecEd__OnPointerDown(event) {
        const grip = event.target && event.target.closest ? event.target.closest('[data-na-spec="note-grip"]') : null;
        if (!grip || event.button !== 0 || Na__LeSpecEd__Drag || !Na__LeSpecEd__Editable) return;
        if (Na__LeSpecEd__Filter && Na__LeSpecEd__Filter.value.trim()) return;     // <-- A filtered list is not the group's order
        const row  = grip.closest('.na-le-spec-note');
        const list = row ? row.parentNode : null;
        if (!list) return;
        const rows = Array.from(list.children);
        const from = rows.indexOf(row);
        if (from === -1) return;
        event.preventDefault();
        const top = list.getBoundingClientRect().top;
        Na__LeSpecEd__AssignDrag({
            noteId    : row.getAttribute('data-note-id'),
            groupId   : list.getAttribute('data-group-id'),
            list      : list,
            rows      : rows,
            slots     : rows.map((r) => { const box = r.getBoundingClientRect(); return { top : box.top - top, height : box.height }; }),
            from      : from,
            to        : from,
            startY    : event.clientY - top,
            pointerId : event.pointerId,
            moved     : false,
            pending   : false
        });
        try { grip.setPointerCapture(event.pointerId); } catch (err) { /* A scripted pointer has nothing to capture; the window still hears it */ }
        window.addEventListener('pointermove',   Na__LeSpecEd__DragMove, true);
        window.addEventListener('pointerup',     Na__LeSpecEd__DragUp, true);
        window.addEventListener('pointercancel', Na__LeSpecEd__DragUp, true);
        window.addEventListener('keydown',       Na__LeSpecEd__DragAbandon, true);
        window.addEventListener('blur',          Na__LeSpecEd__DragAbandon);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Move: The Row Follows, the Rows It Passes Slide Aside
    // ------------------------------------------------------------
    function Na__LeSpecEd__DragMove(event) {
        const drag = Na__LeSpecEd__Drag;
        if (!drag || event.pointerId !== drag.pointerId) return;
        const scroller = Na__LeSpecEd__Scroll.getBoundingClientRect();
        if (event.clientY < scroller.top + Na__LeSpecEd__AUTOSCROLL_PX) Na__LeSpecEd__Scroll.scrollTop -= 12;        // <-- Near the top or foot of the page, the page scrolls
        else if (event.clientY > scroller.bottom - Na__LeSpecEd__AUTOSCROLL_PX) Na__LeSpecEd__Scroll.scrollTop += 12;
        let dy = (event.clientY - drag.list.getBoundingClientRect().top) - drag.startY;
        if (!drag.moved) {
            if (Math.abs(dy) < Na__LeSpecEd__DRAG_START_PX) return;
            drag.moved = true;
            drag.list.classList.add('is-sorting');
            drag.rows[drag.from].classList.add('is-dragging');
            document.body.classList.add('na-le-sorting');
        }
        const own   = drag.slots[drag.from];
        const first = drag.slots[0];
        const last  = drag.slots[drag.slots.length - 1];
        dy = Math.max(first.top - own.top, Math.min((last.top + last.height) - (own.top + own.height), dy));
        const edgeTop    = own.top + dy;
        const edgeBottom = edgeTop + own.height;
        let to = drag.from;
        drag.slots.forEach((slot, i) => {
            const middle = slot.top + (slot.height / 2);
            if (i < drag.from && edgeTop < middle && i < to) to = i;
            if (i > drag.from && edgeBottom > middle) to = i;
        });
        drag.to = to;
        const gap   = drag.slots.length > 1 ? Math.max(0, drag.slots[1].top - (first.top + first.height)) : 0;
        const pitch = own.height + gap;
        drag.rows.forEach((row, i) => {
            const shift = i === drag.from ? dy : ((i > drag.from && i <= to) ? -pitch : ((i < drag.from && i >= to) ? pitch : 0));
            row.style.transform = shift ? 'translateY(' + shift + 'px)' : '';
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Release, Cancel, Escape or the Window Losing Focus
    // ------------------------------------------------------------
    function Na__LeSpecEd__DragUp(event) {
        const drag = Na__LeSpecEd__Drag;
        if (drag && event.pointerId === drag.pointerId) Na__LeSpecEd__DragEnd(event.type === 'pointerup');
    }
    function Na__LeSpecEd__DragAbandon(event) {
        if (event.type === 'keydown') {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
        }
        Na__LeSpecEd__DragEnd(false);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | End the Drag: One Move and a Renumber, or None
    // ------------------------------------------------------------
    // The drag is cleared before the move, whose announcement asks for a
    // rebuild that a drag in flight would put off.
    // ------------------------------------------------------------
    function Na__LeSpecEd__DragEnd(commit) {
        const drag = Na__LeSpecEd__Drag;
        if (!drag) return;
        Na__LeSpecEd__AssignDrag(null);
        window.removeEventListener('pointermove',   Na__LeSpecEd__DragMove, true);
        window.removeEventListener('pointerup',     Na__LeSpecEd__DragUp, true);
        window.removeEventListener('pointercancel', Na__LeSpecEd__DragUp, true);
        window.removeEventListener('keydown',       Na__LeSpecEd__DragAbandon, true);
        window.removeEventListener('blur',          Na__LeSpecEd__DragAbandon);
        document.body.classList.remove('na-le-sorting');
        drag.list.classList.remove('is-sorting');
        drag.rows.forEach((row) => { row.style.transform = ''; row.classList.remove('is-dragging'); });
        const moved = commit && drag.moved && drag.to !== drag.from && Na__LeSpec__MoveNote(drag.noteId, drag.groupId, drag.to);
        if (!moved && drag.pending) Na__LeSpecEd__Schedule();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Specification Editor Note Drag
    // ------------------------------------------------------------
    export {
        Na__LeSpecEd__OnPointerDown,
        Na__LeSpecEd__DragEnd
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
