// =============================================================================
// TRUEVISION3D - APP CORE - VIEWPORT SIZE
// =============================================================================
//
// FILE       : Na__AppCore__ViewportSize__.js
// NAMESPACE  : Na__AppCore
// MODULE     : ViewportSize
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The size of the 3D view as it is really shown: from the underside
//              of the top bar to the bottom of the window
// CREATED    : 13-Nov-2026
//
// DESCRIPTION:
// - The stylesheet owns the 3D canvas's box (#renderCanvas in
//   Na__CoreUi__Styles__RenderCanvas__.css): it starts under the top bar and
//   runs to the bottom of the window. This module reads that box, so the
//   renderer, the camera's aspect and every full-screen effect draw exactly
//   what is on screen.
// - Before 13-Nov-2026 the renderer was sized to the whole window and wrote
//   that height over the stylesheet's, so the canvas began under the 60 px bar
//   (48 px on a narrow window) and ran that far off the bottom: every view sat
//   low with its bottom cut. Found in ValeVision 3D on Kann's SketchUp shots
//   (Adam: "lots was covered up! i didnt realise"), fixed there in v2.98.5 and
//   here in v2.184.1.
// - The renderer must therefore be resized with setSize(w, h, false): an inline
//   width or height would pin the box and stop it following the stylesheet.
// - Na__ViewportSize__Watch observes the canvas's box, so a window resize, a
//   phone turned on its side, a phone toolbar showing or hiding, or a header
//   height change all reach the renderer. Each change is announced as the
//   window event na-viewport-size-changed ({ detail: { width, height } }, CSS
//   pixels) for modules that size something to the view.
// - EVERY CALLER OF Na__ViewportSize__Watch IS KEPT (v2.187.0). There is one
//   ResizeObserver for the page and a list of the callbacks it serves. Until
//   v2.187.0 the first caller took the only place and every later call was
//   silently refused: from v2.186.0 the Existing and Proposed line asked first
//   (it starts before the model loads), so the loading sequence's own resize
//   handler, the one that sizes the renderer and the camera, was never
//   attached, and a phone turned on its side stretched the old picture across
//   the new box (Adam's three NP03 phone shots, 16-Nov-2026).
// - A phone turned round is also asked again a beat after orientationchange:
//   some phone browsers report the old size while the turn is still running,
//   and the observer only answers a change it can see.
// - Until the stylesheet has placed the canvas (position absolute) the window
//   size is answered, as before; the observer corrects it once it has.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 16-Nov-2026 - Version 1.1.0 (TrueVision3D v2.187.0)
// - Na__ViewportSize__Watch keeps every caller (one observer, a list of
//   callbacks; a new caller hears the size at once even when it has not
//   changed). The renderer follows a turned phone and a resized window again.
// - orientationchange asks again after 250 ms.
//
// 13-Nov-2026 - Version 1.0.0
// - Initial release (TrueVision3D v2.184.1, from ValeVision 3D v2.98.5): the 3D
//   view fitted between the top bar and the bottom of the window.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Element and Event Names
    // ------------------------------------------------------------
    const Na__ViewportSize__CANVAS_ID    = 'renderCanvas';                   // <-- The main 3D canvas (Index.html)
    const Na__ViewportSize__EVENT        = 'na-viewport-size-changed';       // <-- Announced after every change
    const Na__ViewportSize__TURN_MS      = 250;                              // <-- A turned phone is asked again after this
    // ------------------------------------------------------------

    // MODULE VARIABLES | Watch State
    // ------------------------------------------------------------
    let Na__ViewportSize__Observer       = null;                             // <-- One ResizeObserver for the canvas (true when the fallback is attached)
    let Na__ViewportSize__Listeners      = [];                               // <-- Every caller of Na__ViewportSize__Watch, in the order they asked
    let Na__ViewportSize__LastWidth      = 0;                                // <-- Last size handed out, CSS px
    let Na__ViewportSize__LastHeight     = 0;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | The 3D View's Size in CSS Pixels
    // ------------------------------------------------------------
    // { width, height } of the canvas's box as the stylesheet places it, whole
    // pixels, never below 1. The window's size while the stylesheet has not
    // placed it yet (or with no canvas at all).
    // ------------------------------------------------------------
    function Na__ViewportSize__Get() {
        const canvas = document.getElementById(Na__ViewportSize__CANVAS_ID);
        if (canvas && getComputedStyle(canvas).position === 'absolute') {
            const width  = canvas.clientWidth;
            const height = canvas.clientHeight;
            if (width > 0 && height > 0) {
                return { width : Math.max(1, Math.round(width)), height : Math.max(1, Math.round(height)) };
            }
        }
        return {                                                             // <-- Stylesheet not applied yet: the old full-window answer
            width  : Math.max(1, window.innerWidth),
            height : Math.max(1, window.innerHeight)
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Hand One Size to One Caller
    // ------------------------------------------------------------
    // A caller that throws is reported and passed over: the renderer's own
    // handler must still hear of the change.
    // ------------------------------------------------------------
    function Na__ViewportSize__Tell(listener, width, height) {
        try {
            listener(width, height);
        } catch (error) {
            console.error('[TrueVision3D] A viewport size listener failed:', error);
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read the Box, and Tell Everyone If It Changed
    // ------------------------------------------------------------
    function Na__ViewportSize__Apply() {
        const size = Na__ViewportSize__Get();
        if (size.width === Na__ViewportSize__LastWidth && size.height === Na__ViewportSize__LastHeight) return false;
        Na__ViewportSize__LastWidth  = size.width;
        Na__ViewportSize__LastHeight = size.height;
        Na__ViewportSize__Listeners.slice().forEach((listener) => Na__ViewportSize__Tell(listener, size.width, size.height));
        window.dispatchEvent(new CustomEvent(Na__ViewportSize__EVENT, { detail : { width : size.width, height : size.height } }));
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Start the One Observer (first caller only)
    // ------------------------------------------------------------
    function Na__ViewportSize__Attach() {
        const canvas = document.getElementById(Na__ViewportSize__CANVAS_ID);
        if (canvas && typeof ResizeObserver === 'function') {
            Na__ViewportSize__Observer = new ResizeObserver(() => Na__ViewportSize__Apply());
            Na__ViewportSize__Observer.observe(canvas);
        } else {
            Na__ViewportSize__Observer = true;                               // <-- Marks the fallback as attached
        }
        window.addEventListener('resize', () => Na__ViewportSize__Apply());  // <-- Belt and braces: the observer normally answers first
        window.addEventListener('orientationchange', () => {                 // <-- A phone turned round: the size may still be the old one now
            Na__ViewportSize__Apply();
            setTimeout(() => Na__ViewportSize__Apply(), Na__ViewportSize__TURN_MS);
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Follow the 3D View's Box
    // ------------------------------------------------------------
    // onChange(width, height) runs once at once (the view as it is now: the
    // window may have changed while the model loaded), then whenever the box
    // changes size; each change is followed by the window event
    // na-viewport-size-changed. Any number of modules may call it: one observer
    // serves them all, in the order they asked. The loading sequence's call is
    // the one that sizes the renderer, camera and composer.
    // ------------------------------------------------------------
    function Na__ViewportSize__Watch(onChange) {
        const isNew = typeof onChange === 'function' && !Na__ViewportSize__Listeners.includes(onChange);
        if (isNew) Na__ViewportSize__Listeners.push(onChange);
        if (!Na__ViewportSize__Observer) Na__ViewportSize__Attach();
        if (Na__ViewportSize__Apply()) return;                               // <-- The box moved since anyone last heard: everyone is told, this caller included
        if (isNew) Na__ViewportSize__Tell(onChange, Na__ViewportSize__LastWidth, Na__ViewportSize__LastHeight);   // <-- Unchanged: this caller alone hears the size as it is now
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Viewport Size API
    // ------------------------------------------------------------
    export {
        Na__ViewportSize__Get,
        Na__ViewportSize__Watch,
        Na__ViewportSize__EVENT
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
