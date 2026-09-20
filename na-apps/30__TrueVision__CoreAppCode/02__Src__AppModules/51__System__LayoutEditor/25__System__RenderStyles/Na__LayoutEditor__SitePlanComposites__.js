// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SITE PLAN COMPOSITES
// =============================================================================
//
// FILE       : Na__LayoutEditor__SitePlanComposites__.js
// NAMESPACE  : Na__LeSpComp
// MODULE     : Layout Editor - Site Plan Composites
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : A site plan viewport's three decks and its subtype: block plan or location plan, and which of the fills, patterns and linework go into the picture
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - TrueVision only (site plan drawings). The site plan half of what
//   Na__LayoutEditor__RenderComposites__.js is to a 3D viewport: the inventory
//   of decks that make up the picture, read from a config file rather than a
//   list in code, plus the per-viewport switches that take one out.
// - THE SUBTYPE. A site plan viewport is a BLOCK PLAN or a LOCATION PLAN, and
//   the two draw differently (Adam, TASK 06). Stored as SitePlan__PlanType;
//   'auto', the default, resolves from the viewport's scale - 1:500 or finer
//   is a block plan, coarser is a location plan.
// - THE LOCATION PLAN RULE. Only the proposal fills, no patterns at all, and
//   every line that is not a boundary or a proposal converted to its own
//   greyscale value. LocationRules() hands the painter one object holding
//   exactly that, or null on a block plan, so the painter asks once and the
//   rule lives here.
// - Nothing in this module touches the DOM or the record layer. The panel
//   reads Decks() and IsDeckOn(); the painter reads PlanType(), IsDeckOn()
//   and LocationRules(); the record layer reads DeckKeys() and DeckDefault()
//   to normalise what a viewport has stored.
//
// INTEGRATION:
// - Read by Na__LayoutEditor__Panel__SitePlanComposites__.js (the panel),
//   Na__LayoutEditor__Viewport2d__SitePlan__.js (the painter) and
//   Na__LayoutEditor__SheetRecords__.js (normalising the record).
// - Ready() joins the other config gates in the mode controller's Promise.all,
//   beside Na__LeHatch__Ready(), so the first paint has the real inventory.
//   Every reader works before it resolves, on the built-in fallback.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : none (TrueVision-only: site plan drawings)
// - Parity        : n/a
// - Divergences   : n/a
// - Back-port     : goes to ValeVision3D with the site plan feature, if that is ever ported
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation for TASK 06: the site plan subtype, the three-deck
//   composite and the location plan rule.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Scale Tools (the block plan / location plan boundary)
    // ------------------------------------------------------------
    import { Na__LeScale__Coerce } from '../07__Core__SheetData/Na__LayoutEditor__ScaleManager__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Record Fields and the Subtype Values
    // ------------------------------------------------------------
    const Na__LeSpComp__BLOCK_FIELD = 'Viewport__SitePlan';                      // <-- The site plan block on a viewport record
    const Na__LeSpComp__DECK_FIELD  = 'SitePlan__Composites';                    // <-- { deckKey : boolean }, only what disagrees with the default
    const Na__LeSpComp__TYPE_FIELD  = 'SitePlan__PlanType';                      // <-- 'block' | 'location'; absent means automatic
    const Na__LeSpComp__PLAN_AUTO   = 'auto';
    const Na__LeSpComp__PLAN_BLOCK  = 'block';
    const Na__LeSpComp__PLAN_LOCAL  = 'location';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Config Location and the Built-in Fallback
    // ------------------------------------------------------------
    // THE FALLBACK IS THE DRAWING. A site plan viewport must be able to paint
    // before a fetch has resolved, so the three decks, the 1:500 boundary and
    // the location plan rule all have a value here that matches the shipped
    // config. The file wins the moment it lands.
    // ------------------------------------------------------------
    const Na__LeSpComp__ConfigUrl = new URL('./Na__LayoutEditor__SitePlanComposites__Config__.json', import.meta.url);

    const Na__LeSpComp__FALLBACK = {
        decks : [
            { key : 'fills',    label : 'Solid Fills',    order : 10, on : true, note : '' },
            { key : 'patterns', label : 'Hatch Patterns', order : 20, on : true, note : '' },
            { key : 'linework', label : 'Linework',       order : 30, on : true, note : '' }
        ],
        blockMaxDenominator : 500,
        location : {
            paintPatterns        : false,
            fillsAreProposalOnly : true,
            greyscaleOtherInk    : true,
            keepsInkTagPattern   : '^\\d{2}__SitePlan__Boundary__',
            proposalFillIds      : [ 'MAT803__SitePlan__ProposalRed' ]
        }
    };
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Loaded Config
    // ------------------------------------------------------------
    let Na__LeSpComp__Config      = null;
    let Na__LeSpComp__LoadPromise = null;
    let Na__LeSpComp__Decks       = null;                                        // <-- Built once per config, not per refresh
    let Na__LeSpComp__InkRegex    = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Config Loading
