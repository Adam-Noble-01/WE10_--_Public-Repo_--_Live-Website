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
// INTEGRATION:
// - Na__ProjectedLinework__CpuBackend__ asks for the edges per model state
//   and runs them through the clip kernel as the authored class.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 50__System__ProjectedLinework/Na__ProjectedLinework__AuthoredEdges__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
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

    // FUNCTION | Gather the Authored Edges of the Model in Scene Space
    // ------------------------------------------------------------
    // rules: { excludeTokens }. Returns a Float64Array of six doubles per
    // segment. Visibility is honoured up the tree exactly as the sampler
    // honours it for meshes.
    // ------------------------------------------------------------
    function Na__PlAuthored__Collect(modelRoot, rules) {
        const collected = [];
        if (!modelRoot) return new Float64Array(0);

        const excludeTokens = (rules && rules.excludeTokens) || [];
        const skipNames     = Na__PlCfg__GetSkipObjectNames();

        modelRoot.updateMatrixWorld(true);

        const stack = [];
        for (let i = 0; i < modelRoot.children.length; i++) {
            const category = modelRoot.children[i];
            if (category.visible === false) continue;
            if (Na__PlSampler__NameMatches(category.name, excludeTokens)) continue;
            stack.push(category);
        }

        while (stack.length > 0) {
            const object3d = stack.pop();
            if (object3d.visible === false) continue;
            if (Na__PlSampler__NameMatches(object3d.name, skipNames)) continue;

            const data       = object3d.userData || {};
            const isLinework = data[Na__PlAuthored__TYPE_KEY] === Na__PlAuthored__TYPE_LINEWORK;

            if (isLinework) {
                object3d.traverse((node) => {
                    if (node.visible === false) return;
                    if (node.isLineSegments2 === true || node.isLineSegments === true || node.isLine === true) {
                        Na__PlAuthored__PushSegments(node, collected);
                    }
                });
                continue;                                                        // <-- The root's subtree is done
            }

            const children = object3d.children;
            for (let c = 0; c < children.length; c++) stack.push(children[c]);
        }

        return new Float64Array(collected);
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
