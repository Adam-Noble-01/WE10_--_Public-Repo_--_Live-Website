// =============================================================================
// TRUEVISION3D - DOOR GROUP FINDER UTILITY
// =============================================================================
//
// FILE       : Na__DoorAnimation__FindDoorGroups.js
// NAMESPACE  : Na__DoorAnimation
// MODULE     : FindDoorGroups
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Shared utility to locate door model groups under a scene root
// CREATED    : 27-Feb-2026
//
// DESCRIPTION:
// - Searches the direct children of a modelRoot THREE.Group for category groups
//   whose names contain any of the configured door category tokens (e.g.
//   "ProposedDoors"). For each matching category group it then reads the
//   userData.Na__ModelType tag on the group's children to separate mesh and
//   linework roots — identical to the logic used by Na__CollectDoorModelGroups
//   in the main loading sequence.
// - Accepts modelRoot (Na__ModelGroup__Root) directly so it works for both
//   flat-export and storey-export scene structures without assumptions about
//   node naming or child ordering.
//
// -----
//
// DEVELOPMENT LOG:
// 06-Jun-2026 - Version 1.1.0
// - Rewritten to use two-level traversal (modelRoot → categoryGroup → mesh/
//   linework root) matching Na__CollectDoorModelGroups in LoadingSequence.
// - Now reads userData.Na__ModelType instead of relying on name substrings,
//   making it robust for both TrueVision__ (flat) and Storey__ (storey) GLBs.
// - Old single-level name-substring approach only worked when called with the
//   category group itself as root; new version is called with modelRoot.
//
// 27-Feb-2026 - Version 1.0.0
// - Initial release.
//
// =============================================================================


// #Region ---
// REGION | Door Group Finder
// -----

    const Na__DoorAnimation__DefaultCategoryNameTokens = ['ProposedDoors', 'ExistingDoors'];


    // HELPER FUNCTION | Normalize Door Category Tokens
    // ------------------------------------------------------------
    function Na__DoorAnimation__NormalizeCategoryTokens(categoryNameTokens) {
        if (!Array.isArray(categoryNameTokens)) return Na__DoorAnimation__DefaultCategoryNameTokens;

        const normalizedTokens = categoryNameTokens
            .filter((token) => typeof token === 'string')
            .map((token) => token.trim())
            .filter((token) => token.length > 0);

        return normalizedTokens.length > 0 ? normalizedTokens : Na__DoorAnimation__DefaultCategoryNameTokens;
    }
    // ------------------------------------------------------------


    // FUNCTION | Find All Door Mesh/Linework Roots Under a Model Root Group
    // ------------------------------------------------------------
    // Accepts modelRoot (the scene root THREE.Group that contains all loaded
    // category groups). Iterates direct children to find category groups whose
    // names include a door category token, then reads userData.Na__ModelType
    // on each category group's children to split them into mesh and linework
    // arrays. This matches the production logic in Na__CollectDoorModelGroups
    // (Na__AppFlow__LoadingSequence.js) and works for both flat and storey GLBs.
    //
    // @param modelRoot           {THREE.Group}   Na__ModelGroup__Root
    // @param categoryNameTokens  {string[]}      Tokens to match (default: ProposedDoors, ExistingDoors)
    // @return {{ meshGroups: THREE.Group[], lineworkGroups: THREE.Group[] }}
    // ------------------------------------------------------------
    function Na__DoorAnimation__FindDoorGroups(modelRoot, categoryNameTokens = Na__DoorAnimation__DefaultCategoryNameTokens) {
        const meshGroups       = [];
        const lineworkGroups   = [];
        const normalizedTokens = Na__DoorAnimation__NormalizeCategoryTokens(categoryNameTokens);

        if (!modelRoot || !Array.isArray(modelRoot.children)) return { meshGroups, lineworkGroups };

        for (const categoryGroup of modelRoot.children) {
            const categoryName  = categoryGroup.name || '';
            const isDoorCategory = normalizedTokens.some((token) => categoryName.includes(token));
            if (!isDoorCategory) continue;

            for (const child of (categoryGroup.children || [])) {
                const modelType = child.userData && child.userData.Na__ModelType;
                if (modelType === 'mesh')     meshGroups.push(child);
                if (modelType === 'linework') lineworkGroups.push(child);
            }
        }

        return { meshGroups, lineworkGroups };
    }
    // ------------------------------------------------------------

// endregion ----


// #Region ---
// REGION | Module Exports
// -----

    export { Na__DoorAnimation__FindDoorGroups };

// endregion ----
