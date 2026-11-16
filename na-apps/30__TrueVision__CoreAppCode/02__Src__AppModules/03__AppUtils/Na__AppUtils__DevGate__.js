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
// - STAFF AND CREATING (15-Nov-2026, the vegetation and entourage port). ValeVision
//   asks two more questions: Na__DevGate__IsStaff() (an Employee or above, who places
//   people and plants) and Na__DevGate__CanCreateAssets() (staff on anything but a
//   phone). TrueVision has one kind of staff, its author, so IsStaff is
//   IsAuthoringEnabled, and CanCreateAssets is that on a computer or a tablet,
//   decided by what the device is (ValeVision's rule, its index.html boot script).
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
// 15-Nov-2026 - Version 1.2.0 (v2.185.0)
// - Na__DevGate__IsStaff() and Na__DevGate__CanCreateAssets(), for the vegetation and
//   entourage systems ported from ValeVision 3D: an author is staff, and an author on
//   a phone only looks.
//
// 18-Sep-2026 - Version 1.1.0
// - The stored flag is tri-state: unlocked, LOCKED, or nothing said. An
//   explicit lock now closes authoring on localhost too, so ?authoring=off is
//   how the read-only web build - the Layout Editor's document viewer included
//   - is seen without deploying it. Before this, Lock() and ?authoring=off
//   cleared the key and localhost carried on authoring, which made the web
//   build's own behaviour unreachable from a development machine.
//
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

    // MODULE VARIABLES | What Kind of Device This Is, Once Asked
    // ------------------------------------------------------------
    let Na__DevGate__Device = null;                                              // <-- 'phone', 'tablet' or 'computer'
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Private
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Read the Persisted Flag: Unlocked, Locked, or Nothing Said
    // ------------------------------------------------------------
    // THREE ANSWERS, NOT TWO, and the third is what makes the live web build
    // previewable. true is an explicit unlock, false an explicit LOCK, and null
    // "this device has not been asked". Only an explicit lock can close
    // authoring on localhost - the absence of an unlock cannot, or localhost
    // would never author at all.
    // Wrapped, because localStorage throws outright in a private window and in
    // some embedded contexts, and a thrown gate would take the whole app down
    // rather than simply keeping authoring closed.
    // ------------------------------------------------------------
    function Na__DevGate__ReadStored() {
        try {
            const value = window.localStorage.getItem(Na__DevGate__STORAGE_KEY);
            if (value === 'true')  return true;
            if (value === 'false') return false;
            return null;
        }
        catch (error) { return null; }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write the Persisted Flag
    // ------------------------------------------------------------
    // A lock is now RECORDED rather than forgotten. It used to clear the key,
    // which on localhost meant Na__DevGate__Lock() and ?authoring=off did
    // nothing whatsoever - the one place a developer would want to use them,
    // to see the read-only web build without deploying it.
    // ------------------------------------------------------------
    function Na__DevGate__WriteStored(unlocked) {
        try {
            window.localStorage.setItem(Na__DevGate__STORAGE_KEY, unlocked ? 'true' : 'false');
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
        const stored      = Na__DevGate__ReadStored();                           // <-- true unlocked, false locked, null nothing said
        // AN EXPLICIT ANSWER WINS, WHEREVER THIS IS SERVED. Said nothing:
        // localhost authors and everywhere else does not, as it always has.
        Na__DevGate__Resolved = (stored === null) ? onLocalhost : stored;

        if (Na__DevGate__Resolved && !onLocalhost) {
            console.log('[TrueVision3D] Authoring is unlocked on a non-localhost origin. Run Na__DevGate__Lock() to close it again.');
        }
        if (!Na__DevGate__Resolved && onLocalhost) {
            console.log('[TrueVision3D] Authoring is LOCKED on localhost: this is the read-only web build. Run Na__DevGate__Unlock() (or ?authoring=on) and reload to author again.');
        }
        return Na__DevGate__Resolved;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What Kind of Device This Is: 'phone', 'tablet' or 'computer'
    // ------------------------------------------------------------
    // ValeVision's rule (its index.html, v2.81.4): decided by what the device is,
    // never by its size, so a touchscreen PC or a laptop at 250% scaling is still a
    // computer. A page that set <html data-na-device> has the last word.
    // ------------------------------------------------------------
    function Na__DevGate__DeviceKind() {
        if (Na__DevGate__Device) return Na__DevGate__Device;
        let kind = 'computer';
        try {
            const marked = document.documentElement.getAttribute('data-na-device');
            if (marked === 'phone' || marked === 'tablet' || marked === 'computer') {
                kind = marked;
            } else {
                const ua     = navigator.userAgent || '';
                const uaData = navigator.userAgentData;
                const ipadOs = /Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1;
                if (/iPhone|iPod/.test(ua)) kind = 'phone';
                else if (/iPad/.test(ua) || ipadOs) kind = 'tablet';
                else if (/Android/i.test(ua)) kind = (/Mobile/i.test(ua) || (uaData && uaData.mobile === true)) ? 'phone' : 'tablet';
                else if (uaData && uaData.mobile === true) kind = 'phone';
                else if (/Windows|Macintosh|CrOS|X11|Linux/.test(ua)) kind = 'computer';
                else if (/Mobi/i.test(ua)) kind = 'phone';
            }
        } catch (error) { kind = 'computer'; }                                    // <-- Unsure: a computer
        Na__DevGate__Device = kind;
        return kind;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is This Member of Staff? (TrueVision: an Author)
    // ------------------------------------------------------------
    // ValeVision's Employee or above. TrueVision has one author, so it is the
    // authoring gate itself.
    // ------------------------------------------------------------
    function Na__DevGate__IsStaff() {
        return Na__DevGate__IsAuthoringEnabled();
    }
    // ------------------------------------------------------------


    // FUNCTION | May This Session Place People and Plants?
    // ------------------------------------------------------------
    // Staff, on anything but a phone: on a phone they only look.
    // ------------------------------------------------------------
    function Na__DevGate__CanCreateAssets() {
        return Na__DevGate__IsStaff() && Na__DevGate__DeviceKind() !== 'phone';
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
        Na__DevGate__IsStaff,
        Na__DevGate__CanCreateAssets,
        Na__DevGate__Unlock,
        Na__DevGate__Lock,
        Na__DevGate__Initialize
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
