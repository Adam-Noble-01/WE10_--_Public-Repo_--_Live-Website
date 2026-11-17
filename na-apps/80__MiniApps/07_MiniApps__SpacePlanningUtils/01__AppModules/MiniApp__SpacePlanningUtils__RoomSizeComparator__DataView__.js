// =============================================================================
// NOBLE ARCHITECTURE - ROOM SIZE COMPARATOR - DATA VIEW
// =============================================================================
//
// FILE    : MiniApp__SpacePlanningUtils__RoomSizeComparator__DataView__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Show every figure, what changed from the original sheet and why,
//           and the sources behind each room; copy the table for Google Sheets
// CREATED : 16-Nov-2026
//
// - This view is also the table twin of the drawing and the All Rooms chart:
//   every value shown graphically elsewhere can be read here.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Imports
// -----------------------------------------------------------------------------

// @delegate: ./MiniApp__SpacePlanningUtils__RoomSizeComparator__Units__.js
import {
    Na__RoomSizeComparator__AreaFromM2,
    Na__RoomSizeComparator__AreaSymbol,
    Na__RoomSizeComparator__FormatAreaNumber
} from "./MiniApp__SpacePlanningUtils__RoomSizeComparator__Units__.js";

// @delegate: ./MiniApp__SpacePlanningUtils__RoomSizeComparator__RoomData__.js
import {
    Na__RoomSizeComparator__BandKeys,
    Na__RoomSizeComparator__BandLabel,
    Na__RoomSizeComparator__GroupLabel,
    Na__RoomSizeComparator__GroupRooms,
    Na__RoomSizeComparator__ResolveSources
} from "./MiniApp__SpacePlanningUtils__RoomSizeComparator__RoomData__.js";

// @delegate: ./MiniApp__SpacePlanningUtils__RoomSizeComparator__CompareView__.js
import { Na__RoomSizeComparator__El } from "./MiniApp__SpacePlanningUtils__RoomSizeComparator__CompareView__.js";

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Intro
// -----------------------------------------------------------------------------

