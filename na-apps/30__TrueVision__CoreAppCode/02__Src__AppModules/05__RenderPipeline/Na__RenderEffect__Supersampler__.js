// =============================================================================
// TRUEVISION3D - RENDER PIPELINE - SUPERSAMPLER
// =============================================================================
//
// FILE       : Na__RenderEffect__Supersampler__.js
// NAMESPACE  : Na__Supersampler
// MODULE     : Render Pipeline - Supersampled Anti-Aliasing
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Anti-alias a rendered frame by drawing it several times with
//              sub-pixel camera jitter and averaging the results
// CREATED    : 12-Sep-2026
//
// DESCRIPTION:
// - A pixel is not a little square of colour. It is ONE measurement taken at
//   one infinitely small point, painted as a square afterwards. So the
//   renderer asks one yes-or-no question per pixel - wall, or glazing bar -
//   and a line two degrees off horizontal answers "row 100" for thirty pixels
//   and then "row 101". That is the staircase, and the shallower the line the
//   longer and uglier the step. Architecture is made of shallow lines: eaves,
//   ridges, cills, transoms, string courses.
// - FXAA cannot repair it. FXAA is handed the already-broken image and walks
//   along an edge looking for where the step ends, giving up after about
//   twenty pixels. A thirty-pixel step outruns the search, so the staircase
//   survives and everything is smeared in the attempt. Blur without accuracy.
// - This module refuses to break the image instead. The frame is rendered N
//   times, the projection nudged by a fraction of a pixel each time, and the
//   N results averaged. A bar covering a third of a pixel lands on five of
//   sixteen sample points, so the pixel records a third-of-the-way-to-black
//   grey. THE PIXEL STOPS BEING A YES OR NO AND BECOMES A MEASUREMENT OF
//   COVERAGE, and once every pixel knows its true coverage the staircase
//   dissolves on its own.
// - Whitecard is the cruellest case for aliasing and the biggest winner here.
//   Aliasing severity scales with the contrast across the edge, and a near
//   black line on a near white field with nothing else in frame is the
//   maximum there is. Sixteen samples is the count at which the residual
//   banding drops below what the eye can separate on a clean white field;
//   four or eight is plenty on a textured photoreal render and visibly short
//   of enough here.
//
// THE JITTER GOES INTO THE PROJECTION, NOT THE SCENE PASS:
// - TrueVision's picture is not made of geometry, it is made of LINE WORK -
//   the profile-line Sobel overlay, the section cut outlines, fog and SSAO.
//   Jittering only the scene render, which is what three's SSAARenderPass
//   does, would smooth the walls beautifully and leave every line exactly as
//   stepped as before. Since the lines are the drawing, that is close to
//   useless. Shifting the projection at the root means every downstream pass
//   inherits it. This is the single most important decision in the module.
//
// SAMPLE PATTERNS:
// - The Direct3D standard multisample positions, the ones the GPU itself uses
//   for hardware MSAA. Each is an N-rooks pattern: no two samples share a row
//   or a column, so a near-horizontal or near-vertical edge - the worst case -
//   gets N distinct coverage levels rather than a handful. A naive 4x4 grid
//   would spend sixteen samples to buy four levels on a shallow line.
// - Every offset sits inside the pixel (a box filter), so a crisp line stays
//   exactly as crisp as the model draws it, just without the steps.
// - Each pattern is re-centred when the module loads. The published 16-sample
//   table averages 1/32 px off centre, which would nudge the whole averaged
//   image against the section cut overlay drawn after it and show as a faint
//   doubling on section lines.
//
// ACCUMULATION:
// - Each sample is added into a HALF FLOAT target at a weight of 1/N. In
//   ordinary eight-bit precision each contribution would be rounded to one of
//   256 levels before being added, and the rounding would reintroduce banding
//   along exactly the gradients the exercise exists to create. The precision
//   is load bearing, not a nicety.
//
// THE TWO FRAME ROUTES, AND WHY THIS MODULE SERVES BOTH:
// - COMPOSER ROUTE (the 3D view). The composer is told to stop drawing to the
//   canvas, so its last pass leaves the finished frame in its read buffer, and
//   that texture is handed to accumulate(). FXAA is switched off by the caller
//   for the duration: it would soften each sample BEFORE the average, and
//   averaging sixteen blurred pictures buys blur for nothing. Present copies
//   the total out raw, exactly as the FXAA pass it stands in for would have.
// - TARGET ROUTE (the 2D drawing, DIV-1). A TrueVision drawing bypasses the
//   composer entirely - flat render, then the silhouette overlay, then the cut
//   fills - and every one of those draws to whatever framebuffer is bound. So
//   the caller asks for a sample target, binds it, draws the whole frame into
//   it, and accumulates that. COLOUR SPACE IS THE TRAP HERE: three applies the
//   sRGB output transfer only when rendering to the canvas, never to a render
//   target, so a frame diverted into a target comes out linear and a raw copy
//   would wash it out. Pass encodeSrgb for this route and the present pass
//   applies the transfer instead. At one sample the result is identical to
//   what the canvas would have received; above one the average is taken in
//   linear light, which is where averaging belongs.
//
// USAGE (per frame, inside one synchronous block):
//   supersampler.captureBaseProjection(camera);
//   for (let i = 0; i < supersampler.sampleCount; i++) {
//       supersampler.applyJitter(camera, i);
//       ...draw the frame...
//       supersampler.accumulate(texture, i);        // or accumulateSample(i)
//   }
//   supersampler.restoreProjection(camera);
//   supersampler.present();
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 31__System__VideoStudio/Na__VideoStudio__Export__Supersampler.js 1.0.0
// - Ported on     : 12-Sep-2026 for TrueVision3D v2.25.0
// - Parity        : diverged (identical patterns, jitter maths and accumulation)
// - Divergences   : (1) Lives in the render pipeline, not the video studio: TrueVision has no
//                       video studio and uses this from the image export and the drawing
//                       viewport bakes, so it cannot be owned by one feature.
//                   (2) Adds the TARGET ROUTE - an optional colour+depth sample target and
//                       accumulateSample() - for TrueVision's composer-free drawing route
//                       (DIV-1). ValeVision's only caller has a composer read buffer to hand.
//                   (3) Adds the sRGB present transfer that the target route needs.
//                   (4) Adds a 2-sample pattern and ResolveSampleCount.
// - Back-port     : YES. ValeVision should take this file and have its video studio
//                   supersampler delegate to it, so the two apps share one jitter table.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 12-Sep-2026 - Version 1.0.0
// - Initial implementation: 2x, 4x, 8x and 16x supersampled anti-aliasing for
//   the still image exporter and the Layout Editor viewport bakes.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js
    // ------------------------------------------------------------
    import * as THREE from 'three';
    import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Direct3D Standard Multisample Positions
    // ------------------------------------------------------------
    // Integer offsets on a 16 x 16 grid across one pixel, so each value is
    // sixteenths of a pixel from the pixel centre.
    // ------------------------------------------------------------
    const Na__Ss__RAW_PATTERNS = {
        2 : [
            [ 4,  4], [-4, -4]
        ],
        4 : [
            [-2, -6], [ 6, -2], [-6,  2], [ 2,  6]
        ],
        8 : [
            [ 1, -3], [-1,  3], [ 5,  1], [-3, -5],
            [-5,  5], [-7, -1], [ 3,  7], [ 7, -7]
        ],
        16: [
            [ 1,  1], [-1, -3], [-3,  2], [ 4, -1],
            [-5, -2], [ 2,  5], [ 5,  3], [ 3, -5],
            [-2,  6], [ 0, -7], [-4, -6], [-6,  4],
            [-8,  0], [ 7, -4], [ 6,  7], [-7, -8]
        ]
    };
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Sample Counts This Module Understands
    // ------------------------------------------------------------
    const Na__Supersampler__SAMPLE_COUNTS = Object.freeze([ 1, 2, 4, 8, 16 ]);
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Shared Full Screen Vertex Shader
    // ------------------------------------------------------------
    const Na__Ss__VERTEX_SHADER = /* glsl */`
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Sample Pattern Preparation
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Convert a Raw Pattern to Centred Pixel Offsets
    // ------------------------------------------------------------
    function Na__Ss__CentrePattern(rawPattern) {
        const count = rawPattern.length;
        const meanX = rawPattern.reduce((sum, p) => sum + p[0], 0) / count;
        const meanY = rawPattern.reduce((sum, p) => sum + p[1], 0) / count;

        return rawPattern.map(p => [
            (p[0] - meanX) / 16,                                             // <-- Sixteenths to pixels, mean at the pixel centre
            (p[1] - meanY) / 16
        ]);
    }
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Centred Offsets by Sample Count, in Pixels
    // ------------------------------------------------------------
    const Na__Ss__PATTERNS = Object.freeze({
        2 : Na__Ss__CentrePattern(Na__Ss__RAW_PATTERNS[2]),
        4 : Na__Ss__CentrePattern(Na__Ss__RAW_PATTERNS[4]),
        8 : Na__Ss__CentrePattern(Na__Ss__RAW_PATTERNS[8]),
        16: Na__Ss__CentrePattern(Na__Ss__RAW_PATTERNS[16])
    });
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Sample Count Resolution
// -----------------------------------------------------------------------------

    // FUNCTION | Snap Any Requested Count to One This Module Can Actually Draw
    // ------------------------------------------------------------
    // Rounds DOWN to the nearest supported count rather than to the nearest,
    // because the cost is linear in the count and a caller asking for 12 has
    // budgeted for twelve renders, not sixteen. Anything below 2, absent or
    // unreadable comes back as 1, which every caller treats as "off".
    // ------------------------------------------------------------
    function Na__Supersampler__ResolveSampleCount(requested) {
        const value = Number(requested);
        if (!Number.isFinite(value) || value < 2) return 1;

        let resolved = 1;
        for (let i = 0; i < Na__Supersampler__SAMPLE_COUNTS.length; i++) {
            if (Na__Supersampler__SAMPLE_COUNTS[i] <= value) resolved = Na__Supersampler__SAMPLE_COUNTS[i];
        }
        return resolved;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Supersampler Construction
// -----------------------------------------------------------------------------

    // FUNCTION | Create a Supersampler for One Render Session
    // ------------------------------------------------------------
    // options:
    //   renderer      {THREE.WebGLRenderer}  Live renderer (borrowed)
    //   width, height {number}               Frame size in pixels. For a tiled
    //                                        export this is ONE TILE's
    //                                        framebuffer, not the output image
    //   samples       {number}               2, 4, 8 or 16
    //   sampleTarget  {boolean}              Allocate the colour+depth target
    //                                        for the TARGET ROUTE
    //   encodeSrgb    {boolean}              Apply the sRGB transfer on present
    //                                        (TARGET ROUTE only - see header)
    //
    // Returns null for any count without a pattern (1 included), so the caller
    // falls back to a single ordinary frame. Call dispose() when the session
    // ends.
    // ------------------------------------------------------------
    function Na__Supersampler__Create(options) {
        const {
            renderer, width, height, samples,
            sampleTarget : wantsSampleTarget = false,
            encodeSrgb   : wantsSrgbEncode   = false
        } = options || {};

        const offsets = Na__Ss__PATTERNS[samples];
        if (!renderer || !offsets || !(width > 0) || !(height > 0)) return null;

        const frameWidth   = Math.max(1, Math.round(width));
        const frameHeight  = Math.max(1, Math.round(height));
        const sampleCount  = offsets.length;
        const sampleWeight = 1 / sampleCount;

        // ACCUMULATION TARGET | Colour only; nothing here needs depth
        // ------------------------------------------------------------
        const accumTarget = new THREE.WebGLRenderTarget(frameWidth, frameHeight, {
            minFilter     : THREE.NearestFilter,
            magFilter     : THREE.NearestFilter,
            format        : THREE.RGBAFormat,
            type          : THREE.HalfFloatType,
            depthBuffer   : false,
            stencilBuffer : false
        });
        accumTarget.texture.name = 'Na__Supersampler__Accumulation';

        // SAMPLE TARGET | The TARGET ROUTE's canvas stand-in. The depth here is
        // real geometry's, so it is a real depth buffer; the cut overlay clears
        // depth deliberately mid-frame and would have nothing to clear without
        // one, and the poche would sink behind the model.
        // ------------------------------------------------------------
        const frameTarget = wantsSampleTarget
            ? new THREE.WebGLRenderTarget(frameWidth, frameHeight, {
                minFilter     : THREE.NearestFilter,
                magFilter     : THREE.NearestFilter,
                format        : THREE.RGBAFormat,
                type          : THREE.HalfFloatType,
                depthBuffer   : true,
                stencilBuffer : false
            })
            : null;
        if (frameTarget) frameTarget.texture.name = 'Na__Supersampler__Sample';

        // ACCUMULATE MATERIAL | Adds one sample at 1/N weight: ONE, ONE on
        // colour and alpha alike, so alpha averages exactly as colour does
        // ------------------------------------------------------------
        const accumMaterial = new THREE.ShaderMaterial({
            name           : 'Na__Supersampler__Accumulate',
            uniforms       : {
                tSample : { value: null },
                uWeight : { value: sampleWeight }
            },
            vertexShader   : Na__Ss__VERTEX_SHADER,
            fragmentShader : /* glsl */`
                uniform sampler2D tSample;
                uniform float     uWeight;
                varying vec2      vUv;
                void main() {
                    gl_FragColor = texture2D(tSample, vUv) * uWeight;
                }
            `,
            blending           : THREE.CustomBlending,
            blendEquation      : THREE.AddEquation,
            blendSrc           : THREE.OneFactor,
            blendDst           : THREE.OneFactor,
            blendEquationAlpha : THREE.AddEquation,
            blendSrcAlpha      : THREE.OneFactor,
            blendDstAlpha      : THREE.OneFactor,
            depthTest          : false,
            depthWrite         : false
        });

        // PRESENT MATERIAL | Straight copy, as the pass it stands in for would
        // have written it: no blending. The sRGB transfer is compiled in ONLY
        // for the TARGET ROUTE, where three never applied it - see the header.
        // ------------------------------------------------------------
        const presentMaterial = new THREE.ShaderMaterial({
            name           : 'Na__Supersampler__Present',
            defines        : wantsSrgbEncode ? { NA_ENCODE_SRGB : '' } : {},
            uniforms       : {
                tAccum : { value: accumTarget.texture }
            },
            vertexShader   : Na__Ss__VERTEX_SHADER,
            fragmentShader : /* glsl */`
                uniform sampler2D tAccum;
                varying vec2      vUv;
                void main() {
                    vec4 total = texture2D(tAccum, vUv);
                    #ifdef NA_ENCODE_SRGB
                        vec3 linear = max(total.rgb, vec3(0.0));             // <-- pow() of a negative is NaN; half float can carry one
                        total.rgb = mix(
                            pow(linear, vec3(0.41666)) * 1.055 - vec3(0.055),
                            linear * 12.92,
                            vec3(lessThanEqual(linear, vec3(0.0031308)))
                        );
                    #endif
                    gl_FragColor = total;
                }
            `,
            blending   : THREE.NoBlending,
            depthTest  : false,
            depthWrite : false
        });

        const accumQuad   = new FullScreenQuad(accumMaterial);
        const presentQuad = new FullScreenQuad(presentMaterial);

        // SCRATCH | Reused every frame, never reallocated
        // ------------------------------------------------------------
        const baseProjection        = new THREE.Matrix4();
        const baseProjectionInverse = new THREE.Matrix4();
        const jitterMatrix          = new THREE.Matrix4();
        const savedClearColor       = new THREE.Color();

        let isDisposed = false;

        const supersampler = {
            sampleCount,
            width        : frameWidth,
            height       : frameHeight,
            sampleTarget : frameTarget,                                      // <-- Null on the composer route

            // FUNCTION | Remember the Frame's Unjittered Projection
            // ------------------------------------------------------------
            // Call once per frame, after anything that rebuilds the projection
            // (a lens change, a per-tile setViewOffset) and before the first
            // applyJitter.
            // ------------------------------------------------------------
            captureBaseProjection(camera) {
                baseProjection.copy(camera.projectionMatrix);
                baseProjectionInverse.copy(camera.projectionMatrixInverse);
            },
            // ------------------------------------------------------------

            // FUNCTION | Shift the Projection for One Sample
            // ------------------------------------------------------------
            // A clip-space translation applied after the projection, so it
            // shifts whatever frustum the camera has, sub-divided by a tile's
            // view offset or not. Two NDC units span the frame, hence 2 / size.
            // ------------------------------------------------------------
            applyJitter(camera, index) {
                const offset = offsets[index % sampleCount];

                jitterMatrix.makeTranslation(
                    (2 * offset[0]) / frameWidth,
                    (2 * offset[1]) / frameHeight,
                    0
                );

                camera.projectionMatrix.copy(baseProjection).premultiply(jitterMatrix);
                camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();   // <-- Fog and SSAO rebuild positions from this
            },
            // ------------------------------------------------------------

            // FUNCTION | Put the Unjittered Projection Back
            // ------------------------------------------------------------
            restoreProjection(camera) {
                camera.projectionMatrix.copy(baseProjection);
                camera.projectionMatrixInverse.copy(baseProjectionInverse);
            },
            // ------------------------------------------------------------

            // FUNCTION | Bind the Sample Target Ready for One Frame
            // ------------------------------------------------------------
            // TARGET ROUTE only. The caller draws its whole frame after this
            // and calls accumulateSample() once the frame is finished.
            // ------------------------------------------------------------
            beginSample() {
                if (!frameTarget) return null;
                renderer.setRenderTarget(frameTarget);
                return frameTarget;
            },
            // ------------------------------------------------------------

            // FUNCTION | Add One Rendered Sample into the Running Total
            // ------------------------------------------------------------
            // Sample 0 clears the total first. The renderer's target, clear
            // colour and autoClear are all handed back as found.
            // ------------------------------------------------------------
            accumulate(sampleTexture, index) {
                const savedTarget     = renderer.getRenderTarget();
                const savedAutoClear  = renderer.autoClear;
                const savedClearAlpha = renderer.getClearAlpha();
                renderer.getClearColor(savedClearColor);

                renderer.autoClear = false;                                  // <-- Rendering must add to the total, not wipe it
                renderer.setRenderTarget(accumTarget);

                if (index === 0) {
                    renderer.setClearColor(0x000000, 0);
                    renderer.clear(true, false, false);                      // <-- Fresh total for this frame
                    renderer.setClearColor(savedClearColor, savedClearAlpha);
                }

                accumMaterial.uniforms.tSample.value = sampleTexture;
                accumQuad.render(renderer);
                accumMaterial.uniforms.tSample.value = null;                 // <-- Drop the reference to the caller's buffer

                renderer.autoClear = savedAutoClear;
                renderer.setRenderTarget(savedTarget);
            },
            // ------------------------------------------------------------

            // FUNCTION | Add the Sample Target's Contents into the Total
            // ------------------------------------------------------------
            accumulateSample(index) {
                if (!frameTarget) return;
                supersampler.accumulate(frameTarget.texture, index);
            },
            // ------------------------------------------------------------

            // FUNCTION | Copy the Averaged Frame Out
            // ------------------------------------------------------------
            // Null means the canvas, which is where every caller reads from.
            // ------------------------------------------------------------
            present(target = null) {
                const savedTarget = renderer.getRenderTarget();

                renderer.setRenderTarget(target);
                presentQuad.render(renderer);
                renderer.setRenderTarget(savedTarget);
            },
            // ------------------------------------------------------------

            // FUNCTION | Release GPU Resources
            // ------------------------------------------------------------
            // Safe to call more than once. The quads are left alone on
            // purpose: FullScreenQuad.dispose() frees the one triangle every
            // ShaderPass in the app shares, which would make the live
            // pipeline upload it again on its next frame for no reason.
            // ------------------------------------------------------------
            dispose() {
                if (isDisposed) return;
                isDisposed = true;

                accumTarget.dispose();
                if (frameTarget) frameTarget.dispose();
                accumMaterial.dispose();
                presentMaterial.dispose();
            }
            // ------------------------------------------------------------
        };

        return supersampler;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Supersampler API
    // ------------------------------------------------------------
    export {
        Na__Supersampler__Create,
        Na__Supersampler__ResolveSampleCount,
        Na__Supersampler__SAMPLE_COUNTS
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
