/* =============================================================================
   NOBLE BIM ASSET TOOLS | CAD LOADER - OPENCASCADE BRIDGE
   =============================================================================

   FILE       : Na__CadLoader__OcctBridge__.mjs
   NAMESPACE  : Na__BimAssetTools
   MODULE     : Loaders - CAD - OCCT Bridge
   AUTHOR     : Adam Noble - Noble Architecture
   PURPOSE    : Read STEP, IGES and BREP solids through the OpenCascade WASM build
   CREATED    : 14-Aug-2026

   DESCRIPTION:
   - STEP is what manufacturers actually publish when they publish anything useful.
     Unlike a mesh format it carries true BREP solids, so the surfaces are exact
     and the triangle density is ours to choose rather than the supplier's.
   - occt-import-js is a UMD classic script exposing a window.occtimportjs factory,
     the same shape as jsPDF in the Lantern Designer, so it is loaded by a script
     tag rather than through the import map.

   ---------------------------------------------------------------------------

   TESSELLATION AND WHY IT IS A DIMENSIONAL DECISION:

   A STEP file describes a cylinder as a mathematical surface. Rendering it means
   choosing how many flat facets stand in for that surface, and every facet cuts
   the corner slightly INSIDE the true form. The linear deflection setting is the
   maximum permitted distance between facet and true surface.

   At the configured default of 0.1 mm, a 110 mm diameter rainwater pipe measures
   between 109.8 and 110.0 mm across depending on where it is measured. That is
   inside any architectural tolerance but it is not nothing, and it is why the
   audit panel reports the deflection actually used alongside the measured bounding
   box. Tightening to the 'fine' preset costs triangles and buys a 0.01 mm fit.

   UNITS:
   STEP and IGES both declare their unit in the file header and OpenCascade honours
   it, returning millimetres. BREP is a raw OpenCascade dump with no unit block at
   all, so millimetres are assumed and the asset is flagged as undeclared.

   ============================================================================= */

import * as THREE       from 'three';
import { GetConfig }    from '../01__AppCore/Na__AppCore__AppState__.mjs';

// =============================================================================
// REGION | Module Constants
// =============================================================================

    // MODULE CONSTANTS | Vendor Paths and Global Name
    // ------------------------------------------------------------
    const OCCT_SCRIPT_PATH  =  './04__Src__Dependencies__VersionLocked/03__Vendor__OcctImportJs__v0.0.23/occt-import-js.js';
    const OCCT_WASM_PATH    =  './04__Src__Dependencies__VersionLocked/03__Vendor__OcctImportJs__v0.0.23/occt-import-js.wasm';
    const OCCT_GLOBAL_NAME  =  'occtimportjs';
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Extension to OpenCascade Read Function
    // ------------------------------------------------------------
    const READ_FUNCTION_BY_EXTENSION = Object.freeze({
        '.step' : 'ReadStepFile',
        '.stp'  : 'ReadStepFile',
        '.iges' : 'ReadIgesFile',
        '.igs'  : 'ReadIgesFile',
        '.brep' : 'ReadBrepFile',
        '.brp'  : 'ReadBrepFile'
    });
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Formats That Declare Their Own Unit
    // ------------------------------------------------------------
    const UNIT_DECLARING_FORMATS = Object.freeze(['.step', '.stp', '.iges', '.igs']);
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Engine Lifecycle
// =============================================================================

    // MODULE STATE | Shared OpenCascade Instance
    // ------------------------------------------------------------
    let OCCT_MODULE     =  null;
    let INITIALISATION  =  null;
    // ------------------------------------------------------------


    // HELPER FUNCTION | Inject the UMD Classic Script Once
    // ------------------------------------------------------------
    function Na__OcctBridge__LoadClassicScript() {
        return new Promise(function Na__OcctBridge__ScriptPromise(resolve, reject) {
            if (window[OCCT_GLOBAL_NAME]) { resolve(); return; }

            const existing = document.querySelector(`script[data-na-vendor="occt"]`);
            if (existing) {                                                       // <-- A concurrent load is already in flight
                existing.addEventListener('load',  () => resolve());
                existing.addEventListener('error', () => reject(new Error('[Na OcctBridge] occt-import-js failed to load.')));
                return;
            }

            const script = document.createElement('script');
            script.src               = OCCT_SCRIPT_PATH;
            script.dataset.naVendor  = 'occt';
            script.onload            = () => resolve();
            script.onerror           = () => reject(new Error(`[Na OcctBridge] Could not load ${OCCT_SCRIPT_PATH}.`));
            document.head.appendChild(script);
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Initialise the OpenCascade WASM Module Once
    // ------------------------------------------------------------
    export async function InitialiseOcctEngine() {
        if (OCCT_MODULE)    return OCCT_MODULE;
        if (INITIALISATION) return INITIALISATION;

        INITIALISATION = (async function Na__OcctBridge__Init() {
            await Na__OcctBridge__LoadClassicScript();

            const factory = window[OCCT_GLOBAL_NAME];
            if (typeof factory !== 'function') {
                throw new Error(`[Na OcctBridge] window.${OCCT_GLOBAL_NAME} is not the expected factory function.`);
            }

            // -- Emscripten asks where to fetch the wasm binary from. Answering
            // -- explicitly avoids it guessing from document.currentScript, which
            // -- is null by the time the factory runs.
            OCCT_MODULE = await factory({
                locateFile : function Na__OcctBridge__LocateFile(requestedPath) {
                    return requestedPath.endsWith('.wasm') ? OCCT_WASM_PATH : requestedPath;
                }
            });

            console.log('[Na OcctBridge] OpenCascade WASM initialised.');
            return OCCT_MODULE;
        })();

        return INITIALISATION;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Result Conversion
// =============================================================================

    // HELPER FUNCTION | Convert One OpenCascade Mesh into a three.js Mesh
    // ------------------------------------------------------------
    // occt-import-js returns plain arrays of positions, normals and indices, plus
    // an optional per-mesh colour. Coordinates are already millimetres.
    function Na__OcctBridge__BuildMesh(occtMesh, materialConfig) {
        const geometry = new THREE.BufferGeometry();

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(occtMesh.attributes.position.array, 3));

        if (occtMesh.attributes.normal && occtMesh.attributes.normal.array.length > 0) {
            geometry.setAttribute('normal', new THREE.Float32BufferAttribute(occtMesh.attributes.normal.array, 3));
        }

        if (occtMesh.index && occtMesh.index.array) {
            geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(occtMesh.index.array), 1));
        }

        if (!geometry.attributes.normal) geometry.computeVertexNormals();
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();

        const colour = occtMesh.color
            ? new THREE.Color(occtMesh.color[0], occtMesh.color[1], occtMesh.color[2])
            : new THREE.Color(materialConfig.defaultColour);

        const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
            color     : colour,
            roughness : materialConfig.defaultRoughness,
            metalness : materialConfig.defaultMetalness
        }));

        mesh.name = occtMesh.name || 'OcctSolid';
        return mesh;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Public Load Entry
