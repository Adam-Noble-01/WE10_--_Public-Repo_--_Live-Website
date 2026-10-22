// =============================================================================
// NOBLE ARCHITECTURE - APRILTAG SCALE MAT - PDF EXPORT
// =============================================================================
//
// FILE    : MiniApp__SurveyingUtils__AprilTagScaleMat__PdfExport__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Draw the sheet as a 1:1 true-scale vector PDF in millimetres via jsPDF
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

// @delegate: ./MiniApp__SurveyingUtils__AprilTagScaleMat__TagCodes__.js
import { Na__AprilTagScaleMat__DecodeTagMatrix } from "./MiniApp__SurveyingUtils__AprilTagScaleMat__TagCodes__.js";

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Internal Drawing Helpers
// -----------------------------------------------------------------------------

// FUNCTION | Sheet trim border
// ------------------------------------------------------------
function Na__AprilTagScaleMat__PdfDrawBorder(Na__Doc, Na__Cfg) {
    Na__Doc.setDrawColor(200, 205, 215);
    Na__Doc.setLineWidth(0.2);
    Na__Doc.rect(4, 4, Na__Cfg.sheetW - 8, Na__Cfg.sheetH - 8, "S");
}
// ------------------------------------------------------------


// FUNCTION | Turntable spokes, rings and boundary
// ------------------------------------------------------------
function Na__AprilTagScaleMat__PdfDrawTurntable(Na__Doc, Na__Placement) {
    if (!Na__Placement.turntable) return;

    const Na__MaxRadius = Na__Placement.turntable.maxRadius;
    const Na__Cx        = Na__Placement.centerX;
    const Na__Cy        = Na__Placement.centerY;

    Na__Doc.setDrawColor(210, 214, 220);
    Na__Doc.setLineWidth(0.2);

    for (let Na__Angle = 0; Na__Angle < 180; Na__Angle += 30) {
        const Na__Rad = (Na__Angle * Math.PI) / 180;
        Na__Doc.line(
            Na__Cx - Math.cos(Na__Rad) * Na__MaxRadius, Na__Cy - Math.sin(Na__Rad) * Na__MaxRadius,
            Na__Cx + Math.cos(Na__Rad) * Na__MaxRadius, Na__Cy + Math.sin(Na__Rad) * Na__MaxRadius
        );
    }

    Na__Doc.setFont("helvetica", "normal");
    Na__Doc.setFontSize(6);
    Na__Doc.setTextColor(150, 155, 165);
    for (let Na__R = 20; Na__R <= Na__MaxRadius; Na__R += 20) {
        Na__Doc.circle(Na__Cx, Na__Cy, Na__R, "S");
        Na__Doc.text(`D=${Na__R * 2}mm`, Na__Cx + 1.2, Na__Cy - Na__R + 2.4);
    }

    Na__Doc.setDrawColor(140, 145, 155);
    Na__Doc.setLineWidth(0.3);
    Na__Doc.circle(Na__Cx, Na__Cy, Na__MaxRadius, "S");
}
// ------------------------------------------------------------


