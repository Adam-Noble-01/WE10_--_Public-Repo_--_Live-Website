// =============================================================================
// NOBLE ARCHITECTURE - ROOM SIZE COMPARATOR - ALL ROOMS VIEW
// =============================================================================
//
// FILE    : MiniApp__SpacePlanningUtils__RoomSizeComparator__AllRoomsView__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Every room type on one shared scale: five band dots per row, with
//           your area as an orange line through them all
// CREATED : 16-Nov-2026
//
// - Rows are real buttons: click, Enter or Space opens the room in Compare.
// - Hover and keyboard focus show the same tooltip; every value in it is also
//   in the Data & Sources table, so nothing is hidden behind the hover.
// - The axis is fixed by the largest room in the whole data set, so filtering
//   never rescales the rows.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Imports
// -----------------------------------------------------------------------------

// @delegate: ./MiniApp__SpacePlanningUtils__RoomSizeComparator__Units__.js
import {
    Na__RoomSizeComparator__AreaFromM2,
    Na__RoomSizeComparator__AreaSymbol,
    Na__RoomSizeComparator__FormatArea,
    Na__RoomSizeComparator__FormatAreaNumber
} from "./MiniApp__SpacePlanningUtils__RoomSizeComparator__Units__.js";

// @delegate: ./MiniApp__SpacePlanningUtils__RoomSizeComparator__RoomData__.js
import {
    Na__RoomSizeComparator__BandKeys,
    Na__RoomSizeComparator__BandLabel,
    Na__RoomSizeComparator__ClassifyArea,
    Na__RoomSizeComparator__GetComparableRooms,
    Na__RoomSizeComparator__GroupLabel,
    Na__RoomSizeComparator__NiceAxis
} from "./MiniApp__SpacePlanningUtils__RoomSizeComparator__RoomData__.js";

// @delegate: ./MiniApp__SpacePlanningUtils__RoomSizeComparator__CompareView__.js
import {
    Na__RoomSizeComparator__El,
    Na__RoomSizeComparator__Swatch,
    Na__RoomSizeComparator__VerdictLabel
} from "./MiniApp__SpacePlanningUtils__RoomSizeComparator__CompareView__.js";

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

// HELPER FUNCTION | Does a room match the search text?
// ------------------------------------------------------------
function Na__RoomSizeComparator__MatchesFilter(Na__Index, Na__Room, Na__Filter) {
    const Na__Needle = String(Na__Filter || "").trim().toLowerCase();
    if (!Na__Needle) return true;

    const Na__Haystack = [
        Na__Room.NaRoom__Name,
        Na__Room.NaRoom__ShortName,
        Na__RoomSizeComparator__GroupLabel(Na__Index, Na__Room.NaRoom__Group),
        ...(Na__Room.NaRoom__Aliases || [])
    ].join(" ").toLowerCase();

    return Na__Needle.split(/\s+/).every((Na__Word) => Na__Haystack.includes(Na__Word));
}
// ------------------------------------------------------------


