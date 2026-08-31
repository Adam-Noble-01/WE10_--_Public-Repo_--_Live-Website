// =============================================================================
// TRUEVISION3D - SECTION CUT ENGINE - CONFIG AND APPEARANCE STATE
// =============================================================================
//
// FILE       : Na__SectionCut__ConfigState__.js
// NAMESPACE  : Na__SectCutCfg
// MODULE     : Section Cut Engine - Config and Appearance State
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Own the section cut config fetch, tuning values and live appearance
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - Fetches Na__SectionCut__Engine__AppConfig__.json exactly once and exposes
//   every tuning value the engine needs, already converted to Three.js units
//   where the config states millimetres.
// - Holds the live appearance (fill colour, line colour, line width) so the
//   Advanced dev controls can override it without the engine reaching back
//   into raw JSON.
// - Split out of the engine so that file stays inside the house 600-line
//   limit and so config reading is testable on its own. The dependency is
//   one-directional: the engine imports this, never the reverse.
// - Every value has a built-in fallback matching the shipped JSON, so a
//   failed fetch degrades to correct defaults rather than breaking cuts.
//
// INTEGRATION:
// - Na__SectionCut__Engine__ awaits Na__SectCutCfg__Load() at init and
//   registers a callback so it can repaint meshes built before the fetch
//   settled.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 31-Aug-2026 - Version 1.0.0
// - Initial implementation for the Floor Plan Builder.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Math Utilities
    // ------------------------------------------------------------
    // Config distances are integer millimetres by house rule; Three.js scene
    // units are metres, so every distance getter converts on the way out.
    // ------------------------------------------------------------
    import { Na__Math__ConvertMmToUnits } from '../04__MathUtils/Na__Math__Units.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Config Location
    // ------------------------------------------------------------
    const Na__SectCutCfg__ConfigUrl = new URL('./Na__SectionCut__Engine__AppConfig__.json', import.meta.url);
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Config Block Keys
    // ------------------------------------------------------------
    const Na__SectCutCfg__APPEARANCE_BLOCK = 'SectionCut__Appearance__Config';
    const Na__SectCutCfg__UPDATE_BLOCK     = 'SectionCut__Update__Config';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Fallback Values (mirror the shipped JSON exactly)
    // ------------------------------------------------------------
    const Na__SectCutCfg__FB_FillColor     = '#f0f0f0';   // <-- Cut fill (poche) colour
    const Na__SectCutCfg__FB_LineColor     = '#323232';   // <-- Profile outline colour
    const Na__SectCutCfg__FB_LineWidthPx   = 2.0;         // <-- Profile outline width in screen pixels
    const Na__SectCutCfg__FB_CapOffsetMm   = 0.6;         // <-- Fill nudge into the removed half-space
    const Na__SectCutCfg__FB_LineOffsetMm  = 1.4;         // <-- Outline sits just proud of the fill
    const Na__SectCutCfg__FB_WeldTolMm     = 0.25;        // <-- Endpoint weld grid
    const Na__SectCutCfg__FB_MinLoopAreaM2 = 0.0004;      // <-- Sliver loop rejection threshold
    const Na__SectCutCfg__FB_MaxSegments   = 250000;      // <-- Hard safety cap per recompute
    const Na__SectCutCfg__FB_ThrottleMs    = 90;          // <-- Cap rebuild throttle while a datum slider moves
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Parsed Config and Fetch Promise
    // ------------------------------------------------------------
    let Na__SectCutCfg__Config      = null;   // <-- Parsed JSON (null until the fetch settles)
    let Na__SectCutCfg__LoadPromise = null;   // <-- In-flight fetch, so it happens exactly once
    let Na__SectCutCfg__OnLoaded    = null;   // <-- Engine callback: repaint meshes built before config landed
    // ------------------------------------------------------------

    // MODULE VARIABLES | Live Appearance (config defaults, dev-overridable)
    // ------------------------------------------------------------
    let Na__SectCutCfg__FillColor   = Na__SectCutCfg__FB_FillColor;
    let Na__SectCutCfg__LineColor   = Na__SectCutCfg__FB_LineColor;
    let Na__SectCutCfg__LineWidthPx = Na__SectCutCfg__FB_LineWidthPx;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Private Config Reading
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Read One Config Value With a Fallback
    // ------------------------------------------------------------
    function Na__SectCutCfg__Val(blockKey, valueKey, fallback) {
        if (!Na__SectCutCfg__Config) return fallback;
        const block = Na__SectCutCfg__Config[blockKey];
        if (!block || typeof block !== 'object') return fallback;
        const value = block[valueKey];
        return (value === undefined || value === null) ? fallback : value;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fetch and Parse the Config File Once
    // ------------------------------------------------------------
    async function Na__SectCutCfg__Fetch() {
        try {
            const response = await fetch(Na__SectCutCfg__ConfigUrl);
            if (!response.ok) {
                console.warn('[TrueVision3D] Section cut config fetch failed (' + response.status + ') - using built-in defaults.');
                return false;
            }
            Na__SectCutCfg__Config = await response.json();

            Na__SectCutCfg__FillColor   = Na__SectCutCfg__Val(Na__SectCutCfg__APPEARANCE_BLOCK, 'SectionCut__Appearance__FillColor',   Na__SectCutCfg__FillColor);
            Na__SectCutCfg__LineColor   = Na__SectCutCfg__Val(Na__SectCutCfg__APPEARANCE_BLOCK, 'SectionCut__Appearance__LineColor',   Na__SectCutCfg__LineColor);
            Na__SectCutCfg__LineWidthPx = Na__SectCutCfg__Val(Na__SectCutCfg__APPEARANCE_BLOCK, 'SectionCut__Appearance__LineWidthPx', Na__SectCutCfg__LineWidthPx);

            if (typeof Na__SectCutCfg__OnLoaded === 'function') Na__SectCutCfg__OnLoaded();
            return true;
        } catch (error) {
            console.warn('[TrueVision3D] Section cut config unreadable - using built-in defaults.', error);
            return false;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Loading
// -----------------------------------------------------------------------------

    // FUNCTION | Load the Config Exactly Once
    // ------------------------------------------------------------
    function Na__SectCutCfg__Load(onLoaded) {
        if (typeof onLoaded === 'function') Na__SectCutCfg__OnLoaded = onLoaded;
        if (!Na__SectCutCfg__LoadPromise) Na__SectCutCfg__LoadPromise = Na__SectCutCfg__Fetch();
        return Na__SectCutCfg__LoadPromise;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the Engine Switched On in Config?
    // ------------------------------------------------------------
    function Na__SectCutCfg__IsEngineEnabled() {
        if (!Na__SectCutCfg__Config) return true;                                // <-- Default on; a failed fetch must not silently kill cuts
        return Na__SectCutCfg__Config.SectionCut__Engine__Enabled !== false;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Tuning Values in Scene Units
// -----------------------------------------------------------------------------

    // FUNCTION | Cap Fill Offset Off the Cut Plane
    // ------------------------------------------------------------
    function Na__SectCutCfg__CapOffsetUnits() {
        return Na__Math__ConvertMmToUnits(
            Na__SectCutCfg__Val(Na__SectCutCfg__APPEARANCE_BLOCK, 'SectionCut__Appearance__CapOffsetMm', Na__SectCutCfg__FB_CapOffsetMm)
        );
    }
    // ------------------------------------------------------------


    // FUNCTION | Profile Outline Offset Off the Cut Plane
    // ------------------------------------------------------------
    function Na__SectCutCfg__LineOffsetUnits() {
        return Na__Math__ConvertMmToUnits(
            Na__SectCutCfg__Val(Na__SectCutCfg__APPEARANCE_BLOCK, 'SectionCut__Appearance__LineOffsetMm', Na__SectCutCfg__FB_LineOffsetMm)
        );
    }
    // ------------------------------------------------------------


    // FUNCTION | Geometry Weld Tolerance
    // ------------------------------------------------------------
    function Na__SectCutCfg__WeldTolUnits() {
        return Na__Math__ConvertMmToUnits(
            Na__SectCutCfg__Val(Na__SectCutCfg__UPDATE_BLOCK, 'SectionCut__Update__WeldToleranceMm', Na__SectCutCfg__FB_WeldTolMm)
        );
    }
    // ------------------------------------------------------------


    // FUNCTION | Minimum Retained Loop Area
    // ------------------------------------------------------------
    function Na__SectCutCfg__MinLoopArea() {
        return Na__SectCutCfg__Val(Na__SectCutCfg__UPDATE_BLOCK, 'SectionCut__Update__MinLoopAreaM2', Na__SectCutCfg__FB_MinLoopAreaM2);
    }
    // ------------------------------------------------------------


    // FUNCTION | Maximum Crossing Segments Per Recompute
    // ------------------------------------------------------------
    function Na__SectCutCfg__MaxSegments() {
        return Na__SectCutCfg__Val(Na__SectCutCfg__UPDATE_BLOCK, 'SectionCut__Update__MaxCrossingSegments', Na__SectCutCfg__FB_MaxSegments);
    }
    // ------------------------------------------------------------


    // FUNCTION | Cap Rebuild Throttle While a Slider Is Dragged
    // ------------------------------------------------------------
    function Na__SectCutCfg__DragThrottleMs() {
        return Na__SectCutCfg__Val(Na__SectCutCfg__UPDATE_BLOCK, 'SectionCut__Update__DragRecomputeMs', Na__SectCutCfg__FB_ThrottleMs);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Live Appearance
// -----------------------------------------------------------------------------

    // FUNCTION | Get the Current Cut Appearance
    // ------------------------------------------------------------
    function Na__SectCutCfg__GetAppearance() {
        return {
            fillColor   : Na__SectCutCfg__FillColor,
            lineColor   : Na__SectCutCfg__LineColor,
            lineWidthPx : Na__SectCutCfg__LineWidthPx
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Override the Cut Appearance Live
    // ------------------------------------------------------------
    // Returns true when something actually changed, so the caller only pays
    // for a mesh repaint when there is one to do.
    // ------------------------------------------------------------
    function Na__SectCutCfg__SetAppearance(appearance) {
        if (!appearance || typeof appearance !== 'object') return false;
        let changed = false;

        if (typeof appearance.fillColor === 'string' && appearance.fillColor !== Na__SectCutCfg__FillColor) {
            Na__SectCutCfg__FillColor = appearance.fillColor;
            changed = true;
        }
        if (typeof appearance.lineColor === 'string' && appearance.lineColor !== Na__SectCutCfg__LineColor) {
            Na__SectCutCfg__LineColor = appearance.lineColor;
            changed = true;
        }
        if (Number.isFinite(appearance.lineWidthPx) && appearance.lineWidthPx !== Na__SectCutCfg__LineWidthPx) {
            Na__SectCutCfg__LineWidthPx = appearance.lineWidthPx;
            changed = true;
        }
        return changed;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Section Cut Config State API
    // ------------------------------------------------------------
    export {
        Na__SectCutCfg__Load,
        Na__SectCutCfg__IsEngineEnabled,
        Na__SectCutCfg__CapOffsetUnits,
        Na__SectCutCfg__LineOffsetUnits,
        Na__SectCutCfg__WeldTolUnits,
        Na__SectCutCfg__MinLoopArea,
        Na__SectCutCfg__MaxSegments,
        Na__SectCutCfg__DragThrottleMs,
        Na__SectCutCfg__GetAppearance,
        Na__SectCutCfg__SetAppearance
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
