// =============================================================================
// TRUEVISION3D - ELEVATION DEPTH FOG - MATHS
// =============================================================================
//
// FILE       : Na__ElevationDepthFog__Maths__.js
// NAMESPACE  : Na__ElevFogMath
// MODULE     : Elevation Depth Fog - Maths
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Everything about the fog that is a number rather than a pixel - the block, the curve, the plane, the depth solve
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - IMPORTS NOTHING, so it runs in Node exactly as the app runs it and the
//   test beside it proves the real thing rather than a copy.
//
// - THE BLOCK IS FOUR VALUES AND ITS KEYS CARRY ITS OWN PREFIX, NOT A
//   RECORD'S. An elevation holds it as Elevation__DepthFog, a floor plan will
//   hold it as FloorPlan__DepthFog, and inside either it reads the same:
//
//       DepthFog__Enabled          off until its author asks for it
//       DepthFog__StartDepthMm     where the fog begins, BEHIND the plane
//       DepthFog__EndDepthMm       where it is full, from the SAME plane
//       DepthFog__FalloffPercent   how hard it comes on, 0 to 100
//
//   That is Elevation__Styles' own pattern (Styles__*), and it is what lets one
//   module serve three kinds of drawing without knowing which it is on.
//
// - DEPTH IS MEASURED BEHIND A PLANE, NOT FROM A CAMERA. A drawing plane is a
//   unit normal pointing from the building toward the viewer and a distance
//   along it. A world point P lies (distance - P.n) behind the plane: positive
//   is into the building, zero is on the plane, negative is on the viewer's
//   side, where no fog ever falls. Where the camera happens to stand - a
//   hundred and fifty metres back, so that nothing clips - never enters it.
//
// - FALL-OFF IS THE FOG'S DENSITY HALF WAY ALONG THE BAND. Typing 50 gives an
//   even fade: half way between Depth and End the drawing is half fogged.
//   Typing 80 has it 80% fogged by half way - it comes on hard and the whole
//   band reads denser. Typing 20 holds it off until late. The curve is
//   Schlick's bias: one division, monotonic, finite slope at both ends, and
//   bias(1/2, b) = b exactly, which is what makes the number mean something
//   an author can predict. 0 and 100 are its two limits - a wall at End and a
//   wall at Depth - and are reached by clamping just inside them rather than
//   by dividing by zero.
//
// - THE DEPTH SOLVE IS FOUR SAMPLES. Under a parallel projection a pixel's
//   distance behind the plane is AFFINE in its screen position and its stored
//   depth: a + b.u + c.v + d.s. Unprojecting the four corners of that little
//   simplex through the camera's own inverse matrices gives the four numbers,
//   whatever the camera's zoom, its tile's view offset or its anti-aliasing
//   jitter - all of which are already in those matrices. A fifth sample checks
//   the fit: a perspective camera fails it, and gets no fog rather than wrong
//   fog.
//
// INTEGRATION:
// - Na__ElevationDepthFog__RecordData__ normalises records through here.
// - Na__ElevationDepthFog__RenderLayer__ solves the depth and reads the curve.
// - Na__ElevationDepthFog__DevMenu__Row__ words its readout from here.
// - 80__Testing__PrototypeEnvironment/Na__Test__ElevationDepthFog__.test.mjs
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (20-Sep-2026)
// - ValeVision    : not yet ported.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation for the Elevation Depth Fog build.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Block's Own Keys
    // ------------------------------------------------------------
    // The same four on every kind of drawing record. Never renamed: saved
    // projects hold them.
    // ------------------------------------------------------------
    const Na__ElevFogMath__KEY_ENABLED = 'DepthFog__Enabled';
    const Na__ElevFogMath__KEY_START   = 'DepthFog__StartDepthMm';
    const Na__ElevFogMath__KEY_END     = 'DepthFog__EndDepthMm';
    const Na__ElevFogMath__KEY_FALLOFF = 'DepthFog__FalloffPercent';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | What Holds When Nothing Is Handed In
    // ------------------------------------------------------------
    // Mirrors Na__ElevationDepthFog__AppConfig__.json. The config state hands
    // the live values in; these are for a caller with none, which in practice
    // is the test.
    // ------------------------------------------------------------
    const Na__ElevFogMath__DEFAULTS = Object.freeze({
        enabled        : false,
        startDepthMm   : 1000,
        endDepthMm     : 15000,
        falloffPercent : 50
    });
    const Na__ElevFogMath__LIMITS = Object.freeze({
        maxDepthMm         : 200000,
        minBandMm          : 100,
        falloffEdgePercent : 0.5
    });
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Tolerances
    // ------------------------------------------------------------
    const Na__ElevFogMath__AFFINE_TOLERANCE = 1e-4;   // <-- Scene units. A parallel camera fits to rounding; a perspective one misses by metres
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Block
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Hold a Number Between Two Others
    // ------------------------------------------------------------
    function Na__ElevFogMath__Clamp(value, low, high) {
        return Math.min(high, Math.max(low, value));
    }
    // ------------------------------------------------------------


    // FUNCTION | Read a Stored Block as Four Settled Values
    // ------------------------------------------------------------
    // block is whatever the record holds - a full block, half of one, a
    // string, nothing. What comes back is always usable:
    //
    //   enabled        only an explicit true. A stray 1 or "yes" is off, so a
    //                  hand-edited file can never fog a drawing by accident.
    //   startDepthMm   whole millimetres, from the plane to the far limit less
    //                  the least band.
    //   endDepthMm     whole millimetres, AT LEAST the least band beyond the
    //                  start. The two may be typed in either order; End is
    //                  the one that gives way, because Depth is the number the
    //                  author places against the building.
    //   falloffPercent 0 to 100. Not rounded: 12.5 is a fair thing to type.
    //
    // defaults and limits are the config's; both may be left out.
    // ------------------------------------------------------------
    function Na__ElevFogMath__NormaliseSettings(block, defaults, limits) {
        const stored = (block && typeof block === 'object' && !Array.isArray(block)) ? block : {};
        const base   = Object.assign({}, Na__ElevFogMath__DEFAULTS, defaults || {});
        const range  = Object.assign({}, Na__ElevFogMath__LIMITS, limits || {});

        const maxDepth = (Number.isFinite(range.maxDepthMm) && range.maxDepthMm > 0) ? range.maxDepthMm : Na__ElevFogMath__LIMITS.maxDepthMm;
        const minBand  = Na__ElevFogMath__Clamp(
            (Number.isFinite(range.minBandMm) && range.minBandMm > 0) ? range.minBandMm : Na__ElevFogMath__LIMITS.minBandMm,
            1, maxDepth
        );

        const rawStart   = Number.isFinite(stored[Na__ElevFogMath__KEY_START])   ? stored[Na__ElevFogMath__KEY_START]   : base.startDepthMm;
        const rawEnd     = Number.isFinite(stored[Na__ElevFogMath__KEY_END])     ? stored[Na__ElevFogMath__KEY_END]     : base.endDepthMm;
        const rawFalloff = Number.isFinite(stored[Na__ElevFogMath__KEY_FALLOFF]) ? stored[Na__ElevFogMath__KEY_FALLOFF] : base.falloffPercent;

        const startDepthMm = Math.round(Na__ElevFogMath__Clamp(rawStart, 0, maxDepth - minBand));
        const endDepthMm   = Math.round(Na__ElevFogMath__Clamp(rawEnd, startDepthMm + minBand, maxDepth));

        return {
            enabled        : stored[Na__ElevFogMath__KEY_ENABLED] === true,
            startDepthMm   : startDepthMm,
            endDepthMm     : endDepthMm,
            falloffPercent : Na__ElevFogMath__Clamp(rawFalloff, 0, 100)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Write Four Settled Values Into a Block, in Place
    // ------------------------------------------------------------
    // The SAME object is kept where there is one, because a record's block may
    // be held by whoever read it last. Key order is fixed so a saved file
    // reads the same whoever wrote it.
    // ------------------------------------------------------------
    function Na__ElevFogMath__WriteBlock(block, settings) {
        const target = (block && typeof block === 'object' && !Array.isArray(block)) ? block : {};
        target[Na__ElevFogMath__KEY_ENABLED] = settings.enabled === true;
        target[Na__ElevFogMath__KEY_START]   = settings.startDepthMm;
        target[Na__ElevFogMath__KEY_END]     = settings.endDepthMm;
        target[Na__ElevFogMath__KEY_FALLOFF] = settings.falloffPercent;
        return target;
    }
    // ------------------------------------------------------------


    // FUNCTION | Does a Stored Block Already Say Exactly This?
    // ------------------------------------------------------------
    // What lets a read leave a settled record alone. A record that is rewritten
    // on every read is a record that looks edited to anything watching it.
    // ------------------------------------------------------------
    function Na__ElevFogMath__BlockMatches(block, settings) {
        if (!block || typeof block !== 'object' || Array.isArray(block)) return false;
        return block[Na__ElevFogMath__KEY_ENABLED] === (settings.enabled === true)
            && block[Na__ElevFogMath__KEY_START]   === settings.startDepthMm
            && block[Na__ElevFogMath__KEY_END]     === settings.endDepthMm
            && block[Na__ElevFogMath__KEY_FALLOFF] === settings.falloffPercent;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Curve
// -----------------------------------------------------------------------------

    // FUNCTION | Turn a Typed Fall-Off Into the Curve's Own Number
    // ------------------------------------------------------------
    // 0-100 becomes 0-1, held just inside both ends. At exactly 0 or 1 the
    // curve is a step and its formula a division by zero; half a percent in,
    // it is the same wall to the eye and an ordinary number to the GPU.
    // ------------------------------------------------------------
    function Na__ElevFogMath__FalloffToBias(falloffPercent, edgePercent) {
        const edge = (Number.isFinite(edgePercent) && edgePercent > 0 && edgePercent < 50)
            ? edgePercent
            : Na__ElevFogMath__LIMITS.falloffEdgePercent;
        const percent = Number.isFinite(falloffPercent) ? falloffPercent : Na__ElevFogMath__DEFAULTS.falloffPercent;
        return Na__ElevFogMath__Clamp(percent, edge, 100 - edge) / 100;
    }
    // ------------------------------------------------------------


    // FUNCTION | Schlick's Bias: Where Along the Fade a Point Has Got To
    // ------------------------------------------------------------
    // t is how far through the band (0 at Depth, 1 at End); bias is the
    // fall-off as 0-1. bias(1/2, b) = b, bias(t, 1/2) = t. THE SHADER CARRIES
    // THIS LINE VERBATIM - change one and the screen disagrees with the test.
    // ------------------------------------------------------------
    function Na__ElevFogMath__Bias(t, bias) {
        const along = Na__ElevFogMath__Clamp(t, 0, 1);
        return along / ((((1 / bias) - 2) * (1 - along)) + 1);
    }
    // ------------------------------------------------------------


    // FUNCTION | How Fogged Is Something This Far Behind the Plane?
    // ------------------------------------------------------------
    // 0 to maxOpacity. Nothing in front of Depth is touched - and so nothing in
    // front of the plane either, since Depth is never negative. Everything
    // past End is at the ceiling.
    // ------------------------------------------------------------
    function Na__ElevFogMath__DensityAtDepth(depthBehindMm, settings, edgePercent, maxOpacity) {
        if (!settings || !Number.isFinite(depthBehindMm)) return 0;
        const ceiling = Number.isFinite(maxOpacity) ? Na__ElevFogMath__Clamp(maxOpacity, 0, 1) : 1;
        const band    = Math.max(settings.endDepthMm - settings.startDepthMm, 1e-6);
        const along   = (depthBehindMm - settings.startDepthMm) / band;
        if (along <= 0) return 0;
        return Na__ElevFogMath__Bias(along, Na__ElevFogMath__FalloffToBias(settings.falloffPercent, edgePercent)) * ceiling;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Plane and the Depth Solve
// -----------------------------------------------------------------------------

    // FUNCTION | How Far Behind a Drawing Plane a World Point Lies
    // ------------------------------------------------------------
    // plane: { normalX, normalY, normalZ, distance } - the unit normal points
    // from the building TOWARD the viewer, and distance is the plane's own
    // position along it. Any one unit throughout: millimetres in a test,
    // scene units on the GPU.
    // ------------------------------------------------------------
    function Na__ElevFogMath__DepthBehindPlane(pointX, pointY, pointZ, plane) {
        if (!plane) return 0;
        return plane.distance - ((pointX * plane.normalX) + (pointY * plane.normalY) + (pointZ * plane.normalZ));
    }
    // ------------------------------------------------------------


    // FUNCTION | Solve a Parallel Camera's Depth as a + b.u + c.v + d.s
    // ------------------------------------------------------------
    // depthBehindAt(u, v, s) answers how far behind the plane the point at
    // screen position (u, v) and stored depth s lies, all three 0 to 1 - the
    // caller unprojects, this module has no matrices. Returns the four numbers,
    // or null when a fifth sample says the camera is not parallel.
    // ------------------------------------------------------------
    function Na__ElevFogMath__SolveAffineDepth(depthBehindAt) {
        if (typeof depthBehindAt !== 'function') return null;

        const a = depthBehindAt(0, 0, 0);
        const b = depthBehindAt(1, 0, 0) - a;
        const c = depthBehindAt(0, 1, 0) - a;
        const d = depthBehindAt(0, 0, 1) - a;
        if (![ a, b, c, d ].every(Number.isFinite)) return null;

        const measured  = depthBehindAt(1, 1, 1);                                // <-- The corner none of the four touched
        const predicted = a + b + c + d;
        const scale     = Math.max(1, Math.abs(measured), Math.abs(predicted));
        if (!Number.isFinite(measured) || Math.abs(measured - predicted) > Na__ElevFogMath__AFFINE_TOLERANCE * scale) return null;

        return { a : a, b : b, c : c, d : d };
    }
    // ------------------------------------------------------------


    // FUNCTION | Read a Solved Depth Back at One Pixel
    // ------------------------------------------------------------
    // The shader's own sum, here so the test can prove the solve against the
    // plane it came from.
    // ------------------------------------------------------------
    function Na__ElevFogMath__AffineDepthAt(solved, u, v, s) {
        if (!solved) return 0;
        return solved.a + (solved.b * u) + (solved.c * v) + (solved.d * s);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Colour and the Cache Token
// -----------------------------------------------------------------------------

    // FUNCTION | Read a #rrggbb Colour as Three 0-1 Channels
    // ------------------------------------------------------------
    // Anything unreadable is paper white, which is what the fog is for.
    // ------------------------------------------------------------
    function Na__ElevFogMath__ParseColour(hex) {
        const match = (typeof hex === 'string') ? /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim()) : null;
        if (!match) return { r : 1, g : 1, b : 1 };
        return {
            r : parseInt(match[1], 16) / 255,
            g : parseInt(match[2], 16) / 255,
            b : parseInt(match[3], 16) / 255
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | One Display Channel as the Linear Value That Encodes to It
    // ------------------------------------------------------------
    // The inverse of the sRGB transfer a supersampled bake applies on its way
    // out. The fog layer's colour is a DISPLAY colour - it is composited on a
    // sheet and in a PDF, both of which blend display values - so where a bake
    // is going to encode what it is given, the layer hands it the value that
    // encodes to the colour it wants. THE SHADER CARRIES THE SAME FORMULA.
    // ------------------------------------------------------------
    function Na__ElevFogMath__SrgbToLinear(channel) {
        const value = Na__ElevFogMath__Clamp(channel, 0, 1);
        return (value <= 0.04045) ? (value / 12.92) : Math.pow((value + 0.055) / 1.055, 2.4);
    }
    // ------------------------------------------------------------


    // FUNCTION | A Short Text That Changes When the Fog's Picture Would
    // ------------------------------------------------------------
    // What a sheet viewport keys its fog layer on. Empty when the fog is off,
    // so a drawing without fog keys exactly as it did before fog existed.
    // ------------------------------------------------------------
    function Na__ElevFogMath__Token(settings, appearance) {
        if (!settings || settings.enabled !== true) return '';
        const look = appearance || {};
        return [
            'fog', settings.startDepthMm, settings.endDepthMm, settings.falloffPercent,
            (typeof look.colour === 'string') ? look.colour.toLowerCase() : '#ffffff',
            Number.isFinite(look.maxOpacity)   ? look.maxOpacity   : 1,
            Number.isFinite(look.edgeGuardPx)  ? look.edgeGuardPx  : 1,
            Number.isFinite(look.emptyReachPx) ? look.emptyReachPx : 12
        ].join(':');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Elevation Depth Fog Maths API
    // ------------------------------------------------------------
    export {
        Na__ElevFogMath__KEY_ENABLED,
        Na__ElevFogMath__KEY_START,
        Na__ElevFogMath__KEY_END,
        Na__ElevFogMath__KEY_FALLOFF,
        Na__ElevFogMath__DEFAULTS,
        Na__ElevFogMath__LIMITS,
        Na__ElevFogMath__NormaliseSettings,
        Na__ElevFogMath__WriteBlock,
        Na__ElevFogMath__BlockMatches,
        Na__ElevFogMath__FalloffToBias,
        Na__ElevFogMath__Bias,
        Na__ElevFogMath__DensityAtDepth,
        Na__ElevFogMath__DepthBehindPlane,
        Na__ElevFogMath__SolveAffineDepth,
        Na__ElevFogMath__AffineDepthAt,
        Na__ElevFogMath__ParseColour,
        Na__ElevFogMath__SrgbToLinear,
        Na__ElevFogMath__Token
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
