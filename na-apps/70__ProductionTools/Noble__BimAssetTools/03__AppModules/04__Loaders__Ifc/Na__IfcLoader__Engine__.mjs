/* =============================================================================
   NOBLE BIM ASSET TOOLS | IFC LOADER - GEOMETRY ENGINE
   =============================================================================

   FILE       : Na__IfcLoader__Engine__.mjs
   NAMESPACE  : Na__BimAssetTools
   MODULE     : Loaders - IFC - Engine
   AUTHOR     : Adam Noble - Noble Architecture
   PURPOSE    : Parse an IFC file into unit-correct three.js geometry
   CREATED    : 14-Aug-2026

   DESCRIPTION:
   - Wraps web-ifc and turns its streamed mesh output into three.js meshes held in
     the application's internal millimetre space.
   - Geometry is merged by colour so a large model renders in a handful of draw
     calls, while an element range table preserves the IFC express ID behind every
     triangle so individual elements can still be identified and audited.

   ---------------------------------------------------------------------------

   THE PRECISION PROBLEM THIS MODULE EXISTS TO SOLVE:

   web-ifc hands back vertex data as Float32Array in LOCAL element space, together
   with a placement matrix as an ordinary JavaScript double array. Local vertices
   are component sized, so float32 holds them comfortably. The placement matrix is
   where a large coordinate lives.

   Naively multiplying the two and storing the result as float32 throws that away.
   A UK model georeferenced to the Ordnance Survey National Grid sits around
   523000000 mm east. Float32 has roughly seven significant digits, so at that
   magnitude the smallest representable step is about 32 mm - every coordinate in
   the model snaps to a 32 mm lattice, and the geometry visibly shears apart.

   This module therefore:
     1. Accumulates transformed world positions in Float64Array, not Float32Array.
     2. Measures the true bounding box in double precision.
     3. Subtracts a re-centring offset before the single downcast to float32, when
        the model sits further from the origin than the configured threshold.
     4. Records that offset on the result so the absolute position is never lost
        and can be reapplied on export if it is ever wanted.

   The outcome is that a component 300 mm across, modelled 523 km from the origin,
   still measures 300.000 mm after loading.

   ---------------------------------------------------------------------------

   WHAT web-ifc HANDS BACK, MEASURED RATHER THAN ASSUMED:

   web-ifc does NOT return geometry in the file's declared unit. It folds two
   conversions into every flatTransformation before we see it:

     1. The declared length unit is normalised to METRES. A file declaring
        IFCSIUNIT MILLI METRE arrives with 0.001 baked into the matrix scale.
     2. The IFC Z-up axis convention is rotated to the Y-up convention.

   Verified against DataDrivenConstruction RVT2IFC output declaring MILLI METRE:
   local vertices measured 18419 units across, the placement matrix carried a
   0.001 scale, and the transformed result measured 18.419 - metres.

   So the loader multiplies by a FIXED 1000 to reach millimetres and does NOT
   apply the declared unit factor, which would double-convert by a thousand. The
   declared unit is still resolved, for three reasons: to refuse files that
   declare no unit at all, to report the authoring unit in the audit panel, and
   to cross-check that the scale actually embedded in the matrices agrees with
   what the file claims. A disagreement is reported rather than silently trusted.

   INTERNAL CONVENTION ESTABLISHED HERE:
   Every loader in this application yields MILLIMETRES, Y-UP. Choosing Y-up to
   match glTF means the GLB exporter performs no axis rotation at all, which
   removes an entire class of "the component came in lying on its side" error.

   ============================================================================= */

import * as THREE                    from 'three';
import { IfcAPI }                    from 'web-ifc';
import { ResolveLengthUnit }         from './Na__IfcLoader__UnitResolver__.mjs';
import { GetConfig }                 from '../01__AppCore/Na__AppCore__AppState__.mjs';

