// =============================================================================
// TRUEVISION3D - PROJECTED LINEWORK - CLIP KERNEL
// =============================================================================
//
// FILE       : Na__ProjectedLinework__ClipKernel__.js
// NAMESPACE  : Na__ProjectedLinework__ClipKernel
// MODULE     : Projected Linework - Clip Kernel
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Decide which part of every edge is visible from directly above
// CREATED    : 07-Aug-2026
//
// DESCRIPTION:
// - The occlusion pass, and the one piece of this feature whose speed decides
//   whether the whole thing feels usable. Measured against the vendored library it
//   replaces, this was 86 percent of a seven to eleven second render.
// - Imports NOTHING. Every input is a typed array and every output is a typed
//   array, so the identical file runs on the main thread and inside a worker with
//   no import map, no bundler and no three.js.
//
// ---------------------------------------------------------------------------
//
// WHAT THE PASS ACTUALLY DECIDES
//
// Every edge is a straight segment in a space where the viewer is at +Y looking
// down. An edge is hidden wherever some triangle passes over it. So for each edge
// the pass accumulates the parametric ranges along it that are covered, merges
// them, and the VISIBLE linework is what is left: the complement.
//
// The two facts that make it tractable:
//
//   ORDER DOES NOT MATTER   Merging covered ranges is a union. Occluders can be
//                           visited in any order and the answer is the same, which
//                           is what makes both the early out below and sharding
//                           across workers exact rather than approximate.
//
//   EDGES ARE INDEPENDENT   Nothing an edge computes is read by another edge. The
//                           range [EdgeStart, EdgeEnd) handed to Clip is the whole
//                           of the parallelism story.
//
// ---------------------------------------------------------------------------
//
// THE FOUR CHANGES FROM THE VENDORED IMPLEMENTATION
//
// Each is here because it was measured or reasoned to be a real cost, and each is
// noted at the line it affects.
//
//   1  BACK FACE CULL FIXED
//      The vendored test reads `plane.normal.dot(UP) !== inverted`, comparing a
//      NUMBER to a BOOLEAN with strict inequality, which is true for every
//      triangle ever tested. Front side materials therefore never culled anything
//      and the pass carried roughly twice the occluders it was designed to. The
//      library's own WebGPU port has the correct predicate, so this is a
//      transcription slip upstream rather than a deliberate choice. The cull now
//      happens in the SoupBuilder, which simply does not emit culled triangles.
//
//   2  NO SEPARATING AXIS UPDATE
//      The vendored overlap test called a full ExtendedTriangle.update() per
//      candidate pair, computing four separating axes and their bounds, and then
//      read only the plane and the area. Both are hoisted per triangle here.
//
//   3  PER TRIANGLE WORK HOISTED
//      World vertices, the upward facing plane, the flattened area and the height
//      bounds are computed once per triangle per view instead of once per pair.
//      The vendored code re-fetched and re-transformed the same triangle for every
//      edge leaf that touched it, which on a plan view is hundreds of times.
//
//   4  COVERAGE EARLY OUT
//      An edge whose covered ranges have merged to exactly [0, 1] can never change
//      again: ranges are clamped into [0, 1] on entry and merged with exact min and
//      max, so no later range can widen it. The edge stops being tested at once.
//      Descent is ordered highest child first so that the tall occluder which
//      saturates an edge is usually found early.
//
// ---------------------------------------------------------------------------
//
// ON EXACTNESS
//
// This is a re-derivation, not a transcription, so it is NOT bit for bit identical
// to the vendored arithmetic - some expressions are algebraically rearranged and
// some normalisations proved redundant and removed. Differences are at the scale of
// double precision rounding, roughly fourteen orders of magnitude below the
// hundredth of a millimetre the SVG layer rounds to.
//
// That claim is not asserted, it is checked: the DiffHarness module renders the
// same lantern through this kernel and through the vendored library and reports
// every segment that moved. Run it after touching anything in this file.
//
// ---------------------------------------------------------------------------
//
// PUBLIC API:
//     Clip(soup, edges, edgeStart, edgeEnd, options)
//         -> { Segments, HiddenSegments, EdgesTested, PairsTested }
//
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 50__System__ProjectedLinework/Na__ProjectedLinework__ClipKernel__.js
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
// REGION | Projected Edges Clip Kernel Module
// =============================================================================

// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Numerical Tolerances
    // ------------------------------------------------------------
    // Carried across from the vendored implementation unchanged and deliberately.
    // They are not tuning knobs: they are the thresholds the geometry was validated
    // against, and the current linework is correct with these values. Changing one
    // is a change to the OUTPUT, not to the speed.
    const DISTANCE_EPSILON   =  1e-16;                                        // <-- On plane, on vertex and degenerate range tests
    const AREA_EPSILON       =  1e-16;                                        // <-- Flattened triangle too thin to occlude anything
    const SEGMENT_EPSILON    =  1e-10;                                        // <-- Trimmed sub segment too short to bother projecting
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Output Buffer Growth
    // ------------------------------------------------------------
    const INITIAL_SEGMENT_CAPACITY  =  4096;                                  // <-- In segments, so four floats each
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Segment Output Buffer
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Create a Growable Segment Sink
    // ------------------------------------------------------------
    // A projection runs to tens of thousands of segments and the count cannot be
    // known before the work is done. Doubling on demand costs a handful of copies
    // across a whole render, where a plain array of numbers would cost an object
    // header per segment and a conversion pass at the end.
    function Na__ProjectedLinework__ClipKernel__CreateSink() {
        return {
            Data  : new Float32Array(INITIAL_SEGMENT_CAPACITY * 4),
            Count : 0
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Append One Segment to a Sink
    // ------------------------------------------------------------
    function Na__ProjectedLinework__ClipKernel__Push(sink, x0, y0, x1, y1) {
        if ((sink.Count * 4) >= sink.Data.length) {
            const grown  =  new Float32Array(sink.Data.length * 2);
            grown.set(sink.Data);
            sink.Data  =  grown;
        }

        const at  =  sink.Count * 4;
        sink.Data[at]      =  x0;
        sink.Data[at + 1]  =  y0;
        sink.Data[at + 2]  =  x1;
        sink.Data[at + 3]  =  y1;
        sink.Count++;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Covered Range Accumulation
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Merge One Covered Range Into an Edge's Sorted List
    // ------------------------------------------------------------
    // ranges is a FLAT list of start, end pairs held in ascending start order with
    // no two entries touching. Flat rather than an array of pairs because this is
    // the most frequently mutated structure in the whole projection and a nested
    // array would allocate a two element array for every accepted overlap.
    //
    // The binary search finds the first entry starting after the new range, then
    // the walk merges every entry the new range touches. Identical semantics to the
    // vendored insertOverlap, including the min and max merge which is what makes
    // the accumulation order independent.
    function Na__ProjectedLinework__ClipKernel__InsertRange(ranges, start, end) {
        let low   =  0;
        let high  =  ranges.length >> 1;

        while (low < high) {
            const mid  =  (low + high) >>> 1;
            if (ranges[mid * 2] <= start) {
                low  =  mid + 1;
            } else {
                high  =  mid;
            }
        }

        let insertAt     =  (low > 0) ? (low - 1) : 0;                        // <-- Step back one: the previous range may reach into this one
        let removeCount  =  0;
        let mergedStart  =  start;
        let mergedEnd    =  end;

        for (let i = insertAt, count = ranges.length >> 1; i < count; i++) {
            const otherStart  =  ranges[i * 2];
            const otherEnd    =  ranges[i * 2 + 1];

            if (mergedStart <= otherEnd && mergedEnd >= otherStart) {
                if (otherStart < mergedStart) mergedStart  =  otherStart;
                if (otherEnd   > mergedEnd)   mergedEnd    =  otherEnd;
                removeCount++;
            } else if (mergedStart >= otherStart) {
                insertAt  =  i + 1;
            } else {
                break;
            }
        }

        ranges.splice(insertAt * 2, removeCount * 2, mergedStart, mergedEnd);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Whether an Edge Is Now Wholly Hidden
    // ------------------------------------------------------------
    // Exactly one range spanning exactly the whole edge. Ranges are clamped into
    // [0, 1] before insertion, so once this is true no later range can alter either
    // the covered set or its complement, and the edge can be abandoned immediately.
    function Na__ProjectedLinework__ClipKernel__IsFullyCovered(ranges) {
        return ranges.length === 2 && ranges[0] === 0 && ranges[1] === 1;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Clipping
// -----------------------------------------------------------------------------

    // FUNCTION | Clip a Range of Edges Against the Whole Triangle Soup
    // ------------------------------------------------------------
    // soup and edges are the flat structures built by SoupBuilder and EdgeExtractor.
    // edgeStart and edgeEnd bound the shard this call is responsible for; passing
    // the whole range runs the classic single threaded projection.
    //
    // options.ScaleDivisor converts world units to drawing millimetres, and
    // options.MinimumSegmentLengthMm drops the clipping crumbs that would otherwise
    // become round cap blobs on the drawing. Both are applied here rather than in a
    // later pass so the segment buffer that leaves this function is final.
    export function Na__ProjectedLinework__ClipKernel__Clip(soup, edges, edgeStart, edgeEnd, options) {
        const settings      =  options || {};
        const scaleDivisor  =  (typeof settings.ScaleDivisor === 'number' && settings.ScaleDivisor !== 0)
            ? settings.ScaleDivisor
            : 1;
        const minimumLength =  (typeof settings.MinimumSegmentLengthMm === 'number')
            ? settings.MinimumSegmentLengthMm
            : 0;
        const minimumLengthSq  =  minimumLength * minimumLength;
        const wantHidden       =  settings.IncludeHiddenEdges === true;

        const visibleSink  =  Na__ProjectedLinework__ClipKernel__CreateSink();
        const hiddenSink   =  wantHidden ? Na__ProjectedLinework__ClipKernel__CreateSink() : null;

        const positions  =  soup.Positions;
        const upPlanes   =  soup.UpPlanes;
        const flatAreas  =  soup.FlatAreas;
        const heights    =  soup.Heights;                                     // <-- Two doubles per triangle: minY then maxY
        const nodeBounds =  soup.Bvh.NodeBounds;
        const nodeData   =  soup.Bvh.NodeData;
        const primIndex  =  soup.Bvh.PrimIndex;

        const verts       =  edges.Verts;
        const stack       =  new Int32Array(soup.Bvh.NodeCount + 8);          // <-- A node is pushed at most once, so this cannot overflow
        const ranges      =  [];

        let edgesTested  =  0;
        let pairsTested  =  0;

        for (let e = edgeStart; e < edgeEnd; e++) {

            const v  =  e * 6;
            const sx  =  verts[v];
            const sy  =  verts[v + 1];
            const sz  =  verts[v + 2];
            const ex  =  verts[v + 3];
            const ey  =  verts[v + 4];
            const ez  =  verts[v + 5];

            const dx  =  ex - sx;
            const dy  =  ey - sy;
            const dz  =  ez - sz;

            const length3d  =  Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
            const flatLength =  Math.sqrt((dx * dx) + (dz * dz));
            if (!(length3d > 0) || !(flatLength > 0)) continue;               // <-- A vertical edge projects to a point and cannot be drawn

            const ux  =  dx / length3d;                                       // <-- Unit 3D direction, for the coplanar test during trimming
            const uy  =  dy / length3d;
            const uz  =  dz / length3d;

            const fx  =  dx / flatLength;                                     // <-- Unit direction of the edge once flattened onto the page
            const fz  =  dz / flatLength;

            const edgeMinY  =  (sy < ey) ? sy : ey;
            const edgeMinX  =  (sx < ex) ? sx : ex;
            const edgeMaxX  =  (sx > ex) ? sx : ex;
            const edgeMinZ  =  (sz < ez) ? sz : ez;
            const edgeMaxZ  =  (sz > ez) ? sz : ez;

            ranges.length  =  0;
            edgesTested++;

            // ------------------------------------------------------
            // Walk the triangle tree, gathering everything that passes over
            // this edge. The query region is the edge's footprint on the page
            // extended upwards without limit, which is why only the node's TOP
            // is compared against the edge and its underside is ignored.
            // ------------------------------------------------------
            let stackSize  =  0;
            stack[stackSize++]  =  0;

            while (stackSize > 0) {
                const node  =  stack[--stackSize];
                const nb    =  node * 6;

                if (nodeBounds[nb + 4] <= edgeMinY) continue;                 // <-- Wholly at or below the edge: nothing here can cover it
                if (nodeBounds[nb]     > edgeMaxX)  continue;
                if (nodeBounds[nb + 3] < edgeMinX)  continue;
                if (nodeBounds[nb + 2] > edgeMaxZ)  continue;
                if (nodeBounds[nb + 5] < edgeMinZ)  continue;

                const count  =  nodeData[node * 2 + 1];

                if (count === 0) {
                    const left   =  nodeData[node * 2];
                    const right  =  left + 1;

                    // Highest child first. The sooner a tall occluder is met, the
                    // sooner an edge underneath it saturates and the rest of the
                    // tree is skipped outright.
                    if (nodeBounds[left * 6 + 4] >= nodeBounds[right * 6 + 4]) {
                        stack[stackSize++]  =  right;
                        stack[stackSize++]  =  left;
                    } else {
                        stack[stackSize++]  =  left;
                        stack[stackSize++]  =  right;
                    }
                    continue;
                }

                const first  =  nodeData[node * 2];
                for (let s = first, last = first + count; s < last; s++) {
                    const t  =  primIndex[s];
                    pairsTested++;

                    if (heights[t * 2 + 1] <= edgeMinY) continue;             // <-- Same test as the node, now for the individual triangle

                    const p  =  t * 9;

                    // --------------------------------------------------
                    // An edge that IS one of this triangle's own edges is not
                    // occluded by it. Matching by position rather than by index
                    // because the edge may have come from a different mesh that
                    // happens to touch this one.
                    // --------------------------------------------------
                    let startMatches  =  false;
                    let endMatches    =  false;
                    for (let corner = 0; corner < 3; corner++) {
                        const c   =  p + corner * 3;
                        const cx  =  positions[c];
                        const cy  =  positions[c + 1];
                        const cz  =  positions[c + 2];

                        if (!startMatches) {
                            const ax  =  sx - cx, ay  =  sy - cy, az  =  sz - cz;
                            if (((ax * ax) + (ay * ay) + (az * az)) <= DISTANCE_EPSILON) startMatches  =  true;
                        }
                        if (!endMatches) {
                            const bx  =  ex - cx, by  =  ey - cy, bz  =  ez - cz;
                            if (((bx * bx) + (by * by) + (bz * bz)) <= DISTANCE_EPSILON) endMatches  =  true;
                        }
                        if (startMatches && endMatches) break;
                    }
                    if (startMatches && endMatches) continue;

                    // --------------------------------------------------
                    // Keep only the part of the edge that lies BENEATH the
                    // triangle's plane. The plane stored on the soup already
                    // faces upwards, so no flip is needed here.
                    // --------------------------------------------------
                    const pl  =  t * 4;
                    const nx  =  upPlanes[pl];
                    const ny  =  upPlanes[pl + 1];
                    const nz  =  upPlanes[pl + 2];
                    const nc  =  upPlanes[pl + 3];

                    const startDist  =  (nx * sx) + (ny * sy) + (nz * sz) + nc;
                    const endDist    =  (nx * ex) + (ny * ey) + (nz * ez) + nc;

                    const startBelow  =  startDist < 0;
                    const endBelow    =  endDist   < 0;

                    let b0x, b0y, b0z, b1x, b1y, b1z;

                    if (Math.abs((nx * ux) + (ny * uy) + (nz * uz)) < DISTANCE_EPSILON) {
                        // Edge runs parallel to the plane: it is either wholly
                        // under it or wholly not, with no crossing point.
                        if (Math.abs(startDist) < DISTANCE_EPSILON || !startBelow) continue;
                        b0x = sx; b0y = sy; b0z = sz;
                        b1x = ex; b1y = ey; b1z = ez;
                    } else if (startBelow && endBelow) {
                        b0x = sx; b0y = sy; b0z = sz;
                        b1x = ex; b1y = ey; b1z = ez;
                    } else if (!startBelow && !endBelow) {
                        continue;
                    } else {
                        const cross  =  -startDist / (endDist - startDist);
                        const hx  =  sx + (dx * cross);
                        const hy  =  sy + (dy * cross);
                        const hz  =  sz + (dz * cross);

                        if (startBelow) {
                            b0x = sx; b0y = sy; b0z = sz;
                            b1x = hx; b1y = hy; b1z = hz;
                        } else {
                            b0x = hx; b0y = hy; b0z = hz;
                            b1x = ex; b1y = ey; b1z = ez;
                        }
                    }

                    const bdx  =  b1x - b0x;
                    const bdy  =  b1y - b0y;
                    const bdz  =  b1z - b0z;
                    if (Math.sqrt((bdx * bdx) + (bdy * bdy) + (bdz * bdz)) < SEGMENT_EPSILON) continue;

                    // --------------------------------------------------
                    // Flattened overlap. Both shapes drop to the page and the
                    // question becomes a one dimensional one: which part of this
                    // sub segment lies inside the triangle's outline.
                    // --------------------------------------------------
                    if (flatAreas[t] <= AREA_EPSILON) continue;

                    const flatSpan  =  (bdx * fx) + (bdz * fz);               // <-- Signed length of the sub segment along the edge's page direction
                    if (!(flatSpan > 0)) continue;

                    // The cutting plane stands vertically along the sub segment.
                    // Its horizontal normal is the page direction turned a quarter
                    // turn, already unit length, so no normalise is needed.
                    const ox  =  -fz;
                    const oz  =   fx;

                    let hitCount  =  0;
                    let h0x = 0, h0z = 0, h1x = 0, h1z = 0;

                    for (let corner = 0; corner < 3; corner++) {
                        const ca  =  p + corner * 3;
                        const cb  =  p + (((corner + 1) % 3) * 3);

                        const p1x  =  positions[ca];
                        const p1z  =  positions[ca + 2];
                        const p2x  =  positions[cb];
                        const p2z  =  positions[cb + 2];

                        const d1  =  (ox * (p1x - b0x)) + (oz * (p1z - b0z));
                        const d2  =  (ox * (p2x - b0x)) + (oz * (p2z - b0z));

                        const on1  =  Math.abs(d1) < DISTANCE_EPSILON;
                        const on2  =  Math.abs(d2) < DISTANCE_EPSILON;

                        let hx2, hz2;
                        if (on1 && on2) {
                            continue;                                         // <-- Triangle side lies along the cut: the other two sides describe it
                        } else if (on1) {
                            hx2  =  p1x;
                            hz2  =  p1z;
                        } else if (on2) {
                            continue;                                         // <-- Counted when the next side reaches this same corner
                        } else if ((d1 < 0) === (d2 < 0)) {
                            continue;
                        } else {
                            const along  =  d1 / (d1 - d2);
                            hx2  =  p1x + ((p2x - p1x) * along);
                            hz2  =  p1z + ((p2z - p1z) * along);
                        }

                        if (hitCount === 0) {
                            h0x  =  hx2;
                            h0z  =  hz2;
                        } else {
                            h1x  =  hx2;
                            h1z  =  hz2;
                        }

                        hitCount++;
                        if (hitCount === 2) break;
                    }

                    if (hitCount !== 2) continue;

                    // Put the triangle's crossing in the same sense as the edge so
                    // the two spans can be compared as plain numbers.
                    let n0x = h0x, n0z = h0z, n1x = h1x, n1z = h1z;
                    if ((((h1x - h0x) * fx) + ((h1z - h0z) * fz)) < 0) {
                        n0x = h1x; n0z = h1z;
                        n1x = h0x; n1z = h0z;
                    }

                    const triNear  =  ((n0x - b0x) * fx) + ((n0z - b0z) * fz);
                    const triFar   =  ((n1x - b0x) * fx) + ((n1z - b0z) * fz);

                    if (flatSpan <= triNear) continue;                        // <-- Triangle starts after the sub segment ends
                    if (triFar   <= 0)       continue;                        // <-- Triangle ends before it starts

                    const coveredFrom  =  (triNear > 0)        ? triNear  : 0;
                    const coveredTo    =  (triFar  < flatSpan) ? triFar   : flatSpan;

                    // Back onto the ORIGINAL edge. The vendored code measures these
                    // as distances from the edge start, and so does this, so a
                    // point marginally off the line still lands in range.
                    const fromRatio  =  coveredFrom / flatSpan;
                    const toRatio    =  coveredTo   / flatSpan;

                    const q0x  =  b0x + (bdx * fromRatio) - sx;
                    const q0y  =  b0y + (bdy * fromRatio) - sy;
                    const q0z  =  b0z + (bdz * fromRatio) - sz;
                    const q1x  =  b0x + (bdx * toRatio)   - sx;
                    const q1y  =  b0y + (bdy * toRatio)   - sy;
                    const q1z  =  b0z + (bdz * toRatio)   - sz;

                    let t0  =  Math.sqrt((q0x * q0x) + (q0y * q0y) + (q0z * q0z)) / length3d;
                    let t1  =  Math.sqrt((q1x * q1x) + (q1y * q1y) + (q1z * q1z)) / length3d;

                    if (t0 < 0) t0  =  0; else if (t0 > 1) t0  =  1;
                    if (t1 < 0) t1  =  0; else if (t1 > 1) t1  =  1;

                    if (Math.abs(t0 - t1) <= DISTANCE_EPSILON) continue;

                    if (t0 <= t1) {
                        Na__ProjectedLinework__ClipKernel__InsertRange(ranges, t0, t1);
                    } else {
                        Na__ProjectedLinework__ClipKernel__InsertRange(ranges, t1, t0);
                    }

                    if (Na__ProjectedLinework__ClipKernel__IsFullyCovered(ranges)) {
                        stackSize  =  0;                                      // <-- Nothing further can change this edge
                        break;
                    }
                }
            }

            // ------------------------------------------------------
            // Emit. Visible linework is the complement of the covered set;
            // the covered set itself is the hidden line layer, produced only
            // when something has asked for it.
            // ------------------------------------------------------
            Na__ProjectedLinework__ClipKernel__EmitComplement(
                visibleSink, ranges, sx, sz, dx, dz, scaleDivisor, minimumLengthSq
            );

            if (hiddenSink) {
                Na__ProjectedLinework__ClipKernel__EmitRanges(
                    hiddenSink, ranges, sx, sz, dx, dz, scaleDivisor, minimumLengthSq
                );
            }
        }

        return {
            Segments       : visibleSink.Data.slice(0, visibleSink.Count * 4),
            HiddenSegments : hiddenSink ? hiddenSink.Data.slice(0, hiddenSink.Count * 4) : null,
            EdgesTested    : edgesTested,
            PairsTested    : pairsTested
        };
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Emit One Drawing Segment Between Two Edge Parameters
    // ------------------------------------------------------------
    // The projection is the drop of the two page axes, so the whole of it is
    // reading x and z and ignoring y. Dividing by the scale here means the buffer
    // that leaves the kernel is already in the millimetres every Env2d renderer
    // works in, needing no fitting, centring or scaling downstream.
    function Na__ProjectedLinework__ClipKernel__EmitOne(
        sink, fromRatio, toRatio, sx, sz, dx, dz, scaleDivisor, minimumLengthSq
    ) {
        // An edge that is wholly hidden has a complement of two EMPTY pieces, one
        // at each end, and the vendored implementation emitted both. They draw as
        // round cap blobs and the minimum length filter existed largely to sweep
        // them up afterwards. Refusing them here is cheaper and, since hidden edges
        // outnumber visible ones on most views, it is a real cut in output size.
        if (!(toRatio > fromRatio)) return;

        const x0  =  (sx + (dx * fromRatio)) / scaleDivisor;
        const y0  =  (sz + (dz * fromRatio)) / scaleDivisor;
        const x1  =  (sx + (dx * toRatio))   / scaleDivisor;
        const y1  =  (sz + (dz * toRatio))   / scaleDivisor;

        const wx  =  x1 - x0;
        const wy  =  y1 - y0;
        if (((wx * wx) + (wy * wy)) < minimumLengthSq) return;

        Na__ProjectedLinework__ClipKernel__Push(sink, x0, y0, x1, y1);
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Emit the Gaps Between Covered Ranges
    // ------------------------------------------------------------
    function Na__ProjectedLinework__ClipKernel__EmitComplement(
        sink, ranges, sx, sz, dx, dz, scaleDivisor, minimumLengthSq
    ) {
        let cursor  =  0;

        for (let i = 0, count = ranges.length >> 1; i < count; i++) {
            Na__ProjectedLinework__ClipKernel__EmitOne(
                sink, cursor, ranges[i * 2], sx, sz, dx, dz, scaleDivisor, minimumLengthSq
            );
            cursor  =  ranges[i * 2 + 1];
        }

        Na__ProjectedLinework__ClipKernel__EmitOne(
            sink, cursor, 1, sx, sz, dx, dz, scaleDivisor, minimumLengthSq
        );
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Emit the Covered Ranges Themselves
    // ------------------------------------------------------------
    function Na__ProjectedLinework__ClipKernel__EmitRanges(
        sink, ranges, sx, sz, dx, dz, scaleDivisor, minimumLengthSq
    ) {
        for (let i = 0, count = ranges.length >> 1; i < count; i++) {
            Na__ProjectedLinework__ClipKernel__EmitOne(
                sink, ranges[i * 2], ranges[i * 2 + 1], sx, sz, dx, dz, scaleDivisor, minimumLengthSq
            );
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

// endregion -------------------------------------------------------------------
