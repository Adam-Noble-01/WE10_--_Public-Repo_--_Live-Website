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
    // Creates `sampleCount` random points inside a unit hemisphere oriented
    // along +Z.  Samples are cosine-weighted toward the surface (small scale
    // values for early samples) so nearby geometry contributes more.
    // The kernel is later oriented to the surface normal via a TBN matrix
    // in the fragment shader.
    // ------------------------------------------------------------
    function Na__AmbientOcclusion__GenerateKernel(sampleCount) {
        const kernel = [];
        for (let i = 0; i < sampleCount; i++) {
            const sample = new THREE.Vector3(
                Math.random() * 2.0 - 1.0,
                Math.random() * 2.0 - 1.0,
                Math.random()
            );
            sample.normalize();

            let scale = i / sampleCount;
            scale = 0.1 + scale * scale * 0.9;
            sample.multiplyScalar(scale);

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

        return { pass: aoPass, blurPass, updateUniforms, setSize, disable, enable };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Performance Monitor
// -----------------------------------------------------------------------------

    // FUNCTION | Create FPS-Based Auto-Disable Monitor
    //
    // After an initial warmup period (WARMUP_FRAMES) the monitor begins
    // counting frames.  Once `sampleFrames` have been collected the average
    // FPS is compared against `fpsThreshold`.  If below threshold:
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
        let frameCount        = 0;
        let sampleStartTime   = 0;
        let sampleFrameCount  = 0;
        let triggered         = false;

        function monitorFrame(deltaMs) {
            if (triggered) return;
            frameCount++;

            if (frameCount <= WARMUP_FRAMES) return;

            if (sampleFrameCount === 0) {
                sampleStartTime = performance.now();
            }
            sampleFrameCount++;

            if (sampleFrameCount >= sampleFrames) {
                const elapsed  = performance.now() - sampleStartTime;
                const avgFps   = (sampleFrames / elapsed) * 1000;
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
