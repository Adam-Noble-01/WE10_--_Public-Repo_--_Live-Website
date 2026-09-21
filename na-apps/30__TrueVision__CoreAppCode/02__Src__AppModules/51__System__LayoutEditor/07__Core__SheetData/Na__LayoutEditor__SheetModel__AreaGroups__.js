// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET MODEL - AREA GROUPS
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetModel__AreaGroups__.js
// NAMESPACE  : Na__LeModel
// MODULE     : Layout Editor - Sheet Model - Area Groups
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : A sheet's floor area groups - Ground Floor, First Floor, Garage - and the rooms filed under them
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - Sheet__AreaGroups is a list of { AreaGroup__Name, AreaGroup__Colour } in
//   the order they are shown and reported. It is the ONLY part of the floor
//   area system that is not carried on a shape, because a group has to be able
//   to exist before anything is filed under it and to survive its last room
//   being deleted.
// - A GROUP IS KNOWN BY ITS NAME. An area holds `Area__Group : 'Ground Floor'`
//   rather than an id, so a room copied to another sheet - or to another
//   project through the Custom Scrapbook - brings its group with it and cannot
//   be silently filed under whatever a per-sheet id happens to mean there.
//   Renaming a group therefore rewrites every room that names it, which is
//   what Rename does, in one announcement.
// - ANNOUNCED AS 'areas', a CONTENT change: it is drawn on the paper and
//   belongs in the browser draft and in Save Sheets, and it must NEVER go out
//   as 'sheet-updated', which the auto save reads as a settings change and
//   answers by writing the whole project to R2.
// - The silent forms exist so a caller that changes several things - a rename
//   that also re-points a schedule - can announce once and give the history
//   one step.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetModel__ re-exports this unit's API. Every other
//   module imports Na__LayoutEditor__SheetModel__.js, never this unit.
// - 59__Feature__FloorAreas is the only caller.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026)
// - ValeVision    : not yet ported - it goes with the rest of Floor Areas.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation: the list, add, rename, recolour, move, delete, and
//   the announcement every floor area edit is carried by.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Record Helpers and the Sheet Model State
    // ------------------------------------------------------------
    import { Na__LeRec__NormaliseAreaGroups } from './Na__LayoutEditor__SheetRecords__.js';
    import { Na__LeModel__Touch, Na__LeModel__AssignDirty } from './Na__LayoutEditor__SheetModel__State__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Reason Every Floor Area Change Is Announced With
    // ------------------------------------------------------------
    // One reason for the whole feature: a group edit, a room's name, the group
    // it is filed under. The sheet's own shapes still announce 'shape' and
    // 'shapes' as they always have, because a room IS a vector.
    // ------------------------------------------------------------
    const Na__LeModel__AREAS_REASON = 'areas';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Name as It Is Compared: Trimmed, Squeezed and Case-Blind
    // ------------------------------------------------------------
    // Two groups differing only in case or in spacing are one group. Somebody
    // typing "ground floor" after a paste brought in "Ground Floor" means the
    // same floor, and a schedule that reported them as two would be wrong in a
    // way nobody would spot.
    // ------------------------------------------------------------
    function Na__LeModel__AreaGroupKey(name) {
        return String(name === undefined || name === null ? '' : name).replace(/\s+/g, ' ').trim().toLowerCase();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Sheet's Rooms (shapes carrying a floor area block)
    // ------------------------------------------------------------
    function Na__LeModel__AreaShapes(sheet) {
        return (sheet && Array.isArray(sheet.Sheet__Shapes) ? sheet.Sheet__Shapes : [])
            .filter((shape) => !!shape && !!shape.Shape__Area && typeof shape.Shape__Area === 'object');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Area Groups
// -----------------------------------------------------------------------------

    // FUNCTION | The Sheet's Groups, Tidied (never writes)
    // ------------------------------------------------------------
    function Na__LeModel__GetAreaGroups(sheet) {
        const raw = (sheet && Array.isArray(sheet.Sheet__AreaGroups)) ? sheet.Sheet__AreaGroups : [];
        return raw.filter((entry) => !!entry && typeof entry.AreaGroup__Name === 'string' && entry.AreaGroup__Name.trim() !== '')
                  .map((entry) => ({ AreaGroup__Name : entry.AreaGroup__Name, AreaGroup__Colour : (typeof entry.AreaGroup__Colour === 'string' && entry.AreaGroup__Colour) ? entry.AreaGroup__Colour : null }));
    }
    // ------------------------------------------------------------


    // FUNCTION | Announce Everything a Run of Silent Floor Area Edits Did (one undo step)
    // ------------------------------------------------------------
    function Na__LeModel__AnnounceAreas(sheet, itemId) {
        if (!sheet) return false;
        Na__LeModel__Touch(Na__LeModel__AREAS_REASON, sheet.Sheet__Id, itemId || null);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Add a Group (nothing happens if the sheet already has one of that name)
    // ------------------------------------------------------------
    // Returns the group's name as it is now stored - the existing spelling
    // when one was already there - or null when the name was empty.
    // ------------------------------------------------------------
    function Na__LeModel__AddAreaGroup(sheet, name, colour, silent) {
        if (!sheet) return null;
        const clean = String(name === undefined || name === null ? '' : name).replace(/\s+/g, ' ').trim().slice(0, 120);
        if (clean === '') return null;
        const groups  = Na__LeModel__GetAreaGroups(sheet);
        const already = groups.find((group) => Na__LeModel__AreaGroupKey(group.AreaGroup__Name) === Na__LeModel__AreaGroupKey(clean));
        if (already) return already.AreaGroup__Name;
        const entry = { AreaGroup__Name : clean };
        if (typeof colour === 'string' && colour.trim() !== '') entry.AreaGroup__Colour = colour.trim();
        sheet.Sheet__AreaGroups = groups.map((group) => {
            const kept = { AreaGroup__Name : group.AreaGroup__Name };
            if (group.AreaGroup__Colour) kept.AreaGroup__Colour = group.AreaGroup__Colour;
            return kept;
        }).concat([ entry ]);
        Na__LeRec__NormaliseAreaGroups(sheet);
        if (silent) Na__LeModel__AssignDirty(true);
        else Na__LeModel__AnnounceAreas(sheet);
        return clean;
    }
    // ------------------------------------------------------------


    // FUNCTION | Rename a Group, and Every Room Filed Under It (one undo step)
    // ------------------------------------------------------------
    // The rooms are rewritten HERE rather than by the caller, because a group
    // that has been renamed while its rooms still name the old one is a group
    // whose rooms have silently left it. Returns the new name, or null.
    //
    // Renaming onto a name the sheet already has MERGES the two, which is the
    // only sensible reading of it and is how two pasted spellings of one floor
    // are put right.
    // ------------------------------------------------------------
    function Na__LeModel__RenameAreaGroup(sheet, from, to, silent) {
        if (!sheet) return null;
        const clean = String(to === undefined || to === null ? '' : to).replace(/\s+/g, ' ').trim().slice(0, 120);
        const was   = Na__LeModel__AreaGroupKey(from);
        if (clean === '' || was === '') return null;
        const groups = Na__LeModel__GetAreaGroups(sheet);
        if (!groups.some((group) => Na__LeModel__AreaGroupKey(group.AreaGroup__Name) === was)) return null;
        sheet.Sheet__AreaGroups = groups.map((group) => {
            const kept = { AreaGroup__Name : Na__LeModel__AreaGroupKey(group.AreaGroup__Name) === was ? clean : group.AreaGroup__Name };
            if (group.AreaGroup__Colour) kept.AreaGroup__Colour = group.AreaGroup__Colour;
            return kept;
        });
        Na__LeRec__NormaliseAreaGroups(sheet);                                   // <-- Merges the two entries when the new name was already in the list
        Na__LeModel__AreaShapes(sheet).forEach((shape) => {
            if (Na__LeModel__AreaGroupKey(shape.Shape__Area.Area__Group) === was) shape.Shape__Area.Area__Group = clean;
        });
        if (silent) Na__LeModel__AssignDirty(true);
        else Na__LeModel__AnnounceAreas(sheet);
        return clean;
    }
    // ------------------------------------------------------------


    // FUNCTION | Give a Group a Colour (one undo step)
    // ------------------------------------------------------------
    function Na__LeModel__SetAreaGroupColour(sheet, name, colour, silent) {
        if (!sheet) return false;
        const key    = Na__LeModel__AreaGroupKey(name);
        const groups = Na__LeModel__GetAreaGroups(sheet);
        if (!groups.some((group) => Na__LeModel__AreaGroupKey(group.AreaGroup__Name) === key)) return false;
        sheet.Sheet__AreaGroups = groups.map((group) => {
            const kept = { AreaGroup__Name : group.AreaGroup__Name };
            const now  = Na__LeModel__AreaGroupKey(group.AreaGroup__Name) === key ? colour : group.AreaGroup__Colour;
            if (typeof now === 'string' && now.trim() !== '') kept.AreaGroup__Colour = now.trim();
            return kept;
        });
        Na__LeRec__NormaliseAreaGroups(sheet);
        if (silent) Na__LeModel__AssignDirty(true);
        else Na__LeModel__AnnounceAreas(sheet);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Move a Group Up or Down the Order (one undo step)
    // ------------------------------------------------------------
    // The order is the order a schedule reports them in, so it is worth being
    // able to put Ground Floor above First Floor whichever was drawn first.
    // ------------------------------------------------------------
    function Na__LeModel__MoveAreaGroup(sheet, name, delta, silent) {
        if (!sheet) return false;
        const groups = Na__LeModel__GetAreaGroups(sheet);
        const key    = Na__LeModel__AreaGroupKey(name);
        const from   = groups.findIndex((group) => Na__LeModel__AreaGroupKey(group.AreaGroup__Name) === key);
        const step   = Math.round(Number(delta) || 0);
        if (from === -1 || step === 0) return false;
        const to = Math.max(0, Math.min(groups.length - 1, from + step));
        if (to === from) return false;
        const moved = groups.splice(from, 1)[0];
        groups.splice(to, 0, moved);
        sheet.Sheet__AreaGroups = groups.map((group) => {
            const kept = { AreaGroup__Name : group.AreaGroup__Name };
            if (group.AreaGroup__Colour) kept.AreaGroup__Colour = group.AreaGroup__Colour;
            return kept;
        });
        Na__LeRec__NormaliseAreaGroups(sheet);
        if (silent) Na__LeModel__AssignDirty(true);
        else Na__LeModel__AnnounceAreas(sheet);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete a Group - Its Rooms Stay, Ungrouped (one undo step)
    // ------------------------------------------------------------
    // Deleting a group has never meant deleting the rooms in it, and it must
    // not start meaning that by accident: every room that named it is simply
    // let out of it, and goes on measuring itself exactly as it did.
    // ------------------------------------------------------------
    function Na__LeModel__DeleteAreaGroup(sheet, name, silent) {
        if (!sheet) return false;
        const key    = Na__LeModel__AreaGroupKey(name);
        const groups = Na__LeModel__GetAreaGroups(sheet);
        const kept   = groups.filter((group) => Na__LeModel__AreaGroupKey(group.AreaGroup__Name) !== key);
        const rooms  = Na__LeModel__AreaShapes(sheet).filter((shape) => Na__LeModel__AreaGroupKey(shape.Shape__Area.Area__Group) === key);
        if (kept.length === groups.length && !rooms.length) return false;
        sheet.Sheet__AreaGroups = kept.map((group) => {
            const entry = { AreaGroup__Name : group.AreaGroup__Name };
            if (group.AreaGroup__Colour) entry.AreaGroup__Colour = group.AreaGroup__Colour;
            return entry;
        });
        Na__LeRec__NormaliseAreaGroups(sheet);
        rooms.forEach((shape) => { delete shape.Shape__Area.Area__Group; });
        if (silent) Na__LeModel__AssignDirty(true);
        else Na__LeModel__AnnounceAreas(sheet);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Sheet Model Area Groups API
    // ------------------------------------------------------------
    export {
        Na__LeModel__AREAS_REASON,
        Na__LeModel__AreaGroupKey,
        Na__LeModel__GetAreaGroups,
        Na__LeModel__AnnounceAreas,
        Na__LeModel__AddAreaGroup,
        Na__LeModel__RenameAreaGroup,
        Na__LeModel__SetAreaGroupColour,
        Na__LeModel__MoveAreaGroup,
        Na__LeModel__DeleteAreaGroup
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
