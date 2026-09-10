// =============================================================================
// TRUEVISION3D - RENDER LOOP INVALIDATION EVENTS
// =============================================================================

const NA__REQUEST_RENDER_EVENT = 'na-request-render';
const NA__REQUEST_ACTIVE_RENDER_EVENT = 'na-request-active-render';
const NA__STOP_ACTIVE_RENDER_EVENT = 'na-stop-active-render';

function Na__RenderLoop__RequestRender() {
    window.dispatchEvent(new CustomEvent(NA__REQUEST_RENDER_EVENT));
}

function Na__RenderLoop__RequestActiveRender(reason = 'general') {
    window.dispatchEvent(new CustomEvent(NA__REQUEST_ACTIVE_RENDER_EVENT, {
        detail: { reason }
    }));
}

function Na__RenderLoop__StopActiveRender(reason = 'general') {
    window.dispatchEvent(new CustomEvent(NA__STOP_ACTIVE_RENDER_EVENT, {
        detail: { reason }
    }));
}


// -----------------------------------------------------------------------------
// REGION | Render Loop Holds (Pause / Resume)
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Stacked Pause Reasons
    // ------------------------------------------------------------
    // A SET of reasons rather than a boolean, because more than one system can
    // want the loop stopped at once - the Layout Editor holding it while a sheet
    // is open, and an export holding it while it renders offscreen. With a
    // boolean, whichever finished first would resume the loop underneath the
    // other one.
    // ------------------------------------------------------------
    const Na__RenderLoop__PauseReasons = new Set();
    // ------------------------------------------------------------


    // FUNCTION | Hold the Render Loop
    // ------------------------------------------------------------
    // The loop keeps running and paints NOTHING while any hold is in place. It
    // is not stopped, because stopping it loses the timestamp: walk, fly and
    // door physics all integrate against a delta, and resuming after thirty
    // seconds of a sheet being open would hand them a thirty-second frame.
    // ------------------------------------------------------------
    function Na__RenderLoop__Pause(reason) {
        Na__RenderLoop__PauseReasons.add(reason || 'unnamed');
        return Na__RenderLoop__PauseReasons.size;
    }
    // ------------------------------------------------------------


    // FUNCTION | Release One Hold
    // ------------------------------------------------------------
    // Paints one frame when the last hold clears, so leaving a sheet does not
    // wait for the next thing that happens to request a render.
    // ------------------------------------------------------------
    function Na__RenderLoop__Resume(reason) {
        Na__RenderLoop__PauseReasons.delete(reason || 'unnamed');
        if (Na__RenderLoop__PauseReasons.size === 0) Na__RenderLoop__RequestRender();
        return Na__RenderLoop__PauseReasons.size;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is Any Hold in Place?
    // ------------------------------------------------------------
    function Na__RenderLoop__IsPaused() {
        return Na__RenderLoop__PauseReasons.size > 0;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


export {
    NA__REQUEST_RENDER_EVENT,
    NA__REQUEST_ACTIVE_RENDER_EVENT,
    NA__STOP_ACTIVE_RENDER_EVENT,
    Na__RenderLoop__RequestRender,
    Na__RenderLoop__RequestActiveRender,
    Na__RenderLoop__StopActiveRender,
    Na__RenderLoop__Pause,
    Na__RenderLoop__Resume,
    Na__RenderLoop__IsPaused
};
