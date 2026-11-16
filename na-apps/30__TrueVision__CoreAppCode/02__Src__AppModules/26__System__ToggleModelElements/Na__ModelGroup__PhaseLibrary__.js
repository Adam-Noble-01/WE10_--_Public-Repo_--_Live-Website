// =============================================================================
// TRUEVISION3D - MODEL GROUP - DESIGN PHASE LIBRARY
// =============================================================================
//
// FILE       : Na__ModelGroup__PhaseLibrary__.js
// NAMESPACE  : Na__PhaseLib
// MODULE     : ModelGroup - Design Phase Library
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Every design phase a project has, which one the 3D view holds, and the others loaded off-scene for drawings
// CREATED    : 13-Sep-2026
//
// DESCRIPTION:
// - A project's modelGroups are its design phases: the existing building, a
//   scheme, the next scheme. The 3D view holds exactly one of them under
//   Na__ModelGroup__Root, and the Design Phase menu swaps which. This module is
//   the register of all of them:
//     GROUPS    id, label and GLB list for each phase, in project order
//     DEFAULT   the phase the project opens with: the newest group whose label
//               does not say "existing" - the rule the startup load always used
//     LIVE      the phase Na__ModelGroup__Root holds right now
//     CACHE     other phases, each loaded on request into a detached root of
//               its own. This module never adds one to the scene.
// - A drawing of another phase is the same drawing of a different model: the
//   same camera, cut and window. Every phase is exported from the one SketchUp
//   model, so the phases share one origin and a detached phase root sits
//   exactly where the live model does. The Layout Editor's snapshot renderer
//   puts a phase root in the scene for one render at a time; the projected
//   linework reads it where it lies.
// - Loads run one at a time, only once the live model is in, and through the
//   same loader, configs and materials pass as the 3D view's own load - so a
//   phase drawn off-scene looks like the same phase loaded live.
// - Beyond the cache limit the least recently used phase is disposed. A phase
//   a render has pinned is never disposed.
// - A LOADED PHASE CAN TAKE THE 3D VIEW WITHOUT A DOWNLOAD (SwapLive): its
//   categories move under Na__ModelGroup__Root and the phase it replaces moves
//   into the cache, put back as it loaded. The Design Phase menu goes through
//   it, so a phase seen once comes back at once.
// - EXISTING AND PROPOSED (GetComparePair): the newest group whose label says
//   "existing" and the phase it is compared with - the phase in the 3D view,
//   or the project default when the 3D view holds the existing building. A
//   project without both answers null.
//
// INTEGRATION:
// - Na__AppFlow__LoadingSequence initialises it and reports the groups and the
//   live phase; Na__UiFeature__ModelGroupSelector reports every switch.
// - Na__LayoutEditor__ModelSource__ resolves a viewport's phase through here;
//   Na__LayoutEditor__SnapshotRenderer__ borrows and pins phase roots.
// - Na__UiFeature__PhaseCompare__ reads the pair, loads the other half and pins
//   it while the comparison is on screen.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 15-Nov-2026 - Version 1.1.0 (v2.186.0)
// - SwapLive: a cached phase goes into the 3D view and the live one into the
//   cache, with no file fetched. SetLive keeps the live phase's category Map,
//   which is what makes the phase leaving the view a cache entry.
// - GetExistingId, GetComparePair and GetShortLabel, for the Existing and
//   Proposed comparison.
// - SetCacheFloor: the comparison needs its other half kept whatever limit the
//   Layout Editor's config sets.
// - An off-scene phase runs its materials pass a category at a time, as each
//   is built, where it ran once over the whole phase at the end.
//
// 13-Sep-2026 - Version 1.0.0
// - Initial implementation, for the Layout Editor's per-viewport Model Source.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js Core and the Multi-Model Loader
    // ------------------------------------------------------------
    import * as THREE from 'three';
    import {
        Na__ModelLoader__StartStagedLoad,
        Na__ModelLoader__SeparateOrbitCubeUrl,
        Na__ModelLoader__ClassifyUrls,
        Na__ModelLoader__RestoreLoadedVisibility,
        Na__ModelCategories__LoadOrder
    } from '../15__ModelLoader/Na__ModelLoader__MultiModel.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Event and Status Words
    // ------------------------------------------------------------
    const Na__PhaseLib__CHANGED_EVENT   = 'na-model-phase-library-changed';
    const Na__PhaseLib__STATUS_LIVE     = 'live';
    const Na__PhaseLib__STATUS_READY    = 'ready';
    const Na__PhaseLib__STATUS_LOADING  = 'loading';
    const Na__PhaseLib__STATUS_FAILED   = 'failed';
    const Na__PhaseLib__STATUS_UNLOADED = 'unloaded';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Limits
    // ------------------------------------------------------------
    const Na__PhaseLib__DEFAULT_CACHE_SIZE = 3;       // <-- Fallback only; the Layout Editor config sets the real limit
    const Na__PhaseLib__RETRY_AFTER_MS     = 10000;   // <-- A phase that failed is not fetched again sooner than this
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Load Context
    // ------------------------------------------------------------
    let Na__PhaseLib__ModelRoot      = null;   // <-- Na__ModelGroup__Root: the live phase, and the transform every phase root copies
    let Na__PhaseLib__ModelsConfig   = null;   // <-- The material configs the loader takes
    let Na__PhaseLib__LineResolution = null;   // <-- Screen resolution for the fat lines
    let Na__PhaseLib__AfterLoad      = null;   // <-- The materials pass, run on every freshly loaded phase
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Register
    // ------------------------------------------------------------
    let   Na__PhaseLib__Groups    = [];              // <-- [ { groupId, label, modelUrls, keys } ] in project order
    let   Na__PhaseLib__RawIds    = new WeakMap();   // <-- The project data's own group object -> groupId
    let   Na__PhaseLib__DefaultId = null;
    let   Na__PhaseLib__LiveId    = null;
    let   Na__PhaseLib__LiveKeys  = [];
    let   Na__PhaseLib__LiveGroups = null;           // <-- The live phase's category Map: what lets it leave the 3D view for the cache
    let   Na__PhaseLib__LiveReady = false;
    let   Na__PhaseLib__LiveGate  = null;            // <-- The promise callers hold while the live model loads
    let   Na__PhaseLib__LiveOpen  = null;
    const Na__PhaseLib__Entries   = new Map();       // <-- groupId -> entry, for phases other than the live one
    let   Na__PhaseLib__LoadChain = Promise.resolve();
    let   Na__PhaseLib__CacheSize = Na__PhaseLib__DEFAULT_CACHE_SIZE;
    let   Na__PhaseLib__CacheFloor = 1;              // <-- Never fewer than this, whatever limit is set (the comparison's other half)
    const Na__PhaseLib__LoadReports = new Map();     // <-- groupId -> how its last load went: stages, seconds, when it was shown
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Announce a Change
    // ------------------------------------------------------------
    // kind: 'groups' | 'live-loading' | 'live' | 'loading' | 'progress' |
    //       'ready' | 'failed' | 'evicted'
    // ------------------------------------------------------------
    function Na__PhaseLib__Dispatch(kind, groupId) {
        window.dispatchEvent(new CustomEvent(Na__PhaseLib__CHANGED_EVENT, {
            detail : {
                kind    : kind,
                groupId : groupId || null,
                status  : Na__PhaseLib__GetStatus(groupId),
                liveId  : Na__PhaseLib__LiveId
            }
        }));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Group by Id (null when the project has none by that id)
    // ------------------------------------------------------------
    function Na__PhaseLib__FindGroup(groupId) {
        if (!groupId) return null;
        for (let i = 0; i < Na__PhaseLib__Groups.length; i++) {
            if (Na__PhaseLib__Groups[i].groupId === groupId) return Na__PhaseLib__Groups[i];
        }
        return null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Hold a Caller Until the Live Model Is In
    // ------------------------------------------------------------
    // A phase load never competes with the model the 3D view is loading: the
    // startup load is the one somebody is watching a spinner for.
    // ------------------------------------------------------------
    function Na__PhaseLib__WaitForLive() {
        if (Na__PhaseLib__LiveReady) return Promise.resolve();
        if (!Na__PhaseLib__LiveGate) Na__PhaseLib__LiveGate = new Promise((resolve) => { Na__PhaseLib__LiveOpen = resolve; });
        return Na__PhaseLib__LiveGate;
    }
    function Na__PhaseLib__OpenLiveGate() {
        const open = Na__PhaseLib__LiveOpen;
        Na__PhaseLib__LiveReady = true;
        Na__PhaseLib__LiveGate  = null;
        Na__PhaseLib__LiveOpen  = null;
        if (open) open();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Free a Model Tree's Geometry and Materials
    // ------------------------------------------------------------
    // Exactly what the Design Phase menu does to the phase it replaces.
    // ------------------------------------------------------------
    function Na__PhaseLib__DisposeTree(root) {
        if (!root) return;
        if (root.parent) root.parent.remove(root);
        root.traverse((node) => {
            if (node.geometry) node.geometry.dispose();
            if (!node.material) return;
            (Array.isArray(node.material) ? node.material : [ node.material ]).forEach((material) => material.dispose());
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Let a Cached Phase Go
    // ------------------------------------------------------------
    function Na__PhaseLib__Dispose(entry) {
        if (Na__PhaseLib__Entries.get(entry.groupId) === entry) Na__PhaseLib__Entries.delete(entry.groupId);
        Na__PhaseLib__DisposeTree(entry.root);
        entry.root   = null;
        entry.groups = null;
        entry.status = Na__PhaseLib__STATUS_UNLOADED;
        Na__PhaseLib__Dispatch('evicted', entry.groupId);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Keep the Cache Within Its Limit
    // ------------------------------------------------------------
    // The least recently used phase goes first. A pinned phase is in a render
    // at this moment and is skipped, even if that leaves the cache over.
    // ------------------------------------------------------------
    function Na__PhaseLib__Evict() {
        const ready = [];
        Na__PhaseLib__Entries.forEach((entry) => { if (entry.status === Na__PhaseLib__STATUS_READY) ready.push(entry); });
        const limit = Math.max(Na__PhaseLib__CacheSize, Na__PhaseLib__CacheFloor);
        let excess = ready.length - limit;
        if (excess <= 0) return;

        ready.sort((a, b) => a.lastUsed - b.lastUsed);
        for (let i = 0; i < ready.length && excess > 0; i++) {
            if (ready[i].pins > 0) continue;
            console.log('[TrueVision3D] Design phase let go (cache holds ' + limit + '): ' + ready[i].label);
            Na__PhaseLib__Dispose(ready[i]);
            excess--;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Loading
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Load One Phase Into a Detached Root of Its Own
    // ------------------------------------------------------------
    // Resolves true when the phase can be drawn - loaded here, or found to be
    // the live phase after all - and false when it cannot.
    // ------------------------------------------------------------
    async function Na__PhaseLib__Load(entry, group) {
        let root = null;
        try {
            await Na__PhaseLib__WaitForLive();
            if (Na__PhaseLib__Entries.get(entry.groupId) !== entry) return false;   // <-- Let go while it waited (another project loaded)

            if (Na__PhaseLib__IsLive(entry.groupId)) {                              // <-- The 3D view switched to it meanwhile: nothing to load
                Na__PhaseLib__Entries.delete(entry.groupId);
                entry.status = Na__PhaseLib__STATUS_UNLOADED;
                Na__PhaseLib__Dispatch('ready', entry.groupId);
                return true;
            }

            root = new THREE.Group();
            root.name = 'Na__ModelPhase__' + entry.groupId;
            root.userData.Na__ModelPhaseId = entry.groupId;
            if (Na__PhaseLib__ModelRoot) {                                          // <-- Wherever the live model sits, so does every phase
                root.position.copy(Na__PhaseLib__ModelRoot.position);
                root.quaternion.copy(Na__PhaseLib__ModelRoot.quaternion);
                root.scale.copy(Na__PhaseLib__ModelRoot.scale);
            }
            root.updateMatrixWorld(true);

            const onStatus = (message) => {
                entry.message = String(message || '');
                Na__PhaseLib__Dispatch('progress', entry.groupId);
            };
            const urls      = Na__ModelLoader__SeparateOrbitCubeUrl(group.modelUrls).filteredUrls;   // <-- The orbit cube is the 3D view's, not part of a drawing
            const afterLoad = Na__PhaseLib__AfterLoad;
            const startedAt = performance.now();
            const run       = Na__ModelLoader__StartStagedLoad(urls, root, Na__PhaseLib__ModelsConfig, Na__PhaseLib__LineResolution, {
                statusCallback  : onStatus,
                onCategoryBuilt : (typeof afterLoad === 'function')
                    ? (category, holder) => afterLoad(new Map([ [ category, holder ] ]))             // <-- The materials pass, a category at a time as each is built
                    : null
            });
            const groups    = await run.whenDone();
            Na__PhaseLib__NoteLoadReport(entry.groupId, {
                live       : false,
                stages     : run.stages.map((stage) => ({ name : stage.name, categories : stage.keys.length })),
                progress   : run.getProgress(),
                startedAt  : Math.round(startedAt),
                completeAt : Math.round(performance.now())
            });

            // THE LOADER SWALLOWS A FAILED FILE and carries on, which is right for
            // the 3D view and wrong here: a phase with nothing in it would draw a
            // blank sheet and call it the existing building.
            let meshes = 0;
            root.traverse((node) => { if (node.isMesh) meshes++; });
            if (!groups || groups.size === 0 || meshes === 0) throw new Error('none of its model files loaded');

            if (Na__PhaseLib__Entries.get(entry.groupId) !== entry) {               // <-- Let go while it loaded
                Na__PhaseLib__DisposeTree(root);
                return false;
            }
            root.updateMatrixWorld(true);
            entry.root     = root;
            entry.groups   = groups;
            entry.status   = Na__PhaseLib__STATUS_READY;
            entry.message  = '';
            entry.lastUsed = performance.now();
            console.log('[TrueVision3D] Design phase loaded off-scene: ' + entry.label + ' (' + groups.size + ' categories).');
            Na__PhaseLib__Evict();
            Na__PhaseLib__Dispatch('ready', entry.groupId);
            return true;
        } catch (error) {
            if (root && root !== entry.root) Na__PhaseLib__DisposeTree(root);
            entry.root     = null;
            entry.groups   = null;
            entry.status   = Na__PhaseLib__STATUS_FAILED;
            entry.failedAt = Date.now();
            entry.message  = String((error && error.message) || error);
            console.warn('[TrueVision3D] Design phase could not be loaded: ' + entry.label, error);
            Na__PhaseLib__Dispatch('failed', entry.groupId);
            return false;
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Make Sure a Phase Can Be Drawn, Loading It If Needed
    // ------------------------------------------------------------
    // Resolves true once the phase is drawable (the live phase always is, once
    // it has loaded) and false for an unknown id or a failed load. Asking
    // again while it loads joins the same load.
    // ------------------------------------------------------------
    function Na__PhaseLib__Ensure(groupId) {
        if (Na__PhaseLib__IsLive(groupId)) return Na__PhaseLib__WaitForLive().then(() => true);
        const group = Na__PhaseLib__FindGroup(groupId);
        if (!group) return Promise.resolve(false);

        let entry = Na__PhaseLib__Entries.get(groupId);
        if (entry) {
            entry.lastUsed = performance.now();
            if (entry.status === Na__PhaseLib__STATUS_READY)   return Promise.resolve(true);
            if (entry.status === Na__PhaseLib__STATUS_LOADING) return entry.promise;
            if (entry.status === Na__PhaseLib__STATUS_FAILED && (Date.now() - entry.failedAt) < Na__PhaseLib__RETRY_AFTER_MS) return Promise.resolve(false);
        } else {
            entry = {
                groupId : groupId, label : group.label, status : Na__PhaseLib__STATUS_UNLOADED,
                root : null, groups : null, promise : null, message : '',
                pins : 0, failedAt : 0, lastUsed : performance.now()
            };
            Na__PhaseLib__Entries.set(groupId, entry);
        }

        entry.status  = Na__PhaseLib__STATUS_LOADING;
        entry.message = '';
        const run = Na__PhaseLib__LoadChain.then(() => Na__PhaseLib__Load(entry, group));   // <-- One phase at a time
        Na__PhaseLib__LoadChain = run.catch(() => false);
        entry.promise = run;
        Na__PhaseLib__Dispatch('loading', groupId);
        return run;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - The Register
// -----------------------------------------------------------------------------

    // FUNCTION | The Phase a Project Opens With
    // ------------------------------------------------------------
    // The newest group whose label does not say "existing", else the newest
    // group. Moved here unchanged from the startup load, so the startup load
    // and the Layout Editor's Project Default can never disagree about it.
    // ------------------------------------------------------------
    function Na__PhaseLib__ResolvePreferredIndex(modelGroups) {
        if (!Array.isArray(modelGroups) || modelGroups.length === 0) return 0;

        for (let i = modelGroups.length - 1; i >= 0; i--) {
            const group = modelGroups[i] || {};
            const label = String(group.label || group.groupId || '').toLowerCase();
            if (!label.includes('existing')) {
                return i;                                                            // <-- Prefer latest non-existing concept
            }
        }

        return modelGroups.length - 1;                                               // <-- Fallback: newest item in list
    }
    // ------------------------------------------------------------


    // FUNCTION | Register the Project's Groups
    // ------------------------------------------------------------
    // liveIndex is the group the 3D view is about to load. A group without a
    // groupId answers to its label; two groups never answer to one id.
    // ------------------------------------------------------------
    function Na__PhaseLib__SetGroups(modelGroups, liveIndex) {
        Na__PhaseLib__Entries.forEach((entry) => { if (entry.pins === 0) Na__PhaseLib__Dispose(entry); });   // <-- Phases of a previous project

        const list = Array.isArray(modelGroups) ? modelGroups : [];
        const seen = new Set();
        Na__PhaseLib__RawIds = new WeakMap();
        Na__PhaseLib__LoadReports.clear();
        Na__PhaseLib__Groups = list.map((raw, index) => {
            const source = (raw && typeof raw === 'object') ? raw : {};
            let groupId  = String(source.groupId || source.label || ('ModelGroup_' + (index + 1)));
            if (seen.has(groupId)) groupId += '__' + (index + 1);
            seen.add(groupId);
            if (raw && typeof raw === 'object') Na__PhaseLib__RawIds.set(raw, groupId);
            return { groupId : groupId, label : String(source.label || groupId), modelUrls : Array.isArray(source.modelUrls) ? source.modelUrls.slice() : [], keys : null };
        });

        const preferred = Na__PhaseLib__ResolvePreferredIndex(list);
        Na__PhaseLib__DefaultId = Na__PhaseLib__Groups.length > 0 ? Na__PhaseLib__Groups[preferred].groupId : null;
        const live = (Number.isInteger(liveIndex) && Na__PhaseLib__Groups[liveIndex]) ? Na__PhaseLib__Groups[liveIndex] : null;
        Na__PhaseLib__LiveId = live ? live.groupId : Na__PhaseLib__DefaultId;
        Na__PhaseLib__Dispatch('groups', Na__PhaseLib__LiveId);
    }
    // ------------------------------------------------------------


    // FUNCTION | The 3D View Has Started Loading a Phase
    // ------------------------------------------------------------
    // Off-scene loads wait until it has finished. groupId undefined keeps the
    // id already registered.
    // ------------------------------------------------------------
    function Na__PhaseLib__SetLiveLoading(groupId) {
        if (groupId !== undefined) Na__PhaseLib__LiveId = groupId || null;
        Na__PhaseLib__LiveKeys   = [];
        Na__PhaseLib__LiveGroups = null;
        Na__PhaseLib__LiveReady  = false;
        Na__PhaseLib__Dispatch('live-loading', Na__PhaseLib__LiveId);
    }
    // ------------------------------------------------------------


    // FUNCTION | The 3D View Now Holds a Phase
    // ------------------------------------------------------------
    // loadedGroups is the loader's category Map (null after a failed load).
    // Called after a failure too, so nothing waits for the live model forever.
    // ------------------------------------------------------------
    function Na__PhaseLib__SetLive(groupId, loadedGroups) {
        if (groupId !== undefined) Na__PhaseLib__LiveId = groupId || null;
        Na__PhaseLib__LiveKeys   = (loadedGroups && typeof loadedGroups.keys === 'function') ? Array.from(loadedGroups.keys()) : [];
        Na__PhaseLib__LiveGroups = (loadedGroups && typeof loadedGroups.keys === 'function') ? loadedGroups : null;

        const duplicate = Na__PhaseLib__LiveId ? Na__PhaseLib__Entries.get(Na__PhaseLib__LiveId) : null;
        if (duplicate && duplicate.pins === 0 && duplicate.status !== Na__PhaseLib__STATUS_LOADING) {
            Na__PhaseLib__Dispose(duplicate);                                        // <-- The 3D view holds it now: an off-scene copy is memory for nothing
        }

        Na__PhaseLib__OpenLiveGate();
        Na__PhaseLib__Dispatch('live', Na__PhaseLib__LiveId);
    }
    // ------------------------------------------------------------


    // FUNCTION | Put a Loaded Phase Into the 3D View and Keep the One It Replaces
    // ------------------------------------------------------------
    // No file is fetched: the cached phase's categories move under the model
    // root in their own order, and the phase that was there moves into a root
    // of its own and stays in the cache, its visibility put back to how it
    // loaded (storeys switched off, culled furniture and isolated objects all
    // return). The caller rebinds the model-bound systems to the Map this
    // returns and then calls SetLive, exactly as after a load.
    //
    // Returns the category Map of the phase now in the 3D view, or null when
    // nothing was swapped: the phase is not loaded, a render has it pinned, it
    // is already live, or the live model is still loading. On null the caller
    // loads the phase as it always did.
    // ------------------------------------------------------------
    function Na__PhaseLib__SwapLive(groupId) {
        const modelRoot = Na__PhaseLib__ModelRoot;
        if (!modelRoot || !Na__PhaseLib__LiveReady) return null;
        if (!groupId || Na__PhaseLib__IsLive(groupId)) return null;
        const entry = Na__PhaseLib__GetReadyEntry(groupId);
        if (!entry || entry.pins > 0 || !entry.root || !entry.groups) return null;

        const outgoingId     = Na__PhaseLib__LiveId;
        const outgoingGroup  = Na__PhaseLib__FindGroup(outgoingId);
        const outgoingGroups = Na__PhaseLib__LiveGroups;

        // THE PHASE LEAVING | Into a root of its own, as it loaded
        let stash = null;
        if (outgoingGroup && outgoingGroups && outgoingGroups.size > 0) {
            const root = new THREE.Group();
            root.name = 'Na__ModelPhase__' + outgoingId;
            root.userData.Na__ModelPhaseId = outgoingId;
            root.position.copy(modelRoot.position);
            root.quaternion.copy(modelRoot.quaternion);
            root.scale.copy(modelRoot.scale);
            while (modelRoot.children.length > 0) root.add(modelRoot.children[0]);      // <-- In order: the fingerprint reads the categories in it
            Na__ModelLoader__RestoreLoadedVisibility(root);
            root.updateMatrixWorld(true);
            stash = {
                groupId : outgoingId, label : outgoingGroup.label, status : Na__PhaseLib__STATUS_READY,
                root : root, groups : outgoingGroups, promise : null, message : '',
                pins : 0, failedAt : 0, lastUsed : performance.now()
            };
        } else {
            while (modelRoot.children.length > 0) Na__PhaseLib__DisposeTree(modelRoot.children[0]);   // <-- Nothing known about it to keep: let it go as the menu always did
        }

        // THE PHASE ARRIVING | Its categories under the model root, in their own order
        const arriving = entry.groups;
        Na__PhaseLib__Entries.delete(groupId);
        while (entry.root.children.length > 0) modelRoot.add(entry.root.children[0]);
        modelRoot.updateMatrixWorld(true);
        entry.root   = null;
        entry.groups = null;
        entry.status = Na__PhaseLib__STATUS_UNLOADED;

        Na__PhaseLib__LiveId     = groupId;
        Na__PhaseLib__LiveGroups = arriving;
        Na__PhaseLib__LiveKeys   = Array.from(arriving.keys());

        if (stash) {
            const earlier = Na__PhaseLib__Entries.get(outgoingId);
            if (earlier && earlier !== stash && earlier.status !== Na__PhaseLib__STATUS_LOADING) Na__PhaseLib__Dispose(earlier);
            Na__PhaseLib__Entries.set(outgoingId, stash);
            console.log('[TrueVision3D] Design phase kept loaded off-scene: ' + stash.label);
            Na__PhaseLib__Dispatch('ready', outgoingId);                                 // <-- Its fingerprints are read while nothing has it
            Na__PhaseLib__Evict();
        }
        return arriving;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Existing Building's Phase (null when the project has none)
    // ------------------------------------------------------------
    // The newest group whose label says "existing": the same word the default
    // phase rule reads, so the two can never disagree about which group it is.
    // ------------------------------------------------------------
    function Na__PhaseLib__GetExistingId() {
        for (let i = Na__PhaseLib__Groups.length - 1; i >= 0; i--) {
            const group = Na__PhaseLib__Groups[i];
            if (String(group.label || group.groupId || '').toLowerCase().includes('existing')) return group.groupId;
        }
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Phase's Short Name, for a Label on the Model
    // ------------------------------------------------------------
    // "Concept Design - Scheme-02" reads "Scheme-02": the part after the last
    // " - ", else the whole label.
    // ------------------------------------------------------------
    function Na__PhaseLib__GetShortLabel(groupId) {
        const label = Na__PhaseLib__GetLabel(groupId);
        const parts = label.split(' - ').map((part) => part.trim()).filter((part) => part.length > 0);
        return parts.length > 0 ? parts[parts.length - 1] : label;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Existing and Proposed Pair (null when the project has not both)
    // ------------------------------------------------------------
    // before is the existing building. after is the phase in the 3D view, or
    // the project's default phase when the 3D view holds the existing building.
    // otherId is whichever of the two the 3D view does NOT hold: the one to
    // load off-scene. schemes counts the phases that are not the existing
    // building, so a label can name the scheme only when there is a choice.
    // ------------------------------------------------------------
    function Na__PhaseLib__GetComparePair() {
        const beforeId = Na__PhaseLib__GetExistingId();
        if (!beforeId) return null;

        const liveId  = Na__PhaseLib__LiveId;
        const afterId = (liveId && liveId !== beforeId && Na__PhaseLib__HasGroup(liveId)) ? liveId : Na__PhaseLib__DefaultId;
        if (!afterId || afterId === beforeId) return null;                               // <-- A project whose only phase is the existing building

        let schemes = 0;
        Na__PhaseLib__Groups.forEach((group) => {
            if (!String(group.label || group.groupId || '').toLowerCase().includes('existing')) schemes++;
        });

        return {
            beforeId    : beforeId,
            afterId     : afterId,
            otherId     : (liveId === beforeId) ? afterId : beforeId,
            liveIsAfter : liveId !== beforeId,
            beforeLabel : Na__PhaseLib__GetLabel(beforeId),
            afterLabel  : Na__PhaseLib__GetLabel(afterId),
            afterShort  : Na__PhaseLib__GetShortLabel(afterId),
            schemes     : schemes
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Readers
    // ------------------------------------------------------------
    function Na__PhaseLib__GetGroups()        { return Na__PhaseLib__Groups.map((group) => ({ groupId : group.groupId, label : group.label })); }
    function Na__PhaseLib__HasGroup(groupId)  { return !!Na__PhaseLib__FindGroup(groupId); }
    function Na__PhaseLib__GetLabel(groupId)  { const group = Na__PhaseLib__FindGroup(groupId); return group ? group.label : ''; }
    function Na__PhaseLib__GetDefaultId()     { return Na__PhaseLib__DefaultId; }
    function Na__PhaseLib__GetLiveId()        { return Na__PhaseLib__LiveId; }
    function Na__PhaseLib__IsLiveReady()      { return Na__PhaseLib__LiveReady; }
    function Na__PhaseLib__IdOf(rawGroup)     { return (rawGroup && typeof rawGroup === 'object' && Na__PhaseLib__RawIds.has(rawGroup)) ? Na__PhaseLib__RawIds.get(rawGroup) : null; }
    function Na__PhaseLib__GetMessage(groupId) { const entry = Na__PhaseLib__Entries.get(groupId); return entry ? entry.message : ''; }
    // ------------------------------------------------------------


    // FUNCTION | Is This the Phase the 3D View Holds?
    // ------------------------------------------------------------
    // No id at all means the live model, which is also every answer on a
    // project that has no model groups.
    // ------------------------------------------------------------
    function Na__PhaseLib__IsLive(groupId) {
        if (!groupId) return true;
        return groupId === Na__PhaseLib__LiveId;
    }
    // ------------------------------------------------------------


    // FUNCTION | Where a Phase Stands
    // ------------------------------------------------------------
    // 'live' | 'ready' | 'loading' | 'failed' | 'unloaded'
    // ------------------------------------------------------------
    function Na__PhaseLib__GetStatus(groupId) {
        if (Na__PhaseLib__IsLive(groupId)) return Na__PhaseLib__LiveReady ? Na__PhaseLib__STATUS_LIVE : Na__PhaseLib__STATUS_LOADING;
        const entry = Na__PhaseLib__Entries.get(groupId);
        return entry ? entry.status : Na__PhaseLib__STATUS_UNLOADED;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Loaded Off-Scene Phase (null unless it is loaded and not live)
    // ------------------------------------------------------------
    // entry: { groupId, label, root, groups, pins, ... }. root is the phase's
    // own model root; groups is the loader's category Map for it.
    // ------------------------------------------------------------
    function Na__PhaseLib__GetReadyEntry(groupId) {
        if (Na__PhaseLib__IsLive(groupId)) return null;
        const entry = Na__PhaseLib__Entries.get(groupId);
        return (entry && entry.status === Na__PhaseLib__STATUS_READY) ? entry : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Model Root a Phase Is Drawn From (null while it is not loaded)
    // ------------------------------------------------------------
    function Na__PhaseLib__GetRoot(groupId) {
        if (Na__PhaseLib__IsLive(groupId)) return Na__PhaseLib__ModelRoot;
        const entry = Na__PhaseLib__GetReadyEntry(groupId);
        if (!entry) return null;
        entry.lastUsed = performance.now();
        return entry.root;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Phase's Model Category Keys
    // ------------------------------------------------------------
    // Loaded: its own categories. Not loaded yet: the loader's reading of its
    // GLB file names, in the loader's order, so a panel can list a phase's
    // categories without waiting for its model.
    // ------------------------------------------------------------
    function Na__PhaseLib__GetCategoryKeys(groupId) {
        if (Na__PhaseLib__IsLive(groupId)) return Na__PhaseLib__LiveKeys.slice();
        const entry = Na__PhaseLib__GetReadyEntry(groupId);
        if (entry) return Array.from(entry.groups.keys());
        const group = Na__PhaseLib__FindGroup(groupId);
        if (!group) return [];
        if (!group.keys) {
            const found   = Na__ModelLoader__ClassifyUrls(Na__ModelLoader__SeparateOrbitCubeUrl(group.modelUrls).filteredUrls);
            const order   = Array.isArray(Na__ModelCategories__LoadOrder) ? Na__ModelCategories__LoadOrder : [];
            const ordered = order.filter((key) => Object.prototype.hasOwnProperty.call(found, key));
            Object.keys(found).forEach((key) => { if (ordered.indexOf(key) === -1) ordered.push(key); });
            group.keys = ordered;                                                    // <-- Classified once: it warns about every unrecognised file
        }
        return group.keys.slice();
    }
    // ------------------------------------------------------------


    // FUNCTION | Pin a Phase While a Render Has It in the Scene
    // ------------------------------------------------------------
    function Na__PhaseLib__Pin(groupId) {
        const entry = Na__PhaseLib__GetReadyEntry(groupId);
        if (!entry) return null;
        entry.pins++;
        entry.lastUsed = performance.now();
        return entry;
    }
    function Na__PhaseLib__Unpin(groupId) {
        const entry = Na__PhaseLib__Entries.get(groupId);
        if (entry && entry.pins > 0) entry.pins--;
    }
    // ------------------------------------------------------------


    // FUNCTION | How Many Off-Scene Phases May Stay Loaded
    // ------------------------------------------------------------
    function Na__PhaseLib__SetCacheLimit(limit) {
        if (!Number.isFinite(limit) || limit < 1) return false;
        Na__PhaseLib__CacheSize = Math.floor(limit);
        Na__PhaseLib__Evict();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Record and Read How a Phase's Load Went
    // ------------------------------------------------------------
    // report: { live, stages : [ { name, categories } ], progress (the staged
    // load's own), startedAt, firstLookAt (the live phase only), completeAt },
    // times in milliseconds since the page opened. The loading sequence
    // records the 3D view's model; an off-scene phase records its own. Read
    // by anything that wants to say what loaded when - the TrueVision MCP's
    // tv3d_load_report among them.
    // ------------------------------------------------------------
    function Na__PhaseLib__NoteLoadReport(groupId, report) {
        const key = String(groupId || '');
        Na__PhaseLib__LoadReports.set(key, Object.assign({ groupId : groupId || null, label : Na__PhaseLib__GetLabel(groupId) }, report || {}));
    }
    function Na__PhaseLib__GetLoadReports() {
        return Array.from(Na__PhaseLib__LoadReports.values());
    }
    // ------------------------------------------------------------


    // FUNCTION | The Fewest Off-Scene Phases That Must Be Allowed to Stay
    // ------------------------------------------------------------
    // The Existing and Proposed comparison needs its other half kept, and a
    // phase the Design Phase menu has shown should come back at once. A limit
    // set below this is raised to it; one set above it stands.
    // ------------------------------------------------------------
    function Na__PhaseLib__SetCacheFloor(floor) {
        if (!Number.isFinite(floor) || floor < 1) return false;
        Na__PhaseLib__CacheFloor = Math.floor(floor);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Register the Load Context
    // ------------------------------------------------------------
    // context: { modelRoot, modelsConfig, lineResolution, afterLoad }
    // afterLoad(loadedGroups) is the materials pass the startup load runs.
    // ------------------------------------------------------------
    function Na__PhaseLib__Initialize(context) {
        if (!context) return false;
        Na__PhaseLib__ModelRoot      = context.modelRoot || null;
        Na__PhaseLib__ModelsConfig   = context.modelsConfig || null;
        Na__PhaseLib__LineResolution = context.lineResolution || null;
        Na__PhaseLib__AfterLoad      = (typeof context.afterLoad === 'function') ? context.afterLoad : null;
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Design Phase Library API
    // ------------------------------------------------------------
    export {
        Na__PhaseLib__CHANGED_EVENT,
        Na__PhaseLib__Initialize,
        Na__PhaseLib__ResolvePreferredIndex,
        Na__PhaseLib__SetGroups,
        Na__PhaseLib__SetLiveLoading,
        Na__PhaseLib__SetLive,
        Na__PhaseLib__GetGroups,
        Na__PhaseLib__HasGroup,
        Na__PhaseLib__GetLabel,
        Na__PhaseLib__GetDefaultId,
        Na__PhaseLib__GetLiveId,
        Na__PhaseLib__IsLive,
        Na__PhaseLib__IsLiveReady,
        Na__PhaseLib__IdOf,
        Na__PhaseLib__GetStatus,
        Na__PhaseLib__GetMessage,
        Na__PhaseLib__GetReadyEntry,
        Na__PhaseLib__GetRoot,
        Na__PhaseLib__GetCategoryKeys,
        Na__PhaseLib__Ensure,
        Na__PhaseLib__Pin,
        Na__PhaseLib__Unpin,
        Na__PhaseLib__SetCacheLimit,
        Na__PhaseLib__SetCacheFloor,
        Na__PhaseLib__NoteLoadReport,
        Na__PhaseLib__GetLoadReports,
        Na__PhaseLib__SwapLive,
        Na__PhaseLib__GetExistingId,
        Na__PhaseLib__GetShortLabel,
        Na__PhaseLib__GetComparePair
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
