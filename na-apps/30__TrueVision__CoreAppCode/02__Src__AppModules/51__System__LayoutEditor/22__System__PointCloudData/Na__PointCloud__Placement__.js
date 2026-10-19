// =============================================================================
// TRUEVISION3D - POINT CLOUD DATA - PLACEMENT
// =============================================================================
//
// FILE       : Na__PointCloud__Placement__.js
// NAMESPACE  : Na__PcPlace
// MODULE     : Point Cloud Data - Placement
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Where a point cloud scene's picture lands on a 2D drawing: one affine map from its pixels to drawing millimetres
// CREATED    : 19-Oct-2026
//
// DESCRIPTION:
// - A point cloud scene exported from SketchUp (GLB Builder 2.11, Point Cloud
//   Viewer 0.9) carries a FRAME record: where the top left corner of its top
//   left pixel sits in the TrueVision world (OriginM, metres, Y up), which way
//   one pixel steps right and down (RightM, DownM, unit vectors), how big a
//   pixel is (PixelSizeM) and which way the camera looked (NormalM, INTO the
//   scene). The world is the GLB Builder's: SketchUp inches (x, y, z) become
//   (x, z, -y) x 0.0254 metres, with no offset, as every model GLB does.
// - A drawing's view definition carries the BASIS its linework is projected
//   with (Na__ProjectedLinework__ViewDefinition__). For a plan and an
//   elevation alike, drawing millimetres are 1000 x (row 0 . p, row 2 . p) of
//   that basis, and row 1 points from the drawing toward its viewer. Reading
//   the basis, rather than redoing the azimuth arithmetic here, means the
//   picture is placed by the very numbers the linework is drawn with.
// - So a pixel (u, v) lands at 1000 x rows . (Origin + s u Right + s v Down):
//   an affine map, written as the six numbers of an SVG matrix(). It is exact
//   for every point on the scene's target plane, and for every point at all
//   when the scene and the drawing look the same way. AlignmentDeg says how
//   far apart they look; a point d metres off the target plane is drawn
//   d x tan(angle) from where the linework puts it.
// - Pure arithmetic: no DOM, no fetch, no state, so it runs in Node tests.
//
// INTEGRATION:
// - Read by Na__LayoutEditor__Viewport2d__PointCloud__ (the frame layer and
//   the PDF picture) and Na__LayoutEditor__Panel__PointCloudTools__.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Oct-2026 - Version 1.0.0
// - Initial implementation (point cloud viewports).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Units and Frame Kinds
    // ------------------------------------------------------------
    const Na__PcPlace__MM_PER_M      = 1000;
    const Na__PcPlace__KIND_ORTHO    = 'orthographic';
    const Na__PcPlace__KIND_PERSPECT = 'perspective';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Vector Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Three Number Vector, or null
    // ------------------------------------------------------------
    function Na__PcPlace__Vec(value) {
        return (Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)) ? value : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Dot and Cross Products, and a Length
    // ------------------------------------------------------------
    function Na__PcPlace__Dot(a, b) {
        return (a[0] * b[0]) + (a[1] * b[1]) + (a[2] * b[2]);
    }
    function Na__PcPlace__Cross(a, b) {
        return [ (a[1] * b[2]) - (a[2] * b[1]), (a[2] * b[0]) - (a[0] * b[2]), (a[0] * b[1]) - (a[1] * b[0]) ];
    }
    function Na__PcPlace__Length(a) {
        return Math.sqrt(Na__PcPlace__Dot(a, a));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Drawing Axes and the Frame
// -----------------------------------------------------------------------------

    // FUNCTION | A Drawing's Axes From Its View Definition (null for anything without a basis)
    // ------------------------------------------------------------
    // { Kind, AlongX, AlongY, TowardViewer }: the world vectors whose dot with a
    // point in metres gives drawing x and drawing y (DOWN the sheet) in metres,
    // and the one pointing from the drawing to whoever looks at it.
    // ------------------------------------------------------------
    function Na__PcPlace__DrawingAxes(definition) {
        const basis = definition ? definition.Basis : null;
        if (!basis || !Na__PcPlace__Vec(basis.XAxisTo) || !Na__PcPlace__Vec(basis.YAxisTo) || !Na__PcPlace__Vec(basis.ZAxisTo)) return null;
        const row = (i) => [ basis.XAxisTo[i], basis.YAxisTo[i], basis.ZAxisTo[i] ];
        return { Kind : definition.Kind || null, AlongX : row(0), AlongY : row(2), TowardViewer : row(1) };
    }
    // ------------------------------------------------------------


    // FUNCTION | A Site Plan's Axes (it has no view definition: it is drawn as a plan is)
    // ------------------------------------------------------------
    // Na__SitePlan__GlbParse__ draws x = X x 1000 and y = +Z x 1000, the
    // plan basis exactly, seen from above.
    // ------------------------------------------------------------
    function Na__PcPlace__SitePlanAxes() {
        return { Kind : 'siteplan', AlongX : [ 1, 0, 0 ], AlongY : [ 0, 0, 1 ], TowardViewer : [ 0, 1, 0 ] };
    }
    // ------------------------------------------------------------


    // FUNCTION | A World Point (metres, TrueVision axes) in Drawing Millimetres
    // ------------------------------------------------------------
    function Na__PcPlace__ToDrawing(axes, pointM) {
        return {
            x : Na__PcPlace__MM_PER_M * Na__PcPlace__Dot(pointM, axes.AlongX),
            y : Na__PcPlace__MM_PER_M * Na__PcPlace__Dot(pointM, axes.AlongY)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Frame Record One a Drawing Can Take (orthographic, every number present)
    // ------------------------------------------------------------
    function Na__PcPlace__IsOrthoFrame(frame) {
        return !!frame && frame.Kind === Na__PcPlace__KIND_ORTHO
            && Number.isFinite(frame.WidthPx)    && frame.WidthPx    > 0
            && Number.isFinite(frame.HeightPx)   && frame.HeightPx   > 0
            && Number.isFinite(frame.PixelSizeM) && frame.PixelSizeM > 0
            && !!Na__PcPlace__Vec(frame.OriginM) && !!Na__PcPlace__Vec(frame.RightM)
            && !!Na__PcPlace__Vec(frame.DownM)   && !!Na__PcPlace__Vec(frame.NormalM);
    }
    // ------------------------------------------------------------


    // FUNCTION | How Far Apart the Scene and the Drawing Look, in Degrees (0 is the same way)
    // ------------------------------------------------------------
    // The scene's NormalM points INTO the scene; the drawing's TowardViewer
    // points OUT of it, so the two agree when one is minus the other. atan2 of
    // the cross and the dot rather than acos of the dot: acos has no precision
    // left at the hundredths of a degree this is asked about.
    // ------------------------------------------------------------
    function Na__PcPlace__AlignmentDeg(frame, axes) {
        const looking = frame ? Na__PcPlace__Vec(frame.NormalM) : null;
        const toward  = axes ? Na__PcPlace__Vec(axes.TowardViewer) : null;
        if (!looking || !toward || !(Na__PcPlace__Length(looking) > 0) || !(Na__PcPlace__Length(toward) > 0)) return 180;
        const away = [ -looking[0], -looking[1], -looking[2] ];
        const sin  = Na__PcPlace__Length(Na__PcPlace__Cross(away, toward));
        const cos  = Na__PcPlace__Dot(away, toward);
        return Math.atan2(sin, cos) * (180 / Math.PI);
    }
    // ------------------------------------------------------------


    // FUNCTION | How Far a Point Off the Target Plane Drifts, in Millimetres per Metre of Depth
    // ------------------------------------------------------------
    function Na__PcPlace__DriftMmPerM(angleDeg) {
        if (!Number.isFinite(angleDeg) || angleDeg >= 90) return Infinity;
        return Na__PcPlace__MM_PER_M * Math.tan(Math.max(0, angleDeg) * (Math.PI / 180));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Affine Map
// -----------------------------------------------------------------------------

    // FUNCTION | The Image's Pixels to Drawing Millimetres: [a, b, c, d, e, f]
    // ------------------------------------------------------------
    // x = a u + c v + e and y = b u + d v + f, the order SVG's matrix() and a
    // canvas's setTransform take them in. (u, v) are pixel coordinates from the
    // image's top left CORNER, so pixel (i, j) covers [i, i+1) x [j, j+1).
    // ------------------------------------------------------------
    function Na__PcPlace__Matrix(frame, axes) {
        const s = frame.PixelSizeM * Na__PcPlace__MM_PER_M;
        const R = frame.RightM, D = frame.DownM, O = frame.OriginM;
        return [
            s * Na__PcPlace__Dot(R, axes.AlongX),
            s * Na__PcPlace__Dot(R, axes.AlongY),
            s * Na__PcPlace__Dot(D, axes.AlongX),
            s * Na__PcPlace__Dot(D, axes.AlongY),
            Na__PcPlace__MM_PER_M * Na__PcPlace__Dot(O, axes.AlongX),
            Na__PcPlace__MM_PER_M * Na__PcPlace__Dot(O, axes.AlongY)
        ];
    }
    // ------------------------------------------------------------


    // FUNCTION | Apply a Map to One Point
    // ------------------------------------------------------------
    function Na__PcPlace__Apply(m, u, v) {
        return { x : (m[0] * u) + (m[2] * v) + m[4], y : (m[1] * u) + (m[3] * v) + m[5] };
    }
    // ------------------------------------------------------------


    // FUNCTION | Undo a Map (null when it flattens the picture to a line)
    // ------------------------------------------------------------
    function Na__PcPlace__Invert(m) {
        const det = (m[0] * m[3]) - (m[1] * m[2]);
        if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
        const a = m[3] / det, b = -m[1] / det, c = -m[2] / det, d = m[0] / det;
        return [ a, b, c, d, -((a * m[4]) + (c * m[5])), -((b * m[4]) + (d * m[5])) ];
    }
    // ------------------------------------------------------------


    // FUNCTION | Image Pixels per Drawing Millimetre (the map's own scale)
    // ------------------------------------------------------------
    function Na__PcPlace__PixelsPerMm(m) {
        const det = Math.abs((m[0] * m[3]) - (m[1] * m[2]));
        return det > 0 ? 1 / Math.sqrt(det) : 0;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Box Round Four Mapped Corners
    // ------------------------------------------------------------
    function Na__PcPlace__Box(m, x0, y0, x1, y1) {
        const corners = [ Na__PcPlace__Apply(m, x0, y0), Na__PcPlace__Apply(m, x1, y0), Na__PcPlace__Apply(m, x0, y1), Na__PcPlace__Apply(m, x1, y1) ];
        return {
            MinX : Math.min(...corners.map((p) => p.x)), MinY : Math.min(...corners.map((p) => p.y)),
            MaxX : Math.max(...corners.map((p) => p.x)), MaxY : Math.max(...corners.map((p) => p.y))
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Image's Bounds in Drawing Millimetres { MinX, MinY, MaxX, MaxY }
    // ------------------------------------------------------------
    function Na__PcPlace__BoundsMm(m, widthPx, heightPx) {
        return Na__PcPlace__Box(m, 0, 0, widthPx, heightPx);
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Tiles Show Through a Window of the Drawing
    // ------------------------------------------------------------
    // rect is drawing millimetres { MinX, MinY, MaxX, MaxY }. Returns the tiles
    // that hold a file and overlap the window's footprint on the image, grown
    // by marginPx so a tile just off the edge is already there when the
    // viewport is nudged. A tile with no file was empty when it was exported.
    // ------------------------------------------------------------
    function Na__PcPlace__VisibleTiles(tiles, m, rect, marginPx) {
        const inverse = Na__PcPlace__Invert(m);
        if (!inverse || !Array.isArray(tiles)) return [];
        const px     = Na__PcPlace__Box(inverse, rect.MinX, rect.MinY, rect.MaxX, rect.MaxY);
        const margin = Number.isFinite(marginPx) ? marginPx : 0;
        return tiles.filter((tile) => tile.HasFile
            && (tile.X + tile.W) > (px.MinX - margin) && tile.X < (px.MaxX + margin)
            && (tile.Y + tile.H) > (px.MinY - margin) && tile.Y < (px.MaxY + margin));
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the Preview Sharp Enough Here
    // ------------------------------------------------------------
    // devicePxPerMm is how many device pixels one drawing millimetre covers on
    // the screen (or in the export). The preview is the whole image reduced by
    // its Factor, so it carries 1 / Factor of the image's own pixels per
    // millimetre; slack below 1 accepts a preview a little softer than the
    // screen, which nobody can see but which saves fetching every tile.
    // ------------------------------------------------------------
    function Na__PcPlace__PreviewSuffices(m, preview, devicePxPerMm, slack) {
        if (!preview || !preview.HasFile) return false;
        const factor = (Number.isFinite(preview.Factor) && preview.Factor >= 1) ? preview.Factor : 1;
        const need   = devicePxPerMm * (Number.isFinite(slack) ? slack : 1);
        return (Na__PcPlace__PixelsPerMm(m) / factor) >= need;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Point Cloud Placement API
    // ------------------------------------------------------------
    export {
        Na__PcPlace__KIND_ORTHO,
        Na__PcPlace__KIND_PERSPECT,
        Na__PcPlace__DrawingAxes,
        Na__PcPlace__SitePlanAxes,
        Na__PcPlace__ToDrawing,
        Na__PcPlace__IsOrthoFrame,
        Na__PcPlace__AlignmentDeg,
        Na__PcPlace__DriftMmPerM,
        Na__PcPlace__Matrix,
        Na__PcPlace__Apply,
        Na__PcPlace__Invert,
        Na__PcPlace__PixelsPerMm,
        Na__PcPlace__BoundsMm,
        Na__PcPlace__VisibleTiles,
        Na__PcPlace__PreviewSuffices
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
