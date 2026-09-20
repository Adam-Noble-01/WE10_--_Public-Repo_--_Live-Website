// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - EDGE STYLES
// =============================================================================
//
// FILE       : Na__LayoutEditor__EdgeStyles__.js
// NAMESPACE  : Na__LeEdge
// MODULE     : Layout Editor - Edge Styles
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : What colour, what dash and what weight each model category draws at in one viewport
// CREATED    : 12-Sep-2026
//
// DESCRIPTION:
// - Owns Na__LayoutEditor__EdgeStyles__Config__.json: the edge colour aliases
//   (drawn from the SketchUp SSOT edge materials), the line type patterns, and
//   the bounds of a weight factor.
// - Owns the per-viewport record Viewport__ProjectedEdges, which stores ONLY the
//   categories a person has actually restyled, each written out in full.
// - Answers one question for the renderers: what does this category look like in
//   this viewport. Everything else - the class ratios, the sheet master weight,
//   the composite multiplier - belongs to the caller, because it is the caller
//   that knows which class it is about to paint.
//
// -----------------------------------------------------------------------------
//
// THE THREE LAYERS OF AN ANSWER, LIGHTEST TOUCH LAST
//
//   1  THE FALLBACK       Black, solid, full weight. What a category no config
//                         has heard of draws at - bold and obviously unstyled
//                         rather than invisible.
//   2  THE CONFIG         Na__LayoutEditor__ModelLayers__Config__.json, per
//                         category. This is what a newly drawn viewport uses and
//                         what every untouched viewport keeps using, so editing
//                         that file moves every drawing that never disagreed.
//   3  THE VIEWPORT       Viewport__ProjectedEdges, per category, written only
//                         when someone changed something.
//
// WHY THE RECORD IS VERBOSE ON PURPOSE. Model Layers stores dissent as a bare
// `false` because there is only one thing a visibility toggle can mean. An edge
// style has three values and a category key nobody can read at a glance, so the
// record carries the human label and all three values together. It costs a few
// hundred bytes in the rare viewport that has been curated, and it means a
// project file can be audited without cross-referencing two config files.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : n/a - authored in TrueVision3D
// - Back-port     : done - ValeVision3D v2.30.0 (13-Sep-2026). Module and config
//                   JSON verbatim below the header. ValeVision's model layer config
//                   has these rows under its own prefix, plus the coarse categories
//                   its older exports load.
// - Not yet back-ported: the site plan defaults and the accent colours (1.1.0).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 14-Sep-2026 - Version 1.1.0
// - Site plan categories (TrueVision__SitePlan__...) take their default style from
//   the site plan data: the export's colour as the palette alias of the same hex,
//   its line type, and its weight in millimetres as a factor on the configured
//   viewport lineweight. The palette gains red, green and blue, the SSOT's site
//   plan accents, and the weight ceiling rises to 6.00 so a 0.50 mm line prints true.
//
// 12-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Per-Category Defaults Live With the Layer Map
    // ------------------------------------------------------------
    // ONE-WAY ONLY. Model Layers knows nothing about this module; this module
    // reads its config. Pointing them at each other would be a cycle, and the
    // cycle would be for no gain: the layer map reports what its file says and
    // this module decides what that means.
    // ------------------------------------------------------------
    import { Na__LeModelLayers__EdgeDefault, Na__LeModelLayers__Ready, Na__LeModelLayers__IsLoaded } from './Na__LayoutEditor__ModelLayers__.js';
    import { Na__LeCfg__GetLineweightSetup, Na__LeCfg__PtToMm } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__SpStore__GetLayers } from '../../52__System__SitePlanData/Na__SitePlan__Store__.js';   // <-- Site plan layers carry their own default style
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Config Location and Record Field
    // ------------------------------------------------------------
    const Na__LeEdge__ConfigUrl = new URL('./Na__LayoutEditor__EdgeStyles__Config__.json', import.meta.url);
    const Na__LeEdge__FIELD     = 'Viewport__ProjectedEdges';
    const Na__LeEdge__CAT_FIELD = 'Edges__Categories';
    const Na__LeEdge__SITEPLAN_PREFIX = 'TrueVision__SitePlan__';               // <-- Site plan layer keys: their style comes with the data
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Fetched Config
    // ------------------------------------------------------------
    let Na__LeEdge__Config      = null;
    let Na__LeEdge__LoadPromise = null;
    // ------------------------------------------------------------

    // MODULE CONSTANTS | What Works Before the Fetch Lands, or Instead of It
    // ------------------------------------------------------------
    // A failed fetch must not empty the dropdowns or blank the drawing. These
    // are the four greys and the three line types a technical sheet cannot do
    // without, and the same weight bounds the config ships.
    // ------------------------------------------------------------
    const Na__LeEdge__FALLBACK_COLOURS = [
        { alias : 'black',      label : 'Black',      hex : '#000000' },
        { alias : 'soft-black', label : 'Soft Black', hex : '#333333' },
        { alias : 'dark-grey',  label : 'Dark Grey',  hex : '#666666' },
        { alias : 'mid-grey',   label : 'Mid Grey',   hex : '#999999' },
        { alias : 'light-grey', label : 'Light Grey', hex : '#D9D9D9' },
        { alias : 'red',        label : 'Red',        hex : '#E53935' },
        { alias : 'green',      label : 'Green',      hex : '#43A047' },
        { alias : 'blue',       label : 'Blue',       hex : '#1E88E5' }
    ];
    const Na__LeEdge__FALLBACK_TYPES = [
        { alias : 'solid',  label : 'Solid',  patternMm : [] },
        { alias : 'dashed', label : 'Dashed', patternMm : [ 2.5, 1.5 ] },
        { alias : 'centre', label : 'Centre', patternMm : [ 8.0, 2.0, 2.0, 2.0 ] }
    ];
    const Na__LeEdge__FALLBACK_WEIGHT  = { min : 0.10, max : 6.00, step : 0.05, decimals : 2, default : 1.00 };
    const Na__LeEdge__FALLBACK_CLASSES = [ 'visible', 'hidden', 'authored' ];
    const Na__LeEdge__FALLBACK_STYLE   = { weight : 1.00, colour : 'black', lineType : 'solid' };
    // ------------------------------------------------------------

    // MODULE VARIABLES | Lookups Built Once per Config Load
    // ------------------------------------------------------------
    let Na__LeEdge__ColourIndex = null;   // <-- alias -> { alias, label, hex }
    let Na__LeEdge__TypeIndex   = null;   // <-- alias -> { alias, label, patternMm }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Config
