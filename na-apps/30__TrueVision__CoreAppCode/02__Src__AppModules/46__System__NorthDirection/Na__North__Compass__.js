// =============================================================================
// TRUEVISION3D - NORTH DIRECTION - COMPASS MATHS
// =============================================================================
//
// FILE       : Na__North__Compass__.js
// NAMESPACE  : Na__NorthMath
// MODULE     : North Direction - Compass Maths
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Bearings, and the compass word a bearing reads as: the arithmetic that turns "which way is north" into "this is the East Elevation"
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - ONE CONVENTION, THE APP'S OWN. A bearing is degrees CLOCKWISE SEEN FROM
//   ABOVE, measured from the model's -Z axis: atan2(x, -z). That is the
//   convention the elevation system already stores its azimuths in
//   (Na__ElevData__AzimuthFromNormal), and -Z is SketchUp's green axis after a
//   glTF export, which is what the app has always called north.
// - THE NORTH BEARING is where TRUE north lies in that same measure. 0 means
//   the model was drawn north-up and the app's assumption was right all along.
//   PS01 and PS02 were not: their "North Elevation" is stored at azimuth 90,
//   so their north bearing is 90.
// - A TRUE BEARING is a model bearing with the north bearing taken off it.
//   An elevation's azimuth is the bearing of the side the viewer stands on,
//   which is the way the drawn face looks - so the true bearing of an
//   elevation's azimuth IS the compass direction the elevation is named by.
// - THE COMPASS WORD. Four cardinal sectors and four intercardinal ones, and
//   the intercardinal ones are as wide as they are told to be. At 22.5 degrees
//   either side this is the ordinary eight-point compass; at 0 it is the
//   four-point one. The house default is 15: a wall 30 degrees off north is
//   still the North Elevation, as most drawing sets would call it, and one 40
//   degrees off is the North East.
// - Imports nothing and touches nothing, so it runs under Node for its test.
//
// INTEGRATION:
// - Na__North__ProjectJson__Data__ asks FacingWord for an elevation's name.
// - Na__North__PickTool__ and Na__North__CompassGizmo__ turn points and
//   bearings into each other through BearingOfVector and VectorOfBearing.
// - 80__Testing__PrototypeEnvironment/Na__Test__NorthCompass__.test.mjs
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (19-Sep-2026)
// - ValeVision    : 1.0.0 ported 20-Sep-2026 as ValeVision3D v2.67.0, verbatim
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Eight Points, Clockwise From North, and Their Fallback Words
    // ------------------------------------------------------------
    const Na__NorthMath__POINT_KEYS = Object.freeze([ 'North', 'NorthEast', 'East', 'SouthEast', 'South', 'SouthWest', 'West', 'NorthWest' ]);
    const Na__NorthMath__WORDS      = Object.freeze({
        North : 'North', NorthEast : 'North East', East : 'East', SouthEast : 'South East',
        South : 'South', SouthWest : 'South West', West : 'West', NorthWest : 'North West'
    });
    const Na__NorthMath__HALF_WIDTH_DEG     = 15;      // <-- How far either side of 45 degrees still reads as an intercardinal, when nobody says
    const Na__NorthMath__MAX_HALF_WIDTH_DEG = 45;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Bearings
