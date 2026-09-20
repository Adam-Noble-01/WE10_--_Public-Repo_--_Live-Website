// =============================================================================
// TRUEVISION3D - DRAWING VIEW CORE - DRAFT GUARD
// =============================================================================
//
// FILE       : Na__DrawView__DraftGuard__.js
// NAMESPACE  : Na__DrawDraft
// MODULE     : Drawing View Core - Draft Guard
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Hold the one drawing being edited as a DRAFT - nothing about it is kept until Update, nothing else can save it by accident, and it cannot be walked away from half done
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - THE FAULT. A floor plan's cut and an elevation's plane and bearing are
//   live numbers in the project's drawings block, and every sheet viewport is
//   drawn FROM them. The Dev menu rows wrote to those numbers the instant a
//   slider moved, on every row at once, and the block is written whole by
//   whoever saves next - Save Sheets, the register, north, a rename. So one
//   nudged slider, an hour later and from a different panel, moved every
//   viewport of that drawing out from under its dimensions. ("You can destroy
//   an entire project's viewports by moving a few of these around" - Adam.)
//   The panels' own Save buttons, meanwhile, had not written a drawing record
//   since the records left the presentation block in v2.21.0.
//
// - THE RULE. Exactly one drawing is open across both panels (the row
//   accordion), and the open drawing is a DRAFT:
//     1. Opening a row snapshots its record. Edits still land on the live
//        record, because the preview, the plane in the 3D view and the sheets
//        all read it - so what is being set up is what is seen.
//     2. UPDATE is the only thing that keeps a draft: it asks, names what
//        changed and which sheets draw from it, and writes R2 and the local
//        copy in one save.
//     3. LEAVING A CHANGED ROW ASKS - fold it, open another, close the panel,
//        add a drawing. Discard puts the record back exactly; Keep Editing
//        stays. A changed drawing is never left lying about unopened.
//     4. ANYONE ELSE'S SAVE WRITES THE SNAPSHOT. While a draft is changed,
//        the copy any other save is about to write has this drawing swapped
//        back to how it was last updated (Na__DrawData__RegisterPayloadGuard).
//
// - Each panel registers an OWNER for its drawing type: how to find a record,
//   which keys are view state, how to put a change into words, and what to
//   re-derive after a discard. This module knows nothing else about a plan or
//   an elevation.
//
// INTEGRATION:
// - Na__FloorPlan__DevMenu__Editor__ and Na__Elevation__DevMenu__Editor__
//   register owners and call SaveActive / SaveBlock.
// - Na__DrawView__RowAccordion__ asks ConfirmLeave before its slot moves and
//   tells this module when it has.
// // @delegate: ./Na__DrawView__DraftMaths__.js
// // @delegate: ./Na__DrawView__ProjectData__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (20-Sep-2026)
// - ValeVision    : not yet ported. ValeVision's rows fold already and save
//                   through Na__DrawData__Save, but still write live.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation, for the Floor Plans and Elevations menu rebuild.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Draft Maths, the Drawings Block's Save and the Row Accordion
    // ------------------------------------------------------------
    import {
        Na__DraftMath__Snapshot,
        Na__DraftMath__Parse,
        Na__DraftMath__ChangedKeys,
        Na__DraftMath__RestoreInPlace,
        Na__DraftMath__SubstituteRecord
    } from './Na__DrawView__DraftMaths__.js';
    import {
        Na__DrawData__CHANGED_EVENT,
        Na__DrawData__RegisterPayloadGuard,
        Na__DrawData__Save
    } from './Na__DrawView__ProjectData__.js';
    import {
        Na__DrawFold__GetOpenId,
        Na__DrawFold__SetOpenId,
        Na__DrawFold__SetChangeGuard,
        Na__DrawFold__OnOpenChanged
    } from './Na__DrawView__RowAccordion__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Dev Menu's Confirm Dialog
    // ------------------------------------------------------------
    // @delegate: ../21__System__PresentationMode/Na__PresentationMode__DevMenu__Modal__.js
    // ------------------------------------------------------------
    import { Na__PresentationMode__DevMenu__Confirm } from '../21__System__PresentationMode/Na__PresentationMode__DevMenu__Modal__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Event
    // ------------------------------------------------------------
    // Raised when a draft begins, ends, is discarded or is kept - NOT on every
    // edit. A row that wants its "not updated" chip live refreshes it itself
    // after each of its own handlers.
    // ------------------------------------------------------------
    const Na__DrawDraft__CHANGED_EVENT = 'na-drawview-draft-changed';            // <-- detail : { reason, type, id }
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Owners, the One Draft, and Whether It Is Being Kept
    // ------------------------------------------------------------
    const Na__DrawDraft__Owners = new Map();   // <-- type -> owner
    let   Na__DrawDraft__Active = null;        // <-- { type, id, record, snapshot, owner } | null
    let   Na__DrawDraft__Keeping = false;      // <-- True only inside SaveActive: the draft's own Update goes out as it stands
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Owners
// -----------------------------------------------------------------------------

    // FUNCTION | Register What a Panel Knows About Its Drawing Type
    // ------------------------------------------------------------
    // owner: {
    //   word        : 'elevation' | 'floor plan'     - for the dialogs
    //   idKey       : 'Elevation__Id'
    //   nameKey     : 'Elevation__Name'
    //   arrayPath   : [ blockKey, arrayKey ]         - where its records sit in a save
    //   viewKeys    : [ ... ]                        - view state: never an edit
    //   find        : (id) => record | null
    //   prepare     : (record) => void               - settle defaults BEFORE the snapshot (optional)
    //   afterBegin  : (record) => void               - bring derived fields into step AFTER it, as a change (optional)
    //   describe    : (before, record, keys) => [ 'Plane moved 250 mm', ... ]
    //   afterRevert : (record, touchedKeys) => void  - re-derive what the record drives (optional)
    // }
    // ------------------------------------------------------------
    function Na__DrawDraft__RegisterOwner(type, owner) {
        if (!type || !owner || typeof owner.find !== 'function') return false;
        Na__DrawDraft__Owners.set(type, owner);

        // A row opened before its panel had registered - the accordion's slot
        // outlives a panel render - gets its draft now.
        if (!Na__DrawDraft__Active) Na__DrawDraft__BeginForId(Na__DrawFold__GetOpenId());
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Draft
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Tell the Panels a Draft Has Begun, Ended or Been Settled
    // ------------------------------------------------------------
    function Na__DrawDraft__Announce(reason, draft) {
        window.dispatchEvent(new CustomEvent(Na__DrawDraft__CHANGED_EVENT, {
            detail : { reason : reason, type : draft ? draft.type : null, id : draft ? draft.id : null }
        }));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Begin a Draft on Whichever Drawing Owns This Id
    // ------------------------------------------------------------
    // Plan and elevation ids never collide (FloorPlan_001, Elevation_001), so
    // the first owner that finds the id is the right one.
    // ------------------------------------------------------------
    function Na__DrawDraft__BeginForId(id) {
        if (!id) return false;
        for (const [type, owner] of Na__DrawDraft__Owners) {
            let record = null;
            try { record = owner.find(id); } catch (_) { record = null; }
            if (!record) continue;

            if (typeof owner.prepare === 'function') {
                try { owner.prepare(record); } catch (prepareError) {
                    console.warn('[TrueVision3D] Draft prepare failed for ' + id + ':', prepareError);
                }
            }
            Na__DrawDraft__Active = {
                type     : type,
                id       : id,
                record   : record,
                snapshot : Na__DraftMath__Snapshot(record),
                owner    : owner
            };

            // AFTER THE SNAPSHOT | Anything the owner brings into step here is a
            // CHANGE, and shows as one: an automatic name catching up with a
            // north that was set since the drawing was last updated.
            if (typeof owner.afterBegin === 'function') {
                try { owner.afterBegin(record); } catch (beginError) {
                    console.warn('[TrueVision3D] Draft afterBegin failed for ' + id + ':', beginError);
                }
            }
            Na__DrawDraft__Announce('begin', Na__DrawDraft__Active);
            return true;
        }
        return false;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Drawing Being Edited, or Null
    // ------------------------------------------------------------
    function Na__DrawDraft__GetActive() {
        const draft = Na__DrawDraft__Active;
        return draft ? { type : draft.type, id : draft.id, record : draft.record } : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is This the Drawing Being Edited
    // ------------------------------------------------------------
    function Na__DrawDraft__IsActive(type, id) {
        const draft = Na__DrawDraft__Active;
        return Boolean(draft && draft.type === type && draft.id === id);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Record's Top-Level Keys That Differ From Its Snapshot
    // ------------------------------------------------------------
    function Na__DrawDraft__ChangedKeys() {
        const draft = Na__DrawDraft__Active;
        if (!draft) return [];
        return Na__DraftMath__ChangedKeys(draft.snapshot, draft.record, draft.owner.viewKeys);
    }
    // ------------------------------------------------------------


    // FUNCTION | Has the Open Drawing Been Changed Since It Was Last Updated
    // ------------------------------------------------------------
    function Na__DrawDraft__IsDirty() {
        return Na__DrawDraft__ChangedKeys().length > 0;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Record as It Was Last Updated (a Copy), or Null
    // ------------------------------------------------------------
    function Na__DrawDraft__GetBaseline() {
        return Na__DrawDraft__Active ? Na__DraftMath__Parse(Na__DrawDraft__Active.snapshot) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Changes, in the Owner's Words
    // ------------------------------------------------------------
    function Na__DrawDraft__Describe() {
        const draft = Na__DrawDraft__Active;
        if (!draft) return [];
        const keys = Na__DrawDraft__ChangedKeys();
        if (keys.length === 0) return [];
        if (typeof draft.owner.describe !== 'function') return keys.slice();
        try {
            const lines = draft.owner.describe(Na__DraftMath__Parse(draft.snapshot) || {}, draft.record, keys);
            return Array.isArray(lines) ? lines.filter((line) => typeof line === 'string' && line !== '') : keys.slice();
        } catch (describeError) {
            console.warn('[TrueVision3D] Draft describe failed:', describeError);
            return keys.slice();
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | What the Open Drawing Is Called
    // ------------------------------------------------------------
    // The name it was last UPDATED under when that differs, because that is
    // the name on its card and its sheets - the one the author would look for.
    // ------------------------------------------------------------
    function Na__DrawDraft__ActiveName() {
        const draft = Na__DrawDraft__Active;
        if (!draft) return '';
        const before = Na__DraftMath__Parse(draft.snapshot) || {};
        return String(before[draft.owner.nameKey] || draft.record[draft.owner.nameKey] || draft.id);
    }
    // ------------------------------------------------------------


    // FUNCTION | Put the Open Drawing Back to How It Was Last Updated
    // ------------------------------------------------------------
    // In place - see the draft maths - then the owner re-derives whatever the
    // record drives: the drawing on screen, its plane, the panel.
    // ------------------------------------------------------------
    function Na__DrawDraft__Revert() {
        const draft = Na__DrawDraft__Active;
        if (!draft) return false;

        const touched = Na__DraftMath__RestoreInPlace(draft.record, draft.snapshot, draft.owner.viewKeys);
        if (touched.length > 0 && typeof draft.owner.afterRevert === 'function') {
            try { draft.owner.afterRevert(draft.record, touched); } catch (revertError) {
                console.warn('[TrueVision3D] Draft afterRevert failed:', revertError);
            }
        }
        Na__DrawDraft__Announce('revert', draft);
        return touched.length > 0;
    }
    // ------------------------------------------------------------


    // FUNCTION | Keep the Open Drawing as It Stands (after its save has landed)
    // ------------------------------------------------------------
    function Na__DrawDraft__Commit() {
        const draft = Na__DrawDraft__Active;
        if (!draft) return false;
        draft.snapshot = Na__DraftMath__Snapshot(draft.record);
        Na__DrawDraft__Announce('commit', draft);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Forget the Draft Without Touching Its Record
    // ------------------------------------------------------------
    // For a drawing that is being deleted, and for a project that has gone.
    // ------------------------------------------------------------
    function Na__DrawDraft__End() {
        const draft = Na__DrawDraft__Active;
        if (!draft) return false;
        Na__DrawDraft__Active = null;
        Na__DrawDraft__Announce('end', draft);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Leaving a Changed Drawing
// -----------------------------------------------------------------------------

    // FUNCTION | May the Open Drawing Be Left? Asks When It Has Changes
    // ------------------------------------------------------------
    // Resolves true when there is nothing to lose, or the author chose to
    // discard (the record is put back before this resolves). Resolves false
    // for Keep Editing. The accordion asks this before its slot moves; a
    // panel asks it before closing or adding a drawing.
    // ------------------------------------------------------------
    async function Na__DrawDraft__ConfirmLeave() {
        const draft = Na__DrawDraft__Active;
        if (!draft || !Na__DrawDraft__IsDirty()) return true;

        const name = Na__DrawDraft__ActiveName();
        const discard = await Na__PresentationMode__DevMenu__Confirm({
            title         : 'Discard the changes to "' + name + '"?',
            message       : 'This ' + (draft.owner.word || 'drawing') + ' has been changed and not updated. '
                          + 'Nothing has been saved. Discard puts it back exactly as it was last updated; '
                          + 'Keep Editing leaves it open so you can press Update.',
            details       : Na__DrawDraft__Describe(),
            confirmLabel  : 'Discard Changes',
            cancelLabel   : 'Keep Editing',
            isDestructive : true
        });
        if (!discard) return false;

        Na__DrawDraft__Revert();
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Saving
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Keep a Changed Draft Out of a Save It Did Not Ask For
    // ------------------------------------------------------------
    // Handed the COPY the drawings block's save is about to write.
    // ------------------------------------------------------------
    function Na__DrawDraft__GuardPayload(payloadCopy) {
        const draft = Na__DrawDraft__Active;
        if (!draft || Na__DrawDraft__Keeping || !Na__DrawDraft__IsDirty()) return;

        const swapped = Na__DraftMath__SubstituteRecord(
            payloadCopy, draft.owner.arrayPath, draft.owner.idKey, draft.id, draft.snapshot
        );
        if (swapped) {
            console.log('[TrueVision3D] "' + Na__DrawDraft__ActiveName() + '" has changes that have not been updated - '
                + 'this save wrote it as it was last updated.');
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Save the Open Drawing as It Stands - Its Own Update
    // ------------------------------------------------------------
    // The one save the guard stands aside for. R2, then the local copy, as
    // every drawings save. On success the draft is kept; on failure it is
    // left changed, so Update can be pressed again or the row discarded.
    // ------------------------------------------------------------
    async function Na__DrawDraft__SaveActive(showToast, report) {
        if (!Na__DrawDraft__Active) return false;

        Na__DrawDraft__Keeping = true;
        let saved = false;
        try {
            saved = await Na__DrawData__Save(showToast, report);
        } finally {
            Na__DrawDraft__Keeping = false;
        }
        if (saved) Na__DrawDraft__Commit();
        return saved;
    }
    // ------------------------------------------------------------


    // FUNCTION | Save the Drawings Block for Some Other Reason
    // ------------------------------------------------------------
    // A drawing added or deleted, the client measuring grant. The guard
    // applies, so a changed draft goes out as it was last updated.
    // ------------------------------------------------------------
    function Na__DrawDraft__SaveBlock(showToast, report) {
        return Na__DrawData__Save(showToast, report);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Wiring (runs once, as the module loads)
// -----------------------------------------------------------------------------

    // The drawings block's save hands its payload copy over here first.
    Na__DrawData__RegisterPayloadGuard(Na__DrawDraft__GuardPayload);

    // The accordion asks before its slot moves...
    Na__DrawFold__SetChangeGuard(() => Na__DrawDraft__ConfirmLeave());

    // ...and says when it has: the draft follows the open row. A draft still
    // changed at this point was moved past on purpose (a delete, a project
    // change) - the asking was done by whoever moved the slot.
    Na__DrawFold__OnOpenChanged((openId) => {
        if (Na__DrawDraft__Active && Na__DrawDraft__Active.id !== openId) Na__DrawDraft__End();
        if (openId && !Na__DrawDraft__Active) Na__DrawDraft__BeginForId(openId);
    });

    // A project change replaces every record: a draft of the last project's
    // drawing is a snapshot of something that no longer exists.
    if (typeof window !== 'undefined') {
        window.addEventListener(Na__DrawData__CHANGED_EVENT, (event) => {
            if (!event.detail || event.detail.reason !== 'loaded') return;
            Na__DrawDraft__End();
            Na__DrawFold__SetOpenId(null);
        });
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Draft Guard API
    // ------------------------------------------------------------
    export {
        Na__DrawDraft__CHANGED_EVENT,
        Na__DrawDraft__RegisterOwner,
        Na__DrawDraft__GetActive,
        Na__DrawDraft__IsActive,
        Na__DrawDraft__IsDirty,
        Na__DrawDraft__ChangedKeys,
        Na__DrawDraft__GetBaseline,
        Na__DrawDraft__Describe,
        Na__DrawDraft__ActiveName,
        Na__DrawDraft__Revert,
        Na__DrawDraft__Commit,
        Na__DrawDraft__End,
        Na__DrawDraft__ConfirmLeave,
        Na__DrawDraft__SaveActive,
        Na__DrawDraft__SaveBlock
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
