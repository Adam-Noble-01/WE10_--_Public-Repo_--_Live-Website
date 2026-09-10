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
// - Text placement creates the annotation from the panel's defaults and
//   opens the field on it at once, so a new label is typed, not dragged.
// - The dimension tool borrows OpenField for its value override.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__ owns the pointer and delegates here;
//   Na__LayoutEditor__Panel__Text__ opens the field from its Edit button.
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
    } from './Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__GetElements, Na__LeSurface__GetPixelsPerMm } from './Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeMarkup__AnnotationBounds } from './Na__LayoutEditor__MarkupBridge__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

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
    //         onCommit(text), onCancel() }
    // ------------------------------------------------------------
    function Na__LeText__OpenField(spec) {
        const layer = Na__LeSurface__GetElements().handles;
        if (!layer || !spec) return false;
        Na__LeText__Commit();
        const ppm   = Na__LeSurface__GetPixelsPerMm();
        const input = document.createElement('input');
        input.type      = 'text';
        input.className = 'na-le-text-editor';
        input.value     = spec.value || '';
        input.style.left       = (spec.xMm * ppm) + 'px';
        input.style.top        = (spec.yMm * ppm) + 'px';
        input.style.width      = (Math.max(spec.widthMm + 4, 30) * ppm) + 'px';
        input.style.fontSize   = (spec.fontMm * ppm) + 'px';
        input.style.fontWeight = String(spec.weight || 400);
        input.style.color      = spec.colour || '';
        input.style.textAlign  = spec.align || 'left';
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter')  { e.preventDefault(); Na__LeText__Commit(); }
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
        const bounds = Na__LeMarkup__AnnotationBounds(item);
        return Na__LeText__OpenField({
            xMm : bounds.X, yMm : bounds.Y, widthMm : bounds.WidthMm, fontMm : item.Annotation__SizeMm,
            weight : item.Annotation__FontWeight, colour : item.Annotation__Colour, align : item.Annotation__Align, value : item.Annotation__Text,
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
    // defaults: { text, sizeMm, fontWeight, colour, align, leader }
    // ------------------------------------------------------------
    function Na__LeText__Place(sheet, point, defaults) {
        const d = defaults || {};
        const item = Na__LeModel__CreateAnnotation(sheet, point.x, point.y + ((d.sizeMm || 3) * 0.72), {
            text : d.text, sizeMm : d.sizeMm, fontWeight : d.fontWeight, colour : d.colour, align : d.align,
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
        Na__LeText__Place
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
