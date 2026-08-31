// =============================================================================
// TRUEVISION3D - SECTION CUT ENGINE - CAP GEOMETRY
// =============================================================================
//
// FILE       : Na__SectionCut__CapGeometry__.js
// NAMESPACE  : Na__SectCap
// MODULE     : Section Cut Engine - Cap Geometry
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Compute boolean-style cap fills + clean outer profile loops for a section plane
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - Implements the proven three.js "geometric section cap" technique: iterate
//   every model triangle, intersect it with the section plane, collect the
//   resulting contour segments, weld them into closed loops, then triangulate
//   the loops (with holes) via THREE.ShapeUtils (earcut) to build a solid
//   cap fill that reads like a true boolean cut.
// - Interior clutter removal: contour segments are ORIENTED from each source
//   triangle's facing. Where two solids touch (wall sitting on a slab), the
//   coincident contact faces emit the same segment with opposite directions -
//   these cancel in the weld stage, leaving only the true outer boundary of
//   the cut "island". This is what produces SketchUp-style clean sections
//   with no internal linework - which is what makes a horizontal plan cut
//   read as proper wall poche rather than construction-line noise.
// - Loops are classified by even-odd nesting: even depth = solid outline,
//   odd depth = hole (e.g. a void inside a hollow wall). Both outline types
//   are emitted as profile-line segments; fills are triangulated with holes.
// - All maths is done in a 2D basis on the plane; signed distances are
//   evaluated in each mesh's LOCAL space (plane pulled back through the
//   inverse world matrix) so vertices are never transformed unless their
//   triangle actually crosses the plane. This keeps live dragging fast on
//   large architecture models without needing a BVH.
//
// INTEGRATION:
// - Called by Na__SectionCut__Engine__.js on plane insert, datum change
//   (throttled) and slider release.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 31-Aug-2026 - Version 1.0.0
// - Ported verbatim from the ValeVision3D cross section tool
//   (Na__CrossSectionView__CapGeometry.js, 14-Jul-2026 v1.0.0). Algorithm
// - Algorithm unchanged: only the header, the helper userData flag
//   (naSectionCutHelper -> naSectionCutHelper) and the console prefix
//   were renamed for the TrueVision namespace.
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

    // MODULE CONSTANTS | Numeric Tolerances
    // ------------------------------------------------------------
    const Na__SectCap__DIST_EPSILON        = 1e-9;      // <-- Signed distances snapped off exact zero (avoids degenerate on-plane cases)
    const Na__SectCap__DEFAULT_WELD_TOL    = 0.00025;   // <-- Endpoint weld grid in world units (0.25 mm)
    const Na__SectCap__DEFAULT_MIN_AREA    = 0.0004;    // <-- Minimum loop area in m² (discards slivers)
    const Na__SectCap__DEFAULT_MAX_SEGMENTS = 250000;   // <-- Hard safety cap on crossing segments per recompute
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Plane Basis Helpers
// -----------------------------------------------------------------------------

    // FUNCTION | Build an Orthonormal 2D Basis (u, v, origin) on a Plane
    // ------------------------------------------------------------
    // u and v span the plane; origin is the plane point closest to world 0.
    // Shared with the gizmo module so gizmo axes match cap 2D coordinates.
    // ------------------------------------------------------------
    function Na__SectCap__BuildPlaneBasis(plane) {
        const n      = plane.normal;                                            // <-- Unit normal (kept-side direction)
        const helper = (Math.abs(n.y) < 0.9)
            ? new THREE.Vector3(0, 1, 0)                                        // <-- World up for vertical section planes
            : new THREE.Vector3(1, 0, 0);                                       // <-- Fallback for horizontal (plan) cuts

        const u = new THREE.Vector3().crossVectors(helper, n).normalize();      // <-- In-plane "right" axis
        const v = new THREE.Vector3().crossVectors(n, u);                       // <-- In-plane "up" axis (orthonormal)
        const origin = n.clone().multiplyScalar(-plane.constant);               // <-- Point on plane closest to world origin

        return { u, v, n: n.clone(), origin };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Mesh Eligibility Filtering
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Walk Parent Chain to Detect Linework GLB Root
    // ------------------------------------------------------------
    function Na__SectCap__IsInsideLineworkGroup(object) {
        let current = object;
        while (current) {
            if (current.userData && current.userData.Na__ModelType === 'linework') {
                return true;                                                    // <-- Linework GLBs contribute no cut surfaces
            }
            current = current.parent;
        }
        return false;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Collect Cut-Eligible Meshes (Respecting Visibility)
    // ------------------------------------------------------------
    // Recursive descent carrying the ancestor visibility flag so meshes
    // hidden by the model-layer toggles never contribute cap geometry.
    // ------------------------------------------------------------
    function Na__SectCap__CollectEligibleMeshes(root) {
        const meshes = [];

        function visit(object) {
            if (!object.visible) return;                                        // <-- Hidden branch: skip entire subtree
            if (object.userData && object.userData.naSectionCutHelper) return; // <-- Never cut our own gizmos / caps

            if (object.isMesh && !object.isLine2 && !object.isLineSegments2
                && !Na__SectCap__IsInsideLineworkGroup(object)) {
                meshes.push(object);
            }

            const children = object.children;
            for (let i = 0; i < children.length; i++) visit(children[i]);
        }

        visit(root);
        return meshes;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Triangle-Plane Segment Extraction
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Scratch Objects (Allocation-Free Hot Loop)
    // ------------------------------------------------------------
    const Na__SectCap__ScratchPlane   = new THREE.Plane();
    const Na__SectCap__ScratchMatrix  = new THREE.Matrix4();
    const Na__SectCap__ScratchSphere  = new THREE.Sphere();
    const Na__SectCap__ScratchVecA    = new THREE.Vector3();
    const Na__SectCap__ScratchVecB    = new THREE.Vector3();
    const Na__SectCap__ScratchVecC    = new THREE.Vector3();
    const Na__SectCap__ScratchEdge1   = new THREE.Vector3();
    const Na__SectCap__ScratchEdge2   = new THREE.Vector3();
    const Na__SectCap__ScratchNormal  = new THREE.Vector3();
    const Na__SectCap__ScratchTangent = new THREE.Vector3();
    const Na__SectCap__ScratchHit1    = new THREE.Vector3();
    const Na__SectCap__ScratchHit2    = new THREE.Vector3();
    const Na__SectCap__ScratchDelta   = new THREE.Vector3();
    // ------------------------------------------------------------


    // SUB FUNCTION | Extract Oriented Intersection Segments From One Mesh
    // ------------------------------------------------------------
    // Signed distances are computed against the plane pulled back into the
    // mesh's local space (sign-exact under affine transforms), then only the
    // few crossing triangles are transformed to world space. Each segment is
    // oriented by cross(triangleNormal, planeNormal) in WORLD space so
    // opposing contact faces cancel later in the weld stage.
    // Segments are appended to outSegments as 4 floats: x1, y1, x2, y2 in
    // plane 2D coordinates.
    // ------------------------------------------------------------
    function Na__SectCap__ExtractMeshSegments(mesh, plane, basis, outSegments, maxSegments) {
        const geometry = mesh.geometry;
        if (!geometry || !geometry.attributes || !geometry.attributes.position) return true;

        // BROAD PHASE | World bounding sphere vs plane distance
        if (geometry.boundingSphere === null) geometry.computeBoundingSphere();
        if (geometry.boundingSphere !== null) {
            Na__SectCap__ScratchSphere.copy(geometry.boundingSphere).applyMatrix4(mesh.matrixWorld);
            if (Math.abs(plane.distanceToPoint(Na__SectCap__ScratchSphere.center)) > Na__SectCap__ScratchSphere.radius) {
                return true;                                                    // <-- Mesh entirely on one side; no cut surface
            }
        }

        // LOCAL-SPACE PLANE | Pull the world plane back through the inverse world matrix
        Na__SectCap__ScratchMatrix.copy(mesh.matrixWorld).invert();
        Na__SectCap__ScratchPlane.copy(plane).applyMatrix4(Na__SectCap__ScratchMatrix);
        const ln = Na__SectCap__ScratchPlane.normal;
        const lc = Na__SectCap__ScratchPlane.constant;

        const posAttr  = geometry.attributes.position;
        const indexAttr = geometry.index;
        const vertexCount = posAttr.count;

        // SIGNED DISTANCES | Per unique vertex, snapped off exact zero
        const dists = new Float32Array(vertexCount);
        for (let i = 0; i < vertexCount; i++) {
            let d = ln.x * posAttr.getX(i) + ln.y * posAttr.getY(i) + ln.z * posAttr.getZ(i) + lc;
            if (d > -Na__SectCap__DIST_EPSILON && d < Na__SectCap__DIST_EPSILON) d = Na__SectCap__DIST_EPSILON; // <-- On-plane vertices treated as kept side
            dists[i] = d;
        }

        const triCount = indexAttr ? (indexAttr.count / 3) : (vertexCount / 3);
        const worldMatrix = mesh.matrixWorld;
        const { u, v, origin, n } = basis;

        for (let t = 0; t < triCount; t++) {
            const ia = indexAttr ? indexAttr.getX(t * 3)     : t * 3;
            const ib = indexAttr ? indexAttr.getX(t * 3 + 1) : t * 3 + 1;
            const ic = indexAttr ? indexAttr.getX(t * 3 + 2) : t * 3 + 2;

            const da = dists[ia];
            const db = dists[ib];
            const dc = dists[ic];

            const sa = da > 0;
            const sb = db > 0;
            const sc = dc > 0;
            if (sa === sb && sb === sc) continue;                               // <-- All vertices on one side; no crossing

            // CROSSING TRIANGLE | Gather world-space vertices
            Na__SectCap__ScratchVecA.fromBufferAttribute(posAttr, ia).applyMatrix4(worldMatrix);
            Na__SectCap__ScratchVecB.fromBufferAttribute(posAttr, ib).applyMatrix4(worldMatrix);
            Na__SectCap__ScratchVecC.fromBufferAttribute(posAttr, ic).applyMatrix4(worldMatrix);

            // EDGE INTERSECTIONS | Exactly two edges cross the plane
            let hitCount = 0;
            const edges = [
                [Na__SectCap__ScratchVecA, Na__SectCap__ScratchVecB, da, db],
                [Na__SectCap__ScratchVecB, Na__SectCap__ScratchVecC, db, dc],
                [Na__SectCap__ScratchVecC, Na__SectCap__ScratchVecA, dc, da]
            ];
            for (let e = 0; e < 3 && hitCount < 2; e++) {
                const [p1, p2, d1, d2] = edges[e];
                if ((d1 > 0) === (d2 > 0)) continue;                            // <-- Edge does not cross
                const frac = d1 / (d1 - d2);                                    // <-- Zero-crossing parameter along the edge
                const target = (hitCount === 0) ? Na__SectCap__ScratchHit1 : Na__SectCap__ScratchHit2;
                target.copy(p1).lerp(p2, frac);
                hitCount++;
            }
            if (hitCount !== 2) continue;                                       // <-- Defensive: degenerate triangle

            // ORIENTATION | Segment direction follows cross(triNormal, planeNormal)
            Na__SectCap__ScratchEdge1.subVectors(Na__SectCap__ScratchVecB, Na__SectCap__ScratchVecA);
            Na__SectCap__ScratchEdge2.subVectors(Na__SectCap__ScratchVecC, Na__SectCap__ScratchVecA);
            Na__SectCap__ScratchNormal.crossVectors(Na__SectCap__ScratchEdge1, Na__SectCap__ScratchEdge2);
            Na__SectCap__ScratchTangent.crossVectors(Na__SectCap__ScratchNormal, n);
            Na__SectCap__ScratchDelta.subVectors(Na__SectCap__ScratchHit2, Na__SectCap__ScratchHit1);

            let h1 = Na__SectCap__ScratchHit1;
            let h2 = Na__SectCap__ScratchHit2;
            if (Na__SectCap__ScratchDelta.dot(Na__SectCap__ScratchTangent) < 0) {
                h1 = Na__SectCap__ScratchHit2;                                  // <-- Swap to enforce consistent winding
                h2 = Na__SectCap__ScratchHit1;
            }

            // PROJECT TO PLANE 2D | (p - origin) · u / v
            const r1x = h1.x - origin.x, r1y = h1.y - origin.y, r1z = h1.z - origin.z;
            const r2x = h2.x - origin.x, r2y = h2.y - origin.y, r2z = h2.z - origin.z;
            outSegments.push(
                r1x * u.x + r1y * u.y + r1z * u.z,
                r1x * v.x + r1y * v.y + r1z * v.z,
                r2x * u.x + r2y * u.y + r2z * u.z,
                r2x * v.x + r2y * v.y + r2z * v.z
            );

            if (outSegments.length / 4 > maxSegments) return false;             // <-- Safety abort: model too dense for live caps
        }

        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Segment Welding, Cancellation, and Loop Chaining
// -----------------------------------------------------------------------------

    // SUB FUNCTION | Weld Segments and Cancel Opposing Duplicates
    // ------------------------------------------------------------
    // Endpoints are quantised to a weld grid; identical opposite-direction
    // segments (interior contact faces between touching solids) annihilate,
    // identical same-direction segments (coincident coplanar skins) collapse
    // to one. Output: point table + surviving directed segments.
    // ------------------------------------------------------------
    function Na__SectCap__WeldAndCancel(segments, weldTol) {
        const invTol   = 1 / weldTol;
        const keyToId  = new Map();                                             // <-- Quantised coordinate key -> point id
        const pointsX  = [];
        const pointsY  = [];
        const segCount = new Map();                                             // <-- Directed "a>b" -> multiplicity

        function pointId(x, y) {
            const qx = Math.round(x * invTol);
            const qy = Math.round(y * invTol);
            const key = qx + '|' + qy;
            let id = keyToId.get(key);
            if (id === undefined) {
                id = pointsX.length;
                keyToId.set(key, id);
                pointsX.push(qx * weldTol);                                     // <-- Store snapped coordinates for stability
                pointsY.push(qy * weldTol);
            }
            return id;
        }

        for (let i = 0; i < segments.length; i += 4) {
            const a = pointId(segments[i],     segments[i + 1]);
            const b = pointId(segments[i + 2], segments[i + 3]);
            if (a === b) continue;                                              // <-- Degenerate after quantisation

            const reverseKey = b + '>' + a;
            const reverseCount = segCount.get(reverseKey);
            if (reverseCount > 0) {
                if (reverseCount === 1) segCount.delete(reverseKey);            // <-- Opposing pair annihilates (interior edge)
                else segCount.set(reverseKey, reverseCount - 1);
                continue;
            }

            const forwardKey = a + '>' + b;
            segCount.set(forwardKey, (segCount.get(forwardKey) || 0) + 1);
        }

        return { pointsX, pointsY, segCount };
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Chain Surviving Segments Into Closed Loops
    // ------------------------------------------------------------
    function Na__SectCap__ChainLoops(pointsX, pointsY, segCount) {
        const adjacency = new Map();                                            // <-- Point id -> array of destination ids
        for (const key of segCount.keys()) {
            const sep = key.indexOf('>');
            const a = Number(key.slice(0, sep));
            const b = Number(key.slice(sep + 1));
            let list = adjacency.get(a);
            if (!list) { list = []; adjacency.set(a, list); }
            list.push(b);
        }

        const loops = [];
        let openChainCount = 0;

        for (const [startId, startList] of adjacency) {
            while (startList.length > 0) {
                const loopIds = [startId];
                let current   = startList.pop();
                loopIds.push(current);
                let closed = false;

                for (let guard = 0; guard < 200000; guard++) {
                    if (current === startId) { closed = true; break; }          // <-- Walked back to start: closed loop
                    const nextList = adjacency.get(current);
                    if (!nextList || nextList.length === 0) break;              // <-- Dead end: open chain (discarded)
                    current = nextList.pop();
                    loopIds.push(current);
                }

                if (!closed || loopIds.length < 4) {                            // <-- Closed loop repeats start: minimum triangle = 4 ids
                    openChainCount++;
                    continue;
                }

                loopIds.pop();                                                  // <-- Drop repeated start id
                const pts = new Array(loopIds.length);
                for (let i = 0; i < loopIds.length; i++) {
                    pts[i] = { x: pointsX[loopIds[i]], y: pointsY[loopIds[i]] };
                }
                loops.push(pts);
            }
        }

        return { loops, openChainCount };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Loop Classification and Triangulation
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Shoelace Signed Area of a Loop
    // ------------------------------------------------------------
    function Na__SectCap__SignedArea(pts) {
        let area = 0;
        for (let i = 0, len = pts.length; i < len; i++) {
            const p1 = pts[i];
            const p2 = pts[(i + 1) % len];
            area += (p1.x * p2.y) - (p2.x * p1.y);
        }
        return area * 0.5;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Even-Odd Point-In-Polygon Test
    // ------------------------------------------------------------
    function Na__SectCap__PointInLoop(px, py, pts) {
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const xi = pts[i].x, yi = pts[i].y;
            const xj = pts[j].x, yj = pts[j].y;
            const crosses = ((yi > py) !== (yj > py))
                && (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi);
            if (crosses) inside = !inside;
        }
        return inside;
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Classify Loop Nesting and Triangulate Fills
    // ------------------------------------------------------------
    // Even nesting depth = solid outline, odd depth = hole. Each hole is
    // assigned to its smallest containing outer loop, then every outer loop
    // is earcut-triangulated with its holes via THREE.ShapeUtils.
    // ------------------------------------------------------------
    function Na__SectCap__TriangulateLoops(loops, minLoopArea) {
        const kept = [];
        for (let i = 0; i < loops.length; i++) {
            const area = Na__SectCap__SignedArea(loops[i]);
            if (Math.abs(area) < minLoopArea) continue;                         // <-- Discard sliver loops
            kept.push({ pts: loops[i], area, depth: 0, parent: -1 });
        }

        // NESTING DEPTH | Count containing loops via representative vertex
        for (let i = 0; i < kept.length; i++) {
            const sample = kept[i].pts[0];
            let depth = 0;
            let parent = -1;
            let parentArea = Infinity;
            for (let j = 0; j < kept.length; j++) {
                if (i === j) continue;
                if (Na__SectCap__PointInLoop(sample.x, sample.y, kept[j].pts)) {
                    depth++;
                    const absArea = Math.abs(kept[j].area);
                    if (absArea < parentArea) { parentArea = absArea; parent = j; } // <-- Smallest container = immediate parent
                }
            }
            kept[i].depth = depth;
            kept[i].parent = parent;
        }

        // TRIANGULATION | Outer loops (even depth) filled with their direct holes
        const capTriangles2d = [];                                              // <-- Flat list of 2D triangle vertices (x, y)
        for (let i = 0; i < kept.length; i++) {
            if (kept[i].depth % 2 !== 0) continue;                              // <-- Holes handled with their parent

            const contour = kept[i].pts.map((p) => new THREE.Vector2(p.x, p.y));
            const holeLoops = [];
            for (let j = 0; j < kept.length; j++) {
                if (kept[j].depth === kept[i].depth + 1 && kept[j].parent === i) {
                    holeLoops.push(kept[j].pts.map((p) => new THREE.Vector2(p.x, p.y)));
                }
            }

            try {
                const faces = THREE.ShapeUtils.triangulateShape(contour, holeLoops);
                const allPts = contour.concat(...holeLoops);
                for (let f = 0; f < faces.length; f++) {
                    const face = faces[f];
                    capTriangles2d.push(
                        allPts[face[0]].x, allPts[face[0]].y,
                        allPts[face[1]].x, allPts[face[1]].y,
                        allPts[face[2]].x, allPts[face[2]].y
                    );
                }
            } catch (triError) {
                console.warn('[SectionCut] Cap triangulation failed for one loop — outline kept, fill skipped.', triError);
            }
        }

        return { kept, capTriangles2d };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Section Geometry Computation
// -----------------------------------------------------------------------------

    // FUNCTION | Compute Cap Fill + Profile Outline Geometry for a Section Plane
    // ------------------------------------------------------------
    // Parameters:
    //   modelRoot – root Object3D containing the loaded model groups
    //   plane     – THREE.Plane (normal points toward the KEPT half-space)
    //   options   – { weldToleranceUnits, minLoopAreaUnits2, maxSegments }
    // Returns:
    //   {
    //     capPositions     : Float32Array | null   (world-space cap triangles)
    //     outlinePositions : Float32Array | null   (world-space segment pairs for fat lines)
    //     loopCount, openChainCount, aborted
    //   }
    // ------------------------------------------------------------
    function Na__SectCap__ComputeSectionGeometry(modelRoot, plane, options = {}) {
        const weldTol     = Number.isFinite(options.weldToleranceUnits) ? options.weldToleranceUnits : Na__SectCap__DEFAULT_WELD_TOL;
        const minLoopArea = Number.isFinite(options.minLoopAreaUnits2)  ? options.minLoopAreaUnits2  : Na__SectCap__DEFAULT_MIN_AREA;
        const maxSegments = Number.isFinite(options.maxSegments)        ? options.maxSegments        : Na__SectCap__DEFAULT_MAX_SEGMENTS;

        const basis  = Na__SectCap__BuildPlaneBasis(plane);
        const meshes = Na__SectCap__CollectEligibleMeshes(modelRoot);

        // SEGMENT EXTRACTION | Oriented 2D contour segments from every mesh
        const segments = [];
        let aborted = false;
        for (let m = 0; m < meshes.length; m++) {
            if (!Na__SectCap__ExtractMeshSegments(meshes[m], plane, basis, segments, maxSegments)) {
                aborted = true;                                                 // <-- Density guard tripped; return outline-less result
                break;
            }
        }
        if (aborted || segments.length === 0) {
            return { capPositions: null, outlinePositions: null, loopCount: 0, openChainCount: 0, aborted };
        }

        // WELD -> CANCEL -> CHAIN -> CLASSIFY -> TRIANGULATE
        const { pointsX, pointsY, segCount } = Na__SectCap__WeldAndCancel(segments, weldTol);
        const { loops, openChainCount }      = Na__SectCap__ChainLoops(pointsX, pointsY, segCount);
        const { kept, capTriangles2d }       = Na__SectCap__TriangulateLoops(loops, minLoopArea);

        // WORLD-SPACE OUTPUT | 2D plane coordinates lifted back through the basis
        const { u, v, origin } = basis;
        function lift(x, y, out, offset) {
            out[offset]     = origin.x + u.x * x + v.x * y;
            out[offset + 1] = origin.y + u.y * x + v.y * y;
            out[offset + 2] = origin.z + u.z * x + v.z * y;
        }

        // CAP FILL TRIANGLES
        let capPositions = null;
        if (capTriangles2d.length > 0) {
            capPositions = new Float32Array((capTriangles2d.length / 2) * 3);
            for (let i = 0, o = 0; i < capTriangles2d.length; i += 2, o += 3) {
                lift(capTriangles2d[i], capTriangles2d[i + 1], capPositions, o);
            }
        }

        // PROFILE OUTLINE SEGMENTS | Every kept loop edge (outer boundaries + holes)
        let outlinePositions = null;
        let edgeCount = 0;
        for (let i = 0; i < kept.length; i++) edgeCount += kept[i].pts.length;
        if (edgeCount > 0) {
            outlinePositions = new Float32Array(edgeCount * 6);
            let o = 0;
            for (let i = 0; i < kept.length; i++) {
                const pts = kept[i].pts;
                for (let p = 0, len = pts.length; p < len; p++) {
                    const p1 = pts[p];
                    const p2 = pts[(p + 1) % len];
                    lift(p1.x, p1.y, outlinePositions, o);
                    lift(p2.x, p2.y, outlinePositions, o + 3);
                    o += 6;
                }
            }
        }

        return {
            capPositions,
            outlinePositions,
            loopCount: kept.length,
            openChainCount,
            aborted: false
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Cap Geometry API
    // ------------------------------------------------------------
    export {
        Na__SectCap__ComputeSectionGeometry,
        Na__SectCap__BuildPlaneBasis
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
