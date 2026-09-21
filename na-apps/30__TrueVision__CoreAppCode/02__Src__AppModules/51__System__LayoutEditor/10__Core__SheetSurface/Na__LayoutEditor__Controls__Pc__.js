// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - CONTROLS - PC
// =============================================================================
//
// FILE       : Na__LayoutEditor__Controls__Pc__.js
// NAMESPACE  : Na__LePc
// MODULE     : Layout Editor - PC Controls (mouse, wheel and keyboard)
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Every mouse, wheel and keyboard gesture that moves the sheet, resolved through the key map
// CREATED    : 10-Sep-2026
//
// DESCRIPTION:
// - CAD style navigation on the layout stage. The wheel zooms about the point
//   under the cursor, a middle or right drag pans, and the left button is left
//   alone so it can go on selecting and dragging sheet contents. That last rule
//   is the Lantern Designer rule: pan capture on a bare left button swallows the
//   click before it ever reaches a dimension grip or a viewport handle.
// - NOTHING HERE IS BOUND TO A FIXED BUTTON OR KEY. Every gesture is looked up
//   in Na__Hotkeys__DrawingTabs__.json through the config state, so a
//   binding is changed by editing that file and a user personalisation screen
//   can later write overrides into the same shape without this module changing.
// - The guards from the key map keep their own input: a wheel over a viewport
//   canvas is left to that canvas, and a press on a panel control is left to
//   the control. Without them the stage would eat gestures that are not its own.
// - A wheel over a 3D viewport whose content is being edited zooms that
//   viewport's picture instead of the sheet (Na__LayoutEditor__Viewport3dZoom__
//   decides, and is asked first).
// - Pans that claim the left button (space drag, empty stage drag - both off by
//   default) raise the sheet tools suppression flag for the length of the drag,
//   so a pan can never also start an edit.
// - A PRESS ON THE STAGE TAKES THE KEYBOARD (TakeKeyboard): the focus moves
//   to the stage before any tool sees the press, so a control used in a
//   panel never keeps the sheet's keys.
//
// INTEGRATION:
// - Na__LayoutEditor__ModeController__ attaches on entering the editor and
//   detaches on leaving it. Attach before the sheet tools so a claimed left
//   button is suppressed before the tools see the press.
// - Movement itself goes through Na__LayoutEditor__Navigation__, which owns the
//   zoom maths and the scroll. This module only decides what the input means.
// - Editing and tool keys are resolved from the same map by
//   Na__LayoutEditor__SheetTools__, which handles the Edit and Tool actions.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__Controls__Pc__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers; the 3D viewport zoom of 1.1.0,
//                   authored here first and PENDING to ValeVision3D on Adam's sign-off.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.4.0
// - A PRESS ON THE STAGE TAKES THE KEYBOARD (TakeKeyboard). The sheet tools
//   take every press on the paper from the browser (preventDefault on
//   pointerdown), and in Chrome that also stops the press moving the focus:
//   a tick box, a list or a number box used in a panel - or the Raster list
//   on the toolbar - kept the keyboard through any number of clicks on the
//   paper, so M, V, Escape and the arrows went nowhere and a list took the
//   letter for itself (M switched Raster to Medium). The stage now listens in
//   the capture phase and takes the focus first, as the browser would have:
//   the control blurs, committing what was typed into it, before the press
//   acts. Focus already inside the stage (text being typed on the paper) is
//   left to the tool that opened it. Exported for the mode controller, which
//   gives the stage the keyboard whenever a drawing is opened from another tab.
// - A focused control keeps only the keys it uses (Na__KeyScope__ControlKeepsKey):
//   Page Up / Page Down turn the drawings from a ticked box, and stay a list's.
//
// 21-Sep-2026 - Version 1.3.0
// - PAGE UP AND PAGE DOWN TURN THE DRAWINGS. Nav__PreviousSheet and
//   Nav__NextSheet ask the mode controller (STEP_SHEET_EVENT) for the drawing
//   before or after this one, in tab order, exactly as clicking its tab does.
//   The first and the last drawing are ends, not a loop, and the key is taken
//   there too: until v2.110.0 the 3D Model tab's keys swallowed Page Up and
//   Page Down under every tab, and since then they had scrolled the stage.
//   A held key turns one drawing, not a run of them - each one renders.
//
// 21-Sep-2026 - Version 1.2.0
// - Wheel zoom is gathered into one zoom per animation frame (FlushWheelZoom):
//   the steps are multiplied and applied once about the latest pointer
//   position, and preventDefault still runs on every event. Each flush is a
//   gesture step (ZoomAbout's gesture argument), so the sheet surface holds
//   everything that follows the zoom until the wheel rests. Detach drops any
//   steps still waiting for their frame.
//
// 14-Sep-2026 - Version 1.1.0
// - The wheel is offered to Na__LeVpZoom__OnWheel first: over a 3D viewport
//   whose content is being edited it zooms that picture, and the sheet's own
//   zoom only runs when the wheel was not the viewport's.
//
// 10-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__Navigation__, which keeps the zoom maths and
//   the fit. This module owns mouse, wheel and keyboard input; the touchscreen
//   module owns touch. Bindings moved into the key map data file.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Key Map, Navigation and Surface
    // ------------------------------------------------------------
    import {
        Na__LeCfg__GetGuards,
        Na__LeCfg__GetKeyboardSetup,
        Na__LeCfg__MatchPointerBinding,
        Na__LeCfg__MatchWheelBinding,
        Na__LeCfg__MatchKeyBinding,
        Na__LeCfg__IsPointerModifierBound,
        Na__LeCfg__GetNavigationSetup
    } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeNav__ZoomAbout,
        Na__LeNav__ZoomTo,
        Na__LeNav__Fit,
        Na__LeNav__PanBy
    } from './Na__LayoutEditor__Navigation__.js';
    import { Na__LeSurface__GetElements, Na__LeSurface__GetZoom } from './Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeTools__SetSuppressed } from '../30__System__SheetTools/Na__LayoutEditor__SheetTools__.js';
    import { Na__LeVpZoom__OnWheel } from '../20__System__Viewports/Na__LayoutEditor__Viewport3dZoom__.js';
    import { Na__KeyScope__ControlKeepsKey } from '../../03__AppUtils/Na__AppUtils__KeyScope__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Button Names and the Panning Class
    // ------------------------------------------------------------
    const Na__LePc__BUTTON_NAMES  = [ 'Left', 'Middle', 'Right' ];               // <-- Indexed by MouseEvent.button
    const Na__LePc__PANNING_CLASS = 'na-le-stage--panning';
    const Na__LePc__LINE_HEIGHT_PX = 20;                                         // <-- deltaMode 1 reports lines, not pixels
    // ------------------------------------------------------------

    // MODULE CONSTANTS | What a Press Can Land On and Keep Its Own Focus
    // ------------------------------------------------------------
    // A real control pressed on the stage - the box text is typed into, a
    // dimension's value - is pressed to be used, so TakeKeyboard leaves it be.
    // ------------------------------------------------------------
    const Na__LePc__OWN_FOCUS_SELECTOR = 'input, select, textarea, button, [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Request for the Drawing Before or After This One
    // ------------------------------------------------------------
    // Answered by Na__LayoutEditor__ModeController__, which owns which sheet is
    // open: this module is one of its imports, so asking by event is what keeps
    // the pair from forming a cycle. detail { direction : -1 | 1 }
    // ------------------------------------------------------------
    const Na__LePc__STEP_SHEET_EVENT = 'na-layouteditor-step-sheet';
    // ------------------------------------------------------------

    // MODULE VARIABLES | Attached Stage and Gesture State
    // ------------------------------------------------------------
    let Na__LePc__Stage      = null;
    let Na__LePc__Handlers   = null;
    let Na__LePc__Pan        = null;                                             // <-- { pointerId, lastX, lastY, claimsLeft }
    let Na__LePc__SpaceHeld  = false;
    let Na__LePc__WheelZoom  = null;                                             // <-- { factor, x, y, frame }: wheel steps gathered for the next animation frame
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Input Description
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Describe Which Modifiers Are Held
    // ------------------------------------------------------------
    function Na__LePc__Modifiers(event) {
        return {
            Ctrl  : !!event.ctrlKey,
            Shift : !!event.shiftKey,
            Alt   : !!event.altKey,
            Meta  : !!event.metaKey,
            Space : Na__LePc__SpaceHeld
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Test an Event Target Against a Guard Selector
    // ------------------------------------------------------------
    function Na__LePc__Matches(event, selector) {
        if (!selector) return false;
        const target = event.target;
        return !!(target && target.closest && target.closest(selector));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Whether a Press Landed on the Grey Stage Rather Than the Paper
    // ------------------------------------------------------------
    function Na__LePc__IsEmptyStage(event) {
        return !Na__LePc__Matches(event, Na__LeCfg__GetGuards().paperSelector);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Whether the Keyboard Should Be Left to a Field
    // ------------------------------------------------------------
    function Na__LePc__IsTyping(event) {
        const target = event.target;
        if (!target) return false;
        return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable === true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Navigation Actions
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Ask for the Drawing Before or After This One
    // ------------------------------------------------------------
    function Na__LePc__StepSheet(direction) {
        window.dispatchEvent(new CustomEvent(Na__LePc__STEP_SHEET_EVENT, { detail : { direction : direction < 0 ? -1 : 1 } }));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Run One Navigation Action From the Keyboard
    // ------------------------------------------------------------
    // Returns true when the action was recognised and handled, so the caller
    // knows whether to take the key away from the browser. repeat is a key
    // held down: a turn of the drawings is taken but not repeated.
    function Na__LePc__RunKeyAction(action, coarse, repeat) {
        const keys = Na__LeCfg__GetKeyboardSetup();
        const step = coarse ? keys.panCoarseStepPx : keys.panStepPx;

        switch (action) {
            case 'Nav__PreviousSheet'  : if (!repeat) Na__LePc__StepSheet(-1);                return true;
            case 'Nav__NextSheet'      : if (!repeat) Na__LePc__StepSheet(1);                 return true;
            case 'Nav__ZoomFit'        : Na__LeNav__Fit();                                    return true;
            case 'Nav__ZoomActualSize' : Na__LeNav__ZoomTo(1);                                return true;
            case 'Nav__ZoomIn'         : Na__LeNav__ZoomTo(Na__LeSurface__GetZoom() * keys.zoomKeyStep); return true;
            case 'Nav__ZoomOut'        : Na__LeNav__ZoomTo(Na__LeSurface__GetZoom() / keys.zoomKeyStep); return true;
            case 'Nav__PanLeft'        : Na__LeNav__PanBy(-step, 0);                          return true;
            case 'Nav__PanRight'       : Na__LeNav__PanBy(step, 0);                           return true;
            case 'Nav__PanUp'          : Na__LeNav__PanBy(0, -step);                          return true;
            case 'Nav__PanDown'        : Na__LeNav__PanBy(0, step);                           return true;
            default                    : return false;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Wheel
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Wheel Zoom or Wheel Scroll
    // ------------------------------------------------------------
    function Na__LePc__OnWheel(event) {
        if (Na__LePc__Matches(event, Na__LeCfg__GetGuards().wheelIgnoreSelector)) return;     // <-- A viewport canvas owns its own wheel
        if (Na__LeVpZoom__OnWheel(event)) return;                                             // <-- Over a 3D viewport whose content is being edited, the wheel zooms its picture

        const action = Na__LeCfg__MatchWheelBinding(Na__LePc__Modifiers(event));
        if (!action) return;

        const lines = (event.deltaMode === 1) ? Na__LePc__LINE_HEIGHT_PX : 1;                 // <-- Firefox reports lines
        const delta = event.deltaY * lines;

        if (action === 'Nav__ZoomAtCursor') {
            event.preventDefault();                                                           // <-- Always now, or the page scrolls under the sheet
            const setup  = Na__LeCfg__GetNavigationSetup();
            const factor = Math.exp(-delta * setup.zoomWheelStep);
            // ONE ZOOM A FRAME, HOWEVER MANY WHEEL EVENTS. A precision touchpad
            // or a free-spinning wheel reports several steps between two frames,
            // and each used to run the whole zoom - layout reads, the scaler and
            // every zoom listener - for a picture the screen never showed. The
            // steps are multiplied together and applied once, about the latest
            // pointer position, as the web viewer already does with its pans.
            if (!Na__LePc__WheelZoom) Na__LePc__WheelZoom = { factor : 1, x : event.clientX, y : event.clientY, frame : window.requestAnimationFrame(Na__LePc__FlushWheelZoom) };
            Na__LePc__WheelZoom.factor *= factor;
            Na__LePc__WheelZoom.x = event.clientX;
            Na__LePc__WheelZoom.y = event.clientY;
            return;
        }
        if (action === 'Nav__ScrollVertical')   { event.preventDefault(); Na__LeNav__PanBy(0, delta); return; }
        if (action === 'Nav__ScrollHorizontal') { event.preventDefault(); Na__LeNav__PanBy(delta, 0); return; }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Apply the Wheel Steps Gathered This Frame as One Zoom
    // ------------------------------------------------------------
    // A gesture step (ZoomAbout's fourth argument): the sheet surface holds
    // everything that follows the zoom until the wheel has rested.
    // ------------------------------------------------------------
    function Na__LePc__FlushWheelZoom() {
        const pending = Na__LePc__WheelZoom;
        Na__LePc__WheelZoom = null;
        if (!pending || !Na__LePc__Stage) return;
        Na__LeNav__ZoomAbout(Na__LeSurface__GetZoom() * pending.factor, pending.x, pending.y, true);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Pointer Pan
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Pointer Down: Claim a Pan When a Binding Matches
    // ------------------------------------------------------------
    function Na__LePc__OnPointerDown(event) {
        if (event.pointerType === 'touch') return;                                            // <-- The touchscreen module owns touch
        if (Na__LePc__Matches(event, Na__LeCfg__GetGuards().pointerIgnoreSelector)) return;    // <-- Real controls keep their own drags

        const action = Na__LeCfg__MatchPointerBinding({
            button     : Na__LePc__BUTTON_NAMES[event.button] || null,
            modifiers  : Na__LePc__Modifiers(event),
            emptyStage : Na__LePc__IsEmptyStage(event)
        });
        if (action !== 'Nav__Pan') return;

        event.preventDefault();                                                               // <-- Stops the middle button autoscroll
        const claimsLeft = (event.button === 0);
        Na__LePc__Pan = { pointerId : event.pointerId, lastX : event.clientX, lastY : event.clientY, claimsLeft : claimsLeft };
        if (claimsLeft) Na__LeTools__SetSuppressed(true);                                     // <-- A pan on the left button must not also edit
        try { Na__LePc__Stage.setPointerCapture(event.pointerId); } catch (e) { /* capture refused */ }
        Na__LePc__Stage.classList.add(Na__LePc__PANNING_CLASS);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Pointer Move: Drag the Stage Under the Cursor
    // ------------------------------------------------------------
    function Na__LePc__OnPointerMove(event) {
        if (!Na__LePc__Pan || event.pointerId !== Na__LePc__Pan.pointerId) return;
        Na__LeNav__PanBy(Na__LePc__Pan.lastX - event.clientX, Na__LePc__Pan.lastY - event.clientY);
        Na__LePc__Pan.lastX = event.clientX;
        Na__LePc__Pan.lastY = event.clientY;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Pointer Up or Cancel: Release the Pan
    // ------------------------------------------------------------
    function Na__LePc__OnPointerUp(event) {
        if (!Na__LePc__Pan || (event && event.pointerId !== Na__LePc__Pan.pointerId)) return;
        if (event) {
            try { Na__LePc__Stage.releasePointerCapture(event.pointerId); } catch (e) { /* already released */ }
        }
        if (Na__LePc__Pan.claimsLeft) Na__LeTools__SetSuppressed(false);
        Na__LePc__Pan = null;
        Na__LePc__Stage.classList.remove(Na__LePc__PANNING_CLASS);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Context Menu: A Right Drag Pan Leaves No Room for It
    // ------------------------------------------------------------
    function Na__LePc__OnContextMenu(event) {
        if (Na__LePc__Matches(event, Na__LeCfg__GetGuards().contextMenuKeepSelector)) return;
        event.preventDefault();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Keyboard
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Key Down: Track the Space Bar, Then Run a Navigation Action
    // ------------------------------------------------------------
    function Na__LePc__OnKeyDown(event) {
        const typing = Na__LePc__IsTyping(event);

        if (event.key === ' ' || event.code === 'Space') {
            if (!typing) {
                Na__LePc__SpaceHeld = true;
                if (Na__LeCfg__IsPointerModifierBound('Space')) event.preventDefault();        // <-- Only steal space when a binding wants it
            }
            return;
        }

        const keys = Na__LeCfg__GetKeyboardSetup();
        if (typing && keys.ignoreWhenTyping && Na__KeyScope__ControlKeepsKey(event.target, event.key)) return;   // <-- Only what the focused control uses itself: Page Down from a ticked box turns the drawing, in a list it stays the list's

        const match = Na__LeCfg__MatchKeyBinding(event.key, Na__LePc__Modifiers(event));
        if (!match) return;
        if (Na__LePc__RunKeyAction(match.action, match.coarse, !!event.repeat)) event.preventDefault();   // <-- Edit and Tool actions belong to the sheet tools
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Key Up and Blur: Drop the Space Bar
    // ------------------------------------------------------------
    function Na__LePc__OnKeyUp(event) {
        if (event.key === ' ' || event.code === 'Space') Na__LePc__SpaceHeld = false;
    }
    function Na__LePc__OnBlur() {
        Na__LePc__SpaceHeld = false;
        Na__LePc__OnPointerUp(null);                                                          // <-- A pan cannot survive the window losing focus
    }
    // ------------------------------------------------------------


    // FUNCTION | Give the Keyboard to the Sheet
    // ------------------------------------------------------------
    // WHY A PRESS ON THE PAPER HAS TO SAY SO. The sheet tools take every press
    // they act on from the browser (preventDefault on pointerdown), and in
    // Chrome that also stops the press moving the focus. So a tick box, a list
    // or a number box used in a panel - or the Raster list on the toolbar -
    // kept the keyboard through any number of clicks on the paper, and the
    // sheet's keys went to it: M, V, Escape and the arrows did nothing, and a
    // list took the letter for itself (M switched Raster to Medium). Clicking a
    // toolbar button was the only way out, because a button takes the focus.
    //
    // Called in the capture phase of every press on the stage, ahead of the
    // tools, and by the mode controller (with no press) whenever a drawing is
    // opened from another tab. The stage takes the focus as the browser would
    // have given it: the control blurs, which commits what was typed into it,
    // before the press does anything to the sheet.
    //
    // LEFT ALONE: a press on a real control on the stage (it is being used),
    // and a focus already inside the stage - text being typed on the paper is
    // committed by the tool that opened it, as the press already does.
    // Returns true when the focus moved to the stage.
    // ------------------------------------------------------------
    function Na__LePc__TakeKeyboard(event) {
        const stage = Na__LePc__Stage;
        if (!stage || typeof document === 'undefined') return false;
        const target = event ? event.target : null;
        if (target && target.closest && target.closest(Na__LePc__OWN_FOCUS_SELECTOR)) return false;   // <-- A control pressed on the paper is being used
        const focused = document.activeElement;
        if (focused === stage) return false;                                                 // <-- Already the sheet's
        if (focused && focused !== document.body && stage.contains(focused)) return false;   // <-- A field on the paper: its tool commits it on the press
        try { stage.focus({ preventScroll : true }); } catch (error) { return false; }
        return document.activeElement === stage;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Attach and Detach
// -----------------------------------------------------------------------------

    // FUNCTION | Listen on the Stage and the Keyboard
    // ------------------------------------------------------------
    function Na__LePc__Attach() {
        const els = Na__LeSurface__GetElements();
        if (!els.stage) return false;
        Na__LePc__Detach();
        Na__LePc__Stage    = els.stage;
        Na__LePc__Handlers = {
            wheel         : (e) => Na__LePc__OnWheel(e),
            pointerdown   : (e) => Na__LePc__OnPointerDown(e),
            pointermove   : (e) => Na__LePc__OnPointerMove(e),
            pointerup     : (e) => Na__LePc__OnPointerUp(e),
            pointercancel : (e) => Na__LePc__OnPointerUp(e),
            contextmenu   : (e) => Na__LePc__OnContextMenu(e),
            keydown       : (e) => Na__LePc__OnKeyDown(e),
            keyup         : (e) => Na__LePc__OnKeyUp(e),
            blur          : ()  => Na__LePc__OnBlur(),
            takekeys      : (e) => { Na__LePc__TakeKeyboard(e); }
        };
        Na__LePc__Stage.addEventListener('pointerdown', Na__LePc__Handlers.takekeys, true);   // <-- Capture: the keyboard is the sheet's before any tool sees the press
        Na__LePc__Stage.addEventListener('wheel', Na__LePc__Handlers.wheel, { passive : false });
        [ 'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'contextmenu' ].forEach((name) => {
            Na__LePc__Stage.addEventListener(name, Na__LePc__Handlers[name]);
        });
        window.addEventListener('keydown', Na__LePc__Handlers.keydown);
        window.addEventListener('keyup',   Na__LePc__Handlers.keyup);
        window.addEventListener('blur',    Na__LePc__Handlers.blur);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Stop Listening and Drop Any Pan
    // ------------------------------------------------------------
    function Na__LePc__Detach() {
        if (!Na__LePc__Stage || !Na__LePc__Handlers) return;
        if (Na__LePc__WheelZoom) { window.cancelAnimationFrame(Na__LePc__WheelZoom.frame); Na__LePc__WheelZoom = null; }   // <-- Steps gathered for a stage that is going
        if (Na__LePc__Pan && Na__LePc__Pan.claimsLeft) Na__LeTools__SetSuppressed(false);
        Na__LePc__Stage.removeEventListener('pointerdown', Na__LePc__Handlers.takekeys, true);
        Na__LePc__Stage.removeEventListener('wheel', Na__LePc__Handlers.wheel);
        [ 'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'contextmenu' ].forEach((name) => {
            Na__LePc__Stage.removeEventListener(name, Na__LePc__Handlers[name]);
        });
        window.removeEventListener('keydown', Na__LePc__Handlers.keydown);
        window.removeEventListener('keyup',   Na__LePc__Handlers.keyup);
        window.removeEventListener('blur',    Na__LePc__Handlers.blur);
        Na__LePc__Stage.classList.remove(Na__LePc__PANNING_CLASS);
        Na__LePc__Stage = Na__LePc__Handlers = Na__LePc__Pan = null;
        Na__LePc__SpaceHeld = false;
    }
    // ------------------------------------------------------------


    // FUNCTION | Whether a Pan Is in Flight (the touch module defers to it)
    // ------------------------------------------------------------
    function Na__LePc__IsPanning() { return !!Na__LePc__Pan; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor PC Controls API
    // ------------------------------------------------------------
    export {
        Na__LePc__STEP_SHEET_EVENT,
        Na__LePc__Attach,
        Na__LePc__Detach,
        Na__LePc__TakeKeyboard,
        Na__LePc__IsPanning
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
