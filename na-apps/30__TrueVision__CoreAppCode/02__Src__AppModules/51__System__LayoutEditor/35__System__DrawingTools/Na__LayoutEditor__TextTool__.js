// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - TEXT TOOL
// =============================================================================
//
// FILE       : Na__LayoutEditor__TextTool__.js
// NAMESPACE  : Na__LeText
// MODULE     : Layout Editor - Text Tool
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Place text on the paper and edit any text inline: sheet annotations, and the value shown on a dimension
// CREATED    : 10-Sep-2026
//
// DESCRIPTION:
// - One inline field at a time, laid over the paper in the handles layer
//   at the item's position and size. Enter commits, Escape cancels, a blur
//   commits. Nothing else in the editor sees the keys while it is open.
// - Sheet annotations open a text area: Shift+Enter starts a new line,
//   Enter (or Ctrl+Enter) commits. A leader's note uses Enter for a new
//   line and Ctrl+Enter to commit.
// - A sheet annotation's field is laid on its own letters (OpenOnLetters):
//   no frame, no fill, its first baseline on the record's anchor, the same
//   face, size and spacing, growing with the text from its alignment point.
//   The painted letters stand aside while it is open, so nothing jumps when
//   typing starts or ends. Fill Block (justify) is spread as it is painted.
// - Text placement creates the annotation from the panel's defaults and
//   opens the field on it at once, so a new label is typed, not dragged.
// - The dimension tool borrows OpenField for its value override, and the
//   leader tool for a note (multiline) or a bubble's code.
// - Rotation: a text item turns about the middle of its box - from its rotate
//   grip (the sheet tools drive RotateStart and RotateTo), the Text panel's
//   Rotation box or the menu's Reset rotation. The record turns about its
//   anchor, so RotationPatch moves the anchor to keep the middle still. A
//   drag with Shift holds Text RotateStepDeg steps; without Shift it settles
//   on a right angle within Text RotateDetentDeg. The inline field over a
//   turned item is turned to match.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__ owns the pointer and delegates here;
//   Na__LayoutEditor__Panel__Text__ opens the field from its Edit button and
//   turns the selected text through RotationPatch.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__TextTool__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 27-Nov-2026 - Version 1.5.1 (TrueVision3D v2.189.12)
// - BeginEdit opens OpenOnLetters instead of OpenField: the field sits on
//   the painted letters. Before, its top was the box's top, so the first
//   baseline landed about a quarter of the size low (1.07 mm at 4 mm), a
//   few millimetres right of the letters, in a box six sizes wider than the
//   text with a 1 px frame the zoom made thick. Now the first baseline is
//   on the anchor (read from the page's own line layout), the width is the
//   longest line plus caret room, set out from the alignment point, and the
//   item's painted letters stand aside (MarkupBridge SetTypingAnnotation)
//   until it closes. The field is laid out large (240 px a line) and shrunk
//   onto the paper about the anchor: laid out at paper size, a browser
//   rounded its 15.36 px line height to 15 and each line drifted 0.36 paper
//   px. Its left and top are whole pixels and the fraction is in its
//   transform: a browser snaps a transformed box to whole pixels, which the
//   zoom made a 3 px jump. It has room below its last line and never keeps
//   a scroll: the letters hang 16 px below a 240 px line box, and the field
//   scrolled up by that as the caret reached the last line. Fill Block opens
//   spread as it is painted. Asked for
//   from IdeaSpace (Adam, 27-Nov-2026, of editing text boxes: "they such
//   they arent the right say and feel 'Jumpy'"). OpenField, for leaders,
//   bubbles and dimension values, is as it was.
//
// 20-Nov-2026 - Version 1.5.0 (TrueVision3D v2.189.6)
// - OpenField takes fontFamily and trackingMm; BeginEdit passes a text
//   item's own face, letter spacing and line spacing (MarkupBridge 1.21.0),
//   so the field is typed in the face the item is drawn in. A record
//   without them opens exactly as before.
//
// 21-Sep-2026 - Version 1.4.0
// - Place puts a new text item on the drawing grid while Grid Snap is on
//   (F7, Na__LayoutEditor__DrawingGrid__): the click lands on the nearest
//   grid point and the text is set from there. Grid Snap off, as before.
//
// 14-Sep-2026 - Version 1.3.0
// - Rotation: WrapDeg, RotationPatch (a turn about the middle of the box),
//   RotateStart and RotateTo (the rotate grip's drag, with Shift steps and a
//   right-angle detent). OpenField takes rotateDeg with originXMm and
//   originYMm and turns the field about that point; BeginEdit passes the
//   item's. Place takes defaults.rotationDeg and puts the top of the first
//   line on the press, turned or not.
//
// 14-Sep-2026 - Version 1.2.0
// - Sheet annotations open a text area (commitOnEnter): Shift+Enter starts
//   a new line, Enter still commits. Drawn as one line per newline.
//
// 14-Sep-2026 - Version 1.1.0
// - OpenField takes multiline: a text area instead of a single line, for a
//   leader's note. Enter starts a new line and Ctrl+Enter commits; Escape
//   still cancels and a blur still commits. It grows a row per line typed.
//
// 10-Sep-2026 - Version 1.0.0
// - Initial implementation, split from the sheet tools.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Model, Surface and Markup
    // ------------------------------------------------------------
    import {
        Na__LeModel__GetActiveSheet,
        Na__LeModel__CreateAnnotation,
        Na__LeModel__UpdateAnnotation,
        Na__LeModel__DeleteAnnotation,
        Na__LeModel__SetSelection
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeCfg__GetTextSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeGrid__SnapPoint } from '../27__System__DrawingGrid/Na__LayoutEditor__DrawingGrid__State__.js';   // <-- Grid Snap (F7): a leaf, the nearest grid point
    import { Na__LeSurface__GetElements, Na__LeSurface__GetPixelsPerMm, Na__LeSurface__Refresh } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeMarkup__AnnotationBox, Na__LeMarkup__AnnotationRotationDeg, Na__LeMarkup__AnnotationCentre, Na__LeMarkup__AnnotationLineMm, Na__LeMarkup__AnnotationFamily, Na__LeMarkup__AnnotationTrackingMm, Na__LeMarkup__SetTypingAnnotation } from '../15__Core__Markup/Na__LayoutEditor__MarkupBridge__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Rotation
    // ------------------------------------------------------------
    const Na__LeText__ROTATE_MIN_MM = 0.25;   // <-- Nearer the middle than this a pointer's angle means nothing, so a rotate drag holds still
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Field Laid on a Text Item's Letters
    // ------------------------------------------------------------
    const Na__LeText__CARET_ROOM_EM = 0.6;    // <-- Room past the longest line for the caret, in ems: the next letter has somewhere to go
    const Na__LeText__LAYOUT_LINE_PX = 240;   // <-- The field is laid out with lines this tall, a whole pixel, and shrunk onto the paper: a browser rounds a small line height (15.36 px to 15), which drifted each line 0.36 paper px
    const Na__LeText__SPACES        = /[  ]/g;
    const Na__LeText__TRAILING      = /[  ]+$/;
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Open Field
    // ------------------------------------------------------------
    let Na__LeText__Field = null;     // <-- { input, onCommit, onCancel, hides }
    let Na__LeText__Pen   = null;     // <-- A canvas context that measures a line in the field's own face
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Inline Field
// -----------------------------------------------------------------------------

    // FUNCTION | Open a Field Over the Paper
    // ------------------------------------------------------------
    // spec: { xMm, yMm, widthMm, fontMm, weight, colour, align, value,
    //         multiline, commitOnEnter, lineHeightMm, rotateDeg, originXMm,
    //         originYMm, fontFamily, trackingMm, onCommit(text), onCancel() }
    // rotateDeg turns the field clockwise about the paper point originXMm,
    // originYMm - a turned text item's anchor - so it lies over the text.
    // multiline opens a text area. By default Enter starts a new line and
    // Ctrl+Enter (or Cmd+Enter) commits. commitOnEnter keeps Enter as commit
    // (sheet annotations) and Shift+Enter starts the new line instead. It
    // grows a row for every line typed.
    // ------------------------------------------------------------
    function Na__LeText__OpenField(spec) {
        const layer = Na__LeSurface__GetElements().handles;
        if (!layer || !spec) return false;
        Na__LeText__Commit();
        const ppm           = Na__LeSurface__GetPixelsPerMm();
        const multiline     = spec.multiline === true;
        const commitOnEnter = spec.commitOnEnter === true;
        const input         = document.createElement(multiline ? 'textarea' : 'input');
        if (!multiline) input.type = 'text';
        input.className = 'na-le-text-editor' + (multiline ? ' na-le-text-editor--multiline' : '');
        input.value     = spec.value || '';
        input.style.left       = (spec.xMm * ppm) + 'px';
        input.style.top        = (spec.yMm * ppm) + 'px';
        input.style.width      = (Math.max(spec.widthMm + 4, 30) * ppm) + 'px';
        input.style.fontSize   = (spec.fontMm * ppm) + 'px';
        input.style.fontWeight = String(spec.weight || 400);
        input.style.color      = spec.colour || '';
        input.style.textAlign  = spec.align || 'left';
        if (typeof spec.fontFamily === 'string' && spec.fontFamily !== '') input.style.fontFamily = spec.fontFamily;
        if (Number.isFinite(spec.trackingMm) && spec.trackingMm > 0) input.style.letterSpacing = (spec.trackingMm * ppm) + 'px';
        if (Number.isFinite(spec.rotateDeg) && spec.rotateDeg !== 0) {
            const ox = Number.isFinite(spec.originXMm) ? spec.originXMm - spec.xMm : 0;
            const oy = Number.isFinite(spec.originYMm) ? spec.originYMm - spec.yMm : 0;
            input.style.transformOrigin = (ox * ppm) + 'px ' + (oy * ppm) + 'px';
            input.style.transform       = 'rotate(' + spec.rotateDeg + 'deg)';
        }
        if (multiline) {
            const lineMm = Number.isFinite(spec.lineHeightMm) ? spec.lineHeightMm : spec.fontMm * 1.2;
            const fit    = () => { input.rows = Math.max(1, input.value.split(/\r?\n/).length); };
            input.style.lineHeight = (lineMm * ppm) + 'px';
            input.wrap = 'off';                                                  // <-- A line breaks where a new line was typed, never where the box ends
            fit();
            input.addEventListener('input', fit);
        }
        input.addEventListener('keydown', (e) => {
            const commitEnter = e.key === 'Enter' && (!multiline || e.ctrlKey || e.metaKey || (commitOnEnter && !e.shiftKey));
            if (commitEnter) { e.preventDefault(); Na__LeText__Commit(); }
            if (e.key === 'Escape') { e.preventDefault(); Na__LeText__Cancel(); }
            e.stopPropagation();                                                 // <-- The sheet keys stay out of a field
        });
        input.addEventListener('blur', () => Na__LeText__Commit());
        layer.appendChild(input);
        Na__LeText__Field = { input : input, onCommit : spec.onCommit, onCancel : spec.onCancel };
        input.focus();
        input.select();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Commit or Cancel the Open Field
    // ------------------------------------------------------------
    function Na__LeText__Commit() {
        const field = Na__LeText__Field;
        if (!field) return false;
        Na__LeText__Field = null;
        const text = field.input.value.trim();
        if (field.input.parentNode) field.input.parentNode.removeChild(field.input);
        Na__LeText__ShowLetters(field);                                          // <-- Before the commit's own redraw, so the new words are painted at once
        if (typeof field.onCommit === 'function') field.onCommit(text);
        return true;
    }
    function Na__LeText__Cancel() {
        const field = Na__LeText__Field;
        if (!field) return false;
        Na__LeText__Field = null;
        if (field.input.parentNode) field.input.parentNode.removeChild(field.input);
        Na__LeText__ShowLetters(field);
        if (typeof field.onCancel === 'function') field.onCancel();
        return true;
    }

    // HELPER FUNCTION | Paint Again the Letters a Field Was Laid Over
    // ------------------------------------------------------------
    function Na__LeText__ShowLetters(field) {
        if (!field || !field.hides) return;
        Na__LeMarkup__SetTypingAnnotation(null);
        Na__LeSurface__Refresh('markup');
    }
    function Na__LeText__IsEditing() { return !!Na__LeText__Field; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Field Laid on a Text Item's Letters
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One Line's Width in Layout Pixels, in the Field's Own Face
    // ------------------------------------------------------------
    // Measured by a canvas at 100 px and scaled, as SheetChrome measures a
    // host face, so the field and the painted line agree to a hair.
    // ------------------------------------------------------------
    function Na__LeText__LinePx(line, look) {
        if (!line) return 0;
        if (!Na__LeText__Pen) {
            try { Na__LeText__Pen = document.createElement('canvas').getContext('2d'); } catch (e) { Na__LeText__Pen = null; }
        }
        const track = look.trackingPx * line.length;
        if (!Na__LeText__Pen) return (line.length * look.fontPx * 0.52) + track;
        Na__LeText__Pen.font = look.weight + ' 100px ' + look.family;
        return ((Na__LeText__Pen.measureText(line).width / 100) * look.fontPx) + track;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where the First Baseline Falls Below the Top of a Line Box, in Layout Pixels
    // ------------------------------------------------------------
    // Read from the page's own layout, not from font tables: a probe laid out
    // exactly as the field's first line, with a mark sitting on its baseline.
    // Whatever the browser does to the line box (half-leading, rounding the
    // face's ascent) the probe does too, so the field's baseline lands on the
    // painted one.
    // ------------------------------------------------------------
    function Na__LeText__BaselinePx(look) {
        const probe = document.createElement('div');
        const mark  = document.createElement('span');
        probe.style.cssText = 'position:fixed;left:-100000px;top:0;visibility:hidden;white-space:pre;margin:0;padding:0;border:0;';
        probe.style.fontFamily    = look.family;
        probe.style.fontWeight    = String(look.weight);
        probe.style.fontSize      = look.fontPx + 'px';
        probe.style.lineHeight    = look.linePx + 'px';
        probe.style.letterSpacing = look.trackingPx + 'px';
        mark.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline;';   // <-- An empty inline-block sits with its bottom on the baseline
        probe.appendChild(document.createTextNode('H'));
        probe.appendChild(mark);
        document.body.appendChild(probe);
        const drop = mark.getBoundingClientRect().top - probe.getBoundingClientRect().top;
        probe.remove();
        return Number.isFinite(drop) && drop > 0 ? drop : (look.linePx - look.fontPx) / 2 + (look.fontPx * 0.95);
    }
    // ------------------------------------------------------------


    // FUNCTION | Fit the Field to What Is Typed, Its First Baseline on the Anchor
    // ------------------------------------------------------------
    // The field is laid out look.scale times the paper's size (lines exactly
    // LAYOUT_LINE_PX tall) and shrunk by the same about the anchor, turned
    // there too, so it lands on the paper with no rounding of its own.
    // Width: the longest line, and caret room past it, set out from the anchor
    // the way the painted text is - growing right from a left anchor, both
    // ways from a centre, left from a right. Fill Block is exactly as wide as
    // its longest line, so every line is spread to that width as it is
    // painted. Height: one line box a line.
    // ------------------------------------------------------------
    function Na__LeText__FitOnLetters(input, look) {
        const lines = String(input.value).split(/\r?\n/);
        const fill  = look.align === 'justify';
        let widest = 0;
        lines.forEach((line) => { widest = Math.max(widest, Na__LeText__LinePx(fill ? line.replace(Na__LeText__TRAILING, '') : line, look)); });
        const caret = look.fontPx * Na__LeText__CARET_ROOM_EM;
        const width = fill ? Math.max(widest, 1) : widest + caret;                 // <-- Fill Block's lines spread to exactly the widest: its caret room is padding, outside them
        const along = look.align === 'center' ? width / 2 : (look.align === 'right' ? width : 0);   // <-- The anchor inside the field, in layout pixels
        const x     = look.anchorX - along, y = look.anchorY - look.baselinePx;  // <-- Unshrunk, the field's anchor point sits on the paper's anchor
        const left  = Math.floor(x), top = Math.floor(y);                        // <-- A transformed box is placed on whole pixels: the rest goes in its transform, or the zoom magnifies the snap
        const style = input.style;
        style.left            = left + 'px';
        style.top             = top + 'px';
        style.width           = width + 'px';
        style.height          = (Math.max(1, lines.length) * look.linePx) + 'px';
        style.paddingRight    = (fill ? caret : 0) + 'px';
        style.paddingBottom   = (look.linePx / 2) + 'px';                        // <-- The last line's letters hang below its line box: room for them, or the field scrolls up to show them
        style.transformOrigin = along + 'px ' + look.baselinePx + 'px';           // <-- The anchor: it stays put while the field shrinks and turns about it
        style.transform       = 'translate(' + (x - left) + 'px, ' + (y - top) + 'px)' + (look.rotateDeg ? ' rotate(' + look.rotateDeg + 'deg)' : '') + ' scale(' + (1 / look.scale) + ')';
    }
    // ------------------------------------------------------------


    // FUNCTION | Open a Field Laid Exactly on a Text Item's Own Letters
    // ------------------------------------------------------------
    // spec: { anchorXMm, anchorYMm, fontMm, lineMm, weight, colour, align,
    //         fontFamily, trackingMm, rotateDeg, value, hideAnnotationId,
    //         onCommit(text), onCancel() }
    // anchorXMm, anchorYMm is the record's anchor: the first line's baseline
    // at its alignment point. The field has no frame and no fill: the item's
    // painted letters stand aside while it is open (hideAnnotationId), and
    // the field's own letters are drawn in the same face, size, spacing and
    // place, so nothing moves when typing starts or ends. It grows with the
    // text. Enter commits, Shift+Enter starts a new line, Ctrl+Enter commits,
    // Escape cancels, a blur commits.
    // ------------------------------------------------------------
    function Na__LeText__OpenOnLetters(spec) {
        const layer = Na__LeSurface__GetElements().handles;
        if (!layer || !spec) return false;
        Na__LeText__Commit();
        const ppm    = Na__LeSurface__GetPixelsPerMm();
        const lineMm = (Number.isFinite(spec.lineMm) && spec.lineMm > 0) ? spec.lineMm : spec.fontMm * 1.2;
        const scale  = Na__LeText__LAYOUT_LINE_PX / (lineMm * ppm);               // <-- Layout pixels per paper pixel
        const look = {                                                           // <-- Sizes in layout pixels; the anchor in paper pixels
            scale      : scale,
            fontPx     : spec.fontMm * ppm * scale,
            linePx     : Na__LeText__LAYOUT_LINE_PX,
            weight     : spec.weight || 400,
            family     : spec.fontFamily || Na__LeCfg__GetTextSetup().fontFamily || "'Open Sans', Helvetica, Arial, sans-serif",
            trackingPx : (Number.isFinite(spec.trackingMm) && spec.trackingMm > 0) ? spec.trackingMm * ppm * scale : 0,
            align      : spec.align || 'left',
            rotateDeg  : Number.isFinite(spec.rotateDeg) ? spec.rotateDeg : 0,
            anchorX    : spec.anchorXMm * ppm,
            anchorY    : spec.anchorYMm * ppm
        };
        look.baselinePx = Na__LeText__BaselinePx(look);
        const input = document.createElement('textarea');
        input.className = 'na-le-text-editor na-le-text-editor--multiline na-le-text-editor--on-letters';
        input.value     = spec.value || '';
        input.wrap      = 'off';                                                 // <-- A line breaks where a new line was typed, never where the box ends
        input.setAttribute('data-na-le-role', 'text-on-letters');
        const style = input.style;
        style.fontFamily    = look.family;
        style.fontWeight    = String(look.weight);
        style.fontSize      = look.fontPx + 'px';
        style.lineHeight    = look.linePx + 'px';
        style.letterSpacing = look.trackingPx + 'px';
        style.color         = spec.colour || '';
        style.caretColor    = spec.colour || '';
        style.textAlign     = look.align === 'justify' ? 'justify' : look.align;
        if (look.align === 'justify') style.textAlignLast = 'justify';          // <-- Fill Block spreads every line, the last one too
        Na__LeText__FitOnLetters(input, look);
        input.addEventListener('input', () => Na__LeText__FitOnLetters(input, look));
        input.addEventListener('scroll', () => { if (input.scrollTop || input.scrollLeft) { input.scrollTop = 0; input.scrollLeft = 0; } });   // <-- Never scrolled: a scroll moves the words off the paint
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); Na__LeText__Commit(); }   // <-- Enter and Ctrl+Enter commit; Shift+Enter is a new line
            if (e.key === 'Escape') { e.preventDefault(); Na__LeText__Cancel(); }
            e.stopPropagation();                                                 // <-- The sheet keys stay out of a field
        });
        input.addEventListener('blur', () => Na__LeText__Commit());
        input.addEventListener('pointerdown', (e) => e.stopPropagation());       // <-- A click in the words places the caret: it is not a click on the sheet
        layer.appendChild(input);
        const hides = typeof spec.hideAnnotationId === 'string' && spec.hideAnnotationId !== '';
        Na__LeText__Field = { input : input, onCommit : spec.onCommit, onCancel : spec.onCancel, hides : hides };
        if (hides) {
            Na__LeMarkup__SetTypingAnnotation(spec.hideAnnotationId);
            Na__LeSurface__Refresh('markup');
        }
        input.focus({ preventScroll : true });
        input.select();
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Annotations
// -----------------------------------------------------------------------------

    // FUNCTION | Open the Field Over a Sheet Annotation
    // ------------------------------------------------------------
    function Na__LeText__BeginEdit(itemId) {
        const sheet = Na__LeModel__GetActiveSheet();
        const item  = sheet ? sheet.Sheet__Annotations.find((a) => a.Annotation__Id === itemId) : null;
        if (!item) return false;
        const fontMm = item.Annotation__SizeMm;
        return Na__LeText__OpenOnLetters({                                       // <-- On the painted letters themselves: nothing moves when typing starts
            anchorXMm : item.Annotation__PosXMm, anchorYMm : item.Annotation__PosYMm, fontMm : fontMm,
            lineMm : Na__LeMarkup__AnnotationLineMm(fontMm, item),
            weight : item.Annotation__FontWeight, colour : item.Annotation__Colour, align : item.Annotation__Align, value : item.Annotation__Text,
            fontFamily : Na__LeMarkup__AnnotationFamily(item), trackingMm : Na__LeMarkup__AnnotationTrackingMm(item),
            rotateDeg : Na__LeMarkup__AnnotationRotationDeg(item), hideAnnotationId : itemId,
            onCommit : (text) => {
                const live = Na__LeModel__GetActiveSheet();
                if (!live) return;
                if (text === '') Na__LeModel__DeleteAnnotation(live, itemId);           // <-- An emptied label is a deleted label
                else Na__LeModel__UpdateAnnotation(live, itemId, { text : text }, false);
            }
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Place a Text Item at a Point and Start Typing
    // ------------------------------------------------------------
    // defaults: { text, sizeMm, fontWeight, colour, align, leader, rotationDeg }
    // The press marks the top of the first line at its alignment point, turned
    // or not.
    // ------------------------------------------------------------
    function Na__LeText__Place(sheet, point, defaults) {
        point = Na__LeGrid__SnapPoint(point);                                    // <-- Grid Snap (F7): the text goes down on the grid point nearest the click
        const d    = defaults || {};
        const deg  = Na__LeText__WrapDeg(d.rotationDeg);
        const drop = (d.sizeMm || 3) * 0.72;                                     // <-- From the press down to the first baseline, before turning
        const a    = deg * (Math.PI / 180);
        const item = Na__LeModel__CreateAnnotation(sheet, point.x - (drop * Math.sin(a)), point.y + (drop * Math.cos(a)), {
            text : d.text, sizeMm : d.sizeMm, fontWeight : d.fontWeight, colour : d.colour, align : d.align, rotationDeg : deg,
            leaderXMm : d.leader ? point.x - 15 : null, leaderYMm : d.leader ? point.y + 10 : null
        });
        if (!item) return null;
        Na__LeModel__SetSelection({ kind : 'annotation', id : item.Annotation__Id });
        Na__LeText__BeginEdit(item.Annotation__Id);
        return item;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Rotation
// -----------------------------------------------------------------------------

    // FUNCTION | An Angle Wrapped Into (-180, 180] Degrees (anything not a number is 0)
    // ------------------------------------------------------------
    function Na__LeText__WrapDeg(deg) {
        if (!Number.isFinite(deg)) return 0;
        let d = deg % 360;
        if (d <= -180) d += 360;
        if (d > 180) d -= 360;
        return d;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Patch That Turns a Text Item to an Angle About the Middle of Its Box
    // ------------------------------------------------------------
    // The record turns about its anchor, so the anchor moves to keep the middle
    // of the box where it is: the text spins in place rather than swinging round
    // its first letter. Returns { rotationDeg, posXMm, posYMm } for
    // Na__LeModel__UpdateAnnotation.
    // ------------------------------------------------------------
    function Na__LeText__RotationPatch(item, deg) {
        const to     = Na__LeText__WrapDeg(deg);
        const box    = Na__LeMarkup__AnnotationBox(item);
        const middle = Na__LeMarkup__AnnotationCentre(item);                     // <-- Where the middle is on the paper now
        const cx     = (box.X + (box.WidthMm / 2)) - item.Annotation__PosXMm;    // <-- The middle from the anchor, before turning
        const cy     = (box.Y + (box.HeightMm / 2)) - item.Annotation__PosYMm;
        const a      = to * (Math.PI / 180), cos = Math.cos(a), sin = Math.sin(a);
        return { rotationDeg : to, posXMm : middle.x - ((cx * cos) - (cy * sin)), posYMm : middle.y - ((cx * sin) + (cy * cos)) };
    }
    // ------------------------------------------------------------


    // FUNCTION | Hold a Text Item Where a Drag on Its Rotate Grip Begins
    // ------------------------------------------------------------
    // The middle stays put for the whole drag, and the angle turns by as much as
    // the pointer has swung round that middle since the press, so a press a
    // little off the centre of the grip does not make the text jump.
    // ------------------------------------------------------------
    function Na__LeText__RotateStart(item, pointMm) {
        if (!item || !pointMm) return null;
        const middle = Na__LeMarkup__AnnotationCentre(item);
        return {
            posXMm  : item.Annotation__PosXMm,
            posYMm  : item.Annotation__PosYMm,
            deg     : Na__LeMarkup__AnnotationRotationDeg(item),
            middle  : middle,
            grabDeg : Math.atan2(pointMm.y - middle.y, pointMm.x - middle.x) * (180 / Math.PI)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Patch a Rotate Drag Makes at a Pointer (null too near the middle to read)
    // ------------------------------------------------------------
    // Shift holds the angle to Text RotateStepDeg steps. Without it the angle
    // settles on a right angle once within Text RotateDetentDeg of one, so level
    // and plumb text are found by feel.
    // ------------------------------------------------------------
    function Na__LeText__RotateTo(item, start, pointMm, shift) {
        if (!item || !start || !pointMm) return null;
        const dx = pointMm.x - start.middle.x, dy = pointMm.y - start.middle.y;
        if (Math.hypot(dx, dy) < Na__LeText__ROTATE_MIN_MM) return null;
        const setup = Na__LeCfg__GetTextSetup();
        let deg = start.deg + (Math.atan2(dy, dx) * (180 / Math.PI)) - start.grabDeg;
        if (shift && setup.rotateStepDeg > 0) {
            deg = Math.round(deg / setup.rotateStepDeg) * setup.rotateStepDeg;
        } else if (setup.rotateDetentDeg > 0) {
            const right = Math.round(deg / 90) * 90;
            if (Math.abs(deg - right) <= setup.rotateDetentDeg) deg = right;
        }
        const held = Object.assign({}, item, { Annotation__PosXMm : start.posXMm, Annotation__PosYMm : start.posYMm, Annotation__RotationDeg : start.deg });   // <-- Worked from where the drag began, never from the last move
        return Na__LeText__RotationPatch(held, deg);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Text Tool API
    // ------------------------------------------------------------
    export {
        Na__LeText__OpenField,
        Na__LeText__OpenOnLetters,
        Na__LeText__Commit,
        Na__LeText__Cancel,
        Na__LeText__IsEditing,
        Na__LeText__BeginEdit,
        Na__LeText__Place,
        Na__LeText__WrapDeg,
        Na__LeText__RotationPatch,
        Na__LeText__RotateStart,
        Na__LeText__RotateTo
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
