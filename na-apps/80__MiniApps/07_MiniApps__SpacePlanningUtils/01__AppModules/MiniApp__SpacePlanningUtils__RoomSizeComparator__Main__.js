// =============================================================================
// NOBLE ARCHITECTURE - ROOM SIZE COMPARATOR - MAIN
// =============================================================================
//
// FILE    : MiniApp__SpacePlanningUtils__RoomSizeComparator__Main__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Config and data load, state, event wiring and application bootstrap
// CREATED : 16-Nov-2026
//
// - State holds sizes in metres only; the m² / ft² switch changes what is
//   shown and how typing is read, never the stored value.
// - Each view renders only while visible (the drawing and the band strip
//   measure text), and redraws when shown, resized or changed.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Imports
// -----------------------------------------------------------------------------

// @delegate: ./MiniApp__SpacePlanningUtils__RoomSizeComparator__Units__.js
import {
    Na__RoomSizeComparator__AreaInputText,
    Na__RoomSizeComparator__AreaSymbol,
    Na__RoomSizeComparator__ConfigureUnits,
    Na__RoomSizeComparator__FormatArea,
    Na__RoomSizeComparator__FormatAreaNumber,
    Na__RoomSizeComparator__LengthInputText,
    Na__RoomSizeComparator__LengthSymbol,
    Na__RoomSizeComparator__OtherUnit,
    Na__RoomSizeComparator__ParseAreaInput,
    Na__RoomSizeComparator__ParseLengthInput
} from "./MiniApp__SpacePlanningUtils__RoomSizeComparator__Units__.js";

// @delegate: ./MiniApp__SpacePlanningUtils__RoomSizeComparator__RoomData__.js
import {
    Na__RoomSizeComparator__BandLabel,
    Na__RoomSizeComparator__ClassifyArea,
    Na__RoomSizeComparator__DimsForArea,
    Na__RoomSizeComparator__GroupRooms,
    Na__RoomSizeComparator__LoadRoomData
} from "./MiniApp__SpacePlanningUtils__RoomSizeComparator__RoomData__.js";

// @delegate: ./MiniApp__SpacePlanningUtils__RoomSizeComparator__PlanDrawing__.js
import {
    Na__RoomSizeComparator__ExportPlanPng,
    Na__RoomSizeComparator__RenderPlan
} from "./MiniApp__SpacePlanningUtils__RoomSizeComparator__PlanDrawing__.js";

// @delegate: ./MiniApp__SpacePlanningUtils__RoomSizeComparator__CompareView__.js
import {
    Na__RoomSizeComparator__El,
    Na__RoomSizeComparator__Fill,
    Na__RoomSizeComparator__RenderBandStrip,
    Na__RoomSizeComparator__RenderBandTable,
    Na__RoomSizeComparator__RenderRoomNotes,
    Na__RoomSizeComparator__RenderVerdict,
    Na__RoomSizeComparator__VerdictLabel
} from "./MiniApp__SpacePlanningUtils__RoomSizeComparator__CompareView__.js";

// @delegate: ./MiniApp__SpacePlanningUtils__RoomSizeComparator__AllRoomsView__.js
import { Na__RoomSizeComparator__RenderAllRooms } from "./MiniApp__SpacePlanningUtils__RoomSizeComparator__AllRoomsView__.js";

// @delegate: ./MiniApp__SpacePlanningUtils__RoomSizeComparator__DataView__.js
import {
    Na__RoomSizeComparator__BuildTsv,
    Na__RoomSizeComparator__RenderDataIntro,
    Na__RoomSizeComparator__RenderDataTable
} from "./MiniApp__SpacePlanningUtils__RoomSizeComparator__DataView__.js";

// @delegate: ./MiniApp__SpacePlanningUtils__RoomSizeComparator__UrlState__.js
import {
    Na__RoomSizeComparator__LoadPrefs,
    Na__RoomSizeComparator__ReadHashState,
    Na__RoomSizeComparator__SavePrefs,
    Na__RoomSizeComparator__WriteHashState
} from "./MiniApp__SpacePlanningUtils__RoomSizeComparator__UrlState__.js";

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module-Level Variables
// -----------------------------------------------------------------------------

 const Na__RoomSizeComparator__ConfigPath = "./MiniApp__SpacePlanningUtils__RoomSizeComparator__AppConfig__.json";   // Resolved against the page

 let Na__RoomSizeComparator__Config = null;
 let Na__RoomSizeComparator__Index  = null;
 let Na__RoomSizeComparator__ToastTimer = 0;
 let Na__RoomSizeComparator__ResizeFrame = 0;
 let Na__RoomSizeComparator__DataRendered = "";

 const Na__RoomSizeComparator__State = {
     Na__RoomId        : null,
     Na__Unit          : "m2",
     Na__View          : "compare",
     Na__InputMode     : "area",
     Na__AreaM2        : null,      // number, null (empty) or NaN (unreadable)
     Na__AreaNote      : "",
     Na__LengthM       : null,
     Na__LengthNote    : "",
     Na__WidthM        : null,
     Na__WidthNote     : "",
     Na__ShowFurniture : true,
     Na__AllSort       : "group",
     Na__AllFilter     : ""
 };

 const Na__RoomSizeComparator__Dom = {
     Na__AppTitle       : document.getElementById("js__appTitle"),
     Na__AppVersion     : document.getElementById("js__appVersion"),
     Na__Tabs           : Array.from(document.querySelectorAll("[data-rsc-view]")),
     Na__UnitRadios     : Array.from(document.querySelectorAll("input[name='js__unit']")),
     Na__ModeRadios     : Array.from(document.querySelectorAll("input[name='js__inputMode']")),
     Na__Controls       : document.getElementById("js__controls"),
     Na__RoomSelect     : document.getElementById("js__roomSelect"),
     Na__RoomSelectLabel: document.getElementById("js__roomSelectLabel"),
     Na__SizeLabel      : document.getElementById("js__sizeLabel"),
     Na__ModeAreaLabel  : document.getElementById("js__modeAreaLabel"),
     Na__ModeDimsLabel  : document.getElementById("js__modeDimsLabel"),
     Na__AreaRow        : document.getElementById("js__areaRow"),
     Na__AreaInput      : document.getElementById("js__areaInput"),
     Na__AreaSuffix     : document.getElementById("js__areaSuffix"),
     Na__DimsRow        : document.getElementById("js__dimsRow"),
     Na__LengthInput    : document.getElementById("js__lengthInput"),
     Na__WidthInput     : document.getElementById("js__widthInput"),
     Na__LengthSuffixes : Array.from(document.querySelectorAll(".js__lengthSuffix")),
     Na__InputNote      : document.getElementById("js__inputNote"),
     Na__ClearBtn       : document.getElementById("js__clearBtn"),
     Na__CopyLinkBtn    : document.getElementById("js__copyLinkBtn"),
     Na__ViewCompare    : document.getElementById("js__viewCompare"),
     Na__ViewAll        : document.getElementById("js__viewAll"),
     Na__ViewData       : document.getElementById("js__viewData"),
     Na__PlanTitle      : document.getElementById("js__planTitle"),
     Na__PlanHost       : document.getElementById("js__planHost"),
     Na__PlanSvg        : document.getElementById("js__planSvg"),
     Na__PlanCaption    : document.getElementById("js__planCaption"),
     Na__FurnitureToggle: document.getElementById("js__furnitureToggle"),
     Na__FurnitureLabel : document.getElementById("js__furnitureLabel"),
     Na__SavePngBtn     : document.getElementById("js__savePngBtn"),
     Na__Verdict        : document.getElementById("js__verdict"),
     Na__BandsTitle     : document.getElementById("js__bandsTitle"),
     Na__BandStrip      : document.getElementById("js__bandStrip"),
     Na__BandTable      : document.getElementById("js__bandTable"),
     Na__RoomNotes      : document.getElementById("js__roomNotes"),
     Na__AllTitle       : document.getElementById("js__allTitle"),
     Na__AllHint        : document.getElementById("js__allHint"),
     Na__AllFilter      : document.getElementById("js__allFilter"),
     Na__AllSort        : document.getElementById("js__allSort"),
     Na__AllLegend      : document.getElementById("js__allLegend"),
     Na__AllChart       : document.getElementById("js__allChart"),
     Na__DataIntro      : document.getElementById("js__dataIntro"),
     Na__DataTableTitle : document.getElementById("js__dataTableTitle"),
     Na__DataTable      : document.getElementById("js__dataTable"),
     Na__CopyTsvBtn     : document.getElementById("js__copyTsvBtn"),
     Na__DownloadJson   : document.getElementById("js__downloadJsonLink"),
     Na__Tooltip        : document.getElementById("js__tooltip"),
     Na__Toast          : document.getElementById("js__toast"),
     Na__ScrollHost     : document.getElementById("js__scrollHost"),
     Na__PageFooter     : document.getElementById("js__pageFooter")
 };

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | State Helpers
// -----------------------------------------------------------------------------

