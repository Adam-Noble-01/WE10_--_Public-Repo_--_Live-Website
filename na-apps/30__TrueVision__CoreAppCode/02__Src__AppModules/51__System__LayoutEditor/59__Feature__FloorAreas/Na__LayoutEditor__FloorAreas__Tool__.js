// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - FLOOR AREAS - THE AREA TOOL
// =============================================================================
//
// FILE       : Na__LayoutEditor__FloorAreas__Tool__.js
// NAMESPACE  : Na__LeAreaTool
// MODULE     : Layout Editor - Floor Areas - Tool
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Drawing a room - the Draw and Rectangle tools, handed the Floor Areas layer and a name, and made to close what they draw
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - THIS TOOL DRAWS NOTHING ITSELF. Point by point it IS the Draw tool and
//   corner to corner it IS the Rectangle tool: the same snapping to the
//   drawing's linework, the same Shift hold and arrow-key axis lock, the same
//   typed lengths at the drawing's scale, the same Ctrl+Z that takes one
//   corner back off. All this adds is what a room needs and a vector does not
//   - the Floor Areas layer, a name, the group the panel is filing into, and
//   the rule that what is drawn is always CLOSED.
// - ONE ADAPTER, SIX DISPATCH SITES. The sheet tools hand a tool its press,
//   its move, its release, its double click, its right click and its keys in
//   six different files. Routing each of them to the Draw tool or the
//   Rectangle tool on the spot would have put the same branch in all six and
//   left the seventh - whichever is added next - quietly wrong. They all ask
//   this module instead, and it is the only thing that knows which of the two
//   is drawing.
// - A ROOM IS NAMED AS IT LANDS. Area 1, Area 2 - the first free number on
//   the sheet - so its label says something at once and the index never lists
//   a row of blanks. The panel hears PLACED_EVENT and puts the cursor in the
//   name box, so the real name can simply be typed.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__PointerPress__ / __PointerDrag__ /
//   __Keyboard__ / __ContextMenu__ / __ToolState__ and
//   Na__LayoutEditor__Measurements__ dispatch here for TOOL_AREA.
// // @delegate: ../35__System__DrawingTools/Na__LayoutEditor__ShapeTool__.js
// // @delegate: ../35__System__DrawingTools/Na__LayoutEditor__RectangleTool__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026)
// - ValeVision    : not yet ported - it goes with the rest of Floor Areas.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation: the two modes, the defaults, and what happens
//   when a room lands.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Two Drawing Tools, the Model and the Floor Area System
    // ------------------------------------------------------------
    import { Na__LeShape__Click, Na__LeShape__Move, Na__LeShape__Finish, Na__LeShape__Cancel, Na__LeShape__IsDrawing, Na__LeShape__Measure, Na__LeShape__TypeLength } from '../35__System__DrawingTools/Na__LayoutEditor__ShapeTool__.js';
    import { Na__LeRect__Press, Na__LeRect__Move, Na__LeRect__Release, Na__LeRect__Cancel, Na__LeRect__IsDrawing, Na__LeRect__Measure, Na__LeRect__TypeSize } from '../35__System__DrawingTools/Na__LayoutEditor__RectangleTool__.js';
    import { Na__LeModel__GetSelection, Na__LeModel__GetShapeById } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import {
        Na__LeArea__Is,
        Na__LeArea__NewBlock,
        Na__LeArea__NewStyle,
        Na__LeArea__NewSettings,
        Na__LeArea__SetNewSettings,
        Na__LeArea__EnsureLayer
    } from './Na__LayoutEditor__FloorAreas__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Announcement a Landed Room Makes
    // ------------------------------------------------------------
    // Not a model change - the model has already announced that. This says
    // "a room has just been drawn and is selected", which is what the panel
    // waits for so it can put the cursor in the name box.
    // ------------------------------------------------------------
    const Na__LeAreaTool__PLACED_EVENT = 'na-layouteditor-area-placed';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Which of the Two Is Drawing
