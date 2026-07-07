// =============================================================================
// NOBLE CAD AUDIT TOOLS - EVENT BUS
// =============================================================================
//
// FILE      : Na__AppCore__EventBus__.js
// NAMESPACE : CadAuditTools.AppCore
// MODULE    : EventBus
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Lightweight publish/subscribe event bus for inter-module communication
// CREATED   : 07-Jul-2026
//
// DESCRIPTION:
// - Provides a central EventBus instance passed to all modules at construction time.
// - Modules subscribe to named events via .on() and publish them via .emit().
// - Decouples modules: no direct references between siblings, only EventBus.
// - Supports optional one-time listeners via .once().
//
// EVENTS EMITTED BY OTHER MODULES (for documentation):
//   file:loaded          — { filename, entityCount, layers }  — EntityLoader
//   file:cleared         — {}                                 — UploadPanel
//   selection:changed    — entity[]                           — SelectionManager
//   tool:changed         — { tool: string }                   — Toolbar
//   zoom:changed         — { scale, offsetX, offsetY }        — ViewBoxController
//   entity:deleted       — { handles: string[] }              — SelectionManager
//   status:update        — { zoom, cursor, selected, total }  — various
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jul-2026 - Version 0.1.0
// - Initial scaffold release.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | EventBus Class
// -----------------------------------------------------------------------------

    export class Na__AppCore__EventBus {

        // SUB FUNCTION | Constructor
        // ------------------------------------------------------------
        constructor() {
            this._listeners = new Map(); // <-- { eventName → Set<Function> }
        }
        // ------------------------------------------------------------


        // FUNCTION | Subscribe to a Named Event
        // ------------------------------------------------------------
        on(event, handler) {
            if (!this._listeners.has(event)) {
                this._listeners.set(event, new Set());
            }
            this._listeners.get(event).add(handler); // <-- Add handler to event's subscriber set
        }
        // ------------------------------------------------------------


        // FUNCTION | Subscribe Once — Auto-Removes After First Fire
        // ------------------------------------------------------------
        once(event, handler) {
            const wrapper = (...args) => {
                handler(...args);
                this.off(event, wrapper);             // <-- Unsubscribe after first invocation
            };
            this.on(event, wrapper);
        }
        // ------------------------------------------------------------


        // FUNCTION | Unsubscribe a Handler from an Event
        // ------------------------------------------------------------
        off(event, handler) {
            const handlers = this._listeners.get(event);
            if (handlers) handlers.delete(handler);  // <-- Remove specific handler from set
        }
        // ------------------------------------------------------------


        // FUNCTION | Emit an Event — Call All Registered Handlers
        // ------------------------------------------------------------
        emit(event, ...args) {
            const handlers = this._listeners.get(event);
            if (!handlers || handlers.size === 0) return; // <-- No subscribers — nothing to do
            handlers.forEach((handler) => {
                try {
                    handler(...args);                 // <-- Invoke each subscriber handler
                } catch (err) {
                    console.error(`[EventBus] Error in handler for event "${event}":`, err);
                }
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | Remove All Handlers for an Event (or All Events)
        // ------------------------------------------------------------
        clear(event) {
            if (event) {
                this._listeners.delete(event);        // <-- Clear specific event
            } else {
                this._listeners.clear();              // <-- Clear all events
            }
        }
        // ------------------------------------------------------------

    }

// endregion -------------------------------------------------------------------
