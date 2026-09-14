// =============================================================================
// TRUEVISION3D - PROJECTED LINEWORK - AUTHORED EDGES
// =============================================================================
//
// FILE       : Na__ProjectedLinework__AuthoredEdges__.js
// NAMESPACE  : Na__PlAuthored
// MODULE     : Projected Linework - Authored Edges
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Read the SketchUp linework GLBs as the authored edge class
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - Every TrueVision model ships a linework GLB beside its mesh GLB: the
//   edges SketchUp drew, upgraded by the loader to fat lines (LineSegments2).
//   Those are lines a person chose, so they are their own class (D18) and
//   are occlusion-clipped like every other edge rather than drawn blind.
//
// - The fat line geometry (LineSegmentsGeometry) keeps each segment as an
//   instanced pair, instanceStart and instanceEnd, in the root's local
//   space. Both are read straight from the interleaved attributes and
//   transformed by the object's world matrix, so nothing here depends on
//   how the loader built the material.
//
// - The same category and helper rules the sampler applies (visibility,
//   exclusion tokens, skip names) apply here, read by name off the same
//   category groups, so a category left out of the drawing is out of both
//   classes.
//
// - WHICH CATEGORIES SHIP LINEWORK. The walk also names every category whose
//   GLB pair brought a linework root holding at least one segment, returned
//   as Categories. That Set is what LINEWORK FIRST reads (see the edge
//   extractor): those categories draw their creases from here and only their
//   silhouettes from the mesh. It records what was LOADED, not what is
//   showing this frame, so a passing hide of a linework root cannot swap a
//   category back to mesh creases under a cache key that would not know.
//
// INTEGRATION:
// - Na__ProjectedLinework__CpuBackend__ asks for the edges per model state
//   and runs them through the clip kernel as the authored class.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 50__System__ProjectedLinework/Na__ProjectedLinework__AuthoredEdges__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim, bar 1.2.0
// - Divergences   : Console prefix, header and folder numbers; the Categories
//                   Set of 1.2.0 (linework first), authored here first.
// - Back-port     : 1.2.0 PENDING to ValeVision3D, on Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 14-Sep-2026 - Version 1.2.0
// - Collect also returns Categories, the Set of category names that ship
//   linework. Edges and Owners are unchanged. (1.1.0, the owner tags of
//   12-Sep-2026, was never logged here.)
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 4.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config and the Sampler's Name Matching
    // ------------------------------------------------------------
    import { Na__PlCfg__GetSkipObjectNames } from './Na__ProjectedLinework__ConfigAccess__.js';
    import { Na__PlSampler__NameMatches } from './Na__ProjectedLinework__StageSampler__.js';
    import { Na__PlOwners__IdFor }         from './Na__ProjectedLinework__Owners__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Loader Tags
    // ------------------------------------------------------------
    const Na__PlAuthored__TYPE_KEY      = 'Na__ModelType';
    const Na__PlAuthored__TYPE_LINEWORK = 'linework';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading Line Geometry
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Push Every Segment of One Line Object in Scene Space
    // ------------------------------------------------------------
    // Handles the fat line form (instanceStart / instanceEnd interleaved
    // attributes) and the plain LineSegments form (position pairs).
    // ------------------------------------------------------------
    function Na__PlAuthored__PushSegments(object3d, target) {
        const geometry = object3d.geometry;
        if (!geometry || !geometry.attributes) return 0;

        const e     = object3d.matrixWorld.elements;
        const start = geometry.attributes.instanceStart;
        const end   = geometry.attributes.instanceEnd;
        let   count = 0;

        const pushPoint = (x, y, z) => {
            const w = 1 / ((e[3] * x) + (e[7] * y) + (e[11] * z) + e[15]);
            target.push(
                ((e[0] * x) + (e[4] * y) + (e[8]  * z) + e[12]) * w,
                ((e[1] * x) + (e[5] * y) + (e[9]  * z) + e[13]) * w,
                ((e[2] * x) + (e[6] * y) + (e[10] * z) + e[14]) * w
            );
        };

        if (start && end) {
            const n = Math.min(start.count, end.count);
            for (let i = 0; i < n; i++) {
                pushPoint(start.getX(i), start.getY(i), start.getZ(i));
                pushPoint(end.getX(i),   end.getY(i),   end.getZ(i));
                count++;
            }
            return count;
        }

        const position = geometry.attributes.position;
        if (!position) return 0;
        const index = geometry.index;
        const total = index ? index.count : position.count;
        for (let i = 0; i + 1 < total; i += 2) {
            const a = index ? index.getX(i) : i;
            const b = index ? index.getX(i + 1) : (i + 1);
            pushPoint(position.getX(a), position.getY(a), position.getZ(a));
            pushPoint(position.getX(b), position.getY(b), position.getZ(b));
            count++;
        }
        return count;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Collection
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Does a Linework Root Hold Any Segment at All?
    // ------------------------------------------------------------
    // Visibility is deliberately not asked: this answers what the GLB brought,
    // for the Categories Set, not what is drawn this frame.
    // ------------------------------------------------------------
    function Na__PlAuthored__HoldsSegments(root) {
        let holds = false;
        root.traverse((node) => {
            if (holds) return;
            if (!(node.isLineSegments2 === true || node.isLineSegments === true || node.isLine === true)) return;
            const geometry = node.geometry;
            if (!geometry || !geometry.attributes) return;
            const start = geometry.attributes.instanceStart;
            if (start) { holds = start.count > 0; return; }
            const position = geometry.attributes.position;
            holds = !!position && (geometry.index ? geometry.index.count : position.count) >= 2;
        });
        return holds;
    }
    // ------------------------------------------------------------


    // FUNCTION | Gather the Authored Edges of the Model in Scene Space
    // ------------------------------------------------------------
    // rules: { excludeTokens, ownerTable }. Returns { Edges, Owners, Categories }
    // - Edges a Float64Array of six doubles per segment, Owners one category id
    // per segment or null when no table was supplied, Categories the Set of
    // category names that ship linework. Visibility is honoured up the tree
    // for the edges exactly as the sampler honours it for meshes; the Set asks
    // only whether the category itself is drawn.
    // ------------------------------------------------------------
    function Na__PlAuthored__Collect(modelRoot, rules) {
        const collected  = [];
        const ownerTable = (rules && rules.ownerTable) ? rules.ownerTable : null;
        const owners     = ownerTable ? [] : null;
        const categories = new Set();
        if (!modelRoot) return { Edges : new Float64Array(0), Owners : owners ? new Uint16Array(0) : null, Categories : categories };

        const excludeTokens = (rules && rules.excludeTokens) || [];
        const skipNames     = Na__PlCfg__GetSkipObjectNames();

        modelRoot.updateMatrixWorld(true);

        // THE CATEGORY TRAVELS DOWN THE STACK WITH THE OBJECT. The walk starts
        // at the model root's children, which ARE the categories, so every node
        // below one inherits its name - and the SketchUp-drawn linework inside a
        // wall group is tagged as a wall, the same as the wall's own hard edges.
        const stack = [];
        for (let i = 0; i < modelRoot.children.length; i++) {
            const category = modelRoot.children[i];
            if (category.visible === false) continue;
            if (Na__PlSampler__NameMatches(category.name, excludeTokens)) continue;
            stack.push({ object : category, category : category.name || '' });
        }

        while (stack.length > 0) {
            const entry    = stack.pop();
            const object3d = entry.object;
            const data       = object3d.userData || {};
            const isLinework = data[Na__PlAuthored__TYPE_KEY] === Na__PlAuthored__TYPE_LINEWORK;

            // Named before the visibility test, on purpose: see WHICH CATEGORIES
            // SHIP LINEWORK in the header.
            if (isLinework && !categories.has(entry.category) && Na__PlAuthored__HoldsSegments(object3d)) categories.add(entry.category);

            if (object3d.visible === false) continue;
            if (Na__PlSampler__NameMatches(object3d.name, skipNames)) continue;

            if (isLinework) {
                const ownerId  = ownerTable ? Na__PlOwners__IdFor(ownerTable, entry.category) : 0;
                const runStart = collected.length;
                object3d.traverse((node) => {
                    if (node.visible === false) return;
                    if (node.isLineSegments2 === true || node.isLineSegments === true || node.isLine === true) {
                        Na__PlAuthored__PushSegments(node, collected);
                    }
                });
                if (owners) {
                    const added = (collected.length - runStart) / 6;
                    for (let k = 0; k < added; k++) owners.push(ownerId);
                }
                continue;                                                        // <-- The root's subtree is done
            }

            const children = object3d.children;
            for (let c = 0; c < children.length; c++) stack.push({ object : children[c], category : entry.category });
        }

        return {
            Edges      : new Float64Array(collected),
            Owners     : owners ? new Uint16Array(owners) : null,
            Categories : categories
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Projected Linework Authored Edges API
    // ------------------------------------------------------------
    export {
        Na__PlAuthored__Collect
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
