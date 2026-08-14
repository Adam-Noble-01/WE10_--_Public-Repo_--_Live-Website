/* =============================================================================
   NOBLE BIM ASSET TOOLS | MESH LOADER - FORMAT ROUTER
   =============================================================================

   FILE       : Na__MeshLoader__Router__.mjs
   NAMESPACE  : Na__BimAssetTools
   MODULE     : Loaders - Mesh - Router
   AUTHOR     : Adam Noble - Noble Architecture
   PURPOSE    : Load the plain mesh exchange formats through the stock three.js addons
   CREATED    : 14-Aug-2026

   DESCRIPTION:
   - Handles glTF, GLB, OBJ, STL, PLY, 3DS, COLLADA and FBX. These are the formats
     that turn up when a component is downloaded from a manufacturer's website or a
     model marketplace rather than from a BIM library.
   - Every loader here is imported lazily. Loading a 400 KB STL should not first
     parse the FBX loader, and the addons are large enough for that to be felt.

   ---------------------------------------------------------------------------

   THE UNIT PROBLEM WITH THESE FORMATS:

   Only three of them carry a trustworthy unit declaration:
     glTF / GLB   The specification fixes linear units at METRES. Reliable.
     COLLADA      Declares a unit scale in its <asset> block. Usually honest.
     FBX          Carries UnitScaleFactor, defaulting to centimetres.

   OBJ, STL, PLY and 3DS declare nothing whatsoever. A number in an STL file is
   just a number. This module applies the assumption recorded in the format
   registry, marks the asset as unitWasDeclared = false, and the interface then
   presents a unit override so the user can correct it against a known dimension.
   That is the honest handling: assume, disclose, and make it correctable.

   AXIS CONVENTION:
   The application works Y-up throughout, matching glTF. The three.js glTF, FBX and
   COLLADA loaders already yield Y-up. STL, PLY, OBJ and 3DS come from a Z-up
   lineage often enough that the source axis is reported rather than corrected, and
   the viewer offers an explicit Z-up to Y-up toggle.

   ============================================================================= */

import * as THREE                     from 'three';
import { ToMillimetres, UNIT_TO_MM }  from '../01__AppCore/Na__AppCore__Units__.mjs';
import { GetConfig }                  from '../01__AppCore/Na__AppCore__AppState__.mjs';

