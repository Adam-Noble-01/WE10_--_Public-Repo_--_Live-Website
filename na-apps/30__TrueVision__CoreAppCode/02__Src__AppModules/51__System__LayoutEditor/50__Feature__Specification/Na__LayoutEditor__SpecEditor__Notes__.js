// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SPECIFICATION EDITOR - GROUPS AND NOTES
// =============================================================================
//
// FILE       : Na__LayoutEditor__SpecEditor__Notes__.js
// NAMESPACE  : Na__LeSpecEd
// MODULE     : Layout Editor - Specification Editor - Groups and Notes
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The Project Specification page's groups and their notes, and the page for a project with no specification yet
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - One group: its prefix, title and general switch, its note count, its
//   tools (up, down, delete), a clash or a refused prefix explained beside
//   it, its notes in order and its Add button.
// - One note: its grip, its code (the group, as a choice, and its number),
//   its title, how many bubbles show it, its delete button, its text, and
//   where it is used: a chip per sheet, and Link for the unlinked bubbles
//   that already read its code.
// - The page for a project with no specification yet, which offers the
//   standard groups where the specification can be edited.
// - In a read-only session the fields are read-only and the grips, tools and
//   Add buttons are left out.
//
// INTEGRATION:
// - Built by Na__LayoutEditor__SpecEditor__Render__ each time Edit is
//   rebuilt. The actions the rows carry are answered by
//   Na__LayoutEditor__SpecEditor__Actions__ and __NoteDrag__.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the ValeVision3D v2.47.0 split of the same module (same unit, same functions)
// - Parity        : verbatim (moved code)
// - Divergences   : n/a
// - Back-port     : n/a (ValeVision3D's copy is already split into the same units)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__SpecEditor__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel, Na__LeCfg__GetSpecificationSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Specification Editor Units: State and Small Builders
    // ------------------------------------------------------------
    import { Na__LeSpecEd__GRIP_SVG, Na__LeSpecEd__Editable, Na__LeSpecEd__PrefixError } from './Na__LayoutEditor__SpecEditor__State__.js';
    import {
        Na__LeSpecEd__El,
        Na__LeSpecEd__Button,
        Na__LeSpecEd__Field,
        Na__LeSpecEd__Count,
        Na__LeSpecEd__GotoChip
    } from './Na__LayoutEditor__SpecEditor__Builders__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Groups and Notes
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Page for a Project With No Specification Yet
    // ------------------------------------------------------------
    function Na__LeSpecEd__BuildEmpty() {
        const L   = Na__LeCfg__GetLabel;
        const box = Na__LeSpecEd__El('div', 'na-le-spec__empty');
        box.appendChild(Na__LeSpecEd__El('h3', 'na-le-spec__empty-title', L('SpecEmptyTitle', 'No specification yet')));
        box.appendChild(Na__LeSpecEd__El('p', 'na-le-spec__empty-text', L('SpecEmptyText', 'Group the drawing notes under prefixes - general notes, structural notes, finishes - and each note is numbered from its group: GN01, SN01, FN01. Specification bubbles on the sheets link to the notes, and each sheet’s notes margin lists the ones it uses.')));
        if (Na__LeSpecEd__Editable) {
            const row = Na__LeSpecEd__El('div', 'na-le-spec__empty-actions');
            const starters = Na__LeCfg__GetSpecificationSetup().starterGroups.map((g) => g && g.Prefix).filter(Boolean).join(', ');
            row.appendChild(Na__LeSpecEd__Button(L('SpecStarterGroups', 'Add standard groups'), 'starter', Na__LeCfg__FormatLabel('SpecStarterGroupsTitle', 'Start with the groups {prefixes}', { prefixes : starters }), 'na-le-btn--primary'));
            row.appendChild(Na__LeSpecEd__Button(L('SpecAddGroup', 'Add group'), 'add-group'));
            box.appendChild(row);
        }
        return box;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Group: Its Heading, Its Notes and Its Add Button
    // ------------------------------------------------------------
    function Na__LeSpecEd__BuildGroup(group, index, groups, usage, clashes) {
        const L        = Na__LeCfg__GetLabel;
        const editable = Na__LeSpecEd__Editable;
        const id       = group.Group__Id;
        const section  = Na__LeSpecEd__El('section', 'na-le-spec-group' + (group.Group__IsGeneral ? ' is-general' : '') + (clashes.has(group.Group__Prefix) ? ' has-clash' : ''));
        section.setAttribute('data-group-id', id);

        const head   = Na__LeSpecEd__El('div', 'na-le-spec-group__head');
        const prefix = Na__LeSpecEd__Field('input', 'na-le-spec-group__prefix', 'group-prefix', { groupId : id });
        prefix.type      = 'text';
        prefix.value     = group.Group__Prefix;
        prefix.maxLength = Na__LeCfg__GetSpecificationSetup().prefixMaxLength;
        prefix.title     = L('SpecPrefixTitle', 'This group’s prefix. Its notes are numbered from it - EE01, EE02 - and a new prefix renumbers every bubble linked to them. Letters only.');
        prefix.readOnly  = !editable;
        const title = Na__LeSpecEd__Field('input', 'na-le-spec-group__title', 'group-title', { groupId : id });
        title.type        = 'text';
        title.value       = group.Group__Title;
        title.placeholder = L('SpecGroupTitlePlaceholder', 'Group title, e.g. External Envelope');
        title.readOnly    = !editable;
        const general = Na__LeSpecEd__El('label', 'na-le-spec-group__general');
        const check   = Na__LeSpecEd__Field('input', '', 'group-general', { groupId : id });
        check.type     = 'checkbox';
        check.checked  = group.Group__IsGeneral === true;
        check.disabled = !editable;
        general.appendChild(check);
        general.appendChild(document.createTextNode(L('SpecGeneral', 'General notes')));
        general.title = L('SpecGeneralTitle', 'General notes are listed on every sheet’s notes margin, after the notes its bubbles link to.');
        head.appendChild(prefix);
        head.appendChild(title);
        head.appendChild(general);
        head.appendChild(Na__LeSpecEd__El('span', 'na-le-spec-group__count', Na__LeSpecEd__Count(group.Group__Notes.length, 'SpecNotesOne', '{count} note', 'SpecNotesMany', '{count} notes')));
        if (editable) {
            const tools = Na__LeSpecEd__El('div', 'na-le-spec-group__tools');
            const up    = Na__LeSpecEd__Button('↑', 'group-up', L('SpecGroupUp', 'Move this group up'), 'na-le-btn--small');
            const down  = Na__LeSpecEd__Button('↓', 'group-down', L('SpecGroupDown', 'Move this group down'), 'na-le-btn--small');
            const del   = Na__LeSpecEd__Button(L('DeleteLabel', 'Delete'), 'group-delete', L('SpecGroupDelete', 'Delete this group and its notes'), 'na-le-btn--small');
            up.disabled   = index === 0;
            down.disabled = index === groups.length - 1;
            [ up, down, del ].forEach((b) => { b.setAttribute('data-group-id', id); tools.appendChild(b); });
            head.appendChild(tools);
        }
        section.appendChild(head);

        if (clashes.has(group.Group__Prefix)) section.appendChild(Na__LeSpecEd__El('p', 'na-le-spec-group__message na-le-spec-group__message--error', Na__LeCfg__FormatLabel('SpecClashWarning', 'Another group also uses {prefix}, so the two groups’ codes clash. Give one of them a different prefix.', { prefix : group.Group__Prefix })));
        if (Na__LeSpecEd__PrefixError && Na__LeSpecEd__PrefixError.groupId === id) section.appendChild(Na__LeSpecEd__El('p', 'na-le-spec-group__message na-le-spec-group__message--error', Na__LeSpecEd__PrefixError.message));

        const list = Na__LeSpecEd__El('ol', 'na-le-spec-notes');
        list.setAttribute('data-group-id', id);
        group.Group__Notes.forEach((note) => list.appendChild(Na__LeSpecEd__BuildNote(group, note, groups, usage)));
        section.appendChild(list);
        if (!group.Group__Notes.length) section.appendChild(Na__LeSpecEd__El('p', 'na-le-spec-group__empty', L('SpecGroupEmpty', 'No notes in this group yet.')));
        if (editable) {
            const foot = Na__LeSpecEd__El('div', 'na-le-spec-group__foot');
            const add  = Na__LeSpecEd__Button(Na__LeCfg__FormatLabel('SpecAddNote', '+ Add {prefix} note', { prefix : group.Group__Prefix }), 'note-add', null, 'na-le-btn--small');
            add.setAttribute('data-group-id', id);
            foot.appendChild(add);
            section.appendChild(foot);
        }
        return section;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Note: Grip, Code (Group and Number), Title, Text and Where It Is Used
    // ------------------------------------------------------------
    function Na__LeSpecEd__BuildNote(group, note, groups, usage) {
        const L        = Na__LeCfg__GetLabel;
        const editable = Na__LeSpecEd__Editable;
        const id       = note.Note__Id;
        const row      = Na__LeSpecEd__El('li', 'na-le-spec-note');
        row.setAttribute('data-note-id', id);

        if (editable) {
            const grip = Na__LeSpecEd__Button('', 'note-grip', L('SpecGripTitle', 'Drag to reorder - the notes are renumbered - or use Alt+Up and Alt+Down'), '');
            grip.className = 'na-le-spec-note__grip';
            grip.innerHTML = Na__LeSpecEd__GRIP_SVG;
            grip.setAttribute('data-note-id', id);
            grip.setAttribute('aria-label', L('SpecGripLabel', 'Reorder note'));
            row.appendChild(grip);
        }

        const main = Na__LeSpecEd__El('div', 'na-le-spec-note__main');
        const head = Na__LeSpecEd__El('div', 'na-le-spec-note__head');

        // CODE | The group it is in, as a choice, and its number, which is its place
        const code   = Na__LeSpecEd__El('span', 'na-le-spec-note__code');
        const choose = Na__LeSpecEd__Field('select', 'na-le-spec-note__prefix', 'note-group', { noteId : id });
        groups.forEach((g) => { const option = document.createElement('option'); option.value = g.Group__Id; option.textContent = g.Group__Prefix; choose.appendChild(option); });
        choose.value    = group.Group__Id;
        choose.title    = L('SpecNoteGroupTitle', 'The note’s group. Choose another prefix to move the note to the end of that group; both groups are renumbered.');
        choose.disabled = !editable;
        code.appendChild(choose);
        code.appendChild(Na__LeSpecEd__El('span', 'na-le-spec-note__number', note.Note__Code.slice(group.Group__Prefix.length)));
        head.appendChild(code);

        const title = Na__LeSpecEd__Field('input', 'na-le-spec-note__title', 'note-title', { noteId : id });
        title.type        = 'text';
        title.value       = note.Note__Title;
        title.placeholder = L('SpecNoteTitlePlaceholder', 'Title');
        title.readOnly    = !editable;
        head.appendChild(title);

        const linked   = usage.byNote.get(id) || [];
        const matching = usage.matching.get(id) || [];
        const used = Na__LeSpecEd__El('span', 'na-le-spec-note__usage' + (linked.length ? ' is-used' : ''),
            linked.length ? Na__LeSpecEd__Count(linked.length, 'SpecUsedOne', '{count} bubble', 'SpecUsedMany', '{count} bubbles') : L('SpecUnused', 'Not on a sheet'));
        head.appendChild(used);
        if (editable) {
            const del = Na__LeSpecEd__Button('×', 'note-delete', L('SpecNoteDelete', 'Delete this note; the notes after it are renumbered'), 'na-le-btn--small na-le-spec-note__delete');
            del.setAttribute('data-note-id', id);
            head.appendChild(del);
        }
        main.appendChild(head);

        const body = Na__LeSpecEd__Field('textarea', 'na-le-spec-note__body', 'note-body', { noteId : id });
        body.value       = note.Note__Body;
        body.rows        = 2;
        body.placeholder = L('SpecNoteBodyPlaceholder', 'Specification text');
        body.readOnly    = !editable;
        main.appendChild(body);

        // WHERE IT IS USED | One chip per sheet, and the unlinked bubbles that already read its code
        if (linked.length || matching.length) {
            const links   = Na__LeSpecEd__El('div', 'na-le-spec-note__links');
            const bySheet = new Map();
            linked.forEach((item) => { if (!bySheet.has(item.sheet.Sheet__Id)) bySheet.set(item.sheet.Sheet__Id, []); bySheet.get(item.sheet.Sheet__Id).push(item); });
            bySheet.forEach((items) => links.appendChild(Na__LeSpecEd__GotoChip(items[0].sheet.Sheet__Name + (items.length > 1 ? ' ×' + items.length : ''), items[0].sheet.Sheet__Id, items[0].leader.Leader__Id, false)));
            if (matching.length) {
                links.appendChild(Na__LeSpecEd__El('span', 'na-le-spec-note__matching', Na__LeSpecEd__Count(matching.length, 'SpecMatchingOne', '{count} unlinked bubble reads this code', 'SpecMatchingMany', '{count} unlinked bubbles read this code')));
                if (editable) {
                    const link = Na__LeSpecEd__Button(L('SpecLink', 'Link'), 'link-note', L('SpecLinkTitle', 'Link them to this note, so they follow it when it is renumbered'), 'na-le-btn--small');
                    link.setAttribute('data-note-id', id);
                    links.appendChild(link);
                }
            }
            main.appendChild(links);
        }
        row.appendChild(main);
        return row;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Specification Editor Groups and Notes
    // ------------------------------------------------------------
    export {
        Na__LeSpecEd__BuildEmpty,
        Na__LeSpecEd__BuildGroup
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
