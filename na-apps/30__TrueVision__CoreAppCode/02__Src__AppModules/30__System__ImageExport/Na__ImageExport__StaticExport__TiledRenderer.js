// =============================================================================
// TRUEVISION3D - IMAGE EXPORT - STATIC EXPORT TILED RENDERER
// =============================================================================
//
// FILE       : Na__ImageExport__StaticExport__TiledRenderer.js
// NAMESPACE  : Na__StaticExport
// MODULE     : Image Export - Static Export Tiled Renderer
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Render the scene to a canvas at any requested size, tiling past the GPU limit
// CREATED    : 10-Sep-2026
//
// DESCRIPTION:
// - One entry point, RenderToCanvas, used by the Layout Editor to bake a sheet
//   viewport and available to any other export that wants a specific pixel size
//   rather than whatever the viewport happens to be.
// - TILES ONLY WHEN IT HAS TO. A drawing viewport at print resolution is a few
//   thousand pixels a side and fits in one pass; a full A1 sheet at 20 px/mm
//   does not, and a single render at that size fails on the GPU rather than
//   coming back small. The tile path exists for the second case and is skipped
//   entirely for the first, because a tiled render of something that fits is
//   slower and can seam.
// - The camera's projection is offset per tile with setViewOffset, which is the
//   only way to sub-divide a frustum without changing what the camera sees.
//
// INTEGRATION:
// - Na__LayoutEditor__SnapshotRenderer__ calls this for both viewport kinds.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 30__System__ImageExport/Na__ImageExport__StaticExport__TiledRenderer.js
//                   (signature and tiling approach; implementation written for TrueVision)
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment Phase E)
// - Parity        : diverged (identical call signature and return shape)
// - Divergences   : ValeVision routes every tile through its EffectComposer. TrueVision has
//                   no composer in the drawing path at all, so the caller passes a renderFrame
//                   callback and this module never decides how a frame is drawn - which is
//                   what keeps the sheet identical to the screen. With no callback it falls
//                   back to a plain renderer.render.
// - Back-port     : no.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.0.0
// - Initial implementation for the Layout Editor port.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Size Limits
    // ------------------------------------------------------------
    // 16384 is the common WebGL2 maximum. Probed rather than assumed where the
    // context allows it, because a laptop iGPU can be half that and a silently
    // truncated export is worse than a slower one.
    // ------------------------------------------------------------
    const Na__TilePlan__FallbackMaxPx = 16384;
    const Na__TilePlan__TileTargetPx  = 2048;      // <-- Tile edge once tiling is needed
    const Na__TilePlan__MinPx         = 16;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Device Limits
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Largest Drawing Buffer This Context Will Accept
    // ------------------------------------------------------------
    function Na__TilePlan__MaxDrawingBufferPx(renderer) {
        try {
            const gl  = renderer && renderer.getContext ? renderer.getContext() : null;
            const max = gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : 0;
            return (Number.isFinite(max) && max > 0) ? Math.min(max, Na__TilePlan__FallbackMaxPx) : Na__TilePlan__FallbackMaxPx;
        } catch (error) {
            return Na__TilePlan__FallbackMaxPx;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Clamp a Requested Size, Preserving Aspect
    // ------------------------------------------------------------
    // Aspect is preserved rather than each axis clamped independently, because
    // a viewport that came back stretched would print wrong at a true scale and
    // nothing on the sheet would say why.
    // ------------------------------------------------------------
    function Na__TilePlan__ClampToDeviceLimits(width, height, maxPx) {
        const w = Math.max(Na__TilePlan__MinPx, Math.round(width  || 0));
        const h = Math.max(Na__TilePlan__MinPx, Math.round(height || 0));
        const limit = maxPx || Na__TilePlan__FallbackMaxPx;

        if (w <= limit && h <= limit) return { width: w, height: h, clamped: false };

        const scale = Math.min(limit / w, limit / h);
        return {
            width   : Math.max(Na__TilePlan__MinPx, Math.floor(w * scale)),
            height  : Math.max(Na__TilePlan__MinPx, Math.floor(h * scale)),
            clamped : true
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
    //   getRenderPipelineState         - accepted for ValeVision signature parity
    //   elevationOverrides             - accepted for ValeVision signature parity
    //   onProgress(fraction)           - optional
    //
    // Returns { canvas, width, height, tiled }.
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
            renderFrame = null,
            onProgress  = null
        } = (options || {});

        if (!renderer || !scene || !camera) throw new Error('Na__StaticExport__RenderToCanvas: renderer, scene and camera are required');

        const progress = (typeof onProgress === 'function') ? onProgress : () => {};
        const drawOne  = (typeof renderFrame === 'function')
            ? renderFrame
            : (cam) => renderer.render(scene, cam);

        const maxPx = Na__TilePlan__MaxDrawingBufferPx(renderer);
        const fit   = Na__TilePlan__ClampToDeviceLimits(targetWidth, targetHeight, maxPx);
        const outW  = fit.width;
        const outH  = fit.height;

        const outCanvas = document.createElement('canvas');
        outCanvas.width  = outW;
        outCanvas.height = outH;
        const outCtx = outCanvas.getContext('2d');

        // SAVE | Everything below is restored in the finally block.
        // Read off the canvas rather than renderer.getSize, because getSize
        // reports CSS size and setSize(w, h, false) deliberately does not touch
        // that - restoring the CSS size would resize the viewport on screen.
        const savedWidth       = renderer.domElement.width;
        const savedHeight      = renderer.domElement.height;
        const savedPixelRatio  = renderer.getPixelRatio();
        const savedAspect      = camera.aspect;
        const hadViewOffset    = Boolean(camera.view && camera.view.enabled);

        try {
            renderer.setPixelRatio(1);                                            // <-- Requested pixels are exact pixels

            const needsTiling = (outW > maxPx) || (outH > maxPx)
                             || (outW * outH > maxPx * maxPx);

            if (!needsTiling) {
                renderer.setSize(outW, outH, false);
                if (Number.isFinite(camera.aspect)) { camera.aspect = outW / outH; camera.updateProjectionMatrix(); }
                drawOne(camera);
                outCtx.drawImage(renderer.domElement, 0, 0, outW, outH);
                progress(1);
                return { canvas: outCanvas, width: outW, height: outH, tiled: false };
            }

            // TILE PATH | Sub-divide the frustum with setViewOffset
            const tile   = Math.min(Na__TilePlan__TileTargetPx, maxPx);
            const cols   = Math.ceil(outW / tile);
            const rows   = Math.ceil(outH / tile);
            const total  = cols * rows;
            let   done   = 0;

            renderer.setSize(tile, tile, false);
            if (Number.isFinite(camera.aspect)) camera.aspect = outW / outH;

            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    const x = col * tile;
                    const y = row * tile;
                    const w = Math.min(tile, outW - x);
                    const h = Math.min(tile, outH - y);

                    camera.setViewOffset(outW, outH, x, y, w, h);
                    camera.updateProjectionMatrix();
                    renderer.setSize(w, h, false);
                    drawOne(camera);
                    outCtx.drawImage(renderer.domElement, 0, 0, w, h, x, y, w, h);

                    done += 1;
                    progress(done / total);
                    await new Promise(r => setTimeout(r, 0));                     // <-- Yield: a long bake must not freeze the page
                }
            }

            return { canvas: outCanvas, width: outW, height: outH, tiled: true };

        } finally {
            if (!hadViewOffset && camera.clearViewOffset) camera.clearViewOffset();
            camera.aspect = savedAspect;
            if (typeof camera.updateProjectionMatrix === 'function') camera.updateProjectionMatrix();
            renderer.setPixelRatio(savedPixelRatio);
            renderer.setSize(savedWidth, savedHeight, false);
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
        Na__TilePlan__ClampToDeviceLimits
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
