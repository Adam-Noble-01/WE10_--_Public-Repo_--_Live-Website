// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - CONFIG STATE - SHEET SETUP
// =============================================================================
//
// FILE       : Na__LayoutEditor__ConfigState__SheetSetup__.js
// NAMESPACE  : Na__LeCfg
// MODULE     : Layout Editor - Config State - Sheet Setup
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Answer the setup blocks for the paper, its chrome, its viewports and what prints
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - The sheet: paper sizes, margins and orientation, the chrome style, the
//   title block and the drawing scales, with the fallbacks (mirroring the
//   shipped JSON) for the paper sizes, title block rows and scales.
// - Its viewports: the viewport setup and the style toggles a new viewport
//   starts with, the raster levels for their pictures and the enhance
//   whitecard pass.
// - What prints: sheet linework widths, printed line weights (PtToMm turns
//   points into paper millimetres) and the PDF setup.
// - TrueVision only: GetPlanDoorsSetup (doors on plan, elevation and section
//   viewports), GetModelSourceSetup (how many design phases stay loaded
//   off-scene for viewports) and the private PdfFontCuts (the Open Sans cuts
//   Download PDF embeds, read by GetPdfSetup; their fallback is in FALLBACKS).
//
// INTEGRATION:
// - Na__LayoutEditor__ConfigState__ re-exports every public getter here, so
//   callers keep importing Na__LayoutEditor__ConfigState__.js.
// - Reads the config through Val and Num from
//   Na__LayoutEditor__ConfigState__Readers__.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the ValeVision3D v2.47.0 split of the same module (same unit, same functions)
// - Parity        : verbatim (moved code)
// - Divergences   : GetPlanDoorsSetup, GetModelSourceSetup and PdfFontCuts
//                   (TrueVision only), the site plan scales, the PDF fonts,
//                   TrueVision's own defaults (style font, logo aspect, drawn
//                   by, PDF author, creator and jsPDF path) and one word in
//                   the raster comment.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__ConfigState__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config Readers
    // ------------------------------------------------------------
    import { Na__LeCfg__Val, Na__LeCfg__Num } from './Na__LayoutEditor__ConfigState__Readers__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Fallbacks (mirror the shipped JSON)
    // ------------------------------------------------------------
    const Na__LeCfg__FALLBACKS = Object.freeze({
        paperSizes : { A4 : { Label : 'A4', WidthMm : 297, HeightMm : 210 }, A3 : { Label : 'A3', WidthMm : 420, HeightMm : 297 },
                       A2 : { Label : 'A2', WidthMm : 594, HeightMm : 420 }, A1 : { Label : 'A1', WidthMm : 841, HeightMm : 594 } },
        rows       : [ { Key : 'Client', Label : 'Client', WidthMm : 30 }, { Key : 'SiteAddress', Label : 'Site Address', WidthMm : 50 },
                       { Key : 'Title', Label : 'Drawing Title', WidthMm : 40 }, { Key : 'DrawingNumber', Label : 'Drawing No.', WidthMm : 18 },
                       { Key : 'Revision', Label : 'Rev', WidthMm : 8 }, { Key : 'Scale', Label : 'Scale', WidthMm : 20 },
                       { Key : 'Date', Label : 'Date', WidthMm : 16 }, { Key : 'DrawnBy', Label : 'Drawn By', WidthMm : 20 } ],
        scales     : [ 20, 50, 100 ],
        pdfFonts   : [
            { Style : 'light',  Weight : 300, FileName : 'CommonFont-01__OpenSans__Light__.ttf' },
            { Style : 'normal', Weight : 400, FileName : 'CommonFont-01__OpenSans__Regular__.ttf' },
            { Style : 'bold',   Weight : 600, FileName : 'CommonFont-01__OpenSans__SemiBold__.ttf' }
        ]
    });
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Sheet Setup Blocks
// -----------------------------------------------------------------------------

    // FUNCTION | Get the Paper Setup
    // ------------------------------------------------------------
    function Na__LeCfg__GetSheetSetup() {
        const sizes = Na__LeCfg__Val('Sheet', 'PaperSizes', null);
        return {
            defaultPaperSize   : Na__LeCfg__Val('Sheet', 'DefaultPaperSize', 'A3'),
            defaultOrientation : Na__LeCfg__Val('Sheet', 'DefaultOrientation', 'landscape'),
            marginMm           : Na__LeCfg__Num('Sheet', 'MarginMm', 5),
            blockGapMm         : Na__LeCfg__Num('Sheet', 'BlockGapMm', 3),
            borderStrokeMm     : Na__LeCfg__Num('Sheet', 'BorderStrokeMm', 0.5),
            screenPixelsPerMm  : Na__LeCfg__Num('Sheet', 'ScreenPixelsPerMm', 3.2),
            defaultNameFormat  : Na__LeCfg__Val('Sheet', 'DefaultNameFormat', 'Drawing {index}'),
            paperSizes         : (sizes && typeof sizes === 'object') ? sizes : Na__LeCfg__FALLBACKS.paperSizes
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Sheet Style (chrome painting)
    // ------------------------------------------------------------
    function Na__LeCfg__GetStyleSetup() {
        return {
            fontFamily        : Na__LeCfg__Val('Style', 'FontFamily', "'Open Sans', Helvetica, Arial, sans-serif"),
            paperColour       : Na__LeCfg__Val('Style', 'PaperColour', '#ffffff'),
            inkColour         : Na__LeCfg__Val('Style', 'InkColour', '#172b3a'),
            frameLineColour   : Na__LeCfg__Val('Style', 'FrameLineColour', '#8a949c'),
            mutedTextColour   : Na__LeCfg__Val('Style', 'MutedTextColour', '#6c757d'),
            selectionColour   : Na__LeCfg__Val('Style', 'SelectionColour', '#336699'),
            frameStrokeMm     : Na__LeCfg__Num('Style', 'FrameStrokeMm', 0.25),
            frameLabelFontMm  : Na__LeCfg__Num('Style', 'FrameLabelFontMm', 2.4),
            frameLabelHeightMm: Na__LeCfg__Num('Style', 'FrameLabelHeightMm', 5),
            cellPaddingMm     : Na__LeCfg__Num('Style', 'CellPaddingMm', 1.9),

            frameLabelWeight    : Na__LeCfg__Val('Style', 'FrameLabelWeight', 'bold'),
            frameLabelTrackingMm: Na__LeCfg__Num('Style', 'FrameLabelTrackingMm', 0.16),
            frameLabelUppercase : Na__LeCfg__Val('Style', 'FrameLabelUppercase', true) !== false,
            titleLabelWeight    : Na__LeCfg__Val('Style', 'TitleLabelWeight', 'normal'),
            titleLabelTrackingMm: Na__LeCfg__Num('Style', 'TitleLabelTrackingMm', 0.05),
            titleLabelUppercase : Na__LeCfg__Val('Style', 'TitleLabelUppercase', true) !== false,
            titleValueWeight    : Na__LeCfg__Val('Style', 'TitleValueWeight', 'normal')
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Title Block Setup
    // ------------------------------------------------------------
    function Na__LeCfg__GetTitleBlockSetup() {
        const rows    = Na__LeCfg__Val('TitleBlock', 'Rows', null);
        const scans   = Na__LeCfg__Val('TitleBlock', 'ClassicScanAssets', null);
        const anchors = Na__LeCfg__Val('TitleBlock', 'ClassicFieldAnchors', null);
        return {
            defaultStyle        : Na__LeCfg__Val('TitleBlock', 'DefaultStyle', 'modern'),
            heightMm            : Na__LeCfg__Num('TitleBlock', 'HeightMm', 10),
            logoAssetPath       : Na__LeCfg__Val('TitleBlock', 'LogoAssetPath', '../assets__CommonApplicationAssets/AppLogo__ValeHeaderImage_ValeLogo_HorizontalFormat__.png'),
            logoCellWidthMm     : Na__LeCfg__Num('TitleBlock', 'LogoCellWidthMm', 34),
            logoWidthMm         : Na__LeCfg__Num('TitleBlock', 'LogoWidthMm', 33),
            logoMaxHeightMm     : Na__LeCfg__Num('TitleBlock', 'LogoMaxHeightMm', 5.5),
            logoAspect          : Na__LeCfg__Num('TitleBlock', 'LogoAspectWidthOverHeight', 4.096),
            logoPaddingVMm      : Na__LeCfg__Num('TitleBlock', 'LogoPaddingVMm', 1.8),
            logoPaddingHMm      : Na__LeCfg__Num('TitleBlock', 'LogoPaddingHMm', 2.5),
            fontSizeLabelMm     : Na__LeCfg__Num('TitleBlock', 'FontSizeLabelMm', 1.6),
            fontSizeValueMm     : Na__LeCfg__Num('TitleBlock', 'FontSizeValueMm', 2.2),
            fieldPaddingHMm     : Na__LeCfg__Num('TitleBlock', 'FieldPaddingHMm', 1.4),
            fieldPaddingTopMm   : Na__LeCfg__Num('TitleBlock', 'FieldPaddingTopMm', 2.4),
            fieldPaddingBottomMm: Na__LeCfg__Num('TitleBlock', 'FieldPaddingBottomMm', 0.8),
            labelOffsetTopMm    : Na__LeCfg__Num('TitleBlock', 'FieldLabelOffsetTopMm', 1.5),
            drawnByDefault      : Na__LeCfg__Val('TitleBlock', 'DrawnByDefault', 'Noble Architecture'),
            rows                : Array.isArray(rows) ? rows : Na__LeCfg__FALLBACKS.rows,
            classicScanAssets   : (scans && typeof scans === 'object') ? scans : {},
            classicFieldAnchors : (anchors && typeof anchors === 'object') ? anchors : {}
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Scale Setup (D27)
    // ------------------------------------------------------------
    function Na__LeCfg__GetScaleSetup() {
        const list = Na__LeCfg__Val('Scales', 'AvailableScaleDenominators', null);
        const sitePlanList = Na__LeCfg__Val('Scales', 'SitePlanScaleDenominators', null);   // <-- Site plan viewports: 1:500 and 1:1250 unless configured
        return {
            denominators : Array.isArray(list) && list.length ? list.slice().sort((a, b) => a - b) : Na__LeCfg__FALLBACKS.scales.slice(),
            defaultDenominator : Na__LeCfg__Num('Scales', 'DefaultScaleDenominator', 50),
            sitePlanDenominators       : Array.isArray(sitePlanList) && sitePlanList.length ? sitePlanList.slice().sort((a, b) => a - b) : [ 500, 1250 ],
            sitePlanDefaultDenominator : Na__LeCfg__Num('Scales', 'SitePlanDefaultScaleDenominator', 500),
            labelPrefix        : Na__LeCfg__Val('Scales', 'ScaleLabelPrefix', '1:'),
            notToScaleLabel    : Na__LeCfg__Val('Scales', 'NotToScaleLabel', 'NTS')
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Viewport Setup
    // ------------------------------------------------------------
    function Na__LeCfg__GetViewportSetup() {
        return {
            defaultWidthMm       : Na__LeCfg__Num('Viewport', 'DefaultWidthMm', 180),
            defaultHeightMm      : Na__LeCfg__Num('Viewport', 'DefaultHeightMm', 120),
            minSizeMm            : Na__LeCfg__Num('Viewport', 'MinSizeMm', 20),
            handleSizePx         : Na__LeCfg__Num('Viewport', 'HandleSizePx', 9),
            handleHitRadiusPx    : Na__LeCfg__Num('Viewport', 'HandleHitRadiusPx', 10),
            showScaleLabel       : Na__LeCfg__Val('Viewport', 'ShowScaleLabel', true) !== false,
            defaultStyles        : Na__LeCfg__DefaultStyles(Na__LeCfg__Val('Viewport', 'DefaultStyles', null)),
            assetFolder          : Na__LeCfg__Val('Viewport', 'AssetFolder', 'LayoutEditor/Snapshots'),
            imageZoomMin         : Math.min(1, Math.max(0.01, Na__LeCfg__Num('Viewport', 'ImageZoomMin', 0.25))),   // <-- A 3D picture's zoom limits: never past 100 percent the wrong way
            imageZoomMax         : Math.max(1, Na__LeCfg__Num('Viewport', 'ImageZoomMax', 10)),
            imageZoomFineFactor  : Math.max(0.01, Na__LeCfg__Num('Viewport', 'ImageZoomFineFactor', 0.2)),
            imageZoomCommitMs    : Math.max(0, Na__LeCfg__Num('Viewport', 'ImageZoomCommitMs', 350))
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Style Toggles a New Viewport Starts With
    // ------------------------------------------------------------
    // Projected linework off by default: laying out a sheet must never cost
    // a projection; it is switched on per viewport once the layout settles.
    // ------------------------------------------------------------
    function Na__LeCfg__DefaultStyles(block) {
        const b = (block && typeof block === 'object') ? block : {};
        const flag = (key, fallback) => (typeof b[key] === 'boolean' ? b[key] : fallback);
        return {
            baseImage         : flag('BaseImage',         true),
            projectedLinework : flag('ProjectedLinework', false),
            profileLinework   : flag('ProfileLinework',   false),
            glassOpaque       : flag('GlassOpaque',       true),
            whitecard         : flag('Whitecard',         true),
            hiddenLines       : flag('HiddenLines',       false),
            enhanceWhitecard  : flag('EnhanceWhitecard',  true),
            contextLayer      : flag('ContextLayer',      true)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Raster Levels for the Viewport Pictures
    // ------------------------------------------------------------
    function Na__LeCfg__GetRasterSetup() {
        const block = Na__LeCfg__Val('Raster', 'Levels', null);
        const level = (name, ppm, maxPx, samples) => {
            const spec = (block && typeof block === 'object' && block[name] && typeof block[name] === 'object') ? block[name] : {};
            return {
                pixelsPerMm      : Number.isFinite(spec.PixelsPerMm) && spec.PixelsPerMm > 0 ? spec.PixelsPerMm : ppm,
                maxPixels        : Number.isFinite(spec.MaxPixels)   && spec.MaxPixels   > 0 ? spec.MaxPixels   : maxPx,
                // A record written before supersampling existed has no key here,
                // so the fallback is the level's intended count rather than 1.
                // Falling back to 1 would quietly leave every project on the old
                // aliased picture and look like the feature had not shipped.
                antiAliasSamples : Number.isFinite(spec.AntiAliasSamples) && spec.AntiAliasSamples > 0 ? spec.AntiAliasSamples : samples
            };
        };
        return {
            defaultLevel : Na__LeCfg__Val('Raster', 'DefaultLevel', 'medium'),
            exportLevel  : Na__LeCfg__Val('Raster', 'ExportLevel', 'high'),
            scaleWithDpr : Na__LeCfg__Val('Raster', 'ScaleWithDevicePixelRatio', true) !== false,
            levels       : {
                low    : level('low',     4, 2048,  1),
                medium : level('medium',  8, 4096,  4),
                high   : level('high',   12, 6144, 16)
            }
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Points to Paper Millimetres (1 pt = 1/72 inch)
    // ------------------------------------------------------------
    function Na__LeCfg__PtToMm(pt) { return (Number.isFinite(pt) ? pt : 0) * 25.4 / 72; }
    // ------------------------------------------------------------


    // FUNCTION | Doors on Plan, Elevation and Section Viewports
    // ------------------------------------------------------------
    function Na__LeCfg__GetPlanDoorsSetup() {
        return {
            openOnPlans      : Na__LeCfg__Val('PlanDoors', 'OpenOnPlans', true) !== false,
            shutOnElevations : Na__LeCfg__Val('PlanDoors', 'ShutOnElevations', true) !== false,
            drawSwings       : Na__LeCfg__Val('PlanDoors', 'DrawSwings', true) !== false,
            swingStepDegrees : Math.min(45, Math.max(1, Na__LeCfg__Num('PlanDoors', 'SwingStepDegrees', 5))),
            clickToToggle    : Na__LeCfg__Val('PlanDoors', 'ClickToToggle', true) !== false,
            clickDelayMs     : Math.max(0, Na__LeCfg__Num('PlanDoors', 'ClickDelayMs', 300))
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Printed Line Weights in Points
    // ------------------------------------------------------------
    function Na__LeCfg__GetLineweightSetup() {
        return {
            viewportPt  : Na__LeCfg__Num('Lineweights', 'ViewportPt', 0.30),
            dimensionPt : Na__LeCfg__Num('Lineweights', 'DimensionPt', 0.35),
            minPt       : Na__LeCfg__Num('Lineweights', 'MinPt', 0.05),
            maxPt       : Na__LeCfg__Num('Lineweights', 'MaxPt', 3),
            stepPt      : Na__LeCfg__Num('Lineweights', 'StepPt', 0.05)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Enhance Whitecard Pass Parameters
    // ------------------------------------------------------------
    function Na__LeCfg__GetEnhanceSetup() {
        return {
            levelsBlack      : Na__LeCfg__Num('Enhance', 'LevelsBlack', 0),
            levelsWhite      : Na__LeCfg__Num('Enhance', 'LevelsWhite', 205),
            levelsGamma      : Na__LeCfg__Num('Enhance', 'LevelsGamma', 1.0),
            sharpenEnabled   : Na__LeCfg__Val('Enhance', 'SharpenEnabled', true) !== false,
            sharpenRadius    : Na__LeCfg__Num('Enhance', 'SharpenRadius', 2.0),
            sharpenBlendMode : Na__LeCfg__Val('Enhance', 'SharpenBlendMode', 'Overlay'),
            sharpenOpacity   : Na__LeCfg__Num('Enhance', 'SharpenOpacity', 1.0)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Model Source Setup (which design phase a viewport draws)
    // ------------------------------------------------------------
    // maxCachedPhases is how many design phases besides the one in the 3D view
    // stay loaded off-scene for drawings; beyond it the least recently drawn is
    // let go. Never under one, or a sheet of an existing and a proposed view
    // would reload a model for every other viewport it drew.
    // ------------------------------------------------------------
    function Na__LeCfg__GetModelSourceSetup() {
        return {
            maxCachedPhases : Math.max(1, Math.round(Na__LeCfg__Num('ModelSource', 'MaxCachedPhases', 3)))
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Sheet Linework Widths (paper millimetres)
    // ------------------------------------------------------------
    function Na__LeCfg__GetLineworkSetup() {
        return {
            visibleWidthMm    : Na__LeCfg__Num('Linework', 'VisibleWidthMm', 0.25),
            hiddenWidthMm     : Na__LeCfg__Num('Linework', 'HiddenWidthMm', 0.18),
            hiddenDashMm      : Na__LeCfg__Num('Linework', 'HiddenDashMm', 1.2),
            authoredWidthMm   : Na__LeCfg__Num('Linework', 'AuthoredWidthMm', 0.2),
            sectionWidthMm    : Na__LeCfg__Num('Linework', 'SectionWidthMm', 0.5),
            minSegmentPaperMm : Na__LeCfg__Num('Linework', 'MinSegmentPaperMm', 0.05)
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Open Sans Cuts Download PDF Embeds
    // ------------------------------------------------------------
    function Na__LeCfg__PdfFontCuts() {
        const raw    = Na__LeCfg__Val('Pdf', 'Fonts', null);
        const source = Array.isArray(raw) && raw.length ? raw : Na__LeCfg__FALLBACKS.pdfFonts;
        const cuts   = [];
        source.forEach((cut) => {
            if (!cut || typeof cut !== 'object') return;
            const fileName = cut.FileName || cut.fileName;
            if (!fileName) return;
            const style  = String(cut.Style || cut.style || 'normal');
            const weight = (typeof cut.Weight === 'number' && Number.isFinite(cut.Weight)) ? cut.Weight
                         : ((typeof cut.weight === 'number' && Number.isFinite(cut.weight)) ? cut.weight : 400);
            cuts.push({ style : style, weight : weight, fileName : String(fileName) });
        });
        return cuts;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the PDF Setup
    // ------------------------------------------------------------
    function Na__LeCfg__GetPdfSetup() {
        const fonts = Na__LeCfg__PdfFontCuts();
        return {
            filenamePattern   : Na__LeCfg__Val('Pdf', 'FilenamePattern', 'Na__{projectCode}__{sheetName}__{paperSize}.pdf'),
            author            : Na__LeCfg__Val('Pdf', 'Author', 'Noble Architecture Ltd'),
            creator           : Na__LeCfg__Val('Pdf', 'Creator', 'TrueVision3D Layout Editor'),
            jsPdfScriptPath   : Na__LeCfg__Val('Pdf', 'JsPdfScriptPath', './02__Src__AppModules/90__System__PageLayoutSystem/01__Dependencies__VersionLocked/jspdf.umd.js'),
            fontFamily        : Na__LeCfg__Val('Pdf', 'FontFamily', 'OpenSans'),
            fontBasePath      : Na__LeCfg__Val('Pdf', 'FontBasePath', '../01__Assets__NaApps__CommonAssets/NaApps__CommonFonts/'),
            fontCdnBase       : Na__LeCfg__Val('Pdf', 'FontCdnBase', 'https://www.noble-architecture.com/na-apps/01__Assets__NaApps__CommonAssets/NaApps__CommonFonts/'),
            fonts             : fonts.length ? fonts : Na__LeCfg__FALLBACKS.pdfFonts.map((cut) => ({ style : cut.Style, weight : cut.Weight, fileName : cut.FileName }))
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Config State Sheet Setup
    // ------------------------------------------------------------
    export {
        Na__LeCfg__GetSheetSetup,
        Na__LeCfg__GetStyleSetup,
        Na__LeCfg__GetTitleBlockSetup,
        Na__LeCfg__GetScaleSetup,
        Na__LeCfg__GetViewportSetup,
        Na__LeCfg__GetRasterSetup,
        Na__LeCfg__PtToMm,
        Na__LeCfg__GetPlanDoorsSetup,
        Na__LeCfg__GetLineweightSetup,
        Na__LeCfg__GetEnhanceSetup,
        Na__LeCfg__GetModelSourceSetup,
        Na__LeCfg__GetLineworkSetup,
        Na__LeCfg__GetPdfSetup
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
