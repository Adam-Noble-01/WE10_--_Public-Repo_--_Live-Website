// =============================================================================
// TRUEVISION3D - PWA INSTALL PROMPT UI
// =============================================================================
//
// FILE       : TrueVision__Pwa__PromptUi__.js
// NAMESPACE  : TrueVision3D
// MODULE     : TrueVision__Pwa__PromptUi
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Render the Noble Architecture styled install prompt
// CREATED    : 27-Aug-2026
//
// DESCRIPTION:
// - Vanilla DOM so the prompt can mount before the Three.js module graph boots.
// - Two layouts, both in the house style set by the "Better in Full Screen"
//   invitation card (white panel, dark blue header bar, Open Sans):
//     * card - centred modal used wherever the user has to follow steps
//              themselves (iOS Safari, macOS Safari, iOS non-Safari)
//     * bar  - compact bottom bar used on Chromium, where a single tap hands
//              straight over to the browser's own install dialog
// - Each platform handler supplies its own copy through show(config), so all
//   the visual decisions stay here and every install route looks the same.
// - Emits onPrimary and onDismiss callbacks so handlers stay free of DOM work.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 27-Aug-2026 - Version 1.0.0
// - Initial release.
//
// =============================================================================

(function () {

// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Root Element and Variant Tokens
    // ------------------------------------------------------------
    const PROMPT_UI_ROOT_ID             = 'naPwaInstallPromptRoot';                                                                 // <-- Top-level root element id
    const PROMPT_UI_VARIANT_CARD        = 'card';                                                                                   // <-- Centred instruction card
    const PROMPT_UI_VARIANT_BAR         = 'bar';                                                                                    // <-- Compact bottom bar
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Class Names (must match the stylesheet)
    // ------------------------------------------------------------
    const CLASS_ROOT                    = 'na-pwa-install';                                                                         // <-- Root container
    const CLASS_ROOT_OPEN               = 'is-open';                                                                                // <-- Visible state modifier
    const CLASS_BACKDROP                = 'na-pwa-install__backdrop';                                                               // <-- Dimming backdrop (card variant)
    const CLASS_CARD                    = 'na-pwa-install__card';                                                                   // <-- Card panel
    const CLASS_BAR                     = 'na-pwa-install__bar';                                                                    // <-- Compact bar panel
    const CLASS_HEADER                  = 'na-pwa-install__header';                                                                 // <-- Dark blue header bar
    const CLASS_HEADER_ICON             = 'na-pwa-install__header-icon';                                                            // <-- Header glyph
    const CLASS_TITLE                   = 'na-pwa-install__title';                                                                  // <-- Header title text
    const CLASS_BODY                    = 'na-pwa-install__body';                                                                   // <-- Card body wrapper
    const CLASS_LEAD                    = 'na-pwa-install__lead';                                                                   // <-- Bold opening sentence
    const CLASS_TEXT                    = 'na-pwa-install__text';                                                                   // <-- Supporting paragraph
    const CLASS_STEPS                   = 'na-pwa-install__steps';                                                                  // <-- Step panel
    const CLASS_STEPS_TITLE             = 'na-pwa-install__steps-title';                                                            // <-- Step panel heading
    const CLASS_STEP_ROW                = 'na-pwa-install__step-row';                                                               // <-- Single step row
    const CLASS_STEP_NUMBER             = 'na-pwa-install__step-number';                                                            // <-- Step ordinal badge
    const CLASS_STEP_TEXT               = 'na-pwa-install__step-text';                                                              // <-- Step instruction text
    const CLASS_ACTIONS                 = 'na-pwa-install__actions';                                                                // <-- Button row
    const CLASS_BUTTON                  = 'na-pwa-install__btn';                                                                    // <-- Shared button base
    const CLASS_BUTTON_PRIMARY          = 'na-pwa-install__btn--primary';                                                           // <-- Primary action
    const CLASS_BUTTON_SECONDARY        = 'na-pwa-install__btn--secondary';                                                         // <-- Dismiss action
    const CLASS_APP_ICON                = 'na-pwa-install__app-icon';                                                               // <-- Application icon artwork
    const CLASS_BAR_TEXT                = 'na-pwa-install__bar-text';                                                               // <-- Bar text column
    const CLASS_BAR_TITLE               = 'na-pwa-install__bar-title';                                                              // <-- Bar title line
    const CLASS_BAR_BODY                = 'na-pwa-install__bar-body';                                                               // <-- Bar supporting line
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Header Glyph (device with a downward install arrow)
    // ------------------------------------------------------------
    const PROMPT_UI_HEADER_ICON_SVG     = ''
        + '<svg class="' + CLASS_HEADER_ICON + '" viewBox="0 0 20 20" fill="none" aria-hidden="true">'
        + '<rect x="5" y="1.6" width="10" height="16.8" rx="2" stroke="currentColor" stroke-width="1.6"/>'
        + '<line x1="10" y1="6" x2="10" y2="12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
        + '<polyline points="7.4,9.6 10,12.2 12.6,9.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'
        + '</svg>';
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Bottom Bar Clearance
    // ------------------------------------------------------------
    // The bar shares the bottom of the viewport with the floating navigation
    // toolbar and, in Presentation Mode, the scene carousel. Both are fixed
    // and both can appear or disappear at runtime, so the bar's offset is
    // MEASURED rather than hard-coded: it always sits clear of whatever is
    // actually down there right now.
    // ------------------------------------------------------------
    const PROMPT_UI_BAR_BASE_GAP_PX     = 24;                                                                                       // <-- Gap from the viewport edge when nothing is below
    const PROMPT_UI_BAR_STACK_GAP_PX    = 14;                                                                                       // <-- Gap left between the bar and the UI below it
    const PROMPT_UI_BOTTOM_UI_SELECTORS = [                                                                                         // <-- Bottom-anchored UI the bar must clear
        '.na-pm-carousel--visible',                                                                                                 // <-- Presentation Mode scene carousel
        '#naPmSceneGroupBar',                                                                                                       // <-- Scene group pill; overhangs the carousel's top edge so it reaches higher
        '.na-nav-toolbar'                                                                                                           // <-- Floating navigation toolbar
    ];
    // ------------------------------------------------------------


    // MODULE VARIABLES | Active Mount State
    // ------------------------------------------------------------
    let TrueVision__Pwa__PromptUi__ActiveRootElement     = null;                                                                    // <-- Active root element handle
    let TrueVision__Pwa__PromptUi__ActiveEscapeListener  = null;                                                                    // <-- Stored Escape keydown handler
    let TrueVision__Pwa__PromptUi__ActiveRepositionHook  = null;                                                                    // <-- Stored bar reposition handler
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | DOM Construction Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Create an Element with Class Names and Text
    // ---------------------------------------------------------------
    function TrueVision__Pwa__PromptUi__CreateElement(tagName, classNames, textContent) {
        const elementInstance   = document.createElement(tagName);                                                                  // <-- Create the element
        if (classNames) elementInstance.className = classNames;                                                                     // <-- Apply class names
        if (textContent !== undefined && textContent !== null) elementInstance.textContent = textContent;                           // <-- Apply text safely
        return elementInstance;                                                                                                     // <-- Return the constructed element
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Build the Application Icon Element
    // ---------------------------------------------------------------
    function TrueVision__Pwa__PromptUi__BuildAppIcon(iconUrl, altText) {
        if (!iconUrl) return null;                                                                                                  // <-- No icon configured
        const iconImage         = document.createElement('img');                                                                    // <-- img keeps the PNG crisp
        iconImage.className     = CLASS_APP_ICON;
        iconImage.alt           = altText || 'TrueVision 3D';                                                                       // <-- Accessible label
        iconImage.src           = iconUrl;
        iconImage.draggable     = false;                                                                                            // <-- Prevent drag artefacts
        return iconImage;                                                                                                           // <-- Return the icon element
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Build the Dark Blue Header Bar
    // ---------------------------------------------------------------
    function TrueVision__Pwa__PromptUi__BuildHeader(titleText) {
        const headerElement     = TrueVision__Pwa__PromptUi__CreateElement('div', CLASS_HEADER);                                    // <-- Header container
        headerElement.innerHTML = PROMPT_UI_HEADER_ICON_SVG;                                                                        // <-- Static inline glyph, no user data

        const titleElement      = TrueVision__Pwa__PromptUi__CreateElement('h2', CLASS_TITLE, titleText || 'Install This App');     // <-- Title text
        titleElement.id         = 'naPwaInstallPromptTitle';
        headerElement.appendChild(titleElement);

        return headerElement;                                                                                                       // <-- Return the header
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Build the Numbered Step Panel
    // ---------------------------------------------------------------
    function TrueVision__Pwa__PromptUi__BuildStepPanel(stepEntries, stepsTitle) {
        if (!Array.isArray(stepEntries) || stepEntries.length === 0) return null;                                                   // <-- No steps to render

        const panelElement      = TrueVision__Pwa__PromptUi__CreateElement('div', CLASS_STEPS);                                     // <-- Panel container
        panelElement.appendChild(TrueVision__Pwa__PromptUi__CreateElement('p', CLASS_STEPS_TITLE, stepsTitle || 'How to install'));  // <-- Panel heading

        stepEntries.forEach((stepText, stepIndex) => {
            const rowElement    = TrueVision__Pwa__PromptUi__CreateElement('div', CLASS_STEP_ROW);                                  // <-- Step row
            rowElement.appendChild(TrueVision__Pwa__PromptUi__CreateElement('span', CLASS_STEP_NUMBER, String(stepIndex + 1)));     // <-- Ordinal badge
            rowElement.appendChild(TrueVision__Pwa__PromptUi__CreateElement('span', CLASS_STEP_TEXT, stepText));                    // <-- Instruction text
            panelElement.appendChild(rowElement);
        });

        return panelElement;                                                                                                        // <-- Return the panel
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Build the Action Button Row
    // ---------------------------------------------------------------
    function TrueVision__Pwa__PromptUi__BuildActions(promptConfig, dismissCallback) {
        const actionsElement    = TrueVision__Pwa__PromptUi__CreateElement('div', CLASS_ACTIONS);                                   // <-- Button row container

        const secondaryLabel    = promptConfig.secondaryActionLabel || 'Not Now';                                                   // <-- Default dismiss label
        const secondaryButton   = TrueVision__Pwa__PromptUi__CreateElement('button', `${CLASS_BUTTON} ${CLASS_BUTTON_SECONDARY}`, secondaryLabel);
        secondaryButton.setAttribute('type', 'button');                                                                             // <-- Never submit a form
        secondaryButton.addEventListener('click', dismissCallback);                                                                 // <-- Wire the dismiss route
        actionsElement.appendChild(secondaryButton);                                                                                // <-- Secondary sits on the left

        if (promptConfig.primaryActionLabel && typeof promptConfig.onPrimary === 'function') {
            const primaryButton = TrueVision__Pwa__PromptUi__CreateElement('button', `${CLASS_BUTTON} ${CLASS_BUTTON_PRIMARY}`, promptConfig.primaryActionLabel);
            primaryButton.setAttribute('type', 'button');
            primaryButton.id    = 'naPwaInstallPromptPrimary';
            primaryButton.addEventListener('click', () => {
                try { promptConfig.onPrimary(); }                                                                                   // <-- Invoke the primary handler
                catch (error) { console.warn('[TrueVision3D PWA] Install prompt primary action failed:', error); }                   // <-- Log, never throw
            });
            actionsElement.appendChild(primaryButton);                                                                              // <-- Primary sits on the right
        }

        return actionsElement;                                                                                                      // <-- Return the button row
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Variant Builders
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the Centred Card Layout
    // ---------------------------------------------------------------
    function TrueVision__Pwa__PromptUi__BuildCardLayout(promptConfig, dismissCallback) {
        const cardElement       = TrueVision__Pwa__PromptUi__CreateElement('div', CLASS_CARD);                                      // <-- Card panel
        cardElement.appendChild(TrueVision__Pwa__PromptUi__BuildHeader(promptConfig.title));                                        // <-- Dark blue header bar

        const bodyElement       = TrueVision__Pwa__PromptUi__CreateElement('div', CLASS_BODY);                                      // <-- Body wrapper

        const iconElement       = TrueVision__Pwa__PromptUi__BuildAppIcon(promptConfig.iconUrl, promptConfig.iconAltText);          // <-- Optional app icon
        if (iconElement) bodyElement.appendChild(iconElement);

        if (promptConfig.lead) bodyElement.appendChild(TrueVision__Pwa__PromptUi__CreateElement('p', CLASS_LEAD, promptConfig.lead));// <-- Bold opening sentence
        if (promptConfig.body) bodyElement.appendChild(TrueVision__Pwa__PromptUi__CreateElement('p', CLASS_TEXT, promptConfig.body));// <-- Supporting paragraph

        const stepPanel         = TrueVision__Pwa__PromptUi__BuildStepPanel(promptConfig.steps, promptConfig.stepsTitle);           // <-- Optional steps
        if (stepPanel) bodyElement.appendChild(stepPanel);

        cardElement.appendChild(bodyElement);                                                                                       // <-- Mount the body
        cardElement.appendChild(TrueVision__Pwa__PromptUi__BuildActions(promptConfig, dismissCallback));                            // <-- Mount the actions

        return cardElement;                                                                                                         // <-- Return the card
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Measure How Much of the Bottom Edge Is Already Taken
    // ---------------------------------------------------------------
    // Returns the height, from the bottom of the viewport upwards, occupied by
    // any visible bottom-anchored app UI. Elements that have been moved to the
    // top of the screen (the toolbar does exactly this in Presentation Mode)
    // are ignored, so the bar drops back down when the bottom edge frees up.
    // ---------------------------------------------------------------
    function TrueVision__Pwa__PromptUi__MeasureBottomUiHeight() {
        let occupiedHeight  = 0;                                                                                                    // <-- Tallest intrusion found so far
        const viewportHeight = window.innerHeight;                                                                                  // <-- Snapshot once

        PROMPT_UI_BOTTOM_UI_SELECTORS.forEach((selector) => {
            document.querySelectorAll(selector).forEach((element) => {
                const elementRect = element.getBoundingClientRect();                                                                // <-- Live geometry
                if (elementRect.height <= 0 || elementRect.width <= 0) return;                                                      // <-- Hidden or collapsed
                if (elementRect.top < viewportHeight * 0.5) return;                                                                 // <-- Sitting up top, not our problem

                const intrusion = viewportHeight - elementRect.top;                                                                 // <-- How far up from the bottom it reaches
                if (intrusion > occupiedHeight) occupiedHeight = intrusion;                                                         // <-- Keep the tallest
            });
        });

        return occupiedHeight;                                                                                                      // <-- 0 when the bottom edge is clear
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Place the Bar Clear of the Bottom-Anchored App UI
    // ---------------------------------------------------------------
    function TrueVision__Pwa__PromptUi__PositionBar() {
        const rootElement   = TrueVision__Pwa__PromptUi__ActiveRootElement;                                                         // <-- Active root
        if (!rootElement) return;                                                                                                   // <-- Nothing mounted

        const barElement    = rootElement.querySelector(`.${CLASS_BAR}`);                                                           // <-- Bar panel
        if (!barElement) return;                                                                                                    // <-- Card variant, nothing to place

        const occupiedHeight = TrueVision__Pwa__PromptUi__MeasureBottomUiHeight();                                                  // <-- Measure the bottom edge
        const bottomOffset   = occupiedHeight > 0
            ? Math.round(occupiedHeight + PROMPT_UI_BAR_STACK_GAP_PX)                                                               // <-- Stack above the carousel / toolbar
            : PROMPT_UI_BAR_BASE_GAP_PX;                                                                                            // <-- Bottom edge is clear

        barElement.style.bottom = `${bottomOffset}px`;                                                                              // <-- Apply, overriding the CSS default
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Build the Compact Bottom Bar Layout
    // ---------------------------------------------------------------
    function TrueVision__Pwa__PromptUi__BuildBarLayout(promptConfig, dismissCallback) {
        const barElement        = TrueVision__Pwa__PromptUi__CreateElement('div', CLASS_BAR);                                       // <-- Bar panel

        const iconElement       = TrueVision__Pwa__PromptUi__BuildAppIcon(promptConfig.iconUrl, promptConfig.iconAltText);          // <-- Optional app icon
        if (iconElement) barElement.appendChild(iconElement);

        const textElement       = TrueVision__Pwa__PromptUi__CreateElement('div', CLASS_BAR_TEXT);                                  // <-- Text column
        if (promptConfig.title) textElement.appendChild(TrueVision__Pwa__PromptUi__CreateElement('div', CLASS_BAR_TITLE, promptConfig.title));
        if (promptConfig.lead)  textElement.appendChild(TrueVision__Pwa__PromptUi__CreateElement('div', CLASS_BAR_BODY, promptConfig.lead));
        barElement.appendChild(textElement);

        barElement.appendChild(TrueVision__Pwa__PromptUi__BuildActions(promptConfig, dismissCallback));                             // <-- Mount the actions

        return barElement;                                                                                                          // <-- Return the bar
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Show the Prompt with the Supplied Configuration
    // ------------------------------------------------------------
    function TrueVision__Pwa__PromptUi__Show(promptConfig) {
        if (typeof document === 'undefined' || !document.body) return;                                                              // <-- Guard non-DOM contexts
        TrueVision__Pwa__PromptUi__Hide();                                                                                          // <-- Tear down any existing prompt

        const safeConfig        = promptConfig || {};                                                                               // <-- Never dereference null
        const variantToken      = safeConfig.variant === PROMPT_UI_VARIANT_BAR ? PROMPT_UI_VARIANT_BAR : PROMPT_UI_VARIANT_CARD;    // <-- Resolve the variant

        const rootElement       = TrueVision__Pwa__PromptUi__CreateElement('div', `${CLASS_ROOT} ${CLASS_ROOT}--${variantToken}`);  // <-- Root wrapper
        rootElement.id          = PROMPT_UI_ROOT_ID;
        rootElement.setAttribute('role', 'dialog');
        rootElement.setAttribute('aria-labelledby', 'naPwaInstallPromptTitle');

        const dismissCallback   = function TrueVision__Pwa__PromptUi__OnDismissClick() {
            TrueVision__Pwa__PromptUi__Hide();                                                                                      // <-- Tear down the DOM first
            if (typeof safeConfig.onDismiss === 'function') {
                try { safeConfig.onDismiss(); }                                                                                     // <-- Notify the caller
                catch (error) { console.warn('[TrueVision3D PWA] Install prompt dismiss callback failed:', error); }
            }
        };

        if (variantToken === PROMPT_UI_VARIANT_CARD) {
            rootElement.setAttribute('aria-modal', 'true');                                                                         // <-- Card variant is modal
            const backdropElement = TrueVision__Pwa__PromptUi__CreateElement('div', CLASS_BACKDROP);                                // <-- Dimming backdrop
            backdropElement.addEventListener('click', dismissCallback);                                                             // <-- Click-out dismisses
            rootElement.appendChild(backdropElement);
            rootElement.appendChild(TrueVision__Pwa__PromptUi__BuildCardLayout(safeConfig, dismissCallback));                       // <-- Card body
        } else {
            rootElement.appendChild(TrueVision__Pwa__PromptUi__BuildBarLayout(safeConfig, dismissCallback));                        // <-- Bar body
        }

        document.body.appendChild(rootElement);                                                                                     // <-- Mount under body
        TrueVision__Pwa__PromptUi__ActiveRootElement = rootElement;                                                                 // <-- Track the root reference

        // ESCAPE KEY | Dismiss without installing, matching the full screen card
        // ------------------------------------------------------------
        TrueVision__Pwa__PromptUi__ActiveEscapeListener = (keyEvent) => {
            if (keyEvent.key === 'Escape') dismissCallback();                                                                       // <-- Escape is always a dismissal
        };
        document.addEventListener('keydown', TrueVision__Pwa__PromptUi__ActiveEscapeListener);

        // FADE IN | Force a reflow, then flip the class synchronously.
        // ------------------------------------------------------------
        // requestAnimationFrame is the usual trick here, but it does not fire
        // in a background or non-compositing tab, which would leave the prompt
        // mounted at opacity 0 and inert. Reading offsetWidth commits the
        // starting styles, so adding the class immediately still animates.
        // ------------------------------------------------------------
        TrueVision__Pwa__PromptUi__PositionBar();                                                                                   // <-- Clear the carousel / toolbar before revealing

        void rootElement.offsetWidth;                                                                                               // <-- Commit the initial styles
        rootElement.classList.add(CLASS_ROOT_OPEN);                                                                                 // <-- Trigger the fade-in transition

        // KEEP CLEAR | The carousel can appear, vanish or reflow underneath us
        // ------------------------------------------------------------
        if (variantToken === PROMPT_UI_VARIANT_BAR) {
            TrueVision__Pwa__PromptUi__ActiveRepositionHook = () => TrueVision__Pwa__PromptUi__PositionBar();
            window.addEventListener('resize', TrueVision__Pwa__PromptUi__ActiveRepositionHook);                                     // <-- Rotation and window resize
            window.addEventListener('na-presentation-mode-scenes-loaded', TrueVision__Pwa__PromptUi__ActiveRepositionHook);         // <-- Carousel appears with a new model group
            window.addEventListener('na-presentation-mode-scenes-cleared', TrueVision__Pwa__PromptUi__ActiveRepositionHook);        // <-- Carousel removed with the scenes
        }

        const primaryButton     = document.getElementById('naPwaInstallPromptPrimary');                                             // <-- Keyboard users land on the CTA
        if (primaryButton) primaryButton.focus();
    }
    // ---------------------------------------------------------------


    // FUNCTION | Hide Any Active Prompt
    // ------------------------------------------------------------
    function TrueVision__Pwa__PromptUi__Hide() {
        if (typeof document === 'undefined') return;                                                                                // <-- Guard non-DOM contexts

        if (TrueVision__Pwa__PromptUi__ActiveEscapeListener) {
            document.removeEventListener('keydown', TrueVision__Pwa__PromptUi__ActiveEscapeListener);                                // <-- Release the Escape handler
            TrueVision__Pwa__PromptUi__ActiveEscapeListener = null;
        }

        if (TrueVision__Pwa__PromptUi__ActiveRepositionHook) {
            window.removeEventListener('resize', TrueVision__Pwa__PromptUi__ActiveRepositionHook);                                   // <-- Release the reposition handlers
            window.removeEventListener('na-presentation-mode-scenes-loaded', TrueVision__Pwa__PromptUi__ActiveRepositionHook);
            window.removeEventListener('na-presentation-mode-scenes-cleared', TrueVision__Pwa__PromptUi__ActiveRepositionHook);
            TrueVision__Pwa__PromptUi__ActiveRepositionHook = null;
        }

        const existingRoot      = document.getElementById(PROMPT_UI_ROOT_ID);                                                       // <-- Look up the live root
        if (existingRoot && existingRoot.parentNode) {
            existingRoot.parentNode.removeChild(existingRoot);                                                                      // <-- Remove from the DOM
        }

        TrueVision__Pwa__PromptUi__ActiveRootElement = null;                                                                        // <-- Clear the cached root
    }
    // ---------------------------------------------------------------


    // FUNCTION | Check Whether the Prompt Is Currently Visible
    // ------------------------------------------------------------
    function TrueVision__Pwa__PromptUi__IsVisible() {
        if (typeof document === 'undefined') return false;                                                                          // <-- Guard non-DOM contexts
        return Boolean(document.getElementById(PROMPT_UI_ROOT_ID));                                                                 // <-- Simple presence check
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Global Exposure
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Global Prompt UI Namespace
    // ------------------------------------------------------------
    function TrueVision__Pwa__PromptUi__InitializeGlobalNamespace() {
        if (typeof window === 'undefined') return;                                                                                  // <-- Guard non-window contexts

        window.TrueVision__Pwa__PromptUi = {                                                                                        // <-- Public API surface
            show        : TrueVision__Pwa__PromptUi__Show,
            hide        : TrueVision__Pwa__PromptUi__Hide,
            isVisible   : TrueVision__Pwa__PromptUi__IsVisible,
            Variants    : {
                Card    : PROMPT_UI_VARIANT_CARD,
                Bar     : PROMPT_UI_VARIANT_BAR
            }
        };
    }
    // ---------------------------------------------------------------


    TrueVision__Pwa__PromptUi__InitializeGlobalNamespace();                                                                         // <-- Mount on window immediately

// endregion -------------------------------------------------------------------

})();
