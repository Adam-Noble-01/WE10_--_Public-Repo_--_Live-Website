// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - OVERSPILL NOTE REGIONS - THE REGION TOOL
// =============================================================================
//
// FILE       : Na__LayoutEditor__NoteRegions__Tool__.js
// NAMESPACE  : Na__LeRegionTool
// MODULE     : Layout Editor - Overspill Note Regions - Tool
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Drawing a note region - the Rectangle tool, handed a region to make instead of a vector
// CREATED    : 22-Sep-2026
//
// DESCRIPTION:
// - THIS TOOL DRAWS NOTHING ITSELF. Corner to corner it IS the Rectangle tool:
//   the same snapping to the drawings' linework, the sheet's own vectors, the
//   border, the title block, the notes margin and other regions; the drawing
//   grid when Grid Snap is on; Shift for a square; a width and height typed
//   into the Measurements box; the rubber box while it is dragged; Escape, a
//   right click or another tool to abandon it. All this adds is what a region
//   needs and a vector does not: the box becomes a region on the sheet's notes
//   margin record (Na__LeModel__AddNoteRegion), or the new frame of the one
//   being redrawn, instead of a shape.
// - ARMED FROM THE PANEL, NOT THE TOOLBAR. The Margin Notes panel's Add
//   region and a region's Redraw say what the next box is for (Arm) and then
//   put the tool up (TOOL_REGION). One box per arming: the box that lands
//   disarms it, and PLACED_EVENT tells the panel, which puts Select back up
//   and opens the region's fold.
// - A BOX IS NEVER SMALLER THAN A REGION MAY BE. A box that lands under the
//   config's RegionMinSizeMm either way grows to it, away from its first
//   corner, and a box that lands off the paper is moved back onto it.
// - ONE ADAPTER, THE SAME DISPATCH SITES AS THE AREA TOOL. The sheet tools'
//   press, move and release, the keyboard's rerun and the Measurements box ask
//   this module; the Rectangle tool's own guards (the arrows swallowed, Ctrl+Z
//   and a right click abandoning the box) already key on its box being drawn.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__PointerPress__ / __PointerDrag__ /
//   __Keyboard__ and Na__LayoutEditor__Measurements__ dispatch here for
//   TOOL_REGION. Na__LayoutEditor__Panel__MarginNotes__Regions__ arms it.
// // @delegate: ../35__System__DrawingTools/Na__LayoutEditor__RectangleTool__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (22-Sep-2026)
// - ValeVision    : not yet ported - it goes with the rest of the regions.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Records, Layout and the Rectangle Tool
    // ------------------------------------------------------------
    import { Na__LeCfg__GetMarginNotesSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__AddNoteRegion, Na__LeModel__UpdateNoteRegion } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeRec__NoteRegionById } from '../07__Core__SheetData/Na__LayoutEditor__SheetRecords__NoteRegions__.js';
    import { Na__LeLayout__Solve, Na__LeLayout__ClampToPage } from '../07__Core__SheetData/Na__LayoutEditor__SheetLayout__.js';
    import { Na__LeRect__Press, Na__LeRect__Move, Na__LeRect__Release, Na__LeRect__Cancel, Na__LeRect__IsDrawing, Na__LeRect__Measure, Na__LeRect__TypeSize } from '../35__System__DrawingTools/Na__LayoutEditor__RectangleTool__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Announcement a Landed Region Makes
    // ------------------------------------------------------------
    // Not a model change - the model has already announced that. This says "a
    // region has just been drawn", which is what the panel waits for to put
    // Select back up and open that region's fold.
    // ------------------------------------------------------------
    const Na__LeRegionTool__PLACED_EVENT = 'na-layouteditor-note-region-placed';
    // ------------------------------------------------------------

    // MODULE VARIABLES | What the Next Box Is For, and the Region It Has Just Made
    // ------------------------------------------------------------
    let Na__LeRegionTool__Target = null;     // <-- { sheetId, regionId } - regionId null for a new region
    let Na__LeRegionTool__Placed = null;     // <-- { sheetId, regionId, added } until it is announced
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Arming
// -----------------------------------------------------------------------------

    // FUNCTION | Say What the Next Box Is For: a New Region, or a New Frame for One
    // ------------------------------------------------------------
    // Called by the panel just before it puts TOOL_REGION up. regionId null
    // (or one the sheet no longer has when the box lands) makes a new region.
    // ------------------------------------------------------------
    function Na__LeRegionTool__Arm(sheet, regionId) {
        Na__LeRegionTool__Target = { sheetId : sheet ? sheet.Sheet__Id : null, regionId : regionId || null };
        return Na__LeRegionTool__Target;
    }
    function Na__LeRegionTool__Disarm() { Na__LeRegionTool__Target = null; }
    function Na__LeRegionTool__GetTarget() { return Na__LeRegionTool__Target; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | When the Box Lands
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Frame a Landed Box Gives: Never Under the Least, Kept on the Paper
    // ------------------------------------------------------------
    // points are the Rectangle tool's four corners, the first corner first; a
    // side under the least grows away from it, which is where the pointer was.
    // ------------------------------------------------------------
    function Na__LeRegionTool__FrameOf(sheet, points) {
        const least = Na__LeCfg__GetMarginNotesSetup().regionMinSizeMm;
        const ax = points[0][0], ay = points[0][1], cx = points[2][0], cy = points[2][1];
        const ex = ax + ((cx < ax) ? -1 : 1) * Math.max(least, Math.abs(cx - ax));
        const ey = ay + ((cy < ay) ? -1 : 1) * Math.max(least, Math.abs(cy - ay));
        const frame = { X : Math.min(ax, ex), Y : Math.min(ay, ey), WidthMm : Math.abs(ex - ax), HeightMm : Math.abs(ey - ay) };
        return Na__LeLayout__ClampToPage(Na__LeLayout__Solve(sheet), frame);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Make the Region, or Move the One Being Redrawn (the Rectangle Tool's `land`)
    // ------------------------------------------------------------
    // One announced change either way, so a drawn region is one undo step. The
    // tool is disarmed by it: the next box needs the panel to say what for.
    // ------------------------------------------------------------
    function Na__LeRegionTool__Land(sheet, points) {
        if (!sheet || !Array.isArray(points) || points.length < 3) return false;
        const frame  = Na__LeRegionTool__FrameOf(sheet, points);
        const target = Na__LeRegionTool__Target;
        const redraw = !!(target && target.regionId && target.sheetId === sheet.Sheet__Id && Na__LeRec__NoteRegionById(sheet, target.regionId));
        let regionId = null;
        if (redraw) {
            if (!Na__LeModel__UpdateNoteRegion(sheet, target.regionId, { frameMm : frame })) return false;
            regionId = target.regionId;
        } else {
            const region = Na__LeModel__AddNoteRegion(sheet, frame);
            if (!region) return false;
            regionId = region.Region__Id;
        }
        Na__LeRegionTool__Target = null;
        Na__LeRegionTool__Placed = { sheetId : sheet.Sheet__Id, regionId : regionId, added : !redraw };
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Say Once That a Region Has Just Landed
    // ------------------------------------------------------------
    // Run AFTER the Rectangle tool has finished with the press, the release or
    // the typed size that landed it, so the panel putting Select back up never
    // reaches into a tool still in the middle of its own work.
    // ------------------------------------------------------------
    function Na__LeRegionTool__Announce() {
        const placed = Na__LeRegionTool__Placed;
        if (!placed) return false;
        Na__LeRegionTool__Placed = null;
        window.dispatchEvent(new CustomEvent(Na__LeRegionTool__PLACED_EVENT, { detail : placed }));
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Dispatch Sites
// -----------------------------------------------------------------------------

    // FUNCTION | What the Rectangle Tool Is Handed While This Tool Is Up
    // ------------------------------------------------------------
    function Na__LeRegionTool__Defaults() {
        return { land : Na__LeRegionTool__Land };
    }
    // ------------------------------------------------------------


    // FUNCTION | A Press, a Move, a Release and a Rerun With the Region Tool
    // ------------------------------------------------------------
    // Straight through to the Rectangle tool. The press wants the pointer
    // captured by the caller, as a rectangle's does.
    // ------------------------------------------------------------
    function Na__LeRegionTool__Press(sheet, pointMm, shift, pointerId) {
        const pressed = Na__LeRect__Press(sheet, pointMm, shift, Na__LeRegionTool__Defaults(), pointerId);
        Na__LeRegionTool__Announce();                                         // <-- The click-and-click way lands on the second press
        return pressed;
    }
    function Na__LeRegionTool__Move(sheet, pointMm, shift, pressed) {
        return Na__LeRect__Move(sheet, pointMm, shift, pressed);
    }
    function Na__LeRegionTool__Release(sheet, pointMm, shift, pointerId) {
        const landed = Na__LeRect__Release(sheet, pointMm, shift, pointerId);
        Na__LeRegionTool__Announce();
        return landed;
    }
    function Na__LeRegionTool__Rerun(sheet, pointMm, shift) {
        Na__LeRect__Move(sheet, pointMm, shift, false);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Abandon the Box Being Drawn, and Is One Being Drawn
    // ------------------------------------------------------------
    function Na__LeRegionTool__Cancel() {
        const had = Na__LeRect__IsDrawing();
        Na__LeRect__Cancel();
        return had;
    }
    function Na__LeRegionTool__IsDrawing() { return Na__LeRect__IsDrawing(); }
    // ------------------------------------------------------------


    // FUNCTION | What the Measurements Box Reads, What a Typed Size Does, and Settling After It
    // ------------------------------------------------------------
    // A width by a height, exactly as for a rectangle - in paper millimetres,
    // because a region is laid out on the paper and never at a drawing's scale.
    // A typed size lands the box without a press, so the box says so after it.
    // ------------------------------------------------------------
    function Na__LeRegionTool__Measure(sheet) { return Na__LeRect__Measure(sheet); }
    function Na__LeRegionTool__TypeSize(sheet, widthMm, heightMm) {
        const result = Na__LeRect__TypeSize(sheet, widthMm, heightMm);
        Na__LeRegionTool__Announce();
        return result;
    }
    function Na__LeRegionTool__Settled() { return Na__LeRegionTool__Announce(); }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Note Region Tool API
    // ------------------------------------------------------------
    export {
        Na__LeRegionTool__PLACED_EVENT,
        Na__LeRegionTool__Arm,
        Na__LeRegionTool__Disarm,
        Na__LeRegionTool__GetTarget,
        Na__LeRegionTool__Defaults,
        Na__LeRegionTool__Press,
        Na__LeRegionTool__Move,
        Na__LeRegionTool__Release,
        Na__LeRegionTool__Rerun,
        Na__LeRegionTool__Cancel,
        Na__LeRegionTool__IsDrawing,
        Na__LeRegionTool__Measure,
        Na__LeRegionTool__TypeSize,
        Na__LeRegionTool__Settled
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
