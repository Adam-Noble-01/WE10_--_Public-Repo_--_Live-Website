// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - MOVE ANCHOR
// =============================================================================
//
// FILE       : Na__LayoutEditor__MoveAnchor__.js
// NAMESPACE  : Na__LeAnchor
// MODULE     : Layout Editor - Move Anchor (Ctrl+click an item, then move it from this point to that point)
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : A red cross that Ctrl+click puts on one item or one group, that can be dragged onto any snap point, and that is then the one point the item is moved by
// CREATED    : 22-Sep-2026
//
// DESCRIPTION:
// - From Adam, 22-Sep-2026: "Modifier key = Control + Select. If any single
//   object / single group is selected with control held down, a red crosshair
//   appears in the centre of its bounds. This becomes a point you can grab and
//   move around and snap to vertices on other objects, and becomes its
//   reference point for moving - so you can say move from this point to this
//   point." His sketch: the cross dragged from the middle of a box onto its
//   top-right corner, then the box moved by that corner onto the same corner
//   of the box above it.
// - SKETCHUP LAYOUT HAS THE SAME IDEA, ALWAYS ON. Every selection in LayOut
//   carries a crosshair in the middle of its box - the move point, which is
//   also the centre of rotation - and dragging the crosshair re-places it, so
//   the entity is then moved by that point. It is always there, over every
//   selection, whether a move is wanted or not, and LayOut users report that
//   it does not snap reliably and that since LayOut 2024 a move only snaps by
//   a point if the press lands near one (SketchUp forums, 2024: "LO default
//   center point does not snap to other snapping points"; "LayOut 2024 Object
//   Snapping"). Here it is asked for, with Ctrl+click, and is otherwise never
//   on the screen; and it snaps exactly as a drawn point does, through the
//   editor's own object snap.
//
// HOW IT IS USED:
// - CTRL+CLICK ONE ITEM, OR ONE GROUP (a click: a Ctrl-DRAG is still a copy).
//   The red cross comes up in the middle of its box, and the Move tool comes
//   up with it, whatever the item - a viewport and a dimension included,
//   because asking for the cross is asking to move the thing. With something
//   else already selected Ctrl adds, as it always has, and a cross is only
//   ever put on a selection of ONE. Ctrl+click it again to put the cross back
//   in the middle.
// - DRAG THE CROSS to re-place it. It snaps to everything object snap offers
//   (F3) - the item's OWN corners and edges included, which is usually what is
//   wanted - and to the corners, the middles of the sides and the middle of
//   the item's box, the points LayOut's move point is dragged to. An arrow key
//   holds it to an axis from where it was, and Shift or Ortho (F8) to the
//   nearer one. Double-click the cross to put it back in the middle.
// - DRAG THE ITEM, from anywhere on it, and it is carried by the cross: the
//   cross, and no other point of the item, snaps - onto a corner, a midpoint,
//   a crossing, the title block, the grid (F7) - and a dashed band runs from
//   where the cross started to where it is now. That is "from this point to
//   that point". The arrow keys, Shift and Ortho hold the move to an axis as
//   they hold any move; a length typed in the Measurements box lands it that
//   far along the line exactly; a Ctrl-drag carries a copy by the cross, and
//   the copy keeps a cross of its own. A viewport carried by its cross keeps
//   the tracking lines of a viewport carried by a point of its drawing.
//
// WHERE IT LIVES AND WHEN IT GOES:
// - ON THE ITEM, NOT ON THE PAPER. The cross is kept as a place on the item's
//   box - a fraction of its width and of its height - so it rides along with
//   the item: a move, a nudge, a typed move and an undo all carry it. A box
//   with no width (a plain vertical line) keeps it as an offset instead.
// - IT GOES when the selection is anything other than that one item, when a
//   container is opened or closed, when a tool other than Select or Move is
//   picked, on Escape (which drops the selection), and on another sheet.
// - NOTHING IS WRITTEN TO THE SHEET. The cross is a way of moving, not part of
//   the drawing: placing it is no undo step and is never saved. The move it
//   makes is one undo step, like every move.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__PointerPress__ arms it on a Ctrl+click
//   (Arm), starts a relocation when a press lands on it (Grab) and hands a
//   move drag its point (ForDrag); a double click on it recentres it.
// - Na__LayoutEditor__SheetTools__PointerDrag__ relocates it (Relocate),
//   carries a move by it (Carry, or ShowAt after a viewport's own carry),
//   marks it under the pointer (Hover) and closes a drag (Finish).
// - Na__LayoutEditor__SheetTools__HitResolution__ asks Holds and HoldsItems:
//   an item with a cross keeps the Move tool up.
// - Na__LayoutEditor__SheetTools__ loads its config on Attach (Ready) and puts
//   it right after every model change and settled zoom (Refresh);
//   Na__LayoutEditor__SheetTools__ToolState__ clears it for a placing tool.
// - The look is in Na__LayoutEditor__Styles__ObjectSnap__.css, the settings
//   in Na__LayoutEditor__MoveAnchor__Config__.json, and the key in
//   Na__Hotkeys__DrawingTabs__.json (SelectionBindings MoveAnchorModifier).
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (22-Sep-2026).
// - ValeVision    : not yet ported - it waits for Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.0.0
// - First cut: Ctrl+click arms the cross in the middle of one item's box;
//   dragged, it snaps to object snap, the item's own box and the grid; a move
//   of the item is carried by it alone; double-click or Ctrl+click recentres.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Model, Surface, Groups, Snapping, Axis Lock, Band, Edit Scope, Measurements
    // ------------------------------------------------------------
    import { Na__LeModel__GetSelectionItems } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__GetElements, Na__LeSurface__GetPixelsPerMm, Na__LeSurface__GetZoom } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeGroup__ItemsBounds } from '../15__Core__Markup/Na__LayoutEditor__Groups__.js';   // <-- The box round any one item, a group included
    import {
        Na__LeOsnap__KIND_END,
        Na__LeOsnap__KIND_MID,
        Na__LeOsnap__KIND_CEN,
        Na__LeOsnap__TARGET_VIEWPORT,
        Na__LeOsnap__TARGET_SHAPE,
        Na__LeOsnap__TARGET_TEXT,
        Na__LeOsnap__TARGET_DIMENSION,
        Na__LeOsnap__IsEnabled,
        Na__LeOsnap__RadiusMm,
        Na__LeOsnap__Find,
        Na__LeOsnap__FindGrid,
        Na__LeOsnap__ShowMarker,
        Na__LeOsnap__HideMarker
    } from './Na__LayoutEditor__ObjectSnap__Search__.js';
    import { Na__LeOsnap__IsModeOn } from './Na__LayoutEditor__ObjectSnap__State__.js';
    import { Na__LeAxis__AXIS_X, Na__LeAxis__AXIS_Y, Na__LeAxis__Get } from '../30__System__SheetTools/Na__LayoutEditor__AxisLock__.js';
    import { Na__LeGrips__ShowBand, Na__LeGrips__HideBand } from '../30__System__SheetTools/Na__LayoutEditor__Grips__.js';
    import { Na__LeScope__Path } from '../30__System__SheetTools/Na__LayoutEditor__EditScope__.js';   // <-- The container open when the cross was set: another one ends it
    import { Na__LeMeasure__Say } from '../30__System__SheetTools/Na__LayoutEditor__Measurements__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Drag, the Element, the Config
    // ------------------------------------------------------------
    const Na__LeAnchor__DRAG_KIND = 'moveanchor';                              // <-- The sheet tools' drag record for a press on the cross (a leader's 'anchor' is its head: a different thing)
    const Na__LeAnchor__CLASS     = 'na-le-move-anchor';
    const Na__LeAnchor__EPS_MM    = 1e-6;                                      // <-- A box narrower than this keeps the cross as an offset, not a fraction
    const Na__LeAnchor__ConfigUrl = new URL('./Na__LayoutEditor__MoveAnchor__Config__.json', import.meta.url);
    const Na__LeAnchor__PREFIX    = 'LayoutEditor__MoveAnchor__';
    const Na__LeAnchor__FALLBACK  = Object.freeze({ enabled : true, ownBox : true, say : true, crossSizePx : 26, grabRadiusPx : 10 });
    const Na__LeAnchor__SCORE     = Object.freeze({ end : 1, mid : 1.25, cen : 1.25 });   // <-- The search's own weights: an endpoint wins a near tie
    const Na__LeAnchor__SVG       =
        '<svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true" focusable="false">' +
            '<g class="na-le-move-anchor__halo"><line x1="12" y1="0" x2="12" y2="24"/><line x1="0" y1="12" x2="24" y2="12"/><circle cx="12" cy="12" r="5"/></g>' +
            '<g class="na-le-move-anchor__ink"><line x1="12" y1="0" x2="12" y2="24"/><line x1="0" y1="12" x2="24" y2="12"/><circle cx="12" cy="12" r="5"/></g>' +
        '</svg>';
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Cross, Where It Is Drawn, Its Element and the Config
    // ------------------------------------------------------------
    let Na__LeAnchor__Held    = null;      // <-- { sheetId, kind, id, scope, fx, fy, ox, oy } the item it is on and where on its box
    let Na__LeAnchor__Live    = null;      // <-- { x, y } where a drag has it right now: the paper point, before anything is stored
    let Na__LeAnchor__El      = null;
    let Na__LeAnchor__Config  = null;
    let Na__LeAnchor__Loading = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Config
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One Setting, From the Config or the Built-In Value
    // ------------------------------------------------------------
    function Na__LeAnchor__Value(block, key, fallback) {
        const section = Na__LeAnchor__Config ? Na__LeAnchor__Config[Na__LeAnchor__PREFIX + block] : null;
        const value   = (section && typeof section === 'object') ? section[block + '__' + key] : undefined;
        if (typeof fallback === 'boolean') return typeof value === 'boolean' ? value : fallback;
        if (typeof fallback === 'number')  return (typeof value === 'number' && Number.isFinite(value) && value > 0) ? value : fallback;
        return (typeof value === 'string' && value) ? value : fallback;
    }
    function Na__LeAnchor__Setup() {
        const f = Na__LeAnchor__FALLBACK;
        return {
            enabled      : Na__LeAnchor__Value('Behaviour', 'Enabled', f.enabled),
            ownBox       : Na__LeAnchor__Value('Behaviour', 'SnapToOwnBox', f.ownBox),
            say          : Na__LeAnchor__Value('Behaviour', 'SayWhatToDo', f.say),
            crossSizePx  : Na__LeAnchor__Value('Look', 'CrossSizePx', f.crossSizePx),
            grabRadiusPx : Na__LeAnchor__Value('Look', 'GrabRadiusPx', f.grabRadiusPx)
        };
    }
    function Na__LeAnchor__Label(key, fallback) {
        return Na__LeAnchor__Value('Labels', key, fallback);
    }
    // ------------------------------------------------------------


    // FUNCTION | Fetch the Config Once (never rejects; the built-in values stand in)
    // ------------------------------------------------------------
    function Na__LeAnchor__Ready() {
        if (!Na__LeAnchor__Loading) {
            Na__LeAnchor__Loading = (async () => {
                try {
                    const response = await fetch(Na__LeAnchor__ConfigUrl, { cache : 'no-store' });
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    Na__LeAnchor__Config = await response.json();
                } catch (error) {
                    console.warn('[TrueVision3D LayoutEditor] Move anchor config unavailable - the built-in settings are used.', error);
                    Na__LeAnchor__Config = null;
                }
                if (Na__LeAnchor__El && !Na__LeAnchor__El.hidden) Na__LeAnchor__Place(Na__LeAnchor__El.__naAt);   // <-- A cross already up takes the config's size
                return Na__LeAnchor__Config;
            })();
        }
        return Na__LeAnchor__Loading;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Item's Box, and Where on It the Cross Sits
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Box Round One Item on the Paper ({ X, Y, WidthMm, HeightMm }), or Null
    // ------------------------------------------------------------
    function Na__LeAnchor__BoxOf(sheet, item) {
        if (!sheet || !item || !item.kind || !item.id) return null;
        const box = Na__LeGroup__ItemsBounds(sheet, [ { kind : item.kind, id : item.id } ]);
        return (box && Number.isFinite(box.X) && Number.isFinite(box.Y)) ? box : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Paper Point as a Place on a Box, and Back
    // ------------------------------------------------------------
    // A fraction of the width and of the height, so the cross stays on the
    // same corner when the item grows or shrinks; an offset besides, for a
    // box with no width or no height, where a fraction means nothing.
    // ------------------------------------------------------------
    function Na__LeAnchor__PlaceOn(box, point) {
        const w = box.WidthMm, h = box.HeightMm;
        return {
            fx : w > Na__LeAnchor__EPS_MM ? (point.x - box.X) / w : 0.5,
            fy : h > Na__LeAnchor__EPS_MM ? (point.y - box.Y) / h : 0.5,
            ox : point.x - box.X,
            oy : point.y - box.Y
        };
    }
    function Na__LeAnchor__PointOn(box, place) {
        return {
            x : box.WidthMm  > Na__LeAnchor__EPS_MM ? box.X + (place.fx * box.WidthMm)  : box.X + place.ox,
            y : box.HeightMm > Na__LeAnchor__EPS_MM ? box.Y + (place.fy * box.HeightMm) : box.Y + place.oy
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where the Open Containers Stand, as One String
    // ------------------------------------------------------------
    function Na__LeAnchor__ScopeKey() {
        return Na__LeScope__Path().map((entry) => entry.kind + ':' + entry.id).join('/');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is the Cross Still Wanted: the Same Sheet, the Same One Item Selected, the Same Container
    // ------------------------------------------------------------
    function Na__LeAnchor__Valid(sheet) {
        const held = Na__LeAnchor__Held;
        if (!held || !sheet || held.sheetId !== sheet.Sheet__Id) return false;
        const items = Na__LeModel__GetSelectionItems();
        if (items.length !== 1 || items[0].kind !== held.kind || items[0].id !== held.id) return false;
        return held.scope === Na__LeAnchor__ScopeKey();
    }
    // ------------------------------------------------------------


    // FUNCTION | Where the Cross Is Now, on the Paper ({ x, y }), or Null When There Is None
    // ------------------------------------------------------------
    function Na__LeAnchor__Point(sheet) {
        if (Na__LeAnchor__Live) return { x : Na__LeAnchor__Live.x, y : Na__LeAnchor__Live.y };
        if (!Na__LeAnchor__Valid(sheet)) return null;
        const box = Na__LeAnchor__BoxOf(sheet, Na__LeAnchor__Held);
        return box ? Na__LeAnchor__PointOn(box, Na__LeAnchor__Held) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Does the Cross Belong to This Item, or to This Selection of One
    // ------------------------------------------------------------
    // Asked by the hit resolution before the Move tool is put down: an item
    // with a cross on it is an item somebody has asked to move.
    // ------------------------------------------------------------
    function Na__LeAnchor__Holds(sheet, item) {
        if (!item || !Na__LeAnchor__Valid(sheet)) return false;
        return Na__LeAnchor__Held.kind === item.kind && Na__LeAnchor__Held.id === item.id;
    }
    function Na__LeAnchor__HoldsItems(sheet, items) {
        return Array.isArray(items) && items.length === 1 && Na__LeAnchor__Holds(sheet, items[0]);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Cross on the Paper
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Draw the Cross at a Paper Point, or Take It Away (null)
    // ------------------------------------------------------------
    // PLACED BY ONE TRANSFORM, as the snap marker is, and for the same reason:
    // left and top are rounded to a device pixel BEFORE the paper's zoom is
    // applied, which moves the cross off its point by up to half a pixel times
    // the zoom. Drawn at its size in screen pixels and scaled back by 1 / zoom,
    // so it is the same size at any zoom.
    // ------------------------------------------------------------
    function Na__LeAnchor__Place(point) {
        const layer = Na__LeSurface__GetElements().handles;
        if (!point || !layer || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
            if (Na__LeAnchor__El) { Na__LeAnchor__El.hidden = true; Na__LeAnchor__El.__naAt = null; }
            return false;
        }
        if (!Na__LeAnchor__El) {
            Na__LeAnchor__El = document.createElement('div');
            Na__LeAnchor__El.className = Na__LeAnchor__CLASS;
            Na__LeAnchor__El.innerHTML = Na__LeAnchor__SVG;
            Na__LeAnchor__El.style.left            = '0px';
            Na__LeAnchor__El.style.top             = '0px';
            Na__LeAnchor__El.style.transformOrigin = '0 0';
        }
        if (Na__LeAnchor__El.parentNode !== layer) layer.appendChild(Na__LeAnchor__El);
        const ppm  = Na__LeSurface__GetPixelsPerMm();
        const zoom = Math.max(1e-6, Na__LeSurface__GetZoom());
        const size = Na__LeAnchor__Setup().crossSizePx;
        Na__LeAnchor__El.style.width     = size + 'px';
        Na__LeAnchor__El.style.height    = size + 'px';
        Na__LeAnchor__El.style.transform = 'translate(' + (point.x * ppm) + 'px, ' + (point.y * ppm) + 'px) scale(' + (1 / zoom) + ') translate(-50%, -50%)';
        Na__LeAnchor__El.__naAt = { x : point.x, y : point.y };
        Na__LeAnchor__El.hidden = false;
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Mark What the Cross Is Doing (hover, being dragged, carrying a move)
    // ------------------------------------------------------------
    function Na__LeAnchor__State(name, on) {
        if (Na__LeAnchor__El) Na__LeAnchor__El.classList.toggle(Na__LeAnchor__CLASS + '--' + name, !!on);
    }
    // ------------------------------------------------------------


    // FUNCTION | Draw the Cross Where It Belongs, or Drop It When It No Longer Does
    // ------------------------------------------------------------
    // Run after every model change and every settled zoom (the sheet tools'
    // repaint of the counter-scaled boxes): a nudge, an undo or a typed move
    // carries it with the item, and a selection of anything else ends it.
    // While a drag has it, the drag says where it is and nothing is dropped:
    // a copy made half way through a move changes the selection under it.
    // ------------------------------------------------------------
    function Na__LeAnchor__Refresh(sheet) {
        if (Na__LeAnchor__Live) { Na__LeAnchor__Place(Na__LeAnchor__Live); return true; }
        if (Na__LeAnchor__Held && !Na__LeAnchor__Valid(sheet)) { Na__LeAnchor__Clear(); return false; }
        return Na__LeAnchor__Place(Na__LeAnchor__Point(sheet));
    }
    // ------------------------------------------------------------


    // FUNCTION | Forget the Cross (a placing tool, Escape, leaving the editor)
    // ------------------------------------------------------------
    function Na__LeAnchor__Clear() {
        const had = !!Na__LeAnchor__Held || !!Na__LeAnchor__Live;
        Na__LeAnchor__Held = null;
        Na__LeAnchor__Live = null;
        if (Na__LeAnchor__El) {
            Na__LeAnchor__El.hidden = true;
            Na__LeAnchor__El.__naAt = null;
            [ 'hover', 'moving', 'carrying' ].forEach((name) => Na__LeAnchor__State(name, false));
        }
        return had;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Setting It, Finding It Under the Pointer, Putting It Back in the Middle
// -----------------------------------------------------------------------------

    // FUNCTION | Put the Cross in the Middle of One Item's Box (the Ctrl+click)
    // ------------------------------------------------------------
    // Returns the point, or null when the item has no box (or the cross is
    // switched off in the config). A second Ctrl+click on the same item puts a
    // cross that was moved back in the middle.
    // ------------------------------------------------------------
    function Na__LeAnchor__Arm(sheet, item) {
        Na__LeAnchor__Ready();
        if (!Na__LeAnchor__Setup().enabled) return null;
        const box = Na__LeAnchor__BoxOf(sheet, item);
        if (!box) return null;
        const middle = { x : box.X + (box.WidthMm / 2), y : box.Y + (box.HeightMm / 2) };
        Na__LeAnchor__Held = Object.assign({ sheetId : sheet.Sheet__Id, kind : item.kind, id : item.id, scope : Na__LeAnchor__ScopeKey() }, Na__LeAnchor__PlaceOn(box, middle));
        Na__LeAnchor__Live = null;
        Na__LeAnchor__Place(middle);
        Na__LeAnchor__Tell('Armed', 'Move anchor set. Drag the red cross onto a point to move by it, then drag the item. Double-click the cross to centre it.');
        return middle;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put a Moved Cross Back in the Middle (the double click on it)
    // ------------------------------------------------------------
    function Na__LeAnchor__Recentre(sheet) {
        if (!Na__LeAnchor__Valid(sheet)) return false;
        const box = Na__LeAnchor__BoxOf(sheet, Na__LeAnchor__Held);
        if (!box) return false;
        Object.assign(Na__LeAnchor__Held, Na__LeAnchor__PlaceOn(box, { x : box.X + (box.WidthMm / 2), y : box.Y + (box.HeightMm / 2) }));
        Na__LeAnchor__Refresh(sheet);
        Na__LeAnchor__Tell('Recentred', 'Move anchor back in the middle.');
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Say a Line Above the Measurements Box, When the Config Wants It
    // ------------------------------------------------------------
    function Na__LeAnchor__Tell(key, fallback) {
        if (!Na__LeAnchor__Setup().say) return false;
        return Na__LeMeasure__Say(Na__LeAnchor__Label(key, fallback));
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Paper Point on the Cross (within GrabRadiusPx on screen)
    // ------------------------------------------------------------
    function Na__LeAnchor__HitAt(sheet, pointMm) {
        const at = pointMm ? Na__LeAnchor__Point(sheet) : null;
        if (!at) return false;
        const reachMm = Na__LeAnchor__Setup().grabRadiusPx / Math.max(1e-6, Na__LeSurface__GetPixelsPerMm() * Na__LeSurface__GetZoom());
        return Math.hypot(pointMm.x - at.x, pointMm.y - at.y) <= reachMm;
    }
    // ------------------------------------------------------------


    // FUNCTION | Hover: Light the Cross Up While the Pointer Is On It (returns whether it is)
    // ------------------------------------------------------------
    function Na__LeAnchor__Hover(sheet, pointMm) {
        const on = Na__LeAnchor__HitAt(sheet, pointMm);
        Na__LeAnchor__State('hover', on);
        return on;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Press on the Cross: the Drag Record That Re-Places It, or Null
    // ------------------------------------------------------------
    // The sheet tools add startMm, moved, pointerId and click, as they do to
    // every drag, and hand each move of it to Relocate.
    // ------------------------------------------------------------
    function Na__LeAnchor__Grab(sheet, pointMm) {
        if (!Na__LeAnchor__HitAt(sheet, pointMm)) return null;
        const from = Na__LeAnchor__Point(sheet);
        return { kind : Na__LeAnchor__DRAG_KIND, fromMm : from };
    }
    function Na__LeAnchor__IsDrag(drag) {
        return !!drag && drag.kind === Na__LeAnchor__DRAG_KIND;
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Move of This Selection Is Carried By: the Cross, or Null
    // ------------------------------------------------------------
    // Asked by the press for a whole-object move, a selection moved as one or
    // a frame move. The place on the box goes into the drag with the point,
    // so a copy the drag makes on the way can be given a cross of its own.
    // ------------------------------------------------------------
    function Na__LeAnchor__ForDrag(sheet, items) {
        if (!Na__LeAnchor__HoldsItems(sheet, items)) return null;
        const at = Na__LeAnchor__Point(sheet);
        if (!at) return null;
        const held = Na__LeAnchor__Held;
        return { x : at.x, y : at.y, fx : held.fx, fy : held.fy, ox : held.ox, oy : held.oy };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Where a Dragged Point Lands
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Snap Target a Kind of Item Colours Its Own Box Points With
    // ------------------------------------------------------------
    function Na__LeAnchor__TargetFor(kind) {
        if (kind === 'viewport')   return Na__LeOsnap__TARGET_VIEWPORT;
        if (kind === 'annotation') return Na__LeOsnap__TARGET_TEXT;
        if (kind === 'dimension')  return Na__LeOsnap__TARGET_DIMENSION;
        return Na__LeOsnap__TARGET_SHAPE;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Nearest of the Item's Own Box Points Within the Snap Radius, or Null
    // ------------------------------------------------------------
    // LAYOUT'S MOVE POINT GOES TO THE CORNERS AND MIDDLES OF THE BOX, so this
    // one does too: the four corners (Endpoint), the middle of each side
    // (Midpoint) and the middle (Centre), each only while its running mode is
    // on. For a text item, a viewport or a group they are often the only
    // corners it has. Scored as the search scores its own points.
    // ------------------------------------------------------------
    function Na__LeAnchor__BoxHit(box, kind, pointMm) {
        if (!box || !pointMm || !Na__LeAnchor__Setup().ownBox || !Na__LeOsnap__IsEnabled()) return null;
        const radius = Na__LeOsnap__RadiusMm();
        const x0 = box.X, y0 = box.Y, x1 = box.X + box.WidthMm, y1 = box.Y + box.HeightMm;
        const xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
        const offer = [];
        if (Na__LeOsnap__IsModeOn(Na__LeOsnap__KIND_END)) offer.push([ x0, y0, Na__LeOsnap__KIND_END ], [ x1, y0, Na__LeOsnap__KIND_END ], [ x1, y1, Na__LeOsnap__KIND_END ], [ x0, y1, Na__LeOsnap__KIND_END ]);
        if (Na__LeOsnap__IsModeOn(Na__LeOsnap__KIND_MID)) offer.push([ xm, y0, Na__LeOsnap__KIND_MID ], [ x1, ym, Na__LeOsnap__KIND_MID ], [ xm, y1, Na__LeOsnap__KIND_MID ], [ x0, ym, Na__LeOsnap__KIND_MID ]);
        if (Na__LeOsnap__IsModeOn(Na__LeOsnap__KIND_CEN)) offer.push([ xm, ym, Na__LeOsnap__KIND_CEN ]);
        let best = null;
        offer.forEach((p) => {
            const d = Math.hypot(p[0] - pointMm.x, p[1] - pointMm.y);
            if (d > radius) return;
            const score = d * (Na__LeAnchor__SCORE[p[2]] || 1);
            if (!best || score < best.score) best = { x : p[0], y : p[1], kind : p[2], target : Na__LeAnchor__TargetFor(kind), viewportId : null, source : 'anchor-box', sourceId : null, distanceMm : d, score : score };
        });
        return best;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Land a Point Dragged From base by dMm: Held, Snapped, or on the Grid
    // ------------------------------------------------------------
    // The rule every carried point in the editor keeps (a vertex, a viewport
    // carried by its linework): an arrow key names the axis outright; Shift or
    // Ortho (ortho, already resolved by the caller) holds the nearer one. THE
    // SEARCH RUNS FROM THE FREE CURSOR, so with an axis held the corner across
    // the sheet can still be found, and the lock then keeps only its free
    // coordinate. With no snap in reach, Grid Snap (F7) puts the point on the
    // grid, the held axis keeping its line. The marker shows what was found.
    // Returns { at, arrow } - arrow is the arrow key's axis, for the band.
    // ------------------------------------------------------------
    function Na__LeAnchor__Land(sheet, base, dMm, ortho, exclude, box, kind) {
        const arrow = Na__LeAxis__Get();
        let lock = arrow, dx = dMm.x, dy = dMm.y;
        if (lock === Na__LeAxis__AXIS_X)      dy = 0;
        else if (lock === Na__LeAxis__AXIS_Y) dx = 0;
        else if (ortho) {
            if (Math.abs(dx) >= Math.abs(dy)) { dy = 0; lock = Na__LeAxis__AXIS_X; }
            else                              { dx = 0; lock = Na__LeAxis__AXIS_Y; }
        }
        const wanted = { x : base.x + dx, y : base.y + dy };
        const free   = { x : base.x + dMm.x, y : base.y + dMm.y };
        const found  = Na__LeOsnap__Find(sheet, free, exclude);
        const own    = box ? Na__LeAnchor__BoxHit(box, kind, free) : null;
        const hit    = (own && (!found || own.score < found.score)) ? own : found;
        const snap   = hit || Na__LeOsnap__FindGrid(wanted);
        if (!snap) { Na__LeOsnap__HideMarker(); return { at : wanted, arrow : arrow }; }
        const at = { x : lock === Na__LeAxis__AXIS_Y ? wanted.x : snap.x, y : lock === Na__LeAxis__AXIS_X ? wanted.y : snap.y };
        Na__LeOsnap__ShowMarker(lock ? Object.assign({}, snap, { x : at.x, y : at.y }) : snap);   // <-- Held: the marker sits where the point lands on the line
        return { at : at, arrow : arrow };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What a Move Must Not Snap To: Everything That Travels With It
    // ------------------------------------------------------------
    function Na__LeAnchor__Moving(drag) {
        if (drag.kind === 'group') return Array.isArray(drag.group) ? drag.group : [];
        return { kind : drag.kind, id : drag.id };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Two Drags: Re-Placing the Cross, and Moving the Item by It
// -----------------------------------------------------------------------------

    // FUNCTION | Re-Place the Cross for This Cursor Position (a drag that began on it)
    // ------------------------------------------------------------
    // drag : { fromMm (the cross at the press), startMm (the press) }. Nothing
    // is excluded from the snap: the item's own corners are what the cross is
    // most often put on. The item's box is offered too. Returns the point.
    // ------------------------------------------------------------
    function Na__LeAnchor__Relocate(sheet, drag, cursorMm, ortho) {
        if (!Na__LeAnchor__IsDrag(drag) || !drag.fromMm || !cursorMm) return null;
        const held = Na__LeAnchor__Held;
        const box  = held ? Na__LeAnchor__BoxOf(sheet, held) : null;
        const land = Na__LeAnchor__Land(sheet, drag.fromMm, { x : cursorMm.x - drag.startMm.x, y : cursorMm.y - drag.startMm.y }, ortho, null, box, held ? held.kind : null);
        Na__LeAnchor__Live = land.at;
        Na__LeAnchor__Place(land.at);
        Na__LeAnchor__State('moving', true);
        Na__LeGrips__ShowBand(drag.fromMm, land.at, land.arrow);             // <-- From where the cross was: an arrow lock colours it
        return land.at;
    }
    // ------------------------------------------------------------


    // FUNCTION | Move by the Cross: the Translation That Puts It Where It Lands
    // ------------------------------------------------------------
    // drag : a whole-object move, or a selection moved as one, whose press
    // found the cross (drag.anchorMm). dMm is how far the cursor has gone.
    // THE CROSS IS THE ONLY POINT THAT SNAPS - not the nearest corner of the
    // item, which is how a move snaps without one - and nothing that travels
    // with it is a target. What comes back is final: held, snapped and gridded,
    // so the caller lands it as it lands a typed length.
    // ------------------------------------------------------------
    function Na__LeAnchor__Carry(sheet, drag, dMm, ortho) {
        const base = drag && drag.anchorMm;
        if (!base || !dMm) return dMm;
        const land = Na__LeAnchor__Land(sheet, base, dMm, ortho, Na__LeAnchor__Moving(drag), null, null);
        Na__LeAnchor__ShowAt(land.at);
        Na__LeGrips__ShowBand(base, land.at, land.arrow);                    // <-- From this point to that point
        return { x : land.at.x - base.x, y : land.at.y - base.y };
    }
    // ------------------------------------------------------------


    // FUNCTION | Draw the Cross Where a Move Has Carried It (the viewport's own carry lands the point)
    // ------------------------------------------------------------
    function Na__LeAnchor__ShowAt(point) {
        if (!point) return false;
        Na__LeAnchor__Live = { x : point.x, y : point.y };
        Na__LeAnchor__Place(Na__LeAnchor__Live);
        Na__LeAnchor__State('carrying', true);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Drag Has Ended: Keep the Cross Where It Was Put, or Where the Move Took It
    // ------------------------------------------------------------
    // A re-placing drag that moved stores the new place on the item's box. A
    // move carried by the cross lets go of the drawn point - the cross is read
    // from the item's box again, which has gone with it - and hands the cross
    // to whatever is now the one item selected: a Ctrl-drag copy is selected
    // as it lands, and keeps the cross the original had. Returns true when
    // the drag was the cross's.
    // ------------------------------------------------------------
    function Na__LeAnchor__Finish(sheet, drag) {
        if (!drag) return false;
        if (Na__LeAnchor__IsDrag(drag)) {
            Na__LeGrips__HideBand();
            Na__LeOsnap__HideMarker();
            if (drag.moved && Na__LeAnchor__Live && Na__LeAnchor__Valid(sheet)) {
                const box = Na__LeAnchor__BoxOf(sheet, Na__LeAnchor__Held);
                if (box) {
                    Object.assign(Na__LeAnchor__Held, Na__LeAnchor__PlaceOn(box, Na__LeAnchor__Live));
                    Na__LeAnchor__Tell('Placed', 'Move anchor placed. Drag the item to move it by the cross.');
                }
            }
            Na__LeAnchor__Live = null;
            Na__LeAnchor__State('moving', false);
            Na__LeAnchor__Refresh(sheet);
            return true;
        }
        if (!drag.anchorMm) return false;
        Na__LeAnchor__Live = null;
        Na__LeAnchor__State('carrying', false);
        const items = Na__LeModel__GetSelectionItems();
        const place = drag.anchorPlace;
        if (sheet && items.length === 1 && place) {
            Na__LeAnchor__Held = { sheetId : sheet.Sheet__Id, kind : items[0].kind, id : items[0].id, scope : Na__LeAnchor__ScopeKey(), fx : place.fx, fy : place.fy, ox : place.ox, oy : place.oy };
        }
        Na__LeAnchor__Refresh(sheet);
        return false;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Move Anchor API
    // ------------------------------------------------------------
    export {
        Na__LeAnchor__DRAG_KIND,
        Na__LeAnchor__Ready,
        Na__LeAnchor__Arm,
        Na__LeAnchor__Recentre,
        Na__LeAnchor__Point,
        Na__LeAnchor__Holds,
        Na__LeAnchor__HoldsItems,
        Na__LeAnchor__HitAt,
        Na__LeAnchor__Hover,
        Na__LeAnchor__Grab,
        Na__LeAnchor__IsDrag,
        Na__LeAnchor__ForDrag,
        Na__LeAnchor__Relocate,
        Na__LeAnchor__Carry,
        Na__LeAnchor__ShowAt,
        Na__LeAnchor__Finish,
        Na__LeAnchor__Refresh,
        Na__LeAnchor__Clear
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