// FUNCTION | Method, cleaning notes, band meanings and evidence scale
// ------------------------------------------------------------
export function Na__RoomSizeComparator__RenderDataIntro(Na__Host, Na__Model) {
    const Na__Index = Na__Model.Na__Index;
    const Na__Meta  = Na__Index.Na__Meta;
    const Na__Text  = Na__Model.Na__Text;
    Na__Host.replaceChildren();


    // Counts that summarise the validation
    // ------------------------------------
    const Na__Rooms      = Na__Index.Na__Rooms;
    const Na__Comparable = Na__Rooms.filter((Na__Room) => Na__Room.Na__Comparable).length;
    const Na__Adjusted   = Na__Rooms.filter((Na__Room) => Na__Room.NaRoom__Status === "Adjusted").length;
    const Na__Merged     = Na__Rooms.reduce((Na__Sum, Na__Room) => Na__Sum + ((Na__Room.NaRoom__MergedRows || []).length), 0);
    const Na__UsedRefs   = new Set(Na__Rooms.flatMap((Na__Room) => (Na__Room.NaRoom__Sources || []).map((Na__S) => Na__S.NaSource__Ref)));
    const Na__Library    = [...Na__UsedRefs].map((Na__Ref) => Na__Index.Na__Library[Na__Ref]).filter(Boolean);
    const Na__UkCount    = Na__Library.filter((Na__S) => Na__S.NaSource__Region === "UK").length;
    const Na__Opened     = Na__Library.filter((Na__S) => Na__S.NaSource__Checked === "Opened").length;

    Na__RoomSizeComparator__El("h2", "RSC__card-title", Na__Text.NaMiniApp__DataTitle, Na__Host);
    Na__RoomSizeComparator__El("p", "RSC__prose-lead",
        `${Na__Meta.NaRoomData__Title}: ${Na__Comparable} room types with figures, checked on ${Na__Meta.NaRoomData__Validated} against ${Na__Library.length} published sources (${Na__UkCount} UK, ${Na__Opened} read in full, the rest seen in search results). ${Na__Adjusted} room types were adjusted and ${Na__Merged} duplicate rows merged.`, Na__Host);

    Na__RoomSizeComparator__El("p", "", Na__Meta.NaRoomData__Method || "", Na__Host);
    Na__RoomSizeComparator__El("p", "RSC__prose-note", `${Na__Meta.NaRoomData__UnitNote || ""} ${Na__Meta.NaRoomData__SourceSheet || ""}`.trim(), Na__Host);


    // Two columns: bands and evidence on the left, cleaning on the right
    // ------------------------------------
    const Na__Cols = Na__RoomSizeComparator__El("div", "RSC__prose-cols", null, Na__Host);

    const Na__Left = Na__RoomSizeComparator__El("div", "", null, Na__Cols);
    Na__RoomSizeComparator__El("h3", "RSC__prose-head", "Size bands", Na__Left);
    const Na__BandList = Na__RoomSizeComparator__El("dl", "RSC__def-list", null, Na__Left);
    Na__Index.Na__Bands.forEach((Na__Band) => {
        Na__RoomSizeComparator__El("dt", "", Na__Band.NaBand__Label, Na__BandList);
        Na__RoomSizeComparator__El("dd", "", Na__Band.NaBand__Meaning, Na__BandList);
    });

    Na__RoomSizeComparator__El("h3", "RSC__prose-head", "Evidence ratings", Na__Left);
    const Na__EvidenceList = Na__RoomSizeComparator__El("dl", "RSC__def-list", null, Na__Left);
    Object.entries(Na__Meta.NaRoomData__EvidenceScale || {}).forEach(([Na__Level, Na__Meaning]) => {
        const Na__Term = Na__RoomSizeComparator__El("dt", "", null, Na__EvidenceList);
        Na__RoomSizeComparator__El("span", `RSC__pill RSC__pill--evidence-${Na__Level.toLowerCase()}`, Na__Level, Na__Term);
        Na__RoomSizeComparator__El("dd", "", Na__Meaning, Na__EvidenceList);
    });

    const Na__Right = Na__RoomSizeComparator__El("div", "", null, Na__Cols);
    Na__RoomSizeComparator__El("h3", "RSC__prose-head", "What was cleaned", Na__Right);
    const Na__CleanList = Na__RoomSizeComparator__El("ul", "RSC__prose-list", null, Na__Right);
    (Na__Meta.NaRoomData__Cleaning || []).forEach((Na__Line) => Na__RoomSizeComparator__El("li", "", Na__Line, Na__CleanList));
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Figures Table
// -----------------------------------------------------------------------------

// HELPER FUNCTION | Details row: notes, changes, merged rows and numbered sources
// ------------------------------------------------------------
function Na__RoomSizeComparator__BuildDetails(Na__Cell, Na__Index, Na__Room, Na__Unit) {
    Na__RoomSizeComparator__El("p", "RSC__detail-notes", Na__Room.NaRoom__Notes || "", Na__Cell);

    const Na__Facts = [];
    if (Array.isArray(Na__Room.NaRoom__SheetRows) && Na__Room.NaRoom__SheetRows.length) {
        Na__Facts.push(`Sheet row${Na__Room.NaRoom__SheetRows.length > 1 ? "s" : ""}: ${Na__Room.NaRoom__SheetRows.join("; ")}`);
    }
    if (Na__Room.NaRoom__Status === "Adjusted" && Na__Room.NaRoom__OriginalAreas) {
        const Na__Was = Na__RoomSizeComparator__BandKeys.map((Na__Key) => Na__RoomSizeComparator__FormatAreaNumber(Number(Na__Room.NaRoom__OriginalAreas[Na__Key]), Na__Unit)).join(" / ");
        Na__Facts.push(`Sheet values: ${Na__Was} ${Na__RoomSizeComparator__AreaSymbol(Na__Unit)}`);
    }
    (Na__Room.NaRoom__MergedRows || []).forEach((Na__Merged) => {
        const Na__Values = Na__RoomSizeComparator__BandKeys.map((Na__Key) => Na__RoomSizeComparator__FormatAreaNumber(Number(Na__Merged.NaMerged__Areas[Na__Key]), Na__Unit)).join(" / ");
        Na__Facts.push(`Merged: ${Na__Merged.NaMerged__SheetName} (${Na__Values} ${Na__RoomSizeComparator__AreaSymbol(Na__Unit)})`);
    });
    if (Array.isArray(Na__Room.NaRoom__Aliases) && Na__Room.NaRoom__Aliases.length) Na__Facts.push(`Also called: ${Na__Room.NaRoom__Aliases.join(", ")}`);
    if (Na__Room.Na__Comparable) Na__Facts.push(`Drawn at a ${Na__Room.Na__Aspect} : 1 plan shape`);

    if (Na__Facts.length) {
        const Na__List = Na__RoomSizeComparator__El("ul", "RSC__detail-facts", null, Na__Cell);
        Na__Facts.forEach((Na__Fact) => Na__RoomSizeComparator__El("li", "", Na__Fact, Na__List));
    }

    const Na__Sources = Na__RoomSizeComparator__ResolveSources(Na__Index, Na__Room);
    if (!Na__Sources.length) {
        Na__RoomSizeComparator__El("p", "RSC__detail-empty", "No published figures found.", Na__Cell);
        return;
    }

    const Na__SourceList = Na__RoomSizeComparator__El("ol", "RSC__source-list", null, Na__Cell);
    Na__Sources.forEach((Na__Source) => {
        const Na__Item = Na__RoomSizeComparator__El("li", "", null, Na__SourceList);
        const Na__Head = Na__RoomSizeComparator__El("div", "RSC__source-head", null, Na__Item);

        if (Na__Source.Na__Url) {
            const Na__Link = Na__RoomSizeComparator__El("a", "RSC__source-link", `${Na__Source.Na__Publisher}: ${Na__Source.Na__Title}`, Na__Head);
            Na__Link.href   = Na__Source.Na__Url;
            Na__Link.target = "_blank";
            Na__Link.rel    = "noopener noreferrer";
        } else {
            Na__RoomSizeComparator__El("span", "RSC__source-link", `${Na__Source.Na__Publisher}: ${Na__Source.Na__Title}`, Na__Head);
        }

        const Na__Tags = Na__RoomSizeComparator__El("span", "RSC__source-tags", null, Na__Head);
        [Na__Source.Na__Type, Na__Source.Na__Region, Na__Source.Na__Checked === "Opened" ? "Read in full" : "Search result"]
            .filter(Boolean)
            .forEach((Na__Tag) => Na__RoomSizeComparator__El("span", "RSC__tag", Na__Tag, Na__Tags));

        Na__RoomSizeComparator__El("p", "RSC__source-figure", Na__Source.Na__Figure, Na__Item);
    });
}
// ------------------------------------------------------------


// FUNCTION | Render the figures table; Na__OpenRoomId expands and scrolls to a room
// ------------------------------------------------------------
export function Na__RoomSizeComparator__RenderDataTable(Na__Host, Na__Model, Na__OpenRoomId = null) {
    const Na__Index = Na__Model.Na__Index;
    const Na__Unit  = Na__Model.Na__Unit;
    Na__Host.replaceChildren();

    const Na__Table = Na__RoomSizeComparator__El("table", "RSC__data-table", null, Na__Host);
    const Na__Head  = Na__RoomSizeComparator__El("thead", "", null, Na__Table);
    const Na__HeadRow = Na__RoomSizeComparator__El("tr", "", null, Na__Head);
    const Na__Columns = ["Room type", ...Na__RoomSizeComparator__BandKeys.map((Na__K, Na__I) => Na__RoomSizeComparator__BandLabel(Na__Index, Na__I)), "Values", "Evidence", "Sources"];
    Na__Columns.forEach((Na__Label, Na__I) => {
        const Na__Th = Na__RoomSizeComparator__El("th", Na__I >= 1 && Na__I <= 5 ? "RSC__num" : "", Na__Label, Na__HeadRow);
        Na__Th.setAttribute("scope", "col");
        if (Na__I === 5) Na__Th.textContent = `${Na__Label} (${Na__RoomSizeComparator__AreaSymbol(Na__Unit)})`;
    });

    const Na__Body = Na__RoomSizeComparator__El("tbody", "", null, Na__Table);
    let Na__OpenRow = null;

    Na__RoomSizeComparator__GroupRooms(Na__Index, true).forEach((Na__Bucket) => {
        const Na__GroupRow  = Na__RoomSizeComparator__El("tr", "RSC__data-group", null, Na__Body);
        const Na__GroupCell = Na__RoomSizeComparator__El("th", "", Na__Bucket.Na__Group.NaGroup__Label, Na__GroupRow);
        Na__GroupCell.colSpan = Na__Columns.length;
        Na__GroupCell.setAttribute("scope", "colgroup");

        Na__Bucket.Na__Rooms.forEach((Na__Room) => {
            const Na__Row     = Na__RoomSizeComparator__El("tr", "RSC__data-row", null, Na__Body);
            const Na__NameCell = Na__RoomSizeComparator__El("th", "RSC__data-name", null, Na__Row);
            Na__NameCell.setAttribute("scope", "row");

            const Na__Toggle = Na__RoomSizeComparator__El("button", "RSC__data-toggle", Na__Room.NaRoom__ShortName || Na__Room.NaRoom__Name, Na__NameCell);
            Na__Toggle.type = "button";
            Na__Toggle.setAttribute("aria-expanded", "false");


            // Five figures; an adjusted figure shows the sheet's value under it
            // ------------------------------------
            Na__RoomSizeComparator__BandKeys.forEach((Na__Key, Na__I) => {
                const Na__Cell = Na__RoomSizeComparator__El("td", "RSC__num", null, Na__Row);
                if (!Na__Room.Na__Comparable) { Na__Cell.textContent = "–"; return; }

                Na__RoomSizeComparator__El("span", "", Na__RoomSizeComparator__FormatAreaNumber(Na__Room.Na__AreaList[Na__I], Na__Unit), Na__Cell);
                const Na__Was = Na__Room.NaRoom__OriginalAreas ? Number(Na__Room.NaRoom__OriginalAreas[Na__Key]) : Na__Room.Na__AreaList[Na__I];
                if (Math.abs(Na__Was - Na__Room.Na__AreaList[Na__I]) > 1e-9) {
                    Na__Cell.classList.add("RSC__num--changed");
                    Na__RoomSizeComparator__El("span", "RSC__was", `was ${Na__RoomSizeComparator__FormatAreaNumber(Na__Was, Na__Unit)}`, Na__Cell);
                }
            });

            const Na__StatusCell = Na__RoomSizeComparator__El("td", "", null, Na__Row);
            Na__RoomSizeComparator__El("span", `RSC__pill RSC__pill--status-${String(Na__Room.NaRoom__Status).toLowerCase().replace(/\s+/g, "-")}`, Na__Room.NaRoom__Status, Na__StatusCell);

            const Na__EvidenceCell = Na__RoomSizeComparator__El("td", "", null, Na__Row);
            Na__RoomSizeComparator__El("span", `RSC__pill RSC__pill--evidence-${String(Na__Room.NaRoom__Evidence).toLowerCase()}`, Na__Room.NaRoom__Evidence, Na__EvidenceCell);

            Na__RoomSizeComparator__El("td", "RSC__num", String((Na__Room.NaRoom__Sources || []).length), Na__Row);


            // Details row, built on first open
            // ------------------------------------
            const Na__DetailRow  = Na__RoomSizeComparator__El("tr", "RSC__data-detail", null, Na__Body);
            const Na__DetailCell = Na__RoomSizeComparator__El("td", "", null, Na__DetailRow);
            Na__DetailCell.colSpan = Na__Columns.length;
            Na__DetailRow.hidden = true;
            Na__DetailRow.id = `js__dataDetail__${Na__Room.NaRoom__Id}`;
            Na__Toggle.setAttribute("aria-controls", Na__DetailRow.id);

            const Na__SetOpen = (Na__Open) => {
                if (Na__Open && !Na__DetailCell.childElementCount) Na__RoomSizeComparator__BuildDetails(Na__DetailCell, Na__Index, Na__Room, Na__Unit);
                Na__DetailRow.hidden = !Na__Open;
                Na__Toggle.setAttribute("aria-expanded", String(Na__Open));
                Na__Row.classList.toggle("RSC__data-row--open", Na__Open);
            };
            Na__Toggle.addEventListener("click", () => Na__SetOpen(Na__DetailRow.hidden));

            if (Na__OpenRoomId === Na__Room.NaRoom__Id) {
                Na__SetOpen(true);
                Na__OpenRow = Na__Row;
            }
        });
    });

    return Na__OpenRow;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Copy For Google Sheets
// -----------------------------------------------------------------------------

// FUNCTION | Tab-separated table in the chosen unit, ready to paste into Sheets
// ------------------------------------------------------------
export function Na__RoomSizeComparator__BuildTsv(Na__Index, Na__Unit) {
    const Na__Clean = (Na__Value) => String(Na__Value ?? "").replace(/[\t\r\n]+/g, " ").trim();
    const Na__Symbol = Na__RoomSizeComparator__AreaSymbol(Na__Unit);
    const Na__Round  = (Na__M2) => {
        const Na__Value = Na__RoomSizeComparator__AreaFromM2(Na__M2, Na__Unit);
        return String(Number(Na__Value.toFixed(Na__Unit === "ft2" ? 0 : 2)));
    };

    const Na__Lines = [[
        "Group", "Room", ...Na__RoomSizeComparator__BandKeys.map((Na__K, Na__I) => `${Na__RoomSizeComparator__BandLabel(Na__Index, Na__I)} (${Na__Symbol})`),
        "Values", "Evidence", "Sources", "Sheet values (m²)", "Notes"
    ].join("\t")];

    Na__Index.Na__Rooms.forEach((Na__Room) => {
        const Na__Figures = Na__Room.Na__Comparable ? Na__Room.Na__AreaList.map(Na__Round) : Na__RoomSizeComparator__BandKeys.map(() => "");
        const Na__Sheet   = Na__Room.NaRoom__OriginalAreas
            ? Na__RoomSizeComparator__BandKeys.map((Na__Key) => Na__Room.NaRoom__OriginalAreas[Na__Key]).join(" / ")
            : "";

        Na__Lines.push([
            Na__RoomSizeComparator__GroupLabel(Na__Index, Na__Room.NaRoom__Group),
            Na__Room.NaRoom__Name,
            ...Na__Figures,
            Na__Room.NaRoom__Status,
            Na__Room.NaRoom__Evidence,
            (Na__Room.NaRoom__Sources || []).length,
            Na__Sheet,
            Na__Room.NaRoom__Notes
        ].map(Na__Clean).join("\t"));
    });

    return Na__Lines.join("\n");
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
