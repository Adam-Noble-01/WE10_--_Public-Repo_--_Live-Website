// =============================================================================
// NOBLE ARCHITECTURE - ROOM SIZE COMPARATOR - COMPARE VIEW
// =============================================================================
//
// FILE    : MiniApp__SpacePlanningUtils__RoomSizeComparator__CompareView__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : The words and tables beside the drawing: the verdict, a one-line
//           band strip, the band table (your room slotted in by size) and the
//           notes on where the figures came from
// CREATED : 16-Nov-2026
//
// - Every label from data or config goes in with textContent, never innerHTML.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Imports
// -----------------------------------------------------------------------------

// @delegate: ./MiniApp__SpacePlanningUtils__RoomSizeComparator__Units__.js
import {
    Na__RoomSizeComparator__AreaSymbol,
    Na__RoomSizeComparator__FormatArea,
    Na__RoomSizeComparator__FormatAreaNumber,
    Na__RoomSizeComparator__FormatDims,
    Na__RoomSizeComparator__OtherUnit
} from "./MiniApp__SpacePlanningUtils__RoomSizeComparator__Units__.js";

// @delegate: ./MiniApp__SpacePlanningUtils__RoomSizeComparator__RoomData__.js
import {
    Na__RoomSizeComparator__BandKeys,
    Na__RoomSizeComparator__BandLabel,
    Na__RoomSizeComparator__BandName,
    Na__RoomSizeComparator__DimsForArea,
    Na__RoomSizeComparator__NiceAxis,
    Na__RoomSizeComparator__ResolveSources
} from "./MiniApp__SpacePlanningUtils__RoomSizeComparator__RoomData__.js";

// @delegate: ./MiniApp__SpacePlanningUtils__RoomSizeComparator__PlanDrawing__.js
import { Na__RoomSizeComparator__Tint } from "./MiniApp__SpacePlanningUtils__RoomSizeComparator__PlanDrawing__.js";

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | DOM Helpers
// -----------------------------------------------------------------------------

// HELPER FUNCTION | Create an element with a class and optional text
// ------------------------------------------------------------
export function Na__RoomSizeComparator__El(Na__Tag, Na__Class = "", Na__Text = null, Na__Parent = null) {
    const Na__Node = document.createElement(Na__Tag);
    if (Na__Class) Na__Node.className = Na__Class;
    if (Na__Text !== null && Na__Text !== undefined) Na__Node.textContent = Na__Text;
    if (Na__Parent) Na__Parent.appendChild(Na__Node);
    return Na__Node;
}
// ------------------------------------------------------------


// HELPER FUNCTION | Fill {placeholders} in a config string
// ------------------------------------------------------------
export function Na__RoomSizeComparator__Fill(Na__Template, Na__Values) {
    return String(Na__Template || "").replace(/\{(\w+)\}/g, (Na__Match, Na__Key) =>
        Object.prototype.hasOwnProperty.call(Na__Values, Na__Key) ? String(Na__Values[Na__Key]) : Na__Match);
}
// ------------------------------------------------------------


