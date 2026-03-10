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

export {
    NA__REQUEST_RENDER_EVENT,
    NA__REQUEST_ACTIVE_RENDER_EVENT,
    NA__STOP_ACTIVE_RENDER_EVENT,
    Na__RenderLoop__RequestRender,
    Na__RenderLoop__RequestActiveRender,
    Na__RenderLoop__StopActiveRender
};
