// =============================================================================
// TRUEVISION3D - PROJECTED LINEWORK - RASTER PREVIEW
// =============================================================================
//
// FILE       : Na__ProjectedLinework__RasterPreview__.js
// NAMESPACE  : Na__ProjectedLinework__RasterPreview
// MODULE     : Projected Linework - Raster Preview
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Put something truthful on the drawing within a tenth of a second
// CREATED    : 07-Aug-2026
//
// DESCRIPTION:
// - Renders the same occluders the clip kernel is about to work through, from the
//   same direction, as a picture - and hands back an image that drops onto the
//   drawing in exactly the millimetres the vector linework will later occupy.
// - Exists because the honest answer to "how long does the exact projection take"
//   is "a second or two per view", and a second or two of a blank drawing feels
//   like a failure whether or not it is one.
//
// ---------------------------------------------------------------------------
//
// WHY THIS IS A PREVIEW AND NOT A SHORTCUT
//
// The graphics card answers occlusion per PIXEL. That is the right answer, and it
// arrives in a few milliseconds, but it is an answer about a grid of dots and the
// drawing needs an answer about lines: something that stays sharp when the sheet is
// printed at 1:20, that a PDF can hold as vectors, and that a pen could plot.
//
// So this is a placeholder with a job and a deadline. It appears immediately, it is
// styled so nobody could mistake it for the finished drawing, and it is thrown away
// the moment that view's real segments arrive. It NEVER travels into a sheet bake
// or a PDF export - see the note on removal below.
//
// ---------------------------------------------------------------------------
//
// WHY IT LINES UP WITH THE VECTORS EXACTLY
//
// Not by fitting, and not by trial. The clip kernel projects a point by taking its
// x and z in view space and dividing by the world-per-millimetre scale. So an
// orthographic camera looking straight down that same view, with its frustum set to
// the x and z bounds of the same triangles, produces an image whose edges ARE those
// millimetre bounds. The image is then placed at that rectangle.
//
// Two details make the axes come out the right way round:
//
//     The camera's up vector is world NEGATIVE z, because the drawing's y runs
//     down the page while world z runs up it. Getting this backwards mirrors the
//     preview vertically and it is not subtle.
//
//     The occluders are already back face culled for this view, so what is drawn
//     is exactly the set of surfaces that can hide anything. Rendering the culled
//     set is not an approximation here, it is the same solid seen from the only
//     direction that matters.
//
// ---------------------------------------------------------------------------
//
// PUBLIC API:
//     Render(soup, edges, options)  -> { DataUrl, Rect } or null
//     Dispose()
//
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 50__System__ProjectedLinework/Na__ProjectedLinework__RasterPreview__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 09-Sep-2026 - Version 1.0.0
// - Ported from the Lantern Designer projection engine for port Phase 4;
//   identifiers renamed to the TrueVision namespace and the header restyled.
//   The body is kept as the Lantern Designer wrote it so the kernel stays
//   diff-able against its source and the Diff harness remains meaningful.
//
// =============================================================================


import * as THREE from 'three';

// =============================================================================
// REGION | Projected Edges Raster Preview Module
// =============================================================================

// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Rendering Defaults
    // ------------------------------------------------------------
    const DEFAULT_MAX_PIXELS      =  2048;                                    // <-- Longest side of the produced image
    const MINIMUM_PIXELS          =  64;
    const DEPTH_MARGIN_FACTOR     =  0.05;                                    // <-- Clearance above and below the model, as a share of its height
    // ------------------------------------------------------------


    // MODULE VARIABLES | The Private Renderer
    // ------------------------------------------------------------
    // Deliberately NOT the application's live renderer. Borrowing that one would
    // mean resizing it, changing its clear colour and restoring both, on a canvas
    // the user is looking at, for a picture that is thrown away seconds later.
    //
    // preserveDrawingBuffer is required: the image is read back with toDataURL
    // immediately after the draw, and without it the buffer may already have been
    // cleared by the compositor.
    let Na__ProjectedLinework__RasterPreview__Renderer  =  null;
    let Na__ProjectedLinework__RasterPreview__Broken    =  false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Renderer Lifecycle
