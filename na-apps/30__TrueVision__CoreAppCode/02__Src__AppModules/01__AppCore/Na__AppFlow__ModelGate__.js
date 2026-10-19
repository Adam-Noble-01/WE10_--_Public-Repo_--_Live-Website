// =============================================================================
// TRUEVISION3D - APP FLOW - MODEL GATE
// =============================================================================
//
// FILE       : Na__AppFlow__ModelGate__.js
// NAMESPACE  : Na__ModelGate
// MODULE     : App Flow - Model Gate
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Hold the 3D model's downloads back while a reader is reading a document, and let them go the moment the 3D view is wanted
// CREATED    : 19-Oct-2026
//
// DESCRIPTION:
// - WHY. A reader sent straight to a document - the Project Hub's PlanVision
//   card, or any shared link - never needs the 3D model to read it: the web
//   viewer shows the PUBLISHED drawing and renders nothing from the model.
//   Loading the model anyway put tens of megabytes of model files (RB05's
//   design phases come to 52 MB, EB03's to 100 MB) and the 1.5 MB sky dome in
//   a race with the drawing's own files, and parsed them on the main thread
//   while the reader was trying to zoom. On a phone it was also the memory the
//   published system exists to save.
// - WHAT IT IS. One gate, between the drawings arriving and the model files
//   being asked for: Na__AppFlow__LoadingSequence passes through it there. It
//   is OPEN unless somebody arms it, so a visit to the 3D model never waits.
// - THREE STATES:
//     open     the model loads. The default, and the only way out.
//     pending  armed, not yet decided: whoever armed it is still finding out
//              whether a document will open. A sequence waiting on a pending
//              gate waits at most PENDING_CAP_MS, then opens it itself.
//     held     a reader is reading a document. The gate stays shut until it
//              is opened, which is the reader asking for the 3D Model tab.
// - IT CAN BE LATE, NEVER LOST. Whoever arms it must open it on every path but
//   one - a reader with a document open - and the cap covers a decision that
//   never comes. Arming after the model has started loading is refused: there
//   is nothing left to hold.
// - WHO ARMS IT. Na__LayoutEditor__Share__Open__, in the synchronous start of
//   Na__LeShareOpen__Initialize, which Index.html calls in the same run of its
//   module body as Na__AppFlow__StartLoadingSequence. The sequence is several
//   network round trips short of the gate at that point, so the arm always
//   lands first.
//
// INTEGRATION:
// - Na__AppFlow__LoadingSequence: awaits Na__ModelGate__Pass() just before the
//   model files and the sky dome are asked for.
// - Na__LayoutEditor__Share__Open__: Arm, Keep and Open.
// - No imports: a leaf, tested in Node as it ships
//   (80__Testing__PrototypeEnvironment/Na__Test__ModelGate__.test.mjs).
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : none. TrueVision original.
// - Back-port     : n/a (ValeVision has no web viewer).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Oct-2026 - Version 1.0.0
// - Initial implementation (TrueVision3D v2.183.0): the Project Hub's
//   PlanVision card opens the drawings, and the model waits for the 3D tab.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Three States and the Cap on an Undecided Gate
    // ------------------------------------------------------------
    const Na__ModelGate__OPEN    = 'open';
    const Na__ModelGate__PENDING = 'pending';
    const Na__ModelGate__HELD    = 'held';
    const Na__ModelGate__PENDING_CAP_MS = 12000;                                  // <-- The decision normally lands within a second of the drawings; this only bounds one that never does
    // ------------------------------------------------------------

    // MODULE VARIABLES | Where the Gate Stands
    // ------------------------------------------------------------
    let Na__ModelGate__State   = Na__ModelGate__OPEN;
    let Na__ModelGate__Passed  = false;                                           // <-- The sequence has gone through: the model is loading, and a hold means nothing
    let Na__ModelGate__Reason  = null;                                            // <-- Why it last changed, for the console and the tests
    let Na__ModelGate__Release = null;                                            // <-- Resolves the wait
    let Na__ModelGate__Waiting = Promise.resolve();
    let Na__ModelGate__Timer   = null;                                            // <-- The cap on a pending gate, started when the sequence reaches it
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Arm the Gate: a Document May Be About to Open (false when it cannot be held)
    // ------------------------------------------------------------
    function Na__ModelGate__Arm(reason) {
        if (Na__ModelGate__Passed || Na__ModelGate__State !== Na__ModelGate__OPEN) return false;
        Na__ModelGate__State   = Na__ModelGate__PENDING;
        Na__ModelGate__Reason  = reason || 'armed';
        Na__ModelGate__Waiting = new Promise((resolve) => { Na__ModelGate__Release = resolve; });
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Keep It Shut: a Reader Is Reading a Document (false when there is nothing to keep)
    // ------------------------------------------------------------
    // Only a PENDING gate can be kept. An open one has already let the model
    // go - the cap ran out, or the decision came too late - and is left alone.
    // ------------------------------------------------------------
    function Na__ModelGate__Keep(reason) {
        if (Na__ModelGate__State !== Na__ModelGate__PENDING) return false;
        Na__ModelGate__State  = Na__ModelGate__HELD;
        Na__ModelGate__Reason = reason || 'held';
        if (Na__ModelGate__Timer) { clearTimeout(Na__ModelGate__Timer); Na__ModelGate__Timer = null; }   // <-- The cap only ever bounds an undecided gate
        console.info('[TrueVision3D] The 3D model will load when it is asked for (' + Na__ModelGate__Reason + ').');
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Open the Gate: the Model Is Wanted (false when it was open already)
    // ------------------------------------------------------------
    function Na__ModelGate__Open(reason) {
        if (Na__ModelGate__State === Na__ModelGate__OPEN) return false;
        const wasHeld = Na__ModelGate__State === Na__ModelGate__HELD;
        Na__ModelGate__State  = Na__ModelGate__OPEN;
        Na__ModelGate__Reason = reason || 'opened';
        if (Na__ModelGate__Timer) { clearTimeout(Na__ModelGate__Timer); Na__ModelGate__Timer = null; }
        const release = Na__ModelGate__Release;
        Na__ModelGate__Release = null;
        if (release) release(Na__ModelGate__Reason);
        if (wasHeld) console.info('[TrueVision3D] Loading the 3D model now (' + Na__ModelGate__Reason + ').');
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Go Through the Gate (the loading sequence's one call)
    // ------------------------------------------------------------
    // Resolves { Waited, Reason } once the gate is open: at once when nobody
    // armed it. A PENDING gate starts its cap here, because this is the moment
    // somebody is actually waiting on the answer.
    // ------------------------------------------------------------
    async function Na__ModelGate__Pass(capMs) {
        const cap = (Number.isFinite(capMs) && capMs >= 0) ? capMs : Na__ModelGate__PENDING_CAP_MS;
        let waited = false;
        if (Na__ModelGate__State === Na__ModelGate__PENDING && !Na__ModelGate__Timer) {
            Na__ModelGate__Timer = setTimeout(() => {
                Na__ModelGate__Timer = null;
                if (Na__ModelGate__State === Na__ModelGate__PENDING) Na__ModelGate__Open('no decision within ' + cap + ' ms');
            }, cap);
        }
        if (Na__ModelGate__State !== Na__ModelGate__OPEN) {
            waited = true;
            await Na__ModelGate__Waiting;
        }
        Na__ModelGate__Passed = true;
        return { Waited : waited, Reason : Na__ModelGate__Reason };
    }
    // ------------------------------------------------------------


    // FUNCTION | Where the Gate Stands ('open' | 'pending' | 'held')
    // ------------------------------------------------------------
    function Na__ModelGate__GetState() { return Na__ModelGate__State; }
    function Na__ModelGate__HasPassed() { return Na__ModelGate__Passed; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Model Gate API
    // ------------------------------------------------------------
    export {
        Na__ModelGate__OPEN,
        Na__ModelGate__PENDING,
        Na__ModelGate__HELD,
        Na__ModelGate__PENDING_CAP_MS,
        Na__ModelGate__Arm,
        Na__ModelGate__Keep,
        Na__ModelGate__Open,
        Na__ModelGate__Pass,
        Na__ModelGate__GetState,
        Na__ModelGate__HasPassed
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