// -----------------------------------------------------------------------------

    // FUNCTION | Does the Area Tool Draw Corner to Corner or Point by Point
    // ------------------------------------------------------------
    // Remembered with the panel's other settings for new areas, because it is
    // one: most rooms are rectangles, and somebody measuring a floor wants to
    // keep whichever way they are working.
    // ------------------------------------------------------------
    function Na__LeAreaTool__IsRectangle() {
        return Na__LeArea__NewSettings().rectangle === true;
    }
    function Na__LeAreaTool__SetRectangle(on) {
        Na__LeAreaTool__SetMode(on === true);
        return Na__LeAreaTool__IsRectangle();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Change Mode, Abandoning Anything Half Drawn
    // ------------------------------------------------------------
    // Switching from a half-drawn polygon to the rectangle tool would leave
    // three corners on the sheet with nothing to finish them.
    // ------------------------------------------------------------
    function Na__LeAreaTool__SetMode(rectangle) {
        if (Na__LeArea__NewSettings().rectangle === rectangle) return;
        Na__LeAreaTool__Cancel(null);
        Na__LeArea__SetNewSettings({ rectangle : rectangle });
    }
    // ------------------------------------------------------------


    // FUNCTION | What the Drawing Tools Are Handed When the Area Tool Is Up
    // ------------------------------------------------------------
    // The Vectors panel's own defaults, with the floor area settings laid over
    // them: the room's colour and how solid it is, the Floor Areas layer, and
    // the block that names it. `filled` is forced on - a measured room is a
    // wash over a drawing, and one without a fill could only be clicked on its
    // outline.
    //
    // THE LAYER IS MADE HERE, on the first click of the first room, rather
    // than when the tool is picked up: picking a tool up and pressing Escape
    // must leave the sheet exactly as it was.
    // ------------------------------------------------------------
    function Na__LeAreaTool__Defaults(sheet, shapeDefaults) {
        const style = Na__LeArea__NewStyle(sheet);
        const layer = Na__LeArea__EnsureLayer(sheet, { show : true });
        return Object.assign({}, shapeDefaults || {}, style, {
            filled  : true,
            closed  : true,
            area    : Na__LeArea__NewBlock(sheet),
            layerId : layer ? layer.Layer__Id : null
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Six Dispatch Sites
// -----------------------------------------------------------------------------

    // FUNCTION | A Press With the Area Tool
    // ------------------------------------------------------------
    // Corner to corner: the rectangle tool's press, which also wants the
    // pointer captured by the caller. Point by point: a vertex, exactly as the
    // Draw tool places one - including closing the room by clicking its first
    // corner again.
    // ------------------------------------------------------------
    function Na__LeAreaTool__Press(sheet, pointMm, shift, shapeDefaults, pointerId) {
        const defaults = Na__LeAreaTool__Defaults(sheet, shapeDefaults);
        if (Na__LeAreaTool__IsRectangle()) {
            const placed = Na__LeRect__Press(sheet, pointMm, shift, defaults, pointerId);
            Na__LeAreaTool__Landed(sheet);
            return placed;
        }
        const drawn = Na__LeShape__Click(sheet, pointMm, shift, defaults);
        Na__LeAreaTool__Landed(sheet);                                       // <-- A click on the first corner closes the room, which lands it here
        return drawn;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Cursor Moves, the Button Comes Up, and the Band Is Redrawn
    // ------------------------------------------------------------
    function Na__LeAreaTool__Move(sheet, pointMm, shift, pressed) {
        if (Na__LeAreaTool__IsRectangle()) return Na__LeRect__Move(sheet, pointMm, shift, pressed);
        return Na__LeShape__Move(sheet, pointMm, shift);
    }
    function Na__LeAreaTool__Release(sheet, pointMm, shift, pointerId) {
        if (!Na__LeAreaTool__IsRectangle()) return false;
        const landed = Na__LeRect__Release(sheet, pointMm, shift, pointerId);
        Na__LeAreaTool__Landed(sheet);
        return landed;
    }
    function Na__LeAreaTool__Rerun(sheet, pointMm, shift) {
        if (Na__LeAreaTool__IsRectangle()) { Na__LeRect__Move(sheet, pointMm, shift, false); return true; }
        Na__LeShape__Move(sheet, pointMm, shift);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Finish the Room - Always Closed
    // ------------------------------------------------------------
    // Enter, a double click or a right click. The Draw tool finishes a
    // polyline OPEN; a room is never open, so this is the one place the two
    // genuinely differ. Fewer than three corners enclose nothing, and the
    // Shape tool deletes such a draft rather than leaving a line on the
    // Floor Areas layer.
    // ------------------------------------------------------------
    function Na__LeAreaTool__Finish(sheet) {
        if (Na__LeAreaTool__IsRectangle()) return false;                     // <-- A rectangle is finished by its second corner and by nothing else
        if (!Na__LeShape__IsDrawing()) return false;
        const done = Na__LeShape__Finish(sheet, true);
        Na__LeAreaTool__Landed(sheet);
        return done;
    }
    // ------------------------------------------------------------


    // FUNCTION | Abandon What Is Half Drawn, and Is Anything Being Drawn
    // ------------------------------------------------------------
    function Na__LeAreaTool__Cancel(sheet) {
        const had = Na__LeShape__IsDrawing() || Na__LeRect__IsDrawing();
        Na__LeShape__Cancel(sheet);
        Na__LeRect__Cancel();
        return had;
    }
    function Na__LeAreaTool__IsDrawing() {
        return Na__LeShape__IsDrawing() || Na__LeRect__IsDrawing();
    }
    // ------------------------------------------------------------


    // FUNCTION | What the Measurements Box Reads and What a Typed Value Does
    // ------------------------------------------------------------
    // Straight through to whichever tool is drawing: a length along the band
    // point by point, a width by a height corner to corner.
    // ------------------------------------------------------------
    function Na__LeAreaTool__Measure(sheet) {
        return Na__LeAreaTool__IsRectangle() ? Na__LeRect__Measure(sheet) : Na__LeShape__Measure();
    }
    function Na__LeAreaTool__TypeLength(sheet, lengthMm) {
        const result = Na__LeShape__TypeLength(sheet, lengthMm);
        if (result && result.ok && result.closed) Na__LeAreaTool__Landed(sheet);   // <-- A length typed back onto the first corner closes the room
        return result;
    }
    function Na__LeAreaTool__TypeSize(sheet, widthMm, heightMm) {
        const result = Na__LeRect__TypeSize(sheet, widthMm, heightMm);
        if (result && result.ok) Na__LeAreaTool__Landed(sheet);
        return result;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | When a Room Lands
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Room Has Just Been Drawn: Say So, Once
    // ------------------------------------------------------------
    // Both tools select what they have just drawn, so the selection is where
    // the answer is. Anything else selected - or nothing - means nothing
    // landed on this press, which is the ordinary case for every click but
    // the last.
    // ------------------------------------------------------------
    // THE MEASUREMENTS BOX CALLS IT TOO, under its own name: a length typed
    // back onto the first corner closes a room, and a typed width and height
    // lands a whole rectangular one, neither of which goes through a press.
    function Na__LeAreaTool__Settled(sheet) {
        return Na__LeAreaTool__Landed(sheet);
    }
    function Na__LeAreaTool__Landed(sheet) {
        if (!sheet || Na__LeAreaTool__IsDrawing()) return false;
        const selection = Na__LeModel__GetSelection();
        if (!selection || selection.kind !== 'shape') return false;
        const shape = Na__LeModel__GetShapeById(sheet, selection.id);
        if (!Na__LeArea__Is(shape)) return false;
        window.dispatchEvent(new CustomEvent(Na__LeAreaTool__PLACED_EVENT, { detail : { sheetId : sheet.Sheet__Id, shapeId : selection.id } }));
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Floor Area Tool API
    // ------------------------------------------------------------
    export {
        Na__LeAreaTool__PLACED_EVENT,
        Na__LeAreaTool__Settled,
        Na__LeAreaTool__IsRectangle,
        Na__LeAreaTool__SetRectangle,
        Na__LeAreaTool__Defaults,
        Na__LeAreaTool__Press,
        Na__LeAreaTool__Move,
        Na__LeAreaTool__Release,
        Na__LeAreaTool__Rerun,
        Na__LeAreaTool__Finish,
        Na__LeAreaTool__Cancel,
        Na__LeAreaTool__IsDrawing,
        Na__LeAreaTool__Measure,
        Na__LeAreaTool__TypeLength,
        Na__LeAreaTool__TypeSize
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
