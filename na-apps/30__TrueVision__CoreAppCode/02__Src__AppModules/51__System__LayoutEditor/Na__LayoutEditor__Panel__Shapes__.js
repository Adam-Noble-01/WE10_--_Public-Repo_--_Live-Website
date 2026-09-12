// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - VECTORS PANEL
// =============================================================================
//
// FILE       : Na__LayoutEditor__Panel__Shapes__.js
// NAMESPACE  : Na__LePanelShapes
// MODULE     : Layout Editor - Vectors Panel
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Edges, edge colour and weight, fill and closure for the selected shape, or the defaults for the next one
// CREATED    : 10-Sep-2026
//
// DESCRIPTION:
// - With a shape selected the controls edit it; with nothing selected they
//   set what the Draw tool uses next, the same way the Text and Dimensions
//   panels work.
// - Weights are printed points because that is what a drawing office
//   reads; the geometry converts to paper millimetres.
// - Edges and fill are either-or at the least, which gives the three
//   states a drawing wants: edges alone (a line or an outline), edges with
//   a fill, or a fill alone (a solid, a mask, a block of tone). Switching
//   one off switches the other on, so a shape is never invisible.
// - The edge colour and weight rows go away while the edges are off, and
//   the fill colour while there is no fill, so the panel only ever shows
//   what is in play.
//
// INTEGRATION:
// - Registered by the mode controller in the right column.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__Panel__Shapes__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 12-Sep-2026 - Version 1.2.0
// - The draw-tool and axis-lock instruction paragraphs are gone from the
//   panel body; they took more height than the controls they explained.
//
// 10-Sep-2026 - Version 1.1.0
// - The Edges toggle, the either-or rule that keeps a shape visible, and
//   rows that hide when they have nothing to say.
//
// 10-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Tools and Panel Host
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel, Na__LeCfg__GetLineweightSetup } from './Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__GetActiveSheet, Na__LeModel__GetSelection, Na__LeModel__UpdateShape } from './Na__LayoutEditor__SheetModel__.js';
    import { Na__LeTools__GetShapeDefaults, Na__LeTools__SetShapeDefaults } from './Na__LayoutEditor__SheetTools__.js';
    import {
        Na__LePanels__RegisterSection,
        Na__LePanels__OnControl,
        Na__LePanels__Refresh,
        Na__LePanels__Row,
        Na__LePanels__Input,
        Na__LePanels__Note
    } from './Na__LayoutEditor__PanelHost__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Section
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Section Id
    // ------------------------------------------------------------
    const Na__LePanelShapes__ID = 'shapes';
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Selected Shape, if Any
    // ------------------------------------------------------------
    function Na__LePanelShapes__Selected() {
        const sheet = Na__LeModel__GetActiveSheet();
        const selection = Na__LeModel__GetSelection();
        if (!sheet || !selection || selection.kind !== 'shape') return null;
        const item = sheet.Sheet__Shapes.find((s) => s.Shape__Id === selection.id) || null;
        return item ? { sheet : sheet, item : item } : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Controls
    // ------------------------------------------------------------
    function Na__LePanelShapes__Build(body) {
        const lw = Na__LeCfg__GetLineweightSetup();
        const note = Na__LePanels__Note('');
        note.setAttribute('data-na-block', 'note');
        body.appendChild(note);
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('ShapeStroked', 'Edges'), Na__LePanels__Input('checkbox', 'shape-stroked')));
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('ShapeStroke', 'Edge colour'), Na__LePanels__Input('color', 'shape-stroke')));
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('ShapeStrokePt', 'Edge pt'), Na__LePanels__Input('number', 'shape-pt', { min : lw.minPt, max : lw.maxPt, step : lw.stepPt })));
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('ShapeFill', 'Fill'), Na__LePanels__Input('checkbox', 'shape-filled')));
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('ShapeFillColour', 'Fill colour'), Na__LePanels__Input('color', 'shape-fill')));
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('ShapeClosed', 'Closed'), Na__LePanels__Input('checkbox', 'shape-closed')));
        const either = Na__LePanels__Note(Na__LeCfg__GetLabel('ShapeEitherNote', 'Edges and fill are either or: switching one off switches the other on, so a shape always shows.'));
        either.setAttribute('data-na-block', 'either');
        body.appendChild(either);
        // THE DRAW AND AXIS INSTRUCTIONS ARE NOT PRINTED HERE ANY MORE. Two
        // paragraphs of prose pushed the actual controls off the top of a
        // short panel, and they are reference material read once - they live
        // in the labels config (ShapeDrawNote, ShapeAxisNote) and in the
        // module headers, where they can be read without costing panel height
        // on every session.
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect the Selection or the Defaults
    // ------------------------------------------------------------
    function Na__LePanelShapes__Refresh(body) {
        const selected = Na__LePanelShapes__Selected();
        const d = Na__LeTools__GetShapeDefaults();
        const values = selected
            ? { strokeColour : selected.item.Shape__StrokeColour, strokePt : selected.item.Shape__StrokePt, stroked : selected.item.Shape__Stroked !== false, filled : !!selected.item.Shape__FillColour, fillColour : selected.item.Shape__FillColour || d.fillColour, closed : selected.item.Shape__Closed === true }
            : { strokeColour : d.strokeColour, strokePt : d.strokePt, stroked : d.stroked !== false, filled : d.filled === true, fillColour : d.fillColour, closed : false };
        const canFill = !selected || selected.item.Shape__Points.length > 2;   // <-- A two-point line encloses nothing, so its edges have to stay
        const el  = (name) => body.querySelector('[data-na-control="' + name + '"]');
        const set = (name, value) => { const e = el(name); if (e && document.activeElement !== e) e.value = String(value); };
        const hex = (value, fallback) => (/^#[0-9a-fA-F]{6}$/.test(String(value)) ? value : fallback);
        set('shape-stroke', hex(values.strokeColour, '#172b3a'));
        set('shape-pt', values.strokePt);
        set('shape-fill', hex(values.fillColour, '#e4e8ec'));
        el('shape-stroked').checked = values.stroked;
        el('shape-filled').checked = values.filled;
        el('shape-closed').checked = values.closed;
        el('shape-closed').parentNode.hidden  = !selected;
        el('shape-stroked').parentNode.hidden = !canFill;
        el('shape-filled').parentNode.hidden  = !canFill;
        el('shape-stroke').parentNode.hidden  = !values.stroked;
        el('shape-pt').parentNode.hidden      = !values.stroked;
        el('shape-fill').parentNode.hidden    = !values.filled;
        body.querySelector('[data-na-block="either"]').hidden = !canFill;
        body.querySelector('[data-na-block="note"]').textContent = selected
            ? Na__LeCfg__GetLabel('ShapeSelectedNote', 'Editing the selected shape.')
            : Na__LeCfg__GetLabel('ShapeDefaultsNote', 'Nothing selected: these settings apply to new shapes.');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Fill Colour a Shape Would Take, Selected or Not
    // ------------------------------------------------------------
    function Na__LePanelShapes__FillColour() {
        const selected = Na__LePanelShapes__Selected();
        if (selected && selected.item.Shape__FillColour) return selected.item.Shape__FillColour;
        return Na__LeTools__GetShapeDefaults().fillColour;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Apply a Change to the Selection or the Defaults
    // ------------------------------------------------------------
    function Na__LePanelShapes__Apply(patch, defaultsPatch) {
        const selected = Na__LePanelShapes__Selected();
        if (selected) { Na__LeModel__UpdateShape(selected.sheet, selected.item.Shape__Id, patch); return; }   // <-- The model announces, and the panel refreshes with it
        if (!defaultsPatch) return;
        Na__LeTools__SetShapeDefaults(defaultsPatch);
        Na__LePanels__Refresh(Na__LePanelShapes__ID);                        // <-- Nothing announces a defaults change, so show it here
    }
    // ------------------------------------------------------------


    // FUNCTION | Register the Section and Its Controls
    // ------------------------------------------------------------
    function Na__LePanelShapes__Register() {
        Na__LePanels__OnControl('change', 'shape-stroke', (e, el) => Na__LePanelShapes__Apply({ strokeColour : el.value }, { strokeColour : el.value }));
        Na__LePanels__OnControl('change', 'shape-pt',     (e, el) => { const v = parseFloat(el.value); if (Number.isFinite(v)) Na__LePanelShapes__Apply({ strokePt : v }, { strokePt : v }); });
        Na__LePanels__OnControl('change', 'shape-fill',   (e, el) => Na__LePanelShapes__Apply({ fillColour : el.value }, { fillColour : el.value }));
        Na__LePanels__OnControl('change', 'shape-filled', (e, el) => {
            const colour = Na__LePanelShapes__FillColour();
            if (el.checked) { Na__LePanelShapes__Apply({ fillColour : colour }, { filled : true }); return; }
            Na__LePanelShapes__Apply({ fillColour : null, stroked : true }, { filled : false, stroked : true });   // <-- No fill left, so the edges come back
        });
        Na__LePanels__OnControl('change', 'shape-stroked', (e, el) => {
            if (el.checked) { Na__LePanelShapes__Apply({ stroked : true }, { stroked : true }); return; }
            const colour = Na__LePanelShapes__FillColour();
            Na__LePanelShapes__Apply({ stroked : false, fillColour : colour }, { stroked : false, filled : true, fillColour : colour });   // <-- No edges left, so the fill comes on
        });
        Na__LePanels__OnControl('change', 'shape-closed', (e, el) => Na__LePanelShapes__Apply({ closed : el.checked }, null));
        return Na__LePanels__RegisterSection('right', {
            id : Na__LePanelShapes__ID, title : Na__LeCfg__GetLabel('ShapesTitle', 'Vectors'),
            build : Na__LePanelShapes__Build, refresh : Na__LePanelShapes__Refresh
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Vectors Panel API
    // ------------------------------------------------------------
    export {
        Na__LePanelShapes__Register
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
