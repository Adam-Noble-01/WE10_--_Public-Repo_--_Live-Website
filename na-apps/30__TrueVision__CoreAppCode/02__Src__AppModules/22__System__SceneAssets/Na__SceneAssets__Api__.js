// =============================================================================
// TRUEVISION3D - PLACED ASSETS - SAVING PEOPLE AND PLANTS INTO THE PROJECT DATA
// =============================================================================
//
// FILE       : Na__SceneAssets__Api__.js
// NAMESPACE  : Na__SceneApi
// MODULE     : System - Placed Assets
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Read what an author works on, save a window's people and plants
//              into the project data (R2 first, then the local copy), and take a
//              system out of the project altogether
// CREATED    : 15-Nov-2026
//
// DESCRIPTION:
// - THE SAME FOUR CALLS AS VALEVISION'S, SO THE SYSTEMS ABOVE ARE THE SAME CODE.
//   Vegetation and Entourage ask this file what to work on and hand it their
//   object to save. In ValeVision the calls go to its server, which keeps who did
//   what and holds an Employee's work for an admin. TrueVision has one author and
//   no such server, so the answer is the project data itself and every save goes
//   straight in: summary is always null, so no Change Log, and nothing waits.
// - THE PROJECT DATA IS WHERE THEY ARE SAVED. Each system is one top-level key of
//   TrueVision__ProjectData__.json (Vegetation__SceneData, Entourage__SceneData),
//   written the way the drawings are: R2 through the Worker first, because R2 is
//   the truth every viewer reads, then the repository copy through the
//   ProjectVision local server on localhost. Both keys are on all three keep-lists
//   (the app's Na__DevSavedKeys, the build's TRUEVISION_DEV_OWNED_KEYS, the
//   sync's DEV_OWNED_PROJECT_DATA_KEYS), so a push from SketchUp keeps them.
// - A SAVE REPLACES THE WHOLE KEY, SO IT FIRST ASKS WHETHER R2 STILL HOLDS WHAT
//   THIS WINDOW READ. Another window, the other computer or a script may have
//   saved since: then the save is refused with conflict true and nothing is
//   written, and a reload picks the newer planting up. ValeVision before its
//   staff routes (v2.85.0 to v2.88.0) did the same against its server.
// - ONE SNAPSHOT FOR BOTH COPIES. The object is copied once as the save starts,
//   so R2 and the local copy get exactly the same thing whatever is edited while
//   the write is on its way.
// - REMOVE ALL TAKES THE KEY OUT of R2 and of the local copy (Adam, v2.76.2:
//   "Delete should mean delete"). Both keys are also on the loader's and the
//   sync's absent-at-default lists, so a local copy the delete missed never
//   brings the planting back.
// - IT NEVER REJECTS. Every call resolves to { ok, error, ... }, as the local
//   mirror's do, and a refusal is the error's words for a toast.
// - AUTHORS ONLY. The page asks the authoring gate before anything is read or
//   written; a reader's page never imports this file.
//
// INTEGRATION:
// - Called by ../24__System__Vegetation/02__Core__Data/Na__Vegetation__SceneData__.js
//   and ../28__System__Entourage/02__Core__Data/Na__Entourage__SceneData__.js.
// - ./Na__SceneAssets__ChangesPanel__.js imports Approve and Revert; nothing in
//   TrueVision draws the Change Log that calls them.
// - @delegate: ../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js
// - @delegate: ../03__AppUtils/Na__AppUtils__LocalProjectMirror__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 22__System__SceneAssets/Na__SceneAssets__Api__.js 1.0.0 (v2.89.0)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : diverged (same exports and answers, different store)
// - Divergences   : ValeVision posts to its server's scene-assets routes, which keep
//                   who did what beside the record and hold staff work for an admin.
//                   TrueVision saves straight into the project data (R2, then the
//                   local copy), with a compare-before-write guard, and adds
//                   RemoveAll; Approve and Revert answer that there is nothing to
//                   approve or put back.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 15-Nov-2026 - Version 1.0.0 (TrueVision3D v2.185.0)
// - Initial build: ReadWorking, Save, RemoveAll, Approve and Revert for
//   TrueVision's project data.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | R2 Through the Worker, the Local Copy, the Authoring Gate
    // ------------------------------------------------------------
    import {
        Na__CfApi__IsConfigured,
        Na__CfApi__ReadProjectData,
        Na__CfApi__GetLoadedProjectData,
        Na__CfApi__MergeAndSaveKeys,
        Na__CfApi__DeleteProjectKeys
    } from '../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js';
    import { Na__LocalMirror__MergeKeys, Na__LocalMirror__DeleteKeys } from '../03__AppUtils/Na__AppUtils__LocalProjectMirror__.js';
    import { Na__DevGate__IsAuthoringEnabled } from '../03__AppUtils/Na__AppUtils__DevGate__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and Variables
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Each System's Key in the Project Data
    // ------------------------------------------------------------
    const Na__SceneApi__KEYS = {
        Vegetation : 'Vegetation__SceneData',
        Entourage  : 'Entourage__SceneData'
    };
    const Na__SceneApi__NO_LOG = 'TrueVision saves every change straight into the project data, so there is nothing to approve or put back';
    // ------------------------------------------------------------

    // MODULE VARIABLES | What R2 Held for Each Key When This Window Last Read or Wrote It
    // ------------------------------------------------------------
    // One canonical string per system, or undefined before the first read. A save
    // is measured against it.
    // ------------------------------------------------------------
    const Na__SceneApi__State = { seen : {} };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | An Object as One String, Whatever Order Its Keys Came In
    // ------------------------------------------------------------
    // The systems' own Canon, so a value read back from R2 compares equal to the
    // value written, key order apart.
    // ------------------------------------------------------------
    function Na__SceneApi__Canon(value) {
        const isPlain = (item) => item !== null && typeof item === 'object' && !Array.isArray(item);
        const tidy = (item) => {
            if (Array.isArray(item)) return item.map(tidy);
            if (!isPlain(item)) return item;
            const sorted = {};
            Object.keys(item).sort().forEach((key) => { sorted[key] = tidy(item[key]); });
            return sorted;
        };
        return JSON.stringify(value === undefined ? null : tidy(value));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Key for a System, or Null
    // ------------------------------------------------------------
    function Na__SceneApi__KeyOf(system) {
        return Object.prototype.hasOwnProperty.call(Na__SceneApi__KEYS, system) ? Na__SceneApi__KEYS[system] : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Why This Page Cannot Read or Write, or Null When It Can
    // ------------------------------------------------------------
    function Na__SceneApi__Refusal(system) {
        if (!Na__SceneApi__KeyOf(system)) return 'TrueVision has no placed assets called ' + String(system);
        if (!Na__DevGate__IsAuthoringEnabled()) return 'placing people and plants is for an author';
        if (!Na__CfApi__IsConfigured()) return 'the Cloudflare Worker is not configured, so nothing can be saved to R2';
        return null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Key as R2 Holds It Right Now: { ok, error, value }
    // ------------------------------------------------------------
    // value is null when the document or the key is not there.
    // ------------------------------------------------------------
    async function Na__SceneApi__ReadFromR2(key) {
        const read = await Na__CfApi__ReadProjectData();
        if (!read || !read.ok) return { ok : false, error : (read && read.error) || 'R2 could not be read', value : null };
        const data  = read.missing ? {} : (read.data || {});
        const value = data[key] === undefined ? null : data[key];
        return { ok : true, error : null, value };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What This Window Started From, When It Never Read R2 Itself
    // ------------------------------------------------------------
    function Na__SceneApi__LoadedValue(key) {
        const loaded = Na__CfApi__GetLoadedProjectData();
        if (!loaded || typeof loaded !== 'object') return null;
        return loaded[key] === undefined ? null : loaded[key];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Answer Every Call Shares
    // ------------------------------------------------------------
    function Na__SceneApi__Answer(extra) {
        return Object.assign({ ok : true, error : null, summary : null, me : null, isAdmin : true }, extra || {});
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Calls
// -----------------------------------------------------------------------------

    // FUNCTION | What an Author Works On
    // ------------------------------------------------------------
    // system: 'Entourage' or 'Vegetation'. Resolves to { ok, object, summary, me,
    // isAdmin }, read fresh from R2. object is null on a project with nothing yet.
    // ------------------------------------------------------------
    async function Na__SceneApi__ReadWorking(system) {
        try {
            const refusal = Na__SceneApi__Refusal(system);
            if (refusal) return { ok : false, error : refusal };
            const key  = Na__SceneApi__KeyOf(system);
            const read = await Na__SceneApi__ReadFromR2(key);
            if (!read.ok) return { ok : false, error : read.error };
            Na__SceneApi__State.seen[system] = Na__SceneApi__Canon(read.value);
            return Na__SceneApi__Answer({ object : read.value });
        } catch (error) {
            return { ok : false, error : (error && error.message) || 'R2 could not be read' };
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Save This Window's Object into the Project Data
    // ------------------------------------------------------------
    // base: the object as this window read it (unused here: what R2 held is kept
    // by this file). object: as it is now. Resolves to { ok, error, conflict?,
    // object, summary, me, isAdmin, approvedNow, counts, local }, where local is
    // the local copy's own result ({ ok, skipped, error }: skipped on the web).
    // ------------------------------------------------------------
    async function Na__SceneApi__Save(system, base, object) {
        try {
            const refusal = Na__SceneApi__Refusal(system);
            if (refusal) return { ok : false, error : refusal };
            if (!object || typeof object !== 'object') return { ok : false, error : 'there is nothing to save' };
            const key      = Na__SceneApi__KeyOf(system);
            const snapshot = JSON.parse(JSON.stringify(object));                  // <-- R2 and the local copy get exactly this

            // STILL WHAT THIS WINDOW READ? | Measured on R2, the truth every viewer reads
            const onR2 = await Na__SceneApi__ReadFromR2(key);
            if (!onR2.ok) return { ok : false, error : 'R2 could not be read before saving (' + onR2.error + '): nothing was written' };
            const seen = Na__SceneApi__State.seen[system] !== undefined
                ? Na__SceneApi__State.seen[system]
                : Na__SceneApi__Canon(Na__SceneApi__LoadedValue(key));
            if (Na__SceneApi__Canon(onR2.value) !== seen) {
                return {
                    ok       : false,
                    conflict : true,
                    error    : 'this was saved elsewhere since this window loaded it (another window, the other computer, or a script): reload to pick that up. Nothing was written'
                };
            }

            // R2 FIRST | Then the repository copy, as the drawings save does
            const cloud = await Na__CfApi__MergeAndSaveKeys({ [key] : snapshot });
            if (!cloud || !cloud.ok) return { ok : false, error : 'R2 refused the save: ' + ((cloud && cloud.error) || 'no answer') };
            Na__SceneApi__State.seen[system] = Na__SceneApi__Canon(snapshot);

            const local = await Na__LocalMirror__MergeKeys({ [key] : snapshot });
            if (!local.ok && !local.skipped) console.warn('[TrueVision3D ' + system + '] Saved to R2; the local copy was not written:', local.error);
            return Na__SceneApi__Answer({ object : snapshot, approvedNow : true, counts : null, local });
        } catch (error) {
            return { ok : false, error : (error && error.message) || 'the save did not go through' };
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Take a System Out of the Project Data: Final
    // ------------------------------------------------------------
    // Resolves to { ok, error, local }. R2 first: if it refuses, nothing changes.
    // ------------------------------------------------------------
    async function Na__SceneApi__RemoveAll(system) {
        try {
            const refusal = Na__SceneApi__Refusal(system);
            if (refusal) return { ok : false, error : refusal };
            const key   = Na__SceneApi__KeyOf(system);
            const cloud = await Na__CfApi__DeleteProjectKeys([key]);
            if (!cloud || !cloud.ok) return { ok : false, error : 'R2 refused the removal: ' + ((cloud && cloud.error) || 'no answer') };
            Na__SceneApi__State.seen[system] = Na__SceneApi__Canon(null);

            const local = await Na__LocalMirror__DeleteKeys([key]);
            if (!local.ok && !local.skipped) console.warn('[TrueVision3D ' + system + '] Removed from R2; the local copy still holds it:', local.error);
            return { ok : true, error : null, local };
        } catch (error) {
            return { ok : false, error : (error && error.message) || 'the removal did not go through' };
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Approve What Is Waiting: Nothing Waits in TrueVision
    // ------------------------------------------------------------
    async function Na__SceneApi__Approve(system, byCode) {
        return { ok : false, error : Na__SceneApi__NO_LOG };
    }
    // ------------------------------------------------------------


    // FUNCTION | Put Someone's Changes Back: There Is No Log of Them in TrueVision
    // ------------------------------------------------------------
    async function Na__SceneApi__Revert(system, ofCode) {
        return { ok : false, error : Na__SceneApi__NO_LOG };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Placed Assets API
    // ------------------------------------------------------------
    export {
        Na__SceneApi__KEYS,
        Na__SceneApi__ReadWorking,
        Na__SceneApi__Save,
        Na__SceneApi__RemoveAll,
        Na__SceneApi__Approve,
        Na__SceneApi__Revert
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
