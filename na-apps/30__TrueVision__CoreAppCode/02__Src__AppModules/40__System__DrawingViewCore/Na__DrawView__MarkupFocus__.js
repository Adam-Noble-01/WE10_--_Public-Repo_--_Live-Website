// =============================================================================
// TRUEVISION3D - DRAWING VIEW CORE - MARKUP FOCUS ARBITER
// =============================================================================
//
// FILE       : Na__DrawView__MarkupFocus__.js
// NAMESPACE  : Na__FpFocus
// MODULE     : Drawing View Core - Markup Focus Arbiter
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Decide which markup layer owns a shared keystroke
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - Two markup systems are live at once while a plan is being authored: text
//   annotations and dimensions. Both bind Ctrl+Z, Ctrl+Y and Delete, and each
//   keeps its own undo stack. Without arbitration one Ctrl+Z would step BOTH
//   stacks and one Delete would remove a label AND a dimension - a bug that
//   destroys work silently.
//
// - THE RULE IS FIRST REFUSAL, NOT EXCLUSIVE OWNERSHIP. The focused layer is
//   offered the keystroke first; if it CANNOT act - nothing selected, nothing
//   left on its undo stack - the other layer gets it instead.
//
//   The first version of this module granted exclusive ownership to whichever
//   layer was touched last, and that was wrong: a focus that was stale, or had
//   never been claimed at all, left NEITHER layer able to undo and Ctrl+Z did
//   nothing whatsoever. First refusal keeps the intuition (the thing you were
//   just working on is the thing Ctrl+Z undoes) while guaranteeing the key
//   always reaches something that can actually use it.
//
// - Layers register capability probes rather than the arbiter reaching into
//   them, so this module stays dependency-free and cannot become a second
//   place where markup state lives.
//
// - Keys that belong to only ONE system are not arbitrated at all. The arrow
//   key axis locks, the ortho toggle and copy/paste have no counterpart in the
//   other layer, so they stay live regardless of who holds focus.
//
// INTEGRATION:
// - Na__PlanAnnotations__Editor__ and Na__PlanDimensions__Editor__ claim on
//   selection; both hotkey modules register probes and call ResolveOwner.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 42__System__DrawingViewCore/Na__DrawView__MarkupFocus__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 09-Sep-2026 - TrueVision3D v2.18.0 (port Phase 2)
// - Ported from TrueVision3D for port Phase 2; logic unchanged, imports repointed.
//
// 31-Aug-2026 - Version 1.1.0
// - Replaced exclusive ownership with first refusal plus capability probes.
//   Exclusive ownership meant a stale or unset focus blocked undo entirely.
//
// 31-Aug-2026 - Version 1.0.0
// - Initial implementation, added when the dimension hotkeys arrived and began
//   colliding with the annotation ones.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Claimant Identifiers
    // ------------------------------------------------------------
    const Na__DrawFocus__ANNOTATIONS = 'annotations';
    const Na__DrawFocus__DIMENSIONS  = 'dimensions';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Arbitrated Capabilities
    // ------------------------------------------------------------
    const Na__DrawFocus__CAP_UNDO   = 'canUndo';
    const Na__DrawFocus__CAP_REDO   = 'canRedo';
    const Na__DrawFocus__CAP_DELETE = 'canDelete';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Resolution Order When Nobody Holds Focus
    // ------------------------------------------------------------
    // Only consulted once the focused layer has declined. Dimensions come
    // first because they are the layer with a live placement mode, so an
    // unfocused keystroke during dimensioning most likely means them.
    // ------------------------------------------------------------
    const Na__DrawFocus__ORDER = [Na__DrawFocus__DIMENSIONS, Na__DrawFocus__ANNOTATIONS];
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Current Claimant and Registered Probes
    // ------------------------------------------------------------
    // null means nothing has been touched yet, in which case the capability
    // probes alone decide - which is the behaviour that makes Ctrl+Z work on
    // a freshly opened plan.
    // ------------------------------------------------------------
    let Na__DrawFocus__Current = null;
    const Na__DrawFocus__Probes = {};   // <-- owner -> { canUndo, canRedo, canDelete }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Registration
