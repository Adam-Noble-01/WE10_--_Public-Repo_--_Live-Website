// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PANEL: SHEET
// =============================================================================
//
// FILE       : Na__LayoutEditor__Panel__Sheet__.js
// NAMESPACE  : Na__LePanelSheet
// MODULE     : Layout Editor - Panel Sheet
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Sheet name, paper size, orientation, title block style and the title block fields
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - The paper and title block settings of the active sheet, and the eight
//   title block fields (D26). A field left blank falls back to its project
//   default (the placeholder shows what that would be); typing overrides it
//   for this sheet only.
//
// INTEGRATION:
// - Registered into the left column by the mode controller.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__Panel__Sheet__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.1.0
// - Lineweights in points for the viewport linework and the dimensions.
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 5.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Layout, Model and Panel Host
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel, Na__LeCfg__GetTitleBlockSetup, Na__LeCfg__GetLineweightSetup } from './Na__LayoutEditor__ConfigState__.js';
    import { Na__LeLayout__ListPaperSizes } from './Na__LayoutEditor__SheetLayout__.js';
    import {
        Na__LeModel__GetActiveSheet,
        Na__LeModel__UpdateSheet,
        Na__LeModel__GetFields,
        Na__LeModel__SetField
    } from './Na__LayoutEditor__SheetModel__.js';
    import {
        Na__LePanels__RegisterSection,
        Na__LePanels__OnControl,
        Na__LePanels__Row,
        Na__LePanels__Input,
        Na__LePanels__Select
    } from './Na__LayoutEditor__PanelHost__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Section
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Section Id
    // ------------------------------------------------------------
    const Na__LePanelSheet__ID = 'sheet';
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Controls
    // ------------------------------------------------------------
    function Na__LePanelSheet__Build(body) {
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('SheetName', 'Name'), Na__LePanels__Input('text', 'sheet-name')));
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('PaperSize', 'Paper'), Na__LePanels__Select('sheet-paper', Na__LeLayout__ListPaperSizes().map((p) => ({ value : p.Key, label : p.Label })))));
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('Orientation', 'Orientation'), Na__LePanels__Select('sheet-orientation', [ { value : 'landscape', label : 'Landscape' }, { value : 'portrait', label : 'Portrait' } ])));
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('TitleBlockStyle', 'Title block'), Na__LePanels__Select('sheet-titleblock', [ { value : 'modern', label : 'Modern' }, { value : 'classic', label : 'Classic' } ])));
        const lw = Na__LeCfg__GetLineweightSetup();
        const lwHeading = document.createElement('div');
        lwHeading.className   = 'na-le-subheading';
        lwHeading.textContent = Na__LeCfg__GetLabel('Lineweights', 'Lineweights (pt)');
        body.appendChild(lwHeading);
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('ViewportLinesPt', 'Viewport lines'), Na__LePanels__Input('number', 'sheet-lw-viewport', { min : lw.minPt, max : lw.maxPt, step : lw.stepPt })));
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('DimensionLinesPt', 'Dimension lines'), Na__LePanels__Input('number', 'sheet-lw-dimension', { min : lw.minPt, max : lw.maxPt, step : lw.stepPt })));

        const heading = document.createElement('div');
        heading.className   = 'na-le-subheading';
        heading.textContent = Na__LeCfg__GetLabel('TitleBlockFields', 'Title block fields');
        body.appendChild(heading);

        Na__LeCfg__GetTitleBlockSetup().rows.forEach((row) => {
            const input = Na__LePanels__Input('text', 'sheet-field');
            input.setAttribute('data-na-role', row.Key);
            body.appendChild(Na__LePanels__Row(row.Label || row.Key, input));
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect the Active Sheet
    // ------------------------------------------------------------
    function Na__LePanelSheet__Refresh(body) {
        const sheet = Na__LeModel__GetActiveSheet();
        const set = (name, value) => { const el = body.querySelector('[data-na-control="' + name + '"]'); if (el && document.activeElement !== el) el.value = value; };
        if (!sheet) return;
        set('sheet-name', sheet.Sheet__Name);
        set('sheet-paper', sheet.Sheet__PaperSize);
        set('sheet-orientation', sheet.Sheet__Orientation);
        set('sheet-titleblock', sheet.Sheet__TitleBlockStyle);
        set('sheet-lw-viewport', sheet.Sheet__Lineweights ? String(sheet.Sheet__Lineweights.ViewportPt) : '');
        set('sheet-lw-dimension', sheet.Sheet__Lineweights ? String(sheet.Sheet__Lineweights.DimensionPt) : '');
        const fields = Na__LeModel__GetFields(sheet);
        body.querySelectorAll('[data-na-control="sheet-field"]').forEach((input) => {
            const key    = input.getAttribute('data-na-role');
            const stored = sheet.Sheet__Fields ? sheet.Sheet__Fields['Sheet__Fields__' + key] : undefined;
            input.placeholder = fields[key] || '';
            if (document.activeElement !== input) input.value = (typeof stored === 'string') ? stored : '';
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Register the Section and Its Controls
    // ------------------------------------------------------------
    function Na__LePanelSheet__Register() {
        Na__LePanels__OnControl('change', 'sheet-name',        (e, el) => { const s = Na__LeModel__GetActiveSheet(); if (s) Na__LeModel__UpdateSheet(s, { name : el.value }); });
        Na__LePanels__OnControl('change', 'sheet-paper',       (e, el) => { const s = Na__LeModel__GetActiveSheet(); if (s) Na__LeModel__UpdateSheet(s, { paperSize : el.value }); });
        Na__LePanels__OnControl('change', 'sheet-orientation', (e, el) => { const s = Na__LeModel__GetActiveSheet(); if (s) Na__LeModel__UpdateSheet(s, { orientation : el.value }); });
        Na__LePanels__OnControl('change', 'sheet-titleblock',  (e, el) => { const s = Na__LeModel__GetActiveSheet(); if (s) Na__LeModel__UpdateSheet(s, { titleBlockStyle : el.value }); });
        Na__LePanels__OnControl('change', 'sheet-lw-viewport',  (e, el) => { const s = Na__LeModel__GetActiveSheet(); const v = parseFloat(el.value); if (s && Number.isFinite(v)) Na__LeModel__UpdateSheet(s, { lineweights : { viewportPt : v } }); });
        Na__LePanels__OnControl('change', 'sheet-lw-dimension', (e, el) => { const s = Na__LeModel__GetActiveSheet(); const v = parseFloat(el.value); if (s && Number.isFinite(v)) Na__LeModel__UpdateSheet(s, { lineweights : { dimensionPt : v } }); });
        Na__LePanels__OnControl('change', 'sheet-field', (e, el, key) => {
            const s = Na__LeModel__GetActiveSheet();
            if (s) Na__LeModel__SetField(s, key, el.value.trim() === '' ? null : el.value);
        });
        return Na__LePanels__RegisterSection('left', {
            id : Na__LePanelSheet__ID, title : Na__LeCfg__GetLabel('SheetTitle', 'Sheet'),
            build : Na__LePanelSheet__Build, refresh : Na__LePanelSheet__Refresh
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Sheet Panel API
    // ------------------------------------------------------------
    export {
        Na__LePanelSheet__Register
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
