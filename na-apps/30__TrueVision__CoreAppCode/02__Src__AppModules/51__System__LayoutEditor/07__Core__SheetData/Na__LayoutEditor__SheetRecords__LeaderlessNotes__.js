// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET RECORDS - LEADERLESS NOTES
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetRecords__LeaderlessNotes__.js
// NAMESPACE  : Na__LeRec
// MODULE     : Layout Editor - Sheet Records - Leaderless Notes
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The shape of a sheet's leaderless notes: the switch and the specification groups it lists without bubbles, in the order they print
// CREATED    : 22-Sep-2026
//
// DESCRIPTION:
// - LEADERLESS NOTES are whole specification groups a sheet lists whether or
//   not a bubble on it links to them: a project introduction, or a block of
//   notes that needs no leader. They are printed first, before the notes the
//   sheet's bubbles link to (Na__LayoutEditor__SpecMargin__ lists them). They
//   live on the sheet's notes margin record, beside the overspill note
//   regions, so they are switched, undone, drafted and saved with it:
//     Sheet__MarginNotes.LeaderlessOn      true while the groups are listed;
//                                          stored only as true
//     Sheet__MarginNotes.LeaderlessGroups  [ group id ] in the order they
//                                          print, no repeats; stored only
//                                          when there is one, and kept while
//                                          LeaderlessOn is off, so the switch
//                                          puts them back as they were
// - AN ID THE SPECIFICATION DOES NOT HAVE (YET) IS KEPT: the specification
//   loads after the sheets, and a group deleted from it simply lists nothing.
// - A SHEET THAT NEVER LISTED A GROUP THIS WAY IS EXACTLY WHAT IT WAS: neither
//   key is added to a margin record that has none, so every sheet saved
//   before today normalises byte-identical.
// - Pure record arithmetic, like the rest of the sheet records: nothing here
//   dispatches, touches session state, reads the config or knows the DOM, so
//   the sheet records can import it without a cycle.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetRecords__ calls NormaliseLeaderlessNotes from
//   NormaliseMarginNotes. The sheet model's Sheets unit (UpdateMarginNotes),
//   the specification margin and the Margin Notes panel's Leaderless Notes
//   part import this file by name, as the note regions' leaf is imported,
//   rather than through the sheet records.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (22-Sep-2026)
// - ValeVision    : not yet ported. Nothing here is app-specific.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Normalisation
// -----------------------------------------------------------------------------

    // FUNCTION | A List of Group Ids Made Whole: Strings Only, in Order, No Repeats
    // ------------------------------------------------------------
    function Na__LeRec__LeaderlessIdsOf(raw) {
        const ids = [];
        (Array.isArray(raw) ? raw : []).forEach((groupId) => {
            if (typeof groupId === 'string' && groupId && ids.indexOf(groupId) === -1) ids.push(groupId);
        });
        return ids;
    }
    // ------------------------------------------------------------


    // FUNCTION | Fill In the Leaderless Groups on a Normalised Notes Margin Record (mutates the record)
    // ------------------------------------------------------------
    // raw is the record as it was before its margin keys were rebuilt; notes
    // is the rebuilt one. LeaderlessOn is written only as true and
    // LeaderlessGroups only when there is one, so a margin that never listed
    // a group this way gains no key.
    // ------------------------------------------------------------
    function Na__LeRec__NormaliseLeaderlessNotes(raw, notes) {
        if (!notes || typeof notes !== 'object') return notes;
        const source = (raw && typeof raw === 'object') ? raw : {};
        if (source.LeaderlessOn === true) notes.LeaderlessOn = true;
        const ids = Na__LeRec__LeaderlessIdsOf(source.LeaderlessGroups);
        if (ids.length) notes.LeaderlessGroups = ids;
        return notes;
    }
    // ------------------------------------------------------------


    // FUNCTION | One Group Ticked or Unticked (returns a fresh list; the record is not touched)
    // ------------------------------------------------------------
    // A group ticked joins the END of the list - it prints after the groups
    // already listed, until it is dragged up - and one ticked twice stays
    // where it is. A group unticked leaves; the rest keep their order.
    // ------------------------------------------------------------
    function Na__LeRec__LeaderlessToggled(list, groupId, on) {
        const ids = Na__LeRec__LeaderlessIdsOf(list);
        if (typeof groupId !== 'string' || !groupId) return ids;
        if (on !== true) return ids.filter((id) => id !== groupId);
        return ids.indexOf(groupId) === -1 ? ids.concat([ groupId ]) : ids;
    }
    // ------------------------------------------------------------


    // FUNCTION | One Group Moved to Another Place in the List (returns a fresh list; the record is not touched)
    // ------------------------------------------------------------
    // index is where it lands in the WHOLE list, counted before it is lifted
    // out - the place of the group it is dropped on, as the Layers grip
    // reorders - so it is taken out and put back at that index: dropped on a
    // later group it lands after it, on an earlier one before it. An index
    // past either end is held to it; a group the list does not have, or no
    // move at all, answers the list unchanged.
    // ------------------------------------------------------------
    function Na__LeRec__LeaderlessMoved(list, groupId, index) {
        const ids  = Na__LeRec__LeaderlessIdsOf(list);
        const from = ids.indexOf(groupId);
        if (from === -1 || typeof index !== 'number' || !Number.isFinite(index)) return ids;
        const to = Math.max(0, Math.min(ids.length - 1, Math.round(index)));
        if (to === from) return ids;
        ids.splice(from, 1);
        ids.splice(to, 0, groupId);
        return ids;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Readers (never write)
// -----------------------------------------------------------------------------

    // FUNCTION | Are a Sheet's Leaderless Notes Switched On
    // ------------------------------------------------------------
    function Na__LeRec__LeaderlessOn(sheet) {
        const notes = sheet ? sheet.Sheet__MarginNotes : null;
        return !!(notes && typeof notes === 'object' && notes.LeaderlessOn === true);
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Group a Sheet Keeps to List Without Leaders, Listed or Not (a fresh list; [] for none)
    // ------------------------------------------------------------
    function Na__LeRec__LeaderlessGroups(sheet) {
        const notes = sheet ? sheet.Sheet__MarginNotes : null;
        return (notes && typeof notes === 'object') ? Na__LeRec__LeaderlessIdsOf(notes.LeaderlessGroups) : [];
    }
    // ------------------------------------------------------------


    // FUNCTION | The Groups a Sheet Lists Without Leaders, in Print Order: Every One While Switched On, None Otherwise
    // ------------------------------------------------------------
    function Na__LeRec__ListedLeaderlessGroups(sheet) {
        return Na__LeRec__LeaderlessOn(sheet) ? Na__LeRec__LeaderlessGroups(sheet) : [];
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Sheet Records Leaderless Notes API
    // ------------------------------------------------------------
    export {
        Na__LeRec__NormaliseLeaderlessNotes,
        Na__LeRec__LeaderlessToggled,
        Na__LeRec__LeaderlessMoved,
        Na__LeRec__LeaderlessOn,
        Na__LeRec__LeaderlessGroups,
        Na__LeRec__ListedLeaderlessGroups
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
