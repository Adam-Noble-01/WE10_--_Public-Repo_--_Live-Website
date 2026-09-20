// =============================================================================
// TRUEVISION3D - ELEVATION DEPTH FOG - RECORD DATA
// =============================================================================
//
// FILE       : Na__ElevationDepthFog__RecordData__.js
// NAMESPACE  : Na__ElevFogData
// MODULE     : Elevation Depth Fog - Record Data
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Read and write a drawing's fog block, on whatever kind of drawing record holds it
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - A DRAWING'S FOG IS SAVED WITH THE DRAWING. Each elevation varies - one
//   stands a metre off its facade, another looks the length of a courtyard -
//   so the three numbers are the record's, not the project's. The block sits
//   inside the record under a key that names the record type:
//
//       Elevation__DepthFog    { DepthFog__Enabled, DepthFog__StartDepthMm,
//                                DepthFog__EndDepthMm, DepthFog__FalloffPercent }
//
//   and the same four inner keys will sit under FloorPlan__DepthFog and a
//   section's own key when those are wired. NOTHING IS ADDED TO THE TOP OF THE
//   PROJECT FILE: the records live inside LayoutEditor__DrawingsData, which is
//   already on all three dev-owned key lists that guard the R2 sync, so the
//   fog rides a save path that exists and cannot be wiped by a build.
//
// - THE BLOCK IS WRITTEN ON FIRST READ, OFF. A record from before fog existed
//   gains the block, switched off, with the configured three numbers waiting
//   in it. That is Elevation__Styles' rule and it is here for the same two
//   reasons: a record that kept ANSWERING defaults without HOLDING them would
//   change its drawing the day the defaults were edited, and the Dev menu's
//   draft is a snapshot of the record taken when its row opens - a block that
//   first appeared after that would read as an edit nobody made.
//
// - A SETTLED RECORD IS LEFT ALONE. Ensure compares before it writes, so the
//   reads that happen on every refresh touch nothing.
//
// - ALWAYS READ THROUGH HERE, NEVER HOLD THE BLOCK. Reverting a draft replaces
//   a record's nested objects with fresh ones; a held block would go on being
//   edited after the record had let go of it.
//
// INTEGRATION:
// - Na__Elevation__ProjectJson__Data__ calls Ensure from its normaliser and
//   lends its record key to Read and Write.
// - Na__ElevationDepthFog__DevMenu__Row__ edits through the accessors its
//   caller hands it, which end here.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (20-Sep-2026)
// - ValeVision    : not yet ported.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation for the Elevation Depth Fog build.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Fog Config and Maths
    // ------------------------------------------------------------
    // @delegate: ./Na__ElevationDepthFog__ConfigState__.js
    // @delegate: ./Na__ElevationDepthFog__Maths__.js
    // ------------------------------------------------------------
    import {
        Na__ElevFogCfg__GetDefaults,
        Na__ElevFogCfg__GetLimits
    } from './Na__ElevationDepthFog__ConfigState__.js';
    import {
        Na__ElevFogMath__NormaliseSettings,
        Na__ElevFogMath__WriteBlock,
        Na__ElevFogMath__BlockMatches
    } from './Na__ElevationDepthFog__Maths__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Where Each Kind of Drawing Record Keeps Its Block
    // ------------------------------------------------------------
    // An elevation record serves an elevation AND its section - one record,
    // the cut on or off - so a section drawn from the Elevations menu is fogged
    // by the elevation's own block. FLOORPLAN is named here so the key is
    // chosen once; nothing reads it until the Floor Plans row is wired.
    // ------------------------------------------------------------
    const Na__ElevFogData__KEY_ELEVATION = 'Elevation__DepthFog';
    const Na__ElevFogData__KEY_FLOORPLAN = 'FloorPlan__DepthFog';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Make Sure a Record Holds a Whole, Settled Fog Block
    // ------------------------------------------------------------
    // Returns the four settled values. Writes only when what is stored is not
    // already exactly that, and then into the SAME block object where there is
    // one.
    // ------------------------------------------------------------
    function Na__ElevFogData__Ensure(record, recordKey) {
        const settings = Na__ElevFogMath__NormaliseSettings(
            (record && recordKey) ? record[recordKey] : null,
            Na__ElevFogCfg__GetDefaults(),
            Na__ElevFogCfg__GetLimits()
        );
        if (!record || typeof record !== 'object' || !recordKey) return settings;

        if (!Na__ElevFogMath__BlockMatches(record[recordKey], settings)) {
            record[recordKey] = Na__ElevFogMath__WriteBlock(record[recordKey], settings);
        }
        return settings;
    }
    // ------------------------------------------------------------


    // FUNCTION | Read a Record's Fog as Four Plain Values
    // ------------------------------------------------------------
    // { enabled, startDepthMm, endDepthMm, falloffPercent } - a copy, so a
    // caller doing sums with it cannot edit the saved record.
    // ------------------------------------------------------------
    function Na__ElevFogData__Read(record, recordKey) {
        return Na__ElevFogData__Ensure(record, recordKey);
    }
    // ------------------------------------------------------------


    // FUNCTION | Change Some of a Record's Fog, and Settle the Rest Around It
    // ------------------------------------------------------------
    // patch carries any of { enabled, startDepthMm, endDepthMm, falloffPercent };
    // a member that is null or not a number is left as it was. The whole block
    // is settled afterwards, so a Depth typed past End pushes End out, and what
    // comes back is what is now stored - which is what the row must show.
    // ------------------------------------------------------------
    function Na__ElevFogData__Write(record, recordKey, patch) {
        const current = Na__ElevFogData__Ensure(record, recordKey);
        if (!record || typeof record !== 'object' || !recordKey || !patch) return current;

        const wanted = {
            enabled        : (typeof patch.enabled === 'boolean')     ? patch.enabled        : current.enabled,
            startDepthMm   : Number.isFinite(patch.startDepthMm)      ? patch.startDepthMm   : current.startDepthMm,
            endDepthMm     : Number.isFinite(patch.endDepthMm)        ? patch.endDepthMm     : current.endDepthMm,
            falloffPercent : Number.isFinite(patch.falloffPercent)    ? patch.falloffPercent : current.falloffPercent
        };

        // Through the block's own keys and back, so the one normaliser decides
        // what is legal however the values arrived.
        const settled = Na__ElevFogMath__NormaliseSettings(
            Na__ElevFogMath__WriteBlock({}, wanted),
            Na__ElevFogCfg__GetDefaults(),
            Na__ElevFogCfg__GetLimits()
        );
        record[recordKey] = Na__ElevFogMath__WriteBlock(record[recordKey], settled);
        return settled;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Elevation Depth Fog Record Data API
    // ------------------------------------------------------------
    export {
        Na__ElevFogData__KEY_ELEVATION,
        Na__ElevFogData__KEY_FLOORPLAN,
        Na__ElevFogData__Ensure,
        Na__ElevFogData__Read,
        Na__ElevFogData__Write
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
