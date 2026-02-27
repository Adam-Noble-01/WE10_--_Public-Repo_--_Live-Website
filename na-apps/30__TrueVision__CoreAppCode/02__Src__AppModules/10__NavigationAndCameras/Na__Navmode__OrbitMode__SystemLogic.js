// -----------------------------------------------------------------------------
// REGION | Navmode Controls - Orbit + Optional WASD
// -----------------------------------------------------------------------------
//
// FILE       : Na__Navmode__OrbitMode__SystemLogic.js
// PURPOSE    : Orbit mode system logic - OrbitControls + optional WASD
//
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js Controls and Math
    // ------------------------------------------------------------
    import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Default Navigation Configuration
    // ------------------------------------------------------------
    const Na__Navmode__DefaultConfig = {
        enableDamping: false,                                          // <-- Orbit control damping
        enableWASD: false,                                             // <-- Optional WASD fly mode
        movementSpeed: 0.5,                                            // <-- Movement speed (units per tick)
        elevationSpeed: 0.5,                                           // <-- Vertical speed (units per tick)
        minDistance: null,                                             // <-- Orbit min distance (units)
        maxDistance: null                                              // <-- Orbit max distance (units)
    };
    // ------------------------------------------------------------


    // MODULE VARIABLES | Keyboard State
    // ------------------------------------------------------------
    const Na__Navmode__KeyState = { w: false, a: false, s: false, d: false, q: false, e: false };
    // ------------------------------------------------------------


    // HELPER FUNCTION | Merge Navigation Config
    // ------------------------------------------------------------
    function Na__Navmode__MergeConfig(customConfig) {
        return { ...Na__Navmode__DefaultConfig, ...(customConfig || {}) };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Bind WASD Keyboard Listeners
    // ------------------------------------------------------------
    function Na__Navmode__BindWASDListeners() {
        const Na__Navmode__OnKeyDown = (event) => {
            const key = event.key.toLowerCase();
            if (Na__Navmode__KeyState.hasOwnProperty(key)) {
                Na__Navmode__KeyState[key] = true;
            }
        };
        
        const Na__Navmode__OnKeyUp = (event) => {
            const key = event.key.toLowerCase();
            if (Na__Navmode__KeyState.hasOwnProperty(key)) {
                Na__Navmode__KeyState[key] = false;
            }
        };
        
        window.addEventListener('keydown', Na__Navmode__OnKeyDown);
        window.addEventListener('keyup', Na__Navmode__OnKeyUp);
        
        return () => {
            window.removeEventListener('keydown', Na__Navmode__OnKeyDown);
            window.removeEventListener('keyup', Na__Navmode__OnKeyUp);
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Initialize Navigation Controls
    // ------------------------------------------------------------
    function Na__Navmode__InitializeControls(camera, domElement, customConfig) {
        const config = Na__Navmode__MergeConfig(customConfig);
        
        const controls = new OrbitControls(camera, domElement);
        controls.enableDamping = config.enableDamping;
        
        if (Number.isFinite(config.minDistance)) {
            controls.minDistance = config.minDistance;               // <-- Clamp orbit zoom in
        }
        
        if (Number.isFinite(config.maxDistance)) {
            controls.maxDistance = config.maxDistance;               // <-- Clamp orbit zoom out
        }
        
        let removeListeners = () => {};
        let updateMovement = () => {};
        
        if (config.enableWASD) {
            removeListeners = Na__Navmode__BindWASDListeners();
            
            updateMovement = () => {
                if (!Na__Navmode__KeyState.w && !Na__Navmode__KeyState.a && !Na__Navmode__KeyState.s && !Na__Navmode__KeyState.d && !Na__Navmode__KeyState.q && !Na__Navmode__KeyState.e) {
                    return;
                }
                
                const forward = new THREE.Vector3();
                camera.getWorldDirection(forward);
                forward.y = 0;
                forward.normalize();
                
                const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
                
                if (Na__Navmode__KeyState.w) {
                    camera.position.add(forward.clone().multiplyScalar(config.movementSpeed));
                }
                if (Na__Navmode__KeyState.s) {
                    camera.position.sub(forward.clone().multiplyScalar(config.movementSpeed));
                }
                if (Na__Navmode__KeyState.d) {
                    camera.position.add(right.clone().multiplyScalar(config.movementSpeed));
                }
                if (Na__Navmode__KeyState.a) {
                    camera.position.sub(right.clone().multiplyScalar(config.movementSpeed));
                }
                if (Na__Navmode__KeyState.e) {
                    camera.position.y += config.elevationSpeed;
                }
                if (Na__Navmode__KeyState.q) {
                    camera.position.y -= config.elevationSpeed;
                }
            };
        }
        
        const updateNavigation = () => {
            updateMovement();
            controls.update();
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


    // MODULE EXPORTS | Navigation Controls API
    // ------------------------------------------------------------
    export {
        Na__Navmode__InitializeControls
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
