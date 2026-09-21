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
    import { Na__LeSurface__GetElements, Na__LeSurface__GetPixelsPerMm } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeMarkup__AnnotationBox, Na__LeMarkup__AnnotationRotationDeg, Na__LeMarkup__AnnotationCentre } from '../15__Core__Markup/Na__LayoutEditor__MarkupBridge__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Rotation
    // ------------------------------------------------------------
    const Na__LeText__ROTATE_MIN_MM = 0.25;   // <-- Nearer the middle than this a pointer's angle means nothing, so a rotate drag holds still
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Open Field
    // ------------------------------------------------------------
    let Na__LeText__Field = null;     // <-- { input, onCommit, onCancel }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Inline Field
// -----------------------------------------------------------------------------

    // FUNCTION | Open a Field Over the Paper
    // ------------------------------------------------------------
    // spec: { xMm, yMm, widthMm, fontMm, weight, colour, align, value,
    //         multiline, commitOnEnter, lineHeightMm, rotateDeg, originXMm,
    //         originYMm, onCommit(text), onCancel() }
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
        if (typeof field.onCommit === 'function') field.onCommit(text);
        return true;
    }
    function Na__LeText__Cancel() {
        const field = Na__LeText__Field;
        if (!field) return false;
        Na__LeText__Field = null;
        if (field.input.parentNode) field.input.parentNode.removeChild(field.input);
        if (typeof field.onCancel === 'function') field.onCancel();
        return true;
    }
    function Na__LeText__IsEditing() { return !!Na__LeText__Field; }
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
        const bounds = Na__LeMarkup__AnnotationBox(item);                        // <-- Unturned: a turned item's field is turned to match
        const fontMm = item.Annotation__SizeMm;
        const lineMm = fontMm * Na__LeCfg__GetTextSetup().lineSpacing;
        const extra  = fontMm * 6;                                               // <-- Room to type before the field needs to be wider
        const xMm    = item.Annotation__Align === 'center' ? bounds.X - (extra / 2)
                     : (item.Annotation__Align === 'right' ? bounds.X - extra : bounds.X);
        return Na__LeText__OpenField({
            xMm : xMm, yMm : bounds.Y, widthMm : bounds.WidthMm + extra, fontMm : fontMm,
            weight : item.Annotation__FontWeight, colour : item.Annotation__Colour, align : item.Annotation__Align, value : item.Annotation__Text,
            multiline : true, commitOnEnter : true, lineHeightMm : lineMm,
            rotateDeg : Na__LeMarkup__AnnotationRotationDeg(item), originXMm : item.Annotation__PosXMm, originYMm : item.Annotation__PosYMm,
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
