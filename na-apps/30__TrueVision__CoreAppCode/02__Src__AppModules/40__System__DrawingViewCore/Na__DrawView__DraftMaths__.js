// =============================================================================
// TRUEVISION3D - DRAWING VIEW CORE - DRAFT MATHS
// =============================================================================
//
// FILE       : Na__DrawView__DraftMaths__.js
// NAMESPACE  : Na__DraftMath
// MODULE     : Drawing View Core - Draft Maths
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Snapshot a drawing record, tell whether it has changed, put it back, and keep an unfinished edit out of a save
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - A FLOOR PLAN OR AN ELEVATION IS A FEW NUMBERS, AND SHEETS ARE DRAWN FROM
//   THEM. Move a plane 200 mm and every viewport of that drawing moves under
//   its own dimensions and notes. So an edit to those numbers is held as a
//   DRAFT until its author says Update, and these are the four things a draft
//   needs that have nothing to do with a panel, a modal or a project:
//     Snapshot          - the record as it was last saved, as text
//     ChangedKeys       - which of its fields differ now
//     RestoreInPlace    - put it back, in the SAME object
//     SubstituteRecord  - hand a save the saved record, not the edited one
// - IN THE SAME OBJECT, because a drawing record is held by reference all over
//   the app: the mode controller compares the active drawing by identity, the
//   markup overlay and its undo stack hold the record's own annotation arrays.
//   A restore that swapped in a fresh object would leave all of them pointing
//   at the edit that was just thrown away. Arrays are emptied and refilled,
//   never replaced.
// - VIEW STATE IS NOT AN EDIT. The mode controllers write the zoom and the pan
//   of a previewed drawing into its record every time the view settles, so a
//   record "changes" by being looked at. Callers name those keys and they are
//   left out of the comparison and out of the restore.
// - Imports nothing, so it runs under Node for its test.
//
// INTEGRATION:
// - Na__DrawView__DraftGuard__ owns the live draft and calls all four.
// - 80__Testing__PrototypeEnvironment/Na__Test__DrawingDrafts__.test.mjs
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
// - Initial implementation, for the Floor Plans and Elevations menu rebuild.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Canonical Text
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Value With Its Object Keys in a Fixed Order
    // ------------------------------------------------------------
    // Two records that hold the same data must compare equal whatever order
    // their keys were written in - a restore writes them back in the
    // snapshot's order, a normaliser appends the ones it fills in. undefined
    // is dropped, as JSON drops it.
    // ------------------------------------------------------------
    function Na__DraftMath__Ordered(value) {
        if (Array.isArray(value)) return value.map(Na__DraftMath__Ordered);
        if (value && typeof value === 'object') {
            const ordered = {};
            Object.keys(value).sort().forEach((key) => {
                if (value[key] !== undefined) ordered[key] = Na__DraftMath__Ordered(value[key]);
            });
            return ordered;
        }
        return value;
    }
    // ------------------------------------------------------------


    // FUNCTION | One Value as Canonical Text
    // ------------------------------------------------------------
    function Na__DraftMath__Canonical(value) {
        return JSON.stringify(Na__DraftMath__Ordered(value === undefined ? null : value));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Snapshot and Compare
// -----------------------------------------------------------------------------

    // FUNCTION | A Record as It Stands, as Text
    // ------------------------------------------------------------
    // Text and not a clone: it cannot be edited by accident, and it costs
    // nothing to hold. Returns '' for something that is not a record.
    // ------------------------------------------------------------
    function Na__DraftMath__Snapshot(record) {
        if (!record || typeof record !== 'object' || Array.isArray(record)) return '';
        return JSON.stringify(record);
    }
    // ------------------------------------------------------------


    // FUNCTION | A Snapshot Back as a Fresh Object, or Null
    // ------------------------------------------------------------
    function Na__DraftMath__Parse(snapshot) {
        if (typeof snapshot !== 'string' || snapshot === '') return null;
        try {
            const parsed = JSON.parse(snapshot);
            return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : null;
        } catch (_) {
            return null;
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | The Top-Level Keys That Differ Between a Snapshot and a Record
    // ------------------------------------------------------------
    // ignoreKeys: view state, left out. Sorted, so a list of changes reads the
    // same way every time.
    // ------------------------------------------------------------
    function Na__DraftMath__ChangedKeys(snapshot, record, ignoreKeys) {
        const before = Na__DraftMath__Parse(snapshot);
        if (!before || !record || typeof record !== 'object') return [];

        const ignore = new Set(Array.isArray(ignoreKeys) ? ignoreKeys : []);
        const keys   = new Set(Object.keys(before).concat(Object.keys(record)));
        const changed = [];

        keys.forEach((key) => {
            if (ignore.has(key)) return;
            if (Na__DraftMath__Canonical(before[key]) !== Na__DraftMath__Canonical(record[key])) changed.push(key);
        });
        return changed.sort();
    }
    // ------------------------------------------------------------


    // FUNCTION | Has a Record Changed Since Its Snapshot
    // ------------------------------------------------------------
    function Na__DraftMath__IsChanged(snapshot, record, ignoreKeys) {
        return Na__DraftMath__ChangedKeys(snapshot, record, ignoreKeys).length > 0;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Restore
// -----------------------------------------------------------------------------

    // FUNCTION | Put a Record Back to Its Snapshot, in the Same Object
    // ------------------------------------------------------------
    // keepKeys: view state, left as it is now. A key the snapshot never had is
    // removed; an array that is an array on both sides is emptied and refilled
    // so whoever holds it keeps holding the right one. Returns the keys it
    // touched.
    // ------------------------------------------------------------
    function Na__DraftMath__RestoreInPlace(record, snapshot, keepKeys) {
        const before = Na__DraftMath__Parse(snapshot);
        if (!before || !record || typeof record !== 'object') return [];

        const keep    = new Set(Array.isArray(keepKeys) ? keepKeys : []);
        const touched = [];

        Object.keys(record).forEach((key) => {
            if (keep.has(key) || Object.prototype.hasOwnProperty.call(before, key)) return;
            delete record[key];                                                  // <-- Added since the snapshot
            touched.push(key);
        });

        Object.keys(before).forEach((key) => {
            if (keep.has(key)) return;
            if (Na__DraftMath__Canonical(before[key]) === Na__DraftMath__Canonical(record[key])) return;

            if (Array.isArray(before[key]) && Array.isArray(record[key])) {
                record[key].length = 0;                                          // <-- The SAME array: the markup overlay and its undo stack hold it
                before[key].forEach((entry) => record[key].push(entry));
            } else {
                record[key] = before[key];
            }
            touched.push(key);
        });
        return touched.sort();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Keeping a Draft Out of a Save
// -----------------------------------------------------------------------------

    // FUNCTION | Swap One Record in a Save's Payload for Its Snapshot
    // ------------------------------------------------------------
    // payload is a COPY about to be written. path names where the record's
    // array sits in it ([ blockKey, arrayKey ]), idKey and id pick the record.
    // The copy's record is replaced by the snapshot, so a save made by
    // somebody else - Save Sheets, the register, north - writes the drawing as
    // it was last updated and not as it is half way through being moved.
    // Returns true when a record was swapped.
    // ------------------------------------------------------------
    function Na__DraftMath__SubstituteRecord(payload, path, idKey, id, snapshot) {
        const before = Na__DraftMath__Parse(snapshot);
        if (!before || !payload || typeof payload !== 'object' || !Array.isArray(path)) return false;

        let holder = payload;
        for (let i = 0; i < path.length; i++) {
            holder = (holder && typeof holder === 'object') ? holder[path[i]] : null;
        }
        if (!Array.isArray(holder)) return false;

        for (let i = 0; i < holder.length; i++) {
            if (holder[i] && holder[i][idKey] === id) {
                holder[i] = before;
                return true;
            }
        }
        return false;                                                            // <-- Not in this save: nothing to keep out of it
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Draft Maths API
    // ------------------------------------------------------------
    export {
        Na__DraftMath__Canonical,
        Na__DraftMath__Snapshot,
        Na__DraftMath__Parse,
        Na__DraftMath__ChangedKeys,
        Na__DraftMath__IsChanged,
        Na__DraftMath__RestoreInPlace,
        Na__DraftMath__SubstituteRecord
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
