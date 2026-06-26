// =============================================================================
// VECTORFORGE - EVENT BUS
// =============================================================================
//
// FILE      : VF__AppCore__EventBus__.js
// NAMESPACE : VectorForge.AppCore
// MODULE    : EventBus
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Lightweight publish/subscribe event bus for decoupled communication
// CREATED   : 26-Jun-2026
//
// DESCRIPTION:
// - Central event hub used by all modules to communicate without direct coupling.
// - Modules emit named events with a data payload; any other module can subscribe.
// - All inter-module communication must go through this bus — never direct references.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 26-Jun-2026 - Version 1.0.0
// - Initial stable release. Refactored from prototype to ValeDesignSuite conventions.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | EventBus Class
// -----------------------------------------------------------------------------

    // CLASS | EventBus — Publish/Subscribe Event Hub
    // ------------------------------------------------------------
    export class EventBus {

        // FUNCTION | Constructor — Initialise Listener Registry
        // ------------------------------------------------------------
        constructor() {
            this.listeners = {}; // <-- Keyed by event name, value is array of callbacks
        }
        // ------------------------------------------------------------


        // FUNCTION | On — Subscribe to a Named Event
        // ------------------------------------------------------------
        on(event, callback) {
            if (!this.listeners[event]) this.listeners[event] = []; // <-- Initialise array if first subscriber
            this.listeners[event].push(callback);                   // <-- Register the callback
        }
        // ------------------------------------------------------------


        // FUNCTION | Emit — Publish an Event to All Subscribers
        // ------------------------------------------------------------
        emit(event, data) {
            if (this.listeners[event]) {
                this.listeners[event].forEach(cb => cb(data)); // <-- Invoke each registered callback
            }
        }
        // ------------------------------------------------------------

    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
