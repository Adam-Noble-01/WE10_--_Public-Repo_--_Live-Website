// =============================================================================
// TRUEVISION3D - PRESENTATION MODE - DEV MENU SCENE EDITOR
// =============================================================================
//
// FILE       : Na__PresentationMode__DevMenu__SceneEditor.js
// NAMESPACE  : Na__PresentationMode
// MODULE     : PresentationMode - Dev Menu Scene Editor
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Localhost-only scene editor inside the Dev Tools menu for
//              creating, editing, and saving Presentation Mode saved scenes
// CREATED    : 21-Jun-2026
//
// DESCRIPTION:
// - Gated behind Na__AppUtils__IsRunningOnLocalhost(); invisible on hosted builds.
// - Renders a scene list inside the static #naPmDevEditorPanel container.
// - Per-scene controls: Name, FOV slider with live lens-mm readout,
//   Transition Time slider, Update From Camera, Regenerate Thumbnail,
//   Save Scene, Delete Scene.
// - Per-scene reordering: drag the grip handle, or use the up/down arrows in
//   the row header, or type a position in Advanced. Order is rewritten as a
//   clean 1..N sequence after every move and saved immediately.
// - Per-scene Advanced section (collapsed by default): Position, Navigation
//   Mode, Easing, and layer-switch timing.
// - Global controls: Add New Scene From Camera, Export JSON, Save All To
//   Project, Clear All Scenes.
// - Saving writes the PresentationMode__SavedCameraScenes block straight to R2
//   (TrueVision__ProjectData__.json) via the na-truevision-api Worker, and
//   uploads thumbnail WebPs to R2 - no GitHub push required.
// - Carousel/layout refresh via re-dispatched 'na-presentation-mode-scenes-loaded'.
//
// INTEGRATION:
// - Called from Index.html after Na__UiFeature__InitializeLocalhostDevMenu.
// - Requires camera, controls, and showToast references from Index.html scope.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Jun-2026 - Version 1.0.0
// - Ported from ValeVision3D. Persistence rewired from localhost Flask to the
//   Cloudflare R2 API client (Na__CfApi__*).
//
// 27-Aug-2026 - Version 1.1.0
// - Added scene reordering: drag handle, up/down arrows, and a Position field.
//   Order is normalised to 1..N on every render and after every move.
// - Added a per-scene collapsible Advanced section and moved Position, Easing
//   and layer-switch timing into it alongside the new Navigation Mode toggles.
// - Added per-scene Navigation Mode (Orbit / Walk / Fly). Orbit is the
//   absent-key default. New scenes and Update Camera capture the live mode
//   automatically, storing nothing when that mode is orbit.
//   (The original release offered a fourth "Keep" option meaning "stay in
//   whatever mode the viewer is in". It was removed on 31-Aug-2026 - see the
//   dev log in Na__PresentationMode__Camera__SceneTransition.js.)
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Scene Data Helpers
    // ------------------------------------------------------------
    import {
        Na__PresentationMode__ProjectJson__GetActiveConfig,
        Na__PresentationMode__ProjectJson__SetActiveConfig
    } from './Na__PresentationMode__ProjectJson__SceneData.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Scene Group Data Layer
    // ------------------------------------------------------------
    // @delegate: ./Na__PresentationMode__SceneGroups__Data__.js
    // ------------------------------------------------------------
    import {
        Na__PresentationMode__SceneGroups__IsEnabled,
        Na__PresentationMode__SceneGroups__FormatViewCount,
        Na__PresentationMode__SceneGroups__GetDefaultGroups,
        Na__PresentationMode__SceneGroups__GetEnabledGroups,
        Na__PresentationMode__SceneGroups__GetFallbackGroupId,
        Na__PresentationMode__SceneGroups__GetActiveGroupId,
        Na__PresentationMode__SceneGroups__ResolveSceneGroupId,
        Na__PresentationMode__SceneGroups__SortScenesForPlayback,
        Na__PresentationMode__SceneGroups__NormaliseOrderWithinGroups
    } from './Na__PresentationMode__SceneGroups__Data__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Dev Menu Group Editor (rendered at the top of this panel)
    // ------------------------------------------------------------
    // One-directional: the group editor never imports this module. It mutates
    // the shared live config and raises GROUPS_CHANGED_EVENT, which this module
    // answers with the single normalise -> commit -> save-to-R2 path.
    // @delegate: ./Na__PresentationMode__DevMenu__GroupEditor__.js
    // ------------------------------------------------------------
    import {
        Na__PresentationMode__DevMenu__RenderGroupEditor,
        Na__PresentationMode__DevMenu__GetFallbackGroupName,
        Na__PresentationMode__DevMenu__GROUPS_CHANGED_EVENT
    } from './Na__PresentationMode__DevMenu__GroupEditor__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Camera Scene Transition (capture + build)
    // ------------------------------------------------------------
    import {
        Na__PresentationMode__Camera__BuildSceneCameraJson
    } from './Na__PresentationMode__Camera__SceneTransition.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Model Visibility State Capture (dolls-house scenes)
    // ------------------------------------------------------------
    import {
        Na__PmVisibility__CaptureState
    } from './Na__PresentationMode__Visibility__StateCapture.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Thumbnail Renderer
    // ------------------------------------------------------------
    import { Na__PresentationMode__Thumbnail__RenderCurrentViewportToWebp } from './Na__PresentationMode__Thumbnail__Renderer.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Project Utilities
    // ------------------------------------------------------------
    import {
        Na__AppUtils__IsRunningOnLocalhost,
        Na__AppUtils__GetProjectCodeFromUrl
    } from '../03__AppUtils/Na__AppUtils__ProjectLoader.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Cloudflare R2 API Client (realtime persistence)
    // ------------------------------------------------------------
    import {
        Na__CfApi__GetProjectContext,
        Na__CfApi__MergeAndSaveKeys,
        Na__CfApi__WriteThumbnailWebp
    } from '../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Render Loop Invalidation (FOV slider live preview)
    // ------------------------------------------------------------
    import { Na__RenderLoop__RequestRender } from '../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Navigation Mode Queries (per-scene mode authoring)
    // ------------------------------------------------------------
    import {
        Na__NavigationModes__GetActiveMode,
        Na__NavigationModes__IsModeAvailable
    } from '../10__NavigationAndCameras/Na__NavigationModes__Switcher.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Slider Ranges and Defaults
    // ------------------------------------------------------------
    const Na__PmDev__FOV_MIN              = 5;     // <-- Minimum FOV degrees
    const Na__PmDev__FOV_MAX              = 90;    // <-- Maximum FOV degrees
    const Na__PmDev__FOV_DEFAULT          = 30;    // <-- Default FOV when not set
    const Na__PmDev__TRANSITION_MIN_MS    = 300;   // <-- Minimum transition duration
    const Na__PmDev__TRANSITION_MAX_MS    = 8000;  // <-- Maximum transition duration
    const Na__PmDev__TRANSITION_DEFAULT   = 1800;  // <-- Default transition duration
    const Na__PmDev__SENSOR_HEIGHT_MM     = 24;    // <-- Full-frame sensor height (matches cameraLens AppConfig)
    const Na__PmDev__EASING_OPTIONS       = ['easeInOutCubic', 'easeInOutQuad', 'linear']; // <-- Available easing names
    const Na__PmDev__KEY__VISIBILITY_BEFORE_CAMERA = 'PresentationMode__Scene__ApplyVisibilityBeforeCamera'; // <-- Per-scene layer timing flag
    const Na__PmDev__KEY__NAVIGATION_MODE          = 'PresentationMode__Scene__NavigationMode';             // <-- Per-scene navigation mode
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Per-Scene Navigation Mode Options
    // ------------------------------------------------------------
    // 'orbit' is the absent-key state, so a scene that has never been given a
    // mode shows Orbit selected and stores nothing. There is deliberately no
    // 'Keep' option any more: it used to mean "stay in whatever mode you are
    // in", which stranded viewers in walk/fly after an interior scene and left
    // walk/fly fighting the camera transition for the whole flight.
    // @delegate: ./Na__PresentationMode__Camera__SceneTransition.js
    // ------------------------------------------------------------
    const Na__PmDev__NAV_MODE_OPTIONS = [
        { value : 'orbit', label : 'Orbit', title : 'Return to orbit for this scene (the default for any scene with no mode set)' },
        { value : 'walk',  label : 'Walk',  title : 'Enter walk mode at this scene position once the camera arrives' },
        { value : 'fly',   label : 'Fly',   title : 'Enter fly mode at this scene position once the camera arrives' }
    ];
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Editor Runtime References
    // ------------------------------------------------------------
    let Na__PmDev__Camera        = null;  // <-- Live camera reference from Index.html
    let Na__PmDev__Controls      = null;  // <-- Live controls reference
    let Na__PmDev__ShowToast     = null;  // <-- Toast notification helper
    let Na__PmDev__WorkingScenes = [];    // <-- Single shared editable scenes array (rows mutate these objects)
    // ------------------------------------------------------------


    // MODULE VARIABLES | Reorder and Panel UI State
    // ------------------------------------------------------------
    let Na__PmDev__DragSceneId       = null;         // <-- Scene id currently being dragged, null when idle
    const Na__PmDev__AdvancedOpenIds = new Set();    // <-- Scene ids whose Advanced section is expanded (survives re-render)
    const Na__PmDev__OpenGroupIds    = new Set();    // <-- Group ids whose scene list is unfolded; empty = all folded on open
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Lens Conversion Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Convert FOV Degrees to Focal Length MM
    // ------------------------------------------------------------
    function Na__PmDev__FovToFocalMm(fovDegrees) {
        const fovRad = (fovDegrees * Math.PI) / 180;
        return Na__PmDev__SENSOR_HEIGHT_MM / (2 * Math.tan(fovRad / 2)); // <-- Inverse tangent formula
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Working Data (in-memory editable copy)
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Deep Clone the Active Config's Scenes Array
    // ------------------------------------------------------------
    function Na__PmDev__GetWorkingScenes() {
        const config = Na__PresentationMode__ProjectJson__GetActiveConfig();
        if (!config) return [];
        const scenes = config.PresentationMode__SavedCameraScenes__Scenes;
        return Array.isArray(scenes) ? JSON.parse(JSON.stringify(scenes)) : []; // <-- Deep clone so edits don't corrupt live state
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build a Fresh Default Config Block (first scene added)
    // ------------------------------------------------------------
    // The Groups array is seeded from this system's own AppConfig defaults, so
    // a brand-new project starts with the four named groups present and only
    // the first switched on - which is what makes the selector bar stay hidden
    // until a second group is deliberately enabled.
    function Na__PmDev__BuildDefaultConfig(scenes) {
        return {
            PresentationMode__SavedCameraScenes__Description : 'Optional per-project saved camera scenes for Presentation Mode. Camera position and orbit target values are integer millimetres; rotations and FOV use the same format as Camera__DefaultPosition. Scenes are split into named Groups; Scene Order restarts at 1 within each group.',
            PresentationMode__SavedCameraScenes__Enabled                 : true,
            PresentationMode__SavedCameraScenes__DefaultSceneId          : scenes[0]?.PresentationMode__Scene__Id || null,
            PresentationMode__SavedCameraScenes__Groups                  : Na__PresentationMode__SceneGroups__GetDefaultGroups(),
            PresentationMode__SavedCameraScenes__Scenes                  : scenes
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Merge Working Scenes Back Into Active Config + Live Refresh
    // ------------------------------------------------------------
    function Na__PmDev__CommitWorkingScenes(updatedScenes) {
        let config = Na__PresentationMode__ProjectJson__GetActiveConfig();

        if (!config) {
            config = Na__PmDev__BuildDefaultConfig(updatedScenes);          // <-- First scene: create the section from scratch
        }

        config.PresentationMode__SavedCameraScenes__Scenes = updatedScenes;  // <-- Write back in-place

        // KEEP DEFAULT SCENE ID VALID
        const defaultId = config.PresentationMode__SavedCameraScenes__DefaultSceneId;
        const defaultStillExists = updatedScenes.some(s => s.PresentationMode__Scene__Id === defaultId);
        if (!defaultStillExists) {
            config.PresentationMode__SavedCameraScenes__DefaultSceneId = updatedScenes[0]?.PresentationMode__Scene__Id || null;
        }

        const ctx = Na__CfApi__GetProjectContext();
        Na__PresentationMode__ProjectJson__SetActiveConfig(config, ctx.projectFolder, ctx.yearCode); // <-- Re-register updated config

        // LIVE UI REFRESH | Re-dispatch the scenes event (or cleared event when empty)
        if (updatedScenes.length > 0) {
            window.dispatchEvent(new CustomEvent('na-presentation-mode-scenes-loaded', {
                detail : {
                    sceneConfig   : config,
                    projectFolder : ctx.projectFolder,
                    year          : ctx.yearCode,
                    skipCameraApply: true                                    // <-- Don't jump camera mid-edit
                }
            }));
        } else {
            window.dispatchEvent(new CustomEvent('na-presentation-mode-scenes-cleared')); // <-- Restore bottom-toolbar layout
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Scene Reordering
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Sort a Scenes Array Into Playback Order
    // ------------------------------------------------------------
    // Groups first, then Scene Order within each group, so the panel's row
    // sequence matches the carousel's exactly and array position stays a
    // meaningful thing to reorder against.
    // ------------------------------------------------------------
    function Na__PmDev__SortScenesByOrder(scenes) {
        const config = Na__PresentationMode__ProjectJson__GetActiveConfig();
        return Na__PresentationMode__SceneGroups__SortScenesForPlayback(scenes, config);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Rewrite Order Fields to a Clean 1..N Within Each Group
    // ------------------------------------------------------------
    // Scene Order restarts at 1 inside every group, so the carousel's per-group
    // strip reads 1..N and cross-group cycling walks (Group Order, Scene Order).
    // Also writes an explicit GroupId onto every scene, so what reaches the
    // project JSON is fully resolved rather than depending on the runtime
    // fallback. Tidies legacy projects that used sparse orders like 10/20/30.
    // ------------------------------------------------------------
    function Na__PmDev__NormaliseSceneOrder(scenes) {
        const config = Na__PresentationMode__ProjectJson__GetActiveConfig();
        return Na__PresentationMode__SceneGroups__NormaliseOrderWithinGroups(scenes, config);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Get the Contiguous Array Slice One Group Occupies
    // ------------------------------------------------------------
    // The working array is held in playback order, so a group's scenes always
    // sit in one unbroken run. Returns { start, end } inclusive, or null when
    // the project is ungrouped.
    // ------------------------------------------------------------
    function Na__PmDev__GetGroupSliceBounds(sceneId) {
        const config = Na__PresentationMode__ProjectJson__GetActiveConfig();
        if (!Na__PresentationMode__SceneGroups__IsEnabled()) return null;
        if (!Na__PresentationMode__SceneGroups__GetFallbackGroupId(config)) return null; // <-- Ungrouped project

        const scene = Na__PmDev__WorkingScenes.find(s => s.PresentationMode__Scene__Id === sceneId);
        if (!scene) return null;

        const groupId = Na__PresentationMode__SceneGroups__ResolveSceneGroupId(scene, config);
        const indices = Na__PmDev__WorkingScenes.reduce((acc, candidate, index) => {
            if (Na__PresentationMode__SceneGroups__ResolveSceneGroupId(candidate, config) === groupId) acc.push(index);
            return acc;
        }, []);

        if (indices.length === 0) return null;
        return { start : indices[0], end : indices[indices.length - 1] };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Move a Scene to a New Position in the Working Array
    // ------------------------------------------------------------
    // Movement is confined to the scene's own group. Reordering and regrouping
    // are deliberately separate controls: the arrows, the drag handle and the
    // Position field all reorder WITHIN a group, and the Group dropdown is the
    // one and only way to move a scene between groups. Letting a drag land in
    // a neighbouring group's run would be ambiguous at every boundary.
    // ------------------------------------------------------------
    function Na__PmDev__MoveSceneToIndex(sceneId, targetIndex) {
        const fromIndex = Na__PmDev__WorkingScenes.findIndex(s => s.PresentationMode__Scene__Id === sceneId);
        if (fromIndex === -1) return false;                                  // <-- Unknown scene

        const slice   = Na__PmDev__GetGroupSliceBounds(sceneId);
        const lowest  = slice ? slice.start : 0;
        const highest = slice ? slice.end   : Na__PmDev__WorkingScenes.length - 1;

        const bounded = Math.max(lowest, Math.min(targetIndex, highest));    // <-- Clamp inside the group's own run
        if (bounded === fromIndex) return false;                             // <-- Already in position, nothing to do

        const [moved] = Na__PmDev__WorkingScenes.splice(fromIndex, 1);       // <-- Lift the row out
        Na__PmDev__WorkingScenes.splice(bounded, 0, moved);                  // <-- Drop it back in at the target slot
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Persist a Reorder to the Live Config, the Panel and R2
    // ------------------------------------------------------------
    async function Na__PmDev__CommitReorder() {
        const ordered = Na__PmDev__NormaliseSceneOrder(Na__PmDev__WorkingScenes); // <-- Renumber before anything reads Order

        Na__PmDev__CommitWorkingScenes(ordered);                             // <-- Update config + refresh the carousel
        Na__PmDev__RenderEditorPanel();                                      // <-- Rebuild rows in the new order
        await Na__PmDev__SaveToR2(ordered);                                  // <-- Auto-persist, matching delete/save-one
    }
    // ------------------------------------------------------------


    // FUNCTION | Move a Scene Up or Down by One Position
    // ------------------------------------------------------------
    async function Na__PmDev__MoveSceneByOffset(sceneId, offset) {
        const fromIndex = Na__PmDev__WorkingScenes.findIndex(s => s.PresentationMode__Scene__Id === sceneId);
        if (fromIndex === -1) return;

        const targetIndex = fromIndex + offset;
        if (targetIndex < 0 || targetIndex > Na__PmDev__WorkingScenes.length - 1) return; // <-- Already at an end

        if (!Na__PmDev__MoveSceneToIndex(sceneId, targetIndex)) return;
        await Na__PmDev__CommitReorder();
    }
    // ------------------------------------------------------------


    // FUNCTION | Move a Scene to an Explicit 1-Based Position Within Its Group
    // ------------------------------------------------------------
    // The Position field counts from 1 inside the scene's own group, matching
    // the #N in the row header and the Order written to the project JSON, so it
    // is offset by where that group's run starts in the working array.
    // ------------------------------------------------------------
    async function Na__PmDev__MoveSceneToPosition(sceneId, position) {
        const slice       = Na__PmDev__GetGroupSliceBounds(sceneId);
        const groupOffset = slice ? slice.start : 0;                         // <-- Where this group's run begins
        if (!Na__PmDev__MoveSceneToIndex(sceneId, groupOffset + position - 1)) return; // <-- Convert to zero-based index
        await Na__PmDev__CommitReorder();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Do Two Scenes Resolve Into the Same Group?
    // ------------------------------------------------------------
    function Na__PmDev__AreScenesInSameGroup(sceneIdA, sceneIdB) {
        const config = Na__PresentationMode__ProjectJson__GetActiveConfig();
        if (!Na__PresentationMode__SceneGroups__IsEnabled()) return true;    // <-- Ungrouped: every row is a valid target
        if (!Na__PresentationMode__SceneGroups__GetFallbackGroupId(config)) return true;

        const sceneA = Na__PmDev__WorkingScenes.find(s => s.PresentationMode__Scene__Id === sceneIdA);
        const sceneB = Na__PmDev__WorkingScenes.find(s => s.PresentationMode__Scene__Id === sceneIdB);
        if (!sceneA || !sceneB) return false;

        return Na__PresentationMode__SceneGroups__ResolveSceneGroupId(sceneA, config)
            === Na__PresentationMode__SceneGroups__ResolveSceneGroupId(sceneB, config);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Clear Any Drop-Indicator Classes From a Row
    // ------------------------------------------------------------
    function Na__PmDev__ClearDropIndicators(row) {
        row.classList.remove('is-drop-before', 'is-drop-after');
    }
    // ------------------------------------------------------------


    // FUNCTION | Attach Drag-and-Drop Reorder Handlers to a Scene Row
    // ------------------------------------------------------------
    // The row is only draggable while the grip handle is held (see the header
    // builder), otherwise dragging a slider or selecting text in the name
    // field would start a drag instead.
    // ------------------------------------------------------------
    function Na__PmDev__AttachSceneRowDragHandlers(row) {
        const sceneId = row.dataset.sceneId;

        row.addEventListener('dragstart', (event) => {
            Na__PmDev__DragSceneId = sceneId;
            row.classList.add('is-dragging');
            if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', sceneId);          // <-- Firefox needs payload data to start a drag
            }
        });

        row.addEventListener('dragend', () => {
            Na__PmDev__DragSceneId = null;
            row.classList.remove('is-dragging');
            row.draggable = false;                                           // <-- Re-arm: handle must be grabbed again
            const panel = document.getElementById('naPmDevEditorPanel');
            if (panel) {
                panel.querySelectorAll('.na-pm-dev__scene-row')
                     .forEach(Na__PmDev__ClearDropIndicators);               // <-- Clear any stale indicator
            }
        });

        row.addEventListener('dragover', (event) => {
            if (!Na__PmDev__DragSceneId || Na__PmDev__DragSceneId === sceneId) return;
            if (!Na__PmDev__AreScenesInSameGroup(Na__PmDev__DragSceneId, sceneId)) return; // <-- No indicator across groups
            event.preventDefault();                                          // <-- Required to allow a drop
            if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';

            const bounds    = row.getBoundingClientRect();
            const placeAfter = (event.clientY - bounds.top) > (bounds.height / 2); // <-- Lower half = insert below
            row.classList.toggle('is-drop-before', !placeAfter);
            row.classList.toggle('is-drop-after',   placeAfter);
        });

        row.addEventListener('dragleave', () => Na__PmDev__ClearDropIndicators(row));

        row.addEventListener('drop', (event) => {
            if (!Na__PmDev__DragSceneId || Na__PmDev__DragSceneId === sceneId) return;
            event.preventDefault();

            const bounds     = row.getBoundingClientRect();
            const placeAfter = (event.clientY - bounds.top) > (bounds.height / 2);
            const draggedId  = Na__PmDev__DragSceneId;

            Na__PmDev__ClearDropIndicators(row);
            Na__PmDev__DragSceneId = null;

            Na__PmDev__HandleSceneDrop(draggedId, sceneId, placeAfter);      // <-- Reorder, renumber, save, rebuild
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Reorder via Drag and Drop Between Two Scene Rows
    // ------------------------------------------------------------
    async function Na__PmDev__HandleSceneDrop(dragSceneId, targetSceneId, placeAfter) {
        if (!dragSceneId || dragSceneId === targetSceneId) return;           // <-- Dropped on itself

        const fromIndex   = Na__PmDev__WorkingScenes.findIndex(s => s.PresentationMode__Scene__Id === dragSceneId);
        const targetIndex = Na__PmDev__WorkingScenes.findIndex(s => s.PresentationMode__Scene__Id === targetSceneId);
        if (fromIndex === -1 || targetIndex === -1) return;

        // GUARD | Dragging is a within-group reorder; use the Group dropdown to
        // move a scene between groups. Without this the clamp in
        // MoveSceneToIndex would silently pin the row to its own group edge,
        // which reads as a broken drag rather than a refused one.
        if (!Na__PmDev__AreScenesInSameGroup(dragSceneId, targetSceneId)) return;

        const insertAt   = placeAfter ? targetIndex + 1 : targetIndex;       // <-- Slot in the pre-move array
        const finalIndex = fromIndex < insertAt ? insertAt - 1 : insertAt;   // <-- Compensate for lifting the row out first

        if (!Na__PmDev__MoveSceneToIndex(dragSceneId, finalIndex)) return;
        await Na__PmDev__CommitReorder();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Scene Row DOM Builder
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the FOV Slider Row for a Scene
    // ------------------------------------------------------------
    function Na__PmDev__BuildFovRow(scene, onChange) {
        const currentFov  = (scene.PresentationMode__Scene__CameraPosition
            && scene.PresentationMode__Scene__CameraPosition.Camera__DefaultMisc
            && scene.PresentationMode__Scene__CameraPosition.Camera__DefaultMisc.Camera__DefaultMisc__Fov)
            || Na__PmDev__FOV_DEFAULT;

        const currentMm   = Math.round(Na__PmDev__FovToFocalMm(currentFov));

        const row = document.createElement('div');
        row.className = 'na-pm-dev__slider-row';

        const label = document.createElement('label');
        label.className   = 'na-pm-dev__label';
        label.textContent = 'FOV';

        const slider = document.createElement('input');
        slider.type  = 'range';
        slider.className = 'na-pm-dev__slider';
        slider.min   = Na__PmDev__FOV_MIN;
        slider.max   = Na__PmDev__FOV_MAX;
        slider.step  = '0.1';
        slider.value = currentFov.toFixed(1);

        const valueDisplay = document.createElement('span');
        valueDisplay.className   = 'na-pm-dev__value';
        valueDisplay.textContent = `${currentFov.toFixed(1)} deg / ${currentMm}mm`;

        slider.addEventListener('input', () => {
            const fov   = parseFloat(slider.value);
            const lenMm = Math.round(Na__PmDev__FovToFocalMm(fov));
            valueDisplay.textContent = `${fov.toFixed(1)} deg / ${lenMm}mm`; // <-- Live readout
            onChange(fov);
        });

        row.appendChild(label);
        row.appendChild(slider);
        row.appendChild(valueDisplay);
        return row;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Transition Time Slider Row
    // ------------------------------------------------------------
    function Na__PmDev__BuildTransitionRow(scene, onChange) {
        const currentMs = Number.isFinite(scene.PresentationMode__Scene__TransitionTimeToNextSceneMs)
            ? scene.PresentationMode__Scene__TransitionTimeToNextSceneMs
            : Na__PmDev__TRANSITION_DEFAULT;

        const row = document.createElement('div');
        row.className = 'na-pm-dev__slider-row';

        const label = document.createElement('label');
        label.className   = 'na-pm-dev__label';
        label.textContent = 'Move Speed';

        const slider = document.createElement('input');
        slider.type  = 'range';
        slider.className = 'na-pm-dev__slider';
        slider.min   = Na__PmDev__TRANSITION_MIN_MS;
        slider.max   = Na__PmDev__TRANSITION_MAX_MS;
        slider.step  = '100';
        slider.value = currentMs;

        const valueDisplay = document.createElement('span');
        valueDisplay.className   = 'na-pm-dev__value';
        valueDisplay.textContent = `${(currentMs / 1000).toFixed(1)}s`;

        slider.addEventListener('input', () => {
            const ms = parseInt(slider.value, 10);
            valueDisplay.textContent = `${(ms / 1000).toFixed(1)}s`;       // <-- Live seconds readout
            onChange(ms);
        });

        row.appendChild(label);
        row.appendChild(slider);
        row.appendChild(valueDisplay);
        return row;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Easing Dropdown Row
    // ------------------------------------------------------------
    function Na__PmDev__BuildEasingRow(scene, onChange) {
        const currentEasing = scene.PresentationMode__Scene__TransitionEasing || 'easeInOutCubic';

        const row = document.createElement('div');
        row.className = 'na-pm-dev__row';

        const label = document.createElement('label');
        label.className   = 'na-pm-dev__label';
        label.textContent = 'Easing';

        const select = document.createElement('select');
        select.className = 'na-pm-dev__select';

        Na__PmDev__EASING_OPTIONS.forEach((opt) => {
            const option  = document.createElement('option');
            option.value  = opt;
            option.text   = opt;
            option.selected = opt === currentEasing;
            select.appendChild(option);
        });

        select.addEventListener('change', () => onChange(select.value));

        row.appendChild(label);
        row.appendChild(select);
        return row;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Per-Scene Group Dropdown Row
    // ------------------------------------------------------------
    // Lists only ENABLED groups, which is what makes "a scene assigned to a
    // switched-off group" impossible to author rather than something the
    // viewer has to be protected from at runtime. A scene that has never been
    // assigned shows the group it currently falls back into, so the dropdown
    // always tells the truth about where the scene actually is.
    //
    // Returns null when the project has no groups, so an ungrouped project's
    // rows look exactly as they did before this feature existed.
    // ------------------------------------------------------------
    function Na__PmDev__BuildGroupRow(scene, onChange) {
        if (!Na__PresentationMode__SceneGroups__IsEnabled()) return null;

        const config = Na__PresentationMode__ProjectJson__GetActiveConfig();
        const groups = Na__PresentationMode__SceneGroups__GetEnabledGroups(config);
        if (groups.length === 0) return null;                                // <-- Ungrouped project

        const currentGroupId = Na__PresentationMode__SceneGroups__ResolveSceneGroupId(scene, config);

        const row = document.createElement('div');
        row.className = 'na-pm-dev__row';

        const label = document.createElement('label');
        label.className   = 'na-pm-dev__label';
        label.textContent = 'Group';

        const select = document.createElement('select');
        select.className = 'na-pm-dev__select';
        select.title     = 'Which group of the carousel this scene appears in';

        groups.forEach((group) => {
            const groupId  = group.PresentationMode__Group__Id;
            const option   = document.createElement('option');
            option.value   = groupId;
            option.text    = group.PresentationMode__Group__Name || groupId;
            option.selected = groupId === currentGroupId;
            select.appendChild(option);
        });

        select.addEventListener('change', () => onChange(select.value));

        row.appendChild(label);
        row.appendChild(select);
        return row;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Per-Scene Navigation Mode Toggle Row
    // ------------------------------------------------------------
    // Rendered as a segmented button group rather than a dropdown so the four
    // states read at a glance.  Modes the loaded model does not enable are
    // shown disabled rather than hidden, so the authoring UI stays stable
    // across projects and explains why a mode is unavailable.
    // ------------------------------------------------------------
    function Na__PmDev__BuildNavigationModeRow(scene, onChange) {
        const stored      = scene[Na__PmDev__KEY__NAVIGATION_MODE];
        const currentMode = (stored === 'walk' || stored === 'fly') ? stored : 'orbit'; // <-- Absent key, or legacy 'keep', reads as orbit

        const row = document.createElement('div');
        row.className = 'na-pm-dev__row';

        const label = document.createElement('label');
        label.className   = 'na-pm-dev__label';
        label.textContent = 'Nav Mode';

        const group = document.createElement('div');
        group.className = 'na-pm-dev__toggle-group';
        group.setAttribute('role', 'group');

        const buttons = [];

        Na__PmDev__NAV_MODE_OPTIONS.forEach((opt) => {
            const btn = document.createElement('button');
            btn.type        = 'button';
            btn.className   = 'na-pm-dev__toggle';
            btn.textContent = opt.label;
            btn.dataset.mode = opt.value;

            const isUnavailable = (opt.value === 'walk' || opt.value === 'fly')
                && !Na__NavigationModes__IsModeAvailable(opt.value);          // <-- Not enabled for this model

            if (isUnavailable) {
                btn.disabled = true;
                btn.title    = `${opt.label} mode is not enabled for this model.`;
                btn.classList.add('na-pm-dev__toggle--disabled');
            } else {
                btn.title = opt.title;
            }

            const isActive = opt.value === currentMode;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-pressed', String(isActive));

            btn.addEventListener('click', () => {
                buttons.forEach((other) => {
                    const nowActive = other === btn;
                    other.classList.toggle('is-active', nowActive);
                    other.setAttribute('aria-pressed', String(nowActive));
                });
                onChange(opt.value);
            });

            buttons.push(btn);
            group.appendChild(btn);
        });

        row.appendChild(label);
        row.appendChild(group);
        return row;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Layer-Timing Checkbox Row
    // ------------------------------------------------------------
    function Na__PmDev__BuildVisibilityTimingRow(scene, onChange) {
        const applyBefore = scene[Na__PmDev__KEY__VISIBILITY_BEFORE_CAMERA] === true; // <-- Default false = after move

        const row = document.createElement('div');
        row.className = 'na-pm-dev__row na-pm-dev__row--checkbox';

        const label = document.createElement('label');
        label.className   = 'na-pm-dev__checkbox-label';
        label.title       = 'When enabled, model layers switch before the camera move. Default (off): switch after the move completes.';

        const checkbox = document.createElement('input');
        checkbox.type      = 'checkbox';
        checkbox.className = 'na-pm-dev__checkbox';
        checkbox.checked   = applyBefore;

        const text = document.createElement('span');
        text.className   = 'na-pm-dev__checkbox-text';
        text.textContent = 'Switch layers before camera move';

        checkbox.addEventListener('change', () => {
            onChange(checkbox.checked === true);                             // <-- Persist per-scene timing preference
        });

        label.appendChild(checkbox);
        label.appendChild(text);
        row.appendChild(label);
        return row;
    }
    // ------------------------------------------------------------


    // FUNCTION | Build a Single Scene Editor Row
    // ------------------------------------------------------------
    function Na__PmDev__BuildSceneRow(scene, rowIndex, rowCount, onMutate) {
        const sceneId = scene.PresentationMode__Scene__Id;

        const wrapper = document.createElement('div');
        wrapper.className    = 'na-pm-dev__scene-row';
        wrapper.dataset.sceneId = sceneId;

        // SCENE HEADER | Drag Handle + Position Title + Move Up/Down
        const header = document.createElement('div');
        header.className = 'na-pm-dev__scene-header';

        // DRAG HANDLE | Only the handle arms dragging, so sliders stay usable
        const dragHandle = document.createElement('span');
        dragHandle.className   = 'na-pm-dev__drag-handle';
        dragHandle.textContent = '\u2261';                                  // <-- Grip glyph (identical-to sign)
        dragHandle.title       = 'Drag to reorder this scene';
        dragHandle.setAttribute('aria-hidden', 'true');
        dragHandle.addEventListener('mousedown', () => { wrapper.draggable = true;  });
        dragHandle.addEventListener('mouseup',   () => { wrapper.draggable = false; });
        header.appendChild(dragHandle);

        const titleEl = document.createElement('strong');
        titleEl.className   = 'na-pm-dev__scene-title';
        titleEl.textContent = `#${rowIndex + 1} - ${scene.PresentationMode__Scene__Name || sceneId}`;
        header.appendChild(titleEl);

        // MOVE UP / MOVE DOWN | Keyboard-reachable alternative to dragging
        const moveUpBtn = document.createElement('button');
        moveUpBtn.type        = 'button';
        moveUpBtn.className   = 'na-pm-dev__reorder-btn';
        moveUpBtn.textContent = '\u25B2';
        moveUpBtn.title       = 'Move this scene one position earlier';
        moveUpBtn.disabled    = rowIndex === 0;                             // <-- Already first
        moveUpBtn.addEventListener('click', () => Na__PmDev__MoveSceneByOffset(sceneId, -1));
        header.appendChild(moveUpBtn);

        const moveDownBtn = document.createElement('button');
        moveDownBtn.type        = 'button';
        moveDownBtn.className   = 'na-pm-dev__reorder-btn';
        moveDownBtn.textContent = '\u25BC';
        moveDownBtn.title       = 'Move this scene one position later';
        moveDownBtn.disabled    = rowIndex === rowCount - 1;                // <-- Already last
        moveDownBtn.addEventListener('click', () => Na__PmDev__MoveSceneByOffset(sceneId, 1));
        header.appendChild(moveDownBtn);

        wrapper.appendChild(header);

        // NAME INPUT
        const nameRow = document.createElement('div');
        nameRow.className = 'na-pm-dev__row';
        const nameLabel = document.createElement('label');
        nameLabel.textContent = 'Name';
        nameLabel.className = 'na-pm-dev__label';
        const nameInput = document.createElement('input');
        nameInput.type      = 'text';
        nameInput.className = 'na-pm-dev__input';
        nameInput.value     = scene.PresentationMode__Scene__Name || '';
        nameInput.addEventListener('input', () => {
            scene.PresentationMode__Scene__Name = nameInput.value;          // <-- Update working copy directly
            titleEl.textContent = `#${rowIndex + 1} - ${nameInput.value || sceneId}`;
        });
        nameRow.appendChild(nameLabel);
        nameRow.appendChild(nameInput);
        wrapper.appendChild(nameRow);

        // GROUP DROPDOWN | Sits in the main body, not Advanced: which group a
        // scene belongs to is a primary authoring decision on a large model,
        // and it is the only control that moves a scene between groups.
        const groupRow = Na__PmDev__BuildGroupRow(scene, (newGroupId) => {
            scene.PresentationMode__Scene__GroupId = newGroupId;             // <-- Explicit assignment
            onMutate('regroup', scene);                                      // <-- Renumbers both groups, persists, rebuilds
        });
        if (groupRow) wrapper.appendChild(groupRow);

        // FOV SLIDER
        wrapper.appendChild(Na__PmDev__BuildFovRow(scene, (newFov) => {
            if (!scene.PresentationMode__Scene__CameraPosition) {
                scene.PresentationMode__Scene__CameraPosition = {};
            }
            if (!scene.PresentationMode__Scene__CameraPosition.Camera__DefaultMisc) {
                scene.PresentationMode__Scene__CameraPosition.Camera__DefaultMisc = {};
            }
            scene.PresentationMode__Scene__CameraPosition.Camera__DefaultMisc.Camera__DefaultMisc__Fov = newFov;
            scene.PresentationMode__Scene__LensMm = Math.round(Na__PmDev__FovToFocalMm(newFov)); // <-- Keep lens mm in sync
            if (Na__PmDev__Camera) {
                Na__PmDev__Camera.fov = newFov;
                Na__PmDev__Camera.updateProjectionMatrix();                 // <-- Live preview in viewport
                Na__RenderLoop__RequestRender();                            // <-- Redraw frame so FOV change is visible
            }
        }));

        // TRANSITION TIME SLIDER
        wrapper.appendChild(Na__PmDev__BuildTransitionRow(scene, (newMs) => {
            scene.PresentationMode__Scene__TransitionTimeToNextSceneMs = newMs;
        }));

        // ADVANCED SECTION | Collapsed by default to keep each row readable
        // ------------------------------------------------------------
        // Holds the settings that are set once and rarely revisited: exact
        // position, navigation mode, easing curve and layer-switch timing.
        // Open/closed state is remembered across panel rebuilds so a reorder
        // or a save does not collapse the section the user is working in.
        // ------------------------------------------------------------
        const advanced = document.createElement('div');
        advanced.className = 'na-pm-dev__advanced';

        const advancedToggle = document.createElement('button');
        advancedToggle.type      = 'button';
        advancedToggle.className = 'na-pm-dev__advanced-toggle';

        const advancedBody = document.createElement('div');
        advancedBody.className = 'na-pm-dev__advanced-body';

        const isAdvancedOpen = Na__PmDev__AdvancedOpenIds.has(sceneId);
        advancedBody.classList.toggle('is-open', isAdvancedOpen);
        advancedToggle.setAttribute('aria-expanded', String(isAdvancedOpen));
        advancedToggle.innerHTML = `Advanced <span class="na-pm-dev__advanced-arrow">&#9662;</span>`;

        advancedToggle.addEventListener('click', () => {
            const willOpen = !advancedBody.classList.contains('is-open');
            advancedBody.classList.toggle('is-open', willOpen);
            advancedToggle.setAttribute('aria-expanded', String(willOpen));
            if (willOpen) {
                Na__PmDev__AdvancedOpenIds.add(sceneId);                    // <-- Remember across rebuilds
            } else {
                Na__PmDev__AdvancedOpenIds.delete(sceneId);
            }
        });

        // POSITION INPUT | Type an exact slot for long scene lists
        const orderRow = document.createElement('div');
        orderRow.className = 'na-pm-dev__row';
        const orderLabel = document.createElement('label');
        orderLabel.textContent = 'Position';
        orderLabel.className = 'na-pm-dev__label';
        const orderInput = document.createElement('input');
        orderInput.type      = 'number';
        orderInput.className = 'na-pm-dev__input na-pm-dev__input--short';
        orderInput.min       = 1;
        orderInput.max       = rowCount;
        orderInput.value     = rowIndex + 1;                                // <-- Always the visible #N, never a stale sparse Order
        orderInput.title     = 'Type a position to move this scene there';
        orderInput.addEventListener('change', () => {
            const requested = parseInt(orderInput.value, 10);
            if (!Number.isFinite(requested)) {
                orderInput.value = rowIndex + 1;                            // <-- Reject junk, restore displayed position
                return;
            }
            const clamped = Math.max(1, Math.min(requested, rowCount));
            if (clamped === rowIndex + 1) {
                orderInput.value = clamped;                                 // <-- No move needed, just tidy the field
                return;
            }
            Na__PmDev__MoveSceneToPosition(sceneId, clamped);               // <-- Reorder, renumber, save, rebuild
        });
        orderRow.appendChild(orderLabel);
        orderRow.appendChild(orderInput);
        advancedBody.appendChild(orderRow);

        // NAVIGATION MODE TOGGLES
        advancedBody.appendChild(Na__PmDev__BuildNavigationModeRow(scene, (newMode) => {
            if (newMode === 'orbit') {
                delete scene[Na__PmDev__KEY__NAVIGATION_MODE];              // <-- Omit key when orbit; absent already means orbit
            } else {
                scene[Na__PmDev__KEY__NAVIGATION_MODE] = newMode;
            }
        }));

        // EASING DROPDOWN
        advancedBody.appendChild(Na__PmDev__BuildEasingRow(scene, (newEasing) => {
            scene.PresentationMode__Scene__TransitionEasing = newEasing;
        }));

        // LAYER TIMING TOGGLE (before vs after camera move)
        advancedBody.appendChild(Na__PmDev__BuildVisibilityTimingRow(scene, (applyBefore) => {
            if (applyBefore) {
                scene[Na__PmDev__KEY__VISIBILITY_BEFORE_CAMERA] = true;     // <-- Switch layers at transition start
            } else {
                delete scene[Na__PmDev__KEY__VISIBILITY_BEFORE_CAMERA];    // <-- Omit key when default (after move)
            }
        }));

        advanced.appendChild(advancedToggle);
        advanced.appendChild(advancedBody);
        wrapper.appendChild(advanced);

        // ACTION BUTTONS ROW
        const actionsRow = document.createElement('div');
        actionsRow.className = 'na-pm-dev__actions';

        // UPDATE FROM CAMERA
        const updateBtn = document.createElement('button');
        updateBtn.type        = 'button';
        updateBtn.className   = 'na-pm-dev__btn';
        updateBtn.textContent = 'Update Camera';
        updateBtn.title       = 'Overwrite this scene with the current camera position/rotation/FOV';
        updateBtn.addEventListener('click', () => {
            if (!Na__PmDev__Camera) return;
            const built = Na__PresentationMode__Camera__BuildSceneCameraJson(Na__PmDev__Camera, Na__PmDev__Controls);
            if (!built) return;
            scene.PresentationMode__Scene__CameraPosition = { ...built.cameraPosition };
            scene.PresentationMode__Scene__OrbitHelperCubePosition = { ...built.orbitHelperCubePosition };
            const visibility = Na__PmVisibility__CaptureState();            // <-- Capture live model element on/off state
            if (visibility) scene.PresentationMode__Scene__Visibility = visibility;

            const liveMode = Na__NavigationModes__GetActiveMode();          // <-- Recapture the mode the view was framed in
            if (liveMode === 'walk' || liveMode === 'fly') {
                scene[Na__PmDev__KEY__NAVIGATION_MODE] = liveMode;
            } else {
                delete scene[Na__PmDev__KEY__NAVIGATION_MODE];              // <-- Orbit is the absent-key default; keep the JSON clean
            }

            onMutate('save-one', scene);                                    // <-- Commit + persist; commit re-renders the panel
        });
        actionsRow.appendChild(updateBtn);

        // THUMBNAIL
        const thumbBtn = document.createElement('button');
        thumbBtn.type        = 'button';
        thumbBtn.className   = 'na-pm-dev__btn';
        thumbBtn.textContent = 'Regen Thumb';
        thumbBtn.title       = 'Render the current viewport as a WebP thumbnail for this scene';
        thumbBtn.addEventListener('click', async () => {
            await Na__PmDev__RegenerateThumbnail(scene);                    // <-- Render + upload WebP to R2
            onMutate('save-one', scene);                                    // <-- Persist updated ThumbnailUrl + refresh carousel
        });
        actionsRow.appendChild(thumbBtn);

        // SAVE THIS SCENE
        const saveBtn = document.createElement('button');
        saveBtn.type        = 'button';
        saveBtn.className   = 'na-pm-dev__btn na-pm-dev__btn--primary';
        saveBtn.textContent = 'Save Scene';
        saveBtn.addEventListener('click', () => onMutate('save-one', scene));
        actionsRow.appendChild(saveBtn);

        // DELETE
        const deleteBtn = document.createElement('button');
        deleteBtn.type        = 'button';
        deleteBtn.className   = 'na-pm-dev__btn na-pm-dev__btn--danger';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => onMutate('delete', scene));
        actionsRow.appendChild(deleteBtn);

        wrapper.appendChild(actionsRow);
        return wrapper;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Thumbnail Regeneration (R2 upload)
// -----------------------------------------------------------------------------

    // FUNCTION | Render Viewport WebP and Upload to R2 via the API Client
    // ------------------------------------------------------------
    async function Na__PmDev__RegenerateThumbnail(scene) {
        const sceneId = scene.PresentationMode__Scene__Id;

        try {
            const blob = await Na__PresentationMode__Thumbnail__RenderCurrentViewportToWebp(); // <-- Render Three.js viewport
            if (!blob) {
                if (Na__PmDev__ShowToast) Na__PmDev__ShowToast('Thumbnail render failed.', true);
                return;
            }

            const result = await Na__CfApi__WriteThumbnailWebp(sceneId, blob); // <-- Upload to R2
            if (result.ok) {
                scene.PresentationMode__Scene__ThumbnailUrl = result.relUrl;  // <-- Store project-relative path
                if (Na__PmDev__ShowToast) Na__PmDev__ShowToast(`Thumbnail saved to R2: ${result.relUrl}`);
            } else {
                if (Na__PmDev__ShowToast) Na__PmDev__ShowToast(`Thumbnail upload failed: ${result.error}`, true);
            }
        } catch (error) {
            console.error('[TrueVision3D] Thumbnail regeneration error:', error);
            if (Na__PmDev__ShowToast) Na__PmDev__ShowToast('Thumbnail error - see console.', true);
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | R2 Save (read-merge-write)
// -----------------------------------------------------------------------------

    // FUNCTION | Save the PresentationMode Block to R2 (TrueVision__ProjectData__.json)
    // ------------------------------------------------------------
    async function Na__PmDev__SaveToR2(updatedScenes) {
        const ctx = Na__CfApi__GetProjectContext();
        if (!ctx.projectFolder) {
            if (Na__PmDev__ShowToast) Na__PmDev__ShowToast('No project loaded.', true);
            return false;
        }

        let config = Na__PresentationMode__ProjectJson__GetActiveConfig();
        if (config) {
            config.PresentationMode__SavedCameraScenes__Scenes = updatedScenes; // <-- Ensure latest scenes
        } else {
            config = Na__PmDev__BuildDefaultConfig(updatedScenes);
        }

        const result = await Na__CfApi__MergeAndSaveKeys({
            PresentationMode__SavedCameraScenes : config                    // <-- Merge block at document root, write to R2
        });

        if (result.ok) {
            if (Na__PmDev__ShowToast) Na__PmDev__ShowToast(`Presentation scenes saved to R2 (${ctx.projectFolder}).`);
            return true;
        }

        if (Na__PmDev__ShowToast) Na__PmDev__ShowToast(`Save failed: ${result.error}`, true);
        return false;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Editor Panel Render
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build a Collapsible Group Heading for the Scene List
    // ------------------------------------------------------------
    // The heading is the fold control for its group. Groups start folded, so
    // the panel opens as a short list of group names rather than every scene on
    // the project expanded at once - on a model with twenty-plus views the
    // unfolded panel was unusable to navigate.
    // ------------------------------------------------------------
    function Na__PmDev__BuildGroupHeading(groupName, sceneCount, isOpen) {
        const heading = document.createElement('button');
        heading.type      = 'button';
        heading.className = 'na-pm-dev__group-heading';
        heading.setAttribute('aria-expanded', String(isOpen));

        const arrow = document.createElement('span');
        arrow.className = 'na-pm-dev__group-heading-arrow';
        arrow.innerHTML = '&#9662;';                                          // <-- Rotates via CSS on aria-expanded
        arrow.setAttribute('aria-hidden', 'true');
        heading.appendChild(arrow);

        const nameEl = document.createElement('span');
        nameEl.className   = 'na-pm-dev__group-heading-name';
        nameEl.textContent = groupName;
        heading.appendChild(nameEl);

        const countEl = document.createElement('span');
        countEl.className   = 'na-pm-dev__group-heading-count';
        countEl.textContent = Na__PresentationMode__SceneGroups__FormatViewCount(sceneCount);
        heading.appendChild(countEl);

        return heading;
    }
    // ------------------------------------------------------------


    // FUNCTION | Render the Scene Rows, Clustered Under Their Group Headings
    // ------------------------------------------------------------
    // The displayed #N is the scene's position WITHIN its group, matching the
    // per-group Order that is written to the project JSON and the position the
    // carousel shows. Reorder arrows disable at each group's own edges, since
    // reordering never crosses a group boundary.
    //
    // An ungrouped project falls through to one flat, unheaded list numbered
    // 1..N, exactly as the panel looked before this feature existed.
    // ------------------------------------------------------------
    function Na__PmDev__RenderSceneRowsGroupedByGroup(panel, onMutate) {
        const config = Na__PresentationMode__ProjectJson__GetActiveConfig();
        const groups = Na__PresentationMode__SceneGroups__IsEnabled()
            ? Na__PresentationMode__SceneGroups__GetEnabledGroups(config)
            : [];

        const appendRow = (container, scene, indexInGroup, countInGroup) => {
            const row = Na__PmDev__BuildSceneRow(scene, indexInGroup, countInGroup, onMutate);
            Na__PmDev__AttachSceneRowDragHandlers(row);                      // <-- Drag-to-reorder wiring
            container.appendChild(row);
        };

        // UNGROUPED PROJECT | One flat list, legacy behaviour
        if (groups.length === 0) {
            const rowCount = Na__PmDev__WorkingScenes.length;
            Na__PmDev__WorkingScenes.forEach((scene, index) => appendRow(panel, scene, index, rowCount));
            return;
        }

        // GROUPED PROJECT | A fold-down heading, then that group's own run of rows
        groups.forEach((group) => {
            const groupId = group.PresentationMode__Group__Id;
            const inGroup = Na__PmDev__WorkingScenes.filter(scene =>
                Na__PresentationMode__SceneGroups__ResolveSceneGroupId(scene, config) === groupId
            );

            const isOpen  = Na__PmDev__OpenGroupIds.has(groupId);            // <-- Folded unless the author opened it
            const heading = Na__PmDev__BuildGroupHeading(
                group.PresentationMode__Group__Name || groupId,
                inGroup.length,
                isOpen
            );

            const body = document.createElement('div');
            body.className = 'na-pm-dev__group-scenes';
            body.classList.toggle('is-open', isOpen);

            heading.addEventListener('click', () => {
                const willOpen = !body.classList.contains('is-open');
                body.classList.toggle('is-open', willOpen);
                heading.setAttribute('aria-expanded', String(willOpen));
                if (willOpen) {
                    Na__PmDev__OpenGroupIds.add(groupId);                    // <-- Survives the rebuild after a reorder or save
                } else {
                    Na__PmDev__OpenGroupIds.delete(groupId);
                }
            });

            panel.appendChild(heading);
            inGroup.forEach((scene, index) => appendRow(body, scene, index, inGroup.length));
            panel.appendChild(body);
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Rebuild the Entire Scene Editor Panel
    // ------------------------------------------------------------
    function Na__PmDev__RenderEditorPanel() {
        const panel = document.getElementById('naPmDevEditorPanel');
        if (!panel) return;

        panel.innerHTML = '';                                                // <-- Clear and rebuild

        // SCENE GROUPS SECTION | Collapsible, at the very top of this panel
        // ------------------------------------------------------------
        // The group editor owns everything inside this container. It mutates
        // the shared live config and raises its changed event, which this
        // module answers below with the one normalise -> commit -> save path.
        // @delegate: ./Na__PresentationMode__DevMenu__GroupEditor__.js
        // ------------------------------------------------------------
        const groupContainer = document.createElement('div');
        groupContainer.className = 'na-pm-dev__group-container';
        panel.appendChild(groupContainer);
        Na__PresentationMode__DevMenu__RenderGroupEditor(groupContainer, Na__PmDev__ShowToast);

        // SORT ONCE INTO THE WORKING ARRAY so array index == displayed position.
        // Every reorder operation below works on array position, so the array
        // and the panel must agree before any row is built. The sort is
        // group-aware, so a group's scenes always form one unbroken run.
        Na__PmDev__WorkingScenes = Na__PmDev__SortScenesByOrder(Na__PmDev__GetWorkingScenes());
        Na__PmDev__NormaliseSceneOrder(Na__PmDev__WorkingScenes);            // <-- Collapse to a clean 1..N inside each group

        // ONE MUTATION HANDLER shared by every row
        const Na__PmDev__HandleRowMutation = async (action, targetScene) => {
            if (action === 'delete') {
                const ok = window.confirm(`Delete scene "${targetScene.PresentationMode__Scene__Name}"?`);
                if (!ok) return;
                Na__PmDev__WorkingScenes = Na__PmDev__WorkingScenes.filter(
                    s => s.PresentationMode__Scene__Id !== targetScene.PresentationMode__Scene__Id
                );
                Na__PmDev__NormaliseSceneOrder(Na__PmDev__WorkingScenes);    // <-- Close the gap left by the deleted scene
                Na__PmDev__CommitWorkingScenes(Na__PmDev__WorkingScenes);
                await Na__PmDev__SaveToR2(Na__PmDev__WorkingScenes);
                Na__PmDev__RenderEditorPanel();                              // <-- Rebuild panel after delete
            } else if (action === 'regroup') {
                Na__PmDev__NormaliseSceneOrder(Na__PmDev__WorkingScenes);    // <-- Renumbers the group it left AND the one it joined
                Na__PmDev__CommitWorkingScenes(Na__PmDev__WorkingScenes);
                await Na__PmDev__SaveToR2(Na__PmDev__WorkingScenes);
                Na__PmDev__RenderEditorPanel();                              // <-- Row physically moves to its new group's block
            } else if (action === 'save-one') {
                Na__PmDev__CommitWorkingScenes(Na__PmDev__WorkingScenes);
                await Na__PmDev__SaveToR2(Na__PmDev__WorkingScenes);
            }
        };

        if (Na__PmDev__WorkingScenes.length === 0) {
            const empty = document.createElement('p');
            empty.className   = 'na-pm-dev__empty';
            empty.textContent = 'No scenes defined. Add a scene below.';
            panel.appendChild(empty);
        } else {
            Na__PmDev__RenderSceneRowsGroupedByGroup(panel, Na__PmDev__HandleRowMutation);
        }

        // GLOBAL ACTION BUTTONS
        const globalActions = document.createElement('div');
        globalActions.className = 'na-pm-dev__global-actions';

        // ADD NEW SCENE
        const addBtn = document.createElement('button');
        addBtn.type        = 'button';
        addBtn.className   = 'na-pm-dev__btn na-pm-dev__btn--primary';
        addBtn.textContent = '+ Add Scene From Camera';
        addBtn.addEventListener('click', () => Na__PmDev__AddSceneFromCamera());
        globalActions.appendChild(addBtn);

        // SAVE ALL
        const saveAllBtn = document.createElement('button');
        saveAllBtn.type        = 'button';
        saveAllBtn.className   = 'na-pm-dev__btn';
        saveAllBtn.textContent = 'Save All To Project';
        saveAllBtn.addEventListener('click', async () => {
            Na__PmDev__CommitWorkingScenes(Na__PmDev__WorkingScenes);       // <-- Include all in-row edits + refresh UI
            await Na__PmDev__SaveToR2(Na__PmDev__WorkingScenes);
        });
        globalActions.appendChild(saveAllBtn);

        // EXPORT JSON
        const exportBtn = document.createElement('button');
        exportBtn.type        = 'button';
        exportBtn.className   = 'na-pm-dev__btn';
        exportBtn.textContent = 'Export JSON';
        exportBtn.addEventListener('click', () => Na__PmDev__ExportJson());
        globalActions.appendChild(exportBtn);

        // CLEAR ALL
        const clearBtn = document.createElement('button');
        clearBtn.type        = 'button';
        clearBtn.className   = 'na-pm-dev__btn na-pm-dev__btn--danger';
        clearBtn.textContent = 'Clear All Scenes';
        clearBtn.addEventListener('click', () => Na__PmDev__ClearAllScenes());
        globalActions.appendChild(clearBtn);

        panel.appendChild(globalActions);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Scene Mutations
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Generate Next Unique Scene Id
    // ------------------------------------------------------------
    function Na__PmDev__GetNextSceneId(existingScenes) {
        const usedIds = new Set(existingScenes.map(s => s.PresentationMode__Scene__Id));
        let n = existingScenes.length + 1;
        let candidate = `Scene_${String(n).padStart(3, '0')}`;
        while (usedIds.has(candidate)) {                                    // <-- Avoid collisions after deletes
            n++;
            candidate = `Scene_${String(n).padStart(3, '0')}`;
        }
        return candidate;
    }
    // ------------------------------------------------------------


    // FUNCTION | Add a New Scene From the Current Camera Position
    // ------------------------------------------------------------
    async function Na__PmDev__AddSceneFromCamera() {
        if (!Na__PmDev__Camera) return;

        const existing   = Na__PmDev__WorkingScenes;                        // <-- Shared array (preserves in-row edits)
        const sceneId    = Na__PmDev__GetNextSceneId(existing);             // <-- Auto Scene_001, Scene_002 ...
        const nextNum    = existing.length + 1;
        const maxOrder   = existing.reduce((max, s) => Math.max(max, s.PresentationMode__Scene__Order ?? 0), 0);

        const built      = Na__PresentationMode__Camera__BuildSceneCameraJson(Na__PmDev__Camera, Na__PmDev__Controls);
        if (!built) return;

        const currentFov = parseFloat(Na__PmDev__Camera.fov.toFixed(4));
        const lensMm     = Math.round(Na__PmDev__FovToFocalMm(currentFov));

        const newScene   = {
            PresentationMode__Scene__Id                    : sceneId,
            PresentationMode__Scene__Name                  : `Scene ${nextNum}`,
            PresentationMode__Scene__Order                 : maxOrder + 1,
            PresentationMode__Scene__ThumbnailUrl          : `PresentationMode/Thumbnails/${sceneId}.webp`,
            PresentationMode__Scene__LensMm                : lensMm,
            PresentationMode__Scene__TransitionTimeToNextSceneMs : Na__PmDev__TRANSITION_DEFAULT,
            PresentationMode__Scene__TransitionEasing      : 'easeInOutCubic',
            PresentationMode__Scene__CameraPosition        : built.cameraPosition,
            PresentationMode__Scene__OrbitHelperCubePosition: built.orbitHelperCubePosition
        };

        // GROUP | A new scene joins the group the carousel is currently showing
        // ------------------------------------------------------------
        // You frame a kitchen view while browsing Interior 3D Views and that is
        // where it lands, rather than dropping into Exterior and needing to be
        // moved. Falls back to the first enabled group when nothing is active.
        // ------------------------------------------------------------
        const Na__ActiveConfig  = Na__PresentationMode__ProjectJson__GetActiveConfig();
        const Na__NewSceneGroup = Na__PresentationMode__SceneGroups__GetActiveGroupId()
            || Na__PresentationMode__SceneGroups__GetFallbackGroupId(Na__ActiveConfig);
        if (Na__NewSceneGroup) newScene.PresentationMode__Scene__GroupId = Na__NewSceneGroup;

        const newSceneVisibility = Na__PmVisibility__CaptureState();        // <-- Capture model element on/off state at creation
        if (newSceneVisibility) newScene.PresentationMode__Scene__Visibility = newSceneVisibility;

        const liveNavMode = Na__NavigationModes__GetActiveMode();           // <-- A scene framed in walk mode is a walk scene
        if (liveNavMode === 'walk' || liveNavMode === 'fly') {
            newScene[Na__PmDev__KEY__NAVIGATION_MODE] = liveNavMode;        // <-- Orbit is the absent-key default, so it stores nothing
        }

        // RENDER + UPLOAD THUMBNAIL FIRST so the carousel card has an image
        await Na__PmDev__RegenerateThumbnail(newScene);                     // <-- Sets ThumbnailUrl on success

        Na__PmDev__WorkingScenes = [...existing, newScene];                 // <-- Append to shared array
        Na__PmDev__NormaliseSceneOrder(Na__PmDev__WorkingScenes);           // <-- Give it a correct 1..N slot inside ITS group
        Na__PmDev__CommitWorkingScenes(Na__PmDev__WorkingScenes);          // <-- Updates config + live UI refresh

        const saved = await Na__PmDev__SaveToR2(Na__PmDev__WorkingScenes); // <-- Auto-persist to R2
        Na__PmDev__RenderEditorPanel();                                     // <-- Rebuild panel to show new row

        if (saved && Na__PmDev__ShowToast) {
            Na__PmDev__ShowToast(`Scene "${newScene.PresentationMode__Scene__Name}" added and saved to R2.`);
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Export PresentationMode JSON Block as Download
    // ------------------------------------------------------------
    function Na__PmDev__ExportJson() {
        const config = Na__PresentationMode__ProjectJson__GetActiveConfig();
        if (!config) return;

        const projectCode = Na__AppUtils__GetProjectCodeFromUrl() || 'export';
        const jsonStr = JSON.stringify({ PresentationMode__SavedCameraScenes: config }, null, 4);
        const blob    = new Blob([jsonStr], { type: 'application/json' });
        const a       = document.createElement('a');
        a.href        = URL.createObjectURL(blob);
        a.download    = `PresentationMode__SavedCameraScenes__${projectCode}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    }
    // ------------------------------------------------------------


    // FUNCTION | Clear All Presentation Scenes with Confirmation
    // ------------------------------------------------------------
    async function Na__PmDev__ClearAllScenes() {
        const ok = window.confirm('This will delete all Presentation Mode scenes from this project. Continue?');
        if (!ok) return;

        Na__PmDev__WorkingScenes = [];                                       // <-- Empty the shared array
        Na__PmDev__CommitWorkingScenes(Na__PmDev__WorkingScenes);
        await Na__PmDev__SaveToR2(Na__PmDev__WorkingScenes);
        Na__PmDev__RenderEditorPanel();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Localhost-Only Presentation Mode Scene Editor
    // ------------------------------------------------------------
    function Na__PresentationMode__DevMenu__InitializeSceneEditor(camera, controls, showToast) {
        if (!Na__AppUtils__IsRunningOnLocalhost()) return;                   // <-- Production guard: never shown hosted

        Na__PmDev__Camera    = camera;
        Na__PmDev__Controls  = controls;
        Na__PmDev__ShowToast = showToast;

        const menuItem  = document.getElementById('naPmDevEditorItem');     // <-- Dev menu wrapper li
        const toggleBtn = document.getElementById('naPmDevEditorToggle');   // <-- Open/close button
        const panel     = document.getElementById('naPmDevEditorPanel');    // <-- Content container

        if (!menuItem || !toggleBtn || !panel) return;

        menuItem.style.display = '';                                         // <-- Reveal the dev section

        toggleBtn.addEventListener('click', () => {
            const isOpen = panel.classList.contains('is-open');
            panel.classList.toggle('is-open', !isOpen);
            toggleBtn.setAttribute('aria-expanded', String(!isOpen));

            if (!isOpen) {
                Na__PmDev__RenderEditorPanel();                            // <-- Rebuild on each open so data is fresh
            }
        });

        // RE-RENDER WHEN SCENES LOAD (project switch during same session)
        window.addEventListener('na-presentation-mode-scenes-loaded', () => {
            if (panel.classList.contains('is-open')) {
                Na__PmDev__RenderEditorPanel();                            // <-- Refresh if panel already open
            }
        });

        // PERSIST WHEN THE GROUP EDITOR CHANGES SOMETHING
        // ------------------------------------------------------------
        // The group editor mutates the shared live config and raises this
        // event rather than saving for itself. Groups and scenes live in the
        // same project JSON block, so routing both through this one path keeps
        // a single implementation of normalise -> commit -> write to R2 and
        // guarantees a group edit and a scene edit can never disagree about
        // what was written.
        // @delegate: ./Na__PresentationMode__DevMenu__GroupEditor__.js
        // ------------------------------------------------------------
        window.addEventListener(Na__PresentationMode__DevMenu__GROUPS_CHANGED_EVENT, async () => {
            Na__PmDev__WorkingScenes = Na__PmDev__SortScenesByOrder(Na__PmDev__GetWorkingScenes()); // <-- Re-read: groups may have moved scenes
            Na__PmDev__NormaliseSceneOrder(Na__PmDev__WorkingScenes);      // <-- Renumber inside each group
            Na__PmDev__CommitWorkingScenes(Na__PmDev__WorkingScenes);      // <-- Refresh carousel + selector bar
            await Na__PmDev__SaveToR2(Na__PmDev__WorkingScenes);           // <-- Groups ride along inside the same config object
            Na__PmDev__RenderEditorPanel();                                // <-- Rebuild rows under their new headings
        });

        console.log('[TrueVision3D] Presentation Mode Dev Editor initialized.');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Dev Menu Scene Editor API
    // ------------------------------------------------------------
    export {
        Na__PresentationMode__DevMenu__InitializeSceneEditor
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
