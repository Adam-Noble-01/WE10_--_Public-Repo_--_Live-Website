// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - MODEL LAYERS
// =============================================================================
//
// FILE       : Na__LayoutEditor__ModelLayers__.js
// NAMESPACE  : Na__LeModelLayers
// MODULE     : Layout Editor - Model Layers
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Which model categories a single viewport is allowed to see, and what those categories are called
// CREATED    : 12-Sep-2026
//
// DESCRIPTION:
// - Owns Na__LayoutEditor__ModelLayers__Config__.json, which pairs a Noble
//   Architecture SketchUp tag name from the SSOT with the runtime category
//   the GLB loads into and with the short label a person reads.
// - Lists the categories the model ACTUALLY loaded, in the config's order,
//   under the config's group headings. A category the config has never heard
//   of still appears, under an auto-generated label, so a new tag range shows
//   up as soon as it is exported rather than going quietly missing.
// - Answers three questions for the rest of the editor: what should the panel
//   draw, which categories has this viewport switched off, and what token
//   should the linework projection exclude for it.
//
// INTEGRATION:
// - The panel reads Groups(); the snapshot renderer reads HiddenKeys() to take
//   categories out of the raster; Viewport2d reads ExcludeTokens() to take them
//   out of the projected vectors; both read Token() for their cache keys.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : n/a - authored in TrueVision3D
// - Back-port     : done - ValeVision3D v2.30.0 (13-Sep-2026). The module ported
//                   whole; ValeVision's config has these rows and styles under its
//                   own prefix, plus the coarse categories its older exports load.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.4.0
// - Group__AlwaysShow. A group whose rows are never a real loaded model
//   category (the linework-modifiers group - see Na__DataLib__CoreIndex__Tags
//   76-79) now lists its rows regardless, instead of being silently dropped
//   by the "model did not load it" check every other group still gets.
//
// 14-Sep-2026 - Version 1.3.0
// - Site plan layers. Groups lists a site plan viewport's layers under their
//   export's own groups and labels, in draw order, ahead of any model groups.
//
// 13-Sep-2026 - Version 1.2.0
// - Groups takes an optional category key list, for a viewport drawing a
//   design phase other than the one the 3D view holds.
//
// 12-Sep-2026 - Version 1.1.0
// - The config gained a per-category edge style (weight factor, colour alias,
//   line type alias) and this module indexes it. EdgeDefault(categoryKey) is
//   what a newly drawn viewport starts from; Na__LayoutEditor__EdgeStyles__.js
//   layers the per-viewport overrides on top of it.
//
// 12-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Loaded Model Categories
    // ------------------------------------------------------------
    import { Na__ModelToggle__GetCategoryKeys } from '../../26__System__ToggleModelElements/Na__UiFeature__ModelToggle__Controls.js';
    import { Na__SpStore__GetLayers } from '../../52__System__SitePlanData/Na__SitePlan__Store__.js';   // <-- A site plan viewport's layers and their names
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Config Location and Record Field
    // ------------------------------------------------------------
    const Na__LeModelLayers__ConfigUrl = new URL('./Na__LayoutEditor__ModelLayers__Config__.json', import.meta.url);
    const Na__LeModelLayers__FIELD     = 'Viewport__ModelLayers';
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Fetched Config
    // ------------------------------------------------------------
    let Na__LeModelLayers__Config      = null;
    let Na__LeModelLayers__LoadPromise = null;
    // ------------------------------------------------------------

    // MODULE VARIABLES | Category Key to Its Configured Edge Style
    // ------------------------------------------------------------
    // Built once when the config lands. The renderers ask this per CATEGORY per
    // paint, which on a busy sheet is thousands of times a second, so it is a
    // Map rather than a walk of five groups looking for a key.
    // ------------------------------------------------------------
    let Na__LeModelLayers__EdgeIndex   = null;   // <-- categoryKey -> { weight, colour, lineType }
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Fallbacks Used Before the Fetch Lands, or Instead of It
    // ------------------------------------------------------------
    // A failed fetch must not empty the panel: without wording the categories
    // still list under auto-generated labels, which is worse-looking and fully
    // working, rather than better-looking and blank.
    // ------------------------------------------------------------
    const Na__LeModelLayers__FALLBACK = {
        groupLabel    : 'Other',
        stripPrefix   : 'TrueVision__',
        splitOnDouble : ' - '
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Config
// -----------------------------------------------------------------------------

    // FUNCTION | Fetch the Mapping Once
    // ------------------------------------------------------------
    function Na__LeModelLayers__Ready() {
        if (!Na__LeModelLayers__LoadPromise) {
            Na__LeModelLayers__LoadPromise = (async () => {
                try {
                    const response = await fetch(Na__LeModelLayers__ConfigUrl, { cache : 'no-store' });
                    if (!response.ok) {
                        console.warn('[TrueVision3D LayoutEditor] Model layer map fetch failed (' + response.status + ') - categories will use generated labels.');
                        return null;
                    }
                    Na__LeModelLayers__Config = await response.json();
                    Na__LeModelLayers__BuildEdgeIndex();
                } catch (error) {
                    console.warn('[TrueVision3D LayoutEditor] Model layer map unavailable - categories will use generated labels.', error);
                }
                return Na__LeModelLayers__Config;
            })();
        }
        return Na__LeModelLayers__LoadPromise;
    }
    // ------------------------------------------------------------


    // FUNCTION | Whether the Real Layer Map Is In Hand
    // ------------------------------------------------------------
    function Na__LeModelLayers__IsLoaded() {
        return Na__LeModelLayers__Config !== null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Fallback Rules, From the Config or Built In
    // ------------------------------------------------------------
    function Na__LeModelLayers__Fallback() {
        const block = Na__LeModelLayers__Config ? Na__LeModelLayers__Config['LayoutEditor__ModelLayers__Fallback'] : null;
        if (!block) return Na__LeModelLayers__FALLBACK;
        return {
            groupLabel    : block['Fallback__GroupLabel']    || Na__LeModelLayers__FALLBACK.groupLabel,
            stripPrefix   : block['Fallback__StripPrefix']   || Na__LeModelLayers__FALLBACK.stripPrefix,
            splitOnDouble : block['Fallback__SplitOnDouble'] || Na__LeModelLayers__FALLBACK.splitOnDouble
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Index Every Row's Configured Edge Style by Category Key
    // ------------------------------------------------------------
    // A row that names no edge style of its own inherits the config's
    // EdgeDefaults block, so a new category can be added to the file with two
    // fields instead of five.
    // ------------------------------------------------------------
    function Na__LeModelLayers__BuildEdgeIndex() {
        Na__LeModelLayers__EdgeIndex = new Map();
        if (!Na__LeModelLayers__Config) return;

        const shared = Na__LeModelLayers__Config['LayoutEditor__ModelLayers__EdgeDefaults'] || {};
        const base   = {
            weight   : Number.isFinite(shared['EdgeDefaults__WeightFactor']) ? shared['EdgeDefaults__WeightFactor'] : 1.00,
            colour   : shared['EdgeDefaults__Colour']   || 'black',
            lineType : shared['EdgeDefaults__LineType'] || 'solid'
        };

        (Na__LeModelLayers__Config['LayoutEditor__ModelLayers__Groups'] || []).forEach((group) => {
            (group['Group__Layers'] || []).forEach((layer) => {
                const key = layer['Layer__CategoryKey'];
                if (!key) return;
                Na__LeModelLayers__EdgeIndex.set(key, {
                    weight   : Number.isFinite(layer['Layer__EdgeWeightFactor']) ? layer['Layer__EdgeWeightFactor'] : base.weight,
                    colour   : layer['Layer__EdgeColour']   || base.colour,
                    lineType : layer['Layer__EdgeLineType'] || base.lineType
                });
            });
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | The Configured Edge Style for One Category (null When Unlisted)
    // ------------------------------------------------------------
    // Null is a real answer, not a failure: a category the model loaded that this
    // config has never heard of has no configured style, and the edge style
    // module turns that into its own fallback rather than guessing here.
    // ------------------------------------------------------------
    function Na__LeModelLayers__EdgeDefault(categoryKey) {
        if (!Na__LeModelLayers__EdgeIndex) Na__LeModelLayers__BuildEdgeIndex();
        return Na__LeModelLayers__EdgeIndex.get(categoryKey) || null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Readable Name for a Category the Map Does Not Carry
    // ------------------------------------------------------------
    function Na__LeModelLayers__Generated(categoryKey) {
        const rules = Na__LeModelLayers__Fallback();
        return String(categoryKey)
            .replace(rules.stripPrefix, '')
            .replace(/__/g, rules.splitOnDouble)
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Panel's Inventory
// -----------------------------------------------------------------------------

    // FUNCTION | The Groups and Rows the Panel Should Draw
    // ------------------------------------------------------------
    // Returns [ { id, label, layers : [ { key, label, tags } ] } ].
    //
    // DRIVEN BY THE MODEL, ORDERED BY THE CONFIG. The config decides what
    // things are called and which heading they sit under; the loaded model
    // decides which of them exist at all. A project with no first floor never
    // shows a First Floor Furniture row, and a project that exports a category
    // nobody has named yet still shows it - under "Other", with a generated
    // label - rather than offering no way to switch it off.
    //
    // categoryKeys names the model when it is not the live one: a viewport
    // drawing another design phase lists THAT phase's categories. Omitted, the
    // live model's registry answers, as it always did.
    // ------------------------------------------------------------
    function Na__LeModelLayers__Groups(categoryKeys) {
        const loaded = Array.isArray(categoryKeys) ? categoryKeys : Na__ModelToggle__GetCategoryKeys();
        if (!loaded || loaded.length === 0) return [];

        const remaining = new Set(loaded);
        const groups    = [];
        const mapped    = Na__LeModelLayers__Config ? (Na__LeModelLayers__Config['LayoutEditor__ModelLayers__Groups'] || []) : [];

        // SITE PLAN LAYERS | Named and grouped by their own export (the SSOT's label
        // and group), in draw order, ahead of any model groups.
        const sitePlanGroups = new Map();
        Na__SpStore__GetLayers().forEach((layer) => {
            const key = layer.Layer__CategoryKey;
            if (!remaining.has(key)) return;
            remaining.delete(key);
            const groupLabel = layer.Layer__Group || Na__LeModelLayers__Fallback().groupLabel;
            if (!sitePlanGroups.has(groupLabel)) sitePlanGroups.set(groupLabel, []);
            sitePlanGroups.get(groupLabel).push({ key : key, label : layer.Layer__Label || Na__LeModelLayers__Generated(key), tags : layer.Layer__TagName ? [ layer.Layer__TagName ] : [] });
        });
        sitePlanGroups.forEach((rows, groupLabel) => groups.push({ id : 'siteplan-' + groupLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label : groupLabel, layers : rows }));

        mapped.forEach((group) => {
            const rows       = [];
            const alwaysShow = group['Group__AlwaysShow'] === true;               // <-- A style-only group (e.g. linework-modifiers): never a loaded category, list it anyway
            (group['Group__Layers'] || []).forEach((layer) => {
                const key = layer['Layer__CategoryKey'];
                if (!alwaysShow && !remaining.has(key)) return;                   // <-- The model did not load it: it is not a choice
                remaining.delete(key);                                            // <-- Harmless when absent; keeps an always-shown key out of "Other" if the model happens to carry it too
                rows.push({
                    key   : key,
                    label : layer['Layer__Label'] || Na__LeModelLayers__Generated(key),
                    tags  : layer['Layer__SketchUpTags'] || []
                });
            });
            if (rows.length > 0) groups.push({ id : group['Group__Id'] || 'group', label : group['Group__Label'] || '', layers : rows });
        });

        if (remaining.size > 0) {
            const rows = [];
            loaded.forEach((key) => { if (remaining.has(key)) rows.push({ key : key, label : Na__LeModelLayers__Generated(key), tags : [] }); });
            groups.push({ id : 'other', label : Na__LeModelLayers__Fallback().groupLabel, layers : rows });
        }

        return groups;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | What One Viewport Hides
// -----------------------------------------------------------------------------

    // FUNCTION | Is This Category On for This Viewport
    // ------------------------------------------------------------
    // ABSENT MEANS ON. A viewport records only what has been switched off, so
    // a category the model gains later shows up rather than inheriting someone
    // else's silence.
    // ------------------------------------------------------------
    function Na__LeModelLayers__IsOn(viewport, categoryKey) {
        const stored = viewport ? viewport[Na__LeModelLayers__FIELD] : null;
        if (!stored) return true;
        return stored[categoryKey] !== false;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Category Keys This Viewport Has Switched Off
    // ------------------------------------------------------------
    function Na__LeModelLayers__HiddenKeys(viewport) {
        const stored = viewport ? viewport[Na__LeModelLayers__FIELD] : null;
        if (!stored) return [];
        return Object.keys(stored).filter((key) => stored[key] === false).sort();   // <-- Sorted so the token below is stable
    }
    // ------------------------------------------------------------


    // FUNCTION | A Stable Token for Cache Keys
    // ------------------------------------------------------------
    // Empty when nothing is hidden, so a viewport that has never touched this
    // panel keys exactly as it did before the feature existed and its cached
    // renders survive.
    // ------------------------------------------------------------
    function Na__LeModelLayers__Token(viewport) {
        const hidden = Na__LeModelLayers__HiddenKeys(viewport);
        return hidden.length === 0 ? '' : hidden.join(',');
    }
    // ------------------------------------------------------------


    // FUNCTION | Exclusion Tokens for the Linework Projection
    // ------------------------------------------------------------
    // THE LEADING '=' ASKS FOR AN EXACT MATCH, and it has to. The projection's
    // exclusion tokens are ordinarily substrings, which is right for the
    // hand-written tokens in a drawing record but wrong here: a category key
    // is a whole name, and "TrueVision__MainBuildingModel__Existing" is a
    // substring of "...ExistingWalls", "...ExistingRoofs" and seven more.
    // Switching off the existing building would have taken its walls, roofs
    // and windows with it.
    // ------------------------------------------------------------
    function Na__LeModelLayers__ExcludeTokens(viewport) {
        return Na__LeModelLayers__HiddenKeys(viewport).map((key) => '=' + key);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Model Layers API
    // ------------------------------------------------------------
    export {
        Na__LeModelLayers__FIELD,
        Na__LeModelLayers__Ready,
        Na__LeModelLayers__IsLoaded,
        Na__LeModelLayers__Groups,
        Na__LeModelLayers__EdgeDefault,
        Na__LeModelLayers__IsOn,
        Na__LeModelLayers__HiddenKeys,
        Na__LeModelLayers__Token,
        Na__LeModelLayers__ExcludeTokens
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
