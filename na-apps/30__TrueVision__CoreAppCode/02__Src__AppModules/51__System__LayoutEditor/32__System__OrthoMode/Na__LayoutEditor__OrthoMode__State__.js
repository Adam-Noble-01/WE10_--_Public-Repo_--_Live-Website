// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - ORTHO MODE - STATE
// =============================================================================
//
// FILE       : Na__LayoutEditor__OrthoMode__State__.js
// NAMESPACE  : Na__LeOrtho
// MODULE     : Layout Editor - Ortho Mode - State
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Whether Ortho mode is on, and the one rule every tool asks: is the axis held for this point
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - ONE FLAG AND ONE RULE. Ortho mode (F8, as in AutoCAD) holds every point
//   picked from a point before it to the horizontal or the vertical through
//   that point - whichever the cursor has travelled further along - so no
//   line can be drawn at an angle. The rule is AutoCAD's own, the Shift
//   temporary override included: the axis is held when ORTHO XOR SHIFT.
//   With Ortho off, holding Shift holds it for as long as Shift is down,
//   which is what Shift has always done in this editor; with Ortho on,
//   holding Shift frees the cursor for as long as it is down, and letting go
//   holds the axis again.
// - WHAT "HOLD THE AXIS" MEANS IS NOT DECIDED HERE. It is exactly what a held
//   Shift already did in each place (Na__LayoutEditor__AxisLock__ Hold and
//   Nearest, the drag's nearer-axis delta, the Dimension tool's horizontal or
//   vertical dimension), so Ortho is a latched Shift and nothing else: the
//   arrow key lock still beats it, and a snap still supplies the coordinate
//   ALONG the held axis without pulling the point off it.
// - THIS FILE IS A LEAF ON PURPOSE. The Draw and Dimension tools and the drag
//   in Na__LayoutEditor__SheetTools__PointerDrag__ ask Resolve on every
//   pointer move, and the controller that switches Ortho talks to the
//   Measurements box, which imports those same tools. Holding the flag here,
//   with no imports at all, lets every side read it without an import cycle.
// - REMEMBERED IN THIS BROWSER, like the Snap toggle (F3): the flag is read
//   from localStorage the first time it is asked for and written back by the
//   controller on every switch. It never reaches a sheet, the browser draft,
//   R2, the PDF or the web viewer, which cannot draw at all.
//
// INTEGRATION:
// - Na__LayoutEditor__OrthoMode__ (the controller) is the only caller of
//   AssignOn, AssignShiftOverride and Store; everyone else switches Ortho
//   through Na__LeOrtho__Set / Na__LeOrtho__Toggle there.
// - Na__LayoutEditor__ShapeTool__ (Draw, and the Area tool drawn through it),
//   Na__LayoutEditor__DimensionTool__ and
//   Na__LayoutEditor__SheetTools__PointerDrag__ ask Na__LeOrtho__Resolve with
//   the Shift key they were handed, wherever Shift used to be asked alone.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026)
// - ValeVision    : not yet ported - it waits for Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation: the flag, its reader, the remembered copy, the
//   Shift override switch and Resolve.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Event Announced When Ortho Changes, and Where It Is Remembered
    // ------------------------------------------------------------
    const Na__LeOrtho__CHANGED_EVENT = 'na-layouteditor-ortho-changed';    // <-- detail { enabled }
    const Na__LeOrtho__STORE_KEY     = 'na-layouteditor-ortho';            // <-- '1' on, '0' off; absent = off, AutoCAD's initial ORTHOMODE 0
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Flag (null until first asked) and the Shift Override
    // ------------------------------------------------------------
    let Na__LeOrtho__On            = null;
    let Na__LeOrtho__ShiftOverride = true;   // <-- AutoCAD's TEMPOVERRIDES 1: Shift flips Ortho while it is held
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading and Assigning the Flag
// -----------------------------------------------------------------------------

    // FUNCTION | Is Ortho Mode On (the latched state, whatever Shift is doing)
    // ------------------------------------------------------------
    function Na__LeOrtho__IsOn() {
        if (Na__LeOrtho__On === null) {
            let stored = null;
            try { stored = window.localStorage.getItem(Na__LeOrtho__STORE_KEY); } catch (error) { stored = null; }
            Na__LeOrtho__On = stored === '1';
        }
        return Na__LeOrtho__On;
    }
    // ------------------------------------------------------------


    // FUNCTION | Assign the Flag (the controller's only)
    // ------------------------------------------------------------
    // A let cannot be assigned through an import, so the flag and the one
    // function that writes it stay together here. It announces nothing and
    // remembers nothing: that is the controller's job, so this file can stay
    // a leaf.
    // ------------------------------------------------------------
    function Na__LeOrtho__AssignOn(flag) {
        Na__LeOrtho__On = flag === true;
        return Na__LeOrtho__On;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remember the Flag in This Browser (the controller's only)
    // ------------------------------------------------------------
    function Na__LeOrtho__Store(flag) {
        try { window.localStorage.setItem(Na__LeOrtho__STORE_KEY, flag === true ? '1' : '0'); } catch (error) { /* storage unavailable: the flag still works for this session */ }
    }
    // ------------------------------------------------------------


    // FUNCTION | Does Shift Flip Ortho While It Is Held (the controller's only)
    // ------------------------------------------------------------
    // True is AutoCAD's default and this editor's. False is AutoCAD with its
    // temporary overrides switched off: Shift then leaves Ortho alone, and
    // simply holds the axis as it always has.
    // ------------------------------------------------------------
    function Na__LeOrtho__AssignShiftOverride(flag) {
        Na__LeOrtho__ShiftOverride = flag !== false;
        return Na__LeOrtho__ShiftOverride;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Rule
// -----------------------------------------------------------------------------

    // FUNCTION | Is the Axis Held for This Point
    // ------------------------------------------------------------
    // shiftKey is whether Shift is down for this point - the pointer event's
    // own flag, or the one the sheet tools remember from the last move or
    // Shift key. Answers true where a held Shift used to be the only way to
    // get a true, so a caller that asked `shift` asks this instead and every
    // branch below it is unchanged.
    //
    //   Ortho   Shift   Held
    //   off     up      no
    //   off     down    yes   (Shift holds the axis, as it always has)
    //   on      up      yes   (Ortho)
    //   on      down    no    (AutoCAD's Shift override frees the cursor)
    // ------------------------------------------------------------
    function Na__LeOrtho__Resolve(shiftKey) {
        const shift = shiftKey === true;
        if (!Na__LeOrtho__ShiftOverride) return Na__LeOrtho__IsOn() || shift;
        return Na__LeOrtho__IsOn() !== shift;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Ortho Mode State
    // ------------------------------------------------------------
    export {
        Na__LeOrtho__CHANGED_EVENT,
        Na__LeOrtho__IsOn,
        Na__LeOrtho__AssignOn,
        Na__LeOrtho__Store,
        Na__LeOrtho__AssignShiftOverride,
        Na__LeOrtho__Resolve
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