// =============================================================================
// REGION | Module Constants
// =============================================================================

    // MODULE CONSTANTS | Vendor Paths and Buffer Layout
    // ------------------------------------------------------------
    const WASM_DIRECTORY        =  './04__Src__Dependencies__VersionLocked/02__Vendor__WebIfc__v0.0.77/';
    const FLOATS_PER_VERTEX     =  6;                                            // <-- web-ifc interleaves position xyz then normal xyz
    const POSITION_OFFSET       =  0;
    const NORMAL_OFFSET         =  3;

    // web-ifc normalises its output to metres, so this is the only scale applied
    // to reach the application's millimetre space. See the header for the
    // measurement that establishes this.
    const WEBIFC_METRES_TO_MM   =  1000.0;

    // How far the scale embedded in the placement matrices may drift from the
    // scale the file declares before the mismatch is reported. A relative
    // tolerance, because the two are compared as a ratio.
    const UNIT_CROSSCHECK_TOLERANCE = 0.001;                                     // <-- 0.1 percent
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Loader Settings Passed to web-ifc
    // ------------------------------------------------------------
    // COORDINATE_TO_ORIGIN is deliberately left OFF. web-ifc's own re-centring
    // happens before the geometry reaches us and is not reported back, so it would
    // silently discard the model's true position. Re-centring is handled here
    // instead, in double precision and with the offset recorded.
    const LOADER_SETTINGS = Object.freeze({
        COORDINATE_TO_ORIGIN :  false,
        CIRCLE_SEGMENTS      :  24                                               // <-- Curve tessellation. 24 keeps a 100 mm pipe within 0.4 mm of true
    });
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Engine Lifecycle
// =============================================================================

    // MODULE STATE | Shared web-ifc Instance
    // ------------------------------------------------------------
    // The WASM module costs about a second to instantiate, so one instance is
    // created lazily and reused for every subsequent file in the session.
    let IFC_API           =  null;
    let INITIALISATION    =  null;                                               // <-- In-flight promise, so concurrent loads share one init
    // ------------------------------------------------------------


    // FUNCTION | Initialise the web-ifc WASM Module Once
    // ------------------------------------------------------------
    export async function InitialiseIfcEngine() {
        if (IFC_API)        return IFC_API;
        if (INITIALISATION) return INITIALISATION;

        INITIALISATION = (async function Na__IfcEngine__Init() {
            const api = new IfcAPI();
            api.SetWasmPath(WASM_DIRECTORY, true);                                // <-- true means the path is absolute from the site root
            await api.Init();

            IFC_API = api;
            console.log('[Na IfcEngine] web-ifc WASM initialised.');
            return api;
        })();

        return INITIALISATION;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Geometry Accumulation
// =============================================================================

// -----------------------------------------------------------------------------
// REGION | Colour Batching
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build a Stable Key for a Placed Geometry Colour
    // ------------------------------------------------------------
    // Colours are quantised to three decimals before keying. IFC colour values
    // frequently differ in the twelfth decimal place for what is visibly the same
    // material, and batching on the raw value would produce hundreds of near
    // identical draw calls.
    function Na__IfcEngine__ColourKey(colour) {
        const q = (channel) => Math.round(channel * 1000) / 1000;
        return `${q(colour.x)}_${q(colour.y)}_${q(colour.z)}_${q(colour.w)}`;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Create an Empty Accumulator for One Colour Batch
    // ------------------------------------------------------------
    function Na__IfcEngine__CreateBatch(colour) {
        return {
            colour      :  { r : colour.x, g : colour.y, b : colour.z, a : colour.w },
            positions   :  [],                                                    // <-- Doubles, in source units, world space
            normals     :  [],
            indices     :  [],
            elements    :  [],                                                    // <-- { expressID, indexStart, indexCount }
            vertexCount :  0
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Mesh Streaming
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Append One Placed Geometry into Its Colour Batch
    // ------------------------------------------------------------
    // The placement matrix is applied here, in double precision, so the batch
    // accumulates true world coordinates before any downcast happens.
    function Na__IfcEngine__AppendPlacedGeometry(ifcApi, modelId, placed, batch, expressId) {
        const geometry   =  ifcApi.GetGeometry(modelId, placed.geometryExpressID);
        const vertexData =  ifcApi.GetVertexArray(geometry.GetVertexData(), geometry.GetVertexDataSize());
        const indexData  =  ifcApi.GetIndexArray(geometry.GetIndexData(),  geometry.GetIndexDataSize());

        const m          =  placed.flatTransformation;                            // <-- Column major 4x4, JavaScript doubles
        const baseVertex =  batch.vertexCount;
        const indexStart =  batch.indices.length;
        const vertexN    =  vertexData.length / FLOATS_PER_VERTEX;

        for (let v = 0; v < vertexN; v++) {
            const p = v * FLOATS_PER_VERTEX + POSITION_OFFSET;
            const n = v * FLOATS_PER_VERTEX + NORMAL_OFFSET;

            const px = vertexData[p], py = vertexData[p + 1], pz = vertexData[p + 2];
            const nx = vertexData[n], ny = vertexData[n + 1], nz = vertexData[n + 2];

            // -- Full affine transform of the position, accumulated as doubles.
            batch.positions.push(
                m[0] * px + m[4] * py + m[8]  * pz + m[12],
                m[1] * px + m[5] * py + m[9]  * pz + m[13],
                m[2] * px + m[6] * py + m[10] * pz + m[14]
            );

            // -- Normals take the rotation only, never the translation. Any scale
            // -- in the placement is removed by renormalising below.
            const tnx = m[0] * nx + m[4] * ny + m[8]  * nz;
            const tny = m[1] * nx + m[5] * ny + m[9]  * nz;
            const tnz = m[2] * nx + m[6] * ny + m[10] * nz;
            const len = Math.hypot(tnx, tny, tnz) || 1;
            batch.normals.push(tnx / len, tny / len, tnz / len);
        }

        for (let i = 0; i < indexData.length; i++) {
            batch.indices.push(indexData[i] + baseVertex);
        }

        batch.vertexCount += vertexN;
        batch.elements.push({
            expressID  : expressId,
            indexStart : indexStart,
            indexCount : indexData.length
        });

        geometry.delete();                                                        // <-- WASM heap is not garbage collected; leaking this exhausts memory
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Batch Finalisation
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Measure the Bounding Box of Every Batch in Double Precision
    // ------------------------------------------------------------
    function Na__IfcEngine__MeasureBounds(batches) {
        const min = [ Infinity,  Infinity,  Infinity];
        const max = [-Infinity, -Infinity, -Infinity];

        for (const batch of batches) {
            const positions = batch.positions;
            for (let i = 0; i < positions.length; i += 3) {
                for (let axis = 0; axis < 3; axis++) {
                    const value = positions[i + axis];
                    if (value < min[axis]) min[axis] = value;
                    if (value > max[axis]) max[axis] = value;
                }
            }
        }

        if (!Number.isFinite(min[0])) return null;                                // <-- No geometry at all
        return { min, max, centre : [0, 1, 2].map(a => (min[a] + max[a]) / 2) };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Convert One Batch into a three.js Mesh
    // ------------------------------------------------------------
    // This is the single point where doubles become float32, and it is also where
    // the metre to millimetre scale and the re-centring offset are applied. Doing
    // both in one pass means each coordinate is rounded exactly once.
    function Na__IfcEngine__BuildMesh(batch, offsetMm, materialConfig) {
        const count     =  batch.positions.length;
        const positions =  new Float32Array(count);

        for (let i = 0; i < count; i += 3) {
            positions[i]     = batch.positions[i]     * WEBIFC_METRES_TO_MM - offsetMm[0];
            positions[i + 1] = batch.positions[i + 1] * WEBIFC_METRES_TO_MM - offsetMm[1];
            positions[i + 2] = batch.positions[i + 2] * WEBIFC_METRES_TO_MM - offsetMm[2];
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('normal',   new THREE.BufferAttribute(new Float32Array(batch.normals), 3));
        geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(batch.indices), 1));
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();

        const isTransparent = batch.colour.a < 0.999;
        const material = new THREE.MeshStandardMaterial({
            color       :  new THREE.Color(batch.colour.r, batch.colour.g, batch.colour.b),
            roughness   :  materialConfig.defaultRoughness,
            metalness   :  materialConfig.defaultMetalness,
            transparent :  isTransparent,
            opacity     :  batch.colour.a,
            side        :  isTransparent ? THREE.DoubleSide : THREE.FrontSide,
            depthWrite  :  !isTransparent                                         // <-- Transparent glazing must not occlude what is behind it
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.name  = `IfcBatch_${Na__IfcEngine__ColourKey({ x : batch.colour.r, y : batch.colour.g, z : batch.colour.b, w : batch.colour.a })}`;
        mesh.userData.elementRanges = batch.elements;                             // <-- Express ID behind every triangle range
        return mesh;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Public Load Entry
// =============================================================================

    // FUNCTION | Load an IFC File into Millimetre-Space three.js Geometry
    // ------------------------------------------------------------
    export async function LoadIfcModel(arrayBuffer, fileName, onProgress) {
        const config  =  GetConfig();
        const ifcApi  =  await InitialiseIfcEngine();
        const modelId =  ifcApi.OpenModel(new Uint8Array(arrayBuffer), LOADER_SETTINGS);

        try {
            // -- Units first. Nothing may be scaled before this is known. --------
            const unit = ResolveLengthUnit(ifcApi, modelId);

            if (unit.confidence === 'unknown') {
                throw new Error(
                    `[Na IfcEngine] "${fileName}" declares no length unit. ` +
                    `Loading it would require guessing the scale, which this tool will not do. ` +
                    `Re-export the file with a valid IFCUNITASSIGNMENT.`
                );
            }

            // -- Stream every mesh into colour batches ---------------------------
            const batches        = new Map();
            let   meshesSeen     = 0;
            let   observedScale  = null;                                          // <-- Scale web-ifc actually baked into the matrices

            ifcApi.StreamAllMeshes(modelId, function Na__IfcEngine__OnMesh(flatMesh) {
                const placedList = flatMesh.geometries;

                for (let g = 0; g < placedList.size(); g++) {
                    const placed = placedList.get(g);
                    const key    = Na__IfcEngine__ColourKey(placed.color);

                    if (observedScale === null) {
                        // -- Length of the transform's first basis vector. For the
                        // -- rigid placements IFC produces this is the pure unit
                        // -- scale web-ifc folded in, with no shape distortion.
                        const m = placed.flatTransformation;
                        observedScale = Math.hypot(m[0], m[1], m[2]);
                    }

                    if (!batches.has(key)) batches.set(key, Na__IfcEngine__CreateBatch(placed.color));
                    Na__IfcEngine__AppendPlacedGeometry(ifcApi, modelId, placed, batches.get(key), flatMesh.expressID);
                }

                meshesSeen++;
                if (onProgress && (meshesSeen % 250) === 0) onProgress(meshesSeen);
            });

            const batchList = Array.from(batches.values());
            if (batchList.length === 0) {
                throw new Error(`[Na IfcEngine] "${fileName}" parsed successfully but contains no renderable geometry.`);
            }

            // -- Cross-check the declared unit against the observed scale ---------
            // web-ifc should have folded exactly the declared unit's metre factor
            // into the matrices. If it did not, the file is unusual enough that
            // the discrepancy must reach the user rather than be absorbed.
            const warnings          =  [];
            const expectedMetreScale=  unit.factorToMm / 1000;                    // <-- Declared unit expressed as metres per source unit
            const scaleAgrees       =  observedScale !== null &&
                                       Math.abs(observedScale - expectedMetreScale) <= expectedMetreScale * UNIT_CROSSCHECK_TOLERANCE;

            if (observedScale !== null && !scaleAgrees) {
                warnings.push(
                    `Unit cross-check failed. The file declares ${unit.unitName} ` +
                    `(${expectedMetreScale} m per unit) but the geometry carries a scale of ${observedScale}. ` +
                    `Dimensions have been taken from the geometry as web-ifc normalised it; verify a known length before exporting.`
                );
            }

            // -- Decide whether the model must be re-centred ----------------------
            const sourceBounds =  Na__IfcEngine__MeasureBounds(batchList);
            const centreMm     =  sourceBounds.centre.map(value => value * WEBIFC_METRES_TO_MM);
            const distanceMm   =  Math.hypot(centreMm[0], centreMm[1], centreMm[2]);
            const threshold    =  config.tolerances.originDistanceWarning;

            const mustRecentre =  distanceMm > threshold;
            const offsetMm     =  mustRecentre ? centreMm : [0, 0, 0];

            if (mustRecentre) {
                warnings.push(
                    `Model sat ${(distanceMm / 1000).toFixed(1)} m from the world origin and has been re-centred to protect ` +
                    `single-precision accuracy. The offset is recorded and can be reapplied if absolute position is needed.`
                );
            }

            // -- Build the three.js objects --------------------------------------
            const root = new THREE.Group();
            root.name  = fileName;

            for (const batch of batchList) {
                root.add(Na__IfcEngine__BuildMesh(batch, offsetMm, config.materials));
            }

            const elementCount = batchList.reduce((total, batch) => total + batch.elements.length, 0);

            return {
                object3d        :  root,
                axisConvention  :  'Y-up',                                        // <-- Established by web-ifc, matching glTF. No export rotation needed
                sourceUnit      :  unit.unitName,
                unitWasDeclared :  unit.confidence === 'declared',
                unitFactorToMm  :  WEBIFC_METRES_TO_MM,                           // <-- The scale this loader actually applied
                declaredUnitFactorToMm : unit.factorToMm,                         // <-- What the file claimed, kept for the audit trail
                unitDeclaration :  unit.declaration,
                unitConfidence  :  unit.confidence,
                unitCrossChecked:  scaleAgrees,

                worldOffsetMm   :  offsetMm,                                      // <-- Subtracted from every vertex; add back for absolute position
                wasRecentred    :  mustRecentre,
                originDistanceMm:  distanceMm,

                batchCount      :  batchList.length,
                elementCount    :  elementCount,
                warnings        :  warnings,
                metadata        :  { modelId : modelId, ifcMeshCount : meshesSeen }
            };
        } finally {
            ifcApi.CloseModel(modelId);                                           // <-- Always released, including on the error paths above
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
