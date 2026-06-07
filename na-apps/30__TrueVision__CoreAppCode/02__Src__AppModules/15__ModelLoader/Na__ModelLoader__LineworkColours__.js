// =============================================================================
// TRUEVISION3D - MODEL LOADER - LINEWORK COLOUR UTILITIES
// =============================================================================
//
// FILE      : Na__ModelLoader__LineworkColours__.js
// NAMESPACE : Na__ModelLoader
// MODULE    : LineworkColours
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Pure colour utilities for extracting, voting and propagating
//             linework edge colours from loaded GLB vertex colour data.
// CREATED   : 06-Jun-2026
//
// DESCRIPTION:
// - Extracts glTF COLOR_0 vertex colour attributes from line geometry.
// - Determines the dominant colour per line object via a weighted vote map.
// - Resolves colours by exact or prefix name matching across linework objects.
// - Propagates per-linework colour metadata to paired mesh nodes so the
//   profile-colour prepass can tint auto-detected silhouette edges correctly.
//
// DEPENDENCIES:
// - Three.js (THREE.Color, THREE.MathUtils)
//
// USAGE:
// - Import specific functions into Na__ModelLoader__MultiModel.js.
// - Call Na__ModelLoader__ApplyProfileLineColoursToMeshRoot after both
//   mesh and linework roots are loaded for a category group.
//
// -----
//
// DEVELOPMENT LOG:
// 06-Jun-2026 - Version 1.0.0
// - Initial stable release.
// - Ported and adapted from ValeVision3D Na__ModelLoader__MultiModel.js.
// - All colour logic extracted into this dedicated module.
//
// =============================================================================


// #Region ---
// REGION | Module Imports
// -----

    import * as THREE from 'three';                                 // <-- THREE.Color + THREE.MathUtils

// endregion ----


// #Region ---
// REGION | Colour Extraction
// -----

    // FUNCTION | Extract Imported Line Vertex Colours
    // ------------------------------------------------------------
    // Reads the glTF COLOR_0 attribute via fromBufferAttribute for
    // safe normalisation regardless of the underlying buffer type.
    // Returns a flat Float32 RGB array (r0,g0,b0, r1,g1,b1 ...) or
    // null when no usable colour attribute is present.
    // ------------------------------------------------------------
    function Na__ModelLoader__ExtractLineColors(geometry) {
        const colorAttribute = geometry && geometry.getAttribute
            ? geometry.getAttribute('color')
            : null;
        if (!colorAttribute || colorAttribute.itemSize < 3) {
            return null;                                            // <-- No usable imported line colours
        }

        const lineColors = [];
        const tempColor  = new THREE.Color();

        for (let i = 0; i < colorAttribute.count; i++) {
            tempColor.fromBufferAttribute(colorAttribute, i);       // <-- Safe read: normalises all buffer types
            lineColors.push(tempColor.r, tempColor.g, tempColor.b);
        }

        return lineColors;
    }
    // ------------------------------------------------------------

// endregion ----


// #Region ---
// REGION | Edge Colour Darkening
// -----

    // FUNCTION | Darken Extracted Vertex Colours (TrueVision Calibration Rule)
    // ------------------------------------------------------------
    // Applies a configurable HSL lightness reduction to all colours in a flat
    // RGB array (the format returned by Na__ModelLoader__ExtractLineColors).
    // This ensures SketchUp MTE edge colours, which are calibrated for the
    // SketchUp viewport, render at the correct perceived weight in TrueVision's
    // lit white-card environment without modifying any source data.
    //
    // lightnessReductionAmount: integer on 0-100 scale (e.g. 10 = reduce L by 10).
    // Returns a new array. Returns the original array unchanged when reduction
    // is zero, not finite, or the input array is empty/null.
    // ------------------------------------------------------------
    function Na__ModelLoader__DarkenExtractedColors(colorArray, lightnessReductionAmount) {
        if (!Array.isArray(colorArray) || colorArray.length < 3) {
            return colorArray;                                      // <-- Null or empty — nothing to darken
        }
        if (!Number.isFinite(lightnessReductionAmount) || lightnessReductionAmount <= 0) {
            return colorArray;                                      // <-- No reduction configured
        }

        const reduction    = lightnessReductionAmount / 100;       // <-- Convert 0-100 scale to 0-1 for THREE HSL
        const darkened     = colorArray.slice();                   // <-- Work on a copy; never mutate extracted source
        const tempColor    = new THREE.Color();
        const hsl          = {};

        for (let i = 0; i < darkened.length; i += 3) {
            tempColor.setRGB(darkened[i], darkened[i + 1], darkened[i + 2]);
            tempColor.getHSL(hsl);
            hsl.l = Math.max(0, hsl.l - reduction);               // <-- Clamp to 0 — can't go below absolute black
            tempColor.setHSL(hsl.h, hsl.s, hsl.l);
            darkened[i]     = tempColor.r;                         // <-- Write darkened channel back
            darkened[i + 1] = tempColor.g;
            darkened[i + 2] = tempColor.b;
        }

        return darkened;
    }
    // ------------------------------------------------------------

