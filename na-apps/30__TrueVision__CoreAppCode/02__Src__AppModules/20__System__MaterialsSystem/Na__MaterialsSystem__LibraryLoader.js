// =============================================================================
// TRUEVISION3D - MATERIALS SYSTEM - LIBRARY LOADER
// =============================================================================
//
// FILE       : Na__MaterialsSystem__LibraryLoader.js
// NAMESPACE  : Na__MaterialsSystem
// MODULE     : LibraryLoader
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Index the DataLib materials data and expose lookup utilities
// CREATED    : 23-Feb-2026
//
// DESCRIPTION:
// - Previously fetched Na__AppConfig__MaterialsLibrary.json directly. As of
//   v2.3.3 this module no longer owns the fetch. Data is supplied by the
//   centralised AppCore__DataLib__Loader module which downloads all DataLib
//   files from GitHub at startup.
// - Accepts the raw parsed DataLib JSON (keyed under
//   Na__DataLib__CoreIndex__Materials) and flattens the nested series
//   structure into a Map keyed by SketchUpName for O(1) lookups.
// - Provides a regex-based helper for indexed material name detection.
//
// -----
//
// DEVELOPMENT LOG:
// 06-Jun-2026 - Version 2.0.0
// - Removed Na__MaterialsSystem__LoadLibrary() and session-cache state.
// - Updated Na__MaterialsSystem__BuildLookup() root key from
//   Na__AppConfig__MaterialsLibrary to Na__DataLib__CoreIndex__Materials.
// - Data is now supplied by AppCore__DataLib__Loader.js via
//   Na__DataLib__GetMaterials(). No fetch logic remains in this module.
//
// 23-Feb-2026 - Version 1.0.0
// - Initial implementation with URL fetch, index build, and lookup helpers.
//
// =============================================================================


// #Region ---
// REGION | Module Constants
// -----

    // MODULE CONSTANTS | Indexed Material Name Pattern
    // ------------------------------------------------------------
    const Na__MaterialsSystem__IndexedNameRegex = /^MAT\d{3}__/;              // <-- Matches MAT + 3 digits + __
    // ------------------------------------------------------------

// endregion ----


// #Region ---
// REGION | Module State (Session Cache)
// -----

    // MODULE VARIABLES | Cached Lookup Map
    // ------------------------------------------------------------
    let Na__MaterialsSystem__CachedLookupMap = null;                          // <-- Flattened Map<SketchUpName, Config>
    // ------------------------------------------------------------

// endregion ----


// #Region ---
// REGION | Lookup Map Builder
// -----

    // FUNCTION | Build Flat Lookup Map from DataLib Materials Data
    // ------------------------------------------------------------
    // Accepts the full DataLib JSON object (returned by
    // Na__DataLib__GetMaterials()). Flattens the nested series structure
    // under the Na__DataLib__CoreIndex__Materials root key into a single
    // Map keyed by SketchUpName for O(1) lookups. Skips the default
    // material entry. Caches the result for the session.
    // ------------------------------------------------------------
    function Na__MaterialsSystem__BuildLookup(libraryData, forceRebuild = false) {
        if (Na__MaterialsSystem__CachedLookupMap && !forceRebuild) {
            return Na__MaterialsSystem__CachedLookupMap;                      // <-- Return cached map
        }

        const lookupMap = new Map();                                          // <-- SketchUpName -> MaterialConfig

        if (!libraryData || !libraryData.Na__DataLib__CoreIndex__Materials) {
            console.warn('[MaterialsSystem] No DataLib materials data to index — check that AppCore__DataLib__Loader has completed.');
            return lookupMap;
        }

        const library = libraryData.Na__DataLib__CoreIndex__Materials;       // <-- Root library object

        for (const seriesKey of Object.keys(library)) {
            const series = library[seriesKey];                                // <-- e.g. MAT100__BasicSeries__

            if (typeof series !== 'object' || series === null) continue;

            for (const materialKey of Object.keys(series)) {
                const config = series[materialKey];                           // <-- Individual material config

                if (!config || typeof config !== 'object') continue;
                if (config.IsDefault) continue;                               // <-- Skip default fallback entry

                const sketchUpName = config.SketchUpName;                    // <-- Lookup key
                if (!sketchUpName) continue;                                  // <-- Guard against missing name

                lookupMap.set(sketchUpName, config);                          // <-- Index by SketchUpName
            }
        }

        Na__MaterialsSystem__CachedLookupMap = lookupMap;                    // <-- Cache the built map

        console.log(`[MaterialsSystem] Lookup map built: ${lookupMap.size} indexed materials`);
        return lookupMap;
    }
    // ------------------------------------------------------------

// endregion ----


// #Region ---
// REGION | Utility Functions
// -----

    // HELPER FUNCTION | Check If Material Name Is Indexed
    // ------------------------------------------------------------
    // Returns true if the name matches the MAT{NNN}__ pattern,
    // indicating it should be looked up in the materials library.
    // ------------------------------------------------------------
    function Na__MaterialsSystem__IsIndexedName(materialName) {
        if (!materialName || typeof materialName !== 'string') return false;
        return Na__MaterialsSystem__IndexedNameRegex.test(materialName);      // <-- Test against regex
    }
    // ------------------------------------------------------------

// endregion ----


// #Region ---
// REGION | Module Exports
// -----

    // MODULE EXPORTS | Materials Library Loader API
    // ------------------------------------------------------------
    export {
        Na__MaterialsSystem__BuildLookup,
        Na__MaterialsSystem__IsIndexedName
    };
    // ------------------------------------------------------------

// endregion ----
