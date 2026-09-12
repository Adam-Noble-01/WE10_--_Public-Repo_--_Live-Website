// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - RASTER QUALITY
// =============================================================================
//
// FILE       : Na__LayoutEditor__RasterQuality__.js
// NAMESPACE  : Na__LeRaster
// MODULE     : Layout Editor - Raster Quality
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : One global working resolution for the viewport pictures (Low, Medium, High) and the fixed export resolution the PDF always uses
// CREATED    : 10-Sep-2026
//
// DESCRIPTION:
// - The 2D underlay and the 3D snapshot are rendered at a number of pixels
//   per paper millimetre. The working level applies to every viewport on
//   every sheet, is remembered per browser, and starts at the configured
//   default (Medium). The PDF ignores it and renders at the export level
//   (High), as do the Dev bakes, so a stored snapshot asset is always the
//   export picture.
// - Each level carries its pixels per millimetre and a longest-side cap so
//   a large viewport cannot ask for a canvas the browser will refuse. The
//   working levels can scale with the device pixel ratio so a high-density
//   screen sees a sharp picture at the same nominal level.
//
// INTEGRATION:
// - Na__LayoutEditor__Viewport2d__ and __Viewport3d__ size their renders
//   through Working and Export; the toolbar sets the level; the mode
//   controller refreshes the frames when it changes.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__RasterQuality__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config
    // ------------------------------------------------------------
    import { Na__LeCfg__GetRasterSetup } from './Na__LayoutEditor__ConfigState__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Levels, Storage and Event
    // ------------------------------------------------------------
    const Na__LeRaster__LEVELS        = [ 'low', 'medium', 'high' ];
    const Na__LeRaster__STORAGE_KEY   = 'Na__LayoutEditor__RasterLevel';
    const Na__LeRaster__CHANGED_EVENT = 'na-layouteditor-raster-changed';
    const Na__LeRaster__MAX_DPR       = 2;         // <-- A 3x screen does not need a 3x picture
    const Na__LeRaster__MIN_PX        = 16;
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Working Level (null until first read)
    // ------------------------------------------------------------
    let Na__LeRaster__Level = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Level
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Valid Level Name or Null
    // ------------------------------------------------------------
    function Na__LeRaster__Valid(level) {
        return (typeof level === 'string' && Na__LeRaster__LEVELS.indexOf(level.toLowerCase()) !== -1) ? level.toLowerCase() : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Working Level: Remembered in This Browser, Else the Config Default
    // ------------------------------------------------------------
    function Na__LeRaster__Get() {
        if (Na__LeRaster__Level) return Na__LeRaster__Level;
        let stored = null;
        try { stored = Na__LeRaster__Valid(window.localStorage.getItem(Na__LeRaster__STORAGE_KEY)); } catch (e) { stored = null; }
        Na__LeRaster__Level = stored || Na__LeRaster__Valid(Na__LeCfg__GetRasterSetup().defaultLevel) || 'medium';
        return Na__LeRaster__Level;
    }
    // ------------------------------------------------------------


    // FUNCTION | Choose the Working Level (remembered, announced)
    // ------------------------------------------------------------
    function Na__LeRaster__Set(level) {
        const next = Na__LeRaster__Valid(level);
        if (!next) return Na__LeRaster__Get();
        if (next === Na__LeRaster__Get()) return next;
        Na__LeRaster__Level = next;
        try { window.localStorage.setItem(Na__LeRaster__STORAGE_KEY, next); } catch (e) { /* private mode: the session keeps it */ }
        window.dispatchEvent(new CustomEvent(Na__LeRaster__CHANGED_EVENT, { detail : { level : next } }));
        return next;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Profiles
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Numbers Behind a Level
    // ------------------------------------------------------------
    function Na__LeRaster__Profile(level, scaleWithDpr) {
        const setup = Na__LeCfg__GetRasterSetup();
        const spec  = setup.levels[level] || setup.levels.medium;
        const dpr   = scaleWithDpr && setup.scaleWithDpr ? Math.min(Na__LeRaster__MAX_DPR, Math.max(1, window.devicePixelRatio || 1)) : 1;
        return {
            level            : level,
            pixelsPerMm      : spec.pixelsPerMm * dpr,
            maxPixels        : spec.maxPixels,
            // NOT scaled by the device pixel ratio, and deliberately so. More
            // pixels give a staircase smaller steps; only more samples give it
            // fewer. A dense screen has already been paid for in pixelsPerMm
            // and has no reason to pay again in render passes.
            antiAliasSamples : spec.antiAliasSamples
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Profile for Working on Screen
    // ------------------------------------------------------------
    function Na__LeRaster__Working() { return Na__LeRaster__Profile(Na__LeRaster__Get(), true); }
    // ------------------------------------------------------------


    // FUNCTION | The Profile the PDF and the Bakes Use (never the working level)
    // ------------------------------------------------------------
    function Na__LeRaster__Export() {
        const level = Na__LeRaster__Valid(Na__LeCfg__GetRasterSetup().exportLevel) || 'high';
        return Na__LeRaster__Profile(level, false);
    }
    // ------------------------------------------------------------


    // FUNCTION | Pixel Size for a Paper Size Under a Profile (longest side capped)
    // ------------------------------------------------------------
    // The profile's sample count rides along in the result, because every
    // caller that wants a size wants the quality that goes with it and there is
    // no case for a picture rendered at one level's resolution and another's
    // anti-aliasing.
    // ------------------------------------------------------------
    function Na__LeRaster__Fit(widthMm, heightMm, profile) {
        let w = Math.max(0, widthMm) * profile.pixelsPerMm, h = Math.max(0, heightMm) * profile.pixelsPerMm;
        const longest = Math.max(w, h);
        if (longest > profile.maxPixels) { w *= profile.maxPixels / longest; h *= profile.maxPixels / longest; }
        return {
            w       : Math.max(Na__LeRaster__MIN_PX, Math.round(w)),
            h       : Math.max(Na__LeRaster__MIN_PX, Math.round(h)),
            samples : Number.isFinite(profile.antiAliasSamples) ? profile.antiAliasSamples : 1
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Raster Quality API
    // ------------------------------------------------------------
    export {
        Na__LeRaster__LEVELS,
        Na__LeRaster__CHANGED_EVENT,
        Na__LeRaster__Get,
        Na__LeRaster__Set,
        Na__LeRaster__Working,
        Na__LeRaster__Export,
        Na__LeRaster__Fit
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
