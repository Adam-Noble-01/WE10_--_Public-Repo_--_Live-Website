// =============================================================================
// TRUEVISION3D - DRAWING VIEW CORE - SECTION ADAPTER
// =============================================================================
//
// FILE       : Na__DrawView__SectionAdapter__.js
// NAMESPACE  : Na__DrawView__SectionAdapter
// MODULE     : Drawing View Core - Section Adapter
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Present ValeVision's section adapter interface over TrueVision's cut engine
// CREATED    : 10-Sep-2026
//
// DESCRIPTION:
// - One seam, so every drawing system - floor plans, elevations, sections and
//   the Layout Editor's offscreen renders - talks to the section engine through
//   the same thirteen calls in both apps. Everything downstream then ports
//   between the two trees without an edit.
// - THIS IS A THIN ADAPTER, and deliberately so. ValeVision's equivalent is
//   about 400 lines because it wraps a LIVE USER TOOL: the Cross Sections panel
//   a person can be mid-drag in when a drawing opens, whose colours, slice depth
//   and plane set all have to be snapshotted and handed back untouched
//   afterwards. TrueVision's cut engine has no user tool in front of it, so
//   there is no user state to protect, and the honest implementation is a
//   pass-through rather than a re-implementation of a problem this app does not
//   have.
// - SuspendLiveTool and Release are therefore no-ops. They are KEPT, rather than
//   removed, because the callers are shared with ValeVision: deleting them would
//   force every mode controller to grow a branch, which is exactly the drift
//   this seam exists to prevent.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 42__System__DrawingViewCore/Na__DrawView__SectionAdapter__.js 1.2.0
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment Phase B)
// - Parity        : diverged (interface identical, implementation is a pass-through)
// - Divergences   : (1) Drives Na__SectionCut__* rather than Na__CrossSectionView__SystemLogic.
//                   (2) SuspendLiveTool and Release are documented no-ops - there is no live
//                       user tool whose state could be trampled.
//                   (3) No drawing-colour override pass. ValeVision has to force the Doous
//                       section colours over whatever the user tool was set to; TrueVision's
//                       engine already reads its colours from config, so the drawing look is
//                       the default look and there is nothing to override or restore.
// - Back-port     : no. The thinness is the point.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.0.0
// - Initial implementation for re-alignment Phase B.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Section Cut Engine
    // ------------------------------------------------------------
    // @delegate: ../41__System__SectionCutEngine/Na__SectionCut__Engine__.js
    // ------------------------------------------------------------
    import {
        Na__SectionCut__UpsertHorizontalPlane,
        Na__SectionCut__UpsertVerticalPlane,
        Na__SectionCut__SetPlaneDistanceMm,
        Na__SectionCut__SetPlaneHeightMm,
        Na__SectionCut__SetActivePlane,
        Na__SectionCut__RemovePlane,
        Na__SectionCut__RecomputeActive,
        Na__SectionCut__RenderOverlay,
        Na__SectionCut__IsCutting,
        Na__SectionCut__GetActivePlaneId,
        Na__SectionCut__GetPlaneRecords
    } from '../41__System__SectionCutEngine/Na__SectionCut__Engine__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Unit Conversion
    // ------------------------------------------------------------
    // @delegate: ../04__MathUtils/Na__Math__Units.js
    // ------------------------------------------------------------
    import { Na__Math__ConvertUnitsToMm } from '../04__MathUtils/Na__Math__Units.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Plane Creation and Movement