// -----------------------------------------------------------------------------

    // FUNCTION | Load the Deck Inventory (resolves whether or not the file is there)
    // ------------------------------------------------------------
    function Na__LeSpComp__Ready() {
        if (!Na__LeSpComp__LoadPromise) {
            Na__LeSpComp__LoadPromise = (async () => {
                try {
                    const response = await fetch(Na__LeSpComp__ConfigUrl, { cache : 'no-store' });
                    if (!response.ok) {
                        console.warn('[TrueVision3D LayoutEditor] Site plan composite config fetch failed (' + response.status + ') - the built-in inventory will be used.');
                        return null;
                    }
                    Na__LeSpComp__Config   = await response.json();
                    Na__LeSpComp__Decks    = null;
                    Na__LeSpComp__InkRegex = null;
                } catch (error) {
                    console.warn('[TrueVision3D LayoutEditor] Site plan composite config unavailable - the built-in inventory will be used.', error);
                }
                return Na__LeSpComp__Config;
            })();
        }
        return Na__LeSpComp__LoadPromise;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Config Block, or an Empty Object
    // ------------------------------------------------------------
    function Na__LeSpComp__Block(suffix) {
        const config = Na__LeSpComp__Config;
        if (!config || typeof config !== 'object') return {};
        const key = Object.keys(config).find((name) => name.indexOf('LayoutEditor__SitePlanComposites__' + suffix) === 0);
        const block = key ? config[key] : null;
        return (block && typeof block === 'object') ? block : {};
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Deck Inventory
// -----------------------------------------------------------------------------

    // FUNCTION | The Decks, Bottom to Top
    // ------------------------------------------------------------
    // Returns [ { key, label, order, on, note } ] in Deck__Order - which is also
    // the order they paint in, so the panel reads top to bottom as the picture
    // stacks bottom to top. `on` is the default state, not this viewport's.
    // ------------------------------------------------------------
    function Na__LeSpComp__GetDecks() {
        if (Na__LeSpComp__Decks) return Na__LeSpComp__Decks;
        const listed = Na__LeSpComp__Block('Decks');
        const rows   = Array.isArray(listed) ? listed : null;
        if (!rows || rows.length === 0) { Na__LeSpComp__Decks = Na__LeSpComp__FALLBACK.decks.slice(); return Na__LeSpComp__Decks; }
        Na__LeSpComp__Decks = rows
            .filter((row) => row && typeof row.Deck__Key === 'string' && row.Deck__Key)
            .map((row) => ({
                key   : row.Deck__Key,
                label : (typeof row.Deck__Label === 'string' && row.Deck__Label) ? row.Deck__Label : row.Deck__Key,
                order : Number.isFinite(row.Deck__Order) ? row.Deck__Order : 50,
                on    : row.Deck__Default !== false,
                note  : (typeof row.Deck__Note === 'string') ? row.Deck__Note : ''
            }))
            .sort((a, b) => a.order - b.order);
        if (Na__LeSpComp__Decks.length === 0) Na__LeSpComp__Decks = Na__LeSpComp__FALLBACK.decks.slice();
        return Na__LeSpComp__Decks;
    }
    // ------------------------------------------------------------


    // FUNCTION | Just the Keys (what the record layer keeps)
    // ------------------------------------------------------------
    function Na__LeSpComp__DeckKeys() {
        return Na__LeSpComp__GetDecks().map((deck) => deck.key);
    }
    // ------------------------------------------------------------


    // FUNCTION | A Deck's Default State
    // ------------------------------------------------------------
    function Na__LeSpComp__DeckDefault(deckKey) {
        const deck = Na__LeSpComp__GetDecks().find((entry) => entry.key === deckKey);
        return deck ? deck.on : true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is This Deck Painted on This Viewport
    // ------------------------------------------------------------
    // A viewport stores a deck ONLY when it disagrees with the default, so a
    // viewport nobody has touched is byte-identical on save and follows the
    // config if a default ever moves.
    // ------------------------------------------------------------
    function Na__LeSpComp__IsDeckOn(viewport, deckKey) {
        const block = viewport ? viewport[Na__LeSpComp__BLOCK_FIELD] : null;
        const decks = (block && typeof block === 'object') ? block[Na__LeSpComp__DECK_FIELD] : null;
        if (decks && typeof decks === 'object' && typeof decks[deckKey] === 'boolean') return decks[deckKey];
        return Na__LeSpComp__DeckDefault(deckKey);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Subtype
// -----------------------------------------------------------------------------

    // FUNCTION | The Coarsest Scale That Is Still a Block Plan
    // ------------------------------------------------------------
    function Na__LeSpComp__BlockMaxDenominator() {
        const value = Na__LeSpComp__Block('PlanTypes').PlanTypes__BlockMaxDenominator;
        return Number.isFinite(value) ? value : Na__LeSpComp__FALLBACK.blockMaxDenominator;
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Viewport's Scale Alone Says It Is
    // ------------------------------------------------------------
    // Adam: 'Viewports over 1:500' are location plans, so 1:500 or FINER - a
    // SMALLER denominator - is a block plan. A viewport with no usable scale is
    // coerced onto the site plan list first, so this never reads a NaN.
    // ------------------------------------------------------------
    function Na__LeSpComp__PlanTypeForScale(denominator) {
        const d = Na__LeScale__Coerce(denominator, true);
        return (d <= Na__LeSpComp__BlockMaxDenominator()) ? Na__LeSpComp__PLAN_BLOCK : Na__LeSpComp__PLAN_LOCAL;
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Viewport Has Been Told to Be ('auto' when it has no say)
    // ------------------------------------------------------------
    function Na__LeSpComp__StoredPlanType(viewport) {
        const block = viewport ? viewport[Na__LeSpComp__BLOCK_FIELD] : null;
        const value = (block && typeof block === 'object') ? block[Na__LeSpComp__TYPE_FIELD] : null;
        if (value === Na__LeSpComp__PLAN_BLOCK || value === Na__LeSpComp__PLAN_LOCAL) return value;
        return Na__LeSpComp__PLAN_AUTO;
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Viewport Actually Draws As
    // ------------------------------------------------------------
    // Returns 'block' or 'location', never 'auto': a stored choice wins, and
    // otherwise the scale decides.
    // ------------------------------------------------------------
    function Na__LeSpComp__PlanType(viewport) {
        const stored = Na__LeSpComp__StoredPlanType(viewport);
        if (stored !== Na__LeSpComp__PLAN_AUTO) return stored;
        return Na__LeSpComp__PlanTypeForScale(viewport ? viewport.Viewport__ScaleDenominator : null);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Location Plan Rule
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Location Plan Config, Filled Out
    // ------------------------------------------------------------
    function Na__LeSpComp__LocationConfig() {
        const block = Na__LeSpComp__Block('LocationPlan');
        const fall  = Na__LeSpComp__FALLBACK.location;
        const ids   = Array.isArray(block.LocationPlan__ProposalFillMaterialIds)
            ? block.LocationPlan__ProposalFillMaterialIds.filter((id) => typeof id === 'string' && id)
            : null;
        return {
            paintPatterns        : block.LocationPlan__PaintPatterns === true,
            fillsAreProposalOnly : block.LocationPlan__FillsAreProposalOnly !== false,
            greyscaleOtherInk    : block.LocationPlan__GreyscaleOtherInk !== false,
            keepsInkTagPattern   : (typeof block.LocationPlan__KeepsInkTagPattern === 'string' && block.LocationPlan__KeepsInkTagPattern)
                ? block.LocationPlan__KeepsInkTagPattern : fall.keepsInkTagPattern,
            proposalFillIds      : (ids && ids.length) ? ids : fall.proposalFillIds.slice()
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Compiled "Keeps Its Ink" Test
    // ------------------------------------------------------------
    // A bad pattern in the config must not take the drawing down with it: an
    // unusable regex falls back to the built-in one rather than throwing on
    // every repaint.
    // ------------------------------------------------------------
    function Na__LeSpComp__InkTest() {
        if (Na__LeSpComp__InkRegex) return Na__LeSpComp__InkRegex;
        const source = Na__LeSpComp__LocationConfig().keepsInkTagPattern;
        try { Na__LeSpComp__InkRegex = new RegExp(source); }
        catch (error) {
            console.warn('[TrueVision3D LayoutEditor] Site plan location ink pattern is not a valid regex - the built-in one will be used.', error);
            Na__LeSpComp__InkRegex = new RegExp(Na__LeSpComp__FALLBACK.location.keepsInkTagPattern);
        }
        return Na__LeSpComp__InkRegex;
    }
    // ------------------------------------------------------------


    // FUNCTION | Does This Layer Carry the Proposal Fill
    // ------------------------------------------------------------
    // The Materials SSOT id, not the hex: the proposal red may be restyled in
    // the SSOT without this rule having to be told about it.
    // ------------------------------------------------------------
    function Na__LeSpComp__IsProposalLayer(layer) {
        const style = (layer && layer.Layer__Style) ? layer.Layer__Style : null;
        if (!style || typeof style.FillMaterialId !== 'string') return false;
        return Na__LeSpComp__LocationConfig().proposalFillIds.indexOf(style.FillMaterialId) !== -1;
    }
    // ------------------------------------------------------------


    // FUNCTION | Does This Layer Keep Its Own Ink on a Location Plan
    // ------------------------------------------------------------
    // The boundary family, and anything carrying the proposal fill. Matched on
    // the SketchUp tag name; a manifest too old to carry one falls back to the
    // export stem, which reads '...Boundary...' for the same layers.
    // ------------------------------------------------------------
    function Na__LeSpComp__KeepsInk(layer) {
        if (!layer) return false;
        if (Na__LeSpComp__IsProposalLayer(layer)) return true;
        const name = (typeof layer.Layer__TagName === 'string' && layer.Layer__TagName)
            ? layer.Layer__TagName
            : String(layer.Layer__Stem || layer.Layer__CategoryKey || '');
        return Na__LeSpComp__InkTest().test(name);
    }
    // ------------------------------------------------------------


    // FUNCTION | A Colour at Its Own Greyscale Value
    // ------------------------------------------------------------
    // Rec. 709 luminance, so a grey in gives the identical grey out and the OS
    // base map passes through this rule untouched, while the woodland green and
    // the water blue drop to a grey of the same weight.
    // ------------------------------------------------------------
    function Na__LeSpComp__Greyscale(hex) {
        const match = /^#?([0-9a-fA-F]{6})$/.exec(String(hex || ''));
        if (!match) return hex;
        const value = match[1];
        const r = parseInt(value.substring(0, 2), 16);
        const g = parseInt(value.substring(2, 4), 16);
        const b = parseInt(value.substring(4, 6), 16);
        const y = Math.max(0, Math.min(255, Math.round((0.2126 * r) + (0.7152 * g) + (0.0722 * b))));
        const h = y.toString(16).padStart(2, '0');
        return '#' + h + h + h;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Location Plan Rule for One Viewport, or null on a Block Plan
    // ------------------------------------------------------------
    // Returns { fillsAreProposalOnly, paintPatterns, greyscaleOtherInk,
    // KeepsInk(layer), IsProposalLayer(layer), Greyscale(hex) } so the painter
    // asks this module once and never has to know what the rule is.
    // ------------------------------------------------------------
    function Na__LeSpComp__LocationRules(viewport) {
        if (Na__LeSpComp__PlanType(viewport) !== Na__LeSpComp__PLAN_LOCAL) return null;
        const config = Na__LeSpComp__LocationConfig();
        return {
            fillsAreProposalOnly : config.fillsAreProposalOnly,
            paintPatterns        : config.paintPatterns,
            greyscaleOtherInk    : config.greyscaleOtherInk,
            KeepsInk             : Na__LeSpComp__KeepsInk,
            IsProposalLayer      : Na__LeSpComp__IsProposalLayer,
            Greyscale            : Na__LeSpComp__Greyscale
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Viewport's Composite Depends On, as One Token
    // ------------------------------------------------------------
    // Folded into the site plan paint key, so flipping a deck or the subtype
    // repaints the frame - and, just as importantly, misses the band path cache,
    // which is keyed on the same string.
    // ------------------------------------------------------------
    function Na__LeSpComp__Token(viewport) {
        const decks = Na__LeSpComp__GetDecks().map((deck) => (Na__LeSpComp__IsDeckOn(viewport, deck.key) ? '1' : '0')).join('');
        return Na__LeSpComp__PlanType(viewport) + ':' + decks;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Site Plan Composites API
    // ------------------------------------------------------------
    export {
        Na__LeSpComp__BLOCK_FIELD,
        Na__LeSpComp__DECK_FIELD,
        Na__LeSpComp__TYPE_FIELD,
        Na__LeSpComp__PLAN_AUTO,
        Na__LeSpComp__PLAN_BLOCK,
        Na__LeSpComp__PLAN_LOCAL,
        Na__LeSpComp__Ready,
        Na__LeSpComp__GetDecks,
        Na__LeSpComp__DeckKeys,
        Na__LeSpComp__DeckDefault,
        Na__LeSpComp__IsDeckOn,
        Na__LeSpComp__BlockMaxDenominator,
        Na__LeSpComp__PlanTypeForScale,
        Na__LeSpComp__StoredPlanType,
        Na__LeSpComp__PlanType,
        Na__LeSpComp__IsProposalLayer,
        Na__LeSpComp__KeepsInk,
        Na__LeSpComp__Greyscale,
        Na__LeSpComp__LocationRules,
        Na__LeSpComp__Token
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
