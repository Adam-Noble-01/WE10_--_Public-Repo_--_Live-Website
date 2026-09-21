// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - FLOOR AREAS - THE SCHEDULES
// =============================================================================
//
// FILE       : Na__LayoutEditor__FloorAreas__Table__.js
// NAMESPACE  : Na__LeAreaTable
// MODULE     : Layout Editor - Floor Areas - Schedules
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : What keeps an area schedule telling the truth - the sheet's index handed to the table, a table that has just landed filled in, and every table rebuilt the moment a room changes
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - THE TABLE IS PURE AND THIS IS WHAT FEEDS IT. The Area Schedule element
//   (57__Feature__ScrapbookParametric) knows how to DRAW a table and nothing
//   about sheets; this module reads the sheet's index and hands it over as the
//   `Data` parameter - the same "facts are parameters" idiom the Drawing Title
//   uses for Existing, Proposed and North.
// - IT RUNS BEFORE THE ANNOUNCEMENT, NEVER AFTER IT
//   (Na__LeModel__RegisterBeforeAnnounce). A room stretched by a corner, a
//   room renamed, a group made: the change is still silent when this runs, so
//   the rebuilt table rides out on the SAME announcement - the history takes
//   one snapshot that holds both, and one Ctrl+Z puts both back. A listener
//   could not do this: the history is added first, and an event dispatched on
//   window calls its listeners in the order they were added, whatever their
//   phase. That mistake was made once on the scale bar and only REDO showed
//   it, which is why this file says so out loud.
// - IT DOES THREE THINGS, IN THIS ORDER:
//     1  RECONCILE  a group named by a room but missing from the sheet's list
//                   is added to it - which is how a room pasted from another
//                   sheet brings its group with it.
//     2  ADOPT      a table that has just landed - dropped, pasted, or dragged
//                   from the scrapbook - is filled with this sheet's numbers.
//     3  FOLLOW     every table whose stored numbers no longer match the sheet
//                   is rebuilt, silently.
//   Nothing is rebuilt when nothing moved: the numbers are compared as one
//   string, so the ordinary announcement costs a comparison and stops.
// - A RESTORE IS NEVER FOLLOWED. The model runs no hooks for an undo or a
//   redo, which is right: the snapshot already holds the table as it was.
//
// INTEGRATION:
// - Attached once by Na__LayoutEditor__ModeController__ with the rest of the
//   floor area system.
// // @delegate: ../57__Feature__ScrapbookParametric/Na__LayoutEditor__ScrapbookParametric__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026)
// - ValeVision    : not yet ported - it goes with the rest of Floor Areas.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation: the data, the insert, the hook and the refresh.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Model, Surface, Panels, the Engine and the Index
    // ------------------------------------------------------------
    import {
        Na__LeModel__CHANGED_EVENT,
        Na__LeModel__RegisterBeforeAnnounce,
        Na__LeModel__GetActiveSheet,
        Na__LeModel__GetSheetById,
        Na__LeModel__AddAreaGroup,
        Na__LeModel__GetAreaGroups,
        Na__LeModel__AreaGroupKey,
        Na__LeModel__MarkDirty
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__Refresh } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LePanels__IsEditable } from '../40__Ui__Panels/Na__LayoutEditor__PanelHost__.js';
    import { Na__LeScrapDrag__PlaceInView } from '../55__Feature__Scrapbook/Na__LayoutEditor__Scrapbook__TileDrag__.js';
    import {
        Na__LeParam__GetBlock,
        Na__LeParam__GetType,
        Na__LeParam__GetParams,
        Na__LeParam__ListOnSheet,
        Na__LeParam__BuildSet,
        Na__LeParam__Insert,
        Na__LeParam__Announce,
        Na__LeParam__Regenerate
    } from '../57__Feature__ScrapbookParametric/Na__LayoutEditor__ScrapbookParametric__.js';
    import {
        Na__LeParamArea__TYPE,
        Na__LeParamArea__FORM_AREAS,
        Na__LeParamArea__FORM_GROUPS
    } from '../57__Feature__ScrapbookParametric/Na__LayoutEditor__ScrapbookParametric__AreaSchedule__.js';
    import { Na__LeArea__Index, Na__LeArea__List, Na__LeArea__GroupOf, Na__LeArea__NextGroupColour, Na__LeArea__Label } from './Na__LayoutEditor__FloorAreas__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | What Can Change What a Table Says
    // ------------------------------------------------------------
    // A room IS a vector, so its geometry and its style announce as 'shape'
    // and 'shapes' like any other; 'areas' is a name, a group or the group
    // list; 'groups' is a room being grouped or ungrouped with other markup;
    // and 'viewport'/'viewports' matter because a room reads the scale of the
    // drawing it sits on - move that drawing, or re-scale it, and every room
    // over it measures something else.
    // ------------------------------------------------------------
    const Na__LeAreaTable__FORM_AREAS  = Na__LeParamArea__FORM_AREAS;            // <-- The two forms under this module's own name, so the panel imports one module and not two
    const Na__LeAreaTable__FORM_GROUPS = Na__LeParamArea__FORM_GROUPS;
    const Na__LeAreaTable__REASONS = Object.freeze([ 'shape', 'shapes', 'areas', 'groups', 'group', 'viewport', 'viewports', 'layers' ]);
    const Na__LeAreaTable__WAKE    = Object.freeze([ 'active', 'loaded' ]);      // <-- A sheet comes up: its tables are checked against facts that may have moved while it was away
    // ------------------------------------------------------------

    // MODULE VARIABLES | Listening, and the Guard Against Hearing Itself
    // ------------------------------------------------------------
    let Na__LeAreaTable__Attached  = false;
    let Na__LeAreaTable__Working   = false;
    let Na__LeAreaTable__Waking    = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Numbers a Table Is Given
