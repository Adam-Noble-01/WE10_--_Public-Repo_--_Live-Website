// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - VIEWPORT 3D
// =============================================================================
//
// FILE       : Na__LayoutEditor__Viewport3d__.js
// NAMESPACE  : Na__LeVp3d
// MODULE     : Layout Editor - Viewport 3D
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : A raster snapshot of a saved scene inside a crop frame
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - The picture is rendered from the scene camera through the live pipeline
//   with the viewport's style toggles (D30) at SnapshotPixelsPerMm of its
//   paper size, and placed inside the frame at the image offset. Corner
//   drags scale the image (its paper size), edge drags crop the frame.
// - The snapshot is fingerprinted by scene, camera, styles, layer visibility
//   and model. On localhost a fresh render is uploaded to R2 and referenced
//   on the record, so the web build loads the picture instead of rendering
//   it. A picture is only re-rendered when the paper size grows well past
//   what it was rendered for.
//
// INTEGRATION:
// - The sheet surface calls Fill for every visible 3D frame; the PDF
//   exporter asks for the picture at export resolution.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__Viewport3d__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.3.1
// - Base Image off: no snapshot is rendered, shown or exported; the picture already held comes straight back on.
//
// 10-Sep-2026 - Version 1.3.0
// - The stored snapshot records the width it was rendered at, so a picture too small for the working level is re-rendered instead of shown blurred (a record written before that key reads as too small).
// - Every render uploads, so the stored file and its record always agree; the PDF reuses it only when it is wide enough.
//
// 10-Sep-2026 - Version 1.2.0
// - The growth ratio is 1.1 so a higher raster level renders again. Snapshot pixels come from the global raster level; only export-level renders are uploaded, so a stored asset is always the export picture; the PDF renders at the export level unless an export-size render is already on screen.
//
// 10-Sep-2026 - Version 1.1.0
// - Snapshot keys use the session-cached, visibility-free model fingerprint, so applying a scene's layer map never re-keys the picture.
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 5.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Snapshots and Assets
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel } from './Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__GetSheets, Na__LeModel__GetViewports, Na__LeModel__ResolveViewportSource, Na__LeModel__UpdateViewport } from './Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSnap__Render3d, Na__LeSnap__IsReady, Na__LeSnap__GetModelFingerprint } from './Na__LayoutEditor__SnapshotRenderer__.js';
    import { Na__LeRaster__Working, Na__LeRaster__Export, Na__LeRaster__Fit } from './Na__LayoutEditor__RasterQuality__.js';
    import {
        Na__LeAssets__CanvasToBlob,
        Na__LeAssets__BlobToDataUrl,
        Na__LeAssets__ToPngDataUrl,
        Na__LeAssets__SnapshotPath,
        Na__LeAssets__CanUpload,
        Na__LeAssets__Upload,
        Na__LeAssets__Load
    } from './Na__LayoutEditor__Assets__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Debounce and Re-render Threshold
    // ------------------------------------------------------------
    const Na__LeVp3d__RENDER_DELAY_MS = 400;
    const Na__LeVp3d__GROWTH_RATIO    = 1.1;   // <-- A picture more than a tenth short of the size asked for (a bigger frame, a higher raster level) renders again
    // ------------------------------------------------------------

    // MODULE VARIABLES | Per-Viewport State
    // ------------------------------------------------------------
    const Na__LeVp3d__States = new Map();
    let   Na__LeVp3d__Interacting = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Fingerprint and Sizing
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Short Hash of a String
    // ------------------------------------------------------------
    function Na__LeVp3d__Hash(text) {
        let h = 5381;
        for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
        return (h >>> 0).toString(36);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Fingerprint of the Picture a Viewport Wants
    // ------------------------------------------------------------
    function Na__LeVp3d__Fingerprint(viewport, scene) {
        const parts = [
            scene.PresentationMode__Scene__Id, scene.PresentationMode__Scene__Name,
            JSON.stringify(scene.PresentationMode__Scene__CameraPosition || null),
            JSON.stringify(scene.PresentationMode__Scene__OrbitHelperCubePosition || null),
            JSON.stringify(scene.PresentationMode__Scene__ModelLayerVisibility || null),
            JSON.stringify(viewport.Viewport__Styles),
            Math.round((viewport.Viewport__ImageMm.WidthMm / viewport.Viewport__ImageMm.HeightMm) * 1000),
            Na__LeSnap__GetModelFingerprint()
        ];
        return Na__LeVp3d__Hash(parts.join('|'));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Pixel Size for a Paper Size
    // ------------------------------------------------------------
    function Na__LeVp3d__PixelSize(viewport, profile) {
        return Na__LeRaster__Fit(viewport.Viewport__ImageMm.WidthMm, viewport.Viewport__ImageMm.HeightMm, profile);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Export Profile
    // ------------------------------------------------------------
    function Na__LeVp3d__ExportProfile() { return Na__LeRaster__Export(); }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is a Stored Picture Big Enough for the Size Asked For
    // ------------------------------------------------------------
    // A picture within a tenth of the wanted width is close enough to show;
    // anything smaller (or a width this record never wrote down) is stale.
    // ------------------------------------------------------------
    function Na__LeVp3d__WideEnough(pixelWidth, wantedWidth) {
        return Number.isFinite(pixelWidth) && pixelWidth > 0 && pixelWidth >= wantedWidth / Na__LeVp3d__GROWTH_RATIO;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Rendering and Loading
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Per-Viewport State With Its Image Element
    // ------------------------------------------------------------
    function Na__LeVp3d__State(body, viewportId) {
        let state = Na__LeVp3d__States.get(viewportId);
        if (state && state.body === body) return state;
        body.innerHTML = '';
        const img = document.createElement('img');
        img.className = 'na-le-frame__snapshot';
        img.draggable = false;
        img.alt = '';
        img.hidden = true;
        body.appendChild(img);
        const empty = document.createElement('div');
        empty.className = 'na-le-frame__empty';
        body.appendChild(empty);
        state = { body : body, img : img, empty : empty, key : null, px : null, dataUrl : null, triedAsset : null, timer : null, inFlight : false, lastArgs : null };
        Na__LeVp3d__States.set(viewportId, state);
        return state;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Render, Show, and on Localhost Upload and Reference
    // ------------------------------------------------------------
    // profile: { pixelsPerMm, maxPixels }. Every render is uploaded with the
    // width it was made at, so the record always describes the stored file
    // and a later request can tell whether it is big enough.
    // ------------------------------------------------------------
    async function Na__LeVp3d__RenderNow(state, sheet, viewport, scene, key, profile) {
        const px = Na__LeVp3d__PixelSize(viewport, profile);
        state.inFlight = true;
        try {
            const result = await Na__LeSnap__Render3d(scene, viewport.Viewport__Styles, px.w, px.h);
            if (!result) return;
            const blob    = await Na__LeAssets__CanvasToBlob(result.canvas, 'image/webp', 0.9);
            const dataUrl = blob ? await Na__LeAssets__BlobToDataUrl(blob) : result.canvas.toDataURL('image/png');
            if (!dataUrl) return;
            state.img.src = dataUrl; state.img.hidden = false;
            state.key = key; state.px = px; state.dataUrl = dataUrl;
            if (blob && sheet && Na__LeAssets__CanUpload()) {
                const path = Na__LeAssets__SnapshotPath(sheet.Sheet__Id, viewport.Viewport__Id, key);
                const uploaded = await Na__LeAssets__Upload(blob, path, null);
                if (uploaded) Na__LeModel__UpdateViewport(sheet, viewport.Viewport__Id, { snapshotAsset : { Asset__Path : path, Asset__Fingerprint : key, Asset__PixelWidth : px.w } }, true);
            }
        } finally {
            state.inFlight = false;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Try the Stored Asset, Else Render (debounced)
    // ------------------------------------------------------------
    function Na__LeVp3d__Schedule(state, viewportId) {
        if (state.timer) window.clearTimeout(state.timer);
        state.timer = window.setTimeout(async () => {
            state.timer = null;
            if (Na__LeVp3d__Interacting || state.inFlight || !state.lastArgs) return;
            const { sheet, viewport } = state.lastArgs;
            const scene = Na__LeModel__ResolveViewportSource(viewport).scene;
            if (!scene) return;
            const key     = Na__LeVp3d__Fingerprint(viewport, scene);
            if (state.key === key) return;
            const profile = Na__LeRaster__Working();                              // <-- The global working level
            const wanted  = Na__LeVp3d__PixelSize(viewport, profile);
            const slot    = viewport.Viewport__SnapshotAsset;
            // The stored picture is only worth fetching when it is the same
            // view and was rendered at least as large as this level asks for.
            if (slot && slot.Asset__Fingerprint === key && Na__LeVp3d__WideEnough(slot.Asset__PixelWidth, wanted.w) && state.triedAsset !== key) {
                state.triedAsset = key;
                state.inFlight = true;
                const dataUrl = await Na__LeAssets__Load(slot.Asset__Path);
                state.inFlight = false;
                if (Na__LeVp3d__States.get(viewportId) !== state) return;
                if (dataUrl) {
                    state.img.src = dataUrl; state.img.hidden = false;
                    state.key = key; state.dataUrl = dataUrl; state.px = { w : slot.Asset__PixelWidth, h : Math.round(slot.Asset__PixelWidth * (wanted.h / wanted.w)) };
                    return;
                }
            }
            if (!Na__LeSnap__IsReady()) return;
            await Na__LeVp3d__RenderNow(state, sheet, viewport, scene, key, profile);
        }, Na__LeVp3d__RENDER_DELAY_MS);
    }
    // ------------------------------------------------------------


    // FUNCTION | Fill (or Refresh) the Body of a 3D Frame
    // ------------------------------------------------------------
    function Na__LeVp3d__Fill(body, sheet, viewport, ppm) {
        const state = Na__LeVp3d__State(body, viewport.Viewport__Id);
        state.lastArgs = { sheet : sheet, viewport : viewport, ppm : ppm };
        const scene = Na__LeModel__ResolveViewportSource(viewport).scene;

        state.img.style.left   = (viewport.Viewport__ImageOffsetMm.X * ppm) + 'px';
        state.img.style.top    = (viewport.Viewport__ImageOffsetMm.Y * ppm) + 'px';
        state.img.style.width  = (viewport.Viewport__ImageMm.WidthMm  * ppm) + 'px';
        state.img.style.height = (viewport.Viewport__ImageMm.HeightMm * ppm) + 'px';

        if (!scene) {
            state.empty.textContent = Na__LeCfg__GetLabel('NoSceneLinked', 'No scene linked to this viewport.');
            state.empty.hidden = false; state.img.hidden = true; state.key = null;
            return;
        }
        // BASE IMAGE OFF | An empty frame: nothing is rendered, and the last
        // picture is kept in the state so switching back on is instant.
        if (viewport.Viewport__Styles.baseImage === false) {
            if (state.timer) { window.clearTimeout(state.timer); state.timer = null; }
            state.empty.hidden = true; state.img.hidden = true;
            return;
        }
        state.empty.hidden = true;
        if (state.dataUrl && state.img.hidden) state.img.hidden = false;          // <-- Back on: the picture it already has
        const key = Na__LeVp3d__Fingerprint(viewport, scene);
        if (state.key === key) {
            const wanted = Na__LeVp3d__PixelSize(viewport, Na__LeRaster__Working());
            if (state.px && wanted.w > state.px.w * Na__LeVp3d__GROWTH_RATIO && Na__LeSnap__IsReady()) { state.key = null; Na__LeVp3d__Schedule(state, viewport.Viewport__Id); }
            return;
        }
        Na__LeVp3d__Schedule(state, viewport.Viewport__Id);
    }
    // ------------------------------------------------------------


    // FUNCTION | Drop a Viewport's State
    // ------------------------------------------------------------
    function Na__LeVp3d__Release(viewportId) {
        const state = Na__LeVp3d__States.get(viewportId);
        if (!state) return;
        if (state.timer) window.clearTimeout(state.timer);
        Na__LeVp3d__States.delete(viewportId);
    }
    // ------------------------------------------------------------


    // FUNCTION | Hold Renders While the Pointer Is Down
    // ------------------------------------------------------------
    function Na__LeVp3d__SetInteracting(flag) {
        Na__LeVp3d__Interacting = flag === true;
        if (Na__LeVp3d__Interacting) return;
        Na__LeVp3d__States.forEach((state, viewportId) => {
            if (state.lastArgs && state.key === null) Na__LeVp3d__Schedule(state, viewportId);
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Re-Stamp Snapshot References After Their Scene Was Renamed
    // ------------------------------------------------------------
    // The scene NAME is part of the snapshot fingerprint, so a rename makes
    // every stored picture read as stale although not one pixel changed:
    // the web build refuses the R2 asset and draws an empty frame, and the
    // PDF export falls back to a live render it cannot do. The picture is
    // still correct, so re-stamp the reference with the fingerprint the
    // renamed scene now produces and leave Asset__Path exactly as it is.
    // The path is only a handle, nothing reads the fingerprint back out of
    // it, and writing a new path would orphan a good object on R2.
    //
    // Every sheet is walked, not just the open one: a scene can appear on
    // as many sheets as the set has.
    //
    // Returns the number of viewports re-stamped.
    // ------------------------------------------------------------
    function Na__LeVp3d__RestampForScene(sceneId) {
        if (!sceneId) return 0;
        let restamped = 0;

        Na__LeModel__GetSheets().forEach((sheet) => {
            Na__LeModel__GetViewports(sheet).forEach((viewport) => {
                if (viewport.Viewport__SceneId !== sceneId) return;

                const slot = viewport.Viewport__SnapshotAsset;
                if (!slot || !slot.Asset__Path || !slot.Asset__Fingerprint) return;   // <-- Never baked: nothing to keep

                const scene = Na__LeModel__ResolveViewportSource(viewport).scene;
                if (!scene) return;

                const key = Na__LeVp3d__Fingerprint(viewport, scene);
                if (slot.Asset__Fingerprint === key) return;                         // <-- Already current

                Na__LeModel__UpdateViewport(sheet, viewport.Viewport__Id, {
                    snapshotAsset : { Asset__Path : slot.Asset__Path, Asset__Fingerprint : key }
                }, true);                                                            // <-- Silent: the rename saves once, at the end

                // LIVE FRAME | What is on screen is the picture the new key
                // describes, so carry its state across rather than let the
                // frame re-fetch the image it is already showing.
                const state = Na__LeVp3d__States.get(viewport.Viewport__Id);
                if (state && state.key) { state.key = key; state.triedAsset = key; }

                restamped++;
            });
        });

        return restamped;
    }
    // ------------------------------------------------------------


    // FUNCTION | Render and Upload One 3D Viewport Without a Frame on Screen (Dev bake)
    // ------------------------------------------------------------
    // Returns 'baked' | 'skipped' (already referenced) | 'failed'.
    // ------------------------------------------------------------
    async function Na__LeVp3d__Bake(sheet, viewport, force) {
        const scene = Na__LeModel__ResolveViewportSource(viewport).scene;
        if (!scene || !Na__LeSnap__IsReady()) return 'failed';
        const key     = Na__LeVp3d__Fingerprint(viewport, scene);
        const wanted  = Na__LeVp3d__PixelSize(viewport, Na__LeVp3d__ExportProfile());
        const slot    = viewport.Viewport__SnapshotAsset;
        if (!force && slot && slot.Asset__Fingerprint === key && Na__LeVp3d__WideEnough(slot.Asset__PixelWidth, wanted.w)) return 'skipped';
        const state = { img : document.createElement('img'), key : null, px : null, dataUrl : null, inFlight : false };
        await Na__LeVp3d__RenderNow(state, sheet, viewport, scene, key, Na__LeVp3d__ExportProfile());
        const live = Na__LeVp3d__States.get(viewport.Viewport__Id);
        if (live && state.dataUrl) { live.img.src = state.dataUrl; live.img.hidden = false; live.key = key; live.px = state.px; live.dataUrl = state.dataUrl; }
        const after = viewport.Viewport__SnapshotAsset;
        return (after && after.Asset__Fingerprint === key) ? 'baked' : 'failed';
    }
    // ------------------------------------------------------------


    // FUNCTION | The Picture for the PDF (png data URL at export resolution)
    // ------------------------------------------------------------
    async function Na__LeVp3d__RenderForExport(sheet, viewport) {
        const scene = Na__LeModel__ResolveViewportSource(viewport).scene;
        if (!scene) return null;
        if (viewport.Viewport__Styles.baseImage === false) return null;           // <-- An empty frame prints empty
        const key     = Na__LeVp3d__Fingerprint(viewport, scene);
        const profile = Na__LeVp3d__ExportProfile();
        const px      = Na__LeVp3d__PixelSize(viewport, profile);
        const live    = Na__LeVp3d__States.get(viewport.Viewport__Id);
        if (live && live.key === key && live.dataUrl && Na__LeVp3d__WideEnough(live.px ? live.px.w : null, px.w)) return Na__LeAssets__ToPngDataUrl(live.dataUrl);   // <-- An export-size render is already on screen
        const slot = viewport.Viewport__SnapshotAsset;
        const stored = slot && slot.Asset__Fingerprint === key;
        if (!Na__LeSnap__IsReady()) return stored ? Na__LeAssets__ToPngDataUrl(await Na__LeAssets__Load(slot.Asset__Path)) : null;   // <-- The web build has only the stored picture
        if (stored && Na__LeVp3d__WideEnough(slot.Asset__PixelWidth, px.w)) return Na__LeAssets__ToPngDataUrl(await Na__LeAssets__Load(slot.Asset__Path));
        const state = live || { img : document.createElement('img'), key : null, px : null, dataUrl : null, inFlight : false };
        await Na__LeVp3d__RenderNow(state, sheet, viewport, scene, key, profile);   // <-- Export size; the stored asset is refreshed with it
        return state.dataUrl ? Na__LeAssets__ToPngDataUrl(state.dataUrl) : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Viewport 3D API
    // ------------------------------------------------------------
    export {
        Na__LeVp3d__Fingerprint,
        Na__LeVp3d__RestampForScene,
        Na__LeVp3d__Fill,
        Na__LeVp3d__Release,
        Na__LeVp3d__SetInteracting,
        Na__LeVp3d__RenderForExport,
        Na__LeVp3d__Bake
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
