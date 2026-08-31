// =============================================================================
// TRUEVISION3D - PLAN DIMENSIONS - CLIENT MEASURING MODE
// =============================================================================
//
// FILE       : Na__PlanDimensions__ClientMode__.js
// NAMESPACE  : Na__PlanDimClient
// MODULE     : Plan Dimensions - Client Measuring Mode
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Gate, disclaim and present the measuring tool in the live app
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - Client measuring runs on EXACTLY the same dimensioning engine as the
//   developer tool. There is no second implementation, so a change to how
//   dimensions snap, constrain or draw reaches both sides at once. This module
//   adds only the three things that must differ, and nothing else:
//
//     1. THE DISCLAIMER. Nothing can be measured until it has been accepted.
//     2. THE COLOUR. Client measurements are forced red by the data layer, so
//        one can never be mistaken for an issued dimension.
//     3. THE STORAGE. Client work goes to an ephemeral session list that is
//        not attached to any plan record, so there is nothing for a save to
//        write and no way for it to reach project data.
//
// - Issued dimensions stay visible and stay read-only: the editor declines to
//   wire any interaction onto a record the current author may not edit, so a
//   client can measure over a drawing without being able to alter it.
//
// - Access is granted per project from the Dev menu. With it off, this module
//   mounts nothing at all and the live app behaves exactly as it did before.
//
// INTEGRATION:
// - Na__FloorPlan__ModeController__ calls Mount when a plan opens for a
//   non-developer, and Unmount on leaving.
// - Na__PlanDimensions__Disclaimer__ provides the modal this gate shows.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 31-Aug-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Render Loop
    // ------------------------------------------------------------
    import { Na__RenderLoop__RequestRender } from '../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Dimension Data, Editor, Overlay, History, Disclaimer
    // ------------------------------------------------------------
    // @delegate: ./Na__PlanDimensions__Data__.js
    // @delegate: ./Na__PlanDimensions__Disclaimer__.js
    // ------------------------------------------------------------
    import {
        Na__PlanDim__AUTHOR_CLIENT,
        Na__PlanDim__AUTHOR_DEV,
        Na__PlanDim__SetAuthoringMode,
        Na__PlanDim__GetSessionDimensions,
        Na__PlanDim__ClearSessionDimensions,
        Na__PlanDim__GetClientModeSetup,
        Na__PlanDim__GetLabel
    } from './Na__PlanDimensions__Data__.js';
    import {
        Na__PlanDimEdit__ArmPlacement,
        Na__PlanDimEdit__SetPlacementGate,
        Na__PlanDimEdit__CancelPlacement,
        Na__PlanDimEdit__IsPlacing,
        Na__PlanDimEdit__GetSelectedId,
        Na__PlanDimEdit__DeleteSelected
    } from './Na__PlanDimensions__Editor__.js';
    import {
        Na__PlanDimLayer__Rebuild,
        Na__PlanDimLayer__Sync
    } from './Na__PlanDimensions__Overlay__.js';
    import {
        Na__PlanDimHist__Undo__Step,
        Na__PlanDimHist__CanUndo
    } from './Na__PlanDimensions__History__.js';
    import {
        Na__PlanDimDisc__Show,
        Na__PlanDimDisc__HasAccepted,
        Na__PlanDimDisc__Dispose
    } from './Na__PlanDimensions__Disclaimer__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | DOM Identifiers
    // ------------------------------------------------------------
    const Na__PlanDimClient__BAR_ID    = 'naPlanDimClientBar';
    const Na__PlanDimClient__BAR_CLASS = 'na-plan-dim__client-bar';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Gate and Mounted Bar
    // ------------------------------------------------------------
    let Na__PlanDimClient__Allowed   = false;  // <-- Per-project grant from the Dev menu
    let Na__PlanDimClient__Bar       = null;
    let Na__PlanDimClient__MeasureBtn = null;
    let Na__PlanDimClient__ClearBtn  = null;
    let Na__PlanDimClient__UndoBtn   = null;
    let Na__PlanDimClient__CountEl   = null;
    let Na__PlanDimClient__OnChanged = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Access Gate
