// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SPECIFICATION EDITOR - RENDERING
// =============================================================================
//
// FILE       : Na__LayoutEditor__SpecEditor__Render__.js
// NAMESPACE  : Na__LeSpecEd
// MODULE     : Layout Editor - Specification Editor - Rendering
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Rebuilding the Project Specification page, laying Read's pages out, the filter and revealing a note
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - Rebuilds Edit from the specification, keeping its scroll and the field
//   that had the focus, or focusing a new note's title or a new group's
//   prefix. A rebuild asked for during a drag waits for the drag to end.
// - Lays Read's pages out again from the first page, keeping the reader's
//   place.
// - Rebuilds on the next animation frame, however often it is asked.
// - Hides the notes and groups the filter does not match, and scrolls a note
//   into view and flashes it.
//
// INTEGRATION:
// - Na__LayoutEditor__SpecEditor__ renders and reveals from here when the
//   page is shown, and exports Render and Reveal as its own. Its listeners,
//   __Actions__ and __NoteDrag__ ask for rebuilds through Schedule.
// - Builds Edit with __Bar__ and __Notes__; Read's pages are
//   Na__LayoutEditor__SpecDocument__'s.
// - Assigns module variables through Na__LayoutEditor__SpecEditor__State__'s
//   accessors.
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

    // MODULE IMPORTS | Config, Specification, Links and Document
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeSpec__GetState,
        Na__LeSpec__GetGroups,
        Na__LeSpec__GetGroupById,
        Na__LeSpec__GetNoteEntry,
        Na__LeSpec__PrefixClashes
    } from './Na__LayoutEditor__SpecData__.js';
    import { Na__LeSpecLink__Usage } from './Na__LayoutEditor__SpecLinks__.js';
    import { Na__LeSpecDoc__Render, Na__LeSpecDoc__Fit } from './Na__LayoutEditor__SpecDocument__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Specification Editor Units: State, Small Builders, the Bar and Groups and Notes
    // ------------------------------------------------------------
    import {
        Na__LeSpecEd__Root,
        Na__LeSpecEd__Scroll,
        Na__LeSpecEd__Page,
        Na__LeSpecEd__Filter,
        Na__LeSpecEd__Editable,
        Na__LeSpecEd__Shown,
        Na__LeSpecEd__Frame,
        Na__LeSpecEd__Drag,
        Na__LeSpecEd__FocusAfter,
        Na__LeSpecEd__Reader,
        Na__LeSpecEd__Desk,
        Na__LeSpecEd__ScrollBack,
        Na__LeSpecEd__AssignFrame,
        Na__LeSpecEd__AssignUsage,
        Na__LeSpecEd__AssignFocusAfter,
        Na__LeSpecEd__AssignPages
    } from './Na__LayoutEditor__SpecEditor__State__.js';
    import { Na__LeSpecEd__El, Na__LeSpecEd__Grow, Na__LeSpecEd__IsCompact, Na__LeSpecEd__IsReading } from './Na__LayoutEditor__SpecEditor__Builders__.js';
    import { Na__LeSpecEd__UpdateBar, Na__LeSpecEd__RenderAlerts } from './Na__LayoutEditor__SpecEditor__Bar__.js';
    import { Na__LeSpecEd__BuildEmpty, Na__LeSpecEd__BuildGroup } from './Na__LayoutEditor__SpecEditor__Notes__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Rendering
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Remember Which Field Had the Focus, and Put It Back After a Rebuild
    // ------------------------------------------------------------
    function Na__LeSpecEd__CaptureFocus() {
        const active = document.activeElement;
        if (!Na__LeSpecEd__Page || !active || !Na__LeSpecEd__Page.contains(active)) return null;
        const field  = active.getAttribute('data-na-spec-field');
        const action = active.getAttribute('data-na-spec');
        if (!field && !action) return null;
        return {
            selector : (field ? '[data-na-spec-field="' + field + '"]' : '[data-na-spec="' + action + '"]')
                     + (active.getAttribute('data-note-id')  ? '[data-note-id="'  + CSS.escape(active.getAttribute('data-note-id'))  + '"]' : '')
                     + (active.getAttribute('data-group-id') ? '[data-group-id="' + CSS.escape(active.getAttribute('data-group-id')) + '"]' : ''),
            start : (typeof active.selectionStart === 'number') ? active.selectionStart : null,
            end   : (typeof active.selectionEnd === 'number') ? active.selectionEnd : null
        };
    }
    function Na__LeSpecEd__RestoreFocus(focus) {
        const wanted = Na__LeSpecEd__FocusAfter || focus;
        Na__LeSpecEd__AssignFocusAfter(null);
        if (!wanted || !Na__LeSpecEd__Page) return;
        const el = Na__LeSpecEd__Page.querySelector(wanted.selector);
        if (!el) return;
        el.focus({ preventScroll : !Na__LeSpecEd__FocusAfter && !!focus });
        if (typeof wanted.start === 'number' && typeof el.setSelectionRange === 'function') {
            try { el.setSelectionRange(wanted.start, wanted.end); } catch (e) { /* not a text field */ }
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Rebuild the Page From the Specification
    // ------------------------------------------------------------
    function Na__LeSpecEd__Render() {
        Na__LeSpecEd__AssignFrame(0);
        if (!Na__LeSpecEd__Root || !Na__LeSpecEd__Shown) return;
        if (Na__LeSpecEd__Drag) { Na__LeSpecEd__Drag.pending = true; return; }   // <-- Never rebuild the rows out from under a drag
        const reading = Na__LeSpecEd__IsReading();
        Na__LeSpecEd__Root.classList.toggle('is-reading', reading);
        Na__LeSpecEd__Scroll.hidden = reading;
        Na__LeSpecEd__Reader.hidden = !reading;
        if (reading) { Na__LeSpecEd__RenderReading(); return; }
        const L       = Na__LeCfg__GetLabel;
        const state   = Na__LeSpec__GetState();
        const focus   = Na__LeSpecEd__CaptureFocus();
        const scroll  = Na__LeSpecEd__ScrollBack.edit !== null ? Na__LeSpecEd__ScrollBack.edit : Na__LeSpecEd__Scroll.scrollTop;
        Na__LeSpecEd__ScrollBack.edit = null;
        const usage   = Na__LeSpecLink__Usage();
        Na__LeSpecEd__AssignUsage(usage);
        Na__LeSpecEd__Root.classList.toggle('is-compact', Na__LeSpecEd__IsCompact());
        Na__LeSpecEd__Root.classList.toggle('is-readonly', !Na__LeSpecEd__Editable);
        Na__LeSpecEd__RenderAlerts(state, usage);

        const page = Na__LeSpecEd__Page;
        page.innerHTML = '';
        if (!state.loaded) {
            page.appendChild(Na__LeSpecEd__El('div', 'na-le-spec__empty', L('SpecLoadingPage', 'Loading the project specification...')));
        } else if (!Na__LeSpec__GetGroups().length) {
            page.appendChild(Na__LeSpecEd__BuildEmpty());
        } else {
            const groups  = Na__LeSpec__GetGroups();
            const clashes = Na__LeSpec__PrefixClashes();
            groups.forEach((group, index) => page.appendChild(Na__LeSpecEd__BuildGroup(group, index, groups, usage, clashes)));
        }
        page.querySelectorAll('textarea').forEach(Na__LeSpecEd__Grow);            // <-- Measured now the page is laid out
        Na__LeSpecEd__Scroll.scrollTop = scroll;
        Na__LeSpecEd__ApplyFilter();
        Na__LeSpecEd__UpdateBar();
        Na__LeSpecEd__RestoreFocus(focus);
    }
    // ------------------------------------------------------------


    // FUNCTION | Lay Read's Pages Out Again
    // ------------------------------------------------------------
    // From the first page every time: a note that grows can move every page
    // after it. The reader stays where it was.
    // ------------------------------------------------------------
    function Na__LeSpecEd__RenderReading() {
        const scroll = Na__LeSpecEd__ScrollBack.read !== null ? Na__LeSpecEd__ScrollBack.read : Na__LeSpecEd__Reader.scrollTop;
        Na__LeSpecEd__ScrollBack.read = null;
        Na__LeSpecEd__Root.classList.toggle('is-readonly', !Na__LeSpecEd__Editable);
        Na__LeSpecEd__AssignPages(Na__LeSpecDoc__Render(Na__LeSpecEd__Desk).pages);
        Na__LeSpecDoc__Fit(Na__LeSpecEd__Reader, Na__LeSpecEd__Desk);
        Na__LeSpecEd__Reader.scrollTop = scroll;
        Na__LeSpecEd__UpdateBar();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Rebuild on the Next Animation Frame (asking twice costs nothing)
    // ------------------------------------------------------------
    function Na__LeSpecEd__Schedule() {
        if (!Na__LeSpecEd__Shown || Na__LeSpecEd__Frame) return;
        Na__LeSpecEd__AssignFrame(window.requestAnimationFrame(Na__LeSpecEd__Render));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Hide the Notes the Filter Does Not Match
    // ------------------------------------------------------------
    // A group is hidden when none of its notes match and neither its prefix
    // nor its title does. Grips do nothing while a filter is on: the rows on
    // show are not the group's whole order.
    // ------------------------------------------------------------
    function Na__LeSpecEd__ApplyFilter() {
        if (!Na__LeSpecEd__Page) return;
        const query = Na__LeSpecEd__Filter ? Na__LeSpecEd__Filter.value.trim().toLowerCase() : '';
        Na__LeSpecEd__Root.classList.toggle('is-filtered', query !== '');
        Na__LeSpecEd__Page.querySelectorAll('.na-le-spec-group').forEach((section) => {
            const group = Na__LeSpec__GetGroupById(section.getAttribute('data-group-id'));
            if (!group) return;
            const groupHit = !query || (group.Group__Prefix + ' ' + group.Group__Title).toLowerCase().indexOf(query) !== -1;
            let shown = 0;
            section.querySelectorAll('.na-le-spec-note').forEach((row) => {
                const entry = Na__LeSpec__GetNoteEntry(row.getAttribute('data-note-id'));
                const hit   = !query || groupHit || (entry && (entry.code + ' ' + entry.note.Note__Title + ' ' + entry.note.Note__Body).toLowerCase().indexOf(query) !== -1);
                row.hidden = !hit;
                if (hit) shown++;
            });
            section.hidden = !!query && !groupHit && shown === 0;
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Scroll a Note Into View and Flash It
    // ------------------------------------------------------------
    function Na__LeSpecEd__Reveal(noteId) {
        if (!Na__LeSpecEd__Page || !noteId) return false;
        const find = () => Na__LeSpecEd__Page.querySelector('.na-le-spec-note[data-note-id="' + CSS.escape(noteId) + '"]');
        let row = find();
        if (row && row.hidden && Na__LeSpecEd__Filter) { Na__LeSpecEd__Filter.value = ''; Na__LeSpecEd__ApplyFilter(); row = find(); }
        if (!row) return false;
        row.scrollIntoView({ block : 'center' });
        row.classList.remove('is-flash');
        void row.offsetWidth;                                                     // <-- Restart the animation when the same note is revealed twice
        row.classList.add('is-flash');
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Specification Editor Rendering
    // ------------------------------------------------------------
    export {
        Na__LeSpecEd__Render,
        Na__LeSpecEd__Schedule,
        Na__LeSpecEd__ApplyFilter,
        Na__LeSpecEd__Reveal
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