// -----------------------------------------------------------------------------

    // FUNCTION | A Bearing Brought Into 0 to 360 (360 itself is 0)
    // ------------------------------------------------------------
    function Na__NorthMath__Wrap(degrees) {
        const value = Number(degrees);
        if (!Number.isFinite(value)) return 0;
        if (value >= 0 && value < 360) return value;                             // <-- Already in range: handed back untouched, so 155.9 stays 155.9 and not 155.89999999999998
        const wrapped = ((value % 360) + 360) % 360;
        return wrapped === 360 ? 0 : wrapped;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Bearing Kept to a Number of Decimal Places
    // ------------------------------------------------------------
    // 359.97 to one place is 360.0, which is 0. The rounded number is what is
    // stored in the project, so nothing is done to it afterwards that could
    // leave a tail of floating point on it.
    // ------------------------------------------------------------
    function Na__NorthMath__Round(degrees, decimals) {
        const places = (Number.isFinite(decimals) && decimals >= 0) ? Math.min(6, Math.floor(decimals)) : 1;
        const scale  = Math.pow(10, places);
        const rounded = Math.round(Na__NorthMath__Wrap(degrees) * scale) / scale;
        return rounded >= 360 ? 0 : rounded;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Bearing a Horizontal Vector Points Along
    // ------------------------------------------------------------
    // Clockwise seen from above, from the model's -Z axis. Null for a vector
    // with no horizontal length, which points along nothing.
    // ------------------------------------------------------------
    function Na__NorthMath__BearingOfVector(x, z) {
        if (!Number.isFinite(x) || !Number.isFinite(z) || (x === 0 && z === 0)) return null;
        return Na__NorthMath__Wrap(Math.atan2(x, -z) * (180 / Math.PI));
    }
    // ------------------------------------------------------------


    // FUNCTION | The Horizontal Unit Vector a Bearing Points Along
    // ------------------------------------------------------------
    function Na__NorthMath__VectorOfBearing(degrees) {
        const radians = Na__NorthMath__Wrap(degrees) * (Math.PI / 180);
        return { x : Math.sin(radians), z : -Math.cos(radians) };
    }
    // ------------------------------------------------------------


    // FUNCTION | A Model Bearing as a True Compass Bearing
    // ------------------------------------------------------------
    function Na__NorthMath__TrueBearing(modelBearingDeg, northBearingDeg) {
        return Na__NorthMath__Wrap(Na__NorthMath__Wrap(modelBearingDeg) - Na__NorthMath__Wrap(northBearingDeg));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Compass Words
// -----------------------------------------------------------------------------

    // FUNCTION | Which of the Eight Points a True Bearing Reads As
    // ------------------------------------------------------------
    // Returns its key: 'North', 'NorthEast' ... halfWidthDeg is how far either
    // side of 45, 135, 225 and 315 still counts as the intercardinal; the
    // cardinals take the rest, boundaries included - so at the house default
    // of 15 a wall exactly 30 degrees off north is still the North Elevation.
    // ------------------------------------------------------------
    function Na__NorthMath__PointKey(trueBearingDeg, halfWidthDeg) {
        const bearing = Na__NorthMath__Wrap(trueBearingDeg);
        const width   = (Number.isFinite(halfWidthDeg) && halfWidthDeg >= 0) ? Math.min(Na__NorthMath__MAX_HALF_WIDTH_DEG, halfWidthDeg) : Na__NorthMath__HALF_WIDTH_DEG;
        const quarter = Math.floor(bearing / 90);                                // <-- 0 is north to east, 1 east to south ...
        const between = (quarter * 90) + 45;
        if (Math.abs(bearing - between) < width - 1e-9) return Na__NorthMath__POINT_KEYS[(quarter * 2) + 1];
        return Na__NorthMath__POINT_KEYS[(Math.round(bearing / 90) % 4) * 2];
    }
    // ------------------------------------------------------------


    // FUNCTION | The Word for a True Bearing
    // ------------------------------------------------------------
    // words is { North, NorthEast, ... }; any it leaves out falls back to the
    // plain English.
    // ------------------------------------------------------------
    function Na__NorthMath__CompassWord(trueBearingDeg, halfWidthDeg, words) {
        const key  = Na__NorthMath__PointKey(trueBearingDeg, halfWidthDeg);
        const word = (words && typeof words[key] === 'string' && words[key].trim() !== '') ? words[key].trim() : Na__NorthMath__WORDS[key];
        return word;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Compass Word an Elevation Is Named By
    // ------------------------------------------------------------
    // azimuthDeg is the elevation's own: the model bearing of the side the
    // viewer stands on. Empty when north has not been set - the caller shows
    // a placeholder, never a guess.
    // ------------------------------------------------------------
    function Na__NorthMath__FacingWord(azimuthDeg, northBearingDeg, halfWidthDeg, words) {
        if (!Number.isFinite(azimuthDeg) || northBearingDeg === null || northBearingDeg === undefined || !Number.isFinite(northBearingDeg)) return '';
        return Na__NorthMath__CompassWord(Na__NorthMath__TrueBearing(azimuthDeg, northBearingDeg), halfWidthDeg, words);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Compass Maths API
    // ------------------------------------------------------------
    export {
        Na__NorthMath__POINT_KEYS,
        Na__NorthMath__WORDS,
        Na__NorthMath__HALF_WIDTH_DEG,
        Na__NorthMath__Wrap,
        Na__NorthMath__Round,
        Na__NorthMath__BearingOfVector,
        Na__NorthMath__VectorOfBearing,
        Na__NorthMath__TrueBearing,
        Na__NorthMath__PointKey,
        Na__NorthMath__CompassWord,
        Na__NorthMath__FacingWord
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
