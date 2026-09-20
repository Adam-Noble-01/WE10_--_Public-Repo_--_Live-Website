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
//   its floor level, preview the cut, mark it up, and UPDATE it.
//
// - BUILT LIKE THE PRESENTATION SCENES PANEL (Adam, 20-Sep-2026). One row is
//   open at a time and every other is a folded header, so the controls in
//   front of you belong to the drawing in front of you. A + at the top makes a
//   new one. Delete sits alone below a rule. And there is no Save at the foot
//   of the panel that writes every drawing at once.
//
// - AN OPEN ROW IS A DRAFT, AND UPDATE IS THE ONLY THING THAT KEEPS IT. A
//   sheet viewport is drawn FROM a plan's record, so moving its cut redraws
//   every viewport of it under the dimensions lettered on top. Edits show
//   live - in the preview, on the plane in the 3D view, on the sheets - but
//   nothing is written until the green Update, which asks first, says what
//   changed and which sheets draw from it, and writes R2 and the local copy in
//   one save. Leaving a changed row asks: discard, or keep editing. No other
//   panel's save can carry a half-moved plan out with it.
//   @delegate: ../40__System__DrawingViewCore/Na__DrawView__DraftGuard__.js
//
// - UPDATE ALSO TAKES THE PICTURE. It replaced Save Thumbnail: with the plan
//   on screen, Update records the framing and re-renders its card's thumbnail
//   in the same press.
//
// - The FLOOR LEVEL slider is the datum, not the cut. The cut is taken a
//   configurable distance above it (1200mm by default, the standard
//   architectural cut height), which is why a plan left at datum 0 still
//   slices the walls rather than skimming the slab. Both numbers are shown so
//   the relationship is never a mystery.
// - SEED FROM MODEL STOREYS reads the storeys the app already detects from GLB
//   names and measures each one's floor level from its own geometry, so a
//   two-storey house is two correct plans in one click rather than two guesses.
//
// INTEGRATION:
// - Initialized from Index.html alongside the other localhost-only dev tools.
// - Drives Na__FloorPlan__ModeController__ for preview and annotation.
// - Saves through Na__DrawData__Save (R2, then the local copy), by way of the
//   draft guard.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 2.0.0 (Floor Plans and Elevations menu rebuild)
// - Rows fold; one is open at a time, across this panel and Elevations.
// - The open row is a draft. Update (green, confirmed) keeps it and writes R2
//   and the local copy; Revert and the leave prompt discard it.
// - FIXED: Save Floor Plans wrote only the presentation block. The plan
//   RECORDS moved to LayoutEditor__DrawingsData in v2.21.0 and this panel was
//   never repointed, so since 10-Sep a cut moved here was kept by whichever
//   OTHER panel next saved the drawings block - or not at all. Every save now
//   goes through Na__DrawData__Save.
// - Save Floor Plans (the save-everything button) and Save Thumbnail are gone.
// - A + at the head of the panel; Delete below a rule, behind the app's own
//   dialog naming the sheet viewports that draw from the plan.
// - "Let clients measure" saves the moment it is ticked - it was waiting on
//   the button that has gone.
// - The carousel card's camera and name are brought into step on Update, not
//   on every slider release.
// - The panel follows the carousel: previewing a plan opens its row.
//
// 20-Sep-2026 - Version 1.1.0
// - Every plan's CUT is a plane in the 3D view, through the shared Drawing
//   Planes system (47__System__DrawingPlanes): a Show plane toggle and Move to
//   face on every row, and the Drawing Planes bar (all on, snap and its grid)
//   at the head of the panel. The plane of the plan being touched is always
//   up. Dragging a plane changes "Cut above floor" and leaves the floor level
//   alone; picking a FLOOR sets the floor level, picking anything else puts
//   the cut through the point. No new record fields.
//
// 31-Aug-2026 - Version 1.0.0
// - Initial implementation for the Floor Plan Builder.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js
    // ------------------------------------------------------------
    import * as THREE from 'three';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Presentation Scene Config, Its Dialog and Storey Detection
    // ------------------------------------------------------------
    import {
        Na__PresentationMode__ProjectJson__GetActiveConfig,
        Na__PresentationMode__ProjectJson__BroadcastScenesChanged
    } from '../21__System__PresentationMode/Na__PresentationMode__ProjectJson__SceneData.js';
    import { Na__PresentationMode__DevMenu__Confirm } from '../21__System__PresentationMode/Na__PresentationMode__DevMenu__Modal__.js';
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
        Na__FpData__GetPlanById,
        Na__FpData__GetCutHeightMm,
        Na__FpData__GetStyles,
        Na__FpData__GetStoreyLevelChoices,
        Na__FpData__STOREY_CHANGED_EVENT,
        Na__FpData__CreatePlan,
        Na__FpData__DeletePlan,
        Na__FpData__FindSceneForPlan
    } from './Na__FloorPlan__ProjectJson__Data__.js';
    import {
        Na__FpCfg__GetLabel,
        Na__FpCfg__GetSceneGroupTarget,
        Na__FpCfg__GetDatumRangeMm,
        Na__FpCfg__GetCutOffsetMm
    } from './Na__FloorPlan__ConfigState__.js';
    import {
        Na__FpFrame__MeasureModel
    } from './Na__FloorPlan__Framing__.js';
    import {
        Na__FpRow__BuildPlanRow
    } from './Na__FloorPlan__DevMenu__RowBuilders__.js';
    import {
        Na__FpLink__CreateSceneForPlan,
        Na__FpLink__RemoveSceneForPlan,
        Na__FpLink__SyncSceneCamera
    } from './Na__FloorPlan__SceneLink__.js';
    import {
        Na__FloorPlanMode__EnterPlan,
        Na__FloorPlanMode__ExitPlan,
        Na__FloorPlanMode__SetEditMode,
        Na__FloorPlanMode__IsEditMode,
        Na__FloorPlanMode__IsActive,
        Na__FloorPlanMode__GetActivePlan,
        Na__FloorPlanMode__StoreActiveFraming,
        Na__FpMode__CHANGED_EVENT
    } from './Na__FloorPlan__ModeController__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Drawing Core: Records' Block, Drafts, Folding Rows, the Row Shell
    // ------------------------------------------------------------
    // @delegate: ../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js
    // @delegate: ../40__System__DrawingViewCore/Na__DrawView__DraftGuard__.js
    // @delegate: ../40__System__DrawingViewCore/Na__DrawView__RowAccordion__.js
    // @delegate: ../40__System__DrawingViewCore/Na__DrawView__DevRowShell__.js
    // @delegate: ../40__System__DrawingViewCore/Na__DrawView__RenameDrawing__.js
    // @delegate: ../40__System__DrawingViewCore/Na__DrawView__SceneLinkRow__.js
    // ------------------------------------------------------------
    import {
        Na__DrawData__BLOCK_KEY,
        Na__DrawData__FLOOR_PLANS_KEY,
        Na__DrawData__CHANGED_EVENT
    } from '../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    import {
        Na__DrawDraft__CHANGED_EVENT,
        Na__DrawDraft__RegisterOwner,
        Na__DrawDraft__GetActive,
        Na__DrawDraft__IsActive,
        Na__DrawDraft__IsDirty,
        Na__DrawDraft__ChangedKeys,
        Na__DrawDraft__Describe,
        Na__DrawDraft__ActiveName,
        Na__DrawDraft__Revert,
        Na__DrawDraft__ConfirmLeave,
        Na__DrawDraft__SaveActive,
        Na__DrawDraft__SaveBlock
    } from '../40__System__DrawingViewCore/Na__DrawView__DraftGuard__.js';
    import {
        Na__DrawFold__Wrap,
        Na__DrawFold__GetOpenId,
        Na__DrawFold__SetOpenId,
        Na__DrawFold__CloseIfOpen
    } from '../40__System__DrawingViewCore/Na__DrawView__RowAccordion__.js';
    import {
        Na__DrawShell__Button,
        Na__DrawShell__BuildPanelHead,
        Na__DrawShell__BuildSwatch,
        Na__DrawShell__BuildHeaderChips,
        Na__DrawShell__BuildDangerZone,
        Na__DrawShell__UsageFor,
        Na__DrawShell__WhereSaved,
        Na__DrawShell__ConfirmUpdate,
        Na__DrawShell__ConfirmDelete
    } from '../40__System__DrawingViewCore/Na__DrawView__DevRowShell__.js';
    import { Na__DrawSceneRow__Build } from '../40__System__DrawingViewCore/Na__DrawView__SceneLinkRow__.js';
    import { Na__DrawRename__StageFloorPlan } from '../40__System__DrawingViewCore/Na__DrawView__RenameDrawing__.js';
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

    // MODULE IMPORTS | Thumbnail Capture
    // ------------------------------------------------------------
    // @delegate: ../21__System__PresentationMode/Na__PresentationMode__Thumbnail__Renderer.js
    // ------------------------------------------------------------
    import {
        Na__PresentationMode__Thumbnail__CaptureAndUpload
    } from '../21__System__PresentationMode/Na__PresentationMode__Thumbnail__Renderer.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Drawing Planes (the planes shown in the 3D view)
    // ------------------------------------------------------------
    // @delegate: ../47__System__DrawingPlanes/Na__DrawingPlanes__Overlay__.js
    // @delegate: ../47__System__DrawingPlanes/Na__DrawingPlanes__Grip__.js
    // @delegate: ../47__System__DrawingPlanes/Na__DrawingPlanes__DevMenu__Controls__.js
    // @delegate: ../47__System__DrawingPlanes/Na__DrawingPlanes__Maths__.js
    // @delegate: ../47__System__DrawingPlanes/Na__DrawingPlanes__ConfigState__.js
    // ------------------------------------------------------------
    import {
        Na__PlaneOverlay__KIND_HORIZONTAL,
        Na__PlaneOverlay__RegisterSource,
        Na__PlaneOverlay__GetColour,
        Na__PlaneOverlay__Select,
        Na__PlaneOverlay__DeselectType,
        Na__PlaneOverlay__Forget,
        Na__PlaneOverlay__Refresh,
        Na__PlaneOverlay__RefreshOne
    } from '../47__System__DrawingPlanes/Na__DrawingPlanes__Overlay__.js';
    import { Na__PlaneGrip__CancelFacePick } from '../47__System__DrawingPlanes/Na__DrawingPlanes__Grip__.js';
    import {
        Na__PlaneUi__TYPE_PLAN,
        Na__PlaneUi__BuildBar,
        Na__PlaneUi__BuildRowControls
    } from '../47__System__DrawingPlanes/Na__DrawingPlanes__DevMenu__Controls__.js';
    import {
        Na__PlaneMath__ApplySnap,
        Na__PlaneMath__FormatMm,
        Na__PlaneMath__SolvePlanCut
    } from '../47__System__DrawingPlanes/Na__DrawingPlanes__Maths__.js';
    import {
        Na__PlaneCfg__GetGripSetup,
        Na__PlaneCfg__GetAppearanceSetup
    } from '../47__System__DrawingPlanes/Na__DrawingPlanes__ConfigState__.js';
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

    // MODULE CONSTANTS | What a Draft Is Made Of
    // ------------------------------------------------------------
    // VIEW_KEYS are written by the mode controller every time a previewed
    // plan's view settles, so they change by being looked at and are never an
    // edit. MOVE_KEYS are the fields that change what a sheet viewport draws -
    // the ones the Update dialog warns about. The storey is neither: it names
    // the drawing and moves nothing.
    // ------------------------------------------------------------
    const Na__FpDev__VIEW_KEYS  = Object.freeze([ 'FloorPlan__CameraZoom', 'FloorPlan__CameraTargetMm' ]);
    const Na__FpDev__MOVE_KEYS  = Object.freeze([ 'FloorPlan__FloorDatumMm', 'FloorPlan__CutOffsetMm', 'FloorPlan__ViewDepthMm' ]);
    const Na__FpDev__STOREY_KEY = 'FloorPlan__StoreyLevel';
    const Na__FpDev__REFUSAL_GAP_MS = 2500;                                      // <-- A drag fires many refusals; one toast says it
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

    // MODULE VARIABLES | The Rows on the Page, and Whether an Update Is Writing
    // ------------------------------------------------------------
    const Na__FpDev__RowUi       = new Map();   // <-- FloorPlan__Id -> { chips, fold, refreshDraft, refreshIdentity }
    let   Na__FpDev__Busy        = false;
    let   Na__FpDev__LastRefusal = 0;
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


    // HELPER FUNCTION | Relay Only a Save's Errors (the caller words the success)
    // ------------------------------------------------------------
    function Na__FpDev__RelayErrors(message, isError) {
        if (isError) Na__FpDev__Toast(message, true);
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


    // HELPER FUNCTION | Is This the Plan Previewed in the Viewport
    // ------------------------------------------------------------
    function Na__FpDev__IsPreviewing(plan) {
        return Na__FloorPlanMode__IsActive() && Na__FloorPlanMode__GetActivePlan() === plan;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is the Panel Open
    // ------------------------------------------------------------
    function Na__FpDev__IsPanelOpen() {
        return Boolean(Na__FpDev__Panel && Na__FpDev__Panel.classList.contains('is-open'));
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
        if (!Na__FpDev__IsPreviewing(plan)) return;
        Na__SectionCut__SetPlaneHeightMm(
            Na__FpDev__CUT_ID_PREFIX + plan.FloorPlan__Id,
            Na__FpData__GetCutHeightMm(plan),
            liveDrag === true
        );
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Bring Up the Plane of the Plan Being Edited
    // ------------------------------------------------------------
    // Selecting a plane puts it up whether or not its Show plane toggle is on,
    // and re-lays it out at the cut the record now gives. Not while a plan is
    // previewing: nothing of the overlay is drawn over a drawing anyway.
    // ------------------------------------------------------------
    function Na__FpDev__ShowPlane(plan) {
        if (Na__FloorPlanMode__IsActive()) return;
        Na__PlaneOverlay__Select(Na__PlaneUi__TYPE_PLAN, plan.FloorPlan__Id);
        Na__PlaneOverlay__RefreshOne(Na__PlaneUi__TYPE_PLAN, plan.FloorPlan__Id);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Draft
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Refresh Every Row's Chips, and the Open Row's Buttons
    // ------------------------------------------------------------
    // Cheap, and called after every edit: the panel is NOT rebuilt for a
    // slider move, so this is what makes NOT UPDATED appear the moment
    // something changes and Update and Revert wake up with it.
    // ------------------------------------------------------------
    function Na__FpDev__RefreshDraftUi() {
        const isDirty = Na__DrawDraft__IsDirty();

        Na__FpDev__RowUi.forEach((ui, id) => {
            const plan = Na__FpData__GetPlanById(null, id);
            if (!plan) return;
            const isDraft = Na__DrawDraft__IsActive(Na__PlaneUi__TYPE_PLAN, id);

            ui.chips.set({ kind : '', isActive : Na__FpDev__IsPreviewing(plan), isDirty : isDraft && isDirty });
            ui.fold.name.textContent = plan.FloorPlan__Name;
            ui.refreshDraft({ isDirty : isDraft && isDirty, isBusy : Na__FpDev__Busy });
            if (isDraft) ui.refreshIdentity();                                   // <-- Built before it was opened: its name and storey are re-read now
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What Every Edit to the Open Row Ends With
    // ------------------------------------------------------------
    function Na__FpDev__AfterEdit() {
        Na__FpDev__RefreshDraftUi();                                             // <-- Chips, buttons, and the open row's name and storey
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Make a Plan the Open Drawing, If Nothing Else Is Waiting
    // ------------------------------------------------------------
    // What a cut plane dragged in the 3D view needs: its row may be folded,
    // even its panel closed. Opening the row begins its draft, so the move is
    // held like any other edit. Refused while a DIFFERENT drawing has changes
    // that have not been updated.
    // ------------------------------------------------------------
    function Na__FpDev__ClaimForEdit(plan) {
        const id = plan.FloorPlan__Id;
        if (Na__DrawDraft__IsActive(Na__PlaneUi__TYPE_PLAN, id)) return true;
        if (Na__DrawDraft__IsDirty()) {
            const now = Date.now();
            if ((now - Na__FpDev__LastRefusal) > Na__FpDev__REFUSAL_GAP_MS) {
                Na__FpDev__LastRefusal = now;
                Na__FpDev__Toast('"' + Na__DrawDraft__ActiveName() + '" has changes that have not been updated. '
                    + 'Update or revert it before moving "' + plan.FloorPlan__Name + '".', true);
            }
            return false;
        }
        Na__DrawFold__SetOpenId(id);                                             // <-- Nothing is waiting, so nothing to ask; the draft begins as the slot moves
        return Na__DrawDraft__IsActive(Na__PlaneUi__TYPE_PLAN, id);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put a Draft's Changes Into Words
    // ------------------------------------------------------------
    function Na__FpDev__DescribeChanges(before, plan, keys) {
        const lines = [];
        const has   = (key) => keys.indexOf(key) !== -1;
        const mm    = (value) => Na__PlaneMath__FormatMm(value) + ' mm';

        if (has('FloorPlan__Name')) lines.push('Name: "' + before.FloorPlan__Name + '" becomes "' + plan.FloorPlan__Name + '".');

        if (has(Na__FpDev__STOREY_KEY)) {
            const choice = Na__FpData__GetStoreyLevelChoices().find((entry) => entry.key === plan[Na__FpDev__STOREY_KEY]);
            lines.push(plan[Na__FpDev__STOREY_KEY]
                ? 'Storey: set to ' + (choice ? choice.label : plan[Na__FpDev__STOREY_KEY]) + '.'
                : 'Storey: back to being guessed from the cut.');
        }

        if (has('FloorPlan__FloorDatumMm') || has('FloorPlan__CutOffsetMm')) {
            const cutBefore = Na__FpData__GetCutHeightMm(before);
            const cutNow    = Na__FpData__GetCutHeightMm(plan);
            if (has('FloorPlan__FloorDatumMm')) lines.push('Floor level: ' + mm(before.FloorPlan__FloorDatumMm) + ' becomes ' + mm(plan.FloorPlan__FloorDatumMm) + '.');
            if (has('FloorPlan__CutOffsetMm'))  lines.push('Cut above floor: ' + mm(before.FloorPlan__CutOffsetMm) + ' becomes ' + mm(plan.FloorPlan__CutOffsetMm) + '.');
            lines.push((cutBefore === cutNow)
                ? 'The cut itself stays at ' + mm(cutNow) + '.'
                : 'The cut moves ' + mm(Math.abs(cutNow - cutBefore)) + ' ' + (cutNow > cutBefore ? 'up' : 'down') + ', from ' + mm(cutBefore) + ' to ' + mm(cutNow) + '.');
        }

        if (has('FloorPlan__ViewDepthMm')) {
            const say = (value) => (Number.isFinite(value) && value > 0) ? mm(value) : 'full';
            lines.push('View depth: ' + say(before.FloorPlan__ViewDepthMm) + ' becomes ' + say(plan.FloorPlan__ViewDepthMm) + '.');
        }

        if (has('FloorPlan__Annotations') || has('FloorPlan__Dimensions')) {
            lines.push('Markup: the annotations or dimensions drawn on it have changed.');
        }
        if (has('FloorPlan__Styles') || has('FloorPlan__ExcludeCategoryTokens') || has('FloorPlan__LineworkAsset')) {
            lines.push('Drawing styles have changed.');
        }
        if (has('FloorPlan__SceneId')) lines.push('Its carousel card was added.');

        const known = [ 'FloorPlan__Name', Na__FpDev__STOREY_KEY, 'FloorPlan__FloorDatumMm', 'FloorPlan__CutOffsetMm',
            'FloorPlan__ViewDepthMm', 'FloorPlan__Annotations', 'FloorPlan__Dimensions', 'FloorPlan__Styles',
            'FloorPlan__ExcludeCategoryTokens', 'FloorPlan__LineworkAsset', 'FloorPlan__SceneId' ];
        keys.filter((key) => known.indexOf(key) === -1).forEach((key) => lines.push(key + ' has changed.'));
        return lines;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Tell the Draft Guard About Floor Plans
    // ------------------------------------------------------------
    function Na__FpDev__RegisterDraftOwner() {
        Na__DrawDraft__RegisterOwner(Na__PlaneUi__TYPE_PLAN, {
            word      : 'floor plan',
            idKey     : 'FloorPlan__Id',
            nameKey   : 'FloorPlan__Name',
            arrayPath : [ Na__DrawData__BLOCK_KEY, Na__DrawData__FLOOR_PLANS_KEY ],
            viewKeys  : Na__FpDev__VIEW_KEYS,
            find      : (id) => Na__FpData__GetPlanById(null, id),

            // Style defaults are written on first read, which a preview would
            // otherwise do AFTER the snapshot and have it look like a change.
            prepare   : (plan) => { Na__FpData__GetStyles(plan); },

            describe    : Na__FpDev__DescribeChanges,

            afterRevert : (plan, touchedKeys) => {
                if (Na__FpDev__IsPreviewing(plan)) {
                    if (Na__FloorPlanMode__IsEditMode()) Na__FloorPlanMode__SetEditMode(false);   // <-- The markup it was editing has just been put back
                    Na__FloorPlanMode__EnterPlan(plan);                                         // <-- Re-cut and re-frame from the record as it now stands
                } else {
                    Na__FpDev__ShowPlane(plan);
                }
                Na__PlaneOverlay__Refresh();

                // The storey was put back by hand, past its own setter, so the
                // drawing titles that read it are told the way the setter tells them.
                if (Array.isArray(touchedKeys) && touchedKeys.indexOf(Na__FpDev__STOREY_KEY) !== -1) {
                    window.dispatchEvent(new CustomEvent(Na__FpData__STOREY_CHANGED_EVENT, {
                        detail : { planId : plan.FloorPlan__Id, key : plan[Na__FpDev__STOREY_KEY] || null }
                    }));
                }
                if (Na__FpDev__IsPanelOpen()) Na__FpDev__Render();
            }
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Drawing Planes Source
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Put a Plan's Cut at a Height
    // ------------------------------------------------------------
    // The plane in the 3D view IS the cut. Moving it changes "Cut above floor"
    // and leaves the floor level where the author set it; the floor level is
    // carried down only when the cut would fall under its minimum, so the
    // plane always goes where it was put. Held to what the floor level slider
    // can show at the bottom of its travel.
    // ------------------------------------------------------------
    function Na__FpDev__MoveCutTo(plan, cutMm) {
        const offset = Na__FpCfg__GetCutOffsetMm();
        const datum  = Na__FpCfg__GetDatumRangeMm();
        const lowest = datum.minMm + offset.minMm;

        const solved = Na__PlaneMath__SolvePlanCut(plan.FloorPlan__FloorDatumMm, Math.max(cutMm, lowest), offset.minMm);
        plan.FloorPlan__FloorDatumMm = Math.round(solved.datumMm);
        plan.FloorPlan__CutOffsetMm  = Math.round(solved.offsetMm);
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Say Where a Plan's Cut Is, as Both of Its Numbers
    // ------------------------------------------------------------
    function Na__FpDev__DescribePlane(plan) {
        return 'cut at ' + Na__PlaneMath__FormatMm(Na__FpData__GetCutHeightMm(plan)) + ' mm  ('
            + Na__PlaneMath__FormatMm(plan.FloorPlan__CutOffsetMm) + ' above floor level '
            + Na__PlaneMath__FormatMm(plan.FloorPlan__FloorDatumMm) + ')';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Send a Plan to a Picked Building Face
    // ------------------------------------------------------------
    // hit: { pointMm, normal } - the face's world normal, toward the camera.
    // A FLOOR IS A FLOOR LEVEL. Click the floor a plan is of and that height
    // becomes its floor level, the cut staying its distance above - cutting AT
    // the floor would draw nothing. Any other face - a wall, a sill, a reveal -
    // puts the cut itself through the picked point. Both land on the snap grid.
    // ------------------------------------------------------------
    function Na__FpDev__ApplyFacePick(plan, hit, snap) {
        if (!Na__FpDev__ClaimForEdit(plan)) return null;
        const heightMm = Na__PlaneMath__ApplySnap(hit.pointMm.y, snap);

        if (hit.normal.y >= Na__PlaneCfg__GetGripSetup().floorMinNormalY) {
            const range = Na__FpCfg__GetDatumRangeMm();
            plan.FloorPlan__FloorDatumMm = Math.min(range.maxMm, Math.max(range.minMm, heightMm));
            return '"' + plan.FloorPlan__Name + '" floor level set to that floor - ' + Na__FpDev__DescribePlane(plan) + '. Press Update to keep it.';
        }

        Na__FpDev__MoveCutTo(plan, heightMm);
        return '"' + plan.FloorPlan__Name + '" now cuts through that point - ' + Na__FpDev__DescribePlane(plan) + '. Press Update to keep it.';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Tell the Drawing Planes System About Floor Plans
    // ------------------------------------------------------------
    // A plan's plane is horizontal, at its cut. A drag or a pick writes the
    // same two fields the panel writes - into the open row's DRAFT, opening
    // the row first if it was folded - then runs what a slider release runs
    // and rebuilds the panel, so it shows where the plane landed.
    // ------------------------------------------------------------
    function Na__FpDev__RegisterPlaneSource() {
        Na__PlaneOverlay__RegisterSource(Na__PlaneUi__TYPE_PLAN, {
            kind          : Na__PlaneOverlay__KIND_HORIZONTAL,
            get paletteOffset() { return Na__PlaneCfg__GetAppearanceSetup().planPaletteOffset; },   // <-- Read when asked: the config may not have loaded when this registers
            list          : () => Na__FpData__GetFloorPlans(null),
            getId         : (plan) => plan.FloorPlan__Id,
            getName       : (plan) => plan.FloorPlan__Name,
            isSection     : () => true,                                          // <-- A plan always cuts
            getPositionMm : (plan) => Na__FpData__GetCutHeightMm(plan),
            setPositionMm : (plan, cutMm) => {
                if (!Na__FpDev__ClaimForEdit(plan)) return false;                // <-- Another drawing is unfinished: this plane stays where it is
                return Na__FpDev__MoveCutTo(plan, cutMm);
            },
            describe      : (plan) => Na__FpDev__DescribePlane(plan),
            onLive        : (plan) => Na__FpDev__PushLiveCut(plan, true),
            onCommit      : (plan) => {
                if (!Na__DrawDraft__IsActive(Na__PlaneUi__TYPE_PLAN, plan.FloorPlan__Id)) return;   // <-- The move was refused; nothing to re-derive
                Na__FpDev__PushLiveCut(plan, false);
                if (Na__FpDev__IsPanelOpen()) {
                    Na__FpDev__Render();
                } else if (Na__DrawDraft__IsDirty()) {
                    Na__FpDev__Toast('"' + plan.FloorPlan__Name + '" has moved but is not kept yet - open Dev Tools > '
                        + 'Floor Plans and press Update, or Revert to put it back.');
                }
            },
            applyFacePick : Na__FpDev__ApplyFacePick
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Row Handler Wiring
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the Carousel Card Status and Action for One Plan
    // ------------------------------------------------------------
    // Creating the card is the same call the Add path makes, so a plan that
    // lost its card - or never had one, because it predates the link - is
    // recovered rather than needing to be deleted and rebuilt. It is a save of
    // its own, so it asks for a row with nothing else pending.
    // ------------------------------------------------------------
    function Na__FpDev__BuildSceneLinkRow(plan) {
        const config = Na__FpDev__GetConfig();

        return Na__DrawSceneRow__Build({
            scene       : config ? Na__FpData__FindSceneForPlan(config, plan) : null,
            groupName   : Na__FpCfg__GetSceneGroupTarget().groupName,
            drawingWord : 'plan',
            onCreate    : async () => {
                if (!config) {
                    Na__FpDev__Toast('No presentation scene config loaded.', true);
                    return;
                }
                if (Na__DrawDraft__IsDirty()) {
                    Na__FpDev__Toast('Update or revert "' + plan.FloorPlan__Name + '" first, then add its card.', true);
                    return;
                }
                Na__FpLink__CreateSceneForPlan(config, plan, Na__FpDev__Measure(), Na__FpDev__Fov());
                Na__PresentationMode__ProjectJson__BroadcastScenesChanged();

                const report = {};
                const saved  = await Na__DrawDraft__SaveActive(Na__FpDev__RelayErrors, report);
                if (saved) {
                    const where = Na__DrawShell__WhereSaved(report);
                    Na__FpDev__Toast('Added "' + plan.FloorPlan__Name + '" to the scene carousel. ' + where.text, where.isError);
                }
                Na__FpDev__Render();
            }
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build One Plan Row With Its Handlers Bound
    // ------------------------------------------------------------
    // The row builder is purely presentational, so everything that actually
    // changes state is assembled here and handed to it. Every edit ends in
    // AfterEdit, which is what lights NOT UPDATED and wakes Update and Revert.
    // ------------------------------------------------------------
    function Na__FpDev__BuildRow(plan) {
        const isActive = Na__FpDev__IsPreviewing(plan);

        return Na__FpRow__BuildPlanRow(plan, {
            isActive   : isActive,
            isEditMode : isActive && Na__FloorPlanMode__IsEditMode(),

            planeControls : Na__PlaneUi__BuildRowControls(Na__PlaneUi__TYPE_PLAN, plan.FloorPlan__Id, { canAim : false }),
            sceneLinkRow  : Na__FpDev__BuildSceneLinkRow(plan),

            // THE NAME | Held in the draft with everything else. The card, the
            // section binding and the sheet fingerprints follow on Update.
            onNameTyped : (text) => {
                plan.FloorPlan__Name = text;
                Na__PlaneOverlay__Refresh();                                     // <-- Its plane in the 3D view carries the name
                Na__FpDev__AfterEdit(plan);
            },

            // THE STOREY | Its own row has already written the record. It names
            // the drawing and moves nothing, so there is nothing to re-cut.
            onStoreyChange : () => Na__FpDev__AfterEdit(plan),

            // The plane of the plan being touched is always up, and follows
            // the slider, so the numbers have something visible attached.
            onDatumLive   : () => {
                Na__FpDev__PushLiveCut(plan, true);
                Na__FpDev__ShowPlane(plan);
            },
            onDatumCommit : () => {
                Na__FpDev__PushLiveCut(plan, false);
                Na__FpDev__ShowPlane(plan);
                Na__FpDev__AfterEdit(plan);
            },

            onOffsetChange : () => {
                Na__FpDev__PushLiveCut(plan, false);
                Na__FpDev__ShowPlane(plan);
                Na__FpDev__AfterEdit(plan);
            },

            // Depth changes the PLANE SET, not just a constant, so the cut has
            // to be rebuilt rather than nudged.
            onDepthChange : () => {
                if (isActive) Na__FloorPlanMode__EnterPlan(plan);
                Na__FpDev__AfterEdit(plan);
            },

            onPreviewToggle : () => {
                if (isActive) {
                    Na__FloorPlanMode__ExitPlan(null);
                } else {
                    Na__PlaneGrip__CancelFacePick(Na__PlaneUi__TYPE_PLAN);       // <-- A face is picked in the 3D view, which is about to go
                    Na__FloorPlanMode__EnterPlan(plan);
                }
            },
            onAnnotate : () => Na__FloorPlanMode__SetEditMode(!Na__FloorPlanMode__IsEditMode()),
            onUpdate   : () => Na__FpDev__UpdatePlan(plan),
            onRevert   : () => Na__FpDev__RevertPlan(plan)
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Update and Revert
// -----------------------------------------------------------------------------

    // FUNCTION | Keep the Open Plan as It Is Set Now
    // ------------------------------------------------------------
    // The one press that writes a plan: its settings, its name in every place
    // a name is held, its card's approach camera - and, when it is on screen,
    // its framing and a new thumbnail. Asks first. R2 and the local copy in
    // one save; a failure leaves the row changed so it can be pressed again or
    // reverted.
    // ------------------------------------------------------------
    async function Na__FpDev__UpdatePlan(plan) {
        if (Na__FpDev__Busy) return false;
        if (!Na__DrawDraft__IsActive(Na__PlaneUi__TYPE_PLAN, plan.FloorPlan__Id)) {
            Na__FpDev__Toast('Open "' + plan.FloorPlan__Name + '" before updating it.', true);
            return false;
        }

        const config       = Na__FpDev__GetConfig();
        const scene        = config ? Na__FpData__FindSceneForPlan(config, plan) : null;
        const isPreviewing = Na__FpDev__IsPreviewing(plan);
        const keys         = Na__DrawDraft__ChangedKeys();
        if (keys.length === 0 && !isPreviewing) return false;                    // <-- Nothing to keep; the button is disabled in this state anyway

        const confirmed = await Na__DrawShell__ConfirmUpdate({
            word         : 'floor plan',
            name         : Na__DrawDraft__ActiveName(),
            changes      : (keys.length > 0) ? Na__DrawDraft__Describe() : [ 'No settings have changed.' ],
            usage        : Na__DrawShell__UsageFor(plan.FloorPlan__Id, scene ? scene.PresentationMode__Scene__Id : plan.FloorPlan__SceneId),
            movesDrawing : keys.some((key) => Na__FpDev__MOVE_KEYS.indexOf(key) !== -1),
            willCapture  : isPreviewing && !!scene,
            confirmLabel : Na__FpCfg__GetLabel('UpdateLabel', 'Update Floor Plan')
        });
        if (!confirmed) return false;

        Na__FpDev__Busy = true;
        Na__FpDev__RefreshDraftUi();

        let staged = null;
        try {
            // THE PICTURE | Only of a plan that is on screen: the capture is of
            // the viewport, so from 3D it would file a picture of the model as
            // the plan's card. The thumbnail IS the framing, so recording the
            // framing here means the card and the view it opens at cannot disagree.
            if (isPreviewing && Na__FpDev__IsPreviewing(plan)) {
                Na__FloorPlanMode__StoreActiveFraming();
                if (scene) {
                    try {
                        const shot = await Na__PresentationMode__Thumbnail__CaptureAndUpload(scene.PresentationMode__Scene__Id);
                        if (shot.ok) scene.PresentationMode__Scene__ThumbnailUrl = shot.relUrl;
                        else Na__FpDev__Toast('Thumbnail upload failed (' + shot.error + ') - the plan is still being updated.', true);
                    } catch (shotError) {
                        console.error('[TrueVision3D] Floor plan thumbnail error:', shotError);
                        Na__FpDev__Toast('Thumbnail error - see console. The plan is still being updated.', true);
                    }
                }
            }

            // THE CARD | Its approach camera is derived from the record, and its
            // name is one of four holders of the drawing's name.
            if (config) Na__FpLink__SyncSceneCamera(config, plan, Na__FpDev__Measure(), Na__FpDev__Fov());
            staged = await Na__DrawRename__StageFloorPlan(plan);

            const report = {};
            const saved  = await Na__DrawDraft__SaveActive(Na__FpDev__RelayErrors, report);
            if (!saved) {
                if (staged) staged.undo();                                       // <-- Nothing reached R2, so the card keeps the name it had
                Na__FpDev__Toast('"' + plan.FloorPlan__Name + '" was NOT updated. Its changes are still here - press Update again, or Revert.', true);
                return false;
            }

            Na__PresentationMode__ProjectJson__BroadcastScenesChanged();         // <-- The card carries the name and the thumbnail
            Na__PlaneOverlay__Refresh();

            const where = Na__DrawShell__WhereSaved(report);
            Na__FpDev__Toast('"' + plan.FloorPlan__Name + '" updated. ' + where.text, where.isError);
            return true;

        } catch (error) {
            console.error('[TrueVision3D] Floor plan update error:', error);
            if (staged) staged.undo();
            Na__FpDev__Toast('Floor plan update failed - see console. Its changes are still here.', true);
            return false;

        } finally {
            Na__FpDev__Busy = false;
            if (Na__FpDev__IsPanelOpen()) Na__FpDev__Render();
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Put the Open Plan Back to How It Was Last Updated
    // ------------------------------------------------------------
    async function Na__FpDev__RevertPlan(plan) {
        if (Na__FpDev__Busy) return false;
        if (!Na__DrawDraft__IsActive(Na__PlaneUi__TYPE_PLAN, plan.FloorPlan__Id) || !Na__DrawDraft__IsDirty()) return false;

        const confirmed = await Na__PresentationMode__DevMenu__Confirm({
            title         : 'Revert "' + Na__DrawDraft__ActiveName() + '"?',
            message       : 'This throws away the changes below and puts the floor plan back exactly as it was last updated. '
                          + 'Nothing is written - nothing was saved.',
            details       : Na__DrawDraft__Describe(),
            confirmLabel  : 'Revert Floor Plan',
            cancelLabel   : 'Keep Editing',
            isDestructive : true
        });
        if (!confirmed) return false;

        Na__DrawDraft__Revert();                                                 // <-- The owner's afterRevert re-derives the drawing and rebuilds the panel
        Na__FpDev__Toast('"' + plan.FloorPlan__Name + '" is back as it was last updated.');
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Panel Mutations
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | What Adding Anything Needs First
    // ------------------------------------------------------------
    // A config to put the card in, a model to measure, and an answer about any
    // changes waiting in the open row - the new drawing becomes the open one.
    // Resolves the config, or null having said why.
    // ------------------------------------------------------------
    async function Na__FpDev__ReadyToAdd() {
        const config = Na__FpDev__GetConfig();
        if (!config) {
            Na__FpDev__Toast('No presentation scene config loaded.', true);
            return null;
        }
        if (!Na__FpDev__Measure()) {
            Na__FpDev__Toast(Na__FpCfg__GetLabel('NoModelMessage', 'Load a model before adding floor plans.'), true);
            return null;
        }
        if (!(await Na__DrawDraft__ConfirmLeave())) return null;                 // <-- Keep Editing: nothing is added
        return config;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Create One Plan Record and Its Card (No Save, No Render)
    // ------------------------------------------------------------
    function Na__FpDev__CreateOne(config, options) {
        const plan = Na__FpData__CreatePlan(config, options || {});
        if (!plan) return null;
        Na__FpLink__CreateSceneForPlan(config, plan, Na__FpDev__Measure(), Na__FpDev__Fov());
        return plan;
    }
    // ------------------------------------------------------------


    // FUNCTION | Add One Floor Plan, Open It, and Save
    // ------------------------------------------------------------
    // Saved at once, as a new scene is: it has no sheet viewports yet, so
    // there is nothing for it to move, and a drawing that exists only in
    // memory is one reload from never having existed.
    // ------------------------------------------------------------
    async function Na__FpDev__AddPlan(options) {
        if (Na__FpDev__Busy) return null;
        const config = await Na__FpDev__ReadyToAdd();
        if (!config) return null;

        const plan = Na__FpDev__CreateOne(config, options || {});
        if (!plan) return null;

        Na__PresentationMode__ProjectJson__BroadcastScenesChanged();             // <-- Or the new card stays invisible all session
        Na__PlaneOverlay__Refresh();
        Na__DrawFold__SetOpenId(plan.FloorPlan__Id);                             // <-- The one row you want is the one row open; its draft begins clean
        Na__FpDev__Render();

        const report = {};
        const saved  = await Na__DrawDraft__SaveBlock(Na__FpDev__RelayErrors, report);
        if (saved) {
            const where = Na__DrawShell__WhereSaved(report);
            Na__FpDev__Toast('"' + plan.FloorPlan__Name + '" added. ' + where.text, where.isError);
        }
        return plan;
    }
    // ------------------------------------------------------------


    // FUNCTION | Create One Plan Per Detected Model Storey
    // ------------------------------------------------------------
    async function Na__FpDev__SeedFromStoreys() {
        if (Na__FpDev__Busy) return 0;

        const storeys = Na__FpDev__MeasureStoreys();
        if (storeys.length === 0) {
            Na__FpDev__Toast(Na__FpCfg__GetLabel('NoStoreysMessage', 'No named storeys detected in this model.'), true);
            return 0;
        }

        const existing = Na__FpData__GetFloorPlans(null).length;
        if (existing > 0) {
            const proceed = await Na__PresentationMode__DevMenu__Confirm({
                title        : 'Add ' + storeys.length + ' more floor plan' + (storeys.length === 1 ? '' : 's') + '?',
                message      : 'This project already has ' + existing + ' floor plan' + (existing === 1 ? '' : 's') + '. Seeding adds one for '
                             + 'each storey of the model beside them - it replaces nothing - and saves.',
                confirmLabel : 'Add Plans',
                cancelLabel  : 'Cancel',
                isCommit     : true
            });
            if (!proceed) return 0;
        }

        const config = await Na__FpDev__ReadyToAdd();
        if (!config) return 0;

        let made = 0;
        for (let i = 0; i < storeys.length; i++) {
            if (Na__FpDev__CreateOne(config, { name : storeys[i].name, floorDatumMm : storeys[i].floorDatumMm })) made++;
        }

        Na__PresentationMode__ProjectJson__BroadcastScenesChanged();
        Na__PlaneOverlay__Refresh();
        Na__DrawFold__SetOpenId(null);
        Na__FpDev__Render();

        const report = {};
        const saved  = await Na__DrawDraft__SaveBlock(Na__FpDev__RelayErrors, report);
        if (saved) {
            const where = Na__DrawShell__WhereSaved(report);
            Na__FpDev__Toast('Created ' + made + ' floor plan(s) from the model storeys. ' + where.text, where.isError);
        }
        return made;
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete a Floor Plan, Its Scene and Its Annotations
    // ------------------------------------------------------------
    async function Na__FpDev__DeletePlan(plan) {
        if (Na__FpDev__Busy) return false;
        const config = Na__FpDev__GetConfig();
        if (!config) return false;

        const scene = Na__FpData__FindSceneForPlan(config, plan);
        const confirmed = await Na__DrawShell__ConfirmDelete({
            word  : 'floor plan',
            name  : plan.FloorPlan__Name,
            usage : Na__DrawShell__UsageFor(plan.FloorPlan__Id, scene ? scene.PresentationMode__Scene__Id : plan.FloorPlan__SceneId)
        });
        if (!confirmed) return false;

        if (Na__FpDev__IsPreviewing(plan)) {
            Na__FloorPlanMode__ExitPlan(null);                                   // <-- Never leave a deleted plan on screen
        }
        Na__PlaneGrip__CancelFacePick(Na__PlaneUi__TYPE_PLAN);
        Na__DrawFold__CloseIfOpen(plan.FloorPlan__Id);                           // <-- Its draft ends with it: there is nothing left to put back

        const orphanedSceneId = Na__FpData__DeletePlan(config, plan.FloorPlan__Id);
        if (orphanedSceneId) Na__FpLink__RemoveSceneForPlan(config, orphanedSceneId);
        Na__PlaneOverlay__Forget(Na__PlaneUi__TYPE_PLAN, plan.FloorPlan__Id);    // <-- After the record has gone, so the refresh finds nothing to keep up

        Na__PresentationMode__ProjectJson__BroadcastScenesChanged();             // <-- Drop the card with the plan
        Na__FpDev__Render();

        const report = {};
        const saved  = await Na__DrawDraft__SaveBlock(Na__FpDev__RelayErrors, report);
        if (saved) {
            const where = Na__DrawShell__WhereSaved(report);
            Na__FpDev__Toast('"' + plan.FloorPlan__Name + '" deleted. ' + where.text, where.isError);
        } else {
            Na__FpDev__Toast('"' + plan.FloorPlan__Name + '" was deleted here but the save FAILED - it is still on R2. '
                + 'Reload to get it back, or save again from any drawing.', true);
        }
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Panel Render
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the Client Measuring Toggle
    // ------------------------------------------------------------
    // The gate for the live app. Off unless switched on, stored in the
    // drawings block - and SAVED THE MOMENT IT IS TICKED. It used to wait for
    // the Save Floor Plans button, which has gone; a grant that looks ticked
    // and is not saved is a client who cannot measure and an author who cannot
    // see why. A drawing still being edited stays out of that save.
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

        check.addEventListener('change', async () => {
            const wanted = check.checked;
            Na__FpData__SetClientDimensionsEnabled(config, wanted);
            Na__PlanDimClient__SetAllowed(wanted);                               // <-- Applies without a reload
            check.disabled = true;

            const report = {};
            const saved  = await Na__DrawDraft__SaveBlock(Na__FpDev__RelayErrors, report);
            check.disabled = false;

            if (saved) {
                const where = Na__DrawShell__WhereSaved(report);
                Na__FpDev__Toast('Client measuring ' + (wanted ? 'switched on' : 'switched off') + '. ' + where.text, where.isError);
            } else {
                Na__FpData__SetClientDimensionsEnabled(config, !wanted);         // <-- Not saved, so not set: the tick goes back
                Na__PlanDimClient__SetAllowed(!wanted);
                check.checked = !wanted;
            }
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
        ) + ' Saved as soon as it is ticked.';
        return note;
    }
    // ------------------------------------------------------------


    // FUNCTION | Rebuild the Whole Floor Plan Panel
    // ------------------------------------------------------------
    function Na__FpDev__Render() {
        if (!Na__FpDev__Panel) return;
        Na__FpDev__Panel.innerHTML = '';
        Na__FpDev__RowUi.clear();

        // HEAD | The title, and a + where it takes no scrolling to reach
        Na__FpDev__Panel.appendChild(Na__DrawShell__BuildPanelHead({
            title    : Na__FpCfg__GetLabel('SectionTitle', 'Floor Plans'),
            addTitle : 'Add a new floor plan',
            onAdd    : () => { void Na__FpDev__AddPlan({}); }
        }));

        const plans = Na__FpData__GetFloorPlans(null);

        // DRAWING PLANES | Show all, snap and its grid - the same bar the
        // Elevations panel carries, because the state behind it is shared.
        const planesBar = (plans.length > 0) ? Na__PlaneUi__BuildBar() : null;
        if (planesBar) Na__FpDev__Panel.appendChild(planesBar);

        // ONE ROW OPEN AT A TIME. Everything a row holds goes inside the fold's
        // body, or it would stay visible - and pressable - under a folded header.
        for (let i = 0; i < plans.length; i++) {
            const plan  = plans[i];
            const built = Na__FpDev__BuildRow(plan);
            const chips = Na__DrawShell__BuildHeaderChips();

            const fold = Na__DrawFold__Wrap(built.row, {
                id    : plan.FloorPlan__Id,
                title : plan.FloorPlan__Name,
                lead  : Na__DrawShell__BuildSwatch(Na__PlaneOverlay__GetColour(Na__PlaneUi__TYPE_PLAN, plan.FloorPlan__Id)),
                trail : chips.element
            });

            // DELETE | Below a rule, alone, at the very foot of the open row
            fold.body.appendChild(Na__DrawShell__BuildDangerZone({
                label    : Na__FpCfg__GetLabel('DeleteLabel', 'Delete Floor Plan'),
                title    : 'Delete this floor plan, its card and its markup. Asks first.',
                onDelete : () => { void Na__FpDev__DeletePlan(plan); }
            }));

            Na__FpDev__RowUi.set(plan.FloorPlan__Id, {
                chips           : chips,
                fold            : fold,
                refreshDraft    : built.refreshDraft,
                refreshIdentity : built.refreshIdentity
            });
            Na__FpDev__Panel.appendChild(built.row);
        }

        const note = document.createElement('p');
        note.className   = 'na-fp-dev__empty';
        note.textContent = (plans.length === 0)
            ? 'No floor plans yet. Press + to add one, or seed them from the model storeys.'
            : 'Open one floor plan at a time. Its changes show at once - in the preview, on its plane, on the sheets - '
              + 'and are kept only when you press Update.';
        Na__FpDev__Panel.appendChild(note);

        // FOOT | Making drawings. There is deliberately no Save here.
        const actions = document.createElement('div');
        actions.className = 'na-pm-dev__global-actions';
        actions.appendChild(Na__DrawShell__Button(
            Na__FpCfg__GetLabel('AddPlanLabel', '+ Add Floor Plan'), 'na-pm-dev__btn--primary',
            'Add a new floor plan', () => { void Na__FpDev__AddPlan({}); }
        ));
        actions.appendChild(Na__DrawShell__Button(
            Na__FpCfg__GetLabel('SeedFromStoreysLabel', 'Seed From Model Storeys'), '',
            'One floor plan for each storey the model names', () => { void Na__FpDev__SeedFromStoreys(); }
        ));
        Na__FpDev__Panel.appendChild(actions);

        // CLIENT MEASURING | Sits with the plan tools it governs
        const clientTitle = document.createElement('div');
        clientTitle.className   = 'na-dropdown-menu__panel-title';
        clientTitle.textContent = 'Live App';
        Na__FpDev__Panel.appendChild(clientTitle);
        Na__FpDev__Panel.appendChild(Na__FpDev__BuildClientDimensionsToggle());
        Na__FpDev__Panel.appendChild(Na__FpDev__BuildClientDimensionsNote());

        Na__FpDev__RefreshDraftUi();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Open the Row of the Plan on Screen, If Nothing Is Waiting
    // ------------------------------------------------------------
    // The panel follows the carousel, as the Presentation Scenes panel does.
    // Never past a changed row - a passive event does not get to ask about
    // throwing work away, and does not throw it away.
    // ------------------------------------------------------------
    function Na__FpDev__FollowPreview() {
        if (!Na__FloorPlanMode__IsActive() || Na__DrawDraft__IsDirty()) return;
        const active = Na__FloorPlanMode__GetActivePlan();
        if (active && Na__DrawFold__GetOpenId() !== active.FloorPlan__Id) Na__DrawFold__SetOpenId(active.FloorPlan__Id);
    }
    // ------------------------------------------------------------


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
        Na__FpDev__RegisterPlaneSource();                                        // <-- Plan cuts can now be shown, dragged and picked in the 3D view
        Na__FpDev__RegisterDraftOwner();                                         // <-- And an open row's edits are held until Update

        toggle.addEventListener('click', async () => {
            const isOpen = panel.classList.contains('is-open');

            if (isOpen) {
                // CLOSING | A changed plan is not left behind a closed panel
                // without being asked about. A changed ELEVATION is the other
                // panel's business and is left alone.
                const draft = Na__DrawDraft__GetActive();
                if (draft && draft.type === Na__PlaneUi__TYPE_PLAN) {
                    if (!(await Na__DrawDraft__ConfirmLeave())) return;          // <-- Keep Editing: the panel stays open
                    Na__DrawFold__SetOpenId(null);
                }
                panel.classList.remove('is-open');
                toggle.setAttribute('aria-expanded', 'false');

                // The plane that was only up because its row was being edited
                // goes; planes SWITCHED ON stay.
                Na__PlaneGrip__CancelFacePick(Na__PlaneUi__TYPE_PLAN);
                Na__PlaneOverlay__DeselectType(Na__PlaneUi__TYPE_PLAN);
                return;
            }

            panel.classList.add('is-open');
            toggle.setAttribute('aria-expanded', 'true');
            Na__FpDev__FollowPreview();                                          // <-- What is on screen is what is unfolded
            Na__FpDev__Render();                                                 // <-- Rebuild on each open so data is fresh
        });

        // Preview and Annotate button states are derived from mode, so the
        // panel refreshes whenever the controller reports a change.
        window.addEventListener(Na__FpMode__CHANGED_EVENT, () => {
            if (!Na__FpDev__IsPanelOpen()) return;
            Na__FpDev__FollowPreview();
            Na__FpDev__Render();
        });

        // A project switch during the same session replaces the scene config
        // and the drawings block.
        window.addEventListener('na-presentation-mode-scenes-loaded', () => {
            if (Na__FpDev__IsPanelOpen()) Na__FpDev__Render();
        });
        window.addEventListener(Na__DrawData__CHANGED_EVENT, (event) => {
            if (Na__FpDev__IsPanelOpen() && event.detail && event.detail.reason === 'loaded') Na__FpDev__Render();
        });

        // A draft begun, ended, reverted or kept - from either panel, or from
        // a plane dragged in the 3D view - changes what the chips and the
        // buttons should say.
        window.addEventListener(Na__DrawDraft__CHANGED_EVENT, () => {
            if (Na__FpDev__IsPanelOpen()) Na__FpDev__RefreshDraftUi();
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
