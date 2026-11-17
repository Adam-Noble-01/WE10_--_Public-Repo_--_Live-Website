// =============================================================================
// NOBLE ARCHITECTURE - ROOM SIZE COMPARATOR - ROOM DATA
// =============================================================================
//
// FILE    : MiniApp__SpacePlanningUtils__RoomSizeComparator__RoomData__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Load and index the room size data, and place an area on a room
//           type's five size bands
// CREATED : 16-Nov-2026
//
// - The data lives in 02__AppData/RoomSizeComparator__RoomSizeData__UK__.json
//   (areas in m², sources in a shared library keyed by id).
// - Pure functions apart from the fetch, so the logic can be tested in node
//   (04__Testing/MiniApp__SpacePlanningUtils__RoomSizeComparator__Logic__Test__.mjs).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module-Level Variables
// -----------------------------------------------------------------------------

 export const Na__RoomSizeComparator__BandKeys = ["Min", "Small", "Medium", "Large", "Oversized"];

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Load And Index
// -----------------------------------------------------------------------------

// FUNCTION | Fetch the room data file and index it
// ------------------------------------------------------------
export async function Na__RoomSizeComparator__LoadRoomData(Na__Url) {
    const Na__Response = await fetch(Na__Url, { cache: "no-cache" });
    if (!Na__Response.ok) {
        throw new Error(`Failed to load room data (HTTP ${Na__Response.status}).`);
    }

    return Na__RoomSizeComparator__IndexRoomData(await Na__Response.json());
}
// ------------------------------------------------------------


