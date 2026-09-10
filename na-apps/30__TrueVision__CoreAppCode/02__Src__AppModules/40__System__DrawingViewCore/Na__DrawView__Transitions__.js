// =============================================================================
// TRUEVISION3D - DRAWING VIEW CORE - TRANSITIONS
// =============================================================================
//
// FILE       : Na__DrawView__Transitions__.js
// NAMESPACE  : Na__DrawTrans
// MODULE     : Drawing View Core - Transitions
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The parts of entering and leaving a drawing that every drawing kind shares
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - A floor plan and an elevation stand the same 3D systems down when they
//   take the viewport and hand the same ones back when they leave; both fly
//   the perspective camera with the carousel's own easing; both register a
//   router with the carousel so their scene cards open a drawing. That shared
//   third of each mode controller lives here once.
// - SUSPENDING 3D: orbit controls are disabled (they listen on the same canvas
//   as the drawing pan), walk and fly are returned to orbit first (their
//   per-frame updates would move a camera nobody can see), and distance
//   culling is switched off (a drawing must show everything on the storey)
//   and put back exactly as it was.
// - THE FLIGHT hands a synthetic, scene-shaped pose to the presentation camera
//   transition, so a plan or elevation flight feels identical to a scene
//   flight and needs no second easing implementation.
//
// INTEGRATION:
// - Initialised from index.html with the live camera and controls.
// - Na__FloorPlan__ModeController__ and the elevation controller call
//   Suspend, Resume, FlyTo and RegisterRouter.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 42__System__DrawingViewCore/Na__DrawView__Transitions__.js 1.0.0
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment Phase B)
// - Parity        : adapted
// - Divergences   : (1) Distance culling lives at 05__RenderPipeline/ rather than
//                       05__RenderPipeline/02__Engine__MaxEngine/, because TrueVision has no
//                       PureEngine / MaxEngine split - one pipeline, one folder.
//                   (2) Returning to orbit calls Na__NavToolbar__SetActiveMode('orbit'); the
//                       ValeVision toolbar exposes a dedicated Na__NavToolbar__SetOrbitMode()
//                       and TrueVision's takes the mode as an argument. Same effect.
// - Back-port     : no. Both divergences are facts about TrueVision's folder layout and toolbar API.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 2.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Distance Culling and Navigation Modes
    // ------------------------------------------------------------
    import {
        Na__DistanceCulling__SetEnabled,
        Na__DistanceCulling__IsEnabled
    } from '../05__RenderPipeline/Na__RenderEffect__DistanceCulling__.js';
    import { Na__WalkMode__IsActive } from '../10__NavigationAndCameras/Na__Navmode__WalkMode__SystemLogic.js';
    import { Na__FlyMode__IsActive }  from '../10__NavigationAndCameras/Na__Navmode__FlyMode__SystemLogic.js';
    import { Na__NavToolbar__SetActiveMode } from '../10__NavigationAndCameras/Na__UiFeature__NavigationToolbar__Controls.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Presentation Camera Easing and Carousel Routing
    // ------------------------------------------------------------
    // Both imports point one way only: the presentation modules never import
    // the drawing core, so no dependency cycle is introduced.
    // @delegate: ../21__System__PresentationMode/Na__PresentationMode__Camera__SceneTransition.js
    // @delegate: ../21__System__PresentationMode/Na__PresentationMode__UI__SceneCarousel.js
    // ------------------------------------------------------------
    import {
        Na__PresentationMode__Camera__AnimateToScene,
        Na__PresentationMode__Camera__CancelCurrentTransition
    } from '../21__System__PresentationMode/Na__PresentationMode__Camera__SceneTransition.js';
    import { Na__PresentationMode__UI__AddSceneNavigationRouter } from '../21__System__PresentationMode/Na__PresentationMode__UI__SceneCarousel.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | App Context and Suspension State
    // ------------------------------------------------------------
    let Na__DrawTrans__Camera       = null;
    let Na__DrawTrans__Controls     = null;
    let Na__DrawTrans__PriorCulling = null;   // <-- Distance culling state to restore, null while 3D owns the view
    let Na__DrawTrans__Suspended    = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Suspending and Resuming 3D
