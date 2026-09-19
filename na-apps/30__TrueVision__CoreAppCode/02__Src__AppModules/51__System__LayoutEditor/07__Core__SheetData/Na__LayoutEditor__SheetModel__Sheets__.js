// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET MODEL - SHEETS
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetModel__Sheets__.js
// NAMESPACE  : Na__LeModel
// MODULE     : Layout Editor - Sheet Model - Sheets
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Find, switch, create, copy, delete, edit and reorder sheets, with their title block fields and notes margin
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - Every sheet normalised and in tab order, one sheet by id, the active
//   sheet and the switch between sheets.
// - Create, duplicate, delete, update and reorder a sheet; the title block
//   fields with their project defaults, one field set, and the notes margin.
// - TrueVision only: site plan drawings. IsSitePlanSheet reads a sheet's
//   drawing type, and the helpers TabGroup, NextOrder and RenumberSheets keep
//   architectural sheets and site plan sheets in their own tab groups,
//   numbered 1..n down the tab order.
// - The lines that set the active sheet, the selection or the dirty flag
//   call the State unit's Assign accessors (an imported let cannot be
//   assigned).
//
// INTEGRATION:
// - Reads and writes the session state through
//   Na__LayoutEditor__SheetModel__State__.
// - Na__LayoutEditor__SheetModel__ calls GetSheets, GetSheetById and
//   GetActiveSheet (the selected viewport, the draft restore and the reload)
//   and re-exports this unit's API. Every other module imports
//   Na__LayoutEditor__SheetModel__.js, never this unit.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the ValeVision3D v2.47.0 split of the same module (same unit, same functions)
// - Parity        : verbatim (moved code)
// - Divergences   : header; site plan drawings, TrueVision first: IsSitePlanSheet, TabGroup, NextOrder and RenumberSheets are TrueVision only, and GetSheets, CreateSheet, DuplicateSheet, DeleteSheet, UpdateSheet and ReorderSheet keep the two tab groups.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__SheetModel__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // @delegate: ../51__Feature__DrawingRegister/Na__LayoutEditor__Register__Numbering__.js
    import { Na__LeRegNum__Plan, Na__LeRegNum__Apply } from '../51__Feature__DrawingRegister/Na__LayoutEditor__Register__Numbering__.js';
    import { Na__LeCfg__GetDrawingRegisterSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__CfApi__GetLoadedProjectData } from '../../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js';

    // MODULE IMPORTS | Record Helpers and Drawing Types
    // ------------------------------------------------------------
    import {
        Na__LeRec__DRAWING_ARCHITECTURAL,
        Na__LeRec__DRAWING_SITEPLAN,
        Na__LeRec__IsSitePlanSheet,
        Na__LeRec__NextId,
        Na__LeRec__Find,
        Na__LeRec__NormaliseSheet,
        Na__LeRec__BuildFields,
        Na__LeRec__NormaliseMarginNotes
    } from './Na__LayoutEditor__SheetRecords__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Sheet Model State
    // ------------------------------------------------------------
    import {
        Na__LeModel__ActiveSheetId,
        Na__LeModel__Dispatch,
        Na__LeModel__Touch,
        Na__LeModel__Array,
        Na__LeModel__AssignActiveSheetId,
        Na__LeModel__AssignSelectionItems,
        Na__LeModel__AssignDirty
    } from './Na__LayoutEditor__SheetModel__State__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Sheets
