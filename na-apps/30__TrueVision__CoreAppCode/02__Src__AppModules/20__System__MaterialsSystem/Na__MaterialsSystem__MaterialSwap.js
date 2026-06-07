// =============================================================================
// TRUEVISION3D - MATERIALS SYSTEM - MATERIAL SWAP
// =============================================================================
//
// FILE       : Na__MaterialsSystem__MaterialSwap.js
// NAMESPACE  : Na__MaterialsSystem
// MODULE     : MaterialSwap
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Traverse loaded models and swap materials based on the library
// CREATED    : 23-Feb-2026
//
// DESCRIPTION:
// - Traverses a THREE.Group scene graph after model loading.
// - Checks each mesh node's material.name against the materials lookup map.
// - If a match is found, creates a new THREE.MeshStandardMaterial with PBR
//   properties from the library config and applies it to the mesh.
// - If no match is found, the existing material (whitecard) is preserved.
// - Supports optional texture URL hot-swapping from TextureMaps config.
// - Handles IsDoubleSided, Transparent, DepthWrite, and EnvMapIntensity.
// - AoExclude: true in the library config assigns a mesh to THREE.js layer 1
//   and tags node.userData.na_aoExclude = true. The render pipeline disables
//   layer 1 on the camera during depth pre-passes so the SSAO shader never
//   receives depth data for these meshes (foliage, plants, etc.).
//
// =============================================================================

