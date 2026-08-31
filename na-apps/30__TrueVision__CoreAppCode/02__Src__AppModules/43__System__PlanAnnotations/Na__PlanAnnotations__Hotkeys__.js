// =============================================================================
// TRUEVISION3D - PLAN ANNOTATIONS - KEYBOARD SHORTCUTS
// =============================================================================
//
// FILE       : Na__PlanAnnotations__Hotkeys__.js
// NAMESPACE  : Na__PlanAnnoKeys
// MODULE     : Plan Annotations - Keyboard Shortcuts
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Copy, paste, undo, redo and delete for floor plan text labels
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - Bound only while annotation editing is on, and unbound the moment it is
//   switched off. Nothing here is ever live in the ordinary 3D app.
// - Deliberately NOT registered with Na__Hotkeys__Manager. That module owns
//   unmodified global view-switching keys and returns early whenever Ctrl,
//   Meta or Alt is held, which is exactly the opposite of what these need.
//   Widening its guard to carry a contextual editing concern would have made a
//   global module answerable for a local one.
// - THE CLIPBOARD IS INTERNAL, not the operating system clipboard. Reading the
//   OS clipboard needs async permission prompts and would fight with text the
//   author copied from somewhere else; an in-app buffer makes "copy this label,
//   paste it" behave exactly as expected and never surprises anyone.
// - Repeated pastes cascade by the configured offset rather than stacking on
//   one spot, so pasting four room names gives four visible labels instead of
//   one apparent label with three hidden underneath it.
// - Every shortcut stands down while the in-situ text editor is open, so Ctrl+C
//   and Ctrl+V inside a label being typed are the browser's own text copy and
//   paste, which is what the author means at that moment.
//
// INTEGRATION:
// - Na__FloorPlan__ModeController__ calls Attach alongside enabling the editor,
//   and Detach when leaving plan mode or annotation mode.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 31-Aug-2026 - Version 1.0.0
// - Initial implementation. Ctrl+C / Ctrl+V / Ctrl+Z / Ctrl+Y / Delete.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Render Loop Invalidation
    // ------------------------------------------------------------
    import { Na__RenderLoop__RequestRender } from '../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Markup Focus Arbiter
    // ------------------------------------------------------------
    // Dimensions bind Ctrl+Z, Ctrl+Y and Delete too. Without arbitration one
    // press would step BOTH undo stacks and one Delete would remove a label
    // AND a dimension.
    // @delegate: ../42__System__FloorPlanViews/Na__FloorPlan__MarkupFocus__.js
    // ------------------------------------------------------------
    import {
        Na__FpFocus__ANNOTATIONS,
        Na__FpFocus__CAP_UNDO,
        Na__FpFocus__CAP_REDO,
        Na__FpFocus__CAP_DELETE,
        Na__FpFocus__RegisterProbe,
        Na__FpFocus__UnregisterProbe,
        Na__FpFocus__ShouldHandle,
        Na__FpFocus__AnyCanAct
    } from '../42__System__FloorPlanViews/Na__FloorPlan__MarkupFocus__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Annotation Data, Overlay, Editor and History
    // ------------------------------------------------------------
    // @delegate: ./Na__PlanAnnotations__Data__.js
    // @delegate: ./Na__PlanAnnotations__Overlay__.js
    // @delegate: ./Na__PlanAnnotations__Editor__.js
    // @delegate: ./Na__PlanAnnotations__History__.js
    // ------------------------------------------------------------
    import {
        Na__PlanAnno__Create,
        Na__PlanAnno__Read,
        Na__PlanAnno__FindById,
        Na__PlanAnno__GetHotkeySetup
    } from './Na__PlanAnnotations__Data__.js';
    import {
        Na__PlanAnnoLayer__GetAnnotations,
        Na__PlanAnnoLayer__Rebuild,
        Na__PlanAnnoLayer__Sync
    } from './Na__PlanAnnotations__Overlay__.js';
    import {
        Na__PlanAnnoEdit__IsEnabled,
        Na__PlanAnnoEdit__IsEditing,
        Na__PlanAnnoEdit__GetSelected,
        Na__PlanAnnoEdit__Select,
        Na__PlanAnnoEdit__DeleteSelected,
        Na__PlanAnnoEdit__Refresh
    } from './Na__PlanAnnotations__Editor__.js';
    import {
        Na__PlanAnnoHist__CaptureNow,
        Na__PlanAnnoHist__Undo__Step,
        Na__PlanAnnoHist__Redo__Step,
        Na__PlanAnnoHist__CanUndo,
        Na__PlanAnnoHist__CanRedo
    } from './Na__PlanAnnotations__History__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Attachment
    // ------------------------------------------------------------
    let Na__PlanAnnoKeys__Attached = false;
    let Na__PlanAnnoKeys__OnAction = null;   // <-- Host callback: refresh the toolbar, report a message
    // ------------------------------------------------------------

    // MODULE VARIABLES | Internal Clipboard
    // ------------------------------------------------------------
    // Holds the FIELDS of a copied label, not a reference to it, so deleting
    // the original never empties the clipboard and pasting never aliases it.
    // ------------------------------------------------------------
    let Na__PlanAnnoKeys__Clipboard    = null;
    let Na__PlanAnnoKeys__PasteRepeats = 0;   // <-- Cascade counter, reset on every fresh copy
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Guards
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Is the Keyboard Focus Inside a Text Field?
    // ------------------------------------------------------------
    // Covers the toolbar size box, the Dev menu fields and any open label
    // editor. In all three the author is typing, and these shortcuts must give
    // way to the browser's own text handling.
    // ------------------------------------------------------------
    function Na__PlanAnnoKeys__IsTypingElsewhere(event) {
        const target = event.target;
        if (!target) return false;

        if (target.isContentEditable) return true;

        const tag = target.tagName ? target.tagName.toUpperCase() : '';
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Should This Event Be Handled at All?
    // ------------------------------------------------------------
    function Na__PlanAnnoKeys__ShouldHandle(event) {
        if (!Na__PlanAnnoEdit__IsEnabled()) return false;                        // <-- Not marking up a plan
        if (Na__PlanAnnoEdit__IsEditing())  return false;                        // <-- A label is open for typing
        if (Na__PlanAnnoKeys__IsTypingElsewhere(event)) return false;
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Report an Action Back to the Host
    // ------------------------------------------------------------
    function Na__PlanAnnoKeys__Notify(action) {
        Na__RenderLoop__RequestRender();
        if (typeof Na__PlanAnnoKeys__OnAction === 'function') Na__PlanAnnoKeys__OnAction(action);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Commands
// -----------------------------------------------------------------------------

    // FUNCTION | Copy the Selected Label Into the Internal Clipboard
    // ------------------------------------------------------------
    // Stores a detached copy of the fields, so the clipboard survives the
    // original being edited or deleted.
    // ------------------------------------------------------------
    function Na__PlanAnnoKeys__Copy() {
        const selected = Na__PlanAnnoEdit__GetSelected();
        if (!selected) return false;

        Na__PlanAnnoKeys__Clipboard = {
            text       : selected.text,
            posXMm     : selected.posXMm,
            posZMm     : selected.posZMm,
            sizeMm     : selected.sizeMm,
            fontWeight : selected.fontWeight,
            color      : selected.color
        };
        Na__PlanAnnoKeys__PasteRepeats = 0;                                      // <-- Cascade restarts from the new source
        Na__PlanAnnoKeys__Notify('copy');
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Paste the Clipboard as a New Label
    // ------------------------------------------------------------
    // Offset from the source so the new label is visibly its own thing, and
    // cascading on repeat so four pastes give four readable labels rather than
    // one with three hidden underneath.
    // ------------------------------------------------------------
    function Na__PlanAnnoKeys__Paste() {
        if (!Na__PlanAnnoKeys__Clipboard) return false;

        const annotations = Na__PlanAnnoLayer__GetAnnotations();
        if (!Array.isArray(annotations)) return false;

        const setup = Na__PlanAnno__GetHotkeySetup();
        const step  = setup.cascadeRepeats ? (Na__PlanAnnoKeys__PasteRepeats + 1) : 1;
        const shift = setup.pasteOffsetMm * step;

        Na__PlanAnnoHist__CaptureNow();                                          // <-- BEFORE the mutation

        const created = Na__PlanAnno__Create(
            annotations,
            Na__PlanAnnoKeys__Clipboard.posXMm + shift,
            Na__PlanAnnoKeys__Clipboard.posZMm + shift,
            {
                text       : Na__PlanAnnoKeys__Clipboard.text,
                sizeMm     : Na__PlanAnnoKeys__Clipboard.sizeMm,
                fontWeight : Na__PlanAnnoKeys__Clipboard.fontWeight,
                color      : Na__PlanAnnoKeys__Clipboard.color
            }
        );
        if (!created) return false;

        Na__PlanAnnoKeys__PasteRepeats = step;

        Na__PlanAnnoLayer__Rebuild();
        Na__PlanAnnoLayer__Sync();
        Na__PlanAnnoEdit__Select(Na__PlanAnno__Read(created).id);                // <-- Ready to drag or retype straight away
        Na__PlanAnnoEdit__Refresh();
        Na__PlanAnnoKeys__Notify('paste');
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Undo the Last Annotation Edit
    // ------------------------------------------------------------
    // The selection is validated after the restore: undoing a paste or a place
    // removes the very label that was selected, and leaving the id dangling
    // would leave the toolbar acting on something no longer there.
    // ------------------------------------------------------------
    function Na__PlanAnnoKeys__Undo() {
        if (!Na__PlanAnnoHist__Undo__Step()) return false;
        Na__PlanAnnoKeys__AfterHistoryStep('undo');
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Redo the Last Undone Annotation Edit
    // ------------------------------------------------------------
    function Na__PlanAnnoKeys__Redo() {
        if (!Na__PlanAnnoHist__Redo__Step()) return false;
        Na__PlanAnnoKeys__AfterHistoryStep('redo');
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Rebuild and Revalidate After a History Step
    // ------------------------------------------------------------
    function Na__PlanAnnoKeys__AfterHistoryStep(action) {
        const selected = Na__PlanAnnoEdit__GetSelected();

        Na__PlanAnnoLayer__Rebuild();                                            // <-- Nodes must match the restored array
        Na__PlanAnnoLayer__Sync();

        // Drop a selection whose label no longer exists in the restored state.
        if (selected && !Na__PlanAnno__FindById(Na__PlanAnnoLayer__GetAnnotations(), selected.id)) {
            Na__PlanAnnoEdit__Select(null);
        }

        Na__PlanAnnoEdit__Refresh();
        Na__PlanAnnoKeys__Notify(action);
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete the Selected Label
    // ------------------------------------------------------------
    // History capture happens in the editor's own delete path, so the toolbar
    // button and this key produce identical, undoable results.
    // ------------------------------------------------------------
    function Na__PlanAnnoKeys__Delete() {
        if (!Na__PlanAnnoEdit__GetSelected()) return false;
        if (!Na__PlanAnnoEdit__DeleteSelected()) return false;
        Na__PlanAnnoKeys__Notify('delete');
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Key Dispatch
// -----------------------------------------------------------------------------

    // SUB FUNCTION | Route One Keydown to Its Command
    // ------------------------------------------------------------
    // Handled keys are always preventDefault'ed, so Ctrl+Z never reaches the
    // browser's own undo and Backspace never navigates the page back.
    // ------------------------------------------------------------
    function Na__PlanAnnoKeys__HandleKeyDown(event) {
        if (!Na__PlanAnnoKeys__ShouldHandle(event)) return;

        const setup = Na__PlanAnno__GetHotkeySetup();
        if (!setup.enabled) return;

        const key       = String(event.key || '').toLowerCase();
        const modified  = event.ctrlKey || event.metaKey;                        // <-- Meta so it also reads naturally on a Mac
        let   handled   = false;

        if (modified && !event.altKey) {
            // Copy and paste are annotation-only, so they are never arbitrated.
            if (key === setup.copyKey)       handled = Na__PlanAnnoKeys__Copy();
            else if (key === setup.pasteKey) handled = Na__PlanAnnoKeys__Paste();
            else if (key === setup.undoKey || key === setup.redoKey) {
                // SHARED | Only act when the arbiter hands this over.
                const isUndo     = (key === setup.undoKey);
                const capability = isUndo ? Na__FpFocus__CAP_UNDO : Na__FpFocus__CAP_REDO;

                if (Na__FpFocus__ShouldHandle(Na__FpFocus__ANNOTATIONS, capability)) {
                    handled = isUndo ? Na__PlanAnnoKeys__Undo() : Na__PlanAnnoKeys__Redo();
                    handled = true;
                } else if (!Na__FpFocus__AnyCanAct(capability)) {
                    handled = true;                                              // <-- Nobody can act; swallow it anyway
                } else {
                    return;                                                      // <-- The dimension layer is taking it
                }
            }

            // Undo and redo are claimed even when they did nothing. Letting
            // Ctrl+Z fall through to the browser once the stack is empty would
            // rip the page's own edit history instead of quietly doing nothing.
            if (!handled && (key === setup.undoKey || key === setup.redoKey)) {
                handled = true;
            }

            // Paste is claimed too: a browser paste onto the canvas achieves
            // nothing, and swallowing it lets the empty case say so.
            if (!handled && key === setup.pasteKey) {
                handled = true;
                Na__PlanAnnoKeys__Notify('paste-empty');
            }

            // Copy is deliberately NOT claimed when no label was selected, so a
            // copy the author intended for text elsewhere on the page still works.
        } else if (!modified && !event.altKey && setup.deleteKeys.indexOf(key) !== -1) {
            // SHARED | Delete goes to whichever layer actually has a selection.
            if (!Na__FpFocus__ShouldHandle(Na__FpFocus__ANNOTATIONS, Na__FpFocus__CAP_DELETE)) {
                if (!Na__FpFocus__AnyCanAct(Na__FpFocus__CAP_DELETE)) {
                    event.preventDefault();                                      // <-- Backspace must never navigate back
                    event.stopPropagation();
                }
                return;
            }
            Na__PlanAnnoKeys__Delete();
            handled = true;
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
    // Capture phase, so the shortcuts are resolved before anything deeper in
    // the page can swallow them.
    // ------------------------------------------------------------
    function Na__PlanAnnoKeys__Attach(context) {
        if (Na__PlanAnnoKeys__Attached) return false;

        Na__PlanAnnoKeys__OnAction = (context && typeof context.onAction === 'function')
            ? context.onAction
            : null;

        Na__FpFocus__RegisterProbe(Na__FpFocus__ANNOTATIONS, {
            canUndo   : Na__PlanAnnoHist__CanUndo,
            canRedo   : Na__PlanAnnoHist__CanRedo,
            canDelete : () => Na__PlanAnnoEdit__GetSelected() !== null
        });

        window.addEventListener('keydown', Na__PlanAnnoKeys__HandleKeyDown, true);
        Na__PlanAnnoKeys__Attached = true;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Unbind the Shortcuts
    // ------------------------------------------------------------
    // The clipboard deliberately SURVIVES a detach, so a label copied on one
    // floor plan can be pasted onto another. History does not - that is bound
    // per plan and cleared on mount.
    // ------------------------------------------------------------
    function Na__PlanAnnoKeys__Detach() {
        if (!Na__PlanAnnoKeys__Attached) return false;

        window.removeEventListener('keydown', Na__PlanAnnoKeys__HandleKeyDown, true);
        Na__FpFocus__UnregisterProbe(Na__FpFocus__ANNOTATIONS);                  // <-- Stop being offered keys after detaching
        Na__PlanAnnoKeys__Attached = false;
        Na__PlanAnnoKeys__OnAction = null;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Are the Shortcuts Currently Bound?
    // ------------------------------------------------------------
    function Na__PlanAnnoKeys__IsAttached() {
        return Na__PlanAnnoKeys__Attached;
    }
    // ------------------------------------------------------------


    // FUNCTION | Does the Clipboard Hold Anything?
    // ------------------------------------------------------------
    function Na__PlanAnnoKeys__HasClipboard() {
        return Na__PlanAnnoKeys__Clipboard !== null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Undo / Redo Availability for the Toolbar
    // ------------------------------------------------------------
    function Na__PlanAnnoKeys__GetHistoryState() {
        return {
            canUndo : Na__PlanAnnoHist__CanUndo(),
            canRedo : Na__PlanAnnoHist__CanRedo()
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Plan Annotation Shortcut API
    // ------------------------------------------------------------
    export {
        Na__PlanAnnoKeys__Attach,
        Na__PlanAnnoKeys__Detach,
        Na__PlanAnnoKeys__IsAttached,
        Na__PlanAnnoKeys__HasClipboard,
        Na__PlanAnnoKeys__GetHistoryState,
        Na__PlanAnnoKeys__Copy,
        Na__PlanAnnoKeys__Paste,
        Na__PlanAnnoKeys__Undo,
        Na__PlanAnnoKeys__Redo,
        Na__PlanAnnoKeys__Delete
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
