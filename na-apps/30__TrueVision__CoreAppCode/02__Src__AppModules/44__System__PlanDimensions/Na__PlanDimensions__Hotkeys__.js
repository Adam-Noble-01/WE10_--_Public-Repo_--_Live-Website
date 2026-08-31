// =============================================================================
// TRUEVISION3D - PLAN DIMENSIONS - KEYBOARD SHORTCUTS
// =============================================================================
//
// FILE       : Na__PlanDimensions__Hotkeys__.js
// NAMESPACE  : Na__PlanDimKeys
// MODULE     : Plan Dimensions - Keyboard Shortcuts
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Axis locking, ortho toggle, delete, undo and redo for dimensions
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - Bound only while dimension editing is on, and unbound the moment it is off.
//
// - TWO CLASSES OF KEY, HANDLED DIFFERENTLY:
//     DIMENSION-ONLY keys - the arrow key axis locks, the ortho toggle and the
//     place key - have no counterpart in the annotation layer, so they are
//     always live and need no arbitration.
//     SHARED keys - Delete, Ctrl+Z, Ctrl+Y - are also bound by the annotation
//     hotkeys. Those go through Na__FloorPlan__MarkupFocus__, so one Ctrl+Z
//     steps ONE undo stack rather than both, and one Delete removes one thing.
//   Without that arbitration a single Delete would take out a room name and a
//   dimension at the same time, which loses work silently.
//
// - The arrow keys are always claimed while dimensioning, even when they change
//   nothing. Letting them fall through would scroll the page out from under the
//   drawing, and an author reaching for an axis lock never wants that.
//
// - Escape unwinds one layer at a time: it closes vertex editing, or releases an
//   axis lock, or cancels a placement - in that order - rather than throwing
//   away all three states at once.
//
// INTEGRATION:
// - Na__FloorPlan__ModeController__ attaches alongside the dimension editor.
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

    // MODULE IMPORTS | Render Loop and Markup Focus Arbiter
    // ------------------------------------------------------------
    // @delegate: ../42__System__FloorPlanViews/Na__FloorPlan__MarkupFocus__.js
    // ------------------------------------------------------------
    import { Na__RenderLoop__RequestRender } from '../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    import {
        Na__FpFocus__DIMENSIONS,
        Na__FpFocus__CAP_UNDO,
        Na__FpFocus__CAP_REDO,
        Na__FpFocus__CAP_DELETE,
        Na__FpFocus__RegisterProbe,
        Na__FpFocus__UnregisterProbe,
        Na__FpFocus__Claim,
        Na__FpFocus__ShouldHandle,
        Na__FpFocus__AnyCanAct
    } from '../42__System__FloorPlanViews/Na__FloorPlan__MarkupFocus__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Dimension Data, Editor, Axis Lock, Vertices, History
    // ------------------------------------------------------------
    // @delegate: ./Na__PlanDimensions__Editor__.js
    // @delegate: ./Na__PlanDimensions__AxisLock__.js
    // @delegate: ./Na__PlanDimensions__VertexEditor__.js
    // @delegate: ./Na__PlanDimensions__History__.js
    // ------------------------------------------------------------
    import { Na__PlanDim__GetEditingSetup } from './Na__PlanDimensions__Data__.js';
    import {
        Na__PlanDimEdit__IsEnabled,
        Na__PlanDimEdit__IsPlacing,
        Na__PlanDimEdit__BeginPlacement,
        Na__PlanDimEdit__CancelPlacement,
        Na__PlanDimEdit__GetSelectedId,
        Na__PlanDimEdit__ClearSelection,
        Na__PlanDimEdit__DeleteSelected,
        Na__PlanDimEdit__RefreshAfterHistory
    } from './Na__PlanDimensions__Editor__.js';
    import {
        Na__PlanDimAxis__HandleArrowKey,
        Na__PlanDimAxis__GetLockedAxis,
        Na__PlanDimAxis__ClearLock,
        Na__PlanDimAxis__ToggleOrthoMode
    } from './Na__PlanDimensions__AxisLock__.js';
    import {
        Na__PlanDimVert__IsActive,
        Na__PlanDimVert__Exit
    } from './Na__PlanDimensions__VertexEditor__.js';
    import {
        Na__PlanDimHist__Undo__Step,
        Na__PlanDimHist__Redo__Step,
        Na__PlanDimHist__CanUndo,
        Na__PlanDimHist__CanRedo
    } from './Na__PlanDimensions__History__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Arrow Key Names
    // ------------------------------------------------------------
    const Na__PlanDimKeys__ARROWS = ['arrowleft', 'arrowright', 'arrowup', 'arrowdown'];
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Attachment
    // ------------------------------------------------------------
    let Na__PlanDimKeys__Attached = false;
    let Na__PlanDimKeys__OnAction = null;   // <-- Host callback so a toolbar can reflect the state
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Guards
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Is the Keyboard Focus Inside a Text Field?
    // ------------------------------------------------------------
    // Covers the toolbars, the Dev menu fields and any open annotation label.
    // In all of them the author is typing, and every shortcut must give way.
    // ------------------------------------------------------------
    function Na__PlanDimKeys__IsTypingElsewhere(event) {
        const target = event.target;
        if (!target) return false;
        if (target.isContentEditable) return true;

        const tag = target.tagName ? target.tagName.toUpperCase() : '';
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Report an Action Back to the Host
    // ------------------------------------------------------------
    function Na__PlanDimKeys__Notify(action) {
        Na__RenderLoop__RequestRender();
        if (typeof Na__PlanDimKeys__OnAction === 'function') Na__PlanDimKeys__OnAction(action);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Should the Dimension Layer Take This Shared Key?
    // ------------------------------------------------------------
    // A live placement or an open vertex edit is an unambiguous claim, so those
    // win outright. Otherwise the arbiter decides: the focused layer gets first
    // refusal, and if it cannot act the key falls through to whichever layer
    // can. That fall-through is what keeps Ctrl+Z working when focus is stale
    // or was never claimed at all.
    // ------------------------------------------------------------
    function Na__PlanDimKeys__ShouldTake(capability) {
        if (Na__PlanDimEdit__IsPlacing()) return true;
        if (Na__PlanDimVert__IsActive())  return true;
        return Na__FpFocus__ShouldHandle(Na__FpFocus__DIMENSIONS, capability);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Commands
// -----------------------------------------------------------------------------

    // FUNCTION | Undo the Last Dimension Edit
    // ------------------------------------------------------------
    function Na__PlanDimKeys__Undo() {
        if (!Na__PlanDimHist__Undo__Step()) return false;
        Na__PlanDimEdit__RefreshAfterHistory();
        Na__PlanDimKeys__Notify('undo');
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Redo the Last Undone Dimension Edit
    // ------------------------------------------------------------
    function Na__PlanDimKeys__Redo() {
        if (!Na__PlanDimHist__Redo__Step()) return false;
        Na__PlanDimEdit__RefreshAfterHistory();
        Na__PlanDimKeys__Notify('redo');
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete the Selected Dimension
    // ------------------------------------------------------------
    function Na__PlanDimKeys__Delete() {
        if (!Na__PlanDimEdit__GetSelectedId()) return false;
        if (!Na__PlanDimEdit__DeleteSelected()) return false;
        Na__PlanDimKeys__Notify('delete');
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Unwind One Layer of State
    // ------------------------------------------------------------
    // Vertex editing, then an axis lock, then a placement - one Escape per
    // layer, so the author never loses more context than they asked to.
    // ------------------------------------------------------------
    function Na__PlanDimKeys__Escape() {
        if (Na__PlanDimVert__IsActive()) {
            Na__PlanDimVert__Exit();
            Na__PlanDimKeys__Notify('vertex-exit');
            return true;
        }
        if (Na__PlanDimAxis__GetLockedAxis()) {
            Na__PlanDimAxis__ClearLock();
            Na__PlanDimKeys__Notify('lock-clear');
            return true;
        }
        if (Na__PlanDimEdit__IsPlacing()) {
            Na__PlanDimEdit__CancelPlacement();
            Na__PlanDimKeys__Notify('placement-cancel');
            return true;
        }
        if (Na__PlanDimEdit__GetSelectedId()) {
            Na__PlanDimEdit__ClearSelection();
            Na__PlanDimKeys__Notify('deselect');
            return true;
        }
        return false;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Key Dispatch
// -----------------------------------------------------------------------------

    // SUB FUNCTION | Route One Keydown to Its Command
    // ------------------------------------------------------------
    function Na__PlanDimKeys__HandleKeyDown(event) {
        if (!Na__PlanDimEdit__IsEnabled()) return;
        if (Na__PlanDimKeys__IsTypingElsewhere(event)) return;

        const setup    = Na__PlanDim__GetEditingSetup();
        const key      = String(event.key || '').toLowerCase();
        const modified = event.ctrlKey || event.metaKey;
        let   handled  = false;

        // ARROW KEYS | Dimension-only, so never arbitrated. Always claimed so
        // they can never scroll the page out from under the drawing.
        if (!modified && Na__PlanDimKeys__ARROWS.indexOf(key) !== -1) {
            if (Na__PlanDimAxis__HandleArrowKey(key)) Na__PlanDimKeys__Notify('axis-lock');
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        // ESCAPE | Unwinds one layer of state
        if (!modified && key === 'escape') {
            if (Na__PlanDimKeys__Escape()) {
                event.preventDefault();
                event.stopPropagation();
            }
            return;
        }

        if (modified && !event.altKey) {
            // SHARED | Only act when this layer holds focus
            const isUndo = (key === setup.undoKey);
            const isRedo = (key === setup.redoKey);

            if (isUndo || isRedo) {
                const capability = isUndo ? Na__FpFocus__CAP_UNDO : Na__FpFocus__CAP_REDO;

                if (!Na__PlanDimKeys__ShouldTake(capability)) {
                    // Not ours. Swallow it anyway if NO layer can act, so a
                    // Ctrl+Z at the bottom of both stacks never reaches the
                    // browser's own edit history.
                    if (!Na__FpFocus__AnyCanAct(capability)) {
                        event.preventDefault();
                        event.stopPropagation();
                    }
                    return;                                                      // <-- Let the annotation layer take it
                }

                if (isUndo) Na__PlanDimKeys__Undo();
                else        Na__PlanDimKeys__Redo();
                handled = true;
            }
        } else if (!modified && !event.altKey) {
            // DIMENSION-ONLY | Ortho toggle and the place key
            if (key === setup.orthoKey) {
                Na__PlanDimAxis__ToggleOrthoMode();
                Na__PlanDimKeys__Notify('ortho');
                handled = true;
            } else if (key === setup.placeKey) {
                Na__FpFocus__Claim(Na__FpFocus__DIMENSIONS);                     // <-- Starting a dimension is a claim
                Na__PlanDimEdit__BeginPlacement();
                Na__PlanDimKeys__Notify('place-armed');
                handled = true;
            } else if (setup.deleteKeys.indexOf(key) !== -1) {
                // SHARED | Delete goes to whichever layer actually has a
                // selection, with focus breaking the tie when both do.
                if (!Na__PlanDimKeys__ShouldTake(Na__FpFocus__CAP_DELETE)) return;
                Na__PlanDimKeys__Delete();
                handled = true;                                                  // <-- Backspace must never navigate back
            }
        }

        if (handled) {
            event.preventDefault();
            event.stopPropagation();
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Bind the Shortcuts
    // ------------------------------------------------------------
    // context: { onAction }
    // Capture phase, so a shortcut is resolved before anything deeper in the
    // page can swallow it.
    // ------------------------------------------------------------
    function Na__PlanDimKeys__Attach(context) {
        if (Na__PlanDimKeys__Attached) return false;

        Na__PlanDimKeys__OnAction = (context && typeof context.onAction === 'function')
            ? context.onAction
            : null;

        // The arbiter asks these before handing over a shared key, so it never
        // has to reach into this system's state itself.
        Na__FpFocus__RegisterProbe(Na__FpFocus__DIMENSIONS, {
            canUndo   : Na__PlanDimHist__CanUndo,
            canRedo   : Na__PlanDimHist__CanRedo,
            canDelete : () => Na__PlanDimEdit__GetSelectedId() !== null
        });

        window.addEventListener('keydown', Na__PlanDimKeys__HandleKeyDown, true);
        Na__PlanDimKeys__Attached = true;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Unbind the Shortcuts
    // ------------------------------------------------------------
    function Na__PlanDimKeys__Detach() {
        if (!Na__PlanDimKeys__Attached) return false;

        window.removeEventListener('keydown', Na__PlanDimKeys__HandleKeyDown, true);
        Na__FpFocus__UnregisterProbe(Na__FpFocus__DIMENSIONS);                   // <-- Stop being offered keys after detaching
        Na__PlanDimKeys__Attached = false;
        Na__PlanDimKeys__OnAction = null;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Are the Shortcuts Currently Bound?
    // ------------------------------------------------------------
    function Na__PlanDimKeys__IsAttached() {
        return Na__PlanDimKeys__Attached;
    }
    // ------------------------------------------------------------


    // FUNCTION | Undo / Redo Availability for the Toolbar
    // ------------------------------------------------------------
    function Na__PlanDimKeys__GetHistoryState() {
        return {
            canUndo : Na__PlanDimHist__CanUndo(),
            canRedo : Na__PlanDimHist__CanRedo()
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Dimension Shortcut API
    // ------------------------------------------------------------
    export {
        Na__PlanDimKeys__Attach,
        Na__PlanDimKeys__Detach,
        Na__PlanDimKeys__IsAttached,
        Na__PlanDimKeys__GetHistoryState,
        Na__PlanDimKeys__Undo,
        Na__PlanDimKeys__Redo,
        Na__PlanDimKeys__Delete
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
