// =============================================================================
// TRUEVISION3D - ELEVATION VIEWS - PLANE GIZMO
// =============================================================================
//
// FILE       : Na__Elevation__PlaneGizmo__.js
// NAMESPACE  : Na__ElevGizmo
// MODULE     : Elevation Views - Plane Gizmo
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Show where an elevation's drawing plane sits, live, in the 3D view
// CREATED    : 07-Sep-2026
//
// DESCRIPTION:
// - Setting up an elevation is otherwise a pair of numbers, and numbers alone
//   make you guess. This is the answer to that: a translucent plane in the 3D
//   view, updated on every slider input, showing exactly where the drawing
//   plane sits and which way it faces before anything is previewed.
//
// - IT IS A READOUT, NOT A HANDLE. The ValeVision elevation tool made the
//   plane the input - click a face, then drag the plane along its normal - and
//   that is precisely the part worth not repeating: picking depends on there
//   being a suitable face to hit, dragging has no numeric feedback, and
//   neither survives the model being re-exported. Here the numbers are the
//   input and the gizmo only reflects them, so an elevation is reproducible,
//   type-able and diff-able.
//
// - Sized from the model bounds plus a margin rather than from a fixed size,
//   so it reads correctly on a garden room and on a full house. The arrows
//   point the way the viewer will be looking.
//
// - The meshes are put on LAYER 1, the same layer the AO-exempt geometry uses.
//   That layer is switched off for the profile-line normals pass, so the
//   Sobel edge detector never draws an outline around a helper. Without it the
//   gizmo would acquire a hard black border and read as real building fabric.
//
// - HIDDEN the moment a drawing opens, and DISPOSED when the panel closes.
//   Hidden rather than disposed on preview because the author is very likely
//   to come straight back to the sliders, and rebuilding the geometry on every
//   preview would churn buffers for nothing. Disposed on close because that is
//   the real end of authoring. Either way it is never visible over a drawing -
//   a translucent plane hanging in front of an elevation would print.
//
// INTEGRATION:
// - Na__Elevation__DevMenu__Editor__ shows it while a row is being edited,
//   hides it on preview and on delete, and disposes it when the panel closes.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Sep-2026 - Version 1.0.0
// - Initial implementation for the Elevation Drawings build.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js Core
    // ------------------------------------------------------------
    import * as THREE from 'three';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Render Loop and Math Utilities
    // ------------------------------------------------------------
    import { Na__RenderLoop__RequestRender } from '../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    import { Na__Math__ConvertMmToUnits } from '../04__MathUtils/Na__Math__Units.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Elevation Config and Derived Geometry
    // ------------------------------------------------------------
    // @delegate: ./Na__Elevation__ConfigState__.js
    // @delegate: ./Na__Elevation__ProjectJson__Data__.js
    // ------------------------------------------------------------
    import { Na__ElevCfg__GetGizmoSetup } from './Na__Elevation__ConfigState__.js';
    import {
        Na__ElevData__GetAxes,
        Na__ElevData__GetPlaneDistanceMm,
        Na__ElevData__IsSection
    } from './Na__Elevation__ProjectJson__Data__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Object Naming and Fallback Size
    // ------------------------------------------------------------
    const Na__ElevGizmo__GROUP_NAME  = 'Na__Elevation__PlaneGizmo';
    const Na__ElevGizmo__HELPER_LAYER = 1;                                       // <-- Excluded from the profile-line normals pass
    const Na__ElevGizmo__FALLBACK_HALF_SPAN_UNITS = 10;                          // <-- 10 m either way when no model is measurable
    const Na__ElevGizmo__FALLBACK_HALF_TALL_UNITS = 5;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Scene Reference and Built Objects
    // ------------------------------------------------------------
    let Na__ElevGizmo__Scene     = null;   // <-- Scene the gizmo is added to
    let Na__ElevGizmo__Group     = null;   // <-- Root group, or null when not shown
    let Na__ElevGizmo__FaceMesh  = null;   // <-- Translucent quad on the plane
    let Na__ElevGizmo__EdgeLine  = null;   // <-- Outline around the quad
    let Na__ElevGizmo__Arrows    = [];     // <-- Direction arrows at the corners
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Geometry Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Work Out the Quad's Four World Corners
    // ------------------------------------------------------------
    // Corners are built in the ELEVATION's own axes and then lifted into the
    // world, which is the same mapping the drawing itself uses - so what the
    // gizmo shows and what the drawing shows cannot disagree.
    // ------------------------------------------------------------
    function Na__ElevGizmo__BuildCorners(elevation, boundingBox) {
        const setup = Na__ElevCfg__GetGizmoSetup();
        const axes  = Na__ElevData__GetAxes(elevation);
        const distU = Na__Math__ConvertMmToUnits(Na__ElevData__GetPlaneDistanceMm(elevation));

        let halfSpan   = Na__ElevGizmo__FALLBACK_HALF_SPAN_UNITS;
        let halfTall   = Na__ElevGizmo__FALLBACK_HALF_TALL_UNITS;
        let centreRun  = 0;
        let centreTall = halfTall;

        if (boundingBox && !boundingBox.isEmpty()) {
            const size   = boundingBox.getSize(new THREE.Vector3());
            const centre = boundingBox.getCenter(new THREE.Vector3());

            halfSpan = (Math.abs(axes.rightX) * (size.x / 2))
                     + (Math.abs(axes.rightZ) * (size.z / 2))
                     + setup.marginUnits;
            halfTall   = (size.y / 2) + setup.marginUnits;
            centreRun  = (centre.x * axes.rightX) + (centre.z * axes.rightZ);
            centreTall = centre.y;
        }

        // (run, height) -> world, with the plane's own distance along the normal
        const at = (run, height) => new THREE.Vector3(
            (axes.rightX * run) + (axes.normalX * distU),
            height,
            (axes.rightZ * run) + (axes.normalZ * distU)
        );

        return {
            axes        : axes,
            topLeft     : at(centreRun - halfSpan, centreTall + halfTall),
            topRight    : at(centreRun + halfSpan, centreTall + halfTall),
            bottomLeft  : at(centreRun - halfSpan, centreTall - halfTall),
            bottomRight : at(centreRun + halfSpan, centreTall - halfTall),
            arrowLength : setup.arrowLengthUnits
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write Four Corners Into a Two-Triangle Quad
    // ------------------------------------------------------------
    function Na__ElevGizmo__WriteQuad(geometry, corners) {
        const p = [
            corners.bottomLeft, corners.bottomRight, corners.topRight,
            corners.bottomLeft, corners.topRight,    corners.topLeft
        ];

        const positions = new Float32Array(p.length * 3);
        for (let i = 0; i < p.length; i++) {
            positions[(i * 3)]     = p[i].x;
            positions[(i * 3) + 1] = p[i].y;
            positions[(i * 3) + 2] = p[i].z;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.computeVertexNormals();
        geometry.attributes.position.needsUpdate = true;
        geometry.computeBoundingSphere();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write Four Corners Into a Closed Outline
    // ------------------------------------------------------------
    function Na__ElevGizmo__WriteOutline(geometry, corners) {
        const p = [corners.bottomLeft, corners.bottomRight, corners.topRight, corners.topLeft, corners.bottomLeft];

        const positions = new Float32Array(p.length * 3);
        for (let i = 0; i < p.length; i++) {
            positions[(i * 3)]     = p[i].x;
            positions[(i * 3) + 1] = p[i].y;
            positions[(i * 3) + 2] = p[i].z;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.attributes.position.needsUpdate = true;
        geometry.computeBoundingSphere();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Construction and Teardown
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Tag an Object as a Helper and Keep It Off the Sobel Pass
    // ------------------------------------------------------------
    function Na__ElevGizmo__MarkAsHelper(object) {
        object.layers.set(Na__ElevGizmo__HELPER_LAYER);                          // <-- Skipped by the profile-line normals capture
        object.userData.naSectionCutHelper = true;                               // <-- Never cut by the section engine
        object.renderOrder = 10;                                                 // <-- Drawn over the model, not fighting it in the depth buffer
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Gizmo Objects Once
    // ------------------------------------------------------------
    function Na__ElevGizmo__Build() {
        const setup = Na__ElevCfg__GetGizmoSetup();

        Na__ElevGizmo__Group = new THREE.Group();
        Na__ElevGizmo__Group.name = Na__ElevGizmo__GROUP_NAME;

        Na__ElevGizmo__FaceMesh = new THREE.Mesh(
            new THREE.BufferGeometry(),
            new THREE.MeshBasicMaterial({
                color       : new THREE.Color(setup.fillColour),
                opacity     : setup.fillOpacity,
                transparent : true,
                side        : THREE.DoubleSide,
                depthWrite  : false                                              // <-- Never occludes the building behind it
            })
        );
        Na__ElevGizmo__MarkAsHelper(Na__ElevGizmo__FaceMesh);

        Na__ElevGizmo__EdgeLine = new THREE.Line(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({
                color       : new THREE.Color(setup.edgeColour),
                transparent : true,
                opacity     : 0.9,
                depthWrite  : false
            })
        );
        Na__ElevGizmo__MarkAsHelper(Na__ElevGizmo__EdgeLine);

        Na__ElevGizmo__Group.add(Na__ElevGizmo__FaceMesh);
        Na__ElevGizmo__Group.add(Na__ElevGizmo__EdgeLine);
        Na__ElevGizmo__Scene.add(Na__ElevGizmo__Group);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Rebuild the Corner Arrows for a New Direction
    // ------------------------------------------------------------
    // ArrowHelper bakes its direction at construction, so a changed azimuth
    // needs new arrows rather than repositioned ones. There are only four.
    // ------------------------------------------------------------
    function Na__ElevGizmo__RebuildArrows(corners) {
        const setup = Na__ElevCfg__GetGizmoSetup();

        for (let i = 0; i < Na__ElevGizmo__Arrows.length; i++) {
            const arrow = Na__ElevGizmo__Arrows[i];
            Na__ElevGizmo__Group.remove(arrow);
            if (arrow.dispose) arrow.dispose();
        }
        Na__ElevGizmo__Arrows = [];

        // Pointing INTO the building - the direction the viewer will look.
        const direction = new THREE.Vector3(-corners.axes.normalX, 0, -corners.axes.normalZ).normalize();
        const colour    = new THREE.Color(setup.arrowColour).getHex();
        const origins   = [corners.topLeft, corners.topRight, corners.bottomLeft, corners.bottomRight];

        for (let i = 0; i < origins.length; i++) {
            const arrow = new THREE.ArrowHelper(
                direction, origins[i], corners.arrowLength, colour,
                corners.arrowLength * 0.3, corners.arrowLength * 0.15
            );
            arrow.traverse(Na__ElevGizmo__MarkAsHelper);
            Na__ElevGizmo__Group.add(arrow);
            Na__ElevGizmo__Arrows.push(arrow);
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Point the Gizmo at a Scene
    // ------------------------------------------------------------
    function Na__ElevGizmo__Initialize(scene) {
        Na__ElevGizmo__Scene = scene || null;
        return Na__ElevGizmo__Scene !== null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Show the Plane for One Elevation, or Move an Existing One
    // ------------------------------------------------------------
    // Safe to call on every slider input: the geometry is rewritten in place
    // rather than rebuilt, so dragging a plane through a house does not churn
    // buffers sixty times a second.
    // ------------------------------------------------------------
    function Na__ElevGizmo__Show(elevation, boundingBox) {
        if (!Na__ElevGizmo__Scene || !elevation) return false;
        if (!Na__ElevGizmo__Group) Na__ElevGizmo__Build();

        const setup   = Na__ElevCfg__GetGizmoSetup();
        const corners = Na__ElevGizmo__BuildCorners(elevation, boundingBox);

        Na__ElevGizmo__WriteQuad(Na__ElevGizmo__FaceMesh.geometry, corners);
        Na__ElevGizmo__WriteOutline(Na__ElevGizmo__EdgeLine.geometry, corners);
        Na__ElevGizmo__RebuildArrows(corners);

        // A section plane is about to remove building fabric, so it is
        // coloured as a cut rather than as a viewing direction.
        const isSection = Na__ElevData__IsSection(elevation);
        Na__ElevGizmo__FaceMesh.material.color.set(isSection ? setup.cutFaceColour : setup.fillColour);
        Na__ElevGizmo__FaceMesh.material.opacity = isSection ? setup.cutFaceOpacity : setup.fillOpacity;
        Na__ElevGizmo__EdgeLine.material.color.set(isSection ? setup.cutFaceColour : setup.edgeColour);

        Na__ElevGizmo__Group.visible = true;
        Na__RenderLoop__RequestRender();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Take the Plane Off the Screen
    // ------------------------------------------------------------
    function Na__ElevGizmo__Hide() {
        if (!Na__ElevGizmo__Group) return false;
        Na__ElevGizmo__Group.visible = false;
        Na__RenderLoop__RequestRender();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the Plane Currently Shown?
    // ------------------------------------------------------------
    function Na__ElevGizmo__IsVisible() {
        return Boolean(Na__ElevGizmo__Group && Na__ElevGizmo__Group.visible);
    }
    // ------------------------------------------------------------


    // FUNCTION | Remove the Gizmo Entirely and Release Its Geometry
    // ------------------------------------------------------------
    // Called when the drawing itself opens. A hidden object still costs a
    // traverse on every pass that walks the scene, and leaving it in place is
    // one refactor away from it being drawn onto a finished elevation.
    // ------------------------------------------------------------
    function Na__ElevGizmo__Dispose() {
        if (!Na__ElevGizmo__Group) return false;

        if (Na__ElevGizmo__Scene) Na__ElevGizmo__Scene.remove(Na__ElevGizmo__Group);

        Na__ElevGizmo__Group.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                for (let i = 0; i < materials.length; i++) materials[i].dispose();
            }
        });

        Na__ElevGizmo__Group    = null;
        Na__ElevGizmo__FaceMesh = null;
        Na__ElevGizmo__EdgeLine = null;
        Na__ElevGizmo__Arrows   = [];

        Na__RenderLoop__RequestRender();
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Elevation Plane Gizmo API
    // ------------------------------------------------------------
    export {
        Na__ElevGizmo__Initialize,
        Na__ElevGizmo__Show,
        Na__ElevGizmo__Hide,
        Na__ElevGizmo__IsVisible,
        Na__ElevGizmo__Dispose
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
