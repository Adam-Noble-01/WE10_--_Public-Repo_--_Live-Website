// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - WEB VIEWER - MEASURE - TOOLS
// =============================================================================
//
// FILE       : Na__LayoutEditor__WebViewer__Measure__Tool__.js
// NAMESPACE  : Na__LeVwMsTool
// MODULE     : Layout Editor - Web Viewer - Measure - Tools
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : PlanVision's Linear, Rectangle and Area measuring tools on a published drawing, snapping to its vectors, by mouse, pen or finger
// CREATED    : 19-Oct-2026
//
// DESCRIPTION:
// - THE SAME TOOLS AS PLANVISION (UserInterface__MeasurementToolsPanel__ and
//   30__SystemModules__MeasurmentToolsSytem): Linear (two points, by two
//   clicks or one drag), Rectangle (two opposite corners, the same way), Area
//   (a corner at a time, closed on the first corner, a double click, Enter or
//   Finish) and Clear. What is different is what a point lands on: every
//   point snaps to the drawing's own vectors (Na__PubDoc__Measure__Snap__),
//   and a length is the sheet distance times the drawing's own scale.
// - NO ACCEPT STEP. PlanVision asked for Accept or Cancel after each one. Here
//   a measurement is kept the moment its last point lands and the tool stays
//   on for the next, because a snapped point does not need checking and a
//   kept one can still be put right: pick it (with no tool on) and pull its
//   grips, or Delete it.
// - A MOUSE OR A PEN places with the left button; the middle and right
//   buttons still pan and the wheel still zooms (Na__LayoutEditor__Controls__
//   Pc__ only ever takes those). Shift keeps a line square to the drawing,
//   Alt places a point where it is with no snap, Escape stops.
// - CTRL+Z AND CTRL+Y (and Ctrl+Shift+Z; Cmd on a Mac). Undo takes back the
//   last point of the measurement being made, and with none being made, the
//   last change to the kept ones: one kept, pulled, deleted, or all cleared
//   (Na__PubDoc__Measure__ remembers them per sheet). Redo puts back what
//   Undo took. The bar's Undo and Redo do the same, for a finger.
// - A FINGER keeps panning and pinching as it always has (the viewer's touch
//   recogniser); a TAP places a point instead, handed over by the recogniser
//   (onTap), so two quick taps are two points and never a double-tap zoom. A
//   finger landing on a grip of the selected measurement is taken from the
//   recogniser before it can pan, and pulls the grip.
// - WHERE A MEASUREMENT BELONGS. Its first point decides which drawing it is
//   on (the topmost 2D viewport under it), and so its scale; its later points
//   snap to that drawing only. A first point off every drawing is refused with
//   a word in the bar rather than measured at no scale.
//
// INTEGRATION:
// - Na__LayoutEditor__WebViewer__Measure__ (the dock button, the menu and the
//   bar) calls Attach and Detach as drawings come and go, Start, Stop, Finish,
//   Undo, Redo, ClearAll, SetSnap and SetSize from its controls, OnTap from
//   the recogniser, and listens with OnChange.
// - Draws through Na__LayoutEditor__WebViewer__Measure__Overlay__.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : PlanVision's measurement tools (behaviour, not code).
// - Back-port     : n/a (ValeVision has no web viewer).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Oct-2026 - Version 1.1.0
// - Undo and Redo: Ctrl+Z, Ctrl+Y and Ctrl+Shift+Z (Cmd on a Mac), and the
//   bar's Undo and Redo. A point first, while a measurement is being made;
//   otherwise the last change to the kept ones.
// - The reader's dimension size (SetSize, kept in this browser), and grips
//   and the delete chip answer as far out as they are drawn
//   (TrueVision3D v2.182.0).
//
// 19-Oct-2026 - Version 1.0.0
// - Initial implementation (TrueVision3D v2.180.0).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    import {
        Na__LeSurface__GetElements, Na__LeSurface__ClientToPaperMm, Na__LeSurface__PaperMmToClient,
        Na__LeSurface__ZOOM_EVENT, Na__LeSurface__ZOOM_SETTLED_EVENT
    } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import {
        Na__PubMs__Prepare, Na__PubMs__Status, Na__PubMs__Layer, Na__PubMs__ViewportAt, Na__PubMs__ViewportsAt,
        Na__PubMs__List, Na__PubMs__Add, Na__PubMs__Replace, Na__PubMs__Remove, Na__PubMs__Clear,
        Na__PubMs__Undo, Na__PubMs__Redo, Na__PubMs__History
    } from '../../52__System__Layout__PublishedDocuments/Na__PubDoc__Measure__.js';
    import { Na__PubMsSnap__Find } from '../../52__System__Layout__PublishedDocuments/Na__PubDoc__Measure__Snap__.js';
    import { Na__PubMsMath__Rect } from '../../52__System__Layout__PublishedDocuments/Na__PubDoc__Measure__Maths__.js';
    import {
        Na__LeVwMsOv__SIZE, Na__LeVwMsOv__Ensure, Na__LeVwMsOv__Remove, Na__LeVwMsOv__Render, Na__LeVwMsOv__MmPerPx,
        Na__LeVwMsOv__Grips, Na__LeVwMsOv__GripPx, Na__LeVwMsOv__SetSize, Na__LeVwMsOv__GetSize
    } from './Na__LayoutEditor__WebViewer__Measure__Overlay__.js';

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Reaches on Screen, in CSS Pixels, for a Mouse and for a Finger
    // ------------------------------------------------------------
    const Na__LeVwMsTool__REACH = Object.freeze({
        mouse : { Snap : 12, Square : 6, Grip : 9,  Pick : 7,  Close : 10, Chip : 11 },
        touch : { Snap : 26, Square : 12, Grip : 24, Pick : 18, Close : 24, Chip : 20 }
    });
    const Na__LeVwMsTool__DRAG_PX    = 5;                                        // <-- A press that moves this far is a drag
    const Na__LeVwMsTool__TAP_SHOW_MS = 1400;                                    // <-- How long a tap's snap stays marked
    const Na__LeVwMsTool__FLASH_MS   = 2800;
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Reader's Dimension Size: Its Range, and Where This Browser Keeps It
    // ------------------------------------------------------------
    const Na__LeVwMsTool__SIZE     = Na__LeVwMsOv__SIZE;                       // <-- { Min, Max, Default }, for the menu's slider
    const Na__LeVwMsTool__SIZE_KEY = 'na-layouteditor-viewer-measure-size';    // <-- A factor as text; absent = the default
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Classes on the Stage
    // ------------------------------------------------------------
    const Na__LeVwMsTool__CLASS_TOOL    = 'na-le-viewer-ms--measuring';           // <-- A tool is on: the crosshair
    const Na__LeVwMsTool__CLASS_GRIP    = 'na-le-viewer-ms--over-grip';
    const Na__LeVwMsTool__CLASS_PICK    = 'na-le-viewer-ms--over-measure';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Tools
    // ------------------------------------------------------------
    const Na__LeVwMsTool__TOOLS = Object.freeze([ 'linear', 'rect', 'area' ]);
    // ------------------------------------------------------------

    // MODULE STATE | Everything the Tools Know
    // ------------------------------------------------------------
    const Na__LeVwMsTool__S = {
        DocumentId : null,
        Stage      : null,
        Bound      : null,                                                       // <-- The listeners, kept so Detach removes the same functions
        Tool       : null,                                                       // <-- 'linear' | 'rect' | 'area' | null
        Draft      : null,                                                       // <-- { Tool, ViewportId, Scale, SpinDeg, Points }
        Selected   : null,                                                       // <-- The picked measurement's id
        Hover      : null,                                                       // <-- The measurement under the mouse (no tool on)
        Cursor     : null,                                                       // <-- Where the next point would land (a mouse's hover)
        Marker     : null,                                                       // <-- The snap to mark
        MarkerName : null,
        MarkerTimer: 0,
        Drag       : null,                                                       // <-- { PointerId, Id, Index, Kind, Working, Original, StartX, StartY, Moved }
        Press      : null,                                                       // <-- { PointerId, X, Y, Dragging } a press that placed a first point
        DraftRedo  : null,                                                       // <-- { Meta, Points } the points Undo took off the one being made, for Redo
        SizeRead   : false,                                                      // <-- The kept dimension size has been read from this browser
        LastMove   : null,                                                       // <-- { X, Y, Event } the mouse's last position, for Shift and Alt
        SnapOn     : true,
        Flash      : null,                                                       // <-- { Text, Until }
        FlashTimer : 0,
        Hits       : { Labels : [], Chip : null },                               // <-- What the last render reported
        Frame      : 0,
        Listeners  : new Set(),
        LastKind   : null                                                        // <-- 'mouse' | 'touch' once the reader has pressed the drawing; null until then
    };
    // ------------------------------------------------------------

    // MODULE CONSTANTS | What Each Snap Is Called Beside the Marker
    // ------------------------------------------------------------
    const Na__LeVwMsTool__NAMES = Object.freeze({
        end : 'Endpoint', mid : 'Midpoint', int : 'Intersection', perp : 'Perpendicular', near : 'On line',
        axis : { h : 'Horizontal', v : 'Vertical' }, axisint : { h : 'Horizontal, on line', v : 'Vertical, on line' }
    });
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Mouse or Finger (a pen is read as a mouse)
    // ------------------------------------------------------------
    function Na__LeVwMsTool__Kind(event) {
        return (event && event.pointerType === 'touch') ? 'touch' : 'mouse';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Name of a Snap for the Marker
    // ------------------------------------------------------------
    function Na__LeVwMsTool__Name(snap) {
        if (!snap || snap.Kind === 'none') return null;
        const name = Na__LeVwMsTool__NAMES[snap.Kind];
        if (!name) return null;
        return (typeof name === 'string') ? name : (name[snap.Axis] || null);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Sheet Point on Screen (client pixels)
    // ------------------------------------------------------------
    function Na__LeVwMsTool__Screen(point) {
        return Na__LeSurface__PaperMmToClient(point.X, point.Y) || { x : 0, y : 0 };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Distance in Screen Pixels From a Client Point to a Sheet Point
    // ------------------------------------------------------------
    function Na__LeVwMsTool__PxTo(clientX, clientY, point) {
        const s = Na__LeVwMsTool__Screen(point);
        return Math.hypot(s.x - clientX, s.y - clientY);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Measurements of the Sheet on Screen
    // ------------------------------------------------------------
    function Na__LeVwMsTool__Measures() {
        return Na__LeVwMsTool__S.DocumentId ? Na__PubMs__List(Na__LeVwMsTool__S.DocumentId) : [];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Point the Next Point Squares Off and Is Perpendicular From
    // ------------------------------------------------------------
    function Na__LeVwMsTool__From() {
        const draft = Na__LeVwMsTool__S.Draft;
        return (draft && draft.Points.length) ? draft.Points[draft.Points.length - 1] : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Point Kept From a Snap
    // ------------------------------------------------------------
    function Na__LeVwMsTool__Point(snap) {
        return { X : snap.X, Y : snap.Y, Snap : snap.Kind || 'none' };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Say Something in the Bar for a Moment
    // ------------------------------------------------------------
    function Na__LeVwMsTool__SayBriefly(text) {
        const S = Na__LeVwMsTool__S;
        S.Flash = { Text : text, Until : Date.now() + Na__LeVwMsTool__FLASH_MS };
        if (S.FlashTimer) window.clearTimeout(S.FlashTimer);
        S.FlashTimer = window.setTimeout(() => { S.FlashTimer = 0; S.Flash = null; Na__LeVwMsTool__Notify(); }, Na__LeVwMsTool__FLASH_MS);
        Na__LeVwMsTool__Notify();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Snapping
// -----------------------------------------------------------------------------

    // FUNCTION | Where a Point at These Client Pixels Lands
    // ------------------------------------------------------------
    // kind is 'mouse' or 'touch' (a finger is given more reach); event carries
    // Shift (square) and Alt (no snap) when there is one; from, spinDeg and
    // viewportId are the measurement's own, when it has begun.
    // ------------------------------------------------------------
    function Na__LeVwMsTool__SnapAt(clientX, clientY, kind, event, from, spinDeg, viewportId) {
        const S = Na__LeVwMsTool__S;
        const p = Na__LeSurface__ClientToPaperMm(clientX, clientY);
        if (!p) return { Kind : 'none', X : 0, Y : 0 };
        const reach = Na__LeVwMsTool__REACH[kind] || Na__LeVwMsTool__REACH.mouse;
        const k = Na__LeVwMsOv__MmPerPx();
        const aperture = reach.Snap * k;
        const free  = !S.SnapOn || !!(event && event.altKey);
        const ortho = !!(event && event.shiftKey) && !!from;
        if (free && !ortho) return { Kind : 'none', X : p.x, Y : p.y };

        let layers = [];
        if (!free) {
            if (viewportId) {
                const layer = Na__PubMs__Layer(S.DocumentId, viewportId);
                if (layer) layers = [ layer ];
            } else {
                layers = Na__PubMs__ViewportsAt(S.DocumentId, p.x, p.y, aperture)
                    .map((info) => Na__PubMs__Layer(S.DocumentId, info.Id)).filter(Boolean);
            }
        }
        return Na__PubMsSnap__Find(layers, p.x, p.y, {
            ApertureMm      : aperture,
            LineApertureMm  : aperture * 0.75,
            AxisToleranceMm : reach.Square * k,
            From            : from || null,
            SpinDeg         : spinDeg || 0,
            Ortho           : ortho
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Making a Measurement
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Begin a Measurement at a Snapped Point (false off every drawing)
    // ------------------------------------------------------------
    function Na__LeVwMsTool__Begin(snap) {
        const S = Na__LeVwMsTool__S;
        const info = Na__PubMs__ViewportAt(S.DocumentId, snap.X, snap.Y, 0);
        if (!info) {
            Na__LeVwMsTool__SayBriefly('Start on a drawing with a scale. 3D views and the sheet around the drawings cannot be measured.');
            return false;
        }
        S.Draft = { Tool : S.Tool, ViewportId : info.Id, Scale : info.Scale, SpinDeg : info.SpinDeg, Points : [ Na__LeVwMsTool__Point(snap) ] };
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Keep the Measurement Being Made
    // ------------------------------------------------------------
    function Na__LeVwMsTool__Keep() {
        const S = Na__LeVwMsTool__S;
        if (!S.Draft) return null;
        const kept = Na__PubMs__Add(S.DocumentId, S.Draft);
        S.Draft = null;
        S.Press = null;
        S.DraftRedo = null;
        return kept;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put Down a Point Where a Snap Landed
    // ------------------------------------------------------------
    // Returns true when the point was taken (or deliberately ignored, a second
    // point on the first), false when it could not be (off every drawing). A
    // point put down ends what Redo could bring back of the points undone.
    // ------------------------------------------------------------
    function Na__LeVwMsTool__Place(snap) {
        const S = Na__LeVwMsTool__S;
        if (!S.Tool) return false;
        if (!S.Draft) {
            const begun = Na__LeVwMsTool__Begin(snap);
            if (begun) S.DraftRedo = null;
            return begun;
        }
        const points = S.Draft.Points;
        const point  = Na__LeVwMsTool__Point(snap);
        const last   = points[points.length - 1];
        if (Math.hypot(point.X - last.X, point.Y - last.Y) < 1e-6) return true;   // <-- The same point twice: nothing to measure yet
        S.DraftRedo = null;

        if (S.Tool === 'linear') {
            points.push(point);
            Na__LeVwMsTool__Keep();
            return true;
        }
        if (S.Tool === 'rect') {
            const rect = Na__PubMsMath__Rect(points[0], point, S.Draft.SpinDeg);
            if (rect.Width < 1e-6 || rect.Height < 1e-6) {                       // <-- A rectangle with no width is a line
                Na__LeVwMsTool__SayBriefly('Pick the opposite corner: that point is in line with the first.');
                return true;
            }
            points.push(point);
            Na__LeVwMsTool__Keep();
            return true;
        }
        points.push(point);                                                       // <-- An area: one more corner
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is a Client Point on an Area's First Corner (it closes the shape)
    // ------------------------------------------------------------
    function Na__LeVwMsTool__OnFirst(clientX, clientY, kind) {
        const draft = Na__LeVwMsTool__S.Draft;
        if (!draft || draft.Tool !== 'area' || draft.Points.length < 3) return false;
        return Na__LeVwMsTool__PxTo(clientX, clientY, draft.Points[0]) <= Na__LeVwMsTool__REACH[kind].Close;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Press or a Tap With a Tool On
    // ------------------------------------------------------------
    function Na__LeVwMsTool__PressAt(clientX, clientY, kind, event) {
        const S = Na__LeVwMsTool__S;
        if (Na__LeVwMsTool__OnFirst(clientX, clientY, kind)) {
            Na__LeVwMsTool__Keep();
            S.Marker = null;
            return true;
        }
        const draft = S.Draft;
        const snap = Na__LeVwMsTool__SnapAt(clientX, clientY, kind, event, Na__LeVwMsTool__From(), draft ? draft.SpinDeg : 0, draft ? draft.ViewportId : null);
        const placed = Na__LeVwMsTool__Place(snap);
        if (kind === 'touch') Na__LeVwMsTool__MarkBriefly(snap);                  // <-- A finger has no hover: show what the tap found
        return placed;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Mark a Tap's Snap for a Moment
    // ------------------------------------------------------------
    function Na__LeVwMsTool__MarkBriefly(snap) {
        const S = Na__LeVwMsTool__S;
        S.Marker = (snap && snap.Kind !== 'none') ? snap : null;
        S.MarkerName = null;
        if (S.MarkerTimer) window.clearTimeout(S.MarkerTimer);
        S.MarkerTimer = window.setTimeout(() => { S.MarkerTimer = 0; S.Marker = null; Na__LeVwMsTool__Render(); }, Na__LeVwMsTool__TAP_SHOW_MS);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Picking and Pulling a Kept Measurement
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Grip of the Selected Measurement Under a Client Point (null when none)
    // ------------------------------------------------------------
    function Na__LeVwMsTool__GripAt(clientX, clientY, kind) {
        const S = Na__LeVwMsTool__S;
        if (!S.Selected) return null;
        const measure = Na__LeVwMsTool__Measures().find((one) => one.Id === S.Selected);
        if (!measure) return null;
        const grips = Na__LeVwMsOv__Grips(measure);
        const reach = Math.max(Na__LeVwMsTool__REACH[kind].Grip, Na__LeVwMsOv__GripPx() + 2);   // <-- At a large dimension size, all of a grip that is drawn
        let best = null;
        grips.forEach((point, index) => {
            const d = Na__LeVwMsTool__PxTo(clientX, clientY, point);
            if (d <= reach && (!best || d < best.d)) best = { d, index };
        });
        return best ? { Measure : measure, Index : best.index } : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is a Client Point on the Selected Measurement's Delete Chip
    // ------------------------------------------------------------
    function Na__LeVwMsTool__ChipAt(clientX, clientY, kind) {
        const chip = Na__LeVwMsTool__S.Hits.Chip;
        if (!chip || chip.Id !== Na__LeVwMsTool__S.Selected) return false;
        const reach = Math.max(Na__LeVwMsTool__REACH[kind].Chip, chip.R / Na__LeVwMsOv__MmPerPx() + 2);
        return Na__LeVwMsTool__PxTo(clientX, clientY, { X : chip.X, Y : chip.Y }) <= reach;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Kept Measurement Under a Client Point (the newest), or Null
    // ------------------------------------------------------------
    // On one of its lines, inside its shape, or on one of its labels.
    // ------------------------------------------------------------
    function Na__LeVwMsTool__MeasureAt(clientX, clientY, kind) {
        const S = Na__LeVwMsTool__S;
        const p = Na__LeSurface__ClientToPaperMm(clientX, clientY);
        if (!p) return null;
        const k = Na__LeVwMsOv__MmPerPx();
        const reach = Na__LeVwMsTool__REACH[kind].Pick * k;
        const segDistance = (a, b) => {
            const dx = b.X - a.X, dy = b.Y - a.Y, len2 = dx * dx + dy * dy;
            const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.X) * dx + (p.y - a.Y) * dy) / len2)) : 0;
            return Math.hypot(p.x - (a.X + dx * t), p.y - (a.Y + dy * t));
        };
        const inside = (poly) => {
            let c = false;
            for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
                if (((poly[i].Y > p.y) !== (poly[j].Y > p.y)) && (p.x < (poly[j].X - poly[i].X) * (p.y - poly[i].Y) / (poly[j].Y - poly[i].Y) + poly[i].X)) c = !c;
            }
            return c;
        };
        const onLabel = (id) => S.Hits.Labels.some((one) => {
            if (one.Id !== id) return false;
            const box = one.Box, a = -(box.Deg || 0) * Math.PI / 180;
            const dx = p.x - box.X, dy = p.y - box.Y;
            const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
            return Math.abs(lx) <= box.W / 2 + reach / 2 && Math.abs(ly) <= box.H / 2 + reach / 2;
        });
        const measures = Na__LeVwMsTool__Measures();
        for (let i = measures.length - 1; i >= 0; i--) {
            const m = measures[i];
            const ring = (m.Tool === 'rect') ? Na__LeVwMsOv__Grips(m) : m.Points;
            if (!ring || ring.length < 2) continue;
            const closed = m.Tool !== 'linear';
            const count = closed ? ring.length : ring.length - 1;
            for (let s = 0; s < count; s++) {
                if (segDistance(ring[s], ring[(s + 1) % ring.length]) <= reach) return m;
            }
            if (closed && ring.length >= 3 && inside(ring)) return m;
            if (onLabel(m.Id)) return m;
        }
        return null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Pull a Grip to Where the Pointer Snaps
    // ------------------------------------------------------------
    function Na__LeVwMsTool__PullTo(clientX, clientY, event) {
        const S = Na__LeVwMsTool__S;
        const drag = S.Drag;
        if (!drag.Moved && Math.hypot(clientX - drag.StartX, clientY - drag.StartY) < Na__LeVwMsTool__DRAG_PX) return;
        drag.Moved = true;
        const m = drag.Working, o = drag.Original;
        let from = null;
        if (m.Tool === 'linear') from = o.Points[drag.Index === 0 ? 1 : 0];
        if (m.Tool === 'area' && o.Points.length > 1) from = o.Points[(drag.Index - 1 + o.Points.length) % o.Points.length];
        const snap = Na__LeVwMsTool__SnapAt(clientX, clientY, drag.Kind, event, from, m.SpinDeg, m.ViewportId);
        if (m.Tool === 'rect') {
            // A RECTANGLE IS PULLED BY ANY CORNER: the opposite one stays. If it
            // is one of the two that were picked it keeps its snap; the other two
            // corners were made, not picked, and are estimates.
            const corners = Na__PubMsMath__Rect(o.Points[0], o.Points[1], o.SpinDeg).Corners;
            const opposite = (drag.Index + 2) % 4;
            const anchor = (opposite === 0) ? o.Points[0] : ((opposite === 2) ? o.Points[1] : { X : corners[opposite].X, Y : corners[opposite].Y, Snap : 'none' });
            m.Points = [ { X : anchor.X, Y : anchor.Y, Snap : anchor.Snap || 'none' }, Na__LeVwMsTool__Point(snap) ];
        } else {
            m.Points[drag.Index] = Na__LeVwMsTool__Point(snap);
        }
        S.Marker = snap.Kind !== 'none' ? snap : null;
        S.MarkerName = (drag.Kind === 'mouse') ? Na__LeVwMsTool__Name(snap) : null;
        Na__LeVwMsTool__Render();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Let a Grip Go: Keep Where It Was Pulled To (or Put It Back)
    // ------------------------------------------------------------
    function Na__LeVwMsTool__EndPull(keep) {
        const S = Na__LeVwMsTool__S;
        const drag = S.Drag;
        S.Drag = null;
        if (!drag) return;
        try { S.Stage && S.Stage.releasePointerCapture(drag.PointerId); } catch (error) { /* already released */ }
        if (keep && drag.Moved) {
            const m = drag.Working;
            const usable = (m.Tool !== 'rect') || (() => { const r = Na__PubMsMath__Rect(m.Points[0], m.Points[1], m.SpinDeg); return r.Width > 1e-6 && r.Height > 1e-6; })();
            if (usable) Na__PubMs__Replace(S.DocumentId, m);
        }
        S.Marker = null;
        S.MarkerName = null;
        Na__LeVwMsTool__Render();
        Na__LeVwMsTool__Notify();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Pointer, Keyboard and Zoom
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Pointer Down (captured on the stage, before the pan and pinch see it)
    // ------------------------------------------------------------
    function Na__LeVwMsTool__OnPointerDown(event) {
        const S = Na__LeVwMsTool__S;
        if (!S.DocumentId) return;
        if (event.target && event.target.closest && event.target.closest('button, a, input, select, textarea, [contenteditable="true"]')) return;
        const kind = Na__LeVwMsTool__Kind(event);
        S.LastKind = kind;
        if (kind === 'mouse' && event.button !== 0) return;                     // <-- Middle and right keep panning

        // 1. A GRIP OF THE SELECTED MEASUREMENT: pull it. Taken from the pan and
        // the pinch before either can start.
        const grip = Na__LeVwMsTool__GripAt(event.clientX, event.clientY, kind);
        if (grip) {
            event.preventDefault();
            event.stopImmediatePropagation();                                     // <-- Not stopPropagation alone: a press ON the stage itself would still reach its other listeners
            const original = grip.Measure;
            S.Drag = {
                PointerId : event.pointerId, Id : original.Id, Index : grip.Index, Kind : kind,
                Original  : original, Working : JSON.parse(JSON.stringify(original)),
                StartX : event.clientX, StartY : event.clientY, Moved : false
            };
            try { S.Stage.setPointerCapture(event.pointerId); } catch (error) { /* capture refused */ }
            return;
        }

        if (kind === 'touch') return;                                            // <-- A finger's taps arrive through OnTap; its drags pan

        // 2. A TOOL IS ON: put a point down.
        if (S.Tool) {
            event.preventDefault();                                              // <-- No text selection, no drag image
            const hadDraft = !!S.Draft;
            Na__LeVwMsTool__PressAt(event.clientX, event.clientY, kind, event);
            if (!hadDraft && S.Draft && S.Draft.Tool !== 'area') {
                S.Press = { PointerId : event.pointerId, X : event.clientX, Y : event.clientY, Dragging : false };
                try { S.Stage.setPointerCapture(event.pointerId); } catch (error) { /* capture refused */ }
            }
            Na__LeVwMsTool__Hover(event.clientX, event.clientY, event);
            Na__LeVwMsTool__Notify();
            return;
        }

        // 3. NO TOOL: pick a measurement, or delete the picked one by its chip.
        if (Na__LeVwMsTool__ChipAt(event.clientX, event.clientY, kind)) { event.preventDefault(); Na__LeVwMsTool__RemoveSelected(); return; }
        const picked = Na__LeVwMsTool__MeasureAt(event.clientX, event.clientY, kind);
        const next = picked ? picked.Id : null;
        if (next !== S.Selected) {
            S.Selected = next;
            Na__LeVwMsTool__Render();
            Na__LeVwMsTool__Notify();
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where the Next Point Would Land, for a Mouse Hovering With a Tool On
    // ------------------------------------------------------------
    function Na__LeVwMsTool__Hover(clientX, clientY, event) {
        const S = Na__LeVwMsTool__S;
        if (!S.Tool) return;
        const draft = S.Draft;
        const snap = Na__LeVwMsTool__SnapAt(clientX, clientY, 'mouse', event, Na__LeVwMsTool__From(), draft ? draft.SpinDeg : 0, draft ? draft.ViewportId : null);
        S.Cursor = { X : snap.X, Y : snap.Y, Kind : snap.Kind };
        S.Marker = snap.Kind !== 'none' ? snap : null;
        S.MarkerName = Na__LeVwMsTool__Name(snap);
        Na__LeVwMsTool__Render();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Pointer Move
    // ------------------------------------------------------------
    function Na__LeVwMsTool__OnPointerMove(event) {
        const S = Na__LeVwMsTool__S;
        if (!S.DocumentId) return;
        if (S.Drag && event.pointerId === S.Drag.PointerId) { event.preventDefault(); Na__LeVwMsTool__PullTo(event.clientX, event.clientY, event); return; }
        const kind = Na__LeVwMsTool__Kind(event);
        if (kind === 'touch') return;
        S.LastMove = { X : event.clientX, Y : event.clientY, Shift : event.shiftKey, Alt : event.altKey };
        if (S.Tool) {
            if (S.Press && event.pointerId === S.Press.PointerId && !S.Press.Dragging &&
                Math.hypot(event.clientX - S.Press.X, event.clientY - S.Press.Y) > Na__LeVwMsTool__DRAG_PX) S.Press.Dragging = true;
            Na__LeVwMsTool__Hover(event.clientX, event.clientY, event);
            return;
        }
        // NO TOOL: say what a press here would do.
        const grip = Na__LeVwMsTool__GripAt(event.clientX, event.clientY, kind);
        const chip = !grip && Na__LeVwMsTool__ChipAt(event.clientX, event.clientY, kind);
        const over = (!grip && !chip) ? Na__LeVwMsTool__MeasureAt(event.clientX, event.clientY, kind) : null;
        if (S.Stage) {
            S.Stage.classList.toggle(Na__LeVwMsTool__CLASS_GRIP, !!grip);
            S.Stage.classList.toggle(Na__LeVwMsTool__CLASS_PICK, !!(over || chip));
        }
        const hover = over ? over.Id : null;
        if (hover !== S.Hover) { S.Hover = hover; Na__LeVwMsTool__Render(); }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Pointer Up or Cancel
    // ------------------------------------------------------------
    function Na__LeVwMsTool__OnPointerUp(event) {
        const S = Na__LeVwMsTool__S;
        if (S.Drag && event.pointerId === S.Drag.PointerId) { Na__LeVwMsTool__EndPull(event.type !== 'pointercancel'); return; }
        if (S.Press && event.pointerId === S.Press.PointerId) {
            const press = S.Press;
            S.Press = null;
            try { S.Stage && S.Stage.releasePointerCapture(event.pointerId); } catch (error) { /* already released */ }
            // CLICK, DRAG, RELEASE: the release is the second point (PlanVision's other way).
            if (press.Dragging && event.type !== 'pointercancel' && S.Draft && S.Draft.Points.length === 1) {
                const draft = S.Draft;
                const snap = Na__LeVwMsTool__SnapAt(event.clientX, event.clientY, 'mouse', event, Na__LeVwMsTool__From(), draft.SpinDeg, draft.ViewportId);
                Na__LeVwMsTool__Place(snap);
                Na__LeVwMsTool__Hover(event.clientX, event.clientY, event);
                Na__LeVwMsTool__Notify();
            }
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Mouse Has Left the Stage: No Hover Point
    // ------------------------------------------------------------
    function Na__LeVwMsTool__OnPointerLeave(event) {
        const S = Na__LeVwMsTool__S;
        if (Na__LeVwMsTool__Kind(event) === 'touch' || S.Drag) return;
        if (S.Cursor || S.Marker) { S.Cursor = null; S.Marker = null; S.MarkerName = null; Na__LeVwMsTool__Render(); }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Double Click: Close the Area
    // ------------------------------------------------------------
    // Its two clicks each put a corner down on the same spot; one is kept.
    // ------------------------------------------------------------
    function Na__LeVwMsTool__OnDoubleClick(event) {
        const S = Na__LeVwMsTool__S;
        if (S.Tool !== 'area' || !S.Draft) return;
        event.preventDefault();
        const points = S.Draft.Points;
        while (points.length >= 2) {
            const a = Na__LeVwMsTool__Screen(points[points.length - 1]), b = Na__LeVwMsTool__Screen(points[points.length - 2]);
            if (Math.hypot(a.x - b.x, a.y - b.y) > 4) break;
            points.pop();
        }
        if (points.length >= 3) Na__LeVwMsTool__Keep();
        Na__LeVwMsTool__Render();
        Na__LeVwMsTool__Notify();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is a Key Going Into a Box That Takes Text (which keeps its own keys, Ctrl+Z among them)
    // ------------------------------------------------------------
    function Na__LeVwMsTool__Typing(target) {
        if (!target) return false;
        if (target.isContentEditable || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return true;
        if (target.tagName !== 'INPUT') return false;
        return !/^(range|checkbox|radio|button|submit|reset|color)$/i.test(target.type || 'text');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Keys: Undo and Redo, Escape, Enter, Backspace, Delete, and Shift or Alt Changing the Hover
    // ------------------------------------------------------------
    function Na__LeVwMsTool__OnKey(event) {
        const S = Na__LeVwMsTool__S;
        if (!S.DocumentId) return;
        const target = event.target;

        // UNDO AND REDO: Ctrl+Z; Ctrl+Y or Ctrl+Shift+Z; Cmd on a Mac. The
        // menu's slider and tick box let them through; a box taking text keeps
        // them. A key nothing could be undone or redone by is left alone.
        if (event.type === 'keydown' && (event.ctrlKey || event.metaKey) && !event.altKey) {
            const key = String(event.key || '').toLowerCase();
            if ((key === 'z' || key === 'y') && !Na__LeVwMsTool__Typing(target)) {
                const done = (key === 'y' || event.shiftKey) ? Na__LeVwMsTool__Redo() : Na__LeVwMsTool__Undo();
                if (done) event.preventDefault();
            }
            return;
        }
        if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return;

        if (event.type === 'keyup' || event.key === 'Shift' || event.key === 'Alt') {
            if ((event.key === 'Shift' || event.key === 'Alt') && S.Tool && S.LastMove) {
                Na__LeVwMsTool__Hover(S.LastMove.X, S.LastMove.Y, { shiftKey : event.shiftKey, altKey : event.altKey });
            }
            if (event.key === 'Alt') event.preventDefault();                     // <-- Alt alone would open the browser's menu bar
            return;
        }
        if (event.ctrlKey || event.metaKey) return;

        if (event.key === 'Escape') {
            if (S.Drag) { Na__LeVwMsTool__EndPull(false); event.preventDefault(); return; }
            if (S.Draft) { Na__LeVwMsTool__CancelDraft(); event.preventDefault(); return; }
            if (S.Tool) { Na__LeVwMsTool__Stop(); event.preventDefault(); return; }
            if (S.Selected) { S.Selected = null; Na__LeVwMsTool__Render(); Na__LeVwMsTool__Notify(); event.preventDefault(); }
            return;
        }
        if (event.key === 'Enter' && S.Draft && S.Draft.Tool === 'area') {
            if (Na__LeVwMsTool__Finish()) event.preventDefault();
            return;
        }
        if (event.key === 'Backspace' && S.Draft) { Na__LeVwMsTool__Undo(); event.preventDefault(); return; }
        if ((event.key === 'Delete' || event.key === 'Backspace') && S.Selected) { Na__LeVwMsTool__RemoveSelected(); event.preventDefault(); }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Zoom Changed: Redraw at the New Size
    // ------------------------------------------------------------
    function Na__LeVwMsTool__OnZoom() {
        Na__LeVwMsTool__Render();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Drawing and Telling
// -----------------------------------------------------------------------------

    // FUNCTION | Redraw the Overlay on the Next Frame (once however often asked)
    // ------------------------------------------------------------
    function Na__LeVwMsTool__Render() {
        const S = Na__LeVwMsTool__S;
        if (S.Frame || !S.DocumentId) return;
        S.Frame = window.requestAnimationFrame(() => {
            S.Frame = 0;
            if (!S.DocumentId) return;
            const measures = Na__LeVwMsTool__Measures();
            if (S.Drag && S.Drag.Moved) {                                        // <-- The one being pulled, as it is being pulled
                const at = measures.findIndex((one) => one.Id === S.Drag.Id);
                if (at !== -1) measures[at] = S.Drag.Working;
            }
            S.Hits = Na__LeVwMsOv__Render({
                Measures   : measures,
                SelectedId : S.Selected,
                HoverId    : S.Tool ? null : S.Hover,
                Draft      : S.Draft,
                Cursor     : S.Tool ? S.Cursor : null,
                Marker     : S.Marker,
                MarkerName : S.MarkerName
            });
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Tell the Listeners (the bar, the menu, the dock button)
    // ------------------------------------------------------------
    function Na__LeVwMsTool__Notify() {
        const state = Na__LeVwMsTool__State();
        Na__LeVwMsTool__S.Listeners.forEach((fn) => { try { fn(state); } catch (error) { console.warn('[TrueVision3D] Measure listener:', error); } });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | What the Tools Are Doing Now
    // ------------------------------------------------------------
    // { DocumentId, Tool, Points (of the one being made), CanFinish, CanUndo,
    //   CanRedo, UndoPoint (Undo would take back a point, not a change),
    //   Count (kept on this sheet), Selected, SnapOn, Linework (the reading's
    //   status), Flash (a message for the bar), Touch (true when the last press
    //   on the drawing was a finger, false a mouse, null before the first) }
    // ------------------------------------------------------------
    function Na__LeVwMsTool__State() {
        const S = Na__LeVwMsTool__S;
        const draft = S.Draft;
        const history = S.DocumentId ? Na__PubMs__History(S.DocumentId) : { CanUndo : false, CanRedo : false };
        const pointBack = !!(draft && draft.Points.length > 0);
        return {
            DocumentId : S.DocumentId,
            Tool       : S.Tool,
            Points     : draft ? draft.Points.length : 0,
            CanFinish  : !!(draft && draft.Tool === 'area' && draft.Points.length >= 3),
            CanUndo    : pointBack || history.CanUndo,
            CanRedo    : Na__LeVwMsTool__PointAgain() || history.CanRedo,
            UndoPoint  : pointBack,
            Count      : Na__LeVwMsTool__Measures().length,
            Selected   : S.Selected,
            SnapOn     : S.SnapOn,
            Linework   : S.DocumentId ? Na__PubMs__Status(S.DocumentId) : null,
            Flash      : (S.Flash && S.Flash.Until > Date.now()) ? S.Flash.Text : null,
            Touch      : S.LastKind === null ? null : (S.LastKind === 'touch')
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Listen for Changes; Returns the Way to Stop Listening
    // ------------------------------------------------------------
    function Na__LeVwMsTool__OnChange(fn) {
        if (typeof fn !== 'function') return () => {};
        Na__LeVwMsTool__S.Listeners.add(fn);
        return () => Na__LeVwMsTool__S.Listeners.delete(fn);
    }
    // ------------------------------------------------------------


    // FUNCTION | Bind to the Published Drawing on Screen, and Draw What Was Measured on It
    // ------------------------------------------------------------
    function Na__LeVwMsTool__Attach(documentId) {
        const S = Na__LeVwMsTool__S;
        const els = Na__LeSurface__GetElements();
        if (!documentId || !els.stage || !els.paper) return false;
        if (S.DocumentId === documentId && S.Stage === els.stage) {
            Na__LeVwMsOv__Ensure(els.paper);                                     // <-- A new paper size, or something put on top since
            Na__LeVwMsTool__Render();
            return true;
        }
        Na__LeVwMsTool__Detach();
        Na__LeVwMsTool__ReadSize();
        S.DocumentId = documentId;
        S.Stage = els.stage;
        Na__LeVwMsOv__Ensure(els.paper);
        S.Bound = {
            pointerdown   : Na__LeVwMsTool__OnPointerDown,
            pointermove   : Na__LeVwMsTool__OnPointerMove,
            pointerup     : Na__LeVwMsTool__OnPointerUp,
            pointercancel : Na__LeVwMsTool__OnPointerUp,
            pointerleave  : Na__LeVwMsTool__OnPointerLeave,
            dblclick      : Na__LeVwMsTool__OnDoubleClick,
            key           : Na__LeVwMsTool__OnKey,
            zoom          : Na__LeVwMsTool__OnZoom
        };
        S.Stage.addEventListener('pointerdown', S.Bound.pointerdown, true);        // <-- Capture: a grip is taken before the pan or the pinch sees the press
        S.Stage.addEventListener('pointermove', S.Bound.pointermove, { passive : false });
        S.Stage.addEventListener('pointerup', S.Bound.pointerup);
        S.Stage.addEventListener('pointercancel', S.Bound.pointercancel);
        S.Stage.addEventListener('pointerleave', S.Bound.pointerleave);
        S.Stage.addEventListener('dblclick', S.Bound.dblclick);
        window.addEventListener('keydown', S.Bound.key);
        window.addEventListener('keyup', S.Bound.key);
        window.addEventListener(Na__LeSurface__ZOOM_EVENT, S.Bound.zoom);
        window.addEventListener(Na__LeSurface__ZOOM_SETTLED_EVENT, S.Bound.zoom);
        Na__LeVwMsTool__Render();
        Na__LeVwMsTool__Notify();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Let the Drawing Go: Tools Off, Overlay Off (its measurements stay in the store)
    // ------------------------------------------------------------
    function Na__LeVwMsTool__Detach() {
        const S = Na__LeVwMsTool__S;
        if (S.Stage && S.Bound) {
            S.Stage.removeEventListener('pointerdown', S.Bound.pointerdown, true);
            S.Stage.removeEventListener('pointermove', S.Bound.pointermove);
            S.Stage.removeEventListener('pointerup', S.Bound.pointerup);
            S.Stage.removeEventListener('pointercancel', S.Bound.pointercancel);
            S.Stage.removeEventListener('pointerleave', S.Bound.pointerleave);
            S.Stage.removeEventListener('dblclick', S.Bound.dblclick);
            window.removeEventListener('keydown', S.Bound.key);
            window.removeEventListener('keyup', S.Bound.key);
            window.removeEventListener(Na__LeSurface__ZOOM_EVENT, S.Bound.zoom);
            window.removeEventListener(Na__LeSurface__ZOOM_SETTLED_EVENT, S.Bound.zoom);
            S.Stage.classList.remove(Na__LeVwMsTool__CLASS_TOOL, Na__LeVwMsTool__CLASS_GRIP, Na__LeVwMsTool__CLASS_PICK);
        }
        if (S.Frame) window.cancelAnimationFrame(S.Frame);
        if (S.MarkerTimer) window.clearTimeout(S.MarkerTimer);
        if (S.FlashTimer) window.clearTimeout(S.FlashTimer);
        const was = S.DocumentId;
        Object.assign(S, {
            DocumentId : null, Stage : null, Bound : null, Tool : null, Draft : null, Selected : null, Hover : null,
            Cursor : null, Marker : null, MarkerName : null, MarkerTimer : 0, Drag : null, Press : null, DraftRedo : null,
            LastMove : null, Flash : null, FlashTimer : 0, Hits : { Labels : [], Chip : null }, Frame : 0
        });
        Na__LeVwMsOv__Remove();
        if (was) Na__LeVwMsTool__Notify();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Turn a Tool On ('linear' | 'rect' | 'area'), Reading the Sheet's Linework if Not Yet Read
    // ------------------------------------------------------------
    function Na__LeVwMsTool__Start(tool) {
        const S = Na__LeVwMsTool__S;
        if (!S.DocumentId || Na__LeVwMsTool__TOOLS.indexOf(tool) === -1) return false;
        S.Tool = tool;
        S.Draft = null;
        S.Press = null;
        S.DraftRedo = null;
        S.Selected = null;
        S.Hover = null;
        if (S.Stage) S.Stage.classList.add(Na__LeVwMsTool__CLASS_TOOL);
        Na__LeVwMsTool__Prepare();
        if (S.LastMove) Na__LeVwMsTool__Hover(S.LastMove.X, S.LastMove.Y, { shiftKey : S.LastMove.Shift, altKey : S.LastMove.Alt });
        Na__LeVwMsTool__Render();
        Na__LeVwMsTool__Notify();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Read the Sheet's Linework Now (the menu asks as it opens, so it is ready by the time a tool is picked)
    // ------------------------------------------------------------
    function Na__LeVwMsTool__Prepare() {
        const S = Na__LeVwMsTool__S;
        const documentId = S.DocumentId;
        if (!documentId) return null;
        const heard = () => {
            if (S.DocumentId !== documentId) return;
            if (S.Tool && S.LastMove) Na__LeVwMsTool__Hover(S.LastMove.X, S.LastMove.Y, { shiftKey : S.LastMove.Shift, altKey : S.LastMove.Alt });
            Na__LeVwMsTool__Notify();
        };
        const reading = Na__PubMs__Prepare(documentId, heard);
        reading.then(heard, heard);                                               // <-- And when it has finished, whatever the last progress said
        return reading;
    }
    // ------------------------------------------------------------


    // FUNCTION | Turn the Tool Off (the measurement half made goes)
    // ------------------------------------------------------------
    function Na__LeVwMsTool__Stop() {
        const S = Na__LeVwMsTool__S;
        S.Tool = null;
        S.Draft = null;
        S.Press = null;
        S.DraftRedo = null;
        S.Cursor = null;
        S.Marker = null;
        S.MarkerName = null;
        if (S.Stage) S.Stage.classList.remove(Na__LeVwMsTool__CLASS_TOOL);
        Na__LeVwMsTool__Render();
        Na__LeVwMsTool__Notify();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Drop the Measurement Half Made, Keeping the Tool On
    // ------------------------------------------------------------
    function Na__LeVwMsTool__CancelDraft() {
        const S = Na__LeVwMsTool__S;
        S.Draft = null;
        S.Press = null;
        S.DraftRedo = null;
        Na__LeVwMsTool__Render();
        Na__LeVwMsTool__Notify();
    }
    // ------------------------------------------------------------


    // FUNCTION | Close the Area Being Drawn (three corners or more); true when it was kept
    // ------------------------------------------------------------
    function Na__LeVwMsTool__Finish() {
        const S = Na__LeVwMsTool__S;
        if (!S.Draft || S.Draft.Tool !== 'area' || S.Draft.Points.length < 3) return false;
        Na__LeVwMsTool__Keep();
        Na__LeVwMsTool__Render();
        Na__LeVwMsTool__Notify();
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Could Redo Put a Point Back on the Measurement Being Made
    // ------------------------------------------------------------
    // Only with the same tool on, and on the same drawing.
    // ------------------------------------------------------------
    function Na__LeVwMsTool__PointAgain() {
        const S = Na__LeVwMsTool__S;
        const back = S.DraftRedo;
        if (!back || back.Points.length === 0 || S.Tool !== back.Meta.Tool) return false;
        return !S.Draft || S.Draft.ViewportId === back.Meta.ViewportId;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | After Undo or Redo of a Change: Let Go of a Pick That Has Gone
    // ------------------------------------------------------------
    // The points undone off the measurement being made cannot come back once
    // a change to the kept ones has been stepped over.
    // ------------------------------------------------------------
    function Na__LeVwMsTool__AfterHistory() {
        const S = Na__LeVwMsTool__S;
        const ids = new Set(Na__LeVwMsTool__Measures().map((one) => one.Id));
        if (S.Selected && !ids.has(S.Selected)) S.Selected = null;
        if (S.Hover && !ids.has(S.Hover)) S.Hover = null;
        S.DraftRedo = null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Undo: the Last Point of the Measurement Being Made, or With None Being Made, the Last Change to the Kept Ones
    // ------------------------------------------------------------
    // A change is a measurement kept, pulled, deleted, or the sheet cleared.
    // Returns true when something was undone. Not while a grip is held.
    // ------------------------------------------------------------
    function Na__LeVwMsTool__Undo() {
        const S = Na__LeVwMsTool__S;
        if (!S.DocumentId || S.Drag) return false;
        if (S.Draft && S.Draft.Points.length) {
            const draft = S.Draft;
            if (!S.DraftRedo || S.DraftRedo.Meta.Tool !== draft.Tool || S.DraftRedo.Meta.ViewportId !== draft.ViewportId) {
                S.DraftRedo = { Meta : { Tool : draft.Tool, ViewportId : draft.ViewportId, Scale : draft.Scale, SpinDeg : draft.SpinDeg }, Points : [] };
            }
            S.DraftRedo.Points.push(draft.Points.pop());
            if (draft.Points.length === 0) S.Draft = null;
            S.Press = null;
        } else if (Na__PubMs__Undo(S.DocumentId)) {
            Na__LeVwMsTool__AfterHistory();
        } else {
            return false;
        }
        if (S.Tool && S.LastMove) Na__LeVwMsTool__Hover(S.LastMove.X, S.LastMove.Y, { shiftKey : S.LastMove.Shift, altKey : S.LastMove.Alt });   // <-- The square and the perpendicular follow the new last point
        Na__LeVwMsTool__Render();
        Na__LeVwMsTool__Notify();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Redo: Put Back What Undo Took, a Point or a Change; true When Something Came Back
    // ------------------------------------------------------------
    function Na__LeVwMsTool__Redo() {
        const S = Na__LeVwMsTool__S;
        if (!S.DocumentId || S.Drag) return false;
        if (Na__LeVwMsTool__PointAgain()) {
            const back = S.DraftRedo;
            if (!S.Draft) S.Draft = { Tool : back.Meta.Tool, ViewportId : back.Meta.ViewportId, Scale : back.Meta.Scale, SpinDeg : back.Meta.SpinDeg, Points : [] };
            S.Draft.Points.push(back.Points.pop());
            if (back.Points.length === 0) S.DraftRedo = null;
        } else if (Na__PubMs__Redo(S.DocumentId)) {
            Na__LeVwMsTool__AfterHistory();
        } else {
            return false;
        }
        if (S.Tool && S.LastMove) Na__LeVwMsTool__Hover(S.LastMove.X, S.LastMove.Y, { shiftKey : S.LastMove.Shift, altKey : S.LastMove.Alt });
        Na__LeVwMsTool__Render();
        Na__LeVwMsTool__Notify();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete the Picked Measurement
    // ------------------------------------------------------------
    function Na__LeVwMsTool__RemoveSelected() {
        const S = Na__LeVwMsTool__S;
        if (!S.Selected) return false;
        Na__PubMs__Remove(S.DocumentId, S.Selected);
        S.Selected = null;
        S.Hover = null;
        Na__LeVwMsTool__Render();
        Na__LeVwMsTool__Notify();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete Every Measurement on This Sheet; Returns How Many Went
    // ------------------------------------------------------------
    function Na__LeVwMsTool__ClearAll() {
        const S = Na__LeVwMsTool__S;
        if (!S.DocumentId) return 0;
        const count = Na__PubMs__Clear(S.DocumentId);
        S.Selected = null;
        S.Hover = null;
        S.Draft = null;
        S.DraftRedo = null;
        Na__LeVwMsTool__Render();
        Na__LeVwMsTool__Notify();
        return count;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read the Dimension Size This Browser Kept (once; nothing kept leaves the default)
    // ------------------------------------------------------------
    function Na__LeVwMsTool__ReadSize() {
        const S = Na__LeVwMsTool__S;
        if (S.SizeRead) return;
        S.SizeRead = true;
        let kept = null;
        try { kept = (typeof window !== 'undefined' && window.localStorage) ? window.localStorage.getItem(Na__LeVwMsTool__SIZE_KEY) : null; } catch (error) { kept = null; }   // <-- Storage is a courtesy
        if (kept !== null && kept !== '' && Number.isFinite(parseFloat(kept))) Na__LeVwMsOv__SetSize(parseFloat(kept));
    }
    // ------------------------------------------------------------


    // FUNCTION | Set the Dimensions' Size (a factor: 1 is the default), Kept in This Browser; Returns the Size Set
    // ------------------------------------------------------------
    function Na__LeVwMsTool__SetSize(factor) {
        Na__LeVwMsTool__S.SizeRead = true;                                       // <-- What the reader sets wins over what was kept
        const size = Na__LeVwMsOv__SetSize(factor);
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                if (Math.abs(size - Na__LeVwMsOv__SIZE.Default) < 1e-9) window.localStorage.removeItem(Na__LeVwMsTool__SIZE_KEY);
                else window.localStorage.setItem(Na__LeVwMsTool__SIZE_KEY, String(size));
            }
        } catch (error) { /* kept for this visit only */ }
        Na__LeVwMsTool__Render();
        return size;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Dimensions' Size Now (a factor: 1 is the default)
    // ------------------------------------------------------------
    function Na__LeVwMsTool__GetSize() {
        Na__LeVwMsTool__ReadSize();
        return Na__LeVwMsOv__GetSize();
    }
    // ------------------------------------------------------------


    // FUNCTION | Snap to the Drawing, or Put Points Exactly Where They Are Pressed
    // ------------------------------------------------------------
    function Na__LeVwMsTool__SetSnap(on) {
        const S = Na__LeVwMsTool__S;
        S.SnapOn = !!on;
        if (S.Tool && S.LastMove) Na__LeVwMsTool__Hover(S.LastMove.X, S.LastMove.Y, { shiftKey : S.LastMove.Shift, altKey : S.LastMove.Alt });
        Na__LeVwMsTool__Notify();
    }
    // ------------------------------------------------------------


    // FUNCTION | A Finger's Tap, Handed Over by the Touch Recogniser; true When It Was Used Here
    // ------------------------------------------------------------
    // A tap the tools take is not the first half of a double-tap zoom.
    // ------------------------------------------------------------
    function Na__LeVwMsTool__OnTap(clientX, clientY) {
        const S = Na__LeVwMsTool__S;
        if (!S.DocumentId) return false;
        S.LastKind = 'touch';
        if (S.Tool) {
            Na__LeVwMsTool__PressAt(clientX, clientY, 'touch', null);
            Na__LeVwMsTool__Render();
            Na__LeVwMsTool__Notify();
            return true;
        }
        if (Na__LeVwMsTool__ChipAt(clientX, clientY, 'touch')) { Na__LeVwMsTool__RemoveSelected(); return true; }
        const picked = Na__LeVwMsTool__MeasureAt(clientX, clientY, 'touch');
        if (picked) { S.Selected = picked.Id; Na__LeVwMsTool__Render(); Na__LeVwMsTool__Notify(); return true; }
        if (S.Selected) { S.Selected = null; Na__LeVwMsTool__Render(); Na__LeVwMsTool__Notify(); return true; }
        return false;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    export {
        Na__LeVwMsTool__TOOLS,
        Na__LeVwMsTool__SIZE,
        Na__LeVwMsTool__State,
        Na__LeVwMsTool__OnChange,
        Na__LeVwMsTool__Attach,
        Na__LeVwMsTool__Detach,
        Na__LeVwMsTool__Start,
        Na__LeVwMsTool__Prepare,
        Na__LeVwMsTool__Stop,
        Na__LeVwMsTool__CancelDraft,
        Na__LeVwMsTool__Finish,
        Na__LeVwMsTool__Undo,
        Na__LeVwMsTool__Redo,
        Na__LeVwMsTool__RemoveSelected,
        Na__LeVwMsTool__ClearAll,
        Na__LeVwMsTool__SetSnap,
        Na__LeVwMsTool__SetSize,
        Na__LeVwMsTool__GetSize,
        Na__LeVwMsTool__OnTap
    };

// endregion -------------------------------------------------------------------
