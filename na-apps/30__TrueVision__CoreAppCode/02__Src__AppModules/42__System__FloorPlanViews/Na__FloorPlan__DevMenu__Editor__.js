// =============================================================================
// TRUEVISION3D - FLOOR PLAN VIEWS - DEV MENU EDITOR
// =============================================================================
//
// FILE       : Na__FloorPlan__DevMenu__Editor__.js
// NAMESPACE  : Na__FpDev
// MODULE     : Floor Plan Views - Dev Menu Editor
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Localhost-only authoring UI for creating and tuning floor plans
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - The developer-facing half of the feature: add a floor plan, name it, set
//   its floor level, preview the cut, mark it up, and save.
// - The FLOOR LEVEL slider is the datum, not the cut. The cut is taken a
//   configurable distance above it (1200mm by default, the standard
//   architectural cut height), which is why a plan left at datum 0 still
//   slices the walls rather than skimming the slab. Both numbers are shown so
//   the relationship is never a mystery.
// - Dragging the slider while previewing recuts live, throttled by the engine,
//   with an exact unthrottled pass on release. Nothing is written to R2 until
//   Save is pressed.
// - SEED FROM MODEL STOREYS reads the storeys the app already detects from GLB
//   names and measures each one's floor level from its own geometry, so a
//   two-storey house is two correct plans in one click rather than two guesses.
// - Save writes the whole PresentationMode block through the existing
//   Na__CfApi__MergeAndSaveKeys path. Floor plans are nested INSIDE that block,
//   so they ride the same R2 sync every other dev-menu save uses and no
//   dev-owned key list needs touching.
//
// INTEGRATION:
// - Initialized from Index.html alongside the other localhost-only dev tools.
// - Drives Na__FloorPlan__ModeController__ for preview and annotation.
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

    // MODULE IMPORTS | Three.js and Cloudflare R2 Save Path
    // ------------------------------------------------------------
    import * as THREE from 'three';
    import {
        Na__CfApi__GetProjectContext,
        Na__CfApi__MergeAndSaveKeys
    } from '../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Presentation Scene Config and Storey Detection
    // ------------------------------------------------------------
    import {
        Na__PresentationMode__ProjectJson__GetActiveConfig
    } from '../21__System__PresentationMode/Na__PresentationMode__ProjectJson__SceneData.js';
    import {
        Na__StoreySystem__GetState,
        Na__StoreySystem__GetStoreyDisplayName
    } from '../26__System__ToggleModelElements/3dObject__ViewBuildingStoreys__SystemLogic__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Floor Plan Data, Config, Scene Link and Mode
    // ------------------------------------------------------------
    // @delegate: ./Na__FloorPlan__ProjectJson__Data__.js
    // @delegate: ./Na__FloorPlan__Framing__.js
    // @delegate: ./Na__FloorPlan__DevMenu__RowBuilders__.js
    // @delegate: ./Na__FloorPlan__SceneLink__.js
    // @delegate: ./Na__FloorPlan__ModeController__.js
    // ------------------------------------------------------------
    import {
        Na__FpData__GetClientDimensionsEnabled,
        Na__FpData__SetClientDimensionsEnabled,
        Na__FpData__GetFloorPlans,
        Na__FpData__GetCutHeightMm,
        Na__FpData__CreatePlan,
        Na__FpData__DeletePlan
    } from './Na__FloorPlan__ProjectJson__Data__.js';
    import {
        Na__FpCfg__GetLabel,
        Na__FpCfg__FormatLabel
    } from './Na__FloorPlan__ConfigState__.js';
    import {
        Na__FpFrame__MeasureModel
    } from './Na__FloorPlan__Framing__.js';
    import {
        Na__FpRow__BuildButton,
        Na__FpRow__BuildPlanRow
    } from './Na__FloorPlan__DevMenu__RowBuilders__.js';
    import {
        Na__FpLink__CreateSceneForPlan,
        Na__FpLink__RemoveSceneForPlan,
        Na__FpLink__SyncSceneName,
        Na__FpLink__SyncSceneCamera
    } from './Na__FloorPlan__SceneLink__.js';
    import {
        Na__FloorPlanMode__EnterPlan,
        Na__FloorPlanMode__ExitPlan,
        Na__FloorPlanMode__SetEditMode,
        Na__FloorPlanMode__IsEditMode,
        Na__FloorPlanMode__IsActive,
        Na__FloorPlanMode__GetActivePlan,
        Na__FpMode__CHANGED_EVENT
    } from './Na__FloorPlan__ModeController__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Section Cut Live Update
    // ------------------------------------------------------------
    import {
        Na__SectionCut__SetPlaneHeightMm
    } from '../41__System__SectionCutEngine/Na__SectionCut__Engine__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Client Measuring Grant
    // ------------------------------------------------------------
    // @delegate: ../44__System__PlanDimensions/Na__PlanDimensions__ClientMode__.js
    // ------------------------------------------------------------
    import { Na__PlanDimClient__SetAllowed } from '../44__System__PlanDimensions/Na__PlanDimensions__ClientMode__.js';
    import { Na__PlanDim__GetLabel } from '../44__System__PlanDimensions/Na__PlanDimensions__Data__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | DOM Identifiers
    // ------------------------------------------------------------
    const Na__FpDev__PANEL_ID  = 'naFloorPlanDevPanel';
    const Na__FpDev__ITEM_ID   = 'naFloorPlanDevItem';
    const Na__FpDev__TOGGLE_ID = 'naFloorPlanDevToggle';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Section Cut Plane Id Prefix (mirrors the controller)
    // ------------------------------------------------------------
    const Na__FpDev__CUT_ID_PREFIX = 'FloorPlanCut__';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Host Context
    // ------------------------------------------------------------
    let Na__FpDev__Panel      = null;
    let Na__FpDev__ModelRoot  = null;
    let Na__FpDev__Camera     = null;
    let Na__FpDev__ShowToast  = null;
    let Na__FpDev__Initialized = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Get the Live Presentation Scene Config
    // ------------------------------------------------------------
    function Na__FpDev__GetConfig() {
        return Na__PresentationMode__ProjectJson__GetActiveConfig();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show a Toast if the Host Supplied One
    // ------------------------------------------------------------
    function Na__FpDev__Toast(message, isError) {
        if (typeof Na__FpDev__ShowToast === 'function') Na__FpDev__ShowToast(message, isError === true);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Field of View of the Live Perspective Camera
    // ------------------------------------------------------------
    function Na__FpDev__Fov() {
        return Na__FpDev__Camera ? Na__FpDev__Camera.fov : 30;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Measure the Loaded Model for Camera Placement
    // ------------------------------------------------------------
    function Na__FpDev__Measure() {
        return Na__FpFrame__MeasureModel(Na__FpDev__ModelRoot, Na__FpDev__Camera);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Measure Each Detected Storey's Floor Level
    // ------------------------------------------------------------
    // The storey system knows WHICH models belong to a storey but not how high
    // it sits, so the floor level is taken from the bottom of that storey's own
    // geometry. That is the datum a plan of it should use.
    // ------------------------------------------------------------
    function Na__FpDev__MeasureStoreys() {
        const state = Na__StoreySystem__GetState();
        if (!state || !state.hasStoreys || !Array.isArray(state.order)) return [];

        const measured = [];
        for (let i = 0; i < state.order.length; i++) {
            const key    = state.order[i];
            const models = state.map[key];
            if (!Array.isArray(models) || models.length === 0) continue;

            const box = new THREE.Box3();
            for (let m = 0; m < models.length; m++) box.expandByObject(models[m]);
            if (box.isEmpty()) continue;

            measured.push({
                key          : key,
                name         : Na__StoreySystem__GetStoreyDisplayName(key),
                floorDatumMm : Math.round(box.min.y * 1000)                       // <-- Bottom of the storey's geometry
            });
        }
        return measured;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Push a Plan's Live Cut Height to the Engine
    // ------------------------------------------------------------
    function Na__FpDev__PushLiveCut(plan, liveDrag) {
        if (!Na__FloorPlanMode__IsActive()) return;
        if (Na__FloorPlanMode__GetActivePlan() !== plan) return;
        Na__SectionCut__SetPlaneHeightMm(
            Na__FpDev__CUT_ID_PREFIX + plan.FloorPlan__Id,
            Na__FpData__GetCutHeightMm(plan),
            liveDrag === true
        );
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Row Handler Wiring
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build One Plan Row With Its Handlers Bound
    // ------------------------------------------------------------
    // The row builder is purely presentational, so everything that actually
    // changes state is assembled here and handed to it.
    // ------------------------------------------------------------
    function Na__FpDev__BuildRow(plan) {
        const config   = Na__FpDev__GetConfig();
        const isActive = Na__FloorPlanMode__IsActive() && Na__FloorPlanMode__GetActivePlan() === plan;

        return Na__FpRow__BuildPlanRow(plan, {
            isActive   : isActive,
            isEditMode : isActive && Na__FloorPlanMode__IsEditMode(),

            onRename : () => Na__FpLink__SyncSceneName(config, plan),

            onDatumLive   : () => Na__FpDev__PushLiveCut(plan, true),
            onDatumCommit : () => {
                Na__FpDev__PushLiveCut(plan, false);
                Na__FpLink__SyncSceneCamera(config, plan, Na__FpDev__Measure(), Na__FpDev__Fov());
            },

            onOffsetChange : () => {
                Na__FpDev__PushLiveCut(plan, false);
                Na__FpLink__SyncSceneCamera(config, plan, Na__FpDev__Measure(), Na__FpDev__Fov());
            },

            // Depth changes the PLANE SET, not just a constant, so the cut has
            // to be rebuilt rather than nudged.
            onDepthChange : () => {
                if (isActive) Na__FloorPlanMode__EnterPlan(plan);
            },

            onPreviewToggle : () => {
                if (isActive) {
                    Na__FloorPlanMode__ExitPlan(null);
                } else {
                    Na__FloorPlanMode__EnterPlan(plan);
                }
            },
            onAnnotate : () => Na__FloorPlanMode__SetEditMode(!Na__FloorPlanMode__IsEditMode()),
            onDelete   : () => Na__FpDev__DeletePlan(plan)
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Panel Mutations
// -----------------------------------------------------------------------------

    // FUNCTION | Add One Empty Floor Plan and Its Scene
    // ------------------------------------------------------------
    function Na__FpDev__AddPlan(options) {
        const config = Na__FpDev__GetConfig();
        if (!config) {
            Na__FpDev__Toast('No presentation scene config loaded.', true);
            return null;
        }

        const plan = Na__FpData__CreatePlan(config, options || {});
        if (!plan) return null;

        Na__FpLink__CreateSceneForPlan(config, plan, Na__FpDev__Measure(), Na__FpDev__Fov());
        Na__FpDev__Render();
        return plan;
    }
    // ------------------------------------------------------------


    // FUNCTION | Create One Plan Per Detected Model Storey
    // ------------------------------------------------------------
    function Na__FpDev__SeedFromStoreys() {
        const storeys = Na__FpDev__MeasureStoreys();
        if (storeys.length === 0) {
            Na__FpDev__Toast(Na__FpCfg__GetLabel('NoStoreysMessage', 'No named storeys detected in this model.'), true);
            return 0;
        }

        for (let i = 0; i < storeys.length; i++) {
            Na__FpDev__AddPlan({
                name         : storeys[i].name,
                floorDatumMm : storeys[i].floorDatumMm
            });
        }
        Na__FpDev__Toast('Created ' + storeys.length + ' floor plan(s) from the model storeys.');
        return storeys.length;
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete a Floor Plan, Its Scene and Its Annotations
    // ------------------------------------------------------------
    function Na__FpDev__DeletePlan(plan) {
        const config = Na__FpDev__GetConfig();
        if (!config) return false;

        const prompt = Na__FpCfg__FormatLabel(
            'DeletePlanPrompt',
            'Delete the floor plan "{name}"? Its scene and annotations go with it.',
            { name: plan.FloorPlan__Name }
        );
        if (!window.confirm(prompt)) return false;

        if (Na__FloorPlanMode__IsActive() && Na__FloorPlanMode__GetActivePlan() === plan) {
            Na__FloorPlanMode__ExitPlan(null);                                   // <-- Never leave a deleted plan on screen
        }

        const orphanedSceneId = Na__FpData__DeletePlan(config, plan.FloorPlan__Id);
        if (orphanedSceneId) Na__FpLink__RemoveSceneForPlan(config, orphanedSceneId);

        Na__FpDev__Render();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Save the Whole Presentation Block to R2
    // ------------------------------------------------------------
    // Floor plans and their annotations are nested inside the block, so this
    // is the same single merge-and-write every other dev-menu save performs.
    // ------------------------------------------------------------
    async function Na__FpDev__Save() {
        const context = Na__CfApi__GetProjectContext();
        if (!context.projectFolder) {
            Na__FpDev__Toast('No project loaded.', true);
            return false;
        }

        const config = Na__FpDev__GetConfig();
        if (!config) {
            Na__FpDev__Toast('No presentation scene config loaded.', true);
            return false;
        }

        const result = await Na__CfApi__MergeAndSaveKeys({
            PresentationMode__SavedCameraScenes : config
        });

        if (result.ok) {
            Na__FpDev__Toast(Na__FpCfg__GetLabel('SavedMessage', 'Floor plans saved to R2.'));
            return true;
        }
        console.error('[TrueVision3D] Floor plan save failed:', result.error);
        Na__FpDev__Toast(Na__FpCfg__GetLabel('SaveFailedMessage', 'Floor plan save failed - see console.'), true);
        return false;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Panel Render
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the Client Measuring Toggle
    // ------------------------------------------------------------
    // The gate for the live app. Off unless switched on, and stored inside the
    // PresentationMode block so it rides the same R2 save as everything else
    // in this panel - there is no separate save to remember.
    // ------------------------------------------------------------
    function Na__FpDev__BuildClientDimensionsToggle() {
        const config = Na__FpDev__GetConfig();

        const row = document.createElement('div');
        row.className = 'na-dropdown-menu__panel-row na-dropdown-menu__panel-row--toggle';

        const label = document.createElement('span');
        label.className   = 'na-dropdown-menu__panel-title';
        label.textContent = Na__PlanDim__GetLabel('ClientToggleLabel', 'Let clients measure');

        const check = document.createElement('input');
        check.type      = 'checkbox';
        check.className = 'na-dropdown-menu__checkbox';
        check.checked   = Na__FpData__GetClientDimensionsEnabled(config);
        check.title     = Na__PlanDim__GetLabel(
            'ClientToggleHint',
            'Adds a red measuring tool to the live app for this project.'
        );

        check.addEventListener('change', () => {
            Na__FpData__SetClientDimensionsEnabled(config, check.checked);
            Na__PlanDimClient__SetAllowed(check.checked);                        // <-- Applies without a reload
            Na__FpDev__Render();
        });

        row.appendChild(label);
        row.appendChild(check);
        return row;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Explanatory Note Under the Toggle
    // ------------------------------------------------------------
    function Na__FpDev__BuildClientDimensionsNote() {
        const note = document.createElement('p');
        note.className   = 'na-fp-dev__empty';
        note.textContent = Na__PlanDim__GetLabel(
            'ClientToggleHint',
            'Adds a red measuring tool to the live app for this project.'
        );
        return note;
    }
    // ------------------------------------------------------------


    // FUNCTION | Rebuild the Whole Floor Plan Panel
    // ------------------------------------------------------------
    function Na__FpDev__Render() {
        if (!Na__FpDev__Panel) return;
        Na__FpDev__Panel.innerHTML = '';

        const title = document.createElement('div');
        title.className   = 'na-dropdown-menu__panel-title';
        title.textContent = Na__FpCfg__GetLabel('SectionTitle', 'Floor Plans');
        Na__FpDev__Panel.appendChild(title);

        const config = Na__FpDev__GetConfig();
        const plans  = config ? Na__FpData__GetFloorPlans(config) : [];

        for (let i = 0; i < plans.length; i++) {
            Na__FpDev__Panel.appendChild(Na__FpDev__BuildRow(plans[i]));
        }

        if (plans.length === 0) {
            const empty = document.createElement('p');
            empty.className   = 'na-fp-dev__empty';
            empty.textContent = 'No floor plans yet. Add one, or seed them from the model storeys.';
            Na__FpDev__Panel.appendChild(empty);
        }

        const actions = document.createElement('div');
        actions.className = 'na-pm-dev__actions';

        actions.appendChild(Na__FpRow__BuildButton(
            Na__FpCfg__GetLabel('AddPlanLabel', '+ Add Floor Plan'), '',
            () => {
                if (!Na__FpDev__Measure()) {
                    Na__FpDev__Toast(Na__FpCfg__GetLabel('NoModelMessage', 'Load a model before adding floor plans.'), true);
                    return;
                }
                Na__FpDev__AddPlan({});
            }
        ));
        actions.appendChild(Na__FpRow__BuildButton(
            Na__FpCfg__GetLabel('SeedFromStoreysLabel', 'Seed From Model Storeys'), '',
            Na__FpDev__SeedFromStoreys
        ));
        Na__FpDev__Panel.appendChild(actions);

        // CLIENT MEASURING | Sits with the plan tools it governs, and above
        // Save because it is saved by the same button.
        const clientTitle = document.createElement('div');
        clientTitle.className   = 'na-dropdown-menu__panel-title';
        clientTitle.textContent = 'Live App';
        Na__FpDev__Panel.appendChild(clientTitle);
        Na__FpDev__Panel.appendChild(Na__FpDev__BuildClientDimensionsToggle());
        Na__FpDev__Panel.appendChild(Na__FpDev__BuildClientDimensionsNote());

        const saveActions = document.createElement('div');
        saveActions.className = 'na-pm-dev__actions';
        saveActions.appendChild(Na__FpRow__BuildButton(
            Na__FpCfg__GetLabel('SaveLabel', 'Save Floor Plans'),
            'na-pm-dev__btn--primary',
            Na__FpDev__Save
        ));
        Na__FpDev__Panel.appendChild(saveActions);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize the Localhost-Only Floor Plan Editor
    // ------------------------------------------------------------
    // context: { modelRoot, camera, showToast }
    // Mirrors the Presentation Scenes section: the wrapper is revealed, the
    // toggle opens the panel, and the panel rebuilds on every open so it can
    // never show data from a previous project.
    // ------------------------------------------------------------
    function Na__FloorPlan__DevMenu__Initialize(context) {
        const menuItem = document.getElementById(Na__FpDev__ITEM_ID);
        const toggle   = document.getElementById(Na__FpDev__TOGGLE_ID);
        const panel    = document.getElementById(Na__FpDev__PANEL_ID);
        if (!menuItem || !toggle || !panel) return false;                        // <-- Markup absent: nothing to mount into

        Na__FpDev__Panel       = panel;
        Na__FpDev__ModelRoot   = (context && context.modelRoot) || null;
        Na__FpDev__Camera      = (context && context.camera)    || null;
        Na__FpDev__ShowToast   = (context && context.showToast) || null;
        Na__FpDev__Initialized = true;

        menuItem.style.display = '';                                             // <-- Reveal alongside the other dev tools

        toggle.addEventListener('click', () => {
            const isOpen = panel.classList.contains('is-open');
            panel.classList.toggle('is-open', !isOpen);
            toggle.setAttribute('aria-expanded', String(!isOpen));
            if (!isOpen) Na__FpDev__Render();                                    // <-- Rebuild on each open so data is fresh
        });

        // Preview and Annotate button states are derived from mode, so the
        // panel refreshes whenever the controller reports a change.
        window.addEventListener(Na__FpMode__CHANGED_EVENT, () => {
            if (panel.classList.contains('is-open')) Na__FpDev__Render();
        });

        // A project switch during the same session replaces the scene config.
        window.addEventListener('na-presentation-mode-scenes-loaded', () => {
            if (panel.classList.contains('is-open')) Na__FpDev__Render();
        });

        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Point the Editor at a Different Model Root
    // ------------------------------------------------------------
    function Na__FloorPlan__DevMenu__SetModelRoot(modelRoot) {
        Na__FpDev__ModelRoot = modelRoot || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Force a Panel Refresh
    // ------------------------------------------------------------
    function Na__FloorPlan__DevMenu__Refresh() {
        if (Na__FpDev__Initialized) Na__FpDev__Render();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Floor Plan Dev Menu Editor API
    // ------------------------------------------------------------
    export {
        Na__FloorPlan__DevMenu__Initialize,
        Na__FloorPlan__DevMenu__SetModelRoot,
        Na__FloorPlan__DevMenu__Refresh
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
