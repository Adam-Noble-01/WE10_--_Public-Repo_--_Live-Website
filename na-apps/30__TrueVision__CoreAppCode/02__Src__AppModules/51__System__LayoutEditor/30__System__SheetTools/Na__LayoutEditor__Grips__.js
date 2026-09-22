// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - GRIPS
// =============================================================================
//
// FILE       : Na__LayoutEditor__Grips__.js
// NAMESPACE  : Na__LeGrips
// MODULE     : Layout Editor - Grips
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The visible grips on a selected dimension or shape, which grip a press lands on, and the rubber band the placing tools stretch
// CREATED    : 10-Sep-2026
//
// DESCRIPTION:
// - A selected dimension shows a square grip at each measured point and a
//   round grip on the dimension line: the squares re-pick the points (they
//   snap to the linework), the round one slides the line away from or
//   towards what it measures and infers other dimension lines. Clicking the
//   value and dragging it moves the text and draws a curved leader back to
//   the line's centre; a round grip on the value appears once it has been
//   moved, so it can be grabbed again without covering the line's grip.
// - A selected shape shows a square grip at every vertex. Hold Shift over
//   an edge and a diamond marks where a click will insert another.
// - A selected leader shows a square grip at its tip and a round one at the
//   anchor where it lands on its head.
// - A selected text item shows a round grip on a short stem off the middle
//   of the top of its outline, turned with the text. Dragging it turns the
//   text about the middle of its box (Na__LayoutEditor__TextTool__); the
//   grip stands the same distance off the outline on screen at any zoom.
// - Grips are counter-scaled so they stay the same size on screen at any
//   zoom: laid out at their real size and scaled back by a transform, never
//   given a fractional size or border - and PLACED by that same transform,
//   never by left and top (see Place for why). The rubber band likewise.
// - A POINT GRIP'S COLOUR IS A CHECK. Red is a point in hand; green is a
//   point that sits on the drawing - a corner, a middle or a crossing of a
//   viewport's linework (a ring when it is only on one of its lines); blue
//   is a point on nothing.
// - The rubber band is one dashed line in the handles layer, shared by the
//   dimension and the shape tools. It takes the locked axis's colour
//   while an arrow key holds the edge to an axis.
// - The rubber box is the rectangle tool's counterpart: the four edges the
//   rectangle will have, dashed like the band, solid while Shift holds it
//   square.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetSurface__ renders the grips into the handles
//   layer; Na__LayoutEditor__SheetTools__ asks what a press grabbed; the
//   dimension and shape tools stretch the band, the rectangle tool the box.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__Grips__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.12.0
// - THE RUBBER BOX IS DRAWN LIKE THE BAND: THIN AT ANY ZOOM, ON ITS EDGE.
//   Adam: the rectangle preview was "too thick" zoomed in and "set in
//   slightly" from the snapped corner. Its 4 / zoom border hit Chrome's
//   one-device-pixel floor before the paper's scale, and a border-box
//   border lies inside the box. PlaceBox lays it out at its screen size plus
//   one stroke, scales it back and pulls it back half a stroke, so the
//   stroke's middle is the rectangle's edge; laid again when a zoom settles.
//   Box and band are now 2 px on screen (were 4), the vector previews' width.
//   EdgePx, used by nothing else, is gone.
//
// 21-Sep-2026 - Version 1.11.0
// - A GRIP IS PAINTED ON ITS POINT, AND THE BAND RUNS TO THE POINT IT RUNS TO.
//   Found from the snap marker standing beside the corner it had found (Adam:
//   "they don't seem to align with the actual vector points"): a box's left
//   and top are rounded to a whole device pixel BEFORE the paper's scale(zoom),
//   and the zoom multiplies the difference - up to half a pixel times the zoom.
//   CounterScale, which only scaled, is now Place, which carries the grip to
//   its point in the same transform (Add and the insert diamond). Measured in
//   the app at 32x: every vertex grip within 0.003 px of its vertex.
// - THE RUBBER BAND IS ONE PIXEL AT ANY ZOOM, ON THE LINE. It was laid out in
//   paper pixels, so at 32x it was a dashed bar 21 px thick hanging to one side
//   of the line it stood for, started up to 16 px from its point and stopped
//   short of the snap marker or ran past it. Laid out now at its length on
//   screen and scaled back, placed and centred by its transform (PlaceBand),
//   and laid again when a zoom settles. The stem and the rubber box are as
//   they were.
//
// 21-Sep-2026 - Version 1.10.0
// - A PICKED VERTEX WAS WHITE ON WHITE PAPER ONCE ZOOMED IN, and a plain one a
//   solid blue disc. The grips were given a size and a border divided by the
//   zoom, and Chrome floors a border at one device pixel BEFORE the paper's
//   scale is applied - so from about 5x in the border swallowed the grip, and
//   a picked grip's border is white. Every grip drawn here (Add, the rotate
//   grip's stem, the insert diamond) is now laid out at its real size and
//   scaled back by a transform (CounterScale), which has no such floor: the
//   same square, the same one-pixel edge, red in the middle, at any zoom.
// - A POINT GRIP SAYS WHETHER ITS POINT IS ON THE DRAWING (StateOf, asking
//   the object snap's OnLinework): solid GREEN on a corner, a middle or a
//   crossing of a viewport's linework, a green RING on one of its lines,
//   solid BLUE on nothing - so a run of vertices can be checked at a glance
//   for the one that only looks as if it is on the wall's corner. RED is still
//   the point in hand, and a picked point on the drawing wears a green edge.
//   A vector's vertices and a dimension's two measured points read this way;
//   every other grip is unchanged.
//
// 21-Sep-2026 - Version 1.9.0
// - RegisterShapeProvider: a feature can draw the grips of its own kind of
//   shape, asked before the vertex grips. A picture's four corner grips
//   (Sheet Images) arrive this way - shown whenever one picture is selected,
//   with no vertex grips ever, since a picture's points are its box.
//
// 19-Sep-2026 - Version 1.8.0
// - RegisterGroupProvider: a feature can draw grips of its own on a selected
//   group, after the group's box. The Parametric Scrapbook's stretch and
//   lookup grips arrive this way. TrueVision first; not yet in ValeVision.
//
// 17-Sep-2026 - Version 1.7.0
// - GRIPS BELONG TO AN OPEN CONTAINER. A selected vector's vertex grips and a
//   selected dimension's grips are now drawn only while THAT object is open for
//   editing (Na__LayoutEditor__EditScope__), so a sheet full of selected markup
//   is no longer a field of dots and nothing can be dragged out of shape by a
//   press that was meant to select. Double-click, or Enter, to get them.
// - A PICKED GRIP IS RED. Add takes a picked flag: a vertex swept up by a box
//   drawn inside the vector, or the dimension grip being held, draws solid red
//   (na-le-grip--picked) while the rest stay blue - blue is a point you could
//   take hold of, red is one you have.
// - MOVE_CURSOR: the four-way arrow the Move tool carries, drawn inline beside
//   ROTATE_CURSOR and for the same reason.
//
//
// 14-Sep-2026 - Version 1.6.0
// - Rotate grip: a selected text item shows a round grip on a stem off the
//   middle of the top of its outline, turned with the text, standing
//   Text RotateGripOffsetPx off the outline on screen. AnnotationGrab says
//   whether a press takes that grip ('rotate') or the text ('whole'), and
//   ROTATE_CURSOR is the cursor shown over it.
//
// 14-Sep-2026 - Version 1.5.0
// - ShowInsert and HideInsert: a diamond grip on an edge of a selected
//   vector, the place a Shift-click will put a new vertex.
//
// 14-Sep-2026 - Version 1.4.0
// - Dimension text leader: DimensionGrab returns 'text' when a press lands
//   on the value or its arc, so a drag moves the text rather than the
//   dimension. A round grip sits on the value once it has been moved.
//
// 14-Sep-2026 - Version 1.3.0
// - Leader grips: a square at the tip, a round one at the anchor. LeaderGrab
//   says what a press on a leader takes hold of - 'tip' re-points it,
//   'anchor' (its grip, the bubble or the note) moves the head while the tip
//   stays, 'whole' (the curve) moves both.
//
// 13-Sep-2026 - Version 1.2.0
// - ShowBox and HideBox: the rubber box the rectangle tool stretches, its
//   edge counter-scaled like the grips.
//
// 10-Sep-2026 - Version 1.1.0
// - ShowBand takes the locked axis and colours the band by it.
//
// 10-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Surface, Markup and Shape Geometry
    // ------------------------------------------------------------
    import { Na__LeCfg__GetSelectionSetup, Na__LeCfg__GetTextSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__IsLayerLocked, Na__LeModel__IsLayerVisible } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__ZOOM_SETTLED_EVENT, Na__LeSurface__GetElements, Na__LeSurface__GetPixelsPerMm, Na__LeSurface__GetZoom } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeMarkup__DimensionSkeleton, Na__LeMarkup__DimensionTextLayout, Na__LeMarkup__AnnotationRotateGrip } from '../15__Core__Markup/Na__LayoutEditor__MarkupBridge__.js';
    import { Na__LeDimGeo__HitText, Na__LeDimGeo__DistanceToPolyline } from '../15__Core__Markup/Na__LayoutEditor__DimensionGeometry__.js';
    import { Na__LeShapeGeo__Points, Na__LeShapeGeo__VertexAt } from '../15__Core__Markup/Na__LayoutEditor__ShapeGeometry__.js';
    import { Na__LeLeadGeo__Hit } from '../15__Core__Markup/Na__LayoutEditor__LeaderGeometry__.js';
    import { Na__LeGroup__Render } from '../15__Core__Markup/Na__LayoutEditor__Groups__.js';
    import { Na__LeScope__GetVectorId, Na__LeScope__GetDimensionId, Na__LeScope__HasVertex, Na__LeScope__VertexCount, Na__LeScope__HasGrip } from './Na__LayoutEditor__EditScope__.js';
    import { Na__LeOsnap__OnLinework } from '../28__System__ObjectSnap/Na__LayoutEditor__ObjectSnap__Search__.js';   // <-- Is this point ON the drawing: what a vertex grip's colour says
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Cursor Over a Rotate Grip
    // ------------------------------------------------------------
    // A curved arrow drawn inline, because no stock cursor says "turn". The
    // hotspot is its middle; 'grab' stands in wherever a drawn cursor is refused.
    // ------------------------------------------------------------
    const Na__LeGrips__ROTATE_CURSOR = 'url("data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">' +
        '<path d="M5.5 12a6.5 6.5 0 1 0 2-4.7" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>' +
        '<path d="M5.5 12a6.5 6.5 0 1 0 2-4.7" fill="none" stroke="#172b3a" stroke-width="1.8" stroke-linecap="round"/>' +
        '<path d="M5.6 9.1 L9.5 8.5 L6.3 5.2 Z" fill="#172b3a" stroke="#ffffff" stroke-width="0.9" stroke-linejoin="round"/>' +
        '</svg>') + '") 12 12, grab';
    // ------------------------------------------------------------


    // MODULE CONSTANTS | The Cursor the Move Tool Carries
    // ------------------------------------------------------------
    // The four-way arrow of every CAD move tool, drawn inline so it reads the
    // same on every machine, with a white casing so it stays visible over black
    // linework and over a dark viewport picture alike. 'move' stands in
    // wherever a drawn cursor is refused.
    // ------------------------------------------------------------
    const Na__LeGrips__MOVE_CURSOR = 'url("data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">' +
        '<path d="M12 2.5 L15 6 H13 V11 H18 V9 L21.5 12 L18 15 V13 H13 V18 H15 L12 21.5 L9 18 H11 V13 H6 V15 L2.5 12 L6 9 V11 H11 V6 H9 Z" ' +
        'fill="#172b3a" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round"/>' +
        '</svg>') + '") 12 12, move';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Rubber Band and the Rubber Box
    // ------------------------------------------------------------
    let Na__LeGrips__Band   = null;
    let Na__LeGrips__BandAt = null;        // <-- { sx, sy, ex, ey } paper millimetres of the band on show, so a settled zoom can lay it again
    let Na__LeGrips__Box    = null;
    let Na__LeGrips__BoxAt  = null;        // <-- { sx, sy, ex, ey } paper millimetres of the box on show, so a settled zoom can lay it again
    let Na__LeGrips__Insert = null;
    const Na__LeGrips__BOX_EDGE_PX = 2;    // <-- The box's edge on SCREEN, the vector previews' LinePx
    // ------------------------------------------------------------

    // MODULE VARIABLES | Features That Draw Grips of Their Own on a Selected Group
    // ------------------------------------------------------------
    // provider(layer, sheet, selection, ppm, zoom), called after the group's
    // box is drawn. A group has no grips of its own; a parametric element is a
    // group that does (Na__LayoutEditor__ScrapbookParametric__Grips__). It
    // registers here rather than being imported, so this module never learns
    // what a parametric element is.
    // ------------------------------------------------------------
    const Na__LeGrips__GroupProviders = [];
    // ------------------------------------------------------------

    // MODULE VARIABLES | Features That Draw the Grips of a Kind of Selected Shape
    // ------------------------------------------------------------
    // provider(layer, sheet, selection, ppm, zoom, sizePx, shape) returns true
    // when the shape is one of its own and it has drawn that shape's grips -
    // a picture's four corner grips (Na__LayoutEditor__SheetImages__Handles__).
    // Asked before the vertex grips, which a shape answered for never gets.
    // ------------------------------------------------------------
    const Na__LeGrips__ShapeProviders = [];
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Rendering
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Transform That Keeps a Grip Its Own Size at Any Zoom
    // ------------------------------------------------------------
    // A GRIP IS LAID OUT AT ITS REAL SIZE AND SCALED BACK, NEVER GIVEN A
    // FRACTIONAL SIZE. Everything in the handles layer sits inside the paper's
    // scale(zoom). The grips used to be written at size / zoom with a border
    // of 1 / zoom, and Chrome will not lay out a border thinner than one DEVICE
    // pixel - a floor it applies BEFORE the paper's scale. Zoomed in to 8x on a
    // 150% display the 0.125 px border became 0.67 px, which the zoom then
    // made 5 px on each side of a 9 px grip: the border swallowed the grip
    // whole. A plain grip read as a solid blue disc and a PICKED one - white
    // border, red middle - as a solid WHITE disc, invisible on white paper,
    // exactly where the picking is done (Adam, 21-Sep-2026: "the vectors are
    // white ... it's impossible to see what you're trying to select"). A
    // transform has no such floor: the element keeps whole-pixel sizes and a
    // one-pixel border, and scale(1 / zoom) cancels the paper's zoom exactly.
    // turnDeg turns the grip about its middle as well (the insert diamond).
    //
    // AND IT IS PLACED BY THE SAME TRANSFORM, NEVER BY left AND top, which have
    // a floor of their own: the browser rounds them to a whole device pixel
    // BEFORE the paper's scale, and the zoom multiplies the difference - up to
    // half a pixel times the zoom, so at 32x a grip stood up to 16 px from the
    // vertex it is the handle of, and a green one ("on the drawing") beside
    // the corner it was on. A translate goes through the zoom at full
    // precision. So the grip sits at left 0, top 0 with its origin at that
    // corner, and the transform reads right to left: back by half its size
    // (its MIDDLE on the origin), turned, scaled back, carried to the point.
    // ------------------------------------------------------------
    function Na__LeGrips__Place(grip, xPx, yPx, zoom, turnDeg) {
        grip.style.left            = '0px';
        grip.style.top             = '0px';
        grip.style.transformOrigin = '0 0';
        grip.style.transform       = 'translate(' + xPx + 'px, ' + yPx + 'px) scale(' + (1 / (zoom > 0 ? zoom : 1)) + ')' + (turnDeg ? ' rotate(' + turnDeg + 'deg)' : '') + ' translate(-50%, -50%)';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Grip Element
    // ------------------------------------------------------------
    // A PICKED GRIP IS DRAWN LARGER as well as red. It marks the points the next
    // drag will carry, so it has to be findable at a glance among the plain ones
    // and big enough to read at any zoom; GripSizePickedPx sets how much larger.
    //
    // state is what a POINT grip says about where it stands (StateOf below):
    // 'bound', 'online' or 'free'. Left out, the grip is the plain white one -
    // a rotate grip, a leader's, a dimension line's - which has no such thing
    // to say. The size arrives already divided by the zoom, as the providers'
    // does, and is put back: the element is its real size, scaled down.
    // ------------------------------------------------------------
    function Na__LeGrips__Add(layer, xMm, yMm, ppm, sizePx, zoom, modifier, picked, state) {
        const grip = document.createElement('div');
        const setup = Na__LeCfg__GetSelectionSetup();
        const scale = zoom > 0 ? zoom : 1;
        const size  = Math.round((picked ? (sizePx * (setup.gripSizePickedPx / setup.gripSizePx)) : sizePx) * scale);   // <-- Whole pixels on screen
        grip.className = 'na-le-grip' + (modifier ? ' na-le-grip--' + modifier : '') + (state ? ' na-le-grip--' + state : '') + (picked ? ' na-le-grip--picked' : '');
        grip.style.width     = size + 'px';
        grip.style.height    = size + 'px';
        Na__LeGrips__Place(grip, xMm * ppm, yMm * ppm, scale, 0);
        layer.appendChild(grip);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What a Point Grip Says About Where Its Point Stands
    // ------------------------------------------------------------
    // GREEN IS ON THE DRAWING, BLUE IS NOT. A vertex snapped to the corner of
    // a wall sits on it to the last digit; one placed by eye sits a fraction
    // of a millimetre off and looks exactly the same - until the area is
    // measured, or the drawing is printed at a bigger scale. So each point
    // grip is asked of the object snap (Na__LeOsnap__OnLinework):
    //   'bound'   solid green   on a corner, a middle or a crossing of a
    //                           viewport's linework: a place a snap finds
    //   'online'  a green ring  on one of its lines, at no particular place
    //   'free'    solid blue    on nothing
    // It is a reading of where the point IS, not a memory of how it got
    // there, so a viewport moved afterwards turns its vertices blue again -
    // which is the truth. A picked grip stays red and wears a green edge.
    // ------------------------------------------------------------
    function Na__LeGrips__StateOf(sheet, xMm, yMm) {
        let on = null;
        try { on = Na__LeOsnap__OnLinework(sheet, { x : xMm, y : yMm }); } catch (error) { on = null; }   // <-- A grip must always draw, whatever the index makes of a half-loaded viewport
        return on === 'point' ? 'bound' : (on === 'line' ? 'online' : 'free');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Stem From a Text Item's Outline to Its Rotate Grip
    // ------------------------------------------------------------
    // A grip element as well, so whatever clears the grips clears the stem.
    // ------------------------------------------------------------
    function Na__LeGrips__AddStem(layer, from, to, ppm, zoom) {
        const stem = document.createElement('div');
        stem.className = 'na-le-grip na-le-grip--stem';
        const scale = zoom > 0 ? zoom : 1;
        stem.style.left      = (from.x * ppm) + 'px';
        stem.style.top       = (from.y * ppm) + 'px';
        stem.style.width     = (Math.hypot(to.x - from.x, to.y - from.y) * ppm * scale) + 'px';   // <-- Its length on SCREEN: the transform below scales it, and its one-pixel line, back down
        stem.style.transform = 'rotate(' + (Math.atan2(to.y - from.y, to.x - from.x) * (180 / Math.PI)) + 'deg) scale(' + (1 / scale) + ')';
        layer.appendChild(stem);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | How Far Off Its Outline a Rotate Grip Stands, in Paper Millimetres
    // ------------------------------------------------------------
    // Text RotateGripOffsetPx on screen at any zoom, as the grips keep their size.
    // ------------------------------------------------------------
    function Na__LeGrips__RotateReachMm(ppm, zoom) {
        return Na__LeCfg__GetTextSetup().rotateGripOffsetPx / Math.max(1e-6, ppm * zoom);
    }
    // ------------------------------------------------------------


    // FUNCTION | Let a Feature Draw Its Own Grips on a Selected Group (once per provider)
    // ------------------------------------------------------------
    function Na__LeGrips__RegisterGroupProvider(provider) {
        if (typeof provider !== 'function' || Na__LeGrips__GroupProviders.indexOf(provider) !== -1) return false;
        Na__LeGrips__GroupProviders.push(provider);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Let a Feature Draw the Grips of Its Own Kind of Shape (once per provider)
    // ------------------------------------------------------------
    function Na__LeGrips__RegisterShapeProvider(provider) {
        if (typeof provider !== 'function' || Na__LeGrips__ShapeProviders.indexOf(provider) !== -1) return false;
        Na__LeGrips__ShapeProviders.push(provider);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Draw the Grips for the Selection (nothing for a viewport or a locked layer)
    // ------------------------------------------------------------
    function Na__LeGrips__Render(layer, sheet, selection, ppm, zoom) {
        if (!layer || !sheet || !selection) return false;
        const sizePx = Na__LeCfg__GetSelectionSetup().gripSizePx / zoom;      // <-- Constant on screen at any zoom
        if (selection.kind === 'dimension') {
            // A DIMENSION'S GRIPS ARE ITS INSIDES, like a vector's points: they
            // appear once it is open for editing and not before. Selecting a
            // dimension shows its highlight box; double-click (or Enter) and the
            // squares on the two measured points, the round grip on the line and
            // the one on a moved value all arrive together.
            // ------------------------------------
            if (Na__LeScope__GetDimensionId() !== selection.id) return false;
            const dim = sheet.Sheet__Dimensions.find((d) => d.Dimension__Id === selection.id);
            if (!dim || Na__LeModel__IsLayerLocked(sheet, dim.Dimension__LayerId)) return false;
            const sk = Na__LeMarkup__DimensionSkeleton(dim);
            if (!sk) return false;
            Na__LeGrips__Add(layer, sk.S.x, sk.S.y, ppm, sizePx, zoom, null, Na__LeScope__HasGrip('start'), Na__LeGrips__StateOf(sheet, sk.S.x, sk.S.y));   // <-- Green when the point it measures FROM is on the drawing
            Na__LeGrips__Add(layer, sk.E.x, sk.E.y, ppm, sizePx, zoom, null, Na__LeScope__HasGrip('end'), Na__LeGrips__StateOf(sheet, sk.E.x, sk.E.y));
            // THE LINE HAS A GRIP AT EACH END AS WELL AS THE MIDDLE. All three
            // slide the line: they change the OFFSET, carrying the line and the
            // value across to a new position while the two measured points stay
            // exactly where they are. Reaching for the end of a dimension line to
            // push it clear of something is the natural gesture - the middle grip
            // alone is often buried under the value - so all three are offered and
            // all three do the same thing.
            // ------------------------------------
            Na__LeGrips__Add(layer, sk.DS.x,  sk.DS.y,  ppm, sizePx, zoom, 'offset', Na__LeScope__HasGrip('offset'));
            Na__LeGrips__Add(layer, sk.MID.x, sk.MID.y, ppm, sizePx, zoom, 'offset', Na__LeScope__HasGrip('offset'));
            Na__LeGrips__Add(layer, sk.DE.x,  sk.DE.y,  ppm, sizePx, zoom, 'offset', Na__LeScope__HasGrip('offset'));
            const layout = Na__LeMarkup__DimensionTextLayout(sheet, dim, sk);
            if (layout && layout.leader) Na__LeGrips__Add(layer, layout.place.x, layout.place.y, ppm, sizePx, zoom, 'anchor', Na__LeScope__HasGrip('text'));   // <-- Round: the value has been dragged off the line
            return true;
        }
        if (selection.kind === 'shape') {
            // VERTEX GRIPS BELONG TO THE OPEN VECTOR, AND TO NOTHING ELSE. A
            // selected vector shows its highlight box and no dots: the dots are
            // what says "you are inside this one, and the points are what a
            // press will take hold of". Double-click (or Enter) to get them.
            // A picked vertex is drawn solid, so a box selection of several
            // reads at a glance.
            //
            // A KIND OF SHAPE WITH GRIPS OF ITS OWN - a picture's four corners -
            // answers first, open or not, and a shape it answers for gets no
            // vertex grips at all.
            // ------------------------------------
            const own = Na__LeGrips__ShapeProviders.length ? sheet.Sheet__Shapes.find((s) => s.Shape__Id === selection.id) : null;
            if (own && Na__LeGrips__ShapeProviders.some((provider) => {
                try { return provider(layer, sheet, selection, ppm, zoom, sizePx, own) === true; }
                catch (error) { console.warn('[TrueVision3D LayoutEditor] A shape grip provider failed.', error); return false; }
            })) return true;
            if (Na__LeScope__GetVectorId() !== selection.id) return false;
            const shape = sheet.Sheet__Shapes.find((s) => s.Shape__Id === selection.id);
            if (!shape || Na__LeModel__IsLayerLocked(sheet, shape.Shape__LayerId)) return false;
            const anyPicked = Na__LeScope__VertexCount() > 0;
            Na__LeShapeGeo__Points(shape).forEach((p, index) => {
                Na__LeGrips__Add(layer, p[0], p[1], ppm, sizePx, zoom, null, anyPicked && Na__LeScope__HasVertex(index), Na__LeGrips__StateOf(sheet, p[0], p[1]));   // <-- Red picked, green on the drawing, blue free
            });
            return true;
        }
        if (selection.kind === 'group') {
            const drawn = Na__LeGroup__Render(layer, sheet, [ selection ], ppm, zoom);
            Na__LeGrips__GroupProviders.forEach((provider) => {                  // <-- A parametric element's own grips, over the group's box
                try { provider(layer, sheet, selection, ppm, zoom); } catch (error) { console.warn('[TrueVision3D LayoutEditor] A group grip provider failed.', error); }
            });
            return drawn;
        }
        if (selection.kind === 'annotation') {
            const item = (sheet.Sheet__Annotations || []).find((a) => a.Annotation__Id === selection.id);
            if (!item || !Na__LeModel__IsLayerVisible(sheet, item.Annotation__LayerId) || Na__LeModel__IsLayerLocked(sheet, item.Annotation__LayerId)) return false;
            const at = Na__LeMarkup__AnnotationRotateGrip(item, Na__LeGrips__RotateReachMm(ppm, zoom));
            Na__LeGrips__AddStem(layer, at.base, at.grip, ppm, zoom);
            Na__LeGrips__Add(layer, at.grip.x, at.grip.y, ppm, sizePx, zoom, 'rotate');   // <-- Round, on its stem: turns the text about its middle
            return true;
        }
        if (selection.kind === 'leader') {
            const leader = (sheet.Sheet__Leaders || []).find((l) => l.Leader__Id === selection.id);
            if (!leader || Na__LeModel__IsLayerLocked(sheet, leader.Leader__LayerId)) return false;
            Na__LeGrips__Add(layer, leader.Leader__TipXMm, leader.Leader__TipYMm, ppm, sizePx, zoom, null);
            Na__LeGrips__Add(layer, leader.Leader__AnchorXMm, leader.Leader__AnchorYMm, ppm, sizePx, zoom, 'anchor');   // <-- Round: the head goes with it, the tip stays
            return true;
        }
        return false;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Rubber Band
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Lay the Band From One Paper Point to Another, One Pixel Wide at Any Zoom
    // ------------------------------------------------------------
    // THE BAND IS A GRIP'S KIND OF THING, AND IS NOW DRAWN AS ONE. It used to be
    // a box laid out in PAPER pixels - left, top, a width, a one-pixel dashed
    // edge - inside the paper's scale(zoom), and three things went wrong with
    // that, all of them worse the closer the work:
    //   * ITS EDGE GREW WITH THE ZOOM. At 32x the one-pixel line was a bar 21
    //     pixels thick with dashes to match, and it hung to ONE SIDE of the line
    //     it stood for (a top edge grows downwards from the box).
    //   * ITS START WAS ROUNDED to a whole device pixel before the zoom, as any
    //     left and top are, and the zoom multiplied the difference: up to 16
    //     pixels off the point it starts from at 32x.
    //   * ITS LENGTH WAS ROUNDED the same way, so its far end - the end that
    //     runs to the snap marker - stopped short of it or ran past.
    // So, like the grips (Place): the element is laid out at the length it has
    // ON SCREEN, which rounds to a screen pixel and no worse, with its own
    // one-pixel edge; it sits at left 0, top 0 with its origin there (the
    // stylesheet's), and one transform - read right to left - lifts it by half
    // its thickness so its MIDDLE is the line, scales it back by 1 / zoom, turns
    // it, and carries its start to the point.
    // ------------------------------------------------------------
    function Na__LeGrips__PlaceBand() {
        const band = Na__LeGrips__Band, at = Na__LeGrips__BandAt;
        if (!band || !at) return;
        const ppm  = Na__LeSurface__GetPixelsPerMm();
        const zoom = Math.max(1e-6, Na__LeSurface__GetZoom());
        const len  = Math.hypot(at.ex - at.sx, at.ey - at.sy);
        const ang  = Math.atan2(at.ey - at.sy, at.ex - at.sx) * (180 / Math.PI);
        band.style.left      = '0px';
        band.style.top       = '0px';
        band.style.width     = (len * ppm * zoom) + 'px';                        // <-- Its length on SCREEN: the transform scales it, and its one-pixel edge, back down
        band.style.transform = 'translate(' + (at.sx * ppm) + 'px, ' + (at.sy * ppm) + 'px) rotate(' + ang + 'deg) scale(' + (1 / zoom) + ') translateY(-50%)';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Zoom Has Settled: the Band on Show Takes Its Thickness Again
    // ------------------------------------------------------------
    // A wheel zoom moves no pointer, so no tool stretches the band again: it
    // would stay as thick as the zoom had made it until the mouse next moved.
    // ------------------------------------------------------------
    function Na__LeGrips__OnZoomSettled() {
        if (Na__LeGrips__Band && Na__LeGrips__Band.parentNode) Na__LeGrips__PlaceBand();
    }
    // ------------------------------------------------------------


    // FUNCTION | Stretch the Band Between Two Paper Points ({ x, y } or [x, y])
    // ------------------------------------------------------------
    // axis is the locked axis, if any: the band takes that axis's colour
    // so the lock is visible without reading anything.
    // ------------------------------------------------------------
    function Na__LeGrips__ShowBand(start, end, axis) {
        const layer = Na__LeSurface__GetElements().handles;
        if (!layer) return false;
        const sx = Array.isArray(start) ? start[0] : start.x, sy = Array.isArray(start) ? start[1] : start.y;
        const ex = Array.isArray(end)   ? end[0]   : end.x,   ey = Array.isArray(end)   ? end[1]   : end.y;
        if (!Na__LeGrips__Band) {
            Na__LeGrips__Band = document.createElement('div');
            window.addEventListener(Na__LeSurface__ZOOM_SETTLED_EVENT, Na__LeGrips__OnZoomSettled);   // <-- Once, with the one band there ever is. Here and not at the top of the module: the sheet surface imports this module, so its event name is not there to read until something runs
        }
        Na__LeGrips__Band.className = 'na-le-rubber-band' + (axis ? ' na-le-rubber-band--' + axis : '');
        if (Na__LeGrips__Band.parentNode !== layer) layer.appendChild(Na__LeGrips__Band);
        Na__LeGrips__BandAt = { sx : sx, sy : sy, ex : ex, ey : ey };
        Na__LeGrips__PlaceBand();
        Na__LeGrips__Band.hidden = false;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Take the Band Away
    // ------------------------------------------------------------
    function Na__LeGrips__HideBand() {
        if (Na__LeGrips__Band && Na__LeGrips__Band.parentNode) Na__LeGrips__Band.parentNode.removeChild(Na__LeGrips__Band);
        Na__LeGrips__BandAt = null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Stretch the Box Between Two Opposite Corners ({ x, y } or [x, y])
    // ------------------------------------------------------------
    // The rectangle tool's preview: the four edges the rectangle will have,
    // in the band's dashed blue. square draws it solid, the way a locked band
    // goes solid, so a held constraint shows without reading anything. The
    // edge is counter-scaled like the grips, so it stays thin at any zoom.
    // ------------------------------------------------------------
    function Na__LeGrips__ShowBox(start, end, square) {
        const layer = Na__LeSurface__GetElements().handles;
        if (!layer) return false;
        const sx = Array.isArray(start) ? start[0] : start.x, sy = Array.isArray(start) ? start[1] : start.y;
        const ex = Array.isArray(end)   ? end[0]   : end.x,   ey = Array.isArray(end)   ? end[1]   : end.y;
        if (!Na__LeGrips__Box) {
            Na__LeGrips__Box = document.createElement('div');
            window.addEventListener(Na__LeSurface__ZOOM_SETTLED_EVENT, Na__LeGrips__OnZoomSettledBox);   // <-- Once, with the one box there ever is, as the band does
        }
        Na__LeGrips__Box.className = 'na-le-rubber-box' + (square ? ' na-le-rubber-box--square' : '');
        if (Na__LeGrips__Box.parentNode !== layer) layer.appendChild(Na__LeGrips__Box);
        Na__LeGrips__BoxAt = { sx : sx, sy : sy, ex : ex, ey : ey };
        Na__LeGrips__PlaceBox();
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Lay the Box Over Its Rectangle, Its Edge Centred on the Rectangle's Edge
    // ------------------------------------------------------------
    // THE BOX IS DRAWN THE WAY THE BAND IS (PlaceBand), for the same reasons.
    // It was laid out in paper pixels with a border of 4 / zoom, and Chrome
    // floors a border at one device pixel BEFORE the paper's scale - so zoomed
    // in, the zoom multiplied the floor back up into a bar many pixels thick.
    // And a border-box border lies wholly INSIDE the box, so the dashed edge
    // stood a whole stroke in from the corner it runs to (Adam, 22-Sep-2026:
    // "the line is set in slightly"). Now the element is its size ON SCREEN
    // plus one stroke, with a whole-pixel border, carried to the corner and
    // scaled back by one transform, and pulled back by half a stroke - so the
    // MIDDLE of the stroke is the rectangle's edge, at any zoom.
    // ------------------------------------------------------------
    function Na__LeGrips__PlaceBox() {
        const box = Na__LeGrips__Box, at = Na__LeGrips__BoxAt;
        if (!box || !at) return;
        const ppm  = Na__LeSurface__GetPixelsPerMm();
        const zoom = Math.max(1e-6, Na__LeSurface__GetZoom());
        const edge = Na__LeGrips__BOX_EDGE_PX;
        box.style.left            = '0px';
        box.style.top             = '0px';
        box.style.transformOrigin = '0 0';
        box.style.borderWidth     = edge + 'px';
        box.style.width           = (Math.abs(at.ex - at.sx) * ppm * zoom + edge) + 'px';
        box.style.height          = (Math.abs(at.ey - at.sy) * ppm * zoom + edge) + 'px';
        box.style.transform       = 'translate(' + (Math.min(at.sx, at.ex) * ppm) + 'px, ' + (Math.min(at.sy, at.ey) * ppm) + 'px) scale(' + (1 / zoom) + ') translate(' + (-edge / 2) + 'px, ' + (-edge / 2) + 'px)';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Zoom Has Settled: the Box on Show Takes Its Thickness Again
    // ------------------------------------------------------------
    function Na__LeGrips__OnZoomSettledBox() {
        if (Na__LeGrips__Box && Na__LeGrips__Box.parentNode) Na__LeGrips__PlaceBox();
    }
    // ------------------------------------------------------------


    // FUNCTION | Take the Box Away
    // ------------------------------------------------------------
    function Na__LeGrips__HideBox() {
        if (Na__LeGrips__Box && Na__LeGrips__Box.parentNode) Na__LeGrips__Box.parentNode.removeChild(Na__LeGrips__Box);
        Na__LeGrips__BoxAt = null;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Diamond Grip Where a Shift-Click Will Insert a Vertex
    // ------------------------------------------------------------
    function Na__LeGrips__ShowInsert(xMm, yMm) {
        const layer = Na__LeSurface__GetElements().handles;
        if (!layer || !Number.isFinite(xMm) || !Number.isFinite(yMm)) return false;
        if (!Na__LeGrips__Insert) {
            Na__LeGrips__Insert = document.createElement('div');
            Na__LeGrips__Insert.className = 'na-le-grip na-le-grip--insert';
        }
        if (Na__LeGrips__Insert.parentNode !== layer) layer.appendChild(Na__LeGrips__Insert);
        const ppm    = Na__LeSurface__GetPixelsPerMm();
        const zoom   = Na__LeSurface__GetZoom();
        const sizePx = Na__LeCfg__GetSelectionSetup().gripSizePx;
        Na__LeGrips__Insert.style.width     = sizePx + 'px';
        Na__LeGrips__Insert.style.height    = sizePx + 'px';
        Na__LeGrips__Place(Na__LeGrips__Insert, xMm * ppm, yMm * ppm, zoom, 45);     // <-- Its real size scaled back, and turned: a diamond
        Na__LeGrips__Insert.hidden = false;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Take the Insert Preview Away (true when it was showing)
    // ------------------------------------------------------------
    function Na__LeGrips__HideInsert() {
        const shown = !!(Na__LeGrips__Insert && !Na__LeGrips__Insert.hidden);
        if (Na__LeGrips__Insert) Na__LeGrips__Insert.hidden = true;
        return shown;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Hit Testing
// -----------------------------------------------------------------------------

    // FUNCTION | Which Part of a Dimension a Press Grabs
    // ------------------------------------------------------------
    // 'start' and 'end' are the measured points, 'text' the value (or the
    // arc back to the line once it has been dragged off), 'offset' the
    // dimension line (its round grip or anywhere along it), else 'whole'.
    // sheet is used to measure the value; without it the text cannot be
    // distinguished from the line.
    // ------------------------------------------------------------
    function Na__LeGrips__DimensionGrab(dim, pointMm, toleranceMm, sheet) {
        const tol = toleranceMm * 2;
        if (Math.hypot(pointMm.x - dim.Dimension__StartXMm, pointMm.y - dim.Dimension__StartYMm) <= tol) return 'start';
        if (Math.hypot(pointMm.x - dim.Dimension__EndXMm,   pointMm.y - dim.Dimension__EndYMm)   <= tol) return 'end';
        const sk = Na__LeMarkup__DimensionSkeleton(dim);
        const layout = (sk && sheet) ? Na__LeMarkup__DimensionTextLayout(sheet, dim, sk) : null;
        if (layout && Na__LeDimGeo__HitText(layout.box, pointMm, toleranceMm)) return 'text';
        if (layout && layout.leader && Na__LeDimGeo__DistanceToPolyline(pointMm, layout.leader.points) <= toleranceMm) return 'text';
        if (sk) {
            if (Math.hypot(pointMm.x - sk.MID.x, pointMm.y - sk.MID.y) <= tol) return 'offset';
            if (Math.hypot(pointMm.x - sk.DS.x,  pointMm.y - sk.DS.y)  <= tol) return 'offset';   // <-- The line's own ends read as wide as the middle grip
            if (Math.hypot(pointMm.x - sk.DE.x,  pointMm.y - sk.DE.y)  <= tol) return 'offset';
            const abx = sk.DE.x - sk.DS.x, aby = sk.DE.y - sk.DS.y, len2 = (abx * abx) + (aby * aby);
            const t = len2 > 0 ? (((pointMm.x - sk.DS.x) * abx) + ((pointMm.y - sk.DS.y) * aby)) / len2 : 0;
            const cx = sk.DS.x + (abx * Math.max(0, Math.min(1, t))), cy = sk.DS.y + (aby * Math.max(0, Math.min(1, t)));
            if (Math.hypot(pointMm.x - cx, pointMm.y - cy) <= toleranceMm) return 'offset';
        }
        return 'whole';
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Part of a Shape a Press Grabs
    // ------------------------------------------------------------
    // Returns { mode : 'vertex', index } or { mode : 'whole' }.
    // ------------------------------------------------------------
    function Na__LeGrips__ShapeGrab(shape, pointMm, toleranceMm) {
        const index = Na__LeShapeGeo__VertexAt(shape, pointMm, toleranceMm * 2);
        return index >= 0 ? { mode : 'vertex', index : index } : { mode : 'whole', index : -1 };
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Part of a Leader a Press Grabs
    // ------------------------------------------------------------
    // 'tip' re-points the leader (its grip or its endpoint circle); 'anchor'
    // moves the head and leaves the tip on what it points at (the anchor grip,
    // the bubble or the note); 'whole' moves both (anywhere along the curve).
    // The two grips are found at twice the tolerance, as a dimension's are.
    // ------------------------------------------------------------
    function Na__LeGrips__LeaderGrab(leader, pointMm, toleranceMm) {
        const tol = toleranceMm * 2;
        if (Math.hypot(pointMm.x - leader.Leader__TipXMm, pointMm.y - leader.Leader__TipYMm) <= tol) return 'tip';
        if (Math.hypot(pointMm.x - leader.Leader__AnchorXMm, pointMm.y - leader.Leader__AnchorYMm) <= tol) return 'anchor';
        const part = Na__LeLeadGeo__Hit(leader, pointMm, toleranceMm);
        if (part === 'tip')  return 'tip';
        if (part === 'head') return 'anchor';
        return 'whole';
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Part of a Selected Text Item a Press Grabs
    // ------------------------------------------------------------
    // 'rotate' on its rotate grip, found at twice the tolerance as a
    // dimension's grips are; else 'whole'. ppm and zoom place the grip, which
    // stands a fixed distance off the outline on screen.
    // ------------------------------------------------------------
    function Na__LeGrips__AnnotationGrab(item, pointMm, toleranceMm, ppm, zoom) {
        if (!item || !pointMm) return 'whole';
        const at = Na__LeMarkup__AnnotationRotateGrip(item, Na__LeGrips__RotateReachMm(ppm, zoom));
        return Math.hypot(pointMm.x - at.grip.x, pointMm.y - at.grip.y) <= toleranceMm * 2 ? 'rotate' : 'whole';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Grips API
    // ------------------------------------------------------------
    export {
        Na__LeGrips__Render,
        Na__LeGrips__RegisterGroupProvider,
        Na__LeGrips__RegisterShapeProvider,
        Na__LeGrips__ShowBand,
        Na__LeGrips__HideBand,
        Na__LeGrips__ShowBox,
        Na__LeGrips__HideBox,
        Na__LeGrips__ShowInsert,
        Na__LeGrips__HideInsert,
        Na__LeGrips__DimensionGrab,
        Na__LeGrips__ShapeGrab,
        Na__LeGrips__LeaderGrab,
        Na__LeGrips__AnnotationGrab,
        Na__LeGrips__ROTATE_CURSOR,
        Na__LeGrips__MOVE_CURSOR
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
