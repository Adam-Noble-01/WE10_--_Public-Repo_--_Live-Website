// =============================================================================
// TRUEVISION3D - NORTH DIRECTION - PROJECT DATA
// =============================================================================
//
// FILE       : Na__North__ProjectJson__Data__.js
// NAMESPACE  : Na__NorthData
// MODULE     : North Direction - Project Data
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The project's north: where it is kept, reading and setting it, saving it, and the compass word any elevation is named by
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - THE APP HAS ALWAYS ASSUMED NORTH IS THE MODEL'S -Z AXIS. The elevation
//   presets say so ("0 draws the north elevation"), and on a model that was
//   not drawn north-up they are simply wrong: PS01 and PS02 store their
//   "North Elevation" at azimuth 90, renamed by hand after seeding. This
//   module holds the one number that puts it right - the bearing of TRUE
//   north, in the measure the azimuths are already in - and nothing else in
//   the app has to change its convention.
// - IT LIVES INSIDE THE DRAWINGS BLOCK:
//       LayoutEditor__DrawingsData__North : {
//           North__BearingDeg,                      degrees, see Na__North__Compass__
//           North__OriginMm : { PosX, PosY, PosZ }, where the compass was drawn
//           North__SetIso                           when
//       }
//   and not in a top-level key of its own, for the reason the elevations went
//   there: a dev-owned top-level key has to be listed in THREE places (the
//   loader's Na__DevSavedKeys and two ProjectVision scripts) or the next sync
//   wipes it from R2. The drawings block is in all three already, its save
//   writes R2 and the repository copy, and what north is FOR is drawings.
//   ABSENT MEANS NOT SET - never zero, which is a real answer.
// - NOT SET IS A STATE OTHERS MUST SEE. FacingWordForAzimuth answers '' until
//   north is set, and a drawing title then shows {{Direction}} rather than a
//   guess. A north-up model is set to 0 deliberately, with the tool.
// - A CHANGE IS ANNOUNCED AT ONCE, SAVED OR NOT, so a title on an open sheet
//   follows the compass as it is drawn. The save is the drawings block's own.
//
// INTEGRATION:
// - Na__North__DevMenu__Editor__ sets, clears and saves it.
// - 51__System__LayoutEditor/20__System__Viewports/Na__LayoutEditor__ViewportIdentity__
//   names elevation viewports by it, and hears CHANGED_EVENT.
// // @delegate: ../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (19-Sep-2026)
// - ValeVision    : not yet ported.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Drawings Block, the Compass and Its Wording
    // ------------------------------------------------------------
    import { Na__DrawData__GetBlock, Na__DrawData__Save } from '../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    import { Na__NorthMath__Wrap, Na__NorthMath__Round, Na__NorthMath__TrueBearing, Na__NorthMath__FacingWord } from './Na__North__Compass__.js';
    import { Na__NorthCfg__GetCompassSetup } from './Na__North__ConfigState__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Where North Is Kept, Its Fields and Its Event
    // ------------------------------------------------------------
    const Na__NorthData__BLOCK_KEY     = 'LayoutEditor__DrawingsData__North';
    const Na__NorthData__F_BEARING     = 'North__BearingDeg';
    const Na__NorthData__F_ORIGIN      = 'North__OriginMm';
    const Na__NorthData__F_SET_ISO     = 'North__SetIso';
    const Na__NorthData__CHANGED_EVENT = 'na-north-direction-changed';          // <-- detail : { bearingDeg } - null when cleared
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Stored Record, Only When It Holds a Real Bearing
    // ------------------------------------------------------------
    function Na__NorthData__Record() {
        const block  = Na__DrawData__GetBlock();
        const record = block ? block[Na__NorthData__BLOCK_KEY] : null;
        if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
        return Number.isFinite(record[Na__NorthData__F_BEARING]) ? record : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Has North Been Set for This Project
    // ------------------------------------------------------------
    function Na__NorthData__IsSet() {
        return Na__NorthData__Record() !== null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The North Bearing, or Null When Not Set
    // ------------------------------------------------------------
    function Na__NorthData__GetBearingDeg() {
        const record = Na__NorthData__Record();
        return record ? Na__NorthMath__Wrap(record[Na__NorthData__F_BEARING]) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Where the Compass Was Drawn, in Millimetres, or Null
    // ------------------------------------------------------------
    function Na__NorthData__GetOriginMm() {
        const record = Na__NorthData__Record();
        const origin = record ? record[Na__NorthData__F_ORIGIN] : null;
        if (!origin || typeof origin !== 'object') return null;
        const x = Number(origin.PosX), y = Number(origin.PosY), z = Number(origin.PosZ);
        return (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) ? { x : x, y : y, z : z } : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Compass Words
// -----------------------------------------------------------------------------

    // FUNCTION | The Compass Word an Elevation at an Azimuth Is Named By
    // ------------------------------------------------------------
    // '' until north is set. azimuthDeg is Elevation__AzimuthDeg: the model
    // bearing of the side the viewer stands on.
    // ------------------------------------------------------------
    function Na__NorthData__FacingWordForAzimuth(azimuthDeg) {
        const north = Na__NorthData__GetBearingDeg();
        if (north === null || !Number.isFinite(azimuthDeg)) return '';
        const setup = Na__NorthCfg__GetCompassSetup();
        return Na__NorthMath__FacingWord(azimuthDeg, north, setup.halfWidthDeg, setup.words);
    }
    // ------------------------------------------------------------


    // FUNCTION | An Elevation's Azimuth as a True Compass Bearing, or Null
    // ------------------------------------------------------------
    function Na__NorthData__TrueBearingForAzimuth(azimuthDeg) {
        const north = Na__NorthData__GetBearingDeg();
        if (north === null || !Number.isFinite(azimuthDeg)) return null;
        return Na__NorthMath__TrueBearing(azimuthDeg, north);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Setting, Clearing and Saving
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Tell Everyone North Has Changed
    // ------------------------------------------------------------
    function Na__NorthData__Announce() {
        window.dispatchEvent(new CustomEvent(Na__NorthData__CHANGED_EVENT, { detail : { bearingDeg : Na__NorthData__GetBearingDeg() } }));
    }
    // ------------------------------------------------------------


    // FUNCTION | Set North (in memory; Save keeps it)
    // ------------------------------------------------------------
    // originMm is { x, y, z } in millimetres, or left out to keep the one
    // already held. Returns the bearing stored, or null for a bad one.
    // ------------------------------------------------------------
    function Na__NorthData__Set(bearingDeg, originMm) {
        if (!Number.isFinite(bearingDeg)) return null;
        const block = Na__DrawData__GetBlock();
        if (!block) return null;
        const held   = Na__NorthData__GetOriginMm();
        const origin = (originMm && Number.isFinite(originMm.x) && Number.isFinite(originMm.y) && Number.isFinite(originMm.z)) ? originMm : held;
        const record = {};
        record[Na__NorthData__F_BEARING] = Na__NorthMath__Round(bearingDeg, Na__NorthCfg__GetCompassSetup().decimals);
        record[Na__NorthData__F_ORIGIN]  = origin ? { PosX : Math.round(origin.x), PosY : Math.round(origin.y), PosZ : Math.round(origin.z) } : null;
        record[Na__NorthData__F_SET_ISO] = new Date().toISOString();
        block[Na__NorthData__BLOCK_KEY]  = record;
        Na__NorthData__Announce();
        return record[Na__NorthData__F_BEARING];
    }
    // ------------------------------------------------------------


    // FUNCTION | Clear North (in memory; Save keeps it cleared)
    // ------------------------------------------------------------
    function Na__NorthData__Clear() {
        const block = Na__DrawData__GetBlock();
        if (!block || block[Na__NorthData__BLOCK_KEY] === undefined) return false;
        delete block[Na__NorthData__BLOCK_KEY];
        Na__NorthData__Announce();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Save North - the Drawings Block's Own Save
    // ------------------------------------------------------------
    // R2, then the repository copy on localhost. Everything else in the block
    // goes with it, as it does for Save Sheets and Save Elevations.
    // ------------------------------------------------------------
    function Na__NorthData__Save(showToast, report) {
        return Na__DrawData__Save(showToast, report);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | North Direction Project Data API
    // ------------------------------------------------------------
    export {
        Na__NorthData__BLOCK_KEY,
        Na__NorthData__CHANGED_EVENT,
        Na__NorthData__IsSet,
        Na__NorthData__GetBearingDeg,
        Na__NorthData__GetOriginMm,
        Na__NorthData__FacingWordForAzimuth,
        Na__NorthData__TrueBearingForAzimuth,
        Na__NorthData__Set,
        Na__NorthData__Clear,
        Na__NorthData__Save
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
