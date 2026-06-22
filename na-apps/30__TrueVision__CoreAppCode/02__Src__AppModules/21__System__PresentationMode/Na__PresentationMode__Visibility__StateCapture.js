// =============================================================================
// TRUEVISION3D - PRESENTATION MODE - MODEL VISIBILITY STATE CAPTURE
// =============================================================================
//
// FILE       : Na__PresentationMode__Visibility__StateCapture.js
// NAMESPACE  : Na__PmVisibility
// MODULE     : PresentationMode - Model Visibility State Capture
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Capture and re-apply the on/off visibility state of model
//              elements (categories, storeys, roof) as part of a saved scene
// CREATED    : 21-Jun-2026
//
// DESCRIPTION:
// - Lets a Presentation Mode scene remember which parts of the building are
//   shown or hidden, exactly like SketchUp scenes remember tag visibility.
// - Capture reads the LIVE category visibility (THREE.Group.visible) from the
//   existing "Toggle Model Layers" registry, which is authoritative because the
//   Floor Isolate / Storey Toggle systems mutate those same groups directly.
// - It additionally records storey on/off booleans + the roof dolls-house flag
//   so the Storey/Floor-Isolate menus stay consistent after a scene applies.
// - Apply restores the storey bookkeeping FIRST (coarse), then the category
//   snapshot LAST (fine + authoritative), so any per-category overrides win and
//   no roof-logic side effect can re-hide/show a group after the snap.
// - This module owns NO core visibility logic; it only orchestrates the
//   existing systems (Na__ModelToggle__* and Na__StoreySystem__*).
//
// INTEGRATION:
// - Capture: called by the Dev Menu Scene Editor when adding / updating a scene.
// - Apply  : called by the Scene Carousel when a scene is selected / loaded.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Jun-2026 - Version 1.0.0
// - Initial release. Drives the existing model-toggle + storey systems so
//   saved scenes carry a "dolls house" / per-storey visibility state.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Category Visibility Registry (Toggle Model Layers)
    // ------------------------------------------------------------
    import {
        Na__ModelToggle__GetVisibilityState,
        Na__ModelToggle__ApplyVisibilityState,
        Na__ModelToggle__SetAllCategoriesVisible
    } from '../26__System__ToggleModelElements/Na__UiFeature__ModelToggle__Controls.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Storey Visibility System (Storey Toggle / Floor Isolate)
    // ------------------------------------------------------------
    import {
        Na__StoreySystem__GetState,
        Na__StoreySystem__SetStoreyVisibility,
        Na__StoreySystem__ToggleRoof,
        Na__StoreySystem__ResetEntireBuilding
    } from '../26__System__ToggleModelElements/3dObject__ViewBuildingStoreys__SystemLogic__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Scene Visibility Field Keys
    // ------------------------------------------------------------
    const Na__PmVisibility__Key__Categories  = 'PresentationMode__Scene__Visibility__Categories';   // <-- { categoryKey: bool }
    const Na__PmVisibility__Key__Storeys     = 'PresentationMode__Scene__Visibility__Storeys';      // <-- { storeyKey: bool }
    const Na__PmVisibility__Key__RoofVisible = 'PresentationMode__Scene__Visibility__RoofVisible';  // <-- bool (false = dolls house)
    const Na__PmVisibility__Key__HasStoreys  = 'PresentationMode__Scene__Visibility__HasStoreys';   // <-- bool (storey GLBs present)
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Capture
// -----------------------------------------------------------------------------

    // FUNCTION | Capture the Current Model Visibility as a Serializable Block
    // ------------------------------------------------------------
    // Returns null when no category groups are registered (e.g. before models
    // finish loading) so callers can omit the field entirely.
    // ------------------------------------------------------------
    function Na__PmVisibility__CaptureState() {
        const categories = Na__ModelToggle__GetVisibilityState();            // <-- Live group.visible per category (authoritative)
        if (!categories || Object.keys(categories).length === 0) return null;

        const snapshot = {
            [Na__PmVisibility__Key__Categories] : categories                 // <-- Always present when models are loaded
        };

        // STOREY BOOKKEEPING | Only when storey-export GLBs are detected
        const storeyState = Na__StoreySystem__GetState();
        if (storeyState && storeyState.hasStoreys) {
            snapshot[Na__PmVisibility__Key__HasStoreys]  = true;
            snapshot[Na__PmVisibility__Key__Storeys]     = { ...storeyState.visibleState };  // <-- Clone (drop live refs)
            snapshot[Na__PmVisibility__Key__RoofVisible] = storeyState.roofVisible === true;
        }

        return snapshot;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Apply
// -----------------------------------------------------------------------------

    // SUB FUNCTION | Restore Storey Bookkeeping (Coarse - runs before categories)
    // ---------------------------------------------------------------
    function Na__PmVisibility__ApplyStoreyState(snapshot) {
        const storeyState = Na__StoreySystem__GetState();
        if (!storeyState || !storeyState.hasStoreys) return;                 // <-- No storey system this project

        const savedStoreys = snapshot[Na__PmVisibility__Key__Storeys];
        if (savedStoreys && typeof savedStoreys === 'object') {
            Object.keys(savedStoreys).forEach((storeyKey) => {
                Na__StoreySystem__SetStoreyVisibility(storeyKey, savedStoreys[storeyKey] === true); // <-- Sync internal state + menu
            });
        }

        // ALIGN ROOF DOLLS-HOUSE FLAG | ToggleRoof is the only roof mutator
        const savedRoofVisible = snapshot[Na__PmVisibility__Key__RoofVisible];
        if (typeof savedRoofVisible === 'boolean') {
            const currentRoofVisible = Na__StoreySystem__GetState().roofVisible === true;
            if (currentRoofVisible !== savedRoofVisible) {
                Na__StoreySystem__ToggleRoof();                              // <-- Flip to match the saved roof mode
            }
        }
    }
    // ---------------------------------------------------------------


    // SUB FUNCTION | Reset Building + All Categories to Fully Visible (Baseline)
    // ---------------------------------------------------------------
    // Guarantees a clean, fully-visible starting point so a scene's saved state
    // is authoritative: nothing hidden by a previous scene can linger, and a
    // scene that omits a visibility block simply shows the whole model.
    // ---------------------------------------------------------------
    function Na__PmVisibility__ResetToFullVisibility() {
        const storeyState = Na__StoreySystem__GetState();
        if (storeyState && storeyState.hasStoreys) {
            Na__StoreySystem__ResetEntireBuilding();                          // <-- Storeys + roofs + landscape all visible
        }
        Na__ModelToggle__SetAllCategoriesVisible();                          // <-- Every category group visible (furniture, decor, etc.)
    }
    // ---------------------------------------------------------------


    // FUNCTION | Re-Apply a Saved Model Visibility Block
    // ------------------------------------------------------------
    // SketchUp-style: each scene is an authoritative, complete visibility state.
    // 1) Reset to a fully-visible baseline (so prior-scene hides never linger).
    // 2) Apply coarse storey + roof state.
    // 3) Apply fine per-category state LAST (wins, immune to roof side-effects).
    // A scene with no block therefore shows the entire model.
    // ------------------------------------------------------------
    function Na__PmVisibility__ApplyState(snapshot) {
        Na__PmVisibility__ResetToFullVisibility();                           // <-- 0) Clean baseline (always)

        if (!snapshot || typeof snapshot !== 'object') return;               // <-- No block: full model shown

        Na__PmVisibility__ApplyStoreyState(snapshot);                        // <-- 1) Coarse storey + roof sync

        const categories = snapshot[Na__PmVisibility__Key__Categories];
        if (categories && typeof categories === 'object') {
            Na__ModelToggle__ApplyVisibilityState(categories);               // <-- 2) Fine per-category truth (wins, runs last)
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Presentation Mode Visibility State API
    // ------------------------------------------------------------
    export {
        Na__PmVisibility__CaptureState,
        Na__PmVisibility__ApplyState
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
