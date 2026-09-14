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
//   inference); double-click edits the value. Clicking the value and
//   dragging it moves the text and draws a curved leader back to the
//   centre of the dimension line. Shapes: grips move vertices; a drag of
//   the whole shape snaps to the linework; Shift-click an edge inserts a
//   vertex.
// - Plan doors: a click on a door in the selected plan viewport closes it or
//   opens it again (Na__LayoutEditor__PlanDoors__).
// - A press on a point of a 2D viewport's own linework carries the viewport
//   BY that point, snapping it onto or into line with other drawings, through
//   Na__LayoutEditor__ViewportSnapMove__. Hovering shows the point first.
// - Keys: Delete removes the selection (a viewport asks first), Escape
//   backs out, Space clears the selection, Enter finishes a shape, arrows
//   nudge by a millimetre (ten with Shift), V T D L R B pick a tool, Ctrl+Z
//   and Ctrl+Y step the history, Ctrl+C Ctrl+V Ctrl+D copy, paste and
//   duplicate a viewport or a vector (Na__LayoutEditor__ViewportClipboard__),
//   E picks the Leader tool. Nothing
//   fires while typing in a field; a Ctrl chord still reaches the sheet from
//   a select, a checkbox or a number box, which have no undo or paste of their
//   own. While a vector is being drawn, Ctrl+Z / Ctrl+Y take vertices off and
//   put them back instead of stepping the sheet.
// - Eyedropper (B): picks the style off one item and paints it onto others
//   through Na__LayoutEditor__Eyedropper__. It neither selects nor drags, so
//   a run of style clicks never swaps the right-hand panel out mid-run.
//   Unlocked viewports match each other; a locked viewport is not resolved
//   at all, so the dropper reaches through it. Shift+B loads the palette
//   instead: the clicked item's style becomes the setting new objects of its
//   kind are created with, the selection clears so the panel shows it, and
//   the drawing tool for that kind takes over.
// - Rectangle (R): one corner then the opposite one, clicked or dragged,
//   through Na__LayoutEditor__RectangleTool__. It is the one placing tool
//   that is also handed the release, which is what lets a rectangle be
//   dragged out. What it writes is an ordinary closed shape, so the vertex
//   grips edit its corners like any polygon's.
// - Leader (E): the point it marks, then where its note or bubble goes,
//   clicked or dragged, through Na__LayoutEditor__LeaderTool__, which is
//   handed the release as the Rectangle tool is. With the Select tool a
//   leader's tip grip re-points it, its head (the bubble, the note or the
//   round anchor grip) moves while the tip stays, and its curve moves the
//   whole leader; double-click edits its text.
// - While the Draw or Dimension tool is placing a point the arrows lock
//   the axis instead of nudging: left or right the X, up or down the Y,
//   the same key again to release, as in SketchUp LayOut.
// - Shift while a dimension's line is being placed makes it ortho
//   (Na__LayoutEditor__DimensionTool__); pressing or releasing Shift redraws
//   it at once from the last pointer position.
// - THE MEASUREMENTS BOX (Na__LayoutEditor__Measurements__) is attached and
//   detached with the tools, and handed the tool, the defaults, the last
//   pointer point, Shift, a way to run the tool's move again, and the vertex
//   being dragged; it is refreshed after every move and press. A value typed
//   while the Draw, Rectangle or Dimension tool is up, or while a vertex is
//   being dragged, is the box's before these keys see it, so Enter and Escape
//   reach the tools as before whenever nothing is typed. A length typed
//   during a vertex drag moves that vertex that far along the drag (TypeVertexLength).
// - A right click that did not pan opens the context menu for what is
//   under the cursor, in the same order as selection.
// - Box select (Na__LayoutEditor__SelectionBox__): a drag that starts where
//   there is nothing to move - bare paper, the grey stage, a locked viewport,
//   or anywhere with Alt held - draws a window to the right or a crossing to
//   the left. Ctrl adds, Shift toggles and Ctrl+Shift removes, for a box and a
//   click alike. Several selected items move, nudge and delete together, each
//   one undo step (Na__LayoutEditor__SelectionSet__); a click on one of them
//   that does not move narrows the selection to it.
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
// 14-Sep-2026 - Version 1.23.0
// - Ctrl+G groups selected vectors and text (and nested groups); Ctrl+Shift+G
//   ungroups. A click on a member selects the group. Groups move, nudge,
//   delete, copy and paste as one. Multi-select copy/paste for vectors and
//   text (Na__LayoutEditor__Groups__, Na__LayoutEditor__ItemClipboard__).
//
// 14-Sep-2026 - Version 1.22.0
// - The eyedropper skips locked viewports in Resolve, so a locked frame is
//   not picked up over the markup and unlocked viewports on it. Unlocked
//   viewports match each other (composites, frame, caption, scale).
//
// 14-Sep-2026 - Version 1.21.0
// - While a vertex is being dragged, the Measurements box takes a typed
//   length: GetVertexDrag is the original vertex and where it is headed,
//   TypeVertexLength puts it that far along that direction (no snap, so the
//   figure is exact) and finishes the drag so the still-down pointer cannot
//   pull it back to the cursor. One undo step.
//
// 14-Sep-2026 - Version 1.20.0
// - A dragged vector snaps to the linework: the grab point and every vertex
//   are offered, the nearest snap wins, and the whole shape translates so
//   that point lands on it (the same carry a viewport already uses). Vertex
//   grips already snapped; the whole-shape move did not.
// - Shift-click an edge of the selected vector inserts a vertex there (a
//   diamond marks the spot while Shift is held). The insert snaps, and a
//   drag of the new vertex is the same undo step.
//
// 14-Sep-2026 - Version 1.19.0
// - A press on a dimension's value (or on the arc back to the line) drags
//   the text: DimensionGrab's 'text' mode writes TextDXMm / TextDYMm, and
//   dragging it close to home clears both. The context menu's Reset text
//   position does the same. The PDF and the screen share the arc because
//   it is drawn as a chrome primitive.
//
// 14-Sep-2026 - Version 1.18.0
// - Vectors use the clipboard: Copy vector, Duplicate vector and Paste on a
//   shape's menu, and Paste vector on bare paper when a vector is held
//   (Na__LayoutEditor__ViewportClipboard__). Ctrl+C / Ctrl+V / Ctrl+D while
//   a vector is selected. While the Draw tool is placing points, Ctrl+Z takes
//   the last vertex off and Ctrl+Y puts it back, before the sheet history.
//   A number box (Edge pt, Size mm) hands those Ctrl chords to the sheet the
//   way a select already did, instead of swallowing them.
//
// 14-Sep-2026 - Version 1.17.0
// - The settings for new dimensions carry tickLengthMm: how large the ticks,
//   arrows or dots at each end are, from the config TickLengthMm until Size mm
//   in the Dimensions panel changes it.
//
// 14-Sep-2026 - Version 1.16.0
// - Plan doors. With a 2D plan viewport selected, a click on a door closes it
//   and another click opens it again (Na__LayoutEditor__PlanDoors__); the
//   cursor turns to a pointer over a door. A press that moves still moves the
//   viewport - only one that comes up without moving toggles - and each click
//   waits out the double click window, so a double click to enter the content
//   leaves the door alone. The viewport's right-click menu leads with Close
//   door or Open door under the click, and Open all doors while any is shut.
//   A lock holds a viewport's frame, not what it draws: on a locked plan a
//   press on a door is a door press - the click toggles, a drag does nothing -
//   rather than the start of a selection box.
//
// 14-Sep-2026 - Version 1.15.0
// - The settings for new dimensions carry their extension line lengths and
//   the padlock between them (startExtensionMm, endExtensionMm,
//   extensionsLinked): the config's DefaultExtensionMm for both, linked.
//
// 14-Sep-2026 - Version 1.14.0
// - The Measurements box: attached and detached here, refreshed after every
//   Draw, Rectangle and Dimension move and press, an arrow key lock, a Shift
//   redraw and a change of tool; a press on the sheet or an abandoned
//   placement drops a half-typed value. Rerun runs the placing tool's move
//   again from the last pointer position once a typed value has placed a
//   point. Shift is remembered from the last move or Shift key.
// - The shape and dimension defaults carry atScale: the Vectors panel's Draw
//   at scale and the Dimensions panel's Measure at scale.
//
// 14-Sep-2026 - Version 1.13.0
// - Box select and multi-selection. A Select press with nothing movable under
//   it hands the pointer to Na__LayoutEditor__SelectionBox__ (window or
//   crossing), and its release is folded into the selection (BoxUp). Ctrl,
//   Shift and Ctrl+Shift add, toggle and remove on a click or a box - the key
//   map's SelectionBindings - and Alt starts a box anywhere.
// - A drag on any item of a multi-selection moves the whole group through
//   Na__LayoutEditor__SelectionSet__, one undo step; a click that never moved
//   narrows the selection to that item. The arrow keys nudge, and Delete and
//   the context menu delete, the whole selection.
// - FinishDrag takes released: a press's click runs only when the button
//   really came up, never when a pan took the pointer over.
//
// 14-Sep-2026 - Version 1.12.0
// - The Leader tool (E) joins the tool list: Na__LayoutEditor__LeaderTool__
//   places a note or a specification bubble on a curved leader, and is handed
//   the press, the move and the release like the Rectangle tool. A press that
//   only finishes typing into a leader's text does not start another leader.
// - Leaders select, drag, nudge, delete and take a context menu (Edit leader
//   text, Delete leader, the style items). A press on the tip re-points it,
//   snapping; on the head (the bubble, the note or the anchor grip) moves the
//   head alone; on the curve moves the whole leader. Double-click edits text.
// - GetLeaderDefaults and SetLeaderDefaults hold the Leaders panel's settings
//   for new leaders, and a palette sync fills them.
// - The shape defaults carry fillOpacity and strokeOpacity.
//
// 13-Sep-2026 (TrueVision)
// - A viewport's right-click menu lists the project's design phases as Model
//   items, the one it draws ticked (Na__LayoutEditor__ModelSource__). Nothing on
//   a project with a single model.
//
// 13-Sep-2026 - Version 1.11.0
// - Shift going down or up redraws a dimension line being placed, so the switch
//   between aligned and ortho shows without moving the mouse (ShiftRedraw, on
//   keydown and on a new keyup listener).
// - A dimension grip that re-picks a point keeps an ortho line where it was
//   (Na__LeDimGeo__OffsetKeepingLine), and snaps in the dimension tone.
//
// 13-Sep-2026 - Version 1.10.0
// - Palette (Shift+B, Shift+click on the Eyedropper button, or Use for new ...
//   on the context menu): an item's style becomes the settings new objects of
//   its kind are created with. AdoptStyle is the writer handed to the
//   eyedropper; DEFAULTS_EVENT tells the panels. The drawing tool for the kind
//   takes over, a vector going to whichever of Draw and Rectangle drew last.
// - The eyedropper resolves locked items too, so a locked scrapbook is a source
//   and a locked target is refused with a reason instead of being missed.
//
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
        Na__LeCfg__GetLeaderSetup,
        Na__LeCfg__GetEyedropperSetup,
        Na__LeCfg__GetSelectionSetup,
        Na__LeCfg__GetLabel,
        Na__LeCfg__GetKeyboardSetup,
        Na__LeCfg__MatchKeyBinding,
        Na__LeCfg__MatchSelectionModifier,
        Na__LeCfg__FormatLabel,
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
        Na__LeModel__GetShapeById,
        Na__LeModel__DeleteShape,
        Na__LeModel__UpdateLeader,
        Na__LeModel__DeleteLeader,
        Na__LeModel__SetSelection,
        Na__LeModel__GetSelection,
        Na__LeModel__SetSelectionItems,
        Na__LeModel__GetSelectionItems,
        Na__LeModel__IsSelected
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
    import { Na__LeGrips__DimensionGrab, Na__LeGrips__ShapeGrab, Na__LeGrips__LeaderGrab, Na__LeGrips__ShowInsert, Na__LeGrips__HideInsert } from './Na__LayoutEditor__Grips__.js';
    import { Na__LeShapeGeo__Points, Na__LeShapeGeo__Translated, Na__LeShapeGeo__VertexAt, Na__LeShapeGeo__ClosestOnEdge, Na__LeShapeGeo__InsertPoint } from './Na__LayoutEditor__ShapeGeometry__.js';
    import { Na__LeText__Place, Na__LeText__BeginEdit, Na__LeText__Commit, Na__LeText__Cancel, Na__LeText__IsEditing } from './Na__LayoutEditor__TextTool__.js';
    import { Na__LeDim__Click, Na__LeDim__Move, Na__LeDim__Cancel, Na__LeDim__IsPlacing, Na__LeDim__IsSpanning, Na__LeDim__IsPlacingLine, Na__LeDim__OffsetFor, Na__LeDim__ShowInference, Na__LeDim__BeginTextEdit } from './Na__LayoutEditor__DimensionTool__.js';
    import { Na__LeDimGeo__OffsetKeepingLine } from './Na__LayoutEditor__DimensionGeometry__.js';
    import { Na__LeShape__Click, Na__LeShape__Move, Na__LeShape__Finish, Na__LeShape__Cancel, Na__LeShape__IsDrawing, Na__LeShape__UndoVertex, Na__LeShape__RedoVertex } from './Na__LayoutEditor__ShapeTool__.js';
    import { Na__LeGrad__Defaults, Na__LeGrad__Create } from './Na__LayoutEditor__GradientTool__.js';
    import { Na__LeRect__Press, Na__LeRect__Move, Na__LeRect__Release, Na__LeRect__Cancel, Na__LeRect__IsDrawing } from './Na__LayoutEditor__RectangleTool__.js';
    import { Na__LeMeasure__Attach, Na__LeMeasure__Detach, Na__LeMeasure__Refresh, Na__LeMeasure__Clear } from './Na__LayoutEditor__Measurements__.js';
    import { Na__LeLeader__Press, Na__LeLeader__Move, Na__LeLeader__Release, Na__LeLeader__Cancel, Na__LeLeader__IsPlacing, Na__LeLeader__BeginEdit } from './Na__LayoutEditor__LeaderTool__.js';
    import { Na__LeLeadGeo__Translated } from './Na__LayoutEditor__LeaderGeometry__.js';
    import { Na__LeDrop__Click, Na__LeDrop__Hover, Na__LeDrop__Refresh, Na__LeDrop__Clear, Na__LeDrop__Pick, Na__LeDrop__Paint, Na__LeDrop__HasSource, Na__LeDrop__CanApply, Na__LeDrop__MODE_ITEM, Na__LeDrop__MODE_PALETTE, Na__LeDrop__SetMode, Na__LeDrop__GetMode, Na__LeDrop__SyncPalette, Na__LeDrop__PaletteMenuLabel } from './Na__LayoutEditor__Eyedropper__.js';
    import { Na__LeAxis__AXIS_X, Na__LeAxis__AXIS_Y, Na__LeAxis__Toggle, Na__LeAxis__Clear } from './Na__LayoutEditor__AxisLock__.js';
    import { Na__LeVp2d__SetInteracting, Na__LeVp2d__CentreOnDrawing, Na__LeVp2d__Describe } from './Na__LayoutEditor__Viewport2d__.js';
    import { Na__LeDoors__ClickToggles, Na__LeDoors__At, Na__LeDoors__ToggleSoon, Na__LeDoors__CancelPending, Na__LeDoors__MenuItems } from './Na__LayoutEditor__PlanDoors__.js';
    import { Na__LeVp3d__SetInteracting } from './Na__LayoutEditor__Viewport3d__.js';
    import { Na__LeOsnap__TONE_DIMENSION, Na__LeOsnap__Snap, Na__LeOsnap__Find, Na__LeOsnap__ShowMarker, Na__LeOsnap__HideMarker, Na__LeOsnap__Toggle, Na__LeOsnap__IsEnabled } from './Na__LayoutEditor__Snapping__.js';
    import { Na__LeVpMove__GrabAt, Na__LeVpMove__Hover, Na__LeVpMove__Solve, Na__LeVpMove__Finish, Na__LeVpMove__Clear, Na__LeVpMove__Refresh } from './Na__LayoutEditor__ViewportSnapMove__.js';
    import { Na__LeClip__RunKeyAction, Na__LeClip__MenuItems } from './Na__LayoutEditor__ItemClipboard__.js';
    import { Na__LeGroup__Resolve, Na__LeGroup__ResolveItems, Na__LeGroup__Expand, Na__LeGroup__Group, Na__LeGroup__Ungroup, Na__LeGroup__CanGroup, Na__LeGroup__CanUngroup, Na__LeGroup__Render } from './Na__LayoutEditor__Groups__.js';
    // @delegate: ./Na__LayoutEditor__Groups__.js
    // @delegate: ./Na__LayoutEditor__ItemClipboard__.js
    import { Na__LeSelBox__COMBINE_ADD, Na__LeSelBox__COMBINE_REMOVE, Na__LeSelBox__Press, Na__LeSelBox__Move, Na__LeSelBox__Release, Na__LeSelBox__Cancel, Na__LeSelBox__Refresh, Na__LeSelBox__IsActive, Na__LeSelBox__Combine } from './Na__LayoutEditor__SelectionBox__.js';
    import { Na__LeSelSet__Capture, Na__LeSelSet__Apply, Na__LeSelSet__Commit, Na__LeSelSet__Nudge, Na__LeSelSet__Delete } from './Na__LayoutEditor__SelectionSet__.js';
    import { Na__LeSource__MenuItems } from './Na__LayoutEditor__ModelSource__.js';
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
    const Na__LeTools__TOOL_LEADER    = 'leader';
    const Na__LeTools__TOOLS          = [ Na__LeTools__TOOL_SELECT, Na__LeTools__TOOL_TEXT, Na__LeTools__TOOL_DIMENSION, Na__LeTools__TOOL_DRAW, Na__LeTools__TOOL_RECT, Na__LeTools__TOOL_EYEDROP, Na__LeTools__TOOL_LEADER ];
    const Na__LeTools__CHANGED_EVENT  = 'na-layouteditor-tool-changed';
    const Na__LeTools__DEFAULTS_EVENT = 'na-layouteditor-defaults-changed';   // <-- The settings for new objects changed from outside their panel (a palette sync)
    const Na__LeTools__MENU_SLOP_PX   = 4;      // <-- A right button that travelled further than this panned, so no menu
    const Na__LeTools__SHEET_CHORDS   = [ 'Edit__Undo', 'Edit__Redo', 'Edit__Copy', 'Edit__Paste', 'Edit__Duplicate', 'Edit__Group', 'Edit__Ungroup' ];   // <-- Still the sheet's from a focused select, checkbox or number box
    const Na__LeTools__NON_TEXT_INPUTS = [ 'checkbox', 'radio', 'range', 'color', 'button', 'submit', 'reset', 'file', 'image', 'number' ];
    const Na__LeTools__TYPED_MIN_MM    = 1e-4;   // <-- Shorter than this (paper mm) is no length and no direction, as the Draw tool uses
    // ------------------------------------------------------------

    // MODULE VARIABLES | Attachment and Interaction State
    // ------------------------------------------------------------
    let Na__LeTools__Stage      = null;
    let Na__LeTools__Handlers   = null;
    let Na__LeTools__Editable   = false;
    let Na__LeTools__Tool       = Na__LeTools__TOOL_SELECT;
    let Na__LeTools__Drag       = null;    // <-- { kind, id, hit, mode, index, start, startMm, moved, pointerId, click }; a multi-selection's is { kind : 'group', group, ... }
    let Na__LeTools__Suppressed = false;   // <-- Raised by the control modules while a navigation gesture owns the pointer
    let Na__LeTools__RightPress = null;    // <-- { x, y } of the last right-button press
    let Na__LeTools__LastPointMm = null;   // <-- Where the cursor last sat on the paper, so a key can restretch the band
    let Na__LeTools__ShiftHeld   = false;  // <-- Shift at the last move or Shift key: a typed dimension goes ortho by it, as a click does
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
            Na__LeTools__TextDefaults = { text : s.defaultText, sizeMm : s.defaultSizeMm, fontWeight : s.defaultWeight, colour : s.defaultColour, align : 'left', leader : false };
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
                                           gradientOn : Na__LeGrad__Defaults().on === true, gradient : Na__LeGrad__Create() };   // <-- The settings outlive the toggle, so switching it back on restores them
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


    // HELPER FUNCTION | The Hit Tolerance in Paper Millimetres at the Current Zoom
    // ------------------------------------------------------------
    function Na__LeTools__Tolerance() { return Na__LeCfg__GetSelectionSetup().hitToleranceMm / Na__LeSurface__GetZoom(); }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Outline Point a Whole-Shape Drag Is Carried By
    // ------------------------------------------------------------
    // The nearest vertex, or a point on an edge if that is closer, so grabbing
    // a corner snaps that corner and grabbing along a side snaps that side.
    // ------------------------------------------------------------
    function Na__LeTools__ShapeGrabPoint(shape, pointMm) {
        const pts = Na__LeShapeGeo__Points(shape);
        if (!pts.length || !pointMm) return pointMm;
        let best = { x : pts[0][0], y : pts[0][1] };
        let bestD = Math.hypot(pointMm.x - best.x, pointMm.y - best.y);
        pts.forEach((p) => {
            const d = Math.hypot(pointMm.x - p[0], pointMm.y - p[1]);
            if (d < bestD) { best = { x : p[0], y : p[1] }; bestD = d; }
        });
        const edge = Na__LeShapeGeo__ClosestOnEdge(shape, pointMm);
        if (edge && edge.distance < bestD) return { x : edge.x, y : edge.y };
        return best;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where a Shift-Click Would Insert a Vertex, or Null
    // ------------------------------------------------------------
    // On an edge of the shape, not on a vertex grip, and not so close to
    // either end that the new point would sit on top of one already there.
    // A nearby snap (the linework) wins over the foot on the edge.
    // ------------------------------------------------------------
    function Na__LeTools__ShapeInsertHit(sheet, shape, pointMm) {
        if (!sheet || !shape || !pointMm) return null;
        const tol = Na__LeTools__Tolerance();
        if (Na__LeShapeGeo__VertexAt(shape, pointMm, tol * 2) >= 0) return null;
        const edge = Na__LeShapeGeo__ClosestOnEdge(shape, pointMm);
        if (!edge || edge.distance > tol) return null;
        const pts = Na__LeShapeGeo__Points(shape);
        const a = pts[edge.index], b = pts[(edge.index + 1) % pts.length];
        const minMm = Na__LeCfg__GetSelectionSetup().dragThresholdMm;
        if (Math.hypot(edge.x - a[0], edge.y - a[1]) < minMm) return null;
        if (Math.hypot(edge.x - b[0], edge.y - b[1]) < minMm) return null;
        const snap = Na__LeOsnap__Find(sheet, { x : edge.x, y : edge.y }, { kind : 'shape', id : shape.Shape__Id });
        return { index : edge.index, point : snap ? [ snap.x, snap.y ] : [ edge.x, edge.y ], snap : snap };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Insert-Vertex Diamond While Shift Is Held Over an Edge
    // ------------------------------------------------------------
    function Na__LeTools__RefreshShapeInsert(sheet, pointMm, shift) {
        if (!shift || !sheet || !pointMm || Na__LeTools__Drag || !Na__LeTools__Editable || Na__LeTools__Tool !== Na__LeTools__TOOL_SELECT) {
            if (Na__LeGrips__HideInsert()) Na__LeOsnap__HideMarker();
            return false;
        }
        const selection = Na__LeModel__GetSelection();
        if (!selection || selection.kind !== 'shape') { if (Na__LeGrips__HideInsert()) Na__LeOsnap__HideMarker(); return false; }
        const shape = Na__LeTools__Record(sheet, selection);
        if (!shape || Na__LeModel__IsLayerLocked(sheet, shape.Shape__LayerId)) { if (Na__LeGrips__HideInsert()) Na__LeOsnap__HideMarker(); return false; }
        const hit = Na__LeTools__ShapeInsertHit(sheet, shape, pointMm);
        if (!hit) { if (Na__LeGrips__HideInsert()) Na__LeOsnap__HideMarker(); return false; }
        Na__LeGrips__ShowInsert(hit.point[0], hit.point[1]);
        if (hit.snap) Na__LeOsnap__ShowMarker(hit.snap); else Na__LeOsnap__HideMarker();
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Translate a Whole Shape So a Vertex or the Grab Point Snaps
    // ------------------------------------------------------------
    // Every vertex and the press's grab point are offered at the axis-locked
    // delta; the nearest snap wins, and the translation puts THAT point on it.
    // The shape being moved is excluded, so a corner never snaps to itself.
    // ------------------------------------------------------------
    function Na__LeTools__SnapShapeTranslation(sheet, drag, dMm, shift) {
        const axis = shift ? (Math.abs(dMm.x) >= Math.abs(dMm.y) ? { x : dMm.x, y : 0 } : { x : 0, y : dMm.y }) : dMm;
        const exclude = { kind : 'shape', id : drag.id };
        let best = null;
        const offer = (ox, oy) => {
            const hit = Na__LeOsnap__Find(sheet, { x : ox + axis.x, y : oy + axis.y }, exclude);
            if (hit && (!best || hit.score < best.score)) best = { hit : hit, ox : ox, oy : oy };
        };
        if (drag.baseMm) offer(drag.baseMm.x, drag.baseMm.y);
        (drag.start || []).forEach((p) => offer(p[0], p[1]));
        if (!best) { Na__LeOsnap__HideMarker(); return axis; }
        Na__LeOsnap__ShowMarker(best.hit);
        return { x : best.hit.x - best.ox, y : best.hit.y - best.oy };
    }
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
        Na__LeVpMove__Clear();                                               // <-- Tracking points and the carry marker go with the tool
        Na__LeSelBox__Cancel();                                              // <-- So does a selection box being dragged out
        Na__LeMeasure__Clear();                                              // <-- And a value half typed into the Measurements box
    }
    // ------------------------------------------------------------


    // FUNCTION | The Active Tool
    // ------------------------------------------------------------
    function Na__LeTools__SetTool(tool) {
        const next = Na__LeTools__TOOLS.indexOf(tool) === -1 ? Na__LeTools__TOOL_SELECT : tool;
        if (!Na__LeTools__Editable && next !== Na__LeTools__TOOL_SELECT) return Na__LeTools__Tool;
        Na__LeTools__CancelPlacement();
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
// REGION | Hit Resolution
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | What the Select Tool Finds Under a Point
    // ------------------------------------------------------------
    // Returns { kind : 'dimension'|'annotation'|'shape'|'leader'|'viewport', id, hit }
    // or null. Markup wins over viewports, and the markup bridge orders it
    // dimensions, text, shapes, leaders.
    //
    // includeLocked: the eyedropper may READ locked markup (a locked scrapbook
    // is still a source). skipLockedViewports: a locked viewport is not there
    // at all - it covers the sheet, and detecting it over everything else is
    // not useful once the frame is locked.
    // ------------------------------------------------------------
    function Na__LeTools__Resolve(sheet, pointMm, includeLocked, skipLockedViewports, keepMember) {
        const markup = Na__LeMarkup__HitTest(sheet, pointMm, Na__LeTools__Tolerance(), includeLocked === true);   // <-- The eyedropper reads locked markup; nothing else touches it
        if (markup) return keepMember === true ? { kind : markup.kind, id : markup.id, hit : null } : Na__LeGroup__Resolve(sheet, { kind : markup.kind, id : markup.id, hit : null });
        const ppm  = Na__LeSurface__GetPixelsPerMm();
        const zoom = Na__LeSurface__GetZoom();
        const selection = Na__LeModel__GetSelection();
        const selected  = (selection && selection.kind === 'viewport') ? Na__LeModel__GetViewportById(sheet, selection.id) : null;
        if (selected && Na__LeModel__IsLayerVisible(sheet, selected.Viewport__LayerId)
                && !(skipLockedViewports && Na__LeTools__IsViewportLocked(sheet, selected))) {
            const hit = Na__LeHandles__HitTest(selected, pointMm, ppm, zoom, true);
            if (hit) return { kind : 'viewport', id : selected.Viewport__Id, hit : hit };
        }
        const ordered = Na__LeHandles__FrontToBack(sheet);
        for (let i = 0; i < ordered.length; i++) {
            if (skipLockedViewports && Na__LeTools__IsViewportLocked(sheet, ordered[i])) continue;   // <-- Look through a locked frame
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
        if (found.kind === 'leader')     return (sheet.Sheet__Leaders || []).find((l) => l.Leader__Id === found.id) || null;
        return Na__LeModel__GetViewportById(sheet, found.id);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Viewport Is Locked by Its Own Flag or by Its Layer
    // ------------------------------------------------------------
    function Na__LeTools__IsViewportLocked(sheet, viewport) {
        return !!viewport && (viewport.Viewport__Locked === true || Na__LeModel__IsLayerLocked(sheet, viewport.Viewport__LayerId));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Door Under the Pointer in the Selected Plan Viewport, or Null
    // ------------------------------------------------------------
    // Only the ONE selected 2D viewport answers, and only while it can be
    // edited: the first click on a plan selects it as it always did, and once
    // it is selected a click on a door closes or opens that door. A handle is a
    // crop, never a door.
    // ------------------------------------------------------------
    function Na__LeTools__DoorAt(sheet, found, pointMm) {
        if (!Na__LeTools__Editable || !found || found.kind !== 'viewport' || !Na__LeDoors__ClickToggles()) return null;
        if (found.hit && found.hit.mode === 'handle') return null;
        const selection = Na__LeModel__GetSelection();
        if (!selection || selection.kind !== 'viewport' || selection.id !== found.id) return null;
        const viewport = Na__LeModel__GetViewportById(sheet, found.id);
        if (!viewport || viewport.Viewport__Kind !== Na__LeModel__KIND_2D) return null;          // <-- Locked or not: a lock holds the frame, not the doors
        return Na__LeDoors__At(viewport, Na__LeVp2d__Describe(viewport), pointMm, Na__LeTools__Tolerance());
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Cursor for What Is Under the Pointer
    // ------------------------------------------------------------
    function Na__LeTools__HoverCursor(sheet, found, pointMm) {
        if (!found) return '';
        if (found.kind === 'group') return Na__LeTools__Editable ? 'move' : 'default';
        const record = Na__LeTools__Record(sheet, found);
        if (!record || !Na__LeTools__Editable) return 'default';
        const tol = Na__LeTools__Tolerance();
        if (found.kind === 'annotation') return Na__LeModel__IsLayerLocked(sheet, record.Annotation__LayerId) ? 'default' : 'move';
        if (found.kind === 'dimension') {
            if (Na__LeModel__IsLayerLocked(sheet, record.Dimension__LayerId)) return 'default';
            const grab = Na__LeGrips__DimensionGrab(record, pointMm, tol, sheet);
            return (grab === 'whole' || grab === 'text') ? 'move' : 'crosshair';
        }
        if (found.kind === 'shape') {
            if (Na__LeModel__IsLayerLocked(sheet, record.Shape__LayerId)) return 'default';
            return Na__LeGrips__ShapeGrab(record, pointMm, tol).mode === 'whole' ? 'move' : 'crosshair';
        }
        if (found.kind === 'leader') {
            if (Na__LeModel__IsLayerLocked(sheet, record.Leader__LayerId)) return 'default';
            return Na__LeGrips__LeaderGrab(record, pointMm, tol) === 'tip' ? 'crosshair' : 'move';
        }
        if (Na__LeTools__DoorAt(sheet, found, pointMm)) return 'pointer';     // <-- A click here closes or opens that door, locked or not
        if (Na__LeTools__IsViewportLocked(sheet, record)) return 'default';
        if (Na__LeSurface__GetEditingViewport() === found.id) return 'grab';
        if (found.hit && found.hit.mode === 'handle') return Na__LeHandles__CursorFor(found.hit);
        return 'move';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Viewport a Press Here May Carry by a Point, or Null
    // ------------------------------------------------------------
    // Everything that already owns a press on a viewport wins over the carry:
    // a handle crops, content editing pans the drawing, a lock refuses, and one
    // of several selected items moves with the rest. Only a press that would
    // otherwise have moved the frame the plain way is offered to the snap move.
    // ------------------------------------------------------------
    function Na__LeTools__CarryTarget(sheet, found) {
        if (!Na__LeTools__Editable || !found || found.kind !== 'viewport') return null;
        if (found.hit && found.hit.mode === 'handle') return null;
        if (Na__LeModel__GetSelectionItems().length > 1 && Na__LeModel__IsSelected(found.kind, found.id)) return null;
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
            return { kind : 'dimension', id : found.id, mode : Na__LeGrips__DimensionGrab(record, pointMm, tol, sheet),
                     start : { sx : record.Dimension__StartXMm, sy : record.Dimension__StartYMm, ex : record.Dimension__EndXMm, ey : record.Dimension__EndYMm,
                               offset : record.Dimension__OffsetMm, tdx : record.Dimension__TextDXMm || 0, tdy : record.Dimension__TextDYMm || 0 } };
        }
        if (found.kind === 'shape') {
            if (Na__LeModel__IsLayerLocked(sheet, record.Shape__LayerId)) return null;
            const grab = Na__LeGrips__ShapeGrab(record, pointMm, tol);
            const drag = { kind : 'shape', id : found.id, mode : grab.mode, index : grab.index, start : Na__LeShapeGeo__Points(record).map((p) => [ p[0], p[1] ]) };
            if (grab.mode === 'whole') drag.baseMm = Na__LeTools__ShapeGrabPoint(record, pointMm);
            return drag;
        }
        if (found.kind === 'leader') {
            if (Na__LeModel__IsLayerLocked(sheet, record.Leader__LayerId)) return null;
            return { kind : 'leader', id : found.id, mode : Na__LeGrips__LeaderGrab(record, pointMm, tol),
                     start : { tx : record.Leader__TipXMm, ty : record.Leader__TipYMm, ax : record.Leader__AnchorXMm, ay : record.Leader__AnchorYMm } };
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


    // HELPER FUNCTION | Does a Select Press Start a Selection Box
    // ------------------------------------------------------------
    // It does where there is nothing to move: bare paper or the grey stage, a
    // locked viewport, anything at all in a read-only session - or anywhere
    // with the box modifier (Alt) held. A touch that lands off the paper is the
    // one-finger pan's, so a box never fights the pan for the finger.
    // ------------------------------------------------------------
    function Na__LeTools__StartsBox(sheet, found, intent, event) {
        const target = event.target;
        if (event.pointerType === 'touch' && !(target && target.closest && target.closest(Na__LeCfg__GetGuards().paperSelector))) return false;
        if (!found || intent.anywhere || !Na__LeTools__Editable) return true;
        return found.kind === 'viewport' && Na__LeTools__IsViewportLocked(sheet, Na__LeModel__GetViewportById(sheet, found.id));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What a Select Press on an Item Does to the Selection
    // ------------------------------------------------------------
    // What adds happens at the press, so a drag straight after carries the new
    // member. What removes or narrows waits for the button to come up without
    // a move, so a drag can carry the whole selection first; that change comes
    // back as a function for the release to run, or null.
    //   no modifier    an unselected item replaces the selection; one of several
    //                  selected keeps them all, and a click narrows to it
    //   Ctrl           an unselected item joins
    //   Shift          an unselected item joins; a selected one leaves on a click
    //   Ctrl+Shift     a selected item leaves on a click
    // ------------------------------------------------------------
    function Na__LeTools__PressSelection(pressed, combine) {
        const member = Na__LeModel__IsSelected(pressed.kind, pressed.id);
        if (!combine) {
            if (!member) { Na__LeModel__SetSelection(pressed); return null; }
            return Na__LeModel__GetSelectionItems().length > 1 ? () => Na__LeModel__SetSelection(pressed) : null;
        }
        if (!member) {
            if (combine !== Na__LeSelBox__COMBINE_REMOVE) Na__LeModel__SetSelectionItems(Na__LeSelBox__Combine(Na__LeModel__GetSelectionItems(), [ pressed ], Na__LeSelBox__COMBINE_ADD));
            return null;
        }
        if (combine === Na__LeSelBox__COMBINE_ADD) return null;
        return () => Na__LeModel__SetSelectionItems(Na__LeSelBox__Combine(Na__LeModel__GetSelectionItems(), [ pressed ], Na__LeSelBox__COMBINE_REMOVE));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Pointer Down
    // ------------------------------------------------------------
    function Na__LeTools__OnDown(event) {
        Na__LeMenu__Close();
        if (event.button === 2) { Na__LeTools__RightPress = { x : event.clientX, y : event.clientY }; return; }   // <-- Remembered so a right click that did not pan opens the menu
        if (Na__LeTools__Suppressed) return;                                 // <-- A pan or a pinch owns this pointer
        if (!Na__LeTools__IsLeft(event)) return;
        Na__LeMeasure__Clear();                                              // <-- A press on the sheet drops a half-typed value, as in SketchUp
        const sheet = Na__LeModel__GetActiveSheet();
        const point = Na__LeSurface__ClientToPaperMm(event.clientX, event.clientY);
        if (!sheet || !point) return;
        const wasEditing = Na__LeText__IsEditing();
        if (wasEditing) Na__LeText__Commit();

        if (Na__LeTools__Editable) {
            if (Na__LeTools__Tool === Na__LeTools__TOOL_TEXT)      { Na__LeText__Place(sheet, point, Na__LeTools__GetTextDefaults()); return; }
            if (Na__LeTools__Tool === Na__LeTools__TOOL_DIMENSION) { Na__LeDim__Click(sheet, point, event.shiftKey, Na__LeTools__GetDimensionDefaults()); Na__LeMeasure__Refresh(); return; }
            if (Na__LeTools__Tool === Na__LeTools__TOOL_DRAW)      { Na__LeShape__Click(sheet, point, event.shiftKey, Na__LeTools__GetShapeDefaults()); Na__LeMeasure__Refresh(); return; }

            // RECTANGLE | The press sets or lands a corner. The pointer is
            // captured so a rectangle dragged out past the edge of the stage
            // still delivers its release here, where it lands the far corner.
            // ------------------------------------
            if (Na__LeTools__Tool === Na__LeTools__TOOL_RECT) {
                Na__LeRect__Press(sheet, point, event.shiftKey, Na__LeTools__GetShapeDefaults(), event.pointerId);
                Na__LeMeasure__Refresh();
                try { Na__LeTools__Stage.setPointerCapture(event.pointerId); } catch (e) { /* capture refused */ }
                return;
            }

            // LEADER | The first press marks the point, a second lands the head;
            // or drag from one to the other, which is why the release is handed
            // on too. A press that only finishes typing into a leader's text is
            // spent on that, rather than starting the next leader.
            // ------------------------------------
            if (Na__LeTools__Tool === Na__LeTools__TOOL_LEADER) {
                if (wasEditing && !Na__LeLeader__IsPlacing()) return;
                Na__LeLeader__Press(sheet, point, Na__LeTools__GetLeaderDefaults(), event.pointerId);
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
                const picked = Na__LeTools__Resolve(sheet, point, true, true, true);   // <-- Locked markup is still a source; a locked viewport is not even there; grouped members keep their own style
                if (Na__LeDrop__GetMode() === Na__LeDrop__MODE_PALETTE) Na__LeTools__SyncPaletteFrom(sheet, picked);
                else Na__LeDrop__Click(sheet, picked, !!event.altKey);
                if (Na__LeTools__Tool === Na__LeTools__TOOL_EYEDROP) Na__LeTools__Stage.style.cursor = Na__LeDrop__Hover(sheet, picked);   // <-- Unless a palette sync has already handed over to a drawing tool
                return;
            }
        }

        const found     = Na__LeTools__Resolve(sheet, point);
        const editingId = Na__LeSurface__GetEditingViewport();
        if (editingId && (!found || found.kind !== 'viewport' || found.id !== editingId)) Na__LeSurface__SetEditingViewport(null);   // <-- A press anywhere else finishes content editing
        const intent  = Na__LeCfg__MatchSelectionModifier({ Ctrl : !!event.ctrlKey, Shift : !!event.shiftKey, Alt : !!event.altKey, Meta : !!event.metaKey });
        const pressed = found ? { kind : found.kind, id : found.id } : null;
        const door    = intent.combine ? null : Na__LeTools__DoorAt(sheet, found, point);   // <-- Read before the press changes the selection: only a plan already selected answers

        // A DOOR ON A LOCKED PLAN | The lock holds the frame, not what it draws,
        // so the press is a door press rather than the start of a box: the click
        // closes or opens the door, and a drag does nothing at all.
        // ------------------------------------
        if (door && !intent.anywhere && Na__LeTools__IsViewportLocked(sheet, Na__LeModel__GetViewportById(sheet, found.id))) {
            const viewportId = found.id;
            Na__LeTools__Drag = { kind : 'door', id : viewportId, startMm : point, moved : false, pointerId : event.pointerId, click : () => Na__LeDoors__ToggleSoon(sheet, viewportId, door) };
            try { Na__LeTools__Stage.setPointerCapture(event.pointerId); } catch (e) { /* capture refused */ }
            event.preventDefault();
            return;
        }

        // BOX | Nothing here can move, or Alt asks for a box regardless. A plain
        // press on bare paper still clears the selection at once; what a box
        // takes - or, for a click that never became one, the item it landed
        // on - goes into the selection when the button comes up (BoxUp).
        // ------------------------------------
        if (Na__LeTools__StartsBox(sheet, found, intent, event)) {
            if (!found && !intent.combine) Na__LeModel__SetSelection(null);
            Na__LeSelBox__Press(point, event.clientX, event.clientY, event.pointerId, { combine : intent.combine, pending : pressed });
            try { Na__LeTools__Stage.setPointerCapture(event.pointerId); } catch (e) { /* capture refused */ }
            event.preventDefault();
            return;
        }
        if (!found) { if (!intent.combine) Na__LeModel__SetSelection(null); return; }

        // SHIFT-CLICK AN EDGE | Insert a vertex on the selected vector, then
        // the same press can drag it. Shift on a vertex or the fill still
        // toggles the selection, as it always did.
        // ------------------------------------
        if (Na__LeTools__Editable && Na__LeTools__Tool === Na__LeTools__TOOL_SELECT && event.shiftKey && !event.ctrlKey && !event.altKey && found.kind === 'shape') {
            const items = Na__LeModel__GetSelectionItems();
            const shape = (items.length === 1 && items[0].kind === 'shape' && items[0].id === found.id) ? Na__LeTools__Record(sheet, found) : null;
            const hit   = shape && !Na__LeModel__IsLayerLocked(sheet, shape.Shape__LayerId) ? Na__LeTools__ShapeInsertHit(sheet, shape, point) : null;
            if (hit) {
                Na__LeGrips__HideInsert();
                const start = Na__LeShapeGeo__InsertPoint(Na__LeShapeGeo__Points(shape), hit.index, hit.point);
                Na__LeModel__UpdateShape(sheet, found.id, { points : start }, true);
                Na__LeSurface__Refresh('markup');
                Na__LeTools__Drag = { kind : 'shape', id : found.id, mode : 'vertex', index : hit.index + 1, start : start, inserted : true,
                                      startMm : point, moved : false, pointerId : event.pointerId, click : null };
                try { Na__LeTools__Stage.setPointerCapture(event.pointerId); } catch (e) { /* capture refused */ }
                Na__LeMeasure__Refresh();                                    // <-- The Measurements box wakes for a vertex drag
                event.preventDefault();
                return;
            }
        }

        // SELECTION, THEN THE DRAG | Several selected move together; one
        // selected is dragged its own way, grips and handles included.
        // ------------------------------------
        const click = Na__LeTools__PressSelection(pressed, intent.combine);
        if (!Na__LeModel__IsSelected(pressed.kind, pressed.id)) return;         // <-- Ctrl+Shift on an unselected item: nothing to change, nothing to drag
        if (!Na__LeTools__Editable) { if (click) click(); return; }
        const items = Na__LeModel__GetSelectionItems();
        const asSet = items.length > 1 || items.some((item) => item && item.kind === 'group');
        const drag  = asSet ? { kind : 'group', group : Na__LeSelSet__Capture(sheet, Na__LeGroup__Expand(sheet, items)) } : Na__LeTools__DragFor(sheet, found, point);
        if (!drag) { if (click) click(); return; }
        drag.startMm   = point;
        drag.moved     = false;
        drag.pointerId = event.pointerId;
        drag.click     = click;                                              // <-- Run if the button comes up without a move
        if (door && items.length === 1) {
            const viewportId = found.id;
            drag.click = () => { if (click) click(); Na__LeDoors__ToggleSoon(sheet, viewportId, door); };   // <-- A click on a door, not a move: close or open it
        }
        Na__LeTools__Drag = drag;
        Na__LeGrips__HideInsert();
        Na__LeTools__Stage.setPointerCapture(event.pointerId);
        if (drag.kind === 'shape' && drag.mode === 'vertex') Na__LeMeasure__Refresh();   // <-- The box reads the vertex while it is held
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
        Na__LeTools__ShiftHeld   = !!event.shiftKey;

        const drag = Na__LeTools__Drag;
        if (!drag || event.pointerId !== drag.pointerId) {
            if (Na__LeSelBox__Move(sheet, point, event.clientX, event.clientY, event.pointerId)) return;   // <-- A selection box is being dragged out
            if (Na__LeTools__Editable && Na__LeTools__Tool === Na__LeTools__TOOL_DIMENSION) { Na__LeDim__Move(sheet, point, event.shiftKey); Na__LeMeasure__Refresh(); return; }
            if (Na__LeTools__Editable && Na__LeTools__Tool === Na__LeTools__TOOL_DRAW)      { Na__LeShape__Move(sheet, point, event.shiftKey); Na__LeMeasure__Refresh(); return; }
            if (Na__LeTools__Editable && Na__LeTools__Tool === Na__LeTools__TOOL_RECT)      { Na__LeRect__Move(sheet, point, event.shiftKey, (event.buttons & 1) === 1 || event.pointerType === 'touch'); Na__LeMeasure__Refresh(); return; }
            if (Na__LeTools__Editable && Na__LeTools__Tool === Na__LeTools__TOOL_LEADER)    { Na__LeLeader__Move(sheet, point, (event.buttons & 1) === 1 || event.pointerType === 'touch'); return; }
            if (Na__LeTools__Editable && Na__LeTools__Tool === Na__LeTools__TOOL_EYEDROP)   { Na__LeTools__Stage.style.cursor = Na__LeDrop__Hover(sheet, Na__LeTools__Resolve(sheet, point, true, true, true)); return; }
            if (Na__LeTools__Tool !== Na__LeTools__TOOL_SELECT) return;
            const found     = Na__LeTools__Resolve(sheet, point);
            const grab      = Na__LeVpMove__Hover(sheet, Na__LeTools__CarryTarget(sheet, found), point);   // <-- Marks the point a press would carry the viewport by
            const inserting = Na__LeTools__RefreshShapeInsert(sheet, point, event.shiftKey);
            Na__LeTools__Stage.style.cursor = (inserting || grab) ? 'crosshair' : Na__LeTools__HoverCursor(sheet, found, point);
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
        if (drag.kind === 'door') return;                                    // <-- A press on a door of a locked plan moves nothing
        const cursor = { x : drag.startMm.x + dMm.x, y : drag.startMm.y + dMm.y };
        const d = shift ? (Math.abs(dMm.x) >= Math.abs(dMm.y) ? { x : dMm.x, y : 0 } : { x : 0, y : dMm.y }) : dMm;
        if (drag.kind === 'group') { Na__LeSelSet__Apply(sheet, drag.group, d.x, d.y); return; }   // <-- Several selected items: one distance for all, Shift holding the axis
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
                Na__LeModel__UpdateShape(sheet, drag.id, { points : points }, true);
                Na__LeSurface__Refresh('markup');
                Na__LeMeasure__Refresh();                                    // <-- The box reads the drag length as the vertex moves
                return;
            } else {
                const t = Na__LeTools__SnapShapeTranslation(sheet, drag, dMm, shift);   // <-- Any vertex, or the grab, onto the linework; Shift still holds the axis
                points  = Na__LeShapeGeo__Translated(drag.start, t.x, t.y);
            }
            Na__LeModel__UpdateShape(sheet, drag.id, { points : points }, true);
            Na__LeSurface__Refresh('markup');
            return;
        }
        if (drag.kind === 'leader') {
            // TIP, HEAD OR WHOLE | The tip re-points and snaps like a vertex; the
            // head moves alone and leaves the tip on what it points at; a grab on
            // the curve carries both.
            const st = drag.start;
            let patch;
            if (drag.mode === 'tip') {
                const snap = Na__LeOsnap__Snap(sheet, cursor, { kind : 'leader', id : drag.id, index : 'tip' });
                patch = { tipXMm : snap.snapped ? snap.x : st.tx + d.x, tipYMm : snap.snapped ? snap.y : st.ty + d.y };
            } else if (drag.mode === 'anchor') {
                patch = { anchorXMm : st.ax + d.x, anchorYMm : st.ay + d.y };
            } else {
                patch = { tipXMm : st.tx + d.x, tipYMm : st.ty + d.y, anchorXMm : st.ax + d.x, anchorYMm : st.ay + d.y };
            }
            Na__LeModel__UpdateLeader(sheet, drag.id, patch, true);
            Na__LeSurface__Refresh('markup');
            return;
        }
        const s = drag.start;
        let patch = null;
        if (drag.mode === 'start' || drag.mode === 'end') {
            const snap = Na__LeOsnap__Snap(sheet, cursor, { kind : 'dimension', id : drag.id, index : drag.mode }, Na__LeOsnap__TONE_DIMENSION);   // <-- The grip jumps to a corner or a midpoint, never its own
            const px = snap.snapped ? snap.x : (drag.mode === 'start' ? s.sx : s.ex) + d.x;
            const py = snap.snapped ? snap.y : (drag.mode === 'start' ? s.sy : s.ey) + d.y;
            patch = drag.mode === 'start' ? { startXMm : px, startYMm : py } : { endXMm : px, endYMm : py };
            // AN ORTHO LINE STAYS WHERE IT WAS PUT. Its offset is measured from the
            // start, so re-picking the start would otherwise carry the line with it;
            // an aligned dimension keeps its offset exactly as before.
            const dim = sheet.Sheet__Dimensions.find((x) => x.Dimension__Id === drag.id);
            if (dim) {
                const fromStart = { x : s.sx, y : s.sy }, fromEnd = { x : s.ex, y : s.ey };
                patch.offsetMm = Na__LeDimGeo__OffsetKeepingLine(fromStart, fromEnd, s.offset,
                    drag.mode === 'start' ? { x : px, y : py } : fromStart, drag.mode === 'end' ? { x : px, y : py } : fromEnd, dim.Dimension__Orientation);
            }
        } else if (drag.mode === 'offset') {
            const dim = sheet.Sheet__Dimensions.find((x) => x.Dimension__Id === drag.id);
            if (!dim) return;
            const result = Na__LeDim__OffsetFor(sheet, dim, cursor);                  // <-- The line lands on a parallel dimension's line when near it
            Na__LeDim__ShowInference(result);
            patch = { offsetMm : result.offsetMm };
        } else if (drag.mode === 'text') {
            let tdx = (s.tdx || 0) + d.x, tdy = (s.tdy || 0) + d.y;
            const minMm = Na__LeCfg__GetDimensionSetup().textLeaderMinMm;
            if (Math.hypot(tdx, tdy) < minMm) { tdx = 0; tdy = 0; }                 // <-- Close enough to home: drop the arc
            patch = { textDXMm : tdx, textDYMm : tdy };
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
        if (Na__LeSelBox__IsActive()) Na__LeTools__BoxUp(event);
        if (Na__LeTools__Editable && Na__LeTools__Tool === Na__LeTools__TOOL_RECT) Na__LeTools__RectangleUp(event);
        if (Na__LeTools__Editable && Na__LeTools__Tool === Na__LeTools__TOOL_LEADER) Na__LeTools__LeaderUp(event);
        const drag = Na__LeTools__Drag;
        if (!drag || event.pointerId !== drag.pointerId) return;
        Na__LeTools__FinishDrag(event.pointerId, event.type === 'pointerup');
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
        Na__LeMeasure__Refresh();                                            // <-- A rectangle dragged out has landed: the box reads it
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Button Comes Up Over a Selection Box
    // ------------------------------------------------------------
    // A box that was dragged out folds what it took into the selection. A press
    // that never became one was a click: on an item that cannot move (a locked
    // viewport, or anything in a read-only session) it selects that item, or
    // flips it with a modifier; on bare paper the press has already cleared the
    // selection. A cancelled pointer takes nothing.
    // ------------------------------------------------------------
    function Na__LeTools__BoxUp(event) {
        if (event.type === 'pointercancel') { Na__LeSelBox__Cancel(); return; }
        const sheet  = Na__LeModel__GetActiveSheet();
        const point  = Na__LeSurface__ClientToPaperMm(event.clientX, event.clientY);
        const result = Na__LeSelBox__Release(sheet, point, event.pointerId);
        if (!result) return;
        if (Na__LeTools__Stage) { try { Na__LeTools__Stage.releasePointerCapture(event.pointerId); } catch (e) { /* already released */ } }
        const taken = result.dragged ? result.items : (result.pending ? [ result.pending ] : null);
        if (taken) Na__LeModel__SetSelectionItems(Na__LeSelBox__Combine(Na__LeModel__GetSelectionItems(), Na__LeGroup__ResolveItems(sheet, taken), result.combine));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Button Comes Up Over a Leader Being Placed
    // ------------------------------------------------------------
    // A leader dragged out from its point lands its head where the button
    // lets go. A cancelled pointer lands nothing and abandons the leader.
    // ------------------------------------------------------------
    function Na__LeTools__LeaderUp(event) {
        const sheet = Na__LeModel__GetActiveSheet();
        if (event.type === 'pointercancel') { Na__LeLeader__Cancel(sheet); return; }
        const point = Na__LeSurface__ClientToPaperMm(event.clientX, event.clientY);
        if (sheet && point) Na__LeLeader__Release(sheet, point, event.pointerId);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Close a Drag Down and Commit What It Moved
    // ------------------------------------------------------------
    // Shared by the pointer release and by the suppression flag, so a
    // navigation gesture that interrupts a drag still leaves the record
    // committed rather than half moved. released is true only for a real
    // pointer up: a press that never moved then runs its click (narrowing or
    // trimming a multi-selection), which a pan taking the pointer never does.
    function Na__LeTools__FinishDrag(pointerId, released) {
        Na__LeOsnap__HideMarker();
        Na__LeGrips__HideInsert();
        Na__LeVpMove__Finish();                                              // <-- Frame back to normal, guides away; used-up tracking points go too
        const drag = Na__LeTools__Drag;
        if (!drag) return;
        if (pointerId !== null && pointerId !== undefined && Na__LeTools__Stage) {
            try { Na__LeTools__Stage.releasePointerCapture(pointerId); } catch (e) { /* already released */ }
        }
        Na__LeTools__Drag = null;
        document.body.classList.remove('na-le-dragging');
        Na__LeMeasure__Refresh();                                            // <-- A finished vertex drag puts the Measurements box back to rest
        if (!drag.moved) {
            if (drag.inserted) {                                             // <-- Shift-click on an edge: the vertex is in, even if it did not drag
                const sheet = Na__LeModel__GetActiveSheet();
                if (sheet) Na__LeModel__UpdateShape(sheet, drag.id, {}, false);
                return;
            }
            if (released === true && typeof drag.click === 'function') drag.click();
            return;
        }
        Na__LeVp2d__SetInteracting(false);
        Na__LeVp3d__SetInteracting(false);
        const sheet = Na__LeModel__GetActiveSheet();
        if (!sheet) return;
        if (drag.kind === 'door')            return;                                                // <-- A door press that moved changed nothing
        if (drag.kind === 'group')           { Na__LeSelSet__Commit(sheet, drag.group); return; }   // <-- Once per kind: one undo step for the lot
        if (drag.kind === 'viewport')        Na__LeModel__UpdateViewport(sheet, drag.id, {}, false);
        else if (drag.kind === 'annotation') Na__LeModel__UpdateAnnotation(sheet, drag.id, {}, false);
        else if (drag.kind === 'shape')      Na__LeModel__UpdateShape(sheet, drag.id, {}, false);
        else if (drag.kind === 'leader')     Na__LeModel__UpdateLeader(sheet, drag.id, {}, false);
        else                                 Na__LeModel__UpdateDimension(sheet, drag.id, {}, false);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Vertex Being Dragged, for the Measurements Box
    // ------------------------------------------------------------
    // Returns { from, to } in paper millimetres: the vertex where the drag
    // began, and where it is headed (the live point, or the cursor when that
    // has not moved yet). Null while no vertex is held.
    // ------------------------------------------------------------
    function Na__LeTools__GetVertexDrag() {
        const drag = Na__LeTools__Drag;
        if (!drag || drag.kind !== 'shape' || drag.mode !== 'vertex') return null;
        const from = drag.start && drag.start[drag.index];
        if (!from) return null;
        const sheet = Na__LeModel__GetActiveSheet();
        const shape = sheet ? Na__LeModel__GetShapeById(sheet, drag.id) : null;
        const live  = shape ? Na__LeShapeGeo__Points(shape)[drag.index] : null;
        const fromPt = { x : from[0], y : from[1] };
        const livePt = live ? { x : live[0], y : live[1] } : null;
        const run    = livePt ? Math.hypot(livePt.x - fromPt.x, livePt.y - fromPt.y) : 0;
        const cursor = Na__LeTools__LastPointMm;
        const to     = (run >= Na__LeTools__TYPED_MIN_MM) ? livePt : (cursor || livePt);
        return { from : fromPt, to : to };
    }
    // ------------------------------------------------------------


    // FUNCTION | Put a Dragged Vertex a Typed Distance Along the Drag
    // ------------------------------------------------------------
    // lengthMm is PAPER millimetres; a negative one runs back the other way.
    // The landing is exact (no snap). The drag is then finished so a still-
    // down pointer cannot pull the vertex back to the cursor. Returns
    // { ok : true } or { ok : false, reason } - 'none' with no vertex held,
    // 'length' for no length, 'direction' when the drag has no run to aim
    // along.
    // ------------------------------------------------------------
    function Na__LeTools__TypeVertexLength(lengthMm) {
        const drag = Na__LeTools__Drag;
        if (!drag || drag.kind !== 'shape' || drag.mode !== 'vertex') return { ok : false, reason : 'none' };
        if (!Number.isFinite(lengthMm) || Math.abs(lengthMm) < Na__LeTools__TYPED_MIN_MM) return { ok : false, reason : 'length' };
        const reading = Na__LeTools__GetVertexDrag();
        if (!reading || !reading.to) return { ok : false, reason : 'direction' };
        const dx  = reading.to.x - reading.from.x;
        const dy  = reading.to.y - reading.from.y;
        const run = Math.hypot(dx, dy);
        if (!(run >= Na__LeTools__TYPED_MIN_MM)) return { ok : false, reason : 'direction' };
        const sheet = Na__LeModel__GetActiveSheet();
        const from  = drag.start[drag.index];
        if (!sheet || !from) return { ok : false, reason : 'none' };
        const moved  = [ from[0] + ((dx / run) * lengthMm), from[1] + ((dy / run) * lengthMm) ];
        const points = drag.start.map((p, i) => (i === drag.index ? moved : [ p[0], p[1] ]));
        Na__LeModel__UpdateShape(sheet, drag.id, { points : points }, true);
        Na__LeSurface__Refresh('markup');
        drag.moved = true;
        Na__LeTools__FinishDrag(drag.pointerId, false);                      // <-- Announce once; the pointer no longer owns the vertex
        return { ok : true };
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
        Na__LeDoors__CancelPending();                                         // <-- The two clicks of a double click never toggle a door
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
            else if (markup.kind === 'leader')    Na__LeLeader__BeginEdit(markup.id);
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
        // by clicking with the tool, or both. palette: false leaves off "Use
        // for new ...", which viewports do not have.
        // ------------------------------------
        const style = (kind, id, opts) => {
            const items = [
                { label : label('MenuCopyStyle', 'Copy properties'), onSelect : () => Na__LeDrop__Pick(sheet, kind, id) },
                { label : label('MenuPasteStyle', 'Paste properties'), disabled : !Na__LeDrop__CanApply(sheet, kind, id).ok,
                  onSelect : () => Na__LeDrop__Paint(sheet, kind, id) }
            ];
            if (!opts || opts.palette !== false) {
                items.push({ label : Na__LeDrop__PaletteMenuLabel(kind), onSelect : () => { Na__LeTools__SyncPaletteFrom(sheet, { kind : kind, id : id }); } });
            }
            items.push({ separator : true });
            return items;
        };

        const history = [
            { label : label('Undo', 'Undo'), disabled : !Na__LeHist__CanUndo(), onSelect : () => Na__LeHist__Undo() },
            { label : label('Redo', 'Redo'), disabled : !Na__LeHist__CanRedo(), onSelect : () => Na__LeHist__Redo() }
        ];
        if (!Na__LeTools__Editable) return [ { label : label('MenuZoomFit', 'Zoom to fit'), onSelect : () => Na__LeNav__Fit() } ];
        // SEVERAL SELECTED | A right click on one of them is about all of them
        const selected = Na__LeModel__GetSelectionItems();
        if (found && selected.length > 1 && Na__LeModel__IsSelected(found.kind, found.id)) {
            const groupOps = [];
            if (Na__LeGroup__CanGroup(sheet))   groupOps.push({ label : label('MenuGroup', 'Group'),     onSelect : () => { Na__LeGroup__Group(sheet); } });
            if (Na__LeGroup__CanUngroup(sheet)) groupOps.push({ label : label('MenuUngroup', 'Ungroup'), onSelect : () => { Na__LeGroup__Ungroup(sheet); } });
            return groupOps.concat(Na__LeClip__MenuItems(sheet, found, pointMm), [
                { separator : true },
                { label : Na__LeCfg__FormatLabel('MenuDeleteSelection', 'Delete {count} selected items', { count : selected.length }), danger : true,
                  onSelect : () => { void Na__LeTools__DeleteSelection(); } },
                { separator : true }
            ]).concat(history);
        }
        if (!found) {
            const snapping = Na__LeOsnap__IsEnabled();
            return [
                { label : label('MenuZoomFit', 'Zoom to fit'), onSelect : () => Na__LeNav__Fit() },
                { label : snapping ? label('MenuSnapOff', 'Snapping off') : label('MenuSnapOn', 'Snapping on'), checked : snapping, onSelect : () => Na__LeOsnap__Toggle() },
                { separator : true }
            ].concat(Na__LeClip__MenuItems(sheet, null, pointMm), [                  // <-- Paste viewport or vector, with its corner at the click
                { separator : true },
                { label : label('MenuForceRenderSheet', 'Re-render every viewport on this sheet'), disabled : Na__LeForce__IsRunning(),
                  onSelect : () => { void Na__LeForce__Sheet(sheet); } },
                { separator : true }
            ]).concat(history);
        }
        if (found.kind === 'annotation') {
            return [ { label : label('MenuEditText', 'Edit text'), onSelect : () => Na__LeText__BeginEdit(found.id) },
                     remove('MenuDeleteText', 'Delete text'), { separator : true } ]
                     .concat(Na__LeClip__MenuItems(sheet, found, pointMm), style(found.kind, found.id)).concat(history);
        }
        if (found.kind === 'group') {
            return [ { label : label('MenuUngroup', 'Ungroup'), disabled : !Na__LeGroup__CanUngroup(sheet), onSelect : () => { Na__LeGroup__Ungroup(sheet); } },
                     remove('MenuDeleteGroup', 'Delete group'), { separator : true } ]
                     .concat(Na__LeClip__MenuItems(sheet, found, pointMm), history);
        }
        if (found.kind === 'dimension') {
            const dim = Na__LeTools__Record(sheet, found);
            const items = [
                { label : label('MenuEditDimText', 'Edit dimension value'), onSelect : () => Na__LeDim__BeginTextEdit(found.id) }
            ];
            if (dim && (Number.isFinite(dim.Dimension__TextDXMm) || Number.isFinite(dim.Dimension__TextDYMm))) {
                items.push({ label : label('MenuResetDimText', 'Reset text position'), onSelect : () => Na__LeModel__UpdateDimension(sheet, found.id, { textDXMm : 0, textDYMm : 0 }, false) });
            }
            return items.concat([ remove('MenuDeleteDimension', 'Delete dimension'), { separator : true } ])
                     .concat(style(found.kind, found.id)).concat(history);
        }
        if (found.kind === 'leader') {
            return [ { label : label('MenuEditLeaderText', 'Edit leader text'), onSelect : () => Na__LeLeader__BeginEdit(found.id) },
                     remove('MenuDeleteLeader', 'Delete leader'), { separator : true } ]
                     .concat(style(found.kind, found.id)).concat(history);
        }
        if (found.kind === 'shape') {
            const shape  = Na__LeTools__Record(sheet, found);
            const closed = !!shape && shape.Shape__Closed === true;
            return [ { label : closed ? label('MenuOpenShape', 'Open shape') : label('MenuCloseShape', 'Close shape'), disabled : !shape || Na__LeShapeGeo__Points(shape).length < 3,
                       onSelect : () => Na__LeModel__UpdateShape(sheet, found.id, { closed : !closed }) },
                     remove('MenuDeleteShape', 'Delete shape'), { separator : true } ]
                     .concat(Na__LeClip__MenuItems(sheet, shape || found, pointMm), style(found.kind, found.id)).concat(history);
        }

        const viewport = Na__LeModel__GetViewportById(sheet, found.id);
        if (!viewport) return history;
        const layerLocked = Na__LeModel__IsLayerLocked(sheet, viewport.Viewport__LayerId);
        const locked      = layerLocked || viewport.Viewport__Locked === true;
        const editing     = Na__LeSurface__GetEditingViewport() === found.id;
        const del         = remove('MenuDeleteViewport', 'Delete viewport');
        del.disabled = locked;
        const doors = Na__LeDoors__MenuItems(sheet, viewport, viewport.Viewport__Kind === Na__LeModel__KIND_2D ? Na__LeVp2d__Describe(viewport) : null, pointMm, Na__LeTools__Tolerance());   // <-- A plan's door under the click leads the menu, locked or not
        return [
            ...doors,
            { label : editing ? label('MenuFinishView', 'Finish editing content') : label('MenuEditView', 'Edit viewport content'), disabled : locked, onSelect : () => Na__LeTools__SetEditingViewport(editing ? null : found.id) },
            { label : label('MenuCentre', 'Recentre content'), disabled : locked, onSelect : () => Na__LeTools__RecentreViewport(sheet, found.id) },
            { label : viewport.Viewport__Locked === true ? label('MenuUnlock', 'Unlock viewport') : label('MenuLock', 'Lock viewport'), disabled : layerLocked, checked : viewport.Viewport__Locked === true,
              onSelect : () => Na__LeModel__UpdateViewport(sheet, found.id, { locked : viewport.Viewport__Locked !== true }) },
            { separator : true }
        ].concat(locked ? [] : style(found.kind, found.id, { palette : false }), Na__LeClip__MenuItems(sheet, viewport, pointMm), Na__LeSource__MenuItems(sheet, viewport, locked), [   // <-- Copy, duplicate and paste viewport; then the design phase it draws
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
        if (Na__LeLeader__IsPlacing()) { Na__LeLeader__Cancel(sheet); return; }   // <-- Nor has a leader with no head
        if (Na__LeText__IsEditing()) Na__LeText__Commit();
        const found = Na__LeTools__Resolve(sheet, point);
        const keep  = !!found && Na__LeModel__GetSelectionItems().length > 1 && Na__LeModel__IsSelected(found.kind, found.id);   // <-- A right click on one of several selected keeps them all
        if (!keep) Na__LeModel__SetSelection(found ? { kind : found.kind, id : found.id } : null);
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
        const items = Na__LeModel__GetSelectionItems();
        if (sheet && Na__LeTools__Editable && (items.length > 1 || items.some((item) => item && item.kind === 'group'))) return Na__LeSelSet__Delete(sheet, Na__LeGroup__Expand(sheet, items));   // <-- Several, or a group: one undo step
        const selection = Na__LeModel__GetSelection();
        if (!sheet || !selection || !Na__LeTools__Editable) return false;
        if (selection.kind === 'annotation') return Na__LeModel__DeleteAnnotation(sheet, selection.id);
        if (selection.kind === 'dimension')  return Na__LeModel__DeleteDimension(sheet, selection.id);
        if (selection.kind === 'shape')      return Na__LeModel__DeleteShape(sheet, selection.id);
        if (selection.kind === 'leader')     return Na__LeModel__DeleteLeader(sheet, selection.id);
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
        const items = Na__LeModel__GetSelectionItems();
        if (sheet && (items.length > 1 || items.some((item) => item && item.kind === 'group'))) return Na__LeSelSet__Nudge(sheet, Na__LeGroup__Expand(sheet, items), dx, dy);   // <-- Several, or a group: every movable member by the same step
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
        if (selection.kind === 'leader') {
            if (Na__LeModel__IsLayerLocked(sheet, record.Leader__LayerId)) return false;
            return Na__LeModel__UpdateLeader(sheet, selection.id, Na__LeLeadGeo__Translated(record, dx, dy), false);   // <-- A nudge moves the whole leader
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
        if (Na__LeRect__IsDrawing() || Na__LeLeader__IsPlacing()) return true;   // <-- Nothing to lock, and nudging the old selection mid-placement would surprise
        const drawing  = Na__LeShape__IsDrawing();
        const spanning = Na__LeDim__IsSpanning();                            // <-- Only the span phase: the offset phase has no axis to lock
        if (!drawing && !spanning) return false;
        Na__LeAxis__Toggle(axis);
        const sheet = Na__LeModel__GetActiveSheet();
        const point = Na__LeTools__LastPointMm;
        if (sheet && point) {                                                // <-- Show the lock at once rather than on the next move
            if (drawing) Na__LeShape__Move(sheet, point, shift);
            else Na__LeDim__Move(sheet, point, shift);
            Na__LeMeasure__Refresh();
        }
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Shift Went Down or Up: Redraw a Dimension Line Being Placed
    // ------------------------------------------------------------
    // Shift turns the dimension whose line is following the cursor ortho, but
    // the pointer only reports Shift when it moves: without this, pressing
    // Shift over a still mouse showed nothing until the mouse was nudged.
    // Redraws from the last pointer position. Returns true when it did.
    // ------------------------------------------------------------
    function Na__LeTools__ShiftRedraw(shift) {
        Na__LeTools__ShiftHeld = !!shift;                                    // <-- Remembered for a value typed into the Measurements box
        const sheet = Na__LeModel__GetActiveSheet();
        const point = Na__LeTools__LastPointMm;
        Na__LeTools__RefreshShapeInsert(sheet, point, shift);                 // <-- The insert diamond appears as soon as Shift goes down, without a mouse nudge
        if (!Na__LeTools__Editable || Na__LeTools__Tool !== Na__LeTools__TOOL_DIMENSION || !Na__LeDim__IsPlacingLine()) return false;
        if (!sheet || !point) return false;
        Na__LeDim__Move(sheet, point, shift);
        Na__LeMeasure__Refresh();
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Run the Placing Tool's Move Again From the Last Pointer Position
    // ------------------------------------------------------------
    // Once the Measurements box has placed a point, the band sets off again
    // from it towards wherever the cursor is, without waiting for the mouse
    // to move. Returns true when a placing tool was up to run.
    // ------------------------------------------------------------
    function Na__LeTools__Rerun() {
        const sheet = Na__LeModel__GetActiveSheet();
        const point = Na__LeTools__LastPointMm;
        if (!Na__LeTools__Editable || !sheet || !point) return false;
        if (Na__LeTools__Tool === Na__LeTools__TOOL_DRAW)           Na__LeShape__Move(sheet, point, Na__LeTools__ShiftHeld);
        else if (Na__LeTools__Tool === Na__LeTools__TOOL_DIMENSION) Na__LeDim__Move(sheet, point, Na__LeTools__ShiftHeld);
        else if (Na__LeTools__Tool === Na__LeTools__TOOL_RECT)      Na__LeRect__Move(sheet, point, Na__LeTools__ShiftHeld, false);
        else return false;
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is the Focus in a Field That Takes Typed Text
    // ------------------------------------------------------------
    // A text box, a text area or an editable region: somewhere Ctrl+Z and
    // Ctrl+V already mean something to the field itself. A number box is not
    // one of those - once Edge pt has been applied it has no undo of its own -
    // so it is treated like a checkbox and the sheet chords still reach here.
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
        // A SELECT, A CHECKBOX OR A NUMBER BOX KEEPS ITS BARE KEYS - an arrow
        // or a digit means something to it - but it has no undo or paste of its
        // own, so a Ctrl chord belongs to the sheet. Without this, Ctrl+Z
        // straight after choosing a scene in the Viewport panel, or after
        // changing Edge pt on a vector, went nowhere: the control still had
        // the focus.
        if (guard && Na__LeTools__SHEET_CHORDS.indexOf(match.action) === -1) return;
        const step  = match.coarse ? keys.nudgeCoarseStepMm : keys.nudgeStepMm;
        const sheet = Na__LeModel__GetActiveSheet();

        switch (match.action) {
            case 'Edit__Cancel':
                Na__LeVpMove__Clear();                                                    // <-- Tracking points go, whatever else Esc backs out of
                if (Na__LeSelBox__IsActive()) Na__LeSelBox__Cancel();                     // <-- A selection box being dragged out goes first, and on its own
                else if (Na__LeDim__IsPlacing() || Na__LeShape__IsDrawing() || Na__LeRect__IsDrawing() || Na__LeLeader__IsPlacing()) Na__LeTools__CancelPlacement();
                else if (Na__LeDrop__HasSource()) Na__LeDrop__Clear();                    // <-- First Esc empties the dropper, second puts the tool down
                else if (Na__LeSurface__GetEditingViewport()) Na__LeTools__SetEditingViewport(null);
                else if (Na__LeModel__GetSelectionItems().length) Na__LeModel__SetSelection(null);
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
                if (Na__LeModel__GetSelectionItems().length) { event.preventDefault(); void Na__LeTools__DeleteSelection(); }
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
            case 'Tool__Leader':     Na__LeTools__SetTool(Na__LeTools__TOOL_LEADER);    return;
            case 'Tool__Eyedropper': Na__LeTools__ArmEyedropper();                      return;
            case 'Tool__EyedropperPalette': Na__LeTools__ArmPalette();                  return;
            case 'Snap__Toggle':     Na__LeOsnap__Toggle(); event.preventDefault(); return;
            case 'Edit__Undo':
                if (Na__LeShape__IsDrawing() && sheet) { event.preventDefault(); Na__LeShape__UndoVertex(sheet); Na__LeMeasure__Refresh(); return; }
                if (Na__LeRect__IsDrawing()) { event.preventDefault(); Na__LeRect__Cancel(); Na__LeMeasure__Refresh(); return; }   // <-- A rubber box is not a record yet: undo it the way Escape does
                if (Na__LeTools__Editable) { event.preventDefault(); Na__LeHist__Undo(); }
                return;
            case 'Edit__Redo':
                if (Na__LeShape__IsDrawing() && sheet) { event.preventDefault(); Na__LeShape__RedoVertex(sheet); Na__LeMeasure__Refresh(); return; }
                if (Na__LeRect__IsDrawing()) { event.preventDefault(); return; }   // <-- Nothing to redo on a rubber box; do not step the sheet either
                if (Na__LeTools__Editable) { event.preventDefault(); Na__LeHist__Redo(); }
                return;
            case 'Edit__Copy':
            case 'Edit__Paste':      if (Na__LeClip__RunKeyAction(match.action, Na__LeTools__Editable)) event.preventDefault(); return;   // <-- Nothing to copy or paste: the browser keeps the key
            case 'Edit__Duplicate':  if (Na__LeTools__Editable) { event.preventDefault(); Na__LeClip__RunKeyAction(match.action, true); } return;   // <-- Never the bookmark dialog while a sheet is open
            case 'Edit__Group':      if (Na__LeTools__Editable && sheet && Na__LeGroup__Group(sheet)) event.preventDefault(); return;
            case 'Edit__Ungroup':    if (Na__LeTools__Editable && sheet && Na__LeGroup__Ungroup(sheet)) event.preventDefault(); return;
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
            keydown       : (e) => { Na__LeTools__OnKey(e); if (e.key === 'Shift') Na__LeTools__ShiftRedraw(!!e.shiftKey); },   // <-- Shift turns a dimension being placed ortho: show it without waiting for the mouse
            keyup         : (e) => { if (e.key === 'Shift') Na__LeTools__ShiftRedraw(!!e.shiftKey); },
            dropperdraw   : () => { const sheet = Na__LeModel__GetActiveSheet(); Na__LeDrop__Refresh(sheet); Na__LeVpMove__Refresh(sheet); Na__LeSelBox__Refresh(sheet); requestAnimationFrame(() => { const els = Na__LeSurface__GetElements(); if (els && els.handles && sheet) Na__LeGroup__Render(els.handles, sheet, Na__LeModel__GetSelectionItems(), Na__LeSurface__GetPixelsPerMm(), Na__LeSurface__GetZoom()); }); }   // <-- The eyedropper's boxes, the tracking crosses and a selection box are counter-scaled, like the grips; groups paint after the surface clears the layer
        };
        [ 'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'dblclick', 'contextmenu' ].forEach((name) => Na__LeTools__Stage.addEventListener(name, Na__LeTools__Handlers[name]));
        window.addEventListener('keydown', Na__LeTools__Handlers.keydown);
        window.addEventListener('keyup', Na__LeTools__Handlers.keyup);
        [ Na__LeSurface__ZOOM_EVENT, Na__LeModel__CHANGED_EVENT ].forEach((name) => window.addEventListener(name, Na__LeTools__Handlers.dropperdraw));
        Na__LeMeasure__Attach({                                              // <-- The Measurements box reads the tools through these, and never imports them back
            getTool              : () => Na__LeTools__Tool,
            isEditable           : () => Na__LeTools__Editable,
            getShapeDefaults     : () => Na__LeTools__GetShapeDefaults(),
            getDimensionDefaults : () => Na__LeTools__GetDimensionDefaults(),
            getShift             : () => Na__LeTools__ShiftHeld,
            getPointMm           : () => Na__LeTools__LastPointMm,
            rerun                : () => Na__LeTools__Rerun(),
            getVertexDrag        : () => Na__LeTools__GetVertexDrag(),
            typeVertexLength     : (paperMm) => Na__LeTools__TypeVertexLength(paperMm)
        });
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
        Na__LeMeasure__Detach();                                             // <-- The box is put away with the tools, and its keys with it
        if (!Na__LeTools__Stage || !Na__LeTools__Handlers) return;
        [ 'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'dblclick', 'contextmenu' ].forEach((name) => Na__LeTools__Stage.removeEventListener(name, Na__LeTools__Handlers[name]));
        window.removeEventListener('keydown', Na__LeTools__Handlers.keydown);
        window.removeEventListener('keyup', Na__LeTools__Handlers.keyup);
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
        Na__LeTools__TOOL_LEADER,
        Na__LeTools__CHANGED_EVENT,
        Na__LeTools__DEFAULTS_EVENT,
        Na__LeTools__Attach,
        Na__LeTools__Detach,
        Na__LeTools__SetTool,
        Na__LeTools__GetTool,
        Na__LeTools__ArmEyedropper,
        Na__LeTools__ArmPalette,
        Na__LeTools__GetTextDefaults,
        Na__LeTools__SetTextDefaults,
        Na__LeTools__GetDimensionDefaults,
        Na__LeTools__SetDimensionDefaults,
        Na__LeTools__GetShapeDefaults,
        Na__LeTools__SetShapeDefaults,
        Na__LeTools__GetLeaderDefaults,
        Na__LeTools__SetLeaderDefaults,
        Na__LeText__BeginEdit as Na__LeTools__BeginTextEdit,
        Na__LeTools__DeleteSelection,
        Na__LeTools__SetEditingViewport,
        Na__LeTools__RecentreViewport,
        Na__LeTools__SetSuppressed
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