// -----------------------------------------------------------------------------

    // FUNCTION | Grant or Withhold Client Measuring for This Project
    // ------------------------------------------------------------
    // Driven by the per-project Dev menu toggle. Off by default, so a project
    // that has never been considered never exposes the tool.
    // ------------------------------------------------------------
    function Na__PlanDimClient__SetAllowed(allowed) {
        Na__PlanDimClient__Allowed = (allowed === true);
        return Na__PlanDimClient__Allowed;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is Client Measuring Granted?
    // ------------------------------------------------------------
    function Na__PlanDimClient__IsAllowed() {
        return Na__PlanDimClient__Allowed === true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Bar Construction
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build One Bar Button
    // ------------------------------------------------------------
    function Na__PlanDimClient__BuildButton(text, modifierClass, onClick) {
        const button = document.createElement('button');
        button.type        = 'button';
        button.className   = 'na-plan-dim__client-btn' + (modifierClass ? ' ' + modifierClass : '');
        button.textContent = text;
        button.addEventListener('click', onClick);
        return button;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Assemble the Client Measuring Bar
    // ------------------------------------------------------------
    function Na__PlanDimClient__BuildBar() {
        const bar = document.createElement('div');
        bar.id        = Na__PlanDimClient__BAR_ID;
        bar.className = Na__PlanDimClient__BAR_CLASS;
        bar.setAttribute('role', 'toolbar');
        bar.setAttribute('aria-label', Na__PlanDim__GetLabel('ClientBarAriaLabel', 'Measuring tool'));

        // MEASURE | Arms the same two-click placement the developer tool uses
        Na__PlanDimClient__MeasureBtn = Na__PlanDimClient__BuildButton(
            Na__PlanDim__GetLabel('ClientMeasureLabel', 'Measure'),
            'na-plan-dim__client-btn--primary',
            Na__PlanDimClient__ToggleMeasure
        );
        bar.appendChild(Na__PlanDimClient__MeasureBtn);

        const setup = Na__PlanDim__GetClientModeSetup();

        if (setup.allowUndo) {
            Na__PlanDimClient__UndoBtn = Na__PlanDimClient__BuildButton(
                Na__PlanDim__GetLabel('ClientUndoLabel', 'Undo'), '',
                Na__PlanDimClient__Undo
            );
            bar.appendChild(Na__PlanDimClient__UndoBtn);
        }

        if (setup.allowDelete) {
            Na__PlanDimClient__ClearBtn = Na__PlanDimClient__BuildButton(
                Na__PlanDim__GetLabel('ClientClearLabel', 'Clear all'), '',
                Na__PlanDimClient__ClearAll
            );
            bar.appendChild(Na__PlanDimClient__ClearBtn);
        }

        Na__PlanDimClient__CountEl = document.createElement('span');
        Na__PlanDimClient__CountEl.className = 'na-plan-dim__client-note';
        bar.appendChild(Na__PlanDimClient__CountEl);

        return bar;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Actions
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Report a Change and Redraw
    // ------------------------------------------------------------
    function Na__PlanDimClient__Notify() {
        Na__RenderLoop__RequestRender();
        Na__PlanDimClient__Refresh();
        if (typeof Na__PlanDimClient__OnChanged === 'function') Na__PlanDimClient__OnChanged();
    }
    // ------------------------------------------------------------


    // FUNCTION | Arm or Disarm Measuring, Behind the Disclaimer
    // ------------------------------------------------------------
    // THE DISCLAIMER IS THE GATE. Placement is only ever armed from inside the
    // accept callback, so there is no ordering in which a measurement can be
    // taken before the notice has been agreed to.
    // ------------------------------------------------------------
    function Na__PlanDimClient__ToggleMeasure() {
        if (Na__PlanDimEdit__IsPlacing()) {
            Na__PlanDimEdit__CancelPlacement();
            Na__PlanDimClient__Notify();
            return;
        }
        Na__PlanDimClient__RequestPlacement();
    }
    // ------------------------------------------------------------


    // FUNCTION | The Placement Gate - Shows the Notice, Then Arms
    // ------------------------------------------------------------
    // Registered with the editor, so EVERY route into placement passes through
    // it: the Measure button, the D hotkey, and anything added later. Arming
    // happens only inside the accept callback, so there is no sequence of
    // clicks or keystrokes that reaches the tool ahead of the notice.
    // ------------------------------------------------------------
    function Na__PlanDimClient__RequestPlacement() {
        const setup = Na__PlanDim__GetClientModeSetup();
        const needsNotice = setup.requireDisclaimer
            && !(setup.disclaimerOnce && Na__PlanDimDisc__HasAccepted());

        if (!needsNotice) {
            const armed = Na__PlanDimEdit__ArmPlacement();
            Na__PlanDimClient__Notify();
            return armed;
        }

        Na__PlanDimDisc__Show({
            onAccept : () => {
                Na__PlanDimEdit__ArmPlacement();
                Na__PlanDimClient__Notify();
            },
            onDecline : Na__PlanDimClient__Notify
        });
        return true;                                                             // <-- Handled; the modal owns it from here
    }
    // ------------------------------------------------------------


    // FUNCTION | Undo the Client's Last Measurement
    // ------------------------------------------------------------
    function Na__PlanDimClient__Undo() {
        if (!Na__PlanDimHist__Undo__Step()) return false;
        Na__PlanDimLayer__Rebuild();
        Na__PlanDimLayer__Sync();
        Na__PlanDimClient__Notify();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Discard Every Client Measurement
    // ------------------------------------------------------------
    function Na__PlanDimClient__ClearAll() {
        if (Na__PlanDimEdit__IsPlacing()) Na__PlanDimEdit__CancelPlacement();
        if (Na__PlanDimEdit__GetSelectedId() !== null) Na__PlanDimEdit__DeleteSelected();

        Na__PlanDim__ClearSessionDimensions();
        Na__PlanDimLayer__Rebuild();
        Na__PlanDimLayer__Sync();
        Na__PlanDimClient__Notify();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Sync the Bar With the Current State
    // ------------------------------------------------------------
    function Na__PlanDimClient__Refresh() {
        if (!Na__PlanDimClient__Bar) return;

        const placing = Na__PlanDimEdit__IsPlacing();
        const count   = Na__PlanDim__GetSessionDimensions().length;

        if (Na__PlanDimClient__MeasureBtn) {
            Na__PlanDimClient__MeasureBtn.classList.toggle('is-active', placing);
            Na__PlanDimClient__MeasureBtn.textContent = placing
                ? Na__PlanDim__GetLabel('ClientCancelLabel', 'Cancel')
                : Na__PlanDim__GetLabel('ClientMeasureLabel', 'Measure');
        }
        if (Na__PlanDimClient__UndoBtn)  Na__PlanDimClient__UndoBtn.disabled  = !Na__PlanDimHist__CanUndo();
        if (Na__PlanDimClient__ClearBtn) Na__PlanDimClient__ClearBtn.disabled = count === 0;

        if (Na__PlanDimClient__CountEl) {
            Na__PlanDimClient__CountEl.textContent = placing
                ? Na__PlanDim__GetLabel('ClientPlaceHint', 'Click the start point, then the end point.')
                : (count === 0
                    ? Na__PlanDim__GetLabel('ClientEmptyHint', 'Measurements are indicative and are not saved.')
                    : Na__PlanDim__GetLabel('ClientCountHint', 'Not saved - your measurements clear when you leave.'));
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Mount and Teardown
// -----------------------------------------------------------------------------

    // FUNCTION | Mount the Client Measuring Bar
    // ------------------------------------------------------------
    // context: { hostElement, onChanged }
    // Returns false when measuring is not granted for this project, in which
    // case nothing is created and the live app is untouched.
    // ------------------------------------------------------------
    function Na__PlanDimClient__Mount(context) {
        if (!Na__PlanDimClient__Allowed) return false;
        if (!context || !context.hostElement) return false;

        Na__PlanDimClient__Unmount();

        Na__PlanDimClient__OnChanged = (typeof context.onChanged === 'function') ? context.onChanged : null;

        // Everything drawn from here on is a client measurement.
        Na__PlanDim__SetAuthoringMode(Na__PlanDim__AUTHOR_CLIENT);
        Na__PlanDimEdit__SetPlacementGate(Na__PlanDimClient__RequestPlacement);

        Na__PlanDimClient__Bar = Na__PlanDimClient__BuildBar();
        context.hostElement.appendChild(Na__PlanDimClient__Bar);

        Na__PlanDimClient__Refresh();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remove the Bar and Discard the Session
    // ------------------------------------------------------------
    // Measurements are dropped on the way out. They were never saved, and
    // leaving them behind would let one visitor's scratch work appear over a
    // plan someone else opens next.
    // ------------------------------------------------------------
    function Na__PlanDimClient__Unmount() {
        if (Na__PlanDimClient__Bar && Na__PlanDimClient__Bar.parentElement) {
            Na__PlanDimClient__Bar.parentElement.removeChild(Na__PlanDimClient__Bar);
        }

        Na__PlanDimClient__Bar        = null;
        Na__PlanDimClient__MeasureBtn = null;
        Na__PlanDimClient__ClearBtn   = null;
        Na__PlanDimClient__UndoBtn    = null;
        Na__PlanDimClient__CountEl    = null;
        Na__PlanDimClient__OnChanged  = null;

        Na__PlanDimEdit__SetPlacementGate(null);                                 // <-- Developer path has no gate
        Na__PlanDim__ClearSessionDimensions();
        Na__PlanDim__SetAuthoringMode(Na__PlanDim__AUTHOR_DEV);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the Client Bar Mounted?
    // ------------------------------------------------------------
    function Na__PlanDimClient__IsMounted() {
        return Na__PlanDimClient__Bar !== null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Tear Down Entirely
    // ------------------------------------------------------------
    function Na__PlanDimClient__Dispose() {
        Na__PlanDimClient__Unmount();
        Na__PlanDimDisc__Dispose();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Client Measuring Mode API
    // ------------------------------------------------------------
    export {
        Na__PlanDimClient__SetAllowed,
        Na__PlanDimClient__IsAllowed,
        Na__PlanDimClient__Mount,
        Na__PlanDimClient__Unmount,
        Na__PlanDimClient__IsMounted,
        Na__PlanDimClient__Refresh,
        Na__PlanDimClient__ClearAll,
        Na__PlanDimClient__Dispose
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
