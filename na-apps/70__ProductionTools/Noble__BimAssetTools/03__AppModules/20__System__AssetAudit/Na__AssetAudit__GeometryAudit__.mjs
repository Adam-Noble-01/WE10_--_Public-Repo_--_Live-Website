/* =============================================================================
   NOBLE BIM ASSET TOOLS | ASSET AUDIT - GEOMETRY AUDIT
   =============================================================================

   FILE       : Na__AssetAudit__GeometryAudit__.mjs
   NAMESPACE  : Na__BimAssetTools
   MODULE     : AssetAudit - GeometryAudit
   AUTHOR     : Adam Noble - Noble Architecture
   PURPOSE    : Judge whether a downloaded asset is fit to use in production work
   CREATED    : 14-Aug-2026

   DESCRIPTION:
   - This is the module the whole tool exists for. A component downloaded from a
     manufacturer's website looks fine in a render and then turns out to be a
     40,000 triangle bracket with inverted normals and a 3 mm gap in the mitre.
     Every check here answers a question that costs real time when missed.
   - All measurements are in millimetres, the internal working unit. Nothing here
     rescales anything; it only measures what the loaders produced.

   ---------------------------------------------------------------------------

   WHAT EACH CHECK IS ACTUALLY FOR:

     triangleCount     Budget. A gutter bracket needs hundreds of triangles, not
                       tens of thousands. High counts usually mean a CAD export
                       tessellated at a far tighter deflection than anyone needs.

     boundingBox       The first thing to check against the manufacturer's data
                       sheet. If the published length is 3000 mm and this says
                       2999.6, the model is fine; if it says 3.0, the unit is wrong.

     originDistance    Geometry far from the origin loses single-precision
                       accuracy and imports into SketchUp a very long way from
                       where anyone is working.

     degenerateFaces   Zero-area slivers. They contribute nothing, break normal
                       calculation, and SketchUp will often refuse to heal the
                       surrounding face.

     openEdges         An edge used by only one triangle. In a component that
                       should be a closed solid this means a hole, and a hole is
                       why SketchUp will not report a volume or will shade through.

     nonManifold       An edge shared by three or more triangles. Geometry that
                       cannot exist as a real object and that most solid tools
                       refuse outright.

     reversedFaces     Inconsistent winding. Renders as a dark patch here and
                       imports into SketchUp as a blue back face needing manual
                       reversal, one face at a time.

     duplicateVertices Unwelded coincident vertices. Usually harmless for display
                       but it defeats smooth shading and inflates the file.

     nonUniformScale   A node scaled differently per axis. Real risk of a
                       component that measures correctly along one axis only.

   ============================================================================= */

import * as THREE       from 'three';
import { GetConfig }    from '../01__AppCore/Na__AppCore__AppState__.mjs';

// =============================================================================
// REGION | Module Constants
// =============================================================================

    // MODULE CONSTANTS | Severity Levels
    // ------------------------------------------------------------
    const SEVERITY_PASS     =  'pass';
    const SEVERITY_INFO     =  'info';
    const SEVERITY_WARNING  =  'warning';
    const SEVERITY_CRITICAL =  'critical';
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Triangle Budget Guidance
    // ------------------------------------------------------------
    // Not hard limits, only the thresholds at which the report starts commenting.
    // A whole building legitimately exceeds all of these; a single fitting should
    // not come close to the first one.
    const TRIANGLE_BUDGET_COMPONENT  =  50000;
    const TRIANGLE_BUDGET_ASSEMBLY   =  500000;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Topology Analysis
// =============================================================================

