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
// - A LEADER TIP FOLLOWS A VIEWPORT, NOT ITS TEXT. Dragging a text item on its
//   own moves the words and leaves the leader pointing where it points, and a
//   group does the same - unless the tip lies inside a viewport frame that is
//   moving with the group, when the tip goes with the drawing it points at.
//   Moving a view with its notes keeps every leader on its target; tidying a
//   column of notes leaves every leader still pointing. A leader of its own
//   (Sheet__Leaders) keeps the same rule: its head moves with the group, its
//   tip only with a viewport it points into.
// - Dimensions and vectors move whole, as a single whole-item drag moves them.
// - A delete that would take a viewport asks first, once, for the whole lot.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__: Capture, Apply and Commit for a group drag;
//   Nudge for the arrow keys; Delete for the Delete key and the context menu.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (14-Sep-2026)
// - ValeVision    : 1.0.0 ported 14-Sep-2026 as ValeVision v2.33.0, verbatim
//                   below the header, on top of the Leaders port (v2.32.0).
//                   Nothing here is app-specific; it writes only records both
//                   apps share. Later versions wait for their own sign-off.
// - Depends on    : Na__LeModel__GetLeaders and UpdateLeader for the leader row
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
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
    import { Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__GetViewportById,
        Na__LeModel__IsLayerLocked,
        Na__LeModel__UpdateViewport,
        Na__LeModel__UpdateAnnotation,
        Na__LeModel__UpdateDimension,
        Na__LeModel__UpdateShape,
        Na__LeModel__GetLeaders,
        Na__LeModel__UpdateLeader,
        Na__LeModel__DeleteItems
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__Refresh } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeShapeGeo__Points, Na__LeShapeGeo__Translated } from '../15__Core__Markup/Na__LayoutEditor__ShapeGeometry__.js';
    import { Na__AppUtils__ConfirmDialog__Show } from '../../03__AppUtils/Na__AppUtils__ConfirmDialog.js';
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
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Take Where Every Movable Selected Item Starts (at the press)
    // ------------------------------------------------------------
    // Returns the group, [{ kind, id, start }]. It is empty when nothing selected
    // can move, which still makes a valid drag: one that moves nothing.
    // ------------------------------------------------------------
    function Na__LeSelSet__Capture(sheet, items) {
        const group = Na__LeSelSet__Editable(sheet, items).map((e) => ({ kind : e.kind, id : e.id, start : e.row.start(e.record) }));
        // LEADER TIPS | A tip inside a frame that moves with the group goes with
        // it - a text item's leader and a leader's own tip alike
        const frames = group.filter((g) => g.kind === 'viewport').map((g) => Object.assign({}, Na__LeModel__GetViewportById(sheet, g.id).Viewport__FrameMm));
        group.forEach((g) => {
            if (!Number.isFinite(g.start.tipX) || !Number.isFinite(g.start.tipY)) return;
            g.start.tipFollows = frames.some((f) => g.start.tipX >= f.X && g.start.tipX <= f.X + f.WidthMm && g.start.tipY >= f.Y && g.start.tipY <= f.Y + f.HeightMm);
        });
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