// -----------------------------------------------------------------------------

    // FUNCTION | Fetch the Palette Once
    // ------------------------------------------------------------
    // ASKS FOR THE LAYER MAP TOO. A category's default style lives in that file,
    // so "the edge styles are ready" means nothing until both have landed.
    // ------------------------------------------------------------
    function Na__LeEdge__Ready() {
        if (!Na__LeEdge__LoadPromise) {
            Na__LeEdge__LoadPromise = (async () => {
                await Na__LeModelLayers__Ready();
                try {
                    const response = await fetch(Na__LeEdge__ConfigUrl, { cache : 'no-store' });
                    if (!response.ok) {
                        console.warn('[TrueVision3D LayoutEditor] Edge style config fetch failed (' + response.status + ') - the built-in palette will be used.');
                        return null;
                    }
                    Na__LeEdge__Config = await response.json();
                    Na__LeEdge__BuildIndexes();
                } catch (error) {
                    console.warn('[TrueVision3D LayoutEditor] Edge style config unavailable - the built-in palette will be used.', error);
                }
                return Na__LeEdge__Config;
            })();
        }
        return Na__LeEdge__LoadPromise;
    }
    // ------------------------------------------------------------


    // FUNCTION | Whether the Real Config Is In Hand
    // ------------------------------------------------------------
    // THE PRUNER ASKS THIS BEFORE IT DROPS ANYTHING. Removing a stored style
    // because it matches the default is only safe when the real default is
    // known; doing it against the built-in fallback would delete a deliberate
    // "draw windows black" the moment it was saved.
    // ------------------------------------------------------------
    function Na__LeEdge__IsLoaded() {
        return Na__LeEdge__Config !== null && Na__LeModelLayers__IsLoaded();   // <-- The defaults come from the layer map, so both
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Index the Two Alias Lists for Lookup
    // ------------------------------------------------------------
    function Na__LeEdge__BuildIndexes() {
        Na__LeEdge__ColourIndex = new Map();
        Na__LeEdge__TypeIndex   = new Map();
        Na__LeEdge__Colours().forEach((entry)   => Na__LeEdge__ColourIndex.set(entry.alias, entry));
        Na__LeEdge__LineTypes().forEach((entry) => Na__LeEdge__TypeIndex.set(entry.alias, entry));
    }
    // ------------------------------------------------------------


    // FUNCTION | The Colour Swatches, Dark to Light
    // ------------------------------------------------------------
    function Na__LeEdge__Colours() {
        const list = Na__LeEdge__Config ? Na__LeEdge__Config['LayoutEditor__EdgeStyles__Colours'] : null;
        if (!Array.isArray(list) || list.length === 0) return Na__LeEdge__FALLBACK_COLOURS;
        return list.map((row) => ({
            alias : row['Colour__Alias'],
            label : row['Colour__Label'] || row['Colour__Alias'],
            hex   : row['Colour__Hex']   || '#000000',
            ssot  : row['Colour__SsotKey'] || null
        }));
    }
    // ------------------------------------------------------------


    // FUNCTION | The Line Types, Solid First
    // ------------------------------------------------------------
    function Na__LeEdge__LineTypes() {
        const list = Na__LeEdge__Config ? Na__LeEdge__Config['LayoutEditor__EdgeStyles__LineTypes'] : null;
        if (!Array.isArray(list) || list.length === 0) return Na__LeEdge__FALLBACK_TYPES;
        return list.map((row) => ({
            alias     : row['LineType__Alias'],
            label     : row['LineType__Label'] || row['LineType__Alias'],
            patternMm : Array.isArray(row['LineType__PatternMm']) ? row['LineType__PatternMm'] : []
        }));
    }
    // ------------------------------------------------------------


    // FUNCTION | The Bounds a Weight Factor Must Sit Inside
    // ------------------------------------------------------------
    function Na__LeEdge__WeightBounds() {
        const block = Na__LeEdge__Config ? Na__LeEdge__Config['LayoutEditor__EdgeStyles__Weight'] : null;
        if (!block) return Na__LeEdge__FALLBACK_WEIGHT;
        const num = (key, fallback) => (Number.isFinite(block[key]) ? block[key] : fallback);
        return {
            min      : num('Weight__Min',      Na__LeEdge__FALLBACK_WEIGHT.min),
            max      : num('Weight__Max',      Na__LeEdge__FALLBACK_WEIGHT.max),
            step     : num('Weight__Step',     Na__LeEdge__FALLBACK_WEIGHT.step),
            decimals : num('Weight__Decimals', Na__LeEdge__FALLBACK_WEIGHT.decimals),
            default  : num('Weight__Default',  Na__LeEdge__FALLBACK_WEIGHT.default)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Line Classes a Category Style Is Allowed to Restyle
    // ------------------------------------------------------------
    // The section class is deliberately outside this list: a section outline
    // reads as cut material whatever was cut. Adding 'section' to the config
    // changes that and no code cares.
    // ------------------------------------------------------------
    function Na__LeEdge__AppliesToClasses() {
        const block = Na__LeEdge__Config ? Na__LeEdge__Config['LayoutEditor__EdgeStyles__Classes'] : null;
        const list  = block ? block['Classes__AppliesToClasses'] : null;
        return Array.isArray(list) && list.length > 0 ? list : Na__LeEdge__FALLBACK_CLASSES;
    }
    // ------------------------------------------------------------


    // FUNCTION | Does 'solid' Mean 'Leave the Class Dash Alone'
    // ------------------------------------------------------------
    function Na__LeEdge__SolidMeansClassDefault() {
        const block = Na__LeEdge__Config ? Na__LeEdge__Config['LayoutEditor__EdgeStyles__Classes'] : null;
        return !block || block['Classes__SolidMeansClassDefault'] !== false;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Configured Fallback Style
    // ------------------------------------------------------------
    function Na__LeEdge__Fallback() {
        const block = Na__LeEdge__Config ? Na__LeEdge__Config['LayoutEditor__EdgeStyles__Fallback'] : null;
        if (!block) return Na__LeEdge__FALLBACK_STYLE;
        return {
            weight   : Number.isFinite(block['Fallback__WeightFactor']) ? block['Fallback__WeightFactor'] : Na__LeEdge__FALLBACK_STYLE.weight,
            colour   : block['Fallback__ColourAlias']   || Na__LeEdge__FALLBACK_STYLE.colour,
            lineType : block['Fallback__LineTypeAlias'] || Na__LeEdge__FALLBACK_STYLE.lineType
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Resolving an Alias
// -----------------------------------------------------------------------------

    // FUNCTION | The Hex Behind a Colour Alias
    // ------------------------------------------------------------
    function Na__LeEdge__Hex(alias) {
        if (!Na__LeEdge__ColourIndex) Na__LeEdge__BuildIndexes();
        const found = Na__LeEdge__ColourIndex.get(alias);
        if (found) return found.hex;
        const fallback = Na__LeEdge__ColourIndex.get(Na__LeEdge__Fallback().colour);
        return fallback ? fallback.hex : '#000000';
    }
    // ------------------------------------------------------------


    // FUNCTION | The Paper-Millimetre Dash Pattern Behind a Line Type Alias
    // ------------------------------------------------------------
    // An empty array means solid. The caller multiplies by the scale denominator
    // so a dash measures the same on the sheet at any scale.
    // ------------------------------------------------------------
    function Na__LeEdge__Pattern(alias) {
        if (!Na__LeEdge__TypeIndex) Na__LeEdge__BuildIndexes();
        const found = Na__LeEdge__TypeIndex.get(alias);
        return found ? found.patternMm : [];
    }
    // ------------------------------------------------------------


    // FUNCTION | Is This Alias a Real Colour / Line Type
    // ------------------------------------------------------------
    function Na__LeEdge__IsColour(alias) {
        if (!Na__LeEdge__ColourIndex) Na__LeEdge__BuildIndexes();
        return Na__LeEdge__ColourIndex.has(alias);
    }
    function Na__LeEdge__IsLineType(alias) {
        if (!Na__LeEdge__TypeIndex) Na__LeEdge__BuildIndexes();
        return Na__LeEdge__TypeIndex.has(alias);
    }
    // ------------------------------------------------------------


    // FUNCTION | Clamp a Weight Factor Into Its Configured Bounds
    // ------------------------------------------------------------
    function Na__LeEdge__ClampWeight(value) {
        const bounds = Na__LeEdge__WeightBounds();
        if (!Number.isFinite(value)) return bounds.default;
        const clamped = Math.min(bounds.max, Math.max(bounds.min, value));
        const factor  = Math.pow(10, bounds.decimals);
        return Math.round(clamped * factor) / factor;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Per-Viewport Record
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Palette Alias With This Hex (null When None)
    // ------------------------------------------------------------
    function Na__LeEdge__AliasForHex(hex) {
        if (typeof hex !== 'string') return null;
        const wanted = hex.trim().toUpperCase();
        const match  = Na__LeEdge__Colours().find((entry) => String(entry.hex).toUpperCase() === wanted);
        return match ? match.alias : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Site Plan Category's Default: the Style Its Export Carries
    // ------------------------------------------------------------
    // Site plan layers are not in the Model Layers config: their style travels
    // with the data, resolved from the SSOT at export. The weight in millimetres
    // becomes a factor on the configured viewport lineweight, so at that master a
    // 0.50 mm red line prints 0.50 mm, and a sheet that raises its master raises
    // the site plan with everything else. The colour is the palette alias of the
    // same hex. Null for any other key, and before the site plan data has loaded.
    // ------------------------------------------------------------
    function Na__LeEdge__SitePlanDefault(categoryKey) {
        if (typeof categoryKey !== 'string' || categoryKey.indexOf(Na__LeEdge__SITEPLAN_PREFIX) !== 0) return null;
        const layer = Na__SpStore__GetLayers().find((entry) => entry.Layer__CategoryKey === categoryKey);
        if (!layer) return null;
        const style  = layer.Layer__Style || {};
        const master = Na__LeCfg__PtToMm(Na__LeCfg__GetLineweightSetup().viewportPt);
        const fall   = Na__LeEdge__Fallback();
        return {
            weight    : (Number.isFinite(style.LineWeightMm) && master > 0) ? style.LineWeightMm / master : fall.weight,
            colour    : Na__LeEdge__AliasForHex(style.LineHex) || fall.colour,
            lineType  : Na__LeEdge__IsLineType(style.LineType) ? style.LineType : fall.lineType,
            // THE DASH SCALE IS A PROPERTY OF THE LAYER, not of the line type.
            // Adam, on the Proposed Alterations outline: 'the line could be
            // mistaken as a solid line in certain sections... I'm not talking
            // about the line thickness. I'm talking about the line dash space
            // scaling needs to be smaller.' A 2.5 mm dash with a 1.5 mm gap is
            // right on a 1:50 plan and closes up on a site plan, so the SSOT
            // gives that one tag a 0.5 and every other dashed line is untouched.
            dashScale : (Number.isFinite(style.LineDashScale) && style.LineDashScale > 0) ? style.LineDashScale : 1
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Config Default for One Category
    // ------------------------------------------------------------
    function Na__LeEdge__Default(categoryKey) {
        const sitePlan = Na__LeEdge__SitePlanDefault(categoryKey);
        if (sitePlan) return sitePlan;
        const fromMap = Na__LeModelLayers__EdgeDefault(categoryKey);
        const fall    = Na__LeEdge__Fallback();
        if (!fromMap) return { weight : fall.weight, colour : fall.colour, lineType : fall.lineType, dashScale : 1 };
        return {
            weight    : Number.isFinite(fromMap.weight) ? fromMap.weight : fall.weight,
            colour    : fromMap.colour   || fall.colour,
            lineType  : fromMap.lineType || fall.lineType,
            dashScale : 1                                                        // <-- Only a site plan layer carries one; a model category draws its line type as configured
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Stored Overrides Map, or null
    // ------------------------------------------------------------
    function Na__LeEdge__Stored(viewport) {
        const block = viewport ? viewport[Na__LeEdge__FIELD] : null;
        if (!block || typeof block !== 'object') return null;
        const map = block[Na__LeEdge__CAT_FIELD];
        return (map && typeof map === 'object') ? map : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | What One Category Actually Looks Like In One Viewport
    // ------------------------------------------------------------
    // Returns { weight, colour, lineType, hex, patternMm, overridden }.
    // ------------------------------------------------------------
    function Na__LeEdge__Effective(viewport, categoryKey) {
        const base   = Na__LeEdge__Default(categoryKey);
        const stored = Na__LeEdge__Stored(viewport);
        const entry  = stored ? stored[categoryKey] : null;

        let weight   = base.weight;
        let colour   = base.colour;
        let lineType = base.lineType;
        let touched  = false;

        if (entry && typeof entry === 'object') {
            if (Number.isFinite(entry['Category__EdgeWeightFactor'])) { weight   = entry['Category__EdgeWeightFactor']; touched = true; }
            if (typeof entry['Category__EdgeColour']   === 'string')  { colour   = entry['Category__EdgeColour'];       touched = true; }
            if (typeof entry['Category__EdgeLineType'] === 'string')  { lineType = entry['Category__EdgeLineType'];     touched = true; }
        }

        // THE DASH SCALE SURVIVES A RESTYLE. It belongs to the layer, so picking
        // a different line type by hand gives THAT type at this layer's dash
        // scale rather than quietly returning the drawing to full-size dashes.
        const scale   = Number.isFinite(base.dashScale) ? base.dashScale : 1;
        const pattern = Na__LeEdge__Pattern(lineType);
        return {
            weight     : Na__LeEdge__ClampWeight(weight),
            colour     : colour,
            lineType   : lineType,
            hex        : Na__LeEdge__Hex(colour),
            patternMm  : (scale === 1 || pattern.length === 0) ? pattern : pattern.map((mm) => mm * scale),
            overridden : touched
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Patch That Restyles One Category
    // ------------------------------------------------------------
    // The panel edits one control at a time; the record stores the whole style.
    // So a patch carries the effective values for all three, with the one that
    // changed replaced - which is what keeps a stored entry self-describing
    // rather than a scattering of single fields.
    //
    // part is 'weight' | 'colour' | 'lineType'.
    // ------------------------------------------------------------
    function Na__LeEdge__Patch(viewport, categoryKey, label, part, value) {
        const now = Na__LeEdge__Effective(viewport, categoryKey);
        const next = { weight : now.weight, colour : now.colour, lineType : now.lineType };
        if (part === 'weight')   next.weight   = Na__LeEdge__ClampWeight(parseFloat(value));
        if (part === 'colour')   next.colour   = String(value);
        if (part === 'lineType') next.lineType = String(value);

        const patch = {};
        patch[categoryKey] = {
            'Category__Label'            : label || categoryKey,
            'Category__EdgeWeightFactor' : next.weight,
            'Category__EdgeColour'       : next.colour,
            'Category__EdgeLineType'     : next.lineType
        };
        return patch;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Patch That Puts One Category Back to the Config Default
    // ------------------------------------------------------------
    // Null clears the entry. The record layer drops a null rather than storing
    // it, so resetting a category leaves no trace that it was ever touched.
    // ------------------------------------------------------------
    function Na__LeEdge__ResetPatch(categoryKey) {
        const patch = {};
        patch[categoryKey] = null;
        return patch;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Stable Token for Cache Keys
    // ------------------------------------------------------------
    // Empty when nothing is overridden, so a viewport nobody has curated keys
    // exactly as it did before the feature existed and its cached renders live.
    // ------------------------------------------------------------
    function Na__LeEdge__Token(viewport) {
        const stored = Na__LeEdge__Stored(viewport);
        if (!stored) return '';
        const keys = Object.keys(stored).sort();
        if (keys.length === 0) return '';
        return keys.map((key) => {
            const entry = stored[key] || {};
            return key + ':' + entry['Category__EdgeWeightFactor'] + ':' + entry['Category__EdgeColour'] + ':' + entry['Category__EdgeLineType'];
        }).join('|');
    }
    // ------------------------------------------------------------


    // FUNCTION | How Many Categories This Viewport Has Curated
    // ------------------------------------------------------------
    function Na__LeEdge__OverrideCount(viewport) {
        const stored = Na__LeEdge__Stored(viewport);
        return stored ? Object.keys(stored).length : 0;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Edge Styles API
    // ------------------------------------------------------------
    export {
        Na__LeEdge__FIELD,
        Na__LeEdge__CAT_FIELD,
        Na__LeEdge__Ready,
        Na__LeEdge__IsLoaded,
        Na__LeEdge__Colours,
        Na__LeEdge__LineTypes,
        Na__LeEdge__WeightBounds,
        Na__LeEdge__AppliesToClasses,
        Na__LeEdge__SolidMeansClassDefault,
        Na__LeEdge__Hex,
        Na__LeEdge__Pattern,
        Na__LeEdge__IsColour,
        Na__LeEdge__IsLineType,
        Na__LeEdge__ClampWeight,
        Na__LeEdge__Default,
        Na__LeEdge__Effective,
        Na__LeEdge__Patch,
        Na__LeEdge__ResetPatch,
        Na__LeEdge__Token,
        Na__LeEdge__OverrideCount
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
