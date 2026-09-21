// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - VIEWPORT ROTATION
// =============================================================================
//
// FILE       : Na__LayoutEditor__ViewportRotation__.js
// NAMESPACE  : Na__LeVpRot
// MODULE     : Layout Editor - Viewport Rotation
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : A viewport turned on the page: the angle, the turn about the middle of its frame, and the geometry every other module reads through it
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - THE RECORD. Viewport__RotationDeg is degrees CLOCKWISE on the paper, the
//   way Annotation__RotationDeg and CSS rotate() both read, wrapped into
//   (-180, 180] and written only while the viewport is turned - a level
//   viewport saves exactly as it always did. Viewport__FrameMm is still the
//   frame as it would stand level; the turn is about ITS MIDDLE, so moving a
//   frame is still a change to X and Y alone and the middle never moves as it
//   turns.
// - THE WHOLE VIEWPORT TURNS: frame, drawing or picture, frame line and
//   caption. Everything inside the frame is still laid out in the frame's own
//   level millimetres (the window, the underlay, the linework, the 3D
//   picture), so no picture is rendered again for a turn; only the paper
//   placement changes. That is what the two mappings here are for:
//     ToPaper   a point of the level frame to where it is on the paper
//     ToFrame   a paper point back into the level frame
//   A hit test, a snap or a drag reads the pointer through ToFrame and asks
//   its old level question; anything placed on the paper from inside the
//   frame goes out through ToPaper.
// - Corners, Bounds (the upright box round the turned frame), Contains and
//   DistanceTo answer for the TURNED frame, so a module that asked "is this
//   point in the frame" keeps asking the same question and gets the truth.
// - PdfTurn writes the turn into a jsPDF page as one transformation matrix,
//   so the exporter draws a viewport level, as it always has, inside it.
// - A pure leaf: imports nothing, so every layer of the editor may use it.
//
// INTEGRATION:
// - The sheet surface turns each frame element (CssRotate); the handles
//   module draws, hit tests and drags the turned frame and its rotate grip;
//   the 2D window's paper mappings, the snap index, the sheet chrome (frame
//   line and caption) and the PDF exporter all turn through it.
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
// - Initial implementation: rotatable viewports.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Record Key and What Counts as Level
    // ------------------------------------------------------------
    const Na__LeVpRot__FIELD     = 'Viewport__RotationDeg';
    const Na__LeVpRot__LEVEL_DEG = 1e-9;                                         // <-- Nearer level than this IS level, so a turn and back leaves no field
    const Na__LeVpRot__RAD       = Math.PI / 180;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Angle
