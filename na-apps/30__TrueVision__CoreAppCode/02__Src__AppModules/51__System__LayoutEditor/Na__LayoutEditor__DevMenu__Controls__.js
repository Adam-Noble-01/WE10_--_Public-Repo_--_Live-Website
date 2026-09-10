// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - DEV MENU CONTROLS
// =============================================================================
//
// FILE       : Na__LayoutEditor__DevMenu__Controls__.js
// NAMESPACE  : Na__LeDev
// MODULE     : Layout Editor - Dev Menu Controls
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Localhost-only Dev Tools section: sheets, save, bake, export
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - A Dev Tools section beside Floor Plans, Elevations and Projected
//   Linework: the sheet list with Open, New Sheet, Duplicate, Delete (asks
//   first), Save Sheets, Bake Snapshots and Linework (every 3D viewport's
//   picture and every drawing's linework to R2, so the web build renders
//   nothing), Export PDF of the open sheet, and Leave Editor.
//
// INTEGRATION:
// - Initialized from index.html alongside the other localhost-only tools.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__DevMenu__Controls__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.1.0
// - Bake names the drawings that sheet viewports want linework for; readable progress and counts.
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 5.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Mode, Viewports, PDF, Linework Store, Confirm
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel } from './Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__CHANGED_EVENT,
        Na__LeModel__KIND_2D,
        Na__LeModel__KIND_3D,
        Na__LeModel__GetSheets,
        Na__LeModel__GetActiveSheet,
        Na__LeModel__CreateSheet,
        Na__LeModel__DuplicateSheet,
        Na__LeModel__DeleteSheet,
        Na__LeModel__IsDirty,
        Na__LeModel__Save
    } from './Na__LayoutEditor__SheetModel__.js';
    import { Na__LeMode__CHANGED_EVENT, Na__LeMode__Enter, Na__LeMode__Leave, Na__LeMode__IsActive } from './Na__LayoutEditor__ModeController__.js';
    import { Na__LeVp3d__Bake } from './Na__LayoutEditor__Viewport3d__.js';
    import { Na__LePdf__ExportSheet } from './Na__LayoutEditor__PdfExporter__.js';
    import { Na__PlStore__BakeAll } from '../50__System__ProjectedLinework/Na__ProjectedLinework__Persistence__.js';
    import { Na__AppUtils__ConfirmDialog__Show } from '../03__AppUtils/Na__AppUtils__ConfirmDialog.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Element Ids (must match index.html)
    // ------------------------------------------------------------
    const Na__LeDev__ITEM_ID   = 'naLayoutEditorDevItem';
    const Na__LeDev__TOGGLE_ID = 'naLayoutEditorDevToggle';
    const Na__LeDev__PANEL_ID  = 'naLayoutEditorDevPanel';
    // ------------------------------------------------------------

    // MODULE VARIABLES | Panel, Toast and Busy State
    // ------------------------------------------------------------
    let Na__LeDev__Panel     = null;
    let Na__LeDev__ShowToast = null;
    let Na__LeDev__Busy      = false;
    let Na__LeDev__Note      = '';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Button and Toast
    // ------------------------------------------------------------
    function Na__LeDev__Button(text, modifierClass, onClick) {
        const button = document.createElement('button');
        button.type        = 'button';
        button.className   = 'na-pm-dev__btn' + (modifierClass ? ' ' + modifierClass : '');
        button.textContent = text;
        button.disabled    = Na__LeDev__Busy;
        button.addEventListener('click', onClick);
        return button;
    }
    function Na__LeDev__Toast(message, isError) {
        if (typeof Na__LeDev__ShowToast === 'function') Na__LeDev__ShowToast(message, isError === true);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Run a Long Action With the Buttons Disabled
    // ------------------------------------------------------------
    async function Na__LeDev__Run(task) {
        if (Na__LeDev__Busy) return;
        Na__LeDev__Busy = true; Na__LeDev__Render();
        try { await task(); }
        catch (error) { console.error('[TrueVision3D LayoutEditor] Dev action failed:', error); Na__LeDev__Toast(String(error && error.message || error), true); }
        finally { Na__LeDev__Busy = false; Na__LeDev__Render(); }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Actions
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Delete a Sheet After Confirmation
    // ------------------------------------------------------------
    async function Na__LeDev__Delete(sheet) {
        const ok = await Na__AppUtils__ConfirmDialog__Show({
            title : Na__LeCfg__GetLabel('DeleteSheetTitle', 'Delete sheet'),
            message : Na__LeCfg__FormatLabel('DeleteSheetPrompt', 'Delete the sheet "{name}"? Its viewports, text and dimensions go with it.', { name : sheet.Sheet__Name }),
            confirmLabel : Na__LeCfg__GetLabel('DeleteLabel', 'Delete'), isDestructive : true
        });
        if (ok) Na__LeModel__DeleteSheet(sheet.Sheet__Id);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Bake Every 3D Snapshot and Every Drawing's Linework to R2
    // ------------------------------------------------------------
    async function Na__LeDev__Bake() {
        let baked = 0, skipped = 0, failed = 0;
        const sheets = Na__LeModel__GetSheets();
        for (let s = 0; s < sheets.length; s++) {
            const sheet = sheets[s];
            for (let v = 0; v < sheet.Sheet__Viewports.length; v++) {
                const viewport = sheet.Sheet__Viewports[v];
                if (viewport.Viewport__Kind !== Na__LeModel__KIND_3D) continue;
                const result = await Na__LeVp3d__Bake(sheet, viewport, false);
                if (result === 'baked') baked++; else if (result === 'skipped') skipped++; else failed++;
                Na__LeDev__Note = 'Snapshots: ' + baked + ' baked, ' + skipped + ' up to date, ' + failed + ' failed.';
                Na__LeDev__Render();
            }
        }
        // LINEWORK | Only drawings that ask for it: the record toggle, or a sheet viewport with Projected Linework on
        const wanted = [];
        sheets.forEach((sheet) => sheet.Sheet__Viewports.forEach((v) => {
            if (v.Viewport__Kind === Na__LeModel__KIND_2D && v.Viewport__Styles.projectedLinework && v.Viewport__DrawingId) wanted.push(v.Viewport__DrawingId);
        }));
        const linework = await Na__PlStore__BakeAll({
            showToast : Na__LeDev__ShowToast, force : false, includeDrawingIds : wanted,
            onProgress : (p) => { Na__LeDev__Note = 'Linework ' + p.index + ' of ' + p.total + ': ' + p.name; Na__LeDev__Render(); }
        });
        const l = linework || {};
        Na__LeDev__Note = 'Snapshots: ' + baked + ' baked, ' + skipped + ' up to date, ' + failed + ' failed. Linework: ' + (l.baked || 0) + ' baked, ' + (l.skipped || 0) + ' up to date, ' + (l.off || 0) + ' off, ' + (l.refused || 0) + ' refused, ' + (l.failed || 0) + ' failed.';
        if (baked > 0) await Na__LeModel__Save(Na__LeDev__ShowToast);              // <-- Snapshot references live on the records
        Na__LeDev__Toast(Na__LeDev__Note, failed > 0);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Rendering
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Sheet Rows
    // ------------------------------------------------------------
    function Na__LeDev__BuildSheets() {
        const list   = document.createElement('div');
        list.className = 'na-le-dev__sheets';
        const active = Na__LeMode__IsActive() ? Na__LeModel__GetActiveSheet() : null;
        const sheets = Na__LeModel__GetSheets();
        if (sheets.length === 0) {
            const empty = document.createElement('p');
            empty.className   = 'na-fp-dev__empty';
            empty.textContent = Na__LeCfg__GetLabel('NoSheets', 'No sheets yet. Add one from the Dev menu or the + tab.');
            list.appendChild(empty);
            return list;
        }
        sheets.forEach((sheet) => {
            const row = document.createElement('div');
            row.className = 'na-pm-dev__row na-le-dev__sheet' + (active && active.Sheet__Id === sheet.Sheet__Id ? ' na-le-dev__sheet--active' : '');
            const name = document.createElement('span');
            name.className   = 'na-pm-dev__label na-le-dev__sheet-name';
            name.textContent = sheet.Sheet__Order + '. ' + sheet.Sheet__Name + ' (' + sheet.Sheet__PaperSize + ', ' + sheet.Sheet__Viewports.length + ' viewports)';
            row.appendChild(name);
            row.appendChild(Na__LeDev__Button(Na__LeCfg__GetLabel('OpenSheet', 'Open'), 'na-pm-dev__btn--primary', () => Na__LeMode__Enter(sheet.Sheet__Id)));
            row.appendChild(Na__LeDev__Button(Na__LeCfg__GetLabel('DuplicateSheet', 'Duplicate'), '', () => { const copy = Na__LeModel__DuplicateSheet(sheet.Sheet__Id); if (copy) Na__LeMode__Enter(copy.Sheet__Id); }));
            row.appendChild(Na__LeDev__Button(Na__LeCfg__GetLabel('DeleteLabel', 'Delete'), 'na-pm-dev__btn--danger', () => { void Na__LeDev__Delete(sheet); }));
            list.appendChild(row);
        });
        return list;
    }
    // ------------------------------------------------------------


    // FUNCTION | Rebuild the Section
    // ------------------------------------------------------------
    function Na__LeDev__Render() {
        if (!Na__LeDev__Panel) return;
        Na__LeDev__Panel.innerHTML = '';

        const title = document.createElement('div');
        title.className   = 'na-dropdown-menu__panel-title';
        title.textContent = Na__LeCfg__GetLabel('DevSectionTitle', 'Layout Editor') + (Na__LeModel__IsDirty() ? ' (unsaved changes)' : '');
        Na__LeDev__Panel.appendChild(title);
        Na__LeDev__Panel.appendChild(Na__LeDev__BuildSheets());

        const actions = document.createElement('div');
        actions.className = 'na-pm-dev__actions';
        actions.appendChild(Na__LeDev__Button(Na__LeCfg__GetLabel('NewSheet', 'New Sheet'), 'na-pm-dev__btn--primary', () => { const sheet = Na__LeModel__CreateSheet({}); if (sheet) Na__LeMode__Enter(sheet.Sheet__Id); }));
        actions.appendChild(Na__LeDev__Button(Na__LeCfg__GetLabel('SaveSheets', 'Save Sheets'), '', () => { void Na__LeDev__Run(() => Na__LeModel__Save(Na__LeDev__ShowToast)); }));
        actions.appendChild(Na__LeDev__Button(Na__LeCfg__GetLabel('BakeAll', 'Bake Snapshots and Linework'), '', () => { void Na__LeDev__Run(Na__LeDev__Bake); }));
        const active = Na__LeMode__IsActive() ? Na__LeModel__GetActiveSheet() : null;
        if (active) {
            actions.appendChild(Na__LeDev__Button(Na__LeCfg__GetLabel('ExportPdf', 'Export PDF'), '', () => { void Na__LeDev__Run(() => Na__LePdf__ExportSheet(active, Na__LeDev__ShowToast)); }));
            actions.appendChild(Na__LeDev__Button(Na__LeCfg__GetLabel('LeaveEditor', 'Leave Editor'), '', () => Na__LeMode__Leave()));
        }
        Na__LeDev__Panel.appendChild(actions);

        if (Na__LeDev__Note) {
            const note = document.createElement('p');
            note.className   = 'na-fp-dev__empty';
            note.textContent = Na__LeDev__Note;
            Na__LeDev__Panel.appendChild(note);
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Reveal the Section and Wire Its Toggle
    // ------------------------------------------------------------
    function Na__LayoutEditor__DevMenu__Initialize(context) {
        const menuItem = document.getElementById(Na__LeDev__ITEM_ID);
        const toggle   = document.getElementById(Na__LeDev__TOGGLE_ID);
        const panel    = document.getElementById(Na__LeDev__PANEL_ID);
        if (!menuItem || !toggle || !panel) return false;
        Na__LeDev__Panel     = panel;
        Na__LeDev__ShowToast = (context && context.showToast) || null;
        menuItem.style.display = '';
        toggle.addEventListener('click', () => {
            const isOpen = panel.classList.contains('is-open');
            panel.classList.toggle('is-open', !isOpen);
            toggle.setAttribute('aria-expanded', String(!isOpen));
            if (!isOpen) Na__LeDev__Render();
        });
        const refresh = () => { if (panel.classList.contains('is-open')) Na__LeDev__Render(); };
        window.addEventListener(Na__LeModel__CHANGED_EVENT, refresh);
        window.addEventListener(Na__LeMode__CHANGED_EVENT, refresh);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Dev Menu API
    // ------------------------------------------------------------
    export {
        Na__LayoutEditor__DevMenu__Initialize
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