// -----------------------------------------------------------------------------

    // SUB FUNCTION | Get or Create the Preview Renderer
    // ------------------------------------------------------------
    function Na__ProjectedLinework__RasterPreview__Renderer__Ensure() {
        if (Na__ProjectedLinework__RasterPreview__Broken) return null;
        if (Na__ProjectedLinework__RasterPreview__Renderer) {
            return Na__ProjectedLinework__RasterPreview__Renderer;
        }

        try {
            const renderer  =  new THREE.WebGLRenderer({
                antialias             : true,
                alpha                 : true,
                preserveDrawingBuffer : true
            });

            renderer.setPixelRatio(1);
            renderer.setClearColor(0x000000, 0);

            Na__ProjectedLinework__RasterPreview__Renderer  =  renderer;
            return renderer;
        } catch (createError) {
            console.warn('[TrueVision3D ProjectedLinework] Preview renderer unavailable, drawings will simply wait for vectors:', createError);
            Na__ProjectedLinework__RasterPreview__Broken  =  true;
            return null;
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Release the Preview Renderer
    // ------------------------------------------------------------
    export function Na__ProjectedLinework__RasterPreview__Dispose() {
        if (Na__ProjectedLinework__RasterPreview__Renderer) {
            Na__ProjectedLinework__RasterPreview__Renderer.dispose();
        }
        Na__ProjectedLinework__RasterPreview__Renderer  =  null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Rendering
// -----------------------------------------------------------------------------

    // SUB FUNCTION | Bounds of the Occluders in View Space
    // ------------------------------------------------------------
    function Na__ProjectedLinework__RasterPreview__Bounds(positions, count) {
        const bounds  =  {
            MinX :  Infinity, MaxX : -Infinity,
            MinY :  Infinity, MaxY : -Infinity,
            MinZ :  Infinity, MaxZ : -Infinity
        };

        for (let i = 0; i < count * 9; i += 3) {
            const x  =  positions[i];
            const y  =  positions[i + 1];
            const z  =  positions[i + 2];

            if (x < bounds.MinX) bounds.MinX  =  x;
            if (x > bounds.MaxX) bounds.MaxX  =  x;
            if (y < bounds.MinY) bounds.MinY  =  y;
            if (y > bounds.MaxY) bounds.MaxY  =  y;
            if (z < bounds.MinZ) bounds.MinZ  =  z;
            if (z > bounds.MaxZ) bounds.MaxZ  =  z;
        }

        return bounds;
    }
    // ------------------------------------------------------------


    // SUB HELPER FUNCTION | Narrow a Double Buffer to a Float One for the Card
    // ------------------------------------------------------------
    // The kernel needs doubles because it compares against thresholds of 1e-16.
    // A picture does not: the card is single precision throughout and the image is
    // a couple of thousand pixels across.
    function Na__ProjectedLinework__RasterPreview__Narrow(source, length) {
        const narrowed  =  new Float32Array(length);
        for (let i = 0; i < length; i++) narrowed[i]  =  source[i];
        return narrowed;
    }
    // ------------------------------------------------------------


    // FUNCTION | Render a Provisional Picture of One View
    // ------------------------------------------------------------
    // Returns the image and the drawing rectangle it belongs in, or null if a
    // preview cannot be produced - which is never treated as an error, because the
    // drawing simply waits for its vectors instead.
    //
    // The solid is drawn with a depth offset so that the edge lines, which lie
    // exactly in the surfaces they belong to, win the depth test against them
    // rather than stitching in and out of the faces.
    export function Na__ProjectedLinework__RasterPreview__Render(soup, edges, options) {
        const settings  =  options || {};
        if (!soup || soup.TriCount === 0) return null;

        const renderer  =  Na__ProjectedLinework__RasterPreview__Renderer__Ensure();
        if (!renderer) return null;

        const scaleDivisor  =  settings.ScaleDivisor || 1;
        const maxPixels     =  settings.MaxPixels || DEFAULT_MAX_PIXELS;

        const bounds  =  Na__ProjectedLinework__RasterPreview__Bounds(soup.Positions, soup.TriCount);
        const spanX   =  bounds.MaxX - bounds.MinX;
        const spanZ   =  bounds.MaxZ - bounds.MinZ;
        if (!(spanX > 0) || !(spanZ > 0)) return null;

        // Pixel size follows the shape of the model so the image is never stretched.
        let widthPx   =  maxPixels;
        let heightPx  =  Math.round(maxPixels * (spanZ / spanX));
        if (heightPx > maxPixels) {
            heightPx  =  maxPixels;
            widthPx   =  Math.round(maxPixels * (spanX / spanZ));
        }
        widthPx   =  Math.max(MINIMUM_PIXELS, widthPx);
        heightPx  =  Math.max(MINIMUM_PIXELS, heightPx);

        const scene  =  new THREE.Scene();

        const solidGeometry  =  new THREE.BufferGeometry();
        solidGeometry.setAttribute('position', new THREE.BufferAttribute(
            Na__ProjectedLinework__RasterPreview__Narrow(soup.Positions, soup.TriCount * 9), 3
        ));

        const solidMaterial  =  new THREE.MeshBasicMaterial({
            color               : new THREE.Color(settings.FillColour || '#ffffff'),
            side                : THREE.DoubleSide,
            polygonOffset       : true,
            polygonOffsetFactor : 1,
            polygonOffsetUnits  : 1
        });

        scene.add(new THREE.Mesh(solidGeometry, solidMaterial));

        let lineGeometry  =  null;
        let lineMaterial  =  null;

        if (edges && edges.Count > 0) {
            lineGeometry  =  new THREE.BufferGeometry();
            lineGeometry.setAttribute('position', new THREE.BufferAttribute(
                Na__ProjectedLinework__RasterPreview__Narrow(edges.Verts, edges.Count * 6), 3
            ));

            lineMaterial  =  new THREE.LineBasicMaterial({
                color : new THREE.Color(settings.LineColour || '#3c3c3c')
            });

            scene.add(new THREE.LineSegments(lineGeometry, lineMaterial));
        }

        // Camera looks straight down the view axis. Its up vector is world negative
        // z so that increasing z runs DOWN the finished image, matching the drawing.
        const depth   =  Math.max(bounds.MaxY - bounds.MinY, 1e-6);
        const margin  =  depth * DEPTH_MARGIN_FACTOR;

        const camera  =  new THREE.OrthographicCamera(
            bounds.MinX, bounds.MaxX,
            -bounds.MinZ, -bounds.MaxZ,
            0, depth + (margin * 2)
        );
        camera.up.set(0, 0, -1);
        camera.position.set(0, bounds.MaxY + margin, 0);
        camera.lookAt(0, bounds.MinY - margin, 0);
        camera.updateProjectionMatrix();

        let dataUrl  =  null;

        try {
            renderer.setSize(widthPx, heightPx, false);
            renderer.render(scene, camera);
            dataUrl  =  renderer.domElement.toDataURL('image/png');
        } catch (renderError) {
            console.warn('[TrueVision3D ProjectedLinework] Preview render failed:', renderError);
            dataUrl  =  null;
        } finally {
            solidGeometry.dispose();
            solidMaterial.dispose();
            if (lineGeometry) lineGeometry.dispose();
            if (lineMaterial) lineMaterial.dispose();
        }

        if (!dataUrl) return null;

        return {
            DataUrl : dataUrl,
            Rect    : {
                X      : bounds.MinX / scaleDivisor,
                Y      : bounds.MinZ / scaleDivisor,
                Width  : spanX / scaleDivisor,
                Height : spanZ / scaleDivisor
            }
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

// endregion -------------------------------------------------------------------
