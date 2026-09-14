// -----------------------------------------------------------------------------
// REGION | UI Feature - Camera Lens Controls
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js Math Utils
    // ------------------------------------------------------------
    import * as THREE from 'three';
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Lens Conversion Defaults
    // ------------------------------------------------------------
    const Na__UiFeature__LensDefaults = {
        minFocalLengthMM: 28,                                          // <-- Minimum lens focal length
        maxFocalLengthMM: 75,                                          // <-- Maximum lens focal length
        defaultFocalLengthMM: null,                                    // <-- Null uses current camera FOV
        sensorHeightMM: 24                                             // <-- Full-frame sensor height
    };
    // ------------------------------------------------------------


    // HELPER FUNCTION | Convert Focal Length to Vertical FOV
    // ------------------------------------------------------------
    function Na__UiFeature__LensFocalToFov(focalLengthMM, sensorHeightMM) {
        const fovRadians = 2 * Math.atan(sensorHeightMM / (2 * focalLengthMM));
        return THREE.MathUtils.radToDeg(fovRadians);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Convert Vertical FOV to Focal Length
    // ------------------------------------------------------------
    function Na__UiFeature__LensFovToFocal(fovDegrees, sensorHeightMM) {
        const fovRadians = THREE.MathUtils.degToRad(fovDegrees);
        return sensorHeightMM / (2 * Math.tan(fovRadians / 2));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Clamp Lens Value
    // ------------------------------------------------------------
    function Na__UiFeature__ClampLensValue(value, minValue, maxValue) {
        return Math.min(Math.max(value, minValue), maxValue);
    }
    // ------------------------------------------------------------


    // FUNCTION | Initialize Camera Lens Controls
    // ------------------------------------------------------------
    function Na__UiFeature__InitializeCameraLensControls(camera, config = {}) {
        if (!camera) return;
        
        const lensConfig = { ...Na__UiFeature__LensDefaults, ...config };
        const panel = document.getElementById('naCameraLensPanel');
        const slider = document.getElementById('naCameraLensSlider');
        const valueLabel = document.getElementById('naCameraLensValue');
        const toggleButton = document.getElementById('naCameraLensToggle');
        
        if (!panel || !slider || !valueLabel || !toggleButton) return;
        
        const currentFocal = Na__UiFeature__LensFovToFocal(camera.fov, lensConfig.sensorHeightMM);
        const initialFocal = lensConfig.defaultFocalLengthMM ?? currentFocal;
        const clampedFocal = Na__UiFeature__ClampLensValue(initialFocal, lensConfig.minFocalLengthMM, lensConfig.maxFocalLengthMM);
        
        slider.min = lensConfig.minFocalLengthMM;
        slider.max = lensConfig.maxFocalLengthMM;
        slider.step = 1;
        slider.value = Math.round(clampedFocal);
        valueLabel.textContent = `${Math.round(clampedFocal)} mm`;
        
        const applyLens = (focalLengthMM) => {
            const fovDegrees = Na__UiFeature__LensFocalToFov(focalLengthMM, lensConfig.sensorHeightMM);
            camera.fov = fovDegrees;
            camera.updateProjectionMatrix();
            valueLabel.textContent = `${Math.round(focalLengthMM)} mm`;
        };
        
        applyLens(clampedFocal);
        
        slider.addEventListener('input', (event) => {
            const focalLength = parseFloat(event.target.value);
            applyLens(focalLength);
        });
        
        toggleButton.addEventListener('click', () => {
            const isOpen = panel.classList.contains('is-open');
            panel.classList.toggle('is-open', !isOpen);
        });
    }
    // ------------------------------------------------------------


    // MODULE EXPORTS | Lens Controls API
    // ------------------------------------------------------------
    export {
        Na__UiFeature__InitializeCameraLensControls
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
