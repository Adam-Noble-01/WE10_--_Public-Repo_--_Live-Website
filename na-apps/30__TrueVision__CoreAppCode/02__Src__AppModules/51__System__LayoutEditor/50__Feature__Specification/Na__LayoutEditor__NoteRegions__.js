// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - OVERSPILL NOTE REGIONS
// =============================================================================
//
// FILE       : Na__LayoutEditor__NoteRegions__.js
// NAMESPACE  : Na__LeRegions
// MODULE     : Layout Editor - Overspill Note Regions
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Decide where every note a sheet lists goes - the notes margin, a region, or nowhere - lay each region out, and draw it as primitives
// CREATED    : 22-Sep-2026
//
// DESCRIPTION:
// - WHY. The notes margin is one column down the right of a sheet, and on a
//   busy drawing, or a document laid out another way, one column is not
//   enough room or not the right place. A region is a box drawn anywhere on
//   the sheet that holds notes the way the margin does - the notes a margin
//   cannot fit, or the groups picked for it - so the notes can break out.
// - WHERE A NOTE GOES (Place). The sheet's list is the margin's, unchanged:
//   the notes its bubbles link to, then the general notes
//   (Na__LeMargin__Entries). Regions decide only WHERE each is printed:
//     1. A note whose group is ticked in a region is that region's - the
//        first region down the list that ticks it. It leaves the margin.
//     2. Every other note is the margin's. With the margin off, it waits for
//        the overspill regions instead.
//     3. What does not fit where it went - the margin's tail, a group
//        region's tail - carries on in the OVERSPILL regions, in the order the
//        panel lists them, in specification order. An overspill region lists
//        its own ticked groups first, then the overspill after them.
//   Nothing is ever printed twice, and the order a box shows is never broken
//   to squeeze a later note in (the column rule, Na__LayoutEditor__SpecMargin
//   __Column__).
// - WHAT IS COUNTED AS LOST. A note that had somewhere to go and did not fit
//   anywhere is lost, and every place that reports on the notes says so (the
//   panel, the badge on the sheet, the PDF's toast). With the margin off and
//   no overspill region, a note no region claims was never given a place at
//   all: that is counted apart, as not listed, because it is a choice rather
//   than a box that is too small.
// - HOW A REGION READS. Exactly as the margin does, at the margin's text size
//   and with its group headings setting, inset RegionPaddingMm on every side:
//   its title across the top in tracked capitals - the one typed, else the
//   config's overspill title, a lone group's own title, or the config's
//   title for several groups - then its notes. A region titled after its one
//   group does not print that group's heading again under the title. Its
//   paper masks what is under it, as the margin's does, and each of its four
//   border lines is drawn or not on its own, in the margin divider's weight
//   and ink.
// - A REGION IS KEPT ON THE PAPER. Its frame is moved onto the page, and cut
//   down to it only when it is larger, when it is laid out; the record keeps
//   where it was put (Na__LayoutEditor__SheetRecords__NoteRegions__).
// - Pure layout: nothing here touches the DOM or changes the model.
//
// INTEGRATION:
// - Na__LayoutEditor__SpecMargin__ calls Place with the sheet's list and the
//   margin's box, and Push with what Place gave back, so the margin and its
//   regions are planned together and drawn together - by the sheet surface,
//   the PDF and the web viewer alike, none of which knows a region exists.
// // @delegate: ./Na__LayoutEditor__SpecMargin__Column__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (22-Sep-2026)
// - ValeVision    : not yet ported. Nothing here is app-specific.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Chrome Primitives, Layout, Records, Specification and the Column
    // ------------------------------------------------------------
    import {
        Na__LeCfg__GetMarginNotesSetup,
        Na__LeCfg__GetStyleSetup,
        Na__LeCfg__GetTextSetup,
        Na__LeCfg__PtToMm
    } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeChrome__PushRect, Na__LeChrome__PushLine, Na__LeChrome__PushText } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetChrome__.js';
    import { Na__LeLayout__ClampToPage } from '../07__Core__SheetData/Na__LayoutEditor__SheetLayout__.js';
    import { Na__LeRec__MarginNotes } from '../07__Core__SheetData/Na__LayoutEditor__SheetRecords__.js';
    import { Na__LeRec__DrawnNoteRegions } from '../07__Core__SheetData/Na__LayoutEditor__SheetRecords__NoteRegions__.js';
    import { Na__LeSpec__GetGroupById } from './Na__LayoutEditor__SpecData__.js';
    import { Na__LeMarginCol__Lay } from './Na__LayoutEditor__SpecMargin__Column__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | One Region