// =============================================================================

    // FUNCTION | Load a STEP, IGES or BREP File into Millimetre-Space Geometry
    // ------------------------------------------------------------
    export async function LoadCadModel(arrayBuffer, fileName, extension, tessellationPreset) {
        const config       =  GetConfig();
        const occt         =  await InitialiseOcctEngine();
        const readFunction =  READ_FUNCTION_BY_EXTENSION[extension];

        if (!readFunction) throw new Error(`[Na OcctBridge] No OpenCascade reader is registered for "${extension}".`);

        const presets      =  config.occtTessellation.presets;
        const tessellation =  (tessellationPreset && presets[tessellationPreset]) || {
            linearDeflection  : config.occtTessellation.linearDeflection,
            angularDeflection : config.occtTessellation.angularDeflection
        };

        const parameters = {
            linearUnit           : 'millimeter',                                  // <-- Requested output unit; OCCT converts from the declared header unit
            linearDeflectionType : 'bounding_box_ratio',
            linearDeflection     : tessellation.linearDeflection,
            angularDeflection    : tessellation.angularDeflection
        };

        const result = occt[readFunction](new Uint8Array(arrayBuffer), parameters);

        if (!result || !result.success) {
            throw new Error(`[Na OcctBridge] OpenCascade could not read "${fileName}". The file may be truncated or use an unsupported STEP application protocol.`);
        }

        if (!result.meshes || result.meshes.length === 0) {
            throw new Error(`[Na OcctBridge] "${fileName}" was read successfully but produced no solids to tessellate.`);
        }

        const root = new THREE.Group();
        root.name  = fileName;

        for (const occtMesh of result.meshes) {
            root.add(Na__OcctBridge__BuildMesh(occtMesh, config.materials));
        }

        const declaresUnit = UNIT_DECLARING_FORMATS.includes(extension);
        const warnings     = [
            `Tessellated at ${tessellation.linearDeflection} mm linear deflection. ` +
            `Curved surfaces sit up to that distance inside their true form.`
        ];

        if (!declaresUnit) {
            warnings.push('BREP files carry no unit declaration. Millimetres assumed - confirm against a known dimension before exporting.');
        }

        return {
            object3d        : root,
            axisConvention  : 'Z-up',                                             // <-- Mechanical CAD convention; corrected at export
            sourceUnit      : 'millimetre',
            unitWasDeclared : declaresUnit,
            unitFactorToMm  : 1.0,                                                // <-- OpenCascade was asked for millimetres directly
            unitDeclaration : declaresUnit
                ? 'Unit read from the file header by OpenCascade and converted to millimetres.'
                : 'No unit declaration in this format; millimetres assumed.',
            unitConfidence  : declaresUnit ? 'declared' : 'assumed',
            worldOffsetMm   : [0, 0, 0],
            wasRecentred    : false,
            warnings        : warnings,
            metadata        : {
                solidCount        : result.meshes.length,
                linearDeflection  : tessellation.linearDeflection,
                angularDeflection : tessellation.angularDeflection,
                occtRoot          : result.root || null
            }
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
