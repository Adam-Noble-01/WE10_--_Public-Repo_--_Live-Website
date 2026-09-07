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
// - Renders one frame synchronously then copies the WebGL framebuffer to a 2D
//   canvas IMMEDIATELY - required because the renderer does not use
//   preserveDrawingBuffer, so the buffer is only valid in the same task as the
//   render call.
//
// - IT RENDERS WHATEVER IS ACTUALLY ON SCREEN, WHICH IS NOT ALWAYS THE 3D
//   VIEW. A floor plan or an elevation owns the viewport through the drawing
//   view broker and is drawn FLAT - no composer - with the section overlay on
//   top, because fog, ambient occlusion and the Sobel pass shade a parallel
//   drawing like a surface. Capturing through the composer regardless was why
//   a plan's thumbnail came back as a picture of the 3D model: the pipeline's
//   RenderPass still held the perspective camera, so the capture rendered a
//   view nobody was looking at. The branch below is the same one the render
//   loop takes, for the same reasons.
//
// - The markup layers are DOM overlays above the canvas, not WebGL, so a
//   thumbnail carries the drawing's linework and poche but not its text. That
//   is deliberate: at 480px a room label would be an illegible smudge, and the
//   card is meant to show which drawing it is, not to be read.
//
// - Downscales to a compact thumbnail (default 480px wide) preserving aspect.
// - Returns the result as a Promise<Blob> (image/webp), and CaptureAndUpload
//   carries it the rest of the way to R2 so all three callers share one path.
// - Render context (renderer, scene, camera, pipeline getter) must be
//   registered via SetRenderContext before use.
//
// INTEGRATION:
// - Na__PresentationMode__DevMenu__SceneEditor, the floor plan Dev editor and
//   the elevation Dev editor all call CaptureAndUpload.
// - SetRenderContext is called from Index.html after the renderer exists.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Sep-2026 - Version 1.1.0
// - Capture now follows the active 2D drawing when there is one, so floor
//   plans and elevations produce a thumbnail of themselves rather than of the
//   3D model. Added CaptureAndUpload so the capture, the R2 write and the
//   returned relative URL live in one place instead of three.
//
// 21-Jun-2026 - Version 1.0.0
// - Ported from ValeVision3D as part of the Presentation Mode transplant.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Active Drawing View and Section Overlay
    // ------------------------------------------------------------
    // Asking the broker which camera owns the viewport is what makes a capture
    // match what is on screen. The import points one way only - neither of
    // those modules knows this one exists - so no cycle is introduced.
    // @delegate: ../40__System__DrawingViewCore/Na__DrawView__ActiveView__.js
    // @delegate: ../40__System__DrawingViewCore/Na__DrawView__ProfileLines__.js
    // @delegate: ../41__System__SectionCutEngine/Na__SectionCut__Engine__.js
    // ------------------------------------------------------------
    import { Na__DrawView__GetCamera } from '../40__System__DrawingViewCore/Na__DrawView__ActiveView__.js';
    import { Na__DrawProfile__RenderOverlay } from '../40__System__DrawingViewCore/Na__DrawView__ProfileLines__.js';
    import { Na__SectionCut__RenderOverlay } from '../41__System__SectionCutEngine/Na__SectionCut__Engine__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Cloudflare R2 Write Path
    // ------------------------------------------------------------
    // @delegate: ../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js
    // ------------------------------------------------------------
    import { Na__CfApi__WriteThumbnailWebp } from '../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


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


    // HELPER FUNCTION | Draw Exactly What Is on Screen, Once
    // ------------------------------------------------------------
    // The same branch the render loop takes. A 2D drawing owns the viewport
    // whenever the broker hands back a camera, and is drawn FLAT plus its two
    // overlays - the silhouette edges and then the cut fills, in that order;
    // anything else goes through the composer. The order is copied from the
    // loop rather than reasoned about again here, because a thumbnail that
    // composited differently would be a thumbnail of a drawing nobody sees.
    // ------------------------------------------------------------
    function Na__PmThumb__DrawCurrentView() {
        const drawingCamera = Na__DrawView__GetCamera();

        if (drawingCamera && Na__PmThumb__Scene) {
            Na__PmThumb__Renderer.render(Na__PmThumb__Scene, drawingCamera); // <-- Flat: no fog, no AO
            Na__DrawProfile__RenderOverlay(drawingCamera);                   // <-- Silhouette edges, exactly as the loop draws them
            Na__SectionCut__RenderOverlay(drawingCamera);                    // <-- Cut fills and profile outlines on top
            return;
        }

        const pipelineState = (typeof Na__PmThumb__GetPipelineState === 'function')
            ? Na__PmThumb__GetPipelineState()
            : null;

        if (pipelineState && pipelineState.composer) {
            if (typeof pipelineState.renderProfileNormals === 'function') {
                pipelineState.renderProfileNormals();                        // <-- Profile lines normals pre-pass
            }
            pipelineState.composer.render();                                 // <-- Full post-processing pipeline
            Na__SectionCut__RenderOverlay(Na__PmThumb__Camera);              // <-- Matches the loop; a no-op with no active cut
        } else if (Na__PmThumb__Scene && Na__PmThumb__Camera) {
            Na__PmThumb__Renderer.render(Na__PmThumb__Scene, Na__PmThumb__Camera); // <-- Direct render fallback
        }
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
            Na__PmThumb__DrawCurrentView();

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
// REGION | Capture and Upload
// -----------------------------------------------------------------------------

    // FUNCTION | Capture the Viewport and Write It to R2 for One Scene
    // ------------------------------------------------------------
    // The whole path in one call, so the scene editor, the floor plan editor
    // and the elevation editor cannot drift in how a thumbnail is made or
    // where it lands. Returns { ok, relUrl } or { ok: false, error }; the
    // CALLER writes relUrl onto its own scene record, because only the caller
    // knows which record that is.
    // ------------------------------------------------------------
    async function Na__PresentationMode__Thumbnail__CaptureAndUpload(sceneId, targetWidthPx) {
        if (!sceneId) return { ok: false, error: 'No scene id supplied' };

        const blob = await Na__PresentationMode__Thumbnail__RenderCurrentViewportToWebp(targetWidthPx);
        if (!blob) return { ok: false, error: 'Thumbnail render failed' };

        return Na__CfApi__WriteThumbnailWebp(sceneId, blob);
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
        Na__PresentationMode__Thumbnail__RenderCurrentViewportToWebp,
        Na__PresentationMode__Thumbnail__CaptureAndUpload
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