// endregion ----


// #Region ---
// REGION | Colour Vote Infrastructure
// -----

    // HELPER FUNCTION | Build Quantized Colour Key
    // ------------------------------------------------------------
    function Na__ModelLoader__BuildColorKey(colorTriplet) {
        if (!Array.isArray(colorTriplet) || colorTriplet.length < 3) {
            return null;                                            // <-- Guard against invalid triplets
        }

        const r = Math.round(THREE.MathUtils.clamp(colorTriplet[0], 0, 1) * 255);
        const g = Math.round(THREE.MathUtils.clamp(colorTriplet[1], 0, 1) * 255);
        const b = Math.round(THREE.MathUtils.clamp(colorTriplet[2], 0, 1) * 255);
        return `${r}_${g}_${b}`;                                    // <-- Stable RGB key for vote maps
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Register a Colour Vote
    // ------------------------------------------------------------
    function Na__ModelLoader__RegisterColorVote(voteMap, colorTriplet, weight = 1) {
        const colorKey = Na__ModelLoader__BuildColorKey(colorTriplet);
        if (!colorKey) return;                                      // <-- Ignore invalid colours

        const existing = voteMap.get(colorKey);
        if (existing) {
            existing.weight += weight;                              // <-- Accumulate weight for repeated colours
            return;
        }

        voteMap.set(colorKey, {
            color  : [colorTriplet[0], colorTriplet[1], colorTriplet[2]], // <-- Normalised RGB triplet
            weight : weight
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Resolve Dominant Colour from Vote Map
    // ------------------------------------------------------------
    function Na__ModelLoader__ResolveDominantColor(voteMap) {
        let dominantVote = null;

        voteMap.forEach((vote) => {
            if (!dominantVote || vote.weight > dominantVote.weight) {
                dominantVote = vote;                                // <-- Track strongest vote
            }
        });

        return dominantVote ? [...dominantVote.color] : null;      // <-- Detached RGB triplet copy
    }
    // ------------------------------------------------------------


    // FUNCTION | Resolve Dominant Line Colour from Flat Colour Array
    // ------------------------------------------------------------
    function Na__ModelLoader__ResolveDominantImportedLineColor(importedColors) {
        if (!Array.isArray(importedColors) || importedColors.length < 3) {
            return null;                                            // <-- Nothing to vote on
        }

        const colorVotes = new Map();
        for (let i = 0; i < importedColors.length; i += 3) {
            Na__ModelLoader__RegisterColorVote(colorVotes, [
                importedColors[i],
                importedColors[i + 1],
                importedColors[i + 2]
            ]);
        }

        return Na__ModelLoader__ResolveDominantColor(colorVotes);
    }
    // ------------------------------------------------------------

// endregion ----


// #Region ---
// REGION | Name-Based Colour Resolution
// -----

    // HELPER FUNCTION | Find Colour by Exact or Prefix Name Match
    // ------------------------------------------------------------
    // Exact match is preferred. If no exact match exists the longest
    // prefix shared between objectName and any key wins (e.g. a mesh
    // named "CubeInstance1" will match a linework key "CubeInstance1"
    // exactly, or "Cube" by prefix if no exact key exists).
    // ------------------------------------------------------------
    function Na__ModelLoader__FindColorByName(objectName, colorByName) {
        if (!objectName || typeof objectName !== 'string') return null;

        if (colorByName[objectName]) {
            return colorByName[objectName];                         // <-- Exact match wins immediately
        }

        let bestMatch = null;
        let bestLength = 0;

        for (const key of Object.keys(colorByName)) {
            if (!key) continue;
            const objectStartsKey = objectName.startsWith(key);
            const keyStartsObject = key.startsWith(objectName);
            if (objectStartsKey || keyStartsObject) {
                const matchLen = Math.min(key.length, objectName.length);
                if (matchLen > bestLength) {
                    bestLength = matchLen;
                    bestMatch  = colorByName[key];
                }
            }
        }

        return bestMatch;
    }
    // ------------------------------------------------------------


    // FUNCTION | Resolve Profile Colour for a Mesh Object
    // ------------------------------------------------------------
    // Walks the object's ancestor chain looking for a named colour
    // match. Falls back to the linework root dominant colour.
    // ------------------------------------------------------------
    function Na__ModelLoader__ResolveProfileColorForObject(object, colorByName, rootColor) {
        let current = object;

        while (current) {
            const matched = current.name
                ? Na__ModelLoader__FindColorByName(current.name, colorByName)
                : null;
            if (matched) {
                return [...matched];                                // <-- Nearest named match in ancestor chain
            }
            current = current.parent;
        }

        return rootColor ? [...rootColor] : null;                  // <-- Root dominant fallback
    }
    // ------------------------------------------------------------

// endregion ----


// #Region ---
// REGION | Mesh Root Colour Propagation
// -----

    // FUNCTION | Apply Profile Line Colours to Mesh Root
    // ------------------------------------------------------------
    // Reads the colour metadata stored on a lineworkRoot by
    // Na__ModelLoader__UpgradeLineworkRoot and writes matching
    // Na__ProfileLineColor userData onto every mesh node in the
    // paired meshRoot. This enables future per-mesh profile colour
    // overrides inside the profile-colour prepass.
    // ------------------------------------------------------------
    function Na__ModelLoader__ApplyProfileLineColoursToMeshRoot(meshRoot, lineworkRoot) {
        if (!meshRoot || !lineworkRoot) {
            return meshRoot;                                        // <-- Need both roots
        }

        const colorByName = lineworkRoot.userData.Na__ProfileLineColorByName  || {};
        const rootColor   = lineworkRoot.userData.Na__ProfileLineColorDominant || null;

        if (!rootColor && Object.keys(colorByName).length === 0) {
            return meshRoot;                                        // <-- No linework colour data to propagate
        }

        meshRoot.userData.Na__ProfileLineColorDominant = rootColor ? [...rootColor] : null;
        if (rootColor) {
            meshRoot.userData.Na__ProfileLineColor = [...rootColor]; // <-- Root fallback colour for child meshes
        }

        meshRoot.traverse((node) => {
            if (!node.isMesh) return;                               // <-- Profile colour only needed on mesh surfaces

            const resolved = Na__ModelLoader__ResolveProfileColorForObject(node, colorByName, rootColor);
            if (resolved) {
                node.userData.Na__ProfileLineColor = resolved;     // <-- Per-mesh dominant colour for profile prepass
            }
        });

        return meshRoot;
    }
    // ------------------------------------------------------------

// endregion ----


// #Region ---
// REGION | Module Exports
// -----

    // MODULE EXPORTS | Linework Colour Utilities API
    // ------------------------------------------------------------
    export {
        Na__ModelLoader__ExtractLineColors,
        Na__ModelLoader__DarkenExtractedColors,
        Na__ModelLoader__BuildColorKey,
        Na__ModelLoader__RegisterColorVote,
        Na__ModelLoader__ResolveDominantColor,
        Na__ModelLoader__ResolveDominantImportedLineColor,
        Na__ModelLoader__FindColorByName,
        Na__ModelLoader__ResolveProfileColorForObject,
        Na__ModelLoader__ApplyProfileLineColoursToMeshRoot
    };
    // ------------------------------------------------------------

// endregion ----
