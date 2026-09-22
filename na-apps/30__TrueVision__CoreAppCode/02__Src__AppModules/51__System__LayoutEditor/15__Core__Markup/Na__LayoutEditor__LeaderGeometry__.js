// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - LEADER GEOMETRY
// =============================================================================
//
// FILE       : Na__LayoutEditor__LeaderGeometry__.js
// NAMESPACE  : Na__LeLeadGeo
// MODULE     : Layout Editor - Leader Geometry
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The maths of a leader on the paper: its handing, its sweeping curve, its head (a note or a specification bubble), its primitives, bounds and hit testing
// CREATED    : 14-Sep-2026
//
// DESCRIPTION:
// - A leader is two paper points and a head. The TIP is the point it points
//   at and carries the endpoint circle. The ANCHOR is where the line lands on
//   the head. The head always extends AWAY from the tip, so the side of the
//   tip the anchor sits on decides the handing: to the right, a note is
//   left-justified and a bubble sits to the right of the anchor; to the left,
//   a note is right-justified and a bubble sits to its left. The text is
//   always correctly handed without anyone choosing an alignment.
// - THE LINE IS NEVER A STRAIGHT RULE. It leaves the endpoint circle level,
//   runs a short straight stub, sweeps through a cubic S whose tangents are
//   level at both ends, and runs a second stub into the head - the house
//   style of the hand-drawn leaders it replaces. StubMm caps the stubs and
//   StubMaxFraction stops them eating a short leader; CurveTension is how far
//   along the run the control points reach (0.5 is an even S, which turns
//   near-vertical in its middle when the head sits well above the tip).
// - TWO HEADS.
//     'text'    a multi-line note, one line per newline. The line lands level
//               with the middle of the first line's capitals (TextAttach
//               'first-line', the CAD default) or with the middle of the
//               block ('middle'). An optional fill sits behind it, padded.
//     'bubble'  a circle with its text centred, for a specification code.
//               BubbleSizeMm is its diameter; a code too wide for it grows
//               the circle rather than spilling out. Only the first line
//               with anything on it shows.
// - PAINT ORDER: the fill, the line, the endpoint, the bubble edge, the text.
//   The fill is BEHIND the text and the line, so a leader laid over a busy
//   drawing masks what it sits on; lower the fill opacity to let it show.
// - Circles are faceted finely enough to print round (no flat strays more
//   than CHORD_TOL_MM from the true circle) and the curve is sampled every
//   CURVE_STEP_MM, so one polyline primitive draws everything, on the screen
//   and in the PDF alike.
// - Nothing here touches the model or the DOM: the markup bridge draws
//   through Push and hit tests through Hit, the tools and the grips read
//   Layout, and the eyedropper and box selection read Bounds.
//
// INTEGRATION:
// - Na__LayoutEditor__MarkupBridge__ (primitives, hit test, bounds),
//   Na__LayoutEditor__LeaderTool__, Na__LayoutEditor__Grips__,
//   Na__LayoutEditor__SheetTools__.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (14-Sep-2026)
// - ValeVision    : 1.0.0 ported 14-Sep-2026 as ValeVision v2.32.0, verbatim
//                   below the header. Nothing here is app-specific; the record
//                   fields are shared. Later versions wait for their own sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.3.0
// - SetNoteResolver and NoteFor: the specification note a bubble stands for
//   - its id, its code, its title and a locate() that shows it in the
//   drawing's Specification tab - asked the way IsBroken asks, through a
//   resolver Na__LayoutEditor__SpecLinks__ registers. The sheet tools read it
//   for a bubble's hover tooltip (its note's title, after a moment) and its
//   Show in Specification row, and still import nothing of the specification.
//
// 18-Sep-2026 - Version 1.2.0
// - SetBrokenResolver and IsBroken: a specification bubble linked to a note
//   that no longer exists (Leader__SpecNoteId pointing at nothing) can be
//   asked about, the same way LinkedCode asks for its code. Push draws a red
//   halo round it when the caller opts in (options.showBrokenHalos) - an
//   editor diagnostic, never drawn for a PDF or an SVG export since neither
//   passes the option. Na__LayoutEditor__SpecLinks__ registers the resolver.
//
// 14-Sep-2026 - Version 1.1.0
// - SetCodeResolver: a specification bubble linked to a project specification
//   note (Leader__SpecNoteId) shows the code the resolver gives for it, so a
//   renumbered note reads correctly on the paper before its text is stamped.
//   With no resolver registered, or a leader without the key, Lines returns
//   exactly what it always did. Na__LayoutEditor__SpecLinks__ registers it.
//
// 14-Sep-2026 - Version 1.0.0
// - Initial implementation: handing, the stub-sweep-stub curve, the note and
//   bubble heads, primitives, bounds and hit testing.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config and Chrome Primitives
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLeaderSetup, Na__LeCfg__GetTextSetup, Na__LeCfg__PtToMm } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeChrome__MeasureTextMm, Na__LeChrome__PushPolyline, Na__LeChrome__PushText } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetChrome__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Types, Line Styles and Attach Modes
    // ------------------------------------------------------------
    const Na__LeLeadGeo__TYPE_TEXT         = 'text';
    const Na__LeLeadGeo__TYPE_BUBBLE       = 'bubble';
    const Na__LeLeadGeo__LINE_SOLID        = 'solid';
    const Na__LeLeadGeo__LINE_DASHED       = 'dashed';
    const Na__LeLeadGeo__ATTACH_FIRST_LINE = 'first-line';
    const Na__LeLeadGeo__ATTACH_MIDDLE     = 'middle';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Typography and Faceting
    // ------------------------------------------------------------
    const Na__LeLeadGeo__CAP_HEIGHT    = 0.72;     // <-- Helvetica cap height as a fraction of the font size, as the chrome measures it
    const Na__LeLeadGeo__DESCENT       = 0.25;
    const Na__LeLeadGeo__CHORD_TOL_MM  = 0.01;     // <-- No flat of a circle strays further than this from the true curve
    const Na__LeLeadGeo__CIRCLE_MIN    = 16;
    const Na__LeLeadGeo__CIRCLE_MAX    = 96;
    const Na__LeLeadGeo__CURVE_STEP_MM = 0.4;
    const Na__LeLeadGeo__CURVE_MIN     = 12;
    const Na__LeLeadGeo__CURVE_MAX     = 72;
    const Na__LeLeadGeo__EPSILON       = 1e-6;
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Broken-Link Halo (an editor diagnostic, never exported)
    // ------------------------------------------------------------
    const Na__LeLeadGeo__BROKEN_HALO_COLOUR = '#d92d20';
    const Na__LeLeadGeo__BROKEN_HALO_GAP_MM = 1.1;
    const Na__LeLeadGeo__BROKEN_HALO_PT     = 1.6;
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Specification Code Resolver
    // ------------------------------------------------------------
    // (leader) => the code a linked bubble shows, or null to show its own text.
    // Registered, not imported, so this module stays pure geometry: nothing here
    // reads the specification, and with nothing registered a bubble reads its
    // Leader__Text exactly as before.
    // ------------------------------------------------------------
    let Na__LeLeadGeo__CodeResolver = null;
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Specification Note Resolver
    // ------------------------------------------------------------
    // (leader) => { noteId, code, title, linked } for the note a bubble stands
    // for, or null. Registered by the specification, like the code resolver,
    // so the sheet tools can name a bubble's note - its hover tooltip, its
    // Show in Specification row - without importing the specification.
    // ------------------------------------------------------------
    let Na__LeLeadGeo__NoteResolver = null;
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Broken-Link Resolver
    // ------------------------------------------------------------
    // (leader) => true when a bubble is linked to a specification note that no
    // longer exists. Registered the same way as the code resolver, and for the
    // same reason: nothing here reads the specification. With nothing
    // registered a bubble never reads as broken.
    // ------------------------------------------------------------
    let Na__LeLeadGeo__BrokenResolver = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Clamp a Number Into a Range
    // ------------------------------------------------------------
    function Na__LeLeadGeo__Clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | An Opacity From 0 to 1 (anything unreadable is solid)
    // ------------------------------------------------------------
    function Na__LeLeadGeo__Opacity(value) {
        return Number.isFinite(value) ? Na__LeLeadGeo__Clamp(value, 0, 1) : 1;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Weight in Points as Paper Millimetres (0 draws nothing)
    // ------------------------------------------------------------
    function Na__LeLeadGeo__StrokeMm(pt) {
        return (Number.isFinite(pt) && pt > 0) ? Math.max(0.02, Na__LeCfg__PtToMm(pt)) : 0;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Distance From a Point to a Segment ([x, y] ends)
    // ------------------------------------------------------------
    function Na__LeLeadGeo__DistanceToSegment(point, a, b) {
        const abx = b[0] - a[0], aby = b[1] - a[1];
        const len2 = (abx * abx) + (aby * aby);
        const t = len2 > 0 ? Na__LeLeadGeo__Clamp((((point.x - a[0]) * abx) + ((point.y - a[1]) * aby)) / len2, 0, 1) : 0;
        return Math.hypot(point.x - (a[0] + (abx * t)), point.y - (a[1] + (aby * t)));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Four Corners of a Box as a Closed Run
    // ------------------------------------------------------------
    function Na__LeLeadGeo__BoxPoints(box) {
        return [ [ box.X, box.Y ], [ box.X + box.WidthMm, box.Y ], [ box.X + box.WidthMm, box.Y + box.HeightMm ], [ box.X, box.Y + box.HeightMm ] ];
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Handing, Text and Circles
// -----------------------------------------------------------------------------

    // FUNCTION | Which Way the Head Faces: +1 to the Right of the Tip, -1 to the Left
    // ------------------------------------------------------------
    // An anchor straight above or below the tip reads to the right, the way a
    // note is written.
    // ------------------------------------------------------------
    function Na__LeLeadGeo__Side(leader) {
        return (leader.Leader__AnchorXMm - leader.Leader__TipXMm) < -Na__LeLeadGeo__EPSILON ? -1 : 1;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Lines a Leader Shows
    // ------------------------------------------------------------
    // A note shows every line, blank ones included, because a blank line is
    // spacing someone typed. A bubble shows the first line with anything on
    // it: a specification code is one word.
    // ------------------------------------------------------------
    function Na__LeLeadGeo__Lines(leader) {
        const raw   = (leader && typeof leader.Leader__Text === 'string') ? leader.Leader__Text : '';
        const lines = raw.split(/\r?\n/);
        if (!leader || leader.Leader__Type !== Na__LeLeadGeo__TYPE_BUBBLE) return lines;
        const linked = Na__LeLeadGeo__LinkedCode(leader);
        if (linked) return [ linked ];                                          // <-- A bubble linked to the specification shows its note's code as it stands now
        const first = lines.map((line) => line.trim()).find((line) => line !== '');
        return first ? [ first ] : [];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Code a Linked Bubble Shows (null: show its own text)
    // ------------------------------------------------------------
    // Only a leader carrying Leader__SpecNoteId asks, and only when a resolver
    // is registered. A resolver that throws or answers nothing usable leaves
    // the bubble on its own text - its last stamped code.
    // ------------------------------------------------------------
    function Na__LeLeadGeo__LinkedCode(leader) {
        if (!Na__LeLeadGeo__CodeResolver || typeof leader.Leader__SpecNoteId !== 'string') return null;
        try {
            const code = Na__LeLeadGeo__CodeResolver(leader);
            return (typeof code === 'string' && code.trim() !== '') ? code.trim() : null;
        } catch (e) {
            return null;
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Register the Specification Code Resolver (a non-function clears it)
    // ------------------------------------------------------------
    function Na__LeLeadGeo__SetCodeResolver(resolver) {
        Na__LeLeadGeo__CodeResolver = (typeof resolver === 'function') ? resolver : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Register the Broken-Link Resolver (a non-function clears it)
    // ------------------------------------------------------------
    function Na__LeLeadGeo__SetBrokenResolver(resolver) {
        Na__LeLeadGeo__BrokenResolver = (typeof resolver === 'function') ? resolver : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Bubble Linked to a Specification Note That No Longer Exists
    // ------------------------------------------------------------
    // Only a bubble asks, and only when a resolver is registered. A resolver
    // that throws or answers nothing usable reads as not broken.
    // ------------------------------------------------------------
    function Na__LeLeadGeo__IsBroken(leader) {
        if (!leader || leader.Leader__Type !== Na__LeLeadGeo__TYPE_BUBBLE || !Na__LeLeadGeo__BrokenResolver) return false;
        try {
            return Na__LeLeadGeo__BrokenResolver(leader) === true;
        } catch (e) {
            return false;
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Register the Specification Note Resolver (a non-function clears it)
    // ------------------------------------------------------------
    function Na__LeLeadGeo__SetNoteResolver(resolver) {
        Na__LeLeadGeo__NoteResolver = (typeof resolver === 'function') ? resolver : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Specification Note a Bubble Stands For: { noteId, code, title, linked, locate } or null
    // ------------------------------------------------------------
    // Only a bubble asks, and only when a resolver is registered. linked is
    // false for a bubble that is not linked but reads a note's code. locate(),
    // when the specification gives one, shows the note where the drawing's
    // Specification tab lists it - the sheet's right-click menu calls it
    // without knowing how. A resolver that throws, or answers without a note
    // id and a code, reads as no note at all.
    // ------------------------------------------------------------
    function Na__LeLeadGeo__NoteFor(leader) {
        if (!leader || leader.Leader__Type !== Na__LeLeadGeo__TYPE_BUBBLE || !Na__LeLeadGeo__NoteResolver) return null;
        try {
            const note = Na__LeLeadGeo__NoteResolver(leader);
            if (!note || typeof note.noteId !== 'string' || !note.noteId || typeof note.code !== 'string' || !note.code) return null;
            return {
                noteId : note.noteId,
                code   : note.code,
                title  : typeof note.title === 'string' ? note.title : '',
                linked : note.linked === true,
                locate : typeof note.locate === 'function' ? note.locate : null
            };
        } catch (e) {
            return null;
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Does a Head Carry Any Visible Text
    // ------------------------------------------------------------
    function Na__LeLeadGeo__HasText(head) {
        return !!head && head.lines.some((line) => line.text.trim() !== '');
    }
    // ------------------------------------------------------------


    // FUNCTION | A Circle as a Closed Run of Paper Points
    // ------------------------------------------------------------
    // Faceted by the chord rule: a flat spanning angle t sits r(1 - cos(t/2))
    // inside the circle, so the flats needed to stay within CHORD_TOL_MM are
    // pi / acos(1 - tol / r). A 9 mm bubble takes 48, a 1.6 mm endpoint 20.
    // ------------------------------------------------------------
    function Na__LeLeadGeo__Circle(cx, cy, radius) {
        const r    = Math.max(radius, Na__LeLeadGeo__EPSILON);
        const half = Math.acos(Math.max(-1, 1 - (Na__LeLeadGeo__CHORD_TOL_MM / r)));
        const n    = Na__LeLeadGeo__Clamp(Math.ceil(Math.PI / Math.max(half, Na__LeLeadGeo__EPSILON)), Na__LeLeadGeo__CIRCLE_MIN, Na__LeLeadGeo__CIRCLE_MAX);
        const points = [];
        for (let i = 0; i < n; i++) {
            const angle = (i / n) * Math.PI * 2;
            points.push([ cx + (Math.cos(angle) * r), cy + (Math.sin(angle) * r) ]);
        }
        return points;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Endpoint Circle's Radius (0 when it is switched off)
    // ------------------------------------------------------------
    function Na__LeLeadGeo__EndpointRadius(leader) {
        const size = leader.Leader__EndpointSizeMm;
        return (Number.isFinite(size) && size > 0) ? size / 2 : 0;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Layout
// -----------------------------------------------------------------------------

    // FUNCTION | The Head: Where the Text Sits and What Surrounds It
    // ------------------------------------------------------------
    // Returns { type, side, attach {x, y}, fontMm, weight, align,
    //           lines [{ text, x, baselineY }],
    //           box {X, Y, WidthMm, HeightMm}  - a note's fill rectangle, or the bubble's square,
    //           textBox                          - a note's text block (null for a bubble),
    //           centre {x, y}, radius            - a bubble's circle (null and 0 for a note) }.
    // ------------------------------------------------------------
    function Na__LeLeadGeo__Head(leader) {
        const setup  = Na__LeCfg__GetLeaderSetup();
        const side   = Na__LeLeadGeo__Side(leader);
        const fontMm = leader.Leader__TextSizeMm;
        const weight = leader.Leader__FontWeight;
        const ax     = leader.Leader__AnchorXMm, ay = leader.Leader__AnchorYMm;
        const lines  = Na__LeLeadGeo__Lines(leader);
        const cap    = fontMm * Na__LeLeadGeo__CAP_HEIGHT;

        // BUBBLE | The anchor is on the circle's near side, so the circle
        // sits one radius further on. A code too wide for the diameter grows
        // the circle by what it needs, never the other way round.
        // ------------------------------------
        if (leader.Leader__Type === Na__LeLeadGeo__TYPE_BUBBLE) {
            const label  = lines.length ? lines[0] : '';
            const textMm = Na__LeChrome__MeasureTextMm(label, fontMm, weight);
            const radius = Math.max(leader.Leader__BubbleSizeMm / 2, (textMm / 2) + setup.bubblePaddingMm, (cap / 2) + setup.bubblePaddingMm);
            const cx     = ax + (side * radius);
            return {
                type    : Na__LeLeadGeo__TYPE_BUBBLE, side : side, attach : { x : ax, y : ay },
                fontMm  : fontMm, weight : weight, align : 'center',
                lines   : label ? [ { text : label, x : cx, baselineY : ay + (cap / 2) } ] : [],   // <-- Capitals optically centred on the line
                box     : { X : cx - radius, Y : ay - radius, WidthMm : radius * 2, HeightMm : radius * 2 },
                textBox : null, centre : { x : cx, y : ay }, radius : radius
            };
        }

        // NOTE | Justified on the edge nearest the tip, so it always reads
        // away from what it points at.
        // ------------------------------------
        const lineMm  = fontMm * setup.lineSpacing;
        const widthMm = lines.reduce((widest, line) => Math.max(widest, Na__LeChrome__MeasureTextMm(line, fontMm, weight)), 0);
        const blockMm = cap + ((lines.length - 1) * lineMm) + (fontMm * Na__LeLeadGeo__DESCENT);
        const first   = setup.textAttach === Na__LeLeadGeo__ATTACH_MIDDLE ? (ay - (blockMm / 2)) + cap : ay + (cap / 2);
        const edgeX   = ax + (side * setup.textGapMm);
        const left    = side > 0 ? edgeX : edgeX - widthMm;
        const top     = first - cap;
        const pad     = setup.textPaddingMm;
        return {
            type    : Na__LeLeadGeo__TYPE_TEXT, side : side, attach : { x : ax, y : ay },
            fontMm  : fontMm, weight : weight, align : side > 0 ? 'left' : 'right',
            lines   : lines.map((text, i) => ({ text : text, x : edgeX, baselineY : first + (i * lineMm) })),
            box     : { X : left - pad, Y : top - pad, WidthMm : widthMm + (pad * 2), HeightMm : blockMm + (pad * 2) },
            textBox : { X : left, Y : top, WidthMm : widthMm, HeightMm : blockMm },
            centre  : null, radius : 0
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Leader Line as Paper Points: Stub, Sweep, Stub
    // ------------------------------------------------------------
    // p0 is where the line leaves the endpoint circle, on the side facing the
    // head; p3 is the anchor. Each stub is StubMm long, or StubMaxFraction of
    // the run if that is shorter. The sweep is a cubic from a to b with its
    // control points level with each end and CurveTension of the run in, so
    // the line leaves and arrives horizontally whatever the rise between them.
    // ------------------------------------------------------------
    function Na__LeLeadGeo__Path(leader, head) {
        const setup = Na__LeCfg__GetLeaderSetup();
        const side  = head.side;
        const tipR  = Na__LeLeadGeo__EndpointRadius(leader);
        const p0    = { x : leader.Leader__TipXMm + (side * tipR), y : leader.Leader__TipYMm };
        const p3    = { x : head.attach.x, y : head.attach.y };
        const run   = Math.max(0, side * (p3.x - p0.x));
        const stub  = Math.min(setup.stubMm, run * setup.stubMaxFraction);
        const a     = { x : p0.x + (side * stub), y : p0.y };
        const b     = { x : p3.x - (side * stub), y : p3.y };
        const reach = Math.abs(b.x - a.x) * setup.curveTension;
        const c1    = { x : a.x + (side * reach), y : a.y };
        const c2    = { x : b.x - (side * reach), y : b.y };

        const points = [];
        const add = (x, y) => {
            const last = points[points.length - 1];
            if (last && Math.abs(last[0] - x) < Na__LeLeadGeo__EPSILON && Math.abs(last[1] - y) < Na__LeLeadGeo__EPSILON) return;
            points.push([ x, y ]);
        };

        // THE SAMPLE COUNT follows the curve's length, estimated as the mean of
        // its chord and its control polygon, which brackets a cubic's length.
        const chord   = Math.hypot(b.x - a.x, b.y - a.y);
        const polygon = Math.hypot(c1.x - a.x, c1.y - a.y) + Math.hypot(c2.x - c1.x, c2.y - c1.y) + Math.hypot(b.x - c2.x, b.y - c2.y);
        const n       = Na__LeLeadGeo__Clamp(Math.ceil(((chord + polygon) / 2) / Na__LeLeadGeo__CURVE_STEP_MM), Na__LeLeadGeo__CURVE_MIN, Na__LeLeadGeo__CURVE_MAX);

        add(p0.x, p0.y);
        for (let i = 0; i <= n; i++) {
            const t  = i / n, u = 1 - t;
            const w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
            add((w0 * a.x) + (w1 * c1.x) + (w2 * c2.x) + (w3 * b.x), (w0 * a.y) + (w1 * c1.y) + (w2 * c2.y) + (w3 * b.y));
        }
        add(p3.x, p3.y);
        return points;
    }
    // ------------------------------------------------------------


    // FUNCTION | Everything About a Leader's Shape in One Call
    // ------------------------------------------------------------
    // Returns { tip {x, y}, tipRadius, head, path }.
    // ------------------------------------------------------------
    function Na__LeLeadGeo__Layout(leader) {
        const head = Na__LeLeadGeo__Head(leader);
        return {
            tip       : { x : leader.Leader__TipXMm, y : leader.Leader__TipYMm },
            tipRadius : Na__LeLeadGeo__EndpointRadius(leader),
            head      : head,
            path      : Na__LeLeadGeo__Path(leader, head)
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Primitives, Bounds and Hit Testing
// -----------------------------------------------------------------------------

    // FUNCTION | Push a Leader as Primitives: Fill, Line, Endpoint, Bubble Edge, Halo, Text
    // ------------------------------------------------------------
    // Every stroke - the line, the endpoint and the bubble edge - takes the
    // line colour and the line opacity; the fill takes its own. Returns the
    // layout it drew, so a caller that also wants the bounds does not lay the
    // leader out twice.
    // options.showBrokenHalos: draw a red ring outside a bubble whose linked
    // note has gone (Na__LeLeadGeo__IsBroken). An editor diagnostic only - the
    // caller opts in, so it never reaches a PDF or an SVG export, which pass
    // no options and get exactly what they always drew.
    // ------------------------------------------------------------
    function Na__LeLeadGeo__Push(list, leader, options) {
        const setup   = Na__LeCfg__GetLeaderSetup();
        const layout  = Na__LeLeadGeo__Layout(leader);
        const head    = layout.head;
        const ink     = leader.Leader__LineColour;
        const inkA    = Na__LeLeadGeo__Opacity(leader.Leader__LineOpacity);
        const fillA   = Na__LeLeadGeo__Opacity(leader.Leader__FillOpacity);
        const bubble  = head.type === Na__LeLeadGeo__TYPE_BUBBLE;
        const outline = bubble ? Na__LeLeadGeo__Circle(head.centre.x, head.centre.y, head.radius) : null;

        // FILL | Behind the text and the line
        if (typeof leader.Leader__FillColour === 'string') {
            if (bubble) Na__LeChrome__PushPolyline(list, outline, null, 0, leader.Leader__FillColour, true, null, { fillOpacity : fillA });
            else if (Na__LeLeadGeo__HasText(head)) Na__LeChrome__PushPolyline(list, Na__LeLeadGeo__BoxPoints(head.box), null, 0, leader.Leader__FillColour, true, null, { fillOpacity : fillA });
        }

        // LINE | Solid or dashed
        const lineMm = Na__LeLeadGeo__StrokeMm(leader.Leader__LinePt);
        if (lineMm > 0 && layout.path.length > 1) {
            const dashMm = leader.Leader__LineStyle === Na__LeLeadGeo__LINE_DASHED ? setup.dashMm : 0;
            Na__LeChrome__PushPolyline(list, layout.path, ink, lineMm, null, false, null, { dashMm : dashMm, strokeOpacity : inkA });
        }

        // ENDPOINT | A solid dot, or a ring at its own weight
        if (layout.tipRadius > 0) {
            const ring = Na__LeLeadGeo__Circle(layout.tip.x, layout.tip.y, layout.tipRadius);
            if (leader.Leader__EndpointFilled === true) {
                Na__LeChrome__PushPolyline(list, ring, null, 0, ink, true, null, { fillOpacity : inkA });
            } else {
                const ringMm = Na__LeLeadGeo__StrokeMm(leader.Leader__EndpointPt);
                if (ringMm > 0) Na__LeChrome__PushPolyline(list, ring, ink, ringMm, null, true, null, { strokeOpacity : inkA });
            }
        }

        // BUBBLE EDGE | Over the fill; a weight of 0 leaves the fill on its own
        if (bubble) {
            const edgeMm = Na__LeLeadGeo__StrokeMm(leader.Leader__BubbleEdgePt);
            if (edgeMm > 0) Na__LeChrome__PushPolyline(list, outline, ink, edgeMm, null, true, null, { strokeOpacity : inkA });
        }

        // BROKEN HALO | A red ring standing clear of the bubble, only when the
        // caller opts in and the bubble's linked note has gone
        if (bubble && options && options.showBrokenHalos && Na__LeLeadGeo__IsBroken(leader)) {
            const halo = Na__LeLeadGeo__Circle(head.centre.x, head.centre.y, head.radius + Na__LeLeadGeo__BROKEN_HALO_GAP_MM);
            Na__LeChrome__PushPolyline(list, halo, Na__LeLeadGeo__BROKEN_HALO_COLOUR, Na__LeCfg__PtToMm(Na__LeLeadGeo__BROKEN_HALO_PT), null, true, null, { strokeOpacity : 0.9 });
        }

        // TEXT | Last, over everything else
        const family = Na__LeCfg__GetTextSetup().fontFamily;
        head.lines.forEach((line) => {
            Na__LeChrome__PushText(list, {
                X : line.x, BaselineY : line.baselineY, Text : line.text, FontMm : head.fontMm,
                Weight : head.weight, Colour : leader.Leader__TextColour, Align : head.align, FontFamily : family
            });
        });
        return layout;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Paper Box a Leader Occupies (the line, the endpoint and the head)
    // ------------------------------------------------------------
    // layout is optional: pass the one Push returned to save laying it out again.
    // ------------------------------------------------------------
    function Na__LeLeadGeo__Bounds(leader, layout) {
        const l = layout || Na__LeLeadGeo__Layout(leader);
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const take = (x, y) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); };
        l.path.forEach((p) => take(p[0], p[1]));
        take(l.tip.x - l.tipRadius, l.tip.y - l.tipRadius);
        take(l.tip.x + l.tipRadius, l.tip.y + l.tipRadius);
        if (l.head.type === Na__LeLeadGeo__TYPE_BUBBLE || Na__LeLeadGeo__HasText(l.head)) {
            const b = l.head.box;
            take(b.X, b.Y);
            take(b.X + b.WidthMm, b.Y + b.HeightMm);
        }
        return { X : minX, Y : minY, WidthMm : maxX - minX, HeightMm : maxY - minY };
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Part of a Leader a Point Hits: 'tip', 'head', 'line', or Null
    // ------------------------------------------------------------
    // The endpoint first, because it sits ON whatever the leader points at and
    // is the smallest target; then the head, which is the largest; then the
    // line, with a wider tolerance because a thin dashed curve is hard to hit.
    // ------------------------------------------------------------
    function Na__LeLeadGeo__Hit(leader, pointMm, toleranceMm) {
        if (!leader || !pointMm) return null;
        const tol = Number.isFinite(toleranceMm) ? toleranceMm : 1.5;
        const l   = Na__LeLeadGeo__Layout(leader);
        if (Math.hypot(pointMm.x - l.tip.x, pointMm.y - l.tip.y) <= l.tipRadius + tol) return 'tip';

        const head = l.head;
        if (head.type === Na__LeLeadGeo__TYPE_BUBBLE) {
            if (Math.hypot(pointMm.x - head.centre.x, pointMm.y - head.centre.y) <= head.radius + tol) return 'head';
        } else if (Na__LeLeadGeo__HasText(head)) {
            const b = head.box;
            if (pointMm.x >= b.X - tol && pointMm.x <= b.X + b.WidthMm + tol && pointMm.y >= b.Y - tol && pointMm.y <= b.Y + b.HeightMm + tol) return 'head';
        }

        const lineTol = tol * 1.5;
        for (let i = 1; i < l.path.length; i++) {
            if (Na__LeLeadGeo__DistanceToSegment(pointMm, l.path[i - 1], l.path[i]) <= lineTol) return 'line';
        }
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Patch That Moves a Whole Leader by a Delta
    // ------------------------------------------------------------
    function Na__LeLeadGeo__Translated(leader, dx, dy) {
        return {
            tipXMm    : leader.Leader__TipXMm + dx,    tipYMm    : leader.Leader__TipYMm + dy,
            anchorXMm : leader.Leader__AnchorXMm + dx, anchorYMm : leader.Leader__AnchorYMm + dy
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Leader Geometry API
    // ------------------------------------------------------------
    export {
        Na__LeLeadGeo__TYPE_TEXT,
        Na__LeLeadGeo__TYPE_BUBBLE,
        Na__LeLeadGeo__LINE_SOLID,
        Na__LeLeadGeo__LINE_DASHED,
        Na__LeLeadGeo__ATTACH_FIRST_LINE,
        Na__LeLeadGeo__ATTACH_MIDDLE,
        Na__LeLeadGeo__Side,
        Na__LeLeadGeo__Lines,
        Na__LeLeadGeo__SetCodeResolver,
        Na__LeLeadGeo__SetBrokenResolver,
        Na__LeLeadGeo__IsBroken,
        Na__LeLeadGeo__SetNoteResolver,
        Na__LeLeadGeo__NoteFor,
        Na__LeLeadGeo__HasText,
        Na__LeLeadGeo__Circle,
        Na__LeLeadGeo__EndpointRadius,
        Na__LeLeadGeo__Head,
        Na__LeLeadGeo__Path,
        Na__LeLeadGeo__Layout,
        Na__LeLeadGeo__Push,
        Na__LeLeadGeo__Bounds,
        Na__LeLeadGeo__Hit,
        Na__LeLeadGeo__Translated
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
