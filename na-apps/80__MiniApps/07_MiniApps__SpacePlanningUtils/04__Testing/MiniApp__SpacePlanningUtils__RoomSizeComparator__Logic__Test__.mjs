// =============================================================================
// NOBLE ARCHITECTURE - ROOM SIZE COMPARATOR - LOGIC TESTS (node, no browser)
// =============================================================================
//
// FILE    : MiniApp__SpacePlanningUtils__RoomSizeComparator__Logic__Test__.mjs
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Check the unit maths, input parsing, area classification and the
//           room data file, including that every row of the original sheet
//           survives the clean-up with its values intact
// CREATED : 16-Nov-2026
//
// RUN     : node "na-apps/80__MiniApps/07_MiniApps__SpacePlanningUtils/04__Testing/MiniApp__SpacePlanningUtils__RoomSizeComparator__Logic__Test__.mjs"
//
// - The app modules are browser ES modules named .js; with no package.json
//   "type": "module" node would read them as CommonJS. As in the Text To
//   Reader tests, they are copied to a temporary folder as .mjs and imported
//   from there, so the REAL functions run. Neither imports the other.
//
// =============================================================================

import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const Na__Here    = dirname(fileURLToPath(import.meta.url));
const Na__Modules = join(Na__Here, "..", "01__AppModules");
const Na__Temp    = mkdtempSync(join(tmpdir(), "rsc-test-"));
const Na__Load    = async (Na__Name) => {
    const Na__Target = join(Na__Temp, `${Na__Name}.mjs`);
    copyFileSync(join(Na__Modules, `${Na__Name}.js`), Na__Target);
    return import(pathToFileURL(Na__Target).href);
};

const Units    = await Na__Load("MiniApp__SpacePlanningUtils__RoomSizeComparator__Units__");
const RoomData = await Na__Load("MiniApp__SpacePlanningUtils__RoomSizeComparator__RoomData__");
rmSync(Na__Temp, { recursive: true, force: true });
const Na__Raw  = JSON.parse(readFileSync(join(Na__Here, "..", "02__AppData", "RoomSizeComparator__RoomSizeData__UK__.json"), "utf8"));
const Na__Cfg  = JSON.parse(readFileSync(join(Na__Here, "..", "MiniApp__SpacePlanningUtils__RoomSizeComparator__AppConfig__.json"), "utf8"));
Units.Na__RoomSizeComparator__ConfigureUnits(Na__Cfg.NaMiniApp__Units);
const Na__Index = RoomData.Na__RoomSizeComparator__IndexRoomData(Na__Raw);

let Na__Passed = 0;
const Na__Failures = [];
const Na__Check = (Na__Name, Na__Ok, Na__Detail = "") => {
    if (Na__Ok) Na__Passed += 1;
    else Na__Failures.push(`${Na__Name}${Na__Detail ? ` -> ${Na__Detail}` : ""}`);
};
const Na__Near = (Na__A, Na__B, Na__Eps = 1e-6) => Math.abs(Na__A - Na__B) < Na__Eps;


