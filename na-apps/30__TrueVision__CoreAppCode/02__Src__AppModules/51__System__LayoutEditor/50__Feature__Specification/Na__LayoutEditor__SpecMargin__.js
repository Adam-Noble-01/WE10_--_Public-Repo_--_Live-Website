// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SPECIFICATION MARGIN
// =============================================================================
//
// FILE       : Na__LayoutEditor__SpecMargin__.js
// NAMESPACE  : Na__LeMargin
// MODULE     : Layout Editor - Specification Margin
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Lay out a sheet's notes margin - which specification notes it lists, in what order, wrapped to its width - with its overspill regions, and draw them as primitives
// CREATED    : 14-Sep-2026
//
// DESCRIPTION:
// - THE COLUMN. A sheet with its margin switched on reserves a column down
//   the right of its content area, from the top of the border to the title
//   block (Na__LeLayout__MarginRect). It is painted paper, so a viewport
//   pushed beneath it never prints through the notes, with a divider down its
//   left edge - the edge the grip drags.
// - WHAT IT LISTS, AND IN WHAT ORDER. First the groups the sheet lists
//   without leaders (Leaderless Notes), whole, in the order its stack keeps
//   them; then the notes this sheet's bubbles link to (on visible layers), in
//   specification order - group by group, note by note, so codes read in
//   sequence - and then the general notes, always last. A general note is
//   listed on every sheet whose margin includes general notes, and on any
//   sheet whose bubbles link to it. A priority band, after the leaderless
//   groups, is reserved here for when notes can be marked important.
// - HOW A NOTE READS, OVERFLOW AND SPACING are the column's rules
//   (Na__LayoutEditor__SpecMargin__Column__): code and title in bold on one
//   line, the text wrapped under it by the PDF's own metrics, a faint rule
//   between notes, optional group headings; a note that would cross the foot
//   ends the list; the gaps open towards NoteGapMaxMm when every note fits.
//   The margin hands the column its rectangle, its heading and its insets.
// - OVERSPILL NOTE REGIONS (Na__LayoutEditor__NoteRegions__). The margin and
//   the regions a sheet draws share its one list and are planned together
//   (PlanAll): a group a region ticks leaves the margin, and the margin's
//   tail carries on in the overspill regions. Push draws the regions straight
//   after the margin, so every caller of Push draws them with nothing of its
//   own to change, and Report counts the notes across all of them.
// - Pure layout: nothing here touches the DOM or changes the model.
//
// INTEGRATION:
// - Na__LayoutEditor__MarkupBridge__ pushes the margin first in the sheet's
//   markup, so the screen and the PDF draw it from the same primitives.
// - Na__LayoutEditor__Panel__MarginNotes__, __MarginGrip__, __NoteRegions__
//   Grips__ and __PdfExporter__ read Report.
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
// 22-Sep-2026 - Version 1.5.0
// - LEADERLESS NOTES. Entries lists the groups the sheet keeps to list
//   without leaders (Na__LayoutEditor__SheetRecords__LeaderlessNotes__) FIRST,
//   whole and in the sheet's order for them, before the notes its bubbles
//   link to; a note of theirs a bubble links to as well is listed there,
//   once. Entries, the margin's plan and Report count them apart
//   (leaderless), and Report says whether they are switched on
//   (leaderlessOn). Nothing else changes: the regions claim, and the
//   overspill carries, the notes of a leaderless group exactly as any
//   other's, and a sheet that lists no group this way plans, draws and
//   reports exactly as it did.
//
// 22-Sep-2026 - Version 1.4.0
// - OVERSPILL NOTE REGIONS. PlanAll plans the margin and the sheet's regions
//   in one pass (Na__LeRegions__Place); Plan answers the margin's part of it
//   in the shape it always had, Push draws the regions after the margin, and
//   Report adds regionsOn, inRegions, marginOverflow, marginLost, unlisted
//   and a line per region. overflow now counts the notes that fitted
//   NOWHERE - with no region on the sheet that is the margin's overflow
//   exactly as before.
// - The column itself - Wrap and the layout loop - moved verbatim to
//   Na__LayoutEditor__SpecMargin__Column__, so a region is laid out by the
//   margin's own code. Wrap is still exported here under its old name for
//   the specification's PDF. A sheet with no regions plans, draws and
//   reports exactly as it did - compared primitive for primitive against
//   1.3.0 over ten margins, each with the specification loaded and loading -
//   with one deliberate exception: a heading or group heading too wide for
//   the margin now wraps rather than running past its right edge (the
//   column's HeadingLines). One that fits is untouched.
//
// 14-Sep-2026 - Version 1.3.0
// - The gap between notes stretches. NoteGapMm is the least and NoteGapMaxMm
//   the most: a column with room to spare opens every gap evenly, up to the
//   most, with each rule centred in its gap, and a full column is unchanged.
//   The plan carries noteGapMm, the gap it laid the notes at.
//
// 14-Sep-2026 - Version 1.2.0
// - PaddingRightMm insets the wrapped lines from the sheet's right border.
//   Body text is 2 mm (TextSizeMm).
//
// 14-Sep-2026 - Version 1.1.0
// - A note reads as "GN01 | Title" then its body across the full inner
//   width, so the old code-column gutter is gone. A faint rule sits between
//   notes (RulePt, RuleColour). CodePipe is the delimiter between the code
//   and the title.
//
// 14-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Chrome Primitives, Layout, Records, Specification and Links
    // ------------------------------------------------------------
    import {
        Na__LeCfg__GetMarginNotesSetup,
        Na__LeCfg__GetStyleSetup,
        Na__LeCfg__GetTextSetup,
        Na__LeCfg__GetSheetSetup,
        Na__LeCfg__PtToMm
    } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeChrome__PushRect, Na__LeChrome__PushLine, Na__LeChrome__PushText } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetChrome__.js';
    import { Na__LeLayout__Solve, Na__LeLayout__MarginRect } from '../07__Core__SheetData/Na__LayoutEditor__SheetLayout__.js';
    import { Na__LeRec__MarginNotes } from '../07__Core__SheetData/Na__LayoutEditor__SheetRecords__.js';
    import { Na__LeRec__NoteRegionsOn, Na__LeRec__DrawnNoteRegions } from '../07__Core__SheetData/Na__LayoutEditor__SheetRecords__NoteRegions__.js';
    import { Na__LeRec__LeaderlessOn, Na__LeRec__ListedLeaderlessGroups } from '../07__Core__SheetData/Na__LayoutEditor__SheetRecords__LeaderlessNotes__.js';
    import { Na__LeSpec__IsLoaded, Na__LeSpec__ListNotes } from './Na__LayoutEditor__SpecData__.js';
    import { Na__LeSpecLink__LinkedNoteIds } from './Na__LayoutEditor__SpecLinks__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Column Every Box of Notes Is Laid By, and the Regions
    // ------------------------------------------------------------
    import { Na__LeMarginCol__Wrap } from './Na__LayoutEditor__SpecMargin__Column__.js';
    import { Na__LeRegions__Place, Na__LeRegions__Push } from './Na__LayoutEditor__NoteRegions__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | What the Margin Lists
