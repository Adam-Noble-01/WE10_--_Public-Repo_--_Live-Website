// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - OBJECT SNAP - SEARCH
// =============================================================================
//
// FILE       : Na__LayoutEditor__ObjectSnap__Search__.js
// NAMESPACE  : Na__LeOsnap
// MODULE     : Layout Editor - Object Snap - Search
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The tools' way in: the nearest snap point to a cursor, by the running snap modes, across the viewports' linework and everything drawn on the sheet
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - THIS IS THE FILE A TOOL IMPORTS. Snap takes a cursor point and hands back
//   where the point should land, showing the marker as it goes; Find is the
//   same search without the marker, for a tool that decides for itself what
//   to show (a vector moved whole tries every one of its corners).
// - THE RUNNING SNAP MODES, AutoCAD's, each switched in the snap menu:
//     Endpoint       the ends of lines, the corners of vectors and text boxes
//     Midpoint       the middle of a line or an edge
//     Intersection   where two lines cross - two lines of the drawing, two
//                    vectors, or a vector and the drawing under it
//     Perpendicular  where the line being drawn would meet another line square
//                    on. It needs to know where the line is drawn FROM, so the
//                    caller hands that in (options.from): the last vertex of a
//                    polyline, the far end of a dimension, the neighbours of a
//                    vertex being dragged. With nothing to be square to, it
//                    finds nothing.
//     Centre         the centre of area of a closed vector, of a circle or an
//                    arc, the middle of a text box
//     Nearest        the closest point on a line. It answers everywhere along
//                    every line, so it is only ever taken when no other mode
//                    finds a point in reach - and it ships switched off.
// - WHICH ONE WINS. The nearest to the cursor, weighted: an endpoint at face
//   value, an intersection a hair behind it (1.05), a midpoint or a centre at
//   1.25 times its distance (an endpoint wins a near tie, as it always has),
//   a perpendicular at 1.4. The frontmost viewport under the cursor owns the
//   snap among viewports. THE DRAWING OUTRANKS A VECTOR'S COPY OF IT: where a
//   vector's point and a point of the drawing are the same place (within
//   0.05 mm) the drawing's is taken, so the new point lands on the wall's
//   corner itself and the marker is purple - and a blue marker over a drawing
//   reliably means "the vector's point, where the drawing has none".
// - EVERY HIT SAYS WHAT IT FOUND AND WHAT IT BELONGS TO: kind is the mode,
//   target the kind of object (viewport, shape, text, dimension, paper, grid).
//   The marker draws the first as a shape and the second as a colour.
// - THE DRAWING GRID IS THE FALLBACK. With Grid Snap on (F7), a point no
//   object snap reaches goes to the nearest grid point. Object snaps always
//   come first, and the grid works with Object Snap (F3) off, as LayOut's does.
// - OnLinework answers a different question for the grips: is THIS point on
//   the drawing - on one of its corners, middles or crossings, or on one of
//   its lines - so a vertex that really is on the wall's corner can be drawn
//   green and one that only looks it, blue.
//
// INTEGRATION:
// - Draw, Rectangle, Floor Area, Dimension and Leader tools, the vertex,
//   dimension end and leader tip drags, the picture handles and crop, the
//   parametric grips and the Vector Tools all call Snap.
// - Na__LayoutEditor__ObjectSnap__Moves__ and __GridMoves__ (whole-object
//   moves) and Na__LayoutEditor__ViewportSnapMove__ (a carried viewport) call
//   Find and FindOnViewport.
// - Na__LayoutEditor__Grips__ asks OnLinework for each vertex it draws.
// // @delegate: ./Na__LayoutEditor__ObjectSnap__Index__.js
// // @delegate: ./Na__LayoutEditor__ObjectSnap__Sources__.js
// // @delegate: ./Na__LayoutEditor__ObjectSnap__Marker__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026). Find, FindOnViewport,
//                   FindGrid, Snap and the sheet and viewport searches came
//                   across from 30__System__SheetTools/Na__LayoutEditor__Snapping__.js
//                   1.5.0, which knew endpoints and midpoints only.
// - ValeVision    : not yet ported - it waits for Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Moved here from the Snapping module. New: Intersection, Perpendicular,
//   Centre and Nearest; text as a snap source; every hit carries its target;
//   options.from; OnLinework and SegmentsInBox. Snap's `tone` argument is gone
//   (the marker's colour is the target's); a caller still passing one is
//   answered as if it had not.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Surface and the Grid
    // ------------------------------------------------------------
    import { Na__LeCfg__GetSnappingSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__KIND_2D, Na__LeModel__GetLayers } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__GetPixelsPerMm, Na__LeSurface__GetZoom } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeGrid__IsSnapping, Na__LeGrid__Nearest } from '../27__System__DrawingGrid/Na__LayoutEditor__DrawingGrid__State__.js';   // <-- A leaf: the grid's settings and its nearest point
    // ------------------------------------------------------------

    // MODULE IMPORTS | This Folder: the Switches, the Maths, the Index, the Sheet's Sources and the Marker
    // ------------------------------------------------------------
    import {
        Na__LeOsnap__KIND_END,
        Na__LeOsnap__KIND_MID,
        Na__LeOsnap__KIND_INT,
        Na__LeOsnap__KIND_PERP,
        Na__LeOsnap__KIND_CEN,
        Na__LeOsnap__KIND_NEAR,
        Na__LeOsnap__KIND_GRID,
        Na__LeOsnap__KIND_INFER,
        Na__LeOsnap__TARGET_VIEWPORT,
        Na__LeOsnap__TARGET_SHAPE,
        Na__LeOsnap__TARGET_TEXT,
        Na__LeOsnap__TARGET_DIMENSION,
        Na__LeOsnap__TARGET_PAPER,
        Na__LeOsnap__TARGET_GRID,
        Na__LeOsnap__IsEnabled,
        Na__LeOsnap__IsModeOn,
        Na__LeOsnap__IsTargetOn
    } from './Na__LayoutEditor__ObjectSnap__State__.js';
    import { Na__LeOsnapGeo__Foot, Na__LeOsnapGeo__Nearest, Na__LeOsnapGeo__Cross } from './Na__LayoutEditor__ObjectSnap__Geometry__.js';
    import {
        Na__LeOsnap__POINT_MID,
        Na__LeOsnap__IndexFor,
        Na__LeOsnap__ClearIndexes,
        Na__LeOsnap__EachCell,
        Na__LeOsnap__SegmentNumbersIn
    } from './Na__LayoutEditor__ObjectSnap__Index__.js';
    import {
        Na__LeOsnap__Offers,
        Na__LeOsnap__Exclusions,
        Na__LeOsnap__ChromePoints,
        Na__LeOsnap__EachSheetPoint,
        Na__LeOsnap__EachSheetSegment
    } from './Na__LayoutEditor__ObjectSnap__Sources__.js';
    import { Na__LeOsnap__ShowMarker, Na__LeOsnap__HideMarker } from './Na__LayoutEditor__ObjectSnap__Marker__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | How Each Kind Is Weighed, and the Limits of a Search
    // ------------------------------------------------------------
    // A hit's score is its distance from the cursor times its kind's weight,
    // and the lowest score wins: an endpoint wins a near tie with a midpoint,
    // and a perpendicular gives way to a corner beside it. An intersection
    // sits a hair behind an endpoint ON PURPOSE: two lines that meet at a
    // corner cross exactly where their endpoints are, and the crossing is
    // WORKED OUT (499.00000000000006) where the endpoint is WRITTEN DOWN (499)
    // - so where the two coincide the endpoint's own coordinates are what a
    // point lands on. Nearest has no weight, because it is never scored
    // against the others.
    // ------------------------------------------------------------
    const Na__LeOsnap__WEIGHTS = Object.freeze({ end : 1, int : 1.05, mid : 1.25, cen : 1.25, perp : 1.4 });
    const Na__LeOsnap__MAX_CROSSING_LINES = 48;                              // <-- Lines round the cursor that are tried against each other: past this (dense hatching) the rest are left out
    const Na__LeOsnap__ON_SEGMENT_SLACK   = 1e-9;                            // <-- How far past a line's own end (as a fraction) a perpendicular may land and still be on it
    const Na__LeOsnap__SAME_POINT_MM      = 1e-6;                            // <-- A perpendicular this close to where the line starts from is no line at all
    const Na__LeOsnap__END_OF_LINE        = 1e-6;                            // <-- A crossing this close to a line's end (as a fraction of it) is AT its end
    const Na__LeOsnap__SAME_PLACE_MM      = 0.05;                            // <-- A vector's point this close to a point of the drawing is a copy of it: the drawing's is the one taken
    const Na__LeOsnap__ON_LINEWORK_MM     = 0.01;                            // <-- A point this close to the drawing is ON it: numeric noise, a hundredth of a millimetre of paper
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | A Search in Progress
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Snap Radius in Paper Millimetres at the Current Zoom
    // ------------------------------------------------------------
    function Na__LeOsnap__RadiusMm() {
        return Na__LeCfg__GetSnappingSetup().radiusPx / Math.max(1e-6, Na__LeSurface__GetPixelsPerMm() * Na__LeSurface__GetZoom());
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Which Modes Are Running, as One Object
    // ------------------------------------------------------------
    // The config's Endpoints and Midpoints switches still rule their modes
    // out altogether, as they did before there was a menu.
    // ------------------------------------------------------------
    function Na__LeOsnap__RunningModes() {
        const setup = Na__LeCfg__GetSnappingSetup();
        return {
            end  : setup.endpoints !== false && Na__LeOsnap__IsModeOn(Na__LeOsnap__KIND_END),
            mid  : setup.midpoints !== false && Na__LeOsnap__IsModeOn(Na__LeOsnap__KIND_MID),
            int  : Na__LeOsnap__IsModeOn(Na__LeOsnap__KIND_INT),
            perp : Na__LeOsnap__IsModeOn(Na__LeOsnap__KIND_PERP),
            cen  : Na__LeOsnap__IsModeOn(Na__LeOsnap__KIND_CEN),
            near : Na__LeOsnap__IsModeOn(Na__LeOsnap__KIND_NEAR)
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where the Line Being Drawn Starts From, as a List
    // ------------------------------------------------------------
    // options.from is one { x, y } (or [x, y]), or several - a vertex being
    // dragged has a neighbour on either side, and may be square to a line from
    // either of them.
    // ------------------------------------------------------------
    function Na__LeOsnap__FromPoints(options) {
        const raw  = options ? options.from : null;
        const list = Array.isArray(raw) && !Number.isFinite(raw[0]) ? raw : (raw ? [ raw ] : []);
        const out  = [];
        list.forEach((p) => {
            if (!p) return;
            const x = Array.isArray(p) ? p[0] : p.x, y = Array.isArray(p) ? p[1] : p.y;
            if (Number.isFinite(x) && Number.isFinite(y)) out.push({ x : x, y : y });
        });
        return out;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Fresh Probe: the Cursor, Its Reach, and What Has Been Found So Far
    // ------------------------------------------------------------
    // best is the winner among the point modes; near is the closest point on
    // a line, kept apart because it is only taken when best is empty; lines
    // are the lines passing within reach, for the crossings.
    // ------------------------------------------------------------
    function Na__LeOsnap__NewProbe(pointMm, radiusMm, modes, from) {
        return { px : pointMm.x, py : pointMm.y, r : radiusMm, modes : modes, from : from || [], best : null, near : null, lines : [] };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Offer One Point: a Cheap Box Test Before the Square Root
    // ------------------------------------------------------------
    function Na__LeOsnap__OfferPoint(probe, x, y, kind, target, viewportId, source, sourceId) {
        if (!probe.modes[kind]) return;
        const dx = x - probe.px, dy = y - probe.py, r = probe.r;
        if (dx > r || dx < -r || dy > r || dy < -r) return;
        const d = Math.hypot(dx, dy);
        if (d > r) return;
        const score = d * Na__LeOsnap__WEIGHTS[kind];
        if (!probe.best || score < probe.best.score) {
            probe.best = { x : x, y : y, kind : kind, target : target, viewportId : viewportId || null, source : source, sourceId : sourceId === undefined ? null : sourceId, distanceMm : d, score : score };
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Offer One Line: Its Nearest Point, Its Perpendiculars, and Itself for the Crossings
    // ------------------------------------------------------------
    // A line that does not pass within reach of the cursor has nothing to
    // offer: a perpendicular's foot within reach lies on it, and a crossing
    // within reach lies on both lines, so both need the line itself in reach.
    // ------------------------------------------------------------
    function Na__LeOsnap__OfferLine(probe, ax, ay, bx, by, target, viewportId, source, sourceId) {
        const modes = probe.modes;
        if (!modes.near && !modes.perp && !modes.int) return;
        const near = Na__LeOsnapGeo__Nearest(ax, ay, bx, by, probe.px, probe.py);
        if (near.distance > probe.r) return;
        if (modes.near && (!probe.near || near.distance < probe.near.distanceMm)) {
            probe.near = { x : near.x, y : near.y, kind : Na__LeOsnap__KIND_NEAR, target : target, viewportId : viewportId || null, source : source, sourceId : sourceId === undefined ? null : sourceId, distanceMm : near.distance, score : near.distance };
        }
        if (modes.int && probe.lines.length < Na__LeOsnap__MAX_CROSSING_LINES) probe.lines.push([ ax, ay, bx, by, target, viewportId || null, source, sourceId === undefined ? null : sourceId ]);
        if (modes.perp) {
            for (let k = 0; k < probe.from.length; k++) {
                const f    = probe.from[k];
                const foot = Na__LeOsnapGeo__Foot(ax, ay, bx, by, f.x, f.y);
                if (!foot || foot.t < -Na__LeOsnap__ON_SEGMENT_SLACK || foot.t > 1 + Na__LeOsnap__ON_SEGMENT_SLACK) continue;   // <-- Square to the line, but off the end of it
                if (Math.hypot(foot.x - f.x, foot.y - f.y) < Na__LeOsnap__SAME_POINT_MM) continue;                                  // <-- The line starts ON this one: there is no perpendicular to draw
                Na__LeOsnap__OfferPoint(probe, foot.x, foot.y, Na__LeOsnap__KIND_PERP, target, viewportId, source, sourceId);
            }
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Offer Where the Lines in Reach Cross Each Other
    // ------------------------------------------------------------
    // own against own, or own against another probe's (the sheet's vectors
    // against the drawing under them). A crossing of two kinds of object takes
    // the colour of the one drawn on the sheet, which is what the eye is on.
    //
    // TWO LINES THAT MEET END TO END DO NOT CROSS. Every vertex of a polyline
    // is where one edge stops and the next starts, so without this rule
    // Intersection would find every vertex of every vector - a point every few
    // millimetres round a circle - and would go on finding corners with
    // Endpoint switched off. A corner is an ENDPOINT's to find. A line that
    // stops part way along another (a T) is still a crossing: the other line
    // has no endpoint there.
    // ------------------------------------------------------------
    function Na__LeOsnap__OfferCrossings(probe, others) {
        if (!probe.modes.int) return;
        const mine = probe.lines, theirs = others || mine, same = theirs === mine;
        const atAnEnd = (t) => t <= Na__LeOsnap__END_OF_LINE || t >= 1 - Na__LeOsnap__END_OF_LINE;
        for (let i = 0; i < mine.length; i++) {
            const a = mine[i];
            for (let j = same ? i + 1 : 0; j < theirs.length; j++) {
                const b = theirs[j];
                const at = Na__LeOsnapGeo__Cross(a[0], a[1], a[2], a[3], b[0], b[1], b[2], b[3]);
                if (!at || (atAnEnd(at.t) && atAnEnd(at.u))) continue;          // <-- End to end: a corner, not a crossing
                Na__LeOsnap__OfferPoint(probe, at.x, at.y, Na__LeOsnap__KIND_INT, a[4], a[5], a[6], a[7]);
            }
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Search
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Everything the Sheet's Own Objects Offer Near the Cursor
    // ------------------------------------------------------------
    // UNTIL THIS EXISTED A VECTOR COULD NOT SNAP TO ANOTHER VECTOR, or to its
    // own corners. The only candidates were the projected linework inside 2D
    // viewports, so a line drawn on open paper - a key plan outline, a detail
    // border, a site boundary - had nothing to hold on to, and closing a
    // polygon or starting a second line on the end of the first came down to
    // a steady hand. Returns the probe; its best is the hit, or null.
    // ------------------------------------------------------------
    function Na__LeOsnap__FindOnSheet(sheet, pointMm, radiusMm, exclude, modes, from) {
        const setup  = Na__LeCfg__GetSnappingSetup();
        const probe  = Na__LeOsnap__NewProbe(pointMm, radiusMm, modes || Na__LeOsnap__RunningModes(), from);
        const wanted = {
            shape     : setup.sheetObjects !== false && Na__LeOsnap__IsTargetOn(Na__LeOsnap__TARGET_SHAPE),
            text      : setup.sheetObjects !== false && Na__LeOsnap__IsTargetOn(Na__LeOsnap__TARGET_TEXT),
            dimension : setup.sheetObjects !== false && Na__LeOsnap__IsTargetOn(Na__LeOsnap__TARGET_DIMENSION),
            paper     : setup.sheetChrome  !== false && Na__LeOsnap__IsTargetOn(Na__LeOsnap__TARGET_PAPER)
        };
        if (!wanted.shape && !wanted.text && !wanted.dimension && !wanted.paper) return probe;
        const near = { x : pointMm.x, y : pointMm.y, r : radiusMm };
        Na__LeOsnap__EachSheetPoint(sheet, exclude, near, wanted, (x, y, kind, target, source, sourceId) => Na__LeOsnap__OfferPoint(probe, x, y, kind, target, null, source, sourceId));
        Na__LeOsnap__EachSheetSegment(sheet, exclude, near, wanted, (ax, ay, bx, by, target, source, sourceId) => Na__LeOsnap__OfferLine(probe, ax, ay, bx, by, target, null, source, sourceId));
        Na__LeOsnap__OfferCrossings(probe, null);
        return probe;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Everything One Viewport's Linework Offers Near the Cursor
    // ------------------------------------------------------------
    // Reads only the grid squares the radius touches. Hands back an empty
    // probe when the cursor is nowhere near the frame or the viewport has no
    // linework painted yet.
    // ------------------------------------------------------------
    function Na__LeOsnap__SearchViewport(viewport, pointMm, radiusMm, modes, from) {
        const probe = Na__LeOsnap__NewProbe(pointMm, radiusMm, modes || Na__LeOsnap__RunningModes(), from);
        const frame = viewport.Viewport__FrameMm;
        if (pointMm.x < frame.X - radiusMm || pointMm.x > frame.X + frame.WidthMm + radiusMm ||
            pointMm.y < frame.Y - radiusMm || pointMm.y > frame.Y + frame.HeightMm + radiusMm) return probe;
        const entry = Na__LeOsnap__IndexFor(viewport.Viewport__Id);
        if (!entry) return probe;
        const id = viewport.Viewport__Id;
        const minX = pointMm.x - radiusMm, maxX = pointMm.x + radiusMm, minY = pointMm.y - radiusMm, maxY = pointMm.y + radiusMm;
        if (probe.modes.end || probe.modes.mid) {
            Na__LeOsnap__EachCell(minX, minY, maxX, maxY, (key) => {
                const bucket = entry.points.get(key);
                if (!bucket) return;
                for (let k = 0; k + 2 < bucket.length; k += 3) {
                    Na__LeOsnap__OfferPoint(probe, bucket[k], bucket[k + 1], bucket[k + 2] === Na__LeOsnap__POINT_MID ? Na__LeOsnap__KIND_MID : Na__LeOsnap__KIND_END, Na__LeOsnap__TARGET_VIEWPORT, id, 'viewport', id);
                }
            });
        }
        if (probe.modes.near || probe.modes.perp || probe.modes.int) {
            const segs = entry.segs;
            Na__LeOsnap__SegmentNumbersIn(entry, minX, minY, maxX, maxY).forEach((n) => {
                Na__LeOsnap__OfferLine(probe, segs[n * 4], segs[(n * 4) + 1], segs[(n * 4) + 2], segs[(n * 4) + 3], Na__LeOsnap__TARGET_VIEWPORT, id, 'viewport', id);
            });
            Na__LeOsnap__OfferCrossings(probe, null);
        }
        return probe;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The 2D Viewports That May Be Snapped To, Frontmost First
    // ------------------------------------------------------------
    function Na__LeOsnap__OrderedViewports(sheet, exclude) {
        if (!Na__LeOsnap__IsTargetOn(Na__LeOsnap__TARGET_VIEWPORT)) return [];
        const layers  = Na__LeModel__GetLayers(sheet).map((l) => l.Layer__Id);
        const carried = new Set(Na__LeOsnap__Exclusions(exclude).filter((item) => item.kind === 'viewport').map((item) => item.id));
        return (sheet.Sheet__Viewports || [])
            .filter((v) => v.Viewport__Kind === Na__LeModel__KIND_2D && !carried.has(v.Viewport__Id) && Na__LeOsnap__Offers(sheet, v.Viewport__LayerId))
            .map((v, i) => ({ v : v, rank : layers.indexOf(v.Viewport__LayerId), i : i }))
            .sort((a, b) => (a.rank - b.rank) || (b.i - a.i))
            .map((entry) => entry.v);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Nearest Snap Point Within the Radius, or Null
    // ------------------------------------------------------------
    // Returns { x, y, kind, target, viewportId, source, sourceId, distanceMm,
    // score }. The sheet's own objects and the viewports are both searched
    // and the better score wins - except where the two are the same place,
    // where the drawing's own point is the one taken (see below).
    // exclude { kind : 'viewport', id } leaves out a viewport that is being
    // carried by one of its own points, whose corners travel with the cursor.
    // options.from is where the line being drawn starts from, which is what
    // a perpendicular is square to.
    // ------------------------------------------------------------
    function Na__LeOsnap__Find(sheet, pointMm, exclude, options) {
        if (!sheet || !pointMm || !Na__LeOsnap__IsEnabled()) return null;
        const modes = Na__LeOsnap__RunningModes();
        if (!modes.end && !modes.mid && !modes.int && !modes.perp && !modes.cen && !modes.near) return null;
        const radiusMm = Na__LeOsnap__RadiusMm();
        const from     = Na__LeOsnap__FromPoints(options);
        const onSheet  = Na__LeOsnap__FindOnSheet(sheet, pointMm, radiusMm, exclude, modes, from);

        const ordered = Na__LeOsnap__OrderedViewports(sheet, exclude);
        let inView = null;                                                       // <-- The frontmost viewport with anything at all within reach
        for (let n = 0; n < ordered.length; n++) {
            const probe = Na__LeOsnap__SearchViewport(ordered[n], pointMm, radiusMm, modes, from);
            if (!inView && (probe.best || probe.near || probe.lines.length)) inView = probe;
            if (probe.best) { inView = probe; break; }                           // <-- The frontmost viewport under the cursor owns the snap
        }

        // A VECTOR CROSSING THE DRAWING | A construction line over a wall
        // line: neither search alone has both lines, so they are tried against
        // each other here, and the crossing is the sheet's.
        // ------------------------------------
        if (inView && onSheet.lines.length && inView.lines.length) Na__LeOsnap__OfferCrossings(onSheet, inView.lines);

        // THE DRAWING OUTRANKS A VECTOR'S COPY OF IT. A vector traced over a plan
        // has its corners on the plan's corners - or a hair off them, which is
        // the very thing the colours are there to show up. Where the sheet's
        // best point and the drawing's are the same place, the DRAWING's is
        // taken: the new point lands on the wall's corner itself, not on
        // something that was once put near it, and the marker is purple. So a
        // BLUE marker over a drawing reliably means "this is the vector's point,
        // and the drawing has none here". Anywhere else the nearer wins.
        // ------------------------------------
        const best = inView ? inView.best : null;
        if (onSheet.best && best && Math.hypot(onSheet.best.x - best.x, onSheet.best.y - best.y) <= Na__LeOsnap__SAME_PLACE_MM) return best;
        if (onSheet.best && (!best || onSheet.best.score <= best.score)) return onSheet.best;
        if (best) return best;

        // NEAREST, LAST | Only when no other mode found a point in reach
        // ------------------------------------
        const near = inView ? inView.near : null;
        if (onSheet.near && (!near || onSheet.near.score <= near.score)) return onSheet.near;
        return near;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Nearest Snap Point on One Viewport's Own Linework, or Null
    // ------------------------------------------------------------
    // Asked by the viewport snap move on hover and on press: the point a
    // viewport is carried by has to be one of ITS OWN corners, never a corner
    // of whatever happens to lie nearby on the sheet. Honours the toggle and
    // the running modes like every other search.
    // ------------------------------------------------------------
    function Na__LeOsnap__FindOnViewport(sheet, viewportId, pointMm) {
        if (!sheet || !pointMm || !Na__LeOsnap__IsEnabled() || !Na__LeOsnap__IsTargetOn(Na__LeOsnap__TARGET_VIEWPORT)) return null;
        const viewport = (sheet.Sheet__Viewports || []).find((v) => v.Viewport__Id === viewportId) || null;
        if (!viewport || viewport.Viewport__Kind !== Na__LeModel__KIND_2D || !Na__LeOsnap__Offers(sheet, viewport.Viewport__LayerId)) return null;
        const probe = Na__LeOsnap__SearchViewport(viewport, pointMm, Na__LeOsnap__RadiusMm(), Na__LeOsnap__RunningModes(), null);
        return probe.best || probe.near;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Drawing Grid's Point Nearest a Point, While Grid Snap Is On (F7), or Null
    // ------------------------------------------------------------
    // Always the NEAREST grid point, at any distance - a grid snap is the
    // point moving in whole steps, not a pick radius - and never while Grid
    // Snap is off. It is never looked for first: every caller asks the
    // object snaps before it (Snap below), so a corner, a midpoint or a title
    // block point inside the snap radius always wins over the grid.
    // ------------------------------------------------------------
    function Na__LeOsnap__FindGrid(pointMm) {
        if (!pointMm || !Na__LeGrid__IsSnapping()) return null;
        const at = Na__LeGrid__Nearest(pointMm);
        const d  = Math.hypot(at.x - pointMm.x, at.y - pointMm.y);
        return { x : at.x, y : at.y, kind : Na__LeOsnap__KIND_GRID, target : Na__LeOsnap__TARGET_GRID, viewportId : null, source : 'grid', sourceId : null, distanceMm : d, score : d };
    }
    // ------------------------------------------------------------


    // FUNCTION | Snap a Cursor Point, Showing or Hiding the Marker
    // ------------------------------------------------------------
    // Returns { x, y, snapped, kind, target }. When nothing is near, the point
    // comes back untouched and the marker goes away.
    //   options.from   where the line being drawn starts from ({ x, y }, or
    //                  several): what Perpendicular is square to.
    //   options.grid   false asks for the object snaps alone: a parametric
    //                  slide keeps its own steps.
    //
    // THE GRID IS THE FALLBACK. With Grid Snap on (F7), a point no object snap
    // reaches lands on the nearest grid point (kind 'grid', snapped true), so
    // every tool and grip that snaps through here - Draw, Rectangle, Floor
    // Area, Dimension, Leader, a vertex, a dimension end, a leader tip - draws
    // on the grid with nothing of its own changed, and a held axis (an arrow
    // key, Shift, Ortho) still takes the grid point's coordinate along it. It
    // works with Object Snap (F3) off, as LayOut's does.
    //
    // The fourth argument used to be the TONE of the tool snapping, with the
    // options fifth. A caller still written that way is answered correctly:
    // a string there is passed over, and the options are read from wherever
    // they are.
    // ------------------------------------------------------------
    function Na__LeOsnap__Snap(sheet, pointMm, exclude, options, legacyOptions) {
        const opts = (options && typeof options === 'object') ? options : ((legacyOptions && typeof legacyOptions === 'object') ? legacyOptions : null);
        const hit = Na__LeOsnap__Find(sheet, pointMm, exclude, opts)
                 || ((opts && opts.grid === false) ? null : Na__LeOsnap__FindGrid(pointMm));
        if (!hit) { Na__LeOsnap__HideMarker(); return { x : pointMm.x, y : pointMm.y, snapped : false, kind : null, target : null }; }
        Na__LeOsnap__ShowMarker(hit);
        return { x : hit.x, y : hit.y, snapped : true, kind : hit.kind, target : hit.target };
    }
    // ------------------------------------------------------------


    // FUNCTION | Drop the Indexes and the Marker (leaving the editor, changing sheet)
    // ------------------------------------------------------------
    function Na__LeOsnap__Clear() {
        Na__LeOsnap__ClearIndexes();
        Na__LeOsnap__HideMarker();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Is a Point on the Drawing
// -----------------------------------------------------------------------------

    // FUNCTION | Whether a Paper Point Sits on a Viewport's Linework: 'point', 'line' or Null
    // ------------------------------------------------------------
    // WHAT THE GRIPS ARE COLOURED BY. A vertex that was snapped to the corner
    // of a wall sits on that corner to the last digit; one placed by eye sits
    // a fraction of a millimetre off it and looks exactly the same. Asked of
    // each vertex of the vector being edited:
    //   'point'  on an end or a middle of the linework, or where two of its
    //            lines cross - a place a snap would have found
    //   'line'   on one of its lines, but at no particular place along it
    //   null     on nothing: the point is free
    // It is a reading of where the point IS, not a memory of how it got there:
    // nothing ties a vertex to the drawing, so a viewport moved afterwards
    // leaves its vertices behind and they go back to blue, which is the truth.
    // It ignores the running modes and the F3 switch - it is a check, not a
    // snap - but not the layers: a hidden or a reference viewport is not there.
    // ------------------------------------------------------------
    function Na__LeOsnap__OnLinework(sheet, pointMm, toleranceMm) {
        if (!sheet || !pointMm || !Number.isFinite(pointMm.x) || !Number.isFinite(pointMm.y)) return null;
        const tol = Number.isFinite(toleranceMm) && toleranceMm > 0 ? toleranceMm : Na__LeOsnap__ON_LINEWORK_MM;
        const px = pointMm.x, py = pointMm.y;
        let onLine = false;
        const viewports = (sheet.Sheet__Viewports || []).filter((v) => v.Viewport__Kind === Na__LeModel__KIND_2D && Na__LeOsnap__Offers(sheet, v.Viewport__LayerId));
        for (let n = 0; n < viewports.length; n++) {
            const frame = viewports[n].Viewport__FrameMm;
            if (px < frame.X - tol || px > frame.X + frame.WidthMm + tol || py < frame.Y - tol || py > frame.Y + frame.HeightMm + tol) continue;
            const entry = Na__LeOsnap__IndexFor(viewports[n].Viewport__Id);
            if (!entry) continue;
            let onPoint = false;
            Na__LeOsnap__EachCell(px - tol, py - tol, px + tol, py + tol, (key) => {
                const bucket = onPoint ? null : entry.points.get(key);
                if (!bucket) return;
                for (let k = 0; k + 2 < bucket.length; k += 3) {
                    if (Math.abs(bucket[k] - px) <= tol && Math.abs(bucket[k + 1] - py) <= tol) { onPoint = true; return; }
                }
            });
            if (onPoint) return 'point';
            const segs = entry.segs, touching = [];
            Na__LeOsnap__SegmentNumbersIn(entry, px - tol, py - tol, px + tol, py + tol).forEach((number) => {
                const i = number * 4;
                if (Na__LeOsnapGeo__Nearest(segs[i], segs[i + 1], segs[i + 2], segs[i + 3], px, py).distance <= tol) touching.push(i);
            });
            if (!touching.length) continue;
            onLine = true;
            for (let a = 0; a < touching.length; a++) {                          // <-- Two of them crossing here is a place, not just a line
                for (let b = a + 1; b < touching.length; b++) {
                    const i = touching[a], j = touching[b];
                    if (Na__LeOsnapGeo__Cross(segs[i], segs[i + 1], segs[i + 2], segs[i + 3], segs[j], segs[j + 1], segs[j + 2], segs[j + 3])) return 'point';
                }
            }
        }
        return onLine ? 'line' : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Line of the Drawings That Touches a Box (flat [ax, ay, bx, by, ...])
    // ------------------------------------------------------------
    // For a tool that works against the linework itself - a trim, an extend.
    // box is { X, Y, WidthMm, HeightMm } in paper millimetres. Shown,
    // pickable 2D viewports only; each line comes back whole (clipped to its
    // frame, not to the box).
    // ------------------------------------------------------------
    function Na__LeOsnap__SegmentsInBox(sheet, box) {
        const out = [];
        if (!sheet || !box) return out;
        const minX = box.X, minY = box.Y, maxX = box.X + box.WidthMm, maxY = box.Y + box.HeightMm;
        (sheet.Sheet__Viewports || []).forEach((viewport) => {
            if (viewport.Viewport__Kind !== Na__LeModel__KIND_2D || !Na__LeOsnap__Offers(sheet, viewport.Viewport__LayerId)) return;
            const frame = viewport.Viewport__FrameMm;
            if (maxX < frame.X || minX > frame.X + frame.WidthMm || maxY < frame.Y || minY > frame.Y + frame.HeightMm) return;
            const entry = Na__LeOsnap__IndexFor(viewport.Viewport__Id);
            if (!entry) return;
            Na__LeOsnap__SegmentNumbersIn(entry, minX, minY, maxX, maxY).forEach((number) => {
                const i = number * 4;
                out.push(entry.segs[i], entry.segs[i + 1], entry.segs[i + 2], entry.segs[i + 3]);
            });
        });
        return out;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Object Snap Search: What a Tool Imports
    // ------------------------------------------------------------
    export {
        Na__LeOsnap__KIND_END,
        Na__LeOsnap__KIND_MID,
        Na__LeOsnap__KIND_INT,
        Na__LeOsnap__KIND_PERP,
        Na__LeOsnap__KIND_CEN,
        Na__LeOsnap__KIND_NEAR,
        Na__LeOsnap__KIND_GRID,
        Na__LeOsnap__KIND_INFER,
        Na__LeOsnap__TARGET_VIEWPORT,
        Na__LeOsnap__TARGET_SHAPE,
        Na__LeOsnap__TARGET_TEXT,
        Na__LeOsnap__TARGET_DIMENSION,
        Na__LeOsnap__TARGET_PAPER,
        Na__LeOsnap__TARGET_GRID,
        Na__LeOsnap__IsEnabled,
        Na__LeOsnap__RadiusMm,
        Na__LeOsnap__Find,
        Na__LeOsnap__FindOnViewport,
        Na__LeOsnap__FindGrid,
        Na__LeOsnap__ChromePoints,
        Na__LeOsnap__Snap,
        Na__LeOsnap__Clear,
        Na__LeOsnap__OnLinework,
        Na__LeOsnap__SegmentsInBox,
        Na__LeOsnap__ShowMarker,
        Na__LeOsnap__HideMarker
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
