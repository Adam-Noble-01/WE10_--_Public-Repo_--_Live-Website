// =============================================================================
// TRUEVISION3D - PLAN ANNOTATIONS - EDITOR INTERACTION
// =============================================================================
//
// FILE       : Na__PlanAnnotations__Editor__.js
// NAMESPACE  : Na__PlanAnnoEdit
// MODULE     : Plan Annotations - Editor Interaction
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Place, drag, edit and delete floor plan text labels in situ
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - Editing is deliberately forgiving, because room names get typed wrong.
//   A single click selects, a drag moves, and a double click opens the label
//   itself for editing - the node becomes contenteditable in place rather
//   than opening a dialog somewhere else on screen.
// - Enter commits, Escape reverts to the text the label had when editing
//   started. A label left completely empty on commit is removed, so a
//   mis-placed label can be cleared by emptying it rather than hunting for a
//   delete control.
// - A drag has to travel past a small pixel threshold before it counts, so a
//   slightly shaky click selects the label instead of nudging it off its room.
// - While a label owns the pointer the plan navigation is suppressed, so
//   moving text never drags the drawing underneath it. Positions convert back
//   to world millimetres on drop, the units they were authored in.
//
// INTEGRATION:
// - Na__FloorPlan__ModeController__ enables this only in developer mode.
// - Nodes are created by Na__PlanAnnotations__Overlay__, which calls back
//   into AttachNode so interaction is wired exactly once per node.
// - Na__PlanAnnotations__Toolbar__ drives Add / Delete / size / weight.
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

    // MODULE IMPORTS | Render Loop Invalidation
    // ------------------------------------------------------------
    import { Na__RenderLoop__RequestRender } from '../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Plan Camera and Navigation Suppression
    // ------------------------------------------------------------
    // @delegate: ../42__System__FloorPlanViews/Na__FloorPlan__PlanNavigation__.js
    // ------------------------------------------------------------
    import { Na__FpCam__GetCamera } from '../42__System__FloorPlanViews/Na__FloorPlan__OrthoCamera__.js';
    import { Na__FpNav__SetSuppressed } from '../42__System__FloorPlanViews/Na__FloorPlan__PlanNavigation__.js';
    import {
        Na__FpFocus__ANNOTATIONS,
        Na__FpFocus__Claim,
        Na__FpFocus__Release
    } from '../42__System__FloorPlanViews/Na__FloorPlan__MarkupFocus__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Annotation Data and Overlay
    // ------------------------------------------------------------
    // @delegate: ./Na__PlanAnnotations__Data__.js
    // @delegate: ./Na__PlanAnnotations__Overlay__.js
    // @delegate: ./Na__PlanAnnotations__History__.js
    // ------------------------------------------------------------
    import {
        Na__PlanAnno__Create,
        Na__PlanAnno__Delete,
        Na__PlanAnno__FindById,
        Na__PlanAnno__SetPosition,
        Na__PlanAnno__Update,
        Na__PlanAnno__Read,
        Na__PlanAnno__GetTextSetup,
        Na__PlanAnno__GetInteractionSetup
    } from './Na__PlanAnnotations__Data__.js';
    import {
        Na__PlanAnnoHist__BeginPending,
        Na__PlanAnnoHist__CommitPending,
        Na__PlanAnnoHist__DiscardPending,
        Na__PlanAnnoHist__CaptureNow
    } from './Na__PlanAnnotations__History__.js';
    import {
        Na__PlanAnnoLayer__Rebuild,
        Na__PlanAnnoLayer__Sync,
        Na__PlanAnnoLayer__GetNode,
        Na__PlanAnnoLayer__GetAnnotations,
        Na__PlanAnnoLayer__ScreenToWorldMm
    } from './Na__PlanAnnotations__Overlay__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | State Class Names
    // ------------------------------------------------------------
    const Na__PlanAnnoEdit__CLASS_EDITABLE = 'na-plan-anno__item--editable';
    const Na__PlanAnnoEdit__CLASS_SELECTED = 'na-plan-anno__item--selected';
    const Na__PlanAnnoEdit__CLASS_EDITING  = 'na-plan-anno__item--editing';
    const Na__PlanAnnoEdit__CLASS_PLACING  = 'na-plan-anno__placing';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Enablement and Host Context
    // ------------------------------------------------------------
    let Na__PlanAnnoEdit__Enabled    = false;
    let Na__PlanAnnoEdit__Canvas     = null;   // <-- Canvas that placement clicks land on
    let Na__PlanAnnoEdit__OnChanged  = null;   // <-- Callback so the dev editor can mark unsaved work
    // ------------------------------------------------------------

    // MODULE VARIABLES | Selection and Placement
    // ------------------------------------------------------------
    let Na__PlanAnnoEdit__SelectedId = null;
    let Na__PlanAnnoEdit__Placing    = false;  // <-- Next canvas click drops a new label
    // ------------------------------------------------------------

    // MODULE VARIABLES | Active Drag Tracking
    // ------------------------------------------------------------
    let Na__PlanAnnoEdit__DragId      = null;
    let Na__PlanAnnoEdit__DragMoved   = false;
    let Na__PlanAnnoEdit__DragStartX  = 0;
    let Na__PlanAnnoEdit__DragStartY  = 0;
    // ------------------------------------------------------------

    // MODULE VARIABLES | Open In-Situ Editor
    // ------------------------------------------------------------
    let Na__PlanAnnoEdit__EditingId   = null;
    let Na__PlanAnnoEdit__EditingText = '';    // <-- Text before editing, for Escape
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Change Notification
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Tell the Host Something Changed and Redraw
    // ------------------------------------------------------------
    function Na__PlanAnnoEdit__NotifyChanged() {
        Na__PlanAnnoLayer__Sync();
        Na__RenderLoop__RequestRender();
        if (typeof Na__PlanAnnoEdit__OnChanged === 'function') Na__PlanAnnoEdit__OnChanged();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Selection
// -----------------------------------------------------------------------------

    // FUNCTION | Select One Label, or Clear the Selection With null
    // ------------------------------------------------------------
    function Na__PlanAnnoEdit__Select(annotationId) {
        if (Na__PlanAnnoEdit__SelectedId === annotationId) return;

        const previous = Na__PlanAnnoLayer__GetNode(Na__PlanAnnoEdit__SelectedId);
        if (previous) previous.classList.remove(Na__PlanAnnoEdit__CLASS_SELECTED);

        Na__PlanAnnoEdit__SelectedId = annotationId || null;

        const node = Na__PlanAnnoLayer__GetNode(Na__PlanAnnoEdit__SelectedId);
        if (node) node.classList.add(Na__PlanAnnoEdit__CLASS_SELECTED);

        if (Na__PlanAnnoEdit__SelectedId) {
            Na__FpFocus__Claim(Na__FpFocus__ANNOTATIONS);
        } else {
            Na__FpFocus__Release(Na__FpFocus__ANNOTATIONS);
        }

        if (typeof Na__PlanAnnoEdit__OnChanged === 'function') Na__PlanAnnoEdit__OnChanged();
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Selected Annotation's Fields (null When None)
    // ------------------------------------------------------------
    function Na__PlanAnnoEdit__GetSelected() {
        if (!Na__PlanAnnoEdit__SelectedId) return null;
        const annotation = Na__PlanAnno__FindById(Na__PlanAnnoLayer__GetAnnotations(), Na__PlanAnnoEdit__SelectedId);
        return annotation ? Na__PlanAnno__Read(annotation) : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | In-Situ Text Editing
// -----------------------------------------------------------------------------

    // FUNCTION | Open One Label for Editing In Place
    // ------------------------------------------------------------
    function Na__PlanAnnoEdit__BeginEdit(annotationId) {
        const node = Na__PlanAnnoLayer__GetNode(annotationId);
        if (!node) return false;

        Na__PlanAnnoEdit__CommitEdit();                                          // <-- Only ever one editor open

        Na__PlanAnnoEdit__EditingId   = annotationId;
        Na__PlanAnnoEdit__EditingText = node.textContent;
        Na__PlanAnnoHist__BeginPending();                                        // <-- Baseline; committed only if the text really changes

        node.contentEditable = 'true';
        node.spellcheck      = false;
        node.classList.add(Na__PlanAnnoEdit__CLASS_EDITING);
        node.focus();

        // Select the whole label so typing replaces it, which is what you
        // want when renaming a room rather than appending to it.
        const range = document.createRange();
        range.selectNodeContents(node);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        Na__FpNav__SetSuppressed(true);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Commit the Open Editor Back to the Data
    // ------------------------------------------------------------
    // An emptied label is deleted rather than left as an invisible node the
    // author cannot find again.
    // ------------------------------------------------------------
    function Na__PlanAnnoEdit__CommitEdit() {
        if (!Na__PlanAnnoEdit__EditingId) return false;

        const annotationId = Na__PlanAnnoEdit__EditingId;
        const node         = Na__PlanAnnoLayer__GetNode(annotationId);
        const interaction  = Na__PlanAnno__GetInteractionSetup();

        Na__PlanAnnoEdit__EditingId = null;

        if (node) {
            node.contentEditable = 'false';
            node.classList.remove(Na__PlanAnnoEdit__CLASS_EDITING);
        }

        const text       = node ? node.textContent.trim() : '';
        const annotations = Na__PlanAnnoLayer__GetAnnotations();

        if (text.length === 0 && interaction.deleteEmptyOnCommit) {
            Na__PlanAnno__Delete(annotations, annotationId);
            if (Na__PlanAnnoEdit__SelectedId === annotationId) Na__PlanAnnoEdit__SelectedId = null;
            Na__PlanAnnoLayer__Rebuild();
        } else {
            Na__PlanAnno__Update(Na__PlanAnno__FindById(annotations, annotationId), { text: text });
        }

        Na__PlanAnnoHist__CommitPending();                                        // <-- No-op when the text came back unchanged
        Na__FpNav__SetSuppressed(false);
        Na__PlanAnnoEdit__NotifyChanged();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Abandon the Open Editor and Restore the Previous Text
    // ------------------------------------------------------------
    function Na__PlanAnnoEdit__CancelEdit() {
        if (!Na__PlanAnnoEdit__EditingId) return false;

        const node = Na__PlanAnnoLayer__GetNode(Na__PlanAnnoEdit__EditingId);
        if (node) {
            node.textContent     = Na__PlanAnnoEdit__EditingText;                // <-- Put back what was there
            node.contentEditable = 'false';
            node.classList.remove(Na__PlanAnnoEdit__CLASS_EDITING);
        }

        Na__PlanAnnoEdit__EditingId = null;
        Na__PlanAnnoHist__DiscardPending();                                      // <-- Escaped: the baseline was never an edit
        Na__FpNav__SetSuppressed(false);
        Na__PlanAnnoEdit__NotifyChanged();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is an Editor Currently Open?
    // ------------------------------------------------------------
    function Na__PlanAnnoEdit__IsEditing() {
        return Na__PlanAnnoEdit__EditingId !== null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Node Interaction Handlers
// -----------------------------------------------------------------------------

    // SUB FUNCTION | Label Pointer Down - Select and Arm a Possible Drag
    // ------------------------------------------------------------
    function Na__PlanAnnoEdit__HandleNodePointerDown(event, annotationId) {
        if (!Na__PlanAnnoEdit__Enabled) return;
        if (Na__PlanAnnoEdit__EditingId === annotationId) return;                // <-- Let the caret work inside an open editor

        event.stopPropagation();                                                 // <-- Never let this reach the pan handler

        Na__PlanAnnoEdit__Select(annotationId);
        Na__PlanAnnoEdit__DragId     = annotationId;
        Na__PlanAnnoEdit__DragMoved  = false;
        Na__PlanAnnoEdit__DragStartX = event.clientX;
        Na__PlanAnnoEdit__DragStartY = event.clientY;
        Na__PlanAnnoHist__BeginPending();                                        // <-- Baseline before the label can move

        Na__FpNav__SetSuppressed(true);

        const node = Na__PlanAnnoLayer__GetNode(annotationId);
        if (node && node.setPointerCapture) node.setPointerCapture(event.pointerId);
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Label Pointer Move - Drag Past the Threshold
    // ------------------------------------------------------------
    function Na__PlanAnnoEdit__HandleNodePointerMove(event, annotationId) {
        if (Na__PlanAnnoEdit__DragId !== annotationId) return;

        const interaction = Na__PlanAnno__GetInteractionSetup();
        const travelled   = Math.abs(event.clientX - Na__PlanAnnoEdit__DragStartX)
                          + Math.abs(event.clientY - Na__PlanAnnoEdit__DragStartY);

        if (!Na__PlanAnnoEdit__DragMoved && travelled < interaction.dragThresholdPx) return;
        Na__PlanAnnoEdit__DragMoved = true;

        const camera = Na__FpCam__GetCamera();
        if (!camera) return;

        const world = Na__PlanAnnoLayer__ScreenToWorldMm(
            event.clientX, event.clientY, camera.position.x, camera.position.z
        );
        if (!world) return;

        Na__PlanAnno__SetPosition(
            Na__PlanAnno__FindById(Na__PlanAnnoLayer__GetAnnotations(), annotationId),
            world.posXMm, world.posZMm
        );
        Na__PlanAnnoLayer__Sync();
        Na__RenderLoop__RequestRender();
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Label Pointer Up - End the Drag
    // ------------------------------------------------------------
    function Na__PlanAnnoEdit__HandleNodePointerUp(event, annotationId) {
        if (Na__PlanAnnoEdit__DragId !== annotationId) return;

        const node = Na__PlanAnnoLayer__GetNode(annotationId);
        if (node && node.releasePointerCapture) {
            try {
                node.releasePointerCapture(event.pointerId);
            } catch (error) {
                // Capture may already have been lost; nothing to release.
            }
        }

        const moved = Na__PlanAnnoEdit__DragMoved;
        Na__PlanAnnoEdit__DragId    = null;
        Na__PlanAnnoEdit__DragMoved = false;

        // Suppression stays on only while an editor is open.
        if (!Na__PlanAnnoEdit__EditingId) Na__FpNav__SetSuppressed(false);

        if (moved) {
            Na__PlanAnnoHist__CommitPending();                                    // <-- Position actually changed
            Na__PlanAnnoEdit__NotifyChanged();
        } else {
            Na__PlanAnnoHist__DiscardPending();                                   // <-- A click, not a drag: no history entry
        }
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Label Double Click - Open the In-Situ Editor
    // ------------------------------------------------------------
    function Na__PlanAnnoEdit__HandleNodeDoubleClick(event, annotationId) {
        if (!Na__PlanAnnoEdit__Enabled) return;
        if (!Na__PlanAnno__GetInteractionSetup().doubleClickToEdit) return;

        event.preventDefault();
        event.stopPropagation();
        Na__PlanAnnoEdit__BeginEdit(annotationId);
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Key Handling Inside an Open Editor
    // ------------------------------------------------------------
    function Na__PlanAnnoEdit__HandleNodeKeyDown(event, annotationId) {
        if (Na__PlanAnnoEdit__EditingId !== annotationId) return;

        if (event.key === 'Enter') {
            event.preventDefault();                                              // <-- Single line label, not a paragraph
            Na__PlanAnnoEdit__CommitEdit();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            Na__PlanAnnoEdit__CancelEdit();
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Wire Interaction Onto a Freshly Built Label Node
    // ------------------------------------------------------------
    // Handed to the overlay as its onNodeCreated callback, so every node gets
    // its listeners exactly once at construction.
    // ------------------------------------------------------------
    function Na__PlanAnnoEdit__AttachNode(node, annotationId) {
        if (!node) return;

        node.classList.add(Na__PlanAnnoEdit__CLASS_EDITABLE);
        node.addEventListener('pointerdown', (event) => Na__PlanAnnoEdit__HandleNodePointerDown(event, annotationId));
        node.addEventListener('pointermove', (event) => Na__PlanAnnoEdit__HandleNodePointerMove(event, annotationId));
        node.addEventListener('pointerup',   (event) => Na__PlanAnnoEdit__HandleNodePointerUp(event, annotationId));
        node.addEventListener('pointercancel', (event) => Na__PlanAnnoEdit__HandleNodePointerUp(event, annotationId));
        node.addEventListener('dblclick',    (event) => Na__PlanAnnoEdit__HandleNodeDoubleClick(event, annotationId));
        node.addEventListener('keydown',     (event) => Na__PlanAnnoEdit__HandleNodeKeyDown(event, annotationId));
        node.addEventListener('blur',        () => {
            if (Na__PlanAnnoEdit__EditingId === annotationId) Na__PlanAnnoEdit__CommitEdit();
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Placement
// -----------------------------------------------------------------------------

    // SUB FUNCTION | Canvas Click While Placing - Drop a New Label
    // ------------------------------------------------------------
    function Na__PlanAnnoEdit__HandleCanvasClick(event) {
        if (!Na__PlanAnnoEdit__Enabled || !Na__PlanAnnoEdit__Placing) return;

        const camera = Na__FpCam__GetCamera();
        if (!camera) return;

        const world = Na__PlanAnnoLayer__ScreenToWorldMm(
            event.clientX, event.clientY, camera.position.x, camera.position.z
        );
        if (!world) return;

        Na__PlanAnnoHist__CaptureNow();                                          // <-- BEFORE the mutation
        const annotation = Na__PlanAnno__Create(Na__PlanAnnoLayer__GetAnnotations(), world.posXMm, world.posZMm, {});
        Na__PlanAnnoEdit__SetPlacing(false);
        if (!annotation) return;

        Na__PlanAnnoLayer__Rebuild();
        Na__PlanAnnoLayer__Sync();

        const newId = Na__PlanAnno__Read(annotation).id;
        if (Na__PlanAnno__GetInteractionSetup().selectOnPlace) {
            Na__PlanAnnoEdit__Select(newId);
            Na__PlanAnnoEdit__BeginEdit(newId);                                  // <-- Straight into typing the room name
        }
        Na__PlanAnnoEdit__NotifyChanged();
    }
    // ------------------------------------------------------------


    // FUNCTION | Arm or Disarm Placement of the Next Label
    // ------------------------------------------------------------
    function Na__PlanAnnoEdit__SetPlacing(placing) {
        Na__PlanAnnoEdit__Placing = (placing === true);
        if (Na__PlanAnnoEdit__Canvas) {
            Na__PlanAnnoEdit__Canvas.classList.toggle(Na__PlanAnnoEdit__CLASS_PLACING, Na__PlanAnnoEdit__Placing);
        }
        if (typeof Na__PlanAnnoEdit__OnChanged === 'function') Na__PlanAnnoEdit__OnChanged();
    }
    // ------------------------------------------------------------


    // FUNCTION | Is Placement Currently Armed?
    // ------------------------------------------------------------
    function Na__PlanAnnoEdit__IsPlacing() {
        return Na__PlanAnnoEdit__Placing;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Mutations and Enablement
// -----------------------------------------------------------------------------

    // FUNCTION | Delete the Selected Label
    // ------------------------------------------------------------
    function Na__PlanAnnoEdit__DeleteSelected() {
        if (!Na__PlanAnnoEdit__SelectedId) return false;

        Na__PlanAnnoHist__CaptureNow();                                          // <-- BEFORE the mutation
        Na__PlanAnno__Delete(Na__PlanAnnoLayer__GetAnnotations(), Na__PlanAnnoEdit__SelectedId);
        Na__PlanAnnoEdit__SelectedId = null;
        Na__PlanAnnoEdit__EditingId  = null;

        Na__PlanAnnoLayer__Rebuild();
        Na__PlanAnnoEdit__NotifyChanged();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Change the Selected Label's Size or Weight
    // ------------------------------------------------------------
    // Takes a history baseline but does NOT commit it. Dragging the size field
    // fires a stream of input events, and one history entry per pixel would
    // make undo useless; the caller commits once the control settles.
    // ------------------------------------------------------------
    function Na__PlanAnnoEdit__UpdateSelected(changes) {
        if (!Na__PlanAnnoEdit__SelectedId) return false;

        Na__PlanAnnoHist__BeginPending();                                        // <-- Idempotent across the whole interaction
        Na__PlanAnno__Update(
            Na__PlanAnno__FindById(Na__PlanAnnoLayer__GetAnnotations(), Na__PlanAnnoEdit__SelectedId),
            changes
        );
        Na__PlanAnnoEdit__NotifyChanged();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Close Off a Run of Size or Weight Changes
    // ------------------------------------------------------------
    // Called when the control settles - a change event or a blur - so the whole
    // adjustment collapses into a single undo step.
    // ------------------------------------------------------------
    function Na__PlanAnnoEdit__CommitPendingEdit() {
        return Na__PlanAnnoHist__CommitPending();
    }
    // ------------------------------------------------------------


    // FUNCTION | Nudge the Selected Label's Size by One Config Step
    // ------------------------------------------------------------
    function Na__PlanAnnoEdit__StepSelectedSize(direction) {
        const selected = Na__PlanAnnoEdit__GetSelected();
        if (!selected) return false;

        const setup   = Na__PlanAnno__GetTextSetup();
        const stepped = Na__PlanAnnoEdit__UpdateSelected({
            sizeMm : selected.sizeMm + (setup.sizeStepMm * (direction < 0 ? -1 : 1))
        });
        Na__PlanAnnoHist__CommitPending();                                       // <-- One step is one atomic edit
        return stepped;
    }
    // ------------------------------------------------------------


    // FUNCTION | Enable Annotation Editing
    // ------------------------------------------------------------
    // context: { canvas, onChanged }
    // ------------------------------------------------------------
    function Na__PlanAnnoEdit__Enable(context) {
        if (!context || !context.canvas) return false;

        Na__PlanAnnoEdit__Canvas    = context.canvas;
        Na__PlanAnnoEdit__OnChanged = (typeof context.onChanged === 'function') ? context.onChanged : null;
        Na__PlanAnnoEdit__Enabled   = true;

        Na__PlanAnnoEdit__Canvas.addEventListener('click', Na__PlanAnnoEdit__HandleCanvasClick);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Disable Annotation Editing and Clear All State
    // ------------------------------------------------------------
    function Na__PlanAnnoEdit__Disable() {
        Na__PlanAnnoEdit__CommitEdit();                                          // <-- Never lose half-typed text on exit

        if (Na__PlanAnnoEdit__Canvas) {
            Na__PlanAnnoEdit__Canvas.removeEventListener('click', Na__PlanAnnoEdit__HandleCanvasClick);
            Na__PlanAnnoEdit__Canvas.classList.remove(Na__PlanAnnoEdit__CLASS_PLACING);
        }

        Na__PlanAnnoEdit__Enabled    = false;
        Na__PlanAnnoEdit__Placing    = false;
        Na__PlanAnnoEdit__SelectedId = null;
        Na__PlanAnnoEdit__DragId     = null;
        Na__PlanAnnoEdit__Canvas     = null;
        Na__PlanAnnoEdit__OnChanged  = null;

        Na__FpNav__SetSuppressed(false);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Redraw and Re-Notify After an External Mutation
    // ------------------------------------------------------------
    // The hotkeys module mutates through the data layer directly, so it needs a
    // way to bring the layer and the toolbar back in step afterwards.
    // ------------------------------------------------------------
    function Na__PlanAnnoEdit__Refresh() {
        Na__PlanAnnoEdit__NotifyChanged();
    }
    // ------------------------------------------------------------


    // FUNCTION | Is Annotation Editing Enabled?
    // ------------------------------------------------------------
    function Na__PlanAnnoEdit__IsEnabled() {
        return Na__PlanAnnoEdit__Enabled;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Plan Annotation Editor API
    // ------------------------------------------------------------
    export {
        Na__PlanAnnoEdit__Enable,
        Na__PlanAnnoEdit__Disable,
        Na__PlanAnnoEdit__IsEnabled,
        Na__PlanAnnoEdit__AttachNode,
        Na__PlanAnnoEdit__Select,
        Na__PlanAnnoEdit__GetSelected,
        Na__PlanAnnoEdit__BeginEdit,
        Na__PlanAnnoEdit__CommitEdit,
        Na__PlanAnnoEdit__CancelEdit,
        Na__PlanAnnoEdit__IsEditing,
        Na__PlanAnnoEdit__SetPlacing,
        Na__PlanAnnoEdit__IsPlacing,
        Na__PlanAnnoEdit__DeleteSelected,
        Na__PlanAnnoEdit__UpdateSelected,
        Na__PlanAnnoEdit__CommitPendingEdit,
        Na__PlanAnnoEdit__StepSelectedSize,
        Na__PlanAnnoEdit__Refresh
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
