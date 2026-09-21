// =============================================================================
// TRUEVISION3D - PROJECTED LINEWORK - STOREYS
// =============================================================================
//
// FILE       : Na__ProjectedLinework__Storeys__.js
// NAMESPACE  : Na__PlStorey
// MODULE     : Projected Linework - Storeys
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Find the storey a floor plan is cut through, and keep its door swings to it
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - A plan is one storey of the building. The model knows its storeys: each
//   one arrives as the category groups named Storey__<Key>__<Element> - the
//   same groups the 3D view's storey toggle shows and hides. What no record
//   holds is how HIGH each storey is, so it is measured: a storey's floor is
//   where its doors stand (the median of their bottoms, so an odd door on a
//   step or a threshold does not move it).
// - THE CUT PICKS THE STOREY. A plan belongs to the storey with the highest
//   floor at or below its cut plane - the storey the plane actually passes
//   through, whatever the plan is called. Its band runs from just under its
//   own floor to just under the next floor up; the lowest storey's band runs
//   down for ever (ground falls away outside, and a lower terrace is still
//   the ground floor), the top storey's up for ever.
// - THE BAND KEEPS WHAT STANDS ON THE STOREY. A door swing, or a line drawn
//   flat on a floor, belongs to the storey whose band holds its height. The
//   tolerance lets a line sit a little under its storey's measured floor, or
//   down in a sunken area of it, and still belong to it.
// - WHY A BAND AND NOT THE CUT. The SketchUp LINETYPE linework - door swings
//   and clearances among it - is drawing data, so it is drawn uncut and
//   unclipped (v2.63.1), and it arrives as ONE GLB for the whole building
//   with no storey in its name. Its height is the only thing that says which
//   floor a line belongs to. The model's own door swings are cut, but a plan
//   with no view depth keeps everything below its cut, and a swing is added
//   after the occlusion clip, so the floor slab between cannot hide it.
// - FEWER THAN TWO FLOORS, NOTHING TO SEPARATE. A model with no Storey__
//   groups, or with only one storey that has doors, answers null, and every
//   drawing keeps what it drew before.
// - Pure: numbers in, numbers out, no scene access. The door pose module
//   measures the doors; the projector, the CPU backend and the door hit test
//   ask the questions.
//
// INTEGRATION:
// - Na__ProjectedLinework__DoorPose__ (StoreySamples feed Measure; the swing
//   append and the hit test keep to the band), Na__ProjectedLinework__Projector__
//   (measures the storeys once per collection), Na__ProjectedLinework__CpuBackend__
//   (keeps storey-bound annotation to the band).
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : n/a - authored in TrueVision3D
// - Back-port     : PENDING to ValeVision3D, on Adam's sign-off (rides with the
//                   pending plan doors port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Naming and Defaults
    // ------------------------------------------------------------
    const Na__PlStorey__CATEGORY_PREFIX   = 'Storey__';   // <-- Storey__<Key>__<Element>, as the storey toggle reads it
    const Na__PlStorey__KEY_END           = '__';
    const Na__PlStorey__TOLERANCE_DEFAULT = 0.5;          // <-- Scene units (metres): how far under its floor a line may sit
    const Na__PlStorey__LEVEL_EPSILON     = 1e-6;         // <-- A cut normal this close to vertical counts as a plan's
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Storey Keys
// -----------------------------------------------------------------------------

    // FUNCTION | The Storey Key in a Category Name (null for a category of no storey)
    // ------------------------------------------------------------
    // 'Storey__FirstFloor__ProposedDoors' answers 'FirstFloor'. Unanchored,
    // like the storey toggle's own match, so a prefixed name still answers.
    // ------------------------------------------------------------
    function Na__PlStorey__KeyOf(categoryName, prefix) {
        const name  = String(categoryName || '');
        const token = (typeof prefix === 'string' && prefix.length > 0) ? prefix : Na__PlStorey__CATEGORY_PREFIX;
        const at    = name.indexOf(token);
        if (at === -1) return null;
        const from = at + token.length;
        const end  = name.indexOf(Na__PlStorey__KEY_END, from);
        const key  = end === -1 ? '' : name.slice(from, end);
        return key.length > 0 ? key : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Storey Key as Words ('FirstFloor' reads 'First Floor')
    // ------------------------------------------------------------
    function Na__PlStorey__DisplayName(key) {
        return String(key || '').replace(/([a-z])([A-Z])/g, '$1 $2');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Measuring the Floors
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Median of Some Heights (sorts in place)
    // ------------------------------------------------------------
    function Na__PlStorey__Median(heights) {
        heights.sort((a, b) => a - b);
        const mid = heights.length >> 1;
        return (heights.length % 2 === 1) ? heights[mid] : (heights[mid - 1] + heights[mid]) / 2;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Building's Floors, From Where Each Storey's Doors Stand
    // ------------------------------------------------------------
    // samples: [{ Key, FloorUnits }], one per door - its storey key and the
    // scene height its bottom stands at. Returns { Floors, ToleranceUnits },
    // Floors ascending as [{ Keys, FloorUnits, Doors }], or null when fewer
    // than two floors are found. Two storeys whose floors lie closer than the
    // tolerance are one floor, with both keys.
    // ------------------------------------------------------------
    function Na__PlStorey__Measure(samples, toleranceUnits) {
        const tolerance = (Number.isFinite(toleranceUnits) && toleranceUnits >= 0) ? toleranceUnits : Na__PlStorey__TOLERANCE_DEFAULT;
        const byKey     = new Map();
        (Array.isArray(samples) ? samples : []).forEach((sample) => {
            if (!sample || typeof sample.Key !== 'string' || sample.Key.length === 0 || !Number.isFinite(sample.FloorUnits)) return;
            if (!byKey.has(sample.Key)) byKey.set(sample.Key, []);
            byKey.get(sample.Key).push(sample.FloorUnits);
        });

        const floors = [];
        byKey.forEach((heights, key) => floors.push({ Keys : [ key ], FloorUnits : Na__PlStorey__Median(heights), Doors : heights.length }));
        floors.sort((a, b) => a.FloorUnits - b.FloorUnits);

        const merged = [];
        floors.forEach((floor) => {
            const below = merged[merged.length - 1];
            if (below && (floor.FloorUnits - below.FloorUnits) < tolerance) {
                below.Keys  = below.Keys.concat(floor.Keys);
                below.Doors = below.Doors + floor.Doors;
                return;
            }
            merged.push(floor);
        });
        return merged.length >= 2 ? { Floors : merged, ToleranceUnits : tolerance } : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | A Plan's Storey
// -----------------------------------------------------------------------------

    // FUNCTION | The Index of the Highest Floor at or Below a Height
    // ------------------------------------------------------------
    // Anything below the lowest floor answers the lowest storey.
    // ------------------------------------------------------------
    function Na__PlStorey__IndexAt(storeys, height) {
        const floors = storeys ? storeys.Floors : null;
        if (!floors || floors.length === 0) return -1;
        let index = 0;
        for (let i = 1; i < floors.length; i++) {
            if (floors[i].FloorUnits <= height) index = i;
            else break;
        }
        return index;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Storey a Plan's Cut Passes Through, With Its Band
    // ------------------------------------------------------------
    // cut is a view definition's Cut. Only a plan's cut answers: level, with
    // the kept side below (normal straight down). Returns { Index, Keys,
    // FloorUnits, CutUnits, BottomUnits, TopUnits } or null - no storeys, or
    // not a plan - which keeps everything, exactly as before.
    // ------------------------------------------------------------
    function Na__PlStorey__ForCut(storeys, cut) {
        if (!storeys || !Array.isArray(storeys.Floors) || storeys.Floors.length < 2 || !cut) return null;
        const normalY = Number(cut.NormalY);
        if (!(normalY < 0) || Math.abs(Number(cut.NormalX) || 0) > Na__PlStorey__LEVEL_EPSILON || Math.abs(Number(cut.NormalZ) || 0) > Na__PlStorey__LEVEL_EPSILON) return null;
        const cutUnits = Number(cut.DistanceUnits) / normalY;                    // <-- The plane is n.p = d, so a level plane stands at d / ny
        if (!Number.isFinite(cutUnits)) return null;

        const floors    = storeys.Floors;
        const tolerance = storeys.ToleranceUnits;
        const index     = Na__PlStorey__IndexAt(storeys, cutUnits);
        return {
            Index       : index,
            Keys        : floors[index].Keys.slice(),
            FloorUnits  : floors[index].FloorUnits,
            CutUnits    : cutUnits,
            BottomUnits : index === 0 ? -Infinity : floors[index].FloorUnits - tolerance,
            TopUnits    : index === floors.length - 1 ? Infinity : floors[index + 1].FloorUnits - tolerance
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Whether a Height Stands on a Plan's Storey
    // ------------------------------------------------------------
    // No band keeps everything.
    // ------------------------------------------------------------
    function Na__PlStorey__Holds(band, height) {
        if (!band) return true;
        return height >= band.BottomUnits && height < band.TopUnits;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Band Said in Words, for the Console
    // ------------------------------------------------------------
    // 'First Floor (floor 4200 mm)'. unitsToMm converts a scene height.
    // ------------------------------------------------------------
    function Na__PlStorey__Describe(band, unitsToMm) {
        if (!band) return '';
        const toMm = (typeof unitsToMm === 'function') ? unitsToMm : ((units) => units * 1000);
        return band.Keys.map(Na__PlStorey__DisplayName).join(' / ') + ' (floor ' + Math.round(toMm(band.FloorUnits)) + ' mm)';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Storey-Bound Linework
// -----------------------------------------------------------------------------

    // FUNCTION | Mark the Owner Keys That Are Kept to a Storey
    // ------------------------------------------------------------
    // keys is an owner table's key list; tokens are matched case-insensitively
    // as substrings, like every other category token. Returns a Uint8Array
    // (1 = storey-bound) indexed by owner id, or null when no key is.
    // ------------------------------------------------------------
    function Na__PlStorey__MarkKeys(keys, tokens) {
        if (!Array.isArray(keys) || !Array.isArray(tokens) || tokens.length === 0) return null;
        const lowered = tokens.filter((token) => typeof token === 'string' && token.length > 0).map((token) => token.toLowerCase());
        const marks   = new Uint8Array(keys.length);
        let   any     = false;
        for (let i = 0; i < keys.length; i++) {
            const key = String(keys[i] || '').toLowerCase();
            if (key.length > 0 && lowered.some((token) => key.indexOf(token) !== -1)) { marks[i] = 1; any = true; }
        }
        return any ? marks : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Keep the Storey-Bound Edges That Stand on a Plan's Storey
    // ------------------------------------------------------------
    // edges: six scene space doubles per edge; owners: one owner id per edge.
    // An edge whose owner is marked is kept only while its middle stands in
    // the band; every other edge is kept. Returns { Edges, Owners, Dropped },
    // the same buffers when nothing is dropped.
    // ------------------------------------------------------------
    function Na__PlStorey__KeepEdges(edges, owners, marks, band) {
        const source = edges || new Float64Array(0);
        const count  = Math.floor(source.length / 6);
        if (!band || !marks || !owners || owners.length !== count) return { Edges : source, Owners : owners || null, Dropped : 0 };

        const keep = new Uint8Array(count);
        let   kept = 0;
        for (let i = 0; i < count; i++) {
            const id = owners[i];
            const on = !(id < marks.length && marks[id] === 1) || Na__PlStorey__Holds(band, (source[(i * 6) + 1] + source[(i * 6) + 4]) / 2);
            if (on) { keep[i] = 1; kept++; }
        }
        if (kept === count) return { Edges : source, Owners : owners, Dropped : 0 };

        const keptEdges  = new Float64Array(kept * 6);
        const keptOwners = new Uint16Array(kept);
        let   at = 0;
        for (let i = 0; i < count; i++) {
            if (keep[i] !== 1) continue;
            keptEdges.set(source.subarray(i * 6, (i * 6) + 6), at * 6);
            keptOwners[at++] = owners[i];
        }
        return { Edges : keptEdges, Owners : keptOwners, Dropped : count - kept };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Projected Linework Storeys API
    // ------------------------------------------------------------
    export {
        Na__PlStorey__CATEGORY_PREFIX,
        Na__PlStorey__TOLERANCE_DEFAULT,
        Na__PlStorey__KeyOf,
        Na__PlStorey__DisplayName,
        Na__PlStorey__Measure,
        Na__PlStorey__IndexAt,
        Na__PlStorey__ForCut,
        Na__PlStorey__Holds,
        Na__PlStorey__Describe,
        Na__PlStorey__MarkKeys,
        Na__PlStorey__KeepEdges
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
