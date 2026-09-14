// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SELECTION BOX
// =============================================================================
//
// FILE       : Na__LayoutEditor__SelectionBox__.js
// NAMESPACE  : Na__LeSelBox
// MODULE     : Layout Editor - Selection Box
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Box select as AutoCAD and SketchUp draw it: a window dragged to the right, a crossing dragged to the left, and what each one takes
// CREATED    : 14-Sep-2026
//
// DESCRIPTION:
// - A left drag with the Select tool draws a selection box when it starts
//   where there is nothing to move: bare paper, the grey stage, a locked
//   viewport, anything at all in a read-only session - or anywhere with Alt
//   held, for a sheet with no bare paper left to start from.
// - THE DIRECTION DECIDES THE RULE, as in AutoCAD. Dragged to the RIGHT the box
//   is a WINDOW: blue with a solid edge, and it takes only what lies wholly
//   inside it. Dragged to the LEFT it is a CROSSING: green with a dashed edge,
//   and it also takes anything it touches. Only the horizontal direction
//   counts. SketchUp draws the same two edges, so both read it at a glance.
// - WHAT TOUCHING MEANS, kind by kind:
//     Viewport   its frame edge. A crossing drawn wholly inside a viewport does
//                not take the viewport, so the notes and dimensions laid over a
//                drawing can be boxed without picking the drawing up with them.
//     Vector     its edges, including the closing edge a fill runs along. A box
//                inside a filled shape does not take it either, so a background
//                panel is not grabbed by boxing what sits on it.
//     Text       its text box, or its leader.
//     Dimension  its extension lines, its dimension line, its terminators,
//                its value, or the arc from a dragged value back to the line.
//     Leader     its line, its endpoint, or its bubble or note.
//   A window takes an item only when every one of those parts is inside it.
// - Hidden layers, locked layers and locked viewports are never taken. Locked
//   is background: lock a viewport and a box can start on it and sweep over it.
// - While the box is dragged, everything it would take is outlined in the
//   box's colour, so the two rules can be told apart before the button comes up.
// - Nothing here writes the selection. Release reports what the box took and
//   the modifier it was drawn with, Combine folds that into the selection, and
//   the sheet tools hand the result to the model.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__ owns the pointer: Press on a left press that
//   may become a box, Move on every move, Release when the button comes up,
//   Cancel with the placing tools, Refresh on a zoom or a model change.
// - The box and its preview live in the sheet surface's handles layer, counter-
//   scaled like the grips, so their edges keep one weight at any zoom.
// - Colours and edge styles are the stylesheet's (na-le-select-box); the
//   thresholds are the Selection block of Na__LayoutEditor__AppConfig__.json.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (14-Sep-2026)
// - ValeVision    : 1.0.0 ported 14-Sep-2026 as ValeVision v2.33.0, verbatim
//                   below the header, on top of the Leaders port (v2.32.0).
//                   Nothing here is app-specific; it reads only records both
//                   apps share. Later versions wait for their own sign-off.
// - Depends on    : Na__LayoutEditor__LeaderGeometry__ for the leader row
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 14-Sep-2026 - Version 1.2.0
// - A dimension whose value has been dragged off the line includes that
//   value's box and the arc back to the dimension line, so a window or a
//   crossing that covers the moved text takes the dimension.
//
// 14-Sep-2026 - Version 1.1.0
// - A dimension's terminator parts are boxed at Dimension__TickLengthMm, so a
//   larger arrow is taken by a window or a crossing that covers it.
//
// 14-Sep-2026 - Version 1.0.0
// - Initial implementation: window and crossing boxes, the touch rule for each
//   kind (viewports, vectors, text, dimensions and leaders), the live preview,
//   and the Add / Toggle / Remove combine.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Surface, Markup and Geometry
    // ------------------------------------------------------------
    import { Na__LeCfg__GetSelectionSetup } from './Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__IsLayerVisible, Na__LeModel__IsLayerLocked } from './Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__GetElements, Na__LeSurface__GetPixelsPerMm, Na__LeSurface__GetZoom } from './Na__LayoutEditor__SheetSurface__.js';
    import {
        Na__LeMarkup__AnnotationBounds,
        Na__LeMarkup__DimensionSkeleton,
        Na__LeMarkup__DimensionTickMm,
        Na__LeMarkup__DimensionValueMm,
        Na__LeMarkup__FormatDimension,
        Na__LeMarkup__DimensionTextLayout
    } from './Na__LayoutEditor__MarkupBridge__.js';
    import { Na__LeDimGeo__Terminator } from './Na__LayoutEditor__DimensionGeometry__.js';
    import { Na__LeShapeGeo__Points } from './Na__LayoutEditor__ShapeGeometry__.js';
    import { Na__LeLeadGeo__TYPE_BUBBLE, Na__LeLeadGeo__Layout, Na__LeLeadGeo__Circle, Na__LeLeadGeo__HasText } from './Na__LayoutEditor__LeaderGeometry__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Box Rules, Combine Modes, Classes and Text Proportions
    // ------------------------------------------------------------
    const Na__LeSelBox__MODE_WINDOW    = 'window';      // <-- Dragged to the right: wholly inside
    const Na__LeSelBox__MODE_CROSSING  = 'crossing';    // <-- Dragged to the left: inside or touching
    const Na__LeSelBox__COMBINE_ADD    = 'add';
    const Na__LeSelBox__COMBINE_TOGGLE = 'toggle';
    const Na__LeSelBox__COMBINE_REMOVE = 'remove';
    const Na__LeSelBox__BOX_CLASS      = 'na-le-select-box';
    const Na__LeSelBox__PREVIEW_CLASS  = 'na-le-select-preview';
    const Na__LeSelBox__DRAGGING_CLASS = 'na-le-dragging';
    const Na__LeSelBox__LEADER_DOT_MM  = 0.5;           // <-- The dot on a text leader's tip, as the markup bridge draws it
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Box Being Drawn and Its Elements
    // ------------------------------------------------------------
    let Na__LeSelBox__State   = null;    // <-- { pointerId, startMm, endMm, startX, startY, active, combine, pending, candidates }
    let Na__LeSelBox__BoxNode = null;
    let Na__LeSelBox__Frame   = 0;       // <-- The requestAnimationFrame handle holding the preview
    const Na__LeSelBox__PreviewNodes = [];
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Geometry
// -----------------------------------------------------------------------------
//
// An item is described as PARTS, each one a run of paper points:
//   { points : [[x, y], ...], closed : bool, area : bool }
// closed joins the last point back to the first; area says the inside counts
// as well as the edge (a text box is solid, a viewport frame is not). A window
// takes an item when every point of every part is inside the box - the box is
// convex, so every edge between those points is inside it too. A crossing also
// takes the item when any part touches the box.
//

    // HELPER FUNCTION | The Box Between Two Corners, Either Way Round
    // ------------------------------------------------------------
    function Na__LeSelBox__BoxOf(a, b) {
        return { minX : Math.min(a.x, b.x), minY : Math.min(a.y, b.y), maxX : Math.max(a.x, b.x), maxY : Math.max(a.y, b.y) };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is a Point Inside the Box (its edge counts)
    // ------------------------------------------------------------
    function Na__LeSelBox__Inside(box, x, y) {
        return x >= box.minX && x <= box.maxX && y >= box.minY && y <= box.maxY;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Does a Segment Reach Into the Box (Liang-Barsky clipping)
    // ------------------------------------------------------------
    // The segment is clipped against the box's four sides in turn; if any of it
    // is left after the last side, it is inside. A segment running parallel to a
    // side and outside that side's band can never enter.
    // ------------------------------------------------------------
    function Na__LeSelBox__SegmentTouches(box, ax, ay, bx, by) {
        const dx = bx - ax, dy = by - ay;
        let t0 = 0, t1 = 1;
        const clip = (p, q) => {
            if (p === 0) return q >= 0;
            const r = q / p;
            if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
            else       { if (r < t0) return false; if (r < t1) t1 = r; }
            return true;
        };
        return clip(-dx, ax - box.minX) && clip(dx, box.maxX - ax) && clip(-dy, ay - box.minY) && clip(dy, box.maxY - ay) && t0 <= t1;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is a Point Inside a Run of Points (ray casting, the run treated as closed)
    // ------------------------------------------------------------
    function Na__LeSelBox__PolygonContains(points, x, y) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const xi = points[i][0], yi = points[i][1], xj = points[j][0], yj = points[j][1];
            const crosses = ((yi > y) !== (yj > y)) && (x < (((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9)) + xi);
            if (crosses) inside = !inside;
        }
        return inside;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Paper Rectangle as a Part
    // ------------------------------------------------------------
    function Na__LeSelBox__RectPart(x, y, widthMm, heightMm, area) {
        return { points : [ [ x, y ], [ x + widthMm, y ], [ x + widthMm, y + heightMm ], [ x, y + heightMm ] ], closed : true, area : area === true };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Does One Part Touch the Box
    // ------------------------------------------------------------
    // A point inside, an edge reaching in, or - for a solid part - the box lying
    // wholly inside the part, where neither of the other two tests can see it.
    // ------------------------------------------------------------
    function Na__LeSelBox__PartTouches(box, part) {
        const pts = part.points;
        for (let i = 0; i < pts.length; i++) {
            if (Na__LeSelBox__Inside(box, pts[i][0], pts[i][1])) return true;
        }
        const edges = part.closed ? pts.length : pts.length - 1;
        for (let i = 0; pts.length > 1 && i < edges; i++) {
            const a = pts[i], b = pts[(i + 1) % pts.length];
            if (Na__LeSelBox__SegmentTouches(box, a[0], a[1], b[0], b[1])) return true;
        }
        return part.area === true && pts.length > 2 && Na__LeSelBox__PolygonContains(pts, box.minX, box.minY);
    }
    // ------------------------------------------------------------


    // FUNCTION | Does a Box Take an Item (window: wholly inside; crossing: inside or touching)
    // ------------------------------------------------------------
    function Na__LeSelBox__Takes(box, parts, mode) {
        if (!Array.isArray(parts) || parts.length === 0) return false;
        const whole = parts.every((part) => part.points.every((p) => Na__LeSelBox__Inside(box, p[0], p[1])));
        if (whole) return true;
        return mode === Na__LeSelBox__MODE_CROSSING && parts.some((part) => Na__LeSelBox__PartTouches(box, part));
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Rule a Drag Draws: to the Right a Window, to the Left a Crossing
    // ------------------------------------------------------------
    function Na__LeSelBox__ModeFor(startMm, endMm) {
        return (endMm.x < startMm.x) ? Na__LeSelBox__MODE_CROSSING : Na__LeSelBox__MODE_WINDOW;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Paper Rectangle a Set of Parts Covers
    // ------------------------------------------------------------
    function Na__LeSelBox__BoundsOf(parts) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        parts.forEach((part) => part.points.forEach((p) => {
            minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
            minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
        }));
        return { X : minX, Y : minY, WidthMm : maxX - minX, HeightMm : maxY - minY };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | What Each Kind Is Made Of
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Viewport: Its Frame Edge, Not Its Inside
    // ------------------------------------------------------------
    function Na__LeSelBox__ViewportParts(sheet, viewport) {
        const r = viewport.Viewport__FrameMm;
        return r ? [ Na__LeSelBox__RectPart(r.X, r.Y, r.WidthMm, r.HeightMm, false) ] : [];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Vector: Its Edges, the Closing Edge of a Fill Included
    // ------------------------------------------------------------
    function Na__LeSelBox__ShapeParts(sheet, shape) {
        const pts = Na__LeShapeGeo__Points(shape).map((p) => [ p[0], p[1] ]);
        if (!pts.length) return [];
        const filled = !!shape.Shape__FillColour || !!shape.Shape__Gradient;       // <-- As the hit test reads a fill
        return [ { points : pts, closed : pts.length > 2 && (shape.Shape__Closed === true || filled), area : false } ];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Text Item: Its Box, and Its Leader
    // ------------------------------------------------------------
    // The leader is run to the middle of the text box rather than to the edge
    // the markup bridge stops it at. The stretch that adds lies inside the text
    // box, which is a solid part already, so both rules come out the same.
    // ------------------------------------------------------------
    function Na__LeSelBox__AnnotationParts(sheet, item) {
        const b     = Na__LeMarkup__AnnotationBounds(item);
        const parts = [ Na__LeSelBox__RectPart(b.X, b.Y, b.WidthMm, b.HeightMm, true) ];
        if (Number.isFinite(item.Annotation__LeaderXMm) && Number.isFinite(item.Annotation__LeaderYMm)) {
            const tipX = item.Annotation__LeaderXMm, tipY = item.Annotation__LeaderYMm, r = Na__LeSelBox__LEADER_DOT_MM;
            parts.push({ points : [ [ tipX, tipY ], [ b.X + (b.WidthMm / 2), b.Y + (b.HeightMm / 2) ] ], closed : false, area : false });
            parts.push(Na__LeSelBox__RectPart(tipX - r, tipY - r, r * 2, r * 2, true));
        }
        return parts;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Dimension: Extension Lines, Dimension Line, Terminators and Value
    // ------------------------------------------------------------
    // The value's box turns with the text, so a vertical dimension's value is
    // measured up the sheet rather than across it.
    // ------------------------------------------------------------
    function Na__LeSelBox__DimensionParts(sheet, dim) {
        const sk = Na__LeMarkup__DimensionSkeleton(dim);
        if (!sk) return [];
        const line  = (a, b) => ({ points : [ [ a.x, a.y ], [ b.x, b.y ] ], closed : false, area : false });
        const parts = [ line(sk.X1, sk.T1), line(sk.X2, sk.T2), line(sk.DS, sk.DE) ];
        [ Na__LeDimGeo__Terminator(dim.Dimension__Terminator, sk.DS, -sk.dirX, -sk.dirY, Na__LeMarkup__DimensionTickMm(dim)),
          Na__LeDimGeo__Terminator(dim.Dimension__Terminator, sk.DE,  sk.dirX,  sk.dirY, Na__LeMarkup__DimensionTickMm(dim)) ]
            .forEach((t) => parts.push({ points : t.points.map((p) => [ p[0], p[1] ]), closed : t.closed, area : t.filled }));

        const text = Na__LeMarkup__FormatDimension(dim, Na__LeMarkup__DimensionValueMm(sheet, dim));
        if (text) {
            const layout = Na__LeMarkup__DimensionTextLayout(sheet, dim, sk);
            if (layout && layout.box) parts.push({ points : layout.box.points, closed : true, area : true });
            if (layout && layout.leader) parts.push({ points : layout.leader.points, closed : false, area : false });
        }
        return parts;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Leader: Its Line, Its Endpoint, and Its Bubble or Note
    // ------------------------------------------------------------
    // Laid out by Na__LayoutEditor__LeaderGeometry__ exactly as it is drawn. The
    // endpoint and the head are solid parts, like a text box; the line is not,
    // so only a box that reaches the line itself touches it.
    // ------------------------------------------------------------
    function Na__LeSelBox__LeaderParts(sheet, leader) {
        const layout = Na__LeLeadGeo__Layout(leader);
        const head   = layout.head;
        const parts  = [];
        if (layout.path.length) parts.push({ points : layout.path.map((p) => [ p[0], p[1] ]), closed : false, area : false });
        if (layout.tipRadius > 0) parts.push({ points : Na__LeLeadGeo__Circle(layout.tip.x, layout.tip.y, layout.tipRadius), closed : true, area : true });
        else parts.push({ points : [ [ layout.tip.x, layout.tip.y ] ], closed : false, area : false });
        if (head.type === Na__LeLeadGeo__TYPE_BUBBLE) parts.push({ points : Na__LeLeadGeo__Circle(head.centre.x, head.centre.y, head.radius), closed : true, area : true });
        else if (Na__LeLeadGeo__HasText(head)) parts.push(Na__LeSelBox__RectPart(head.box.X, head.box.Y, head.box.WidthMm, head.box.HeightMm, true));
        return parts;
    }
    // ------------------------------------------------------------


    // MODULE CONSTANTS | The Kinds a Box Can Take
    // ------------------------------------------------------------
    // One row per kind: where its records live, its id and layer keys, any lock
    // of its own beyond its layer's, and what it is made of. A new kind of sheet
    // item joins box select by adding a row.
    // ------------------------------------------------------------
    const Na__LeSelBox__KINDS = Object.freeze([
        { kind : 'viewport',   list : 'Sheet__Viewports',   idKey : 'Viewport__Id',   layerKey : 'Viewport__LayerId',   ownLock : (r) => r.Viewport__Locked === true, parts : Na__LeSelBox__ViewportParts },
        { kind : 'shape',      list : 'Sheet__Shapes',      idKey : 'Shape__Id',      layerKey : 'Shape__LayerId',      ownLock : null, parts : Na__LeSelBox__ShapeParts },
        { kind : 'annotation', list : 'Sheet__Annotations', idKey : 'Annotation__Id', layerKey : 'Annotation__LayerId', ownLock : null, parts : Na__LeSelBox__AnnotationParts },
        { kind : 'dimension',  list : 'Sheet__Dimensions',  idKey : 'Dimension__Id',  layerKey : 'Dimension__LayerId',  ownLock : null, parts : Na__LeSelBox__DimensionParts },
        { kind : 'leader',     list : 'Sheet__Leaders',     idKey : 'Leader__Id',     layerKey : 'Leader__LayerId',     ownLock : null, parts : Na__LeSelBox__LeaderParts }
    ]);
    // ------------------------------------------------------------


    // FUNCTION | Every Item a Box Could Take on a Sheet, With Its Parts and Bounds
    // ------------------------------------------------------------
    // Built when a box starts and again on a zoom or a model change, never on
    // every move: a dimension's value has to be measured to know its box.
    // ------------------------------------------------------------
    function Na__LeSelBox__Candidates(sheet) {
        const list = [];
        if (!sheet) return list;
        Na__LeSelBox__KINDS.forEach((row) => {
            const records = Array.isArray(sheet[row.list]) ? sheet[row.list] : [];
            records.forEach((record) => {
                if (!record || !Na__LeModel__IsLayerVisible(sheet, record[row.layerKey]) || Na__LeModel__IsLayerLocked(sheet, record[row.layerKey])) return;
                if (row.ownLock && row.ownLock(record)) return;                     // <-- Locked is background: never taken
                const parts = row.parts(sheet, record).filter((part) => part && Array.isArray(part.points) && part.points.length > 0);
                if (parts.length) list.push({ kind : row.kind, id : record[row.idKey], parts : parts, bounds : Na__LeSelBox__BoundsOf(parts) });
            });
        });
        return list;
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Box Between Two Paper Points Takes
    // ------------------------------------------------------------
    // mode is a MODE_ constant; leave it out and the direction decides.
    // Returns [{ kind, id }], viewports first, then vectors, text, dimensions and leaders.
    // ------------------------------------------------------------
    function Na__LeSelBox__ItemsIn(sheet, startMm, endMm, mode) {
        if (!sheet || !startMm || !endMm) return [];
        const rule = mode || Na__LeSelBox__ModeFor(startMm, endMm);
        const box  = Na__LeSelBox__BoxOf(startMm, endMm);
        return Na__LeSelBox__Candidates(sheet)
            .filter((candidate) => Na__LeSelBox__Takes(box, candidate.parts, rule))
            .map((candidate) => ({ kind : candidate.kind, id : candidate.id }));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Combining With the Selection
// -----------------------------------------------------------------------------

    // FUNCTION | Fold What a Box or a Click Took Into the Selection
    // ------------------------------------------------------------
    // combine, the modifiers as SketchUp holds them:
    //   null       the items taken replace the selection
    //   'add'      Ctrl: the items taken join it
    //   'toggle'   Shift: each item taken flips - in if it was out, out if it was in
    //   'remove'   Ctrl+Shift: the items taken leave it
    // Pure: returns a new list of { kind, id } with duplicates dropped.
    // ------------------------------------------------------------
    function Na__LeSelBox__Combine(current, taken, combine) {
        const key  = (item) => item.kind + ':' + item.id;
        const tidy = (list) => {
            const seen = new Set();
            return (Array.isArray(list) ? list : []).filter((item) => {
                if (!item || !item.kind || !item.id || seen.has(key(item))) return false;
                seen.add(key(item));
                return true;
            }).map((item) => ({ kind : item.kind, id : item.id }));
        };
        const now  = tidy(current);
        const hits = tidy(taken);
        const had  = new Set(now.map(key));
        const hit  = new Set(hits.map(key));
        if (combine === Na__LeSelBox__COMBINE_ADD)    return now.concat(hits.filter((item) => !had.has(key(item))));
        if (combine === Na__LeSelBox__COMBINE_REMOVE) return now.filter((item) => !hit.has(key(item)));
        if (combine === Na__LeSelBox__COMBINE_TOGGLE) return now.filter((item) => !hit.has(key(item))).concat(hits.filter((item) => !had.has(key(item))));
        return hits;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Box and Its Preview on the Paper
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Lay an Element Over a Paper Rectangle in the Handles Layer
    // ------------------------------------------------------------
    function Na__LeSelBox__Place(node, layer, x, y, widthMm, heightMm, className) {
        const ppm  = Na__LeSurface__GetPixelsPerMm();
        const zoom = Na__LeSurface__GetZoom() || 1;
        if (node.parentNode !== layer) layer.appendChild(node);
        node.className         = className;
        node.style.left        = (x * ppm) + 'px';
        node.style.top         = (y * ppm) + 'px';
        node.style.width       = Math.max(0, widthMm  * ppm) + 'px';
        node.style.height      = Math.max(0, heightMm * ppm) + 'px';
        node.style.borderWidth = Math.max(1, Na__LeCfg__GetSelectionSetup().boxBorderPx / zoom) + 'px';   // <-- One weight on screen at any zoom
        return node;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Take an Element Off the Paper
    // ------------------------------------------------------------
    function Na__LeSelBox__Detach(node) {
        if (node && node.parentNode) node.parentNode.removeChild(node);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Draw the Box Where the Drag Has Stretched It
    // ------------------------------------------------------------
    function Na__LeSelBox__DrawBox() {
        const state = Na__LeSelBox__State;
        const layer = Na__LeSurface__GetElements().handles;
        if (!state || !state.active || !layer) { Na__LeSelBox__Detach(Na__LeSelBox__BoxNode); return; }
        const box  = Na__LeSelBox__BoxOf(state.startMm, state.endMm);
        const mode = Na__LeSelBox__ModeFor(state.startMm, state.endMm);
        if (!Na__LeSelBox__BoxNode) Na__LeSelBox__BoxNode = document.createElement('div');
        Na__LeSelBox__Place(Na__LeSelBox__BoxNode, layer, box.minX, box.minY, box.maxX - box.minX, box.maxY - box.minY,
            Na__LeSelBox__BOX_CLASS + ' ' + Na__LeSelBox__BOX_CLASS + '--' + mode);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Outline What the Box Would Take, Once per Painted Frame
    // ------------------------------------------------------------
    // Booked onto the next animation frame, as the sheet surface books its
    // redraws: a mouse reports far more moves than the screen shows frames, and
    // the test runs over every item on the sheet. The outline nodes are kept and
    // reused, so a long drag does not churn the layer.
    // ------------------------------------------------------------
    function Na__LeSelBox__BookPreview() {
        if (Na__LeSelBox__Frame) return;
        Na__LeSelBox__Frame = window.requestAnimationFrame(() => {
            Na__LeSelBox__Frame = 0;
            Na__LeSelBox__DrawPreview();
        });
    }
    function Na__LeSelBox__DrawPreview() {
        const state = Na__LeSelBox__State;
        const layer = Na__LeSurface__GetElements().handles;
        const setup = Na__LeCfg__GetSelectionSetup();
        let shown = 0;
        if (state && state.active && layer && setup.boxPreview) {
            const box  = Na__LeSelBox__BoxOf(state.startMm, state.endMm);
            const mode = Na__LeSelBox__ModeFor(state.startMm, state.endMm);
            const pad  = setup.boxPreviewPadMm / (Na__LeSurface__GetZoom() || 1);
            (state.candidates || []).forEach((candidate) => {
                if (!Na__LeSelBox__Takes(box, candidate.parts, mode)) return;
                if (!Na__LeSelBox__PreviewNodes[shown]) Na__LeSelBox__PreviewNodes[shown] = document.createElement('div');
                const b = candidate.bounds;
                Na__LeSelBox__Place(Na__LeSelBox__PreviewNodes[shown], layer, b.X - pad, b.Y - pad, b.WidthMm + (pad * 2), b.HeightMm + (pad * 2),
                    Na__LeSelBox__PREVIEW_CLASS + ' ' + Na__LeSelBox__PREVIEW_CLASS + '--' + mode);
                shown++;
            });
        }
        for (let i = shown; i < Na__LeSelBox__PreviewNodes.length; i++) Na__LeSelBox__Detach(Na__LeSelBox__PreviewNodes[i]);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | A Left Press That May Become a Box
    // ------------------------------------------------------------
    // options: { combine, pending }
    //   combine   the modifier the press was made with: a COMBINE_ constant, or null
    //   pending   the { kind, id } under the press when it was something that
    //             cannot move; a release that never became a box selects it
    // Nothing shows until the pointer has travelled BoxStartPx on screen, so a
    // click stays a click.
    // ------------------------------------------------------------
    function Na__LeSelBox__Press(pointMm, clientX, clientY, pointerId, options) {
        Na__LeSelBox__Cancel();
        if (!pointMm) return false;
        const opts = options || {};
        Na__LeSelBox__State = {
            pointerId  : pointerId,
            startMm    : { x : pointMm.x, y : pointMm.y },
            endMm      : { x : pointMm.x, y : pointMm.y },
            startX     : clientX,
            startY     : clientY,
            active     : false,
            combine    : opts.combine || null,
            pending    : (opts.pending && opts.pending.kind && opts.pending.id) ? { kind : opts.pending.kind, id : opts.pending.id } : null,
            candidates : null
        };
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Pointer Moved: Stretch the Box
    // ------------------------------------------------------------
    // Returns true when the move belonged to a box, pending or drawn.
    // ------------------------------------------------------------
    function Na__LeSelBox__Move(sheet, pointMm, clientX, clientY, pointerId) {
        const state = Na__LeSelBox__State;
        if (!state || pointerId !== state.pointerId) return false;
        if (!pointMm) return true;
        state.endMm = { x : pointMm.x, y : pointMm.y };
        if (!state.active) {
            if (Math.hypot(clientX - state.startX, clientY - state.startY) < Na__LeCfg__GetSelectionSetup().boxStartPx) return true;
            state.active     = true;
            state.candidates = Na__LeSelBox__Candidates(sheet);
            document.body.classList.add(Na__LeSelBox__DRAGGING_CLASS);           // <-- No text selection swept up across the panels
        }
        Na__LeSelBox__DrawBox();
        Na__LeSelBox__BookPreview();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Button Came Up: Report What the Box Took
    // ------------------------------------------------------------
    // Returns null when no box was pressed with this pointer, else
    // { dragged, mode, items, combine, pending }. dragged false means the press
    // never became a box - it was a click - and items is empty.
    // ------------------------------------------------------------
    function Na__LeSelBox__Release(sheet, pointMm, pointerId) {
        const state = Na__LeSelBox__State;
        if (!state || pointerId !== state.pointerId) return null;
        if (pointMm) state.endMm = { x : pointMm.x, y : pointMm.y };
        const mode   = Na__LeSelBox__ModeFor(state.startMm, state.endMm);
        const result = {
            dragged : state.active,
            mode    : mode,
            items   : state.active ? Na__LeSelBox__ItemsIn(sheet, state.startMm, state.endMm, mode) : [],
            combine : state.combine,
            pending : state.pending
        };
        Na__LeSelBox__Cancel();
        return result;
    }
    // ------------------------------------------------------------


    // FUNCTION | Abandon the Box
    // ------------------------------------------------------------
    function Na__LeSelBox__Cancel() {
        const state = Na__LeSelBox__State;
        Na__LeSelBox__State = null;
        if (Na__LeSelBox__Frame) window.cancelAnimationFrame(Na__LeSelBox__Frame);
        Na__LeSelBox__Frame = 0;
        Na__LeSelBox__Detach(Na__LeSelBox__BoxNode);
        Na__LeSelBox__PreviewNodes.forEach((node) => Na__LeSelBox__Detach(node));
        if (state && state.active) document.body.classList.remove(Na__LeSelBox__DRAGGING_CLASS);
        return !!state;
    }
    // ------------------------------------------------------------


    // FUNCTION | Redraw the Box After a Zoom or a Model Change
    // ------------------------------------------------------------
    function Na__LeSelBox__Refresh(sheet) {
        const state = Na__LeSelBox__State;
        if (!state || !state.active) return false;
        state.candidates = Na__LeSelBox__Candidates(sheet);
        Na__LeSelBox__DrawBox();
        Na__LeSelBox__BookPreview();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | State
    // ------------------------------------------------------------
    function Na__LeSelBox__IsActive()   { return !!Na__LeSelBox__State; }                                   // <-- A press is held that may become a box
    function Na__LeSelBox__IsDragging() { return !!(Na__LeSelBox__State && Na__LeSelBox__State.active); }   // <-- The box is on the paper
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Selection Box API
    // ------------------------------------------------------------
    export {
        Na__LeSelBox__MODE_WINDOW,
        Na__LeSelBox__MODE_CROSSING,
        Na__LeSelBox__COMBINE_ADD,
        Na__LeSelBox__COMBINE_TOGGLE,
        Na__LeSelBox__COMBINE_REMOVE,
        Na__LeSelBox__Press,
        Na__LeSelBox__Move,
        Na__LeSelBox__Release,
        Na__LeSelBox__Cancel,
        Na__LeSelBox__Refresh,
        Na__LeSelBox__IsActive,
        Na__LeSelBox__IsDragging,
        Na__LeSelBox__ModeFor,
        Na__LeSelBox__ItemsIn,
        Na__LeSelBox__Combine
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
