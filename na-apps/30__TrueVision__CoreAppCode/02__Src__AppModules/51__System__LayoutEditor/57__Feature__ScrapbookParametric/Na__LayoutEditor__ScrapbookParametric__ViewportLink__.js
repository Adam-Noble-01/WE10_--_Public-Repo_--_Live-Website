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
// - A LINK NAMES A SHEET AND WHAT ON IT:
//       Parametric__Link : { Link__SheetId, Link__ViewportId }        a viewport
//       Parametric__Link : { Link__SheetId, Link__Kind : 'sheet' }    the sheet's own scale
//   THE SHEET'S SCALE is the one the title block quotes (Na__LayoutEditor__DrawingScale__):
//   the scale its 2D viewports share, or the one covering the most paper. An
//   element dropped with no drawing near it is tied to that, so it still
//   follows something; and it is what dragging the link noodle onto the
//   title block ties an element to.
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
// - FACTS, AS WELL AS A SCALE. A type may name parameters it wants filled
//   from the viewport it is tied to (definition.facts): what the viewport is
//   a drawing of - plan or elevation, existing or proposed, which way it
//   faces, what it is called. The Drawing Title is written from them. They
//   come from Na__LayoutEditor__ViewportIdentity__, are laid into the
//   element's parameters here, and follow the viewport exactly as the scale
//   does: inside the announcement that changed them, one undo step. An
//   element that lets go of its viewport KEEPS the facts it had, as it keeps
//   its scale - an untied title goes on saying what it said.
// - SOME FACTS CHANGE WITH NO SHEET CHANGING. The project's north is set in
//   the 3D view; the design phases are registered after the project loads;
//   an elevation's bearing is edited in the Dev menu. Nothing is announced
//   on the sheet for any of them, so there is nothing to run ahead of.
//   Refresh brings the ACTIVE sheet's elements into line and announces once
//   - its own undo step, since nothing else is - when the identity module
//   says names may have changed, and whenever a sheet becomes active or the
//   sheets are loaded. Only while sheets are editable: a reader's copy says
//   what its author saved.
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
// // @delegate: ../20__System__Viewports/Na__LayoutEditor__ViewportIdentity__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (19-Sep-2026)
// - ValeVision    : 1.2.0 ported 20-Sep-2026 as ValeVision3D v2.68.0, verbatim
// - Ahead of it   : 1.3.0 (ViewLevel) is TrueVision only. ValeVision holds
//                   1.2.0 and its floor plans have no storey field.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.3.0
// - FactsOf answers ViewLevel as well: the storey of the floor plan a viewport
//   draws, '' for anything else. It follows its viewport as the other facts
//   do; a storey chosen in the Dev menu arrives as the identity module's
//   'level' announcement, which books the same refresh north does.
//
// 21-Sep-2026 - Version 1.3.0
// - A type may say it is never tied to a viewport (linkable : false). It is
//   then dropped with no link and no scale laid over its preset, and a sheet
//   that gains one does not adopt it. The Project Portal block reads the
//   project, not a drawing, and a cable from it to the nearest elevation
//   would say something untrue about what it is.
//
// 20-Sep-2026 - Version 1.2.0
// - Facts: FactsOf, and the facts a type asks for laid in on a drop, a link,
//   an adoption and a follow. InsertLinked takes an element's preset
//   parameters. Refresh, and the three things that call it. Following the
//   facts does not wait on ViewportLink FollowScale, which is about scale.
//
// 19-Sep-2026 - Version 1.1.0
// - A second kind of link: the sheet's own scale (SetSheetLink). Describe says
//   what an element is tied to - a viewport, the sheet, or nothing - for the
//   panel, the lookup menu and the link noodle, which draws it
//   (Na__LayoutEditor__ScrapbookParametric__LinkNoodle__). An element dropped
//   out of reach of any drawing is tied to the sheet's scale rather than to
//   nothing.
//
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
        Na__LeModel__CHANGED_EVENT,
        Na__LeModel__RegisterBeforeAnnounce,
        Na__LeModel__KIND_2D,
        Na__LeModel__GetActiveSheet,
        Na__LeModel__GetSheetById,
        Na__LeModel__GetGroupById,
        Na__LeModel__GetViewportById,
        Na__LeModel__IsLayerVisible,
        Na__LeModel__MarkDirty
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeDrawScale__SheetDenominator, Na__LeDrawScale__Label } from '../07__Core__SheetData/Na__LayoutEditor__DrawingScale__.js';
    import { Na__LeSurface__Refresh } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeGroup__Bounds } from '../15__Core__Markup/Na__LayoutEditor__Groups__.js';
    import { Na__LePanels__IsEditable, Na__LePanels__Refresh } from '../40__Ui__Panels/Na__LayoutEditor__PanelHost__.js';
    import { Na__LeViewId__CHANGED_EVENT, Na__LeViewId__Describe } from '../20__System__Viewports/Na__LayoutEditor__ViewportIdentity__.js';
    import {
        Na__LeParam__FIELD,
        Na__LeParam__Block,
        Na__LeParam__Label,
        Na__LeParam__GetBlock,
        Na__LeParam__GetBlockById,
        Na__LeParam__GetType,
        Na__LeParam__IsLinkable,
        Na__LeParam__GetParams,
        Na__LeParam__ListOnSheet,
        Na__LeParam__Insert,
        Na__LeParam__Announce,
        Na__LeParam__Regenerate,
        Na__LeParam__ResetToStandard
    } from './Na__LayoutEditor__ScrapbookParametric__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Announcements That Can Change or Remove a Viewport
    // ------------------------------------------------------------
    const Na__LeParamLink__FOLLOW_REASONS  = Object.freeze([ 'viewport', 'viewports' ]);   // <-- The sheet's scale is made of its viewports' scales, so these move it too
    const Na__LeParamLink__KIND_VIEWPORT   = 'viewport';
    const Na__LeParamLink__KIND_SHEET      = 'sheet';
    const Na__LeParamLink__KIND_NONE       = 'none';
    const Na__LeParamLink__MAX_DISTANCE_MM = 80;                                // <-- When the config gives none
    const Na__LeParamLink__REFRESH_REASONS = Object.freeze([ 'active', 'loaded' ]);        // <-- A sheet comes up: its elements are checked against facts that may have moved while it was away
    // ------------------------------------------------------------

    // MODULE VARIABLES | Listening, and the Guard Against Hearing Itself
    // ------------------------------------------------------------
    let Na__LeParamLink__Attached  = false;
    let Na__LeParamLink__Following = false;
    let Na__LeParamLink__Adopting  = null;     // <-- { sheetId, known, heard } while InsertAdopting is running a drop
    let Na__LeParamLink__Refreshing = false;   // <-- A refresh of the active sheet is booked
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
// REGION | View Facts
// -----------------------------------------------------------------------------

    // FUNCTION | What a Viewport Is a Drawing Of, as the Parameters a Type May Ask For
    // ------------------------------------------------------------
    // { ViewKind, ViewPhase, ViewFacing, ViewLevel, ViewName, ViewDrawing } -
    // the viewport identity module's facts under the names an element stores
    // them by. ViewFacing is '' until north is set in the 3D model; ViewLevel
    // is a floor plan's storey and '' for everything else.
    // ------------------------------------------------------------
    function Na__LeParamLink__FactsOf(viewport) {
        const facts = Na__LeViewId__Describe(viewport);
        return { ViewKind : facts.kind, ViewPhase : facts.phase, ViewFacing : facts.facing, ViewLevel : facts.level || '', ViewName : facts.name, ViewDrawing : facts.drawing };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Facts a Type Asks For, From a Viewport ({} for a type that asks for none)
    // ------------------------------------------------------------
    function Na__LeParamLink__FactsForType(type, viewport) {
        const definition = Na__LeParam__GetType(type);
        const wanted     = (definition && Array.isArray(definition.facts)) ? definition.facts : [];
        if (!wanted.length || !viewport) return {};
        const facts = Na__LeParamLink__FactsOf(viewport);
        const out   = {};
        wanted.forEach((key) => { if (facts[key] !== undefined) out[key] = facts[key]; });
        return out;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Facts of an Element That No Longer Match Its Viewport ({} when all do)
    // ------------------------------------------------------------
    function Na__LeParamLink__FactsPatch(sheet, groupId, viewport) {
        const block = Na__LeParam__GetBlockById(sheet, groupId);
        if (!block || !viewport) return {};
        const wanted = Na__LeParamLink__FactsForType(block.Parametric__Type, viewport);
        const held   = Na__LeParam__GetParams(sheet, groupId) || {};
        const patch  = {};
        Object.keys(wanted).forEach((key) => { if (wanted[key] !== held[key]) patch[key] = wanted[key]; });
        return patch;
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
    function Na__LeParamLink__MakeSheet(sheet) {
        return sheet ? { Link__SheetId : sheet.Sheet__Id, Link__Kind : Na__LeParamLink__KIND_SHEET } : null;
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
        if (link.Link__SheetId !== sheet.Sheet__Id || link.Link__Kind === Na__LeParamLink__KIND_SHEET || typeof link.Link__ViewportId !== 'string') return null;
        const viewport = Na__LeModel__GetViewportById(sheet, link.Link__ViewportId);
        return Na__LeParamLink__IsScaled(viewport) ? viewport : null;
    }
    function Na__LeParamLink__ResolveById(sheet, groupId) {
        return Na__LeParamLink__Resolve(sheet, Na__LeParam__GetBlockById(sheet, groupId));
    }
    // ------------------------------------------------------------


    // FUNCTION | What an Element Is Tied To
    // ------------------------------------------------------------
    // { kind, viewport, denominator, name }. kind is 'viewport', 'sheet' or
    // 'none'; denominator is the scale the tie gives, null for none; name is
    // how the panel, the menu and the toasts write it. A broken link - another
    // sheet's, or a viewport that has gone - is none.
    // ------------------------------------------------------------
    function Na__LeParamLink__Describe(sheet, block) {
        const none = { kind : Na__LeParamLink__KIND_NONE, viewport : null, denominator : null, name : '' };
        const link = block ? block.Parametric__Link : null;
        if (!sheet || !link || typeof link !== 'object' || link.Link__SheetId !== sheet.Sheet__Id) return none;
        if (link.Link__Kind === Na__LeParamLink__KIND_SHEET) {
            const denominator = Na__LeDrawScale__SheetDenominator(sheet);
            return { kind : Na__LeParamLink__KIND_SHEET, viewport : null, denominator : denominator,
                     name : Na__LeParam__Label('LinkSheetName', 'the sheet\'s scale ({scale})', { scale : Na__LeDrawScale__Label(denominator) }) };
        }
        const viewport = Na__LeParamLink__Resolve(sheet, block);
        if (!viewport) return none;
        return { kind : Na__LeParamLink__KIND_VIEWPORT, viewport : viewport, denominator : viewport.Viewport__ScaleDenominator, name : Na__LeParamLink__ViewportName(viewport) };
    }
    function Na__LeParamLink__DescribeById(sheet, groupId) {
        return Na__LeParamLink__Describe(sheet, Na__LeParam__GetBlockById(sheet, groupId));
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
    // scale when that differs from its own, takes the facts its type asks
    // for, and otherwise only records the link. Returns the viewport now
    // linked, or null.
    // ------------------------------------------------------------
    function Na__LeParamLink__SetLink(sheet, groupId, viewportId) {
        const group = sheet ? Na__LeModel__GetGroupById(sheet, groupId) : null;
        const block = Na__LeParam__GetBlock(group);
        if (!block) return null;
        const viewport = viewportId ? Na__LeModel__GetViewportById(sheet, viewportId) : null;
        const target   = Na__LeParamLink__IsScaled(viewport) ? viewport : null;
        const link     = Na__LeParamLink__Make(sheet, target);
        const params   = Na__LeParam__GetParams(sheet, groupId) || {};
        const facts    = Na__LeParamLink__FactsPatch(sheet, groupId, target);
        if (target && target.Viewport__ScaleDenominator !== params.ScaleDenominator) {
            Na__LeParam__ResetToStandard(sheet, groupId, target.Viewport__ScaleDenominator, { link : link, patch : facts });
            return target;
        }
        if (Object.keys(facts).length) { Na__LeParam__Regenerate(sheet, groupId, facts, { link : link }); return target; }   // <-- The same scale, another drawing: the title changes and the bar does not
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


    // FUNCTION | Tie an Element to the Sheet's Own Scale (one undo step)
    // ------------------------------------------------------------
    // It takes that scale now, where it differs, and follows it from then on.
    // Returns the scale.
    // ------------------------------------------------------------
    function Na__LeParamLink__SetSheetLink(sheet, groupId) {
        const group = sheet ? Na__LeModel__GetGroupById(sheet, groupId) : null;
        const block = Na__LeParam__GetBlock(group);
        if (!block) return null;
        const link        = Na__LeParamLink__MakeSheet(sheet);
        const denominator = Na__LeDrawScale__SheetDenominator(sheet);
        const params      = Na__LeParam__GetParams(sheet, groupId) || {};
        if (denominator !== params.ScaleDenominator) { Na__LeParam__ResetToStandard(sheet, groupId, denominator, { link : link }); return denominator; }
        group[Na__LeParam__FIELD] = Object.assign({}, block, { Parametric__Link : link });
        Na__LeModel__MarkDirty();
        Na__LeParam__Announce(sheet, groupId);
        return denominator;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Scale an Element Should Be Drawn At
    // ------------------------------------------------------------
    // Its viewport's while it is linked, else its own.
    // ------------------------------------------------------------
    function Na__LeParamLink__DenominatorFor(sheet, groupId) {
        const tied = Na__LeParamLink__DescribeById(sheet, groupId);
        if (tied.denominator !== null) return tied.denominator;
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
    // The scale is the linked viewport's. With no viewport near enough it is
    // tied to the sheet's own scale instead - the one the title block quotes
    // - so it still follows something. With AutoLinkOnInsert off it takes the
    // sheet's scale and is tied to nothing. preset is the element's own
    // parameters (Element__Params), which the scale and the viewport's facts
    // are laid over. One undo step; the element is selected. Returns the
    // selected roots, or null.
    // ------------------------------------------------------------
    function Na__LeParamLink__InsertLinked(sheet, type, centreMm, preset) {
        if (!sheet || !centreMm) return null;
        // A TYPE THAT IS NEVER TIED TO A DRAWING IS DROPPED AND NOTHING MORE.
        // No link, and no scale laid over its preset either: a scale it has
        // no use for would sit in its parameters looking like an answer.
        if (!Na__LeParam__IsLinkable(type)) return Na__LeParam__Insert(sheet, type, centreMm, (preset && typeof preset === 'object') ? preset : {}, null);
        const auto        = Na__LeParamLink__Setup().autoLink;
        const viewport    = auto ? Na__LeParamLink__Nearest(sheet, centreMm) : null;
        const denominator = viewport ? viewport.Viewport__ScaleDenominator : Na__LeDrawScale__SheetDenominator(sheet);
        const link        = viewport ? Na__LeParamLink__Make(sheet, viewport) : (auto ? Na__LeParamLink__MakeSheet(sheet) : null);
        const params      = Object.assign({}, (preset && typeof preset === 'object') ? preset : {}, { ScaleDenominator : denominator }, Na__LeParamLink__FactsForType(type, viewport));
        return Na__LeParam__Insert(sheet, type, centreMm, params, link);
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
            if (!block || !Na__LeParam__IsLinkable(block.Parametric__Type)) return;   // <-- A type that is never tied to a drawing is not adopted by one it happens to have landed beside
            if (Na__LeParamLink__Describe(sheet, block).kind !== Na__LeParamLink__KIND_NONE) return;
            const centre      = Na__LeParamLink__CentreOf(sheet, group.Group__Id);
            const viewport    = centre ? Na__LeParamLink__Nearest(sheet, centre) : null;
            const link        = viewport ? Na__LeParamLink__Make(sheet, viewport) : Na__LeParamLink__MakeSheet(sheet);   // <-- Out of reach of any drawing: the sheet's scale
            const denominator = viewport ? viewport.Viewport__ScaleDenominator : Na__LeDrawScale__SheetDenominator(sheet);
            const params      = Na__LeParam__GetParams(sheet, group.Group__Id) || {};
            const facts       = Na__LeParamLink__FactsPatch(sheet, group.Group__Id, viewport);
            if (denominator !== params.ScaleDenominator) Na__LeParam__ResetToStandard(sheet, group.Group__Id, denominator, { link : link, silent : true, patch : facts });
            else if (Object.keys(facts).length) Na__LeParam__Regenerate(sheet, group.Group__Id, facts, { link : link, silent : true });
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
    // keeps its scale and its facts. One whose viewport reads another scale
    // is put to its standard at that scale (followScale); one whose facts
    // have moved - another model, another name, a north that has been set -
    // is rebuilt with them. Silent throughout. Returns the ids of the groups
    // that changed.
    // ------------------------------------------------------------
    function Na__LeParamLink__Reconcile(sheet, followScale) {
        const changed = [];
        Na__LeParam__ListOnSheet(sheet).forEach((group) => {
            const block = Na__LeParam__GetBlock(group);
            const link  = block ? block.Parametric__Link : null;
            if (!link || link.Link__SheetId !== sheet.Sheet__Id) return;          // <-- Unlinked, or broken by a move to this sheet: left alone
            if (link.Link__Kind === Na__LeParamLink__KIND_SHEET) {
                const wanted = Na__LeDrawScale__SheetDenominator(sheet);
                const held   = Na__LeParam__GetParams(sheet, group.Group__Id) || {};
                if (followScale && wanted !== held.ScaleDenominator && Na__LeParam__ResetToStandard(sheet, group.Group__Id, wanted, { silent : true })) changed.push(group.Group__Id);
                return;
            }
            const viewport = Na__LeParamLink__Resolve(sheet, block);
            if (!viewport) {
                group[Na__LeParam__FIELD] = Object.assign({}, block, { Parametric__Link : null });
                changed.push(group.Group__Id);
                return;
            }
            const params = Na__LeParam__GetParams(sheet, group.Group__Id) || {};
            const facts  = Na__LeParamLink__FactsPatch(sheet, group.Group__Id, viewport);
            if (followScale && viewport.Viewport__ScaleDenominator !== params.ScaleDenominator) {
                if (Na__LeParam__ResetToStandard(sheet, group.Group__Id, viewport.Viewport__ScaleDenominator, { silent : true, patch : facts })) changed.push(group.Group__Id);
                return;
            }
            if (Object.keys(facts).length && Na__LeParam__Regenerate(sheet, group.Group__Id, facts, { silent : true })) changed.push(group.Group__Id);
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
        const sheet = Na__LeModel__GetSheetById(sheetId);
        if (!sheet) return;
        Na__LeParamLink__Following = true;
        try {
            if (Na__LeParamLink__Reconcile(sheet, Na__LeParamLink__Setup().followScale).length > 0) { Na__LeModel__MarkDirty(); Na__LeSurface__Refresh('markup'); }
        } catch (error) {
            console.warn('[TrueVision3D LayoutEditor] A linked parametric element could not follow its viewport.', error);
        } finally {
            Na__LeParamLink__Following = false;
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Bring a Sheet's Linked Elements Into Line Now (one undo step when anything moved)
    // ------------------------------------------------------------
    // For facts that change with no sheet changing: north set in the 3D view,
    // the design phases arriving, an elevation's bearing edited. There is no
    // announcement to run ahead of, so this makes its own, through the last
    // element it rebuilt. Returns how many elements changed.
    // ------------------------------------------------------------
    function Na__LeParamLink__Refresh(sheet) {
        if (!sheet || Na__LeParamLink__Following) return 0;
        Na__LeParamLink__Following = true;                                      // <-- Held through the announcement too, so the hook does not reconcile what has just been reconciled
        try {
            const changed = Na__LeParamLink__Reconcile(sheet, Na__LeParamLink__Setup().followScale);
            if (!changed.length) return 0;
            Na__LeModel__MarkDirty();
            Na__LeSurface__Refresh('markup');
            Na__LeParam__Announce(sheet, changed[changed.length - 1]);
            return changed.length;
        } catch (error) {
            console.warn('[TrueVision3D LayoutEditor] Linked parametric elements could not be refreshed.', error);
            return 0;
        } finally {
            Na__LeParamLink__Following = false;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Book a Refresh of the Active Sheet, Once the Present Announcement Is Over
    // ------------------------------------------------------------
    // Never from inside the event that asked for it: a refresh announces, and
    // an announcement inside an announcement reaches later listeners out of
    // order. Editable sheets only - a reader's copy says what was saved.
    // ------------------------------------------------------------
    function Na__LeParamLink__BookRefresh() {
        if (Na__LeParamLink__Refreshing) return;
        Na__LeParamLink__Refreshing = true;
        window.setTimeout(() => {
            Na__LeParamLink__Refreshing = false;
            const sheet = Na__LePanels__IsEditable() ? Na__LeModel__GetActiveSheet() : null;
            if (sheet) Na__LeParamLink__Refresh(sheet);
        }, 0);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Names May Have Changed: North, the Design Phases or the Words
    // ------------------------------------------------------------
    // The frames' captions and the panels' lists are names too, and no sheet
    // change redraws them.
    // ------------------------------------------------------------
    function Na__LeParamLink__OnIdentityChanged() {
        Na__LeSurface__Refresh('frames');
        Na__LePanels__Refresh();
        Na__LeParamLink__BookRefresh();
    }
    function Na__LeParamLink__OnModelChanged(event) {
        const reason = (event && event.detail) ? event.detail.reason : '';
        if (Na__LeParamLink__REFRESH_REASONS.indexOf(reason) !== -1) Na__LeParamLink__BookRefresh();
    }
    // ------------------------------------------------------------


    // FUNCTION | Start Following Viewports (once)
    // ------------------------------------------------------------
    function Na__LeParamLink__Attach() {
        if (Na__LeParamLink__Attached) return false;
        Na__LeParamLink__Attached = true;
        window.addEventListener(Na__LeViewId__CHANGED_EVENT, Na__LeParamLink__OnIdentityChanged);
        window.addEventListener(Na__LeModel__CHANGED_EVENT, Na__LeParamLink__OnModelChanged);
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
        Na__LeParamLink__FactsOf,
        Na__LeParamLink__Refresh,
        Na__LeParamLink__KIND_VIEWPORT,
        Na__LeParamLink__KIND_SHEET,
        Na__LeParamLink__KIND_NONE,
        Na__LeParamLink__Resolve,
        Na__LeParamLink__ResolveById,
        Na__LeParamLink__Describe,
        Na__LeParamLink__DescribeById,
        Na__LeParamLink__SetLink,
        Na__LeParamLink__SetSheetLink,
        Na__LeParamLink__LinkNearest,
        Na__LeParamLink__DenominatorFor,
        Na__LeParamLink__InsertLinked,
        Na__LeParamLink__InsertAdopting
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
