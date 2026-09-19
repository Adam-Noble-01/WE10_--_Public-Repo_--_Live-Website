// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PANEL: SHEET
// =============================================================================
//
// FILE       : Na__LayoutEditor__Panel__Sheet__.js
// NAMESPACE  : Na__LePanelSheet
// MODULE     : Layout Editor - Panel Sheet
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Drawing type, sheet name, paper size, orientation, title block style and the title block fields
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - The paper and title block settings of the active sheet, and the eight
//   title block fields (D26). A field left blank falls back to its project
//   default (the placeholder shows what that would be); typing overrides it
//   for this sheet only.
// - NAME IS THE SHORT NAME ON THE TAB ("3D Images"). The drawing's short code
//   ("D03 -") stands in front of the box as fixed text, cut from the Drawing
//   Register's number, so nobody types a number here and a renumber in the
//   register changes the row - and the tab - by itself. Drawing Title, among
//   the title block fields, is the long title the title block prints.
// - Drawing Type is the first row: Architectural Drawing or Site Plan
//   Drawing (Sheet__DrawingType). It moves the sheet's tab - site plans sit
//   last, beside the Project Specification - and never converts or deletes a
//   viewport.
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
// - Divergences   : Console prefix, header and folder numbers; site plan drawings (Sheet__DrawingType), TrueVision first on 14-Sep-2026.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Sep-2026 - Version 1.3.0
// - Short tab names. The Name row shows the drawing's short code ("D03 -") in
//   front of the box as fixed text, read from the Drawing Register's number on
//   every refresh, so only the short name is typed and a renumber changes the
//   row by itself. Its hover carries the whole drawing number.
// - The Drawing Title row is back among the title block fields. It is the
//   long title the title block prints, a different thing from the short name
//   on the tab; left blank it reads as the name. Drawing No. still has no row:
//   the register owns it.
//
// 14-Sep-2026 - Version 1.2.0
// - Drawing Type, the first row: Architectural Drawing or Site Plan Drawing,
//   through UpdateSheet drawingType. One undo step.
//
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
    import { Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel, Na__LeCfg__GetTitleBlockSetup, Na__LeCfg__GetLineweightSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeLayout__ListPaperSizes } from '../07__Core__SheetData/Na__LayoutEditor__SheetLayout__.js';
    import {
        Na__LeModel__GetActiveSheet,
        Na__LeModel__UpdateSheet,
        Na__LeModel__GetFields,
        Na__LeModel__GetDrawingNumber,
        Na__LeModel__GetShortCode,
        Na__LeModel__GetTabLabel,
        Na__LeModel__SetField,
        Na__LeModel__IsCommonFields,
        Na__LeModel__SetCommonFields,
        Na__LeModel__SetCommonFieldValue,
        Na__LeModel__DRAWING_ARCHITECTURAL,
        Na__LeModel__DRAWING_SITEPLAN,
        Na__LeModel__IsSitePlanSheet
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import {
        Na__LePanels__RegisterSection,
        Na__LePanels__OnControl,
        Na__LePanels__Row,
        Na__LePanels__Input,
        Na__LePanels__Select,
        Na__LePanels__Button
    } from './Na__LayoutEditor__PanelHost__.js';
    import { Na__LeCommon__KEYS, Na__LeCommon__Get, Na__LeCommon__RecordOffer } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__Common__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Section
// -----------------------------------------------------------------------------

    // @delegate: ../51__Feature__DrawingRegister/Na__LayoutEditor__Register__Transactions__.js
    import { Na__LeRegEdit__Metadata } from '../51__Feature__DrawingRegister/Na__LayoutEditor__Register__Transactions__.js';

    // MODULE CONSTANTS | Section Id
    // ------------------------------------------------------------
    const Na__LePanelSheet__ID = 'sheet';
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Controls
    // ------------------------------------------------------------
    function Na__LePanelSheet__Build(body) {
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('DrawingType', 'Drawing type'), Na__LePanels__Select('sheet-drawing-type', [
            { value : Na__LeModel__DRAWING_ARCHITECTURAL, label : Na__LeCfg__GetLabel('DrawingTypeArchitectural', 'Architectural Drawing') },
            { value : Na__LeModel__DRAWING_SITEPLAN,      label : Na__LeCfg__GetLabel('DrawingTypeSitePlan', 'Site Plan Drawing') }
        ])));
        // NAME | The register's short code stands in front as fixed text; only the words after it are typed
        const nameField = document.createElement('span');
        nameField.className = 'na-le-namefield';
        const nameCode = document.createElement('span');
        nameCode.className = 'na-le-namefield__code';
        nameCode.setAttribute('data-na-role', 'sheet-name-code');
        nameCode.hidden = true;
        nameField.appendChild(nameCode);
        nameField.appendChild(Na__LePanels__Input('text', 'sheet-name', { placeholder : Na__LeCfg__GetLabel('SheetNamePlaceholder', 'Short tab name, e.g. Floor Plans') }));
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('SheetName', 'Name'), nameField));
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

        // COMMON | The Client and the Site Address belong to the project, not
        // to the sheet, so one switch above them says so. On - the default and
        // the normal state - typing into either box retypes the whole pack.
        // Off, this one sheet keeps its own, which is the rare case and the
        // reason the switch exists at all.
        const commonRow = Na__LePanels__Row(Na__LeCfg__GetLabel('CommonFields', 'Common'), Na__LePanels__Input('checkbox', 'sheet-common'), 'na-le-row--toggle');
        commonRow.title = Na__LeCfg__GetLabel('CommonFieldsTitle', 'Client and Site Address are shared by every drawing in the pack. Untick to give this one sheet its own.');
        body.appendChild(commonRow);

        // THE DRAWING NUMBER HAS NO ROW: it is the Drawing Register's, and it
        // shows in front of the Name above. The Drawing Title has one again -
        // it is the long title the title block prints, a different thing from
        // the short name on the tab, and left blank it reads as the name.
        Na__LeCfg__GetTitleBlockSetup().rows.filter((row) => row.Key !== 'DocumentId').forEach((row) => {
            const input = Na__LePanels__Input('text', 'sheet-field');
            input.setAttribute('data-na-role', row.Key);
            body.appendChild(Na__LePanels__Row(row.Label || row.Key, input));
        });

        // THE PROJECT RECORD'S OFFER | Hidden unless the admin record actually
        // says something different from what the pack is printing. It is an
        // offer and never an overwrite: an issued drawing does not change its
        // own address because a quotation spells the county differently.
        const offer = document.createElement('div');
        offer.className = 'na-le-note na-le-note--offer';
        offer.setAttribute('data-na-role', 'sheet-common-offer');
        offer.hidden = true;
        const offerText = document.createElement('span');
        offerText.setAttribute('data-na-role', 'sheet-common-offer-text');
        offer.appendChild(offerText);
        offer.appendChild(Na__LePanels__Button(Na__LeCfg__GetLabel('CommonUseRecord', 'Use it'), 'sheet-common-adopt'));
        body.appendChild(offer);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect the Active Sheet
    // ------------------------------------------------------------
    function Na__LePanelSheet__Refresh(body) {
        const sheet = Na__LeModel__GetActiveSheet();
        const set = (name, value) => { const el = body.querySelector('[data-na-control="' + name + '"]'); if (el && document.activeElement !== el) el.value = value; };
        if (!sheet) return;
        set('sheet-drawing-type', Na__LeModel__IsSitePlanSheet(sheet) ? Na__LeModel__DRAWING_SITEPLAN : Na__LeModel__DRAWING_ARCHITECTURAL);
        set('sheet-name', sheet.Sheet__Name);
        // THE CODE IN FRONT OF THE NAME | Read on every refresh, and a renumber
        // in the register refreshes the panel, so it follows the register by itself
        const nameCode = body.querySelector('[data-na-role="sheet-name-code"]');
        if (nameCode) {
            nameCode.textContent = Na__LeModel__GetTabLabel(sheet, '');           // <-- The tab's label with no name in it: "D03 -"
            nameCode.hidden      = !Na__LeModel__GetShortCode(sheet);
            nameCode.title       = Na__LeCfg__FormatLabel('SheetNameCodeTitle', 'Drawing {number}. The number comes from the Drawing Register and follows it by itself - type only the short name.', { number : Na__LeModel__GetDrawingNumber(sheet).trim() });
        }
        set('sheet-paper', sheet.Sheet__PaperSize);
        set('sheet-orientation', sheet.Sheet__Orientation);
        set('sheet-titleblock', sheet.Sheet__TitleBlockStyle);
        set('sheet-lw-viewport', sheet.Sheet__Lineweights ? String(sheet.Sheet__Lineweights.ViewportPt) : '');
        set('sheet-lw-dimension', sheet.Sheet__Lineweights ? String(sheet.Sheet__Lineweights.DimensionPt) : '');
        const fields   = Na__LeModel__GetFields(sheet);
        const onCommon = Na__LeModel__IsCommonFields(sheet);
        const common   = Na__LeCommon__Get();
        const commonBox = body.querySelector('[data-na-control="sheet-common"]');
        if (commonBox) commonBox.checked = onCommon;
        body.querySelectorAll('[data-na-control="sheet-field"]').forEach((input) => {
            const key      = input.getAttribute('data-na-role');
            const isShared = onCommon && Na__LeCommon__KEYS.indexOf(key) !== -1;
            // ON COMMON the box holds the PACK's value, because that is what
            // typing into it edits. Off Common it holds this sheet's own, the
            // way every other field in the panel works.
            const stored = isShared ? common[key]
                                    : (sheet.Sheet__Fields ? sheet.Sheet__Fields['Sheet__Fields__' + key] : undefined);
            input.placeholder = fields[key] || '';
            if (document.activeElement !== input) input.value = (typeof stored === 'string') ? stored : '';
        });
        Na__LePanelSheet__ShowOffer(body, onCommon);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show What the Project Admin Record Says, If It Differs
    // ------------------------------------------------------------
    // One line, one button, and nothing at all when the pack already agrees
    // with the record - which is the state a project spends its life in.
    //
    // NOT ON A SHEET THAT HAS LEFT THE PACK. The offer changes the pack's two
    // values, and a loose sheet is showing its own, so taking it would move
    // something the boxes above do not show: press the button, nothing visibly
    // happens. The offer belongs where its effect is visible.
    // ------------------------------------------------------------
    function Na__LePanelSheet__ShowOffer(body, onCommon) {
        const note = body.querySelector('[data-na-role="sheet-common-offer"]');
        const text = body.querySelector('[data-na-role="sheet-common-offer-text"]');
        if (!note || !text) return;
        const offer  = Na__LeCommon__RecordOffer();
        const values = onCommon ? Na__LeCommon__KEYS.map((key) => offer[key]).filter((value) => value !== '') : [];
        note.hidden = (values.length === 0);
        if (values.length) text.textContent = Na__LeCfg__FormatLabel('CommonRecordOffer', 'Project record: {values}', { values : values.join('  ·  ') });
    }
    // ------------------------------------------------------------


    // FUNCTION | Register the Section and Its Controls
    // ------------------------------------------------------------
    function Na__LePanelSheet__Register() {
        [ 'sheet-name', 'sheet-field' ].forEach((control) => Na__LePanels__OnControl('keydown', control, (event, input) => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); input.blur(); } }));
        Na__LePanels__OnControl('change', 'sheet-drawing-type', (e, el) => { const s = Na__LeModel__GetActiveSheet(); if (s) Na__LeModel__UpdateSheet(s, { drawingType : el.value }); });   // <-- Moves the tab; never touches a viewport
        Na__LePanels__OnControl('change', 'sheet-name',        (e, el) => { const s = Na__LeModel__GetActiveSheet(); if (s) void Na__LeRegEdit__Metadata(s.Sheet__Id, 'name', el.value); });
        Na__LePanels__OnControl('change', 'sheet-paper',       (e, el) => { const s = Na__LeModel__GetActiveSheet(); if (s) Na__LeModel__UpdateSheet(s, { paperSize : el.value }); });
        Na__LePanels__OnControl('change', 'sheet-orientation', (e, el) => { const s = Na__LeModel__GetActiveSheet(); if (s) Na__LeModel__UpdateSheet(s, { orientation : el.value }); });
        Na__LePanels__OnControl('change', 'sheet-titleblock',  (e, el) => { const s = Na__LeModel__GetActiveSheet(); if (s) Na__LeModel__UpdateSheet(s, { titleBlockStyle : el.value }); });
        Na__LePanels__OnControl('change', 'sheet-lw-viewport',  (e, el) => { const s = Na__LeModel__GetActiveSheet(); const v = parseFloat(el.value); if (s && Number.isFinite(v)) Na__LeModel__UpdateSheet(s, { lineweights : { viewportPt : v } }); });
        Na__LePanels__OnControl('change', 'sheet-lw-dimension', (e, el) => { const s = Na__LeModel__GetActiveSheet(); const v = parseFloat(el.value); if (s && Number.isFinite(v)) Na__LeModel__UpdateSheet(s, { lineweights : { dimensionPt : v } }); });
        Na__LePanels__OnControl('change', 'sheet-field', (e, el, key) => {
            const s = Na__LeModel__GetActiveSheet();
            if (!s) return;
            if (key === 'Revision') { void Na__LeRegEdit__Metadata(s.Sheet__Id, 'revision', el.value); return; }
            // THE PACK'S TWO FIELDS, when this sheet is on Common: what is
            // typed here is typed onto every drawing in the pack, which is the
            // whole point of the switch above.
            if (Na__LeCommon__KEYS.indexOf(key) !== -1 && Na__LeModel__IsCommonFields(s)) { Na__LeModel__SetCommonFieldValue(s, key, el.value); return; }
            Na__LeModel__SetField(s, key, el.value.trim() === '' ? null : el.value);
        });
        Na__LePanels__OnControl('change', 'sheet-common', (e, el) => { const s = Na__LeModel__GetActiveSheet(); if (s) Na__LeModel__SetCommonFields(s, el.checked); });
        Na__LePanels__OnControl('click',  'sheet-common-adopt', () => {
            const s = Na__LeModel__GetActiveSheet();
            const offer = Na__LeCommon__RecordOffer();
            Na__LeCommon__KEYS.forEach((key) => { if (offer[key]) Na__LeModel__SetCommonFieldValue(s, key, offer[key]); });
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
