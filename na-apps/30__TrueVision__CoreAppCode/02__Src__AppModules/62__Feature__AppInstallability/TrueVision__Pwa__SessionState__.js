// =============================================================================
// TRUEVISION3D - PWA SESSION STATE TRACKER
// =============================================================================
//
// FILE       : TrueVision__Pwa__SessionState__.js
// NAMESPACE  : TrueVision3D
// MODULE     : TrueVision__Pwa__SessionState
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Persist install-prompt dismissal state with exponential snooze
// CREATED    : 27-Aug-2026
//
// DESCRIPTION:
// - Decides whether the install prompt is allowed to appear, and remembers
//   what the user already told us.
//
// - THE DISMISSAL POLICY IS DELIBERATELY DIFFERENT BY ENVIRONMENT:
//
//     LIVE SITE  - the offer comes back on every fresh visit. Clients rarely
//                  install the first time they are asked; they look at their
//                  model, come back a week later, and that second visit is
//                  when it lands. "Not Now" therefore only silences the
//                  prompt for the rest of that page load.
//
//     LOCALHOST  - dismissing stores a one week suppression. During
//                  development the app is reloaded dozens of times a day and
//                  a prompt on every single boot would be unbearable. A week
//                  is long enough to stay out of the way, short enough that
//                  the prompt resurfaces on its own and gets eyeballed
//                  occasionally to confirm it still works.
//                  Clear it early with TrueVision__Pwa__ResetInstallPrompt().
//
// - State is namespaced PER PROJECT as well as per platform. Declining the
//   install on one project must not silence the offer on a different project,
//   because each project is a separate installed app with its own icon.
//     state.perProject["26-RB05__WestFarm"].perPlatform["chromium-android"]
// - An actual install always wins on both environments: once the app has been
//   installed for a project, that project never offers again.
// - Falls back to in-memory storage when localStorage is unavailable (private
//   mode, sandboxed iframes) so the app never throws.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 27-Aug-2026 - Version 1.1.0
// - Replaced the escalating snooze ladder with the environment-driven policy
//   described above: always re-offer on the live site, suppress for a week on
//   localhost.
//
// 27-Aug-2026 - Version 1.0.0
// - Initial release, ported from the ValeVision3D / Whitecardopedia PWA stack
//   with the storage schema re-shaped around per-project namespacing.
//
// =============================================================================

