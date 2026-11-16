// =============================================================================
// TRUEVISION3D - MODEL LOADER - LOAD PLAN
// =============================================================================
//
// FILE       : Na__ModelLoader__LoadPlan__.js
// NAMESPACE  : Na__LoadPlan
// MODULE     : ModelLoader - Load Plan
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Which model categories load first, and the order they sit under the model root
// CREATED    : 15-Nov-2026
//
// DESCRIPTION:
// - A design phase is some dozens of GLB pairs (mesh and linework), one pair per
//   category: Storey__GroundFloor__ProposedWalls, TrueVision__LandscapeEnvironment
//   and so on. They are not equally heavy and not equally needed: the walls,
//   roofs, landscape and doors are the building, and a few megabytes; the
//   fixtures, then the furniture, then the interior decor are most of the bytes.
// - This module answers two separate questions about a phase's categories and
//   never mixes them up:
//     ATTACH ORDER  the order the category groups sit under the model root. It
//                   is exactly the order the loader always produced (the
//                   Na__ModelCategories__LoadOrder list first, then the rest in
//                   project order), because the model fingerprint hashes the
//                   categories in that order and every stored drawing and sheet
//                   picture is keyed by it. Changing it would re-key them all.
//     LOAD STAGES   the order the files are FETCHED and built: the building
//                   first, then each heavier tier. Only this is new.
// - Pure: no imports, no DOM, no three.js. The Node test reads it as it stands.
//
// INTEGRATION:
// - Na__ModelLoader__MultiModel.js builds a plan for every load.
// - The tiers and the staged-load settings come from the app config's
//   models.ModelLoading block; the copy below is the fallback.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (15-Nov-2026)
// - ValeVision    : not yet ported.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 15-Nov-2026 - Version 1.0.0 (v2.186.0)
// - Initial implementation, for the staged model load and the Existing and
//   Proposed comparison.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Loading Tiers (fallback - the app config overrides)
    // ------------------------------------------------------------
    // A category belongs to the first tier that names its element. A token
    // ending in "__" is looked for in the whole category key (the Linetype__
    // family); every other token in the element, which is the key's last part
    // with Existing or Proposed taken off the front. A category no tier names
    // loads with the first tier: the building must be whole at first sight.
    // ------------------------------------------------------------
    const Na__LoadPlan__DEFAULT_TIERS = [
        { name : 'Architecture',    label : 'the building',         tokens : [ 'Walls', 'Roofs', 'LandscapeEnvironment', 'SiteBoundaries', 'Doors', 'Floors', 'Windows', 'Stairs' ] },
        { name : 'Fixtures',        label : 'fixtures',             tokens : [ 'Fixtures' ] },
        { name : 'Furniture',       label : 'furniture',            tokens : [ 'Furniture' ] },
        { name : 'InteriorDecor',   label : 'interior decor',       tokens : [ 'Decor' ] },
        { name : 'Context',         label : 'planting and context', tokens : [ 'Vegetation', 'SceneContextual' ] },
        { name : 'DrawingLinework', label : 'drawing linework',     tokens : [ 'Linetype__' ] }
    ];
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Staged-Load Defaults
    // ------------------------------------------------------------
    const Na__LoadPlan__DEFAULT_FILES_IN_FLIGHT = 6;      // <-- Category pairs fetched at once is half of this: a pair is two files
    const Na__LoadPlan__MAX_FILES_IN_FLIGHT     = 16;
    const Na__LoadPlan__ELEMENT_PREFIXES        = [ 'Existing', 'Proposed' ];
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Settings
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One Tier From a Config Record (null when it names nothing)
    // ------------------------------------------------------------
    function Na__LoadPlan__ReadTier(record) {
        if (!record || typeof record !== 'object') return null;
        const name   = String(record.ModelLoading__Tier__Name || record.name || '').trim();
        const label  = String(record.ModelLoading__Tier__StatusLabel || record.label || name).trim();
        const source = Array.isArray(record.ModelLoading__Tier__ElementTokens) ? record.ModelLoading__Tier__ElementTokens : record.tokens;
        const tokens = (Array.isArray(source) ? source : [])
            .filter((token) => typeof token === 'string')
            .map((token) => token.trim())
            .filter((token) => token.length > 0);
        if (!name || tokens.length === 0) return null;
        return { name : name, label : label || name, tokens : tokens };
    }
    // ------------------------------------------------------------


    // FUNCTION | Resolve the Staged-Load Settings From the Models Config
    // ------------------------------------------------------------
    // modelsConfig is the app config's models block; its ModelLoading block is
    // optional and every value has a fallback, so a config without it loads
    // staged with the tiers above.
    //
    // Returns {
    //   enabled               false loads one category after another, as before
    //   filesInFlight         files being fetched at once
    //   tiers                 [ { name, label, tokens } ] in loading order
    //   revealAfterTier       the tier whose arrival shows the model to a reader
    //                         (null: only when everything is in)
    //   revealEarlyWhenAuthoring  an author waits for the whole model unless true
    //   preloadCounterpart    load the other half of Existing / Proposed in the
    //                         background once the 3D view's model is in
    //   preloadMinMemoryGb    not on a device reporting less memory than this
    //   minCachedPhases       design phases the phase library may keep loaded
    // }
    // ------------------------------------------------------------
    function Na__LoadPlan__ResolveSettings(modelsConfig) {
        const block = (modelsConfig && typeof modelsConfig.ModelLoading === 'object' && modelsConfig.ModelLoading) || {};

        const tiers = (Array.isArray(block.ModelLoading__Tiers) ? block.ModelLoading__Tiers : [])
            .map(Na__LoadPlan__ReadTier)
            .filter(Boolean);

        const inFlight = Number(block.ModelLoading__Staged__FilesInFlight);
        const memory   = Number(block.ModelLoading__Compare__PreloadMinDeviceMemoryGb);
        const cached   = Number(block.ModelLoading__Compare__MinCachedPhases);
        const reveal   = block.ModelLoading__Staged__RevealAfterTier;

        const resolvedTiers = tiers.length > 0 ? tiers : Na__LoadPlan__DEFAULT_TIERS.map((tier) => ({ name : tier.name, label : tier.label, tokens : tier.tokens.slice() }));

        return {
            enabled                  : block.ModelLoading__Staged__Enabled !== false,
            filesInFlight            : (Number.isFinite(inFlight) && inFlight >= 1) ? Math.min(Na__LoadPlan__MAX_FILES_IN_FLIGHT, Math.floor(inFlight)) : Na__LoadPlan__DEFAULT_FILES_IN_FLIGHT,
            tiers                    : resolvedTiers,
            revealAfterTier          : (reveal === null || reveal === false) ? null : String(reveal || resolvedTiers[0].name),
            revealEarlyWhenAuthoring : block.ModelLoading__Staged__RevealEarlyWhenAuthoring === true,
            preloadCounterpart       : block.ModelLoading__Compare__PreloadCounterpart !== false,
            preloadMinMemoryGb       : (Number.isFinite(memory) && memory >= 0) ? memory : 4,
            minCachedPhases          : (Number.isFinite(cached) && cached >= 1) ? Math.floor(cached) : 2
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Classification
// -----------------------------------------------------------------------------

    // FUNCTION | A Category's Element: Its Last Part, Without Existing or Proposed
    // ------------------------------------------------------------
    // "Storey__GroundFloor__ProposedWalls" -> "Walls"
    // "TrueVision__MainBuildingModel__Existing" -> "" (the massing itself)
    // "TrueVision__GroundFloorFurniture" -> "GroundFloorFurniture"
    // ------------------------------------------------------------
    function Na__LoadPlan__ElementOf(categoryKey) {
        const parts = String(categoryKey || '').split('__').filter((part) => part.length > 0);
        let element = parts.length > 0 ? parts[parts.length - 1] : '';
        for (let i = 0; i < Na__LoadPlan__ELEMENT_PREFIXES.length; i++) {
            const prefix = Na__LoadPlan__ELEMENT_PREFIXES[i];
            if (element.indexOf(prefix) === 0) { element = element.slice(prefix.length); break; }
        }
        return element;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Tier a Category Loads In, and Its Place Within It
    // ------------------------------------------------------------
    // Returns { tier, rank }: tier is an index into tiers, rank the index of
    // the token that claimed it (walls before roofs before doors). A category
    // nothing claims is the first tier's, after everything it names.
    // ------------------------------------------------------------
    function Na__LoadPlan__TierOf(categoryKey, tiers) {
        const key     = String(categoryKey || '').toLowerCase();
        const element = Na__LoadPlan__ElementOf(categoryKey).toLowerCase();
        const list    = Array.isArray(tiers) ? tiers : [];

        // WHOLE-KEY TOKENS FIRST. "TrueVision__Linetype__DoorSwings" ends in an
        // element a building tier names (Door...), and it is drawing linework.
        for (let t = 0; t < list.length; t++) {
            for (let k = 0; k < list[t].tokens.length; k++) {
                const token = list[t].tokens[k].toLowerCase();
                if (token.slice(-2) === '__' && key.indexOf(token) !== -1) return { tier : t, rank : k };
            }
        }
        for (let t = 0; t < list.length; t++) {
            for (let k = 0; k < list[t].tokens.length; k++) {
                const token = list[t].tokens[k].toLowerCase();
                if (token.slice(-2) !== '__' && element.length > 0 && element.indexOf(token) !== -1) return { tier : t, rank : k };
            }
        }
        return { tier : 0, rank : list.length > 0 ? list[0].tokens.length : 0 };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Plan
// -----------------------------------------------------------------------------

    // FUNCTION | The Order Category Groups Sit Under the Model Root
    // ------------------------------------------------------------
    // The categories the priority list names, in its order, then every other
    // category in the order it was first met in the project's file list. This
    // is the order the loader has always attached them in. DO NOT CHANGE IT:
    // the model fingerprint hashes the categories in this order.
    // ------------------------------------------------------------
    function Na__LoadPlan__AttachOrder(categoryKeys, priorityOrder) {
        const keys     = Array.isArray(categoryKeys) ? categoryKeys : [];
        const priority = Array.isArray(priorityOrder) ? priorityOrder : [];
        const present  = new Set(keys);
        const ordered  = [];
        const taken    = new Set();

        for (let i = 0; i < priority.length; i++) {
            if (present.has(priority[i]) && !taken.has(priority[i])) { ordered.push(priority[i]); taken.add(priority[i]); }
        }
        for (let i = 0; i < keys.length; i++) {
            if (!taken.has(keys[i])) { ordered.push(keys[i]); taken.add(keys[i]); }
        }
        return ordered;
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Plan for One Design Phase
    // ------------------------------------------------------------
    // categoryKeys in the order the project's file list first names them.
    //
    // Returns {
    //   attachOrder  every category, in the order its group sits under the root
    //   stages       [ { index, name, label, keys } ] in loading order; a tier
    //                with no category in this phase is left out, and index
    //                counts only the stages that remain
    //   tierOf       { categoryKey : stage index }
    // }
    // ------------------------------------------------------------
    function Na__LoadPlan__Build(categoryKeys, priorityOrder, tiers) {
        const attachOrder = Na__LoadPlan__AttachOrder(categoryKeys, priorityOrder);
        const list        = (Array.isArray(tiers) && tiers.length > 0) ? tiers : Na__LoadPlan__DEFAULT_TIERS;
        const buckets     = list.map(() => []);

        attachOrder.forEach((key, position) => {
            const place = Na__LoadPlan__TierOf(key, list);
            buckets[place.tier].push({ key : key, rank : place.rank, position : position });
        });

        const stages = [];
        const tierOf = {};
        buckets.forEach((bucket, tierIndex) => {
            if (bucket.length === 0) return;
            bucket.sort((a, b) => (a.rank - b.rank) || (a.position - b.position));   // <-- Walls, then roofs, then landscape, then doors; ties keep the attach order
            const index = stages.length;
            stages.push({ index : index, name : list[tierIndex].name, label : list[tierIndex].label, keys : bucket.map((item) => item.key) });
            bucket.forEach((item) => { tierOf[item.key] = index; });
        });

        return { attachOrder : attachOrder, stages : stages, tierOf : tierOf };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Load Plan API
    // ------------------------------------------------------------
    export {
        Na__LoadPlan__DEFAULT_TIERS,
        Na__LoadPlan__ResolveSettings,
        Na__LoadPlan__ElementOf,
        Na__LoadPlan__TierOf,
        Na__LoadPlan__AttachOrder,
        Na__LoadPlan__Build
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
