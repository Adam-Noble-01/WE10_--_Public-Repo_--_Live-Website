// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PANEL: MARGIN NOTES - LEADERLESS NOTES
// =============================================================================
//
// FILE       : Na__LayoutEditor__Panel__MarginNotes__Leaderless__.js
// NAMESPACE  : Na__LePanelLeaderless
// MODULE     : Layout Editor - Panel Margin Notes - Leaderless
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The Leaderless Notes part of the Margin Notes panel: the switch, the stack of groups listed without bubbles in the order they print, and every other group to tick
// CREATED    : 22-Sep-2026
//
// DESCRIPTION:
// - WHY. The margin lists the notes a sheet's bubbles link to, and some notes
//   are never pointed at: a project introduction, or a block of notes that
//   needs no leader. Leaderless Notes lists whole specification groups on
//   the sheet, bubble or no bubble, before the notes the bubbles link to
//   (Na__LayoutEditor__SpecMargin__ lists them; the sheet keeps them on its
//   notes margin record, Na__LayoutEditor__SheetRecords__LeaderlessNotes__).
// - HIDDEN UNTIL IT IS WANTED. One switch, Leaderless Notes, under the
//   margin's settings and above Overspill Note Regions. Off, that is all
//   there is. On, a rule and the section come up under it:
//     LISTED FIRST   the ticked groups, top of the stack printed first, each
//                    with a grip at its left: drag it up or down, release.
//                    The row follows the pointer and the rows it passes slide
//                    aside, as the Layers panel's grip does; nothing reaches
//                    the model until release - one reorder, one undo step.
//                    A focused grip takes the arrow keys too.
//     OTHER GROUPS   every other group of the specification, in its order.
//                    Ticked, a group joins the foot of the stack; unticked,
//                    it comes back here.
//   Each row is the overspill regions' group row: the group's prefix in a
//   chip, its title and its tick. A listed group that a region ticks says
//   which ("in Region 2"): its notes print there, as any group's do; one
//   with no notes says so.
// - Off keeps the ticked groups, in their order, so on again puts them back.
// - Rebuilt only when what it is built from changes - the sheet, its list,
//   the specification's groups, the regions that claim them - and never in
//   the middle of a drag: the drop redraws it. A rebuild keeps the focus on
//   the same group's grip or tick, so the keys carry on where they were.
//
// INTEGRATION:
// - Na__LayoutEditor__Panel__MarginNotes__ builds it into its section (Build),
//   refreshes it with the section (Refresh) and registers its controls
//   (Register).
// - The grip drag is the Layers panel's (Na__LayoutEditor__Panel__Layers__),
//   copied rule for rule rather than shared, as the specification editor's
//   note grip is.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (22-Sep-2026)
// - ValeVision    : not yet ported - it goes with the rest of the margin's
//                   regions and leaderless notes.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Records, Specification and the Panel Host
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__GetActiveSheet, Na__LeModel__UpdateMarginNotes } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeRec__LeaderlessOn, Na__LeRec__LeaderlessGroups } from '../07__Core__SheetData/Na__LayoutEditor__SheetRecords__LeaderlessNotes__.js';
    import { Na__LeRec__DrawnNoteRegions } from '../07__Core__SheetData/Na__LayoutEditor__SheetRecords__NoteRegions__.js';
    import { Na__LeSpec__IsLoaded, Na__LeSpec__GetGroups } from './Na__LayoutEditor__SpecData__.js';
    import {
        Na__LePanels__OnControl,
        Na__LePanels__Refresh,
        Na__LePanels__IsEditable,
        Na__LePanels__Row,
        Na__LePanels__Input,
        Na__LePanels__Note
    } from '../40__Ui__Panels/Na__LayoutEditor__PanelHost__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Section It Lives In, and the Grip
    // ------------------------------------------------------------
    const Na__LePanelLeaderless__SECTION  = 'margin';
    const Na__LePanelLeaderless__GRIP_SVG =                                       // <-- The Layers panel's six small squares: the usual "hold here and drag"
        '<svg viewBox="0 0 8 13" aria-hidden="true" focusable="false">' +
            '<rect x="0" y="0"  width="3" height="3" rx="0.6"/><rect x="5" y="0"  width="3" height="3" rx="0.6"/>' +
            '<rect x="0" y="5"  width="3" height="3" rx="0.6"/><rect x="5" y="5"  width="3" height="3" rx="0.6"/>' +
            '<rect x="0" y="10" width="3" height="3" rx="0.6"/><rect x="5" y="10" width="3" height="3" rx="0.6"/>' +
        '</svg>';
    const Na__LePanelLeaderless__DRAG_START_PX = 3;                               // <-- A press that wanders less than this is a click, not a drag
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Shape Last Built For, the Stack on Show and the Drag in Flight
    // ------------------------------------------------------------
    let Na__LePanelLeaderless__Built = '';
    let Na__LePanelLeaderless__Stack = null;                                      // <-- The list of ticked rows the grips sort
    let Na__LePanelLeaderless__Drag  = null;                                      // <-- The reorder in flight: its rows, where each sat, where the group will land
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The First Drawn Region Ticking Each Group (group id -> the region's name)
    // ------------------------------------------------------------
    // The first region down the list that ticks a group takes its notes
    // (Na__LayoutEditor__NoteRegions__), leaderless or not. Regions switched
    // off take nothing, so they are not asked.
    // ------------------------------------------------------------
    function Na__LePanelLeaderless__Claims(sheet) {
        const claims = new Map();
        Na__LeRec__DrawnNoteRegions(sheet).forEach((region, index) => (region.Region__Groups || []).forEach((id) => {
            if (!claims.has(id)) claims.set(id, Na__LeCfg__FormatLabel('RegionName', 'Region {n}', { n : index + 1 }));
        }));
        return claims;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Which Control of the Section Has the Focus, to Give It Back After a Rebuild
    // ------------------------------------------------------------
    function Na__LePanelLeaderless__Focused(host) {
        const el = document.activeElement;
        if (!el || !host.contains(el)) return null;
        const control = el.getAttribute('data-na-control');
        const role    = el.getAttribute('data-na-role');
        return (control && role) ? { control : control, role : role } : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Building
// -----------------------------------------------------------------------------

    // FUNCTION | Build the Switch and the Section's Skeleton (once, into the margin section)
    // ------------------------------------------------------------
    function Na__LePanelLeaderless__Build(body) {
        const L = Na__LeCfg__GetLabel;
        const toggle = Na__LePanels__Row(L('LeaderlessToggle', 'Leaderless Notes'), Na__LePanels__Input('checkbox', 'margin-leaderless'), 'na-le-row--toggle');
        toggle.title = L('LeaderlessToggleTitle', 'Whole specification groups listed on this sheet with no bubble pointing at them - an introduction, or a block of notes that needs no leader. They print first, in the order of the stack.');
        body.appendChild(toggle);

        const section = document.createElement('div');
        section.className = 'na-le-block na-le-leaderless';
        section.setAttribute('data-na-block', 'leaderless');
        const rule = document.createElement('hr');
        rule.className = 'na-le-rule';
        section.appendChild(rule);
        section.appendChild(Na__LePanels__Note(L('LeaderlessIntro', 'Tick a group to list all of its notes on this sheet, bubble or no bubble. Ticked groups print first, before the notes the bubbles link to, top of the stack first: drag a group by its grip to move it.')));
        const lists = document.createElement('div');
        lists.setAttribute('data-na-block', 'leaderless-lists');
        section.appendChild(lists);
        const foot = document.createElement('hr');                               // <-- Closes the section, so the next switch does not read as one of its groups
        foot.className = 'na-le-rule';
        section.appendChild(foot);
        body.appendChild(section);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Group's Row: a Grip While It Is Listed, Its Prefix, Title and Tick
    // ------------------------------------------------------------
    // The tick's row is the overspill regions' group row (Na__LePanels__Row,
    // so a click on the title ticks it too); the grip sits outside it, so a
    // press on the grip never reaches the tick. A row not listed keeps an
    // empty slot where the grip would be, so every title lines up.
    // ------------------------------------------------------------
    function Na__LePanelLeaderless__Row(group, listed, editable, claimedBy) {
        const L   = Na__LeCfg__GetLabel;
        const F   = Na__LeCfg__FormatLabel;
        const id  = group.Group__Id;
        const row = document.createElement('div');
        row.className = 'na-le-leaderless__row' + (listed ? ' is-listed' : '');
        row.setAttribute('data-na-group', id);

        if (listed) {
            const grip = document.createElement('button');
            grip.type      = 'button';
            grip.className = 'na-le-leaderless__grip';
            grip.innerHTML = Na__LePanelLeaderless__GRIP_SVG;
            grip.title     = L('LeaderlessGripTitle', 'Drag up or down to change the order, or use the arrow keys');
            grip.setAttribute('aria-label', grip.title);
            grip.setAttribute('data-na-control', 'leaderless-grip');
            grip.setAttribute('data-na-role', id);
            grip.disabled = !editable;
            if (editable) grip.addEventListener('pointerdown', (e) => Na__LePanelLeaderless__DragStart(e, grip, id));
            row.appendChild(grip);
        } else {
            const slot = document.createElement('span');
            slot.className = 'na-le-leaderless__slot';
            row.appendChild(slot);
        }

        const tick = Na__LePanels__Input('checkbox', 'leaderless-group');
        tick.setAttribute('data-na-role', id);
        tick.checked = listed;
        const line = Na__LePanels__Row(String(group.Group__Title || group.Group__Prefix), tick, 'na-le-row--toggle na-le-region-group');
        const code = document.createElement('span');
        code.className   = 'na-le-region-group__code';
        code.textContent = group.Group__Prefix;
        line.insertBefore(code, line.firstChild);

        // WHERE IT PRINTS, WHEN THAT IS NOT THE MARGIN | Only a listed group is asked
        // ------------------------------------
        const hint  = document.createElement('span');
        hint.className = 'na-le-region-group__taken';
        const empty = !(Array.isArray(group.Group__Notes) && group.Group__Notes.length);
        if (listed && claimedBy) {
            hint.textContent = F('LeaderlessInRegion', 'in {region}', { region : claimedBy });
            hint.title       = F('LeaderlessInRegionTitle', '{region} ticks this group, so its notes print there instead of in the margin.', { region : claimedBy });
        } else if (listed && empty) {
            hint.textContent = L('LeaderlessGroupEmpty', 'no notes');
            hint.title       = L('LeaderlessGroupEmptyTitle', 'This group has no notes yet, so it lists nothing.');
        }
        line.insertBefore(hint, tick);
        row.appendChild(line);
        return row;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Two Lists: the Stack, Then Every Other Group
    // ------------------------------------------------------------
    // kept is the sheet's whole list, in print order; a group the
    // specification does not have (yet) is kept there and shown nowhere.
    // ------------------------------------------------------------
    function Na__LePanelLeaderless__BuildLists(host, kept, groups, claims, editable) {
        const L = Na__LeCfg__GetLabel;
        host.innerHTML = '';
        Na__LePanelLeaderless__Stack = null;
        if (!Na__LeSpec__IsLoaded()) { host.appendChild(Na__LePanels__Note(L('MarginSpecLoading', 'Loading the project specification...'))); return; }
        if (!groups.length) { host.appendChild(Na__LePanels__Note(L('RegionGroupsNone', 'The project specification has no groups yet.'))); return; }

        const byId   = new Map(groups.map((group) => [ group.Group__Id, group ]));
        const listed = kept.map((id) => byId.get(id)).filter(Boolean);
        const others = groups.filter((group) => kept.indexOf(group.Group__Id) === -1);

        const stackHeading = Na__LePanels__Note(L('LeaderlessStack', 'Listed first'));
        stackHeading.classList.add('na-le-note--heading');
        host.appendChild(stackHeading);
        const stack = document.createElement('div');
        stack.className = 'na-le-leaderless__list na-le-leaderless__stack';
        stack.setAttribute('data-na-block', 'leaderless-stack');
        listed.forEach((group) => stack.appendChild(Na__LePanelLeaderless__Row(group, true, editable, claims.get(group.Group__Id) || null)));
        host.appendChild(stack);
        if (!listed.length) host.appendChild(Na__LePanels__Note(L('LeaderlessStackEmpty', 'Nothing ticked yet. Tick a group below to list it here.')));
        Na__LePanelLeaderless__Stack = stack;

        if (!others.length) return;
        const othersHeading = Na__LePanels__Note(L('LeaderlessOthers', 'Other groups'));
        othersHeading.classList.add('na-le-note--heading');
        host.appendChild(othersHeading);
        const rest = document.createElement('div');
        rest.className = 'na-le-leaderless__list';
        others.forEach((group) => rest.appendChild(Na__LePanelLeaderless__Row(group, false, editable, null)));
        host.appendChild(rest);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reflecting the Sheet
// -----------------------------------------------------------------------------

    // FUNCTION | Reflect the Active Sheet's Leaderless Notes
    // ------------------------------------------------------------
    // The lists are built again only when their shape has changed - a tick,
    // a move, the specification's groups or notes, a region claiming a group
    // - and never while a row is being dragged (the drop redraws).
    // ------------------------------------------------------------
    function Na__LePanelLeaderless__Refresh(body, sheet) {
        const on = Na__LeRec__LeaderlessOn(sheet);
        body.querySelector('[data-na-control="margin-leaderless"]').checked = on;
        const section = body.querySelector('[data-na-block="leaderless"]');
        section.hidden = !on;
        if (!on) return;
        if (Na__LePanelLeaderless__Drag) { Na__LePanelLeaderless__Drag.pending = true; return; }   // <-- Rebuilding mid-drag would pull the rows out from under the pointer

        const editable = Na__LePanels__IsEditable();
        const loaded   = Na__LeSpec__IsLoaded();
        const groups   = loaded ? Na__LeSpec__GetGroups() : [];
        const kept     = Na__LeRec__LeaderlessGroups(sheet);
        const claims   = Na__LePanelLeaderless__Claims(sheet);
        const host     = body.querySelector('[data-na-block="leaderless-lists"]');
        const shape    = JSON.stringify([ sheet.Sheet__Id, kept, loaded, editable, Array.from(claims.entries()),
                                          groups.map((g) => [ g.Group__Id, g.Group__Prefix, g.Group__Title, Array.isArray(g.Group__Notes) ? g.Group__Notes.length : 0 ]) ]);
        if (shape === Na__LePanelLeaderless__Built && host.childElementCount) return;
        const focus = Na__LePanelLeaderless__Focused(host);
        Na__LePanelLeaderless__BuildLists(host, kept, groups, claims, editable);
        Na__LePanelLeaderless__Built = shape;
        if (focus) {                                                              // <-- The same group's grip or tick, wherever its row went
            const again = host.querySelector('[data-na-control="' + focus.control + '"][data-na-role="' + CSS.escape(focus.role) + '"]');
            if (again) { try { again.focus({ preventScroll : true }); } catch (e) { again.focus(); } }
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Grip Drag
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Press on a Grip: Measure Every Row of the Stack Once
    // ------------------------------------------------------------
    // The Layers panel's grip, rule for rule: rows and pointer are both
    // measured from the top of the stack, so a panel that scrolls mid-drag
    // still lines up, and the window listens in the capture phase, so the
    // drag ends where it should wherever the pointer wanders.
    // ------------------------------------------------------------
    function Na__LePanelLeaderless__DragStart(event, grip, groupId) {
        const stack = Na__LePanelLeaderless__Stack;
        if (event.button !== 0 || Na__LePanelLeaderless__Drag || !stack || !stack.contains(grip) || !Na__LePanels__IsEditable()) return;
        const rows = Array.from(stack.children);
        const from = rows.indexOf(grip.closest('.na-le-leaderless__row'));
        if (from === -1) return;
        event.preventDefault();                                                   // <-- No text selection starting under the pointer
        const top = stack.getBoundingClientRect().top;
        Na__LePanelLeaderless__Drag = {
            groupId   : groupId,
            pointerId : event.pointerId,
            stack     : stack,
            rows      : rows,
            slots     : rows.map((r) => { const box = r.getBoundingClientRect(); return { top : box.top - top, height : box.height }; }),
            from      : from,
            to        : from,
            startY    : event.clientY - top,
            moved     : false,
            pending   : false                                                     // <-- Set when a refresh arrives mid-drag; paid at the end
        };
        try { grip.setPointerCapture(event.pointerId); } catch (err) { /* A scripted pointer has nothing to capture; the window still hears it */ }
        window.addEventListener('pointermove',   Na__LePanelLeaderless__DragMove, true);
        window.addEventListener('pointerup',     Na__LePanelLeaderless__DragUp, true);
        window.addEventListener('pointercancel', Na__LePanelLeaderless__DragUp, true);
        window.addEventListener('keydown',       Na__LePanelLeaderless__DragAbandon, true);
        window.addEventListener('blur',          Na__LePanelLeaderless__DragAbandon);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Move: The Row Follows, the Rows It Passes Slide Aside
    // ------------------------------------------------------------
    // A row takes a place once its LEADING EDGE passes the middle of the row
    // there, not its centre, so the first and last places can be reached
    // (the Layers grip's reason).
    // ------------------------------------------------------------
    function Na__LePanelLeaderless__DragMove(event) {
        const drag = Na__LePanelLeaderless__Drag;
        if (!drag || event.pointerId !== drag.pointerId) return;
        let dy = (event.clientY - drag.stack.getBoundingClientRect().top) - drag.startY;
        if (!drag.moved) {
            if (Math.abs(dy) < Na__LePanelLeaderless__DRAG_START_PX) return;
            drag.moved = true;
            drag.stack.classList.add('is-sorting');
            drag.rows[drag.from].classList.add('is-dragging');
            document.body.classList.add('na-le-sorting');                         // <-- The grabbing cursor holds wherever the pointer wanders
        }
        const own   = drag.slots[drag.from];
        const first = drag.slots[0];
        const last  = drag.slots[drag.slots.length - 1];
        dy = Math.max(first.top - own.top, Math.min((last.top + last.height) - (own.top + own.height), dy));   // <-- Never above the first row or below the last
        const edgeTop    = own.top + dy;
        const edgeBottom = edgeTop + own.height;
        let to = drag.from;
        drag.slots.forEach((slot, i) => {
            const middle = slot.top + slot.height / 2;
            if (i < drag.from && edgeTop < middle && i < to) to = i;              // <-- Above: the highest row whose middle the top edge has passed
            if (i > drag.from && edgeBottom > middle) to = i;                     // <-- Below: the lowest row whose middle the bottom edge has passed
        });
        drag.to = to;
        const pitch = own.height + (drag.slots.length > 1 ? drag.slots[1].top - (first.top + first.height) : 0);   // <-- One row plus the list's gap
        drag.rows.forEach((row, i) => {
            const shift = i === drag.from ? dy : ((i > drag.from && i <= to) ? -pitch : ((i < drag.from && i >= to) ? pitch : 0));
            row.style.transform = shift ? 'translateY(' + shift + 'px)' : '';
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Release, Cancel, Escape or the Window Losing Focus
    // ------------------------------------------------------------
    function Na__LePanelLeaderless__DragUp(event) {
        const drag = Na__LePanelLeaderless__Drag;
        if (drag && event.pointerId === drag.pointerId) Na__LePanelLeaderless__DragEnd(event.type === 'pointerup');   // <-- A cancelled pointer moves nothing
    }
    function Na__LePanelLeaderless__DragAbandon(event) {
        if (event.type === 'keydown') {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();                                              // <-- Escape drops the drag, not the tool or the editor
        }
        Na__LePanelLeaderless__DragEnd(false);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | End the Drag: One Move, or None
    // ------------------------------------------------------------
    // The drag is cleared BEFORE the move: the move's 'margin' announcement
    // refreshes this section synchronously, and a refresh that still found a
    // drag in flight would be put off, leaving the rows in their old order.
    // The group lands at the place, in the sheet's WHOLE list, of the group
    // whose slot it was dropped in - so a group the specification has lost,
    // kept in the list and shown nowhere, never throws the order out.
    // ------------------------------------------------------------
    function Na__LePanelLeaderless__DragEnd(commit) {
        const drag = Na__LePanelLeaderless__Drag;
        if (!drag) return;
        Na__LePanelLeaderless__Drag = null;
        window.removeEventListener('pointermove',   Na__LePanelLeaderless__DragMove, true);
        window.removeEventListener('pointerup',     Na__LePanelLeaderless__DragUp, true);
        window.removeEventListener('pointercancel', Na__LePanelLeaderless__DragUp, true);
        window.removeEventListener('keydown',       Na__LePanelLeaderless__DragAbandon, true);
        window.removeEventListener('blur',          Na__LePanelLeaderless__DragAbandon);
        document.body.classList.remove('na-le-sorting');
        drag.stack.classList.remove('is-sorting');
        drag.rows.forEach((row) => { row.style.transform = ''; row.classList.remove('is-dragging'); });

        const landed = commit && drag.moved && drag.to !== drag.from && drag.rows[drag.from].isConnected;   // <-- Not if the editor closed under the drag
        const sheet  = landed ? Na__LeModel__GetActiveSheet() : null;
        const target = sheet ? drag.rows[drag.to].getAttribute('data-na-group') : null;
        const index  = target ? Na__LeRec__LeaderlessGroups(sheet).indexOf(target) : -1;
        const moved  = index !== -1 && Na__LePanels__IsEditable() && Na__LeModel__UpdateMarginNotes(sheet, { leaderlessMove : { id : drag.groupId, index : index } });
        if (!moved && drag.pending) Na__LePanels__Refresh(Na__LePanelLeaderless__SECTION);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Arrow Keys on a Focused Grip: One Row Up or Down
    // ------------------------------------------------------------
    // One row of the stack as it is shown, landed at that row's place in the
    // whole list. The rebuild that follows gives the focus back to the grip.
    // ------------------------------------------------------------
    function Na__LePanelLeaderless__Step(groupId, step) {
        const sheet = Na__LeModel__GetActiveSheet();
        const stack = Na__LePanelLeaderless__Stack;
        if (!sheet || !stack || Na__LePanelLeaderless__Drag || !Na__LePanels__IsEditable()) return;
        const shown = Array.from(stack.children).map((row) => row.getAttribute('data-na-group'));
        const at    = shown.indexOf(groupId);
        const next  = at === -1 ? null : shown[at + step];
        if (!next) return;
        Na__LeModel__UpdateMarginNotes(sheet, { leaderlessMove : { id : groupId, index : Na__LeRec__LeaderlessGroups(sheet).indexOf(next) } });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Controls
// -----------------------------------------------------------------------------

    // FUNCTION | Register the Switch, the Ticks and the Grips' Keys
    // ------------------------------------------------------------
    // role is the group's id, so one handler serves every row.
    // ------------------------------------------------------------
    function Na__LePanelLeaderless__Register() {
        const on    = Na__LePanels__OnControl;
        const sheet = () => Na__LeModel__GetActiveSheet();
        const can   = () => !!sheet() && Na__LePanels__IsEditable();
        on('change', 'margin-leaderless', (e, el) => { if (can()) Na__LeModel__UpdateMarginNotes(sheet(), { leaderlessOn : el.checked }); });
        on('change', 'leaderless-group',  (e, el, role) => { if (can() && role) Na__LeModel__UpdateMarginNotes(sheet(), { leaderlessGroup : { id : role, on : el.checked } }); });
        on('keydown', 'leaderless-grip',  (e, el, role) => {
            const step = e.key === 'ArrowUp' ? -1 : (e.key === 'ArrowDown' ? 1 : 0);
            if (!step) return;
            e.preventDefault();
            e.stopPropagation();                                                  // <-- An arrow on the grip moves the group, not the selection on the sheet
            Na__LePanelLeaderless__Step(role, step);
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Margin Notes Panel Leaderless API
    // ------------------------------------------------------------
    export {
        Na__LePanelLeaderless__Build,
        Na__LePanelLeaderless__Refresh,
        Na__LePanelLeaderless__Register
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