// HELPER FUNCTION | Colour swatch for a band (tint fill, full-colour edge) or for your room
// ------------------------------------------------------------
export function Na__RoomSizeComparator__Swatch(Na__Colours, Na__BandKey, Na__Parent, Na__Variant = "tint") {
    const Na__Node = Na__RoomSizeComparator__El("span", "RSC__swatch", null, Na__Parent);
    Na__Node.setAttribute("aria-hidden", "true");

    if (Na__BandKey === "you") {
        Na__Node.classList.add("RSC__swatch--you");
        Na__Node.style.borderColor = Na__Colours.NaMiniApp__YourRoom;
        return Na__Node;
    }

    const Na__Colour = Na__Colours.NaMiniApp__BandRamp[Na__BandKey];
    Na__Node.style.background  = Na__Variant === "solid" ? Na__Colour : Na__RoomSizeComparator__Tint(Na__Colour, Number(Na__Colours.NaMiniApp__BandTintStrength) || 0.22);
    Na__Node.style.borderColor = Na__Colour;
    return Na__Node;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Verdict
// -----------------------------------------------------------------------------

// FUNCTION | Headline label for a classification ("About Medium", "Below minimum")
// ------------------------------------------------------------
export function Na__RoomSizeComparator__VerdictLabel(Na__Index, Na__Class, Na__Text) {
    if (!Na__Class) return "";
    if (Na__Class.Na__Kind === "below") return Na__Text.NaMiniApp__ChipBelowMin;
    if (Na__Class.Na__Kind === "above") return Na__Text.NaMiniApp__ChipAboveOs;
    return Na__RoomSizeComparator__Fill(Na__Text.NaMiniApp__ChipAbout, { band: Na__RoomSizeComparator__BandName(Na__Index, Na__Class.Na__NearestIndex) });
}
// ------------------------------------------------------------


// FUNCTION | One-sentence explanation of where the area sits
// ------------------------------------------------------------
export function Na__RoomSizeComparator__VerdictSentence(Na__Index, Na__Room, Na__Class, Na__AreaM2, Na__Unit, Na__Text) {
    const Na__Areas = Na__Room.Na__AreaList;
    const Na__Area  = (Na__M2) => Na__RoomSizeComparator__FormatArea(Na__M2, Na__Unit);
    const Na__Delta = (Na__M2) => Na__RoomSizeComparator__FormatArea(Na__M2, Na__Unit, "delta");
    const Na__Label = (Na__I) => Na__RoomSizeComparator__BandLabel(Na__Index, Na__I);

    if (Na__Class.Na__Kind === "below") {
        return Na__RoomSizeComparator__Fill(Na__Text.NaMiniApp__VerdictBelow, { short: Na__Delta(Na__Class.Na__Short), minArea: Na__Area(Na__Areas[0]) });
    }
    if (Na__Class.Na__Kind === "above") {
        return Na__RoomSizeComparator__Fill(Na__Text.NaMiniApp__VerdictAbove, { over: Na__Delta(Na__Class.Na__Over), osArea: Na__Area(Na__Areas[Na__Areas.length - 1]) });
    }
    if (Na__Class.Na__Kind === "exact") {
        return Na__RoomSizeComparator__Fill(Na__Text.NaMiniApp__VerdictExact, { band: Na__Label(Na__Class.Na__NearestIndex), area: Na__Area(Na__AreaM2) });
    }

    return Na__RoomSizeComparator__Fill(Na__Text.NaMiniApp__VerdictBetween, {
        lower     : Na__Label(Na__Class.Na__LowerIndex),
        lowerArea : Na__Area(Na__Areas[Na__Class.Na__LowerIndex]),
        upper     : Na__Label(Na__Class.Na__UpperIndex),
        upperArea : Na__Area(Na__Areas[Na__Class.Na__UpperIndex]),
        over      : Na__Delta(Na__Class.Na__Over),
        short     : Na__Delta(Na__Class.Na__Short)
    });
}
// ------------------------------------------------------------


// FUNCTION | Render the verdict card
// ------------------------------------------------------------
// Na__Model: { Na__Index, Na__Room, Na__Unit, Na__Text, Na__Colours, Na__YourRoom, Na__Class }
export function Na__RoomSizeComparator__RenderVerdict(Na__Host, Na__Model) {
    const Na__Room = Na__Model.Na__Room;
    const Na__Text = Na__Model.Na__Text;
    const Na__Unit = Na__Model.Na__Unit;
    Na__Host.replaceChildren();


    // No size yet: say what to do, and what a typical room of this type is
    // ------------------------------------
    const Na__Medium = Na__Room.Na__AreaList[2];
    const Na__MediumDims = Na__RoomSizeComparator__DimsForArea(Na__Medium, Na__Room.Na__Aspect);
    const Na__TypicalText = Na__RoomSizeComparator__Fill(Na__Text.NaMiniApp__TypicalLine, {
        room : Na__Room.NaRoom__Name.toLowerCase(),
        area : Na__RoomSizeComparator__FormatArea(Na__Medium, Na__Unit),
        dims : Na__RoomSizeComparator__FormatDims(Na__MediumDims.Na__LongM, Na__MediumDims.Na__ShortM, Na__Unit)
    });

    if (!Na__Model.Na__YourRoom) {
        Na__Host.classList.remove("RSC__card--verdict-set");
        Na__RoomSizeComparator__El("p", "RSC__eyebrow", Na__Room.NaRoom__Name, Na__Host);
        Na__RoomSizeComparator__El("h3", "RSC__verdict-title", Na__Text.NaMiniApp__VerdictEmptyTitle, Na__Host);
        Na__RoomSizeComparator__El("p", "RSC__verdict-text", Na__Text.NaMiniApp__VerdictEmptyText, Na__Host);
        Na__RoomSizeComparator__El("p", "RSC__verdict-typical", Na__TypicalText, Na__Host);
        return;
    }


    // The figure, both units, and the dimensions if they were typed
    // ------------------------------------
    const Na__You   = Na__Model.Na__YourRoom;
    const Na__Class = Na__Model.Na__Class;
    Na__Host.classList.add("RSC__card--verdict-set");

    Na__RoomSizeComparator__El("p", "RSC__eyebrow", `${Na__Text.NaMiniApp__YourRoomLabel} · ${Na__Room.NaRoom__Name}`, Na__Host);

    const Na__Figure = Na__RoomSizeComparator__El("div", "RSC__verdict-figure", null, Na__Host);
    Na__RoomSizeComparator__El("span", "RSC__verdict-big", Na__RoomSizeComparator__FormatArea(Na__You.Na__AreaM2, Na__Unit, "measured"), Na__Figure);
    Na__RoomSizeComparator__El("span", "RSC__verdict-alt", Na__RoomSizeComparator__FormatArea(Na__You.Na__AreaM2, Na__RoomSizeComparator__OtherUnit(Na__Unit), "measured"), Na__Figure);

    if (Na__You.Na__FromDims) {
        Na__RoomSizeComparator__El("p", "RSC__verdict-dims", Na__RoomSizeComparator__FormatDims(Na__You.Na__LongM, Na__You.Na__ShortM, Na__Unit, 2), Na__Host);
    }


    // Chip: band colour + words; below minimum also carries a warning icon
    // ------------------------------------
    const Na__Chip = Na__RoomSizeComparator__El("div", `RSC__chip RSC__chip--${Na__Class.Na__Kind}`, null, Na__Host);
    if (Na__Class.Na__Kind === "below") {
        Na__RoomSizeComparator__El("span", "RSC__chip-icon", "!", Na__Chip).setAttribute("aria-hidden", "true");
    } else {
        const Na__Key = Na__RoomSizeComparator__BandKeys[Math.min(Na__Class.Na__NearestIndex, Na__RoomSizeComparator__BandKeys.length - 1)];
        Na__RoomSizeComparator__Swatch(Na__Model.Na__Colours, Na__Key, Na__Chip, "solid");
    }
    Na__RoomSizeComparator__El("span", "", Na__RoomSizeComparator__VerdictLabel(Na__Model.Na__Index, Na__Class, Na__Text), Na__Chip);


    // Sentence, % of typical, and the Min note when it is below the minimum
    // ------------------------------------
    Na__RoomSizeComparator__El("p", "RSC__verdict-text",
        Na__RoomSizeComparator__VerdictSentence(Na__Model.Na__Index, Na__Room, Na__Class, Na__You.Na__AreaM2, Na__Unit, Na__Text), Na__Host);

    Na__RoomSizeComparator__El("p", "RSC__verdict-pct", Na__RoomSizeComparator__Fill(Na__Text.NaMiniApp__PercentOfTypical, {
        pct  : `${Math.round(Na__Class.Na__PercentOfMedium)}%`,
        room : Na__Room.NaRoom__Name.toLowerCase()
    }), Na__Host);

    const Na__MinNote = Na__Room.NaRoom__BandNotes && Na__Room.NaRoom__BandNotes.Min;
    if (Na__Class.Na__Kind === "below" && Na__MinNote) {
        Na__RoomSizeComparator__El("p", "RSC__verdict-warning", `${Na__RoomSizeComparator__BandLabel(Na__Model.Na__Index, 0)}: ${Na__MinNote}.`, Na__Host);
    }
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Band Strip
// -----------------------------------------------------------------------------

// FUNCTION | One-line scale: the five bands as dots, your room as an orange line
// ------------------------------------------------------------
export function Na__RoomSizeComparator__RenderBandStrip(Na__Host, Na__Model) {
    const Na__Room  = Na__Model.Na__Room;
    const Na__Unit  = Na__Model.Na__Unit;
    const Na__C     = Na__Model.Na__Colours;
    const Na__Areas = Na__Room.Na__AreaList;
    const Na__You   = Na__Model.Na__YourRoom;
    Na__Host.replaceChildren();

    const Na__Top  = Math.max(Na__Areas[Na__Areas.length - 1], Na__You ? Na__You.Na__AreaM2 : 0) * 1.06;
    const Na__Axis = Na__RoomSizeComparator__NiceAxis(Na__Top, 5);
    const Na__Pct  = (Na__M2) => `${Math.min(100, (Na__M2 / Na__Axis.Na__Max) * 100)}%`;

    const Na__Track = Na__RoomSizeComparator__El("div", "RSC__strip-track", null, Na__Host);
    Na__Track.setAttribute("aria-hidden", "true");

    const Na__Range = Na__RoomSizeComparator__El("span", "RSC__strip-range", null, Na__Track);
    Na__Range.style.left  = Na__Pct(Na__Areas[0]);
    Na__Range.style.width = `calc(${Na__Pct(Na__Areas[Na__Areas.length - 1])} - ${Na__Pct(Na__Areas[0])})`;

    const Na__Labels = Na__RoomSizeComparator__El("div", "RSC__strip-labels", null, Na__Host);
    Na__Labels.setAttribute("aria-hidden", "true");

    Na__Areas.forEach((Na__Area, Na__I) => {
        const Na__Key = Na__RoomSizeComparator__BandKeys[Na__I];
        const Na__Dot = Na__RoomSizeComparator__El("span", "RSC__strip-dot", null, Na__Track);
        Na__Dot.style.left = Na__Pct(Na__Area);
        Na__Dot.style.background = Na__C.NaMiniApp__BandRamp[Na__Key];

        const Na__Label = Na__RoomSizeComparator__El("span", "RSC__strip-label", null, Na__Labels);
        Na__Label.style.left = Na__Pct(Na__Area);
        Na__RoomSizeComparator__El("strong", "", Na__RoomSizeComparator__BandLabel(Na__Model.Na__Index, Na__I), Na__Label);
        Na__RoomSizeComparator__El("span", "", Na__RoomSizeComparator__FormatArea(Na__Area, Na__Unit), Na__Label);
    });

    if (Na__You) {
        const Na__Marker = Na__RoomSizeComparator__El("span", "RSC__strip-you", null, Na__Track);
        Na__Marker.style.left = Na__Pct(Na__You.Na__AreaM2);
        Na__Marker.style.background = Na__C.NaMiniApp__YourRoom;
    }


    // Keep end labels inside the card, then stagger touching labels onto more rows
    // ------------------------------------
    const Na__Container = Na__Labels.clientWidth;
    const Na__RowEnds   = [-Infinity, -Infinity, -Infinity];
    let Na__RowsUsed    = 1;

    Array.from(Na__Labels.children).forEach((Na__Label) => {
        const Na__Width  = Na__Label.offsetWidth;
        const Na__Anchor = Na__Label.offsetLeft;
        let Na__Left     = Na__Anchor - Na__Width / 2;

        if (Na__Left < 0) {
            Na__Label.classList.add("RSC__strip-label--start");
            Na__Left = Na__Anchor;
        } else if (Na__Left + Na__Width > Na__Container) {
            Na__Label.classList.add("RSC__strip-label--end");
            Na__Left = Na__Anchor - Na__Width;
        }

        let Na__Row = Na__RowEnds.findIndex((Na__End) => Na__Left >= Na__End + 6);
        if (Na__Row < 0) Na__Row = Na__RowEnds.length - 1;
        Na__RowEnds[Na__Row] = Na__Left + Na__Width;
        Na__RowsUsed = Math.max(Na__RowsUsed, Na__Row + 1);
        Na__Label.style.setProperty("--rsc-row", String(Na__Row));
    });

    Na__Labels.style.setProperty("--rsc-rows", String(Na__RowsUsed));
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Band Table
// -----------------------------------------------------------------------------

// FUNCTION | Bands as rows, with your room slotted in by size
// ------------------------------------------------------------
export function Na__RoomSizeComparator__RenderBandTable(Na__Table, Na__Model) {
    const Na__Room  = Na__Model.Na__Room;
    const Na__Unit  = Na__Model.Na__Unit;
    const Na__Text  = Na__Model.Na__Text;
    const Na__C     = Na__Model.Na__Colours;
    const Na__You   = Na__Model.Na__YourRoom;
    const Na__Class = Na__Model.Na__Class;
    const Na__Other = Na__RoomSizeComparator__OtherUnit(Na__Unit);
    Na__Table.replaceChildren();


    // Header
    // ------------------------------------
    const Na__Head = Na__RoomSizeComparator__El("thead", "", null, Na__Table);
    const Na__HeadRow = Na__RoomSizeComparator__El("tr", "", null, Na__Head);
    [Na__Text.NaMiniApp__BandHead, Na__Text.NaMiniApp__AreaHead, Na__Text.NaMiniApp__SizeHead].forEach((Na__Label) => {
        Na__RoomSizeComparator__El("th", "", Na__Label, Na__HeadRow).setAttribute("scope", "col");
    });

    const Na__Body = Na__RoomSizeComparator__El("tbody", "", null, Na__Table);


    // One row: name (+ note), area in both units, dimensions
    // ------------------------------------
    const Na__AddRow = (Na__Opts) => {
        const Na__Row  = Na__RoomSizeComparator__El("tr", Na__Opts.Na__Class, null, Na__Body);
        const Na__Name = Na__RoomSizeComparator__El("th", "RSC__band-name", null, Na__Row);
        Na__Name.setAttribute("scope", "row");
        Na__RoomSizeComparator__Swatch(Na__C, Na__Opts.Na__Key, Na__Name);
        Na__RoomSizeComparator__El("strong", "", Na__Opts.Na__Label, Na__Name);
        if (Na__Opts.Na__Note) Na__RoomSizeComparator__El("span", "RSC__band-note", Na__Opts.Na__Note, Na__Name);

        const Na__AreaCell = Na__RoomSizeComparator__El("td", "RSC__band-area", null, Na__Row);
        Na__RoomSizeComparator__El("span", "", Na__RoomSizeComparator__FormatArea(Na__Opts.Na__AreaM2, Na__Unit, Na__Opts.Na__Mode), Na__AreaCell);
        Na__RoomSizeComparator__El("span", "RSC__alt", Na__RoomSizeComparator__FormatArea(Na__Opts.Na__AreaM2, Na__Other, Na__Opts.Na__Mode), Na__AreaCell);

        Na__RoomSizeComparator__El("td", "RSC__band-dims", Na__Opts.Na__Dims, Na__Row);
    };

    const Na__YouRow = () => Na__AddRow({
        Na__Class  : "RSC__you-row",
        Na__Key    : "you",
        Na__Label  : Na__Text.NaMiniApp__YourRoomLabel,
        Na__Note   : Na__RoomSizeComparator__VerdictLabel(Na__Model.Na__Index, Na__Class, Na__Text),
        Na__AreaM2 : Na__You.Na__AreaM2,
        Na__Mode   : "measured",
        Na__Dims   : `${Na__You.Na__FromDims ? "" : "≈ "}${Na__RoomSizeComparator__FormatDims(Na__You.Na__LongM, Na__You.Na__ShortM, Na__Unit, Na__You.Na__FromDims ? 2 : 1)}`
    });

    let Na__YouPlaced = !Na__You;
    Na__Room.Na__AreaList.forEach((Na__Area, Na__I) => {
        if (!Na__YouPlaced && Na__You.Na__AreaM2 < Na__Area) { Na__YouRow(); Na__YouPlaced = true; }

        const Na__Key  = Na__RoomSizeComparator__BandKeys[Na__I];
        const Na__Dims = Na__RoomSizeComparator__DimsForArea(Na__Area, Na__Room.Na__Aspect);
        const Na__Band = Na__Model.Na__Index.Na__Bands[Na__I] || {};
        const Na__Note = (Na__Room.NaRoom__BandNotes && Na__Room.NaRoom__BandNotes[Na__Key]) || Na__Band.NaBand__Meaning || "";
        const Na__IsNearest = Na__Class && Na__Class.Na__NearestIndex === Na__I;

        Na__AddRow({
            Na__Class  : `RSC__band-row${Na__IsNearest ? " RSC__band-row--nearest" : ""}`,
            Na__Key    : Na__Key,
            Na__Label  : Na__RoomSizeComparator__BandLabel(Na__Model.Na__Index, Na__I),
            Na__Note   : Na__Note,
            Na__AreaM2 : Na__Area,
            Na__Mode   : "reference",
            Na__Dims   : Na__RoomSizeComparator__FormatDims(Na__Dims.Na__LongM, Na__Dims.Na__ShortM, Na__Unit)
        });
    });

    if (!Na__YouPlaced) Na__YouRow();
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Notes On The Figures
// -----------------------------------------------------------------------------

// FUNCTION | Notes, what changed from the sheet, evidence and a link to the sources
// ------------------------------------------------------------
// Na__OnShowSources(roomId) opens the Data & Sources view at this room.
export function Na__RoomSizeComparator__RenderRoomNotes(Na__Host, Na__Model, Na__OnShowSources) {
    const Na__Room  = Na__Model.Na__Room;
    const Na__Unit  = Na__Model.Na__Unit;
    const Na__Text  = Na__Model.Na__Text;
    const Na__Index = Na__Model.Na__Index;
    Na__Host.replaceChildren();

    Na__RoomSizeComparator__El("h3", "RSC__card-title", Na__Text.NaMiniApp__NotesTitle, Na__Host);
    Na__RoomSizeComparator__El("p", "RSC__notes-text", Na__Room.NaRoom__Notes || "", Na__Host);


    // Values changed from the sheet, band by band
    // ------------------------------------
    if (Na__Room.NaRoom__Status === "Adjusted" && Na__Room.NaRoom__OriginalAreas) {
        const Na__Changes = Na__RoomSizeComparator__BandKeys
            .map((Na__Key, Na__I) => ({ Na__I, Na__Was: Number(Na__Room.NaRoom__OriginalAreas[Na__Key]), Na__Now: Na__Room.Na__AreaList[Na__I] }))
            .filter((Na__Change) => Math.abs(Na__Change.Na__Was - Na__Change.Na__Now) > 1e-9);

        if (Na__Changes.length) {
            const Na__Box = Na__RoomSizeComparator__El("div", "RSC__changes", null, Na__Host);
            Na__RoomSizeComparator__El("strong", "", Na__Text.NaMiniApp__AdjustedLead, Na__Box);
            const Na__List = Na__RoomSizeComparator__El("ul", "", null, Na__Box);
            Na__Changes.forEach((Na__Change) => {
                Na__RoomSizeComparator__El("li", "", `${Na__RoomSizeComparator__BandLabel(Na__Index, Na__Change.Na__I)}: ${Na__RoomSizeComparator__FormatArea(Na__Change.Na__Was, Na__Unit)} → ${Na__RoomSizeComparator__FormatArea(Na__Change.Na__Now, Na__Unit)}`, Na__List);
            });
        }
    }


    // Rows merged into this one
    // ------------------------------------
    if (Array.isArray(Na__Room.NaRoom__MergedRows) && Na__Room.NaRoom__MergedRows.length) {
        const Na__Box = Na__RoomSizeComparator__El("div", "RSC__changes RSC__changes--merged", null, Na__Host);
        Na__RoomSizeComparator__El("strong", "", Na__Text.NaMiniApp__MergedLead, Na__Box);
        const Na__List = Na__RoomSizeComparator__El("ul", "", null, Na__Box);
        Na__Room.NaRoom__MergedRows.forEach((Na__Merged) => {
            const Na__Values = Na__RoomSizeComparator__BandKeys
                .map((Na__Key) => Na__RoomSizeComparator__FormatAreaNumber(Number(Na__Merged.NaMerged__Areas[Na__Key]), Na__Unit))
                .join(" / ");
            Na__RoomSizeComparator__El("li", "", `${Na__Merged.NaMerged__SheetName}: ${Na__Values} ${Na__RoomSizeComparator__AreaSymbol(Na__Unit)}`, Na__List);
        });
    }


    // Evidence and sources
    // ------------------------------------
    const Na__Sources = Na__RoomSizeComparator__ResolveSources(Na__Index, Na__Room);
    const Na__UkCount = Na__Sources.filter((Na__Source) => Na__Source.Na__Region === "UK").length;
    const Na__Meta    = Na__RoomSizeComparator__El("div", "RSC__notes-meta", null, Na__Host);

    const Na__Pill = Na__RoomSizeComparator__El("span", `RSC__pill RSC__pill--evidence-${String(Na__Room.NaRoom__Evidence || "none").toLowerCase()}`, null, Na__Meta);
    Na__Pill.textContent = `${Na__Text.NaMiniApp__EvidenceLabel}: ${Na__Room.NaRoom__Evidence}`;
    Na__RoomSizeComparator__El("span", "RSC__notes-count", `${Na__Sources.length} sources, ${Na__UkCount} UK`, Na__Meta);

    if (Na__Sources.length) {
        const Na__Link = Na__RoomSizeComparator__El("button", "RSC__link-btn", Na__RoomSizeComparator__Fill(Na__Text.NaMiniApp__SourcesLink, { count: Na__Sources.length }), Na__Meta);
        Na__Link.type = "button";
        Na__Link.addEventListener("click", () => Na__OnShowSources(Na__Room.NaRoom__Id));
    }

    if (Array.isArray(Na__Room.NaRoom__Aliases) && Na__Room.NaRoom__Aliases.length) {
        Na__RoomSizeComparator__El("p", "RSC__notes-aliases", `Also called: ${Na__Room.NaRoom__Aliases.join(", ")}`, Na__Host);
    }
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
