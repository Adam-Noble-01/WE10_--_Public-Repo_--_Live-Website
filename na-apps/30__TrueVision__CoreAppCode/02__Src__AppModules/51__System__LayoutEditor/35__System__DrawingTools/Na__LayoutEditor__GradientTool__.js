// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - GRADIENT TOOL
// =============================================================================
//
// FILE       : Na__LayoutEditor__GradientTool__.js
// NAMESPACE  : Na__LeGrad
// MODULE     : Layout Editor - Gradient Tool
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : A linear gradient fill for vector shapes - start and end colour, either end alpha, a blend and a direction
// CREATED    : 13-Sep-2026
//
// DESCRIPTION:
// - Owns Na__LayoutEditor__GradientTool__Config__.json: the defaults a new
//   gradient starts from, the rendering sample counts and the panel wording.
// - Owns the shape record's Shape__Gradient: null for none, otherwise one
//   object holding both ends, the blend and the direction.
// - Paints it on both surfaces the sheet chrome draws to - an SVG gradient on
//   screen and a clipped strip image in the PDF - from ONE colour function, so
//   the screen and the paper cannot drift apart.
// - Builds the gradient rows of the Vectors panel. The panel keeps the rules
//   that involve the rest of the shape (a gradient replaces the solid fill, a
//   shape never ends up with nothing to show); this module keeps everything
//   that is only about the gradient itself.
//
// THE USE IT WAS BUILT FOR. Draw a closed polygon on a vector layer over a
// drawing, switch the edges off and the gradient on, and run alpha to white:
// the drawing fades out into the page. Colour to colour works the same way.
//
// -----------------------------------------------------------------------------
//
// THE RECORD
//
//   Shape__Gradient : null | {
//       Gradient__StartColour  : '#ffffff',   hex, kept even while the end is alpha
//       Gradient__StartOpacity : 0,           0 is Alpha, 1 is the colour
//       Gradient__EndColour    : '#ffffff',
//       Gradient__EndOpacity   : 1,
//       Gradient__BlendPct     : 50,          where the ends meet half and half
//       Gradient__AngleDeg     : 0            start to end, anticlockwise
//   }
//
// - OPACITY IS A NUMBER, THE PANEL IS A TICK BOX. The panel only ever writes 0
//   or 1, but every painter here mixes any opacity correctly, so a later
//   opacity slider is a panel change and not a record migration.
// - A NEW OBJECT ON EVERY WRITE. Normalise always returns a fresh object and
//   nothing ever edits one in place, so two shapes can never share a gradient
//   and the eyedropper's held copy cannot change under it.
//
// -----------------------------------------------------------------------------
//
// DIRECTION, BLEND AND WHERE THE ENDS LAND
//
// - AngleDeg reads like a protractor and like Adobe's gradient tools: 0 runs
//   left to right, 90 bottom to top, 180 right to left, 270 top to bottom.
// - The gradient is FITTED TO THE SHAPE. The start colour sits exactly on the
//   outline's furthest point back along the direction and the end colour on
//   its furthest point forward, so the fade spans the whole polygon at any
//   angle - which is what "the direction of the gradient within the polygon"
//   has to mean for a shape that is not a square.
// - BlendPct is the midpoint of Illustrator and Photoshop: the weight of the
//   end colour at a fraction t of the way along is t ^ (ln 0.5 / ln blend),
//   the same curve a CSS colour hint uses. 50 is a straight, even fade.
// - An alpha end borrows the colour of the other end. The mix is done with
//   premultiplied alpha, which comes to exactly that, so alpha to white is
//   white at a falling opacity rather than a fade through grey.
//
// -----------------------------------------------------------------------------
//
// WHY THE PDF IS A STRIP IMAGE
//
// - A PDF shading cannot carry transparency, and jsPDF offers no soft-mask
//   shading. The gradient therefore goes into the PDF as a thin image with an
//   alpha soft mask, rotated to the direction by jsPDF's own image rotation
//   and clipped to the shape's outline. The outline stays a vector edge; only
//   the tone inside is sampled, and a gradient has no detail to lose.
// - IT MUST BE A PNG. This jsPDF build (4.1.0) has a raw RGBA image path, but
//   its processRGBA returns the alpha under a key the image writer never reads,
//   so the soft mask is silently dropped and a fade prints as a solid block.
//   The PNG path builds the soft mask properly, so the strip is encoded as one.
// - The strip overshoots the shape on all four sides and is clipped back, so a
//   viewer that smooths an image's edges does it outside the outline.
//
// -----------------------------------------------------------------------------
//
// INTEGRATION:
// - Na__LayoutEditor__SheetChrome__   paints a polyline primitive's Gradient
//                                     through SvgPaint and DrawPdf.
// - Na__LayoutEditor__ShapeGeometry__ hands a shape's gradient to the primitive
//                                     and counts it as a fill for hit testing.
// - Na__LayoutEditor__SheetRecords__  normalises Shape__Gradient; the sheet
//                                     model carries it through create and update.
// - Na__LayoutEditor__Panel__Shapes__ builds, refreshes and wires the rows.
// - Na__LayoutEditor__SheetTools__    seeds the Draw tool's defaults from here.
// - Na__LayoutEditor__Eyedropper__    copies the gradient with the other vector traits.
// - Na__LayoutEditor__ModeController__ waits on Ready with the other configs.
//
// IMPORTS ARE KEPT TO THE PANEL HOST, which imports only the config state. The
// sheet chrome and the record normaliser both import this module, so it must
// never reach back to the model, the surface or the chrome - that would cycle.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : n/a - authored in TrueVision3D
// - Ported to     : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__GradientTool__.js
// - Ported on     : 13-Sep-2026 for ValeVision3D v2.26.0
// - Parity        : verbatim (the ValeVision copy differs in its header and console
//                   prefix only; the config JSON is identical and the record shape
//                   is shared, so either app reads the other's gradients)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.1.0
// - DrawPdf takes an optional fourth argument, holes (a holed vector's, from
//   the vector tools' Boolean section): every ring is traced into the clip and
//   it is taken even-odd, so the gradient leaves the holes bare. Without it the
//   clip is drawn exactly as before. TrueVision first; not in ValeVision.
//
// 13-Sep-2026 - Version 1.0.0
// - Initial implementation: the record, the premultiplied colour curve, the SVG
//   and PDF painters, the panel preview and the Vectors panel rows.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Panel Host Row Builders and Delegated Controls
    // ------------------------------------------------------------
    import {
        Na__LePanels__OnControl,
        Na__LePanels__Row,
        Na__LePanels__Input
    } from '../40__Ui__Panels/Na__LayoutEditor__PanelHost__.js';
    import { Na__LeRings__Spans } from '../15__Core__Markup/Na__LayoutEditor__ShapeRings__.js';   // <-- A leaf with no imports: a holed shape's rings, for the PDF clip
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Config Location, Record Field and Control Names
    // ------------------------------------------------------------
    const Na__LeGrad__ConfigUrl = new URL('./Na__LayoutEditor__GradientTool__Config__.json', import.meta.url);
    const Na__LeGrad__FIELD     = 'Shape__Gradient';
    const Na__LeGrad__BLOCK     = 'gradient';
    const Na__LeGrad__CONTROLS  = Object.freeze({
        toggle     : 'shape-gradient',
        start      : 'shape-grad-start',
        startAlpha : 'shape-grad-start-alpha',
        end        : 'shape-grad-end',
        endAlpha   : 'shape-grad-end-alpha',
        blend      : 'shape-grad-blend',
        angleRange : 'shape-grad-angle-range',
        angle      : 'shape-grad-angle'
    });
    const Na__LeGrad__HEX       = /^#[0-9a-fA-F]{6}$/;
    const Na__LeGrad__CHECKER   = 'repeating-conic-gradient(#cfd6dc 0% 25%, #ffffff 0% 50%)';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | What Works Before the Fetch Lands, or Instead of It
    // ------------------------------------------------------------
    // The same values the config ships, so a failed fetch leaves a gradient
    // that behaves exactly as designed: alpha to white, left to right, even.
    // ------------------------------------------------------------
    const Na__LeGrad__FALLBACK_DEFAULTS  = Object.freeze({ on : false, startColour : '#ffffff', startAlpha : true, endColour : '#ffffff', endAlpha : false, blendPct : 50, angleDeg : 0 });
    const Na__LeGrad__FALLBACK_RENDERING = Object.freeze({ curveStops : 32, pdfSamplesPerMm : 4, pdfMinSamples : 64, pdfMaxSamples : 2048 });
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Fetched Config and the SVG Id Counter
    // ------------------------------------------------------------
    let Na__LeGrad__Config      = null;
    let Na__LeGrad__LoadPromise = null;
    let Na__LeGrad__IdCounter   = 0;     // <-- Never reset: the chrome and markup SVGs share one document, so an id may never repeat
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Config
// -----------------------------------------------------------------------------

    // FUNCTION | Fetch the Config Once
    // ------------------------------------------------------------
    // Never rejects: a missing file means the built-in values, not a broken editor.
    // ------------------------------------------------------------
    function Na__LeGrad__Ready() {
        if (!Na__LeGrad__LoadPromise) {
            Na__LeGrad__LoadPromise = (async () => {
                try {
                    const response = await fetch(Na__LeGrad__ConfigUrl, { cache : 'no-store' });
                    if (!response.ok) {
                        console.warn('[TrueVision3D LayoutEditor] Gradient config fetch failed (' + response.status + ') - the built-in defaults will be used.');
                        return null;
                    }
                    Na__LeGrad__Config = await response.json();
                } catch (error) {
                    console.warn('[TrueVision3D LayoutEditor] Gradient config unavailable - the built-in defaults will be used.', error);
                }
                return Na__LeGrad__Config;
            })();
        }
        return Na__LeGrad__LoadPromise;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Block of the Config, or an Empty One
    // ------------------------------------------------------------
    function Na__LeGrad__Block(name) {
        const block = Na__LeGrad__Config ? Na__LeGrad__Config['LayoutEditor__GradientTool__' + name] : null;
        return (block && typeof block === 'object') ? block : {};
    }
    // ------------------------------------------------------------


    // FUNCTION | The Defaults a New Gradient Starts From
    // ------------------------------------------------------------
    function Na__LeGrad__Defaults() {
        const block = Na__LeGrad__Block('Defaults');
        const f     = Na__LeGrad__FALLBACK_DEFAULTS;
        const hex   = (key, fallback) => (Na__LeGrad__HEX.test(String(block[key])) ? block[key] : fallback);
        const num   = (key, fallback) => (Number.isFinite(block[key]) ? block[key] : fallback);
        const flag  = (key, fallback) => (typeof block[key] === 'boolean' ? block[key] : fallback);
        return {
            on          : flag('Defaults__On', f.on),
            startColour : hex('Defaults__StartColour', f.startColour),
            startAlpha  : flag('Defaults__StartAlpha', f.startAlpha),
            endColour   : hex('Defaults__EndColour', f.endColour),
            endAlpha    : flag('Defaults__EndAlpha', f.endAlpha),
            blendPct    : num('Defaults__BlendPct', f.blendPct),
            angleDeg    : num('Defaults__AngleDeg', f.angleDeg)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Rendering Sample Counts
    // ------------------------------------------------------------
    function Na__LeGrad__Rendering() {
        const block = Na__LeGrad__Block('Rendering');
        const f     = Na__LeGrad__FALLBACK_RENDERING;
        const whole = (key, fallback, min) => (Number.isFinite(block[key]) ? Math.max(min, Math.round(block[key])) : fallback);
        return {
            curveStops      : whole('Rendering__CurveStops', f.curveStops, 2),
            pdfSamplesPerMm : Number.isFinite(block['Rendering__PdfSamplesPerMm']) && block['Rendering__PdfSamplesPerMm'] > 0 ? block['Rendering__PdfSamplesPerMm'] : f.pdfSamplesPerMm,
            pdfMinSamples   : whole('Rendering__PdfMinSamples', f.pdfMinSamples, 2),
            pdfMaxSamples   : whole('Rendering__PdfMaxSamples', f.pdfMaxSamples, 2)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | A Panel Label
    // ------------------------------------------------------------
    function Na__LeGrad__Label(key, fallback) {
        const value = Na__LeGrad__Block('Labels')['Labels__' + key];
        return (typeof value === 'string') ? value : fallback;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Record
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Clamp and Round
    // ------------------------------------------------------------
    function Na__LeGrad__Clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
    function Na__LeGrad__Round(value, places) { const k = Math.pow(10, places); return Math.round(value * k) / k; }
    // ------------------------------------------------------------


    // HELPER FUNCTION | An Angle Brought Into 0 to 360 (360 itself is kept, as the slider's far end)
    // ------------------------------------------------------------
    function Na__LeGrad__WrapAngle(value, fallback) {
        if (!Number.isFinite(value)) return fallback;
        const angle = (value < 0 || value > 360) ? (((value % 360) + 360) % 360) : value;
        return Na__LeGrad__Round(angle, 1);
    }
    // ------------------------------------------------------------


    // FUNCTION | A Gradient Record Made Whole (always a new object; null for none)
    // ------------------------------------------------------------
    // Anything missing or malformed takes the default. Alpha at BOTH ends would
    // paint nothing at all, so the end is put back to its colour - the same
    // rule that stops a shape losing its edges and its fill together.
    // ------------------------------------------------------------
    function Na__LeGrad__Normalise(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const d       = Na__LeGrad__Defaults();
        const colour  = (value, fallback) => (Na__LeGrad__HEX.test(String(value)) ? value : fallback);
        const opacity = (value, fallback) => (Number.isFinite(value) ? Na__LeGrad__Clamp(value, 0, 1) : fallback);
        const out = {
            Gradient__StartColour  : colour(raw.Gradient__StartColour, d.startColour),
            Gradient__StartOpacity : opacity(raw.Gradient__StartOpacity, d.startAlpha ? 0 : 1),
            Gradient__EndColour    : colour(raw.Gradient__EndColour, d.endColour),
            Gradient__EndOpacity   : opacity(raw.Gradient__EndOpacity, d.endAlpha ? 0 : 1),
            Gradient__BlendPct     : Number.isFinite(raw.Gradient__BlendPct) ? Na__LeGrad__Round(Na__LeGrad__Clamp(raw.Gradient__BlendPct, 0, 100), 1) : d.blendPct,
            Gradient__AngleDeg     : Na__LeGrad__WrapAngle(raw.Gradient__AngleDeg, Na__LeGrad__WrapAngle(d.angleDeg, 0))
        };
        if (out.Gradient__StartOpacity <= 0 && out.Gradient__EndOpacity <= 0) out.Gradient__EndOpacity = 1;   // <-- Alpha to alpha is nothing to see
        return out;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Fresh Gradient at the Defaults
    // ------------------------------------------------------------
    function Na__LeGrad__Create() { return Na__LeGrad__Normalise({}); }
    // ------------------------------------------------------------


    // FUNCTION | The Same Gradient With Some Values Changed (a new object)
    // ------------------------------------------------------------
    function Na__LeGrad__With(gradient, patch) {
        return Na__LeGrad__Normalise(Object.assign({}, Na__LeGrad__Normalise(gradient) || Na__LeGrad__Create(), patch || {}));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Colour
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Hex to Channels
    // ------------------------------------------------------------
    function Na__LeGrad__Rgb(hex) {
        const value = Na__LeGrad__HEX.test(String(hex)) ? String(hex).slice(1) : 'ffffff';
        return { r : parseInt(value.substring(0, 2), 16), g : parseInt(value.substring(2, 4), 16), b : parseInt(value.substring(4, 6), 16) };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Channels to Hex
    // ------------------------------------------------------------
    function Na__LeGrad__Hex(colour) {
        const two = (v) => Na__LeGrad__Clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
        return '#' + two(colour.r) + two(colour.g) + two(colour.b);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Blend Curve's Exponent (1 is a straight fade)
    // ------------------------------------------------------------
    // The end colour's weight at a fraction t of the way along is t ^ exponent,
    // chosen so the weight is exactly one half at the blend point. The blend is
    // held off the very ends because the curve has no finite form at 0 or 100.
    // ------------------------------------------------------------
    function Na__LeGrad__Exponent(gradient) {
        const h = Na__LeGrad__Clamp(gradient.Gradient__BlendPct / 100, 0.01, 0.99);
        return Math.log(0.5) / Math.log(h);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Colour at a Given Weight of the End Colour (premultiplied mix)
    // ------------------------------------------------------------
    // Returns { r, g, b, a } with channels 0..255 and alpha 0..1. The channels
    // are mixed weighted by their own opacity, so a transparent end contributes
    // no colour at all and the colour it shows is the solid end's. Where the
    // result is wholly transparent the solid end's colour is still returned, so
    // a painter that interpolates between stops never drifts through black.
    // ------------------------------------------------------------
    function Na__LeGrad__Mix(gradient, weight) {
        const w  = Na__LeGrad__Clamp(weight, 0, 1);
        const c0 = Na__LeGrad__Rgb(gradient.Gradient__StartColour), a0 = gradient.Gradient__StartOpacity;
        const c1 = Na__LeGrad__Rgb(gradient.Gradient__EndColour),   a1 = gradient.Gradient__EndOpacity;
        const a  = a0 + ((a1 - a0) * w);
        if (a <= 1e-6) { const solid = (a1 >= a0) ? c1 : c0; return { r : solid.r, g : solid.g, b : solid.b, a : 0 }; }
        const channel = (k) => ((c0[k] * a0 * (1 - w)) + (c1[k] * a1 * w)) / a;
        return { r : channel('r'), g : channel('g'), b : channel('b'), a : a };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Colour a Fraction of the Way Along (0 at the start, 1 at the end)
    // ------------------------------------------------------------
    function Na__LeGrad__ColourAt(gradient, t) {
        const along = Na__LeGrad__Clamp(t, 0, 1);
        return Na__LeGrad__Mix(gradient, Math.pow(along, Na__LeGrad__Exponent(gradient)));
    }
    // ------------------------------------------------------------


    // FUNCTION | The Gradient Written Out as Stops (offset 0..1 and a colour)
    // ------------------------------------------------------------
    // SVG and CSS stops interpolate in a straight line between each other, so
    // an uneven blend is written out as many stops. They are spaced in EQUAL
    // STEPS OF COLOUR rather than equal steps of distance: where the curve is
    // steep the stops crowd together and where it is flat they spread out, so
    // every straight segment between two stops is as small a change as the
    // count allows. A straight fade between two ends that mix in a straight
    // line anyway - both solid, or one of them alpha - needs only its two ends.
    // ------------------------------------------------------------
    function Na__LeGrad__Stops(gradient) {
        const exponent = Na__LeGrad__Exponent(gradient);
        const a0 = gradient.Gradient__StartOpacity, a1 = gradient.Gradient__EndOpacity;
        const straight = Math.abs(exponent - 1) < 1e-9 && (a0 === a1 || a0 <= 0 || a1 <= 0);
        const count    = straight ? 1 : Na__LeGrad__Rendering().curveStops;
        const stops    = [];
        for (let k = 0; k <= count; k++) {
            const weight = k / count;
            const offset = Math.abs(exponent - 1) < 1e-9 ? weight : Math.pow(weight, 1 / exponent);
            stops.push({ offset : offset, colour : Na__LeGrad__Mix(gradient, weight) });
        }
        return stops;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Geometry
// -----------------------------------------------------------------------------

    // FUNCTION | The Gradient's Axis Across a Shape
    // ------------------------------------------------------------
    // points: [[x, y], ...] paper millimetres, y down. Returns { u, v, aMin,
    // aMax, bMin, bMax }: u is the direction of travel on the paper, v is u
    // turned a quarter anticlockwise, and a and b are the points measured along
    // each. The start colour belongs at aMin and the end colour at aMax.
    //
    // null when there is nothing to fill - fewer than three points, or a run
    // with no extent along the direction or across it - so every painter can
    // simply skip it.
    // ------------------------------------------------------------
    function Na__LeGrad__Axis(points, angleDeg) {
        if (!Array.isArray(points) || points.length < 3) return null;
        const r = angleDeg * Math.PI / 180;
        const u = { x : Math.cos(r),  y : -Math.sin(r) };                   // <-- The paper's y runs down, so anticlockwise climbs towards negative y
        const v = { x : -Math.sin(r), y : -Math.cos(r) };
        let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
        points.forEach((p) => {
            const a = (p[0] * u.x) + (p[1] * u.y);
            const b = (p[0] * v.x) + (p[1] * v.y);
            aMin = Math.min(aMin, a); aMax = Math.max(aMax, a);
            bMin = Math.min(bMin, b); bMax = Math.max(bMax, b);
        });
        if (!(aMax - aMin > 1e-6) || !(bMax - bMin > 1e-6)) return null;
        return { u : u, v : v, aMin : aMin, aMax : aMax, bMin : bMin, bMax : bMax };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Painters
// -----------------------------------------------------------------------------

    // FUNCTION | An SVG Paint for a Shape: { defs, fill }, or null
    // ------------------------------------------------------------
    // defs is a <linearGradient> in paper millimetres and fill is the url()
    // naming it. The units are userSpaceOnUse on purpose: SVG's default
    // bounding-box units squash the gradient to the box, so any shape that is
    // not square would show a different angle from the one that was set.
    // ------------------------------------------------------------
    function Na__LeGrad__SvgPaint(points, gradient) {
        const g    = Na__LeGrad__Normalise(gradient);
        const axis = g ? Na__LeGrad__Axis(points, g.Gradient__AngleDeg) : null;
        if (!axis) return null;
        const R   = (value) => Na__LeGrad__Round(value, 4);
        const mid = (axis.bMin + axis.bMax) / 2;
        const x1  = (axis.aMin * axis.u.x) + (mid * axis.v.x), y1 = (axis.aMin * axis.u.y) + (mid * axis.v.y);
        const x2  = (axis.aMax * axis.u.x) + (mid * axis.v.x), y2 = (axis.aMax * axis.u.y) + (mid * axis.v.y);
        const id  = 'naLeGrad' + (++Na__LeGrad__IdCounter);
        const stops = Na__LeGrad__Stops(g).map((s) =>
            '<stop offset="' + R(s.offset) + '" stop-color="' + Na__LeGrad__Hex(s.colour) + '" stop-opacity="' + R(s.colour.a) + '"/>'
        ).join('');
        return {
            defs : '<defs><linearGradient id="' + id + '" gradientUnits="userSpaceOnUse" x1="' + R(x1) + '" y1="' + R(y1) +
                   '" x2="' + R(x2) + '" y2="' + R(y2) + '">' + stops + '</linearGradient></defs>',
            fill : 'url(#' + id + ')'
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The PDF Strip: Samples Along the Direction, Encoded as a PNG
    // ------------------------------------------------------------
    // Two identical rows rather than one, so no viewer can mistake the whole
    // strip for an image edge when it smooths it. Each column is the exact
    // colour curve at that column's centre; columns in the overshoot past either
    // end hold the end colours.
    // ------------------------------------------------------------
    function Na__LeGrad__StripPng(gradient, axis, aStart, aLen) {
        const setup   = Na__LeGrad__Rendering();
        const span    = axis.aMax - axis.aMin;
        const width   = Na__LeGrad__Clamp(Math.ceil(aLen * setup.pdfSamplesPerMm), setup.pdfMinSamples, Math.max(setup.pdfMinSamples, setup.pdfMaxSamples));
        const rows    = 2;
        const canvas  = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = rows;
        const context = canvas.getContext('2d');
        if (!context) return null;
        const image = context.createImageData(width, rows);
        for (let i = 0; i < width; i++) {
            const along  = aStart + (((i + 0.5) / width) * aLen);
            const colour = Na__LeGrad__ColourAt(gradient, (along - axis.aMin) / span);
            for (let row = 0; row < rows; row++) {
                const k = ((row * width) + i) * 4;
                image.data[k]     = Math.round(colour.r);
                image.data[k + 1] = Math.round(colour.g);
                image.data[k + 2] = Math.round(colour.b);
                image.data[k + 3] = Math.round(colour.a * 255);
            }
        }
        context.putImageData(image, 0, 0);
        return canvas.toDataURL('image/png');
    }
    // ------------------------------------------------------------


    // FUNCTION | Draw a Shape's Gradient Into jsPDF, Clipped to Its Outline
    // ------------------------------------------------------------
    // Returns true when something was drawn. The caller paints any solid fill
    // before this and the edges after it, so the edges always sit on top.
    //
    // jsPDF turns an image about its lower-left corner, anticlockwise - the
    // gradient's own convention - so the strip is laid out in the gradient's
    // frame: its length along u from the start colour, its height along v. The
    // corner handed to jsPDF is where the strip starts along u and sits lowest
    // along v, and that single point plus the angle places the whole strip.
    //
    // holes is optional: where each hole of a holed shape begins in `points`
    // (Na__LayoutEditor__ShapeRings__). Given, every ring is traced into the
    // clip and it is taken even-odd, so the gradient stops at every hole as
    // the screen's does.
    // ------------------------------------------------------------
    function Na__LeGrad__DrawPdf(doc, points, gradient, holes) {
        const g    = Na__LeGrad__Normalise(gradient);
        const axis = g ? Na__LeGrad__Axis(points, g.Gradient__AngleDeg) : null;
        if (!doc || !axis) return false;
        const padA   = ((axis.aMax - axis.aMin) * 0.02) + 1;               // <-- Overshoot on every side, clipped back to the outline
        const padB   = ((axis.bMax - axis.bMin) * 0.02) + 1;
        const aStart = axis.aMin - padA, aLen = (axis.aMax - axis.aMin) + (padA * 2);
        const bStart = axis.bMin - padB, bLen = (axis.bMax - axis.bMin) + (padB * 2);
        const png    = Na__LeGrad__StripPng(g, axis, aStart, aLen);
        if (!png) return false;
        const cornerX = (aStart * axis.u.x) + (bStart * axis.v.x);
        const cornerY = (aStart * axis.u.y) + (bStart * axis.v.y);
        const holed   = Array.isArray(holes) && holes.length > 0;
        const rings   = holed ? Na__LeRings__Spans(points.length, holes).map((span) => points.slice(span[0], span[1])) : [ points ];
        doc.saveGraphicsState();
        try {
            rings.forEach((ring) => {                                           // <-- Paths with no paint operator: together they become the clip
                const rel = [];
                for (let i = 1; i < ring.length; i++) rel.push([ ring[i][0] - ring[i - 1][0], ring[i][1] - ring[i - 1][1] ]);
                doc.lines(rel, ring[0][0], ring[0][1], [ 1, 1 ], null, true);
            });
            if (holed) doc.clip('evenodd'); else doc.clip();
            doc.discardPath();
            doc.addImage(png, 'PNG', cornerX, cornerY - bLen, aLen, bLen, undefined, undefined, g.Gradient__AngleDeg);
        } finally {
            doc.restoreGraphicsState();                                     // <-- Always: a clip left open would crop everything drawn after it
        }
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Gradient as a CSS Background (the panel's preview swatch)
    // ------------------------------------------------------------
    // The same stops the paper is painted with. CSS measures its angle from the
    // top and clockwise, so this module's 0 (left to right) is CSS's 90deg.
    // ------------------------------------------------------------
    function Na__LeGrad__PreviewCss(gradient) {
        const g     = Na__LeGrad__Normalise(gradient) || Na__LeGrad__Create();
        const stops = Na__LeGrad__Stops(g).map((s) => 'rgba(' + Math.round(s.colour.r) + ', ' + Math.round(s.colour.g) + ', ' +
            Math.round(s.colour.b) + ', ' + Na__LeGrad__Round(s.colour.a, 3) + ') ' + Na__LeGrad__Round(s.offset * 100, 2) + '%');
        return 'linear-gradient(' + Na__LeGrad__Round(90 - g.Gradient__AngleDeg, 1) + 'deg, ' + stops.join(', ') + ')';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Vectors Panel Rows
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Row That Holds More Than One Control
    // ------------------------------------------------------------
    // The panel host's own row is a <label>, and a label hands a click on its
    // caption to its FIRST control - so in a row holding a colour well and an
    // Alpha tick, clicking the word Alpha would open the colour picker. Rows
    // with several controls are plain divs instead, and the Alpha word gets a
    // label of its own wrapped around just its tick box.
    // ------------------------------------------------------------
    function Na__LeGrad__Cluster(labelText, children, className) {
        const row = document.createElement('div');
        row.className = 'na-le-row' + (className ? ' ' + className : '');
        const caption = document.createElement('span');
        caption.className   = 'na-le-row__label';
        caption.textContent = labelText;
        row.appendChild(caption);
        children.forEach((child) => row.appendChild(child));
        return row;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One End: a Colour Well and an Alpha Tick
    // ------------------------------------------------------------
    function Na__LeGrad__StopRow(labelText, colourControl, alphaControl, stopName) {
        const colour = Na__LePanels__Input('color', colourControl);
        const wrap   = document.createElement('label');
        wrap.className = 'na-le-grad-alpha';
        wrap.title     = Na__LeGrad__Label('AlphaTitle', 'Transparent at this end, so whatever is underneath shows through. Only one end can be alpha.');
        const tick = Na__LePanels__Input('checkbox', alphaControl);
        const word = document.createElement('span');
        word.textContent = Na__LeGrad__Label('Alpha', 'Alpha');
        wrap.appendChild(tick);
        wrap.appendChild(word);
        const row = Na__LeGrad__Cluster(labelText, [ colour, wrap ], 'na-le-grad-stop');
        row.setAttribute('data-na-stop', stopName);
        return row;
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Gradient Rows Into the Vectors Panel
    // ------------------------------------------------------------
    // The toggle row, then one block holding every setting, hidden as a whole
    // while the gradient is off - the same way the fill colour row goes away
    // while there is no fill. Explanations are tooltips, not notes, so the
    // block costs no more height than its controls.
    // ------------------------------------------------------------
    function Na__LeGrad__BuildRows(body) {
        const C = Na__LeGrad__CONTROLS;
        const toggle = Na__LePanels__Row(Na__LeGrad__Label('Gradient', 'Gradient'), Na__LePanels__Input('checkbox', C.toggle));
        toggle.title = Na__LeGrad__Label('GradientTitle', 'A linear gradient fill. It replaces the solid fill while it is on.');
        body.appendChild(toggle);

        const block = document.createElement('div');
        block.className = 'na-le-block na-le-grad';
        block.setAttribute('data-na-block', Na__LeGrad__BLOCK);
        block.appendChild(Na__LeGrad__StopRow(Na__LeGrad__Label('Start', 'Start'), C.start, C.startAlpha, 'start'));
        block.appendChild(Na__LeGrad__StopRow(Na__LeGrad__Label('End', 'End'), C.end, C.endAlpha, 'end'));

        const blend = Na__LePanels__Input('range', C.blend, { min : 0, max : 100, step : 1 });
        blend.classList.add('na-le-input--range');
        const readout = document.createElement('span');
        readout.className = 'na-le-grad-readout';
        readout.setAttribute('data-na-readout', 'blend');
        const blendRow = Na__LeGrad__Cluster(Na__LeGrad__Label('Blend', 'Blend'), [ blend, readout ]);
        blendRow.title = Na__LeGrad__Label('BlendTitle', 'Where the two ends meet half and half along the direction. 50% is an even fade.');
        block.appendChild(blendRow);

        const angleRange = Na__LePanels__Input('range', C.angleRange, { min : 0, max : 360, step : 1 });
        angleRange.classList.add('na-le-input--range');
        const angle = Na__LePanels__Input('number', C.angle, { min : 0, max : 360, step : 1 });
        angle.classList.add('na-le-grad-angle');
        const preview = document.createElement('span');
        preview.className = 'na-le-grad-preview';
        preview.setAttribute('data-na-preview', '');
        preview.title = Na__LeGrad__Label('PreviewTitle', 'Preview over a checkerboard, which shows where the gradient is transparent.');
        const angleRow = Na__LeGrad__Cluster(Na__LeGrad__Label('Direction', 'Direction'), [ angleRange, angle, preview ]);
        angleRow.title = Na__LeGrad__Label('DirectionTitle', 'Degrees anticlockwise: 0 left to right, 90 bottom to top, 180 right to left, 270 top to bottom.');
        block.appendChild(angleRow);
        body.appendChild(block);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show One Gradient's Values in the Block
    // ------------------------------------------------------------
    // A control that has focus is left alone, so a slider mid-drag is never
    // pulled back under the pointer by a refresh; its partner (the number box
    // beside the direction slider, the percentage beside the blend) still
    // follows, and so does the preview.
    // ------------------------------------------------------------
    function Na__LeGrad__Show(block, gradient) {
        const C   = Na__LeGrad__CONTROLS;
        const g   = Na__LeGrad__Normalise(gradient) || Na__LeGrad__Create();
        const el  = (name) => block.querySelector('[data-na-control="' + name + '"]');
        const set = (name, value) => { const e = el(name); if (e && document.activeElement !== e) e.value = String(value); };
        const startAlpha = g.Gradient__StartOpacity <= 0;
        const endAlpha   = g.Gradient__EndOpacity <= 0;
        set(C.start, g.Gradient__StartColour);
        set(C.end, g.Gradient__EndColour);
        set(C.blend, Math.round(g.Gradient__BlendPct));
        set(C.angleRange, Math.round(g.Gradient__AngleDeg));
        set(C.angle, g.Gradient__AngleDeg);
        el(C.startAlpha).checked = startAlpha;
        el(C.endAlpha).checked   = endAlpha;
        block.querySelector('[data-na-stop="start"]').classList.toggle('is-alpha', startAlpha);   // <-- An alpha end has no colour to pick
        block.querySelector('[data-na-stop="end"]').classList.toggle('is-alpha', endAlpha);
        block.querySelector('[data-na-readout="blend"]').textContent = Math.round(g.Gradient__BlendPct) + '%';
        block.querySelector('[data-na-preview]').style.backgroundImage = Na__LeGrad__PreviewCss(g) + ', ' + Na__LeGrad__CHECKER;
    }
    // ------------------------------------------------------------


    // FUNCTION | Reflect the Selected Shape or the Defaults
    // ------------------------------------------------------------
    // state: { canFill, on, gradient }. canFill false (a two-point line) hides
    // the toggle as well, exactly as the Fill toggle is hidden.
    // ------------------------------------------------------------
    function Na__LeGrad__RefreshRows(body, state) {
        const s      = state || {};
        const toggle = body.querySelector('[data-na-control="' + Na__LeGrad__CONTROLS.toggle + '"]');
        const block  = body.querySelector('[data-na-block="' + Na__LeGrad__BLOCK + '"]');
        if (!toggle || !block) return;
        toggle.checked           = s.on === true;
        toggle.parentNode.hidden = s.canFill === false;
        block.hidden             = !(s.on === true && s.canFill !== false);
        if (!block.hidden) Na__LeGrad__Show(block, s.gradient);
    }
    // ------------------------------------------------------------


    // FUNCTION | Wire the Gradient Controls
    // ------------------------------------------------------------
    // host: {
    //   read()               -> { on, gradient }   the selected shape's, or the defaults
    //   toggle(on, gradient)                        the Vectors panel applies its fill and edge rules
    //   write(gradient, live)                       live: a silent redraw while a slider moves
    // }
    // The sliders write live on every input event and announce once on
    // release, so dragging the blend from end to end is one undo step. The
    // block is updated from the new gradient straight away rather than waiting
    // for the model to announce, which it deliberately does not do mid-drag.
    // ------------------------------------------------------------
    function Na__LeGrad__RegisterControls(host) {
        const C       = Na__LeGrad__CONTROLS;
        const current = () => Na__LeGrad__Normalise(host.read().gradient) || Na__LeGrad__Create();
        const commit  = (el, patch, live) => {
            const next  = Na__LeGrad__With(current(), patch);
            const block = el.closest('[data-na-block="' + Na__LeGrad__BLOCK + '"]');
            if (block) Na__LeGrad__Show(block, next);
            host.write(next, live === true);
        };
        const numeric = (field, live) => (e, el) => {
            const value = parseFloat(el.value);
            if (Number.isFinite(value)) commit(el, { [field] : value }, live);
        };
        Na__LePanels__OnControl('change', C.toggle, (e, el) => host.toggle(el.checked, current()));
        Na__LePanels__OnControl('change', C.start,  (e, el) => commit(el, { Gradient__StartColour : el.value }));
        Na__LePanels__OnControl('change', C.end,    (e, el) => commit(el, { Gradient__EndColour : el.value }));
        Na__LePanels__OnControl('change', C.startAlpha, (e, el) => {
            const patch = { Gradient__StartOpacity : el.checked ? 0 : 1 };
            if (el.checked) patch.Gradient__EndOpacity = 1;                 // <-- Only one end can be alpha: this one takes it, the other gets its colour back
            commit(el, patch);
        });
        Na__LePanels__OnControl('change', C.endAlpha, (e, el) => {
            const patch = { Gradient__EndOpacity : el.checked ? 0 : 1 };
            if (el.checked) patch.Gradient__StartOpacity = 1;
            commit(el, patch);
        });
        Na__LePanels__OnControl('input',  C.blend,      numeric('Gradient__BlendPct', true));
        Na__LePanels__OnControl('change', C.blend,      numeric('Gradient__BlendPct', false));
        Na__LePanels__OnControl('input',  C.angleRange, numeric('Gradient__AngleDeg', true));
        Na__LePanels__OnControl('change', C.angleRange, numeric('Gradient__AngleDeg', false));
        Na__LePanels__OnControl('change', C.angle,      numeric('Gradient__AngleDeg', false));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Gradient Tool API
    // ------------------------------------------------------------
    export {
        Na__LeGrad__FIELD,
        Na__LeGrad__Ready,
        Na__LeGrad__Defaults,
        Na__LeGrad__Label,
        Na__LeGrad__Normalise,
        Na__LeGrad__Create,
        Na__LeGrad__With,
        Na__LeGrad__ColourAt,
        Na__LeGrad__Stops,
        Na__LeGrad__Axis,
        Na__LeGrad__SvgPaint,
        Na__LeGrad__DrawPdf,
        Na__LeGrad__PreviewCss,
        Na__LeGrad__BuildRows,
        Na__LeGrad__RefreshRows,
        Na__LeGrad__RegisterControls
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
