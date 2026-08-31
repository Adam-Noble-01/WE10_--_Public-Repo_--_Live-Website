// =============================================================================
// TRUEVISION3D - PLAN DIMENSIONS - MEASURING DISCLAIMER
// =============================================================================
//
// FILE       : Na__PlanDimensions__Disclaimer__.js
// NAMESPACE  : Na__PlanDimDisc
// MODULE     : Plan Dimensions - Measuring Disclaimer
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The notice a client must accept before taking any measurement
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - A blocking modal shown before the measuring tool can be armed. It is the
//   gate, not a courtesy: the caller only arms placement from inside the accept
//   callback, so there is no ordering of clicks in which a measurement can be
//   taken before the notice has been agreed to.
//
// - The wording lives entirely in AppConfig as an array of paragraphs, so it
//   can be revised - including by someone who does not write code - without
//   touching this file. Nothing here hard-codes a word of it beyond the
//   fallbacks that cover an unreadable config.
//
// - Accepted once per session by default. Re-showing it on every measurement
//   would train people to dismiss it unread, which is worse than showing it
//   once and meaning it.
//
// - Focus is trapped while it is open and returned to whatever opened it on
//   close, and Escape declines. A notice that cannot be navigated by keyboard
//   is not one that has genuinely been presented.
//
// INTEGRATION:
// - Na__PlanDimensions__ClientMode__ shows this before arming placement.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 31-Aug-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Disclaimer Wording
    // ------------------------------------------------------------
    // @delegate: ./Na__PlanDimensions__Data__.js
    // ------------------------------------------------------------
    import { Na__PlanDim__GetDisclaimerSetup } from './Na__PlanDimensions__Data__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | DOM Identifiers
    // ------------------------------------------------------------
    const Na__PlanDimDisc__ROOT_ID = 'naPlanDimDisclaimer';
    const Na__PlanDimDisc__CLASS   = 'na-plan-dim__disclaimer';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Focusable Selector for the Focus Trap
    // ------------------------------------------------------------
    const Na__PlanDimDisc__FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Open Modal and Acceptance
    // ------------------------------------------------------------
    let Na__PlanDimDisc__Root      = null;
    let Na__PlanDimDisc__Accepted  = false;   // <-- Session-scoped; never persisted
    let Na__PlanDimDisc__OnAccept  = null;
    let Na__PlanDimDisc__OnDecline = null;
    let Na__PlanDimDisc__Returner  = null;    // <-- Element focus returns to on close
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Construction
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the Modal
    // ------------------------------------------------------------
    // Body paragraphs are set with textContent, never innerHTML, so config
    // wording can never inject markup into the page.
    // ------------------------------------------------------------
    function Na__PlanDimDisc__Build(setup) {
        const root = document.createElement('div');
        root.id        = Na__PlanDimDisc__ROOT_ID;
        root.className = Na__PlanDimDisc__CLASS;
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-label', setup.ariaLabel);

        const panel = document.createElement('div');
        panel.className = 'na-plan-dim__disclaimer-panel';

        const heading = document.createElement('h2');
        heading.className   = 'na-plan-dim__disclaimer-title';
        heading.textContent = setup.title;
        panel.appendChild(heading);

        for (let i = 0; i < setup.body.length; i++) {
            const para = document.createElement('p');
            para.className   = 'na-plan-dim__disclaimer-text';
            para.textContent = String(setup.body[i]);
            panel.appendChild(para);
        }

        if (setup.footerNote) {
            const note = document.createElement('p');
            note.className   = 'na-plan-dim__disclaimer-note';
            note.textContent = setup.footerNote;
            panel.appendChild(note);
        }

        const actions = document.createElement('div');
        actions.className = 'na-plan-dim__disclaimer-actions';

        const decline = document.createElement('button');
        decline.type        = 'button';
        decline.className   = 'na-plan-dim__client-btn';
        decline.textContent = setup.declineLabel;
        decline.addEventListener('click', Na__PlanDimDisc__Decline);

        const accept = document.createElement('button');
        accept.type        = 'button';
        accept.className   = 'na-plan-dim__client-btn na-plan-dim__client-btn--primary';
        accept.textContent = setup.acceptLabel;
        accept.addEventListener('click', Na__PlanDimDisc__Accept);

        actions.appendChild(decline);
        actions.appendChild(accept);
        panel.appendChild(actions);

        root.appendChild(panel);

        // Clicking the backdrop declines - it must never be a silent accept.
        root.addEventListener('pointerdown', (event) => {
            if (event.target === root) Na__PlanDimDisc__Decline();
        });
        root.addEventListener('keydown', Na__PlanDimDisc__HandleKeyDown);

        return { root, accept };
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Escape Declines, Tab Stays Inside the Modal
    // ------------------------------------------------------------
    function Na__PlanDimDisc__HandleKeyDown(event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            Na__PlanDimDisc__Decline();
            return;
        }
        if (event.key !== 'Tab' || !Na__PlanDimDisc__Root) return;

        const focusable = Na__PlanDimDisc__Root.querySelectorAll(Na__PlanDimDisc__FOCUSABLE);
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last  = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Show the Disclaimer
    // ------------------------------------------------------------
    // context: { onAccept, onDecline }
    // The caller must arm its tool from onAccept and nowhere else - that is
    // what makes this a gate rather than a notice that can be worked around.
    // ------------------------------------------------------------
    function Na__PlanDimDisc__Show(context) {
        if (Na__PlanDimDisc__Root) return false;                                 // <-- Already open

        const setup = Na__PlanDim__GetDisclaimerSetup();
        Na__PlanDimDisc__OnAccept  = (context && typeof context.onAccept === 'function') ? context.onAccept : null;
        Na__PlanDimDisc__OnDecline = (context && typeof context.onDecline === 'function') ? context.onDecline : null;
        Na__PlanDimDisc__Returner  = document.activeElement;

        const built = Na__PlanDimDisc__Build(setup);
        Na__PlanDimDisc__Root = built.root;
        document.body.appendChild(Na__PlanDimDisc__Root);

        built.accept.focus();                                                    // <-- Keyboard lands somewhere useful
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Accept and Close
    // ------------------------------------------------------------
    function Na__PlanDimDisc__Accept() {
        Na__PlanDimDisc__Accepted = true;

        const callback = Na__PlanDimDisc__OnAccept;
        Na__PlanDimDisc__Close();
        if (typeof callback === 'function') callback();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Decline and Close
    // ------------------------------------------------------------
    function Na__PlanDimDisc__Decline() {
        const callback = Na__PlanDimDisc__OnDecline;
        Na__PlanDimDisc__Close();
        if (typeof callback === 'function') callback();
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Remove the Modal and Restore Focus
    // ------------------------------------------------------------
    function Na__PlanDimDisc__Close() {
        if (Na__PlanDimDisc__Root && Na__PlanDimDisc__Root.parentElement) {
            Na__PlanDimDisc__Root.parentElement.removeChild(Na__PlanDimDisc__Root);
        }
        Na__PlanDimDisc__Root      = null;
        Na__PlanDimDisc__OnAccept  = null;
        Na__PlanDimDisc__OnDecline = null;

        if (Na__PlanDimDisc__Returner && typeof Na__PlanDimDisc__Returner.focus === 'function') {
            Na__PlanDimDisc__Returner.focus();
        }
        Na__PlanDimDisc__Returner = null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Has the Notice Been Accepted This Session?
    // ------------------------------------------------------------
    function Na__PlanDimDisc__HasAccepted() {
        return Na__PlanDimDisc__Accepted === true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the Modal Open?
    // ------------------------------------------------------------
    function Na__PlanDimDisc__IsOpen() {
        return Na__PlanDimDisc__Root !== null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Tear Down and Forget the Acceptance
    // ------------------------------------------------------------
    // Acceptance is deliberately dropped here. Leaving a plan and coming back
    // is a new measuring session, and the notice is cheap to read again.
    // ------------------------------------------------------------
    function Na__PlanDimDisc__Dispose() {
        Na__PlanDimDisc__Close();
        Na__PlanDimDisc__Accepted = false;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Measuring Disclaimer API
    // ------------------------------------------------------------
    export {
        Na__PlanDimDisc__Show,
        Na__PlanDimDisc__Accept,
        Na__PlanDimDisc__Decline,
        Na__PlanDimDisc__HasAccepted,
        Na__PlanDimDisc__IsOpen,
        Na__PlanDimDisc__Dispose
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
