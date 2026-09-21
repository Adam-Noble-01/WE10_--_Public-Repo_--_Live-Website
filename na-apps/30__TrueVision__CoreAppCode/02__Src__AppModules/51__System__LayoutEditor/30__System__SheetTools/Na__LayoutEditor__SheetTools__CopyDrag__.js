// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET TOOLS - COPY DRAG
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetTools__CopyDrag__.js
// NAMESPACE  : Na__LeTools
// MODULE     : Layout Editor - Sheet Tools - Copy Drag
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Ctrl-drag carries a copy and leaves the original where it was, as in SketchUp LayOut
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - LAYOUT'S GESTURE. Hold Ctrl on the press of a move and the drag carries a
//   copy, leaving the original where it was - LayOut's Select tool: "hold
//   down the Ctrl key ... and LayOut creates a copy". Ctrl pressed DURING a
//   move turns it into a copy from there, as LayOut's Move tool and SketchUp's
//   do, and pressed again turns it back into a move. A tap is enough: the copy
//   stays on once Ctrl is let go, so the hand can go to an arrow key or the
//   number keys. The key is the key map's CopyDragModifier.
// - ONLY WHAT A DRAG WOULD MOVE. A whole-object move (text, a vector, a leader
//   or a dimension moved whole, several items together, a group) or a viewport
//   frame moved by its border. A grip, a crop handle, the rotate grip, a
//   vertex, a leader's tip, a dimension's end and a viewport's drawing never
//   copy, and nothing copies while a vector or a dimension is open. The Move
//   tool's catch is untouched: a viewport or a dimension copies under Move as
//   it moves under Move, and a locked one does neither.
// - NO COPY UNTIL IT MOVES. The copy is made when the press crosses the drag
//   threshold (SyncCopyDrag, from the pointer drag unit), never at the press,
//   so a Ctrl+click - which adds to the selection - never leaves a copy lying
//   unseen on the original. A press that starts as a copy travels PickDragPx
//   first, as a press that picks does, so a Ctrl+click that wobbles is still
//   only a click.
// - THE COPY BECOMES THE DRAG'S TARGET, AND NOTHING ELSE CHANGES. The original
//   goes back to where it started, the clipboard clones it there
//   (Na__LeClip__CloneInPlace - the records Ctrl+D would make: fresh ids, a
//   group's members and a dimension's viewport remapped, a viewport unlocked)
//   and the drag record is pointed at the clone. Its start, its grab point and
//   its handle stay the original's, because the clone sits exactly where the
//   original started - so the same ApplyDrag carries it, and the arrow-key axis
//   lock, Shift, Ortho, Grid Snap, the object snap, a viewport carried by a
//   point of its linework and a typed length hold a copy exactly as they hold
//   a move. The copy is what ends up selected. Inside an open group the copy
//   joins that group, beside the member it was copied from.
// - ONE UNDO STEP. The clone goes in silently and the drag announces once on
//   release, as every drag does, so one Ctrl+Z takes the copy away. A copy
//   turned back into a move is taken out silently, leaving nothing behind.
// - ARRAYS, SKETCHUP'S MOVE TOOL WAY. Once a copy has landed, 3x (x3, *3, 3*)
//   typed into the Measurements box puts copies at the copy's distance, twice
//   it and three times it - the copy itself the first of them - and /3 (3/)
//   divides that distance into three, the copy itself the last. Every array
//   copy is cloned from the ORIGINALS, which never move, and landed by a drag
//   record aimed at it with the pointer drag's own exact landing, so it lands
//   exactly as the copy did. A new count replaces the old; a new distance
//   (the pointer drag's RetypeMove) spaces them out again (FollowCopyArray).
//   Built silently: the pointer drag selects and announces once.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__PointerPress__ marks the drag at the press
//   (copyable, copy, roots); Na__LayoutEditor__SheetTools__PointerDrag__ runs
//   SyncCopyDrag once the press becomes a drag, and BuildCopyArray and
//   FollowCopyArray from TypeMoveArray and RetypeMove; Na__LayoutEditor__
//   SheetTools__Keyboard__ runs ToggleCopyDrag on the key and redraws the drag.
// - Imports none of the pointer or key units, so none of them can close a
//   cycle through it.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026)
// - ValeVision    : not yet ported - it waits for Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.1.0
// - SketchUp's copy arrays: BuildCopyArray (3x or /3 after a copy),
//   FollowCopyArray (a new distance spaces them again) and CopyArraySelection,
//   the landing handed in by the pointer drag. Make shares CloneAim with them.
//
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation: the copy made once a Ctrl press becomes a drag, Ctrl
//   during a move turning it into a copy and back, the original put back and
//   the clone carried in its place, one undo step.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Model, Surface, Groups, Clipboard, Selection Set, Viewport Snap Move, Edit Scope
    // ------------------------------------------------------------
    import {
        Na__LeModel__GetActiveSheet,
        Na__LeModel__GetGroupById,
        Na__LeModel__UpdateViewport,
        Na__LeModel__UpdateAnnotation,
        Na__LeModel__UpdateDimension,
        Na__LeModel__UpdateShape,
        Na__LeModel__UpdateLeader,
        Na__LeModel__DeleteItems,
        Na__LeModel__SetSelection,
        Na__LeModel__SetSelectionItems
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__Refresh, Na__LeSurface__RefreshNow } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeGroup__Expand, Na__LeGroup__ParentOf } from '../15__Core__Markup/Na__LayoutEditor__Groups__.js';
    import { Na__LeVpMove__Retarget } from '../28__System__ObjectSnap/Na__LayoutEditor__ViewportSnapMove__.js';
    import { Na__LeClip__CloneInPlace } from './Na__LayoutEditor__ItemClipboard__.js';
    import { Na__LeSelSet__Capture, Na__LeSelSet__Apply } from './Na__LayoutEditor__SelectionSet__.js';
    import { Na__LeScope__GetGroupId } from './Na__LayoutEditor__EditScope__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Sheet Tools State
    // ------------------------------------------------------------
    import { Na__LeTools__Stage, Na__LeTools__Editable, Na__LeTools__Drag } from './Na__LayoutEditor__SheetTools__State__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Cursor While a Copy Is Carried
    // ------------------------------------------------------------
    const Na__LeCopyDrag__CURSOR = 'copy';                                   // <-- The system's arrow with a plus: what Windows shows for a copy by drag
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Put What the Drag Is Carrying Back Where It Started (silent)
    // ------------------------------------------------------------
    // Ctrl pressed half way through a move finds the original already moved:
    // it goes home before it is cloned, so the copy - not the original - is
    // what ends up where the pointer is. Written from the drag's own start
    // record, the same fields ApplyDrag writes for a whole-object move. A press
    // that starts as a copy has not moved anything yet, so this rewrites what
    // is already there.
    // ------------------------------------------------------------
    function Na__LeCopyDrag__PutBack(sheet, drag) {
        const s = drag.start;
        if (drag.kind === 'group')      return Na__LeSelSet__Apply(sheet, drag.group, 0, 0);
        if (!s) return false;
        if (drag.kind === 'annotation') return Na__LeModel__UpdateAnnotation(sheet, drag.id, { posXMm : s.x, posYMm : s.y }, true);
        if (drag.kind === 'shape')      return Na__LeModel__UpdateShape(sheet, drag.id, { points : s.map((p) => [ p[0], p[1] ]) }, true);
        if (drag.kind === 'leader')     return Na__LeModel__UpdateLeader(sheet, drag.id, { tipXMm : s.tx, tipYMm : s.ty, anchorXMm : s.ax, anchorYMm : s.ay }, true);
        if (drag.kind === 'dimension')  return Na__LeModel__UpdateDimension(sheet, drag.id, { startXMm : s.sx, startYMm : s.sy, endXMm : s.ex, endYMm : s.ey }, true);
        if (drag.kind === 'viewport' && s.rect) return Na__LeModel__UpdateViewport(sheet, drag.id, { rect : { X : s.rect.X, Y : s.rect.Y } }, true);
        return false;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What a Copy Clones: the Roots the Move Carries
    // ------------------------------------------------------------
    // One item: the item pressed. Several: the selection at the press, less
    // anything the move leaves behind - a locked viewport, or anything on a
    // locked layer, stays put in a move and so is not copied either. A group
    // is copied whole when any of it moves.
    // ------------------------------------------------------------
    function Na__LeCopyDrag__Roots(sheet, drag) {
        const roots = Array.isArray(drag.roots) ? drag.roots : [];
        if (drag.kind !== 'group') return roots;
        const moving = new Set((drag.original.group || []).map((entry) => entry.kind + ':' + entry.id));
        return roots.filter((root) => {
            if (root.kind !== 'group') return moving.has(root.kind + ':' + root.id);
            return Na__LeGroup__Expand(sheet, [ root ]).some((member) => moving.has(member.kind + ':' + member.id));
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Inside an Open Group, the Copy Joins It
    // ------------------------------------------------------------
    // With a group open a press can only take its members, and a copy of one
    // belongs beside it: made at the top level, it would sit outside the open
    // group, faded and out of reach. Written silently into the member list; a
    // copy taken back out leaves it again through the model's own pruning.
    // ------------------------------------------------------------
    function Na__LeCopyDrag__JoinOpenGroup(sheet, cloned) {
        const openId = Na__LeScope__GetGroupId();
        const open   = openId ? Na__LeModel__GetGroupById(sheet, openId) : null;
        if (!open || !Array.isArray(open.Group__Members)) return false;
        let joined = false;
        cloned.from.forEach((root, index) => {
            const parent = Na__LeGroup__ParentOf(sheet, root.kind, root.id);
            if (!parent || parent.Group__Id !== openId) return;
            open.Group__Members.push({ kind : cloned.roots[index].kind, id : cloned.roots[index].id });
            joined = true;
        });
        return joined;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Select These Roots (one, or several)
    // ------------------------------------------------------------
    function Na__LeCopyDrag__Select(roots) {
        const items = (roots || []).map((root) => ({ kind : root.kind, id : root.id }));
        if (items.length === 1) Na__LeModel__SetSelection(items[0]);
        else Na__LeModel__SetSelectionItems(items);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Cursor Says Copy While a Copy Is Carried
    // ------------------------------------------------------------
    // The pointer drag leaves the cursor alone while it runs, so this is what
    // tells the hand which of the two it is holding - which matters most when
    // Ctrl has been tapped and let go. The next hover sets it again after the
    // release.
    // ------------------------------------------------------------
    function Na__LeCopyDrag__ShowCursor(drag) {
        const stage = Na__LeTools__Stage;
        if (!stage || !stage.style) return;
        if (drag.copied) {
            if (typeof drag.cursorBefore !== 'string') drag.cursorBefore = stage.style.cursor || '';
            stage.style.cursor = Na__LeCopyDrag__CURSOR;
        } else if (typeof drag.cursorBefore === 'string') {
            stage.style.cursor = drag.cursorBefore;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Redraw After the Target Changed Hands
    // ------------------------------------------------------------
    // A viewport carried by a point of its linework is marked by its frame
    // (Na__LayoutEditor__ViewportSnapMove__). A cloned frame only exists once
    // the frames are drawn, so they are drawn at once rather than on the next
    // animation frame, and the mark moves across to whichever frame is now
    // being carried.
    // ------------------------------------------------------------
    function Na__LeCopyDrag__Redraw(drag, fromId) {
        if (drag.kind === 'viewport') {
            Na__LeSurface__RefreshNow('frames');
            Na__LeVpMove__Retarget(drag, fromId);
        } else {
            Na__LeSurface__Refresh('frames');
        }
        Na__LeSurface__Refresh('markup');
        Na__LeCopyDrag__ShowCursor(drag);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Clone the Originals Where They Stand, and Say What a Drag Aimed at the Clone Carries
    // ------------------------------------------------------------
    // The originals of a copy never move, so every clone starts exactly where
    // the drag's start record says - the copy's own start, and each array
    // copy's. Returns { cloned, aim } - aim is { id } for one item or
    // { group } for several, to lay over the drag - or null.
    // ------------------------------------------------------------
    function Na__LeCopyDrag__CloneAim(sheet, drag) {
        const cloned = Na__LeClip__CloneInPlace(sheet, Na__LeCopyDrag__Roots(sheet, drag));
        if (!cloned) return null;
        Na__LeCopyDrag__JoinOpenGroup(sheet, cloned);
        const aim = drag.kind === 'group'
            ? { group : Na__LeSelSet__Capture(sheet, Na__LeGroup__Expand(sheet, cloned.roots)) }
            : { id : cloned.roots[0].id };
        return { cloned : cloned, aim : aim };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Make the Copy and Carry It Instead of the Original
    // ------------------------------------------------------------
    function Na__LeCopyDrag__Make(sheet, drag) {
        if (!drag.original) drag.original = { id : drag.id, group : drag.group };
        const fromId = drag.id;
        Na__LeCopyDrag__PutBack(sheet, drag);
        const made = Na__LeCopyDrag__CloneAim(sheet, drag);
        if (!made) { drag.copy = false; return false; }                      // <-- Nothing could be copied: it stays a move, and the rerun carries the original again
        drag.copied = made.cloned;
        Object.assign(drag, made.aim);
        Na__LeCopyDrag__Select(made.cloned.roots);
        Na__LeCopyDrag__Redraw(drag, fromId);
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Take the Copy Away and Carry the Original Again
    // ------------------------------------------------------------
    function Na__LeCopyDrag__Drop(sheet, drag) {
        const copied = drag.copied;
        const fromId = drag.id;
        drag.copied  = null;
        Na__LeModel__DeleteItems(sheet, copied.items, true);                 // <-- Silent: the drag's release is still the one announcement
        if (drag.kind === 'group') drag.group = drag.original.group;
        else drag.id = drag.original.id;
        Na__LeCopyDrag__Select(drag.roots);
        Na__LeCopyDrag__Redraw(drag, fromId);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Array: SketchUp's 3x and /3 After a Copy
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | How Far Along the Copy's Distance Each Further Copy Sits
    // ------------------------------------------------------------
    // The copy that was dragged is always one of the array, at the whole
    // distance. 'times' N puts the rest at 2, 3 ... N times it; 'divide' N at
    // 1/N, 2/N ... (N-1)/N of it. Either way N copies in all.
    // ------------------------------------------------------------
    function Na__LeCopyDrag__Factors(spec) {
        const out = [];
        const n   = Math.max(1, Math.floor(spec.count));
        if (spec.mode === 'divide') { for (let k = 1; k < n; k++) out.push(k / n); }
        else                        { for (let k = 2; k <= n; k++) out.push(k); }
        return out;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Offset of a Copy That Sits a Factor Along the Distance
    // ------------------------------------------------------------
    // lengthMm is signed along dir - a minus sign typed first runs the other
    // way - so neither is ever taken as an absolute.
    // ------------------------------------------------------------
    function Na__LeCopyDrag__Offset(record, factor) {
        return { x : record.dir.x * record.lengthMm * factor, y : record.dir.y * record.lengthMm * factor };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Take the Array's Further Copies Away (silent)
    // ------------------------------------------------------------
    function Na__LeCopyDrag__ClearArray(sheet, record) {
        const array = record.array;
        record.array = null;
        if (!array) return false;
        const items = [];
        array.extras.forEach((extra) => extra.items.forEach((item) => items.push(item)));
        if (items.length) Na__LeModel__DeleteItems(sheet, items, true);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | What Is Selected Once an Array Lands
    // ------------------------------------------------------------
    // Returned rather than applied: the pointer drag selects it, having first
    // told its retype record what the selection will be, because a change of
    // selection refreshes the Measurements box at once and the box must still
    // find the copy on offer when it looks.
    // ------------------------------------------------------------
    function Na__LeTools__CopyArraySelection(record) {
        const roots = (record && record.drag && record.drag.copied && record.drag.copied.roots) || [];
        return roots.map((root) => ({ kind : root.kind, id : root.id }));
    }
    // ------------------------------------------------------------


    // FUNCTION | Make an Array of a Copy That Has Just Landed (silent)
    // ------------------------------------------------------------
    // record : the last move's retype record, whose drag carried a copy
    // spec   : { mode : 'times' | 'divide', count }
    // land   : (sheet, drag, delta) puts what a drag carries exactly delta
    //          from its start - the pointer drag's own exact landing, handed
    //          in so this unit never imports the pointer drag
    // Any array the copy already had goes first: a new count replaces the
    // old. Each further copy is cloned from the originals where they stand -
    // the same records the copy itself was made from - and landed by a drag
    // record aimed at it, so a note, a vector, a leader, a dimension, a frame
    // or a whole selection lands exactly as the copy did. Nothing is
    // announced and the selection is not touched (CopyArraySelection says
    // what it should be): the caller does both, once. Returns true when it
    // ran.
    // ------------------------------------------------------------
    function Na__LeTools__BuildCopyArray(sheet, record, spec, land) {
        const drag = record && record.drag;
        if (!sheet || !drag || !drag.copied || !spec || typeof land !== 'function') return false;
        Na__LeCopyDrag__ClearArray(sheet, record);
        const extras = [];
        Na__LeCopyDrag__Factors(spec).forEach((factor) => {
            const made = Na__LeCopyDrag__CloneAim(sheet, drag);
            if (!made) return;
            const aimed = Object.assign({}, drag, made.aim, { copied : null, copy : false, original : null });
            land(sheet, aimed, Na__LeCopyDrag__Offset(record, factor));
            extras.push({ drag : aimed, factor : factor, roots : made.cloned.roots, items : made.cloned.items });
        });
        record.array = { mode : spec.mode, count : spec.count, extras : extras };
        Na__LeSurface__Refresh('frames');
        Na__LeSurface__Refresh('markup');
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | A New Distance Was Typed: Space the Array Out Again (silent)
    // ------------------------------------------------------------
    // The copy has just been landed again at record.lengthMm; every further
    // copy goes to its own fraction or multiple of that, from its own start.
    // A copy that has gone is skipped - the caller's check that everything is
    // where it landed ends the run before it could come to that.
    // ------------------------------------------------------------
    function Na__LeTools__FollowCopyArray(sheet, record, land) {
        if (!sheet || !record || !record.array || typeof land !== 'function') return false;
        record.array.extras.forEach((extra) => land(sheet, extra.drag, Na__LeCopyDrag__Offset(record, extra.factor)));
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Bring the Sheet in Line With What the Drag Should Carry
    // ------------------------------------------------------------
    // drag.copy says whether a copy is wanted; drag.copied holds the one that
    // exists. The pointer drag unit calls this once the press crosses the drag
    // threshold, and ToggleCopyDrag whenever the key changes it mid-move. It
    // only makes or removes the copy and repoints the drag: the caller moves
    // whatever is carried to the pointer (ApplyDrag, or a rerun of it).
    // Returns true when the sheet changed.
    // ------------------------------------------------------------
    function Na__LeTools__SyncCopyDrag(sheet, drag) {
        if (!sheet || !drag || drag.copyable !== true) return false;
        const want = drag.copy === true;
        if (want === !!drag.copied) return false;
        return want ? Na__LeCopyDrag__Make(sheet, drag) : Na__LeCopyDrag__Drop(sheet, drag);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Copy Key Went Down During a Drag: Copy, or Move Again
    // ------------------------------------------------------------
    // Flips the drag between carrying a copy and carrying the original. Under
    // the drag threshold it only changes what the drag will do once it moves.
    // Returns true when the drag took the key; the keyboard then redraws the
    // drag from the last pointer position.
    // ------------------------------------------------------------
    function Na__LeTools__ToggleCopyDrag() {
        const drag = Na__LeTools__Drag;
        if (!Na__LeTools__Editable || !drag || drag.copyable !== true) return false;
        drag.copy = drag.copy !== true;
        const sheet = Na__LeModel__GetActiveSheet();
        if (drag.moved === true && sheet) Na__LeTools__SyncCopyDrag(sheet, drag);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Copy Being Carried Right Now
    // ------------------------------------------------------------
    function Na__LeTools__IsCopyDrag(drag) {
        const d = drag || Na__LeTools__Drag;                                 // <-- Asked with nothing, it means the drag in flight
        return !!(d && d.copied);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Sheet Tools Copy Drag
    // ------------------------------------------------------------
    export {
        Na__LeTools__SyncCopyDrag,
        Na__LeTools__ToggleCopyDrag,
        Na__LeTools__IsCopyDrag,
        Na__LeTools__BuildCopyArray,
        Na__LeTools__FollowCopyArray,
        Na__LeTools__CopyArraySelection
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
