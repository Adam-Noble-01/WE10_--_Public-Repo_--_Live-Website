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
//   of it. Inside a 3D viewport's content the wheel zooms its picture
//   (Na__LayoutEditor__Viewport3dZoom__), and Enter finishes, keeping the
//   zoom. Dimensions: grips re-pick the points and slide the line (with
//   inference); double-click edits the value. Clicking the value and
//   dragging it moves the text and draws a curved leader back to the
//   centre of the dimension line. Shapes: grips move vertices; a drag of
//   the whole shape snaps to the linework; Shift-click an edge inserts a
//   vertex.
// - Text: the round grip on a stem off the top of a selected text item turns
//   it about the middle of its box (Na__LayoutEditor__TextTool__), holding
//   RotateStepDeg steps with Shift; the right-click menu's Reset rotation
//   levels it again.
// - Plan doors: a click on a door in the selected plan viewport closes it or
//   opens it again (Na__LayoutEditor__PlanDoors__).
// - A press on a point of a 2D viewport's own linework carries the viewport
//   BY that point, snapping it onto or into line with other drawings, through
//   Na__LayoutEditor__ViewportSnapMove__. Hovering shows the point first.
// - Keys: Delete removes the selection (a viewport asks first), Escape
//   backs out, Space clears the selection, Enter finishes a shape or the
//   editing of a viewport's content, arrows nudge by a millimetre (ten with
//   Shift), V T D L R B pick a tool, Ctrl+Z
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
//   pointer point, Shift, a way to run the tool's move again, the vertex
//   being dragged and the viewport being moved; it is refreshed after every
//   move and press. A value typed while the Draw, Rectangle or Dimension tool
//   is up, or while a vertex or a viewport is being dragged, is the box's
//   before these keys see it, so Enter and Escape reach the tools as before
//   whenever nothing is typed. A length typed during a vertex drag moves that
//   vertex that far along the drag (TypeVertexLength); during a viewport
//   frame drag it moves the frame (TypeViewportLength).
// - A right click that did not pan opens the context menu for what is
//   under the cursor, in the same order as selection. Arrange (Bring to
//   front / forward, Send backward / to back) restacks a vector, a text
//   item, a dimension or a leader among the others of its kind on the
//   same layer.
// - Box select (Na__LayoutEditor__SelectionBox__): a drag that starts where
//   there is nothing to move - bare paper, the grey stage, a locked viewport,
//   or anywhere with Alt held - draws a window to the right or a crossing to
//   the left. Ctrl adds, Shift toggles and Ctrl+Shift removes, for a box and a
//   click alike. Several selected items move, nudge and delete together, each
//   one undo step (Na__LayoutEditor__SelectionSet__); a click on one of them
//   that does not move narrows the selection to it.
// - Read-only sessions (the web build) still select and inspect; every
//   mutation is gated on the editable flag.
// - THE UNITS (1.29.0). This file keeps Attach and Detach, the listeners map
//   and the public API: every name it exported is still exported here, most
//   of them re-exported from the unit that now holds the code.
//   - Na__LayoutEditor__SheetTools__State__: the tool names, the events and
//     constants, and the interaction state more than one file writes.
//   - Na__LayoutEditor__SheetTools__ToolState__: the settings for new
//     objects, the active tool, CancelPlacement, ArmEyedropper, ArmPalette
//     and the palette sync.
//   - Na__LayoutEditor__SheetTools__HitResolution__: Resolve, Record,
//     IsViewportLocked, HoverCursor, DoorAt, CarryTarget, the hit tolerance
//     and the vector grab, insert and snap helpers.
//   - Na__LayoutEditor__SheetTools__ContentEditing__: SetEditingViewport and
//     RecentreViewport.
//   - Na__LayoutEditor__SheetTools__PointerPress__: the press and the double
//     click.
//   - Na__LayoutEditor__SheetTools__PointerDrag__: the move, the drag, the
//     release, the typed lengths for the Measurements box, and SetSuppressed.
//   - Na__LayoutEditor__SheetTools__Keyboard__: the keys, DeleteSelection,
//     Nudge, ShiftRedraw and Rerun.
//   - Na__LayoutEditor__SheetTools__ContextMenu__: the right click and its
//     menu.
//
// INTEGRATION:
// - Attached by the mode controller while the editor is on screen.
// - The app imports only this file; the units are private to the sheet tools.
// - Import direction: this file imports the units, and no unit imports it.
//   Each unit imports only units listed before it here: State (no imports),
//   ToolState, HitResolution, ContentEditing, PointerDrag, PointerPress,
//   Keyboard, ContextMenu. There is no cycle.
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
// 19-Sep-2026 - Version 1.31.0
// - SELECT PICKS THE MOVE TOOL UP BY ITSELF for what is usually moved next:
//   text, a vector, a leader by its bubble, note or curve, and a group
//   (parametric ones included). The press that picks one carries straight on
//   into the drag, and a box that leaves only those kinds selected picks Move
//   up too. Viewports, dimensions and a leader's endpoint do not - they still
//   wait for M, which is what the 17-Sep safety catch was for.
// - A Move that came up by itself goes back to Select by itself: on a press on
//   anything that does not pick it up, when the selection empties (Attach
//   listens to the model and the container events and runs SettleAutoMove),
//   and when a double click steps inside a group, a vector, a dimension, a
//   text or a viewport's content. M or the toolbar gives a Move that stays.
// - A press that picks, and the second press of a double click, travel
//   PickDragPx before they move anything, and a double click whose second press
//   travelled is ignored: a fast double click always steps inside, and "click,
//   then at once drag" is only ever a move.
// - IsMoveAuto is exported: the margin grip stays up under a Move that came up
//   by itself, as it does under Select.
//
//
// 17-Sep-2026 - Version 1.30.0
// - CONTAINER EDITING, THE MOVE TOOL AND A REAL "NO TOOL" STATE. New unit
//   Na__LayoutEditor__EditScope__ holds the context stack - a group, a vector or
//   a dimension open for editing - and the points picked inside it. Double-click
//   or Enter steps in, a click outside steps out, Escape closes everything and
//   puts the tools down. While a container is open the rest of the sheet is
//   faded and inert, and only its own points answer a press.
// - Grips are a container's insides: a vector's vertices and a dimension's
//   grips are drawn, and draggable, only while that object is open. A picked one
//   draws red. Inserting and deleting points lives in there too.
// - The Move tool (M) is the only thing that translates a whole object. Select
//   picks; grips, crop handles and viewport content editing are unchanged.
// - The space bar picks Select, beside V, and Escape comes back to Select:
//   there is one resting state and the sheet always answers a press.
// - Attach listens for the scope event and books the surface redraw; a model
//   change prunes a container whose record has gone; Detach closes them all.
//
//
// 15-Sep-2026 - Version 1.29.0
// - Split into Na__LayoutEditor__SheetTools__State__.js,
//   Na__LayoutEditor__SheetTools__ToolState__.js,
//   Na__LayoutEditor__SheetTools__HitResolution__.js,
//   Na__LayoutEditor__SheetTools__ContentEditing__.js,
//   Na__LayoutEditor__SheetTools__PointerPress__.js,
//   Na__LayoutEditor__SheetTools__PointerDrag__.js,
//   Na__LayoutEditor__SheetTools__Keyboard__.js and
//   Na__LayoutEditor__SheetTools__ContextMenu__.js to stay under the line
//   budget. No behaviour change: the code moved verbatim and every export is
//   unchanged.
// - The only changed code lines: the state more than one file writes (the
//   stage, the editable flag, the drag, the suppression flag, the right
//   press, the last point and Shift) is assigned through the Write accessors
//   in Na__LayoutEditor__SheetTools__State__, because an imported binding
//   cannot be assigned. The drag of a press on a door of a locked plan goes
//   through WriteDrag like the others.
// - The same split as ValeVision3D v2.47.0 (SheetTools 1.24.0): the same
//   units holding the same functions. DoorAt and CarryTarget, which only
//   TrueVision has, are in Na__LayoutEditor__SheetTools__HitResolution__.
//
// 14-Sep-2026 - Version 1.28.0
// - Rotate text: Resolve looks for the one selected text item's rotate grip
//   before anything else (RotateGripAt), because the grip stands off the text
//   where no hit test would find it. A press on it drags the angle through
//   Na__LeText__RotateStart and RotateTo, Shift holding the steps, and the
//   release announces it once. The cursor over the grip is ROTATE_CURSOR.
//   The text menu offers Reset rotation on turned text. The text defaults
//   carry rotationDeg (0), which the Text panel sets for new text.
//
// 14-Sep-2026 - Version 1.27.0
// - Enter finishes the editing of a viewport's content, as Escape already did:
//   the way a 3D viewport's zoom is set and left
//   (Na__LayoutEditor__Viewport3dZoom__). Recentre content centres a 3D
//   picture at the zoom it is drawn at, rather than pinning its corner to the
//   frame's.
//
// 14-Sep-2026 - Version 1.26.0
// - Right-click Arrange: Bring to front, Bring forward, Send backward and
//   Send to back, for a vector, a text item, a dimension or a leader among
//   the other items of its kind on the same layer.
//
// 14-Sep-2026 - Version 1.25.0
// - The shape defaults carry the dashed-edge style: dashOn and its settings,
//   seeded from Na__LayoutEditor__LineStyleTool__ and kept through the toggle.
//
// 14-Sep-2026 - Version 1.24.0
// - While a viewport's frame is being dragged (not a handle, not the drawing
//   inside), the Measurements box takes a typed length: GetViewportDrag is
//   the frame origin and where it is headed, TypeViewportLength puts it that
//   far along that direction (no snap) and finishes the drag. The length is
//   a real size at the viewport's scale, or the sheet's for a 3D viewport.
//
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

    // MODULE IMPORTS | Model, Surface, Text Tool, Measurements, Eyedropper, Viewport Snap Move, Groups, Selection Box, Menu
    // ------------------------------------------------------------
    import { Na__LeModel__CHANGED_EVENT, Na__LeModel__GetActiveSheet, Na__LeModel__GetSelectionItems } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import {
        Na__LeSurface__ZOOM_EVENT,
        Na__LeSurface__GetElements,
        Na__LeSurface__GetPixelsPerMm,
        Na__LeSurface__GetZoom,
        Na__LeSurface__Refresh
    } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeText__BeginEdit, Na__LeText__Cancel } from '../35__System__DrawingTools/Na__LayoutEditor__TextTool__.js';
    import { Na__LeMeasure__Attach, Na__LeMeasure__Detach } from './Na__LayoutEditor__Measurements__.js';
    import { Na__LeDrop__Refresh } from './Na__LayoutEditor__Eyedropper__.js';
    import { Na__LeVpMove__Refresh } from '../20__System__Viewports/Na__LayoutEditor__ViewportSnapMove__.js';
    import { Na__LeGroup__Render } from '../15__Core__Markup/Na__LayoutEditor__Groups__.js';
    import { Na__LeSelBox__Refresh } from './Na__LayoutEditor__SelectionBox__.js';
    import { Na__LeScope__CHANGED_EVENT, Na__LeScope__Clear, Na__LeScope__Prune } from './Na__LayoutEditor__EditScope__.js';
    import { Na__LeMenu__Close } from './Na__LayoutEditor__ContextMenu__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Sheet Tools Units
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
        Na__LeTools__CHANGED_EVENT,
        Na__LeTools__DEFAULTS_EVENT,
        Na__LeTools__Stage,
        Na__LeTools__Editable,
        Na__LeTools__LastPointMm,
        Na__LeTools__ShiftHeld,
        Na__LeTools__WriteStage,
        Na__LeTools__WriteEditable,
        Na__LeTools__WriteDrag,
        Na__LeTools__WriteSuppressed,
        Na__LeTools__WriteRightPress,
        Na__LeTools__WriteLastPointMm
    } from './Na__LayoutEditor__SheetTools__State__.js';
    import {
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
        Na__LeTools__IsMoveAuto,
        Na__LeTools__ArmEyedropper,
        Na__LeTools__ArmPalette
    } from './Na__LayoutEditor__SheetTools__ToolState__.js';
    import { Na__LeTools__SetEditingViewport, Na__LeTools__RecentreViewport } from './Na__LayoutEditor__SheetTools__ContentEditing__.js';
    import {
        Na__LeTools__OnMove,
        Na__LeTools__OnUp,
        Na__LeTools__GetMoveDrag,
        Na__LeTools__TypeMoveLength,
        Na__LeTools__GetVertexDrag,
        Na__LeTools__GetVertexRetype,
        Na__LeTools__GetDimEndDrag,
        Na__LeTools__GetDimEndRetype,
        Na__LeTools__TypeDimensionSpan,
        Na__LeTools__GetDimOffsetDrag,
        Na__LeTools__GetDimOffsetRetype,
        Na__LeTools__TypeDimensionOffset,
        Na__LeTools__TypeVertexLength,
        Na__LeTools__GetViewportDrag,
        Na__LeTools__TypeViewportLength,
        Na__LeTools__SetSuppressed
    } from './Na__LayoutEditor__SheetTools__PointerDrag__.js';
    import { Na__LeTools__OnDown, Na__LeTools__OnDoubleClick, Na__LeTools__SettleAutoMove } from './Na__LayoutEditor__SheetTools__PointerPress__.js';
    import {
        Na__LeTools__DeleteSelection,
        Na__LeTools__ShiftRedraw,
        Na__LeTools__Rerun,
        Na__LeTools__OnKey
    } from './Na__LayoutEditor__SheetTools__Keyboard__.js';
    import { Na__LeTools__OnContextMenu } from './Na__LayoutEditor__SheetTools__ContextMenu__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Listeners While Attached (the shared state is in Na__LayoutEditor__SheetTools__State__)
    // ------------------------------------------------------------
    let Na__LeTools__Handlers   = null;
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
        Na__LeTools__WriteStage(els.stage);
        Na__LeTools__WriteEditable(!!(options && options.editable));
        Na__LeTools__Handlers = {
            pointerdown   : (e) => Na__LeTools__OnDown(e),
            pointermove   : (e) => Na__LeTools__OnMove(e),
            pointerup     : (e) => Na__LeTools__OnUp(e),
            pointercancel : (e) => Na__LeTools__OnUp(e),
            dblclick      : (e) => Na__LeTools__OnDoubleClick(e),
            contextmenu   : (e) => Na__LeTools__OnContextMenu(e),
            keydown       : (e) => { Na__LeTools__OnKey(e); if (e.key === 'Shift') Na__LeTools__ShiftRedraw(!!e.shiftKey); },   // <-- Shift turns a dimension being placed ortho: show it without waiting for the mouse
            keyup         : (e) => { if (e.key === 'Shift') Na__LeTools__ShiftRedraw(!!e.shiftKey); },
            scopedraw     : () => Na__LeSurface__Refresh('scope'),            // <-- Opening or closing a container fades the sheet and redraws its contents
            settlemove    : () => Na__LeTools__SettleAutoMove(),              // <-- A Move that came up by itself goes back down when the selection stops warranting it (Delete, an undo, a container opening or closing)
            dropperdraw   : () => { const sheet = Na__LeModel__GetActiveSheet(); Na__LeScope__Prune(sheet); Na__LeDrop__Refresh(sheet); Na__LeVpMove__Refresh(sheet); Na__LeSelBox__Refresh(sheet); requestAnimationFrame(() => { const els = Na__LeSurface__GetElements(); if (els && els.handles && sheet) Na__LeGroup__Render(els.handles, sheet, Na__LeModel__GetSelectionItems(), Na__LeSurface__GetPixelsPerMm(), Na__LeSurface__GetZoom()); }); }   // <-- The eyedropper's boxes, the tracking crosses and a selection box are counter-scaled, like the grips; groups paint after the surface clears the layer
        };
        [ 'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'dblclick', 'contextmenu' ].forEach((name) => Na__LeTools__Stage.addEventListener(name, Na__LeTools__Handlers[name]));
        window.addEventListener('keydown', Na__LeTools__Handlers.keydown);
        window.addEventListener('keyup', Na__LeTools__Handlers.keyup);
        [ Na__LeSurface__ZOOM_EVENT, Na__LeModel__CHANGED_EVENT ].forEach((name) => window.addEventListener(name, Na__LeTools__Handlers.dropperdraw));
        window.addEventListener(Na__LeScope__CHANGED_EVENT, Na__LeTools__Handlers.scopedraw);
        [ Na__LeModel__CHANGED_EVENT, Na__LeScope__CHANGED_EVENT ].forEach((name) => window.addEventListener(name, Na__LeTools__Handlers.settlemove));
        Na__LeMeasure__Attach({                                              // <-- The Measurements box reads the tools through these, and never imports them back
            getTool              : () => Na__LeTools__Tool,
            isEditable           : () => Na__LeTools__Editable,
            getShapeDefaults     : () => Na__LeTools__GetShapeDefaults(),
            getDimensionDefaults : () => Na__LeTools__GetDimensionDefaults(),
            getShift             : () => Na__LeTools__ShiftHeld,
            getPointMm           : () => Na__LeTools__LastPointMm,
            rerun                : () => Na__LeTools__Rerun(),
            getVertexDrag        : () => Na__LeTools__GetVertexDrag(),
            getVertexRetype      : () => Na__LeTools__GetVertexRetype(),
            getDimEndDrag        : () => Na__LeTools__GetDimEndDrag(),
            getDimEndRetype      : () => Na__LeTools__GetDimEndRetype(),
            typeDimensionSpan    : (paperMm) => Na__LeTools__TypeDimensionSpan(paperMm),
            getDimOffsetDrag     : () => Na__LeTools__GetDimOffsetDrag(),
            getDimOffsetRetype   : () => Na__LeTools__GetDimOffsetRetype(),
            typeDimensionOffset  : (paperMm) => Na__LeTools__TypeDimensionOffset(paperMm),
            typeVertexLength     : (paperMm) => Na__LeTools__TypeVertexLength(paperMm),
            getMoveDrag          : () => Na__LeTools__GetMoveDrag(),                 // <-- A whole object, or a whole selection, being relocated
            typeMoveLength       : (paperMm) => Na__LeTools__TypeMoveLength(paperMm),
            getViewportDrag      : () => Na__LeTools__GetViewportDrag(),
            typeViewportLength   : (paperMm) => Na__LeTools__TypeViewportLength(paperMm)
        });
        Na__LeTools__SetTool(Na__LeTools__TOOL_SELECT);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Stop Listening and Drop Any Interaction
    // ------------------------------------------------------------
    function Na__LeTools__Detach() {
        Na__LeMenu__Close();
        Na__LeTools__WriteRightPress(null);
        Na__LeTools__WriteLastPointMm(null);
        Na__LeText__Cancel();
        Na__LeScope__Clear();                                                // <-- Never leave a sheet with a container still open
        Na__LeTools__CancelPlacement();
        Na__LeMeasure__Detach();                                             // <-- The box is put away with the tools, and its keys with it
        if (!Na__LeTools__Stage || !Na__LeTools__Handlers) return;
        [ 'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'dblclick', 'contextmenu' ].forEach((name) => Na__LeTools__Stage.removeEventListener(name, Na__LeTools__Handlers[name]));
        window.removeEventListener('keydown', Na__LeTools__Handlers.keydown);
        window.removeEventListener('keyup', Na__LeTools__Handlers.keyup);
        [ Na__LeSurface__ZOOM_EVENT, Na__LeModel__CHANGED_EVENT ].forEach((name) => window.removeEventListener(name, Na__LeTools__Handlers.dropperdraw));
        window.removeEventListener(Na__LeScope__CHANGED_EVENT, Na__LeTools__Handlers.scopedraw);
        [ Na__LeModel__CHANGED_EVENT, Na__LeScope__CHANGED_EVENT ].forEach((name) => window.removeEventListener(name, Na__LeTools__Handlers.settlemove));
        Na__LeTools__Stage.style.cursor = '';
        Na__LeTools__WriteSuppressed(false);                                 // <-- Never leave the tools deaf for the next mount
        Na__LeTools__WriteStage(null); Na__LeTools__Handlers = null; Na__LeTools__WriteDrag(null);
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
        Na__LeTools__TOOL_MOVE,
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
        Na__LeTools__IsMoveAuto,
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
