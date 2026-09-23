// =============================================================================
// TRUEVISION3D - PROJECTED LINEWORK - FLUSH JOINS
// =============================================================================
//
// FILE       : Na__ProjectedLinework__FlushJoins__.js
// NAMESPACE  : Na__PlFlush
// MODULE     : Projected Linework - Flush Joins
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Take out of the model's own edges the joins between two faces of one plane
// CREATED    : 14-Sep-2026
//
// DESCRIPTION:
// - WHAT A FLUSH JOIN IS. Two faces lying in one plane that meet along a line:
//   a wall band sitting flush on the wall below it, the pier between two
//   windows, a new wall carrying straight on from an old one. The mesh has an
//   edge there, because each piece has its own boundary, but nothing on the
//   surface changes across it - same plane, same facing, same depth. The live
//   3D view draws no line there (its SketchUp linework leaves the edge out and
//   its screen outline sees one unbroken surface), so a drawing should not
//   either.
//
// - WHAT IS NOT. An edge where the surface stops - the top of the ground box
//   against the sky, a parapet, the corner of a box - has faces of its plane on
//   one side only, and keeps its line; the 3D view draws that outline too. So
//   does a real crease, whose two faces lie in different planes. Only the
//   model's own edges pass through here: the authored SketchUp linework never
//   does, because a line the modeller left showing on a flat face is a line
//   they meant.
//
// - HOW. In view space, one edge at a time: every occluder triangle whose plane
//   holds the edge and one of whose sides lies along it contributes that side's
//   span, filed under the side of the edge the rest of the triangle lies on.
//   Where spans from both sides overlap, the edge is a flush join and that part
//   is cut out; the rest goes on to the clip kernel as before. Edge-on
//   triangles (no area on the page) are ignored: they are not surfaces anyone
//   sees. The tree is walked on the page footprint AND the edge's depth band,
//   so only triangles at the edge's own depth are ever read.
//
// - COINCIDENT MEANS WITHIN MODELLING TOLERANCE. A side lies along the edge,
//   and a triangle holds the edge in its plane, when they agree to 0.1 mm -
//   not to a micron. Two storeys' walls are flush because the modeller put
//   them flush; SketchUp merges points 0.0254 mm apart, and the GLB rounds
//   every position to a float32. A join tested at a micron finds one side
//   of itself and draws the seam (see 1.1.0 below).
//
// - Imports nothing and reads only the soup's typed arrays, like the clip
//   kernel, so it can move into a worker unchanged.
//
// INTEGRATION:
// - Na__ProjectedLinework__CpuBackend__ calls CutFlushJoins on each view's model
//   edges between building the soup and clipping, while options.HideFlushJoins
//   is on. Run Diff runs with it off: the vendored backends have no such pass.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : n/a - authored in TrueVision3D
// - Back-port     : PENDING to ValeVision3D, on Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 23-Sep-2026 - Version 1.1.0
// - Tolerances raised from machine epsilon to modelling tolerance: 1e-4 m
//   (0.1 mm) for the plane and for the line alike, where they were 1e-5 and
//   1e-6. RB05: the first floor walls' outer face starts 0.0000134 m above
//   the top of the slab they stand on - the SketchUp export of 21-Sep-2026
//   moved the storey by that much, which SketchUp (0.0254 mm tolerance)
//   cannot tell from flush - so the slab's top edge and the wall's bottom
//   edge each found a face on ONE side of the line only, and both drew: one
//   line across every elevation at first floor level, in the visible class,
//   owned by the walls and the floors. The ground floor seam, 0.00000024 m
//   out, was cut as before. Proved on the live soup: at 1e-6 the wall's side
//   lay 1.34e-5 off the slab's edge and filed nothing; at 1e-4 both sides
//   file the whole edge and it is cut. ProjectedLinework__Model__BuildToken
//   bumped with it, so every baked drawing re-renders under the new rule.
//
// 14-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Tolerances (scene units are metres)
    // ------------------------------------------------------------
    // MODELLING TOLERANCE, NOT MACHINE EPSILON. Two faces are flush when the
    // modeller put them flush, and SketchUp itself treats any two points within
    // 0.001" (0.0254 mm) as one point; the GLB then carries every position as a
    // float32, a grain of about 0.000005 m at house scale. RB05's first floor
    // walls stand 0.0000134 m above the slab under them - nothing anyone could
    // see in SketchUp or draw at any scale - and with a 1e-6 line tolerance
    // that seam drew a line across every elevation of the house (23-Sep-2026).
    // 1e-4 m is 0.1 mm: four times SketchUp's own tolerance, twenty times the
    // float32 grain, and a thousandth of a millimetre on paper at 1:100.
    const Na__PlFlush__PLANE_TOLERANCE = 1e-4;     // <-- Off a triangle's plane and still in it; the edge lift is 1e-6
    const Na__PlFlush__LINE_TOLERANCE  = 1e-4;     // <-- Off the edge's line on the page and still along it
    const Na__PlFlush__AREA_EPSILON    = 1e-12;    // <-- Page area below which a triangle is edge-on
    const Na__PlFlush__SPAN_EPSILON    = 1e-9;     // <-- Edge parameter below which a span, or a kept piece, is nothing
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Spans
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Merge a Flat List of [start, end] Spans
    // ------------------------------------------------------------
    // Spans that touch or overlap become one, so the pieces of a face
    // triangulated along the edge read as the single side they are.
    // ------------------------------------------------------------
    function Na__PlFlush__Merge(spans) {
        const pairs = [];
        for (let i = 0; i + 1 < spans.length; i += 2) pairs.push([ spans[i], spans[i + 1] ]);
        pairs.sort((a, b) => a[0] - b[0]);

        const merged = [];
        for (let i = 0; i < pairs.length; i++) {
            const last = merged.length - 2;
            if (last >= 0 && pairs[i][0] <= merged[last + 1] + Na__PlFlush__SPAN_EPSILON) {
                if (pairs[i][1] > merged[last + 1]) merged[last + 1] = pairs[i][1];
            } else {
                merged.push(pairs[i][0], pairs[i][1]);
            }
        }
        return merged;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where Two Merged Span Lists Overlap
    // ------------------------------------------------------------
    function Na__PlFlush__Overlap(a, b) {
        const out = [];
        let i = 0, j = 0;
        while (i < a.length && j < b.length) {
            const lo = Math.max(a[i], b[j]);
            const hi = Math.min(a[i + 1], b[j + 1]);
            if (hi - lo > Na__PlFlush__SPAN_EPSILON) out.push(lo, hi);
            if (a[i + 1] < b[j + 1]) i += 2; else j += 2;
        }
        return out;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Cutting
// -----------------------------------------------------------------------------

    // FUNCTION | Cut the Flush Joins Out of One View's Model Edges
    // ------------------------------------------------------------
    // soup   : Na__PlSoup__BuildViewSoup output (Positions, UpPlanes, FlatAreas, Bvh)
    // edges  : Na__PlEdges__ToViewSpace output ({ Count, Verts, Owners })
    // Returns the same shape. An edge with no flush join comes back untouched;
    // one with a join comes back as the pieces either side of it, each keeping
    // the owner tag of the edge it came from. Returns the input itself when
    // nothing was cut, so the common case copies nothing.
    // ------------------------------------------------------------
    function Na__PlFlush__CutFlushJoins(soup, edges) {
        if (!soup || !soup.Bvh || !edges || !(edges.Count > 0)) return edges;

        const positions  = soup.Positions;
        const upPlanes   = soup.UpPlanes;
        const flatAreas  = soup.FlatAreas;
        const nodeBounds = soup.Bvh.NodeBounds;
        const nodeData   = soup.Bvh.NodeData;
        const primIndex  = soup.Bvh.PrimIndex;
        const stack      = new Int32Array(soup.Bvh.NodeCount + 8);

        const verts     = edges.Verts;
        const owners    = edges.Owners || null;
        const out       = [];
        const outOwners = owners ? [] : null;
        const plus      = [];
        const minus     = [];
        let   cutEdges  = 0;

        const PT = Na__PlFlush__PLANE_TOLERANCE;
        const LT = Na__PlFlush__LINE_TOLERANCE;

        for (let e = 0; e < edges.Count; e++) {
            const v  = e * 6;
            const sx = verts[v],     sy = verts[v + 1], sz = verts[v + 2];
            const ex = verts[v + 3], ey = verts[v + 4], ez = verts[v + 5];
            const dx = ex - sx, dy = ey - sy, dz = ez - sz;
            const flatLength = Math.sqrt((dx * dx) + (dz * dz));

            const keepWhole = () => {
                out.push(sx, sy, sz, ex, ey, ez);
                if (outOwners) outOwners.push(owners[e]);
            };
            if (!(flatLength > 0)) { keepWhole(); continue; }

            const fx = dx / flatLength, fz = dz / flatLength;             // <-- The edge's direction on the page
            const ox = -fz,             oz = fx;                          // <-- Its page normal: which side a point is on

            const minX = Math.min(sx, ex) - LT, maxX = Math.max(sx, ex) + LT;
            const minZ = Math.min(sz, ez) - LT, maxZ = Math.max(sz, ez) + LT;
            const minY = Math.min(sy, ey) - PT, maxY = Math.max(sy, ey) + PT;

            plus.length  = 0;
            minus.length = 0;

            let stackSize = 0;
            stack[stackSize++] = 0;
            while (stackSize > 0) {
                const node = stack[--stackSize];
                const nb   = node * 6;
                if (nodeBounds[nb]     > maxX || nodeBounds[nb + 3] < minX) continue;
                if (nodeBounds[nb + 2] > maxZ || nodeBounds[nb + 5] < minZ) continue;
                if (nodeBounds[nb + 1] > maxY || nodeBounds[nb + 4] < minY) continue;   // <-- Only the edge's own depth band

                const count = nodeData[node * 2 + 1];
                if (count === 0) {
                    const left = nodeData[node * 2];
                    stack[stackSize++] = left;
                    stack[stackSize++] = left + 1;
                    continue;
                }

                const first = nodeData[node * 2];
                for (let s = first, last = first + count; s < last; s++) {
                    const t = primIndex[s];
                    if (flatAreas[t] <= Na__PlFlush__AREA_EPSILON) continue;   // <-- Edge-on: no surface on the page

                    const pl = t * 4;
                    const nx = upPlanes[pl], ny = upPlanes[pl + 1], nz = upPlanes[pl + 2], nc = upPlanes[pl + 3];
                    if (Math.abs((nx * sx) + (ny * sy) + (nz * sz) + nc) > PT) continue;     // <-- The edge must lie in this triangle's plane
                    if (Math.abs((nx * ex) + (ny * ey) + (nz * ez) + nc) > PT) continue;

                    const p = t * 9;
                    for (let corner = 0; corner < 3; corner++) {
                        const a = p + (corner * 3);
                        const b = p + (((corner + 1) % 3) * 3);
                        const c = p + (((corner + 2) % 3) * 3);

                        const da = (ox * (positions[a] - sx)) + (oz * (positions[a + 2] - sz));
                        const db = (ox * (positions[b] - sx)) + (oz * (positions[b + 2] - sz));
                        if (Math.abs(da) > LT || Math.abs(db) > LT) continue;  // <-- This side does not lie along the edge

                        const dc = (ox * (positions[c] - sx)) + (oz * (positions[c + 2] - sz));
                        if (Math.abs(dc) <= LT) break;                          // <-- Degenerate on the page after all

                        const ta = (((positions[a] - sx) * fx) + ((positions[a + 2] - sz) * fz)) / flatLength;
                        const tb = (((positions[b] - sx) * fx) + ((positions[b + 2] - sz) * fz)) / flatLength;
                        const lo = Math.max(0, Math.min(ta, tb));
                        const hi = Math.min(1, Math.max(ta, tb));
                        if (hi - lo > Na__PlFlush__SPAN_EPSILON) {
                            if (dc > 0) plus.push(lo, hi); else minus.push(lo, hi);
                        }
                        break;                                                  // <-- A real triangle has one side at most along a line
                    }
                }
            }

            if (plus.length === 0 || minus.length === 0) { keepWhole(); continue; }
            const flush = Na__PlFlush__Overlap(Na__PlFlush__Merge(plus), Na__PlFlush__Merge(minus));
            if (flush.length === 0) { keepWhole(); continue; }

            // EMIT WHAT IS NOT A JOIN. The complement of the flush spans, as
            // pieces of the original edge in view space.
            cutEdges++;
            let cursor = 0;
            const emit = (from, to) => {
                if (to - from <= Na__PlFlush__SPAN_EPSILON) return;
                out.push(sx + (dx * from), sy + (dy * from), sz + (dz * from), sx + (dx * to), sy + (dy * to), sz + (dz * to));
                if (outOwners) outOwners.push(owners[e]);
            };
            for (let i = 0; i < flush.length; i += 2) {
                emit(cursor, flush[i]);
                cursor = flush[i + 1];
            }
            emit(cursor, 1);
        }

        if (cutEdges === 0) return edges;
        return {
            Count    : out.length / 6,
            Verts    : new Float64Array(out),
            Owners   : outOwners ? new Uint16Array(outOwners) : null,
            CutEdges : cutEdges
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Projected Linework Flush Joins API
    // ------------------------------------------------------------
    export {
        Na__PlFlush__CutFlushJoins
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
