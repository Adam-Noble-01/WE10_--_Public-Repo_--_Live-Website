// =============================================================================
// TRUEVISION3D - SCENE SYNC - LIVE
// =============================================================================
//
// FILE       : Na__SceneSync__Live__.js
// NAMESPACE  : Na__SsLive
// MODULE     : Scene Sync - Live Records
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Put the synced SketchUp scenes into the app's live drawings and
//              scenes, list them for the panels, and Detach one in TrueVision
// CREATED    : 19-Oct-2026
//
// DESCRIPTION:
// - The loading sequence reads the manifest (Na__SceneSync__Store__) and
//   hands it to Na__SsLive__Use BEFORE it hands the drawings block and the
//   presentation scenes to the app. From then on two hooks keep the synced
//   records in place, so every module that reads a plan, an elevation or a
//   scene finds them exactly as it finds Adam's own:
//   - the drawings load hook (Na__DrawData__RegisterLoadHook) puts the
//     synced plans and elevations in the live drawings block as it is
//     adopted;
//   - the presentation config hook (RegisterConfigHook) puts the synced
//     scenes in every config the app adopts - the one loaded, and the one
//     the Presentation Scenes editor commits after every edit.
//   Both remove synced records first and skip any id a saved record already
//   has, so they can run any number of times.
// - DETACH IN TRUEVISION turns a synced scene's records into ordinary saved
//   ones, in place, same ids: every viewport bound to them keeps working and
//   the next save writes them (Na__SceneSync__DetachedCopy). From then on the
//   saved records win over anything SketchUp sends for that id.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Oct-2026 - Version 1.0.0
// - Initial implementation (Scene Sync, TrueVision v2.174.0).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Records (the leaf)
    // ------------------------------------------------------------
    import {
        Na__SceneSync__Build,
        Na__SceneSync__ApplyToList,
        Na__SceneSync__SetSyntheticIds,
        Na__SceneSync__IsSynced,
        Na__SceneSync__IsDetached,
        Na__SceneSync__DetachedCopy,
        Na__SceneSync__ContainerConfig
    } from './Na__SceneSync__Records__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Live Drawings Block and Presentation Config
    // ------------------------------------------------------------
    import {
        Na__DrawData__FLOOR_PLANS_KEY,
        Na__DrawData__ELEVATIONS_KEY,
        Na__DrawData__RegisterLoadHook,
        Na__DrawData__IsLoaded,
        Na__DrawData__GetBlock
    } from '../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    import {
        Na__PresentationMode__ProjectJson__RegisterConfigHook,
        Na__PresentationMode__ProjectJson__GetActiveConfig
    } from '../21__System__PresentationMode/Na__PresentationMode__ProjectJson__SceneData.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Keys and the Change Event
    // ------------------------------------------------------------
    const Na__SsLive__CHANGED_EVENT = 'na-scenesync-changed';                    // <-- detail: { reason }
    const Na__SsLive__SCENES_KEY    = 'PresentationMode__SavedCameraScenes__Scenes';
    const Na__SsLive__PLAN_ID       = 'FloorPlan__Id';
    const Na__SsLive__ELEVATION_ID  = 'Elevation__Id';
    const Na__SsLive__SCENE_ID      = 'PresentationMode__Scene__Id';
    // ------------------------------------------------------------

    // MODULE VARIABLES | What This Load Built
    // ------------------------------------------------------------
    let Na__SsLive__Built = { plans : [], elevations : [], scenes : [], entries : [] };
    let Na__SsLive__Info  = { exportedIso : null, url : null };
    let Na__SsLive__Hooked = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Putting the Records in Place
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Announce a Change (on a microtask, never inside the caller)
    // ------------------------------------------------------------
    function Na__SsLive__Dispatch(reason) {
        queueMicrotask(() => window.dispatchEvent(new CustomEvent(Na__SsLive__CHANGED_EVENT, { detail : { reason : reason } })));
    }
    // ------------------------------------------------------------


    // FUNCTION | Synced Plans and Elevations Into a Drawings Block
    // ------------------------------------------------------------
    function Na__SsLive__ApplyToBlock(block) {
        if (!block || typeof block !== 'object') return;
        Na__SceneSync__ApplyToList(block[Na__DrawData__FLOOR_PLANS_KEY], Na__SsLive__Built.plans, Na__SsLive__PLAN_ID);
        Na__SceneSync__ApplyToList(block[Na__DrawData__ELEVATIONS_KEY], Na__SsLive__Built.elevations, Na__SsLive__ELEVATION_ID);
    }
    // ------------------------------------------------------------


    // FUNCTION | Synced Scenes Into a Presentation Config
    // ------------------------------------------------------------
    function Na__SsLive__ApplyToConfig(config) {
        if (!config || typeof config !== 'object') return;
        if (!Array.isArray(config[Na__SsLive__SCENES_KEY])) {
            if (!Na__SsLive__Built.scenes.length) return;                        // <-- Nothing to add: a block without scenes stays as it came
            config[Na__SsLive__SCENES_KEY] = [];
        }
        Na__SceneSync__ApplyToList(config[Na__SsLive__SCENES_KEY], Na__SsLive__Built.scenes, Na__SsLive__SCENE_ID);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Hook In Once
    // ------------------------------------------------------------
    function Na__SsLive__Hook() {
        if (Na__SsLive__Hooked) return;
        Na__SsLive__Hooked = true;
        Na__DrawData__RegisterLoadHook(Na__SsLive__ApplyToBlock);
        Na__PresentationMode__ProjectJson__RegisterConfigHook(Na__SsLive__ApplyToConfig);
    }
    // ------------------------------------------------------------


    // FUNCTION | Use a Manifest (from Na__SsStore__Load; null for none)
    // ------------------------------------------------------------
    // options: Na__SceneSync__Build's (the orbit's limits, the default
    // exclusion tokens). info: { exportedIso, url }, for the panels. Called by
    // the loading sequence before the drawings and scenes go out; called
    // later, it puts the records into what is already loaded as well.
    // ------------------------------------------------------------
    function Na__SsLive__Use(manifest, options, info) {
        Na__SsLive__Hook();
        Na__SsLive__Built = Na__SceneSync__Build(manifest, options);
        Na__SsLive__Info  = Object.assign({ exportedIso : manifest ? manifest.exportedIso : null, url : null }, info || {});
        Na__SceneSync__SetSyntheticIds(Na__SsLive__Built.entries.map((entry) => entry.id));
        if (Na__DrawData__IsLoaded()) Na__SsLive__ApplyToBlock(Na__DrawData__GetBlock());
        const config = Na__PresentationMode__ProjectJson__GetActiveConfig();
        if (config) Na__SsLive__ApplyToConfig(config);
        Na__SsLive__Dispatch('used');
        return Na__SsLive__Built.entries.length;
    }
    // ------------------------------------------------------------


    // FUNCTION | Does This Load Have Synced Scenes?
    // ------------------------------------------------------------
    function Na__SsLive__HasScenes() { return Na__SsLive__Built.scenes.length > 0; }
    // ------------------------------------------------------------


    // FUNCTION | A Presentation Block to Hold the Synced Scenes (a project that has none)
    // ------------------------------------------------------------
    function Na__SsLive__NewContainerConfig() { return Na__SceneSync__ContainerConfig(); }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading, for the Panels
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Live Record of an Id in a List (null when none)
    // ------------------------------------------------------------
    function Na__SsLive__Find(list, idKey, id) {
        return Array.isArray(list) ? (list.find((record) => record && record[idKey] === id) || null) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Live Scene Record of an Id (synced or detached), or null
    // ------------------------------------------------------------
    function Na__SsLive__SceneRecord(id) {
        const config = Na__PresentationMode__ProjectJson__GetActiveConfig();
        return config ? Na__SsLive__Find(config[Na__SsLive__SCENES_KEY], Na__SsLive__SCENE_ID, id) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Synced Scene, With Where It Stands Now
    // ------------------------------------------------------------
    // Each entry from the manifest plus detachedHere: a saved record of that
    // id exists, so TrueVision owns it now and SketchUp's copy is ignored.
    // ------------------------------------------------------------
    function Na__SsLive__Entries() {
        return Na__SsLive__Built.entries.map((entry) => {
            const scene = Na__SsLive__SceneRecord(entry.id);
            return Object.assign({}, entry, { detachedHere : Boolean(scene) && !Na__SceneSync__IsSynced(scene) });
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | One Entry by Id (null when this load has none)
    // ------------------------------------------------------------
    function Na__SsLive__Entry(id) {
        return Na__SsLive__Entries().find((entry) => entry.id === id) || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | When SketchUp Last Synced, and From Where It Was Read
    // ------------------------------------------------------------
    function Na__SsLive__GetInfo() { return Object.assign({}, Na__SsLive__Info); }
    // ------------------------------------------------------------


    // FUNCTION | Is This Scene Id a Synced Scene That SketchUp Still Owns?
    // ------------------------------------------------------------
    function Na__SsLive__IsLiveSynced(sceneId) {
        const scene = sceneId ? Na__SsLive__SceneRecord(sceneId) : null;
        return Na__SceneSync__IsSynced(scene);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Detach in TrueVision
// -----------------------------------------------------------------------------

    // FUNCTION | Make a Synced Scene TrueVision's Own (the caller saves)
    // ------------------------------------------------------------
    // Its drawing record (when it has one) and its scene are replaced in the
    // live arrays by saved copies with the same ids. Returns { ok, name,
    // message }. Nothing is written here: the Layout Editor's own save writes
    // the records with everything else, and until then they are ordinary
    // unsaved edits.
    // ------------------------------------------------------------
    function Na__SsLive__Detach(id) {
        const config = Na__PresentationMode__ProjectJson__GetActiveConfig();
        const scenes = config ? config[Na__SsLive__SCENES_KEY] : null;
        const scene  = Na__SsLive__Find(scenes, Na__SsLive__SCENE_ID, id);
        if (!scene || !Na__SceneSync__IsSynced(scene)) {
            return { ok : false, name : null, message : Na__SceneSync__IsDetached(scene) ? 'Already detached.' : 'This scene is not synced from SketchUp.' };
        }
        const whenIso = new Date().toISOString();
        const swap = (list, idKey) => {
            if (!Array.isArray(list)) return;
            const index = list.findIndex((record) => record && record[idKey] === id && Na__SceneSync__IsSynced(record));
            if (index >= 0) list[index] = Na__SceneSync__DetachedCopy(list[index], whenIso);
        };
        if (Na__DrawData__IsLoaded()) {
            const block = Na__DrawData__GetBlock();
            swap(block[Na__DrawData__FLOOR_PLANS_KEY], Na__SsLive__PLAN_ID);
            swap(block[Na__DrawData__ELEVATIONS_KEY], Na__SsLive__ELEVATION_ID);
        }
        swap(scenes, Na__SsLive__SCENE_ID);
        Na__SceneSync__SetSyntheticIds(Na__SsLive__Built.entries.map((entry) => entry.id).filter((entryId) => entryId !== id));
        Na__SsLive__Dispatch('detached');
        return { ok : true, name : scene.PresentationMode__Scene__Name || id, message : '' };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Initialisation and Exports
// -----------------------------------------------------------------------------

    Na__SsLive__Hook();                                                          // <-- At import: the hooks are in place before any project data arrives

    // MODULE EXPORTS | Scene Sync Live API
    // ------------------------------------------------------------
    export {
        Na__SsLive__CHANGED_EVENT,
        Na__SsLive__Use,
        Na__SsLive__HasScenes,
        Na__SsLive__NewContainerConfig,
        Na__SsLive__ApplyToBlock,
        Na__SsLive__ApplyToConfig,
        Na__SsLive__Entries,
        Na__SsLive__Entry,
        Na__SsLive__GetInfo,
        Na__SsLive__IsLiveSynced,
        Na__SsLive__SceneRecord,
        Na__SsLive__Detach
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
