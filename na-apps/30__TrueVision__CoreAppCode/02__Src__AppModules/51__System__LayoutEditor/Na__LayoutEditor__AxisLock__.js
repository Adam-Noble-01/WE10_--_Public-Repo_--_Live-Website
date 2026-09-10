// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - AXIS LOCK
// =============================================================================
//
// FILE       : Na__LayoutEditor__AxisLock__.js
// NAMESPACE  : Na__LeAxis
// MODULE     : Layout Editor - Axis Lock
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The arrow key axis lock the placing tools draw against, and the axis maths the Shift constraint used to hold
// CREATED    : 10-Sep-2026
//
// DESCRIPTION:
// - While a tool is placing a point, the left and right arrows lock the
//   new edge to the X axis and the up and down arrows lock it to the Y,
//   as in SketchUp LayOut. Pressing the same axis again releases it.
// - The lock lasts for the segment being drawn: the moment its point
//   lands, or the shape finishes, the lock clears and the next segment
//   starts free.
// - A lock beats a snap rather than cancelling it: the snapped point
//   still gives the free coordinate, so hovering a vertex on the far side
//   of the drawing pulls the edge to that vertex's line while the locked
//   coordinate stays with the point it came from. That is the pairing of
//   axis lock and vertex inference the tools are drawn with.
// - Shift is unchanged: with no lock on, it holds the edge to whichever
//   axis the cursor is nearer.
//
// INTEGRATION:
// - Na__LayoutEditor__ShapeTool__ and Na__LayoutEditor__DimensionTool__
//   constrain through here; Na__LayoutEditor__SheetTools__ toggles the
//   lock from the arrow keys; Na__LayoutEditor__Grips__ colours the
//   rubber band by the locked axis.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__AxisLock__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Two Paper Axes
    // ------------------------------------------------------------
    const Na__LeAxis__AXIS_X = 'x';                                          // <-- Across the paper: the edge holds its anchor's y
    const Na__LeAxis__AXIS_Y = 'y';                                          // <-- Down the paper: the edge holds its anchor's x
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Locked Axis, or None
    // ------------------------------------------------------------
    let Na__LeAxis__Mode = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Lock State
// -----------------------------------------------------------------------------

    // FUNCTION | Which Axis Is Locked ('x', 'y' or null)
    // ------------------------------------------------------------
    function Na__LeAxis__Get() { return Na__LeAxis__Mode; }
    // ------------------------------------------------------------


    // FUNCTION | Lock an Axis, or Release With Null
    // ------------------------------------------------------------
    function Na__LeAxis__Set(axis) {
        Na__LeAxis__Mode = (axis === Na__LeAxis__AXIS_X || axis === Na__LeAxis__AXIS_Y) ? axis : null;
        return Na__LeAxis__Mode;
    }
    // ------------------------------------------------------------


    // FUNCTION | Press the Same Axis Again to Release It
    // ------------------------------------------------------------
    function Na__LeAxis__Toggle(axis) {
        return Na__LeAxis__Set(Na__LeAxis__Mode === axis ? null : axis);
    }
    // ------------------------------------------------------------


    // FUNCTION | Release the Lock (a point landed, or the tool gave up)
    // ------------------------------------------------------------
    function Na__LeAxis__Clear() {
        const had = Na__LeAxis__Mode !== null;
        Na__LeAxis__Mode = null;
        return had;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Constraint Maths
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | An Anchor as { x, y }, From Either Shape
    // ------------------------------------------------------------
    function Na__LeAxis__Anchor(anchor) {
        if (!anchor) return null;
        if (Array.isArray(anchor)) return Number.isFinite(anchor[0]) && Number.isFinite(anchor[1]) ? { x : anchor[0], y : anchor[1] } : null;
        return Number.isFinite(anchor.x) && Number.isFinite(anchor.y) ? { x : anchor.x, y : anchor.y } : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Project a Point Onto the Locked Axis Through an Anchor
    // ------------------------------------------------------------
    // With no lock, or no anchor to lock against, the point comes back
    // untouched. The free coordinate is kept, which is what lets a snapped
    // point supply it.
    // ------------------------------------------------------------
    function Na__LeAxis__Apply(anchor, point) {
        const a = Na__LeAxis__Anchor(anchor);
        if (!a || !Na__LeAxis__Mode) return { x : point.x, y : point.y };
        return Na__LeAxis__Mode === Na__LeAxis__AXIS_X ? { x : point.x, y : a.y } : { x : a.x, y : point.y };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Nearer Axis, Which Is What Shift Holds
    // ------------------------------------------------------------
    function Na__LeAxis__Nearest(anchor, point) {
        const a = Na__LeAxis__Anchor(anchor);
        if (!a) return { x : point.x, y : point.y };
        return Math.abs(point.x - a.x) >= Math.abs(point.y - a.y) ? { x : point.x, y : a.y } : { x : a.x, y : point.y };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Constrained Point: a Lock First, Then Shift, Else Free
    // ------------------------------------------------------------
    function Na__LeAxis__Constrain(anchor, point, shift) {
        if (Na__LeAxis__Mode) return Na__LeAxis__Apply(anchor, point);
        if (shift) return Na__LeAxis__Nearest(anchor, point);
        return { x : point.x, y : point.y };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Axis Lock API
    // ------------------------------------------------------------
    export {
        Na__LeAxis__AXIS_X,
        Na__LeAxis__AXIS_Y,
        Na__LeAxis__Get,
        Na__LeAxis__Set,
        Na__LeAxis__Toggle,
        Na__LeAxis__Clear,
        Na__LeAxis__Apply,
        Na__LeAxis__Nearest,
        Na__LeAxis__Constrain
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
