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
// - ZOOM AND THE WINDOW (1.6.0). The picture's paper size is Viewport__ImageMm
//   times Viewport__ImageZoom (Na__LayoutEditor__Viewport3dZoom__). While the
//   picture and the frame are the same rectangle - every viewport never
//   zoomed, slid or cropped - the whole picture renders exactly as before,
//   under the same key. Once they differ only what the frame shows is
//   rendered: a window onto the camera's picture plane (the tiled renderer's
//   viewWindow) at the frame's own size. Zoomed in, the frame stays sharp;
//   zoomed out or slid, the scene fills the frame instead of a picture
//   floating in white. The window joins the fingerprint, and the picture on
//   screen is placed by the window it was rendered for, so a zoom or a slide
//   shows at once and the sharp render replaces it when the input rests.
//
// INTEGRATION:
// - The sheet surface calls Fill for every visible 3D frame; the PDF
//   exporter asks for the picture at export resolution, and puts it at
//   ExportRectMm.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__Viewport3d__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : adapted
// - Divergences   : Console prefix, header and folder numbers, and 1.5.0 (Model Source):
//                   the design phase in the fingerprint and the render. ValeVision has no
//                   model groups, so its copy draws the live model only. The zoom window of
//                   1.6.0 is authored here first, PENDING to ValeVision3D on Adam's sign-off.
// - Back-port     : n/a (this IS the back-port); 1.4.0 ported 13-Sep-2026 as ValeVision3D v2.28.0;
//                   1.5.1 ported 13-Sep-2026 as ValeVision3D v2.31.1 (its 1.4.1)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.8.0 (TrueVision)
// - Draft mode (K, Na__LayoutEditor__DraftMode__). A 3D viewport is a picture
//   and nothing else, so in Draft it books, renders and uploads nothing: Fill
//   returns before any key is compared, the debounced scheduler drops a timer
//   that fires while Draft is on, and the render queue's stillWanted skips a
//   queued render the moment Draft goes on. The picture held is kept, so
//   switching Draft off shows it at once. The draft stylesheet hides the image
//   and outlines the frame. ForceRender, the bake and the PDF are unchanged.
//
// 18-Sep-2026 - Version 1.7.0 (TrueVision)
// - The viewport cache. Park lifts a viewport's state out of the map while its
//   sheet is off screen and Restore puts it back (the sheet surface keeps it
//   beside the sheet's detached frames), so coming back to a sheet finds the
//   picture and its key as they were and renders nothing. A parked state books
//   no render, and one still queued for it is skipped (Render3d's stillWanted).
// - THE PDF ALWAYS RENDERS. RenderForExport no longer hands back a picture that
//   is already on screen or already stored, however large: whenever the
//   renderer is there it renders afresh at the export level, so no cache of any
//   kind can stand between the model and the printed page. The web build, which
//   has no renderer, still places the stored picture - that is all it has.
// - Viewport ids repeat on every sheet, and the state map is keyed by them. The
//   bake, the export and the scene rename looked a state up by id alone and
//   could be handed the frame of the SAME id on the sheet on screen, then paint
//   another sheet's picture into it. LiveState checks the sheet as well.
//
// 14-Sep-2026 - Version 1.6.0 (TrueVision)
// - Zoom. The picture is drawn at Viewport__ImageMm times Viewport__ImageZoom.
//   A frame that is not the whole picture renders only the window it shows,
//   at the frame's size, through the tiled renderer's new viewWindow: sharp at
//   any zoom, and full of scene when zoomed out or slid. The window joins the
//   fingerprint only when the frame is not the whole picture, so an untouched
//   viewport keys and renders exactly as before. The image element is placed
//   by the window its picture was rendered for (Place), so the frame follows a
//   zoom at once. ExportRectMm tells the PDF where the picture goes.
//
// 13-Sep-2026 - Version 1.5.1
// - A refused snapshot upload no longer stamps the record. Na__LeAssets__Upload hands
//   back the upload's result object whether or not R2 took the file, and RenderNow
//   treated any result as success, so Viewport__SnapshotAsset could name a path R2
//   never received. The stamp now needs r2Success === true. RenderNow returns whether
//   the picture was stored and referenced, and Bake counts that instead of reading the
//   record afterwards, which a same-key record from before already satisfied.
//
// 13-Sep-2026 - Version 1.5.0 (TrueVision)
// - Model Source. The fingerprint takes the model fingerprint of the viewport's
//   design phase and the snapshot renders that phase; the fingerprint is null
//   while the phase loads and the frame says so. A picture of one phase is never
//   shown for another. A viewport of the live phase keys exactly as before, so
//   every stored snapshot keeps its key.
//
// 13-Sep-2026 - Version 1.4.0
// - The snapshot draws the model's own edges at the viewport's Base Image weight; a weight that has been set joins the fingerprint.
//
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
    import { Na__LeCfg__GetLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__GetSheets, Na__LeModel__GetViewports, Na__LeModel__ResolveViewportSource, Na__LeModel__UpdateViewport } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSnap__Render3d, Na__LeSnap__IsReady, Na__LeSnap__GetModelFingerprint } from '../25__System__RenderStyles/Na__LayoutEditor__SnapshotRenderer__.js';
    import { Na__LeModelLayers__Token } from '../25__System__RenderStyles/Na__LayoutEditor__ModelLayers__.js';
    import { Na__LeSource__Resolve, Na__LeSource__Ensure, Na__LeSource__WaitFor, Na__LeSource__StatusText } from './Na__LayoutEditor__ModelSource__.js';
    import { Na__LeComposite__Weight, Na__LeComposite__RasterToken } from '../25__System__RenderStyles/Na__LayoutEditor__RenderComposites__.js';
    import { Na__LeRaster__Working, Na__LeRaster__Export, Na__LeRaster__Fit } from './Na__LayoutEditor__RasterQuality__.js';
    import { Na__LeDraft__IsOn } from '../26__System__DraftMode/Na__LayoutEditor__DraftMode__State__.js';
    import {
        Na__LeAssets__CanvasToBlob,
        Na__LeAssets__BlobToDataUrl,
        Na__LeAssets__ToPngDataUrl,
        Na__LeAssets__SnapshotPath,
        Na__LeAssets__CanUpload,
        Na__LeAssets__Upload,
        Na__LeAssets__Load
    } from '../07__Core__SheetData/Na__LayoutEditor__Assets__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Debounce, Re-render Threshold and the Whole Picture
    // ------------------------------------------------------------
    const Na__LeVp3d__RENDER_DELAY_MS = 400;
    const Na__LeVp3d__GROWTH_RATIO    = 1.1;   // <-- A picture more than a tenth short of the size asked for (a bigger frame, a higher raster level) renders again
    const Na__LeVp3d__WINDOW_TOL_MM   = 0.01;  // <-- A picture within this of its frame on every edge IS its frame: rendered whole, under its old key
    const Na__LeVp3d__WHOLE_PICTURE   = Object.freeze({ u0 : 0, v0 : 0, u1 : 1, v1 : 1 });
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
    // null while the viewport's design phase is not loaded: there is no model
    // to describe yet, so nothing can be compared, fetched or rendered.
    // ------------------------------------------------------------
    function Na__LeVp3d__Fingerprint(viewport, scene) {
        const modelFp = Na__LeSnap__GetModelFingerprint(Na__LeSource__Resolve(viewport).renderId);
        if (modelFp === null) return null;
        const parts = [
            scene.PresentationMode__Scene__Id, scene.PresentationMode__Scene__Name,
            JSON.stringify(scene.PresentationMode__Scene__CameraPosition || null),
            JSON.stringify(scene.PresentationMode__Scene__OrbitHelperCubePosition || null),
            JSON.stringify(scene.PresentationMode__Scene__ModelLayerVisibility || null),
            JSON.stringify(viewport.Viewport__Styles),
            Na__LeModelLayers__Token(viewport),
            Math.round((viewport.Viewport__ImageMm.WidthMm / viewport.Viewport__ImageMm.HeightMm) * 1000),
            modelFp
        ];
        const weights = Na__LeComposite__RasterToken(viewport, true);
        if (weights) parts.push(weights);                                         // <-- Only when set, so every stored snapshot keeps its key
        const framing = Na__LeVp3d__WindowToken(viewport);
        if (framing) parts.push(framing);                                         // <-- Only when the frame shows a window of the picture, for the same reason
        return Na__LeVp3d__Hash(parts.join('|'));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Fingerprint, Once the Viewport's Design Phase Is In
    // ------------------------------------------------------------
    // For the callers that must finish - a forced render, a bake, a PDF - rather
    // than show a frame that says it is loading. null when the phase cannot load.
    // ------------------------------------------------------------
    async function Na__LeVp3d__FingerprintWhenReady(viewport, scene) {
        const key = Na__LeVp3d__Fingerprint(viewport, scene);
        if (key !== null) return key;
        return (await Na__LeSource__WaitFor(Na__LeSource__Resolve(viewport).renderId)) ? Na__LeVp3d__Fingerprint(viewport, scene) : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Zoom the Picture Is Drawn At (1 when never zoomed)
    // ------------------------------------------------------------
    // Read straight off the record: Na__LayoutEditor__Viewport3dZoom__ writes it
    // and the sheet records clamp it.
    // ------------------------------------------------------------
    function Na__LeVp3d__Zoom(viewport) {
        const zoom = viewport.Viewport__ImageZoom;
        return (typeof zoom === 'number' && Number.isFinite(zoom) && zoom > 0) ? zoom : 1;
    }
    // ------------------------------------------------------------


    // FUNCTION | Where the Whole Picture Lies, in Millimetres From the Frame's Top-Left
    // ------------------------------------------------------------
    function Na__LeVp3d__PictureRect(viewport) {
        const zoom = Na__LeVp3d__Zoom(viewport);
        return {
            X        : viewport.Viewport__ImageOffsetMm.X,
            Y        : viewport.Viewport__ImageOffsetMm.Y,
            WidthMm  : viewport.Viewport__ImageMm.WidthMm  * zoom,
            HeightMm : viewport.Viewport__ImageMm.HeightMm * zoom
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What the Frame Shows of the Picture, or Null When It Shows All of It
    // ------------------------------------------------------------
    // { u0, v0, u1, v1 } as fractions of the picture - left, top, right and
    // bottom. Any of them may run past 0..1, where the frame reaches beyond the
    // picture. Null while the picture and the frame are one rectangle - every
    // viewport never zoomed, slid or cropped - which renders the whole picture
    // exactly as it always has.
    // ------------------------------------------------------------
    function Na__LeVp3d__Window(viewport) {
        const picture = Na__LeVp3d__PictureRect(viewport);
        const frame   = viewport.Viewport__FrameMm;
        const tol     = Na__LeVp3d__WINDOW_TOL_MM;
        if (!(picture.WidthMm > 0) || !(picture.HeightMm > 0)) return null;
        if (Math.abs(picture.X) <= tol && Math.abs(picture.Y) <= tol &&
            Math.abs(picture.WidthMm - frame.WidthMm) <= tol && Math.abs(picture.HeightMm - frame.HeightMm) <= tol) return null;
        return {
            u0 : -picture.X / picture.WidthMm,
            v0 : -picture.Y / picture.HeightMm,
            u1 : (frame.WidthMm  - picture.X) / picture.WidthMm,
            v1 : (frame.HeightMm - picture.Y) / picture.HeightMm
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Window as a Fingerprint Part, or Null
    // ------------------------------------------------------------
    // Rounded to a ten-thousandth of the picture, finer than anything a pointer
    // or a typed zoom tells apart on the paper.
    // ------------------------------------------------------------
    function Na__LeVp3d__WindowToken(viewport) {
        const view = Na__LeVp3d__Window(viewport);
        if (!view) return null;
        const r = (value) => Math.round(value * 10000) / 10000;
        return 'window:' + [ r(view.u0), r(view.v0), r(view.u1), r(view.v1) ].join(',');
    }
    // ------------------------------------------------------------


    // FUNCTION | The Rectangle a Render Covers, in Millimetres From the Frame's Top-Left
    // ------------------------------------------------------------
    // The whole picture while the frame shows all of it; the frame itself once
    // it shows a window. The PDF puts the exported picture here.
    // ------------------------------------------------------------
    function Na__LeVp3d__ExportRectMm(viewport) {
        if (!Na__LeVp3d__Window(viewport)) return Na__LeVp3d__PictureRect(viewport);
        return { X : 0, Y : 0, WidthMm : viewport.Viewport__FrameMm.WidthMm, HeightMm : viewport.Viewport__FrameMm.HeightMm };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Pixel Size for What Is Rendered
    // ------------------------------------------------------------
    function Na__LeVp3d__PixelSize(viewport, profile) {
        const rect = Na__LeVp3d__ExportRectMm(viewport);
        return Na__LeRaster__Fit(rect.WidthMm, rect.HeightMm, profile);
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
        state = { body : body, img : img, empty : empty, key : null, px : null, dataUrl : null, win : null, triedAsset : null, timer : null, inFlight : false, parked : false, lastArgs : null };   // <-- win: the window the picture held was rendered for; null is the whole picture
        Na__LeVp3d__States.set(viewportId, state);
        return state;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The State of a Viewport on the Sheet on Screen, or Null
    // ------------------------------------------------------------
    // The map is keyed by viewport id and every sheet numbers its viewports
    // from one, so an id alone can name the frame of ANOTHER sheet - the one on
    // screen - when the caller is walking the whole set (a bake, a PDF, a scene
    // rename). Only a state last filled for this very sheet is this viewport's.
    // ------------------------------------------------------------
    function Na__LeVp3d__LiveState(sheet, viewportId) {
        const state = Na__LeVp3d__States.get(viewportId);
        if (!state || !state.lastArgs || !state.lastArgs.sheet || !sheet) return null;
        return state.lastArgs.sheet.Sheet__Id === sheet.Sheet__Id ? state : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put the Picture Held Where It Belongs in the Frame as It Stands
    // ------------------------------------------------------------
    // The image element covers the window its picture was rendered for, mapped
    // through the picture's CURRENT rectangle. A zoom or a slide therefore moves
    // and scales the picture already on screen at once; the stretch only shows
    // until the render for the new window lands. For the whole picture this is
    // the picture's own rectangle, as it always was. A state with no frame on
    // screen (a bake, an export) has nothing to place.
    // ------------------------------------------------------------
    function Na__LeVp3d__Place(state) {
        const args = state ? state.lastArgs : null;
        if (!args || !args.viewport || !state.img) return;
        const picture = Na__LeVp3d__PictureRect(args.viewport);
        const view    = state.win || Na__LeVp3d__WHOLE_PICTURE;
        state.img.style.left   = ((picture.X + (view.u0 * picture.WidthMm))  * args.ppm) + 'px';
        state.img.style.top    = ((picture.Y + (view.v0 * picture.HeightMm)) * args.ppm) + 'px';
        state.img.style.width  = ((view.u1 - view.u0) * picture.WidthMm  * args.ppm) + 'px';
        state.img.style.height = ((view.v1 - view.v0) * picture.HeightMm * args.ppm) + 'px';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Render, Show, and on Localhost Upload and Reference
    // ------------------------------------------------------------
    // profile: { pixelsPerMm, maxPixels }. Every render is uploaded with the
    // width it was made at, so the record always describes the stored file
    // and a later request can tell whether it is big enough.
    //
    // Returns true only when R2 took the picture and the record now names it.
    // A refused upload still hands back a result object - TrueVision's upload
    // returns r2Success false where ValeVision's throws - so only r2Success may
    // stamp the record. The picture stays on screen either way.
    //
    // stillWanted: optional, handed to the render queue. Only the debounced
    // screen render passes it; a forced render, a bake and the PDF always draw.
    // ------------------------------------------------------------
    async function Na__LeVp3d__RenderNow(state, sheet, viewport, scene, key, profile, stillWanted) {
        const px = Na__LeVp3d__PixelSize(viewport, profile);
        const view = Na__LeVp3d__Window(viewport);                                 // <-- What the frame shows of the picture (null: all of it), read with the key, before the wait
        const renderId = Na__LeSource__Resolve(viewport).renderId;                 // <-- The design phase drawn; null is the live model
        state.inFlight = true;
        state.renderOk = false;                                                    // <-- True once THIS render's picture is held; the PDF reads it
        try {
            const weights = {
                modelEdgePx : Na__LeComposite__Weight(viewport, 'baseImage'),          // <-- How thick the model's own edges draw in the picture
                enhancePct  : Na__LeComposite__Weight(viewport, 'enhanceWhitecard')    // <-- How much of the Enhance Whitecard post pass to apply
            };
            const result = await Na__LeSnap__Render3d(scene, viewport.Viewport__Styles, px.w, px.h, viewport.Viewport__ModelLayers, px.samples, weights, renderId, view, stillWanted);
            if (!result) return false;
            const blob    = await Na__LeAssets__CanvasToBlob(result.canvas, 'image/webp', 0.9);
            const dataUrl = blob ? await Na__LeAssets__BlobToDataUrl(blob) : result.canvas.toDataURL('image/png');
            if (!dataUrl) return false;
            state.img.src = dataUrl; state.img.hidden = false;
            state.key = key; state.px = px; state.dataUrl = dataUrl; state.modelFp = Na__LeSnap__GetModelFingerprint(renderId);
            state.win = view;
            state.renderOk = true;
            Na__LeVp3d__Place(state);                                              // <-- Where this picture belongs in the frame as it stands now
            if (blob && sheet && Na__LeAssets__CanUpload()) {
                const path = Na__LeAssets__SnapshotPath(sheet.Sheet__Id, viewport.Viewport__Id, key);
                const uploaded = await Na__LeAssets__Upload(blob, path, null);
                if (uploaded && uploaded.r2Success === true) {                        // <-- Never name a file R2 did not take: the web build would ask for it and draw nothing
                    return Na__LeModel__UpdateViewport(sheet, viewport.Viewport__Id, { snapshotAsset : { Asset__Path : path, Asset__Fingerprint : key, Asset__PixelWidth : px.w, Asset__Samples : px.samples } }, true);
                }
            }
            return false;
        } finally {
            state.inFlight = false;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Try the Stored Asset, Else Render (debounced)
    // ------------------------------------------------------------
    function Na__LeVp3d__Schedule(state, viewportId) {
        if (state.timer) window.clearTimeout(state.timer);
        state.timer = null;
        if (state.parked) return;                                                 // <-- Its sheet is not on screen: Fill books the render when it is shown again
        state.timer = window.setTimeout(async () => {
            state.timer = null;
            // NOT NOW MEANS LATER. See the note on the 2D scheduler: returning
            // here dropped the render outright and left the frame showing a
            // snapshot of a pose or a frame it no longer had.
            if (!state.lastArgs) return;
            if (Na__LeDraft__IsOn()) return;                                      // <-- Draft draws no picture, so renders and uploads none; Fill books it again when Draft goes off
            if (Na__LeVp3d__Interacting || state.inFlight) { Na__LeVp3d__Schedule(state, viewportId); return; }
            const { sheet, viewport } = state.lastArgs;
            const scene = Na__LeModel__ResolveViewportSource(viewport).scene;
            if (!scene) return;
            const key     = Na__LeVp3d__Fingerprint(viewport, scene);
            if (key === null) return;                                             // <-- Its design phase is not in: the load's refresh schedules again
            if (state.key === key) return;
            const profile = Na__LeRaster__Working();                              // <-- The global working level
            const wanted  = Na__LeVp3d__PixelSize(viewport, profile);
            const slot    = viewport.Viewport__SnapshotAsset;
            // The stored picture is only worth fetching when it is the same
            // view and was rendered at least as large as this level asks for.
            if (slot && slot.Asset__Fingerprint === key && Na__LeVp3d__WideEnough(slot.Asset__PixelWidth, wanted.w) && state.triedAsset !== key) {
                const view = Na__LeVp3d__Window(viewport);                         // <-- The window this key names, read before the wait
                state.triedAsset = key;
                state.inFlight = true;
                const dataUrl = await Na__LeAssets__Load(slot.Asset__Path);
                state.inFlight = false;
                if (!state.parked && Na__LeVp3d__States.get(viewportId) !== state) return;   // <-- Released. A parked state keeps the picture it was already fetching
                if (dataUrl) {
                    state.img.src = dataUrl; state.img.hidden = false;
                    state.key = key; state.dataUrl = dataUrl; state.px = { w : slot.Asset__PixelWidth, h : Math.round(slot.Asset__PixelWidth * (wanted.h / wanted.w)), samples : slot.Asset__Samples };
                    state.modelFp = Na__LeSnap__GetModelFingerprint(Na__LeSource__Resolve(viewport).renderId);
                    state.win = view;
                    Na__LeVp3d__Place(state);
                    return;
                }
            }
            if (!Na__LeSnap__IsReady()) return;
            if (state.parked) return;                                             // <-- Left while the stored picture was looked for
            await Na__LeVp3d__RenderNow(state, sheet, viewport, scene, key, profile, () => !state.parked && !Na__LeDraft__IsOn());   // <-- Still queued when its sheet is left, or when Draft goes on: skipped
        }, Na__LeVp3d__RENDER_DELAY_MS);
    }
    // ------------------------------------------------------------


    // FUNCTION | Fill (or Refresh) the Body of a 3D Frame
    // ------------------------------------------------------------
    function Na__LeVp3d__Fill(body, sheet, viewport, ppm) {
        const state = Na__LeVp3d__State(body, viewport.Viewport__Id);
        state.lastArgs = { sheet : sheet, viewport : viewport, ppm : ppm };
        const scene = Na__LeModel__ResolveViewportSource(viewport).scene;

        Na__LeVp3d__Place(state);                                                  // <-- A zoom, a slide or a crop shows at once on the picture held; the render for it follows

        if (!scene) {
            state.empty.textContent = Na__LeCfg__GetLabel('NoSceneLinked', 'No scene linked to this viewport.');
            state.empty.hidden = false; state.img.hidden = true; state.key = null;
            return;
        }
        // DRAFT MODE | A 3D viewport is a picture and nothing else, and Draft
        // draws no pictures: nothing is booked, rendered or uploaded, and the
        // picture held stays in the state (the draft stylesheet hides it and
        // outlines the frame), so switching Draft off shows it at once - or, if
        // it went stale meanwhile, books its render through the rest of Fill.
        if (Na__LeDraft__IsOn()) {
            if (state.timer) { window.clearTimeout(state.timer); state.timer = null; }
            state.empty.hidden = true;
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
        // DESIGN PHASE NOT IN YET | The frame says so, and shows no picture of the
        // model it drew before; the library's event refreshes it when it is in.
        const source  = Na__LeSource__Resolve(viewport);
        const modelFp = Na__LeSnap__GetModelFingerprint(source.renderId);
        if (modelFp === null) {
            Na__LeSource__Ensure(source);
            if (state.timer) { window.clearTimeout(state.timer); state.timer = null; }
            state.img.hidden = true; state.key = null;
            state.empty.textContent = Na__LeSource__StatusText(source); state.empty.hidden = false;
            return;
        }
        const samePhase = !state.modelFp || state.modelFp === modelFp;
        if (!samePhase) state.img.hidden = true;                                   // <-- One phase's picture never stands in for another's
        else if (state.dataUrl && state.img.hidden) state.img.hidden = false;      // <-- Back on: the picture it already has
        const key = Na__LeVp3d__Fingerprint(viewport, scene);
        if (state.key === key) {
            const wanted = Na__LeVp3d__PixelSize(viewport, Na__LeRaster__Working());
            if (state.px && wanted.w > state.px.w * Na__LeVp3d__GROWTH_RATIO && Na__LeSnap__IsReady()) { state.key = null; Na__LeVp3d__Schedule(state, viewport.Viewport__Id); }
            return;
        }
        Na__LeVp3d__Schedule(state, viewport.Viewport__Id);
    }
    // ------------------------------------------------------------


    // FUNCTION | Throw Away the Stored Snapshot and Render This Viewport Again
    // ------------------------------------------------------------
    // Goes straight to the renderer: the saved asset is what a forced render
    // is trying to get past, so it is neither read nor trusted here. The new
    // picture is uploaded in its place by RenderNow as usual.
    // ------------------------------------------------------------
    async function Na__LeVp3d__ForceRender(sheet, viewport) {
        const state = Na__LeVp3d__States.get(viewport.Viewport__Id);
        if (!state || !state.lastArgs) return false;                             // <-- Never painted: the next refresh draws it anyway
        const scene = Na__LeModel__ResolveViewportSource(viewport).scene;
        if (!scene) return false;
        if (state.timer) { window.clearTimeout(state.timer); state.timer = null; }
        state.key = null; state.triedAsset = null;                                // <-- Nothing on screen is trusted from here
        const key = await Na__LeVp3d__FingerprintWhenReady(viewport, scene);
        if (key === null) return false;                                           // <-- Its design phase could not be loaded
        await Na__LeVp3d__RenderNow(state, sheet, viewport, scene, key, Na__LeRaster__Working());
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Drop a Viewport's State
    // ------------------------------------------------------------
    // body, when given, is the frame body being let go: viewport ids repeat on
    // every sheet, so a state held for another sheet's frame is left alone.
    // ------------------------------------------------------------
    function Na__LeVp3d__Release(viewportId, body) {
        const state = Na__LeVp3d__States.get(viewportId);
        if (!state || (body && state.body !== body)) return;
        if (state.timer) window.clearTimeout(state.timer);
        Na__LeVp3d__States.delete(viewportId);
    }
    // ------------------------------------------------------------


    // FUNCTION | Lift a Viewport's State Out While Its Sheet Is Off Screen, and Put It Back
    // ------------------------------------------------------------
    // The sheet surface's viewport cache: see the same pair in the 2D Frame
    // unit. The state goes to the surface whole - picture, key, pixel size -
    // and comes back before Fill runs, which then finds the key it already has.
    // ------------------------------------------------------------
    function Na__LeVp3d__Park(viewportId, body) {
        const state = Na__LeVp3d__States.get(viewportId);
        if (!state || (body && state.body !== body)) return null;
        if (state.timer) { window.clearTimeout(state.timer); state.timer = null; }
        state.parked = true;
        Na__LeVp3d__States.delete(viewportId);
        return state;
    }
    function Na__LeVp3d__Restore(viewportId, state) {
        if (!state) return;
        state.parked = false;
        Na__LeVp3d__States.set(viewportId, state);
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
                if (key === null) return;                                            // <-- Its design phase is not loaded: nothing to compare with
                if (slot.Asset__Fingerprint === key) return;                         // <-- Already current

                Na__LeModel__UpdateViewport(sheet, viewport.Viewport__Id, {
                    snapshotAsset : { Asset__Path : slot.Asset__Path, Asset__Fingerprint : key }
                }, true);                                                            // <-- Silent: the rename saves once, at the end

                // LIVE FRAME | What is on screen is the picture the new key
                // describes, so carry its state across rather than let the
                // frame re-fetch the image it is already showing.
                const state = Na__LeVp3d__LiveState(sheet, viewport.Viewport__Id);   // <-- This sheet's frame, not the same id on the sheet on screen
                if (state && state.key) { state.key = key; state.triedAsset = key; }

                restamped++;
            });
        });

        return restamped;
    }
    // ------------------------------------------------------------


    // FUNCTION | Render and Upload One 3D Viewport Without a Frame on Screen (Dev bake)
    // ------------------------------------------------------------
    // Returns 'baked' | 'skipped' (already referenced) | 'failed' (not rendered,
    // or R2 did not take the picture).
    // ------------------------------------------------------------
    async function Na__LeVp3d__Bake(sheet, viewport, force) {
        const scene = Na__LeModel__ResolveViewportSource(viewport).scene;
        if (!scene || !Na__LeSnap__IsReady()) return 'failed';
        const key     = await Na__LeVp3d__FingerprintWhenReady(viewport, scene);
        if (key === null) return 'failed';                                         // <-- Its design phase could not be loaded
        const wanted  = Na__LeVp3d__PixelSize(viewport, Na__LeVp3d__ExportProfile());
        const slot    = viewport.Viewport__SnapshotAsset;
        if (!force && slot && slot.Asset__Fingerprint === key && Na__LeVp3d__WideEnough(slot.Asset__PixelWidth, wanted.w)) return 'skipped';
        const state = { img : document.createElement('img'), key : null, px : null, dataUrl : null, inFlight : false };
        const stored = await Na__LeVp3d__RenderNow(state, sheet, viewport, scene, key, Na__LeVp3d__ExportProfile());
        const live = Na__LeVp3d__LiveState(sheet, viewport.Viewport__Id);
        if (live && state.dataUrl) { live.img.src = state.dataUrl; live.img.hidden = false; live.key = key; live.px = state.px; live.dataUrl = state.dataUrl; live.modelFp = state.modelFp; live.win = state.win; Na__LeVp3d__Place(live); }
        return stored ? 'baked' : 'failed';                                        // <-- This render's upload, not the record: a same-key record from before read as baked
    }
    // ------------------------------------------------------------


    // FUNCTION | The Picture for the PDF (png data URL at export resolution)
    // ------------------------------------------------------------
    async function Na__LeVp3d__RenderForExport(sheet, viewport) {
        const scene = Na__LeModel__ResolveViewportSource(viewport).scene;
        if (!scene) return null;
        if (viewport.Viewport__Styles.baseImage === false) return null;           // <-- An empty frame prints empty
        const key     = await Na__LeVp3d__FingerprintWhenReady(viewport, scene);
        if (key === null) return null;                                            // <-- Its design phase could not be loaded
        const profile = Na__LeVp3d__ExportProfile();
        const live    = Na__LeVp3d__LiveState(sheet, viewport.Viewport__Id);
        const slot = viewport.Viewport__SnapshotAsset;
        const stored = slot && slot.Asset__Fingerprint === key;
        if (!Na__LeSnap__IsReady()) return stored ? Na__LeAssets__ToPngDataUrl(await Na__LeAssets__Load(slot.Asset__Path)) : null;   // <-- The web build has only the stored picture
        // THE RENDERER ALWAYS RUNS FOR THE PDF. Until 1.7.0 a picture already on
        // screen, or already stored, was handed back when it was wide enough and
        // sampled enough. The fingerprint that decided "same picture" is a short
        // hash over category names and triangle counts, which is good enough to
        // save the screen a render and not good enough to vouch for a printed
        // page. Every cache in the editor is for the screen; the PDF draws from
        // the model, at the export level, every time.
        const state = live || { img : document.createElement('img'), key : null, px : null, dataUrl : null, inFlight : false };
        await Na__LeVp3d__RenderNow(state, sheet, viewport, scene, key, profile);   // <-- Export size; the stored asset is refreshed with it
        if (!state.renderOk || !state.dataUrl) return null;                           // <-- The render failed: the screen's working picture is never printed in its place
        return Na__LeAssets__ToPngDataUrl(state.dataUrl);
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
        Na__LeVp3d__PictureRect,
        Na__LeVp3d__ExportRectMm,
        Na__LeVp3d__RestampForScene,
        Na__LeVp3d__Fill,
        Na__LeVp3d__Release,
        Na__LeVp3d__Park,
        Na__LeVp3d__Restore,
        Na__LeVp3d__SetInteracting,
        Na__LeVp3d__RenderForExport,
        Na__LeVp3d__ForceRender,
        Na__LeVp3d__Bake
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
