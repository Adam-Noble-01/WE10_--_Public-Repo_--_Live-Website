// =============================================================================
// TRUEVISION3D - USER INSTRUCTIONS SYSTEM LOGIC
// =============================================================================
//
// FILE       : Na__UserInstructions__SystemLogic.js
// NAMESPACE  : Na__UserInstructions
// MODULE     : UserInstructions - System Logic
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Overlay lifecycle, content loading, and close event handling
// CREATED    : 27-Feb-2026
//
// DESCRIPTION:
// - Creates the overlay and modal DOM structure at initialisation time.
// - Fetches Na__UserInstructions__Content__.html via the Fetch API and
//   injects it into the modal container.
// - Handles all close triggers: close button, backdrop click, Escape key.
// - Accepts a useTouchControls flag to scroll the touchscreen section
//   into view on open when running on a touch device.
//
// INTEGRATION:
// - Call Na__UserInstructions__Initialize(useTouchControls) once after
//   device detection in index.html.
// - Pass Na__UserInstructions__Open as the openFn to
//   Na__UiFeature__InitializeUserInstructionsMenuItem.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Overlay Runtime References
    // ------------------------------------------------------------
    let Na__UserInstructions__Overlay        = null;    // <-- Overlay backdrop element
    let Na__UserInstructions__Modal          = null;    // <-- Modal card element
    let Na__UserInstructions__IsInitialized  = false;   // <-- Guard against double init
    let Na__UserInstructions__UseTouch       = false;   // <-- Device uses touch controls
    let Na__UserInstructions__EscapeListener = null;    // <-- Stored Escape keydown handler
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | DOM Construction
// -----------------------------------------------------------------------------

    // FUNCTION | Build Overlay DOM Structure
    // ------------------------------------------------------------
    function Na__UserInstructions__BuildDom() {
        const overlay = document.createElement('div');                              // <-- Overlay backdrop
        overlay.className = 'na-user-instructions-overlay';
        overlay.id        = 'naUserInstructionsOverlay';

        const modal = document.createElement('div');                                // <-- Modal card
        modal.className   = 'na-user-instructions-modal';
        modal.id          = 'naUserInstructionsModal';

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        return { overlay, modal };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Content Loading
// -----------------------------------------------------------------------------

    // FUNCTION | Fetch and Inject HTML Content
    // ------------------------------------------------------------
    async function Na__UserInstructions__LoadContent(modal) {
        try {
            const contentPath = new URL(
                './Na__UserInstructions__Content__.html',
                import.meta.url
            ).href;                                                                  // <-- Resolve path relative to this module

            const response = await fetch(contentPath);                              // <-- Fetch content fragment

            if (!response.ok) {
                modal.innerHTML = '<p class="na-user-instructions-modal__error">Could not load instructions.</p>';
                return;
            }

            const html = await response.text();                                     // <-- Read response as text
            modal.innerHTML = html;                                                  // <-- Inject content into modal

        } catch {
            modal.innerHTML = '<p class="na-user-instructions-modal__error">Could not load instructions.</p>';
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Close Handling
// -----------------------------------------------------------------------------

    // FUNCTION | Close the Overlay
    // ------------------------------------------------------------
    function Na__UserInstructions__Close() {
        if (!Na__UserInstructions__Overlay) return;

        Na__UserInstructions__Overlay.classList.remove('is-open');                  // <-- Hide overlay

        if (Na__UserInstructions__EscapeListener) {
            document.removeEventListener('keydown', Na__UserInstructions__EscapeListener); // <-- Remove Escape listener
            Na__UserInstructions__EscapeListener = null;
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Attach Close Event Listeners to Injected Content
    // ------------------------------------------------------------
    function Na__UserInstructions__AttachCloseListeners() {
        const closeBtn = document.getElementById('naUserInstructionsClose');        // <-- Close × button

        if (closeBtn) {
            closeBtn.addEventListener('click', Na__UserInstructions__Close);        // <-- Button click closes
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Open Handling
// -----------------------------------------------------------------------------

    // FUNCTION | Open the Overlay
    // ------------------------------------------------------------
    function Na__UserInstructions__Open() {
        if (!Na__UserInstructions__Overlay) return;

        Na__UserInstructions__Overlay.classList.add('is-open');                     // <-- Show overlay

        // ESCAPE KEY | Register listener for this open session
        // ------------------------------------------------------------
        Na__UserInstructions__EscapeListener = (event) => {
            if (event.key === 'Escape') {
                Na__UserInstructions__Close();                                       // <-- Escape key closes
            }
        };
        document.addEventListener('keydown', Na__UserInstructions__EscapeListener); // <-- Register Escape listener

        // TOUCH DEVICE | Scroll to touchscreen section
        // ------------------------------------------------------------
        if (Na__UserInstructions__UseTouch) {
            const touchSection = document.getElementById('naInstructionsTouchSection'); // <-- Touch section anchor
            if (touchSection) {
                setTimeout(() => {
                    touchSection.scrollIntoView({ behavior: 'smooth', block: 'start' }); // <-- Scroll into view
                }, 100);
            }
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | System Initialisation
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize User Instructions System
    // ------------------------------------------------------------
    async function Na__UserInstructions__Initialize(useTouchControls) {
        if (Na__UserInstructions__IsInitialized) return;                            // <-- Guard: already initialized
        Na__UserInstructions__IsInitialized = true;

        Na__UserInstructions__UseTouch = Boolean(useTouchControls);                 // <-- Store device flag

        const { overlay, modal } = Na__UserInstructions__BuildDom();                // <-- Build overlay structure
        Na__UserInstructions__Overlay = overlay;
        Na__UserInstructions__Modal   = modal;

        await Na__UserInstructions__LoadContent(modal);                             // <-- Fetch + inject content HTML

        Na__UserInstructions__AttachCloseListeners();                               // <-- Wire close button

        // BACKDROP CLICK | Click outside modal closes overlay
        // ------------------------------------------------------------
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {                                         // <-- Only backdrop, not modal
                Na__UserInstructions__Close();
            }
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | User Instructions System API
    // ------------------------------------------------------------
    export {
        Na__UserInstructions__Initialize,
        Na__UserInstructions__Open,
        Na__UserInstructions__Close
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
