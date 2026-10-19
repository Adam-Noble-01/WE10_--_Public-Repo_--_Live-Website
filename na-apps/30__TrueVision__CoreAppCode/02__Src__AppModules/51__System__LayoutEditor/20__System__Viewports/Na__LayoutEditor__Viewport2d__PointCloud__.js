// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - VIEWPORT 2D - POINT CLOUD
// =============================================================================
//
// FILE       : Na__LayoutEditor__Viewport2d__PointCloud__.js
// NAMESPACE  : Na__LeVp2d
// MODULE     : Layout Editor - Viewport 2D - Point Cloud
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Lay a SketchUp point cloud scene over (or under) a 2D viewport's linework, on screen and in the PDF
// CREATED    : 19-Oct-2026
//
// DESCRIPTION:
// - A viewport with Viewport__PointCloud draws one export of one point cloud
//   scene (22__System__PointCloudData) in its frame: a plan, elevation or
//   section viewport, or a site plan viewport, which is drawn as a plan is.
// - PLACEMENT is one affine map from the picture's pixels to drawing
//   millimetres, built from the drawing's own projection basis
//   (Na__PointCloud__Placement__), then from drawing millimetres to the
//   frame's CSS pixels exactly as the linework SVG's viewBox does. Each tile
//   is an <img> with that map as its CSS matrix(), so the browser draws it
//   from the full picture at whatever the paper is zoomed to. PURELY
//   COSMETIC: nothing here is snapped to, measured or hit tested.
// - THE ORDER IN THE FRAME. The frame body stacks in DOM order (Frame unit).
//   By default the point cloud goes OVER the linework and the fog and under
//   the scene markup; Linework On Top puts it under the linework instead.
//   The datum symbol always sits just under the markup, over everything else.
// - PREVIEW OR TILES. While the reduced preview carries enough pixels for the
//   screen (Na__PcPlace__PreviewSuffices, at the paper's zoom), one preview
//   image is drawn; past that only the tiles the viewport's window shows are
//   fetched. A picture being replaced stays until its successor has loaded,
//   so a zoom never flashes the frame empty.
// - REFUSED, NOT GUESSED. A scene looking another way from the drawing (past
//   the config's tolerance), a 3D View, a missing scene or a drawing that is
//   not linked draws nothing and says why in a badge on the frame.
// - Draft mode hides the pictures (its stylesheet), as it hides every other
//   raster; the datum, a vector, stays.
//
// INTEGRATION:
// - Imports the Window and Frame units only, plus the point cloud data
//   modules, the sheet chrome (the datum's primitives) and the raster
//   quality (the PDF picture's size). Nothing imports it but
//   Na__LayoutEditor__Viewport2d__, which calls PointCloudFill from Fill and
//   re-exports the rest; the PDF exporter and the Point Cloud Tools panel
//   reach it through that file.
// - The paper's zoom is pushed in with PointCloudSetZoom by the Point Cloud
//   Tools panel module, which listens to the sheet surface; importing the
//   surface here would close a loop (the surface imports Viewport2d).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Oct-2026 - Version 1.0.0
// - Initial implementation (point cloud viewports).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Model, Chrome and Raster Quality
    // ------------------------------------------------------------
    import { Na__LeModel__IsSitePlanViewport, Na__LeModel__IsPointCloudViewport } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeChrome__PushPolyline, Na__LeChrome__PushLine, Na__LeChrome__ToSvgMarkup } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetChrome__.js';
    import { Na__LeRaster__Export, Na__LeRaster__Fit } from './Na__LayoutEditor__RasterQuality__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Point Cloud Data (store, placement, config)
    // ------------------------------------------------------------
    import {
        Na__PcStore__CHANGED_EVENT,
        Na__PcStore__STATUS_READY,
        Na__PcStore__STATUS_EMPTY,
        Na__PcStore__Resolve,
        Na__PcStore__Reload,
        Na__PcStore__RevisionIdFor,
        Na__PcStore__LoadRevision,
        Na__PcStore__GetStatus,
        Na__PcStore__GetScene,
        Na__PcStore__GetDescriptor,
        Na__PcStore__GetRevision,
        Na__PcStore__GetRevisionNote,
        Na__PcStore__IsTopDown,
        Na__PcStore__IsFacing
    } from '../22__System__PointCloudData/Na__PointCloud__Store__.js';
    import {
        Na__PcPlace__DrawingAxes,
        Na__PcPlace__SitePlanAxes,
        Na__PcPlace__ToDrawing,
        Na__PcPlace__IsOrthoFrame,
        Na__PcPlace__AlignmentDeg,
        Na__PcPlace__DriftMmPerM,
        Na__PcPlace__Matrix,
        Na__PcPlace__BoundsMm,
        Na__PcPlace__VisibleTiles,
        Na__PcPlace__PreviewSuffices
    } from '../22__System__PointCloudData/Na__PointCloud__Placement__.js';
    import { Na__PcCfg__Ready, Na__PcCfg__Alignment, Na__PcCfg__Display, Na__PcCfg__Datum } from '../22__System__PointCloudData/Na__PointCloud__Config__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Viewport 2D Window and Frame Units
    // ------------------------------------------------------------
    import { Na__LeVp2d__Window, Na__LeVp2d__Describe } from './Na__LayoutEditor__Viewport2d__Window__.js';
    import { Na__LeVp2d__States, Na__LeVp2d__SizeLayer } from './Na__LayoutEditor__Viewport2d__Frame__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Status Words (the panel reads them too)
    // ------------------------------------------------------------
    const Na__LeVp2d__PC_NONE        = 'none';                                  // <-- No point cloud on this viewport
    const Na__LeVp2d__PC_HIDDEN      = 'hidden';                                // <-- Attached, switched off
    const Na__LeVp2d__PC_LOADING     = 'loading';
    const Na__LeVp2d__PC_EMPTY       = 'empty';                                 // <-- The project has no exports that could be read
    const Na__LeVp2d__PC_MISSING     = 'missing';                               // <-- The scene is not in the exports
    const Na__LeVp2d__PC_FAILED      = 'failed';                                // <-- The export did not load
    const Na__LeVp2d__PC_PERSPECTIVE = 'perspective';                           // <-- A 3D View: nothing to lay it on
    const Na__LeVp2d__PC_NO_DRAWING  = 'nodrawing';
    const Na__LeVp2d__PC_MISALIGNED  = 'misaligned';
    const Na__LeVp2d__PC_READY       = 'ready';
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Paper's Zoom and the Refresh Booking
    // ------------------------------------------------------------
    let Na__LeVp2d__PcZoom      = 1;                                            // <-- Pushed in by the Point Cloud Tools panel module
    let Na__LeVp2d__PcListening = false;
    let Na__LeVp2d__PcBooked    = 0;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Where a Viewport's Point Cloud Stands
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Bearing an Elevation Needs to Look the Scene's Way (degrees, 0 to 360)
    // ------------------------------------------------------------
    // The elevation records' own convention (Na__ElevData__GetAxes): the
    // normal points from the building to the viewer and azimuth 0 stands the
    // viewer to the north, so azimuth = atan2(x, -z) of the normal.
    // ------------------------------------------------------------
    function Na__LeVp2d__PcNeededAzimuth(frame) {
        if (!frame || !frame.NormalM) return null;
        const x = -frame.NormalM[0], z = -frame.NormalM[2];
        if (Math.hypot(x, z) < 1e-9) return null;
        const deg = Math.atan2(x, -z) * (180 / Math.PI);
        return ((deg % 360) + 360) % 360;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Degree Figure for a Sentence
    // ------------------------------------------------------------
    function Na__LeVp2d__PcDeg(value) {
        return (Math.round(value * 100) / 100).toFixed(2) + '°';
    }
    // ------------------------------------------------------------


    // FUNCTION | Where a Viewport's Point Cloud Stands (never throws; fetches only when kick is true)
    // ------------------------------------------------------------
    // Returns { status, message, block, scene, revisionId, revision, axes,
    // matrix, angleDeg, driftMmPerM, opacity, lineworkOnTop, showDatum,
    // pinned, newerExists, neededAzimuthDeg }. message is a sentence for the
    // frame and the panel, or '' when there is nothing to say. described may
    // be null for a site plan, which has no view definition.
    // ------------------------------------------------------------
    function Na__LeVp2d__PointCloudResolve(viewport, described, kick) {
        const out = { status : Na__LeVp2d__PC_NONE, message : '', block : null, scene : null, revisionId : null, revision : null,
                      axes : null, matrix : null, angleDeg : null, driftMmPerM : null, opacity : null, lineworkOnTop : false,
                      showDatum : false, pinned : false, newerExists : false, neededAzimuthDeg : null };
        if (!Na__LeModel__IsPointCloudViewport(viewport)) return out;
        const block = viewport.Viewport__PointCloud;
        out.block         = block;
        out.lineworkOnTop = block.PointCloud__LineworkOnTop === true;
        out.showDatum     = block.PointCloud__ShowDatum === true;
        out.pinned        = typeof block.PointCloud__PinnedRevision === 'string';
        if (block.PointCloud__Hidden === true) { out.status = Na__LeVp2d__PC_HIDDEN; return out; }

        const storeStatus = Na__PcStore__GetStatus();
        if (storeStatus !== Na__PcStore__STATUS_READY && storeStatus !== Na__PcStore__STATUS_EMPTY) {
            if (kick) { Na__PcCfg__Ready(); Na__PcStore__Resolve(); }
            out.status = Na__LeVp2d__PC_LOADING; out.message = 'Loading the point cloud.';
            return out;
        }
        if (storeStatus === Na__PcStore__STATUS_EMPTY) {
            out.status = Na__LeVp2d__PC_EMPTY; out.message = 'This project has no point cloud exports to draw.';
            return out;
        }

        const scene = Na__PcStore__GetScene(block.PointCloud__SceneId);
        out.scene = scene;
        if (!scene) { out.status = Na__LeVp2d__PC_MISSING; out.message = 'This point cloud scene is not in the project\'s exports.'; return out; }
        out.opacity = Number.isFinite(block.PointCloud__Opacity) ? block.PointCloud__Opacity : scene.Scene__DefaultOpacity;
        out.revisionId  = Na__PcStore__RevisionIdFor(block, scene);
        out.newerExists = out.pinned && out.revisionId !== scene.Scene__CurrentRevision;

        const revision = Na__PcStore__GetRevision(out.revisionId);
        if (!revision) {
            const note = Na__PcStore__GetRevisionNote(out.revisionId);
            if (note) { out.status = Na__LeVp2d__PC_FAILED; out.message = 'The point cloud export did not load.'; return out; }
            if (kick) Na__PcStore__LoadRevision(scene.Scene__Id, out.revisionId).catch(() => null);   // <-- Reported by the store; the change event repaints
            out.status = Na__LeVp2d__PC_LOADING; out.message = 'Loading the point cloud.';
            return out;
        }
        out.revision = revision;
        out.neededAzimuthDeg = Na__PcStore__IsFacing(revision.Scene__ViewType) ? Na__LeVp2d__PcNeededAzimuth(revision.Frame) : null;

        if (!Na__PcPlace__IsOrthoFrame(revision.Frame)) {
            out.status = Na__LeVp2d__PC_PERSPECTIVE; out.message = 'A 3D View scene cannot be laid on a drawing.';
            return out;
        }
        const axes = Na__LeModel__IsSitePlanViewport(viewport)
            ? Na__PcPlace__SitePlanAxes()
            : (described && described.definition ? Na__PcPlace__DrawingAxes(described.definition) : null);
        if (!axes) { out.status = Na__LeVp2d__PC_NO_DRAWING; out.message = 'Link a drawing to this viewport to place its point cloud.'; return out; }
        out.axes = axes;

        const tolerance = Na__PcCfg__Alignment();
        out.angleDeg    = Na__PcPlace__AlignmentDeg(revision.Frame, axes);
        out.driftMmPerM = Na__PcPlace__DriftMmPerM(out.angleDeg);
        if (out.angleDeg > tolerance.toleranceDeg) {
            const drawingTopDown = axes.TowardViewer[1] > 0.5;
            out.status = Na__LeVp2d__PC_MISALIGNED;
            if (Na__PcStore__IsTopDown(revision.Scene__ViewType) && !drawingTopDown) {
                out.message = 'A plan scene lays on a plan or site plan viewport, not this one.';
            } else if (Na__PcStore__IsFacing(revision.Scene__ViewType) && drawingTopDown) {
                out.message = 'An elevation or section scene lays on an elevation or section viewport, not a plan.';
            } else {
                out.message = 'This scene looks ' + Na__LeVp2d__PcDeg(out.angleDeg) + ' away from this drawing, so it is not drawn.';
            }
            return out;
        }
        out.matrix = Na__PcPlace__Matrix(revision.Frame, axes);
        out.status = Na__LeVp2d__PC_READY;
        return out;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Frame Layer
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Listen Once for the Store and Repaint Every Point Cloud Frame When It Speaks
    // ------------------------------------------------------------
    function Na__LeVp2d__PcListen() {
        if (Na__LeVp2d__PcListening) return;
        Na__LeVp2d__PcListening = true;
        window.addEventListener(Na__PcStore__CHANGED_EVENT, () => Na__LeVp2d__PointCloudRefreshAll());
        Na__PcCfg__Ready().then(() => Na__LeVp2d__PointCloudRefreshAll());   // <-- The file's tolerances, once they land
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Point Cloud Elements of a Frame, Made on First Use
    // ------------------------------------------------------------
    function Na__LeVp2d__PcEnsure(state) {
        if (state.pc && state.pc.note && state.pc.note.parentNode === state.body) return state.pc;
        const make = (cls) => { const el = document.createElement('div'); el.className = cls; return el; };
        state.pc = {
            layer  : make('na-le-frame__pointcloud'),
            datum  : make('na-le-frame__pointcloud-datum'),
            note   : make('na-le-frame__pointcloud-note'),
            images : new Map(),                                                  // <-- First URL -> { img, wanted, loaded, picture, matrix }
            key    : null
        };
        state.pc.note.hidden = true;
        state.body.appendChild(state.pc.note);                                   // <-- After everything: a badge, like the progress badge
        return state.pc;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put the Layers Where They Stack
    // ------------------------------------------------------------
    // Over the linework and the fog, under the markup, by default:
    //     underlay, linework, fog, POINT CLOUD, DATUM, markup ...
    // and under the linework with Linework On Top:
    //     underlay, POINT CLOUD, linework, fog, DATUM, markup ...
    // Moved only when it is not already there, so a refresh costs a compare.
    // ------------------------------------------------------------
    function Na__LeVp2d__PcOrder(state, lineworkOnTop) {
        const pc = state.pc;
        if (!state.markup || state.markup.parentNode !== state.body || !state.linework || state.linework.parentNode !== state.body) return;
        const after = lineworkOnTop ? state.linework : pc.datum;
        if (pc.layer.parentNode !== state.body || pc.layer.nextSibling !== after) {
            state.body.insertBefore(pc.layer, lineworkOnTop ? state.linework : state.markup);
        }
        if (pc.datum.parentNode !== state.body || pc.datum.nextSibling !== state.markup) {
            state.body.insertBefore(pc.datum, state.markup);
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Take a Frame's Point Cloud Down
    // ------------------------------------------------------------
    function Na__LeVp2d__PointCloudClear(state) {
        if (!state || !state.pc) return;
        [ state.pc.layer, state.pc.datum, state.pc.note ].forEach((el) => { if (el && el.parentNode) el.parentNode.removeChild(el); });
        state.pc = null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Drop the Pictures That Were Waiting for Their Successors, Once Those Have Loaded
    // ------------------------------------------------------------
    function Na__LeVp2d__PcSweep(pc) {
        let waiting = false;
        pc.images.forEach((entry) => { if (entry.wanted && !entry.loaded) waiting = true; });
        if (waiting) return;
        pc.images.forEach((entry, key) => {
            if (entry.wanted) return;
            if (entry.img.parentNode) entry.img.parentNode.removeChild(entry.img);
            pc.images.delete(key);
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Picture's <img>: CORS, Each URL Tried In Turn
    // ------------------------------------------------------------
    // crossOrigin before src, always: the PDF draws the same files onto a
    // canvas, and a picture the browser cached without CORS cannot be.
    // ------------------------------------------------------------
    function Na__LeVp2d__PcImage(pc, picture) {
        const img = document.createElement('img');
        const entry = { img : img, wanted : true, loaded : false, picture : picture, matrix : null };
        let index = 0;
        img.className   = 'na-le-frame__pointcloud-tile';
        img.alt         = '';
        img.draggable   = false;
        img.decoding    = 'async';
        img.crossOrigin = 'anonymous';
        img.addEventListener('load', () => { entry.loaded = true; Na__LeVp2d__PcSweep(pc); });
        img.addEventListener('error', () => {
            index += 1;
            if (index < picture.urls.length) { img.src = picture.urls[index]; return; }   // <-- Not on this computer: the CDN
            entry.loaded = true; img.hidden = true;                              // <-- Nowhere: leave the gap, never block the sweep
            Na__LeVp2d__PcSweep(pc);
        });
        img.src = picture.urls[0];
        return entry;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Pictures to Draw: the Preview, or the Tiles the Window Shows
    // ------------------------------------------------------------
    // Each { key, urls, x, y, w, h, scale }: placed at image pixel (x, y), its
    // own pixels each scale image pixels wide.
    // ------------------------------------------------------------
    function Na__LeVp2d__PcPictures(revision, matrix, win, devicePxPerMm) {
        const display = Na__PcCfg__Display();
        const preview = revision.Image.Preview;
        if (Na__PcPlace__PreviewSuffices(matrix, preview, devicePxPerMm, display.previewSlack)) {
            return [ { key : preview.Urls[0], urls : preview.Urls, x : 0, y : 0, w : preview.WidthPx, h : preview.HeightPx, scale : preview.Factor } ];
        }
        const rect = { MinX : win.OriginX, MinY : win.OriginY, MaxX : win.OriginX + win.WidthMm, MaxY : win.OriginY + win.HeightMm };
        return Na__PcPlace__VisibleTiles(revision.Image.Tiles, matrix, rect, display.tileMarginPx)
            .map((tile) => ({ key : tile.Urls[0], urls : tile.Urls, x : tile.X, y : tile.Y, w : tile.W, h : tile.H, scale : 1 }));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Picture's Map Into a Target: [a, b, c, d, e, f] for CSS or a canvas
    // ------------------------------------------------------------
    // Picture pixel (p, q) is image pixel (x + p s, y + q s); the image map
    // takes that to drawing millimetres; (dx - OriginX) kx and (dy - OriginY)
    // ky take those to the target's pixels.
    // ------------------------------------------------------------
    function Na__LeVp2d__PcTargetMatrix(m, picture, win, kx, ky) {
        const s = picture.scale;
        return [
            kx * m[0] * s, ky * m[1] * s,
            kx * m[2] * s, ky * m[3] * s,
            kx * ((m[0] * picture.x) + (m[2] * picture.y) + m[4] - win.OriginX),
            ky * ((m[1] * picture.x) + (m[3] * picture.y) + m[5] - win.OriginY)
        ];
    }
    // ------------------------------------------------------------


    // FUNCTION | Datum Symbols in Frame-Local Paper Millimetres (empty unless Show Datum is ticked)
    // ------------------------------------------------------------
    // A circle with its top right and bottom left quarters filled and a cross
    // through it: the surveyor's benchmark mark, at a fixed paper size. The
    // positions are the ones recorded with the export being drawn, so a pinned
    // viewport keeps the datum it was drawn against.
    // ------------------------------------------------------------
    function Na__LeVp2d__PointCloudDatumPrimitives(viewport, resolved, win) {
        if (!resolved || !resolved.showDatum || !resolved.axes || !resolved.revision) return [];
        const descriptor = Na__PcStore__GetDescriptor();
        const datums = resolved.revision.Datums.length ? resolved.revision.Datums : (descriptor ? descriptor.Store__Datums : []);
        const cfg    = Na__PcCfg__Datum();
        const frame  = viewport.Viewport__FrameMm;
        const r      = cfg.symbolMm / 2;
        const list   = [];
        const arc    = (cx, cy, from, to) => {
            const points = [ [ cx, cy ] ];
            for (let i = 0; i <= 8; i++) {
                const t = from + ((to - from) * i / 8);
                points.push([ cx + (r * Math.cos(t)), cy + (r * Math.sin(t)) ]);
            }
            return points;
        };
        datums.forEach((datum) => {
            const at = Na__PcPlace__ToDrawing(resolved.axes, datum.Datum__PositionM);
            const p  = win.ToLocal(at.x, at.y);
            if (p.x < -r || p.y < -r || p.x > frame.WidthMm + r || p.y > frame.HeightMm + r) return;
            const ring = [];
            for (let i = 0; i <= 32; i++) ring.push([ p.x + (r * Math.cos(i * Math.PI / 16)), p.y + (r * Math.sin(i * Math.PI / 16)) ]);
            Na__LeChrome__PushPolyline(list, arc(p.x, p.y, -Math.PI / 2, 0), null, 0, cfg.colourHex, true);           // <-- Top right quarter (screen y runs down)
            Na__LeChrome__PushPolyline(list, arc(p.x, p.y, Math.PI / 2, Math.PI), null, 0, cfg.colourHex, true);      // <-- Bottom left quarter
            Na__LeChrome__PushPolyline(list, ring, cfg.colourHex, cfg.strokeMm, null, true);
            const reach = r * (1 + cfg.crossOverhang);
            Na__LeChrome__PushLine(list, p.x - reach, p.y, p.x + reach, p.y, cfg.colourHex, cfg.strokeMm);
            Na__LeChrome__PushLine(list, p.x, p.y - reach, p.x, p.y + reach, cfg.colourHex, cfg.strokeMm);
        });
        return list;
    }
    // ------------------------------------------------------------


    // FUNCTION | Fill (or Refresh) a Frame's Point Cloud
    // ------------------------------------------------------------
    // Called from Fill for every 2D frame, after its own layers; described is
    // the frame's Describe result, or null for a site plan. Quick when nothing
    // has moved: one key compared.
    // ------------------------------------------------------------
    function Na__LeVp2d__PointCloudFill(state, sheet, viewport, described, ppm) {
        if (!Na__LeModel__IsPointCloudViewport(viewport)) { Na__LeVp2d__PointCloudClear(state); return; }
        Na__LeVp2d__PcListen();
        const resolved = Na__LeVp2d__PointCloudResolve(viewport, described, true);
        const pc       = Na__LeVp2d__PcEnsure(state);
        Na__LeVp2d__PcOrder(state, resolved.lineworkOnTop);

        const shout = resolved.status !== Na__LeVp2d__PC_READY && resolved.status !== Na__LeVp2d__PC_HIDDEN ? resolved.message : '';
        if (pc.note.textContent !== shout) pc.note.textContent = shout;
        pc.note.hidden = shout === '';

        const win = Na__LeVp2d__Window(viewport);
        const D   = win.Denominator;
        const k   = ppm / D;                                                     // <-- Frame CSS pixels per drawing millimetre

        // EVERY PICTURE IS PLACED BY ITS OWN MAP. A picture on its way out - the
        // preview while the tiles load, an older export while the newer one
        // does - stays where it belongs, even if the viewport is panned meanwhile.
        const place = () => pc.images.forEach((entry) => {
            const t = Na__LeVp2d__PcTargetMatrix(entry.matrix, entry.picture, win, k, k);
            entry.img.style.width     = entry.picture.w + 'px';
            entry.img.style.height    = entry.picture.h + 'px';
            entry.img.style.transform = 'matrix(' + t.join(',') + ')';
        });

        if (resolved.status !== Na__LeVp2d__PC_READY) {
            if (resolved.status === Na__LeVp2d__PC_LOADING && pc.images.size) { place(); return; }   // <-- A newer export on its way: the last one stays meanwhile
            pc.images.forEach((entry) => { if (entry.img.parentNode) entry.img.parentNode.removeChild(entry.img); });
            pc.images.clear();
            pc.datum.innerHTML = '';
            pc.key = null;
            return;
        }

        const dpr  = window.devicePixelRatio || 1;
        const need = (ppm * Na__LeVp2d__PcZoom * dpr) / D;                       // <-- Device pixels per drawing millimetre on screen now
        const pictures = Na__LeVp2d__PcPictures(resolved.revision, resolved.matrix, win, need);
        const key = [ resolved.revisionId, resolved.matrix.join(','), ppm, D, win.OriginX, win.OriginY, win.WidthMm, win.HeightMm, resolved.opacity,
                      resolved.lineworkOnTop, resolved.showDatum, viewport.Viewport__FrameMm.WidthMm, viewport.Viewport__FrameMm.HeightMm,
                      pictures.map((p) => p.key).join(',') ].join('|');
        if (key === pc.key) return;
        pc.key = key;

        pc.layer.style.opacity = String(resolved.opacity);
        pc.images.forEach((entry) => { entry.wanted = false; });
        pictures.forEach((picture) => {
            let entry = pc.images.get(picture.key);
            if (!entry) {
                entry = Na__LeVp2d__PcImage(pc, picture);
                pc.images.set(picture.key, entry);
                pc.layer.appendChild(entry.img);                                 // <-- Appended: over anything still waiting to be swept
            }
            entry.wanted  = true;
            entry.picture = picture;
            entry.matrix  = resolved.matrix;
        });
        place();
        Na__LeVp2d__PcSweep(pc);

        const primitives = Na__LeVp2d__PointCloudDatumPrimitives(viewport, resolved, win);
        if (primitives.length) {
            const frame = viewport.Viewport__FrameMm;
            pc.datum.innerHTML = Na__LeChrome__ToSvgMarkup(primitives, frame.WidthMm, frame.HeightMm, 'na-le-frame__markup-svg na-le-frame__datum-svg');
            Na__LeVp2d__SizeLayer(pc.datum.firstElementChild, viewport, ppm);
        } else {
            pc.datum.innerHTML = '';
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Repaint Every Point Cloud Frame on Screen (booked once per frame of animation)
    // ------------------------------------------------------------
    function Na__LeVp2d__PointCloudRefreshAll() {
        if (Na__LeVp2d__PcBooked) return;
        Na__LeVp2d__PcBooked = window.requestAnimationFrame(() => {
            Na__LeVp2d__PcBooked = 0;
            Na__LeVp2d__States.forEach((state) => {
                const args = state.lastArgs;
                if (!args || !args.viewport || (!state.pc && !Na__LeModel__IsPointCloudViewport(args.viewport))) return;
                const described = Na__LeModel__IsSitePlanViewport(args.viewport) ? null : Na__LeVp2d__Describe(args.viewport);
                if (state.pc) state.pc.key = null;                               // <-- What the store said may change what is drawn without changing the key
                Na__LeVp2d__PointCloudFill(state, args.sheet, args.viewport, described, args.ppm);
            });
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | The Paper's Zoom Has Settled: Swap Preview and Tiles Where That Changes Which Is Sharp Enough
    // ------------------------------------------------------------
    function Na__LeVp2d__PointCloudSetZoom(zoom) {
        if (!Number.isFinite(zoom) || zoom <= 0 || zoom === Na__LeVp2d__PcZoom) return;
        Na__LeVp2d__PcZoom = zoom;
        Na__LeVp2d__PointCloudRefreshAll();
    }
    // ------------------------------------------------------------


    // FUNCTION | Read the Exports Again and Redraw (Force Render, the panel's Reload)
    // ------------------------------------------------------------
    async function Na__LeVp2d__PointCloudReload() {
        await Na__PcStore__Reload();
        Na__LeVp2d__PointCloudRefreshAll();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Bounds and Export
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Viewport's Point Cloud, Fully Loaded (for the PDF and for centring)
    // ------------------------------------------------------------
    async function Na__LeVp2d__PcLoaded(viewport) {
        if (!Na__LeModel__IsPointCloudViewport(viewport)) return null;
        await Na__PcCfg__Ready();
        await Na__PcStore__Resolve();
        const described = Na__LeModel__IsSitePlanViewport(viewport) ? null : Na__LeVp2d__Describe(viewport);
        let resolved = Na__LeVp2d__PointCloudResolve(viewport, described, false);
        if (resolved.status === Na__LeVp2d__PC_LOADING && resolved.scene && resolved.revisionId) {
            await Na__PcStore__LoadRevision(resolved.scene.Scene__Id, resolved.revisionId).catch(() => null);
            resolved = Na__LeVp2d__PointCloudResolve(viewport, described, false);
        }
        return resolved;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Picture's Bounds in Drawing Millimetres (null until it can be placed)
    // ------------------------------------------------------------
    async function Na__LeVp2d__PointCloudBoundsMm(viewport) {
        const resolved = await Na__LeVp2d__PcLoaded(viewport);
        if (!resolved || resolved.status !== Na__LeVp2d__PC_READY) return null;
        return Na__PcPlace__BoundsMm(resolved.matrix, resolved.revision.Image.WidthPx || resolved.revision.Frame.WidthPx,
                                     resolved.revision.Image.HeightPx || resolved.revision.Frame.HeightPx);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fetch One Picture as a Bitmap, Each URL In Turn (null when none answers)
    // ------------------------------------------------------------
    async function Na__LeVp2d__PcBitmap(urls) {
        for (const url of urls) {
            try {
                const response = await fetch(url, { mode : 'cors' });
                if (!response.ok) continue;
                return await createImageBitmap(await response.blob());
            } catch (error) { /* the next URL */ }
        }
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Point Cloud as One Picture of the Viewport's Frame, at Export Resolution (not cached)
    // ------------------------------------------------------------
    // Resolves { dataUrl, lineworkOnTop, datum } or null: a PNG of the frame
    // with the viewport's opacity in its alpha, for the PDF to lay at the
    // frame's rectangle. 'PNG' and a PNG data URL, never 'RGBA' - jsPDF 4.1.0
    // drops the alpha of anything handed over as 'RGBA'. datum is the datum's
    // frame-local primitives, for the PDF to draw as vectors over everything.
    // ------------------------------------------------------------
    async function Na__LeVp2d__PointCloudForExport(viewport) {
        const resolved = await Na__LeVp2d__PcLoaded(viewport);
        if (!resolved || resolved.status !== Na__LeVp2d__PC_READY) return null;
        const frame = viewport.Viewport__FrameMm;
        const px    = Na__LeRaster__Fit(frame.WidthMm, frame.HeightMm, Na__LeRaster__Export());
        const win   = Na__LeVp2d__Window(viewport);
        const kx    = px.w / win.WidthMm, ky = px.h / win.HeightMm;
        const pictures = Na__LeVp2d__PcPictures(resolved.revision, resolved.matrix, win, Math.max(kx, ky));
        const canvas = document.createElement('canvas');
        canvas.width = px.w; canvas.height = px.h;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        let drawn = 0;
        for (const picture of pictures) {
            const bitmap = await Na__LeVp2d__PcBitmap(picture.urls);
            if (!bitmap) { console.warn('[TrueVision3D LayoutEditor] A point cloud tile did not load for the PDF: ' + picture.urls[0]); continue; }
            const t = Na__LeVp2d__PcTargetMatrix(resolved.matrix, picture, win, kx, ky);
            ctx.setTransform(t[0], t[1], t[2], t[3], t[4], t[5]);
            ctx.drawImage(bitmap, 0, 0);
            if (typeof bitmap.close === 'function') bitmap.close();
            drawn += 1;
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (!drawn) return null;
        ctx.globalCompositeOperation = 'destination-in';                         // <-- Every pixel's alpha times the opacity, its colour untouched
        ctx.fillStyle = 'rgba(0, 0, 0, ' + resolved.opacity + ')';
        ctx.fillRect(0, 0, px.w, px.h);
        ctx.globalCompositeOperation = 'source-over';
        return { dataUrl : canvas.toDataURL('image/png'), lineworkOnTop : resolved.lineworkOnTop,
                 datum : Na__LeVp2d__PointCloudDatumPrimitives(viewport, resolved, win) };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Viewport 2D Point Cloud Unit
    // ------------------------------------------------------------
    export {
        Na__LeVp2d__PC_NONE,
        Na__LeVp2d__PC_HIDDEN,
        Na__LeVp2d__PC_LOADING,
        Na__LeVp2d__PC_EMPTY,
        Na__LeVp2d__PC_MISSING,
        Na__LeVp2d__PC_FAILED,
        Na__LeVp2d__PC_PERSPECTIVE,
        Na__LeVp2d__PC_NO_DRAWING,
        Na__LeVp2d__PC_MISALIGNED,
        Na__LeVp2d__PC_READY,
        Na__LeVp2d__PointCloudResolve,
        Na__LeVp2d__PointCloudFill,
        Na__LeVp2d__PointCloudClear,
        Na__LeVp2d__PointCloudRefreshAll,
        Na__LeVp2d__PointCloudSetZoom,
        Na__LeVp2d__PointCloudReload,
        Na__LeVp2d__PointCloudBoundsMm,
        Na__LeVp2d__PointCloudDatumPrimitives,
        Na__LeVp2d__PointCloudForExport
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
