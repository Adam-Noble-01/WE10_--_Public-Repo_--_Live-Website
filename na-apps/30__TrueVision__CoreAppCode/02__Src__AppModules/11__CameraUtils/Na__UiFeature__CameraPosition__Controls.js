// -----------------------------------------------------------------------------
// REGION | UI Feature - Camera Position Reporting
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Unit Conversion Helpers
    // ------------------------------------------------------------
    import { Na__Math__ConvertMmToUnits, Na__Math__ConvertUnitsToMm } from '../04__MathUtils/Na__Math__Units.js';
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Output Defaults
    // ------------------------------------------------------------
    const Na__UiFeature__CameraPositionDefaults = {
        precision: 4
    };
    // ------------------------------------------------------------


    // HELPER FUNCTION | Format Float Value
    // ------------------------------------------------------------
    function Na__UiFeature__FormatValue(value, precision) {
        return parseFloat(value.toFixed(precision));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Format Units to Integer MM
    // ------------------------------------------------------------
    function Na__UiFeature__FormatUnitsToMm(value) {
        return Math.round(Na__Math__ConvertUnitsToMm(value));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Extract Number Value
    // ------------------------------------------------------------
    function Na__UiFeature__GetNumber(value, fallback = null) {
        return Number.isFinite(value) ? value : fallback;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Apply Camera Config Values
    // ------------------------------------------------------------
    function Na__UiFeature__ApplyCameraConfig(camera, controls, config) {
        if (!camera || !config) return false;
        
        const pos = config.Camera__DefaultPos || {};
        const target = config.Camera__DefaultTarget || null;
        const rotation = config.Camera__DefaultRotation || null;
        const misc = config.Camera__DefaultMisc || null;
        
        const posX = Na__UiFeature__GetNumber(pos.Camera__DefaultPos__PosX);
        const posY = Na__UiFeature__GetNumber(pos.Camera__DefaultPos__PosY);
        const posZ = Na__UiFeature__GetNumber(pos.Camera__DefaultPos__PosZ);
        
        if (posX !== null && posY !== null && posZ !== null) {
            camera.position.set(
                Na__Math__ConvertMmToUnits(posX),
                Na__Math__ConvertMmToUnits(posY),
                Na__Math__ConvertMmToUnits(posZ)
            );
        }
        
        if (rotation) {
            const rotX = Na__UiFeature__GetNumber(rotation.Camera__DefaultRotation__RotX);
            const rotY = Na__UiFeature__GetNumber(rotation.Camera__DefaultRotation__RotY);
            const rotZ = Na__UiFeature__GetNumber(rotation.Camera__DefaultRotation__RotZ);
            
            if (rotX !== null && rotY !== null && rotZ !== null) {
                camera.rotation.set(rotX, rotY, rotZ);
            }
        }
        
        if (misc && Number.isFinite(misc.Camera__DefaultMisc__Fov)) {
            camera.fov = misc.Camera__DefaultMisc__Fov;
            camera.updateProjectionMatrix();
        }
        
        if (controls && target) {
            const targetX = Na__UiFeature__GetNumber(target.Camera__DefaultTarget__TargetX);
            const targetY = Na__UiFeature__GetNumber(target.Camera__DefaultTarget__TargetY);
            const targetZ = Na__UiFeature__GetNumber(target.Camera__DefaultTarget__TargetZ);
            
            if (targetX !== null && targetY !== null && targetZ !== null) {
                controls.target.set(
                    Na__Math__ConvertMmToUnits(targetX),
                    Na__Math__ConvertMmToUnits(targetY),
                    Na__Math__ConvertMmToUnits(targetZ)
                );
                controls.update();
            }
        }
        
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build Camera JSON (Config Style)
    // ------------------------------------------------------------
    function Na__UiFeature__BuildCameraJson(camera, controls, precision) {
        const position = camera.position;
        const rotation = camera.rotation;
        const target = controls?.target;
        
        const posX = Na__UiFeature__FormatUnitsToMm(position.x);
        const posY = Na__UiFeature__FormatUnitsToMm(position.y);
        const posZ = Na__UiFeature__FormatUnitsToMm(position.z);
        
        const targetX = target ? Na__UiFeature__FormatUnitsToMm(target.x) : 0;
        const targetY = target ? Na__UiFeature__FormatUnitsToMm(target.y) : 0;
        const targetZ = target ? Na__UiFeature__FormatUnitsToMm(target.z) : 0;
        
        const rotX = Na__UiFeature__FormatValue(rotation.x, precision);
        const rotY = Na__UiFeature__FormatValue(rotation.y, precision);
        const rotZ = Na__UiFeature__FormatValue(rotation.z, precision);
        const fov = Na__UiFeature__FormatValue(camera.fov, precision);
        
        // BUILD CAMERA SECTION (without Target - now handled by OrbitHelperCube)
        const cameraLines = [
            '{',
            '    "Camera__DefaultPosition": {',
            '        "Camera__DefaultPosition__Description": "All camera position/target values are integer millimeters; convert to 3D units in code.",',
            '        "Camera__DefaultPos": {',
            `            "Camera__DefaultPos__PosX"       : ${posX},`,
            `            "Camera__DefaultPos__PosY"       : ${posY},`,
            `            "Camera__DefaultPos__PosZ"       : ${posZ}`,
            '        },',
            '        "Camera__DefaultRotation": {',
            `            "Camera__DefaultRotation__RotX"  : ${rotX},`,
            `            "Camera__DefaultRotation__RotY"  : ${rotY},`,
            `            "Camera__DefaultRotation__RotZ"  : ${rotZ}`,
            '        },',
            '        "Camera__DefaultMisc": {',
            `            "Camera__DefaultMisc__Fov"       : ${fov}`,
            '        }',
            '    },'
        ];
        
        // BUILD ORBIT HELPER CUBE SECTION (separate for easy copy/paste)
        const orbitCubeLines = [
            '    "OrbitHelperCube__Position": {',
            '        "OrbitHelperCube__Position__Description": "Orbit target position from OrbitHelperCube GLB center point. Values are integer millimeters; convert to 3D units in code.",',
            `        "OrbitHelperCube__Position__PosX" : ${targetX},`,
            `        "OrbitHelperCube__Position__PosY" : ${targetY},`,
            `        "OrbitHelperCube__Position__PosZ" : ${targetZ}`,
            '    }',
            '}'
        ];
        
        // COMBINE SECTIONS
        const allLines = [...cameraLines, ...orbitCubeLines];
        return allLines.join('\n');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Download JSON File
    // ------------------------------------------------------------
    function Na__UiFeature__DownloadJsonFile(filename, content) {
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
    // ------------------------------------------------------------


    // FUNCTION | Initialize Camera Position Controls
    // ------------------------------------------------------------
    function Na__UiFeature__InitializeCameraPositionControls(camera, controls, config = {}) {
        if (!camera) return;
        
        const settings = { ...Na__UiFeature__CameraPositionDefaults, ...(config || {}) };
        const toggleButton = document.getElementById('naCameraPositionToggle');
        const panel = document.getElementById('naCameraPositionPanel');
        const output = document.getElementById('naCameraPositionOutput');
        const importFileInput = document.getElementById('naCameraPositionImportFile');
        const importButton = document.getElementById('naCameraPositionImport');
        const downloadButton = document.getElementById('naCameraPositionDownload');
        
        if (!toggleButton || !panel || !output || !importFileInput || !importButton || !downloadButton) {
            return;
        }
        
        const menuDetails = toggleButton.closest('.na-dropdown-menu__details');
        let liveUpdateTimer = null;
        
        const updateOutput = () => {
            const data = Na__UiFeature__BuildCameraJson(camera, controls, settings.precision);
            output.value = data;
        };
        
        toggleButton.addEventListener('click', () => {
            const isOpen = panel.classList.contains('is-open');
            panel.classList.toggle('is-open', !isOpen);
            
            if (menuDetails) {
                menuDetails.classList.toggle('na-dropdown-menu__details--camera-open', !isOpen);
            }
            
            if (!isOpen) {
                updateOutput();
                
                if (!liveUpdateTimer) {
                    liveUpdateTimer = window.setInterval(updateOutput, 250);
                }
            } else if (liveUpdateTimer) {
                window.clearInterval(liveUpdateTimer);
                liveUpdateTimer = null;
            }
        });
        
        importButton.addEventListener('click', () => {
            importFileInput.value = '';
            importFileInput.click();
        });
        
        importFileInput.addEventListener('change', async (event) => {
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            
            try {
                const text = await file.text();
                const parsed = JSON.parse(text);
                const cameraConfig = parsed.Camera__DefaultPosition ? parsed.Camera__DefaultPosition : parsed;
                
                const applied = Na__UiFeature__ApplyCameraConfig(camera, controls, cameraConfig);
                if (applied) {
                    updateOutput();
                }
            } catch (error) {
                console.warn('[TrueVision3D] Camera JSON import failed:', error);
            }
        });
        
        downloadButton.addEventListener('click', () => {
            updateOutput();
            Na__UiFeature__DownloadJsonFile('Camera__DefaultPosition.json', output.value);
        });
    }
    // ------------------------------------------------------------


    // MODULE EXPORTS | Camera Position API
    // ------------------------------------------------------------
    export {
        Na__UiFeature__ApplyCameraConfig,
        Na__UiFeature__BuildCameraJson,
        Na__UiFeature__InitializeCameraPositionControls
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

