// =============================================================================
// TRUEVISION3D - FLOOR PLAN VIEWS - MODE CONTROLLER
// =============================================================================
//
// FILE       : Na__FloorPlan__ModeController__.js
// NAMESPACE  : Na__FloorPlanMode
// MODULE     : Floor Plan Views - Mode Controller
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Orchestrate entering, switching and leaving 2D floor plan mode
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - The single place the cut, the orthographic camera, the locked navigation
//   and the annotation layer are switched on and off together. Every other
//   floor plan module is a leaf that knows nothing about the others.
// - ENTERING from 3D applies the cut FIRST, so the cap geometry is built while
//   the viewer is still stationary rather than hitching at the end of the
//   flight, and so the building is already sliced as the camera rises over it.
//   The perspective camera then eases up to a top-down pose framed to roughly
//   match the plan, and only at the end does the projection swap to
//   orthographic - which is the one moment the two projections differ.
// - SWITCHING between two plans is an instant flip, by design. The plans are
//   drawing pages; animating between two top-down parallel views reads as
//   jarring rather than pleasant, so the config ships that transition at 0ms.
//   Raising it above 0 fades instead of moving the camera.
// - LEAVING reverses it: annotations go first so the text is gone before the
//   view moves, then the projection swaps back at the top-down pose and the
//   perspective camera eases down to the target 3D scene.
// - Annotation undo history and the editing shortcuts are bound and unbound
//   with the markup itself, so neither can ever outlive the plan it belongs to.
// - The render loop asks GetActiveCamera() each frame. A non-null answer means
//   plan mode owns the view and the composer is bypassed for a flat render.
//
// INTEGRATION:
// - Initialized once from Index.html with the camera, controls, canvas and
//   model root.
// - Na__FloorPlan__DevMenu__Editor__ drives Preview / Annotate.
// - The scene carousel routes a floor plan scene here instead of animating
//   the perspective camera to it.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 31-Aug-2026 - Version 1.0.0
// - Initial implementation for the Floor Plan Builder.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Render Loop and Math Utilities
    // ------------------------------------------------------------
    import { Na__RenderLoop__RequestRender } from '../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    import {
        Na__DistanceCulling__SetEnabled,
        Na__DistanceCulling__IsEnabled
    } from '../05__RenderPipeline/Na__RenderEffect__DistanceCulling__.js';
    import { Na__Math__ConvertMmToUnits } from '../04__MathUtils/Na__Math__Units.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Section Cut Engine
    // ------------------------------------------------------------
    // @delegate: ../41__System__SectionCutEngine/Na__SectionCut__Engine__.js
    // ------------------------------------------------------------
    import {
        Na__SectionCut__UpsertHorizontalPlane,
        Na__SectionCut__SetActivePlane,
        Na__SectionCut__RemovePlane
    } from '../41__System__SectionCutEngine/Na__SectionCut__Engine__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Floor Plan Camera, Navigation, Data and Config
    // ------------------------------------------------------------
    // @delegate: ./Na__FloorPlan__OrthoCamera__.js
    // @delegate: ./Na__FloorPlan__PlanNavigation__.js
    // @delegate: ./Na__FloorPlan__ProjectJson__Data__.js
    // @delegate: ./Na__FloorPlan__Framing__.js
    // ------------------------------------------------------------
    import {
        Na__FpCam__EnsureCamera,
        Na__FpCam__GetCamera,
        Na__FpCam__PositionForCut,
        Na__FpCam__FrameToBounds,
        Na__FpCam__HandleResize,
        Na__FpCam__SetPanTargetMm,
        Na__FpCam__GetPanTargetMm,
        Na__FpCam__SetZoom,
        Na__FpCam__GetZoom
    } from './Na__FloorPlan__OrthoCamera__.js';
    import {
        Na__FpNav__Attach,
        Na__FpNav__Detach
    } from './Na__FloorPlan__PlanNavigation__.js';
    import {
        Na__FpData__GetCutHeightMm,
        Na__FpData__GetViewDepthMm,
        Na__FpData__GetSavedView,
        Na__FpData__SetSavedView,
        Na__FpData__GetAnnotations
    } from './Na__FloorPlan__ProjectJson__Data__.js';
    import {
        Na__FpCfg__Load,
        Na__FpCfg__IsEnabled,
        Na__FpCfg__GetTransitionSetup
    } from './Na__FloorPlan__ConfigState__.js';
    import {
        Na__FpFrame__MeasureModel,
        Na__FpFrame__GetBounds,
        Na__FpFrame__BuildTopDownScene
    } from './Na__FloorPlan__Framing__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Annotation Layer, Editor and Toolbar
    // ------------------------------------------------------------
    // @delegate: ../43__System__PlanAnnotations/Na__PlanAnnotations__Overlay__.js
    // ------------------------------------------------------------
    import { Na__PlanAnno__Load } from '../43__System__PlanAnnotations/Na__PlanAnnotations__Data__.js';

    // MODULE IMPORTS | Plan Dimensions
    // ------------------------------------------------------------
    // @delegate: ../44__System__PlanDimensions/
    // ------------------------------------------------------------
    import {
        Na__PlanDim__Load,
        Na__PlanDim__GetPlanDimensions,
        Na__PlanDim__GetLayerSetup
    } from '../44__System__PlanDimensions/Na__PlanDimensions__Data__.js';
    import {
        Na__PlanDimLayer__Mount,
        Na__PlanDimLayer__Unmount,
        Na__PlanDimLayer__Sync,
        Na__PlanDimLayer__SyncLayerBox
    } from '../44__System__PlanDimensions/Na__PlanDimensions__Overlay__.js';
    import {
        Na__PlanDimEdit__Enable,
        Na__PlanDimEdit__Disable,
        Na__PlanDimEdit__AttachNode
    } from '../44__System__PlanDimensions/Na__PlanDimensions__Editor__.js';
    import {
        Na__PlanDimGrid__EstablishPlane,
        Na__PlanDimGrid__Dispose
    } from '../44__System__PlanDimensions/Na__PlanDimensions__Grid__.js';
    import {
        Na__PlanDimHist__Begin,
        Na__PlanDimHist__End
    } from '../44__System__PlanDimensions/Na__PlanDimensions__History__.js';
    import {
        Na__PlanDimKeys__Attach,
        Na__PlanDimKeys__Detach
    } from '../44__System__PlanDimensions/Na__PlanDimensions__Hotkeys__.js';
    import {
        Na__PlanDimAxis__Configure,
        Na__PlanDimAxis__Dispose
    } from '../44__System__PlanDimensions/Na__PlanDimensions__AxisLock__.js';
    import {
        Na__PlanDimVert__Sync,
        Na__PlanDimVert__Dispose
    } from '../44__System__PlanDimensions/Na__PlanDimensions__VertexEditor__.js';
    import {
        Na__PlanDim__GetSessionDimensions,
        Na__PlanDim__SetAuthoringMode,
        Na__PlanDim__AUTHOR_DEV
    } from '../44__System__PlanDimensions/Na__PlanDimensions__Data__.js';
    import {
        Na__PlanDimClient__SetAllowed,
        Na__PlanDimClient__IsAllowed,
        Na__PlanDimClient__Mount,
        Na__PlanDimClient__Refresh,
        Na__PlanDimClient__Unmount,
        Na__PlanDimClient__Dispose
    } from '../44__System__PlanDimensions/Na__PlanDimensions__ClientMode__.js';
    import { Na__FpData__GetClientDimensionsEnabled } from './Na__FloorPlan__ProjectJson__Data__.js';
    // ------------------------------------------------------------
    import {
        Na__PlanAnnoLayer__Mount,
        Na__PlanAnnoLayer__Unmount,
        Na__PlanAnnoLayer__Sync,
        Na__PlanAnnoLayer__SyncLayerBox
    } from '../43__System__PlanAnnotations/Na__PlanAnnotations__Overlay__.js';
    import {
        Na__PlanAnnoEdit__Enable,
        Na__PlanAnnoEdit__Disable,
        Na__PlanAnnoEdit__AttachNode
    } from '../43__System__PlanAnnotations/Na__PlanAnnotations__Editor__.js';
    import {
        Na__PlanAnnoBar__Mount,
        Na__PlanAnnoBar__Unmount,
        Na__PlanAnnoBar__Refresh
    } from '../43__System__PlanAnnotations/Na__PlanAnnotations__Toolbar__.js';
    import {
        Na__PlanAnnoHist__Begin,
        Na__PlanAnnoHist__End
    } from '../43__System__PlanAnnotations/Na__PlanAnnotations__History__.js';
    import {
        Na__PlanAnnoKeys__Attach,
        Na__PlanAnnoKeys__Detach
    } from '../43__System__PlanAnnotations/Na__PlanAnnotations__Hotkeys__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Presentation Camera Easing (reused for the flight)
    // ------------------------------------------------------------
    // The eased flight into and out of plan mode is the SAME transition the
    // scene carousel uses, driven with a synthesised top-down pose. Keeping
    // one easing implementation means plan transitions always feel identical
    // to scene transitions.
    // @delegate: ../21__System__PresentationMode/Na__PresentationMode__Camera__SceneTransition.js
    // ------------------------------------------------------------
    import {
        Na__PresentationMode__Camera__AnimateToScene
    } from '../21__System__PresentationMode/Na__PresentationMode__Camera__SceneTransition.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Carousel Scene Navigation Override
    // ------------------------------------------------------------
    // Registering a router with the carousel is how a floor plan scene card
    // switches into 2D instead of flying the perspective camera. The import
    // points one way only - the carousel never imports this module - so no
    // dependency cycle is introduced.
    // @delegate: ../21__System__PresentationMode/Na__PresentationMode__UI__SceneCarousel.js
    // ------------------------------------------------------------
    import {
        Na__PresentationMode__UI__SetSceneNavigationOverride
    } from '../21__System__PresentationMode/Na__PresentationMode__UI__SceneCarousel.js';
    import {
        Na__FpData__GetPlanForScene,
        Na__FpData__IsFloorPlanScene
    } from './Na__FloorPlan__ProjectJson__Data__.js';
    import {
        Na__PresentationMode__ProjectJson__GetActiveConfig
    } from '../21__System__PresentationMode/Na__PresentationMode__ProjectJson__SceneData.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Mode States
    // ------------------------------------------------------------
    const Na__FpMode__STATE_IDLE       = 'idle';         // <-- Ordinary 3D
    const Na__FpMode__STATE_ENTERING   = 'entering';     // <-- Perspective camera flying up
    const Na__FpMode__STATE_PLAN       = 'plan';         // <-- Orthographic plan owns the view
    const Na__FpMode__STATE_LEAVING    = 'leaving';      // <-- Perspective camera flying back down
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Section Cut Plane Id Prefix
    // ------------------------------------------------------------
    const Na__FpMode__CUT_ID_PREFIX = 'FloorPlanCut__';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Broadcast Event Name
    // ------------------------------------------------------------
    const Na__FpMode__CHANGED_EVENT = 'na-floorplan-mode-changed';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | App Context (set once at init)
    // ------------------------------------------------------------
    let Na__FpMode__PerspCamera = null;
    let Na__FpMode__Controls    = null;
    let Na__FpMode__Canvas      = null;
    let Na__FpMode__ModelRoot   = null;
    let Na__FpMode__Initialized = false;
    // ------------------------------------------------------------

    // MODULE VARIABLES | Active Plan and Mode State
    // ------------------------------------------------------------
    let Na__FpMode__State       = Na__FpMode__STATE_IDLE;
    let Na__FpMode__ActivePlan  = null;   // <-- Live floor plan record being displayed
    let Na__FpMode__EditMode    = false;  // <-- Annotation authoring enabled (developer only)
    let Na__FpMode__PriorCulling = null;  // <-- Distance-culling state to restore on exit
    let Na__FpMode__OnChanged   = null;   // <-- Host callback for unsaved-change tracking
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Broadcast the Current Mode to Interested UI
    // ------------------------------------------------------------
    function Na__FpMode__DispatchChanged() {
        window.dispatchEvent(new CustomEvent(Na__FpMode__CHANGED_EVENT, {
            detail : {
                state  : Na__FpMode__State,
                planId : Na__FpMode__ActivePlan ? Na__FpMode__ActivePlan.FloorPlan__Id : null,
                isPlan : Na__FpMode__State === Na__FpMode__STATE_PLAN
            }
        }));
        if (typeof Na__FpMode__OnChanged === 'function') Na__FpMode__OnChanged();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Viewport Size of the Render Canvas
    // ------------------------------------------------------------
    function Na__FpMode__GetViewportSize() {
        if (!Na__FpMode__Canvas) return { width: window.innerWidth, height: window.innerHeight };
        return {
            width  : Na__FpMode__Canvas.clientWidth  || window.innerWidth,
            height : Na__FpMode__Canvas.clientHeight || window.innerHeight
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Section Cut Plane Id for a Floor Plan
    // ------------------------------------------------------------
    function Na__FpMode__CutIdFor(plan) {
        return Na__FpMode__CUT_ID_PREFIX + plan.FloorPlan__Id;
    }
    // ------------------------------------------------------------


// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Suspending the 3D Systems
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Stand Down the 3D Systems a Plan Must Not Share
    // ------------------------------------------------------------
    // ORBIT CONTROLS listen on the same canvas as the plan pan handler. Left
    // enabled they would rotate the perspective camera underneath the drawing
    // on every drag, so leaving plan mode would land somewhere the viewer
    // never chose. Disabling is the only reliable fix - the two cannot share
    // a pointer.
    //
    // DISTANCE CULLING hides furniture beyond a radius of the 3D camera. A
    // drawing has no such notion and must show everything on the storey, so it
    // is switched off - which also restores anything already culled - and put
    // back exactly as it was on exit.
    // ------------------------------------------------------------
    function Na__FpMode__SuspendThreeDSystems() {
        if (Na__FpMode__Controls) Na__FpMode__Controls.enabled = false;

        if (Na__FpMode__PriorCulling === null) {
            Na__FpMode__PriorCulling = Na__DistanceCulling__IsEnabled();
            if (Na__FpMode__PriorCulling) Na__DistanceCulling__SetEnabled(false);
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Hand the 3D Systems Back
    // ------------------------------------------------------------
    function Na__FpMode__ResumeThreeDSystems() {
        if (Na__FpMode__Controls) Na__FpMode__Controls.enabled = true;

        if (Na__FpMode__PriorCulling !== null) {
            if (Na__FpMode__PriorCulling) Na__DistanceCulling__SetEnabled(true);
            Na__FpMode__PriorCulling = null;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Cut and Camera Application
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Apply a Plan's Section Cut
    // ------------------------------------------------------------
    // Done before any camera movement so the cap geometry is built while the
    // viewer is stationary, rather than hitching at the end of the flight.
    // ------------------------------------------------------------
    function Na__FpMode__ApplyCut(plan) {
        const cutId  = Na__FpMode__CutIdFor(plan);
        const cutMm  = Na__FpData__GetCutHeightMm(plan);
        const depth  = Na__FpData__GetViewDepthMm(plan);

        Na__SectionCut__UpsertHorizontalPlane(cutId, cutMm, depth);
        Na__SectionCut__SetActivePlane(cutId);
        return cutId;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Place and Frame the Orthographic Camera for a Plan
    // ------------------------------------------------------------
    function Na__FpMode__ApplyPlanCamera(plan) {
        const size   = Na__FpMode__GetViewportSize();
        const bounds = Na__FpFrame__GetBounds(Na__FpMode__ModelRoot);
        const cutMm  = Na__FpData__GetCutHeightMm(plan);
        const saved  = Na__FpData__GetSavedView(plan);
        const frame  = Na__FpFrame__MeasureModel(Na__FpMode__ModelRoot, Na__FpMode__PerspCamera);

        Na__FpCam__EnsureCamera(size.width, size.height);
        if (bounds) Na__FpCam__FrameToBounds(bounds, size.width, size.height);

        // Centre on the model unless the author already framed this plan.
        Na__FpCam__PositionForCut(
            cutMm,
            frame ? frame.centreXMm : 0,
            frame ? frame.centreZMm : 0
        );

        if (saved.zoom !== null) Na__FpCam__SetZoom(saved.zoom);
        if (saved.targetXMm !== null && saved.targetZMm !== null) {
            Na__FpCam__SetPanTargetMm(saved.targetXMm, saved.targetZMm);
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Mount the Annotation Layer for a Plan
    // ------------------------------------------------------------
    function Na__FpMode__MountAnnotations(plan) {
        // Read the per-project grant before anything mounts, so the client
        // branch below knows whether it exists at all.
        Na__PlanDimClient__SetAllowed(
            Na__FpData__GetClientDimensionsEnabled(Na__PresentationMode__ProjectJson__GetActiveConfig())
        );

        // ONE array reference is shared by the layer, the history stack and the
        // floor plan record that gets saved. Resolved once here so all three can
        // never end up bound to different copies.
        const annotations = Na__FpData__GetAnnotations(plan);

        Na__PlanAnnoLayer__Mount({
            hostElement   : Na__FpMode__Canvas,
            annotations   : annotations,
            cutHeightMm   : Na__FpData__GetCutHeightMm(plan),
            onNodeCreated : Na__FpMode__EditMode ? Na__PlanAnnoEdit__AttachNode : null
        });

        // DIMENSIONS | Same one-live-array rule as the annotations above
        // ------------------------------------------------------------
        // The working plane is established from the model before the layer
        // mounts, so the first pick already has an extent to be clamped
        // against. It sits fractionally below the annotation text so a label
        // placed over a dimension line stays readable.
        // ------------------------------------------------------------
        const dimensions   = Na__PlanDim__GetPlanDimensions(plan);
        const cutHeightMm  = Na__FpData__GetCutHeightMm(plan);
        const dimLayerCfg  = Na__PlanDim__GetLayerSetup();

        Na__PlanDimGrid__EstablishPlane(Na__FpMode__ModelRoot, cutHeightMm - dimLayerCfg.planeOffsetMm);

        // The client branch needs interaction wired too - onto their OWN
        // records only, which the editor decides per record rather than here.
        const clientMayMeasure = Na__PlanDimClient__IsAllowed();

        Na__PlanDimLayer__Mount({
            hostElement       : Na__FpMode__Canvas,
            dimensions        : dimensions,
            sessionDimensions : Na__PlanDim__GetSessionDimensions(),
            cutHeightMm       : cutHeightMm,
            onNodeCreated     : (Na__FpMode__EditMode || clientMayMeasure)
                ? Na__PlanDimEdit__AttachNode
                : null
        });

        // CLIENT PATH | The same engine, bound to the ephemeral session list
        // and gated behind the disclaimer. Nothing here can reach plan data:
        // the array it writes into is not attached to any plan record.
        if (!Na__FpMode__EditMode) {
            if (!clientMayMeasure) return;

            Na__PlanDimClient__Mount({
                hostElement : Na__FpMode__Canvas.parentElement || document.body,
                onChanged   : () => Na__PlanDimLayer__Sync()
            });

            const sessionList = Na__PlanDim__GetSessionDimensions();
            // The bar reads its labels from the tool state, so every change
            // has to reach it - otherwise Measure stays stuck on Cancel once
            // a dimension completes.
            const refreshClient = () => {
                Na__PlanDimLayer__Sync();
                Na__PlanDimClient__Refresh();
            };

            Na__PlanDimEdit__Enable({
                canvas      : Na__FpMode__Canvas,
                dimensions  : sessionList,
                cutHeightMm : cutHeightMm,
                onChanged   : refreshClient
            });
            Na__PlanDimHist__Begin(sessionList);
            Na__PlanDimAxis__Configure(null);
            Na__PlanDimKeys__Attach({ onAction: refreshClient });
            return;
        }

        Na__PlanDimEdit__Enable({
            canvas      : Na__FpMode__Canvas,
            dimensions  : dimensions,
            cutHeightMm : cutHeightMm,                                           // <-- Vertex handles project onto this plane
            onChanged   : () => {
                Na__PlanAnnoBar__Refresh();
                if (typeof Na__FpMode__OnChanged === 'function') Na__FpMode__OnChanged();
            }
        });

        // Dimension undo is its own stack, bound to the same live array the
        // layer and the plan record share. Separate from the annotation stack
        // so one Ctrl+Z never steps both.
        Na__PlanDimHist__Begin(dimensions);
        Na__PlanDimAxis__Configure(Na__PlanAnnoBar__Refresh);
        Na__PlanDimKeys__Attach({
            onAction : () => {
                Na__PlanAnnoBar__Refresh();
                if (typeof Na__FpMode__OnChanged === 'function') Na__FpMode__OnChanged();
            }
        });

        // Undo history is per plan. Binding here also clears it, because one
        // plan undo stack has no meaning over another plan markup.
        Na__PlanAnnoHist__Begin(annotations);

        Na__PlanAnnoEdit__Enable({
            canvas    : Na__FpMode__Canvas,
            onChanged : () => {
                Na__PlanAnnoBar__Refresh();
                if (typeof Na__FpMode__OnChanged === 'function') Na__FpMode__OnChanged();
            }
        });
        Na__PlanAnnoBar__Mount({
            hostElement : Na__FpMode__Canvas.parentElement || document.body,
            onDone      : () => Na__FloorPlanMode__SetEditMode(false)
        });
        Na__PlanAnnoKeys__Attach({
            onAction : () => {
                Na__PlanAnnoBar__Refresh();
                if (typeof Na__FpMode__OnChanged === 'function') Na__FpMode__OnChanged();
            }
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Tear Down the Annotation Layer
    // ------------------------------------------------------------
    function Na__FpMode__UnmountAnnotations() {
        Na__PlanDimClient__Unmount();                                            // <-- Session measurements are discarded here
        Na__PlanDim__SetAuthoringMode(Na__PlanDim__AUTHOR_DEV);
        Na__PlanAnnoKeys__Detach();                                              // <-- Shortcuts must never outlive the plan they edit
        Na__PlanAnnoHist__End();
        Na__PlanAnnoBar__Unmount();
        Na__PlanAnnoEdit__Disable();
        Na__PlanAnnoLayer__Unmount();
        Na__PlanDimKeys__Detach();                                               // <-- Same rule for the dimension listeners
        Na__PlanDimHist__End();
        Na__PlanDimVert__Dispose();
        Na__PlanDimAxis__Dispose();
        Na__PlanDimClient__Dispose();
        Na__PlanDimEdit__Disable();
        Na__PlanDimLayer__Unmount();
        Na__PlanDimGrid__Dispose();                                              // <-- Plane belonged to the plan that is closing
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Remember How the Author Left a Plan Framed
    // ------------------------------------------------------------
    function Na__FpMode__StoreFraming(plan) {
        if (!plan || !Na__FpCam__GetCamera()) return;
        const pan = Na__FpCam__GetPanTargetMm();
        Na__FpData__SetSavedView(plan, Na__FpCam__GetZoom(), pan.targetXMm, pan.targetZMm);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Mode Transitions
// -----------------------------------------------------------------------------

    // FUNCTION | Enter Plan Mode, or Flip to a Different Plan
    // ------------------------------------------------------------
    // Flipping between two plans skips the flight entirely: the cut, camera
    // and annotations are swapped in one frame, which is what makes the plans
    // behave like drawing pages rather than camera moves.
    // ------------------------------------------------------------
    function Na__FloorPlanMode__EnterPlan(plan) {
        if (!Na__FpMode__Initialized || !plan) return false;
        if (!Na__FpCfg__IsEnabled()) return false;

        const alreadyInPlan = (Na__FpMode__State === Na__FpMode__STATE_PLAN);

        // Leaving one plan for another: keep how the author framed this one.
        if (alreadyInPlan && Na__FpMode__ActivePlan && Na__FpMode__ActivePlan !== plan) {
            Na__FpMode__StoreFraming(Na__FpMode__ActivePlan);
            Na__SectionCut__RemovePlane(Na__FpMode__CutIdFor(Na__FpMode__ActivePlan));
        }

        Na__FpMode__UnmountAnnotations();                                        // <-- Text goes before anything moves
        Na__FpMode__ApplyCut(plan);
        Na__FpMode__ActivePlan = plan;

        // FLIP | Already in plan mode: no flight, straight to the new page
        if (alreadyInPlan) {
            Na__FpMode__ApplyPlanCamera(plan);
            Na__FpMode__MountAnnotations(plan);
            Na__PlanAnnoLayer__Sync();
            Na__RenderLoop__RequestRender();
            Na__FpMode__DispatchChanged();
            return true;
        }

        // FLIGHT | Coming from 3D: ease up, then swap the projection
        Na__FpMode__State = Na__FpMode__STATE_ENTERING;
        Na__FpMode__DispatchChanged();

        const trans      = Na__FpCfg__GetTransitionSetup();
        const durationMs = trans.intoPlanMs;
        const pose       = Na__FpFrame__BuildTopDownScene(
            plan,
            Na__FpFrame__MeasureModel(Na__FpMode__ModelRoot, Na__FpMode__PerspCamera),
            Na__FpMode__PerspCamera.fov, durationMs, trans.easing
        );

        Na__PresentationMode__Camera__AnimateToScene(
            Na__FpMode__PerspCamera,
            Na__FpMode__Controls,
            pose,
            {
                durationMs : durationMs,
                onComplete : () => {
                    Na__FpMode__ApplyPlanCamera(plan);
                    Na__FpMode__SuspendThreeDSystems();                          // <-- Orbit must let go of the canvas first
                    Na__FpMode__State = Na__FpMode__STATE_PLAN;                  // <-- Render loop now takes the ortho camera
                    Na__FpNav__Attach(Na__FpMode__Canvas);
                    Na__FpMode__MountAnnotations(plan);
                    Na__PlanAnnoLayer__Sync();
                    Na__RenderLoop__RequestRender();
                    Na__FpMode__DispatchChanged();
                }
            }
        );
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Leave Plan Mode and Return to a 3D Scene
    // ------------------------------------------------------------
    // targetScene is an ordinary presentation scene to fly down to. Passing
    // null leaves the perspective camera at the top-down pose, which is what
    // a plain "exit preview" wants.
    // ------------------------------------------------------------
    function Na__FloorPlanMode__ExitPlan(targetScene) {
        if (!Na__FpMode__Initialized) return false;
        if (Na__FpMode__State === Na__FpMode__STATE_IDLE) return false;

        const plan = Na__FpMode__ActivePlan;

        // TEXT FIRST | Removed outright before the camera starts moving, so no
        // label ever slides across the screen with the view. This is a straight
        // unmount, not a fade: the fade path exists on the layer for the day a
        // 2D-to-2D transition needs softening.
        Na__FpMode__StoreFraming(plan);
        Na__FpMode__UnmountAnnotations();
        Na__FpNav__Detach();
        Na__FpMode__ResumeThreeDSystems();                                       // <-- Orbit and culling come back before the flight down

        // PROJECTION | Back to perspective at the pose the plan was seen from
        Na__FpMode__State = Na__FpMode__STATE_LEAVING;
        if (plan) {
            const pose = Na__FpFrame__BuildTopDownScene(
                plan,
                Na__FpFrame__MeasureModel(Na__FpMode__ModelRoot, Na__FpMode__PerspCamera),
                Na__FpMode__PerspCamera.fov, 0, Na__FpCfg__GetTransitionSetup().easing
            );
            const camPos = pose.PresentationMode__Scene__CameraPosition.Camera__DefaultPos;
            Na__FpMode__PerspCamera.position.set(
                Na__Math__ConvertMmToUnits(camPos.Camera__DefaultPos__PosX),
                Na__Math__ConvertMmToUnits(camPos.Camera__DefaultPos__PosY),
                Na__Math__ConvertMmToUnits(camPos.Camera__DefaultPos__PosZ)
            );
            Na__FpMode__PerspCamera.rotation.set(-Math.PI / 2, 0, 0);
            Na__FpMode__PerspCamera.updateProjectionMatrix();
        }

        // CUT | Cleared so the model is whole again in 3D
        if (plan) Na__SectionCut__RemovePlane(Na__FpMode__CutIdFor(plan));
        Na__SectionCut__SetActivePlane(null);

        const finish = () => {
            Na__FpMode__State      = Na__FpMode__STATE_IDLE;
            Na__FpMode__ActivePlan = null;
            Na__RenderLoop__RequestRender();
            Na__FpMode__DispatchChanged();
        };

        if (!targetScene) {
            finish();
            return true;
        }

        Na__PresentationMode__Camera__AnimateToScene(
            Na__FpMode__PerspCamera,
            Na__FpMode__Controls,
            targetScene,
            {
                durationMs : Na__FpCfg__GetTransitionSetup().outOfPlanMs,
                onComplete : finish
            }
        );
        Na__FpMode__DispatchChanged();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Turn Annotation Authoring On or Off
    // ------------------------------------------------------------
    // Remounts the layer, because whether a node is interactive is decided
    // when the node is built.
    // ------------------------------------------------------------
    function Na__FloorPlanMode__SetEditMode(enabled) {
        Na__FpMode__EditMode = (enabled === true);

        if (Na__FpMode__State === Na__FpMode__STATE_PLAN && Na__FpMode__ActivePlan) {
            Na__FpMode__UnmountAnnotations();
            Na__FpMode__MountAnnotations(Na__FpMode__ActivePlan);
            Na__PlanAnnoLayer__Sync();
            Na__RenderLoop__RequestRender();
        }
        Na__FpMode__DispatchChanged();
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Carousel Scene Routing
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Route One Carousel Scene Selection
    // ------------------------------------------------------------
    // Returns true when this system has taken over the navigation:
    //   - A floor plan scene always enters (or flips to) plan mode.
    //   - An ordinary 3D scene selected WHILE in plan mode leaves plan mode
    //     and flies down to it, so the text and the cut are cleared properly
    //     instead of being stranded over a moving perspective view.
    //   - An ordinary scene selected from 3D is not ours; the carousel handles
    //     it exactly as it always has.
    // ------------------------------------------------------------
    function Na__FpMode__RouteSceneSelection(scene) {
        if (!Na__FpMode__Initialized || !scene) return false;

        if (Na__FpData__IsFloorPlanScene(scene)) {
            const config = Na__PresentationMode__ProjectJson__GetActiveConfig();
            const plan   = Na__FpData__GetPlanForScene(config, scene);
            if (!plan) return false;                                             // <-- Dangling link: fall back to the normal path
            return Na__FloorPlanMode__EnterPlan(plan);
        }

        if (Na__FpMode__State !== Na__FpMode__STATE_IDLE) {
            return Na__FloorPlanMode__ExitPlan(scene);                           // <-- Leave plan mode and fly to the 3D scene
        }
        return false;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Render Loop Integration
// -----------------------------------------------------------------------------

    // FUNCTION | The Camera the Render Loop Should Use, or null for 3D
    // ------------------------------------------------------------
    // Non-null ONLY while plan mode fully owns the view. During the flight in
    // or out the perspective camera is animating, so the ordinary composer
    // path must keep running.
    // ------------------------------------------------------------
    function Na__FloorPlanMode__GetActiveCamera() {
        if (Na__FpMode__State !== Na__FpMode__STATE_PLAN) return null;
        return Na__FpCam__GetCamera();
    }
    // ------------------------------------------------------------


    // FUNCTION | Per-Frame Sync While Plan Mode Is Active
    // ------------------------------------------------------------
    // Reprojects the annotation layer so text tracks the drawing as it pans.
    // ------------------------------------------------------------
    function Na__FloorPlanMode__SyncFrame() {
        if (Na__FpMode__State !== Na__FpMode__STATE_PLAN) return;
        Na__PlanAnnoLayer__Sync();
        Na__PlanDimLayer__Sync();                                                // <-- Dimensions reproject in the same pass
        Na__PlanDimVert__Sync();                                                 // <-- Vertex handles stay planted on their points
    }
    // ------------------------------------------------------------


    // FUNCTION | Handle a Viewport Resize
    // ------------------------------------------------------------
    function Na__FloorPlanMode__HandleResize(width, height) {
        Na__FpCam__HandleResize(width, height);
        if (Na__FpMode__State !== Na__FpMode__STATE_PLAN) return;
        Na__PlanAnnoLayer__SyncLayerBox();                                       // <-- Canvas box moved; the text layer must follow it
        Na__PlanAnnoLayer__Sync();
        Na__PlanDimLayer__SyncLayerBox();                                        // <-- And the dimension layer with it
        Na__PlanDimLayer__Sync();
    }
    // ------------------------------------------------------------


    // FUNCTION | Point the Controller at a Different Model Root
    // ------------------------------------------------------------
    function Na__FloorPlanMode__SetModelRoot(modelRoot) {
        Na__FpMode__ModelRoot = modelRoot || null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - State Queries and Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Is Plan Mode Currently Displaying a Plan?
    // ------------------------------------------------------------
    function Na__FloorPlanMode__IsActive() {
        return Na__FpMode__State === Na__FpMode__STATE_PLAN;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is Plan Mode Active or Mid-Transition?
    // ------------------------------------------------------------
    function Na__FloorPlanMode__IsEngaged() {
        return Na__FpMode__State !== Na__FpMode__STATE_IDLE;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Floor Plan Currently Displayed (null When None)
    // ------------------------------------------------------------
    function Na__FloorPlanMode__GetActivePlan() {
        return Na__FpMode__ActivePlan;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is Annotation Authoring On?
    // ------------------------------------------------------------
    function Na__FloorPlanMode__IsEditMode() {
        return Na__FpMode__EditMode;
    }
    // ------------------------------------------------------------


    // FUNCTION | Initialize the Floor Plan Mode Controller
    // ------------------------------------------------------------
    // context: { camera, controls, canvas, modelRoot, onChanged }
    // Resolves false when the feature is switched off in config, so callers
    // can skip mounting the Dev menu section entirely.
    // ------------------------------------------------------------
    async function Na__FloorPlanMode__Initialize(context) {
        if (!context || !context.camera || !context.canvas) {
            console.warn('[TrueVision3D] Floor plan mode init skipped - missing camera or canvas.');
            return false;
        }

        Na__FpMode__PerspCamera = context.camera;
        Na__FpMode__Controls    = context.controls  || null;
        Na__FpMode__Canvas      = context.canvas;
        Na__FpMode__ModelRoot   = context.modelRoot || null;
        Na__FpMode__OnChanged   = (typeof context.onChanged === 'function') ? context.onChanged : null;

        const [planEnabled] = await Promise.all([
            Na__FpCfg__Load(),
            Na__PlanAnno__Load(),
            Na__PlanDim__Load()                                                  // <-- Also configures the dimension snap grid
        ]);

        Na__FpMode__Initialized = true;

        // From here a floor plan scene card switches into 2D rather than
        // flying the perspective camera to a pose it cannot read correctly.
        Na__PresentationMode__UI__SetSceneNavigationOverride(Na__FpMode__RouteSceneSelection);

        return planEnabled === true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Floor Plan Mode Controller API
    // ------------------------------------------------------------
    export {
        Na__FpMode__CHANGED_EVENT,
        Na__FloorPlanMode__Initialize,
        Na__FloorPlanMode__EnterPlan,
        Na__FloorPlanMode__ExitPlan,
        Na__FloorPlanMode__SetEditMode,
        Na__FloorPlanMode__IsEditMode,
        Na__FloorPlanMode__GetActiveCamera,
        Na__FloorPlanMode__SyncFrame,
        Na__FloorPlanMode__HandleResize,
        Na__FloorPlanMode__SetModelRoot,
        Na__FloorPlanMode__IsActive,
        Na__FloorPlanMode__IsEngaged,
        Na__FloorPlanMode__GetActivePlan
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
