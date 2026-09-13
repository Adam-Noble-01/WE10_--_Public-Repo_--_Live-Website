// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET TOOLS
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetTools__.js
// NAMESPACE  : Na__LeTools
// MODULE     : Layout Editor - Sheet Tools
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Select, move, resize and edit what is on the paper with the left button and the keyboard; hand placement to the text, dimension, draw and rectangle tools
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - One pointer state machine over the stage: a press resolves what is
//   under the cursor (dimensions first, then text, then shapes, then the
//   selected viewport's handles and border, then any viewport), a drag
//   past a small threshold moves or resizes it through the model in silent
//   updates, and the release announces the change once.
// - Tools: Select; Text, Dimension, Draw, Rectangle and Eyedropper live in
//   their own modules and are called from here with the panel defaults.
// - Viewports: a drag moves one (selected or not), a handle crops or
//   extends the frame, double-click enters the content, a lock refuses all
//   of it. Dimensions: grips re-pick the points and slide the line (with
//   inference); double-click edits the value. Shapes: grips move vertices.
// - A press on a point of a 2D viewport's own linework carries the viewport
//   BY that point, snapping it onto or into line with other drawings, through
//   Na__LayoutEditor__ViewportSnapMove__. Hovering shows the point first.
// - Keys: Delete removes the selection (a viewport asks first), Escape
//   backs out, Space clears the selection, Enter finishes a shape, arrows
//   nudge by a millimetre (ten with Shift), V T D L R B pick a tool, Ctrl+Z
//   and Ctrl+Y step the history, Ctrl+C Ctrl+V Ctrl+D copy, paste and
//   duplicate a viewport (Na__LayoutEditor__ViewportClipboard__). Nothing
//   fires while typing in a field; a Ctrl chord still reaches the sheet from
//   a select or a checkbox, which have no undo or paste of their own.
// - Eyedropper (B): picks the style off one item and paints it onto others
//   through Na__LayoutEditor__Eyedropper__. It neither selects nor drags, so
//   a run of style clicks never swaps the right-hand panel out mid-run.
// - Rectangle (R): one corner then the opposite one, clicked or dragged,
//   through Na__LayoutEditor__RectangleTool__. It is the one placing tool
//   that is also handed the release, which is what lets a rectangle be
//   dragged out. What it writes is an ordinary closed shape, so the vertex
//   grips edit its corners like any polygon's.
// - While the Draw or Dimension tool is placing a point the arrows lock
//   the axis instead of nudging: left or right the X, up or down the Y,
//   the same key again to release, as in SketchUp LayOut.
// - A right click that did not pan opens the context menu for what is
//   under the cursor, in the same order as selection.
// - Read-only sessions (the web build) still select and inspect; every
//   mutation is gated on the editable flag.
//
// INTEGRATION:
// - Attached by the mode controller while the editor is on screen.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__SheetTools__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 13-Sep-2026 - Version 1.9.1
// - The shape defaults carry the gradient: gradientOn and its settings, seeded
//   from Na__LayoutEditor__GradientTool__ and kept through the toggle.
//
// 13-Sep-2026 - Version 1.9.0
// - Viewports move by a point: hover a 2D viewport's linework and the snap
//   marker shows the point a press would carry it by; the drag snaps that
//   point onto other drawings and tracks level or plumb with points rested on
//   (Na__LayoutEditor__ViewportSnapMove__). Handles, content editing and locks
//   win over it, and snapping off gives back the plain move.
// - Ctrl+C, Ctrl+V and Ctrl+D copy, paste and duplicate a viewport, and the
//   right-click menu offers the same (Na__LayoutEditor__ViewportClipboard__).
//   Paste from the menu on bare paper lands at the click.
// - A Ctrl chord (undo, redo, copy, paste, duplicate) is no longer swallowed
//   when a select or a checkbox has the focus. Ctrl+Z straight after choosing
//   a scene in the Viewport panel used to do nothing: the select kept the key.
//
// 13-Sep-2026 - Version 1.8.0
// - The Rectangle tool (R) joins the tool list. Na__LayoutEditor__RectangleTool__
//   draws it; this module hands it the press, the move and - new for a placing
//   tool - the release, so a rectangle can be dragged out as well as clicked.
//   The stage captures the pointer for it, so a drag that leaves the stage
//   still comes back up here.
// - Escape, Space, a right click, a second finger or another tool abandons a
//   half-drawn rectangle. The arrow keys are swallowed while one is drawn
//   rather than nudging whatever was selected before it.
//
// 13-Sep-2026 - Version 1.7.0
// - Grip drags pass their own vertex or dimension end to the snap as an
//   exclusion, now that the sheet's vectors and dimensions are candidates.
//
// 12-Sep-2026 - Version 1.6.0
// - The Eyedropper tool (B) joins the tool list: Na__LayoutEditor__Eyedropper__
//   owns the picking and the painting, this module owns the slot, the pointer
//   and the keys. B with something selected arms it already loaded.
// - Escape is staged one step deeper: it empties the dropper before it clears
//   the selection.
// - Copy and Paste properties on the context menu drive the same dropper.
//
// 10-Sep-2026 - Version 1.5.0
// - The arrow keys lock the drawing axis while a tool is placing a point
//   (Na__LayoutEditor__AxisLock__), and nudge the selection otherwise.
// - The shape defaults carry the edges-on flag.
//
// 10-Sep-2026 - Version 1.4.0
// - Placement and inline editing moved out to Na__LayoutEditor__TextTool__, __DimensionTool__ and __ShapeTool__.
// - Selection order is dimensions, then text, then shapes, then viewports; the context menu follows it.
// - Space clears the selection; Enter finishes a shape; L picks the Draw tool.
// - Dimension grips through Na__LayoutEditor__Grips__; the round grip slides the line with inference; double-click edits the value.
// - Shapes select, move, nudge, delete, and drag by the vertex.
//
// 10-Sep-2026 - Version 1.3.0
// - A drag moves a viewport at once; every handle crops or extends; double-click enters the content (drag repositions the drawing).
// - Locked viewports cannot be entered, moved, resized, nudged or deleted.
// - Right-click opens the context menu (edit content, recentre, lock, delete, undo, redo, zoom, snapping).
// - Ctrl+Z and Ctrl+Y through Na__LayoutEditor__History__.
//
// 10-Sep-2026 - Version 1.2.0
// - Dimension placement and endpoint drags snap to the linework through Na__LayoutEditor__Snapping__; F3 toggles it.
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 5.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Surface, Handles, Markup, Grips, Tools, Viewports
    // ------------------------------------------------------------
    import {
        Na__LeCfg__GetTextSetup,
        Na__LeCfg__GetDimensionSetup,
        Na__LeCfg__GetShapeSetup,
        Na__LeCfg__GetEyedropperSetup,
        Na__LeCfg__GetSelectionSetup,
        Na__LeCfg__GetLabel,
        Na__LeCfg__GetKeyboardSetup,
        Na__LeCfg__MatchKeyBinding,
        Na__LeCfg__GetGuards
    } from './Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__KIND_2D,
        Na__LeModel__CHANGED_EVENT,
        Na__LeModel__GetActiveSheet,
        Na__LeModel__GetViewportById,
        Na__LeModel__IsLayerVisible,
        Na__LeModel__IsLayerLocked,
        Na__LeModel__UpdateViewport,
        Na__LeModel__DeleteViewport,
        Na__LeModel__UpdateAnnotation,
        Na__LeModel__DeleteAnnotation,
        Na__LeModel__UpdateDimension,
        Na__LeModel__DeleteDimension,
        Na__LeModel__UpdateShape,
        Na__LeModel__DeleteShape,
        Na__LeModel__SetSelection,
        Na__LeModel__GetSelection
    } from './Na__LayoutEditor__SheetModel__.js';
    import {
        Na__LeSurface__ZOOM_EVENT,
        Na__LeSurface__ClientToPaperMm,
        Na__LeSurface__GetElements,
        Na__LeSurface__GetPixelsPerMm,
        Na__LeSurface__GetZoom,
        Na__LeSurface__Refresh,
        Na__LeSurface__GetEditingViewport,
        Na__LeSurface__SetEditingViewport
    } from './Na__LayoutEditor__SheetSurface__.js';
    import {
        Na__LeHandles__HitTest,
        Na__LeHandles__Contains,
        Na__LeHandles__CursorFor,
        Na__LeHandles__CaptureStart,
        Na__LeHandles__DragPatch,
        Na__LeHandles__FrontToBack
    } from './Na__LayoutEditor__ViewportHandles__.js';
    import { Na__LeMarkup__HitTest } from './Na__LayoutEditor__MarkupBridge__.js';
    import { Na__LeGrips__DimensionGrab, Na__LeGrips__ShapeGrab } from './Na__LayoutEditor__Grips__.js';
    import { Na__LeShapeGeo__Points, Na__LeShapeGeo__Translated } from './Na__LayoutEditor__ShapeGeometry__.js';
    import { Na__LeText__Place, Na__LeText__BeginEdit, Na__LeText__Commit, Na__LeText__Cancel, Na__LeText__IsEditing } from './Na__LayoutEditor__TextTool__.js';
    import { Na__LeDim__Click, Na__LeDim__Move, Na__LeDim__Cancel, Na__LeDim__IsPlacing, Na__LeDim__IsSpanning, Na__LeDim__OffsetFor, Na__LeDim__ShowInference, Na__LeDim__BeginTextEdit } from './Na__LayoutEditor__DimensionTool__.js';
    import { Na__LeShape__Click, Na__LeShape__Move, Na__LeShape__Finish, Na__LeShape__Cancel, Na__LeShape__IsDrawing } from './Na__LayoutEditor__ShapeTool__.js';
    import { Na__LeGrad__Defaults, Na__LeGrad__Create } from './Na__LayoutEditor__GradientTool__.js';
    import { Na__LeRect__Press, Na__LeRect__Move, Na__LeRect__Release, Na__LeRect__Cancel, Na__LeRect__IsDrawing } from './Na__LayoutEditor__RectangleTool__.js';
    import { Na__LeDrop__Click, Na__LeDrop__Hover, Na__LeDrop__Refresh, Na__LeDrop__Clear, Na__LeDrop__Pick, Na__LeDrop__Paint, Na__LeDrop__HasSource, Na__LeDrop__CanApply } from './Na__LayoutEditor__Eyedropper__.js';
    import { Na__LeAxis__AXIS_X, Na__LeAxis__AXIS_Y, Na__LeAxis__Toggle, Na__LeAxis__Clear } from './Na__LayoutEditor__AxisLock__.js';
    import { Na__LeVp2d__SetInteracting, Na__LeVp2d__CentreOnDrawing } from './Na__LayoutEditor__Viewport2d__.js';
    import { Na__LeVp3d__SetInteracting } from './Na__LayoutEditor__Viewport3d__.js';
    import { Na__LeOsnap__Snap, Na__LeOsnap__HideMarker, Na__LeOsnap__Toggle, Na__LeOsnap__IsEnabled } from './Na__LayoutEditor__Snapping__.js';
    import { Na__LeVpMove__GrabAt, Na__LeVpMove__Hover, Na__LeVpMove__Solve, Na__LeVpMove__Finish, Na__LeVpMove__Clear, Na__LeVpMove__Refresh } from './Na__LayoutEditor__ViewportSnapMove__.js';
    import { Na__LeClip__RunKeyAction, Na__LeClip__MenuItems } from './Na__LayoutEditor__ViewportClipboard__.js';
    import { Na__LeNav__Fit } from './Na__LayoutEditor__Navigation__.js';
    import { Na__LeHist__CanUndo, Na__LeHist__CanRedo, Na__LeHist__Undo, Na__LeHist__Redo } from './Na__LayoutEditor__History__.js';
    import { Na__LeMenu__Open, Na__LeMenu__Close } from './Na__LayoutEditor__ContextMenu__.js';
    import { Na__LeForce__IsRunning, Na__LeForce__Viewport, Na__LeForce__Sheet } from './Na__LayoutEditor__ForceRender__.js';
    import { Na__AppUtils__ConfirmDialog__Show } from '../03__AppUtils/Na__AppUtils__ConfirmDialog.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Tools and Events
    // ------------------------------------------------------------
    const Na__LeTools__TOOL_SELECT    = 'select';
    const Na__LeTools__TOOL_TEXT      = 'text';
    const Na__LeTools__TOOL_DIMENSION = 'dimension';
    const Na__LeTools__TOOL_DRAW      = 'draw';
    const Na__LeTools__TOOL_RECT      = 'rectangle';
    const Na__LeTools__TOOL_EYEDROP   = 'eyedropper';
    const Na__LeTools__TOOLS          = [ Na__LeTools__TOOL_SELECT, Na__LeTools__TOOL_TEXT, Na__LeTools__TOOL_DIMENSION, Na__LeTools__TOOL_DRAW, Na__LeTools__TOOL_RECT, Na__LeTools__TOOL_EYEDROP ];
    const Na__LeTools__CHANGED_EVENT  = 'na-layouteditor-tool-changed';
    const Na__LeTools__MENU_SLOP_PX   = 4;      // <-- A right button that travelled further than this panned, so no menu
    const Na__LeTools__SHEET_CHORDS   = [ 'Edit__Undo', 'Edit__Redo', 'Edit__Copy', 'Edit__Paste', 'Edit__Duplicate' ];   // <-- Still the sheet's from a focused select or checkbox
    const Na__LeTools__NON_TEXT_INPUTS = [ 'checkbox', 'radio', 'range', 'color', 'button', 'submit', 'reset', 'file', 'image' ];
    // ------------------------------------------------------------

    // MODULE VARIABLES | Attachment and Interaction State
    // ------------------------------------------------------------
    let Na__LeTools__Stage      = null;
    let Na__LeTools__Handlers   = null;
    let Na__LeTools__Editable   = false;
    let Na__LeTools__Tool       = Na__LeTools__TOOL_SELECT;
    let Na__LeTools__Drag       = null;    // <-- { kind, id, hit, mode, index, start, startMm, moved, pointerId }
    let Na__LeTools__Suppressed = false;   // <-- Raised by the control modules while a navigation gesture owns the pointer
    let Na__LeTools__RightPress = null;    // <-- { x, y } of the last right-button press
    let Na__LeTools__LastPointMm = null;   // <-- Where the cursor last sat on the paper, so a key can restretch the band
    let Na__LeTools__TextDefaults  = null;
    let Na__LeTools__DimDefaults   = null;
    let Na__LeTools__ShapeDefaults = null;
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
            Na__LeTools__TextDefaults = { text : s.defaultText, sizeMm : s.defaultSizeMm, fontWeight : s.defaultWeight, colour : s.defaultColour, align : 'left', leader : false };
        }
        return Na__LeTools__TextDefaults;
    }
    function Na__LeTools__SetTextDefaults(patch) { Object.assign(Na__LeTools__GetTextDefaults(), patch || {}); }
    function Na__LeTools__GetDimensionDefaults() {
        if (!Na__LeTools__DimDefaults) {
            const s = Na__LeCfg__GetDimensionSetup();
            Na__LeTools__DimDefaults = { textSizeMm : s.defaultTextSizeMm, colour : s.defaultColour, terminator : s.defaultTerminator, offsetMm : s.defaultOffsetMm, precision : s.defaultPrecision, unitsSuffix : s.defaultUnits };
        }
        return Na__LeTools__DimDefaults;
    }
    function Na__LeTools__SetDimensionDefaults(patch) { Object.assign(Na__LeTools__GetDimensionDefaults(), patch || {}); }
    function Na__LeTools__GetShapeDefaults() {
        if (!Na__LeTools__ShapeDefaults) {
            const s = Na__LeCfg__GetShapeSetup();
            Na__LeTools__ShapeDefaults = { strokeColour : s.defaultStrokeColour, strokePt : s.defaultStrokePt, fillColour : s.defaultFillColour, filled : s.defaultFilled, stroked : s.defaultStroked,
                                           gradientOn : Na__LeGrad__Defaults().on === true, gradient : Na__LeGrad__Create() };   // <-- The settings outlive the toggle, so switching it back on restores them
        }
        return Na__LeTools__ShapeDefaults;
    }
    function Na__LeTools__SetShapeDefaults(patch) { Object.assign(Na__LeTools__GetShapeDefaults(), patch || {}); }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Hit Tolerance in Paper Millimetres at the Current Zoom
    // ------------------------------------------------------------
    function Na__LeTools__Tolerance() { return Na__LeCfg__GetSelectionSetup().hitToleranceMm / Na__LeSurface__GetZoom(); }
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
        Na__LeDrop__Clear();
        Na__LeAxis__Clear();
        Na__LeVpMove__Clear();                                               // <-- Tracking points and the carry marker go with the tool
    }
    // ------------------------------------------------------------


    // FUNCTION | The Active Tool
    // ------------------------------------------------------------
    function Na__LeTools__SetTool(tool) {
        const next = Na__LeTools__TOOLS.indexOf(tool) === -1 ? Na__LeTools__TOOL_SELECT : tool;
        if (!Na__LeTools__Editable && next !== Na__LeTools__TOOL_SELECT) return Na__LeTools__Tool;
        Na__LeTools__CancelPlacement();
        Na__LeTools__Tool = next;
        if (Na__LeTools__Stage) Na__LeTools__Stage.style.cursor = Na__LeTools__ToolCursor(next);
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
    // ------------------------------------------------------------
    function Na__LeTools__ToolCursor(tool) {
        if (tool === Na__LeTools__TOOL_SELECT)  return '';
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
    // Pressing B while the eyedropper is already armed does nothing. Going
    // through SetTool would run CancelPlacement and quietly throw away the
    // style being held, which is the last thing a second press should mean.
    // ------------------------------------------------------------
    function Na__LeTools__ArmEyedropper() {
        if (!Na__LeTools__Editable) return Na__LeTools__Tool;
        if (Na__LeTools__Tool === Na__LeTools__TOOL_EYEDROP) return Na__LeTools__Tool;

        const selection = Na__LeModel__GetSelection();
        Na__LeTools__SetTool(Na__LeTools__TOOL_EYEDROP);
        if (selection) Na__LeDrop__Pick(Na__LeModel__GetActiveSheet(), selection.kind, selection.id);
        return Na__LeTools__Tool;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Hit Resolution
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | What the Select Tool Finds Under a Point
    // ------------------------------------------------------------
    // Returns { kind : 'dimension'|'annotation'|'shape'|'viewport', id, hit }
    // or null. Markup wins over viewports, and the markup bridge orders it
    // dimensions, text, shapes.
    // ------------------------------------------------------------
    function Na__LeTools__Resolve(sheet, pointMm) {
        const markup = Na__LeMarkup__HitTest(sheet, pointMm, Na__LeTools__Tolerance());
        if (markup) return { kind : markup.kind, id : markup.id, hit : null };
        const ppm  = Na__LeSurface__GetPixelsPerMm();
        const zoom = Na__LeSurface__GetZoom();
        const selection = Na__LeModel__GetSelection();
        const selected  = (selection && selection.kind === 'viewport') ? Na__LeModel__GetViewportById(sheet, selection.id) : null;
        if (selected && Na__LeModel__IsLayerVisible(sheet, selected.Viewport__LayerId)) {
            const hit = Na__LeHandles__HitTest(selected, pointMm, ppm, zoom, true);
            if (hit) return { kind : 'viewport', id : selected.Viewport__Id, hit : hit };
        }
        const ordered = Na__LeHandles__FrontToBack(sheet);
        for (let i = 0; i < ordered.length; i++) {
            if (Na__LeHandles__Contains(ordered[i], pointMm)) return { kind : 'viewport', id : ordered[i].Viewport__Id, hit : null };
        }
        return null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Records Behind a Resolved Hit
    // ------------------------------------------------------------
    function Na__LeTools__Record(sheet, found) {
        if (!found) return null;
        if (found.kind === 'annotation') return sheet.Sheet__Annotations.find((a) => a.Annotation__Id === found.id) || null;
        if (found.kind === 'dimension')  return sheet.Sheet__Dimensions.find((d) => d.Dimension__Id === found.id) || null;
        if (found.kind === 'shape')      return sheet.Sheet__Shapes.find((s) => s.Shape__Id === found.id) || null;
        return Na__LeModel__GetViewportById(sheet, found.id);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Viewport Is Locked by Its Own Flag or by Its Layer
    // ------------------------------------------------------------
    function Na__LeTools__IsViewportLocked(sheet, viewport) {
        return !!viewport && (viewport.Viewport__Locked === true || Na__LeModel__IsLayerLocked(sheet, viewport.Viewport__LayerId));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Cursor for What Is Under the Pointer
    // ------------------------------------------------------------
    function Na__LeTools__HoverCursor(sheet, found, pointMm) {
        if (!found) return '';
        const record = Na__LeTools__Record(sheet, found);
        if (!record || !Na__LeTools__Editable) return 'default';
        const tol = Na__LeTools__Tolerance();
        if (found.kind === 'annotation') return Na__LeModel__IsLayerLocked(sheet, record.Annotation__LayerId) ? 'default' : 'move';
        if (found.kind === 'dimension') {
            if (Na__LeModel__IsLayerLocked(sheet, record.Dimension__LayerId)) return 'default';
            return Na__LeGrips__DimensionGrab(record, pointMm, tol) === 'whole' ? 'move' : 'crosshair';
        }
        if (found.kind === 'shape') {
            if (Na__LeModel__IsLayerLocked(sheet, record.Shape__LayerId)) return 'default';
            return Na__LeGrips__ShapeGrab(record, pointMm, tol).mode === 'whole' ? 'move' : 'crosshair';
        }
        if (Na__LeTools__IsViewportLocked(sheet, record)) return 'default';
        if (Na__LeSurface__GetEditingViewport() === found.id) return 'grab';
        if (found.hit && found.hit.mode === 'handle') return Na__LeHandles__CursorFor(found.hit);
        return 'move';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Viewport a Press Here May Carry by a Point, or Null
    // ------------------------------------------------------------
    // Everything that already owns a press on a viewport wins over the carry:
    // a handle crops, content editing pans the drawing, a lock refuses. Only a
    // press that would otherwise have moved the frame the plain way is offered
    // to the snap move.
    // ------------------------------------------------------------
    function Na__LeTools__CarryTarget(sheet, found) {
        if (!Na__LeTools__Editable || !found || found.kind !== 'viewport') return null;
        if (found.hit && found.hit.mode === 'handle') return null;
        if (Na__LeSurface__GetEditingViewport() === found.id) return null;
        const viewport = Na__LeModel__GetViewportById(sheet, found.id);
        return (viewport && !Na__LeTools__IsViewportLocked(sheet, viewport)) ? viewport : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Pointer Handling
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Is the Event a Left Press on the Paper Area
    // ------------------------------------------------------------
    function Na__LeTools__IsLeft(event) { return event.button === 0 || (event.pointerType === 'touch'); }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Drag a Press on a Resolved Item Starts (null when it cannot move)
    // ------------------------------------------------------------
    function Na__LeTools__DragFor(sheet, found, pointMm) {
        const record = Na__LeTools__Record(sheet, found);
        if (!record) return null;
        const tol = Na__LeTools__Tolerance();
        if (found.kind === 'annotation') {
            if (Na__LeModel__IsLayerLocked(sheet, record.Annotation__LayerId)) return null;
            return { kind : 'annotation', id : found.id, start : { x : record.Annotation__PosXMm, y : record.Annotation__PosYMm } };
        }
        if (found.kind === 'dimension') {
            if (Na__LeModel__IsLayerLocked(sheet, record.Dimension__LayerId)) return null;
            return { kind : 'dimension', id : found.id, mode : Na__LeGrips__DimensionGrab(record, pointMm, tol),
                     start : { sx : record.Dimension__StartXMm, sy : record.Dimension__StartYMm, ex : record.Dimension__EndXMm, ey : record.Dimension__EndYMm, offset : record.Dimension__OffsetMm } };
        }
        if (found.kind === 'shape') {
            if (Na__LeModel__IsLayerLocked(sheet, record.Shape__LayerId)) return null;
            const grab = Na__LeGrips__ShapeGrab(record, pointMm, tol);
            return { kind : 'shape', id : found.id, mode : grab.mode, index : grab.index, start : Na__LeShapeGeo__Points(record).map((p) => [ p[0], p[1] ]) };
        }
        // VIEWPORT | A drag moves it, a handle crops it, and while its content
        // is being edited (double-click) a drag inside moves the drawing instead.
        if (Na__LeTools__IsViewportLocked(sheet, record)) return null;
        const editing = Na__LeSurface__GetEditingViewport() === found.id;
        const hit     = editing ? { mode : 'body' } : ((found.hit && found.hit.mode === 'handle') ? found.hit : { mode : 'border' });
        // A press on a point of its own linework carries the viewport by that
        // point (Na__LayoutEditor__ViewportSnapMove__); anywhere else moves the
        // frame the plain way.
        const carry   = Na__LeTools__CarryTarget(sheet, found);
        const grab    = carry ? Na__LeVpMove__GrabAt(sheet, carry, pointMm) : null;
        return { kind : 'viewport', id : found.id, hit : hit, start : Na__LeHandles__CaptureStart(record), baseMm : grab ? { x : grab.x, y : grab.y } : null };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Pointer Down
    // ------------------------------------------------------------
    function Na__LeTools__OnDown(event) {
        Na__LeMenu__Close();
        if (event.button === 2) { Na__LeTools__RightPress = { x : event.clientX, y : event.clientY }; return; }   // <-- Remembered so a right click that did not pan opens the menu
        if (Na__LeTools__Suppressed) return;                                 // <-- A pan or a pinch owns this pointer
        if (!Na__LeTools__IsLeft(event)) return;
        const sheet = Na__LeModel__GetActiveSheet();
        const point = Na__LeSurface__ClientToPaperMm(event.clientX, event.clientY);
        if (!sheet || !point) return;
        if (Na__LeText__IsEditing()) Na__LeText__Commit();

        if (Na__LeTools__Editable) {
            if (Na__LeTools__Tool === Na__LeTools__TOOL_TEXT)      { Na__LeText__Place(sheet, point, Na__LeTools__GetTextDefaults()); return; }
            if (Na__LeTools__Tool === Na__LeTools__TOOL_DIMENSION) { Na__LeDim__Click(sheet, point, event.shiftKey, Na__LeTools__GetDimensionDefaults()); return; }
            if (Na__LeTools__Tool === Na__LeTools__TOOL_DRAW)      { Na__LeShape__Click(sheet, point, event.shiftKey, Na__LeTools__GetShapeDefaults()); return; }

            // RECTANGLE | The press sets or lands a corner. The pointer is
            // captured so a rectangle dragged out past the edge of the stage
            // still delivers its release here, where it lands the far corner.
            // ------------------------------------
            if (Na__LeTools__Tool === Na__LeTools__TOOL_RECT) {
                Na__LeRect__Press(sheet, point, event.shiftKey, Na__LeTools__GetShapeDefaults(), event.pointerId);
                try { Na__LeTools__Stage.setPointerCapture(event.pointerId); } catch (e) { /* capture refused */ }
                return;
            }

            // EYEDROPPER | Pick the style, then paint it, without ever selecting
            // or dragging. Selection is left untouched on purpose: the dropper's
            // own boxes say what it is holding and what it is over, and moving
            // the selection under a run of style clicks would keep swapping the
            // right-hand panel out from under the user.
            // ------------------------------------
            if (Na__LeTools__Tool === Na__LeTools__TOOL_EYEDROP) {
                event.preventDefault();
                const picked = Na__LeTools__Resolve(sheet, point);
                Na__LeDrop__Click(sheet, picked, !!event.altKey);
                Na__LeTools__Stage.style.cursor = Na__LeDrop__Hover(sheet, picked);   // <-- The click changed what this item means
                return;
            }
        }

        const found     = Na__LeTools__Resolve(sheet, point);
        const editingId = Na__LeSurface__GetEditingViewport();
        if (editingId && (!found || found.kind !== 'viewport' || found.id !== editingId)) Na__LeSurface__SetEditingViewport(null);   // <-- A press anywhere else finishes content editing
        if (!found) { Na__LeModel__SetSelection(null); return; }
        const selection   = Na__LeModel__GetSelection();
        const wasSelected = !!selection && selection.kind === found.kind && selection.id === found.id;
        if (!wasSelected) Na__LeModel__SetSelection({ kind : found.kind, id : found.id });
        if (!Na__LeTools__Editable) return;

        const drag = Na__LeTools__DragFor(sheet, found, point);
        if (!drag) return;
        drag.startMm   = point;
        drag.moved     = false;
        drag.pointerId = event.pointerId;
        Na__LeTools__Drag = drag;
        Na__LeTools__Stage.setPointerCapture(event.pointerId);
        event.preventDefault();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Pointer Move: Placement Preview, Drag, or Hover Cursor
    // ------------------------------------------------------------
    function Na__LeTools__OnMove(event) {
        const sheet = Na__LeModel__GetActiveSheet();
        const point = Na__LeSurface__ClientToPaperMm(event.clientX, event.clientY);
        if (!sheet || !point) return;
        Na__LeTools__LastPointMm = point;                                    // <-- An arrow key restretches the band from here

        const drag = Na__LeTools__Drag;
        if (!drag || event.pointerId !== drag.pointerId) {
            if (Na__LeTools__Editable && Na__LeTools__Tool === Na__LeTools__TOOL_DIMENSION) { Na__LeDim__Move(sheet, point, event.shiftKey); return; }
            if (Na__LeTools__Editable && Na__LeTools__Tool === Na__LeTools__TOOL_DRAW)      { Na__LeShape__Move(sheet, point, event.shiftKey); return; }
            if (Na__LeTools__Editable && Na__LeTools__Tool === Na__LeTools__TOOL_RECT)      { Na__LeRect__Move(sheet, point, event.shiftKey, (event.buttons & 1) === 1 || event.pointerType === 'touch'); return; }
            if (Na__LeTools__Editable && Na__LeTools__Tool === Na__LeTools__TOOL_EYEDROP)   { Na__LeTools__Stage.style.cursor = Na__LeDrop__Hover(sheet, Na__LeTools__Resolve(sheet, point)); return; }
            if (Na__LeTools__Tool !== Na__LeTools__TOOL_SELECT) return;
            const found = Na__LeTools__Resolve(sheet, point);
            const grab  = Na__LeVpMove__Hover(sheet, Na__LeTools__CarryTarget(sheet, found), point);   // <-- Marks the point a press would carry the viewport by
            Na__LeTools__Stage.style.cursor = grab ? 'crosshair' : Na__LeTools__HoverCursor(sheet, found, point);
            return;
        }
        const dMm = { x : point.x - drag.startMm.x, y : point.y - drag.startMm.y };
        if (!drag.moved) {
            if (Math.hypot(dMm.x, dMm.y) < Na__LeCfg__GetSelectionSetup().dragThresholdMm / Na__LeSurface__GetZoom()) return;
            drag.moved = true;
            Na__LeVp2d__SetInteracting(true);
            Na__LeVp3d__SetInteracting(true);
            document.body.classList.add('na-le-dragging');
        }
        Na__LeTools__ApplyDrag(sheet, drag, dMm, event.shiftKey);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Apply a Drag Delta Through the Model (silent)
    // ------------------------------------------------------------
    function Na__LeTools__ApplyDrag(sheet, drag, dMm, shift) {
        const cursor = { x : drag.startMm.x + dMm.x, y : drag.startMm.y + dMm.y };
        const d = shift ? (Math.abs(dMm.x) >= Math.abs(dMm.y) ? { x : dMm.x, y : 0 } : { x : 0, y : dMm.y }) : dMm;
        if (drag.kind === 'viewport') {
            const viewport = Na__LeModel__GetViewportById(sheet, drag.id);
            if (!viewport) return;
            // CARRIED BY A POINT | The snap move says where the grabbed point
            // goes; the frame moves by however far that is from where it began.
            const carried = drag.baseMm ? Na__LeVpMove__Solve(sheet, drag, cursor, shift) : null;
            const moveBy  = carried ? { x : carried.x - drag.baseMm.x, y : carried.y - drag.baseMm.y } : dMm;
            const patch = Na__LeHandles__DragPatch(viewport, drag.hit, drag.start, moveBy, { shift : shift });
            if (!patch) return;
            Na__LeModel__UpdateViewport(sheet, drag.id, patch, true);
            Na__LeSurface__Refresh('frames');
            return;
        }
        if (drag.kind === 'annotation') {
            Na__LeModel__UpdateAnnotation(sheet, drag.id, { posXMm : drag.start.x + d.x, posYMm : drag.start.y + d.y }, true);
            Na__LeSurface__Refresh('markup');
            return;
        }
        if (drag.kind === 'shape') {
            let points;
            if (drag.mode === 'vertex') {
                const snap  = Na__LeOsnap__Snap(sheet, cursor, { kind : 'shape', id : drag.id, index : drag.index });   // <-- A vertex jumps to a corner or a midpoint, never its own
                const p0    = drag.start[drag.index];
                const moved = snap.snapped ? [ snap.x, snap.y ] : [ p0[0] + d.x, p0[1] + d.y ];
                points = drag.start.map((p, i) => (i === drag.index ? moved : [ p[0], p[1] ]));
            } else points = Na__LeShapeGeo__Translated(drag.start, d.x, d.y);
            Na__LeModel__UpdateShape(sheet, drag.id, { points : points }, true);
            Na__LeSurface__Refresh('markup');
            return;
        }
        const s = drag.start;
        let patch = null;
        if (drag.mode === 'start' || drag.mode === 'end') {
            const snap = Na__LeOsnap__Snap(sheet, cursor, { kind : 'dimension', id : drag.id, index : drag.mode });   // <-- The grip jumps to a corner or a midpoint, never its own
            const px = snap.snapped ? snap.x : (drag.mode === 'start' ? s.sx : s.ex) + d.x;
            const py = snap.snapped ? snap.y : (drag.mode === 'start' ? s.sy : s.ey) + d.y;
            patch = drag.mode === 'start' ? { startXMm : px, startYMm : py } : { endXMm : px, endYMm : py };
        } else if (drag.mode === 'offset') {
            const dim = sheet.Sheet__Dimensions.find((x) => x.Dimension__Id === drag.id);
            if (!dim) return;
            const result = Na__LeDim__OffsetFor(sheet, dim, cursor);                  // <-- The line lands on a parallel dimension's line when near it
            Na__LeDim__ShowInference(result);
            patch = { offsetMm : result.offsetMm };
        } else patch = { startXMm : s.sx + d.x, startYMm : s.sy + d.y, endXMm : s.ex + d.x, endYMm : s.ey + d.y };
        Na__LeModel__UpdateDimension(sheet, drag.id, patch, true);
        Na__LeSurface__Refresh('markup');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Pointer Up: Announce the Change Once
    // ------------------------------------------------------------
    // The rectangle tool hears the release before any drag is closed. The
    // two never overlap in practice, but a key that swaps tools mid-drag
    // must still leave that drag finished rather than stranded.
    // ------------------------------------------------------------
    function Na__LeTools__OnUp(event) {
        if (Na__LeTools__Editable && Na__LeTools__Tool === Na__LeTools__TOOL_RECT) Na__LeTools__RectangleUp(event);
        const drag = Na__LeTools__Drag;
        if (!drag || event.pointerId !== drag.pointerId) return;
        Na__LeTools__FinishDrag(event.pointerId);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Button Comes Up Over a Rectangle Being Drawn
    // ------------------------------------------------------------
    // A rectangle dragged out from its first corner lands the opposite one
    // where the button lets go. A cancelled pointer - the browser or another
    // gesture took it - lands nothing and abandons the rectangle.
    // ------------------------------------------------------------
    function Na__LeTools__RectangleUp(event) {
        if (event.type === 'pointercancel') { Na__LeRect__Cancel(); return; }
        const sheet = Na__LeModel__GetActiveSheet();
        const point = Na__LeSurface__ClientToPaperMm(event.clientX, event.clientY);
        if (sheet && point) Na__LeRect__Release(sheet, point, event.shiftKey, event.pointerId);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Close a Drag Down and Commit What It Moved
    // ------------------------------------------------------------
    // Shared by the pointer release and by the suppression flag, so a
    // navigation gesture that interrupts a drag still leaves the record
    // committed rather than half moved.
    function Na__LeTools__FinishDrag(pointerId) {
        Na__LeOsnap__HideMarker();
        Na__LeVpMove__Finish();                                              // <-- Frame back to normal, guides away; used-up tracking points go too
        const drag = Na__LeTools__Drag;
        if (!drag) return;
        if (pointerId !== null && pointerId !== undefined && Na__LeTools__Stage) {
            try { Na__LeTools__Stage.releasePointerCapture(pointerId); } catch (e) { /* already released */ }
        }
        Na__LeTools__Drag = null;
        document.body.classList.remove('na-le-dragging');
        if (!drag.moved) return;
        Na__LeVp2d__SetInteracting(false);
        Na__LeVp3d__SetInteracting(false);
        const sheet = Na__LeModel__GetActiveSheet();
        if (!sheet) return;
        if (drag.kind === 'viewport')        Na__LeModel__UpdateViewport(sheet, drag.id, {}, false);
        else if (drag.kind === 'annotation') Na__LeModel__UpdateAnnotation(sheet, drag.id, {}, false);
        else if (drag.kind === 'shape')      Na__LeModel__UpdateShape(sheet, drag.id, {}, false);
        else                                 Na__LeModel__UpdateDimension(sheet, drag.id, {}, false);
    }
    // ------------------------------------------------------------


    // FUNCTION | Hand the Pointer Over to a Navigation Gesture
    // ------------------------------------------------------------
    // The PC and touchscreen control modules raise this while a pan or a
    // pinch owns the pointer. Any drag in flight is finished first, so a
    // second finger landing on the stage can never leave a viewport stranded
    // half way through a move.
    function Na__LeTools__SetSuppressed(flag) {
        const next = !!flag;
        if (Na__LeTools__Suppressed === next) return;
        Na__LeTools__Suppressed = next;
        if (next) {
            Na__LeTools__FinishDrag(Na__LeTools__Drag ? Na__LeTools__Drag.pointerId : null);
            Na__LeTools__CancelPlacement();
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Double Click: Finish a Shape, Edit Text or a Value, or Enter a Viewport's Content
    // ------------------------------------------------------------
    function Na__LeTools__OnDoubleClick(event) {
        if (!Na__LeTools__Editable || event.button !== 0) return;
        const sheet = Na__LeModel__GetActiveSheet();
        const point = Na__LeSurface__ClientToPaperMm(event.clientX, event.clientY);
        if (!sheet || !point) return;
        if (Na__LeTools__Tool === Na__LeTools__TOOL_DRAW) { if (Na__LeShape__IsDrawing()) { event.preventDefault(); Na__LeShape__Finish(sheet, false); } return; }
        if (Na__LeTools__Tool !== Na__LeTools__TOOL_SELECT) return;
        const markup = Na__LeMarkup__HitTest(sheet, point, Na__LeTools__Tolerance());
        if (markup) {
            if (markup.kind === 'annotation')     Na__LeText__BeginEdit(markup.id);
            else if (markup.kind === 'dimension') Na__LeDim__BeginTextEdit(markup.id);
            return;
        }
        const found = Na__LeTools__Resolve(sheet, point);
        if (!found || found.kind !== 'viewport') return;
        event.preventDefault();
        Na__LeTools__SetEditingViewport(Na__LeSurface__GetEditingViewport() === found.id ? null : found.id);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Content Editing and the Context Menu
// -----------------------------------------------------------------------------

    // FUNCTION | Enter or Leave Content Editing on a Viewport (double-click)
    // ------------------------------------------------------------
    // While a viewport's content is being edited a drag inside it moves the
    // drawing (2D: the window pans; 3D: the picture slides) and the frame
    // stays where it is. Null leaves the mode.
    // ------------------------------------------------------------
    function Na__LeTools__SetEditingViewport(viewportId) {
        const sheet    = Na__LeModel__GetActiveSheet();
        const viewport = (sheet && viewportId) ? Na__LeModel__GetViewportById(sheet, viewportId) : null;
        if (viewport && (!Na__LeTools__Editable || Na__LeTools__IsViewportLocked(sheet, viewport))) return false;
        if (viewport) {
            const selection = Na__LeModel__GetSelection();
            if (!selection || selection.kind !== 'viewport' || selection.id !== viewportId) Na__LeModel__SetSelection({ kind : 'viewport', id : viewportId });
        }
        Na__LeSurface__SetEditingViewport(viewport ? viewportId : null);
        if (Na__LeTools__Stage) Na__LeTools__Stage.style.cursor = viewport ? 'grab' : '';
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put the Drawing Back in the Middle of Its Frame
    // ------------------------------------------------------------
    function Na__LeTools__RecentreViewport(sheet, viewportId) {
        const viewport = Na__LeModel__GetViewportById(sheet, viewportId);
        if (!viewport || Na__LeTools__IsViewportLocked(sheet, viewport)) return false;
        if (viewport.Viewport__Kind === Na__LeModel__KIND_2D) Na__LeVp2d__CentreOnDrawing(sheet, viewport);
        else Na__LeModel__UpdateViewport(sheet, viewportId, { imageOffset : { X : 0, Y : 0 } }, true);
        return Na__LeModel__UpdateViewport(sheet, viewportId, {}, false);      // <-- One announcement: one history step
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Menu for What Was Right-Clicked
    // ------------------------------------------------------------
    function Na__LeTools__MenuItems(sheet, found, pointMm) {
        const label   = (key, fallback) => Na__LeCfg__GetLabel(key, fallback);
        const remove  = (key, fallback) => ({ label : label(key, fallback), danger : true, onSelect : () => { void Na__LeTools__DeleteSelection(); } });

        // STYLE | The eyedropper reached without the hotkey. Copy loads the
        // same dropper the B key uses, so a copy here can be pasted by menu,
        // by clicking with the tool, or both.
        // ------------------------------------
        const style = (kind, id) => [
            { label : label('MenuCopyStyle', 'Copy properties'), onSelect : () => Na__LeDrop__Pick(sheet, kind, id) },
            { label : label('MenuPasteStyle', 'Paste properties'), disabled : !Na__LeDrop__CanApply(sheet, kind, id).ok,
              onSelect : () => Na__LeDrop__Paint(sheet, kind, id) },
            { separator : true }
        ];

        const history = [
            { label : label('Undo', 'Undo'), disabled : !Na__LeHist__CanUndo(), onSelect : () => Na__LeHist__Undo() },
            { label : label('Redo', 'Redo'), disabled : !Na__LeHist__CanRedo(), onSelect : () => Na__LeHist__Redo() }
        ];
        if (!Na__LeTools__Editable) return [ { label : label('MenuZoomFit', 'Zoom to fit'), onSelect : () => Na__LeNav__Fit() } ];
        if (!found) {
            const snapping = Na__LeOsnap__IsEnabled();
            return [
                { label : label('MenuZoomFit', 'Zoom to fit'), onSelect : () => Na__LeNav__Fit() },
                { label : snapping ? label('MenuSnapOff', 'Snapping off') : label('MenuSnapOn', 'Snapping on'), checked : snapping, onSelect : () => Na__LeOsnap__Toggle() },
                { separator : true }
            ].concat(Na__LeClip__MenuItems(sheet, null, pointMm), [                  // <-- Paste viewport, with its corner at the click
                { separator : true },
                { label : label('MenuForceRenderSheet', 'Re-render every viewport on this sheet'), disabled : Na__LeForce__IsRunning(),
                  onSelect : () => { void Na__LeForce__Sheet(sheet); } },
                { separator : true }
            ]).concat(history);
        }
        if (found.kind === 'annotation') {
            return [ { label : label('MenuEditText', 'Edit text'), onSelect : () => Na__LeText__BeginEdit(found.id) },
                     remove('MenuDeleteText', 'Delete text'), { separator : true } ]
                     .concat(style(found.kind, found.id)).concat(history);
        }
        if (found.kind === 'dimension') {
            return [ { label : label('MenuEditDimText', 'Edit dimension value'), onSelect : () => Na__LeDim__BeginTextEdit(found.id) },
                     remove('MenuDeleteDimension', 'Delete dimension'), { separator : true } ]
                     .concat(style(found.kind, found.id)).concat(history);
        }
        if (found.kind === 'shape') {
            const shape  = Na__LeTools__Record(sheet, found);
            const closed = !!shape && shape.Shape__Closed === true;
            return [ { label : closed ? label('MenuOpenShape', 'Open shape') : label('MenuCloseShape', 'Close shape'), disabled : !shape || Na__LeShapeGeo__Points(shape).length < 3,
                       onSelect : () => Na__LeModel__UpdateShape(sheet, found.id, { closed : !closed }) },
                     remove('MenuDeleteShape', 'Delete shape'), { separator : true } ]
                     .concat(style(found.kind, found.id)).concat(history);
        }

        const viewport = Na__LeModel__GetViewportById(sheet, found.id);
        if (!viewport) return history;
        const layerLocked = Na__LeModel__IsLayerLocked(sheet, viewport.Viewport__LayerId);
        const locked      = layerLocked || viewport.Viewport__Locked === true;
        const editing     = Na__LeSurface__GetEditingViewport() === found.id;
        const del         = remove('MenuDeleteViewport', 'Delete viewport');
        del.disabled = locked;
        return [
            { label : editing ? label('MenuFinishView', 'Finish editing content') : label('MenuEditView', 'Edit viewport content'), disabled : locked, onSelect : () => Na__LeTools__SetEditingViewport(editing ? null : found.id) },
            { label : label('MenuCentre', 'Recentre content'), disabled : locked, onSelect : () => Na__LeTools__RecentreViewport(sheet, found.id) },
            { label : viewport.Viewport__Locked === true ? label('MenuUnlock', 'Unlock viewport') : label('MenuLock', 'Lock viewport'), disabled : layerLocked, checked : viewport.Viewport__Locked === true,
              onSelect : () => Na__LeModel__UpdateViewport(sheet, found.id, { locked : viewport.Viewport__Locked !== true }) },
            { separator : true }
        ].concat(Na__LeClip__MenuItems(sheet, viewport, pointMm), [                  // <-- Copy, duplicate and paste viewport
            { separator : true },
            // BOTH SCOPES ARE OFFERED ON A VIEWPORT, not just its own. Half the
            // time the frame under the cursor is simply the one nearest the
            // hand, and the thing actually wanted is the whole sheet; making
            // that require a right click on empty paper would be a small,
            // regular annoyance on a sheet that is mostly viewports.
            { label : label('MenuForceRenderViewport', 'Re-render this viewport'), disabled : Na__LeForce__IsRunning(),
              onSelect : () => { void Na__LeForce__Viewport(sheet, found.id); } },
            { label : label('MenuForceRenderSheet', 'Re-render every viewport on this sheet'), disabled : Na__LeForce__IsRunning(),
              onSelect : () => { void Na__LeForce__Sheet(sheet); } },
            { separator : true }, del, { separator : true }
        ]).concat(history);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Right Click: Finish or Cancel a Placement, Else Select and Open the Menu
    // ------------------------------------------------------------
    // The PC controls pan on a right drag, so the menu only opens when the
    // button came up where it went down. A touch long-press arrives here
    // with no press recorded and opens the menu too.
    // ------------------------------------------------------------
    function Na__LeTools__OnContextMenu(event) {
        const target = event.target;
        if (target && typeof target.closest === 'function' && target.closest(Na__LeCfg__GetGuards().contextMenuKeepSelector)) return;   // <-- The inline text field keeps the browser menu
        event.preventDefault();
        const press = Na__LeTools__RightPress;
        Na__LeTools__RightPress = null;
        if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > Na__LeTools__MENU_SLOP_PX) return;   // <-- That right button panned
        const sheet = Na__LeModel__GetActiveSheet();
        const point = Na__LeSurface__ClientToPaperMm(event.clientX, event.clientY);
        if (!sheet || !point) return;
        if (Na__LeShape__IsDrawing()) { Na__LeShape__Finish(sheet, false); return; }   // <-- As in CAD, a right click ends the line
        if (Na__LeDim__IsPlacing())   { Na__LeDim__Cancel(sheet); return; }
        if (Na__LeRect__IsDrawing())  { Na__LeRect__Cancel(); return; }        // <-- A rectangle has no half worth keeping
        if (Na__LeText__IsEditing()) Na__LeText__Commit();
        const found = Na__LeTools__Resolve(sheet, point);
        Na__LeModel__SetSelection(found ? { kind : found.kind, id : found.id } : null);
        Na__LeMenu__Open(event.clientX, event.clientY, Na__LeTools__MenuItems(sheet, found, point));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Keyboard
// -----------------------------------------------------------------------------

    // FUNCTION | Delete Whatever Is Selected (a viewport asks first)
    // ------------------------------------------------------------
    async function Na__LeTools__DeleteSelection() {
        const sheet = Na__LeModel__GetActiveSheet();
        const selection = Na__LeModel__GetSelection();
        if (!sheet || !selection || !Na__LeTools__Editable) return false;
        if (selection.kind === 'annotation') return Na__LeModel__DeleteAnnotation(sheet, selection.id);
        if (selection.kind === 'dimension')  return Na__LeModel__DeleteDimension(sheet, selection.id);
        if (selection.kind === 'shape')      return Na__LeModel__DeleteShape(sheet, selection.id);
        const viewport = Na__LeModel__GetViewportById(sheet, selection.id);
        if (!viewport || Na__LeTools__IsViewportLocked(sheet, viewport)) return false;   // <-- Unlock first
        const ok = await Na__AppUtils__ConfirmDialog__Show({
            title : Na__LeCfg__GetLabel('DeleteViewportTitle', 'Delete viewport'),
            message : Na__LeCfg__GetLabel('DeleteViewportPrompt', 'Remove this viewport from the sheet? Sheet dimensions attached to it keep their paper length.'),
            confirmLabel : Na__LeCfg__GetLabel('DeleteLabel', 'Delete'), isDestructive : true
        });
        return ok ? Na__LeModel__DeleteViewport(sheet, selection.id) : false;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Nudge the Selection by a Millimetre Step
    // ------------------------------------------------------------
    function Na__LeTools__Nudge(dx, dy) {
        const sheet = Na__LeModel__GetActiveSheet();
        const selection = Na__LeModel__GetSelection();
        if (!sheet || !selection) return false;
        const record = Na__LeTools__Record(sheet, selection);
        if (!record) return false;
        if (selection.kind === 'viewport') {
            if (Na__LeTools__IsViewportLocked(sheet, record)) return false;
            return Na__LeModel__UpdateViewport(sheet, selection.id, { rect : { X : record.Viewport__FrameMm.X + dx, Y : record.Viewport__FrameMm.Y + dy } }, false);
        }
        if (selection.kind === 'annotation') {
            if (Na__LeModel__IsLayerLocked(sheet, record.Annotation__LayerId)) return false;
            return Na__LeModel__UpdateAnnotation(sheet, selection.id, { posXMm : record.Annotation__PosXMm + dx, posYMm : record.Annotation__PosYMm + dy }, false);
        }
        if (selection.kind === 'shape') {
            if (Na__LeModel__IsLayerLocked(sheet, record.Shape__LayerId)) return false;
            return Na__LeModel__UpdateShape(sheet, selection.id, { points : Na__LeShapeGeo__Translated(Na__LeShapeGeo__Points(record), dx, dy) }, false);
        }
        if (Na__LeModel__IsLayerLocked(sheet, record.Dimension__LayerId)) return false;
        return Na__LeModel__UpdateDimension(sheet, selection.id, { startXMm : record.Dimension__StartXMm + dx, startYMm : record.Dimension__StartYMm + dy, endXMm : record.Dimension__EndXMm + dx, endYMm : record.Dimension__EndYMm + dy }, false);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | An Arrow Key Locks the Axis While a Tool Is Placing
    // ------------------------------------------------------------
    // Left and right lock the X axis, up and down the Y, as in SketchUp
    // LayOut; the same key again releases it. The lock belongs to the
    // segment being drawn and the tool spends it the moment the point
    // lands. Returns false when nothing is being placed, which leaves the
    // arrow keys nudging the selection as before. A rectangle being drawn
    // swallows them instead: its edges are square to the paper already, and
    // nudging the previous selection out from under it would be a surprise.
    // ------------------------------------------------------------
    function Na__LeTools__AxisKey(axis, shift) {
        if (!Na__LeTools__Editable) return false;
        if (Na__LeRect__IsDrawing()) return true;
        const drawing  = Na__LeShape__IsDrawing();
        const spanning = Na__LeDim__IsSpanning();                            // <-- Only the span phase: the offset phase has no axis to lock
        if (!drawing && !spanning) return false;
        Na__LeAxis__Toggle(axis);
        const sheet = Na__LeModel__GetActiveSheet();
        const point = Na__LeTools__LastPointMm;
        if (sheet && point) {                                                // <-- Show the lock at once rather than on the next move
            if (drawing) Na__LeShape__Move(sheet, point, shift);
            else Na__LeDim__Move(sheet, point, shift);
        }
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is the Focus in a Field That Takes Typed Text
    // ------------------------------------------------------------
    // A text box, a number box, a text area or an editable region: somewhere
    // Ctrl+Z and Ctrl+V already mean something to the field itself.
    // ------------------------------------------------------------
    function Na__LeTools__IsTextEntry(target) {
        if (!target) return false;
        if (target.isContentEditable || target.tagName === 'TEXTAREA') return true;
        if (target.tagName !== 'INPUT') return false;
        return Na__LeTools__NON_TEXT_INPUTS.indexOf(String(target.type || 'text').toLowerCase()) === -1;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Key Handling While the Editor Is on Screen
    // ------------------------------------------------------------
    function Na__LeTools__OnKey(event) {
        const target = event.target;
        const typing = !!(target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable));
        const keys   = Na__LeCfg__GetKeyboardSetup();
        const guard  = typing && keys.ignoreWhenTyping;
        if (guard && Na__LeTools__IsTextEntry(target)) return;               // <-- A text field keeps every key, its own undo and paste included

        // The binding, not the key, decides what happens. Navigation actions
        // are left alone here: the PC controls module owns those.
        const match = Na__LeCfg__MatchKeyBinding(event.key, {
            Ctrl : !!event.ctrlKey, Shift : !!event.shiftKey, Alt : !!event.altKey, Meta : !!event.metaKey, Space : false
        });
        if (!match || !match.action) return;
        // A SELECT OR A CHECKBOX KEEPS ITS BARE KEYS - an arrow or a letter
        // means something to it - but it has no undo or paste of its own, so a
        // Ctrl chord belongs to the sheet. Without this, Ctrl+Z straight after
        // choosing a scene in the Viewport panel went nowhere: the select still
        // had the focus.
        if (guard && Na__LeTools__SHEET_CHORDS.indexOf(match.action) === -1) return;
        const step  = match.coarse ? keys.nudgeCoarseStepMm : keys.nudgeStepMm;
        const sheet = Na__LeModel__GetActiveSheet();

        switch (match.action) {
            case 'Edit__Cancel':
                Na__LeVpMove__Clear();                                                    // <-- Tracking points go, whatever else Esc backs out of
                if (Na__LeDim__IsPlacing() || Na__LeShape__IsDrawing() || Na__LeRect__IsDrawing()) Na__LeTools__CancelPlacement();
                else if (Na__LeDrop__HasSource()) Na__LeDrop__Clear();                    // <-- First Esc empties the dropper, second puts the tool down
                else if (Na__LeSurface__GetEditingViewport()) Na__LeTools__SetEditingViewport(null);
                else if (Na__LeModel__GetSelection()) Na__LeModel__SetSelection(null);
                else Na__LeTools__SetTool(Na__LeTools__TOOL_SELECT);
                event.preventDefault(); return;
            case 'Edit__Deselect':                                                   // <-- Space: a clean slate, whatever was going on
                event.preventDefault();
                Na__LeTools__CancelPlacement();
                if (Na__LeSurface__GetEditingViewport()) Na__LeTools__SetEditingViewport(null);
                Na__LeModel__SetSelection(null);
                return;
            case 'Edit__Finish':
                if (Na__LeShape__IsDrawing() && sheet) { event.preventDefault(); Na__LeShape__Finish(sheet, false); }
                return;
            case 'Edit__Delete':
                if (Na__LeModel__GetSelection()) { event.preventDefault(); void Na__LeTools__DeleteSelection(); }
                return;
            case 'Edit__NudgeLeft':
            case 'Edit__NudgeRight': {
                const dx = match.action === 'Edit__NudgeLeft' ? -step : step;
                if (Na__LeTools__AxisKey(Na__LeAxis__AXIS_X, !!event.shiftKey) || (Na__LeTools__Editable && Na__LeTools__Nudge(dx, 0))) event.preventDefault();
                return;
            }
            case 'Edit__NudgeUp':
            case 'Edit__NudgeDown': {
                const dy = match.action === 'Edit__NudgeUp' ? -step : step;
                if (Na__LeTools__AxisKey(Na__LeAxis__AXIS_Y, !!event.shiftKey) || (Na__LeTools__Editable && Na__LeTools__Nudge(0, dy))) event.preventDefault();
                return;
            }
            case 'Tool__Select':     Na__LeTools__SetTool(Na__LeTools__TOOL_SELECT);    return;
            case 'Tool__Text':       Na__LeTools__SetTool(Na__LeTools__TOOL_TEXT);      return;
            case 'Tool__Dimension':  Na__LeTools__SetTool(Na__LeTools__TOOL_DIMENSION); return;
            case 'Tool__Draw':       Na__LeTools__SetTool(Na__LeTools__TOOL_DRAW);      return;
            case 'Tool__Rectangle':  Na__LeTools__SetTool(Na__LeTools__TOOL_RECT);      return;
            case 'Tool__Eyedropper': Na__LeTools__ArmEyedropper();                      return;
            case 'Snap__Toggle':     Na__LeOsnap__Toggle(); event.preventDefault(); return;
            case 'Edit__Undo':       if (Na__LeTools__Editable) { event.preventDefault(); Na__LeHist__Undo(); } return;
            case 'Edit__Redo':       if (Na__LeTools__Editable) { event.preventDefault(); Na__LeHist__Redo(); } return;
            case 'Edit__Copy':
            case 'Edit__Paste':      if (Na__LeClip__RunKeyAction(match.action, Na__LeTools__Editable)) event.preventDefault(); return;   // <-- Nothing to copy or paste: the browser keeps the key
            case 'Edit__Duplicate':  if (Na__LeTools__Editable) { event.preventDefault(); Na__LeClip__RunKeyAction(match.action, true); } return;   // <-- Never the bookmark dialog while a sheet is open
            default: return;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Attach and Detach
// -----------------------------------------------------------------------------

    // FUNCTION | Listen on the Stage and the Keyboard
    // ------------------------------------------------------------
    function Na__LeTools__Attach(options) {
        const els = Na__LeSurface__GetElements();
        if (!els.stage) return false;
        Na__LeTools__Detach();
        Na__LeTools__Stage    = els.stage;
        Na__LeTools__Editable = !!(options && options.editable);
        Na__LeTools__Handlers = {
            pointerdown   : (e) => Na__LeTools__OnDown(e),
            pointermove   : (e) => Na__LeTools__OnMove(e),
            pointerup     : (e) => Na__LeTools__OnUp(e),
            pointercancel : (e) => Na__LeTools__OnUp(e),
            dblclick      : (e) => Na__LeTools__OnDoubleClick(e),
            contextmenu   : (e) => Na__LeTools__OnContextMenu(e),
            keydown       : (e) => Na__LeTools__OnKey(e),
            dropperdraw   : () => { const sheet = Na__LeModel__GetActiveSheet(); Na__LeDrop__Refresh(sheet); Na__LeVpMove__Refresh(sheet); }   // <-- The eyedropper's boxes and the tracking crosses are counter-scaled, like the grips
        };
        [ 'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'dblclick', 'contextmenu' ].forEach((name) => Na__LeTools__Stage.addEventListener(name, Na__LeTools__Handlers[name]));
        window.addEventListener('keydown', Na__LeTools__Handlers.keydown);
        [ Na__LeSurface__ZOOM_EVENT, Na__LeModel__CHANGED_EVENT ].forEach((name) => window.addEventListener(name, Na__LeTools__Handlers.dropperdraw));
        Na__LeTools__SetTool(Na__LeTools__TOOL_SELECT);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Stop Listening and Drop Any Interaction
    // ------------------------------------------------------------
    function Na__LeTools__Detach() {
        Na__LeMenu__Close();
        Na__LeTools__RightPress  = null;
        Na__LeTools__LastPointMm = null;
        Na__LeText__Cancel();
        Na__LeTools__CancelPlacement();
        if (!Na__LeTools__Stage || !Na__LeTools__Handlers) return;
        [ 'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'dblclick', 'contextmenu' ].forEach((name) => Na__LeTools__Stage.removeEventListener(name, Na__LeTools__Handlers[name]));
        window.removeEventListener('keydown', Na__LeTools__Handlers.keydown);
        [ Na__LeSurface__ZOOM_EVENT, Na__LeModel__CHANGED_EVENT ].forEach((name) => window.removeEventListener(name, Na__LeTools__Handlers.dropperdraw));
        Na__LeTools__Stage.style.cursor = '';
        Na__LeTools__Suppressed = false;                                     // <-- Never leave the tools deaf for the next mount
        Na__LeTools__Stage = Na__LeTools__Handlers = Na__LeTools__Drag = null;
        document.body.classList.remove('na-le-dragging');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Sheet Tools API
    // ------------------------------------------------------------
    export {
        Na__LeTools__TOOL_SELECT,
        Na__LeTools__TOOL_TEXT,
        Na__LeTools__TOOL_DIMENSION,
        Na__LeTools__TOOL_DRAW,
        Na__LeTools__TOOL_RECT,
        Na__LeTools__TOOL_EYEDROP,
        Na__LeTools__CHANGED_EVENT,
        Na__LeTools__Attach,
        Na__LeTools__Detach,
        Na__LeTools__SetTool,
        Na__LeTools__GetTool,
        Na__LeTools__ArmEyedropper,
        Na__LeTools__GetTextDefaults,
        Na__LeTools__SetTextDefaults,
        Na__LeTools__GetDimensionDefaults,
        Na__LeTools__SetDimensionDefaults,
        Na__LeTools__GetShapeDefaults,
        Na__LeTools__SetShapeDefaults,
        Na__LeText__BeginEdit as Na__LeTools__BeginTextEdit,
        Na__LeTools__DeleteSelection,
        Na__LeTools__SetEditingViewport,
        Na__LeTools__RecentreViewport,
        Na__LeTools__SetSuppressed
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
