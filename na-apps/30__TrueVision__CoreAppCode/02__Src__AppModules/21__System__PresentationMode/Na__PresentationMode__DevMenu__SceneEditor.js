// =============================================================================
// TRUEVISION3D - PRESENTATION MODE - DEV MENU SCENE EDITOR
// =============================================================================
//
// FILE       : Na__PresentationMode__DevMenu__SceneEditor.js
// NAMESPACE  : Na__PresentationMode
// MODULE     : PresentationMode - Dev Menu Scene Editor
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Localhost-only scene editor, opened from the Dev Tools menu into
//              a panel of its own, for creating, editing, and saving
//              Presentation Mode saved scenes
// CREATED    : 21-Jun-2026
//
// DESCRIPTION:
// - Gated behind Na__DevGate__IsAuthoringEnabled(); invisible on hosted builds.
// - Renders inside the static #naPmDevEditorPanel container (declared in the
//   Dev Tools section of Index.html), which Initialize moves into a panel of
//   its own docked on the left, or in a window of its own on another screen
//   (Na__PresentationMode__DevMenu__SceneManagerShell__): Add Scene From
//   Camera and the save state in the panel's bar, one tab per scene group
//   with the group's camera at the end of the tabs, that group's scene rows,
//   then two folds - Scene Groups (the group editor module) and All Scenes
//   (the batch walks, Export JSON and Clear All Scenes).
//
// - ONE SCENE IS OPEN AT A TIME. Every other row is a folded header strip.
//   This is the central idea of the panel and the answer to its one real
//   failure mode: with a dozen rows all unfolded, the Update Scene button
//   under your cursor belonged to a scene three screens up, and pressing it
//   overwrote a good view with wherever the camera happened to be. A folded
//   row has no buttons to press by accident.
//
// - PICKING A CARD IN THE CAROUSEL OPENS THAT SCENE HERE. The strip is the
//   fastest way to navigate a project, so it is also the scene picker for this
//   panel: whichever scene becomes active - card, chevron or number hotkey -
//   the panel folds every group but that scene's, opens that one row and
//   scrolls to it. The row you are looking at is the scene you are looking at.
//
// - A folded row reads: the scene's small picture, #N and its name, a FLY or
//   WALK chip for its navigation mode and a LAYOUT chip when the viewer never
//   sees it. Open: a thumbnail of the scene as it was last saved, Name, Group,
//   the Nav Mode switch (Orbit | Walk | Fly), an FOV slider with live lens-mm
//   readout and the move-speed value box beside it, then Advanced (collapsed):
//   Position, Easing, layer-switch timing, the layout-editor-only flag and the
//   Lighting subsection (built by Na__PresentationMode__DevMenu__SceneLightingRows__).
// - Per-scene reordering: drag the grip handle, or use the up/down arrows in
//   the row header, or type a position in Advanced. Order is rewritten as a
//   clean 1..N sequence after every move and saved immediately.
// - Per-scene actions: Go To Scene (fly there) and Update Scene (recapture,
//   behind a confirmation that names the mode it will keep); Delete under a
//   rule below them.
// - EVERY CHANGE SAVES ITSELF. A field is written a moment after it settles,
//   without a rebuild; the Nav Mode switch is written at once and, on the
//   scene on screen, switches the view as well. Save All To Project is gone:
//   nothing waits for it. Every write goes through one queue, in order.
// - Per-group action: the camera at the end of the tabs downloads an image of
//   every scene in the group on show - Download All Images, cut down to the
//   one group, for the model where the whole project is too long a job.
// - Global controls: Add Scene From Camera in the panel's bar; Update All
//   Thumbnails, Download All Images and Export JSON in the All Scenes fold,
//   where Clear All Scenes is kept apart under a rule and gated behind typing
//   the word CLEAR.
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
// 26-Nov-2026 - Version 1.5.2 (TrueVision v2.189.10)
// - THE NAV MODE FIX, as ValeVision3D's v2.99.4. Adam, of ValeVision 3D:
//   "Updating scenes navigation mode does not do anything, it reverts back to
//   orbit mode and fails despiite showing a fake update toast"; of TrueVision,
//   which had the same fault: "Fix and new panel". The switch wrote only the
//   working copy; the one press that seemed to save it, Update Scene,
//   captured the viewport's own mode (orbit) over it, wrote that to R2 and
//   said "saved". The switch now saves on the press (SaveNavigationMode) and,
//   on the scene on screen, switches the view to that mode, so the toolbar's
//   Orbit | Walk | Fly changes with it. Update Scene's question names the
//   mode it will keep, and says when the carousel is on another scene.
// - Its own panel (SceneManagerShell__ 0.0.1), docked on the left or popped
//   out into a window of its own on another screen. The editor never looks
//   the panel up by id (GetPanel), gives every dialog the panel's document,
//   and repeats each toast in the panel's bar (Say).
// - Group tabs in place of the fold-down group headings, the group's camera
//   at the end of the tabs, the batch tools folded under All Scenes, the row
//   of the scene on screen marked, a small picture and a mode chip on every
//   folded row, Go To Scene for Preview, Delete under a rule.
// - Field edits save themselves (QueueEditSave, no rebuild); every write goes
//   through one queue (SaveToR2) and paints the save state in the bar. Save
//   All To Project and the square + are gone.
// - A commit of its own no longer rebuilds the panel through the
//   scenes-loaded event (detail.source); each action rebuilds when it needs to.
// - A commit keeps the carousel's scene (CommitWorkingScenes carries the
//   active id across SetActiveConfig; the carousel 1.3.2 keeps it), so a save
//   no longer moves the highlight to the default card.
// - Ported from ValeVision3D's SceneEditor 1.5.2 and SceneRowBuilders 1.4.1;
//   TrueVision keeps its own R2 save, layer timing (which saves itself too)
//   and per-group camera.
//
// 19-Oct-2026 - Version 1.5.1 (TrueVision v2.175.1)
// - A block that holds authored scenes is always switched on when it is
//   committed or saved, as the block this editor makes for a first scene is.
//   JW02's block had been saved switched off (Scene Sync 1.0.0's placeholder)
//   and pressing Update put it in the carousel only until the next reload.
//
// 19-Oct-2026 - Version 1.5.0 (Scene Sync, TrueVision v2.174.0)
// - The working copy leaves out the scenes TrueVision Sync keeps in step with
//   SketchUp: they get no row, cannot be edited, deleted or regrouped here,
//   and a commit cannot drop them (the presentation config hook puts them
//   back into every config adopted). A save never writes them either.
//
// 28-Sep-2026 - Version 1.4.0 (per-scene lighting, v2.161.0)
// - Advanced ends with a Lighting subsection: Rotation, Height, Sun, Ambient
//   and Shadows, previewed live, with its own Use Default and Save Lighting.
//   Built in Na__PresentationMode__DevMenu__SceneLightingRows__, which this
//   file is far too long to take in; Save Lighting raises the new 'lighting'
//   row action, which commits and writes to R2 like the layout-only flag.
// - Update Scene and Add Scene From Camera capture the live lighting into
//   PresentationMode__Scene__Lighting (removed when the viewport shows the
//   default), and the overwrite confirmation says so.
// - Ported from ValeVision3D v2.71.0 (its SceneRowBuilders 1.3.0 and
//   SceneEditor 1.4.0), where it was written the same day.
//
// 20-Sep-2026 - Version 1.3.0 (per-group image export)
// - Each group heading carries a camera button that exports that group's
//   scenes. It is a sibling of the heading in a new heading row, never a child:
//   the heading is a button, and a button inside a button is invalid markup.
//   The focus pass reaches the heading through that row.
// - Download All Images became Na__PmDev__RunImageExport(scope), which both
//   buttons call. No second confirmation, progress dialog or walk was written;
//   the group is the same job over a shorter list.
//   @delegate: ./Na__PresentationMode__DevMenu__BatchOps__.js
// - Na__PmDev__GetWorkingScenesInGroup is now the one definition of "this
//   group's scenes": the rows under a heading, the count on it and the images
//   its camera exports all read it.
//
// 19-Sep-2026 - Version 1.2.0 (Presentation Scenes menu rebuild)
// - Scene rows fold. One is open at a time; opening one closes the rest.
// - The panel follows the carousel: na-presentation-mode-scene-activated folds
//   the panel down to whichever scene just became active. Purely a DOM fold -
//   it never rebuilds the panel, so an edit in progress survives it.
// - Adding a scene focuses the new row and folds everything else.
// - Each open row shows the scene's saved thumbnail, which is the only picture
//   a layout-editor-only scene has anywhere in the app.
// - Added the layout-editor-only flag (Advanced, off by default): the scene
//   stays available to the Layout Editor and to Preview here, and disappears
//   from the viewer carousel. Persists the moment it is toggled.
// - Move Speed lost its slider and sits as a value box beside the FOV slider.
//   Two sliders for two settings, one of which is set once a project, was
//   most of the height of every row.
// - Update Scene now confirms before it overwrites.
// - Clear All Scenes now sits below a rule, apart from the ordinary buttons,
//   and requires the word CLEAR typed in capitals. Nothing is committed and
//   nothing reaches R2 until that word matches.
// - Added Update All Thumbnails and Download All Images, which walk every
//   scene in turn. @delegate: ./Na__PresentationMode__DevMenu__BatchOps__.js
//

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
//   absent-key default. Add Scene and Update Scene capture the live mode
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
        Na__PresentationMode__ProjectJson__SetActiveConfig,
        Na__PresentationMode__ProjectJson__GetActiveSceneId,
        Na__PresentationMode__ProjectJson__SetActiveSceneId,
        Na__PresentationMode__ProjectJson__GetSceneById,
        Na__PresentationMode__ProjectJson__ResolveThumbnailUrl,
        Na__PresentationMode__ProjectJson__LAYOUT_ONLY_KEY,
        Na__PresentationMode__ProjectJson__SCHEMA_DESCRIPTION
    } from './Na__PresentationMode__ProjectJson__SceneData.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Carousel (scene-activated signal + preview navigation)
    // ------------------------------------------------------------
    // One-directional: the carousel never imports this module. It announces
    // which scene is active and offers a way to travel to one; this panel
    // listens and drives. Preview goes through the carousel rather than
    // straight to the camera so a floor plan or elevation scene still reaches
    // its own drawing mode via the registered navigation routers.
    // @delegate: ./Na__PresentationMode__UI__SceneCarousel.js
    // ------------------------------------------------------------
    import {
        Na__PresentationMode__UI__SCENE_ACTIVE_EVENT,
        Na__PresentationMode__UI__GoToSceneById
    } from './Na__PresentationMode__UI__SceneCarousel.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Dev Menu Modal (confirm, type-to-confirm, progress)
    // ------------------------------------------------------------
    // @delegate: ./Na__PresentationMode__DevMenu__Modal__.js
    // ------------------------------------------------------------
    import {
        Na__PresentationMode__DevMenu__Confirm,
        Na__PresentationMode__DevMenu__ConfirmTyped,
        Na__PresentationMode__DevMenu__OpenProgress
    } from './Na__PresentationMode__DevMenu__Modal__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Dev Menu Batch Operations
    // ------------------------------------------------------------
    // @delegate: ./Na__PresentationMode__DevMenu__BatchOps__.js
    // ------------------------------------------------------------
    import {
        Na__PresentationMode__DevMenu__SetBatchContext,
        Na__PresentationMode__DevMenu__IsBatchBusy,
        Na__PresentationMode__DevMenu__PartitionBatchScenes,
        Na__PresentationMode__DevMenu__UpdateAllThumbnails,
        Na__PresentationMode__DevMenu__DownloadAllImages
    } from './Na__PresentationMode__DevMenu__BatchOps__.js';
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
        Na__PresentationMode__DevMenu__GROUPS_CHANGED_EVENT
    } from './Na__PresentationMode__DevMenu__GroupEditor__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Camera Scene Transition (capture + build, the mode a scene lands in)
    // ------------------------------------------------------------
    import {
        Na__PresentationMode__Camera__BuildSceneCameraJson,
        Na__PresentationMode__Camera__ResolveSceneNavigationMode,
        Na__PresentationMode__Camera__IsTransitioning
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
    import { Na__PresentationMode__Thumbnail__CaptureAndUpload } from './Na__PresentationMode__Thumbnail__Renderer.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | 2D Drawing Scene Link Keys
    // ------------------------------------------------------------
    // Constants only, so a scene row can tell a floor plan or elevation scene
    // from an ordinary 3D one and refuse to overwrite its derived camera. Both
    // are pure data modules - importing them adds no behaviour and no cycle.
    // @delegate: ../42__System__FloorPlanViews/Na__FloorPlan__ProjectJson__Data__.js
    // @delegate: ../45__System__ElevationViews/Na__Elevation__ProjectJson__Data__.js
    // ------------------------------------------------------------
    import { Na__FpData__SCENE_PLAN_ID_KEY } from '../42__System__FloorPlanViews/Na__FloorPlan__ProjectJson__Data__.js';
    import { Na__ElevData__SCENE_ELEV_ID } from '../45__System__ElevationViews/Na__Elevation__ProjectJson__Data__.js';
    import {
        Na__DrawView__GetKind,
        Na__DrawView__IsActive,
        Na__DrawView__KIND_ELEVATION
    } from '../40__System__DrawingViewCore/Na__DrawView__ActiveView__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Project Utilities
    // ------------------------------------------------------------
    import {
        Na__AppUtils__GetProjectCodeFromUrl
    } from '../03__AppUtils/Na__AppUtils__ProjectLoader.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Cloudflare R2 API Client (realtime persistence)
    // ------------------------------------------------------------
    import {
        Na__CfApi__GetProjectContext,
        Na__CfApi__MergeAndSaveKeys
    } from '../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Render Loop Invalidation (FOV slider live preview)
    // ------------------------------------------------------------
    import { Na__RenderLoop__RequestRender } from '../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Navigation Modes (per-scene mode authoring, and the Nav Mode switch on the scene on screen)
    // @delegate: ../10__NavigationAndCameras/Na__NavigationModes__Switcher.js
    // ------------------------------------------------------------
    import {
        Na__NavigationModes__GetActiveMode,
        Na__NavigationModes__IsModeAvailable,
        Na__NavigationModes__SwitchToMode
    } from '../10__NavigationAndCameras/Na__NavigationModes__Switcher.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Panel of Its Own, Docked on the Left or in Its Own Window
    // @delegate: ./Na__PresentationMode__DevMenu__SceneManagerShell__.js
    // ------------------------------------------------------------
    import {
        Na__PmShell__Initialize,
        Na__PmShell__Open,
        Na__PmShell__Close,
        Na__PmShell__IsOpen,
        Na__PmShell__IsInWindow,
        Na__PmShell__Focus,
        Na__PmShell__SetCount,
        Na__PmShell__SetStatus,
        Na__PmShell__Say,
        Na__PmShell__GetPanel,
        Na__PmShell__GetDocument
    } from './Na__PresentationMode__DevMenu__SceneManagerShell__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Per-Scene Lighting (Advanced > Lighting, and the capture Update Scene makes)
    // ------------------------------------------------------------
    // @delegate: ./Na__PresentationMode__DevMenu__SceneLightingRows__.js
    // @delegate: ../06__Scene__LightingEffects/Na__Scene__PerSceneLighting__.js
    // ------------------------------------------------------------
    import { Na__PresentationMode__DevMenu__BuildSceneLightingSection } from './Na__PresentationMode__DevMenu__SceneLightingRows__.js';
    import { Na__SceneLighting__CaptureIntoScene } from '../06__Scene__LightingEffects/Na__Scene__PerSceneLighting__.js';
    // ------------------------------------------------------------

    import { Na__DevGate__IsAuthoringEnabled } from '../03__AppUtils/Na__AppUtils__DevGate__.js';

    // MODULE IMPORTS | Scene Sync Records (a leaf: synced SketchUp records are SketchUp's, never edited here)
    // ------------------------------------------------------------
    import { Na__SceneSync__IsSynced } from '../23__System__SceneSync/Na__SceneSync__Records__.js';
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
    const Na__PmDev__KEY__LAYOUT_EDITOR_ONLY       = Na__PresentationMode__ProjectJson__LAYOUT_ONLY_KEY;    // <-- Per-scene viewer-hidden flag (owned by the data layer)
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


    // MODULE CONSTANTS | The Panel's Words, and How Saves Are Made
    // ------------------------------------------------------------
    const Na__PmDev__PANEL_TITLE        = 'Presentation Scenes';             // <-- The Dev Tools row's own words
    const Na__PmDev__COMMIT_SOURCE      = 'presentation-scenes-editor';      // <-- detail.source on its own scenes-loaded: no rebuild from the event
    const Na__PmDev__EDIT_SAVE_DELAY_MS = 600;                               // <-- A field is written this long after it settles
    const Na__PmDev__HOW_TO             = 'Pick a card in the carousel, or a scene here, to open it. Every change saves to R2 as you make it. '
                                        + 'Nav Mode is how the carousel shows the scene; on the scene you are looking at it switches the view as well. '
                                        + 'Update Scene puts the live view into the scene: camera, FOV, model layers, navigation mode, lighting and thumbnail. '
                                        + 'Drag the handle or use the arrows to reorder a group.';
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
    let   Na__PmDev__ShownGroupId    = null;         // <-- The group tab on show; survives rebuilds (null: the carousel's group, else the first)
    let   Na__PmDev__AllScenesOpen   = false;        // <-- The All Scenes fold; survives rebuilds
    // ------------------------------------------------------------


    // MODULE VARIABLES | The Save Queue
    // ------------------------------------------------------------
    // ONE WRITE AT A TIME. Each save sends the whole scenes block to R2, so
    // two in flight could land in the wrong order and the older one would
    // win. They are chained, and the bar shows Saving... until the last one
    // is back.
    // ------------------------------------------------------------
    let Na__PmDev__SaveChain      = Promise.resolve();
    let Na__PmDev__SavesInFlight  = 0;
    let Na__PmDev__LastSaveFailed = false;
    let Na__PmDev__EditSaveTimer  = 0;               // <-- A settled field waiting to be written
    // ------------------------------------------------------------


    // MODULE VARIABLES | Single-Scene Focus
    // ------------------------------------------------------------
    // ONE id, deliberately not a Set. Two open rows is one row too many: the
    // whole reason this panel folds is that a screen showing several sets of
    // Update Scene and Delete buttons is a screen where the wrong pair gets
    // pressed. Null means every row is folded, which is how the panel opens.
    // ------------------------------------------------------------
    let Na__PmDev__FocusedSceneId = null;
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
        // Synced SketchUp scenes (Scene Sync) are left out: SketchUp owns them, and
        // the config hook puts them back into every config this editor commits.
        return Array.isArray(scenes) ? JSON.parse(JSON.stringify(scenes.filter((scene) => !Na__SceneSync__IsSynced(scene)))) : []; // <-- Deep clone so edits don't corrupt live state
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
            PresentationMode__SavedCameraScenes__Description             : Na__PresentationMode__ProjectJson__SCHEMA_DESCRIPTION,
            PresentationMode__SavedCameraScenes__Enabled                 : true,
            PresentationMode__SavedCameraScenes__DefaultSceneId          : scenes[0]?.PresentationMode__Scene__Id || null,
            PresentationMode__SavedCameraScenes__Groups                  : Na__PresentationMode__SceneGroups__GetDefaultGroups(),
            PresentationMode__SavedCameraScenes__Scenes                  : scenes
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Stamp the Current Schema Note Onto a Config Block
    // ------------------------------------------------------------
    // The block's Description is the schema note a human reads when they open
    // TrueVision__ProjectData__.json, and a project written before a key
    // existed carries a note that does not mention it. Re-stamping it on every
    // save is what keeps the file's own description of itself true - the data
    // layer owns the wording, this just writes it.
    // ------------------------------------------------------------
    function Na__PmDev__EnsureSchemaDescription(config) {
        if (!config) return config;
        config.PresentationMode__SavedCameraScenes__Description = Na__PresentationMode__ProjectJson__SCHEMA_DESCRIPTION;
        return config;
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
        if (updatedScenes.length > 0) config.PresentationMode__SavedCameraScenes__Enabled = true;   // <-- Authored scenes are meant to be seen: the block this editor makes is switched on, and so is every block it writes to

        // KEEP DEFAULT SCENE ID VALID
        const defaultId = config.PresentationMode__SavedCameraScenes__DefaultSceneId;
        const defaultStillExists = updatedScenes.some(s => s.PresentationMode__Scene__Id === defaultId);
        if (!defaultStillExists) {
            config.PresentationMode__SavedCameraScenes__DefaultSceneId = updatedScenes[0]?.PresentationMode__Scene__Id || null;
        }

        // THE SCENE ON SHOW SURVIVES THE COMMIT | SetActiveConfig clears it, and
        // the carousel keeps a still-valid one only if it is still there to read
        const activeId = Na__PresentationMode__ProjectJson__GetActiveSceneId();
        const ctx = Na__CfApi__GetProjectContext();
        Na__PresentationMode__ProjectJson__SetActiveConfig(config, ctx.projectFolder, ctx.yearCode); // <-- Re-register updated config
        if (activeId && Na__PresentationMode__ProjectJson__GetSceneById(config, activeId)) {
            Na__PresentationMode__ProjectJson__SetActiveSceneId(activeId);   // <-- Looked up after the hooks, so a synced scene counts too
        }

        // LIVE UI REFRESH | Re-dispatch the scenes event (or cleared event when empty)
        // ------------------------------------------------------------
        // source marks it as this editor's own, so its listener below does not
        // rebuild the panel: a field that saves itself must keep its caret,
        // and every action that changes the rows rebuilds them itself.
        // ------------------------------------------------------------
        if (updatedScenes.length > 0) {
            window.dispatchEvent(new CustomEvent('na-presentation-mode-scenes-loaded', {
                detail : {
                    sceneConfig   : config,
                    projectFolder : ctx.projectFolder,
                    year          : ctx.yearCode,
                    skipCameraApply: true,                                   // <-- Don't jump camera mid-edit
                    source        : Na__PmDev__COMMIT_SOURCE
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
        await Na__PmDev__SaveToR2(ordered);                                  // <-- Auto-persist, matching every other row action
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
            const panel = Na__PmDev__GetPanel();                             // <-- In whichever window the rows are
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
// REGION | Single-Scene Focus
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Which Group Does This Scene Id Sit In?
    // ------------------------------------------------------------
    function Na__PmDev__ResolveGroupIdForSceneId(sceneId) {
        if (!sceneId) return null;
        const config = Na__PresentationMode__ProjectJson__GetActiveConfig();
        const scene  = Na__PmDev__WorkingScenes.find(s => s.PresentationMode__Scene__Id === sceneId);
        if (!scene) return null;
        return Na__PresentationMode__SceneGroups__ResolveSceneGroupId(scene, config);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fold the Rendered Panel Down to the Focused Scene
    // ------------------------------------------------------------
    // A PURE DOM PASS over rows that already exist - it reads no data and
    // writes none. That is the whole point: this runs every time a scene
    // becomes active, which on a card click is twice (once on the press, once
    // when the flight lands), and re-rendering the panel there would throw
    // away any half-typed name and re-fetch every thumbnail for the privilege.
    //
    // Every group's rows ARE in the document already - a group whose tab is
    // not picked is a hidden container, not an absent one - so folding is
    // entirely a matter of which elements carry is-open.
    //
    // It also marks the row of the scene the carousel is on (is-on-screen),
    // so a row opened by hand that is NOT the view in front of you says so
    // before its Update Scene is pressed, and points the camera at the end
    // of the tabs at the group on show.
    // ------------------------------------------------------------
    function Na__PmDev__ApplyFocusToDom(shouldScroll) {
        const panel = Na__PmDev__GetPanel();
        if (!panel) return;

        const activeId = Na__PresentationMode__ProjectJson__GetActiveSceneId();
        let focusedRow = null;

        panel.querySelectorAll('.na-pm-dev__scene-row').forEach((row) => {
            const isFocused = row.dataset.sceneId === Na__PmDev__FocusedSceneId;
            row.classList.toggle('is-open', isFocused);
            row.classList.toggle('is-on-screen', Boolean(activeId) && row.dataset.sceneId === activeId);

            const header = row.querySelector('.na-pm-dev__scene-header');
            if (header) header.setAttribute('aria-expanded', String(isFocused));

            if (isFocused) focusedRow = row;
        });

        // ONE GROUP ON SHOW | Its tab lit, its rows shown, its camera ready
        const shownId = Na__PmDev__ResolveShownGroupId();
        panel.querySelectorAll('.na-pm-dev__group-scenes').forEach((body) => {
            body.classList.toggle('is-open', body.dataset.groupId === shownId);
        });
        panel.querySelectorAll('.na-pm-dev__tab').forEach((tab) => {
            const isShown = tab.dataset.groupId === shownId;
            tab.classList.toggle('is-active', isShown);
            tab.setAttribute('aria-selected', String(isShown));
        });
        const cameraBtn = panel.querySelector('.na-pm-dev__tabs .na-pm-dev__group-camera-btn');
        if (cameraBtn) Na__PmDev__PaintGroupCameraButton(cameraBtn, shownId);

        if (focusedRow && shouldScroll !== false && focusedRow.offsetParent) {
            focusedRow.scrollIntoView({ block : 'nearest' });                // <-- Instant: this fires mid-flight, a smooth scroll would still be travelling
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Which Group's Tab Is on Show?
    // ------------------------------------------------------------
    // The one picked, while it is still an enabled group; else the group the
    // carousel is showing; else the first. Null on an ungrouped project.
    // ------------------------------------------------------------
    function Na__PmDev__ResolveShownGroupId() {
        const config = Na__PresentationMode__ProjectJson__GetActiveConfig();
        const groups = Na__PresentationMode__SceneGroups__IsEnabled()
            ? Na__PresentationMode__SceneGroups__GetEnabledGroups(config)
            : [];
        if (groups.length === 0) return null;

        const ids = groups.map((group) => group.PresentationMode__Group__Id);
        if (Na__PmDev__ShownGroupId && ids.indexOf(Na__PmDev__ShownGroupId) !== -1) return Na__PmDev__ShownGroupId;

        const carouselGroupId = Na__PresentationMode__SceneGroups__GetActiveGroupId();
        if (carouselGroupId && ids.indexOf(carouselGroupId) !== -1) return carouselGroupId;

        return ids[0];
    }
    // ------------------------------------------------------------


    // FUNCTION | Show One Group's Tab
    // ------------------------------------------------------------
    // Only the panel's list changes: the camera and the carousel stay as they
    // are. The open row stays open, out of sight, until another is opened.
    // ------------------------------------------------------------
    function Na__PmDev__ShowGroup(groupId) {
        Na__PmDev__ShownGroupId = groupId || null;
        Na__PmDev__ApplyFocusToDom(false);
    }
    // ------------------------------------------------------------


    // FUNCTION | Open Exactly One Scene and Fold Everything Else
    // ------------------------------------------------------------
    // Opening a scene also shows ITS group's tab, because a scene focused in
    // a group that is not on show would be a row nobody can see - which is
    // indistinguishable from the focus not having happened.
    // ------------------------------------------------------------
    function Na__PmDev__FocusScene(sceneId, shouldScroll) {
        Na__PmDev__FocusedSceneId = sceneId || null;

        const groupId = Na__PmDev__ResolveGroupIdForSceneId(sceneId);
        if (groupId) Na__PmDev__ShownGroupId = groupId;

        Na__PmDev__ApplyFocusToDom(shouldScroll);
    }
    // ------------------------------------------------------------


// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Scene Row DOM Builder
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the Move Speed Value Box
    // ------------------------------------------------------------
    // A NUMBER BOX, NOT A SLIDER, AND IT SHARES THE FOV'S ROW.
    //
    // Move speed is a transition duration in seconds. It is set once for a
    // project, if ever - almost every scene in every project is on the 1.8s
    // default - and yet it was carrying a full-width slider of its own on
    // every row, which is a whole line of panel height per scene spent on a
    // number nobody changes. FOV keeps its slider because framing a view is
    // exactly the kind of thing you want to drag and watch.
    //
    // Seconds in, milliseconds out: the JSON field is milliseconds, and the
    // author thinks in seconds because that is what the readout has always
    // said. Clamped to the same bounds the slider enforced, so a typo cannot
    // write a forty-second flight into the project.
    // ------------------------------------------------------------
    function Na__PmDev__BuildMoveSpeedBox(scene, onChange) {
        const currentMs = Number.isFinite(scene.PresentationMode__Scene__TransitionTimeToNextSceneMs)
            ? scene.PresentationMode__Scene__TransitionTimeToNextSceneMs
            : Na__PmDev__TRANSITION_DEFAULT;

        const wrap = document.createElement('span');
        wrap.className = 'na-pm-dev__inline-field';
        wrap.title     = 'Move speed: how long the camera takes to fly to this scene, in seconds';

        const label = document.createElement('span');
        label.className   = 'na-pm-dev__inline-label';
        label.textContent = 'Move';
        wrap.appendChild(label);

        const input = document.createElement('input');
        input.type      = 'number';
        input.className = 'na-pm-dev__input na-pm-dev__input--tiny';
        input.min       = (Na__PmDev__TRANSITION_MIN_MS / 1000).toFixed(1);
        input.max       = (Na__PmDev__TRANSITION_MAX_MS / 1000).toFixed(1);
        input.step      = '0.1';
        input.value     = (currentMs / 1000).toFixed(1);
        wrap.appendChild(input);

        const suffix = document.createElement('span');
        suffix.className   = 'na-pm-dev__inline-suffix';
        suffix.textContent = 's';
        wrap.appendChild(suffix);

        input.addEventListener('change', () => {
            const seconds = parseFloat(input.value);
            if (!Number.isFinite(seconds)) {
                input.value = (currentMs / 1000).toFixed(1);                // <-- Reject junk, restore what is stored
                return;
            }
            const ms = Math.round(
                Math.max(Na__PmDev__TRANSITION_MIN_MS, Math.min(seconds * 1000, Na__PmDev__TRANSITION_MAX_MS))
            );
            input.value = (ms / 1000).toFixed(1);                           // <-- Show the clamped value back
            onChange(ms);
        });

        return wrap;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the FOV Slider Row, With Move Speed Beside It
    // ------------------------------------------------------------
    // onFovChange runs on every movement (the live viewport preview);
    // onFovCommit once the slider is let go, which is when it is saved.
    // ------------------------------------------------------------
    function Na__PmDev__BuildFovRow(scene, onFovChange, onMoveSpeedChange, onFovCommit) {
        const currentFov  = (scene.PresentationMode__Scene__CameraPosition
            && scene.PresentationMode__Scene__CameraPosition.Camera__DefaultMisc
            && scene.PresentationMode__Scene__CameraPosition.Camera__DefaultMisc.Camera__DefaultMisc__Fov)
            || Na__PmDev__FOV_DEFAULT;

        const currentMm   = Math.round(Na__PmDev__FovToFocalMm(currentFov));

        const row = document.createElement('div');
        row.className = 'na-pm-dev__slider-row na-pm-dev__slider-row--fov';

        const label = document.createElement('label');
        label.className   = 'na-pm-dev__label na-pm-dev__label--inline';
        label.textContent = 'FOV';

        const slider = document.createElement('input');
        slider.type  = 'range';
        slider.className = 'na-pm-dev__slider';
        slider.min   = Na__PmDev__FOV_MIN;
        slider.max   = Na__PmDev__FOV_MAX;
        slider.step  = '0.1';
        slider.value = currentFov.toFixed(1);
        slider.title = 'Field of view for this scene, with the equivalent full-frame lens beside it';

        const valueDisplay = document.createElement('span');
        valueDisplay.className   = 'na-pm-dev__value';
        valueDisplay.textContent = `${currentFov.toFixed(1)}\u00B0 / ${currentMm}mm`;   // <-- Degree glyph: the row now shares its width with the move speed box

        slider.addEventListener('input', () => {
            const fov   = parseFloat(slider.value);
            const lenMm = Math.round(Na__PmDev__FovToFocalMm(fov));
            valueDisplay.textContent = `${fov.toFixed(1)}\u00B0 / ${lenMm}mm`;               // <-- Live readout
            onFovChange(fov);
        });

        slider.addEventListener('change', () => {
            if (typeof onFovCommit === 'function') onFovCommit(parseFloat(slider.value)); // <-- Let go: keep it
        });

        row.appendChild(label);
        row.appendChild(slider);
        row.appendChild(valueDisplay);
        row.appendChild(Na__PmDev__BuildMoveSpeedBox(scene, onMoveSpeedChange));
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
    // Rendered as a segmented button group rather than a dropdown so the three
    // states read at a glance.  Modes the loaded model does not enable are
    // shown disabled rather than hidden, so the authoring UI stays stable
    // across projects and explains why a mode is unavailable.
    //
    // A press is saved at once: onChange hands it to the editor, which writes
    // it to R2 and, on the scene on screen, switches the view to it too. A
    // press on the mode already lit does nothing.
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
                if (btn.classList.contains('is-active')) return;            // <-- Already this mode: nothing to save
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


    // HELPER FUNCTION | Build the Layout-Editor-Only Checkbox Row
    // ------------------------------------------------------------
    // OFF BY DEFAULT, and off means the key is absent rather than false, so
    // ticking this is the only thing that ever writes it.
    //
    // A drawing sheet needs framings a viewer should never be flown to - a
    // facade shot square-on at a focal length that makes a building look like
    // an elevation, a corner cropped tight enough to read a cill. Those are
    // real scenes with real cameras and they belong in the project; they just
    // do not belong in a strip of thumbnails somebody is browsing. Ticked, the
    // scene keeps its place here and in the Layout Editor's viewport picker,
    // stays reachable through Go To Scene, and leaves the carousel.
    // ------------------------------------------------------------
    function Na__PmDev__BuildLayoutOnlyRow(scene, onChange) {
        const isLayoutOnly = scene[Na__PmDev__KEY__LAYOUT_EDITOR_ONLY] === true;

        const row = document.createElement('div');
        row.className = 'na-pm-dev__row na-pm-dev__row--checkbox';

        const label = document.createElement('label');
        label.className = 'na-pm-dev__checkbox-label';
        label.title     = 'Keep this scene for drawing sheets only. It stays in this menu, stays available to the '
                        + 'Layout Editor and can still be previewed - it just never appears in the viewer carousel.';

        const checkbox = document.createElement('input');
        checkbox.type      = 'checkbox';
        checkbox.className = 'na-pm-dev__checkbox';
        checkbox.checked   = isLayoutOnly;

        const text = document.createElement('span');
        text.className   = 'na-pm-dev__checkbox-text';
        text.textContent = 'Layout editor only - hide from the viewer carousel';

        checkbox.addEventListener('change', () => {
            onChange(checkbox.checked === true);
        });

        label.appendChild(checkbox);
        label.appendChild(text);
        row.appendChild(label);
        return row;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Thumbnail + Identity Block for an Open Row
    // ------------------------------------------------------------
    // The scene's own saved thumbnail, at the size a card would be if it had
    // one. Two reasons it earns the space:
    //
    //  - It is the visual confirmation that the row you are editing is the
    //    view you think it is, without flying anywhere to check.
    //  - For a layout-editor-only scene it is the ONLY picture of that scene
    //    anywhere in the app. Those scenes have no card, so without this the
    //    panel was asking you to author a view you could not see.
    //
    // A scene with no thumbnail yet gets the same frame with a hint in it,
    // rather than a broken image or a gap that reads as a layout bug.
    // ------------------------------------------------------------
    function Na__PmDev__BuildThumbBlock(scene, onPreview) {
        const frame = document.createElement('button');
        frame.type      = 'button';
        frame.className = 'na-pm-dev__thumb';
        frame.title     = 'Fly to this scene';

        const thumbUrl = Na__PresentationMode__ProjectJson__ResolveThumbnailUrl(scene);

        if (thumbUrl) {
            const img = document.createElement('img');
            img.className = 'na-pm-dev__thumb-img';
            img.src       = thumbUrl;
            img.alt       = scene.PresentationMode__Scene__Name || '';
            img.loading   = 'lazy';
            img.addEventListener('error', () => {
                img.remove();                                                // <-- Uploaded path exists, image does not (yet)
                frame.classList.add('na-pm-dev__thumb--empty');
                frame.textContent = 'No image';
            });
            frame.appendChild(img);
        } else {
            frame.classList.add('na-pm-dev__thumb--empty');
            frame.textContent = 'No image';
        }

        frame.addEventListener('click', () => { if (typeof onPreview === 'function') onPreview(); });
        return frame;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Small Picture a Folded Row Leads With
    // ------------------------------------------------------------
    // Decorative, inside the title button: the row is found by its picture
    // before its name is read. Lazy, so the rows of a group not on show cost
    // nothing until their tab is picked. Hidden on the open row, which shows
    // the full-size picture just below.
    // ------------------------------------------------------------
    function Na__PmDev__BuildMiniThumb(scene) {
        const frame = document.createElement('span');
        frame.className = 'na-pm-dev__mini-thumb';
        frame.setAttribute('aria-hidden', 'true');

        const thumbUrl = Na__PresentationMode__ProjectJson__ResolveThumbnailUrl(scene);
        if (!thumbUrl) {
            frame.classList.add('na-pm-dev__mini-thumb--empty');
            return frame;
        }

        const img = document.createElement('img');
        img.src      = thumbUrl;
        img.alt      = '';
        img.loading  = 'lazy';
        img.decoding = 'async';
        img.addEventListener('error', () => {
            img.remove();                                                    // <-- Stored path, no image (yet)
            frame.classList.add('na-pm-dev__mini-thumb--empty');
        });
        frame.appendChild(img);
        return frame;
    }
    // ------------------------------------------------------------


    // FUNCTION | Build a Single Scene Editor Row
    // ------------------------------------------------------------
    // A FOLDED ROW IS A HEADER AND NOTHING ELSE. The body - every field and
    // every button - is built but hidden until this row is the focused one.
    // Building it regardless keeps the fold a pure class toggle, which is what
    // lets a carousel click re-point the panel without a rebuild.
    // ------------------------------------------------------------
    function Na__PmDev__BuildSceneRow(scene, rowIndex, rowCount, onMutate) {
        const sceneId      = scene.PresentationMode__Scene__Id;
        const isLayoutOnly = scene[Na__PmDev__KEY__LAYOUT_EDITOR_ONLY] === true;

        const wrapper = document.createElement('div');
        wrapper.className       = 'na-pm-dev__scene-row';
        wrapper.dataset.sceneId = sceneId;
        wrapper.classList.toggle('is-open', sceneId === Na__PmDev__FocusedSceneId);
        wrapper.classList.toggle('na-pm-dev__scene-row--layout-only', isLayoutOnly);

        // PREVIEW | Fly to this scene, through the carousel's own navigation
        // ------------------------------------------------------------
        // Routed rather than flown directly so a plan or elevation scene opens
        // its drawing mode instead of dragging the perspective camera to a
        // pose that only makes sense inside one. It also works for a
        // layout-editor-only scene, which has no card to click.
        // ------------------------------------------------------------
        const previewScene = () => { Na__PresentationMode__UI__GoToSceneById(sceneId); };

        // SCENE HEADER | Drag Handle + Fold Title + Move Up/Down
        const header = document.createElement('div');
        header.className = 'na-pm-dev__scene-header';
        header.setAttribute('aria-expanded', String(sceneId === Na__PmDev__FocusedSceneId));

        // DRAG HANDLE | Only the handle arms dragging, so sliders stay usable
        const dragHandle = document.createElement('span');
        dragHandle.className   = 'na-pm-dev__drag-handle';
        dragHandle.textContent = '\u2261';                                  // <-- Grip glyph (identical-to sign)
        dragHandle.title       = 'Drag to reorder this scene';
        dragHandle.setAttribute('aria-hidden', 'true');
        dragHandle.addEventListener('mousedown', () => { wrapper.draggable = true;  });
        dragHandle.addEventListener('mouseup',   () => { wrapper.draggable = false; });
        header.appendChild(dragHandle);

        // FOLD BUTTON | The title IS the control that opens this scene
        const titleBtn = document.createElement('button');
        titleBtn.type      = 'button';
        titleBtn.className = 'na-pm-dev__scene-title-btn';
        titleBtn.title     = 'Open this scene for editing (closes the others)';

        const arrow = document.createElement('span');
        arrow.className = 'na-pm-dev__scene-arrow';
        arrow.innerHTML = '&#9662;';
        arrow.setAttribute('aria-hidden', 'true');
        titleBtn.appendChild(arrow);

        titleBtn.appendChild(Na__PmDev__BuildMiniThumb(scene));             // <-- A folded row is found by its picture first

        const titleEl = document.createElement('strong');
        titleEl.className   = 'na-pm-dev__scene-title';
        titleEl.textContent = `#${rowIndex + 1} - ${scene.PresentationMode__Scene__Name || sceneId}`;
        titleBtn.appendChild(titleEl);

        // MODE CHIP | Only for a mode that is not the default, like LAYOUT
        // ------------------------------------------------------------
        // A column of folded rows can then be read without opening one: FLY
        // or WALK says how the carousel shows the scene. setMode repaints it
        // when the Nav Mode switch below moves.
        // ------------------------------------------------------------
        const modeChip = document.createElement('span');
        modeChip.className = 'na-pm-dev__scene-badge na-pm-dev__scene-badge--mode';
        titleBtn.appendChild(modeChip);

        const setMode = (mode) => {
            const isFreeLook = (mode === 'walk' || mode === 'fly');
            const label      = Na__PmDev__GetModeLabel(mode);
            modeChip.hidden      = !isFreeLook;
            modeChip.textContent = isFreeLook ? label.toUpperCase() : '';
            modeChip.title       = isFreeLook ? 'The carousel shows this scene in ' + label + ' mode' : '';
        };
        setMode(Na__PresentationMode__Camera__ResolveSceneNavigationMode(scene));

        // LAYOUT-ONLY BADGE | Readable on a FOLDED row, which is the only
        // place it can do its job: telling you at a glance which of twenty
        // collapsed scenes are the ones the viewer never sees.
        if (isLayoutOnly) {
            const badge = document.createElement('span');
            badge.className   = 'na-pm-dev__scene-badge';
            badge.textContent = 'LAYOUT';
            badge.title       = 'Layout editor only - hidden from the viewer carousel';
            titleBtn.appendChild(badge);
        }

        titleBtn.addEventListener('click', () => {
            const isOpen = wrapper.classList.contains('is-open');
            Na__PmDev__FocusScene(isOpen ? null : sceneId, false);          // <-- Clicking the open row folds it again
        });
        header.appendChild(titleBtn);

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

        // SCENE BODY | Everything the fold hides
        const body = document.createElement('div');
        body.className = 'na-pm-dev__scene-body';

        // IDENTITY BLOCK | Thumbnail beside Name and Group
        const identity = document.createElement('div');
        identity.className = 'na-pm-dev__identity';
        identity.appendChild(Na__PmDev__BuildThumbBlock(scene, previewScene));

        const identityFields = document.createElement('div');
        identityFields.className = 'na-pm-dev__identity-fields';

        // NAME INPUT
        const nameRow = document.createElement('div');
        nameRow.className = 'na-pm-dev__row';
        const nameLabel = document.createElement('label');
        nameLabel.textContent = 'Name';
        nameLabel.className = 'na-pm-dev__label na-pm-dev__label--inline';
        const nameInput = document.createElement('input');
        nameInput.type      = 'text';
        nameInput.className = 'na-pm-dev__input';
        nameInput.value     = scene.PresentationMode__Scene__Name || '';
        nameInput.addEventListener('input', () => {
            scene.PresentationMode__Scene__Name = nameInput.value;          // <-- Update working copy directly
            titleEl.textContent = `#${rowIndex + 1} - ${nameInput.value || sceneId}`;
        });
        nameInput.addEventListener('change', () => {
            onMutate('edit', scene);                                        // <-- Typed and left: saved, no rebuild
        });
        nameRow.appendChild(nameLabel);
        nameRow.appendChild(nameInput);
        identityFields.appendChild(nameRow);

        // GROUP DROPDOWN | Sits in the main body, not Advanced: which group a
        // scene belongs to is a primary authoring decision on a large model,
        // and it is the only control that moves a scene between groups.
        const groupRow = Na__PmDev__BuildGroupRow(scene, (newGroupId) => {
            scene.PresentationMode__Scene__GroupId = newGroupId;             // <-- Explicit assignment
            Na__PmDev__FocusedSceneId = sceneId;                             // <-- Stay on this scene through the rebuild
            onMutate('regroup', scene);                                      // <-- Renumbers both groups, persists, rebuilds
        });
        if (groupRow) {
            groupRow.querySelectorAll('.na-pm-dev__label').forEach(el => el.classList.add('na-pm-dev__label--inline'));
            identityFields.appendChild(groupRow);
        }

        identity.appendChild(identityFields);
        body.appendChild(identity);

        // NAV MODE SWITCH | Out of Advanced, and saved the moment it is pressed
        // ------------------------------------------------------------
        // It decides how every viewer sees the scene, so it is not an advanced
        // setting. Orbit is the absent key, so older scenes read as orbit.
        // ------------------------------------------------------------
        body.appendChild(Na__PmDev__BuildNavigationModeRow(scene, (newMode) => {
            if (newMode === 'walk' || newMode === 'fly') {
                scene[Na__PmDev__KEY__NAVIGATION_MODE] = newMode;
            } else {
                delete scene[Na__PmDev__KEY__NAVIGATION_MODE];              // <-- Omit key when orbit; absent already means orbit
            }
            setMode(Na__PresentationMode__Camera__ResolveSceneNavigationMode(scene));
            onMutate('navmode', scene);                                     // <-- The editor saves it and, on screen, switches the view
        }));

        // FOV SLIDER | With the move speed value box on the same line
        body.appendChild(Na__PmDev__BuildFovRow(
            scene,
            (newFov) => {
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
            },
            (newMs) => {
                scene.PresentationMode__Scene__TransitionTimeToNextSceneMs = newMs;
                onMutate('edit', scene);                                    // <-- A typed time is kept
            },
            () => {
                onMutate('edit', scene);                                    // <-- The slider let go: the FOV is kept
            }
        ));

        // ADVANCED SECTION | Collapsed by default to keep each row readable
        // ------------------------------------------------------------
        // Holds the settings that are set once and rarely revisited: exact
        // position, easing curve, layer-switch timing, whether the viewer sees
        // this scene at all, and its lighting. Open/closed state is
        // remembered across panel rebuilds so a reorder or a save does not
        // collapse the section the user is working in.
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

        // EASING DROPDOWN
        advancedBody.appendChild(Na__PmDev__BuildEasingRow(scene, (newEasing) => {
            scene.PresentationMode__Scene__TransitionEasing = newEasing;
            onMutate('edit', scene);                                        // <-- Saved, no rebuild
        }));

        // LAYER TIMING TOGGLE (before vs after camera move)
        advancedBody.appendChild(Na__PmDev__BuildVisibilityTimingRow(scene, (applyBefore) => {
            if (applyBefore) {
                scene[Na__PmDev__KEY__VISIBILITY_BEFORE_CAMERA] = true;     // <-- Switch layers at transition start
            } else {
                delete scene[Na__PmDev__KEY__VISIBILITY_BEFORE_CAMERA];    // <-- Omit key when default (after move)
            }
            onMutate('edit', scene);                                        // <-- Saved, no rebuild
        }));

        // LAYOUT EDITOR ONLY TOGGLE
        // ------------------------------------------------------------
        // Saved the instant it is toggled, like every field now, and with a
        // rebuild: it changes whether the scene is in the carousel at all,
        // and a flag whose whole effect is "the strip looks different now"
        // has to make the strip look different now or you cannot tell it
        // worked.
        // ------------------------------------------------------------
        advancedBody.appendChild(Na__PmDev__BuildLayoutOnlyRow(scene, (layoutOnly) => {
            if (layoutOnly) {
                scene[Na__PmDev__KEY__LAYOUT_EDITOR_ONLY] = true;
            } else {
                delete scene[Na__PmDev__KEY__LAYOUT_EDITOR_ONLY];          // <-- Omit key when default (a normal viewer scene)
            }
            Na__PmDev__FocusedSceneId = sceneId;                            // <-- Hold focus across the rebuild the commit triggers
            onMutate('flag', scene);
        }));

        // LIGHTING SUBSECTION | This scene's own sun and fill light
        // ------------------------------------------------------------
        // Rotation, Height, Sun, Ambient and Shadows, previewed live in the
        // viewport as they move. The one part of a row that does not save by
        // itself: it has its own Save Lighting, because "preview, then keep"
        // is the whole gesture. Null for a drawing card.
        // @delegate: ./Na__PresentationMode__DevMenu__SceneLightingRows__.js
        // ------------------------------------------------------------
        const lightingSection = Na__PresentationMode__DevMenu__BuildSceneLightingSection(scene, () => {
            Na__PmDev__FocusedSceneId = sceneId;                            // <-- Hold focus across the rebuild the commit triggers
            onMutate('lighting', scene);                                    // <-- Normalise, commit, save to R2, rebuild panel
        });
        if (lightingSection) advancedBody.appendChild(lightingSection);

        advanced.appendChild(advancedToggle);
        advanced.appendChild(advancedBody);
        body.appendChild(advanced);

        // ACTION BUTTONS ROW | Go To Scene, then Update Scene, the main action on the right
        const actionsRow = document.createElement('div');
        actionsRow.className = 'na-pm-dev__actions';

        // GO TO SCENE | Go and look at it
        const previewBtn = document.createElement('button');
        previewBtn.type        = 'button';
        previewBtn.className   = 'na-pm-dev__btn';
        previewBtn.textContent = 'Go To Scene';
        previewBtn.title       = 'Fly the viewport to this scene, in its own navigation mode, without changing anything';
        previewBtn.addEventListener('click', previewScene);
        actionsRow.appendChild(previewBtn);

        // UPDATE SCENE | One button, the SketchUp "update scene" gesture
        // ------------------------------------------------------------
        // Recaptures everything the live viewport currently shows - camera
        // pose, FOV, model-element visibility, navigation mode - re-renders the
        // thumbnail, then commits and writes to R2. This replaced three
        // separate buttons (Update Camera / Regen Thumb / Save Scene) that
        // between them made a single "I have reframed this view" edit into a
        // three-press ritual, with every ordering of those presses saving a
        // slightly different subset.
        //
        // IT ASKS FIRST. This button destroys a saved view and there is no
        // undo for it: the old pose is overwritten in memory, written to R2
        // and its thumbnail replaced in one press. Folding the rows made the
        // wrong-row version of that mistake much harder; the confirmation is
        // for the right row at the wrong moment, which folding cannot help
        // with - the camera is simply not where you thought it was.
        // ------------------------------------------------------------
        // A DRAWING SCENE'S CAMERA IS DERIVED, NOT CAPTURED. A floor plan or
        // elevation scene holds the pose its own definition produces - the
        // top-down cut, or the head-on facade - and that pose is rewritten by
        // the drawing's own editor whenever its datum, direction or plane
        // moves. Recapturing the live view into one would overwrite it with
        // wherever the perspective camera happened to be parked, silently
        // breaking the approach flight and replacing the drawing's thumbnail
        // with a picture of the 3D model. Blocked here and signposted, rather
        // than left as a button that quietly does damage.
        const drawingKind = Na__PmDev__ResolveDrawingSceneKind(scene);

        const updateBtn = document.createElement('button');
        updateBtn.type        = 'button';
        updateBtn.className   = 'na-pm-dev__btn na-pm-dev__btn--primary';
        updateBtn.textContent = 'Update Scene';
        updateBtn.title       = 'Recapture the live view into this scene - camera, FOV, layers, navigation mode, lighting and thumbnail - then save';

        if (drawingKind) {
            updateBtn.disabled = true;
            updateBtn.title    = 'This is a ' + drawingKind.label + ' scene. Its camera is set by the '
                               + drawingKind.panel + ' panel, not by the live 3D view - use Go To Scene and '
                               + 'Save Thumbnail there instead.';
        }

        updateBtn.addEventListener('click', async () => {
            if (updateBtn.disabled) return;

            // THE QUESTION SAYS WHICH MODE IT KEEPS. Update Scene keeps the
            // viewport's navigation mode, which is how a scene set to Fly
            // came back as Orbit: the question now says so before anything
            // is overwritten, and says when the carousel is on another scene.
            const sceneName = scene.PresentationMode__Scene__Name || sceneId;
            const confirmed = await Na__PmDev__Confirm({
                title         : 'Overwrite "' + sceneName + '"?',
                message       : 'This replaces the scene\'s saved camera, field of view, layer visibility, navigation '
                              + 'mode, lighting and thumbnail with whatever the viewport is showing right now, and writes it to '
                              + 'R2.' + Na__PmDev__DescribeUpdate(scene) + ' There is no undo.',
                confirmLabel  : 'Overwrite Scene',
                cancelLabel   : 'Cancel',
                isDestructive : true
            });
            if (!confirmed) return;

            updateBtn.disabled    = true;                                   // <-- Thumbnail render + upload is async; block a double press
            updateBtn.textContent = 'Updating...';
            try {
                Na__PmDev__FocusedSceneId = sceneId;                        // <-- Come back to this row after the rebuild
                const captured = await Na__PmDev__CaptureLiveViewIntoScene(scene);   // <-- Camera + visibility + nav mode + thumbnail
                if (captured) await onMutate('update', scene, captured);   // <-- Normalise, commit, save to R2, rebuild panel
            } finally {
                updateBtn.disabled    = false;                              // <-- Panel usually rebuilds over this; safe either way
                updateBtn.textContent = 'Update Scene';
            }
        });
        actionsRow.appendChild(updateBtn);

        body.appendChild(actionsRow);

        // UNDER THE RULE | Delete, on its own, away from Update Scene. It asks first.
        const foot = document.createElement('div');
        foot.className = 'na-pm-dev__row-foot';

        const footRule = document.createElement('hr');
        footRule.className = 'na-pm-dev__rule';
        foot.appendChild(footRule);

        const footActions = document.createElement('div');
        footActions.className = 'na-pm-dev__foot-actions';

        const deleteBtn = document.createElement('button');
        deleteBtn.type        = 'button';
        deleteBtn.className   = 'na-pm-dev__btn na-pm-dev__btn--danger na-pm-dev__btn--trailing';
        deleteBtn.textContent = 'Delete';
        deleteBtn.title       = 'Delete this scene from the project (asks first)';
        deleteBtn.addEventListener('click', () => onMutate('delete', scene));
        footActions.appendChild(deleteBtn);

        foot.appendChild(footActions);
        body.appendChild(foot);

        wrapper.appendChild(body);
        return wrapper;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Thumbnail Regeneration (R2 upload)
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Is This Scene Driven by a 2D Drawing, and Which Kind?
    // ------------------------------------------------------------
    // Returns null for an ordinary 3D scene. The two link keys are imported
    // from the drawing systems' own data modules rather than spelled out here,
    // so renaming one cannot leave this check silently matching nothing.
    // ------------------------------------------------------------
    function Na__PmDev__ResolveDrawingSceneKind(scene) {
        if (!scene || typeof scene !== 'object') return null;

        if (scene[Na__FpData__SCENE_PLAN_ID_KEY]) {
            return { label: 'floor plan', panel: 'Floor Plans' };
        }
        if (scene[Na__ElevData__SCENE_ELEV_ID]) {
            return { label: 'elevation', panel: 'Elevations' };
        }
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Render Viewport WebP and Upload to R2 via the API Client
    // ------------------------------------------------------------
    // The render and the upload both live in the thumbnail module now, so a
    // scene, a floor plan and an elevation are all captured the same way.
    //
    // Quiet when it works: the press that asked for it says so in its own
    // words. A failed upload still says so. Resolves true when it uploaded.
    // ------------------------------------------------------------
    async function Na__PmDev__RegenerateThumbnail(scene) {
        const sceneId = scene.PresentationMode__Scene__Id;

        try {
            const result = await Na__PresentationMode__Thumbnail__CaptureAndUpload(sceneId);
            if (result.ok) {
                scene.PresentationMode__Scene__ThumbnailUrl = result.relUrl;  // <-- Store project-relative path
                return true;
            }
            if (Na__PmDev__ShowToast) Na__PmDev__ShowToast(`Thumbnail upload failed: ${result.error}`, true);
        } catch (error) {
            console.error('[TrueVision3D] Thumbnail regeneration error:', error);
            if (Na__PmDev__ShowToast) Na__PmDev__ShowToast('Thumbnail error - see console.', true);
        }
        return false;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Live View Capture
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Record the Live Navigation Mode Onto a Scene
    // ------------------------------------------------------------
    // Orbit is the absent-key default, so only walk and fly are ever stored.
    // Deleting rather than writing 'orbit' keeps the project JSON clean and
    // keeps one single meaning for "no key".
    // ------------------------------------------------------------
    function Na__PmDev__CaptureLiveNavigationMode(scene) {
        const liveMode = Na__NavigationModes__GetActiveMode();
        if (liveMode === 'walk' || liveMode === 'fly') {
            scene[Na__PmDev__KEY__NAVIGATION_MODE] = liveMode;
        } else {
            delete scene[Na__PmDev__KEY__NAVIGATION_MODE];
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Capture Everything the Live Viewport Shows Into a Scene
    // ------------------------------------------------------------
    // The single definition of "what a scene is a snapshot of": camera pose and
    // FOV, the derived lens mm, model-element visibility, navigation mode, the
    // lighting, and the thumbnail. Shared by Update Scene and Add Scene From Camera so the
    // two can never drift into capturing different subsets - which is exactly
    // what happened while three separate buttons each owned part of it.
    //
    // Does NOT commit or save; the caller owns persistence. Returns false when
    // there was nothing to capture, else { thumbnailSaved }, so the caller's
    // message can say when the picture did not make it.
    // ------------------------------------------------------------
    async function Na__PmDev__CaptureLiveViewIntoScene(scene) {
        if (!Na__PmDev__Camera) return false;

        const built = Na__PresentationMode__Camera__BuildSceneCameraJson(Na__PmDev__Camera, Na__PmDev__Controls);
        if (!built) return false;

        scene.PresentationMode__Scene__CameraPosition          = { ...built.cameraPosition };
        scene.PresentationMode__Scene__OrbitHelperCubePosition = { ...built.orbitHelperCubePosition };
        scene.PresentationMode__Scene__LensMm                  = Math.round(
            Na__PmDev__FovToFocalMm(Na__PmDev__Camera.fov));                 // <-- Keep the lens readout in step with the captured FOV

        const visibility = Na__PmVisibility__CaptureState();                 // <-- Live model element on/off state
        if (visibility) scene.PresentationMode__Scene__Visibility = visibility;

        Na__PmDev__CaptureLiveNavigationMode(scene);                         // <-- A view framed in fly is a fly scene
        Na__SceneLighting__CaptureIntoScene(scene);                          // <-- The light the thumbnail is about to be rendered in; no block when it is the default

        const thumbnailSaved = await Na__PmDev__RegenerateThumbnail(scene);  // <-- Render + upload WebP, sets ThumbnailUrl
        return { thumbnailSaved : thumbnailSaved === true };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Nav Mode Switch (saved on the press, shown on the scene on screen)
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Words for a Navigation Mode
    // ------------------------------------------------------------
    function Na__PmDev__GetModeLabel(mode) {
        const option = Na__PmDev__NAV_MODE_OPTIONS.find((opt) => opt.value === mode);
        return option ? option.label : 'Orbit';                              // <-- Anything else is orbit, as the flight reads it
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show a Scene's Navigation Mode at Once, When It Is the One on Screen
    // ------------------------------------------------------------
    // "On screen" is the scene the carousel last went to. The switch goes
    // through the same registered toggles the toolbar and a scene's landing
    // use, so the toolbar's Orbit | Walk | Fly changes with it, and an Update
    // Scene pressed next captures the mode the switch shows.
    //
    // Left alone while a drawing holds the view (its camera is the drawing's)
    // and during a flight (which lands in the mode it set off for).
    //
    // Returns true when the live view is in the scene's mode afterwards.
    // @delegate: ../10__NavigationAndCameras/Na__NavigationModes__Switcher.js
    // ------------------------------------------------------------
    function Na__PmDev__ApplyNavModeToViewport(scene) {
        if (!Na__PmDev__Camera || !scene) return false;
        if (Na__PresentationMode__ProjectJson__GetActiveSceneId() !== scene.PresentationMode__Scene__Id) return false;
        if (Na__DrawView__IsActive() || Na__PresentationMode__Camera__IsTransitioning()) return false;

        const mode = Na__PresentationMode__Camera__ResolveSceneNavigationMode(scene);
        if (mode === Na__NavigationModes__GetActiveMode()) return true;

        Na__NavigationModes__SwitchToMode(mode);                             // <-- Orbit releases walk or fly; walk and fly start where the camera is
        return Na__NavigationModes__GetActiveMode() === mode;
    }
    // ------------------------------------------------------------


    // FUNCTION | Keep a Scene's New Navigation Mode: Save It, and Show It
    // ------------------------------------------------------------
    // THE BUG THIS FIXES (Adam, 26-Nov-2026, of ValeVision 3D, which TrueVision
    // shared): "Updating scenes navigation mode does not do anything, it
    // reverts back to orbit mode and fails despiite showing a fake update
    // toast". The switch wrote the working copy and nothing saved it, so the
    // only press that seemed to was Update Scene - which captures the
    // viewport's own mode, orbit, over the switch, writes that to R2 and says
    // "saved". The switch's press is now the save, and the toast says what
    // was kept.
    // ------------------------------------------------------------
    async function Na__PmDev__SaveNavigationMode(scene) {
        const name  = scene.PresentationMode__Scene__Name || scene.PresentationMode__Scene__Id;
        const label = Na__PmDev__GetModeLabel(Na__PresentationMode__Camera__ResolveSceneNavigationMode(scene));

        Na__PmDev__ApplyNavModeToViewport(scene);                            // <-- The scene on screen switches with it

        Na__PmDev__CommitWorkingScenes(Na__PmDev__WorkingScenes);           // <-- The carousel lands in it from now on
        const saved = await Na__PmDev__SaveToR2(Na__PmDev__WorkingScenes, true);

        if (saved && Na__PmDev__ShowToast) {
            Na__PmDev__ShowToast('"' + name + '" now opens in ' + label + '. Saved to R2.');
        }
        return saved;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Words Update Scene's Question Adds About Mode and Place
    // ------------------------------------------------------------
    // Update Scene keeps the viewport's navigation mode, so when that is not
    // the mode the scene opens in now, the question says so before anything
    // is overwritten. It also says when the carousel is on another scene:
    // the commonest way to overwrite the wrong one.
    // ------------------------------------------------------------
    function Na__PmDev__DescribeUpdate(scene) {
        const liveRaw   = Na__NavigationModes__GetActiveMode();
        const liveMode  = (liveRaw === 'walk' || liveRaw === 'fly') ? liveRaw : 'orbit';
        const savedMode = Na__PresentationMode__Camera__ResolveSceneNavigationMode(scene);
        const liveLabel = Na__PmDev__GetModeLabel(liveMode);

        let words = (liveMode === savedMode)
            ? ' It will still open in ' + liveLabel + '.'
            : ' It will open in ' + liveLabel + ', not ' + Na__PmDev__GetModeLabel(savedMode) + ' as it does now.';

        const activeId = Na__PresentationMode__ProjectJson__GetActiveSceneId();
        if (activeId && activeId !== scene.PresentationMode__Scene__Id) {
            const active = Na__PresentationMode__ProjectJson__GetSceneById(Na__PresentationMode__ProjectJson__GetActiveConfig(), activeId);
            const activeName = (active && active.PresentationMode__Scene__Name) || activeId;
            words += ' The carousel is on "' + activeName + '", not this scene.';
        }
        return words;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | R2 Save (read-merge-write)
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Toast for Problems Only
    // ------------------------------------------------------------
    // Handed to the writes whose success the caller announces in words of its
    // own ('"Exterior 01" now opens in Fly. Saved to R2.'), so one press never
    // stacks two or three toasts saying different things.
    // ------------------------------------------------------------
    function Na__PmDev__ToastProblemsOnly(message, isError) {
        if (isError === true && Na__PmDev__ShowToast) Na__PmDev__ShowToast(message, true);
    }
    // ------------------------------------------------------------


    // FUNCTION | Save the Working Scenes to R2, One at a Time
    // ------------------------------------------------------------
    // Every write the panel makes comes through here: chained behind the one
    // before it, painting Saving... in the bar while any is out, and All
    // changes saved or Not saved when the last is back. quiet keeps the
    // success toast back for a caller that says something more exact.
    // Resolves true when this one saved.
    // ------------------------------------------------------------
    function Na__PmDev__SaveToR2(updatedScenes, quiet) {
        const toast = (quiet === true) ? Na__PmDev__ToastProblemsOnly : Na__PmDev__ShowToast;
        const run   = () => Na__PmDev__WriteToR2(updatedScenes, toast);

        Na__PmDev__CancelQueuedSave();                                       // <-- Any write carries a field already committed
        Na__PmDev__SavesInFlight += 1;
        Na__PmShell__SetStatus('saving');

        const result = Na__PmDev__SaveChain.then(run, run);
        Na__PmDev__SaveChain = result.then(() => {}, () => {});              // <-- A failure never jams the queue

        return result.then(
            (saved) => saved === true,
            (error) => {
                console.error('[TrueVision3D] Presentation scenes save failed:', error);
                if (Na__PmDev__ShowToast) Na__PmDev__ShowToast('Save failed - see console.', true);
                return false;
            }
        ).then((saved) => {
            Na__PmDev__SavesInFlight  = Math.max(0, Na__PmDev__SavesInFlight - 1);
            Na__PmDev__LastSaveFailed = !saved;
            if (Na__PmDev__SavesInFlight === 0 && !Na__PmDev__EditSaveTimer) {
                Na__PmShell__SetStatus(Na__PmDev__LastSaveFailed ? 'failed' : 'saved');
            }
            return saved;
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Scenes the Live Config Holds Now
    // ------------------------------------------------------------
    // What a delayed save writes. After this editor's commit it IS the
    // working array; if another module (a drawing's own panel) has put a new
    // array in since, that one already holds this editor's committed edits,
    // and writing the working array instead would undo its change. Synced
    // SketchUp scenes in it are never written: the API client strips them.
    // ------------------------------------------------------------
    function Na__PmDev__GetLiveScenes() {
        const config = Na__PresentationMode__ProjectJson__GetActiveConfig();
        const scenes = config && config.PresentationMode__SavedCameraScenes__Scenes;
        return Array.isArray(scenes) ? scenes : Na__PmDev__WorkingScenes;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Field Has Settled: Commit It Now, Write It in a Moment
    // ------------------------------------------------------------
    // THE FIELDS SAVE THEMSELVES (26-Nov-2026). Name, FOV, Move, Easing and
    // the layer timing edited only the working copy, which Save All To
    // Project wrote, and any rebuild before that press threw the edit away.
    // The commit happens at once (the carousel's card shows a new name
    // straight away, and a rebuild now reads the edit back from the config);
    // the write waits a moment so a run of nudges is one save. No rebuild, so
    // the caret stays put.
    // ------------------------------------------------------------
    function Na__PmDev__QueueEditSave() {
        Na__PmDev__CommitWorkingScenes(Na__PmDev__WorkingScenes);
        window.clearTimeout(Na__PmDev__EditSaveTimer);
        Na__PmShell__SetStatus('pending');
        Na__PmDev__EditSaveTimer = window.setTimeout(() => {
            Na__PmDev__EditSaveTimer = 0;
            Na__PmDev__SaveToR2(Na__PmDev__GetLiveScenes(), true);
        }, Na__PmDev__EDIT_SAVE_DELAY_MS);
    }
    // ------------------------------------------------------------


    // FUNCTION | Drop a Waiting Field Save (a fuller save is about to carry it)
    // ------------------------------------------------------------
    function Na__PmDev__CancelQueuedSave() {
        if (!Na__PmDev__EditSaveTimer) return;
        window.clearTimeout(Na__PmDev__EditSaveTimer);
        Na__PmDev__EditSaveTimer = 0;
    }
    // ------------------------------------------------------------


    // FUNCTION | Write a Waiting Field Save Now (the panel is closing, the page is going)
    // ------------------------------------------------------------
    function Na__PmDev__FlushQueuedSave() {
        if (!Na__PmDev__EditSaveTimer) return Promise.resolve(true);
        Na__PmDev__CancelQueuedSave();
        return Na__PmDev__SaveToR2(Na__PmDev__GetLiveScenes(), true);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write the PresentationMode Block to R2 (TrueVision__ProjectData__.json)
    // ------------------------------------------------------------
    // Only ever called by the queue above. toast is the app's toast, or the
    // problems-only one for a caller that announces its own success.
    // ------------------------------------------------------------
    async function Na__PmDev__WriteToR2(updatedScenes, toast) {
        const say = (typeof toast === 'function') ? toast : null;
        const ctx = Na__CfApi__GetProjectContext();
        if (!ctx.projectFolder) {
            if (say) say('No project loaded.', true);
            return false;
        }

        let config = Na__PresentationMode__ProjectJson__GetActiveConfig();
        if (config) {
            config.PresentationMode__SavedCameraScenes__Scenes = updatedScenes; // <-- Ensure latest scenes
            if (updatedScenes.length > 0) config.PresentationMode__SavedCameraScenes__Enabled = true;   // <-- As in CommitWorkingScenes: what is saved holding scenes is switched on
        } else {
            config = Na__PmDev__BuildDefaultConfig(updatedScenes);
        }

        Na__PmDev__EnsureSchemaDescription(config);                         // <-- Written file describes the shape it actually holds

        const result = await Na__CfApi__MergeAndSaveKeys({
            PresentationMode__SavedCameraScenes : config                    // <-- Merge block at document root, write to R2
        });

        if (result.ok) {
            if (say) say(`Presentation scenes saved to R2 (${ctx.projectFolder}).`);
            return true;
        }

        if (say) say(`Save failed: ${result.error}`, true);
        return false;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Editor Panel Render
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Editor's Own Element, Wherever It Is
    // ------------------------------------------------------------
    // NEVER LOOKED UP BY ID IN THIS PAGE: in its own window the panel is in
    // that window's document, where this page's getElementById cannot see
    // it. The shell holds the element itself.
    // @delegate: ./Na__PresentationMode__DevMenu__SceneManagerShell__.js
    // ------------------------------------------------------------
    function Na__PmDev__GetPanel() {
        return Na__PmShell__GetPanel() || document.getElementById('naPmDevEditorPanel');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Panel's Dialogs Open Where the Panel Is
    // ------------------------------------------------------------
    // In its own window a dialog built into this page would appear on the
    // other screen, with the window it came from waiting on it unseen, so
    // every dialog this editor asks for is given the panel's document.
    // @delegate: ./Na__PresentationMode__DevMenu__Modal__.js
    // ------------------------------------------------------------
    function Na__PmDev__Confirm(options) {
        return Na__PresentationMode__DevMenu__Confirm({ ...options, hostDocument : Na__PmShell__GetDocument() });
    }

    function Na__PmDev__ConfirmTyped(options) {
        return Na__PresentationMode__DevMenu__ConfirmTyped({ ...options, hostDocument : Na__PmShell__GetDocument() });
    }

    function Na__PmDev__OpenProgress(options) {
        return Na__PresentationMode__DevMenu__OpenProgress({ ...options, hostDocument : Na__PmShell__GetDocument() });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build One Group Tab for the Scene List
    // ------------------------------------------------------------
    // ONE GROUP AT A TIME, AS THE CAROUSEL SHOWS THEM. The fold-down group
    // headings stacked every group's name, count and rows down one column, so
    // the scene you wanted sat under the scenes you did not. A tab shows one
    // group's rows; reordering and dragging never cross a group anyway, and
    // the Group dropdown still moves a scene between them.
    // ------------------------------------------------------------
    function Na__PmDev__BuildGroupTab(groupName, groupId, sceneCount) {
        const tab = document.createElement('button');
        tab.type            = 'button';
        tab.className       = 'na-pm-dev__tab';
        tab.dataset.groupId = groupId;
        tab.title           = groupName + ': ' + Na__PresentationMode__SceneGroups__FormatViewCount(sceneCount);
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', 'false');

        const nameEl = document.createElement('span');
        nameEl.className   = 'na-pm-dev__tab-name';
        nameEl.textContent = groupName;
        tab.appendChild(nameEl);

        const countEl = document.createElement('span');
        countEl.className   = 'na-pm-dev__tab-count';
        countEl.textContent = String(sceneCount);
        tab.appendChild(countEl);

        tab.addEventListener('click', () => Na__PmDev__ShowGroup(groupId));
        return tab;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Inline Camera Glyph SVG
    // ------------------------------------------------------------
    // Drawn inline rather than loaded as an icon file, as the group bar's grid
    // glyph and the toolbar hamburger are. currentColor keeps it in step with
    // the heading text it sits beside, disabled state included.
    // ------------------------------------------------------------
    function Na__PmDev__BuildCameraGlyph() {
        const svgNs = 'http://www.w3.org/2000/svg';

        const svg = document.createElementNS(svgNs, 'svg');
        svg.setAttribute('class',   'na-pm-dev__group-camera-glyph');
        svg.setAttribute('viewBox', '0 0 16 16');
        svg.setAttribute('aria-hidden', 'true');

        const body = document.createElementNS(svgNs, 'path');                // <-- Body with the viewfinder hump in one outline
        body.setAttribute('d', 'M2.6 4.6h2.2l1-1.7h4.4l1 1.7h2.2c.6 0 1.1.5 1.1 1.1v6.2c0 .6-.5 1.1-1.1 1.1H2.6c-.6 0-1.1-.5-1.1-1.1V5.7c0-.6.5-1.1 1.1-1.1z');
        svg.appendChild(body);

        const lens = document.createElementNS(svgNs, 'circle');
        lens.setAttribute('cx', '8');
        lens.setAttribute('cy', '8.7');
        lens.setAttribute('r',  '2.5');
        svg.appendChild(lens);

        [body, lens].forEach((shape) => {
            shape.setAttribute('fill',            'none');
            shape.setAttribute('stroke',          'currentColor');
            shape.setAttribute('stroke-width',    '1.3');
            shape.setAttribute('stroke-linejoin', 'round');
        });

        return svg;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Camera Button That Exports the Shown Group's Images
    // ------------------------------------------------------------
    // ONE BUTTON, AT THE END OF THE TABS, for the group on show. A tab is a
    // button and a button inside a button is invalid markup, so the camera
    // sits beside them in the strip, never in a tab. The group is read when
    // it is pressed, never when it was drawn: picking a tab re-points it
    // (PaintGroupCameraButton, from the focus pass) without a rebuild.
    // ------------------------------------------------------------
    function Na__PmDev__BuildGroupCameraButton() {
        const cameraBtn = document.createElement('button');
        cameraBtn.type      = 'button';
        cameraBtn.className = 'na-pm-dev__group-camera-btn';
        cameraBtn.appendChild(Na__PmDev__BuildCameraGlyph());

        cameraBtn.addEventListener('click', () => {
            if (cameraBtn.disabled) return;
            const groupId = Na__PmDev__ResolveShownGroupId();
            if (groupId) Na__PmDev__DownloadGroupImages(groupId);
        });
        return cameraBtn;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Point the Camera Button at One Group
    // ------------------------------------------------------------
    // DISABLED, WITH THE REASON IN ITS HOVER TEXT, when the group holds nothing
    // the walk can visit - an empty group, or one of floor plan and elevation
    // scenes only. It stays in the strip either way, so the strip keeps its
    // shape from tab to tab.
    // ------------------------------------------------------------
    function Na__PmDev__PaintGroupCameraButton(cameraBtn, groupId) {
        const config    = Na__PresentationMode__ProjectJson__GetActiveConfig();
        const group     = Na__PresentationMode__SceneGroups__GetEnabledGroups(config)
            .find(g => g.PresentationMode__Group__Id === groupId);
        const groupName = group ? (group.PresentationMode__Group__Name || groupId) : '';
        const walkable  = group
            ? Na__PresentationMode__DevMenu__PartitionBatchScenes(Na__PmDev__GetWorkingScenesInGroup(groupId)).eligible.length
            : 0;

        const hint = walkable > 0
            ? 'Download an image of each scene in "' + groupName + '", at the current Image Export settings'
            : 'No 3D scenes in "' + groupName + '" to export';

        cameraBtn.title    = hint;
        cameraBtn.disabled = walkable === 0;
        cameraBtn.setAttribute('aria-label', hint);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Working Scenes That Resolve Into One Group, In Panel Order
    // ------------------------------------------------------------
    // The one definition of "this group's scenes" for this panel: the rows
    // under a heading, the count on it and the images its camera exports are
    // all this list, so they cannot disagree. Resolved through the data layer,
    // so a scene pointing at a deleted or switched-off group is counted in the
    // group it has fallen back into - the group it is actually shown under.
    // ------------------------------------------------------------
    function Na__PmDev__GetWorkingScenesInGroup(groupId) {
        const config = Na__PresentationMode__ProjectJson__GetActiveConfig();
        return Na__PmDev__WorkingScenes.filter(scene =>
            Na__PresentationMode__SceneGroups__ResolveSceneGroupId(scene, config) === groupId
        );
    }
    // ------------------------------------------------------------


    // FUNCTION | Render the Scene Rows, One Group's Tab at a Time
    // ------------------------------------------------------------
    // The displayed #N is the scene's position WITHIN its group, matching the
    // per-group Order that is written to the project JSON and the position the
    // carousel shows. Reorder arrows disable at each group's own edges, since
    // reordering never crosses a group boundary.
    //
    // An ungrouped project falls through to one flat, untabbed list numbered
    // 1..N, exactly as the panel looked before groups existed.
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

        // GROUPED PROJECT | A tab per group and the camera, then each group's own run of rows
        // (only the shown group's run is visible; the focus pass decides which)
        const tabs = document.createElement('div');
        tabs.className = 'na-pm-dev__tabs';
        tabs.setAttribute('role', 'tablist');
        tabs.setAttribute('aria-label', 'Scene groups');
        panel.appendChild(tabs);

        groups.forEach((group) => {
            const groupId   = group.PresentationMode__Group__Id;
            const groupName = group.PresentationMode__Group__Name || groupId;
            const inGroup   = Na__PmDev__GetWorkingScenesInGroup(groupId);

            tabs.appendChild(Na__PmDev__BuildGroupTab(groupName, groupId, inGroup.length));

            const body = document.createElement('div');
            body.className        = 'na-pm-dev__group-scenes';
            body.dataset.groupId  = groupId;                                 // <-- The focus pass shows and hides by this
            body.setAttribute('role', 'tabpanel');

            if (inGroup.length === 0) {
                const empty = document.createElement('p');
                empty.className   = 'na-pm-dev__empty';
                empty.textContent = 'No scenes in this group yet.';
                body.appendChild(empty);
            }

            inGroup.forEach((scene, index) => appendRow(body, scene, index, inGroup.length));
            panel.appendChild(body);
        });

        tabs.appendChild(Na__PmDev__BuildGroupCameraButton());               // <-- Last in the strip; the focus pass points it at the shown group
    }
    // ------------------------------------------------------------


    // FUNCTION | The One Mutation Handler Shared by Every Row
    // ------------------------------------------------------------
    // Every action ends the same way - renumber, commit, write to R2,
    // rebuild - so that tail lives in exactly one place. Only the mutation
    // itself differs. 'update' arrives with the scene already recaptured by
    // Na__PmDev__CaptureLiveViewIntoScene, and detail is what that returned.
    // A field edit and the Nav Mode switch are the two that end early: they
    // save without a rebuild.
    // ------------------------------------------------------------
    async function Na__PmDev__HandleRowMutation(action, targetScene, detail) {
        const sceneId   = targetScene.PresentationMode__Scene__Id;
        const sceneName = targetScene.PresentationMode__Scene__Name || sceneId;

        if (action === 'edit') {
            Na__PmDev__FocusedSceneId = sceneId;
            Na__PmDev__QueueEditSave();                                      // <-- Committed now, written in a moment
            return;
        }

        if (action === 'navmode') {
            Na__PmDev__FocusedSceneId = sceneId;
            await Na__PmDev__SaveNavigationMode(targetScene);
            return;
        }

        if (action === 'delete') {
            const ok = await Na__PmDev__Confirm({
                title         : 'Delete "' + sceneName + '"?',
                message       : 'The scene is removed from the project and the change is written to R2. There is no undo.',
                confirmLabel  : 'Delete Scene',
                cancelLabel   : 'Cancel',
                isDestructive : true
            });
            if (!ok) return;
            Na__PmDev__WorkingScenes = Na__PmDev__WorkingScenes.filter(
                s => s.PresentationMode__Scene__Id !== sceneId
            );                                                               // <-- Normalise below closes the gap it leaves
            if (Na__PmDev__FocusedSceneId === sceneId) {
                Na__PmDev__FocusedSceneId = null;                            // <-- Never hold focus on a scene that no longer exists
            }
        } else if (action !== 'update' && action !== 'regroup' && action !== 'flag' && action !== 'lighting') {
            return;                                                          // <-- Unknown action, do nothing ('lighting': the row already wrote it to the working copy)
        }

        Na__PmDev__NormaliseSceneOrder(Na__PmDev__WorkingScenes);            // <-- Renumber 1..N inside each affected group
        Na__PmDev__CommitWorkingScenes(Na__PmDev__WorkingScenes);            // <-- Refresh carousel + selector bar

        // AN UPDATE SAYS WHAT IT KEPT, IN ITS OWN WORDS: the mode it will open
        // in, and when the picture did not upload.
        const isUpdate = (action === 'update');
        const saved    = await Na__PmDev__SaveToR2(Na__PmDev__WorkingScenes, isUpdate);
        if (isUpdate && saved && Na__PmDev__ShowToast) {
            const thumbnailSaved = !(detail && detail.thumbnailSaved === false);
            const modeLabel      = Na__PmDev__GetModeLabel(Na__PresentationMode__Camera__ResolveSceneNavigationMode(targetScene));
            Na__PmDev__ShowToast('"' + sceneName + '" updated and saved to R2. It opens in ' + modeLabel + '.'
                + (thumbnailSaved ? '' : ' Its thumbnail did not upload, so its card keeps the old picture.'), !thumbnailSaved);
        }
        Na__PmDev__RenderEditorPanel();                                      // <-- Rows may have moved between group blocks
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Add Scene From Camera Button for the Panel's Bar
    // ------------------------------------------------------------
    // THE MAIN ACTION, WHERE IT TAKES NO TRAVEL TO REACH. It used to be at the
    // foot of the list, three screens of scrolling from the view just framed
    // on a twenty-scene project, with a square + at the top as a second door.
    // Now it is one labelled button in the bar, which never scrolls away.
    // ------------------------------------------------------------
    function Na__PmDev__BuildAddSceneButton() {
        const addBtn = document.createElement('button');
        addBtn.type        = 'button';
        addBtn.className   = 'na-pm-dev__btn na-pm-dev__btn--primary na-pm-dev__btn--add';
        addBtn.textContent = '+ Add Scene From Camera';
        addBtn.title       = 'Capture the current camera, layers, navigation mode and lighting as a new scene, '
                           + 'in the group the carousel is showing';
        addBtn.addEventListener('click', () => Na__PmDev__AddSceneFromCamera());
        return addBtn;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the All Scenes Buttons
    // ------------------------------------------------------------
    // A TWO-COLUMN GRID, not a wrapping row, so the pairing is on purpose:
    // the two batch walks on the first line, export on its own.
    // ------------------------------------------------------------
    function Na__PmDev__BuildGlobalActions() {
        const globalActions = document.createElement('div');
        globalActions.className = 'na-pm-dev__global-actions';

        // UPDATE ALL THUMBNAILS
        const thumbsBtn = document.createElement('button');
        thumbsBtn.type        = 'button';
        thumbsBtn.className   = 'na-pm-dev__btn';
        thumbsBtn.textContent = 'Update All Thumbnails';
        thumbsBtn.title       = 'Walk every scene, re-render its thumbnail, upload them all to R2 and save once';
        thumbsBtn.addEventListener('click', () => Na__PmDev__UpdateAllThumbnails());
        globalActions.appendChild(thumbsBtn);

        // DOWNLOAD ALL IMAGES
        const imagesBtn = document.createElement('button');
        imagesBtn.type        = 'button';
        imagesBtn.className   = 'na-pm-dev__btn';
        imagesBtn.textContent = 'Download All Images';
        imagesBtn.title       = 'Walk every scene and export a full-size image of each, at the current Image Export settings';
        imagesBtn.addEventListener('click', () => Na__PmDev__DownloadAllImages());
        globalActions.appendChild(imagesBtn);

        // EXPORT JSON | On its own line: it changes nothing
        const exportBtn = document.createElement('button');
        exportBtn.type        = 'button';
        exportBtn.className   = 'na-pm-dev__btn na-pm-dev__btn--wide';
        exportBtn.textContent = 'Export JSON';
        exportBtn.title       = 'Download this project\'s PresentationMode block as a JSON file';
        exportBtn.addEventListener('click', () => Na__PmDev__ExportJson());
        globalActions.appendChild(exportBtn);

        return globalActions;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Clear All Scenes Line
    // ------------------------------------------------------------
    // THE ONE BUTTON THAT CAN LOSE THE PROJECT'S SCENES. Kept below a rule,
    // on its own, with nothing beside it. It used to share a wrapping row
    // with Export JSON, which meant the distance between "download a backup"
    // and "delete everything" was however the panel happened to wrap that
    // day. The rule is there to be crossed deliberately; the line is
    // deliberately not labelled, because a heading reading DANGER over one
    // button is noise - the isolation and the typed word already say it.
    // ------------------------------------------------------------
    function Na__PmDev__BuildDangerActions() {
        const wrap = document.createElement('div');

        const dangerRule = document.createElement('hr');
        dangerRule.className = 'na-pm-dev__rule';
        wrap.appendChild(dangerRule);

        const dangerActions = document.createElement('div');
        dangerActions.className = 'na-pm-dev__danger-actions';

        const clearBtn = document.createElement('button');
        clearBtn.type        = 'button';
        clearBtn.className   = 'na-pm-dev__btn na-pm-dev__btn--danger';
        clearBtn.textContent = 'Clear All Scenes';
        clearBtn.title       = 'Delete every Presentation Mode scene on this project. Asks you to type CLEAR first.';
        clearBtn.addEventListener('click', () => Na__PmDev__ClearAllScenes());
        dangerActions.appendChild(clearBtn);

        wrap.appendChild(dangerActions);
        return wrap;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the All Scenes Fold (batch walks, export, clear)
    // ------------------------------------------------------------
    // FOLDED, BELOW THE LIST. Everything in it acts on every scene at once and
    // is used a few times a project, so none of it earns a place beside the
    // scene being edited. Its fold is remembered across rebuilds. Save All To
    // Project is gone: every change saves as it is made, and the bar says so.
    // ------------------------------------------------------------
    function Na__PmDev__BuildAllScenesSection() {
        const section = document.createElement('div');
        section.className = 'na-pm-dev__fold';

        const toggle = document.createElement('button');
        toggle.type      = 'button';
        toggle.className = 'na-pm-dev__fold-toggle';
        toggle.setAttribute('aria-expanded', String(Na__PmDev__AllScenesOpen));
        toggle.innerHTML = 'All Scenes <span class="na-pm-dev__advanced-arrow">&#9662;</span>';

        const body = document.createElement('div');
        body.className = 'na-pm-dev__fold-body';
        body.classList.toggle('is-open', Na__PmDev__AllScenesOpen);

        toggle.addEventListener('click', () => {
            Na__PmDev__AllScenesOpen = !body.classList.contains('is-open');
            body.classList.toggle('is-open', Na__PmDev__AllScenesOpen);
            toggle.setAttribute('aria-expanded', String(Na__PmDev__AllScenesOpen));
        });

        body.appendChild(Na__PmDev__BuildGlobalActions());
        body.appendChild(Na__PmDev__BuildDangerActions());

        section.appendChild(toggle);
        section.appendChild(body);
        return section;
    }
    // ------------------------------------------------------------


    // FUNCTION | Rebuild the Entire Scene Editor Panel
    // ------------------------------------------------------------
    function Na__PmDev__RenderEditorPanel() {
        const panel = Na__PmDev__GetPanel();
        if (!panel) return;

        panel.innerHTML = '';                                                // <-- Clear and rebuild

        // SCENE GROUPS SECTION | Rendered first, placed last
        // ------------------------------------------------------------
        // The group editor seeds the default groups into the live config on
        // its first render, and the tabs below read them, so it is drawn
        // before the list. It goes at the foot of the panel, folded: groups
        // are set up once a project and edited rarely after.
        //
        // The group editor owns everything inside this container. It mutates
        // the shared live config and raises its changed event, which this
        // module answers with the one normalise -> commit -> save path.
        // @delegate: ./Na__PresentationMode__DevMenu__GroupEditor__.js
        // ------------------------------------------------------------
        const groupContainer = document.createElement('div');
        groupContainer.className = 'na-pm-dev__group-container';
        Na__PresentationMode__DevMenu__RenderGroupEditor(groupContainer, Na__PmDev__ShowToast);

        // SORT ONCE INTO THE WORKING ARRAY so array index == displayed position.
        // Every reorder operation below works on array position, so the array
        // and the panel must agree before any row is built. The sort is
        // group-aware, so a group's scenes always form one unbroken run.
        Na__PmDev__WorkingScenes = Na__PmDev__SortScenesByOrder(Na__PmDev__GetWorkingScenes());
        Na__PmDev__NormaliseSceneOrder(Na__PmDev__WorkingScenes);            // <-- Collapse to a clean 1..N inside each group
        Na__PmShell__SetCount(Na__PmDev__WorkingScenes.length);

        if (Na__PmDev__WorkingScenes.length === 0) {
            const empty = document.createElement('p');
            empty.className   = 'na-pm-dev__empty';
            empty.textContent = 'No scenes yet. Frame a view, then Add Scene From Camera.';
            panel.appendChild(empty);
        } else {
            Na__PmDev__RenderSceneRowsGroupedByGroup(panel, Na__PmDev__HandleRowMutation);
        }

        // BELOW THE LIST | Two folds: the groups, and what acts on every scene
        panel.appendChild(groupContainer);
        panel.appendChild(Na__PmDev__BuildAllScenesSection());

        Na__PmDev__ApplyFocusToDom(false);                                  // <-- Restore the open row after any rebuild
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

        // NOT WHILE A 2D DRAWING IS ON SCREEN. This captures the PERSPECTIVE
        // camera, which during a plan or elevation preview is parked wherever
        // the approach flight left it. Pressing it here produced an ordinary 3D
        // scene sitting in the Floor Plans group - a card that looks like the
        // drawing and flies you to a 3D view instead, which is worse than no
        // card at all. The drawing's own panel is where its card is made.
        const drawingKind = Na__DrawView__GetKind();
        if (drawingKind) {
            const panel = (drawingKind === Na__DrawView__KIND_ELEVATION) ? 'Elevations' : 'Floor Plans';
            if (Na__PmDev__ShowToast) {
                Na__PmDev__ShowToast(
                    'You are previewing a ' + drawingKind + '. Use "Add to Scenes" in the '
                    + panel + ' panel to give it a card.', true
                );
            }
            return;
        }

        const existing   = Na__PmDev__WorkingScenes;                        // <-- Shared array (preserves in-row edits)
        const sceneId    = Na__PmDev__GetNextSceneId(existing);             // <-- Auto Scene_001, Scene_002 ...
        const nextNum    = existing.length + 1;

        // The scene's own fields. Everything captured FROM the live viewport is
        // left to Na__PmDev__CaptureLiveViewIntoScene below, so adding a scene
        // and updating one capture an identical set.
        const newScene   = {
            PresentationMode__Scene__Id                    : sceneId,
            PresentationMode__Scene__Name                  : `Scene ${nextNum}`,
            PresentationMode__Scene__ThumbnailUrl          : `PresentationMode/Thumbnails/${sceneId}.webp`,
            PresentationMode__Scene__TransitionTimeToNextSceneMs : Na__PmDev__TRANSITION_DEFAULT,
            PresentationMode__Scene__TransitionEasing      : 'easeInOutCubic'
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

        // CAPTURE THE LIVE VIEW | camera, FOV, lens, layers, nav mode, thumbnail
        const captured = await Na__PmDev__CaptureLiveViewIntoScene(newScene);
        if (!captured) return;                                              // <-- No camera or no pose; nothing to add

        Na__PmDev__WorkingScenes = [...existing, newScene];                 // <-- Append to shared array
        Na__PmDev__NormaliseSceneOrder(Na__PmDev__WorkingScenes);           // <-- Give it a correct 1..N slot inside ITS group

        // FOCUS THE NEW SCENE | Set BEFORE the commit, because committing
        // re-dispatches the scenes-loaded event and that rebuilds this panel.
        // Focus is read during the rebuild, so a new scene arrives already
        // open with every other row folded behind it - the one row you want
        // to name is the one row on screen.
        Na__PmDev__FocusedSceneId = sceneId;

        Na__PmDev__CommitWorkingScenes(Na__PmDev__WorkingScenes);          // <-- Updates config + live UI refresh

        const saved = await Na__PmDev__SaveToR2(Na__PmDev__WorkingScenes, true); // <-- Auto-persist to R2; the toast below says it
        Na__PmDev__FocusScene(sceneId, true);                               // <-- Open it and scroll to it
        Na__PmDev__RenderEditorPanel();                                     // <-- Rebuild panel to show new row
        Na__PmDev__ApplyFocusToDom(true);                                   // <-- Scroll the freshly built row into view

        if (saved && Na__PmDev__ShowToast) {
            const thumbnailSaved = captured.thumbnailSaved !== false;
            Na__PmDev__ShowToast(`Scene "${newScene.PresentationMode__Scene__Name}" added and saved to R2.`
                + (thumbnailSaved ? '' : ' Its thumbnail did not upload, so its card has no picture yet.'), !thumbnailSaved);
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


    // FUNCTION | Clear All Presentation Scenes Behind a Typed Confirmation
    // ------------------------------------------------------------
    // THE WORD MUST BE TYPED BEFORE ANYTHING HAPPENS AT ALL. Nothing is
    // emptied, nothing is committed and nothing reaches R2 until the dialog
    // comes back true - the order below is the point of this function.
    //
    // This is the one button in the panel that can undo weeks of work in a
    // press. Every scene in the project goes, and with them every drawing
    // sheet viewport that pointed at one, because a viewport whose scene no
    // longer exists has nothing to draw. A yes/no dialog is not enough: yes is
    // what you press to get a dialog out of the way. A word you have to read
    // and type in capitals is not something a hand does by itself.
    // ------------------------------------------------------------
    async function Na__PmDev__ClearAllScenes() {
        const sceneCount = Na__PmDev__WorkingScenes.length;

        const confirmed = await Na__PmDev__ConfirmTyped({
            title         : 'Delete all ' + sceneCount + ' scenes?',
            message       : 'Every Presentation Mode scene on this project is deleted and the empty block is written '
                          + 'to R2. Any drawing sheet viewport pointing at one of these scenes loses what it was '
                          + 'drawing. This cannot be undone.',
            requiredWord  : 'CLEAR',
            confirmLabel  : 'Delete All Scenes',
            cancelLabel   : 'Cancel',
            isDestructive : true
        });
        if (!confirmed) return;                                              // <-- Nothing has been touched at this point

        Na__PmDev__WorkingScenes  = [];                                      // <-- Empty the shared array
        Na__PmDev__FocusedSceneId = null;
        Na__PmDev__ShownGroupId   = null;
        Na__PmDev__CommitWorkingScenes(Na__PmDev__WorkingScenes);
        await Na__PmDev__SaveToR2(Na__PmDev__WorkingScenes);
        Na__PmDev__RenderEditorPanel();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Batch Operations (drivers)
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One-Line Summary of What a Batch Did
    // ------------------------------------------------------------
    // skippedCount comes from THIS function's caller, not from the batch
    // result. The caller hands the batch a list it has already filtered down
    // to the walkable scenes, so the batch re-partitions a list with nothing
    // left to skip and always reports zero - which is how a run that skipped
    // five drawing scenes announced itself as a plain "7 updated." and left
    // the other five unexplained.
    // ------------------------------------------------------------
    function Na__PmDev__SummariseBatch(verb, done, result, skippedCount) {
        const parts = [`${done} ${verb}`];
        if (result.failed)  parts.push(`${result.failed} failed`);
        if (skippedCount)   parts.push(`${skippedCount} drawing scene(s) skipped`);
        if (result.stopped && !result.noViewport) parts.push('stopped early');
        return parts.join(', ') + '.';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Did This Run Have Anything the User Must Read?
    // ------------------------------------------------------------
    // Skipped drawing scenes do NOT count: they were named in the confirmation
    // before the run started and are the expected outcome, not a problem.
    // ------------------------------------------------------------
    function Na__PmDev__BatchHadProblems(result) {
        return Boolean(result.failed) || Boolean(result.stopped) || Boolean(result.noViewport);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Describe What a Batch Is About to Walk
    // ------------------------------------------------------------
    // Returns null when there is nothing to do, having said why.
    //
    // scenes is the scope: every working scene when it is left out, or the
    // narrower list a group's camera button hands over. scopeName is only for
    // the sentence that explains an empty one.
    // ------------------------------------------------------------
    function Na__PmDev__DescribeBatch(scenes, scopeName) {
        const partition = Na__PresentationMode__DevMenu__PartitionBatchScenes(
            Array.isArray(scenes) ? scenes : Na__PmDev__WorkingScenes
        );

        if (partition.eligible.length === 0) {
            if (Na__PmDev__ShowToast) {
                Na__PmDev__ShowToast(
                    (scopeName ? 'No 3D scenes in "' + scopeName + '" to walk.' : 'No 3D scenes to walk.')
                    + ' Floor plan and elevation scenes are handled by their own panels.', true);
            }
            return null;
        }
        return partition;
    }
    // ------------------------------------------------------------


    // FUNCTION | Re-Render Every Scene's Thumbnail and Save Once
    // ------------------------------------------------------------
    // The batch mutates the working scenes as it goes, and THIS function owns
    // the single commit and the single R2 write at the end - twenty scenes
    // cost twenty small WebP uploads and one project JSON save, not twenty of
    // each. A run that is stopped part-way still saves what it finished, so
    // the thumbnails already uploaded are not orphaned from their records.
    // ------------------------------------------------------------
    async function Na__PmDev__UpdateAllThumbnails() {
        if (Na__PresentationMode__DevMenu__IsBatchBusy()) return;

        const partition = Na__PmDev__DescribeBatch();
        if (!partition) return;

        const total = partition.eligible.length;
        const confirmed = await Na__PmDev__Confirm({
            title         : 'Re-render ' + total + ' thumbnails?',
            message       : 'Every 3D scene is visited in turn, re-rendered at thumbnail size and uploaded to R2, '
                          + 'replacing the thumbnail it has now. The viewport moves while this runs and returns to '
                          + 'where it is now when it finishes.'
                          + (partition.skipped.length
                              ? ' ' + partition.skipped.length + ' drawing scene(s) are skipped - their own panels own those.'
                              : ''),
            confirmLabel  : 'Re-render All',
            cancelLabel   : 'Cancel',
            isDestructive : true
        });
        if (!confirmed) return;

        const progress = Na__PmDev__OpenProgress({
            title         : 'Updating thumbnails',
            message       : 'Walking every scene in turn.',
            initialStatus : 'Starting...'
        });

        let result;
        try {
            result = await Na__PresentationMode__DevMenu__UpdateAllThumbnails(partition.eligible, progress);
        } catch (batchError) {
            console.error('[TrueVision3D] Thumbnail batch failed:', batchError);
            progress.Close();
            if (Na__PmDev__ShowToast) Na__PmDev__ShowToast('Thumbnail batch failed - see console.', true);
            return;
        }

        // SAVE WHAT WAS DONE, EVEN IF THE RUN ENDED EARLY. A stop or a
        // collapsed window still leaves real WebPs already uploaded to R2, and
        // the records that point at them are in memory only until this save.
        // Reporting the problem first and returning would strand them.
        if (result.updated > 0) {
            Na__PmDev__CommitWorkingScenes(Na__PmDev__WorkingScenes);
            await Na__PmDev__SaveToR2(Na__PmDev__WorkingScenes);
        }

        const summary = Na__PmDev__SummariseBatch('updated', result.updated, result, partition.skipped.length)
            + (result.noViewport ? ' The window lost its viewport, so the run stopped there.' : '');

        progress.Finish(summary, { hadProblems : Na__PmDev__BatchHadProblems(result) });
        Na__PmDev__RenderEditorPanel();                                      // <-- Rows re-read their thumbnails
        if (Na__PmDev__ShowToast) {
            Na__PmDev__ShowToast('Thumbnails: ' + summary, result.failed > 0 || result.noViewport);
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Export a Full-Size Image of Every Scene in a Scope
    // ------------------------------------------------------------
    // Renders nothing itself: it confirms, opens the progress dialog and hands
    // the walk to the batch module, which drives the Image Export panel's own
    // render path so the images match what that panel is set to.
    //
    // ONE DRIVER, TWO DOORS. Download All Images and the camera button on a
    // group heading are the same job over a different list, so they are the
    // same function: the same confirmation, the same progress dialog with its
    // Stop, the same summary and the same walk underneath. scope is null for
    // the whole project, or { groupName, scenes } for one group - and all it
    // changes is which scenes are handed over and how the dialogs name them.
    // ------------------------------------------------------------
    async function Na__PmDev__RunImageExport(scope) {
        if (Na__PresentationMode__DevMenu__IsBatchBusy()) return;

        const groupName = scope ? scope.groupName : '';

        const partition = Na__PmDev__DescribeBatch(scope ? scope.scenes : null, groupName);
        if (!partition) return;

        const total = partition.eligible.length;
        const confirmed = await Na__PmDev__Confirm({
            title         : 'Export ' + total + (total === 1 ? ' image' : ' images')
                          + (scope ? ' from "' + groupName + '"?' : '?'),
            message       : (scope ? 'Every 3D scene in this group is' : 'Every 3D scene is')
                          + ' visited in turn and exported at the current Image Export settings, '
                          + (total === 1 ? 'arriving as one download. ' : 'arriving as ' + total + ' separate downloads. ')
                          + 'A large resolution makes this a long job. '
                          + 'The viewport returns to where it is now when it finishes.'
                          + (partition.skipped.length
                              ? ' ' + partition.skipped.length + ' drawing scene(s) are skipped.'
                              : ''),
            confirmLabel  : scope ? 'Export Group' : 'Export All',
            cancelLabel   : 'Cancel',
            isDestructive : false
        });
        if (!confirmed) return;

        const progress = Na__PmDev__OpenProgress({
            title         : 'Exporting images',
            message       : scope
                ? 'Rendering each scene in "' + groupName + '" at the current export settings.'
                : 'Rendering each scene at the current export settings.',
            initialStatus : 'Starting...'
        });

        let result;
        try {
            result = await Na__PresentationMode__DevMenu__DownloadAllImages(
                partition.eligible, progress, scope ? { groupName : groupName } : null
            );
        } catch (batchError) {
            console.error('[TrueVision3D] Image batch failed:', batchError);
            progress.Close();
            if (Na__PmDev__ShowToast) Na__PmDev__ShowToast('Image batch failed - see console.', true);
            return;
        }

        if (result.notReady) {
            progress.Close();
            if (Na__PmDev__ShowToast) {
                Na__PmDev__ShowToast('Image Export is not available on this build, so there are no settings to export at.', true);
            }
            return;
        }

        const summary = Na__PmDev__SummariseBatch('exported', result.exported, result, partition.skipped.length)
            + (result.noViewport ? ' The window lost its viewport, so the run stopped there.' : '');

        progress.Finish(summary, { hadProblems : Na__PmDev__BatchHadProblems(result) });
        if (Na__PmDev__ShowToast) {
            Na__PmDev__ShowToast(
                (scope ? 'Images, ' + groupName + ': ' : 'Images: ') + summary,
                result.failed > 0 || result.noViewport
            );
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Export a Full-Size Image of Every Scene on the Project
    // ------------------------------------------------------------
    function Na__PmDev__DownloadAllImages() {
        return Na__PmDev__RunImageExport(null);
    }
    // ------------------------------------------------------------


    // FUNCTION | Export a Full-Size Image of Every Scene in One Group
    // ------------------------------------------------------------
    // The camera button on a group heading. On a massive model the whole
    // project is a long job, and what is wanted is often one group's views at
    // the standard export - so this is that job cut shorter, not another one.
    //
    // THE GROUP IS READ WHEN THE BUTTON IS PRESSED, not when it was drawn. The
    // button only carries an id; the name and the scenes are looked up here, so
    // a rename typed into the group editor a moment ago is the name on the
    // dialog and in the filenames, and the scenes are the ones under that
    // heading now.
    // ------------------------------------------------------------
    function Na__PmDev__DownloadGroupImages(groupId) {
        const config = Na__PresentationMode__ProjectJson__GetActiveConfig();
        const group  = Na__PresentationMode__SceneGroups__GetEnabledGroups(config)
            .find(g => g.PresentationMode__Group__Id === groupId);
        if (!group) return Promise.resolve();                                // <-- Deleted or switched off since the panel was drawn

        return Na__PmDev__RunImageExport({
            groupName : group.PresentationMode__Group__Name || groupId,
            scenes    : Na__PmDev__GetWorkingScenesInGroup(groupId)
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Localhost-Only Presentation Mode Scene Editor
    // ------------------------------------------------------------
    function Na__PresentationMode__DevMenu__InitializeSceneEditor(camera, controls, showToast) {
        if (!Na__DevGate__IsAuthoringEnabled()) return;                   // <-- Production guard: never shown hosted

        Na__PmDev__Camera    = camera;
        Na__PmDev__Controls  = controls;
        Na__PmDev__ShowToast = (message, isError) => {                      // <-- In its own window the toast is on the other screen, so the bar says it too
            if (typeof showToast === 'function') showToast(message, isError);
            Na__PmShell__Say(message, isError === true);
        };

        Na__PresentationMode__DevMenu__SetBatchContext(camera, controls);    // <-- The batch walks with the same camera this panel edits

        const menuItem  = document.getElementById('naPmDevEditorItem');     // <-- Dev menu wrapper li
        const toggleBtn = document.getElementById('naPmDevEditorToggle');   // <-- Open/close button
        const panel     = document.getElementById('naPmDevEditorPanel');    // <-- Content container (moved into its own panel below)

        if (!menuItem || !toggleBtn || !panel) return;

        menuItem.style.display = '';                                         // <-- Reveal the dev section

        // ITS OWN PANEL | Out of the Dev Tools list, docked on the left
        // ------------------------------------------------------------
        // The Dev Tools row stays as the switch. The panel stays open while
        // the carousel and the model are used, and closes with its own Close.
        // @delegate: ./Na__PresentationMode__DevMenu__SceneManagerShell__.js
        // ------------------------------------------------------------
        const shell = Na__PmShell__Initialize({
            panel,
            toggleButton : toggleBtn,
            title        : Na__PmDev__PANEL_TITLE,
            infoText     : Na__PmDev__HOW_TO,
            toast        : Na__PmDev__ShowToast,
            onClose      : () => { Na__PmDev__FlushQueuedSave(); }          // <-- A field still waiting is written now
        });
        if (shell && shell.barMain) shell.barMain.appendChild(Na__PmDev__BuildAddSceneButton());

        toggleBtn.addEventListener('click', () => {
            if (Na__PmShell__IsOpen()) {
                if (Na__PmShell__IsInWindow()) {
                    Na__PmShell__Focus();                                   // <-- On another screen: bring it forward, never shut it from here
                    return;
                }
                Na__PmShell__Close();
                return;
            }

            // OPEN ON THE SCENE THE VIEWPORT IS ALREADY SHOWING. Opening
            // the panel is almost always the second half of "this view
            // needs changing", so it starts pointed at that view rather
            // than at a list to search.
            Na__PmDev__FocusedSceneId = Na__PresentationMode__ProjectJson__GetActiveSceneId();

            Na__PmShell__Open();                                            // <-- Docked, or in its own window when that is where it was last
            Na__PmDev__RenderEditorPanel();                                 // <-- Rebuild on each open so data is fresh
            Na__PmDev__FocusScene(Na__PmDev__FocusedSceneId, true);         // <-- Show that scene's group and scroll to it
        });

        // A FIELD STILL WAITING WHEN THE PAGE GOES | Best effort: write it now
        window.addEventListener('pagehide', () => { Na__PmDev__FlushQueuedSave(); });

        // RE-RENDER WHEN SCENES LOAD (project switch, a drawing's own card)
        // ------------------------------------------------------------
        // Not for this editor's own commits (detail.source): each of its
        // actions rebuilds when it needs to, and a field that saves itself
        // must keep its caret.
        // ------------------------------------------------------------
        window.addEventListener('na-presentation-mode-scenes-loaded', (event) => {
            const detail = event.detail || {};
            if (detail.source === Na__PmDev__COMMIT_SOURCE) return;
            if (panel.classList.contains('is-open')) {
                Na__PmDev__RenderEditorPanel();                            // <-- Refresh if panel already open
            }
        });

        // FOLLOW THE CAROUSEL | Whichever scene is active is the scene this panel opens
        // ------------------------------------------------------------
        // The fix for the failure this whole rebuild is about: editing the
        // wrong scene. Pick a card, step with the chevrons or press a number
        // key, and the panel folds down to that one scene with every other
        // group closed behind it, so the Update Scene button in front of you
        // always belongs to the view in front of you.
        //
        // A DOM FOLD, NEVER A REBUILD. This fires twice on a card click - once
        // on the press and once when the flight lands - and a rebuild there
        // would discard a half-typed name and re-fetch every thumbnail, twice,
        // for a change of which rows are visible.
        // @delegate: ./Na__PresentationMode__UI__SceneCarousel.js
        // ------------------------------------------------------------
        window.addEventListener(Na__PresentationMode__UI__SCENE_ACTIVE_EVENT, (event) => {
            if (!panel.classList.contains('is-open')) return;              // <-- Nothing rendered to fold
            const sceneId = event.detail && event.detail.sceneId;
            if (!sceneId) return;
            if (sceneId === Na__PmDev__FocusedSceneId) {
                Na__PmDev__ApplyFocusToDom(false);                          // <-- Already there: only the on-screen mark moves, no re-scroll mid-flight
                return;
            }
            Na__PmDev__FocusScene(sceneId, true);
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
