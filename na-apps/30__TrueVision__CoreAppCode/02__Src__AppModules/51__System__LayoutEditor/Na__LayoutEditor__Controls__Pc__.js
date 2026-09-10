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
//   in Na__LayoutEditor__KeyMappings__.json through the config state, so a
//   binding is changed by editing that file and a user personalisation screen
//   can later write overrides into the same shape without this module changing.
// - The guards from the key map keep their own input: a wheel over a viewport
//   canvas is left to that canvas, and a press on a panel control is left to
//   the control. Without them the stage would eat gestures that are not its own.
// - Pans that claim the left button (space drag, empty stage drag - both off by
//   default) raise the sheet tools suppression flag for the length of the drag,
//   so a pan can never also start an edit.
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
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
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
    } from './Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeNav__ZoomAbout,
        Na__LeNav__ZoomTo,
        Na__LeNav__Fit,
        Na__LeNav__PanBy
    } from './Na__LayoutEditor__Navigation__.js';
    import { Na__LeSurface__GetElements, Na__LeSurface__GetZoom } from './Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeTools__SetSuppressed } from './Na__LayoutEditor__SheetTools__.js';
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

    // MODULE VARIABLES | Attached Stage and Gesture State
    // ------------------------------------------------------------
    let Na__LePc__Stage      = null;
    let Na__LePc__Handlers   = null;
    let Na__LePc__Pan        = null;                                             // <-- { pointerId, lastX, lastY, claimsLeft }
    let Na__LePc__SpaceHeld  = false;
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

    // HELPER FUNCTION | Run One Navigation Action From the Keyboard
    // ------------------------------------------------------------
    // Returns true when the action was recognised and handled, so the caller
    // knows whether to take the key away from the browser.
    function Na__LePc__RunKeyAction(action, coarse) {
        const keys = Na__LeCfg__GetKeyboardSetup();
        const step = coarse ? keys.panCoarseStepPx : keys.panStepPx;

        switch (action) {
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

        const action = Na__LeCfg__MatchWheelBinding(Na__LePc__Modifiers(event));
        if (!action) return;

        const lines = (event.deltaMode === 1) ? Na__LePc__LINE_HEIGHT_PX : 1;                 // <-- Firefox reports lines
        const delta = event.deltaY * lines;

        if (action === 'Nav__ZoomAtCursor') {
            event.preventDefault();
            const setup  = Na__LeCfg__GetNavigationSetup();
            const factor = Math.exp(-delta * setup.zoomWheelStep);
            Na__LeNav__ZoomAbout(Na__LeSurface__GetZoom() * factor, event.clientX, event.clientY);
            return;
        }
        if (action === 'Nav__ScrollVertical')   { event.preventDefault(); Na__LeNav__PanBy(0, delta); return; }
        if (action === 'Nav__ScrollHorizontal') { event.preventDefault(); Na__LeNav__PanBy(delta, 0); return; }
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
        if (typing && keys.ignoreWhenTyping) return;

        const match = Na__LeCfg__MatchKeyBinding(event.key, Na__LePc__Modifiers(event));
        if (!match) return;
        if (Na__LePc__RunKeyAction(match.action, match.coarse)) event.preventDefault();        // <-- Edit and Tool actions belong to the sheet tools
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
            blur          : ()  => Na__LePc__OnBlur()
        };
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
        if (Na__LePc__Pan && Na__LePc__Pan.claimsLeft) Na__LeTools__SetSuppressed(false);
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
        Na__LePc__Attach,
        Na__LePc__Detach,
        Na__LePc__IsPanning
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
