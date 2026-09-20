// =============================================================================
// TRUEVISION3D - NORTH DIRECTION - CONFIG STATE
// =============================================================================
//
// FILE       : Na__North__ConfigState__.js
// NAMESPACE  : Na__NorthCfg
// MODULE     : North Direction - Config State
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Own the north direction config fetch and expose every tuned value
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - Fetches Na__North__AppConfig__.json exactly once and exposes the compass
//   wording, the pick feel, the gizmo's appearance and the Dev menu wording.
// - Distances are integer millimetres in the JSON by house rule. Getters that
//   feed Three.js return scene units; the suffix on each name says which.
// - EVERY VALUE HAS A BUILT-IN FALLBACK MATCHING THE SHIPPED JSON, and that
//   matters more here than in most config readers: the Layout Editor names
//   elevations through the compass words synchronously, on the first paint of
//   a sheet, which can come before this fetch has settled. The fallbacks are
//   what it reads until then, so a name never changes when the file arrives.
// - A sibling of Na__Elevation__ConfigState__ rather than a shared base, for
//   the reason given there.
// - Pure config. No DOM, no Three.js objects, no project data.
//
// INTEGRATION:
// - Na__North__DevMenu__Editor__ awaits Load() before it reveals its section.
// - Na__North__ProjectJson__Data__ reads the compass setup for FacingWord.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (19-Sep-2026)
// - ValeVision    : 1.0.0 ported 20-Sep-2026 as ValeVision3D v2.67.0, verbatim
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Math Utilities and the Compass's Own Fallbacks
    // ------------------------------------------------------------
    import { Na__Math__ConvertMmToUnits } from '../04__MathUtils/Na__Math__Units.js';
    import { Na__NorthMath__WORDS, Na__NorthMath__HALF_WIDTH_DEG } from './Na__North__Compass__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Config Location and Block Keys
    // ------------------------------------------------------------
    const Na__NorthCfg__ConfigUrl     = new URL('./Na__North__AppConfig__.json', import.meta.url);
    const Na__NorthCfg__COMPASS_BLOCK = 'NorthDirection__Compass__Config';
    const Na__NorthCfg__PICK_BLOCK    = 'NorthDirection__Pick__Config';
    const Na__NorthCfg__GIZMO_BLOCK   = 'NorthDirection__Gizmo__Config';
    const Na__NorthCfg__LABELS_BLOCK  = 'NorthDirection__Labels__Config';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Parsed Config and Fetch Promise
    // ------------------------------------------------------------
    let Na__NorthCfg__Config      = null;   // <-- Parsed JSON (null until the fetch settles)
    let Na__NorthCfg__LoadPromise = null;   // <-- In-flight fetch, so it happens exactly once
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Private Config Reading
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Read One Config Value With a Fallback
    // ------------------------------------------------------------
    function Na__NorthCfg__Val(blockKey, valueKey, fallback) {
        if (!Na__NorthCfg__Config) return fallback;
        const block = Na__NorthCfg__Config[blockKey];
        if (!block || typeof block !== 'object') return fallback;
        const value = block[valueKey];
        return (value === undefined || value === null) ? fallback : value;
    }
    function Na__NorthCfg__Num(blockKey, valueKey, fallback) {
        const value = Na__NorthCfg__Val(blockKey, valueKey, fallback);
        return Number.isFinite(value) ? value : fallback;
    }
    function Na__NorthCfg__Text(blockKey, valueKey, fallback) {
        const value = Na__NorthCfg__Val(blockKey, valueKey, fallback);
        return (typeof value === 'string' && value !== '') ? value : fallback;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fetch and Parse the Config File Once
    // ------------------------------------------------------------
    async function Na__NorthCfg__Fetch() {
        try {
            const response = await fetch(Na__NorthCfg__ConfigUrl);
            if (!response.ok) {
                console.warn('[TrueVision3D] North direction config fetch failed (' + response.status + ') - using built-in defaults.');
                return false;
            }
            Na__NorthCfg__Config = await response.json();
            return Na__NorthCfg__IsEnabled();
        } catch (error) {
            console.warn('[TrueVision3D] North direction config unreadable - using built-in defaults.', error);
            return false;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Loading and Feature Gate
// -----------------------------------------------------------------------------

    // FUNCTION | Load the Config Exactly Once
    // ------------------------------------------------------------
    // Resolves true when the file read and the system is switched on.
    // ------------------------------------------------------------
    function Na__NorthCfg__Load() {
        if (!Na__NorthCfg__LoadPromise) Na__NorthCfg__LoadPromise = Na__NorthCfg__Fetch();
        return Na__NorthCfg__LoadPromise;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the North Direction Tool Switched On?
    // ------------------------------------------------------------
    // The TOOL, not the data: a saved north is still read, and elevations are
    // still named by it, with the authoring section switched off.
    // ------------------------------------------------------------
    function Na__NorthCfg__IsEnabled() {
        if (!Na__NorthCfg__Config) return false;                                 // <-- No config means no authoring UI
        return Na__NorthCfg__Config.NorthDirection__Enabled === true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Setups
// -----------------------------------------------------------------------------

    // FUNCTION | How a Bearing Is Put Into Words
    // ------------------------------------------------------------
    // Returns { halfWidthDeg, decimals, words }. words always holds all eight
    // points: whatever the file leaves out is the plain English.
    // ------------------------------------------------------------
    function Na__NorthCfg__GetCompassSetup() {
        const listed = Na__NorthCfg__Val(Na__NorthCfg__COMPASS_BLOCK, 'NorthDirection__Compass__Words', null);
        const words  = Object.assign({}, Na__NorthMath__WORDS);
        if (listed && typeof listed === 'object') {
            Object.keys(words).forEach((key) => { if (typeof listed[key] === 'string' && listed[key].trim() !== '') words[key] = listed[key].trim(); });
        }
        return {
            halfWidthDeg : Math.max(0, Math.min(45, Na__NorthCfg__Num(Na__NorthCfg__COMPASS_BLOCK, 'NorthDirection__Compass__IntercardinalHalfWidthDeg', Na__NorthMath__HALF_WIDTH_DEG))),
            decimals     : Math.max(0, Math.min(3, Math.round(Na__NorthCfg__Num(Na__NorthCfg__COMPASS_BLOCK, 'NorthDirection__Compass__BearingDecimals', 1)))),
            words        : words
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | How Drawing the Compass Feels
    // ------------------------------------------------------------
    function Na__NorthCfg__GetPickSetup() {
        return {
            clickThresholdPx    : Math.max(0, Na__NorthCfg__Num(Na__NorthCfg__PICK_BLOCK, 'NorthDirection__Pick__ClickThresholdPx', 4)),
            cursor              : Na__NorthCfg__Text(Na__NorthCfg__PICK_BLOCK, 'NorthDirection__Pick__Cursor', 'crosshair'),
            aimRecomputeMs      : Math.max(0, Na__NorthCfg__Num(Na__NorthCfg__PICK_BLOCK, 'NorthDirection__Pick__AimRecomputeMs', 60)),
            snapStepDeg         : Math.max(0, Na__NorthCfg__Num(Na__NorthCfg__PICK_BLOCK, 'NorthDirection__Pick__SnapStepDeg', 5)),
            minAimDistanceUnits : Na__Math__ConvertMmToUnits(Math.max(1, Na__NorthCfg__Num(Na__NorthCfg__PICK_BLOCK, 'NorthDirection__Pick__MinAimDistanceMm', 100)))
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | What the Compass Looks Like in the 3D View
    // ------------------------------------------------------------
    function Na__NorthCfg__GetGizmoSetup() {
        const B = Na__NorthCfg__GIZMO_BLOCK;
        return {
            radiusFraction      : Math.max(0.01, Na__NorthCfg__Num(B, 'NorthDirection__Gizmo__RadiusFractionOfModel', 0.075)),
            minRadiusUnits      : Na__Math__ConvertMmToUnits(Math.max(1, Na__NorthCfg__Num(B, 'NorthDirection__Gizmo__MinRadiusMm', 375))),
            maxRadiusUnits      : Na__Math__ConvertMmToUnits(Math.max(1, Na__NorthCfg__Num(B, 'NorthDirection__Gizmo__MaxRadiusMm', 3000))),
            fallbackRadiusUnits : Na__Math__ConvertMmToUnits(Math.max(1, Na__NorthCfg__Num(B, 'NorthDirection__Gizmo__FallbackRadiusMm', 1000))),
            shownByDefault      : Na__NorthCfg__Val(B, 'NorthDirection__Gizmo__ShownByDefault', false) === true,
            liftUnits           : Na__Math__ConvertMmToUnits(Math.max(0, Na__NorthCfg__Num(B, 'NorthDirection__Gizmo__LiftMm', 40))),
            ringColour          : Na__NorthCfg__Text(B, 'NorthDirection__Gizmo__RingColour',   '#172b3a'),
            discColour          : Na__NorthCfg__Text(B, 'NorthDirection__Gizmo__DiscColour',   '#ffffff'),
            discOpacity         : Math.max(0, Math.min(1, Na__NorthCfg__Num(B, 'NorthDirection__Gizmo__DiscOpacity', 0.55))),
            northColour         : Na__NorthCfg__Text(B, 'NorthDirection__Gizmo__NorthColour',  '#d9534f'),
            southColour         : Na__NorthCfg__Text(B, 'NorthDirection__Gizmo__SouthColour',  '#9aa4ad'),
            letterColour        : Na__NorthCfg__Text(B, 'NorthDirection__Gizmo__LetterColour', '#d9534f'),
            aimingOpacity       : Math.max(0.05, Math.min(1, Na__NorthCfg__Num(B, 'NorthDirection__Gizmo__AimingOpacity', 0.6)))
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | A Label, With {tokens} Filled In
    // ------------------------------------------------------------
    // Only single-brace tokens are filled: a label may quote the {{Direction}}
    // placeholder a drawing title shows, and must not have it filled for it.
    // ------------------------------------------------------------
    function Na__NorthCfg__GetLabel(keySuffix, fallback) {
        return Na__NorthCfg__Text(Na__NorthCfg__LABELS_BLOCK, 'NorthDirection__Labels__' + keySuffix, fallback);
    }
    function Na__NorthCfg__FormatLabel(keySuffix, fallback, tokens) {
        let text = Na__NorthCfg__GetLabel(keySuffix, fallback);
        Object.keys(tokens || {}).forEach((name) => {
            text = text.replace(new RegExp('(^|[^{])\\{' + name + '\\}(?!\\})', 'g'), (match, before) => before + String(tokens[name]));
        });
        return text;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | North Direction Config API
    // ------------------------------------------------------------
    export {
        Na__NorthCfg__Load,
        Na__NorthCfg__IsEnabled,
        Na__NorthCfg__GetCompassSetup,
        Na__NorthCfg__GetPickSetup,
        Na__NorthCfg__GetGizmoSetup,
        Na__NorthCfg__GetLabel,
        Na__NorthCfg__FormatLabel
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
