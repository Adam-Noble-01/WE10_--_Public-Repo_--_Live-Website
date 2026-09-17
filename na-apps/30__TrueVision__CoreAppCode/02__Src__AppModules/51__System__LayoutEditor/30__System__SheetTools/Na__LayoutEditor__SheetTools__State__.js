// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET TOOLS - STATE
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetTools__State__.js
// NAMESPACE  : Na__LeTools
// MODULE     : Layout Editor - Sheet Tools - State
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The tool names, events and constants, and the interaction state more than one sheet tools file writes
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - The tool names (TOOL_SELECT to TOOL_LEADER, and the TOOLS list), the
//   tool and defaults events, and the constants the pointer, the context
//   menu and the keys read: MENU_SLOP_PX, SHEET_CHORDS, NON_TEXT_INPUTS,
//   TYPED_MIN_MM and SAME_MM.
// - The attachment and interaction state that more than one sheet tools file
//   changes: the stage, the editable flag, the drag in flight, the
//   suppression flag, the last right press, the last pointer point, Shift and
//   the vertex a typed length has just moved, which another typed length may
//   still move again. Every file reads them as plain imports, which stay live.
// - WRITE ACCESSORS. An imported binding cannot be assigned, so a file that
//   changes one of these values calls its Write accessor instead. A writer
//   only assigns: no event, no cursor, no drag finished. That is what sets it
//   apart from the public SetTool and SetSuppressed.
// - Not here: the active tool, the vector tool that drew last and the
//   settings for new objects each have a single writer and live beside it in
//   Na__LayoutEditor__SheetTools__ToolState__; the listeners map lives in
//   Na__LayoutEditor__SheetTools__, the only file that touches it.
// - No imports and nothing run at the top level, so it is evaluated before
//   any other sheet tools file and is never part of an import cycle.
//
// INTEGRATION:
// - Imported by Na__LayoutEditor__SheetTools__ and by every other
//   Na__LayoutEditor__SheetTools__ unit; nothing outside the sheet tools
//   imports it. Na__LayoutEditor__SheetTools__ re-exports the tool names and
//   the two events under the same names.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the ValeVision3D v2.47.0 split of the same module (same unit, same functions)
// - Parity        : verbatim (moved code)
// - Divergences   : n/a
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 17-Sep-2026 - Version 1.2.0
// - TOOL_MOVE (the only tool that translates a whole object) and PICK_TOOLS, the
//   two that work on what is already on the sheet and so keep an open container.
// - SELECT IS THE RESTING STATE AND THERE IS NO OTHER. A tool-less state was
//   tried and taken out the same day: a press then did nothing, and the browser
//   took the click and offered its own copy and search menus over the sheet.
//
//
// 17-Sep-2026 - Version 1.1.0
// - VertexRetype: the vertex a typed length has just moved, kept so another
//   typed value moves it again. Written by the pointer drag unit and cleared
//   by CancelPlacement; it lives here because both write it.
//
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__SheetTools__.js; the code moved verbatim.
// - The Write accessors are the one addition: each stands in for an
//   assignment another sheet tools file made to this state before the split.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Tools and Events
    // ------------------------------------------------------------
    const Na__LeTools__TOOL_SELECT    = 'select';   // <-- The resting state, always: every other tool is picked up FROM here and Escape comes back to it
    const Na__LeTools__TOOL_MOVE      = 'move';     // <-- M: the only tool that translates whole items
    const Na__LeTools__TOOL_TEXT      = 'text';
    const Na__LeTools__TOOL_DIMENSION = 'dimension';
    const Na__LeTools__TOOL_DRAW      = 'draw';
    const Na__LeTools__TOOL_RECT      = 'rectangle';
    const Na__LeTools__TOOL_EYEDROP   = 'eyedropper';
    const Na__LeTools__TOOL_LEADER    = 'leader';
    const Na__LeTools__TOOLS          = [ Na__LeTools__TOOL_SELECT, Na__LeTools__TOOL_MOVE, Na__LeTools__TOOL_TEXT, Na__LeTools__TOOL_DIMENSION, Na__LeTools__TOOL_DRAW, Na__LeTools__TOOL_RECT, Na__LeTools__TOOL_EYEDROP, Na__LeTools__TOOL_LEADER ];
    const Na__LeTools__PICK_TOOLS     = [ Na__LeTools__TOOL_SELECT, Na__LeTools__TOOL_MOVE ];   // <-- The two that work on what is already on the sheet: they keep an open container, the rest close it
    const Na__LeTools__CHANGED_EVENT  = 'na-layouteditor-tool-changed';
    const Na__LeTools__DEFAULTS_EVENT = 'na-layouteditor-defaults-changed';   // <-- The settings for new objects changed from outside their panel (a palette sync)
    const Na__LeTools__MENU_SLOP_PX   = 4;      // <-- A right button that travelled further than this panned, so no menu
    const Na__LeTools__SHEET_CHORDS   = [ 'Edit__Undo', 'Edit__Redo', 'Edit__Copy', 'Edit__Paste', 'Edit__Duplicate', 'Edit__Group', 'Edit__Ungroup' ];   // <-- Still the sheet's from a focused select, checkbox or number box
    const Na__LeTools__NON_TEXT_INPUTS = [ 'checkbox', 'radio', 'range', 'color', 'button', 'submit', 'reset', 'file', 'image', 'number' ];
    const Na__LeTools__TYPED_MIN_MM    = 1e-4;   // <-- Shorter than this (paper mm) is no length and no direction, as the Draw tool uses
    const Na__LeTools__SAME_MM         = 1e-9;   // <-- Points this close still count as untouched, as the Rectangle tool's retype check uses
    // ------------------------------------------------------------

    // MODULE VARIABLES | Attachment and Interaction State
    // ------------------------------------------------------------
    let Na__LeTools__Stage      = null;
    let Na__LeTools__Editable   = false;
    let Na__LeTools__Drag       = null;    // <-- { kind, id, hit, mode, index, start, startMm, moved, pointerId, click }; a multi-selection's is { kind : 'group', group, ... }
    let Na__LeTools__Suppressed = false;   // <-- Raised by the control modules while a navigation gesture owns the pointer
    let Na__LeTools__RightPress = null;    // <-- { x, y } of the last right-button press
    let Na__LeTools__LastPointMm = null;   // <-- Where the cursor last sat on the paper, so a key can restretch the band
    let Na__LeTools__ShiftHeld   = false;  // <-- Shift at the last move or Shift key: a typed dimension goes ortho by it, as a click does
    let Na__LeTools__VertexRetype = null;  // <-- { id, index, from : [x, y], dir : { x, y }, points : [[x, y], ...] } while a typed vertex length may still be retyped
    let Na__LeTools__DimEndRetype = null;  // <-- { id, mode, fixed : { x, y }, point : { x, y }, orientation, landed } while a typed dimension span may still be retyped
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | State Writers
// -----------------------------------------------------------------------------

    // FUNCTION | Assign the Shared State From Another Sheet Tools File
    // ------------------------------------------------------------
    // An imported binding reads live but cannot be assigned. Each writer
    // stands in for an assignment that sat in the file before the split, and
    // does nothing more than that assignment did.
    // ------------------------------------------------------------
    function Na__LeTools__WriteStage(stage)          { Na__LeTools__Stage = stage; }
    function Na__LeTools__WriteEditable(editable)    { Na__LeTools__Editable = editable; }
    function Na__LeTools__WriteDrag(drag)            { Na__LeTools__Drag = drag; }
    function Na__LeTools__WriteSuppressed(flag)      { Na__LeTools__Suppressed = flag; }
    function Na__LeTools__WriteRightPress(press)     { Na__LeTools__RightPress = press; }
    function Na__LeTools__WriteLastPointMm(pointMm)  { Na__LeTools__LastPointMm = pointMm; }
    function Na__LeTools__WriteShiftHeld(shift)      { Na__LeTools__ShiftHeld = shift; }
    function Na__LeTools__WriteVertexRetype(record)  { Na__LeTools__VertexRetype = record; }
    function Na__LeTools__WriteDimEndRetype(record)  { Na__LeTools__DimEndRetype = record; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Sheet Tools State
    // ------------------------------------------------------------
    export {
        Na__LeTools__TOOL_SELECT,
        Na__LeTools__TOOL_MOVE,
        Na__LeTools__TOOL_TEXT,
        Na__LeTools__TOOL_DIMENSION,
        Na__LeTools__TOOL_DRAW,
        Na__LeTools__TOOL_RECT,
        Na__LeTools__TOOL_EYEDROP,
        Na__LeTools__TOOL_LEADER,
        Na__LeTools__TOOLS,
        Na__LeTools__PICK_TOOLS,
        Na__LeTools__CHANGED_EVENT,
        Na__LeTools__DEFAULTS_EVENT,
        Na__LeTools__MENU_SLOP_PX,
        Na__LeTools__SHEET_CHORDS,
        Na__LeTools__NON_TEXT_INPUTS,
        Na__LeTools__TYPED_MIN_MM,
        Na__LeTools__SAME_MM,
        Na__LeTools__Stage,
        Na__LeTools__Editable,
        Na__LeTools__Drag,
        Na__LeTools__Suppressed,
        Na__LeTools__RightPress,
        Na__LeTools__LastPointMm,
        Na__LeTools__ShiftHeld,
        Na__LeTools__VertexRetype,
        Na__LeTools__DimEndRetype,
        Na__LeTools__WriteStage,
        Na__LeTools__WriteEditable,
        Na__LeTools__WriteDrag,
        Na__LeTools__WriteSuppressed,
        Na__LeTools__WriteRightPress,
        Na__LeTools__WriteLastPointMm,
        Na__LeTools__WriteShiftHeld,
        Na__LeTools__WriteVertexRetype,
        Na__LeTools__WriteDimEndRetype
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
