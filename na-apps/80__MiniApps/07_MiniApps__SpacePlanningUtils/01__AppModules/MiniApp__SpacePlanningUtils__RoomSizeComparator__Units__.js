// =============================================================================
// NOBLE ARCHITECTURE - ROOM SIZE COMPARATOR - UNITS
// =============================================================================
//
// FILE    : MiniApp__SpacePlanningUtils__RoomSizeComparator__Units__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Square metre / square foot maths, parsing and display formatting
// CREATED : 16-Nov-2026
//
// - Every area is held in square metres and every length in metres. The
//   display unit ("m2" or "ft2") is applied only when a number is shown or
//   typed, so flipping units never loses precision.
// - Lengths follow the area unit: metres with m², feet and inches with ft².
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module-Level Variables
// -----------------------------------------------------------------------------

 let Na__SqFtPerSqM = 10.7639104167;   // Replaced from the AppConfig at start-up
 let Na__FtPerM     = 3.28083989501;

 const Na__InchesPerMetre = 39.3700787402;

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Configuration
// -----------------------------------------------------------------------------

// FUNCTION | Take the conversion factors from the AppConfig
// ------------------------------------------------------------
export function Na__RoomSizeComparator__ConfigureUnits(Na__UnitsConfig) {
    if (!Na__UnitsConfig) return;

    const Na__SqFt = Number(Na__UnitsConfig.NaMiniApp__SquareFeetPerSquareMetre);
    const Na__Ft   = Number(Na__UnitsConfig.NaMiniApp__FeetPerMetre);

    if (Number.isFinite(Na__SqFt) && Na__SqFt > 0) Na__SqFtPerSqM = Na__SqFt;
    if (Number.isFinite(Na__Ft)   && Na__Ft   > 0) Na__FtPerM     = Na__Ft;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Conversions
// -----------------------------------------------------------------------------

// FUNCTION | Square metres to the display unit
// ------------------------------------------------------------
export function Na__RoomSizeComparator__AreaFromM2(Na__AreaM2, Na__Unit) {
    return Na__Unit === "ft2" ? Na__AreaM2 * Na__SqFtPerSqM : Na__AreaM2;
}
// ------------------------------------------------------------


// FUNCTION | Display unit to square metres
// ------------------------------------------------------------
export function Na__RoomSizeComparator__AreaToM2(Na__Value, Na__Unit) {
    return Na__Unit === "ft2" ? Na__Value / Na__SqFtPerSqM : Na__Value;
}
// ------------------------------------------------------------


// FUNCTION | Metres to the display length unit (metres or decimal feet)
// ------------------------------------------------------------
export function Na__RoomSizeComparator__LengthFromM(Na__Metres, Na__Unit) {
    return Na__Unit === "ft2" ? Na__Metres * Na__FtPerM : Na__Metres;
}
// ------------------------------------------------------------


// FUNCTION | Display length unit to metres
// ------------------------------------------------------------
export function Na__RoomSizeComparator__LengthToM(Na__Value, Na__Unit) {
    return Na__Unit === "ft2" ? Na__Value / Na__FtPerM : Na__Value;
}
// ------------------------------------------------------------


// FUNCTION | Unit symbols
// ------------------------------------------------------------
export function Na__RoomSizeComparator__AreaSymbol(Na__Unit) {
    return Na__Unit === "ft2" ? "ft²" : "m²";
}

export function Na__RoomSizeComparator__LengthSymbol(Na__Unit) {
    return Na__Unit === "ft2" ? "ft" : "m";
}

export function Na__RoomSizeComparator__OtherUnit(Na__Unit) {
    return Na__Unit === "ft2" ? "m2" : "ft2";
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Formatting
// -----------------------------------------------------------------------------

// HELPER FUNCTION | Number with a fixed or trimmed number of decimals, en-GB grouping
// ------------------------------------------------------------
function Na__RoomSizeComparator__FormatNumber(Na__Value, Na__MaxDecimals, Na__TrimZeros) {
    return Na__Value.toLocaleString("en-GB", {
        minimumFractionDigits : Na__TrimZeros ? 0 : Na__MaxDecimals,
        maximumFractionDigits : Na__MaxDecimals
    });
}
// ------------------------------------------------------------


// FUNCTION | Area number in the display unit (no symbol)
// ------------------------------------------------------------
// Na__Mode "reference" : figures from the data, e.g. 7.5 / 13 m², 140 ft²
// Na__Mode "measured"  : a room the user typed, e.g. 13.0 m², 140 ft²
// Na__Mode "delta"     : a difference, e.g. 0.4 m², 4 ft²
export function Na__RoomSizeComparator__FormatAreaNumber(Na__AreaM2, Na__Unit, Na__Mode = "reference") {
    const Na__Value = Na__RoomSizeComparator__AreaFromM2(Na__AreaM2, Na__Unit);


    // Square feet read as whole numbers at room scale
    // ------------------------------------
    if (Na__Unit === "ft2") {
        const Na__Decimals = Math.abs(Na__Value) < 10 ? 1 : 0;
        return Na__RoomSizeComparator__FormatNumber(Na__Value, Na__Decimals, true);
    }


    // Square metres: data figures keep their own precision (7.5, 13), measured rooms show one decimal
    // ------------------------------------
    if (Na__Mode === "measured") return Na__RoomSizeComparator__FormatNumber(Na__Value, 1, false);
    return Na__RoomSizeComparator__FormatNumber(Na__Value, 1, true);
}
// ------------------------------------------------------------


// FUNCTION | Area with its symbol, e.g. "13 m²"
// ------------------------------------------------------------
export function Na__RoomSizeComparator__FormatArea(Na__AreaM2, Na__Unit, Na__Mode = "reference") {
    return `${Na__RoomSizeComparator__FormatAreaNumber(Na__AreaM2, Na__Unit, Na__Mode)} ${Na__RoomSizeComparator__AreaSymbol(Na__Unit)}`;
}
// ------------------------------------------------------------


// FUNCTION | Length, e.g. "3.6 m" or 11′ 10″
// ------------------------------------------------------------
export function Na__RoomSizeComparator__FormatLength(Na__Metres, Na__Unit, Na__Decimals = 1) {
    if (Na__Unit !== "ft2") {
        return `${Na__RoomSizeComparator__FormatNumber(Na__Metres, Na__Decimals, Na__Decimals > 1)} m`;
    }


    // Feet and inches, to the nearest inch
    // ------------------------------------
    const Na__TotalInches = Math.round(Na__Metres * Na__InchesPerMetre);
    const Na__Feet        = Math.floor(Na__TotalInches / 12);
    const Na__Inches      = Na__TotalInches - Na__Feet * 12;

    if (Na__Feet === 0)   return `${Na__Inches}″`;
    if (Na__Inches === 0) return `${Na__Feet}′`;
    return `${Na__Feet}′ ${Na__Inches}″`;
}
// ------------------------------------------------------------


// FUNCTION | Plan dimensions, short side first, e.g. "3.3 × 3.9 m" or 10′ 10″ × 12′ 10″
// ------------------------------------------------------------
export function Na__RoomSizeComparator__FormatDims(Na__LongM, Na__ShortM, Na__Unit, Na__Decimals = 1) {
    const Na__A = Math.min(Na__LongM, Na__ShortM);
    const Na__B = Math.max(Na__LongM, Na__ShortM);

    if (Na__Unit !== "ft2") {
        const Na__Trim = Na__Decimals > 1;
        return `${Na__RoomSizeComparator__FormatNumber(Na__A, Na__Decimals, Na__Trim)} × ${Na__RoomSizeComparator__FormatNumber(Na__B, Na__Decimals, Na__Trim)} m`;
    }

    return `${Na__RoomSizeComparator__FormatLength(Na__A, "ft2")} × ${Na__RoomSizeComparator__FormatLength(Na__B, "ft2")}`;
}
// ------------------------------------------------------------


// FUNCTION | Plain-text value for an input box after a unit flip (parsable again)
// ------------------------------------------------------------
export function Na__RoomSizeComparator__AreaInputText(Na__AreaM2, Na__Unit) {
    const Na__Value = Na__RoomSizeComparator__AreaFromM2(Na__AreaM2, Na__Unit);
    const Na__Decimals = Na__Unit === "ft2" ? 0 : 1;
    return String(Number(Na__Value.toFixed(Na__Decimals)));
}

export function Na__RoomSizeComparator__LengthInputText(Na__Metres, Na__Unit) {
    if (Na__Unit !== "ft2") return String(Number(Na__Metres.toFixed(2)));

    const Na__TotalInches = Math.round(Na__Metres * Na__InchesPerMetre);
    const Na__Feet        = Math.floor(Na__TotalInches / 12);
    const Na__Inches      = Na__TotalInches - Na__Feet * 12;
    return Na__Inches === 0 ? `${Na__Feet}'` : `${Na__Feet}'${Na__Inches}"`;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Parsing What The User Types
// -----------------------------------------------------------------------------

// HELPER FUNCTION | First number in the text: "12.5", "12,5", "1,250", "12.5 m2" (not 12.52)
// ------------------------------------------------------------
function Na__RoomSizeComparator__ParsePlainNumber(Na__Text) {
    const Na__Match = String(Na__Text).match(/\d[\d,]*(?:\.\d+)?|\.\d+/);
    if (!Na__Match) return Number.NaN;

    let Na__Clean = Na__Match[0];


    // One comma and no point is a decimal comma, unless it groups thousands (1,250)
    // ------------------------------------
    const Na__Commas = (Na__Clean.match(/,/g) || []).length;
    if (Na__Commas === 1 && !Na__Clean.includes(".") && !/,\d{3}$/.test(Na__Clean)) {
        Na__Clean = Na__Clean.replace(",", ".");
    } else {
        Na__Clean = Na__Clean.replace(/,/g, "");
    }

    const Na__Value = Number.parseFloat(Na__Clean);
    return Number.isFinite(Na__Value) ? Na__Value : Number.NaN;
}
// ------------------------------------------------------------


// FUNCTION | Area typed by the user, in square metres
// ------------------------------------------------------------
// Returns { Na__AreaM2, Na__Note } ; Na__AreaM2 is null for empty text and NaN for bad text.
export function Na__RoomSizeComparator__ParseAreaInput(Na__Text, Na__Unit) {
    const Na__Trimmed = String(Na__Text ?? "").trim();
    if (Na__Trimmed === "") return { Na__AreaM2: null, Na__Note: "" };

    const Na__Value = Na__RoomSizeComparator__ParsePlainNumber(Na__Trimmed);
    if (!Number.isFinite(Na__Value) || Na__Value <= 0) return { Na__AreaM2: Number.NaN, Na__Note: "" };


    // Honour a unit typed in the box, whatever the switch says
    // ------------------------------------
    const Na__Lower = Na__Trimmed.toLowerCase();
    const Na__SaysFeet   = /(ft|feet|foot|sq\s*ft|sqft|′|')/.test(Na__Lower);
    const Na__SaysMetres = /(m2|m²|sq\s*m|sqm|metre|meter)/.test(Na__Lower) && !Na__SaysFeet;

    if (Na__SaysFeet   && Na__Unit !== "ft2") return { Na__AreaM2: Na__Value / Na__SqFtPerSqM, Na__Note: "ft" };
    if (Na__SaysMetres && Na__Unit === "ft2") return { Na__AreaM2: Na__Value, Na__Note: "m" };

    return { Na__AreaM2: Na__RoomSizeComparator__AreaToM2(Na__Value, Na__Unit), Na__Note: "" };
}
// ------------------------------------------------------------


// FUNCTION | Length typed by the user, in metres
// ------------------------------------------------------------
// Metric: "3.6", "3600mm" and any bare number of 100 or more (read as millimetres).
// Imperial: "12", "12.5", "12'6\"", "12' 6", "12ft 6in".
// Returns { Na__LengthM, Na__Note } ; Na__Note "mm" when millimetres were assumed.
export function Na__RoomSizeComparator__ParseLengthInput(Na__Text, Na__Unit) {
    const Na__Trimmed = String(Na__Text ?? "").trim();
    if (Na__Trimmed === "") return { Na__LengthM: null, Na__Note: "" };

    const Na__Lower = Na__Trimmed.toLowerCase();


    // Feet and inches, in either unit mode
    // ------------------------------------
    const Na__FeetInches = Na__Lower.match(/^(\d+(?:\.\d+)?)\s*(?:'|′|ft|feet|foot)\s*(?:(\d+(?:\.\d+)?)\s*(?:"|″|in|inch|inches)?)?$/);
    if (Na__FeetInches) {
        const Na__Feet   = Number.parseFloat(Na__FeetInches[1]);
        const Na__Inches = Na__FeetInches[2] ? Number.parseFloat(Na__FeetInches[2]) : 0;
        const Na__Total  = Na__Feet + Na__Inches / 12;
        if (Na__Total <= 0) return { Na__LengthM: Number.NaN, Na__Note: "" };
        return { Na__LengthM: Na__Total / Na__FtPerM, Na__Note: Na__Unit === "ft2" ? "" : "ft" };
    }


    // Plain number with an optional unit
    // ------------------------------------
    const Na__Value = Na__RoomSizeComparator__ParsePlainNumber(Na__Lower);
    if (!Number.isFinite(Na__Value) || Na__Value <= 0) return { Na__LengthM: Number.NaN, Na__Note: "" };

    if (/mm\s*$/.test(Na__Lower)) return { Na__LengthM: Na__Value / 1000, Na__Note: "mm" };
    if (/cm\s*$/.test(Na__Lower)) return { Na__LengthM: Na__Value / 100,  Na__Note: "cm" };
    if (/(?<!m)m\s*$/.test(Na__Lower) && Na__Unit === "ft2") return { Na__LengthM: Na__Value, Na__Note: "m" };

    if (Na__Unit === "ft2") return { Na__LengthM: Na__Value / Na__FtPerM, Na__Note: "" };


    // Architects type millimetres: no room is 100 m long
    // ------------------------------------
    if (Na__Value >= 100) return { Na__LengthM: Na__Value / 1000, Na__Note: "mm" };
    return { Na__LengthM: Na__Value, Na__Note: "" };
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
