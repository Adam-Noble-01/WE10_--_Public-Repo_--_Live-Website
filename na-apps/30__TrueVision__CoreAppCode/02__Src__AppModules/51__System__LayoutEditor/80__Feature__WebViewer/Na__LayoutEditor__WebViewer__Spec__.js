// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - WEB VIEWER - SPECIFICATION (READ ONLY)
// =============================================================================
//
// FILE       : Na__LayoutEditor__WebViewer__Spec__.js
// NAMESPACE  : Na__LeVwSpec
// MODULE     : Layout Editor - Web Viewer - Read-Only Specification
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Show the project specification to a reader on the live web as the document it prints as, and only that
// CREATED    : 18-Sep-2026
//
// DESCRIPTION:
// - THE SPECIFICATION ALREADY HAS A READING VIEW, and this module's first job
//   is to make sure that is the one a web reader ever sees. The specification
//   page has two: Edit, which is the authoring surface - fields, prefixes,
//   ordering, usage chips, undo - and Read, which lays the same notes out as
//   the A4 pages the document prints as. Na__LeSpecEd__ already starts a
//   read-only session on Read, but the choice is remembered per browser, so
//   anyone who once had authoring unlocked would come back into the editing
//   surface. Here the view is SET on every show, not defaulted, and the toggle
//   that would change it is taken off the bar.
// - WHAT IS LEFT IS A DOCUMENT. The bar keeps the title, the document number
//   and revision, the page count, Download and Print; the filter, Headings
//   only, Add group, Undo, Redo, Sync, the reload buttons and the Edit/Read
//   toggle all belong to authoring and are hidden by the viewer class. Nothing
//   is disabled-but-present: on a phone every control costs width that the
//   document needs.
// - PAGES, NOT A SCROLL OF NOTES. Read lays out real A4 sheets and shrinks them
//   to the width of the scroller, so a phone in portrait gets the document at
//   the size it will print - and the reader can page through it with the dock's
//   arrows or a flick, exactly as they do a drawing.
// - Scrolling stays the browser's. The touch recogniser is attached without
//   swallowing the gesture, so the pages keep their momentum and rubber band,
//   and only sideways travel - which the pages never use - reaches the viewer
//   as a request for the next document.
//
// INTEGRATION:
// - Na__LayoutEditor__WebViewer__ shows and hides this, and is told which way a
//   swipe went. The specification's own data, transport and draft modules are
//   untouched: they are already read-only when authoring is off.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : none. TrueVision original.
// - Back-port     : candidate (ValeVision has no web viewer).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 18-Sep-2026 - Version 1.0.0
// - Initial implementation for the public web viewer.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Specification Page, Its Document View, and the Touch Recogniser
    // ------------------------------------------------------------
    import { Na__LeSpecEd__Show, Na__LeSpecEd__Hide, Na__LeSpecEd__SetView, Na__LeSpecEd__IsShown } from '../50__Feature__Specification/Na__LayoutEditor__SpecEditor__.js';
    import { Na__LeSpecEd__VIEW_READ } from '../50__Feature__Specification/Na__LayoutEditor__SpecEditor__State__.js';
    import { Na__LeSpecDoc__Print } from '../50__Feature__Specification/Na__LayoutEditor__SpecDocument__.js';
    import { Na__LeSpec__EnsureLoaded } from '../50__Feature__Specification/Na__LayoutEditor__SpecData__.js';
    import { Na__LeVwTouch__Attach, Na__LeVwTouch__Detach } from './Na__LayoutEditor__WebViewer__TouchControls__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Class That Strips the Authoring Chrome, and the Page Selectors
    // ------------------------------------------------------------
    const Na__LeVwSpec__VIEWER_CLASS = 'na-le-spec--viewer';
    const Na__LeVwSpec__ROOT_SEL     = '.na-le-spec';
    const Na__LeVwSpec__READER_SEL   = '.na-le-spec__reader';
    const Na__LeVwSpec__PAGE_SEL     = '.na-le-spec-sheet';
    // ------------------------------------------------------------

    // MODULE VARIABLES | Whether the Document Is Showing, and What It Is Bound To
    // ------------------------------------------------------------
    let Na__LeVwSpec__Shown   = false;
    let Na__LeVwSpec__Reader  = null;
    let Na__LeVwSpec__OnSwipe = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Elements
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Specification Page and Its Scroller
    // ------------------------------------------------------------
    // Found rather than held, because the specification page builds itself once
    // on the first entry into the editor, which may be after this module has
    // been asked its first question.
    // ------------------------------------------------------------
    function Na__LeVwSpec__Root()   { return document.querySelector(Na__LeVwSpec__ROOT_SEL); }
    function Na__LeVwSpec__Scroller() {
        const root = Na__LeVwSpec__Root();
        return root ? root.querySelector(Na__LeVwSpec__READER_SEL) : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Gesture Handlers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Report the Travel the Pages Used, Without Taking It Over
    // ------------------------------------------------------------
    // The vertical is reported as fully spent although this module never moved
    // it: the browser is scrolling the pages natively underneath, and claiming
    // it here is what keeps that true. The horizontal is reported as unspent,
    // because A4 pages fitted to the width of the scroller have nowhere
    // sideways to go - and that is exactly the travel a page turn is made of.
    // ------------------------------------------------------------
    function Na__LeVwSpec__OnPan(dx, dy) {
        return { x : 0, y : dy };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Show the Specification as Its Printed Pages
    // ------------------------------------------------------------
    // options: { onSwipe(direction) }
    // ------------------------------------------------------------
    function Na__LeVwSpec__Show(options) {
        void Na__LeSpec__EnsureLoaded();                                         // <-- Read on the first visit; a second one costs nothing
        Na__LeVwSpec__OnSwipe = (options && typeof options.onSwipe === 'function') ? options.onSwipe : null;

        const root = Na__LeVwSpec__Root();
        if (root) root.classList.add(Na__LeVwSpec__VIEWER_CLASS);                // <-- Before the show, so the bar is never seen with its editing controls on
        Na__LeSpecEd__SetView(Na__LeSpecEd__VIEW_READ);                          // <-- Set on every show: a remembered Edit view from an unlocked session never survives
        Na__LeSpecEd__Show({});
        Na__LeVwSpec__Shown = true;

        const reader = Na__LeVwSpec__Scroller();
        if (reader) {
            Na__LeVwSpec__Reader = reader;
            Na__LeVwTouch__Attach(reader, {
                onPan   : Na__LeVwSpec__OnPan,
                onSwipe : (direction) => { if (Na__LeVwSpec__OnSwipe) Na__LeVwSpec__OnSwipe(direction); }
            }, { swallow : false });                                             // <-- The pages keep their own momentum scrolling
        }
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put the Specification Away
    // ------------------------------------------------------------
    function Na__LeVwSpec__Hide() {
        if (!Na__LeVwSpec__Shown) return false;
        Na__LeVwTouch__Detach();
        Na__LeSpecEd__Hide();
        Na__LeVwSpec__Shown   = false;
        Na__LeVwSpec__Reader  = null;
        Na__LeVwSpec__OnSwipe = null;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | How Many Pages the Document Came To
    // ------------------------------------------------------------
    function Na__LeVwSpec__PageCount() {
        const reader = Na__LeVwSpec__Scroller();
        return reader ? reader.querySelectorAll(Na__LeVwSpec__PAGE_SEL).length : 0;
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Page Is Being Read (1-based, 0 when there are none)
    // ------------------------------------------------------------
    // The page whose top is nearest the top of the scroller, which is what a
    // reader would call "the page I am on" however much of the next one has
    // crept into view underneath it.
    // ------------------------------------------------------------
    function Na__LeVwSpec__CurrentPage() {
        const reader = Na__LeVwSpec__Scroller();
        if (!reader) return 0;
        const pages = reader.querySelectorAll(Na__LeVwSpec__PAGE_SEL);
        if (!pages.length) return 0;
        const top = reader.getBoundingClientRect().top;
        let best = 0;
        let bestGap = Infinity;
        pages.forEach((page, index) => {
            const gap = Math.abs(page.getBoundingClientRect().top - top);
            if (gap < bestGap) { bestGap = gap; best = index; }
        });
        return best + 1;
    }
    // ------------------------------------------------------------


    // FUNCTION | Move One Page Up or Down the Document
    // ------------------------------------------------------------
    // Answers false when there is no page that way, so the dock can hand the
    // gesture on to the documents either side instead of stopping dead.
    // ------------------------------------------------------------
    function Na__LeVwSpec__StepPage(delta) {
        const reader = Na__LeVwSpec__Scroller();
        if (!reader) return false;
        const pages = reader.querySelectorAll(Na__LeVwSpec__PAGE_SEL);
        if (!pages.length) return false;
        const next = Na__LeVwSpec__CurrentPage() - 1 + (delta > 0 ? 1 : -1);
        if (next < 0 || next >= pages.length) return false;
        const target = pages[next];
        reader.scrollTop += target.getBoundingClientRect().top - reader.getBoundingClientRect().top;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Print the Document (the print dialog also saves a PDF)
    // ------------------------------------------------------------
    function Na__LeVwSpec__Print() { Na__LeSpecDoc__Print(); return true; }
    // ------------------------------------------------------------


    // FUNCTION | Is the Document on Screen
    // ------------------------------------------------------------
    function Na__LeVwSpec__IsShown() { return Na__LeVwSpec__Shown && Na__LeSpecEd__IsShown(); }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Web Viewer Specification API
    // ------------------------------------------------------------
    export {
        Na__LeVwSpec__Show,
        Na__LeVwSpec__Hide,
        Na__LeVwSpec__PageCount,
        Na__LeVwSpec__CurrentPage,
        Na__LeVwSpec__StepPage,
        Na__LeVwSpec__Print,
        Na__LeVwSpec__IsShown
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
