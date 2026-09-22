// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SELECTION SET
// =============================================================================
//
// FILE       : Na__LayoutEditor__SelectionSet__.js
// NAMESPACE  : Na__LeSelSet
// MODULE     : Layout Editor - Selection Set
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Work on several selected items as one: move them together, nudge them and delete them, each as one undo step
// CREATED    : 14-Sep-2026
//
// DESCRIPTION:
// - Several items selected at once - by a selection box, or by Shift and Ctrl
//   clicks - move as one. The sheet tools take where each item starts at the
//   press (Capture), shift every one of them by the same distance while the
//   pointer moves (Apply) and settle them on release (Commit).
// - ONE UNDO STEP, HOWEVER MANY ITEMS. Every item is written silently and Commit
//   announces once for each kind in the group. The history takes its step at
//   the first announcement, when the sheet already holds every move, and finds
//   nothing new in the rest - so one Ctrl+Z puts the whole group back. A delete
//   goes through Na__LeModel__DeleteItems for the same reason.
// - LOCKED ITEMS STAY PUT. A locked viewport, or anything on a locked layer, may
//   be part of a selection - a click still inspects it - but every move, nudge
//   and delete leaves it out, as AutoCAD leaves out an object on a locked layer.
// - A LEADER KEEPS POINTING AT WHAT IT POINTS AT. A leader's tip - a text
//   item's leader or a leader's own (Sheet__Leaders) - goes with the set when
//   it lies over what the set's drawings cover: a viewport it points into, a
//   picture, a vector detail. It stays on a drawing staying behind, so notes
//   moved with an arrow over a plan leave every leader on the plan. A tip on
//   bare paper goes with a set that moves anything besides notes and leaders.
//   Notes and leaders moved on their own move their words and bubbles and
//   leave every tip where it points - tidying a column of notes - as dragging
//   one note on its own always has.
// - A GROUP IS ONE PIECE. Everything inside a group being moved goes with it,
//   every leader tip included, whatever the tip points at; a group never comes
//   apart on a move. So does a copy being carried off (a Ctrl-drag), which
//   points at nothing yet.
// - Dimensions and vectors move whole, as a single whole-item drag moves them.
// - A delete that would take a viewport asks first, once, for the whole lot.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__: Capture, Apply and Commit for a group drag;
//   Nudge for the arrow keys; Delete for the Delete key and the context menu.
// - Na__LayoutEditor__SheetTools__CopyDrag__: Capture with options.rigid for
//   the copy a Ctrl-drag carries, and for each copy of an array.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (14-Sep-2026)
// - ValeVision    : 1.0.0 ported 14-Sep-2026 as ValeVision v2.33.0, verbatim
//                   below the header, on top of the Leaders port (v2.32.0).
//                   Nothing here is app-specific; it writes only records both
//                   apps share. Later versions wait for their own sign-off.
// - Depends on    : Na__LeModel__GetLeaders and UpdateLeader for the leader row;
//                   GetGroups, IsLayerVisible, Na__LeShapeGeo__Bounds and Hit
//                   and Selection HitToleranceMm for the tip rule (1.2.0)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.2.0
// - A LEADER TIP FOLLOWS WHAT IT POINTS AT, NOT ONLY A VIEWPORT. A picture is
//   a vector (Shape__Image), and the tip rule only ever looked for a moving
//   viewport, so boxing a CGI with its specification bubbles and moving the
//   lot carried every bubble and left every tip pointing at the old place
//   (Adam, RB05's Project Introduction sheet). Capture now asks what lies
//   under each tip (TipFollows): over the ground the moving viewports,
//   pictures and vectors cover, it goes with them; on a drawing staying
//   behind, it stays on it; on bare paper it goes with any set that moves
//   more than notes and leaders.
// - A GROUP MOVES AS ONE PIECE. A member of a group being moved takes its tip
//   with it whatever it points at (GroupedBy), so a group of notes, or a
//   picture grouped with its bubbles, never comes apart on a move, a nudge, a
//   typed length or a copy array.
// - Capture takes options.rigid, for a Ctrl-drag copy: every tip goes, since
//   a copy points at nothing yet (Na__LayoutEditor__SheetTools__CopyDrag__).
//
// 21-Sep-2026 - Version 1.1.0
// - A leader tip follows a moving viewport when it is inside the frame as the
//   frame stands, turned (Viewport__RotationDeg) or not.
//
// 14-Sep-2026 - Version 1.0.0
// - Initial implementation: group capture, move and commit, nudge and delete,
//   each one undo step; locked items left out; a leader tip - a text item's or
//   a leader's own - follows a moving viewport.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Surface, Shape Geometry and the Confirm Dialog
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel, Na__LeCfg__GetSelectionSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__GetViewportById,
        Na__LeModel__GetGroups,
        Na__LeModel__IsLayerLocked,
        Na__LeModel__IsLayerVisible,
        Na__LeModel__UpdateViewport,
        Na__LeModel__UpdateAnnotation,
        Na__LeModel__UpdateDimension,
        Na__LeModel__UpdateShape,
        Na__LeModel__GetLeaders,
        Na__LeModel__UpdateLeader,
        Na__LeModel__DeleteItems
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__Refresh } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeShapeGeo__Points, Na__LeShapeGeo__Translated, Na__LeShapeGeo__Bounds, Na__LeShapeGeo__Hit } from '../15__Core__Markup/Na__LayoutEditor__ShapeGeometry__.js';
    import { Na__AppUtils__ConfirmDialog__Show } from '../../03__AppUtils/Na__AppUtils__ConfirmDialog.js';
    import { Na__LeVpRot__Contains, Na__LeVpRot__Bounds } from '../20__System__Viewports/Na__LayoutEditor__ViewportRotation__.js';   // <-- A leaf: inside a turned frame, and the upright box round one
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Kinds a Group Moves
// -----------------------------------------------------------------------------
//
// One row per kind. find returns the record; locked says an edit must leave it
// alone; start is what a move is measured from; move writes the record at a
// distance from that start, silently; announce tells every listener once the
// move is over; surface is the part of the paper a move redraws. A new kind of
// sheet item joins group editing by adding a row.
//

    // MODULE CONSTANTS | One Row per Kind
    // ------------------------------------------------------------
    const Na__LeSelSet__KINDS = Object.freeze([
        {
            kind     : 'viewport',
            surface  : 'frames',
            find     : (sheet, id) => Na__LeModel__GetViewportById(sheet, id),
            locked   : (sheet, r) => r.Viewport__Locked === true || Na__LeModel__IsLayerLocked(sheet, r.Viewport__LayerId),
            start    : (r) => ({ x : r.Viewport__FrameMm.X, y : r.Viewport__FrameMm.Y }),
            move     : (sheet, entry, dx, dy) => Na__LeModel__UpdateViewport(sheet, entry.id, { rect : { X : entry.start.x + dx, Y : entry.start.y + dy } }, true),
            announce : (sheet, id) => Na__LeModel__UpdateViewport(sheet, id, {}, false)
        },
        {
            kind     : 'annotation',
            surface  : 'markup',
            find     : (sheet, id) => sheet.Sheet__Annotations.find((a) => a.Annotation__Id === id) || null,
            locked   : (sheet, r) => Na__LeModel__IsLayerLocked(sheet, r.Annotation__LayerId),
            start    : (r) => ({ x : r.Annotation__PosXMm, y : r.Annotation__PosYMm, tipX : r.Annotation__LeaderXMm, tipY : r.Annotation__LeaderYMm, tipFollows : false }),
            move     : (sheet, entry, dx, dy) => {
                const patch = { posXMm : entry.start.x + dx, posYMm : entry.start.y + dy };
                if (entry.start.tipFollows) { patch.leaderXMm = entry.start.tipX + dx; patch.leaderYMm = entry.start.tipY + dy; }
                return Na__LeModel__UpdateAnnotation(sheet, entry.id, patch, true);
            },
            announce : (sheet, id) => Na__LeModel__UpdateAnnotation(sheet, id, {}, false)
        },
        {
            kind     : 'dimension',
            surface  : 'markup',
            find     : (sheet, id) => sheet.Sheet__Dimensions.find((d) => d.Dimension__Id === id) || null,
            locked   : (sheet, r) => Na__LeModel__IsLayerLocked(sheet, r.Dimension__LayerId),
            start    : (r) => ({ sx : r.Dimension__StartXMm, sy : r.Dimension__StartYMm, ex : r.Dimension__EndXMm, ey : r.Dimension__EndYMm }),
            move     : (sheet, entry, dx, dy) => Na__LeModel__UpdateDimension(sheet, entry.id,
                { startXMm : entry.start.sx + dx, startYMm : entry.start.sy + dy, endXMm : entry.start.ex + dx, endYMm : entry.start.ey + dy }, true),
            announce : (sheet, id) => Na__LeModel__UpdateDimension(sheet, id, {}, false)
        },
        {
            kind     : 'shape',
            surface  : 'markup',
            find     : (sheet, id) => (sheet.Sheet__Shapes || []).find((s) => s.Shape__Id === id) || null,
            locked   : (sheet, r) => Na__LeModel__IsLayerLocked(sheet, r.Shape__LayerId),
            start    : (r) => ({ points : Na__LeShapeGeo__Points(r).map((p) => [ p[0], p[1] ]) }),
            move     : (sheet, entry, dx, dy) => Na__LeModel__UpdateShape(sheet, entry.id, { points : Na__LeShapeGeo__Translated(entry.start.points, dx, dy) }, true),
            announce : (sheet, id) => Na__LeModel__UpdateShape(sheet, id, {}, false)
        },
        {
            kind     : 'leader',
            surface  : 'markup',
            find     : (sheet, id) => Na__LeModel__GetLeaders(sheet).find((l) => l.Leader__Id === id) || null,
            locked   : (sheet, r) => Na__LeModel__IsLayerLocked(sheet, r.Leader__LayerId),
            start    : (r) => ({ x : r.Leader__AnchorXMm, y : r.Leader__AnchorYMm, tipX : r.Leader__TipXMm, tipY : r.Leader__TipYMm, tipFollows : false }),
            move     : (sheet, entry, dx, dy) => {
                const patch = { anchorXMm : entry.start.x + dx, anchorYMm : entry.start.y + dy };      // <-- The head moves; the tip only with a viewport it points into
                if (entry.start.tipFollows) { patch.tipXMm = entry.start.tipX + dx; patch.tipYMm = entry.start.tipY + dy; }
                return Na__LeModel__UpdateLeader(sheet, entry.id, patch, true);
            },
            announce : (sheet, id) => Na__LeModel__UpdateLeader(sheet, id, {}, false)
        }
    ]);
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Row for a Kind
    // ------------------------------------------------------------
    function Na__LeSelSet__Row(kind) {
        return Na__LeSelSet__KINDS.find((row) => row.kind === kind) || null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Selected Items an Edit May Touch: Still There and Not Locked
    // ------------------------------------------------------------
    // Returns [{ kind, id, row, record }].
    // ------------------------------------------------------------
    function Na__LeSelSet__Editable(sheet, items) {
        const out = [];
        if (!sheet || !Array.isArray(items)) return out;
        items.forEach((item) => {
            const row    = item ? Na__LeSelSet__Row(item.kind) : null;
            const record = row ? row.find(sheet, item.id) : null;
            if (record && !row.locked(sheet, record)) out.push({ kind : item.kind, id : item.id, row : row, record : record });
        });
        return out;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Where a Leader Tip Goes
// -----------------------------------------------------------------------------
//
// A leader's tip sits ON something - a drawing in a viewport, a picture, a
// line - and a set move should leave it on that something. So each tip asks,
// once, at the press: does it belong to a group being moved (then it goes),
// does it lie over the ground the moving drawings cover (then it goes), or is
// it on a drawing staying behind (then it stays)? A tip with nothing under it
// goes with a set that moves drawings, and stays with notes and leaders moved
// on their own.
//

    // HELPER FUNCTION | How Near a Tip Must Sit to What It Points At, in Paper Millimetres
    // ------------------------------------------------------------
    // The click's own reach at 100 percent (Selection HitToleranceMm): a tip
    // placed by eye on a line is as near it as a click on that line would be.
    // ------------------------------------------------------------
    function Na__LeSelSet__TipReachMm() {
        const reach = Na__LeCfg__GetSelectionSetup().hitToleranceMm;
        return (Number.isFinite(reach) && reach > 0) ? reach : 1.5;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Which Items Belong to a Group Being Moved
    // ------------------------------------------------------------
    // items is what the move was handed: the selection with every group opened
    // up to its members (Na__LeGroup__Expand), the group records themselves
    // included - which is how a moving group is known. Returns (kind, id) =>
    // true when the item sits in one of them at any depth. A member picked on
    // its own inside an open group is not "a group being moved": it answers
    // false, and takes the pointing rule like anything picked loose.
    // ------------------------------------------------------------
    function Na__LeSelSet__GroupedBy(sheet, items) {
        const moving = new Set((Array.isArray(items) ? items : []).filter((item) => item && item.kind === 'group').map((item) => item.id));
        if (!moving.size) return () => false;
        const parentOf = new Map();                                          // <-- 'kind:id' -> the id of the group that holds it
        Na__LeModel__GetGroups(sheet).forEach((group) => {
            (group.Group__Members || []).forEach((member) => { if (member) parentOf.set(member.kind + ':' + member.id, group.Group__Id); });
        });
        return (kind, id) => {
            const seen = new Set();
            let key = kind + ':' + id;
            while (parentOf.has(key) && !seen.has(key)) {
                seen.add(key);
                const groupId = parentOf.get(key);
                if (moving.has(groupId)) return true;
                key = 'group:' + groupId;
            }
            return false;
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Ground the Moving Drawings Cover, and the Drawings Staying Behind
    // ------------------------------------------------------------
    // footprint is the box round every viewport and vector moving with the
    // set, reach wider all round, or null when none moves. It is the WHOLE of
    // what they cover, not each one's own box, so a tip among the lines of a
    // vector detail - on none of them, over the drawing the detail was drawn
    // on - still goes with the detail.
    //
    // staying is every other viewport and vector on a visible layer: a hidden
    // one cannot be what a leader is seen to point at. A LOCKED one stays and
    // holds the tips on it, as the lock holds it. Each vector's box is worked
    // out once here, so a sheet of many is not measured again for every tip.
    // ------------------------------------------------------------
    function Na__LeSelSet__Drawings(sheet, group, reach) {
        const moving  = new Set(group.filter((entry) => entry.kind === 'viewport' || entry.kind === 'shape').map((entry) => entry.kind + ':' + entry.id));
        const staying = [];
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const cover = (box) => {
            if (!box || !Number.isFinite(box.X) || !Number.isFinite(box.Y)) return;
            minX = Math.min(minX, box.X); maxX = Math.max(maxX, box.X + (box.WidthMm || 0));
            minY = Math.min(minY, box.Y); maxY = Math.max(maxY, box.Y + (box.HeightMm || 0));
        };
        (sheet.Sheet__Viewports || []).forEach((viewport) => {
            if (!viewport || !viewport.Viewport__FrameMm) return;
            if (moving.has('viewport:' + viewport.Viewport__Id)) cover(Na__LeVpRot__Bounds(viewport));   // <-- The upright box round a turned frame
            else if (Na__LeModel__IsLayerVisible(sheet, viewport.Viewport__LayerId)) staying.push({ kind : 'viewport', record : viewport });
        });
        (sheet.Sheet__Shapes || []).forEach((shape) => {
            if (!shape) return;
            if (moving.has('shape:' + shape.Shape__Id)) cover(Na__LeShapeGeo__Bounds(shape));
            else if (Na__LeModel__IsLayerVisible(sheet, shape.Shape__LayerId)) staying.push({ kind : 'shape', record : shape, box : Na__LeShapeGeo__Bounds(shape) });
        });
        const footprint = Number.isFinite(minX) ? { minX : minX - reach, minY : minY - reach, maxX : maxX + reach, maxY : maxY + reach } : null;
        return { footprint : footprint, staying : staying };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Does a Tip Sit on a Drawing Staying Behind
    // ------------------------------------------------------------
    // A viewport holds a tip anywhere inside its frame, turned or not. A
    // vector holds one where a click would find it (Na__LeShapeGeo__Hit): on
    // an edge, or anywhere inside a fill, a picture or a room.
    // ------------------------------------------------------------
    function Na__LeSelSet__Holds(drawing, tip, reach) {
        if (drawing.kind === 'viewport') return Na__LeVpRot__Contains(drawing.record, tip, 0);
        const box = drawing.box;
        if (!box || tip.x < box.X - reach || tip.x > box.X + box.WidthMm + reach || tip.y < box.Y - reach || tip.y > box.Y + box.HeightMm + reach) return false;
        return Na__LeShapeGeo__Hit(drawing.record, tip, reach);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Does This Entry's Tip Go With the Set
    // ------------------------------------------------------------
    // context: { rigid, grouped, drawings } - drawings made on the first tip
    // that needs them, so a copy or a group never measures anything.
    //   a copy being carried, or a member of a group being moved   it goes
    //   notes and leaders moved with no drawing among them          it stays
    //   over the ground the moving drawings cover                   it goes
    //   on a drawing staying behind                                 it stays
    //   on bare paper                                               it goes
    // ------------------------------------------------------------
    function Na__LeSelSet__TipFollows(sheet, entry, group, context) {
        if (context.rigid || context.grouped(entry.kind, entry.id)) return true;
        const reach = Na__LeSelSet__TipReachMm();
        if (!context.drawings) context.drawings = Na__LeSelSet__Drawings(sheet, group, reach);
        const area = context.drawings.footprint;
        if (!area) return false;
        const tip = { x : entry.start.tipX, y : entry.start.tipY };
        if (tip.x >= area.minX && tip.x <= area.maxX && tip.y >= area.minY && tip.y <= area.maxY) return true;
        return !context.drawings.staying.some((drawing) => Na__LeSelSet__Holds(drawing, tip, reach));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Take Where Every Movable Selected Item Starts (at the press)
    // ------------------------------------------------------------
    // Returns the group, [{ kind, id, start }]. It is empty when nothing selected
    // can move, which still makes a valid drag: one that moves nothing.
    // options: { rigid } - true carries every leader tip with the set, for a
    // copy (Na__LayoutEditor__SheetTools__CopyDrag__), which points at nothing
    // yet. Left out, each tip goes where TipFollows says.
    // ------------------------------------------------------------
    function Na__LeSelSet__Capture(sheet, items, options) {
        const group = Na__LeSelSet__Editable(sheet, items).map((e) => ({ kind : e.kind, id : e.id, start : e.row.start(e.record) }));
        // LEADER TIPS | A text item's leader and a leader's own tip alike, each
        // decided once, from where everything stands before anything moves
        const tips = group.filter((g) => Number.isFinite(g.start.tipX) && Number.isFinite(g.start.tipY));
        if (!tips.length) return group;
        const context = { rigid : !!(options && options.rigid === true), grouped : Na__LeSelSet__GroupedBy(sheet, items), drawings : null };
        tips.forEach((g) => { g.start.tipFollows = Na__LeSelSet__TipFollows(sheet, g, group, context); });
        return group;
    }
    // ------------------------------------------------------------


    // FUNCTION | Shift the Whole Group a Distance From Where It Started (silent)
    // ------------------------------------------------------------
    // dx, dy are paper millimetres from the press, not from the last move, so a
    // drag never accumulates rounding however long it lasts.
    // ------------------------------------------------------------
    function Na__LeSelSet__Apply(sheet, group, dx, dy) {
        if (!sheet || !Array.isArray(group) || !group.length) return false;
        const redraw = new Set();
        group.forEach((entry) => {
            const row = Na__LeSelSet__Row(entry.kind);
            if (row && row.move(sheet, entry, dx, dy)) redraw.add(row.surface);
        });
        redraw.forEach((reason) => Na__LeSurface__Refresh(reason));
        return redraw.size > 0;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Group Has Landed: Announce It, Once per Kind
    // ------------------------------------------------------------
    function Na__LeSelSet__Commit(sheet, group) {
        if (!sheet || !Array.isArray(group)) return false;
        const announced = new Set();
        group.forEach((entry) => {
            const row = Na__LeSelSet__Row(entry.kind);
            if (!row || announced.has(entry.kind)) return;
            if (row.announce(sheet, entry.id)) announced.add(entry.kind);
        });
        return announced.size > 0;
    }
    // ------------------------------------------------------------


    // FUNCTION | Nudge Every Movable Selected Item by a Step (one undo step)
    // ------------------------------------------------------------
    function Na__LeSelSet__Nudge(sheet, items, dx, dy) {
        const group = Na__LeSelSet__Capture(sheet, items);
        if (!group.length) return false;
        Na__LeSelSet__Apply(sheet, group, dx, dy);
        return Na__LeSelSet__Commit(sheet, group);
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete Every Unlocked Selected Item (a viewport among them asks first)
    // ------------------------------------------------------------
    // One confirmation for the lot, however many viewports it holds, and one
    // undo step. Locked items are left where they are, still selected.
    // ------------------------------------------------------------
    async function Na__LeSelSet__Delete(sheet, items) {
        const doomed = Na__LeSelSet__Editable(sheet, items).map((e) => ({ kind : e.kind, id : e.id }));
        if (!doomed.length) return false;
        const viewports = doomed.filter((item) => item.kind === 'viewport').length;
        if (viewports > 0) {
            const ok = await Na__AppUtils__ConfirmDialog__Show({
                title         : Na__LeCfg__GetLabel('DeleteSelectionTitle', 'Delete selection'),
                message       : Na__LeCfg__FormatLabel('DeleteSelectionPrompt', 'Remove the {count} selected items from the sheet, including {viewports} viewport(s)? Sheet dimensions attached to a deleted viewport keep their paper length.', { count : doomed.length, viewports : viewports }),
                confirmLabel  : Na__LeCfg__GetLabel('DeleteLabel', 'Delete'),
                isDestructive : true
            });
            if (!ok) return false;
        }
        return Na__LeModel__DeleteItems(sheet, doomed) > 0;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Selection Set API
    // ------------------------------------------------------------
    export {
        Na__LeSelSet__Capture,
        Na__LeSelSet__Apply,
        Na__LeSelSet__Commit,
        Na__LeSelSet__Nudge,
        Na__LeSelSet__Delete
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
