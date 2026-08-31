// =============================================================================
// TRUEVISION3D - PLAN DIMENSIONS - WORKING PLANE AND SNAP GRID
// =============================================================================
//
// FILE       : Na__PlanDimensions__Grid__.js
// NAMESPACE  : Na__PlanDimGrid
// MODULE     : Plan Dimensions - Working Plane and Snap Grid
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Measure the scene, define the dimension plane, snap to the grid
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - A dimension is only worth drawing if the number on it is trustworthy, so
//   every endpoint is rounded onto a fixed grid before it is ever stored. At
//   the default 5 mm step an endpoint lands within 2.5 mm of the click, and
//   two endpoints on the same wall face therefore report an identical figure
//   however shakily each was picked.
//
// - THE GRID IS ANCHORED AT THE WORLD ORIGIN, NOT AT THE MODEL BOUNDS.
//   This is the single most important decision in this module. Anchoring to
//   the bounding box would look tidier, but the box moves the moment a model
//   is re-exported with a different amount of site or planting around it -
//   and every stored dimension would then silently land half a step off the
//   wall it was measured against. A world-origin grid is reproducible across
//   re-exports, across model groups, and across projects.
//
// - The model IS measured, but for extent rather than for origin: the plane
//   it produces bounds how far a dimension may sensibly be placed, and gives
//   the UI something to sanity-check a pick against. A stray click far out in
//   empty space is rejected rather than stored as a 400 m dimension.
//
// - "Plane" here is both descriptive and literal. The descriptor carries the
//   grid, the extent and the cut height; it also carries a real THREE.Plane
//   sitting at the dimension height, so a future raycast picker or an image
//   exporter has the actual mathematical surface to work against rather than
//   having to rebuild it from loose numbers.
//
// - Height is deliberately absent from the snap. Plan dimensions are measured
//   on the X/Z ground plane - the "XY" of the drawing sheet - and the Y value
//   only positions the plane in the scene. Snapping Y would be meaningless.
//
// INTEGRATION:
// - Na__PlanDimensions__Data__ configures this from the AppConfig grid block.
// - Na__FloorPlan__ModeController__ calls EstablishPlane when a plan opens.
// - Na__PlanDimensions__Editor__ snaps every pick through SnapPointMm.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 31-Aug-2026 - Version 1.0.0
// - Initial implementation for the Floor Plan Builder dimensioning system.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js Core
    // ------------------------------------------------------------
    import * as THREE from 'three';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Math Utilities
    // ------------------------------------------------------------
    import { Na__Math__ConvertUnitsToMm } from '../04__MathUtils/Na__Math__Units.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Grid Fallbacks (used until Configure supplies real values)
    // ------------------------------------------------------------
    const Na__PlanDimGrid__FALLBACKS = {
        snapStepMm        : 5,          // <-- The stated "within 5 mm" tolerance
        measurementSnapMm : 5,          // <-- Reported length rounding
        originXMm         : 0,          // <-- World origin anchor
        originZMm         : 0,
        planeMarginMm     : 5000,       // <-- Slack around the model footprint
        maxSpanMm         : 500000,     // <-- 500 m; beyond this a pick is a mis-click
        minSpanMm         : 5           // <-- One grid step; below this there is nothing to measure
    };
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Axis Identifiers
    // ------------------------------------------------------------
    const Na__PlanDimGrid__AXIS_X    = 'x';        // <-- Locked to world X (reads horizontal on the plan)
    const Na__PlanDimGrid__AXIS_Z    = 'z';        // <-- Locked to world Z (reads vertical on the plan)
    const Na__PlanDimGrid__AXIS_FREE = 'free';     // <-- Aligned dimension, follows the picked direction
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Live Grid Setup and Established Plane
    // ------------------------------------------------------------
    let Na__PlanDimGrid__Setup = { ...Na__PlanDimGrid__FALLBACKS };  // <-- Active grid numbers
    let Na__PlanDimGrid__Plane = null;                               // <-- Established plane descriptor (or null)
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Scratch Objects (avoid per-pick allocation)
    // ------------------------------------------------------------
    const Na__PlanDimGrid__ScratchBox = new THREE.Box3();            // <-- Reused: model world bounds
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Configuration
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Read a Positive Number or Fall Back
    // ------------------------------------------------------------
    function Na__PlanDimGrid__PositiveOr(value, fallback) {
        return (Number.isFinite(value) && value > 0) ? value : fallback;
    }
    // ------------------------------------------------------------


    // FUNCTION | Apply the Grid Block From AppConfig
    // ------------------------------------------------------------
    // Every field is optional; anything missing or nonsensical keeps its
    // fallback, so a partially written config can never leave the snap step at
    // zero and divide the whole system by nothing.
    // ------------------------------------------------------------
    function Na__PlanDimGrid__Configure(gridSetup) {
        const setup = gridSetup || {};

        Na__PlanDimGrid__Setup = {
            snapStepMm        : Na__PlanDimGrid__PositiveOr(setup.snapStepMm,        Na__PlanDimGrid__FALLBACKS.snapStepMm),
            measurementSnapMm : Na__PlanDimGrid__PositiveOr(setup.measurementSnapMm, Na__PlanDimGrid__FALLBACKS.measurementSnapMm),
            originXMm         : Number.isFinite(setup.originXMm) ? setup.originXMm : Na__PlanDimGrid__FALLBACKS.originXMm,
            originZMm         : Number.isFinite(setup.originZMm) ? setup.originZMm : Na__PlanDimGrid__FALLBACKS.originZMm,
            planeMarginMm     : Na__PlanDimGrid__PositiveOr(setup.planeMarginMm,     Na__PlanDimGrid__FALLBACKS.planeMarginMm),
            maxSpanMm         : Na__PlanDimGrid__PositiveOr(setup.maxSpanMm,         Na__PlanDimGrid__FALLBACKS.maxSpanMm),
            minSpanMm         : Na__PlanDimGrid__PositiveOr(setup.minSpanMm,         Na__PlanDimGrid__FALLBACKS.minSpanMm)
        };

        return { ...Na__PlanDimGrid__Setup };
    }
    // ------------------------------------------------------------


    // FUNCTION | Report the Active Grid Setup
    // ------------------------------------------------------------
    function Na__PlanDimGrid__GetSetup() {
        return { ...Na__PlanDimGrid__Setup };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Scene Measurement and Plane Construction
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Measure a Model Root's World Bounds in Millimetres
    // ------------------------------------------------------------
    // Box3.setFromObject walks arbitrarily deep component nesting and expands
    // InstancedMesh by each instance matrix, so a model whose geometry is
    // instanced is bounded where the instances actually are rather than at the
    // node origin. Returns null when nothing measurable is present, which is
    // the ordinary case before any model has loaded.
    // ------------------------------------------------------------
    function Na__PlanDimGrid__MeasureModelMm(modelRoot) {
        if (!modelRoot) return null;

        Na__PlanDimGrid__ScratchBox.setFromObject(modelRoot);
        if (Na__PlanDimGrid__ScratchBox.isEmpty()) return null;

        return {
            minXMm : Na__Math__ConvertUnitsToMm(Na__PlanDimGrid__ScratchBox.min.x),
            maxXMm : Na__Math__ConvertUnitsToMm(Na__PlanDimGrid__ScratchBox.max.x),
            minYMm : Na__Math__ConvertUnitsToMm(Na__PlanDimGrid__ScratchBox.min.y),
            maxYMm : Na__Math__ConvertUnitsToMm(Na__PlanDimGrid__ScratchBox.max.y),
            minZMm : Na__Math__ConvertUnitsToMm(Na__PlanDimGrid__ScratchBox.min.z),
            maxZMm : Na__Math__ConvertUnitsToMm(Na__PlanDimGrid__ScratchBox.max.z)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Establish the Dimension Working Plane for a Plan
    // ------------------------------------------------------------
    // Measures the loaded model to size the plane, then parks that plane at
    // the supplied height (the plan's cut height, less whatever offset the
    // layer config asks for, so dimensions sit just under the camera in the
    // same notional slot the annotation text uses).
    //
    // The returned descriptor is the module's public idea of "the plane":
    //   grid        - step and world-origin anchor
    //   extentMm    - snapped model footprint plus margin, for bounds checks
    //   heightMm    - where the plane sits in Y
    //   plane       - a real THREE.Plane at that height, normal +Y
    //   measured    - the raw model bounds, or null when nothing was loaded
    //
    // With no model loaded the extent falls back to the maximum span so the
    // system stays usable rather than rejecting every pick.
    // ------------------------------------------------------------
    function Na__PlanDimGrid__EstablishPlane(modelRoot, planeHeightMm) {
        const measured = Na__PlanDimGrid__MeasureModelMm(modelRoot);
        const margin   = Na__PlanDimGrid__Setup.planeMarginMm;
        const heightMm = Number.isFinite(planeHeightMm) ? planeHeightMm : 0;

        const extentMm = measured
            ? {
                minXMm : Na__PlanDimGrid__SnapValueMm(measured.minXMm - margin),
                maxXMm : Na__PlanDimGrid__SnapValueMm(measured.maxXMm + margin),
                minZMm : Na__PlanDimGrid__SnapValueMm(measured.minZMm - margin),
                maxZMm : Na__PlanDimGrid__SnapValueMm(measured.maxZMm + margin)
            }
            : {
                minXMm : -Na__PlanDimGrid__Setup.maxSpanMm,                  // <-- No model yet; stay permissive
                maxXMm :  Na__PlanDimGrid__Setup.maxSpanMm,
                minZMm : -Na__PlanDimGrid__Setup.maxSpanMm,
                maxZMm :  Na__PlanDimGrid__Setup.maxSpanMm
            };

        Na__PlanDimGrid__Plane = {
            grid     : { ...Na__PlanDimGrid__Setup },
            extentMm : extentMm,
            widthMm  : extentMm.maxXMm - extentMm.minXMm,
            depthMm  : extentMm.maxZMm - extentMm.minZMm,
            heightMm : heightMm,
            measured : measured,
            hasModel : measured !== null,
            plane    : new THREE.Plane(                                      // <-- The literal surface, for raycast / export use
                new THREE.Vector3(0, 1, 0),
                -(heightMm / 1000)                                           // <-- THREE.Plane constant is in scene units
            )
        };

        return Na__PlanDimGrid__Plane;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Established Plane Descriptor (or Null)
    // ------------------------------------------------------------
    function Na__PlanDimGrid__GetPlane() {
        return Na__PlanDimGrid__Plane;
    }
    // ------------------------------------------------------------


    // FUNCTION | Move the Established Plane to a New Height
    // ------------------------------------------------------------
    // Used when the author drags a plan's cut height while dimensions are
    // already placed: the X/Z grid is unaffected, only the plane's Y moves.
    // ------------------------------------------------------------
    function Na__PlanDimGrid__SetPlaneHeightMm(planeHeightMm) {
        if (!Na__PlanDimGrid__Plane || !Number.isFinite(planeHeightMm)) return false;

        Na__PlanDimGrid__Plane.heightMm     = planeHeightMm;
        Na__PlanDimGrid__Plane.plane.constant = -(planeHeightMm / 1000);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Snapping
// -----------------------------------------------------------------------------

    // FUNCTION | Snap One Millimetre Value onto the Grid
    // ------------------------------------------------------------
    // Rounds about the configured origin rather than about zero, so a grid
    // deliberately offset from the world origin still lands on its own lines.
    // ------------------------------------------------------------
    function Na__PlanDimGrid__SnapValueMm(valueMm, originMm) {
        if (!Number.isFinite(valueMm)) return 0;

        const step   = Na__PlanDimGrid__Setup.snapStepMm;
        const anchor = Number.isFinite(originMm) ? originMm : 0;

        return anchor + (Math.round((valueMm - anchor) / step) * step);
    }
    // ------------------------------------------------------------


    // FUNCTION | Snap a World X/Z Point onto the Grid
    // ------------------------------------------------------------
    // The one call every pick goes through. Accepts the loose { posXMm, posZMm }
    // shape the annotation overlay's ScreenToWorldMm already returns, so a
    // pointer position converts straight into a storable endpoint.
    // ------------------------------------------------------------
    function Na__PlanDimGrid__SnapPointMm(point) {
        if (!point) return null;

        const rawX = Number.isFinite(point.posXMm) ? point.posXMm : point.xMm;
        const rawZ = Number.isFinite(point.posZMm) ? point.posZMm : point.zMm;
        if (!Number.isFinite(rawX) || !Number.isFinite(rawZ)) return null;

        return {
            posXMm : Na__PlanDimGrid__SnapValueMm(rawX, Na__PlanDimGrid__Setup.originXMm),
            posZMm : Na__PlanDimGrid__SnapValueMm(rawZ, Na__PlanDimGrid__Setup.originZMm)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Snap a Measured Length onto the Measurement Grid
    // ------------------------------------------------------------
    // Two axis-locked endpoints on the grid already differ by a whole number
    // of steps, but an aligned (diagonal) dimension does not - its length is a
    // square root and lands anywhere. Rounding the reported figure keeps every
    // number on the drawing readable at the same precision.
    // ------------------------------------------------------------
    function Na__PlanDimGrid__SnapMeasurementMm(lengthMm) {
        if (!Number.isFinite(lengthMm)) return 0;
        const step = Na__PlanDimGrid__Setup.measurementSnapMm;
        return Math.round(lengthMm / step) * step;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Validation and Measurement
// -----------------------------------------------------------------------------

    // FUNCTION | Is a Point Inside the Established Plane Extent?
    // ------------------------------------------------------------
    // With no plane established yet nothing is rejected - the system has no
    // basis on which to judge, and refusing every pick would be worse than
    // accepting one that is slightly out.
    // ------------------------------------------------------------
    function Na__PlanDimGrid__IsWithinPlane(point) {
        if (!Na__PlanDimGrid__Plane || !point) return true;

        const extent = Na__PlanDimGrid__Plane.extentMm;
        return point.posXMm >= extent.minXMm && point.posXMm <= extent.maxXMm
            && point.posZMm >= extent.minZMm && point.posZMm <= extent.maxZMm;
    }
    // ------------------------------------------------------------


    // FUNCTION | Clamp a Point Into the Established Plane Extent
    // ------------------------------------------------------------
    function Na__PlanDimGrid__ClampToPlane(point) {
        if (!Na__PlanDimGrid__Plane || !point) return point;

        const extent = Na__PlanDimGrid__Plane.extentMm;
        return {
            posXMm : Math.min(Math.max(point.posXMm, extent.minXMm), extent.maxXMm),
            posZMm : Math.min(Math.max(point.posZMm, extent.minZMm), extent.maxZMm)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Resolve Two Picks Into a Dimensioned Span
    // ------------------------------------------------------------
    // Snaps both ends, applies the requested axis lock, then measures. Axis
    // locking collapses the off-axis component so an "X" dimension reports a
    // pure horizontal distance even when the second pick drifted vertically.
    //
    // Returns null when the two ends land on the same grid cell, or further
    // apart than the configured maximum - both are mis-picks rather than
    // dimensions, and storing either would put a nonsense figure on a drawing.
    // ------------------------------------------------------------
    function Na__PlanDimGrid__ResolveSpan(startPoint, endPoint, axis) {
        const start = Na__PlanDimGrid__SnapPointMm(startPoint);
        let   end   = Na__PlanDimGrid__SnapPointMm(endPoint);
        if (!start || !end) return null;

        if (axis === Na__PlanDimGrid__AXIS_X) {
            end = { posXMm : end.posXMm, posZMm : start.posZMm };            // <-- Collapse Z, pure horizontal run
        } else if (axis === Na__PlanDimGrid__AXIS_Z) {
            end = { posXMm : start.posXMm, posZMm : end.posZMm };            // <-- Collapse X, pure vertical run
        }

        const deltaX   = end.posXMm - start.posXMm;
        const deltaZ   = end.posZMm - start.posZMm;
        const rawLen   = Math.sqrt((deltaX * deltaX) + (deltaZ * deltaZ));
        const lengthMm = Na__PlanDimGrid__SnapMeasurementMm(rawLen);

        if (lengthMm < Na__PlanDimGrid__Setup.minSpanMm) return null;        // <-- Same cell; nothing to measure
        if (lengthMm > Na__PlanDimGrid__Setup.maxSpanMm) return null;        // <-- Runaway pick

        return {
            start    : start,
            end      : end,
            axis     : axis || Na__PlanDimGrid__AXIS_FREE,
            deltaXMm : deltaX,
            deltaZMm : deltaZ,
            lengthMm : lengthMm
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Choose an Axis Lock From a Screen-Space Pick
    // ------------------------------------------------------------
    // A pick within the tolerance of horizontal or vertical is straightened
    // onto that axis, because a plan dimension that is 3 px off square is
    // almost always meant to be square. Beyond the tolerance the pick is taken
    // at face value and an aligned dimension is produced.
    // ------------------------------------------------------------
    function Na__PlanDimGrid__ChooseAxis(deltaXPx, deltaYPx, tolerancePx, axisLockEnabled) {
        if (axisLockEnabled === false) return Na__PlanDimGrid__AXIS_FREE;

        const tolerance = Number.isFinite(tolerancePx) ? tolerancePx : 12;
        const absX      = Math.abs(deltaXPx);
        const absY      = Math.abs(deltaYPx);

        if (absY <= tolerance && absX > absY) return Na__PlanDimGrid__AXIS_X; // <-- Runs across the sheet
        if (absX <= tolerance && absY > absX) return Na__PlanDimGrid__AXIS_Z; // <-- Runs up the sheet
        return Na__PlanDimGrid__AXIS_FREE;
    }
    // ------------------------------------------------------------


    // FUNCTION | Reset the Module So a Reload or Plan Switch Starts Clean
    // ------------------------------------------------------------
    function Na__PlanDimGrid__Dispose() {
        Na__PlanDimGrid__Plane = null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Plan Dimensions Grid API
    // ------------------------------------------------------------
    export {
        Na__PlanDimGrid__AXIS_X,
        Na__PlanDimGrid__AXIS_Z,
        Na__PlanDimGrid__AXIS_FREE,
        Na__PlanDimGrid__Configure,
        Na__PlanDimGrid__GetSetup,
        Na__PlanDimGrid__EstablishPlane,
        Na__PlanDimGrid__GetPlane,
        Na__PlanDimGrid__SetPlaneHeightMm,
        Na__PlanDimGrid__SnapValueMm,
        Na__PlanDimGrid__SnapPointMm,
        Na__PlanDimGrid__SnapMeasurementMm,
        Na__PlanDimGrid__IsWithinPlane,
        Na__PlanDimGrid__ClampToPlane,
        Na__PlanDimGrid__ResolveSpan,
        Na__PlanDimGrid__ChooseAxis,
        Na__PlanDimGrid__Dispose
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
