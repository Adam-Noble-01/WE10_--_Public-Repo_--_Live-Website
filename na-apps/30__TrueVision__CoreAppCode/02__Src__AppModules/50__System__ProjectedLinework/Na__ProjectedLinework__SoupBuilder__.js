// =============================================================================
// TRUEVISION3D - PROJECTED LINEWORK - SOUP BUILDER
// =============================================================================
//
// FILE       : Na__ProjectedLinework__SoupBuilder__.js
// NAMESPACE  : Na__PlSoup
// MODULE     : Projected Linework - Soup Builder
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Turn the sampled triangles into the occluder set for one view
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - Takes the flat triangle list the stage sampler read out of the model,
//   turns it to face the view being drawn, throws away everything that cannot
//   occlude anything, and works out the per-triangle values the clip kernel
//   would otherwise recompute thousands of times.
// - Imports nothing but the tree builder next door, so the whole of it can
//   run on the main thread or inside a worker without a build step.
//
// - THE BACK FACE CULL LIVES HERE. The vendored library's cull compares a
//   number to a boolean and never culls anything; the Lantern Designer moved
//   the corrected test here so a culled triangle is never built, never
//   indexed and never placed in the tree (see the Lantern Designer notes in
//   the kernel header). Nothing about that changes in this port.
//
// - PERMUTATION OR ROTATION (D40). A right-angled view is a signed
//   permutation of the axes: moving three numbers about and flipping signs,
//   exact, no trigonometry. A free-bearing elevation is a rotation and takes
//   the matrix path, three multiplies per component. ViewMapFromBasis decides
//   which by inspecting the basis, so the caller never has to.
//
// - WHAT COMES OUT
//       Positions   9 doubles per triangle   a, b, c in view space
//       UpPlanes    4 doubles per triangle   normal and constant, always facing up
//       FlatAreas   1 double  per triangle   area once dropped onto the page
//       Heights     2 doubles per triangle   lowest and highest point
//       Bvh                                  tree over the triangles (FlatBvh)
//
// INTEGRATION:
// - Na__ProjectedLinework__CpuBackend__ builds one soup per view; the raster
//   preview builds a tree-less one.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 50__System__ProjectedLinework/Na__ProjectedLinework__SoupBuilder__.js
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

    // MODULE IMPORTS | Flat BVH (typed arrays only, worker safe)
    // ------------------------------------------------------------
    import { Na__ProjectedLinework__FlatBvh__Build } from './Na__ProjectedLinework__FlatBvh__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Material Side Codes (mirror three.js without importing it)
    // ------------------------------------------------------------
    const Na__PlSoup__SIDE_FRONT  = 0;
    const Na__PlSoup__SIDE_BACK   = 1;
    const Na__PlSoup__SIDE_DOUBLE = 2;
    // ------------------------------------------------------------

    // MODULE CONSTANTS | View Map Kinds
    // ------------------------------------------------------------
    const Na__PlSoup__MAP_PERMUTATION = 'permutation';
    const Na__PlSoup__MAP_ROTATION    = 'rotation';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | View Orientation
