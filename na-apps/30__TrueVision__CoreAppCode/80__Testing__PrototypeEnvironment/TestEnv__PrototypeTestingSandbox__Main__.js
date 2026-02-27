// =============================================================================
// TRUEVISION3D - TEST ENVIRONMENT MAIN ENGINE BOOTSTRAP
// =============================================================================
//
// FILE       : TestEnv__PrototypeTestingSandbox__Main__.js
// NAMESPACE  : TrueVision3D
// MODULE     : Test Environment Main Bootstrap
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Engine bootstrap for the prototype testing sandbox
// CREATED    : 14-Feb-2026
//
// DESCRIPTION:
// - Initializes the Three.js scene, camera, renderer, and controls.
// - Reuses all engine modules from the parent TrueVision3D project.
// - Loads GLB files from the local TestEnv__GlbFiles folder.
// - Provides a live statistics debug overlay (FPS, meshes, vertices).
// - Implements a full node graph explorer with per-node visibility toggling.
// - Runs as a self-contained sandbox for rapid feature prototyping.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Three.js Core Imports
    // ------------------------------------------------------------
    import * as THREE from 'three';
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
    // ------------------------------------------------------------


    // MODULE VARIABLES | TrueVision3D Engine Imports (from parent project)
    // ------------------------------------------------------------
    import { Na__DefaultNavmode__InitializeMouseControls } from '../02__Src__AppModules/10__NavigationAndCameras/Na__DefaultNavmode__MouseControls.js';
    import { Na__DefaultNavmode__InitializeIpadControls } from '../02__Src__AppModules/10__NavigationAndCameras/Na__DefaultNavmode__IpadControls.js';
    import { Na__RenderPipeline__SetupComposer } from '../02__Src__AppModules/05__RenderPipeline/Na__RenderPipeline__PostProcessing__Setup.js';
    import { Na__Scene__SetupDefaultSceneLighting } from '../02__Src__AppModules/06__Scene__LightingEffects/Na__Scene__DefaultSceneLighting.js';
    import { Na__Math__ConvertMmToUnits } from '../02__Src__AppModules/04__MathUtils/Na__Math__Units.js';
    // ------------------------------------------------------------


    // MODULE VARIABLES | Feature Imports from Main TrueVision3D App
    // ------------------------------------------------------------
    import {
        Na__DoorAnimation__Initialize,
        Na__DoorAnimation__Update
    } from '../02__Src__AppModules/25__System__3dObject__InteractionSystem/3dObjectIInteraction__Animation__ClickToOpenDoors__.js';
    import { Na__DoorAnimation__FindDoorGroups } from '../02__Src__AppModules/25__System__3dObject__InteractionSystem/Na__DoorAnimation__FindDoorGroups.js';
    
    import { Na__UiFeature__InitializeStoreyViewControls } from '../02__Src__AppModules/26__System__ToggleModelElements/Na__UiFeature__StoreyView__Controls.js';
    // ------------------------------------------------------------


    // MODULE VARIABLES | Walk Mode Imports from Main TrueVision3D App
    // ------------------------------------------------------------
    import {
        Na__WalkMode__SetCollisionMeshes,
        Na__WalkMode__Update,
        Na__WalkMode__IsActive,
        Na__WalkMode__GetCapsulePosition
    } from '../02__Src__AppModules/10__NavigationAndCameras/Na__Navmode__WalkMode__SystemLogic.js';
    import { Na__DoorProximity__Update } from '../02__Src__AppModules/25__System__3dObject__InteractionSystem/3dObjectInteraction__Animation__WalkMode__ProximityToOpenDoors__.js';
    import { Na__UiFeature__InitializeWalkModeSystem, Na__UiFeature__ToggleWalkMode } from '../02__Src__AppModules/10__NavigationAndCameras/Na__UiFeature__WalkModeControls.js';
    import { Na__UiFeature__InitializeWalkModeHotkey, Na__UiFeature__InitializeWalkModeToggleButton } from '../02__Src__AppModules/10__NavigationAndCameras/Na__UiFeature__WalkModeEventListeners.js';
    // ------------------------------------------------------------


    // MODULE VARIABLES | Materials System Imports (from parent project)
    // ------------------------------------------------------------
    import { Na__MaterialsSystem__LoadLibrary, Na__MaterialsSystem__BuildLookup } from '../02__Src__AppModules/20__System__MaterialsSystem/Na__MaterialsSystem__LibraryLoader.js';
    import { Na__MaterialsSystem__ApplyMaterials } from '../02__Src__AppModules/20__System__MaterialsSystem/Na__MaterialsSystem__MaterialSwap.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Configuration Loading
