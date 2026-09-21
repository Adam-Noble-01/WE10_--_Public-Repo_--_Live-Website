// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - OBJECT SNAP - LINEWORK INDEX
// =============================================================================
//
// FILE       : Na__LayoutEditor__ObjectSnap__Index__.js
// NAMESPACE  : Na__LeOsnap
// MODULE     : Layout Editor - Object Snap - Linework Index
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Every point and every line of a 2D viewport's projected linework, filed on a grid so a search round the cursor reads a handful of squares
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - The projected linework inside a 2D viewport is a true vector drawing, so
//   a vertex can land exactly on a corner of it the way it does in AutoCAD.
//   An elevation is tens of thousands of segments, and the snap is asked on
//   every pointer move, so nothing here is searched end to end: each viewport
//   gets a grid of 4 mm squares in paper millimetres, and a search reads only
//   the squares its radius touches.
// - TWO THINGS ARE FILED, because the snap modes ask two kinds of question.
//     * POINTS: each segment's two ENDS and its MIDDLE, stored once however
//       many segments share them. Endpoint and Midpoint read these.
//     * SEGMENTS: the lines themselves, each filed under every square it
//       passes through (Na__LeOsnapGeo__CellsOfSegment). Perpendicular,
//       Intersection and Nearest are questions about a LINE, which no list of
//       points can answer.
//   Both are always built, whichever modes are running: a mode switched in
//   the menu then takes effect on the next pointer move without an index
//   being thrown away and built again.
// - WHAT THE FRAME CUTS OFF IS NOT THERE. A point outside the frame is
//   dropped, and a segment is clipped to the frame before it is filed, so a
//   perpendicular or a crossing can never land on a line the frame hides.
// - THE INDEX REBUILDS ITSELF when the viewport's linework, pan, crop or scale
//   changes, keyed on what the viewport module reports; nothing has to
//   remember to invalidate it.
//
// INTEGRATION:
// - Na__LayoutEditor__ObjectSnap__Search__ asks IndexFor and reads the squares.
// - Na__LayoutEditor__Viewport2d__ supplies the painted segments and the
//   window that places them on the paper (GetSnapSource).
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026). Build and IndexFor came
//                   across from 30__System__SheetTools/Na__LayoutEditor__Snapping__.js
//                   1.5.0, which filed points only.
// - ValeVision    : not yet ported - it waits for Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.1.0
// - A turned viewport's linework (Viewport__RotationDeg) is clipped to the
//   frame in the level frame and turned onto the paper before it is filed, so
//   every snap on a turned drawing lands on the line as it is painted.
//
// 21-Sep-2026 - Version 1.0.0
// - Moved here from the Snapping module, and the segments filed beside the
//   points. Both kinds of point are always filed: the running modes filter
//   them as they are read.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, the 2D Viewport Sources and the Geometry
    // ------------------------------------------------------------
    import { Na__LeCfg__GetSnappingSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeVp2d__GetSnapSource } from '../20__System__Viewports/Na__LayoutEditor__Viewport2d__.js';
    import { Na__LeOsnapGeo__CellsOfSegment } from './Na__LayoutEditor__ObjectSnap__Geometry__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Grid and the Linework Classes It Files
    // ------------------------------------------------------------
    const Na__LeOsnap__CELL_MM       = 4;                                    // <-- One square of the grid, in paper millimetres
    const Na__LeOsnap__FRAME_PAD_MM  = 0.5;                                  // <-- A point this far outside the frame still counts as on its edge
    const Na__LeOsnap__POINT_END     = 0;                                    // <-- How a filed point says what it is: an end...
    const Na__LeOsnap__POINT_MID     = 1;                                    // <-- ...or the middle of a segment
    const Na__LeOsnap__CLASSES       = [ 'visible', 'section', 'authored' ]; // <-- Hidden lines join them when Snapping HiddenLines is on
    // ------------------------------------------------------------

    // MODULE VARIABLES | One Index per Viewport
    // ------------------------------------------------------------
    // viewportId -> { key, points : Map<cellKey, number[]>, segs : number[], cells : Map<cellKey, number[]> }
    //   points  flat [x, y, kind, ...] per square       (kind: POINT_END or POINT_MID)
    //   segs    flat [ax, ay, bx, by, ...], every segment once, clipped to the frame
    //   cells   the numbers of the segments passing through each square
    // ------------------------------------------------------------
    const Na__LeOsnap__Indexes = new Map();
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Building
// -----------------------------------------------------------------------------

    // FUNCTION | The Key of the Square Holding a Paper Point
    // ------------------------------------------------------------
    function Na__LeOsnap__CellKey(column, row) { return column + ':' + row; }
    function Na__LeOsnap__CellOf(x, y) {
        return Na__LeOsnap__CellKey(Math.floor(x / Na__LeOsnap__CELL_MM), Math.floor(y / Na__LeOsnap__CELL_MM));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Segment Cut to a Rectangle, or Null When None of It Is Inside
    // ------------------------------------------------------------
    // Liang-Barsky: the run of the segment's own parameter that lies inside
    // all four edges. Returns [ax, ay, bx, by].
    // ------------------------------------------------------------
    function Na__LeOsnap__ClipToRect(ax, ay, bx, by, minX, minY, maxX, maxY) {
        const dx = bx - ax, dy = by - ay;
        let t0 = 0, t1 = 1;
        const edges = [ [ -dx, ax - minX ], [ dx, maxX - ax ], [ -dy, ay - minY ], [ dy, maxY - ay ] ];
        for (let i = 0; i < 4; i++) {
            const p = edges[i][0], q = edges[i][1];
            if (p === 0) { if (q < 0) return null; continue; }               // <-- Parallel to this edge, and outside it
            const r = q / p;
            if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
            else       { if (r < t0) return null; if (r < t1) t1 = r; }
        }
        return [ ax + (dx * t0), ay + (dy * t0), ax + (dx * t1), ay + (dy * t1) ];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Index for One Viewport From Its Painted Segments
    // ------------------------------------------------------------
    // Segments arrive in drawing millimetres; the window turns them into
    // absolute paper millimetres. Points outside the frame are dropped, a
    // point shared by several segments is stored once, and each segment is
    // clipped to the frame and filed under every square it passes through.
    //
    // A TURNED VIEWPORT (Viewport__RotationDeg) is clipped where the frame is
    // a rectangle - in the level frame (ToFrame) - and only what survives is
    // turned onto the paper (FrameToPaper), so its points and lines are filed
    // where the turned drawing is actually painted. A level one comes out
    // exactly as before: both steps are the identity then.
    // ------------------------------------------------------------
    function Na__LeOsnap__Build(source) {
        const setup  = Na__LeCfg__GetSnappingSetup();
        const points = new Map(), cells = new Map(), segs = [];
        const seen   = new Set();
        const frame  = source.window.Frame;
        const level  = source.window.ToFrame      || source.window.ToPaper;       // <-- The level frame, where the clip is a rectangle
        const onto   = source.window.FrameToPaper || ((x, y) => ({ x : x, y : y }));
        const pad    = Na__LeOsnap__FRAME_PAD_MM;
        const minX = frame.X - pad, maxX = frame.X + frame.WidthMm + pad;
        const minY = frame.Y - pad, maxY = frame.Y + frame.HeightMm + pad;

        const pushPoint = (lx, ly, kind) => {
            if (lx < minX || lx > maxX || ly < minY || ly > maxY) return;
            const at = onto(lx, ly), x = at.x, y = at.y;
            const id = kind + ':' + Math.round(x * 100) + ':' + Math.round(y * 100);
            if (seen.has(id)) return;
            seen.add(id);
            const key = Na__LeOsnap__CellOf(x, y);
            let bucket = points.get(key);
            if (!bucket) { bucket = []; points.set(key, bucket); }
            bucket.push(x, y, kind);
        };
        const pushSegment = (ax, ay, bx, by) => {
            const clip = Na__LeOsnap__ClipToRect(ax, ay, bx, by, minX, minY, maxX, maxY);
            if (!clip || Math.hypot(clip[2] - clip[0], clip[3] - clip[1]) < 1e-6) return;   // <-- Hidden by the frame, or clipped to nothing
            const p = onto(clip[0], clip[1]), q = onto(clip[2], clip[3]);
            const cut = [ p.x, p.y, q.x, q.y ];
            const number = segs.length / 4;
            segs.push(cut[0], cut[1], cut[2], cut[3]);
            Na__LeOsnapGeo__CellsOfSegment(cut[0], cut[1], cut[2], cut[3], Na__LeOsnap__CELL_MM, (column, row) => {
                const key = Na__LeOsnap__CellKey(column, row);
                let bucket = cells.get(key);
                if (!bucket) { bucket = []; cells.set(key, bucket); }
                bucket.push(number);
            });
        };

        const classes = Na__LeOsnap__CLASSES.concat(setup.hiddenLines ? [ 'hidden' ] : []);
        classes.forEach((name) => {
            const segments = source.classes ? source.classes[name] : null;
            if (!segments || segments.length < 4) return;
            for (let i = 0; i + 3 < segments.length; i += 4) {
                const a = level(segments[i], segments[i + 1]);
                const b = level(segments[i + 2], segments[i + 3]);
                pushPoint(a.x, a.y, Na__LeOsnap__POINT_END);
                pushPoint(b.x, b.y, Na__LeOsnap__POINT_END);
                pushPoint((a.x + b.x) / 2, (a.y + b.y) / 2, Na__LeOsnap__POINT_MID);
                pushSegment(a.x, a.y, b.x, b.y);
            }
        });
        return { points : points, segs : segs, cells : cells };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Index for a Viewport, Rebuilt When Its Source Key Moves On
    // ------------------------------------------------------------
    // Null for a viewport with no linework painted yet - a raster-only one, a
    // 3D one, or one still rendering.
    // ------------------------------------------------------------
    function Na__LeOsnap__IndexFor(viewportId) {
        const source = Na__LeVp2d__GetSnapSource(viewportId);
        if (!source) { Na__LeOsnap__Indexes.delete(viewportId); return null; }
        const key = source.key + '|' + (Na__LeCfg__GetSnappingSetup().hiddenLines ? 'h' : 'v');
        let entry = Na__LeOsnap__Indexes.get(viewportId);
        if (!entry || entry.key !== key) {
            entry = Na__LeOsnap__Build(source);
            entry.key = key;
            Na__LeOsnap__Indexes.set(viewportId, entry);
        }
        return entry;
    }
    // ------------------------------------------------------------


    // FUNCTION | Drop Every Index (leaving the editor, changing sheet)
    // ------------------------------------------------------------
    function Na__LeOsnap__ClearIndexes() {
        Na__LeOsnap__Indexes.clear();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading
// -----------------------------------------------------------------------------

    // FUNCTION | Visit Every Square a Box Touches (whole squares, no repeats)
    // ------------------------------------------------------------
    // visit(cellKey). The box is { minX, minY, maxX, maxY } in paper mm.
    // ------------------------------------------------------------
    function Na__LeOsnap__EachCell(minX, minY, maxX, maxY, visit) {
        const c0 = Math.floor(minX / Na__LeOsnap__CELL_MM), c1 = Math.floor(maxX / Na__LeOsnap__CELL_MM);
        const r0 = Math.floor(minY / Na__LeOsnap__CELL_MM), r1 = Math.floor(maxY / Na__LeOsnap__CELL_MM);
        for (let column = c0; column <= c1; column++) {
            for (let row = r0; row <= r1; row++) visit(Na__LeOsnap__CellKey(column, row));
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | The Numbers of the Segments Filed Under the Squares a Box Touches (each once)
    // ------------------------------------------------------------
    // A long line is filed under many squares, so a box over two of them would
    // otherwise be handed the same line twice.
    // ------------------------------------------------------------
    function Na__LeOsnap__SegmentNumbersIn(entry, minX, minY, maxX, maxY) {
        const out = [], seen = new Set();
        if (!entry) return out;
        Na__LeOsnap__EachCell(minX, minY, maxX, maxY, (key) => {
            const bucket = entry.cells.get(key);
            if (!bucket) return;
            for (let k = 0; k < bucket.length; k++) {
                if (seen.has(bucket[k])) continue;
                seen.add(bucket[k]);
                out.push(bucket[k]);
            }
        });
        return out;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Object Snap Linework Index
    // ------------------------------------------------------------
    export {
        Na__LeOsnap__CELL_MM,
        Na__LeOsnap__POINT_END,
        Na__LeOsnap__POINT_MID,
        Na__LeOsnap__IndexFor,
        Na__LeOsnap__ClearIndexes,
        Na__LeOsnap__EachCell,
        Na__LeOsnap__SegmentNumbersIn
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