// -----------------------------------------------------------------------------

    // FUNCTION | The Box a Region Is Drawn In: Its Frame, Kept on the Paper
    // ------------------------------------------------------------
    // Moved onto the page, and cut down to it only when it is larger, so a
    // region a paper change left hanging off the edge is still there to be
    // seen and taken hold of. null without a layout.
    // ------------------------------------------------------------
    function Na__LeRegions__Rect(region, layout) {
        const frame = region ? region.Region__FrameMm : null;
        if (!frame || !layout) return null;
        return Na__LeLayout__ClampToPage(layout, frame);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Groups a Region Ticks That the Specification Has
    // ------------------------------------------------------------
    // A group the specification has not loaded (or no longer has) is not
    // counted, so a region waiting for it reads as the overspill or as notes.
    // ------------------------------------------------------------
    function Na__LeRegions__LoadedGroups(region) {
        return ((region && region.Region__Groups) || []).map((id) => Na__LeSpec__GetGroupById(id)).filter(Boolean);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Title a Region Prints When None Was Typed
    // ------------------------------------------------------------
    // A region that lists one group and nothing else is that group's - its
    // title, or its prefix when it has none. One that only takes the overspill
    // continues the margin. Anything else is several things, and says NOTES.
    // ------------------------------------------------------------
    function Na__LeRegions__AutoTitle(region) {
        const setup  = Na__LeCfg__GetMarginNotesSetup();
        const groups = Na__LeRegions__LoadedGroups(region);
        const spill  = !!region && region.Region__Overspill === true;
        if (groups.length === 1 && !spill) return String(groups[0].Group__Title || groups[0].Group__Prefix || setup.regionGroupsTitle);
        if (!groups.length && spill) return setup.regionOverspillTitle;
        return setup.regionGroupsTitle;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Group a Region's Automatic Title Names, or null
    // ------------------------------------------------------------
    // Its group heading would only say the title again directly under it, so
    // it is not printed. A typed title names nothing: the heading stays.
    // ------------------------------------------------------------
    function Na__LeRegions__NamedGroupId(region) {
        const typed = (region && typeof region.Region__Title === 'string') ? region.Region__Title.trim() : '';
        if (typed || !region || region.Region__Overspill === true) return null;
        const groups = Na__LeRegions__LoadedGroups(region);
        return (groups.length === 1) ? groups[0].Group__Id : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Title a Region Prints: the One Typed, Else the Automatic One
    // ------------------------------------------------------------
    function Na__LeRegions__Title(region) {
        const typed = (region && typeof region.Region__Title === 'string') ? region.Region__Title.trim() : '';
        return typed || Na__LeRegions__AutoTitle(region);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | How a Region's Notes Are Laid: the Margin's Rules, Its Own Insets
    // ------------------------------------------------------------
    // RegionPaddingMm on every side, but never more than a quarter of the box
    // across or down - the margin's own guard - so a narrow region keeps room
    // for its words.
    // ------------------------------------------------------------
    function Na__LeRegions__Options(rect, title, settings, namedGroupId) {
        const pad  = Na__LeCfg__GetMarginNotesSetup().regionPaddingMm;
        const side = Math.min(pad, rect.WidthMm / 4);
        const end  = Math.min(pad, rect.HeightMm / 4);
        return { heading : title, padLeft : side, padRight : side, padTop : end, padBottom : end, textSizeMm : settings.TextSizeMm, groupHeadings : settings.GroupHeadings, headingGroupId : namedGroupId };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Where Every Note Goes
// -----------------------------------------------------------------------------

    // FUNCTION | Place a Sheet's Notes: the Margin, Each Region, and What Is Left
    // ------------------------------------------------------------
    // entries  the sheet's list, in order (Na__LeMargin__Entries)
    // margin   { rect, options } to lay the margin with, or null while it is off
    // Returns {
    //   margin     the margin's column plan (Na__LeMarginCol__Lay), or null
    //   marginList the list indices the margin was given, in order
    //   regions    [{ region, id, index, rect, title, overspill, own, list,
    //                 plan, shown, tail, lost, carriedTo }] in the panel's
    //                 order. own: the indices it claimed by group; list: the
    //                 indices it was given to lay; tail: how many of them did
    //                 not fit; lost: how many of those go no further (a tail
    //                 carried on to an overspill region is not lost);
    //                 carriedTo: the overspill region its tail carries on in
    //   marginLost how many of the margin's own tail go no further
    //   lost       every note that had a place and fitted nowhere
    //   unlisted   every note with no place at all: the margin off and no
    //              overspill region
    //   inRegions  how many are printed in a region
    //   spill      the overspill regions, in order }
    // Indices are into entries.
    // ------------------------------------------------------------
    function Na__LeRegions__Place(sheet, layout, entries, margin) {
        const list     = Array.isArray(entries) ? entries : [];
        const settings = Na__LeRec__MarginNotes(sheet);
        const placed   = Na__LeRec__DrawnNoteRegions(sheet).map((region, index) => {
            const rect  = Na__LeRegions__Rect(region, layout);
            const title = Na__LeRegions__Title(region);
            return { region : region, id : region.Region__Id, index : index, rect : rect, title : title, overspill : region.Region__Overspill === true,
                     own : [], list : [], plan : null, shown : 0, tail : 0, lost : 0, carriedTo : null };
        }).filter((entry) => !!entry.rect);

        // CLAIMS | A note whose group a region ticks is the first such region's
        // ------------------------------------
        const rest = [];
        list.forEach((entry, i) => {
            const groupId = (entry && entry.group) ? entry.group.Group__Id : null;
            const owner   = groupId ? placed.find((p) => (p.region.Region__Groups || []).indexOf(groupId) !== -1) : null;
            if (owner) owner.own.push(i); else rest.push(i);
        });
        const spill  = placed.filter((p) => p.overspill);
        const lay    = (p, indices) => {
            p.list  = indices;
            p.plan  = Na__LeMarginCol__Lay(p.rect, indices.map((i) => list[i]), Na__LeRegions__Options(p.rect, p.title, settings, Na__LeRegions__NamedGroupId(p.region)));
            p.shown = p.plan.shown;
            p.tail  = indices.length - p.shown;
            return indices.slice(p.shown);                                     // <-- Exactly what did not fit, still in the order it was given
        };

        // THE MARGIN | Every note no region claims. Off, they wait for the overspill.
        // ------------------------------------
        let pool = [];
        let marginPlan = null;
        if (margin && margin.rect) {
            marginPlan = Na__LeMarginCol__Lay(margin.rect, rest.map((i) => list[i]), margin.options);
            pool = pool.concat(rest.slice(marginPlan.shown));
        } else {
            pool = pool.concat(rest);
        }

        // GROUP REGIONS | Their own groups; what does not fit joins the overspill
        // ------------------------------------
        placed.forEach((p) => { if (!p.overspill) pool = pool.concat(lay(p, p.own)); });

        // THE OVERSPILL CHAIN | Each lists its own groups, then the pool in
        // specification order, and hands on to the next what it could not fit
        // ------------------------------------
        spill.forEach((p, n) => {
            pool.sort((a, b) => a - b);
            pool = lay(p, p.own.concat(pool));
            p.carriedTo = spill[n + 1] || null;
        });

        // WHAT WAS LOST, AND WHERE | With an overspill region, only the last
        // one's tail goes no further; without one, every box keeps its own.
        // ------------------------------------
        const last     = spill.length ? spill[spill.length - 1] : null;
        const marginOn = !!marginPlan;
        placed.forEach((p) => {
            if (p.overspill) p.lost = (p === last) ? p.tail : 0;
            else { p.lost = last ? 0 : p.tail; p.carriedTo = spill.length ? spill[0] : null; }
        });
        const marginLost = (marginOn && !last) ? marginPlan.overflow : 0;
        const lost       = placed.reduce((sum, p) => sum + p.lost, marginLost);
        const unlisted   = (!marginOn && !last) ? rest.length : 0;             // <-- Given no place: counted apart from the lost
        const inRegions  = placed.reduce((sum, p) => sum + p.shown, 0);
        return { margin : marginPlan, marginList : marginOn ? rest : [], regions : placed, marginLost : marginLost, lost : lost, unlisted : unlisted, inRegions : inRegions, spill : spill };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Drawing
// -----------------------------------------------------------------------------

    // FUNCTION | Push Every Placed Region as Primitives: Paper, Border Lines, Rules, Text
    // ------------------------------------------------------------
    // place is what Place returned. The paper masks whatever is under the
    // region, as the margin's does; the border lines are the margin divider's
    // line, and all four together are one outlined box, so its corners meet.
    // ------------------------------------------------------------
    function Na__LeRegions__Push(list, place) {
        if (!list || !place || !place.regions || !place.regions.length) return list;
        const setup     = Na__LeCfg__GetMarginNotesSetup();
        const style     = Na__LeCfg__GetStyleSetup();
        const family    = Na__LeCfg__GetTextSetup().fontFamily;
        const lineMm    = Na__LeCfg__PtToMm(setup.dividerPt);
        const ruleMm    = Na__LeCfg__PtToMm(setup.rulePt);
        place.regions.forEach((p) => {
            const r = p.rect;
            const b = p.region.Region__Borders || {};
            const all = lineMm > 0 && b.Top && b.Right && b.Bottom && b.Left;
            Na__LeChrome__PushRect(list, r.X, r.Y, r.WidthMm, r.HeightMm, all ? style.inkColour : null, all ? lineMm : 0, style.paperColour);
            if (!all && lineMm > 0) {
                const x0 = r.X, y0 = r.Y, x1 = r.X + r.WidthMm, y1 = r.Y + r.HeightMm;
                if (b.Top)    Na__LeChrome__PushLine(list, x0, y0, x1, y0, style.inkColour, lineMm);
                if (b.Right)  Na__LeChrome__PushLine(list, x1, y0, x1, y1, style.inkColour, lineMm);
                if (b.Bottom) Na__LeChrome__PushLine(list, x0, y1, x1, y1, style.inkColour, lineMm);
                if (b.Left)   Na__LeChrome__PushLine(list, x0, y0, x0, y1, style.inkColour, lineMm);
            }
            if (ruleMm > 0) (p.plan.rules || []).forEach((rule) => Na__LeChrome__PushLine(list, rule.X1, rule.Y1, rule.X2, rule.Y2, setup.ruleColour || '#cfd4d8', ruleMm));
            p.plan.runs.forEach((run) => {
                Na__LeChrome__PushText(list, {
                    X : run.x, BaselineY : run.baselineY, Text : run.text, FontMm : run.fontMm, Weight : run.weight,
                    Colour : run.colour, Align : 'left', FontFamily : family, TrackingMm : run.trackingMm
                });
            });
        });
        return list;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Overspill Note Regions API
    // ------------------------------------------------------------
    export {
        Na__LeRegions__Rect,
        Na__LeRegions__AutoTitle,
        Na__LeRegions__Title,
        Na__LeRegions__Place,
        Na__LeRegions__Push
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
