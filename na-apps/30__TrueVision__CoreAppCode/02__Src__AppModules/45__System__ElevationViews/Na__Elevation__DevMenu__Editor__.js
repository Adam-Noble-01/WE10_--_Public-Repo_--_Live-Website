// =============================================================================
// TRUEVISION3D - ELEVATION VIEWS - DEV MENU EDITOR
// =============================================================================
//
// FILE       : Na__Elevation__DevMenu__Editor__.js
// NAMESPACE  : Na__ElevDev
// MODULE     : Elevation Views - Dev Menu Editor
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Localhost-only authoring UI for creating and tuning elevations
// CREATED    : 07-Sep-2026
//
// DESCRIPTION:
// - The developer-facing half of the feature: add an elevation, point it at a
//   face of the building, slide its drawing plane, preview it, mark it up, and
//   UPDATE it.
//
// - BUILT LIKE THE PRESENTATION SCENES PANEL (Adam, 20-Sep-2026). One row is
//   open at a time and every other is a folded header, so the controls in
//   front of you belong to the drawing in front of you. A + at the top makes a
//   new one. Delete sits alone below a rule. And there is no Save at the foot
//   of the panel that writes every drawing at once.
//
// - AN OPEN ROW IS A DRAFT, AND UPDATE IS THE ONLY THING THAT KEEPS IT. A
//   sheet viewport is drawn FROM an elevation's record, so moving a plane
//   moves every viewport of it under the dimensions lettered on top. Edits
//   show live - in the preview, on the plane in the 3D view, on the sheets -
//   but nothing is written until the green Update, which asks first, says what
//   changed and which sheets draw from it, and writes R2 and the local copy in
//   one save. Leaving a changed row asks: discard, or keep editing. No other
//   panel's save can carry a half-moved elevation out with it.
//   @delegate: ../40__System__DrawingViewCore/Na__DrawView__DraftGuard__.js
//
// - UPDATE ALSO TAKES THE PICTURE. It replaced Save Thumbnail: with the
//   elevation on screen, Update records the framing and re-renders its card's
//   thumbnail in the same press. Off screen it keeps the settings and says
//   the thumbnail was left alone.
//
// - WHICH ELEVATION IT IS COMES FROM THE PROJECT'S NORTH. The four compass
//   buttons that set a bearing against the model's own axis are gone; the row
//   states the direction, names the drawing from it, and lets the name be
//   typed over. @delegate: ./Na__Elevation__AutoName__.js
//
// - EVERY ELEVATION HAS A PLANE IN THE 3D VIEW (47__System__DrawingPlanes). A
//   plane can be dragged along its normal, sent to a picked face (Move to
//   face) or turned to face a wall (Aim at face), and every one of those
//   writes the same two numbers the sliders write. Dragging the plane of a
//   drawing whose row is folded OPENS that row - the move is a draft like any
//   other - and is refused while a different drawing has changes waiting.
//
// - SEED N / E / S / W makes the four sides square to the MODEL, which is
//   where the building's faces are, and names each from the project's north.
//
// INTEGRATION:
// - Initialized from Index.html alongside the other localhost-only dev tools.
// - Drives Na__Elevation__ModeController__ for preview and markup.
// - Saves through Na__DrawData__Save (R2, then the local copy), by way of the
//   draft guard.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 2.1.0 (Elevation Depth Fog)
// - onFogChange: an edit to the open row's Fog block. The fog layer reads the
//   record on every frame it draws, so nothing is rebuilt - a frame is asked
//   for and the draft is told, like any other edit. Elevation__DepthFog is a
//   draft key for free (the comparison is per top-level key and deep), is put
//   into words for the Update and Discard dialogs, and is NOT a move key: it
//   changes how far back a drawing reads, never where anything on it is, so an
//   Update that only touches fog keeps its ordinary green dialog.
//
// 20-Sep-2026 - Version 2.0.0 (Floor Plans and Elevations menu rebuild)
// - Rows fold; one is open at a time, across this panel and Floor Plans.
// - The open row is a draft. Update (green, confirmed) keeps it and writes R2
//   and the local copy; Revert and the leave prompt discard it.
// - FIXED: Save Elevations wrote only the presentation block. The elevation
//   RECORDS moved to LayoutEditor__DrawingsData in v2.21.0 and this panel was
//   never repointed, so since 10-Sep a plane moved here was kept by whichever
//   OTHER panel next saved the drawings block - or not at all. Every save now
//   goes through Na__DrawData__Save.
// - Save Elevations (the save-everything button) and Save Thumbnail are gone.
// - A + at the head of the panel; Delete below a rule, behind the app's own
//   dialog naming the sheet viewports that draw from the elevation.
// - "Viewed from" N / E / S / W replaced by a statement from the project's
//   north; names follow the direction until typed over; new and seeded
//   elevations are named that way. The stored bearing moved under Advanced.
// - The carousel card's camera and name are brought into step on Update, not
//   on every slider release, so nothing of a draft reaches the presentation
//   block before it is kept.
// - The panel follows the carousel: previewing an elevation opens its row.
//
// 20-Sep-2026 - Version 1.1.0
// - Elevation planes are shown through the shared Drawing Planes system
//   instead of Na__Elevation__PlaneGizmo__: a Show plane toggle, Move to face
//   and Aim at face on every row, and the Drawing Planes bar (all on, snap and
//   its grid) at the head of the panel. The editor registers an elevation
//   SOURCE with the overlay; a drag or a pick in the 3D view runs the same
//   commit a slider release runs and rebuilds the panel.
// - Closing the panel no longer takes every plane down - only the one that was
//   up because its row was being edited.
// - "Centre on model" and Seed N / E / S / W centre on the BUILDING, on the
//   snap grid. They used the whole model's bounds, whose centre on a real
//   project is the landscape's: PS01's three planes sat at (20 000, -20 000),
//   off the corner of the house, and nothing showed it until the planes did.
//
// 07-Sep-2026 - Version 1.0.0
// - Initial implementation for the Elevation Drawings build.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Presentation Scene Config and Thumbnail Capture
    // ------------------------------------------------------------
    import {
        Na__PresentationMode__ProjectJson__GetActiveConfig,
        Na__PresentationMode__ProjectJson__BroadcastScenesChanged
    } from '../21__System__PresentationMode/Na__PresentationMode__ProjectJson__SceneData.js';
    import {
        Na__PresentationMode__Thumbnail__CaptureAndUpload
    } from '../21__System__PresentationMode/Na__PresentationMode__Thumbnail__Renderer.js';
    import { Na__PresentationMode__DevMenu__Confirm } from '../21__System__PresentationMode/Na__PresentationMode__DevMenu__Modal__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Section Cut Live Update
    // ------------------------------------------------------------
    import {
        Na__SectionCut__SetPlaneDistanceMm
    } from '../41__System__SectionCutEngine/Na__SectionCut__Engine__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Render Loop Invalidation
    // ------------------------------------------------------------
    // For the one edit that rebuilds nothing: the depth fog is read off the
    // record as each frame is drawn, so all a changed number needs is a frame.
    // ------------------------------------------------------------
    import { Na__RenderLoop__RequestRender } from '../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Elevation Data, Config, Framing, Link, Name and Mode
    // ------------------------------------------------------------
    // @delegate: ./Na__Elevation__ProjectJson__Data__.js
    // @delegate: ./Na__Elevation__Framing__.js
    // @delegate: ./Na__Elevation__DevMenu__RowBuilders__.js
    // @delegate: ./Na__Elevation__SceneLink__.js
    // @delegate: ./Na__Elevation__AutoName__.js
    // @delegate: ./Na__Elevation__ModeController__.js
    // ------------------------------------------------------------
    import {
        Na__ElevData__GetElevations,
        Na__ElevData__GetElevationById,
        Na__ElevData__CreateElevation,
        Na__ElevData__DeleteElevation,
        Na__ElevData__GetAxes,
        Na__ElevData__GetPlaneOriginMm,
        Na__ElevData__SetPlaneOriginMm,
        Na__ElevData__GetPlaneDistanceMm,
        Na__ElevData__AzimuthFromNormal,
        Na__ElevData__GetStyles,
        Na__ElevData__GetDepthFog,
        Na__ElevData__IsSection,
        Na__ElevData__FindSceneFor
    } from './Na__Elevation__ProjectJson__Data__.js';
    import {
        Na__ElevCfg__GetDirectionPresets,
        Na__ElevCfg__GetLabel,
        Na__ElevCfg__GetSceneGroupTarget
    } from './Na__Elevation__ConfigState__.js';
    import {
        Na__ElevFrame__MeasureModel,
        Na__ElevFrame__GetBounds,
        Na__ElevFrame__GetCentredPlaneOriginMm
    } from './Na__Elevation__Framing__.js';
    import {
        Na__ElevRow__BuildElevationRow
    } from './Na__Elevation__DevMenu__RowBuilders__.js';
    import {
        Na__ElevLink__CreateSceneForElevation,
        Na__ElevLink__RemoveSceneForElevation,
        Na__ElevLink__SyncSceneCamera
    } from './Na__Elevation__SceneLink__.js';
    import {
        Na__ElevName__F_AUTO,
        Na__ElevName__FacingWord,
        Na__ElevName__Derive,
        Na__ElevName__SetAuto,
        Na__ElevName__Adopt,
        Na__ElevName__Sync,
        Na__ElevName__ApplyTyped
    } from './Na__Elevation__AutoName__.js';
    import {
        Na__ElevationMode__EnterElevation,
        Na__ElevationMode__ExitElevation,
        Na__ElevationMode__SetEditMode,
        Na__ElevationMode__IsEditMode,
        Na__ElevationMode__IsActive,
        Na__ElevationMode__RefreshActive,
        Na__ElevationMode__GetActiveElevation,
        Na__ElevationMode__StoreActiveFraming,
        Na__ElevMode__CHANGED_EVENT
    } from './Na__Elevation__ModeController__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Drawing Core: Records' Block, Drafts, Folding Rows, the Row Shell
    // ------------------------------------------------------------
    // @delegate: ../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js
    // @delegate: ../40__System__DrawingViewCore/Na__DrawView__DraftGuard__.js
    // @delegate: ../40__System__DrawingViewCore/Na__DrawView__RowAccordion__.js
    // @delegate: ../40__System__DrawingViewCore/Na__DrawView__DevRowShell__.js
    // @delegate: ../40__System__DrawingViewCore/Na__DrawView__RenameDrawing__.js
    // ------------------------------------------------------------
    import {
        Na__DrawData__BLOCK_KEY,
        Na__DrawData__ELEVATIONS_KEY,
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
    import { Na__DrawRename__StageElevation } from '../40__System__DrawingViewCore/Na__DrawView__RenameDrawing__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Project's North (its words load with its config)
    // ------------------------------------------------------------
    import { Na__NorthCfg__Load } from '../46__System__NorthDirection/Na__North__ConfigState__.js';
    import { Na__NorthData__CHANGED_EVENT } from '../46__System__NorthDirection/Na__North__ProjectJson__Data__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Drawing Planes (the planes shown in the 3D view)
    // ------------------------------------------------------------
    // @delegate: ../47__System__DrawingPlanes/Na__DrawingPlanes__Overlay__.js
    // @delegate: ../47__System__DrawingPlanes/Na__DrawingPlanes__Grip__.js
    // @delegate: ../47__System__DrawingPlanes/Na__DrawingPlanes__DevMenu__Controls__.js
    // @delegate: ../47__System__DrawingPlanes/Na__DrawingPlanes__Maths__.js
    // ------------------------------------------------------------
    import {
        Na__PlaneOverlay__KIND_VERTICAL,
        Na__PlaneOverlay__RegisterSource,
        Na__PlaneOverlay__GetColour,
        Na__PlaneOverlay__Select,
        Na__PlaneOverlay__DeselectType,
        Na__PlaneOverlay__Forget,
        Na__PlaneOverlay__Refresh,
        Na__PlaneOverlay__RefreshOne,
        Na__PlaneOverlay__GetSnap
    } from '../47__System__DrawingPlanes/Na__DrawingPlanes__Overlay__.js';
    import { Na__PlaneBounds__Measure } from '../47__System__DrawingPlanes/Na__DrawingPlanes__Bounds__.js';
    import {
        Na__PlaneGrip__MODE_AIM,
        Na__PlaneGrip__CancelFacePick
    } from '../47__System__DrawingPlanes/Na__DrawingPlanes__Grip__.js';
    import {
        Na__PlaneUi__TYPE_ELEVATION,
        Na__PlaneUi__BuildBar,
        Na__PlaneUi__BuildRowControls
    } from '../47__System__DrawingPlanes/Na__DrawingPlanes__DevMenu__Controls__.js';
    import {
        Na__PlaneMath__ApplySnap,
        Na__PlaneMath__FormatMm,
        Na__PlaneMath__MoveOriginToDistance
    } from '../47__System__DrawingPlanes/Na__DrawingPlanes__Maths__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | DOM Identifiers
    // ------------------------------------------------------------
    const Na__ElevDev__PANEL_ID  = 'naElevationDevPanel';
    const Na__ElevDev__ITEM_ID   = 'naElevationDevItem';
    const Na__ElevDev__TOGGLE_ID = 'naElevationDevToggle';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Section Cut Plane Id Prefix (mirrors the controller)
    // ------------------------------------------------------------
    const Na__ElevDev__CUT_ID_PREFIX = 'ElevationCut__';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | What a Draft Is Made Of
    // ------------------------------------------------------------
    // VIEW_KEYS are written by the mode controller every time a previewed
    // drawing's view settles, so they change by being looked at and are never
    // an edit. MOVE_KEYS are the fields that reposition what a sheet viewport
    // draws - the ones the Update dialog warns about.
    // ------------------------------------------------------------
    const Na__ElevDev__VIEW_KEYS = Object.freeze([ 'Elevation__CameraZoom', 'Elevation__CameraTargetMm' ]);
    const Na__ElevDev__MOVE_KEYS = Object.freeze([
        'Elevation__AzimuthDeg', 'Elevation__PlaneOriginMm', 'Elevation__Mode', 'Elevation__ViewDepthMm'
    ]);
    const Na__ElevDev__REFUSAL_GAP_MS = 2500;                                    // <-- A drag fires many refusals; one toast says it
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Host Context
    // ------------------------------------------------------------
    let Na__ElevDev__Panel       = null;
    let Na__ElevDev__ModelRoot   = null;
    let Na__ElevDev__Camera      = null;
    let Na__ElevDev__ShowToast   = null;
    let Na__ElevDev__Initialized = false;
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Rows on the Page, and Whether an Update Is Writing
    // ------------------------------------------------------------
    const Na__ElevDev__RowUi       = new Map();   // <-- Elevation__Id -> { chips, fold, refreshDraft, refreshIdentity }
    let   Na__ElevDev__Busy        = false;
    let   Na__ElevDev__LastRefusal = 0;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Get the Live Presentation Scene Config
    // ------------------------------------------------------------
    function Na__ElevDev__GetConfig() {
        return Na__PresentationMode__ProjectJson__GetActiveConfig();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show a Toast if the Host Supplied One
    // ------------------------------------------------------------
    function Na__ElevDev__Toast(message, isError) {
        if (typeof Na__ElevDev__ShowToast === 'function') Na__ElevDev__ShowToast(message, isError === true);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Relay Only a Save's Errors (the caller words the success)
    // ------------------------------------------------------------
    function Na__ElevDev__RelayErrors(message, isError) {
        if (isError) Na__ElevDev__Toast(message, true);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Field of View of the Live Perspective Camera
    // ------------------------------------------------------------
    function Na__ElevDev__Fov() {
        return Na__ElevDev__Camera ? Na__ElevDev__Camera.fov : 30;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Measure the Loaded Model for One Elevation
    // ------------------------------------------------------------
    function Na__ElevDev__Measure(elevation) {
        return Na__ElevFrame__MeasureModel(Na__ElevDev__ModelRoot, Na__ElevDev__Camera, elevation);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is This the Elevation Previewed in the Viewport
    // ------------------------------------------------------------
    function Na__ElevDev__IsPreviewing(elevation) {
        return Na__ElevationMode__IsActive() && Na__ElevationMode__GetActiveElevation() === elevation;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is the Panel Open
    // ------------------------------------------------------------
    function Na__ElevDev__IsPanelOpen() {
        return Boolean(Na__ElevDev__Panel && Na__ElevDev__Panel.classList.contains('is-open'));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Bring Up the Plane of the Row Being Edited
    // ------------------------------------------------------------
    // Selecting a plane puts it up whether or not its Show plane toggle is on,
    // and re-lays it out where the record now says it stands - so the numbers
    // always have something visible attached, as the old single gizmo did.
    // Not while a drawing is previewing: nothing of the overlay is drawn over a
    // drawing anyway, and the selection would only flash up on the way out.
    // ------------------------------------------------------------
    function Na__ElevDev__ShowGizmo(elevation) {
        if (Na__ElevationMode__IsActive()) return;
        Na__PlaneOverlay__Select(Na__PlaneUi__TYPE_ELEVATION, elevation.Elevation__Id);
        Na__PlaneOverlay__RefreshOne(Na__PlaneUi__TYPE_ELEVATION, elevation.Elevation__Id);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Push an Elevation's Live Plane Position to the Engine
    // ------------------------------------------------------------
    // Only meaningful for a section - a plain elevation has no plane
    // registered at all, which is why this is a no-op rather than a guarded
    // write in that case.
    // ------------------------------------------------------------
    function Na__ElevDev__PushLiveCut(elevation, liveDrag) {
        if (!Na__ElevDev__IsPreviewing(elevation)) return;
        if (!Na__ElevData__IsSection(elevation)) return;

        Na__SectionCut__SetPlaneDistanceMm(
            Na__ElevDev__CUT_ID_PREFIX + elevation.Elevation__Id,
            Na__ElevData__GetPlaneDistanceMm(elevation),
            liveDrag === true
        );
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Re-Derive Everything On Screen That Depends on the Plane
    // ------------------------------------------------------------
    // The live cut, camera and drawing axes when the drawing is on screen,
    // otherwise its plane in the 3D view. Called on commit rather than on
    // every input, so dragging stays cheap.
    //
    // NOT THE CAROUSEL CARD'S CAMERA. That lives in the presentation block,
    // which other panels save on their own; writing it here put a piece of an
    // unfinished draft where the draft guard cannot reach. It is derived from
    // the record, so Update brings it into step in the save that keeps the
    // record.
    // ------------------------------------------------------------
    function Na__ElevDev__CommitGeometry(elevation) {
        if (Na__ElevDev__IsPreviewing(elevation)) {
            Na__ElevationMode__RefreshActive();
        } else {
            Na__ElevDev__ShowGizmo(elevation);
        }
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
    function Na__ElevDev__RefreshDraftUi() {
        const isDirty = Na__DrawDraft__IsDirty();

        Na__ElevDev__RowUi.forEach((ui, id) => {
            const elevation = Na__ElevData__GetElevationById(null, id);
            if (!elevation) return;
            const isDraft = Na__DrawDraft__IsActive(Na__PlaneUi__TYPE_ELEVATION, id);

            ui.chips.set({
                kind     : Na__ElevData__IsSection(elevation) ? 'SECTION' : '',
                isActive : Na__ElevDev__IsPreviewing(elevation),
                isDirty  : isDraft && isDirty
            });
            ui.fold.name.textContent = elevation.Elevation__Name;
            ui.refreshDraft({ isDirty : isDraft && isDirty, isBusy : Na__ElevDev__Busy });

            // The row was BUILT before it was opened, and opening it is what
            // recognises a hand-lettered name as an automatic one - so what it
            // says about its name is re-read now, not left as it was built.
            if (isDraft) ui.refreshIdentity();
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What Every Edit to the Open Row Ends With
    // ------------------------------------------------------------
    // nameMayFollow: the edit turned the elevation or changed its type, so an
    // automatic name is brought into step first.
    // ------------------------------------------------------------
    function Na__ElevDev__AfterEdit(elevation, nameMayFollow) {
        if (nameMayFollow === true && Na__ElevName__Sync(elevation)) {
            Na__PlaneOverlay__Refresh();                                         // <-- Its plane in the 3D view carries the name
        }
        Na__ElevDev__RefreshDraftUi();                                           // <-- Chips, buttons, and the open row's name and sentence
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Make an Elevation the Open Drawing, If Nothing Else Is Waiting
    // ------------------------------------------------------------
    // What a plane dragged in the 3D view needs: its row may be folded, even
    // its panel closed. Opening the row begins its draft, so the move is held
    // like any other edit. Refused while a DIFFERENT drawing has changes that
    // have not been updated - one unfinished drawing at a time is the rule
    // that keeps a stray edit from ever being out of sight.
    // ------------------------------------------------------------
    function Na__ElevDev__ClaimForEdit(elevation) {
        const id = elevation.Elevation__Id;
        if (Na__DrawDraft__IsActive(Na__PlaneUi__TYPE_ELEVATION, id)) return true;
        if (Na__DrawDraft__IsDirty()) {
            const now = Date.now();
            if ((now - Na__ElevDev__LastRefusal) > Na__ElevDev__REFUSAL_GAP_MS) {
                Na__ElevDev__LastRefusal = now;
                Na__ElevDev__Toast('"' + Na__DrawDraft__ActiveName() + '" has changes that have not been updated. '
                    + 'Update or revert it before moving "' + elevation.Elevation__Name + '".', true);
            }
            return false;
        }
        Na__DrawFold__SetOpenId(id);                                             // <-- Nothing is waiting, so nothing to ask; the draft begins as the slot moves
        return Na__DrawDraft__IsActive(Na__PlaneUi__TYPE_ELEVATION, id);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put a Draft's Changes Into Words
    // ------------------------------------------------------------
    // before is the record as last updated, keys the top-level fields that
    // differ. What the Update and Discard dialogs list.
    // ------------------------------------------------------------
    function Na__ElevDev__DescribeChanges(before, elevation, keys) {
        const lines = [];
        const has   = (key) => keys.indexOf(key) !== -1;
        const mm    = (value) => Na__PlaneMath__FormatMm(value) + ' mm';

        if (has('Elevation__Name')) {
            lines.push('Name: "' + before.Elevation__Name + '" becomes "' + elevation.Elevation__Name + '".');
        } else if (has(Na__ElevName__F_AUTO)) {
            lines.push(elevation[Na__ElevName__F_AUTO] === true
                ? 'Name: now follows the way the elevation faces.'
                : 'Name: now a name of its own.');
        }

        if (has('Elevation__AzimuthDeg')) {
            const wordBefore = Na__ElevName__FacingWord(before);
            const wordNow    = Na__ElevName__FacingWord(elevation);
            lines.push('Turned: model bearing ' + before.Elevation__AzimuthDeg + ' to ' + elevation.Elevation__AzimuthDeg + ' deg'
                + ((wordBefore && wordNow && wordBefore !== wordNow) ? (' - the ' + wordBefore + ' elevation becomes the ' + wordNow + ' elevation.') : '.'));
        }

        if (has('Elevation__PlaneOriginMm')) {
            const from = Na__ElevData__GetPlaneOriginMm(before);
            const to   = Na__ElevData__GetPlaneOriginMm(elevation);
            const axes = Na__ElevData__GetAxes(elevation);
            const along = ((to.xMm - from.xMm) * axes.normalX) + ((to.zMm - from.zMm) * axes.normalZ);
            lines.push('Plane moved ' + mm(Math.abs(along)) + ' ' + (along >= 0 ? 'toward the viewer' : 'into the model')
                + ' (X ' + mm(from.xMm) + ' to ' + mm(to.xMm) + ', Z ' + mm(from.zMm) + ' to ' + mm(to.zMm) + ').');
        }

        if (has('Elevation__Mode')) {
            lines.push('Drawing type: ' + before.Elevation__Mode + ' becomes ' + elevation.Elevation__Mode + '.');
        }

        if (has('Elevation__ViewDepthMm')) {
            const say = (value) => (Number.isFinite(value) && value > 0) ? mm(value) : 'full';
            lines.push('View depth: ' + say(before.Elevation__ViewDepthMm) + ' becomes ' + say(elevation.Elevation__ViewDepthMm) + '.');
        }

        // FOG | Said as the row says it: two distances behind the plane and how
        // hard it comes on. `before` is a parsed copy, so reading its fog
        // through the normaliser writes nothing anybody keeps.
        if (has('Elevation__DepthFog')) {
            const was  = Na__ElevData__GetDepthFog(before);
            const now  = Na__ElevData__GetDepthFog(elevation);
            const runs = (fog) => mm(fog.startDepthMm) + ' to ' + mm(fog.endDepthMm) + ' behind the plane, fall-off ' + fog.falloffPercent + '%';
            if (was.enabled !== now.enabled) {
                lines.push(now.enabled ? ('Fog: switched on - ' + runs(now) + '.') : 'Fog: switched off.');
            } else {
                lines.push('Fog: ' + runs(was) + ' becomes ' + runs(now) + (now.enabled ? '.' : ' (it is switched off).'));
            }
        }

        if (has('Elevation__Annotations') || has('Elevation__Dimensions')) {
            lines.push('Markup: the annotations or dimensions drawn on it have changed.');
        }
        if (has('Elevation__Styles') || has('Elevation__ExcludeCategoryTokens') || has('Elevation__LineworkAsset')) {
            lines.push('Drawing styles have changed.');
        }
        if (has('Elevation__SceneId')) lines.push('Its carousel card was added.');

        const known = [ 'Elevation__Name', Na__ElevName__F_AUTO, 'Elevation__AzimuthDeg', 'Elevation__PlaneOriginMm',
            'Elevation__Mode', 'Elevation__ViewDepthMm', 'Elevation__DepthFog', 'Elevation__Annotations', 'Elevation__Dimensions',
            'Elevation__Styles', 'Elevation__ExcludeCategoryTokens', 'Elevation__LineworkAsset', 'Elevation__SceneId' ];
        keys.filter((key) => known.indexOf(key) === -1).forEach((key) => lines.push(key + ' has changed.'));
        return lines;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Tell the Draft Guard About Elevations
    // ------------------------------------------------------------
    function Na__ElevDev__RegisterDraftOwner() {
        Na__DrawDraft__RegisterOwner(Na__PlaneUi__TYPE_ELEVATION, {
            word      : 'elevation',
            idKey     : 'Elevation__Id',
            nameKey   : 'Elevation__Name',
            arrayPath : [ Na__DrawData__BLOCK_KEY, Na__DrawData__ELEVATIONS_KEY ],
            viewKeys  : Na__ElevDev__VIEW_KEYS,
            find      : (id) => Na__ElevData__GetElevationById(null, id),

            // Before the snapshot: nothing here is an edit. Style defaults are
            // written on first read, which a preview would otherwise do LATER
            // and have it look like a change; and a record lettered by hand to
            // the very name its direction gives is recognised as automatic.
            prepare   : (elevation) => {
                Na__ElevData__GetStyles(elevation);
                Na__ElevName__Adopt(elevation);
            },

            // After it: an automatic name catching up with a north set since
            // the drawing was last updated IS a change, and shows as one.
            afterBegin : (elevation) => { Na__ElevName__Sync(elevation); },

            describe    : Na__ElevDev__DescribeChanges,

            afterRevert : (elevation) => {
                if (Na__ElevDev__IsPreviewing(elevation) && Na__ElevationMode__IsEditMode()) {
                    Na__ElevationMode__SetEditMode(false);                       // <-- The markup it was editing has just been put back
                }
                Na__ElevDev__PushLiveCut(elevation, false);
                Na__ElevDev__CommitGeometry(elevation);
                Na__PlaneOverlay__Refresh();
                if (Na__ElevDev__IsPanelOpen()) Na__ElevDev__Render();
            }
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Drawing Planes Source
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Centre of the BUILDING, on the Snap Grid
    // ------------------------------------------------------------
    // What "Centre on model", a new elevation and Seed N / E / S / W mean. They
    // used to take the centre of the whole model's bounds, and on a real
    // project that is the centre of the LANDSCAPE: PS01's slab is 80 m square,
    // so its three seeded planes all landed at (20 000, -20 000), off the
    // corner of a house that stands around (15 000, -15 400). Nobody could see
    // that until the planes were drawn. The building's own bounds come from
    // the Drawing Planes system, which never measures the landscape; the old
    // centre stands in only when no building can be told apart.
    // ------------------------------------------------------------
    function Na__ElevDev__BuildingCentreMm(elevation) {
        const measured = Na__PlaneBounds__Measure(Na__ElevDev__ModelRoot);
        if (!measured) return Na__ElevFrame__GetCentredPlaneOriginMm(Na__ElevDev__Measure(elevation || null));

        const snap = Na__PlaneOverlay__GetSnap();
        return {
            xMm : Na__PlaneMath__ApplySnap(((measured.box.min.x + measured.box.max.x) / 2) * 1000, snap),
            zMm : Na__PlaneMath__ApplySnap(((measured.box.min.z + measured.box.max.z) / 2) * 1000, snap)
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put an Elevation's Plane a Distance Along Its Own Normal
    // ------------------------------------------------------------
    // The record stores a POINT the plane passes through, which is what the two
    // sliders move. The point slides along the normal and not across it, so the
    // numbers the sliders show change by the least that moves the plane.
    // ------------------------------------------------------------
    function Na__ElevDev__MovePlaneTo(elevation, distanceMm) {
        const axes   = Na__ElevData__GetAxes(elevation);
        const origin = Na__ElevData__GetPlaneOriginMm(elevation);
        const moved  = Na__PlaneMath__MoveOriginToDistance(origin.xMm, origin.zMm, axes.normalX, axes.normalZ, distanceMm);
        return Na__ElevData__SetPlaneOriginMm(elevation, moved.xMm, moved.zMm);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Say Where a Plane Is, in the Panel's Own Terms
    // ------------------------------------------------------------
    // A plane square to the world is described by the slider that moves it;
    // only a plane at an angle is described by its distance along the view.
    // ------------------------------------------------------------
    function Na__ElevDev__DescribePlane(elevation) {
        const axes   = Na__ElevData__GetAxes(elevation);
        const origin = Na__ElevData__GetPlaneOriginMm(elevation);
        if (Math.abs(axes.normalZ) < 1e-6) return Na__ElevCfg__GetLabel('PlaneXFieldLabel', 'Plane X') + '  ' + Na__PlaneMath__FormatMm(origin.xMm) + ' mm';
        if (Math.abs(axes.normalX) < 1e-6) return Na__ElevCfg__GetLabel('PlaneZFieldLabel', 'Plane Z') + '  ' + Na__PlaneMath__FormatMm(origin.zMm) + ' mm';
        return Na__PlaneMath__FormatMm(Na__ElevData__GetPlaneDistanceMm(elevation)) + ' mm along the view';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Send an Elevation's Plane to a Picked Building Face
    // ------------------------------------------------------------
    // hit: { pointMm, normal } - the face's world normal, toward the camera.
    // MOVE keeps the bearing and puts the plane through the picked point, on
    // the snap grid. AIM first turns the elevation to face the wall square on -
    // ValeVision's pick - and refuses a floor or a roof, which has no bearing
    // to give. Returns the toast, or null when refused (the pick stays armed).
    // ------------------------------------------------------------
    function Na__ElevDev__ApplyFacePick(elevation, hit, snap, mode) {
        if (!Na__ElevDev__ClaimForEdit(elevation)) return null;

        if (mode === Na__PlaneGrip__MODE_AIM) {
            const flat = Math.hypot(hit.normal.x, hit.normal.z);
            if (flat < 0.2) {
                Na__ElevDev__Toast('That face is a floor or a roof - click a wall to aim the elevation at.', true);
                return null;
            }
            elevation.Elevation__AzimuthDeg = Na__ElevData__AzimuthFromNormal(hit.normal.x / flat, hit.normal.z / flat);
        }

        const axes     = Na__ElevData__GetAxes(elevation);
        const distance = (hit.pointMm.x * axes.normalX) + (hit.pointMm.z * axes.normalZ);
        Na__ElevDev__MovePlaneTo(elevation, Na__PlaneMath__ApplySnap(distance, snap));
        Na__ElevName__Sync(elevation);                                           // <-- Turned to a new wall: an automatic name turns with it

        return '"' + elevation.Elevation__Name + '" '
            + ((mode === Na__PlaneGrip__MODE_AIM) ? ('now faces that wall (model bearing ' + elevation.Elevation__AzimuthDeg + ' deg) - ') : 'moved to the face - ')
            + Na__ElevDev__DescribePlane(elevation) + '. Press Update to keep it.';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Tell the Drawing Planes System About Elevations
    // ------------------------------------------------------------
    // Everything the shared overlay and grip need to show, move and pick an
    // elevation's plane. A drag or a pick writes the same fields the sliders
    // write - into the open row's DRAFT, opening the row first if it was
    // folded - then runs the same commit a slider release runs and rebuilds
    // the panel, so the sliders show where the plane landed.
    // ------------------------------------------------------------
    function Na__ElevDev__RegisterPlaneSource() {
        Na__PlaneOverlay__RegisterSource(Na__PlaneUi__TYPE_ELEVATION, {
            kind          : Na__PlaneOverlay__KIND_VERTICAL,
            paletteOffset : 0,
            list          : () => Na__ElevData__GetElevations(null),
            getId         : (elevation) => elevation.Elevation__Id,
            getName       : (elevation) => elevation.Elevation__Name,
            isSection     : (elevation) => Na__ElevData__IsSection(elevation),
            getAxes       : (elevation) => Na__ElevData__GetAxes(elevation),
            getPositionMm : (elevation) => Na__ElevData__GetPlaneDistanceMm(elevation),
            setPositionMm : (elevation, distanceMm) => {
                if (!Na__ElevDev__ClaimForEdit(elevation)) return false;         // <-- Another drawing is unfinished: this plane stays where it is
                return Na__ElevDev__MovePlaneTo(elevation, distanceMm);
            },
            describe      : (elevation) => Na__ElevDev__DescribePlane(elevation),
            onLive        : (elevation) => Na__ElevDev__PushLiveCut(elevation, true),
            onCommit      : (elevation) => {
                if (!Na__DrawDraft__IsActive(Na__PlaneUi__TYPE_ELEVATION, elevation.Elevation__Id)) return;   // <-- The move was refused; nothing to re-derive
                Na__ElevDev__PushLiveCut(elevation, false);
                Na__ElevDev__CommitGeometry(elevation);
                if (Na__ElevDev__IsPanelOpen()) {
                    Na__ElevDev__Render();
                } else if (Na__DrawDraft__IsDirty()) {
                    Na__ElevDev__Toast('"' + elevation.Elevation__Name + '" has moved but is not kept yet - open Dev Tools > '
                        + 'Elevations and press Update, or Revert to put it back.');
                }
            },
            applyFacePick : Na__ElevDev__ApplyFacePick
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Row Handler Wiring
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the Carousel Card Status and Action for One Elevation
    // ------------------------------------------------------------
    // Creating the card is the same call the Add path makes, so an elevation
    // that lost its card is recovered rather than needing to be rebuilt. It is
    // a save of its own - a card nobody can reach is not something to leave
    // waiting on an Update - so it asks for a row with nothing else pending.
    // ------------------------------------------------------------
    function Na__ElevDev__BuildSceneLinkRow(elevation) {
        const config = Na__ElevDev__GetConfig();

        return Na__DrawSceneRow__Build({
            scene       : config ? Na__ElevData__FindSceneFor(config, elevation) : null,
            groupName   : Na__ElevCfg__GetSceneGroupTarget().groupName,
            drawingWord : 'elevation',
            onCreate    : async () => {
                if (!config) {
                    Na__ElevDev__Toast('No presentation scene config loaded.', true);
                    return;
                }
                if (Na__DrawDraft__IsDirty()) {
                    Na__ElevDev__Toast('Update or revert "' + elevation.Elevation__Name + '" first, then add its card.', true);
                    return;
                }
                Na__ElevLink__CreateSceneForElevation(
                    config, elevation, Na__ElevDev__Measure(elevation), Na__ElevDev__Fov()
                );
                Na__PresentationMode__ProjectJson__BroadcastScenesChanged();

                const report = {};
                const saved  = await Na__DrawDraft__SaveActive(Na__ElevDev__RelayErrors, report);
                if (saved) {
                    const where = Na__DrawShell__WhereSaved(report);
                    Na__ElevDev__Toast('Added "' + elevation.Elevation__Name + '" to the scene carousel. ' + where.text, where.isError);
                }
                Na__ElevDev__Render();
            }
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build One Elevation Row With Its Handlers Bound
    // ------------------------------------------------------------
    // The row builder is purely presentational, so everything that actually
    // changes state is assembled here and handed to it. Every edit ends in
    // AfterEdit, which is what lights NOT UPDATED and wakes Update and Revert.
    // ------------------------------------------------------------
    function Na__ElevDev__BuildRow(elevation) {
        const isActive = Na__ElevDev__IsPreviewing(elevation);

        return Na__ElevRow__BuildElevationRow(elevation, {
            isActive   : isActive,
            isEditMode : isActive && Na__ElevationMode__IsEditMode(),

            planeControls : Na__PlaneUi__BuildRowControls(
                Na__PlaneUi__TYPE_ELEVATION, elevation.Elevation__Id, { canAim : true }
            ),
            sceneLinkRow  : Na__ElevDev__BuildSceneLinkRow(elevation),

            // THE NAME | Held in the draft with everything else. The card, the
            // section binding and the sheet fingerprints follow on Update.
            onNameTyped : (text) => {
                Na__ElevName__ApplyTyped(elevation, text);
                Na__PlaneOverlay__Refresh();                                     // <-- Its plane in the 3D view carries the name
                Na__ElevDev__AfterEdit(elevation, false);
            },
            onUseAutoName : () => {
                Na__ElevName__SetAuto(elevation, true);
                Na__ElevName__Sync(elevation);
                Na__PlaneOverlay__Refresh();
                Na__ElevDev__AfterEdit(elevation, false);
            },

            // A new bearing changes the camera basis outright, so the drawing
            // has to be rebuilt rather than nudged.
            onDirectionChange : () => {
                Na__ElevDev__CommitGeometry(elevation);
                Na__ElevDev__AfterEdit(elevation, true);
            },

            // Elevation and section differ only in whether the plane bites,
            // but that IS a change of plane set, so the same full rebuild.
            onModeChange : () => {
                Na__ElevDev__CommitGeometry(elevation);
                Na__ElevDev__AfterEdit(elevation, true);
            },

            onPlaneLive   : () => {
                Na__ElevDev__PushLiveCut(elevation, true);
                Na__ElevDev__ShowGizmo(elevation);
            },
            onPlaneCommit : () => {
                Na__ElevDev__PushLiveCut(elevation, false);
                Na__ElevDev__CommitGeometry(elevation);
                Na__ElevDev__AfterEdit(elevation, false);
            },

            onCentrePlane : () => {
                const centred = Na__ElevDev__BuildingCentreMm(elevation);        // <-- The building's centre, not the landscape's
                if (!centred) {
                    Na__ElevDev__Toast(Na__ElevCfg__GetLabel('NoModelMessage', 'Load a model before adding elevations.'), true);
                    return;
                }
                Na__ElevData__SetPlaneOriginMm(elevation, centred.xMm, centred.zMm);
                Na__ElevDev__PushLiveCut(elevation, false);
                Na__ElevDev__CommitGeometry(elevation);
                Na__ElevDev__AfterEdit(elevation, false);
            },

            // Depth changes the PLANE SET, not just a constant, so the cut has
            // to be rebuilt rather than nudged.
            onDepthChange : () => {
                Na__ElevDev__CommitGeometry(elevation);
                Na__ElevDev__AfterEdit(elevation, false);
            },

            // THE FOG REBUILDS NOTHING. No plane moves and no cut changes; the
            // fog layer reads this record as it draws each frame, so the edit is
            // already in force and all it lacks is a frame to be seen in. Off
            // screen there is nothing to draw, and the draft still learns of it.
            onFogChange : () => {
                Na__RenderLoop__RequestRender();
                Na__ElevDev__AfterEdit(elevation, false);
            },

            onPreviewToggle : () => {
                if (isActive) {
                    Na__ElevationMode__ExitElevation(null);
                } else {
                    Na__PlaneGrip__CancelFacePick(Na__PlaneUi__TYPE_ELEVATION);  // <-- A face is picked in the 3D view, which is about to go. The planes need no hiding: they are never drawn over a drawing
                    Na__ElevationMode__EnterElevation(elevation);
                }
            },
            onAnnotate : () => Na__ElevationMode__SetEditMode(!Na__ElevationMode__IsEditMode()),
            onUpdate   : () => Na__ElevDev__UpdateElevation(elevation),
            onRevert   : () => Na__ElevDev__RevertElevation(elevation)
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Update and Revert
// -----------------------------------------------------------------------------

    // FUNCTION | Keep the Open Elevation as It Is Set Now
    // ------------------------------------------------------------
    // The one press that writes an elevation: its settings, its name in every
    // place a name is held, its card's approach camera - and, when it is on
    // screen, its framing and a new thumbnail. Asks first. R2 and the local
    // copy in one save; a failure leaves the row changed so it can be pressed
    // again or reverted.
    // ------------------------------------------------------------
    async function Na__ElevDev__UpdateElevation(elevation) {
        if (Na__ElevDev__Busy) return false;
        if (!Na__DrawDraft__IsActive(Na__PlaneUi__TYPE_ELEVATION, elevation.Elevation__Id)) {
            Na__ElevDev__Toast('Open "' + elevation.Elevation__Name + '" before updating it.', true);
            return false;
        }

        const config       = Na__ElevDev__GetConfig();
        const scene        = config ? Na__ElevData__FindSceneFor(config, elevation) : null;
        const isPreviewing = Na__ElevDev__IsPreviewing(elevation);
        const keys         = Na__DrawDraft__ChangedKeys();
        if (keys.length === 0 && !isPreviewing) return false;                    // <-- Nothing to keep; the button is disabled in this state anyway

        const confirmed = await Na__DrawShell__ConfirmUpdate({
            word         : 'elevation',
            name         : Na__DrawDraft__ActiveName(),
            changes      : (keys.length > 0) ? Na__DrawDraft__Describe() : [ 'No settings have changed.' ],
            usage        : Na__DrawShell__UsageFor(elevation.Elevation__Id, scene ? scene.PresentationMode__Scene__Id : elevation.Elevation__SceneId),
            movesDrawing : keys.some((key) => Na__ElevDev__MOVE_KEYS.indexOf(key) !== -1),
            willCapture  : isPreviewing && !!scene,
            confirmLabel : Na__ElevCfg__GetLabel('UpdateLabel', 'Update Elevation')
        });
        if (!confirmed) return false;

        Na__ElevDev__Busy = true;
        Na__ElevDev__RefreshDraftUi();

        let staged = null;
        try {
            // THE PICTURE | Only of a drawing that is on screen: the capture is
            // of the viewport. The thumbnail IS the framing, so recording the
            // framing here means the card and the view it opens at cannot disagree.
            if (isPreviewing && Na__ElevDev__IsPreviewing(elevation)) {
                Na__ElevationMode__StoreActiveFraming();
                if (scene) {
                    try {
                        const shot = await Na__PresentationMode__Thumbnail__CaptureAndUpload(scene.PresentationMode__Scene__Id);
                        if (shot.ok) scene.PresentationMode__Scene__ThumbnailUrl = shot.relUrl;
                        else Na__ElevDev__Toast('Thumbnail upload failed (' + shot.error + ') - the elevation is still being updated.', true);
                    } catch (shotError) {
                        console.error('[TrueVision3D] Elevation thumbnail error:', shotError);
                        Na__ElevDev__Toast('Thumbnail error - see console. The elevation is still being updated.', true);
                    }
                }
            }

            // THE CARD | Its approach camera is derived from the record, and its
            // name is one of four holders of the drawing's name.
            if (config) Na__ElevLink__SyncSceneCamera(config, elevation, Na__ElevDev__Measure(elevation), Na__ElevDev__Fov());
            staged = await Na__DrawRename__StageElevation(elevation);

            const report = {};
            const saved  = await Na__DrawDraft__SaveActive(Na__ElevDev__RelayErrors, report);
            if (!saved) {
                if (staged) staged.undo();                                       // <-- Nothing reached R2, so the card keeps the name it had
                Na__ElevDev__Toast('"' + elevation.Elevation__Name + '" was NOT updated. Its changes are still here - press Update again, or Revert.', true);
                return false;
            }

            Na__PresentationMode__ProjectJson__BroadcastScenesChanged();         // <-- The card carries the name and the thumbnail
            Na__PlaneOverlay__Refresh();

            const where = Na__DrawShell__WhereSaved(report);
            Na__ElevDev__Toast('"' + elevation.Elevation__Name + '" updated. ' + where.text, where.isError);
            return true;

        } catch (error) {
            console.error('[TrueVision3D] Elevation update error:', error);
            if (staged) staged.undo();
            Na__ElevDev__Toast('Elevation update failed - see console. Its changes are still here.', true);
            return false;

        } finally {
            Na__ElevDev__Busy = false;
            if (Na__ElevDev__IsPanelOpen()) Na__ElevDev__Render();
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Put the Open Elevation Back to How It Was Last Updated
    // ------------------------------------------------------------
    // Asks, because it throws work away - and lists what, so the question is
    // about something.
    // ------------------------------------------------------------
    async function Na__ElevDev__RevertElevation(elevation) {
        if (Na__ElevDev__Busy) return false;
        if (!Na__DrawDraft__IsActive(Na__PlaneUi__TYPE_ELEVATION, elevation.Elevation__Id) || !Na__DrawDraft__IsDirty()) return false;

        const confirmed = await Na__PresentationMode__DevMenu__Confirm({
            title         : 'Revert "' + Na__DrawDraft__ActiveName() + '"?',
            message       : 'This throws away the changes below and puts the elevation back exactly as it was last updated. '
                          + 'Nothing is written - nothing was saved.',
            details       : Na__DrawDraft__Describe(),
            confirmLabel  : 'Revert Elevation',
            cancelLabel   : 'Keep Editing',
            isDestructive : true
        });
        if (!confirmed) return false;

        Na__DrawDraft__Revert();                                                 // <-- The owner's afterRevert re-derives the drawing and rebuilds the panel
        Na__ElevDev__Toast('"' + elevation.Elevation__Name + '" is back as it was last updated.');
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Panel Mutations
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Create One Elevation Record and Its Card (No Save, No Render)
    // ------------------------------------------------------------
    // Named from the way it faces from the start. Until north is set that is
    // the config's "Elevation 3", and the name arrives with north.
    // ------------------------------------------------------------
    function Na__ElevDev__CreateOne(config, options) {
        const elevation = Na__ElevData__CreateElevation(config, options || {});
        if (!elevation) return null;

        Na__ElevName__SetAuto(elevation, true);
        const derived = Na__ElevName__Derive(elevation);
        if (derived !== '') elevation.Elevation__Name = derived;

        Na__ElevLink__CreateSceneForElevation(
            config, elevation, Na__ElevDev__Measure(elevation), Na__ElevDev__Fov()
        );
        return elevation;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What Adding Anything Needs First
    // ------------------------------------------------------------
    // A config to put the card in, a model to measure, and an answer about
    // any changes waiting in the open row - the new drawing becomes the open
    // one. Resolves the config, or null having said why.
    // ------------------------------------------------------------
    async function Na__ElevDev__ReadyToAdd() {
        const config = Na__ElevDev__GetConfig();
        if (!config) {
            Na__ElevDev__Toast('No presentation scene config loaded.', true);
            return null;
        }
        if (!Na__ElevFrame__GetBounds(Na__ElevDev__ModelRoot)) {
            Na__ElevDev__Toast(Na__ElevCfg__GetLabel('NoModelMessage', 'Load a model before adding elevations.'), true);
            return null;
        }
        if (!(await Na__DrawDraft__ConfirmLeave())) return null;                 // <-- Keep Editing: nothing is added
        return config;
    }
    // ------------------------------------------------------------


    // FUNCTION | Add One Elevation, Open It, and Save
    // ------------------------------------------------------------
    // Saved at once, as a new scene is: it has no sheet viewports yet, so
    // there is nothing for it to move, and a drawing that exists only in
    // memory is one reload from never having existed.
    // ------------------------------------------------------------
    async function Na__ElevDev__AddElevation(options) {
        if (Na__ElevDev__Busy) return null;
        const config = await Na__ElevDev__ReadyToAdd();
        if (!config) return null;

        const centred   = Na__ElevDev__BuildingCentreMm(null);                   // <-- On the building, not stranded at the world origin
        const elevation = Na__ElevDev__CreateOne(config, Object.assign(
            centred ? { originXMm : centred.xMm, originZMm : centred.zMm } : {}, options || {}
        ));
        if (!elevation) return null;

        Na__PresentationMode__ProjectJson__BroadcastScenesChanged();             // <-- Or the new card stays invisible all session
        Na__PlaneOverlay__Refresh();
        Na__DrawFold__SetOpenId(elevation.Elevation__Id);                        // <-- The one row you want is the one row open; its draft begins clean
        Na__ElevDev__Render();

        const report = {};
        const saved  = await Na__DrawDraft__SaveBlock(Na__ElevDev__RelayErrors, report);
        if (saved) {
            const where = Na__DrawShell__WhereSaved(report);
            Na__ElevDev__Toast('"' + elevation.Elevation__Name + '" added. ' + where.text + ' Point it with Aim at face.', where.isError);
        }
        return elevation;
    }
    // ------------------------------------------------------------


    // FUNCTION | Create One Elevation Per Side of the Building
    // ------------------------------------------------------------
    // Four elevations of a square-on building is what almost every drawing set
    // needs. They are taken square to the MODEL's axes - that is where the
    // building's faces are, whichever way north lies - and each is NAMED from
    // the project's north, so on a model drawn 90 degrees round the four still
    // come out North, East, South and West on the right walls. Their planes
    // are centred on the building so each is immediately meaningful.
    // ------------------------------------------------------------
    async function Na__ElevDev__SeedFourSides() {
        if (Na__ElevDev__Busy) return 0;

        const existing = Na__ElevData__GetElevations(null).length;
        if (existing > 0) {
            const proceed = await Na__PresentationMode__DevMenu__Confirm({
                title        : 'Add four more elevations?',
                message      : 'This project already has ' + existing + ' elevation' + (existing === 1 ? '' : 's') + '. Seeding adds one for '
                             + 'each side of the building beside them - it replaces nothing - and saves.',
                confirmLabel : 'Add Four',
                cancelLabel  : 'Cancel',
                isCommit     : true
            });
            if (!proceed) return 0;
        }

        const config = await Na__ElevDev__ReadyToAdd();
        if (!config) return 0;

        // The building's centre in X/Z does not depend on which way an elevation
        // faces, so one measurement with no record serves all four.
        const centred = Na__ElevDev__BuildingCentreMm(null);
        if (!centred) {
            Na__ElevDev__Toast(Na__ElevCfg__GetLabel('NoModelMessage', 'Load a model before adding elevations.'), true);
            return 0;
        }

        const presets = Na__ElevCfg__GetDirectionPresets();
        let made = 0;
        for (let i = 0; i < presets.length; i++) {
            if (Na__ElevDev__CreateOne(config, {
                azimuthDeg : presets[i].azimuthDeg,
                originXMm  : centred.xMm,
                originZMm  : centred.zMm
            })) made++;
        }

        Na__PresentationMode__ProjectJson__BroadcastScenesChanged();
        Na__PlaneOverlay__Refresh();
        Na__DrawFold__SetOpenId(null);
        Na__ElevDev__Render();

        const report = {};
        const saved  = await Na__DrawDraft__SaveBlock(Na__ElevDev__RelayErrors, report);
        if (saved) {
            const where = Na__DrawShell__WhereSaved(report);
            Na__ElevDev__Toast('Created ' + made + ' elevation(s) around the building. ' + where.text, where.isError);
        }
        return made;
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete an Elevation, Its Scene and Its Markup
    // ------------------------------------------------------------
    async function Na__ElevDev__DeleteElevation(elevation) {
        if (Na__ElevDev__Busy) return false;
        const config = Na__ElevDev__GetConfig();
        if (!config) return false;

        const scene = Na__ElevData__FindSceneFor(config, elevation);
        const confirmed = await Na__DrawShell__ConfirmDelete({
            word  : 'elevation',
            name  : elevation.Elevation__Name,
            usage : Na__DrawShell__UsageFor(elevation.Elevation__Id, scene ? scene.PresentationMode__Scene__Id : elevation.Elevation__SceneId)
        });
        if (!confirmed) return false;

        if (Na__ElevDev__IsPreviewing(elevation)) {
            Na__ElevationMode__ExitElevation(null);                              // <-- Never leave a deleted drawing on screen
        }
        Na__PlaneGrip__CancelFacePick(Na__PlaneUi__TYPE_ELEVATION);
        Na__DrawFold__CloseIfOpen(elevation.Elevation__Id);                      // <-- Its draft ends with it: there is nothing left to put back

        const orphanedSceneId = Na__ElevData__DeleteElevation(config, elevation.Elevation__Id);
        if (orphanedSceneId) Na__ElevLink__RemoveSceneForElevation(config, orphanedSceneId);
        Na__PlaneOverlay__Forget(Na__PlaneUi__TYPE_ELEVATION, elevation.Elevation__Id);   // <-- After the record has gone, so the refresh finds nothing to keep up

        Na__PresentationMode__ProjectJson__BroadcastScenesChanged();             // <-- Drop the card with the elevation
        Na__ElevDev__Render();

        const report = {};
        const saved  = await Na__DrawDraft__SaveBlock(Na__ElevDev__RelayErrors, report);
        if (saved) {
            const where = Na__DrawShell__WhereSaved(report);
            Na__ElevDev__Toast('"' + elevation.Elevation__Name + '" deleted. ' + where.text, where.isError);
        } else {
            Na__ElevDev__Toast('"' + elevation.Elevation__Name + '" was deleted here but the save FAILED - it is still on R2. '
                + 'Reload to get it back, or save again from any drawing.', true);
        }
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Panel Render
// -----------------------------------------------------------------------------

    // FUNCTION | Rebuild the Whole Elevation Panel
    // ------------------------------------------------------------
    function Na__ElevDev__Render() {
        if (!Na__ElevDev__Panel) return;
        Na__ElevDev__Panel.innerHTML = '';
        Na__ElevDev__RowUi.clear();

        // HEAD | The title, and a + where it takes no scrolling to reach
        Na__ElevDev__Panel.appendChild(Na__DrawShell__BuildPanelHead({
            title    : Na__ElevCfg__GetLabel('SectionTitle', 'Elevations'),
            addTitle : 'Add a new elevation',
            onAdd    : () => { void Na__ElevDev__AddElevation({}); }
        }));

        const elevations = Na__ElevData__GetElevations(null);

        // DRAWING PLANES | Show all, snap and its grid - the same bar the Floor
        // Plans panel carries, because the state behind it is shared.
        const planesBar = (elevations.length > 0) ? Na__PlaneUi__BuildBar() : null;
        if (planesBar) Na__ElevDev__Panel.appendChild(planesBar);

        // ONE ROW OPEN AT A TIME. Everything a row holds goes inside the fold's
        // body, or it would stay visible - and pressable - under a folded header.
        for (let i = 0; i < elevations.length; i++) {
            const elevation = elevations[i];
            const built     = Na__ElevDev__BuildRow(elevation);
            const chips     = Na__DrawShell__BuildHeaderChips();

            const fold = Na__DrawFold__Wrap(built.row, {
                id    : elevation.Elevation__Id,
                title : elevation.Elevation__Name,
                lead  : Na__DrawShell__BuildSwatch(Na__PlaneOverlay__GetColour(Na__PlaneUi__TYPE_ELEVATION, elevation.Elevation__Id)),
                trail : chips.element
            });

            // DELETE | Below a rule, alone, at the very foot of the open row
            fold.body.appendChild(Na__DrawShell__BuildDangerZone({
                label    : Na__ElevCfg__GetLabel('DeleteLabel', 'Delete Elevation'),
                title    : 'Delete this elevation, its card and its markup. Asks first.',
                onDelete : () => { void Na__ElevDev__DeleteElevation(elevation); }
            }));

            Na__ElevDev__RowUi.set(elevation.Elevation__Id, {
                chips           : chips,
                fold            : fold,
                refreshDraft    : built.refreshDraft,
                refreshIdentity : built.refreshIdentity
            });
            Na__ElevDev__Panel.appendChild(built.row);
        }

        const note = document.createElement('p');
        note.className   = 'na-fp-dev__empty';
        note.textContent = (elevations.length === 0)
            ? 'No elevations yet. Seed the four sides, or press + and point the new one with Aim at face.'
            : 'Open one elevation at a time. Its changes show at once - in the preview, on its plane, on the sheets - '
              + 'and are kept only when you press Update.';
        Na__ElevDev__Panel.appendChild(note);

        // FOOT | Making drawings. There is deliberately no Save here.
        const actions = document.createElement('div');
        actions.className = 'na-pm-dev__global-actions';
        actions.appendChild(Na__DrawShell__Button(
            Na__ElevCfg__GetLabel('AddElevationLabel', '+ Add Elevation'), 'na-pm-dev__btn--primary',
            'Add a new elevation, centred on the building', () => { void Na__ElevDev__AddElevation({}); }
        ));
        actions.appendChild(Na__DrawShell__Button(
            Na__ElevCfg__GetLabel('SeedFourSidesLabel', 'Seed N / E / S / W'), '',
            'One elevation for each side of the building, named from the project\'s north',
            () => { void Na__ElevDev__SeedFourSides(); }
        ));
        Na__ElevDev__Panel.appendChild(actions);

        Na__ElevDev__RefreshDraftUi();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Open the Row of the Elevation on Screen, If Nothing Is Waiting
    // ------------------------------------------------------------
    // The panel follows the carousel, as the Presentation Scenes panel does:
    // the row in front of you is the drawing in front of you. Never past a
    // changed row - a passive event does not get to ask about throwing work
    // away, and does not throw it away.
    // ------------------------------------------------------------
    function Na__ElevDev__FollowPreview() {
        if (!Na__ElevationMode__IsActive() || Na__DrawDraft__IsDirty()) return;
        const active = Na__ElevationMode__GetActiveElevation();
        if (active && Na__DrawFold__GetOpenId() !== active.Elevation__Id) Na__DrawFold__SetOpenId(active.Elevation__Id);
    }
    // ------------------------------------------------------------


    // FUNCTION | Initialize the Localhost-Only Elevation Editor
    // ------------------------------------------------------------
    // context: { modelRoot, camera, showToast }
    // Mirrors the Floor Plans section: the wrapper is revealed, the toggle
    // opens the panel, and the panel rebuilds on every open so it can never
    // show data from a previous project.
    // ------------------------------------------------------------
    function Na__Elevation__DevMenu__Initialize(context) {
        const menuItem = document.getElementById(Na__ElevDev__ITEM_ID);
        const toggle   = document.getElementById(Na__ElevDev__TOGGLE_ID);
        const panel    = document.getElementById(Na__ElevDev__PANEL_ID);
        if (!menuItem || !toggle || !panel) return false;                        // <-- Markup absent: nothing to mount into

        Na__ElevDev__Panel       = panel;
        Na__ElevDev__ModelRoot   = (context && context.modelRoot) || null;
        Na__ElevDev__Camera      = (context && context.camera)    || null;
        Na__ElevDev__ShowToast   = (context && context.showToast) || null;
        Na__ElevDev__Initialized = true;

        menuItem.style.display = '';                                             // <-- Reveal alongside the other dev tools
        Na__ElevDev__RegisterPlaneSource();                                      // <-- Elevation planes can now be shown, dragged and picked in the 3D view
        Na__ElevDev__RegisterDraftOwner();                                       // <-- And an open row's edits are held until Update
        void Na__NorthCfg__Load().then(() => { if (Na__ElevDev__IsPanelOpen()) Na__ElevDev__Render(); });   // <-- The compass words a name is written in

        toggle.addEventListener('click', async () => {
            const isOpen = panel.classList.contains('is-open');

            if (isOpen) {
                // CLOSING | A changed elevation is not left behind a closed
                // panel without being asked about. A changed FLOOR PLAN is the
                // other panel's business and is left alone.
                const draft = Na__DrawDraft__GetActive();
                if (draft && draft.type === Na__PlaneUi__TYPE_ELEVATION) {
                    if (!(await Na__DrawDraft__ConfirmLeave())) return;          // <-- Keep Editing: the panel stays open
                    Na__DrawFold__SetOpenId(null);
                }
                panel.classList.remove('is-open');
                toggle.setAttribute('aria-expanded', 'false');

                // Authoring is done. The plane that was only up because its row
                // was being edited goes; planes SWITCHED ON stay, which is the
                // point of switching them on.
                Na__PlaneGrip__CancelFacePick(Na__PlaneUi__TYPE_ELEVATION);
                Na__PlaneOverlay__DeselectType(Na__PlaneUi__TYPE_ELEVATION);
                return;
            }

            panel.classList.add('is-open');
            toggle.setAttribute('aria-expanded', 'true');
            Na__ElevDev__FollowPreview();                                        // <-- What is on screen is what is unfolded
            Na__ElevDev__Render();                                               // <-- Rebuild on each open so data is fresh
        });

        // Preview and Annotate button states are derived from mode, so the
        // panel refreshes whenever the controller reports a change.
        window.addEventListener(Na__ElevMode__CHANGED_EVENT, () => {
            if (!Na__ElevDev__IsPanelOpen()) return;
            Na__ElevDev__FollowPreview();
            Na__ElevDev__Render();
        });

        // A project switch during the same session replaces the scene config
        // and the drawings block; a save elsewhere may have changed a card.
        window.addEventListener('na-presentation-mode-scenes-loaded', () => {
            if (Na__ElevDev__IsPanelOpen()) Na__ElevDev__Render();
        });
        window.addEventListener(Na__DrawData__CHANGED_EVENT, (event) => {
            if (Na__ElevDev__IsPanelOpen() && event.detail && event.detail.reason === 'loaded') Na__ElevDev__Render();
        });

        // Which elevation each row IS depends on north. The open row's
        // automatic name follows it, as a change to be updated like any other.
        window.addEventListener(Na__NorthData__CHANGED_EVENT, () => {
            const draft = Na__DrawDraft__GetActive();
            if (draft && draft.type === Na__PlaneUi__TYPE_ELEVATION && Na__ElevName__Sync(draft.record)) Na__PlaneOverlay__Refresh();
            if (Na__ElevDev__IsPanelOpen()) Na__ElevDev__Render();
        });

        // A draft begun, ended, reverted or kept - from either panel, or from
        // a plane dragged in the 3D view - changes what the chips and the
        // buttons should say.
        window.addEventListener(Na__DrawDraft__CHANGED_EVENT, () => {
            if (Na__ElevDev__IsPanelOpen()) Na__ElevDev__RefreshDraftUi();
        });

        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Point the Editor at a Different Model Root
    // ------------------------------------------------------------
    function Na__Elevation__DevMenu__SetModelRoot(modelRoot) {
        Na__ElevDev__ModelRoot = modelRoot || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Force a Panel Refresh
    // ------------------------------------------------------------
    function Na__Elevation__DevMenu__Refresh() {
        if (Na__ElevDev__Initialized) Na__ElevDev__Render();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Elevation Dev Menu Editor API
    // ------------------------------------------------------------
    export {
        Na__Elevation__DevMenu__Initialize,
        Na__Elevation__DevMenu__SetModelRoot,
        Na__Elevation__DevMenu__Refresh
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
