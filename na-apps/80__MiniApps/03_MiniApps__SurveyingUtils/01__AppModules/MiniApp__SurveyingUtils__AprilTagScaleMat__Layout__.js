// =============================================================================
// NOBLE ARCHITECTURE - APRILTAG SCALE MAT - LAYOUT
// =============================================================================
//
// FILE    : MiniApp__SurveyingUtils__AprilTagScaleMat__Layout__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Perimeter tag set-out, CL/CL measurement schedule and distance formatting
// CREATED : 20-Oct-2026
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Exports
// -----------------------------------------------------------------------------

// FUNCTION | Work out tag centres and reference distances
// Tags run clockwise from the top-left corner: top, right, bottom, left.
// ------------------------------------------------------------
export function Na__AprilTagScaleMat__CalculateLayout(Na__Settings, Na__AppConfig) {
    const Na__Defaults = Na__AppConfig.NaMiniApp__Defaults;
    const Na__Cfg      = Na__Settings;

    const Na__SpanX = Na__Cfg.sheetW - 2 * Na__Cfg.edgeMargin;
    const Na__SpanY = Na__Cfg.sheetH - 2 * Na__Cfg.edgeMargin;
    const Na__StepX = Na__SpanX / (Na__Cfg.cols - 1);
    const Na__StepY = Na__SpanY / (Na__Cfg.rows - 1);

    const Na__Tags = [];
    let   Na__Seq  = 0;

    // Sub-function: push one tag and advance the sequence
    // ------------------------------------
    const Na__PushTag = (Na__Cx, Na__Cy, Na__Edge, Na__IsCorner) => {
        Na__Tags.push({
            seq      : Na__Seq,
            id       : Na__Cfg.startId + Na__Seq,
            cx       : Na__Cx,
            cy       : Na__Cy,
            edge     : Na__Edge,
            isCorner : Na__IsCorner
        });
        Na__Seq++;
    };

    // Top edge, left to right
    // ------------------------------------
    for (let Na__C = 0; Na__C < Na__Cfg.cols; Na__C++) {
        Na__PushTag(Na__Cfg.edgeMargin + Na__C * Na__StepX, Na__Cfg.edgeMargin, "top",
                    Na__C === 0 || Na__C === Na__Cfg.cols - 1);
    }

    // Right edge, top+1 to bottom
    // ------------------------------------
    for (let Na__R = 1; Na__R < Na__Cfg.rows; Na__R++) {
        Na__PushTag(Na__Cfg.sheetW - Na__Cfg.edgeMargin, Na__Cfg.edgeMargin + Na__R * Na__StepY, "right",
                    Na__R === Na__Cfg.rows - 1);
    }

    // Bottom edge, right-1 to left
    // ------------------------------------
    for (let Na__C = Na__Cfg.cols - 2; Na__C >= 0; Na__C--) {
        Na__PushTag(Na__Cfg.edgeMargin + Na__C * Na__StepX, Na__Cfg.sheetH - Na__Cfg.edgeMargin, "bottom",
                    Na__C === 0);
    }

    // Left edge, bottom-1 to top+1
    // ------------------------------------
    for (let Na__R = Na__Cfg.rows - 2; Na__R >= 1; Na__R--) {
        Na__PushTag(Na__Cfg.edgeMargin, Na__Cfg.edgeMargin + Na__R * Na__StepY, "left", false);
    }

    // The four principal corners
    // ------------------------------------
    const Na__Tl = Na__Tags[0];
    const Na__Tr = Na__Tags[Na__Cfg.cols - 1];
    const Na__Br = Na__Tags[Na__Cfg.cols + Na__Cfg.rows - 2];
    const Na__Bl = Na__Tags[2 * Na__Cfg.cols + Na__Cfg.rows - 3];

    const Na__DiagDist = Math.hypot(Na__Br.cx - Na__Tl.cx, Na__Br.cy - Na__Tl.cy);

    // Overlap and quiet-zone check
    // ------------------------------------
    const Na__MinPitch  = Na__Cfg.blackSize * Na__Defaults.NaMiniApp__QuietZoneFactor;
    const Na__HasOverlap = (Na__StepX < Na__MinPitch)
                        || (Na__StepY < Na__MinPitch)
                        || (Na__Cfg.edgeMargin < Na__Cfg.blackSize * Na__Defaults.NaMiniApp__EdgeMarginFactor);

    const Na__HasIdOverflow = (Na__Cfg.startId + Na__Tags.length - 1) > Na__Defaults.NaMiniApp__MaxAvailableTagId;

    // CL/CL schedule shown in the sidebar
    // ------------------------------------
    const Na__Measurements = [
        { title: "Horizontal Full Span (Top Corners)",       pair: `Tag #${Na__Tl.id} ↔ Tag #${Na__Tr.id}`, mm: Na__SpanX },
        { title: "Horizontal Full Span (Bottom Corners)",    pair: `Tag #${Na__Bl.id} ↔ Tag #${Na__Br.id}`, mm: Na__SpanX },
        { title: "Vertical Full Span (Left Corners)",        pair: `Tag #${Na__Tl.id} ↔ Tag #${Na__Bl.id}`, mm: Na__SpanY },
        { title: "Vertical Full Span (Right Corners)",       pair: `Tag #${Na__Tr.id} ↔ Tag #${Na__Br.id}`, mm: Na__SpanY },
        { title: "Primary Diagonal CL/CL (TL to BR)",        pair: `Tag #${Na__Tl.id} ↔ Tag #${Na__Br.id}`, mm: Na__DiagDist },
        { title: "Secondary Diagonal CL/CL (BL to TR)",      pair: `Tag #${Na__Bl.id} ↔ Tag #${Na__Tr.id}`, mm: Na__DiagDist },
        { title: "Adjacent Horizontal Pitch (Top/Bottom)",   pair: `Tag #${Na__Tl.id} ↔ Tag #${Na__Tags[1].id}`, mm: Na__StepX },
        { title: "Adjacent Vertical Pitch (Left/Right)",     pair: `Tag #${Na__Tr.id} ↔ Tag #${Na__Tags[Na__Cfg.cols].id}`, mm: Na__StepY },
        { title: "Single Marker Outer Black Edge",           pair: "Any Tag Outer Width",                   mm: Na__Cfg.blackSize }
    ];

    return {
        tags            : Na__Tags,
        tl              : Na__Tl,
        tr              : Na__Tr,
        br              : Na__Br,
        bl              : Na__Bl,
        spanX           : Na__SpanX,
        spanY           : Na__SpanY,
        stepX           : Na__StepX,
        stepY           : Na__StepY,
        diagDist        : Na__DiagDist,
        hasOverlap      : Na__HasOverlap,
        hasIdOverflow   : Na__HasIdOverflow,
        measurements    : Na__Measurements
    };
}
// ------------------------------------------------------------