// -----------------------------------------------------------------------------

    // FUNCTION | Register One Layer's Capability Probes
    // ------------------------------------------------------------
    // probes: { canUndo(), canRedo(), canDelete() } - each returning a boolean.
    // Any probe left out simply reports false for that capability.
    // ------------------------------------------------------------
    function Na__DrawFocus__RegisterProbe(owner, probes) {
        if (owner !== Na__DrawFocus__ANNOTATIONS && owner !== Na__DrawFocus__DIMENSIONS) return false;
        Na__DrawFocus__Probes[owner] = probes || {};
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Drop a Layer's Probes When It Detaches
    // ------------------------------------------------------------
    // A detached layer must stop being offered keystrokes, or a Ctrl+Z after
    // leaving plan mode would resolve to a system that is no longer listening.
    // ------------------------------------------------------------
    function Na__DrawFocus__UnregisterProbe(owner) {
        delete Na__DrawFocus__Probes[owner];
        if (Na__DrawFocus__Current === owner) Na__DrawFocus__Current = null;
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Can This Layer Perform This Capability Right Now?
    // ------------------------------------------------------------
    function Na__DrawFocus__CanAct(owner, capability) {
        const probes = Na__DrawFocus__Probes[owner];
        if (!probes || typeof probes[capability] !== 'function') return false;

        try {
            return probes[capability]() === true;
        } catch (error) {
            // A probe that throws must never take the keystroke down with it.
            console.warn('[TrueVision3D] Markup focus probe failed for ' + owner + '.' + capability, error);
            return false;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Focus and Resolution
// -----------------------------------------------------------------------------

    // FUNCTION | Claim Focus for One Markup System
    // ------------------------------------------------------------
    function Na__DrawFocus__Claim(owner) {
        if (owner !== Na__DrawFocus__ANNOTATIONS && owner !== Na__DrawFocus__DIMENSIONS) return false;
        Na__DrawFocus__Current = owner;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Release Focus
    // ------------------------------------------------------------
    // Only the current holder can release, so a layer clearing its own
    // selection never steals focus away from the other one.
    // ------------------------------------------------------------
    function Na__DrawFocus__Release(owner) {
        if (owner && Na__DrawFocus__Current !== owner) return false;
        Na__DrawFocus__Current = null;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Who Currently Holds Focus (null When Nobody)
    // ------------------------------------------------------------
    function Na__DrawFocus__Get() {
        return Na__DrawFocus__Current;
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Layer Should Handle This Capability?
    // ------------------------------------------------------------
    // First refusal to the focused layer, then anyone else who can act.
    // Returns null when no layer can do anything, which lets the caller decide
    // whether to swallow the key or let it through.
    // ------------------------------------------------------------
    function Na__DrawFocus__ResolveOwner(capability) {
        if (Na__DrawFocus__Current && Na__DrawFocus__CanAct(Na__DrawFocus__Current, capability)) {
            return Na__DrawFocus__Current;
        }

        for (let i = 0; i < Na__DrawFocus__ORDER.length; i++) {
            const owner = Na__DrawFocus__ORDER[i];
            if (Na__DrawFocus__CanAct(owner, capability)) return owner;
        }
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Should This Layer Act on This Capability?
    // ------------------------------------------------------------
    // The single call both hotkey modules make. True for exactly one layer at
    // most, so a shared key can never fire twice.
    // ------------------------------------------------------------
    function Na__DrawFocus__ShouldHandle(owner, capability) {
        return Na__DrawFocus__ResolveOwner(capability) === owner;
    }
    // ------------------------------------------------------------


    // FUNCTION | Does Any Layer Claim This Capability?
    // ------------------------------------------------------------
    // Lets a handler swallow a key that belongs to markup even when nothing
    // can act on it, so Ctrl+Z at the bottom of the stack never reaches the
    // browser's own edit history.
    // ------------------------------------------------------------
    function Na__DrawFocus__AnyCanAct(capability) {
        return Na__DrawFocus__ResolveOwner(capability) !== null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Markup Focus Arbiter API
    // ------------------------------------------------------------
    export {
        Na__DrawFocus__ANNOTATIONS,
        Na__DrawFocus__DIMENSIONS,
        Na__DrawFocus__CAP_UNDO,
        Na__DrawFocus__CAP_REDO,
        Na__DrawFocus__CAP_DELETE,
        Na__DrawFocus__RegisterProbe,
        Na__DrawFocus__UnregisterProbe,
        Na__DrawFocus__Claim,
        Na__DrawFocus__Release,
        Na__DrawFocus__Get,
        Na__DrawFocus__ResolveOwner,
        Na__DrawFocus__ShouldHandle,
        Na__DrawFocus__AnyCanAct
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
