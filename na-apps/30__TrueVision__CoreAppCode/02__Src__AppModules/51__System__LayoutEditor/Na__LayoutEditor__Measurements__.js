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
//   beside it. With any other tool it rests, greyed.
// - TYPE WITHOUT CLICKING. While one of those tools is up, a number typed
//   anywhere over the editor goes into the box and Enter uses it: Draw puts
//   the next point that far along the rubber band, Rectangle lands the
//   opposite corner (or resizes the rectangle that has just landed), and
//   Dimension picks the end, then puts the line that far off. Escape or
//   Delete drops what was typed and Backspace takes a character back - each
//   only while something is typed, so every key keeps its usual job
//   otherwise. Letters stay tool keys until a value is started. A click on
//   the sheet drops a half-typed value, as it does in SketchUp. Clicking the
//   box types into it directly, which is also how a touch screen reaches it.
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
//   its tool, its defaults, the last cursor point, Shift, and a way to run the
//   tool's move again; it calls Refresh after every move and press, and Clear
//   whenever a placement is abandoned or the sheet is pressed.
// - The keys come from Na__LayoutEditor__KeyMappings__.json (MeasurementsBox)
//   and the setup and wording from Na__LayoutEditor__AppConfig__.json.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
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
    import { Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel, Na__LeCfg__GetMeasureSetup, Na__LeCfg__GetMeasureKeys, Na__LeCfg__GetDimensionSetup } from './Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__GetActiveSheet } from './Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__ZOOM_EVENT } from './Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeDrawScale__DenominatorAt, Na__LeDrawScale__DimensionAtScale, Na__LeDrawScale__DimensionDenominator, Na__LeDrawScale__Label } from './Na__LayoutEditor__DrawingScale__.js';
    import { Na__LeMParse__REASON_UNIT, Na__LeMParse__Length, Na__LeMParse__Pair, Na__LeMParse__Format } from './Na__LayoutEditor__MeasureParse__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Three Tools That Measure
    // ------------------------------------------------------------
    import { Na__LeShape__Measure, Na__LeShape__TypeLength } from './Na__LayoutEditor__ShapeTool__.js';
    import { Na__LeRect__Measure, Na__LeRect__TypeSize } from './Na__LayoutEditor__RectangleTool__.js';
    import { Na__LeDim__Measure, Na__LeDim__TypeSpan, Na__LeDim__TypeOffset } from './Na__LayoutEditor__DimensionTool__.js';
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
        return tool === Na__LeMeasure__TOOL_DRAW || tool === Na__LeMeasure__TOOL_RECT || tool === Na__LeMeasure__TOOL_DIMENSION;
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
        const tool  = ctx ? ctx.getTool() : null;
        if (!ctx || !sheet || !ctx.isEditable() || !Na__LeMeasure__IsMeasuringTool(tool)) {
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


    // FUNCTION | Bring the Box Up to Date With the Tool, the Drawing and the Scale
    // ------------------------------------------------------------
    // Called after every move and press. Only what has changed is written.
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
        const shown = Na__LeMeasure__Shown || {};
        if (shown.label !== reading.label) Na__LeMeasure__LabelEl.textContent = reading.label;
        if (shown.value !== reading.value) Na__LeMeasure__Input.placeholder = reading.value;      // <-- The reading is the placeholder, so a typed value simply replaces it
        if (shown.scale !== scale) { Na__LeMeasure__ScaleEl.textContent = scale; Na__LeMeasure__ScaleEl.hidden = !scale; }
        if (shown.title !== title) Na__LeMeasure__ScaleEl.title = title;
        if (shown.paper !== paper) Na__LeMeasure__ScaleEl.classList.toggle('na-le-vcb__scale--paper', paper);
        if (shown.idle !== idle) {
            Na__LeMeasure__Root.classList.toggle('na-le-vcb--idle', idle);
            Na__LeMeasure__Root.title = idle
                ? Na__LeMeasure__L('MeasureIdleTitle', 'Pick the Draw (L), Rectangle (R) or Dimension (D) tool to type sizes here.')
                : Na__LeMeasure__L('MeasureTitle', 'Measurements: while drawing, type a length and press Enter - 2500, 2,500 or 2.5m. A number with no unit is millimetres. A rectangle takes width x height.');
            if (idle) {
                if (document.activeElement === Na__LeMeasure__Input) Na__LeMeasure__Input.blur();
                Na__LeMeasure__Clear();
            }
            Na__LeMeasure__Input.disabled = idle;
        }
        Na__LeMeasure__Shown = { label : reading.label, value : reading.value, scale : scale, title : title, paper : paper, idle : idle };
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


    // HELPER FUNCTION | The Typed Value Changed
    // ------------------------------------------------------------
    function Na__LeMeasure__Typed() {
        if (!Na__LeMeasure__Root) return;
        const text = Na__LeMeasure__Input.value;
        Na__LeMeasure__Root.classList.toggle('na-le-vcb--typing', !!text.trim());
        if (!text.trim()) { Na__LeMeasure__HideHint(); return; }
        const reading = Na__LeMeasure__Reading();
        const reads   = reading.active ? Na__LeMeasure__Reads(reading.kind, text) : null;
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
        if (!ctx.isEditable() || !Na__LeMeasure__IsMeasuringTool(ctx.getTool())) return;
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
        if ((typed ? keys.typing : keys.start).indexOf(key) === -1) return;            // <-- A letter with nothing typed is still a tool key
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
        const tool = ctx.getTool();
        let outcome;
        if (tool === Na__LeMeasure__TOOL_DRAW)           outcome = Na__LeMeasure__CommitDraw(sheet, text, ctx);
        else if (tool === Na__LeMeasure__TOOL_RECT)      outcome = Na__LeMeasure__CommitRectangle(sheet, text, ctx);
        else if (tool === Na__LeMeasure__TOOL_DIMENSION) outcome = Na__LeMeasure__CommitDimension(sheet, text, ctx);
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
    //            getShift(), getPointMm(), rerun() }
    // ------------------------------------------------------------
    function Na__LeMeasure__Attach(context) {
        Na__LeMeasure__Detach();
        if (!context || !Na__LeMeasure__Root) return false;
        Na__LeMeasure__Context  = context;
        Na__LeMeasure__Handlers = { key : (event) => Na__LeMeasure__OnKey(event), place : () => Na__LeMeasure__Place() };
        window.addEventListener('keydown', Na__LeMeasure__Handlers.key, true);   // <-- Capture: a value being typed is the box's before any binding sees the key
        window.addEventListener('resize', Na__LeMeasure__Handlers.place);
        window.addEventListener(Na__LeSurface__ZOOM_EVENT, Na__LeMeasure__Handlers.place);
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
            window.removeEventListener(Na__LeSurface__ZOOM_EVENT, Na__LeMeasure__Handlers.place);
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
        Na__LeMeasure__IsTyping
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
