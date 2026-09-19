// =============================================================================
// TRUEVISION3D - RENDER EFFECT - SCREEN SPACE AMBIENT OCCLUSION
// =============================================================================
//
// FILE       : Na__RenderEffect__AmbientOcclusion__.js
// NAMESPACE  : Na__RenderEffect__AmbientOcclusion
// MODULE     : AmbientOcclusion
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Real-time SSAO post-processing pass for whitecard architecture
// CREATED    : 27-Feb-2026
//
// DESCRIPTION:
// Custom SSAO implementation compatible with logarithmicDepthBuffer: true.
// Three.js built-in SAOPass/SSAOPass CANNOT work with logarithmic depth
// because they use perspectiveDepthToViewZ() which assumes linear depth.
//
// This module reuses the proven logarithmic depth inversion from the fog
// pass (Na__Scene__DefaultFogEffect.js):
//   clipW = pow(cameraFar + 1.0, storedDepth) - 1.0
//
// Normals are reconstructed from depth derivatives (dFdx/dFdy) — no
// separate normal render pass required.
//
// All distance config values are integer millimeters (per project convention)
// and converted to Three.js scene units via Na__Math__ConvertMmToUnits.
//
// PIPELINE ARCHITECTURE:
// The AO effect is composed of two sequential ShaderPass instances inserted
// into the EffectComposer pipeline:
//
//   [RenderPass] → [ProfileLines] → [Fog] → [SSAO] → [AO Blur] → [FXAA]
//
//   1. SSAO pass   – hemisphere-sampled screen-space occlusion calculation.
//                    Reads colour from the previous pass (tDiffuse) and the
//                    separate depth pre-pass texture (tDepth).  Outputs
//                    composited colour: texel.rgb * aoFactor.
//
//   2. AO Blur     – lightweight 5×5 gaussian blur that smooths the
//                    per-pixel noise inherent to the random kernel rotation.
//                    Acts on the composited output from step 1.  Because the
//                    whitecard scene uses flat colours the blur primarily
//                    softens noisy AO boundaries without visibly degrading
//                    geometry edges.
//
// DEPTH TEXTURE:
// Both the fog pass and SSAO pass require a depth texture.  This texture
// MUST come from a separate render target (the "depth pre-pass") rather
// than from the EffectComposer's own render targets.  Attaching a
// DepthTexture to the EffectComposer RT would cause a WebGL feedback loop
// because ShaderPasses read from and write to the EffectComposer's
// ping-ponged targets.
//
// PERFORMANCE MONITOR:
// An optional FPS-based auto-disable mechanism samples the frame rate after
// a warmup period.  If the average falls below the configured threshold,
// the SSAO + blur passes are disabled and a user-facing toast message is
// shown (worded as "Shadows" for non-technical users).
//
// CONFIG (Na__AppConfig__Main.json → RenderEffect__AmbientOcclusion):
//   Enabled          — boolean toggle
//   RadiusMm         — world-space sampling hemisphere radius (mm)
//   Intensity        — occlusion strength multiplier (0-2)
//   Bias             — minimum depth difference to count as occluded
//   Samples          — number of hemisphere kernel samples
//   CullDistanceMm   — max distance from camera for AO (mm); 0 = unlimited
//   BlurRadius       — texel spread multiplier for the blur pass
//   FpsThreshold     — auto-disable threshold (fps)
//   FpsSampleFrames  — frames to average for performance check
//   DebugMode        — 0=off, 1=raw depth, 2=linear Z, 3=normals, 4=raw AO
//
// SHADER SOURCE:
// GLSL code lives in the companion file
//   Na__RenderEffect__AmbientOcclusion__Shader.js
// to keep shader source cleanly separated from JS orchestration.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js, Post Processing, Unit Conversion, Shader Source
    // ------------------------------------------------------------
    import * as THREE from 'three';
    import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
    import { Na__Math__ConvertMmToUnits } from '../04__MathUtils/Na__Math__Units.js';
    import {
        Na__AoShader__VertexSource,
        Na__AoShader__FragmentSource,
        Na__AoBlurShader__FragmentSource
    } from './Na__RenderEffect__AmbientOcclusion__Shader.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Hemisphere Kernel Generation
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Generate SSAO Hemisphere Sample Kernel
    //
    // Creates `sampleCount` random UNIT directions in a hemisphere oriented
    // along +Z.  The kernel is later oriented to the surface normal via a TBN
    // matrix in the fragment shader.
    //
    // THE COSINE WEIGHTING LIVES IN THE SHADER, NOT HERE.
    // Samples are still weighted toward the surface so nearby geometry
    // contributes more - but that weighting is applied per frame against the
    // number of samples the frame is actually walking (uAoActiveSamples), not
    // baked into the vector lengths here.  Baked in, a frame on a reduced
    // budget would inherit a PREFIX of the weighting - every sample bunched
    // against the surface, a hard contact line with none of the falloff - and
    // the moving image would not match the still it settles into.
    // ------------------------------------------------------------
    function Na__AmbientOcclusion__GenerateKernel(sampleCount) {
        const kernel = [];
        for (let i = 0; i < sampleCount; i++) {
            const sample = new THREE.Vector3(
                Math.random() * 2.0 - 1.0,
                Math.random() * 2.0 - 1.0,
                Math.random()
            );
            sample.normalize();                                            // <-- Direction only; the shader scales it
            kernel.push(sample);
        }
        return kernel;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | SSAO Shader Definition (assembled from external GLSL source)
// -----------------------------------------------------------------------------

    // FUNCTION | Assemble SSAO shader object from external GLSL source
    //
    // Combines the vertex/fragment strings imported from the companion Shader
    // file with the Three.js uniform dictionary.  The fragment shader is a
    // template requiring sampleCount so that the kernel loop is unrolled at
    // compile time (GLSL does not allow variable-length for-loops on all
    // drivers).
    // ------------------------------------------------------------
    function Na__AmbientOcclusion__BuildShader(sampleCount) {
        return {
            uniforms: {
                'tDiffuse'                 : { value: null },
                'tDepth'                   : { value: null },
                'uCameraFar'               : { value: 1000.0 },
                'uCameraNear'              : { value: 0.1 },
                'uInverseProjectionMatrix' : { value: new THREE.Matrix4() },
                'uProjectionMatrix'        : { value: new THREE.Matrix4() },
                'uResolution'              : { value: new THREE.Vector2(1, 1) },
                'uAoRadius'                : { value: 0.05 },
                'uAoIntensity'             : { value: 0.7 },
                'uAoBias'                  : { value: 0.025 },
                'uKernel'                  : { value: [] },
                'uAoEnabled'               : { value: 1.0 },
                'uAoCullDistance'           : { value: 0.0 },
                'uAoActiveSamples'         : { value: sampleCount },
                'uAoNoiseOffset'           : { value: 0.0 },
                'uDebugMode'               : { value: 0 }
            },
            vertexShader:   Na__AoShader__VertexSource,
            fragmentShader: Na__AoShader__FragmentSource(sampleCount)
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | AO Blur Shader Definition
// -----------------------------------------------------------------------------

    // FUNCTION | Assemble AO Blur shader object from external GLSL source
    //
    // Produces a ShaderPass-compatible object for a 5×5 gaussian blur.
    // uBlurRadius scales the texel-offset multiplier:
    //   1.0 → standard 5×5, 2.0 → wider spread.
    // ------------------------------------------------------------
    function Na__AoBlur__BuildShader() {
        return {
            uniforms: {
                'tDiffuse'    : { value: null },
                'uResolution' : { value: new THREE.Vector2(1, 1) },
                'uBlurRadius' : { value: 1.0 }
            },
            vertexShader:   Na__AoShader__VertexSource,
            fragmentShader: Na__AoBlurShader__FragmentSource
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | AO + Blur Pass Creation
// -----------------------------------------------------------------------------

    // FUNCTION | Create Ambient Occlusion + Blur Post-Processing Passes
    //
    // Returns an object containing:
    //   aoPass         – the main SSAO ShaderPass
    //   blurPass       – the gaussian blur ShaderPass
    //   updateUniforms – call per-frame to sync camera matrices
    //   setSize        – call on window resize to update resolution uniforms
    //   disable        – turns off both passes (used by perf monitor)
    //
    // Parameters:
    //   camera        – the scene perspective camera
    //   aoConfig      – the RenderEffect__AmbientOcclusion block from AppConfig
    //   depthTexture  – the DepthTexture from the dedicated depth pre-pass RT
    // ------------------------------------------------------------
    function Na__RenderEffect__AmbientOcclusion__Create(camera, aoConfig, depthTexture) {
        const sampleCount = (aoConfig && Number.isFinite(aoConfig.RenderEffect__AmbientOcclusion__Samples))
            ? aoConfig.RenderEffect__AmbientOcclusion__Samples
            : 16;

        const radiusMm = (aoConfig && Number.isFinite(aoConfig.RenderEffect__AmbientOcclusion__RadiusMm))
            ? aoConfig.RenderEffect__AmbientOcclusion__RadiusMm
            : 50;
        const intensity = (aoConfig && Number.isFinite(aoConfig.RenderEffect__AmbientOcclusion__Intensity))
            ? aoConfig.RenderEffect__AmbientOcclusion__Intensity
            : 0.7;
        const bias = (aoConfig && Number.isFinite(aoConfig.RenderEffect__AmbientOcclusion__Bias))
            ? aoConfig.RenderEffect__AmbientOcclusion__Bias
            : 0.025;
        const blurRadius = (aoConfig && Number.isFinite(aoConfig.RenderEffect__AmbientOcclusion__BlurRadius))
            ? aoConfig.RenderEffect__AmbientOcclusion__BlurRadius
            : 1.5;
        const cullDistanceMm = (aoConfig && Number.isFinite(aoConfig.RenderEffect__AmbientOcclusion__CullDistanceMm))
            ? aoConfig.RenderEffect__AmbientOcclusion__CullDistanceMm
            : 0;
        const cullDistanceUnits = (cullDistanceMm > 0) ? Na__Math__ConvertMmToUnits(cullDistanceMm) : 0.0;

        // THE MOVING BUDGET | How many of the kernel's samples an ordinary frame walks
        // ------------------------------------------------------------
        // sampleCount is the CEILING: the loop is unrolled at that length in the
        // shader and cannot exceed it.  An ordinary frame walks this many instead,
        // because a moving image is the one nobody studies - and because the
        // refinement burst that follows recovers the quality and then some, by
        // averaging sixteen differently-rotated kernels into the parked image.
        // ------------------------------------------------------------
        const samplesWhileMoving = Math.max(1, Math.min(sampleCount,
            (aoConfig && Number.isFinite(aoConfig.RenderEffect__AmbientOcclusion__SamplesWhileMoving))
                ? Math.round(aoConfig.RenderEffect__AmbientOcclusion__SamplesWhileMoving)
                : sampleCount));                                           // <-- Absent key means no reduction at all

        const radiusUnits = Na__Math__ConvertMmToUnits(radiusMm);
        const kernel      = Na__AmbientOcclusion__GenerateKernel(sampleCount);

        // ----- SSAO pass -----
        const shader = Na__AmbientOcclusion__BuildShader(sampleCount);
        const aoPass = new ShaderPass(shader);

        aoPass.material.depthWrite = false;
        aoPass.material.depthTest  = false;

        aoPass.uniforms['tDepth'].value                   = depthTexture;
        aoPass.uniforms['uAoRadius'].value                = radiusUnits;
        aoPass.uniforms['uAoIntensity'].value             = intensity;
        aoPass.uniforms['uAoBias'].value                  = bias;
        aoPass.uniforms['uCameraFar'].value               = camera.far;
        aoPass.uniforms['uCameraNear'].value              = camera.near;
        aoPass.uniforms['uInverseProjectionMatrix'].value.copy(camera.projectionMatrixInverse);
        aoPass.uniforms['uProjectionMatrix'].value.copy(camera.projectionMatrix);
        aoPass.uniforms['uResolution'].value.set(window.innerWidth, window.innerHeight);
        aoPass.uniforms['uKernel'].value                  = kernel;
        aoPass.uniforms['uAoEnabled'].value               = 1.0;
        aoPass.uniforms['uAoCullDistance'].value           = cullDistanceUnits;
        aoPass.uniforms['uDebugMode'].value               = aoConfig.RenderEffect__AmbientOcclusion__DebugMode || 0;

        // ----- AO Blur pass -----
        const blurShader = Na__AoBlur__BuildShader();
        const blurPass   = new ShaderPass(blurShader);

        blurPass.material.depthWrite = false;
        blurPass.material.depthTest  = false;

        blurPass.uniforms['uBlurRadius'].value  = blurRadius;
        blurPass.uniforms['uResolution'].value.set(window.innerWidth, window.innerHeight);

        // ----- Per-frame camera sync -----
        function updateUniforms(cam) {
            if (!cam) return;
            aoPass.uniforms['uCameraFar'].value  = cam.far;
            aoPass.uniforms['uCameraNear'].value = cam.near;
            aoPass.uniforms['uInverseProjectionMatrix'].value.copy(cam.projectionMatrixInverse);
            aoPass.uniforms['uProjectionMatrix'].value.copy(cam.projectionMatrix);
        }

        // ----- Resize handler -----
        function setSize(width, height) {
            aoPass.uniforms['uResolution'].value.set(width, height);
            blurPass.uniforms['uResolution'].value.set(width, height);
        }

        // ----- Quality budget: BORROWED for a draw, always put back -----
        //
        // The AO pass is shared. A still export, a video export and a Layout
        // Editor snapshot all borrow this composer and render through it without
        // saying anything about quality, so they get whatever the last caller
        // left behind. A reduced budget must therefore never outlive the single
        // draw that asked for it: the render loop sets it immediately before an
        // ordinary frame and restores full quality immediately after, the same
        // discipline the refiner already uses for FXAA and renderToScreen.
        // Full quality is the resting state, so anything that does not ask gets
        // the best the effect can do.
        // ------------------------------------------------------------
        const GOLDEN_RATIO_CONJUGATE = 0.6180339887498949;                 // <-- Successive multiples spread evenly over 0..1

        function setFullQuality() {
            aoPass.uniforms['uAoActiveSamples'].value = sampleCount;
            aoPass.uniforms['uAoNoiseOffset'].value   = 0.0;
        }

        function setLiveQuality() {
            aoPass.uniforms['uAoActiveSamples'].value = samplesWhileMoving;
            aoPass.uniforms['uAoNoiseOffset'].value   = 0.0;               // <-- Screen-static noise; a rotating pattern fizzes
        }

        function setRefineSample(index) {
            const safeIndex = Number.isFinite(index) ? Math.max(0, index) : 0;
            aoPass.uniforms['uAoActiveSamples'].value = sampleCount;
            aoPass.uniforms['uAoNoiseOffset'].value   = (safeIndex * GOLDEN_RATIO_CONJUGATE) % 1;
        }

        // ----- Disable both passes (perf monitor or manual) -----
        function disable() {
            aoPass.enabled   = false;
            blurPass.enabled = false;
            aoPass.uniforms['uAoEnabled'].value = 0.0;
        }

        // ----- Re-enable both passes (Settings toggle) -----
        function enable() {
            aoPass.enabled   = true;
            blurPass.enabled = true;
            aoPass.uniforms['uAoEnabled'].value = 1.0;
        }

        return {
            pass: aoPass, blurPass, updateUniforms, setSize, disable, enable,
            setFullQuality, setLiveQuality, setRefineSample,
            sampleCount, samplesWhileMoving
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Performance Monitor
// -----------------------------------------------------------------------------

    // FUNCTION | Create FPS-Based Auto-Disable Monitor
    //
    // After an initial warmup period (WARMUP_FRAMES) the monitor begins
    // sampling the DURATION of ordinary frames that arrive back to back.
    // Once `sampleFrames` such frames have been collected their mean gives the
    // average FPS, which is compared against `fpsThreshold`.  If below threshold:
    //   1. Both the SSAO and blur passes are disabled via aoState.disable()
    //   2. A user-facing toast says "Shadows have been switched off…"
    //
    // The word "shadows" is deliberately used instead of "ambient occlusion"
    // because end users are architects, not graphics programmers.
    //
    // This function is called once and returns a monitorFrame callback to be
    // invoked from the render loop.
    // ------------------------------------------------------------
    function Na__RenderEffect__AmbientOcclusion__CreatePerformanceMonitor(aoState, aoConfig) {
        const fpsThreshold   = (aoConfig && Number.isFinite(aoConfig.RenderEffect__AmbientOcclusion__FpsThreshold))
            ? aoConfig.RenderEffect__AmbientOcclusion__FpsThreshold
            : 24;
        const sampleFrames   = (aoConfig && Number.isFinite(aoConfig.RenderEffect__AmbientOcclusion__FpsSampleFrames))
            ? aoConfig.RenderEffect__AmbientOcclusion__FpsSampleFrames
            : 120;

        const WARMUP_FRAMES   = 60;

        // MEASURE THE FRAMES, NOT THE WALL CLOCK.
        // This used to time 120 sampled frames end to end and divide, which is
        // only an fps if frames arrive back to back. They do not. The render
        // loop is invalidation based, so it draws while something is moving and
        // then STOPS, and the caller deliberately withholds refinement chunks
        // from this monitor because one chunk is several frames of work in one.
        // Both gaps land in the elapsed time while contributing no counted
        // frames, so a locked 60fps machine measured 8 to 17fps depending only
        // on how long its user spent LOOKING at the scene, and AO was switched
        // off underneath them with a message blaming their hardware.
        // Averaging the per-frame deltas instead makes the measurement care
        // about how long a frame takes and not about when the next one is
        // asked for, which is the only question worth asking here.
        const FRAME_MIN_MS      = 2;                                   // <-- Below this the timestamp is noise, not a frame
        const FRAME_MAX_MS      = 250;                                 // <-- Above this the loop was idle, not slow
        const FRAME_CONTINUITY_MS = 250;                               // <-- Gap after which the previous frame is not a neighbour

        let frameCount        = 0;
        let lastFrameAt       = 0;
        let sampleDeltaSum    = 0;
        let sampleFrameCount  = 0;
        let triggered         = false;

        function monitorFrame(deltaMs) {
            if (triggered) return;
            frameCount++;

            if (frameCount <= WARMUP_FRAMES) return;

            // NEIGHBOURS ONLY. deltaMs is measured from the previous TICK, which
            // may have been a refinement chunk or the last frame before a long
            // idle. Either way it measures a gap rather than this frame's cost,
            // so the first ordinary frame after one is not a sample.
            const now         = performance.now();
            const isNeighbour = lastFrameAt > 0 && (now - lastFrameAt) < FRAME_CONTINUITY_MS;
            lastFrameAt       = now;
            if (!isNeighbour) return;
            if (!(deltaMs >= FRAME_MIN_MS && deltaMs <= FRAME_MAX_MS)) return;

            sampleDeltaSum += deltaMs;
            sampleFrameCount++;

            if (sampleFrameCount >= sampleFrames) {
                const avgFps   = 1000 / (sampleDeltaSum / sampleFrameCount);
                triggered = true;

                if (avgFps < fpsThreshold) {
                    aoState.disable();
                    window.dispatchEvent(new CustomEvent('na-show-toast', {
                        detail: {
                            message: 'Shadows have been switched off to improve performance. For the full experience, please use a more capable device.',
                            isError: false
                        }
                    }));
                    window.dispatchEvent(new CustomEvent('na-ao-disabled'));
                    console.warn(`[TrueVision3D] AO auto-disabled: avg ${avgFps.toFixed(1)} fps < ${fpsThreshold} fps threshold`);
                } else {
                    console.log(`[TrueVision3D] AO performance OK: avg ${avgFps.toFixed(1)} fps`);
                }
            }
        }

        return monitorFrame;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Ambient Occlusion API
    // ------------------------------------------------------------
    export {
        Na__RenderEffect__AmbientOcclusion__Create,
        Na__RenderEffect__AmbientOcclusion__CreatePerformanceMonitor
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
