// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PANEL: DIMENSIONS
// =============================================================================
//
// FILE       : Na__LayoutEditor__Panel__Dimensions__.js
// NAMESPACE  : Na__LePanelDims
// MODULE     : Layout Editor - Panel Dimensions
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Text size, colour, terminator, terminator size, offset, extension line lengths, precision, units and override for the selected dimension, or for new ones
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - With a sheet dimension selected the controls edit it and the panel
//   shows the value it measures (paper length times the scale of the
//   viewport it belongs to, or the sheet's scale off every viewport); with
//   nothing selected they set what the Dimension tool places next (D32).
// - MEASURE AT SCALE, the first control: on, the dimension reads the
//   drawing's real size and a length typed while placing one is a real size
//   (Na__LayoutEditor__DrawingScale__); off, it reads paper millimetres. Its
//   label quotes the scale that applies.
// - EXT. LINES, under Offset mm: how far the start's and the end's extension
//   lines run back from the dimension line, in paper millimetres, with a
//   padlock between the two. Shut (the default), typing either sets both;
//   open, each keeps its own, and shutting it again gives the end the start's
//   length. Empty is the full line. The measured points never move: a
//   shortened line still measures from its point, which is still a snap point.
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
// 14-Sep-2026 - Version 1.4.0
// - Size mm, under Ends: how large the ticks, arrows or dots at each end are,
//   in paper millimetres (Dimension__TickLengthMm). The selected dimension, or
//   the settings for new ones. A record from before it draws at the config's
//   TickLengthMm and the field shows that size.
//
// 14-Sep-2026 - Version 1.3.0
// - Ext. lines, under Offset mm: Start and End extension line lengths with a
//   padlock between them (Na__LePanels__LinkedPairRow), for the selected
//   dimension or for new ones. Each change is one undo step; a change to the
//   settings for new dimensions redraws the section, as nothing announces it.
//
// 14-Sep-2026 - Version 1.2.0
// - Measure at scale, the first control: the selected dimension's
//   Dimension__AtScale, or the atScale setting for new ones, with the scale it
//   reads at in its label. The Measures line says when a dimension reads the
//   sheet's scale or the paper.
//
// 14-Sep-2026 - Version 1.1.0
// - With several items selected the note says how many, and that these are the
//   settings for new dimensions until one dimension is selected on its own.
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 5.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Markup, Tools and Panel Host
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel, Na__LeCfg__GetDimensionSetup } from './Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__GetActiveSheet, Na__LeModel__GetSelection, Na__LeModel__GetSelectionItems, Na__LeModel__UpdateDimension } from './Na__LayoutEditor__SheetModel__.js';
    import { Na__LeMarkup__DimensionValueMm, Na__LeMarkup__FormatDimension, Na__LeMarkup__DimensionTickMm } from './Na__LayoutEditor__MarkupBridge__.js';
    import { Na__LeTools__GetDimensionDefaults, Na__LeTools__SetDimensionDefaults } from './Na__LayoutEditor__SheetTools__.js';
    import { Na__LeDrawScale__SheetDenominator, Na__LeDrawScale__DimensionHost, Na__LeDrawScale__DimensionAtScale, Na__LeDrawScale__Label } from './Na__LayoutEditor__DrawingScale__.js';
    import { Na__LeMeasure__Refresh } from './Na__LayoutEditor__Measurements__.js';
    import {
        Na__LePanels__RegisterSection,
        Na__LePanels__OnControl,
        Na__LePanels__Refresh,
        Na__LePanels__Row,
        Na__LePanels__Input,
        Na__LePanels__Select,
        Na__LePanels__Note,
        Na__LePanels__LinkedPairRow,
        Na__LePanels__ShowLink
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
        // MEASURE AT SCALE | First, because it decides what the value means
        const atScale = Na__LePanels__Row(Na__LePanelDims__AtScaleCaption(null), Na__LePanels__Input('checkbox', 'dim-at-scale'), 'na-le-row--toggle');
        atScale.title = Na__LeCfg__GetLabel('DimAtScaleTitle', "On: the dimension reads the drawing's real size - at the scale of the viewport it sits on, or the sheet's scale off every viewport. Off: it reads paper millimetres.");
        body.appendChild(atScale);
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('DimTextSize', 'Text mm'), Na__LePanels__Input('number', 'dim-size', { min : setup.minTextSizeMm, max : setup.maxTextSizeMm, step : 0.5 })));
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('DimColour', 'Colour'), Na__LePanels__Input('color', 'dim-colour')));
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('DimTerminator', 'Ends'), Na__LePanels__Select('dim-terminator', setup.terminators.map((t) => ({ value : t, label : t.charAt(0).toUpperCase() + t.slice(1) })))));
        const endSize = Na__LePanels__Row(Na__LeCfg__GetLabel('DimEndSize', 'Size mm'), Na__LePanels__Input('number', 'dim-end-size', { min : setup.minTickLengthMm, max : setup.maxTickLengthMm, step : 0.1 }));
        endSize.title = Na__LeCfg__GetLabel('DimEndSizeTitle', 'How large the ticks, arrows or dots at each end are, in paper millimetres.');
        body.appendChild(endSize);
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('DimOffset', 'Offset mm'), Na__LePanels__Input('number', 'dim-offset', { step : 1 })));
        // EXT. LINES | Start and end lengths, linked by the padlock between them
        const extFull = Na__LeCfg__GetLabel('DimExtensionFull', 'Full');
        body.appendChild(Na__LePanels__LinkedPairRow(Na__LeCfg__GetLabel('DimExtension', 'Ext. lines'), {
            first  : { control : 'dim-ext-start', caption : Na__LeCfg__GetLabel('DimExtensionStart', 'Start'),
                       attributes : { min : 0, step : 1, placeholder : extFull, title : Na__LeCfg__GetLabel('DimExtensionStartTitle', 'Start: how far the extension line at the first point picked runs back from the dimension line, in paper mm. Empty draws the full line.') } },
            link   : { control : 'dim-ext-link' },
            second : { control : 'dim-ext-end', caption : Na__LeCfg__GetLabel('DimExtensionEnd', 'End'),
                       attributes : { min : 0, step : 1, placeholder : extFull, title : Na__LeCfg__GetLabel('DimExtensionEndTitle', 'End: how far the extension line at the second point picked runs back from the dimension line, in paper mm. Empty draws the full line.') } }
        }));
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('DimPrecision', 'Decimals'), Na__LePanels__Select('dim-precision', [ 0, 1, 2 ].map((p) => ({ value : p, label : String(p) })))));
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('DimUnits', 'Units'), Na__LePanels__Input('text', 'dim-units', { placeholder : 'mm' })));
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('DimOverride', 'Override'), Na__LePanels__Input('text', 'dim-override', { placeholder : 'Measured value' })));
        const value = Na__LePanels__Note('');
        value.setAttribute('data-na-block', 'value');
        body.appendChild(value);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Measure at Scale Label, Quoting the Scale That Applies
    // ------------------------------------------------------------
    // A selected dimension on a drawing quotes that drawing's scale; anything
    // else the sheet's.
    // ------------------------------------------------------------
    function Na__LePanelDims__AtScaleCaption(selected) {
        const host  = selected ? Na__LeDrawScale__DimensionHost(selected.sheet, selected.item) : null;
        const sheet = selected ? selected.sheet : Na__LeModel__GetActiveSheet();
        const scale = Na__LeDrawScale__Label(host ? host.Viewport__ScaleDenominator : Na__LeDrawScale__SheetDenominator(sheet));
        return Na__LeCfg__FormatLabel('DimAtScale', 'Measure at scale ({scale})', { scale : scale });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What the Measures Line Adds About the Scale
    // ------------------------------------------------------------
    // Nothing for a dimension reading its own drawing's scale, which is what a
    // dimension on a drawing is expected to do; otherwise that it reads the
    // sheet's scale, or the paper.
    // ------------------------------------------------------------
    function Na__LePanelDims__MeasuresWhere(selected) {
        const host = Na__LeDrawScale__DimensionHost(selected.sheet, selected.item);
        if (!Na__LeDrawScale__DimensionAtScale(selected.sheet, selected.item)) {
            return ' ' + (host ? Na__LeCfg__GetLabel('DimPaperMeasure', '(paper millimetres)') : Na__LeCfg__GetLabel('DimPaperOnly', '(paper, not attached to a viewport)'));
        }
        if (host) return '';
        return ' ' + Na__LeCfg__FormatLabel('DimAtSheetScale', "(at the sheet's scale, {scale})", { scale : Na__LeDrawScale__Label(Na__LeDrawScale__SheetDenominator(selected.sheet)) });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect the Selection or the Defaults
    // ------------------------------------------------------------
    function Na__LePanelDims__Refresh(body) {
        const selected = Na__LePanelDims__Selected();
        const d = Na__LeTools__GetDimensionDefaults();
        const values = selected
            ? { textSizeMm : selected.item.Dimension__TextSizeMm, colour : selected.item.Dimension__Colour, terminator : selected.item.Dimension__Terminator, tickLengthMm : Na__LeMarkup__DimensionTickMm(selected.item), offsetMm : selected.item.Dimension__OffsetMm, precision : selected.item.Dimension__Precision, unitsSuffix : selected.item.Dimension__UnitsSuffix, overrideText : selected.item.Dimension__OverrideText || '' }
            : Object.assign({ overrideText : '' }, d);
        const set = (name, value) => { const el = body.querySelector('[data-na-control="' + name + '"]'); if (el && document.activeElement !== el) el.value = String(value); };
        set('dim-size', values.textSizeMm);
        set('dim-colour', /^#[0-9a-fA-F]{6}$/.test(values.colour) ? values.colour : '#172b3a');
        set('dim-terminator', values.terminator);
        set('dim-end-size', values.tickLengthMm);
        set('dim-offset', values.offsetMm);
        // EXT. LINES | A length the dimension does not hold is the full line: an empty field
        const ext = Na__LePanelDims__Extension(selected);
        set('dim-ext-start', ext.startMm === null ? '' : ext.startMm);
        set('dim-ext-end',   ext.endMm   === null ? '' : ext.endMm);
        Na__LePanels__ShowLink(body, 'dim-ext-link', ext.linked, ext.linked
            ? Na__LeCfg__GetLabel('DimExtensionLinkedTitle', 'Linked: Start and End take the same length. Click to set them separately.')
            : Na__LeCfg__GetLabel('DimExtensionUnlinkedTitle', 'Separate: Start and End keep their own lengths. Click to link them; End takes the Start length.'));
        set('dim-precision', values.precision);
        set('dim-units', values.unitsSuffix);
        set('dim-override', values.overrideText);
        const atScale = body.querySelector('[data-na-control="dim-at-scale"]');
        atScale.checked = selected ? Na__LeDrawScale__DimensionAtScale(selected.sheet, selected.item) : d.atScale !== false;
        atScale.parentNode.querySelector('.na-le-row__label').textContent = Na__LePanelDims__AtScaleCaption(selected);
        body.querySelector('[data-na-control="dim-override"]').parentNode.hidden = !selected;
        const many = Na__LeModel__GetSelectionItems().length;
        body.querySelector('[data-na-block="note"]').textContent = selected
            ? Na__LeCfg__GetLabel('DimSelectedNote', 'Editing the selected dimension.')
            : (many > 1
                ? Na__LeCfg__FormatLabel('DimManyNote', '{count} items selected. Click one dimension on its own to edit it; these settings apply to new dimensions.', { count : many })
                : Na__LeCfg__GetLabel('DimDefaultsNote', 'Nothing selected: these settings apply to new dimensions.'));
        const value = body.querySelector('[data-na-block="value"]');
        if (selected) {
            const mm = Na__LeMarkup__DimensionValueMm(selected.sheet, selected.item);
            value.textContent = Na__LeCfg__GetLabel('DimMeasures', 'Measures') + ' ' + Na__LeMarkup__FormatDimension(Object.assign({}, selected.item, { Dimension__OverrideText : null }), mm) +
                Na__LePanelDims__MeasuresWhere(selected);
            value.hidden = false;
        } else value.hidden = true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Extension Line Lengths in Play: the Selected Dimension's, or the Settings'
    // ------------------------------------------------------------
    // Returns { startMm, endMm, linked }; a length is null for the full line.
    // ------------------------------------------------------------
    function Na__LePanelDims__Extension(selected) {
        const mm = (value) => ((typeof value === 'number' && Number.isFinite(value) && value >= 0) ? value : null);
        if (selected) {
            const item = selected.item;
            return { startMm : mm(item.Dimension__StartExtensionMm), endMm : mm(item.Dimension__EndExtensionMm), linked : item.Dimension__ExtensionsLinked !== false };
        }
        const d = Na__LeTools__GetDimensionDefaults();
        return { startMm : mm(d.startExtensionMm), endMm : mm(d.endExtensionMm), linked : d.extensionsLinked !== false };
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


    // HELPER FUNCTION | A Length Typed Into Start or End
    // ------------------------------------------------------------
    // Empty is the full line, and a length below zero is taken as zero - the
    // line stops at the dimension line. While the padlock is shut the other
    // field shows the same length at once, even if it already has the focus,
    // so a linked pair never reads as two values. One patch: one undo step.
    // ------------------------------------------------------------
    function Na__LePanelDims__TypeExtension(el, side) {
        const text  = String(el.value).trim();
        const typed = text === '' ? null : parseFloat(text);
        if (typed !== null && !Number.isFinite(typed)) return;
        const mm    = typed === null ? null : Math.max(0, typed);
        if (String(mm === null ? '' : mm) !== text) el.value = mm === null ? '' : String(mm);   // <-- A length below zero shows as the zero it was taken as
        const ext   = Na__LePanelDims__Extension(Na__LePanelDims__Selected());
        const patch = ext.linked
            ? { startExtensionMm : mm, endExtensionMm : mm }
            : (side === 'start' ? { startExtensionMm : mm } : { endExtensionMm : mm });
        const pair  = ext.linked ? el.closest('.na-le-pair') : null;
        const other = pair ? pair.querySelector('[data-na-control="' + (side === 'start' ? 'dim-ext-end' : 'dim-ext-start') + '"]') : null;
        if (other) other.value = mm === null ? '' : String(mm);
        Na__LePanelDims__Apply(patch, patch);
        Na__LePanels__Refresh(Na__LePanelDims__ID);                           // <-- A settings change announces nothing, so it is shown here
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Padlock Between Start and End Clicked
    // ------------------------------------------------------------
    // Opening it lets the two lengths go their own ways. Shutting it gives the
    // end the start's length at once, so a shut padlock never sits between
    // two different values.
    // ------------------------------------------------------------
    function Na__LePanelDims__ToggleExtensionLink() {
        const ext   = Na__LePanelDims__Extension(Na__LePanelDims__Selected());
        const patch = ext.linked ? { extensionsLinked : false } : { extensionsLinked : true, endExtensionMm : ext.startMm };
        Na__LePanelDims__Apply(patch, patch);
        Na__LePanels__Refresh(Na__LePanelDims__ID);
    }
    // ------------------------------------------------------------


    // FUNCTION | Register the Section and Its Controls
    // ------------------------------------------------------------
    function Na__LePanelDims__Register() {
        Na__LePanels__OnControl('change', 'dim-size',       (e, el) => { const v = parseFloat(el.value); if (Number.isFinite(v)) Na__LePanelDims__Apply({ textSizeMm : v }, { textSizeMm : v }); });
        Na__LePanels__OnControl('change', 'dim-colour',     (e, el) => Na__LePanelDims__Apply({ colour : el.value }, { colour : el.value }));
        Na__LePanels__OnControl('change', 'dim-terminator', (e, el) => Na__LePanelDims__Apply({ terminator : el.value }, { terminator : el.value }));
        Na__LePanels__OnControl('change', 'dim-end-size',   (e, el) => { const v = parseFloat(el.value); if (Number.isFinite(v)) Na__LePanelDims__Apply({ tickLengthMm : v }, { tickLengthMm : v }); });
        Na__LePanels__OnControl('change', 'dim-offset',     (e, el) => { const v = parseFloat(el.value); if (Number.isFinite(v)) Na__LePanelDims__Apply({ offsetMm : v }, { offsetMm : v }); });
        Na__LePanels__OnControl('change', 'dim-ext-start',  (e, el) => Na__LePanelDims__TypeExtension(el, 'start'));
        Na__LePanels__OnControl('change', 'dim-ext-end',    (e, el) => Na__LePanelDims__TypeExtension(el, 'end'));
        Na__LePanels__OnControl('click',  'dim-ext-link',   () => Na__LePanelDims__ToggleExtensionLink());
        Na__LePanels__OnControl('change', 'dim-precision',  (e, el) => { const v = parseInt(el.value, 10); if (Number.isFinite(v)) Na__LePanelDims__Apply({ precision : v }, { precision : v }); });
        Na__LePanels__OnControl('change', 'dim-units',      (e, el) => Na__LePanelDims__Apply({ unitsSuffix : el.value }, { unitsSuffix : el.value }));
        Na__LePanels__OnControl('change', 'dim-override',   (e, el) => Na__LePanelDims__Apply({ overrideText : el.value }, null));
        Na__LePanels__OnControl('change', 'dim-at-scale',   (e, el) => {
            Na__LePanelDims__Apply({ atScale : el.checked }, { atScale : el.checked });   // <-- The selected dimension reads its value again; or new dimensions will
            Na__LePanels__Refresh(Na__LePanelDims__ID);                                    // <-- A settings change announces nothing, so it is shown here
            Na__LeMeasure__Refresh();
        });
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
