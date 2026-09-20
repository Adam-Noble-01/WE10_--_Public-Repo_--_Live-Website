// =============================================================================
// TRUEVISION3D - NORTH DIRECTION - COMPASS GIZMO
// =============================================================================
//
// FILE       : Na__North__CompassGizmo__.js
// NAMESPACE  : Na__NorthGizmo
// MODULE     : North Direction - Compass Gizmo
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Draw the compass in the 3D view: a flat rose on the ground whose red needle points at true north
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - A ring, eight ticks, a two-colour needle and an N beyond the ring, lying
//   flat at the height of the point it was drawn from. It is the same north
//   point the Scrapbook puts on a site plan - grey ring, red north half, N at
//   the top - so what is pointed at in the model and what is later printed on
//   the sheet are recognisably one thing.
// - BUILT ONCE AT A RADIUS OF ONE, POINTING DOWN -Z, and from then on only
//   moved, turned and scaled. Aiming the needle turns the group sixty times a
//   second; nothing is rebuilt to do it.
// - TURNING. A bearing is clockwise seen from above, and a positive turn about
//   +Y is anticlockwise seen from above, so the group's turn is the bearing
//   negated. Turned by -b, the needle's -Z becomes (sin b, -cos b), which is
//   exactly Na__NorthMath__VectorOfBearing(b).
// - DRAWN OVER THE MODEL, NOT HIDDEN BY IT. A compass set down beside a house
//   is behind a wall from most angles; depth testing is off so it always
//   reads. It lives in the scene outside the model root, so category toggles,
//   walk collision, bounds measuring and the phase library never see it, and
//   it carries the same three helper marks as the elevation plane: layer 1
//   (skipped by the profile-line normals pass), naSectionCutHelper (never cut)
//   and a late render order.
// - AN INTERACTIVE OVERLAY, so it can be LEFT SWITCHED ON. It used to be
//   removed outright when the panel closed, because a compass left in the
//   scene would be drawn onto the next elevation rendered for a sheet. That is
//   now the render loop's job: the group is registered with
//   Na__InteractiveOverlays and is invisible to every render but the live 3D
//   frame, so Show says WANTED and object.visible is never touched here.
// - IsKept / SetKept are the Show Compass toggle, kept in the browser. This
//   module only records what is wanted; where the compass stands and when it
//   goes up is Na__North__DevMenu__Editor__'s, which alone holds north.
//
// INTEGRATION:
// - Na__North__DevMenu__Editor__ shows, aims and disposes it.
// - Initialised from index.html with the scene.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (19-Sep-2026)
// - ValeVision    : 1.1.0 ported 20-Sep-2026 as ValeVision3D v2.67.0, adapted: ValeVision has
//                   no Na__InteractiveOverlays, so its compass is never kept - it is in the
//                   scene only while the panel is open. Port the registry, then take this whole.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.1.0
// - Registered as an interactive overlay and given the Show Compass toggle,
//   so the compass can be left up beside the drawing planes.
//
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation, after Na__Elevation__PlaneGizmo__.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js Core
    // ------------------------------------------------------------
    import * as THREE from 'three';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Render Loop, Compass Maths and Config
    // ------------------------------------------------------------
    // @delegate: ./Na__North__ConfigState__.js
    // ------------------------------------------------------------
    import { Na__RenderLoop__RequestRender } from '../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    import {
        Na__InteractiveOverlays__Register,
        Na__InteractiveOverlays__Unregister,
        Na__InteractiveOverlays__SetWanted,
        Na__InteractiveOverlays__IsWanted
    } from '../05__RenderPipeline/Na__RenderLoop__InteractiveOverlays__.js';
    import { Na__NorthMath__Wrap } from './Na__North__Compass__.js';
    import { Na__NorthCfg__GetGizmoSetup } from './Na__North__ConfigState__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Object Naming, the Helper Layer and the Rose's Proportions
    // ------------------------------------------------------------
    // Every length is a fraction of the ring's radius, which is one.
    // ------------------------------------------------------------
    const Na__NorthGizmo__GROUP_NAME      = 'Na__North__CompassGizmo';
    const Na__NorthGizmo__SHOWN_STORE_KEY = 'Na__North__CompassShown';           // <-- The Show Compass toggle, kept between visits
    const Na__NorthGizmo__HELPER_LAYER    = 1;                                   // <-- Excluded from the profile-line normals pass
    const Na__NorthGizmo__RING_SEGMENTS   = 96;
    const Na__NorthGizmo__NEEDLE_LENGTH   = 0.9;
    const Na__NorthGizmo__NEEDLE_HALF     = 0.14;
    const Na__NorthGizmo__TICK_CARDINAL   = 0.16;
    const Na__NorthGizmo__TICK_BETWEEN    = 0.08;
    const Na__NorthGizmo__LETTER_NEAR     = 1.1;                                 // <-- The foot of the N, beyond the ring
    const Na__NorthGizmo__LETTER_TALL     = 0.3;
    const Na__NorthGizmo__LETTER_HALF     = 0.11;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Scene Reference and Built Objects
    // ------------------------------------------------------------
    let Na__NorthGizmo__Scene     = null;   // <-- Scene the compass is added to
    let Na__NorthGizmo__Group     = null;   // <-- Root group, or null when not built
    let Na__NorthGizmo__Materials = [];     // <-- Every material, so aiming can fade them together
    let Na__NorthGizmo__Kept      = null;   // <-- The Show Compass toggle, read lazily so the config has had its chance to load
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Construction and Teardown
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Tag an Object as a Helper and Draw It Over the Model
    // ------------------------------------------------------------
    function Na__NorthGizmo__MarkAsHelper(object, order) {
        object.layers.set(Na__NorthGizmo__HELPER_LAYER);                         // <-- Skipped by the profile-line normals capture
        object.userData.naSectionCutHelper = true;                               // <-- Never cut by the section engine
        object.renderOrder = order;                                              // <-- With depth testing off, this is the only order there is
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Material That Ignores the Depth Buffer
    // ------------------------------------------------------------
    function Na__NorthGizmo__Material(kind, colour, opacity) {
        const options = { color : new THREE.Color(colour), transparent : true, opacity : opacity, depthTest : false, depthWrite : false };
        const material = (kind === 'line') ? new THREE.LineBasicMaterial(options) : new THREE.MeshBasicMaterial(Object.assign(options, { side : THREE.DoubleSide }));
        material.userData.naRestOpacity = opacity;                               // <-- What it goes back to when aiming ends
        Na__NorthGizmo__Materials.push(material);
        return material;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Geometry From a Flat List of [x, z] Points on the Ground Plane
    // ------------------------------------------------------------
    function Na__NorthGizmo__Flat(points) {
        const positions = new Float32Array(points.length * 3);
        for (let i = 0; i < points.length; i++) {
            positions[(i * 3)]     = points[i][0];
            positions[(i * 3) + 1] = 0;
            positions[(i * 3) + 2] = points[i][1];
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.computeBoundingSphere();
        return geometry;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Compass Once, at a Radius of One, North Down -Z
    // ------------------------------------------------------------
    function Na__NorthGizmo__Build() {
        const setup = Na__NorthCfg__GetGizmoSetup();
        Na__NorthGizmo__Materials = [];
        Na__NorthGizmo__Group = new THREE.Group();
        Na__NorthGizmo__Group.name = Na__NorthGizmo__GROUP_NAME;

        const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), Na__NorthGizmo__Material('mesh', setup.discColour, setup.discOpacity));
        Na__NorthGizmo__MarkAsHelper(disc, 10);

        const ringPoints = [];
        for (let i = 0; i < Na__NorthGizmo__RING_SEGMENTS; i++) {
            const a = (i / Na__NorthGizmo__RING_SEGMENTS) * Math.PI * 2;
            ringPoints.push([ Math.sin(a), -Math.cos(a) ]);
        }
        const ring = new THREE.LineLoop(Na__NorthGizmo__Flat(ringPoints), Na__NorthGizmo__Material('line', setup.ringColour, 1));
        Na__NorthGizmo__MarkAsHelper(ring, 11);

        const tickPoints = [];
        for (let i = 0; i < 8; i++) {
            const a     = (i / 8) * Math.PI * 2;
            const inner = 1 - ((i % 2 === 0) ? Na__NorthGizmo__TICK_CARDINAL : Na__NorthGizmo__TICK_BETWEEN);
            tickPoints.push([ Math.sin(a) * inner, -Math.cos(a) * inner ], [ Math.sin(a), -Math.cos(a) ]);
        }
        const ticks = new THREE.LineSegments(Na__NorthGizmo__Flat(tickPoints), Na__NorthGizmo__Material('line', setup.ringColour, 1));
        Na__NorthGizmo__MarkAsHelper(ticks, 11);

        const L = Na__NorthGizmo__NEEDLE_LENGTH, H = Na__NorthGizmo__NEEDLE_HALF;
        const north = new THREE.Mesh(Na__NorthGizmo__Flat([ [ 0, -L ], [ H, 0 ], [ -H, 0 ] ]), Na__NorthGizmo__Material('mesh', setup.northColour, 1));
        const south = new THREE.Mesh(Na__NorthGizmo__Flat([ [ 0,  L ], [ -H, 0 ], [ H, 0 ] ]), Na__NorthGizmo__Material('mesh', setup.southColour, 1));
        Na__NorthGizmo__MarkAsHelper(north, 12);
        Na__NorthGizmo__MarkAsHelper(south, 12);

        // THE N | Up the left stroke, down the diagonal, up the right stroke.
        // Seen from above with north up the screen, +X is to the right.
        const foot = -Na__NorthGizmo__LETTER_NEAR, head = foot - Na__NorthGizmo__LETTER_TALL, half = Na__NorthGizmo__LETTER_HALF;
        const letter = new THREE.Line(Na__NorthGizmo__Flat([ [ -half, foot ], [ -half, head ], [ half, foot ], [ half, head ] ]), Na__NorthGizmo__Material('line', setup.letterColour, 1));
        Na__NorthGizmo__MarkAsHelper(letter, 12);

        [ disc, ring, ticks, south, north, letter ].forEach((object) => Na__NorthGizmo__Group.add(object));
        Na__NorthGizmo__Scene.add(Na__NorthGizmo__Group);
        Na__InteractiveOverlays__Register(Na__NorthGizmo__Group);                // <-- Invisible from here on, except inside an interactive 3D frame
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Show Compass Toggle
// -----------------------------------------------------------------------------

    // FUNCTION | Is the Compass Being Kept in the View?
    // ------------------------------------------------------------
    // Kept means: up whether or not the North Direction panel is open, the
    // way a drawing plane that has been switched on stays up. The browser
    // remembers it, so it survives a reload; with nothing remembered the
    // config's own default answers.
    // ------------------------------------------------------------
    function Na__NorthGizmo__IsKept() {
        if (Na__NorthGizmo__Kept !== null) return Na__NorthGizmo__Kept;
        Na__NorthGizmo__Kept = Na__NorthCfg__GetGizmoSetup().shownByDefault === true;
        try {
            const stored = window.localStorage.getItem(Na__NorthGizmo__SHOWN_STORE_KEY);
            if (stored === 'true' || stored === 'false') Na__NorthGizmo__Kept = (stored === 'true');
        } catch (error) { /* A browser that refuses storage still toggles, for this visit only */ }
        return Na__NorthGizmo__Kept;
    }
    // ------------------------------------------------------------


    // FUNCTION | Keep the Compass in the View, or Stop Keeping It
    // ------------------------------------------------------------
    // Says only what is wanted. Putting the compass up or taking it down is
    // the Dev menu editor's, which alone knows where north stands.
    // ------------------------------------------------------------
    function Na__NorthGizmo__SetKept(kept) {
        Na__NorthGizmo__Kept = (kept === true);
        try { window.localStorage.setItem(Na__NorthGizmo__SHOWN_STORE_KEY, String(Na__NorthGizmo__Kept)); } catch (error) { /* Session only */ }
        return Na__NorthGizmo__Kept;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Point the Gizmo at a Scene
    // ------------------------------------------------------------
    function Na__NorthGizmo__Initialize(scene) {
        Na__NorthGizmo__Scene = scene || null;
        return Na__NorthGizmo__Scene !== null;
    }
    // ------------------------------------------------------------


    // FUNCTION | How Large the Compass Should Be for a Model
    // ------------------------------------------------------------
    // A fraction of the model's larger horizontal span, held between the
    // config's two limits; the fallback when nothing measurable is loaded.
    // Scene units.
    // ------------------------------------------------------------
    function Na__NorthGizmo__RadiusFor(boundingBox) {
        const setup = Na__NorthCfg__GetGizmoSetup();
        if (!boundingBox || boundingBox.isEmpty()) return setup.fallbackRadiusUnits;
        const size = boundingBox.getSize(new THREE.Vector3());
        return Math.min(setup.maxRadiusUnits, Math.max(setup.minRadiusUnits, Math.max(size.x, size.z) * setup.radiusFraction));
    }
    // ------------------------------------------------------------


    // FUNCTION | Show the Compass, or Move, Turn and Size the One That Is Up
    // ------------------------------------------------------------
    // origin is { x, y, z } in scene units. aiming fades the whole compass
    // while its needle is still following the pointer. Safe to call on every
    // pointer move: nothing is rebuilt.
    // ------------------------------------------------------------
    function Na__NorthGizmo__Show(origin, bearingDeg, radiusUnits, aiming) {
        if (!Na__NorthGizmo__Scene || !origin) return false;
        if (!Na__NorthGizmo__Group) Na__NorthGizmo__Build();

        const setup  = Na__NorthCfg__GetGizmoSetup();
        const radius = (Number.isFinite(radiusUnits) && radiusUnits > 0) ? radiusUnits : setup.fallbackRadiusUnits;
        Na__NorthGizmo__Group.position.set(origin.x, origin.y + setup.liftUnits, origin.z);
        Na__NorthGizmo__Group.rotation.set(0, -Na__NorthMath__Wrap(bearingDeg) * (Math.PI / 180), 0);   // <-- Clockwise seen from above is a negative turn about +Y
        Na__NorthGizmo__Group.scale.set(radius, 1, radius);
        Na__NorthGizmo__Materials.forEach((material) => { material.opacity = material.userData.naRestOpacity * (aiming ? setup.aimingOpacity : 1); });
        Na__InteractiveOverlays__SetWanted(Na__NorthGizmo__Group, true);         // <-- Wanted, not visible: the render loop alone sets visible, and only for the live 3D frame
        Na__RenderLoop__RequestRender();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Take the Compass Off the Screen
    // ------------------------------------------------------------
    function Na__NorthGizmo__Hide() {
        if (!Na__NorthGizmo__Group) return false;
        Na__InteractiveOverlays__SetWanted(Na__NorthGizmo__Group, false);
        Na__RenderLoop__RequestRender();
        return true;
    }
    function Na__NorthGizmo__IsVisible() {
        return Na__InteractiveOverlays__IsWanted(Na__NorthGizmo__Group);         // <-- Never object.visible: between frames that is always false
    }
    // ------------------------------------------------------------


    // FUNCTION | Remove the Compass Entirely and Release Its Geometry
    // ------------------------------------------------------------
    function Na__NorthGizmo__Dispose() {
        if (!Na__NorthGizmo__Group) return false;
        Na__InteractiveOverlays__Unregister(Na__NorthGizmo__Group);              // <-- Handed back invisible, before it leaves the scene
        if (Na__NorthGizmo__Scene) Na__NorthGizmo__Scene.remove(Na__NorthGizmo__Group);
        Na__NorthGizmo__Group.traverse((child) => { if (child.geometry) child.geometry.dispose(); });
        Na__NorthGizmo__Materials.forEach((material) => material.dispose());
        Na__NorthGizmo__Group     = null;
        Na__NorthGizmo__Materials = [];
        Na__RenderLoop__RequestRender();
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Compass Gizmo API
    // ------------------------------------------------------------
    export {
        Na__NorthGizmo__GROUP_NAME,
        Na__NorthGizmo__Initialize,
        Na__NorthGizmo__IsKept,
        Na__NorthGizmo__SetKept,
        Na__NorthGizmo__RadiusFor,
        Na__NorthGizmo__Show,
        Na__NorthGizmo__Hide,
        Na__NorthGizmo__IsVisible,
        Na__NorthGizmo__Dispose
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
