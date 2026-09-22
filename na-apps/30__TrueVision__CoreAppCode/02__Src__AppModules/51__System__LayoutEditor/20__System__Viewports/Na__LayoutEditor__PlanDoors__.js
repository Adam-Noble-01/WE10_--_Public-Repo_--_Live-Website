// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PLAN DOORS
// =============================================================================
//
// FILE       : Na__LayoutEditor__PlanDoors__.js
// NAMESPACE  : Na__LeDoors
// MODULE     : Layout Editor - Plan Doors
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Draw a plan viewport's doors open, and close or open one with a click
// CREATED    : 14-Sep-2026
//
// DESCRIPTION:
// - Every door on a 2D plan viewport is drawn OPEN, whatever the 3D view shows,
//   with the swing arc of each open hinged leaf. Every door on an elevation or
//   section viewport is drawn SHUT, whatever the 3D view shows, and is not
//   there to be clicked. 3D viewports draw the doors as the model holds them.
// - A click on a door in the selected plan viewport closes it, and another
//   click opens it again. The right-click menu offers the same, plus Open all
//   doors. Each is one undo step: a content edit, kept by the browser draft
//   and by Save Sheets, never an auto save.
// - A lock holds a viewport's frame, not what it draws: the doors of a locked
//   plan still close and open, by click, menu or panel, as its layers and
//   styles still change.
// - THE RECORD. Viewport__ClosedDoors lists the doors the viewport draws shut,
//   by door key: the ADR name, or ADR::MOD for one leaf of an exterior double
//   door, whose leaves open one at a time just as a click in the 3D view opens
//   them. The key is absent while every door is open. An elevation or section
//   ignores it: every one of its doors is shut.
// - The pose rides on the view definition (Na__LeVp2d__Describe), so it keys
//   the linework, the base image and the PDF like any other drawing setting.
//   Na__ProjectedLinework__DoorPose__ poses the doors, traces the swings and
//   finds the door under a click.
// - HIDE SWINGS. A plan viewport can leave every door swing off: the arcs
//   traced from its open doors (the pose's Swings) and the SketchUp door swing
//   linework (PlanDoors SwingCategoryKeys), in its linework, its base image and
//   the PDF. The doors still draw open and still close with a click. Off by
//   default, but ON for a plan of a storey in HideSwingsOnStoreys - a roof
//   plan looks down on the top storey's doors through the roof, and their
//   swings were drawn over it. Viewport__HideSwings holds a tick or untick
//   once somebody makes one; absent, the plan's storey decides, so a roof
//   plan's viewport starts with its swings hidden and never had to be told.
//
// INTEGRATION:
// - Na__LayoutEditor__Viewport2d__ (PoseFor, ShutPoseFor, SwingExcludeTokens,
//   RasterLayers), Na__LayoutEditor__SheetTools__ (At, ToggleSoon,
//   CancelPending, MenuItems), and the Viewport panel (IsPlan, ClosedCount,
//   OpenAll, SwingsHidden, SwingsHiddenByDefault, SetSwingsHidden).
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : n/a - authored in TrueVision3D
// - Back-port     : PENDING to ValeVision3D, on Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.3.0 (TrueVision)
// - Hide swings (Viewport__HideSwings). SwingsHidden answers the tick, or the
//   plan's storey when nobody has ticked (a roof plan: hidden); PoseFor turns
//   the traced arcs off with it; SwingExcludeTokens and RasterLayers take the
//   SketchUp door swing linework out of the vectors and the base image;
//   SetSwingsHidden is the panel's one undo step.
//
// 21-Sep-2026 - Version 1.2.0 (TrueVision)
// - At works on a turned plan (Viewport__RotationDeg): the click is tested
//   against the turned frame, and the window's FromPaper undoes the turn.
//
// 14-Sep-2026 - Version 1.1.0
// - Elevations and sections draw every door shut (ShutPoseFor), whatever the
//   3D view shows: only a plan draws a door open. ShutOnElevations switches it
//   off. At answers only on a plan.
//
// 14-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Sheet Model, Model Roots
    // ------------------------------------------------------------
    import { Na__LeCfg__GetPlanDoorsSetup, Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__KIND_2D,
        Na__LeModel__GetActiveSheet,
        Na__LeModel__GetViewportById,
        Na__LeModel__UpdateViewport,
        Na__LeModel__ResolveViewportSource
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSnap__GetModelRoot } from '../25__System__RenderStyles/Na__LayoutEditor__SnapshotRenderer__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Floor Plans (which storey a plan is a plan of)
    // ------------------------------------------------------------
    import { Na__FpData__GetStoreyLevel } from '../../42__System__FloorPlanViews/Na__FloorPlan__ProjectJson__Data__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Projected Linework (the door pose and the page scale)
    // ------------------------------------------------------------
    import { Na__PlDoors__HitTest } from '../../50__System__ProjectedLinework/Na__ProjectedLinework__DoorPose__.js';
    import { Na__PlProjector__SCALE_DIVISOR } from '../../50__System__ProjectedLinework/Na__ProjectedLinework__Projector__.js';
    import { Na__LeVpRot__Contains } from './Na__LayoutEditor__ViewportRotation__.js';   // <-- A leaf: inside a turned frame
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Record Keys
    // ------------------------------------------------------------
    const Na__LeDoors__FIELD        = 'Viewport__ClosedDoors';
    const Na__LeDoors__SWINGS_FIELD = 'Viewport__HideSwings';     // <-- true or false once ticked or unticked; absent, the plan's storey decides
    // ------------------------------------------------------------

    // MODULE VARIABLES | Clicks Waiting Out the Double Click Window
    // ------------------------------------------------------------
    const Na__LeDoors__Pending = new Set();
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading the Record
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Door Keys a Viewport Draws Shut
    // ------------------------------------------------------------
    function Na__LeDoors__ClosedKeys(viewport) {
        const keys = viewport ? viewport[Na__LeDoors__FIELD] : null;
        return Array.isArray(keys) ? keys.slice() : [];
    }
    function Na__LeDoors__ClosedCount(viewport) {
        return Na__LeDoors__ClosedKeys(viewport).length;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Whether a Door, or One Leaf of It, Is Drawn Shut Now
    // ------------------------------------------------------------
    function Na__LeDoors__IsShut(keys, hit) {
        return keys.indexOf(hit.Key) !== -1 || (hit.Independent === true && keys.indexOf(hit.AdrName) !== -1);
    }
    // ------------------------------------------------------------


    // FUNCTION | Whether a Viewport Is a 2D Plan That Draws Its Doors Open
    // ------------------------------------------------------------
    function Na__LeDoors__IsPlan(viewport) {
        if (!viewport || viewport.Viewport__Kind !== Na__LeModel__KIND_2D) return false;
        if (!Na__LeCfg__GetPlanDoorsSetup().openOnPlans) return false;
        return !!Na__LeModel__ResolveViewportSource(viewport).plan;
    }
    // ------------------------------------------------------------


    // FUNCTION | Whether a Click on a Door Closes or Opens It
    // ------------------------------------------------------------
    // ClickToToggle. The right-click rows and Open all work either way.
    // ------------------------------------------------------------
    function Na__LeDoors__ClickToggles() {
        return Na__LeCfg__GetPlanDoorsSetup().clickToToggle;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Door Pose a Plan Viewport Draws With
    // ------------------------------------------------------------
    // Asked for once the source is known to be a plan. Null while the feature
    // is switched off, which draws the doors as the model holds them. plan is
    // the viewport's plan record when the caller already holds it.
    // ------------------------------------------------------------
    function Na__LeDoors__PoseFor(viewport, plan) {
        const setup = Na__LeCfg__GetPlanDoorsSetup();
        if (!viewport || !setup.openOnPlans) return null;
        return {
            Closed           : Na__LeDoors__ClosedKeys(viewport),
            Swings           : setup.drawSwings && !Na__LeDoors__SwingsHidden(viewport, plan),   // <-- Hide swings: no arc is traced, and the pose's hash keys the drawing afresh
            SwingStepDegrees : setup.swingStepDegrees
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Door Pose an Elevation or Section Viewport Draws With
    // ------------------------------------------------------------
    // Asked for once the source is known to be an elevation or a section: every
    // door shut, whatever the 3D view shows, because only a plan draws a door
    // open. Null while ShutOnElevations is off, which draws the doors as the
    // model holds them.
    // ------------------------------------------------------------
    function Na__LeDoors__ShutPoseFor(viewport) {
        if (!viewport || !Na__LeCfg__GetPlanDoorsSetup().shutOnElevations) return null;
        return { Shut : true };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Hide Swings
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Plan a Viewport Draws, or Null
    // ------------------------------------------------------------
    // plan, when given, is taken as the answer: Describe has already resolved
    // it, and the panel refresh asks several questions in a row.
    // ------------------------------------------------------------
    function Na__LeDoors__PlanOf(viewport, plan) {
        if (plan !== undefined) return plan || null;
        if (!viewport || viewport.Viewport__Kind !== Na__LeModel__KIND_2D) return null;
        return Na__LeModel__ResolveViewportSource(viewport).plan || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Whether a Plan Hides Its Swings When Nobody Has Said
    // ------------------------------------------------------------
    // By the plan's storey (Na__FpData__GetStoreyLevel: the one picked in the
    // Dev menu, else a guess from the plan's name and then its cut height)
    // against PlanDoors HideSwingsOnStoreys - a roof plan, as shipped. A roof
    // plan's cut stands above the top storey, so that storey's doors are drawn
    // open, and their swings joined the drawing over the roof.
    // ------------------------------------------------------------
    function Na__LeDoors__SwingsHiddenByDefault(viewport, plan) {
        const record = Na__LeDoors__PlanOf(viewport, plan);
        if (!record) return false;
        const storey = Na__FpData__GetStoreyLevel(record);
        return !!storey && Na__LeCfg__GetPlanDoorsSetup().hideSwingsOnStoreys.indexOf(storey.key) !== -1;
    }
    // ------------------------------------------------------------


    // FUNCTION | Whether a Plan Viewport Leaves Its Door Swings Off
    // ------------------------------------------------------------
    // A tick or an untick, once somebody has made one, stands; until then the
    // plan's storey decides. Never written for the default, so the default
    // follows the plan - a plan renamed or re-storeyed as a roof plan hides
    // its swings from then on, and one that stops being one draws them again.
    // ------------------------------------------------------------
    function Na__LeDoors__SwingsHidden(viewport, plan) {
        if (!viewport) return false;
        const stored = viewport[Na__LeDoors__SWINGS_FIELD];
        return (typeof stored === 'boolean') ? stored : Na__LeDoors__SwingsHiddenByDefault(viewport, plan);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Whether a Viewport Is a Plan Drawn Without Its Swings
    // ------------------------------------------------------------
    // Only a plan that draws its doors open has swings to hide (IsPlan's two
    // tests), so a stored tick left on a viewport since moved to an elevation
    // or a 3D scene does nothing there.
    // ------------------------------------------------------------
    function Na__LeDoors__PlanHidesSwings(viewport, plan) {
        if (!viewport || !Na__LeCfg__GetPlanDoorsSetup().openOnPlans) return false;
        const record = Na__LeDoors__PlanOf(viewport, plan);
        return !!record && Na__LeDoors__SwingsHidden(viewport, record);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Exclusion Tokens That Take the Drawn Swings Off a Plan
    // ------------------------------------------------------------
    // The SketchUp door swing linework (PlanDoors SwingCategoryKeys) is its own
    // model category, drawn as authored and never clipped, so the traced arcs
    // going would leave it standing. '=' asks the projection for the whole
    // name: nothing else is taken with it. Empty on a plan that draws its
    // swings, so its definition, its hash and its caches are what they were.
    // ------------------------------------------------------------
    function Na__LeDoors__SwingExcludeTokens(viewport, plan) {
        if (!Na__LeDoors__PlanHidesSwings(viewport, plan)) return [];
        return Na__LeCfg__GetPlanDoorsSetup().swingCategoryKeys.map((key) => '=' + key);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Model Layers a Plan's Base Image Is Drawn With
    // ------------------------------------------------------------
    // Viewport__ModelLayers as it stands, plus the door swing linework switched
    // off while the viewport hides its swings - the picture under the vectors
    // drops them too, or they would show there after leaving the linework. The
    // viewport's own map, untouched, whenever there is nothing to add.
    // ------------------------------------------------------------
    function Na__LeDoors__RasterLayers(viewport) {
        const stored = viewport ? (viewport.Viewport__ModelLayers || null) : null;
        if (!Na__LeDoors__PlanHidesSwings(viewport)) return stored;
        const keys = Na__LeCfg__GetPlanDoorsSetup().swingCategoryKeys;
        if (keys.length === 0) return stored;
        const merged = Object.assign({}, stored || {});
        keys.forEach((key) => { merged[key] = false; });
        return merged;
    }
    // ------------------------------------------------------------


    // FUNCTION | Hide or Draw a Plan Viewport's Swings (one undo step)
    // ------------------------------------------------------------
    // Stores the choice either way, so a roof plan's untick stays unticked.
    // Nothing is written when the viewport already draws them that way.
    // ------------------------------------------------------------
    function Na__LeDoors__SetSwingsHidden(sheet, viewportId, hidden) {
        const viewport = sheet ? Na__LeModel__GetViewportById(sheet, viewportId) : null;
        if (!viewport || !Na__LeDoors__IsPlan(viewport)) return false;
        const want = hidden === true;
        if (Na__LeDoors__SwingsHidden(viewport) === want) return false;
        return Na__LeModel__UpdateViewport(sheet, viewportId, { hideSwings : want });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Finding and Toggling a Door
// -----------------------------------------------------------------------------

    // FUNCTION | The Door Under a Point on the Paper, or Null
    // ------------------------------------------------------------
    // described is Na__LeVp2d__Describe(viewport); pointMm and toleranceMm are
    // paper millimetres. Only a plan answers, and only inside its frame: what
    // the crop hides cannot be clicked. An elevation's doors are shut and stay
    // shut, so it never answers.
    // ------------------------------------------------------------
    function Na__LeDoors__At(viewport, described, pointMm, toleranceMm) {
        if (!viewport || !pointMm || !described || !described.definition || !described.definition.DoorPose) return null;
        if (!described.source || !described.source.plan) return null;             // <-- An elevation or section: every door shut, none to click
        if (!Na__LeVpRot__Contains(viewport, pointMm, 0)) return null;           // <-- The frame as it stands, turned or not; FromPaper below undoes the turn
        const root = Na__LeSnap__GetModelRoot(described.modelSource ? described.modelSource.renderId : null);
        if (!root) return null;                                                   // <-- Its design phase is not loaded: nothing is drawn to click
        const win     = described.window;
        const drawing = win.FromPaper(pointMm.x, pointMm.y);
        return Na__PlDoors__HitTest(root, described.definition, drawing, Math.max(0, Number(toleranceMm) || 0) * win.Denominator, Na__PlProjector__SCALE_DIVISOR);
    }
    // ------------------------------------------------------------


    // FUNCTION | Close an Open Door, or Open a Shut One (one undo step)
    // ------------------------------------------------------------
    // Read against the record as it stands now, not as it stood when the door
    // was found. Opening one leaf of a pair shut as a whole keeps the other shut.
    // ------------------------------------------------------------
    function Na__LeDoors__Toggle(sheet, viewportId, hit) {
        const viewport = (sheet && hit) ? Na__LeModel__GetViewportById(sheet, viewportId) : null;
        if (!viewport) return false;
        const keys = Na__LeDoors__ClosedKeys(viewport);
        const next = new Set(keys);
        if (Na__LeDoors__IsShut(keys, hit)) {
            next.delete(hit.Key);
            if (hit.Independent === true && next.has(hit.AdrName)) {
                next.delete(hit.AdrName);
                (hit.PanelKeys || []).forEach((key) => { if (key !== hit.Key) next.add(key); });
            }
        } else {
            next.add(hit.Key);
        }
        return Na__LeModel__UpdateViewport(sheet, viewportId, { closedDoors : Array.from(next) });
    }
    // ------------------------------------------------------------


    // FUNCTION | Toggle Once the Double Click Window Has Passed
    // ------------------------------------------------------------
    // A double click on a plan enters its content, and its two clicks must not
    // shut and reopen the door under them. Each click waits ClickDelayMs; a
    // double click cancels whatever is still waiting (CancelPending).
    // ------------------------------------------------------------
    function Na__LeDoors__ToggleSoon(sheet, viewportId, hit) {
        const delay = Na__LeCfg__GetPlanDoorsSetup().clickDelayMs;
        if (!(delay > 0)) { Na__LeDoors__Toggle(sheet, viewportId, hit); return; }
        const timer = window.setTimeout(() => {
            Na__LeDoors__Pending.delete(timer);
            if (Na__LeModel__GetActiveSheet() === sheet) Na__LeDoors__Toggle(sheet, viewportId, hit);   // <-- A sheet left meanwhile keeps its doors
        }, delay);
        Na__LeDoors__Pending.add(timer);
    }
    function Na__LeDoors__CancelPending() {
        Na__LeDoors__Pending.forEach((timer) => window.clearTimeout(timer));
        Na__LeDoors__Pending.clear();
    }
    // ------------------------------------------------------------


    // FUNCTION | Open Every Door a Viewport Shut (one undo step)
    // ------------------------------------------------------------
    function Na__LeDoors__OpenAll(sheet, viewportId) {
        const viewport = sheet ? Na__LeModel__GetViewportById(sheet, viewportId) : null;
        if (!viewport || Na__LeDoors__ClosedCount(viewport) === 0) return false;
        return Na__LeModel__UpdateViewport(sheet, viewportId, { closedDoors : [] });
    }
    // ------------------------------------------------------------


    // FUNCTION | The Right-Click Rows a Plan Viewport Adds
    // ------------------------------------------------------------
    // Close door or Open door for the door under the click, and Open all doors
    // while any is shut, then a rule. Nothing at all off a plan. A locked
    // viewport offers them too: the lock holds its frame, not its doors.
    // ------------------------------------------------------------
    function Na__LeDoors__MenuItems(sheet, viewport, described, pointMm, toleranceMm) {
        if (!Na__LeDoors__IsPlan(viewport)) return [];
        const rows = [];
        const id   = viewport.Viewport__Id;
        const hit  = Na__LeDoors__At(viewport, described, pointMm, toleranceMm);
        if (hit) {
            const shut = Na__LeDoors__IsShut(Na__LeDoors__ClosedKeys(viewport), hit);
            rows.push({ label : shut ? Na__LeCfg__GetLabel('MenuOpenDoor', 'Open door') : Na__LeCfg__GetLabel('MenuCloseDoor', 'Close door'),
                        onSelect : () => Na__LeDoors__Toggle(sheet, id, hit) });
        }
        const count = Na__LeDoors__ClosedCount(viewport);
        if (count > 0) {
            rows.push({ label : Na__LeCfg__FormatLabel('MenuOpenAllDoors', 'Open all doors ({count} closed)', { count : count }),
                        onSelect : () => Na__LeDoors__OpenAll(sheet, id) });
        }
        if (rows.length > 0) rows.push({ separator : true });
        return rows;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Plan Doors API
    // ------------------------------------------------------------
    export {
        Na__LeDoors__FIELD,
        Na__LeDoors__SWINGS_FIELD,
        Na__LeDoors__IsPlan,
        Na__LeDoors__ClickToggles,
        Na__LeDoors__PoseFor,
        Na__LeDoors__ShutPoseFor,
        Na__LeDoors__SwingsHiddenByDefault,
        Na__LeDoors__SwingsHidden,
        Na__LeDoors__SwingExcludeTokens,
        Na__LeDoors__RasterLayers,
        Na__LeDoors__SetSwingsHidden,
        Na__LeDoors__ClosedCount,
        Na__LeDoors__At,
        Na__LeDoors__Toggle,
        Na__LeDoors__ToggleSoon,
        Na__LeDoors__CancelPending,
        Na__LeDoors__OpenAll,
        Na__LeDoors__MenuItems
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
