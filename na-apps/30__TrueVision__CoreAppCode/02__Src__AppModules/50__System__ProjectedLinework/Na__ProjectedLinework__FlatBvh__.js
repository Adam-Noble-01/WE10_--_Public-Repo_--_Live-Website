// =============================================================================
// TRUEVISION3D - PROJECTED LINEWORK - FLAT BVH
// =============================================================================
//
// FILE       : Na__ProjectedLinework__FlatBvh__.js
// NAMESPACE  : Na__ProjectedLinework__FlatBvh
// MODULE     : Projected Linework - Flat BVH
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : A bounding volume hierarchy held entirely in typed arrays
// CREATED    : 07-Aug-2026
//
// DESCRIPTION:
// - A binned SAH bounding volume hierarchy over an arbitrary list of primitive
//   bounding boxes, built into three flat typed arrays and nothing else.
// - Deliberately owns no classes, no vectors and no library types. The tree that
//   comes out of Build is a plain object of typed arrays which can be handed to a
//   worker with postMessage and used there with no reconstruction step.
//
// ---------------------------------------------------------------------------
//
// WHY THIS EXISTS RATHER THAN three-mesh-bvh
//
// three-mesh-bvh is an excellent tree and the application already uses it. It is
// not usable HERE for two specific reasons, neither of which is a criticism of it:
//
//   BARE SPECIFIERS   Its sources import 'three' by bare specifier. Import maps
//                     are document scoped, so a module worker cannot resolve that
//                     without a build step. Every module in the projection hot
//                     path is therefore written to import nothing at all, which
//                     keeps the no-bundler rule intact and keeps the worker entry
//                     a plain file the browser can load directly.
//
//   PRIMITIVE IDENTITY  MeshBVH reorders the geometry index it is given, and the
//                     clip pass needs a stable triangle number to look up hoisted
//                     per triangle data (up plane, flattened area, cull flag).
//                     Owning the permutation array here makes that lookup a plain
//                     array read instead of a bookkeeping exercise.
//
// ---------------------------------------------------------------------------
//
// NODE LAYOUT
//
// Two arrays, indexed by node number:
//
//     NodeBounds   6 doubles per node    minX minY minZ maxX maxY maxZ
//     NodeData     2 uint32 per node     [0] and [1] below
//
//                  LEAF      [0] = first primitive slot, [1] = primitive count
//                  INTERNAL  [0] = left child node number, [1] = 0
//
// A count of zero means internal, which is unambiguous because a leaf is never
// built empty. The two children of an internal node are always allocated as an
// adjacent pair, so the right child is the left child plus one and only one index
// needs storing. Node numbers are NOT otherwise contiguous with their parent -
// the build works from a stack rather than recursing, so a node's children can be
// allocated long before the node itself is written.
//
// PrimIndex is the permutation: slot number to caller primitive number. The build
// sorts this array in place and never touches the caller's own data.
//
// ---------------------------------------------------------------------------
//
// PUBLIC API:
//     Build(primitiveBounds, primitiveCount, options)  -> tree object
//
// Traversal deliberately lives in the clip kernel rather than here. A callback
// driven traverse would put a function call in the innermost loop of the whole
// projection, and the one query this tree ever serves - the upward shadow volume
// of an edge - can order its descent by node height, which a general traversal
// has no way to know it should do.
//
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 50__System__ProjectedLinework/Na__ProjectedLinework__FlatBvh__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 09-Sep-2026 - Version 1.0.0
// - Ported from the Lantern Designer projection engine for port Phase 4;
//   identifiers renamed to the TrueVision namespace and the header restyled.
//   The body is kept as the Lantern Designer wrote it so the kernel stays
//   diff-able against its source and the Diff harness remains meaningful.
//
// =============================================================================


// =============================================================================
// REGION | Projected Edges Flat BVH Module
// =============================================================================

// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Build Tuning
    // ------------------------------------------------------------
    // Sixteen bins is the usual place to sit on the SAH quality curve: the split
    // chosen is within a percent or so of a full sweep, at a fraction of the cost.
    //
    // DEFAULT_MAX_LEAF_SIZE is small on purpose. A node test in this tree is six
    // comparisons, while a primitive test in the clip kernel is a plane trim and a
    // projected overlap solve. Paying for more node tests to avoid triangle tests
    // is the right trade here, which is the opposite of the usual raytracing advice.
    const BIN_COUNT              =  16;
    const DEFAULT_MAX_LEAF_SIZE  =  4;
    const TRAVERSAL_COST         =  1.0;                                      // <-- Relative cost of visiting a node, for the SAH comparison
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Build
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Grow One Six Float Box to Contain Another
    // ------------------------------------------------------------
    function Na__ProjectedLinework__FlatBvh__Union(target, targetOffset, source, sourceOffset) {
        for (let axis = 0; axis < 3; axis++) {
            const low   =  source[sourceOffset + axis];
            const high  =  source[sourceOffset + axis + 3];

            if (low  < target[targetOffset + axis])      target[targetOffset + axis]      =  low;
            if (high > target[targetOffset + axis + 3])  target[targetOffset + axis + 3]  =  high;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Surface Area of a Six Float Box
    // ------------------------------------------------------------
    // Returns zero rather than a negative figure for an inverted box, which is the
    // state an empty bin is left in. A zero area bin contributes nothing to the SAH
    // sum, which is exactly the wanted behaviour.
    function Na__ProjectedLinework__FlatBvh__SurfaceArea(box, offset) {
        const dx  =  box[offset + 3] - box[offset];
        const dy  =  box[offset + 4] - box[offset + 1];
        const dz  =  box[offset + 5] - box[offset + 2];

        if (dx <= 0 && dy <= 0 && dz <= 0) return 0;

        const w  =  dx > 0 ? dx : 0;
        const h  =  dy > 0 ? dy : 0;
        const d  =  dz > 0 ? dz : 0;

        return 2 * ((w * h) + (h * d) + (d * w));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reset a Six Float Box to Empty
    // ------------------------------------------------------------
    function Na__ProjectedLinework__FlatBvh__ResetBox(box, offset) {
        box[offset]      =   Infinity;
        box[offset + 1]  =   Infinity;
        box[offset + 2]  =   Infinity;
        box[offset + 3]  =  -Infinity;
        box[offset + 4]  =  -Infinity;
        box[offset + 5]  =  -Infinity;
    }
    // ------------------------------------------------------------


    // FUNCTION | Build a Tree Over a List of Primitive Bounding Boxes
    // ------------------------------------------------------------
    // primitiveBounds is six doubles per primitive in the caller's own numbering.
    // Nothing about what the primitives ARE is known here, which is what lets the
    // same builder serve the triangle soup and, if ever wanted, an edge list.
    //
    // The work stack holds ranges rather than recursing, so a degenerate model that
    // splits badly cannot blow the call stack. A binary tree over N leaves has at
    // most 2N - 1 nodes, so the arrays are allocated once at that size and sliced
    // down at the end.
    export function Na__ProjectedLinework__FlatBvh__Build(primitiveBounds, primitiveCount, options) {
        const settings     =  options || {};
        const maxLeafSize  =  (typeof settings.MaxLeafSize === 'number' && settings.MaxLeafSize > 0)
            ? settings.MaxLeafSize
            : DEFAULT_MAX_LEAF_SIZE;

        const empty  =  {
            NodeBounds : new Float64Array(6),
            NodeData   : new Uint32Array(2),
            PrimIndex  : new Uint32Array(0),
            NodeCount  : 1,
            PrimCount  : 0
        };
        if (!primitiveCount) {
            Na__ProjectedLinework__FlatBvh__ResetBox(empty.NodeBounds, 0);
            return empty;
        }

        const maximumNodes  =  (2 * primitiveCount);
        const nodeBounds    =  new Float64Array(maximumNodes * 6);
        const nodeData      =  new Uint32Array(maximumNodes * 2);
        const primIndex     =  new Uint32Array(primitiveCount);

        // Centroids are read once per split test, so they are computed up front
        // rather than re-derived from the bounds every time a range is considered.
        const centroids  =  new Float64Array(primitiveCount * 3);
        for (let i = 0; i < primitiveCount; i++) {
            primIndex[i]  =  i;

            const b  =  i * 6;
            const c  =  i * 3;
            centroids[c]      =  (primitiveBounds[b]     + primitiveBounds[b + 3]) * 0.5;
            centroids[c + 1]  =  (primitiveBounds[b + 1] + primitiveBounds[b + 4]) * 0.5;
            centroids[c + 2]  =  (primitiveBounds[b + 2] + primitiveBounds[b + 5]) * 0.5;
        }

        const scratch  =  {
            BinBounds  : new Float64Array(BIN_COUNT * 6),
            BinCounts  : new Uint32Array(BIN_COUNT),
            LeftBounds : new Float64Array(BIN_COUNT * 6),
            LeftCounts : new Uint32Array(BIN_COUNT),
            RunningBox : new Float64Array(6),
            CentroidBox: new Float64Array(6)
        };

        let nodeCount  =  1;
        const stack    =  [ 0, 0, primitiveCount ];                           // <-- Triples of node number, range start, range end

        while (stack.length > 0) {
            const rangeEnd    =  stack.pop();
            const rangeStart  =  stack.pop();
            const nodeNumber  =  stack.pop();

            const boundsOffset  =  nodeNumber * 6;
            const dataOffset    =  nodeNumber * 2;
            const count         =  rangeEnd - rangeStart;

            // Node bounds are the union of the range, always, leaf or not.
            Na__ProjectedLinework__FlatBvh__ResetBox(nodeBounds, boundsOffset);
            for (let s = rangeStart; s < rangeEnd; s++) {
                Na__ProjectedLinework__FlatBvh__Union(nodeBounds, boundsOffset, primitiveBounds, primIndex[s] * 6);
            }

            const splitSlot  =  (count <= 1)
                ? -1
                : Na__ProjectedLinework__FlatBvh__ChooseSplit(
                    primitiveBounds, primIndex, centroids, rangeStart, rangeEnd,
                    nodeBounds, boundsOffset, maxLeafSize, scratch
                );

            if (splitSlot < 0) {
                nodeData[dataOffset]      =  rangeStart;                      // <-- Leaf: first slot and how many
                nodeData[dataOffset + 1]  =  count;
                continue;
            }

            const leftNode   =  nodeCount;
            const rightNode  =  nodeCount + 1;
            nodeCount  +=  2;

            nodeData[dataOffset]      =  leftNode;                            // <-- Internal: right child is leftNode + 1
            nodeData[dataOffset + 1]  =  0;

            stack.push(rightNode, splitSlot, rangeEnd);
            stack.push(leftNode, rangeStart, splitSlot);
        }

        // Sliced rather than viewed. A subarray keeps the oversized build buffer
        // alive behind it, and postMessage sends a view's WHOLE underlying buffer -
        // so a view would ship roughly twice the bytes to every worker.
        return {
            NodeBounds : nodeBounds.slice(0, nodeCount * 6),
            NodeData   : nodeData.slice(0, nodeCount * 2),
            PrimIndex  : primIndex,
            NodeCount  : nodeCount,
            PrimCount  : primitiveCount
        };
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Choose and Apply the Best Split for One Range
    // ------------------------------------------------------------
    // Returns the slot the right hand side begins at, or -1 to say make a leaf.
    // The range in primIndex is partitioned in place before returning.
    //
    // Binning is done on the CENTROID box rather than the node box. Splitting a
    // range whose centroids all sit in a corner of a large node box would otherwise
    // put every primitive in one bin and waste the split entirely.
    function Na__ProjectedLinework__FlatBvh__ChooseSplit(
        primitiveBounds, primIndex, centroids, rangeStart, rangeEnd,
        nodeBounds, boundsOffset, maxLeafSize, scratch
    ) {
        const count  =  rangeEnd - rangeStart;

        const centroidBox  =  scratch.CentroidBox;
        Na__ProjectedLinework__FlatBvh__ResetBox(centroidBox, 0);
        for (let s = rangeStart; s < rangeEnd; s++) {
            const c  =  primIndex[s] * 3;
            for (let axis = 0; axis < 3; axis++) {
                const value  =  centroids[c + axis];
                if (value < centroidBox[axis])      centroidBox[axis]      =  value;
                if (value > centroidBox[axis + 3])  centroidBox[axis + 3]  =  value;
            }
        }

        let axis   =  0;
        let extent =  centroidBox[3] - centroidBox[0];
        const extentY  =  centroidBox[4] - centroidBox[1];
        const extentZ  =  centroidBox[5] - centroidBox[2];
        if (extentY > extent) { axis  =  1; extent  =  extentY; }
        if (extentZ > extent) { axis  =  2; extent  =  extentZ; }

        // Every centroid in the same place: no split can separate them, so the only
        // sane options are a leaf or an arbitrary halving. A leaf is preferred until
        // it would be oversized, at which point halving at least keeps the tree
        // shallow.
        if (!(extent > 0)) {
            if (count <= maxLeafSize) return -1;
            return rangeStart + (count >> 1);
        }

        const binBounds   =  scratch.BinBounds;
        const binCounts   =  scratch.BinCounts;
        const leftBounds  =  scratch.LeftBounds;
        const leftCounts  =  scratch.LeftCounts;

        for (let b = 0; b < BIN_COUNT; b++) {
            binCounts[b]  =  0;
            Na__ProjectedLinework__FlatBvh__ResetBox(binBounds, b * 6);
        }

        const binScale  =  BIN_COUNT / extent;
        const axisLow   =  centroidBox[axis];

        for (let s = rangeStart; s < rangeEnd; s++) {
            const primitive  =  primIndex[s];
            let   bin        =  Math.floor((centroids[primitive * 3 + axis] - axisLow) * binScale);
            if (bin < 0)           bin  =  0;
            if (bin >= BIN_COUNT)  bin  =  BIN_COUNT - 1;

            binCounts[bin]++;
            Na__ProjectedLinework__FlatBvh__Union(binBounds, bin * 6, primitiveBounds, primitive * 6);
        }

        // Sweep left to right accumulating what a left hand side would look like,
        // then right to left comparing against it. Two linear passes, no nesting.
        const running  =  scratch.RunningBox;
        Na__ProjectedLinework__FlatBvh__ResetBox(running, 0);
        let runningCount  =  0;

        for (let b = 0; b < BIN_COUNT; b++) {
            if (binCounts[b] > 0) Na__ProjectedLinework__FlatBvh__Union(running, 0, binBounds, b * 6);
            runningCount  +=  binCounts[b];

            leftCounts[b]  =  runningCount;
            for (let k = 0; k < 6; k++) leftBounds[b * 6 + k]  =  running[k];
        }

        const parentArea  =  Na__ProjectedLinework__FlatBvh__SurfaceArea(nodeBounds, boundsOffset);
        const inverseArea =  parentArea > 0 ? (1 / parentArea) : 0;

        let bestCost  =  Infinity;
        let bestBin   =  -1;

        Na__ProjectedLinework__FlatBvh__ResetBox(running, 0);
        let rightCount  =  0;

        for (let b = BIN_COUNT - 1; b > 0; b--) {
            if (binCounts[b] > 0) Na__ProjectedLinework__FlatBvh__Union(running, 0, binBounds, b * 6);
            rightCount  +=  binCounts[b];

            const leftCount  =  leftCounts[b - 1];
            if (leftCount === 0 || rightCount === 0) continue;

            const cost  =  TRAVERSAL_COST + inverseArea * (
                (Na__ProjectedLinework__FlatBvh__SurfaceArea(leftBounds, (b - 1) * 6) * leftCount) +
                (Na__ProjectedLinework__FlatBvh__SurfaceArea(running, 0) * rightCount)
            );

            if (cost < bestCost) {
                bestCost  =  cost;
                bestBin   =  b;
            }
        }

        // A leaf costs one primitive test per primitive. If no split beats that, and
        // the range is small enough to be a leaf, stop here.
        if (bestBin < 0) {
            if (count <= maxLeafSize) return -1;
            return rangeStart + (count >> 1);
        }
        if (count <= maxLeafSize && bestCost >= count) return -1;

        // Partition in place. Anything that lands in a bin below the chosen boundary
        // goes left. The comparison repeats the binning arithmetic exactly so a
        // primitive cannot be binned one way here and another way above.
        let left   =  rangeStart;
        let right  =  rangeEnd - 1;

        while (left <= right) {
            const primitive  =  primIndex[left];
            let   bin        =  Math.floor((centroids[primitive * 3 + axis] - axisLow) * binScale);
            if (bin < 0)           bin  =  0;
            if (bin >= BIN_COUNT)  bin  =  BIN_COUNT - 1;

            if (bin < bestBin) {
                left++;
            } else {
                primIndex[left]   =  primIndex[right];
                primIndex[right]  =  primitive;
                right--;
            }
        }

        // A partition that put everything on one side would loop forever below.
        // Falling back to a halving keeps the build finite; it cannot happen given
        // the bin counts above, but the tree is built once and this costs nothing.
        if (left === rangeStart || left === rangeEnd) {
            if (count <= maxLeafSize) return -1;
            return rangeStart + (count >> 1);
        }

        return left;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

// endregion -------------------------------------------------------------------
