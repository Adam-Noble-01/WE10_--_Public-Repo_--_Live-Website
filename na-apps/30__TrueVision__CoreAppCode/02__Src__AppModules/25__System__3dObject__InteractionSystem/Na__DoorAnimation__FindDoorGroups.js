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
//   contain "ProposedDoors", splitting them into mesh and linework arrays.
// - Used by both the main app loading sequence and the test environment to
//   avoid duplicating the same door-finding pattern in multiple places.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Door Group Finder
// -----------------------------------------------------------------------------

    // FUNCTION | Find All Door Model Groups Under a Root Group
    // ------------------------------------------------------------
    function Na__DoorAnimation__FindDoorGroups(rootGroup) {
        const meshGroups     = [];
        const lineworkGroups = [];

        if (!rootGroup || !rootGroup.children) return { meshGroups, lineworkGroups };

        for (const child of rootGroup.children) {
            const name = child.name || '';
            if (!name.includes('ProposedDoors')) continue;

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
