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
//
// =============================================================================

import * as THREE from 'three';
import { Na__MaterialsSystem__IsIndexedName } from './Na__MaterialsSystem__LibraryLoader.js';


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

        modelGroup.traverse((node) => {
            if (!node.isMesh) return;                                         // <-- Skip non-mesh nodes

            const materialName = node.material ? node.material.name : null;

            if (!materialName || !Na__MaterialsSystem__IsIndexedName(materialName)) {
                return;                                                       // <-- No indexed name, keep whitecard
            }
            indexedSeen++;

            const config = lookupMap.get(materialName);                       // <-- O(1) lookup by SketchUpName
            if (!config) {
                indexedMissing++;
                return;                                                       // <-- Not in library, keep existing material
            }

            let pbrMaterial;

            if (materialCache.has(materialName)) {
                pbrMaterial = materialCache.get(materialName);                // <-- Reuse cached material instance
            } else {
                pbrMaterial = Na__MaterialsSystem__CreatePbrMaterial(config, polygonOffsetConfig);
                materialCache.set(materialName, pbrMaterial);                 // <-- Cache for reuse

                const hasTextures = config.TextureMaps && Object.values(config.TextureMaps).some((url) => url !== null);
                if (hasTextures) {
                    texturePromises.push(
                        Na__MaterialsSystem__ApplyTextureMaps(pbrMaterial, config)
                    );
                }
            }

            node.material = pbrMaterial;                                      // <-- Swap the material
            swapCount++;
        });

        if (texturePromises.length > 0) {
            await Promise.all(texturePromises);                               // <-- Wait for all texture loads
        }

        console.log(
            `[MaterialsSystem] IndexedSeen=${indexedSeen}, Swapped=${swapCount}, IndexedMissing=${indexedMissing}, UniqueSwapped=${materialCache.size}`
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
        Na__MaterialsSystem__ApplyMaterials
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