// -----------------------------------------------------------------------------

    // FUNCTION | The Notes a Sheet's Margin Lists, in Order
    // ------------------------------------------------------------
    // Returns { entries, linked, general, leaderless, pending }: entries are
    // specification entries ({ note, group, code, ... }); linked counts the
    // notes listed because this sheet's bubbles link to them, in whatever
    // group; general counts the general notes listed only because the margin
    // lists general notes; leaderless counts the notes listed only because
    // their group is one the sheet lists without leaders; pending is true
    // while the specification has not loaded, when nothing can be listed yet.
    // So total = leaderless + linked + general, whatever overlaps.
    // THE LEADERLESS GROUPS COME FIRST, whole, in the order the sheet keeps
    // them (the Leaderless Notes stack), each group's notes in specification
    // order. A note of theirs a bubble also links to is listed there, once.
    // ------------------------------------------------------------
    function Na__LeMargin__Entries(sheet) {
        const settings = Na__LeRec__MarginNotes(sheet);
        if (!Na__LeSpec__IsLoaded()) return { entries : [], linked : 0, general : 0, leaderless : 0, pending : true };
        const linkedIds = Na__LeSpecLink__LinkedNoteIds(sheet, true);
        const order     = Na__LeRec__ListedLeaderlessGroups(sheet);             // <-- The groups listed without leaders, top of the stack first; [] while switched off
        const bands     = order.map(() => []);                                   // <-- One band per group, so the stack's order wins over the specification's
        const priority  = [];                                                    // <-- Reserved: notes marked important will be listed first after the leaderless groups
        const standard  = [];
        const general   = [];
        let   linked    = 0;
        Na__LeSpec__ListNotes().forEach((entry) => {
            const isLinked = linkedIds.has(entry.note.Note__Id);
            if (isLinked) linked++;
            const band = order.indexOf(entry.group.Group__Id);
            if (band !== -1) { bands[band].push(entry); return; }                // <-- Listed whole, bubble or not, a general group too
            if (entry.group.Group__IsGeneral) { if (isLinked || settings.IncludeGeneral) general.push(entry); return; }
            if (isLinked) standard.push(entry);
        });
        const leaderless     = [].concat(...bands);
        const generalOnly    = general.filter((entry) => !linkedIds.has(entry.note.Note__Id)).length;
        const leaderlessOnly = leaderless.filter((entry) => !linkedIds.has(entry.note.Note__Id)).length;
        return { entries : leaderless.concat(priority, standard, general), linked : linked, general : generalOnly, leaderless : leaderlessOnly, pending : false };
    }
    // ------------------------------------------------------------


    // FUNCTION | Wrap Text to a Width: One String per Printed Line
    // ------------------------------------------------------------
    // The column's wrapper (Na__LayoutEditor__SpecMargin__Column__), under the
    // name the specification's PDF has always imported it by.
    // ------------------------------------------------------------
    const Na__LeMargin__Wrap = Na__LeMarginCol__Wrap;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Layout
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | How the Margin's Notes Are Laid: Its Heading and Its Insets
    // ------------------------------------------------------------
    // The left inset runs down the top and the foot as well; the right one is
    // the clearance before the sheet's right border. Neither is ever more than
    // a quarter of the column's width. Heading null prints the configured one.
    // ------------------------------------------------------------
    function Na__LeMargin__ColumnOptions(rect, settings) {
        const setup    = Na__LeCfg__GetMarginNotesSetup();
        const padLeft  = Math.min(setup.paddingMm, rect.WidthMm / 4);
        const padRight = Math.min(Number.isFinite(setup.paddingRightMm) ? setup.paddingRightMm : setup.paddingMm, rect.WidthMm / 4);
        return {
            heading    : String(settings.Heading || setup.headingText || ''),
            padLeft    : padLeft,
            padRight   : padRight,
            padTop     : padLeft,
            padBottom  : padLeft,
            textSizeMm : settings.TextSizeMm,
            groupHeadings : settings.GroupHeadings
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Plan Every Box of Notes on a Sheet: the Margin and Its Regions Together
    // ------------------------------------------------------------
    // Returns { layout, margin, place, found }:
    //   margin  the margin's plan, as Plan answers it, or null without one
    //   place   where every note went (Na__LeRegions__Place), or null when
    //           neither the margin nor a region is drawn
    //   found   the sheet's list (Entries), or undefined with nothing drawn
    // One pass for both, because they share one list: a group a region ticks
    // leaves the margin, and the margin's tail is what the overspill regions
    // carry on with.
    // ------------------------------------------------------------
    function Na__LeMargin__PlanAll(sheet, layout) {
        const lay     = layout || (sheet ? Na__LeLayout__Solve(sheet) : null);
        const rect    = lay ? Na__LeLayout__MarginRect(sheet, lay.Content, lay.TitleBlock) : null;
        const regions = lay ? Na__LeRec__DrawnNoteRegions(sheet) : [];
        if (!rect && !regions.length) return { layout : lay, margin : null, place : null };
        const settings = Na__LeRec__MarginNotes(sheet);
        const found    = Na__LeMargin__Entries(sheet);
        const place    = Na__LeRegions__Place(sheet, lay, found.entries, rect ? { rect : rect, options : Na__LeMargin__ColumnOptions(rect, settings) } : null);
        const margin   = rect ? Object.assign(place.margin, { rect : rect, total : found.entries.length, linked : found.linked, general : found.general, leaderless : found.leaderless, pending : found.pending }) : null;
        return { layout : lay, margin : margin, place : place, found : found };
    }
    // ------------------------------------------------------------


    // FUNCTION | Plan the Column: Where Every Run of Text Goes and What Did Not Fit
    // ------------------------------------------------------------
    // Returns null when the sheet has no margin, else
    // { rect, runs [{ text, x, baselineY, fontMm, weight, colour, trackingMm }],
    //   rules [{ X1, Y1, X2, Y2 }],
    //   total, shown, overflow, linked, general, leaderless, pending,
    //   noteGapMm (the gap the notes were laid at, NoteGapMm to NoteGapMaxMm) }.
    // total is every note the sheet lists; shown and overflow are the
    // margin's own - a note a region claims was never the margin's to show,
    // and one in overflow may carry on in an overspill region (Report says).
    // layout is the solved sheet layout; the margin itself is measured afresh
    // from the sheet, so a width dragged since the last solve is honoured.
    // ------------------------------------------------------------
    function Na__LeMargin__Plan(sheet, layout) {
        return Na__LeMargin__PlanAll(sheet, layout).margin;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Push the Margin Column as Primitives: Paper, Divider, Rules, Text
    // ------------------------------------------------------------
    // The paper stops a border stroke short of the content border and the title
    // block, so on screen - where the chrome is under the markup - it never
    // covers the lines it sits between.
    // ------------------------------------------------------------
    function Na__LeMargin__PushColumn(list, plan) {
        const setup  = Na__LeCfg__GetMarginNotesSetup();
        const style  = Na__LeCfg__GetStyleSetup();
        const inset  = Na__LeCfg__GetSheetSetup().borderStrokeMm;
        const family = Na__LeCfg__GetTextSetup().fontFamily;
        const rect   = plan.rect;
        Na__LeChrome__PushRect(list, rect.X, rect.Y + inset, Math.max(0, rect.WidthMm - inset), Math.max(0, rect.HeightMm - (inset * 2)), null, 0, style.paperColour);
        const dividerMm = Na__LeCfg__PtToMm(setup.dividerPt);
        if (dividerMm > 0) Na__LeChrome__PushLine(list, rect.X, rect.Y, rect.X, rect.Y + rect.HeightMm, style.inkColour, dividerMm);
        const ruleMm = Na__LeCfg__PtToMm(setup.rulePt);
        if (ruleMm > 0) {
            (plan.rules || []).forEach((rule) => {
                Na__LeChrome__PushLine(list, rule.X1, rule.Y1, rule.X2, rule.Y2, setup.ruleColour || '#cfd4d8', ruleMm);
            });
        }
        plan.runs.forEach((run) => {
            Na__LeChrome__PushText(list, {
                X : run.x, BaselineY : run.baselineY, Text : run.text, FontMm : run.fontMm, Weight : run.weight,
                Colour : run.colour, Align : 'left', FontFamily : family, TrackingMm : run.trackingMm
            });
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Push a Sheet's Notes as Primitives: the Margin, Then Its Regions (returns the margin's plan, or null)
    // ------------------------------------------------------------
    // The regions go after the margin, so one laid over it is drawn over it.
    // Every caller - the sheet surface, the PDF, the scrapbook previews - gets
    // the regions from here with nothing of its own to change.
    // ------------------------------------------------------------
    function Na__LeMargin__Push(list, sheet, layout) {
        const all = Na__LeMargin__PlanAll(sheet, layout);
        if (all.margin) Na__LeMargin__PushColumn(list, all.margin);
        if (all.place)  Na__LeRegions__Push(list, all.place);
        return all.margin;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Sheet's Notes in Numbers, for the Panel, the Grips and the PDF
    // ------------------------------------------------------------
    // { on             the margin column is drawn
    //   regionsOn      the regions are switched on (drawn or not: there may be none)
    //   leaderlessOn   the leaderless notes are switched on (ticked groups or not)
    //   settings, rect, total, linked, general, pending   as they always were
    //   leaderless     notes listed only because their group is listed
    //                  without leaders (Entries)
    //   shown          notes printed in the margin
    //   inRegions      notes printed in a region
    //   overflow       notes that had a place and fitted nowhere - with no
    //                  region, the margin's overflow exactly as it always was
    //   marginOverflow the margin's own tail, carried on or not
    //   marginLost     the part of it that goes no further (the margin's badge)
    //   unlisted       notes given no place at all: the margin off and no
    //                  overspill region
    //   regions        [{ id, index, rect, title, overspill, own, listed, shown,
    //                     tail, lost, carriedTo (the index of the overspill
    //                     region the tail carries on in, or null) }] }
    // ------------------------------------------------------------
    function Na__LeMargin__Report(sheet, layout) {
        const settings = Na__LeRec__MarginNotes(sheet);
        const all      = sheet ? Na__LeMargin__PlanAll(sheet, layout) : { margin : null, place : null };
        const plan     = all.margin;
        const place    = all.place;
        const found    = all.found || null;
        return {
            on             : !!plan,
            regionsOn      : Na__LeRec__NoteRegionsOn(sheet),
            settings       : settings,
            rect           : plan ? plan.rect : null,
            total          : found ? found.entries.length : 0,
            shown          : plan ? plan.shown : 0,
            inRegions      : place ? place.inRegions : 0,
            overflow       : place ? place.lost : 0,
            marginOverflow : plan ? plan.overflow : 0,
            marginLost     : place ? place.marginLost : 0,
            unlisted       : place ? place.unlisted : 0,
            linked         : found ? found.linked : 0,
            general        : found ? found.general : 0,
            leaderlessOn   : Na__LeRec__LeaderlessOn(sheet),
            leaderless     : found ? found.leaderless : 0,
            pending        : found ? found.pending : !Na__LeSpec__IsLoaded(),
            regions        : place ? place.regions.map((p) => ({
                id : p.id, index : p.index, rect : p.rect, title : p.title, overspill : p.overspill,
                own : p.own.length, listed : p.list.length, shown : p.shown, tail : p.tail, lost : p.lost,
                carriedTo : p.carriedTo ? p.carriedTo.index : null
            })) : []
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Specification Margin API
    // ------------------------------------------------------------
    export {
        Na__LeMargin__Entries,
        Na__LeMargin__Wrap,
        Na__LeMargin__PlanAll,
        Na__LeMargin__Plan,
        Na__LeMargin__Push,
        Na__LeMargin__Report
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
