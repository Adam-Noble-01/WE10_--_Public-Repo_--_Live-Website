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
// 15-Nov-2026 - Version 1.5.0 (v2.186.0)
// - STAGED LOAD. A phase's files are fetched in tiers - the building (walls,
//   roofs, landscape, doors, floors, windows, stairs), then fixtures, then
//   furniture, then interior decor - and several at once within a tier, where
//   they were fetched one after another in project order (which for the
//   Storey__ categories was alphabetical: a 38 MB furniture file ahead of the
//   walls). Na__ModelLoader__StartStagedLoad hands back every category group,
//   empty, at once, and fills them stage by stage; a caller may show the model
//   when the first stage is in. Na__ModelLoader__LoadAllModels is the same
//   load awaited to the end, so every caller gets the new order.
// - THE GROUPS SIT UNDER THE ROOT IN THE ORDER THEY ALWAYS DID, and the mesh
//   root goes into its category before the linework root: the model
//   fingerprint hashes both orders and every stored drawing and sheet picture
//   is keyed by it (Na__ModelLoader__LoadPlan__ has the two orders apart).
// - A category is prepared off-scene and handed to the caller's materials pass
//   before it is attached, so nothing reaches the screen in the loader's plain
//   materials. Nodes a file hides are marked (Na__LoadHidden), so a phase that
//   leaves the 3D view can be put back exactly as it loaded
//   (Na__ModelLoader__RestoreLoadedVisibility).
//
// 18-Sep-2026 - Version 1.4.0
// - Content stamp. Each GLB's scene is hashed the moment it is parsed - node
//   placements, every geometry attribute and index, material names and colours
//   (Na__ModelLoader__ContentStamp__) - and the hash rides on the mesh or
//   linework root's userData. The model fingerprint reads it, so a re-export
//   that moves something without changing a triangle count re-keys every
//   drawing cached from the model. Read before the fat line upgrade and the
//   instance consolidation, which are the loader's doing and not the model's.
//
// 18-Sep-2026 - Version 1.3.2
// - Projection only. A category matching RenderConfig__Linework__ProjectionOnly-
//   CategoryTokens loads with material.visible false on every fat line, so no 3D
//   render draws it while the objects stay visible for the projected linework to
//   read. The linetype tags are drawing data: rendered in 3D they float in mid
//   air, and under a rendered underlay they showed solid beneath their own dashes.
//
// 18-Sep-2026 - Version 1.3.1
// - The Linetype__ categories take their place at the end of the load order.
//   They carry linework and no mesh - one GLB per SketchUp linetype tag from
//   GLB Builder 2.7.3 - and need no other change: the existing filename parse
//   and the mesh-optional pair loader already handle them.
//
// 14-Sep-2026 - Version 1.3.0
// - The linework depth bias is camera-aware. Through an orthographic camera the
//   logarithmic depth buffer writes LINEAR depth (gl_FragCoord.z), so the fixed
//   0.00015 was that share of the whole camera range: 75 mm across the drawing
//   cameras' 500 m, and every SketchUp line up to 75 mm behind a face drew
//   through it in plans, elevations and their Layout Editor base images. An
//   orthographic camera now takes RenderConfig__Linework__OrthoDepthBiasMm as a
//   distance (default 2 mm); perspective renders keep the constant unchanged.
// - Bias values go into the shader as GLSL float literals: a whole-number config
//   value pasted in as-is was a compile error.
//
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
    import { Na__Math__ConvertMmToUnits } from '../04__MathUtils/Na__Math__Units.js';

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

    // @delegate: ./Na__ModelLoader__ContentStamp__.js
    import {
        Na__ModelStamp__Stamp,
        Na__ModelStamp__Carry
    } from './Na__ModelLoader__ContentStamp__.js';

    // @delegate: ./Na__ModelLoader__LoadPlan__.js
    import {
        Na__LoadPlan__ResolveSettings,
        Na__LoadPlan__Build
    } from './Na__ModelLoader__LoadPlan__.js';

// endregion ----