// -----------------------------------------------------------------------------
// REGION | Units: parsing
// -----------------------------------------------------------------------------
{
    const P = Units.Na__RoomSizeComparator__ParseAreaInput;
    Na__Check("area 12.5 m2",          Na__Near(P("12.5", "m2").Na__AreaM2, 12.5));
    Na__Check("area decimal comma",    Na__Near(P("12,5", "m2").Na__AreaM2, 12.5));
    Na__Check("area thousands comma",  Na__Near(P("1,250", "ft2").Na__AreaM2, 1250 / 10.7639104167));
    Na__Check("area '12.5 m2' not 12.52", Na__Near(P("12.5 m2", "m2").Na__AreaM2, 12.5), String(P("12.5 m2", "m2").Na__AreaM2));
    Na__Check("area '150 sq ft' typed in m2 mode", Na__Near(P("150 sq ft", "m2").Na__AreaM2, 150 / 10.7639104167) && P("150 sq ft", "m2").Na__Note === "ft");
    Na__Check("area '14 m²' typed in ft2 mode", Na__Near(P("14 m²", "ft2").Na__AreaM2, 14) && P("14 m²", "ft2").Na__Note === "m");
    Na__Check("area empty is null",    P("  ", "m2").Na__AreaM2 === null);
    Na__Check("area text is NaN",      Number.isNaN(P("abc", "m2").Na__AreaM2));
    Na__Check("area zero is NaN",      Number.isNaN(P("0", "m2").Na__AreaM2));

    const L = Units.Na__RoomSizeComparator__ParseLengthInput;
    Na__Check("length 3.6 m",          Na__Near(L("3.6", "m2").Na__LengthM, 3.6));
    Na__Check("length 3600 read as mm", Na__Near(L("3600", "m2").Na__LengthM, 3.6) && L("3600", "m2").Na__Note === "mm");
    Na__Check("length 3600mm",         Na__Near(L("3600mm", "m2").Na__LengthM, 3.6));
    Na__Check("length 360cm",          Na__Near(L("360cm", "m2").Na__LengthM, 3.6));
    Na__Check("length 12'6\" in ft",   Na__Near(L("12'6\"", "ft2").Na__LengthM, 12.5 / 3.28083989501, 1e-9));
    Na__Check("length 12ft 6in",       Na__Near(L("12ft 6in", "ft2").Na__LengthM, 12.5 / 3.28083989501, 1e-9));
    Na__Check("length 12' typed in m2 mode", Na__Near(L("12'", "m2").Na__LengthM, 12 / 3.28083989501, 1e-9) && L("12'", "m2").Na__Note === "ft");
    Na__Check("length 12 in ft mode",  Na__Near(L("12", "ft2").Na__LengthM, 3.6576, 1e-4));
    Na__Check("length 3.6m in ft mode", Na__Near(L("3.6m", "ft2").Na__LengthM, 3.6));
}
// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Units: formatting and round trips
// -----------------------------------------------------------------------------
{
    const A = Units.Na__RoomSizeComparator__FormatArea;
    Na__Check("format 13 m²",          A(13, "m2") === "13 m²", A(13, "m2"));
    Na__Check("format 7.5 m²",         A(7.5, "m2") === "7.5 m²", A(7.5, "m2"));
    Na__Check("format 13 m² as ft²",   A(13, "ft2") === "140 ft²", A(13, "ft2"));
    Na__Check("format measured 13.0",  A(13.006, "m2", "measured") === "13.0 m²", A(13.006, "m2", "measured"));
    Na__Check("format 1.5 m² as ft²",  A(1.5, "ft2") === "16 ft²", A(1.5, "ft2"));
    Na__Check("format feet-inches",    Units.Na__RoomSizeComparator__FormatLength(12.5 / 3.28083989501, "ft2") === "12′ 6″", Units.Na__RoomSizeComparator__FormatLength(12.5 / 3.28083989501, "ft2"));
    Na__Check("format dims short first", Units.Na__RoomSizeComparator__FormatDims(4, 3, "m2") === "3.0 × 4.0 m", Units.Na__RoomSizeComparator__FormatDims(4, 3, "m2"));

    const Na__M2 = 140 / 10.7639104167;
    const Na__Text = Units.Na__RoomSizeComparator__AreaInputText(Na__M2, "ft2");
    Na__Check("round trip 140 ft²",    Na__Text === "140" && Na__Near(Units.Na__RoomSizeComparator__ParseAreaInput(Na__Text, "ft2").Na__AreaM2, Na__M2));

    const Na__Len = Units.Na__RoomSizeComparator__LengthInputText(3.81, "ft2");
    Na__Check("round trip 3.81 m via ft-in", Na__Near(Units.Na__RoomSizeComparator__ParseLengthInput(Na__Len, "ft2").Na__LengthM, 3.81, 0.013), Na__Len);
}
// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Classification
// -----------------------------------------------------------------------------
{
    const C = RoomData.Na__RoomSizeComparator__ClassifyArea;
    const Na__Bed = Na__Index.Na__ById.get("bedroom");   // 7.5 / 10 / 13 / 16 / 20

    const Na__A = C(Na__Bed, 14);
    Na__Check("14 m² bedroom: between Medium and Large, nearest Medium", Na__A.Na__Kind === "between" && Na__A.Na__LowerIndex === 2 && Na__A.Na__NearestIndex === 2 && Na__Near(Na__A.Na__Over, 1) && Na__Near(Na__A.Na__Short, 2));

    const Na__B = C(Na__Bed, 7);
    Na__Check("7 m² bedroom: below Min by 0.5", Na__B.Na__Kind === "below" && Na__Near(Na__B.Na__Short, 0.5));

    const Na__C = C(Na__Bed, 25);
    Na__Check("25 m² bedroom: above O/S by 5", Na__C.Na__Kind === "above" && Na__Near(Na__C.Na__Over, 5));

    const Na__D = C(Na__Bed, 13.02);
    Na__Check("13.02 m² bedroom: exactly Medium", Na__D.Na__Kind === "exact" && Na__D.Na__NearestIndex === 2);

    const Na__E = C(Na__Bed, 140 / 10.7639104167, 0.5 / 10.7639104167);
    Na__Check("140 ft² bedroom: exactly Medium at ft² precision", Na__E.Na__Kind === "exact" && Na__E.Na__NearestIndex === 2);

    const Na__F = C(Na__Bed, 11.5);
    Na__Check("11.5 m² bedroom: halfway rounds down to Small", Na__F.Na__Kind === "between" && Na__F.Na__NearestIndex === 1);

    Na__Check("percent of Medium", Na__Near(C(Na__Bed, 13).Na__PercentOfMedium, 100));

    const Na__Axis = RoomData.Na__RoomSizeComparator__NiceAxis(37.8, 8);
    Na__Check("nice axis 37.8 -> step 5, max 40", Na__Axis.Na__Step === 5 && Na__Axis.Na__Max === 40, JSON.stringify(Na__Axis));

    const Na__Dims = RoomData.Na__RoomSizeComparator__DimsForArea(12, 1.33);
    Na__Check("dims keep the area", Na__Near(Na__Dims.Na__LongM * Na__Dims.Na__ShortM, 12) && Na__Near(Na__Dims.Na__LongM / Na__Dims.Na__ShortM, 1.33));
}
// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Data file integrity
// -----------------------------------------------------------------------------
{
    const Na__Keys = RoomData.Na__RoomSizeComparator__BandKeys;
    const Na__Ids  = new Set();
    const Na__Thin = [];

    Na__Index.Na__Rooms.forEach((Na__Room) => {
        const Na__Id = Na__Room.NaRoom__Id;
        Na__Check(`${Na__Id}: unique id`, !Na__Ids.has(Na__Id));
        Na__Ids.add(Na__Id);
        Na__Check(`${Na__Id}: known group`, Na__Index.Na__Groups.some((Na__G) => Na__G.NaGroup__Id === Na__Room.NaRoom__Group));

        (Na__Room.NaRoom__Sources || []).forEach((Na__S) => Na__Check(`${Na__Id}: source ${Na__S.NaSource__Ref} in library`, Boolean(Na__Index.Na__Library[Na__S.NaSource__Ref])));

        if (!Na__Room.Na__Comparable) {
            Na__Check(`${Na__Id}: excluded room marked No data`, Na__Room.NaRoom__Status === "No data");
            return;
        }

        const Na__V = Na__Room.Na__AreaList;
        Na__Check(`${Na__Id}: rises strictly`, Na__V.every((Na__X, Na__I) => Na__I === 0 || Na__X > Na__V[Na__I - 1]), Na__V.join("/"));
        Na__Check(`${Na__Id}: aspect 1 to 2`, Na__Room.Na__Aspect >= 1 && Na__Room.Na__Aspect <= 2);
        Object.keys(Na__Room.NaRoom__BandNotes || {}).forEach((Na__K) => Na__Check(`${Na__Id}: band note key ${Na__K}`, Na__Keys.includes(Na__K)));

        const Na__Obj = Na__Room.NaRoom__ScaleObject;
        if (Na__Obj) {
            Na__Check(`${Na__Id}: scale object size`, Na__Obj.NaObject__LengthM > 0 && Na__Obj.NaObject__WidthM > 0);
            const Na__MinDims = RoomData.Na__RoomSizeComparator__DimsForArea(Na__V[0], Na__Room.Na__Aspect);
            // The drawing shrinks its 300 mm wall offset to fit, so the piece itself must fit
            const Na__Long = Math.max(Na__Obj.NaObject__LengthM, Na__Obj.NaObject__WidthM);
            const Na__Short = Math.min(Na__Obj.NaObject__LengthM, Na__Obj.NaObject__WidthM);
            Na__Check(`${Na__Id}: scale object fits the Min box`, Na__Long <= Na__MinDims.Na__LongM && Na__Short <= Na__MinDims.Na__ShortM,
                `${Na__Long.toFixed(2)} x ${Na__Short.toFixed(2)} vs ${Na__MinDims.Na__LongM.toFixed(2)} x ${Na__MinDims.Na__ShortM.toFixed(2)}`);
        }

        const Na__Changed = Na__Keys.some((Na__K) => Number(Na__Room.NaRoom__OriginalAreas[Na__K]) !== Number(Na__Room.NaRoom__Areas[Na__K]));
        Na__Check(`${Na__Id}: status matches the values`, Na__Changed === (Na__Room.NaRoom__Status === "Adjusted"));

        if ((Na__Room.NaRoom__Sources || []).length < 4) Na__Thin.push(`${Na__Id} (${Na__Room.NaRoom__Sources.length})`);
    });

    console.log(`Rooms with fewer than 4 sources: ${Na__Thin.join(", ") || "none"}`);
}
// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Every row of the original sheet is kept, with its values
// -----------------------------------------------------------------------------
{
    const Na__Sheet = {
        "Living Room": [9, 16, 20, 25, 35], "Kitchen": [5, 8, 12, 16, 25], "Bedroom": [7, 10, 13, 16, 20],
        "Bedroom With Fitted Wardrobes": [6, 9, 12, 15, 19],
        "Bedroom Suite - Bedroom": [9, 12, 16, 20, 25], "Bedroom Suite - Dressing Area": [3, 4, 6, 8, 12],
        "Bedroom Suite - Ensuite Shower Room (Option 1)": [3, 4, 5, 7, 10], "Bedroom Suite - Ensuite Bathroom (Option 2)": [4, 5, 7, 9, 14],
        "Bathroom": [3, 4, 5, 7, 10], "Shower Room": [2, 3, 4, 6, 8], "Dining Room": [7, 10, 12, 16, 20], "Study/Office": [5, 8, 10, 12, 15],
        "Utility Room": [3, 4, 6, 8, 12], "Boot Room": [3, 4, 5, 7, 10], "Atrium": null, "Formal Dining Room": [10, 12, 15, 18, 25],
        "Granny Annex - Bedroom": [9, 12, 16, 20, 25], "Granny Annex - Kitchenette": [4, 5, 7, 9, 12], "Granny Annex - Lounge": [10, 12, 15, 18, 25],
        "Granny Annex - Accessible Bathroom": [3, 4, 5, 7, 10], "Playroom": [7, 10, 12, 16, 20], "Guest Room": [7, 10, 12, 16, 20],
        "Home Gym": [10, 15, 20, 25, 35], "Home Theater": [10, 12, 15, 18, 25], "Walk-in Wardrobe": [4, 6, 8, 10, 15], "Pantry": [2, 3, 4, 6, 8],
        "Wine Cellar": [4, 6, 8, 10, 15], "Sunroom": [6, 8, 10, 12, 15], "Laundry Room": [3, 4, 5, 7, 10], "Mudroom": [3, 4, 5, 7, 10],
        "Library": [7, 10, 12, 16, 20], "Music Room": [9, 12, 16, 20, 25], "Hobby Room": [9, 12, 16, 20, 25], "Game Room": [9, 12, 16, 20, 25],
        "Workshop": [9, 12, 16, 20, 25], "Nursery": [7, 10, 12, 16, 20], "Walk-in Closet": [4, 6, 8, 10, 15], "Home Bar": [4, 6, 8, 10, 15],
        "Home Spa": [10, 15, 20, 25, 35], "Home Office": [5, 8, 10, 12, 15], "Craft Room": [7, 10, 12, 16, 20], "Exercise Room": [9, 12, 16, 20, 25],
        "Meditation Room": [7, 10, 12, 16, 20], "Home Studio (art, or music / equiptment)": [9, 12, 16, 20, 25], "Home Classroom": [7, 10, 12, 16, 20],
        "Home Sauna": [4, 6, 8, 10, 15], "Wine Tasting Room": [7, 10, 12, 16, 20], "Greenhouse": [5, 8, 10, 12, 15], "Gallery": [7, 10, 12, 16, 20],
        "Home Cinema": [9, 12, 16, 20, 25], "Billiards Room": [10, 12, 15, 18, 25], "Breakfast Nook": [4, 6, 8, 10, 15], "Store Room": [3, 4, 6, 8, 12],
        "Pet Room": [4, 6, 8, 10, 15], "Reading Nook": [4, 6, 8, 10, 15], "Study Nook": [3, 4, 6, 8, 12]
    };

    const Na__Keys = RoomData.Na__RoomSizeComparator__BandKeys;
    const Na__Seen = new Map();

    Na__Index.Na__Rooms.forEach((Na__Room) => (Na__Room.NaRoom__SheetRows || []).forEach((Na__Row, Na__I) => {
        Na__Seen.set(Na__Row, (Na__Seen.get(Na__Row) || 0) + 1);
        const Na__Expected = Na__Sheet[Na__Row];
        Na__Check(`sheet row "${Na__Row}" is a real sheet row`, Na__Expected !== undefined);
        if (!Na__Expected) return;

        const Na__Stored = Na__I === 0
            ? Na__Room.NaRoom__OriginalAreas
            : ((Na__Room.NaRoom__MergedRows || []).find((Na__M) => Na__M.NaMerged__SheetName === Na__Row) || {}).NaMerged__Areas;
        const Na__Values = Na__Stored ? Na__Keys.map((Na__K) => Number(Na__Stored[Na__K])) : null;
        Na__Check(`sheet row "${Na__Row}" keeps its values`, JSON.stringify(Na__Values) === JSON.stringify(Na__Expected), `${JSON.stringify(Na__Values)} vs ${JSON.stringify(Na__Expected)}`);
    }));

    Object.keys(Na__Sheet).forEach((Na__Row) => Na__Check(`sheet row "${Na__Row}" appears exactly once`, Na__Seen.get(Na__Row) === 1, String(Na__Seen.get(Na__Row) || 0)));
    console.log(`Sheet rows: ${Object.keys(Na__Sheet).length}, room types: ${Na__Index.Na__Rooms.length}`);
}
// endregion -------------------------------------------------------------------


console.log(`\n${Na__Passed} checks passed, ${Na__Failures.length} failed.`);
if (Na__Failures.length) {
    Na__Failures.forEach((Na__F) => console.log(`  FAIL ${Na__F}`));
    process.exit(1);
}
