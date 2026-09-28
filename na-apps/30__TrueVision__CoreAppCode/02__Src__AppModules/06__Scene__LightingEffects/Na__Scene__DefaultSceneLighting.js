// -----------------------------------------------------------------------------
// REGION | Scene Lighting Effects - Default Lighting Conditions
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js
    // ------------------------------------------------------------
    import * as THREE from 'three';
    import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';                                  // <-- Was RGBELoader, deprecated upstream at r180 (see below)
    // ------------------------------------------------------------

    // MODULE IMPORTS | Per-Scene Lighting (owns the two lights once they are built)
    // @delegate: ./Na__Scene__PerSceneLighting__.js
    // ------------------------------------------------------------
    import { Na__SceneLighting__Register } from './Na__Scene__PerSceneLighting__.js';
    // ------------------------------------------------------------


    // FUNCTION | Setup Default Scene Lighting and Ground Plane
    // ------------------------------------------------------------
    // Builds the ambient fill and the sun, then hands both to the per-scene
    // lighting module, which places the sun from Scene__Default__LightingConfig
    // (its position moved there on 28-Sep-2026, same values) and from then on
    // sets both lights whenever a scene asks for its own lighting.
    // perSceneLightingConfig is the app config's Scene__PerSceneLighting block.
    // ------------------------------------------------------------
    function Na__Scene__SetupDefaultSceneLighting(scene, lightingConfig, groundPlaneConfig, perSceneLightingConfig) {
        if (!scene) return; // <-- Guard against invalid scene reference

        const ambientIntensity = (lightingConfig && Number.isFinite(lightingConfig.Scene__Default__LightingConfig__AmbientIntensity))
            ? lightingConfig.Scene__Default__LightingConfig__AmbientIntensity
            : 0;
        const directionalIntensity = (lightingConfig && Number.isFinite(lightingConfig.Scene__Default__LightingConfig__DirectionalIntensity))
            ? lightingConfig.Scene__Default__LightingConfig__DirectionalIntensity
            : 0;

        const Na__Light__Ambient = new THREE.AmbientLight(0xffffff, ambientIntensity); // <-- Base fill light
        scene.add(Na__Light__Ambient);

        const Na__Light__Directional = new THREE.DirectionalLight(0xffffff, directionalIntensity); // <-- Main directional light (placed by the register call below)
        Na__Light__Directional.castShadow = true;                             // <-- Always on: a scene turns its shadows off by strength, which recompiles nothing
        Na__Light__Directional.shadow.mapSize.width = 1024;
        Na__Light__Directional.shadow.mapSize.height = 1024;
        Na__Light__Directional.shadow.bias = -0.0001;
        scene.add(Na__Light__Directional);

        // HAND BOTH LIGHTS TO THE PER-SCENE LIGHTING MODULE
        // @delegate: ./Na__Scene__PerSceneLighting__.js
        // ------------------------------------
        Na__SceneLighting__Register({
            ambientLight     : Na__Light__Ambient,
            directionalLight : Na__Light__Directional,
            lightingConfig   : lightingConfig,                                // <-- Default strengths, shadows and sun position
            perSceneConfig   : perSceneLightingConfig || null                 // <-- Switch, flight blending and slider ranges
        });

        // Only create ground plane when explicitly enabled via AppConfig
        if (groundPlaneConfig && groundPlaneConfig.Scene__GroundPlane__Enabled) {
            const Na__Ground__Geometry = new THREE.PlaneGeometry(
                groundPlaneConfig.Scene__GroundPlane__Size,
                groundPlaneConfig.Scene__GroundPlane__Size
            );
            const Na__Ground__Material = new THREE.ShadowMaterial({
                opacity: groundPlaneConfig.Scene__GroundPlane__ShadowOpacity,
                color: 0x000000
            });
            const Na__Ground__Plane = new THREE.Mesh(Na__Ground__Geometry, Na__Ground__Material);
            Na__Ground__Plane.rotation.x = -Math.PI / 2;
            Na__Ground__Plane.position.y = groundPlaneConfig.Scene__GroundPlane__yAxisOffset;
            Na__Ground__Plane.receiveShadow = true;
            scene.add(Na__Ground__Plane);
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Apply HDRI Environment for Reflective PBR Materials
    // ------------------------------------------------------------
    // Loads an HDR environment map, prefilters it with PMREM, and returns the
    // resulting texture so callers can apply it globally or per-material.
    // ------------------------------------------------------------
    async function Na__Scene__ApplyEnvironmentMap(scene, renderer, environmentConfig) {
        if (!scene || !renderer || !environmentConfig || environmentConfig.Scene__Environment__Enabled !== true) {
            return null;
        }

        const hdriUrl = environmentConfig.Scene__Environment__HdriUrl;
        if (!hdriUrl || typeof hdriUrl !== 'string') {
            console.warn('[TrueVision3D] Scene environment enabled but Scene__Environment__HdriUrl is missing.');
            return null;
        }

        const envMapIntensity = Number.isFinite(environmentConfig.Scene__Environment__Intensity)
            ? environmentConfig.Scene__Environment__Intensity
            : 1.0;

        try {
            const hdrTexture = await new HDRLoader().loadAsync(hdriUrl);                            // <-- HDRLoader is RGBELoader renamed; identical behaviour
            hdrTexture.mapping = THREE.EquirectangularReflectionMapping;

            const pmremGenerator = new THREE.PMREMGenerator(renderer);
            const envRenderTarget = pmremGenerator.fromEquirectangular(hdrTexture);

            const envTexture = envRenderTarget.texture;
            const applyToScene = environmentConfig.Scene__Environment__ApplyToScene === true;
            if (applyToScene) {
                scene.environment = envTexture;
                scene.environmentIntensity = envMapIntensity;

                if (environmentConfig.Scene__Environment__UseAsBackground === true) {
                    scene.background = envTexture;
                }
            }

            hdrTexture.dispose();
            pmremGenerator.dispose();

            console.log(`[TrueVision3D] Scene HDR environment loaded: ${hdriUrl} (applyToScene=${applyToScene})`);
            return envTexture;
        } catch (error) {
            console.warn('[TrueVision3D] Failed to load scene HDR environment:', error);
            return null;
        }
    }
    // ------------------------------------------------------------


    // MODULE EXPORTS | Scene Lighting Effects API
    // ------------------------------------------------------------
    export {
        Na__Scene__SetupDefaultSceneLighting,
        Na__Scene__ApplyEnvironmentMap
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
