// =============================================================================
// TRUEVISION3D - FEATURE - PHONE UI
// =============================================================================
//
// FILE       : Na__Feature__PhoneUi__.js
// NAMESPACE  : Na__PhoneUi
// MODULE     : Feature - Phone UI
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Run the phone layout: fold the top bar away once the model is
//              on screen and let it be pulled back down; open and close the
//              navigation and Tools & Settings corner icons; wake the view
//              carousel while it is touched and let it shrink and fade after
// CREATED    : 16-Nov-2026
//
// DESCRIPTION:
// - PHONES ONLY, EVERY PHONE (Adam, 16-Nov-2026, three NP03 phone shots: the
//   carousel and the top bar "like ValeVision" on a phone, because "it frees
//   up screen space"). Index.html's head script marks <html class="na-phone-ui">
//   (and data-na-device="phone") on a phone, decided by what the device is: an
//   iPhone, an Android whose browser says Mobile, or a browser whose own mobile
//   flag is set. Never by screen size: a computer, touchscreen or not, keeps
//   its top bar (Adam's rule for ValeVision 3D v2.81.4). To see it on a
//   computer, use the browser's device emulation with a phone selected.
//   Without that class this module does nothing.
// - THE TOP BAR: down on landing, folds away 2 s after the model shows, at
//   the drawing tabs' own fold pace (Na__Feature__PhoneUi__Stylesheet__.css).
//   Held upright it never folds (the stylesheet). The pull tab under it brings
//   it back: tap it, or drag it down (it follows the finger, then snaps). Down
//   again, it folds by itself after 5 s untouched, or at once on a touch on
//   the model; never while a menu in the bar is open.
// - THE NAVIGATION (top left): the active mode's icon alone. The first press
//   opens it into the row (Orbit, Walk, Fly, Before / After, Reset View, Help)
//   and does nothing else; a press in the open row acts, then the row closes.
//   It also closes after 4 s untouched or on a touch anywhere else.
// - TOOLS & SETTINGS (top right): its icon alone until pressed (the styles).
//   Opening one corner closes the other.
// - THE VIEW CAROUSEL: 50% and faded while idle, 75% while in use (60% and
//   85% upright). A touch wakes it for 3 s after the last touch. The first tap
//   on an idle carousel only wakes it, so a small picture is never picked by
//   accident. The carousel's own wake (a scene's camera flight) keeps it
//   awake too.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 02__Src__AppModules/65__Feature__PhoneUi/Na__Feature__PhoneUi__.js
// - Source version: 1.0.2 (ValeVision3D v2.81.4, 29-Oct-2026)
// - Ported on     : 16-Nov-2026 for TrueVision3D v2.187.0
// - Parity        : adapted
// - Divergences   :
//   - No person menu in TrueVision's bar: the bar is held down while any menu
//     in it is open (the localhost Dev Tools flyout) instead.
//   - No client tour in TrueVision: the tour watcher is left out.
//   - Na__Feature__PhoneUi__ShowHeader is left out: nothing here needs the bar
//     brought down from outside.
//   - The drawing tab strip rides under the bar, and a drawing tab keeps the
//     bar folded (the stylesheet).
// - Back-port     : none pending.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 16-Nov-2026 - Version 1.0.0
// - Initial release (TrueVision3D v2.187.0), from ValeVision 3D's 1.0.2.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Classes and the One Custom Property
    // ------------------------------------------------------------
    const Na__PhoneUi__HTML_CLASS     = 'na-phone-ui';
    const Na__PhoneUi__FOLDED         = 'na-phone-ui--folded';
    const Na__PhoneUi__DRAGGING       = 'na-phone-ui--dragging';
    const Na__PhoneUi__SNAPPING       = 'na-phone-ui--snapping';
    const Na__PhoneUi__NAV_OPEN       = 'na-phone-nav--open';
    const Na__PhoneUi__AWAKE          = 'na-phone-ui--awake';
    const Na__PhoneUi__SHOWN_VAR      = '--na-phone-header-shown';
    const Na__PhoneUi__SCENE_READY    = 'na-app-scene-ready';                      // <-- Na__AppFlow__LoadingSequence: the model is on screen
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Timings
    // ------------------------------------------------------------
    const Na__PhoneUi__LAND_HOLD_MS   = 2000;                                      // <-- Branded beat after the model shows, then the fold
    const Na__PhoneUi__REFOLD_MS      = 5000;                                      // <-- Pulled down and left alone
    const Na__PhoneUi__NAV_IDLE_MS    = 4000;                                      // <-- The open row, left alone
    const Na__PhoneUi__NAV_AFTER_MS   = 350;                                       // <-- A mode picked: let it show, then close
    const Na__PhoneUi__CAROUSEL_MS    = 3000;                                      // <-- Awake after the last touch
    const Na__PhoneUi__SNAP_MS        = 400;
    const Na__PhoneUi__TAP_PX         = 6;                                         // <-- Less movement than this is a tap, not a drag
    // ------------------------------------------------------------

    // MODULE VARIABLES | Runtime State
    // ------------------------------------------------------------
    const Na__PhoneUi__State = {
        started : false, header : null, nav : null, tools : null, carousel : null, pull : null,
        refoldTimer : 0, navTimer : 0, carouselTimer : 0, snapTimer : 0,
        drag : null, carouselWasIdle : false
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Small Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Is This a Phone? (Index.html's head script decided)
    // ------------------------------------------------------------
    function Na__PhoneUi__IsPhone() {
        return document.documentElement.classList.contains(Na__PhoneUi__HTML_CLASS);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Bar's Full Height in Pixels
    // ------------------------------------------------------------
    function Na__PhoneUi__BarHeight() {
        const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--Vale_HeaderHeight'));
        return value > 0 ? value : 54;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is a Menu in the Bar Open? (never fold it away under a finger)
    // ------------------------------------------------------------
    function Na__PhoneUi__BarMenuOpen() {
        return !!document.querySelector('.app-header details[open]');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Top Bar: Fold, Unfold, Drag
// -----------------------------------------------------------------------------

    // FUNCTION | Fold the Bar Away (or Bring It Down); snap = the shorter 380ms after a drag
    // ------------------------------------------------------------
    function Na__PhoneUi__SetFolded(folded, snap) {
        const html = document.documentElement;
        const state = Na__PhoneUi__State;
        clearTimeout(state.refoldTimer);
        if (folded && Na__PhoneUi__BarMenuOpen()) {                             // <-- Someone is using the bar: ask again shortly
            state.refoldTimer = setTimeout(() => Na__PhoneUi__SetFolded(true), Na__PhoneUi__REFOLD_MS);
            return;
        }
        if (snap) {
            html.classList.add(Na__PhoneUi__SNAPPING);
            clearTimeout(state.snapTimer);
            state.snapTimer = setTimeout(() => html.classList.remove(Na__PhoneUi__SNAPPING), Na__PhoneUi__SNAP_MS);
        }
        html.style.removeProperty(Na__PhoneUi__SHOWN_VAR);                      // <-- Any drag position gives way to the class
        html.classList.toggle(Na__PhoneUi__FOLDED, !!folded);
        if (state.pull) state.pull.setAttribute('aria-label', folded ? 'Show the top bar' : 'Hide the top bar');
        if (!folded) state.refoldTimer = setTimeout(() => Na__PhoneUi__SetFolded(true), Na__PhoneUi__REFOLD_MS);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Pull Tab: a Tap Toggles, a Drag Follows the Finger
    // ------------------------------------------------------------
    function Na__PhoneUi__WirePull(pull) {
        const html = document.documentElement;
        const state = Na__PhoneUi__State;

        pull.addEventListener('pointerdown', (event) => {
            const height = Na__PhoneUi__BarHeight();
            const shown = html.classList.contains(Na__PhoneUi__FOLDED) ? 0 : height;
            state.drag = { id : event.pointerId, startY : event.clientY, shown, height, moved : false };
            clearTimeout(state.refoldTimer);
            try { pull.setPointerCapture(event.pointerId); } catch (error) { /* older browser: moves still arrive */ }
            event.preventDefault();
        });

        pull.addEventListener('pointermove', (event) => {
            const drag = state.drag;
            if (!drag || drag.id !== event.pointerId) return;
            const dy = event.clientY - drag.startY;
            if (!drag.moved && Math.abs(dy) < Na__PhoneUi__TAP_PX) return;
            if (!drag.moved) {
                drag.moved = true;
                html.classList.add(Na__PhoneUi__DRAGGING);
            }
            const shown = Math.max(0, Math.min(drag.height, drag.shown + dy));
            html.style.setProperty(Na__PhoneUi__SHOWN_VAR, `${shown}px`);
            drag.now = shown;
        });

        const finish = (event) => {
            const drag = state.drag;
            if (!drag || drag.id !== event.pointerId) return;
            state.drag = null;
            html.classList.remove(Na__PhoneUi__DRAGGING);
            if (!drag.moved) {                                                   // <-- A tap: the other way
                Na__PhoneUi__SetFolded(!html.classList.contains(Na__PhoneUi__FOLDED), true);
                return;
            }
            Na__PhoneUi__SetFolded((drag.now || 0) < drag.height / 2, true);     // <-- Past halfway down stays down
        };
        pull.addEventListener('pointerup', finish);
        pull.addEventListener('pointercancel', finish);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fold Once, a Beat After the Model Shows
    // ------------------------------------------------------------
    function Na__PhoneUi__FoldAfterLanding() {
        const fold = () => setTimeout(() => {
            if (!Na__PhoneUi__State.drag) Na__PhoneUi__SetFolded(true);
        }, Na__PhoneUi__LAND_HOLD_MS);
        const canvas = document.getElementById('renderCanvas');
        if (canvas && canvas.classList.contains('canvas-visible')) fold();     // <-- Already on screen
        else window.addEventListener(Na__PhoneUi__SCENE_READY, fold, { once : true });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Navigation Corner
// -----------------------------------------------------------------------------

    // FUNCTION | Open or Close the Row
    // ------------------------------------------------------------
    function Na__PhoneUi__SetNavOpen(open) {
        const state = Na__PhoneUi__State;
        if (!state.nav) return;
        clearTimeout(state.navTimer);
        state.nav.classList.toggle(Na__PhoneUi__NAV_OPEN, !!open);
        if (open) {
            Na__PhoneUi__SetToolsOpen(false);
            state.navTimer = setTimeout(() => Na__PhoneUi__SetNavOpen(false), Na__PhoneUi__NAV_IDLE_MS);
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Press on the Corner: the First Opens It, a Press in the Open Row Acts and Closes It
    // ------------------------------------------------------------
    function Na__PhoneUi__WireNav(nav) {
        nav.addEventListener('click', (event) => {
            if (!nav.classList.contains(Na__PhoneUi__NAV_OPEN)) {
                event.preventDefault();
                event.stopPropagation();                                         // <-- Capture on the bar: the button's own handler never hears it
                Na__PhoneUi__SetNavOpen(true);
                return;
            }
            const state = Na__PhoneUi__State;
            clearTimeout(state.navTimer);
            state.navTimer = setTimeout(() => Na__PhoneUi__SetNavOpen(false), Na__PhoneUi__NAV_AFTER_MS);
        }, true);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Tools & Settings Corner
// -----------------------------------------------------------------------------

    // FUNCTION | Close (or Open) Tools & Settings
    // ------------------------------------------------------------
    function Na__PhoneUi__SetToolsOpen(open) {
        const tools = Na__PhoneUi__State.tools;
        if (!tools) return;
        if (open) tools.setAttribute('open', 'open');
        else tools.removeAttribute('open');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The View Carousel
// -----------------------------------------------------------------------------

    // FUNCTION | Wake the Carousel, and Let It Shrink and Fade 3 s After the Last Touch
    // ------------------------------------------------------------
    function Na__PhoneUi__WakeCarousel() {
        const state = Na__PhoneUi__State;
        if (!state.carousel) return;
        state.carousel.classList.add(Na__PhoneUi__AWAKE);
        clearTimeout(state.carouselTimer);
        state.carouselTimer = setTimeout(() => state.carousel.classList.remove(Na__PhoneUi__AWAKE), Na__PhoneUi__CAROUSEL_MS);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Touches on the Carousel (the first tap on an idle one only wakes it)
    // ------------------------------------------------------------
    function Na__PhoneUi__WireCarousel(carousel) {
        const state = Na__PhoneUi__State;
        const isAwake = () => carousel.classList.contains(Na__PhoneUi__AWAKE) || carousel.classList.contains('na-pm-carousel--wake');
        carousel.addEventListener('pointerdown', () => {
            state.carouselWasIdle = !isAwake();
            Na__PhoneUi__WakeCarousel();
        }, true);
        carousel.addEventListener('click', (event) => {
            if (state.carouselWasIdle) {
                state.carouselWasIdle = false;
                event.preventDefault();
                event.stopPropagation();                                         // <-- Waking is all the first tap does
            }
            Na__PhoneUi__WakeCarousel();
        }, true);
        ['pointermove', 'wheel', 'scroll'].forEach((name) => {
            carousel.addEventListener(name, () => { if (isAwake()) Na__PhoneUi__WakeCarousel(); }, { capture : true, passive : true });
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Touches Elsewhere
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Touch Outside: Close the Open Corners; on the Model, Fold the Bar
    // ------------------------------------------------------------
    function Na__PhoneUi__OnPointerDown(event) {
        const state = Na__PhoneUi__State;
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (state.nav && !state.nav.contains(target)) Na__PhoneUi__SetNavOpen(false);
        if (state.tools && state.tools.hasAttribute('open') && !state.tools.contains(target)
            && !target.closest('.na-dropdown-menu, .na-confirm-dialog, .na-nav-help')) {
            Na__PhoneUi__SetToolsOpen(false);
        }
        if (target.id === 'renderCanvas' && !document.documentElement.classList.contains(Na__PhoneUi__FOLDED)
            && !Na__PhoneUi__BarMenuOpen() && state.header && state.header.dataset.naPhoneLanded === '1') {
            Na__PhoneUi__SetFolded(true, true);
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Start the Phone Layout (Index.html, once the toolbar, menu and carousel exist)
    // ------------------------------------------------------------
    function Na__Feature__PhoneUi__Initialize() {
        const state = Na__PhoneUi__State;
        if (state.started || !Na__PhoneUi__IsPhone()) return;
        state.started = true;

        state.header = document.querySelector('.app-header');
        state.nav = document.getElementById('naNavToolbar');
        state.tools = document.getElementById('naToolsMenu');
        state.carousel = document.getElementById('naPresentationCarousel');

        // THE PULL TAB | Hangs under the bar
        const pull = document.createElement('button');
        pull.type = 'button';
        pull.className = 'na-phone-ui__pull';
        pull.setAttribute('aria-label', 'Hide the top bar');
        document.body.appendChild(pull);
        state.pull = pull;
        Na__PhoneUi__WirePull(pull);

        // THE BAR | Down on landing; touching it keeps it down a while longer
        if (state.header) {
            state.header.addEventListener('pointerdown', () => {
                if (!document.documentElement.classList.contains(Na__PhoneUi__FOLDED)) Na__PhoneUi__SetFolded(false);
            });
        }
        Na__PhoneUi__FoldAfterLanding();
        window.addEventListener(Na__PhoneUi__SCENE_READY, () => {
            if (state.header) state.header.dataset.naPhoneLanded = '1';
        }, { once : true });
        const canvas = document.getElementById('renderCanvas');
        if (canvas && canvas.classList.contains('canvas-visible') && state.header) state.header.dataset.naPhoneLanded = '1';

        // THE CORNERS AND THE CAROUSEL
        if (state.nav) Na__PhoneUi__WireNav(state.nav);
        if (state.tools) {
            state.tools.addEventListener('toggle', () => {
                if (state.tools.hasAttribute('open')) Na__PhoneUi__SetNavOpen(false);
            });
        }
        if (state.carousel) Na__PhoneUi__WireCarousel(state.carousel);

        document.addEventListener('pointerdown', Na__PhoneUi__OnPointerDown, { capture : true, passive : true });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Phone UI API
    // ------------------------------------------------------------
    export {
        Na__Feature__PhoneUi__Initialize
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
