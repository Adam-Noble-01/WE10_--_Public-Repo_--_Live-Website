/* =============================================================================
   NOBLE BIM ASSET TOOLS | APPLICATION CORE - EVENT BUS
   =============================================================================

   FILE       : Na__AppCore__EventBus__.mjs
   NAMESPACE  : Na__BimAssetTools
   MODULE     : AppCore - EventBus
   AUTHOR     : Adam Noble - Noble Architecture
   PURPOSE    : Decoupled publish and subscribe messaging between application modules
   CREATED    : 14-Aug-2026

   DESCRIPTION:
   - The loaders, the viewer, the audit engine and the UI panels never import one
     another. They all talk through this bus, so a loader can be swapped or a panel
     removed without touching anything else.
   - Event names are declared once in the EVENTS table below. Nothing publishes a
     string literal; a typo then fails loudly at import rather than silently never
     firing, which is the usual way a pub/sub app rots.

   ============================================================================= */

// =============================================================================
// REGION | Event Name Registry
// =============================================================================

    // MODULE CONSTANTS | Every Event the Application Can Publish
    // ------------------------------------------------------------
    export const EVENTS = Object.freeze({
        CONFIG_READY        :  'na:config-ready',            // <-- AppConfig and FormatRegistry parsed
        FILES_QUEUED        :  'na:files-queued',            // <-- User dropped or picked files
        LOAD_STARTED        :  'na:load-started',            // <-- A single asset began loading
        LOAD_PROGRESS       :  'na:load-progress',           // <-- Percentage update during a load
        LOAD_COMPLETED      :  'na:load-completed',          // <-- Asset parsed and added to the scene
        LOAD_FAILED         :  'na:load-failed',             // <-- Asset could not be parsed
        ASSET_SELECTED      :  'na:asset-selected',          // <-- Active asset changed in the browser list
        AUDIT_COMPLETED     :  'na:audit-completed',         // <-- Geometry audit finished for an asset
        UNIT_OVERRIDDEN     :  'na:unit-overridden',         // <-- User corrected an assumed source unit
        DISPLAY_MODE_CHANGED:  'na:display-mode-changed',    // <-- Shaded / wireframe / xray switch
        EXPORT_STARTED      :  'na:export-started',          // <-- GLB write began
        EXPORT_COMPLETED    :  'na:export-completed',        // <-- GLB written and verified
        EXPORT_FAILED       :  'na:export-failed',           // <-- GLB write or verification failed
        STATUS_MESSAGE      :  'na:status-message',          // <-- Transient line for the status bar
        NOTIFY              :  'na:notify'                   // <-- Toast notification request
    });
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Bus Implementation
// =============================================================================

// -----------------------------------------------------------------------------
// REGION | Internal Subscriber Store
// -----------------------------------------------------------------------------

    // MODULE STATE | Event Name to Handler Set
    // ------------------------------------------------------------
    const SUBSCRIBERS  =  new Map();                                             // <-- eventName -> Set of handler functions
    const VALID_EVENTS =  new Set(Object.values(EVENTS));                        // <-- Guards against unregistered names
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reject Any Event Name Not Declared in the Registry
    // ------------------------------------------------------------
    function Na__EventBus__AssertKnownEvent(eventName) {
        if (VALID_EVENTS.has(eventName)) return;
        throw new Error(`[Na EventBus] Unknown event "${eventName}". Add it to the EVENTS table before using it.`);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public Bus API
// -----------------------------------------------------------------------------

    // FUNCTION | Subscribe to an Event, Returning an Unsubscribe Handle
    // ------------------------------------------------------------
    export function Subscribe(eventName, handler) {
        Na__EventBus__AssertKnownEvent(eventName);
        if (typeof handler !== 'function') throw new Error('[Na EventBus] Handler must be a function.');

        if (!SUBSCRIBERS.has(eventName)) SUBSCRIBERS.set(eventName, new Set());
        SUBSCRIBERS.get(eventName).add(handler);

        return function Na__EventBus__Unsubscribe() {                            // <-- Caller keeps this to detach later
            const handlers = SUBSCRIBERS.get(eventName);
            if (handlers) handlers.delete(handler);
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Publish an Event to Every Current Subscriber
    // ------------------------------------------------------------
    // Handlers are copied before iteration so a handler that unsubscribes itself
    // mid-dispatch cannot corrupt the loop. One throwing handler is logged and
    // stepped over rather than being allowed to abort the remaining subscribers.
    export function Publish(eventName, payload) {
        Na__EventBus__AssertKnownEvent(eventName);

        const handlers = SUBSCRIBERS.get(eventName);
        if (!handlers || handlers.size === 0) return;

        for (const handler of Array.from(handlers)) {
            try {
                handler(payload);
            } catch (err) {
                console.error(`[Na EventBus] Subscriber of "${eventName}" threw and was skipped.`, err);
            }
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Subscribe for a Single Dispatch Then Detach Automatically
    // ------------------------------------------------------------
    export function SubscribeOnce(eventName, handler) {
        const detach = Subscribe(eventName, function Na__EventBus__OnceWrapper(payload) {
            detach();
            handler(payload);
        });
        return detach;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remove Every Subscriber - Test Teardown Only
    // ------------------------------------------------------------
    export function ClearAllSubscribers() {
        SUBSCRIBERS.clear();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

// endregion -------------------------------------------------------------------
