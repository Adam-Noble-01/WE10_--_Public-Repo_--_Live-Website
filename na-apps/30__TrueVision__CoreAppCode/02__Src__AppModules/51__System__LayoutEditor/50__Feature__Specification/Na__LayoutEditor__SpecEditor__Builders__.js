// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SPECIFICATION EDITOR - SMALL BUILDERS
// =============================================================================
//
// FILE       : Na__LayoutEditor__SpecEditor__Builders__.js
// NAMESPACE  : Na__LeSpecEd
// MODULE     : Layout Editor - Specification Editor - Small Builders
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The small builders the Project Specification page is made with, and the settings it keeps in this browser
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - An element with a class and text, a button carrying an action, a field
//   carrying its name and its record, a text area grown to its text, a count
//   in words, and a chip that opens a sheet with a bubble selected.
// - Headings only and the view (Edit or Read), each remembered in this
//   browser, and whether the view on show is Read.
//
// INTEGRATION:
// - Used by Na__LayoutEditor__SpecEditor__ and by its Bar, Notes, Render and
//   Actions units. Reads the storage keys, the views and the view on show
//   from Na__LayoutEditor__SpecEditor__State__.
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

    // MODULE IMPORTS | Config
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Specification Editor Units: State
    // ------------------------------------------------------------
    import {
        Na__LeSpecEd__COMPACT_KEY,
        Na__LeSpecEd__VIEW_KEY,
        Na__LeSpecEd__VIEW_EDIT,
        Na__LeSpecEd__VIEW_READ,
        Na__LeSpecEd__View
    } from './Na__LayoutEditor__SpecEditor__State__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Small Builders
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | An Element With a Class and Optional Text
    // ------------------------------------------------------------
    function Na__LeSpecEd__El(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined && text !== null) el.textContent = text;
        return el;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Button Carrying an Action
    // ------------------------------------------------------------
    function Na__LeSpecEd__Button(text, action, title, modifier) {
        const button = Na__LeSpecEd__El('button', 'na-le-btn' + (modifier ? ' ' + modifier : ''), text);
        button.type = 'button';
        button.setAttribute('data-na-spec', action);
        if (title) button.title = title;
        return button;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Field Carrying Its Name and Its Record
    // ------------------------------------------------------------
    function Na__LeSpecEd__Field(tag, className, field, ids) {
        const el = document.createElement(tag);
        el.className = className;
        el.setAttribute('data-na-spec-field', field);
        if (ids && ids.noteId)  el.setAttribute('data-note-id', ids.noteId);
        if (ids && ids.groupId) el.setAttribute('data-group-id', ids.groupId);
        if (tag === 'input' || tag === 'textarea') { el.spellcheck = tag === 'textarea'; el.autocomplete = 'off'; }
        return el;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Grow a Text Area to Its Text
    // ------------------------------------------------------------
    function Na__LeSpecEd__Grow(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.max(34, textarea.scrollHeight + 2) + 'px';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Headings Only: Remembered in This Browser
    // ------------------------------------------------------------
    function Na__LeSpecEd__IsCompact() {
        try { return window.localStorage.getItem(Na__LeSpecEd__COMPACT_KEY) === '1'; } catch (e) { return false; }
    }
    function Na__LeSpecEd__SetCompact(on) {
        try { window.localStorage.setItem(Na__LeSpecEd__COMPACT_KEY, on ? '1' : '0'); } catch (e) { /* storage unavailable */ }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The View, Edit or Read: Remembered in This Browser
    // ------------------------------------------------------------
    function Na__LeSpecEd__StoredView() {
        try {
            const view = window.localStorage.getItem(Na__LeSpecEd__VIEW_KEY);
            return (view === Na__LeSpecEd__VIEW_EDIT || view === Na__LeSpecEd__VIEW_READ) ? view : null;
        } catch (e) { return null; }
    }
    function Na__LeSpecEd__StoreView(view) {
        try { window.localStorage.setItem(Na__LeSpecEd__VIEW_KEY, view); } catch (e) { /* storage unavailable */ }
    }
    function Na__LeSpecEd__IsReading() { return Na__LeSpecEd__View === Na__LeSpecEd__VIEW_READ; }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Count in Words: "1 note", "3 notes"
    // ------------------------------------------------------------
    function Na__LeSpecEd__Count(count, oneKey, oneText, manyKey, manyText) {
        return count === 1 ? Na__LeCfg__FormatLabel(oneKey, oneText, { count : count }) : Na__LeCfg__FormatLabel(manyKey, manyText, { count : count });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Chip That Opens a Sheet With a Bubble Selected
    // ------------------------------------------------------------
    function Na__LeSpecEd__GotoChip(text, sheetId, leaderId, warn) {
        const chip = Na__LeSpecEd__Button(text, 'goto', Na__LeCfg__GetLabel('SpecGotoTitle', 'Open this sheet with the bubble selected'), 'na-le-spec-chip' + (warn ? ' na-le-spec-chip--warn' : ''));
        chip.className = 'na-le-spec-chip' + (warn ? ' na-le-spec-chip--warn' : '');
        chip.setAttribute('data-sheet-id', sheetId);
        chip.setAttribute('data-leader-id', leaderId);
        return chip;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Specification Editor Small Builders
    // ------------------------------------------------------------
    export {
        Na__LeSpecEd__El,
        Na__LeSpecEd__Button,
        Na__LeSpecEd__Field,
        Na__LeSpecEd__Grow,
        Na__LeSpecEd__IsCompact,
        Na__LeSpecEd__SetCompact,
        Na__LeSpecEd__StoredView,
        Na__LeSpecEd__StoreView,
        Na__LeSpecEd__IsReading,
        Na__LeSpecEd__Count,
        Na__LeSpecEd__GotoChip
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
