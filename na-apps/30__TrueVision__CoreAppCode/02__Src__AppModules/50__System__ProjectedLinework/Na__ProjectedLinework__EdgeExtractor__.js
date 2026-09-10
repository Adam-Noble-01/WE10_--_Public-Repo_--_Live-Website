// =============================================================================
// TRUEVISION3D - PROJECTED LINEWORK - EDGE EXTRACTOR
// =============================================================================
//
// FILE       : Na__ProjectedLinework__EdgeExtractor__.js
// NAMESPACE  : Na__PlEdges
// MODULE     : Projected Linework - Edge Extractor
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Find the lines worth drawing before anything decides what hides them
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - Produces the candidate linework of the model: the hard creases, the
//   silhouette against the view, and the lines where two solids cut through
//   one another. Everything the clip kernel later trims comes from here.
//
// - THE THREE KINDS OF LINE
//     HARD EDGE      Two faces meet at more than the threshold angle. A
//                    property of the model alone, found once per geometry and
//                    reused for every view and every instance.
//     SILHOUETTE     Two faces meet gently but one turns towards the viewer
//                    and the other away. The only part that depends on the
//                    view, and a sign comparison over data already in hand.
//     INTERSECTION   Two separate solids pass through one another. Computed
//                    once per model state and reused by every view, because
//                    the pass expresses each pair in the frame of the first
//                    mesh and a rotation of both cancels out.
//
// - INSTANCES, NOT MESHES. The sampler hands over { geometry, matrixWorld }
//   pairs so an InstancedMesh contributes one pair per instance. Every
//   per-geometry analysis is cached in a WeakMap, so a house with two hundred
//   identical windows analyses one window.
//
// - AUTHORED EDGES. Geometry carrying Na__AuthoredEdges in its userData (the
//   soften, smooth and hide state a future GLB export may attach) overrides
//   the angle threshold, exactly as the Lantern Designer honours its own
//   component metadata. No TrueVision GLB carries it yet; the branch is kept
//   so the day one does nothing has to change here.
//
// - VIEW PLACEMENT takes the soup builder's view map, so a free-bearing
//   elevation places its edges by the same rotation the occluders turned by.
//
// INTEGRATION:
// - Na__ProjectedLinework__CpuBackend__ drives all three extractions.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 50__System__ProjectedLinework/Na__ProjectedLinework__EdgeExtractor__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.1.0
// - Intersection pass takes a pair budget and a self-test triangle cap; over budget it is skipped and reported.
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 4.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js Core and Bounds Trees
    // ------------------------------------------------------------
    import * as THREE from 'three';
    import { MeshBVH } from 'three-mesh-bvh';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Vendored Triangle Intersection Routine
    // ------------------------------------------------------------
    // The one piece of the vendored generator still called directly: robust
    // tri-tri intersection is not worth re-deriving.
    // ------------------------------------------------------------
    import { generateIntersectionEdges }
        from '../../04__Lib__ThirdParty__VersionLocked/04__Vendor__ThreeEdgeProjection__v0.0.10/src/utils/generateIntersectionEdges.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | View Map Placement
    // ------------------------------------------------------------
    import { Na__PlSoup__TurnPoint } from './Na__ProjectedLinework__SoupBuilder__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Tolerances Carried From the Vendored Implementation
    // ------------------------------------------------------------
    const Na__PlEdges__HASH_DECIMALS      = 4;
    const Na__PlEdges__HASH_PRECISION     = Math.pow(10, Na__PlEdges__HASH_DECIMALS);
    const Na__PlEdges__FACING_EPSILON     = 1e-10;    // <-- Below this a face counts as edge-on to the view
    const Na__PlEdges__DEGENERATE_EPSILON = 1e-16;    // <-- An edge this close to vertical projects to a point
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Authored Edge Classification (future GLB metadata)
    // ------------------------------------------------------------
    const Na__PlEdges__AUTHORED_KEY        = 'Na__AuthoredEdges';
    const Na__PlEdges__AUTHORED_ALWAYS     = 0;
    const Na__PlEdges__AUTHORED_SILHOUETTE = 1;
    const Na__PlEdges__AUTHORED_NEVER      = 2;
    // ------------------------------------------------------------

    // MODULE VARIABLES | Per Geometry Caches (weak, so a dropped geometry takes them with it)
    // ------------------------------------------------------------
    const Na__PlEdges__Candidates        = new WeakMap();   // <-- geometry -> { ThresholdAngle, Always, Conditional }
    const Na__PlEdges__AuthoredCache     = new WeakMap();   // <-- geometry -> Map of hashed authored edges
    const Na__PlEdges__SelfIntersections = new WeakMap();   // <-- geometry -> local-space self cut lines
    // ------------------------------------------------------------

    // MODULE VARIABLES | Reusable Scratch
    // ------------------------------------------------------------
    const Na__PlEdges__InverseMatrix  = new THREE.Matrix4();
    const Na__PlEdges__LocalDirection = new THREE.Vector3();
    const Na__PlEdges__BToA           = new THREE.Matrix4();
    const Na__PlEdges__Identity       = new THREE.Matrix4();
    const Na__PlEdges__Pair           = new Float64Array(6);
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Per Geometry Candidate Analysis
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Hash the Authored Edge List Under This Module's Own Rule
    // ------------------------------------------------------------
    // Returns null when the geometry carries no authored data, which is the
    // signal to fall back to the angle threshold.
    // ------------------------------------------------------------
    function Na__PlEdges__AuthoredMap(geometry) {
        const attached = geometry.userData ? geometry.userData[Na__PlEdges__AUTHORED_KEY] : null;
        if (!attached || !attached.Coords || !attached.Modes) return null;

        const cached = Na__PlEdges__AuthoredCache.get(geometry);
        if (cached) return cached;

        const coords = attached.Coords;
        const modes  = attached.Modes;
        const map    = new Map();
        const P      = Na__PlEdges__HASH_PRECISION;

        for (let i = 0, m = 0; i + 5 < coords.length; i += 6, m++) {
            const startHash = Math.round(coords[i] * P) + ',' + Math.round(coords[i + 1] * P) + ',' + Math.round(coords[i + 2] * P);
            const endHash   = Math.round(coords[i + 3] * P) + ',' + Math.round(coords[i + 4] * P) + ',' + Math.round(coords[i + 5] * P);
            if (startHash === endHash) continue;
            map.set(startHash + '_' + endHash, modes[m]);
            map.set(endHash + '_' + startHash, modes[m]);
        }

        Na__PlEdges__AuthoredCache.set(geometry, map);
        return map;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Analyse One Geometry Into Always and Conditional Edges
    // ------------------------------------------------------------
    // An edge whose faces already meet sharply enough is an edge from every
    // direction and is settled here. Only the gentle joins carry their two
    // face normals forward (12 doubles per edge) to be tested per view. A
    // boundary edge, one with no second face, is always drawn.
    // ------------------------------------------------------------
    function Na__PlEdges__Analyse(geometry, thresholdAngle) {
        const cached = Na__PlEdges__Candidates.get(geometry);
        if (cached && cached.ThresholdAngle === thresholdAngle) return cached;

        const positionAttr = geometry.attributes.position;
        const indexAttr    = geometry.index;
        const indexCount   = indexAttr ? indexAttr.count : positionAttr.count;
        const thresholdDot = Math.cos(THREE.MathUtils.DEG2RAD * thresholdAngle);
        const authored     = Na__PlEdges__AuthoredMap(geometry);
        const P            = Na__PlEdges__HASH_PRECISION;

        const always      = [];
        const conditional = [];
        const edgeData    = {};

        const ax = [ 0, 0, 0 ], ay = [ 0, 0, 0 ], az = [ 0, 0, 0 ];
        const hashes = [ '', '', '' ];
        const slots  = [ 0, 0, 0 ];

        for (let i = 0; i < indexCount; i += 3) {
            for (let corner = 0; corner < 3; corner++) {
                const vertex  = indexAttr ? indexAttr.getX(i + corner) : (i + corner);
                slots[corner] = vertex;
                ax[corner]    = positionAttr.getX(vertex);
                ay[corner]    = positionAttr.getY(vertex);
                az[corner]    = positionAttr.getZ(vertex);
                hashes[corner] = Math.round(ax[corner] * P) + ',' + Math.round(ay[corner] * P) + ',' + Math.round(az[corner] * P);
            }

            if (hashes[0] === hashes[1] || hashes[1] === hashes[2] || hashes[2] === hashes[0]) continue;

            // Normal as three.js derives it: (c - b) crossed with (a - b).
            const ux = ax[2] - ax[1], uy = ay[2] - ay[1], uz = az[2] - az[1];
            const vx = ax[0] - ax[1], vy = ay[0] - ay[1], vz = az[0] - az[1];

            let nx = (uy * vz) - (uz * vy);
            let ny = (uz * vx) - (ux * vz);
            let nz = (ux * vy) - (uy * vx);

            const lengthSq = (nx * nx) + (ny * ny) + (nz * nz);
            if (lengthSq > 0) {
                const inverseLength = 1 / Math.sqrt(lengthSq);
                nx *= inverseLength; ny *= inverseLength; nz *= inverseLength;
            } else {
                nx = 0; ny = 0; nz = 0;
            }

            for (let j = 0; j < 3; j++) {
                const jNext       = (j + 1) % 3;
                const hash        = hashes[j] + '_' + hashes[jNext];
                const reverseHash = hashes[jNext] + '_' + hashes[j];
                const partner     = edgeData[reverseHash];

                if (partner) {
                    const dot          = (nx * partner.Nx) + (ny * partner.Ny) + (nz * partner.Nz);
                    const authoredMode = authored ? authored.get(hash) : undefined;

                    if (authoredMode === Na__PlEdges__AUTHORED_NEVER) {
                        // Hidden by hand. Draws in no view, silhouette included.
                    } else if (authoredMode === Na__PlEdges__AUTHORED_ALWAYS || (authoredMode === undefined && dot <= thresholdDot)) {
                        always.push(ax[j], ay[j], az[j], ax[jNext], ay[jNext], az[jNext]);
                    } else {
                        conditional.push(
                            ax[j], ay[j], az[j], ax[jNext], ay[jNext], az[jNext],
                            nx, ny, nz, partner.Nx, partner.Ny, partner.Nz
                        );
                    }

                    edgeData[reverseHash] = null;
                } else if (!(hash in edgeData)) {
                    edgeData[hash] = { Slot0 : slots[j], Slot1 : slots[jNext], Nx : nx, Ny : ny, Nz : nz };
                }
            }
        }

        // Anything still unmatched is a boundary edge and is always drawn,
        // unless the author hid it by hand.
        for (const key in edgeData) {
            const entry = edgeData[key];
            if (!entry) continue;
            if (authored && authored.get(key) === Na__PlEdges__AUTHORED_NEVER) continue;
            always.push(
                positionAttr.getX(entry.Slot0), positionAttr.getY(entry.Slot0), positionAttr.getZ(entry.Slot0),
                positionAttr.getX(entry.Slot1), positionAttr.getY(entry.Slot1), positionAttr.getZ(entry.Slot1)
            );
        }

        const result = {
            ThresholdAngle : thresholdAngle,
            Always         : new Float64Array(always),
            Conditional    : new Float64Array(conditional)
        };
        Na__PlEdges__Candidates.set(geometry, result);
        return result;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Hard and Silhouette Extraction
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Transform One Candidate Edge Into Scene Space
    // ------------------------------------------------------------
    function Na__PlEdges__PushWorld(target, e, source, offset) {
        for (let end = 0; end < 2; end++) {
            const at = offset + (end * 3);
            const x = source[at], y = source[at + 1], z = source[at + 2];
            const w = 1 / ((e[3] * x) + (e[7] * y) + (e[11] * z) + e[15]);
            target.push(
                ((e[0] * x) + (e[4] * y) + (e[8]  * z) + e[12]) * w,
                ((e[1] * x) + (e[5] * y) + (e[9]  * z) + e[13]) * w,
                ((e[2] * x) + (e[6] * y) + (e[10] * z) + e[14]) * w
            );
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Extract Hard and Silhouette Edges in Scene Space
    // ------------------------------------------------------------
    // upX/Y/Z is the viewer direction in scene space (the vector the view
    // sends to +Y). It is turned into each instance's own frame once, so the
    // silhouette test is answered against normals that were never transformed.
    // ------------------------------------------------------------
    function Na__PlEdges__ExtractStageEdges(instances, upX, upY, upZ, thresholdAngle) {
        const collected = [];

        for (let m = 0; m < instances.length; m++) {
            const instance   = instances[m];
            const candidates = Na__PlEdges__Analyse(instance.geometry, thresholdAngle);
            const e          = instance.matrixWorld.elements;

            Na__PlEdges__LocalDirection.set(upX, upY, upZ);
            Na__PlEdges__InverseMatrix.copy(instance.matrixWorld).invert();
            Na__PlEdges__LocalDirection.transformDirection(Na__PlEdges__InverseMatrix);

            const px = Na__PlEdges__LocalDirection.x;
            const py = Na__PlEdges__LocalDirection.y;
            const pz = Na__PlEdges__LocalDirection.z;

            const always = candidates.Always;
            for (let i = 0; i < always.length; i += 6) {
                Na__PlEdges__PushWorld(collected, e, always, i);
            }

            const conditional = candidates.Conditional;
            for (let i = 0; i < conditional.length; i += 12) {
                let thisDot  = (px * conditional[i + 6]) + (py * conditional[i + 7])  + (pz * conditional[i + 8]);
                let otherDot = (px * conditional[i + 9]) + (py * conditional[i + 10]) + (pz * conditional[i + 11]);

                if (Math.abs(thisDot)  < Na__PlEdges__FACING_EPSILON) thisDot  = 0;
                if (Math.abs(otherDot) < Na__PlEdges__FACING_EPSILON) otherDot = 0;

                // One face turned towards the viewer and the other away means
                // the outline of the solid breaks along this edge.
                if (Math.sign(thisDot) === Math.sign(otherDot)) continue;

                Na__PlEdges__PushWorld(collected, e, conditional, i);
            }
        }

        return new Float64Array(collected);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Intersection Extraction
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | An Instance's Bounding Box in Scene Space
    // ------------------------------------------------------------
    function Na__PlEdges__WorldBox(instance) {
        const geometry = instance.geometry;
        if (!geometry.boundingBox) geometry.computeBoundingBox();
        return new THREE.Box3().copy(geometry.boundingBox).applyMatrix4(instance.matrixWorld);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Whether Two Scene Space Boxes Touch At All
    // ------------------------------------------------------------
    function Na__PlEdges__BoxesOverlap(a, b) {
        return !(a.max.x < b.min.x || a.min.x > b.max.x ||
                 a.max.y < b.min.y || a.min.y > b.max.y ||
                 a.max.z < b.min.z || a.min.z > b.max.z);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Bounds Tree a Geometry Already Has, or a New One
    // HELPER FUNCTION | Triangles in a Geometry (indexed or not)
    // ------------------------------------------------------------
    function Na__PlEdges__TriangleCount(geometry) {
        if (!geometry) return 0;
        if (geometry.index) return Math.floor(geometry.index.count / 3);
        const position = geometry.getAttribute ? geometry.getAttribute('position') : null;
        return position ? Math.floor(position.count / 3) : 0;
    }
    // ------------------------------------------------------------


    // ------------------------------------------------------------
    function Na__PlEdges__BoundsTree(geometry) {
        if (geometry.boundsTree) return geometry.boundsTree;
        geometry.boundsTree = new MeshBVH(geometry, { maxLeafSize : 1 });
        return geometry.boundsTree;
    }
    // ------------------------------------------------------------


    // FUNCTION | Extract the Lines Where Solids Cut Through One Another
    // ------------------------------------------------------------
    // Self intersections are a property of the geometry and cached per
    // geometry; separated solids (world boxes that miss) are never tested.
    // slicer, when supplied, is awaited between pairs so a large model does
    // not hold the interface for the whole pass.
    // ------------------------------------------------------------
    async function Na__PlEdges__ExtractIntersectionEdges(instances, slicer, report, limits) {
        const collected = [];
        const boxes     = [];
        const maxPairs  = (limits && Number.isFinite(limits.MaxPairs) && limits.MaxPairs > 0) ? limits.MaxPairs : Infinity;
        const selfCap   = (limits && Number.isFinite(limits.SelfMaxTriangles) && limits.SelfMaxTriangles > 0) ? limits.SelfMaxTriangles : Infinity;
        for (let i = 0; i < instances.length; i++) boxes.push(Na__PlEdges__WorldBox(instances[i]));

        // BUDGET | Count the overlapping pairs first (a box test each); a
        // model over the budget skips the whole pass rather than running it
        // for minutes, and the report says so.
        let overlapping = 0;
        for (let i = 0; i < instances.length && overlapping <= maxPairs; i++) {
            for (let j = i + 1; j < instances.length; j++) if (Na__PlEdges__BoxesOverlap(boxes[i], boxes[j])) overlapping++;
        }
        if (overlapping > maxPairs) {
            console.info('[TrueVision3D ProjectedLinework] Intersection edges skipped: over ' + maxPairs + ' overlapping instance pairs (ProjectedLinework__Projection__IntersectionMaxPairs).');
            if (report) { report.PairsTested = 0; report.PairsSkipped = overlapping; report.SelfReused = 0; report.IntersectionSkipped = 'pairs'; }
            return new Float64Array(0);
        }

        let pairsTested = 0, pairsSkipped = 0, selfReused = 0, selfSkipped = 0;
        for (let i = 0; i < instances.length; i++) {
            const instanceA = instances[i];
            const bvhA      = Na__PlEdges__BoundsTree(instanceA.geometry);
            if (slicer) await slicer.Tick();
            let selfLocal = Na__PlEdges__SelfIntersections.get(instanceA.geometry);
            if (selfLocal) {
                selfReused++;
            } else if (Na__PlEdges__TriangleCount(instanceA.geometry) > selfCap) {
                selfLocal = new Float64Array(0);                                 // <-- A terrain or a wall shell: too large to fold-test
                Na__PlEdges__SelfIntersections.set(instanceA.geometry, selfLocal);
                selfSkipped++;
            } else {
                Na__PlEdges__Identity.identity();
                const found = generateIntersectionEdges(bvhA, bvhA, Na__PlEdges__Identity, []);
                selfLocal = new Float64Array(found.length * 6);
                for (let k = 0; k < found.length; k++) {
                    const line = found[k];
                    selfLocal[k * 6]     = line.start.x;
                    selfLocal[k * 6 + 1] = line.start.y;
                    selfLocal[k * 6 + 2] = line.start.z;
                    selfLocal[k * 6 + 3] = line.end.x;
                    selfLocal[k * 6 + 4] = line.end.y;
                    selfLocal[k * 6 + 5] = line.end.z;
                }
                Na__PlEdges__SelfIntersections.set(instanceA.geometry, selfLocal);
                pairsTested++;
            }
            for (let s = 0; s < selfLocal.length; s += 6) {
                Na__PlEdges__PushWorld(collected, instanceA.matrixWorld.elements, selfLocal, s);
            }
            for (let j = i + 1; j < instances.length; j++) {
                if (!Na__PlEdges__BoxesOverlap(boxes[i], boxes[j])) { pairsSkipped++; continue; }
                if (slicer) await slicer.Tick();
                pairsTested++;
                const instanceB = instances[j];
                const bvhB      = Na__PlEdges__BoundsTree(instanceB.geometry);
                Na__PlEdges__BToA.copy(instanceA.matrixWorld).invert().multiply(instanceB.matrixWorld);
                const found = generateIntersectionEdges(bvhA, bvhB, Na__PlEdges__BToA, []);
                if (found.length === 0) continue;
                const e = instanceA.matrixWorld.elements;
                for (let k = 0; k < found.length; k++) {
                    const line = found[k];
                    Na__PlEdges__Pair[0] = line.start.x; Na__PlEdges__Pair[1] = line.start.y; Na__PlEdges__Pair[2] = line.start.z;
                    Na__PlEdges__Pair[3] = line.end.x;   Na__PlEdges__Pair[4] = line.end.y;   Na__PlEdges__Pair[5] = line.end.z;
                    Na__PlEdges__PushWorld(collected, e, Na__PlEdges__Pair, 0);
                }
            }
        }
        if (report) {
            report.PairsTested  = pairsTested;
            report.PairsSkipped = pairsSkipped;
            report.SelfReused   = selfReused;
            report.SelfSkipped  = selfSkipped;
        }
        return new Float64Array(collected);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Cut Splitting
// -----------------------------------------------------------------------------

    // FUNCTION | Divide Scene Space Edges at the Drawing Cut
    // ------------------------------------------------------------
    // cut is { NormalX/Y/Z, DistanceUnits, DepthUnits | null } with the
    // normal pointing at the KEPT side. Returns:
    //     Kept     the parts on the kept side, within the view depth
    //     Removed  the parts between the viewer and the cut plane
    // Parts beyond the view depth are dropped from both. Passing a null cut
    // returns every edge as kept.
    // ------------------------------------------------------------
    function Na__PlEdges__SplitByCut(stageEdges, cut) {
        if (!cut) return { Kept : stageEdges, Removed : new Float64Array(0) };

        const nx = cut.NormalX, ny = cut.NormalY, nz = cut.NormalZ;
        const d  = cut.DistanceUnits;
        const far = (Number.isFinite(cut.DepthUnits) && cut.DepthUnits > 0) ? (d + cut.DepthUnits) : Infinity;

        const kept    = [];
        const removed = [];
        const count   = Math.floor(stageEdges.length / 6);

        for (let i = 0; i < count; i++) {
            const at = i * 6;
            let x0 = stageEdges[at],     y0 = stageEdges[at + 1], z0 = stageEdges[at + 2];
            let x1 = stageEdges[at + 3], y1 = stageEdges[at + 4], z1 = stageEdges[at + 5];

            let s0 = (nx * x0) + (ny * y0) + (nz * z0);
            let s1 = (nx * x1) + (ny * y1) + (nz * z1);

            // Beyond the view depth: trim to the far plane, drop what is past it.
            if (s0 > far && s1 > far) continue;
            if (s0 > far || s1 > far) {
                const t = (far - s0) / (s1 - s0);
                const mx = x0 + (x1 - x0) * t, my = y0 + (y1 - y0) * t, mz = z0 + (z1 - z0) * t;
                if (s0 > far) { x0 = mx; y0 = my; z0 = mz; s0 = far; } else { x1 = mx; y1 = my; z1 = mz; s1 = far; }
            }

            // Wholly on one side of the cut.
            if (s0 >= d && s1 >= d) { kept.push(x0, y0, z0, x1, y1, z1); continue; }
            if (s0 <  d && s1 <  d) { removed.push(x0, y0, z0, x1, y1, z1); continue; }

            // Straddling: split at the plane.
            const t  = (d - s0) / (s1 - s0);
            const mx = x0 + (x1 - x0) * t, my = y0 + (y1 - y0) * t, mz = z0 + (z1 - z0) * t;
            if (s0 >= d) {
                kept.push(x0, y0, z0, mx, my, mz);
                removed.push(mx, my, mz, x1, y1, z1);
            } else {
                removed.push(x0, y0, z0, mx, my, mz);
                kept.push(mx, my, mz, x1, y1, z1);
            }
        }

        return { Kept : new Float64Array(kept), Removed : new Float64Array(removed) };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | View Placement
// -----------------------------------------------------------------------------

    // FUNCTION | Turn Scene Space Edges to Face One View
    // ------------------------------------------------------------
    // Three things in one sweep: turn through the view map, lift every edge a
    // hair towards the viewer (so a line lying in its own surface is not
    // judged hidden by it), and drop edges that point straight at the viewer.
    // ------------------------------------------------------------
    function Na__PlEdges__ToViewSpace(stageEdges, viewMap, yOffset) {
        const sourceCount = Math.floor(stageEdges.length / 6);
        const verts       = new Float64Array(sourceCount * 6);
        const lift        = (typeof yOffset === 'number') ? yOffset : 0;
        const turned      = new Float64Array(6);
        let   kept        = 0;

        for (let i = 0; i < sourceCount; i++) {
            const at = i * 6;
            Na__PlSoup__TurnPoint(viewMap, stageEdges, at,     turned, 0);
            Na__PlSoup__TurnPoint(viewMap, stageEdges, at + 3, turned, 3);

            const x0 = turned[0], y0 = turned[1] + lift, z0 = turned[2];
            const x1 = turned[3], y1 = turned[4] + lift, z1 = turned[5];

            const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
            const lengthSq = (dx * dx) + (dy * dy) + (dz * dz);
            if (!(lengthSq > 0)) continue;

            const vertical = Math.abs(dy) / Math.sqrt(lengthSq);
            if (vertical >= 1 - Na__PlEdges__DEGENERATE_EPSILON) continue;      // <-- Lands on one point

            const out = kept * 6;
            verts[out]     = x0; verts[out + 1] = y0; verts[out + 2] = z0;
            verts[out + 3] = x1; verts[out + 4] = y1; verts[out + 5] = z1;
            kept++;
        }

        return { Count : kept, Verts : verts.slice(0, kept * 6) };
    }
    // ------------------------------------------------------------


    // FUNCTION | Project Scene Space Edges Straight to Drawing Millimetres
    // ------------------------------------------------------------
    // For the classes that are never occlusion-tested (the section outline,
    // the lines above the cut): turn, read x and z, divide by the scale.
    // ------------------------------------------------------------
    function Na__PlEdges__ToDrawingSegments(stageEdges, viewMap, scaleDivisor, minimumLengthMm) {
        const count     = Math.floor(stageEdges.length / 6);
        const out       = new Float32Array(count * 4);
        const turned    = new Float64Array(6);
        const minimumSq = minimumLengthMm * minimumLengthMm;
        let   written   = 0;

        for (let i = 0; i < count; i++) {
            Na__PlSoup__TurnPoint(viewMap, stageEdges, i * 6,     turned, 0);
            Na__PlSoup__TurnPoint(viewMap, stageEdges, i * 6 + 3, turned, 3);

            const x0 = turned[0] / scaleDivisor, y0 = turned[2] / scaleDivisor;
            const x1 = turned[3] / scaleDivisor, y1 = turned[5] / scaleDivisor;
            const dx = x1 - x0, dy = y1 - y0;
            if (((dx * dx) + (dy * dy)) < minimumSq) continue;

            out[written++] = x0; out[written++] = y0; out[written++] = x1; out[written++] = y1;
        }

        return out.slice(0, written);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Projected Linework Edge Extractor API
    // ------------------------------------------------------------
    export {
        Na__PlEdges__ExtractStageEdges,
        Na__PlEdges__ExtractIntersectionEdges,
        Na__PlEdges__SplitByCut,
        Na__PlEdges__ToViewSpace,
        Na__PlEdges__ToDrawingSegments
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
