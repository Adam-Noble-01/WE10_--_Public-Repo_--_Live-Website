// =============================================================================
// TRUEVISION3D - MODEL TOGGLE CONTROLS
// =============================================================================
//
// FILE       : Na__UiFeature__ModelToggle__Controls.js
// NAMESPACE  : Na__UiFeature
// MODULE     : ModelToggle Controls
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Dynamic category visibility toggle buttons for loaded model groups
// CREATED    : 10-Feb-2026
//
// DESCRIPTION:
// - Reads the loaded model groups Map (category -> THREE.Group) from the
//   multi-model loader and dynamically generates toggle buttons for each.
// - Pairs Mesh + Linework models per category into a single toggle.
// - Maps internal category keys to user-friendly display names.
// - Automatically creates buttons for any new categories added in the future
//   (furniture, vegetation, scene context, etc.) without code changes.
// - Integrates into the existing Tools dropdown panel in the TrueVision3D UI.
//
// =============================================================================


import { Na__RenderLoop__RequestRender } from '../05__RenderPipeline/Na__RenderLoop__Invalidation.js';

// -----------------------------------------------------------------------------
// REGION | Module Constants and Category Display Names
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Category Key -> User-Friendly Display Name Map
    // ------------------------------------------------------------
    // Maps TrueVision category keys (from GLB filenames) to readable labels.
    // Any category NOT in this map gets an auto-generated label from its key.
    // ------------------------------------------------------------
    const Na__ModelToggle__DisplayNames = {
        "TrueVision__MainBuildingModel__Existing"              : "Existing Building",
        "TrueVision__MainBuildingModel__ExistingWalls"         : "Existing Walls",
        "TrueVision__MainBuildingModel__ExistingFloors"        : "Existing Floors",
        "TrueVision__MainBuildingModel__ExistingRoofs"         : "Existing Roofs",
        "TrueVision__MainBuildingModel__ExistingWindows"       : "Existing Windows",
        "TrueVision__MainBuildingModel__ExistingDoors"         : "Existing Doors",
        "TrueVision__MainBuildingModel__ExistingStairs"        : "Existing Staircase",
        "TrueVision__MainBuildingModel__ExistingFixtures"      : "Existing Fixtures",
        "TrueVision__MainBuildingModel__ExistingFurniture"     : "Existing Furniture",
        "TrueVision__MainBuildingModel__ExistingInteriorDecor" : "Existing Interior Decor",
        "TrueVision__MainBuildingModel__Proposed"              : "Design Proposal",
        "TrueVision__MainBuildingModel__ProposedWalls"         : "Proposed Walls",
        "TrueVision__MainBuildingModel__ProposedFloors"        : "Proposed Floors",
        "TrueVision__MainBuildingModel__ProposedRoofs"         : "Proposed Roofs",
        "TrueVision__MainBuildingModel__ProposedWindows"       : "Proposed Windows",
        "TrueVision__MainBuildingModel__ProposedDoors"         : "Proposed Doors",
        "TrueVision__MainBuildingModel__ProposedStairs"        : "Proposed Staircase",
        "TrueVision__MainBuildingModel__ProposedFixtures"      : "Proposed Fixtures",
        "TrueVision__MainBuildingModel__ProposedFurniture"     : "Proposed Furniture",
        "TrueVision__MainBuildingModel__ProposedInteriorDecor" : "Proposed Interior Decor",
        "TrueVision__SiteBoundaries"                   : "Site Boundaries",        // <-- Tag 08 (conditional: shown only when boundary GLBs exist)
        "TrueVision__LandscapeEnvironment"             : "Landscape",              // <-- Tag 07
        "TrueVision__SiteVegetation2D"                 : "Site Vegetation 2D",     // <-- Tag 09 (2D camera-follow billboards)
        "TrueVision__GroundFloorFurniture"             : "Ground Floor Furniture", // <-- Tag 30-38
        "TrueVision__GroundFloorDecor"                 : "Ground Floor Decor",     // <-- Tag 39
        "TrueVision__FirstFloorFurniture"              : "First Floor Furniture",  // <-- Tag 40-48
        "TrueVision__FirstFloorDecor"                  : "First Floor Decor",      // <-- Tag 49
        "TrueVision__Vegetation"                       : "Vegetation",             // <-- Tag 50-59
        "TrueVision__SceneContextual"                  : "Scene Context"           // <-- Tag 60-70
    };
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Toggle Panel DOM IDs
    // ------------------------------------------------------------
    const Na__ModelToggle__PanelId     = "naModelTogglePanel";            // <-- Toggle panel container ID
    const Na__ModelToggle__ListId      = "naModelToggleList";             // <-- Toggle buttons list ID
    const Na__ModelToggle__ButtonClass = "na-model-toggle__button";       // <-- Toggle button CSS class
    const Na__ModelToggle__ActiveClass = "na-model-toggle__button--active";  // <-- Active state CSS class
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Display Name Resolution
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Resolve Category Key to User-Friendly Display Name
    // ---------------------------------------------------------------
    function Na__ModelToggle__ResolveDisplayName(categoryKey) {
        if (Na__ModelToggle__DisplayNames[categoryKey]) {
            return Na__ModelToggle__DisplayNames[categoryKey];            // <-- Return mapped display name
        }

        // AUTO-GENERATE | Strip TrueVision__ prefix and humanize
        const stripped = categoryKey.replace('TrueVision__', '');         // <-- Remove namespace prefix
        const humanized = stripped
            .replace(/__/g, ' - ')                                       // <-- Double underscores to dashes
            .replace(/([a-z])([A-Z])/g, '$1 $2');                        // <-- CamelCase to spaces
        return humanized;                                                // <-- Return auto-generated label
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Toggle State Management
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Internal Toggle State
    // ------------------------------------------------------------
    let Na__ModelToggle__StateMap = new Map();                            // <-- Map of category -> { group, visible }
    let Na__ModelToggle__SubmenuWired = false;                            // <-- Guard against duplicate submenu listeners
    // ------------------------------------------------------------


    // FUNCTION | Toggle Category Visibility
    // ------------------------------------------------------------
    function Na__ModelToggle__SetCategoryVisibility(categoryKey, visible) {
        const state = Na__ModelToggle__StateMap.get(categoryKey);         // <-- Look up state entry
        if (!state) return;                                              // <-- Guard against missing category

        state.visible       = visible;                                   // <-- Update internal state
        state.group.visible = visible;                                   // <-- Set THREE.Group visibility
    }
    // ---------------------------------------------------------------


    // FUNCTION | Toggle Category On/Off (Flip Current State)
    // ------------------------------------------------------------
    function Na__ModelToggle__ToggleCategory(categoryKey) {
        const state = Na__ModelToggle__StateMap.get(categoryKey);         // <-- Look up state entry
        if (!state) return;                                              // <-- Guard against missing category

        const newVisible = !state.visible;                               // <-- Flip visibility
        Na__ModelToggle__SetCategoryVisibility(categoryKey, newVisible);  // <-- Apply new visibility
        return newVisible;                                               // <-- Return new state for button update
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Dynamic UI Button Generation
// -----------------------------------------------------------------------------

    // FUNCTION | Build Toggle Buttons from Loaded Groups Map
    // ------------------------------------------------------------
    function Na__ModelToggle__BuildButtons(loadedGroups) {
        const listContainer = document.getElementById(Na__ModelToggle__ListId);  // <-- Get button list container
        if (!listContainer) {
            console.warn('[TrueVision3D] Model toggle list container not found');
            return;                                                      // <-- Exit if no container
        }

        listContainer.innerHTML = '';                                    // <-- Clear any existing buttons
        Na__ModelToggle__StateMap.clear();                               // <-- Clear stale category references

        if (!loadedGroups || loadedGroups.size === 0) {
            listContainer.style.display = 'none';                        // <-- Hide if no groups
            return;
        }

        // BUILD STATE MAP AND BUTTONS FOR EACH LOADED CATEGORY
        loadedGroups.forEach((group, categoryKey) => {
            // REGISTER STATE
            Na__ModelToggle__StateMap.set(categoryKey, {
                group   : group,                                         // <-- THREE.Group reference
                visible : true                                           // <-- Default: visible
            });

            // CREATE BUTTON ELEMENT
            const displayName = Na__ModelToggle__ResolveDisplayName(categoryKey);  // <-- Resolve friendly name
            const button      = document.createElement('button');        // <-- Create button element
            button.className  = `${Na__ModelToggle__ButtonClass} ${Na__ModelToggle__ActiveClass}`;  // <-- Set classes (active by default)
            button.textContent = displayName;                            // <-- Set button label
            button.dataset.category = categoryKey;                       // <-- Store category key in data attribute

            // CLICK HANDLER | Toggle visibility and update button state
            button.addEventListener('click', () => {
                const nowVisible = Na__ModelToggle__ToggleCategory(categoryKey);  // <-- Toggle visibility
                if (nowVisible) {
                    button.classList.add(Na__ModelToggle__ActiveClass);   // <-- Add active class
                } else {
                    button.classList.remove(Na__ModelToggle__ActiveClass);  // <-- Remove active class
                }
                Na__RenderLoop__RequestRender();                          // <-- Redraw after category visibility changes
            });

            listContainer.appendChild(button);                           // <-- Add button to container
        });
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Model Toggle Controls
    // ------------------------------------------------------------
    // Call after Na__ModelLoader__LoadAllModels completes.
    // Accepts the loadedGroups Map returned by the multi-model loader.
    // ------------------------------------------------------------
    function Na__UiFeature__InitializeModelToggleControls(loadedGroups) {
        if (!loadedGroups || loadedGroups.size === 0) {
            console.log('[TrueVision3D] No model groups for toggle controls');
            return;                                                      // <-- Exit if nothing to toggle
        }

        Na__ModelToggle__BuildButtons(loadedGroups);                     // <-- Build dynamic toggle buttons
        
        // INITIALIZE TOGGLE BUTTON
        const toggleButton = document.getElementById('naModelToggleButton');  // <-- Get toggle button element
        const panel = document.getElementById(Na__ModelToggle__PanelId);     // <-- Get panel container
        
        if (toggleButton && panel && !Na__ModelToggle__SubmenuWired) {
            toggleButton.addEventListener('click', () => {
                const isOpen = panel.classList.contains('is-open');      // <-- Check current panel state
                panel.classList.toggle('is-open', !isOpen);            // <-- Toggle panel visibility
            });
            Na__ModelToggle__SubmenuWired = true;
        }
        
        console.log(`[TrueVision3D] Model toggle controls initialized for ${loadedGroups.size} categories`);
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Model Toggle Controls API
    // ------------------------------------------------------------
    export {
        Na__UiFeature__InitializeModelToggleControls
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

