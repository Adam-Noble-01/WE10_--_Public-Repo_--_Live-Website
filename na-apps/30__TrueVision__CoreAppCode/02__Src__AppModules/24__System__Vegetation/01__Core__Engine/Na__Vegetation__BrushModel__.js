// =============================================================================
// TRUEVISION3D - VEGETATION - BRUSH MODEL
// =============================================================================
//
// FILE       : Na__Vegetation__BrushModel__.js
// NAMESPACE  : Na__VegBrush
// MODULE     : System - Vegetation
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The sums behind mixing plants: drawing an asset from a palette by its
//              probability, keeping plants apart, and making one brushed plant's record
// CREATED    : 04-Nov-2026
//
// DESCRIPTION:
// - Adam, 04-Nov-2026: "creates a pallette and you can assign proibability for the items
//   in the selection so you can mix and match and brush the vegetation."
// - A WEIGHT IS NOT A PERCENTAGE UNTIL IT IS SHOWN. Items keep whatever numbers they were
//   given, and the share of each is its weight over the total, so one slider can move
//   without the others having to.
// - NO THREE.JS AND NO PAGE, like the rest of this folder, so the draws can be counted in
//   Node: weights hold over a thousand draws, and spacing holds.
//
// FRAMES:
// - Integer mm in three.js axes, as every saved value is. Only X and Z are read for
//   spacing: plants a storey apart are not neighbours, and the caller says so.
//
// INTEGRATION:
// - Used by ./Na__Vegetation__PathModel__.js and ../20__System__Tools/Na__Vegetation__BushTool__.js.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 24__System__Vegetation/01__Core__Engine/Na__Vegetation__BrushModel__.js (ValeVision3D v2.98.6)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : identical (header, console prefix and the Entourage folder's number apart)
// - Divergences   : none in behaviour. Entourage is 28__System__Entourage in TrueVision (its 23
//                   is Scene Sync); the vegetation and entourage READMEs list what differs around it.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 04-Nov-2026 - Version 1.1.0 (ValeVision3D v2.86.0)
// - A brushed plant saves the brush's plant scale times its palette item's, with no draw changed.
//
// 04-Nov-2026 - Version 1.0.0 (ValeVision3D v2.85.0)
// - Initial build: Stage 6 of ValeVision__PLAN__VegetationSystem__.md.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Drawing from a Palette
// -----------------------------------------------------------------------------

    // FUNCTION | Each Item's Share of a Palette, as a Percentage
    // ------------------------------------------------------------
    // items: [{ weight }]. All at nothing gives even shares, which is what such a
    // palette would draw.
    // ------------------------------------------------------------
    function Na__VegBrush__SharesOf(items) {
        let total = 0;
        items.forEach((item) => { total += Math.max(0, item.weight || 0); });
        return items.map((item) => (total > 0 ? (Math.max(0, item.weight || 0) / total) * 100 : 100 / Math.max(1, items.length)));
    }
    // ------------------------------------------------------------


    // FUNCTION | Draw One Item by Its Weight
    // ------------------------------------------------------------
    // r is a number from 0 up to but not including 1, from the caller's seeded
    // generator, so the same seed draws the same item. Null from an empty palette.
    // ------------------------------------------------------------
    function Na__VegBrush__DrawItem(items, r) {
        if (!items || items.length === 0) return null;
        let total = 0;
        items.forEach((item) => { total += Math.max(0, item.weight || 0); });
        if (total <= 0) return items[Math.min(items.length - 1, Math.floor(r * items.length))];
        let left = r * total;
        for (let i = 0; i < items.length; i++) {
            left -= Math.max(0, items[i].weight || 0);
            if (left < 0) return items[i];
        }
        return items[items.length - 1];
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Keeping Plants Apart
// -----------------------------------------------------------------------------

    // FUNCTION | A Grid That Answers "Is Anything Too Close to Here?"
    // ------------------------------------------------------------
    // Without it every candidate would be checked against every plant, and a stroke
    // over a thousand of them would stutter. minMm may differ from call to call, so the
    // search reaches as many cells as it needs.
    // ------------------------------------------------------------
    function Na__VegBrush__CreateSpacing(cellMm) {
        const cell  = Math.max(50, cellMm || 500);
        const cells = new Map();
        const keyOf = (ix, iz) => ix + ':' + iz;

        function add(x, y, z) {
            const key = keyOf(Math.floor(x / cell), Math.floor(z / cell));
            if (!cells.has(key)) cells.set(key, []);
            cells.get(key).push(x, y, z);
        }

        function isFree(x, y, z, minMm, reachYMm) {
            const reach = Math.ceil(minMm / cell);
            const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
            const minSq = minMm * minMm;
            for (let ix = cx - reach; ix <= cx + reach; ix++) {
                for (let iz = cz - reach; iz <= cz + reach; iz++) {
                    const list = cells.get(keyOf(ix, iz));
                    if (!list) continue;
                    for (let k = 0; k < list.length; k += 3) {
                        if (Math.abs(list[k + 1] - y) > reachYMm) continue;    // <-- Another storey is not a neighbour
                        const dx = list[k] - x, dz = list[k + 2] - z;
                        if (dx * dx + dz * dz < minSq) return false;
                    }
                }
            }
            return true;
        }

        return { add, isFree };
    }
    // ------------------------------------------------------------


    // FUNCTION | An Even Spot in a Disc, Offset from Its Centre
    // ------------------------------------------------------------
    function Na__VegBrush__SpotInDisc(rng, radiusMm) {
        const angle = rng.angle();
        const r     = Math.sqrt(rng.next()) * radiusMm;                        // <-- The root keeps it even: otherwise the centre crowds
        return { dx : Math.cos(angle) * r, dz : Math.sin(angle) * r };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | One Brushed Plant
// -----------------------------------------------------------------------------

    // FUNCTION | Make the Saved Record of One Brushed Plant
    // ------------------------------------------------------------
    // item: { assetId, scale, recipe }. brush: the tool's block. point: [x, y, z] in mm.
    // Scale variation changes the plant's size and never its scallops: the builder fits
    // centres, not radii, so the line language holds. Plant scale is the whole plant.
    // ------------------------------------------------------------
    function Na__VegBrush__MakePlop(item, point, brush, rng, uid, strokeUid) {
        const size  = item.recipe.Asset__Size;
        const vary  = (brush.Vegetation__Brush__ScaleVariationPercent || 0) / 100;
        const scale = 1 + rng.range(-vary, vary);
        const turn  = brush.Vegetation__Brush__RotationVariationDeg || 0;
        const zoom  = (brush.Vegetation__Brush__PlantScale > 0 ? brush.Vegetation__Brush__PlantScale : 1) * (item.scale > 0 ? item.scale : 1);
        const plop  = {
            Vegetation__Plop__Uid        : uid,
            Vegetation__Plop__AssetId    : item.assetId,
            Vegetation__Plop__Seed       : Math.floor(rng.next() * 1000000000),
            Vegetation__Plop__PositionMm : point.map(Math.round),
            Vegetation__Plop__YawDeg     : Math.round(rng.range(-turn, turn)),
            Vegetation__Plop__SizeMm     : [size.Size__WidthMm, size.Size__DepthMm, size.Size__HeightMm].map((mm) => Math.round(mm * scale)),
            Vegetation__Plop__StrokeUid  : strokeUid
        };
        if (zoom !== 1) plop.Vegetation__Plop__Scale = Math.round(zoom * 1000) / 1000;
        return plop;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Brush Model API
    // ------------------------------------------------------------
    export {
        Na__VegBrush__SharesOf,
        Na__VegBrush__DrawItem,
        Na__VegBrush__CreateSpacing,
        Na__VegBrush__SpotInDisc,
        Na__VegBrush__MakePlop
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
