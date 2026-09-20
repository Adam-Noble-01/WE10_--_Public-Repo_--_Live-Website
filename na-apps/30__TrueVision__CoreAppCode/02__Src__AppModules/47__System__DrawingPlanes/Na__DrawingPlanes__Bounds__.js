// =============================================================================
// TRUEVISION3D - DRAWING PLANES - BOUNDS
// =============================================================================
//
// FILE       : Na__DrawingPlanes__Bounds__.js
// NAMESPACE  : Na__PlaneBounds
// MODULE     : Drawing Planes - Bounds
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Size a drawing plane from the building alone, and find the ground under a vertical one
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - THE LANDSCAPE IS NOT MEASURED. The old elevation gizmo sized itself from
//   the whole model, and on a real project the landscape is a slab tens of
//   metres across: PS01's is 80 m square and 5 m deep under an 11 m house, so
//   the plane came out 86 m wide and started 5 m underground. Here a plane is
//   sized from the BUILDING - the categories whose key holds a building token
//   - plus an overshoot that gives the corner grips room to be grabbed clear
//   of the building's outline.
//
// - THE LANDSCAPE IS A CUTTING PLANE, NOTHING ELSE. A vertical plane's bottom
//   edge sits a fixed lift above the highest point where the plane meets the
//   ground, inside the building's span. That is found exactly, by cutting the
//   ground's own triangles with the plane - a level slab and a sloping terrain
//   are the same code - and only flat-ish faces count, so a fence panel
//   modelled in the landscape cannot lift the edge to its top. Faces are
//   accepted whichever way they are wound: an exporter that reverses a face
//   would otherwise swap a slab's top for its underside.
//
// - MEASURED ONCE PER MODEL. The ground's triangles are lifted into world
//   space and kept, keyed by which category groups the model root holds, so a
//   drag asks only for one pass over a flat array. A Design Phase switch
//   changes that key and the next question measures again.
//
// - HIDDEN CATEGORIES STILL COUNT. A plane must not change size because the
//   roofs were switched off in the layer panel.
//
// - Returns FRAMES: the plane's bottom-left corner, a unit u along its width
//   and a unit v up its height, with u x v pointing at the viewer. See
//   Na__DrawingPlanes__Maths__ for why everything is laid out in that frame.
//
// INTEGRATION:
// - Na__DrawingPlanes__Overlay__ asks for a frame per shown plane.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (20-Sep-2026)
// - ValeVision    : not yet ported. Its category keys are shorter ("Landscape",
//                   "Walls"), so the two token lists in the config are the part
//                   that changes.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation for the Drawing Planes build.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js Core
    // ------------------------------------------------------------
    import * as THREE from 'three';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Drawing Planes Config and the Ground Cut
    // ------------------------------------------------------------
    // @delegate: ./Na__DrawingPlanes__ConfigState__.js
    // @delegate: ./Na__DrawingPlanes__Maths__.js
    // ------------------------------------------------------------
    import { Na__PlaneCfg__GetBoundsSetup } from './Na__DrawingPlanes__ConfigState__.js';
    import { Na__PlaneMath__GroundLevel } from './Na__DrawingPlanes__Maths__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The One Cached Measurement
    // ------------------------------------------------------------
    let Na__PlaneBounds__CacheKey   = null;   // <-- Which category groups the measured root held
    let Na__PlaneBounds__CacheValue = null;   // <-- { box, usedFallback, ground : Float32Array, groundTriangles }
    // ------------------------------------------------------------

    // MODULE VARIABLES | Scratch Objects
    // ------------------------------------------------------------
    const Na__PlaneBounds__A      = new THREE.Vector3();
    const Na__PlaneBounds__B      = new THREE.Vector3();
    const Na__PlaneBounds__C      = new THREE.Vector3();
    const Na__PlaneBounds__Matrix = new THREE.Matrix4();
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Measuring the Model
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Does a Name Hold Any of a List of Tokens?
    // ------------------------------------------------------------
    function Na__PlaneBounds__HasToken(name, tokens) {
        const text = String(name || '').toLowerCase();
        for (let i = 0; i < tokens.length; i++) {
            if (text.indexOf(String(tokens[i]).toLowerCase()) !== -1) return true;
        }
        return false;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Key That Changes When the Model Root's Categories Do
    // ------------------------------------------------------------
    // Category groups are added to the root only once loaded, and a Design
    // Phase switch replaces them, so the list of child ids is the model's
    // identity as far as its bounds go.
    // ------------------------------------------------------------
    function Na__PlaneBounds__KeyOf(modelRoot) {
        const parts = [ modelRoot.uuid ];
        for (let i = 0; i < modelRoot.children.length; i++) parts.push(modelRoot.children[i].uuid);
        return parts.join('|');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Push One Mesh's Flat-ish Triangles, in World Space
    // ------------------------------------------------------------
    // matrix is the mesh's world matrix, or that times one instance's.
    // ------------------------------------------------------------
    function Na__PlaneBounds__PushTriangles(out, geometry, matrix, minNormalY) {
        const position = geometry.attributes ? geometry.attributes.position : null;
        if (!position) return;
        const index = geometry.index;
        const count = index ? index.count : position.count;

        for (let i = 0; i + 2 < count; i += 3) {
            const ia = index ? index.getX(i)     : i;
            const ib = index ? index.getX(i + 1) : i + 1;
            const ic = index ? index.getX(i + 2) : i + 2;

            Na__PlaneBounds__A.fromBufferAttribute(position, ia).applyMatrix4(matrix);
            Na__PlaneBounds__B.fromBufferAttribute(position, ib).applyMatrix4(matrix);
            Na__PlaneBounds__C.fromBufferAttribute(position, ic).applyMatrix4(matrix);

            // The Y of the face normal, without building the whole normal.
            const abx = Na__PlaneBounds__B.x - Na__PlaneBounds__A.x, aby = Na__PlaneBounds__B.y - Na__PlaneBounds__A.y, abz = Na__PlaneBounds__B.z - Na__PlaneBounds__A.z;
            const acx = Na__PlaneBounds__C.x - Na__PlaneBounds__A.x, acy = Na__PlaneBounds__C.y - Na__PlaneBounds__A.y, acz = Na__PlaneBounds__C.z - Na__PlaneBounds__A.z;
            const nx = (aby * acz) - (abz * acy);
            const ny = (abz * acx) - (abx * acz);
            const nz = (abx * acy) - (aby * acx);
            const length = Math.sqrt((nx * nx) + (ny * ny) + (nz * nz));
            if (!(length > 0)) continue;                                         // <-- A degenerate triangle has no face to stand on
            if (Math.abs(ny / length) < minNormalY) continue;                    // <-- Too steep to be ground; either winding accepted

            out.push(
                Na__PlaneBounds__A.x, Na__PlaneBounds__A.y, Na__PlaneBounds__A.z,
                Na__PlaneBounds__B.x, Na__PlaneBounds__B.y, Na__PlaneBounds__B.z,
                Na__PlaneBounds__C.x, Na__PlaneBounds__C.y, Na__PlaneBounds__C.z
            );
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Lift the Ground Categories' Triangles Into World Space
    // ------------------------------------------------------------
    function Na__PlaneBounds__CollectGround(groundGroups, minNormalY) {
        const out = [];
        for (let g = 0; g < groundGroups.length; g++) {
            groundGroups[g].traverse((child) => {
                if (!child.isMesh || !child.geometry) return;
                if (child.isInstancedMesh) {
                    for (let i = 0; i < child.count; i++) {
                        child.getMatrixAt(i, Na__PlaneBounds__Matrix);
                        Na__PlaneBounds__Matrix.premultiply(child.matrixWorld);
                        Na__PlaneBounds__PushTriangles(out, child.geometry, Na__PlaneBounds__Matrix, minNormalY);
                    }
                    return;
                }
                Na__PlaneBounds__PushTriangles(out, child.geometry, child.matrixWorld, minNormalY);
            });
        }
        return new Float32Array(out);
    }
    // ------------------------------------------------------------


    // FUNCTION | Measure the Building, and Keep the Ground's Triangles
    // ------------------------------------------------------------
    // Returns { box, usedFallback, ground, groundTriangles } or null when
    // nothing measurable is loaded. box is the building's bounds in scene
    // units; usedFallback says no category matched a building token and
    // everything that is not ground was measured instead, so a model that
    // does not follow the naming still gets a sensible plane.
    // ------------------------------------------------------------
    function Na__PlaneBounds__Measure(modelRoot) {
        if (!modelRoot) return null;

        const key = Na__PlaneBounds__KeyOf(modelRoot);
        if (key === Na__PlaneBounds__CacheKey) return Na__PlaneBounds__CacheValue;

        const setup = Na__PlaneCfg__GetBoundsSetup();
        modelRoot.updateMatrixWorld(true);

        const building     = new THREE.Box3();
        const everything   = new THREE.Box3();
        const groundGroups = [];
        const scratch      = new THREE.Box3();

        for (let i = 0; i < modelRoot.children.length; i++) {
            const child = modelRoot.children[i];
            if (Na__PlaneBounds__HasToken(child.name, setup.ignoreTokens)) continue;
            if (Na__PlaneBounds__HasToken(child.name, setup.groundTokens)) {
                groundGroups.push(child);                                        // <-- A cutting plane only: never measured
                continue;
            }

            scratch.makeEmpty().expandByObject(child);
            if (scratch.isEmpty()) continue;
            everything.union(scratch);
            if (Na__PlaneBounds__HasToken(child.name, setup.buildingTokens)) building.union(scratch);
        }

        const usedFallback = building.isEmpty();
        const box          = usedFallback ? everything : building;
        const ground       = Na__PlaneBounds__CollectGround(groundGroups, setup.groundMinNormalY);

        Na__PlaneBounds__CacheKey   = key;
        Na__PlaneBounds__CacheValue = box.isEmpty() ? null : {
            box             : box.clone(),
            usedFallback    : usedFallback,
            ground          : ground,
            groundTriangles : ground.length / 9
        };
        return Na__PlaneBounds__CacheValue;
    }
    // ------------------------------------------------------------


    // FUNCTION | Forget the Measurement
    // ------------------------------------------------------------
    // For a caller that knows the model moved without its categories changing.
    // ------------------------------------------------------------
    function Na__PlaneBounds__Invalidate() {
        Na__PlaneBounds__CacheKey   = null;
        Na__PlaneBounds__CacheValue = null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Frames
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | How Far a Plane Runs Past the Building
    // ------------------------------------------------------------
    function Na__PlaneBounds__Overshoot(setup, span) {
        return Math.max(setup.overshootUnits, span * setup.overshootFraction);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Frame of a Vertical Plane (an Elevation or a Section)
    // ------------------------------------------------------------
    // axes: { normalX, normalZ, rightX, rightZ } - the normal points from the
    // building toward the viewer, right reads left-to-right on the sheet.
    // distanceUnits is how far along the normal the plane sits from the world
    // origin. Returns { origin, u, v, width, height, span, groundUnits,
    // measured } - measured false when no model could be read and the
    // config's fallback size was used.
    // ------------------------------------------------------------
    function Na__PlaneBounds__FrameVertical(modelRoot, axes, distanceUnits) {
        const setup    = Na__PlaneCfg__GetBoundsSetup();
        const measured = Na__PlaneBounds__Measure(modelRoot);

        let centreRun = 0, halfSpan = setup.fallbackHalfSpanUnits, top = setup.fallbackHeightUnits, foot = 0;
        let span = setup.fallbackHalfSpanUnits * 2;

        if (measured) {
            const size   = measured.box.getSize(new THREE.Vector3());
            const centre = measured.box.getCenter(new THREE.Vector3());
            span = Math.max(size.x, size.z);
            const overshoot = Na__PlaneBounds__Overshoot(setup, span);

            centreRun = (centre.x * axes.rightX) + (centre.z * axes.rightZ);
            halfSpan  = (Math.abs(axes.rightX) * (size.x / 2)) + (Math.abs(axes.rightZ) * (size.z / 2)) + overshoot;
            top       = measured.box.max.y + overshoot;
            foot      = measured.box.min.y;
        }

        const groundUnits = measured
            ? Na__PlaneMath__GroundLevel(
                measured.ground, axes.normalX, axes.normalZ, distanceUnits,
                axes.rightX, axes.rightZ, centreRun - halfSpan, centreRun + halfSpan
            )
            : null;

        // The foot of the building stands in for ground the plane never met.
        let bottom = ((groundUnits !== null) ? groundUnits : foot) + setup.groundLiftUnits;
        if ((top - bottom) < setup.minPlaneHeightUnits) bottom = top - setup.minPlaneHeightUnits;

        const leftRun = centreRun - halfSpan;
        return {
            origin : new THREE.Vector3(
                (axes.rightX * leftRun) + (axes.normalX * distanceUnits),
                bottom,
                (axes.rightZ * leftRun) + (axes.normalZ * distanceUnits)
            ),
            u           : new THREE.Vector3(axes.rightX, 0, axes.rightZ),
            v           : new THREE.Vector3(0, 1, 0),
            width       : halfSpan * 2,
            height      : top - bottom,
            span        : span,
            groundUnits : groundUnits,
            measured    : Boolean(measured)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Frame of a Horizontal Plane (a Floor Plan's Cut)
    // ------------------------------------------------------------
    // Seen from above with north (-Z) up the sheet: u runs east, v runs north,
    // and u x v points up at the viewer. The origin is the south-west corner.
    // ------------------------------------------------------------
    function Na__PlaneBounds__FrameHorizontal(modelRoot, heightUnits) {
        const setup    = Na__PlaneCfg__GetBoundsSetup();
        const measured = Na__PlaneBounds__Measure(modelRoot);

        let minX = -setup.fallbackHalfSpanUnits, maxX = setup.fallbackHalfSpanUnits;
        let minZ = -setup.fallbackHalfSpanUnits, maxZ = setup.fallbackHalfSpanUnits;
        let span = setup.fallbackHalfSpanUnits * 2;

        if (measured) {
            const size = measured.box.getSize(new THREE.Vector3());
            span = Math.max(size.x, size.z);
            const overshoot = Na__PlaneBounds__Overshoot(setup, span);
            minX = measured.box.min.x - overshoot; maxX = measured.box.max.x + overshoot;
            minZ = measured.box.min.z - overshoot; maxZ = measured.box.max.z + overshoot;
        }

        return {
            origin      : new THREE.Vector3(minX, heightUnits, maxZ),
            u           : new THREE.Vector3(1, 0, 0),
            v           : new THREE.Vector3(0, 0, -1),
            width       : maxX - minX,
            height      : maxZ - minZ,
            span        : span,
            groundUnits : null,
            measured    : Boolean(measured)
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Drawing Planes Bounds API
    // ------------------------------------------------------------
    export {
        Na__PlaneBounds__Measure,
        Na__PlaneBounds__Invalidate,
        Na__PlaneBounds__FrameVertical,
        Na__PlaneBounds__FrameHorizontal
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
