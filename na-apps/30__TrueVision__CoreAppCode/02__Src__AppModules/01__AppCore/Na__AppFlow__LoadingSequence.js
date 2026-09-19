// =============================================================================
// TRUEVISION3D - APP FLOW - LOADING SEQUENCE
// =============================================================================
//
// FILE       : Na__AppFlow__LoadingSequence.js
// NAMESPACE  : Na__AppFlow
// MODULE     : LoadingSequence
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Main scene loading sequence, render loop, and resize handler
// CREATED    : 24-Feb-2026
//
// DESCRIPTION:
// - Initialises scene lighting and the render pipeline composer.
// - Resolves model URLs from the URL query parameter or config defaults.
// - Loads the OrbitHelperCube GLB and sets the orbit target from its centre.
// - Re-applies any saved camera / orbit target values from project.json.
// - Loads all scene models via the multi-model loader.
// - Runs the PBR materials second-pass if the materials system is enabled.
// - Initialises door animations and walk-mode collision meshes.
// - Starts the RAF render loop (including walk mode, door proximity, fog updates).
// - Attaches the window resize handler.
//
// Context Object (Na__AppFlow__StartLoadingSequence argument):
// - scene, camera, renderer, controls, modelRoot, fogPass, lineResolution
// - updateNavigation  : orbit controls update function from nav bundle
// - pipelineRef       : { current: null } mutable ref - module writes pipeline state here
// - configs           : lightingConfig, groundPlane, profileLines, models,
//                       modelUrls, materialsSystem, doorAnimation,
//                       orbitHelperCubeDebugVisible
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 13-Sep-2026 - Version 1.3.0
// - The design phase library is initialised before any project data, handed
//   the model groups with the phase about to load, and told when that phase
//   is in (also after a failed load, so nothing waits on it). The preferred
//   group rule moved into the library unchanged.
// - The materials pass is now a helper, Na__ApplyLibraryMaterials, shared with
//   the Design Phase menu and the library: a phase looks the same however it
//   was loaded.
//
// 16-Jun-2026 - Version 1.2.0
// - Wired camera-follow billboard system (SiteVegetation2D 2D vegetation).
// - Imports Na__CameraFollow__Initialize/Update; collects mesh+linework roots from
//   ALL loaded categories; initialises inside Na__ReinitializeModelBoundSystems
//   (rebind-aware across model-group switches) and updates per-frame in the render loop.
//
// 28-Feb-2026 - Version 1.1.0
// - Added model-group switch rebind pipeline via Na__ReinitializeModelBoundSystems.
// - Group switching now refreshes model toggles, storey controls, door bindings,
//   and walk-mode collision meshes against newly loaded scene objects.
// - Added preferred model group selection (latest non-existing group) for startup.
//
// 24-Feb-2026 - Version 1.0.0
// - Extracted from index.html inline script block (lines 604-849).
// - Na__UiFeature__UpdateStatus and Na__UiFeature__ShowScene moved to private
//   module functions; both now use document.getElementById directly.
// - Na__AppFlow__StartLoadingSequence refactored to accept a context object
//   instead of closing over index.html scope variables.
// - Na__RenderPipeline__State written back to context.pipelineRef.current
//   so the ImageExportControls lazy getter in index.html can read it.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js GLTF Loader
    // ------------------------------------------------------------
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Render Pipeline
    // ------------------------------------------------------------
    import { Na__RenderPipeline__SetupComposer } from '../05__RenderPipeline/Na__RenderPipeline__PostProcessing__Setup.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Model Loader
    // ------------------------------------------------------------
    import {
        Na__ModelLoader__LoadAllModels,
        Na__ModelLoader__SeparateOrbitCubeUrl,
        Na__ModelLoader__LoadOrbitHelperCube
    } from '../15__ModelLoader/Na__ModelLoader__MultiModel.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Scene Lighting
    // ------------------------------------------------------------
    import {
        Na__Scene__SetupDefaultSceneLighting,
        Na__Scene__ApplyEnvironmentMap
    } from '../06__Scene__LightingEffects/Na__Scene__DefaultSceneLighting.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Fog Effect
    // ------------------------------------------------------------
    import {
        Na__Scene__SetFogOrbitReference,
        Na__Scene__UpdateFogPassUniforms
    } from '../07__Scene__EnvironmentEffects/Na__Scene__DefaultFogEffect.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Math Utils
    // ------------------------------------------------------------
    import { Na__Math__ConvertMmToUnits } from '../04__MathUtils/Na__Math__Units.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Camera Controls
    // ------------------------------------------------------------
    import { Na__UiFeature__ApplyCameraConfig } from '../11__CameraUtils/Na__UiFeature__CameraPosition__Controls.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Navigation Toolbar Support (Modes State + Reset View Capture)
    // ------------------------------------------------------------
    import { Na__NavigationModes__SetEnabledModes } from '../10__NavigationAndCameras/Na__NavigationModes__State.js';
    import { Na__CameraStartState__CaptureStartState } from '../10__NavigationAndCameras/Na__Camera__ProjectStartState.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Presentation Mode Scene Data (Saved Camera Scenes)
    // ------------------------------------------------------------
    import {
        Na__PresentationMode__ProjectJson__GetSavedCameraScenes,
        Na__PresentationMode__ProjectJson__HasValidSavedScenes
    } from '../21__System__PresentationMode/Na__PresentationMode__ProjectJson__SceneData.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Cloudflare R2 API Client (source-of-truth project data)
    // ------------------------------------------------------------
    import {
        Na__CfApi__IsConfigured,
        Na__CfApi__ReadProjectData,
        Na__CfApi__SetLoadedProjectData
    } from '../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | DataLib Loader (Single Source of Truth)
    // ------------------------------------------------------------
    import { Na__DataLib__LoadAll, Na__DataLib__GetMaterials } from './AppCore__DataLib__Loader.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Materials System
    // ------------------------------------------------------------
    import { Na__MaterialsSystem__BuildLookup } from '../20__System__MaterialsSystem/Na__MaterialsSystem__LibraryLoader.js';
    import {
        Na__MaterialsSystem__ApplyMaterials,
        Na__MaterialsSystem__ApplyMirrorEnvironmentOverrides,
        Na__MaterialsSystem__ApplyGlassEnvironmentOverrides
    } from '../20__System__MaterialsSystem/Na__MaterialsSystem__MaterialSwap.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Model Toggle Controls
    // ------------------------------------------------------------
    import { Na__UiFeature__InitializeModelToggleControls } from '../26__System__ToggleModelElements/Na__UiFeature__ModelToggle__Controls.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Storey View Controls
    // ------------------------------------------------------------
    import { Na__UiFeature__InitializeStoreyViewControls } from '../26__System__ToggleModelElements/Na__UiFeature__StoreyView__Controls.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Storey Isolate Controls
    // ------------------------------------------------------------
    import { Na__UiFeature__InitializeStoreyIsolateControls } from '../26__System__ToggleModelElements/Na__UiFeature__StoreyIsolate__Controls.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Context Menu System
    // ------------------------------------------------------------
    import { Na__ContextMenu__ResetForModelChange } from '../27__System__ContextMenuSystem/Na__ContextMenuSystem__SystemLogic__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Section Cut Engine and 2D Drawing Modes
    // ------------------------------------------------------------
    // A 2D drawing - a floor plan or an elevation - owns the view outright
    // while it is displayed. The render loop asks the DRAWING VIEW BROKER for
    // a camera each frame and, when it answers, draws flat instead of running
    // the composer. Asking the broker rather than each controller in turn is
    // what keeps the loop from growing a branch per drawing type.
    // @delegate: ../40__System__DrawingViewCore/
    // @delegate: ../41__System__SectionCutEngine/Na__SectionCut__Engine__.js
    // @delegate: ../42__System__FloorPlanViews/Na__FloorPlan__ModeController__.js
    // @delegate: ../45__System__ElevationViews/Na__Elevation__ModeController__.js
    // ------------------------------------------------------------
    import {
        Na__SectionCut__RenderOverlay,
        Na__SectionCut__HandleResize,
        Na__SectionCut__SetModelRoot
    } from '../41__System__SectionCutEngine/Na__SectionCut__Engine__.js';
    import { Na__DrawView__GetCamera } from '../40__System__DrawingViewCore/Na__DrawView__ActiveView__.js';
    import { Na__DrawMarkup__SyncFrame } from '../40__System__DrawingViewCore/Na__DrawView__MarkupMount__.js';
    import {
        Na__DrawProfile__Initialise,
        Na__DrawProfile__RenderOverlay,
        Na__DrawProfile__HandleResize,
        Na__DrawProfile__InvalidateSceneCache
    } from '../40__System__DrawingViewCore/Na__DrawView__ProfileLines__.js';
    import {
        Na__FloorPlanMode__HandleResize
    } from '../42__System__FloorPlanViews/Na__FloorPlan__ModeController__.js';
    import {
        Na__ElevationMode__HandleResize
    } from '../45__System__ElevationViews/Na__Elevation__ModeController__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Door Animation System
    // ------------------------------------------------------------
    import {
        Na__DoorAnimation__Initialize,
        Na__DoorAnimation__RebindModelGroups,
        Na__DoorAnimation__Update,
        Na__DoorAnimation__HasActiveAnimations
    } from '../25__System__3dObject__InteractionSystem/3dObjectIInteraction__Animation__ClickToOpenDoors__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Camera Follow Billboard System
    // ------------------------------------------------------------
    import {
        Na__CameraFollow__Initialize,
        Na__CameraFollow__Update
    } from '../25__System__3dObject__InteractionSystem/3dObjectInteraction__Animation__CameraFollowBillboards__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Walk Mode System
    // ------------------------------------------------------------
    import {
        Na__WalkMode__IsActive,
        Na__WalkMode__Update,
        Na__WalkMode__SetCollisionMeshes,
        Na__WalkMode__GetCapsulePosition,
        Na__WalkMode__SetFovOverride
    } from '../10__NavigationAndCameras/Na__Navmode__WalkMode__SystemLogic.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Fly Mode System
    // ------------------------------------------------------------
    import {
        Na__FlyMode__IsActive,
        Na__FlyMode__Update,
        Na__FlyMode__GetCameraPosition,
        Na__FlyMode__SetFovOverride
    } from '../10__NavigationAndCameras/Na__Navmode__FlyMode__SystemLogic.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Door Proximity System
    // ------------------------------------------------------------
    import { Na__DoorProximity__Update } from '../25__System__3dObject__InteractionSystem/3dObjectInteraction__Animation__WalkMode__ProximityToOpenDoors__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Project Loader Utilities
    // ------------------------------------------------------------
    import {
        Na__AppUtils__IsRunningOnLocalhost,
        Na__AppUtils__GetProjectCodeFromUrl,
        Na__AppUtils__GetProjectFolderFromUrl,
        Na__AppUtils__GetYearFromUrl,
        Na__AppUtils__FetchTrueVisionProjectData,
        Na__AppUtils__HasModelGroups,
        Na__AppUtils__ExtractModelGroup,
        Na__AppUtils__FetchProjectJson,
        Na__AppUtils__ExtractModelUrls
    } from '../03__AppUtils/Na__AppUtils__ProjectLoader.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Model Group Selector UI
    // ------------------------------------------------------------
    import {
        Na__UiFeature__InitializeModelGroupSelector
    } from '../26__System__ToggleModelElements/Na__UiFeature__ModelGroupSelector.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Design Phase Library (every model group, the live one, the rest off-scene)
    // ------------------------------------------------------------
    import {
        Na__PhaseLib__Initialize,
        Na__PhaseLib__ResolvePreferredIndex,
        Na__PhaseLib__SetGroups,
        Na__PhaseLib__SetLive
    } from '../26__System__ToggleModelElements/Na__ModelGroup__PhaseLibrary__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Render Loop Invalidation
    // ------------------------------------------------------------
    import {
        NA__REQUEST_RENDER_EVENT,
        NA__REQUEST_ACTIVE_RENDER_EVENT,
        NA__STOP_ACTIVE_RENDER_EVENT,
        Na__RenderLoop__IsPaused
    } from '../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Progressive Refinement (Idle-Time Supersampling)
    // @delegate: ../05__RenderPipeline/Na__RenderEffect__ProgressiveRefine__.js
    // ------------------------------------------------------------
    import {
        Na__ProgressiveRefine__Create,
        Na__ProgressiveRefine__SetActive,
        Na__Refine__FRAME_REFINE,
        Na__Refine__FRAME_PRESENT
    } from '../05__RenderPipeline/Na__RenderEffect__ProgressiveRefine__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Distance Culling
    // ------------------------------------------------------------
    import {
        Na__DistanceCulling__Initialize,
        Na__DistanceCulling__RegisterModelGroups,
        Na__DistanceCulling__Update,
        Na__DistanceCulling__SetCullDistanceMm
    } from '../05__RenderPipeline/Na__RenderEffect__DistanceCulling__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Dev-Menu-Saved Project Data Keys (R2 overlay on localhost)
    // ------------------------------------------------------------
    // The localhost loader overlays ONLY these keys from the live R2 copy onto
    // the full base project data, so dev edits persist while model-defining
    // keys always come from the complete base file.
    const Na__DevSavedKeys = [
        'PresentationMode__SavedCameraScenes',   // <-- Saved camera scenes (Presentation Mode)
        'LayoutEditor__DrawingsData',            // <-- Floor plans, elevations, sheets and their markup (v2.21.0)
        'Navmode__EnabledModes',                 // <-- Walk / Fly enable flags
        'Navmode__OrbitMaxDistanceMm',           // <-- Per-project orbit zoom cap
        'RenderEffect__AssetCullDistanceMm',     // <-- Per-project furniture / decor cull distance
        'Navmode__FovOverrides',                 // <-- Per-project Orbit/Walk/Fly default FOV overrides
        'Camera__DefaultPosition',               // <-- Saved camera position / rotation / FOV
        'OrbitHelperCube__Position'              // <-- Saved orbit target
    ];
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Private UI Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Refine the Installable App Name from Project Data
    // ------------------------------------------------------------
    // The PWA manifest is built at boot from the project folder in the URL,
    // long before this data arrives, so "RB05__WestFarm" already reads as
    // "West Farm". Where the project data carries a better name, this hands it
    // over and the manifest is rebuilt, which browsers pick up on their next
    // installability evaluation. Entirely best-effort: the PWA modules are
    // optional and the app must boot identically without them.
    // @delegate: ../62__Feature__AppInstallability/
    // ------------------------------------------------------------
    function Na__AppFlow__RefinePwaProjectName(projectData) {
        try {
            const contextModule  = window.TrueVision__Pwa__ProjectContext;    // <-- PWA project context
            const manifestModule = window.TrueVision__Pwa__Manifest;          // <-- PWA manifest builder
            if (!contextModule || !manifestModule) return;                    // <-- PWA modules not loaded

            const projectName    = projectData && projectData.projectName;    // <-- e.g. "WestFarm"
            if (!projectName) return;                                         // <-- Nothing better to offer

            if (contextModule.setProjectDataName(projectName)) {
                manifestModule.refresh();                                     // <-- Name changed, rebuild the manifest
            }
        } catch (error) {
            console.warn('[TrueVision3D] PWA project name refinement skipped:', error);
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Update Status Display
    // ------------------------------------------------------------
    function Na__UiFeature__UpdateStatus(message, isError = false) {
        const statusText      = document.getElementById('statusText');       // <-- Debug status element
        const loadingIndicator = document.getElementById('loadingIndicator'); // <-- Loading overlay text

        if (statusText) statusText.textContent = message;
        if (!loadingIndicator) return;
        loadingIndicator.textContent = message;

        if (isError) {
            loadingIndicator.style.color = '#d32f2f';                        // <-- Error color
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show Scene When Ready
    // ------------------------------------------------------------
    function Na__UiFeature__ShowScene() {
        const statusText       = document.getElementById('statusText');      // <-- Debug status element
        const loadingOverlay   = document.getElementById('loadingOverlay');  // <-- Loading overlay container
        const canvas           = document.getElementById('renderCanvas');    // <-- Render canvas
        const loadingIndicator = document.getElementById('loadingIndicator'); // <-- Loading overlay text

        if (statusText) statusText.textContent = 'Complete - TrueVision3D Ready';

        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
            }, 500);
        }

        if (canvas) {
            canvas.classList.remove('canvas-hidden');
            canvas.classList.add('canvas-visible');
        }

        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }

        window.dispatchEvent(new CustomEvent('na-app-scene-ready'));         // <-- Model is loaded and visible; post-load UI may appear
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Main Loading Sequence
// -----------------------------------------------------------------------------

    // FUNCTION | Main Loading Sequence
    // ------------------------------------------------------------
    async function Na__AppFlow__StartLoadingSequence(context) {

        // LOAD DATALIB INDEX FILES (must complete before any system reads DataLib data)
        // ---------------------------------------------------------------
        await Na__DataLib__LoadAll();                                         // <-- Parallel fetch of all 4 DataLib files from GitHub
        // ---------------------------------------------------------------

        // DESTRUCTURE CONTEXT | Scene Instances
        // ---------------------------------------------------------------
        const {
            scene      : Na__Scene__Main,
            camera     : Na__Camera__Main,
            renderer   : Na__Renderer__Main,
            controls   : Na__Controls__Orbit,
            modelRoot  : Na__ModelGroup__Root,
            fogPass    : Na__SceneEffect__FogPass,
            lineResolution   : Na__LineResolution__Screen,
            updateNavigation : Na__Navmode__UpdateNavigation,
            pipelineRef,
            configs
        } = context;
        // ---------------------------------------------------------------

        // DESTRUCTURE CONTEXT | Config Values
        // ---------------------------------------------------------------
        const {
            lightingConfig              : Na__Config__LightingConfig,
            sceneEnvironment            : Na__Config__SceneEnvironment,
            groundPlane                 : Na__Config__GroundPlane,
            profileLines                : Na__Config__ProfileLines,
            models                      : Na__Config__Models,
            modelUrls                   : Na__ModelDefaults__ModelUrls,
            materialsSystem             : Na__Config__MaterialsSystem,
            doorAnimation               : Na__Config__DoorAnimation,
            cameraFollow                : Na__Config__CameraFollow,
            orbitHelperCubeDebugVisible : Na__OrbitHelperCube__Debug__Visible,
            storeyVisibility            : Na__Config__StoreyVisibility,
            ambientOcclusion            : Na__Config__AmbientOcclusion,
            progressiveRefine           : Na__Config__ProgressiveRefine,
            distanceCulling             : Na__Config__DistanceCulling
        } = configs;
        // ---------------------------------------------------------------

        Na__DistanceCulling__Initialize(Na__Config__DistanceCulling);    // <-- Configure furniture/decor distance culling (mm -> units)

        Na__UiFeature__UpdateStatus('Creating scene...');
        Na__Scene__SetupDefaultSceneLighting(Na__Scene__Main, Na__Config__LightingConfig, Na__Config__GroundPlane);
        const Na__Scene__EnvironmentTexture = await Na__Scene__ApplyEnvironmentMap(Na__Scene__Main, Na__Renderer__Main, Na__Config__SceneEnvironment);

        const Na__RenderPipeline__State = Na__RenderPipeline__SetupComposer(Na__Renderer__Main, Na__Scene__Main, Na__Camera__Main, Na__Config__ProfileLines, Na__SceneEffect__FogPass, Na__Config__AmbientOcclusion, Na__Controls__Orbit.target);
        const Na__RenderComposer__Main  = Na__RenderPipeline__State.composer;
        pipelineRef.current = Na__RenderPipeline__State;                     // <-- Write back to index.html ref for ImageExport

        // 2D DRAWING PROFILE LINES | The same silhouette edges, for the flat views.
        // Handed the pipeline state so it can borrow the 3D effect's two buffers
        // rather than allocate a second pair that could never be in use at the
        // same time; it falls back to its own when profile lines are disabled.
        Na__DrawProfile__Initialise(
            Na__Renderer__Main,
            Na__Scene__Main,
            Na__Config__ProfileLines,
            Na__RenderPipeline__State
        );
        const Na__AoPerformanceMonitorStartupDelayMs = (Na__Config__AmbientOcclusion && Number.isFinite(Na__Config__AmbientOcclusion.RenderEffect__AmbientOcclusion__PerformanceMonitorStartupDelayMs))
            ? Na__Config__AmbientOcclusion.RenderEffect__AmbientOcclusion__PerformanceMonitorStartupDelayMs
            : 3000;
        let Na__RenderLoop__CanMonitorAoPerformance = false;                 // <-- Prevent startup spikes from disabling AO too early

        let modelUrls = [...Na__ModelDefaults__ModelUrls];                   // <-- Start with config defaults
        let Na__Saved__ProjectCameraConfig = null;                           // <-- Hoisted for post-OrbitCube re-apply
        let Na__Saved__ProjectOrbitTarget  = null;                           // <-- Hoisted for post-OrbitCube re-apply
        let Na__ProjectData__AllModelGroups = null;                          // <-- Store all model groups for group selector UI
        let Na__ProjectData__Full = null;                                    // <-- Full project data (nav modes + presentation scenes)

        // HELPER FUNCTION | Pick Latest Concept Group (prefer non-existing, newest at end)
        // ------------------------------------------------------------
        // The rule itself moved into the design phase library on 13-Sep-2026,
        // word for word, because the Layout Editor's Project Default has to be
        // this same answer and two copies of a rule drift apart.
        // ------------------------------------------------------------
        const Na__ResolvePreferredModelGroupIndex = (modelGroups) => Na__PhaseLib__ResolvePreferredIndex(modelGroups);
        // ------------------------------------------------------------

        // HELPER FUNCTION | Resolve Door Category Name Tokens from AppConfig
        // ------------------------------------------------------------
        const Na__ResolveDoorCategoryNameTokens = (doorAnimationConfig) => {
            const defaultTokens = ['ProposedDoors'];                         // <-- Backward-compatible fallback
            const configuredTokens = doorAnimationConfig && doorAnimationConfig['3dObject__Interaction__DoorAnimation__CategoryNameTokens'];
            if (!Array.isArray(configuredTokens)) return defaultTokens;

            const normalizedTokens = configuredTokens
                .filter((token) => typeof token === 'string')
                .map((token) => token.trim())
                .filter((token) => token.length > 0);

            return normalizedTokens.length > 0 ? normalizedTokens : defaultTokens;
        };
        // ------------------------------------------------------------

        const Na__DoorAnimation__CategoryNameTokens = Na__ResolveDoorCategoryNameTokens(Na__Config__DoorAnimation);

        // HELPER FUNCTION | Collect Door Mesh/Linework Roots from Loaded Groups
        // ------------------------------------------------------------
        const Na__CollectDoorModelGroups = (loadedModelGroups) => {
            const doorMeshGroups = [];
            const doorLineworkGroups = [];

            if (!loadedModelGroups || typeof loadedModelGroups.forEach !== 'function') {
                return { doorMeshGroups, doorLineworkGroups };
            }

            loadedModelGroups.forEach((categoryGroup, categoryKey) => {
                const hasDoorCategoryToken = Na__DoorAnimation__CategoryNameTokens.some((token) => categoryKey.includes(token));
                if (!hasDoorCategoryToken) return;

                const children = categoryGroup.children || [];
                let taggedMesh = null;
                let taggedLinework = null;

                for (const child of children) {
                    const modelType = child.userData && child.userData.Na__ModelType;
                    if (modelType === 'mesh') taggedMesh = child;
                    if (modelType === 'linework') taggedLinework = child;
                }

                if (taggedMesh)     doorMeshGroups.push(taggedMesh);
                if (taggedLinework) doorLineworkGroups.push(taggedLinework);
                if (!taggedMesh && !taggedLinework) {
                    console.warn(`[DoorAnimation] Category "${categoryKey}" matched door token but has no tagged mesh/linework children — skipping.`);
                }
            });

            return { doorMeshGroups, doorLineworkGroups };
        };
        // ------------------------------------------------------------

        // HELPER FUNCTION | Collect Mesh/Linework Roots from ALL Loaded Categories
        // ------------------------------------------------------------
        // Camera-follow billboards are identified by their baked glTF extras flag,
        // not by category, so every loaded category is scanned. The billboard
        // module filters out non-billboard nodes during its own traverse.
        const Na__CollectCameraFollowModelGroups = (loadedModelGroups) => {
            const meshRoots     = [];
            const lineworkRoots = [];

            if (!loadedModelGroups || typeof loadedModelGroups.forEach !== 'function') {
                return { meshRoots, lineworkRoots };
            }

            loadedModelGroups.forEach((categoryGroup) => {
                const children = categoryGroup.children || [];
                for (const child of children) {
                    const modelType = child.userData && child.userData.Na__ModelType;
                    if (modelType === 'mesh')     meshRoots.push(child);
                    if (modelType === 'linework') lineworkRoots.push(child);
                }
            });

            return { meshRoots, lineworkRoots };
        };
        // ------------------------------------------------------------


        // HELPER FUNCTION | Reinitialize Model-Bound Runtime Systems
        // ------------------------------------------------------------
        const Na__ReinitializeModelBoundSystems = (loadedModelGroups) => {
            Na__ContextMenu__ResetForModelChange();                          // <-- Old isolation/hidden set refers to replaced groups
            Na__UiFeature__InitializeModelToggleControls(loadedModelGroups);
            Na__UiFeature__InitializeStoreyViewControls(Na__ModelGroup__Root, Na__Config__StoreyVisibility || {});
            Na__UiFeature__InitializeStoreyIsolateControls();

            if (Na__Config__DoorAnimation['3dObject__Interaction__DoorAnimation__Enabled'] !== false) {
                const { doorMeshGroups, doorLineworkGroups } = Na__CollectDoorModelGroups(loadedModelGroups);
                if (doorMeshGroups.length > 0 || doorLineworkGroups.length > 0) {
                    const rebound = Na__DoorAnimation__RebindModelGroups(doorMeshGroups, doorLineworkGroups);
                    if (!rebound) {
                        Na__DoorAnimation__Initialize(
                            Na__Scene__Main,
                            Na__Camera__Main,
                            Na__Renderer__Main.domElement,
                            doorMeshGroups,
                            doorLineworkGroups,
                            Na__Config__DoorAnimation
                        );
                    }
                    console.log(`[TrueVision3D] Door animation ready (${doorMeshGroups.length} mesh, ${doorLineworkGroups.length} linework)`);
                } else {
                    console.log('[TrueVision3D] Door animation enabled but no door model groups found');
                }
            }

            if (!Na__Config__CameraFollow || Na__Config__CameraFollow['3dObject__Interaction__CameraFollow__Enabled'] !== false) {
                const { meshRoots, lineworkRoots } = Na__CollectCameraFollowModelGroups(loadedModelGroups);
                const billboardCount = Na__CameraFollow__Initialize(meshRoots, lineworkRoots, Na__Config__CameraFollow || {}, Na__Camera__Main);
                console.log(`[TrueVision3D] Camera-follow billboards ready (${billboardCount} registered)`);
            }

            Na__WalkMode__SetCollisionMeshes(Na__ModelGroup__Root);
            Na__DistanceCulling__RegisterModelGroups(loadedModelGroups); // <-- (Re)build furniture/decor cull registry on load + group switch
            Na__SectionCut__SetModelRoot(Na__ModelGroup__Root);          // <-- Fresh materials need the clip planes re-applied, then caps rebuilt
            if (Na__RenderPipeline__State && typeof Na__RenderPipeline__State.invalidateProfileLinesCache === 'function') {
                Na__RenderPipeline__State.invalidateProfileLinesCache();     // <-- Scene graph changed, rebuild cached profile-line inputs
            }
            Na__DrawProfile__InvalidateSceneCache();                        // <-- The 2D views keep their own list of the same objects
            window.dispatchEvent(new CustomEvent(NA__REQUEST_RENDER_EVENT)); // <-- Redraw after runtime rebinds or visibility changes
        };
        // ------------------------------------------------------------

        // HELPER FUNCTION | Apply the Materials Library to Freshly Loaded Groups
        // ------------------------------------------------------------
        // The PBR second pass with the mirror and glass environment overrides,
        // lifted out of the startup load unchanged. The Design Phase menu and the
        // design phase library run it too, so a phase looks the same however it
        // came to be loaded. Before 13-Sep-2026 a phase switched to from the menu
        // kept the loader's plain materials.
        // ------------------------------------------------------------
        const Na__ApplyLibraryMaterials = async (loadedModelGroups) => {
            if (!Na__Config__MaterialsSystem.MaterialsSystem__Config__Enabled || !loadedModelGroups) return;
            const Na__MaterialsLibraryData = Na__DataLib__GetMaterials();  // <-- Cached; no network fetch here
            if (!Na__MaterialsLibraryData) return;
            const Na__MaterialsLookupMap = Na__MaterialsSystem__BuildLookup(Na__MaterialsLibraryData);
            if (Na__MaterialsLookupMap.size === 0) return;

            for (const [, group] of loadedModelGroups) {
                await Na__MaterialsSystem__ApplyMaterials(group, Na__MaterialsLookupMap, Na__Config__MaterialsSystem);

                if (Na__Scene__EnvironmentTexture && Na__Config__SceneEnvironment && Na__Config__SceneEnvironment.Scene__Environment__MirrorOnly === true) {
                    Na__MaterialsSystem__ApplyMirrorEnvironmentOverrides(group, Na__Scene__EnvironmentTexture, {
                        targetMaterialName : Na__Config__SceneEnvironment.Scene__Environment__MirrorMaterialName,
                        envMapIntensity    : Na__Config__SceneEnvironment.Scene__Environment__MirrorEnvMapIntensity,
                        brightnessBoost    : Na__Config__SceneEnvironment.Scene__Environment__MirrorBrightnessBoost,
                        roughnessOverride  : Na__Config__SceneEnvironment.Scene__Environment__MirrorRoughnessOverride
                    });

                    if (Na__Config__SceneEnvironment.Scene__Environment__GlassEnabled === true) {
                        Na__MaterialsSystem__ApplyGlassEnvironmentOverrides(group, Na__Scene__EnvironmentTexture, {
                            targetMaterialName : Na__Config__SceneEnvironment.Scene__Environment__GlassMaterialName,
                            envMapIntensity    : Na__Config__SceneEnvironment.Scene__Environment__GlassEnvMapIntensity,
                            brightnessMultiplier: Na__Config__SceneEnvironment.Scene__Environment__GlassBrightnessMultiplier
                        });
                    }
                }
            }
        };
        // ------------------------------------------------------------

        // DESIGN PHASE LIBRARY | Registered Before Any Project Data Arrives
        // ------------------------------------------------------------
        // Every other design phase loads through the same loader, configs and
        // materials pass as the model this sequence loads below.
        // @delegate: ../26__System__ToggleModelElements/Na__ModelGroup__PhaseLibrary__.js
        // ------------------------------------------------------------
        Na__PhaseLib__Initialize({
            modelRoot      : Na__ModelGroup__Root,
            modelsConfig   : Na__Config__Models,
            lineResolution : Na__LineResolution__Screen,
            afterLoad      : Na__ApplyLibraryMaterials
        });
        // ------------------------------------------------------------

        // RESOLVE PROJECT-SPECIFIC MODEL URLS
        const projectCode   = Na__AppUtils__GetProjectCodeFromUrl();
        const projectFolder = Na__AppUtils__GetProjectFolderFromUrl();
        const yearCode      = Na__AppUtils__GetYearFromUrl();

        if (projectCode && projectFolder) {
            // NEW PATH | Fetch TrueVision__ProjectData__.json (full base) then,
            // on localhost, overlay the Dev-menu-saved keys from the live R2 copy
            // (bypasses CDN cache) so saves persist and are visible on reload.
            // The model-defining keys always come from the full base file, so a
            // partial R2 copy can never break model loading; the next save
            // re-seeds R2 with the complete merged document.
            try {
                Na__UiFeature__UpdateStatus('Loading project data...');
                const projectData = await Na__AppUtils__FetchTrueVisionProjectData(projectFolder, yearCode); // <-- CDN (prod) or local file (dev)

                if (Na__AppUtils__IsRunningOnLocalhost() && Na__CfApi__IsConfigured()) {
                    const r2Result = await Na__CfApi__ReadProjectData();       // <-- Fresh read from R2 via worker
                    if (r2Result.ok && !r2Result.missing && r2Result.data) {
                        const r2Data = r2Result.data;
                        Na__DevSavedKeys.forEach((key) => {
                            if (r2Data[key] !== undefined) projectData[key] = r2Data[key]; // <-- Overlay dev-saved value from R2
                        });
                        console.log('[TrueVision3D] Overlaid Dev-menu-saved keys from R2 (localhost source of truth).');
                    }
                }

                Na__ProjectData__Full          = projectData;                  // <-- Retain full data for nav modes + presentation scenes
                Na__Saved__ProjectCameraConfig = projectData.Camera__DefaultPosition || null;
                Na__Saved__ProjectOrbitTarget  = projectData.OrbitHelperCube__Position || null;

                Na__AppFlow__RefinePwaProjectName(projectData);                // <-- Name the installable app after the project

                if (Na__AppUtils__HasModelGroups(projectData)) {
                    Na__ProjectData__AllModelGroups = projectData.modelGroups;
                    const activeIndex = Na__ResolvePreferredModelGroupIndex(projectData.modelGroups);
                    const groupUrls   = Na__AppUtils__ExtractModelGroup(projectData, activeIndex);
                    Na__PhaseLib__SetGroups(projectData.modelGroups, activeIndex); // <-- Every design phase, and the one the 3D view is about to load

                    if (groupUrls.length > 0) {
                        modelUrls = groupUrls;
                    }
                    console.log(`[TrueVision3D] Loaded ${projectData.modelGroups.length} model group(s), active: ${activeIndex}`);
                }
            } catch (error) {
                console.warn('[TrueVision3D] TrueVision project data load failed, trying legacy path', error);

                // LEGACY FALLBACK | Try old project.json format
                try {
                    const legacyData = await Na__AppUtils__FetchProjectJson(projectCode);

                    Na__ProjectData__Full          = legacyData;               // <-- Retain full data for nav modes + presentation scenes
                    Na__Saved__ProjectCameraConfig = legacyData.Camera__DefaultPosition
                        || legacyData.trueVision_Camera__DefaultPosition
                        || legacyData.valeVision_Camera__DefaultPosition
                        || null;
                    Na__Saved__ProjectOrbitTarget = legacyData.OrbitHelperCube__Position || null;

                    const projectUrls = Na__AppUtils__ExtractModelUrls(legacyData);
                    if (projectUrls.length > 0) {
                        modelUrls = projectUrls;
                    }
                } catch (legacyError) {
                    console.warn('[TrueVision3D] Legacy project data also failed, using defaults', legacyError);
                }
            }
        } else if (projectCode) {
            // LEGACY PATH | Only ?project= provided (no project-folder), use old fetch
            try {
                Na__UiFeature__UpdateStatus('Loading project data...');
                const projectData = await Na__AppUtils__FetchProjectJson(projectCode);

                Na__ProjectData__Full          = projectData;                  // <-- Retain full data for nav modes + presentation scenes
                Na__Saved__ProjectCameraConfig = projectData.Camera__DefaultPosition
                    || projectData.trueVision_Camera__DefaultPosition
                    || projectData.valeVision_Camera__DefaultPosition
                    || null;
                Na__Saved__ProjectOrbitTarget  = projectData.OrbitHelperCube__Position || null;

                Na__AppFlow__RefinePwaProjectName(projectData);                // <-- Name the installable app after the project

                const projectUrls = Na__AppUtils__ExtractModelUrls(projectData);
                if (projectUrls.length > 0) {
                    modelUrls = projectUrls;
                }
            } catch (error) {
                console.warn('[TrueVision3D] Project data load failed, using defaults', error);
            }
        }

        // SEPARATE ORBIT HELPER CUBE URL FROM MODEL URLS
        const { orbitCubeUrl, filteredUrls } = Na__ModelLoader__SeparateOrbitCubeUrl(modelUrls);
        modelUrls = filteredUrls;                                            // <-- Use filtered URLs (without orbit cube) for model loading
        if (!orbitCubeUrl) {
            console.warn('[TrueVision3D] OrbitHelperCube URL not found in model list. Orbit target will use saved project target if available.');
        }

        // LOAD ORBIT HELPER CUBE IF PRESENT
        let Na__OrbitHelperCube__Mesh = null;                                // <-- Store orbit cube mesh reference
        let Na__OrbitHelperCube__CenterPosition = null;                      // <-- Store orbit cube center for target precedence
        if (orbitCubeUrl) {
            try {
                Na__UiFeature__UpdateStatus('Loading orbit helper cube...');
                const loader = new GLTFLoader();
                const orbitCubeResult = await Na__ModelLoader__LoadOrbitHelperCube(orbitCubeUrl, loader);

                if (orbitCubeResult && orbitCubeResult.mesh && orbitCubeResult.centerPosition) {
                    Na__OrbitHelperCube__Mesh = orbitCubeResult.mesh;        // <-- Store mesh reference
                    Na__OrbitHelperCube__CenterPosition = orbitCubeResult.centerPosition.clone(); // <-- Store center position
                    Na__OrbitHelperCube__Mesh.name = 'OrbitHelperCube';      // <-- Name for debugging
                    Na__OrbitHelperCube__Mesh.visible = Na__OrbitHelperCube__Debug__Visible;  // <-- Hide unless debug enabled

                    Na__Scene__Main.add(Na__OrbitHelperCube__Mesh);          // <-- Add to scene
                    Na__Scene__SetFogOrbitReference(Na__SceneEffect__FogPass, orbitCubeResult.centerPosition); // <-- Fog anchor now follows orbit cube center

                    console.log('[TrueVision3D] OrbitHelperCube loaded. Center resolved:', orbitCubeResult.centerPosition);
                } else {
                    console.warn('[TrueVision3D] OrbitHelperCube loaded but center position could not be resolved.');
                }
            } catch (error) {
                console.warn('[TrueVision3D] OrbitHelperCube could not be loaded. Orbit will use saved project target if available.', error);
            }
        }

        // RESOLVE FINAL ORBIT TARGET (STRICT PRECEDENCE)
        // 1) Loaded OrbitHelperCube GLB center (authoritative fixed anchor)
        // 2) Saved project OrbitHelperCube__Position (only if helper cube unavailable)
        // 3) Keep current controls target (no Dev__DefaultCube fallback)
        let Na__FinalOrbitTargetApplied = false;
        if (Na__OrbitHelperCube__CenterPosition && Na__OrbitHelperCube__CenterPosition.isVector3) {
            Na__Controls__Orbit.target.copy(Na__OrbitHelperCube__CenterPosition);
            Na__FinalOrbitTargetApplied = true;
            if (Na__Saved__ProjectOrbitTarget) {
                console.warn('[TrueVision3D] Saved OrbitHelperCube__Position ignored because OrbitHelperCube GLB center is available.');
            }
        } else if (Na__Saved__ProjectOrbitTarget) {
            Na__Controls__Orbit.target.set(
                Na__Math__ConvertMmToUnits(Na__Saved__ProjectOrbitTarget.OrbitHelperCube__Position__PosX),  // <-- Saved orbit X
                Na__Math__ConvertMmToUnits(Na__Saved__ProjectOrbitTarget.OrbitHelperCube__Position__PosY),  // <-- Saved orbit Y
                Na__Math__ConvertMmToUnits(Na__Saved__ProjectOrbitTarget.OrbitHelperCube__Position__PosZ)   // <-- Saved orbit Z
            );
            Na__FinalOrbitTargetApplied = true;
        } else {
            console.warn('[TrueVision3D] No saved orbit target and no OrbitHelperCube center resolved. Keeping current controls.target.');
        }

        // RE-APPLY SAVED CAMERA (without legacy Camera__DefaultTarget override)
        if (Na__Saved__ProjectCameraConfig) {
            const Na__CameraConfigWithoutLegacyTarget = { ...Na__Saved__ProjectCameraConfig };
            if (Na__CameraConfigWithoutLegacyTarget.Camera__DefaultTarget) {
                delete Na__CameraConfigWithoutLegacyTarget.Camera__DefaultTarget;
            }
            Na__UiFeature__ApplyCameraConfig(
                Na__Camera__Main,                                            // <-- Re-apply saved camera position + FOV
                Na__Controls__Orbit,                                         // <-- Re-apply with correct orbit target
                Na__CameraConfigWithoutLegacyTarget
            );
        }
        if (Na__FinalOrbitTargetApplied || Na__Saved__ProjectCameraConfig) {
            Na__Controls__Orbit.update();                                    // <-- Finalize controls with restored state
        }

        // APPLY PER-PROJECT ORBIT MAX DISTANCE OVERRIDE (if present in project data)
        if (Na__ProjectData__Full && Number.isFinite(Na__ProjectData__Full.Navmode__OrbitMaxDistanceMm)) {
            Na__Controls__Orbit.maxDistance = Na__Math__ConvertMmToUnits(Na__ProjectData__Full.Navmode__OrbitMaxDistanceMm); // <-- Per-project zoom-out cap
            Na__Controls__Orbit.update();
        }

        // APPLY PER-PROJECT ASSET CULL DISTANCE OVERRIDE (if present in project data)
        // Runs ahead of the model load below, so RegisterModelGroups builds the
        // cull registry against the project distance rather than the AppConfig
        // default. Ignored when culling is disabled in AppConfig.
        if (Na__ProjectData__Full && Number.isFinite(Na__ProjectData__Full.RenderEffect__AssetCullDistanceMm)) {
            const Na__ProjectCullDistanceMm = Na__ProjectData__Full.RenderEffect__AssetCullDistanceMm;
            if (Na__DistanceCulling__SetCullDistanceMm(Na__ProjectCullDistanceMm)) {
                console.log(`[TrueVision3D] Asset cull distance override applied: ${Na__ProjectCullDistanceMm}mm (project data).`);
            }
        }

        // APPLY PER-PROJECT FOV OVERRIDES (Orbit live, Walk/Fly staged for activation)
        // Orbit FOV is applied to the live camera BEFORE CaptureStartState below so
        // the canonical Reset View state carries the per-project orbit FOV too.
        const Na__FovOverrides = (Na__ProjectData__Full && Na__ProjectData__Full.Navmode__FovOverrides) || null;
        if (Na__FovOverrides) {
            const orbitFovDeg = Na__FovOverrides.Navmode__FovOverrides__OrbitDeg;
            const walkFovDeg  = Na__FovOverrides.Navmode__FovOverrides__WalkDeg;
            const flyFovDeg   = Na__FovOverrides.Navmode__FovOverrides__FlyDeg;

            if (Number.isFinite(orbitFovDeg) && orbitFovDeg > 0) {
                Na__Camera__Main.fov = orbitFovDeg;                          // <-- Per-project orbit/default FOV
                Na__Camera__Main.updateProjectionMatrix();
            }
            if (Number.isFinite(walkFovDeg) && walkFovDeg > 0) {
                Na__WalkMode__SetFovOverride(walkFovDeg);                    // <-- Staged for next Walk activation
            }
            if (Number.isFinite(flyFovDeg) && flyFovDeg > 0) {
                Na__FlyMode__SetFovOverride(flyFovDeg);                      // <-- Staged for next Fly activation
            }
        }

        // REGISTER FULL PROJECT DATA AS THE DEV-MENU SAVE MERGE BASE
        // Dev-menu saves merge changed keys into this object and write the whole
        // document back to R2, so model groups / camera / etc. are never dropped.
        Na__CfApi__SetLoadedProjectData(Na__ProjectData__Full);

        // CAPTURE CANONICAL CAMERA START STATE (Reset View target on the nav toolbar)
        Na__CameraStartState__CaptureStartState(Na__Camera__Main, Na__Controls__Orbit, Na__Saved__ProjectCameraConfig);

        // RESOLVE + BROADCAST NAVIGATION MODES (reveals Walk/Fly toolbar buttons)
        const Na__EnabledModes__Config = (Na__ProjectData__Full && Na__ProjectData__Full.Navmode__EnabledModes) || null;
        Na__NavigationModes__SetEnabledModes(Na__EnabledModes__Config);
        window.dispatchEvent(new CustomEvent('na-navigation-modes-loaded', {
            detail : { enabledModes: Na__EnabledModes__Config }              // <-- Toolbar + help panel + dev checkboxes listen
        }));

        // BROADCAST PRESENTATION MODE SCENES (reveals Views button + adaptive top toolbar)
        if (Na__ProjectData__Full && Na__PresentationMode__ProjectJson__HasValidSavedScenes(Na__ProjectData__Full)) {
            const Na__SceneConfig = Na__PresentationMode__ProjectJson__GetSavedCameraScenes(Na__ProjectData__Full);
            window.dispatchEvent(new CustomEvent('na-presentation-mode-scenes-loaded', {
                detail : {
                    sceneConfig   : Na__SceneConfig,
                    projectFolder : projectFolder,                           // <-- Folder + year drive R2 thumbnail URL resolution
                    year          : yearCode
                }
            }));
        }

        // BROADCAST THE DRAWINGS BLOCK (floor plans, elevations, Layout Editor sheets)
        // Dispatched unconditionally, and AFTER the scenes above, for two reasons.
        // Unconditionally, because a project with no block still needs the empty
        // skeleton built - the dev panels create the first drawing into it. After
        // the scenes, because the scene config is what the legacy migration reads:
        // before v2.21.0 drawings lived inside PresentationMode__SavedCameraScenes,
        // and a project saved before then still holds them there. The config is
        // passed in the detail rather than looked up, so the migration never
        // depends on which listener ran first.
        {
            const Na__DrawingsBlock = (Na__ProjectData__Full && Na__ProjectData__Full['LayoutEditor__DrawingsData']) || null;
            const Na__SceneConfigForDrawings = (Na__ProjectData__Full && Na__ProjectData__Full['PresentationMode__SavedCameraScenes']) || null;
            window.dispatchEvent(new CustomEvent('na-layouteditor-drawingsdata-loaded', {
                detail : {
                    block       : Na__DrawingsBlock,                         // <-- null on a project that has never saved drawings
                    sceneConfig : Na__SceneConfigForDrawings,                // <-- Migration source for pre-v2.21.0 projects
                    projectCode : projectCode
                }
            }));
        }

        // BROADCAST THE SECTION SCENE BINDINGS (TD06)
        // A separate top-level key, in ValeVision's exact schema, so a project
        // document written by either app is readable by the other. Dispatched
        // after the scenes so a listener can resolve a name immediately, and
        // unconditionally so a project with no bindings still clears any stale
        // in-memory block from a previous project in the same session.
        window.dispatchEvent(new CustomEvent('na-crosssection-scenedata-loaded', {
            detail : {
                block : (Na__ProjectData__Full && Na__ProjectData__Full['CrossSection__SceneData']) || null
            }
        }));

        // LOAD ALL MODELS VIA MULTI-MODEL LOADER
        try {
            let Na__LoadedModelGroups = null;                                 // <-- Map of category -> THREE.Group

            if (modelUrls.length > 0) {
                Na__LoadedModelGroups = await Na__ModelLoader__LoadAllModels(
                    modelUrls,                                               // <-- Array of CDN URLs (orbit cube already filtered out)
                    Na__ModelGroup__Root,                                    // <-- Scene root group
                    Na__Config__Models,                                      // <-- Material configs (baseMesh + linework)
                    Na__LineResolution__Screen,                              // <-- Screen resolution for line width
                    Na__UiFeature__UpdateStatus                              // <-- Status callback for loading overlay
                );
            }

            // APPLY PBR MATERIALS FROM LIBRARY (second pass - selective override)
            // Data is sourced from the DataLib cache loaded at sequence start via Na__DataLib__LoadAll().
            await Na__ApplyLibraryMaterials(Na__LoadedModelGroups);

            Na__UiFeature__ShowScene();                                      // <-- Reveal scene after all models loaded
            window.setTimeout(() => {
                Na__RenderLoop__CanMonitorAoPerformance = true;              // <-- Enable AO monitor only after scene settles
            }, Math.max(0, Na__AoPerformanceMonitorStartupDelayMs));

            // INITIALIZE MODEL-BOUND RUNTIME SYSTEMS
            Na__ReinitializeModelBoundSystems(Na__LoadedModelGroups);
            Na__PhaseLib__SetLive(undefined, Na__LoadedModelGroups);         // <-- The live phase is in: other design phases may load now

            // INITIALIZE MODEL GROUP SELECTOR (switch between design phases)
            if (Na__ProjectData__AllModelGroups && Na__ProjectData__AllModelGroups.length > 1) {
                Na__UiFeature__InitializeModelGroupSelector(
                    Na__ProjectData__AllModelGroups,
                    Na__ModelGroup__Root,
                    Na__Config__Models,
                    Na__LineResolution__Screen,
                    Na__UiFeature__UpdateStatus,
                    Na__ReinitializeModelBoundSystems,
                    Na__ApplyLibraryMaterials                                // <-- A phase switched to gets the library materials too
                );
            }

        } catch (error) {
            console.error('[TrueVision3D] Model load error:', error);
            Na__PhaseLib__SetLive(undefined, null);                          // <-- Nothing may wait for a load that has failed
            Na__UiFeature__UpdateStatus('Model load error - check console', true);
            Na__RenderLoop__CanMonitorAoPerformance = true;                  // <-- Do not keep monitor blocked forever on load errors
        }

        // RENDER LOOP | Invalidation-Based Rendering
        let Na__RenderLoop__PrevTimestamp = performance.now();               // <-- Previous frame timestamp for delta
        let Na__RenderLoop__FrameHandle = null;                              // <-- Active RAF handle (or null when idle)
        const Na__RenderLoop__ActiveReasons = new Set();                     // <-- Reasons that require continuous frames

        // PROGRESSIVE REFINEMENT | Idle-time supersampling of the 3D viewport.
        // @delegate: ../05__RenderPipeline/Na__RenderEffect__ProgressiveRefine__.js
        // ---------------------------------------------------------------
        // Costs nothing while the camera moves: the frames below are exactly
        // the frames this loop drew before it existed. Once the camera has held
        // still for the debounce the loop keeps going instead of idling and
        // redraws the same frame with sub-pixel jitter, averaging, until the
        // viewport holds a full 16-sample image. Anything that changes what the
        // frame should look like resets it.
        // ---------------------------------------------------------------
        const Na__RenderLoop__Refiner = Na__ProgressiveRefine__Create({
            renderer : Na__Renderer__Main,
            config   : Na__Config__ProgressiveRefine
        });
        Na__ProgressiveRefine__SetActive(Na__RenderLoop__Refiner);            // <-- The Visual Effects panel polls it from here
        let Na__RenderLoop__RefineWakeHandle = null;                         // <-- Pending debounce timer (settle wake-up)

        // CONSTANT | How Long to Leave a Stranded Refinement Before Restarting It
        // ---------------------------------------------------------------
        // Comfortably longer than the settle debounce, because this is a safety
        // net and not a schedule: it must never race the ordinary wake-up and
        // steal a burst that was about to carry on by itself.
        // ---------------------------------------------------------------
        const Na__RenderLoop__STRANDED_RECOVERY_MS = 1000;
        // ---------------------------------------------------------------

        // STATE | Watching a Refinement Actually Get Somewhere
        // ---------------------------------------------------------------
        // Comfortably longer than a chunk. The budget is 100ms and a cold first
        // chunk on a heavy model measured 260ms, so a count that has not moved
        // for two and a half seconds is stuck rather than busy.
        // ---------------------------------------------------------------
        const Na__RenderLoop__NO_PROGRESS_MS   = 2500;
        let   Na__RenderLoop__RefineSeenSamples = 0;                         // <-- Sample count at the last look
        let   Na__RenderLoop__RefineSeenAt      = 0;                         // <-- When it was last seen to change (0: not watching)
        // ---------------------------------------------------------------

        // SUB FUNCTION | Cancel a Pending Refinement Wake-Up
        // ---------------------------------------------------------------
        function Na__RenderLoop__CancelRefineWake() {
            if (Na__RenderLoop__RefineWakeHandle === null) return;
            window.clearTimeout(Na__RenderLoop__RefineWakeHandle);
            Na__RenderLoop__RefineWakeHandle = null;
        }
        // ---------------------------------------------------------------

        function Na__RenderLoop__ScheduleFrame() {
            if (Na__RenderLoop__FrameHandle !== null) return;
            Na__RenderLoop__FrameHandle = requestAnimationFrame(Na__RenderLoop__Tick);
        }

        function Na__RenderLoop__RequestRenderOnce() {
            if (document.hidden) return;
            Na__RenderLoop__CancelRefineWake();
            Na__RenderLoop__Refiner.reset();                                  // <-- The scene changed; the running average is stale
            Na__RenderLoop__ScheduleFrame();
        }

        function Na__RenderLoop__EnableActiveRendering(reason = 'general') {
            Na__RenderLoop__ActiveReasons.add(reason);
            Na__RenderLoop__RequestRenderOnce();
        }

        function Na__RenderLoop__DisableActiveRendering(reason = 'general') {
            Na__RenderLoop__ActiveReasons.delete(reason);
            Na__RenderLoop__RequestRenderOnce();
        }

        const NA__ORBIT_TRAILING_FRAMES = 3;                                   // <-- Extra frames after orbit 'end' to let controls.update() settle
        let Na__RenderLoop__OrbitTrailingFrames = 0;

        // SUB FUNCTION | Run the Effect Chain Once Through the Camera's Projection
        // ---------------------------------------------------------------
        // Everything in here reads camera.projectionMatrix, which is exactly
        // why it is one function: a refinement sample nudges that projection
        // and needs every one of these to repeat through the nudged matrix.
        // Jitter only the scene render, as three's own SSAARenderPass does, and
        // the walls smooth out while every profile line stays as stepped as it
        // was. The lines are the drawing.
        // ---------------------------------------------------------------
        function Na__RenderLoop__DrawEffectChain() {
            Na__RenderPipeline__State.updateAoUniforms(Na__Camera__Main);     // <-- Update AO camera matrices
            Na__RenderPipeline__State.renderDepthPrePass();                   // <-- Populate depth texture for fog + AO (no-op when profile lines provide it)
            Na__RenderPipeline__State.renderProfileNormals();                 // <-- Update profile lines
            Na__RenderComposer__Main.render();                                // <-- Render with post-processing
        }
        // ---------------------------------------------------------------

        // SUB FUNCTION | Draw the Section Cut Overlay Onto the Finished Frame
        // ---------------------------------------------------------------
        // Drawn AFTER post-processing so fog, SSAO and the Sobel never touch
        // the cut fills. It goes equally well on top of a composer frame or a
        // presented average - and a refinement present overwrites the whole
        // canvas, so it has to go back on after each one.
        // ---------------------------------------------------------------
        function Na__RenderLoop__DrawSectionOverlay() {
            Na__SectionCut__RenderOverlay(Na__Camera__Main);                  // <-- Section fills sit on top, free of post-processing
        }
        // ---------------------------------------------------------------

        function Na__RenderLoop__RenderFrame(deltaMs) {
            // ENGINE HELD | The third stand-down point, and the one this port was
            // missing. A Layout Editor sheet or an offscreen snapshot has taken
            // a hold, which Na__RenderLoop__Invalidation documents as "the loop
            // keeps running and paints NOTHING". Feeding the hold into sceneBusy
            // further down stopped the REFINEMENT but not the painting, so a
            // sheet that owned the screen was still being drawn over frame by
            // frame. suspend() rather than reset(), because a held engine must
            // ask for no frames of its own until the holder lets go; Resume()
            // requests one the moment the last hold clears.
            if (Na__RenderLoop__IsPaused()) {
                Na__RenderLoop__Refiner.suspend();
                return false;                                                // <-- Idle until Resume() asks for a frame
            }

            // 2D DRAWING MODE | A parallel drawing, not a 3D view. A floor plan
            // looking down or an elevation looking sideways - the loop does not
            // need to know which, only that one of them owns the viewport.
            // Checked FIRST so none of the 3D per-frame work runs: walk/fly
            // physics, orbit updates, door proximity, billboard facing, fog
            // uniforms and distance culling are all meaningless on a drawing,
            // and culling in particular would hide furniture the drawing must
            // show. The composer is bypassed too - fog, SSAO and tone mapping
            // shade a parallel drawing like a surface, which is exactly wrong.
            // A flat render leaves the poche and the linework on their own.
            //
            // THE ONE PASS A DRAWING DOES WANT IS THE EDGE PASS, and bypassing
            // the composer used to throw it out along with the rest. Flat
            // shading is what makes a plan read as a drawing, but it is also
            // what erases every rounded form on it - a curved wall and the
            // floor behind it resolve to the same colour, and the linework GLB
            // has no edge to offer because the silhouette of a curve is a
            // tangent, not a crease. So the Sobel comes back on its own,
            // OUTSIDE the composer: Na__DrawProfile__ takes two orthographic
            // pre-passes and inks that missing outline over the drawing.
            // It goes AFTER the beauty render because it blends onto it, and
            // BEFORE the cut fills so a poche stays solid.
            const Na__Drawing__Camera = Na__DrawView__GetCamera();
            if (Na__Drawing__Camera) {
                Na__RenderLoop__Refiner.suspend();                            // <-- A drawing owns the screen; this pass is the 3D viewport only
                Na__Renderer__Main.render(Na__Scene__Main, Na__Drawing__Camera);
                Na__DrawProfile__RenderOverlay(Na__Drawing__Camera);          // <-- Silhouette edges for rounded geometry
                Na__SectionCut__RenderOverlay(Na__Drawing__Camera);          // <-- Cut fills and profile outlines
                Na__DrawMarkup__SyncFrame();                                 // <-- Reproject the markup onto the new view
                return Na__RenderLoop__ActiveReasons.size > 0;               // <-- Only pan/zoom keeps frames coming
            }

            if (Na__WalkMode__IsActive()) {
                Na__WalkMode__Update(deltaMs);                               // <-- Update walk mode physics and camera
                Na__DoorProximity__Update(Na__WalkMode__GetCapsulePosition()); // <-- Proximity door triggers (walk)
            } else if (Na__FlyMode__IsActive()) {
                Na__FlyMode__Update(deltaMs);                                // <-- Update fly mode camera (no gravity / no collision)
                Na__DoorProximity__Update(Na__FlyMode__GetCameraPosition()); // <-- Proximity door triggers (fly)
            } else {
                Na__Navmode__UpdateNavigation();                              // <-- Update orbit controls only when active
            }

            Na__DoorAnimation__Update(deltaMs);                              // <-- Update door animations
            Na__CameraFollow__Update(Na__Camera__Main);                      // <-- Rotate 2D billboards to face the camera
            Na__Scene__UpdateFogPassUniforms(Na__SceneEffect__FogPass, Na__Camera__Main); // <-- Update fog camera matrices
            Na__DistanceCulling__Update(Na__Camera__Main.position);          // <-- Cull distant furniture/decor before render (camera-move only)

            if (Na__RenderComposer__Main && Na__RenderPipeline__State) {
                // PROGRESSIVE REFINEMENT | What kind of frame is this?
                // ---------------------------------------------------------
                // sceneBusy is everything that changes the picture WITHOUT
                // moving the camera, which the stillness test cannot see. A
                // render hold used to be tested here too; it now stands the
                // refiner down at the top of this function, before any of the
                // per-frame work, so by the time control reaches this line the
                // engine is known not to be held.
                // ---------------------------------------------------------
                const Na__Refine__SceneBusy = Na__DoorAnimation__HasActiveAnimations()
                    || Na__RenderLoop__OrbitTrailingFrames > 0;

                // NO TIMESTAMP IS PASSED, deliberately. The only one this loop
                // has is the animation frame's, which is when the frame BEGAN,
                // and the refiner measures everything else with performance.now().
                // Handing it the frame clock put its settle test on a different
                // clock from its own wake-up scheduler, which is what jammed the
                // refinement part-way. It reads the one clock itself now.
                const Na__Refine__FrameMode = Na__RenderLoop__Refiner.planFrame({
                    camera    : Na__Camera__Main,
                    sceneBusy : Na__Refine__SceneBusy
                });

                let Na__Refine__DidDraw = false;
                if (Na__Refine__FrameMode === Na__Refine__FRAME_PRESENT) {
                    // CONVERGED | Nothing left to draw and the loop cannot idle
                    // (walk and fly hold it open to poll the keyboard). The
                    // finished average is copied back out rather than the frame
                    // skipping: the drawing buffer is not preserved, so a frame
                    // that draws nothing composites an empty one and flashes.
                    Na__Refine__DidDraw = Na__RenderLoop__Refiner.presentAgain(Na__RenderLoop__DrawSectionOverlay);

                } else if (Na__Refine__FrameMode === Na__Refine__FRAME_REFINE) {
                    // AO GETS THE FULL KERNEL HERE, ROTATED PER SAMPLE.
                    // The burst already pays for sixteen SSAO passes - the effect
                    // runs inside drawChain like everything else in the chain - so
                    // the only question is whether those sixteen say anything
                    // different to each other. SSAO's kernel rotation is hashed
                    // from the fullscreen quad's UV, which the jitter does not
                    // move, so without onSample they were sixteen identical
                    // estimates and the noise survived into the parked image.
                    try {
                        Na__Refine__DidDraw = Na__RenderLoop__Refiner.renderChunk({
                            camera      : Na__Camera__Main,
                            composer    : Na__RenderComposer__Main,
                            fxaaPass    : Na__RenderPipeline__State.fxaaPassRef || null,
                            drawChain   : Na__RenderLoop__DrawEffectChain,
                            drawOverlay : Na__RenderLoop__DrawSectionOverlay,
                            onSample    : Na__RenderPipeline__State.setAoRefineSample
                        });
                    } finally {
                        Na__RenderPipeline__State.setAoFullQuality();     // <-- Rotation put back; the exporters borrow this same pass
                    }
                }

                // ORDINARY FRAME | Exactly the frame this loop always drew, and
                // the fallback for a refinement that could not draw - a frame
                // MUST put something on the canvas or the viewport flashes.
                // The AO performance monitor samples here and ONLY here: a
                // refinement chunk is several frames' work in one and would
                // read to it as a catastrophic frame rate.
                if (!Na__Refine__DidDraw) {
                    if (Na__RenderLoop__CanMonitorAoPerformance) {
                        Na__RenderPipeline__State.monitorAoFrame(deltaMs);   // <-- AO performance auto-disable check (post-startup only)
                    }
                    Na__RenderLoop__Refiner.noteNormalFrame(Na__RenderLoop__PrevTimestamp, deltaMs); // <-- Frame rate readout + chunk sizing

                    // AO ON A MOVING FRAME | BORROWED, AND PUT BACK IN THE SAME FRAME.
                    // A reduced kernel is right here and nowhere else: this is the
                    // image nobody studies, and the burst that follows the camera
                    // stopping restores it and then some. The restore is not
                    // optional and not deferrable - the still exporter, the video
                    // exporter and the Layout Editor all borrow this composer
                    // BETWEEN frames and render through it without asking for a
                    // quality, so a budget left lowered here would quietly ship a
                    // half-sampled export. Same borrow-and-return discipline the
                    // refiner uses for FXAA and renderToScreen, for the same reason.
                    Na__RenderPipeline__State.setAoLiveQuality();
                    try {
                        Na__RenderLoop__DrawEffectChain();
                    } finally {
                        Na__RenderPipeline__State.setAoFullQuality();
                    }
                    Na__RenderLoop__DrawSectionOverlay();
                }
            }

            if (Na__RenderLoop__OrbitTrailingFrames > 0) {
                Na__RenderLoop__OrbitTrailingFrames--;
                return true;                                                 // <-- Keep rendering for trailing settle frames
            }

            return Na__WalkMode__IsActive()
                || Na__FlyMode__IsActive()
                || Na__DoorAnimation__HasActiveAnimations()
                || Na__RenderLoop__ActiveReasons.size > 0;
        }

        // SUB FUNCTION | Notice a Refinement That Has Stopped Getting Anywhere
        // ---------------------------------------------------------------
        // The stranded-burst check below only runs when the refiner asks for
        // NOTHING, and the clock-mismatch stall did the opposite: it asked for
        // another frame every time and then refused to use it. A part-finished
        // total that has not grown for this long is wrong whichever way it got
        // there, so this watches the count rather than the answer. Restarting
        // the run is always safe - the worst case is sixteen samples drawn
        // twice - and the warning means a stall of this shape can never be
        // silent again.
        // ---------------------------------------------------------------
        function Na__RenderLoop__WatchRefineProgress() {
            const status = Na__RenderLoop__Refiner.getStatus();

            if (!status.enabled || status.converged || !(status.samplesDone > 0)) {
                Na__RenderLoop__RefineSeenSamples = status.samplesDone;       // <-- Nothing in flight; keep the marker honest
                Na__RenderLoop__RefineSeenAt      = 0;
                return;
            }

            const now = performance.now();

            if (status.samplesDone !== Na__RenderLoop__RefineSeenSamples) {   // <-- It moved; the run is healthy
                Na__RenderLoop__RefineSeenSamples = status.samplesDone;
                Na__RenderLoop__RefineSeenAt      = now;
                return;
            }

            if (Na__RenderLoop__RefineSeenAt === 0) {                         // <-- First sighting at this count
                Na__RenderLoop__RefineSeenAt = now;
                return;
            }

            if ((now - Na__RenderLoop__RefineSeenAt) < Na__RenderLoop__NO_PROGRESS_MS) return;

            // THE ROOT CAUSE IS STILL OPEN, so this says everything needed to
            // close it: how far it got, what the refiner was asking for while
            // it sat there, and whether the loop was being held open by
            // something. A stall that reports itself is a stall that gets fixed.
            const pending = Na__RenderLoop__Refiner.getPendingWork();
            console.warn('[TrueVision3D] Progressive refinement stalled at '
                + status.samplesDone + ' of ' + status.sampleCount + '; restarting the run.',
                { wanted    : pending.wanted,
                  delayMs   : pending.delayMs,
                  fps       : Math.round(status.fps),
                  readBuffer : (Na__RenderComposer__Main && Na__RenderComposer__Main.readBuffer)
                      ? Na__RenderComposer__Main.readBuffer.width + 'x' + Na__RenderComposer__Main.readBuffer.height
                      : null,                                                 // <-- A fractional size here is the buffer-rebuild stall
                  pixelRatio : Na__Renderer__Main.getPixelRatio(),
                  dpr        : window.devicePixelRatio,
                  activeReasons : Array.from(Na__RenderLoop__ActiveReasons),
                  trailing  : Na__RenderLoop__OrbitTrailingFrames,
                  held      : Na__RenderLoop__IsPaused(),
                  hidden    : document.hidden });
            Na__RenderLoop__RefineSeenSamples = 0;
            Na__RenderLoop__RefineSeenAt      = 0;
            Na__RenderLoop__Refiner.reset();                                  // <-- Fresh run; RequestRenderOnce would recurse through here
            Na__RenderLoop__ScheduleFrame();
        }
        // ---------------------------------------------------------------

        // SUB FUNCTION | Arm Whatever Comes After This Frame
        // ---------------------------------------------------------------
        // EVERY tick ends here, on every path, which is the whole point of it
        // being its own function. A burst of refinement only stays alive
        // because the tick that ends a chunk asks for the next one, so a tick
        // that returns early - or throws - abandons the burst with no frame
        // pending and no wake-up armed, and nothing ever comes back for it.
        // That is what left the Visual Effects readout frozen part-way through
        // a run, "6 of 16" for ever on a machine fast enough to fit six samples
        // into the first chunk. Arming is now unconditional.
        // ---------------------------------------------------------------
        function Na__RenderLoop__ArmNextFrame(keepRendering) {
            if (document.hidden) return;                                     // <-- visibilitychange re-arms on the way back

            Na__RenderLoop__WatchRefineProgress();                           // <-- Runs on every path, moving or idle

            if (keepRendering) {
                Na__RenderLoop__ScheduleFrame();                             // <-- Something is still moving
                return;
            }

            // SETTLE | The loop is free to idle. Before it does, ask whether the
            // viewport still owes itself samples. delayMs is what is left of the
            // debounce, so the engine sits genuinely idle through it - a run of
            // small nudges never starts and abandons a burst - and then wakes to
            // draw the next chunk. Once converged this asks for nothing and the
            // loop stops exactly as it always did, with the canvas holding the
            // refined image and the GPU switched off.
            const Na__Refine__Pending = Na__RenderLoop__Refiner.getPendingWork();

            if (Na__Refine__Pending.wanted) {
                if (Na__Refine__Pending.delayMs <= 0) {
                    Na__RenderLoop__ScheduleFrame();                         // <-- Mid-burst: straight back for the next chunk
                    return;
                }
                Na__RenderLoop__RefineWakeHandle = window.setTimeout(() => {
                    Na__RenderLoop__RefineWakeHandle = null;
                    Na__RenderLoop__ScheduleFrame();                         // <-- Debounce served; begin refining
                }, Na__Refine__Pending.delayMs);
                return;
            }

            // STRANDED BURST | Nothing was armed, yet a part-finished total is
            // on the canvas. Every legitimate stand-down - a 2D sheet, an engine
            // hold, the tab going away, a camera nudge - throws the total away
            // as it stands down, so a count between one and fifteen with nothing
            // scheduled is a state the refiner should never be able to reach.
            // It costs one wake-up to make it recoverable instead of permanent,
            // and because a resting app always reads zero or converged, this can
            // never turn into a loop that wakes itself for ever.
            const Na__Refine__Status = Na__RenderLoop__Refiner.getStatus();
            if (!Na__Refine__Status.enabled) return;
            if (Na__Refine__Status.converged) return;
            if (!(Na__Refine__Status.samplesDone > 0)) return;

            Na__RenderLoop__RefineWakeHandle = window.setTimeout(() => {
                Na__RenderLoop__RefineWakeHandle = null;
                Na__RenderLoop__RequestRenderOnce();                          // <-- Start the run again rather than leave it half done
            }, Na__RenderLoop__STRANDED_RECOVERY_MS);
        }
        // ---------------------------------------------------------------

        function Na__RenderLoop__Tick(timestamp) {
            Na__RenderLoop__FrameHandle = null;
            Na__RenderLoop__CancelRefineWake();                              // <-- A frame is running; any pending wake-up is spent

            const now     = timestamp || performance.now();                  // <-- Current timestamp
            const deltaMs = now - Na__RenderLoop__PrevTimestamp;             // <-- Time since last frame
            Na__RenderLoop__PrevTimestamp = now;                             // <-- Update previous timestamp

            // A THROWN FRAME MUST NOT STOP THE LOOP. Without this, one bad frame
            // - a pass with no buffer, a model swapped mid-render - takes the
            // whole render loop with it: the tick unwinds before it can ask for
            // another, and the viewport freezes until something else happens to
            // request a redraw. The error is still reported, once per frame.
            let keepRendering = false;
            try {
                keepRendering = Na__RenderLoop__RenderFrame(deltaMs);
            } catch (error) {
                console.error('[TrueVision3D] Render frame failed; the loop carries on:', error);
            } finally {
                Na__RenderLoop__ArmNextFrame(keepRendering);
            }
        }

        window.addEventListener(NA__REQUEST_RENDER_EVENT, Na__RenderLoop__RequestRenderOnce);
        window.addEventListener(NA__REQUEST_ACTIVE_RENDER_EVENT, (event) => {
            Na__RenderLoop__EnableActiveRendering(event.detail && event.detail.reason ? event.detail.reason : 'general');
        });
        window.addEventListener(NA__STOP_ACTIVE_RENDER_EVENT, (event) => {
            Na__RenderLoop__DisableActiveRendering(event.detail && event.detail.reason ? event.detail.reason : 'general');
        });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                Na__RenderLoop__CancelRefineWake();
                Na__RenderLoop__Refiner.suspend();                            // <-- No wake-up timer firing into a backgrounded tab
                return;
            }
            Na__RenderLoop__RequestRenderOnce();
        });

        Na__Controls__Orbit.addEventListener('start', () => {
            Na__RenderLoop__OrbitTrailingFrames = 0;                          // <-- Cancel any pending trail; user is actively interacting
            Na__RenderLoop__EnableActiveRendering('orbit');
        });
        Na__Controls__Orbit.addEventListener('end', () => {
            Na__RenderLoop__DisableActiveRendering('orbit');
            Na__RenderLoop__OrbitTrailingFrames = NA__ORBIT_TRAILING_FRAMES;  // <-- Render a few more frames to let controls.update() settle
            Na__RenderLoop__RequestRenderOnce();
        });
        Na__Controls__Orbit.addEventListener('change', Na__RenderLoop__RequestRenderOnce);

        Na__RenderLoop__RequestRenderOnce();

        // RESIZE HANDLER
        window.addEventListener('resize', () => {
            const width  = window.innerWidth;
            const height = window.innerHeight;

            Na__Camera__Main.aspect = width / height;
            Na__Camera__Main.updateProjectionMatrix();
            Na__Renderer__Main.setSize(width, height);
            if (Na__RenderComposer__Main && Na__RenderPipeline__State) {
                Na__RenderComposer__Main.setSize(width, height);
                Na__RenderPipeline__State.setDepthPrePassSize(width, height); // <-- Resize depth pre-pass RT
                Na__RenderPipeline__State.setProfileLinesSize(width, height);
                Na__RenderPipeline__State.setAoSize(width, height);          // <-- Update AO resolution uniform
                Na__RenderPipeline__State.setFxaaSize(width, height);        // <-- Update FXAA resolution uniform
            }

            Na__LineResolution__Screen.set(width, height);
            Na__SectionCut__HandleResize(width, height);                     // <-- Fat-line resolution for the cut profiles
            Na__DrawProfile__HandleResize(width, height);                    // <-- Sobel step is in buffer pixels, so it follows the viewport
            // Both 2D cameras keep their own aspect, so both are told - each
            // reprojects its markup only if it is the one on screen.
            Na__FloorPlanMode__HandleResize(width, height);                  // <-- Ortho frustum aspect + markup reprojection
            Na__ElevationMode__HandleResize(width, height);
            Na__RenderLoop__RequestRenderOnce();
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | App Flow API
    // ------------------------------------------------------------
    export {
        Na__AppFlow__StartLoadingSequence
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

