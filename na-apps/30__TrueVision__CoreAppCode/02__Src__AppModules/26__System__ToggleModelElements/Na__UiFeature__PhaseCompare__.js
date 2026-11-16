// =============================================================================
// TRUEVISION3D - PHASE COMPARE - EXISTING AND PROPOSED
// =============================================================================
//
// FILE       : Na__UiFeature__PhaseCompare__.js
// NAMESPACE  : Na__PhaseCompare
// MODULE     : ToggleModelElements - Phase Compare
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Compare the existing building with the proposal by dragging a line across the model
// CREATED    : 15-Nov-2026
//
// DESCRIPTION:
// - A project with an existing building AND a proposal gets a Before / After
//   button in the navigation toolbar. Pressing it brings a vertical line onto
//   the model: the existing building is drawn to its left, the proposal to its
//   right, through the one camera, and the reader drags the line - mouse,
//   finger or arrow keys - to reveal one or the other. The model still
//   orbits, walks and flies under it. A project without both never shows the
//   button (West Farm has no existing building).
// - The Design Phase menu is unchanged and still chooses WHICH proposal the
//   3D view holds; the comparison is always the existing building against
//   whatever the 3D view holds (or, when the 3D view holds the existing
//   building, against the project's default proposal).
// - THE OTHER HALF IS LOADED AHEAD. Once the 3D view's model is whole, the
//   phase it is compared with is loaded in the background, tier by tier like
//   the first, into the design phase library - so the line usually appears at
//   once. Pressed before that load has finished, the button shows a loading
//   card until it has, then the line sweeps in. A phone, a device short of
//   memory or a reader on Save Data loads it only when the button is pressed.
// - STOREYS CARRY ACROSS THE LINE. Storey Toggle and Floor Isolate act on the
//   model in the 3D view; as the other phase is drawn its storeys, roofs and
//   landscape are shown or hidden to match, so a reader can isolate the ground
//   floor and drag the line across the two layouts. Objects hidden one at a
//   time from the context menu are that model's own and do not carry.
// - This module is the feature: the pair, the button, the line and the
//   loading card. The drawing is Na__RenderEffect__SplitCompare__; the models
//   are Na__ModelGroup__PhaseLibrary__'s.
//
// INTEGRATION:
// - Na__AppFlow__LoadingSequence.js initialises it with the scene, the model
//   root and the function that rebuilds the scene caches.
// - Na__UiFeature__ModelGroupSelector.js closes the comparison before it
//   changes the phase in the 3D view.
// - The Layout Editor (na-layouteditor-mode-changed) and a 2D drawing
//   (na-drawing-view-changed) close it: the line belongs to the 3D view.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (15-Nov-2026)
// - ValeVision    : not yet ported.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 15-Nov-2026 - Version 1.0.0 (v2.186.0)
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Design Phase Library
    // ------------------------------------------------------------
    // @delegate: ./Na__ModelGroup__PhaseLibrary__.js
    import {
        Na__PhaseLib__CHANGED_EVENT,
        Na__PhaseLib__GetComparePair,
        Na__PhaseLib__GetStatus,
        Na__PhaseLib__GetMessage,
        Na__PhaseLib__IsLiveReady,
        Na__PhaseLib__Ensure,
        Na__PhaseLib__Pin,
        Na__PhaseLib__Unpin,
        Na__PhaseLib__SetCacheFloor
    } from './Na__ModelGroup__PhaseLibrary__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Split Drawing, the Drawing Views and the View's Box
    // ------------------------------------------------------------
    // @delegate: ../05__RenderPipeline/Na__RenderEffect__SplitCompare__.js
    import {
        Na__SplitCompare__SIDE_BEFORE,
        Na__SplitCompare__SIDE_AFTER,
        Na__SplitCompare__Begin,
        Na__SplitCompare__End,
        Na__SplitCompare__SetSplit,
        Na__SplitCompare__GetSplit,
        Na__SplitCompare__IsActive,
        Na__SplitCompare__GetStats
    } from '../05__RenderPipeline/Na__RenderEffect__SplitCompare__.js';
    import {
        Na__DrawView__CHANGED_EVENT,
        Na__DrawView__IsActive
    } from '../40__System__DrawingViewCore/Na__DrawView__ActiveView__.js';
    import { Na__ViewportSize__Watch } from '../01__AppCore/Na__AppCore__ViewportSize__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | States and Events
    // ------------------------------------------------------------
    const Na__PhaseCompare__STATE_UNAVAILABLE = 'unavailable';                 // <-- The project has not both an existing building and a proposal
    const Na__PhaseCompare__STATE_OFF         = 'off';                         // <-- The button shows; no line
    const Na__PhaseCompare__STATE_LOADING     = 'loading';                     // <-- Asked for; the other half is still loading
    const Na__PhaseCompare__STATE_ON          = 'on';                          // <-- The line is on the model

    const Na__PhaseCompare__CHANGED_EVENT     = 'na-phase-compare-changed';    // <-- detail : GetState()
    const Na__PhaseCompare__LE_MODE_EVENT     = 'na-layouteditor-mode-changed'; // <-- Na__LayoutEditor__ModeController__: detail.isActive
    const Na__PhaseCompare__SCENE_READY_EVENT = 'na-app-scene-ready';          // <-- Na__AppFlow__LoadingSequence: the model is on screen
    // ------------------------------------------------------------

    // MODULE CONSTANTS | DOM
    // ------------------------------------------------------------
    const Na__PhaseCompare__TOOLBAR_ID     = 'naNavToolbar';
    const Na__PhaseCompare__TOOLBAR_BEFORE = 'naNavToolbarResetBtn';           // <-- The button goes in ahead of Reset View
    const Na__PhaseCompare__BUTTON_ID      = 'naNavToolbarCompareBtn';
    const Na__PhaseCompare__OVERLAY_ID     = 'naPhaseCompare';
    const Na__PhaseCompare__DIVIDER_ID     = 'naPhaseCompareDivider';
    const Na__PhaseCompare__TABS_ID        = 'naLayoutEditorTabStrip';         // <-- The 3D Model / Drawings tab strip, which lies over the top of the 3D view on a project with documents
    const Na__PhaseCompare__LOADING_ID     = 'naPhaseCompareLoading';
    const Na__PhaseCompare__ICON_SRC       = '01__AppAssets__TrueVision/UiIcons__MenuIcons__NavigationMenu/Icon__NavigationMenu__CompareExistingProposed__.svg';
    const Na__PhaseCompare__ACTIVE_CLASS   = 'na-nav-toolbar__btn--active';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Behaviour
    // ------------------------------------------------------------
    const Na__PhaseCompare__SWEEP_MS         = 700;                            // <-- The line's entrance, left edge to the middle
    const Na__PhaseCompare__KEY_STEP         = 0.02;                           // <-- One arrow press
    const Na__PhaseCompare__KEY_STEP_LARGE   = 0.10;                           // <-- With Shift
    const Na__PhaseCompare__LABEL_MIN_PX     = 150;                            // <-- A side narrower than this loses its label
    const Na__PhaseCompare__PRELOAD_DELAY_MS = 1200;                           // <-- After the model is whole, before the other half starts
    const Na__PhaseCompare__PHONE_MAX_PX     = 500;                            // <-- A screen whose short side is under this is a phone
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Context and State
    // ------------------------------------------------------------
    let Na__PhaseCompare__Context     = null;                                  // <-- { scene, modelRoot, canvas, invalidateSceneCaches, settings }
    let Na__PhaseCompare__Initialized = false;
    let Na__PhaseCompare__State       = Na__PhaseCompare__STATE_UNAVAILABLE;
    let Na__PhaseCompare__Pair        = null;                                  // <-- Na__PhaseLib__GetComparePair()
    let Na__PhaseCompare__SceneShown  = false;                                 // <-- The model is on screen: the button may show
    let Na__PhaseCompare__OtherId     = null;                                  // <-- The phase in the scene beside the 3D view's, while on
    let Na__PhaseCompare__OtherRoot   = null;
    let Na__PhaseCompare__WantOn      = false;                                 // <-- The reader asked: start when the other half is in
    let Na__PhaseCompare__SideHooks   = [];                                    // <-- Told 'before' | 'after' | null as each side is drawn
    let Na__PhaseCompare__PreloadTimer = null;
    // ------------------------------------------------------------

    // MODULE VARIABLES | DOM and the Drag
    // ------------------------------------------------------------
    let Na__PhaseCompare__Button      = null;
    let Na__PhaseCompare__Overlay     = null;
    let Na__PhaseCompare__Divider     = null;
    let Na__PhaseCompare__BeforeLabel = null;
    let Na__PhaseCompare__AfterLabel  = null;
    let Na__PhaseCompare__Loading     = null;
    let Na__PhaseCompare__LoadingLabel  = null;
    let Na__PhaseCompare__LoadingStatus = null;
    let Na__PhaseCompare__Dragging    = false;
    let Na__PhaseCompare__SweepHandle = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | DOM
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | An Element With a Class and Optional Text
    // ------------------------------------------------------------
    function Na__PhaseCompare__El(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text) element.textContent = text;
        return element;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Button, the Line and the Loading Card (once)
    // ------------------------------------------------------------
    // Built here rather than written into Index.html: every part is hidden
    // until a project has both phases, and a project without them never pays
    // for markup it cannot use.
    // ------------------------------------------------------------
    function Na__PhaseCompare__BuildDom() {
        if (Na__PhaseCompare__Overlay) return;

        // THE TOOLBAR BUTTON
        const toolbar = document.getElementById(Na__PhaseCompare__TOOLBAR_ID);
        if (toolbar) {
            const button = Na__PhaseCompare__El('button', 'na-nav-toolbar__btn na-phase-compare__toolbar-btn');
            button.id   = Na__PhaseCompare__BUTTON_ID;
            button.type = 'button';
            button.title = 'Compare the existing building with the proposal';
            button.setAttribute('aria-pressed', 'false');
            button.style.display = 'none';

            const icon = Na__PhaseCompare__El('img', 'na-nav-toolbar__icon');
            icon.src = Na__PhaseCompare__ICON_SRC;
            icon.alt = '';
            button.appendChild(icon);
            button.appendChild(Na__PhaseCompare__El('span', 'na-nav-toolbar__label', 'Before / After'));

            const anchor = document.getElementById(Na__PhaseCompare__TOOLBAR_BEFORE);
            if (anchor && anchor.parentNode === toolbar) toolbar.insertBefore(button, anchor);
            else toolbar.appendChild(button);

            button.addEventListener('click', () => { Na__PhaseCompare__Toggle(); });
            Na__PhaseCompare__Button = button;
        }

        // THE LINE, ITS HANDLE AND THE TWO LABELS
        const overlay = Na__PhaseCompare__El('div', 'na-phase-compare');
        overlay.id = Na__PhaseCompare__OVERLAY_ID;
        overlay.setAttribute('aria-hidden', 'true');

        Na__PhaseCompare__BeforeLabel = Na__PhaseCompare__El('div', 'na-phase-compare__label na-phase-compare__label--before', 'Existing');
        Na__PhaseCompare__AfterLabel  = Na__PhaseCompare__El('div', 'na-phase-compare__label na-phase-compare__label--after', 'Proposed');

        const divider = Na__PhaseCompare__El('div', 'na-phase-compare__divider');
        divider.id = Na__PhaseCompare__DIVIDER_ID;
        divider.tabIndex = 0;
        divider.setAttribute('role', 'slider');
        divider.setAttribute('aria-label', 'Existing and proposed: drag to compare');
        divider.setAttribute('aria-orientation', 'horizontal');
        divider.setAttribute('aria-valuemin', '0');
        divider.setAttribute('aria-valuemax', '100');
        divider.setAttribute('aria-valuenow', '50');
        divider.appendChild(Na__PhaseCompare__El('div', 'na-phase-compare__line'));

        const handle = Na__PhaseCompare__El('div', 'na-phase-compare__handle');
        handle.innerHTML = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M16 12 L8 20 L16 28"/><path d="M24 12 L32 20 L24 28"/></svg>';
        divider.appendChild(handle);

        divider.appendChild(Na__PhaseCompare__BeforeLabel);                   // <-- The labels are the line's own: they ride with it, either side of the handle
        divider.appendChild(Na__PhaseCompare__AfterLabel);
        overlay.appendChild(divider);
        document.body.appendChild(overlay);

        // THE LOADING CARD
        const loading = Na__PhaseCompare__El('div', 'na-phase-compare__loading');
        loading.id = Na__PhaseCompare__LOADING_ID;
        loading.setAttribute('role', 'status');
        loading.setAttribute('aria-live', 'polite');
        loading.appendChild(Na__PhaseCompare__El('div', 'loading-spinner'));
        Na__PhaseCompare__LoadingLabel  = Na__PhaseCompare__El('p', 'na-phase-compare__loading-label', 'Loading the existing building...');
        Na__PhaseCompare__LoadingStatus = Na__PhaseCompare__El('p', 'na-phase-compare__loading-status');
        loading.appendChild(Na__PhaseCompare__LoadingLabel);
        loading.appendChild(Na__PhaseCompare__LoadingStatus);
        document.body.appendChild(loading);

        Na__PhaseCompare__Overlay = overlay;
        Na__PhaseCompare__Divider = divider;
        Na__PhaseCompare__Loading = loading;

        Na__PhaseCompare__WireDivider(divider);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Lay the Overlay Over the 3D View's Own Box
    // ------------------------------------------------------------
    // The 3D view starts under the top bar, so the line is placed against the
    // canvas and not the window: its fraction across the overlay is then the
    // same fraction across the picture.
    // ------------------------------------------------------------
    function Na__PhaseCompare__Layout() {
        if (!Na__PhaseCompare__Overlay || !Na__PhaseCompare__Context || !Na__PhaseCompare__Context.canvas) return;
        const rect    = Na__PhaseCompare__Context.canvas.getBoundingClientRect();
        const tabs    = document.getElementById(Na__PhaseCompare__TABS_ID);
        const tabsBox = (tabs && getComputedStyle(tabs).display !== 'none') ? tabs.getBoundingClientRect() : null;
        const top     = Math.max(rect.top, (tabsBox && tabsBox.height > 0) ? tabsBox.bottom : 0);   // <-- The line starts under the tab strip: its grab zone must not take a tab's click
        Na__PhaseCompare__Overlay.style.left   = rect.left + 'px';
        Na__PhaseCompare__Overlay.style.top    = top + 'px';
        Na__PhaseCompare__Overlay.style.width  = rect.width + 'px';
        Na__PhaseCompare__Overlay.style.height = Math.max(0, rect.bottom - top) + 'px';
        Na__PhaseCompare__PlaceDivider(Na__SplitCompare__GetSplit());
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put the Line and the Labels Where the Split Is
    // ------------------------------------------------------------
    function Na__PhaseCompare__PlaceDivider(fraction) {
        if (!Na__PhaseCompare__Divider || !Na__PhaseCompare__Overlay) return;
        Na__PhaseCompare__Divider.style.left = (fraction * 100) + '%';
        Na__PhaseCompare__Divider.setAttribute('aria-valuenow', String(Math.round(fraction * 100)));
        Na__PhaseCompare__Divider.setAttribute('aria-valuetext', Math.round(fraction * 100) + ' percent existing');

        const width = Na__PhaseCompare__Overlay.clientWidth || 0;
        Na__PhaseCompare__BeforeLabel.classList.toggle('na-phase-compare__label--hidden', (width * fraction) < Na__PhaseCompare__LABEL_MIN_PX);
        Na__PhaseCompare__AfterLabel.classList.toggle('na-phase-compare__label--hidden', (width * (1 - fraction)) < Na__PhaseCompare__LABEL_MIN_PX);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show the State on the Button, the Line and the Card
    // ------------------------------------------------------------
    function Na__PhaseCompare__Paint() {
        const state     = Na__PhaseCompare__State;
        const available = state !== Na__PhaseCompare__STATE_UNAVAILABLE && Na__PhaseCompare__SceneShown;

        if (Na__PhaseCompare__Button) {
            Na__PhaseCompare__Button.style.display = available ? '' : 'none';
            const pressed = state === Na__PhaseCompare__STATE_ON || state === Na__PhaseCompare__STATE_LOADING;
            Na__PhaseCompare__Button.classList.toggle(Na__PhaseCompare__ACTIVE_CLASS, pressed);
            Na__PhaseCompare__Button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
        }
        if (Na__PhaseCompare__Overlay) {
            const on = state === Na__PhaseCompare__STATE_ON;
            Na__PhaseCompare__Overlay.classList.toggle('na-phase-compare--on', on);
            Na__PhaseCompare__Overlay.setAttribute('aria-hidden', on ? 'false' : 'true');
        }
        if (Na__PhaseCompare__Loading) {
            Na__PhaseCompare__Loading.classList.toggle('na-phase-compare__loading--on', state === Na__PhaseCompare__STATE_LOADING);
        }
        document.body.classList.toggle('na-phase-compare-on', state === Na__PhaseCompare__STATE_ON);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Line: Dragging, Keys and the Entrance
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Move the Line to a Fraction of the View
    // ------------------------------------------------------------
    function Na__PhaseCompare__MoveTo(fraction) {
        const next = Math.min(1, Math.max(0, fraction));
        Na__SplitCompare__SetSplit(next);
        Na__PhaseCompare__PlaceDivider(next);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Stop the Entrance Where It Is
    // ------------------------------------------------------------
    function Na__PhaseCompare__CancelSweep() {
        if (Na__PhaseCompare__SweepHandle === null) return;
        window.cancelAnimationFrame(Na__PhaseCompare__SweepHandle);
        Na__PhaseCompare__SweepHandle = null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Sweep the Line From One Place to Another
    // ------------------------------------------------------------
    // The entrance: the line comes in from the left edge and the existing
    // building opens up behind it, which shows a first-time reader what the
    // line does without a word. A reader who asks for reduced motion gets the
    // line where it ends.
    // ------------------------------------------------------------
    function Na__PhaseCompare__Sweep(from, to, durationMs) {
        Na__PhaseCompare__CancelSweep();
        const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduced || !(durationMs > 0)) {
            Na__PhaseCompare__MoveTo(to);
            return;
        }

        const started = performance.now();
        Na__PhaseCompare__MoveTo(from);
        const step = (now) => {
            const t     = Math.min(1, (now - started) / durationMs);
            const eased = 1 - Math.pow(1 - t, 3);                              // <-- Ease out: quick off the edge, settling at the middle
            Na__PhaseCompare__MoveTo(from + (to - from) * eased);
            Na__PhaseCompare__SweepHandle = (t < 1 && Na__PhaseCompare__State === Na__PhaseCompare__STATE_ON)
                ? window.requestAnimationFrame(step)
                : null;
        };
        Na__PhaseCompare__SweepHandle = window.requestAnimationFrame(step);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Wire the Line's Pointer and Keyboard
    // ------------------------------------------------------------
    // Pointer events with capture, so one handler serves a mouse, a finger and
    // a pen, and the drag carries on when the pointer leaves the handle. Only
    // the line takes the pointer: everywhere else it falls through to the
    // canvas, so the model still orbits with the comparison on.
    // ------------------------------------------------------------
    function Na__PhaseCompare__WireDivider(divider) {
        const fractionAt = (clientX) => {
            const rect = Na__PhaseCompare__Overlay.getBoundingClientRect();
            return rect.width > 0 ? (clientX - rect.left) / rect.width : 0.5;
        };

        divider.addEventListener('pointerdown', (event) => {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            Na__PhaseCompare__CancelSweep();
            Na__PhaseCompare__Dragging = true;
            divider.classList.add('na-phase-compare__divider--dragging');
            try { divider.setPointerCapture(event.pointerId); } catch (error) { /* a pointer that has already gone */ }
            try { divider.focus({ preventScroll : true }); } catch (error) { /* focus is a nicety: the arrow keys then move the line */ }
            Na__PhaseCompare__MoveTo(fractionAt(event.clientX));
            event.preventDefault();
            event.stopPropagation();
        });

        divider.addEventListener('pointermove', (event) => {
            if (!Na__PhaseCompare__Dragging) return;
            Na__PhaseCompare__MoveTo(fractionAt(event.clientX));
            event.preventDefault();
        });

        const release = (event) => {
            if (!Na__PhaseCompare__Dragging) return;
            Na__PhaseCompare__Dragging = false;
            divider.classList.remove('na-phase-compare__divider--dragging');
            try { divider.releasePointerCapture(event.pointerId); } catch (error) { /* already released */ }
        };
        divider.addEventListener('pointerup', release);
        divider.addEventListener('pointercancel', release);
        divider.addEventListener('lostpointercapture', release);

        divider.addEventListener('keydown', (event) => {
            const step    = event.shiftKey ? Na__PhaseCompare__KEY_STEP_LARGE : Na__PhaseCompare__KEY_STEP;
            const current = Na__SplitCompare__GetSplit();
            let   next    = null;
            if (event.key === 'ArrowLeft' || event.key === 'ArrowDown')      next = current - step;
            else if (event.key === 'ArrowRight' || event.key === 'ArrowUp')  next = current + step;
            else if (event.key === 'Home')                                   next = 0;
            else if (event.key === 'End')                                    next = 1;
            else if (event.key === 'Escape') { Na__PhaseCompare__Exit(); event.preventDefault(); event.stopPropagation(); return; }
            if (next === null) return;
            Na__PhaseCompare__CancelSweep();
            Na__PhaseCompare__MoveTo(next);
            event.preventDefault();
            event.stopPropagation();                                           // <-- The arrows are the walk and fly keys too
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | State
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Announce the State
    // ------------------------------------------------------------
    function Na__PhaseCompare__Announce() {
        Na__PhaseCompare__Paint();
        window.dispatchEvent(new CustomEvent(Na__PhaseCompare__CHANGED_EVENT, { detail : Na__PhaseCompare__GetState() }));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Words on the Two Sides and the Loading Card
    // ------------------------------------------------------------
    // "Proposed" names its scheme only when the project has more than one to
    // choose from.
    // ------------------------------------------------------------
    function Na__PhaseCompare__SetWords(pair) {
        if (!pair) return;
        if (Na__PhaseCompare__BeforeLabel) Na__PhaseCompare__BeforeLabel.textContent = 'Existing';
        if (Na__PhaseCompare__AfterLabel)  Na__PhaseCompare__AfterLabel.textContent  = (pair.schemes > 1 && pair.afterShort) ? ('Proposed: ' + pair.afterShort) : 'Proposed';
        if (Na__PhaseCompare__LoadingLabel) {
            Na__PhaseCompare__LoadingLabel.textContent = pair.liveIsAfter ? 'Loading the existing building...' : 'Loading the proposal...';
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read the Pair Again and Settle What the Button May Do
    // ------------------------------------------------------------
    function Na__PhaseCompare__Refresh() {
        const pair = Na__PhaseLib__GetComparePair();
        Na__PhaseCompare__Pair = pair;

        if (!pair) {
            if (Na__PhaseCompare__State === Na__PhaseCompare__STATE_ON) Na__PhaseCompare__Stop();
            Na__PhaseCompare__WantOn = false;
            Na__PhaseCompare__State  = Na__PhaseCompare__STATE_UNAVAILABLE;
        } else if (Na__PhaseCompare__State === Na__PhaseCompare__STATE_UNAVAILABLE) {
            Na__PhaseCompare__State = Na__PhaseCompare__STATE_OFF;
        }
        Na__PhaseCompare__SetWords(pair);
        Na__PhaseCompare__Announce();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show the Other Phase's Storeys as the 3D View's Model Shows Its Own
    // ------------------------------------------------------------
    // The storey controls show and hide the category groups under the model
    // root: "Storey__GroundFloor__ProposedWalls". The other phase has its own
    // categories ("Storey__GroundFloor__ExistingWalls"), but the storeys are
    // the same building's, so each of its groups follows:
    //   a group of the same name in the 3D view's model, when there is one
    //   (the landscape); else its storey there - the roofs after that
    //   storey's roofs, everything else after the rest of that storey; else,
    //   for a storey the 3D view's model has not got, shown only while that
    //   model is whole.
    // Only the category groups are touched, never what is inside them, and
    // they are all shown again when the other phase leaves the scene.
    // ------------------------------------------------------------
    function Na__PhaseCompare__MirrorStoreys() {
        const context = Na__PhaseCompare__Context;
        const other   = Na__PhaseCompare__OtherRoot;
        if (!context || !other) return;

        const byName      = new Map();
        const storeyShown = {};                                                // <-- storey -> is anything of it but its roofs showing
        const roofShown   = {};                                                // <-- storey -> is a roof of it showing
        let   wholeModel  = true;
        const live = context.modelRoot.children;
        for (let i = 0; i < live.length; i++) {
            const group = live[i];
            const shown = group.visible !== false;
            byName.set(group.name, shown);
            if (!shown) wholeModel = false;
            const match = /Storey__([A-Za-z]+)__/.exec(group.name || '');
            if (!match) continue;
            const table = (group.name.indexOf('Roof') !== -1) ? roofShown : storeyShown;
            table[match[1]] = table[match[1]] === true || shown;
        }

        const theirs = other.children;
        for (let i = 0; i < theirs.length; i++) {
            const group = theirs[i];
            const name  = group.name || '';
            if (byName.has(name)) { group.visible = byName.get(name); continue; }
            const match = /Storey__([A-Za-z]+)__/.exec(name);
            if (!match) { group.visible = true; continue; }
            const storey = match[1];
            const first  = (name.indexOf('Roof') !== -1) ? roofShown : storeyShown;
            const second = (first === roofShown) ? storeyShown : roofShown;
            if (Object.prototype.hasOwnProperty.call(first, storey))       group.visible = first[storey];
            else if (Object.prototype.hasOwnProperty.call(second, storey)) group.visible = second[storey];
            else                                                           group.visible = wholeModel;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Tell the One-Phase-Only Systems Which Side Is Being Drawn
    // ------------------------------------------------------------
    // side is 'before' or 'after' as that side is about to be drawn, then null
    // when both are done.
    // ------------------------------------------------------------
    function Na__PhaseCompare__OnSide(side) {
        const pair = Na__PhaseCompare__Pair;
        if (side && pair) {
            const otherSide = pair.liveIsAfter ? Na__SplitCompare__SIDE_BEFORE : Na__SplitCompare__SIDE_AFTER;
            if (side === otherSide) Na__PhaseCompare__MirrorStoreys();        // <-- Read as the frame is drawn, so it is right whatever changed the storeys
        }
        for (let i = 0; i < Na__PhaseCompare__SideHooks.length; i++) Na__PhaseCompare__SideHooks[i](side);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put the Other Phase in the Scene and Bring the Line On
    // ------------------------------------------------------------
    // The other phase's root goes into the scene beside the model root and
    // stays there, hidden, for as long as the comparison is on: the profile
    // line pass keeps a list of the scene's objects, and a root that came and
    // went with every frame would rebuild that list twice a frame. It is
    // pinned, so the phase library cannot let it go from under the line.
    // ------------------------------------------------------------
    function Na__PhaseCompare__Start() {
        const context = Na__PhaseCompare__Context;
        const pair    = Na__PhaseLib__GetComparePair();
        if (!context || !pair) return false;
        if (Na__PhaseCompare__State === Na__PhaseCompare__STATE_ON) return true;

        const entry = Na__PhaseLib__Pin(pair.otherId);
        if (!entry || !entry.root) return false;

        Na__PhaseCompare__Pair      = pair;
        Na__PhaseCompare__OtherId   = pair.otherId;
        Na__PhaseCompare__OtherRoot = entry.root;
        entry.root.visible = false;
        context.scene.add(entry.root);
        entry.root.updateMatrixWorld(true);
        if (typeof context.invalidateSceneCaches === 'function') context.invalidateSceneCaches();

        const started = Na__SplitCompare__Begin({
            beforeRoot : pair.liveIsAfter ? entry.root : context.modelRoot,
            afterRoot  : pair.liveIsAfter ? context.modelRoot : entry.root,
            liveSide   : pair.liveIsAfter ? Na__SplitCompare__SIDE_AFTER : Na__SplitCompare__SIDE_BEFORE,
            split      : 0,
            onSide     : Na__PhaseCompare__OnSide
        });
        if (!started) {
            Na__PhaseCompare__Detach();
            return false;
        }

        Na__PhaseCompare__State = Na__PhaseCompare__STATE_ON;
        Na__PhaseCompare__SetWords(pair);
        Na__PhaseCompare__Layout();
        Na__PhaseCompare__Announce();
        Na__PhaseCompare__Sweep(0, 0.5, Na__PhaseCompare__SWEEP_MS);
        console.log('[TrueVision3D] Comparison on: ' + pair.beforeLabel + ' | ' + pair.afterLabel);
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Take the Other Phase Back Out of the Scene
    // ------------------------------------------------------------
    function Na__PhaseCompare__Detach() {
        const context = Na__PhaseCompare__Context;
        const root    = Na__PhaseCompare__OtherRoot;
        if (root) {
            if (root.parent) root.parent.remove(root);
            root.visible = true;                                               // <-- As the phase library holds every off-scene phase
            for (let i = 0; i < root.children.length; i++) root.children[i].visible = true;   // <-- Storeys the comparison hid to match the 3D view: back as the phase loaded
        }
        if (Na__PhaseCompare__OtherId) Na__PhaseLib__Unpin(Na__PhaseCompare__OtherId);
        Na__PhaseCompare__OtherRoot = null;
        Na__PhaseCompare__OtherId   = null;
        if (context && typeof context.invalidateSceneCaches === 'function') context.invalidateSceneCaches();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Take the Line Off (the state is the caller's to set)
    // ------------------------------------------------------------
    function Na__PhaseCompare__Stop() {
        Na__PhaseCompare__CancelSweep();
        Na__PhaseCompare__Dragging = false;
        if (Na__SplitCompare__IsActive()) Na__SplitCompare__End();
        Na__PhaseCompare__Detach();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Bring the Comparison On
    // ------------------------------------------------------------
    // At once when the other half is loaded. Otherwise the loading card shows
    // while it loads - after the 3D view's own model, which it never competes
    // with - and the line comes on when it is in. Resolves true once the line
    // is on, false when the project has no pair, the load failed or the
    // reader changed their mind meanwhile.
    // ------------------------------------------------------------
    async function Na__PhaseCompare__Enter() {
        if (!Na__PhaseCompare__Initialized) return false;
        if (Na__PhaseCompare__State === Na__PhaseCompare__STATE_ON) return true;
        if (Na__DrawView__IsActive()) return false;                            // <-- A drawing has the view: the line belongs to the 3D view

        const pair = Na__PhaseLib__GetComparePair();
        if (!pair) return false;
        Na__PhaseCompare__Pair   = pair;
        Na__PhaseCompare__WantOn = true;

        if (Na__PhaseLib__IsLiveReady() && Na__PhaseLib__GetStatus(pair.otherId) === 'ready') {
            return Na__PhaseCompare__Start();
        }

        Na__PhaseCompare__State = Na__PhaseCompare__STATE_LOADING;
        Na__PhaseCompare__SetWords(pair);
        if (Na__PhaseCompare__LoadingStatus) Na__PhaseCompare__LoadingStatus.textContent = '';
        Na__PhaseCompare__Announce();

        const loaded = await Na__PhaseLib__Ensure(pair.otherId);
        if (!Na__PhaseCompare__WantOn || Na__PhaseCompare__State !== Na__PhaseCompare__STATE_LOADING) return Na__PhaseCompare__State === Na__PhaseCompare__STATE_ON;

        if (loaded && Na__PhaseCompare__Start()) return true;

        Na__PhaseCompare__WantOn = false;
        Na__PhaseCompare__State  = Na__PhaseLib__GetComparePair() ? Na__PhaseCompare__STATE_OFF : Na__PhaseCompare__STATE_UNAVAILABLE;
        Na__PhaseCompare__Announce();
        console.warn('[TrueVision3D] The comparison could not start: ' + (loaded ? 'the other phase was let go before it could be shown.' : 'the other phase did not load.'));
        return false;
    }
    // ------------------------------------------------------------


    // FUNCTION | Take the Comparison Off
    // ------------------------------------------------------------
    // Also withdraws a request still waiting on a load; the load itself
    // carries on, so the next press finds the phase in.
    // ------------------------------------------------------------
    function Na__PhaseCompare__Exit() {
        if (!Na__PhaseCompare__Initialized) return false;
        const wasOn = Na__PhaseCompare__State === Na__PhaseCompare__STATE_ON || Na__PhaseCompare__State === Na__PhaseCompare__STATE_LOADING;
        Na__PhaseCompare__WantOn = false;
        if (Na__PhaseCompare__State === Na__PhaseCompare__STATE_ON) Na__PhaseCompare__Stop();
        if (wasOn) {
            Na__PhaseCompare__State = Na__PhaseLib__GetComparePair() ? Na__PhaseCompare__STATE_OFF : Na__PhaseCompare__STATE_UNAVAILABLE;
            Na__PhaseCompare__Announce();
        }
        return wasOn;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Button
    // ------------------------------------------------------------
    function Na__PhaseCompare__Toggle() {
        if (Na__PhaseCompare__State === Na__PhaseCompare__STATE_ON || Na__PhaseCompare__State === Na__PhaseCompare__STATE_LOADING) {
            Na__PhaseCompare__Exit();
            return Promise.resolve(false);
        }
        return Na__PhaseCompare__Enter();
    }
    // ------------------------------------------------------------


    // FUNCTION | Move the Line (0 at the left edge to 1 at the right)
    // ------------------------------------------------------------
    function Na__PhaseCompare__SetSplit(fraction) {
        if (Na__PhaseCompare__State !== Na__PhaseCompare__STATE_ON || !Number.isFinite(fraction)) return false;
        Na__PhaseCompare__CancelSweep();
        Na__PhaseCompare__MoveTo(fraction);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Where the Comparison Stands
    // ------------------------------------------------------------
    function Na__PhaseCompare__GetState() {
        const pair = Na__PhaseCompare__Pair;
        return {
            state       : Na__PhaseCompare__State,
            available   : Na__PhaseCompare__State !== Na__PhaseCompare__STATE_UNAVAILABLE,
            buttonShown : !!(Na__PhaseCompare__Button && Na__PhaseCompare__Button.style.display !== 'none'),
            split       : Na__SplitCompare__GetSplit(),
            pair        : pair ? {
                beforeId : pair.beforeId, beforeLabel : pair.beforeLabel,
                afterId  : pair.afterId,  afterLabel  : pair.afterLabel,
                otherId  : pair.otherId,  liveIsAfter : pair.liveIsAfter
            } : null,
            otherStatus : pair ? Na__PhaseLib__GetStatus(pair.otherId) : null,
            drawing     : Na__SplitCompare__GetStats()
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Load the Other Half Now, Without Showing Anything
    // ------------------------------------------------------------
    // Resolves true when it is in. What the background load calls; also for a
    // caller that wants the line to be instant (a presentation, a test).
    // ------------------------------------------------------------
    function Na__PhaseCompare__Preload() {
        const pair = Na__PhaseLib__GetComparePair();
        if (!pair) return Promise.resolve(false);
        return Na__PhaseLib__Ensure(pair.otherId);
    }
    // ------------------------------------------------------------


    // FUNCTION | Register a System That Belongs to One Phase Only
    // ------------------------------------------------------------
    // hook(side): 'before' as the existing building is about to be drawn,
    // 'after' as the proposal is, null when the frame is done. For what stands
    // in the scene and not in a model - the proposal's planting and people -
    // so it can stand down while the existing building is drawn. Returns a
    // function that takes the hook out again.
    // ------------------------------------------------------------
    function Na__PhaseCompare__AddSideHook(hook) {
        if (typeof hook !== 'function') return () => {};
        Na__PhaseCompare__SideHooks.push(hook);
        return () => {
            const at = Na__PhaseCompare__SideHooks.indexOf(hook);
            if (at >= 0) Na__PhaseCompare__SideHooks.splice(at, 1);
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Background Load
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | May This Device Load the Other Half Unasked?
    // ------------------------------------------------------------
    // A second phase is tens of megabytes of geometry held beside the first.
    // A desktop or a tablet has the room. A phone, a device that reports less
    // memory than the config asks for, and a reader who has Save Data on do
    // not get it unasked: for them it loads when the button is pressed.
    // ------------------------------------------------------------
    function Na__PhaseCompare__MayPreload() {
        const settings = (Na__PhaseCompare__Context && Na__PhaseCompare__Context.settings) || {};
        if (settings.preloadCounterpart === false) return false;

        const connection = navigator.connection || null;
        if (connection && connection.saveData === true) return false;

        const memory = Number(navigator.deviceMemory);
        if (Number.isFinite(memory) && memory > 0) return memory >= (Number.isFinite(settings.preloadMinMemoryGb) ? settings.preloadMinMemoryGb : 4);

        const shortSide = Math.min(window.screen ? window.screen.width : 9999, window.screen ? window.screen.height : 9999);
        return shortSide > Na__PhaseCompare__PHONE_MAX_PX;                     // <-- No memory reported (Safari, Firefox): a phone-sized screen waits to be asked
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Start the Background Load, a Moment After the Model Is Whole
    // ------------------------------------------------------------
    function Na__PhaseCompare__SchedulePreload() {
        if (Na__PhaseCompare__PreloadTimer !== null) window.clearTimeout(Na__PhaseCompare__PreloadTimer);
        Na__PhaseCompare__PreloadTimer = null;
        if (!Na__PhaseLib__IsLiveReady() || !Na__PhaseLib__GetComparePair() || !Na__PhaseCompare__MayPreload()) return;

        Na__PhaseCompare__PreloadTimer = window.setTimeout(() => {
            Na__PhaseCompare__PreloadTimer = null;
            const pair = Na__PhaseLib__GetComparePair();
            if (!pair || !Na__PhaseLib__IsLiveReady()) return;
            if (Na__PhaseLib__GetStatus(pair.otherId) !== 'unloaded') return;
            console.log('[TrueVision3D] Loading the comparison\'s other half in the background: ' + (pair.liveIsAfter ? pair.beforeLabel : pair.afterLabel));
            void Na__PhaseLib__Ensure(pair.otherId);
        }, Na__PhaseCompare__PRELOAD_DELAY_MS);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Design Phase Library Changed
    // ------------------------------------------------------------
    function Na__PhaseCompare__OnPhaseChanged(event) {
        const detail = (event && event.detail) || {};
        const kind   = detail.kind;

        if (kind === 'groups' || kind === 'live-loading') {
            Na__PhaseCompare__Exit();                                          // <-- The model in the 3D view is about to change
            Na__PhaseCompare__Refresh();
            return;
        }
        if (kind === 'live') {
            if (Na__PhaseCompare__State === Na__PhaseCompare__STATE_ON) Na__PhaseCompare__Exit();   // <-- A different phase is in the 3D view: the pair has changed
            Na__PhaseCompare__Refresh();
            Na__PhaseCompare__SchedulePreload();
            return;
        }
        if (kind === 'progress' && Na__PhaseCompare__State === Na__PhaseCompare__STATE_LOADING && Na__PhaseCompare__Pair && detail.groupId === Na__PhaseCompare__Pair.otherId) {
            if (Na__PhaseCompare__LoadingStatus) Na__PhaseCompare__LoadingStatus.textContent = Na__PhaseLib__GetMessage(detail.groupId);
            return;
        }
        if (kind === 'evicted' && Na__PhaseCompare__State === Na__PhaseCompare__STATE_ON && detail.groupId === Na__PhaseCompare__OtherId) {
            Na__PhaseCompare__Exit();
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Initialize the Comparison
    // ------------------------------------------------------------
    // context: {
    //   scene                  the main scene: the other phase's root joins it while the line is on
    //   modelRoot              Na__ModelGroup__Root
    //   canvas                 the render canvas: the line is laid over its box
    //   invalidateSceneCaches  rebuilds the profile line passes' lists of the scene's objects
    //   settings               Na__LoadPlan__ResolveSettings(): preloadCounterpart, preloadMinMemoryGb, minCachedPhases
    // }
    // ------------------------------------------------------------
    function Na__PhaseCompare__Initialize(context) {
        if (Na__PhaseCompare__Initialized || !context || !context.scene || !context.modelRoot) return false;
        Na__PhaseCompare__Context     = context;
        Na__PhaseCompare__Initialized = true;

        const settings = context.settings || {};
        if (Number.isFinite(settings.minCachedPhases)) Na__PhaseLib__SetCacheFloor(settings.minCachedPhases);

        Na__PhaseCompare__BuildDom();

        window.addEventListener(Na__PhaseLib__CHANGED_EVENT, Na__PhaseCompare__OnPhaseChanged);
        window.addEventListener(Na__PhaseCompare__SCENE_READY_EVENT, () => {
            Na__PhaseCompare__SceneShown = true;
            Na__PhaseCompare__Refresh();
        });
        window.addEventListener(Na__PhaseCompare__LE_MODE_EVENT, (event) => {
            if (event && event.detail && event.detail.isActive) Na__PhaseCompare__Exit();   // <-- A sheet or a document has the screen
        });
        window.addEventListener(Na__DrawView__CHANGED_EVENT, () => {
            if (Na__DrawView__IsActive()) Na__PhaseCompare__Exit();            // <-- A plan or an elevation has the view
        });
        window.addEventListener('resize', Na__PhaseCompare__Layout);
        Na__ViewportSize__Watch(() => { Na__PhaseCompare__Layout(); });       // <-- The 3D view's own box: the tab strip appearing moves it

        Na__PhaseCompare__Refresh();
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Phase Compare API
    // ------------------------------------------------------------
    export {
        Na__PhaseCompare__CHANGED_EVENT,
        Na__PhaseCompare__Initialize,
        Na__PhaseCompare__Enter,
        Na__PhaseCompare__Exit,
        Na__PhaseCompare__Toggle,
        Na__PhaseCompare__SetSplit,
        Na__PhaseCompare__GetState,
        Na__PhaseCompare__Preload,
        Na__PhaseCompare__AddSideHook
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
