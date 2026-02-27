// -----------------------------------------------------------------------------
// REGION | Scene Lighting Effects - Default Lighting Conditions
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js
    // ------------------------------------------------------------
    import * as THREE from 'three';
    // ------------------------------------------------------------


    // FUNCTION | Setup Default Scene Lighting and Ground Plane
    // ------------------------------------------------------------
    function Na__Scene__SetupDefaultSceneLighting(scene, lightingConfig, groundPlaneConfig) {
        if (!scene) return; // <-- Guard against invalid scene reference

        const ambientIntensity = (lightingConfig && Number.isFinite(lightingConfig.Scene__Default__LightingConfig__AmbientIntensity))
            ? lightingConfig.Scene__Default__LightingConfig__AmbientIntensity
            : 0;
        const directionalIntensity = (lightingConfig && Number.isFinite(lightingConfig.Scene__Default__LightingConfig__DirectionalIntensity))
            ? lightingConfig.Scene__Default__LightingConfig__DirectionalIntensity
            : 0;

        const Na__Light__Ambient = new THREE.AmbientLight(0xffffff, ambientIntensity); // <-- Base fill light
        scene.add(Na__Light__Ambient);

        const Na__Light__Directional = new THREE.DirectionalLight(0xffffff, directionalIntensity); // <-- Main directional light
        Na__Light__Directional.position.set(50, 100, 40);
        Na__Light__Directional.castShadow = true;
        Na__Light__Directional.shadow.mapSize.width = 2048;
        Na__Light__Directional.shadow.mapSize.height = 2048;
        Na__Light__Directional.shadow.bias = -0.0001;
        scene.add(Na__Light__Directional);

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


    // MODULE EXPORTS | Scene Lighting Effects API
    // ------------------------------------------------------------
    export {
        Na__Scene__SetupDefaultSceneLighting
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
