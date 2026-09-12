// =============================================================================
// TRUEVISION3D - PROJECTED LINEWORK - STAGE SAMPLER
// =============================================================================
//
// FILE       : Na__ProjectedLinework__StageSampler__.js
// NAMESPACE  : Na__PlSampler
// MODULE     : Projected Linework - Stage Sampler
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Read the live model out into plain numbers, cut and filtered for one drawing
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - Walks the live model root (no clone, no stage group) and writes every
//   triangle the projection needs into three flat arrays: scene space
//   corners, which way the material faces, and whether the instance carried
//   a mirroring transform. The LAST module in the chain that knows three.js
//   exists; everything downstream sees numbers.
//
// - WHAT IS TAKEN. Visible meshes only, honouring visibility up the tree so
//   a category switched off in Toggle Model Elements is out of the drawing.
//   Scene helpers are skipped by their flags (naCrossSectionHelper) and by
//   name (the config's SkipObjectNames). Linework roots are left to the
//   authored edge module. InstancedMesh contributes one instance per matrix.
//   The drawing's exclusion tokens are matched against the category group
//   names (D19).
//
// - TWO SETS, NOT ONE. Everything collected DRAWS its edges; not everything
//   HIDES what is behind it. A transparent material (glass) draws its own
//   pane edges but does not occlude, unless the drawing's Glass Transparency
//   Off style is on, in which case it occludes like a wall.
//
// - THE CUT. Triangles are clipped against the drawing's cut plane and its
//   view depth plane before they become occluders, so a plan hides what lies
//   below the datum and not what lies above it, and a section respects its
//   depth. Where a triangle crosses the cut plane, the crossing segment is
//   collected as the SECTION OUTLINE, the heavy line a drawing office puts
//   round cut material.
//
// - Two passes, count then fill, so the typed arrays are exactly sized: the
//   clip can turn one triangle into three and a growing buffer would copy a
//   large model repeatedly.
//
// INTEGRATION:
// - Na__ProjectedLinework__CpuBackend__ calls Collect once per model state
//   and Sample once per drawing definition.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 50__System__ProjectedLinework/Na__ProjectedLinework__StageSampler__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 4.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js Core
    // ------------------------------------------------------------
    import * as THREE from 'three';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Side Codes and Config
    // ------------------------------------------------------------
    import {
        Na__PlSoup__SIDE_FRONT,
        Na__PlSoup__SIDE_BACK,
        Na__PlSoup__SIDE_DOUBLE
    } from './Na__ProjectedLinework__SoupBuilder__.js';
    import {
        Na__PlCfg__GetSkipObjectNames,
        Na__PlCfg__GetModelSetup
    } from './Na__ProjectedLinework__ConfigAccess__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and Scratch
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Model Loader Tags
    // ------------------------------------------------------------
    const Na__PlSampler__TYPE_KEY      = 'Na__ModelType';     // <-- 'mesh' | 'linework' on the loader's roots
    const Na__PlSampler__TYPE_LINEWORK = 'linework';
    const Na__PlSampler__CLIP_EPSILON  = 1e-9;
    // ------------------------------------------------------------

    // MODULE VARIABLES | Reusable Scratch
    // ------------------------------------------------------------
    const Na__PlSampler__InstanceMatrix = new THREE.Matrix4();
    const Na__PlSampler__Corners        = new Float64Array(9);    // <-- One triangle in scene space
    const Na__PlSampler__Polygon        = new Float64Array(18);   // <-- Up to six vertices after two clips
    const Na__PlSampler__Scratch        = new Float64Array(18);
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Collection
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Does a Name Carry Any of the Tokens?
    // ------------------------------------------------------------
    // A TOKEN IS A SUBSTRING UNLESS IT STARTS WITH '=', in which case the whole
    // name has to match it. Substrings are right for the tokens a drawing record
    // carries, which are written by hand and meant loosely ("furniture"). They
    // are wrong for anything naming a model category in full, because the
    // category names nest: "TrueVision__MainBuildingModel__Existing" is a
    // substring of nine longer keys, and a viewport asking to hide the existing
    // building would lose its walls, roofs and windows as well. The Layout
    // Editor's Model Layers panel emits '=' tokens for that reason.
    function Na__PlSampler__NameMatches(name, tokens) {
        if (!name || !tokens || tokens.length === 0) return false;
        const lower = String(name).toLowerCase();
        for (let i = 0; i < tokens.length; i++) {
            if (!tokens[i]) continue;
            const token = String(tokens[i]).toLowerCase();
            if (token.charAt(0) === '=') { if (lower === token.slice(1)) return true; continue; }   // <-- Exact: this category and no other
            if (lower.indexOf(token) !== -1) return true;
        }
        return false;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is This Object a Scene Helper the Drawing Must Never See?
    // ------------------------------------------------------------
    function Na__PlSampler__IsHelper(object3d, skipNames) {
        const data = object3d.userData;
        if (data && (data.naCrossSectionHelper === true || data.naSectionCutHelper === true)) return true;
        if (data && data[Na__PlSampler__TYPE_KEY] === Na__PlSampler__TYPE_LINEWORK) return true;   // <-- Authored edges handle these
        return Na__PlSampler__NameMatches(object3d.name, skipNames);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is a Material Slot Transparent (see-through in the drawing)?
    // ------------------------------------------------------------
    function Na__PlSampler__IsTransparent(material, opacityBelow) {
        if (!material) return false;
        if (material.transparent === true) return true;
        return (typeof material.opacity === 'number' && material.opacity < opacityBelow);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reduce a Material to a Side Code
    // ------------------------------------------------------------
    function Na__PlSampler__SideCode(material) {
        if (!material) return Na__PlSoup__SIDE_FRONT;
        if (material.side === THREE.DoubleSide) return Na__PlSoup__SIDE_DOUBLE;
        if (material.side === THREE.BackSide)   return Na__PlSoup__SIDE_BACK;
        return Na__PlSoup__SIDE_FRONT;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Record One Instance of a Geometry
    // ------------------------------------------------------------
    function Na__PlSampler__PushInstance(list, mesh, matrixWorld, categoryName, rules) {
        const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        const transparent = Na__PlSampler__IsTransparent(material, rules.transparentOpacityBelow);
        list.push({
            geometry      : mesh.geometry,
            matrixWorld   : matrixWorld,
            side          : Na__PlSampler__SideCode(material),
            isTransparent : transparent,
            occludes      : !transparent || rules.glassOpaque === true || rules.transparentOccludes === true,
            categoryName  : categoryName
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Gather Every Instance the Drawing Should See
    // ------------------------------------------------------------
    // rules: { excludeTokens, glassOpaque }
    // Returns { Instances, Categories, SkippedCategories }. Walks the tree by
    // hand rather than with traverse so a hidden subtree is skipped whole.
    // ------------------------------------------------------------
    function Na__PlSampler__Collect(modelRoot, rules) {
        const instances = [];
        const seen      = [];
        const skipped   = [];
        if (!modelRoot) return { Instances : instances, Categories : seen, SkippedCategories : skipped };

        const setup = Na__PlCfg__GetModelSetup();
        const walk  = {
            excludeTokens           : rules.excludeTokens || [],
            glassOpaque             : rules.glassOpaque === true,
            transparentOccludes     : setup.transparentOccludes,
            transparentOpacityBelow : setup.transparentOpacityBelow,
            skipNames               : Na__PlCfg__GetSkipObjectNames()
        };

        modelRoot.updateMatrixWorld(true);

        const stack = [];
        for (let i = 0; i < modelRoot.children.length; i++) {
            const category = modelRoot.children[i];
            if (category.visible === false) continue;
            const name = category.name || '';
            if (Na__PlSampler__NameMatches(name, walk.excludeTokens)) { skipped.push(name); continue; }   // <-- D19: the drawing leaves this category out
            seen.push(name);
            stack.push({ object : category, category : name });
        }

        while (stack.length > 0) {
            const entry    = stack.pop();
            const object3d = entry.object;
            if (object3d.visible === false) continue;
            if (Na__PlSampler__IsHelper(object3d, walk.skipNames)) continue;

            if (object3d.isMesh === true && object3d.geometry && object3d.geometry.attributes &&
                object3d.geometry.attributes.position && object3d.geometry.attributes.position.count >= 3) {

                if (object3d.isInstancedMesh === true) {
                    const count = object3d.count || 0;
                    for (let k = 0; k < count; k++) {
                        object3d.getMatrixAt(k, Na__PlSampler__InstanceMatrix);
                        const world = new THREE.Matrix4().multiplyMatrices(object3d.matrixWorld, Na__PlSampler__InstanceMatrix);
                        Na__PlSampler__PushInstance(instances, object3d, world, entry.category, walk);
                    }
                } else {
                    Na__PlSampler__PushInstance(instances, object3d, object3d.matrixWorld, entry.category, walk);
                }
            }

            const children = object3d.children;
            for (let c = 0; c < children.length; c++) stack.push({ object : children[c], category : entry.category });
        }

        return { Instances : instances, Categories : seen, SkippedCategories : skipped };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Triangle Clipping
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Clip a Polygon Against One Half Space (Sutherland-Hodgman)
    // ------------------------------------------------------------
    // Keeps the side where nx*x + ny*y + nz*z >= d. source holds count
    // vertices (3 doubles each); the result is written to target and its
    // vertex count returned. crossing, when given, receives the two points
    // where the polygon boundary meets the plane (the cut outline).
    // ------------------------------------------------------------
    function Na__PlSampler__ClipPolygon(source, count, nx, ny, nz, d, target, crossing) {
        let written  = 0;
        let crossings = 0;

        for (let i = 0; i < count; i++) {
            const j  = (i + 1) % count;
            const ax = source[i * 3], ay = source[i * 3 + 1], az = source[i * 3 + 2];
            const bx = source[j * 3], by = source[j * 3 + 1], bz = source[j * 3 + 2];
            const sa = (nx * ax) + (ny * ay) + (nz * az) - d;
            const sb = (nx * bx) + (ny * by) + (nz * bz) - d;
            const inA = sa >= -Na__PlSampler__CLIP_EPSILON;
            const inB = sb >= -Na__PlSampler__CLIP_EPSILON;

            if (inA) {
                target[written * 3] = ax; target[written * 3 + 1] = ay; target[written * 3 + 2] = az;
                written++;
            }
            if (inA !== inB) {
                const t  = sa / (sa - sb);
                const mx = ax + (bx - ax) * t, my = ay + (by - ay) * t, mz = az + (bz - az) * t;
                target[written * 3] = mx; target[written * 3 + 1] = my; target[written * 3 + 2] = mz;
                written++;
                if (crossing && crossings < 2) {
                    crossing[crossings * 3] = mx; crossing[crossings * 3 + 1] = my; crossing[crossings * 3 + 2] = mz;
                    crossings++;
                }
            }
        }

        if (crossing) crossing.Count = crossings;
        return written;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Clip One Triangle Against the Cut and the Depth Plane
    // ------------------------------------------------------------
    // Leaves the surviving polygon in Na__PlSampler__Polygon and returns its
    // vertex count (0 when nothing survives). The cut crossing, if any, is
    // left in crossing with crossing.Count set.
    // ------------------------------------------------------------
    function Na__PlSampler__ClipTriangle(corners, cut, crossing) {
        if (crossing) crossing.Count = 0;
        if (!cut) {
            Na__PlSampler__Polygon.set(corners.subarray(0, 9), 0);
            return 3;
        }

        let count = Na__PlSampler__ClipPolygon(
            corners, 3, cut.NormalX, cut.NormalY, cut.NormalZ, cut.DistanceUnits, Na__PlSampler__Scratch, crossing
        );
        if (count < 3) return 0;

        if (Number.isFinite(cut.DepthUnits) && cut.DepthUnits > 0) {
            // The depth plane faces the other way: keep what is nearer than distance + depth.
            count = Na__PlSampler__ClipPolygon(
                Na__PlSampler__Scratch, count, -cut.NormalX, -cut.NormalY, -cut.NormalZ,
                -(cut.DistanceUnits + cut.DepthUnits), Na__PlSampler__Polygon, null
            );
            if (count < 3) return 0;
        } else {
            Na__PlSampler__Polygon.set(Na__PlSampler__Scratch.subarray(0, count * 3), 0);
        }
        return count;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read One Triangle Into Scene Space
    // ------------------------------------------------------------
    function Na__PlSampler__ReadTriangle(position, index, t, e, out) {
        for (let corner = 0; corner < 3; corner++) {
            const slot   = (t * 3) + corner;
            const vertex = index ? index.getX(slot) : slot;
            const x = position.getX(vertex), y = position.getY(vertex), z = position.getZ(vertex);
            const w = 1 / ((e[3] * x) + (e[7] * y) + (e[11] * z) + e[15]);
            const at = corner * 3;
            out[at]     = ((e[0] * x) + (e[4] * y) + (e[8]  * z) + e[12]) * w;
            out[at + 1] = ((e[1] * x) + (e[5] * y) + (e[9]  * z) + e[13]) * w;
            out[at + 2] = ((e[2] * x) + (e[6] * y) + (e[10] * z) + e[14]) * w;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Sampling
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Walk Every Triangle of the Occluders, Clipped
    // ------------------------------------------------------------
    // onPolygon(count, instance) is called with the clipped polygon in
    // Na__PlSampler__Polygon; onCrossing(crossing, instance) with each cut
    // outline segment. Shared by the count pass and the fill pass.
    // ------------------------------------------------------------
    function Na__PlSampler__Walk(instances, cut, onPolygon, onCrossing) {
        const crossing = new Float64Array(6);
        crossing.Count = 0;

        for (let m = 0; m < instances.length; m++) {
            const instance = instances[m];
            const geometry = instance.geometry;
            const position = geometry.attributes.position;
            const index    = geometry.index;
            const e        = instance.matrixWorld.elements;
            const triCount = Math.floor((index ? index.count : position.count) / 3);

            for (let t = 0; t < triCount; t++) {
                Na__PlSampler__ReadTriangle(position, index, t, e, Na__PlSampler__Corners);
                const count = Na__PlSampler__ClipTriangle(Na__PlSampler__Corners, cut, crossing);
                if (crossing.Count === 2 && onCrossing) onCrossing(crossing, instance);
                if (count >= 3 && instance.occludes && onPolygon) onPolygon(count, instance);
            }
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Read the Collected Instances Into Flat Triangle Arrays
    // ------------------------------------------------------------
    // cut is the drawing's cut (or null). Returns:
    //   Count, Vertices, Sides, Inverted   the OCCLUDER set, clipped
    //   Instances                          the EDGE set (every instance)
    //   SectionEdges                       scene space crossings of the cut, solids
    //   SectionEdgesLight                  crossings of transparent material
    //   TriangleTotal, OccluderCount
    // ------------------------------------------------------------
    function Na__PlSampler__Sample(collected, cut) {
        const instances = collected.Instances;

        let total         = 0;
        let occluderCount = 0;
        for (let m = 0; m < instances.length; m++) {
            const geometry = instances[m].geometry;
            total += Math.floor((geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3);
            if (instances[m].occludes) occluderCount++;
        }

        // PASS ONE | Count what survives the clip.
        let kept = 0;
        Na__PlSampler__Walk(instances, cut, (count) => { kept += count - 2; }, null);

        const vertices = new Float64Array(kept * 9);
        const sides    = new Uint8Array(kept);
        const inverted = new Uint8Array(kept);
        const sectionHeavy = [];
        const sectionLight = [];
        let   written  = 0;

        // PASS TWO | Fill, fan-triangulating each clipped polygon.
        Na__PlSampler__Walk(instances, cut,
            (count, instance) => {
                const poly       = Na__PlSampler__Polygon;
                const sideCode   = instance.side;
                const isMirrored = instance.matrixWorld.determinant() < 0 ? 1 : 0;
                for (let k = 1; k + 1 < count; k++) {
                    const out = written * 9;
                    vertices[out]     = poly[0];           vertices[out + 1] = poly[1];           vertices[out + 2] = poly[2];
                    vertices[out + 3] = poly[k * 3];       vertices[out + 4] = poly[k * 3 + 1];   vertices[out + 5] = poly[k * 3 + 2];
                    vertices[out + 6] = poly[(k + 1) * 3]; vertices[out + 7] = poly[(k + 1) * 3 + 1]; vertices[out + 8] = poly[(k + 1) * 3 + 2];
                    sides[written]    = sideCode;
                    inverted[written] = isMirrored;
                    written++;
                }
            },
            (crossing, instance) => {
                const target = instance.isTransparent ? sectionLight : sectionHeavy;
                target.push(crossing[0], crossing[1], crossing[2], crossing[3], crossing[4], crossing[5]);
            }
        );

        return {
            Count             : written,
            Vertices          : vertices,
            Sides             : sides,
            Inverted          : inverted,
            Instances         : instances,
            SectionEdges      : new Float64Array(sectionHeavy),
            SectionEdgesLight : new Float64Array(sectionLight),
            TriangleTotal     : total,
            OccluderCount     : occluderCount
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | How Many Triangles the Collected Instances Hold, Uncut
    // ------------------------------------------------------------
    // Cheap, so the pipeline can refuse a model that would take minutes
    // before any sampling starts.
    // ------------------------------------------------------------
    function Na__PlSampler__CountTriangles(collected) {
        let total = 0;
        const instances = collected ? collected.Instances : [];
        for (let m = 0; m < instances.length; m++) {
            const geometry = instances[m].geometry;
            total += Math.floor((geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3);
        }
        return total;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Projected Linework Stage Sampler API
    // ------------------------------------------------------------
    export {
        Na__PlSampler__Collect,
        Na__PlSampler__Sample,
        Na__PlSampler__CountTriangles,
        Na__PlSampler__NameMatches
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
