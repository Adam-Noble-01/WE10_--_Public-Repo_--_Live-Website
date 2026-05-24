// =============================================================================
// TRUEVISION3D - MULTI-MODEL LOADER
// =============================================================================
//
// FILE       : Na__ModelLoader__MultiModel.js
// NAMESPACE  : Na__ModelLoader
// MODULE     : MultiModel
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Load multiple categorized GLB model pairs (Mesh + Linework)
// CREATED    : 10-Feb-2026
//
// DESCRIPTION:
// - Loads multiple GLB model pairs from an array of CDN URLs.
// - Classifies each URL by parsing the TrueVision category and model type.
// - Accepts strict __TrueVision__ namespace model filenames.
// - Loads models sequentially in priority order defined by the GLB Builder tag ranges.
// - Each category gets its own THREE.Group for future per-category toggling.
// - Material config and linework config are read from AppConfig (passed in).
//
// =============================================================================

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';


// -----------------------------------------------------------------------------
// REGION | Module Constants and Category Registry
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Model Category Loading Priority Order
    // ------------------------------------------------------------
    // Matches GLB Builder tag range definitions, rebranded to TrueVision namespace.
    // Building models load first, then environment, furniture, vegetation, context.
    // ------------------------------------------------------------
    const Na__ModelCategories__LoadOrder = [
        "TrueVision__MainBuildingModel__Existing",           // <-- Tag 10: Existing building massing
        "TrueVision__MainBuildingModel__ExistingWalls",      // <-- Tag 11
        "TrueVision__MainBuildingModel__ExistingFloors",     // <-- Tag 12
        "TrueVision__MainBuildingModel__ExistingRoofs",      // <-- Tag 13
        "TrueVision__MainBuildingModel__ExistingWindows",    // <-- Tag 14
        "TrueVision__MainBuildingModel__ExistingDoors",      // <-- Tag 15
        "TrueVision__MainBuildingModel__ExistingStairs",     // <-- Tag 16
        "TrueVision__MainBuildingModel__ExistingFixtures",   // <-- Tag 17
        "TrueVision__MainBuildingModel__ExistingFurniture",  // <-- Tag 18
        "TrueVision__MainBuildingModel__ExistingInteriorDecor", // <-- Tag 19
        "TrueVision__MainBuildingModel__Proposed",           // <-- Tag 20
        "TrueVision__MainBuildingModel__ProposedWalls",      // <-- Tag 21
        "TrueVision__MainBuildingModel__ProposedFloors",     // <-- Tag 22
        "TrueVision__MainBuildingModel__ProposedRoofs",      // <-- Tag 23
        "TrueVision__MainBuildingModel__ProposedWindows",    // <-- Tag 24
        "TrueVision__MainBuildingModel__ProposedDoors",      // <-- Tag 25 (interactive ADR assemblies)
        "TrueVision__MainBuildingModel__ProposedStairs",     // <-- Tag 26
        "TrueVision__MainBuildingModel__ProposedFixtures",   // <-- Tag 27
        "TrueVision__MainBuildingModel__ProposedFurniture",  // <-- Tag 28
        "TrueVision__MainBuildingModel__ProposedInteriorDecor", // <-- Tag 29
        "TrueVision__SiteBoundaries",                // <-- Tag 08: Site boundaries (fences, walls, site lines)
        "TrueVision__LandscapeEnvironment",          // <-- Tag 07, 09: Landscape & environment
        "TrueVision__GroundFloorFurniture",          // <-- Tag 30-38: Ground floor furniture
        "TrueVision__GroundFloorDecor",              // <-- Tag 39:    Ground floor high detail
        "TrueVision__FirstFloorFurniture",           // <-- Tag 40-48: First floor furniture
        "TrueVision__FirstFloorDecor",               // <-- Tag 49:    First floor high detail
        "TrueVision__Vegetation",                    // <-- Tag 50-59: Vegetation
        "TrueVision__SceneContextual"                // <-- Tag 60-70: Scene context
    ];
    // ------------------------------------------------------------


    // MODULE CONSTANTS | URL Parsing Regex
    // ------------------------------------------------------------
    // Primary: Accepts strict __TrueVision__ naming with optional project prefix.
    // Supports optional project prefix (e.g., DeLisle__TrueVision__).
    // Captures: [1] namespace (TrueVision), [2] category, [3] model type.
    // Storey:  Matches storey-based GLB filenames (e.g., NP03__Storey__GroundFloor__ProposedWalls__MeshModel__.glb).
    // Captures: [1] storey name (GroundFloor), [2] element type (ProposedWalls), [3] model type.
    // OrbitHelperCube: Matches OrbitHelperCube GLB files exported from SketchUp for orbit target positioning.
    // ------------------------------------------------------------
    const Na__ModelUrl__ParseRegex        = /(?:.*?__)?(TrueVision)__(.+?)__(MeshModel|LineworkModel)__\.glb/i;
    const Na__ModelUrl__StoreyParseRegex  = /(?:.*?__)?Storey__([A-Za-z]+)__([A-Za-z]+)__(MeshModel|LineworkModel)__\.glb/i;
    const Na__ModelUrl__OrbitCubeRegex    = /OrbitHelperCube__MeshModel__\.glb$/i;  // <-- Orbit helper cube detection
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | URL Classification Functions
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Parse Single Model URL Into Category and Type
    // ------------------------------------------------------------
    function Na__ModelLoader__ParseModelUrl(url) {
        if (!url || typeof url !== 'string') return null;                // <-- Guard against invalid input

        const filename  = url.split('/').pop();                          // <-- Extract filename from URL

        // PRIMARY REGEX | New TrueVision naming convention
        const match = Na__ModelUrl__ParseRegex.exec(filename);           // <-- Run primary regex
        if (match) {
            const namespace = match[1];                                  // <-- TrueVision
            const category  = match[2];                                  // <-- e.g. MainBuildingModel__Existing
            const modelType = match[3];                                  // <-- MeshModel or LineworkModel

            const normalizedCategory = `TrueVision__${category}`;        // <-- Build strict category key

            return {
                url            : url,                                    // <-- Original full URL
                category       : normalizedCategory,                     // <-- Normalized category key
                modelType      : modelType,                              // <-- MeshModel or LineworkModel
                rawNamespace   : namespace                               // <-- Original namespace for logging
            };
        }

        // STOREY REGEX | Storey-based GLB naming (e.g., NP03__Storey__GroundFloor__ProposedWalls__MeshModel__.glb)
        const storeyMatch = Na__ModelUrl__StoreyParseRegex.exec(filename);
        if (storeyMatch) {
            const storeyName  = storeyMatch[1];                          // <-- e.g. "GroundFloor"
            const elementType = storeyMatch[2];                          // <-- e.g. "ProposedWalls"
            const modelType   = storeyMatch[3];                          // <-- MeshModel or LineworkModel

            const storeyCategory = `Storey__${storeyName}__${elementType}`;  // <-- Preserves Storey__ prefix for detection

            return {
                url            : url,                                    // <-- Original full URL
                category       : storeyCategory,                         // <-- e.g. "Storey__GroundFloor__ProposedWalls"
                modelType      : modelType,                              // <-- MeshModel or LineworkModel
                rawNamespace   : 'Storey'                                // <-- Flag as storey for logging
            };
        }

        return null;                                                     // <-- No match at all
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Classify All Model URLs Into Category Map
    // ------------------------------------------------------------
    function Na__ModelLoader__ClassifyUrls(modelUrls) {
        const categoryMap = {};                                          // <-- { category: { meshUrl, lineworkUrl } }

        for (const url of modelUrls) {
            const parsed = Na__ModelLoader__ParseModelUrl(url);          // <-- Parse each URL
            if (!parsed) {
                console.warn('[TrueVision3D] Unrecognized model URL, skipping:', url);
                continue;                                                // <-- Skip unrecognized URLs
            }

            if (!categoryMap[parsed.category]) {
                categoryMap[parsed.category] = {
                    meshUrl     : null,                                  // <-- MeshModel URL slot
                    lineworkUrl : null                                   // <-- LineworkModel URL slot
                };
            }

            if (parsed.modelType === 'MeshModel') {
                categoryMap[parsed.category].meshUrl = parsed.url;       // <-- Assign mesh URL
            } else if (parsed.modelType === 'LineworkModel') {
                categoryMap[parsed.category].lineworkUrl = parsed.url;   // <-- Assign linework URL
            }
        }

        return categoryMap;                                              // <-- Return classified map
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Orbit Helper Cube Functions
// -----------------------------------------------------------------------------

    // FUNCTION | Separate OrbitHelperCube URL from Model URLs
    // ------------------------------------------------------------
    // Filters out the OrbitHelperCube URL from the model URLs array.
    // Returns both the orbit cube URL (if found) and the filtered URLs array.
    // ------------------------------------------------------------
    function Na__ModelLoader__SeparateOrbitCubeUrl(modelUrls) {
        if (!Array.isArray(modelUrls) || modelUrls.length === 0) {
            return { orbitCubeUrl: null, filteredUrls: [] };  // <-- Return empty result for invalid input
        }

        const filteredUrls = [];                              // <-- Filtered URLs without orbit cube
        let orbitCubeUrl = null;                              // <-- Extracted orbit cube URL

        for (const url of modelUrls) {
            if (typeof url !== 'string') continue;            // <-- Skip invalid URLs

            const filename = url.split('/').pop();            // <-- Extract filename from URL
            if (Na__ModelUrl__OrbitCubeRegex.test(filename)) {
                orbitCubeUrl = url;                           // <-- Found orbit cube URL
                console.log('[TrueVision3D] Found OrbitHelperCube:', url);
            } else {
                filteredUrls.push(url);                       // <-- Keep non-cube URLs
            }
        }

        return { orbitCubeUrl, filteredUrls };                // <-- Return separated URLs
    }
    // ------------------------------------------------------------


    // FUNCTION | Load OrbitHelperCube GLB and Extract Center Position
    // ------------------------------------------------------------
    // Loads the OrbitHelperCube GLB file and calculates its bounding box center.
    // Returns the loaded mesh root and the center position as a THREE.Vector3.
    // The center position is in 3D units (not millimeters).
    // ------------------------------------------------------------
    async function Na__ModelLoader__LoadOrbitHelperCube(orbitCubeUrl, loader) {
        if (!orbitCubeUrl || typeof orbitCubeUrl !== 'string') {
            return null;                                      // <-- Guard against invalid input
        }

        try {
            const gltf = await loader.loadAsync(orbitCubeUrl);  // <-- Load GLB file
            const meshRoot = gltf.scene;                      // <-- Extract scene graph

            // CALCULATE BOUNDING BOX CENTER
            const box = new THREE.Box3();                     // <-- Create bounding box
            box.setFromObject(meshRoot);                      // <-- Compute bounding box from scene

            const centerPosition = new THREE.Vector3();       // <-- Create center vector
            box.getCenter(centerPosition);                    // <-- Extract center point

            console.log('[TrueVision3D] OrbitHelperCube loaded. Center:', centerPosition);

            return {
                mesh: meshRoot,                               // <-- THREE.Group containing the cube mesh
                centerPosition: centerPosition                // <-- THREE.Vector3 center position
            };
        } catch (error) {
            console.error('[TrueVision3D] Failed to load OrbitHelperCube:', error);
            return null;                                      // <-- Return null on error
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Single Model Loading Functions
// -----------------------------------------------------------------------------

    // FUNCTION | Load Single Base Mesh GLB (Faces)
    // ------------------------------------------------------------
    async function Na__ModelLoader__LoadSingleMesh(modelUrl, baseMeshConfig, loader) {
        const gltf         = await loader.loadAsync(modelUrl);           // <-- Load GLB file
        const meshRoot     = gltf.scene;                                 // <-- Extract scene graph
        const indexedNameRegex = /^MAT\d{3}__/;                          // <-- Indexed materials that should survive to swap pass
        const mirrorDebugName  = 'MAT140__Mirror__ClearDefault';         // <-- Targeted diagnostics for black mirror investigation

        const Na__Material__WhiteMat = new THREE.MeshStandardMaterial({
            color               : baseMeshConfig.BaseMesh__DefaultMaterial__WhitecardColor,     // <-- White base color
            roughness           : baseMeshConfig.BaseMesh__DefaultMaterial__Roughness,          // <-- Surface roughness
            metalness           : baseMeshConfig.BaseMesh__DefaultMaterial__Metalness,          // <-- Metallic factor
            side                : THREE.DoubleSide,                                             // <-- Render both faces
            polygonOffset       : true,                                                         // <-- Enable polygon offset
            polygonOffsetFactor : baseMeshConfig.BaseMesh__DefaultMaterial__PolygonOffsetFactor,
            polygonOffsetUnits  : baseMeshConfig.BaseMesh__DefaultMaterial__PolygonOffsetUnits
        });

        const Na__MaterialDiagnostics = {
            totalMaterialsSeen     : 0,                                   // <-- Total material slots processed
            indexedMaterialsSeen   : 0,                                   // <-- MAT### materials that can be swapped later
            whiteFallbackApplied   : 0,                                   // <-- Invalid/missing materials repaired with white fallback
            mirrorMaterialsSeen    : 0                                    // <-- Tracks MAT140 mirror materials found in source GLB
        };

        const Na__ModelLoader__CloneAndPrepareMaterial = (sourceMaterial) => {
            if (!sourceMaterial || !sourceMaterial.isMaterial) {
                Na__MaterialDiagnostics.whiteFallbackApplied++;
                return Na__Material__WhiteMat.clone();                    // <-- Fallback only when source material is invalid/missing
            }

            Na__MaterialDiagnostics.totalMaterialsSeen++;
            if (indexedNameRegex.test(sourceMaterial.name || '')) {
                Na__MaterialDiagnostics.indexedMaterialsSeen++;
            }
            if ((sourceMaterial.name || '') === mirrorDebugName) {
                Na__MaterialDiagnostics.mirrorMaterialsSeen++;
            }

            const preparedMaterial               = sourceMaterial.clone(); // <-- Preserve original identity (name/transparency/alpha/etc)
            preparedMaterial.side                = THREE.DoubleSide;
            preparedMaterial.polygonOffset       = true;
            preparedMaterial.polygonOffsetFactor = baseMeshConfig.BaseMesh__DefaultMaterial__PolygonOffsetFactor;
            preparedMaterial.polygonOffsetUnits  = baseMeshConfig.BaseMesh__DefaultMaterial__PolygonOffsetUnits;

            const isIndexedMaterial = indexedNameRegex.test(preparedMaterial.name || '');
            if (preparedMaterial.map || preparedMaterial.emissiveMap) {
                // Keep indexed materials intact so second-pass material swap can apply authored PBR values.
                if (isIndexedMaterial) {
                    return preparedMaterial;
                }

                // Preserve the original transparent/opacity pipeline while keeping whitecard tuning behaviour for non-indexed textured meshes.
                if ('emissive' in preparedMaterial) {
                    preparedMaterial.emissive = new THREE.Color(baseMeshConfig.BaseMesh__DefaultMaterial__TexturedMesh__EmissiveColor);
                }
                if ('emissiveIntensity' in preparedMaterial) {
                    preparedMaterial.emissiveIntensity = 0.0;
                }
                if (preparedMaterial.map && !preparedMaterial.emissiveMap) {
                    preparedMaterial.emissiveMap = preparedMaterial.map;   // <-- Use diffuse as emissive fallback
                }
                if ('roughness' in preparedMaterial) {
                    preparedMaterial.roughness = 1.0;                      // <-- Keep prior whitecard look tuning
                }
                if ('metalness' in preparedMaterial) {
                    preparedMaterial.metalness = 0.0;                      // <-- Keep prior whitecard look tuning
                }
            }

            return preparedMaterial;
        };

        meshRoot.traverse((node) => {
            if (!node.isMesh) return;                                    // <-- Skip non-mesh nodes

            node.castShadow    = true;                                   // <-- Enable shadow casting
            node.receiveShadow = true;                                   // <-- Enable shadow receiving

            if (Array.isArray(node.material)) {
                node.material = node.material.map((material) => Na__ModelLoader__CloneAndPrepareMaterial(material));
            } else {
                node.material = Na__ModelLoader__CloneAndPrepareMaterial(node.material);
            }
        });

        const modelNameForLog = (typeof modelUrl === 'string') ? modelUrl.split('/').pop() : 'UnknownModel.glb';
        console.log(
            `[TrueVision3D] Mesh material prep ${modelNameForLog}: ` +
            `materials=${Na__MaterialDiagnostics.totalMaterialsSeen}, ` +
            `indexed=${Na__MaterialDiagnostics.indexedMaterialsSeen}, ` +
            `whiteFallback=${Na__MaterialDiagnostics.whiteFallbackApplied}, ` +
            `mirrorSeen=${Na__MaterialDiagnostics.mirrorMaterialsSeen}`
        );

        return meshRoot;                                                 // <-- Return processed mesh root
    }
    // ------------------------------------------------------------


    // FUNCTION | Load Single Linework GLB (Fat Lines)
    // ------------------------------------------------------------
    async function Na__ModelLoader__LoadSingleLinework(modelUrl, lineworkConfig, loader, lineResolution) {
        const gltf         = await loader.loadAsync(modelUrl);           // <-- Load GLB file
        const lineworkRoot = gltf.scene;                                 // <-- Extract scene graph
        const nodesToReplace = [];                                       // <-- Collect line nodes for replacement

        lineworkRoot.traverse((node) => {
            if (node.isLineSegments || node.isLine) {
                nodesToReplace.push(node);                               // <-- Queue for fat-line replacement
            }
        });

        nodesToReplace.forEach((node) => {
            const positions      = node.geometry.attributes.position.array;   // <-- Get vertex positions
            const importedColors = node.geometry.attributes.color
                ? node.geometry.attributes.color.array
                : null;                                                       // <-- Extract glTF COLOR_0 when present

            const fatLineGeometry = new LineSegmentsGeometry();
            fatLineGeometry.setPositions(positions);                     // <-- Set line segment positions
            if (importedColors) {
                fatLineGeometry.setColors(importedColors);               // <-- Carry glTF COLOR_0 into fat-line geometry
            }
            fatLineGeometry.computeBoundingBox();
            fatLineGeometry.computeBoundingSphere();

            const fatLineMaterial = new LineMaterial({
                color               : lineworkConfig.RenderConfig__Linework__EdgeColor,          // <-- Line color from config
                linewidth           : lineworkConfig.RenderConfig__Linework__LineWidth,          // <-- Line width from config
                resolution          : lineResolution,                                            // <-- Screen resolution for line width
                worldUnits          : false,                                                     // <-- Screen-space line width
                vertexColors        : !!importedColors,                                          // <-- Enable per-vertex colours when exported linework provides them
                depthTest           : true,                                                      // <-- Enable depth testing
                depthWrite          : true,                                                      // <-- Enable depth writing
                polygonOffset       : true,                                                      // <-- Enable polygon offset
                polygonOffsetFactor : lineworkConfig.RenderConfig__Linework__PolygonOffsetFactor,
                polygonOffsetUnits  : lineworkConfig.RenderConfig__Linework__PolygonOffsetUnits
            });

            // DEPTH BIAS | Pull line fragments forward when logarithmic depth buffer is used
            // ------------------------------------------------------------
            const depthBias = (lineworkConfig.RenderConfig__Linework__DepthBias != null) 
                ? lineworkConfig.RenderConfig__Linework__DepthBias 
                : 0.00015;
            fatLineMaterial.onBeforeCompile = (shader) => {
                shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <logdepthbuf_fragment>',
                    `#include <logdepthbuf_fragment>
                    if (gl_FragDepth > 0.0) {
                        gl_FragDepth -= ${depthBias};
                    }`
                );
            };
            // ------------------------------------------------------------

            const fatLineSegment = new LineSegments2(fatLineGeometry, fatLineMaterial);
            fatLineSegment.computeLineDistances();                                       // <-- Compute for proper rendering
            fatLineSegment.frustumCulled = true;                                         // <-- Allow off-screen linework to be culled
            fatLineSegment.renderOrder   = lineworkConfig.RenderConfig__Linework__RenderOrder;   // <-- Render order from config

            fatLineSegment.position.copy(node.position);                 // <-- Copy transform from original
            fatLineSegment.rotation.copy(node.rotation);
            fatLineSegment.scale.copy(node.scale);
            fatLineSegment.matrix.copy(node.matrix);
            fatLineSegment.matrixAutoUpdate = node.matrixAutoUpdate;

            if (node.parent) {
                node.parent.add(fatLineSegment);                         // <-- Replace in parent
                node.parent.remove(node);
            } else {
                lineworkRoot.add(fatLineSegment);                        // <-- Add to root fallback
            }

            node.geometry.dispose();                                     // <-- Clean up original geometry
        });

        lineworkRoot.renderOrder = 100;                                  // <-- Linework always renders on top
        return lineworkRoot;                                             // <-- Return processed linework root
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Multi-Model Orchestration
// -----------------------------------------------------------------------------

    // FUNCTION | Load All Models in Priority Order
    // ------------------------------------------------------------
    // Main entry point. Accepts an array of CDN URLs, classifies them by
    // category and type, then loads each category pair (Mesh + Linework)
    // sequentially in the priority order defined by Na__ModelCategories__LoadOrder.
    // Returns a Map of category -> THREE.Group for future toggling support.
    // ------------------------------------------------------------
    async function Na__ModelLoader__LoadAllModels(modelUrls, modelGroupRoot, config, lineResolution, statusCallback) {
        const loader      = new GLTFLoader();                            // <-- Create shared GLB loader
        const categoryMap = Na__ModelLoader__ClassifyUrls(modelUrls);    // <-- Classify URLs by category
        const loadedGroups = new Map();                                  // <-- Map of category -> THREE.Group

        // LOG DISCOVERY SUMMARY
        const discoveredCategories = Object.keys(categoryMap);           // <-- List discovered categories
        console.log(`[TrueVision3D] Discovered ${discoveredCategories.length} model categories:`);
        discoveredCategories.forEach((cat) => {
            const entry = categoryMap[cat];
            console.log(`  - ${cat}: Mesh=${entry.meshUrl ? 'YES' : 'NO'}, Linework=${entry.lineworkUrl ? 'YES' : 'NO'}`);
        });

        // LOAD IN PRIORITY ORDER
        for (const category of Na__ModelCategories__LoadOrder) {
            const entry = categoryMap[category];                         // <-- Look up category in classified map
            if (!entry) continue;                                        // <-- Skip categories not in this project

            const categoryGroup       = new THREE.Group();               // <-- Create group for this category
            categoryGroup.name        = category;                        // <-- Name group for debugging
            const shortName           = category.replace('TrueVision__', '');  // <-- Short name for status display

            // LOAD MESH MODEL FOR THIS CATEGORY
            if (entry.meshUrl) {
                if (statusCallback) statusCallback(`Loading ${shortName} Mesh...`);
                try {
                    const meshRoot = await Na__ModelLoader__LoadSingleMesh(
                        entry.meshUrl,
                        config.BaseMesh__DefaultMaterial,                // <-- Base mesh default material config
                        loader
                    );
                    meshRoot.userData.Na__ModelType = 'mesh';            // <-- Tag for downstream identification
                    categoryGroup.add(meshRoot);                         // <-- Add mesh to category group
                    console.log(`[TrueVision3D] Loaded Mesh: ${shortName}`);
                } catch (error) {
                    console.error(`[TrueVision3D] Failed to load Mesh for ${shortName}:`, error);
                }
            }

            // LOAD LINEWORK MODEL FOR THIS CATEGORY
            if (entry.lineworkUrl) {
                if (statusCallback) statusCallback(`Loading ${shortName} Linework...`);
                try {
                    const lineworkRoot = await Na__ModelLoader__LoadSingleLinework(
                        entry.lineworkUrl,
                        config.RenderConfig__Linework,                   // <-- Linework rendering config
                        loader,
                        lineResolution
                    );
                    lineworkRoot.userData.Na__ModelType = 'linework';    // <-- Tag for downstream identification
                    categoryGroup.add(lineworkRoot);                     // <-- Add linework to category group
                    console.log(`[TrueVision3D] Loaded Linework: ${shortName}`);
                } catch (error) {
                    console.error(`[TrueVision3D] Failed to load Linework for ${shortName}:`, error);
                }
            }

            modelGroupRoot.add(categoryGroup);                           // <-- Add category group to scene root
            loadedGroups.set(category, categoryGroup);                   // <-- Store reference for toggling
        }

        // HANDLE UNCATEGORIZED URLS (not in load order but still valid)
        for (const [category, entry] of Object.entries(categoryMap)) {
            if (loadedGroups.has(category)) continue;                    // <-- Already loaded in priority pass

            const categoryGroup       = new THREE.Group();
            categoryGroup.name        = category;
            const shortName           = category.replace('TrueVision__', '');

            if (entry.meshUrl) {
                if (statusCallback) statusCallback(`Loading ${shortName} Mesh...`);
                try {
                    const meshRoot = await Na__ModelLoader__LoadSingleMesh(entry.meshUrl, config.BaseMesh__DefaultMaterial, loader);
                    meshRoot.userData.Na__ModelType = 'mesh';
                    categoryGroup.add(meshRoot);
                    console.log(`[TrueVision3D] Loaded Mesh (unordered): ${shortName}`);
                } catch (error) {
                    console.error(`[TrueVision3D] Failed to load Mesh for ${shortName}:`, error);
                }
            }

            if (entry.lineworkUrl) {
                if (statusCallback) statusCallback(`Loading ${shortName} Linework...`);
                try {
                    const lineworkRoot = await Na__ModelLoader__LoadSingleLinework(entry.lineworkUrl, config.RenderConfig__Linework, loader, lineResolution);
                    lineworkRoot.userData.Na__ModelType = 'linework';
                    categoryGroup.add(lineworkRoot);
                    console.log(`[TrueVision3D] Loaded Linework (unordered): ${shortName}`);
                } catch (error) {
                    console.error(`[TrueVision3D] Failed to load Linework for ${shortName}:`, error);
                }
            }

            modelGroupRoot.add(categoryGroup);
            loadedGroups.set(category, categoryGroup);
        }

        console.log(`[TrueVision3D] Multi-model loading complete. ${loadedGroups.size} categories loaded.`);
        return loadedGroups;                                             // <-- Return loaded groups map
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Multi-Model Loader API
    // ------------------------------------------------------------
    export {
        Na__ModelLoader__LoadAllModels,
        Na__ModelLoader__ClassifyUrls,
        Na__ModelLoader__ParseModelUrl,
        Na__ModelLoader__SeparateOrbitCubeUrl,
        Na__ModelLoader__LoadOrbitHelperCube,
        Na__ModelCategories__LoadOrder
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

