// =============================================================================
// TRUEVISION3D - BUILDING STOREY ISOLATE SYSTEM
// =============================================================================
//
// FILE       : 3dObject__IsolateBuildingStoreys__SystemLogic__.js
// NAMESPACE  : TrueVision3D
// MODULE     : 3D Object View Systems - Single Floor Isolation
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Isolate one storey at a time while forcing roofs off
//
// DESCRIPTION:
// - Thin wrapper around the existing Storey System.
// - Reuses detected storey order and naming.
// - Enforces single-storey visibility for isolate actions.
// - Forces roof mode OFF while isolating (dolls house roof behavior).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Existing Storey System API
    // ------------------------------------------------------------
    import {
        Na__StoreySystem__GetState,
        Na__StoreySystem__SetStoreyVisibility,
        Na__StoreySystem__ToggleRoof,
        Na__StoreySystem__ShowAll,
        Na__StoreySystem__GetStoreyDisplayName
    } from './3dObject__ViewBuildingStoreys__SystemLogic__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Landscape Visibility Cache During Isolate
    // ------------------------------------------------------------
    let Na__StoreyIsolate__LandscapeVisibilityCache = null;                       // <-- Map<uuid, visible>
    // ------------------------------------------------------------


    // HELPER FUNCTION | Resolve Model Root from Storey State
    // ------------------------------------------------------------
    function Na__StoreyIsolate__GetModelRootFromState(state) {
        if (!state || !state.map) return null;

        for (const storeyKey of Object.keys(state.map)) {
            const models = state.map[storeyKey];
            if (!models || models.length === 0) continue;
            const firstModel = models[0];
            if (firstModel && firstModel.parent) {
                return firstModel.parent;
            }
        }
        return null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Collect Landscape Groups from Model Root
    // ------------------------------------------------------------
    function Na__StoreyIsolate__CollectLandscapeGroups(modelRoot) {
        if (!modelRoot || !modelRoot.children) return [];

        return modelRoot.children.filter((child) => {
            const name = child && child.name ? child.name : '';
            return /Landscape/i.test(name);
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Cache and Force Landscape Off
    // ------------------------------------------------------------
    function Na__StoreyIsolate__CacheAndHideLandscape(state) {
        const modelRoot = Na__StoreyIsolate__GetModelRootFromState(state);
        const landscapeGroups = Na__StoreyIsolate__CollectLandscapeGroups(modelRoot);

        Na__StoreyIsolate__LandscapeVisibilityCache = new Map();
        for (const group of landscapeGroups) {
            Na__StoreyIsolate__LandscapeVisibilityCache.set(group.uuid, group.visible);
            group.visible = false;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Restore Landscape to Pre-Isolate State
    // ------------------------------------------------------------
    function Na__StoreyIsolate__RestoreLandscape(state) {
        if (!Na__StoreyIsolate__LandscapeVisibilityCache) return;

        const modelRoot = Na__StoreyIsolate__GetModelRootFromState(state);
        const landscapeGroups = Na__StoreyIsolate__CollectLandscapeGroups(modelRoot);

        for (const group of landscapeGroups) {
            if (!Na__StoreyIsolate__LandscapeVisibilityCache.has(group.uuid)) continue;
            group.visible = Na__StoreyIsolate__LandscapeVisibilityCache.get(group.uuid);
        }

        Na__StoreyIsolate__LandscapeVisibilityCache = null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Initialize Isolate System (Storey System Must Already Be Ready)
    // ------------------------------------------------------------
    function Na__StoreyIsolate__Initialize() {
        const state = Na__StoreySystem__GetState();
        return !!(state && state.hasStoreys);
    }
    // ------------------------------------------------------------


    // FUNCTION | Isolate a Single Storey (All Other Storeys Hidden)
    // ------------------------------------------------------------
    function Na__StoreyIsolate__IsolateSingleStorey(storeyKey) {
        const state = Na__StoreySystem__GetState();
        if (!state || !state.hasStoreys) return false;
        if (!state.order.includes(storeyKey)) return false;

        // Force roof mode OFF for isolate behavior.
        if (state.roofVisible) {
            Na__StoreySystem__ToggleRoof();
        }

        Na__StoreyIsolate__CacheAndHideLandscape(state);

        for (const key of state.order) {
            Na__StoreySystem__SetStoreyVisibility(key, key === storeyKey);
        }

        const displayName = Na__StoreySystem__GetStoreyDisplayName(storeyKey);
        console.log(`[Storey Isolate] Isolated ${displayName} (roofs + landscape off)`);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Exit Isolate and Show Entire Building
    // ------------------------------------------------------------
    function Na__StoreyIsolate__ShowEntireBuilding() {
        const state = Na__StoreySystem__GetState();
        if (!state || !state.hasStoreys) return false;

        Na__StoreySystem__ShowAll();
        Na__StoreyIsolate__RestoreLandscape(state);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get Current Isolate View State
    // ------------------------------------------------------------
    function Na__StoreyIsolate__GetState() {
        const state = Na__StoreySystem__GetState();
        if (!state || !state.hasStoreys) {
            return {
                hasStoreys: false,
                order: [],
                visibleState: {},
                roofVisible: false
            };
        }

        return {
            hasStoreys: state.hasStoreys,
            order: state.order,
            visibleState: state.visibleState,
            roofVisible: state.roofVisible
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get Storey Display Name (Pass-Through)
    // ------------------------------------------------------------
    function Na__StoreyIsolate__GetStoreyDisplayName(storeyKey) {
        return Na__StoreySystem__GetStoreyDisplayName(storeyKey);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Storey Isolate API
    // ------------------------------------------------------------
    export {
        Na__StoreyIsolate__Initialize,
        Na__StoreyIsolate__IsolateSingleStorey,
        Na__StoreyIsolate__ShowEntireBuilding,
        Na__StoreyIsolate__GetState,
        Na__StoreyIsolate__GetStoreyDisplayName
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
