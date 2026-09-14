// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SNAPPING
// =============================================================================
//
// FILE       : Na__LayoutEditor__Snapping__.js
// NAMESPACE  : Na__LeOsnap
// MODULE     : Layout Editor - Snapping
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Object snaps on the projected linework: endpoints and midpoints, with a marker and a toggle
// CREATED    : 10-Sep-2026
//
// DESCRIPTION:
// - The projected linework inside a 2D viewport is a true vector drawing,
//   so a dimension can land exactly on a corner or the middle of an edge
//   the way it does in AutoCAD. Every painted segment contributes its two
//   endpoints and its midpoint, converted through the viewport window to
//   paper millimetres and stored in a grid hash per viewport, so a search
//   around the cursor only reads a handful of cells.
// - The nearest point inside the snap radius wins; an endpoint beats a
//   midpoint at a near tie. A square marks an endpoint and a triangle a
//   midpoint, counter-scaled so they keep their size at any zoom.
// - The index rebuilds itself when the viewport's linework, pan, crop or
//   scale changes, keyed on what the viewport module reports; nothing has
//   to remember to invalidate it.
// - Snapping is on by default and toggled from the toolbar or F3; the
//   choice is remembered in the browser.
// - THE MARKER'S COLOUR SAYS WHICH TOOL IS SNAPPING, its glyph what was
//   found. Blue for vertices - the Draw and Rectangle tools, vertex grips
//   and a vector being moved; orange for dimensions - the Dimension tool, its
//   grips and its line inference; purple for viewports - carrying one by a
//   point. Callers pass the tone; with none it is blue.
//
// INTEGRATION:
// - The sheet tools call Snap while placing or dragging dimension endpoints;
//   the toolbar shows the toggle; Viewport2d supplies the snap sources.
// - Na__LayoutEditor__ViewportSnapMove__ calls FindOnViewport for the point a
//   viewport is carried by, and Find with a viewport exclusion while carrying.
// - The tone colours live in Na__LayoutEditor__Styles__Main__.css.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__Snapping__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
// - Ahead         : 1.3.0 (marker tones) was authored here first, 13-Sep-2026;
//                   the ValeVision back-port waits for Adam's sign-off
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 13-Sep-2026 - Version 1.3.0
// - Marker tones: Snap and ShowMarker take the tool that is snapping
//   (TONE_VERTEX, TONE_DIMENSION, TONE_VIEWPORT) and add it to the marker's
//   class, so the snap colour tells the tools apart. Left out, it is vertex.
//
// 13-Sep-2026 - Version 1.2.0
// - FindOnViewport: the nearest point on one viewport's own linework, for the
//   viewport snap move to carry it by. Find takes { kind : 'viewport', id } as
//   an exclusion so a carried viewport never snaps to itself. The per-viewport
//   grid search is one helper, SearchViewport, shared by both.
//
// 13-Sep-2026 - Version 1.1.0
// - The sheet's own vectors (every vertex and edge midpoint) and dimensions (both
//   measured points) are snap candidates alongside the viewport linework,
//   switchable with SheetObjects. A linear scan of the live records, so a vertex
//   placed a moment ago is a candidate at once. Find and Snap take an exclusion
//   so a dragged vertex or grip never snaps to itself.
//
// 10-Sep-2026 - Version 1.0.0
// - Initial implementation: endpoint and midpoint snaps, marker, toggle.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Surface and the 2D Viewport Sources
    // ------------------------------------------------------------
    import { Na__LeCfg__GetSnappingSetup } from './Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__KIND_2D, Na__LeModel__GetLayers, Na__LeModel__IsLayerVisible } from './Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__GetElements, Na__LeSurface__GetPixelsPerMm, Na__LeSurface__GetZoom } from './Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeVp2d__GetSnapSource } from './Na__LayoutEditor__Viewport2d__.js';
    import { Na__LeShapeGeo__Points } from './Na__LayoutEditor__ShapeGeometry__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Kinds, Event, Storage and Grid
    // ------------------------------------------------------------
    const Na__LeOsnap__KIND_END      = 'end';
    const Na__LeOsnap__KIND_MID      = 'mid';
    const Na__LeOsnap__CHANGED_EVENT = 'na-layouteditor-snap-changed';
    const Na__LeOsnap__STORE_KEY     = 'na-layouteditor-osnap';
    const Na__LeOsnap__CELL_MM       = 4;                                    // <-- Grid cell in paper millimetres
    const Na__LeOsnap__MID_PENALTY   = 1.25;                                 // <-- An endpoint wins a near tie
    const Na__LeOsnap__CLASSES       = [ 'visible', 'section', 'authored' ];
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Marker Tones: the Colour Says Which Tool Is Snapping
    // ------------------------------------------------------------
    const Na__LeOsnap__TONE_VERTEX    = 'vertex';                            // <-- Blue: the Draw and Rectangle tools and vertex grips (the default)
    const Na__LeOsnap__TONE_DIMENSION = 'dimension';                         // <-- Orange: the Dimension tool, its grips and its line inference
    const Na__LeOsnap__TONE_VIEWPORT  = 'viewport';                          // <-- Purple: a viewport carried by a point
    const Na__LeOsnap__TONES          = [ Na__LeOsnap__TONE_VERTEX, Na__LeOsnap__TONE_DIMENSION, Na__LeOsnap__TONE_VIEWPORT ];
    // ------------------------------------------------------------

    // MODULE VARIABLES | Per-Viewport Indexes, Marker, State
    // ------------------------------------------------------------
    const Na__LeOsnap__Indexes = new Map();   // <-- viewportId -> { key, grid : Map<cellKey, number[]> }
    let   Na__LeOsnap__Enabled = null;
    let   Na__LeOsnap__Marker  = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Enabled State