// HELPER FUNCTION | Track cell with gridlines, shared by header, group and room rows
// ------------------------------------------------------------
function Na__RoomSizeComparator__TrackCell(Na__Parent, Na__Axis, Na__YouPct, Na__Colours) {
    const Na__Track = Na__RoomSizeComparator__El("span", "RSC__ar-track", null, Na__Parent);
    Na__Track.style.setProperty("--rsc-grid-intervals", String(Na__Axis.Na__Intervals));

    if (Na__YouPct !== null) {
        const Na__You = Na__RoomSizeComparator__El("span", "RSC__ar-you", null, Na__Track);
        Na__You.style.left = Na__YouPct;
        Na__You.style.background = Na__Colours.NaMiniApp__YourRoom;
    }
    return Na__Track;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Tooltip
// -----------------------------------------------------------------------------

// FUNCTION | Show the tooltip for a room row, under the row near the pointer
// ------------------------------------------------------------
function Na__RoomSizeComparator__ShowRowTooltip(Na__Tooltip, Na__Row, Na__Room, Na__Model, Na__ClientX) {
    const Na__Unit = Na__Model.Na__Unit;
    Na__Tooltip.replaceChildren();

    Na__RoomSizeComparator__El("strong", "RSC__tooltip-title", Na__Room.NaRoom__Name, Na__Tooltip);

    const Na__List = Na__RoomSizeComparator__El("dl", "RSC__tooltip-list", null, Na__Tooltip);
    Na__Room.Na__AreaList.forEach((Na__Area, Na__I) => {
        const Na__Item = Na__RoomSizeComparator__El("div", "", null, Na__List);
        const Na__Term = Na__RoomSizeComparator__El("dt", "", null, Na__Item);
        Na__RoomSizeComparator__Swatch(Na__Model.Na__Colours, Na__RoomSizeComparator__BandKeys[Na__I], Na__Term, "solid");
        Na__RoomSizeComparator__El("span", "", Na__RoomSizeComparator__BandLabel(Na__Model.Na__Index, Na__I), Na__Term);
        Na__RoomSizeComparator__El("dd", "", Na__RoomSizeComparator__FormatArea(Na__Area, Na__Unit), Na__Item);
    });

    if (Na__Model.Na__AreaM2) {
        const Na__Class = Na__RoomSizeComparator__ClassifyArea(Na__Room, Na__Model.Na__AreaM2, Na__Model.Na__ToleranceM2);
        const Na__Line  = Na__RoomSizeComparator__El("p", "RSC__tooltip-you", null, Na__Tooltip);
        Na__RoomSizeComparator__Swatch(Na__Model.Na__Colours, "you", Na__Line);
        Na__RoomSizeComparator__El("span", "", `${Na__RoomSizeComparator__FormatArea(Na__Model.Na__AreaM2, Na__Unit, "measured")}: ${Na__RoomSizeComparator__VerdictLabel(Na__Model.Na__Index, Na__Class, Na__Model.Na__Text)}`, Na__Line);
    }

    Na__Tooltip.hidden = false;


    // Position: fixed, below the row, clamped to the window
    // ------------------------------------
    const Na__RowBox = Na__Row.getBoundingClientRect();
    const Na__TipBox = Na__Tooltip.getBoundingClientRect();
    const Na__X      = Number.isFinite(Na__ClientX) ? Na__ClientX : Na__RowBox.left + Na__RowBox.width / 2;
    const Na__Left   = Math.max(8, Math.min(window.innerWidth - Na__TipBox.width - 8, Na__X - Na__TipBox.width / 2));
    let Na__Top      = Na__RowBox.bottom + 6;
    if (Na__Top + Na__TipBox.height > window.innerHeight - 8) Na__Top = Na__RowBox.top - Na__TipBox.height - 6;

    Na__Tooltip.style.left = `${Math.round(Na__Left)}px`;
    Na__Tooltip.style.top  = `${Math.round(Na__Top)}px`;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Render
// -----------------------------------------------------------------------------

// FUNCTION | Render the legend and every room row
// ------------------------------------------------------------
// Na__Model: { Na__Index, Na__Unit, Na__AreaM2, Na__ToleranceM2, Na__RoomId, Na__Sort,
//              Na__Filter, Na__Colours, Na__Text, Na__Tooltip }
// Na__Handlers: { Na__OnSelectRoom(roomId) }
export function Na__RoomSizeComparator__RenderAllRooms(Na__Host, Na__Legend, Na__Model, Na__Handlers) {
    const Na__Index   = Na__Model.Na__Index;
    const Na__Unit    = Na__Model.Na__Unit;
    const Na__C       = Na__Model.Na__Colours;
    const Na__Text    = Na__Model.Na__Text;
    const Na__Tooltip = Na__Model.Na__Tooltip;
    const Na__AllRooms = Na__RoomSizeComparator__GetComparableRooms(Na__Index);

    Na__Host.replaceChildren();
    Na__Legend.replaceChildren();
    Na__Tooltip.hidden = true;


    // Axis in display units, fixed by the whole data set and your room
    // ------------------------------------
    const Na__MaxM2      = Math.max(...Na__AllRooms.map((Na__Room) => Na__Room.Na__AreaList[4]), Na__Model.Na__AreaM2 ? Na__Model.Na__AreaM2 * 1.04 : 0);
    const Na__AxisDisp   = Na__RoomSizeComparator__NiceAxis(Na__RoomSizeComparator__AreaFromM2(Na__MaxM2, Na__Unit), 8);
    const Na__Axis       = { ...Na__AxisDisp, Na__Intervals: Math.round(Na__AxisDisp.Na__Max / Na__AxisDisp.Na__Step) };
    const Na__Pct        = (Na__M2) => `${(Na__RoomSizeComparator__AreaFromM2(Na__M2, Na__Unit) / Na__Axis.Na__Max) * 100}%`;
    const Na__YouPct     = Na__Model.Na__AreaM2 ? Na__Pct(Na__Model.Na__AreaM2) : null;


    // Legend: the five band dots and your room's line
    // ------------------------------------
    Na__RoomSizeComparator__BandKeys.forEach((Na__Key, Na__I) => {
        const Na__Item = Na__RoomSizeComparator__El("span", "RSC__legend-item", null, Na__Legend);
        const Na__Dot  = Na__RoomSizeComparator__El("span", "RSC__legend-dot", null, Na__Item);
        Na__Dot.style.background = Na__C.NaMiniApp__BandRamp[Na__Key];
        Na__RoomSizeComparator__El("span", "", Na__RoomSizeComparator__BandLabel(Na__Index, Na__I), Na__Item);
    });
    const Na__YouItem = Na__RoomSizeComparator__El("span", "RSC__legend-item RSC__legend-item--you", null, Na__Legend);
    const Na__YouKey  = Na__RoomSizeComparator__El("span", "RSC__legend-line", null, Na__YouItem);
    Na__YouKey.style.background = Na__C.NaMiniApp__YourRoom;
    Na__RoomSizeComparator__El("span", "", Na__Model.Na__AreaM2
        ? `${Na__Text.NaMiniApp__YourRoomLabel}: ${Na__RoomSizeComparator__FormatArea(Na__Model.Na__AreaM2, Na__Unit, "measured")}`
        : `${Na__Text.NaMiniApp__YourRoomLabel}: enter a size above`, Na__YouItem);


    // Header row with the axis ticks
    // ------------------------------------
    const Na__Header = Na__RoomSizeComparator__El("div", "RSC__ar-row RSC__ar-row--header", null, Na__Host);
    Na__Header.setAttribute("aria-hidden", "true");
    Na__RoomSizeComparator__El("span", "RSC__ar-name", Na__Text.NaMiniApp__RoomTypeLabel, Na__Header);
    const Na__HeadTrack = Na__RoomSizeComparator__TrackCell(Na__Header, Na__Axis, null, Na__C);
    for (let Na__I = 0; Na__I <= Na__Axis.Na__Intervals; Na__I += 1) {
        const Na__Value = Na__I * Na__Axis.Na__Step;
        const Na__Tick  = Na__RoomSizeComparator__El("span", "RSC__ar-tick", null, Na__HeadTrack);
        Na__Tick.style.left = `${(Na__Value / Na__Axis.Na__Max) * 100}%`;
        Na__Tick.textContent = Na__I === Na__Axis.Na__Intervals
            ? `${Number(Na__Value.toFixed(2)).toLocaleString("en-GB")} ${Na__RoomSizeComparator__AreaSymbol(Na__Unit)}`
            : Number(Na__Value.toFixed(2)).toLocaleString("en-GB");
    }
    Na__RoomSizeComparator__El("span", "RSC__ar-chip RSC__ar-chip--head", Na__Text.NaMiniApp__YourRoomLabel, Na__Header);


    // Rows, grouped or sorted by typical size
    // ------------------------------------
    const Na__Filtered = Na__AllRooms.filter((Na__Room) => Na__RoomSizeComparator__MatchesFilter(Na__Index, Na__Room, Na__Model.Na__Filter));
    if (!Na__Filtered.length) {
        Na__RoomSizeComparator__El("p", "RSC__ar-empty", Na__Text.NaMiniApp__AllNoMatch, Na__Host);
        return;
    }

    const Na__Sections = Na__Model.Na__Sort === "size"
        ? [{ Na__Label: "", Na__Rooms: [...Na__Filtered].sort((Na__A, Na__B) => Na__A.Na__AreaList[2] - Na__B.Na__AreaList[2]) }]
        : Na__Index.Na__Groups
            .map((Na__Group) => ({ Na__Label: Na__Group.NaGroup__Label, Na__Rooms: Na__Filtered.filter((Na__Room) => Na__Room.NaRoom__Group === Na__Group.NaGroup__Id) }))
            .filter((Na__Section) => Na__Section.Na__Rooms.length);

    Na__Sections.forEach((Na__Section) => {
        if (Na__Section.Na__Label) {
            const Na__GroupRow = Na__RoomSizeComparator__El("div", "RSC__ar-row RSC__ar-row--group", null, Na__Host);
            Na__RoomSizeComparator__El("span", "RSC__ar-name", Na__Section.Na__Label, Na__GroupRow);
            Na__RoomSizeComparator__TrackCell(Na__GroupRow, Na__Axis, Na__YouPct, Na__C);
            Na__RoomSizeComparator__El("span", "RSC__ar-chip", "", Na__GroupRow);
        }

        Na__Section.Na__Rooms.forEach((Na__Room) => {
            const Na__Row = Na__RoomSizeComparator__El("button", "RSC__ar-row RSC__ar-row--room", null, Na__Host);
            Na__Row.type = "button";
            Na__Row.dataset.roomId = Na__Room.NaRoom__Id;
            if (Na__Room.NaRoom__Id === Na__Model.Na__RoomId) Na__Row.classList.add("RSC__ar-row--selected");

            const Na__Name = Na__Model.Na__Sort === "size" ? Na__Room.NaRoom__Name : Na__Room.NaRoom__ShortName || Na__Room.NaRoom__Name;
            Na__RoomSizeComparator__El("span", "RSC__ar-name", Na__Name, Na__Row);


            // Range from Min to O/S, then the five band dots
            // ------------------------------------
            const Na__Track = Na__RoomSizeComparator__TrackCell(Na__Row, Na__Axis, Na__YouPct, Na__C);
            const Na__Range = Na__RoomSizeComparator__El("span", "RSC__ar-range", null, Na__Track);
            Na__Range.style.left  = Na__Pct(Na__Room.Na__AreaList[0]);
            Na__Range.style.width = `calc(${Na__Pct(Na__Room.Na__AreaList[4])} - ${Na__Pct(Na__Room.Na__AreaList[0])})`;

            Na__Room.Na__AreaList.forEach((Na__Area, Na__I) => {
                const Na__Dot = Na__RoomSizeComparator__El("span", `RSC__ar-dot${Na__I === 2 ? " RSC__ar-dot--medium" : ""}`, null, Na__Track);
                Na__Dot.style.left = Na__Pct(Na__Area);
                Na__Dot.style.background = Na__C.NaMiniApp__BandRamp[Na__RoomSizeComparator__BandKeys[Na__I]];
            });


            // Your room's place for this room type
            // ------------------------------------
            const Na__Chip = Na__RoomSizeComparator__El("span", "RSC__ar-chip", null, Na__Row);
            let Na__ChipText = "";
            if (Na__Model.Na__AreaM2) {
                const Na__Class = Na__RoomSizeComparator__ClassifyArea(Na__Room, Na__Model.Na__AreaM2, Na__Model.Na__ToleranceM2);
                Na__ChipText = Na__RoomSizeComparator__VerdictLabel(Na__Index, Na__Class, Na__Text);
                if (Na__Class.Na__Kind === "below") {
                    Na__Chip.classList.add("RSC__ar-chip--below");
                } else {
                    Na__RoomSizeComparator__Swatch(Na__C, Na__RoomSizeComparator__BandKeys[Math.min(Na__Class.Na__NearestIndex, 4)], Na__Chip, "solid");
                }
                Na__RoomSizeComparator__El("span", "", Na__ChipText, Na__Chip);
            }

            const Na__Values = Na__Room.Na__AreaList.map((Na__Area) => Na__RoomSizeComparator__FormatAreaNumber(Na__Area, Na__Unit)).join(", ");
            Na__Row.setAttribute("aria-label", `${Na__Room.NaRoom__Name}: ${Na__Values} ${Na__RoomSizeComparator__AreaSymbol(Na__Unit)}${Na__ChipText ? `. Your room: ${Na__ChipText}` : ""}. Open in Compare.`);


            // Interaction: hover and focus show the tooltip, click opens Compare
            // ------------------------------------
            Na__Row.addEventListener("pointerenter", (Na__Event) => Na__RoomSizeComparator__ShowRowTooltip(Na__Tooltip, Na__Row, Na__Room, Na__Model, Na__Event.clientX));
            Na__Row.addEventListener("pointermove",  (Na__Event) => Na__RoomSizeComparator__ShowRowTooltip(Na__Tooltip, Na__Row, Na__Room, Na__Model, Na__Event.clientX));
            Na__Row.addEventListener("pointerleave", () => { Na__Tooltip.hidden = true; });
            Na__Row.addEventListener("focus",        () => Na__RoomSizeComparator__ShowRowTooltip(Na__Tooltip, Na__Row, Na__Room, Na__Model, Number.NaN));
            Na__Row.addEventListener("blur",         () => { Na__Tooltip.hidden = true; });
            Na__Row.addEventListener("click",        () => { Na__Tooltip.hidden = true; Na__Handlers.Na__OnSelectRoom(Na__Room.NaRoom__Id); });
        });
    });


    // Repeat the axis at the foot: the list is long
    // ------------------------------------
    const Na__Footer = Na__Header.cloneNode(true);
    Na__Footer.classList.add("RSC__ar-row--footer");
    Na__Host.appendChild(Na__Footer);
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
