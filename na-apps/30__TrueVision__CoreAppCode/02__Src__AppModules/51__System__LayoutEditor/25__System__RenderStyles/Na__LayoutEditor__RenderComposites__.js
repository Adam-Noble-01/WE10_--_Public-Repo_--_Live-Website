// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - RENDER COMPOSITES
// =============================================================================
//
// FILE       : Na__LayoutEditor__RenderComposites__.js
// NAMESPACE  : Na__LeComposite
// MODULE     : Layout Editor - Render Composites
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The inventory of layers a viewport's picture is made of, and how thick each one draws
// CREATED    : 12-Sep-2026
//
// DESCRIPTION:
// - Owns Na__LayoutEditor__RenderComposites__Config__.json: one row per layer
//   that goes into a viewport's picture, its label, whether it means anything on
//   a 3D viewport, whether it carries a toggle, and its line weight.
// - Owns the per-viewport record Viewport__CompositeWeights, which stores only
//   the weights a viewport has actually been given.
// - The Render Composites panel is built from here rather than from a list in
//   its own source, so adding a composite is a config edit.
//
// -----------------------------------------------------------------------------
//
// WHERE THE 2D OUTLINE WIDTH WENT
//
// Until v2.27.0 the silhouette on a 2D viewport's backing picture was drawn at the
// drawing view config's built-in 1.0 px, the same for every viewport on every
// sheet. Na__AppConfig__Main.json carried RenderEffect__ProfileLines__Drawing2dEdgeWidth
// 0.55 and it was read as the bake width, but TrueVision never registered the main
// config with the drawing view (closed 13-Sep-2026), so 0.55 only ever reached the
// live floor plan and elevation views.
//
// It is now the profileLinework row's Composite__Weight, defaulting to the 1.0 every
// existing sheet was baked at, in a place a person would look for it and - more to
// the point - a number a single viewport can disagree with. A drawing opened outside
// the Layout Editor is untouched: the live views never read this.
//
// -----------------------------------------------------------------------------
//
// THREE KINDS OF WEIGHT, AND THE DIFFERENCES MATTER
//
//   factor   A multiplier on the sheet's master viewport lineweight. Vector
//            work. Raising the master raises everything and the hierarchy
//            survives.
//   pixels   A real pixel count in a render buffer. Screen-space effects - the
//            Sobel silhouette, the section outline, the model's own edges in
//            the base image - consume pixels and have no opinion about paper.
//   percent  How much of a post pass is applied: 0 none of it, 100 all of it.
//            Not a width at all - a dial on an effect that either happens to
//            the finished pixels or does not. Enhance Whitecard is the first.
//
// A composite whose kind is 'none' draws no line and gets no control. Those rows
// still exist in the config so the file is a complete inventory of the picture
// rather than a selective one.
//
// FACTOR IS THE ONLY KIND THAT LEAVES THE RASTER ALONE. Pixels and percent both
// change what the renderer or the post pass writes, so both belong in the raster
// cache key; a factor thickens the vector drawing over the top and must not.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : n/a - authored in TrueVision3D
// - Back-port     : ported 13-Sep-2026 as ValeVision3D v2.28.0. Module verbatim,
//                   config layers verbatim; ValeVision's composer owns the profile
//                   pass differently (DIV-1), so only the consumers of the pixel
//                   weights differ there.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.3.0
// - A Depth Fog row, first in the built-in inventory as it is in the config:
//   the one layer that sits over the projected linework. A toggle with no
//   weight - the fog's own numbers are the drawing's, not the viewport's - so
//   it enters no weight record and no raster token. Nothing else here changed.
//
// 20-Sep-2026 - Version 1.2.0
// - A third weight kind, 'percent': how much of a post pass to apply. Enhance
//   Whitecard carries it, so the levels and sharpen pass can be dialled from
//   nothing to the full effect per viewport. RasterToken now takes percent as
//   well as pixels, because a post pass does change the picture.
//
// 13-Sep-2026 - Version 1.1.0
// - Base Image carries a weight: how thick the model's own edges draw in the
//   rendered picture, 2D and 3D. RasterToken takes forThreeD, so a 3D snapshot
//   keys only on the weights a 3D picture can show.
//
// 12-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Config Location and Record Field
    // ------------------------------------------------------------
    const Na__LeComposite__ConfigUrl = new URL('./Na__LayoutEditor__RenderComposites__Config__.json', import.meta.url);
    const Na__LeComposite__FIELD     = 'Viewport__CompositeWeights';
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Fetched Config and Its Index
    // ------------------------------------------------------------
    let Na__LeComposite__Config      = null;
    let Na__LeComposite__LoadPromise = null;
    let Na__LeComposite__Index       = null;   // <-- key -> row
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Inventory That Works Before the Fetch Lands
    // ------------------------------------------------------------
    // The same seven toggles the panel carried when the list lived in its own
    // source, plus the section outline weight. A failed fetch therefore leaves a
    // fully working panel rather than an empty one; only the wording and the
    // weights fall back to these.
    // ------------------------------------------------------------
    const Na__LeComposite__FALLBACK = [
        { key : 'depthFog',          label : 'Depth Fog',               twoDOnly : true,  toggle : true,  weight : { kind : 'none' } },
        { key : 'projectedLinework', label : 'Projected Linework',      twoDOnly : true,  toggle : true,  weight : { kind : 'factor', value : 1.00, min : 0.10, max : 3.00, step : 0.05, label : 'Weight'  } },
        { key : 'profileLinework',   label : 'Profile Linework Effect', twoDOnly : false, toggle : true,  weight : { kind : 'pixels', value : 1.00, min : 0.10, max : 4.00, step : 0.05, label : 'Edge px', twoDOnly : true } },
        { key : 'sectionOutline',    label : 'Section Outline',         twoDOnly : true,  toggle : false, weight : { kind : 'pixels', value : 2.00, min : 0.50, max : 8.00, step : 0.25, label : 'Cut px'  } },
        { key : 'hiddenLines',       label : 'Hidden Lines',            twoDOnly : true,  toggle : true,  weight : { kind : 'factor', value : 1.00, min : 0.10, max : 3.00, step : 0.05, label : 'Weight'  } },
        { key : 'glassOpaque',       label : 'Glass Transparency Off',  twoDOnly : false, toggle : true,  weight : { kind : 'none' } },
        { key : 'whitecard',         label : 'Whitecard',               twoDOnly : false, toggle : true,  weight : { kind : 'none' } },
        { key : 'enhanceWhitecard',  label : 'Enhance Whitecard',       twoDOnly : false, toggle : true,  weight : { kind : 'percent', value : 100, min : 0, max : 100, step : 5, label : 'Strength' } },
        { key : 'baseImage',         label : 'Context Layer',           twoDOnly : false, toggle : true,  weight : { kind : 'pixels', value : 2.00, min : 0.10, max : 4.00, step : 0.05, label : 'Edge px' } }
    ];
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Config
// -----------------------------------------------------------------------------

    // FUNCTION | Fetch the Inventory Once
    // ------------------------------------------------------------
    function Na__LeComposite__Ready() {
        if (!Na__LeComposite__LoadPromise) {
            Na__LeComposite__LoadPromise = (async () => {
                try {
                    const response = await fetch(Na__LeComposite__ConfigUrl, { cache : 'no-store' });
                    if (!response.ok) {
                        console.warn('[TrueVision3D LayoutEditor] Render composite config fetch failed (' + response.status + ') - the built-in inventory will be used.');
                        return null;
                    }
                    Na__LeComposite__Config = await response.json();
                    Na__LeComposite__Index  = null;
                } catch (error) {
                    console.warn('[TrueVision3D LayoutEditor] Render composite config unavailable - the built-in inventory will be used.', error);
                }
                return Na__LeComposite__Config;
            })();
        }
        return Na__LeComposite__LoadPromise;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Composite Rows, in Drawing Order
    // ------------------------------------------------------------
    // Returns [ { key, label, twoDOnly, toggle, note, weight : { kind, value,
    // min, max, step, label } } ].
    // ------------------------------------------------------------
    function Na__LeComposite__Rows() {
        const list = Na__LeComposite__Config ? Na__LeComposite__Config['LayoutEditor__RenderComposites__Layers'] : null;
        if (!Array.isArray(list) || list.length === 0) return Na__LeComposite__FALLBACK;

        return list.map((row) => {
            const weight = row['Composite__Weight'] || {};
            const kind   = weight['Weight__Kind'] || 'none';
            return {
                key      : row['Composite__Key'],
                label    : row['Composite__Label'] || row['Composite__Key'],
                twoDOnly : row['Composite__TwoDOnly'] === true,
                toggle   : row['Composite__Toggle'] !== false,
                note     : row['Composite__Note'] || '',
                order    : Number.isFinite(row['Composite__Order']) ? row['Composite__Order'] : 999,
                weight   : kind === 'none' ? { kind : 'none' } : {
                    kind     : kind,
                    twoDOnly : weight['Weight__TwoDOnly'] === true,               // <-- The toggle can mean something in 3D while the weight does not
                    value : Number.isFinite(weight['Weight__Default']) ? weight['Weight__Default'] : 1.00,
                    min   : Number.isFinite(weight['Weight__Min'])     ? weight['Weight__Min']     : 0.10,
                    max   : Number.isFinite(weight['Weight__Max'])     ? weight['Weight__Max']     : 4.00,
                    step  : Number.isFinite(weight['Weight__Step'])    ? weight['Weight__Step']    : 0.05,
                    label : weight['Weight__Label'] || 'Weight'
                }
            };
        }).sort((a, b) => a.order - b.order);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Row by Key (null When the Config Has Not Heard of It)
    // ------------------------------------------------------------
    function Na__LeComposite__Row(key) {
        if (!Na__LeComposite__Index) {
            Na__LeComposite__Index = new Map();
            Na__LeComposite__Rows().forEach((row) => Na__LeComposite__Index.set(row.key, row));
        }
        return Na__LeComposite__Index.get(key) || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Rows That Carry a Toggle (What the Panel Checkboxes Are)
    // ------------------------------------------------------------
    function Na__LeComposite__ToggleRows() {
        return Na__LeComposite__Rows().filter((row) => row.toggle === true);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Rows That Carry a Weight (What the Advanced Fold Reveals)
    // ------------------------------------------------------------
    function Na__LeComposite__WeightRows() {
        return Na__LeComposite__Rows().filter((row) => row.weight.kind !== 'none');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Per-Viewport Record
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Clamp One Weight Into Its Row's Bounds
    // ------------------------------------------------------------
    function Na__LeComposite__Clamp(key, value) {
        const row = Na__LeComposite__Row(key);
        if (!row || row.weight.kind === 'none') return null;
        if (!Number.isFinite(value)) return row.weight.value;
        const clamped = Math.min(row.weight.max, Math.max(row.weight.min, value));
        return Math.round(clamped * 1000) / 1000;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Weight One Composite Draws At In One Viewport
    // ------------------------------------------------------------
    // The config default unless the viewport disagrees. Returns null for a
    // composite that has no weight at all, which is a different answer from
    // zero and the callers treat it that way.
    // ------------------------------------------------------------
    function Na__LeComposite__Weight(viewport, key) {
        const row = Na__LeComposite__Row(key);
        if (!row || row.weight.kind === 'none') return null;
        const stored = viewport ? viewport[Na__LeComposite__FIELD] : null;
        const value  = (stored && Number.isFinite(stored[key])) ? stored[key] : row.weight.value;
        return Na__LeComposite__Clamp(key, value);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Weight as a Multiplier, Never Null
    // ------------------------------------------------------------
    // For the vector path, which wants to multiply unconditionally. A composite
    // with no weight multiplies by one.
    // ------------------------------------------------------------
    function Na__LeComposite__Factor(viewport, key) {
        const value = Na__LeComposite__Weight(viewport, key);
        return Number.isFinite(value) ? value : 1;
    }
    // ------------------------------------------------------------


    // FUNCTION | Has This Viewport Been Given Its Own Weight for This Composite
    // ------------------------------------------------------------
    function Na__LeComposite__IsOverridden(viewport, key) {
        const stored = viewport ? viewport[Na__LeComposite__FIELD] : null;
        return !!(stored && Number.isFinite(stored[key]));
    }
    // ------------------------------------------------------------


    // FUNCTION | A Token of Only the Weights That Change the Raster
    // ------------------------------------------------------------
    // The underlay picture is keyed on this, not on Token below. A factor weight
    // thickens the VECTOR drawing and has no effect on a single pixel of the
    // render behind it, so letting it into the raster key would re-render a
    // multi-second supersampled underlay every time someone nudged a line weight.
    //
    // A PERCENT WEIGHT IS IN, though, alongside the pixel ones. It is a post pass
    // over the finished raster, so moving it changes every pixel of the stored
    // picture and the old one must not be handed back for it.
    //
    // forThreeD narrows it again for a 3D snapshot, to the weights a 3D picture
    // can actually show. A section outline width kept from when the viewport was
    // 2D changes nothing in a scene render, and letting it in would re-render and
    // re-upload a snapshot for no visible difference.
    // ------------------------------------------------------------
    function Na__LeComposite__RasterToken(viewport, forThreeD) {
        const stored = viewport ? viewport[Na__LeComposite__FIELD] : null;
        if (!stored) return '';
        const keys = Object.keys(stored).filter((key) => {
            const row = Na__LeComposite__Row(key);
            if (!row || (row.weight.kind !== 'pixels' && row.weight.kind !== 'percent')) return false;
            return !(forThreeD === true && (row.twoDOnly || row.weight.twoDOnly));
        }).sort();
        return keys.length === 0 ? '' : keys.map((key) => key + ':' + stored[key]).join('|');
    }
    // ------------------------------------------------------------


    // FUNCTION | A Stable Token for Cache Keys
    // ------------------------------------------------------------
    // Empty when nothing is overridden, so an untouched viewport keys exactly as
    // it did before this feature existed and its cached renders survive.
    // ------------------------------------------------------------
    function Na__LeComposite__Token(viewport) {
        const stored = viewport ? viewport[Na__LeComposite__FIELD] : null;
        if (!stored) return '';
        const keys = Object.keys(stored).sort();
        if (keys.length === 0) return '';
        return keys.map((key) => key + ':' + stored[key]).join('|');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Render Composites API
    // ------------------------------------------------------------
    export {
        Na__LeComposite__FIELD,
        Na__LeComposite__Ready,
        Na__LeComposite__Rows,
        Na__LeComposite__Row,
        Na__LeComposite__ToggleRows,
        Na__LeComposite__WeightRows,
        Na__LeComposite__Clamp,
        Na__LeComposite__Weight,
        Na__LeComposite__Factor,
        Na__LeComposite__IsOverridden,
        Na__LeComposite__RasterToken,
        Na__LeComposite__Token
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
