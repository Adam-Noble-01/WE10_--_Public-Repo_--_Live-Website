// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SNAPSHOT RENDERER
// =============================================================================
//
// FILE       : Na__LayoutEditor__SnapshotRenderer__.js
// NAMESPACE  : Na__LeSnap
// MODULE     : Layout Editor - Snapshot Renderer
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Offscreen pictures for both viewport kinds through the live pipeline, restoring everything touched
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - 2D underlay: the drawing's cut goes onto the section adapter, an
//   orthographic camera of the module's own is framed on the viewport's
//   model window, the composer and material presets are entered with the
//   viewport's style toggles, and the tiled renderer paints it at the
//   requested pixels per paper millimetre. Then the cut, the presets and
//   the 3D suspension are undone in reverse.
// - 3D snapshot: the main camera is posed from the scene record (which also
//   applies the scene's layer visibility and cross section binding), the
//   material preset applies whitecard and opaque glass, the profile lines
//   pass follows the toggle, the tiled renderer paints, and the pose,
//   visibility, sections and pass are put back.
// - Renders queue one behind another: the renderer and the presets are
//   shared state and two renders in flight would trample each other.
//
// INTEGRATION:
// - Initialized from index.html with the renderer, scene, camera, controls,
//   pipeline ref and model root.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__SnapshotRenderer__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.3.0
// - Context Layer off takes the existing building and its surroundings out of the picture; the visibility is put back afterwards.
//
// 10-Sep-2026 - Version 1.2.0
// - The Enhance Whitecard pass runs on the render canvas when the viewport style asks for it.
//
// 10-Sep-2026 - Version 1.1.0
// - Session-cached model fingerprints (no model walk per refresh); the profile lines pass state is restored after a 2D render.
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 5.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Enhance Whitecard Pass
    // ------------------------------------------------------------
    import { Na__LeEnhance__Apply } from './Na__LayoutEditor__Enhance__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Three, Units, Render Loop
    // ------------------------------------------------------------
    import * as THREE from 'three';
    import { Na__Math__ConvertMmToUnits, Na__Math__ConvertUnitsToMm } from '../04__MathUtils/Na__Math__Units.js';
    import { Na__RenderLoop__RequestRender } from '../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Drawing View Core (presets, section adapter, transitions)
    // ------------------------------------------------------------
    import {
        Na__DrawView__SectionAdapter__UpsertHorizontalPlane,
        Na__DrawView__SectionAdapter__UpsertVerticalPlane,
        Na__DrawView__SectionAdapter__SetActivePlane,
        Na__DrawView__SectionAdapter__RemovePlane,
        Na__DrawView__SectionAdapter__SuspendLiveTool,
        Na__DrawView__SectionAdapter__Release,
        Na__DrawView__SectionAdapter__ReapplyClipping
    } from '../40__System__DrawingViewCore/Na__DrawView__SectionAdapter__.js';
    import {
        Na__DrawView__RenderPreset__Enter,
        Na__DrawView__RenderPreset__Exit,
        Na__DrawView__RenderPreset__RenderFrame,
        Na__DrawView__RenderPreset__GetExportOverrides
    } from '../40__System__DrawingViewCore/Na__DrawView__RenderPreset__.js';
    import {
        Na__DrawView__MaterialPreset__Enter,
        Na__DrawView__MaterialPreset__Exit
    } from '../40__System__DrawingViewCore/Na__DrawView__MaterialPreset__.js';
    import {
        Na__DrawView__Transitions__SuspendThreeD,
        Na__DrawView__Transitions__ResumeThreeD,
        Na__DrawView__Transitions__IsSuspended
    } from '../40__System__DrawingViewCore/Na__DrawView__Transitions__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Plan and Elevation Records and Camera Setups
    // ------------------------------------------------------------
    import { Na__FpCfg__GetCameraSetup } from '../42__System__FloorPlanViews/Na__FloorPlan__ConfigState__.js';
    import { Na__FpData__GetCutHeightMm, Na__FpData__GetViewDepthMm, Na__FpData__GetSavedView } from '../42__System__FloorPlanViews/Na__FloorPlan__ProjectJson__Data__.js';
    import { Na__ElevCfg__GetCameraSetup } from '../45__System__ElevationViews/Na__Elevation__ConfigState__.js';
    import {
        Na__ElevData__GetAxes,
        Na__ElevData__IsSection,
        Na__ElevData__GetPlaneDistanceMm,
        Na__ElevData__GetViewDepthMm,
        Na__ElevData__GetSavedView
    } from '../45__System__ElevationViews/Na__Elevation__ProjectJson__Data__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Scene Pose, Visibility, Sections, Tiled Renderer
    // ------------------------------------------------------------
    import { Na__PresentationMode__Camera__ApplySceneCameraState } from '../21__System__PresentationMode/Na__PresentationMode__Camera__SceneTransition.js';
    import { Na__ModelToggle__CaptureVisibilityMap, Na__ModelToggle__ApplySceneLayerVisibility, Na__ModelToggle__SetCategoryVisibility } from '../26__System__ToggleModelElements/Na__UiFeature__ModelToggle__Controls.js';
    import { Na__SectSerialize__Serialize, Na__SectSerialize__Apply } from '../41__System__SectionCutEngine/Na__SectionCut__Serialize__.js';
    import { Na__StaticExport__RenderToCanvas } from '../30__System__ImageExport/Na__ImageExport__StaticExport__TiledRenderer.js';
    import { Na__PlView__KIND_PLAN, Na__PlView__Hash } from '../50__System__ProjectedLinework/Na__ProjectedLinework__ViewDefinition__.js';
    import { Na__PlStage__Describe } from '../50__System__ProjectedLinework/Na__ProjectedLinework__ModelStage__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Cut Plane Id
    // ------------------------------------------------------------
    const Na__LeSnap__CUT_ID = 'na-layouteditor-snapshot';
    // ------------------------------------------------------------

    // MODULE VARIABLES | Render Context and Queue
    // ------------------------------------------------------------
    let Na__LeSnap__Renderer    = null;
    let Na__LeSnap__Scene       = null;
    let Na__LeSnap__Camera      = null;
    let Na__LeSnap__Controls    = null;
    let Na__LeSnap__PipelineRef = null;
    let Na__LeSnap__ModelRoot   = null;
    let Na__LeSnap__Ortho       = null;
    let Na__LeSnap__Chain       = Promise.resolve();
    let Na__LeSnap__ModelFp     = null;    // <-- Visibility-free model fingerprint, cached until the model or its toggles change
    let Na__LeSnap__PipelineFp  = null;    // <-- The projection pipeline's own fingerprint, cached the same way
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Queue a Render Behind Any Other
    // ------------------------------------------------------------
    function Na__LeSnap__Enqueue(task) {
        const run = Na__LeSnap__Chain.then(task);
        Na__LeSnap__Chain = run.catch(() => {});
        return run;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Live Pipeline State
    // ------------------------------------------------------------
    function Na__LeSnap__Pipeline() {
        return Na__LeSnap__PipelineRef ? Na__LeSnap__PipelineRef.current : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Module's Own Orthographic Camera, Framed on a Window
    // ------------------------------------------------------------
    // window: { CentreX, CentreY, WidthMm, HeightMm } in drawing millimetres
    // ------------------------------------------------------------
    function Na__LeSnap__FrameOrtho(definition, windowMm) {
        if (!Na__LeSnap__Ortho) {
            Na__LeSnap__Ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1000);
            Na__LeSnap__Ortho.name = 'Na__LayoutEditor__SnapshotCamera';
        }
        const camera = Na__LeSnap__Ortho;
        const halfW  = Na__Math__ConvertMmToUnits(windowMm.WidthMm  / 2);
        const halfH  = Na__Math__ConvertMmToUnits(windowMm.HeightMm / 2);
        camera.left = -halfW; camera.right = halfW; camera.top = halfH; camera.bottom = -halfH;
        camera.zoom = 1;

        if (definition.Kind === Na__PlView__KIND_PLAN) {
            const setup = Na__FpCfg__GetCameraSetup();
            const eyeX  = Na__Math__ConvertMmToUnits(windowMm.CentreX);
            const eyeZ  = Na__Math__ConvertMmToUnits(windowMm.CentreY);           // <-- Drawing y down is world Z
            const eyeY  = Na__Math__ConvertMmToUnits(Na__FpData__GetCutHeightMm(definition.Record)) + setup.heightAboveCutUnits;
            camera.near = setup.nearUnits; camera.far = setup.farUnits;
            camera.position.set(eyeX, eyeY, eyeZ);
            camera.up.set(0, 0, -1);
            camera.lookAt(eyeX, eyeY - 1, eyeZ);
        } else {
            const setup  = Na__ElevCfg__GetCameraSetup();
            const axes   = Na__ElevData__GetAxes(definition.Record);
            const runU   = Na__Math__ConvertMmToUnits(windowMm.CentreX);
            const height = Na__Math__ConvertMmToUnits(-windowMm.CentreY);          // <-- Drawing y down is minus height
            const planeU = Na__Math__ConvertMmToUnits(Na__ElevData__GetPlaneDistanceMm(definition.Record));
            const eyeD   = planeU + setup.standOffUnits;
            camera.near = setup.nearUnits; camera.far = setup.farUnits;
            camera.position.set((axes.rightX * runU) + (axes.normalX * eyeD), height, (axes.rightZ * runU) + (axes.normalZ * eyeD));
            camera.up.set(0, 1, 0);
            camera.lookAt((axes.rightX * runU) + (axes.normalX * planeU), height, (axes.rightZ * runU) + (axes.normalZ * planeU));
        }
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);
        return camera;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put the Drawing's Cut on the Section Adapter
    // ------------------------------------------------------------
    function Na__LeSnap__ApplyCut(definition) {
        const record = definition.Record;
        if (definition.Kind === Na__PlView__KIND_PLAN) {
            Na__DrawView__SectionAdapter__UpsertHorizontalPlane(Na__LeSnap__CUT_ID, Na__FpData__GetCutHeightMm(record), Na__FpData__GetViewDepthMm(record));
            Na__DrawView__SectionAdapter__SetActivePlane(Na__LeSnap__CUT_ID);
            return true;
        }
        if (!Na__ElevData__IsSection(record)) return false;
        const axes = Na__ElevData__GetAxes(record);
        Na__DrawView__SectionAdapter__UpsertVerticalPlane(Na__LeSnap__CUT_ID, axes.normalX, axes.normalZ, Na__ElevData__GetPlaneDistanceMm(record), Na__ElevData__GetViewDepthMm(record));
        Na__DrawView__SectionAdapter__SetActivePlane(Na__LeSnap__CUT_ID);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Register the Render Context
    // ------------------------------------------------------------
    function Na__LeSnap__Initialize(context) {
        if (!context || !context.renderer || !context.scene || !context.camera) return false;
        Na__LeSnap__Renderer    = context.renderer;
        Na__LeSnap__Scene       = context.scene;
        Na__LeSnap__Camera      = context.camera;
        Na__LeSnap__Controls    = context.controls || null;
        Na__LeSnap__PipelineRef = context.pipelineRef || null;
        Na__LeSnap__ModelRoot   = context.modelRoot || null;
        Na__LeSnap__ResetFingerprints();
        window.addEventListener('na-model-visibility-changed', Na__LeSnap__ResetFingerprints);   // <-- Toggles change what a drawing shows
        return true;
    }
    function Na__LeSnap__IsReady() { return !!Na__LeSnap__Renderer; }
    function Na__LeSnap__GetModelRoot() { return Na__LeSnap__ModelRoot; }
    // ------------------------------------------------------------


    // FUNCTION | Model Fingerprints, Computed Once and Held Until the Model Changes
    // ------------------------------------------------------------
    // Describing the model walks every mesh, so the viewports must not ask
    // for it on every refresh. The model one ignores category visibility
    // (a snapshot re-reads the scene's own layer map); the pipeline one is
    // exactly what the projection cache keys use.
    // ------------------------------------------------------------
    function Na__LeSnap__GetModelFingerprint() {
        if (Na__LeSnap__ModelFp === null) {
            const described = Na__PlStage__Describe(Na__LeSnap__ModelRoot);
            Na__LeSnap__ModelFp = Na__PlView__Hash(JSON.stringify(described.Categories.map((c) => [ c.name, c.tris ])));
        }
        return Na__LeSnap__ModelFp;
    }
    function Na__LeSnap__GetPipelineFingerprint() {
        if (Na__LeSnap__PipelineFp === null) Na__LeSnap__PipelineFp = Na__PlStage__Describe(Na__LeSnap__ModelRoot).Fingerprint;
        return Na__LeSnap__PipelineFp;
    }
    function Na__LeSnap__ResetFingerprints() {
        Na__LeSnap__ModelFp    = null;
        Na__LeSnap__PipelineFp = null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Where a Drawing's Content Is, in Drawing Millimetres
    // ------------------------------------------------------------
    // The author's saved framing when there is one, else the model's centre.
    // ------------------------------------------------------------
    function Na__LeSnap__DrawingCentreMm(definition) {
        const record = definition.Record;
        const box    = Na__LeSnap__ModelRoot ? new THREE.Box3().setFromObject(Na__LeSnap__ModelRoot) : null;
        const centre = (box && !box.isEmpty()) ? box.getCenter(new THREE.Vector3()) : null;
        if (definition.Kind === Na__PlView__KIND_PLAN) {
            const saved = Na__FpData__GetSavedView(record);
            if (saved.targetXMm !== null && saved.targetZMm !== null) return { x : saved.targetXMm, y : saved.targetZMm };
            return centre ? { x : Na__Math__ConvertUnitsToMm(centre.x), y : Na__Math__ConvertUnitsToMm(centre.z) } : { x : 0, y : 0 };
        }
        const saved = Na__ElevData__GetSavedView(record);
        if (saved.runMm !== null && saved.heightMm !== null) return { x : saved.runMm, y : -saved.heightMm };
        if (!centre) return { x : 0, y : 0 };
        const axes = Na__ElevData__GetAxes(record);
        const run  = (centre.x * axes.rightX) + (centre.z * axes.rightZ);
        return { x : Na__Math__ConvertUnitsToMm(run), y : -Na__Math__ConvertUnitsToMm(centre.y) };
    }
    // ------------------------------------------------------------


    // MODULE CONSTANTS | The Model Categories a Drawing Calls Context
    // ------------------------------------------------------------
    // Everything that is not the design itself: what the proposal stands in
    // and against. The proposal, its doors and the interior dressing are
    // never touched.
    // ------------------------------------------------------------
    const Na__LeSnap__CONTEXT_CATEGORIES = [
        'TrueVision__MainBuildingModel__Existing',
        'TrueVision__SiteBoundaries',
        'TrueVision__LandscapeEnvironment',
        'TrueVision__Vegetation',
        'TrueVision__SiteVegetation2D',
        'TrueVision__SceneEntourage2D',
        'TrueVision__SceneContextual'
    ];
    // ------------------------------------------------------------


    // HELPER FUNCTION | Take the Context Out of the Picture, or Leave It Alone
    // ------------------------------------------------------------
    // Returns the visibility map to put back afterwards, or null when the
    // style leaves the context in and nothing was touched.
    // ------------------------------------------------------------
    function Na__LeSnap__HideContext(styles) {
        if (!styles || styles.contextLayer !== false) return null;
        const saved = Na__ModelToggle__CaptureVisibilityMap();
        Na__LeSnap__CONTEXT_CATEGORIES.forEach((key) => Na__ModelToggle__SetCategoryVisibility(key, false));
        return saved;
    }
    // ------------------------------------------------------------


    // FUNCTION | Render a 2D Drawing Window Offscreen
    // ------------------------------------------------------------
    // Returns { dataUrl, widthPx, heightPx } (png), or null.
    // ------------------------------------------------------------
    function Na__LeSnap__Render2d(definition, windowMm, styles, widthPx, heightPx) {
        if (!Na__LeSnap__IsReady() || !definition) return Promise.resolve(null);
        return Na__LeSnap__Enqueue(async () => {
            const wasSuspended = Na__DrawView__Transitions__IsSuspended();
            const pipeline     = Na__LeSnap__Pipeline();
            const pass         = pipeline && pipeline.profileLinesPassRef ? pipeline.profileLinesPassRef : null;
            const passWasOn    = pass ? pass.enabled : null;                       // <-- The preset's exit forces it on; the 3D toggle owns it
            let cutApplied = false;
            let contextSaved = null;                                               // <-- Visibility to put back when the context was hidden
            try {
                Na__DrawView__SectionAdapter__SuspendLiveTool();
                cutApplied = Na__LeSnap__ApplyCut(definition);
                const camera = Na__LeSnap__FrameOrtho(definition, windowMm);
                if (!wasSuspended) Na__DrawView__Transitions__SuspendThreeD();     // <-- Distance culling off for the picture
                Na__DrawView__RenderPreset__Enter({ camera : camera, styles : styles || {} });
                Na__DrawView__MaterialPreset__Enter(styles || {});
                contextSaved = Na__LeSnap__HideContext(styles);
                Na__DrawView__SectionAdapter__ReapplyClipping();
                const result = await Na__StaticExport__RenderToCanvas({
                    renderer : Na__LeSnap__Renderer, scene : Na__LeSnap__Scene, camera : Na__LeSnap__Camera,
                    getRenderPipelineState : () => Na__LeSnap__Pipeline(),
                    elevationOverrides     : Na__DrawView__RenderPreset__GetExportOverrides(),
                    renderFrame            : (cam) => Na__DrawView__RenderPreset__RenderFrame(cam),   // <-- Flat render + silhouette + cut, the screen's exact order
                    targetWidth : Math.max(16, Math.round(widthPx)), targetHeight : Math.max(16, Math.round(heightPx))
                });
                if (styles && styles.enhanceWhitecard === true) await Na__LeEnhance__Apply(result.canvas);   // <-- Levels and sharpen: the whitecard greys go to paper white
                return { dataUrl : result.canvas.toDataURL('image/png'), widthPx : result.width, heightPx : result.height };
            } catch (renderError) {
                console.warn('[TrueVision3D LayoutEditor] 2D underlay render failed:', renderError);
                return null;
            } finally {
                if (contextSaved) Na__ModelToggle__ApplySceneLayerVisibility(contextSaved);
                Na__DrawView__MaterialPreset__Exit();
                Na__DrawView__RenderPreset__Exit();
                if (pass && passWasOn !== null) pass.enabled = passWasOn;
                if (cutApplied) Na__DrawView__SectionAdapter__RemovePlane(Na__LeSnap__CUT_ID);
                Na__DrawView__SectionAdapter__Release();
                if (!wasSuspended) Na__DrawView__Transitions__ResumeThreeD();
                Na__RenderLoop__RequestRender();
            }
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Render a Saved Scene Offscreen With the Viewport's Styles
    // ------------------------------------------------------------
    // Returns { canvas, widthPx, heightPx }, or null. The caller converts.
    // ------------------------------------------------------------
    function Na__LeSnap__Render3d(sceneRecord, styles, widthPx, heightPx) {
        if (!Na__LeSnap__IsReady() || !sceneRecord) return Promise.resolve(null);
        return Na__LeSnap__Enqueue(async () => {
            const camera   = Na__LeSnap__Camera;
            const controls = Na__LeSnap__Controls;
            const pipeline = Na__LeSnap__Pipeline();
            const pass     = pipeline && pipeline.profileLinesPassRef ? pipeline.profileLinesPassRef : null;
            const saved = {
                position   : camera.position.clone(),
                quaternion : camera.quaternion.clone(),
                fov        : camera.fov,
                zoom       : camera.zoom,
                target     : controls ? controls.target.clone() : null,
                visibility : Na__ModelToggle__CaptureVisibilityMap(),
                sections   : Na__SectSerialize__Serialize(),
                passOn     : pass ? pass.enabled : null
            };
            try {
                Na__PresentationMode__Camera__ApplySceneCameraState(camera, controls, sceneRecord);
                Na__DrawView__MaterialPreset__Enter(styles || {});
                Na__LeSnap__HideContext(styles);                                   // <-- The saved map above already puts it back
                if (pass) pass.enabled = !(styles && styles.profileLinework === false);
                const result = await Na__StaticExport__RenderToCanvas({
                    renderer : Na__LeSnap__Renderer, scene : Na__LeSnap__Scene, camera : camera,
                    getRenderPipelineState : () => Na__LeSnap__Pipeline(),
                    targetWidth : Math.max(16, Math.round(widthPx)), targetHeight : Math.max(16, Math.round(heightPx))
                });
                if (styles && styles.enhanceWhitecard === true) await Na__LeEnhance__Apply(result.canvas);
                return { canvas : result.canvas, widthPx : result.width, heightPx : result.height };
            } catch (renderError) {
                console.warn('[TrueVision3D LayoutEditor] 3D snapshot render failed:', renderError);
                return null;
            } finally {
                Na__DrawView__MaterialPreset__Exit();
                if (pass && saved.passOn !== null) pass.enabled = saved.passOn;
                camera.position.copy(saved.position);
                camera.quaternion.copy(saved.quaternion);
                camera.fov  = saved.fov;
                camera.zoom = saved.zoom;
                camera.updateProjectionMatrix();
                if (controls && saved.target) { controls.target.copy(saved.target); controls.update(); }
                Na__ModelToggle__ApplySceneLayerVisibility(saved.visibility);
                Na__SectSerialize__Apply(saved.sections);
                Na__RenderLoop__RequestRender();
            }
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Snapshot Renderer API
    // ------------------------------------------------------------
    export {
        Na__LeSnap__Initialize,
        Na__LeSnap__IsReady,
        Na__LeSnap__GetModelRoot,
        Na__LeSnap__GetModelFingerprint,
        Na__LeSnap__GetPipelineFingerprint,
        Na__LeSnap__ResetFingerprints,
        Na__LeSnap__DrawingCentreMm,
        Na__LeSnap__Render2d,
        Na__LeSnap__Render3d
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
