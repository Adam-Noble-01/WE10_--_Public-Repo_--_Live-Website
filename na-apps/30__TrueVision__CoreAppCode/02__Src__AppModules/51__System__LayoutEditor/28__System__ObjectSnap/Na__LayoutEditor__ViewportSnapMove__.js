// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - VIEWPORT SNAP MOVE
// =============================================================================
//
// FILE       : Na__LayoutEditor__ViewportSnapMove__.js
// NAMESPACE  : Na__LeVpMove
// MODULE     : Layout Editor - Viewport Snap Move (carry a viewport by a point on its linework)
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Move a viewport by a corner of its own drawing onto, or into line with, a corner of another
// CREATED    : 13-Sep-2026
//
// DESCRIPTION:
// - Lining two drawings up used to be done by eye: drag the frame, zoom in,
//   nudge, zoom out, nudge again. Viewports now move the way a block moves in
//   CAD - by a base point.
// - GRAB A POINT, NOT A FRAME. With the Select tool, hovering over a 2D
//   viewport's linework shows the snap marker, in the viewport purple. Press
//   there and the viewport is carried BY THAT POINT: wherever the point is
//   dropped, it lands exactly.
// - DROP IT ON A POINT. While carried, the point snaps to the endpoints and
//   midpoints of every OTHER viewport's linework, and to the sheet's own vector
//   and dimension points, so a corner of one drawing lands precisely on the
//   same corner in another.
// - OR PUT IT IN LINE WITH ONE. Rest the cursor on a point of another viewport
//   for a moment - before the drag, or during it - and that point is acquired:
//   a small cross marks it. From then on, whenever the carried point comes
//   level with it or plumb below it, the move locks onto that line and a
//   dashed guide is drawn from the acquired point - red for level, green for
//   plumb, the colours the axis locks already use. Two acquired points give
//   their intersection. This is AutoCAD's object snap tracking, and it is what
//   lines two elevations up side by side without ever laying one over the
//   other, or drops a plan straight above its elevation.
// - LOCK THE AXIS WITH AN ARROW KEY, as on a vector's vertex: left or right
//   holds the frame to X, up or down to Y, the same key again releases it, and
//   nothing has to be held down - so a hand can come off the mouse to rest on a
//   reference or type a length. A snap or a tracking line then only supplies
//   the coordinate along the FREE axis, which is what lines a drawing up with a
//   corner clean across the sheet without pulling it off the axis.
// - SHIFT holds the move to the nearer axis, as it does for every other drag;
//   the arrow key beats it, because Shift's axis changes with the cursor.
// - THE CARRIED FRAME GOES TO MULTIPLY while it moves, so the drawing
//   underneath shows through it and its corners can be aimed at.
// - SNAPPING OFF (F3) turns all of this off: a press anywhere on a viewport
//   moves it the plain way, exactly as before.
// - A carried move is one undo step: the sheet tools announce it once, on
//   release, as they do every drag.
//
// -----------------------------------------------------------------------------
//
// WHAT CAN BE GRABBED, AND WHAT A GRAB SNAPS TO:
// - Grabbed: a snap point of the viewport under the cursor - its projected
//   linework, so Projected Linework has to be on for that viewport. A raster-
//   only or a 3D viewport has no points and moves the plain way.
// - Snapped to: everything the object snap offers (Na__LayoutEditor__
//   ObjectSnap__Search__) EXCEPT the viewport being carried, whose points
//   travel with the cursor.
// - Acquired for tracking: linework points only, and never the carried
//   viewport's own - they move with it, so they cannot be a reference. A
//   tracking point whose viewport is later moved, re-cropped or deleted no
//   longer marks anything and is dropped.
//
// INTEGRATION:
// - This file lives with the rest of the editor's snapping, in
//   28__System__ObjectSnap; it was in 20__System__Viewports until 21-Sep-2026.
// - Na__LayoutEditor__SheetTools__ owns the pointer. It decides which viewport
//   under the cursor may be carried (not locked, not a handle, not in content
//   editing), calls Hover on a move, GrabAt on a press, Solve on every drag
//   move, Finish when a drag ends and Clear when the tool is put down.
// - Na__LayoutEditor__ObjectSnap__Search__ owns the search and the marker;
//   this module adds the carry, the tracking and the guides on top.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported to      : ValeVision3D 51__System__LayoutEditor (pending)
// - Parity         : authored in TrueVision first, back-port to follow
// - Divergences    : none expected - it reads only the viewport record and the snap API
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.6.0
// - Signature carries the viewport's turn (Viewport__RotationDeg), so a
//   tracking point taken before a turn is dropped as stale. The points
//   themselves come from the snap index, which files a turned drawing turned.
//
// 21-Sep-2026 - Version 1.5.0
// - MOVED into 28__System__ObjectSnap with the rest of the editor's snapping
//   (it was 20__System__Viewports/Na__LayoutEditor__ViewportSnapMove__.js);
//   the namespace and every export are unchanged.
// - The snap marker is no longer toned purple because A VIEWPORT IS BEING
//   CARRIED: its colour now says what the carried point has FOUND - purple on
//   another drawing's linework, blue on a vector, red on a dimension - like
//   every other snap. Hovering a viewport's own linework is still purple,
//   because that IS a viewport's point. The carried frame's outline, the ring
//   and the tracking crosses keep the viewport purple: they are the carry's.
//
// 21-Sep-2026 - Version 1.4.0
// - Retarget: a Ctrl-drag copy made or dropped in the middle of a carry
//   (Na__LayoutEditor__SheetTools__CopyDrag__) moves the multiply across to
//   the frame that is now being carried, and the carry engages on it afresh.
//
// 21-Sep-2026 - Version 1.3.0
// - Solve's last step uses the drawing grid while Grid Snap is on (F7,
//   Na__LayoutEditor__DrawingGrid__): with no snap and no tracking line in
//   reach, the carried point lands on the nearest grid point. A snap point
//   (the title block's corners among them) and a tracking line still win,
//   and a held axis keeps its line.
//
// 20-Sep-2026 - Version 1.2.0
// - THE ARROW-KEY LOCK REACHES A CARRIED VIEWPORT. Solve had its own private
//   `lock`, set only by Shift, and its own duplicate axis names; it now reads
//   the shared Na__LayoutEditor__AxisLock__ first and falls to Shift only when
//   no arrow has named an axis. Everything downstream already threaded `lock`
//   correctly - the snap supplying the free coordinate, tracking suppressed on
//   the held axis, the base guide - so the behaviour was built and had one
//   input where a vertex has two.
// - THE SNAP SEARCH RUNS FROM THE FREE CURSOR RATHER THAN THE HELD POINT.
//   Looking from the constrained point meant that with an axis held, the only
//   points in reach were ones already on that axis, so the one thing the lock
//   is for - sliding along it until a corner across the sheet lines up - could
//   never find that corner. This is how a vertex drag has always searched.
//
// 13-Sep-2026 - Version 1.1.0
// - The snap marker shows in the viewport tone, purple, on hover and while
//   carrying, and the carried point's ring, the tracking crosses and the
//   carried frame's outline are purple to match. The Dimension tool snaps in
//   orange and the Draw and Rectangle tools in blue, so the colour says which
//   tool is at work. The level and plumb guides keep the axis-lock red and green.
//
// 13-Sep-2026 - Version 1.0.0
// - First cut. Carry by a linework point, snap to other viewports, acquired
//   tracking points with level and plumb guides, Shift axis hold, multiply on
//   the carried frame.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Surface and Snapping
    // ------------------------------------------------------------
    import { Na__LeCfg__GetSnappingSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__KIND_2D,
        Na__LeModel__GetActiveSheet,
        Na__LeModel__GetViewportById,
        Na__LeModel__IsLayerVisible
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__GetElements, Na__LeSurface__GetPixelsPerMm, Na__LeSurface__GetZoom } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import {
        Na__LeOsnap__IsEnabled,
        Na__LeOsnap__Find,
        Na__LeOsnap__FindOnViewport,
        Na__LeOsnap__ShowMarker,
        Na__LeOsnap__HideMarker
    } from './Na__LayoutEditor__ObjectSnap__Search__.js';
    import { Na__LeAxis__AXIS_X, Na__LeAxis__AXIS_Y, Na__LeAxis__Get } from '../30__System__SheetTools/Na__LayoutEditor__AxisLock__.js';
    import { Na__LeGrid__SnapPoint } from '../27__System__DrawingGrid/Na__LayoutEditor__DrawingGrid__State__.js';   // <-- Grid Snap (F7): a leaf, the nearest grid point
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Classes and Axes
    // ------------------------------------------------------------
    const Na__LeVpMove__CARRIED_CLASS = 'na-le-frame--carried';
    const Na__LeVpMove__BASE_CLASS    = 'na-le-carry-base';
    const Na__LeVpMove__POINT_CLASS   = 'na-le-track-point';
    const Na__LeVpMove__GUIDE_CLASS   = 'na-le-track-guide';
    const Na__LeVpMove__AXIS_X        = Na__LeAxis__AXIS_X;                    // <-- A level line: the two points share a y
    const Na__LeVpMove__AXIS_Y        = Na__LeAxis__AXIS_Y;                    // <-- A plumb line: the two points share an x
                                                                               //     The shared lock's own names, so an arrow key and a Shift hold speak the same two words
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Carry in Progress, Tracking Points and Their Elements
    // ------------------------------------------------------------
    let Na__LeVpMove__Active   = null;     // <-- The sheet tools' drag record while it is being carried by a point
    let Na__LeVpMove__Acquired = [];       // <-- [{ x, y, viewportId, sig }] oldest first
    let Na__LeVpMove__Dwell    = null;     // <-- { key, timer } the point the cursor is resting on
    let Na__LeVpMove__Hovering = false;    // <-- The snap marker is showing because of a hover here
    const Na__LeVpMove__Els    = { base : null, guideX : null, guideY : null, points : [] };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Snap Radius in Paper Millimetres at the Current Zoom
    // ------------------------------------------------------------
    function Na__LeVpMove__RadiusMm() {
        return Na__LeCfg__GetSnappingSetup().radiusPx / (Na__LeSurface__GetPixelsPerMm() * Na__LeSurface__GetZoom());
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Everything That Places a Viewport's Drawing on the Paper, as One String
    // ------------------------------------------------------------
    // A tracking point is a paper position of a drawing corner. If the frame,
    // the window or the scale changes afterwards, the corner is somewhere else
    // and the point is stale.
    // ------------------------------------------------------------
    function Na__LeVpMove__Signature(viewport) {
        const frame = viewport.Viewport__FrameMm, pan = viewport.Viewport__PanMm;
        return [ frame.X, frame.Y, frame.WidthMm, frame.HeightMm, pan.X, pan.Y, viewport.Viewport__ScaleDenominator, viewport.Viewport__RotationDeg || 0 ].join('|');   // <-- A turn moves every point of the drawing on the paper
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Frame Element of a Viewport
    // ------------------------------------------------------------
    function Na__LeVpMove__Frame(viewportId) {
        const frames = Na__LeSurface__GetElements().frames;
        return frames ? frames.querySelector('[data-na-viewport-id="' + viewportId + '"]') : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Reusable Element in the Handles Layer
    // ------------------------------------------------------------
    function Na__LeVpMove__Element(slot, className) {
        const layer = Na__LeSurface__GetElements().handles;
        if (!layer) return null;
        let el = Na__LeVpMove__Els[slot];
        if (!el) { el = document.createElement('div'); Na__LeVpMove__Els[slot] = el; }
        el.className = className;
        if (el.parentNode !== layer) layer.appendChild(el);
        return el;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Markers and Guides
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Ring on the Carried Point While It Is Not Sitting on a Snap
    // ------------------------------------------------------------
    function Na__LeVpMove__ShowBase(point) {
        const el = Na__LeVpMove__Element('base', Na__LeVpMove__BASE_CLASS);
        if (!el) return;
        const zoom = Na__LeSurface__GetZoom(), ppm = Na__LeSurface__GetPixelsPerMm();
        const size = Na__LeCfg__GetSnappingSetup().trackMarkerSizePx / zoom;     // <-- Counter-scaled: the same size on screen at any zoom
        el.style.left   = ((point.x * ppm) - (size / 2)) + 'px';
        el.style.top    = ((point.y * ppm) - (size / 2)) + 'px';
        el.style.width  = size + 'px';
        el.style.height = size + 'px';
        el.style.borderWidth = Math.max(1, 1.5 / zoom) + 'px';
        el.hidden = false;
    }
    function Na__LeVpMove__HideBase() {
        if (Na__LeVpMove__Els.base) Na__LeVpMove__Els.base.hidden = true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Dashed Guide From a Reference Point to the Carried Point
    // ------------------------------------------------------------
    // axis 'x' draws a level line (the reference shares the carried point's y),
    // 'y' a plumb one. A null reference hides that axis's guide.
    // ------------------------------------------------------------
    function Na__LeVpMove__ShowGuide(axis, from, to) {
        const slot = axis === Na__LeVpMove__AXIS_X ? 'guideX' : 'guideY';
        if (!from || !to) { if (Na__LeVpMove__Els[slot]) Na__LeVpMove__Els[slot].hidden = true; return; }
        const el = Na__LeVpMove__Element(slot, Na__LeVpMove__GUIDE_CLASS + ' ' + Na__LeVpMove__GUIDE_CLASS + '--' + axis);
        if (!el) return;
        const ppm   = Na__LeSurface__GetPixelsPerMm();
        const width = Math.max(1, 1.25 / Na__LeSurface__GetZoom()) + 'px';
        if (axis === Na__LeVpMove__AXIS_X) {
            el.style.left   = (Math.min(from.x, to.x) * ppm) + 'px';
            el.style.top    = (to.y * ppm) + 'px';
            el.style.width  = (Math.abs(to.x - from.x) * ppm) + 'px';
            el.style.height = '0px';
            el.style.borderTopWidth = width;
        } else {
            el.style.left   = (to.x * ppm) + 'px';
            el.style.top    = (Math.min(from.y, to.y) * ppm) + 'px';
            el.style.width  = '0px';
            el.style.height = (Math.abs(to.y - from.y) * ppm) + 'px';
            el.style.borderLeftWidth = width;
        }
        el.hidden = false;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Hide the Ring and Both Guides
    // ------------------------------------------------------------
    function Na__LeVpMove__HideGuides() {
        [ 'base', 'guideX', 'guideY' ].forEach((slot) => { if (Na__LeVpMove__Els[slot]) Na__LeVpMove__Els[slot].hidden = true; });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Draw a Cross on Every Acquired Tracking Point
    // ------------------------------------------------------------
    function Na__LeVpMove__RenderAcquired() {
        const layer = Na__LeSurface__GetElements().handles;
        const els   = Na__LeVpMove__Els.points;
        while (els.length > Na__LeVpMove__Acquired.length) {
            const spare = els.pop();
            if (spare.parentNode) spare.parentNode.removeChild(spare);
        }
        if (!layer) return;
        const ppm  = Na__LeSurface__GetPixelsPerMm(), zoom = Na__LeSurface__GetZoom();
        const size = Na__LeCfg__GetSnappingSetup().trackMarkerSizePx / zoom;
        Na__LeVpMove__Acquired.forEach((point, i) => {
            let el = els[i];
            if (!el) { el = document.createElement('div'); el.className = Na__LeVpMove__POINT_CLASS; els.push(el); }
            if (el.parentNode !== layer) layer.appendChild(el);
            el.style.left   = ((point.x * ppm) - (size / 2)) + 'px';
            el.style.top    = ((point.y * ppm) - (size / 2)) + 'px';
            el.style.width  = size + 'px';
            el.style.height = size + 'px';
            el.style.setProperty('--na-le-track-stroke', Math.max(1, 1.5 / zoom) + 'px');
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Tracking Points
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Take a Snap Hit as a Tracking Point
    // ------------------------------------------------------------
    function Na__LeVpMove__Acquire(sheet, hit) {
        if (!sheet || !hit || !hit.viewportId) return false;                     // <-- Linework points only: they are what drawings line up by
        const viewport = Na__LeModel__GetViewportById(sheet, hit.viewportId);
        if (!viewport) return false;
        if (Na__LeVpMove__Active && Na__LeVpMove__Active.id === hit.viewportId) return false;   // <-- The carried viewport's own points travel with it
        if (Na__LeVpMove__Acquired.some((p) => Math.abs(p.x - hit.x) < 1e-6 && Math.abs(p.y - hit.y) < 1e-6)) return false;
        Na__LeVpMove__Acquired.push({ x : hit.x, y : hit.y, viewportId : hit.viewportId, sig : Na__LeVpMove__Signature(viewport) });
        const max = Math.max(1, Math.round(Na__LeCfg__GetSnappingSetup().acquireMax));
        while (Na__LeVpMove__Acquired.length > max) Na__LeVpMove__Acquired.shift();   // <-- Oldest out first
        Na__LeVpMove__RenderAcquired();
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Acquire a Point Once the Cursor Has Rested on It
    // ------------------------------------------------------------
    // A point is only taken as a reference when the cursor STAYS on it for
    // AcquireDwellMs, as in AutoCAD. Taking every point the cursor merely
    // crossed would fill the list with whatever the pointer passed over on its
    // way to where it was actually going, and every one of those would then
    // tug at the move.
    // ------------------------------------------------------------
    function Na__LeVpMove__Watch(sheet, hit) {
        const setup = Na__LeCfg__GetSnappingSetup();
        const key   = (hit && hit.viewportId) ? hit.viewportId + '@' + Math.round(hit.x * 1000) + ':' + Math.round(hit.y * 1000) : null;
        if (Na__LeVpMove__Dwell && Na__LeVpMove__Dwell.key === key) return;     // <-- Still resting on the same point
        Na__LeVpMove__StopDwell();
        if (!key || !setup.viewportTracking || !sheet) return;
        const sheetId = sheet.Sheet__Id;
        const dwell   = { key : key, timer : 0 };
        dwell.timer = window.setTimeout(() => {
            dwell.timer = 0;
            const live = Na__LeModel__GetActiveSheet();
            if (live && live.Sheet__Id === sheetId) Na__LeVpMove__Acquire(live, hit);
        }, Math.max(0, setup.acquireDwellMs));
        Na__LeVpMove__Dwell = dwell;
    }
    function Na__LeVpMove__StopDwell() {
        if (Na__LeVpMove__Dwell && Na__LeVpMove__Dwell.timer) window.clearTimeout(Na__LeVpMove__Dwell.timer);
        Na__LeVpMove__Dwell = null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Tracking Points Held Right Now (a copy, for the panels and tests)
    // ------------------------------------------------------------
    function Na__LeVpMove__GetAcquired() {
        return Na__LeVpMove__Acquired.map((p) => ({ x : p.x, y : p.y, viewportId : p.viewportId }));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Grab and Hover
// -----------------------------------------------------------------------------

    // FUNCTION | The Point on a Viewport's Own Linework a Press Would Carry It By, or Null
    // ------------------------------------------------------------
    // The sheet tools have already ruled out a locked viewport, a handle and
    // content editing; this rules out everything that has no points to offer.
    // ------------------------------------------------------------
    function Na__LeVpMove__GrabAt(sheet, viewport, pointMm) {
        const setup = Na__LeCfg__GetSnappingSetup();
        if (!sheet || !viewport || !pointMm || !setup.viewportCarry || !Na__LeOsnap__IsEnabled()) return null;
        if (viewport.Viewport__Kind !== Na__LeModel__KIND_2D || !Na__LeModel__IsLayerVisible(sheet, viewport.Viewport__LayerId)) return null;
        return Na__LeOsnap__FindOnViewport(sheet, viewport.Viewport__Id, pointMm);
    }
    // ------------------------------------------------------------


    // FUNCTION | Hover With the Select Tool: Mark the Point a Press Would Carry the Viewport By
    // ------------------------------------------------------------
    // viewport is the carryable viewport under the cursor, or null. Returns
    // the hit so the caller can choose the cursor. Resting on a point acquires
    // it for tracking.
    // ------------------------------------------------------------
    function Na__LeVpMove__Hover(sheet, viewport, pointMm) {
        const hit = viewport ? Na__LeVpMove__GrabAt(sheet, viewport, pointMm) : null;
        Na__LeVpMove__Watch(sheet, hit);
        if (hit) {
            Na__LeOsnap__ShowMarker(hit);                                        // <-- A point of the viewport's own linework: the viewports' purple
            Na__LeVpMove__Hovering = true;
            return hit;
        }
        if (Na__LeVpMove__Hovering) { Na__LeOsnap__HideMarker(); Na__LeVpMove__Hovering = false; }
        return null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Carry
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The First Move of a Carry: Multiply the Frame, Drop Its Own Tracking Points
    // ------------------------------------------------------------
    function Na__LeVpMove__Engage(drag) {
        if (Na__LeVpMove__Active === drag) return;
        Na__LeVpMove__Active   = drag;
        Na__LeVpMove__Hovering = false;
        Na__LeVpMove__StopDwell();
        Na__LeVpMove__Acquired = Na__LeVpMove__Acquired.filter((p) => p.viewportId !== drag.id);
        Na__LeVpMove__RenderAcquired();
        const frame = Na__LeVpMove__Frame(drag.id);
        if (frame) frame.classList.add(Na__LeVpMove__CARRIED_CLASS);
    }
    // ------------------------------------------------------------


    // FUNCTION | Where the Carried Point Goes for This Cursor Position
    // ------------------------------------------------------------
    // drag : the sheet tools' drag record - { id, startMm (the press), baseMm (the point grabbed) }
    // Returns the paper point the grabbed point now sits on; the frame moves
    // by the difference. In order of precedence:
    //   1. a snap point on anything but the carried viewport (the marker shows it)
    //   2. level with, or plumb below, an acquired point (a dashed guide shows it)
    //   3. the cursor
    // Shift holds the move to the nearer axis first; a snap or a tracking line
    // then supplies only the coordinate along the free axis, and the guides
    // show both where the move is held and where the coordinate came from.
    // ------------------------------------------------------------
    function Na__LeVpMove__Solve(sheet, drag, cursorMm, shift) {
        Na__LeVpMove__Engage(drag);
        const setup = Na__LeCfg__GetSnappingSetup();
        const base  = drag.baseMm;
        let dx = cursorMm.x - drag.startMm.x;
        let dy = cursorMm.y - drag.startMm.y;

        // WHICH AXIS IS HELD, AND WHO SAID SO. An arrow key names it outright and
        // keeps naming it with nothing held down, which is what lets a hand come
        // off the mouse to rest on a reference point or type a length; Shift only
        // guesses, from wherever the cursor happens to be. The arrow wins, exactly
        // as it does for a vertex (Na__LayoutEditor__AxisLock__). Either way `lock`
        // means the same thing from here on: a snap or a tracking line may supply
        // the coordinate along the FREE axis only, never pull the frame off the
        // held one.
        // ------------------------------------
        let lock = Na__LeAxis__Get();
        if (lock === Na__LeVpMove__AXIS_X)      dy = 0;
        else if (lock === Na__LeVpMove__AXIS_Y) dx = 0;
        else if (shift) {
            if (Math.abs(dx) >= Math.abs(dy)) { dy = 0; lock = Na__LeVpMove__AXIS_X; }
            else                              { dx = 0; lock = Na__LeVpMove__AXIS_Y; }
        }
        const wanted = { x : base.x + dx, y : base.y + dy };
        const free   = { x : base.x + (cursorMm.x - drag.startMm.x), y : base.y + (cursorMm.y - drag.startMm.y) };

        // 1. SNAP | Onto a corner or a midpoint of another drawing
        // ------------------------------------
        // THE SEARCH RUNS FROM THE FREE CURSOR, NOT THE HELD POINT. Looking
        // from `wanted` meant that with an axis held, the only points within
        // reach were the ones already sitting on that axis - so the one thing
        // the lock is for, sliding along it until a corner across the sheet
        // lines up, could never find that corner. The cursor goes to the
        // corner, the snap reads it, and the lock below keeps only its free
        // coordinate. Unheld the two points are the same, so nothing changes.
        const hit = Na__LeOsnap__Find(sheet, free, { kind : 'viewport', id : drag.id });
        Na__LeVpMove__Watch(sheet, hit);
        if (hit) {
            const at = { x : lock === Na__LeVpMove__AXIS_Y ? wanted.x : hit.x, y : lock === Na__LeVpMove__AXIS_X ? wanted.y : hit.y };
            Na__LeOsnap__ShowMarker(hit);                                        // <-- Coloured by what the carried point has FOUND: another drawing's purple, a vector's blue
            Na__LeVpMove__ShowGuide(Na__LeVpMove__AXIS_X, lock === Na__LeVpMove__AXIS_X ? base : (lock === Na__LeVpMove__AXIS_Y ? hit : null), at);
            Na__LeVpMove__ShowGuide(Na__LeVpMove__AXIS_Y, lock === Na__LeVpMove__AXIS_Y ? base : (lock === Na__LeVpMove__AXIS_X ? hit : null), at);
            if (lock) Na__LeVpMove__ShowBase(at); else Na__LeVpMove__HideBase();   // <-- Unheld, the snap marker already sits on the point
            return at;
        }
        Na__LeOsnap__HideMarker();

        // 2. TRACK | Level with, or plumb below, a point rested on earlier
        // ------------------------------------
        let levelWith = null, plumbWith = null;
        if (setup.viewportTracking && Na__LeVpMove__Acquired.length) {
            const radiusMm = Na__LeVpMove__RadiusMm();
            let bestLevel = radiusMm, bestPlumb = radiusMm;
            Na__LeVpMove__Acquired.forEach((point) => {
                const gapY = Math.abs(wanted.y - point.y);
                if (lock !== Na__LeVpMove__AXIS_X && gapY <= bestLevel) { bestLevel = gapY; levelWith = point; }
                const gapX = Math.abs(wanted.x - point.x);
                if (lock !== Na__LeVpMove__AXIS_Y && gapX <= bestPlumb) { bestPlumb = gapX; plumbWith = point; }
            });
        }

        // 3. CURSOR | With whichever axes tracking caught - and, while Grid
        // Snap is on (F7), the drawing grid for the rest: the point the
        // viewport is carried by lands on a grid point, a held axis keeps its
        // line, and a tracking line still wins on its own axis.
        // ------------------------------------
        const grid = Na__LeGrid__SnapPoint(wanted);
        const at = { x : plumbWith ? plumbWith.x : (lock === Na__LeVpMove__AXIS_Y ? wanted.x : grid.x),
                     y : levelWith ? levelWith.y : (lock === Na__LeVpMove__AXIS_X ? wanted.y : grid.y) };
        Na__LeVpMove__ShowGuide(Na__LeVpMove__AXIS_X, levelWith || (lock === Na__LeVpMove__AXIS_X ? base : null), at);
        Na__LeVpMove__ShowGuide(Na__LeVpMove__AXIS_Y, plumbWith || (lock === Na__LeVpMove__AXIS_Y ? base : null), at);
        Na__LeVpMove__ShowBase(at);
        return at;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Carry Now Moves a Different Frame (a Ctrl-drag copy made or dropped)
    // ------------------------------------------------------------
    // Ctrl pressed half way through a carry clones the viewport and carries
    // the clone instead, and pressed again carries the original once more
    // (Na__LayoutEditor__SheetTools__CopyDrag__), both by repointing the same
    // drag record. The frame that stopped moving loses the multiply, and the
    // carry engages again on the one that moves now - which also drops the
    // tracking points taken on it, as they would be at the start of any carry.
    // Does nothing before the carry has engaged: its first Solve engages
    // whatever the drag points at by then. Returns true when it moved across.
    // ------------------------------------------------------------
    function Na__LeVpMove__Retarget(drag, fromViewportId) {
        if (!drag || Na__LeVpMove__Active !== drag) return false;
        const was = Na__LeVpMove__Frame(fromViewportId);
        if (was) was.classList.remove(Na__LeVpMove__CARRIED_CLASS);
        Na__LeVpMove__Active = null;
        Na__LeVpMove__Engage(drag);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Drag Has Ended: Put the Frame Back and Take the Guides Away
    // ------------------------------------------------------------
    // The tracking points were acquired FOR the carry that just finished, so
    // they go with it. A press that never became a carry keeps them: the usual
    // way in is to rest on a reference, click a viewport to select it, and only
    // then drag it. Returns true when a carry was in progress.
    // ------------------------------------------------------------
    function Na__LeVpMove__Finish() {
        const drag = Na__LeVpMove__Active;
        Na__LeVpMove__Active = null;
        Na__LeVpMove__HideGuides();
        if (!drag) return false;
        const frame = Na__LeVpMove__Frame(drag.id);
        if (frame) frame.classList.remove(Na__LeVpMove__CARRIED_CLASS);
        Na__LeOsnap__HideMarker();
        Na__LeVpMove__StopDwell();
        Na__LeVpMove__Acquired = [];
        Na__LeVpMove__RenderAcquired();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Forget Everything: a Tool Change, Escape, Leaving the Editor
    // ------------------------------------------------------------
    function Na__LeVpMove__Clear() {
        Na__LeVpMove__Finish();
        Na__LeVpMove__StopDwell();
        if (Na__LeVpMove__Hovering) { Na__LeOsnap__HideMarker(); Na__LeVpMove__Hovering = false; }
        if (Na__LeVpMove__Acquired.length) { Na__LeVpMove__Acquired = []; Na__LeVpMove__RenderAcquired(); }
    }
    // ------------------------------------------------------------


    // FUNCTION | Keep the Tracking Crosses True After a Zoom or a Model Change
    // ------------------------------------------------------------
    // The crosses are counter-scaled, so a zoom re-lays them. A point whose
    // viewport has since moved, been re-cropped, re-scaled or deleted - or
    // which belongs to a sheet no longer on screen - marks nothing on the
    // paper any more and is dropped.
    // ------------------------------------------------------------
    function Na__LeVpMove__Refresh(sheet) {
        if (Na__LeVpMove__Acquired.length) {
            Na__LeVpMove__Acquired = Na__LeVpMove__Acquired.filter((point) => {
                const viewport = sheet ? Na__LeModel__GetViewportById(sheet, point.viewportId) : null;
                return !!viewport && Na__LeVpMove__Signature(viewport) === point.sig;
            });
        }
        Na__LeVpMove__RenderAcquired();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Viewport Snap Move API
    // ------------------------------------------------------------
    export {
        Na__LeVpMove__GrabAt,
        Na__LeVpMove__Hover,
        Na__LeVpMove__Solve,
        Na__LeVpMove__Retarget,
        Na__LeVpMove__Finish,
        Na__LeVpMove__Clear,
        Na__LeVpMove__Refresh,
        Na__LeVpMove__GetAcquired
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
