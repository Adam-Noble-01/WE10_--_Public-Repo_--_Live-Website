/* =============================================================================
   NOBLE BIM ASSET TOOLS | GLB EXPORT - EXPORTER
   =============================================================================

   FILE       : Na__GlbExport__Exporter__.mjs
   NAMESPACE  : Na__BimAssetTools
   MODULE     : GlbExport - Exporter
   AUTHOR     : Adam Noble - Noble Architecture
   PURPOSE    : Write a dimensionally verified GLB for downstream use in SketchUp
   CREATED    : 14-Aug-2026

   DESCRIPTION:
   - Takes an asset held in the application's millimetre space and writes a GLB in
     metres, as the glTF 2.0 specification requires.
   - The export is then READ BACK and measured. If the round-tripped bounding box
     does not match the source within tolerance, the export is reported as failed
     rather than handed over. An export that is silently wrong is worse than no
     export at all, because it is trusted.

   ---------------------------------------------------------------------------

   WHY THE UNIT SCALE IS BAKED INTO VERTICES:

   The obvious implementation is to leave the geometry in millimetres and put a
   0.001 scale on the root node. The glTF specification supports that and a
   conformant importer applies it.

   It is not done that way here. Importers do sometimes drop or flatten node
   transforms, particularly when a user imports a component and immediately
   explodes it. A dropped node scale is a silent factor of one thousand, and on an
   isolated component there is nothing on screen to reveal it. Baking the scale
   into the vertex positions means the numbers in the file are correct on their
   own, independent of how the importer treats the node graph.

   The cost is a transient doubling of geometry memory during export, because the
   source geometry must not be mutated. That is an acceptable price.

   ---------------------------------------------------------------------------

   AXIS HANDLING:

   The application already works Y-up throughout, chosen deliberately to match
   glTF. So the exporter performs NO axis rotation. Assets whose loader reported a
   Z-up source, currently only the OpenCascade route, are rotated once at export
   and the rotation is recorded in the report.

   ============================================================================= */

import * as THREE           from 'three';
import { GLTFExporter }     from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader }       from 'three/addons/loaders/GLTFLoader.js';
import { GetConfig }        from '../01__AppCore/Na__AppCore__AppState__.mjs';