// -----------------------------------------------------------------------------

    // FUNCTION | Every Sheet, Normalised and in Tab Order
    // ------------------------------------------------------------
    // Architectural sheets first, then site plan sheets, each group by
    // Sheet__Order. The one sort point: the tab strip, the editor's first
    // sheet and the Dev menu all read this list.
    // ------------------------------------------------------------
    function Na__LeModel__GetSheets() {
        const list = Na__LeModel__Array().filter((s) => s && typeof s === 'object' && typeof s.Sheet__Id === 'string');
        list.forEach(Na__LeRec__NormaliseSheet);
        return list.sort((a, b) => a.Sheet__Order - b.Sheet__Order);
    }
    // ------------------------------------------------------------


    // FUNCTION | Is This a Site Plan Sheet
    // ------------------------------------------------------------
    function Na__LeModel__IsSitePlanSheet(sheet) {
        return Na__LeRec__IsSitePlanSheet(sheet);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Sheet's Tab Group: 0 Architectural, 1 Site Plan
    // ------------------------------------------------------------
    function Na__LeModel__TabGroup(sheet) {
        return Na__LeRec__IsSitePlanSheet(sheet) ? 1 : 0;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Sheet__Order Past Every Sheet's, So a New Sheet Ends Its Tab Group
    // ------------------------------------------------------------
    function Na__LeModel__NextOrder(list) {
        return list.reduce((top, s) => Math.max(top, (s && Number.isFinite(s.Sheet__Order)) ? s.Sheet__Order : 0), 0) + 1;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Number Sheet__Order 1..n Down the Tab Order
    // ------------------------------------------------------------
    // Kept contiguous so a change of drawing type needs no renumber: every
    // architectural number is below every site plan number, so a sheet that
    // changes type lands beside the + tab with the number it had.
    // ------------------------------------------------------------
    function Na__LeModel__RenumberSheets() {
        const sheets = Na__LeModel__GetSheets();
        const cfg = Na__LeCfg__GetDrawingRegisterSetup();
        const data = Na__CfApi__GetLoadedProjectData() || {};
        const block = data.LayoutEditor__DrawingRegister || {};
        const numbering = block.DrawingRegister__Numbering || {
            DrawingRegister__Numbering__Prefix : cfg.prefix,
            DrawingRegister__Numbering__Start : cfg.start,
            DrawingRegister__Numbering__Digits : cfg.digits,
            DrawingRegister__Numbering__Overrides : {}
        };
        Na__LeRegNum__Apply(sheets, Na__LeRegNum__Plan(sheets, numbering));
    }
    // ------------------------------------------------------------


    // FUNCTION | One Sheet by Id (null when absent)
    // ------------------------------------------------------------
    function Na__LeModel__GetSheetById(sheetId) {
        return Na__LeRec__Find(Na__LeModel__GetSheets(), 'Sheet__Id', sheetId);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Sheet on Screen (null when in the 3D model tab)
    // ------------------------------------------------------------
    function Na__LeModel__GetActiveSheet() {
        return Na__LeModel__ActiveSheetId ? Na__LeModel__GetSheetById(Na__LeModel__ActiveSheetId) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Switch the Active Sheet (null = 3D model)
    // ------------------------------------------------------------
    function Na__LeModel__SetActiveSheetId(sheetId) {
        const next = (sheetId && Na__LeModel__GetSheetById(sheetId)) ? sheetId : null;
        if (next === Na__LeModel__ActiveSheetId) return next;
        Na__LeModel__AssignActiveSheetId(next);
        Na__LeModel__AssignSelectionItems([]);
        Na__LeModel__Dispatch('active', next);
        return next;
    }
    // ------------------------------------------------------------


    // FUNCTION | Create a Sheet
    // ------------------------------------------------------------
    function Na__LeModel__CreateSheet(options) {
        const opts  = options || {};
        const list  = Na__LeModel__Array();
        const sheet = {
            Sheet__Id              : Na__LeRec__NextId(list, 'Sheet_', 'Sheet__Id'),
            Sheet__Name            : (typeof opts.name === 'string' && opts.name.trim()) ? opts.name.trim() : '',
            Sheet__Order           : Na__LeModel__NextOrder(list),
            Sheet__PaperSize       : opts.paperSize || null,
            Sheet__Orientation     : opts.orientation || null,
            Sheet__TitleBlockStyle : opts.titleBlockStyle || null,
            Sheet__Fields          : {},
            Sheet__Layers          : [],
            Sheet__Viewports       : [],
            Sheet__Annotations     : [],
            Sheet__Dimensions      : [],
            Sheet__Shapes          : [],
            Sheet__Leaders         : [],
            Sheet__Groups          : []
        };
        if (opts.drawingType === Na__LeRec__DRAWING_SITEPLAN) sheet.Sheet__DrawingType = Na__LeRec__DRAWING_SITEPLAN;
        list.push(sheet);
        Na__LeRec__NormaliseSheet(sheet, list.length - 1);
        Na__LeModel__RenumberSheets();                                          // <-- The new sheet ends its tab group
        Na__LeModel__Touch('sheet-created', sheet.Sheet__Id);
        return sheet;
    }
    // ------------------------------------------------------------


    // FUNCTION | Duplicate a Sheet (deep copy, fresh id, assets dropped)
    // ------------------------------------------------------------
    function Na__LeModel__DuplicateSheet(sheetId) {
        const source = Na__LeModel__GetSheetById(sheetId);
        if (!source) return null;
        const list = Na__LeModel__Array();
        const copy = JSON.parse(JSON.stringify(source));
        copy.Sheet__Id    = Na__LeRec__NextId(list, 'Sheet_', 'Sheet__Id');
        copy.Sheet__Name  = source.Sheet__Name + ' copy';
        copy.Sheet__Order = Na__LeModel__NextOrder(list);
        copy.Sheet__Fields.Sheet__Fields__Title = copy.Sheet__Name;
        copy.Sheet__Viewports.forEach((v) => { v.Viewport__SnapshotAsset = null; });   // <-- Snapshots are keyed by viewport id
        list.push(copy);
        Na__LeModel__RenumberSheets();
        Na__LeModel__Touch('sheet-created', copy.Sheet__Id);
        return copy;
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete a Sheet
    // ------------------------------------------------------------
    function Na__LeModel__DeleteSheet(sheetId) {
        const list = Na__LeModel__Array();
        for (let i = 0; i < list.length; i++) {
            if (list[i] && list[i].Sheet__Id === sheetId) {
                list.splice(i, 1);
                Na__LeModel__RenumberSheets();                                  // <-- Down the tab order; by array position it put back every drag since the load
                if (Na__LeModel__ActiveSheetId === sheetId) { Na__LeModel__AssignActiveSheetId(null); Na__LeModel__AssignSelectionItems([]); }
                Na__LeModel__Touch('sheet-deleted', sheetId);
                return true;
            }
        }
        return false;
    }
    // ------------------------------------------------------------


    // FUNCTION | Rename, Re-Paper, Restyle or Reorder a Sheet
    // ------------------------------------------------------------
    function Na__LeModel__UpdateSheet(sheet, patch) {
        if (!sheet || !patch) return false;
        if (typeof patch.name === 'string' && patch.name.trim()) { sheet.Sheet__Name = patch.name.trim(); sheet.Sheet__Fields = sheet.Sheet__Fields || {}; sheet.Sheet__Fields.Sheet__Fields__Title = sheet.Sheet__Name; }
        if (typeof patch.paperSize === 'string') sheet.Sheet__PaperSize = patch.paperSize;
        if (typeof patch.orientation === 'string') sheet.Sheet__Orientation = patch.orientation;
        if (typeof patch.titleBlockStyle === 'string') sheet.Sheet__TitleBlockStyle = patch.titleBlockStyle;
        if (patch.drawingType === Na__LeRec__DRAWING_SITEPLAN) sheet.Sheet__DrawingType = Na__LeRec__DRAWING_SITEPLAN;   // <-- The tab moves across +; Sheet__Order stays
        else if (patch.drawingType === Na__LeRec__DRAWING_ARCHITECTURAL) delete sheet.Sheet__DrawingType;
        if (patch.lineweights && typeof patch.lineweights === 'object') {
            const lw = sheet.Sheet__Lineweights || (sheet.Sheet__Lineweights = {});
            if (Number.isFinite(patch.lineweights.viewportPt))  lw.ViewportPt  = patch.lineweights.viewportPt;
            if (Number.isFinite(patch.lineweights.dimensionPt)) lw.DimensionPt = patch.lineweights.dimensionPt;
        }
        Na__LeRec__NormaliseSheet(sheet, sheet.Sheet__Order - 1);
        Na__LeModel__Touch('sheet-updated', sheet.Sheet__Id);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Move a Sheet to a New Position in the Tab Order
    // ------------------------------------------------------------
    function Na__LeModel__ReorderSheet(sheetId, newIndex) {
        const list = Na__LeModel__GetSheets();
        const from = list.findIndex((s) => s.Sheet__Id === sheetId);
        if (from === -1) return false;
        const [ moved ] = list.splice(from, 1);
        list.splice(Math.max(0, Math.min(newIndex, list.length)), 0, moved);
        list.forEach((s, k) => { s.Sheet__Order = k + 1; });
        Na__LeModel__RenumberSheets();
        Na__LeModel__Touch('sheet-reordered', sheetId);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Title Block Fields With Project Defaults Filled In
    // ------------------------------------------------------------
    function Na__LeModel__GetFields(sheet) {
        return Na__LeRec__BuildFields(sheet);
    }
    // ------------------------------------------------------------


    // FUNCTION | Switch, Widen or Restyle a Sheet's Notes Margin
    // ------------------------------------------------------------
    // patch: { enabled, widthMm, heading (null or empty for the configured
    // one), textSizeMm, includeGeneral, groupHeadings }. The first change
    // creates Sheet__MarginNotes. Announced as 'margin': a content edit, kept
    // by the browser draft and Save Sheets, one undo step, never an auto save.
    // silent: true skips the announcement (the edge grip while it is dragged).
    // ------------------------------------------------------------
    function Na__LeModel__UpdateMarginNotes(sheet, patch, silent) {
        if (!sheet || !patch) return false;
        const notes = (sheet.Sheet__MarginNotes && typeof sheet.Sheet__MarginNotes === 'object') ? sheet.Sheet__MarginNotes : (sheet.Sheet__MarginNotes = {});
        if (typeof patch.enabled === 'boolean') notes.Enabled = patch.enabled;
        if (Number.isFinite(patch.widthMm)) notes.WidthMm = patch.widthMm;
        if (patch.heading !== undefined) notes.Heading = (typeof patch.heading === 'string' && patch.heading.trim()) ? patch.heading : null;
        if (Number.isFinite(patch.textSizeMm)) notes.TextSizeMm = patch.textSizeMm;
        if (typeof patch.includeGeneral === 'boolean') notes.IncludeGeneral = patch.includeGeneral;
        if (typeof patch.groupHeadings === 'boolean') notes.GroupHeadings = patch.groupHeadings;
        Na__LeRec__NormaliseMarginNotes(sheet);
        if (silent) { Na__LeModel__AssignDirty(true); return true; }
        Na__LeModel__Touch('margin', sheet.Sheet__Id);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Set One Title Block Field on a Sheet (null restores the default)
    // ------------------------------------------------------------
    function Na__LeModel__SetField(sheet, key, value) {
        if (!sheet) return false;
        if (!sheet.Sheet__Fields) sheet.Sheet__Fields = {};
        if (value === null || value === undefined) delete sheet.Sheet__Fields['Sheet__Fields__' + key];
        else sheet.Sheet__Fields['Sheet__Fields__' + key] = String(value);
        if (key === 'Title' && typeof value === 'string' && value.trim()) sheet.Sheet__Name = value.trim();
        Na__LeModel__Touch('fields', sheet.Sheet__Id);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Sheet Model Sheets API
    // ------------------------------------------------------------
    export {
        Na__LeModel__GetSheets,
        Na__LeModel__IsSitePlanSheet,
        Na__LeModel__GetSheetById,
        Na__LeModel__GetActiveSheet,
        Na__LeModel__SetActiveSheetId,
        Na__LeModel__CreateSheet,
        Na__LeModel__DuplicateSheet,
        Na__LeModel__DeleteSheet,
        Na__LeModel__UpdateSheet,
        Na__LeModel__ReorderSheet,
        Na__LeModel__GetFields,
        Na__LeModel__UpdateMarginNotes,
        Na__LeModel__SetField
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
