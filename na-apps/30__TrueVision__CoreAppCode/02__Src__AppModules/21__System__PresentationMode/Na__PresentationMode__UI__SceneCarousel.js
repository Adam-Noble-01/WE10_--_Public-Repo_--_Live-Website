// =============================================================================
// TRUEVISION3D - PRESENTATION MODE - SCENE CAROUSEL UI
// =============================================================================
//
// FILE       : Na__PresentationMode__UI__SceneCarousel.js
// NAMESPACE  : Na__PresentationMode
// MODULE     : PresentationMode - Scene Carousel UI
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Render and manage the bottom thumbnail carousel for saved camera
//              scenes; handle adaptive layout when Presentation Mode is active
// CREATED    : 21-Jun-2026
//
// DESCRIPTION:
// - Listens for 'na-presentation-mode-scenes-loaded' dispatched by the loading
//   sequence (or live dev-editor edits). When received it builds the carousel
//   DOM, applies the top-toolbar adaptive layout class, and shows the carousel
//   when configured.
// - Each carousel card shows the scene thumbnail (WebP), scene name, and an
//   active highlight ring.
// - Previous / Next chevron buttons step through scenes by Order.
// - Clicking a thumbnail card triggers an animated camera transition.
// - The carousel has no user-facing toggle: it is always shown while the
//   loaded project has valid saved scenes (it is everyone's primary quick
//   transition tool) and hidden only when the scenes are cleared.
// - Idle fade: like the other menus the carousel rests at 50% opacity. Any
//   tap, swipe or click flashes the na-pm-carousel--wake class, holding it
//   opaque long enough to cover the 1.8s scene camera flight before the CSS
//   fades it back out. Hover and keyboard focus wake it via pure CSS.
// - na-presentation-mode-active class on <body> drives the CSS layout switch.
//
// INTEGRATION:
// - Initialized from Index.html main module after the other UI modules.
// - Requires camera and controls references passed via InitializeSceneCarousel.
// - Reads scene config from Na__PresentationMode__ProjectJson__SceneData.js.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Jun-2026 - Version 1.0.0
// - Ported from ValeVision3D. Scene config registration now folder + year aware
//   so thumbnails resolve against the TrueVision R2 CDN content path.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Scene Data Helpers
    // ------------------------------------------------------------
    import {
        Na__PresentationMode__ProjectJson__SetActiveConfig,
        Na__PresentationMode__ProjectJson__GetActiveConfig,
        Na__PresentationMode__ProjectJson__GetSortedScenes,
        Na__PresentationMode__ProjectJson__GetDefaultScene,
        Na__PresentationMode__ProjectJson__GetSceneById,
        Na__PresentationMode__ProjectJson__ResolveThumbnailUrl,
        Na__PresentationMode__ProjectJson__SetActiveSceneId,
        Na__PresentationMode__ProjectJson__GetActiveSceneId
    } from './Na__PresentationMode__ProjectJson__SceneData.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Camera Scene Transition
    // ------------------------------------------------------------
    import {
        Na__PresentationMode__Camera__AnimateToScene,
        Na__PresentationMode__Camera__ApplySceneCameraState
    } from './Na__PresentationMode__Camera__SceneTransition.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Configuration Defaults
    // ------------------------------------------------------------
    const Na__PresentationMode__UI__ACTIVE_BODY_CLASS  = 'na-presentation-mode-active'; // <-- Body class that drives top-toolbar layout
    const Na__PresentationMode__UI__CAROUSEL_ID        = 'naPresentationCarousel';      // <-- Root carousel container id
    const Na__PresentationMode__UI__WAKE_CLASS         = 'na-pm-carousel--wake';        // <-- Short-lived opaque flash while the carousel is in use
    const Na__PresentationMode__UI__WakeHoldMs         = 2600;                          // <-- Opaque hold: covers the 1.8s camera flight plus a beat
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Carousel Runtime State
    // ------------------------------------------------------------
    let Na__PresentationMode__UI__Camera          = null;   // <-- Live Three.js PerspectiveCamera reference
    let Na__PresentationMode__UI__Controls        = null;   // <-- Live OrbitControls reference
    let Na__PresentationMode__UI__IsInitialized   = false;  // <-- Guard against double initialization
    let Na__PresentationMode__UI__WakeTimerHandle = null;   // <-- Pending carousel wake-flash timeout (or null)
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Adaptive Layout
// -----------------------------------------------------------------------------

    // FUNCTION | Apply or Remove the Adaptive Presentation Mode Layout Class
    // ------------------------------------------------------------
    function Na__PresentationMode__UI__ApplyAdaptiveLayout(active) {
        if (active) {
            document.body.classList.add(Na__PresentationMode__UI__ACTIVE_BODY_CLASS);     // <-- Switch to top toolbar layout
        } else {
            document.body.classList.remove(Na__PresentationMode__UI__ACTIVE_BODY_CLASS);  // <-- Restore bottom toolbar
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Carousel DOM Construction
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build a Single Scene Card Element
    // ------------------------------------------------------------
    function Na__PresentationMode__UI__BuildSceneCard(scene, isActive) {
        const card = document.createElement('button');
        card.className       = 'na-pm-carousel__card' + (isActive ? ' na-pm-carousel__card--active' : '');
        card.type            = 'button';
        card.dataset.sceneId = scene.PresentationMode__Scene__Id;
        card.title           = scene.PresentationMode__Scene__Name || '';
        card.setAttribute('aria-pressed', isActive ? 'true' : 'false');

        const thumbUrl = Na__PresentationMode__ProjectJson__ResolveThumbnailUrl(scene);

        if (thumbUrl) {
            const img = document.createElement('img');
            img.className = 'na-pm-carousel__thumb';
            img.src       = thumbUrl;
            img.alt       = scene.PresentationMode__Scene__Name || '';
            img.loading   = 'lazy';
            card.appendChild(img);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'na-pm-carousel__thumb na-pm-carousel__thumb--placeholder';
            placeholder.textContent = 'IMG';                                 // <-- Placeholder for missing thumbnails
            card.appendChild(placeholder);
        }

        const label = document.createElement('span');
        label.className = 'na-pm-carousel__label';
        label.textContent = scene.PresentationMode__Scene__Name || '';
        card.appendChild(label);

        return card;
    }
    // ------------------------------------------------------------


    // FUNCTION | Render the Full Carousel into #naPresentationCarousel
    // ------------------------------------------------------------
    function Na__PresentationMode__UI__RenderSceneCarousel() {
        const container = document.getElementById(Na__PresentationMode__UI__CAROUSEL_ID);
        if (!container) return;

        container.innerHTML = '';                                            // <-- Clear any existing carousel

        const scenes      = Na__PresentationMode__ProjectJson__GetSortedScenes();
        if (scenes.length === 0) return;

        const activeId    = Na__PresentationMode__ProjectJson__GetActiveSceneId();

        // PREV BUTTON
        const prevBtn = document.createElement('button');
        prevBtn.type      = 'button';
        prevBtn.className = 'na-pm-carousel__nav na-pm-carousel__nav--prev';
        prevBtn.innerHTML = '&#8249;';                                       // <-- Single left angle quotation
        prevBtn.setAttribute('aria-label', 'Previous scene');
        prevBtn.addEventListener('click', Na__PresentationMode__UI__HandlePrevClick);
        container.appendChild(prevBtn);

        // CARDS WRAPPER
        const cardsWrapper = document.createElement('div');
        cardsWrapper.className = 'na-pm-carousel__cards';
        cardsWrapper.id        = 'naPmCarouselCards';

        scenes.forEach((scene) => {
            const isActive = scene.PresentationMode__Scene__Id === activeId;
            const card     = Na__PresentationMode__UI__BuildSceneCard(scene, isActive);
            card.addEventListener('click', () => Na__PresentationMode__UI__HandleCardClick(scene.PresentationMode__Scene__Id));
            cardsWrapper.appendChild(card);
        });

        container.appendChild(cardsWrapper);

        // NEXT BUTTON
        const nextBtn = document.createElement('button');
        nextBtn.type      = 'button';
        nextBtn.className = 'na-pm-carousel__nav na-pm-carousel__nav--next';
        nextBtn.innerHTML = '&#8250;';                                       // <-- Single right angle quotation
        nextBtn.setAttribute('aria-label', 'Next scene');
        nextBtn.addEventListener('click', Na__PresentationMode__UI__HandleNextClick);
        container.appendChild(nextBtn);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Active Scene Management
// -----------------------------------------------------------------------------

    // FUNCTION | Set Active Scene and Re-Render Carousel Highlights
    // ------------------------------------------------------------
    function Na__PresentationMode__UI__SetActiveScene(sceneId) {
        Na__PresentationMode__ProjectJson__SetActiveSceneId(sceneId);       // <-- Persist in data layer

        const cards = document.querySelectorAll('.na-pm-carousel__card');
        cards.forEach((card) => {
            const isActive = card.dataset.sceneId === sceneId;
            card.classList.toggle('na-pm-carousel__card--active', isActive);
            card.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });

        const activeCard = document.querySelector(`.na-pm-carousel__card[data-scene-id="${CSS.escape(sceneId)}"]`);
        if (activeCard) {
            activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Get Scene Adjacent to the Active Scene by Offset
    // ------------------------------------------------------------
    function Na__PresentationMode__UI__GetAdjacentScene(offset) {
        const scenes  = Na__PresentationMode__ProjectJson__GetSortedScenes();
        if (scenes.length === 0) return null;

        const activeId    = Na__PresentationMode__ProjectJson__GetActiveSceneId();
        const currentIdx  = scenes.findIndex(s => s.PresentationMode__Scene__Id === activeId);
        const baseIdx     = currentIdx >= 0 ? currentIdx : 0;
        const nextIdx     = (baseIdx + offset + scenes.length) % scenes.length; // <-- Wrap around

        return scenes[nextIdx] || null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | User Interaction Handlers
// -----------------------------------------------------------------------------

    // FUNCTION | Handle Thumbnail Card Click
    // ------------------------------------------------------------
    function Na__PresentationMode__UI__HandleCardClick(sceneId) {
        const config    = Na__PresentationMode__ProjectJson__GetActiveConfig();
        const scene     = Na__PresentationMode__ProjectJson__GetSceneById(config, sceneId);
        if (!scene) return;

        Na__PresentationMode__Camera__AnimateToScene(
            Na__PresentationMode__UI__Camera,
            Na__PresentationMode__UI__Controls,
            scene,
            { onComplete : () => Na__PresentationMode__UI__SetActiveScene(sceneId) }
        );

        Na__PresentationMode__UI__SetActiveScene(sceneId);                  // <-- Update highlight immediately
    }
    // ------------------------------------------------------------


    // FUNCTION | Handle Previous Button Click
    // ------------------------------------------------------------
    function Na__PresentationMode__UI__HandlePrevClick() {
        const prevScene = Na__PresentationMode__UI__GetAdjacentScene(-1);
        if (!prevScene) return;

        const sceneId = prevScene.PresentationMode__Scene__Id;
        Na__PresentationMode__Camera__AnimateToScene(
            Na__PresentationMode__UI__Camera,
            Na__PresentationMode__UI__Controls,
            prevScene,
            { onComplete : () => Na__PresentationMode__UI__SetActiveScene(sceneId) }
        );

        Na__PresentationMode__UI__SetActiveScene(sceneId);
    }
    // ------------------------------------------------------------


    // FUNCTION | Handle Next Button Click
    // ------------------------------------------------------------
    function Na__PresentationMode__UI__HandleNextClick() {
        const nextScene = Na__PresentationMode__UI__GetAdjacentScene(1);
        if (!nextScene) return;

        const sceneId = nextScene.PresentationMode__Scene__Id;
        Na__PresentationMode__Camera__AnimateToScene(
            Na__PresentationMode__UI__Camera,
            Na__PresentationMode__UI__Controls,
            nextScene,
            { onComplete : () => Na__PresentationMode__UI__SetActiveScene(sceneId) }
        );

        Na__PresentationMode__UI__SetActiveScene(sceneId);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Carousel Visibility
// -----------------------------------------------------------------------------

    // FUNCTION | Briefly Wake the Carousel so It Reads Opaque While In Use
    // ------------------------------------------------------------
    // Hover and keyboard focus are pure CSS. This flash covers everything
    // CSS cannot see on a touchscreen: taps, swipes of the card strip, and
    // the camera flight after picking a scene. Each interaction restarts
    // the hold, so the carousel only fades back out once it is left alone.
    // ------------------------------------------------------------
    function Na__PresentationMode__UI__FlashCarouselWake() {
        const container = document.getElementById(Na__PresentationMode__UI__CAROUSEL_ID);
        if (!container) return;

        container.classList.add(Na__PresentationMode__UI__WAKE_CLASS);       // <-- Opaque + shadow via CSS

        if (Na__PresentationMode__UI__WakeTimerHandle !== null) {
            clearTimeout(Na__PresentationMode__UI__WakeTimerHandle);         // <-- Restart any pending fade-out
        }

        Na__PresentationMode__UI__WakeTimerHandle = setTimeout(() => {
            Na__PresentationMode__UI__WakeTimerHandle = null;
            container.classList.remove(Na__PresentationMode__UI__WAKE_CLASS); // <-- Fade back to idle (0.3s CSS)
        }, Na__PresentationMode__UI__WakeHoldMs);
    }
    // ------------------------------------------------------------


    // FUNCTION | Show or Hide the Carousel
    // ------------------------------------------------------------
    // No user-facing toggle exists any more: the carousel always shows while
    // valid saved scenes are loaded, and hides only when they are cleared.
    // Revealing flashes the wake class, so the carousel appears fully opaque
    // (announcing itself), holds, then fades to its translucent idle state.
    // ------------------------------------------------------------
    function Na__PresentationMode__UI__SetCarouselVisible(visible) {
        const container = document.getElementById(Na__PresentationMode__UI__CAROUSEL_ID);
        if (!container) return;

        container.classList.toggle('na-pm-carousel--visible', visible === true);

        if (visible === true) {
            Na__PresentationMode__UI__FlashCarouselWake();                   // <-- Arrive opaque, then fade out to idle
        } else {
            if (Na__PresentationMode__UI__WakeTimerHandle !== null) {
                clearTimeout(Na__PresentationMode__UI__WakeTimerHandle);     // <-- Cancel any pending fade-out
                Na__PresentationMode__UI__WakeTimerHandle = null;
            }
            container.classList.remove(Na__PresentationMode__UI__WAKE_CLASS); // <-- Reset wake state while hidden
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Scene Carousel (called from Index.html main module)
    // ------------------------------------------------------------
    function Na__PresentationMode__UI__InitializeSceneCarousel(camera, controls) {
        if (Na__PresentationMode__UI__IsInitialized) return;               // <-- Guard double init
        Na__PresentationMode__UI__IsInitialized = true;

        Na__PresentationMode__UI__Camera   = camera;                       // <-- Store for transition calls
        Na__PresentationMode__UI__Controls = controls;

        // WAKE ON INTERACTION | Delegated on the persistent container element
        // ------------------------------------------------------------
        // pointerdown catches taps, clicks and the start of a swipe; the
        // capture-phase scroll listener catches the card strip's momentum
        // scrolling (scroll does not bubble, but it does capture). The
        // container survives re-renders, so these are wired exactly once.
        // ------------------------------------------------------------
        const Na__CarouselContainer = document.getElementById(Na__PresentationMode__UI__CAROUSEL_ID);
        if (Na__CarouselContainer) {
            Na__CarouselContainer.addEventListener('pointerdown', Na__PresentationMode__UI__FlashCarouselWake);
            Na__CarouselContainer.addEventListener('scroll', Na__PresentationMode__UI__FlashCarouselWake, true);
        }

        // LISTEN FOR SCENES LOADED from loading sequence OR live dev-editor edits
        window.addEventListener('na-presentation-mode-scenes-loaded', (event) => {
            const detail      = event.detail || {};
            const sceneConfig = detail.sceneConfig;
            if (!sceneConfig) return;

            const projectFolder   = detail.projectFolder || null;
            const yearCode        = detail.year || null;
            const skipCameraApply = detail.skipCameraApply === true;

            Na__PresentationMode__ProjectJson__SetActiveConfig(sceneConfig, projectFolder, yearCode); // <-- Store in data layer

            // SET DEFAULT SCENE
            const defaultScene = Na__PresentationMode__ProjectJson__GetDefaultScene(sceneConfig);
            if (defaultScene) {
                Na__PresentationMode__ProjectJson__SetActiveSceneId(defaultScene.PresentationMode__Scene__Id);
                if (!skipCameraApply) {
                    Na__PresentationMode__Camera__ApplySceneCameraState(camera, controls, defaultScene); // <-- Jump to default scene
                }
            }

            // BUILD CAROUSEL UI
            Na__PresentationMode__UI__RenderSceneCarousel();

            // SWITCH TO ADAPTIVE LAYOUT
            Na__PresentationMode__UI__ApplyAdaptiveLayout(true);

            // SHOW CAROUSEL | Always visible while valid scenes are loaded
            Na__PresentationMode__UI__SetCarouselVisible(true);

            console.log('[TrueVision3D] Presentation Mode carousel initialized.');
        });

        // LISTEN FOR SCENES CLEARED (dev editor removed all scenes)
        window.addEventListener('na-presentation-mode-scenes-cleared', () => {
            Na__PresentationMode__UI__SetCarouselVisible(false);             // <-- Hide carousel
            Na__PresentationMode__UI__ApplyAdaptiveLayout(false);            // <-- Restore bottom-centre toolbar layout
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Scene Carousel UI API
    // ------------------------------------------------------------
    export {
        Na__PresentationMode__UI__InitializeSceneCarousel,
        Na__PresentationMode__UI__RenderSceneCarousel,
        Na__PresentationMode__UI__SetActiveScene,
        Na__PresentationMode__UI__ApplyAdaptiveLayout
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