// FUNCTION | CL/CL perimeter, diagonals and callouts
// ------------------------------------------------------------
function Na__AprilTagScaleMat__PdfDrawDimensions(Na__Doc, Na__Cfg, Na__Layout, Na__Placement) {
    const Na__Format  = (Na__Mm) => Na__AprilTagScaleMat__FormatDistance(Na__Mm, Na__Cfg.unitMode);
    const Na__CenterX = Na__Placement.centerX;
    const Na__CenterY = Na__Placement.centerY;

    // Perimeter rectangle
    // ------------------------------------
    Na__Doc.setDrawColor(2, 132, 199);
    Na__Doc.setLineWidth(0.3);
    Na__Doc.setLineDashPattern([3, 2], 0);
    Na__Doc.rect(Na__Cfg.edgeMargin, Na__Cfg.edgeMargin, Na__Layout.spanX, Na__Layout.spanY, "S");

    // Diagonals
    // ------------------------------------
    Na__Doc.setDrawColor(5, 150, 105);
    Na__Doc.setLineDashPattern([4, 2.5], 0);
    Na__Doc.line(Na__Layout.tl.cx, Na__Layout.tl.cy, Na__Layout.br.cx, Na__Layout.br.cy);
    Na__Doc.line(Na__Layout.bl.cx, Na__Layout.bl.cy, Na__Layout.tr.cx, Na__Layout.tr.cy);
    Na__Doc.setLineDashPattern([], 0);

    const Na__InsetOffset = Na__Cfg.blackSize * 0.65 + 4.5;

    // Top horizontal span callout
    // ------------------------------------
    const Na__TopSpanY = Na__Cfg.edgeMargin + Na__InsetOffset;
    Na__Doc.setDrawColor(2, 132, 199);
    Na__Doc.setLineWidth(0.25);
    Na__Doc.line(Na__Layout.tl.cx, Na__TopSpanY, Na__Layout.tr.cx, Na__TopSpanY);

    const Na__TopText  = `CL/CL #${Na__Layout.tl.id} to #${Na__Layout.tr.id}: ${Na__Format(Na__Layout.spanX)}`;
    const Na__TopPillW = Math.max(46, Na__TopText.length * 1.55 + 6);
    Na__Doc.setFillColor(255, 255, 255);
    Na__Doc.rect(Na__CenterX - Na__TopPillW / 2, Na__TopSpanY - 2.6, Na__TopPillW, 5.2, "FD");
    Na__Doc.setFont("helvetica", "bold");
    Na__Doc.setFontSize(7.2);
    Na__Doc.setTextColor(3, 105, 161);
    Na__Doc.text(Na__TopText, Na__CenterX, Na__TopSpanY + 0.9, { align: "center" });

    // Left vertical span callout
    // ------------------------------------
    const Na__LeftSpanX = Na__Cfg.edgeMargin + Na__InsetOffset;
    Na__Doc.line(Na__LeftSpanX, Na__Layout.tl.cy, Na__LeftSpanX, Na__Layout.bl.cy);
    Na__Doc.text(`CL/CL #${Na__Layout.tl.id} to #${Na__Layout.bl.id}: ${Na__Format(Na__Layout.spanY)}`,
                 Na__LeftSpanX - 1.5, Na__CenterY, { angle: 90, align: "center" });

    // Diagonal callout, only when clear of the top span
    // ------------------------------------
    const Na__DiagText  = `DIAG CL/CL #${Na__Layout.tl.id} to #${Na__Layout.br.id}: ${Na__Format(Na__Layout.diagDist)}`;
    const Na__DiagPillW = Math.max(52, Na__DiagText.length * 1.55 + 6);
    const Na__DiagY     = Na__CenterY - 24;
    if (Na__DiagY > Na__TopSpanY + 8) {
        Na__Doc.setDrawColor(5, 150, 105);
        Na__Doc.setFillColor(255, 255, 255);
        Na__Doc.rect(Na__CenterX - Na__DiagPillW / 2, Na__DiagY - 2.6, Na__DiagPillW, 5.2, "FD");
        Na__Doc.setTextColor(4, 120, 87);
        Na__Doc.text(Na__DiagText, Na__CenterX, Na__DiagY + 0.9, { align: "center" });
    }
}
// ------------------------------------------------------------


