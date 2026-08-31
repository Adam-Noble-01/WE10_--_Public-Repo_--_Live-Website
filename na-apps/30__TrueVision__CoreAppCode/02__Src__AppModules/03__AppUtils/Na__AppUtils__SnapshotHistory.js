// =============================================================================
// TRUEVISION3D - APP UTILS - SNAPSHOT HISTORY FACTORY
// =============================================================================
//
// FILE       : Na__AppUtils__SnapshotHistory.js
// NAMESPACE  : Na__SnapHist
// MODULE     : App Utils - Snapshot History Factory
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Reusable undo and redo over an array of flat records
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - Plan annotations and plan dimensions both need the same undo behaviour over the
//   same shape of data: a modest array of flat records hanging off a floor plan.
//   This factory is that behaviour, once, so the two can never drift into
//   answering Ctrl+Z differently.
// - Snapshot based rather than command based. The arrays are small, so
//   deep-copying one per edit costs nothing and removes an entire class of bug:
//   there is no inverse operation to get wrong.
// - THE BOUND ARRAY IS MUTATED IN PLACE, NEVER REPLACED. Callers hold live
//   references to it - an overlay, and the plan record that gets saved to R2.
//   Assigning a fresh array on undo would leave those pointing at a stale copy
//   and the next save would quietly write the pre-undo state.
// - Edits that span time - a drag, a text edit, dragging a number field - use
//   the PENDING pattern: a baseline is taken when the interaction starts and is
//   committed only if something actually changed, so opening an editor and
//   pressing Escape leaves no history entry behind.
// - Each call to Create() returns an INDEPENDENT instance. Two systems sharing
//   one stack would let Ctrl+Z in one undo an edit made in the other.
//
// INTEGRATION:
// - Na__PlanAnnotations__History__ and Na__PlanDimensions__History__ are thin
//   named wrappers around one instance each.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 31-Aug-2026 - Version 1.0.0
// - Extracted from Na__PlanAnnotations__History__ so the dimension system can
//   share one implementation rather than carry a near-identical copy.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Default Stack Depth
    // ------------------------------------------------------------
    const Na__SnapHist__DEFAULT_DEPTH = 50;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Factory
