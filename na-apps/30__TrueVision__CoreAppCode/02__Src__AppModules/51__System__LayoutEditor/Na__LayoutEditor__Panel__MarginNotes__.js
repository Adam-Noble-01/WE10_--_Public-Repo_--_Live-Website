// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PANEL: MARGIN NOTES
// =============================================================================
//
// FILE       : Na__LayoutEditor__Panel__MarginNotes__.js
// NAMESPACE  : Na__LePanelMargin
// MODULE     : Layout Editor - Panel Margin Notes
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Switch the active sheet's notes margin on or off, set its width, heading, text size and what it lists, and say what it holds
// CREATED    : 14-Sep-2026
//
// DESCRIPTION:
// - The margin down the right of the sheet that lists the project
//   specification notes its bubbles link to, with the general notes last
//   (Na__LayoutEditor__SpecMargin__). Every setting is the sheet's own.
// - A line under the switch says what the margin lists - how many notes, how
//   many linked on this sheet and how many general - and warns when some do
//   not fit, or when the specification is still loading or could not be read.
// - Open Project Specification shows the tab where the notes are written.
//
// INTEGRATION:
// - Registered in the left column by the mode controller, after Sheet.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (14-Sep-2026)
// - ValeVision    : not yet ported. Nothing here is app-specific.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 14-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Records, Specification, the Margin and the Panel Host
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel, Na__LeCfg__GetMarginNotesSetup } from './Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__GetActiveSheet, Na__LeModel__UpdateMarginNotes } from './Na__LayoutEditor__SheetModel__.js';
    import { Na__LeRec__MarginNotes } from './Na__LayoutEditor__SheetRecords__.js';
    import { Na__LeSpec__OPEN_EVENT, Na__LeSpec__STATUS_FAILED, Na__LeSpec__GetState } from './Na__LayoutEditor__SpecData__.js';
    import { Na__LeMargin__Report } from './Na__LayoutEditor__SpecMargin__.js';
    import {
        Na__LePanels__RegisterSection,
        Na__LePanels__OnControl,
        Na__LePanels__IsEditable,
        Na__LePanels__Row,
        Na__LePanels__Input,
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
    const Na__LePanelMargin__ID = 'margin';
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Controls
    // ------------------------------------------------------------
    function Na__LePanelMargin__Build(body) {
        const L     = Na__LeCfg__GetLabel;
        const setup = Na__LeCfg__GetMarginNotesSetup();

        const show = Na__LePanels__Row(L('MarginShow', 'Show notes margin'), Na__LePanels__Input('checkbox', 'margin-enabled'), 'na-le-row--toggle');
        show.title = L('MarginShowTitle', 'A column down the right of this sheet listing the specification notes its bubbles link to, with the general notes last. Drag its left edge to resize it.');
        body.appendChild(show);

        const status = Na__LePanels__Note('');
        status.setAttribute('data-na-block', 'status');
        body.appendChild(status);

        const rows = document.createElement('div');
        rows.className = 'na-le-block';
        rows.setAttribute('data-na-block', 'settings');
        rows.appendChild(Na__LePanels__Row(L('MarginWidth', 'Width mm'), Na__LePanels__Input('number', 'margin-width', { min : setup.minWidthMm, max : 600, step : 1 })));
        const heading = Na__LePanels__Input('text', 'margin-heading');
        heading.placeholder = setup.headingText;
        rows.appendChild(Na__LePanels__Row(L('MarginHeading', 'Heading'), heading));
        rows.appendChild(Na__LePanels__Row(L('MarginTextSize', 'Text mm'), Na__LePanels__Input('number', 'margin-text-size', { min : setup.minTextSizeMm, max : setup.maxTextSizeMm, step : 0.1 })));
        const general = Na__LePanels__Row(L('MarginGeneral', 'List general notes'), Na__LePanels__Input('checkbox', 'margin-general'), 'na-le-row--toggle');
        general.title = L('MarginGeneralTitle', 'The notes in general groups, listed after the notes this sheet links to. A general note a bubble links to is listed either way.');
        rows.appendChild(general);
        rows.appendChild(Na__LePanels__Row(L('MarginGroupHeadings', 'Group headings'), Na__LePanels__Input('checkbox', 'margin-groups'), 'na-le-row--toggle'));
        body.appendChild(rows);

        const bar = document.createElement('div');
        bar.className = 'na-le-bar';
        bar.appendChild(Na__LePanels__Button(L('MarginOpenSpec', 'Open Project Specification'), 'margin-open-spec', ''));
        body.appendChild(bar);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Line That Says What the Margin Holds (and whether it is a warning)
    // ------------------------------------------------------------
    function Na__LePanelMargin__Status(sheet, report) {
        const L     = Na__LeCfg__GetLabel;
        const state = Na__LeSpec__GetState();
        if (!report.on) return { text : L('MarginOffNote', 'Off. Switch it on to list the specification notes this sheet’s bubbles link to, with the general notes last.'), warn : false };
        if (state.status === Na__LeSpec__STATUS_FAILED && !state.loaded) return { text : L('MarginSpecFailed', 'The project specification could not be read, so there is nothing to list yet.'), warn : true };
        if (report.pending) return { text : L('MarginSpecLoading', 'Loading the project specification...'), warn : false };
        if (report.total === 0) return { text : L('MarginEmpty', 'Nothing to list yet: link a specification bubble to a note, or add general notes in Project Specification.'), warn : false };
        let text = Na__LeCfg__FormatLabel('MarginStatus', 'Lists {total}: {linked} linked on this sheet, {general} general.', { total : report.total, linked : report.linked, general : report.general });
        if (report.overflow > 0) text += ' ' + Na__LeCfg__FormatLabel('MarginOverflowNote', '{count} do not fit: widen the margin or make the text smaller.', { count : report.overflow });
        if (state.status === Na__LeSpec__STATUS_FAILED) text += ' ' + L('MarginSpecOffline', 'The cloud copy could not be read: this is the copy in this browser.');
        return { text : text, warn : report.overflow > 0 || state.status === Na__LeSpec__STATUS_FAILED };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect the Active Sheet
    // ------------------------------------------------------------
    function Na__LePanelMargin__Refresh(body) {
        const sheet = Na__LeModel__GetActiveSheet();
        if (!sheet) return;
        const settings = Na__LeRec__MarginNotes(sheet);
        const report   = Na__LeMargin__Report(sheet, null);
        const el  = (name) => body.querySelector('[data-na-control="' + name + '"]');
        const set = (name, value) => { const e = el(name); if (e && document.activeElement !== e) e.value = String(value); };
        el('margin-enabled').checked = settings.Enabled === true;
        set('margin-width', report.rect ? Math.round(report.rect.WidthMm * 10) / 10 : settings.WidthMm);   // <-- The width as drawn, after the paper's limits
        set('margin-heading', settings.Heading || '');
        set('margin-text-size', settings.TextSizeMm);
        el('margin-general').checked = settings.IncludeGeneral === true;
        el('margin-groups').checked  = settings.GroupHeadings === true;
        body.querySelector('[data-na-block="settings"]').hidden = settings.Enabled !== true;
        const status = Na__LePanelMargin__Status(sheet, report);
        const note   = body.querySelector('[data-na-block="status"]');
        note.textContent = status.text;
        note.classList.toggle('na-le-note--warn', status.warn);
    }
    // ------------------------------------------------------------


    // FUNCTION | Register the Section and Its Controls
    // ------------------------------------------------------------
    function Na__LePanelMargin__Register() {
        const on    = Na__LePanels__OnControl;
        const apply = (patch) => { const sheet = Na__LeModel__GetActiveSheet(); if (sheet && Na__LePanels__IsEditable()) Na__LeModel__UpdateMarginNotes(sheet, patch); };
        const num   = (key) => (e, el) => { const value = parseFloat(el.value); if (Number.isFinite(value)) { const patch = {}; patch[key] = value; apply(patch); } };
        on('change', 'margin-enabled',   (e, el) => apply({ enabled : el.checked }));
        on('change', 'margin-width',     num('widthMm'));
        on('change', 'margin-heading',   (e, el) => apply({ heading : el.value }));
        on('change', 'margin-text-size', num('textSizeMm'));
        on('change', 'margin-general',   (e, el) => apply({ includeGeneral : el.checked }));
        on('change', 'margin-groups',    (e, el) => apply({ groupHeadings : el.checked }));
        on('click',  'margin-open-spec', () => window.dispatchEvent(new CustomEvent(Na__LeSpec__OPEN_EVENT, { detail : {} })));
        return Na__LePanels__RegisterSection('left', {
            id : Na__LePanelMargin__ID, title : Na__LeCfg__GetLabel('MarginNotesTitle', 'Margin Notes'),
            build : Na__LePanelMargin__Build, refresh : Na__LePanelMargin__Refresh
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Margin Notes Panel API
    // ------------------------------------------------------------
    export {
        Na__LePanelMargin__Register
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
