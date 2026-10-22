// =============================================================================
// NOBLE ARCHITECTURE - APRILTAG SCALE MAT - SVG TAGS
// =============================================================================
//
// FILE    : MiniApp__SurveyingUtils__AprilTagScaleMat__SvgTags__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : SVG markup for the perimeter AprilTag 36h11 fiducials
// CREATED : 20-Oct-2026
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Imports
// -----------------------------------------------------------------------------

// @delegate: ./MiniApp__SurveyingUtils__AprilTagScaleMat__TagCodes__.js
import { Na__AprilTagScaleMat__DecodeTagMatrix } from "./MiniApp__SurveyingUtils__AprilTagScaleMat__TagCodes__.js";

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Exports
// -----------------------------------------------------------------------------

// FUNCTION | Build every perimeter tag: quiet zone, black base, white cells, crosshair, label
// The black square is drawn solid first and the white cells punched out of it,
// which keeps adjacent black cells free of anti-aliasing seams.
// ------------------------------------------------------------
export function Na__AprilTagScaleMat__BuildTagsSvg(Na__Settings, Na__Layout) {
    const Na__Cfg       = Na__Settings;
    const Na__Parts     = [];
    const Na__BitSize   = Na__Cfg.blackSize / 8;
    const Na__QuietSize = Na__Cfg.blackSize + 2 * Na__BitSize;

    Na__Layout.tags.forEach((Na__Tag) => {
        const Na__Matrix = Na__AprilTagScaleMat__DecodeTagMatrix(Na__Tag.id);
        const Na__Qx     = Na__Tag.cx - Na__QuietSize / 2;
        const Na__Qy     = Na__Tag.cy - Na__QuietSize / 2;
        const Na__Bx     = Na__Tag.cx - Na__Cfg.blackSize / 2;
        const Na__By     = Na__Tag.cy - Na__Cfg.blackSize / 2;

        Na__Parts.push(`<g class="apriltag" data-id="${Na__Tag.id}">`);

        // Mandatory 1-bit white quiet zone
        // ------------------------------------
        Na__Parts.push(`<rect x="${Na__Qx.toFixed(3)}" y="${Na__Qy.toFixed(3)}" width="${Na__QuietSize.toFixed(3)}" height="${Na__QuietSize.toFixed(3)}" fill="#ffffff" stroke="#e5e7eb" stroke-width="0.15" />`);

        // Solid black base, then the white data cells
        // ------------------------------------
        Na__Parts.push(`<rect x="${Na__Bx.toFixed(3)}" y="${Na__By.toFixed(3)}" width="${Na__Cfg.blackSize.toFixed(3)}" height="${Na__Cfg.blackSize.toFixed(3)}" fill="#000000" shape-rendering="crispEdges" />`);

        for (let Na__R = 0; Na__R < 8; Na__R++) {
            for (let Na__C = 0; Na__C < 8; Na__C++) {
                if (Na__Matrix[Na__R][Na__C] === 1) {
                    Na__Parts.push(`<rect x="${(Na__Bx + Na__C * Na__BitSize).toFixed(3)}" y="${(Na__By + Na__R * Na__BitSize).toFixed(3)}" width="${Na__BitSize.toFixed(3)}" height="${Na__BitSize.toFixed(3)}" fill="#ffffff" shape-rendering="crispEdges" />`);
                }
            }
        }

        // Centre crosshair for manual control-point checks
        // ------------------------------------
        if (Na__Cfg.showCrosshairs) {
            const Na__Ch = Math.min(1.6, Na__BitSize * 0.45);
            Na__Parts.push(`<line x1="${(Na__Tag.cx - Na__Ch).toFixed(3)}" y1="${Na__Tag.cy.toFixed(3)}" x2="${(Na__Tag.cx + Na__Ch).toFixed(3)}" y2="${Na__Tag.cy.toFixed(3)}" stroke="#ef4444" stroke-width="0.18" />`);
            Na__Parts.push(`<line x1="${Na__Tag.cx.toFixed(3)}" y1="${(Na__Tag.cy - Na__Ch).toFixed(3)}" x2="${Na__Tag.cx.toFixed(3)}" y2="${(Na__Tag.cy + Na__Ch).toFixed(3)}" stroke="#ef4444" stroke-width="0.18" />`);
            Na__Parts.push(`<circle cx="${Na__Tag.cx.toFixed(3)}" cy="${Na__Tag.cy.toFixed(3)}" r="0.35" fill="none" stroke="#ef4444" stroke-width="0.15" />`);
        }

        // ID label outside the quiet zone
        // ------------------------------------
        const Na__LabelY       = Na__Tag.cy + Na__Cfg.blackSize / 2 + Na__BitSize + 2.3;
        const Na__BadgeColour  = Na__Tag.isCorner ? "#0284c7" : "#111827";
        const Na__CornerSuffix = Na__Tag.isCorner ? " [CORNER]" : "";

        Na__Parts.push(`<text x="${Na__Tag.cx.toFixed(2)}" y="${Na__LabelY.toFixed(2)}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="bold" font-size="2.35" fill="${Na__BadgeColour}">36h11 #${Na__Tag.id}${Na__CornerSuffix}</text>`);

        Na__Parts.push(`</g>`);
    });

    return Na__Parts;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