// -----------------------------------------------------------------------------
// REGION | Vertex Welding
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build a Welded Vertex Index for One Geometry
    // ------------------------------------------------------------
    // Topology cannot be judged on raw vertices, because most exchange formats
    // duplicate a vertex per face. Positions are quantised onto a tolerance grid
    // and identical cells collapse to one welded index, which is what makes edge
    // sharing measurable at all.
    function Na__AssetAudit__WeldVertices(positionAttribute, tolerance) {
        const count       =  positionAttribute.count;
        const weldedIndex =  new Uint32Array(count);
        const lookup      =  new Map();
        const inverse     =  1 / tolerance;
        let   nextWelded  =  0;

        for (let i = 0; i < count; i++) {
            const qx = Math.round(positionAttribute.getX(i) * inverse);
            const qy = Math.round(positionAttribute.getY(i) * inverse);
            const qz = Math.round(positionAttribute.getZ(i) * inverse);
            const key = `${qx},${qy},${qz}`;

            let welded = lookup.get(key);
            if (welded === undefined) {
                welded = nextWelded++;
                lookup.set(key, welded);
            }
            weldedIndex[i] = welded;
        }

        return { weldedIndex : weldedIndex, weldedCount : nextWelded };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Edge and Face Inspection
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Analyse Triangles and Edges of One Geometry
    // ------------------------------------------------------------
    // Walks every triangle once, accumulating area, edge use counts and directed
    // edge counts. Edge keys are numeric rather than strings because a Map keyed
    // on packed numbers is several times faster over the hundreds of thousands of
    // edges a real model produces.
    function Na__AssetAudit__AnalyseGeometry(geometry, tolerances) {
        const position = geometry.attributes.position;
        if (!position) return null;

        const index      =  geometry.index;
        const triCount   =  index ? index.count / 3 : position.count / 3;
        const getVertex  =  index ? (i) => index.getX(i) : (i) => i;

        const { weldedIndex, weldedCount } = Na__AssetAudit__WeldVertices(position, tolerances.weldVertexTolerance);

        const undirectedEdges =  new Map();                                       // <-- packedKey -> use count
        const directedEdges   =  new Map();                                       // <-- packedKey -> use count, orientation preserved
        const stride          =  weldedCount;

        let degenerateCount   =  0;
        let signedVolumeX6    =  0;                                               // <-- Six times the signed volume, divided out at the end

        const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
        const ab = new THREE.Vector3(), ac = new THREE.Vector3(), cross = new THREE.Vector3();

        for (let t = 0; t < triCount; t++) {
            const i0 = getVertex(t * 3), i1 = getVertex(t * 3 + 1), i2 = getVertex(t * 3 + 2);

            a.fromBufferAttribute(position, i0);
            b.fromBufferAttribute(position, i1);
            c.fromBufferAttribute(position, i2);

            // -- Area via the cross product; half its length is the triangle area.
            ab.subVectors(b, a);
            ac.subVectors(c, a);
            cross.crossVectors(ab, ac);
            if (cross.length() * 0.5 < tolerances.degenerateTriangleArea) degenerateCount++;

            // -- Signed volume of the tetrahedron to the origin. Summed over a
            // -- closed surface this gives the enclosed volume, and its sign tells
            // -- us whether the winding is outward facing overall.
            signedVolumeX6 += a.dot(cross);

            const w0 = weldedIndex[i0], w1 = weldedIndex[i1], w2 = weldedIndex[i2];
            if (w0 === w1 || w1 === w2 || w0 === w2) continue;                     // <-- Collapsed triangle contributes no real edges

            const pairs = [[w0, w1], [w1, w2], [w2, w0]];
            for (const [from, to] of pairs) {
                const low  = from < to ? from : to;
                const high = from < to ? to   : from;

                const undirectedKey = low * stride + high;
                undirectedEdges.set(undirectedKey, (undirectedEdges.get(undirectedKey) || 0) + 1);

                const directedKey = from * stride + to;
                directedEdges.set(directedKey, (directedEdges.get(directedKey) || 0) + 1);
            }
        }

        // -- Classify the edges ------------------------------------------------
        let openEdgeCount = 0, nonManifoldCount = 0;
        for (const useCount of undirectedEdges.values()) {
            if (useCount === 1)      openEdgeCount++;
            else if (useCount > 2)   nonManifoldCount++;
        }

        // -- A consistently wound surface traverses every shared edge once in
        // -- each direction. A directed edge seen twice means two triangles walk
        // -- it the same way, so one of them is flipped relative to its neighbour.
        let reversedEdgeCount = 0;
        for (const useCount of directedEdges.values()) {
            if (useCount > 1) reversedEdgeCount++;
        }

        return {
            triangleCount     :  triCount,
            rawVertexCount    :  position.count,
            weldedVertexCount :  weldedCount,
            duplicateVertices :  position.count - weldedCount,
            degenerateCount   :  degenerateCount,
            openEdgeCount     :  openEdgeCount,
            nonManifoldCount  :  nonManifoldCount,
            reversedEdgeCount :  reversedEdgeCount,
            isClosed          :  openEdgeCount === 0 && nonManifoldCount === 0,
            volumeMm3         :  signedVolumeX6 / 6
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Scene Inspection
// =============================================================================

    // HELPER FUNCTION | Inventory Materials, Textures and Node Structure
    // ------------------------------------------------------------
    function Na__AssetAudit__InspectScene(root) {
        const materials       =  new Set();
        const textures        =  new Set();
        const nonUniformNodes =  [];

        let meshCount = 0, nodeCount = 0, maxDepth = 0;

        root.traverse(function Na__AssetAudit__VisitNode(node) {
            nodeCount++;

            let depth = 0;
            for (let parent = node.parent; parent; parent = parent.parent) depth++;
            if (depth > maxDepth) maxDepth = depth;

            const s = node.scale;
            if (Math.abs(s.x - s.y) > 1e-6 || Math.abs(s.y - s.z) > 1e-6) {
                nonUniformNodes.push({ name : node.name || '(unnamed)', scale : [s.x, s.y, s.z] });
            }

            if (!node.isMesh) return;
            meshCount++;

            for (const material of (Array.isArray(node.material) ? node.material : [node.material])) {
                if (!material) continue;
                materials.add(material);

                for (const key of Object.keys(material)) {
                    const value = material[key];
                    if (value && value.isTexture) textures.add(value);
                }
            }
        });

        return {
            meshCount       :  meshCount,
            nodeCount       :  nodeCount,
            maxDepth        :  maxDepth,
            materialCount   :  materials.size,
            textureCount    :  textures.size,
            nonUniformNodes :  nonUniformNodes
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Finding Construction
// =============================================================================

    // HELPER FUNCTION | Build One Reportable Finding
    // ------------------------------------------------------------
    function Na__AssetAudit__Finding(id, label, severity, value, detail) {
        return { id : id, label : label, severity : severity, value : value, detail : detail || null };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Public Audit Entry
// =============================================================================

    // FUNCTION | Audit a Loaded Asset and Return a Structured Report
    // ------------------------------------------------------------
    export function AuditAsset(asset) {
        const config      =  GetConfig();
        const tolerances  =  config.tolerances;
        const root        =  asset.object3d;

        if (!root) throw new Error(`[Na AssetAudit] Asset "${asset.fileName}" carries no geometry to audit.`);

        const findings = [];
        const scene    = Na__AssetAudit__InspectScene(root);

        // -- Accumulate topology across every mesh in the asset -----------------
        const totals = {
            triangleCount : 0, rawVertexCount : 0, weldedVertexCount : 0, duplicateVertices : 0,
            degenerateCount : 0, openEdgeCount : 0, nonManifoldCount : 0, reversedEdgeCount : 0,
            volumeMm3 : 0, closedMeshes : 0, analysedMeshes : 0
        };

        root.traverse(function Na__AssetAudit__AuditMesh(node) {
            if (!node.isMesh || !node.geometry) return;

            const analysis = Na__AssetAudit__AnalyseGeometry(node.geometry, tolerances);
            if (!analysis) return;

            totals.analysedMeshes++;
            if (analysis.isClosed) totals.closedMeshes++;

            for (const key of ['triangleCount', 'rawVertexCount', 'weldedVertexCount', 'duplicateVertices',
                               'degenerateCount', 'openEdgeCount', 'nonManifoldCount', 'reversedEdgeCount', 'volumeMm3']) {
                totals[key] += analysis[key];
            }
        });

        // -- Bounding box and position ------------------------------------------
        const box  = new THREE.Box3().setFromObject(root);
        const size = new THREE.Vector3(); box.getSize(size);
        const centre = new THREE.Vector3(); box.getCenter(centre);
        const originDistance = centre.length();

        findings.push(Na__AssetAudit__Finding(
            'boundingBox', 'Bounding box', SEVERITY_INFO,
            `${size.x.toFixed(1)} x ${size.y.toFixed(1)} x ${size.z.toFixed(1)} mm`,
            `Width x Height x Depth. Check this against the manufacturer's published dimensions before trusting the asset.`
        ));

        findings.push(Na__AssetAudit__Finding(
            'triangleCount', 'Triangles',
            totals.triangleCount > TRIANGLE_BUDGET_ASSEMBLY  ? SEVERITY_WARNING :
            totals.triangleCount > TRIANGLE_BUDGET_COMPONENT ? SEVERITY_INFO    : SEVERITY_PASS,
            totals.triangleCount.toLocaleString(),
            totals.triangleCount > TRIANGLE_BUDGET_COMPONENT
                ? `Heavy for a single component. Expect SketchUp to slow noticeably once several copies are placed.`
                : `${scene.meshCount} mesh${scene.meshCount === 1 ? '' : 'es'}, ${totals.weldedVertexCount.toLocaleString()} welded vertices.`
        ));

        // -- Origin distance -----------------------------------------------------
        findings.push(Na__AssetAudit__Finding(
            'originDistance', 'Distance from origin',
            originDistance > tolerances.originDistanceCritical ? SEVERITY_CRITICAL :
            originDistance > tolerances.originDistanceWarning  ? SEVERITY_WARNING  : SEVERITY_PASS,
            originDistance < 10000 ? `${originDistance.toFixed(1)} mm` : `${(originDistance / 1000).toFixed(1)} m`,
            originDistance > tolerances.originDistanceWarning
                ? `Far from the origin. Single-precision accuracy degrades and the component will import into SketchUp a long way from the model.`
                : `Comfortably placed for single-precision accuracy.`
        ));

        // -- Topology ------------------------------------------------------------
        findings.push(Na__AssetAudit__Finding(
            'openEdges', 'Open edges',
            totals.openEdgeCount === 0 ? SEVERITY_PASS : SEVERITY_WARNING,
            totals.openEdgeCount.toLocaleString(),
            totals.openEdgeCount === 0
                ? `Every mesh is closed. SketchUp will report a solid volume.`
                : `Holes in the surface. SketchUp will not treat this as a solid, so it cannot be used with push/pull or boolean tools until repaired.`
        ));

        findings.push(Na__AssetAudit__Finding(
            'nonManifold', 'Non-manifold edges',
            totals.nonManifoldCount === 0 ? SEVERITY_PASS : SEVERITY_CRITICAL,
            totals.nonManifoldCount.toLocaleString(),
            totals.nonManifoldCount === 0
                ? `No edge is shared by more than two faces.`
                : `Edges shared by three or more faces. This geometry cannot exist as a real solid and most tools will refuse to repair it automatically.`
        ));

        findings.push(Na__AssetAudit__Finding(
            'reversedFaces', 'Inconsistent winding',
            totals.reversedEdgeCount === 0 ? SEVERITY_PASS : SEVERITY_WARNING,
            totals.reversedEdgeCount.toLocaleString(),
            totals.reversedEdgeCount === 0
                ? `Face winding is consistent throughout.`
                : `Some faces are wound against their neighbours. These import into SketchUp as reversed back faces and need correcting by hand.`
        ));

        findings.push(Na__AssetAudit__Finding(
            'degenerateFaces', 'Degenerate triangles',
            totals.degenerateCount === 0 ? SEVERITY_PASS : SEVERITY_WARNING,
            totals.degenerateCount.toLocaleString(),
            totals.degenerateCount === 0
                ? `No zero-area slivers.`
                : `Triangles below ${tolerances.degenerateTriangleArea} mm2. They carry no surface, break normal calculation and often stop SketchUp healing the surrounding face.`
        ));

        findings.push(Na__AssetAudit__Finding(
            'duplicateVertices', 'Unwelded vertices', SEVERITY_INFO,
            totals.duplicateVertices.toLocaleString(),
            totals.duplicateVertices === 0
                ? `Fully welded.`
                : `${totals.rawVertexCount.toLocaleString()} stored for ${totals.weldedVertexCount.toLocaleString()} distinct positions. Normal for most exchange formats; it defeats smooth shading and inflates the file.`
        ));

        // -- Volume, only meaningful on a closed surface --------------------------
        if (totals.analysedMeshes > 0 && totals.closedMeshes === totals.analysedMeshes) {
            const litres = Math.abs(totals.volumeMm3) / 1e6;
            findings.push(Na__AssetAudit__Finding(
                'volume', 'Enclosed volume', SEVERITY_INFO,
                `${litres.toFixed(3)} litres`,
                `${Math.abs(totals.volumeMm3).toFixed(0)} mm3. Meaningful because every mesh is closed.` +
                (totals.volumeMm3 < 0 ? ` The negative sign indicates the surface is wound inside out overall.` : ``)
            ));
        }

        // -- Materials and structure ---------------------------------------------
        findings.push(Na__AssetAudit__Finding(
            'materialInventory', 'Materials', SEVERITY_INFO,
            `${scene.materialCount} material${scene.materialCount === 1 ? '' : 's'}, ${scene.textureCount} texture${scene.textureCount === 1 ? '' : 's'}`,
            scene.textureCount > 0 ? `Textures are embedded into the GLB on export.` : `No textures; colours only.`
        ));

        findings.push(Na__AssetAudit__Finding(
            'nodeDepth', 'Hierarchy', SEVERITY_INFO,
            `${scene.nodeCount} nodes, ${scene.maxDepth} deep`,
            `${scene.meshCount} of these carry geometry.`
        ));

        findings.push(Na__AssetAudit__Finding(
            'nonUniformScale', 'Non-uniform scaling',
            scene.nonUniformNodes.length === 0 ? SEVERITY_PASS : SEVERITY_WARNING,
            String(scene.nonUniformNodes.length),
            scene.nonUniformNodes.length === 0
                ? `No node is scaled differently per axis.`
                : `Nodes scaled unevenly: ${scene.nonUniformNodes.slice(0, 3).map(n => n.name).join(', ')}. Dimensions may be correct on one axis only.`
        ));

        // -- Overall verdict -------------------------------------------------------
        const criticalCount = findings.filter(f => f.severity === SEVERITY_CRITICAL).length;
        const warningCount  = findings.filter(f => f.severity === SEVERITY_WARNING).length;

        const verdict =
            criticalCount > 0 ? 'critical' :
            warningCount  > 2 ? 'poor'     :
            warningCount  > 0 ? 'usable'   : 'clean';

        return {
            verdict         :  verdict,
            criticalCount   :  criticalCount,
            warningCount    :  warningCount,
            findings        :  findings,
            totals          :  totals,
            scene           :  scene,
            boundingBoxMm   :  { size : size.toArray(), min : box.min.toArray(), max : box.max.toArray(), centre : centre.toArray() },
            auditedAt       :  new Date().toISOString()
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
