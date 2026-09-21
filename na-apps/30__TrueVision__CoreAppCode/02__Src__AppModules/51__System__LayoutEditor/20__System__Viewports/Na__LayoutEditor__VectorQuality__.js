// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - VECTOR QUALITY
// =============================================================================
//
// FILE       : Na__LayoutEditor__VectorQuality__.js
// NAMESPACE  : Na__LeVectorQ
// MODULE     : Layout Editor - Vector Quality
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Low, Medium or High for how a 2D viewport's linework is drawn while the sheet is worked on: how clean it looks against how fast the editing is
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - THE TRADE. A plan's linework is tens of thousands of vector segments,
//   and it shares one painted layer with everything drawn over it. The
//   markup above a drawing is swapped as a whole SVG the size of the page,
//   so a dimension line following the cursor, a note or a vertex being
//   dragged, made the browser draw every line of the plan again, every
//   frame: 3.5 frames a second on RB05's ground floor plan at 8x. HOLDING
//   the drawing - giving its frame a compositor layer of its own - means
//   what changes above it costs the drawing nothing: 60 frames a second.
//   But a held drawing is a picture the browser scales, and it is never
//   quite the drawing it was: a touch softer, fine parallel lines running
//   together. Adam, of the first version, which held it always and the
//   wrong way: "unbelievably fast now, but it looks super shit".
// - THREE LEVELS, the toolbar's Vector control, beside Raster:
//     High     Never held. Every line drawn by the browser as vectors, every
//              time: the cleanest, and what the editor always was. A heavy
//              plan is slow to dimension and to drag things over.
//     Medium   Held ONLY WHILE THE SHEET IS BEING WORKED ON. The first
//              redraw of the sheet takes the hold; ReleaseAfterMs of quiet
//              (nothing redrawn) lets it go, and the drawing is drawn once
//              more, as clean as High. Fast to edit, clean at rest.
//     Low      Held all the time. No pause as an edit starts or ends, and
//              the wheel zoom is smoother; always a touch soft.
// - IT CHANGES NOTHING THAT IS RENDERED OR SAVED. No viewport picture is
//   rendered again when the level changes (that is why it is not part of
//   Raster, which re-renders every picture), and the PDF never sees it.
// - HELD BY will-change: opacity, NOT will-change: transform. The transform
//   hint tells the browser to keep the layer at the scale it was first drawn
//   at, so a drawing held at Fit and zoomed to 8x was the Fit picture blown
//   up - the garbage above. The opacity hint carries no such promise: the
//   layer is drawn again at each zoom.
// - The level is this browser's, remembered like the Raster level.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetSurface__ calls NoteRedraw once per redrawn frame.
// - Na__LayoutEditor__Toolbar__ shows the control (Get, Set, LEVELS).
// - Na__LayoutEditor__Styles__Main__Paper__.css holds the one rule, keyed on
//   the body class this module sets.
// - A leaf but for the config: imports nothing that imports it.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026).
// - ValeVision    : not yet ported - it waits for Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation (TrueVision3D v2.136.0).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config
    // ------------------------------------------------------------
    import { Na__LeCfg__GetVectorQualitySetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Levels, Storage, Event and the Body Class
    // ------------------------------------------------------------
    const Na__LeVectorQ__LOW           = 'low';
    const Na__LeVectorQ__MEDIUM        = 'medium';
    const Na__LeVectorQ__HIGH          = 'high';
    const Na__LeVectorQ__LEVELS        = [ Na__LeVectorQ__LOW, Na__LeVectorQ__MEDIUM, Na__LeVectorQ__HIGH ];
    const Na__LeVectorQ__STORAGE_KEY   = 'Na__LayoutEditor__VectorLevel';
    const Na__LeVectorQ__CHANGED_EVENT = 'na-layouteditor-vector-quality-changed';
    const Na__LeVectorQ__HOLD_CLASS    = 'na-le-vector-hold';                  // <-- On the body: the paper stylesheet gives every 2D frame a layer of its own
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Level (null until first read), and Medium's Hold
    // ------------------------------------------------------------
    let Na__LeVectorQ__Level = null;
    let Na__LeVectorQ__Timer = 0;          // <-- Medium: the quiet that lets the hold go
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Hold
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Take the Hold, or Let It Go
    // ------------------------------------------------------------
    function Na__LeVectorQ__SetHeld(held) {
        if (typeof document === 'undefined' || !document.body) return;
        if (document.body.classList.contains(Na__LeVectorQ__HOLD_CLASS) !== !!held) document.body.classList.toggle(Na__LeVectorQ__HOLD_CLASS, !!held);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Drop the Timer That Would Let a Medium Hold Go
    // ------------------------------------------------------------
    function Na__LeVectorQ__ClearTimer() {
        if (Na__LeVectorQ__Timer) window.clearTimeout(Na__LeVectorQ__Timer);
        Na__LeVectorQ__Timer = 0;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put the Hold Where the Level Says It Rests
    // ------------------------------------------------------------
    // Low rests held, High and Medium rest let go. Medium takes it again on
    // the next redraw.
    // ------------------------------------------------------------
    function Na__LeVectorQ__Rest() {
        Na__LeVectorQ__ClearTimer();
        Na__LeVectorQ__SetHeld(Na__LeVectorQ__Get() === Na__LeVectorQ__LOW);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Sheet Is About to Be Redrawn (once per frame, from the surface)
    // ------------------------------------------------------------
    // MEDIUM TAKES THE HOLD HERE, IN THE SAME FRAME AS THE REDRAW. A redraw
    // swaps an SVG the size of the page, so the browser draws the whole plan
    // again for it whether the drawing is held or not: taking the hold in that
    // frame costs nothing the redraw was not already paying. What it buys is
    // every frame after it - the rest of the drag, the rest of the dimension's
    // line following the cursor. ReleaseAfterMs with nothing redrawn lets it
    // go, which is one more drawing of the plan, at rest, where it is not felt.
    // ------------------------------------------------------------
    function Na__LeVectorQ__NoteRedraw() {
        if (Na__LeVectorQ__Get() !== Na__LeVectorQ__MEDIUM) return;
        Na__LeVectorQ__SetHeld(true);
        Na__LeVectorQ__ClearTimer();
        Na__LeVectorQ__Timer = window.setTimeout(() => {
            Na__LeVectorQ__Timer = 0;
            if (Na__LeVectorQ__Get() === Na__LeVectorQ__MEDIUM) Na__LeVectorQ__SetHeld(false);
        }, Na__LeCfg__GetVectorQualitySetup().releaseAfterMs);
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the Drawing Held Right Now
    // ------------------------------------------------------------
    function Na__LeVectorQ__IsHeld() {
        return typeof document !== 'undefined' && !!document.body && document.body.classList.contains(Na__LeVectorQ__HOLD_CLASS);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Level
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Valid Level Name or Null
    // ------------------------------------------------------------
    function Na__LeVectorQ__Valid(level) {
        return (typeof level === 'string' && Na__LeVectorQ__LEVELS.indexOf(level.toLowerCase()) !== -1) ? level.toLowerCase() : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Level: Remembered in This Browser, Else the Config Default
    // ------------------------------------------------------------
    function Na__LeVectorQ__Get() {
        if (Na__LeVectorQ__Level) return Na__LeVectorQ__Level;
        let stored = null;
        try { stored = Na__LeVectorQ__Valid(window.localStorage.getItem(Na__LeVectorQ__STORAGE_KEY)); } catch (e) { stored = null; }
        Na__LeVectorQ__Level = stored || Na__LeVectorQ__Valid(Na__LeCfg__GetVectorQualitySetup().defaultLevel) || Na__LeVectorQ__MEDIUM;
        return Na__LeVectorQ__Level;
    }
    // ------------------------------------------------------------


    // FUNCTION | Choose the Level (remembered, announced, and the hold put where it rests)
    // ------------------------------------------------------------
    function Na__LeVectorQ__Set(level) {
        const next = Na__LeVectorQ__Valid(level);
        if (!next) return Na__LeVectorQ__Get();
        if (next === Na__LeVectorQ__Get()) return next;
        Na__LeVectorQ__Level = next;
        try { window.localStorage.setItem(Na__LeVectorQ__STORAGE_KEY, next); } catch (e) { /* private mode: the session keeps it */ }
        Na__LeVectorQ__Rest();
        window.dispatchEvent(new CustomEvent(Na__LeVectorQ__CHANGED_EVENT, { detail : { level : next } }));
        return next;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put the Hold Where the Remembered Level Rests (the editor opening)
    // ------------------------------------------------------------
    function Na__LeVectorQ__Ready() {
        Na__LeVectorQ__Rest();
        return Na__LeVectorQ__Get();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Vector Quality API
    // ------------------------------------------------------------
    export {
        Na__LeVectorQ__LOW,
        Na__LeVectorQ__MEDIUM,
        Na__LeVectorQ__HIGH,
        Na__LeVectorQ__LEVELS,
        Na__LeVectorQ__CHANGED_EVENT,
        Na__LeVectorQ__HOLD_CLASS,
        Na__LeVectorQ__Get,
        Na__LeVectorQ__Set,
        Na__LeVectorQ__Ready,
        Na__LeVectorQ__NoteRedraw,
        Na__LeVectorQ__IsHeld
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
