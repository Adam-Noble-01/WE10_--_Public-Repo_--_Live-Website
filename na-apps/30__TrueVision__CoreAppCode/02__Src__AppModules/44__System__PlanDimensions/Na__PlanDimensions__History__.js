// =============================================================================
// TRUEVISION3D - PLAN DIMENSIONS - UNDO AND REDO HISTORY
// =============================================================================
//
// FILE       : Na__PlanDimensions__History__.js
// NAMESPACE  : Na__PlanDimHist
// MODULE     : Plan Dimensions - Undo and Redo History
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Undo and redo over one floor plan dimension array
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - A named wrapper around ONE instance of the shared snapshot history factory,
//   the same one the annotation system uses. Undo behaves identically in both
//   because there is only one implementation of it.
// - The instance is private to this module. Sharing a stack with annotations
//   would let Ctrl+Z while dimensioning undo a room name typed minutes earlier,
//   which is never what the author means.
// - Every dimension mutation is bracketed by this: placing, deleting, dragging
//   an offset, and dragging a vertex all become exactly one undoable step.
//
// INTEGRATION:
// - Na__PlanDimensions__Editor__ and __VertexEditor__ bracket their mutations.
// - Na__PlanDimensions__Hotkeys__ drives Undo and Redo.
// - Na__FloorPlan__ModeController__ calls Begin when a plan is mounted.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 31-Aug-2026 - Version 1.0.0
// - Initial implementation for the dimension editing controls.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Shared History Factory and Dimension Config
    // ------------------------------------------------------------
    // @delegate: ../03__AppUtils/Na__AppUtils__SnapshotHistory.js
    // ------------------------------------------------------------
    import { Na__SnapHist__Create } from '../03__AppUtils/Na__AppUtils__SnapshotHistory.js';
    import { Na__PlanDim__GetEditingSetup } from './Na__PlanDimensions__Data__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Dimension History Instance
    // ------------------------------------------------------------
    const Na__PlanDimHist__Instance = Na__SnapHist__Create({
        getDepth : () => Na__PlanDim__GetEditingSetup().undoDepth
    });
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Bind to a Plan's Dimension Array and Clear History
    // ------------------------------------------------------------
    function Na__PlanDimHist__Begin(dimensionArray) {
        return Na__PlanDimHist__Instance.begin(dimensionArray);
    }
    // ------------------------------------------------------------


    // FUNCTION | Unbind Entirely (plan unmounted)
    // ------------------------------------------------------------
    function Na__PlanDimHist__End() {
        Na__PlanDimHist__Instance.end();
    }
    // ------------------------------------------------------------


    // FUNCTION | Drop All History Without Unbinding
    // ------------------------------------------------------------
    function Na__PlanDimHist__Clear() {
        Na__PlanDimHist__Instance.clear();
    }
    // ------------------------------------------------------------


    // FUNCTION | Take a Baseline Before a Time-Spanning Edit
    // ------------------------------------------------------------
    // Used by offset drags and vertex drags, which fire many move events but
    // must collapse into one undo step.
    // ------------------------------------------------------------
    function Na__PlanDimHist__BeginPending() {
        return Na__PlanDimHist__Instance.beginPending();
    }
    // ------------------------------------------------------------


    // FUNCTION | Commit the Pending Baseline Onto the Undo Stack
    // ------------------------------------------------------------
    function Na__PlanDimHist__CommitPending() {
        return Na__PlanDimHist__Instance.commitPending();
    }
    // ------------------------------------------------------------


    // FUNCTION | Abandon the Pending Baseline
    // ------------------------------------------------------------
    function Na__PlanDimHist__DiscardPending() {
        return Na__PlanDimHist__Instance.discardPending();
    }
    // ------------------------------------------------------------


    // FUNCTION | Record an Atomic Edit (call BEFORE the mutation)
    // ------------------------------------------------------------
    function Na__PlanDimHist__CaptureNow() {
        return Na__PlanDimHist__Instance.captureNow();
    }
    // ------------------------------------------------------------


    // FUNCTION | Step Back One Edit
    // ------------------------------------------------------------
    function Na__PlanDimHist__Undo__Step() {
        return Na__PlanDimHist__Instance.undo();
    }
    // ------------------------------------------------------------


    // FUNCTION | Step Forward One Edit
    // ------------------------------------------------------------
    function Na__PlanDimHist__Redo__Step() {
        return Na__PlanDimHist__Instance.redo();
    }
    // ------------------------------------------------------------


    // FUNCTION | Is There Anything to Undo?
    // ------------------------------------------------------------
    function Na__PlanDimHist__CanUndo() {
        return Na__PlanDimHist__Instance.canUndo();
    }
    // ------------------------------------------------------------


    // FUNCTION | Is There Anything to Redo?
    // ------------------------------------------------------------
    function Na__PlanDimHist__CanRedo() {
        return Na__PlanDimHist__Instance.canRedo();
    }
    // ------------------------------------------------------------


    // FUNCTION | Current Stack Depths (dev / debug)
    // ------------------------------------------------------------
    function Na__PlanDimHist__GetDepths() {
        return Na__PlanDimHist__Instance.getDepths();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Plan Dimension History API
    // ------------------------------------------------------------
    export {
        Na__PlanDimHist__Begin,
        Na__PlanDimHist__End,
        Na__PlanDimHist__Clear,
        Na__PlanDimHist__BeginPending,
        Na__PlanDimHist__CommitPending,
        Na__PlanDimHist__DiscardPending,
        Na__PlanDimHist__CaptureNow,
        Na__PlanDimHist__Undo__Step,
        Na__PlanDimHist__Redo__Step,
        Na__PlanDimHist__CanUndo,
        Na__PlanDimHist__CanRedo,
        Na__PlanDimHist__GetDepths
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