import * as THREE from 'three';
import { Na__MaterialsSystem__IsIndexedName } from './Na__MaterialsSystem__LibraryLoader.js';
import { Na__DataLib__GetPipelineExclusions } from '../01__AppCore/AppCore__DataLib__Loader.js';


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Shared Texture Loader Instance
    // ------------------------------------------------------------
    const Na__MaterialsSystem__TextureLoader = new THREE.TextureLoader();     // <-- Reused for all texture loads
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Colour Parsing Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Parse RGB String to THREE.Color
    // ------------------------------------------------------------
    // Accepts "rgb(R, G, B)" format and returns a THREE.Color.
    // Returns white if parsing fails.
    // ------------------------------------------------------------
    function Na__MaterialsSystem__ParseRgbString(rgbString) {
        if (!rgbString || typeof rgbString !== 'string') {
            return new THREE.Color(1, 1, 1);                                  // <-- Fallback white
        }

        const match = rgbString.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
        if (!match) {
            return new THREE.Color(1, 1, 1);                                  // <-- Fallback white
        }

        return new THREE.Color(
            parseInt(match[1], 10) / 255.0,                                   // <-- R normalised to 0-1
            parseInt(match[2], 10) / 255.0,                                   // <-- G normalised to 0-1
            parseInt(match[3], 10) / 255.0                                    // <-- B normalised to 0-1
        );
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Texture Loading Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Load Texture from URL (Async, Nullable)
    // ------------------------------------------------------------
    // Returns a Promise that resolves to a THREE.Texture or null.
    // Silently returns null if the URL is null/undefined.
    // ------------------------------------------------------------
    function Na__MaterialsSystem__LoadTexture(textureUrl) {
        if (!textureUrl) return Promise.resolve(null);                        // <-- No URL, no texture

        return new Promise((resolve) => {
            Na__MaterialsSystem__TextureLoader.load(
                textureUrl,
                (texture) => {
                    texture.colorSpace = THREE.SRGBColorSpace;                // <-- Ensure correct colour space
                    resolve(texture);
                },
                undefined,
                (error) => {
                    console.warn(`[MaterialsSystem] Texture load failed: ${textureUrl}`, error);
                    resolve(null);                                            // <-- Graceful fallback
                }
            );
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Material Creation
// -----------------------------------------------------------------------------

    // FUNCTION | Create PBR Material from Library Config
    // ------------------------------------------------------------
    // Builds a THREE.MeshStandardMaterial using the full set of PBR
    // properties from a material library config entry. Handles
    // transparency, double-sided rendering, depth write, and
    // environment map intensity.
    // ------------------------------------------------------------
    function Na__MaterialsSystem__CreatePbrMaterial(config, polygonOffsetConfig) {
        const baseColor = Na__MaterialsSystem__ParseRgbString(config.BaseColor);
        const emissive  = Na__MaterialsSystem__ParseRgbString(config.EmissiveFactor || 'rgb(0,0,0)');

        const isTransparent  = (config.Transparent === true);                 // <-- Explicit opt-in, defaults false
        const isDoubleSided  = (config.IsDoubleSided === true);              // <-- Explicit opt-in, defaults false (single-sided is more performant)
        const depthWrite     = (config.DepthWrite !== false);                 // <-- Defaults true, only false when explicitly set
        const opacity        = (typeof config.Opacity === 'number') ? config.Opacity : 1.0;

        const materialParams = {
            color               : baseColor,
            roughness           : (typeof config.PbrRoughness === 'number') ? config.PbrRoughness : 1.0,
            metalness           : (typeof config.PbrMetallic  === 'number') ? config.PbrMetallic  : 0.0,
            transparent         : isTransparent,
            opacity             : opacity,
            side                : isDoubleSided ? THREE.DoubleSide : THREE.FrontSide,
            depthWrite          : depthWrite,
            emissive            : emissive,
            emissiveIntensity   : (typeof config.EmissiveIntensity === 'number') ? config.EmissiveIntensity : 0.0,
            envMapIntensity     : (typeof config.EnvMapIntensity === 'number') ? config.EnvMapIntensity : 0.0,
            polygonOffset       : true,
            polygonOffsetFactor : polygonOffsetConfig.factor,
            polygonOffsetUnits  : polygonOffsetConfig.units
        };

        if (typeof config.AlphaTest === 'number' && config.AlphaTest > 0) {
            materialParams.alphaTest = config.AlphaTest;                      // <-- Alpha testing threshold
        }

        const material  = new THREE.MeshStandardMaterial(materialParams);
        material.name   = config.SketchUpName || '';                          // <-- Preserve material name for debugging

        return material;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Texture Application
// -----------------------------------------------------------------------------

    // FUNCTION | Apply Texture Maps to Material (Async)
    // ------------------------------------------------------------
    // Reads the TextureMaps section of a config and loads any
    // non-null URLs, assigning them to the correct material slots.
    // Returns a Promise that resolves when all textures are loaded.
    // ------------------------------------------------------------
    async function Na__MaterialsSystem__ApplyTextureMaps(material, config) {
        const textureMaps = config.TextureMaps;
        if (!textureMaps) return;                                             // <-- No texture maps section

        const loadPromises = [];                                              // <-- Parallel texture loads

        if (textureMaps.BaseColorUrl) {
            loadPromises.push(
                Na__MaterialsSystem__LoadTexture(textureMaps.BaseColorUrl).then((tex) => {
                    if (tex) material.map = tex;                              // <-- Base colour / diffuse map
                })
            );
        }

        if (textureMaps.NormalUrl) {
            loadPromises.push(
                Na__MaterialsSystem__LoadTexture(textureMaps.NormalUrl).then((tex) => {
                    if (tex) {
                        tex.colorSpace = THREE.LinearSRGBColorSpace;          // <-- Normal maps are linear
                        material.normalMap = tex;
                        if (typeof config.NormalScale === 'number') {
                            material.normalScale = new THREE.Vector2(config.NormalScale, config.NormalScale);
                        }
                    }
                })
            );
        }

        if (textureMaps.RoughnessUrl) {
            loadPromises.push(
                Na__MaterialsSystem__LoadTexture(textureMaps.RoughnessUrl).then((tex) => {
                    if (tex) {
                        tex.colorSpace = THREE.LinearSRGBColorSpace;          // <-- Roughness is linear
                        material.roughnessMap = tex;
                    }
                })
            );
        }

        if (textureMaps.MetallicUrl) {
            loadPromises.push(
                Na__MaterialsSystem__LoadTexture(textureMaps.MetallicUrl).then((tex) => {
                    if (tex) {
                        tex.colorSpace = THREE.LinearSRGBColorSpace;          // <-- Metallic is linear
                        material.metalnessMap = tex;
                    }
                })
            );
        }

        if (textureMaps.EmissiveUrl) {
            loadPromises.push(
                Na__MaterialsSystem__LoadTexture(textureMaps.EmissiveUrl).then((tex) => {
                    if (tex) material.emissiveMap = tex;                      // <-- Emissive map
                })
            );
        }

        if (textureMaps.OcclusionUrl) {
            loadPromises.push(
                Na__MaterialsSystem__LoadTexture(textureMaps.OcclusionUrl).then((tex) => {
                    if (tex) {
                        tex.colorSpace = THREE.LinearSRGBColorSpace;          // <-- AO is linear
                        material.aoMap = tex;
                        if (typeof config.OcclusionStrength === 'number') {
                            material.aoMapIntensity = config.OcclusionStrength;
                        }
                    }
                })
            );
        }

        if (textureMaps.AlphaUrl) {
            loadPromises.push(
                Na__MaterialsSystem__LoadTexture(textureMaps.AlphaUrl).then((tex) => {
                    if (tex) {
                        tex.colorSpace = THREE.LinearSRGBColorSpace;          // <-- Alpha is linear
                        material.alphaMap   = tex;
                        material.transparent = true;                          // <-- Force transparency when alpha map present
                    }
                })
            );
        }

        await Promise.all(loadPromises);                                      // <-- Wait for all textures
        material.needsUpdate = true;                                          // <-- Flag material for GPU upload
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Pipeline Exclusion Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Read Ambient-Occlusion Exclusion Tokens from DataLib
    // ------------------------------------------------------------
    // Returns { tokens: [...], matchMode: 'contains'|'prefix' } sourced from
    // the Components DataLib Na__DataLib__PipelineExclusions section, or an
    // empty token list when unavailable.
    // ------------------------------------------------------------
    function Na__MaterialsSystem__GetAoExclusionTokens() {
        const exclusions = Na__DataLib__GetPipelineExclusions();
        if (!exclusions) return { tokens: [], matchMode: 'contains' };

        const aoSection = exclusions.Na__DataLib__PipelineExclusions__AmbientOcclusion;
        const tokens    = (aoSection && Array.isArray(aoSection.Names)) ? aoSection.Names : [];
        const matchMode = (typeof exclusions.MatchMode === 'string') ? exclusions.MatchMode : 'contains';
        return { tokens, matchMode };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Test a Name Against Exclusion Tokens
    // ------------------------------------------------------------
    function Na__MaterialsSystem__NameMatchesExclusion(name, tokens, matchMode) {
        if (!name || !tokens || tokens.length === 0) return false;
        for (const token of tokens) {
            if (!token) continue;
            if (matchMode === 'contains') {
                if (name.includes(token)) return true;
            } else if (name.startsWith(token) || token.startsWith(name)) {
                return true;
            }
        }
        return false;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Test a Node or Any Ancestor Against Exclusion Tokens
    // ------------------------------------------------------------
    function Na__MaterialsSystem__NodeOrAncestorExcluded(node, tokens, matchMode) {
        if (!tokens || tokens.length === 0) return false;
        let current = node;
        while (current) {
            if (Na__MaterialsSystem__NameMatchesExclusion(current.name, tokens, matchMode)) {
                return true;
            }
            current = current.parent;
        }
        return false;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Main Material Swap Function
// -----------------------------------------------------------------------------

    // FUNCTION | Apply Materials from Library to Model Group
    // ------------------------------------------------------------
    // Traverses all meshes in a THREE.Group. For each mesh whose
    // material.name matches the lookup map, creates a new PBR
    // material from the library config and replaces the existing
    // material. Meshes with no match retain their current material
    // (whitecard fallback preserved).
    //
    // Parameters:
    //   modelGroup        - THREE.Group containing loaded model meshes
    //   lookupMap         - Map<SketchUpName, MaterialConfig> from LibraryLoader
    //   materialsConfig   - MaterialsSystem__Config section from app config
    // ------------------------------------------------------------
    async function Na__MaterialsSystem__ApplyMaterials(modelGroup, lookupMap, materialsConfig) {
        if (!modelGroup || !lookupMap || lookupMap.size === 0) return;         // <-- Guard against invalid input
        const mirrorDebugName = 'MAT140__Mirror__ClearDefault';                 // <-- Targeted diagnostics for black mirror investigation

        const polygonOffsetConfig = {
            factor : (typeof materialsConfig.MaterialsSystem__Config__PolygonOffsetFactor === 'number')
                ? materialsConfig.MaterialsSystem__Config__PolygonOffsetFactor
                : 2,
            units  : (typeof materialsConfig.MaterialsSystem__Config__PolygonOffsetUnits === 'number')
                ? materialsConfig.MaterialsSystem__Config__PolygonOffsetUnits
                : 2
        };

        const materialCache   = new Map();                                    // <-- Cache created materials by SketchUpName
        const texturePromises = [];                                           // <-- Collect async texture loads
        let   swapCount       = 0;                                            // <-- Counter for logging
        let   indexedSeen     = 0;                                            // <-- Indexed material names encountered
        let   indexedMissing  = 0;                                            // <-- Indexed names not found in lookup map
        let   mirrorSeen      = 0;                                            // <-- Number of mirror materials encountered in traversal
        let   mirrorSwapped   = 0;                                            // <-- Number of mirror materials swapped from library
        let   aoExcludedCount = 0;                                            // <-- Meshes assigned to AO-excluded layer 1

        const { tokens: aoExclusionTokens, matchMode: aoExclusionMatchMode }  // <-- Name-based AO exclusion list from Components DataLib
            = Na__MaterialsSystem__GetAoExclusionTokens();

        const Na__MaterialsSystem__ResolveSwappedMaterial = (sourceMaterial) => {
            const materialName = sourceMaterial ? sourceMaterial.name : null;

            if (!materialName || !Na__MaterialsSystem__IsIndexedName(materialName)) {
                return sourceMaterial;                                         // <-- No indexed name, keep original material
            }
            indexedSeen++;
            if (materialName === mirrorDebugName) {
                mirrorSeen++;
            }

            const config = lookupMap.get(materialName);                        // <-- O(1) lookup by SketchUpName
            if (!config) {
                indexedMissing++;
                if (materialName === mirrorDebugName) {
                    console.warn('[MaterialsSystem] Mirror material indexed but missing in lookup map:', materialName);
                }
                return sourceMaterial;                                         // <-- Not in library, keep existing material
            }

            let pbrMaterial;

            if (materialCache.has(materialName)) {
                pbrMaterial = materialCache.get(materialName);                 // <-- Reuse cached material instance
            } else {
                pbrMaterial = Na__MaterialsSystem__CreatePbrMaterial(config, polygonOffsetConfig);
                materialCache.set(materialName, pbrMaterial);                  // <-- Cache for reuse

                const hasTextures = config.TextureMaps && Object.values(config.TextureMaps).some((url) => url !== null);
                if (hasTextures) {
                    texturePromises.push(
                        Na__MaterialsSystem__ApplyTextureMaps(pbrMaterial, config)
                    );
                }
            }

            swapCount++;
            if (materialName === mirrorDebugName) {
                mirrorSwapped++;
            }
            return pbrMaterial;
        };

        modelGroup.traverse((node) => {
            if (!node.isMesh) return;                                         // <-- Skip non-mesh nodes

            if (Array.isArray(node.material)) {
                node.material = node.material.map((material) => Na__MaterialsSystem__ResolveSwappedMaterial(material));
            } else {
                node.material = Na__MaterialsSystem__ResolveSwappedMaterial(node.material);
            }

            // AO EXCLUSION | Assign AO-exempt meshes to Three.js layer 1 so the render
            // pipeline can temporarily blind the camera to layer 1 during depth pre-passes,
            // preventing the SSAO shader from accumulating occlusion on foliage geometry.
            // Two independent drivers: (a) material-level AoExclude flag, and
            // (b) name-based exclusion tokens from the Components DataLib (covers
            // stems/branches/leaves even when their material is not a foliage MAT).
            let   na_aoExclude    = false;
            const primaryMaterial = Array.isArray(node.material) ? node.material[0] : node.material;
            if (primaryMaterial && Na__MaterialsSystem__IsIndexedName(primaryMaterial.name)) {
                const matConfig = lookupMap.get(primaryMaterial.name);
                if (matConfig && matConfig.AoExclude === true) {
                    na_aoExclude = true;                                      // <-- Material-driven AO exclusion
                }
            }
            if (!na_aoExclude && Na__MaterialsSystem__NodeOrAncestorExcluded(node, aoExclusionTokens, aoExclusionMatchMode)) {
                na_aoExclude = true;                                          // <-- Name-driven AO exclusion
            }
            if (na_aoExclude) {
                node.layers.set(1);                                           // <-- Layer 1 = AO-excluded; camera.layers.enable(1) in setup keeps it visible
                node.userData.na_aoExclude = true;                            // <-- Tag for debugging / identification
                aoExcludedCount++;
            }
        });

        if (texturePromises.length > 0) {
            await Promise.all(texturePromises);                               // <-- Wait for all texture loads
        }

        console.log(
            `[MaterialsSystem] IndexedSeen=${indexedSeen}, Swapped=${swapCount}, IndexedMissing=${indexedMissing}, UniqueSwapped=${materialCache.size}, MirrorSeen=${mirrorSeen}, MirrorSwapped=${mirrorSwapped}, AoExcluded=${aoExcludedCount}`
        );
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Mirror-Only Environment Overrides
// -----------------------------------------------------------------------------

    // FUNCTION | Apply Mirror-Only Environment and Brightness Overrides
    // ------------------------------------------------------------
    // Applies env reflections and optional brightness boost only to
    // the targeted mirror material name, avoiding scene-wide tinting.
    // ------------------------------------------------------------
    function Na__MaterialsSystem__ApplyMirrorEnvironmentOverrides(modelGroup, envMapTexture, options = {}) {
        if (!modelGroup || !envMapTexture) return;

        const targetMaterialName = (typeof options.targetMaterialName === 'string' && options.targetMaterialName.length > 0)
            ? options.targetMaterialName
            : 'MAT140__Mirror__ClearDefault';

        const envIntensity = Number.isFinite(options.envMapIntensity) ? options.envMapIntensity : 1.6;
        const brightnessBoost = Number.isFinite(options.brightnessBoost) ? options.brightnessBoost : 1.15;
        const roughnessOverride = Number.isFinite(options.roughnessOverride) ? options.roughnessOverride : null;

        let mirrorMatchedCount = 0;

        const applyToMaterial = (material) => {
            if (!material || material.name !== targetMaterialName) return;

            material.envMap = envMapTexture;
            material.envMapIntensity = envIntensity;
            if (roughnessOverride !== null && 'roughness' in material) {
                material.roughness = roughnessOverride;
            }

            if (material.color && typeof material.color.multiplyScalar === 'function') {
                material.color.multiplyScalar(brightnessBoost);
            }

            material.needsUpdate = true;
            mirrorMatchedCount++;
        };

        modelGroup.traverse((node) => {
            if (!node.isMesh || !node.material) return;

            if (Array.isArray(node.material)) {
                node.material.forEach(applyToMaterial);
            } else {
                applyToMaterial(node.material);
            }
        });

        console.log(
            `[MaterialsSystem] Mirror overrides applied: target=${targetMaterialName}, matched=${mirrorMatchedCount}, envIntensity=${envIntensity}, brightnessBoost=${brightnessBoost}, roughness=${roughnessOverride}`
        );
    }
    // ------------------------------------------------------------


    // FUNCTION | Apply Subtle Glass Environment Overrides
    // ------------------------------------------------------------
    // Applies a low-intensity environment reflection to window glass
    // so it reflects slightly without affecting the full scene tone.
    // ------------------------------------------------------------
    function Na__MaterialsSystem__ApplyGlassEnvironmentOverrides(modelGroup, envMapTexture, options = {}) {
        if (!modelGroup || !envMapTexture) return;

        const targetMaterialName = (typeof options.targetMaterialName === 'string' && options.targetMaterialName.length > 0)
            ? options.targetMaterialName
            : 'MAT101__Glass__ClearDefault';

        const envIntensity = Number.isFinite(options.envMapIntensity) ? options.envMapIntensity : 0.3;
        const brightnessMultiplier = Number.isFinite(options.brightnessMultiplier) ? options.brightnessMultiplier : 1.0;
        let glassMatchedCount = 0;

        const applyToMaterial = (material) => {
            if (!material || material.name !== targetMaterialName) return;

            material.envMap = envMapTexture;
            material.envMapIntensity = envIntensity;
            if (material.color && typeof material.color.multiplyScalar === 'function') {
                material.color.multiplyScalar(brightnessMultiplier);
            }
            material.needsUpdate = true;
            glassMatchedCount++;
        };

        modelGroup.traverse((node) => {
            if (!node.isMesh || !node.material) return;

            if (Array.isArray(node.material)) {
                node.material.forEach(applyToMaterial);
            } else {
                applyToMaterial(node.material);
            }
        });

        console.log(
            `[MaterialsSystem] Glass overrides applied: target=${targetMaterialName}, matched=${glassMatchedCount}, envIntensity=${envIntensity}, brightnessMultiplier=${brightnessMultiplier}`
        );
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Material Swap API
    // ------------------------------------------------------------
    export {
        Na__MaterialsSystem__ApplyMaterials,
        Na__MaterialsSystem__ApplyMirrorEnvironmentOverrides,
        Na__MaterialsSystem__ApplyGlassEnvironmentOverrides
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

