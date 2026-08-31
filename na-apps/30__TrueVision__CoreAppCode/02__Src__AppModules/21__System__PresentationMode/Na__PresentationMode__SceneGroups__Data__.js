// =============================================================================
// TRUEVISION3D - PRESENTATION MODE - SCENE GROUPS DATA LAYER
// =============================================================================
//
// FILE       : Na__PresentationMode__SceneGroups__Data__.js
// NAMESPACE  : Na__PmGroups
// MODULE     : PresentationMode - Scene Groups Data Layer
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Read, validate and normalise the per-project scene group
//              definitions, and resolve every scene to exactly one group
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - Scene groups let a large model split its saved camera scenes into named
//   sets (Exterior 3D Views, Interior 3D Views, Dollhouse View, Floor Plans...)
//   so the carousel shows one coherent set at a time rather than every scene
//   the project has ever had.
// - Group definitions live INSIDE the project's existing
//   PresentationMode__SavedCameraScenes block, under the __Groups key. Nesting
//   is deliberate: that block is already listed in every dev-owned-key allow
//   list (Na__DevSavedKeys in the loading sequence, DEV_OWNED_PROJECT_DATA_KEYS
//   in CloudflareR2__ModelSync__Main__.py and TRUEVISION_DEV_OWNED_KEYS in
//   ProjectVision__BuildScript__.py), so groups ride the existing R2 overlay,
//   build-preserve and merge-save path with none of those lists changed. A new
//   top-level key would have needed all three edited in lockstep or a build
//   would silently wipe the groups.
// - Scene order is per-group: PresentationMode__Scene__Order restarts at 1
//   inside each group. The playback order used for cycling is therefore
//   (Group__Order, Scene__Order), never Scene__Order alone.
// - A scene whose GroupId is missing or names a group that is absent or
//   disabled resolves to the first enabled group, so nothing can ever vanish
//   from the carousel. Projects authored before this feature existed have no
//   GroupId on any scene and therefore behave exactly as they did.
// - Pure data layer: no DOM, no camera, and no imports from the rest of
//   Presentation Mode, so the dependency direction stays one-way
//   (SceneData -> SceneGroups, never back).
//
// INTEGRATION:
// - Na__PresentationMode__SceneGroups__Initialize() is awaited once from
//   Index.html; it loads this module's own AppConfig JSON.
// - Consumed by the carousel, the floating group selector bar, the scene data
//   layer's group-aware sort, and both Dev menu editors.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 31-Aug-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | This System's Own AppConfig Location
    // ------------------------------------------------------------
    const Na__PmGroups__ConfigUrl = new URL('./Na__PresentationMode__SceneGroups__AppConfig__.json', import.meta.url);
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Project JSON Key Names
    // ------------------------------------------------------------
    const Na__PmGroups__GROUPS_KEY        = 'PresentationMode__SavedCameraScenes__Groups'; // <-- Groups array, nested in the scenes block
    const Na__PmGroups__SCENES_KEY        = 'PresentationMode__SavedCameraScenes__Scenes'; // <-- Sibling scenes array
    const Na__PmGroups__GROUP_ID_KEY      = 'PresentationMode__Group__Id';                 // <-- Group identity
    const Na__PmGroups__GROUP_NAME_KEY    = 'PresentationMode__Group__Name';               // <-- User-facing group name
    const Na__PmGroups__GROUP_ORDER_KEY   = 'PresentationMode__Group__Order';              // <-- Group position, 1-based
    const Na__PmGroups__GROUP_ENABLED_KEY = 'PresentationMode__Group__Enabled';            // <-- Group available in this project
    const Na__PmGroups__SCENE_GROUP_KEY   = 'PresentationMode__Scene__GroupId';            // <-- Per-scene group assignment
    const Na__PmGroups__SCENE_ID_KEY      = 'PresentationMode__Scene__Id';                 // <-- Scene identity
    const Na__PmGroups__SCENE_ORDER_KEY   = 'PresentationMode__Scene__Order';              // <-- Scene position WITHIN its group
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Sort Fallbacks
    // ------------------------------------------------------------
    const Na__PmGroups__UNORDERED_SORT_KEY = 999;   // <-- Applied to any record missing a numeric Order
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Loaded Config and Active Selection
    // ------------------------------------------------------------
    // The config is loaded once at boot. Until it arrives (and permanently if
    // the fetch fails) the system reports itself disabled, which makes every
    // consumer fall back to the pre-groups behaviour rather than break.
    // ------------------------------------------------------------
    let Na__PmGroups__Config        = null;   // <-- Parsed AppConfig JSON, null until loaded
    let Na__PmGroups__LoadPromise   = null;   // <-- In-flight (or settled) config fetch, so it happens exactly once
    let Na__PmGroups__ActiveGroupId = null;   // <-- Group the carousel is currently showing
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Config Loading
// -----------------------------------------------------------------------------

    // FUNCTION | Load This System's Own AppConfig
    // ------------------------------------------------------------
    // Idempotent, and safe to call from more than one place: the first call
    // owns the fetch and every later caller awaits that same promise, so the
    // config is never fetched twice and never half-read.
    // ------------------------------------------------------------
    function Na__PresentationMode__SceneGroups__Initialize() {
        if (!Na__PmGroups__LoadPromise) {
            Na__PmGroups__LoadPromise = Na__PmGroups__FetchConfig();
        }
        return Na__PmGroups__LoadPromise;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fetch and Parse the Config File Once
    // ------------------------------------------------------------
    async function Na__PmGroups__FetchConfig() {
        try {
            const response = await fetch(Na__PmGroups__ConfigUrl);
            if (!response.ok) {
                console.warn(`[TrueVision3D] Scene groups config fetch failed (${response.status}) - grouping disabled.`);
                return false;
            }
            Na__PmGroups__Config = await response.json();
            return Na__PresentationMode__SceneGroups__IsEnabled();
        } catch (error) {
            console.warn('[TrueVision3D] Scene groups config unreadable - grouping disabled.', error);
            return false;                                                    // <-- Carousel falls back to its pre-groups behaviour
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the Grouping System Available?
    // ------------------------------------------------------------
    function Na__PresentationMode__SceneGroups__IsEnabled() {
        return Boolean(Na__PmGroups__Config)
            && Na__PmGroups__Config.PresentationMode__SceneGroups__Enabled === true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Behaviour Flags Block
    // ------------------------------------------------------------
    function Na__PresentationMode__SceneGroups__GetBehaviour() {
        return (Na__PmGroups__Config && Na__PmGroups__Config.PresentationMode__SceneGroups__Behaviour) || {};
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the User-Facing Label Block
    // ------------------------------------------------------------
    function Na__PresentationMode__SceneGroups__GetLabels() {
        return (Na__PmGroups__Config && Na__PmGroups__Config.PresentationMode__SceneGroups__Labels) || {};
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Dev Menu Wording Block
    // ------------------------------------------------------------
    function Na__PresentationMode__SceneGroups__GetDevMenuLabels() {
        return (Na__PmGroups__Config && Na__PmGroups__Config.PresentationMode__SceneGroups__DevMenu) || {};
    }
    // ------------------------------------------------------------


    // FUNCTION | Format a Scene Count for Display Beside a Group Name
    // ------------------------------------------------------------
    // Always carries the word "Views". A bare number sitting next to a group
    // name reads as a position in an ordered list - "Exterior 3D Views  3"
    // looks like the third item rather than a group holding three views.
    // Singular and zero have their own templates so the wording stays correct.
    // ------------------------------------------------------------
    function Na__PresentationMode__SceneGroups__FormatViewCount(count) {
        const labels = Na__PresentationMode__SceneGroups__GetLabels();
        const safe   = Number.isFinite(count) ? count : 0;

        if (safe === 0) return labels.SceneGroups__Labels__ViewCountFormatZero || 'No views';

        const template = (safe === 1)
            ? (labels.SceneGroups__Labels__ViewCountFormatSingular || '{count} View')
            : (labels.SceneGroups__Labels__ViewCountFormat         || '{count} Views');

        return template.replace('{count}', String(safe));
    }
    // ------------------------------------------------------------


    // FUNCTION | Get a Fresh Copy of the Configured Default Group Set
    // ------------------------------------------------------------
    // Deep cloned so a caller writing these into a project's JSON can never
    // mutate the loaded config and leak edits into the next project.
    // ------------------------------------------------------------
    function Na__PresentationMode__SceneGroups__GetDefaultGroups() {
        const defaults = (Na__PmGroups__Config && Na__PmGroups__Config.PresentationMode__SceneGroups__DefaultGroups) || [];
        return JSON.parse(JSON.stringify(defaults));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Group Validation and Reading
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Validate a Single Group Object
    // ------------------------------------------------------------
    function Na__PmGroups__IsValidGroup(group) {
        if (!group || typeof group !== 'object') return false;

        const id   = group[Na__PmGroups__GROUP_ID_KEY];
        const name = group[Na__PmGroups__GROUP_NAME_KEY];

        if (!id   || typeof id   !== 'string') return false;                 // <-- Id must exist
        if (!name || typeof name !== 'string') return false;                 // <-- Name must exist

        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Sort a Group Array by Order Field (ascending)
    // ------------------------------------------------------------
    function Na__PmGroups__SortByGroupOrder(groups) {
        return [...groups].sort((a, b) => {
            const orderA = Number.isFinite(a[Na__PmGroups__GROUP_ORDER_KEY]) ? a[Na__PmGroups__GROUP_ORDER_KEY] : Na__PmGroups__UNORDERED_SORT_KEY;
            const orderB = Number.isFinite(b[Na__PmGroups__GROUP_ORDER_KEY]) ? b[Na__PmGroups__GROUP_ORDER_KEY] : Na__PmGroups__UNORDERED_SORT_KEY;
            return orderA - orderB;                                          // <-- Ascending
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Get All Valid Groups from a Scene Config, Sorted by Order
    // ------------------------------------------------------------
    function Na__PresentationMode__SceneGroups__GetGroups(sceneConfig) {
        if (!sceneConfig || typeof sceneConfig !== 'object') return [];

        const raw = sceneConfig[Na__PmGroups__GROUPS_KEY];
        if (!Array.isArray(raw)) return [];                                  // <-- Project predates grouping

        return Na__PmGroups__SortByGroupOrder(raw.filter(Na__PmGroups__IsValidGroup));
    }
    // ------------------------------------------------------------


    // FUNCTION | Get Only the Enabled Groups, Sorted by Order
    // ------------------------------------------------------------
    function Na__PresentationMode__SceneGroups__GetEnabledGroups(sceneConfig) {
        return Na__PresentationMode__SceneGroups__GetGroups(sceneConfig)
            .filter(group => group[Na__PmGroups__GROUP_ENABLED_KEY] !== false); // <-- Absent flag reads as enabled
    }
    // ------------------------------------------------------------


    // FUNCTION | Get a Single Group by Id
    // ------------------------------------------------------------
    function Na__PresentationMode__SceneGroups__GetGroupById(sceneConfig, groupId) {
        if (!groupId) return null;
        return Na__PresentationMode__SceneGroups__GetGroups(sceneConfig)
            .find(group => group[Na__PmGroups__GROUP_ID_KEY] === groupId) || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Fallback Group Id (first enabled group)
    // ------------------------------------------------------------
    // Every scene that names no group, or names one that has been deleted or
    // switched off, lands here. Returns null when the project has no groups at
    // all, which is the signal to treat the whole project as one flat list.
    // ------------------------------------------------------------
    function Na__PresentationMode__SceneGroups__GetFallbackGroupId(sceneConfig) {
        const enabled = Na__PresentationMode__SceneGroups__GetEnabledGroups(sceneConfig);
        return enabled.length > 0 ? enabled[0][Na__PmGroups__GROUP_ID_KEY] : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Resolve Which Group a Scene Actually Belongs To
    // ------------------------------------------------------------
    // Honours the scene's own GroupId only when it names a group that exists
    // AND is enabled; otherwise the scene falls back to the first enabled
    // group so it can never disappear from the carousel.
    // ------------------------------------------------------------
    function Na__PresentationMode__SceneGroups__ResolveSceneGroupId(scene, sceneConfig) {
        const fallbackId = Na__PresentationMode__SceneGroups__GetFallbackGroupId(sceneConfig);
        if (!scene || typeof scene !== 'object') return fallbackId;

        const declaredId = scene[Na__PmGroups__SCENE_GROUP_KEY];
        if (!declaredId) return fallbackId;                                  // <-- Unassigned (all pre-grouping scenes)

        const group = Na__PresentationMode__SceneGroups__GetGroupById(sceneConfig, declaredId);
        if (!group) return fallbackId;                                       // <-- Names a deleted group
        if (group[Na__PmGroups__GROUP_ENABLED_KEY] === false) return fallbackId; // <-- Names a switched-off group

        return declaredId;
    }
    // ------------------------------------------------------------


    // FUNCTION | Should the Group Selector Bar Be Shown At All?
    // ------------------------------------------------------------
    // A project with a single group looks and behaves exactly as it did before
    // this feature existed - the bar only earns its space once there is
    // somewhere else to go.
    // ------------------------------------------------------------
    function Na__PresentationMode__SceneGroups__ShouldShowBar(sceneConfig) {
        if (!Na__PresentationMode__SceneGroups__IsEnabled()) return false;

        const enabledCount = Na__PresentationMode__SceneGroups__GetEnabledGroups(sceneConfig).length;
        const behaviour    = Na__PresentationMode__SceneGroups__GetBehaviour();

        if (behaviour.SceneGroups__Behaviour__HideBarWhenSingleGroup === false) {
            return enabledCount > 0;                                         // <-- Always show while any group exists
        }
        return enabledCount > 1;                                             // <-- Default: hide until a second group is on
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Scene Ordering (per-group)
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Sort a Scenes Array by Scene Order (ascending)
    // ------------------------------------------------------------
    function Na__PmGroups__SortBySceneOrder(scenes) {
        return [...scenes].sort((a, b) => {
            const orderA = Number.isFinite(a[Na__PmGroups__SCENE_ORDER_KEY]) ? a[Na__PmGroups__SCENE_ORDER_KEY] : Na__PmGroups__UNORDERED_SORT_KEY;
            const orderB = Number.isFinite(b[Na__PmGroups__SCENE_ORDER_KEY]) ? b[Na__PmGroups__SCENE_ORDER_KEY] : Na__PmGroups__UNORDERED_SORT_KEY;
            return orderA - orderB;                                          // <-- Ascending, within one group
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Rank a Scene by How It Came to Be in This Group
    // ------------------------------------------------------------
    // Scene Order restarts at 1 in every group, so two scenes from different
    // groups can both hold Order 1. If a group is switched off with scenes
    // still pointing at it, those scenes fall back into another group and their
    // orders would collide with the ones already there - sorting on Order alone
    // would interleave the two sets into an unpredictable sequence.
    //
    // This gives every scene a primary sort key first: 0 for the scenes that
    // genuinely belong to this group, and 1 + the origin group's Order for
    // those that arrived by fallback. Natives therefore keep their authored
    // sequence intact and refugees queue up behind them, clustered by where
    // they came from. The Dev menu reassigns and renumbers before it lets a
    // group be switched off, so this only ever matters for hand-edited JSON -
    // but it makes that case deterministic rather than merely non-destructive.
    // ------------------------------------------------------------
    function Na__PmGroups__GetGroupMembershipRank(scene, sceneConfig, groupId) {
        const declaredId = scene[Na__PmGroups__SCENE_GROUP_KEY];
        if (!declaredId || declaredId === groupId) return 0;                 // <-- Native to this group

        const declaredGroup = Na__PresentationMode__SceneGroups__GetGroupById(sceneConfig, declaredId);
        const declaredOrder = (declaredGroup && Number.isFinite(declaredGroup[Na__PmGroups__GROUP_ORDER_KEY]))
            ? declaredGroup[Na__PmGroups__GROUP_ORDER_KEY]
            : Na__PmGroups__UNORDERED_SORT_KEY;

        return 1 + declaredOrder;                                            // <-- Arrived by fallback; queue behind the natives
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Scenes Belonging to One Group, in Playback Order
    // ------------------------------------------------------------
    function Na__PresentationMode__SceneGroups__GetScenesInGroup(scenes, sceneConfig, groupId) {
        if (!Array.isArray(scenes)) return [];

        const inGroup = scenes.filter(scene =>
            Na__PresentationMode__SceneGroups__ResolveSceneGroupId(scene, sceneConfig) === groupId
        );

        return [...inGroup].sort((a, b) => {
            const rankA = Na__PmGroups__GetGroupMembershipRank(a, sceneConfig, groupId);
            const rankB = Na__PmGroups__GetGroupMembershipRank(b, sceneConfig, groupId);
            if (rankA !== rankB) return rankA - rankB;                       // <-- Natives first, then each origin group in turn

            const orderA = Number.isFinite(a[Na__PmGroups__SCENE_ORDER_KEY]) ? a[Na__PmGroups__SCENE_ORDER_KEY] : Na__PmGroups__UNORDERED_SORT_KEY;
            const orderB = Number.isFinite(b[Na__PmGroups__SCENE_ORDER_KEY]) ? b[Na__PmGroups__SCENE_ORDER_KEY] : Na__PmGroups__UNORDERED_SORT_KEY;
            return orderA - orderB;                                          // <-- Then by authored position
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Full Playback Order: (Group Order, then Scene Order)
    // ------------------------------------------------------------
    // This is the sequence the prev/next chevrons walk. Because it is grouped
    // first, running off the end of one group steps straight into the first
    // scene of the next - which is exactly the nudge that makes a viewer
    // discover the other groups exist.
    //
    // Falls back to a plain Scene__Order sort when the project has no groups,
    // so a pre-grouping project behaves identically to before.
    // ------------------------------------------------------------
    function Na__PresentationMode__SceneGroups__SortScenesForPlayback(scenes, sceneConfig) {
        if (!Array.isArray(scenes)) return [];

        const enabledGroups = Na__PresentationMode__SceneGroups__GetEnabledGroups(sceneConfig);
        if (enabledGroups.length === 0) {
            return Na__PmGroups__SortBySceneOrder(scenes);                   // <-- Ungrouped project: legacy behaviour
        }

        const ordered = [];
        enabledGroups.forEach((group) => {
            const groupId = group[Na__PmGroups__GROUP_ID_KEY];
            ordered.push(...Na__PresentationMode__SceneGroups__GetScenesInGroup(scenes, sceneConfig, groupId));
        });
        return ordered;
    }
    // ------------------------------------------------------------


    // FUNCTION | Renumber Scene Order to 1..N Within Each Group
    // ------------------------------------------------------------
    // Mutates the passed scenes in place and writes an explicit GroupId onto
    // every scene. Called by the Dev editor before any save, so what lands in
    // the project JSON is always fully resolved rather than relying on the
    // runtime fallback - a group renamed or reordered later cannot then move a
    // scene that was never explicitly assigned.
    //
    // ARRAY POSITION IS THE INTENT. This walks the array exactly as given and
    // stamps a per-group counter onto it; it must never sort first. The whole
    // reorder system (arrows, drag, Position field) works by splicing the
    // working array and then calling this to write the new positions out - so
    // re-sorting by the existing Order here would read back the pre-move
    // sequence and silently undo every move, while the save still fired.
    // Callers that want a sorted starting point sort BEFORE calling this, which
    // is what the Dev panel's render does.
    // ------------------------------------------------------------
    function Na__PresentationMode__SceneGroups__NormaliseOrderWithinGroups(scenes, sceneConfig) {
        if (!Array.isArray(scenes)) return [];

        const fallbackId = Na__PresentationMode__SceneGroups__GetFallbackGroupId(sceneConfig);
        if (!fallbackId) {
            scenes.forEach((scene, index) => { scene[Na__PmGroups__SCENE_ORDER_KEY] = index + 1; });
            return scenes;                                                   // <-- No groups defined: flat 1..N as before
        }

        const counters = new Map();

        scenes.forEach((scene) => {                                          // <-- In array order, deliberately unsorted
            const groupId = Na__PresentationMode__SceneGroups__ResolveSceneGroupId(scene, sceneConfig);
            const next    = (counters.get(groupId) || 0) + 1;
            counters.set(groupId, next);

            scene[Na__PmGroups__SCENE_GROUP_KEY] = groupId;                  // <-- Make the assignment explicit in the JSON
            scene[Na__PmGroups__SCENE_ORDER_KEY] = next;                     // <-- Restart at 1 in every group
        });

        return scenes;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Playback Stepping (cross-group cycling)
// -----------------------------------------------------------------------------

    // FUNCTION | Get the Scene at One End of a Group
    // ------------------------------------------------------------
    // edge: 'first' | 'last'. Used when the viewer has picked a group from the
    // dropdown without moving the camera - the next chevron then starts that
    // group from the top rather than resuming an off-screen position.
    // ------------------------------------------------------------
    function Na__PresentationMode__SceneGroups__GetGroupEdgeScene(scenes, sceneConfig, groupId, edge) {
        const inGroup = Na__PresentationMode__SceneGroups__GetScenesInGroup(scenes, sceneConfig, groupId);
        if (inGroup.length === 0) return null;
        return edge === 'last' ? inGroup[inGroup.length - 1] : inGroup[0];
    }
    // ------------------------------------------------------------


    // FUNCTION | Step Through the Playback Order, Crossing Group Boundaries
    // ------------------------------------------------------------
    // Returns { scene, groupId } for the scene `offset` steps from the active
    // one, wrapping at both ends of the whole project. The returned groupId
    // tells the caller which group to display, which is how the selector bar
    // relabels itself as the viewer cycles off the end of a group.
    //
    // Honours the CycleAcrossGroups behaviour flag: with it off, stepping wraps
    // inside the active group and never leaves it.
    // ------------------------------------------------------------
    function Na__PresentationMode__SceneGroups__GetAdjacentScene(scenes, sceneConfig, activeSceneId, offset) {
        const behaviour   = Na__PresentationMode__SceneGroups__GetBehaviour();
        const crossGroups = behaviour.SceneGroups__Behaviour__CycleAcrossGroups !== false;

        const sequence = crossGroups
            ? Na__PresentationMode__SceneGroups__SortScenesForPlayback(scenes, sceneConfig)
            : Na__PresentationMode__SceneGroups__GetScenesInGroup(scenes, sceneConfig, Na__PresentationMode__SceneGroups__GetActiveGroupId());

        if (sequence.length === 0) return null;

        const currentIdx = sequence.findIndex(scene => scene[Na__PmGroups__SCENE_ID_KEY] === activeSceneId);
        const baseIdx    = currentIdx >= 0 ? currentIdx : 0;
        const nextIdx    = (baseIdx + offset + sequence.length) % sequence.length; // <-- Wrap at both ends

        const scene = sequence[nextIdx];
        if (!scene) return null;

        return {
            scene   : scene,
            groupId : Na__PresentationMode__SceneGroups__ResolveSceneGroupId(scene, sceneConfig)
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Active Group State
// -----------------------------------------------------------------------------

    // FUNCTION | Set the Group the Carousel Is Currently Showing
    // ------------------------------------------------------------
    function Na__PresentationMode__SceneGroups__SetActiveGroupId(groupId) {
        Na__PmGroups__ActiveGroupId = groupId || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Group the Carousel Is Currently Showing
    // ------------------------------------------------------------
    function Na__PresentationMode__SceneGroups__GetActiveGroupId() {
        return Na__PmGroups__ActiveGroupId;
    }
    // ------------------------------------------------------------


    // FUNCTION | Resolve the Group to Open On When a Project Loads
    // ------------------------------------------------------------
    // The group holding the default scene, so the opening camera position
    // always has its own thumbnail visible and highlighted in the strip.
    // Falls back to the first enabled group when there is no default scene.
    // ------------------------------------------------------------
    function Na__PresentationMode__SceneGroups__ResolveOpeningGroupId(defaultScene, sceneConfig) {
        if (defaultScene) {
            const groupId = Na__PresentationMode__SceneGroups__ResolveSceneGroupId(defaultScene, sceneConfig);
            if (groupId) return groupId;
        }
        return Na__PresentationMode__SceneGroups__GetFallbackGroupId(sceneConfig);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Scene Groups Data API
    // ------------------------------------------------------------
    export {
        Na__PresentationMode__SceneGroups__Initialize,
        Na__PresentationMode__SceneGroups__IsEnabled,
        Na__PresentationMode__SceneGroups__GetBehaviour,
        Na__PresentationMode__SceneGroups__GetLabels,
        Na__PresentationMode__SceneGroups__GetDevMenuLabels,
        Na__PresentationMode__SceneGroups__FormatViewCount,
        Na__PresentationMode__SceneGroups__GetDefaultGroups,
        Na__PresentationMode__SceneGroups__GetGroups,
        Na__PresentationMode__SceneGroups__GetEnabledGroups,
        Na__PresentationMode__SceneGroups__GetGroupById,
        Na__PresentationMode__SceneGroups__GetFallbackGroupId,
        Na__PresentationMode__SceneGroups__ResolveSceneGroupId,
        Na__PresentationMode__SceneGroups__ShouldShowBar,
        Na__PresentationMode__SceneGroups__GetScenesInGroup,
        Na__PresentationMode__SceneGroups__SortScenesForPlayback,
        Na__PresentationMode__SceneGroups__NormaliseOrderWithinGroups,
        Na__PresentationMode__SceneGroups__GetGroupEdgeScene,
        Na__PresentationMode__SceneGroups__GetAdjacentScene,
        Na__PresentationMode__SceneGroups__SetActiveGroupId,
        Na__PresentationMode__SceneGroups__GetActiveGroupId,
        Na__PresentationMode__SceneGroups__ResolveOpeningGroupId
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
