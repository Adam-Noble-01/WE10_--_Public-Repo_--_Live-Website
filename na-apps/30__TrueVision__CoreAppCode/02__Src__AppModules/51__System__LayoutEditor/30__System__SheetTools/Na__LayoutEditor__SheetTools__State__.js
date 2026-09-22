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
//   suppression flag, the last right press, the last pointer point, Shift,
//   the vertex a typed length has just moved, which another typed length may
//   still move again (and the dimension end, and the last whole move), the
//   last left press on an item and whether the press in hand travelled. Every file reads them as plain imports, which stay live.
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
// 22-Sep-2026 - Version 1.8.0
// - TOOL_REGION ('note-region') joins TOOLS: drawing an overspill note region
//   (50__Feature__Specification/Na__LayoutEditor__NoteRegions__Tool__). It has
//   no key and no toolbar button - the Margin Notes panel's Add region and a
//   region's Redraw put it up - and it is a placing tool like the rest, so
//   picking it closes an open container and Escape puts Select back.
//
// 21-Sep-2026 - Version 1.7.0
// - SHEET_CHORDS takes View__AxesToggle (F9, the Drawing Axes Overlay): a
//   function key types nothing, so a panel's select, checkbox or number box
//   left holding the focus no longer swallows it, as for F6, F7 and F8.
//
// 21-Sep-2026 - Version 1.6.0
// - TOOLS takes in the vector tools' names (Na__LeVec__TOOLS, from
//   37__System__VectorTools' state leaf): Circle, Arc, Trim, Extend, Join, Split,
//   Offset, Fillet and Chamfer. They are named there and nowhere else. Which of
//   them keep an open container open is the vector tools' own rule
//   (Na__LeVec__KeepsContainer); PICK_TOOLS is still just Select and Move.
//
// 21-Sep-2026 - Version 1.5.0
// - MoveRetype: the last whole-object move (a vector, a note, a leader, a
//   dimension or a selection moved as one) or viewport frame move, kept so a
//   value typed into the Measurements box after it - by the mouse or by a
//   typed length - lands it again that far along the same line, from where it
//   started. SketchUp's rule. Written by the pointer drag unit, cleared by
//   CancelPlacement.
//
// 21-Sep-2026 - Version 1.4.0
// - SHEET_CHORDS takes Ortho__Toggle (F8, Na__LayoutEditor__OrthoMode__),
//   View__GridToggle (F6, show the drawing grid) and Snap__GridToggle (F7,
//   snap to it): a function key types nothing, so
//   a panel's select, checkbox or number box left holding the focus no longer
//   swallows it - F8 still switches Ortho straight after a panel was used.
//
// 19-Sep-2026 - Version 1.3.0
// - LastPress and PressTravelled, for the Move tool Select now picks up by
//   itself. LastPress is where and when the last left press landed on an item,
//   which is how the SECOND press of a double click is known for what it is
//   (a pointerdown carries no click count). PressTravelled says the press in
//   hand became a drag or a box, so the double click the browser still reports
//   at the end of it is ignored. Written by the press and drag units.
//
//
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
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Vector Tools' Names (a leaf: it imports nothing back)
    // ------------------------------------------------------------
    import { Na__LeVec__TOOLS } from '../37__System__VectorTools/Na__LayoutEditor__VectorTools__State__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


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
    const Na__LeTools__TOOL_AREA      = 'area';     // <-- A: draws a measured room through the Draw or Rectangle tool (59__Feature__FloorAreas)
    const Na__LeTools__TOOL_REGION    = 'note-region';   // <-- No key and no button: the Margin Notes panel arms it to draw an overspill note region through the Rectangle tool (50__Feature__Specification)
    const Na__LeTools__TOOLS          = [ Na__LeTools__TOOL_SELECT, Na__LeTools__TOOL_MOVE, Na__LeTools__TOOL_TEXT, Na__LeTools__TOOL_DIMENSION, Na__LeTools__TOOL_DRAW, Na__LeTools__TOOL_RECT, Na__LeTools__TOOL_EYEDROP, Na__LeTools__TOOL_LEADER, Na__LeTools__TOOL_AREA, Na__LeTools__TOOL_REGION ]
        .concat(Na__LeVec__TOOLS);   // <-- Circle, Arc, Trim, Extend, Join, Split, Offset, Fillet and Chamfer (37__System__VectorTools): named there, so a tenth is added in one place
    const Na__LeTools__PICK_TOOLS     = [ Na__LeTools__TOOL_SELECT, Na__LeTools__TOOL_MOVE ];   // <-- The two that work on what is already on the sheet: they keep an open container, the rest close it
    const Na__LeTools__CHANGED_EVENT  = 'na-layouteditor-tool-changed';
    const Na__LeTools__DEFAULTS_EVENT = 'na-layouteditor-defaults-changed';   // <-- The settings for new objects changed from outside their panel (a palette sync)
    const Na__LeTools__MENU_SLOP_PX   = 4;      // <-- A right button that travelled further than this panned, so no menu
    const Na__LeTools__SHEET_CHORDS   = [ 'Edit__Undo', 'Edit__Redo', 'Edit__Cut', 'Edit__Copy', 'Edit__Paste', 'Edit__Duplicate', 'Edit__Group', 'Edit__Ungroup', 'Ortho__Toggle', 'View__GridToggle', 'Snap__GridToggle', 'View__AxesToggle' ];   // <-- Still the sheet's from a focused select, checkbox or number box (F8, F6, F7 and F9 type nothing, so they are the sheet's too)
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
    let Na__LeTools__MoveRetype   = null;  // <-- { drag, sheetId, fromMm, dir, lengthMm, selection, landed } while the last whole-object move or viewport frame move may still be retyped
    let Na__LeTools__LastPress    = null;  // <-- { time, x, y, key } of the last left press on an item: the second press of a double click is known by it
    let Na__LeTools__PressTravelled = false;   // <-- The press in hand became a drag or a box, so a double click that ends on it is not one
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
    function Na__LeTools__WriteMoveRetype(record)    { Na__LeTools__MoveRetype = record; }
    function Na__LeTools__WriteLastPress(press)      { Na__LeTools__LastPress = press; }
    function Na__LeTools__WritePressTravelled(flag)  { Na__LeTools__PressTravelled = flag; }
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
        Na__LeTools__TOOL_AREA,
        Na__LeTools__TOOL_REGION,
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
        Na__LeTools__MoveRetype,
        Na__LeTools__LastPress,
        Na__LeTools__PressTravelled,
        Na__LeTools__WriteStage,
        Na__LeTools__WriteEditable,
        Na__LeTools__WriteDrag,
        Na__LeTools__WriteSuppressed,
        Na__LeTools__WriteRightPress,
        Na__LeTools__WriteLastPointMm,
        Na__LeTools__WriteShiftHeld,
        Na__LeTools__WriteVertexRetype,
        Na__LeTools__WriteDimEndRetype,
        Na__LeTools__WriteMoveRetype,
        Na__LeTools__WriteLastPress,
        Na__LeTools__WritePressTravelled
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