// FUNCTION | RealityScan schedule plaque
// ------------------------------------------------------------
function Na__AprilTagScaleMat__PdfDrawPlaque(Na__Doc, Na__Cfg, Na__Layout, Na__Placement) {
    if (!Na__Placement.plaque) return;

    const { px: Na__Px, py: Na__Py, w: Na__W, h: Na__H } = Na__Placement.plaque;
    const Na__Right = Na__Px + Na__W - 3.5;
    const Na__Both  = (Na__Mm) => `${Na__Mm.toFixed(2)} mm (${(Na__Mm / 1000).toFixed(5)} m)`;

    // Frame and title bar
    // ------------------------------------
    Na__Doc.setDrawColor(17, 24, 39);
    Na__Doc.setFillColor(255, 255, 255);
    Na__Doc.setLineWidth(0.35);
    Na__Doc.rect(Na__Px, Na__Py, Na__W, Na__H, "FD");
    Na__Doc.setFillColor(17, 24, 39);
    Na__Doc.rect(Na__Px, Na__Py, Na__W, 6.2, "F");

    Na__Doc.setFont("helvetica", "bold");
    Na__Doc.setFontSize(7.8);
    Na__Doc.setTextColor(255, 255, 255);
    Na__Doc.text("REALITYSCAN APRILTAG 36h11 CALIBRATION SCHEDULE", Na__Placement.centerX, Na__Py + 4.2, { align: "center" });

    Na__Doc.setFontSize(6.8);
    Na__Doc.setTextColor(17, 24, 39);
    Na__Doc.text("1. Detect Markers Tool -> Marker Type: Square, AprilTag, 36h11", Na__Px + 3.5, Na__Py + 11.2);

    // Row labels
    // ------------------------------------
    const Na__L = Na__Layout;
    Na__Doc.setFont("helvetica", "normal");
    Na__Doc.setFontSize(6.5);
    Na__Doc.setTextColor(55, 65, 81);
    Na__Doc.text(`- Horiz Corner CL/CL (#${Na__L.tl.id} to #${Na__L.tr.id} & #${Na__L.bl.id} to #${Na__L.br.id}):`, Na__Px + 3.5, Na__Py + 15.6);
    Na__Doc.text(`- Vert Corner CL/CL (#${Na__L.tl.id} to #${Na__L.bl.id} & #${Na__L.tr.id} to #${Na__L.br.id}):`,  Na__Px + 3.5, Na__Py + 19.8);
    Na__Doc.text(`- Diagonal Corner CL/CL (#${Na__L.tl.id} to #${Na__L.br.id} & #${Na__L.bl.id} to #${Na__L.tr.id}):`, Na__Px + 3.5, Na__Py + 24.0);
    Na__Doc.text("- Adjacent Tag Pitch CL/CL (Horiz / Vert):", Na__Px + 3.5, Na__Py + 28.2);

    // Row values
    // ------------------------------------
    Na__Doc.setFont("courier", "bold");
    Na__Doc.setFontSize(6.8);
    Na__Doc.setTextColor(3, 105, 161);
    Na__Doc.text(Na__Both(Na__L.spanX), Na__Right, Na__Py + 15.6, { align: "right" });
    Na__Doc.text(Na__Both(Na__L.spanY), Na__Right, Na__Py + 19.8, { align: "right" });
    Na__Doc.setTextColor(4, 120, 87);
    Na__Doc.text(Na__Both(Na__L.diagDist), Na__Right, Na__Py + 24.0, { align: "right" });
    Na__Doc.setTextColor(17, 24, 39);
    Na__Doc.text(`H: ${Na__L.stepX.toFixed(2)} mm | V: ${Na__L.stepY.toFixed(2)} mm`, Na__Right, Na__Py + 28.2, { align: "right" });

    // Footer line
    // ------------------------------------
    Na__Doc.setDrawColor(209, 213, 219);
    Na__Doc.setLineWidth(0.2);
    Na__Doc.line(Na__Px + 3, Na__Py + 30.8, Na__Px + Na__W - 3, Na__Py + 30.8);
    Na__Doc.setFont("helvetica", "bold");
    Na__Doc.setFontSize(6.3);
    Na__Doc.text(`Outer Black Square = ${Na__Cfg.blackSize.toFixed(2)} mm (${(Na__Cfg.blackSize / 1000).toFixed(4)} m) | Print at 100% Scale`,
                 Na__Placement.centerX, Na__Py + 35.0, { align: "center" });
}
// ------------------------------------------------------------


// FUNCTION | 100 mm physical verification rule
// ------------------------------------------------------------
function Na__AprilTagScaleMat__PdfDrawScaleBar(Na__Doc, Na__Placement) {
    if (!Na__Placement.scaleBar) return;

    const { barX: Na__BarX, barY: Na__BarY, barW: Na__BarW } = Na__Placement.scaleBar;

    Na__Doc.setDrawColor(107, 114, 128);
    Na__Doc.setFillColor(255, 255, 255);
    Na__Doc.setLineWidth(0.2);
    Na__Doc.rect(Na__BarX - 4, Na__BarY - 4.5, Na__BarW + 8, 10.5, "FD");

    Na__Doc.setFont("helvetica", "bold");
    Na__Doc.setFontSize(6);
    Na__Doc.setTextColor(17, 24, 39);
    Na__Doc.text("100.00 mm (0.1000 m) PHYSICAL PRINT SCALE VERIFICATION BAR", Na__Placement.centerX, Na__BarY - 1.5, { align: "center" });

    Na__Doc.setFont("helvetica", "normal");
    Na__Doc.setFontSize(5.2);
    for (let Na__I = 0; Na__I < 10; Na__I++) {
        const Na__SegX = Na__BarX + Na__I * 10;
        Na__Doc.setDrawColor(0, 0, 0);
        if (Na__I % 2 === 0) Na__Doc.setFillColor(0, 0, 0);
        else                 Na__Doc.setFillColor(255, 255, 255);
        Na__Doc.rect(Na__SegX, Na__BarY, 10, 2.2, "FD");
        Na__Doc.text(`${Na__I * 10}`, Na__SegX, Na__BarY + 4.6, { align: "center" });
    }
    Na__Doc.text("100mm", Na__BarX + 100, Na__BarY + 4.6, { align: "center" });
}
// ------------------------------------------------------------