// -----------------------------------------------------------------------------

    // FUNCTION | Reduce a View Basis to a Map (permutation where it can be)
    // ------------------------------------------------------------
    // basis is { XAxisTo, YAxisTo, ZAxisTo }: the images of the three scene
    // axes, the columns Matrix4.makeBasis takes. A point turns as
    //
    //     view = p.x * XAxisTo + p.y * YAxisTo + p.z * ZAxisTo
    //
    // When every column is a signed unit axis exactly one term contributes to
    // each output component and the map is two small integer arrays:
    // view[d] = Sign[d] * p[Source[d]]. Otherwise the nine numbers are kept
    // as a row-major matrix and the rotation path multiplies them out.
    // ------------------------------------------------------------
    function Na__PlSoup__ViewMapFromBasis(basis) {
        const columns = [ basis.XAxisTo, basis.YAxisTo, basis.ZAxisTo ];
        const source  = new Int32Array(3);
        const sign    = new Float64Array(3);
        let   exact   = true;

        for (let out = 0; out < 3 && exact; out++) {
            source[out] = -1;
            for (let axis = 0; axis < 3; axis++) {
                const value = columns[axis][out];
                if (value === 0) continue;
                if (value !== 1 && value !== -1) { exact = false; break; }    // <-- A fraction: this is a rotation
                if (source[out] !== -1)          { exact = false; break; }    // <-- Two axes feeding one component: a rotation
                source[out] = axis;
                sign[out]   = value;
            }
            if (source[out] === -1) exact = false;
        }

        if (exact) return { Kind : Na__PlSoup__MAP_PERMUTATION, Source : source, Sign : sign };

        // Row d of the matrix is the coefficient of (p.x, p.y, p.z) in view[d].
        const matrix = new Float64Array(9);
        for (let out = 0; out < 3; out++) {
            matrix[out * 3]     = basis.XAxisTo[out];
            matrix[out * 3 + 1] = basis.YAxisTo[out];
            matrix[out * 3 + 2] = basis.ZAxisTo[out];
        }
        return { Kind : Na__PlSoup__MAP_ROTATION, Matrix : matrix };
    }
    // ------------------------------------------------------------


    // FUNCTION | Turn One Point Into View Space, Writing Three Numbers
    // ------------------------------------------------------------
    // Reads the point at source[at .. at+2] and writes view space into
    // target[to .. to+2]. Shared by the soup, the edge placement and the
    // section outline so every consumer turns a point the same way.
    // ------------------------------------------------------------
    function Na__PlSoup__TurnPoint(viewMap, source, at, target, to) {
        if (viewMap.Kind === Na__PlSoup__MAP_PERMUTATION) {
            target[to]     = viewMap.Sign[0] * source[at + viewMap.Source[0]];
            target[to + 1] = viewMap.Sign[1] * source[at + viewMap.Source[1]];
            target[to + 2] = viewMap.Sign[2] * source[at + viewMap.Source[2]];
            return;
        }

        const m = viewMap.Matrix;
        const x = source[at], y = source[at + 1], z = source[at + 2];
        target[to]     = (m[0] * x) + (m[1] * y) + (m[2] * z);
        target[to + 1] = (m[3] * x) + (m[4] * y) + (m[5] * z);
        target[to + 2] = (m[6] * x) + (m[7] * y) + (m[8] * z);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Soup Construction
// -----------------------------------------------------------------------------

    // FUNCTION | Build the Occluder Set and Its Tree for One View
    // ------------------------------------------------------------
    // stageTriangles is what the sampler produced: Vertices as nine doubles per
    // triangle in scene space, Sides as one code per triangle, and Inverted as
    // one flag per triangle recording whether its mesh carried a mirroring
    // transform.
    //
    // Two passes rather than one. The first decides what survives and writes
    // it, so the second, which needs bounding boxes for the tree, runs over the
    // kept set only.
    // ------------------------------------------------------------
    function Na__PlSoup__BuildViewSoup(stageTriangles, viewMap, options) {
        const settings    = options || {};
        const maxLeafSize = settings.MaxLeafSize;

        const sourceVerts = stageTriangles.Vertices;
        const sides       = stageTriangles.Sides;
        const inverted    = stageTriangles.Inverted;
        const sourceCount = stageTriangles.Count;

        const positions = new Float64Array(sourceCount * 9);
        const upPlanes  = new Float64Array(sourceCount * 4);
        const flatAreas = new Float64Array(sourceCount);
        const heights   = new Float64Array(sourceCount * 2);
        const bounds    = new Float64Array(sourceCount * 6);
        const turned    = new Float64Array(9);

        let kept = 0;

        for (let t = 0; t < sourceCount; t++) {
            const src = t * 9;

            // Turn the three corners to face the view. The permutation path
            // multiplies by a sign of exactly +1 or -1 and stays exact.
            Na__PlSoup__TurnPoint(viewMap, sourceVerts, src,     turned, 0);
            Na__PlSoup__TurnPoint(viewMap, sourceVerts, src + 3, turned, 3);
            Na__PlSoup__TurnPoint(viewMap, sourceVerts, src + 6, turned, 6);

            const ax = turned[0], ay = turned[1], az = turned[2];
            const bx = turned[3], by = turned[4], bz = turned[5];
            const cx = turned[6], cy = turned[7], cz = turned[8];

            // Normal exactly as three.js derives it, (c - b) crossed with (a - b),
            // so a triangle classifies here the way it would anywhere else.
            const ux = cx - bx, uy = cy - by, uz = cz - bz;
            const vx = ax - bx, vy = ay - by, vz = az - bz;

            let nx = (uy * vz) - (uz * vy);
            let ny = (uz * vx) - (ux * vz);
            let nz = (ux * vy) - (uy * vx);

            const lengthSq = (nx * nx) + (ny * ny) + (nz * nz);
            if (!(lengthSq > 0)) continue;                                       // <-- Degenerate triangle: no plane, no occlusion

            const inverseLength = 1 / Math.sqrt(lengthSq);
            nx *= inverseLength;
            ny *= inverseLength;
            nz *= inverseLength;

            // BACK FACE CULL | faceUp asks whether the triangle's outward side
            // is the side a viewer looking down would see. A mirroring
            // transform reverses winding, so it reverses the answer.
            const side = sides[t];
            if (side !== Na__PlSoup__SIDE_DOUBLE) {
                const faceUp = (ny > 0) !== (inverted[t] === 1);
                const wanted = (side !== Na__PlSoup__SIDE_BACK);
                if (faceUp !== wanted) continue;
            }

            const out = kept * 9;
            positions[out]     = ax;
            positions[out + 1] = ay;
            positions[out + 2] = az;
            positions[out + 3] = bx;
            positions[out + 4] = by;
            positions[out + 5] = bz;
            positions[out + 6] = cx;
            positions[out + 7] = cy;
            positions[out + 8] = cz;

            // The clip pass only ever asks which side of this plane a point is
            // on, and it always wants "beneath". Storing the upward facing form
            // removes a conditional flip from the innermost loop.
            const planeAt = kept * 4;
            if (ny < 0) {
                upPlanes[planeAt]     = -nx;
                upPlanes[planeAt + 1] = -ny;
                upPlanes[planeAt + 2] = -nz;
                upPlanes[planeAt + 3] = (nx * ax) + (ny * ay) + (nz * az);
            } else {
                upPlanes[planeAt]     = nx;
                upPlanes[planeAt + 1] = ny;
                upPlanes[planeAt + 2] = nz;
                upPlanes[planeAt + 3] = -((nx * ax) + (ny * ay) + (nz * az));
            }

            // Area once dropped onto the page: flattening zeroes the height so
            // the cross product keeps only its vertical component.
            flatAreas[kept] = Math.abs((uz * vx) - (ux * vz)) * 0.5;

            let minY = ay, maxY = ay;
            if (by < minY) minY = by; else if (by > maxY) maxY = by;
            if (cy < minY) minY = cy; else if (cy > maxY) maxY = cy;
            heights[kept * 2]     = minY;
            heights[kept * 2 + 1] = maxY;

            const boundsAt = kept * 6;
            bounds[boundsAt]     = Math.min(ax, bx, cx);
            bounds[boundsAt + 1] = minY;
            bounds[boundsAt + 2] = Math.min(az, bz, cz);
            bounds[boundsAt + 3] = Math.max(ax, bx, cx);
            bounds[boundsAt + 4] = maxY;
            bounds[boundsAt + 5] = Math.max(az, bz, cz);

            kept++;
        }

        // The raster preview wants the culled triangles and nothing else; a tree
        // it will never traverse is the single biggest cost in a picture that
        // has to feel instant.
        const tree = (settings.SkipTree === true)
            ? null
            : Na__ProjectedLinework__FlatBvh__Build(bounds.subarray(0, kept * 6), kept, { MaxLeafSize : maxLeafSize });

        return {
            TriCount    : kept,
            SourceCount : sourceCount,
            Positions   : positions.slice(0, kept * 9),
            UpPlanes    : upPlanes.slice(0, kept * 4),
            FlatAreas   : flatAreas.slice(0, kept),
            Heights     : heights.slice(0, kept * 2),
            Bvh         : tree
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | List the Buffers That Can Travel to a Worker
    // ------------------------------------------------------------
    // Returned as a list rather than transferred here, because a soup is sent
    // to several workers and a transfer would detach it after the first.
    // ------------------------------------------------------------
    function Na__PlSoup__Buffers(soup) {
        if (!soup.Bvh) return [ soup.Positions.buffer ];                         // <-- Tree-less preview soup: nothing else is read from it

        return [
            soup.Positions.buffer,
            soup.UpPlanes.buffer,
            soup.FlatAreas.buffer,
            soup.Heights.buffer,
            soup.Bvh.NodeBounds.buffer,
            soup.Bvh.NodeData.buffer,
            soup.Bvh.PrimIndex.buffer
        ];
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Projected Linework Soup Builder API
    // ------------------------------------------------------------
    export {
        Na__PlSoup__SIDE_FRONT,
        Na__PlSoup__SIDE_BACK,
        Na__PlSoup__SIDE_DOUBLE,
        Na__PlSoup__MAP_PERMUTATION,
        Na__PlSoup__MAP_ROTATION,
        Na__PlSoup__ViewMapFromBasis,
        Na__PlSoup__TurnPoint,
        Na__PlSoup__BuildViewSoup,
        Na__PlSoup__Buffers
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
