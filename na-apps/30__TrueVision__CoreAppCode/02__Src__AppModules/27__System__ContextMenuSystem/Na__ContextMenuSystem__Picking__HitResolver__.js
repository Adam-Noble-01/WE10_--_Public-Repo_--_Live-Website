// =============================================================================
// TRUEVISION3D - CONTEXT MENU SYSTEM - HIT RESOLVER
// =============================================================================
//
// FILE       : Na__ContextMenuSystem__Picking__HitResolver__.js
// NAMESPACE  : Na__ContextMenu
// MODULE     : Context Menu System - Raycast Hit Resolution
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Turn a screen click into the model element that was clicked
// CREATED    : 30-Aug-2026
//
// DESCRIPTION:
// - Raycasts from the pointer into the loaded model and reports which category
//   group was hit, plus the storey and element type parsed from its name.
// - The category group is the unit the visibility systems operate on. It is
//   always a direct child of the model root:
//       Na__ModelGroup__Root
//        +-- "Storey__GroundFloor__ProposedWalls"     <-- the category group
//              +-- "...__MeshRoot"      Na__ModelType = 'mesh'
//              +-- "...__LineworkRoot"  Na__ModelType = 'linework'
//
// TWO NON-OBVIOUS RULES THIS MODULE ENFORCES:
// - Linework roots are excluded from the ray. Fat lines are LineSegments2,
//   which extends THREE.Mesh, so an edge would otherwise beat the solid face
//   behind it and every hit would resolve to the outline rather than the wall.
// - Invisible geometry is filtered manually. THREE.Raycaster does not test
//   object.visible, so a hidden storey would still be pickable through the
//   model in front of it. Every candidate hit therefore has its full ancestor
//   chain checked before being accepted.
//
// INTEGRATION:
// - Initialized by Na__ContextMenuSystem__SystemLogic__.js with the camera,
//   model root and renderer DOM element.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 30-Aug-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js Core
    // ------------------------------------------------------------
    import * as THREE from 'three';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Category Name Parsing
    // ------------------------------------------------------------
    const Na__CtxPick__StoreyCategoryRegex = /^Storey__([A-Za-z]+)__([A-Za-z0-9]+)$/;      // <-- Storey__GroundFloor__ProposedWalls
    const Na__CtxPick__MainModelPrefix     = 'TrueVision__MainBuildingModel__';            // <-- Non-storey building categories
    const Na__CtxPick__TrueVisionPrefix    = 'TrueVision__';                               // <-- Everything else (landscape etc.)
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State (Private)
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Scene References and Reusable Raycast Objects
    // ------------------------------------------------------------
    let Na__CtxPick__Camera      = null;                                         // <-- Active perspective camera
    let Na__CtxPick__ModelRoot   = null;                                         // <-- Na__ModelGroup__Root
    let Na__CtxPick__DomElement  = null;                                         // <-- Renderer canvas (for bounding rect)
    const Na__CtxPick__Raycaster = new THREE.Raycaster();                        // <-- Reused every pick
    const Na__CtxPick__PointerNDC = new THREE.Vector2();                         // <-- Reused normalised device coords
    // ------------------------------------------------------------


    // MODULE VARIABLES | Picking Configuration
    // ------------------------------------------------------------
    let Na__CtxPick__IgnoreLinework      = true;                                 // <-- Exclude LineworkRoot subtrees from the ray
    let Na__CtxPick__IgnoreNameTokens    = ['OrbitHelperCube'];                  // <-- Categories never offered to the menu
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Category Name Parsing
// -----------------------------------------------------------------------------

    // FUNCTION | Split a Category Key Into Storey and Element Parts
    // ------------------------------------------------------------
    // Storey exports yield both parts. Flat exports yield an element only, with
    // a null storey, which callers use to hide the floor-scoped menu rows.
    // ------------------------------------------------------------
    function Na__ContextMenu__Picking__ParseCategoryKey(categoryKey) {
        if (!categoryKey || typeof categoryKey !== 'string') {
            return { storeyKey: null, elementKey: null };
        }

        const storeyMatch = Na__CtxPick__StoreyCategoryRegex.exec(categoryKey);
        if (storeyMatch) {
            return { storeyKey: storeyMatch[1], elementKey: storeyMatch[2] };    // <-- e.g. GroundFloor + ProposedWalls
        }

        if (categoryKey.startsWith(Na__CtxPick__MainModelPrefix)) {
            return { storeyKey: null, elementKey: categoryKey.slice(Na__CtxPick__MainModelPrefix.length) };
        }

        if (categoryKey.startsWith(Na__CtxPick__TrueVisionPrefix)) {
            return { storeyKey: null, elementKey: categoryKey.slice(Na__CtxPick__TrueVisionPrefix.length) };
        }

        return { storeyKey: null, elementKey: categoryKey };                     // <-- Unrecognised shape, use as-is
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Scene Graph Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Is This Category Excluded from Picking?
    // ------------------------------------------------------------
    function Na__CtxPick__IsExcludedCategory(categoryName) {
        if (!categoryName) return true;

        return Na__CtxPick__IgnoreNameTokens.some((token) => categoryName.includes(token));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Collect the Raycastable Roots Beneath Every Category
    // ------------------------------------------------------------
    // Returns the mesh roots only. Hidden categories are skipped up front,
    // which is both a correctness fix (see file header) and a large saving on
    // ray cost while a floor is isolated.
    // ------------------------------------------------------------
    function Na__CtxPick__CollectRaycastRoots() {
        const roots = [];
        if (!Na__CtxPick__ModelRoot || !Na__CtxPick__ModelRoot.children) return roots;

        for (const categoryGroup of Na__CtxPick__ModelRoot.children) {
            if (!categoryGroup || categoryGroup.visible === false) continue;     // <-- Hidden category is not pickable
            if (Na__CtxPick__IsExcludedCategory(categoryGroup.name)) continue;

            for (const child of (categoryGroup.children || [])) {
                if (!child || child.visible === false) continue;

                const modelType = child.userData && child.userData.Na__ModelType;
                if (Na__CtxPick__IgnoreLinework && modelType === 'linework') continue;  // <-- Edges must not beat faces

                roots.push(child);
            }
        }

        return roots;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is Every Ancestor of This Object Visible?
    // ------------------------------------------------------------
    function Na__CtxPick__IsChainVisible(object) {
        let current = object;

        while (current) {
            if (current.visible === false) return false;                         // <-- Something in the chain is switched off
            if (current === Na__CtxPick__ModelRoot) return true;                 // <-- Reached the root cleanly
            current = current.parent;
        }

        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Walk Up to the Category Group (Direct Child of Model Root)
    // ------------------------------------------------------------
    function Na__CtxPick__FindCategoryGroup(object) {
        let current = object;

        while (current && current.parent) {
            if (current.parent === Na__CtxPick__ModelRoot) return current;       // <-- One level below the root is the category
            current = current.parent;
        }

        return null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Apply Picking Configuration from AppConfig
    // ------------------------------------------------------------
    function Na__ContextMenu__Picking__ApplyConfig(pickingConfig) {
        if (!pickingConfig) return;

        if (typeof pickingConfig['ContextMenu__Picking__IgnoreLinework'] === 'boolean') {
            Na__CtxPick__IgnoreLinework = pickingConfig['ContextMenu__Picking__IgnoreLinework'];
        }

        const tokens = pickingConfig['ContextMenu__Picking__IgnoreCategoryNameTokens'];
        if (Array.isArray(tokens)) {
            Na__CtxPick__IgnoreNameTokens = tokens.filter((token) => typeof token === 'string' && token.length > 0);
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Initialize the Hit Resolver
    // ------------------------------------------------------------
    function Na__ContextMenu__Picking__Initialize(camera, modelRoot, domElement, pickingConfig) {
        Na__CtxPick__Camera     = camera || null;
        Na__CtxPick__ModelRoot  = modelRoot || null;
        Na__CtxPick__DomElement = domElement || null;

        Na__ContextMenu__Picking__ApplyConfig(pickingConfig);

        return !!(Na__CtxPick__Camera && Na__CtxPick__ModelRoot && Na__CtxPick__DomElement);
    }
    // ------------------------------------------------------------


    // FUNCTION | Update the Camera Reference (Nav Mode Switches Swap Cameras)
    // ------------------------------------------------------------
    function Na__ContextMenu__Picking__SetCamera(camera) {
        if (camera) Na__CtxPick__Camera = camera;
    }
    // ------------------------------------------------------------


    // FUNCTION | Resolve a Screen Position to a Model Element
    // ------------------------------------------------------------
    // Returns null when the ray misses the model entirely, which the menu
    // treats as "empty space - do not open".
    // ------------------------------------------------------------
    function Na__ContextMenu__Picking__ResolveHit(clientX, clientY) {
        if (!Na__CtxPick__Camera || !Na__CtxPick__ModelRoot || !Na__CtxPick__DomElement) return null;

        // SCREEN TO NDC | Relative to the canvas, not the window
        const rect = Na__CtxPick__DomElement.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;

        Na__CtxPick__PointerNDC.x =  ((clientX - rect.left) / rect.width)  * 2 - 1;
        Na__CtxPick__PointerNDC.y = -((clientY - rect.top)  / rect.height) * 2 + 1;

        Na__CtxPick__Raycaster.setFromCamera(Na__CtxPick__PointerNDC, Na__CtxPick__Camera);


        // CAST | Against visible mesh roots only
        const raycastRoots = Na__CtxPick__CollectRaycastRoots();
        if (raycastRoots.length === 0) return null;

        const intersections = Na__CtxPick__Raycaster.intersectObjects(raycastRoots, true);
        if (intersections.length === 0) return null;


        // ACCEPT | First intersection whose whole ancestor chain is visible
        for (const intersection of intersections) {
            const hitObject = intersection.object;
            if (!hitObject) continue;
            if (!Na__CtxPick__IsChainVisible(hitObject)) continue;               // <-- Raycaster ignores visible, so we do not

            const categoryGroup = Na__CtxPick__FindCategoryGroup(hitObject);
            if (!categoryGroup) continue;
            if (Na__CtxPick__IsExcludedCategory(categoryGroup.name)) continue;

            const categoryKey = categoryGroup.name;
            const parsed      = Na__ContextMenu__Picking__ParseCategoryKey(categoryKey);

            return {
                hitObject     : hitObject,                                       // <-- The mesh under the pointer
                point         : intersection.point,                              // <-- World-space hit point
                distance      : intersection.distance,
                categoryGroup : categoryGroup,                                   // <-- Unit the visibility systems act on
                categoryKey   : categoryKey,                                     // <-- e.g. Storey__GroundFloor__ProposedWalls
                storeyKey     : parsed.storeyKey,                                // <-- e.g. GroundFloor, or null on flat exports
                elementKey    : parsed.elementKey                                // <-- e.g. ProposedWalls
            };
        }

        return null;                                                             // <-- Everything the ray touched is hidden
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Hit Resolver API
    // ------------------------------------------------------------
    export {
        Na__ContextMenu__Picking__Initialize,
        Na__ContextMenu__Picking__ApplyConfig,
        Na__ContextMenu__Picking__SetCamera,
        Na__ContextMenu__Picking__ResolveHit,
        Na__ContextMenu__Picking__ParseCategoryKey
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