// -----------------------------------------------------------------------------

    // FUNCTION | Load Test Environment Config
    // ------------------------------------------------------------
    async function TestEnv__LoadConfig() {
        const response = await fetch('./TestEnv__SubAppData__Config.json');   // <-- Fetch local test config

        if (!response.ok) {
            throw new Error(`TestEnv config load failed: ${response.status} ${response.statusText}`);
        }

        return response.json();                                              // <-- Return parsed config
    }
    // ------------------------------------------------------------


    // MODULE VARIABLES | App Config (JSON Source of Truth)
    // ------------------------------------------------------------
    const TestEnv__Config = await TestEnv__LoadConfig();                      // <-- Load test environment config

    const TestEnv__Config__CameraConfig     = TestEnv__Config.Scene__Default__CameraConfig;      // <-- Camera settings
    const TestEnv__Config__LightingConfig   = TestEnv__Config.Scene__Default__LightingConfig;    // <-- Lighting settings
    const TestEnv__Config__FogConfig        = TestEnv__Config.Scene__Default__FogConfig;          // <-- Fog settings
    const TestEnv__Config__ControlsConfig   = TestEnv__Config.Scene__Default__ControlsConfig;    // <-- Controls settings
    const TestEnv__Config__GroundPlane      = TestEnv__Config.Scene__GroundPlane;                // <-- Ground plane settings
    const TestEnv__Config__Models           = TestEnv__Config.models;                            // <-- Model-specific settings
    const TestEnv__Config__NavmodeSettings = TestEnv__Config.Navmode__Settings;                  // <-- Navmode config (MM)
    const TestEnv__Config__NavmodeDamping  = TestEnv__Config.Navmode__Damping || {};            // <-- Navmode damping config (unitless)
    const TestEnv__Config__ProfileLines    = TestEnv__Config.RenderEffect__ProfileLines || null; // <-- Profile lines config
    const TestEnv__Config__DevMode         = TestEnv__Config.Dev__DeveloperMode || {};            // <-- Dev mode config
    const TestEnv__Config__TestEnv         = TestEnv__Config.testEnvironment || {};               // <-- Test environment flags
    const TestEnv__Config__WalkMode        = (TestEnv__Config__NavmodeSettings && TestEnv__Config__NavmodeSettings.Navmode__WalkMode)
        ? TestEnv__Config__NavmodeSettings.Navmode__WalkMode
        : {};                                                                                    // <-- Walk mode config (MM)
    const TestEnv__Config__GlobalHotkeys   = TestEnv__Config.Global__Hotkeys || {};              // <-- Global hotkeys config
    const TestEnv__Config__DefaultView     = TestEnv__Config.TestEnv__DefaultView || null;       // <-- Saved default camera view (null if never saved)
    const TestEnv__Config__MaterialsSystem = TestEnv__Config.MaterialsSystem__Config || {};      // <-- Materials system config
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | DOM References
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | DOM Element References
    // ------------------------------------------------------------
    const canvas                = document.getElementById('renderCanvas');                   // <-- Render canvas
    const loadingOverlay        = document.getElementById('loadingOverlay');                 // <-- Loading overlay
    const loadingIndicator      = document.getElementById('loadingIndicator');               // <-- Loading indicator
    const statusText            = document.getElementById('statusText');                     // <-- Debug status text
    const statsFpsEl            = document.getElementById('testEnvStatsFps');                // <-- Stats: FPS
    const statsMeshesEl         = document.getElementById('testEnvStatsMeshes');             // <-- Stats: Mesh count
    const statsVerticesEl       = document.getElementById('testEnvStatsVertices');           // <-- Stats: Vertex count
    const statsGlbCountEl       = document.getElementById('testEnvStatsGlbCount');           // <-- Stats: GLB file count
    const nodeTreeEl            = document.getElementById('testEnvNodeTree');                // <-- Node tree container
    const nodeExplorerInfoEl    = document.getElementById('testEnvNodeExplorerInfo');        // <-- Node explorer info text
    const nodeExplorerEl        = document.getElementById('testEnvNodeExplorer');            // <-- Node explorer panel
    const nodeExplorerToggleEl  = document.getElementById('testEnvNodeExplorerToggle');      // <-- Panel toggle button
    const nodeExplorerArrowEl   = document.getElementById('testEnvNodeExplorerArrow');       // <-- Toggle arrow icon
    const nodeResizeHandleEl    = document.getElementById('testEnvResizeHandle');            // <-- Panel resize drag handle
    const expandAllBtn          = document.getElementById('testEnvExpandAll');               // <-- Expand all button
    const collapseAllBtn        = document.getElementById('testEnvCollapseAll');             // <-- Collapse all button
    const showAllBtn            = document.getElementById('testEnvShowAll');                 // <-- Show all button
    const hideAllBtn            = document.getElementById('testEnvHideAll');                 // <-- Hide all button
    const copyTreeBtn           = document.getElementById('testEnvCopyTree');                // <-- Copy tree button
    const refreshModelsBtn      = document.getElementById('testEnvRefreshModels');           // <-- Refresh models button
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Dev Mode - Default Cube Configuration
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Dev Cube Settings (MM)
    // ------------------------------------------------------------
    const TestEnv__DevCube__Config  = TestEnv__Config__DevMode.Dev__DefaultCube || {};

    const TestEnv__DevCube__Visible = (TestEnv__DevCube__Config.Dev__DefaultCube__Visible !== undefined)
        ? Boolean(TestEnv__DevCube__Config.Dev__DefaultCube__Visible)
        : true;                                                              // <-- Visible by default in test env
    const TestEnv__DevCube__SizeMm  = Number.isFinite(TestEnv__DevCube__Config.Dev__DefaultCube__SizeInMm)
        ? TestEnv__DevCube__Config.Dev__DefaultCube__SizeInMm
        : 1000;
    const TestEnv__DevCube__Colour  = TestEnv__DevCube__Config.Dev__DefaultCube__Colour || '#1e3a4f';

    const TestEnv__DevCube__PozX    = Number.isFinite(TestEnv__DevCube__Config.Dev__DefaultCube__PozX)
        ? TestEnv__DevCube__Config.Dev__DefaultCube__PozX : 0;
    const TestEnv__DevCube__PozY    = Number.isFinite(TestEnv__DevCube__Config.Dev__DefaultCube__PozY)
        ? TestEnv__DevCube__Config.Dev__DefaultCube__PozY : 500;
    const TestEnv__DevCube__PozZ    = Number.isFinite(TestEnv__DevCube__Config.Dev__DefaultCube__PozZ)
        ? TestEnv__DevCube__Config.Dev__DefaultCube__PozZ : 0;

    const TestEnv__DevCube__SizeUnits    = Na__Math__ConvertMmToUnits(TestEnv__DevCube__SizeMm);
    const TestEnv__DevCube__PositionUnits = new THREE.Vector3(
        Na__Math__ConvertMmToUnits(TestEnv__DevCube__PozX),
        Na__Math__ConvertMmToUnits(TestEnv__DevCube__PozY),
        Na__Math__ConvertMmToUnits(TestEnv__DevCube__PozZ)
    );
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Device Detection
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Device Detection (Mouse vs Touch)
    // ------------------------------------------------------------
    const TestEnv__Device__HasTouch        = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const TestEnv__Device__IsIpadOS        = navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1;
    const TestEnv__Device__IsMobile        = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || TestEnv__Device__IsIpadOS;
    const TestEnv__Device__UseTouchControls = TestEnv__Device__IsMobile || TestEnv__Device__HasTouch;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Scene, Camera, Renderer Setup
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Three.js Core Objects
    // ------------------------------------------------------------
    const TestEnv__Scene = new THREE.Scene();
    TestEnv__Scene.background = new THREE.Color(TestEnv__Config__FogConfig.Scene__Default__FogConfig__Color);
    TestEnv__Scene.fog = new THREE.FogExp2(TestEnv__Config__FogConfig.Scene__Default__FogConfig__Color, TestEnv__Config__FogConfig.Scene__Default__FogConfig__Density);

    const TestEnv__Camera = new THREE.PerspectiveCamera(
        TestEnv__Config__CameraConfig.Scene__Default__CameraConfig__Fov,     // <-- Field of view
        window.innerWidth / window.innerHeight,                              // <-- Aspect ratio
        TestEnv__Config__CameraConfig.Scene__Default__CameraConfig__Near,    // <-- Near clipping plane
        TestEnv__Config__CameraConfig.Scene__Default__CameraConfig__Far      // <-- Far clipping plane
    );

    // Position camera offset from dev cube for initial view
    TestEnv__Camera.position.set(
        TestEnv__DevCube__PositionUnits.x + (TestEnv__DevCube__SizeUnits * 3),  // <-- Offset X
        TestEnv__DevCube__PositionUnits.y + (TestEnv__DevCube__SizeUnits * 2),  // <-- Offset Y
        TestEnv__DevCube__PositionUnits.z + (TestEnv__DevCube__SizeUnits * 3)   // <-- Offset Z
    );

    const TestEnv__Renderer = new THREE.WebGLRenderer({
        canvas: canvas,                                                      // <-- Bind to canvas element
        antialias: true,                                                     // <-- Enable anti-aliasing
        alpha: true,                                                         // <-- Allow transparency
        powerPreference: "high-performance",                                 // <-- Request high-perf GPU
        stencil: true,                                                       // <-- Enable stencil buffer
        depth: true,                                                         // <-- Enable depth buffer
        logarithmicDepthBuffer: true                                         // <-- Logarithmic depth for large scenes
    });
    TestEnv__Renderer.setSize(window.innerWidth, window.innerHeight);
    TestEnv__Renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    TestEnv__Renderer.shadowMap.enabled = true;
    TestEnv__Renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    TestEnv__Renderer.outputColorSpace = THREE.SRGBColorSpace;
    TestEnv__Renderer.toneMapping = THREE.NoToneMapping;
    TestEnv__Renderer.toneMappingExposure = 1.0;

    const TestEnv__LineResolution = new THREE.Vector2(window.innerWidth, window.innerHeight);
    let TestEnv__RenderComposer = null;                                      // <-- EffectComposer reference
    let TestEnv__RenderPipelineState = null;                                 // <-- Composer + profile-lines bundle
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Navigation Controls Setup
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Navigation Controls Configuration
    // ------------------------------------------------------------
    const TestEnv__NavConfig__Mouse = (TestEnv__Config__NavmodeSettings && TestEnv__Config__NavmodeSettings.Navmode__MouseControls)
        ? TestEnv__Config__NavmodeSettings.Navmode__MouseControls : {};
    const TestEnv__NavConfig__Ipad  = (TestEnv__Config__NavmodeSettings && TestEnv__Config__NavmodeSettings.Navmode__IpadControls)
        ? TestEnv__Config__NavmodeSettings.Navmode__IpadControls : {};
    const TestEnv__NavDamping__Mouse = (TestEnv__Config__NavmodeDamping && TestEnv__Config__NavmodeDamping.Navmode__Damping__Mouse)
        ? TestEnv__Config__NavmodeDamping.Navmode__Damping__Mouse : {};
    const TestEnv__NavDamping__Ipad  = (TestEnv__Config__NavmodeDamping && TestEnv__Config__NavmodeDamping.Navmode__Damping__Ipad)
        ? TestEnv__Config__NavmodeDamping.Navmode__Damping__Ipad : {};

    const TestEnv__Navmode__InitFn = TestEnv__Device__UseTouchControls
        ? Na__DefaultNavmode__InitializeIpadControls
        : Na__DefaultNavmode__InitializeMouseControls;

    const TestEnv__NavConfig__Active = TestEnv__Device__UseTouchControls
        ? TestEnv__NavConfig__Ipad
        : TestEnv__NavConfig__Mouse;

    const TestEnv__NavConfig__Payload = TestEnv__Device__UseTouchControls
        ? {
            damping          : {
                enabled : TestEnv__NavDamping__Ipad.Navmode__Damping__Ipad__Enabled,
                factor  : TestEnv__NavDamping__Ipad.Navmode__Damping__Ipad__Factor
            },
            enableWASD       : TestEnv__NavConfig__Active.Navmode__IpadControls__EnableWASD,
            movementSpeedMm  : TestEnv__NavConfig__Active.Navmode__IpadControls__MovementSpeedMm,
            elevationSpeedMm : TestEnv__NavConfig__Active.Navmode__IpadControls__ElevationSpeedMm,
            minDistanceMm    : TestEnv__NavConfig__Active.Navmode__IpadControls__OrbitMinDistanceMm,
            maxDistanceMm    : TestEnv__NavConfig__Active.Navmode__IpadControls__OrbitMaxDistanceMm
        }
        : {
            damping          : {
                enabled : TestEnv__NavDamping__Mouse.Navmode__Damping__Mouse__Enabled,
                factor  : TestEnv__NavDamping__Mouse.Navmode__Damping__Mouse__Factor
            },
            enableWASD       : TestEnv__NavConfig__Active.Navmode__MouseControls__EnableWASD,
            movementSpeedMm  : TestEnv__NavConfig__Active.Navmode__MouseControls__MovementSpeedMm,
            elevationSpeedMm : TestEnv__NavConfig__Active.Navmode__MouseControls__ElevationSpeedMm,
            minDistanceMm    : TestEnv__NavConfig__Active.Navmode__MouseControls__OrbitMinDistanceMm,
            maxDistanceMm    : TestEnv__NavConfig__Active.Navmode__MouseControls__OrbitMaxDistanceMm,
            zoomStepMm       : TestEnv__NavConfig__Active.Navmode__MouseControls__ZoomStepMm
        };

    const TestEnv__NavBundle = TestEnv__Navmode__InitFn(TestEnv__Camera, TestEnv__Renderer.domElement, {
        ...TestEnv__NavConfig__Payload
    });
    const TestEnv__Controls = TestEnv__NavBundle.controls;                   // <-- OrbitControls instance
    const TestEnv__UpdateNav = TestEnv__NavBundle.updateNavigation;          // <-- Per-frame update function
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Default Dev Cube
// -----------------------------------------------------------------------------

    // FUNCTION | Create Default Dev Cube
    // ------------------------------------------------------------
    function TestEnv__CreateDevCube() {
        const geometry = new THREE.BoxGeometry(
            TestEnv__DevCube__SizeUnits,
            TestEnv__DevCube__SizeUnits,
            TestEnv__DevCube__SizeUnits
        );
        const material = new THREE.MeshStandardMaterial({ color: TestEnv__DevCube__Colour });
        const cube = new THREE.Mesh(geometry, material);

        cube.name = 'Dev__DefaultCube';
        cube.position.copy(TestEnv__DevCube__PositionUnits);
        cube.visible = TestEnv__DevCube__Visible;

        TestEnv__Scene.add(cube);
        return cube;
    }

    const TestEnv__DevCube__Mesh = TestEnv__CreateDevCube();
    const TestEnv__Camera__InitialForwardVector = new THREE.Vector3();
    TestEnv__Camera.getWorldDirection(TestEnv__Camera__InitialForwardVector);
    const TestEnv__Camera__InitialTarget = TestEnv__Camera.position.clone().add(
        TestEnv__Camera__InitialForwardVector.multiplyScalar(10)
    );
    TestEnv__Controls.target.copy(TestEnv__Camera__InitialTarget);            // <-- Initial fallback uses camera forward direction (not dev cube)
    TestEnv__Controls.update();
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Walk Mode System Initialization
// -----------------------------------------------------------------------------

    // MODULE INITIALIZATION | Walk Mode System
    // ------------------------------------------------------------
    // @delegate: ../02__Src__AppModules/10__NavigationAndCameras/Na__UiFeature__WalkModeControls.js
    Na__UiFeature__InitializeWalkModeSystem(TestEnv__Scene, TestEnv__Camera, TestEnv__Renderer, TestEnv__Controls, TestEnv__Config__WalkMode, TestEnv__Device__UseTouchControls);

    // WALK MODE TOGGLE | With Test Environment UI Callbacks
    // ------------------------------------------------------------
    const TestEnv__WalkModeToggleFn = () => {
        const walkModeIndicatorEl = document.getElementById('testEnvWalkModeStatus');
        const saveViewBtn         = document.getElementById('testEnvSaveViewBtn');
        Na__UiFeature__ToggleWalkMode(
            () => {                                                           // <-- onActivate callback
                if (walkModeIndicatorEl) walkModeIndicatorEl.textContent = 'Walk Mode';
                if (saveViewBtn) { saveViewBtn.disabled = true; saveViewBtn.title = 'Exit walk mode before saving view'; }
            },
            () => {                                                           // <-- onDeactivate callback
                if (walkModeIndicatorEl) walkModeIndicatorEl.textContent = 'Orbit Mode';
                if (saveViewBtn) { saveViewBtn.disabled = false; saveViewBtn.title = 'Save current camera position as default view on refresh'; }
            }
        );
    };
    // ------------------------------------------------------------

    // @delegate: ../02__Src__AppModules/10__NavigationAndCameras/Na__UiFeature__WalkModeEventListeners.js
    Na__UiFeature__InitializeWalkModeHotkey(TestEnv__WalkModeToggleFn);
    Na__UiFeature__InitializeWalkModeToggleButton('testEnvWalkModeToggle', TestEnv__WalkModeToggleFn);

    // MODULE INITIALIZATION | Save Default View Button
    // ------------------------------------------------------------
    const TestEnv__SaveViewBtn = document.getElementById('testEnvSaveViewBtn');
    if (TestEnv__SaveViewBtn) {
        TestEnv__SaveViewBtn.addEventListener('click', TestEnv__SaveDefaultView);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helper Functions
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Update Status Display
    // ------------------------------------------------------------
    function TestEnv__UpdateStatus(message, isError = false) {
        if (statusText) statusText.textContent = message;
        if (!loadingIndicator) return;
        loadingIndicator.textContent = message;

        if (isError) {
            loadingIndicator.style.color = '#d32f2f';                        // <-- Error color
        }
    }
    // ------------------------------------------------------------

    // HELPER FUNCTION | Resolve Orbit Helper Cube Center from Loaded Models
    // ------------------------------------------------------------
    function TestEnv__ResolveOrbitHelperCubeCenter() {
        let helperRoot = null;

        for (const child of TestEnv__ModelGroup__Root.children) {
            if (typeof child.name === 'string' && child.name.includes('OrbitHelperCube__MeshModel__')) {
                helperRoot = child;
                break;
            }
        }

        if (!helperRoot) {
            console.warn('[TestEnv] OrbitHelperCube not found in loaded GLB model roots.');
            return null;
        }

        const helperBox = new THREE.Box3().setFromObject(helperRoot);
        if (helperBox.isEmpty()) {
            console.warn('[TestEnv] OrbitHelperCube found but bounding box is empty.');
            return null;
        }

        const helperCenter = helperBox.getCenter(new THREE.Vector3());
        console.log('[TestEnv] OrbitHelperCube center resolved:', helperCenter);
        return {
            root   : helperRoot,
            center : helperCenter
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show Scene When Ready
    // ------------------------------------------------------------
    function TestEnv__ShowScene() {
        if (statusText) statusText.textContent = 'Complete - Test Environment Ready';

        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
            setTimeout(() => { loadingOverlay.style.display = 'none'; }, 500);
        }

        if (canvas) {
            canvas.classList.remove('canvas-hidden');
            canvas.classList.add('canvas-visible');
        }

        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Apply Saved Default View to Camera and Orbit Controls
    // ------------------------------------------------------------
    function TestEnv__DefaultView__Apply(savedView) {
        if (!savedView) return;

        const posX = Na__Math__ConvertMmToUnits(savedView.TestEnv__DefaultView__Camera__PosXMm || 0);
        const posY = Na__Math__ConvertMmToUnits(savedView.TestEnv__DefaultView__Camera__PosYMm || 0);
        const posZ = Na__Math__ConvertMmToUnits(savedView.TestEnv__DefaultView__Camera__PosZMm || 0);

        const rotX = savedView.TestEnv__DefaultView__Camera__RotX || 0;
        const rotY = savedView.TestEnv__DefaultView__Camera__RotY || 0;
        const rotZ = savedView.TestEnv__DefaultView__Camera__RotZ || 0;

        const fov  = savedView.TestEnv__DefaultView__Camera__Fov;

        const targetX = Na__Math__ConvertMmToUnits(savedView.TestEnv__DefaultView__OrbitTarget__XMm || 0);
        const targetY = Na__Math__ConvertMmToUnits(savedView.TestEnv__DefaultView__OrbitTarget__YMm || 0);
        const targetZ = Na__Math__ConvertMmToUnits(savedView.TestEnv__DefaultView__OrbitTarget__ZMm || 0);

        TestEnv__Camera.position.set(posX, posY, posZ);                      // <-- Restore camera position
        TestEnv__Camera.rotation.set(rotX, rotY, rotZ);                      // <-- Restore camera rotation

        if (Number.isFinite(fov) && fov > 0) {
            TestEnv__Camera.fov = fov;                                        // <-- Restore camera FOV
            TestEnv__Camera.updateProjectionMatrix();
        }

        TestEnv__Controls.target.set(targetX, targetY, targetZ);             // <-- Restore orbit target
        TestEnv__Controls.update();

        console.log('[TestEnv] Default view restored from saved config');
    }
    // ------------------------------------------------------------


    // FUNCTION | Save Current Camera View as Default to Config on Disk
    // ------------------------------------------------------------
    async function TestEnv__SaveDefaultView() {
        const saveBtn = document.getElementById('testEnvSaveViewBtn');

        if (Na__WalkMode__IsActive()) {                                       // <-- Block save during walk mode
            if (saveBtn) {
                saveBtn.textContent = 'Exit Walk Mode first';
                setTimeout(() => { saveBtn.textContent = 'Save View'; }, 2000);
            }
            console.warn('[TestEnv] Save View blocked: must be in orbit mode');
            return;
        }

        const posUnits    = TestEnv__Camera.position;
        const rotation    = TestEnv__Camera.rotation;
        const orbitTarget = TestEnv__Controls.target;

        const payload = {
            TestEnv__DefaultView__Description          : 'Saved default camera view. Populated by Save View button in test environment. All distances are millimeters.',
            TestEnv__DefaultView__Camera__PosXMm       : Math.round(posUnits.x * 1000),    // <-- Convert units back to mm
            TestEnv__DefaultView__Camera__PosYMm       : Math.round(posUnits.y * 1000),
            TestEnv__DefaultView__Camera__PosZMm       : Math.round(posUnits.z * 1000),
            TestEnv__DefaultView__Camera__RotX         : parseFloat(rotation.x.toFixed(6)),
            TestEnv__DefaultView__Camera__RotY         : parseFloat(rotation.y.toFixed(6)),
            TestEnv__DefaultView__Camera__RotZ         : parseFloat(rotation.z.toFixed(6)),
            TestEnv__DefaultView__Camera__Fov          : parseFloat(TestEnv__Camera.fov.toFixed(4)),
            TestEnv__DefaultView__OrbitTarget__XMm     : Math.round(orbitTarget.x * 1000),  // <-- Orbit target in mm
            TestEnv__DefaultView__OrbitTarget__YMm     : Math.round(orbitTarget.y * 1000),
            TestEnv__DefaultView__OrbitTarget__ZMm     : Math.round(orbitTarget.z * 1000)
        };

        if (saveBtn) {
            saveBtn.textContent = 'Saving...';
            saveBtn.disabled = true;
        }

        try {
            const response = await fetch('/api/save-default-view', {
                method  : 'POST',
                headers : { 'Content-Type': 'application/json' },
                body    : JSON.stringify(payload)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                if (saveBtn) saveBtn.textContent = 'Saved!';
                console.log('[TestEnv] Default view saved to config');
                setTimeout(() => {
                    if (saveBtn) saveBtn.textContent = 'Save View';
                }, 2000);
            } else {
                if (saveBtn) saveBtn.textContent = 'Save Failed';
                console.error('[TestEnv] Save default view failed:', result.error);
                setTimeout(() => {
                    if (saveBtn) saveBtn.textContent = 'Save View';
                }, 2500);
            }

        } catch (error) {
            if (saveBtn) saveBtn.textContent = 'Save Failed';
            console.error('[TestEnv] Save default view error:', error);
            setTimeout(() => {
                if (saveBtn) saveBtn.textContent = 'Save View';
            }, 2500);
        } finally {
            if (saveBtn) saveBtn.disabled = false;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Find All Door Model Groups
    // @delegate: ../02__Src__AppModules/25__System__3dObject__InteractionSystem/Na__DoorAnimation__FindDoorGroups.js
    // ------------------------------------------------------------
    function TestEnv__FindAllDoorModels() {
        const { meshGroups: doorMeshGroups, lineworkGroups: doorLineworkGroups } = Na__DoorAnimation__FindDoorGroups(TestEnv__ModelGroup__Root);
        doorMeshGroups.forEach(g     => console.log(`[TestEnv] Found door mesh model: ${g.name}`));
        doorLineworkGroups.forEach(g => console.log(`[TestEnv] Found door linework model: ${g.name}`));
        return { doorMeshGroups, doorLineworkGroups };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Lighting and Ground
// -----------------------------------------------------------------------------

    // FUNCTION | Setup Scene Lighting and Ground Plane
    // @delegate: ../02__Src__AppModules/06__Scene__LightingEffects/Na__Scene__DefaultSceneLighting.js
    // ------------------------------------------------------------
    function TestEnv__SetupLighting() {
        Na__Scene__SetupDefaultSceneLighting(TestEnv__Scene, TestEnv__Config__LightingConfig, TestEnv__Config__GroundPlane);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | GLB Model Loading (Local Files)
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | GLB Model State
    // ------------------------------------------------------------
    const TestEnv__ModelGroup__Root = new THREE.Group();                      // <-- Root group for all loaded models
    TestEnv__ModelGroup__Root.name = 'TestEnv__LoadedModels';
    TestEnv__Scene.add(TestEnv__ModelGroup__Root);

    let TestEnv__LoadedGlbCount = 0;                                         // <-- Count of loaded GLB files
    // ------------------------------------------------------------


    // FUNCTION | Fetch Available GLB Files from Server
    // ------------------------------------------------------------
    async function TestEnv__FetchGlbFileList() {
        try {
            const response = await fetch('/api/glb-files');                   // <-- Query Flask API

            if (!response.ok) {
                console.warn('[TestEnv] Failed to fetch GLB file list');
                return [];
            }

            const data = await response.json();
            return data.files || [];                                         // <-- Return array of filenames

        } catch (error) {
            console.warn('[TestEnv] Error fetching GLB file list:', error);
            return [];
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Load a Single GLB File into the Scene
    // ------------------------------------------------------------
    async function TestEnv__LoadSingleGlb(filename) {
        const loader = new GLTFLoader();
        const url = `/glb-assets/${filename}`;                               // <-- Build URL to local GLB

        try {
            TestEnv__UpdateStatus(`Loading ${filename}...`);
            const gltf = await loader.loadAsync(url);                        // <-- Load GLB file

            const model = gltf.scene;
            model.name = filename.replace('.glb', '').replace('.GLB', '');    // <-- Name from filename

            // Apply shadows to all meshes
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            TestEnv__ModelGroup__Root.add(model);                            // <-- Add to scene group
            TestEnv__LoadedGlbCount++;

            console.log(`[TestEnv] Loaded GLB: ${filename}`);
            return gltf;

        } catch (error) {
            console.error(`[TestEnv] Failed to load GLB: ${filename}`, error);
            return null;
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Load All Available GLB Files
    // ------------------------------------------------------------
    async function TestEnv__LoadAllGlbFiles() {
        const files = await TestEnv__FetchGlbFileList();                     // <-- Get file list from server

        if (files.length === 0) {
            console.log('[TestEnv] No GLB files found in TestEnv__GlbFiles/');
            if (nodeExplorerInfoEl) {
                nodeExplorerInfoEl.textContent = 'No GLB models loaded. Place .glb files in TestEnv__GlbFiles/ and refresh.';
            }
            return [];
        }

        if (statsGlbCountEl) statsGlbCountEl.textContent = files.length;

        const results = [];
        for (const filename of files) {
            const result = await TestEnv__LoadSingleGlb(filename);           // <-- Load each GLB sequentially
            if (result) results.push(result);
        }

        return results;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Statistics Debug Overlay
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Frame Timing State
    // ------------------------------------------------------------
    let TestEnv__Stats__PrevTime   = performance.now();                      // <-- Previous frame timestamp
    let TestEnv__Stats__FrameCount = 0;                                      // <-- Frame counter for FPS
    let TestEnv__Stats__Fps        = 0;                                      // <-- Current FPS value
    // ------------------------------------------------------------


    // FUNCTION | Count Scene Meshes and Vertices
    // ------------------------------------------------------------
    function TestEnv__Stats__CountSceneGeometry() {
        let meshCount   = 0;
        let vertexCount = 0;

        TestEnv__Scene.traverse((object) => {
            if (object.isMesh && object.geometry) {
                meshCount++;
                const posAttr = object.geometry.getAttribute('position');
                if (posAttr) {
                    vertexCount += posAttr.count;                            // <-- Sum vertex counts
                }
            }
        });

        return { meshCount, vertexCount };
    }
    // ------------------------------------------------------------


    // FUNCTION | Update Statistics Overlay
    // ------------------------------------------------------------
    function TestEnv__Stats__Update() {
        TestEnv__Stats__FrameCount++;
        const now = performance.now();
        const elapsed = now - TestEnv__Stats__PrevTime;

        if (elapsed >= 500) {                                                // <-- Update every 500ms
            TestEnv__Stats__Fps = Math.round((TestEnv__Stats__FrameCount * 1000) / elapsed);
            TestEnv__Stats__FrameCount = 0;
            TestEnv__Stats__PrevTime = now;

            if (statsFpsEl) statsFpsEl.textContent = TestEnv__Stats__Fps;

            const { meshCount, vertexCount } = TestEnv__Stats__CountSceneGeometry();
            if (statsMeshesEl)   statsMeshesEl.textContent   = meshCount;
            if (statsVerticesEl) statsVerticesEl.textContent  = vertexCount.toLocaleString();
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Node Graph Explorer
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Node Explorer State
    // ------------------------------------------------------------
    let TestEnv__NodeExplorer__PanelOpen      = true;                        // <-- Panel starts expanded
    let TestEnv__NodeExplorer__PanelWidth     = 320;                         // <-- Panel width in pixels
    let TestEnv__NodeExplorer__MinWidth       = 200;                         // <-- Minimum panel width
    let TestEnv__NodeExplorer__MaxWidth       = 600;                         // <-- Maximum panel width
    let TestEnv__NodeExplorer__IsDragging     = false;                       // <-- Drag state
    let TestEnv__NodeExplorer__DragStartX     = 0;                           // <-- Drag start X position
    let TestEnv__NodeExplorer__DragStartWidth = 0;                           // <-- Width at drag start
    // ------------------------------------------------------------


    // HELPER FUNCTION | Get Node Type Label
    // ------------------------------------------------------------
    function TestEnv__NodeExplorer__GetTypeLabel(object) {
        if (object.isMesh)            return 'Mesh';
        if (object.isGroup)           return 'Group';
        if (object.isLight)           return 'Light';
        if (object.isCamera)          return 'Camera';
        if (object.isLine)            return 'Line';
        if (object.isLineSegments)    return 'LineSegments';
        if (object.isPoints)          return 'Points';
        if (object.isBone)            return 'Bone';
        if (object.isSkinnedMesh)     return 'SkinnedMesh';
        if (object.isScene)           return 'Scene';
        return 'Object3D';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Get Node Type CSS Class
    // ------------------------------------------------------------
    function TestEnv__NodeExplorer__GetTypeClass(object) {
        if (object.isMesh)         return 'testenv-node--mesh';
        if (object.isGroup)        return 'testenv-node--group';
        if (object.isLight)        return 'testenv-node--light';
        if (object.isScene)        return 'testenv-node--scene';
        return 'testenv-node--object';
    }
    // ------------------------------------------------------------


    // FUNCTION | Build Tree Node Element Recursively
    // ------------------------------------------------------------
    function TestEnv__NodeExplorer__BuildTreeNode(object, depth = 0) {
        const nodeEl = document.createElement('div');
        nodeEl.className = 'testenv-node-item';
        nodeEl.style.paddingLeft = `${depth * 16}px`;                        // <-- Indent by depth

        // EXPAND/COLLAPSE ARROW (for nodes with children)
        const hasChildren = object.children && object.children.length > 0;
        const arrowEl = document.createElement('span');
        arrowEl.className = 'testenv-node-item__arrow';
        arrowEl.textContent = hasChildren ? '\u25BC' : '\u00A0';             // <-- Down arrow or space
        arrowEl.style.cursor = hasChildren ? 'pointer' : 'default';
        nodeEl.appendChild(arrowEl);

        // VISIBILITY TOGGLE CHECKBOX
        const toggleEl = document.createElement('input');
        toggleEl.type = 'checkbox';
        toggleEl.className = 'testenv-node-item__toggle';
        toggleEl.checked = object.visible;
        toggleEl.title = 'Toggle visibility';
        toggleEl.addEventListener('change', () => {
            object.visible = toggleEl.checked;                               // <-- Set Three.js visibility
        });
        nodeEl.appendChild(toggleEl);

        // NODE TYPE BADGE
        const typeLabel = TestEnv__NodeExplorer__GetTypeLabel(object);
        const typeEl = document.createElement('span');
        typeEl.className = `testenv-node-item__type ${TestEnv__NodeExplorer__GetTypeClass(object)}`;
        typeEl.textContent = typeLabel;
        nodeEl.appendChild(typeEl);

        // NODE NAME
        const nameEl = document.createElement('span');
        nameEl.className = 'testenv-node-item__name';
        nameEl.textContent = object.name || `(unnamed ${typeLabel})`;
        nameEl.title = `${typeLabel}: ${object.name || 'unnamed'}`;
        nodeEl.appendChild(nameEl);

        // CHILDREN CONTAINER
        const childrenEl = document.createElement('div');
        childrenEl.className = 'testenv-node-item__children';
        let childrenExpanded = true;                                         // <-- Children start expanded

        if (hasChildren) {
            for (const child of object.children) {
                childrenEl.appendChild(
                    TestEnv__NodeExplorer__BuildTreeNode(child, depth + 1)   // <-- Recursive build
                );
            }

            // ARROW CLICK HANDLER (expand/collapse children)
            arrowEl.addEventListener('click', () => {
                childrenExpanded = !childrenExpanded;
                childrenEl.style.display = childrenExpanded ? 'block' : 'none';
                arrowEl.textContent = childrenExpanded ? '\u25BC' : '\u25B6'; // <-- Toggle arrow direction
            });
        }

        // WRAPPER
        const wrapperEl = document.createElement('div');
        wrapperEl.className = 'testenv-node-wrapper';
        wrapperEl.appendChild(nodeEl);
        wrapperEl.appendChild(childrenEl);

        return wrapperEl;
    }
    // ------------------------------------------------------------


    // FUNCTION | Build Full Node Tree from Scene
    // ------------------------------------------------------------
    function TestEnv__NodeExplorer__BuildTree() {
        if (!nodeTreeEl) return;
        nodeTreeEl.innerHTML = '';                                            // <-- Clear existing tree

        // Build tree for the loaded models group
        if (TestEnv__ModelGroup__Root.children.length > 0) {
            for (const child of TestEnv__ModelGroup__Root.children) {
                nodeTreeEl.appendChild(
                    TestEnv__NodeExplorer__BuildTreeNode(child, 0)
                );
            }
            if (nodeExplorerInfoEl) {
                nodeExplorerInfoEl.textContent = `${TestEnv__LoadedGlbCount} GLB model(s) loaded`;
            }
        }

        // Also show the dev cube if visible
        if (TestEnv__DevCube__Visible) {
            const devCubeTree = TestEnv__NodeExplorer__BuildTreeNode(TestEnv__DevCube__Mesh, 0);
            nodeTreeEl.appendChild(devCubeTree);
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Set Panel Width
    // ------------------------------------------------------------
    function TestEnv__NodeExplorer__SetWidth(width) {
        // Clamp width to min/max bounds
        const clampedWidth = Math.max(
            TestEnv__NodeExplorer__MinWidth,
            Math.min(TestEnv__NodeExplorer__MaxWidth, width)
        );

        TestEnv__NodeExplorer__PanelWidth = clampedWidth;

        if (nodeExplorerEl) {
            nodeExplorerEl.style.width = `${clampedWidth}px`;                // <-- Set panel width
            document.documentElement.style.setProperty('--TestEnv_NodeExplorerWidth', `${clampedWidth}px`);
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Start Panel Resize Drag
    // ------------------------------------------------------------
    function TestEnv__NodeExplorer__StartDrag(event) {
        TestEnv__NodeExplorer__IsDragging = true;
        TestEnv__NodeExplorer__DragStartX = event.clientX;
        TestEnv__NodeExplorer__DragStartWidth = TestEnv__NodeExplorer__PanelWidth;

        const resizeHandle = document.getElementById('testEnvResizeHandle');
        if (resizeHandle) {
            resizeHandle.classList.add('testenv-node-explorer__resize-handle--dragging');
        }

        document.body.style.cursor = 'ew-resize';                            // <-- Set cursor for entire page
        document.body.style.userSelect = 'none';                             // <-- Disable text selection during drag

        event.preventDefault();                                              // <-- Prevent default drag behavior
    }
    // ------------------------------------------------------------


    // FUNCTION | Handle Panel Resize Drag
    // ------------------------------------------------------------
    function TestEnv__NodeExplorer__OnDrag(event) {
        if (!TestEnv__NodeExplorer__IsDragging) return;

        const deltaX = TestEnv__NodeExplorer__DragStartX - event.clientX;    // <-- Mouse moved left = positive delta
        const newWidth = TestEnv__NodeExplorer__DragStartWidth + deltaX;

        TestEnv__NodeExplorer__SetWidth(newWidth);                           // <-- Update panel width
    }
    // ------------------------------------------------------------


    // FUNCTION | End Panel Resize Drag
    // ------------------------------------------------------------
    function TestEnv__NodeExplorer__EndDrag() {
        if (!TestEnv__NodeExplorer__IsDragging) return;

        TestEnv__NodeExplorer__IsDragging = false;

        const resizeHandle = document.getElementById('testEnvResizeHandle');
        if (resizeHandle) {
            resizeHandle.classList.remove('testenv-node-explorer__resize-handle--dragging');
        }

        document.body.style.cursor = '';                                     // <-- Reset cursor
        document.body.style.userSelect = '';                                 // <-- Re-enable text selection
    }
    // ------------------------------------------------------------


    // FUNCTION | Toggle Node Explorer Panel Open/Closed
    // ------------------------------------------------------------
    function TestEnv__NodeExplorer__TogglePanel() {
        TestEnv__NodeExplorer__PanelOpen = !TestEnv__NodeExplorer__PanelOpen;

        if (TestEnv__NodeExplorer__PanelOpen) {
            nodeExplorerEl.classList.remove('testenv-node-explorer--collapsed');
            nodeExplorerArrowEl.textContent = '\u25B6';                      // <-- Right arrow (close)
        } else {
            nodeExplorerEl.classList.add('testenv-node-explorer--collapsed');
            nodeExplorerArrowEl.textContent = '\u25C0';                      // <-- Left arrow (open)
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Expand All Tree Nodes
    // ------------------------------------------------------------
    function TestEnv__NodeExplorer__ExpandAll() {
        if (!nodeTreeEl) return;
        const childrenContainers = nodeTreeEl.querySelectorAll('.testenv-node-item__children');
        const arrows = nodeTreeEl.querySelectorAll('.testenv-node-item__arrow');

        childrenContainers.forEach((el) => { el.style.display = 'block'; });
        arrows.forEach((el) => {
            if (el.textContent === '\u25B6') el.textContent = '\u25BC';      // <-- Set to expanded arrow
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Collapse All Tree Nodes
    // ------------------------------------------------------------
    function TestEnv__NodeExplorer__CollapseAll() {
        if (!nodeTreeEl) return;
        const childrenContainers = nodeTreeEl.querySelectorAll('.testenv-node-item__children');
        const arrows = nodeTreeEl.querySelectorAll('.testenv-node-item__arrow');

        childrenContainers.forEach((el) => { el.style.display = 'none'; });
        arrows.forEach((el) => {
            if (el.textContent === '\u25BC') el.textContent = '\u25B6';      // <-- Set to collapsed arrow
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Show All Nodes (Set Visible)
    // ------------------------------------------------------------
    function TestEnv__NodeExplorer__ShowAll() {
        TestEnv__ModelGroup__Root.traverse((object) => {
            object.visible = true;                                           // <-- Make all visible
        });
        TestEnv__NodeExplorer__BuildTree();                                  // <-- Rebuild tree to update checkboxes
    }
    // ------------------------------------------------------------


    // FUNCTION | Hide All Nodes (Set Invisible)
    // ------------------------------------------------------------
    function TestEnv__NodeExplorer__HideAll() {
        TestEnv__ModelGroup__Root.traverse((object) => {
            if (object !== TestEnv__ModelGroup__Root) {
                object.visible = false;                                      // <-- Hide all except root group
            }
        });
        TestEnv__NodeExplorer__BuildTree();                                  // <-- Rebuild tree to update checkboxes
    }
    // ------------------------------------------------------------


    // FUNCTION | Generate Plaintext Tree Structure (Recursive)
    // ------------------------------------------------------------
    function TestEnv__NodeExplorer__GenerateTreeText(object, depth = 0, isLast = true, prefix = '') {
        const typeLabel = TestEnv__NodeExplorer__GetTypeLabel(object);
        const name = object.name || `(unnamed ${typeLabel})`;
        const visibleIcon = object.visible ? 'ðŸ‘' : 'ðŸš«';

        // Build the tree branch characters
        const connector = isLast ? 'â””â”€' : 'â”œâ”€';
        const line = depth === 0 ? '' : `${prefix}${connector} `;

        // Build this node's text line
        let text = `${line}${visibleIcon} [${typeLabel}] ${name}\n`;

        // Process children
        const children = object.children || [];
        if (children.length > 0) {
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                const childIsLast = (i === children.length - 1);
                const childPrefix = depth === 0 ? '' : prefix + (isLast ? '   ' : 'â”‚  ');
                text += TestEnv__NodeExplorer__GenerateTreeText(child, depth + 1, childIsLast, childPrefix);
            }
        }

        return text;
    }
    // ------------------------------------------------------------


    // FUNCTION | Refresh Models (Reload GLB Files Without Resetting Camera)
    // ------------------------------------------------------------
    async function TestEnv__NodeExplorer__RefreshModels() {
        if (!refreshModelsBtn) return;

        // Disable button during refresh
        refreshModelsBtn.disabled = true;
        const originalText = refreshModelsBtn.innerHTML;
        refreshModelsBtn.innerHTML = '&#8635; Loading...';

        try {
            // SAVE CAMERA STATE
            const savedCameraPosition = TestEnv__Camera.position.clone();        // <-- Save camera position
            const savedCameraTarget   = TestEnv__Controls.target.clone();        // <-- Save orbit target

            // CLEAR EXISTING MODELS
            console.log('[TestEnv] Clearing existing models...');
            while (TestEnv__ModelGroup__Root.children.length > 0) {
                const child = TestEnv__ModelGroup__Root.children[0];
                TestEnv__ModelGroup__Root.remove(child);                         // <-- Remove from scene
                
                // Dispose of geometry and materials
                child.traverse((node) => {
                    if (node.isMesh) {
                        if (node.geometry) node.geometry.dispose();              // <-- Free geometry memory
                        if (node.material) {
                            if (Array.isArray(node.material)) {
                                node.material.forEach(mat => mat.dispose());     // <-- Dispose material array
                            } else {
                                node.material.dispose();                         // <-- Dispose single material
                            }
                        }
                    }
                });
            }

            TestEnv__LoadedGlbCount = 0;                                         // <-- Reset model count

            // RELOAD ALL GLB FILES
            console.log('[TestEnv] Reloading GLB files...');
            const glbResults = await TestEnv__LoadAllGlbFiles();                 // <-- Load models

            // REAPPLY PBR MATERIALS AFTER REFRESH
            if (TestEnv__Config__MaterialsSystem.MaterialsSystem__Config__Enabled && glbResults.length > 0) {
                const refreshLibraryData = await Na__MaterialsSystem__LoadLibrary(
                    TestEnv__Config__MaterialsSystem.MaterialsSystem__Config__LibraryUrl
                );
                if (refreshLibraryData) {
                    const refreshLookupMap = Na__MaterialsSystem__BuildLookup(refreshLibraryData);
                    if (refreshLookupMap.size > 0) {
                        for (const child of TestEnv__ModelGroup__Root.children) {
                            await Na__MaterialsSystem__ApplyMaterials(child, refreshLookupMap, TestEnv__Config__MaterialsSystem);
                        }
                    }
                }
            }

            // RESTORE CAMERA STATE
            TestEnv__Camera.position.copy(savedCameraPosition);                  // <-- Restore camera position
            TestEnv__Controls.target.copy(savedCameraTarget);                    // <-- Restore orbit target
            TestEnv__Controls.update();                                          // <-- Update controls

            // REBUILD NODE TREE
            TestEnv__NodeExplorer__BuildTree();                                  // <-- Rebuild tree UI

            // REINITIALIZE STOREY VISIBILITY CONTROLS (shared module)
            Na__UiFeature__InitializeStoreyViewControls(TestEnv__ModelGroup__Root, TestEnv__Config.StoreyVisibility || {});

            // REINITIALIZE DOOR ANIMATION (if enabled)
            const TestEnv__Config__3dObjectInteractions = TestEnv__Config['3dObject__InteractionsSystem'];
            
            if (TestEnv__Config__3dObjectInteractions) {
                const TestEnv__Config__DoorAnimation = TestEnv__Config__3dObjectInteractions['3dObject__Interaction__DoorAnimation'];
                
                if (TestEnv__Config__DoorAnimation && TestEnv__Config__DoorAnimation['3dObject__Interaction__DoorAnimation__Enabled'] !== false) {
                    // Find all door models (supports both flat and storey-based structures)
                    const { doorMeshGroups, doorLineworkGroups } = TestEnv__FindAllDoorModels();

                    if (doorMeshGroups.length > 0 || doorLineworkGroups.length > 0) {
                        Na__DoorAnimation__Initialize(
                            TestEnv__Scene,
                            TestEnv__Camera,
                            TestEnv__Renderer.domElement,
                            doorMeshGroups,                                      // <-- Array of mesh model groups
                            doorLineworkGroups,                                  // <-- Array of linework model groups
                            TestEnv__Config__DoorAnimation
                        );
                        console.log('[TestEnv] Door animation reinitialized after refresh');
                    }
                }
            }

            console.log(`[TestEnv] Refresh complete. Loaded ${glbResults.length} GLB file(s).`);

            // Success feedback
            refreshModelsBtn.innerHTML = '&#10004; Refreshed!';
            refreshModelsBtn.classList.add('testenv-node-explorer__action-btn--success');
            refreshModelsBtn.classList.remove('testenv-node-explorer__action-btn--refresh');

            setTimeout(() => {
                refreshModelsBtn.innerHTML = originalText;
                refreshModelsBtn.classList.remove('testenv-node-explorer__action-btn--success');
                refreshModelsBtn.classList.add('testenv-node-explorer__action-btn--refresh');
                refreshModelsBtn.disabled = false;
            }, 2000);

        } catch (error) {
            console.error('[TestEnv] Model refresh failed:', error);
            refreshModelsBtn.innerHTML = '&#10060; Failed';
            setTimeout(() => {
                refreshModelsBtn.innerHTML = originalText;
                refreshModelsBtn.disabled = false;
            }, 3000);
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Copy Tree to Clipboard
    // ------------------------------------------------------------
    async function TestEnv__NodeExplorer__CopyTree() {
        let treeText = '# TrueVision3D - Node Graph Explorer\n';
        treeText += `# Exported: ${new Date().toLocaleString()}\n`;
        treeText += `# GLB Files Loaded: ${TestEnv__LoadedGlbCount}\n`;
        treeText += '\n';

        // Generate tree for all loaded models
        if (TestEnv__ModelGroup__Root.children.length > 0) {
            treeText += '## Loaded Models\n\n';
            for (const child of TestEnv__ModelGroup__Root.children) {
                treeText += TestEnv__NodeExplorer__GenerateTreeText(child, 0, true, '');
                treeText += '\n';
            }
        }

        // Include dev cube if visible
        if (TestEnv__DevCube__Visible && TestEnv__DevCube__Mesh) {
            treeText += '## Dev Cube\n\n';
            treeText += TestEnv__NodeExplorer__GenerateTreeText(TestEnv__DevCube__Mesh, 0, true, '');
        }

        // Copy to clipboard
        try {
            await navigator.clipboard.writeText(treeText);                   // <-- Copy to clipboard
            console.log('[TestEnv] Node tree copied to clipboard');

            // Visual feedback: change button style temporarily
            if (copyTreeBtn) {
                const originalText = copyTreeBtn.innerHTML;
                copyTreeBtn.innerHTML = '&#10004; Copied!';
                copyTreeBtn.classList.add('testenv-node-explorer__action-btn--success');
                copyTreeBtn.classList.remove('testenv-node-explorer__action-btn--primary');

                setTimeout(() => {
                    copyTreeBtn.innerHTML = originalText;
                    copyTreeBtn.classList.remove('testenv-node-explorer__action-btn--success');
                    copyTreeBtn.classList.add('testenv-node-explorer__action-btn--primary');
                }, 2000);
            }

        } catch (error) {
            console.error('[TestEnv] Failed to copy tree:', error);
            alert('Failed to copy tree to clipboard. Please check browser permissions.');
        }
    }
    // ------------------------------------------------------------


    // INITIALIZATION | Node Explorer Event Listeners
    // ------------------------------------------------------------
    if (nodeExplorerToggleEl) {
        nodeExplorerToggleEl.addEventListener('click', TestEnv__NodeExplorer__TogglePanel);
    }
    if (refreshModelsBtn) refreshModelsBtn.addEventListener('click', TestEnv__NodeExplorer__RefreshModels);
    if (expandAllBtn)     expandAllBtn.addEventListener('click', TestEnv__NodeExplorer__ExpandAll);
    if (collapseAllBtn)   collapseAllBtn.addEventListener('click', TestEnv__NodeExplorer__CollapseAll);
    if (showAllBtn)       showAllBtn.addEventListener('click', TestEnv__NodeExplorer__ShowAll);
    if (hideAllBtn)       hideAllBtn.addEventListener('click', TestEnv__NodeExplorer__HideAll);
    if (copyTreeBtn)      copyTreeBtn.addEventListener('click', TestEnv__NodeExplorer__CopyTree);

    // DRAG RESIZE HANDLERS
    const resizeHandle = document.getElementById('testEnvResizeHandle');
    if (resizeHandle) {
        resizeHandle.addEventListener('mousedown', TestEnv__NodeExplorer__StartDrag);
    }

    // Global mouse handlers for drag (attached to window for drag tracking outside panel)
    window.addEventListener('mousemove', TestEnv__NodeExplorer__OnDrag);
    window.addEventListener('mouseup', TestEnv__NodeExplorer__EndDrag);

    // Set initial panel width from default
    TestEnv__NodeExplorer__SetWidth(TestEnv__NodeExplorer__PanelWidth);
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Main Loading Sequence
// -----------------------------------------------------------------------------

    // FUNCTION | Start Loading Sequence
    // ------------------------------------------------------------
    async function TestEnv__StartLoadingSequence() {
        TestEnv__UpdateStatus('Creating scene...');
        TestEnv__SetupLighting();                                            // <-- Setup lights and ground

        // SETUP POST-PROCESSING PIPELINE
        TestEnv__RenderPipelineState = Na__RenderPipeline__SetupComposer(
            TestEnv__Renderer,
            TestEnv__Scene,
            TestEnv__Camera,
            TestEnv__Config__ProfileLines
        );
        TestEnv__RenderComposer = TestEnv__RenderPipelineState.composer;

        // LOAD ALL GLB FILES FROM LOCAL FOLDER
        try {
            const glbResults = await TestEnv__LoadAllGlbFiles();             // <-- Load all local GLBs

            // APPLY PBR MATERIALS FROM LIBRARY (second pass - selective override)
            if (TestEnv__Config__MaterialsSystem.MaterialsSystem__Config__Enabled && glbResults.length > 0) {
                const TestEnv__MaterialsLibraryUrl  = TestEnv__Config__MaterialsSystem.MaterialsSystem__Config__LibraryUrl;
                const TestEnv__MaterialsLibraryData = await Na__MaterialsSystem__LoadLibrary(TestEnv__MaterialsLibraryUrl);

                if (TestEnv__MaterialsLibraryData) {
                    const TestEnv__MaterialsLookupMap = Na__MaterialsSystem__BuildLookup(TestEnv__MaterialsLibraryData);

                    if (TestEnv__MaterialsLookupMap.size > 0) {
                        for (const child of TestEnv__ModelGroup__Root.children) {
                            await Na__MaterialsSystem__ApplyMaterials(child, TestEnv__MaterialsLookupMap, TestEnv__Config__MaterialsSystem);
                        }
                    }
                }
            }

            // RESOLVE ORBIT HELPER CUBE FROM LOADED MODELS
            const TestEnv__OrbitHelper = TestEnv__ResolveOrbitHelperCubeCenter();
            if (TestEnv__OrbitHelper && TestEnv__Config__DevMode.OrbitHelperCube__Debug__Visible === false) {
                TestEnv__OrbitHelper.root.visible = false;                    // <-- Hide helper cube unless debug visibility is enabled
            }

            // APPLY SAVED DEFAULT VIEW OR AUTO-CENTER ON LOADED MODELS
            if (TestEnv__Config__DefaultView) {
                TestEnv__DefaultView__Apply(TestEnv__Config__DefaultView);   // <-- Restore saved camera view
            } else if (glbResults.length > 0) {
                const box = new THREE.Box3().setFromObject(TestEnv__ModelGroup__Root);
                if (!box.isEmpty()) {
                    const center = box.getCenter(new THREE.Vector3());
                    const size   = box.getSize(new THREE.Vector3());
                    const maxDim = Math.max(size.x, size.y, size.z);

                    TestEnv__Controls.target.copy(center);                   // <-- Set orbit to model center
                    TestEnv__Camera.position.set(
                        center.x + maxDim * 1.5,                             // <-- Offset camera from model
                        center.y + maxDim * 0.8,
                        center.z + maxDim * 1.5
                    );
                    TestEnv__Controls.update();
                }
            }

            // RESOLVE FINAL ORBIT TARGET (STRICT PRECEDENCE)
            // 1) Loaded OrbitHelperCube center (authoritative fixed anchor)
            // 2) Saved default view orbit target (already applied if no helper center)
            // 3) Existing controls target (if neither condition above can apply)
            if (TestEnv__OrbitHelper && TestEnv__OrbitHelper.center && TestEnv__OrbitHelper.center.isVector3) {
                if (TestEnv__Config__DefaultView) {
                    console.warn('[TestEnv] Saved TestEnv__DefaultView orbit target ignored because OrbitHelperCube center is available.');
                }
                TestEnv__Controls.target.copy(TestEnv__OrbitHelper.center);
                TestEnv__Controls.update();
            } else if (!TestEnv__Config__DefaultView) {
                console.warn('[TestEnv] No OrbitHelperCube center and no saved default view target. Keeping current controls.target.');
            }

            TestEnv__ShowScene();                                            // <-- Reveal scene
            TestEnv__NodeExplorer__BuildTree();                              // <-- Build node graph tree

            // DETECT AND BUILD STOREY VISIBILITY CONTROLS (shared module)
            Na__UiFeature__InitializeStoreyViewControls(TestEnv__ModelGroup__Root, TestEnv__Config.StoreyVisibility || {});

            // INITIALIZE DOOR ANIMATION (requires main app config structure)
            const TestEnv__Config__3dObjectInteractions = TestEnv__Config['3dObject__InteractionsSystem'];
            
            if (!TestEnv__Config__3dObjectInteractions) {
                console.error('[TestEnv] Door animation config missing: 3dObject__InteractionsSystem not found in test config');
            } else {
                const TestEnv__Config__DoorAnimation = TestEnv__Config__3dObjectInteractions['3dObject__Interaction__DoorAnimation'];
                
                if (!TestEnv__Config__DoorAnimation) {
                    console.error('[TestEnv] Door animation config missing: 3dObject__Interaction__DoorAnimation not found');
                } else if (TestEnv__Config__DoorAnimation['3dObject__Interaction__DoorAnimation__Enabled'] !== false) {
                    // Find all door models (supports both flat and storey-based structures)
                    const { doorMeshGroups, doorLineworkGroups } = TestEnv__FindAllDoorModels();

                    if (doorMeshGroups.length > 0 || doorLineworkGroups.length > 0) {
                        Na__DoorAnimation__Initialize(
                            TestEnv__Scene,                                      // <-- Scene reference
                            TestEnv__Camera,                                     // <-- Camera reference
                            TestEnv__Renderer.domElement,                        // <-- Canvas DOM element
                            doorMeshGroups,                                      // <-- Array of mesh model groups (doors)
                            doorLineworkGroups,                                  // <-- Array of linework model groups (doors)
                            TestEnv__Config__DoorAnimation                      // <-- Door animation config
                        );
                        console.log('[TestEnv] Door animation initialized (imports from main app module)');
                    } else {
                        console.warn('[TestEnv] Door animation enabled but no door model groups found in scene');
                    }
                }
            }

            // SET WALK MODE COLLISION MESHES (from loaded model root)
            Na__WalkMode__SetCollisionMeshes(TestEnv__ModelGroup__Root);

        } catch (error) {
            console.error('[TestEnv] Loading error:', error);
            TestEnv__UpdateStatus('Loading error - check console', true);
        }

        // RENDER LOOP
        let TestEnv__Animate__PrevTimestamp = performance.now();             // <-- Previous frame timestamp for delta

        function TestEnv__Animate() {
            requestAnimationFrame(TestEnv__Animate);

            // Calculate delta time in milliseconds
            const now     = performance.now();                               // <-- Current frame timestamp
            const deltaMs = now - TestEnv__Animate__PrevTimestamp;           // <-- Delta since last frame
            TestEnv__Animate__PrevTimestamp = now;                           // <-- Store for next frame

            if (Na__WalkMode__IsActive()) {
                Na__WalkMode__Update(deltaMs);                               // <-- Update walk mode physics and camera
                Na__DoorProximity__Update(Na__WalkMode__GetCapsulePosition()); // <-- Proximity door triggers
            } else {
                TestEnv__UpdateNav();                                        // <-- Update orbit controls
            }
            Na__DoorAnimation__Update(deltaMs);                              // <-- Drive door animations

            if (TestEnv__RenderComposer && TestEnv__RenderPipelineState) {
                TestEnv__RenderPipelineState.renderProfileNormals();         // <-- Profile lines normal pass
                TestEnv__RenderComposer.render();                            // <-- Render scene
            }

            TestEnv__Stats__Update();                                        // <-- Update stats overlay
        }

        TestEnv__Animate();                                                  // <-- Start render loop

        // RESIZE HANDLER
        window.addEventListener('resize', () => {
            const width  = window.innerWidth;
            const height = window.innerHeight;

            TestEnv__Camera.aspect = width / height;
            TestEnv__Camera.updateProjectionMatrix();
            TestEnv__Renderer.setSize(width, height);

            if (TestEnv__RenderComposer && TestEnv__RenderPipelineState) {
                TestEnv__RenderComposer.setSize(width, height);
                TestEnv__RenderPipelineState.setProfileLinesSize(width, height);
            }

            TestEnv__LineResolution.set(width, height);
        });
    }
    // ------------------------------------------------------------


    // INITIALIZATION | Start Loading
    // ------------------------------------------------------------
    TestEnv__StartLoadingSequence();
    console.log('[TestEnv] TrueVision3D Test Environment initialized');
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

