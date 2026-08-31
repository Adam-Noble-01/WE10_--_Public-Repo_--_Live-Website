// =============================================================================
// TRUEVISION3D - FLOOR PLAN VIEWS - SCENE LINK
// =============================================================================
//
// FILE       : Na__FloorPlan__SceneLink__.js
// NAMESPACE  : Na__FpLink
// MODULE     : Floor Plan Views - Scene Link
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Turn a floor plan into a carousel scene filed in the right group
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - A floor plan appears to the viewer as an ordinary scene card in the
//   carousel. This module owns that translation: it creates the scene, files
//   it into the Floor Plans group, and keeps the two in step.
// - GROUP RESOLUTION follows the brief exactly. A group named "Floor Plans"
//   wins; failing that the configured group id; failing that the first enabled
//   group, which on a default project is Exterior 3D Views. A matched group
//   that is switched OFF is switched on, because a plan filed into a hidden
//   group would never reach the carousel.
// - A project with NO groups at all gets the default group set seeded first.
//   Creating a floor plan is precisely the moment grouping starts to matter -
//   the project now has two kinds of scene - so this is the one place seeding
//   on the author's behalf is the right call rather than a surprise.
// - Every floor plan scene carries a REAL camera block holding its top-down
//   pose. Na__PresentationMode__ProjectJson__IsValidScene rejects a scene
//   without finite camera coordinates, so a plan scene without one would be
//   silently filtered out of the carousel and never appear.
//
// INTEGRATION:
// - Na__FloorPlan__DevMenu__Editor__ calls CreateSceneForPlan on add and
//   RemoveSceneForPlan on delete, then saves the whole block to R2.
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

    // MODULE IMPORTS | Scene Groups Data
    // ------------------------------------------------------------
    // @delegate: ../21__System__PresentationMode/Na__PresentationMode__SceneGroups__Data__.js
    // ------------------------------------------------------------
    import {
        Na__PresentationMode__SceneGroups__GetGroups,
        Na__PresentationMode__SceneGroups__GetDefaultGroups,
        Na__PresentationMode__SceneGroups__GetFallbackGroupId,
        Na__PresentationMode__SceneGroups__NormaliseOrderWithinGroups
    } from '../21__System__PresentationMode/Na__PresentationMode__SceneGroups__Data__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Floor Plan Data and Config
    // ------------------------------------------------------------
    // @delegate: ./Na__FloorPlan__ProjectJson__Data__.js
    // ------------------------------------------------------------
    import {
        Na__FpData__LinkPlanToScene,
        Na__FpData__FindSceneForPlan
    } from './Na__FloorPlan__ProjectJson__Data__.js';
    import { Na__FpCfg__GetSceneGroupTarget } from './Na__FloorPlan__ConfigState__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Model Framing
    // ------------------------------------------------------------
    // The top-down camera block is built in one place for every consumer, so
    // a plan's stored pose and its live preview can never disagree.
    // @delegate: ./Na__FloorPlan__Framing__.js
    // ------------------------------------------------------------
    import { Na__FpFrame__BuildCameraBlock } from './Na__FloorPlan__Framing__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Presentation Block Key Names
    // ------------------------------------------------------------
    const Na__FpLink__SCENES_KEY   = 'PresentationMode__SavedCameraScenes__Scenes';
    const Na__FpLink__GROUPS_KEY   = 'PresentationMode__SavedCameraScenes__Groups';
    const Na__FpLink__GROUP_ID     = 'PresentationMode__Group__Id';
    const Na__FpLink__GROUP_NAME   = 'PresentationMode__Group__Name';
    const Na__FpLink__GROUP_ENABLED = 'PresentationMode__Group__Enabled';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Scene Field Names
    // ------------------------------------------------------------
    const Na__FpLink__SCENE_ID       = 'PresentationMode__Scene__Id';
    const Na__FpLink__SCENE_NAME     = 'PresentationMode__Scene__Name';
    const Na__FpLink__SCENE_ORDER    = 'PresentationMode__Scene__Order';
    const Na__FpLink__SCENE_GROUP    = 'PresentationMode__Scene__GroupId';
    const Na__FpLink__SCENE_CAMERA   = 'PresentationMode__Scene__CameraPosition';
    const Na__FpLink__SCENE_ORBIT    = 'PresentationMode__Scene__OrbitHelperCubePosition';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Scene Id Formatting
    // ------------------------------------------------------------
    const Na__FpLink__SCENE_PREFIX  = 'Scene_';
    const Na__FpLink__SCENE_PADDING = 3;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Group Resolution
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Seed the Default Group Set When a Project Has None
    // ------------------------------------------------------------
    function Na__FpLink__EnsureGroupsExist(sceneConfig) {
        const existing = Na__PresentationMode__SceneGroups__GetGroups(sceneConfig);
        if (existing.length > 0) return existing;

        const defaults = Na__PresentationMode__SceneGroups__GetDefaultGroups();
        if (defaults.length === 0) return [];

        sceneConfig[Na__FpLink__GROUPS_KEY] = defaults;
        console.log('[TrueVision3D] Seeded the default scene groups so the new floor plan has somewhere to live.');
        return Na__PresentationMode__SceneGroups__GetGroups(sceneConfig);
    }
    // ------------------------------------------------------------


    // FUNCTION | Resolve Which Group a New Floor Plan Scene Belongs To
    // ------------------------------------------------------------
    // Name match, then id match, then the first enabled group. A matched
    // group that is switched off gets switched on, so the plan is never filed
    // somewhere the carousel cannot show it.
    // ------------------------------------------------------------
    function Na__FpLink__ResolveTargetGroupId(sceneConfig) {
        const target = Na__FpCfg__GetSceneGroupTarget();
        const groups = Na__FpLink__EnsureGroupsExist(sceneConfig);
        if (groups.length === 0) return null;                                    // <-- Ungrouped project: scene needs no group

        const wantedName = String(target.groupName || '').trim().toLowerCase();

        let matched = null;
        for (let i = 0; i < groups.length; i++) {
            const name = String(groups[i][Na__FpLink__GROUP_NAME] || '').trim().toLowerCase();
            if (wantedName && name === wantedName) {
                matched = groups[i];
                break;
            }
        }
        if (!matched && target.groupId) {
            for (let i = 0; i < groups.length; i++) {
                if (groups[i][Na__FpLink__GROUP_ID] === target.groupId) {
                    matched = groups[i];
                    break;
                }
            }
        }

        if (!matched) {
            return Na__PresentationMode__SceneGroups__GetFallbackGroupId(sceneConfig);
        }

        if (matched[Na__FpLink__GROUP_ENABLED] === false && target.autoEnable) {
            matched[Na__FpLink__GROUP_ENABLED] = true;                           // <-- A hidden group would swallow the plan
            console.log('[TrueVision3D] Enabled the "' + matched[Na__FpLink__GROUP_NAME] + '" scene group for the new floor plan.');
        }
        return matched[Na__FpLink__GROUP_ID];
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Scene Construction
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Ensure the Scenes Array Exists
    // ------------------------------------------------------------
    function Na__FpLink__EnsureScenes(sceneConfig) {
        if (!sceneConfig || typeof sceneConfig !== 'object') return null;
        if (!Array.isArray(sceneConfig[Na__FpLink__SCENES_KEY])) {
            sceneConfig[Na__FpLink__SCENES_KEY] = [];
        }
        return sceneConfig[Na__FpLink__SCENES_KEY];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Allocate the Next Free Scene Id
    // ------------------------------------------------------------
    function Na__FpLink__NextSceneId(scenes) {
        let highest = 0;
        for (let i = 0; i < scenes.length; i++) {
            const id = scenes[i] && scenes[i][Na__FpLink__SCENE_ID];
            if (typeof id !== 'string' || !id.startsWith(Na__FpLink__SCENE_PREFIX)) continue;
            const parsed = parseInt(id.slice(Na__FpLink__SCENE_PREFIX.length), 10);
            if (Number.isFinite(parsed) && parsed > highest) highest = parsed;
        }
        return Na__FpLink__SCENE_PREFIX + String(highest + 1).padStart(Na__FpLink__SCENE_PADDING, '0');
    }
    // ------------------------------------------------------------


// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Create the Carousel Scene for a Floor Plan
    // ------------------------------------------------------------
    // bounds: { centreXMm, centreZMm, approachMm } or null.
    // Returns the new scene, or the existing one if the plan already has it.
    // ------------------------------------------------------------
    function Na__FpLink__CreateSceneForPlan(sceneConfig, plan, bounds, fovDegrees) {
        const scenes = Na__FpLink__EnsureScenes(sceneConfig);
        if (!scenes || !plan) return null;

        const existing = Na__FpData__FindSceneForPlan(sceneConfig, plan);
        if (existing) {
            existing[Na__FpLink__SCENE_NAME] = plan.FloorPlan__Name;              // <-- Keep the card label in step
            return existing;
        }

        const groupId = Na__FpLink__ResolveTargetGroupId(sceneConfig);
        const built   = Na__FpFrame__BuildCameraBlock(plan, bounds, fovDegrees);

        const scene = {};
        scene[Na__FpLink__SCENE_ID]      = Na__FpLink__NextSceneId(scenes);
        scene[Na__FpLink__SCENE_NAME]    = plan.FloorPlan__Name;
        scene[Na__FpLink__SCENE_ORDER]   = scenes.length + 1;                     // <-- Normalised per group below
        scene[Na__FpLink__SCENE_CAMERA]  = built.camera;
        scene[Na__FpLink__SCENE_ORBIT]   = built.orbit;
        if (groupId) scene[Na__FpLink__SCENE_GROUP] = groupId;

        scenes.push(scene);
        Na__FpData__LinkPlanToScene(plan, scene);                                 // <-- Writes both directions at once

        // Scene Order restarts at 1 inside every group, so the whole list has
        // to be renumbered rather than just appending an index.
        Na__PresentationMode__SceneGroups__NormaliseOrderWithinGroups(scenes, sceneConfig);
        return scene;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remove the Carousel Scene Belonging to a Floor Plan
    // ------------------------------------------------------------
    function Na__FpLink__RemoveSceneForPlan(sceneConfig, sceneId) {
        const scenes = Na__FpLink__EnsureScenes(sceneConfig);
        if (!scenes || !sceneId) return false;

        let removed = false;
        for (let i = 0; i < scenes.length; i++) {
            if (scenes[i] && scenes[i][Na__FpLink__SCENE_ID] === sceneId) {
                scenes.splice(i, 1);
                removed = true;
                break;
            }
        }

        if (removed) Na__PresentationMode__SceneGroups__NormaliseOrderWithinGroups(scenes, sceneConfig);
        return removed;
    }
    // ------------------------------------------------------------


    // FUNCTION | Push a Renamed Plan Through to Its Scene Card
    // ------------------------------------------------------------
    function Na__FpLink__SyncSceneName(sceneConfig, plan) {
        const scene = Na__FpData__FindSceneForPlan(sceneConfig, plan);
        if (!scene) return false;
        scene[Na__FpLink__SCENE_NAME] = plan.FloorPlan__Name;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Update a Plan Scene's Stored Camera Block
    // ------------------------------------------------------------
    // Called when the datum or cut offset changes, so the scene's own pose
    // keeps matching the cut it represents.
    // ------------------------------------------------------------
    function Na__FpLink__SyncSceneCamera(sceneConfig, plan, bounds, fovDegrees) {
        const scene = Na__FpData__FindSceneForPlan(sceneConfig, plan);
        if (!scene) return false;

        const built = Na__FpFrame__BuildCameraBlock(plan, bounds, fovDegrees);
        scene[Na__FpLink__SCENE_CAMERA] = built.camera;
        scene[Na__FpLink__SCENE_ORBIT]  = built.orbit;
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Floor Plan Scene Link API
    // ------------------------------------------------------------
    export {
        Na__FpLink__ResolveTargetGroupId,
        Na__FpLink__CreateSceneForPlan,
        Na__FpLink__RemoveSceneForPlan,
        Na__FpLink__SyncSceneName,
        Na__FpLink__SyncSceneCamera
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
