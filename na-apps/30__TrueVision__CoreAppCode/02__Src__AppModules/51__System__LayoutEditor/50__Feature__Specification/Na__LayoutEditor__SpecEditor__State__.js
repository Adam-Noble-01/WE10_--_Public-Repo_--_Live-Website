// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SPECIFICATION EDITOR - STATE
// =============================================================================
//
// FILE       : Na__LayoutEditor__SpecEditor__State__.js
// NAMESPACE  : Na__LeSpecEd
// MODULE     : Layout Editor - Specification Editor - State
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The Specification Editor's constants and module variables, shared by the editor and its units
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - The constants (storage keys, the two views, the grip and the drag) and the
//   module variables (the page's elements, the session, the view and what is
//   waiting) that Na__LayoutEditor__SpecEditor__ and its units share.
// - A unit reads a variable through its import, which always holds the
//   current value. Only this module can assign one, so a unit that changes a
//   variable calls its accessor here: Na__LeSpecEd__AssignView(next) stands
//   where the code read Na__LeSpecEd__View = next before the split.
//
// INTEGRATION:
// - Imported by Na__LayoutEditor__SpecEditor__ and by each of its units. It
//   imports nothing, so it is the foot of the editor's import graph.
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
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Storage, the Views, the Grip and the Drag
    // ------------------------------------------------------------
    const Na__LeSpecEd__COMPACT_KEY   = 'na-layouteditor-spec:headings-only';
    const Na__LeSpecEd__VIEW_KEY      = 'na-layouteditor-spec:view';
    const Na__LeSpecEd__VIEW_EDIT     = 'edit';
    const Na__LeSpecEd__VIEW_READ     = 'read';
    const Na__LeSpecEd__DRAG_START_PX = 4;
    const Na__LeSpecEd__AUTOSCROLL_PX = 40;
    const Na__LeSpecEd__GRIP_SVG      = '<svg viewBox="0 0 8 13" aria-hidden="true"><circle cx="2" cy="2" r="1.3"/><circle cx="6" cy="2" r="1.3"/><circle cx="2" cy="6.5" r="1.3"/><circle cx="6" cy="6.5" r="1.3"/><circle cx="2" cy="11" r="1.3"/><circle cx="6" cy="11" r="1.3"/></svg>';
    // ------------------------------------------------------------

    // MODULE VARIABLES | Elements, Session and What Is Waiting
    // ------------------------------------------------------------
    let Na__LeSpecEd__Root      = null;
    let Na__LeSpecEd__Bar       = null;
    let Na__LeSpecEd__Alerts    = null;
    let Na__LeSpecEd__Scroll    = null;
    let Na__LeSpecEd__Page      = null;
    let Na__LeSpecEd__Filter    = null;
    let Na__LeSpecEd__Editable  = false;
    let Na__LeSpecEd__ShowToast = null;
    let Na__LeSpecEd__Shown     = false;
    let Na__LeSpecEd__Frame     = 0;
    let Na__LeSpecEd__Usage     = null;    // <-- The last usage worked out, for the bar and the delete questions
    let Na__LeSpecEd__Drag      = null;    // <-- { noteId, groupId, list, rows, slots, from, to, startY, pointerId, moved, pending }
    let Na__LeSpecEd__PrefixError = null;  // <-- { groupId, message } shown beside the group whose prefix was refused
    let Na__LeSpecEd__FocusAfter  = null;  // <-- { selector } to focus once the next render lands (a new note's title, a new group's prefix)
    let Na__LeSpecEd__Reader      = null;  // <-- Read's scroller, and the desk its pages lie on
    let Na__LeSpecEd__Desk        = null;
    let Na__LeSpecEd__View        = 'edit';
    let Na__LeSpecEd__Pages       = 0;     // <-- Pages Read last laid out
    let Na__LeSpecEd__ScrollBack  = { edit : null, read : null };   // <-- Where each view was scrolled to when it was last put away
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Assigning the Module Variables
// -----------------------------------------------------------------------------

    // FUNCTION | Assign a Module Variable From Another Unit
    // ------------------------------------------------------------
    // An import reads a module variable as it is at that moment, but only the
    // module that declares a variable can assign it. Each accessor stands for
    // an assignment another unit made before the split, and does nothing more.
    // ------------------------------------------------------------
    function Na__LeSpecEd__AssignRoot(value)        { Na__LeSpecEd__Root        = value; }
    function Na__LeSpecEd__AssignBar(value)         { Na__LeSpecEd__Bar         = value; }
    function Na__LeSpecEd__AssignAlerts(value)      { Na__LeSpecEd__Alerts      = value; }
    function Na__LeSpecEd__AssignScroll(value)      { Na__LeSpecEd__Scroll      = value; }
    function Na__LeSpecEd__AssignPage(value)        { Na__LeSpecEd__Page        = value; }
    function Na__LeSpecEd__AssignFilter(value)      { Na__LeSpecEd__Filter      = value; }
    function Na__LeSpecEd__AssignEditable(value)    { Na__LeSpecEd__Editable    = value; }
    function Na__LeSpecEd__AssignShowToast(value)   { Na__LeSpecEd__ShowToast   = value; }
    function Na__LeSpecEd__AssignShown(value)       { Na__LeSpecEd__Shown       = value; }
    function Na__LeSpecEd__AssignFrame(value)       { Na__LeSpecEd__Frame       = value; }
    function Na__LeSpecEd__AssignUsage(value)       { Na__LeSpecEd__Usage       = value; }
    function Na__LeSpecEd__AssignDrag(value)        { Na__LeSpecEd__Drag        = value; }
    function Na__LeSpecEd__AssignPrefixError(value) { Na__LeSpecEd__PrefixError = value; }
    function Na__LeSpecEd__AssignFocusAfter(value)  { Na__LeSpecEd__FocusAfter  = value; }
    function Na__LeSpecEd__AssignReader(value)      { Na__LeSpecEd__Reader      = value; }
    function Na__LeSpecEd__AssignDesk(value)        { Na__LeSpecEd__Desk        = value; }
    function Na__LeSpecEd__AssignView(value)        { Na__LeSpecEd__View        = value; }
    function Na__LeSpecEd__AssignPages(value)       { Na__LeSpecEd__Pages       = value; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Specification Editor State
    // ------------------------------------------------------------
    export {
        Na__LeSpecEd__COMPACT_KEY,
        Na__LeSpecEd__VIEW_KEY,
        Na__LeSpecEd__VIEW_EDIT,
        Na__LeSpecEd__VIEW_READ,
        Na__LeSpecEd__DRAG_START_PX,
        Na__LeSpecEd__AUTOSCROLL_PX,
        Na__LeSpecEd__GRIP_SVG,
        Na__LeSpecEd__Root,
        Na__LeSpecEd__Bar,
        Na__LeSpecEd__Alerts,
        Na__LeSpecEd__Scroll,
        Na__LeSpecEd__Page,
        Na__LeSpecEd__Filter,
        Na__LeSpecEd__Editable,
        Na__LeSpecEd__ShowToast,
        Na__LeSpecEd__Shown,
        Na__LeSpecEd__Frame,
        Na__LeSpecEd__Usage,
        Na__LeSpecEd__Drag,
        Na__LeSpecEd__PrefixError,
        Na__LeSpecEd__FocusAfter,
        Na__LeSpecEd__Reader,
        Na__LeSpecEd__Desk,
        Na__LeSpecEd__View,
        Na__LeSpecEd__Pages,
        Na__LeSpecEd__ScrollBack,
        Na__LeSpecEd__AssignRoot,
        Na__LeSpecEd__AssignBar,
        Na__LeSpecEd__AssignAlerts,
        Na__LeSpecEd__AssignScroll,
        Na__LeSpecEd__AssignPage,
        Na__LeSpecEd__AssignFilter,
        Na__LeSpecEd__AssignEditable,
        Na__LeSpecEd__AssignShowToast,
        Na__LeSpecEd__AssignShown,
        Na__LeSpecEd__AssignFrame,
        Na__LeSpecEd__AssignUsage,
        Na__LeSpecEd__AssignDrag,
        Na__LeSpecEd__AssignPrefixError,
        Na__LeSpecEd__AssignFocusAfter,
        Na__LeSpecEd__AssignReader,
        Na__LeSpecEd__AssignDesk,
        Na__LeSpecEd__AssignView,
        Na__LeSpecEd__AssignPages
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
