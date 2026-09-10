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
//
// INTEGRATION:
// - The sheet tools call Snap while placing or dragging dimension endpoints;
//   the toolbar shows the toggle; Viewport2d supplies the snap sources.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__Snapping__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
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

    // FUNCTION | The Nearest Snap Point Within the Radius, or Null
    // ------------------------------------------------------------
    // Returns { x, y, kind, viewportId, distanceMm }.
    // ------------------------------------------------------------
    function Na__LeOsnap__Find(sheet, pointMm) {
        if (!sheet || !pointMm || !Na__LeOsnap__IsEnabled()) return null;
        const setup    = Na__LeCfg__GetSnappingSetup();
        const radiusMm = setup.radiusPx / (Na__LeSurface__GetPixelsPerMm() * Na__LeSurface__GetZoom());
        const layers   = Na__LeModel__GetLayers(sheet).map((l) => l.Layer__Id);
        const ordered  = sheet.Sheet__Viewports
            .filter((v) => v.Viewport__Kind === Na__LeModel__KIND_2D && Na__LeModel__IsLayerVisible(sheet, v.Viewport__LayerId))
            .map((v, i) => ({ v : v, rank : layers.indexOf(v.Viewport__LayerId), i : i }))
            .sort((a, b) => (a.rank - b.rank) || (b.i - a.i));
        let best = null;
        for (let n = 0; n < ordered.length; n++) {
            const viewport = ordered[n].v;
            const frame    = viewport.Viewport__FrameMm;
            if (pointMm.x < frame.X - radiusMm || pointMm.x > frame.X + frame.WidthMm + radiusMm ||
                pointMm.y < frame.Y - radiusMm || pointMm.y > frame.Y + frame.HeightMm + radiusMm) continue;
            const entry = Na__LeOsnap__IndexFor(viewport.Viewport__Id);
            if (!entry) continue;
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
            if (best) break;                                                     // <-- The frontmost viewport under the cursor owns the snap
        }
        return best;
    }
    // ------------------------------------------------------------


    // FUNCTION | Snap a Cursor Point, Showing or Hiding the Marker
    // ------------------------------------------------------------
    // Returns { x, y, snapped, kind }. When nothing is near, the point comes
    // back untouched and the marker goes away.
    // ------------------------------------------------------------
    function Na__LeOsnap__Snap(sheet, pointMm) {
        const hit = Na__LeOsnap__Find(sheet, pointMm);
        if (!hit) { Na__LeOsnap__HideMarker(); return { x : pointMm.x, y : pointMm.y, snapped : false, kind : null }; }
        Na__LeOsnap__ShowMarker(hit);
        return { x : hit.x, y : hit.y, snapped : true, kind : hit.kind };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Marker
// -----------------------------------------------------------------------------

    // FUNCTION | Show the Snap Marker at a Hit
    // ------------------------------------------------------------
    function Na__LeOsnap__ShowMarker(hit) {
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
        Na__LeOsnap__Marker.className = 'na-le-osnap na-le-osnap--' + hit.kind;
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
        Na__LeOsnap__CHANGED_EVENT,
        Na__LeOsnap__IsEnabled,
        Na__LeOsnap__SetEnabled,
        Na__LeOsnap__Toggle,
        Na__LeOsnap__Clear,
        Na__LeOsnap__Find,
        Na__LeOsnap__Snap,
        Na__LeOsnap__ShowMarker,
        Na__LeOsnap__HideMarker
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
