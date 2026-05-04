// =============================================================================
// TRUEVISION3D - DOOR GROUP FINDER UTILITY
// =============================================================================
//
// FILE       : Na__DoorAnimation__FindDoorGroups.js
// NAMESPACE  : Na__DoorAnimation
// MODULE     : FindDoorGroups
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Shared utility to locate door model groups in a scene graph
// CREATED    : 27-Feb-2026
//
// DESCRIPTION:
// - Searches direct children of a root THREE.Group for groups whose names
//   contain configured door category tokens, splitting them into mesh and
//   linework arrays.
// - Used by both the main app loading sequence and the test environment to
//   avoid duplicating the same door-finding pattern in multiple places.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Door Group Finder
// -----------------------------------------------------------------------------

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

    // FUNCTION | Find All Door Model Groups Under a Root Group
    // ------------------------------------------------------------
    function Na__DoorAnimation__FindDoorGroups(rootGroup, categoryNameTokens = Na__DoorAnimation__DefaultCategoryNameTokens) {
        const meshGroups     = [];
        const lineworkGroups = [];
        const normalizedTokens = Na__DoorAnimation__NormalizeCategoryTokens(categoryNameTokens);

        if (!rootGroup || !rootGroup.children) return { meshGroups, lineworkGroups };

        for (const child of rootGroup.children) {
            const name = child.name || '';
            const isDoorCategoryGroup = normalizedTokens.some((token) => name.includes(token));
            if (!isDoorCategoryGroup) continue;

            if (name.includes('Mesh'))     meshGroups.push(child);
            if (name.includes('Linework')) lineworkGroups.push(child);
        }

        return { meshGroups, lineworkGroups };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    export { Na__DoorAnimation__FindDoorGroups };

// endregion -------------------------------------------------------------------
