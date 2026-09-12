// =============================================================================
// TRUEVISION3D - IMAGE EXPORT - STATIC EXPORT TILED RENDERER
// =============================================================================
//
// FILE       : Na__ImageExport__StaticExport__TiledRenderer.js
// NAMESPACE  : Na__StaticExport
// MODULE     : Image Export - Static Export Tiled Renderer
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Render the scene to a canvas at any requested size, supersampled,
//              tiled so GPU memory stays flat however large the output
// CREATED    : 10-Sep-2026
//
// DESCRIPTION:
// - One entry point, RenderToCanvas, used by the Layout Editor to bake a sheet
//   viewport and by the still image exporter. Never allocates a WebGL
//   framebuffer larger than roughly one viewport: the output is drawn as a grid
//   of tiles, each an exact sub-frustum set with camera.setViewOffset, copied
//   into one large 2D canvas.
// - TILES ALWAYS, EVEN WHEN ONE WOULD FIT. The gutter is the reason. Every
//   screen-space effect in the app reads its neighbours - the profile-line
//   Sobel, the AO blur, FXAA - so a tile edge without overscan samples a
//   clamped buffer boundary instead of the geometry really there, and the joins
//   print as hairlines. One tile with a gutter costs 64 px of overscan and
//   gives the image border real neighbours too.
//
// SUPERSAMPLING:
// - antiAliasSamples renders each TILE 2, 4, 8 or 16 times with sub-pixel
//   projection jitter and averages the results, so a shallow eaves or glazing
//   bar resolves into a true gradient instead of a staircase. The whole
//   argument is in Na__RenderEffect__Supersampler__.js.
// - The memory picture is the reason this belongs here rather than anywhere
//   else: the accumulation buffer is ONE TILE, not one image. An 8000 px export
//   gains about one 2112 px square half-float buffer, a few tens of megabytes,
//   whatever the output size. The technique adds essentially nothing to the
//   peak memory, which is the exact constraint that shaped this exporter.
// - The cost is real and linear: sixteen samples is sixteen times the tile
//   renders. For a still that is seconds on a job the user already waits for.
// - Shadow maps are drawn with the first sample of each tile and reused by the
//   rest. The lights and the geometry are frozen and only the view camera is
//   nudged, so every later shadow pass would redraw identical maps.
//
// THE TWO FRAME ROUTES:
// - CALLBACK ROUTE (a 2D drawing, DIV-1). The caller passes renderFrame and
//   this module never decides how a frame is drawn - which is what keeps a
//   baked sheet identical to the screen. TrueVision draws a drawing flat, with
//   the silhouette Sobel and the cut fills as overlays, deliberately bypassing
//   the composer: routing a parallel drawing through fog and SSAO shades it
//   like a surface, which is exactly what a drawing must not look like.
// - COMPOSER ROUTE (a 3D view). With no renderFrame and a pipeline that has a
//   composer, tiles run the live loop's own per-frame sequence - AO uniforms,
//   depth pre-pass, profile normals, composer - so a baked 3D viewport matches
//   what the user was looking at. WITHOUT THIS THE 3D SNAPSHOT WAS A BARE
//   renderer.render: no profile lines, no ambient occlusion, no fog, and a
//   different colour transfer from the live view. That was the weak link under
//   every sheet viewport.
//
// INTEGRATION:
// - Na__LayoutEditor__SnapshotRenderer__ calls this for both viewport kinds.
// - Na__UiFeature__ImageExport__Controls calls it for custom-size exports.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 30__System__ImageExport/Na__ImageExport__StaticExport__TiledRenderer.js 1.2.0
// - Ported on     : 12-Sep-2026 for TrueVision3D v2.25.0
// - Parity        : diverged (identical tile plan, gutter, sub-frustum and restore discipline)
// - Divergences   : (1) The callback route. ValeVision routes every tile through its
//                       EffectComposer because its drawings live in the composer; TrueVision's
//                       do not (DIV-1), so a caller may hand over the whole frame routine.
//                   (2) No linework export scales. TrueVision has no LineworkSettings state
//                       module; drawing edge weight is fixed by the render preset on purpose.
//                   (3) No vertical perspective correction hook - TrueVision has no such tool.
//                   (4) Supersampling is per tile here; in ValeVision it is per video frame.
// - Back-port     : the supersampling is worth carrying back; the callback route is not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 12-Sep-2026 - Version 2.0.0
// - Rebuilt on ValeVision's design: shared tile plan, gutter overscan, canvas
//   probe, context-loss guard, and the composer route for 3D.
// - Supersampled anti-aliasing per tile.
// - THE PROFILE-LINE BUFFERS ARE RESIZED TO THE TILE. They never were, so the
//   silhouette Sobel ran at viewport resolution and was stretched across a
//   4000 px sheet. That was most of the blur people were seeing.
//
// 10-Sep-2026 - Version 1.0.0
// - Initial implementation for the Layout Editor port.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js Utilities
    // ------------------------------------------------------------
    import * as THREE from 'three';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Shared Tile Plan
    // @delegate: ./Na__ImageExport__StaticExport__TilePlan__.js
    // ------------------------------------------------------------
    import {
        Na__TilePlan__Build,
        Na__TilePlan__ClampToDeviceLimits,
        Na__TilePlan__ProbeCanvas,
        Na__TilePlan__IsIosDevice
    } from './Na__ImageExport__StaticExport__TilePlan__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Hidden-Tab-Safe Async Yield
    // ------------------------------------------------------------
    import { Na__ExportYield__NextPaint } from './Na__ImageExport__AsyncYield__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Render Loop Invalidation
    // ------------------------------------------------------------
    import { Na__RenderLoop__RequestRender } from '../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Supersampled Anti-Aliasing
    // @delegate: ../05__RenderPipeline/Na__RenderEffect__Supersampler__.js
    // ------------------------------------------------------------
    import {
        Na__Supersampler__Create,
        Na__Supersampler__ResolveSampleCount
    } from '../05__RenderPipeline/Na__RenderEffect__Supersampler__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Fog Uniform Sync (Per Tile and Per Sample)
    // ------------------------------------------------------------
    import { Na__Scene__UpdateFogPassUniforms } from '../07__Scene__EnvironmentEffects/Na__Scene__DefaultFogEffect.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Drawing Silhouette Buffers and Section Fat Lines
    // ------------------------------------------------------------
    // Both are sized in pixels and both must follow the tile, or the drawing
    // route inks its outline at viewport resolution and stretches it.
    // ------------------------------------------------------------
    import { Na__DrawProfile__HandleResize } from '../40__System__DrawingViewCore/Na__DrawView__ProfileLines__.js';
    import { Na__SectionCut__HandleResize, Na__SectionCut__RenderOverlay } from '../41__System__SectionCutEngine/Na__SectionCut__Engine__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Pipeline Resolution
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Resolve the Render Pipeline State Surface
    // ------------------------------------------------------------
    // Every key is optional-guarded, because the pipeline is rebuilt on an
    // engine switch and a bake can be in flight across one.
    // ------------------------------------------------------------
    function Na__StaticExport__ResolvePipeline(getRenderPipelineState) {
        const noop  = () => {};
        const empty = {
            composer            : null, profileLinesPass : null, fxaaPass : null, fogPass : null,
            renderProfileNormals: noop, setProfileLinesSize: noop, setFxaaSize: noop,
            setDepthPrePassSize : noop, setAoSize: noop, updateAoUniforms: noop, renderDepthPrePass: noop
        };

        const state = (typeof getRenderPipelineState === 'function') ? getRenderPipelineState() : null;
        if (!state) return empty;

        // BACKWARD COMPAT | A legacy getter may return the composer itself
        if (typeof state.render === 'function' && !state.composer) {
            return Object.assign({}, empty, { composer : state });
        }

        const fn = (candidate) => (typeof candidate === 'function') ? candidate : noop;

        return {
            composer            : state.composer || null,
            profileLinesPass    : state.profileLinesPassRef || null,
            fxaaPass            : state.fxaaPassRef || null,
            fogPass             : state.fogPassRef  || null,
            renderProfileNormals: fn(state.renderProfileNormals),
            setProfileLinesSize : fn(state.setProfileLinesSize),
            setFxaaSize         : fn(state.setFxaaSize),
            setDepthPrePassSize : fn(state.setDepthPrePassSize),
            setAoSize           : fn(state.setAoSize),
            updateAoUniforms    : fn(state.updateAoUniforms),
            renderDepthPrePass  : fn(state.renderDepthPrePass)
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Render
// -----------------------------------------------------------------------------

    // FUNCTION | Render the Scene to a Canvas at a Requested Pixel Size
    // ------------------------------------------------------------
    // options:
    //   renderer, scene, camera        - required
    //   targetWidth, targetHeight      - required, in pixels
    //   renderFrame(camera)            - optional; how to draw ONE frame. The
    //                                    Layout Editor passes the drawing route
    //                                    so a baked sheet matches the screen.
    //                                    Given, it wins: the composer is never
    //                                    consulted.
    //   getRenderPipelineState         - optional; a composer here and no
    //                                    renderFrame takes the COMPOSER ROUTE
    //   antiAliasSamples               - optional; 1 (off), 2, 4, 8 or 16
    //   elevationOverrides             - accepted for ValeVision signature parity
    //   onProgress(fraction, message)  - optional
    //
    // Returns { canvas, width, height, tiled, wasClamped, antiAliasSamples }.
    //
    // EVERY PIECE OF RENDERER STATE THIS TOUCHES IS PUT BACK, including on the
    // error path. This runs against the LIVE renderer that the app is still
    // using; leaving it at export size with a view offset applied would leave
    // the user looking at a corner of their own model.
    // ------------------------------------------------------------
    async function Na__StaticExport__RenderToCanvas(options) {
        const {
            renderer, scene, camera,
            targetWidth, targetHeight,
            renderFrame            = null,
            getRenderPipelineState = null,
            antiAliasSamples       = 1,
            onProgress             = null
        } = (options || {});

        if (!renderer || !scene || !camera) throw new Error('Na__StaticExport__RenderToCanvas: renderer, scene and camera are required');

        const progress    = (typeof onProgress  === 'function') ? onProgress  : () => {};
        const useCallback = (typeof renderFrame === 'function');

        // CLAMP AND ALLOCATE | Fit the platform, then prove the canvas is real
        // ------------------------------------------------------------
        const fit  = Na__TilePlan__ClampToDeviceLimits(targetWidth, targetHeight);
        const outW = fit.width;
        const outH = fit.height;

        const outCanvas  = document.createElement('canvas');
        outCanvas.width  = outW;
        outCanvas.height = outH;
        const outCtx     = outCanvas.getContext('2d');

        if (!outCtx || !Na__TilePlan__ProbeCanvas(outCanvas, outCtx)) {
            throw new Error(`This device cannot create a ${outW}x${outH} image canvas. Try a lower export resolution.`);
        }

        // TILE GRID | The shared plan, so every export path registers alike
        // ------------------------------------------------------------
        const tilePlan = Na__TilePlan__Build({ outWidth : outW, outHeight : outH });
        const gutter   = tilePlan.gutter;
        const fbW      = tilePlan.fbW;
        const fbH      = tilePlan.fbH;

        // ROUTE | The callback wins when it is given; else the composer
        // ------------------------------------------------------------
        const pipeline    = Na__StaticExport__ResolvePipeline(getRenderPipelineState);
        const composer    = useCallback ? null : pipeline.composer;
        const useComposer = Boolean(composer);

        // SUPERSAMPLING | Null at one sample, and every caller treats that as
        // "draw the frame the ordinary way". The composer leaves its frame in a
        // read buffer to be averaged; every other route needs a target of its
        // own to draw into, and the sRGB transfer applied on the way out
        // because three never applies it to a render target.
        // ------------------------------------------------------------
        const samples      = Na__Supersampler__ResolveSampleCount(antiAliasSamples);
        const supersampler = Na__Supersampler__Create({
            renderer,
            width        : fbW,
            height       : fbH,
            samples      : samples,
            sampleTarget : !useComposer,
            encodeSrgb   : !useComposer
        });

        // SAVED STATE | Everything mutated below is restored in finally.
        // The CSS size is read rather than the drawing buffer, because
        // setSize(w, h, false) deliberately leaves the element's CSS alone and
        // restoring a drawing-buffer figure into it would resize the viewport
        // on screen.
        // ------------------------------------------------------------
        const savedSize       = renderer.getSize(new THREE.Vector2());
        const savedPixelRatio = renderer.getPixelRatio();
        const savedAspect     = camera.aspect;
        const shadowMap       = renderer.shadowMap;
        const savedShadowAuto = shadowMap.autoUpdate;

        const fxaaPass         = pipeline.fxaaPass;
        const savedFxaaEnabled = fxaaPass ? fxaaPass.enabled : null;
        const savedToScreen    = composer ? composer.renderToScreen : null;

        // CONTEXT LOSS GUARD | Surface GPU death as a real error, not a blank PNG
        // ------------------------------------------------------------
        let contextLost = false;
        const onContextLost = () => { contextLost = true; };
        renderer.domElement.addEventListener('webglcontextlost', onContextLost);
        const gl = renderer.getContext();

        try {
            // EXPORT SETUP | Renderer and every pixel-sized buffer to tile size
            // ------------------------------------------------------------
            renderer.setPixelRatio(1);                                        // <-- Requested pixels are exact pixels
            renderer.setSize(fbW, fbH, false);                                // <-- Drawing buffer only; the canvas CSS is left alone

            if (composer) {
                if (typeof composer.setPixelRatio === 'function') composer.setPixelRatio(1);   // <-- The composer holds its own ratio from construction
                composer.setSize(fbW, fbH);
                pipeline.setDepthPrePassSize(fbW, fbH);
                pipeline.setAoSize(fbW, fbH);
            }

            // THESE TWO RUN ON BOTH ROUTES. setProfileLinesSize resizes the
            // shared Sobel buffers, which the drawing overlay BORROWS whenever
            // the 3D effect is on; HandleResize resizes them when it owns them
            // instead, and sets the drawing quad's own resolution uniform
            // either way. Calling one and not the other leaves the drawing
            // route inking at viewport resolution - which is what it did.
            pipeline.setProfileLinesSize(fbW, fbH);
            pipeline.setFxaaSize(fbW, fbH);
            Na__DrawProfile__HandleResize(fbW, fbH);
            Na__SectionCut__HandleResize(fbW, fbH);                           // <-- Cut outline fat lines resolve against this

            // ASPECT | The full export aspect; setViewOffset sub-divides it per
            // tile. An orthographic drawing camera has no aspect and is already
            // framed on its own window, so it is left exactly as it was.
            if (Number.isFinite(camera.aspect)) {
                camera.aspect = outW / outH;
                camera.updateProjectionMatrix();
            }

            if (supersampler && fxaaPass) fxaaPass.enabled = false;            // <-- Averaging blurred samples buys blur for nothing
            if (supersampler && composer) composer.renderToScreen = false;     // <-- Leave each sample in the read buffer instead

            // HELPER FUNCTION | Run the Effect Chain Once Through the Projection
            // ------------------------------------------------------------
            // Everything in here reads the camera's projection, so it repeats
            // for every supersample: fog and SSAO copy the jittered matrices
            // into their uniforms, and each pre-pass renders through them.
            // ------------------------------------------------------------
            function Na__StaticExport__DrawComposerFrame(activeCamera) {
                Na__Scene__UpdateFogPassUniforms(pipeline.fogPass, activeCamera);
                pipeline.updateAoUniforms(activeCamera);
                pipeline.renderDepthPrePass();
                pipeline.renderProfileNormals();
                composer.render();
            }
            // ------------------------------------------------------------

            // HELPER FUNCTION | Draw One Tile, Supersampled or Not
            // ------------------------------------------------------------
            function Na__StaticExport__DrawTile(activeCamera) {
                if (!supersampler) {
                    if (useCallback)      { renderer.setRenderTarget(null); renderFrame(activeCamera); }
                    else if (useComposer) { Na__StaticExport__DrawComposerFrame(activeCamera); Na__StaticExport__DrawSectionOverlay(activeCamera); }
                    else                  { renderer.setRenderTarget(null); renderer.render(scene, activeCamera); }
                    return;
                }

                supersampler.captureBaseProjection(activeCamera);             // <-- After the tile's view offset has settled

                try {
                    for (let i = 0; i < supersampler.sampleCount; i++) {
                        if (i === 1) shadowMap.autoUpdate = false;            // <-- Keep the maps the first sample drew

                        supersampler.applyJitter(activeCamera, i);

                        if (useComposer) {
                            Na__StaticExport__DrawComposerFrame(activeCamera);
                            supersampler.accumulate(composer.readBuffer.texture, i);
                        } else {
                            supersampler.beginSample();                       // <-- The frame's canvas stand-in
                            if (useCallback) renderFrame(activeCamera);
                            else             renderer.render(scene, activeCamera);
                            supersampler.accumulateSample(i);
                        }
                    }
                } finally {
                    shadowMap.autoUpdate = savedShadowAuto;
                    supersampler.restoreProjection(activeCamera);             // <-- Unjittered for the overlay and the next tile
                }

                supersampler.present();                                       // <-- The averaged tile onto the canvas

                // The cut overlay lands on the finished average rather than
                // inside it, exactly as the live loop draws it after the
                // composer. The 2D route already drew its own inside
                // renderFrame, where the order of poche and edge matters.
                if (useComposer) Na__StaticExport__DrawSectionOverlay(activeCamera);
            }
            // ------------------------------------------------------------

            // HELPER FUNCTION | Section Caps and Outlines on the Finished Tile
            // ------------------------------------------------------------
            function Na__StaticExport__DrawSectionOverlay(activeCamera) {
                renderer.setRenderTarget(null);
                Na__SectionCut__RenderOverlay(activeCamera);
            }
            // ------------------------------------------------------------

            // TILE LOOP | Each sub-frustum rendered and composited in turn
            // ------------------------------------------------------------
            const totalTiles = tilePlan.totalTiles;
            let   done       = 0;

            for (const tile of tilePlan.tiles) {
                progress(done / totalTiles, totalTiles > 1
                    ? `Rendering Your Image... (part ${tile.index + 1} of ${totalTiles})`
                    : 'Rendering Your Image...');
                await Na__ExportYield__NextPaint();                           // <-- Paint the overlay and let the GPU drain (hidden-tab safe)

                // SUB-FRUSTUM | An exact crop of the full frame, gutter included
                camera.setViewOffset(outW, outH, tile.x - gutter, tile.y - gutter, fbW, fbH);
                camera.updateProjectionMatrix();

                Na__StaticExport__DrawTile(camera);

                if (contextLost || (gl && gl.isContextLost && gl.isContextLost())) {
                    throw new Error('Graphics memory was exhausted during export. Try a lower export resolution.');
                }

                // COMPOSITE | Crop the gutter and copy the tile interior
                outCtx.drawImage(renderer.domElement, gutter, gutter, tile.copyWidth, tile.copyHeight, tile.x, tile.y, tile.copyWidth, tile.copyHeight);

                done += 1;
                progress(done / totalTiles, null);
            }

            return {
                canvas           : outCanvas,
                width            : outW,
                height           : outH,
                tiled            : totalTiles > 1,
                wasClamped       : fit.wasClamped,
                antiAliasSamples : supersampler ? supersampler.sampleCount : 1
            };

        } finally {
            // RESTORE | Renderer, camera, composer and every sized buffer
            // ------------------------------------------------------------
            renderer.domElement.removeEventListener('webglcontextlost', onContextLost);

            renderer.setRenderTarget(null);
            shadowMap.autoUpdate = savedShadowAuto;

            if (supersampler) supersampler.dispose();                         // <-- Frees the tile-sized accumulation buffers
            if (composer && savedToScreen !== null)   composer.renderToScreen = savedToScreen;
            if (fxaaPass && savedFxaaEnabled !== null) fxaaPass.enabled = savedFxaaEnabled;

            // CLEARED UNCONDITIONALLY. The guard that used to stand here asked
            // whether a view offset existed before and left the last tile's in
            // place if one did - which is the failure this restore exists to
            // prevent: the user handed back a viewport showing one corner of
            // their own model. Nothing in the app sets a standing view offset,
            // so there is nothing to preserve and everything to lose.
            if (camera.clearViewOffset) camera.clearViewOffset();
            if (Number.isFinite(savedAspect)) camera.aspect = savedAspect;    // <-- An ortho drawing camera has none; do not invent one
            if (typeof camera.updateProjectionMatrix === 'function') camera.updateProjectionMatrix();

            renderer.setPixelRatio(savedPixelRatio);
            renderer.setSize(savedSize.x, savedSize.y, false);

            if (composer) {
                if (typeof composer.setPixelRatio === 'function') composer.setPixelRatio(savedPixelRatio);
                composer.setSize(savedSize.x, savedSize.y);
                pipeline.setDepthPrePassSize(savedSize.x, savedSize.y);
                pipeline.setAoSize(savedSize.x, savedSize.y);
            }

            pipeline.setProfileLinesSize(savedSize.x, savedSize.y);
            pipeline.setFxaaSize(savedSize.x, savedSize.y);
            Na__DrawProfile__HandleResize(savedSize.x, savedSize.y);
            Na__SectionCut__HandleResize(savedSize.x, savedSize.y);

            pipeline.renderProfileNormals();                                  // <-- Refresh the live viewport's normals at its own size

            Na__RenderLoop__RequestRender();                                  // <-- The canvas still holds the last tile; redraw it properly
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Static Export Tiled Renderer API
    // ------------------------------------------------------------
    export {
        Na__StaticExport__RenderToCanvas,
        Na__TilePlan__ClampToDeviceLimits,
        Na__TilePlan__IsIosDevice
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