// #Region ---
// REGION | Module Constants and Category Registry
// -----

    // MODULE CONSTANTS | Model Category Loading Priority Order
    // ------------------------------------------------------------
    // Matches GLB Builder tag range definitions, rebranded to TrueVision namespace.
    // Building models load first, then environment, furniture, vegetation, context.
    // The Linetype__ categories are last and carry LINEWORK ONLY: the GlbBuilder writes
    // one GLB per SketchUp linetype tag (dashed, dotted, centre, door swings, clearances,
    // overhead extents, joins, demolition) with no mesh beside it, so a drawing can draw
    // each one in its own line style. A category with no GLB behind it simply never appears.
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
        "TrueVision__SceneContextual",                      // <-- Tag 60-70: Scene context
        "TrueVision__Linetype__DashedLines",                // <-- Linetype tag: 2D dashed linework, no mesh
        "TrueVision__Linetype__CentreLines",                // <-- Linetype tag: 2D centre linework, no mesh
        "TrueVision__Linetype__DottedLines",                // <-- Linetype tag: 2D dotted linework, no mesh
        "TrueVision__Linetype__DoorSwings",                 // <-- Linetype tag: 2D door swing arcs, no mesh
        "TrueVision__Linetype__ClearanceLines",             // <-- Linetype tag: clearance zones, no mesh
        "TrueVision__Linetype__OverheadObjects",            // <-- Linetype tag: overhead extents in plan, no mesh
        "TrueVision__Linetype__BuildingJoins",              // <-- Linetype tag: building / party wall joins, no mesh
        "TrueVision__Linetype__ElementsForRemoval"          // <-- Linetype tag: demolition, no mesh
    ];
    // ------------------------------------------------------------


    // MODULE CONSTANTS | URL Parsing Regex
    // ------------------------------------------------------------
    const Na__ModelUrl__ParseRegex        = /(?:.*?__)?(TrueVision)__(.+?)__(MeshModel|LineworkModel)__\.glb/i;
    const Na__ModelUrl__StoreyParseRegex  = /(?:.*?__)?Storey__([A-Za-z]+)__([A-Za-z]+)__(MeshModel|LineworkModel)__\.glb/i;
    const Na__ModelUrl__OrbitCubeRegex    = /OrbitHelperCube__MeshModel__\.glb$/i;    // <-- Orbit helper cube detection
    const Na__ModelLoader__OrbitHelperNameToken = 'OrbitHelperCube';                   // <-- Authoritative orbit target token
    const Na__ModelLoader__ProjectionOnlyTokens  = ['Linetype__'];                     // <-- Hardcoded fallback - overridden by AppConfig at runtime
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
        const collisions  = [];                                     // <-- Two files claiming one category

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

            // SAME CATEGORY, TWO FILES. The URL parser strips an optional project
            // prefix, so "RB05__Storey__X__Walls__MeshModel__.glb" and
            // "Storey__X__Walls__MeshModel__.glb" are the SAME category - a
            // project whose data lists both (a re-export under a changed naming,
            // with the old entries never removed) silently loaded whichever came
            // last and downloaded both. That was invisible: no warning, and the
            // loser could just as easily be the current file as the stale one,
            // because nothing here knows which is newer. It is still last-wins,
            // because array order is the only signal available and changing the
            // winner would change which geometry existing projects draw - but it
            // now SAYS so, with both URLs, so a stale model is a one-line console
            // read instead of a day.
            const slot     = (parsed.modelType === 'MeshModel') ? 'meshUrl'
                           : (parsed.modelType === 'LineworkModel') ? 'lineworkUrl'
                           : null;
            if (!slot) continue;

            const previous = categoryMap[parsed.category][slot];
            if (previous && previous !== parsed.url) {
                collisions.push({ category : parsed.category, slot : slot, dropped : previous, kept : parsed.url });
            }
            categoryMap[parsed.category][slot] = parsed.url;
        }

        if (collisions.length > 0) {
            console.warn('[TrueVision3D] ' + collisions.length + ' model URL collision(s): two files claim the same category, ' +
                         'so only the LAST is loaded and the project data is carrying duplicates. Clean the older set out of modelUrls.');
            collisions.forEach((c) => {
                console.warn('  ' + c.category + ' (' + c.slot + ')\n      kept    : ' + c.kept.split('/').pop() +
                                                      '\n      dropped : ' + c.dropped.split('/').pop());
            });
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
        Na__ModelStamp__Stamp(meshRoot);                           // <-- What this file holds, read before anything below alters it: the model fingerprint's content half

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


    // HELPER FUNCTION | A Number as a GLSL Float Literal
    // ------------------------------------------------------------
    // GLSL ES has no implicit int-to-float conversion, so a whole-number config
    // value pasted into a float expression as-is does not compile.
    // ------------------------------------------------------------
    function Na__ModelLoader__GlslFloat(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number.toFixed(9) : '0.000000000';
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

            // DEPTH BIAS | Pull line fragments forward so a line wins against its own face
            // ------------------------------------------------------------
            // TWO CAMERAS, TWO KINDS OF DEPTH. Through a perspective camera the
            // logarithmic depth buffer writes log depth, and DepthBias is a small
            // share of it. Through an orthographic camera three writes
            // gl_FragCoord.z instead - linear from near to far - so the same
            // constant is that share of the whole camera range: 0.00015 of the
            // drawing cameras' 500 m is 75 mm, and every line up to 75 mm behind
            // a face drew through it in plans, elevations and their base images.
            // An orthographic camera therefore takes the bias as a DISTANCE,
            // OrthoDepthBiasMm, turned into depth by its own range: for an
            // orthographic projection |projectionMatrix[2][2]| / 2 is exactly
            // 1 / (far - near) of window depth per scene unit.
            // ------------------------------------------------------------
            const depthBias      = Na__ModelLoader__GlslFloat((lineworkConfig.RenderConfig__Linework__DepthBias != null)
                ? lineworkConfig.RenderConfig__Linework__DepthBias
                : 0.00015);
            const orthoBiasUnits = Na__ModelLoader__GlslFloat(Na__Math__ConvertMmToUnits((lineworkConfig.RenderConfig__Linework__OrthoDepthBiasMm != null)
                ? lineworkConfig.RenderConfig__Linework__OrthoDepthBiasMm
                : 2));
            fatLineMaterial.onBeforeCompile = (shader) => {
                shader.vertexShader = shader.vertexShader
                    .replace('#include <logdepthbuf_pars_vertex>', `#include <logdepthbuf_pars_vertex>
                    varying float vNaOrthoDepthPerUnit;`)
                    .replace('#include <logdepthbuf_vertex>', `#include <logdepthbuf_vertex>
                    vNaOrthoDepthPerUnit = abs( projectionMatrix[ 2 ][ 2 ] ) * 0.5;`);
                shader.fragmentShader = shader.fragmentShader
                    .replace('#include <logdepthbuf_pars_fragment>', `#include <logdepthbuf_pars_fragment>
                    varying float vNaOrthoDepthPerUnit;`)
                    .replace('#include <logdepthbuf_fragment>', `#include <logdepthbuf_fragment>
                    #ifdef USE_LOGARITHMIC_DEPTH_BUFFER
                    if (gl_FragDepth > 0.0) {
                        gl_FragDepth -= (vIsPerspective == 0.0) ? (${orthoBiasUnits} * vNaOrthoDepthPerUnit) : ${depthBias};
                    }
                    #endif`);
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


    // HELPER FUNCTION | Is This Category's Linework for Drawings Only?
    // ------------------------------------------------------------
    function Na__ModelLoader__IsProjectionOnlyCategory(category, lineworkConfig) {
        const configured = lineworkConfig ? lineworkConfig.RenderConfig__Linework__ProjectionOnlyCategoryTokens : null;
        const tokens     = Array.isArray(configured) ? configured : Na__ModelLoader__ProjectionOnlyTokens;
        if (!category || tokens.length === 0) return false;

        const lower = String(category).toLowerCase();
        return tokens.some((token) => token && lower.indexOf(String(token).toLowerCase()) !== -1);
    }
    // ------------------------------------------------------------


    // FUNCTION | Take a Category's Linework Out of Every 3D Render
    // ------------------------------------------------------------
    // MATERIAL VISIBILITY, NOT OBJECT VISIBILITY, and the distinction is the
    // whole point. THREE skips an object whose material.visible is false, so no
    // 3D render draws these lines - the viewer, the image export, the Layout
    // Editor's raster underlay. The OBJECTS stay visible, because the projected
    // linework pipeline reads them by walking the scene graph and skips anything
    // whose .visible is false. Setting the root invisible would have hidden them
    // from the drawings as well, which is the opposite of what they are for.
    //
    // Each fat line carries its own LineMaterial (built per node in the upgrade
    // above), so this can never reach another category's lines.
    // ------------------------------------------------------------
    function Na__ModelLoader__HideLineworkFromRender(categoryGroup, lineworkRoot) {
        if (!lineworkRoot) return;

        if (categoryGroup) categoryGroup.userData.Na__LineworkProjectionOnly = true;
        lineworkRoot.userData.Na__LineworkProjectionOnly = true;

        lineworkRoot.traverse((node) => {
            if (!node.material) return;
            const materials = Array.isArray(node.material) ? node.material : [ node.material ];
            materials.forEach((material) => { if (material) material.visible = false; });
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Load Single Linework GLB (Fat Lines)
    // ------------------------------------------------------------
    async function Na__ModelLoader__LoadSingleLinework(modelUrl, lineworkConfig, loader, lineResolution) {
        const gltf         = await loader.loadAsync(modelUrl);     // <-- Load GLB file
        const lineworkRoot = gltf.scene;                           // <-- Extract scene graph
        const stamp        = Na__ModelStamp__Stamp(lineworkRoot);  // <-- Before the fat line upgrade replaces every line it was read from
        const upgradedRoot = Na__ModelLoader__UpgradeLineworkRoot(lineworkRoot, lineworkConfig, lineResolution);
        Na__ModelStamp__Carry(stamp, upgradedRoot);
        return upgradedRoot;
    }
    // ------------------------------------------------------------

// endregion ----


// #Region ---
// REGION | Multi-Model Orchestration
// -----

    // MODULE CONSTANTS | Staged-Load Words
    // ------------------------------------------------------------
    const Na__ModelLoader__LOAD_HIDDEN_KEY = 'Na__LoadHidden';                 // <-- userData flag: this node was hidden by its own file
    // ------------------------------------------------------------


    // HELPER FUNCTION | Free a Tree That Will Never Be Shown
    // ------------------------------------------------------------
    function Na__ModelLoader__DisposeTree(root) {
        if (!root) return;
        if (root.parent) root.parent.remove(root);
        root.traverse((node) => {
            if (node.geometry) node.geometry.dispose();
            if (!node.material) return;
            (Array.isArray(node.material) ? node.material : [ node.material ]).forEach((material) => { if (material) material.dispose(); });
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Let a Frame Through Between Two Files
    // ------------------------------------------------------------
    // The model may already be on screen while the heavier tiers arrive, and a
    // file is parsed on the main thread: without this the orbit would stall
    // from one file to the next.
    // ------------------------------------------------------------
    function Na__ModelLoader__YieldToFrame() {
        return new Promise((resolve) => { setTimeout(resolve, 0); });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Mark the Nodes a File Hides
    // ------------------------------------------------------------
    // Read as the category goes into its group, before a storey toggle, the
    // distance cull or the context menu can have hidden anything of their own.
    // ------------------------------------------------------------
    function Na__ModelLoader__MarkLoadHidden(root) {
        if (!root) return;
        root.traverse((node) => {
            if (node.visible === false) node.userData[Na__ModelLoader__LOAD_HIDDEN_KEY] = true;
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Put a Model Tree's Visibility Back to How It Loaded
    // ------------------------------------------------------------
    // For a design phase leaving the 3D view for the phase library: storeys the
    // reader switched off, furniture the distance cull hid and objects the
    // context menu isolated all come back, and only what its own files hid
    // stays hidden. Materials are not touched (a drawings-only linetype stays
    // out of every 3D render through its material).
    // ------------------------------------------------------------
    function Na__ModelLoader__RestoreLoadedVisibility(root) {
        if (!root) return;
        root.traverse((node) => {
            node.visible = !(node.userData && node.userData[Na__ModelLoader__LOAD_HIDDEN_KEY] === true);
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fetch and Prepare One Category, Off-Scene
    // ------------------------------------------------------------
    // The mesh and the linework are fetched together and finished exactly as
    // they always were. They are returned under a holder group of the
    // category's own name rather than in the category group, so the caller's
    // materials pass runs before anything can be drawn. A file that fails is
    // reported and the other half carries on.
    //
    // Returns { meshRoot, lineworkRoot, holder }.
    // ------------------------------------------------------------
    async function Na__ModelLoader__BuildCategory(category, entry, categoryGroup, config, loader, lineResolution) {
        const shortName = category.replace('TrueVision__', '');

        const meshLoad = entry.meshUrl
            ? Na__ModelLoader__LoadSingleMesh(entry.meshUrl, config.BaseMesh__DefaultMaterial, loader).catch((error) => {
                console.error(`[TrueVision3D] Failed to load Mesh for ${shortName}:`, error);
                return null;
            })
            : Promise.resolve(null);
        const lineworkLoad = entry.lineworkUrl
            ? Na__ModelLoader__LoadSingleLinework(entry.lineworkUrl, config.RenderConfig__Linework, loader, lineResolution).catch((error) => {
                console.error(`[TrueVision3D] Failed to load Linework for ${shortName}:`, error);
                return null;
            })
            : Promise.resolve(null);

        const [ meshRoot, lineworkRoot ] = await Promise.all([ meshLoad, lineworkLoad ]);

        const holder = new THREE.Group();
        holder.name  = category;

        if (meshRoot) {
            meshRoot.name                   = Na__ModelLoader__BuildLoadedRootName(category, 'Mesh');
            meshRoot.userData.Na__ModelType = 'mesh';                      // <-- Tag for downstream identification
            holder.add(meshRoot);
            Na__ModelLoader__ConsolidateInstances(meshRoot, config.RenderConfig__InstanceConsolidation); // <-- Collapse repeated meshes (e.g. leaves) into InstancedMesh
            console.log(`[TrueVision3D] Loaded Mesh: ${shortName}`);
        }

        if (lineworkRoot) {
            lineworkRoot.name                   = Na__ModelLoader__BuildLoadedRootName(category, 'Linework');
            lineworkRoot.userData.Na__ModelType = 'linework';              // <-- Tag for downstream identification
            holder.add(lineworkRoot);
            Na__ModelLoader__ApplyProfileLineColoursToMeshRoot(meshRoot, lineworkRoot); // <-- Propagate edge colours to mesh nodes
            if (Na__ModelLoader__IsProjectionOnlyCategory(category, config.RenderConfig__Linework)) {
                Na__ModelLoader__HideLineworkFromRender(categoryGroup, lineworkRoot);
                console.log(`[TrueVision3D] Loaded Linework (drawings only, not rendered in 3D): ${shortName}`);
            } else {
                console.log(`[TrueVision3D] Loaded Linework: ${shortName}`);
            }
        }

        return { meshRoot : meshRoot, lineworkRoot : lineworkRoot, holder : holder };
    }
    // ------------------------------------------------------------


    // FUNCTION | Start Loading a Phase's Models in Stages
    // ------------------------------------------------------------
    // Classifies the URLs, puts an empty group for EVERY category under
    // modelGroupRoot at once - in the order they have always sat there - and
    // fills them stage by stage: the building first, then each heavier tier
    // (Na__ModelLoader__LoadPlan__), several files in flight within a stage.
    // So the storey controls, the toggles and the phase library can be handed
    // the whole Map straight away, and a category the reader has switched off
    // arrives switched off.
    //
    // options (all optional):
    //   statusCallback(message)                     words for a loading screen
    //   onCategoryBuilt(category, holder, stage)    may be async: the materials pass,
    //                                               run while the category is off-scene
    //   onCategoryAttached(category, group, stage)  the category is in its group
    //   onStageLoaded(stage, groups)                may be async: a whole stage is in
    //
    // Returns {
    //   groups          Map(category -> THREE.Group), complete from the start
    //   stages          [ { index, name, label, keys } ]
    //   whenStage(i)    resolves when stage i is in (at once when there is no such stage)
    //   whenDone()      resolves with groups when every stage is in
    //   cancel()        no further file is started; what is in flight is disposed
    //   getProgress()   { stage, stageName, categoriesDone, categoriesTotal, stageSeconds, cancelled, done }
    // }
    // ------------------------------------------------------------
    function Na__ModelLoader__StartStagedLoad(modelUrls, modelGroupRoot, config, lineResolution, options) {
        const hooks       = options || {};
        const status      = (typeof hooks.statusCallback === 'function') ? hooks.statusCallback : null;
        const settings    = Na__LoadPlan__ResolveSettings(config);
        const loader      = new GLTFLoader();
        const categoryMap = Na__ModelLoader__ClassifyUrls(modelUrls);
        const plan        = Na__LoadPlan__Build(Object.keys(categoryMap), Na__ModelCategories__LoadOrder, settings.tiers);
        const groups      = new Map();

        // STAGED LOADING SWITCHED OFF | One stage, one category at a time, in the order they attach
        const stages = settings.enabled
            ? plan.stages
            : (plan.attachOrder.length > 0 ? [ { index : 0, name : 'Model', label : 'the model', keys : plan.attachOrder.slice() } ] : []);
        const pairsInFlight = settings.enabled ? Math.max(1, Math.ceil(settings.filesInFlight / 2)) : 1;   // <-- A category is a pair of files

        console.log(`[TrueVision3D] Discovered ${plan.attachOrder.length} model categories in ${stages.length} loading stage(s):`);
        stages.forEach((stage) => console.log(` - ${stage.name}: ${stage.keys.map((key) => key.replace('TrueVision__', '')).join(', ')}`));

        // EVERY CATEGORY GROUP, EMPTY, IN THE ORDER THEY HAVE ALWAYS SAT UNDER THE ROOT
        plan.attachOrder.forEach((category) => {
            const categoryGroup = new THREE.Group();
            categoryGroup.name  = category;
            modelGroupRoot.add(categoryGroup);
            groups.set(category, categoryGroup);
        });

        const state = {
            cancelled       : false,
            done            : false,
            stage           : -1,
            stageName       : '',
            categoriesDone  : 0,
            categoriesTotal : plan.attachOrder.length,
            stageSeconds    : [],
            startedAt       : performance.now()
        };
        const gates = stages.map(() => {
            let open = null;
            const promise = new Promise((resolve) => { open = resolve; });
            return { promise : promise, open : open };
        });

        // SUB FUNCTION | One Category: Fetched, Prepared Off-Scene, Then Into Its Group
        // ---------------------------------------------------------------
        const loadCategory = async (category, stage) => {
            if (state.cancelled) return;
            const categoryGroup = groups.get(category);
            const built = await Na__ModelLoader__BuildCategory(category, categoryMap[category], categoryGroup, config, loader, lineResolution);

            if (!state.cancelled && typeof hooks.onCategoryBuilt === 'function') {
                try {
                    await hooks.onCategoryBuilt(category, built.holder, stage);       // <-- The materials pass, before anything is on screen
                } catch (error) {
                    console.error(`[TrueVision3D] Materials pass failed for ${category}:`, error);
                }
            }
            if (state.cancelled) {
                Na__ModelLoader__DisposeTree(built.holder);
                return;
            }

            if (built.meshRoot)     categoryGroup.add(built.meshRoot);               // <-- Mesh first, then linework: the order the content stamp reads them in
            if (built.lineworkRoot) categoryGroup.add(built.lineworkRoot);
            Na__ModelLoader__MarkLoadHidden(categoryGroup);

            state.categoriesDone++;
            if (status) status(`Loading ${stage.label} (${state.categoriesDone} of ${state.categoriesTotal})...`);
            if (typeof hooks.onCategoryAttached === 'function') {
                try {
                    hooks.onCategoryAttached(category, categoryGroup, stage);
                } catch (error) {
                    console.error(`[TrueVision3D] A model-bound system failed on ${category}:`, error);
                }
            }
        };
        // ---------------------------------------------------------------

        // SUB FUNCTION | One Stage: Its Categories, a Few at a Time
        // ---------------------------------------------------------------
        const loadStage = async (stage) => {
            const stageStart = performance.now();
            state.stage     = stage.index;
            state.stageName = stage.name;
            if (status) status(`Loading ${stage.label}...`);

            const queue   = stage.keys.slice();
            const workers = Math.min(queue.length, pairsInFlight);
            const work    = async () => {
                while (queue.length > 0 && !state.cancelled) {
                    await loadCategory(queue.shift(), stage);
                    await Na__ModelLoader__YieldToFrame();
                }
            };
            await Promise.all(Array.from({ length : workers }, work));

            state.stageSeconds[stage.index] = Math.round(performance.now() - stageStart) / 1000;
            if (state.cancelled) return;
            console.log(`[TrueVision3D] Loading stage in: ${stage.name} (${stage.keys.length} categories, ${state.stageSeconds[stage.index]} s)`);
            gates[stage.index].open();
            if (typeof hooks.onStageLoaded === 'function') {
                try {
                    await hooks.onStageLoaded(stage, groups);
                } catch (error) {
                    console.error(`[TrueVision3D] A model-bound system failed after stage ${stage.name}:`, error);
                }
            }
        };
        // ---------------------------------------------------------------

        const done = (async () => {
            try {
                for (let i = 0; i < stages.length; i++) {
                    if (state.cancelled) break;
                    await loadStage(stages[i]);
                }
            } finally {
                state.done = true;
                gates.forEach((gate) => gate.open());                               // <-- Cancelled or failed: nobody waits for a stage for ever
            }
            if (!state.cancelled) {
                console.log(`[TrueVision3D] Multi-model loading complete. ${groups.size} categories loaded in ${Math.round(performance.now() - state.startedAt) / 1000} s.`);
            }
            return groups;
        })();

        return {
            groups   : groups,
            stages   : stages.map((stage) => ({ index : stage.index, name : stage.name, label : stage.label, keys : stage.keys.slice() })),
            settings : settings,
            whenStage(index) { return gates[index] ? gates[index].promise : Promise.resolve(); },
            whenDone()       { return done; },
            cancel()         { state.cancelled = true; },
            getProgress()    {
                return {
                    stage           : state.stage,
                    stageName       : state.stageName,
                    categoriesDone  : state.categoriesDone,
                    categoriesTotal : state.categoriesTotal,
                    stageSeconds    : state.stageSeconds.slice(),
                    cancelled       : state.cancelled,
                    done            : state.done
                };
            }
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Load All Models, Awaited to the End
    // ------------------------------------------------------------
    // The staged load above, for a caller that wants nothing until the whole
    // phase is in: a design phase loaded off-scene, a phase the Design Phase
    // menu fetches. Returns the Map of category -> THREE.Group.
    // ------------------------------------------------------------
    async function Na__ModelLoader__LoadAllModels(modelUrls, modelGroupRoot, config, lineResolution, statusCallback, options) {
        const run = Na__ModelLoader__StartStagedLoad(
            modelUrls,
            modelGroupRoot,
            config,
            lineResolution,
            Object.assign({}, options || {}, { statusCallback : statusCallback })
        );
        return run.whenDone();
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
        Na__ModelLoader__StartStagedLoad,
        Na__ModelLoader__RestoreLoadedVisibility,
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
