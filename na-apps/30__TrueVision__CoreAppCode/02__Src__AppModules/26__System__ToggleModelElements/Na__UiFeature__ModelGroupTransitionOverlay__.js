// =============================================================================
// TRUEVISION3D - MODEL GROUP TRANSITION OVERLAY
// =============================================================================
//
// FILE       : Na__UiFeature__ModelGroupTransitionOverlay__.js
// NAMESPACE  : Na__UiFeature
// MODULE     : ModelGroupTransitionOverlay
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Show a loading overlay while switching design phase model groups
// CREATED    : 21-Jun-2026
//
// DESCRIPTION:
// - Controls the #naModelGroupTransitionOverlay element defined in Index.html.
// - Displays a Vale branded spinner while a new model group (design phase) loads.
// - Large GLB model sets can take a while to swap; this gives the user clear
//   visual feedback that the transition is in progress.
// - Reuses the shared .loading-spinner styling from the initial loader.
// - Pure DOM manipulation module; no external module dependencies.
//
// -----
//
// DEVELOPMENT LOG:
// 21-Jun-2026 - Version 1.0.0
// - Initial release.
// - Show / UpdateStatus / Hide overlay control for design phase switching.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | DOM Element IDs and CSS Class Modifiers
    // ------------------------------------------------------------
    const Na__TransitionOverlay__OverlayId   = 'naModelGroupTransitionOverlay';
    const Na__TransitionOverlay__LabelId      = 'naModelGroupTransitionLabel';
    const Na__TransitionOverlay__StatusId     = 'naModelGroupTransitionStatus';
    const Na__TransitionOverlay__VisibleClass = 'na-model-group-transition-overlay--visible';
    const Na__TransitionOverlay__FadeOutClass = 'na-model-group-transition-overlay--fade-out';
    const Na__TransitionOverlay__FadeFallback = 400;                       // <-- Fade-out fallback timeout (ms)
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Overlay Control
// -----------------------------------------------------------------------------

    // FUNCTION | Show the Transition Overlay with a Phase Label
    // ------------------------------------------------------------
    function Na__ModelGroupTransitionOverlay__Show(groupLabel) {
        const overlay = document.getElementById(Na__TransitionOverlay__OverlayId);
        if (!overlay) return;

        const label = document.getElementById(Na__TransitionOverlay__LabelId);
        if (label) {
            const name = groupLabel || 'design phase';
            label.textContent = `Loading ${name}...`;                      // <-- Set primary phase message
        }

        const status = document.getElementById(Na__TransitionOverlay__StatusId);
        if (status) status.textContent = '';                               // <-- Clear stale status text

        overlay.classList.remove(Na__TransitionOverlay__FadeOutClass);     // <-- Cancel any in-progress fade-out
        overlay.classList.add(Na__TransitionOverlay__VisibleClass);        // <-- Reveal overlay
    }
    // ------------------------------------------------------------


    // FUNCTION | Update the Overlay Progress Status Text
    // ------------------------------------------------------------
    function Na__ModelGroupTransitionOverlay__UpdateStatus(message) {
        const status = document.getElementById(Na__TransitionOverlay__StatusId);
        if (!status) return;

        status.textContent = message || '';                                // <-- Update supporting progress text
    }
    // ------------------------------------------------------------


    // FUNCTION | Hide the Transition Overlay with a Fade-Out
    // ------------------------------------------------------------
    function Na__ModelGroupTransitionOverlay__Hide() {
        const overlay = document.getElementById(Na__TransitionOverlay__OverlayId);
        if (!overlay) return;

        overlay.classList.add(Na__TransitionOverlay__FadeOutClass);        // <-- Trigger CSS opacity fade

        let hasCleared = false;                                            // <-- Guard against double cleanup

        const clearOverlay = () => {
            if (hasCleared) return;
            hasCleared = true;
            overlay.classList.remove(Na__TransitionOverlay__VisibleClass); // <-- Remove display:flex
            overlay.classList.remove(Na__TransitionOverlay__FadeOutClass); // <-- Reset fade state for next show
            overlay.removeEventListener('transitionend', onTransitionEnd);
        };

        const onTransitionEnd = (event) => {
            if (event.target !== overlay) return;                          // <-- Ignore bubbled child transitions
            clearOverlay();
        };

        overlay.addEventListener('transitionend', onTransitionEnd);
        window.setTimeout(clearOverlay, Na__TransitionOverlay__FadeFallback); // <-- Fallback if transitionend never fires
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Model Group Transition Overlay API
    // ------------------------------------------------------------
    export {
        Na__ModelGroupTransitionOverlay__Show,
        Na__ModelGroupTransitionOverlay__UpdateStatus,
        Na__ModelGroupTransitionOverlay__Hide
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
