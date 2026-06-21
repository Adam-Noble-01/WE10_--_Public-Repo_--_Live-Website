// =============================================================================
// TRUEVISION3D - PRESENTATION MODE - THUMBNAIL RENDERER
// =============================================================================
//
// FILE       : Na__PresentationMode__Thumbnail__Renderer.js
// NAMESPACE  : Na__PresentationMode
// MODULE     : PresentationMode - Thumbnail Renderer
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Capture the current rendered Three.js viewport as a lightweight
//              WebP thumbnail for a Presentation Mode saved scene
// CREATED    : 21-Jun-2026
//
// DESCRIPTION:
// - Renders one frame synchronously through the active composer pipeline then
//   copies the WebGL framebuffer to a 2D canvas IMMEDIATELY - required because
//   the renderer does not use preserveDrawingBuffer, so the buffer is only
//   valid in the same task as the render call.
// - Downscales to a compact thumbnail (default 480px wide) preserving aspect.
// - Returns the result as a Promise<Blob> (image/webp) so the caller can
//   upload it to R2 via the API client.
// - Render context (renderer, scene, camera, pipeline getter) must be
//   registered via SetRenderContext before use.
//
// INTEGRATION:
// - Na__PresentationMode__DevMenu__SceneEditor calls
//   Na__PresentationMode__Thumbnail__RenderCurrentViewportToWebp().
// - SetRenderContext is called from Index.html after the renderer exists.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Jun-2026 - Version 1.0.0
// - Ported from ValeVision3D as part of the Presentation Mode transplant.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Default Thumbnail Dimensions
    // ------------------------------------------------------------
    const Na__PmThumb__DEFAULT_WIDTH   = 480;    // <-- Target thumbnail width in pixels
    const Na__PmThumb__WEBP_QUALITY    = 0.80;   // <-- WebP quality (0-1)
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Render Context References
    // ------------------------------------------------------------
    let Na__PmThumb__Renderer         = null;  // <-- WebGLRenderer
    let Na__PmThumb__Scene            = null;  // <-- Three.js scene (direct render fallback)
    let Na__PmThumb__Camera           = null;  // <-- Active camera (direct render fallback)
    let Na__PmThumb__GetPipelineState = null;  // <-- () => pipeline state with composer + renderProfileNormals
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Render Context Registration
// -----------------------------------------------------------------------------

    // FUNCTION | Register the Render Context for Thumbnail Capture
    // ------------------------------------------------------------
    function Na__PresentationMode__Thumbnail__SetRenderContext(renderer, scene, camera, getPipelineState) {
        Na__PmThumb__Renderer         = renderer;          // <-- Store live renderer reference
        Na__PmThumb__Scene            = scene;             // <-- Store scene for direct render fallback
        Na__PmThumb__Camera           = camera;            // <-- Store camera for direct render fallback
        Na__PmThumb__GetPipelineState = getPipelineState;  // <-- Lazy pipeline getter (pipeline built after load)
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Thumbnail Capture
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Copy Renderer Canvas to Downscaled 2D Canvas and Return WebP Blob
    // ------------------------------------------------------------
    function Na__PmThumb__CaptureFromCanvas(sourceCanvas, targetWidthPx) {
        return new Promise((resolve, reject) => {
            if (!sourceCanvas) {
                reject(new Error('No source canvas for thumbnail capture'));
                return;
            }

            const srcW = sourceCanvas.width  || 1;
            const srcH = sourceCanvas.height || 1;

            const targetW = Math.round(targetWidthPx);
            const targetH = Math.round((srcH / srcW) * targetW);            // <-- Preserve aspect ratio

            const offscreen = document.createElement('canvas');
            offscreen.width  = targetW;
            offscreen.height = targetH;

            const ctx = offscreen.getContext('2d');
            if (!ctx) {
                reject(new Error('Could not create 2D context for thumbnail'));
                return;
            }

            ctx.drawImage(sourceCanvas, 0, 0, targetW, targetH);            // <-- Downscale to target dimensions

            offscreen.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);                                        // <-- Return WebP blob
                    } else {
                        reject(new Error('toBlob returned null for thumbnail'));
                    }
                },
                'image/webp',
                Na__PmThumb__WEBP_QUALITY
            );
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Render Current Viewport to a WebP Blob (async)
    // ------------------------------------------------------------
    async function Na__PresentationMode__Thumbnail__RenderCurrentViewportToWebp(targetWidthPx) {
        if (!Na__PmThumb__Renderer) {
            console.warn('[TrueVision3D] Thumbnail renderer not registered - call SetRenderContext first.');
            return null;
        }

        const canvas = Na__PmThumb__Renderer.domElement;
        if (!canvas) {
            console.warn('[TrueVision3D] Renderer has no domElement for thumbnail capture.');
            return null;
        }

        const width = targetWidthPx || Na__PmThumb__DEFAULT_WIDTH;

        try {
            const pipelineState = (typeof Na__PmThumb__GetPipelineState === 'function')
                ? Na__PmThumb__GetPipelineState()
                : null;

            if (pipelineState && pipelineState.composer) {
                if (typeof pipelineState.renderProfileNormals === 'function') {
                    pipelineState.renderProfileNormals();                    // <-- Profile lines normals pre-pass
                }
                pipelineState.composer.render();                             // <-- Full post-processing pipeline
            } else if (Na__PmThumb__Scene && Na__PmThumb__Camera) {
                Na__PmThumb__Renderer.render(Na__PmThumb__Scene, Na__PmThumb__Camera); // <-- Direct render fallback
            }

            const blob = await Na__PmThumb__CaptureFromCanvas(canvas, width);
            return blob;                                                     // <-- Return blob to caller for upload
        } catch (error) {
            console.error('[TrueVision3D] Thumbnail capture error:', error);
            return null;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Thumbnail Renderer API
    // ------------------------------------------------------------
    export {
        Na__PresentationMode__Thumbnail__SetRenderContext,
        Na__PresentationMode__Thumbnail__RenderCurrentViewportToWebp
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