// FUNCTION | Decide where the shared overlays sit, or null where they do not fit
// Used by both the SVG preview and the PDF export so they always agree.
// ------------------------------------------------------------
export function Na__AprilTagScaleMat__GetOverlayPlacement(Na__Settings, Na__Layout) {
    const Na__Cfg     = Na__Settings;
    const Na__CenterX = Na__Cfg.sheetW / 2;
    const Na__CenterY = Na__Cfg.sheetH / 2;
    const Na__InnerW  = Na__Layout.spanX - Na__Cfg.blackSize * 1.65;
    const Na__InnerH  = Na__Layout.spanY - Na__Cfg.blackSize * 1.65;

    // Turntable grid
    // ------------------------------------
    const Na__Turntable = (Na__Cfg.showTurntable && Na__InnerW > 40 && Na__InnerH > 40)
        ? { maxRadius: Math.min(Na__InnerW, Na__InnerH) * 0.44 }
        : null;

    // Calibration schedule plaque
    // ------------------------------------
    const Na__PlaqueW = Math.min(118, Math.max(76, Na__InnerW * 0.62));
    const Na__PlaqueH = 38;
    const Na__Plaque  = (Na__InnerW > 75 && Na__InnerH > 55)
        ? { px: Na__CenterX - Na__PlaqueW / 2, py: Na__CenterY - Na__PlaqueH / 2, w: Na__PlaqueW, h: Na__PlaqueH }
        : null;

    // 100 mm verification rule
    // ------------------------------------
    let Na__ScaleBar = null;
    if (Na__Cfg.showScaleBar && Na__InnerW >= 112) {
        const Na__BarW = 100;
        const Na__BarY = Na__Cfg.sheetH - Na__Cfg.edgeMargin - Na__Cfg.blackSize * 0.65 - 12;
        if (Na__BarY > Na__CenterY + 24) {
            Na__ScaleBar = { barX: Na__CenterX - Na__BarW / 2, barY: Na__BarY, barW: Na__BarW };
        }
    }

    return {
        centerX   : Na__CenterX,
        centerY   : Na__CenterY,
        innerW    : Na__InnerW,
        innerH    : Na__InnerH,
        turntable : Na__Turntable,
        plaque    : Na__Plaque,
        scaleBar  : Na__ScaleBar
    };
}
// ------------------------------------------------------------


// FUNCTION | Format a millimetre distance for the chosen unit mode
// ------------------------------------------------------------
export function Na__AprilTagScaleMat__FormatDistance(Na__Mm, Na__UnitMode) {
    const Na__MmText = `${Na__Mm.toFixed(2)} mm`;
    const Na__MText  = `${(Na__Mm / 1000).toFixed(5)} m`;

    if (Na__UnitMode === "mm") return Na__MmText;
    if (Na__UnitMode === "m")  return Na__MText;
    return `${Na__MmText} (${Na__MText})`;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
