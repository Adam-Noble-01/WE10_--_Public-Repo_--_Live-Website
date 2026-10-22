// =============================================================================
// NOBLE ARCHITECTURE - APRILTAG SCALE MAT - SVG OVERLAYS
// =============================================================================
//
// FILE    : MiniApp__SurveyingUtils__AprilTagScaleMat__SvgOverlays__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : SVG markup for the turntable grid, CL/CL dimensions, schedule plaque and scale rule
// CREATED : 20-Oct-2026
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Imports
// -----------------------------------------------------------------------------

// @delegate: ./MiniApp__SurveyingUtils__AprilTagScaleMat__Layout__.js
import { Na__AprilTagScaleMat__FormatDistance } from "./MiniApp__SurveyingUtils__AprilTagScaleMat__Layout__.js";

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module-Level Variables
// -----------------------------------------------------------------------------

 const Na__AprilTagScaleMat__SvgFont = "Helvetica, Arial, sans-serif";

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Internal Helpers
// -----------------------------------------------------------------------------

// FUNCTION | A white dimension pill with a centred label, optionally rotated
// ------------------------------------------------------------
function Na__AprilTagScaleMat__BuildPillLabel(Na__X, Na__Y, Na__Text, Na__BorderColour, Na__TextColour, Na__RotateDeg = 0) {
    const Na__PillW     = Math.max(38, Na__Text.length * 1.65 + 6);
    const Na__PillH     = 5.4;
    const Na__Transform = Na__RotateDeg !== 0
        ? `transform="rotate(${Na__RotateDeg.toFixed(2)} ${Na__X.toFixed(2)} ${Na__Y.toFixed(2)})"`
        : "";

    return `
        <g ${Na__Transform}>
            <rect x="${(Na__X - Na__PillW / 2).toFixed(2)}" y="${(Na__Y - Na__PillH / 2).toFixed(2)}" width="${Na__PillW.toFixed(2)}" height="${Na__PillH}" rx="1.2" fill="#ffffff" stroke="${Na__BorderColour}" stroke-width="0.3" />
            <text x="${Na__X.toFixed(2)}" y="${(Na__Y + 1.1).toFixed(2)}" text-anchor="middle" font-family="${Na__AprilTagScaleMat__SvgFont}" font-weight="bold" font-size="2.7" fill="${Na__TextColour}">${Na__Text}</text>
        </g>
    `;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Exports
// -----------------------------------------------------------------------------

// FUNCTION | Sheet background and trim border
// ------------------------------------------------------------
export function Na__AprilTagScaleMat__BuildSheetFrameSvg(Na__Settings) {
    return [
        `<rect x="0" y="0" width="${Na__Settings.sheetW}" height="${Na__Settings.sheetH}" fill="#ffffff" />`,
        `<rect x="4" y="4" width="${Na__Settings.sheetW - 8}" height="${Na__Settings.sheetH - 8}" fill="none" stroke="#d1d5db" stroke-width="0.25" />`
    ];
}
// ------------------------------------------------------------


// FUNCTION | Central turntable / subject placement grid
// ------------------------------------------------------------
export function Na__AprilTagScaleMat__BuildTurntableSvg(Na__Placement) {
    if (!Na__Placement.turntable) return [];

    const Na__Parts     = [];
    const Na__MaxRadius = Na__Placement.turntable.maxRadius;
    const Na__Cx        = Na__Placement.centerX;
    const Na__Cy        = Na__Placement.centerY;

    Na__Parts.push(`<g id="turntableGrid" opacity="0.85">`);

    // Radial spokes every 30 degrees
    // ------------------------------------
    for (let Na__Angle = 0; Na__Angle < 180; Na__Angle += 30) {
        const Na__Rad = (Na__Angle * Math.PI) / 180;
        Na__Parts.push(`<line x1="${(Na__Cx - Math.cos(Na__Rad) * Na__MaxRadius).toFixed(2)}" y1="${(Na__Cy - Math.sin(Na__Rad) * Na__MaxRadius).toFixed(2)}" x2="${(Na__Cx + Math.cos(Na__Rad) * Na__MaxRadius).toFixed(2)}" y2="${(Na__Cy + Math.sin(Na__Rad) * Na__MaxRadius).toFixed(2)}" stroke="#e5e7eb" stroke-width="0.2" stroke-dasharray="1.5,1.5" />`);
    }

    // Concentric metric rings every 20 mm radius
    // ------------------------------------
    for (let Na__R = 20; Na__R <= Na__MaxRadius; Na__R += 20) {
        Na__Parts.push(`<circle cx="${Na__Cx}" cy="${Na__Cy}" r="${Na__R}" fill="none" stroke="#d1d5db" stroke-width="0.25" stroke-dasharray="2,2" />`);
        Na__Parts.push(`<text x="${Na__Cx + 1.5}" y="${(Na__Cy - Na__R + 2.8).toFixed(2)}" font-family="${Na__AprilTagScaleMat__SvgFont}" font-size="2.3" fill="#9ca3af">Ø${Na__R * 2}mm</text>`);
    }

    // Outer boundary and centre crosshair
    // ------------------------------------
    Na__Parts.push(`<circle cx="${Na__Cx}" cy="${Na__Cy}" r="${Na__MaxRadius.toFixed(2)}" fill="none" stroke="#9ca3af" stroke-width="0.35" />`);
    Na__Parts.push(`<line x1="${Na__Cx - 6}" y1="${Na__Cy}" x2="${Na__Cx + 6}" y2="${Na__Cy}" stroke="#6b7280" stroke-width="0.3" />`);
    Na__Parts.push(`<line x1="${Na__Cx}" y1="${Na__Cy - 6}" x2="${Na__Cx}" y2="${Na__Cy + 6}" stroke="#6b7280" stroke-width="0.3" />`);
    Na__Parts.push(`</g>`);

    return Na__Parts;
}
// ------------------------------------------------------------


// FUNCTION | Perimeter and diagonal CL/CL dimension lines with callouts
// ------------------------------------------------------------
export function Na__AprilTagScaleMat__BuildDimensionLinesSvg(Na__Settings, Na__Layout, Na__Placement) {
    const Na__Cfg    = Na__Settings;
    const Na__Parts  = [];
    const Na__Format = (Na__Mm) => Na__AprilTagScaleMat__FormatDistance(Na__Mm, Na__Cfg.unitMode);

    Na__Parts.push(`<g id="dimensionLines">`);

    // Perimeter rectangle and both diagonals
    // ------------------------------------
    Na__Parts.push(`<rect x="${Na__Cfg.edgeMargin}" y="${Na__Cfg.edgeMargin}" width="${Na__Layout.spanX}" height="${Na__Layout.spanY}" fill="none" stroke="#0284c7" stroke-width="0.3" stroke-dasharray="3,2" />`);
    Na__Parts.push(`<line x1="${Na__Layout.tl.cx}" y1="${Na__Layout.tl.cy}" x2="${Na__Layout.br.cx}" y2="${Na__Layout.br.cy}" stroke="#059669" stroke-width="0.3" stroke-dasharray="4,2.5" />`);
    Na__Parts.push(`<line x1="${Na__Layout.bl.cx}" y1="${Na__Layout.bl.cy}" x2="${Na__Layout.tr.cx}" y2="${Na__Layout.tr.cy}" stroke="#059669" stroke-width="0.25" stroke-dasharray="2,3" opacity="0.65" />`);

    const Na__InsetOffset = Na__Cfg.blackSize * 0.65 + 4.5;

    // Top full horizontal span
    // ------------------------------------
    const Na__TopSpanY = Na__Cfg.edgeMargin + Na__InsetOffset;
    Na__Parts.push(`<line x1="${Na__Layout.tl.cx}" y1="${Na__TopSpanY}" x2="${Na__Layout.tr.cx}" y2="${Na__TopSpanY}" stroke="#0284c7" stroke-width="0.25" />`);
    Na__Parts.push(Na__AprilTagScaleMat__BuildPillLabel(
        Na__Placement.centerX, Na__TopSpanY,
        `CL/CL #${Na__Layout.tl.id}↔#${Na__Layout.tr.id}: ${Na__Format(Na__Layout.spanX)}`,
        "#0284c7", "#0369a1"
    ));

    // Left full vertical span
    // ------------------------------------
    const Na__LeftSpanX = Na__Cfg.edgeMargin + Na__InsetOffset;
    Na__Parts.push(`<line x1="${Na__LeftSpanX}" y1="${Na__Layout.tl.cy}" x2="${Na__LeftSpanX}" y2="${Na__Layout.bl.cy}" stroke="#0284c7" stroke-width="0.25" />`);
    Na__Parts.push(Na__AprilTagScaleMat__BuildPillLabel(
        Na__LeftSpanX, Na__Placement.centerY,
        `CL/CL #${Na__Layout.tl.id}↔#${Na__Layout.bl.id}: ${Na__Format(Na__Layout.spanY)}`,
        "#0284c7", "#0369a1", -90
    ));

    // Diagonal label, offset from centre so it stays crisp
    // ------------------------------------
    const Na__DiagAngle  = Math.atan2(Na__Layout.spanY, Na__Layout.spanX) * (180 / Math.PI);
    const Na__DiagOffset = Math.min(Na__Layout.spanX, Na__Layout.spanY) * 0.18;
    Na__Parts.push(Na__AprilTagScaleMat__BuildPillLabel(
        Na__Placement.centerX + Math.cos((Na__DiagAngle * Math.PI) / 180) * Na__DiagOffset,
        Na__Placement.centerY + Math.sin((Na__DiagAngle * Math.PI) / 180) * Na__DiagOffset,
        `DIAG CL/CL #${Na__Layout.tl.id}↔#${Na__Layout.br.id}: ${Na__Format(Na__Layout.diagDist)}`,
        "#059669", "#047857", Na__DiagAngle
    ));

    // Pitch callout between the first two top tags
    // ------------------------------------
    if (Na__Cfg.cols > 2) {
        const Na__MidPitchX = (Na__Layout.tags[0].cx + Na__Layout.tags[1].cx) / 2;
        const Na__PitchY    = Na__Cfg.edgeMargin - Na__Cfg.blackSize * 0.55 - 2.2;
        if (Na__PitchY > 3.5) {
            Na__Parts.push(`<text x="${Na__MidPitchX.toFixed(2)}" y="${Na__PitchY.toFixed(2)}" text-anchor="middle" font-family="${Na__AprilTagScaleMat__SvgFont}" font-weight="bold" font-size="2.3" fill="#0284c7">PITCH CL/CL: ${Na__Layout.stepX.toFixed(2)} mm</text>`);
        }
    }

    Na__Parts.push(`</g>`);
    return Na__Parts;
}
// ------------------------------------------------------------


// FUNCTION | Central RealityScan calibration schedule plaque
// ------------------------------------------------------------
export function Na__AprilTagScaleMat__BuildPlaqueSvg(Na__Settings, Na__Layout, Na__Placement) {
    if (!Na__Placement.plaque) return [];

    const { px: Na__Px, py: Na__Py, w: Na__W, h: Na__H } = Na__Placement.plaque;
    const Na__Cx    = Na__Placement.centerX;
    const Na__Left  = (Na__Px + 3.5).toFixed(2);
    const Na__Right = (Na__Px + Na__W - 3.5).toFixed(2);
    const Na__Ids   = Na__Layout;

    // Sub-function: one label / value row
    // ------------------------------------
    const Na__Row = (Na__OffsetY, Na__LabelText, Na__ValueText, Na__ValueColour) => `
          <text x="${Na__Left}" y="${(Na__Py + Na__OffsetY).toFixed(2)}" font-family="${Na__AprilTagScaleMat__SvgFont}" font-size="2.4" fill="#374151">
            ${Na__LabelText}
          </text>
          <text x="${Na__Right}" y="${(Na__Py + Na__OffsetY).toFixed(2)}" text-anchor="end" font-family="Courier, monospace" font-weight="bold" font-size="2.5" fill="${Na__ValueColour}">
            ${Na__ValueText}
          </text>`;

    const Na__Both = (Na__Mm) => `${Na__Mm.toFixed(2)} mm (${(Na__Mm / 1000).toFixed(5)} m)`;

    return [`
        <g id="calibrationSchedulePlaque">
          <rect x="${Na__Px.toFixed(2)}" y="${Na__Py.toFixed(2)}" width="${Na__W.toFixed(2)}" height="${Na__H}" rx="1.8" fill="#ffffff" fill-opacity="0.94" stroke="#111827" stroke-width="0.4" />
          <rect x="${Na__Px.toFixed(2)}" y="${Na__Py.toFixed(2)}" width="${Na__W.toFixed(2)}" height="6.2" rx="1.8" fill="#111827" />
          <text x="${Na__Cx.toFixed(2)}" y="${(Na__Py + 4.3).toFixed(2)}" text-anchor="middle" font-family="${Na__AprilTagScaleMat__SvgFont}" font-weight="bold" font-size="2.9" fill="#ffffff">
            REALITYSCAN APRILTAG 36h11 CALIBRATION SCHEDULE
          </text>
          <text x="${Na__Left}" y="${(Na__Py + 11.2).toFixed(2)}" font-family="${Na__AprilTagScaleMat__SvgFont}" font-weight="bold" font-size="2.5" fill="#111827">
            1. Detect Markers Tool → Marker Type: Square, AprilTag, 36h11
          </text>
          ${Na__Row(15.6, `• Corner Horizontal CL/CL (#${Na__Ids.tl.id} ↔ #${Na__Ids.tr.id} &amp; #${Na__Ids.bl.id} ↔ #${Na__Ids.br.id}):`, Na__Both(Na__Layout.spanX), "#0369a1")}
          ${Na__Row(19.8, `• Corner Vertical CL/CL (#${Na__Ids.tl.id} ↔ #${Na__Ids.bl.id} &amp; #${Na__Ids.tr.id} ↔ #${Na__Ids.br.id}):`, Na__Both(Na__Layout.spanY), "#0369a1")}
          ${Na__Row(24.0, `• Diagonal Corner CL/CL (#${Na__Ids.tl.id} ↔ #${Na__Ids.br.id} &amp; #${Na__Ids.bl.id} ↔ #${Na__Ids.tr.id}):`, Na__Both(Na__Layout.diagDist), "#047857")}
          ${Na__Row(28.2, "• Adjacent Step Pitch CL/CL (Horiz / Vert):", `H: ${Na__Layout.stepX.toFixed(2)} mm | V: ${Na__Layout.stepY.toFixed(2)} mm`, "#111827")}
          <line x1="${(Na__Px + 3).toFixed(2)}" y1="${(Na__Py + 30.8).toFixed(2)}" x2="${(Na__Px + Na__W - 3).toFixed(2)}" y2="${(Na__Py + 30.8).toFixed(2)}" stroke="#d1d5db" stroke-width="0.25" />
          <text x="${Na__Cx.toFixed(2)}" y="${(Na__Py + 35.0).toFixed(2)}" text-anchor="middle" font-family="${Na__AprilTagScaleMat__SvgFont}" font-weight="bold" font-size="2.35" fill="#111827">
            Outer Black Square = ${Na__Settings.blackSize.toFixed(2)} mm (${(Na__Settings.blackSize / 1000).toFixed(4)} m) | Print at 100% (Actual Size)
          </text>
        </g>
    `];
}
// ------------------------------------------------------------


// FUNCTION | Physical 100 mm print verification rule
// ------------------------------------------------------------
export function Na__AprilTagScaleMat__BuildScaleBarSvg(Na__Placement) {
    if (!Na__Placement.scaleBar) return [];

    const { barX: Na__BarX, barY: Na__BarY, barW: Na__BarW } = Na__Placement.scaleBar;
    const Na__Cx    = Na__Placement.centerX;
    const Na__Parts = [];

    Na__Parts.push(`<g id="scaleVerificationRule">`);
    Na__Parts.push(`<rect x="${Na__BarX - 4}" y="${Na__BarY - 4.5}" width="${Na__BarW + 8}" height="10.5" rx="1" fill="#ffffff" stroke="#6b7280" stroke-width="0.25" />`);
    Na__Parts.push(`<text x="${Na__Cx}" y="${Na__BarY - 1.5}" text-anchor="middle" font-family="${Na__AprilTagScaleMat__SvgFont}" font-weight="bold" font-size="2.2" fill="#111827">100.00 mm (0.1000 m) PHYSICAL PRINT SCALE VERIFICATION BAR</text>`);

    for (let Na__I = 0; Na__I < 10; Na__I++) {
        const Na__SegX = Na__BarX + Na__I * 10;
        const Na__Fill = Na__I % 2 === 0 ? "#000000" : "#ffffff";
        Na__Parts.push(`<rect x="${Na__SegX}" y="${Na__BarY}" width="10" height="2.2" fill="${Na__Fill}" stroke="#000000" stroke-width="0.2" />`);
        Na__Parts.push(`<text x="${Na__SegX}" y="${Na__BarY + 4.6}" text-anchor="middle" font-family="${Na__AprilTagScaleMat__SvgFont}" font-size="1.9" fill="#374151">${Na__I * 10}</text>`);
    }

    Na__Parts.push(`<text x="${Na__BarX + 100}" y="${Na__BarY + 4.6}" text-anchor="middle" font-family="${Na__AprilTagScaleMat__SvgFont}" font-size="1.9" fill="#374151">100mm</text>`);
    Na__Parts.push(`</g>`);

    return Na__Parts;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