// FUNCTION | Shortcuts into the config
// ------------------------------------------------------------
function Na__RoomSizeComparator__Text() {
    return Na__RoomSizeComparator__Config.NaMiniApp__UiText;
}

function Na__RoomSizeComparator__Colours() {
    return Na__RoomSizeComparator__Config.NaMiniApp__Colours;
}
// ------------------------------------------------------------


// FUNCTION | The selected room type
// ------------------------------------------------------------
function Na__RoomSizeComparator__CurrentRoom() {
    return Na__RoomSizeComparator__Index.Na__ById.get(Na__RoomSizeComparator__State.Na__RoomId);
}
// ------------------------------------------------------------


// FUNCTION | Differences below half the last shown digit count as "exactly" a band
// ------------------------------------------------------------
function Na__RoomSizeComparator__ToleranceM2() {
    return Na__RoomSizeComparator__State.Na__Unit === "ft2" ? 0.5 / 10.7639104167 : 0.05;
}
// ------------------------------------------------------------


// FUNCTION | Your room from what was typed, or null
// ------------------------------------------------------------
function Na__RoomSizeComparator__GetYourRoom() {
    const Na__S    = Na__RoomSizeComparator__State;
    const Na__Room = Na__RoomSizeComparator__CurrentRoom();
    const Na__Max  = Number(Na__RoomSizeComparator__Config.NaMiniApp__Defaults.NaMiniApp__MaxAreaM2) || 2000;
    const Na__Ok   = (Na__Value) => typeof Na__Value === "number" && Number.isFinite(Na__Value) && Na__Value > 0;

    if (Na__S.Na__InputMode === "dims") {
        if (!Na__Ok(Na__S.Na__LengthM) || !Na__Ok(Na__S.Na__WidthM)) return null;
        const Na__Area = Na__S.Na__LengthM * Na__S.Na__WidthM;
        if (Na__Area > Na__Max) return null;
        return {
            Na__AreaM2   : Na__Area,
            Na__LongM    : Math.max(Na__S.Na__LengthM, Na__S.Na__WidthM),
            Na__ShortM   : Math.min(Na__S.Na__LengthM, Na__S.Na__WidthM),
            Na__FromDims : true
        };
    }

    if (!Na__Ok(Na__S.Na__AreaM2) || Na__S.Na__AreaM2 > Na__Max) return null;
    const Na__Dims = Na__RoomSizeComparator__DimsForArea(Na__S.Na__AreaM2, Na__Room.Na__Aspect);
    return { Na__AreaM2: Na__S.Na__AreaM2, Na__LongM: Na__Dims.Na__LongM, Na__ShortM: Na__Dims.Na__ShortM, Na__FromDims: false };
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | UI Helpers
// -----------------------------------------------------------------------------

// FUNCTION | Brief message at the foot of the window
// ------------------------------------------------------------
function Na__RoomSizeComparator__ShowToast(Na__Message) {
    const Na__Toast = Na__RoomSizeComparator__Dom.Na__Toast;
    Na__Toast.textContent = Na__Message;
    Na__Toast.classList.add("RSC__toast--show");
    window.clearTimeout(Na__RoomSizeComparator__ToastTimer);
    Na__RoomSizeComparator__ToastTimer = window.setTimeout(() => Na__Toast.classList.remove("RSC__toast--show"), 2600);
}
// ------------------------------------------------------------


// FUNCTION | Copy text to the clipboard (falls back to a hidden textarea)
// ------------------------------------------------------------
async function Na__RoomSizeComparator__CopyText(Na__Text) {
    try {
        await navigator.clipboard.writeText(Na__Text);
        return true;
    } catch (Na__Error) {
        const Na__Area = document.createElement("textarea");
        Na__Area.value = Na__Text;
        Na__Area.setAttribute("readonly", "");
        Na__Area.style.position = "fixed";
        Na__Area.style.opacity  = "0";
        document.body.appendChild(Na__Area);
        Na__Area.select();
        let Na__Done = false;
        try { Na__Done = document.execCommand("copy"); } catch (Na__Ignored) { Na__Done = false; }
        Na__Area.remove();
        return Na__Done;
    }
}
// ------------------------------------------------------------


// FUNCTION | Apply UI text from the config
// ------------------------------------------------------------
function Na__RoomSizeComparator__ApplyUiText() {
    const Na__T    = Na__RoomSizeComparator__Text();
    const Na__D    = Na__RoomSizeComparator__Dom;
    const Na__Meta = Na__RoomSizeComparator__Config.NaMiniApp__Meta;

    document.title = Na__T.NaMiniApp__PageTitle;
    Na__D.Na__AppTitle.textContent        = Na__T.NaMiniApp__AppHeading;
    Na__D.Na__AppVersion.textContent      = `v${Na__Meta.NaMiniApp__Version}`;
    Na__D.Na__RoomSelectLabel.textContent = Na__T.NaMiniApp__RoomTypeLabel;
    Na__D.Na__SizeLabel.textContent       = Na__T.NaMiniApp__YourRoomLabel;
    Na__D.Na__ModeAreaLabel.textContent   = Na__T.NaMiniApp__ModeArea;
    Na__D.Na__ModeDimsLabel.textContent   = Na__T.NaMiniApp__ModeDims;
    Na__D.Na__AreaInput.placeholder       = Na__T.NaMiniApp__AreaPlaceholder;
    Na__D.Na__LengthInput.placeholder     = Na__T.NaMiniApp__LengthPlaceholder;
    Na__D.Na__WidthInput.placeholder      = Na__T.NaMiniApp__WidthPlaceholder;
    Na__D.Na__ClearBtn.textContent        = Na__T.NaMiniApp__ClearButton;
    Na__D.Na__CopyLinkBtn.textContent     = Na__T.NaMiniApp__CopyLinkButton;
    Na__D.Na__SavePngBtn.textContent      = Na__T.NaMiniApp__SaveImageButton;
    Na__D.Na__FurnitureLabel.textContent  = Na__T.NaMiniApp__FurnitureToggle;
    Na__D.Na__BandsTitle.textContent      = Na__T.NaMiniApp__BandsTitle;
    Na__D.Na__AllTitle.textContent        = Na__T.NaMiniApp__AllTitle;
    Na__D.Na__AllHint.textContent         = Na__T.NaMiniApp__AllHint;
    Na__D.Na__AllFilter.placeholder       = Na__T.NaMiniApp__AllFilterPlaceholder;
    Na__D.Na__DataTableTitle.textContent  = Na__T.NaMiniApp__DataTableTitle;
    Na__D.Na__CopyTsvBtn.textContent      = Na__T.NaMiniApp__CopyTsvButton;
    Na__D.Na__DownloadJson.textContent    = Na__T.NaMiniApp__DownloadJsonButton;
    Na__D.Na__DownloadJson.href           = Na__RoomSizeComparator__Config.NaMiniApp__Assets.NaMiniApp__RoomDataUrl;
    Na__D.Na__PageFooter.textContent      = Na__T.NaMiniApp__FooterText;

    Na__D.Na__AllSort.options[0].textContent = Na__T.NaMiniApp__AllSortGroup;
    Na__D.Na__AllSort.options[1].textContent = Na__T.NaMiniApp__AllSortSize;

    const Na__TabText = { compare: Na__T.NaMiniApp__TabCompare, all: Na__T.NaMiniApp__TabAll, data: Na__T.NaMiniApp__TabData };
    Na__D.Na__Tabs.forEach((Na__Tab) => { Na__Tab.textContent = Na__TabText[Na__Tab.dataset.rscView]; });
}
// ------------------------------------------------------------


// FUNCTION | Fill the room type picker, grouped
// ------------------------------------------------------------
function Na__RoomSizeComparator__PopulateRoomSelect() {
    const Na__Select = Na__RoomSizeComparator__Dom.Na__RoomSelect;
    Na__Select.replaceChildren();

    Na__RoomSizeComparator__GroupRooms(Na__RoomSizeComparator__Index, true).forEach((Na__Bucket) => {
        const Na__Group = document.createElement("optgroup");
        Na__Group.label = Na__Bucket.Na__Group.NaGroup__Label;

        Na__Bucket.Na__Rooms.forEach((Na__Room) => {
            const Na__Option = document.createElement("option");
            Na__Option.value = Na__Room.NaRoom__Id;
            Na__Option.textContent = Na__Room.Na__Comparable
                ? (Na__Room.NaRoom__ShortName || Na__Room.NaRoom__Name)
                : `${Na__Room.NaRoom__ShortName || Na__Room.NaRoom__Name} (no figures)`;
            Na__Option.disabled = !Na__Room.Na__Comparable;
            Na__Group.appendChild(Na__Option);
        });

        Na__Select.appendChild(Na__Group);
    });
}
// ------------------------------------------------------------


// FUNCTION | Inputs, suffixes and switches to match the state
// ------------------------------------------------------------
function Na__RoomSizeComparator__SyncControls(Na__RewriteValues) {
    const Na__S = Na__RoomSizeComparator__State;
    const Na__D = Na__RoomSizeComparator__Dom;

    Na__D.Na__RoomSelect.value = Na__S.Na__RoomId;
    Na__D.Na__UnitRadios.forEach((Na__Radio) => { Na__Radio.checked = Na__Radio.value === Na__S.Na__Unit; });
    Na__D.Na__ModeRadios.forEach((Na__Radio) => { Na__Radio.checked = Na__Radio.value === Na__S.Na__InputMode; });
    Na__D.Na__FurnitureToggle.checked = Na__S.Na__ShowFurniture;

    Na__D.Na__AreaSuffix.textContent = Na__RoomSizeComparator__AreaSymbol(Na__S.Na__Unit);
    Na__D.Na__LengthSuffixes.forEach((Na__Suffix) => { Na__Suffix.textContent = Na__RoomSizeComparator__LengthSymbol(Na__S.Na__Unit); });

    Na__D.Na__AreaRow.hidden = Na__S.Na__InputMode !== "area";
    Na__D.Na__DimsRow.hidden = Na__S.Na__InputMode !== "dims";

    if (Na__RewriteValues) {
        const Na__Valid = (Na__Value) => typeof Na__Value === "number" && Number.isFinite(Na__Value) && Na__Value > 0;
        if (Na__Valid(Na__S.Na__AreaM2))  Na__D.Na__AreaInput.value   = Na__RoomSizeComparator__AreaInputText(Na__S.Na__AreaM2, Na__S.Na__Unit);
        if (Na__Valid(Na__S.Na__LengthM)) Na__D.Na__LengthInput.value = Na__RoomSizeComparator__LengthInputText(Na__S.Na__LengthM, Na__S.Na__Unit);
        if (Na__Valid(Na__S.Na__WidthM))  Na__D.Na__WidthInput.value  = Na__RoomSizeComparator__LengthInputText(Na__S.Na__WidthM, Na__S.Na__Unit);
        Na__S.Na__AreaNote = Na__S.Na__LengthNote = Na__S.Na__WidthNote = "";
    }
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Input Note
// -----------------------------------------------------------------------------

// FUNCTION | The line under the inputs: errors, how a value was read, unit hints
// ------------------------------------------------------------
function Na__RoomSizeComparator__RenderInputNote(Na__YourRoom) {
    const Na__S    = Na__RoomSizeComparator__State;
    const Na__T    = Na__RoomSizeComparator__Text();
    const Na__Note = Na__RoomSizeComparator__Dom.Na__InputNote;
    const Na__Room = Na__RoomSizeComparator__CurrentRoom();
    Na__Note.replaceChildren();
    Na__Note.className = "RSC__input-note";

    const Na__Bad = (Na__Value) => typeof Na__Value === "number" && Number.isNaN(Na__Value);


    // Unreadable input
    // ------------------------------------
    if ((Na__S.Na__InputMode === "area" && Na__Bad(Na__S.Na__AreaM2))
        || (Na__S.Na__InputMode === "dims" && (Na__Bad(Na__S.Na__LengthM) || Na__Bad(Na__S.Na__WidthM)))) {
        Na__Note.classList.add("RSC__input-note--error");
        Na__Note.textContent = Na__T.NaMiniApp__InputInvalid;
        return;
    }


    // Larger than any room this tool is meant for
    // ------------------------------------
    const Na__Max = Number(Na__RoomSizeComparator__Config.NaMiniApp__Defaults.NaMiniApp__MaxAreaM2) || 2000;
    const Na__Typed = Na__S.Na__InputMode === "dims"
        ? (Number.isFinite(Na__S.Na__LengthM) && Number.isFinite(Na__S.Na__WidthM) ? Na__S.Na__LengthM * Na__S.Na__WidthM : 0)
        : (Number.isFinite(Na__S.Na__AreaM2) ? Na__S.Na__AreaM2 : 0);
    if (Na__Typed > Na__Max) {
        Na__Note.classList.add("RSC__input-note--error");
        Na__Note.textContent = `That's over ${Na__RoomSizeComparator__FormatArea(Na__Max, Na__S.Na__Unit)}: check the number and the units.`;
        return;
    }


    // Length × width: show the area it makes, and how each value was read
    // ------------------------------------
    if (Na__S.Na__InputMode === "dims") {
        const Na__Reads = [Na__S.Na__LengthNote, Na__S.Na__WidthNote].filter(Boolean);
        const Na__ReadText = Na__Reads.includes("mm") ? " (read as millimetres)" : (Na__Reads.length ? ` (read as ${Na__Reads[0]})` : "");
        if (Na__YourRoom) {
            Na__Note.textContent = `= ${Na__RoomSizeComparator__FormatArea(Na__YourRoom.Na__AreaM2, Na__S.Na__Unit, "measured")} (${Na__RoomSizeComparator__FormatArea(Na__YourRoom.Na__AreaM2, Na__RoomSizeComparator__OtherUnit(Na__S.Na__Unit), "measured")})${Na__ReadText}`;
        } else if (Na__S.Na__Unit === "ft2") {
            Na__Note.textContent = Na__T.NaMiniApp__FeetInputHint;
        }
        return;
    }


    // Area typed with the other unit's symbol
    // ------------------------------------
    if (Na__YourRoom && Na__S.Na__AreaNote) {
        Na__Note.textContent = `Read as ${Na__S.Na__AreaNote === "ft" ? "square feet" : "square metres"}: ${Na__RoomSizeComparator__FormatArea(Na__YourRoom.Na__AreaM2, Na__S.Na__Unit, "measured")}`;
        return;
    }


    // Unit hint: a number that only makes sense in the other unit
    // ------------------------------------
    if (!Na__YourRoom || !Na__Room) return;
    const Na__Number = Number.parseFloat(String(Na__RoomSizeComparator__Dom.Na__AreaInput.value).replace(",", "."));
    const Na__Areas  = Na__Room.Na__AreaList;
    const Na__Other  = Na__RoomSizeComparator__OtherUnit(Na__S.Na__Unit);
    const Na__AsOther = Na__Other === "ft2" ? Na__Number / 10.7639104167 : Na__Number;
    const Na__Plausible = Na__AsOther >= Na__Areas[0] * 0.6 && Na__AsOther <= Na__Areas[4] * 1.4;
    const Na__Odd = Na__S.Na__Unit === "m2"
        ? Na__YourRoom.Na__AreaM2 > Na__Areas[4] * 2.5
        : Na__YourRoom.Na__AreaM2 < Na__Areas[0] * 0.4;

    if (Number.isFinite(Na__Number) && Na__Odd && Na__Plausible) {
        Na__RoomSizeComparator__El("span", "", `That's ${Na__S.Na__Unit === "m2" ? "very large" : "very small"} for a ${Na__Room.NaRoom__Name.toLowerCase()}. Did you mean ${Na__RoomSizeComparator__Dom.Na__AreaInput.value.trim()} ${Na__RoomSizeComparator__AreaSymbol(Na__Other)}? `, Na__Note);
        const Na__Button = Na__RoomSizeComparator__El("button", "RSC__link-btn", `Use ${Na__RoomSizeComparator__AreaSymbol(Na__Other)}`, Na__Note);
        Na__Button.type = "button";
        Na__Button.addEventListener("click", () => {
            Na__S.Na__Unit = Na__Other;
            Na__S.Na__AreaM2 = Na__RoomSizeComparator__ParseAreaInput(Na__RoomSizeComparator__Dom.Na__AreaInput.value, Na__Other).Na__AreaM2;
            Na__RoomSizeComparator__SyncControls(false);
            Na__RoomSizeComparator__Render();
        });
    }
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Rendering
// -----------------------------------------------------------------------------

// FUNCTION | Compare view: drawing, verdict, band strip, band table, notes
// ------------------------------------------------------------
function Na__RoomSizeComparator__RenderCompare(Na__YourRoom) {
    const Na__S    = Na__RoomSizeComparator__State;
    const Na__D    = Na__RoomSizeComparator__Dom;
    const Na__T    = Na__RoomSizeComparator__Text();
    const Na__Room = Na__RoomSizeComparator__CurrentRoom();
    const Na__Class = Na__YourRoom ? Na__RoomSizeComparator__ClassifyArea(Na__Room, Na__YourRoom.Na__AreaM2, Na__RoomSizeComparator__ToleranceM2()) : null;

    Na__D.Na__PlanTitle.textContent = Na__RoomSizeComparator__Fill(Na__T.NaMiniApp__PlanTitle, { room: Na__Room.NaRoom__Name });


    // The drawing, then a caption that says how to read it
    // ------------------------------------
    const Na__Plan = Na__RoomSizeComparator__RenderPlan(Na__D.Na__PlanSvg, {
        Na__Index         : Na__RoomSizeComparator__Index,
        Na__Room          : Na__Room,
        Na__Unit          : Na__S.Na__Unit,
        Na__YourRoom      : Na__YourRoom,
        Na__ShowFurniture : Na__S.Na__ShowFurniture,
        Na__Colours       : Na__RoomSizeComparator__Colours(),
        Na__Drawing       : Na__RoomSizeComparator__Config.NaMiniApp__Drawing,
        Na__Text          : { Na__YourRoomTag: Na__T.NaMiniApp__YourRoomTag }
    });

    if (Na__Plan) {
        const Na__Parts = [Na__RoomSizeComparator__Fill(Na__YourRoom ? Na__T.NaMiniApp__PlanCaptionRoom : Na__T.NaMiniApp__PlanCaptionEmpty, { grid: Na__Plan.Na__GridLabel })];
        Na__Parts.push(Na__RoomSizeComparator__Fill(Na__T.NaMiniApp__PlanCaptionShape, { ratio: Na__Room.Na__Aspect }));
        if (Na__YourRoom && !Na__YourRoom.Na__FromDims) Na__Parts.push("Your room takes the same shape until you enter its length and width.");
        if (Na__Plan.Na__FurnitureText) Na__Parts.push(`Furniture: ${Na__Plan.Na__FurnitureText}.`);
        Na__D.Na__PlanCaption.textContent = Na__Parts.join(" ");
    }


    // Words and tables
    // ------------------------------------
    const Na__Model = {
        Na__Index    : Na__RoomSizeComparator__Index,
        Na__Room     : Na__Room,
        Na__Unit     : Na__S.Na__Unit,
        Na__Text     : Na__T,
        Na__Colours  : Na__RoomSizeComparator__Colours(),
        Na__YourRoom : Na__YourRoom,
        Na__Class    : Na__Class
    };

    Na__RoomSizeComparator__RenderVerdict(Na__D.Na__Verdict, Na__Model);
    Na__RoomSizeComparator__RenderBandStrip(Na__D.Na__BandStrip, Na__Model);
    Na__RoomSizeComparator__RenderBandTable(Na__D.Na__BandTable, Na__Model);
    Na__RoomSizeComparator__RenderRoomNotes(Na__D.Na__RoomNotes, Na__Model, (Na__RoomId) => Na__RoomSizeComparator__OpenSources(Na__RoomId));
}
// ------------------------------------------------------------


// FUNCTION | All Rooms view
// ------------------------------------------------------------
function Na__RoomSizeComparator__RenderAllView(Na__YourRoom) {
    const Na__S = Na__RoomSizeComparator__State;
    const Na__D = Na__RoomSizeComparator__Dom;

    Na__RoomSizeComparator__RenderAllRooms(Na__D.Na__AllChart, Na__D.Na__AllLegend, {
        Na__Index       : Na__RoomSizeComparator__Index,
        Na__Unit        : Na__S.Na__Unit,
        Na__AreaM2      : Na__YourRoom ? Na__YourRoom.Na__AreaM2 : null,
        Na__ToleranceM2 : Na__RoomSizeComparator__ToleranceM2(),
        Na__RoomId      : Na__S.Na__RoomId,
        Na__Sort        : Na__S.Na__AllSort,
        Na__Filter      : Na__S.Na__AllFilter,
        Na__Colours     : Na__RoomSizeComparator__Colours(),
        Na__Text        : Na__RoomSizeComparator__Text(),
        Na__Tooltip     : Na__D.Na__Tooltip
    }, {
        Na__OnSelectRoom: (Na__RoomId) => {
            Na__S.Na__RoomId = Na__RoomId;
            Na__RoomSizeComparator__SyncControls(false);
            Na__RoomSizeComparator__SetView("compare");
        }
    });
}
// ------------------------------------------------------------


// FUNCTION | Data & Sources view (rebuilt only when the units change)
// ------------------------------------------------------------
function Na__RoomSizeComparator__RenderDataView(Na__OpenRoomId = null) {
    const Na__S   = Na__RoomSizeComparator__State;
    const Na__D   = Na__RoomSizeComparator__Dom;
    const Na__Key = `${Na__S.Na__Unit}`;
    if (Na__RoomSizeComparator__DataRendered === Na__Key && !Na__OpenRoomId) return;

    const Na__Model = { Na__Index: Na__RoomSizeComparator__Index, Na__Unit: Na__S.Na__Unit, Na__Text: Na__RoomSizeComparator__Text() };
    Na__RoomSizeComparator__RenderDataIntro(Na__D.Na__DataIntro, Na__Model);
    const Na__OpenRow = Na__RoomSizeComparator__RenderDataTable(Na__D.Na__DataTable, Na__Model, Na__OpenRoomId);
    Na__RoomSizeComparator__DataRendered = Na__Key;

    if (Na__OpenRow) Na__OpenRow.scrollIntoView({ block: "center" });
}
// ------------------------------------------------------------


// FUNCTION | Render whatever is showing, then keep the link and preferences current
// ------------------------------------------------------------
function Na__RoomSizeComparator__Render() {
    const Na__S    = Na__RoomSizeComparator__State;
    const Na__You  = Na__RoomSizeComparator__GetYourRoom();

    Na__RoomSizeComparator__RenderInputNote(Na__You);

    if (Na__S.Na__View === "compare") Na__RoomSizeComparator__RenderCompare(Na__You);
    if (Na__S.Na__View === "all")     Na__RoomSizeComparator__RenderAllView(Na__You);
    if (Na__S.Na__View === "data")    Na__RoomSizeComparator__RenderDataView();

    Na__RoomSizeComparator__WriteHashState(Na__S);
    Na__RoomSizeComparator__SavePrefs(Na__RoomSizeComparator__Config.NaMiniApp__Defaults.NaMiniApp__PrefsStorageKey, {
        Na__Unit          : Na__S.Na__Unit,
        Na__RoomId        : Na__S.Na__RoomId,
        Na__ShowFurniture : Na__S.Na__ShowFurniture
    });
}
// ------------------------------------------------------------


// FUNCTION | Switch view: tabs, panels, the shared controls, then render
// ------------------------------------------------------------
function Na__RoomSizeComparator__SetView(Na__View, Na__Focus = false) {
    const Na__D = Na__RoomSizeComparator__Dom;
    Na__RoomSizeComparator__State.Na__View = Na__View;

    Na__D.Na__Tabs.forEach((Na__Tab) => {
        const Na__Active = Na__Tab.dataset.rscView === Na__View;
        Na__Tab.classList.toggle("RSC__tab--active", Na__Active);
        Na__Tab.setAttribute("aria-selected", String(Na__Active));
        Na__Tab.tabIndex = Na__Active ? 0 : -1;
        if (Na__Active && Na__Focus) Na__Tab.focus();
    });

    Na__D.Na__ViewCompare.hidden = Na__View !== "compare";
    Na__D.Na__ViewAll.hidden     = Na__View !== "all";
    Na__D.Na__ViewData.hidden    = Na__View !== "data";
    Na__D.Na__Controls.hidden    = Na__View === "data";
    Na__D.Na__Tooltip.hidden     = true;

    Na__RoomSizeComparator__Render();
}
// ------------------------------------------------------------


// FUNCTION | Open the Data & Sources view at one room
// ------------------------------------------------------------
function Na__RoomSizeComparator__OpenSources(Na__RoomId) {
    Na__RoomSizeComparator__SetView("data");
    Na__RoomSizeComparator__RenderDataView(Na__RoomId);
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Event Handlers
// -----------------------------------------------------------------------------

// FUNCTION | Typing in the area or length / width boxes
// ------------------------------------------------------------
function Na__RoomSizeComparator__HandleSizeInput() {
    const Na__S = Na__RoomSizeComparator__State;
    const Na__D = Na__RoomSizeComparator__Dom;

    const Na__Area = Na__RoomSizeComparator__ParseAreaInput(Na__D.Na__AreaInput.value, Na__S.Na__Unit);
    Na__S.Na__AreaM2   = Na__Area.Na__AreaM2;
    Na__S.Na__AreaNote = Na__Area.Na__Note;

    const Na__Length = Na__RoomSizeComparator__ParseLengthInput(Na__D.Na__LengthInput.value, Na__S.Na__Unit);
    const Na__Width  = Na__RoomSizeComparator__ParseLengthInput(Na__D.Na__WidthInput.value, Na__S.Na__Unit);
    Na__S.Na__LengthM    = Na__Length.Na__LengthM;
    Na__S.Na__LengthNote = Na__Length.Na__Note;
    Na__S.Na__WidthM     = Na__Width.Na__LengthM;
    Na__S.Na__WidthNote  = Na__Width.Na__Note;

    Na__RoomSizeComparator__Render();
}
// ------------------------------------------------------------


// FUNCTION | m² / ft²: keep the stored size, rewrite the boxes in the new unit
// ------------------------------------------------------------
function Na__RoomSizeComparator__HandleUnitChange(Na__Event) {
    Na__RoomSizeComparator__State.Na__Unit = Na__Event.target.value;
    Na__RoomSizeComparator__SyncControls(true);
    Na__RoomSizeComparator__Render();
}
// ------------------------------------------------------------


// FUNCTION | Area ↔ length × width: carry the size across where it can be
// ------------------------------------------------------------
function Na__RoomSizeComparator__HandleModeChange(Na__Event) {
    const Na__S = Na__RoomSizeComparator__State;
    const Na__D = Na__RoomSizeComparator__Dom;
    const Na__Ok = (Na__Value) => typeof Na__Value === "number" && Number.isFinite(Na__Value) && Na__Value > 0;
    Na__S.Na__InputMode = Na__Event.target.value;

    if (Na__S.Na__InputMode === "area" && Na__Ok(Na__S.Na__LengthM) && Na__Ok(Na__S.Na__WidthM)) {
        Na__S.Na__AreaM2 = Na__S.Na__LengthM * Na__S.Na__WidthM;
        Na__D.Na__AreaInput.value = Na__RoomSizeComparator__AreaInputText(Na__S.Na__AreaM2, Na__S.Na__Unit);
    }

    Na__RoomSizeComparator__SyncControls(false);
    Na__RoomSizeComparator__Render();
    (Na__S.Na__InputMode === "area" ? Na__D.Na__AreaInput : Na__D.Na__LengthInput).focus();
}
// ------------------------------------------------------------


// FUNCTION | Clear the size
// ------------------------------------------------------------
function Na__RoomSizeComparator__HandleClear() {
    const Na__S = Na__RoomSizeComparator__State;
    const Na__D = Na__RoomSizeComparator__Dom;
    Na__D.Na__AreaInput.value = Na__D.Na__LengthInput.value = Na__D.Na__WidthInput.value = "";
    Na__S.Na__AreaM2 = Na__S.Na__LengthM = Na__S.Na__WidthM = null;
    Na__S.Na__AreaNote = Na__S.Na__LengthNote = Na__S.Na__WidthNote = "";
    Na__RoomSizeComparator__Render();
    (Na__S.Na__InputMode === "area" ? Na__D.Na__AreaInput : Na__D.Na__LengthInput).focus();
}
// ------------------------------------------------------------


// FUNCTION | Copy a link that reopens this exact comparison
// ------------------------------------------------------------
async function Na__RoomSizeComparator__HandleCopyLink() {
    const Na__T = Na__RoomSizeComparator__Text();
    Na__RoomSizeComparator__WriteHashState(Na__RoomSizeComparator__State);
    const Na__Ok = await Na__RoomSizeComparator__CopyText(window.location.href);
    Na__RoomSizeComparator__ShowToast(Na__Ok ? Na__T.NaMiniApp__ToastLinkCopied : Na__T.NaMiniApp__ToastCopyFailed);
}
// ------------------------------------------------------------


// FUNCTION | Save the drawing as a PNG with a title strip
// ------------------------------------------------------------
async function Na__RoomSizeComparator__HandleSavePng() {
    const Na__S    = Na__RoomSizeComparator__State;
    const Na__T    = Na__RoomSizeComparator__Text();
    const Na__Room = Na__RoomSizeComparator__CurrentRoom();
    const Na__You  = Na__RoomSizeComparator__GetYourRoom();
    const Na__Unit = Na__S.Na__Unit;

    const Na__Bands = Na__Room.Na__AreaList
        .map((Na__Area, Na__I) => `${Na__RoomSizeComparator__BandLabel(Na__RoomSizeComparator__Index, Na__I)} ${Na__RoomSizeComparator__FormatAreaNumber(Na__Area, Na__Unit)}`)
        .join(" · ");
    let Na__Subtitle = `${Na__Bands} ${Na__RoomSizeComparator__AreaSymbol(Na__Unit)}`;
    if (Na__You) {
        const Na__Class = Na__RoomSizeComparator__ClassifyArea(Na__Room, Na__You.Na__AreaM2, Na__RoomSizeComparator__ToleranceM2());
        Na__Subtitle += `  |  ${Na__T.NaMiniApp__YourRoomLabel}: ${Na__RoomSizeComparator__FormatArea(Na__You.Na__AreaM2, Na__Unit, "measured")} (${Na__RoomSizeComparator__VerdictLabel(Na__RoomSizeComparator__Index, Na__Class, Na__T)})`;
    }

    const Na__AreaTag = Na__You ? `__${Na__RoomSizeComparator__FormatAreaNumber(Na__You.Na__AreaM2, Na__Unit, "measured").replace(/[^0-9.]/g, "")}${Na__Unit}` : "";
    const Na__Date    = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

    try {
        await Na__RoomSizeComparator__ExportPlanPng(Na__RoomSizeComparator__Dom.Na__PlanSvg, {
            Na__Title    : `${Na__Room.NaRoom__Name}: typical UK sizes, to scale`,
            Na__Subtitle : Na__Subtitle,
            Na__Credit   : `${Na__RoomSizeComparator__Config.NaMiniApp__Drawing.NaMiniApp__ExportCredit} · ${Na__Date}`,
            Na__Scale    : Na__RoomSizeComparator__Config.NaMiniApp__Drawing.NaMiniApp__ExportScale,
            Na__FileName : `RoomSize__${Na__Room.NaRoom__Id}${Na__AreaTag}.png`,
            Na__Colours  : Na__RoomSizeComparator__Colours()
        });
        Na__RoomSizeComparator__ShowToast(Na__T.NaMiniApp__ToastImageSaved);
    } catch (Na__Error) {
        console.error(Na__Error);
        Na__RoomSizeComparator__ShowToast(Na__T.NaMiniApp__ToastImageFailed);
    }
}
// ------------------------------------------------------------


// FUNCTION | Copy the figures table for Google Sheets
// ------------------------------------------------------------
async function Na__RoomSizeComparator__HandleCopyTsv() {
    const Na__T  = Na__RoomSizeComparator__Text();
    const Na__Ok = await Na__RoomSizeComparator__CopyText(Na__RoomSizeComparator__BuildTsv(Na__RoomSizeComparator__Index, Na__RoomSizeComparator__State.Na__Unit));
    Na__RoomSizeComparator__ShowToast(Na__Ok ? Na__T.NaMiniApp__ToastTsvCopied : Na__T.NaMiniApp__ToastCopyFailed);
}
// ------------------------------------------------------------


// FUNCTION | Tabs: click, and arrow keys between tabs
// ------------------------------------------------------------
function Na__RoomSizeComparator__HandleTabKeys(Na__Event) {
    const Na__Tabs  = Na__RoomSizeComparator__Dom.Na__Tabs;
    const Na__At    = Na__Tabs.indexOf(Na__Event.target);
    if (Na__At < 0) return;

    const Na__Moves = { ArrowRight: 1, ArrowLeft: -1, Home: -Na__At, End: Na__Tabs.length - 1 - Na__At };
    if (!(Na__Event.key in Na__Moves)) return;

    Na__Event.preventDefault();
    const Na__Next = (Na__At + Na__Moves[Na__Event.key] + Na__Tabs.length) % Na__Tabs.length;
    Na__RoomSizeComparator__SetView(Na__Tabs[Na__Next].dataset.rscView, true);
}
// ------------------------------------------------------------


// FUNCTION | Attach every listener
// ------------------------------------------------------------
function Na__RoomSizeComparator__RegisterEventListeners() {
    const Na__D = Na__RoomSizeComparator__Dom;
    const Na__S = Na__RoomSizeComparator__State;

    Na__D.Na__Tabs.forEach((Na__Tab) => {
        Na__Tab.addEventListener("click", () => Na__RoomSizeComparator__SetView(Na__Tab.dataset.rscView));
        Na__Tab.addEventListener("keydown", Na__RoomSizeComparator__HandleTabKeys);
    });

    Na__D.Na__UnitRadios.forEach((Na__Radio) => Na__Radio.addEventListener("change", Na__RoomSizeComparator__HandleUnitChange));
    Na__D.Na__ModeRadios.forEach((Na__Radio) => Na__Radio.addEventListener("change", Na__RoomSizeComparator__HandleModeChange));

    Na__D.Na__RoomSelect.addEventListener("change", () => {
        Na__S.Na__RoomId = Na__D.Na__RoomSelect.value;
        Na__RoomSizeComparator__Render();
    });

    [Na__D.Na__AreaInput, Na__D.Na__LengthInput, Na__D.Na__WidthInput].forEach((Na__Input) => {
        Na__Input.addEventListener("input", Na__RoomSizeComparator__HandleSizeInput);
    });

    Na__D.Na__ClearBtn.addEventListener("click", Na__RoomSizeComparator__HandleClear);
    Na__D.Na__CopyLinkBtn.addEventListener("click", Na__RoomSizeComparator__HandleCopyLink);
    Na__D.Na__SavePngBtn.addEventListener("click", Na__RoomSizeComparator__HandleSavePng);
    Na__D.Na__CopyTsvBtn.addEventListener("click", Na__RoomSizeComparator__HandleCopyTsv);

    Na__D.Na__FurnitureToggle.addEventListener("change", () => {
        Na__S.Na__ShowFurniture = Na__D.Na__FurnitureToggle.checked;
        Na__RoomSizeComparator__Render();
    });

    Na__D.Na__AllFilter.addEventListener("input", () => {
        Na__S.Na__AllFilter = Na__D.Na__AllFilter.value;
        Na__RoomSizeComparator__Render();
    });
    Na__D.Na__AllSort.addEventListener("change", () => {
        Na__S.Na__AllSort = Na__D.Na__AllSort.value;
        Na__RoomSizeComparator__Render();
    });

    Na__D.Na__ScrollHost.addEventListener("scroll", () => { Na__D.Na__Tooltip.hidden = true; }, { passive: true });


    // Redraw the drawing and band strip when their width changes (height follows the drawing)
    // ------------------------------------
    let Na__LastWidth = 0;
    const Na__Observer = new ResizeObserver((Na__Entries) => {
        const Na__Width = Math.round(Na__Entries[0].contentRect.width);
        if (Na__Width === Na__LastWidth) return;
        Na__LastWidth = Na__Width;

        window.cancelAnimationFrame(Na__RoomSizeComparator__ResizeFrame);
        Na__RoomSizeComparator__ResizeFrame = window.requestAnimationFrame(() => {
            if (Na__S.Na__View === "compare") Na__RoomSizeComparator__RenderCompare(Na__RoomSizeComparator__GetYourRoom());
        });
    });
    Na__Observer.observe(Na__D.Na__PlanHost);


    // A pasted link in the same tab
    // ------------------------------------
    window.addEventListener("hashchange", () => {
        Na__RoomSizeComparator__ApplyHashState();
        Na__RoomSizeComparator__SyncControls(true);
        Na__RoomSizeComparator__SetView(Na__S.Na__View);
    });
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Bootstrap
// -----------------------------------------------------------------------------

// FUNCTION | Defaults, then remembered preferences, then the address hash
// ------------------------------------------------------------
function Na__RoomSizeComparator__ApplyHashState() {
    const Na__S    = Na__RoomSizeComparator__State;
    const Na__Hash = Na__RoomSizeComparator__ReadHashState();
    const Na__Room = Na__Hash.Na__RoomId && Na__RoomSizeComparator__Index.Na__ById.get(Na__Hash.Na__RoomId);

    if (Na__Room && Na__Room.Na__Comparable) Na__S.Na__RoomId = Na__Hash.Na__RoomId;
    if (Na__Hash.Na__Unit) Na__S.Na__Unit = Na__Hash.Na__Unit;
    if (Na__Hash.Na__View) Na__S.Na__View = Na__Hash.Na__View;
    if (Na__Hash.Na__InputMode) Na__S.Na__InputMode = Na__Hash.Na__InputMode;
    if (Na__Hash.Na__AreaM2) Na__S.Na__AreaM2 = Na__Hash.Na__AreaM2;
    if (Na__Hash.Na__LengthM) { Na__S.Na__LengthM = Na__Hash.Na__LengthM; Na__S.Na__WidthM = Na__Hash.Na__WidthM; }
}

function Na__RoomSizeComparator__InitialiseState() {
    const Na__S        = Na__RoomSizeComparator__State;
    const Na__Defaults = Na__RoomSizeComparator__Config.NaMiniApp__Defaults;
    const Na__Prefs    = Na__RoomSizeComparator__LoadPrefs(Na__Defaults.NaMiniApp__PrefsStorageKey);
    const Na__IsRoom   = (Na__Id) => {
        const Na__Room = Na__Id && Na__RoomSizeComparator__Index.Na__ById.get(Na__Id);
        return Boolean(Na__Room && Na__Room.Na__Comparable);
    };

    Na__S.Na__RoomId        = Na__IsRoom(Na__Defaults.NaMiniApp__DefaultRoomId) ? Na__Defaults.NaMiniApp__DefaultRoomId : Na__RoomSizeComparator__Index.Na__Rooms.find((Na__R) => Na__R.Na__Comparable).NaRoom__Id;
    Na__S.Na__Unit          = Na__Defaults.NaMiniApp__DefaultUnit === "ft2" ? "ft2" : "m2";
    Na__S.Na__View          = Na__Defaults.NaMiniApp__DefaultView || "compare";
    Na__S.Na__InputMode     = Na__Defaults.NaMiniApp__DefaultInputMode === "dims" ? "dims" : "area";
    Na__S.Na__ShowFurniture = Na__Defaults.NaMiniApp__ShowFurniture !== false;

    if (Na__IsRoom(Na__Prefs.Na__RoomId)) Na__S.Na__RoomId = Na__Prefs.Na__RoomId;
    if (["m2", "ft2"].includes(Na__Prefs.Na__Unit)) Na__S.Na__Unit = Na__Prefs.Na__Unit;
    if (typeof Na__Prefs.Na__ShowFurniture === "boolean") Na__S.Na__ShowFurniture = Na__Prefs.Na__ShowFurniture;

    Na__RoomSizeComparator__ApplyHashState();
}
// ------------------------------------------------------------


// FUNCTION | Load config and data, wire events and draw the first view
// ------------------------------------------------------------
async function Na__RoomSizeComparator__BootstrapApp() {
    const Na__ConfigResponse = await fetch(Na__RoomSizeComparator__ConfigPath, { cache: "no-cache" });
    if (!Na__ConfigResponse.ok) throw new Error(`Failed to load app config (HTTP ${Na__ConfigResponse.status}).`);
    Na__RoomSizeComparator__Config = await Na__ConfigResponse.json();

    Na__RoomSizeComparator__ConfigureUnits(Na__RoomSizeComparator__Config.NaMiniApp__Units);
    Na__RoomSizeComparator__ApplyUiText();

    Na__RoomSizeComparator__Index = await Na__RoomSizeComparator__LoadRoomData(Na__RoomSizeComparator__Config.NaMiniApp__Assets.NaMiniApp__RoomDataUrl);

    Na__RoomSizeComparator__PopulateRoomSelect();
    Na__RoomSizeComparator__InitialiseState();
    Na__RoomSizeComparator__SyncControls(true);
    Na__RoomSizeComparator__RegisterEventListeners();
    Na__RoomSizeComparator__SetView(Na__RoomSizeComparator__State.Na__View);
}
// ------------------------------------------------------------

Na__RoomSizeComparator__BootstrapApp().catch((Na__ErrorObject) => {
    console.error(Na__ErrorObject);
    const Na__Message = Na__RoomSizeComparator__Config
        ? Na__RoomSizeComparator__Config.NaMiniApp__UiText.NaMiniApp__ErrorDataLoad
        : "Unable to load the app configuration.";
    const Na__Main = document.querySelector(".RSC__main");
    if (Na__Main) {
        Na__Main.replaceChildren();
        const Na__P = document.createElement("p");
        Na__P.className = "RSC__error-message";
        Na__P.textContent = `${Na__Message} ${Na__ErrorObject.message}`;
        Na__Main.appendChild(Na__P);
    }
});

// endregion -------------------------------------------------------------------
