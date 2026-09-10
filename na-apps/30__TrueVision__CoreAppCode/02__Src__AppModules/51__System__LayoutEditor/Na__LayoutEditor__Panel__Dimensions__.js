// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PANEL: DIMENSIONS
// =============================================================================
//
// FILE       : Na__LayoutEditor__Panel__Dimensions__.js
// NAMESPACE  : Na__LePanelDims
// MODULE     : Layout Editor - Panel Dimensions
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Text size, colour, terminator, offset, precision, units and override for the selected dimension, or for new ones
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - With a sheet dimension selected the controls edit it and the panel
//   shows the value it measures (paper length times the scale of the
//   viewport it belongs to); with nothing selected they set what the
//   Dimension tool places next (D32).
//
// INTEGRATION:
// - Registered into the right column by the mode controller.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__Panel__Dimensions__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 5.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Markup, Tools and Panel Host
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel, Na__LeCfg__GetDimensionSetup } from './Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__GetActiveSheet, Na__LeModel__GetSelection, Na__LeModel__UpdateDimension } from './Na__LayoutEditor__SheetModel__.js';
    import { Na__LeMarkup__DimensionValueMm, Na__LeMarkup__FormatDimension } from './Na__LayoutEditor__MarkupBridge__.js';
    import { Na__LeTools__GetDimensionDefaults, Na__LeTools__SetDimensionDefaults } from './Na__LayoutEditor__SheetTools__.js';
    import {
        Na__LePanels__RegisterSection,
        Na__LePanels__OnControl,
        Na__LePanels__Row,
        Na__LePanels__Input,
        Na__LePanels__Select,
        Na__LePanels__Note
    } from './Na__LayoutEditor__PanelHost__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Section
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Section Id
    // ------------------------------------------------------------
    const Na__LePanelDims__ID = 'dimensions';
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Selected Dimension, if Any
    // ------------------------------------------------------------
    function Na__LePanelDims__Selected() {
        const sheet = Na__LeModel__GetActiveSheet();
        const selection = Na__LeModel__GetSelection();
        if (!sheet || !selection || selection.kind !== 'dimension') return null;
        const item = sheet.Sheet__Dimensions.find((d) => d.Dimension__Id === selection.id) || null;
        return item ? { sheet : sheet, item : item } : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Controls
    // ------------------------------------------------------------
    function Na__LePanelDims__Build(body) {
        const setup = Na__LeCfg__GetDimensionSetup();
        const note = Na__LePanels__Note('');
        note.setAttribute('data-na-block', 'note');
        body.appendChild(note);
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('DimTextSize', 'Text mm'), Na__LePanels__Input('number', 'dim-size', { min : setup.minTextSizeMm, max : setup.maxTextSizeMm, step : 0.5 })));
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('DimColour', 'Colour'), Na__LePanels__Input('color', 'dim-colour')));
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('DimTerminator', 'Ends'), Na__LePanels__Select('dim-terminator', setup.terminators.map((t) => ({ value : t, label : t.charAt(0).toUpperCase() + t.slice(1) })))));
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('DimOffset', 'Offset mm'), Na__LePanels__Input('number', 'dim-offset', { step : 1 })));
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('DimPrecision', 'Decimals'), Na__LePanels__Select('dim-precision', [ 0, 1, 2 ].map((p) => ({ value : p, label : String(p) })))));
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('DimUnits', 'Units'), Na__LePanels__Input('text', 'dim-units', { placeholder : 'mm' })));
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('DimOverride', 'Override'), Na__LePanels__Input('text', 'dim-override', { placeholder : 'Measured value' })));
        const value = Na__LePanels__Note('');
        value.setAttribute('data-na-block', 'value');
        body.appendChild(value);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect the Selection or the Defaults
    // ------------------------------------------------------------
    function Na__LePanelDims__Refresh(body) {
        const selected = Na__LePanelDims__Selected();
        const d = Na__LeTools__GetDimensionDefaults();
        const values = selected
            ? { textSizeMm : selected.item.Dimension__TextSizeMm, colour : selected.item.Dimension__Colour, terminator : selected.item.Dimension__Terminator, offsetMm : selected.item.Dimension__OffsetMm, precision : selected.item.Dimension__Precision, unitsSuffix : selected.item.Dimension__UnitsSuffix, overrideText : selected.item.Dimension__OverrideText || '' }
            : Object.assign({ overrideText : '' }, d);
        const set = (name, value) => { const el = body.querySelector('[data-na-control="' + name + '"]'); if (el && document.activeElement !== el) el.value = String(value); };
        set('dim-size', values.textSizeMm);
        set('dim-colour', /^#[0-9a-fA-F]{6}$/.test(values.colour) ? values.colour : '#172b3a');
        set('dim-terminator', values.terminator);
        set('dim-offset', values.offsetMm);
        set('dim-precision', values.precision);
        set('dim-units', values.unitsSuffix);
        set('dim-override', values.overrideText);
        body.querySelector('[data-na-control="dim-override"]').parentNode.hidden = !selected;
        body.querySelector('[data-na-block="note"]').textContent = selected
            ? Na__LeCfg__GetLabel('DimSelectedNote', 'Editing the selected dimension.')
            : Na__LeCfg__GetLabel('DimDefaultsNote', 'Nothing selected: these settings apply to new dimensions.');
        const value = body.querySelector('[data-na-block="value"]');
        if (selected) {
            const mm = Na__LeMarkup__DimensionValueMm(selected.sheet, selected.item);
            value.textContent = Na__LeCfg__GetLabel('DimMeasures', 'Measures') + ' ' + Na__LeMarkup__FormatDimension(Object.assign({}, selected.item, { Dimension__OverrideText : null }), mm) +
                (selected.item.Dimension__ViewportId ? '' : ' ' + Na__LeCfg__GetLabel('DimPaperOnly', '(paper, not attached to a viewport)'));
            value.hidden = false;
        } else value.hidden = true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Apply a Change to the Selection or the Defaults
    // ------------------------------------------------------------
    function Na__LePanelDims__Apply(patch, defaultsPatch) {
        const selected = Na__LePanelDims__Selected();
        if (selected) Na__LeModel__UpdateDimension(selected.sheet, selected.item.Dimension__Id, patch);
        else if (defaultsPatch) Na__LeTools__SetDimensionDefaults(defaultsPatch);
    }
    // ------------------------------------------------------------


    // FUNCTION | Register the Section and Its Controls
    // ------------------------------------------------------------
    function Na__LePanelDims__Register() {
        Na__LePanels__OnControl('change', 'dim-size',       (e, el) => { const v = parseFloat(el.value); if (Number.isFinite(v)) Na__LePanelDims__Apply({ textSizeMm : v }, { textSizeMm : v }); });
        Na__LePanels__OnControl('change', 'dim-colour',     (e, el) => Na__LePanelDims__Apply({ colour : el.value }, { colour : el.value }));
        Na__LePanels__OnControl('change', 'dim-terminator', (e, el) => Na__LePanelDims__Apply({ terminator : el.value }, { terminator : el.value }));
        Na__LePanels__OnControl('change', 'dim-offset',     (e, el) => { const v = parseFloat(el.value); if (Number.isFinite(v)) Na__LePanelDims__Apply({ offsetMm : v }, { offsetMm : v }); });
        Na__LePanels__OnControl('change', 'dim-precision',  (e, el) => { const v = parseInt(el.value, 10); if (Number.isFinite(v)) Na__LePanelDims__Apply({ precision : v }, { precision : v }); });
        Na__LePanels__OnControl('change', 'dim-units',      (e, el) => Na__LePanelDims__Apply({ unitsSuffix : el.value }, { unitsSuffix : el.value }));
        Na__LePanels__OnControl('change', 'dim-override',   (e, el) => Na__LePanelDims__Apply({ overrideText : el.value }, null));
        return Na__LePanels__RegisterSection('right', {
            id : Na__LePanelDims__ID, title : Na__LeCfg__GetLabel('DimensionsTitle', 'Dimensions'),
            build : Na__LePanelDims__Build, refresh : Na__LePanelDims__Refresh
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Dimensions Panel API
    // ------------------------------------------------------------
    export {
        Na__LePanelDims__Register
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