// -----------------------------------------------------------------------------

    // FUNCTION | The Sheet's Index, in the Shape a Schedule Reads
    // ------------------------------------------------------------
    // Everything the table could show, whatever any one table is set to show:
    // filtering to a group is the TABLE'S decision, made when it is drawn, so
    // two tables on one sheet can report different things from the same facts
    // - and the group list stays complete, which is what the lookup grip's
    // "Only Ground Floor" menu is built from.
    // ------------------------------------------------------------
    function Na__LeAreaTable__DataFor(sheet) {
        const index = Na__LeArea__Index(sheet);
        return {
            Areas : index.areas.map((row) => {
                const area = { Name : row.name, AreaM2 : row.m2 };
                if (row.group)    area.Group    = row.group;
                if (row.colour)   area.Colour   = row.colour;
                if (row.crossing) area.Crossing = true;
                return area;
            }),
            Groups : index.groups.map((group) => {
                const entry = { Name : group.name, AreaM2 : group.m2, Count : group.count };
                if (group.colour) entry.Colour = group.colour;
                return entry;
            }),
            TotalM2 : index.totalM2
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Every Area Schedule on a Sheet
    // ------------------------------------------------------------
    function Na__LeAreaTable__ListOnSheet(sheet) {
        return Na__LeParam__ListOnSheet(sheet).filter((group) => {
            const block = Na__LeParam__GetBlock(group);
            return !!block && block.Parametric__Type === Na__LeParamArea__TYPE;
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Putting One on a Sheet
// -----------------------------------------------------------------------------

    // FUNCTION | Drop a Schedule in the Middle of the View (one undo step)
    // ------------------------------------------------------------
    // The panel's two buttons. It is built with the sheet's real numbers
    // already in it, so it lands the size it will be rather than growing
    // under the pointer a moment later.
    // ------------------------------------------------------------
    function Na__LeAreaTable__Insert(sheet, form) {
        if (!sheet || !Na__LePanels__IsEditable()) return null;
        const params = {
            Form : (form === Na__LeParamArea__FORM_GROUPS) ? Na__LeParamArea__FORM_GROUPS : Na__LeParamArea__FORM_AREAS,
            Data : Na__LeAreaTable__DataFor(sheet)
        };
        return Na__LeScrapDrag__PlaceInView({
            id       : 'floor-areas:' + params.Form,
            name     : Na__LeArea__Label(params.Form === Na__LeParamArea__FORM_GROUPS ? 'InsertSummary' : 'InsertSchedule', 'Area schedule'),
            buildSet : () => Na__LeParam__BuildSet(Na__LeParamArea__TYPE, params, null),
            place    : (live, centreMm) => Na__LeParam__Insert(live, Na__LeParamArea__TYPE, centreMm, params, null)
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Keeping Them True
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Add Any Group a Room Names That the Sheet's List Has Not Got
    // ------------------------------------------------------------
    // Silent, and returns whether anything was added. This is what makes a
    // room pasted from another sheet - or dropped in from the Custom
    // Scrapbook - bring its group with it rather than landing in a group the
    // index cannot show and no table can report.
    // ------------------------------------------------------------
    function Na__LeAreaTable__Reconcile(sheet) {
        const known = new Set(Na__LeModel__GetAreaGroups(sheet).map((group) => Na__LeModel__AreaGroupKey(group.AreaGroup__Name)));
        let added = false;
        Na__LeArea__List(sheet).forEach((shape) => {
            const name = Na__LeArea__GroupOf(shape);
            if (name === '' || known.has(Na__LeModel__AreaGroupKey(name))) return;
            if (Na__LeModel__AddAreaGroup(sheet, name, Na__LeArea__NextGroupColour(sheet), true)) {
                known.add(Na__LeModel__AreaGroupKey(name));
                added = true;
            }
        });
        return added;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Bring Every Schedule on a Sheet Up to Date
    // ------------------------------------------------------------
    // Silent throughout; returns the group ids of the tables that changed. A
    // table whose stored numbers already match the sheet is not touched at
    // all, which is what keeps an ordinary announcement cheap - and what stops
    // a rebuild writing the same records over themselves and marking a sheet
    // dirty for nothing.
    // ------------------------------------------------------------
    function Na__LeAreaTable__Follow(sheet) {
        const tables = Na__LeAreaTable__ListOnSheet(sheet);
        if (!tables.length) return [];
        const fresh = Na__LeAreaTable__DataFor(sheet);
        // COMPARED THROUGH THE TYPE'S OWN NORMALISER, never raw against
        // stored. What a table HOLDS has been through that normaliser and what
        // is read off the sheet has not, and the two write their keys in a
        // different order - so comparing the raw reading found a difference
        // every single time, and every announcement on the sheet rebuilt every
        // table and marked the drawing dirty for nothing. Found in the app, not
        // by reading: the numbers matched and the strings did not.
        const definition = Na__LeParam__GetType(Na__LeParamArea__TYPE);
        const settled    = (definition && typeof definition.normalise === 'function') ? definition.normalise({ Data : fresh }).Data : fresh;
        const wanted     = JSON.stringify(settled);
        const changed = [];
        tables.forEach((group) => {
            const params = Na__LeParam__GetParams(sheet, group.Group__Id);
            if (!params) return;
            if (JSON.stringify(params.Data) === wanted) return;                  // <-- Nothing about the rooms has moved: leave every record alone
            if (Na__LeParam__Regenerate(sheet, group.Group__Id, { Data : settled }, { silent : true })) changed.push(group.Group__Id);
        });
        return changed;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Change Is About to Be Announced
    // ------------------------------------------------------------
    // Silent edits only, and nothing is announced from here: the announcement
    // this runs ahead of carries the work, so the history's one snapshot holds
    // the rooms AND the tables that report them.
    // ------------------------------------------------------------
    function Na__LeAreaTable__BeforeAnnounce(reason, sheetId) {
        if (Na__LeAreaTable__Working) return;
        if (Na__LeAreaTable__REASONS.indexOf(reason) === -1) return;
        const sheet = Na__LeModel__GetSheetById(sheetId);
        if (!sheet) return;
        Na__LeAreaTable__Working = true;
        try {
            const tidied  = Na__LeAreaTable__Reconcile(sheet);
            const rebuilt = Na__LeAreaTable__Follow(sheet);
            if (tidied || rebuilt.length) { Na__LeModel__MarkDirty(); Na__LeSurface__Refresh('markup'); }
        } catch (error) {
            console.warn('[TrueVision3D LayoutEditor] An area schedule could not be brought up to date.', error);
        } finally {
            Na__LeAreaTable__Working = false;
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Bring a Sheet's Schedules Into Line Now (one undo step when anything moved)
    // ------------------------------------------------------------
    // For the case with no announcement to run ahead of: a sheet opened whose
    // tables were saved by an older build, or one whose rooms were changed
    // while it was not the sheet on screen. It makes its own announcement,
    // through the last table it rebuilt.
    // ------------------------------------------------------------
    function Na__LeAreaTable__Refresh(sheet) {
        if (!sheet || Na__LeAreaTable__Working) return 0;
        Na__LeAreaTable__Working = true;
        try {
            const tidied  = Na__LeAreaTable__Reconcile(sheet);
            const rebuilt = Na__LeAreaTable__Follow(sheet);
            if (!tidied && !rebuilt.length) return 0;
            Na__LeModel__MarkDirty();
            Na__LeSurface__Refresh('markup');
            if (rebuilt.length) Na__LeParam__Announce(sheet, rebuilt[rebuilt.length - 1]);
            return rebuilt.length;
        } catch (error) {
            console.warn('[TrueVision3D LayoutEditor] Area schedules could not be refreshed.', error);
            return 0;
        } finally {
            Na__LeAreaTable__Working = false;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Book a Refresh of the Active Sheet, Once This Announcement Is Over
    // ------------------------------------------------------------
    // Never from inside the event that asked for it: a refresh announces, and
    // an announcement inside an announcement reaches later listeners out of
    // order. Editable sessions only - a reader's copy says what was saved.
    // ------------------------------------------------------------
    function Na__LeAreaTable__BookRefresh() {
        if (Na__LeAreaTable__Waking) return;
        Na__LeAreaTable__Waking = true;
        window.setTimeout(() => {
            Na__LeAreaTable__Waking = false;
            const sheet = Na__LePanels__IsEditable() ? Na__LeModel__GetActiveSheet() : null;
            if (sheet) Na__LeAreaTable__Refresh(sheet);
        }, 0);
    }
    // ------------------------------------------------------------


    // FUNCTION | Start Keeping the Schedules True (once)
    // ------------------------------------------------------------
    function Na__LeAreaTable__Attach() {
        if (Na__LeAreaTable__Attached) return false;
        Na__LeAreaTable__Attached = true;
        window.addEventListener(Na__LeModel__CHANGED_EVENT, (event) => {
            const reason = (event && event.detail) ? event.detail.reason : '';
            if (Na__LeAreaTable__WAKE.indexOf(reason) !== -1) Na__LeAreaTable__BookRefresh();
        });
        return Na__LeModel__RegisterBeforeAnnounce(Na__LeAreaTable__BeforeAnnounce);   // <-- Ahead of every listener, the history's included, by construction rather than by order
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Floor Area Schedules API
    // ------------------------------------------------------------
    export {
        Na__LeAreaTable__FORM_AREAS,
        Na__LeAreaTable__FORM_GROUPS,
        Na__LeAreaTable__DataFor,
        Na__LeAreaTable__ListOnSheet,
        Na__LeAreaTable__Insert,
        Na__LeAreaTable__Reconcile,
        Na__LeAreaTable__Follow,
        Na__LeAreaTable__Refresh,
        Na__LeAreaTable__Attach
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
