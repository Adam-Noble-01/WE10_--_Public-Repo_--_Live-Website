// =============================================================================
// TRUEVISION3D - APP UTILS - AUTHORING GATE
// =============================================================================
//
// FILE       : Na__AppUtils__DevGate__.js
// NAMESPACE  : Na__DevGate
// MODULE     : App Utils - Authoring Gate
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Decide whether this session may AUTHOR, separately from where it is served
// CREATED    : 11-Sep-2026
//
// DESCRIPTION:
// - Every dev panel, every save button and the Layout Editor's editing surface
//   ask this one question rather than testing the hostname themselves.
// - THE POINT OF SPLITTING THIS OUT. "Am I on localhost" and "may I author" used
//   to be the same test, and they are not the same question. TrueVision is
//   becoming installable drawing software: an app that can only be edited while
//   a Python server happens to be running on the same machine is not a tool. The
//   authoring gate now opens on localhost OR on an explicit, persisted unlock.
// - WHAT THIS DELIBERATELY DOES NOT DO is decide where project data comes from.
//   Na__AppUtils__IsRunningOnLocalhost still owns that, because the loader picks
//   the repository copy on localhost and the R2 CDN everywhere else. Unlocking
//   authoring on the live site must not make it start looking for a repository
//   path that is not there - so the URL routing keeps the raw hostname test and
//   only the authoring surfaces come through here.
// - This is not a security boundary and is not pretending to be one. Writes are
//   authorised by the Worker key; this decides whether the UI is offered at all.
//
// INTEGRATION:
// - Unlock:   Na__DevGate__Unlock()   or  ?authoring=on   in the URL
// - Re-lock:  Na__DevGate__Lock()     or  ?authoring=off
// - Both are also exposed on window for the console.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : none. TrueVision original, implementing plan decision TD01.
// - Ported on     : 11-Sep-2026 for TrueVision3D v2.21.0 (re-alignment Phase F)
// - Parity        : new
// - Divergences   : ValeVision gates authoring on the hostname alone (D24) and has no
//                   installable authoring story yet. Back-port candidate if it gains one.
// - Back-port     : candidate.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 11-Sep-2026 - Version 1.0.0
// - Initial implementation for TD01.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Environment Detection
    // ------------------------------------------------------------
    // @delegate: ./Na__AppUtils__ProjectLoader.js
    // ------------------------------------------------------------
    import { Na__AppUtils__IsRunningOnLocalhost } from './Na__AppUtils__ProjectLoader.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Storage Key and URL Parameter
    // ------------------------------------------------------------
    const Na__DevGate__STORAGE_KEY = 'TrueVision3D__AuthoringUnlocked';
    const Na__DevGate__URL_PARAM   = 'authoring';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Resolved Unlock State
    // ------------------------------------------------------------
    // Resolved ONCE, on first ask. A gate that could change answer mid-session
    // would leave half the dev panels built and half not, which is worse than
    // either answer on its own.
    // ------------------------------------------------------------
    let Na__DevGate__Resolved = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Private
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Read the Persisted Unlock Flag
    // ------------------------------------------------------------
    // Wrapped, because localStorage throws outright in a private window and in
    // some embedded contexts, and a thrown gate would take the whole app down
    // rather than simply keeping authoring closed.
    // ------------------------------------------------------------
    function Na__DevGate__ReadStored() {
        try { return window.localStorage.getItem(Na__DevGate__STORAGE_KEY) === 'true'; }
        catch (error) { return false; }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write the Persisted Unlock Flag
    // ------------------------------------------------------------
    function Na__DevGate__WriteStored(unlocked) {
        try {
            if (unlocked) window.localStorage.setItem(Na__DevGate__STORAGE_KEY, 'true');
            else          window.localStorage.removeItem(Na__DevGate__STORAGE_KEY);
            return true;
        } catch (error) { return false; }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Apply an ?authoring= Parameter, If Present
    // ------------------------------------------------------------
    // Returns true when the URL said something, so the caller knows the URL beat
    // whatever was stored.
    // ------------------------------------------------------------
    function Na__DevGate__ApplyUrlParam() {
        try {
            const value = new URLSearchParams(window.location.search).get(Na__DevGate__URL_PARAM);
            if (value === null) return false;
            const on = (value === 'on' || value === '1' || value === 'true');
            Na__DevGate__WriteStored(on);
            console.log(`[TrueVision3D] Authoring ${on ? 'UNLOCKED' : 'locked'} by URL parameter and remembered on this device.`);
            return true;
        } catch (error) { return false; }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | May This Session Author?
    // ------------------------------------------------------------
    function Na__DevGate__IsAuthoringEnabled() {
        if (Na__DevGate__Resolved !== null) return Na__DevGate__Resolved;

        Na__DevGate__ApplyUrlParam();                                            // <-- URL beats storage, and updates it

        const onLocalhost = Na__AppUtils__IsRunningOnLocalhost();
        const unlocked    = Na__DevGate__ReadStored();
        Na__DevGate__Resolved = onLocalhost || unlocked;

        if (Na__DevGate__Resolved && !onLocalhost) {
            console.log('[TrueVision3D] Authoring is unlocked on a non-localhost origin. Run Na__DevGate__Lock() to close it again.');
        }
        return Na__DevGate__Resolved;
    }
    // ------------------------------------------------------------


    // FUNCTION | Unlock Authoring on This Device
    // ------------------------------------------------------------
    // Takes effect on the next load, deliberately: see the note on the resolved
    // state above.
    // ------------------------------------------------------------
    function Na__DevGate__Unlock() {
        const ok = Na__DevGate__WriteStored(true);
        console.log(ok
            ? '[TrueVision3D] Authoring unlocked. Reload to build the dev surfaces.'
            : '[TrueVision3D] Could not persist the unlock (storage unavailable).');
        return ok;
    }
    // ------------------------------------------------------------


    // FUNCTION | Re-Lock Authoring on This Device
    // ------------------------------------------------------------
    function Na__DevGate__Lock() {
        const ok = Na__DevGate__WriteStored(false);
        console.log(ok
            ? '[TrueVision3D] Authoring locked. Reload to hide the dev surfaces.'
            : '[TrueVision3D] Could not clear the unlock (storage unavailable).');
        return ok;
    }
    // ------------------------------------------------------------


    // FUNCTION | Expose the Two Switches on window for the Console
    // ------------------------------------------------------------
    function Na__DevGate__Initialize() {
        window.Na__DevGate__Unlock = Na__DevGate__Unlock;
        window.Na__DevGate__Lock   = Na__DevGate__Lock;
        Na__DevGate__IsAuthoringEnabled();                                       // <-- Resolve now, so the URL parameter is honoured before any panel asks
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Authoring Gate API
    // ------------------------------------------------------------
    export {
        Na__DevGate__IsAuthoringEnabled,
        Na__DevGate__Unlock,
        Na__DevGate__Lock,
        Na__DevGate__Initialize
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
