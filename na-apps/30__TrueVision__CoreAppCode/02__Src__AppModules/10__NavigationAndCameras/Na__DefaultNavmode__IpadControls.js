// -----------------------------------------------------------------------------
// REGION | Default Navmode - Touch Controls (iPad / Mobile)
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js Controls and Math
    // ------------------------------------------------------------
    import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
    import { Na__Math__ConvertMmToUnits } from '../04__MathUtils/Na__Math__Units.js';
    import { Na__Navmode__ApplyOrbitControlsDamping } from './Na__Navmode__OrbitControls__Damping.js';
    // ------------------------------------------------------------


    // MODULE VARIABLES | Keyboard State
    // ------------------------------------------------------------
    const Na__DefaultNavmode__KeyState = { w: false, a: false, s: false, d: false, q: false, e: false, arrowup: false, arrowleft: false, arrowdown: false, arrowright: false };
    // ------------------------------------------------------------


    // HELPER FUNCTION | Merge Navigation Config
    // ------------------------------------------------------------
    function Na__DefaultNavmode__MergeConfig(customConfig) {
        return { ...(customConfig || {}) };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Bind WASD Keyboard Listeners
    // ------------------------------------------------------------
    function Na__DefaultNavmode__BindWASDListeners() {
        const Na__DefaultNavmode__OnKeyDown = (event) => {
            const key = event.key.toLowerCase();
            if (Na__DefaultNavmode__KeyState.hasOwnProperty(key)) {
                Na__DefaultNavmode__KeyState[key] = true;
            }
        };
        
        const Na__DefaultNavmode__OnKeyUp = (event) => {
            const key = event.key.toLowerCase();
            if (Na__DefaultNavmode__KeyState.hasOwnProperty(key)) {
                Na__DefaultNavmode__KeyState[key] = false;
            }
        };
        
        window.addEventListener('keydown', Na__DefaultNavmode__OnKeyDown);
        window.addEventListener('keyup', Na__DefaultNavmode__OnKeyUp);
        
        return () => {
            window.removeEventListener('keydown', Na__DefaultNavmode__OnKeyDown);
            window.removeEventListener('keyup', Na__DefaultNavmode__OnKeyUp);
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Initialize Default Touch Controls
    // ------------------------------------------------------------
    function Na__DefaultNavmode__InitializeIpadControls(camera, domElement, customConfig) {
        const config = Na__DefaultNavmode__MergeConfig(customConfig);
        
        const controls = new OrbitControls(camera, domElement);
        // @delegate: ./Na__Navmode__OrbitControls__Damping.js
        Na__Navmode__ApplyOrbitControlsDamping(controls, config.damping);
        controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
        
        const movementSpeedUnits = Na__Math__ConvertMmToUnits(config.movementSpeedMm);
        const elevationSpeedUnits = Na__Math__ConvertMmToUnits(config.elevationSpeedMm);
        const minDistanceUnits = Number.isFinite(config.minDistanceMm) ? Na__Math__ConvertMmToUnits(config.minDistanceMm) : null;
        const maxDistanceUnits = Number.isFinite(config.maxDistanceMm) ? Na__Math__ConvertMmToUnits(config.maxDistanceMm) : null;
        const minCameraYUnits  = Number.isFinite(config.minCameraYMm)  ? Na__Math__ConvertMmToUnits(config.minCameraYMm)  : null;
        
        if (Number.isFinite(minDistanceUnits)) {
            controls.minDistance = minDistanceUnits;                 // <-- Clamp orbit zoom in
        }
        
        if (Number.isFinite(maxDistanceUnits)) {
            controls.maxDistance = maxDistanceUnits;                 // <-- Clamp orbit zoom out
        }
        
        let removeListeners = () => {};
        let updateMovement = () => {};
        
        if (config.enableWASD) {
            removeListeners = Na__DefaultNavmode__BindWASDListeners();
            
            updateMovement = () => {
                if (!Na__DefaultNavmode__KeyState.w && !Na__DefaultNavmode__KeyState.a && !Na__DefaultNavmode__KeyState.s && !Na__DefaultNavmode__KeyState.d && !Na__DefaultNavmode__KeyState.q && !Na__DefaultNavmode__KeyState.e && !Na__DefaultNavmode__KeyState.arrowup && !Na__DefaultNavmode__KeyState.arrowleft && !Na__DefaultNavmode__KeyState.arrowdown && !Na__DefaultNavmode__KeyState.arrowright) {
                    return false;
                }
                
                const forward = new THREE.Vector3();
                camera.getWorldDirection(forward);
                forward.y = 0;
                forward.normalize();
                
                const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
                
                if (Na__DefaultNavmode__KeyState.w || Na__DefaultNavmode__KeyState.arrowup) {
                    camera.position.add(forward.clone().multiplyScalar(movementSpeedUnits));
                }
                if (Na__DefaultNavmode__KeyState.s || Na__DefaultNavmode__KeyState.arrowdown) {
                    camera.position.sub(forward.clone().multiplyScalar(movementSpeedUnits));
                }
                if (Na__DefaultNavmode__KeyState.d || Na__DefaultNavmode__KeyState.arrowright) {
                    camera.position.add(right.clone().multiplyScalar(movementSpeedUnits));
                }
                if (Na__DefaultNavmode__KeyState.a || Na__DefaultNavmode__KeyState.arrowleft) {
                    camera.position.sub(right.clone().multiplyScalar(movementSpeedUnits));
                }
                if (Na__DefaultNavmode__KeyState.e) {
                    camera.position.y += elevationSpeedUnits;
                }
                if (Na__DefaultNavmode__KeyState.q) {
                    camera.position.y -= elevationSpeedUnits;
                }

                return true;
            };
        }
        
        const updateNavigation = () => {
            const moved = updateMovement() === true;
            const controlsChanged = controls.update() === true;
            let clamped = false;
            if (Number.isFinite(minCameraYUnits) && camera.position.y < minCameraYUnits) {
                camera.position.y = minCameraYUnits;                 // <-- World-space floor guard
                controls.update();
                clamped = true;
            }

            return moved || controlsChanged || clamped;
        };
        
        const dispose = () => {
            removeListeners();
            controls.dispose();
        };
        
        return {
            controls,
            updateNavigation,
            dispose
        };
    }
    // ------------------------------------------------------------


    // MODULE EXPORTS | Default Touch Controls API
    // ------------------------------------------------------------
    export {
        Na__DefaultNavmode__InitializeIpadControls
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