// =============================================================================
// REGION | Module Constants
// =============================================================================

    // MODULE CONSTANTS | Extension to Lazy Loader Factory
    // ------------------------------------------------------------
    // Each entry returns a promise for the addon module, so nothing is fetched
    // until a file of that type is actually opened.
    const LOADER_FACTORIES = Object.freeze({
        '.gltf' : () => import('three/addons/loaders/GLTFLoader.js').then(m => new m.GLTFLoader()),
        '.glb'  : () => import('three/addons/loaders/GLTFLoader.js').then(m => new m.GLTFLoader()),
        '.obj'  : () => import('three/addons/loaders/OBJLoader.js').then(m  => new m.OBJLoader()),
        '.stl'  : () => import('three/addons/loaders/STLLoader.js').then(m  => new m.STLLoader()),
        '.ply'  : () => import('three/addons/loaders/PLYLoader.js').then(m  => new m.PLYLoader()),
        '.3ds'  : () => import('three/addons/loaders/TDSLoader.js').then(m  => new m.TDSLoader()),
        '.dae'  : () => import('three/addons/loaders/ColladaLoader.js').then(m => new m.ColladaLoader()),
        '.fbx'  : () => import('three/addons/loaders/FBXLoader.js').then(m  => new m.FBXLoader())
    });
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Loaders Whose Parse Returns a Bare BufferGeometry
    // ------------------------------------------------------------
    // STL and PLY hand back geometry rather than a scene graph, so a mesh has to
    // be constructed around the result before it can be treated uniformly.
    const GEOMETRY_ONLY_FORMATS = Object.freeze(['.stl', '.ply']);
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Formats Whose Loader Emits a Y-Up Scene
    // ------------------------------------------------------------
    const NATIVE_Y_UP_FORMATS = Object.freeze(['.gltf', '.glb', '.dae', '.fbx']);
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Parse Helpers
// =============================================================================

    // HELPER FUNCTION | Normalise Whatever a Loader Returned into an Object3D
    // ------------------------------------------------------------
    function Na__MeshLoader__NormaliseResult(parsed, extension, materialConfig) {
        if (GEOMETRY_ONLY_FORMATS.includes(extension)) {
            const geometry = parsed;
            if (!geometry.attributes || !geometry.attributes.normal) geometry.computeVertexNormals();

            const material = new THREE.MeshStandardMaterial({
                color     : new THREE.Color(materialConfig.defaultColour),
                roughness : materialConfig.defaultRoughness,
                metalness : materialConfig.defaultMetalness
            });

            const group = new THREE.Group();
            group.add(new THREE.Mesh(geometry, material));
            return group;
        }

        // -- glTF wraps its graph in a result object; the others return a scene
        // -- or group directly.
        if (parsed.scene)  return parsed.scene;
        if (parsed.isObject3D) return parsed;

        throw new Error(`[Na MeshLoader] Loader for "${extension}" returned an unrecognised result shape.`);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Give Every Mesh a Material If the Format Carried None
    // ------------------------------------------------------------
    // OBJ files without an accompanying MTL, and some 3DS exports, arrive with no
    // material at all. three.js substitutes a white MeshPhongMaterial, which reads
    // as washed out; the application's neutral grey is applied instead.
    function Na__MeshLoader__EnsureMaterials(root, materialConfig) {
        let replaced = 0;

        root.traverse(function Na__MeshLoader__CheckMaterial(node) {
            if (!node.isMesh) return;

            const missing = !node.material ||
                            (Array.isArray(node.material) && node.material.length === 0);

            if (missing) {
                node.material = new THREE.MeshStandardMaterial({
                    color     : new THREE.Color(materialConfig.defaultColour),
                    roughness : materialConfig.defaultRoughness,
                    metalness : materialConfig.defaultMetalness
                });
                replaced++;
            }

            if (node.geometry && !node.geometry.attributes.normal) node.geometry.computeVertexNormals();
        });

        return replaced;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read the Unit a COLLADA or FBX File Declared
    // ------------------------------------------------------------
    // Both formats record a scale into metres. three.js surfaces the COLLADA value
    // on the parsed result; FBX bakes its centimetre default into the scene scale,
    // which is why FBX is treated as centimetres unless told otherwise.
    function Na__MeshLoader__ReadDeclaredUnit(parsed, extension) {
        if (extension === '.gltf' || extension === '.glb') {
            return { unitName : 'metre', factorToMm : UNIT_TO_MM.metre, declared : true, note : 'glTF 2.0 fixes linear units at metres.' };
        }

        if (extension === '.dae') {
            const metresPerUnit = parsed && parsed.library && parsed.library.asset ? parsed.library.asset.unit : null;

            if (Number.isFinite(metresPerUnit) && metresPerUnit > 0) {
                return {
                    unitName   : 'declared COLLADA unit',
                    factorToMm : metresPerUnit * UNIT_TO_MM.metre,
                    declared   : true,
                    note       : `COLLADA asset block declares ${metresPerUnit} metres per unit.`
                };
            }
            return { unitName : 'metre', factorToMm : UNIT_TO_MM.metre, declared : false, note : 'COLLADA asset block carried no unit; metres assumed.' };
        }

        if (extension === '.fbx') {
            return { unitName : 'centimetre', factorToMm : UNIT_TO_MM.centimetre, declared : false, note : 'FBX default of centimetres assumed.' };
        }

        return null;                                                              // <-- Caller falls back to the format registry assumption
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Public Load Entry
// =============================================================================

    // FUNCTION | Load a Mesh Format File into Millimetre-Space three.js Geometry
    // ------------------------------------------------------------
    export async function LoadMeshModel(arrayBuffer, fileName, extension, formatEntry) {
        const config  = GetConfig();
        const factory = LOADER_FACTORIES[extension];

        if (!factory) throw new Error(`[Na MeshLoader] No loader is registered for "${extension}".`);

        const loader = await factory();
        const warnings = [];

        // -- Parse ------------------------------------------------------------
        // The text based formats need a decoded string; the binary ones take the
        // buffer. STL is handled by the buffer path because its loader sniffs
        // ASCII versus binary itself.
        const wantsText = (extension === '.obj' || extension === '.dae');
        const payload   = wantsText
            ? new TextDecoder('utf-8', { fatal : false }).decode(arrayBuffer)
            : arrayBuffer;

        let parsed;
        try {
            parsed = loader.parse(payload, '');
        } catch (err) {
            throw new Error(`[Na MeshLoader] "${fileName}" could not be parsed as ${formatEntry.label}. ${err.message}`);
        }

        const root = Na__MeshLoader__NormaliseResult(parsed, extension, config.materials);

        const replacedMaterials = Na__MeshLoader__EnsureMaterials(root, config.materials);
        if (replacedMaterials > 0) {
            warnings.push(`${replacedMaterials} mesh${replacedMaterials === 1 ? '' : 'es'} carried no material and were given the default grey.`);
        }

        // -- Resolve the unit --------------------------------------------------
        const declared = Na__MeshLoader__ReadDeclaredUnit(parsed, extension);
        const assumedName = formatEntry.assumedUnit || 'millimetre';

        const unit = declared || {
            unitName   : assumedName,
            factorToMm : UNIT_TO_MM[assumedName],
            declared   : false,
            note       : `${formatEntry.label} carries no unit declaration; ${assumedName}s assumed.`
        };

        if (!unit.declared) {
            warnings.push(`${unit.note} Confirm against a known dimension before exporting.`);
        }

        // -- Scale into millimetres -------------------------------------------
        // Applied to the root transform and then baked, so the exported geometry
        // carries real millimetre coordinates rather than relying on a node scale
        // that a downstream importer might ignore.
        root.scale.setScalar(unit.factorToMm);
        root.updateMatrixWorld(true);

        root.traverse(function Na__MeshLoader__BakeScale(node) {
            if (!node.isMesh || !node.geometry) return;
            node.geometry.applyMatrix4(node.matrixWorld);
            node.geometry.computeBoundingBox();
            node.geometry.computeBoundingSphere();
        });

        root.scale.setScalar(1);
        root.position.set(0, 0, 0);
        root.rotation.set(0, 0, 0);
        root.updateMatrixWorld(true);

        const sourceAxis = NATIVE_Y_UP_FORMATS.includes(extension) ? 'Y-up' : 'unknown';
        if (sourceAxis === 'unknown') {
            warnings.push(`${formatEntry.label} does not record an axis convention. If the model appears to lie on its side, apply the Z-up correction in the viewer.`);
        }

        return {
            object3d        : root,
            axisConvention  : sourceAxis,
            sourceUnit      : unit.unitName,
            unitWasDeclared : unit.declared === true,
            unitFactorToMm  : unit.factorToMm,
            unitDeclaration : unit.note,
            unitConfidence  : unit.declared ? 'declared' : 'assumed',
            worldOffsetMm   : [0, 0, 0],
            wasRecentred    : false,
            warnings        : warnings,
            metadata        : { animations : (parsed && parsed.animations) ? parsed.animations.length : 0 }
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