// FUNCTION | Index the raw data: rooms by id, groups in order, comparable flag
// ------------------------------------------------------------
export function Na__RoomSizeComparator__IndexRoomData(Na__Raw) {
    const Na__Groups  = Na__Raw.NaRoomData__Groups || [];
    const Na__Library = Na__Raw.NaRoomData__SourceLibrary || {};
    const Na__ById    = new Map();
    const Na__GroupOrder = new Map(Na__Groups.map((Na__Group, Na__Index) => [Na__Group.NaGroup__Id, Na__Index]));

    const Na__Rooms = (Na__Raw.NaRoomData__Rooms || []).map((Na__Room, Na__Index) => {
        const Na__Areas = Na__Room.NaRoom__Areas
            ? Na__RoomSizeComparator__BandKeys.map((Na__Key) => Number(Na__Room.NaRoom__Areas[Na__Key]))
            : null;

        const Na__Comparable = Na__Room.NaRoom__Include !== false
            && Array.isArray(Na__Areas)
            && Na__Areas.every((Na__Value) => Number.isFinite(Na__Value) && Na__Value > 0);

        const Na__Indexed = {
            ...Na__Room,
            Na__Order      : Na__Index,
            Na__GroupOrder : Na__GroupOrder.has(Na__Room.NaRoom__Group) ? Na__GroupOrder.get(Na__Room.NaRoom__Group) : 999,
            Na__AreaList   : Na__Areas,
            Na__Comparable : Na__Comparable,
            Na__Aspect     : Math.max(1, Number(Na__Room.NaRoom__Aspect) || 1.3)
        };

        Na__ById.set(Na__Room.NaRoom__Id, Na__Indexed);
        return Na__Indexed;
    });

    return {
        Na__Raw       : Na__Raw,
        Na__Meta      : Na__Raw.NaRoomData__Meta || {},
        Na__Bands     : (Na__Raw.NaRoomData__Meta && Na__Raw.NaRoomData__Meta.NaRoomData__Bands) || [],
        Na__Groups    : Na__Groups,
        Na__Rooms     : Na__Rooms,
        Na__ById      : Na__ById,
        Na__Library   : Na__Library
    };
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Lookups
// -----------------------------------------------------------------------------

// FUNCTION | Rooms that have five figures and can be compared
// ------------------------------------------------------------
export function Na__RoomSizeComparator__GetComparableRooms(Na__Index) {
    return Na__Index.Na__Rooms.filter((Na__Room) => Na__Room.Na__Comparable);
}
// ------------------------------------------------------------


// FUNCTION | Group label for a group id
// ------------------------------------------------------------
export function Na__RoomSizeComparator__GroupLabel(Na__Index, Na__GroupId) {
    const Na__Group = Na__Index.Na__Groups.find((Na__Item) => Na__Item.NaGroup__Id === Na__GroupId);
    return Na__Group ? Na__Group.NaGroup__Label : "";
}
// ------------------------------------------------------------


// FUNCTION | Rooms bucketed by group, in data order (comparable only unless asked)
// ------------------------------------------------------------
export function Na__RoomSizeComparator__GroupRooms(Na__Index, Na__IncludeAll = false) {
    return Na__Index.Na__Groups.map((Na__Group) => ({
        Na__Group : Na__Group,
        Na__Rooms : Na__Index.Na__Rooms.filter((Na__Room) =>
            Na__Room.NaRoom__Group === Na__Group.NaGroup__Id && (Na__IncludeAll || Na__Room.Na__Comparable))
    })).filter((Na__Bucket) => Na__Bucket.Na__Rooms.length > 0);
}
// ------------------------------------------------------------


// FUNCTION | Band label ("Min", "O/S") and name ("Minimum", "Oversized") by index
// ------------------------------------------------------------
export function Na__RoomSizeComparator__BandLabel(Na__Index, Na__BandIndex) {
    const Na__Band = Na__Index.Na__Bands[Na__BandIndex];
    return Na__Band ? Na__Band.NaBand__Label : Na__RoomSizeComparator__BandKeys[Na__BandIndex];
}

export function Na__RoomSizeComparator__BandName(Na__Index, Na__BandIndex) {
    const Na__Band = Na__Index.Na__Bands[Na__BandIndex];
    return Na__Band ? Na__Band.NaBand__Name : Na__RoomSizeComparator__BandKeys[Na__BandIndex];
}
// ------------------------------------------------------------


// FUNCTION | Sources for a room, joined to the shared library
// ------------------------------------------------------------
export function Na__RoomSizeComparator__ResolveSources(Na__Index, Na__Room) {
    return (Na__Room.NaRoom__Sources || []).map((Na__Source) => {
        const Na__Entry = Na__Index.Na__Library[Na__Source.NaSource__Ref] || {};
        return {
            Na__Ref       : Na__Source.NaSource__Ref,
            Na__Figure    : Na__Source.NaSource__Figure || "",
            Na__Type      : Na__Source.NaSource__Type || "",
            Na__Publisher : Na__Entry.NaSource__Publisher || Na__Source.NaSource__Ref,
            Na__Title     : Na__Entry.NaSource__Title || "",
            Na__Url       : Na__Entry.NaSource__Url || "",
            Na__Region    : Na__Entry.NaSource__Region || "",
            Na__Kind      : Na__Entry.NaSource__Kind || "",
            Na__Checked   : Na__Entry.NaSource__Checked || ""
        };
    });
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Geometry And Classification
// -----------------------------------------------------------------------------

// FUNCTION | Typical plan dimensions for an area at a given aspect ratio (long ÷ short)
// ------------------------------------------------------------
export function Na__RoomSizeComparator__DimsForArea(Na__AreaM2, Na__Aspect) {
    const Na__Ratio = Math.max(1, Number(Na__Aspect) || 1);
    return {
        Na__LongM  : Math.sqrt(Na__AreaM2 * Na__Ratio),
        Na__ShortM : Math.sqrt(Na__AreaM2 / Na__Ratio)
    };
}
// ------------------------------------------------------------


// FUNCTION | Place an area on a room type's five bands
// ------------------------------------------------------------
// Na__ToleranceM2: differences smaller than this count as "exactly" a band
// (half the last shown digit, so 140 ft² reads as exactly 13 m²).
//
// Returns:
//   Na__Kind         "below" | "exact" | "between" | "above"
//   Na__LowerIndex   band at or below the area (-1 when below Min)
//   Na__UpperIndex   band at or above the area (-1 when above O/S)
//   Na__NearestIndex nearest band by area (-1 below Min, 5 above O/S)
//   Na__Over         m² above the lower band     Na__Short  m² below the upper band
//   Na__Fraction     0..1 between lower and upper band
//   Na__PercentOfMedium  area ÷ Medium × 100
export function Na__RoomSizeComparator__ClassifyArea(Na__Room, Na__AreaM2, Na__ToleranceM2 = 0.05) {
    const Na__Areas = Na__Room.Na__AreaList;
    const Na__Last  = Na__Areas.length - 1;
    const Na__Pct   = (Na__AreaM2 / Na__Areas[2]) * 100;


    // Exactly a band (within display precision)
    // ------------------------------------
    for (let Na__I = 0; Na__I <= Na__Last; Na__I += 1) {
        if (Math.abs(Na__AreaM2 - Na__Areas[Na__I]) < Na__ToleranceM2) {
            return { Na__Kind: "exact", Na__LowerIndex: Na__I, Na__UpperIndex: Na__I, Na__NearestIndex: Na__I,
                     Na__Over: 0, Na__Short: 0, Na__Fraction: 0, Na__PercentOfMedium: Na__Pct };
        }
    }


    // Below Min: the one result that matters for compliance
    // ------------------------------------
    if (Na__AreaM2 < Na__Areas[0]) {
        return { Na__Kind: "below", Na__LowerIndex: -1, Na__UpperIndex: 0, Na__NearestIndex: -1,
                 Na__Over: 0, Na__Short: Na__Areas[0] - Na__AreaM2, Na__Fraction: 0, Na__PercentOfMedium: Na__Pct };
    }


    // Above O/S
    // ------------------------------------
    if (Na__AreaM2 > Na__Areas[Na__Last]) {
        return { Na__Kind: "above", Na__LowerIndex: Na__Last, Na__UpperIndex: -1, Na__NearestIndex: Na__Last + 1,
                 Na__Over: Na__AreaM2 - Na__Areas[Na__Last], Na__Short: 0, Na__Fraction: 1, Na__PercentOfMedium: Na__Pct };
    }


    // Between two bands: nearest by area
    // ------------------------------------
    let Na__Lower = 0;
    while (Na__Lower < Na__Last && Na__AreaM2 > Na__Areas[Na__Lower + 1]) Na__Lower += 1;

    const Na__Upper = Na__Lower + 1;
    const Na__Over  = Na__AreaM2 - Na__Areas[Na__Lower];
    const Na__Short = Na__Areas[Na__Upper] - Na__AreaM2;

    return {
        Na__Kind            : "between",
        Na__LowerIndex      : Na__Lower,
        Na__UpperIndex      : Na__Upper,
        Na__NearestIndex    : Na__Over <= Na__Short ? Na__Lower : Na__Upper,
        Na__Over            : Na__Over,
        Na__Short           : Na__Short,
        Na__Fraction        : Na__Over / (Na__Areas[Na__Upper] - Na__Areas[Na__Lower]),
        Na__PercentOfMedium : Na__Pct
    };
}
// ------------------------------------------------------------


// FUNCTION | A tidy axis maximum and tick step for a value range
// ------------------------------------------------------------
export function Na__RoomSizeComparator__NiceAxis(Na__MaxValue, Na__TargetTicks = 6) {
    const Na__Safe  = Math.max(Na__MaxValue, 1e-6);
    const Na__Raw   = Na__Safe / Na__TargetTicks;
    const Na__Power = Math.pow(10, Math.floor(Math.log10(Na__Raw)));
    const Na__Steps = [1, 2, 2.5, 5, 10];

    let Na__Step = Na__Power * 10;
    for (const Na__Multiplier of Na__Steps) {
        if (Na__Raw <= Na__Multiplier * Na__Power) { Na__Step = Na__Multiplier * Na__Power; break; }
    }

    return { Na__Step: Na__Step, Na__Max: Math.ceil(Na__Safe / Na__Step) * Na__Step };
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
