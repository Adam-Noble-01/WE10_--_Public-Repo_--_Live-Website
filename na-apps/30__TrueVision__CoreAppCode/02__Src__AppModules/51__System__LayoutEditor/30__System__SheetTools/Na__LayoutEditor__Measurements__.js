// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - MEASUREMENTS BOX
// =============================================================================
//
// FILE       : Na__LayoutEditor__Measurements__.js
// NAMESPACE  : Na__LeMeasure
// MODULE     : Layout Editor - Measurements Box
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : SketchUp's VCB for the sheet: read out what is being drawn as it is drawn, and draw exactly what is typed
// CREATED    : 14-Sep-2026
//
// DESCRIPTION:
// - A box at the bottom right of the stage, clear of its scrollbars. While
//   the Draw, Rectangle or Dimension tool is up it reads out what is being
//   drawn - a line's length, a rectangle's width x height, a dimension's span
//   and then its line's offset - with the scale the reading is at on a chip
//   beside it. Dragging a vertex of a finished vector, or a viewport's frame,
//   wakes it the same way: the box reads the drag's length, and a typed value
//   moves the vertex or the frame that far along the drag. An arrow key holds
//   a vertex drag to an axis while it is read and typed, which a held Shift
//   cannot do - Shift has to be let go of to reach the number keys. With any
//   other tool the box rests, greyed.
// - TYPE WITHOUT CLICKING. While one of those tools is up, or while a vertex
//   or a viewport is being dragged, a number typed anywhere over the editor
//   goes into the box and Enter uses it: Draw puts the next point that far
//   along the rubber band, Rectangle lands the opposite corner (or resizes
//   the rectangle that has just landed), Dimension picks the end, then puts
//   the line that far off, a vertex drag puts the vertex that far along the
//   inferred direction - AND KEEPS THE OFFER OPEN, so a second value moves
//   the same vertex the same way again from where it started, a third
//   likewise, until the tool changes - and a viewport frame drag puts the
//   frame that far along the drag. THE LAST MOVE STAYS IN THE BOX, as in
//   SketchUp: a whole-object move or a frame move, let go by the mouse or
//   landed by a value, goes on reading until something else is done, and
//   every value typed lands it again that far from where it started (a
//   vertex, a dimension end and a dimension line likewise). A typed value is
//   absolute - no snap, grid, Shift or Ortho moves it. Escape or Delete drops what was typed and Backspace takes a
//   character back - each only while something is typed, so every key keeps
//   its usual job otherwise. Letters stay tool keys until a value is started. A click on
//   the sheet drops a half-typed value, as it does in SketchUp. Clicking the
//   box types into it directly, which is also how a touch screen reaches it.
// - ARRAYS, AS IN SKETCHUP. After a Ctrl-drag copy lands, 3x (x3, *3, 3*)
//   makes copies at its distance, twice it and three times it, and /3 (3/)
//   divides the distance into three; a length typed after spaces them out
//   again, another count replaces them, in either order.
// - WHAT A NUMBER MEANS (Na__LayoutEditor__MeasureParse__). Millimetres
//   unless a unit follows (2.5m, 250cm), commas may group thousands (2,500),
//   and a minus sign draws the other way. As a value is typed the line above
//   the box says how it is being read, so 1,500 is seen to be one figure
//   before Enter is pressed.
// - AT SCALE (Na__LayoutEditor__DrawingScale__). With the Vectors panel's
//   Draw at scale on, lines and rectangles take and show real sizes at the
//   drawing's scale - the scale of the 2D viewport under the first point, or
//   the sheet's scale elsewhere - so 2500 at 1:50 draws 50 mm of paper. A
//   dimension works at the Measure at scale setting of the Dimensions panel,
//   and once placed at its own. Off, everything is paper millimetres and the
//   chip says Paper.
// - The tools do the drawing: this module converts a typed value to paper
//   millimetres, calls their typed entry points, and says in the line above
//   the box when a value cannot be used, and why.
//
// INTEGRATION:
// - Mounted by Na__LayoutEditor__ModeController__ in the stage's column.
// - Attached and detached with Na__LayoutEditor__SheetTools__, which hands in
//   its tool, its defaults, the last cursor point, Shift, a way to run the
//   tool's move again, the vertex being dragged and the viewport being moved;
//   it calls Refresh after every move and press, and Clear whenever a
//   placement is abandoned or the sheet is pressed.
// - The keys come from Na__Hotkeys__DrawingTabs__.json (MeasurementsBox)
//   and the setup and wording from Na__LayoutEditor__AppConfig__.json.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.9.0
// - A VECTOR TOOL READS AND TYPES THROUGH THE CONTEXT (37__System__VectorTools:
//   Circle, Arc, Offset, Fillet, Chamfer). getVectorReading gives the box its
//   label, its figure - a radius, a bulge, a distance at the Vectors panel's
//   scale, or an angle shown as it comes - its hover title and the letters a
//   begun value may hold (6s sides, 3000d a diameter, 750r a radius);
//   typeVectorValue is handed the typed TEXT, because only the tool knows what
//   it means. The box learns no tool's name and imports none, as ever.
//
// 21-Sep-2026 - Version 1.8.0
// - SKETCHUP'S COPY ARRAYS. While a Ctrl-drag copy is on offer (canArray) -
//   landed and still the last thing done - x, *, and / may begin a value
//   (MeasurementsBox ArrayCharacters), and CommitMove and CommitViewport read
//   an array count first (Na__LeMParse__Array): 3x, x3, *3 or 3* puts copies
//   at the copy's distance, twice it and three times it; /3 or 3/ divides the
//   distance into three (typeMoveArray). As it is typed the line above says
//   what it will make ("= 3 copies in a row, 1,000 mm apart"), and once made
//   what it made. A length typed after spaces them out again; another count
//   replaces them. A plain move refuses a count with a reason, and so do 0x,
//   2.5x and a count past ArrayMaxCount. A copy's box has its own tooltip
//   (MeasureCopyTitle), and the first length typed into a copy says the array
//   is on offer (MeasureCopyAgain).
//
// 21-Sep-2026 - Version 1.7.0
// - A WHOLE-OBJECT MOVE READS LIVE (the pointer drag unit now refreshes the
//   box on every step of it; the box woke on the press and then froze, or
//   showed the value an arrow key or Shift last forced).
// - THE LAST MOVE STAYS IN THE BOX, SketchUp's way. A vector, a note, a
//   leader, a dimension or a selection moved whole, and a viewport frame,
//   read on after the button comes up and after a typed value lands them
//   (getMoveRetype, getViewportRetype): type a length and press Enter and the
//   move lands again exactly that far along the same line, from where it
//   started - 1000, then 1200, then 1150 - until something else is selected,
//   moved or changed, the tool changes or Escape is pressed. A typed value is
//   absolute: no snap, grid, Shift or Ortho touches it. The first value says
//   "Type another length to move it again." (MeasureMoveAgain), as a vertex's
//   does. A vertex, a dimension end and a dimension line let go by the mouse
//   stay typeable the same way (their records now come from the release too).
// - The box refreshes on every model change, so a new selection, an undo or
//   any edit puts a finished move's reading away at once instead of leaving a
//   stale one lit; and its tooltip is worked out on every refresh (it only
//   changed when the box woke or rested), with a Move tooltip of its own.
//
// 21-Sep-2026 - Version 1.6.0
// - Say: a short timed line above the box, never over a value being typed -
//   the echo of a drafting aid switched from the keyboard, as AutoCAD writes
//   "<Ortho on>" on its command line (Na__LayoutEditor__OrthoMode__, F8).
//
// 21-Sep-2026 - Version 1.5.1
// - The box is placed when a zoom settles (Na__LeSurface__ZOOM_SETTLED_EVENT)
//   rather than on every zoom step: its offsetWidth and clientWidth reads force
//   a layout, and a wheel paid for one per notch.
//
// 17-Sep-2026 - Version 1.5.0
// - THE BOX READS A WHOLE-OBJECT MOVE, and takes a typed distance for it. A
//   vector, a note, a dimension, a leader or a whole multi-item selection held
//   by the Move tool reads how far it has travelled, at the scale of the place
//   it started from, and Enter lands it exactly that far along the direction it
//   is being dragged - the same pair a viewport frame has had since v2.24.0.
//
//
// 17-Sep-2026 - Version 1.4.0
// - A dimension end being dragged wakes the box too, reading the SPAN, and a
//   typed value makes the dimension read that (SheetTools TypeDimensionSpan).
//
// 17-Sep-2026 - Version 1.3.0
// - A typed vertex length no longer puts the box back to sleep: the vertex
//   move stays readable and Enter keeps working, so a wrong figure is
//   corrected by typing the right one (SheetTools GetVertexRetype).
//
// 14-Sep-2026 - Version 1.2.0
// - Dragging a viewport's frame wakes the box: the reading is the drag's
//   length at the viewport's scale (the sheet's for a 3D viewport), and Enter
//   moves the frame that far along the inferred direction (SheetTools
//   TypeViewportLength). A handle or a content pan does not wake it.
//
// 14-Sep-2026 - Version 1.1.0
// - Dragging a vertex of a finished vector wakes the box: the reading is the
//   drag's length, at the Vectors panel's Draw at scale, and Enter moves the
//   vertex that far along the inferred direction (SheetTools TypeVertexLength).
//
// 14-Sep-2026 - Version 1.0.0
// - Initial implementation: live readings for the Draw, Rectangle and Dimension
//   tools, typed lengths, sizes and offsets at the drawing's scale or on paper,
//   the reading line and the messages above the box.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Surface, Scale and Parsing
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel, Na__LeCfg__GetMeasureSetup, Na__LeCfg__GetMeasureKeys, Na__LeCfg__GetDimensionSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__CHANGED_EVENT, Na__LeModel__GetActiveSheet } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__ZOOM_SETTLED_EVENT } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeDrawScale__DenominatorAt, Na__LeDrawScale__DimensionAtScale, Na__LeDrawScale__DimensionDenominator, Na__LeDrawScale__Label } from '../07__Core__SheetData/Na__LayoutEditor__DrawingScale__.js';
    import { Na__LeMParse__REASON_UNIT, Na__LeMParse__REASON_COUNT, Na__LeMParse__ARRAY_DIVIDE, Na__LeMParse__Length, Na__LeMParse__Pair, Na__LeMParse__Array, Na__LeMParse__Format } from '../15__Core__Markup/Na__LayoutEditor__MeasureParse__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Three Tools That Measure
    // ------------------------------------------------------------
    import { Na__LeShape__Measure, Na__LeShape__TypeLength } from '../35__System__DrawingTools/Na__LayoutEditor__ShapeTool__.js';
    import { Na__LeRect__Measure, Na__LeRect__TypeSize } from '../35__System__DrawingTools/Na__LayoutEditor__RectangleTool__.js';
    import { Na__LeAreaTool__IsRectangle, Na__LeAreaTool__Settled } from '../59__Feature__FloorAreas/Na__LayoutEditor__FloorAreas__Tool__.js';   // <-- Which of the two the Area tool is drawing with
    import { Na__LeDim__Measure, Na__LeDim__TypeSpan, Na__LeDim__TypeOffset } from '../35__System__DrawingTools/Na__LayoutEditor__DimensionTool__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Sheet Tools' Names for the Tools That Measure, and What They Read
    // ------------------------------------------------------------
    const Na__LeMeasure__TOOL_DRAW      = 'draw';
    const Na__LeMeasure__TOOL_RECT      = 'rectangle';
    const Na__LeMeasure__TOOL_DIMENSION = 'dimension';
    const Na__LeMeasure__TOOL_AREA      = 'area';       // <-- The Area tool, which IS one of the two above with a room's settings on it
    const Na__LeMeasure__KIND_LENGTH    = 'length';     // <-- One figure: a line, a span or an offset
    const Na__LeMeasure__KIND_PAIR      = 'pair';       // <-- Width and height
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Inputs That Leave the Typed Keys Alone (as the sheet tools list them)
    // ------------------------------------------------------------
    const Na__LeMeasure__NON_TEXT_INPUTS = [ 'checkbox', 'radio', 'range', 'color', 'button', 'submit', 'reset', 'file', 'image' ];
    // ------------------------------------------------------------

    // MODULE VARIABLES | Elements, Attachment and What Is Shown
    // ------------------------------------------------------------
    let Na__LeMeasure__Root      = null;
    let Na__LeMeasure__LabelEl   = null;
    let Na__LeMeasure__Input     = null;
    let Na__LeMeasure__ScaleEl   = null;
    let Na__LeMeasure__HintEl    = null;
    let Na__LeMeasure__Stage     = null;
    let Na__LeMeasure__Editable  = false;
    let Na__LeMeasure__Context   = null;   // <-- { getTool, isEditable, getShapeDefaults, getDimensionDefaults, getShift, getPointMm, rerun } from the sheet tools
    let Na__LeMeasure__Handlers  = null;
    let Na__LeMeasure__HintTimer = 0;
    let Na__LeMeasure__Shown     = null;   // <-- What the box already shows, so a move that changes nothing writes nothing
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Label From the Config
    // ------------------------------------------------------------
    function Na__LeMeasure__L(key, fallback) {
        return Na__LeCfg__GetLabel(key, fallback);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build an Element With a Class
    // ------------------------------------------------------------
    function Na__LeMeasure__El(tagName, className, parent) {
        const el = document.createElement(tagName);
        el.className = className;
        if (parent) parent.appendChild(el);
        return el;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is This One of the Tools That Measure
    // ------------------------------------------------------------
    function Na__LeMeasure__IsMeasuringTool(tool) {
        const asked = Na__LeMeasure__Effective(tool);
        return asked === Na__LeMeasure__TOOL_DRAW || asked === Na__LeMeasure__TOOL_RECT || asked === Na__LeMeasure__TOOL_DIMENSION;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Typed Value May Have Just Landed a Room
    // ------------------------------------------------------------
    // A typed length can be the value that CLOSES a room - typed back onto its
    // first corner - and a typed width and height lands a rectangular one
    // outright. Neither goes through the Area tool's own press, so this is
    // where it is told, and it answers to nothing else.
    // ------------------------------------------------------------
    function Na__LeMeasure__Settle(ctx, sheet) {
        if (ctx.getTool() === Na__LeMeasure__TOOL_AREA) Na__LeAreaTool__Settled(sheet);   // <-- The panel then puts the cursor in the new room's name box
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Tool a Reading Is Really Taken From
    // ------------------------------------------------------------
    // The Area tool draws a room with the Draw tool point by point and with
    // the Rectangle tool corner to corner, so a length or a width by a height
    // is read and typed exactly as it is for a vector. Asking which of the two
    // it is here is what keeps every reading, hint and commit below unchanged.
    // ------------------------------------------------------------
    function Na__LeMeasure__Effective(tool) {
        if (tool !== Na__LeMeasure__TOOL_AREA) return tool;
        return Na__LeAreaTool__IsRectangle() ? Na__LeMeasure__TOOL_RECT : Na__LeMeasure__TOOL_DRAW;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Vertex Being Dragged, or Null
    // ------------------------------------------------------------
    function Na__LeMeasure__VertexDrag(ctx) {
        return (ctx && typeof ctx.getVertexDrag === 'function') ? ctx.getVertexDrag() : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Vertex a Typed Length Has Just Moved, or Null
    // ------------------------------------------------------------
    function Na__LeMeasure__VertexRetype(ctx) {
        return (ctx && typeof ctx.getVertexRetype === 'function') ? ctx.getVertexRetype() : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Vertex Move the Box Is Reading: Being Dragged, or Still Retypable
    // ------------------------------------------------------------
    // The two read the same { from, to }, and the box makes no distinction
    // between them: the reading, the scale chip and Enter all carry on
    // working after the pointer has let go, which is what lets a value that
    // came out wrong be replaced by typing the right one.
    // ------------------------------------------------------------
    function Na__LeMeasure__Vertex(ctx) {
        return Na__LeMeasure__VertexDrag(ctx) || Na__LeMeasure__VertexRetype(ctx);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Dimension End Being Dragged, or Still Retypable, or Null
    // ------------------------------------------------------------
    // Reads { dim, fixed, point, orientation, spanMm } either way, so the box
    // makes no distinction between a grip still held and one whose typed value
    // may still be replaced.
    // ------------------------------------------------------------
    function Na__LeMeasure__DimEnd(ctx) {
        if (!ctx) return null;
        const live = (typeof ctx.getDimEndDrag === 'function') ? ctx.getDimEndDrag() : null;
        if (live) return live;
        return (typeof ctx.getDimEndRetype === 'function') ? ctx.getDimEndRetype() : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Dimension Line Being Slid, or Still Retypable, or Null
    // ------------------------------------------------------------
    function Na__LeMeasure__DimOffset(ctx) {
        if (!ctx) return null;
        const live = (typeof ctx.getDimOffsetDrag === 'function') ? ctx.getDimOffsetDrag() : null;
        if (live) return live;
        return (typeof ctx.getDimOffsetRetype === 'function') ? ctx.getDimOffsetRetype() : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Viewport Frame Being Dragged, or Just Moved and Still Retypable, or Null
    // ------------------------------------------------------------
    // Reads { from, to } either way, like a vertex: the box makes no
    // distinction between a frame still held and one that has landed, so a
    // value typed after the mouse lets go - or after the first value - lands
    // it again that far along the same line, from where it started.
    // ------------------------------------------------------------
    function Na__LeMeasure__ViewportDrag(ctx) {
        if (!ctx) return null;
        const live = (typeof ctx.getViewportDrag === 'function') ? ctx.getViewportDrag() : null;
        if (live) return live;
        return (typeof ctx.getViewportRetype === 'function') ? ctx.getViewportRetype() : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Whole-Object Move Being Dragged, or Just Landed and Still Retypable, or Null
    // ------------------------------------------------------------
    // SketchUp's rule, as for a frame: the last move stays in the box until
    // something else is done, and every value typed lands it again.
    // ------------------------------------------------------------
    function Na__LeMeasure__MoveDrag(ctx) {
        if (!ctx) return null;
        const live = (typeof ctx.getMoveDrag === 'function') ? ctx.getMoveDrag() : null;
        if (live) return live;
        return (typeof ctx.getMoveRetype === 'function') ? ctx.getMoveRetype() : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is a Copy on Offer to Be Arrayed (SketchUp's 3x and /3)
    // ------------------------------------------------------------
    // A Ctrl-drag copy on the pointer, or one that has just landed and is
    // still the last thing done. Only then may x, * and / begin a value.
    // ------------------------------------------------------------
    function Na__LeMeasure__CanArray(ctx) {
        return !!(ctx && typeof ctx.canArray === 'function' && ctx.canArray());
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What a Vector Tool Wants the Box to Read, or Null
    // ------------------------------------------------------------
    // Circle, Arc, Offset, Fillet and Chamfer (37__System__VectorTools) each
    // take a typed size of their own - a radius, a bulge, an angle, a distance.
    // The sheet tools' context answers for whichever is up:
    // { label, title, anchor, valueMm, text, extras, angle } or null. The box
    // never learns which tool it is, and never imports one.
    // ------------------------------------------------------------
    function Na__LeMeasure__VectorReading(ctx) {
        return (ctx && typeof ctx.getVectorReading === 'function') ? (ctx.getVectorReading() || null) : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Should the Box Take Keys and Show a Reading
    // ------------------------------------------------------------
    function Na__LeMeasure__IsListening(ctx) {
        if (!ctx || !ctx.isEditable()) return false;
        return !!(Na__LeMeasure__IsMeasuringTool(ctx.getTool()) || Na__LeMeasure__Vertex(ctx) || Na__LeMeasure__DimEnd(ctx) || Na__LeMeasure__DimOffset(ctx) || Na__LeMeasure__ViewportDrag(ctx) || Na__LeMeasure__MoveDrag(ctx) || Na__LeMeasure__VectorReading(ctx));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Does the Focused Element Keep Its Own Keys
    // ------------------------------------------------------------
    // A text field of any kind, a text area, an editable region or a select.
    // A checkbox or a button does not: a digit means nothing to it, so a
    // length can still be typed straight after ticking Draw at scale.
    // ------------------------------------------------------------
    function Na__LeMeasure__KeepsKeys(target) {
        if (!target) return false;
        if (target.isContentEditable || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return true;
        if (target.tagName !== 'INPUT') return false;
        return Na__LeMeasure__NON_TEXT_INPUTS.indexOf(String(target.type || 'text').toLowerCase()) === -1;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Millimetres as the Box Writes Them
    // ------------------------------------------------------------
    function Na__LeMeasure__FormatMm(valueMm, withSuffix) {
        const setup = Na__LeCfg__GetMeasureSetup();
        return Na__LeMParse__Format(valueMm, {
            precision    : setup.precision,
            thousandsSep : Na__LeCfg__GetDimensionSetup().thousandsSep,          // <-- The figures read the way the dimensions on the sheet do
            suffix       : withSuffix === false ? '' : setup.unitsSuffix
        });
    }
    function Na__LeMeasure__FormatPair(widthMm, heightMm) {
        return Na__LeMeasure__FormatMm(widthMm, false) + Na__LeCfg__GetMeasureSetup().pairJoin + Na__LeMeasure__FormatMm(heightMm, true);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Refusal With Its Message
    // ------------------------------------------------------------
    function Na__LeMeasure__Fail(key, fallback) {
        return { ok : false, message : Na__LeMeasure__L(key, fallback) };
    }
    function Na__LeMeasure__BadLength(parsed) {
        if (parsed.reason === Na__LeMParse__REASON_UNIT) return Na__LeMeasure__Fail('MeasureBadUnit', 'Unknown unit. Use mm, cm or m.');
        return Na__LeMeasure__Fail('MeasureBadLength', 'Not a length. Type 2500, 2,500 or 2.5m.');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | What the Box Should Say for the Tool That Is Up
    // ------------------------------------------------------------
    // Returns { active, kind, label, value, atScale, denominator }. value is
    // the live reading ('' before there is anything to read); denominator is
    // the scale the reading is at, 1 on paper.
    //
    // THE SCALE COMES FROM WHERE THE DRAWING STARTS: the last point of a line,
    // the first corner of a rectangle, the midpoint of a dimension's span (the
    // drawing it will belong to). Before the first click it is where the
    // cursor is, so the chip already says what a first point there would get.
    // ------------------------------------------------------------
    function Na__LeMeasure__Reading() {
        const ctx   = Na__LeMeasure__Context;
        const sheet = Na__LeModel__GetActiveSheet();
        const tool  = ctx ? Na__LeMeasure__Effective(ctx.getTool()) : null;   // <-- The Area tool reads as whichever of Draw and Rectangle is drawing the room
        if (!ctx || !sheet || !ctx.isEditable()) {
            return { active : false, kind : null, label : Na__LeMeasure__L('MeasureIdle', 'Measurements'), value : '', atScale : true, denominator : null };
        }

        // VERTEX MOVE | A finished vector's vertex is being moved - dragged,
        // or still live after a typed value - and the reading is how far it
        // has travelled, at the Vectors panel's scale.
        const vertex = Na__LeMeasure__Vertex(ctx);
        if (vertex) {
            const atScale     = ctx.getShapeDefaults().atScale !== false;
            const denominator = atScale ? Na__LeDrawScale__DenominatorAt(sheet, vertex.from) : 1;
            const run         = vertex.to ? Math.hypot(vertex.to.x - vertex.from.x, vertex.to.y - vertex.from.y) : 0;
            const value       = (run >= 1e-4) ? Na__LeMeasure__FormatMm(run * denominator) : '';
            return { active : true, kind : Na__LeMeasure__KIND_LENGTH, label : Na__LeMeasure__L('MeasureLength', 'Length'), value : value, atScale : atScale, denominator : denominator, vertex : true };
        }

        // DIMENSION END | One of a dimension's measured points is being moved.
        // The reading is the SPAN - what the dimension reads - at the scale that
        // dimension reads at, because that is the number a typed value sets.
        const dimEnd = Na__LeMeasure__DimEnd(ctx);
        if (dimEnd) {
            const denominator = Na__LeDrawScale__DimensionDenominator(sheet, dimEnd.dim);
            const value       = (dimEnd.spanMm >= 1e-4) ? Na__LeMeasure__FormatMm(dimEnd.spanMm * denominator) : '';
            return { active : true, kind : Na__LeMeasure__KIND_LENGTH, label : Na__LeMeasure__L('MeasureLength', 'Length'), value : value,
                     atScale : Na__LeDrawScale__DimensionAtScale(sheet, dimEnd.dim), denominator : denominator, dimEnd : true };
        }

        // DIMENSION LINE | The line is being slid off what it measures. The
        // reading is the distance off, at the scale the dimension reads at, the
        // way the offset phase of the Dimension tool reads while it is placed.
        const dimOffset = Na__LeMeasure__DimOffset(ctx);
        if (dimOffset) {
            const denominator = Na__LeDrawScale__DimensionDenominator(sheet, dimOffset.dim);
            return { active : true, kind : Na__LeMeasure__KIND_LENGTH, label : Na__LeMeasure__L('MeasureOffset', 'Offset'),
                     value : Na__LeMeasure__FormatMm(Math.abs(dimOffset.offsetMm) * denominator),
                     atScale : Na__LeDrawScale__DimensionAtScale(sheet, dimOffset.dim), denominator : denominator, dimOffset : true };
        }

        // VIEWPORT DRAG | The frame is being moved on the paper: the reading
        // is how far it has travelled, at the viewport's scale (the sheet's
        // for a 3D viewport, which has none of its own).
        const viewport = Na__LeMeasure__ViewportDrag(ctx);
        if (viewport) {
            const denominator = Na__LeDrawScale__DenominatorAt(sheet, viewport.from);
            const run         = viewport.to ? Math.hypot(viewport.to.x - viewport.from.x, viewport.to.y - viewport.from.y) : 0;
            const value       = (run >= 1e-4) ? Na__LeMeasure__FormatMm(run * denominator) : '';
            return { active : true, kind : Na__LeMeasure__KIND_LENGTH, label : Na__LeMeasure__L('MeasureLength', 'Length'), value : value, atScale : true, denominator : denominator, viewport : true,
                     runMm : run * denominator, copy : Na__LeMeasure__CanArray(ctx) };   // <-- A copy may be arrayed: the run is what 3x and /3 work from
        }

        // WHOLE-OBJECT MOVE | A vector, a note, a dimension, a leader or a whole
        // selection is being relocated by the Move tool. The reading is how far
        // it has travelled, at the scale of the place it started from - the same
        // reading a viewport frame gives, for the same gesture.
        const move = Na__LeMeasure__MoveDrag(ctx);
        if (move) {
            const denominator = Na__LeDrawScale__DenominatorAt(sheet, move.from);
            const run         = move.to ? Math.hypot(move.to.x - move.from.x, move.to.y - move.from.y) : 0;
            const value       = (run >= 1e-4) ? Na__LeMeasure__FormatMm(run * denominator) : '';
            return { active : true, kind : Na__LeMeasure__KIND_LENGTH, label : Na__LeMeasure__L('MeasureLength', 'Length'), value : value, atScale : true, denominator : denominator, move : true,
                     runMm : run * denominator, copy : Na__LeMeasure__CanArray(ctx) };   // <-- A copy may be arrayed: the run is what 3x and /3 work from
        }

        // A VECTOR TOOL | Its own reading, in its own words: a radius, a bulge,
        // a distance at the Vectors panel's scale, read where the tool says its
        // anchor is - or an angle, which has no scale and is shown as it comes.
        const vector = Na__LeMeasure__VectorReading(ctx);
        if (vector) {
            const atScale     = ctx.getShapeDefaults().atScale !== false;
            const from        = vector.anchor || ctx.getPointMm();
            const denominator = (atScale && from) ? Na__LeDrawScale__DenominatorAt(sheet, from) : 1;
            const value       = (typeof vector.text === 'string') ? vector.text : (Number.isFinite(vector.valueMm) ? Na__LeMeasure__FormatMm(vector.valueMm * denominator) : '');
            return { active : true, kind : Na__LeMeasure__KIND_LENGTH, label : vector.label || Na__LeMeasure__L('MeasureLength', 'Length'), value : value, atScale : atScale, denominator : denominator,
                     vector : true, vectorTitle : vector.title || '', vectorExtras : vector.extras || '', vectorAngle : vector.angle === true };
        }

        if (!Na__LeMeasure__IsMeasuringTool(tool)) {
            return { active : false, kind : null, label : Na__LeMeasure__L('MeasureIdle', 'Measurements'), value : '', atScale : true, denominator : null };
        }
        const cursor = ctx.getPointMm();

        if (tool === Na__LeMeasure__TOOL_DRAW) {
            const atScale     = ctx.getShapeDefaults().atScale !== false;
            const segment     = Na__LeShape__Measure();
            const denominator = atScale ? Na__LeDrawScale__DenominatorAt(sheet, segment ? segment.from : cursor) : 1;
            const value       = (segment && segment.to) ? Na__LeMeasure__FormatMm(Math.hypot(segment.to.x - segment.from.x, segment.to.y - segment.from.y) * denominator) : '';
            return { active : true, kind : Na__LeMeasure__KIND_LENGTH, label : Na__LeMeasure__L('MeasureLength', 'Length'), value : value, atScale : atScale, denominator : denominator };
        }

        if (tool === Na__LeMeasure__TOOL_RECT) {
            const atScale     = ctx.getShapeDefaults().atScale !== false;
            const box         = Na__LeRect__Measure(sheet);
            const denominator = atScale ? Na__LeDrawScale__DenominatorAt(sheet, box ? box.anchor : cursor) : 1;
            const value       = box ? Na__LeMeasure__FormatPair(Math.abs(box.corner.x - box.anchor.x) * denominator, Math.abs(box.corner.y - box.anchor.y) * denominator) : '';
            return { active : true, kind : Na__LeMeasure__KIND_PAIR, label : Na__LeMeasure__L('MeasureDimensions', 'Dimensions'), value : value, atScale : atScale, denominator : denominator };
        }

        // DIMENSION | The span while its end is picked, then the line's offset
        const placing = Na__LeDim__Measure(sheet);
        if (placing && placing.phase === 2) {
            const denominator = Na__LeDrawScale__DimensionDenominator(sheet, placing.dim);
            return {
                active : true, kind : Na__LeMeasure__KIND_LENGTH, label : Na__LeMeasure__L('MeasureOffset', 'Offset'),
                value : Na__LeMeasure__FormatMm(Math.abs(placing.dim.Dimension__OffsetMm) * denominator),
                atScale : Na__LeDrawScale__DimensionAtScale(sheet, placing.dim), denominator : denominator
            };
        }
        const atScale     = ctx.getDimensionDefaults().atScale !== false;
        const middle      = (placing && placing.end) ? { x : (placing.start.x + placing.end.x) / 2, y : (placing.start.y + placing.end.y) / 2 } : (placing ? placing.start : cursor);
        const denominator = atScale ? Na__LeDrawScale__DenominatorAt(sheet, middle) : 1;
        const value       = (placing && placing.end) ? Na__LeMeasure__FormatMm(Math.hypot(placing.end.x - placing.start.x, placing.end.y - placing.start.y) * denominator) : '';
        return { active : true, kind : Na__LeMeasure__KIND_LENGTH, label : Na__LeMeasure__L('MeasureLength', 'Length'), value : value, atScale : atScale, denominator : denominator };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What the Box Says About Itself on Hover
    // ------------------------------------------------------------
    // Worked out on every refresh, not only when the box wakes or rests: the
    // box can go from a line being drawn to a move being made without resting
    // in between, and its tooltip used to keep telling the first story.
    // ------------------------------------------------------------
    function Na__LeMeasure__TitleFor(reading) {
        if (!reading.active)   return Na__LeMeasure__L('MeasureIdleTitle', 'Pick the Draw (L), Rectangle (R) or Dimension (D) tool to type sizes here, or move something and type how far.');
        if (reading.vector && reading.vectorTitle) return reading.vectorTitle;   // <-- A vector tool says in its own words what may be typed
        if (reading.copy)      return Na__LeMeasure__L('MeasureCopyTitle', 'A copy, as in SketchUp: type how far and press Enter to put it exactly that far along the line, then 3x (or *3) for three copies in a row that far apart, or /3 to divide that distance into three. Type another count or another length to change them, in either order.');
        if (reading.viewport)  return Na__LeMeasure__L('MeasureViewportTitle', 'Drag the viewport the way to go, type a length and press Enter - 2500, 2,500 or 2.5m. A number with no unit is millimetres at the viewport\'s scale. Type another length to move it again.');
        if (reading.move)      return Na__LeMeasure__L('MeasureMoveTitle', 'Move it the way to go - or press an arrow key to hold it to an axis - then type how far and press Enter: 2500, 2,500 or 2.5m, exactly, whatever snaps or grid. Type another length to move it again from where it started.');
        if (reading.dimOffset) return Na__LeMeasure__L('MeasureDimOffsetTitle', 'Drag the line clear of the drawing, then type how far off it should sit and press Enter. Type another distance to slide it again.');
        if (reading.dimEnd)    return Na__LeMeasure__L('MeasureDimEndTitle', 'Drag the end the way to go - or press an arrow key to hold it to an axis - then type what the dimension should read and press Enter. Type another length to set it again.');
        if (reading.vertex)    return Na__LeMeasure__L('MeasureVertexTitle', 'Drag the vertex the way to go - or press an arrow key to hold it to an axis - then type a length and press Enter: 2500, 2,500 or 2.5m. A number with no unit is millimetres. Type another length to move it again.');
        return Na__LeMeasure__L('MeasureTitle', 'Measurements: while drawing, type a length and press Enter - 2500, 2,500 or 2.5m. A number with no unit is millimetres. A rectangle takes width x height.');
    }
    // ------------------------------------------------------------


    // FUNCTION | Bring the Box Up to Date With the Tool, the Drawing and the Scale
    // ------------------------------------------------------------
    // Called after every move and press, and on every model change (so a
    // selection that moves on, an undo or an edit elsewhere puts a finished
    // move's reading away). Only what has changed is written.
    // ------------------------------------------------------------
    function Na__LeMeasure__Refresh() {
        if (!Na__LeMeasure__Root) return;
        const reading = Na__LeMeasure__Reading();
        const idle    = !reading.active;
        const paper   = reading.active && !reading.atScale;
        const scale   = idle ? '' : (paper ? Na__LeMeasure__L('MeasurePaper', 'Paper') : Na__LeDrawScale__Label(reading.denominator));
        const title   = idle ? '' : (paper
            ? Na__LeMeasure__L('MeasurePaperTitle', 'Typed and shown in paper millimetres. Tick Draw at scale (Vectors) or Measure at scale (Dimensions) to work at the drawing\'s scale.')
            : Na__LeCfg__FormatLabel('MeasureScaleTitle', 'Typed and shown at {scale}: the scale of the drawing under the first point, or the sheet\'s scale off every drawing.', { scale : scale }));
        const boxTitle = Na__LeMeasure__TitleFor(reading);
        const shown = Na__LeMeasure__Shown || {};
        if (shown.label !== reading.label) Na__LeMeasure__LabelEl.textContent = reading.label;
        if (shown.value !== reading.value) Na__LeMeasure__Input.placeholder = reading.value;      // <-- The reading is the placeholder, so a typed value simply replaces it
        if (shown.scale !== scale) { Na__LeMeasure__ScaleEl.textContent = scale; Na__LeMeasure__ScaleEl.hidden = !scale; }
        if (shown.title !== title) Na__LeMeasure__ScaleEl.title = title;
        if (shown.paper !== paper) Na__LeMeasure__ScaleEl.classList.toggle('na-le-vcb__scale--paper', paper);
        if (shown.boxTitle !== boxTitle) Na__LeMeasure__Root.title = boxTitle;
        if (shown.idle !== idle) {
            Na__LeMeasure__Root.classList.toggle('na-le-vcb--idle', idle);
            if (idle) {
                if (document.activeElement === Na__LeMeasure__Input) Na__LeMeasure__Input.blur();
                Na__LeMeasure__Clear();
            }
            Na__LeMeasure__Input.disabled = idle;
        }
        Na__LeMeasure__Shown = { label : reading.label, value : reading.value, scale : scale, title : title, paper : paper, idle : idle, boxTitle : boxTitle };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Typing
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Show a Line Above the Box (a reading of what is typed, or a message)
    // ------------------------------------------------------------
    // timed lines go after the configured HintMs; the reading of a value
    // being typed stays until the value changes or goes.
    // ------------------------------------------------------------
    function Na__LeMeasure__ShowHint(text, isError, timed) {
        if (!Na__LeMeasure__HintEl) return;
        if (Na__LeMeasure__HintTimer) { window.clearTimeout(Na__LeMeasure__HintTimer); Na__LeMeasure__HintTimer = 0; }
        if (!text) { Na__LeMeasure__HideHint(); return; }
        Na__LeMeasure__HintEl.textContent = text;
        Na__LeMeasure__HintEl.classList.toggle('na-le-vcb__hint--error', !!isError);
        Na__LeMeasure__HintEl.hidden = false;
        Na__LeMeasure__Root.classList.toggle('na-le-vcb--error', !!isError);
        if (timed) {
            Na__LeMeasure__HintTimer = window.setTimeout(() => {
                Na__LeMeasure__HintTimer = 0;
                Na__LeMeasure__HideHint();
            }, Na__LeCfg__GetMeasureSetup().hintMs);
        }
    }
    function Na__LeMeasure__HideHint() {
        if (Na__LeMeasure__HintTimer) { window.clearTimeout(Na__LeMeasure__HintTimer); Na__LeMeasure__HintTimer = 0; }
        if (!Na__LeMeasure__HintEl) return;
        Na__LeMeasure__HintEl.hidden = true;
        Na__LeMeasure__HintEl.textContent = '';
        Na__LeMeasure__Root.classList.remove('na-le-vcb--error');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | How a Typed Value Is Being Read, or Null While It Is Not Yet One
    // ------------------------------------------------------------
    function Na__LeMeasure__Reads(kind, text) {
        if (kind === Na__LeMeasure__KIND_PAIR) {
            const pair = Na__LeMParse__Pair(text);
            if (!pair.ok) return null;
            if (pair.square) return Na__LeCfg__FormatLabel('MeasureReadsSquare', '= {value} square', { value : Na__LeMeasure__FormatMm(pair.first) });
            const cursor = Na__LeMeasure__L('MeasureKeepsCursor', 'the cursor\'s');
            const value  = (pair.first !== null && pair.second !== null)
                ? Na__LeMeasure__FormatPair(pair.first, pair.second)
                : (pair.first === null ? cursor : Na__LeMeasure__FormatMm(pair.first)) + Na__LeCfg__GetMeasureSetup().pairJoin + (pair.second === null ? cursor : Na__LeMeasure__FormatMm(pair.second));
            return Na__LeCfg__FormatLabel('MeasureReads', '= {value}', { value : value });
        }
        const length = Na__LeMParse__Length(text);
        return length.ok ? Na__LeCfg__FormatLabel('MeasureReads', '= {value}', { value : Na__LeMeasure__FormatMm(length.valueMm) }) : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | How a Typed Array Is Being Read, or Null While It Is Not One
    // ------------------------------------------------------------
    // Only for a copy on offer (reading.copy): 3x reads as three copies at the
    // copy's distance apart, /3 as three dividing it - the spacing worked out
    // from the run the box is showing, at its scale.
    // ------------------------------------------------------------
    function Na__LeMeasure__ArrayReads(reading, text) {
        if (!reading || !reading.copy) return null;
        const array = Na__LeMParse__Array(text);
        if (!array.ok) return null;
        const run    = Math.abs(reading.runMm || 0);
        const divide = array.mode === Na__LeMParse__ARRAY_DIVIDE;
        const tokens = { count : array.count, spacing : Na__LeMeasure__FormatMm(divide ? run / array.count : run) };
        return divide
            ? Na__LeCfg__FormatLabel('MeasureArrayReadsDivide', '= {count} copies dividing the distance, {spacing} apart', tokens)
            : Na__LeCfg__FormatLabel('MeasureArrayReadsTimes', '= {count} copies in a row, {spacing} apart', tokens);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Typed Value Changed
    // ------------------------------------------------------------
    function Na__LeMeasure__Typed() {
        if (!Na__LeMeasure__Root) return;
        const text = Na__LeMeasure__Input.value;
        Na__LeMeasure__Root.classList.toggle('na-le-vcb--typing', !!text.trim());
        if (!text.trim()) { Na__LeMeasure__HideHint(); return; }
        const reading = Na__LeMeasure__Reading();
        const reads   = (reading.active && !reading.vectorAngle) ? (Na__LeMeasure__ArrayReads(reading, text) || Na__LeMeasure__Reads(reading.kind, text)) : null;   // <-- An angle is not a length: nothing to read back in millimetres
        if (reads) Na__LeMeasure__ShowHint(reads, false, false);
        else Na__LeMeasure__HideHint();
    }
    // ------------------------------------------------------------


    // FUNCTION | Drop What Was Typed
    // ------------------------------------------------------------
    // Returns true when there was something to drop.
    // ------------------------------------------------------------
    function Na__LeMeasure__Clear() {
        if (!Na__LeMeasure__Input) return false;
        const had = !!Na__LeMeasure__Input.value;
        Na__LeMeasure__Input.value = '';
        Na__LeMeasure__Root.classList.remove('na-le-vcb--typing');
        Na__LeMeasure__HideHint();
        return had;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Give the Keys Back to the Sheet
    // ------------------------------------------------------------
    function Na__LeMeasure__Release() {
        if (Na__LeMeasure__Input && document.activeElement === Na__LeMeasure__Input) Na__LeMeasure__Input.blur();
        if (Na__LeMeasure__Stage) { try { Na__LeMeasure__Stage.focus({ preventScroll : true }); } catch (e) { /* not focusable */ } }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Key Pressed Anywhere While a Tool That Measures Is Up
    // ------------------------------------------------------------
    // Listened for in the capture phase, so a value being typed is the box's
    // before a key binding can take a digit, a space or Enter. Only what the
    // box uses is taken; everything else passes on untouched.
    // ------------------------------------------------------------
    function Na__LeMeasure__OnKey(event) {
        const ctx   = Na__LeMeasure__Context;
        const input = Na__LeMeasure__Input;
        if (!ctx || !input || input.disabled || event.defaultPrevented || event.isComposing) return;
        if (!ctx.isEditable() || !Na__LeMeasure__IsListening(ctx)) return;
        if (event.target === input || Na__LeMeasure__KeepsKeys(event.target)) return;   // <-- The box's own keys are handled on the box; a field keeps its own
        if (event.ctrlKey || event.metaKey || event.altKey) return;                    // <-- Chords stay the sheet's: undo, redo, copy, paste
        const keys  = Na__LeCfg__GetMeasureKeys();
        const key   = event.key;
        const typed = input.value;
        const take  = () => { event.preventDefault(); event.stopImmediatePropagation(); };
        if (keys.commit.indexOf(key) !== -1) { if (!typed.trim()) return; take(); Na__LeMeasure__Commit(); return; }   // <-- Nothing typed: Enter finishes the shape as ever
        if (keys.clear.indexOf(key) !== -1)  { if (!typed) return; take(); Na__LeMeasure__Clear(); return; }            // <-- Nothing typed: Escape backs out as ever
        if (keys.erase.indexOf(key) !== -1)  { if (!typed) return; take(); input.value = typed.slice(0, -1); Na__LeMeasure__Typed(); return; }
        if (typeof key !== 'string' || key.length !== 1) return;
        const vector  = typed ? Na__LeMeasure__VectorReading(ctx) : null;                  // <-- Only once a value is begun: with nothing typed, D is still the Dimension tool and R the Rectangle
        const allowed = (typed ? keys.typing : keys.start) + (Na__LeMeasure__CanArray(ctx) ? keys.array : '') + ((vector && typeof vector.extras === 'string') ? vector.extras : '');   // <-- x, * and / only while a copy may be arrayed (3x, *3, /3); s, d and r only for a vector tool that reads them (6s, 3000d, 750r)
        if (allowed.indexOf(key) === -1) return;                                       // <-- A letter with nothing typed is still a tool key
        take();
        input.value = typed + key;
        Na__LeMeasure__Typed();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Using a Typed Value
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Typed Length for the Draw Tool
    // ------------------------------------------------------------
    function Na__LeMeasure__CommitDraw(sheet, text, ctx) {
        const segment = Na__LeShape__Measure();
        if (!segment) return Na__LeMeasure__Fail('MeasureNeedPoint', 'Click the first point, then type a length.');
        const length = Na__LeMParse__Length(text);
        if (!length.ok) return Na__LeMeasure__BadLength(length);
        const denominator = ctx.getShapeDefaults().atScale !== false ? Na__LeDrawScale__DenominatorAt(sheet, segment.from) : 1;
        const result = Na__LeShape__TypeLength(sheet, length.valueMm / denominator);
        if (result.ok) return { ok : true };
        if (result.reason === 'direction') return Na__LeMeasure__Fail('MeasureNoDirection', 'Point the cursor the way to draw, then press Enter.');
        return Na__LeMeasure__Fail('MeasureTooShort', 'Too short to draw.');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Typed Width and Height for the Rectangle Tool
    // ------------------------------------------------------------
    function Na__LeMeasure__CommitRectangle(sheet, text, ctx) {
        const box = Na__LeRect__Measure(sheet);
        if (!box) return Na__LeMeasure__Fail('MeasureNeedCorner', 'Click the first corner, then type width x height.');
        const pair = Na__LeMParse__Pair(text);
        if (!pair.ok) return pair.reason === Na__LeMParse__REASON_UNIT ? Na__LeMeasure__BadLength(pair) : Na__LeMeasure__Fail('MeasureBadPair', 'Type width x height: 3000 x 2000, or 3m x 2m.');
        const denominator = ctx.getShapeDefaults().atScale !== false ? Na__LeDrawScale__DenominatorAt(sheet, box.anchor) : 1;
        const result = Na__LeRect__TypeSize(sheet, pair.first === null ? null : pair.first / denominator, pair.second === null ? null : pair.second / denominator);
        if (!result.ok) {
            return result.reason === 'flat'
                ? Na__LeMeasure__Fail('MeasureFlat', 'A rectangle needs a width and a height.')
                : Na__LeMeasure__Fail('MeasureNeedCorner', 'Click the first corner, then type width x height.');
        }
        if (!result.resized) return { ok : true };
        const resized = Na__LeRect__Measure(sheet);
        const size    = resized ? Na__LeMeasure__FormatPair(Math.abs(resized.corner.x - resized.anchor.x) * denominator, Math.abs(resized.corner.y - resized.anchor.y) * denominator) : '';
        return { ok : true, message : Na__LeCfg__FormatLabel('MeasureResized', 'Rectangle resized to {size}.', { size : size }) };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Typed Span or Offset for the Dimension Tool
    // ------------------------------------------------------------
    // The span's length is converted where its midpoint lands, because that
    // is the drawing the dimension will belong to and read its value at; the
    // offset at the scale the dimension now reads.
    // ------------------------------------------------------------
    function Na__LeMeasure__CommitDimension(sheet, text, ctx) {
        const placing = Na__LeDim__Measure(sheet);
        if (!placing) return Na__LeMeasure__Fail('MeasureNeedStart', 'Click where the dimension starts, then type its length.');
        const length = Na__LeMParse__Length(text);
        if (!length.ok) return Na__LeMeasure__BadLength(length);
        if (placing.phase === 2) {
            const placed = Na__LeDim__TypeOffset(sheet, length.valueMm / Na__LeDrawScale__DimensionDenominator(sheet, placing.dim), ctx.getShift());
            return placed.ok ? { ok : true } : Na__LeMeasure__Fail('MeasureNeedStart', 'Click where the dimension starts, then type its length.');
        }
        const defaults = ctx.getDimensionDefaults();
        const atScale  = defaults.atScale !== false;
        const result   = Na__LeDim__TypeSpan(sheet, (middle) => length.valueMm / (atScale ? Na__LeDrawScale__DenominatorAt(sheet, middle) : 1), ctx.getShift(), defaults);
        if (result.ok) return { ok : true };
        if (result.reason === 'direction') return Na__LeMeasure__Fail('MeasureNoDirection', 'Point the cursor the way to draw, then press Enter.');
        return Na__LeMeasure__Fail('MeasureTooShort', 'Too short to draw.');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Typed Length for a Vertex Being Moved
    // ------------------------------------------------------------
    // The first value comes off the drag; every value after it moves the same
    // vertex the same way again, from where it started. The first one says so
    // above the box, because nothing else on screen would tell you that
    // typing again is allowed.
    // ------------------------------------------------------------
    function Na__LeMeasure__CommitVertex(sheet, text, ctx) {
        const vertex = Na__LeMeasure__Vertex(ctx);
        if (!vertex || typeof ctx.typeVertexLength !== 'function') return Na__LeMeasure__Fail('MeasureNoVertexDirection', 'Drag the vertex the way to go, then press Enter.');
        const length = Na__LeMParse__Length(text);
        if (!length.ok) return Na__LeMeasure__BadLength(length);
        const denominator = ctx.getShapeDefaults().atScale !== false ? Na__LeDrawScale__DenominatorAt(sheet, vertex.from) : 1;
        const result = ctx.typeVertexLength(length.valueMm / denominator);
        if (result.ok) return result.retyped ? { ok : true } : { ok : true, message : Na__LeMeasure__L('MeasureVertexAgain', 'Type another length to move it again.') };
        if (result.reason === 'direction') return Na__LeMeasure__Fail('MeasureNoVertexDirection', 'Drag the vertex the way to go, then press Enter.');
        return Na__LeMeasure__Fail('MeasureTooShort', 'Too short to draw.');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Typed Span for a Dimension End Being Moved
    // ------------------------------------------------------------
    // The value is what the dimension should READ, not how far its end travels,
    // so it is taken off at the scale the dimension reads at and the end moves
    // to suit. Every value after the first sets it again from the fixed end.
    // ------------------------------------------------------------
    function Na__LeMeasure__CommitDimEnd(sheet, text, ctx) {
        const dimEnd = Na__LeMeasure__DimEnd(ctx);
        if (!dimEnd || typeof ctx.typeDimensionSpan !== 'function') return Na__LeMeasure__Fail('MeasureNoDimEndDirection', 'Drag the end the way to go, then press Enter.');
        const length = Na__LeMParse__Length(text);
        if (!length.ok) return Na__LeMeasure__BadLength(length);
        const result = ctx.typeDimensionSpan(length.valueMm / Na__LeDrawScale__DimensionDenominator(sheet, dimEnd.dim));
        if (result.ok) return result.retyped ? { ok : true } : { ok : true, message : Na__LeMeasure__L('MeasureDimEndAgain', 'Type another length to set it again.') };
        if (result.reason === 'direction') return Na__LeMeasure__Fail('MeasureNoDimEndDirection', 'Drag the end the way to go, then press Enter.');
        return Na__LeMeasure__Fail('MeasureTooShort', 'Too short to draw.');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Typed Distance for a Dimension Line Being Slid
    // ------------------------------------------------------------
    function Na__LeMeasure__CommitDimOffset(sheet, text, ctx) {
        const dimOffset = Na__LeMeasure__DimOffset(ctx);
        if (!dimOffset || typeof ctx.typeDimensionOffset !== 'function') return Na__LeMeasure__Fail('MeasureNoOffsetSide', 'Drag the line to one side, then press Enter.');
        const length = Na__LeMParse__Length(text);
        if (!length.ok) return Na__LeMeasure__BadLength(length);
        const result = ctx.typeDimensionOffset(length.valueMm / Na__LeDrawScale__DimensionDenominator(sheet, dimOffset.dim));
        if (result.ok) return result.retyped ? { ok : true } : { ok : true, message : Na__LeMeasure__L('MeasureOffsetAgain', 'Type another distance to slide it again.') };
        return Na__LeMeasure__Fail('MeasureNoOffsetSide', 'Drag the line to one side, then press Enter.');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Typed Array Count for a Copy (SketchUp's 3x and /3), or Null for a Length
    // ------------------------------------------------------------
    // Null when what was typed is not an array at all, so the caller reads it
    // as a length exactly as before. The count is the tools' to carry out; the
    // message says what landed, at the scale the box reads the move at.
    // ------------------------------------------------------------
    function Na__LeMeasure__CommitArray(sheet, text, ctx, from) {
        const array = Na__LeMParse__Array(text);
        if (!array.ok && array.reason !== Na__LeMParse__REASON_COUNT) return null;
        if (!Na__LeMeasure__CanArray(ctx) || typeof ctx.typeMoveArray !== 'function') return Na__LeMeasure__Fail('MeasureArrayNeedsCopy', 'Only a copy can be arrayed: hold Ctrl as you drag it, then type 3x or /3.');
        if (!array.ok) return Na__LeMeasure__Fail('MeasureArrayBadCount', 'Type a whole number of copies: 3x, *3 or /3.');
        const result = ctx.typeMoveArray(array.mode, array.count);
        if (!result.ok) {
            if (result.reason === 'many')  return { ok : false, message : Na__LeCfg__FormatLabel('MeasureArrayTooMany', 'At most {max} copies at once (Measurements ArrayMaxCount).', { max : result.max }) };
            if (result.reason === 'count') return Na__LeMeasure__Fail('MeasureArrayBadCount', 'Type a whole number of copies: 3x, *3 or /3.');
            return Na__LeMeasure__Fail('MeasureArrayNeedsCopy', 'Only a copy can be arrayed: hold Ctrl as you drag it, then type 3x or /3.');
        }
        const run    = Math.abs(result.lengthMm || 0) * Na__LeDrawScale__DenominatorAt(sheet, from);
        const divide = result.mode === Na__LeMParse__ARRAY_DIVIDE;
        const tokens = { count : result.count, spacing : Na__LeMeasure__FormatMm(divide ? run / result.count : run), length : Na__LeMeasure__FormatMm(run) };
        return { ok : true, message : divide
            ? Na__LeCfg__FormatLabel('MeasureArrayDoneDivide', '{count} copies dividing {length}. Type another count, or a length to stretch them.', tokens)
            : Na__LeCfg__FormatLabel('MeasureArrayDoneTimes', '{count} copies, {spacing} apart. Type another count, or a length to space them.', tokens) };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What the First Typed Length Says, a Copy's Offering the Array Too
    // ------------------------------------------------------------
    function Na__LeMeasure__MoveAgain(ctx) {
        return Na__LeMeasure__CanArray(ctx)
            ? Na__LeMeasure__L('MeasureCopyAgain', 'Type another length to move it again, or 3x or /3 for an array.')
            : Na__LeMeasure__L('MeasureMoveAgain', 'Type another length to move it again.');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Typed Length for a Viewport Frame Being Dragged
    // ------------------------------------------------------------
    function Na__LeMeasure__CommitViewport(sheet, text, ctx) {
        const viewport = Na__LeMeasure__ViewportDrag(ctx);
        if (!viewport || typeof ctx.typeViewportLength !== 'function') return Na__LeMeasure__Fail('MeasureNoViewportDirection', 'Drag the viewport the way to go, then press Enter.');
        const arrayed = Na__LeMeasure__CommitArray(sheet, text, ctx, viewport.from);   // <-- 3x or /3 after a copied frame
        if (arrayed) return arrayed;
        const length = Na__LeMParse__Length(text);
        if (!length.ok) return Na__LeMeasure__BadLength(length);
        const denominator = Na__LeDrawScale__DenominatorAt(sheet, viewport.from);
        const result = ctx.typeViewportLength(length.valueMm / denominator);
        if (result.ok) return result.retyped ? { ok : true } : { ok : true, message : Na__LeMeasure__MoveAgain(ctx) };
        if (result.reason === 'direction') return Na__LeMeasure__Fail('MeasureNoViewportDirection', 'Drag the viewport the way to go, then press Enter.');
        return Na__LeMeasure__Fail('MeasureTooShort', 'Too short to draw.');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Typed Distance for a Whole-Object Move
    // ------------------------------------------------------------
    function Na__LeMeasure__CommitMove(sheet, text, ctx) {
        const move = Na__LeMeasure__MoveDrag(ctx);
        if (!move || typeof ctx.typeMoveLength !== 'function') return Na__LeMeasure__Fail('MeasureNoMoveDirection', 'Drag the way to go, then press Enter.');
        const arrayed = Na__LeMeasure__CommitArray(sheet, text, ctx, move.from);  // <-- 3x or /3 after a copy
        if (arrayed) return arrayed;
        const length = Na__LeMParse__Length(text);
        if (!length.ok) return Na__LeMeasure__BadLength(length);
        const denominator = Na__LeDrawScale__DenominatorAt(sheet, move.from);
        const result = ctx.typeMoveLength(length.valueMm / denominator);
        if (result.ok) return result.retyped ? { ok : true } : { ok : true, message : Na__LeMeasure__MoveAgain(ctx) };
        if (result.reason === 'direction') return Na__LeMeasure__Fail('MeasureNoMoveDirection', 'Drag the way to go, then press Enter.');
        return Na__LeMeasure__Fail('MeasureTooShort', 'Too short to draw.');
    }
    // ------------------------------------------------------------


    // FUNCTION | Use the Typed Value
    // ------------------------------------------------------------
    // Returns true when a value was there to be used - whether or not it
    // could be, since a refusal is shown above the box and the value is kept
    // to be corrected - and false when there was nothing typed to use.
    // ------------------------------------------------------------
    function Na__LeMeasure__Commit() {
        const ctx   = Na__LeMeasure__Context;
        const text  = Na__LeMeasure__Input ? Na__LeMeasure__Input.value.trim() : '';
        const sheet = Na__LeModel__GetActiveSheet();
        if (!ctx || !text || !sheet || !ctx.isEditable()) return false;
        const tool = Na__LeMeasure__Effective(ctx.getTool());
        let outcome;
        if (Na__LeMeasure__Vertex(ctx))                   outcome = Na__LeMeasure__CommitVertex(sheet, text, ctx);
        else if (Na__LeMeasure__DimEnd(ctx))              outcome = Na__LeMeasure__CommitDimEnd(sheet, text, ctx);
        else if (Na__LeMeasure__DimOffset(ctx))           outcome = Na__LeMeasure__CommitDimOffset(sheet, text, ctx);
        else if (Na__LeMeasure__ViewportDrag(ctx))        outcome = Na__LeMeasure__CommitViewport(sheet, text, ctx);
        else if (Na__LeMeasure__MoveDrag(ctx))            outcome = Na__LeMeasure__CommitMove(sheet, text, ctx);
        else if (Na__LeMeasure__VectorReading(ctx))       outcome = (typeof ctx.typeVectorValue === 'function') ? ctx.typeVectorValue(text) : Na__LeMeasure__Fail('MeasureBadLength', 'Not a length. Type 2500, 2,500 or 2.5m.');   // <-- As TEXT: only the tool knows whether 90 is millimetres or degrees, and that 6s is a count
        else if (tool === Na__LeMeasure__TOOL_DRAW)     { outcome = Na__LeMeasure__CommitDraw(sheet, text, ctx);      Na__LeMeasure__Settle(ctx, sheet); }
        else if (tool === Na__LeMeasure__TOOL_RECT)     { outcome = Na__LeMeasure__CommitRectangle(sheet, text, ctx); Na__LeMeasure__Settle(ctx, sheet); }
        else if (tool === Na__LeMeasure__TOOL_DIMENSION)  outcome = Na__LeMeasure__CommitDimension(sheet, text, ctx);
        else return false;
        if (!outcome.ok) { Na__LeMeasure__ShowHint(outcome.message, true, true); return true; }
        Na__LeMeasure__Input.value = '';
        Na__LeMeasure__Root.classList.remove('na-le-vcb--typing');
        if (outcome.message) Na__LeMeasure__ShowHint(outcome.message, false, true);
        else Na__LeMeasure__HideHint();
        ctx.rerun();                                                         // <-- The band sets off again from the new point towards the cursor
        Na__LeMeasure__Refresh();
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Mount, Attach and Detach
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Sit the Box Clear of the Stage's Scrollbars
    // ------------------------------------------------------------
    function Na__LeMeasure__Place() {
        const stage = Na__LeMeasure__Stage, root = Na__LeMeasure__Root;
        if (!stage || !root) return;
        const gap = Na__LeCfg__GetMeasureSetup().edgeGapPx;
        root.style.right  = (Math.max(0, stage.offsetWidth  - stage.clientWidth)  + gap) + 'px';
        root.style.bottom = (Math.max(0, stage.offsetHeight - stage.clientHeight) + gap) + 'px';
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Box in the Stage's Column
    // ------------------------------------------------------------
    // host is the element the stage sits in; options: { editable, stage }.
    // Built once and hidden until the sheet tools attach. A read-only session
    // and a config with the box switched off never show it.
    // ------------------------------------------------------------
    function Na__LeMeasure__Mount(host, options) {
        if (Na__LeMeasure__Root) return true;
        if (!host || !Na__LeCfg__GetMeasureSetup().enabled) return false;
        const opts = options || {};
        Na__LeMeasure__Editable = !!opts.editable;
        Na__LeMeasure__Stage    = opts.stage || null;

        const root = Na__LeMeasure__El('div', 'na-le-vcb na-le-vcb--idle', host);
        root.hidden = true;
        root.setAttribute('role', 'group');
        const hint = Na__LeMeasure__El('div', 'na-le-vcb__hint', root);
        hint.hidden = true;
        hint.setAttribute('aria-live', 'polite');
        const label = Na__LeMeasure__El('span', 'na-le-vcb__label', root);
        const input = Na__LeMeasure__El('input', 'na-le-vcb__input', root);
        input.type         = 'text';
        input.autocomplete = 'off';
        input.spellcheck   = false;
        input.disabled     = true;
        input.setAttribute('aria-label', Na__LeMeasure__L('MeasureIdle', 'Measurements'));
        const scale = Na__LeMeasure__El('span', 'na-le-vcb__scale', root);
        scale.hidden = true;

        // THE BOX'S OWN KEYS, once it has been clicked into: Enter uses the
        // value (or, with nothing typed, hands the keys back to the sheet) and
        // Escape drops it. Nothing typed into the box reaches the sheet keys.
        input.addEventListener('keydown', (event) => {
            if (Na__LeCfg__GetMeasureKeys().commit.indexOf(event.key) !== -1) {
                event.preventDefault();
                if (!Na__LeMeasure__Commit()) Na__LeMeasure__Release();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                Na__LeMeasure__Clear();
                Na__LeMeasure__Release();
            }
            event.stopPropagation();
        });
        input.addEventListener('input', () => Na__LeMeasure__Typed());

        Na__LeMeasure__Root    = root;
        Na__LeMeasure__HintEl  = hint;
        Na__LeMeasure__LabelEl = label;
        Na__LeMeasure__Input   = input;
        Na__LeMeasure__ScaleEl = scale;
        Na__LeMeasure__Shown   = null;
        Na__LeMeasure__Refresh();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Start Listening With the Sheet Tools
    // ------------------------------------------------------------
    // context: { getTool(), isEditable(), getShapeDefaults(), getDimensionDefaults(),
    //            getShift(), getPointMm(), rerun(), getVertexDrag(), getVertexRetype(),
    //            typeVertexLength(), getDimEndDrag(), getDimEndRetype(), typeDimensionSpan(),
    //            getDimOffsetDrag(), getDimOffsetRetype(), typeDimensionOffset(),
    //            getMoveDrag(), getMoveRetype(), typeMoveLength(),
    //            getViewportDrag(), getViewportRetype(), typeViewportLength(),
    //            canArray(), typeMoveArray(mode, count) }
    // ------------------------------------------------------------
    function Na__LeMeasure__Attach(context) {
        Na__LeMeasure__Detach();
        if (!context || !Na__LeMeasure__Root) return false;
        Na__LeMeasure__Context  = context;
        Na__LeMeasure__Handlers = { key : (event) => Na__LeMeasure__OnKey(event), place : () => Na__LeMeasure__Place(), model : () => Na__LeMeasure__Refresh() };
        window.addEventListener('keydown', Na__LeMeasure__Handlers.key, true);   // <-- Capture: a value being typed is the box's before any binding sees the key
        window.addEventListener('resize', Na__LeMeasure__Handlers.place);
        window.addEventListener(Na__LeSurface__ZOOM_SETTLED_EVENT, Na__LeMeasure__Handlers.place);   // <-- Once a zoom has rested: its reads force a layout, and every wheel step paid for one
        window.addEventListener(Na__LeModel__CHANGED_EVENT, Na__LeMeasure__Handlers.model);   // <-- A new selection, an undo or an edit ends a finished move's retype: the box says so at once
        Na__LeMeasure__Root.hidden = !Na__LeMeasure__Editable;
        Na__LeMeasure__Place();
        Na__LeMeasure__Refresh();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Stop Listening, Drop What Was Typed and Put the Box Away
    // ------------------------------------------------------------
    function Na__LeMeasure__Detach() {
        if (Na__LeMeasure__Handlers) {
            window.removeEventListener('keydown', Na__LeMeasure__Handlers.key, true);
            window.removeEventListener('resize', Na__LeMeasure__Handlers.place);
            window.removeEventListener(Na__LeSurface__ZOOM_SETTLED_EVENT, Na__LeMeasure__Handlers.place);
            window.removeEventListener(Na__LeModel__CHANGED_EVENT, Na__LeMeasure__Handlers.model);
        }
        Na__LeMeasure__Handlers = null;
        Na__LeMeasure__Context  = null;
        if (!Na__LeMeasure__Root) return;
        Na__LeMeasure__Clear();
        Na__LeMeasure__Root.hidden = true;                                   // <-- The specification page, or the 3D view, has the screen
        Na__LeMeasure__Refresh();
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Value Being Typed
    // ------------------------------------------------------------
    function Na__LeMeasure__IsTyping() {
        return !!(Na__LeMeasure__Input && Na__LeMeasure__Input.value.trim());
    }
    // ------------------------------------------------------------


    // FUNCTION | Say Something Short on the Line Above the Box
    // ------------------------------------------------------------
    // AutoCAD echoes a drafting aid switched from the keyboard on its command
    // line ("<Ortho on>"); this box is the sheet's nearest thing to one, so a
    // toggle says it here. The line is timed like any other message, and it
    // is never said over a value being typed, because that value's reading
    // owns the line. Returns true when it was shown.
    // ------------------------------------------------------------
    function Na__LeMeasure__Say(text) {
        if (!Na__LeMeasure__Root || Na__LeMeasure__Root.hidden || !text || Na__LeMeasure__IsTyping()) return false;
        Na__LeMeasure__ShowHint(String(text), false, true);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Measurements Box API
    // ------------------------------------------------------------
    export {
        Na__LeMeasure__Mount,
        Na__LeMeasure__Attach,
        Na__LeMeasure__Detach,
        Na__LeMeasure__Refresh,
        Na__LeMeasure__Clear,
        Na__LeMeasure__Commit,
        Na__LeMeasure__IsTyping,
        Na__LeMeasure__Say
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
