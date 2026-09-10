// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PANEL: TEXT
// =============================================================================
//
// FILE       : Na__LayoutEditor__Panel__Text__.js
// NAMESPACE  : Na__LePanelText
// MODULE     : Layout Editor - Panel Text
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Size, weight, colour, alignment and leader for the selected text item, or for new text
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - With a text item selected the controls edit it; with nothing selected
//   they set what the Text tool places next (D32). Sizes are paper
//   millimetres. The leader toggle adds a leader tip a little below and to
//   the left of the text, ready to drag.
//
// INTEGRATION:
// - Registered into the right column by the mode controller.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__Panel__Text__.js
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

    // MODULE IMPORTS | Config, Model, Tools and Panel Host
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel, Na__LeCfg__GetTextSetup } from './Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__GetActiveSheet, Na__LeModel__GetSelection, Na__LeModel__UpdateAnnotation } from './Na__LayoutEditor__SheetModel__.js';
    import { Na__LeTools__GetTextDefaults, Na__LeTools__SetTextDefaults, Na__LeTools__BeginTextEdit } from './Na__LayoutEditor__SheetTools__.js';
    import {
        Na__LePanels__RegisterSection,
        Na__LePanels__OnControl,
        Na__LePanels__IsEditable,
        Na__LePanels__Row,
        Na__LePanels__Input,
        Na__LePanels__Select,
        Na__LePanels__Button,
        Na__LePanels__Note
    } from './Na__LayoutEditor__PanelHost__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Section
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Section Id
    // ------------------------------------------------------------
    const Na__LePanelText__ID = 'text';
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Selected Text Item, if Any
    // ------------------------------------------------------------
    function Na__LePanelText__Selected() {
        const sheet = Na__LeModel__GetActiveSheet();
        const selection = Na__LeModel__GetSelection();
        if (!sheet || !selection || selection.kind !== 'annotation') return null;
        const item = sheet.Sheet__Annotations.find((a) => a.Annotation__Id === selection.id) || null;
        return item ? { sheet : sheet, item : item } : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Controls
    // ------------------------------------------------------------
    function Na__LePanelText__Build(body) {
        const setup = Na__LeCfg__GetTextSetup();
        const note = Na__LePanels__Note('');
        note.setAttribute('data-na-block', 'note');
        body.appendChild(note);
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('TextSize', 'Size mm'), Na__LePanels__Input('number', 'text-size', { min : setup.minSizeMm, max : setup.maxSizeMm, step : setup.sizeStepMm })));
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('TextWeight', 'Weight'), Na__LePanels__Select('text-weight', setup.allowedWeights.map((w) => ({ value : w, label : w === 300 ? 'Light' : (w >= 600 ? 'Semi-bold' : 'Regular') })))));
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('TextColour', 'Colour'), Na__LePanels__Input('color', 'text-colour')));
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('TextAlign', 'Align'), Na__LePanels__Select('text-align', [ { value : 'left', label : 'Left' }, { value : 'center', label : 'Centre' }, { value : 'right', label : 'Right' } ])));
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('TextLeader', 'Leader'), Na__LePanels__Input('checkbox', 'text-leader')));
        if (Na__LePanels__IsEditable()) {
            const bar = document.createElement('div');
            bar.className = 'na-le-bar';
            bar.setAttribute('data-na-block', 'edit');
            bar.appendChild(Na__LePanels__Button(Na__LeCfg__GetLabel('EditText', 'Edit text'), 'text-edit', ''));
            body.appendChild(bar);
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect the Selection or the Defaults
    // ------------------------------------------------------------
    function Na__LePanelText__Refresh(body) {
        const selected = Na__LePanelText__Selected();
        const defaults = Na__LeTools__GetTextDefaults();
        const values = selected
            ? { sizeMm : selected.item.Annotation__SizeMm, fontWeight : selected.item.Annotation__FontWeight, colour : selected.item.Annotation__Colour, align : selected.item.Annotation__Align, leader : Number.isFinite(selected.item.Annotation__LeaderXMm) }
            : defaults;
        const set = (name, value) => { const el = body.querySelector('[data-na-control="' + name + '"]'); if (el && document.activeElement !== el) el.value = String(value); };
        set('text-size', values.sizeMm);
        set('text-weight', values.fontWeight);
        set('text-colour', /^#[0-9a-fA-F]{6}$/.test(values.colour) ? values.colour : '#172b3a');
        set('text-align', values.align);
        const leader = body.querySelector('[data-na-control="text-leader"]');
        if (leader) leader.checked = values.leader === true;
        body.querySelector('[data-na-block="note"]').textContent = selected
            ? Na__LeCfg__GetLabel('TextSelectedNote', 'Editing the selected text.')
            : Na__LeCfg__GetLabel('TextDefaultsNote', 'Nothing selected: these settings apply to new text.');
        const edit = body.querySelector('[data-na-block="edit"]');
        if (edit) edit.hidden = !selected;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Apply a Change to the Selection or the Defaults
    // ------------------------------------------------------------
    function Na__LePanelText__Apply(patchForItem, patchForDefaults) {
        const selected = Na__LePanelText__Selected();
        if (selected) Na__LeModel__UpdateAnnotation(selected.sheet, selected.item.Annotation__Id, patchForItem);
        else Na__LeTools__SetTextDefaults(patchForDefaults);
    }
    // ------------------------------------------------------------


    // FUNCTION | Register the Section and Its Controls
    // ------------------------------------------------------------
    function Na__LePanelText__Register() {
        Na__LePanels__OnControl('change', 'text-size',   (e, el) => { const v = parseFloat(el.value); if (Number.isFinite(v)) Na__LePanelText__Apply({ sizeMm : v }, { sizeMm : v }); });
        Na__LePanels__OnControl('change', 'text-weight', (e, el) => { const v = parseInt(el.value, 10); if (Number.isFinite(v)) Na__LePanelText__Apply({ fontWeight : v }, { fontWeight : v }); });
        Na__LePanels__OnControl('change', 'text-colour', (e, el) => Na__LePanelText__Apply({ colour : el.value }, { colour : el.value }));
        Na__LePanels__OnControl('change', 'text-align',  (e, el) => Na__LePanelText__Apply({ align : el.value }, { align : el.value }));
        Na__LePanels__OnControl('change', 'text-leader', (e, el) => {
            const selected = Na__LePanelText__Selected();
            if (!selected) { Na__LeTools__SetTextDefaults({ leader : el.checked }); return; }
            const item = selected.item;
            Na__LeModel__UpdateAnnotation(selected.sheet, item.Annotation__Id, el.checked
                ? { leaderXMm : item.Annotation__PosXMm - 15, leaderYMm : item.Annotation__PosYMm + 10 }
                : { leaderXMm : null, leaderYMm : null });
        });
        Na__LePanels__OnControl('click', 'text-edit', () => { const s = Na__LePanelText__Selected(); if (s) Na__LeTools__BeginTextEdit(s.item.Annotation__Id); });
        return Na__LePanels__RegisterSection('right', {
            id : Na__LePanelText__ID, title : Na__LeCfg__GetLabel('TextTitle', 'Text'),
            build : Na__LePanelText__Build, refresh : Na__LePanelText__Refresh
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Text Panel API
    // ------------------------------------------------------------
    export {
        Na__LePanelText__Register
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
