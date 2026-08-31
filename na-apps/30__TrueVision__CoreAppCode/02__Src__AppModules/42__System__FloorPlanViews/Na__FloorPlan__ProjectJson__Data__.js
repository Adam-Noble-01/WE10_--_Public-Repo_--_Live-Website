// =============================================================================
// TRUEVISION3D - FLOOR PLAN VIEWS - PROJECT DATA
// =============================================================================
//
// FILE       : Na__FloorPlan__ProjectJson__Data__.js
// NAMESPACE  : Na__FpData
// MODULE     : Floor Plan Views - Project Data
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Read, validate, normalise and mutate the per-project floor plan definitions
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - Floor plans are stored NESTED INSIDE the existing
//   PresentationMode__SavedCameraScenes block, under ...__FloorPlans, with a
//   per-scene ...__Scene__FloorPlanId pointing back at them. This mirrors how
//   scene groups were added and is the whole reason the feature needs no
//   change to the three dev-owned key lists that guard the R2 sync path:
//   Na__DevSavedKeys in Na__AppFlow__LoadingSequence.js,
//   DEV_OWNED_PROJECT_DATA_KEYS in CloudflareR2__ModelSync__Main__.py, and
//   TRUEVISION_DEV_OWNED_KEYS in ProjectVision__BuildScript__.py. A new
//   top-level key would have needed all three edited in lockstep, and missing
//   one would let a ProjectVision build silently wipe every floor plan.
// - A floor plan owns a floor DATUM and a CUT OFFSET above it. The cut height
//   is datum + offset, so a plan authored at datum 0 still slices the walls at
//   the standard architectural height rather than skimming the slab.
// - Annotations ride along inside each plan, so every plan cut carries its own
//   independent markup. This module stores them opaquely; the annotations
//   system owns their shape.
// - Pure data layer - no DOM, no Three.js, no camera operations.
//
// INTEGRATION:
// - Na__FloorPlan__DevMenu__Editor__ mutates through here, then hands the
//   whole PresentationMode block to Na__CfApi__MergeAndSaveKeys.
// - Na__FloorPlan__ModeController__ reads through here to drive the cut.
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

    // MODULE IMPORTS | Floor Plan Config Defaults
    // ------------------------------------------------------------
    // @delegate: ./Na__FloorPlan__ConfigState__.js
    // ------------------------------------------------------------
    import {
        Na__FpCfg__GetDatumRangeMm,
        Na__FpCfg__GetCutOffsetMm,
        Na__FpCfg__GetDefaultViewDepthMm,
        Na__FpCfg__FormatLabel
    } from './Na__FloorPlan__ConfigState__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | JSON Key Names
    // ------------------------------------------------------------
    // FLOOR_PLANS_KEY is nested inside PresentationMode__SavedCameraScenes,
    // never at the top level of the project document. See the header note.
    // ------------------------------------------------------------
    const Na__FpData__FLOOR_PLANS_KEY   = 'PresentationMode__SavedCameraScenes__FloorPlans';
    const Na__FpData__SCENE_PLAN_ID_KEY = 'PresentationMode__Scene__FloorPlanId';
    const Na__FpData__SCENE_ID_KEY      = 'PresentationMode__Scene__Id';
    const Na__FpData__SCENES_KEY        = 'PresentationMode__SavedCameraScenes__Scenes';
    const Na__FpData__CLIENT_DIMS_KEY   = 'PresentationMode__SavedCameraScenes__ClientDimensionsEnabled';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Floor Plan Record Field Names
    // ------------------------------------------------------------
    const Na__FpData__PLAN_ID           = 'FloorPlan__Id';
    const Na__FpData__PLAN_NAME         = 'FloorPlan__Name';
    const Na__FpData__PLAN_ORDER        = 'FloorPlan__Order';
    const Na__FpData__PLAN_ENABLED      = 'FloorPlan__Enabled';
    const Na__FpData__PLAN_DATUM_MM     = 'FloorPlan__FloorDatumMm';
    const Na__FpData__PLAN_CUT_OFFSET   = 'FloorPlan__CutOffsetMm';
    const Na__FpData__PLAN_VIEW_DEPTH   = 'FloorPlan__ViewDepthMm';
    const Na__FpData__PLAN_SCENE_ID     = 'FloorPlan__SceneId';
    const Na__FpData__PLAN_ZOOM         = 'FloorPlan__CameraZoom';
    const Na__FpData__PLAN_TARGET       = 'FloorPlan__CameraTargetMm';
    const Na__FpData__PLAN_ANNOTATIONS  = 'FloorPlan__Annotations';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Id Formatting
    // ------------------------------------------------------------
    const Na__FpData__ID_PREFIX  = 'FloorPlan_';
    const Na__FpData__ID_PADDING = 3;                                            // <-- FloorPlan_001
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Validation and Normalisation
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Is This a Structurally Valid Floor Plan Record?
    // ------------------------------------------------------------
    function Na__FpData__IsValidPlan(plan) {
        if (!plan || typeof plan !== 'object') return false;

        const id   = plan[Na__FpData__PLAN_ID];
        const name = plan[Na__FpData__PLAN_NAME];
        if (!id || typeof id !== 'string')     return false;                     // <-- Id must exist
        if (!name || typeof name !== 'string') return false;                     // <-- Name must exist

        return Number.isFinite(plan[Na__FpData__PLAN_DATUM_MM]);                 // <-- Datum must be numeric
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fill In Any Missing Optional Fields From Config
    // ------------------------------------------------------------
    // Applied on read so a hand-edited or partially written plan still drives
    // a correct cut rather than producing NaN geometry.
    // ------------------------------------------------------------
    function Na__FpData__NormalisePlan(plan, index) {
        const cutOffset = Na__FpCfg__GetCutOffsetMm();

        if (!Number.isFinite(plan[Na__FpData__PLAN_CUT_OFFSET])) {
            plan[Na__FpData__PLAN_CUT_OFFSET] = cutOffset.defaultMm;
        }
        if (!Number.isFinite(plan[Na__FpData__PLAN_ORDER])) {
            plan[Na__FpData__PLAN_ORDER] = index + 1;
        }
        if (typeof plan[Na__FpData__PLAN_ENABLED] !== 'boolean') {
            plan[Na__FpData__PLAN_ENABLED] = true;
        }
        if (!Array.isArray(plan[Na__FpData__PLAN_ANNOTATIONS])) {
            plan[Na__FpData__PLAN_ANNOTATIONS] = [];
        }
        // View depth is deliberately allowed to stay null - that is the
        // ordinary infinite cut downward, not a missing value.
        if (plan[Na__FpData__PLAN_VIEW_DEPTH] !== null
            && !Number.isFinite(plan[Na__FpData__PLAN_VIEW_DEPTH])) {
            plan[Na__FpData__PLAN_VIEW_DEPTH] = null;
        }
        return plan;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Reading Floor Plans
// -----------------------------------------------------------------------------

    // FUNCTION | Get Every Valid Floor Plan, Sorted by Order
    // ------------------------------------------------------------
    // sceneConfig is the PresentationMode__SavedCameraScenes block. Returns a
    // new array of the LIVE plan objects, so mutating a returned plan edits
    // the config the save path will write.
    // ------------------------------------------------------------
    function Na__FpData__GetFloorPlans(sceneConfig) {
        if (!sceneConfig || typeof sceneConfig !== 'object') return [];

        const raw = sceneConfig[Na__FpData__FLOOR_PLANS_KEY];
        if (!Array.isArray(raw)) return [];                                      // <-- A project with no plans reads as an empty set

        return raw
            .filter(Na__FpData__IsValidPlan)
            .map(Na__FpData__NormalisePlan)
            .sort((a, b) => a[Na__FpData__PLAN_ORDER] - b[Na__FpData__PLAN_ORDER]);
    }
    // ------------------------------------------------------------


    // FUNCTION | Get Only the Enabled Floor Plans
    // ------------------------------------------------------------
    function Na__FpData__GetEnabledFloorPlans(sceneConfig) {
        return Na__FpData__GetFloorPlans(sceneConfig)
            .filter((plan) => plan[Na__FpData__PLAN_ENABLED] !== false);
    }
    // ------------------------------------------------------------


    // FUNCTION | Get One Floor Plan by Id
    // ------------------------------------------------------------
    function Na__FpData__GetPlanById(sceneConfig, planId) {
        if (!planId) return null;
        const plans = Na__FpData__GetFloorPlans(sceneConfig);
        for (let i = 0; i < plans.length; i++) {
            if (plans[i][Na__FpData__PLAN_ID] === planId) return plans[i];
        }
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Floor Plan a Scene Drives, If Any
    // ------------------------------------------------------------
    // This is the hook the carousel path uses: an ordinary 3D scene returns
    // null and behaves exactly as it always has.
    // ------------------------------------------------------------
    function Na__FpData__GetPlanForScene(sceneConfig, scene) {
        if (!scene || typeof scene !== 'object') return null;
        const planId = scene[Na__FpData__SCENE_PLAN_ID_KEY];
        if (!planId) return null;
        return Na__FpData__GetPlanById(sceneConfig, planId);
    }
    // ------------------------------------------------------------


    // FUNCTION | Is This Scene a Floor Plan Scene?
    // ------------------------------------------------------------
    function Na__FpData__IsFloorPlanScene(scene) {
        return Boolean(scene && typeof scene === 'object' && scene[Na__FpData__SCENE_PLAN_ID_KEY]);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Derived Values
// -----------------------------------------------------------------------------

    // FUNCTION | Compute the Absolute Cut Height of a Plan in Millimetres
    // ------------------------------------------------------------
    // The single place datum and offset are combined. Everything downstream -
    // the clip plane, the camera height, the annotation layer - reads this,
    // so the two-number model can never drift apart.
    // ------------------------------------------------------------
    function Na__FpData__GetCutHeightMm(plan) {
        if (!plan) return null;

        const datum  = Number.isFinite(plan[Na__FpData__PLAN_DATUM_MM])
            ? plan[Na__FpData__PLAN_DATUM_MM]
            : Na__FpCfg__GetDatumRangeMm().defaultMm;
        const offset = Number.isFinite(plan[Na__FpData__PLAN_CUT_OFFSET])
            ? plan[Na__FpData__PLAN_CUT_OFFSET]
            : Na__FpCfg__GetCutOffsetMm().defaultMm;

        return datum + offset;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get a Plan's View Depth in Millimetres (null = infinite)
    // ------------------------------------------------------------
    function Na__FpData__GetViewDepthMm(plan) {
        if (!plan) return null;
        const depth = plan[Na__FpData__PLAN_VIEW_DEPTH];
        return (Number.isFinite(depth) && depth > 0) ? depth : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get a Plan's Saved Camera Zoom and Pan Target
    // ------------------------------------------------------------
    // Returns null members when the plan has never been framed, which tells
    // the camera module to fit the model bounds instead.
    // ------------------------------------------------------------
    function Na__FpData__GetSavedView(plan) {
        if (!plan) return { zoom: null, targetXMm: null, targetZMm: null };

        const target = plan[Na__FpData__PLAN_TARGET];
        const zoom   = plan[Na__FpData__PLAN_ZOOM];

        return {
            zoom      : Number.isFinite(zoom) && zoom > 0 ? zoom : null,
            targetXMm : (target && Number.isFinite(target.PosX)) ? target.PosX : null,
            targetZMm : (target && Number.isFinite(target.PosZ)) ? target.PosZ : null
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Store a Plan's Camera Zoom and Pan Target
    // ------------------------------------------------------------
    function Na__FpData__SetSavedView(plan, zoom, targetXMm, targetZMm) {
        if (!plan) return false;
        if (Number.isFinite(zoom) && zoom > 0) plan[Na__FpData__PLAN_ZOOM] = zoom;
        if (Number.isFinite(targetXMm) && Number.isFinite(targetZMm)) {
            plan[Na__FpData__PLAN_TARGET] = {
                PosX : Math.round(targetXMm),
                PosZ : Math.round(targetZMm)
            };
        }
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Mutating Floor Plans
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Ensure the Floor Plans Array Exists on the Block
    // ------------------------------------------------------------
    function Na__FpData__EnsureArray(sceneConfig) {
        if (!sceneConfig || typeof sceneConfig !== 'object') return null;
        if (!Array.isArray(sceneConfig[Na__FpData__FLOOR_PLANS_KEY])) {
            sceneConfig[Na__FpData__FLOOR_PLANS_KEY] = [];
        }
        return sceneConfig[Na__FpData__FLOOR_PLANS_KEY];
    }
    // ------------------------------------------------------------


    // FUNCTION | Allocate the Next Free Floor Plan Id
    // ------------------------------------------------------------
    // Scans for the highest numeric suffix in use rather than counting, so
    // deleting a middle plan never causes an id collision.
    // ------------------------------------------------------------
    function Na__FpData__NextPlanId(sceneConfig) {
        const plans = Na__FpData__GetFloorPlans(sceneConfig);
        let highest = 0;

        for (let i = 0; i < plans.length; i++) {
            const id = plans[i][Na__FpData__PLAN_ID];
            if (typeof id !== 'string' || !id.startsWith(Na__FpData__ID_PREFIX)) continue;
            const parsed = parseInt(id.slice(Na__FpData__ID_PREFIX.length), 10);
            if (Number.isFinite(parsed) && parsed > highest) highest = parsed;
        }

        return Na__FpData__ID_PREFIX + String(highest + 1).padStart(Na__FpData__ID_PADDING, '0');
    }
    // ------------------------------------------------------------


    // FUNCTION | Create and Append a New Floor Plan
    // ------------------------------------------------------------
    // options: { name, floorDatumMm, cutOffsetMm, viewDepthMm }. Anything
    // omitted falls back to the config default.
    // ------------------------------------------------------------
    function Na__FpData__CreatePlan(sceneConfig, options) {
        const array = Na__FpData__EnsureArray(sceneConfig);
        if (!array) return null;

        const opts       = options || {};
        const datumRange = Na__FpCfg__GetDatumRangeMm();
        const cutOffset  = Na__FpCfg__GetCutOffsetMm();
        const planId     = Na__FpData__NextPlanId(sceneConfig);
        const order      = array.length + 1;

        const plan = {};
        plan[Na__FpData__PLAN_ID]          = planId;
        plan[Na__FpData__PLAN_NAME]        = (typeof opts.name === 'string' && opts.name.trim().length > 0)
            ? opts.name.trim()
            : Na__FpCfg__FormatLabel('NewPlanNameFormat', 'Floor Plan {index}', { index: order });
        plan[Na__FpData__PLAN_ORDER]       = order;
        plan[Na__FpData__PLAN_ENABLED]     = true;
        plan[Na__FpData__PLAN_DATUM_MM]    = Number.isFinite(opts.floorDatumMm) ? opts.floorDatumMm : datumRange.defaultMm;
        plan[Na__FpData__PLAN_CUT_OFFSET]  = Number.isFinite(opts.cutOffsetMm)  ? opts.cutOffsetMm  : cutOffset.defaultMm;
        plan[Na__FpData__PLAN_VIEW_DEPTH]  = Number.isFinite(opts.viewDepthMm) && opts.viewDepthMm > 0
            ? opts.viewDepthMm
            : Na__FpCfg__GetDefaultViewDepthMm();
        plan[Na__FpData__PLAN_SCENE_ID]    = null;                               // <-- Linked when the scene is created
        plan[Na__FpData__PLAN_ANNOTATIONS] = [];

        array.push(plan);
        return plan;
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete a Floor Plan and Unlink Its Scene
    // ------------------------------------------------------------
    // Returns the id of the scene that should be removed alongside it, or
    // null. The caller owns scene deletion so scene ordering stays in one
    // place rather than being split across two modules.
    // ------------------------------------------------------------
    function Na__FpData__DeletePlan(sceneConfig, planId) {
        const array = Na__FpData__EnsureArray(sceneConfig);
        if (!array) return null;

        let orphanedSceneId = null;
        for (let i = 0; i < array.length; i++) {
            if (array[i][Na__FpData__PLAN_ID] !== planId) continue;
            orphanedSceneId = array[i][Na__FpData__PLAN_SCENE_ID] || null;
            array.splice(i, 1);
            break;
        }

        Na__FpData__RenumberOrder(sceneConfig);
        return orphanedSceneId;
    }
    // ------------------------------------------------------------


    // FUNCTION | Rewrite Order to a Clean 1..n Sequence
    // ------------------------------------------------------------
    function Na__FpData__RenumberOrder(sceneConfig) {
        const plans = Na__FpData__GetFloorPlans(sceneConfig);
        for (let i = 0; i < plans.length; i++) plans[i][Na__FpData__PLAN_ORDER] = i + 1;
    }
    // ------------------------------------------------------------


    // FUNCTION | Link a Floor Plan to the Scene That Displays It
    // ------------------------------------------------------------
    // Writes both directions at once so the pair can never half-exist.
    // ------------------------------------------------------------
    function Na__FpData__LinkPlanToScene(plan, scene) {
        if (!plan || !scene) return false;
        plan[Na__FpData__PLAN_SCENE_ID]      = scene[Na__FpData__SCENE_ID_KEY];
        scene[Na__FpData__SCENE_PLAN_ID_KEY] = plan[Na__FpData__PLAN_ID];
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Find the Scene a Floor Plan Is Displayed By
    // ------------------------------------------------------------
    function Na__FpData__FindSceneForPlan(sceneConfig, plan) {
        if (!sceneConfig || !plan) return null;
        const scenes = sceneConfig[Na__FpData__SCENES_KEY];
        if (!Array.isArray(scenes)) return null;

        const planId = plan[Na__FpData__PLAN_ID];
        for (let i = 0; i < scenes.length; i++) {
            if (scenes[i] && scenes[i][Na__FpData__SCENE_PLAN_ID_KEY] === planId) return scenes[i];
        }
        return null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Client Measuring Grant
// -----------------------------------------------------------------------------

    // FUNCTION | May Clients Measure on This Project?
    // ------------------------------------------------------------
    // Nested inside the PresentationMode block like everything else here, so
    // the grant rides the existing R2 dev-key path and needs no new top-level
    // key. Absent reads as OFF: a project nobody has considered never exposes
    // the tool.
    // ------------------------------------------------------------
    function Na__FpData__GetClientDimensionsEnabled(sceneConfig) {
        if (!sceneConfig || typeof sceneConfig !== 'object') return false;
        return sceneConfig[Na__FpData__CLIENT_DIMS_KEY] === true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Grant or Withhold Client Measuring for This Project
    // ------------------------------------------------------------
    function Na__FpData__SetClientDimensionsEnabled(sceneConfig, enabled) {
        if (!sceneConfig || typeof sceneConfig !== 'object') return false;
        sceneConfig[Na__FpData__CLIENT_DIMS_KEY] = (enabled === true);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Annotations Storage
// -----------------------------------------------------------------------------

    // FUNCTION | Get a Plan's Annotation Array (Live Reference)
    // ------------------------------------------------------------
    // Stored opaquely: the annotations system owns the item shape, this
    // module only guarantees the array exists and is persisted.
    // ------------------------------------------------------------
    function Na__FpData__GetAnnotations(plan) {
        if (!plan) return [];
        if (!Array.isArray(plan[Na__FpData__PLAN_ANNOTATIONS])) {
            plan[Na__FpData__PLAN_ANNOTATIONS] = [];
        }
        return plan[Na__FpData__PLAN_ANNOTATIONS];
    }
    // ------------------------------------------------------------


    // FUNCTION | Replace a Plan's Annotation Array Wholesale
    // ------------------------------------------------------------
    function Na__FpData__SetAnnotations(plan, annotations) {
        if (!plan) return false;
        plan[Na__FpData__PLAN_ANNOTATIONS] = Array.isArray(annotations) ? annotations : [];
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Floor Plan Project Data API
    // ------------------------------------------------------------
    export {
        Na__FpData__FLOOR_PLANS_KEY,
        Na__FpData__SCENE_PLAN_ID_KEY,
        Na__FpData__GetFloorPlans,
        Na__FpData__GetEnabledFloorPlans,
        Na__FpData__GetPlanById,
        Na__FpData__GetPlanForScene,
        Na__FpData__IsFloorPlanScene,
        Na__FpData__GetCutHeightMm,
        Na__FpData__GetViewDepthMm,
        Na__FpData__GetSavedView,
        Na__FpData__SetSavedView,
        Na__FpData__NextPlanId,
        Na__FpData__CreatePlan,
        Na__FpData__DeletePlan,
        Na__FpData__RenumberOrder,
        Na__FpData__LinkPlanToScene,
        Na__FpData__FindSceneForPlan,
        Na__FpData__GetClientDimensionsEnabled,
        Na__FpData__SetClientDimensionsEnabled,
        Na__FpData__GetAnnotations,
        Na__FpData__SetAnnotations
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
