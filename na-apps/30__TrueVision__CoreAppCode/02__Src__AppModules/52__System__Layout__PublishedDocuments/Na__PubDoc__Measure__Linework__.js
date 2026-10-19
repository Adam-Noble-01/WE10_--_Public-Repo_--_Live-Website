// =============================================================================
// TRUEVISION3D - PUBLISHED DOCUMENTS - MEASURE - LINEWORK
// =============================================================================
//
// FILE       : Na__PubDoc__Measure__Linework__.js
// NAMESPACE  : Na__PubMsLw
// MODULE     : Published Documents - Measure - Linework
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Read one viewport's published linework into exact straight segments on the sheet, joined where the projection cut a straight line into pieces, and indexed so a snap is found in microseconds
// SCHEMA REF : na-project-portal/26-Projects/AA00__ExampleProjectStructure/
//              30__TrueVision__AppContent/06__Layout__PublishedDocuments
// CREATED    : 19-Oct-2026
//
// DESCRIPTION:
// - WHAT ADAM ASKED FOR: "rather than relying on the screen space pixels, we
//   need to create a really robust vector measuring tool." PlanVision measured
//   pixels on a picture against a calibrated scale. A published TrueVision
//   drawing carries its linework as VECTORS - one SVG per viewport, in paper
//   millimetres inside the viewport's own frame (02__Viewports__Vector) - so a
//   point can be put on the actual end of the actual line, and a length read
//   from the drawing's own scale is the model's length.
// - WHAT THE FILE IS: a handful of <path> elements, each one long run of
//   "Mx,yLx,y" pairs (1,786 on JW02's D01 elevation, 41,206 on the example
//   plan). Every published file so far uses M and L only; Z, the curve
//   commands, <g> styling groups and transforms are read as well, so a future
//   publisher that writes them is still measured right.
// - CLIPPED TO THE FRAME. The reader draws the linework inside the viewport's
//   clip, and the file runs past it (JW02's ground line starts 19.9 mm left of
//   its frame). A line that is not drawn must not be snapped to, so every
//   segment is cut to the frame; the end a cut makes is not an endpoint.
// - JOINED WHERE THE PROJECTION CUT A STRAIGHT LINE. The projection splits a
//   wall wherever another edge crosses it, so one straight face can arrive as
//   twenty pieces. Snapping to all of their ends would put a "corner" every
//   few millimetres along a plain wall, and a midpoint snap would find the
//   middle of a piece rather than of the wall. Pieces that meet end to end,
//   in the same class, with nothing else touching the joint and turning less
//   than a quarter of a degree, become one segment. The quarter degree is
//   held against the FIRST piece of the run, so a gently tessellated curve is
//   never straightened into its chord.
// - ON THE SHEET. Segments are stored in sheet millimetres, turned with the
//   viewport (Viewport__RotationDeg, about the middle of its frame, exactly as
//   the reader paints it), so a measurement can be read anywhere on the sheet
//   and every viewport shares one space.
// - INDEXED. A uniform grid over the frame, each segment entered in exactly
//   the cells its line passes through (a voxel walk, not its bounding box, so
//   a long diagonal does not fill the whole grid). A query touches a few
//   cells and a few dozen segments however big the drawing is.
// - ONLY DRAWN LINES. A shape is read only when it has a visible stroke, so
//   a solid fill with no line round it (and the sheet has many invisible
//   ones) can never be snapped to. See ParseSvg.
// - ONLY THIS FILE. The pictures under the linework (the drawing's raster
//   tiers, a point cloud's second picture) and everything else on the sheet
//   (areas, hatches, text, symbols) are never read: a point snaps to the
//   drawing's own lines and nothing else.
// - PURE. No DOM, no fetch, no imports: the published reader fetches the file
//   and hands its text in. Testable in Node byte for byte as it ships.
//
// INTEGRATION:
// - Na__PubDoc__Measure__ builds one layer per 2D viewport with Build.
// - Na__PubDoc__Measure__Snap__ asks Near for the segments around a point.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Oct-2026 - Version 1.1.0
// - Only a shape with a visible stroke is read: its own, its group's or its
//   style="", not none or transparent, wider than nothing, with some opacity,
//   not hidden, and not inside defs, a clip path, a mask, a symbol or a
//   marker. A fill alone was never meant to snap, and a shape that said
//   nothing about its stroke (SVG draws no stroke then) used to count
//   (TrueVision3D v2.182.0).
//
// 19-Oct-2026 - Version 1.0.0
// - Initial implementation (TrueVision3D v2.180.0, the web viewer's measuring
//   tools).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Tolerances
    // ------------------------------------------------------------
    // Published coordinates carry three decimals, so a thousandth of a
    // millimetre IS the same point; the join test compares rounded keys.
    // ------------------------------------------------------------
    const Na__PubMsLw__KEY_PER_MM      = 1000;                                   // <-- Joint key resolution: one micron
    const Na__PubMsLw__TURN_SIN        = Math.sin(0.25 * Math.PI / 180);        // <-- Pieces turning less than a quarter degree are one straight line
    const Na__PubMsLw__MIN_LENGTH_MM   = 1e-6;                                   // <-- Shorter than this is a dot, not a line
    const Na__PubMsLw__CURVE_STEPS     = 16;                                     // <-- Pieces per curve, should a curve ever be published
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Grid
    // ------------------------------------------------------------
    const Na__PubMsLw__PER_CELL        = 4;                                      // <-- Segments per cell the grid is sized for, on average
    const Na__PubMsLw__MIN_CELL_MM     = 0.5;
    const Na__PubMsLw__MAX_CELL_MM     = 100;
    const Na__PubMsLw__MAX_CELLS       = 262144;                                 // <-- 512 x 512: a few hundred kilobytes of index at most
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Line Classes, as data-na-class Names Them
    // ------------------------------------------------------------
    // Kept so two pieces of different kinds are never joined (a visible edge
    // running into a hidden one is two lines), and so a later version could
    // leave one kind out of snapping.
    // ------------------------------------------------------------
    const Na__PubMsLw__CLASSES = Object.freeze({ other : 0, visible : 1, section : 2, authored : 3, hidden : 4 });
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Flags per Segment
    // ------------------------------------------------------------
    const Na__PubMsLw__REAL_A = 1;                                               // <-- Its first end is a real end of a line (not a cut, not inside a curve)
    const Na__PubMsLw__REAL_B = 2;                                               // <-- ...and its second
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Path Data Tokens
    // ------------------------------------------------------------
    const Na__PubMsLw__TOKEN    = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?|[A-Za-z]/g;     // <-- ANY letter is a token, so one the reader does not know stops the walk, as a browser stops drawing
    const Na__PubMsLw__IDENTITY = Object.freeze([ 1, 0, 0, 1, 0, 0 ]);         // <-- [a, b, c, d, e, f]: x' = a x + c y + e, y' = b x + d y + f
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Which Elements Are Read, and What a File Starts From
    // ------------------------------------------------------------
    // SHAPES are the elements whose outline can be a line. UNDRAWN are the
    // elements whose contents are only drawn where something else uses them
    // (a clip path, a mask, a symbol, a marker), or never (defs, a style
    // sheet, a title): none of their lines are lines of the drawing. Names are
    // lower case, as the reader compares them. ROOT_STYLE is SVG's own
    // starting point: no stroke, one unit wide, fully opaque, visible.
    // ------------------------------------------------------------
    const Na__PubMsLw__SHAPES = Object.freeze({ path : true, line : true, polyline : true, polygon : true, rect : true });
    const Na__PubMsLw__UNDRAWN = Object.freeze({
        defs : true, clippath : true, mask : true, symbol : true, marker : true, pattern : true,
        lineargradient : true, radialgradient : true, filter : true, style : true, script : true,
        title : true, desc : true, metadata : true
    });
    const Na__PubMsLw__ROOT_STYLE = Object.freeze({
        Name : '#document', Class : null, Matrix : Na__PubMsLw__IDENTITY, Stroke : 'none', Width : 1,
        StrokeOpacity : 1, Opacity : 1, Visibility : 'visible', Undrawn : false
    });
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Transforms
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Multiply Two Affine Matrices (m applied after n)
    // ------------------------------------------------------------
    function Na__PubMsLw__Multiply(m, n) {
        return [
            m[0] * n[0] + m[2] * n[1],
            m[1] * n[0] + m[3] * n[1],
            m[0] * n[2] + m[2] * n[3],
            m[1] * n[2] + m[3] * n[3],
            m[0] * n[4] + m[2] * n[5] + m[4],
            m[1] * n[4] + m[3] * n[5] + m[5]
        ];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read an SVG transform Attribute Into One Matrix
    // ------------------------------------------------------------
    // translate, scale, rotate (with or without a centre), skewX, skewY and
    // matrix, in the order written - the order SVG applies them. Anything it
    // cannot read leaves the identity, which is what the published files carry.
    // ------------------------------------------------------------
    function Na__PubMsLw__ParseTransform(text) {
        if (!text) return Na__PubMsLw__IDENTITY;
        let out = Na__PubMsLw__IDENTITY;
        const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
        let match;
        while ((match = re.exec(text)) !== null) {
            const v = (match[2].match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || []).map(Number);
            let m = Na__PubMsLw__IDENTITY;
            switch (match[1]) {
                case 'matrix'    : if (v.length >= 6) m = v.slice(0, 6); break;
                case 'translate' : m = [ 1, 0, 0, 1, v[0] || 0, v[1] || 0 ]; break;
                case 'scale'     : m = [ v[0] || 1, 0, 0, (v.length > 1 ? v[1] : v[0]) || 1, 0, 0 ]; break;
                case 'skewX'     : m = [ 1, 0, Math.tan((v[0] || 0) * Math.PI / 180), 1, 0, 0 ]; break;
                case 'skewY'     : m = [ 1, Math.tan((v[0] || 0) * Math.PI / 180), 0, 1, 0, 0 ]; break;
                case 'rotate'    : {
                    const a = (v[0] || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
                    const cx = v[1] || 0, cy = v[2] || 0;
                    m = [ c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy ];
                    break;
                }
                default : break;
            }
            out = Na__PubMsLw__Multiply(out, m);
        }
        return out;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Path Data
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Point on a Cubic Bezier
    // ------------------------------------------------------------
    function Na__PubMsLw__Cubic(t, p0, p1, p2, p3) {
        const u = 1 - t;
        return (u * u * u * p0) + (3 * u * u * t * p1) + (3 * u * t * t * p2) + (t * t * t * p3);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | An SVG Arc as Points (endpoint to centre parameterisation, SVG 1.1 F.6.5)
    // ------------------------------------------------------------
    function Na__PubMsLw__ArcPoints(x1, y1, rx, ry, angleDeg, large, sweep, x2, y2) {
        if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) return [ [ x2, y2 ] ];
        rx = Math.abs(rx); ry = Math.abs(ry);
        const phi = angleDeg * Math.PI / 180, cosP = Math.cos(phi), sinP = Math.sin(phi);
        const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
        const x1p = cosP * dx + sinP * dy, y1p = -sinP * dx + cosP * dy;
        const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
        if (lambda > 1) { const k = Math.sqrt(lambda); rx *= k; ry *= k; }
        const num = (rx * rx * ry * ry) - (rx * rx * y1p * y1p) - (ry * ry * x1p * x1p);
        const den = (rx * rx * y1p * y1p) + (ry * ry * x1p * x1p);
        let co = den === 0 ? 0 : Math.sqrt(Math.max(0, num / den));
        if (large === sweep) co = -co;
        const cxp = co * (rx * y1p / ry), cyp = co * (-ry * x1p / rx);
        const cx = cosP * cxp - sinP * cyp + (x1 + x2) / 2;
        const cy = sinP * cxp + cosP * cyp + (y1 + y2) / 2;
        const angle = (ux, uy, vx, vy) => {
            const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
            return a;
        };
        const t1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
        let dt = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
        if (!sweep && dt > 0) dt -= 2 * Math.PI;
        if (sweep && dt < 0) dt += 2 * Math.PI;
        const steps = Math.max(2, Math.ceil(Math.abs(dt) / (Math.PI / 16)));
        const points = [];
        for (let i = 1; i <= steps; i++) {
            const t = t1 + dt * (i / steps);
            const ct = Math.cos(t), st = Math.sin(t);
            points.push([ cosP * rx * ct - sinP * ry * st + cx, sinP * rx * ct + cosP * ry * st + cy ]);
        }
        points[points.length - 1] = [ x2, y2 ];
        return points;
    }
    // ------------------------------------------------------------


    // FUNCTION | Walk One Path's Data, Handing Every Straight Segment to emit
    // ------------------------------------------------------------
    // emit(x1, y1, x2, y2, realA, realB), in the path's own units after the
    // matrix. A line's ends are real ends; a curve is cut into short pieces
    // whose joints are NOT ends (a snap must not find a corner inside an arc),
    // only the curve's own two ends are. Returns how many segments it emitted.
    // ------------------------------------------------------------
    function Na__PubMsLw__ParsePathData(d, matrix, emit) {
        if (typeof d !== 'string' || d === '') return 0;
        const m = matrix || Na__PubMsLw__IDENTITY;
        const tokens = d.match(Na__PubMsLw__TOKEN) || [];
        let count = 0;
        let i = 0, cmd = null;
        let cx = 0, cy = 0, sx = 0, sy = 0;                                     // <-- The pen, and where the subpath began
        let ctrlX = null, ctrlY = null, ctrlKind = null;                         // <-- The last control point, for S and T

        const out = (ax, ay, bx, by, realA, realB) => {
            const x1 = m[0] * ax + m[2] * ay + m[4], y1 = m[1] * ax + m[3] * ay + m[5];
            const x2 = m[0] * bx + m[2] * by + m[4], y2 = m[1] * bx + m[3] * by + m[5];
            if (Math.abs(x2 - x1) < Na__PubMsLw__MIN_LENGTH_MM && Math.abs(y2 - y1) < Na__PubMsLw__MIN_LENGTH_MM) return;
            emit(x1, y1, x2, y2, realA, realB);
            count += 1;
        };
        const polyline = (points) => {                                            // <-- A curve's pieces: only its own two ends are ends
            let px = cx, py = cy;
            for (let k = 0; k < points.length; k++) {
                out(px, py, points[k][0], points[k][1], k === 0, k === points.length - 1);
                px = points[k][0]; py = points[k][1];
            }
        };
        const isCommand = (token) => /^[A-Za-z]$/.test(token);
        const num = () => {
            const token = tokens[i];
            if (token === undefined || isCommand(token)) return NaN;
            i += 1;
            return Number(token);
        };

        while (i < tokens.length) {
            if (isCommand(tokens[i])) { cmd = tokens[i]; i += 1; }
            else if (cmd === null) break;                                         // <-- Numbers before any command: not path data
            const rel = (cmd === cmd.toLowerCase());
            const up  = cmd.toUpperCase();

            if (up === 'Z') {
                out(cx, cy, sx, sy, true, true);
                cx = sx; cy = sy; ctrlKind = null;
                continue;                                                         // <-- Z takes no numbers; the next token is a command
            }

            if (up === 'M') {
                let x = num(), y = num();
                if (!Number.isFinite(x) || !Number.isFinite(y)) break;
                if (rel) { x += cx; y += cy; }
                cx = sx = x; cy = sy = y; ctrlKind = null;
                cmd = rel ? 'l' : 'L';                                            // <-- Further pairs after a moveto are lines
                continue;
            }
            if (up === 'L') {
                let x = num(), y = num();
                if (!Number.isFinite(x) || !Number.isFinite(y)) break;
                if (rel) { x += cx; y += cy; }
                out(cx, cy, x, y, true, true);
                cx = x; cy = y; ctrlKind = null;
                continue;
            }
            if (up === 'H') {
                let x = num();
                if (!Number.isFinite(x)) break;
                if (rel) x += cx;
                out(cx, cy, x, cy, true, true);
                cx = x; ctrlKind = null;
                continue;
            }
            if (up === 'V') {
                let y = num();
                if (!Number.isFinite(y)) break;
                if (rel) y += cy;
                out(cx, cy, cx, y, true, true);
                cy = y; ctrlKind = null;
                continue;
            }
            if (up === 'C' || up === 'S') {
                let x1, y1;
                if (up === 'C') { x1 = num(); y1 = num(); if (rel) { x1 += cx; y1 += cy; } }
                else {
                    x1 = (ctrlKind === 'C') ? (2 * cx - ctrlX) : cx;
                    y1 = (ctrlKind === 'C') ? (2 * cy - ctrlY) : cy;
                }
                let x2 = num(), y2 = num(), x = num(), y = num();
                if (![ x1, y1, x2, y2, x, y ].every(Number.isFinite)) break;
                if (rel) { x2 += cx; y2 += cy; x += cx; y += cy; }
                const points = [];
                for (let k = 1; k <= Na__PubMsLw__CURVE_STEPS; k++) {
                    const t = k / Na__PubMsLw__CURVE_STEPS;
                    points.push([ Na__PubMsLw__Cubic(t, cx, x1, x2, x), Na__PubMsLw__Cubic(t, cy, y1, y2, y) ]);
                }
                polyline(points);
                cx = x; cy = y; ctrlX = x2; ctrlY = y2; ctrlKind = 'C';
                continue;
            }
            if (up === 'Q' || up === 'T') {
                let qx, qy;
                if (up === 'Q') { qx = num(); qy = num(); if (rel) { qx += cx; qy += cy; } }
                else {
                    qx = (ctrlKind === 'Q') ? (2 * cx - ctrlX) : cx;
                    qy = (ctrlKind === 'Q') ? (2 * cy - ctrlY) : cy;
                }
                let x = num(), y = num();
                if (![ qx, qy, x, y ].every(Number.isFinite)) break;
                if (rel) { x += cx; y += cy; }
                const points = [];
                for (let k = 1; k <= Na__PubMsLw__CURVE_STEPS; k++) {
                    const t = k / Na__PubMsLw__CURVE_STEPS, u = 1 - t;
                    points.push([ u * u * cx + 2 * u * t * qx + t * t * x, u * u * cy + 2 * u * t * qy + t * t * y ]);
                }
                polyline(points);
                cx = x; cy = y; ctrlX = qx; ctrlY = qy; ctrlKind = 'Q';
                continue;
            }
            if (up === 'A') {
                const rx = num(), ry = num(), rot = num(), large = num(), sweep = num();
                let x = num(), y = num();
                if (![ rx, ry, rot, large, sweep, x, y ].every(Number.isFinite)) break;
                if (rel) { x += cx; y += cy; }
                polyline(Na__PubMsLw__ArcPoints(cx, cy, rx, ry, rot, large !== 0, sweep !== 0, x, y));
                cx = x; cy = y; ctrlKind = null;
                continue;
            }
            break;                                                                // <-- A letter this reader does not know: stop rather than guess
        }
        return count;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The SVG File
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One Attribute's Value From a Tag's Attribute Text (null when absent)
    // ------------------------------------------------------------
    function Na__PubMsLw__Attr(attributes, name) {
        const re = new RegExp('(?:^|\\s)' + name.replace(/[-:]/g, '\\$&') + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')');
        const match = re.exec(attributes || '');
        if (!match) return null;
        return match[1] !== undefined ? match[1] : match[2];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A line, polyline, polygon or rect Element as Path Data
    // ------------------------------------------------------------
    function Na__PubMsLw__ShapeAsPath(name, attributes) {
        const n = (key) => Number(Na__PubMsLw__Attr(attributes, key)) || 0;
        if (name === 'line') return 'M' + n('x1') + ',' + n('y1') + 'L' + n('x2') + ',' + n('y2');
        if (name === 'rect') {
            const x = n('x'), y = n('y'), w = n('width'), h = n('height');
            return (w > 0 && h > 0) ? ('M' + x + ',' + y + 'H' + (x + w) + 'V' + (y + h) + 'H' + x + 'Z') : '';
        }
        const points = (Na__PubMsLw__Attr(attributes, 'points') || '').trim();
        if (!points) return '';
        return 'M' + points + (name === 'polygon' ? 'Z' : '');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A style="" Attribute's Declarations, Keyed by Property
    // ------------------------------------------------------------
    function Na__PubMsLw__StyleDecl(text) {
        const out = {};
        if (!text) return out;
        String(text).split(';').forEach((part) => {
            const at = part.indexOf(':');
            if (at === -1) return;
            const key = part.slice(0, at).trim().toLowerCase();
            if (key) out[key] = part.slice(at + 1).replace(/!\s*important/i, '').trim();
        });
        return out;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Number, or a Percentage as a Fraction, Held to 0..1 (fallback when unreadable)
    // ------------------------------------------------------------
    function Na__PubMsLw__Fraction(value, fallback) {
        if (value === null || value === undefined) return fallback;
        const text = String(value).trim();
        const n = parseFloat(text);
        if (!Number.isFinite(n)) return fallback;
        return Math.max(0, Math.min(1, text.endsWith('%') ? n / 100 : n));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Does a Stroke Value Paint Anything (none, transparent and a colour with no alpha do not)
    // ------------------------------------------------------------
    function Na__PubMsLw__IsPaint(value) {
        const v = String(value === null || value === undefined ? 'none' : value).trim().toLowerCase();
        if (v === '' || v === 'none' || v === 'transparent') return false;
        const hex = /^#([0-9a-f]{4}|[0-9a-f]{8})$/.exec(v);
        if (hex) return parseInt(hex[1].length === 4 ? hex[1].slice(3) : hex[1].slice(6), 16) > 0;
        const fn = /^(?:rgba?|hsla?)\(([^)]*)\)$/.exec(v);
        if (fn) {
            const parts = fn[1].split(/[\s,/]+/).filter(Boolean);
            if (parts.length >= 4) return Na__PubMsLw__Fraction(parts[3], 1) > 0;
        }
        return true;                                                             // <-- A colour, currentColor or a paint server: drawn
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | An Element's Style: What It Says (style="" before its attributes) Over What It Inherits
    // ------------------------------------------------------------
    // stroke, stroke-width, stroke-opacity and visibility are inherited, as SVG
    // inherits them; opacity multiplies down the tree; display none, and the
    // inside of an element that is never drawn where it stands, hide
    // everything below.
    // ------------------------------------------------------------
    function Na__PubMsLw__Style(name, attributes, parent) {
        const decl = Na__PubMsLw__StyleDecl(Na__PubMsLw__Attr(attributes, 'style'));
        const own = (key) => {
            const value = (decl[key] !== undefined) ? decl[key] : Na__PubMsLw__Attr(attributes, key);
            if (value === null || value === undefined) return null;
            const text = String(value).trim();
            return (text === '' || text.toLowerCase() === 'inherit') ? null : text;
        };
        const stroke = own('stroke'), width = own('stroke-width'), strokeOpacity = own('stroke-opacity');
        const visibility = own('visibility'), display = own('display');
        const widthMm = width === null ? NaN : parseFloat(width);
        return {
            Name          : name,
            Class         : Na__PubMsLw__Attr(attributes, 'data-na-class') || parent.Class,
            Matrix        : Na__PubMsLw__Multiply(parent.Matrix, Na__PubMsLw__ParseTransform(Na__PubMsLw__Attr(attributes, 'transform'))),
            Stroke        : stroke !== null ? stroke : parent.Stroke,
            Width         : Number.isFinite(widthMm) ? widthMm : parent.Width,
            StrokeOpacity : strokeOpacity !== null ? Na__PubMsLw__Fraction(strokeOpacity, 1) : parent.StrokeOpacity,
            Opacity       : parent.Opacity * Na__PubMsLw__Fraction(own('opacity'), 1),
            Visibility    : visibility !== null ? visibility.toLowerCase() : parent.Visibility,
            Undrawn       : parent.Undrawn || Na__PubMsLw__UNDRAWN[name] === true || (display !== null && display.toLowerCase() === 'none')
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Does a Shape With This Style Draw a Line Anyone Can See
    // ------------------------------------------------------------
    function Na__PubMsLw__Drawn(style) {
        if (style.Undrawn) return false;
        if (style.Visibility === 'hidden' || style.Visibility === 'collapse') return false;
        if (!(style.Opacity > 0) || !(style.StrokeOpacity > 0) || !(style.Width > 0)) return false;
        return Na__PubMsLw__IsPaint(style.Stroke);
    }
    // ------------------------------------------------------------


    // FUNCTION | Read a Published Linework SVG: Its viewBox and Every Drawn Line
    // ------------------------------------------------------------
    // Returns { ViewBox : [minX, minY, width, height] | null, Paths : [ { Class,
    // D, Matrix } ] }. Comments go first (the example files explain themselves
    // in one, and a comment can hold anything). Every element passes its
    // class, its transform and its style down, as the example files' styling
    // groups do.
    //
    // ONLY A LINE THAT IS DRAWN COUNTS (Adam, 19-Oct-2026: snap "only ... on
    // the line work ... If a solid fill doesn't have any lines as well, make it
    // undetectable"). A shape counts when it has a visible stroke: a stroke
    // that paints (not none, not transparent), wider than nothing, with some
    // opacity, not hidden, and not inside defs, a clip path, a mask, a symbol
    // or a marker. A fill alone is never a line, however solid; SVG's own
    // default stroke is none, so a shape that says nothing about its stroke
    // is not one either. The published files write every line's stroke on the
    // line itself, and the example files on its group; a <style> sheet is not
    // read.
    // ------------------------------------------------------------
    function Na__PubMsLw__ParseSvg(text) {
        const clean = String(text || '').replace(/<!--[\s\S]*?-->/g, '').replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
        const result = { ViewBox : null, Paths : [] };
        const stack = [ Na__PubMsLw__ROOT_STYLE ];
        const tagRe = /<(\/?)([A-Za-z][\w:-]*)([^>]*)>/g;
        let match;
        while ((match = tagRe.exec(clean)) !== null) {
            const closing    = match[1] === '/';
            const name       = match[2].toLowerCase();
            const attributes = match[3] || '';
            const selfClosed = /\/\s*$/.test(attributes);

            if (closing) {                                                        // <-- Back to the element it closes (a stray closing tag closes nothing)
                for (let i = stack.length - 1; i >= 1; i--) {
                    if (stack[i].Name === name) { stack.length = i; break; }
                }
                continue;
            }
            if (name === 'svg' && !result.ViewBox) {
                const box = (Na__PubMsLw__Attr(attributes, 'viewBox') || '').trim().split(/[\s,]+/).map(Number);
                if (box.length === 4 && box.every(Number.isFinite) && box[2] > 0 && box[3] > 0) result.ViewBox = box;
            }
            const style = Na__PubMsLw__Style(name, attributes, stack[stack.length - 1]);
            if (!selfClosed) stack.push(style);
            if (!Na__PubMsLw__SHAPES[name] || !Na__PubMsLw__Drawn(style)) continue;
            const d = (name === 'path') ? Na__PubMsLw__Attr(attributes, 'd') : Na__PubMsLw__ShapeAsPath(name, attributes);
            if (!d) continue;
            result.Paths.push({ Class : style.Class, D : d, Matrix : style.Matrix });
        }
        return result;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Clipping and Joining
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Cut a Segment to a Rectangle (Liang-Barsky)
    // ------------------------------------------------------------
    // Returns [t0, t1] along the segment, or null when none of it is inside.
    // ------------------------------------------------------------
    function Na__PubMsLw__Clip(x1, y1, x2, y2, minX, minY, maxX, maxY) {
        const dx = x2 - x1, dy = y2 - y1;
        let t0 = 0, t1 = 1;
        const p = [ -dx, dx, -dy, dy ];
        const q = [ x1 - minX, maxX - x1, y1 - minY, maxY - y1 ];
        for (let k = 0; k < 4; k++) {
            if (p[k] === 0) { if (q[k] < 0) return null; continue; }
            const r = q[k] / p[k];
            if (p[k] < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
            else          { if (r < t0) return null; if (r < t1) t1 = r; }
        }
        return (t1 - t0 > 0) ? [ t0, t1 ] : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Joint's Key: the Point Rounded to a Micron
    // ------------------------------------------------------------
    function Na__PubMsLw__Key(x, y) {
        return Math.round(x * Na__PubMsLw__KEY_PER_MM) + ',' + Math.round(y * Na__PubMsLw__KEY_PER_MM);
    }
    // ------------------------------------------------------------


    // FUNCTION | Join Pieces of One Straight Line Into One Segment
    // ------------------------------------------------------------
    // segs: { X1, Y1, X2, Y2, Flags, Cls } as plain arrays of equal length.
    // Two pieces join at a joint where exactly those two real ends meet, in the
    // same class, running on in the same direction (outward directions
    // opposite) within a quarter of a degree. A run is then walked end to end;
    // each piece is held against the run's FIRST direction, so slow turns
    // cannot accumulate into a straightened curve - where one would, the run
    // stops and the next one starts at the same joint, and both keep a real
    // end there. Returns the joined set in the same shape.
    // ------------------------------------------------------------
    function Na__PubMsLw__Join(segs) {
        const n = segs.X1.length;
        const joints = new Map();
        const endKey = (s, end) => end === 0 ? Na__PubMsLw__Key(segs.X1[s], segs.Y1[s]) : Na__PubMsLw__Key(segs.X2[s], segs.Y2[s]);
        for (let s = 0; s < n; s++) {
            for (let end = 0; end < 2; end++) {
                if (!(segs.Flags[s] & (end === 0 ? Na__PubMsLw__REAL_A : Na__PubMsLw__REAL_B))) continue;
                const key = endKey(s, end);
                const list = joints.get(key);
                if (list) list.push((s << 1) | end); else joints.set(key, [ (s << 1) | end ]);
            }
        }
        // Every end that a CUT made (clipped, or inside a curve) also blocks a
        // joint there: something else is touching that point.
        for (let s = 0; s < n; s++) {
            for (let end = 0; end < 2; end++) {
                if (segs.Flags[s] & (end === 0 ? Na__PubMsLw__REAL_A : Na__PubMsLw__REAL_B)) continue;
                const list = joints.get(endKey(s, end));
                if (list) list.push(-1);
            }
        }

        const outward = (s, end) => {                                             // <-- Unit direction leaving the joint along segment s
            const ax = end === 0 ? segs.X1[s] : segs.X2[s], ay = end === 0 ? segs.Y1[s] : segs.Y2[s];
            const bx = end === 0 ? segs.X2[s] : segs.X1[s], by = end === 0 ? segs.Y2[s] : segs.Y1[s];
            const len = Math.hypot(bx - ax, by - ay) || 1;
            return [ (bx - ax) / len, (by - ay) / len ];
        };

        const link = new Int32Array(n * 2).fill(-1);
        for (const list of joints.values()) {
            if (list.length !== 2 || list[0] < 0 || list[1] < 0) continue;
            const p = list[0], q = list[1];
            const sp = p >> 1, sq = q >> 1;
            if (sp === sq || segs.Cls[sp] !== segs.Cls[sq]) continue;
            const u = outward(sp, p & 1), v = outward(sq, q & 1);
            const cross = u[0] * v[1] - u[1] * v[0], dot = u[0] * v[0] + u[1] * v[1];
            if (dot < 0 && Math.abs(cross) <= Na__PubMsLw__TURN_SIN) { link[p] = q; link[q] = p; }
        }

        const out = { X1 : [], Y1 : [], X2 : [], Y2 : [], Flags : [], Cls : [] };
        const visited = new Uint8Array(n);
        const point = (s, end) => end === 0 ? [ segs.X1[s], segs.Y1[s] ] : [ segs.X2[s], segs.Y2[s] ];
        const realAt = (s, end) => !!(segs.Flags[s] & (end === 0 ? Na__PubMsLw__REAL_A : Na__PubMsLw__REAL_B));
        const push = (a, aReal, b, bReal, cls) => {
            out.X1.push(a[0]); out.Y1.push(a[1]); out.X2.push(b[0]); out.Y2.push(b[1]);
            out.Flags.push((aReal ? Na__PubMsLw__REAL_A : 0) | (bReal ? Na__PubMsLw__REAL_B : 0));
            out.Cls.push(cls);
        };

        // Walk a run from segment s, entered at its end `entry`.
        const walk = (s, entry) => {
            let start = point(s, entry), startReal = realAt(s, entry);
            let first = outward(s, entry);
            let current = s, enter = entry;
            for (;;) {
                visited[current] = 1;
                const leave = 1 - enter;
                const next = link[(current << 1) | leave];
                if (next === -1 || visited[next >> 1]) {
                    push(start, startReal, point(current, leave), realAt(current, leave), segs.Cls[s]);
                    return;
                }
                const nextSeg = next >> 1, nextEnter = next & 1;
                const dir = outward(nextSeg, nextEnter);
                if (Math.abs(first[0] * dir[1] - first[1] * dir[0]) > Na__PubMsLw__TURN_SIN) {
                    // TURNED TOO FAR FROM WHERE THE RUN BEGAN: close this run at
                    // the joint and start the next one there.
                    push(start, startReal, point(current, leave), true, segs.Cls[s]);
                    start = point(nextSeg, nextEnter); startReal = true; first = dir;
                }
                current = nextSeg; enter = nextEnter;
            }
        };

        for (let s = 0; s < n; s++) {                                            // <-- Runs start at a piece with a free end
            if (visited[s]) continue;
            if (link[(s << 1) | 0] === -1) walk(s, 0);
            else if (link[(s << 1) | 1] === -1) walk(s, 1);
        }
        for (let s = 0; s < n; s++) {                                            // <-- Anything left (cannot happen for straight pieces) stands alone
            if (!visited[s]) { visited[s] = 1; push(point(s, 0), realAt(s, 0), point(s, 1), realAt(s, 1), segs.Cls[s]); }
        }
        return out;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Grid
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Visit Every Grid Cell a Segment Passes Through (Amanatides and Woo)
    // ------------------------------------------------------------
    function Na__PubMsLw__Walk(grid, x1, y1, x2, y2, visit) {
        const gx1 = (x1 - grid.MinX) / grid.Cell, gy1 = (y1 - grid.MinY) / grid.Cell;
        const gx2 = (x2 - grid.MinX) / grid.Cell, gy2 = (y2 - grid.MinY) / grid.Cell;
        const clampX = (v) => Math.max(0, Math.min(grid.Cols - 1, v));
        const clampY = (v) => Math.max(0, Math.min(grid.Rows - 1, v));
        let ix = clampX(Math.floor(gx1)), iy = clampY(Math.floor(gy1));
        const jx = clampX(Math.floor(gx2)), jy = clampY(Math.floor(gy2));
        const dx = gx2 - gx1, dy = gy2 - gy1;
        const stepX = dx > 0 ? 1 : (dx < 0 ? -1 : 0), stepY = dy > 0 ? 1 : (dy < 0 ? -1 : 0);
        let tMaxX = stepX === 0 ? Infinity : ((stepX > 0 ? (Math.floor(gx1) + 1 - gx1) : (gx1 - Math.floor(gx1))) / Math.abs(dx));
        let tMaxY = stepY === 0 ? Infinity : ((stepY > 0 ? (Math.floor(gy1) + 1 - gy1) : (gy1 - Math.floor(gy1))) / Math.abs(dy));
        const tDeltaX = stepX === 0 ? Infinity : 1 / Math.abs(dx);
        const tDeltaY = stepY === 0 ? Infinity : 1 / Math.abs(dy);
        visit(iy * grid.Cols + ix);
        let guard = Math.abs(jx - ix) + Math.abs(jy - iy);
        while (guard-- > 0) {
            if (tMaxX < tMaxY) { ix = clampX(ix + stepX); tMaxX += tDeltaX; }
            else               { iy = clampY(iy + stepY); tMaxY += tDeltaY; }
            visit(iy * grid.Cols + ix);
            if (ix === jx && iy === jy) break;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Size and Fill the Grid (compressed rows: Start and Items)
    // ------------------------------------------------------------
    function Na__PubMsLw__BuildGrid(layer, minX, minY, maxX, maxY) {
        const n = layer.Count;
        const width  = Math.max(maxX - minX, 1e-3);
        const height = Math.max(maxY - minY, 1e-3);
        let cell = Math.sqrt((width * height * Na__PubMsLw__PER_CELL) / Math.max(n, 1));
        cell = Math.max(Na__PubMsLw__MIN_CELL_MM, Math.min(Na__PubMsLw__MAX_CELL_MM, cell));
        while (Math.ceil(width / cell) * Math.ceil(height / cell) > Na__PubMsLw__MAX_CELLS) cell *= 1.25;
        const grid = {
            MinX : minX, MinY : minY, Cell : cell,
            Cols : Math.max(1, Math.ceil(width / cell)), Rows : Math.max(1, Math.ceil(height / cell)),
            Start : null, Items : null
        };
        const cells = grid.Cols * grid.Rows;
        const counts = new Uint32Array(cells + 1);
        for (let s = 0; s < n; s++) {
            Na__PubMsLw__Walk(grid, layer.X1[s], layer.Y1[s], layer.X2[s], layer.Y2[s], (c) => { counts[c + 1] += 1; });
        }
        for (let c = 0; c < cells; c++) counts[c + 1] += counts[c];
        const fill  = counts.slice(0, cells);
        const items = new Uint32Array(counts[cells]);
        for (let s = 0; s < n; s++) {
            Na__PubMsLw__Walk(grid, layer.X1[s], layer.Y1[s], layer.X2[s], layer.Y2[s], (c) => { items[fill[c]++] = s; });
        }
        grid.Start = counts;
        grid.Items = items;
        return grid;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Building a Layer
// -----------------------------------------------------------------------------

    // FUNCTION | Turn a Point of the Viewport's Own Frame Into a Point on the Sheet
    // ------------------------------------------------------------
    // frame { X, Y, W, H } in sheet mm; the viewport is turned by spinDeg about
    // the middle of its frame, as the reader paints it.
    // ------------------------------------------------------------
    function Na__PubMsLw__FrameToSheet(frame, spinDeg, lx, ly) {
        const x = frame.X + lx, y = frame.Y + ly;
        if (!spinDeg) return [ x, y ];
        const a = spinDeg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
        const cx = frame.X + frame.W / 2, cy = frame.Y + frame.H / 2;
        const dx = x - cx, dy = y - cy;
        return [ cx + dx * c - dy * s, cy + dx * s + dy * c ];
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Sheet Point Inside a Viewport's (Turned) Frame
    // ------------------------------------------------------------
    function Na__PubMsLw__FrameContains(frame, spinDeg, x, y, marginMm) {
        let lx = x, ly = y;
        if (spinDeg) {
            const a = -spinDeg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
            const cx = frame.X + frame.W / 2, cy = frame.Y + frame.H / 2;
            const dx = x - cx, dy = y - cy;
            lx = cx + dx * c - dy * s; ly = cy + dx * s + dy * c;
        }
        const m = marginMm || 0;
        return lx >= frame.X - m && lx <= frame.X + frame.W + m && ly >= frame.Y - m && ly <= frame.Y + frame.H + m;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Viewport Record's Frame, Scale and Turn, Read Defensively (null when it is not a measurable 2D drawing)
    // ------------------------------------------------------------
    function Na__PubMsLw__ReadRecord(record) {
        if (!record || typeof record !== 'object') return null;
        if (record['Viewport__Kind'] !== '2d') return null;                       // <-- A 3D picture has no scale a length can be read at
        const frame = record['Viewport__FrameMm'] || {};
        const out = {
            Id       : String(record['Viewport__Id'] || ''),
            Scale    : Number(record['Viewport__ScaleDenominator']),
            SpinDeg  : Number(record['Viewport__RotationDeg']) || 0,
            SitePlan : record['Viewport__SitePlan'] === true,
            Frame    : { X : Number(frame['X']) || 0, Y : Number(frame['Y']) || 0, W : Number(frame['WidthMm']) || 0, H : Number(frame['HeightMm']) || 0 }
        };
        if (!out.Id || !(out.Scale > 0) || !(out.Frame.W > 0) || !(out.Frame.H > 0)) return null;
        return out;
    }
    // ------------------------------------------------------------


    // FUNCTION | Build a Viewport's Measuring Layer From Its Record and Its Published Linework
    // ------------------------------------------------------------
    // record  : the viewport's entry in Elements__Viewports__.json
    // svgText : the text of its Viewport__Vector file (or '' for none: the
    //           layer still knows its frame and scale, it simply has nothing to
    //           snap to)
    // Returns the layer, or null for a viewport that cannot be measured.
    // ------------------------------------------------------------
    function Na__PubMsLw__Build(record, svgText) {
        const info = Na__PubMsLw__ReadRecord(record);
        if (!info) return null;
        const frame  = info.Frame;
        const vector = record['Viewport__Vector'] || {};
        const parsed = Na__PubMsLw__ParseSvg(svgText || '');
        const box    = parsed.ViewBox || [ 0, 0, Number(vector['Vector__WidthMm']) || frame.W, Number(vector['Vector__HeightMm']) || frame.H ];
        const kx = frame.W / box[2], ky = frame.H / box[3];                      // <-- The <image> stretches the file over the frame (preserveAspectRatio none)

        // 1. EVERY SEGMENT IN THE FRAME'S OWN MILLIMETRES, CUT TO THE FRAME
        // ------------------------------------------------------------
        const raw = { X1 : [], Y1 : [], X2 : [], Y2 : [], Flags : [], Cls : [] };
        let rawCount = 0, clippedAway = 0;
        for (const path of parsed.Paths) {
            const cls = Na__PubMsLw__CLASSES[path.Class] !== undefined ? Na__PubMsLw__CLASSES[path.Class] : Na__PubMsLw__CLASSES.other;
            Na__PubMsLw__ParsePathData(path.D, path.Matrix, (x1, y1, x2, y2, realA, realB) => {
                rawCount += 1;
                const ax = (x1 - box[0]) * kx, ay = (y1 - box[1]) * ky;
                const bx = (x2 - box[0]) * kx, by = (y2 - box[1]) * ky;
                const t = Na__PubMsLw__Clip(ax, ay, bx, by, 0, 0, frame.W, frame.H);
                if (!t) { clippedAway += 1; return; }
                const dx = bx - ax, dy = by - ay;
                const sx = ax + dx * t[0], sy = ay + dy * t[0], ex = ax + dx * t[1], ey = ay + dy * t[1];
                if (Math.hypot(ex - sx, ey - sy) < Na__PubMsLw__MIN_LENGTH_MM) return;
                raw.X1.push(sx); raw.Y1.push(sy); raw.X2.push(ex); raw.Y2.push(ey);
                raw.Flags.push(((realA && t[0] === 0) ? Na__PubMsLw__REAL_A : 0) | ((realB && t[1] === 1) ? Na__PubMsLw__REAL_B : 0));
                raw.Cls.push(cls);
            });
        }

        // 2. PIECES OF ONE STRAIGHT LINE BECOME ONE SEGMENT
        // ------------------------------------------------------------
        const joined = Na__PubMsLw__Join(raw);
        const n = joined.X1.length;

        // 3. ONTO THE SHEET, TURNED WITH THE VIEWPORT
        // ------------------------------------------------------------
        const layer = {
            Id       : info.Id,
            Scale    : info.Scale,
            SpinDeg  : info.SpinDeg,
            SitePlan : info.SitePlan,
            Frame    : frame,
            Count    : n,
            X1 : new Float64Array(n), Y1 : new Float64Array(n), X2 : new Float64Array(n), Y2 : new Float64Array(n),
            Flags    : Uint8Array.from(joined.Flags),
            Cls      : Uint8Array.from(joined.Cls),
            Grid     : null,
            Stamp    : new Uint32Array(n),
            StampId  : 0,
            Stats    : { Read : rawCount, OutsideFrame : clippedAway, Pieces : raw.X1.length, Segments : n }
        };
        for (let s = 0; s < n; s++) {
            const a = Na__PubMsLw__FrameToSheet(frame, info.SpinDeg, joined.X1[s], joined.Y1[s]);
            const b = Na__PubMsLw__FrameToSheet(frame, info.SpinDeg, joined.X2[s], joined.Y2[s]);
            layer.X1[s] = a[0]; layer.Y1[s] = a[1]; layer.X2[s] = b[0]; layer.Y2[s] = b[1];
        }

        // 4. THE GRID, over the turned frame's bounds
        // ------------------------------------------------------------
        const corners = [ [ 0, 0 ], [ frame.W, 0 ], [ frame.W, frame.H ], [ 0, frame.H ] ].map((p) => Na__PubMsLw__FrameToSheet(frame, info.SpinDeg, p[0], p[1]));
        const xs = corners.map((p) => p[0]), ys = corners.map((p) => p[1]);
        layer.Grid = Na__PubMsLw__BuildGrid(layer, Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
        return layer;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Queries
// -----------------------------------------------------------------------------

    // FUNCTION | The Distance From a Point to Segment s, and the Nearest Point on It
    // ------------------------------------------------------------
    function Na__PubMsLw__Nearest(layer, s, x, y) {
        const ax = layer.X1[s], ay = layer.Y1[s], bx = layer.X2[s], by = layer.Y2[s];
        const dx = bx - ax, dy = by - ay;
        const len2 = dx * dx + dy * dy;
        let t = len2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / len2 : 0;
        t = Math.max(0, Math.min(1, t));
        const px = ax + dx * t, py = ay + dy * t;
        return { X : px, Y : py, T : t, Distance : Math.hypot(x - px, y - py) };
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Segment of a Layer Within r of a Sheet Point
    // ------------------------------------------------------------
    // Fills `out` (cleared first) with segment indices and returns it. A
    // segment found in several cells is reported once (a stamp per query).
    // The cells searched reach one further than the circle, which covers a
    // line the walk entered through the very corner of a cell.
    // ------------------------------------------------------------
    function Na__PubMsLw__Near(layer, x, y, r, out) {
        const list = out || [];
        list.length = 0;
        if (!layer || !layer.Grid || layer.Count === 0) return list;
        const g = layer.Grid;
        const c0 = Math.max(0, Math.floor((x - r - g.MinX) / g.Cell) - 1);
        const c1 = Math.min(g.Cols - 1, Math.floor((x + r - g.MinX) / g.Cell) + 1);
        const r0 = Math.max(0, Math.floor((y - r - g.MinY) / g.Cell) - 1);
        const r1 = Math.min(g.Rows - 1, Math.floor((y + r - g.MinY) / g.Cell) + 1);
        if (c0 > c1 || r0 > r1) return list;
        layer.StampId += 1;
        if (layer.StampId >= 0xFFFFFFF0) { layer.Stamp.fill(0); layer.StampId = 1; }
        const stamp = layer.StampId;
        for (let row = r0; row <= r1; row++) {
            for (let col = c0; col <= c1; col++) {
                const cell = row * g.Cols + col;
                for (let k = g.Start[cell], end = g.Start[cell + 1]; k < end; k++) {
                    const s = g.Items[k];
                    if (layer.Stamp[s] === stamp) continue;
                    layer.Stamp[s] = stamp;
                    if (Na__PubMsLw__Nearest(layer, s, x, y).Distance <= r) list.push(s);
                }
            }
        }
        return list;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is Segment s's First (end 0) or Second (end 1) End a Real End of a Line
    // ------------------------------------------------------------
    function Na__PubMsLw__IsRealEnd(layer, s, end) {
        return !!(layer.Flags[s] & (end === 0 ? Na__PubMsLw__REAL_A : Na__PubMsLw__REAL_B));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    export {
        Na__PubMsLw__ParseTransform,
        Na__PubMsLw__ParsePathData,
        Na__PubMsLw__ParseSvg,
        Na__PubMsLw__Clip,
        Na__PubMsLw__Join,
        Na__PubMsLw__FrameToSheet,
        Na__PubMsLw__FrameContains,
        Na__PubMsLw__ReadRecord,
        Na__PubMsLw__Build,
        Na__PubMsLw__Nearest,
        Na__PubMsLw__Near,
        Na__PubMsLw__IsRealEnd
    };

// endregion -------------------------------------------------------------------