// -----------------------------------------------------------------------------

    // FUNCTION | Stand Down the 3D Systems a Drawing Must Not Share
    // ------------------------------------------------------------
    // ORBIT CONTROLS listen on the same canvas as the drawing pan handler.
    // Left enabled they would rotate the perspective camera underneath the
    // drawing on every drag, so leaving would land somewhere the viewer never
    // chose. WALK AND FLY are returned to orbit first for the same reason.
    // DISTANCE CULLING hides furniture beyond a radius of the 3D camera; a
    // drawing has no such notion and must show everything on the storey.
    // ------------------------------------------------------------
    function Na__DrawView__Transitions__SuspendThreeD() {
        if (Na__WalkMode__IsActive() || Na__FlyMode__IsActive()) Na__NavToolbar__SetActiveMode('orbit'); // <-- Safe mode conversion first

        if (Na__DrawTrans__Controls) Na__DrawTrans__Controls.enabled = false;

        if (Na__DrawTrans__PriorCulling === null) {
            Na__DrawTrans__PriorCulling = Na__DistanceCulling__IsEnabled();
            if (Na__DrawTrans__PriorCulling) Na__DistanceCulling__SetEnabled(false);  // <-- Also restores anything already culled
        }
        Na__DrawTrans__Suspended = true;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Hand the 3D Systems Back
    // ------------------------------------------------------------
    function Na__DrawView__Transitions__ResumeThreeD() {
        if (Na__DrawTrans__Controls) {
            Na__DrawTrans__Controls.enabled = true;
            if (typeof Na__DrawTrans__Controls.update === 'function') Na__DrawTrans__Controls.update();
        }
        if (Na__DrawTrans__PriorCulling !== null) {
            if (Na__DrawTrans__PriorCulling) Na__DistanceCulling__SetEnabled(true);
            Na__DrawTrans__PriorCulling = null;
        }
        Na__DrawTrans__Suspended = false;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Are the 3D Systems Currently Stood Down?
    // ------------------------------------------------------------
    function Na__DrawView__Transitions__IsSuspended() {
        return Na__DrawTrans__Suspended;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Flights and Routing
// -----------------------------------------------------------------------------

    // FUNCTION | Fly the Perspective Camera to a Scene-Shaped Pose
    // ------------------------------------------------------------
    // pose is an ordinary presentation scene object (a real scene, or the
    // synthetic approach a framing module builds). onComplete runs when the
    // camera lands; durationMs overrides the pose's own transition time.
    // ------------------------------------------------------------
    function Na__DrawView__Transitions__FlyTo(pose, durationMs, onComplete) {
        if (!Na__DrawTrans__Camera || !pose) {
            if (typeof onComplete === 'function') onComplete();                  // <-- Nothing to fly: land at once
            return false;
        }
        Na__PresentationMode__Camera__AnimateToScene(
            Na__DrawTrans__Camera,
            Na__DrawTrans__Controls,
            pose,
            {
                durationMs : Number.isFinite(durationMs) ? durationMs : undefined,
                onComplete : (typeof onComplete === 'function') ? onComplete : undefined
            }
        );
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Cancel a Flight in Progress
    // ------------------------------------------------------------
    function Na__DrawView__Transitions__CancelFlight() {
        Na__PresentationMode__Camera__CancelCurrentTransition();
    }
    // ------------------------------------------------------------


    // FUNCTION | Register a Scene Router With the Carousel
    // ------------------------------------------------------------
    // fn(scene) returns true when it has taken over the navigation.
    // ------------------------------------------------------------
    function Na__DrawView__Transitions__RegisterRouter(fn) {
        return Na__PresentationMode__UI__AddSceneNavigationRouter(fn);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Live Perspective Camera and Controls
    // ------------------------------------------------------------
    function Na__DrawView__Transitions__GetCamera()   { return Na__DrawTrans__Camera; }
    function Na__DrawView__Transitions__GetControls() { return Na__DrawTrans__Controls; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize the Shared Transitions
    // ------------------------------------------------------------
    // context: { camera, controls }
    // ------------------------------------------------------------
    function Na__DrawView__Transitions__Initialize(context) {
        if (!context || !context.camera) {
            console.warn('[TrueVision3D] Drawing transitions init skipped - missing camera.');
            return false;
        }
        Na__DrawTrans__Camera   = context.camera;
        Na__DrawTrans__Controls = context.controls || null;
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Drawing Transitions API
    // ------------------------------------------------------------
    export {
        Na__DrawView__Transitions__Initialize,
        Na__DrawView__Transitions__SuspendThreeD,
        Na__DrawView__Transitions__ResumeThreeD,
        Na__DrawView__Transitions__IsSuspended,
        Na__DrawView__Transitions__FlyTo,
        Na__DrawView__Transitions__CancelFlight,
        Na__DrawView__Transitions__RegisterRouter,
        Na__DrawView__Transitions__GetCamera,
        Na__DrawView__Transitions__GetControls
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