(function () {

// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Storage Key and Schema Version
    // ------------------------------------------------------------
    const SESSION_STATE_STORAGE_KEY         = 'TrueVision__Pwa__SessionState__v1';                                                  // <-- localStorage key
    const SESSION_STATE_SCHEMA_VERSION      = 1;                                                                                    // <-- Schema version for future migrations
    const SESSION_STATE_FALLBACK_PROJECT    = 'no-project';                                                                         // <-- Namespace used when no project is selected
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Dismissal Suppression Windows (milliseconds)
    // ------------------------------------------------------------
    const SESSION_STATE_DEV_SNOOZE_MS       = 7 * 24 * 60 * 60 * 1000;                                                              // <-- Localhost: one week of quiet after a dismissal
    const SESSION_STATE_LIVE_SNOOZE_MS      = 0;                                                                                    // <-- Live site: this page load only, then offer again
    // ------------------------------------------------------------


    // MODULE VARIABLES | Fallback In-Memory Store
    // ------------------------------------------------------------
    let TrueVision__Pwa__SessionState__InMemoryFallback = null;                                                                     // <-- Used when localStorage is blocked
    // ------------------------------------------------------------


    // MODULE VARIABLES | Manual Override Flag
    // ------------------------------------------------------------
    // Raised for the duration of a deliberate "Install App" click from the
    // Tools menu. A client who asks for the prompt must always get it, no
    // matter how many times they previously said "Not Now".
    // ------------------------------------------------------------
    let TrueVision__Pwa__SessionState__ManualOverrideActive = false;                                                                // <-- True only inside a manual request
    // ------------------------------------------------------------


    // MODULE VARIABLES | Page-Load Dismissal Flag
    // ------------------------------------------------------------
    // Set when the user dismisses the prompt, cleared by the next page load
    // because it lives in memory. This is what stops the live site re-opening
    // the prompt in the same session while still offering it again on the next
    // visit.
    // ------------------------------------------------------------
    let TrueVision__Pwa__SessionState__DismissedThisPageLoad = false;                                                               // <-- Reset by any reload
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Storage Layer
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Probe localStorage Availability
    // ---------------------------------------------------------------
    function TrueVision__Pwa__SessionState__IsLocalStorageAvailable() {
        try {
            if (typeof window === 'undefined' || !window.localStorage) return false;                                                // <-- Guard non-window context
            const probeKey      = `${SESSION_STATE_STORAGE_KEY}__probe__`;                                                          // <-- Throwaway probe key
            window.localStorage.setItem(probeKey, '1');                                                                             // <-- Attempt a write
            window.localStorage.removeItem(probeKey);                                                                               // <-- Clean up the probe entry
            return true;                                                                                                            // <-- localStorage usable
        } catch (error) {
            return false;                                                                                                           // <-- localStorage blocked or full
        }
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Build an Empty State Object
    // ---------------------------------------------------------------
    function TrueVision__Pwa__SessionState__BuildEmptyState() {
        return {
            schemaVersion       : SESSION_STATE_SCHEMA_VERSION,
            globalSuppressUntil : null,                                                                                             // <-- Epoch ms; suppresses every project
            perProject          : {}                                                                                                // <-- Map: projectKey -> project state
        };
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Build an Empty Per-Project Entry
    // ---------------------------------------------------------------
    function TrueVision__Pwa__SessionState__BuildEmptyProjectEntry() {
        return {
            installCompletedAt  : null,                                                                                             // <-- Epoch ms when this project was installed
            perPlatform         : {}                                                                                                // <-- Map: platformId -> { dismissCount, snoozeUntil }
        };
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Resolve the Active Project Namespace Key
    // ---------------------------------------------------------------
    function TrueVision__Pwa__SessionState__GetProjectKey() {
        const contextModule = window.TrueVision__Pwa__ProjectContext || null;                                                       // <-- Project context helper
        if (!contextModule || !contextModule.getStorageKey) return SESSION_STATE_FALLBACK_PROJECT;                                  // <-- Degrade gracefully
        return contextModule.getStorageKey() || SESSION_STATE_FALLBACK_PROJECT;                                                     // <-- Stable per-project token
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Read Raw State from Storage
    // ---------------------------------------------------------------
    function TrueVision__Pwa__SessionState__ReadRawState() {
        if (!TrueVision__Pwa__SessionState__IsLocalStorageAvailable()) {
            if (!TrueVision__Pwa__SessionState__InMemoryFallback) {
                TrueVision__Pwa__SessionState__InMemoryFallback = TrueVision__Pwa__SessionState__BuildEmptyState();                  // <-- Lazy-init in-memory store
            }
            return TrueVision__Pwa__SessionState__InMemoryFallback;                                                                 // <-- Use in-memory state
        }

        try {
            const rawValue      = window.localStorage.getItem(SESSION_STATE_STORAGE_KEY);                                           // <-- Read raw JSON
            if (!rawValue) return TrueVision__Pwa__SessionState__BuildEmptyState();                                                 // <-- Initialise on first run

            const parsedValue   = JSON.parse(rawValue);                                                                             // <-- Parse the JSON value

            if (!parsedValue || parsedValue.schemaVersion !== SESSION_STATE_SCHEMA_VERSION) {
                return TrueVision__Pwa__SessionState__BuildEmptyState();                                                            // <-- Reset on schema mismatch
            }

            if (!parsedValue.perProject || typeof parsedValue.perProject !== 'object') {
                parsedValue.perProject = {};                                                                                        // <-- Repair a missing map
            }

            return parsedValue;                                                                                                     // <-- Return the live state
        } catch (error) {
            return TrueVision__Pwa__SessionState__BuildEmptyState();                                                                // <-- Reset on parse failure
        }
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Write Raw State to Storage
    // ---------------------------------------------------------------
    function TrueVision__Pwa__SessionState__WriteRawState(stateObject) {
        if (!TrueVision__Pwa__SessionState__IsLocalStorageAvailable()) {
            TrueVision__Pwa__SessionState__InMemoryFallback = stateObject;                                                          // <-- Persist to memory only
            return;
        }

        try {
            window.localStorage.setItem(SESSION_STATE_STORAGE_KEY, JSON.stringify(stateObject));                                    // <-- Persist to localStorage
        } catch (error) {
            TrueVision__Pwa__SessionState__InMemoryFallback = stateObject;                                                          // <-- Fallback if quota exceeded
        }
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Read (and Repair) the Active Project Entry
    // ---------------------------------------------------------------
    function TrueVision__Pwa__SessionState__ReadProjectEntry(stateObject) {
        const projectKey    = TrueVision__Pwa__SessionState__GetProjectKey();                                                       // <-- Active project namespace

        if (!stateObject.perProject[projectKey] || typeof stateObject.perProject[projectKey] !== 'object') {
            stateObject.perProject[projectKey] = TrueVision__Pwa__SessionState__BuildEmptyProjectEntry();                            // <-- Seed on first touch
        }

        const projectEntry  = stateObject.perProject[projectKey];                                                                   // <-- Entry for this project

        if (!projectEntry.perPlatform || typeof projectEntry.perPlatform !== 'object') {
            projectEntry.perPlatform = {};                                                                                          // <-- Repair a missing map
        }

        return projectEntry;                                                                                                        // <-- Ready-to-use project entry
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Report Whether This Is a Development Environment
    // ------------------------------------------------------------
    function TrueVision__Pwa__SessionState__IsDevEnvironment() {
        const urlHelper     = window.TrueVision__Pwa__Url || null;                                                                  // <-- Absolute URL helper
        if (urlHelper && typeof urlHelper.isLocalhost === 'function') return urlHelper.isLocalhost();                               // <-- Authoritative answer

        const hostname      = (window.location && window.location.hostname) || '';                                                  // <-- Fallback probe
        return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
    }
    // ---------------------------------------------------------------


    // FUNCTION | Get the Suppression Window a Dismissal Should Apply
    // ------------------------------------------------------------
    // One week on localhost, nothing on the live site. See the environment
    // policy note in this file's header for why the two differ.
    // ------------------------------------------------------------
    function TrueVision__Pwa__SessionState__GetSnoozeDurationMs() {
        return TrueVision__Pwa__SessionState__IsDevEnvironment()
            ? SESSION_STATE_DEV_SNOOZE_MS                                                                                           // <-- Localhost: a week of quiet
            : SESSION_STATE_LIVE_SNOOZE_MS;                                                                                         // <-- Live: back again next visit
    }
    // ---------------------------------------------------------------


    // FUNCTION | Read the Snapshot for a Platform on the Active Project
    // ------------------------------------------------------------
    function TrueVision__Pwa__SessionState__ReadPlatformSnapshot(platformId) {
        const stateObject   = TrueVision__Pwa__SessionState__ReadRawState();                                                        // <-- Load the full state
        const projectEntry  = TrueVision__Pwa__SessionState__ReadProjectEntry(stateObject);                                         // <-- Narrow to this project
        const platformEntry = projectEntry.perPlatform[platformId] || { dismissCount: 0, snoozeUntil: null };                        // <-- Default empty entry

        return {
            projectKey          : TrueVision__Pwa__SessionState__GetProjectKey(),
            installCompletedAt  : projectEntry.installCompletedAt,
            globalSuppressUntil : stateObject.globalSuppressUntil,
            dismissCount        : Number(platformEntry.dismissCount || 0),
            snoozeUntil         : platformEntry.snoozeUntil ? Number(platformEntry.snoozeUntil) : null
        };
    }
    // ---------------------------------------------------------------


    // FUNCTION | Determine Whether the Prompt Should Be Suppressed Right Now
    // ------------------------------------------------------------
    function TrueVision__Pwa__SessionState__IsSuppressed(platformId) {
        if (TrueVision__Pwa__SessionState__ManualOverrideActive) return false;                                                       // <-- The client asked for it, always show

        const snapshot      = TrueVision__Pwa__SessionState__ReadPlatformSnapshot(platformId);                                      // <-- Read the current snapshot
        const nowEpochMs    = Date.now();                                                                                           // <-- Current time

        if (snapshot.installCompletedAt) return true;                                                                               // <-- This project is already installed
        if (TrueVision__Pwa__SessionState__DismissedThisPageLoad) return true;                                                       // <-- Already said no during this page load
        if (snapshot.globalSuppressUntil && nowEpochMs < snapshot.globalSuppressUntil) return true;                                  // <-- Global suppression active
        if (snapshot.snoozeUntil && nowEpochMs < snapshot.snoozeUntil) return true;                                                  // <-- Localhost week-long snooze active

        return false;                                                                                                               // <-- Free to prompt
    }
    // ---------------------------------------------------------------


    // FUNCTION | Record a Dismissal and Apply the Environment's Policy
    // ------------------------------------------------------------
    function TrueVision__Pwa__SessionState__RecordDismissal(platformId) {
        TrueVision__Pwa__SessionState__DismissedThisPageLoad = true;                                                                // <-- Quiet for the rest of this page load

        const stateObject       = TrueVision__Pwa__SessionState__ReadRawState();                                                    // <-- Load the full state
        const projectEntry      = TrueVision__Pwa__SessionState__ReadProjectEntry(stateObject);                                     // <-- Narrow to this project
        const previousEntry     = projectEntry.perPlatform[platformId] || { dismissCount: 0, snoozeUntil: null };                    // <-- Existing platform entry

        const nextDismissCount  = Number(previousEntry.dismissCount || 0) + 1;                                                      // <-- Increment the count
        const snoozeDurationMs  = TrueVision__Pwa__SessionState__GetSnoozeDurationMs();                                              // <-- Environment-driven window
        const nextSnoozeUntil   = snoozeDurationMs > 0 ? Date.now() + snoozeDurationMs : null;                                      // <-- Live site persists no deadline at all

        projectEntry.perPlatform[platformId] = {                                                                                    // <-- Update the platform entry
            dismissCount    : nextDismissCount,
            snoozeUntil     : nextSnoozeUntil
        };

        TrueVision__Pwa__SessionState__WriteRawState(stateObject);                                                                  // <-- Persist back

        return { dismissCount: nextDismissCount, snoozeUntil: nextSnoozeUntil };                                                    // <-- Return the new snapshot
    }
    // ---------------------------------------------------------------


    // FUNCTION | Mark the Active Project as Installed
    // ------------------------------------------------------------
    function TrueVision__Pwa__SessionState__MarkInstalled() {
        const stateObject   = TrueVision__Pwa__SessionState__ReadRawState();                                                        // <-- Load the full state
        const projectEntry  = TrueVision__Pwa__SessionState__ReadProjectEntry(stateObject);                                         // <-- Narrow to this project

        projectEntry.installCompletedAt = Date.now();                                                                               // <-- Stamp the install moment
        TrueVision__Pwa__SessionState__WriteRawState(stateObject);                                                                  // <-- Persist
    }
    // ---------------------------------------------------------------


    // FUNCTION | Apply a Global Suppression Window Across Every Project
    // ------------------------------------------------------------
    function TrueVision__Pwa__SessionState__SuppressGlobally(durationMs) {
        const stateObject   = TrueVision__Pwa__SessionState__ReadRawState();                                                        // <-- Load the full state
        stateObject.globalSuppressUntil = Date.now() + Math.max(0, Number(durationMs) || 0);                                        // <-- Compute the deadline
        TrueVision__Pwa__SessionState__WriteRawState(stateObject);                                                                  // <-- Persist
    }
    // ---------------------------------------------------------------


    // FUNCTION | Reset State for the Active Project (Diagnostic)
    // ------------------------------------------------------------
    function TrueVision__Pwa__SessionState__ResetProject() {
        TrueVision__Pwa__SessionState__DismissedThisPageLoad = false;                                                               // <-- Lift the page-load quiet period
        const stateObject   = TrueVision__Pwa__SessionState__ReadRawState();                                                        // <-- Load the full state
        const projectKey    = TrueVision__Pwa__SessionState__GetProjectKey();                                                       // <-- Active project namespace

        if (stateObject.perProject[projectKey]) {
            delete stateObject.perProject[projectKey];                                                                              // <-- Drop the project entry
            TrueVision__Pwa__SessionState__WriteRawState(stateObject);                                                              // <-- Persist
        }
    }
    // ---------------------------------------------------------------


    // FUNCTION | Reset Every Project (Diagnostic / Reinstall Flow)
    // ------------------------------------------------------------
    function TrueVision__Pwa__SessionState__ResetAll() {
        TrueVision__Pwa__SessionState__DismissedThisPageLoad = false;                                                               // <-- Lift the page-load quiet period
        TrueVision__Pwa__SessionState__WriteRawState(TrueVision__Pwa__SessionState__BuildEmptyState());                              // <-- Replace with a clean state
    }
    // ---------------------------------------------------------------


    // FUNCTION | Raise or Lower the Manual Override Flag
    // ------------------------------------------------------------
    // The install controller wraps a deliberate "Install App" click in this
    // so every suppression check inside the handler is bypassed. Handlers
    // render synchronously, so the flag is only ever up for one call stack.
    // ------------------------------------------------------------
    function TrueVision__Pwa__SessionState__SetManualOverride(isActive) {
        TrueVision__Pwa__SessionState__ManualOverrideActive = Boolean(isActive);                                                    // <-- Raise or lower the flag
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Global Exposure
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Global Session State Namespace
    // ------------------------------------------------------------
    function TrueVision__Pwa__SessionState__InitializeGlobalNamespace() {
        if (typeof window === 'undefined') return;                                                                                  // <-- Guard non-window contexts

        window.TrueVision__Pwa__SessionState = {                                                                                    // <-- Public API surface
            readPlatformSnapshot    : TrueVision__Pwa__SessionState__ReadPlatformSnapshot,
            isSuppressed            : TrueVision__Pwa__SessionState__IsSuppressed,
            recordDismissal         : TrueVision__Pwa__SessionState__RecordDismissal,
            markInstalled           : TrueVision__Pwa__SessionState__MarkInstalled,
            suppressGlobally        : TrueVision__Pwa__SessionState__SuppressGlobally,
            resetProject            : TrueVision__Pwa__SessionState__ResetProject,
            resetAll                : TrueVision__Pwa__SessionState__ResetAll,
            setManualOverride       : TrueVision__Pwa__SessionState__SetManualOverride,
            isDevEnvironment        : TrueVision__Pwa__SessionState__IsDevEnvironment,
            getSnoozeDurationMs     : TrueVision__Pwa__SessionState__GetSnoozeDurationMs
        };

        // CONSOLE SHORTCUT | Clear the localhost week-long snooze on demand
        // ------------------------------------------------------------
        // Type TrueVision__Pwa__ResetInstallPrompt() in the console to make
        // the prompt come back immediately during development.
        // ------------------------------------------------------------
        window.TrueVision__Pwa__ResetInstallPrompt = function () {
            TrueVision__Pwa__SessionState__ResetAll();                                                                              // <-- Wipe every project's prompt state
            console.log('[TrueVision3D PWA] Install prompt state cleared - reload to see the prompt again.');
            return 'cleared';
        };
    }
    // ---------------------------------------------------------------


    TrueVision__Pwa__SessionState__InitializeGlobalNamespace();                                                                     // <-- Mount on window immediately

// endregion -------------------------------------------------------------------

})();
