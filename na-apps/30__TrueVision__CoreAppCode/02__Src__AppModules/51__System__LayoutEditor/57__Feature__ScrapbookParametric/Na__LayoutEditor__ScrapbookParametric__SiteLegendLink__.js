// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PARAMETRIC SCRAPBOOK - SITE PLAN LEGEND LINK
// =============================================================================
//
// FILE       : Na__LayoutEditor__ScrapbookParametric__SiteLegendLink__.js
// NAMESPACE  : Na__LeParamLegendLink
// MODULE     : Layout Editor - Parametric Scrapbook - Site Plan Legend Link
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : What keeps a site plan legend telling the truth - the sheet's site plans read layer by layer and handed to the legend, a legend that has just landed filled in, and every legend rebuilt the moment what the drawings show changes
// CREATED    : 29-Sep-2026
//
// DESCRIPTION:
// - THE LEGEND IS PURE AND THIS IS WHAT FEEDS IT. The Site Plan Legend
//   element knows how to DRAW a legend and nothing about sheets; this module
//   reads the sheet's site plan viewports and hands what they show over as
//   the `Data` parameter - the "facts are parameters" idiom of the Drawing
//   Title and the Area Schedule. It is the only part of the legend that knows
//   what a site plan viewport is, as ViewportLink is for the other elements.
// - WHAT IS LISTED IS WHAT IS PAINTED. Each viewport is asked through
//   Na__LeVp2d__SitePlanLegend, which reads the painter's own build: a layer
//   switched off, a deck turned off, a location plan's greyed ink and its
//   missing hatches, a colour or a pattern overridden on that viewport, and a
//   layer with nothing inside the frame are all exactly as the drawing has
//   them. Several site plans on one sheet are read together, the most
//   detailed first, and a layer two of them show is listed once - but a
//   LOCATION plan only when the sheet has nothing else: it greys every layer
//   bar the red line and the proposal, which is not how the block plan beside
//   it draws them.
// - THE TOP OF THE DRAWING FIRST. Rows run in the reverse of the layers' draw
//   order, so the red line and the proposal lead and the base map comes last
//   - the order the eye finds them in.
// - IT RUNS BEFORE THE ANNOUNCEMENT, NEVER AFTER IT
//   (Na__LeModel__RegisterBeforeAnnounce). A layer switched off, a viewport
//   cropped, a legend dropped: the change is still silent when this runs, so
//   the rebuilt legend rides out on the SAME announcement and one Ctrl+Z puts
//   both back.
// - NOTHING IS REBUILT WHILE ANYTHING IS STILL LOADING. The site plan data
//   and the hatch library arrive after the sheet does; until every layer a
//   viewport shows is in, the legend is left exactly as it is and a refresh
//   is booked for when they land. A half-loaded read would write a legend
//   missing rows, then write it again - two changes nobody made.
// - A RESTORE IS NEVER FOLLOWED: the model runs no hooks for an undo or a
//   redo, and the snapshot already holds the legend as it was.
//
// INTEGRATION:
// - Attached once by Na__LayoutEditor__Panel__ScrapbookParametric__'s
//   wiring, beside the viewport link.
// // @delegate: ./Na__LayoutEditor__ScrapbookParametric__.js
// // @delegate: ../20__System__Viewports/Na__LayoutEditor__Viewport2d__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (29-Sep-2026)
// - ValeVision    : not ported - ValeVision has no site plan drawings.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 29-Sep-2026 - Version 1.0.0
// - Initial implementation: the data, the insert's adoption, the hook, the
//   wake and the waits for the site plan data and the hatch library.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Model, Surface, Panels, the Engine, the Legend and the Site Plan
    // ------------------------------------------------------------
    import {
        Na__LeModel__CHANGED_EVENT,
        Na__LeModel__RegisterBeforeAnnounce,
        Na__LeModel__GetActiveSheet,
        Na__LeModel__GetSheetById,
        Na__LeModel__GetViewports,
        Na__LeModel__IsSitePlanViewport,
        Na__LeModel__MarkDirty
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__Refresh } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LePanels__IsEditable } from '../40__Ui__Panels/Na__LayoutEditor__PanelHost__.js';
    import {
        Na__LeParam__GetBlock,
        Na__LeParam__GetType,
        Na__LeParam__GetParams,
        Na__LeParam__ListOnSheet,
        Na__LeParam__Announce,
        Na__LeParam__Regenerate
    } from './Na__LayoutEditor__ScrapbookParametric__.js';
    import {
        Na__LeParamLegend__TYPE,
        Na__LeParamLegend__KIND_AREA,
        Na__LeParamLegend__KIND_LINE
    } from './Na__LayoutEditor__ScrapbookParametric__SiteLegend__.js';
    import { Na__LeVp2d__SitePlanLegend, Na__LeVp2d__SitePlanStoreId } from '../20__System__Viewports/Na__LayoutEditor__Viewport2d__.js';
    import {
        Na__SpStore__CHANGED_EVENT,
        Na__SpStore__STATUS_READY,
        Na__SpStore__STATUS_EMPTY,
        Na__SpStore__Resolve,
        Na__SpStore__LoadAll,
        Na__SpStore__GetStatus,
        Na__SpStore__GetDescriptor
    } from '../21__System__SitePlanData/Na__SitePlan__Store__.js';
    import { Na__LeHatch__Ready, Na__LeHatch__IsLoaded } from '../36__System__HatchPatternTools/Na__LayoutEditor__HatchPatterns__.js';
    import { Na__LeSpComp__PLAN_LOCAL, Na__LeSpComp__PlanType } from '../25__System__RenderStyles/Na__LayoutEditor__SitePlanComposites__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | What Can Change What a Legend Says
    // ------------------------------------------------------------
    // 'viewport' and 'viewports' carry everything a site plan can change - a
    // layer switched off, a deck, a colour, a pattern, a crop, a move, a new
    // scale - and 'sheet-updated' the sheet's line weights. The rest are here
    // for the drop: a legend lands through the item clipboard, whose one
    // announcement is its LAST leaf's - a text, for a legend, whose labels
    // are built after its swatches - and is filled in inside it. A legend on
    // a sheet with none of these costs a list and stops.
    // ------------------------------------------------------------
    const Na__LeParamLegendLink__REASONS = Object.freeze([ 'viewport', 'viewports', 'sheet-updated', 'layers', 'shape', 'shapes', 'annotation', 'annotations', 'group', 'groups' ]);
    const Na__LeParamLegendLink__WAKE    = Object.freeze([ 'active', 'loaded' ]);   // <-- A sheet comes up: its legends are checked against site plans that may have changed while it was away
    // ------------------------------------------------------------

    // MODULE VARIABLES | Listening, Guards and What Has Settled
    // ------------------------------------------------------------
    let Na__LeParamLegendLink__Attached = false;
    let Na__LeParamLegendLink__Working  = false;
    let Na__LeParamLegendLink__Waking   = false;
    const Na__LeParamLegendLink__Settled = new Set();                           // <-- 'storeId|exportedIso' whose every layer has loaded or failed
    const Na__LeParamLegendLink__Asked   = new Set();                           // <-- The same, asked for and not yet back
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | What the Sheet's Site Plans Show
// -----------------------------------------------------------------------------

    // FUNCTION | The Site Plan Viewports a Legend Reads, the Most Detailed First
    // ------------------------------------------------------------
    // The one the legend is set to, while it is still there; otherwise every
    // site plan on the sheet BUT ITS LOCATION PLANS, unless location plans are
    // all it has. A location plan greys everything but the red line and the
    // proposal, and leaves the patterns off: read beside the block plan it
    // would add a grey line for every layer - and a layer switched off on the
    // block plan would stay listed in its greyed location-plan look, which is
    // not how the drawing the legend stands beside shows it (found on RB05's
    // proposed site plan, one block plan and two location plans, 29-Sep-2026).
    // A viewport since deleted reads as the whole sheet, rather than a legend
    // that suddenly says nothing.
    // ------------------------------------------------------------
    function Na__LeParamLegendLink__Viewports(sheet, viewportId) {
        const all = Na__LeParamLegendLink__AllSitePlans(sheet);
        if (viewportId) {
            const one = all.filter((viewport) => viewport.Viewport__Id === viewportId);
            if (one.length) return one;
        }
        const detailed = all.filter((viewport) => Na__LeSpComp__PlanType(viewport) !== Na__LeSpComp__PLAN_LOCAL);
        return detailed.length ? detailed : all;
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Site Plan Viewport on a Sheet, the Most Detailed First
    // ------------------------------------------------------------
    // Location plans included: what the panel's Reads list offers.
    // ------------------------------------------------------------
    function Na__LeParamLegendLink__AllSitePlans(sheet) {
        const all  = sheet ? Na__LeModel__GetViewports(sheet).filter((viewport) => Na__LeModel__IsSitePlanViewport(viewport)) : [];
        const area = (viewport) => (viewport.Viewport__FrameMm ? viewport.Viewport__FrameMm.WidthMm * viewport.Viewport__FrameMm.HeightMm : 0);
        return all.slice().sort((a, b) => ((a.Viewport__ScaleDenominator || 0) - (b.Viewport__ScaleDenominator || 0))
                                       || (area(b) - area(a))
                                       || String(a.Viewport__Id).localeCompare(String(b.Viewport__Id)));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Viewport's Layers, or Null While Any Are Still Loading
    // ------------------------------------------------------------
    // Asks with every layer in first. Once a store has settled - every layer
    // loaded or failed - a failed one is left out rather than waited for
    // forever. The first time a store is found short, all of it is asked for
    // and a refresh is booked for when it has settled.
    // ------------------------------------------------------------
    function Na__LeParamLegendLink__EntriesOf(sheet, viewport) {
        const whole = Na__LeVp2d__SitePlanLegend(sheet, viewport, false);
        if (whole) return whole;
        const storeId    = Na__LeVp2d__SitePlanStoreId(viewport);
        const descriptor = Na__SpStore__GetDescriptor(storeId);
        const token      = storeId + '|' + (descriptor ? descriptor.SitePlan__ExportedIso : '');
        if (Na__LeParamLegendLink__Settled.has(token)) return Na__LeVp2d__SitePlanLegend(sheet, viewport, true);
        if (!Na__LeParamLegendLink__Asked.has(token)) {
            Na__LeParamLegendLink__Asked.add(token);
            Na__SpStore__LoadAll(storeId).then(() => {
                Na__LeParamLegendLink__Asked.delete(token);
                Na__LeParamLegendLink__Settled.add(token);
                Na__LeParamLegendLink__BookRefresh();
            });
        }
        return null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Viewport's Layer as the Row a Legend Stores
    // ------------------------------------------------------------
    // Keyed by the layer's STEM, not its store, so the same layer shown by an
    // existing and a proposed site plan is one row.
    // ------------------------------------------------------------
    function Na__LeParamLegendLink__Row(entry) {
        const line = entry.line ? { Hex : entry.line.colour, WidthMm : entry.line.widthMm, DashMm : entry.line.dashMm } : null;
        if (!entry.area) return { Key : entry.stem, Label : entry.label, Kind : Na__LeParamLegend__KIND_LINE, Line : line };
        const row = { Key : entry.stem, Label : entry.label, Kind : Na__LeParamLegend__KIND_AREA };
        if (entry.fill) row.Fill = { Hex : entry.fill.hex, Opacity : entry.fill.opacity };
        if (entry.pattern) {
            row.Hatch = { Key : entry.pattern.key, Scale : entry.pattern.scale, RotationDeg : entry.pattern.rotationDeg, Colour : entry.pattern.colour };
            if (Number.isFinite(entry.pattern.strokePt)) row.Hatch.StrokePt = entry.pattern.strokePt;
        }
        if (line) row.Line = line;
        return row;
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Legend on This Sheet Should List, or Null Until It Can Be Known
    // ------------------------------------------------------------
    // { Rows, Sources } in the shape the legend stores: every layer the sheet's
    // site plans show inside their frames - whatever a legend has chosen to
    // hide, which is the LEGEND'S decision, made when it is drawn, so the list
    // it offers to put back stays whole. Null while the site plan data or the
    // hatch library are still arriving; a refresh is booked for then.
    // ------------------------------------------------------------
    function Na__LeParamLegendLink__DataFor(sheet, viewportId) {
        if (!sheet) return null;
        const viewports = Na__LeParamLegendLink__Viewports(sheet, viewportId);
        if (viewports.length && !Na__LeHatch__IsLoaded()) {
            Na__LeHatch__Ready().then(() => Na__LeParamLegendLink__BookRefresh());   // <-- A pattern named before the library is in reads as no pattern
            return null;
        }
        const byStem  = new Map();
        let   sources = 0;
        for (let i = 0; i < viewports.length; i++) {
            const storeId = Na__LeVp2d__SitePlanStoreId(viewports[i]);
            const status  = Na__SpStore__GetStatus(storeId);
            if (status === Na__SpStore__STATUS_EMPTY) continue;                 // <-- A store with no data draws nothing and lists nothing
            if (status !== Na__SpStore__STATUS_READY) {
                Na__SpStore__Resolve(storeId).then(() => Na__LeParamLegendLink__BookRefresh());
                return null;
            }
            const entries = Na__LeParamLegendLink__EntriesOf(sheet, viewports[i]);
            if (!entries) return null;
            if (entries.length) sources++;
            entries.forEach((entry) => { if (!byStem.has(entry.stem)) byStem.set(entry.stem, entry); });   // <-- The most detailed drawing's look wins
        }
        const rows = Array.from(byStem.values())
            .sort((a, b) => (b.drawOrder - a.drawOrder) || String(a.label).localeCompare(String(b.label)))
            .map((entry) => Na__LeParamLegendLink__Row(entry));
        return { Rows : rows, Sources : sources };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Every Site Plan Legend on a Sheet
    // ------------------------------------------------------------
    function Na__LeParamLegendLink__ListOnSheet(sheet) {
        return Na__LeParam__ListOnSheet(sheet).filter((group) => {
            const block = Na__LeParam__GetBlock(group);
            return !!block && block.Parametric__Type === Na__LeParamLegend__TYPE;
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Keeping Them True
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Bring Every Legend on a Sheet Up to Date
    // ------------------------------------------------------------
    // Silent throughout; returns the group ids of the legends that changed.
    // COMPARED THROUGH THE TYPE'S OWN NORMALISER, never raw against stored:
    // what a legend holds has been through it and a fresh reading has not,
    // and the two would differ by key order alone - rebuilding every legend
    // on every announcement and marking the drawing dirty for nothing (the
    // Area Schedule's lesson). A legend whose data cannot be known yet is
    // left exactly as it is.
    // ------------------------------------------------------------
    function Na__LeParamLegendLink__Follow(sheet) {
        const legends = Na__LeParamLegendLink__ListOnSheet(sheet);
        if (!legends.length) return [];
        const definition = Na__LeParam__GetType(Na__LeParamLegend__TYPE);
        const read       = new Map();                                           // <-- Each viewport choice read once, on first asking
        const wantFor    = (viewportId) => {
            if (!read.has(viewportId)) {
                const fresh = Na__LeParamLegendLink__DataFor(sheet, viewportId);
                const data  = (fresh && definition && typeof definition.normalise === 'function') ? definition.normalise({ Data : fresh }).Data : fresh;
                read.set(viewportId, data ? { data : data, json : JSON.stringify(data) } : null);
            }
            return read.get(viewportId);
        };
        const changed = [];
        legends.forEach((group) => {
            const params = Na__LeParam__GetParams(sheet, group.Group__Id);
            if (!params) return;
            const wanted = wantFor(params.ViewportId || '');
            if (!wanted || JSON.stringify(params.Data) === wanted.json) return;  // <-- Not known yet, or nothing has moved: leave every record alone
            if (Na__LeParam__Regenerate(sheet, group.Group__Id, { Data : wanted.data }, { silent : true })) changed.push(group.Group__Id);
        });
        return changed;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Change Is About to Be Announced
    // ------------------------------------------------------------
    // Silent edits only, and nothing is announced from here: the announcement
    // this runs ahead of carries the work, so the history's one snapshot holds
    // the site plan AND the legend that describes it.
    // ------------------------------------------------------------
    function Na__LeParamLegendLink__BeforeAnnounce(reason, sheetId) {
        if (Na__LeParamLegendLink__Working) return;
        if (Na__LeParamLegendLink__REASONS.indexOf(reason) === -1) return;
        const sheet = Na__LeModel__GetSheetById(sheetId);
        if (!sheet || !Na__LePanels__IsEditable()) return;
        Na__LeParamLegendLink__Working = true;
        try {
            if (Na__LeParamLegendLink__Follow(sheet).length) { Na__LeModel__MarkDirty(); Na__LeSurface__Refresh('markup'); }
        } catch (error) {
            console.warn('[TrueVision3D LayoutEditor] A site plan legend could not be brought up to date.', error);
        } finally {
            Na__LeParamLegendLink__Working = false;
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Bring a Sheet's Legends Into Line Now (one undo step when anything moved)
    // ------------------------------------------------------------
    // For the case with no announcement to run ahead of: a sheet opened whose
    // legends were saved before a new export, or the site plan data and the
    // hatch library arriving after the sheet did. It makes its own
    // announcement, through the last legend it rebuilt.
    // ------------------------------------------------------------
    function Na__LeParamLegendLink__Refresh(sheet) {
        if (!sheet || Na__LeParamLegendLink__Working) return 0;
        Na__LeParamLegendLink__Working = true;
        try {
            const rebuilt = Na__LeParamLegendLink__Follow(sheet);
            if (!rebuilt.length) return 0;
            Na__LeModel__MarkDirty();
            Na__LeSurface__Refresh('markup');
            Na__LeParam__Announce(sheet, rebuilt[rebuilt.length - 1]);
            return rebuilt.length;
        } catch (error) {
            console.warn('[TrueVision3D LayoutEditor] Site plan legends could not be refreshed.', error);
            return 0;
        } finally {
            Na__LeParamLegendLink__Working = false;
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Book a Refresh of the Active Sheet, Once the Present Announcement Is Over
    // ------------------------------------------------------------
    // Never from inside the event that asked for it: a refresh announces, and
    // an announcement inside an announcement reaches later listeners out of
    // order. Editable sessions only - a reader's copy says what was saved.
    // ------------------------------------------------------------
    function Na__LeParamLegendLink__BookRefresh() {
        if (Na__LeParamLegendLink__Waking) return;
        Na__LeParamLegendLink__Waking = true;
        window.setTimeout(() => {
            Na__LeParamLegendLink__Waking = false;
            const sheet = Na__LePanels__IsEditable() ? Na__LeModel__GetActiveSheet() : null;
            if (sheet && Na__LeParamLegendLink__ListOnSheet(sheet).length) Na__LeParamLegendLink__Refresh(sheet);
        }, 0);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Site Plan Data Changed Under the Sheet
    // ------------------------------------------------------------
    // A layer finishing its load, a store settling, a new export read by a
    // reload: what the drawings show may have moved with no sheet changing. A
    // store reloaded under a new export time settles afresh, which is what
    // the token's export time is for.
    // ------------------------------------------------------------
    function Na__LeParamLegendLink__OnStoreChanged() {
        Na__LeParamLegendLink__BookRefresh();
    }
    function Na__LeParamLegendLink__OnModelChanged(event) {
        const reason = (event && event.detail) ? event.detail.reason : '';
        if (Na__LeParamLegendLink__WAKE.indexOf(reason) !== -1) Na__LeParamLegendLink__BookRefresh();
    }
    // ------------------------------------------------------------


    // FUNCTION | Start Keeping Legends True (once)
    // ------------------------------------------------------------
    function Na__LeParamLegendLink__Attach() {
        if (Na__LeParamLegendLink__Attached) return false;
        Na__LeParamLegendLink__Attached = true;
        window.addEventListener(Na__LeModel__CHANGED_EVENT, Na__LeParamLegendLink__OnModelChanged);
        window.addEventListener(Na__SpStore__CHANGED_EVENT, Na__LeParamLegendLink__OnStoreChanged);
        return Na__LeModel__RegisterBeforeAnnounce(Na__LeParamLegendLink__BeforeAnnounce);   // <-- Ahead of every listener, the history's included, by construction rather than by order
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Site Plan Legend Link API
    // ------------------------------------------------------------
    export {
        Na__LeParamLegendLink__Viewports,
        Na__LeParamLegendLink__AllSitePlans,
        Na__LeParamLegendLink__DataFor,
        Na__LeParamLegendLink__ListOnSheet,
        Na__LeParamLegendLink__Follow,
        Na__LeParamLegendLink__Refresh,
        Na__LeParamLegendLink__BookRefresh,
        Na__LeParamLegendLink__Attach
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