// FUNCTION | Every perimeter tag as vector rectangles
// ------------------------------------------------------------
function Na__AprilTagScaleMat__PdfDrawTags(Na__Doc, Na__Cfg, Na__Layout) {
    const Na__BitSize   = Na__Cfg.blackSize / 8;
    const Na__QuietSize = Na__Cfg.blackSize + 2 * Na__BitSize;

    Na__Layout.tags.forEach((Na__Tag) => {
        const Na__Matrix = Na__AprilTagScaleMat__DecodeTagMatrix(Na__Tag.id);
        const Na__Bx     = Na__Tag.cx - Na__Cfg.blackSize / 2;
        const Na__By     = Na__Tag.cy - Na__Cfg.blackSize / 2;

        // White quiet zone
        // ------------------------------------
        Na__Doc.setDrawColor(225, 228, 232);
        Na__Doc.setFillColor(255, 255, 255);
        Na__Doc.setLineWidth(0.15);
        Na__Doc.rect(Na__Tag.cx - Na__QuietSize / 2, Na__Tag.cy - Na__QuietSize / 2, Na__QuietSize, Na__QuietSize, "FD");

        // Solid black base, then white data cells
        // ------------------------------------
        Na__Doc.setFillColor(0, 0, 0);
        Na__Doc.rect(Na__Bx, Na__By, Na__Cfg.blackSize, Na__Cfg.blackSize, "F");

        Na__Doc.setFillColor(255, 255, 255);
        for (let Na__R = 0; Na__R < 8; Na__R++) {
            for (let Na__C = 0; Na__C < 8; Na__C++) {
                if (Na__Matrix[Na__R][Na__C] === 1) {
                    Na__Doc.rect(Na__Bx + Na__C * Na__BitSize, Na__By + Na__R * Na__BitSize, Na__BitSize, Na__BitSize, "F");
                }
            }
        }

        // Centre crosshair
        // ------------------------------------
        if (Na__Cfg.showCrosshairs) {
            const Na__Ch = Math.min(1.6, Na__BitSize * 0.45);
            Na__Doc.setDrawColor(239, 68, 68);
            Na__Doc.setLineWidth(0.18);
            Na__Doc.line(Na__Tag.cx - Na__Ch, Na__Tag.cy, Na__Tag.cx + Na__Ch, Na__Tag.cy);
            Na__Doc.line(Na__Tag.cx, Na__Tag.cy - Na__Ch, Na__Tag.cx, Na__Tag.cy + Na__Ch);
        }

        // ID label
        // ------------------------------------
        Na__Doc.setFont("helvetica", "bold");
        Na__Doc.setFontSize(6.4);
        if (Na__Tag.isCorner) Na__Doc.setTextColor(2, 132, 199);
        else                  Na__Doc.setTextColor(17, 24, 39);
        Na__Doc.text(`36h11 #${Na__Tag.id}${Na__Tag.isCorner ? " [CORNER]" : ""}`,
                     Na__Tag.cx, Na__Tag.cy + Na__Cfg.blackSize / 2 + Na__BitSize + 2.3, { align: "center" });
    });
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Exports
// -----------------------------------------------------------------------------

// FUNCTION | Build the PDF and trigger the download
// ------------------------------------------------------------
export function Na__AprilTagScaleMat__DownloadPdf(Na__Settings, Na__AppConfig) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        window.alert(Na__AppConfig.NaMiniApp__UiText.NaMiniApp__PdfLibMissing);
        return;
    }

    const Na__Layout    = Na__AprilTagScaleMat__CalculateLayout(Na__Settings, Na__AppConfig);
    const Na__Placement = Na__AprilTagScaleMat__GetOverlayPlacement(Na__Settings, Na__Layout);
    const { jsPDF }     = window.jspdf;

    const Na__Doc = new jsPDF({
        orientation : Na__Settings.sheetW >= Na__Settings.sheetH ? "l" : "p",
        unit        : "mm",
        format      : [Na__Settings.sheetW, Na__Settings.sheetH],
        compress    : true
    });

    // Same back-to-front order as the SVG preview
    // ------------------------------------
    Na__AprilTagScaleMat__PdfDrawBorder(Na__Doc, Na__Settings);
    Na__AprilTagScaleMat__PdfDrawTurntable(Na__Doc, Na__Placement);
    if (Na__Settings.showDimLines) {
        Na__AprilTagScaleMat__PdfDrawDimensions(Na__Doc, Na__Settings, Na__Layout, Na__Placement);
    }
    Na__AprilTagScaleMat__PdfDrawPlaque(Na__Doc, Na__Settings, Na__Layout, Na__Placement);
    Na__AprilTagScaleMat__PdfDrawScaleBar(Na__Doc, Na__Placement);
    Na__AprilTagScaleMat__PdfDrawTags(Na__Doc, Na__Settings, Na__Layout);

    Na__Doc.save(`RealityScan_AprilTag_36h11_${Na__Settings.preset}_${Na__Settings.sheetW}x${Na__Settings.sheetH}mm_Tag${Na__Settings.blackSize}mm.pdf`);
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