// -----------------------------------------------------------------------------

    // FUNCTION | Create One Independent Snapshot History Instance
    // ------------------------------------------------------------
    // options: { getDepth } - a function returning the maximum undo depth, so
    // the owning system can drive it from its own AppConfig rather than this
    // utility reaching into a config it does not own.
    // ------------------------------------------------------------
    function Na__SnapHist__Create(options) {
        const getDepth = (options && typeof options.getDepth === 'function')
            ? options.getDepth
            : () => Na__SnapHist__DEFAULT_DEPTH;

        let boundArray = null;   // <-- LIVE array of the mounted plan
        let pending    = null;   // <-- Baseline for a time-spanning interaction
        const undoStack = [];
        const redoStack = [];


        // SUB FUNCTION | Deep Copy the Bound Array
        // ------------------------------------------------------------
        // Records are flat objects of primitives, so a per-field copy is both
        // sufficient and faster than a JSON round trip.
        // ------------------------------------------------------------
        function snapshot() {
            if (!Array.isArray(boundArray)) return [];
            return boundArray.map((item) => Object.assign({}, item));
        }


        // SUB FUNCTION | Write a Snapshot Back Into the Bound Array
        // ------------------------------------------------------------
        // Length reset plus push, never reassignment - see the header note on
        // why replacing the array instance would break saving.
        // ------------------------------------------------------------
        function restore(state) {
            if (!Array.isArray(boundArray)) return false;

            boundArray.length = 0;
            for (let i = 0; i < state.length; i++) {
                boundArray.push(Object.assign({}, state[i]));
            }
            return true;
        }


        // SUB FUNCTION | Trim the Undo Stack to the Configured Depth
        // ------------------------------------------------------------
        function trim() {
            const depth = Math.max(1, getDepth() || Na__SnapHist__DEFAULT_DEPTH);
            while (undoStack.length > depth) undoStack.shift();
        }


        // SUB FUNCTION | Are Two Snapshots Identical?
        // ------------------------------------------------------------
        // Guards the pending pattern: an interaction that ends where it started
        // leaves no history entry, so a drag that never moved or an editor
        // opened and closed unchanged never costs an undo press to get past.
        // ------------------------------------------------------------
        function areEqual(a, b) {
            if (!Array.isArray(a) || !Array.isArray(b)) return false;
            if (a.length !== b.length) return false;

            for (let i = 0; i < a.length; i++) {
                const keysA = Object.keys(a[i]);
                if (keysA.length !== Object.keys(b[i]).length) return false;
                for (let k = 0; k < keysA.length; k++) {
                    if (a[i][keysA[k]] !== b[i][keysA[k]]) return false;
                }
            }
            return true;
        }


        return {

            // FUNCTION | Bind to an Array and Clear History
            // ------------------------------------------------------------
            // One plan's undo stack has no meaning over another plan's records,
            // so binding always starts clean.
            // ------------------------------------------------------------
            begin(array) {
                boundArray = Array.isArray(array) ? array : null;
                this.clear();
                return boundArray !== null;
            },

            // FUNCTION | Unbind Entirely
            // ------------------------------------------------------------
            end() {
                boundArray = null;
                this.clear();
            },

            // FUNCTION | Drop All History Without Unbinding
            // ------------------------------------------------------------
            clear() {
                undoStack.length = 0;
                redoStack.length = 0;
                pending = null;
            },

            // FUNCTION | Take a Baseline Before a Time-Spanning Edit
            // ------------------------------------------------------------
            // Idempotent: a drag fires many move events but only the first
            // needs the baseline, so repeat calls during one interaction are
            // ignored rather than overwriting it.
            // ------------------------------------------------------------
            beginPending() {
                if (!boundArray) return false;
                if (pending !== null) return true;
                pending = snapshot();
                return true;
            },

            // FUNCTION | Commit the Pending Baseline Onto the Undo Stack
            // ------------------------------------------------------------
            commitPending() {
                if (pending === null) return false;

                const baseline = pending;
                pending = null;

                if (areEqual(baseline, snapshot())) return false;

                undoStack.push(baseline);
                redoStack.length = 0;                                        // <-- A fresh edit invalidates the redo branch
                trim();
                return true;
            },

            // FUNCTION | Abandon the Pending Baseline
            // ------------------------------------------------------------
            discardPending() {
                const had = pending !== null;
                pending = null;
                return had;
            },

            // FUNCTION | Record an Atomic Edit in One Call
            // ------------------------------------------------------------
            // For instant operations - place, delete, paste. MUST be called
            // BEFORE the mutation.
            // ------------------------------------------------------------
            captureNow() {
                if (!boundArray) return false;
                undoStack.push(snapshot());
                redoStack.length = 0;
                trim();
                return true;
            },

            // FUNCTION | Step Back One Edit
            // ------------------------------------------------------------
            // The CURRENT state goes onto the redo stack before restoring,
            // which is what makes redo return exactly what undo took away.
            // ------------------------------------------------------------
            undo() {
                if (!boundArray || undoStack.length === 0) return false;
                pending = null;                                              // <-- Any half-finished interaction is void now
                redoStack.push(snapshot());
                return restore(undoStack.pop());
            },

            // FUNCTION | Step Forward One Edit
            // ------------------------------------------------------------
            redo() {
                if (!boundArray || redoStack.length === 0) return false;
                pending = null;
                undoStack.push(snapshot());
                trim();
                return restore(redoStack.pop());
            },

            // FUNCTION | Is There Anything to Undo?
            // ------------------------------------------------------------
            canUndo() {
                return boundArray !== null && undoStack.length > 0;
            },

            // FUNCTION | Is There Anything to Redo?
            // ------------------------------------------------------------
            canRedo() {
                return boundArray !== null && redoStack.length > 0;
            },

            // FUNCTION | Current Stack Depths (dev / debug)
            // ------------------------------------------------------------
            getDepths() {
                return {
                    undo    : undoStack.length,
                    redo    : redoStack.length,
                    pending : pending !== null
                };
            }
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Snapshot History Factory
    // ------------------------------------------------------------
    export {
        Na__SnapHist__Create
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
