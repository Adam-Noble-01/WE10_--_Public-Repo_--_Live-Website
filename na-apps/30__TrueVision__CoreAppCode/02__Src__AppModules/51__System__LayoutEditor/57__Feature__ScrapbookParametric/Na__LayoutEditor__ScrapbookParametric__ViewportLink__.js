// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PARAMETRIC SCRAPBOOK - VIEWPORT LINK
// =============================================================================
//
// FILE       : Na__LayoutEditor__ScrapbookParametric__ViewportLink__.js
// NAMESPACE  : Na__LeParamLink
// MODULE     : Layout Editor - Parametric Scrapbook - Viewport Link
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The link between a parametric element and the viewport it describes: which viewport, what scale, and following that scale when it changes
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - THE ONLY PARAMETRIC MODULE THAT KNOWS WHAT A VIEWPORT IS. The engine
//   stores Parametric__Link on the block and never reads inside it; an
//   element type never sees it at all. Everything about viewports - finding
//   the nearest, reading its scale, noticing it change, noticing it go - is
//   here, so the day the viewport system changes this is the one file that
//   has to.
// - A LINK NAMES A SHEET AND A VIEWPORT:
//       Parametric__Link : { Link__SheetId, Link__ViewportId }
//   Viewport ids are only unique on their own sheet, and Viewport_001 exists
//   on nearly every sheet there is. A link whose sheet is not the sheet the
//   element is on - a paste to another sheet, a Custom Scrapbook item dropped
//   in another project - is BROKEN, and a broken link reads as no link: the
//   element keeps the scale it had and the panel says Not linked. It is
//   never silently re-pointed at another sheet's Viewport_001.
// - NEAREST. A dropped element links to the 2D viewport whose frame is
//   nearest the drop point, inside ViewportLink MaxLinkDistanceMm. A scale
//   bar goes under a drawing's title, which goes under the drawing, so the
//   frame is usually 10 to 30 mm above it.
// - FOLLOW. When a linked viewport's scale changes the element is put back
//   to its standard at the new scale, silently, BEFORE the change is
//   announced (the model's RegisterBeforeAnnounce). So the one announcement,
//   and the history's one snapshot of it, already hold the new scale AND the
//   new bar: one Ctrl+Z puts both back, and one Ctrl+Y brings both forward.
// - NOT A LISTENER, AND IT CANNOT BE ONE. The first version heard the change
//   event in the capture phase, to run ahead of the history. It did not: the
//   event is dispatched ON window, and an event whose target is window calls
//   its listeners in the order they were added, whatever their phase. The
//   history is added first, so it had snapshotted the OLD bar before the bar
//   was rebuilt. Undo looked right; redo brought back a stale bar beside a
//   viewport at its new scale. Found by testing redo, 19-Sep-2026.
// - A RESTORE IS NEVER FOLLOWED. An undo or a redo puts a whole sheet back,
//   bar and scale alike; rebuilding on top of it would make a new step out of
//   every undo and nothing could ever be undone past it.
// - ADOPT, THE SAME WAY. A Custom Scrapbook item that holds a scale bar was
//   saved with its link removed, and lands beside a drawing it should now
//   read. InsertAdopting runs the drop and links what it brought in just
//   before the drop announces itself, by the same before-announce route, so
//   the drop and the re-link are one undo step. Linking after the drop had
//   returned made two: the history had already taken the drop by then.
//
// INTEGRATION:
// - Na__LayoutEditor__Panel__ScrapbookParametric__ calls Attach once, drops
//   elements through InsertLinked and edits links through SetLink.
// - Na__LayoutEditor__ScrapbookParametric__Grips__ reads and sets links from
//   the lookup grip's menu.
// // @delegate: ./Na__LayoutEditor__ScrapbookParametric__.js
// // @delegate: ../07__Core__SheetData/Na__LayoutEditor__DrawingScale__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (19-Sep-2026)
// - ValeVision    : not yet ported; see Na__LayoutEditor__ScrapbookParametric__.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation: Nearest, Resolve, DenominatorFor, SetLink,
//   InsertLinked, InsertAdopting and the scale follower.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Model, Drawing Scale, Surface and the Engine
    // ------------------------------------------------------------
    import {
        Na__LeModel__RegisterBeforeAnnounce,
        Na__LeModel__KIND_2D,
        Na__LeModel__GetSheetById,
        Na__LeModel__GetGroupById,
        Na__LeModel__GetViewportById,
        Na__LeModel__IsLayerVisible,
        Na__LeModel__MarkDirty
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeDrawScale__SheetDenominator, Na__LeDrawScale__Label } from '../07__Core__SheetData/Na__LayoutEditor__DrawingScale__.js';
    import { Na__LeSurface__Refresh } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeGroup__Bounds } from '../15__Core__Markup/Na__LayoutEditor__Groups__.js';
    import {
        Na__LeParam__FIELD,
        Na__LeParam__Block,
        Na__LeParam__Label,
        Na__LeParam__GetBlock,
        Na__LeParam__GetBlockById,
        Na__LeParam__GetParams,
        Na__LeParam__ListOnSheet,
        Na__LeParam__Insert,
        Na__LeParam__Announce,
        Na__LeParam__ResetToStandard
    } from './Na__LayoutEditor__ScrapbookParametric__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Announcements That Can Change or Remove a Viewport
    // ------------------------------------------------------------
    const Na__LeParamLink__FOLLOW_REASONS  = Object.freeze([ 'viewport', 'viewports' ]);
    const Na__LeParamLink__MAX_DISTANCE_MM = 80;                                // <-- When the config gives none
    // ------------------------------------------------------------

    // MODULE VARIABLES | Listening, and the Guard Against Hearing Itself
    // ------------------------------------------------------------
    let Na__LeParamLink__Attached  = false;
    let Na__LeParamLink__Following = false;
    let Na__LeParamLink__Adopting  = null;     // <-- { sheetId, known, heard } while InsertAdopting is running a drop
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Viewports
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Link Settings
    // ------------------------------------------------------------
    function Na__LeParamLink__Setup() {
        const block = Na__LeParam__Block('ViewportLink');
        const reach = block.ViewportLink__MaxLinkDistanceMm;
        return {
            autoLink    : block.ViewportLink__AutoLinkOnInsert !== false,
            followScale : block.ViewportLink__FollowScale !== false,
            maxDistance : (typeof reach === 'number' && Number.isFinite(reach) && reach >= 0) ? reach : Na__LeParamLink__MAX_DISTANCE_MM
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is a Viewport One an Element Can Take a Scale From
    // ------------------------------------------------------------
    // A 2D one with a scale. A 3D picture has no scale to read.
    // ------------------------------------------------------------
    function Na__LeParamLink__IsScaled(viewport) {
        return !!viewport && viewport.Viewport__Kind === Na__LeModel__KIND_2D && Number.isFinite(viewport.Viewport__ScaleDenominator) && viewport.Viewport__ScaleDenominator > 0;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Viewports on a Sheet an Element Can Link To
    // ------------------------------------------------------------
    function Na__LeParamLink__Candidates(sheet) {
        return (sheet && Array.isArray(sheet.Sheet__Viewports) ? sheet.Sheet__Viewports : []).filter(Na__LeParamLink__IsScaled);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | How Far a Paper Point Is From a Viewport's Frame (zero inside it)
    // ------------------------------------------------------------
    function Na__LeParamLink__DistanceTo(viewport, pointMm) {
        const frame = viewport.Viewport__FrameMm || {};
        const dx = Math.max(frame.X - pointMm.x, 0, pointMm.x - (frame.X + frame.WidthMm));
        const dy = Math.max(frame.Y - pointMm.y, 0, pointMm.y - (frame.Y + frame.HeightMm));
        return Math.hypot(dx, dy);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Linkable Viewport Nearest a Paper Point, or Null
    // ------------------------------------------------------------
    // Shown viewports only: nobody means to link to a drawing they cannot
    // see. maxDistanceMm defaults to the config's; pass Infinity to take the
    // nearest however far it is, which is what Link to nearest does.
    // ------------------------------------------------------------
    function Na__LeParamLink__Nearest(sheet, pointMm, maxDistanceMm) {
        if (!sheet || !pointMm || !Number.isFinite(pointMm.x) || !Number.isFinite(pointMm.y)) return null;
        const reach = (maxDistanceMm === undefined) ? Na__LeParamLink__Setup().maxDistance : maxDistanceMm;
        let best = null, bestGap = Infinity;
        Na__LeParamLink__Candidates(sheet).forEach((viewport) => {
            if (!Na__LeModel__IsLayerVisible(sheet, viewport.Viewport__LayerId)) return;
            const gap = Na__LeParamLink__DistanceTo(viewport, pointMm);
            if (gap <= reach && gap < bestGap) { best = viewport; bestGap = gap; }
        });
        return best;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Viewport's Name as the Panel and the Toasts Write It
    // ------------------------------------------------------------
    function Na__LeParamLink__ViewportName(viewport) {
        if (!viewport) return '';
        const name = (typeof viewport.Viewport__Name === 'string') ? viewport.Viewport__Name.trim() : '';
        const base = name !== '' ? name : Na__LeParam__Label('ViewportUnnamed', 'Viewport {id}', { id : String(viewport.Viewport__Id).replace(/^Viewport_0*/, '') });
        return base + ' (' + Na__LeDrawScale__Label(viewport.Viewport__ScaleDenominator) + ')';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Links
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Link to a Viewport on a Sheet
    // ------------------------------------------------------------
    function Na__LeParamLink__Make(sheet, viewport) {
        return (sheet && viewport) ? { Link__SheetId : sheet.Sheet__Id, Link__ViewportId : viewport.Viewport__Id } : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Viewport a Block Is Linked To, or Null
    // ------------------------------------------------------------
    // Null for no link, for a link to another sheet, for a viewport that has
    // been deleted, and for one that has since been made 3D.
    // ------------------------------------------------------------
    function Na__LeParamLink__Resolve(sheet, block) {
        const link = block ? block.Parametric__Link : null;
        if (!sheet || !link || typeof link !== 'object') return null;
        if (link.Link__SheetId !== sheet.Sheet__Id || typeof link.Link__ViewportId !== 'string') return null;
        const viewport = Na__LeModel__GetViewportById(sheet, link.Link__ViewportId);
        return Na__LeParamLink__IsScaled(viewport) ? viewport : null;
    }
    function Na__LeParamLink__ResolveById(sheet, groupId) {
        return Na__LeParamLink__Resolve(sheet, Na__LeParam__GetBlockById(sheet, groupId));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Middle of an Element's Box, Where a Link Is Measured From
    // ------------------------------------------------------------
    function Na__LeParamLink__CentreOf(sheet, groupId) {
        const box = Na__LeGroup__Bounds(sheet, groupId);
        return box ? { x : box.X + (box.WidthMm / 2), y : box.Y + (box.HeightMm / 2) } : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Link an Element to a Viewport, or Unlink It (one undo step)
    // ------------------------------------------------------------
    // viewportId null unlinks: the element keeps the scale it has and stops
    // following anything. Linking puts it to its standard at the viewport's
    // scale when that differs from its own, and otherwise only records the
    // link. Returns the viewport now linked, or null.
    // ------------------------------------------------------------
    function Na__LeParamLink__SetLink(sheet, groupId, viewportId) {
        const group = sheet ? Na__LeModel__GetGroupById(sheet, groupId) : null;
        const block = Na__LeParam__GetBlock(group);
        if (!block) return null;
        const viewport = viewportId ? Na__LeModel__GetViewportById(sheet, viewportId) : null;
        const target   = Na__LeParamLink__IsScaled(viewport) ? viewport : null;
        const link     = Na__LeParamLink__Make(sheet, target);
        const params   = Na__LeParam__GetParams(sheet, groupId) || {};
        if (target && target.Viewport__ScaleDenominator !== params.ScaleDenominator) {
            Na__LeParam__ResetToStandard(sheet, groupId, target.Viewport__ScaleDenominator, { link : link });
            return target;
        }
        group[Na__LeParam__FIELD] = Object.assign({}, block, { Parametric__Link : link });
        Na__LeModel__MarkDirty();
        Na__LeParam__Announce(sheet, groupId);                                  // <-- The link is part of the sheet, so making one is a step like any other
        return target;
    }
    // ------------------------------------------------------------


    // FUNCTION | Link an Element to the Viewport Nearest It, However Far (one undo step)
    // ------------------------------------------------------------
    function Na__LeParamLink__LinkNearest(sheet, groupId) {
        const centre   = Na__LeParamLink__CentreOf(sheet, groupId);
        const viewport = centre ? Na__LeParamLink__Nearest(sheet, centre, Infinity) : null;
        return viewport ? Na__LeParamLink__SetLink(sheet, groupId, viewport.Viewport__Id) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Scale an Element Should Be Drawn At
    // ------------------------------------------------------------
    // Its viewport's while it is linked, else its own.
    // ------------------------------------------------------------
    function Na__LeParamLink__DenominatorFor(sheet, groupId) {
        const viewport = Na__LeParamLink__ResolveById(sheet, groupId);
        if (viewport) return viewport.Viewport__ScaleDenominator;
        const params = Na__LeParam__GetParams(sheet, groupId);
        return params ? params.ScaleDenominator : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Dropping an Element
// -----------------------------------------------------------------------------

    // FUNCTION | Drop an Element, Linked to the Viewport Nearest the Drop
    // ------------------------------------------------------------
    // The scale is the linked viewport's. With no viewport near enough - or
    // with AutoLinkOnInsert off - it is the scale at the drop point: the
    // sheet's own, the one the title block quotes. One undo step; the
    // element is selected. Returns the selected roots, or null.
    // ------------------------------------------------------------
    function Na__LeParamLink__InsertLinked(sheet, type, centreMm) {
        if (!sheet || !centreMm) return null;
        const viewport    = Na__LeParamLink__Setup().autoLink ? Na__LeParamLink__Nearest(sheet, centreMm) : null;
        const denominator = viewport ? viewport.Viewport__ScaleDenominator : Na__LeDrawScale__SheetDenominator(sheet);
        return Na__LeParam__Insert(sheet, type, centreMm, { ScaleDenominator : denominator }, Na__LeParamLink__Make(sheet, viewport));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Link the Parametric Groups a Sheet Has Gained, to the Viewports They Are Beside
    // ------------------------------------------------------------
    // known is the set of group ids the sheet held before. A new group that
    // is parametric and has no live link takes the viewport nearest it: the
    // link, and that viewport's scale where it differs. Silent throughout, and
    // nothing is announced - the caller is inside an announcement already, or
    // makes one. Returns the ids of the groups it linked.
    // ------------------------------------------------------------
    function Na__LeParamLink__AdoptNew(sheet, known) {
        const linked = [];
        if (!sheet || !Na__LeParamLink__Setup().autoLink) return linked;
        Na__LeParam__ListOnSheet(sheet).forEach((group) => {
            if (known.has(group.Group__Id)) return;
            const block = Na__LeParam__GetBlock(group);
            if (!block || Na__LeParamLink__Resolve(sheet, block)) return;
            const centre   = Na__LeParamLink__CentreOf(sheet, group.Group__Id);
            const viewport = centre ? Na__LeParamLink__Nearest(sheet, centre) : null;
            if (!viewport) return;
            const link   = Na__LeParamLink__Make(sheet, viewport);
            const params = Na__LeParam__GetParams(sheet, group.Group__Id) || {};
            if (viewport.Viewport__ScaleDenominator !== params.ScaleDenominator) Na__LeParam__ResetToStandard(sheet, group.Group__Id, viewport.Viewport__ScaleDenominator, { link : link, silent : true });
            else group[Na__LeParam__FIELD] = Object.assign({}, block, { Parametric__Link : link });
            linked.push(group.Group__Id);
        });
        if (linked.length) Na__LeModel__MarkDirty();
        return linked;
    }
    // ------------------------------------------------------------


    // FUNCTION | Run a Drop, Linking the Parametric Elements It Brings In (one undo step)
    // ------------------------------------------------------------
    // insert() puts records on the sheet and announces, as the item
    // clipboard's InsertSet does; its result is returned. While it runs, the
    // before-announce hook below links what arrived the moment the drop is
    // about to announce itself - so the announcement, and the history's
    // snapshot of it, already hold the links: one Ctrl+Z, and one Ctrl+Y.
    //
    // Should the hook not have been attached - the panel attaches it, and a
    // drop has no business arriving before the panel - the links are made
    // afterwards instead and announced, which costs a second undo step and
    // loses nothing else.
    // ------------------------------------------------------------
    function Na__LeParamLink__InsertAdopting(sheet, insert) {
        if (!sheet || typeof insert !== 'function') return null;
        const known   = new Set(Na__LeParam__ListOnSheet(sheet).map((group) => group.Group__Id));
        const pending = { sheetId : sheet.Sheet__Id, known : known, heard : false };
        Na__LeParamLink__Adopting = pending;
        let placed = null;
        try { placed = insert(); } finally { Na__LeParamLink__Adopting = null; }
        if (placed && !pending.heard) {
            const late = Na__LeParamLink__AdoptNew(sheet, known);
            if (late.length) Na__LeParam__Announce(sheet, late[late.length - 1]);
        }
        return placed;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Following a Viewport
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Bring Every Linked Element on a Sheet Into Line With Its Viewport
    // ------------------------------------------------------------
    // An element whose viewport has gone, or is 3D now, lets go of it and
    // keeps its scale. One whose viewport reads another scale is put to its
    // standard at that scale. Silent throughout. Returns how many changed.
    // ------------------------------------------------------------
    function Na__LeParamLink__Reconcile(sheet) {
        let changed = 0;
        Na__LeParam__ListOnSheet(sheet).forEach((group) => {
            const block = Na__LeParam__GetBlock(group);
            const link  = block ? block.Parametric__Link : null;
            if (!link || link.Link__SheetId !== sheet.Sheet__Id) return;          // <-- Unlinked, or broken by a move to this sheet: left alone
            const viewport = Na__LeParamLink__Resolve(sheet, block);
            if (!viewport) {
                group[Na__LeParam__FIELD] = Object.assign({}, block, { Parametric__Link : null });
                changed++;
                return;
            }
            const params = Na__LeParam__GetParams(sheet, group.Group__Id) || {};
            if (viewport.Viewport__ScaleDenominator === params.ScaleDenominator) return;
            if (Na__LeParam__ResetToStandard(sheet, group.Group__Id, viewport.Viewport__ScaleDenominator, { silent : true })) changed++;
        });
        return changed;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Change Is About to Be Announced (the model's before-announce hook)
    // ------------------------------------------------------------
    // Silent edits only, and nothing is announced from here: the announcement
    // this runs ahead of is the one that carries the work, so the history
    // snapshots a sheet that already holds the rebuilt element. The model
    // never calls this for a restore - an undo or a redo is never followed.
    // The paper is asked to redraw its markup because a viewport announcement
    // only redraws the frames.
    // ------------------------------------------------------------
    function Na__LeParamLink__BeforeAnnounce(reason, sheetId) {
        if (Na__LeParamLink__Following) return;
        const adopting = Na__LeParamLink__Adopting;
        if (adopting && !adopting.heard && sheetId === adopting.sheetId) {
            adopting.heard = true;                                               // <-- The drop's one announcement: everything it brought is on the sheet
            Na__LeParamLink__Following = true;
            try { Na__LeParamLink__AdoptNew(Na__LeModel__GetSheetById(adopting.sheetId), adopting.known); }
            catch (error) { console.warn('[TrueVision3D LayoutEditor] A dropped parametric element could not be linked.', error); }
            finally { Na__LeParamLink__Following = false; }
            return;
        }
        if (Na__LeParamLink__FOLLOW_REASONS.indexOf(reason) === -1) return;
        if (!Na__LeParamLink__Setup().followScale) return;
        const sheet = Na__LeModel__GetSheetById(sheetId);
        if (!sheet) return;
        Na__LeParamLink__Following = true;
        try {
            if (Na__LeParamLink__Reconcile(sheet) > 0) { Na__LeModel__MarkDirty(); Na__LeSurface__Refresh('markup'); }
        } catch (error) {
            console.warn('[TrueVision3D LayoutEditor] A linked parametric element could not follow its viewport.', error);
        } finally {
            Na__LeParamLink__Following = false;
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Start Following Viewports (once)
    // ------------------------------------------------------------
    function Na__LeParamLink__Attach() {
        if (Na__LeParamLink__Attached) return false;
        Na__LeParamLink__Attached = true;
        return Na__LeModel__RegisterBeforeAnnounce(Na__LeParamLink__BeforeAnnounce);   // <-- Ahead of every listener, the history's included, by construction rather than by order
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Parametric Scrapbook Viewport Link API
    // ------------------------------------------------------------
    export {
        Na__LeParamLink__Attach,
        Na__LeParamLink__Candidates,
        Na__LeParamLink__Nearest,
        Na__LeParamLink__ViewportName,
        Na__LeParamLink__Resolve,
        Na__LeParamLink__ResolveById,
        Na__LeParamLink__SetLink,
        Na__LeParamLink__LinkNearest,
        Na__LeParamLink__DenominatorFor,
        Na__LeParamLink__InsertLinked,
        Na__LeParamLink__InsertAdopting
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
