// =============================================================================
// TRUEVISION3D - SECTION CUT ENGINE - PER-SCENE DATA BINDINGS
// =============================================================================
//
// FILE       : Na__SectionCut__SceneData__.js
// NAMESPACE  : Na__SectSceneData
// MODULE     : Section Cut Engine - Scene Data
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Bind saved section states to Presentation Mode scenes and drawings
// CREATED    : 10-Sep-2026
//
// DESCRIPTION:
// - Holds the project's CrossSection__SceneData block: a map of scene NAME to a
//   serialized section snapshot. Keyed by name because SketchUp scene names are
//   stable across a cloud re-sync, so re-uploading a project never orphans the
//   data.
// - The block is a SEPARATE top-level key. The SketchUp cloud-sync plugin only
//   writes its own keys, so a full re-sync of scenes leaves saved cuts intact.
// - RESTORE RULE, and it is the important one. A scene WITH an entry applies it
//   exactly - including an entry holding zero sections, which clears every cut.
//   A scene with NO entry also clears every cut. The two are different routes to
//   the same place, and both exist so a cut can never leak from the scene that
//   owned it into one that never had one.
// - Drawing approach scenes are skipped entirely: the synthetic scene announced
//   mid-flight into a 2D drawing must not clear the cut the drawing just applied.
//
// INTEGRATION:
// - Index.html calls Initialize() once.
// - The loading sequence dispatches na-crosssection-scenedata-loaded with the
//   raw block after project data resolves.
// - Na__DrawView__ProjectData__ takes GetProjectBlock as its section provider,
//   so the block rides the one drawings save.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 41__System__CrossSectionView/Na__CrossSectionView__SceneData.js 1.1.0
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment Phase B, TD06)
// - Parity        : adapted
// - Divergences   : (1) The engine has no feature-enabled flag, so restore is not gated on one.
//                   (2) Serialization lives in Na__SectionCut__Serialize__ rather than inside a
//                       1,753-line system logic module.
//                   (3) The block reaches R2 through Na__DrawView__ProjectData__'s single save
//                       rather than the scene editor's own, because TrueVision has one writer
//                       for everything drawing-shaped.
// - Back-port     : no. ValeVision already has this.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.0.0
// - Initial implementation for TD06.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Section Serialization
    // ------------------------------------------------------------
    // @delegate: ./Na__SectionCut__Serialize__.js
    // ------------------------------------------------------------
    import {
        Na__SectSerialize__Serialize,
        Na__SectSerialize__Apply
    } from './Na__SectionCut__Serialize__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Section Cut Engine
    // ------------------------------------------------------------
    // @delegate: ./Na__SectionCut__Engine__.js
    // ------------------------------------------------------------
    import { Na__SectionCut__RemoveAllPlanes } from './Na__SectionCut__Engine__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Drawings Save Path (registers this block as the third key)
    // ------------------------------------------------------------
    // @delegate: ../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js
    // ------------------------------------------------------------
    import { Na__DrawData__RegisterSectionBlockProvider } from '../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Block and Key Names (ValeVision schema, verbatim)
    // ------------------------------------------------------------
    const Na__SectSceneData__BLOCK_KEY       = 'CrossSection__SceneData';
    const Na__SectSceneData__DESCRIPTION_KEY = 'CrossSection__SceneData__Description';
    const Na__SectSceneData__VERSION_KEY     = 'CrossSection__SceneData__Version';
    const Na__SectSceneData__SCENES_KEY      = 'CrossSection__SceneData__Scenes';
    const Na__SectSceneData__VERSION         = 1;
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Events
    // ------------------------------------------------------------
    const Na__SectSceneData__LOADED_EVENT = 'na-crosssection-scenedata-loaded';   // <-- Loading sequence hands the raw block over
    const Na__SectSceneData__SCENE_EVENT  = 'na-pm-scene-activated';              // <-- Scene transition module announces a scene
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Block Description
    // ------------------------------------------------------------
    const Na__SectSceneData__DESCRIPTION = 'Per-scene section cut bindings, keyed by scene name. Written by TrueVision and ValeVision in the same schema. The SketchUp cloud sync never writes this key.';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Live Block
    // ------------------------------------------------------------
    // Null until a project supplies one or something captures. Staying null is
    // meaningful: a project that has never had a cut never gains the key.
    // ------------------------------------------------------------
    let Na__SectSceneData__Block       = null;
    let Na__SectSceneData__Initialized = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Block Access
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Create the Block on First Write
    // ------------------------------------------------------------
    function Na__SectSceneData__EnsureBlock() {
        if (!Na__SectSceneData__Block) {
            Na__SectSceneData__Block = {
                [Na__SectSceneData__DESCRIPTION_KEY] : Na__SectSceneData__DESCRIPTION,
                [Na__SectSceneData__VERSION_KEY]     : Na__SectSceneData__VERSION,
                [Na__SectSceneData__SCENES_KEY]      : {}
            };
        }
        if (!Na__SectSceneData__Block[Na__SectSceneData__SCENES_KEY]) {
            Na__SectSceneData__Block[Na__SectSceneData__SCENES_KEY] = {};
        }
        return Na__SectSceneData__Block;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Live Block, or null When Nothing Has Ever Been Captured
    // ------------------------------------------------------------
    // Na__DrawView__ProjectData__ takes this as its section provider. Returning
    // null is what keeps the key off a project that has never had a section.
    // ------------------------------------------------------------
    function Na__SectSceneData__GetProjectBlock() {
        return Na__SectSceneData__Block;
    }
    // ------------------------------------------------------------


    // FUNCTION | Adopt the Block a Project Supplied
    // ------------------------------------------------------------
    function Na__SectSceneData__Load(block) {
        Na__SectSceneData__Block = (block && typeof block === 'object' && !Array.isArray(block))
            ? block
            : null;

        if (Na__SectSceneData__Block) Na__SectSceneData__EnsureBlock();           // <-- Normalise a partial block

        const count = Na__SectSceneData__Block
            ? Object.keys(Na__SectSceneData__Block[Na__SectSceneData__SCENES_KEY]).length
            : 0;
        console.log(`[TrueVision3D] Section scene bindings loaded: ${count} scene(s).`);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Find an Entry Key by Scene Id First, Then Name
    // ------------------------------------------------------------
    // Entries are keyed by NAME, which is what makes them survive a SketchUp
    // re-sync. The cost is that a rename made before the rename path existed
    // orphaned the entry under the old name. Each entry therefore also carries
    // the scene id it was captured against, and the id is tried FIRST: that
    // recovers an orphan without anyone having to notice one.
    // ------------------------------------------------------------
    function Na__SectSceneData__FindEntryKey(sceneName, sceneId) {
        if (!Na__SectSceneData__Block) return null;
        const scenes = Na__SectSceneData__Block[Na__SectSceneData__SCENES_KEY] || {};

        if (sceneId) {
            const keys = Object.keys(scenes);
            for (let i = 0; i < keys.length; i++) {
                const entry = scenes[keys[i]];
                if (entry && entry.sceneId === sceneId) return keys[i];
            }
        }

        if (sceneName && Object.prototype.hasOwnProperty.call(scenes, sceneName)) return sceneName;
        return null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Capture and Restore
// -----------------------------------------------------------------------------

    // FUNCTION | Capture the Live Cut Against a Scene Name
    // ------------------------------------------------------------
    // Called by the scene editor on Update / Add, and by the drawing systems
    // when a drawing's cut is established. Capturing a scene with no cuts writes
    // an entry holding an empty sections array, which is a real value meaning
    // "this scene shows no cut" - not the same as having no entry.
    // ------------------------------------------------------------
    function Na__SectSceneData__CaptureForScene(sceneName, sceneId) {
        if (!sceneName) return false;
        const block    = Na__SectSceneData__EnsureBlock();
        const snapshot = Na__SectSerialize__Serialize();
        if (sceneId) snapshot.sceneId = sceneId;                                 // <-- Lets a later rename find an orphaned entry
        block[Na__SectSceneData__SCENES_KEY][sceneName] = snapshot;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Drop a Scene's Binding
    // ------------------------------------------------------------
    function Na__SectSceneData__RemoveForScene(sceneName) {
        if (!Na__SectSceneData__Block || !sceneName) return false;
        const scenes = Na__SectSceneData__Block[Na__SectSceneData__SCENES_KEY] || {};
        if (!Object.prototype.hasOwnProperty.call(scenes, sceneName)) return false;
        delete scenes[sceneName];
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Re-Key a Scene's Binding After a Rename
    // ------------------------------------------------------------
    // The fourth holder of a drawing's name. A rename that lands the record and
    // the carousel card but not this leaves the drawing opening with no cut at
    // all, and nothing says so.
    // ------------------------------------------------------------
    function Na__SectSceneData__RenameSceneKey(oldName, newName, sceneId) {
        if (!Na__SectSceneData__Block || !newName) return false;
        const scenes = Na__SectSceneData__Block[Na__SectSceneData__SCENES_KEY] || {};

        const sourceKey = Na__SectSceneData__FindEntryKey(oldName, sceneId);     // <-- Id first, so an orphan is still found
        if (!sourceKey || sourceKey === newName) return false;

        const entry = scenes[sourceKey];
        if (sceneId) entry.sceneId = sceneId;                                    // <-- Backfill on any entry that predates the id
        scenes[newName] = entry;
        delete scenes[sourceKey];
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Restore a Scene's Cut, or Clear
    // ------------------------------------------------------------
    function Na__SectSceneData__RestoreForScene(sceneName, sceneId) {
        const key = Na__SectSceneData__FindEntryKey(sceneName, sceneId);

        if (!key) {
            Na__SectionCut__RemoveAllPlanes();                                   // <-- No entry: a cut must not leak in from the last scene
            return false;
        }

        const snapshot = Na__SectSceneData__Block[Na__SectSceneData__SCENES_KEY][key];
        return Na__SectSerialize__Apply(snapshot);                               // <-- Applies exactly, including "no sections"
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Arm the Load and Scene-Activated Listeners
    // ------------------------------------------------------------
    function Na__SectionCut__SceneData__Initialize() {
        if (Na__SectSceneData__Initialized) return;
        Na__SectSceneData__Initialized = true;

        // The drawings save carries this block as its third key.
        Na__DrawData__RegisterSectionBlockProvider(Na__SectSceneData__GetProjectBlock);

        window.addEventListener(Na__SectSceneData__LOADED_EVENT, (event) => {
            const detail = event.detail || {};
            Na__SectSceneData__Load(detail.block || null);
        });

        window.addEventListener(Na__SectSceneData__SCENE_EVENT, (event) => {
            const detail = event.detail || {};

            // A drawing's flight announces a synthetic approach scene partway
            // through. The drawing has already applied its own cut by then, so
            // restoring here would clear it a moment after it appeared - which
            // reads as the cut randomly failing on some drawings and not others.
            if (detail.isDrawingApproach === true || detail.IsDrawingApproach === true) return;

            const sceneName = detail.sceneName || (detail.scene && detail.scene.PresentationMode__Scene__Name) || null;
            if (!sceneName) return;

            const sceneId = detail.sceneId || (detail.scene && detail.scene.PresentationMode__Scene__Id) || null;
            Na__SectSceneData__RestoreForScene(sceneName, sceneId);
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Section Scene Data API
    // ------------------------------------------------------------
    export {
        Na__SectSceneData__BLOCK_KEY,
        Na__SectSceneData__LOADED_EVENT,
        Na__SectionCut__SceneData__Initialize,
        Na__SectSceneData__GetProjectBlock,
        Na__SectSceneData__Load,
        Na__SectSceneData__FindEntryKey,
        Na__SectSceneData__CaptureForScene,
        Na__SectSceneData__RemoveForScene,
        Na__SectSceneData__RenameSceneKey,
        Na__SectSceneData__RestoreForScene
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
