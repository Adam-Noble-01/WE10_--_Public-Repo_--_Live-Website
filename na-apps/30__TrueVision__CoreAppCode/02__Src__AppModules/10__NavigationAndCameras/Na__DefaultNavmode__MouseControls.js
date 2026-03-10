// -----------------------------------------------------------------------------
// REGION | Default Navmode - Mouse Controls (Normalized)
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


    // HELPER FUNCTION | Normalize Wheel Delta Direction
    // ------------------------------------------------------------
    function Na__DefaultNavmode__NormalizeWheelDeltaDirection(event) {
        let delta = Number.isFinite(event.deltaY) ? event.deltaY : 0;
        
        if (event.deltaMode === 1) {
            delta *= 16;                                               // <-- Normalize line-based delta
        } else if (event.deltaMode === 2) {
            delta *= 100;                                              // <-- Normalize page-based delta
        }
        
        if (!Number.isFinite(delta) || delta === 0) return 0;
        return delta > 0 ? -1 : 1;                                     // <-- Invert direction for wheel zoom
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Clamp Zoom Distance
    // ------------------------------------------------------------
    function Na__DefaultNavmode__ClampDistance(distanceUnits, minDistanceUnits, maxDistanceUnits) {
        let clampedDistance = distanceUnits;
        
        if (Number.isFinite(minDistanceUnits) && clampedDistance < minDistanceUnits) {
            clampedDistance = minDistanceUnits;
        }
        
        if (Number.isFinite(maxDistanceUnits) && clampedDistance > maxDistanceUnits) {
            clampedDistance = maxDistanceUnits;
        }
        
        return clampedDistance;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Apply Normalized Zoom Step
    // ------------------------------------------------------------
    function Na__DefaultNavmode__ApplyZoomStep(camera, controls, zoomDirection, zoomStepUnits, minDistanceUnits, maxDistanceUnits) {
        if (!zoomDirection || !Number.isFinite(zoomStepUnits) || zoomStepUnits <= 0) return;
        
        const target = controls.target.clone();
        const cameraOffset = new THREE.Vector3().subVectors(camera.position, target);
        const currentDistance = cameraOffset.length();
        
        if (!Number.isFinite(currentDistance) || currentDistance === 0) return;
        
        const desiredDistance = Na__DefaultNavmode__ClampDistance(
            currentDistance + (zoomDirection < 0 ? zoomStepUnits : -zoomStepUnits),
            minDistanceUnits,
            maxDistanceUnits
        );
        
        if (!Number.isFinite(desiredDistance)) return;
        
        const direction = cameraOffset.normalize();
        camera.position.copy(target.clone().add(direction.multiplyScalar(desiredDistance)));
        controls.update();
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


    // FUNCTION | Initialize Default Mouse Controls
    // ------------------------------------------------------------
    function Na__DefaultNavmode__InitializeMouseControls(camera, domElement, customConfig) {
        // SUB SECTION | Base Config & Orbit Controls Setup
        // ------------------------------------------------------------
        const config = Na__DefaultNavmode__MergeConfig(customConfig);
        
        const controls = new OrbitControls(camera, domElement);
        // @delegate: ./Na__Navmode__OrbitControls__Damping.js
        Na__Navmode__ApplyOrbitControlsDamping(controls, config.damping);
        controls.enableZoom = false;                                  // <-- Disable native wheel zoom
        // ------------------------------------------------------------
        
        // SUB SECTION | Speed, Zoom, and Distance Settings
        // ------------------------------------------------------------
        const movementSpeedUnits = Na__Math__ConvertMmToUnits(config.movementSpeedMm);
        const elevationSpeedUnits = Na__Math__ConvertMmToUnits(config.elevationSpeedMm);
        const minDistanceUnits = Number.isFinite(config.minDistanceMm) ? Na__Math__ConvertMmToUnits(config.minDistanceMm) : null;
        const maxDistanceUnits = Number.isFinite(config.maxDistanceMm) ? Na__Math__ConvertMmToUnits(config.maxDistanceMm) : null;
        const minCameraYUnits  = Number.isFinite(config.minCameraYMm)  ? Na__Math__ConvertMmToUnits(config.minCameraYMm)  : null;
        const zoomStepUnits = Na__Math__ConvertMmToUnits(config.zoomStepMm);
        let wheelTickCount = 0;                                       // <-- Consecutive wheel ticks
        let lastWheelTimestamp = 0;                                   // <-- Last wheel time (ms)
        
        if (Number.isFinite(minDistanceUnits)) {
            controls.minDistance = minDistanceUnits;                 // <-- Clamp orbit zoom in
        }
        
        if (Number.isFinite(maxDistanceUnits)) {
            controls.maxDistance = maxDistanceUnits;                 // <-- Clamp orbit zoom out
        }
        // ------------------------------------------------------------
        
        // SUB SECTION | Wheel Zoom Handler (Accelerated)
        // ------------------------------------------------------------
        const Na__DefaultNavmode__OnWheel = (event) => {
            event.preventDefault();
            const zoomDirection = Na__DefaultNavmode__NormalizeWheelDeltaDirection(event);
            
            const now = performance.now();
            if ((now - lastWheelTimestamp) > 250) {
                wheelTickCount = 0;                                   // <-- Reset streak after idle
            }
            lastWheelTimestamp = now;
            wheelTickCount += 1;
            
            const extraTicks = Math.max(0, wheelTickCount - 3);
            const accelerationFactor = extraTicks > 0 ? Math.pow(1.05, extraTicks) : 1;
            const acceleratedZoomStep = zoomStepUnits * accelerationFactor;
            
            Na__DefaultNavmode__ApplyZoomStep(camera, controls, zoomDirection, acceleratedZoomStep, minDistanceUnits, maxDistanceUnits);
        };
        // ------------------------------------------------------------
        
        // SUB SECTION | Event Binding & Movement Wiring
        // ------------------------------------------------------------
        domElement.addEventListener('wheel', Na__DefaultNavmode__OnWheel, { passive: false });
        
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
        // ------------------------------------------------------------
        
        // SUB SECTION | Update Loop & Cleanup
        // ------------------------------------------------------------
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
            domElement.removeEventListener('wheel', Na__DefaultNavmode__OnWheel);
            removeListeners();
            controls.dispose();
        };
        
        return {
            controls,
            updateNavigation,
            dispose
        };
        // ------------------------------------------------------------
    }
    // ------------------------------------------------------------


    // MODULE EXPORTS | Default Mouse Controls API
    // ------------------------------------------------------------
    export {
        Na__DefaultNavmode__InitializeMouseControls
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
