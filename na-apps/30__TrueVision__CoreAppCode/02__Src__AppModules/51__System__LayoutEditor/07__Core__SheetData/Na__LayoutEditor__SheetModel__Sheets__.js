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
//   sheet and the switch between sheets. A sheet is normalised once per
//   announcement, not once per read (IsNormalised): every tool asks for the
//   active sheet on every pointer move, several times over.
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
// - Divergences   : header; site plan drawings, TrueVision first: IsSitePlanSheet, TabGroup, NextOrder and RenumberSheets are TrueVision only, and GetSheets, CreateSheet, DuplicateSheet, DeleteSheet, UpdateSheet and ReorderSheet keep the two tab groups. GetSheets normalising once per announcement (IsNormalised, NoteNormalised) is TrueVision first, 21-Sep-2026.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.4.0
// - LEADERLESS NOTES. UpdateMarginNotes takes leaderlessOn (the Margin Notes
//   panel's Leaderless Notes switch), leaderlessGroup ({ id, on }: a group
//   ticked joins the end of the list) and leaderlessMove ({ id, index }: the
//   stack's drag and arrow keys). The list arithmetic is the new record
//   leaf's (LeaderlessToggled, LeaderlessMoved); each is one 'margin'
//   announcement, as every other margin change is. No new export.
// - TrueVision first; not yet in ValeVision.
//
// 22-Sep-2026 - Version 1.3.0
// - OVERSPILL NOTE REGIONS. UpdateMarginNotes takes regionsOn (the Margin
//   Notes panel's Overspill Note Regions switch). AddNoteRegion,
//   UpdateNoteRegion and DeleteNoteRegion keep the regions on the notes
//   margin record, each announced as 'margin' - one undo step, kept by the
//   browser draft and Save Sheets, never an auto save - and UpdateNoteRegion
//   can be silent for a grip mid-drag, as UpdateMarginNotes is for the
//   margin's edge. Each normalises the record it writes, as the margin always
//   has, so a silent edit is never read back half made.
// - TrueVision first; not yet in ValeVision.
//
// 21-Sep-2026 - Version 1.2.0
// - GetSheets normalises a sheet ONCE PER ANNOUNCEMENT, not once per read. It
//   used to run the whole normaliser over every record of every sheet in the
//   pack each time anything asked for the sheets, one sheet by id or the active
//   sheet - 1.3 ms a call on RB05 (fifteen sheets), from 223 call sites. A
//   pointer move with the Dimension tool up made eight of them: 10.5 ms of a
//   16.7 ms frame gone before the snap, which itself takes 0.07 ms, had been
//   looked for; the click that lands a dimension made sixty-odd (85 ms). Now
//   0.5 ms a move and 13 ms for the click, and the sheet data is identical at
//   every step of a scripted session run on both builds (undo, redo, a layer
//   deleted with items on it, raw records slipped in with no announcement, a
//   whole restore from raw records).
// - WHAT BRINGS A SHEET BACK TO THE NORMALISER: an announcement (the State
//   unit's Revision moves on every Dispatch, so undo, redo, a load and every
//   edit all count); a sheet object it has not met (a load, a restore, a
//   duplicate); or one of its lists replaced or a different length (a record
//   pushed or spliced behind the model's back). A silent edit mid-gesture does
//   not, and need not: Create, Insert and Update normalise the record they
//   write, as they always have.
// - TrueVision first; not yet in ValeVision.
//
// 19-Sep-2026 - Version 1.1.0
// - Short tab names. GetDrawingNumber, GetShortCode and GetTabLabel: a sheet's
//   drawing number, the "D03" cut from it, and what its tab reads
//   ("D03 - 3D Images", the TabLabelFormat label). CleanSheetName takes a code
//   typed in front of a name back off before it is kept.
// - ApplySheetName is the one rename. A stored Drawing Title that differs from
//   the name is somebody's typing and survives it; one that matches the name
//   was only following it, and still does. UpdateSheet, DuplicateSheet and the
//   register's name transaction all go through it, so shortening a tab no
//   longer writes the short name over the title block's long one.
// - SetField no longer renames the sheet when the Drawing Title is typed: the
//   title is the long one on the title block, the name the short one on the tab.
//
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__SheetModel__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // @delegate: ../51__Feature__DrawingRegister/Na__LayoutEditor__Register__Numbering__.js
    import { Na__LeRegNum__Plan, Na__LeRegNum__Apply } from '../51__Feature__DrawingRegister/Na__LayoutEditor__Register__Numbering__.js';
    import { Na__LeCfg__GetDrawingRegisterSetup, Na__LeCfg__FormatLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__CfApi__GetLoadedProjectData } from '../../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js';
    import { Na__LeCommon__Uses, Na__LeCommon__SetUses, Na__LeCommon__Set, Na__LeCommon__Seed } from './Na__LayoutEditor__SheetModel__Common__.js';

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
        Na__LeRec__DrawingNumber,
        Na__LeRec__Phase,
        Na__LeRec__DocumentId,
        Na__LeRec__ComposeDocumentId,
        Na__LeRec__ShortCode,
        Na__LeRec__StripSheetCode,
        Na__LeRec__NormaliseMarginNotes
    } from './Na__LayoutEditor__SheetRecords__.js';
    import { Na__LeRec__NewNoteRegion, Na__LeRec__NoteRegionById } from './Na__LayoutEditor__SheetRecords__NoteRegions__.js';   // <-- The overspill note regions on the margin record
    import { Na__LeRec__LeaderlessToggled, Na__LeRec__LeaderlessMoved } from './Na__LayoutEditor__SheetRecords__LeaderlessNotes__.js';   // <-- The groups the margin lists without leaders
    // ------------------------------------------------------------

    // MODULE IMPORTS | Sheet Model State
    // ------------------------------------------------------------
    import {
        Na__LeModel__ActiveSheetId,
        Na__LeModel__Revision,
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
// REGION | What Has Already Been Normalised
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS AND VARIABLES | The Lists Watched, and Each Sheet as It Stood After Its Last Pass
    // ------------------------------------------------------------
    const Na__LeModel__SHEET_LISTS = [ 'Sheet__Layers', 'Sheet__Viewports', 'Sheet__Annotations', 'Sheet__Dimensions', 'Sheet__Shapes', 'Sheet__Leaders', 'Sheet__Groups' ];
    const Na__LeModel__Normalised  = new WeakMap();   // <-- sheet -> { revision, lists, lengths }; a sheet that is let go takes its entry with it
    // ------------------------------------------------------------


    // HELPER FUNCTION | Has a Sheet Been Normalised Since Anything Could Have Changed It
    // ------------------------------------------------------------
    // THE NORMALISER IS NOT A READ. It walks every record of a sheet, and
    // GetSheets ran it over every sheet of the pack for every caller that
    // wanted one sheet - the active one, mostly, eight times per pointer move.
    // A sheet is good until something could have changed it:
    //   an announcement         Revision moves on every Dispatch - an edit, an
    //                           undo, a redo, a load, the register
    //   a sheet not met before  a load, a restore or a duplicate is new objects
    //   a list replaced, or a   a record pushed or spliced behind the model's
    //   different length        back; an undo swaps every list for the snapshot's
    // A SILENT EDIT DOES NOT COUNT, and need not: Create, Insert and Update
    // normalise the record they write themselves, which is all a drag changes
    // between its first move and the announcement that ends it.
    // ------------------------------------------------------------
    function Na__LeModel__IsNormalised(sheet) {
        const seen = Na__LeModel__Normalised.get(sheet);
        if (!seen || seen.revision !== Na__LeModel__Revision) return false;
        for (let i = 0; i < Na__LeModel__SHEET_LISTS.length; i++) {
            const list = sheet[Na__LeModel__SHEET_LISTS[i]];
            if (seen.lists[i] !== list || seen.lengths[i] !== (Array.isArray(list) ? list.length : -1)) return false;
        }
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Note a Sheet as It Stands, Straight After Its Pass
    // ------------------------------------------------------------
    // AFTER, not before: the pass itself replaces some of the lists (the
    // groups, filtered), and those are the ones the next read will find.
    // ------------------------------------------------------------
    function Na__LeModel__NoteNormalised(sheet) {
        const lists = Na__LeModel__SHEET_LISTS.map((key) => sheet[key]);
        Na__LeModel__Normalised.set(sheet, { revision : Na__LeModel__Revision, lists : lists, lengths : lists.map((list) => (Array.isArray(list) ? list.length : -1)) });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Sheets
// -----------------------------------------------------------------------------

    // FUNCTION | Every Sheet, Normalised and in Tab Order
    // ------------------------------------------------------------
    // Architectural sheets first, then site plan sheets, each group by
    // Sheet__Order. The one sort point: the tab strip, the editor's first
    // sheet and the Dev menu all read this list. A sheet already normalised
    // since anything could have changed it is passed over (IsNormalised).
    // ------------------------------------------------------------
    function Na__LeModel__GetSheets() {
        const list = Na__LeModel__Array().filter((s) => s && typeof s === 'object' && typeof s.Sheet__Id === 'string');
        list.forEach((sheet, index) => {
            if (Na__LeModel__IsNormalised(sheet)) return;
            Na__LeRec__NormaliseSheet(sheet, index);
            Na__LeModel__NoteNormalised(sheet);
        });
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
        Na__LeModel__ApplySheetName(copy, source.Sheet__Name + ' copy');         // <-- A typed Drawing Title is copied with the sheet; one that followed the name follows the copy's
        copy.Sheet__Order = Na__LeModel__NextOrder(list);
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
        if (typeof patch.name === 'string' && patch.name.trim()) Na__LeModel__ApplySheetName(sheet, Na__LeModel__CleanSheetName(sheet, patch.name));
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


    // FUNCTION | A Sheet's Drawing Number, and the Short Code Cut From It ("D03")
    // ------------------------------------------------------------
    // The number is the Drawing Register's: numbering writes it onto the sheet
    // and nothing else does. The short code is its last run of letters and
    // digits, which is all a tab has room for.
    // ------------------------------------------------------------
    function Na__LeModel__GetDrawingNumber(sheet) {
        return Na__LeRec__DrawingNumber(sheet);
    }
    function Na__LeModel__GetShortCode(sheet) {
        return Na__LeRec__ShortCode(Na__LeRec__DrawingNumber(sheet));
    }
    // ------------------------------------------------------------


    // FUNCTION | A Sheet's Job Stage, and the Whole Identifier It Composes Into
    // ------------------------------------------------------------
    // GetDrawingNumber answers the sequence ("D01"), GetPhase the stage
    // ("T02"), and GetDocumentId the three parts joined behind the project code
    // ("PS01_T02_D01"). The register shows all three side by side, because read
    // in that order they are how the identifier is built.
    // ------------------------------------------------------------
    function Na__LeModel__GetPhase(sheet) {
        return Na__LeRec__Phase(sheet);
    }
    function Na__LeModel__GetDocumentId(sheet) {
        return Na__LeRec__DocumentId(sheet);
    }
    function Na__LeModel__ComposeDocumentId(project, phase, drawing) {           // <-- For asking "what would this become?" before a change is committed
        return Na__LeRec__ComposeDocumentId(project, phase, drawing);
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Sheet Is Called on Screen: Its Short Code, Then Its Name
    // ------------------------------------------------------------
    // "D03 - 3D Images". The tab, the toolbar and every list that names a
    // sheet read this, so a drawing is called the same thing wherever it is
    // met and a renumber in the register reaches all of them at once. With no
    // name handed in it answers for the sheet's own; with one - the empty
    // string included - it answers for that, which is how the Sheet panel
    // and the tab's rename field get the "D03 -" they show in front of the box.
    // ------------------------------------------------------------
    function Na__LeModel__GetTabLabel(sheet, name) {
        if (!sheet) return '';
        const words = (typeof name === 'string') ? name : sheet.Sheet__Name;
        const code  = Na__LeModel__GetShortCode(sheet);
        return code ? Na__LeCfg__FormatLabel('TabLabelFormat', '{code} - {name}', { code : code, name : words }).trim() : words;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Typed Sheet Name, With Any Drawing Code Typed in Front Taken Off
    // ------------------------------------------------------------
    // Run before a name is kept, so "D03 - 3D Views" typed out of habit is
    // saved as "3D Views" rather than saved whole and stripped on the next read.
    // ------------------------------------------------------------
    function Na__LeModel__CleanSheetName(sheet, text) {
        return Na__LeRec__StripSheetCode(String(text === undefined || text === null ? '' : text).trim(), Na__LeRec__DrawingNumber(sheet));
    }
    // ------------------------------------------------------------


    // FUNCTION | Rename a Sheet; a Drawing Title That Was Only Ever the Name Goes With It
    // ------------------------------------------------------------
    // The name is the short one a tab shows. The title block's Drawing Title
    // is usually a different and longer thing ("Permitted Development
    // Compliance - Existing Conditions & Design Proposal Floor Plans"), and a
    // rename used to write the new name straight over it - so shortening four
    // tabs would have cost four typed titles. A stored title that differs from
    // the name is somebody's typing and is kept. One that matches the name was
    // only following it, and still does; one never stored follows by itself,
    // through the default in BuildFields, and is left unstored.
    //
    // Mutates only. The caller announces the change, because a plain rename
    // and a register transaction announce it differently.
    // ------------------------------------------------------------
    function Na__LeModel__ApplySheetName(sheet, name) {
        if (!sheet || typeof name !== 'string' || !name) return false;
        const fields = sheet.Sheet__Fields || (sheet.Sheet__Fields = {});
        if (fields.Sheet__Fields__Title === sheet.Sheet__Name) fields.Sheet__Fields__Title = name;
        sheet.Sheet__Name = name;
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Sheet's Notes Margin Record, Made When It Has None
    // ------------------------------------------------------------
    function Na__LeModel__NotesRecord(sheet) {
        return (sheet.Sheet__MarginNotes && typeof sheet.Sheet__MarginNotes === 'object') ? sheet.Sheet__MarginNotes : (sheet.Sheet__MarginNotes = {});
    }
    // ------------------------------------------------------------


    // FUNCTION | Switch, Widen or Restyle a Sheet's Notes Margin
    // ------------------------------------------------------------
    // patch: { enabled, widthMm, heading (null or empty for the configured
    // one), textSizeMm, includeGeneral, groupHeadings, regionsOn,
    // leaderlessOn, leaderlessGroup, leaderlessMove }. The first change
    // creates Sheet__MarginNotes. Announced as 'margin': a content edit, kept
    // by the browser draft and Save Sheets, one undo step, never an auto
    // save. silent: true skips the announcement (the edge grip while it is
    // dragged). regionsOn switches the overspill note regions: off keeps every
    // region, so on again puts them back as they were.
    // THE LEADERLESS NOTES, the groups listed without bubbles:
    //   leaderlessOn    the switch; off keeps the groups, as regionsOn does
    //   leaderlessGroup { id, on } - one group ticked (it joins the end of
    //                   the list) or unticked, the rest kept in their order
    //   leaderlessMove  { id, index } - one group moved to index in the whole
    //                   list (the Leaderless Notes stack's drag and arrow keys)
    // ------------------------------------------------------------
    function Na__LeModel__UpdateMarginNotes(sheet, patch, silent) {
        if (!sheet || !patch) return false;
        const notes = Na__LeModel__NotesRecord(sheet);
        if (typeof patch.enabled === 'boolean') notes.Enabled = patch.enabled;
        if (Number.isFinite(patch.widthMm)) notes.WidthMm = patch.widthMm;
        if (patch.heading !== undefined) notes.Heading = (typeof patch.heading === 'string' && patch.heading.trim()) ? patch.heading : null;
        if (Number.isFinite(patch.textSizeMm)) notes.TextSizeMm = patch.textSizeMm;
        if (typeof patch.includeGeneral === 'boolean') notes.IncludeGeneral = patch.includeGeneral;
        if (typeof patch.groupHeadings === 'boolean') notes.GroupHeadings = patch.groupHeadings;
        if (typeof patch.regionsOn === 'boolean') { if (patch.regionsOn) notes.RegionsOn = true; else delete notes.RegionsOn; }   // <-- Stored only as true
        if (typeof patch.leaderlessOn === 'boolean') { if (patch.leaderlessOn) notes.LeaderlessOn = true; else delete notes.LeaderlessOn; }   // <-- Stored only as true
        if (patch.leaderlessGroup && typeof patch.leaderlessGroup === 'object') notes.LeaderlessGroups = Na__LeRec__LeaderlessToggled(notes.LeaderlessGroups, patch.leaderlessGroup.id, patch.leaderlessGroup.on);
        if (patch.leaderlessMove && typeof patch.leaderlessMove === 'object') notes.LeaderlessGroups = Na__LeRec__LeaderlessMoved(notes.LeaderlessGroups, patch.leaderlessMove.id, patch.leaderlessMove.index);
        Na__LeRec__NormaliseMarginNotes(sheet);                                  // <-- An emptied list is dropped here, so the record keeps no empty key
        if (silent) { Na__LeModel__AssignDirty(true); return true; }
        Na__LeModel__Touch('margin', sheet.Sheet__Id);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Add an Overspill Note Region Where One Was Drawn
    // ------------------------------------------------------------
    // frame: { X, Y, WidthMm, HeightMm } in paper millimetres. patch: { title,
    // overspill, groups, borders }, each optional - a new region takes the
    // overspill, no group and every border line. A region drawn is a region
    // meant to be seen, so the regions are switched on with it. Announced as
    // 'margin' like every other notes change: one undo step. Returns the
    // region as it is kept, or null.
    // ------------------------------------------------------------
    function Na__LeModel__AddNoteRegion(sheet, frame, patch) {
        if (!sheet || !frame || typeof frame !== 'object') return null;
        const notes   = Na__LeModel__NotesRecord(sheet);
        const regions = Array.isArray(notes.Regions) ? notes.Regions : [];
        const region  = Na__LeRec__NewNoteRegion(regions, frame, patch);
        if (!region) return null;
        notes.Regions   = regions.concat([ region ]);
        notes.RegionsOn = true;
        Na__LeRec__NormaliseMarginNotes(sheet);
        Na__LeModel__Touch('margin', sheet.Sheet__Id);
        return Na__LeRec__NoteRegionById(sheet, region.Region__Id);
    }
    // ------------------------------------------------------------


    // FUNCTION | Move, Resize, Retitle or Restyle One Note Region
    // ------------------------------------------------------------
    // patch, every key optional:
    //   frameMm    { X, Y, WidthMm, HeightMm } - where it now sits
    //   title      the title to print; null or empty for the automatic one
    //   overspill  whether it takes the notes that did not fit elsewhere
    //   groups     the whole list of group ids it lists
    //   group      { id, on } - one group ticked or unticked, the rest kept
    //   borders    { Top, Right, Bottom, Left } - the sides given, the rest kept
    // silent: true skips the announcement (a grip while it is dragged); the
    // release announces once, so a whole drag is one undo step.
    // ------------------------------------------------------------
    function Na__LeModel__UpdateNoteRegion(sheet, regionId, patch, silent) {
        const region = (sheet && patch) ? Na__LeRec__NoteRegionById(sheet, regionId) : null;
        if (!region) return false;
        const frame = patch.frameMm;
        if (frame && typeof frame === 'object') {
            const was = region.Region__FrameMm || {};
            const pick = (key) => (Number.isFinite(frame[key]) ? frame[key] : was[key]);
            region.Region__FrameMm = { X : pick('X'), Y : pick('Y'), WidthMm : pick('WidthMm'), HeightMm : pick('HeightMm') };
        }
        if (patch.title !== undefined) region.Region__Title = (typeof patch.title === 'string' && patch.title.trim()) ? patch.title : null;
        if (typeof patch.overspill === 'boolean') region.Region__Overspill = patch.overspill;
        if (Array.isArray(patch.groups)) region.Region__Groups = patch.groups.slice();
        if (patch.group && typeof patch.group.id === 'string' && patch.group.id) {
            const kept = (region.Region__Groups || []).filter((id) => id !== patch.group.id);
            region.Region__Groups = patch.group.on === true ? kept.concat([ patch.group.id ]) : kept;
        }
        if (patch.borders && typeof patch.borders === 'object') {
            const sides = Object.assign({}, region.Region__Borders || {});
            Object.keys(patch.borders).forEach((side) => { if (typeof patch.borders[side] === 'boolean') sides[side] = patch.borders[side]; });
            region.Region__Borders = sides;
        }
        Na__LeRec__NormaliseMarginNotes(sheet);
        if (silent) { Na__LeModel__AssignDirty(true); return true; }
        Na__LeModel__Touch('margin', sheet.Sheet__Id);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete One Note Region (one undo step; the switch is left as it was)
    // ------------------------------------------------------------
    function Na__LeModel__DeleteNoteRegion(sheet, regionId) {
        const notes = sheet ? sheet.Sheet__MarginNotes : null;
        if (!notes || typeof notes !== 'object' || !Array.isArray(notes.Regions)) return false;
        const kept = notes.Regions.filter((region) => !region || region.Region__Id !== regionId);
        if (kept.length === notes.Regions.length) return false;
        if (kept.length) notes.Regions = kept; else delete notes.Regions;
        Na__LeRec__NormaliseMarginNotes(sheet);
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
        Na__LeModel__Touch('fields', sheet.Sheet__Id);                          // <-- A typed Drawing Title never renames the tab: the title is the long one, the name the short one
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is This Sheet Showing the Pack's Client and Site Address?
    // ------------------------------------------------------------
    function Na__LeModel__IsCommonFields(sheet) {
        return Na__LeCommon__Uses(sheet);
    }
    // ------------------------------------------------------------


    // FUNCTION | Join This Sheet to the Pack's Two Fields, or Cut It Loose
    // ------------------------------------------------------------
    // 'fields' and not 'sheet-updated': this is a content edit of the title
    // block, one undo step, kept by the browser draft, and no auto save to R2 -
    // exactly what typing into the Client box has always been.
    // ------------------------------------------------------------
    function Na__LeModel__SetCommonFields(sheet, on) {
        if (!Na__LeCommon__SetUses(sheet, on)) return false;
        Na__LeModel__Touch('fields', sheet.Sheet__Id);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Set the Client or Site Address for the WHOLE Pack
    // ------------------------------------------------------------
    // The sheet is passed only so the announcement names where the typing
    // happened; the value written belongs to every sheet on Common.
    // ------------------------------------------------------------
    function Na__LeModel__SetCommonFieldValue(sheet, key, value) {
        if (!Na__LeCommon__Set(key, value)) return false;
        Na__LeModel__Touch('fields', sheet ? sheet.Sheet__Id : null);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Seed the Pack's Two Fields, Once Per Project Load
    // ------------------------------------------------------------
    // Marks the model dirty when it writes anything, so the seed lands with
    // the next save rather than writing to R2 by itself.
    // ------------------------------------------------------------
    async function Na__LeModel__SeedCommonFields() {
        const changed = await Na__LeCommon__Seed(Na__LeModel__Array());
        if (changed) Na__LeModel__Touch('fields', Na__LeModel__ActiveSheetId);
        return changed;
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
        Na__LeModel__GetDrawingNumber,
        Na__LeModel__GetPhase,
        Na__LeModel__GetDocumentId,
        Na__LeModel__ComposeDocumentId,
        Na__LeModel__GetShortCode,
        Na__LeModel__GetTabLabel,
        Na__LeModel__CleanSheetName,
        Na__LeModel__ApplySheetName,
        Na__LeModel__UpdateMarginNotes,
        Na__LeModel__AddNoteRegion,
        Na__LeModel__UpdateNoteRegion,
        Na__LeModel__DeleteNoteRegion,
        Na__LeModel__SetField,
        Na__LeModel__IsCommonFields,
        Na__LeModel__SetCommonFields,
        Na__LeModel__SetCommonFieldValue,
        Na__LeModel__SeedCommonFields
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
