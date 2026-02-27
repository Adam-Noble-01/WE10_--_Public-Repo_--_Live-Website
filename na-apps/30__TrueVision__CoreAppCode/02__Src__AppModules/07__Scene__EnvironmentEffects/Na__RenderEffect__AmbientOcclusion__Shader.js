// =============================================================================
// TRUEVISION3D - SSAO SHADER SOURCE (GLSL)
// =============================================================================
//
// FILE       : Na__RenderEffect__AmbientOcclusion__Shader.js
// NAMESPACE  : Na__AoShader
// PURPOSE    : GLSL source strings for the SSAO and AO-blur post-processing
//              passes, kept separate from the JS orchestration logic.
//
// SHADERS:
//   1. SSAO pass (vertex + fragment)  —  hemisphere-sampled screen-space
//      ambient occlusion with logarithmic depth buffer inversion.
//   2. AO blur pass (vertex + fragment)  —  lightweight 5x5 gaussian blur
//      applied after the SSAO pass to smooth per-pixel noise artefacts.
//
// LOGARITHMIC DEPTH NOTES:
//   Three.js writes:
//     gl_FragDepth = log2(1.0 + clipW) / log2(cameraFar + 1.0)
//   Inversion used here:
//     clipW = pow(cameraFar + 1.0, storedDepth) - 1.0
//   This is the same formula proven in the fog pass
//   (Na__Scene__DefaultFogEffect.js).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Shared Vertex Shader
// -----------------------------------------------------------------------------

    // SHADER SOURCE | Fullscreen-quad vertex shader (reused by both passes)
    // ------------------------------------------------------------
    const Na__AoShader__VertexSource = /* glsl */`
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | SSAO Fragment Shader
// -----------------------------------------------------------------------------

    // SHADER SOURCE | SSAO fragment shader (requires sampleCount via template)
    // ------------------------------------------------------------
    function Na__AoShader__FragmentSource(sampleCount) {
        return /* glsl */`
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
            uniform float     uAoCullDistance;
            uniform int       uDebugMode;

            varying vec2 vUv;

            // Invert Three.js logarithmic depth buffer encoding.
            // Three.js writes: gl_FragDepthEXT = log2(1.0 + w) / log2(far + 1.0)
            // Inversion: clipW = pow(far + 1.0, storedDepth) - 1.0
            float reconstructClipW(float storedDepth) {
                return pow(uCameraFar + 1.0, storedDepth) - 1.0;
            }

            // Reconstruct the view-space position for a given screen UV.
            // Builds a ray through the pixel via the inverse projection matrix,
            // then scales it by the recovered clip-space W (distance from camera).
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

            // OUTPUT CONVENTION:
            // RGB = sharp, unmodified scene colour (passed through from tDiffuse).
            // Alpha = AO factor (1.0 = no shadow, <1.0 = occluded).
            // The downstream AO-blur pass blurs ONLY the alpha channel and
            // then composites: sharpRgb * blurredAlpha.  This keeps geometry
            // edges perfectly crisp while smoothing the noisy AO boundaries.

            void main() {
                vec4 texel = texture2D(tDiffuse, vUv);

                if (uAoEnabled < 0.5) {
                    gl_FragColor = vec4(texel.rgb, 1.0);
                    return;
                }

                float centerDepth = texture2D(tDepth, vUv).x;

                // --- Debug visualisation modes (set via AppConfig DebugMode) ---
                if (uDebugMode == 1) {
                    gl_FragColor = vec4(vec3(centerDepth), 1.0);
                    return;
                }

                if (centerDepth >= 1.0) {
                    gl_FragColor = vec4(texel.rgb, 1.0);
                    return;
                }

                if (uDebugMode == 2) {
                    vec3 vp = getViewPosition(vUv);
                    float normalizedZ = clamp(-vp.z / uCameraFar, 0.0, 1.0);
                    gl_FragColor = vec4(vec3(normalizedZ), 1.0);
                    return;
                }

                vec3 viewPos = getViewPosition(vUv);

                // Cull distance — skip the expensive kernel loop for pixels
                // beyond the configured maximum AO range from the camera.
                // Uses a smooth fade-out over the last 20% of the cull range
                // so the AO doesn't pop off abruptly at the boundary.
                float pixelDist = -viewPos.z;
                if (uAoCullDistance > 0.0 && pixelDist > uAoCullDistance) {
                    gl_FragColor = vec4(texel.rgb, 1.0);
                    return;
                }
                float cullFade = 1.0;
                if (uAoCullDistance > 0.0) {
                    float fadeStart = uAoCullDistance * 0.8;
                    cullFade = 1.0 - smoothstep(fadeStart, uAoCullDistance, pixelDist);
                }

                vec3 normal  = normalize(cross(dFdx(viewPos), dFdy(viewPos)));

                if (uDebugMode == 3) {
                    gl_FragColor = vec4(normal * 0.5 + 0.5, 1.0);
                    return;
                }

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
                    vec3 ks = uKernel[i];
                    vec3 rotatedSample = vec3(
                        ks.x * cosA - ks.y * sinA,
                        ks.x * sinA + ks.y * cosA,
                        ks.z
                    );

                    vec3 samplePos = viewPos + TBN * rotatedSample * uAoRadius;

                    vec4 projected = uProjectionMatrix * vec4(samplePos, 1.0);
                    vec2 sampleUv  = (projected.xy / projected.w) * 0.5 + 0.5;

                    if (sampleUv.x < 0.0 || sampleUv.x > 1.0 || sampleUv.y < 0.0 || sampleUv.y > 1.0) continue;

                    float sampleStoredDepth = texture2D(tDepth, sampleUv).x;
                    if (sampleStoredDepth >= 1.0) continue;

                    vec3 actualViewPos = getViewPosition(sampleUv);

                    // Occlusion: actual surface is closer to camera than our sample point.
                    // In view space z is negative; more negative = further from camera.
                    float depthDiff = actualViewPos.z - samplePos.z;

                    // Range check prevents contribution from surfaces far beyond the AO radius
                    float rangeCheck = smoothstep(0.0, 1.0, uAoRadius / (abs(depthDiff) + 0.0001));
                    float aoContrib  = step(uAoBias, depthDiff) * rangeCheck;

                    occlusion  += aoContrib;
                    validCount += 1.0;
                }

                float aoFactor = (validCount > 0.0) ? (occlusion / validCount) : 0.0;

                if (uDebugMode == 4) {
                    gl_FragColor = vec4(vec3(aoFactor), 1.0);
                    return;
                }

                float finalAo = 1.0 - aoFactor * uAoIntensity * cullFade;

                // Store sharp colour in RGB, AO factor in alpha for blur pass
                gl_FragColor = vec4(texel.rgb, finalAo);
            }
        `;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | AO Blur Fragment Shader
// -----------------------------------------------------------------------------

    // SHADER SOURCE | Alpha-only 5x5 Gaussian blur for AO noise smoothing.
    //
    // The upstream SSAO pass stores the sharp scene colour in RGB and the
    // raw AO factor in the alpha channel.  This blur pass reads the center
    // pixel's RGB (keeping geometry perfectly crisp) and blurs ONLY the
    // alpha channel across a 5x5 gaussian kernel.  The final output is:
    //
    //   gl_FragColor = vec4(sharpRgb * blurredAo, 1.0)
    //
    // This ensures AO shadow edges are softened while lines, textures and
    // geometry remain razor-sharp.
    //
    // uBlurRadius controls the texel spread multiplier (1.0 = standard 5x5).
    // ------------------------------------------------------------
    const Na__AoBlurShader__FragmentSource = /* glsl */`
        precision highp float;

        uniform sampler2D tDiffuse;
        uniform vec2      uResolution;
        uniform float     uBlurRadius;

        varying vec2 vUv;

        void main() {
            vec2  texelSize = 1.0 / uResolution;
            vec4  center    = texture2D(tDiffuse, vUv);

            // Blur only the alpha channel (AO factor)
            float aoSum  = 0.0;
            float totalW = 0.0;

            for (int x = -2; x <= 2; x++) {
                for (int y = -2; y <= 2; y++) {
                    vec2  offset = vec2(float(x), float(y)) * texelSize * uBlurRadius;
                    float weight = exp(-float(x * x + y * y) / 4.0);
                    aoSum  += texture2D(tDiffuse, vUv + offset).a * weight;
                    totalW += weight;
                }
            }

            float blurredAo = aoSum / totalW;

            // Composite: sharp scene colour * smoothed AO factor
            gl_FragColor = vec4(center.rgb * blurredAo, 1.0);
        }
    `;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Shader Sources
    // ------------------------------------------------------------
    export {
        Na__AoShader__VertexSource,
        Na__AoShader__FragmentSource,
        Na__AoBlurShader__FragmentSource
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
