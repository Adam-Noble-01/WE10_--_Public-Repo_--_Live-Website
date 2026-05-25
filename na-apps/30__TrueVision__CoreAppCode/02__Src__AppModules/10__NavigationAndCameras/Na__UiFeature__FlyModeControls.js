// =============================================================================
// TRUEVISION3D - FLY MODE UI CONTROLS
// =============================================================================
//
// FILE       : Na__UiFeature__FlyModeControls.js
// NAMESPACE  : Na__UiFeature
// MODULE     : FlyModeControls
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Fly mode system initialisation and toggle orchestration
// CREATED    : 25-May-2026
//
// DESCRIPTION:
// - Initialises the fly mode camera engine and re-uses the existing door
//   proximity system so doors automatically open as the user flies past them
//   (matching walk mode behaviour).
// - Stores controls, renderer, and device type in module-level state so
//   callers only supply these references once at initialisation time.
// - Provides a single ToggleFlyMode function that activates / deactivates
//   fly mode and fires optional caller-supplied UI callbacks so the index
//   shell can update its own status indicators without this module knowing
//   anything about them.
//
// INTEGRATION:
// - Call Na__UiFeature__InitializeFlyModeSystem() after scene, camera,
//   renderer, and orbit controls are ready.
// - Call Na__UiFeature__ToggleFlyMode() to switch between orbit and fly.
//   Pass onActivate / onDeactivate callbacks for caller-side UI reactions.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 25-May-2026 - Version 1.0.0
// - Initial implementation mirroring the Walk Mode controls module.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Fly Mode System Logic
    // ------------------------------------------------------------
    import {
        Na__FlyMode__Initialize,
        Na__FlyMode__IsActive,
        Na__FlyMode__GetConfig
    } from './Na__Navmode__FlyMode__SystemLogic.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Mode Transition Logic
    // ------------------------------------------------------------
    import {
        Na__ModeTransition__OrbitToFly,
        Na__ModeTransition__FlyToOrbit
    } from './Na__Navmode__ModeTransition.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Fly Mode Desktop Controls
    // ------------------------------------------------------------
    import { Na__FlyModeDesktop__Activate, Na__FlyModeDesktop__Deactivate } from './Na__Navmode__FlyMode__DesktopControls.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Fly Mode Touch Screen Controls
    // ------------------------------------------------------------
    import { Na__FlyModeTouch__Activate, Na__FlyModeTouch__Deactivate } from './Na__Navmode__FlyMode__TouchScreenControls.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Door Proximity System (Shared With Walk Mode)
    // ------------------------------------------------------------
    import {
        Na__DoorProximity__Initialize,
        Na__DoorProximity__SetEnabled
    } from '../25__System__3dObject__InteractionSystem/3dObjectInteraction__Animation__WalkMode__ProximityToOpenDoors__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Render Loop Invalidation
    // ------------------------------------------------------------
    import {
        Na__RenderLoop__RequestActiveRender,
        Na__RenderLoop__RequestRender
    } from '../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Fly Mode Runtime References
    // ------------------------------------------------------------
    let Na__UiFeature__FlyMode__Camera                 = null;   // <-- Camera instance (for transition module)
    let Na__UiFeature__FlyMode__Controls               = null;   // <-- Orbit controls instance
    let Na__UiFeature__FlyMode__Renderer               = null;   // <-- Renderer instance
    let Na__UiFeature__FlyMode__UseTouch               = false;  // <-- Device uses touch controls
    let Na__UiFeature__FlyMode__DoorProximityEnabled   = true;   // <-- Allow proximity door opening
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | System Initialisation
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Fly Mode System
    // ------------------------------------------------------------
    function Na__UiFeature__InitializeFlyModeSystem(scene, camera, renderer, controls, flyConfig, useTouchControls) {
        Na__FlyMode__Initialize(scene, camera, renderer.domElement, flyConfig);  // <-- Init fly camera engine

        // Door proximity is a shared system: it will already be initialised by
        // walk mode in most boot flows, but calling Initialize again is a no-op
        // beyond updating the threshold so the fly-mode proximity distance is
        // honoured whenever fly mode owns the camera.
        if (flyConfig && Number.isFinite(flyConfig.Navmode__FlyMode__DoorProximityThresholdMm)) {
            Na__DoorProximity__Initialize(flyConfig.Navmode__FlyMode__DoorProximityThresholdMm);
        }

        Na__UiFeature__FlyMode__Camera   = camera;                               // <-- Store camera ref (for transition module)
        Na__UiFeature__FlyMode__Controls = controls;                             // <-- Store orbit controls ref
        Na__UiFeature__FlyMode__Renderer = renderer;                             // <-- Store renderer ref
        Na__UiFeature__FlyMode__UseTouch = useTouchControls;                     // <-- Store device type flag

        if (flyConfig && typeof flyConfig.Navmode__FlyMode__DoorProximityEnabled === 'boolean') {
            Na__UiFeature__FlyMode__DoorProximityEnabled = flyConfig.Navmode__FlyMode__DoorProximityEnabled;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Fly Mode Toggle
// -----------------------------------------------------------------------------

    // FUNCTION | Toggle Fly Mode On/Off
    // ------------------------------------------------------------
    function Na__UiFeature__ToggleFlyMode(onActivate, onDeactivate) {
        if (Na__FlyMode__IsActive()) {
            // DEACTIVATE FLY MODE
            if (Na__UiFeature__FlyMode__UseTouch) {
                Na__FlyModeTouch__Deactivate();                                  // <-- Remove touch input listeners
            } else {
                Na__FlyModeDesktop__Deactivate();                                // <-- Remove keyboard/mouse listeners
            }
            Na__DoorProximity__SetEnabled(false);                                // <-- Disable door proximity triggers

            Na__ModeTransition__FlyToOrbit(                                      // <-- Reposition orbit camera near fly position
                Na__UiFeature__FlyMode__Camera,
                Na__UiFeature__FlyMode__Controls
            );

            Na__RenderLoop__RequestRender();                                     // <-- Redraw once after returning to orbit mode
            if (onDeactivate) onDeactivate();                                    // <-- Fire caller UI callback
        } else {
            // ACTIVATE FLY MODE
            const activated = Na__ModeTransition__OrbitToFly(Na__UiFeature__FlyMode__Controls);
            if (activated) {
                const flyConfig = Na__FlyMode__GetConfig();                      // <-- Get current fly config
                if (Na__UiFeature__FlyMode__UseTouch) {
                    Na__FlyModeTouch__Activate(Na__UiFeature__FlyMode__Renderer.domElement, flyConfig);
                } else {
                    Na__FlyModeDesktop__Activate(Na__UiFeature__FlyMode__Renderer.domElement, flyConfig);
                }

                if (Na__UiFeature__FlyMode__DoorProximityEnabled) {
                    Na__DoorProximity__SetEnabled(true);                         // <-- Enable door proximity triggers
                }

                Na__RenderLoop__RequestActiveRender('fly-mode');                 // <-- Fly mode requires continuous frames while active
                if (onActivate) onActivate();                                    // <-- Fire caller UI callback
            }
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Fly Mode Controls API
    // ------------------------------------------------------------
    export {
        Na__UiFeature__InitializeFlyModeSystem,
        Na__UiFeature__ToggleFlyMode
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
