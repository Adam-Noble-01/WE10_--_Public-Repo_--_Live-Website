// =============================================================================
// TRUEVISION3D - MULTI-MODEL LOADER
// =============================================================================
//
// FILE      : Na__ModelLoader__MultiModel.js
// NAMESPACE : Na__ModelLoader
// MODULE    : MultiModel
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Load multiple categorized GLB model pairs (Mesh + Linework)
// CREATED   : 10-Feb-2026
//
// DESCRIPTION:
// - Loads multiple GLB model pairs from an array of CDN URLs.
// - Classifies each URL by parsing the TrueVision category and model type.
// - Accepts strict __TrueVision__ namespace model filenames.
// - Loads models sequentially in priority order defined by the GLB Builder tag ranges.
// - Each category gets its own THREE.Group for future per-category toggling.
// - Material config and linework config are read from AppConfig (passed in).
// - Linework vertex colour extraction, vote logic, and mesh propagation are
//   delegated to Na__ModelLoader__LineworkColours__.js.
//
// -----
//
// DEVELOPMENT LOG:
// 06-Jun-2026 - Version 1.2.0
// - Extracted linework colour infrastructure into Na__ModelLoader__LineworkColours__.js.
// - Extracted Na__ModelLoader__UpgradeLineworkRoot from inline LoadSingleLinework.
// - Fixed critical LineMaterial.color multiplier bug: white multiplier used when
//   vertex colours are present so SketchUp MTE edge colours display correctly.
// - Added name/visible/userData preservation during linework node upgrade.
// - Added Na__ProfileLineColorDominant and Na__ProfileLineColorByName metadata
//   on linework root for profile-line colour inheritance.
// - Wired Na__ModelLoader__ApplyProfileLineColoursToMeshRoot in LoadAllModels
//   so mesh nodes receive Na__ProfileLineColor userData for depth cue effects.
//
// 10-Feb-2026 - Version 1.0.0
// - Initial stable release.
//
// =============================================================================


// #Region ---
// REGION | Module Imports
// -----

    import * as THREE from 'three';
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
    import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
    import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
    import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';

    // @delegate: ./Na__ModelLoader__LineworkColours__.js
    import {
        Na__ModelLoader__ExtractLineColors,
        Na__ModelLoader__DarkenExtractedColors,
        Na__ModelLoader__RegisterColorVote,
        Na__ModelLoader__ResolveDominantColor,
        Na__ModelLoader__ResolveDominantImportedLineColor,
        Na__ModelLoader__ApplyProfileLineColoursToMeshRoot
    } from './Na__ModelLoader__LineworkColours__.js';

    // @delegate: ./Na__ModelLoader__InstanceConsolidation__.js
    import {
        Na__ModelLoader__ConsolidateInstances
    } from './Na__ModelLoader__InstanceConsolidation__.js';

// endregion ----


