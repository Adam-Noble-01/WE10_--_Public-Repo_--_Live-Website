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
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js, Post Processing, Unit Conversion
    // ------------------------------------------------------------
    import * as THREE from 'three';
    import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
    import { Na__Math__ConvertMmToUnits } from '../04__MathUtils/Na__Math__Units.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Hemisphere Kernel Generation
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Generate SSAO Hemisphere Sample Kernel
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
// REGION | SSAO Shader Definition
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Custom SSAO Shader (Log-Depth Compatible)
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
                'uAoEnabled'               : { value: 1.0 }
            },

            vertexShader: /* glsl */`
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,

            fragmentShader: /* glsl */`
                precision highp float;

                uniform sampler2D tDiffuse;
                uniform sampler2D tDepth;
                uniform float     uCameraFar;
                uniform float     uCameraNear;
                uniform mat4      uInverseProjectionMatrix;
                uniform mat4      uProjectionMatrix;
                uniform vec2      uResolution;
                uniform float     uAoRadius;
                uniform float     uAoIntensity;
                uniform float     uAoBias;
                uniform vec3      uKernel[${sampleCount}];
                uniform float     uAoEnabled;

                varying vec2 vUv;

                // Invert Three.js logarithmic depth buffer encoding.
                // Three.js writes: gl_FragDepthEXT = log2(1.0 + w) / log2(far + 1.0)
                // Inversion: clipW = pow(far + 1.0, storedDepth) - 1.0
                float reconstructClipW(float storedDepth) {
                    return pow(uCameraFar + 1.0, storedDepth) - 1.0;
                }

                vec3 getViewPosition(vec2 screenUv) {
                    float depth = texture2D(tDepth, screenUv).x;
                    if (depth >= 1.0) return vec3(0.0);

                    float clipW = reconstructClipW(depth);

                    vec2 ndc = screenUv * 2.0 - 1.0;
                    vec4 clipPos = vec4(ndc, 0.0, 1.0);
                    vec4 viewRay = uInverseProjectionMatrix * clipPos;
                    vec3 viewDir = normalize(viewRay.xyz / viewRay.w);

                    return viewDir * (clipW / max(-viewDir.z, 0.0001));
                }

                void main() {
                    vec4 texel = texture2D(tDiffuse, vUv);

                    if (uAoEnabled < 0.5) {
                        gl_FragColor = texel;
                        return;
                    }

                    float centerDepth = texture2D(tDepth, vUv).x;
                    if (centerDepth >= 1.0) {
                        gl_FragColor = texel;
                        return;
                    }

                    vec3 viewPos = getViewPosition(vUv);
                    vec3 normal  = normalize(cross(dFdx(viewPos), dFdy(viewPos)));

                    // Per-pixel noise rotation to break banding
                    float noiseAngle = fract(sin(dot(vUv * uResolution, vec2(12.9898, 78.233))) * 43758.5453) * 6.283185;
                    float cosA = cos(noiseAngle);
                    float sinA = sin(noiseAngle);

                    // Build TBN matrix to orient hemisphere to surface normal
                    vec3 tangent = abs(normal.y) < 0.999
                        ? normalize(cross(normal, vec3(0.0, 1.0, 0.0)))
                        : normalize(cross(normal, vec3(1.0, 0.0, 0.0)));
                    vec3 bitangent = cross(normal, tangent);
                    mat3 TBN = mat3(tangent, bitangent, normal);

                    float occlusion   = 0.0;
                    float validCount  = 0.0;

                    for (int i = 0; i < ${sampleCount}; i++) {
                        // Rotate kernel sample by noise angle (XY plane)
                        vec3 ks = uKernel[i];
                        vec3 rotatedSample = vec3(
                            ks.x * cosA - ks.y * sinA,
                            ks.x * sinA + ks.y * cosA,
                            ks.z
                        );

                        vec3 samplePos = viewPos + TBN * rotatedSample * uAoRadius;

                        // Project sample back to screen space
                        vec4 projected = uProjectionMatrix * vec4(samplePos, 1.0);
                        vec2 sampleUv  = (projected.xy / projected.w) * 0.5 + 0.5;

                        if (sampleUv.x < 0.0 || sampleUv.x > 1.0 || sampleUv.y < 0.0 || sampleUv.y > 1.0) continue;

                        float sampleStoredDepth = texture2D(tDepth, sampleUv).x;
                        if (sampleStoredDepth >= 1.0) continue;

                        vec3 actualViewPos = getViewPosition(sampleUv);

                        // Occlusion: actual surface is closer to camera than our sample point
                        // In view space z is negative; more negative = further from camera
                        float depthDiff = actualViewPos.z - samplePos.z;

                        // Range check prevents contribution from surfaces far beyond the AO radius
                        float rangeCheck = smoothstep(0.0, 1.0, uAoRadius / (abs(depthDiff) + 0.0001));
                        float aoContrib  = step(uAoBias, depthDiff) * rangeCheck;

                        occlusion  += aoContrib;
                        validCount += 1.0;
                    }

                    float aoFactor = (validCount > 0.0) ? (occlusion / validCount) : 0.0;
                    float finalAo  = 1.0 - aoFactor * uAoIntensity;

                    gl_FragColor = vec4(texel.rgb * finalAo, texel.a);
                }
            `
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | AO Pass Creation
// -----------------------------------------------------------------------------

    // FUNCTION | Create Ambient Occlusion Post-Processing Pass
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

        const radiusUnits = Na__Math__ConvertMmToUnits(radiusMm);
        const kernel      = Na__AmbientOcclusion__GenerateKernel(sampleCount);
        const shader      = Na__AmbientOcclusion__BuildShader(sampleCount);
        const aoPass      = new ShaderPass(shader);

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

        function updateUniforms(cam) {
            if (!cam) return;
            aoPass.uniforms['uCameraFar'].value  = cam.far;
            aoPass.uniforms['uCameraNear'].value = cam.near;
            aoPass.uniforms['uInverseProjectionMatrix'].value.copy(cam.projectionMatrixInverse);
            aoPass.uniforms['uProjectionMatrix'].value.copy(cam.projectionMatrix);
        }

        function setSize(width, height) {
            aoPass.uniforms['uResolution'].value.set(width, height);
        }

        function disable() {
            aoPass.enabled = false;
            aoPass.uniforms['uAoEnabled'].value = 0.0;
        }

        return { pass: aoPass, updateUniforms, setSize, disable };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Performance Monitor
// -----------------------------------------------------------------------------

    // FUNCTION | Create FPS-Based Auto-Disable Monitor
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
