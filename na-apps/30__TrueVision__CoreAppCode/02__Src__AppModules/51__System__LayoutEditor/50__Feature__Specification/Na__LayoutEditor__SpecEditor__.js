// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SPECIFICATION EDITOR
// =============================================================================
//
// FILE       : Na__LayoutEditor__SpecEditor__.js
// NAMESPACE  : Na__LeSpecEd
// MODULE     : Layout Editor - Specification Editor
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The Project Specification tab: write, group, order and number the project's drawing notes, and see where each is used
// CREATED    : 14-Sep-2026
//
// DESCRIPTION:
// - A page over the drawing editor, shown by the Project Specification tab.
//   The specification is a list of groups; each group is a prefix (GN, SN,
//   EE), a title and a general switch, then its notes in order. Each note has
//   a heading - its code, split into the group it is in and its number, then
//   its title - and its specification text underneath.
// - CODES ARE NEVER TYPED. A note's number is its place in its group. Drag a
//   note by its grip (or Alt+Up and Alt+Down) and it and its neighbours are
//   renumbered; choose another prefix on its code and it moves to the end of
//   that group; change a group's prefix and all its notes take it. Every
//   bubble linked to a note follows on every sheet (Na__LayoutEditor__SpecLinks__).
// - A prefix is refused when it is not letters, is too long, or is another
//   group's, and the refusal says why beside the group, so two groups can
//   never be given clashing codes. A file that arrives with a clash is marked.
// - WHERE A NOTE IS USED. Under each note: the sheets whose bubbles link to it
//   (a click opens the sheet with the bubble selected), and any unlinked
//   bubbles that already read its code, with Link beside them. At the top: the
//   bubbles linked to deleted notes, and the codes bubbles read that no note has.
// - Typing is live - the sheets and their margins follow as it happens - and a
//   field's commit (leaving it, or Enter in a one-line field) is one undo step.
//   Ctrl+Z and Ctrl+Y undo the tab's own steps when no text field has the focus.
// - The bar says whether the specification is synced, kept only in this
//   browser, or could not be read, and holds Sync. Headings only folds every
//   note to its heading, for reordering a long specification. The filter hides
//   the notes whose code, title and text do not contain what is typed.
// - Read-only sessions see the same page with nothing editable.
// - EDIT AND READ. Two tabs inside the tab, beside its title. Edit is the page
//   above. Read lays the specification out as A4 pages - the pages it prints
//   as (Na__LayoutEditor__SpecDocument__) - with Print, and its text is real
//   text a browser can read aloud. The bar keeps the sync state and Sync in
//   both; the filter and the editing tools are Edit's. The view is remembered
//   in this browser, a note asked for from a sheet opens Edit, and a read-only
//   session starts in Read.
// - While the page is up the sheet beneath it is hidden as well as covered,
//   so a Read Aloud or a find on the page never reaches the panels under it.
// - ONE FILE AND ITS UNITS. This file mounts the page, shows and hides it,
//   listens while it is shown and holds the public API. What the page is
//   built from and how it answers input live in its units (INTEGRATION).
//
// INTEGRATION:
// - Mounted into the editor host and shown and hidden by the mode controller.
//   Opening a sheet from a usage chip goes out as Na__LeSpec__GOTO_EVENT.
// - Read's pages, and printing them, are Na__LayoutEditor__SpecDocument__'s.
// - The units, each Na__LayoutEditor__SpecEditor__<Unit>__.js, imported here:
//     State     the constants and the module variables, and the accessors
//               the other units assign the variables through
//     Builders  the small builders, and the settings kept in this browser
//     Bar       the bar and the alerts
//     Notes     the groups and their notes, and the page for a project with
//               no specification yet
//     Render    rebuilding Edit, laying Read out, the filter, revealing a note
//     NoteDrag  dragging a note by its grip
//     Actions   switching between Edit and Read; clicks, typing, commits, keys
//   None of them imports this file. SetView, Render and Reveal are theirs and
//   are exported from here as before.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (14-Sep-2026)
// - ValeVision    : not yet ported. Nothing here is app-specific.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 15-Sep-2026 - Version 1.2.0
// - Split into Na__LayoutEditor__SpecEditor__State__.js, __Builders__.js,
//   __Bar__.js, __Notes__.js, __Render__.js, __NoteDrag__.js and
//   __Actions__.js to stay under the line budget. No behaviour change: the
//   code moved verbatim and every export is unchanged.
// - The same split as ValeVision3D v2.47.0 (SpecEditor 1.2.0): the same
//   units holding the same functions, so the two copies port file for file.
//
// 14-Sep-2026 - Version 1.1.0
// - Edit and Read, two tabs inside the tab. Read shows the specification as
//   A4 pages with Print (Na__LayoutEditor__SpecDocument__). Each view keeps
//   its own scroll, also across a visit to a sheet. Ctrl+Z and Ctrl+Y step
//   the history only in Edit.
// - The host carries is-spec-shown while the page is up, which hides the
//   sheet beneath it.
//
// 14-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Specification, Links and Document
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__CHANGED_EVENT } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSpec__CHANGED_EVENT, Na__LeSpec__GetState } from './Na__LayoutEditor__SpecData__.js';
    import { Na__LeSpecLink__Usage } from './Na__LayoutEditor__SpecLinks__.js';
    import { Na__LeSpecDoc__Initialize, Na__LeSpecDoc__Fit } from './Na__LayoutEditor__SpecDocument__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Specification Editor Units: State, Small Builders, the Bar, Rendering, the Note Drag and Actions
    // ------------------------------------------------------------
    import {
        Na__LeSpecEd__VIEW_EDIT,
        Na__LeSpecEd__VIEW_READ,
        Na__LeSpecEd__Root,
        Na__LeSpecEd__Scroll,
        Na__LeSpecEd__Editable,
        Na__LeSpecEd__Shown,
        Na__LeSpecEd__Frame,
        Na__LeSpecEd__Usage,
        Na__LeSpecEd__Drag,
        Na__LeSpecEd__Reader,
        Na__LeSpecEd__Desk,
        Na__LeSpecEd__View,
        Na__LeSpecEd__ScrollBack,
        Na__LeSpecEd__AssignRoot,
        Na__LeSpecEd__AssignBar,
        Na__LeSpecEd__AssignAlerts,
        Na__LeSpecEd__AssignScroll,
        Na__LeSpecEd__AssignPage,
        Na__LeSpecEd__AssignEditable,
        Na__LeSpecEd__AssignShowToast,
        Na__LeSpecEd__AssignShown,
        Na__LeSpecEd__AssignFrame,
        Na__LeSpecEd__AssignPrefixError,
        Na__LeSpecEd__AssignReader,
        Na__LeSpecEd__AssignDesk,
        Na__LeSpecEd__AssignView
    } from './Na__LayoutEditor__SpecEditor__State__.js';
    import {
        Na__LeSpecEd__El,
        Na__LeSpecEd__StoredView,
        Na__LeSpecEd__StoreView,
        Na__LeSpecEd__IsReading
    } from './Na__LayoutEditor__SpecEditor__Builders__.js';
    import { Na__LeSpecEd__BuildBar, Na__LeSpecEd__UpdateBar, Na__LeSpecEd__RenderAlerts } from './Na__LayoutEditor__SpecEditor__Bar__.js';
    import { Na__LeSpecEd__Render, Na__LeSpecEd__Schedule, Na__LeSpecEd__Reveal } from './Na__LayoutEditor__SpecEditor__Render__.js';
    import { Na__LeSpecEd__OnPointerDown, Na__LeSpecEd__DragEnd } from './Na__LayoutEditor__SpecEditor__NoteDrag__.js';
    import {
        Na__LeSpecEd__SetView,
        Na__LeSpecEd__OnClick,
        Na__LeSpecEd__OnInput,
        Na__LeSpecEd__OnChange,
        Na__LeSpecEd__OnKeyDown
    } from './Na__LayoutEditor__SpecEditor__Actions__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Listening While Shown
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Specification Changed
    // ------------------------------------------------------------
    // Typing into a title or a text only needs the bar: the field already shows
    // it. A group's own settings, a structural change, an undo or a load
    // rebuilds, keeping the focus where it was.
    // ------------------------------------------------------------
    function Na__LeSpecEd__OnSpecChanged(event) {
        const detail  = event.detail || {};
        const barOnly = detail.reason === 'status' || detail.reason === 'synced';
        const typed   = detail.reason === 'note' || (detail.reason === 'group' && detail.live);
        if (barOnly || (typed && !Na__LeSpecEd__IsReading())) {                    // <-- Read has no field showing the typing: its pages are laid out again
            Na__LeSpecEd__UpdateBar();
            if (barOnly) Na__LeSpecEd__RenderAlerts(Na__LeSpec__GetState(), Na__LeSpecEd__Usage || Na__LeSpecLink__Usage());
            return;
        }
        Na__LeSpecEd__Schedule();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Sheet Changed (links made from this page): Where Notes Are Used Moved
    // ------------------------------------------------------------
    function Na__LeSpecEd__OnModelChanged() {
        if (Na__LeSpecEd__IsReading()) return;                                     // <-- The pages do not say where a note is used
        Na__LeSpecEd__Schedule();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Window Resized: Read's Pages Fit Its New Width
    // ------------------------------------------------------------
    function Na__LeSpecEd__OnResize() {
        if (Na__LeSpecEd__Shown && Na__LeSpecEd__IsReading()) Na__LeSpecDoc__Fit(Na__LeSpecEd__Reader, Na__LeSpecEd__Desk);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Build the Page Inside the Editor Host (once)
    // ------------------------------------------------------------
    // options: { editable, showToast }
    // ------------------------------------------------------------
    function Na__LeSpecEd__Mount(container, options) {
        if (!container) return false;
        Na__LeSpecEd__AssignEditable(!!(options && options.editable));
        Na__LeSpecEd__AssignShowToast((options && options.showToast) || null);
        if (Na__LeSpecEd__Root && Na__LeSpecEd__Root.parentNode === container) return true;
        const root = Na__LeSpecEd__El('div', 'na-le-spec');
        root.hidden = true;
        root.setAttribute('role', 'region');
        root.setAttribute('aria-label', Na__LeCfg__GetLabel('SpecTitle', 'Project Specification'));
        root.innerHTML = '<div class="na-le-spec__bar"></div><div class="na-le-spec__alerts" hidden></div><div class="na-le-spec__scroll"><div class="na-le-spec__page"></div></div>'
            + '<div class="na-le-spec__reader" role="region" tabindex="0" hidden><div class="na-le-spec__desk"></div></div>';
        container.appendChild(root);
        Na__LeSpecEd__AssignRoot(root);
        Na__LeSpecEd__AssignBar(root.querySelector('.na-le-spec__bar'));
        Na__LeSpecEd__AssignAlerts(root.querySelector('.na-le-spec__alerts'));
        Na__LeSpecEd__AssignScroll(root.querySelector('.na-le-spec__scroll'));
        Na__LeSpecEd__AssignPage(root.querySelector('.na-le-spec__page'));
        Na__LeSpecEd__AssignReader(root.querySelector('.na-le-spec__reader'));
        Na__LeSpecEd__AssignDesk(root.querySelector('.na-le-spec__desk'));
        Na__LeSpecEd__Reader.setAttribute('aria-label', Na__LeCfg__GetLabel('SpecReaderLabel', 'Project Specification pages'));
        Na__LeSpecEd__AssignView(Na__LeSpecEd__StoredView() || (Na__LeSpecEd__Editable ? Na__LeSpecEd__VIEW_EDIT : Na__LeSpecEd__VIEW_READ));   // <-- A read-only session starts on the pages
        Na__LeSpecDoc__Initialize({ isPrintable : () => Na__LeSpecEd__Shown });
        Na__LeSpecEd__BuildBar();
        root.addEventListener('click',       Na__LeSpecEd__OnClick);
        root.addEventListener('input',       Na__LeSpecEd__OnInput);
        root.addEventListener('change',      Na__LeSpecEd__OnChange);
        root.addEventListener('keydown',     Na__LeSpecEd__OnKeyDown);
        root.addEventListener('pointerdown', Na__LeSpecEd__OnPointerDown);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Show the Page (options: { noteId } to bring one note into view)
    // ------------------------------------------------------------
    function Na__LeSpecEd__Show(options) {
        if (!Na__LeSpecEd__Root) return false;
        const opts = options || {};
        if (opts.noteId && Na__LeSpecEd__IsReading()) {                            // <-- A note asked for from a sheet is shown where it is edited
            Na__LeSpecEd__AssignView(Na__LeSpecEd__VIEW_EDIT);
            Na__LeSpecEd__StoreView(Na__LeSpecEd__VIEW_EDIT);
        }
        if (!Na__LeSpecEd__Shown) {
            Na__LeSpecEd__AssignShown(true);
            Na__LeSpecEd__Root.hidden = false;
            Na__LeSpecEd__Root.parentNode.classList.add('is-spec-shown');          // <-- The sheet beneath is covered: hidden too, out of Read Aloud and find
            window.addEventListener(Na__LeSpec__CHANGED_EVENT, Na__LeSpecEd__OnSpecChanged);
            window.addEventListener(Na__LeModel__CHANGED_EVENT, Na__LeSpecEd__OnModelChanged);
            window.addEventListener('resize', Na__LeSpecEd__OnResize);
        }
        Na__LeSpecEd__Render();
        if (opts.noteId) Na__LeSpecEd__Reveal(opts.noteId);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Hide the Page
    // ------------------------------------------------------------
    // A field that still has the focus is committed first, so what was typed
    // into it is an undo step and reaches the draft.
    // ------------------------------------------------------------
    function Na__LeSpecEd__Hide() {
        if (!Na__LeSpecEd__Root || !Na__LeSpecEd__Shown) return false;
        const active = document.activeElement;
        if (active && Na__LeSpecEd__Root.contains(active) && typeof active.blur === 'function') active.blur();
        if (Na__LeSpecEd__Drag) Na__LeSpecEd__DragEnd(false);
        if (Na__LeSpecEd__Frame) { window.cancelAnimationFrame(Na__LeSpecEd__Frame); Na__LeSpecEd__AssignFrame(0); }
        window.removeEventListener(Na__LeSpec__CHANGED_EVENT, Na__LeSpecEd__OnSpecChanged);
        window.removeEventListener(Na__LeModel__CHANGED_EVENT, Na__LeSpecEd__OnModelChanged);
        window.removeEventListener('resize', Na__LeSpecEd__OnResize);
        Na__LeSpecEd__ScrollBack[Na__LeSpecEd__View] = Na__LeSpecEd__IsReading() ? Na__LeSpecEd__Reader.scrollTop : Na__LeSpecEd__Scroll.scrollTop;   // <-- Back where it was on the next visit
        Na__LeSpecEd__AssignShown(false);
        Na__LeSpecEd__Root.hidden = true;
        Na__LeSpecEd__Root.parentNode.classList.remove('is-spec-shown');
        Na__LeSpecEd__AssignPrefixError(null);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the Page on Screen, and Which View It Shows
    // ------------------------------------------------------------
    function Na__LeSpecEd__IsShown() { return Na__LeSpecEd__Shown; }
    function Na__LeSpecEd__GetView() { return Na__LeSpecEd__View; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Specification Editor API
    // ------------------------------------------------------------
    export {
        Na__LeSpecEd__Mount,
        Na__LeSpecEd__Show,
        Na__LeSpecEd__Hide,
        Na__LeSpecEd__IsShown,
        Na__LeSpecEd__GetView,
        Na__LeSpecEd__SetView,
        Na__LeSpecEd__Render,
        Na__LeSpecEd__Reveal
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
