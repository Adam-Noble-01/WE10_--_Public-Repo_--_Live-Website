// =============================================================================
// NOBLE ARCHITECTURE - APRILTAG SCALE MAT - PREVIEW
// =============================================================================
//
// FILE    : MiniApp__SurveyingUtils__AprilTagScaleMat__Preview__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Paint the live SVG sheet, warnings, summary line and CL/CL schedule
// CREATED : 20-Oct-2026
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Imports
// -----------------------------------------------------------------------------

// @delegate: ./MiniApp__SurveyingUtils__AprilTagScaleMat__Layout__.js
import {
    Na__AprilTagScaleMat__CalculateLayout,
    Na__AprilTagScaleMat__GetOverlayPlacement,
    Na__AprilTagScaleMat__FormatDistance
} from "./MiniApp__SurveyingUtils__AprilTagScaleMat__Layout__.js";

// @delegate: ./MiniApp__SurveyingUtils__AprilTagScaleMat__SvgOverlays__.js
import {
    Na__AprilTagScaleMat__BuildSheetFrameSvg,
    Na__AprilTagScaleMat__BuildTurntableSvg,
    Na__AprilTagScaleMat__BuildDimensionLinesSvg,
    Na__AprilTagScaleMat__BuildPlaqueSvg,
    Na__AprilTagScaleMat__BuildScaleBarSvg
} from "./MiniApp__SurveyingUtils__AprilTagScaleMat__SvgOverlays__.js";

// @delegate: ./MiniApp__SurveyingUtils__AprilTagScaleMat__SvgTags__.js
import { Na__AprilTagScaleMat__BuildTagsSvg } from "./MiniApp__SurveyingUtils__AprilTagScaleMat__SvgTags__.js";

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Exports
// -----------------------------------------------------------------------------

// FUNCTION | Recalculate the layout and repaint the whole preview
// ------------------------------------------------------------
export function Na__AprilTagScaleMat__RenderPreview(Na__Settings, Na__AppConfig) {
    const Na__Layout    = Na__AprilTagScaleMat__CalculateLayout(Na__Settings, Na__AppConfig);
    const Na__Placement = Na__AprilTagScaleMat__GetOverlayPlacement(Na__Settings, Na__Layout);
    const Na__UiText    = Na__AppConfig.NaMiniApp__UiText;

    // Warnings and summary line
    // ------------------------------------
    document.getElementById("js__overlapWarning").style.display  = Na__Layout.hasOverlap ? "block" : "none";
    document.getElementById("js__idRangeWarning").style.display  = Na__Layout.hasIdOverflow ? "block" : "none";
    document.getElementById("js__sheetSummaryText").textContent  =
        `${Na__Settings.preset} (${Na__Settings.orientation.toUpperCase()}) — ${Na__Settings.sheetW} × ${Na__Settings.sheetH} mm | ${Na__Layout.tags.length} Perimeter Tags`;

    // Sidebar CL/CL schedule
    // ------------------------------------
    document.getElementById("js__scheduleList").innerHTML = Na__Layout.measurements.map((Na__M) => `
        <div class="ATM__schedule-item">
            <div>
                <div class="ATM__schedule-title">${Na__M.title}</div>
                <div class="ATM__schedule-pair">${Na__M.pair}</div>
            </div>
            <div class="ATM__schedule-val">${Na__AprilTagScaleMat__FormatDistance(Na__M.mm, Na__Settings.unitMode)}</div>
        </div>
    `).join("");

    // SVG sheet, drawn back to front
    // ------------------------------------
    const Na__Svg = document.getElementById("js__sheetSvg");
    Na__Svg.setAttribute("viewBox", `0 0 ${Na__Settings.sheetW} ${Na__Settings.sheetH}`);
    Na__Svg.setAttribute("width",   `${Na__Settings.sheetW}mm`);
    Na__Svg.setAttribute("height",  `${Na__Settings.sheetH}mm`);

    const Na__Parts = [
        ...Na__AprilTagScaleMat__BuildSheetFrameSvg(Na__Settings),
        ...Na__AprilTagScaleMat__BuildTurntableSvg(Na__Placement),
        ...(Na__Settings.showDimLines ? Na__AprilTagScaleMat__BuildDimensionLinesSvg(Na__Settings, Na__Layout, Na__Placement) : []),
        ...Na__AprilTagScaleMat__BuildPlaqueSvg(Na__Settings, Na__Layout, Na__Placement),
        ...Na__AprilTagScaleMat__BuildScaleBarSvg(Na__Placement),
        ...Na__AprilTagScaleMat__BuildTagsSvg(Na__Settings, Na__Layout)
    ];

    Na__Svg.innerHTML = Na__Parts.join("\n");

    // Warning text comes from config so wording stays in one place
    // ------------------------------------
    document.getElementById("js__overlapWarning").textContent = Na__UiText.NaMiniApp__OverlapWarning;
    document.getElementById("js__idRangeWarning").textContent = Na__UiText.NaMiniApp__IdRangeWarning;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