// #Region ---
// REGION | Module Constants and Category Registry
// -----

    // MODULE CONSTANTS | Model Category Loading Priority Order
    // ------------------------------------------------------------
    // Matches GLB Builder tag range definitions, rebranded to TrueVision namespace.
    // Building models load first, then environment, furniture, vegetation, context.
    // ------------------------------------------------------------
    const Na__ModelCategories__LoadOrder = [
        "TrueVision__MainBuildingModel__Existing",          // <-- Tag 10: Existing building massing
        "TrueVision__MainBuildingModel__ExistingWalls",     // <-- Tag 11
        "TrueVision__MainBuildingModel__ExistingFloors",    // <-- Tag 12
        "TrueVision__MainBuildingModel__ExistingRoofs",     // <-- Tag 13
        "TrueVision__MainBuildingModel__ExistingWindows",   // <-- Tag 14
        "TrueVision__MainBuildingModel__ExistingDoors",     // <-- Tag 15
        "TrueVision__MainBuildingModel__ExistingStairs",    // <-- Tag 16
        "TrueVision__MainBuildingModel__ExistingFixtures",  // <-- Tag 17
        "TrueVision__MainBuildingModel__ExistingFurniture", // <-- Tag 18
        "TrueVision__MainBuildingModel__ExistingInteriorDecor", // <-- Tag 19
        "TrueVision__MainBuildingModel__Proposed",          // <-- Tag 20
        "TrueVision__MainBuildingModel__ProposedWalls",     // <-- Tag 21
        "TrueVision__MainBuildingModel__ProposedFloors",    // <-- Tag 22
        "TrueVision__MainBuildingModel__ProposedRoofs",     // <-- Tag 23
        "TrueVision__MainBuildingModel__ProposedWindows",   // <-- Tag 24
        "TrueVision__MainBuildingModel__ProposedDoors",     // <-- Tag 25 (interactive ADR assemblies)
        "TrueVision__MainBuildingModel__ProposedStairs",    // <-- Tag 26
        "TrueVision__MainBuildingModel__ProposedFixtures",  // <-- Tag 27
        "TrueVision__MainBuildingModel__ProposedFurniture", // <-- Tag 28
        "TrueVision__MainBuildingModel__ProposedInteriorDecor", // <-- Tag 29
        "TrueVision__SiteBoundaries",                       // <-- Tag 08: Site boundaries
        "TrueVision__LandscapeEnvironment",                 // <-- Tag 07: Landscape & environment
        "TrueVision__SiteVegetation2D",                     // <-- Tag 09: 2D camera-follow billboard vegetation
        "TrueVision__GroundFloorFurniture",                 // <-- Tag 30-38: Ground floor furniture
        "TrueVision__GroundFloorDecor",                     // <-- Tag 39: Ground floor high detail
        "TrueVision__FirstFloorFurniture",                  // <-- Tag 40-48: First floor furniture
        "TrueVision__FirstFloorDecor",                      // <-- Tag 49: First floor high detail
        "TrueVision__Vegetation",                           // <-- Tag 50-59: Vegetation
        "TrueVision__SceneContextual"                       // <-- Tag 60-70: Scene context
    ];
    // ------------------------------------------------------------


    // MODULE CONSTANTS | URL Parsing Regex
    // ------------------------------------------------------------
    const Na__ModelUrl__ParseRegex        = /(?:.*?__)?(TrueVision)__(.+?)__(MeshModel|LineworkModel)__\.glb/i;
    const Na__ModelUrl__StoreyParseRegex  = /(?:.*?__)?Storey__([A-Za-z]+)__([A-Za-z]+)__(MeshModel|LineworkModel)__\.glb/i;
    const Na__ModelUrl__OrbitCubeRegex    = /OrbitHelperCube__MeshModel__\.glb$/i;    // <-- Orbit helper cube detection
    const Na__ModelLoader__OrbitHelperNameToken = 'OrbitHelperCube';                   // <-- Authoritative orbit target token
    // ------------------------------------------------------------

// endregion ----