// -----------------------------------------------------------------------------

    // FUNCTION | Create or Update a Horizontal (Plan) Cut Plane
    // ------------------------------------------------------------
    function Na__DrawView__SectionAdapter__UpsertHorizontalPlane(id, cutHeightMm, depthMm) {
        return Na__SectionCut__UpsertHorizontalPlane(id, cutHeightMm, depthMm);
    }
    // ------------------------------------------------------------


    // FUNCTION | Create or Update a Vertical (Elevation / Section) Cut Plane
    // ------------------------------------------------------------
    // viewNormalX/Z points FROM the building TOWARD the viewer, exactly as the
    // engine wants it, so this is a straight hand-off. Getting the sign wrong
    // here cuts away the half of the building the drawing is meant to show.
    // ------------------------------------------------------------
    function Na__DrawView__SectionAdapter__UpsertVerticalPlane(id, viewNormalX, viewNormalZ, distanceMm, depthMm) {
        return Na__SectionCut__UpsertVerticalPlane(id, viewNormalX, viewNormalZ, distanceMm, depthMm);
    }
    // ------------------------------------------------------------


    // FUNCTION | Move a Plane Along Its Own Normal
    // ------------------------------------------------------------
    function Na__DrawView__SectionAdapter__SetPlaneDistanceMm(id, distanceMm) {
        return Na__SectionCut__SetPlaneDistanceMm(id, distanceMm);
    }
    // ------------------------------------------------------------


    // FUNCTION | Move a Plan Cut to a New Height
    // ------------------------------------------------------------
    function Na__DrawView__SectionAdapter__SetPlaneHeightMm(id, heightMm) {
        return Na__SectionCut__SetPlaneHeightMm(id, heightMm);
    }
    // ------------------------------------------------------------


    // FUNCTION | Choose Which Plane Draws Its Caps
    // ------------------------------------------------------------
    function Na__DrawView__SectionAdapter__SetActivePlane(id) {
        return Na__SectionCut__SetActivePlane(id);
    }
    // ------------------------------------------------------------


    // FUNCTION | Drop a Plane
    // ------------------------------------------------------------
    function Na__DrawView__SectionAdapter__RemovePlane(id) {
        return Na__SectionCut__RemovePlane(id);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Live Tool Custody (No-Ops - see the PORT NOTE)
// -----------------------------------------------------------------------------

    // FUNCTION | Take Custody of the Section Tool for a Drawing
    // ------------------------------------------------------------
    // ValeVision snapshots the live Cross Sections tool here - the user's plane
    // set, slice depth and colours - because a drawing is about to overwrite all
    // of it and the user expects their own cut back afterwards.
    //
    // TrueVision has no such tool. Every cut on screen was put there by a
    // drawing, so there is nothing to take custody of and nothing that could be
    // trampled. Kept as a no-op so the mode controllers stay identical across
    // the two trees; a controller that has to ask which app it is running in is
    // how the two implementations start drifting apart again.
    // ------------------------------------------------------------
    function Na__DrawView__SectionAdapter__SuspendLiveTool() {
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Hand the Section Tool Back
    // ------------------------------------------------------------
    // The counterpart to the above, and a no-op for the same reason.
    // ------------------------------------------------------------
    function Na__DrawView__SectionAdapter__Release() {
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Render and Query
// -----------------------------------------------------------------------------

    // FUNCTION | Re-Apply Clipping After a Material or Model Change
    // ------------------------------------------------------------
    // Both pre-passes of the profile-line overlay replace materials wholesale,
    // and the engine assigns its planes per material. Without this the linework
    // draws a whole building over a drawing that shows a slice.
    // ------------------------------------------------------------
    function Na__DrawView__SectionAdapter__ReapplyClipping() {
        return Na__SectionCut__RecomputeActive();
    }
    // ------------------------------------------------------------


    // FUNCTION | Draw the Cap Fills and Profile Outlines
    // ------------------------------------------------------------
    function Na__DrawView__SectionAdapter__RenderOverlay(camera) {
        return Na__SectionCut__RenderOverlay(camera);
    }
    // ------------------------------------------------------------


    // FUNCTION | Is Anything Being Cut Right Now?
    // ------------------------------------------------------------
    function Na__DrawView__SectionAdapter__IsCutting() {
        return Na__SectionCut__IsCutting();
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Plane Is Active?
    // ------------------------------------------------------------
    function Na__DrawView__SectionAdapter__GetActivePlaneId() {
        return Na__SectionCut__GetActivePlaneId();
    }
    // ------------------------------------------------------------


    // FUNCTION | Read a Plane Back as Normal Plus Position
    // ------------------------------------------------------------
    // The projection pipeline needs the cut as a half-space to clip against
    // before it samples geometry, and the Layout Editor needs it to reproduce a
    // drawing offscreen. Returns millimetres, matching every other public
    // distance in the drawing systems, and null when the id is not a live plane.
    // ------------------------------------------------------------
    function Na__DrawView__SectionAdapter__GetPlaneDefinition(id) {
        if (!id) return null;
        const records = Na__SectionCut__GetPlaneRecords();
        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            if (record.id !== id) continue;
            return {
                id         : record.id,
                normal     : { x: record.plane.normal.x, y: record.plane.normal.y, z: record.plane.normal.z },
                positionMm : Na__Math__ConvertUnitsToMm(record.plane.constant),
                depthMm    : Number.isFinite(record.depthUnits) ? Na__Math__ConvertUnitsToMm(record.depthUnits) : null,
                enabled    : record.enabled !== false
            };
        }
        return null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Section Adapter API (identical to ValeVision's)
    // ------------------------------------------------------------
    export {
        Na__DrawView__SectionAdapter__UpsertHorizontalPlane,
        Na__DrawView__SectionAdapter__UpsertVerticalPlane,
        Na__DrawView__SectionAdapter__SetPlaneDistanceMm,
        Na__DrawView__SectionAdapter__SetPlaneHeightMm,
        Na__DrawView__SectionAdapter__SetActivePlane,
        Na__DrawView__SectionAdapter__RemovePlane,
        Na__DrawView__SectionAdapter__SuspendLiveTool,
        Na__DrawView__SectionAdapter__Release,
        Na__DrawView__SectionAdapter__ReapplyClipping,
        Na__DrawView__SectionAdapter__GetPlaneDefinition,
        Na__DrawView__SectionAdapter__RenderOverlay,
        Na__DrawView__SectionAdapter__IsCutting,
        Na__DrawView__SectionAdapter__GetActivePlaneId
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
