// =============================================================================
// TRUEVISION3D - PLAN ANNOTATIONS - UNDO AND REDO HISTORY
// =============================================================================
//
// FILE       : Na__PlanAnnotations__History__.js
// NAMESPACE  : Na__PlanAnnoHist
// MODULE     : Plan Annotations - Undo and Redo History
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Undo and redo over one floor plan annotation array
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - A named wrapper around ONE instance of the shared snapshot history factory.
//   The mechanics - in-place restore, the pending pattern, depth trimming - all
//   live in Na__AppUtils__SnapshotHistory so annotations and dimensions can
//   never drift into answering Ctrl+Z differently.
// - The instance is private to this module, so the dimension system's own
//   history is entirely separate. Sharing one stack would let Ctrl+Z while
//   editing text undo a dimension edit made minutes earlier.
// - Depth comes from the annotation AppConfig, passed in as a getter so the
//   utility never reaches into a config it does not own.
//
// INTEGRATION:
// - Na__PlanAnnotations__Editor__ brackets its mutations with Begin/Commit.
// - Na__PlanAnnotations__Hotkeys__ drives Undo and Redo.
// - Na__FloorPlan__ModeController__ calls Begin when a plan is mounted.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 31-Aug-2026 - Version 1.1.0
// - Mechanics extracted to Na__AppUtils__SnapshotHistory so the dimension
//   system can share them. Public API is unchanged.
//
// 31-Aug-2026 - Version 1.0.0
// - Initial implementation for the annotation hotkeys.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Shared History Factory and Annotation Config
    // ------------------------------------------------------------
    // @delegate: ../03__AppUtils/Na__AppUtils__SnapshotHistory.js
    // ------------------------------------------------------------
    import { Na__SnapHist__Create } from '../03__AppUtils/Na__AppUtils__SnapshotHistory.js';
    import { Na__PlanAnno__GetHotkeySetup } from './Na__PlanAnnotations__Data__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Annotation History Instance
    // ------------------------------------------------------------
    // Private and single. Dimensions create their own instance, so the two
    // stacks are entirely independent.
    // ------------------------------------------------------------
    const Na__PlanAnnoHist__Instance = Na__SnapHist__Create({
        getDepth : () => Na__PlanAnno__GetHotkeySetup().undoDepth
    });
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Bind to a Plan's Annotation Array and Clear History
    // ------------------------------------------------------------
    function Na__PlanAnnoHist__Begin(annotationArray) {
        return Na__PlanAnnoHist__Instance.begin(annotationArray);
    }
    // ------------------------------------------------------------


    // FUNCTION | Unbind Entirely (plan unmounted)
    // ------------------------------------------------------------
    function Na__PlanAnnoHist__End() {
        Na__PlanAnnoHist__Instance.end();
    }
    // ------------------------------------------------------------


    // FUNCTION | Drop All History Without Unbinding
    // ------------------------------------------------------------
    function Na__PlanAnnoHist__Clear() {
        Na__PlanAnnoHist__Instance.clear();
    }
    // ------------------------------------------------------------


    // FUNCTION | Take a Baseline Before a Time-Spanning Edit
    // ------------------------------------------------------------
    function Na__PlanAnnoHist__BeginPending() {
        return Na__PlanAnnoHist__Instance.beginPending();
    }
    // ------------------------------------------------------------


    // FUNCTION | Commit the Pending Baseline Onto the Undo Stack
    // ------------------------------------------------------------
    function Na__PlanAnnoHist__CommitPending() {
        return Na__PlanAnnoHist__Instance.commitPending();
    }
    // ------------------------------------------------------------


    // FUNCTION | Abandon the Pending Baseline
    // ------------------------------------------------------------
    function Na__PlanAnnoHist__DiscardPending() {
        return Na__PlanAnnoHist__Instance.discardPending();
    }
    // ------------------------------------------------------------


    // FUNCTION | Record an Atomic Edit (call BEFORE the mutation)
    // ------------------------------------------------------------
    function Na__PlanAnnoHist__CaptureNow() {
        return Na__PlanAnnoHist__Instance.captureNow();
    }
    // ------------------------------------------------------------


    // FUNCTION | Step Back One Edit
    // ------------------------------------------------------------
    function Na__PlanAnnoHist__Undo__Step() {
        return Na__PlanAnnoHist__Instance.undo();
    }
    // ------------------------------------------------------------


    // FUNCTION | Step Forward One Edit
    // ------------------------------------------------------------
    function Na__PlanAnnoHist__Redo__Step() {
        return Na__PlanAnnoHist__Instance.redo();
    }
    // ------------------------------------------------------------


    // FUNCTION | Is There Anything to Undo?
    // ------------------------------------------------------------
    function Na__PlanAnnoHist__CanUndo() {
        return Na__PlanAnnoHist__Instance.canUndo();
    }
    // ------------------------------------------------------------


    // FUNCTION | Is There Anything to Redo?
    // ------------------------------------------------------------
    function Na__PlanAnnoHist__CanRedo() {
        return Na__PlanAnnoHist__Instance.canRedo();
    }
    // ------------------------------------------------------------


    // FUNCTION | Current Stack Depths (dev / debug)
    // ------------------------------------------------------------
    function Na__PlanAnnoHist__GetDepths() {
        return Na__PlanAnnoHist__Instance.getDepths();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Plan Annotation History API
    // ------------------------------------------------------------
    export {
        Na__PlanAnnoHist__Begin,
        Na__PlanAnnoHist__End,
        Na__PlanAnnoHist__Clear,
        Na__PlanAnnoHist__BeginPending,
        Na__PlanAnnoHist__CommitPending,
        Na__PlanAnnoHist__DiscardPending,
        Na__PlanAnnoHist__CaptureNow,
        Na__PlanAnnoHist__Undo__Step,
        Na__PlanAnnoHist__Redo__Step,
        Na__PlanAnnoHist__CanUndo,
        Na__PlanAnnoHist__CanRedo,
        Na__PlanAnnoHist__GetDepths
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
