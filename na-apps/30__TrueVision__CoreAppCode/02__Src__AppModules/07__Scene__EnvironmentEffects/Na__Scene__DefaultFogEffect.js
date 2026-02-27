// -----------------------------------------------------------------------------
// REGION | Scene Environment Effects - Post-Processing Orbit Anchored Fog
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js, Post Processing, Unit Conversion
    // ------------------------------------------------------------
    import * as THREE from 'three';
    import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
    import { Na__Math__ConvertMmToUnits } from '../04__MathUtils/Na__Math__Units.js';
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Orbit Anchor Fog Shader Definition
    // ------------------------------------------------------------
    const Na__Scene__FogShader = {

        uniforms: {
            'tDiffuse'                 : { value: null },
            'tDepth'                   : { value: null },
            'uCameraFar'               : { value: 1000.0 },
            'uInverseProjectionMatrix' : { value: new THREE.Matrix4() },
            'uCameraWorldMatrix'       : { value: new THREE.Matrix4() },
            'uCameraPosition'          : { value: new THREE.Vector3() },
            'uOrbitAnchor'             : { value: new THREE.Vector3() },
            'uFogColor'                : { value: new THREE.Vector3(1.0, 1.0, 1.0) },
            'uFogStart'                : { value: 30.0 },
            'uFogEnd'                  : { value: 50.0 },
            'uFogEnabled'              : { value: 1.0 }
        },

        vertexShader: /* glsl */`
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,

        fragmentShader: /* glsl */`
            uniform sampler2D tDiffuse;
            uniform sampler2D tDepth;
            uniform float     uCameraFar;
            uniform mat4      uInverseProjectionMatrix;
            uniform mat4      uCameraWorldMatrix;
            uniform vec3      uCameraPosition;
            uniform vec3      uOrbitAnchor;
            uniform vec3      uFogColor;
            uniform float     uFogStart;
            uniform float     uFogEnd;
            uniform float     uFogEnabled;

            varying vec2 vUv;

            void main() {
                vec4 texel = texture2D(tDiffuse, vUv);

                if (uFogEnabled < 0.5) {
                    gl_FragColor = texel;
                    return;
                }

                float storedDepth = texture2D(tDepth, vUv).x;

                // Background pixels have depth = 1.0; leave them untouched
                if (storedDepth >= 1.0) {
                    gl_FragColor = texel;
                    return;
                }

                // Reconstruct view-space distance from logarithmic depth buffer.
                // Three.js writes: gl_FragDepth = log2(1.0 + clipW) / log2(far + 1.0)
                // Invert to recover clipW (≈ view-space distance from camera).
                float clipW = pow(uCameraFar + 1.0, storedDepth) - 1.0;

                // Build a view-space ray through this pixel and scale by clipW
                vec2 ndc = vUv * 2.0 - 1.0;
                vec4 clipPos = vec4(ndc, 0.0, 1.0);
                vec4 viewRay = uInverseProjectionMatrix * clipPos;
                vec3 viewDir = normalize(viewRay.xyz / viewRay.w);
                vec3 viewPosition = viewDir * (clipW / max(-viewDir.z, 0.0001));

                // Transform from view space to world space
                vec4 worldPos = uCameraWorldMatrix * vec4(viewPosition, 1.0);

                // Distance from orbit anchor in world space
                float dist = distance(worldPos.xyz, uOrbitAnchor);

                // Fog envelope: 0.0 before start, ramp 0->1 between start..end, 1.0 after end
                float fogFactor = smoothstep(uFogStart, uFogEnd, dist);

                vec3 finalColor = mix(texel.rgb, uFogColor, fogFactor);
                gl_FragColor = vec4(finalColor, texel.a);
            }
        `
    };
    // ------------------------------------------------------------


    // HELPER FUNCTION | Resolve Orbit Anchor Into a Vector3 (scene units)
    // ------------------------------------------------------------
    function Na__Scene__Fog__ResolveAnchor(orbitReference, outputVector) {
        if (!orbitReference) return;

        if (orbitReference.isVector3) {
            outputVector.copy(orbitReference);
            return;
        }

        if (orbitReference.centerPosition && orbitReference.centerPosition.isVector3) {
            outputVector.copy(orbitReference.centerPosition);
            return;
        }

        if (orbitReference.getWorldPosition && typeof orbitReference.getWorldPosition === 'function') {
            orbitReference.getWorldPosition(outputVector);
            return;
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Create Post-Processing Fog Pass From AppConfig
    // ------------------------------------------------------------
    function Na__Scene__CreateFogPass(fogConfig) {
        const fogPass = new ShaderPass(Na__Scene__FogShader);

        const fogEnabled = Boolean(fogConfig && fogConfig.Scene__Default__FogConfig__Enabled === true);
        const fogColorHex = (fogConfig && Number.isFinite(fogConfig.Scene__Default__FogConfig__Color))
            ? fogConfig.Scene__Default__FogConfig__Color
            : 16777215;
        const startDistanceMm = (fogConfig && Number.isFinite(fogConfig.Scene__Default__FogConfig__StartDistanceMm))
            ? fogConfig.Scene__Default__FogConfig__StartDistanceMm
            : 30000;
        const endDistanceMm = (fogConfig && Number.isFinite(fogConfig.Scene__Default__FogConfig__EndDistanceMm))
            ? fogConfig.Scene__Default__FogConfig__EndDistanceMm
            : 50000;

        const startUnits = Na__Math__ConvertMmToUnits(startDistanceMm); // <-- MM to scene units
        const endUnits   = Na__Math__ConvertMmToUnits(endDistanceMm);   // <-- MM to scene units

        const fogColor = new THREE.Color(fogColorHex);
        fogPass.uniforms['uFogColor'].value.set(fogColor.r, fogColor.g, fogColor.b);
        fogPass.uniforms['uFogStart'].value   = startUnits;
        fogPass.uniforms['uFogEnd'].value     = Math.max(endUnits, startUnits + 0.001);
        fogPass.uniforms['uFogEnabled'].value = fogEnabled ? 1.0 : 0.0;

        return fogPass;
    }
    // ------------------------------------------------------------


    // FUNCTION | Update Fog Pass Per-Frame Uniforms (camera + anchor)
    // ------------------------------------------------------------
    function Na__Scene__UpdateFogPassUniforms(fogPass, camera) {
        if (!fogPass || !camera) return;

        fogPass.uniforms['uCameraFar'].value = camera.far;
        fogPass.uniforms['uInverseProjectionMatrix'].value.copy(camera.projectionMatrixInverse);
        fogPass.uniforms['uCameraWorldMatrix'].value.copy(camera.matrixWorld);
        fogPass.uniforms['uCameraPosition'].value.copy(camera.position);
    }
    // ------------------------------------------------------------


    // FUNCTION | Set Fog Pass Orbit Reference (orbit cube or fallback)
    // ------------------------------------------------------------
    function Na__Scene__SetFogOrbitReference(fogPass, orbitReference) {
        if (!fogPass) return;
        Na__Scene__Fog__ResolveAnchor(orbitReference, fogPass.uniforms['uOrbitAnchor'].value);
    }
    // ------------------------------------------------------------


    // FUNCTION | Apply Scene Background Color From Fog Config
    // ------------------------------------------------------------
    function Na__Scene__ApplyFogBackground(scene, fogConfig) {
        if (!scene || !fogConfig) return;
        const fogColorHex = fogConfig.Scene__Default__FogConfig__Color;
        if (Number.isFinite(fogColorHex)) {
            scene.background = new THREE.Color(fogColorHex);
        }
        scene.fog = null; // <-- Disable built-in fog; post-processing pass handles it
    }
    // ------------------------------------------------------------


    // MODULE EXPORTS | Scene Environment Effects API
    // ------------------------------------------------------------
    export {
        Na__Scene__CreateFogPass,
        Na__Scene__UpdateFogPassUniforms,
        Na__Scene__SetFogOrbitReference,
        Na__Scene__ApplyFogBackground
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
