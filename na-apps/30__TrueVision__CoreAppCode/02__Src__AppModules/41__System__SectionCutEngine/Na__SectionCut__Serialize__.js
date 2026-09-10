// =============================================================================
// TRUEVISION3D - SECTION CUT ENGINE - SERIALIZE AND APPLY
// =============================================================================
//
// FILE       : Na__SectionCut__Serialize__.js
// NAMESPACE  : Na__SectSerialize
// MODULE     : Section Cut Engine - Serialize / Apply
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Turn the live cut planes into ValeVision's snapshot shape, and back
// CREATED    : 10-Sep-2026
//
// DESCRIPTION:
// - The section engine had no serialization at all before this: a cut existed
//   only while the page was open. Fine for a live 3D toggle, useless for a
//   drawing, which has to reopen with its own cut, restore into a sheet
//   viewport, and print.
// - The snapshot shape is ValeVision's, EXACTLY. Same keys, same casing, same
//   units, same rounding. A project document written by either app is readable
//   by the other. See TrueVision__PLAN__ValeVisionRealign__DrawingSystems__.md
//   section 3.2 for the full field mapping.
// - An empty sections array is a VALID snapshot and means "no cuts". That
//   distinction is load-bearing: a scene saved with no cuts must actively clear
//   the previous scene's, which is different from a scene with no entry at all.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 41__System__CrossSectionView/Na__CrossSectionView__SystemLogic.js
//                   (the Na__CrossSection__SerializeSections / ApplySerializedSections pair,
//                   split out here rather than buried in a 1,753-line module)
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment Phase B, TD06)
// - Parity        : adapted (schema verbatim, engine calls differ)
// - Divergences   : (1) SLICE DEPTH IS FLATTENED. ValeVision holds one global sliceDepthM;
//                       TrueVision holds a depth per plane. The schema is ValeVision's, so
//                       capture collapses to the first plane's depth and restore gives every
//                       plane that depth. A TrueVision project with genuinely different
//                       per-plane depths loses that difference. Accepted deliberately: two
//                       schemas that are ninety-five percent alike are worse than one, and
//                       the differences are where the bugs live.
//                   (2) NO GIZMOS. ValeVision draws draggable plane gizmos and stores their
//                       visibility. TrueVision draws none, so gizmosVisible and gizmoVisible
//                       are written false and honoured-but-ignored on read. The keys are kept
//                       so the documents stay interchangeable.
//                   (3) MODE is derived from the plane normal rather than stored, because the
//                       TrueVision engine has no placement-mode concept - a dominant Y
//                       component is PLAN, anything else UPRIGHT.
// - Back-port     : no. ValeVision already has this.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.0.0
// - Initial implementation for TD06.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Unit Conversion
    // ------------------------------------------------------------
    // @delegate: ../04__MathUtils/Na__Math__Units.js
    // ------------------------------------------------------------
    import {
        Na__Math__ConvertUnitsToMm,
        Na__Math__ConvertMmToUnits
    } from '../04__MathUtils/Na__Math__Units.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Section Cut Engine
    // ------------------------------------------------------------
    // @delegate: ./Na__SectionCut__Engine__.js
    // ------------------------------------------------------------
    import {
        Na__SectionCut__UpsertHorizontalPlane,
        Na__SectionCut__UpsertVerticalPlane,
        Na__SectionCut__RemoveAllPlanes,
        Na__SectionCut__SetActivePlane,
        Na__SectionCut__GetAppearance,
        Na__SectionCut__SetAppearance,
        Na__SectionCut__GetPlaneRecords
    } from './Na__SectionCut__Engine__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | ValeVision Placement Mode Names
    // ------------------------------------------------------------
    // Written verbatim into the snapshot. Uppercase because that is what
    // ValeVision writes, and a case difference would read as a corrupt entry.
    // ------------------------------------------------------------
    const Na__SectSerialize__MODE_PLAN    = 'PLAN';
    const Na__SectSerialize__MODE_UPRIGHT = 'UPRIGHT';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Rounding and Thresholds
    // ------------------------------------------------------------
    const Na__SectSerialize__NORMAL_DP     = 1e6;    // <-- Normals to 6 dp, as ValeVision writes them
    const Na__SectSerialize__POSITION_DP   = 100;    // <-- Positions to 2 dp of a millimetre
    const Na__SectSerialize__PLAN_Y_MIN    = 0.9;    // <-- |normal.y| above this reads as a horizontal cut
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Private Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Round to Six Decimal Places
    // ------------------------------------------------------------
    function Na__SectSerialize__Round6(value) {
        return Math.round(value * Na__SectSerialize__NORMAL_DP) / Na__SectSerialize__NORMAL_DP;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Placement Mode From a Plane Normal
    // ------------------------------------------------------------
    // TrueVision has no placement-mode concept, so the mode is read back off the
    // geometry. A plan cut points straight up or down; anything else is upright.
    // ------------------------------------------------------------
    function Na__SectSerialize__ModeFromNormal(normal) {
        return (Math.abs(normal.y) >= Na__SectSerialize__PLAN_Y_MIN)
            ? Na__SectSerialize__MODE_PLAN
            : Na__SectSerialize__MODE_UPRIGHT;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Global Slice Depth in Metres, or null
    // ------------------------------------------------------------
    // Divergence (1). ValeVision's schema has one depth for the whole snapshot,
    // so the first plane carrying one wins. Returns null for "infinite", which
    // is what ValeVision writes when no back plane is in play.
    // ------------------------------------------------------------
    function Na__SectSerialize__GlobalSliceDepthM(records) {
        for (let i = 0; i < records.length; i++) {
            const depthUnits = records[i].depthUnits;
            if (Number.isFinite(depthUnits) && depthUnits > 0) {
                return Na__Math__ConvertUnitsToMm(depthUnits) / 1000;            // <-- mm to metres, as ValeVision stores it
            }
        }
        return null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Serialize
// -----------------------------------------------------------------------------

    // FUNCTION | Capture the Live Cut Planes as a ValeVision Snapshot
    // ------------------------------------------------------------
    // Returns the snapshot object. An empty sections array is valid and means
    // "this scene has no cuts", which is not the same as having no entry.
    // ------------------------------------------------------------
    function Na__SectSerialize__Serialize() {
        const records    = Na__SectionCut__GetPlaneRecords();
        const appearance = Na__SectionCut__GetAppearance() || {};

        return {
            gizmosVisible : false,                                               // <-- Divergence (2): TrueVision draws no gizmos
            sliceDepthM   : Na__SectSerialize__GlobalSliceDepthM(records),
            fillColor     : (typeof appearance.fillColor === 'string') ? appearance.fillColor : null,
            lineColor     : (typeof appearance.lineColor === 'string') ? appearance.lineColor : null,
            lineWidthPx   : Number.isFinite(appearance.lineWidthPx) ? appearance.lineWidthPx : null,
            sections      : records.map((record) => ({
                name         : record.id,
                mode         : Na__SectSerialize__ModeFromNormal(record.plane.normal),
                normalXyz    : [
                    Na__SectSerialize__Round6(record.plane.normal.x),
                    Na__SectSerialize__Round6(record.plane.normal.y),
                    Na__SectSerialize__Round6(record.plane.normal.z)
                ],
                // NOT negated, where ValeVision's equivalent line negates.
                // positionMm means the same physical thing in both schemas - the
                // cut's position along its own normal, in millimetres - but the
                // two engines store plane.constant with opposite signs for the
                // same normal. TrueVision's plan normal is (0,-1,0) and
                // distanceToPoint is -p.y + constant, so constant IS the cut
                // height and negating it here wrote every cut at minus its own
                // position. Caught by the round-trip test, which is the only
                // thing that would have caught it: the value looked plausible.
                positionMm   : Math.round(Na__Math__ConvertUnitsToMm(record.plane.constant) * Na__SectSerialize__POSITION_DP) / Na__SectSerialize__POSITION_DP,
                enabled      : record.enabled !== false,
                gizmoVisible : false                                             // <-- Divergence (2)
            }))
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Apply
// -----------------------------------------------------------------------------

    // FUNCTION | Restore a ValeVision Snapshot onto the Live Engine
    // ------------------------------------------------------------
    // Clears every existing cut first, so restoring is a replacement and never a
    // merge. A snapshot with an empty sections array therefore clears the view,
    // which is the behaviour a scene saved with no cuts has to have.
    //
    // Returns true when the snapshot was understood, false when it was not.
    // ------------------------------------------------------------
    function Na__SectSerialize__Apply(snapshot) {
        if (!snapshot || typeof snapshot !== 'object') return false;

        Na__SectionCut__RemoveAllPlanes();                                       // <-- Replacement, not merge

        // APPEARANCE | Optional; only applied when the snapshot carries style
        // The engine's appearance keys happen to be spelled exactly as
        // ValeVision's snapshot keys, so this is a straight pass-through.
        const appearancePatch = {};
        if (typeof snapshot.fillColor === 'string')  appearancePatch.fillColor   = snapshot.fillColor;
        if (typeof snapshot.lineColor === 'string')  appearancePatch.lineColor   = snapshot.lineColor;
        if (Number.isFinite(snapshot.lineWidthPx))   appearancePatch.lineWidthPx = snapshot.lineWidthPx;
        if (Object.keys(appearancePatch).length > 0) Na__SectionCut__SetAppearance(appearancePatch);

        // SLICE DEPTH | Divergence (1): one global value, given to every plane
        const depthMm = Number.isFinite(snapshot.sliceDepthM) && snapshot.sliceDepthM > 0
            ? snapshot.sliceDepthM * 1000
            : null;

        const sections = Array.isArray(snapshot.sections) ? snapshot.sections : [];
        let restored   = 0;
        let firstId    = null;

        for (let i = 0; i < sections.length; i++) {
            const entry = sections[i];
            if (!entry || typeof entry !== 'object') continue;

            const id     = entry.name;
            const normal = Array.isArray(entry.normalXyz) ? entry.normalXyz : null;
            const posMm  = entry.positionMm;
            if (!id || !normal || normal.length !== 3 || !Number.isFinite(posMm)) continue;

            const isPlan = (entry.mode === Na__SectSerialize__MODE_PLAN)
                || (Math.abs(normal[1]) >= Na__SectSerialize__PLAN_Y_MIN);       // <-- Trust the geometry when mode is missing

            let ok;
            if (isPlan) {
                ok = Na__SectionCut__UpsertHorizontalPlane(id, posMm, depthMm);
            } else {
                // The engine takes the direction FROM the building TOWARD the
                // viewer and negates it internally, so the stored normal - which
                // is already the negated, keep-what-lies-beyond form - is flipped
                // back here before handing it over. Getting this backwards cuts
                // away the half of the building the drawing is meant to show.
                ok = Na__SectionCut__UpsertVerticalPlane(id, -normal[0], -normal[2], posMm, depthMm);
            }

            if (ok) {
                restored += 1;
                if (!firstId) firstId = id;
            }
        }

        if (firstId) Na__SectionCut__SetActivePlane(firstId);                    // <-- Caps are computed for the active plane

        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Section Serialization API
    // ------------------------------------------------------------
    export {
        Na__SectSerialize__Serialize,
        Na__SectSerialize__Apply
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
