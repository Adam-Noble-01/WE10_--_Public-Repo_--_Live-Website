// =============================================================================
// TRUEVISION3D - BUILDING STOREY VISIBILITY SYSTEM
// =============================================================================
//
// FILE       : 3dObject__ViewBuildingStoreys__SystemLogic__.js
// NAMESPACE  : TrueVision3D
// MODULE     : 3D Object View Systems - Building Storey Visibility Control
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Enable per-storey visibility toggling for multi-storey building models
// CREATED    : 15-Feb-2026
//
// DESCRIPTION:
// - Detects storey-based building models from GLB filenames (Storey__ prefix pattern).
// - Groups models by storey (GroundFloor, FirstFloor, etc.) for organized control.
// - Provides visibility toggle functions for individual storeys or ranges.
// - Implements intelligent roof visibility logic for dolls house view.
// - Supports "show only below" mode for interior exploration (cut-away view).
// - Manages roof visibility: solid building mode or dolls house mode (topmost roof hidden).
// - Stateful module: maintains internal storey map, visibility state, and roof tracking.
//
// NAMING CONVENTION (GLB Filenames):
// - Storey pattern: "Storey__{StoreyName}__{ElementType}__MeshModel__.glb"
// - Examples: "Storey__GroundFloor__ProposedWalls__MeshModel__.glb"
//            "Storey__FirstFloor__ProposedRoofs__MeshModel__.glb"
// - Roof detection: Models with "Roof" substring in name (ProposedRoofs, ExistingRoofs, etc.)
//
// INTEGRATION:
// - Requires storey-based models exported from SketchUp GLB Builder Utility (v1.6.0+).
// - Call Na__StoreySystem__DetectStoreys() after GLB models are loaded.
// - Use Na__StoreySystem__GetState() to access storey data for UI rendering.
// - Call visibility control functions to toggle storey/roof visibility.
// - Caller responsible for UI rendering and DOM manipulation.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 28-Feb-2026 - Version 1.1.0
// - Added Na__StoreySystem__ResetEntireBuilding() as a true reset action.
// - Reset now restores all storeys, forces roofs on, and forces landscape visible.
// - Added model-root tracking to support landscape reset operations.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Three.js Core Imports
    // ------------------------------------------------------------
    import * as THREE from 'three';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State (Private)
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Storey Detection and Visibility State
    // ------------------------------------------------------------
    let Na__StoreySystem__Map           = {};                                    // <-- { "GroundFloor": [model1, model2, ...], ... }
    let Na__StoreySystem__Order         = [];                                    // <-- Ordered storey names (bottom to top)
    let Na__StoreySystem__HasStoreys    = false;                                 // <-- Flag: storey models detected
    let Na__StoreySystem__ModelRoot     = null;                                  // <-- Current loaded model root (for global reset tasks)
    let Na__StoreySystem__VisibleState  = {};                                    // <-- { "GroundFloor": true, "FirstFloor": true, ... }
    let Na__StoreySystem__RoofMap       = {};                                    // <-- { "GroundFloor": [roofModels...], "FirstFloor": [roofModels...], ... }
    let Na__StoreySystem__RoofVisible   = true;                                  // <-- Roof toggle state (true = all visible, false = dolls house mode)
    // ------------------------------------------------------------


    // MODULE VARIABLES | Configuration
    // ------------------------------------------------------------
    let Na__StoreySystem__Config__StoreyOrder = ['GroundFloor', 'FirstFloor', 'SecondFloor', 'ThirdFloor'];  // <-- Default storey order
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helper Functions
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Convert Storey Key to Display Name
    // ------------------------------------------------------------
    function Na__StoreySystem__DisplayName(storeyKey) {
        return storeyKey.replace(/([a-z])([A-Z])/g, '$1 $2');                   // <-- "GroundFloor" -> "Ground Floor"
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Force Landscape Group Visibility
    // ------------------------------------------------------------
    function Na__StoreySystem__SetLandscapeVisible(visible) {
        if (!Na__StoreySystem__ModelRoot) return;

        Na__StoreySystem__ModelRoot.traverse((obj) => {
            if (!obj || typeof obj.name !== 'string') return;
            if (!/Landscape|SiteVegetation/i.test(obj.name)) return;
            obj.visible = visible;
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Storey Detection
// -----------------------------------------------------------------------------

    // FUNCTION | Detect Storeys from Loaded GLB Model Names
    // ------------------------------------------------------------
    function Na__StoreySystem__Internal__DetectStoreys(modelGroupRoot) {
        Na__StoreySystem__Map    = {};                                           // <-- Reset map
        Na__StoreySystem__Order  = [];                                           // <-- Reset order

        // Scan loaded model names for storey pattern: "Storey__{Name}__"
        for (const child of modelGroupRoot.children) {
            const name = child.name || '';
            const match = name.match(/Storey__([A-Za-z]+)__/);                  // <-- Extract storey name

            if (match) {
                const storeyKey = match[1];                                      // <-- e.g. "GroundFloor"
                if (!Na__StoreySystem__Map[storeyKey]) {
                    Na__StoreySystem__Map[storeyKey] = [];
                }
                Na__StoreySystem__Map[storeyKey].push(child);                   // <-- Add model to storey
            }
        }

        // Build ordered list from predefined order (only include detected storeys)
        for (const key of Na__StoreySystem__Config__StoreyOrder) {
            if (Na__StoreySystem__Map[key]) {
                Na__StoreySystem__Order.push(key);
            }
        }

        // Add any extra storeys not in predefined order
        for (const key of Object.keys(Na__StoreySystem__Map)) {
            if (!Na__StoreySystem__Order.includes(key)) {
                Na__StoreySystem__Order.push(key);
            }
        }

        // Initialize visibility state (all visible by default)
        Na__StoreySystem__VisibleState = {};
        for (const key of Na__StoreySystem__Order) {
            Na__StoreySystem__VisibleState[key] = true;                         // <-- Default: visible
        }

        // Build roof map by detecting models with "Roof" in name per storey
        Na__StoreySystem__RoofMap = {};                                         // <-- Reset roof map
        for (const storeyKey of Na__StoreySystem__Order) {
            const models = Na__StoreySystem__Map[storeyKey];
            const roofModels = models.filter(m => (m.name || '').includes('Roof'));  // <-- Match "ProposedRoofs", "ExistingRoofs", etc.
            if (roofModels.length > 0) {
                Na__StoreySystem__RoofMap[storeyKey] = roofModels;              // <-- Store roof models for this storey
                console.log(`  [Storey System] ${storeyKey}: ${roofModels.length} roof model(s) detected`);
            }
        }

        Na__StoreySystem__HasStoreys = Na__StoreySystem__Order.length > 0;

        if (Na__StoreySystem__HasStoreys) {
            console.log(`[Storey System] Detection complete: ${Na__StoreySystem__Order.length} storey(s) found:`, Na__StoreySystem__Order);
        } else {
            console.log('[Storey System] No storey-based models detected (flat export mode)');
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Visibility Control Functions
// -----------------------------------------------------------------------------

    // FUNCTION | Set Visibility for a Single Storey
    // ------------------------------------------------------------
    function Na__StoreySystem__Internal__SetStoreyVisibility(storeyKey, visible) {
        const models = Na__StoreySystem__Map[storeyKey];
        if (!models) return;

        Na__StoreySystem__VisibleState[storeyKey] = visible;                    // <-- Update state

        for (const model of models) {
            model.visible = visible;                                             // <-- Set Three.js visibility
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Show Only Below a Specific Storey (Dolls House Mode)
    // ------------------------------------------------------------
    function Na__StoreySystem__Internal__ShowOnlyBelow(storeyKey) {
        const targetIndex = Na__StoreySystem__Order.indexOf(storeyKey);
        if (targetIndex === -1) return;

        for (let i = 0; i < Na__StoreySystem__Order.length; i++) {
            const key     = Na__StoreySystem__Order[i];
            const visible = (i <= targetIndex);                                  // <-- Show this storey and below
            Na__StoreySystem__Internal__SetStoreyVisibility(key, visible);
        }

        Na__StoreySystem__Internal__ApplyRoofVisibilityLogic();                 // <-- Apply intelligent roof visibility

        const displayName = Na__StoreySystem__DisplayName(storeyKey);
        console.log(`[Storey System] Dolls house view: showing up to ${displayName}`);
    }
    // ------------------------------------------------------------


    // FUNCTION | Show All Storeys (Entire Building)
    // ------------------------------------------------------------
    function Na__StoreySystem__Internal__ShowAll() {
        for (const key of Na__StoreySystem__Order) {
            Na__StoreySystem__Internal__SetStoreyVisibility(key, true);         // <-- Make all visible
        }

        Na__StoreySystem__Internal__ApplyRoofVisibilityLogic();                 // <-- Apply intelligent roof visibility

        console.log('[Storey System] Showing entire building (all storeys visible)');
    }
    // ------------------------------------------------------------


    // FUNCTION | Full Building Reset (Storeys + Roofs + Landscape)
    // ------------------------------------------------------------
    function Na__StoreySystem__Internal__ResetEntireBuilding() {
        for (const key of Na__StoreySystem__Order) {
            Na__StoreySystem__Internal__SetStoreyVisibility(key, true);         // <-- Reset all storeys to visible
        }

        Na__StoreySystem__RoofVisible = true;                                   // <-- Always restore solid building roof mode
        Na__StoreySystem__Internal__ApplyRoofVisibilityLogic();
        Na__StoreySystem__SetLandscapeVisible(true);                            // <-- Always restore all landscape groups

        console.log('[Storey System] Reset entire building (storeys + roofs + landscape visible)');
    }
    // ------------------------------------------------------------


    // FUNCTION | Toggle a Single Storey Visibility
    // ------------------------------------------------------------
    function Na__StoreySystem__Internal__ToggleStorey(storeyKey) {
        const currentState = Na__StoreySystem__VisibleState[storeyKey];
        Na__StoreySystem__Internal__SetStoreyVisibility(storeyKey, !currentState);  // <-- Toggle

        Na__StoreySystem__Internal__ApplyRoofVisibilityLogic();                 // <-- Apply intelligent roof visibility
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Roof Visibility Logic
// -----------------------------------------------------------------------------

    // FUNCTION | Apply Intelligent Roof Visibility Logic
    // ------------------------------------------------------------
    function Na__StoreySystem__Internal__ApplyRoofVisibilityLogic() {
        // Find topmost visible storey (scan from top to bottom)
        let topmostVisibleIndex = -1;
        for (let i = Na__StoreySystem__Order.length - 1; i >= 0; i--) {
            const key = Na__StoreySystem__Order[i];
            if (Na__StoreySystem__VisibleState[key]) {
                topmostVisibleIndex = i;                                        // <-- Found topmost visible
                break;
            }
        }

        if (topmostVisibleIndex === -1) return;                                 // <-- No storeys visible, exit

        // Apply roof visibility based on manual override or auto logic
        if (Na__StoreySystem__RoofVisible) {
            // Roofs enabled (default): show ALL roofs (solid building view)
            for (const key of Na__StoreySystem__Order) {
                const roofModels = Na__StoreySystem__RoofMap[key];
                if (!roofModels) continue;

                const storeyVisible = Na__StoreySystem__VisibleState[key];
                for (const roof of roofModels) {
                    roof.visible = storeyVisible;                               // <-- Show roof if storey is visible
                }
            }
        } else {
            // Roofs disabled: dolls house mode (show lower roofs as ceilings, hide topmost roof)
            for (let i = 0; i < Na__StoreySystem__Order.length; i++) {
                const key = Na__StoreySystem__Order[i];
                const roofModels = Na__StoreySystem__RoofMap[key];
                if (!roofModels) continue;                                      // <-- Skip if no roof models

                const storeyVisible    = Na__StoreySystem__VisibleState[key];
                const isTopmostVisible = (i === topmostVisibleIndex);

                for (const roof of roofModels) {
                    roof.visible = storeyVisible && !isTopmostVisible;          // <-- Show if storey visible AND not topmost
                }
            }
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Toggle Roof Visibility (Manual Override)
    // ------------------------------------------------------------
    function Na__StoreySystem__Internal__ToggleRoof() {
        Na__StoreySystem__RoofVisible = !Na__StoreySystem__RoofVisible;         // <-- Toggle roof state

        Na__StoreySystem__Internal__ApplyRoofVisibilityLogic();                 // <-- Apply roof visibility logic

        console.log(`[Storey System] Roof visibility: ${Na__StoreySystem__RoofVisible ? 'enabled (all roofs visible)' : 'dolls house mode (topmost roof hidden)'}`);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Storey System with Configuration
    // ------------------------------------------------------------
    export function Na__StoreySystem__Initialize(modelGroupRoot, config = {}) {
        console.log('[Storey System] Initializing...');
        Na__StoreySystem__ModelRoot = modelGroupRoot || null;

        // Apply configuration overrides
        if (config.storeyOrder && Array.isArray(config.storeyOrder)) {
            Na__StoreySystem__Config__StoreyOrder = config.storeyOrder;
        }
        if (config.defaultRoofVisible !== undefined) {
            Na__StoreySystem__RoofVisible = config.defaultRoofVisible;
        }

        // Detect storeys from loaded models
        Na__StoreySystem__Internal__DetectStoreys(modelGroupRoot);

        // Apply initial roof visibility logic
        if (Na__StoreySystem__HasStoreys) {
            Na__StoreySystem__Internal__ApplyRoofVisibilityLogic();
        }

        console.log('[Storey System] Initialization complete');
        return Na__StoreySystem__HasStoreys;
    }
    // ------------------------------------------------------------


    // FUNCTION | Detect Storeys (Public Entry Point)
    // ------------------------------------------------------------
    export function Na__StoreySystem__DetectStoreys(modelGroupRoot) {
        Na__StoreySystem__ModelRoot = modelGroupRoot || null;
        Na__StoreySystem__Internal__DetectStoreys(modelGroupRoot);
        return Na__StoreySystem__HasStoreys;
    }
    // ------------------------------------------------------------


    // FUNCTION | Set Visibility for a Single Storey
    // ------------------------------------------------------------
    export function Na__StoreySystem__SetStoreyVisibility(storeyKey, visible) {
        Na__StoreySystem__Internal__SetStoreyVisibility(storeyKey, visible);
        Na__StoreySystem__Internal__ApplyRoofVisibilityLogic();
    }
    // ------------------------------------------------------------


    // FUNCTION | Show Only Below a Specific Storey (Dolls House Mode)
    // ------------------------------------------------------------
    export function Na__StoreySystem__ShowOnlyBelow(storeyKey) {
        Na__StoreySystem__Internal__ShowOnlyBelow(storeyKey);
    }
    // ------------------------------------------------------------


    // FUNCTION | Show All Storeys (Entire Building)
    // ------------------------------------------------------------
    export function Na__StoreySystem__ShowAll() {
        Na__StoreySystem__Internal__ShowAll();
    }
    // ------------------------------------------------------------


    // FUNCTION | Reset Entire Building (Storeys + Roofs + Landscape)
    // ------------------------------------------------------------
    export function Na__StoreySystem__ResetEntireBuilding() {
        Na__StoreySystem__Internal__ResetEntireBuilding();
    }
    // ------------------------------------------------------------


    // FUNCTION | Toggle a Single Storey Visibility
    // ------------------------------------------------------------
    export function Na__StoreySystem__ToggleStorey(storeyKey) {
        Na__StoreySystem__Internal__ToggleStorey(storeyKey);
    }
    // ------------------------------------------------------------


    // FUNCTION | Toggle Roof Visibility Mode
    // ------------------------------------------------------------
    export function Na__StoreySystem__ToggleRoof() {
        Na__StoreySystem__Internal__ToggleRoof();
    }
    // ------------------------------------------------------------


    // FUNCTION | Get Current Storey System State (Read-Only)
    // ------------------------------------------------------------
    export function Na__StoreySystem__GetState() {
        return {
            map           : Na__StoreySystem__Map,                               // <-- Storey name => models mapping
            order         : Na__StoreySystem__Order,                             // <-- Ordered storey names (bottom to top)
            hasStoreys    : Na__StoreySystem__HasStoreys,                        // <-- Flag: storeys detected
            visibleState  : Na__StoreySystem__VisibleState,                      // <-- Storey visibility state
            roofMap       : Na__StoreySystem__RoofMap,                           // <-- Storey => roof models mapping
            roofVisible   : Na__StoreySystem__RoofVisible                        // <-- Roof mode (true = all visible, false = dolls house)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get Storey Display Name (Human-Readable)
    // ------------------------------------------------------------
    export function Na__StoreySystem__GetStoreyDisplayName(storeyKey) {
        return Na__StoreySystem__DisplayName(storeyKey);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

