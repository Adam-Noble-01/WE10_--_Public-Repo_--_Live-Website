// =============================================================================
// TRUEVISION3D - DRAWING VIEW CORE - DEV MENU ROW ACCORDION
// =============================================================================
//
// FILE       : Na__DrawView__RowAccordion__.js
// NAMESPACE  : Na__DrawFold
// MODULE     : Drawing View Core - Dev Menu Row Accordion
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Fold every drawing row down to its name, and keep one unfolded
// CREATED    : 10-Sep-2026
//
// DESCRIPTION:
// - A floor plan row and an elevation row each carry a dozen controls: a name,
//   a datum or a bearing, a drawing type, two plane sliders, a depth, the
//   styles, the exclusions, the scene link and four buttons. Two drawings fit
//   on screen. Six do not, and the panel becomes a column of near-identical
//   controls with nothing to say which drawing any one of them belongs to.
//
// - THAT IS NOT A TIDINESS PROBLEM, IT IS A CORRECTNESS ONE. The row you are
//   scrolled to and the drawing you are previewing are different things, and
//   once they drift apart a slider drag edits the wrong drawing silently: the
//   viewport does not change, because the drawing on screen is not the one
//   being edited, so nothing tells you until the sheet comes out wrong.
//
// - So a row folds down to its name, and EXACTLY ONE is unfolded across both
//   panels at a time. Opening one closes whichever was open, including one in
//   the other panel, because only one drawing can be previewed at a time and
//   the open row is meant to be that drawing. Everything else is out of reach
//   until you deliberately open it.
//
// INTEGRATION:
// - Na__FloorPlan__DevMenu__Editor__ and Na__Elevation__DevMenu__Editor__ wrap
//   each row card as they render it, and move the open slot when a drawing is
//   created, previewed or deleted.
// - The panels rebuild their rows from scratch on nearly every change, so the
//   open slot is held here as a drawing id rather than in the DOM, and stale
//   handles are pruned as they fall out of the document.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 42__System__DrawingViewCore/Na__DrawView__RowAccordion__.js 1.0.0
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment Phase B)
// - Parity        : verbatim
// - Divergences   : Console prefix and header only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - TrueVision3D v2.21.14
// - Initial implementation, after authoring a set with several elevations and
//   several plans made it too easy to edit the parameters of a drawing other
//   than the one on screen.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Class Names
    // ------------------------------------------------------------
    const Na__DrawFold__ROOT_CLASS  = 'na-draw-dev__fold';
    const Na__DrawFold__OPEN_CLASS  = 'na-draw-dev__fold--open';
    const Na__DrawFold__HEAD_CLASS  = 'na-draw-dev__fold-head';
    const Na__DrawFold__ARROW_CLASS = 'na-draw-dev__fold-arrow';
    const Na__DrawFold__NAME_CLASS  = 'na-draw-dev__fold-name';
    const Na__DrawFold__BODY_CLASS  = 'na-draw-dev__fold-body';
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Header Glyph
    // ------------------------------------------------------------
    // The same small triangle the dropdown menu uses for its own sections,
    // turned on its side by CSS while the row is folded.
    // ------------------------------------------------------------
    const Na__DrawFold__ARROW_GLYPH = '▾';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The One Open Row, and Every Row Currently Mounted
    // ------------------------------------------------------------
    let Na__DrawFold__OpenId  = null;                                            // <-- Drawing id, or null for all folded
    let Na__DrawFold__Handles = [];                                              // <-- { id, root, head, body } per mounted row
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Handle Bookkeeping
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Drop Handles Whose Rows Have Left the Document
    // ------------------------------------------------------------
    // Both panels rebuild by emptying their container, so the handles from the
    // previous render are simply detached rather than unregistered. Checking
    // the DOM is cheaper and safer than asking the panels to tidy up.
    // ------------------------------------------------------------
    function Na__DrawFold__Prune() {
        Na__DrawFold__Handles = Na__DrawFold__Handles.filter(
            (handle) => handle.root && handle.root.isConnected
        );
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show or Fold One Row to Match the Open Slot
    // ------------------------------------------------------------
    // A row with no id cannot be keyed, so it is left open rather than folded
    // shut with no way to reach it again.
    // ------------------------------------------------------------
    function Na__DrawFold__ApplyOne(handle) {
        const isOpen = (handle.id === null) || (handle.id === Na__DrawFold__OpenId);
        handle.root.classList.toggle(Na__DrawFold__OPEN_CLASS, isOpen);
        handle.head.setAttribute('aria-expanded', String(isOpen));
        return isOpen;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Open Slot
// -----------------------------------------------------------------------------

    // FUNCTION | Read Which Drawing Is Currently Unfolded
    // ------------------------------------------------------------
    function Na__DrawFold__GetOpenId() {
        return Na__DrawFold__OpenId;
    }
    // ------------------------------------------------------------


    // FUNCTION | Ask Whether One Drawing Is the Unfolded One
    // ------------------------------------------------------------
    function Na__DrawFold__IsOpen(drawingId) {
        return (drawingId !== null && drawingId !== undefined && drawingId === Na__DrawFold__OpenId);
    }
    // ------------------------------------------------------------


    // FUNCTION | Move the Open Slot to One Drawing, or Fold Everything
    // ------------------------------------------------------------
    // Null folds the lot. Rows mounted by EITHER panel are updated, which is
    // what makes the rule reach across Floor Plans and Elevations together.
    // ------------------------------------------------------------
    function Na__DrawFold__SetOpenId(drawingId) {
        Na__DrawFold__OpenId = (drawingId === undefined) ? null : (drawingId || null);
        Na__DrawFold__Prune();

        let opened = null;
        for (let i = 0; i < Na__DrawFold__Handles.length; i++) {
            Na__DrawFold__ApplyOne(Na__DrawFold__Handles[i]);
            if (Na__DrawFold__IsOpen(Na__DrawFold__Handles[i].id)) {
                opened = Na__DrawFold__Handles[i];                               // <-- The row the slot actually names, not an unkeyed one
            }
        }

        // The rows above may have just collapsed, so the row that opened can
        // sit anywhere in the panel's scroll. Nearest keeps the panel still
        // when the header is already in view.
        if (opened && typeof opened.head.scrollIntoView === 'function') {
            opened.head.scrollIntoView({ block: 'nearest' });
        }
        return Na__DrawFold__OpenId;
    }
    // ------------------------------------------------------------


    // FUNCTION | Fold Everything If This Drawing Was the Open One
    // ------------------------------------------------------------
    // Called as a drawing is deleted, so the slot never points at a record
    // that no longer exists.
    // ------------------------------------------------------------
    function Na__DrawFold__CloseIfOpen(drawingId) {
        if (!Na__DrawFold__IsOpen(drawingId)) return false;
        Na__DrawFold__SetOpenId(null);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Row Wrapping
// -----------------------------------------------------------------------------

    // FUNCTION | Fold a Built Row Card Behind a Named Header
    // ------------------------------------------------------------
    // card    : the row card the panel has just built, children and all
    // options : { id, title }
    //
    // The card's existing children move into a body element and the header
    // goes in above them, so the row builders stay unaware of any of this.
    // Anything the panel wants to add afterwards - the scene link row - must
    // go into the returned body, or it would sit outside the fold and stay
    // visible while the row is closed.
    //
    // Returns { root, head, body }.
    // ------------------------------------------------------------
    function Na__DrawFold__Wrap(card, options) {
        const settings = options || {};
        const id       = (settings.id === undefined) ? null : settings.id;

        const body = document.createElement('div');
        body.className = Na__DrawFold__BODY_CLASS;
        while (card.firstChild) body.appendChild(card.firstChild);               // <-- Everything already built moves inside the fold

        const arrow = document.createElement('span');
        arrow.className   = Na__DrawFold__ARROW_CLASS;
        arrow.textContent = Na__DrawFold__ARROW_GLYPH;
        arrow.setAttribute('aria-hidden', 'true');

        const name = document.createElement('span');
        name.className   = Na__DrawFold__NAME_CLASS;
        name.textContent = settings.title || 'Untitled';

        const head = document.createElement('button');
        head.type      = 'button';
        head.className = Na__DrawFold__HEAD_CLASS;
        head.title     = 'Open this drawing on its own. Only one drawing is open at a time.';
        head.appendChild(arrow);
        head.appendChild(name);

        card.classList.add(Na__DrawFold__ROOT_CLASS);
        card.appendChild(head);
        card.appendChild(body);

        const handle = { id: id, root: card, head: head, body: body };
        Na__DrawFold__Prune();
        Na__DrawFold__Handles.push(handle);
        Na__DrawFold__ApplyOne(handle);

        // A second click on the open row folds it, which is the only way to
        // leave the panel with nothing unfolded.
        head.addEventListener('click', () => {
            Na__DrawFold__SetOpenId(Na__DrawFold__IsOpen(id) ? null : id);
        });

        return handle;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Dev Menu Row Accordion API
    // ------------------------------------------------------------
    export {
        Na__DrawFold__Wrap,
        Na__DrawFold__GetOpenId,
        Na__DrawFold__IsOpen,
        Na__DrawFold__SetOpenId,
        Na__DrawFold__CloseIfOpen
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
