// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - WEB VIEWER
// =============================================================================
//
// FILE       : Na__LayoutEditor__WebViewer__.js
// NAMESPACE  : Na__LeVw
// MODULE     : Layout Editor - Web Viewer
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Turn the Layout Editor into a document viewer wherever it cannot author, and cycle the project's documents
// CREATED    : 18-Sep-2026
//
// DESCRIPTION:
// - WHERE THIS APPLIES. Authoring is on where the Dev gate says so - localhost,
//   or an explicitly unlocked device - and off everywhere else. That one answer
//   already decides everything: localhost in a browser and localhost installed
//   as a PWA are both the full editor, and the live site in a browser and the
//   live site installed as a PWA are both this viewer. The display mode is
//   never asked, because it was never the question.
// - WHY A VIEWER RATHER THAN A DISABLED EDITOR. The read-only editor was the
//   whole editor with its buttons greyed: two panel columns of authoring
//   settings, a toolbar of drawing tools, and a tab strip of small tabs. On a
//   desktop that is merely wasteful. On a phone held in portrait - which is how
//   a client actually opens the link you send them - the 550px of panel columns
//   leave the drawing a sliver, and every control on screen is one they must
//   work out is not for them. What a reader needs is the document, big, and a
//   way to get to the next one.
// - WHICH DOCUMENT IS THE TAB STRIP'S JOB, not this module's. The strip is the
//   same one the editor has - every sheet, then the specification - scrolling
//   sideways with an arrow at each end when they do not all fit. This module
//   owns the same ordered list underneath it, for the dock's arrows, the arrow
//   keys and a flick of the thumb, all of which land on the same documents in
//   the same order.
// - WHAT IT SHOWS is a dock at the bottom of the screen: which document of how
//   many, an arrow each side of it, and the controls for however the showing
//   document is being looked at - Fit, zoom and PDF for a drawing, the page
//   keys for the specification.
// - WHAT IS NOT SHOWN AT ALL. The panel columns, the drawing toolbar, the
//   measurements box and the specification's authoring bar. Not disabled: not
//   built. The two view modules own the reading surfaces (Drawings, Spec) and
//   this module owns the dock and which surface is on.
//
// INTEGRATION:
// - Na__LayoutEditor__ModeController__ initialises this, builds it instead of
//   the panels and toolbar, and routes entering a sheet or the specification
//   through Show.
// - Navigation is handed in as callbacks, so this module never imports the mode
//   controller and the pair cannot form an import cycle.
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
// 18-Sep-2026 - Version 1.1.0
// - The document bar and the document list are gone (Adam: "the tab system is
//   too different, use regular tabs"). The tab strip does both jobs again - it
//   names the open document and reaches every other one - so what is left here
//   is the dock, which the strip cannot replace: it is at the bottom of the
//   screen, where the thumb holding a phone actually is.
//
// 18-Sep-2026 - Version 1.0.0
// - Initial implementation for the public web viewer.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Sheet Model, PDF, and the Two Reading Surfaces
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel, Na__LeCfg__GetWebViewerSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__GetSheets, Na__LeModel__GetActiveSheet, Na__LeModel__IsSitePlanSheet } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LePdf__ExportSheet } from '../60__Feature__PdfExport/Na__LayoutEditor__PdfExporter__.js';
    import {
        Na__LeVwDraw__Attach,
        Na__LeVwDraw__Detach,
        Na__LeVwDraw__Fit,
        Na__LeVwDraw__ZoomBy
    } from './Na__LayoutEditor__WebViewer__Drawings__.js';
    import {
        Na__LeVwSpec__Show,
        Na__LeVwSpec__Hide,
        Na__LeVwSpec__StepPage
    } from './Na__LayoutEditor__WebViewer__Spec__.js';
    import { Na__LeVwTouch__IsTouchDevice } from './Na__LayoutEditor__WebViewer__TouchControls__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Ids, Classes and the Specification's Place in the List
    // ------------------------------------------------------------
    const Na__LeVw__BODY_CLASS = 'na-le-viewer--active';                         // <-- On the body: the stylesheet collapses the editor shell behind it
    const Na__LeVw__SPEC_ID    = '__specification__';                            // <-- The specification's id in the document list; no sheet can hold it
    const Na__LeVw__ZOOM_STEP  = 1.35;
    // ------------------------------------------------------------

    // MODULE VARIABLES | Gate, Chrome and What Is Showing
    // ------------------------------------------------------------
    let Na__LeVw__Editable  = true;                                              // <-- Handed in by the mode controller, so the gate has one source
    let Na__LeVw__ShowToast = null;
    let Na__LeVw__Host      = null;
    let Na__LeVw__Dock      = null;
    let Na__LeVw__Nav       = null;                                              // <-- { enter, openSpec } from the mode controller
    let Na__LeVw__Current   = null;                                              // <-- The showing document's id, or the specification's
    let Na__LeVw__Busy      = false;                                             // <-- A PDF is being written
    let Na__LeVw__Keys      = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Gate