// =============================================================================
// REGION | Module Constants
// =============================================================================

    // MODULE CONSTANTS | Axis Correction
    // ------------------------------------------------------------
    const Z_UP_TO_Y_UP_RADIANS =  -Math.PI / 2;                                  // <-- Rotation about X that stands a Z-up model upright
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Export Preparation
// =============================================================================

    // HELPER FUNCTION | Deep Clone a Subtree Including Its Geometry
    // ------------------------------------------------------------
    // Object3D.clone() deliberately shares geometry and material by reference, so
    // a plain clone followed by a vertex transform would corrupt the asset still
    // sitting in the viewport. Geometries are cloned explicitly; materials are
    // shared, because the exporter only reads them.
    function Na__GlbExport__CloneWithGeometry(source) {
        const clone = source.clone(true);

        const sourceMeshes = [];
        source.traverse(node => { if (node.isMesh) sourceMeshes.push(node); });

        let meshOrdinal = 0;
        clone.traverse(function Na__GlbExport__CloneMeshGeometry(node) {
            if (!node.isMesh) return;
            node.geometry = sourceMeshes[meshOrdinal++].geometry.clone();
        });

        return clone;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Bake the Millimetre to Metre Scale into Vertex Positions
    // ------------------------------------------------------------
    // The scale, and any axis correction, are composed into a single matrix and
    // applied once per geometry so each coordinate is rounded exactly once.
    function Na__GlbExport__BakeTransform(root, scaleFactor, needsAxisCorrection) {
        const transform = new THREE.Matrix4().makeScale(scaleFactor, scaleFactor, scaleFactor);

        if (needsAxisCorrection) {
            transform.multiply(new THREE.Matrix4().makeRotationX(Z_UP_TO_Y_UP_RADIANS));
        }

        root.updateMatrixWorld(true);

        root.traverse(function Na__GlbExport__ApplyToGeometry(node) {
            if (!node.isMesh || !node.geometry) return;

            // -- Compose the node's own world placement with the export transform,
            // -- then flatten it into the vertices so the exported node graph
            // -- carries no transforms at all.
            //
            // BufferGeometry.applyMatrix4 already transforms the normal attribute
            // by the inverse-transpose and renormalises it. Calling
            // computeVertexNormals afterwards would look like a tidy-up but would
            // actually re-average normals across shared vertices and destroy the
            // hard edges the source defined, so it is deliberately NOT done.
            const combined = new THREE.Matrix4().multiplyMatrices(transform, node.matrixWorld);
            node.geometry.applyMatrix4(combined);
            node.geometry.computeBoundingBox();
            node.geometry.computeBoundingSphere();
        });

        // -- Every transform is now in the vertices, so the graph is reset flat.
        root.traverse(function Na__GlbExport__ResetTransforms(node) {
            node.position.set(0, 0, 0);
            node.rotation.set(0, 0, 0);
            node.scale.setScalar(1);
            node.updateMatrix();
        });
        root.updateMatrixWorld(true);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Release Cloned Geometry After Export
    // ------------------------------------------------------------
    function Na__GlbExport__DisposeClone(root) {
        root.traverse(function Na__GlbExport__DisposeNode(node) {
            if (node.isMesh && node.geometry) node.geometry.dispose();            // <-- Materials are shared with the source and must NOT be disposed
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Verification
// =============================================================================

    // HELPER FUNCTION | Measure the Bounding Box of an Object in Millimetres
    // ------------------------------------------------------------
    function Na__GlbExport__MeasureMm(object3d, unitScaleToMm) {
        const box  = new THREE.Box3().setFromObject(object3d);
        const size = new THREE.Vector3();
        box.getSize(size);
        return size.multiplyScalar(unitScaleToMm);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read the Written GLB Back and Compare Its Dimensions
    // ------------------------------------------------------------
    // This is the whole point of the module. The file that will actually be handed
    // to SketchUp is parsed with an independent loader and measured, so the check
    // covers the exporter's own serialisation rather than the intent behind it.
    async function Na__GlbExport__VerifyDimensions(glbBuffer, expectedSizeMm, toleranceMm) {
        const loader = new GLTFLoader();

        const parsed = await new Promise(function Na__GlbExport__ParseBack(resolve, reject) {
            loader.parse(glbBuffer, '', resolve, reject);
        });

        // -- The GLB is in metres, so scale the measurement back to millimetres.
        const measuredMm = Na__GlbExport__MeasureMm(parsed.scene, 1000);

        const deviation = [
            Math.abs(measuredMm.x - expectedSizeMm.x),
            Math.abs(measuredMm.y - expectedSizeMm.y),
            Math.abs(measuredMm.z - expectedSizeMm.z)
        ];
        const worstDeviation = Math.max(...deviation);

        // -- Dispose the verification copy; it exists only to be measured.
        parsed.scene.traverse(node => { if (node.isMesh && node.geometry) node.geometry.dispose(); });

        return {
            passed          :  worstDeviation <= toleranceMm,
            expectedMm      :  expectedSizeMm.toArray(),
            measuredMm      :  measuredMm.toArray(),
            deviationMm     :  deviation,
            worstDeviationMm:  worstDeviation,
            toleranceMm     :  toleranceMm
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Public Export Entry
// =============================================================================

    // FUNCTION | Export an Asset to a Verified GLB Blob
    // ------------------------------------------------------------
    export async function ExportAssetToGlb(asset) {
        const config      =  GetConfig();
        const exportCfg   =  config.glbExport;

        if (!asset.object3d) {
            throw new Error(`[Na GlbExport] "${asset.fileName}" carries no geometry to export.`);
        }

        // -- Measure the source before touching anything -------------------------
        const sourceSizeMm      =  Na__GlbExport__MeasureMm(asset.object3d, 1);
        const needsAxisFix      =  asset.axisConvention === 'Z-up';

        // -- Prepare an isolated copy in metres -----------------------------------
        const exportRoot = Na__GlbExport__CloneWithGeometry(asset.object3d);
        exportRoot.name  = asset.fileName.replace(/\.[^.]+$/, '');

        try {
            Na__GlbExport__BakeTransform(exportRoot, exportCfg.scaleFactor, needsAxisFix);

            // -- Write the GLB -----------------------------------------------------
            const exporter = new GLTFExporter();
            const glbBuffer = await new Promise(function Na__GlbExport__Write(resolve, reject) {
                exporter.parse(
                    exportRoot,
                    resolve,
                    reject,
                    {
                        binary                  :  true,
                        onlyVisible             :  false,                        // <-- Hidden elements are still part of the component
                        truncateDrawRange       :  false,
                        embedImages             :  exportCfg.embedTextures,
                        includeCustomExtensions :  false
                    }
                );
            });

            if (!(glbBuffer instanceof ArrayBuffer)) {
                throw new Error('[Na GlbExport] The exporter returned glTF JSON rather than a binary GLB.');
            }

            // -- Verify against the source ------------------------------------------
            // The axis correction swaps which measurement belongs to which axis, so
            // the expected size is permuted to match before comparison.
            const expectedSizeMm = needsAxisFix
                ? new THREE.Vector3(sourceSizeMm.x, sourceSizeMm.z, sourceSizeMm.y)
                : sourceSizeMm.clone();

            const verification = exportCfg.verifyAfterExport
                ? await Na__GlbExport__VerifyDimensions(glbBuffer, expectedSizeMm, config.tolerances.exportVerifyTolerance)
                : null;

            if (verification && !verification.passed) {
                throw new Error(
                    `[Na GlbExport] Dimensional verification FAILED for "${asset.fileName}". ` +
                    `Expected ${expectedSizeMm.toArray().map(v => v.toFixed(3)).join(' x ')} mm, ` +
                    `measured ${verification.measuredMm.map(v => v.toFixed(3)).join(' x ')} mm, ` +
                    `worst deviation ${verification.worstDeviationMm.toFixed(4)} mm against a tolerance of ${verification.toleranceMm} mm. ` +
                    `The exported file has NOT been handed over.`
                );
            }

            return {
                blob            :  new Blob([glbBuffer], { type : 'model/gltf-binary' }),
                byteLength      :  glbBuffer.byteLength,
                suggestedName   :  `${exportRoot.name}.glb`,

                sourceSizeMm    :  sourceSizeMm.toArray(),
                exportedUnit    :  exportCfg.targetUnit,
                scaleFactor     :  exportCfg.scaleFactor,
                axisCorrected   :  needsAxisFix,
                axisConvention  :  'Y-up',
                scaleBaked      :  true,
                dracoCompressed :  false,
                verification    :  verification
            };
        } finally {
            Na__GlbExport__DisposeClone(exportRoot);                              // <-- Always released, including on the failure paths above
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Trigger a Browser Download for an Export Result
    // ------------------------------------------------------------
    export function DownloadGlbResult(exportResult) {
        const url    = URL.createObjectURL(exportResult.blob);
        const anchor = document.createElement('a');

        anchor.href     = url;
        anchor.download = exportResult.suggestedName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);

        // -- Revoking immediately can cancel the download in some browsers, so the
        // -- object URL is released on the next tick instead.
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
