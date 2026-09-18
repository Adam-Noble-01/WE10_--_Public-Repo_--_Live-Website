// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - GROUPS
// =============================================================================
//
// FILE       : Na__LayoutEditor__Groups__.js
// NAMESPACE  : Na__LeGroup
// MODULE     : Layout Editor - Groups
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Group and ungroup vectors and text (Ctrl+G / Ctrl+Shift+G), and the blue box a selected group shows
// CREATED    : 14-Sep-2026
//
// DESCRIPTION:
// - A group is a sheet record (Sheet__Groups) that names its members: a
//   vector, a text item, or another group. Members stay first-class and
//   keep drawing; the group is what a click, a move, a copy and a delete
//   take hold of.
// - Ctrl+G groups every groupable item in the selection (at least two of
//   vectors, text and groups). Ctrl+Shift+G ungroups each selected group
//   one level, lifting nested groups out as groups and the rest as items.
//   One announcement, so one undo step.
// - A click on a member selects the outermost group that holds it. A box
//   that takes a member takes that group. The eyedropper still reads the
//   member, so a grouped vector can still paint its style.
// - A selected group shows one blue bounding box around every member, with
//   the word "Group" in the top-left corner, counter-scaled like the
//   viewport note so it reads the same at any zoom. Vertex grips stay off;
//   the group moves as a whole.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__ remaps a hit, expands a group for a
//   move or a delete, and runs Group / Ungroup from the keys and the menu.
// - Na__LayoutEditor__ViewportClipboard__ copies a group with its members.
// - Na__LayoutEditor__SheetSurface__ draws the box through Render.
// - Na__LayoutEditor__SheetModel__ owns the records (InsertGroup, DeleteGroup).
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (14-Sep-2026)
// - ValeVision    : ported 14-Sep-2026 as ValeVision3D v2.38.0 (verbatim, header only)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 18-Sep-2026 - Version 1.1.0
// - MemberBounds reads a leader's box too (Na__LeMarkup__LeaderBounds), so
//   Na__LeGroup__ItemsBounds works for a clipboard "Set" that holds one
//   (Na__LayoutEditor__ItemClipboard__). Leaders still are not a groupable
//   kind - Na__LeGroup__KINDS is unchanged, so Ctrl+G still leaves them out.
//
// 14-Sep-2026 - Version 1.0.0
// - Group and ungroup for vectors and text (and nested groups), member-to-
//   group hit resolve, box-select remap, bounds, expand-for-edit, and the
//   selected group's blue box with a "Group" overlay.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Geometry and Text Bounds
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__GetSelectionItems,
        Na__LeModel__SetSelection,
        Na__LeModel__SetSelectionItems,
        Na__LeModel__GetGroupById,
        Na__LeModel__GetGroups,
        Na__LeModel__InsertGroup,
        Na__LeModel__DeleteGroup,
        Na__LeModel__GetShapeById,
        Na__LeModel__GetAnnotationById,
        Na__LeModel__GetLeaderById
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeShapeGeo__Bounds } from './Na__LayoutEditor__ShapeGeometry__.js';
    import { Na__LeMarkup__AnnotationBounds, Na__LeMarkup__LeaderBounds } from './Na__LayoutEditor__MarkupBridge__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Groupable Kinds, Overlay Class and Box Pad
    // ------------------------------------------------------------
    const Na__LeGroup__KINDS     = Object.freeze([ 'shape', 'annotation', 'group' ]);
    const Na__LeGroup__CLASS     = 'na-le-selection na-le-selection--group';
    const Na__LeGroup__PAD_MM    = 1.0;     // <-- Same pad as a selected vector's highlight box
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Membership
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Is This Kind Allowed In a Group
    // ------------------------------------------------------------
    function Na__LeGroup__IsKind(kind) {
        return Na__LeGroup__KINDS.indexOf(kind) !== -1;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Group That Directly Holds an Item (null when it is free)
    // ------------------------------------------------------------
    function Na__LeGroup__ParentOf(sheet, kind, id) {
        if (!sheet || !kind || !id) return null;
        const groups = Na__LeModel__GetGroups(sheet);
        for (let i = 0; i < groups.length; i++) {
            const members = groups[i].Group__Members || [];
            if (members.some((m) => m.kind === kind && m.id === id)) return groups[i];
        }
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Outermost Group That Holds an Item (null when it is free)
    // ------------------------------------------------------------
    function Na__LeGroup__Outermost(sheet, kind, id) {
        let current = Na__LeGroup__ParentOf(sheet, kind, id);
        if (!current) return null;
        const seen = new Set();
        while (current && !seen.has(current.Group__Id)) {
            seen.add(current.Group__Id);
            const parent = Na__LeGroup__ParentOf(sheet, 'group', current.Group__Id);
            if (!parent) return current;
            current = parent;
        }
        return current;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remap a Hit on a Member to the Outermost Group That Holds It
    // ------------------------------------------------------------
    // Returns the same { kind, id, ... } when the item is not grouped. Extra
    // fields (hit) ride through, so a viewport handle is unchanged.
    // ------------------------------------------------------------
    function Na__LeGroup__Resolve(sheet, found) {
        if (!found || !Na__LeGroup__IsKind(found.kind)) return found;
        const group = Na__LeGroup__Outermost(sheet, found.kind, found.id);
        if (!group) return found;
        return Object.assign({}, found, { kind : 'group', id : group.Group__Id });
    }
    // ------------------------------------------------------------


    // FUNCTION | Remap a List of Hits So a Member Becomes Its Outermost Group
    // ------------------------------------------------------------
    // Used by the selection box: a window that covers two vectors of a group
    // takes the group once, not the two vectors.
    // ------------------------------------------------------------
    function Na__LeGroup__ResolveItems(sheet, items) {
        const seen = new Set();
        const out  = [];
        (Array.isArray(items) ? items : []).forEach((item) => {
            const resolved = Na__LeGroup__Resolve(sheet, item);
            if (!resolved || !resolved.kind || !resolved.id) return;
            const key = resolved.kind + ':' + resolved.id;
            if (seen.has(key)) return;
            seen.add(key);
            out.push({ kind : resolved.kind, id : resolved.id });
        });
        return out;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Walk Every Leaf Member of a Group (vectors and text)
    // ------------------------------------------------------------
    function Na__LeGroup__WalkLeaves(sheet, groupId, visit, seen) {
        const walked = seen || new Set();
        if (walked.has(groupId)) return;
        walked.add(groupId);
        const group = Na__LeModel__GetGroupById(sheet, groupId);
        if (!group) return;
        (group.Group__Members || []).forEach((member) => {
            if (member.kind === 'group') Na__LeGroup__WalkLeaves(sheet, member.id, visit, walked);
            else visit(member);
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Record a Group Owns, Nested Groups Included
    // ------------------------------------------------------------
    // Returns [{ kind, id }] of vectors, text and nested groups. The group
    // itself is not in the list. Used to copy, move and delete the contents.
    // ------------------------------------------------------------
    function Na__LeGroup__Descendants(sheet, groupId) {
        const out  = [];
        const seen = new Set();
        const walk = (id) => {
            if (seen.has(id)) return;
            seen.add(id);
            const group = Na__LeModel__GetGroupById(sheet, id);
            if (!group) return;
            (group.Group__Members || []).forEach((member) => {
                out.push({ kind : member.kind, id : member.id });
                if (member.kind === 'group') walk(member.id);
            });
        };
        walk(groupId);
        return out;
    }
    // ------------------------------------------------------------


    // FUNCTION | Expand Groups in a Selection to the Records an Edit Touches
    // ------------------------------------------------------------
    // A selected group becomes its descendant vectors, text and nested groups,
    // plus the group itself (so a delete takes the group record as well).
    // Ungrouped items pass through. Duplicates drop out.
    // ------------------------------------------------------------
    function Na__LeGroup__Expand(sheet, items) {
        const seen = new Set();
        const out  = [];
        const push = (item) => {
            if (!item || !item.kind || !item.id) return;
            const key = item.kind + ':' + item.id;
            if (seen.has(key)) return;
            seen.add(key);
            out.push({ kind : item.kind, id : item.id });
        };
        (Array.isArray(items) ? items : []).forEach((item) => {
            push(item);
            if (item && item.kind === 'group') Na__LeGroup__Descendants(sheet, item.id).forEach(push);
        });
        return out;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Bounds
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Paper Box of One Member
    // ------------------------------------------------------------
    // A leader is not a groupable kind (Na__LeGroup__KINDS leaves it out, so
    // Ctrl+G never takes it) but it is still a clipboard "Set" member
    // (Na__LayoutEditor__ItemClipboard__), which reads its box through this
    // same helper to place a copy.
    // ------------------------------------------------------------
    function Na__LeGroup__MemberBounds(sheet, member) {
        if (!member) return null;
        if (member.kind === 'shape') {
            const shape = Na__LeModel__GetShapeById(sheet, member.id);
            return shape ? Na__LeShapeGeo__Bounds(shape) : null;
        }
        if (member.kind === 'annotation') {
            const item = Na__LeModel__GetAnnotationById(sheet, member.id);
            if (!item) return null;
            const box = Na__LeMarkup__AnnotationBounds(item);
            if (!Number.isFinite(item.Annotation__LeaderXMm) || !Number.isFinite(item.Annotation__LeaderYMm)) return box;
            const minX = Math.min(box.X, item.Annotation__LeaderXMm);
            const minY = Math.min(box.Y, item.Annotation__LeaderYMm);
            const maxX = Math.max(box.X + box.WidthMm, item.Annotation__LeaderXMm);
            const maxY = Math.max(box.Y + box.HeightMm, item.Annotation__LeaderYMm);
            return { X : minX, Y : minY, WidthMm : maxX - minX, HeightMm : maxY - minY };
        }
        if (member.kind === 'leader') {
            const leader = Na__LeModel__GetLeaderById(sheet, member.id);
            return leader ? Na__LeMarkup__LeaderBounds(leader) : null;
        }
        if (member.kind === 'group') return Na__LeGroup__Bounds(sheet, member.id);
        return null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Union of Paper Boxes
    // ------------------------------------------------------------
    function Na__LeGroup__Union(boxes) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        (boxes || []).forEach((box) => {
            if (!box) return;
            minX = Math.min(minX, box.X);
            minY = Math.min(minY, box.Y);
            maxX = Math.max(maxX, box.X + box.WidthMm);
            maxY = Math.max(maxY, box.Y + box.HeightMm);
        });
        if (!Number.isFinite(minX)) return null;
        return { X : minX, Y : minY, WidthMm : maxX - minX, HeightMm : maxY - minY };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Paper Box Around a Group (every member, nested included)
    // ------------------------------------------------------------
    function Na__LeGroup__Bounds(sheet, groupId) {
        const boxes = [];
        Na__LeGroup__WalkLeaves(sheet, groupId, (member) => {
            const box = Na__LeGroup__MemberBounds(sheet, member);
            if (box) boxes.push(box);
        });
        return Na__LeGroup__Union(boxes);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Paper Box Around a Mixed List of Items
    // ------------------------------------------------------------
    function Na__LeGroup__ItemsBounds(sheet, items) {
        const boxes = [];
        (Array.isArray(items) ? items : []).forEach((item) => {
            const box = Na__LeGroup__MemberBounds(sheet, item);
            if (box) boxes.push(box);
        });
        return Na__LeGroup__Union(boxes);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Group and Ungroup
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Groupable Items in a Selection, Outermost Groups Kept
    // ------------------------------------------------------------
    // A selected member of a group is already the group (Resolve). Loose
    // vectors and text stay as they are. Viewports, dimensions and leaders
    // are left out: they do not group.
    // ------------------------------------------------------------
    function Na__LeGroup__Groupable(sheet, items) {
        const seen = new Set();
        const out  = [];
        (Array.isArray(items) ? items : []).forEach((item) => {
            const resolved = Na__LeGroup__Resolve(sheet, item);
            if (!resolved || !Na__LeGroup__IsKind(resolved.kind)) return;
            const key = resolved.kind + ':' + resolved.id;
            if (seen.has(key)) return;
            seen.add(key);
            out.push({ kind : resolved.kind, id : resolved.id });
        });
        return out;
    }
    // ------------------------------------------------------------


    // FUNCTION | Can the Current Selection Be Grouped
    // ------------------------------------------------------------
    function Na__LeGroup__CanGroup(sheet) {
        return Na__LeGroup__Groupable(sheet, Na__LeModel__GetSelectionItems()).length >= 2;
    }
    // ------------------------------------------------------------


    // FUNCTION | Can the Current Selection Be Ungrouped
    // ------------------------------------------------------------
    function Na__LeGroup__CanUngroup(sheet) {
        return Na__LeModel__GetSelectionItems().some((item) => item.kind === 'group' && Na__LeModel__GetGroupById(sheet, item.id));
    }
    // ------------------------------------------------------------


    // FUNCTION | Group the Selection (Ctrl+G)
    // ------------------------------------------------------------
    // At least two groupable items become a new group, selected in their
    // place. One announcement, so one undo step.
    // ------------------------------------------------------------
    function Na__LeGroup__Group(sheet) {
        if (!sheet) return false;
        const members = Na__LeGroup__Groupable(sheet, Na__LeModel__GetSelectionItems());
        if (members.length < 2) return false;
        const group = Na__LeModel__InsertGroup(sheet, { Group__Members : members }, false);
        if (!group) return false;
        Na__LeModel__SetSelection({ kind : 'group', id : group.Group__Id });
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Ungroup Each Selected Group One Level (Ctrl+Shift+G)
    // ------------------------------------------------------------
    // Nested groups come out as groups; vectors and text come out free. A
    // group that lived inside another has its members lifted into that
    // parent in its place. One announcement (the first DeleteGroup), so
    // one undo step: later deletes are silent.
    // ------------------------------------------------------------
    function Na__LeGroup__Ungroup(sheet) {
        if (!sheet) return false;
        const doomed = Na__LeModel__GetSelectionItems()
            .map((item) => item.kind === 'group' ? Na__LeModel__GetGroupById(sheet, item.id) : null)
            .filter(Boolean);
        if (!doomed.length) return false;
        const released = [];
        doomed.forEach((group) => {
            const members = (group.Group__Members || []).map((m) => ({ kind : m.kind, id : m.id }));
            members.forEach((m) => released.push(m));
            Na__LeModel__GetGroups(sheet).forEach((parent) => {
                if (parent.Group__Id === group.Group__Id) return;
                const idx = (parent.Group__Members || []).findIndex((m) => m.kind === 'group' && m.id === group.Group__Id);
                if (idx >= 0) parent.Group__Members.splice(idx, 1, ...members);
            });
        });
        doomed.forEach((group, i) => Na__LeModel__DeleteGroup(sheet, group.Group__Id, i < doomed.length - 1));   // <-- Silent until the last: one undo step
        Na__LeModel__SetSelectionItems(released);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Selection Overlay
// -----------------------------------------------------------------------------

    // FUNCTION | Draw the Blue Box and "Group" Label for Every Selected Group
    // ------------------------------------------------------------
    // Appends to the handles layer. The caller clears that layer first (or
    // has just drawn viewport outlines, which already cleared it). The label
    // is counter-scaled so it reads the same at any zoom.
    // ------------------------------------------------------------
    function Na__LeGroup__Render(layer, sheet, items, ppm, zoom) {
        if (!layer || !sheet) return false;
        layer.querySelectorAll('.na-le-selection--group').forEach((el) => el.remove());
        const groups = (Array.isArray(items) ? items : []).filter((item) => item && item.kind === 'group');
        if (!groups.length) return false;
        const label = Na__LeCfg__GetLabel('GroupOverlay', 'Group');
        groups.forEach((item) => {
            const box = Na__LeGroup__Bounds(sheet, item.id);
            if (!box) return;
            const pad     = Na__LeGroup__PAD_MM;
            const outline = document.createElement('div');
            outline.className = Na__LeGroup__CLASS;
            outline.style.left        = ((box.X - pad) * ppm) + 'px';
            outline.style.top         = ((box.Y - pad) * ppm) + 'px';
            outline.style.width       = Math.max(0, (box.WidthMm  + (pad * 2)) * ppm) + 'px';
            outline.style.height      = Math.max(0, (box.HeightMm + (pad * 2)) * ppm) + 'px';
            outline.style.borderWidth = Math.max(1, 1.5 / zoom) + 'px';
            outline.style.setProperty('--na-le-note-scale', String(1 / zoom));
            const tag = document.createElement('span');
            tag.className   = 'na-le-group-label';
            tag.textContent = label;
            outline.appendChild(tag);
            layer.appendChild(outline);
        });
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Groups API
    // ------------------------------------------------------------
    export {
        Na__LeGroup__IsKind,
        Na__LeGroup__ParentOf,
        Na__LeGroup__Outermost,
        Na__LeGroup__Resolve,
        Na__LeGroup__ResolveItems,
        Na__LeGroup__Descendants,
        Na__LeGroup__Expand,
        Na__LeGroup__Bounds,
        Na__LeGroup__ItemsBounds,
        Na__LeGroup__CanGroup,
        Na__LeGroup__CanUngroup,
        Na__LeGroup__Group,
        Na__LeGroup__Ungroup,
        Na__LeGroup__Render
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