// -----------------------------------------------------------------------------

    // FUNCTION | An Angle Wrapped Into (-180, 180] Degrees (anything not a number is 0)
    // ------------------------------------------------------------
    function Na__LeVpRot__WrapDeg(deg) {
        const n = Number(deg);
        if (!Number.isFinite(n)) return 0;
        let d = n % 360;
        if (d <= -180) d += 360;
        if (d > 180) d -= 360;
        return Math.abs(d) < Na__LeVpRot__LEVEL_DEG ? 0 : d;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Viewport's Turn in Degrees Clockwise (0 when level or missing)
    // ------------------------------------------------------------
    function Na__LeVpRot__Deg(viewport) {
        return viewport ? Na__LeVpRot__WrapDeg(viewport[Na__LeVpRot__FIELD]) : 0;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Viewport Turned at All
    // ------------------------------------------------------------
    function Na__LeVpRot__IsTurned(viewport) {
        return Na__LeVpRot__Deg(viewport) !== 0;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Nearest Step to an Angle, and the Right-Angle Detent
    // ------------------------------------------------------------
    // What a rotate drag lands on. stepDeg > 0 (Shift held): the nearest
    // multiple of it. Otherwise, within detentDeg of a right angle, that right
    // angle - so level and plumb are found by feel - and the angle itself
    // anywhere else. Always wrapped.
    // ------------------------------------------------------------
    function Na__LeVpRot__Settle(deg, stepDeg, detentDeg) {
        let d = Number(deg);
        if (!Number.isFinite(d)) return 0;
        if (Number.isFinite(stepDeg) && stepDeg > 0) {
            d = Math.round(d / stepDeg) * stepDeg;
        } else if (Number.isFinite(detentDeg) && detentDeg > 0) {
            const right = Math.round(d / 90) * 90;
            if (Math.abs(d - right) <= detentDeg) d = right;
        }
        return Na__LeVpRot__WrapDeg(d);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Points and Vectors
// -----------------------------------------------------------------------------

    // FUNCTION | Turn a Vector Clockwise on the Paper (y runs down)
    // ------------------------------------------------------------
    function Na__LeVpRot__TurnVector(dx, dy, deg) {
        if (!deg) return { x : dx, y : dy };
        const a = deg * Na__LeVpRot__RAD, cos = Math.cos(a), sin = Math.sin(a);
        return { x : (dx * cos) - (dy * sin), y : (dx * sin) + (dy * cos) };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Middle of a Viewport's Frame (the point it turns about)
    // ------------------------------------------------------------
    function Na__LeVpRot__Centre(viewport) {
        const f = (viewport && viewport.Viewport__FrameMm) || {};
        return { x : (Number(f.X) || 0) + ((Number(f.WidthMm) || 0) / 2), y : (Number(f.Y) || 0) + ((Number(f.HeightMm) || 0) / 2) };
    }
    // ------------------------------------------------------------


    // FUNCTION | A Point of the Level Frame to Where It Is on the Paper
    // ------------------------------------------------------------
    function Na__LeVpRot__ToPaper(viewport, x, y) {
        const deg = Na__LeVpRot__Deg(viewport);
        if (!deg) return { x : x, y : y };
        const c = Na__LeVpRot__Centre(viewport);
        const v = Na__LeVpRot__TurnVector(x - c.x, y - c.y, deg);
        return { x : c.x + v.x, y : c.y + v.y };
    }
    // ------------------------------------------------------------


    // FUNCTION | A Paper Point Back Into the Level Frame
    // ------------------------------------------------------------
    function Na__LeVpRot__ToFrame(viewport, x, y) {
        const deg = Na__LeVpRot__Deg(viewport);
        if (!deg) return { x : x, y : y };
        const c = Na__LeVpRot__Centre(viewport);
        const v = Na__LeVpRot__TurnVector(x - c.x, y - c.y, -deg);
        return { x : c.x + v.x, y : c.y + v.y };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Turned Frame
// -----------------------------------------------------------------------------

    // FUNCTION | The Four Corners of the Turned Frame: Top Left, Top Right, Bottom Right, Bottom Left
    // ------------------------------------------------------------
    // "Top left" is the level frame's top left, wherever the turn has put it.
    // ------------------------------------------------------------
    function Na__LeVpRot__Corners(viewport) {
        const f = viewport.Viewport__FrameMm;
        return [
            Na__LeVpRot__ToPaper(viewport, f.X,             f.Y),
            Na__LeVpRot__ToPaper(viewport, f.X + f.WidthMm, f.Y),
            Na__LeVpRot__ToPaper(viewport, f.X + f.WidthMm, f.Y + f.HeightMm),
            Na__LeVpRot__ToPaper(viewport, f.X,             f.Y + f.HeightMm)
        ];
    }
    // ------------------------------------------------------------


    // FUNCTION | The Upright Box Round the Turned Frame { X, Y, WidthMm, HeightMm }
    // ------------------------------------------------------------
    // The frame itself when it is level, so a module that used to read
    // Viewport__FrameMm as a box reads exactly the same numbers then.
    // ------------------------------------------------------------
    function Na__LeVpRot__Bounds(viewport) {
        const f = viewport.Viewport__FrameMm;
        if (!Na__LeVpRot__IsTurned(viewport)) return { X : f.X, Y : f.Y, WidthMm : f.WidthMm, HeightMm : f.HeightMm };
        const pts = Na__LeVpRot__Corners(viewport);
        const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
        const minX = Math.min.apply(null, xs), minY = Math.min.apply(null, ys);
        return { X : minX, Y : minY, WidthMm : Math.max.apply(null, xs) - minX, HeightMm : Math.max.apply(null, ys) - minY };
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Paper Point Inside the Turned Frame (padMm widens it on every side)
    // ------------------------------------------------------------
    function Na__LeVpRot__Contains(viewport, pointMm, padMm) {
        if (!viewport || !pointMm) return false;
        const f   = viewport.Viewport__FrameMm;
        const pad = Number.isFinite(padMm) ? padMm : 0;
        const p   = Na__LeVpRot__ToFrame(viewport, pointMm.x, pointMm.y);
        return p.x >= f.X - pad && p.x <= f.X + f.WidthMm + pad && p.y >= f.Y - pad && p.y <= f.Y + f.HeightMm + pad;
    }
    // ------------------------------------------------------------


    // FUNCTION | How Far a Paper Point Is From the Turned Frame (0 inside it)
    // ------------------------------------------------------------
    function Na__LeVpRot__DistanceTo(viewport, pointMm) {
        const f  = viewport.Viewport__FrameMm || {};
        const p  = Na__LeVpRot__ToFrame(viewport, pointMm.x, pointMm.y);
        const dx = Math.max(f.X - p.x, 0, p.x - (f.X + f.WidthMm));
        const dy = Math.max(f.Y - p.y, 0, p.y - (f.Y + f.HeightMm));
        return Math.hypot(dx, dy);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Painters
// -----------------------------------------------------------------------------

    // FUNCTION | The CSS Turn to Append After an Element's Translate ('' when level)
    // ------------------------------------------------------------
    // Read with a transform origin at the middle of the element, which is the
    // middle of the frame.
    // ------------------------------------------------------------
    function Na__LeVpRot__CssRotate(deg) {
        const d = Na__LeVpRot__WrapDeg(deg);
        return d ? ' rotate(' + d + 'deg)' : '';
    }
    // ------------------------------------------------------------


    // FUNCTION | Turn Everything Drawn Next on a jsPDF Page About a Paper Point
    // ------------------------------------------------------------
    // Opens a graphics state and multiplies one matrix onto it; the caller
    // draws in the level frame's millimetres as it always has and closes the
    // state with doc.restoreGraphicsState(). Returns false (and opens nothing)
    // when there is no turn or the build cannot take one, so the caller knows
    // whether it has a state to close.
    //
    // jsPDF's default API writes page units straight into PDF user space,
    // which is points with y running UP from the foot of the page. A turn that
    // reads clockwise on the paper is therefore, about the point in PDF space,
    //     x' =  x cos + y sin,   y' = -x sin + y cos
    // written as the cm operator's [a b c d e f].
    // ------------------------------------------------------------
    function Na__LeVpRot__PdfTurn(doc, cxMm, cyMm, deg) {
        const d = Na__LeVpRot__WrapDeg(deg);
        if (!d || !doc || !doc.internal || typeof doc.internal.write !== 'function' || typeof doc.saveGraphicsState !== 'function') return false;
        const k   = doc.internal.scaleFactor;
        const H   = doc.internal.pageSize.getHeight();
        const a   = d * Na__LeVpRot__RAD, cos = Math.cos(a), sin = Math.sin(a);
        const Cx  = cxMm * k, Cy = (H - cyMm) * k;
        const e   = (Cx * (1 - cos)) - (Cy * sin);
        const f   = (Cy * (1 - cos)) + (Cx * sin);
        const n   = (value) => (Math.abs(value) < 1e-12 ? '0' : value.toFixed(6));
        doc.saveGraphicsState();
        doc.internal.write(n(cos), n(-sin), n(sin), n(cos), n(e), n(f), 'cm');
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Viewport Rotation API
    // ------------------------------------------------------------
    export {
        Na__LeVpRot__FIELD,
        Na__LeVpRot__WrapDeg,
        Na__LeVpRot__Deg,
        Na__LeVpRot__IsTurned,
        Na__LeVpRot__Settle,
        Na__LeVpRot__TurnVector,
        Na__LeVpRot__Centre,
        Na__LeVpRot__ToPaper,
        Na__LeVpRot__ToFrame,
        Na__LeVpRot__Corners,
        Na__LeVpRot__Bounds,
        Na__LeVpRot__Contains,
        Na__LeVpRot__DistanceTo,
        Na__LeVpRot__CssRotate,
        Na__LeVpRot__PdfTurn
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
