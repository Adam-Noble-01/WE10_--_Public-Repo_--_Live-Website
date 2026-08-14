/* =============================================================================
   NOBLE BIM ASSET TOOLS | APPLICATION CORE - UNIT CONVERSION
   =============================================================================

   FILE       : Na__AppCore__Units__.mjs
   NAMESPACE  : Na__BimAssetTools
   MODULE     : AppCore - Units
   AUTHOR     : Adam Noble - Noble Architecture
   PURPOSE    : Single authority for every linear unit conversion in the application
   CREATED    : 14-Aug-2026

   DESCRIPTION:
   - The whole application works internally in MILLIMETRES. Every loader converts
     its source geometry to millimetres exactly once, on the way in, and records
     which factor it applied. Nothing downstream rescales again.
   - This module is the only place a conversion factor is written down. A wrong
     unit factor is the single most common way a converted asset comes out 1000x
     off, so the numbers live in one auditable table rather than being sprinkled
     through the loaders.

   ---------------------------------------------------------------------------

   WHY MILLIMETRES AND NOT METRES:
   UK architectural practice dimensions in millimetres, the source BIM content
   declares millimetres, and the downstream consumer is SketchUp working to
   millimetre precision. Holding metres internally would mean every number the
   user reads is a conversion away from the number on the drawing.

   Float32 carries about seven significant decimal digits. At millimetre scale a
   30 metre building is 30000.0 mm, which leaves roughly 0.002 mm of resolution -
   three orders of magnitude finer than any architectural tolerance. Precision is
   therefore not a reason to prefer metres.

   ============================================================================= */

// =============================================================================
// REGION | Unit Definition Table
// =============================================================================

    // MODULE CONSTANTS | Conversion Factors Into the Internal Millimetre Space
    // ------------------------------------------------------------
    // Each factor answers: multiply a source value by this to obtain millimetres.
    export const UNIT_TO_MM = Object.freeze({
        millimetre  :  1.0,
        centimetre  :  10.0,
        decimetre   :  100.0,
        metre       :  1000.0,
        kilometre   :  1000000.0,
        micrometre  :  0.001,
        inch        :  25.4,                                                     // <-- Exact by international definition since 1959
        foot        :  304.8,                                                    // <-- Exact: 12 x 25.4
        yard        :  914.4,                                                    // <-- Exact: 36 x 25.4
        mile        :  1609344.0                                                 // <-- Exact: 63360 x 25.4
    });
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Display Abbreviations
    // ------------------------------------------------------------
    export const UNIT_ABBREVIATION = Object.freeze({
        millimetre  :  'mm',
        centimetre  :  'cm',
        decimetre   :  'dm',
        metre       :  'm',
        kilometre   :  'km',
        micrometre  :  'um',
        inch        :  'in',
        foot        :  'ft',
        yard        :  'yd',
        mile        :  'mi'
    });
    // ------------------------------------------------------------


    // MODULE CONSTANTS | IFC SI Prefix Multipliers
    // ------------------------------------------------------------
    // IFCSIUNIT expresses a unit as a base name plus an optional prefix enum, for
    // example IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.). These are the multipliers
    // that turn the prefixed unit into plain metres.
    export const IFC_SI_PREFIX = Object.freeze({
        EXA     :  1e18,
        PETA    :  1e15,
        TERA    :  1e12,
        GIGA    :  1e9,
        MEGA    :  1e6,
        KILO    :  1e3,
        HECTO   :  1e2,
        DECA    :  1e1,
        NONE    :  1.0,
        DECI    :  1e-1,
        CENTI   :  1e-2,
        MILLI   :  1e-3,
        MICRO   :  1e-6,
        NANO    :  1e-9,
        PICO    :  1e-12,
        FEMTO   :  1e-15,
        ATTO    :  1e-18
    });
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Conversion API
// =============================================================================

// -----------------------------------------------------------------------------
// REGION | Factor Resolution
// -----------------------------------------------------------------------------

    // FUNCTION | Resolve a Named Unit to Its Millimetre Factor
    // ------------------------------------------------------------
    export function FactorToMillimetres(unitName) {
        const factor = UNIT_TO_MM[unitName];
        if (factor === undefined) {
            throw new Error(`[Na Units] Unknown unit "${unitName}". Add it to UNIT_TO_MM if it is genuinely needed.`);
        }
        return factor;
    }
    // ------------------------------------------------------------


    // FUNCTION | Build a Millimetre Factor from an IFC SI Prefix and Base Unit
    // ------------------------------------------------------------
    // IFC always expresses length in metres with a prefix, so the result is the
    // prefix multiplier scaled up by the 1000 that converts metres to millimetres.
    export function FactorFromIfcSiPrefix(prefixName) {
        const key        =  (prefixName || 'NONE').toUpperCase().replace(/^\.|\.$/g, '');
        const multiplier =  IFC_SI_PREFIX[key];

        if (multiplier === undefined) {
            throw new Error(`[Na Units] Unrecognised IFC SI prefix "${prefixName}".`);
        }
        return multiplier * UNIT_TO_MM.metre;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Value Conversion
// -----------------------------------------------------------------------------

    // FUNCTION | Convert a Single Value from a Named Unit into Millimetres
    // ------------------------------------------------------------
    export function ToMillimetres(value, sourceUnit) {
        return value * FactorToMillimetres(sourceUnit);
    }
    // ------------------------------------------------------------


    // FUNCTION | Convert a Millimetre Value into a Named Target Unit
    // ------------------------------------------------------------
    export function FromMillimetres(valueMm, targetUnit) {
        return valueMm / FactorToMillimetres(targetUnit);
    }
    // ------------------------------------------------------------


    // FUNCTION | Scale a Flat Vertex Array in Place
    // ------------------------------------------------------------
    // Operates in place because these arrays are large and a copy would double
    // peak memory during a big IFC load for no benefit. A factor of exactly 1 is
    // skipped so an already-millimetre source is never touched at all, which
    // keeps its coordinates bit-identical to the file on disk.
    export function ScaleVertexArrayInPlace(positions, factor) {
        if (factor === 1.0) return positions;

        for (let i = 0; i < positions.length; i++) {
            positions[i] *= factor;
        }
        return positions;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Formatting for Display
// -----------------------------------------------------------------------------

    // FUNCTION | Format a Millimetre Value for Readout
    // ------------------------------------------------------------
    // Architectural convention is whole millimetres. Sub-millimetre precision is
    // shown only when the value is genuinely small, such as a tessellation
    // deflection or a measured gap.
    export function FormatMillimetres(valueMm, forceDecimals) {
        if (!Number.isFinite(valueMm)) return '--';

        const decimals = (forceDecimals !== undefined)
            ? forceDecimals
            : (Math.abs(valueMm) < 10 ? 3 : 1);

        return `${valueMm.toFixed(decimals)} mm`;
    }
    // ------------------------------------------------------------


    // FUNCTION | Format a Millimetre Value as Metres for Large Spans
    // ------------------------------------------------------------
    export function FormatAsMetres(valueMm, decimals) {
        if (!Number.isFinite(valueMm)) return '--';
        return `${(valueMm / 1000).toFixed(decimals === undefined ? 3 : decimals)} m`;
    }
    // ------------------------------------------------------------


    // FUNCTION | Choose the Most Readable Unit for a Span and Format It
    // ------------------------------------------------------------
    export function FormatAuto(valueMm) {
        if (!Number.isFinite(valueMm)) return '--';
        return Math.abs(valueMm) >= 10000 ? FormatAsMetres(valueMm) : FormatMillimetres(valueMm);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

// endregion -------------------------------------------------------------------