// #Region ---
// REGION | URL Classification Functions
// -----

    // HELPER FUNCTION | Build Loaded Root Group Name
    // ------------------------------------------------------------
    function Na__ModelLoader__BuildLoadedRootName(category, modelTypeLabel) {
        return `${category}__${modelTypeLabel}Root`;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Parse Single Model URL Into Category and Type
    // ------------------------------------------------------------
    function Na__ModelLoader__ParseModelUrl(url) {
        if (!url || typeof url !== 'string') return null;           // <-- Guard against invalid input

        const filename = url.split('/').pop();                      // <-- Extract filename from URL

        const match = Na__ModelUrl__ParseRegex.exec(filename);
        if (match) {
            const namespace         = match[1];
            const category          = match[2];
            const modelType         = match[3];
            const normalizedCategory = `TrueVision__${category}`;

            return {
                url           : url,
                category      : normalizedCategory,
                modelType     : modelType,
                rawNamespace  : namespace
            };
        }

        const storeyMatch = Na__ModelUrl__StoreyParseRegex.exec(filename);
        if (storeyMatch) {
            const storeyName     = storeyMatch[1];
            const elementType    = storeyMatch[2];
            const modelType      = storeyMatch[3];
            const storeyCategory = `Storey__${storeyName}__${elementType}`;

            return {
                url          : url,
                category     : storeyCategory,
                modelType    : modelType,
                rawNamespace : 'Storey'
            };
        }

        return null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Classify All Model URLs Into Category Map
    // ------------------------------------------------------------
    function Na__ModelLoader__ClassifyUrls(modelUrls) {
        const categoryMap = {};

        for (const url of modelUrls) {
            const parsed = Na__ModelLoader__ParseModelUrl(url);
            if (!parsed) {
                console.warn('[TrueVision3D] Unrecognized model URL, skipping:', url);
                continue;
            }

            if (!categoryMap[parsed.category]) {
                categoryMap[parsed.category] = {
                    meshUrl     : null,
                    lineworkUrl : null
                };
            }

            if (parsed.modelType === 'MeshModel') {
                categoryMap[parsed.category].meshUrl = parsed.url;
            } else if (parsed.modelType === 'LineworkModel') {
                categoryMap[parsed.category].lineworkUrl = parsed.url;
            }
        }

        return categoryMap;
    }
    // ------------------------------------------------------------

// endregion ----


// #Region ---
// REGION | Orbit Helper Cube Functions
// -----

    // FUNCTION | Separate OrbitHelperCube URL from Model URLs
    // ------------------------------------------------------------
    function Na__ModelLoader__SeparateOrbitCubeUrl(modelUrls) {
        if (!Array.isArray(modelUrls) || modelUrls.length === 0) {
            return { orbitCubeUrl: null, filteredUrls: [] };
        }

        const filteredUrls = [];
        let orbitCubeUrl   = null;

        for (const url of modelUrls) {
            if (typeof url !== 'string') continue;

            const filename = url.split('/').pop();
            if (Na__ModelUrl__OrbitCubeRegex.test(filename)) {
                orbitCubeUrl = url;
                console.log('[TrueVision3D] Found OrbitHelperCube:', url);
            } else {
                filteredUrls.push(url);
            }
        }

        return { orbitCubeUrl, filteredUrls };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Check Whether a Node Belongs to Orbit Helper Geometry
    // ------------------------------------------------------------
    function Na__ModelLoader__IsOrbitHelperNode(node) {
        let current = node;

        while (current) {
            const name = current.name || '';
            if (name.includes(Na__ModelLoader__OrbitHelperNameToken)) return true;
            current = current.parent;
        }

        return false;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build a Clean Orbit Helper Root
    // ------------------------------------------------------------
    function Na__ModelLoader__BuildOrbitHelperRoot(sourceRoot) {
        const orbitRoot = new THREE.Group();
        orbitRoot.name  = 'OrbitHelperCube__FilteredRoot';

        let includedMeshCount = 0;
        let ignoredMeshCount  = 0;

        sourceRoot.updateWorldMatrix(true, true);
        sourceRoot.traverse((node) => {
            if (!node.isMesh) return;

            if (!Na__ModelLoader__IsOrbitHelperNode(node)) {
                ignoredMeshCount++;
                return;
            }

            node.updateWorldMatrix(true, false);
            const orbitMesh              = node.clone(false);
            orbitMesh.name               = node.name || 'OrbitHelperCube__Mesh';
            orbitMesh.matrix.copy(node.matrixWorld);
            orbitMesh.matrixAutoUpdate   = false;
            orbitRoot.add(orbitMesh);
            includedMeshCount++;
        });

        return {
            root              : includedMeshCount > 0 ? orbitRoot : sourceRoot,
            includedMeshCount : includedMeshCount,
            ignoredMeshCount  : ignoredMeshCount
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Load OrbitHelperCube GLB and Extract Center Position
    // ------------------------------------------------------------
    async function Na__ModelLoader__LoadOrbitHelperCube(orbitCubeUrl, loader) {
        if (!orbitCubeUrl || typeof orbitCubeUrl !== 'string') {
            return null;
        }

        try {
            const gltf       = await loader.loadAsync(orbitCubeUrl);
            const orbitHelper = Na__ModelLoader__BuildOrbitHelperRoot(gltf.scene);
            const meshRoot   = orbitHelper.root;

            if (orbitHelper.ignoredMeshCount > 0) {
                console.warn(
                    `[TrueVision3D] OrbitHelperCube GLB contained ${orbitHelper.ignoredMeshCount} non-helper mesh(es). ` +
                    `Using ${orbitHelper.includedMeshCount} OrbitHelperCube mesh(es) for the orbit target.`
                );
            }

            const box            = new THREE.Box3();
            box.setFromObject(meshRoot);
            const centerPosition = new THREE.Vector3();
            box.getCenter(centerPosition);

            console.log('[TrueVision3D] OrbitHelperCube loaded. Center:', centerPosition);

            return {
                mesh           : meshRoot,
                centerPosition : centerPosition
            };
        } catch (error) {
            console.error('[TrueVision3D] Failed to load OrbitHelperCube:', error);
            return null;
        }
    }
    // ------------------------------------------------------------

// endregion ----


// #Region ---
// REGION | Single Model Loading Functions
// -----

    // FUNCTION | Load Single Base Mesh GLB (Faces)
    // ------------------------------------------------------------
    async function Na__ModelLoader__LoadSingleMesh(modelUrl, baseMeshConfig, loader) {
        const gltf     = await loader.loadAsync(modelUrl);         // <-- Load GLB file
        const meshRoot = gltf.scene;                               // <-- Extract scene graph

        const indexedNameRegex  = /^MAT\d{3}__/;                  // <-- Indexed materials that survive to swap pass
        const mirrorDebugName   = 'MAT140__Mirror__ClearDefault';

        const Na__Material__WhiteMat = new THREE.MeshStandardMaterial({
            color              : baseMeshConfig.BaseMesh__DefaultMaterial__WhitecardColor,
            roughness          : baseMeshConfig.BaseMesh__DefaultMaterial__Roughness,
            metalness          : baseMeshConfig.BaseMesh__DefaultMaterial__Metalness,
            side               : THREE.DoubleSide,
            polygonOffset      : true,
            polygonOffsetFactor: baseMeshConfig.BaseMesh__DefaultMaterial__PolygonOffsetFactor,
            polygonOffsetUnits : baseMeshConfig.BaseMesh__DefaultMaterial__PolygonOffsetUnits
        });

        const Na__MaterialDiagnostics = {
            totalMaterialsSeen   : 0,
            indexedMaterialsSeen : 0,
            whiteFallbackApplied : 0,
            mirrorMaterialsSeen  : 0
        };

        const Na__ModelLoader__CloneAndPrepareMaterial = (sourceMaterial) => {
            if (!sourceMaterial || !sourceMaterial.isMaterial) {
                Na__MaterialDiagnostics.whiteFallbackApplied++;
                return Na__Material__WhiteMat.clone();
            }

            Na__MaterialDiagnostics.totalMaterialsSeen++;
            if (indexedNameRegex.test(sourceMaterial.name || '')) {
                Na__MaterialDiagnostics.indexedMaterialsSeen++;
            }
            if ((sourceMaterial.name || '') === mirrorDebugName) {
                Na__MaterialDiagnostics.mirrorMaterialsSeen++;
            }

            const preparedMaterial            = sourceMaterial.clone();
            preparedMaterial.side             = THREE.DoubleSide;
            preparedMaterial.polygonOffset    = true;
            preparedMaterial.polygonOffsetFactor = baseMeshConfig.BaseMesh__DefaultMaterial__PolygonOffsetFactor;
            preparedMaterial.polygonOffsetUnits  = baseMeshConfig.BaseMesh__DefaultMaterial__PolygonOffsetUnits;

            const isIndexedMaterial = indexedNameRegex.test(preparedMaterial.name || '');
            if (preparedMaterial.map || preparedMaterial.emissiveMap) {
                if (isIndexedMaterial) {
                    return preparedMaterial;
                }

                if ('emissive' in preparedMaterial) {
                    preparedMaterial.emissive = new THREE.Color(baseMeshConfig.BaseMesh__DefaultMaterial__TexturedMesh__EmissiveColor);
                }
                if ('emissiveIntensity' in preparedMaterial) {
                    preparedMaterial.emissiveIntensity = 0.0;
                }
                if (preparedMaterial.map && !preparedMaterial.emissiveMap) {
                    preparedMaterial.emissiveMap = preparedMaterial.map;
                }
                if ('roughness' in preparedMaterial) {
                    preparedMaterial.roughness = 1.0;
                }
                if ('metalness' in preparedMaterial) {
                    preparedMaterial.metalness = 0.0;
                }
            }

            return preparedMaterial;
        };

        meshRoot.traverse((node) => {
            if (!node.isMesh) return;

            node.castShadow    = true;
            node.receiveShadow = true;

            if (Array.isArray(node.material)) {
                node.material = node.material.map((mat) => Na__ModelLoader__CloneAndPrepareMaterial(mat));
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

        return meshRoot;
    }
    // ------------------------------------------------------------


    // FUNCTION | Upgrade Imported Linework Root to Fat Lines
    // ------------------------------------------------------------
    // Replaces all native Line / LineSegments nodes with LineSegments2
    // fat lines. Extracts vertex colours (COLOR_0), accumulates colour
    // votes per segment and per name, and stores dominant colour
    // metadata on each fat line segment and on the linework root.
    // Colour utilities are delegated to Na__ModelLoader__LineworkColours__.js.
    // ------------------------------------------------------------
    function Na__ModelLoader__UpgradeLineworkRoot(lineworkRoot, lineworkConfig, lineResolution) {
        if (!lineworkRoot) return lineworkRoot;

        const nodesToReplace   = [];
        const rootColorVotes   = new Map();                        // <-- Votes across all line segments for root dominant
        const colorVotesByName = new Map();                        // <-- Per-name vote maps for name-keyed colour lookup

        lineworkRoot.traverse((node) => {
            if (node.isLineSegments || node.isLine) {
                nodesToReplace.push(node);
            }
        });

        const lightnessReduction = lineworkConfig.RenderConfig__Linework__EdgeColorLightnessReduction; // <-- Read once per upgrade; applied per segment below

        nodesToReplace.forEach((node) => {
            const positions      = node.geometry.attributes.position.array;
            const rawColors      = Na__ModelLoader__ExtractLineColors(node.geometry);                      // <-- Safe fromBufferAttribute read
            const importedColors = Na__ModelLoader__DarkenExtractedColors(rawColors, lightnessReduction); // <-- Apply TrueVision lightness calibration
            const dominantColor  = Na__ModelLoader__ResolveDominantImportedLineColor(importedColors);

            const fatLineGeometry = new LineSegmentsGeometry();
            fatLineGeometry.setPositions(positions);
            if (importedColors) {
                fatLineGeometry.setColors(importedColors);         // <-- Carry glTF COLOR_0 into fat-line geometry
            }
            fatLineGeometry.computeBoundingBox();
            fatLineGeometry.computeBoundingSphere();

            const fatLineMaterial = new LineMaterial({
                color             : importedColors                 // <-- White multiplier preserves vertex colours;
                    ? 0xffffff                                     //     config colour used only as fallback
                    : lineworkConfig.RenderConfig__Linework__EdgeColor,
                linewidth         : lineworkConfig.RenderConfig__Linework__LineWidth,
                resolution        : lineResolution,
                worldUnits        : false,
                vertexColors      : !!importedColors,              // <-- Enable per-vertex colours when present
                depthTest         : true,
                depthWrite        : true,
                polygonOffset     : true,
                polygonOffsetFactor: lineworkConfig.RenderConfig__Linework__PolygonOffsetFactor,
                polygonOffsetUnits : lineworkConfig.RenderConfig__Linework__PolygonOffsetUnits
            });

            // DEPTH BIAS | Pull line fragments forward in logarithmic depth buffer
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

            const fatLineSegment              = new LineSegments2(fatLineGeometry, fatLineMaterial);
            fatLineSegment.computeLineDistances();
            fatLineSegment.frustumCulled      = true;
            fatLineSegment.renderOrder        = lineworkConfig.RenderConfig__Linework__RenderOrder;
            fatLineSegment.name               = node.name;         // <-- Preserve for hierarchy/debug
            fatLineSegment.visible            = node.visible;      // <-- Preserve visibility state
            fatLineSegment.userData           = { ...node.userData }; // <-- Preserve glTF extras

            if (dominantColor) {
                fatLineSegment.userData.Na__ProfileLineColor = [...dominantColor]; // <-- Per-segment dominant colour
                Na__ModelLoader__RegisterColorVote(rootColorVotes, dominantColor, importedColors.length / 3);

                if (node.name) {
                    if (!colorVotesByName.has(node.name)) {
                        colorVotesByName.set(node.name, new Map());
                    }
                    Na__ModelLoader__RegisterColorVote(
                        colorVotesByName.get(node.name),
                        dominantColor,
                        importedColors.length / 3
                    );
                }
            }

            fatLineSegment.position.copy(node.position);
            fatLineSegment.rotation.copy(node.rotation);
            fatLineSegment.scale.copy(node.scale);
            fatLineSegment.matrix.copy(node.matrix);
            fatLineSegment.matrixAutoUpdate = node.matrixAutoUpdate;

            if (node.parent) {
                node.parent.add(fatLineSegment);
                node.parent.remove(node);
            } else {
                lineworkRoot.add(fatLineSegment);
            }

            node.geometry.dispose();
        });

        lineworkRoot.renderOrder = 100;                            // <-- Linework always renders on top
        lineworkRoot.userData.Na__ProfileLineColorDominant = Na__ModelLoader__ResolveDominantColor(rootColorVotes);
        lineworkRoot.userData.Na__ProfileLineColorByName   = {};
        colorVotesByName.forEach((voteMap, objectName) => {
            const dominant = Na__ModelLoader__ResolveDominantColor(voteMap);
            if (dominant) {
                lineworkRoot.userData.Na__ProfileLineColorByName[objectName] = dominant;
            }
        });

        return lineworkRoot;
    }
    // ------------------------------------------------------------


    // FUNCTION | Load Single Linework GLB (Fat Lines)
    // ------------------------------------------------------------
    async function Na__ModelLoader__LoadSingleLinework(modelUrl, lineworkConfig, loader, lineResolution) {
        const gltf         = await loader.loadAsync(modelUrl);     // <-- Load GLB file
        const lineworkRoot = gltf.scene;                           // <-- Extract scene graph
        return Na__ModelLoader__UpgradeLineworkRoot(lineworkRoot, lineworkConfig, lineResolution);
    }
    // ------------------------------------------------------------

// endregion ----


// #Region ---
// REGION | Multi-Model Orchestration
// -----

    // FUNCTION | Load All Models in Priority Order
    // ------------------------------------------------------------
    // Main entry point. Accepts an array of CDN URLs, classifies them by
    // category and type, then loads each category pair (Mesh + Linework)
    // sequentially in the priority order defined by Na__ModelCategories__LoadOrder.
    // Returns a Map of category -> THREE.Group for future toggling support.
    // ------------------------------------------------------------
    async function Na__ModelLoader__LoadAllModels(modelUrls, modelGroupRoot, config, lineResolution, statusCallback) {
        const loader        = new GLTFLoader();
        const categoryMap   = Na__ModelLoader__ClassifyUrls(modelUrls);
        const loadedGroups  = new Map();

        const discoveredCategories = Object.keys(categoryMap);
        console.log(`[TrueVision3D] Discovered ${discoveredCategories.length} model categories:`);
        discoveredCategories.forEach((cat) => {
            const entry = categoryMap[cat];
            console.log(` - ${cat}: Mesh=${entry.meshUrl ? 'YES' : 'NO'}, Linework=${entry.lineworkUrl ? 'YES' : 'NO'}`);
        });

        // LOAD IN PRIORITY ORDER
        for (const category of Na__ModelCategories__LoadOrder) {
            const entry = categoryMap[category];
            if (!entry) continue;

            const categoryGroup = new THREE.Group();
            categoryGroup.name  = category;
            const shortName     = category.replace('TrueVision__', '');

            let meshRoot     = null;
            let lineworkRoot = null;

            if (entry.meshUrl) {
                if (statusCallback) statusCallback(`Loading ${shortName} Mesh...`);
                try {
                    meshRoot = await Na__ModelLoader__LoadSingleMesh(
                        entry.meshUrl,
                        config.BaseMesh__DefaultMaterial,
                        loader
                    );
                    meshRoot.name                   = Na__ModelLoader__BuildLoadedRootName(category, 'Mesh');
                    meshRoot.userData.Na__ModelType = 'mesh';      // <-- Tag for downstream identification
                    categoryGroup.add(meshRoot);
                    Na__ModelLoader__ConsolidateInstances(meshRoot, config.RenderConfig__InstanceConsolidation); // <-- Collapse repeated meshes (e.g. leaves) into InstancedMesh
                    console.log(`[TrueVision3D] Loaded Mesh: ${shortName}`);
                } catch (error) {
                    console.error(`[TrueVision3D] Failed to load Mesh for ${shortName}:`, error);
                }
            }

            if (entry.lineworkUrl) {
                if (statusCallback) statusCallback(`Loading ${shortName} Linework...`);
                try {
                    lineworkRoot = await Na__ModelLoader__LoadSingleLinework(
                        entry.lineworkUrl,
                        config.RenderConfig__Linework,
                        loader,
                        lineResolution
                    );
                    lineworkRoot.name                   = Na__ModelLoader__BuildLoadedRootName(category, 'Linework');
                    lineworkRoot.userData.Na__ModelType = 'linework'; // <-- Tag for downstream identification
                    categoryGroup.add(lineworkRoot);
                    Na__ModelLoader__ApplyProfileLineColoursToMeshRoot(meshRoot, lineworkRoot); // <-- Propagate edge colours to mesh nodes
                    console.log(`[TrueVision3D] Loaded Linework: ${shortName}`);
                } catch (error) {
                    console.error(`[TrueVision3D] Failed to load Linework for ${shortName}:`, error);
                }
            }

            modelGroupRoot.add(categoryGroup);
            loadedGroups.set(category, categoryGroup);
        }

        // HANDLE UNCATEGORIZED URLS (not in load order but still valid)
        for (const [category, entry] of Object.entries(categoryMap)) {
            if (loadedGroups.has(category)) continue;

            const categoryGroup = new THREE.Group();
            categoryGroup.name  = category;
            const shortName     = category.replace('TrueVision__', '');

            let meshRoot     = null;
            let lineworkRoot = null;

            if (entry.meshUrl) {
                if (statusCallback) statusCallback(`Loading ${shortName} Mesh...`);
                try {
                    meshRoot = await Na__ModelLoader__LoadSingleMesh(
                        entry.meshUrl,
                        config.BaseMesh__DefaultMaterial,
                        loader
                    );
                    meshRoot.name                   = Na__ModelLoader__BuildLoadedRootName(category, 'Mesh');
                    meshRoot.userData.Na__ModelType = 'mesh';
                    categoryGroup.add(meshRoot);
                    Na__ModelLoader__ConsolidateInstances(meshRoot, config.RenderConfig__InstanceConsolidation); // <-- Collapse repeated meshes (e.g. leaves) into InstancedMesh
                    console.log(`[TrueVision3D] Loaded Mesh (unordered): ${shortName}`);
                } catch (error) {
                    console.error(`[TrueVision3D] Failed to load Mesh for ${shortName}:`, error);
                }
            }

            if (entry.lineworkUrl) {
                if (statusCallback) statusCallback(`Loading ${shortName} Linework...`);
                try {
                    lineworkRoot = await Na__ModelLoader__LoadSingleLinework(
                        entry.lineworkUrl,
                        config.RenderConfig__Linework,
                        loader,
                        lineResolution
                    );
                    lineworkRoot.name                   = Na__ModelLoader__BuildLoadedRootName(category, 'Linework');
                    lineworkRoot.userData.Na__ModelType = 'linework';
                    categoryGroup.add(lineworkRoot);
                    Na__ModelLoader__ApplyProfileLineColoursToMeshRoot(meshRoot, lineworkRoot); // <-- Propagate edge colours to mesh nodes
                    console.log(`[TrueVision3D] Loaded Linework (unordered): ${shortName}`);
                } catch (error) {
                    console.error(`[TrueVision3D] Failed to load Linework for ${shortName}:`, error);
                }
            }

            modelGroupRoot.add(categoryGroup);
            loadedGroups.set(category, categoryGroup);
        }

        console.log(`[TrueVision3D] Multi-model loading complete. ${loadedGroups.size} categories loaded.`);
        return loadedGroups;
    }
    // ------------------------------------------------------------

// endregion ----


// #Region ---
// REGION | Module Exports
// -----

    // MODULE EXPORTS | Multi-Model Loader API
    // ------------------------------------------------------------
    export {
        Na__ModelLoader__LoadAllModels,
        Na__ModelLoader__UpgradeLineworkRoot,
        Na__ModelLoader__ApplyProfileLineColoursToMeshRoot,
        Na__ModelLoader__ClassifyUrls,
        Na__ModelLoader__ParseModelUrl,
        Na__ModelLoader__SeparateOrbitCubeUrl,
        Na__ModelLoader__LoadOrbitHelperCube,
        Na__ModelCategories__LoadOrder
    };
    // ------------------------------------------------------------

// endregion ----
