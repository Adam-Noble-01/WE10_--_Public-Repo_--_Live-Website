// =============================================================================
// TRUEVISION3D - DRAWING VIEW CORE - ACTIVE VIEW BROKER
// =============================================================================
//
// FILE       : Na__DrawView__ActiveView__.js
// NAMESPACE  : Na__DrawView
// MODULE     : Drawing View Core - Active View Broker
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Name the one 2D drawing currently on screen and map its plane
// CREATED    : 07-Sep-2026
//
// DESCRIPTION:
// - TrueVision now has TWO kinds of 2D drawing - a floor plan looking down and
//   an elevation looking sideways - and one set of markup systems that has to
//   draw on either. This module is the seam between them. It holds whichever
//   drawing currently owns the viewport and answers the only four questions
//   the markup layers ever ask:
//
//       which camera am I projecting through
//       how many scene units is one screen pixel
//       where on screen does this stored point land
//       what point did the pointer just land on
//
// - THE DRAWING PLANE IS ALWAYS TWO AXES, NEVER THREE. Every markup record -
//   a label, a dimension endpoint - stores exactly two millimetre values, and
//   the ACTIVE VIEW decides what they mean in the world:
//
//       Floor plan   axis 1 = world X          axis 2 = world Z
//       Elevation    axis 1 = the horizontal   axis 2 = height above the
//                            run along the             elevation datum
//                            elevation
//
//   Axis 1 always reads left-to-right on screen. Axis 2 reads DOWN the sheet
//   on a plan (world +Z is toward the bottom of a north-up plan) and UP the
//   sheet on an elevation (a height is a height). Each adapter owns that sign
//   so no markup module ever has to know which drawing it is on.
//
// - THE STORED FIELD NAMES STILL SAY X AND Z. They were named when a floor
//   plan was the only drawing there was, and on a plan they are literally
//   world X and world Z. Renaming them would mean migrating every project's
//   saved markup for no behavioural gain, so they were deliberately left
//   alone: read "...XMm" as drawing axis 1 and "...ZMm" as drawing axis 2.
//
// - The broker holds an ADAPTER, not a camera. Each drawing system supplies
//   the handful of closures below when it takes the viewport, which is what
//   keeps this module free of project data and of either camera module.
//
// INTEGRATION:
// - Na__FloorPlan__ModeController__ and Na__Elevation__ModeController__ call
//   SetActiveView on entering and ClearActiveView on leaving.
// - Na__PlanAnnotations__Overlay__, Na__PlanDimensions__Overlay__ and
//   Na__PlanDimensions__VertexEditor__ project through here.
// - Na__DrawView__Navigation__ pans and zooms through here.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Sep-2026 - Version 1.0.0
// - Initial implementation for the Elevation Drawings build. Extracted from the
//   direct Na__FpCam__ imports the markup layers previously carried, which tied
//   both of them to the floor plan camera specifically.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js Core
    // ------------------------------------------------------------
    // Needed for one scratch vector only. The broker builds no geometry and
    // owns no camera.
    // ------------------------------------------------------------
    import * as THREE from 'three';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Drawing Kinds
    // ------------------------------------------------------------
    const Na__DrawView__KIND_PLAN      = 'plan';
    const Na__DrawView__KIND_ELEVATION = 'elevation';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Broadcast Event Name
    // ------------------------------------------------------------
    // Fired whenever the viewport changes hands, so UI that only makes sense
    // over a drawing can show and hide itself without polling.
    // ------------------------------------------------------------
    const Na__DrawView__CHANGED_EVENT = 'na-drawing-view-changed';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Adapter Contract
    // ------------------------------------------------------------
    const Na__DrawView__REQUIRED_FNS = Object.freeze([
        'getCamera',
        'getUnitsPerPixel',
        'planeMmToWorldUnits',
        'screenOffsetToPlaneMm',
        'panByPlaneUnits',
        'zoomByFactor'
    ]);
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The One Active Drawing
    // ------------------------------------------------------------
    // Null means ordinary 3D owns the viewport. Every public getter below is a
    // safe no-op in that state rather than throwing, because the markup layers
    // are torn down asynchronously and can outlive the drawing by a frame.
    // ------------------------------------------------------------
    let Na__DrawView__Adapter = null;
    // ------------------------------------------------------------

    // MODULE VARIABLES | Scratch Objects (Allocation-Free Projection)
    // ------------------------------------------------------------
    const Na__DrawView__ScratchVec = new THREE.Vector3();
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Private Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Is a Supplied Adapter Structurally Usable?
    // ------------------------------------------------------------
    // Checked once on registration rather than on every projection call, so a
    // malformed adapter fails loudly at the moment it is installed instead of
    // silently drawing nothing sixty times a second.
    // ------------------------------------------------------------
    function Na__DrawView__IsValidAdapter(adapter) {
        if (!adapter || typeof adapter !== 'object') return false;

        for (let i = 0; i < Na__DrawView__REQUIRED_FNS.length; i++) {
            const name = Na__DrawView__REQUIRED_FNS[i];
            if (typeof adapter[name] !== 'function') {
                console.warn('[TrueVision3D] Drawing view adapter is missing ' + name + ' - not installed.');
                return false;
            }
        }
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Announce a Change of Drawing
    // ------------------------------------------------------------
    function Na__DrawView__Dispatch() {
        window.dispatchEvent(new CustomEvent(Na__DrawView__CHANGED_EVENT, {
            detail : {
                kind     : Na__DrawView__Adapter ? Na__DrawView__Adapter.kind : null,
                isActive : Na__DrawView__Adapter !== null
            }
        }));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Registration
// -----------------------------------------------------------------------------

    // FUNCTION | Hand the Viewport to a 2D Drawing
    // ------------------------------------------------------------
    // adapter: {
    //   kind                  : 'plan' | 'elevation'
    //   getCamera()           : the live THREE.OrthographicCamera, or null
    //   getUnitsPerPixel(h)   : scene units covered by one screen pixel
    //   planeMmToWorldUnits(axis1Mm, axis2Mm) : { x, y, z } in scene units
    //   screenOffsetToPlaneMm(offsetXPx, offsetYPx, unitsPerPixel)
    //                         : { posXMm, posZMm } - offsets are measured from
    //                           the CENTRE of the viewport, signed the way the
    //                           screen is (right positive, down positive)
    //   panByPlaneUnits(du, dv) : slide the camera across its own plane
    //   zoomByFactor(factor)    : multiply the parallel zoom
    //   onRelease()             : optional - tear this drawing down because
    //                             another one is taking the viewport
    // }
    // ------------------------------------------------------------
    function Na__DrawView__SetActiveView(adapter) {
        if (!Na__DrawView__IsValidAdapter(adapter)) return false;

        Na__DrawView__Adapter = adapter;
        Na__DrawView__Dispatch();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Hand the Viewport Back to 3D
    // ------------------------------------------------------------
    function Na__DrawView__ClearActiveView() {
        if (!Na__DrawView__Adapter) return false;
        Na__DrawView__Adapter = null;
        Na__DrawView__Dispatch();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Make a Different Kind of Drawing Stand Down First
    // ------------------------------------------------------------
    // THERE IS ONE ANNOTATION LAYER AND ONE DIMENSION LAYER IN THE WHOLE APP.
    // Both are singletons bound to whatever mounted them last, so a plan and
    // an elevation cannot be up at the same time - the second to mount would
    // silently inherit the first one's undo stack and hotkeys, and the first
    // would never be torn down.
    //
    // Rather than have the two controllers import and police each other, the
    // incoming one calls this: the outgoing drawing is told to release, and
    // because the broker already knows who holds the viewport, neither
    // controller needs to know the other exists.
    //
    // The adapter is cleared BEFORE onRelease runs, so the outgoing teardown
    // calling ClearActiveView is a harmless no-op rather than a re-entrant
    // second release.
    // ------------------------------------------------------------
    function Na__DrawView__ReleaseOtherKind(incomingKind) {
        if (!Na__DrawView__Adapter) return false;
        if (Na__DrawView__Adapter.kind === incomingKind) return false;            // <-- Same kind: it is swapping pages, not handing over

        const outgoing = Na__DrawView__Adapter;
        Na__DrawView__Adapter = null;

        if (typeof outgoing.onRelease === 'function') outgoing.onRelease();
        Na__DrawView__Dispatch();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a 2D Drawing Currently on Screen?
    // ------------------------------------------------------------
    function Na__DrawView__IsActive() {
        return Na__DrawView__Adapter !== null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Kind of Drawing Is on Screen (null When None)
    // ------------------------------------------------------------
    function Na__DrawView__GetKind() {
        return Na__DrawView__Adapter ? Na__DrawView__Adapter.kind : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Camera and Scale
// -----------------------------------------------------------------------------

    // FUNCTION | The Orthographic Camera the Drawing Is Seen Through
    // ------------------------------------------------------------
    function Na__DrawView__GetCamera() {
        if (!Na__DrawView__Adapter) return null;
        return Na__DrawView__Adapter.getCamera();
    }
    // ------------------------------------------------------------


    // FUNCTION | How Many Scene Units One Screen Pixel Covers
    // ------------------------------------------------------------
    // Under a parallel projection this is constant across the whole viewport,
    // which is what lets the markup layers size text in real millimetres and
    // lets a drag track the cursor exactly rather than drifting at the edges.
    // Returns 0 when no drawing is active, which every caller already treats
    // as "nothing to draw yet".
    // ------------------------------------------------------------
    function Na__DrawView__GetUnitsPerPixel(viewportHeightPx) {
        if (!Na__DrawView__Adapter) return 0;
        return Na__DrawView__Adapter.getUnitsPerPixel(viewportHeightPx) || 0;
    }
    // ------------------------------------------------------------


// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Plane Mapping
// -----------------------------------------------------------------------------

    // FUNCTION | Lift a Stored Drawing Point Into the World
    // ------------------------------------------------------------
    // axis1Mm reads left-to-right on the sheet; what axis2Mm means is the
    // active drawing's business, not the caller's - see the header table.
    // ------------------------------------------------------------
    function Na__DrawView__PlaneMmToWorldUnits(axis1Mm, axis2Mm) {
        if (!Na__DrawView__Adapter) return null;
        if (!Number.isFinite(axis1Mm) || !Number.isFinite(axis2Mm)) return null;
        return Na__DrawView__Adapter.planeMmToWorldUnits(axis1Mm, axis2Mm);
    }
    // ------------------------------------------------------------


    // FUNCTION | Project a Stored Drawing Point Onto the Screen
    // ------------------------------------------------------------
    // Returns { x, y } in CSS pixels relative to the viewport's top-left, so a
    // DOM node or an SVG line can be positioned straight onto it.
    // ------------------------------------------------------------
    function Na__DrawView__ProjectPlaneMm(axis1Mm, axis2Mm, viewportWidth, viewportHeight) {
        const camera = Na__DrawView__GetCamera();
        if (!camera) return null;

        const world = Na__DrawView__PlaneMmToWorldUnits(axis1Mm, axis2Mm);
        if (!world) return null;

        Na__DrawView__ScratchVec.set(world.x, world.y, world.z).project(camera);

        return {
            x : (Na__DrawView__ScratchVec.x + 1) * 0.5 * viewportWidth,
            y : (1 - Na__DrawView__ScratchVec.y) * 0.5 * viewportHeight
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Convert a Pointer Position Into a Drawing Point
    // ------------------------------------------------------------
    // hostElement is whatever the markup layer is mounted over; the client
    // rectangle is read from it here so no caller has to remember the header
    // offset. The offset from the viewport CENTRE is what the adapter is given,
    // because under a parallel projection that converts to a plane offset
    // without a ray solve.
    // ------------------------------------------------------------
    function Na__DrawView__ScreenToPlaneMm(clientX, clientY, hostElement) {
        if (!Na__DrawView__Adapter || !hostElement) return null;

        const width  = hostElement.clientWidth  || window.innerWidth;
        const height = hostElement.clientHeight || window.innerHeight;
        const upp    = Na__DrawView__GetUnitsPerPixel(height);
        if (!upp) return null;

        const rect    = hostElement.getBoundingClientRect();
        const offsetX = (clientX - rect.left) - (width  / 2);
        const offsetY = (clientY - rect.top)  - (height / 2);

        return Na__DrawView__Adapter.screenOffsetToPlaneMm(offsetX, offsetY, upp);
    }
    // ------------------------------------------------------------


// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Navigation Passthrough
// -----------------------------------------------------------------------------

    // FUNCTION | Slide the Drawing Across Its Own Plane
    // ------------------------------------------------------------
    // du and dv are scene units signed the way the SCREEN is: du positive
    // moves the camera right, dv positive moves it down the sheet. Each
    // adapter turns that into the world motion its own projection needs.
    // ------------------------------------------------------------
    function Na__DrawView__PanByPlaneUnits(du, dv) {
        if (!Na__DrawView__Adapter) return;
        Na__DrawView__Adapter.panByPlaneUnits(du, dv);
    }
    // ------------------------------------------------------------


    // FUNCTION | Multiply the Parallel Zoom
    // ------------------------------------------------------------
    function Na__DrawView__ZoomByFactor(factor) {
        if (!Na__DrawView__Adapter) return;
        Na__DrawView__Adapter.zoomByFactor(factor);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Active Drawing View API
    // ------------------------------------------------------------
    export {
        Na__DrawView__KIND_PLAN,
        Na__DrawView__KIND_ELEVATION,
        Na__DrawView__CHANGED_EVENT,
        Na__DrawView__SetActiveView,
        Na__DrawView__ClearActiveView,
        Na__DrawView__ReleaseOtherKind,
        Na__DrawView__IsActive,
        Na__DrawView__GetKind,
        Na__DrawView__GetCamera,
        Na__DrawView__GetUnitsPerPixel,
        Na__DrawView__PlaneMmToWorldUnits,
        Na__DrawView__ProjectPlaneMm,
        Na__DrawView__ScreenToPlaneMm,
        Na__DrawView__PanByPlaneUnits,
        Na__DrawView__ZoomByFactor
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
