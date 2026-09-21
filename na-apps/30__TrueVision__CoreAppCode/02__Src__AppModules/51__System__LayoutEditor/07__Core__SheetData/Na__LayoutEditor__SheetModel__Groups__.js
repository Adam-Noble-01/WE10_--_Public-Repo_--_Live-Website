// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET MODEL - GROUPS
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetModel__Groups__.js
// NAMESPACE  : Na__LeModel
// MODULE     : Layout Editor - Sheet Model - Groups
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : A sheet's groups, the prune that keeps them whole after a delete, and the delete of several items at once
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - GetGroups, GetGroupById, InsertGroup (a paste) and DeleteGroup (the
//   members stay on the sheet).
// - PruneGroups drops members that no longer exist, then removes any group
//   left with fewer than two, lifting its last member into its parent.
// - DeleteItems removes any mix of kinds in one pass and prunes the groups,
//   with one announcement per collection touched: one undo step.
// - The silent paths and DeleteItems write the dirty flag and the selection
//   through the State unit's AssignDirty and AssignSelectionItems (an
//   imported let cannot be assigned).
//
// INTEGRATION:
// - Imports only Na__LayoutEditor__SheetModel__State__ among the units, so
//   TextAndDimensions and Shapes import PruneGroups without a cycle.
// - Na__LayoutEditor__SheetModel__ re-exports this unit's API except
//   PruneGroups, which stays internal to the sheet model. Every other module
//   imports Na__LayoutEditor__SheetModel__.js, never this unit.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the ValeVision3D v2.47.0 split of the same module (same unit, same functions)
// - Parity        : verbatim (moved code)
// - Divergences   : header; DeleteItems' silent flag, TrueVision first (19-Sep-2026, for the Parametric Scrapbook).
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.2.0
// - AddGroupMember: one more member into a group that already exists, for the
//   vector tools (37__System__VectorTools) - what is drawn inside an open group
//   joins it, and a piece cut from a member stays a member. An item already in
//   a group is left where it is. Takes the same optional silent flag.
//
// 19-Sep-2026 - Version 1.1.0
// - DeleteItems takes an optional silent flag: the records go and the sheet is
//   marked dirty, with no announcement. Every existing caller passes nothing
//   and announces exactly as before.
//
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__SheetModel__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Record Helpers
    // ------------------------------------------------------------
    import {
        Na__LeRec__NextId,
        Na__LeRec__Find,
        Na__LeRec__NormaliseGroup
    } from './Na__LayoutEditor__SheetRecords__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Sheet Model State
    // ------------------------------------------------------------
    import {
        Na__LeModel__SelectionItems,
        Na__LeModel__Touch,
        Na__LeModel__Unselect,
        Na__LeModel__AssignSelectionItems,
        Na__LeModel__AssignDirty
    } from './Na__LayoutEditor__SheetModel__State__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Groups and Multi-Item Deletes
// -----------------------------------------------------------------------------

    // FUNCTION | A Sheet's Groups
    // ------------------------------------------------------------
    function Na__LeModel__GetGroups(sheet) {
        return (sheet && Array.isArray(sheet.Sheet__Groups)) ? sheet.Sheet__Groups : [];
    }
    function Na__LeModel__GetGroupById(sheet, groupId) {
        return sheet ? Na__LeRec__Find(Na__LeModel__GetGroups(sheet), 'Group__Id', groupId) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put a Group Record Onto a Sheet (fresh id)
    // ------------------------------------------------------------
    // members: [{ kind, id }]. silent skips the announcement so a paste of
    // several groups can land as one undo step with their members.
    // ------------------------------------------------------------
    function Na__LeModel__InsertGroup(sheet, record, silent) {
        if (!sheet || !record || typeof record !== 'object') return null;
        if (!Array.isArray(sheet.Sheet__Groups)) sheet.Sheet__Groups = [];
        const item = JSON.parse(JSON.stringify(record));
        item.Group__Id = Na__LeRec__NextId(sheet.Sheet__Groups, 'Group_', 'Group__Id');
        Na__LeRec__NormaliseGroup(item);
        sheet.Sheet__Groups.push(item);
        if (silent) { Na__LeModel__AssignDirty(true); return item; }
        Na__LeModel__Touch('groups', sheet.Sheet__Id, item.Group__Id);
        return item;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remove a Group Record (the members stay on the sheet)
    // ------------------------------------------------------------
    function Na__LeModel__DeleteGroup(sheet, groupId, silent) {
        if (!sheet || !Array.isArray(sheet.Sheet__Groups)) return false;
        const index = sheet.Sheet__Groups.findIndex((g) => g.Group__Id === groupId);
        if (index === -1) return false;
        sheet.Sheet__Groups.splice(index, 1);
        Na__LeModel__Unselect(groupId);
        if (silent) { Na__LeModel__AssignDirty(true); return true; }
        Na__LeModel__Touch('groups', sheet.Sheet__Id, groupId);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put One More Member Into a Group That Already Exists
    // ------------------------------------------------------------
    // member: { kind, id } of a vector, a text item or a group. What a group
    // open for editing needs when something is drawn INSIDE it, and what a
    // trim needs when the line it cut in two was a member: the new piece
    // belongs where the old one did. A member already in ANY group is left
    // where it is - an item has one parent - and answers false. silent marks
    // the sheet dirty and leaves the announcement to the caller.
    // ------------------------------------------------------------
    function Na__LeModel__AddGroupMember(sheet, groupId, member, silent) {
        const group = Na__LeModel__GetGroupById(sheet, groupId);
        if (!group || !member || typeof member.kind !== 'string' || typeof member.id !== 'string' || !member.id) return false;
        if (member.kind === 'group' && member.id === groupId) return false;
        const taken = Na__LeModel__GetGroups(sheet).some((g) => (g.Group__Members || []).some((m) => m.kind === member.kind && m.id === member.id));
        if (taken) return false;
        if (!Array.isArray(group.Group__Members)) group.Group__Members = [];
        group.Group__Members.push({ kind : member.kind, id : member.id });
        Na__LeRec__NormaliseGroup(group);
        if (silent) { Na__LeModel__AssignDirty(true); return true; }
        Na__LeModel__Touch('groups', sheet.Sheet__Id, groupId);
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Drop Members That No Longer Exist, Then Empty Groups
    // ------------------------------------------------------------
    // After a delete, a group may still name a shape or a nested group that
    // went with it. Those names drop out; a group left with fewer than two
    // members is itself removed (its last member, if any, is lifted into any
    // parent that held the group).
    // ------------------------------------------------------------
    function Na__LeModel__PruneGroups(sheet) {
        if (!sheet || !Array.isArray(sheet.Sheet__Groups) || !sheet.Sheet__Groups.length) return false;
        const exists = (kind, id) => {
            if (kind === 'shape')      return !!(sheet.Sheet__Shapes || []).some((s) => s.Shape__Id === id);
            if (kind === 'annotation') return !!(sheet.Sheet__Annotations || []).some((a) => a.Annotation__Id === id);
            if (kind === 'group')      return sheet.Sheet__Groups.some((g) => g.Group__Id === id);
            return false;
        };
        let changed = false;
        sheet.Sheet__Groups.forEach((group) => {
            const next = (group.Group__Members || []).filter((m) => exists(m.kind, m.id));
            if (next.length !== (group.Group__Members || []).length) { group.Group__Members = next; changed = true; }
        });
        for (let guard = 0; guard < 32; guard++) {
            const doomed = sheet.Sheet__Groups.filter((g) => (g.Group__Members || []).length < 2);
            if (!doomed.length) break;
            doomed.forEach((group) => {
                const leftover = (group.Group__Members || []).slice();
                sheet.Sheet__Groups.forEach((parent) => {
                    if (parent.Group__Id === group.Group__Id) return;
                    const idx = (parent.Group__Members || []).findIndex((m) => m.kind === 'group' && m.id === group.Group__Id);
                    if (idx >= 0) parent.Group__Members.splice(idx, 1, ...leftover);
                });
                const index = sheet.Sheet__Groups.indexOf(group);
                if (index >= 0) sheet.Sheet__Groups.splice(index, 1);
                Na__LeModel__Unselect(group.Group__Id);
                changed = true;
            });
        }
        return changed;
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete Several Items at Once (one undo step)
    // ------------------------------------------------------------
    // items: [{ kind, id }] of any mix of kinds. Every listed record goes in one
    // pass; a sheet dimension measuring through a removed viewport lets go of
    // it, as DeleteViewport does; the removed items leave the selection. Then
    // one announcement per collection that lost something - the history takes
    // its step at the first, which already holds every removal, so one Ctrl+Z
    // brings the lot back. Returns how many records went.
    //
    // silent skips the announcements and only marks the sheet dirty, as the
    // silent inserts do: a parametric element being regenerated removes its
    // left-over members this way and announces once for the whole change
    // (Na__LayoutEditor__ScrapbookParametric__).
    // ------------------------------------------------------------
    function Na__LeModel__DeleteItems(sheet, items, silent) {
        if (!sheet || !Array.isArray(items)) return 0;
        const doomed = new Set(items.filter((item) => item && item.kind && item.id).map((item) => item.kind + ':' + item.id));
        if (!doomed.size) return 0;
        const gone    = new Set();                                               // <-- Viewport ids removed, for the dimensions measuring through them
        const reasons = [];
        let count = 0;
        [ [ 'Sheet__Viewports',   'Viewport__Id',   'viewport',   'viewports'   ],
          [ 'Sheet__Annotations', 'Annotation__Id', 'annotation', 'annotations' ],
          [ 'Sheet__Dimensions',  'Dimension__Id',  'dimension',  'dimensions'  ],
          [ 'Sheet__Shapes',      'Shape__Id',      'shape',      'shapes'      ],
          [ 'Sheet__Leaders',     'Leader__Id',     'leader',     'leaders'     ],
          [ 'Sheet__Groups',      'Group__Id',      'group',      'groups'      ] ].forEach((row) => {
            const list = sheet[row[0]];
            if (!Array.isArray(list)) return;                                    // <-- A sheet that has never held that kind
            let removed = 0;
            for (let i = list.length - 1; i >= 0; i--) {
                if (!list[i] || !doomed.has(row[2] + ':' + list[i][row[1]])) continue;
                if (row[2] === 'viewport') gone.add(list[i].Viewport__Id);
                list.splice(i, 1);
                removed++;
            }
            if (removed) { count += removed; reasons.push(row[3]); }
        });
        if (Na__LeModel__PruneGroups(sheet) && reasons.indexOf('groups') === -1) {
            if (!count) count = 1;
            reasons.push('groups');
        }
        if (!count) return 0;
        if (gone.size) sheet.Sheet__Dimensions.forEach((d) => { if (gone.has(d.Dimension__ViewportId)) d.Dimension__ViewportId = null; });
        Na__LeModel__AssignSelectionItems(Na__LeModel__SelectionItems.filter((item) => !doomed.has(item.kind + ':' + item.id)));
        if (silent === true) { Na__LeModel__AssignDirty(true); return count; }   // <-- The caller announces once for everything it changed
        reasons.forEach((reason) => Na__LeModel__Touch(reason, sheet.Sheet__Id, null));
        return count;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Sheet Model Groups API
    // ------------------------------------------------------------
    export {
        Na__LeModel__GetGroups,
        Na__LeModel__GetGroupById,
        Na__LeModel__InsertGroup,
        Na__LeModel__AddGroupMember,
        Na__LeModel__DeleteGroup,
        Na__LeModel__PruneGroups,
        Na__LeModel__DeleteItems
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