// -----------------------------------------------------------------------------

    // FUNCTION | Is This Session a Viewer Rather Than an Editor
    // ------------------------------------------------------------
    // Exactly "cannot author, and the viewer is switched on". The editable flag
    // is the mode controller's own, handed in at initialisation, so there is no
    // second reading of the Dev gate here to drift away from it.
    // ------------------------------------------------------------
    function Na__LeVw__IsViewerMode() {
        if (Na__LeVw__Editable) return false;
        return Na__LeCfg__GetWebViewerSetup().enabled;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Document List
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Every Document, in the Order the Tab Strip Would Show Them
    // ------------------------------------------------------------
    // Architectural sheets, then site plans, then the specification. The same
    // order the tab strip uses, so anyone who has seen the editor finds the
    // documents where they left them.
    // ------------------------------------------------------------
    function Na__LeVw__Documents() {
        const sheets = Na__LeModel__GetSheets();
        const drawings = sheets.filter((sheet) => !Na__LeModel__IsSitePlanSheet(sheet));
        const sitePlans = sheets.filter((sheet) => Na__LeModel__IsSitePlanSheet(sheet));
        const list = [];
        drawings.forEach((sheet) => list.push({ id : sheet.Sheet__Id, name : sheet.Sheet__Name, kind : 'drawing', sheet : sheet }));
        sitePlans.forEach((sheet) => list.push({ id : sheet.Sheet__Id, name : sheet.Sheet__Name, kind : 'siteplan', sheet : sheet }));
        if (Na__LeCfg__GetWebViewerSetup().showSpecification) {
            list.push({ id : Na__LeVw__SPEC_ID, name : Na__LeCfg__GetLabel('SpecificationTab', 'Project Specification'), kind : 'spec', sheet : null });
        }
        return list;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where in the List the Showing Document Sits (-1 when none)
    // ------------------------------------------------------------
    function Na__LeVw__IndexOf(documents, id) {
        for (let i = 0; i < documents.length; i += 1) { if (documents[i].id === id) return i; }
        return -1;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Open a Document by Its Place in the List
    // ------------------------------------------------------------
    function Na__LeVw__Open(entry) {
        if (!entry || !Na__LeVw__Nav) return false;
        if (entry.kind === 'spec') return !!Na__LeVw__Nav.openSpec();
        return !!Na__LeVw__Nav.enter(entry.id);
    }
    // ------------------------------------------------------------


    // FUNCTION | Step to the Next or Previous Document
    // ------------------------------------------------------------
    // Stops at the ends rather than wrapping: a reader who has reached the last
    // drawing and flicks again should feel the end of the set, not find
    // themselves back at the first without having asked.
    // ------------------------------------------------------------
    function Na__LeVw__Step(direction) {
        const documents = Na__LeVw__Documents();
        if (!documents.length) return false;
        const at   = Na__LeVw__IndexOf(documents, Na__LeVw__Current);
        const next = (at === -1) ? 0 : at + (direction === 'previous' ? -1 : 1);
        if (next < 0 || next >= documents.length) return false;
        return Na__LeVw__Open(documents[next]);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Chrome Builders
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | An Element With a Class and Optional Text
    // ------------------------------------------------------------
    function Na__LeVw__El(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined && text !== null) el.textContent = text;
        return el;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Button, Sized for a Thumb
    // ------------------------------------------------------------
    // Every control here carries data-na-viewer rather than its own listener,
    // so the chrome is rebuilt freely and one delegated click handler on the
    // host keeps answering.
    // ------------------------------------------------------------
    function Na__LeVw__Button(text, action, title, modifier) {
        const button = Na__LeVw__El('button', 'na-le-viewer__btn' + (modifier ? ' ' + modifier : ''), text);
        button.type = 'button';
        button.setAttribute('data-na-viewer', action);
        if (title) { button.title = title; button.setAttribute('aria-label', title); }
        return button;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Bottom Dock: Previous, the Document's Own Actions, Next
    // ------------------------------------------------------------
    // At the BOTTOM on purpose. A phone is held low in one hand and the top of
    // a six-inch screen is not reachable with the thumb that is holding it, so
    // the controls a reader uses on every document live where the thumb is.
    // ------------------------------------------------------------
    function Na__LeVw__BuildDock() {
        const dock = Na__LeVw__El('div', 'na-le-viewer__dock');
        const step = Na__LeVw__El('div', 'na-le-viewer__step');
        step.appendChild(Na__LeVw__Button('‹', 'previous', Na__LeCfg__GetLabel('ViewerPrevious', 'Previous document'), 'na-le-viewer__btn--step'));
        step.appendChild(Na__LeVw__El('span', 'na-le-viewer__count', ''));
        dock.appendChild(step);
        dock.appendChild(Na__LeVw__El('div', 'na-le-viewer__actions'));
        dock.appendChild(Na__LeVw__Button('›', 'next', Na__LeCfg__GetLabel('ViewerNext', 'Next document'), 'na-le-viewer__btn--step'));
        return dock;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Actions for Whatever Is Showing
    // ------------------------------------------------------------
    // A drawing is a picture: fit it, zoom it, take it away as a PDF. The
    // specification is a document: it keeps Download and Print on its own bar
    // where they already are, so the dock gives it page keys and nothing else.
    // ------------------------------------------------------------
    function Na__LeVw__FillActions() {
        if (!Na__LeVw__Dock) return;
        const actions = Na__LeVw__Dock.querySelector('.na-le-viewer__actions');
        if (!actions) return;
        actions.innerHTML = '';
        if (Na__LeVw__Current === Na__LeVw__SPEC_ID) {
            actions.appendChild(Na__LeVw__Button(Na__LeCfg__GetLabel('ViewerPageUp', 'Page up'), 'page-up', Na__LeCfg__GetLabel('ViewerPageUpTitle', 'The page before this one')));
            actions.appendChild(Na__LeVw__Button(Na__LeCfg__GetLabel('ViewerPageDown', 'Page down'), 'page-down', Na__LeCfg__GetLabel('ViewerPageDownTitle', 'The page after this one')));
            return;
        }
        actions.appendChild(Na__LeVw__Button(Na__LeCfg__GetLabel('ZoomFit', 'Fit'), 'fit', Na__LeCfg__GetLabel('ViewerFitTitle', 'Show the whole sheet')));
        actions.appendChild(Na__LeVw__Button('−', 'zoom-out', Na__LeCfg__GetLabel('ViewerZoomOutTitle', 'Zoom out')));
        actions.appendChild(Na__LeVw__Button('+', 'zoom-in', Na__LeCfg__GetLabel('ViewerZoomInTitle', 'Zoom in')));
        actions.appendChild(Na__LeVw__Button(Na__LeCfg__GetLabel('ViewerPdf', 'PDF'), 'pdf', Na__LeCfg__GetLabel('ViewerPdfTitle', 'Download this sheet as a PDF at paper size')));
    }
    // ------------------------------------------------------------


// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Actions
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Write the Showing Sheet Out as a PDF
    // ------------------------------------------------------------
    async function Na__LeVw__Pdf() {
        const sheet = Na__LeModel__GetActiveSheet();
        if (Na__LeVw__Busy || !sheet) return;
        Na__LeVw__Busy = true;
        Na__LeVw__Sync();
        try { await Na__LePdf__ExportSheet(sheet, Na__LeVw__ShowToast); }
        finally { Na__LeVw__Busy = false; Na__LeVw__Sync(); }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Delegated Click Handler for the Whole Chrome
    // ------------------------------------------------------------
    function Na__LeVw__OnClick(event) {
        const target = event.target && event.target.closest ? event.target.closest('[data-na-viewer]') : null;
        if (!target) return;
        const action = target.getAttribute('data-na-viewer');
        switch (action) {
            case 'previous'   : Na__LeVw__Step('previous');                                           break;
            case 'next'       : Na__LeVw__Step('next');                                               break;
            case 'fit'        : Na__LeVwDraw__Fit();                                                  break;
            case 'zoom-in'    : Na__LeVwDraw__ZoomBy(Na__LeVw__ZOOM_STEP);                            break;
            case 'zoom-out'   : Na__LeVwDraw__ZoomBy(1 / Na__LeVw__ZOOM_STEP);                        break;
            case 'pdf'        : void Na__LeVw__Pdf();                                                 break;
            case 'page-up'    : Na__LeVwSpec__StepPage(-1);                                           break;
            case 'page-down'  : Na__LeVwSpec__StepPage(1);                                            break;
            default           : break;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Keys, for a Reader at a Desk
    // ------------------------------------------------------------
    // The left and right arrows cycle documents, because that is the one thing
    // the dock's arrows do and a keyboard reader expects the same. Up, down and
    // the wheel are left alone: they scroll the specification and pan the
    // drawing through the PC controls, which are already attached.
    // ------------------------------------------------------------
    function Na__LeVw__OnKeyDown(event) {
        if (!Na__LeVw__Host || Na__LeVw__Host.hidden) return;
        const active = document.activeElement;
        if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return;
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.key === 'ArrowLeft')  { if (Na__LeVw__Step('previous')) event.preventDefault(); return; }
        if (event.key === 'ArrowRight') { if (Na__LeVw__Step('next'))     event.preventDefault(); return; }
        if (event.key === 'PageUp'   && Na__LeVw__Current === Na__LeVw__SPEC_ID) { if (Na__LeVwSpec__StepPage(-1)) event.preventDefault(); return; }
        if (event.key === 'PageDown' && Na__LeVw__Current === Na__LeVw__SPEC_ID) { if (Na__LeVwSpec__StepPage(1))  event.preventDefault(); return; }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Record Whether This Session Can Author
    // ------------------------------------------------------------
    // options: { editable, showToast }
    // ------------------------------------------------------------
    function Na__LeVw__Initialize(options) {
        Na__LeVw__Editable  = !!(options && options.editable);
        Na__LeVw__ShowToast = (options && options.showToast) || null;
        return Na__LeVw__IsViewerMode();
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Viewer Chrome Into the Editor Host (once)
    // ------------------------------------------------------------
    // nav: { enter(sheetId), openSpec() } from the mode controller.
    // ------------------------------------------------------------
    function Na__LeVw__Build(host, nav) {
        if (!host || Na__LeVw__Host) return false;
        Na__LeVw__Host = host;
        Na__LeVw__Nav  = nav || null;
        host.classList.add('na-le-host--viewer');
        if (Na__LeVwTouch__IsTouchDevice()) host.classList.add('na-le-host--touch');

        Na__LeVw__Dock = Na__LeVw__BuildDock();

        // THE DOCK IS THE HOST'S, NOT THE SHELL'S. It sits OVER both reading
        // surfaces - the sheet stage and the specification page, which lies
        // across the whole host at inset 0 - so the document being read never
        // covers it. The stylesheet insets both surfaces above it in return.
        host.appendChild(Na__LeVw__Dock);

        host.addEventListener('click', Na__LeVw__OnClick);
        Na__LeVw__Keys = Na__LeVw__OnKeyDown;
        window.addEventListener('keydown', Na__LeVw__Keys);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Show a Drawing Sheet
    // ------------------------------------------------------------
    // options: { fit } - false when the reader is coming BACK to the sheet they
    // left, which keeps its zoom and scroll on purpose.
    //
    // A new document is fitted here rather than left to the mode controller's
    // own deferred fit, which waits a frame for a stage that already has a size
    // on every change but the first. Doing it here means the sheet is whole the
    // instant it appears, and a reader flicking quickly through a set never
    // sees a corner of the next drawing at the last one's zoom.
    // ------------------------------------------------------------
    function Na__LeVw__ShowDrawing(sheet, options) {
        Na__LeVwSpec__Hide();                                                    // <-- The specification lets its gestures go before the stage takes them
        Na__LeVw__Current = sheet ? sheet.Sheet__Id : null;
        Na__LeVwDraw__Attach();                                                  // <-- A drawing keeps the finger for panning; the tabs and the dock change document
        if (!options || options.fit !== false) Na__LeVwDraw__Fit();
        Na__LeVw__Sync();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Show the Project Specification
    // ------------------------------------------------------------
    function Na__LeVw__ShowSpecification() {
        Na__LeVwDraw__Detach();                                                  // <-- One surface owns the touch recogniser at a time
        Na__LeVw__Current = Na__LeVw__SPEC_ID;
        Na__LeVwSpec__Show({ onSwipe : Na__LeVw__Step });
        Na__LeVw__Sync();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put Every Reading Surface Away (leaving for the 3D model)
    // ------------------------------------------------------------
    function Na__LeVw__Teardown() {
        Na__LeVwSpec__Hide();
        Na__LeVwDraw__Detach();
        Na__LeVw__Current = null;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Bring the Dock Up to Date With What Is Showing
    // ------------------------------------------------------------
    // The dock's own count says which document of how many, because the tab
    // strip that names it is at the top of the screen and the dock is at the
    // bottom: on a phone a reader's thumb and a reader's eyes are not in the
    // same place, and "4 / 11" beside the arrows is what tells them there is
    // more to come without looking up.
    // ------------------------------------------------------------
    function Na__LeVw__Sync() {
        if (!Na__LeVw__Dock) return false;
        const documents = Na__LeVw__Documents();
        const at = Na__LeVw__IndexOf(documents, Na__LeVw__Current);

        Na__LeVw__FillActions();
        const previous = Na__LeVw__Dock.querySelector('[data-na-viewer="previous"]');
        const next     = Na__LeVw__Dock.querySelector('[data-na-viewer="next"]');
        const count    = Na__LeVw__Dock.querySelector('.na-le-viewer__count');
        if (previous) previous.disabled = (at <= 0);
        if (next)     next.disabled     = (at === -1 || at >= documents.length - 1);
        if (count)    count.textContent = (at === -1) ? '' : Na__LeCfg__FormatLabel('ViewerCount', '{index} / {total}', { index : at + 1, total : documents.length });
        const pdf = Na__LeVw__Dock.querySelector('[data-na-viewer="pdf"]');
        if (pdf) pdf.disabled = Na__LeVw__Busy;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Turn the Body Class On and Off With the Editor Host
    // ------------------------------------------------------------
    function Na__LeVw__SetActive(active) {
        document.body.classList.toggle(Na__LeVw__BODY_CLASS, !!active && Na__LeVw__IsViewerMode());
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Document Is Showing
    // ------------------------------------------------------------
    function Na__LeVw__GetCurrentId() { return Na__LeVw__Current; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Web Viewer API
    // ------------------------------------------------------------
    export {
        Na__LeVw__SPEC_ID,
        Na__LeVw__Initialize,
        Na__LeVw__IsViewerMode,
        Na__LeVw__Build,
        Na__LeVw__ShowDrawing,
        Na__LeVw__ShowSpecification,
        Na__LeVw__Teardown,
        Na__LeVw__Sync,
        Na__LeVw__SetActive,
        Na__LeVw__Step,
        Na__LeVw__GetCurrentId
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
