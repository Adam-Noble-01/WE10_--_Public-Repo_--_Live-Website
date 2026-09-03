// =============================================================================
// NOBLE CAD AUDIT TOOLS - CONNECTION MONITOR
// =============================================================================
//
// FILE      : Na__AppCore__ConnectionMonitor__.js
// NAMESPACE : CadAuditTools.AppCore
// MODULE    : ConnectionMonitor
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Watchdog for the local server — never let a save fail silently
// CREATED   : 01-Sep-2026
//
// DESCRIPTION:
// - Polls /api/health on an interval and tracks whether the local Python server
//   is actually reachable. Every request is bounded by an AbortController
//   timeout, so a HUNG server counts as down just like a refused connection.
// - A single dropped poll does not raise the alarm; the monitor waits for
//   Failure__ThresholdCount consecutive failures before declaring the link
//   lost. This stops the banner flickering when one request is merely slow.
// - Emits 'connection:lost' and 'connection:restored' on the shared EventBus.
//   The banner listens for these; so does anything that needs to react.
// - Na__ConnectionMonitor__Preflight() is the important one: call it BEFORE any
//   write request. It performs a live check (not a cached verdict) and returns
//   a plain { ok, reason } so the caller can abort loudly instead of firing a
//   request into a dead socket and leaving the user staring at an idle screen.
// - Browser 'offline'/'online' events short-circuit the poll for instant
//   detection when the whole network stack drops.
//
// CONFIG (Na__AppData__AppConfig__.json → Config__Connection):
//   Health__Endpoint · Poll__IntervalMs · Poll__TimeoutMs
//   Failure__ThresholdCount · Recheck__OnWindowFocus
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 01-Sep-2026 - Version 0.5.0
// - Initial release — health polling, consecutive-failure debounce, preflight
//   gate for write requests, and connection:lost / connection:restored events.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    const NA__CONNECTION__DEFAULTS = {
        Health__Endpoint        : '/api/health',
        Poll__IntervalMs        : 5000,
        Poll__TimeoutMs         : 4000,
        Failure__ThresholdCount : 2,
        Recheck__OnWindowFocus  : true,
    };

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | ConnectionMonitor Class
// -----------------------------------------------------------------------------

    export class Na__AppCore__ConnectionMonitor {

        // SUB FUNCTION | Constructor
        // ------------------------------------------------------------
        constructor(eventBus, config = {}) {
            this._eventBus = eventBus;
            this._config   = { ...NA__CONNECTION__DEFAULTS, ...(config || {}) };

            this._isOnline     = true;                                   // <-- Assume good until proven otherwise
            this._failureCount = 0;                                      // <-- Consecutive failed polls
            this._lastReason   = '';                                     // <-- Why the link was declared down
            this._timerId      = null;
            this._inFlight     = false;                                  // <-- One poll at a time

            this._bindBrowserEvents();
        }
        // ------------------------------------------------------------


        // FUNCTION | Begin Polling the Health Endpoint
        // ------------------------------------------------------------
        Na__ConnectionMonitor__Start() {
            if (this._timerId) return;                                   // <-- Already running

            this._timerId = setInterval(() => this._poll(), this._config.Poll__IntervalMs);
            this._poll();                                                // <-- Do not wait a full interval for the first verdict
            console.log('[Na__ConnectionMonitor] Watching', this._config.Health__Endpoint,
                        `every ${this._config.Poll__IntervalMs}ms`);
        }
        // ------------------------------------------------------------


        // FUNCTION | Stop Polling
        // ------------------------------------------------------------
        Na__ConnectionMonitor__Stop() {
            if (!this._timerId) return;
            clearInterval(this._timerId);
            this._timerId = null;
        }
        // ------------------------------------------------------------


        // FUNCTION | Current Verdict — Cached, Cheap, Non-Blocking
        // ------------------------------------------------------------
        Na__ConnectionMonitor__IsOnline() {
            return this._isOnline;
        }
        // ------------------------------------------------------------


        // FUNCTION | Live Check — Bypasses the Cache, Updates State
        // ------------------------------------------------------------
        async Na__ConnectionMonitor__CheckNow() {
            await this._poll(true);                                      // <-- force: ignore the in-flight guard
            return this._isOnline;
        }
        // ------------------------------------------------------------


        // FUNCTION | Gate a Write Request — Call This BEFORE Saving/Exporting
        // ------------------------------------------------------------
        //           Returns { ok:true } when the server answered just now, or
        //           { ok:false, reason } describing exactly what went wrong.
        //           Always performs a LIVE check — a stale "online" verdict is
        //           worse than no verdict when a 130MB write is about to start.
        // ------------------------------------------------------------
        async Na__ConnectionMonitor__Preflight() {
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                this._markOffline('This device reports no network connection.');
                return { ok: false, reason: this._lastReason };
            }

            const result = await this._probe();
            if (result.ok) {
                this._markOnline();
                return { ok: true };
            }

            this._markOffline(result.reason);                            // <-- Preflight failure is definitive
            return { ok: false, reason: result.reason };
        }
        // ------------------------------------------------------------


        // FUNCTION | Human-Readable Reason the Link Is Considered Down
        // ------------------------------------------------------------
        Na__ConnectionMonitor__LastReason() {
            return this._lastReason || 'The local server is not responding.';
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | One Poll Cycle with Failure Debouncing
        // ------------------------------------------------------------
        async _poll(force = false) {
            if (this._inFlight && !force) return;                        // <-- Never stack polls on a slow server
            this._inFlight = true;

            try {
                const result = await this._probe();

                if (result.ok) {
                    this._failureCount = 0;
                    this._markOnline();
                    return;
                }

                this._failureCount += 1;
                if (this._failureCount >= this._config.Failure__ThresholdCount) {
                    this._markOffline(result.reason);                    // <-- Only after N consecutive misses
                }

            } finally {
                this._inFlight = false;
            }
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Single Health Request, Bounded by a Timeout
        // ------------------------------------------------------------
        async _probe() {
            const controller = new AbortController();
            const timer      = setTimeout(() => controller.abort(), this._config.Poll__TimeoutMs);

            try {
                const response = await fetch(
                    `${this._config.Health__Endpoint}?t=${Date.now()}`,  // <-- Cache-bust: a cached 200 proves nothing
                    { method: 'GET', cache: 'no-store', signal: controller.signal }
                );

                if (!response.ok) {
                    return { ok: false, reason: `The local server replied ${response.status}.` };
                }
                return { ok: true };

            } catch (err) {
                if (err.name === 'AbortError') {
                    return { ok: false, reason: `The local server did not respond within ${this._config.Poll__TimeoutMs}ms.` };
                }
                return { ok: false, reason: 'The local server is unreachable — it may have been closed.' };

            } finally {
                clearTimeout(timer);
            }
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Transition to Connected (Emits Only on Change)
        // ------------------------------------------------------------
        _markOnline() {
            this._failureCount = 0;
            if (this._isOnline) return;                                  // <-- No event churn while steady

            this._isOnline   = true;
            this._lastReason = '';
            console.log('[Na__ConnectionMonitor] Server connection restored');
            this._eventBus.emit('connection:restored', {});
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Transition to Disconnected (Emits Only on Change)
        // ------------------------------------------------------------
        _markOffline(reason) {
            this._lastReason = reason || 'The local server is not responding.';
            if (!this._isOnline) return;                                 // <-- Already reported

            this._isOnline = false;
            console.warn('[Na__ConnectionMonitor] Server connection lost:', this._lastReason);
            this._eventBus.emit('connection:lost', { reason: this._lastReason });
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Browser-Level Online/Offline and Focus Hooks
        // ------------------------------------------------------------
        _bindBrowserEvents() {
            window.addEventListener('offline', () => {
                this._markOffline('This device reports no network connection.');
            });

            window.addEventListener('online', () => {
                this._poll(true);                                        // <-- Confirm the SERVER is back, not just the NIC
            });

            if (this._config.Recheck__OnWindowFocus) {
                window.addEventListener('focus', () => this._poll(true)); // <-- Catch a server closed while tabbed away
            }
        }
        // ------------------------------------------------------------

    }

// endregion -------------------------------------------------------------------
