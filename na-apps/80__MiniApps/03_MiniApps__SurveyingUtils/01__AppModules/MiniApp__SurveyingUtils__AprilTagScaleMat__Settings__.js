// =============================================================================
// NOBLE ARCHITECTURE - APRILTAG SCALE MAT - SETTINGS
// =============================================================================
//
// FILE    : MiniApp__SurveyingUtils__AprilTagScaleMat__Settings__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Read the sidebar form into one validated settings object
// CREATED : 20-Oct-2026
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Exports
// -----------------------------------------------------------------------------

// FUNCTION | Read and clamp every sidebar control into a settings object
// ------------------------------------------------------------
export function Na__AprilTagScaleMat__ReadSettings(Na__AppConfig) {
    const Na__Defaults   = Na__AppConfig.NaMiniApp__Defaults;
    const Na__PaperSizes = Na__AppConfig.NaMiniApp__PaperSizes;
    const Na__ById       = (Na__Id) => document.getElementById(Na__Id);

    const Na__Preset      = Na__ById("js__paperPreset").value;
    const Na__Orientation = Na__ById("js__orientation").value;

    // Sheet size in mm
    // ------------------------------------
    let Na__SheetW = 0;
    let Na__SheetH = 0;

    if (Na__Preset === "CUSTOM") {
        Na__SheetW = parseFloat(Na__ById("js__customW").value) || Na__Defaults.NaMiniApp__FallbackCustomWidthMm;
        Na__SheetH = parseFloat(Na__ById("js__customH").value) || Na__Defaults.NaMiniApp__FallbackCustomHeightMm;
    } else {
        const Na__Paper = Na__PaperSizes[Na__Preset];
        const Na__Long  = Math.max(Na__Paper.NaMiniApp__WidthMm, Na__Paper.NaMiniApp__HeightMm);
        const Na__Short = Math.min(Na__Paper.NaMiniApp__WidthMm, Na__Paper.NaMiniApp__HeightMm);
        Na__SheetW = Na__Orientation === "landscape" ? Na__Long  : Na__Short;
        Na__SheetH = Na__Orientation === "landscape" ? Na__Short : Na__Long;
    }

    // Tag set-out
    // ------------------------------------
    const Na__ClampCount = (Na__Value, Na__Fallback) => Math.max(
        Na__Defaults.NaMiniApp__MinTagsPerSide,
        Math.min(Na__Defaults.NaMiniApp__MaxTagsPerSide, parseInt(Na__Value, 10) || Na__Fallback)
    );

    return {
        preset          : Na__Preset,
        orientation     : Na__Orientation,
        sheetW          : Na__SheetW,
        sheetH          : Na__SheetH,
        blackSize       : Math.max(Na__Defaults.NaMiniApp__MinBlackSizeMm,
                              parseFloat(Na__ById("js__blackSize").value)  || Na__Defaults.NaMiniApp__FallbackBlackSizeMm),
        edgeMargin      : Math.max(Na__Defaults.NaMiniApp__MinEdgeMarginMm,
                              parseFloat(Na__ById("js__edgeMargin").value) || Na__Defaults.NaMiniApp__FallbackEdgeMarginMm),
        cols            : Na__ClampCount(Na__ById("js__colsCount").value, Na__Defaults.NaMiniApp__FallbackCols),
        rows            : Na__ClampCount(Na__ById("js__rowsCount").value, Na__Defaults.NaMiniApp__FallbackRows),
        startId         : Math.max(0, Math.min(Na__Defaults.NaMiniApp__MaxStartId,
                              parseInt(Na__ById("js__startId").value, 10) || 0)),
        unitMode        : Na__ById("js__unitMode").value,
        showDimLines    : Na__ById("js__showDimLines").checked,
        showCrosshairs  : Na__ById("js__showCrosshairs").checked,
        showTurntable   : Na__ById("js__showTurntable").checked,
        showScaleBar    : Na__ById("js__showScaleBar").checked
    };
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
