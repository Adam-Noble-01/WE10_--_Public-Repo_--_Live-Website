// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET TOOLS - TOOL STATE
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetTools__ToolState__.js
// NAMESPACE  : Na__LeTools
// MODULE     : Layout Editor - Sheet Tools - Tool State
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The settings new objects are created with, the active tool, and arming the eyedropper and loading the palette
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - The settings for new text, dimensions, shapes and leaders: a Get and a
//   Set for each. Each is filled from its config setup on the first read, and
//   the Text, Dimensions, Vectors and Leaders panels edit them.
// - The active tool. SetTool abandons whatever a placing tool has half done
//   (CancelPlacement, which also empties the eyedropper, clears the viewport
//   snap move's tracking points, cancels a selection box and drops a
//   half-typed Measurements value), sets the stage's resting cursor
//   (ToolCursor) and announces CHANGED_EVENT. Draw or Rectangle, whichever
//   was picked last, is remembered for a vector palette sync.
// - The eyedropper. ArmEyedropper (B) arms it, loaded from the selection when
//   there is one; ArmPalette (Shift+B) arms it to load the palette.
//   SyncPaletteFrom stores an item's style as the settings for new objects of
//   its kind (AdoptStyle, which announces DEFAULTS_EVENT), clears the
//   selection so the panel shows them, and hands over to the drawing tool for
//   that kind (ToolForKind).
// - The active tool, the vector tool that drew last and the four settings
//   objects live here, beside their only writers. The other sheet tools files
//   read the active tool as a live import of Na__LeTools__Tool.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__ re-exports SetTool, GetTool,
//   ArmEyedropper, ArmPalette and the Get and Set defaults under the same
//   names (the toolbar and the Text, Dimensions, Leaders and Shapes panels
//   import them from there), and calls SetTool and CancelPlacement from
//   Attach and Detach.
// - The pointer, keyboard and context menu units call SetTool,
//   CancelPlacement, SyncPaletteFrom and the defaults.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the ValeVision3D v2.47.0 split of the same module (same unit, same functions)
// - Parity        : verbatim (moved code)
// - Divergences   : CancelPlacement also clears Na__LayoutEditor__ViewportSnapMove__, which only TrueVision has.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 17-Sep-2026 - Version 1.1.0
// - TOOL_MOVE. SetTool keeps an open container for the two tools that edit what
//   is already on the sheet (PICK_TOOLS: Select and Move) and closes it for
//   every tool that places something new. ToolCursor gives Move the four-way
//   arrow. An unknown tool name still falls back to Select, which is the one
//   resting state.
//
//
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__SheetTools__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Placing Tools, Gradient and Dash, Measurements, Eyedropper, Axis Lock, Viewport Snap Move, Selection Box
    // ------------------------------------------------------------
    import {
        Na__LeCfg__GetTextSetup,
        Na__LeCfg__GetDimensionSetup,
        Na__LeCfg__GetShapeSetup,
        Na__LeCfg__GetLeaderSetup,
        Na__LeCfg__GetEyedropperSetup
    } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__GetActiveSheet, Na__LeModel__SetSelection, Na__LeModel__GetSelection } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeDim__Cancel } from '../35__System__DrawingTools/Na__LayoutEditor__DimensionTool__.js';
    import { Na__LeShape__Cancel } from '../35__System__DrawingTools/Na__LayoutEditor__ShapeTool__.js';
    import { Na__LeGrad__Defaults, Na__LeGrad__Create } from '../35__System__DrawingTools/Na__LayoutEditor__GradientTool__.js';
    import { Na__LeDash__Defaults, Na__LeDash__Create } from '../35__System__DrawingTools/Na__LayoutEditor__LineStyleTool__.js';
    // @delegate: ../35__System__DrawingTools/Na__LayoutEditor__LineStyleTool__.js
    import { Na__LeRect__Cancel } from '../35__System__DrawingTools/Na__LayoutEditor__RectangleTool__.js';
    import { Na__LeMeasure__Refresh, Na__LeMeasure__Clear } from './Na__LayoutEditor__Measurements__.js';
    import { Na__LeLeader__Cancel } from '../35__System__DrawingTools/Na__LayoutEditor__LeaderTool__.js';
    import { Na__LeDrop__Clear, Na__LeDrop__Pick, Na__LeDrop__MODE_ITEM, Na__LeDrop__MODE_PALETTE, Na__LeDrop__SetMode, Na__LeDrop__GetMode, Na__LeDrop__SyncPalette } from './Na__LayoutEditor__Eyedropper__.js';
    import { Na__LeAxis__Clear } from './Na__LayoutEditor__AxisLock__.js';
    import { Na__LeVpMove__Clear } from '../20__System__Viewports/Na__LayoutEditor__ViewportSnapMove__.js';
    import { Na__LeSelBox__Cancel } from './Na__LayoutEditor__SelectionBox__.js';
    import { Na__LeScope__Clear, Na__LeScope__IsActive } from './Na__LayoutEditor__EditScope__.js';
    import { Na__LeGrips__MOVE_CURSOR } from './Na__LayoutEditor__Grips__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Sheet Tools State
    // ------------------------------------------------------------
    import {
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
        Na__LeTools__Stage,
        Na__LeTools__Editable,
        Na__LeTools__WriteVertexRetype,
        Na__LeTools__WriteDimEndRetype
    } from './Na__LayoutEditor__SheetTools__State__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Active Tool and the Settings for New Objects (their only writers are below)
    // ------------------------------------------------------------
    let Na__LeTools__Tool       = Na__LeTools__TOOL_SELECT;
    let Na__LeTools__TextDefaults  = null;
    let Na__LeTools__DimDefaults   = null;
    let Na__LeTools__ShapeDefaults = null;
    let Na__LeTools__LeaderDefaults = null;
    let Na__LeTools__LastVectorTool = Na__LeTools__TOOL_DRAW;   // <-- Draw or Rectangle, whichever drew last: where a vector palette sync hands over
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Defaults and Tool State
// -----------------------------------------------------------------------------

    // FUNCTION | Settings Applied to New Text, Dimensions and Shapes (the panels edit these)
    // ------------------------------------------------------------
    function Na__LeTools__GetTextDefaults() {
        if (!Na__LeTools__TextDefaults) {
            const s = Na__LeCfg__GetTextSetup();
            Na__LeTools__TextDefaults = { text : s.defaultText, sizeMm : s.defaultSizeMm, fontWeight : s.defaultWeight, colour : s.defaultColour, align : 'left', leader : false, rotationDeg : 0 };
        }
        return Na__LeTools__TextDefaults;
    }
    function Na__LeTools__SetTextDefaults(patch) { Object.assign(Na__LeTools__GetTextDefaults(), patch || {}); }
    function Na__LeTools__GetDimensionDefaults() {
        if (!Na__LeTools__DimDefaults) {
            const s = Na__LeCfg__GetDimensionSetup();
            Na__LeTools__DimDefaults = { textSizeMm : s.defaultTextSizeMm, colour : s.defaultColour, terminator : s.defaultTerminator, tickLengthMm : s.tickLengthMm, offsetMm : s.defaultOffsetMm, precision : s.defaultPrecision, unitsSuffix : s.defaultUnits,
                                         atScale : s.defaultAtScale,     // <-- Measure at scale: the Dimensions panel's first control
                                         startExtensionMm : s.defaultExtensionMm, endExtensionMm : s.defaultExtensionMm, extensionsLinked : true };   // <-- Fixed length extension lines, linked; null is the full line
        }
        return Na__LeTools__DimDefaults;
    }
    function Na__LeTools__SetDimensionDefaults(patch) { Object.assign(Na__LeTools__GetDimensionDefaults(), patch || {}); }
    function Na__LeTools__GetShapeDefaults() {
        if (!Na__LeTools__ShapeDefaults) {
            const s = Na__LeCfg__GetShapeSetup();
            Na__LeTools__ShapeDefaults = { strokeColour : s.defaultStrokeColour, strokePt : s.defaultStrokePt, fillColour : s.defaultFillColour, filled : s.defaultFilled, stroked : s.defaultStroked,
                                           fillOpacity : s.defaultFillOpacity, strokeOpacity : 1, atScale : s.defaultAtScale,   // <-- Draw at scale: the Vectors panel's first control
                                           gradientOn : Na__LeGrad__Defaults().on === true, gradient : Na__LeGrad__Create(),   // <-- The settings outlive the toggle, so switching it back on restores them
                                           dashOn : Na__LeDash__Defaults().on === true, dash : Na__LeDash__Create() };
        }
        return Na__LeTools__ShapeDefaults;
    }
    function Na__LeTools__SetShapeDefaults(patch) { Object.assign(Na__LeTools__GetShapeDefaults(), patch || {}); }
    function Na__LeTools__GetLeaderDefaults() {
        if (!Na__LeTools__LeaderDefaults) {
            const s = Na__LeCfg__GetLeaderSetup();
            Na__LeTools__LeaderDefaults = { type : s.defaultType, textSizeMm : s.textSizeMm, fontWeight : s.fontWeight, textColour : s.textColour,
                                            lineStyle : s.lineStyle, linePt : s.linePt, lineColour : s.lineColour, lineOpacity : s.lineOpacity,
                                            endpointFilled : s.endpointFilled, endpointPt : s.endpointPt, endpointSizeMm : s.endpointSizeMm,
                                            bubbleSizeMm : s.bubbleSizeMm, bubbleEdgePt : s.bubbleEdgePt,
                                            filled : s.filled, fillColour : s.fillColour, fillOpacity : s.fillOpacity };   // <-- The fill is a switch beside its colour, as for shapes
        }
        return Na__LeTools__LeaderDefaults;
    }
    function Na__LeTools__SetLeaderDefaults(patch) { Object.assign(Na__LeTools__GetLeaderDefaults(), patch || {}); }
    // ------------------------------------------------------------


    // FUNCTION | Abandon Whatever a Placing Tool Has Half Done
    // ------------------------------------------------------------
    // The eyedropper counts as a placing tool here: a style sitting on the
    // dropper is half-finished work in exactly the same way a half-drawn
    // polyline is, so anything that abandons one abandons the other.
    // ------------------------------------------------------------
    function Na__LeTools__CancelPlacement() {
        const sheet = Na__LeModel__GetActiveSheet();
        Na__LeDim__Cancel(sheet);
        Na__LeShape__Cancel(sheet);
        Na__LeRect__Cancel();
        Na__LeLeader__Cancel(sheet);
        Na__LeDrop__Clear();
        Na__LeAxis__Clear();
        Na__LeTools__WriteVertexRetype(null);                                // <-- A vertex a typed length could still be retyped for stops being one
        Na__LeTools__WriteDimEndRetype(null);                                // <-- And a dimension whose span could still be retyped
        Na__LeVpMove__Clear();                                               // <-- Tracking points and the carry marker go with the tool
        Na__LeSelBox__Cancel();                                              // <-- So does a selection box being dragged out
        Na__LeMeasure__Clear();                                              // <-- And a value half typed into the Measurements box
    }
    // ------------------------------------------------------------


    // FUNCTION | The Active Tool
    // ------------------------------------------------------------
    // AN OPEN CONTAINER BELONGS TO THE TOOLS THAT EDIT WHAT IS ALREADY THERE.
    // Select and Move keep it open - stepping into a vector and then moving its
    // vertices is one piece of work - and every other tool closes it, because a
    // tool that PLACES something is starting new work on the sheet itself. So
    // is putting the tools down: Escape leaves no container open.
    // ------------------------------------------------------------
    function Na__LeTools__SetTool(tool) {
        const next = Na__LeTools__TOOLS.indexOf(tool) === -1 ? Na__LeTools__TOOL_SELECT : tool;
        if (!Na__LeTools__Editable && next !== Na__LeTools__TOOL_SELECT) return Na__LeTools__Tool;
        Na__LeTools__CancelPlacement();
        if (Na__LeTools__PICK_TOOLS.indexOf(next) === -1 && Na__LeScope__IsActive()) Na__LeScope__Clear();
        Na__LeTools__Tool = next;
        if (next === Na__LeTools__TOOL_DRAW || next === Na__LeTools__TOOL_RECT) Na__LeTools__LastVectorTool = next;
        if (Na__LeTools__Stage) Na__LeTools__Stage.style.cursor = Na__LeTools__ToolCursor(next);
        Na__LeMeasure__Refresh();                                            // <-- The Measurements box reads for the new tool, or rests
        window.dispatchEvent(new CustomEvent(Na__LeTools__CHANGED_EVENT, { detail : { tool : next } }));
        return next;
    }
    function Na__LeTools__GetTool() { return Na__LeTools__Tool; }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Resting Cursor for a Tool
    // ------------------------------------------------------------
    // The eyedropper does not get the crosshair: a crosshair says "a point
    // lands here", and the eyedropper never places anything. It carries the
    // copy cursor from the moment it is armed, and the hover pass sharpens
    // that to apply or refuse once there is something under the pointer.
    //
    // The Move tool carries the four-way arrow the whole time it is up, armed
    // or over bare paper alike, so there is never a doubt about whether a drag
    // is about to move something. Select, the resting state, shows the plain
    // arrow the stage already has.
    // ------------------------------------------------------------
    function Na__LeTools__ToolCursor(tool) {
        if (tool === Na__LeTools__TOOL_SELECT)  return '';
        if (tool === Na__LeTools__TOOL_MOVE)    return Na__LeGrips__MOVE_CURSOR;
        if (tool === Na__LeTools__TOOL_EYEDROP) return Na__LeCfg__GetEyedropperSetup().cursor;
        return 'crosshair';
    }
    // ------------------------------------------------------------


    // FUNCTION | Arm the Eyedropper, Seeding It From the Selection
    // ------------------------------------------------------------
    // Pressing B with something already selected loads the dropper from that
    // selection at once, so the common path - notice the one that looks right,
    // click it, press B, click the ones that should match - costs one key and
    // no extra click. With nothing selected the dropper arms empty and the
    // first click on the sheet picks the source.
    //
    // Pressing B while the eyedropper is already armed for painting does
    // nothing. Going through SetTool would run CancelPlacement and quietly
    // throw away the style being held, which is the last thing a second press
    // should mean. From the palette mode it changes mode without putting the
    // tool down.
    // ------------------------------------------------------------
    function Na__LeTools__ArmEyedropper() {
        if (!Na__LeTools__Editable) return Na__LeTools__Tool;
        if (Na__LeTools__Tool === Na__LeTools__TOOL_EYEDROP && Na__LeDrop__GetMode() === Na__LeDrop__MODE_ITEM) return Na__LeTools__Tool;

        const selection = Na__LeModel__GetSelection();
        if (Na__LeTools__Tool !== Na__LeTools__TOOL_EYEDROP) Na__LeTools__SetTool(Na__LeTools__TOOL_EYEDROP);
        Na__LeDrop__SetMode(Na__LeDrop__MODE_ITEM);
        if (selection) Na__LeDrop__Pick(Na__LeModel__GetActiveSheet(), selection.kind, selection.id);
        return Na__LeTools__Tool;
    }
    // ------------------------------------------------------------


    // FUNCTION | Arm the Eyedropper to Load the Palette (Shift+B)
    // ------------------------------------------------------------
    // The palette is the Text, Dimensions and Vectors settings that new
    // objects are created with. Shift+B with something selected loads that
    // item's style at once; with nothing selected the next click on an object
    // does it. Either way the tool can then hand over to the drawing tool for
    // that kind (PaletteSwitchesTool), so "set the palette, draw with it" is
    // Shift+B and one click.
    // ------------------------------------------------------------
    function Na__LeTools__ArmPalette() {
        if (!Na__LeTools__Editable) return Na__LeTools__Tool;
        const selection = Na__LeModel__GetSelection();
        if (Na__LeTools__Tool !== Na__LeTools__TOOL_EYEDROP) Na__LeTools__SetTool(Na__LeTools__TOOL_EYEDROP);
        Na__LeDrop__SetMode(Na__LeDrop__MODE_PALETTE);
        if (selection) Na__LeTools__SyncPaletteFrom(Na__LeModel__GetActiveSheet(), selection);
        return Na__LeTools__Tool;
    }
    // ------------------------------------------------------------


    // FUNCTION | Load the Palette From One Item, Then Get Ready to Draw
    // ------------------------------------------------------------
    // The selection is cleared on purpose. A panel shows the settings for new
    // objects only while nothing is selected, and watching the Dimensions
    // panel change to match is the confirmation that the sync took.
    // ------------------------------------------------------------
    function Na__LeTools__SyncPaletteFrom(sheet, found) {
        if (!Na__LeTools__Editable || !sheet || !found) return false;
        if (!Na__LeDrop__SyncPalette(sheet, found.kind, found.id, Na__LeTools__AdoptStyle)) return false;
        Na__LeModel__SetSelection(null);
        const tool = Na__LeCfg__GetEyedropperSetup().paletteSwitchesTool ? Na__LeTools__ToolForKind(found.kind) : null;
        if (tool) Na__LeTools__SetTool(tool);
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Store a Palette Patch in the Settings for New Objects
    // ------------------------------------------------------------
    // Handed to the eyedropper as its writer. It only routes: the patch
    // arrives already in the settings' own shape, so nothing here knows a
    // field name. The event tells the mode controller to redraw the panel,
    // which cannot tell on its own because nothing on the sheet changed.
    // ------------------------------------------------------------
    function Na__LeTools__AdoptStyle(kind, patch) {
        if (kind === 'annotation')     Na__LeTools__SetTextDefaults(patch);
        else if (kind === 'dimension') Na__LeTools__SetDimensionDefaults(patch);
        else if (kind === 'shape')     Na__LeTools__SetShapeDefaults(patch);
        else if (kind === 'leader')    Na__LeTools__SetLeaderDefaults(patch);
        else return false;
        window.dispatchEvent(new CustomEvent(Na__LeTools__DEFAULTS_EVENT, { detail : { kind : kind } }));
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Drawing Tool for a Kind of Object
    // ------------------------------------------------------------
    // A vector goes to whichever of Draw and Rectangle drew last, so someone
    // laying out rectangles is not bounced back to the polyline tool each time.
    // ------------------------------------------------------------
    function Na__LeTools__ToolForKind(kind) {
        if (kind === 'annotation') return Na__LeTools__TOOL_TEXT;
        if (kind === 'dimension')  return Na__LeTools__TOOL_DIMENSION;
        if (kind === 'shape')      return Na__LeTools__LastVectorTool;
        if (kind === 'leader')     return Na__LeTools__TOOL_LEADER;
        return null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Sheet Tools Tool State
    // ------------------------------------------------------------
    export {
        Na__LeTools__Tool,
        Na__LeTools__GetTextDefaults,
        Na__LeTools__SetTextDefaults,
        Na__LeTools__GetDimensionDefaults,
        Na__LeTools__SetDimensionDefaults,
        Na__LeTools__GetShapeDefaults,
        Na__LeTools__SetShapeDefaults,
        Na__LeTools__GetLeaderDefaults,
        Na__LeTools__SetLeaderDefaults,
        Na__LeTools__CancelPlacement,
        Na__LeTools__SetTool,
        Na__LeTools__GetTool,
        Na__LeTools__ArmEyedropper,
        Na__LeTools__ArmPalette,
        Na__LeTools__SyncPaletteFrom
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