// -----------------------------------------------------------------------------

    // FUNCTION | Is Snapping On (remembered per browser, default from config)
    // ------------------------------------------------------------
    function Na__LeOsnap__IsEnabled() {
        if (Na__LeOsnap__Enabled === null) {
            let stored = null;
            try { stored = window.localStorage.getItem(Na__LeOsnap__STORE_KEY); } catch (e) { stored = null; }
            Na__LeOsnap__Enabled = stored === null ? Na__LeCfg__GetSnappingSetup().enabled : stored === '1';
        }
        return Na__LeOsnap__Enabled;
    }
    function Na__LeOsnap__SetEnabled(flag) {
        Na__LeOsnap__Enabled = flag === true;
        try { window.localStorage.setItem(Na__LeOsnap__STORE_KEY, Na__LeOsnap__Enabled ? '1' : '0'); } catch (e) { /* storage unavailable */ }
        if (!Na__LeOsnap__Enabled) Na__LeOsnap__HideMarker();
        window.dispatchEvent(new CustomEvent(Na__LeOsnap__CHANGED_EVENT, { detail : { enabled : Na__LeOsnap__Enabled } }));
        return Na__LeOsnap__Enabled;
    }
    function Na__LeOsnap__Toggle() { return Na__LeOsnap__SetEnabled(!Na__LeOsnap__IsEnabled()); }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Index
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Grid Cell Key for a Paper Point
    // ------------------------------------------------------------
    function Na__LeOsnap__Cell(x, y) {
        return Math.floor(x / Na__LeOsnap__CELL_MM) + ':' + Math.floor(y / Na__LeOsnap__CELL_MM);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Grid for One Viewport From Its Painted Segments
    // ------------------------------------------------------------
    // Segments arrive in drawing millimetres; the window turns them into
    // absolute paper millimetres. Points outside the frame are dropped, and
    // endpoints shared by several segments are stored once.
    // ------------------------------------------------------------
    function Na__LeOsnap__Build(source) {
        const setup  = Na__LeCfg__GetSnappingSetup();
        const grid   = new Map();
        const seen   = new Set();
        const frame  = source.window.Frame;
        const margin = 0.5;
        const minX = frame.X - margin, maxX = frame.X + frame.WidthMm + margin;
        const minY = frame.Y - margin, maxY = frame.Y + frame.HeightMm + margin;
        const push = (x, y, kind) => {
            if (x < minX || x > maxX || y < minY || y > maxY) return;
            const id = kind + Math.round(x * 100) + ':' + Math.round(y * 100);
            if (seen.has(id)) return;
            seen.add(id);
            const cell = Na__LeOsnap__Cell(x, y);
            let bucket = grid.get(cell);
            if (!bucket) { bucket = []; grid.set(cell, bucket); }
            bucket.push(x, y, kind === Na__LeOsnap__KIND_END ? 0 : 1);
        };
        const classes = Na__LeOsnap__CLASSES.concat(setup.hiddenLines ? [ 'hidden' ] : []);
        classes.forEach((name) => {
            const segments = source.classes ? source.classes[name] : null;
            if (!segments || segments.length < 4) return;
            for (let i = 0; i + 3 < segments.length; i += 4) {
                const a = source.window.ToPaper(segments[i], segments[i + 1]);
                const b = source.window.ToPaper(segments[i + 2], segments[i + 3]);
                if (setup.endpoints) { push(a.x, a.y, Na__LeOsnap__KIND_END); push(b.x, b.y, Na__LeOsnap__KIND_END); }
                if (setup.midpoints) push((a.x + b.x) / 2, (a.y + b.y) / 2, Na__LeOsnap__KIND_MID);
            }
        });
        return grid;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Index for a Viewport, Rebuilt When Its Source Key Moves On
    // ------------------------------------------------------------
    function Na__LeOsnap__IndexFor(viewportId) {
        const source = Na__LeVp2d__GetSnapSource(viewportId);
        if (!source) { Na__LeOsnap__Indexes.delete(viewportId); return null; }
        let entry = Na__LeOsnap__Indexes.get(viewportId);
        if (!entry || entry.key !== source.key) {
            entry = { key : source.key, grid : Na__LeOsnap__Build(source) };
            Na__LeOsnap__Indexes.set(viewportId, entry);
        }
        return entry;
    }
    // ------------------------------------------------------------


    // FUNCTION | Drop the Indexes (leaving the editor, changing sheet)
    // ------------------------------------------------------------
    function Na__LeOsnap__Clear() {
        Na__LeOsnap__Indexes.clear();
        Na__LeOsnap__HideMarker();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Search
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Nearest Snap Point on the Sheet's Own Vectors and Dimensions
    // ------------------------------------------------------------
    // UNTIL THIS EXISTED A VECTOR COULD NOT SNAP TO ANOTHER VECTOR, or to its
    // own corners. The only candidates were the projected linework inside 2D
    // viewports, so a line drawn on open paper - a key plan outline, a detail
    // border, a site boundary - had nothing to hold on to, and closing a
    // polygon or starting a second line on the end of the first came down to
    // a steady hand.
    //
    // A LINEAR SCAN, NOT AN INDEX, and deliberately. A sheet carries tens to a
    // few hundred vertices, which is microseconds to walk per pointer move.
    // An index would have to be invalidated by every change - including the
    // SILENT ones the draw tool makes as each vertex lands and a drag makes on
    // every move - and a stale index is exactly the bug that makes a snap feel
    // haunted. Walking the live records means the corner placed a moment ago
    // is a candidate the moment it exists.
    //
    // exclude: { kind : 'shape'|'dimension', id, index } rules out what is
    // being moved. For a shape, index is the vertex in motion: it and the
    // midpoints of the two edges it drags along are skipped, otherwise the
    // point would snap to itself and chase the cursor. For a dimension, index
    // is 'start' or 'end'. With no index the whole item is skipped.
    // ------------------------------------------------------------
    function Na__LeOsnap__FindOnSheet(sheet, pointMm, radiusMm, exclude) {
        const setup = Na__LeCfg__GetSnappingSetup();
        if (!setup.sheetObjects || (!setup.endpoints && !setup.midpoints)) return null;

        const px = pointMm.x, py = pointMm.y;
        let best = null;


        // Offer one candidate: a cheap box test before the square root
        // ------------------------------------
        const offer = (x, y, kind, sourceKind, sourceId) => {
            const dx = x - px, dy = y - py;
            if (dx > radiusMm || dx < -radiusMm || dy > radiusMm || dy < -radiusMm) return;
            const d = Math.hypot(dx, dy);
            if (d > radiusMm) return;
            const score = d * (kind === Na__LeOsnap__KIND_MID ? Na__LeOsnap__MID_PENALTY : 1);
            if (!best || score < best.score) {
                best = { x : x, y : y, kind : kind, viewportId : null, source : sourceKind, sourceId : sourceId, distanceMm : d, score : score };
            }
        };


        // VECTORS | Every vertex, and the midpoint of every edge
        // ------------------------------------
        const skipShape = (exclude && exclude.kind === 'shape') ? exclude : null;
        const shapes    = sheet.Sheet__Shapes || [];
        for (let s = 0; s < shapes.length; s++) {
            const shape = shapes[s];
            if (!Na__LeModel__IsLayerVisible(sheet, shape.Shape__LayerId)) continue;        // <-- A hidden layer offers nothing; a LOCKED one still does
            const own = !!skipShape && skipShape.id === shape.Shape__Id;
            if (own && !Number.isInteger(skipShape.index)) continue;
            const moving = own ? skipShape.index : -1;
            const pts    = Na__LeShapeGeo__Points(shape);
            const n      = pts.length;
            if (setup.endpoints) {
                for (let i = 0; i < n; i++) {
                    if (i !== moving) offer(pts[i][0], pts[i][1], Na__LeOsnap__KIND_END, 'shape', shape.Shape__Id);
                }
            }
            if (setup.midpoints && n > 1) {
                const edges = (shape.Shape__Closed === true && n > 2) ? n : n - 1;
                for (let i = 0; i < edges; i++) {
                    const j = (i + 1) % n;
                    if (i === moving || j === moving) continue;                              // <-- That edge is being dragged; its middle moves with the cursor
                    offer((pts[i][0] + pts[j][0]) / 2, (pts[i][1] + pts[j][1]) / 2, Na__LeOsnap__KIND_MID, 'shape', shape.Shape__Id);
                }
            }
        }


        // DIMENSIONS | The two points each one measures, so dimensions chain
        // ------------------------------------
        if (setup.endpoints) {
            const skipDim = (exclude && exclude.kind === 'dimension') ? exclude : null;
            const dims    = sheet.Sheet__Dimensions || [];
            for (let k = 0; k < dims.length; k++) {
                const dim = dims[k];
                if (!Na__LeModel__IsLayerVisible(sheet, dim.Dimension__LayerId)) continue;
                const own = !!skipDim && skipDim.id === dim.Dimension__Id;
                if (own && !skipDim.index) continue;
                if (!(own && skipDim.index === 'start')) offer(dim.Dimension__StartXMm, dim.Dimension__StartYMm, Na__LeOsnap__KIND_END, 'dimension', dim.Dimension__Id);
                if (!(own && skipDim.index === 'end'))   offer(dim.Dimension__EndXMm,   dim.Dimension__EndYMm,   Na__LeOsnap__KIND_END, 'dimension', dim.Dimension__Id);
            }
        }
        return best;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Nearest Linework Snap Point on One Viewport, or the Best So Far
    // ------------------------------------------------------------
    // Reads only the grid cells the radius touches. Hands best back untouched
    // when the cursor is nowhere near the frame, when the viewport has no
    // linework painted yet, or when nothing on it is closer.
    // ------------------------------------------------------------
    function Na__LeOsnap__SearchViewport(viewport, pointMm, radiusMm, best) {
        const frame = viewport.Viewport__FrameMm;
        if (pointMm.x < frame.X - radiusMm || pointMm.x > frame.X + frame.WidthMm + radiusMm ||
            pointMm.y < frame.Y - radiusMm || pointMm.y > frame.Y + frame.HeightMm + radiusMm) return best;
        const entry = Na__LeOsnap__IndexFor(viewport.Viewport__Id);
        if (!entry) return best;
        const c0 = Math.floor((pointMm.x - radiusMm) / Na__LeOsnap__CELL_MM), c1 = Math.floor((pointMm.x + radiusMm) / Na__LeOsnap__CELL_MM);
        const r0 = Math.floor((pointMm.y - radiusMm) / Na__LeOsnap__CELL_MM), r1 = Math.floor((pointMm.y + radiusMm) / Na__LeOsnap__CELL_MM);
        for (let cx = c0; cx <= c1; cx++) {
            for (let cy = r0; cy <= r1; cy++) {
                const bucket = entry.grid.get(cx + ':' + cy);
                if (!bucket) continue;
                for (let k = 0; k + 2 < bucket.length; k += 3) {
                    const d = Math.hypot(bucket[k] - pointMm.x, bucket[k + 1] - pointMm.y);
                    if (d > radiusMm) continue;
                    const score = d * (bucket[k + 2] === 1 ? Na__LeOsnap__MID_PENALTY : 1);
                    if (!best || score < best.score) {
                        best = { x : bucket[k], y : bucket[k + 1], kind : bucket[k + 2] === 1 ? Na__LeOsnap__KIND_MID : Na__LeOsnap__KIND_END, viewportId : viewport.Viewport__Id, distanceMm : d, score : score };
                    }
                }
            }
        }
        return best;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Nearest Snap Point Within the Radius, or Null
    // ------------------------------------------------------------
    // Returns { x, y, kind, viewportId, source, distanceMm }. Both sources are
    // searched and the better score wins; on a tie the sheet's own markup is
    // taken, because it is drawn over the viewports and is what the eye is on.
    // exclude { kind : 'viewport', id } leaves out a viewport that is being
    // carried by one of its own points, whose corners travel with the cursor.
    // ------------------------------------------------------------
    function Na__LeOsnap__Find(sheet, pointMm, exclude) {
        if (!sheet || !pointMm || !Na__LeOsnap__IsEnabled()) return null;
        const setup    = Na__LeCfg__GetSnappingSetup();
        const radiusMm = setup.radiusPx / (Na__LeSurface__GetPixelsPerMm() * Na__LeSurface__GetZoom());
        const onSheet  = Na__LeOsnap__FindOnSheet(sheet, pointMm, radiusMm, exclude);
        const layers   = Na__LeModel__GetLayers(sheet).map((l) => l.Layer__Id);
        const carried  = (exclude && exclude.kind === 'viewport') ? exclude.id : null;
        const ordered  = sheet.Sheet__Viewports
            .filter((v) => v.Viewport__Kind === Na__LeModel__KIND_2D && v.Viewport__Id !== carried && Na__LeModel__IsLayerVisible(sheet, v.Viewport__LayerId))
            .map((v, i) => ({ v : v, rank : layers.indexOf(v.Viewport__LayerId), i : i }))
            .sort((a, b) => (a.rank - b.rank) || (b.i - a.i));
        let best = null;
        for (let n = 0; n < ordered.length; n++) {
            best = Na__LeOsnap__SearchViewport(ordered[n].v, pointMm, radiusMm, best);
            if (best) break;                                                     // <-- The frontmost viewport under the cursor owns the snap
        }
        if (onSheet && (!best || onSheet.score <= best.score)) return onSheet;
        return best;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Nearest Snap Point on One Viewport's Own Linework, or Null
    // ------------------------------------------------------------
    // Asked by the viewport snap move on hover and on press: the point a
    // viewport is carried by has to be one of ITS OWN corners, never a corner
    // of whatever happens to lie nearby on the sheet. Honours the toggle and
    // the endpoint and midpoint switches like every other search.
    // ------------------------------------------------------------
    function Na__LeOsnap__FindOnViewport(sheet, viewportId, pointMm) {
        if (!sheet || !pointMm || !Na__LeOsnap__IsEnabled()) return null;
        const viewport = sheet.Sheet__Viewports.find((v) => v.Viewport__Id === viewportId) || null;
        if (!viewport || viewport.Viewport__Kind !== Na__LeModel__KIND_2D || !Na__LeModel__IsLayerVisible(sheet, viewport.Viewport__LayerId)) return null;
        const radiusMm = Na__LeCfg__GetSnappingSetup().radiusPx / (Na__LeSurface__GetPixelsPerMm() * Na__LeSurface__GetZoom());
        return Na__LeOsnap__SearchViewport(viewport, pointMm, radiusMm, null);
    }
    // ------------------------------------------------------------


    // FUNCTION | Snap a Cursor Point, Showing or Hiding the Marker
    // ------------------------------------------------------------
    // Returns { x, y, snapped, kind }. When nothing is near, the point comes
    // back untouched and the marker goes away. tone is the tool snapping -
    // TONE_DIMENSION, TONE_VIEWPORT, or TONE_VERTEX when left out - and only
    // colours the marker.
    // ------------------------------------------------------------
    function Na__LeOsnap__Snap(sheet, pointMm, exclude, tone) {
        const hit = Na__LeOsnap__Find(sheet, pointMm, exclude);
        if (!hit) { Na__LeOsnap__HideMarker(); return { x : pointMm.x, y : pointMm.y, snapped : false, kind : null }; }
        Na__LeOsnap__ShowMarker(hit, tone);
        return { x : hit.x, y : hit.y, snapped : true, kind : hit.kind };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Marker
// -----------------------------------------------------------------------------

    // FUNCTION | Show the Snap Marker at a Hit, in the Tone of the Tool Snapping
    // ------------------------------------------------------------
    // The glyph says what was found (a square endpoint, a triangle midpoint,
    // a circle for an inferred line); the tone says who is looking - blue for
    // vertices, orange for dimensions, purple for viewports - so the colour
    // alone tells which tool is at work. A missing or unknown tone is vertex.
    // ------------------------------------------------------------
    function Na__LeOsnap__ShowMarker(hit, tone) {
        const layer = Na__LeSurface__GetElements().handles;
        if (!layer || !hit) return;
        if (!Na__LeOsnap__Marker) {
            Na__LeOsnap__Marker = document.createElement('div');
            Na__LeOsnap__Marker.className = 'na-le-osnap';
        }
        if (Na__LeOsnap__Marker.parentNode !== layer) layer.appendChild(Na__LeOsnap__Marker);
        const setup  = Na__LeCfg__GetSnappingSetup();
        const ppm    = Na__LeSurface__GetPixelsPerMm();
        const sizePx = setup.markerSizePx / Na__LeSurface__GetZoom();
        const shade  = Na__LeOsnap__TONES.indexOf(tone) === -1 ? Na__LeOsnap__TONE_VERTEX : tone;
        Na__LeOsnap__Marker.className = 'na-le-osnap na-le-osnap--' + hit.kind + ' na-le-osnap--' + shade;
        Na__LeOsnap__Marker.style.left   = ((hit.x * ppm) - (sizePx / 2)) + 'px';
        Na__LeOsnap__Marker.style.top    = ((hit.y * ppm) - (sizePx / 2)) + 'px';
        Na__LeOsnap__Marker.style.width  = sizePx + 'px';
        Na__LeOsnap__Marker.style.height = sizePx + 'px';
        Na__LeOsnap__Marker.style.borderWidth = Math.max(1.5, 2.5 / Na__LeSurface__GetZoom()) + 'px';
        Na__LeOsnap__Marker.hidden = false;
    }
    // ------------------------------------------------------------


    // FUNCTION | Hide the Marker
    // ------------------------------------------------------------
    function Na__LeOsnap__HideMarker() {
        if (Na__LeOsnap__Marker) Na__LeOsnap__Marker.hidden = true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Snapping API
    // ------------------------------------------------------------
    export {
        Na__LeOsnap__KIND_END,
        Na__LeOsnap__KIND_MID,
        Na__LeOsnap__TONE_VERTEX,
        Na__LeOsnap__TONE_DIMENSION,
        Na__LeOsnap__TONE_VIEWPORT,
        Na__LeOsnap__CHANGED_EVENT,
        Na__LeOsnap__IsEnabled,
        Na__LeOsnap__SetEnabled,
        Na__LeOsnap__Toggle,
        Na__LeOsnap__Clear,
        Na__LeOsnap__Find,
        Na__LeOsnap__FindOnViewport,
        Na__LeOsnap__Snap,
        Na__LeOsnap__ShowMarker,
        Na__LeOsnap__HideMarker
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
