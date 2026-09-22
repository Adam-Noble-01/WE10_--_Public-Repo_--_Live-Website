// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PANEL: MARGIN NOTES - OVERSPILL NOTE REGIONS
// =============================================================================
//
// FILE       : Na__LayoutEditor__Panel__MarginNotes__Regions__.js
// NAMESPACE  : Na__LePanelRegions
// MODULE     : Layout Editor - Panel Margin Notes - Regions
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The Overspill Note Regions part of the Margin Notes panel: the switch, a fold per region with its title, borders and groups, and Add region
// CREATED    : 22-Sep-2026
//
// DESCRIPTION:
// - HIDDEN UNTIL IT IS WANTED. One switch, Overspill Note Regions, under the
//   margin's own settings. Off, that is all there is. On, a rule and the
//   section come up under it: a line saying what regions are for, a fold per
//   region, and Add region.
// - ADD REGION puts the Region tool up (Na__LayoutEditor__NoteRegions__Tool__):
//   the next box dragged on the sheet - snapping as the Rectangle tool does -
//   becomes a region, the tool goes back to Select, and the new region's fold
//   opens here. Each region has a fold of its own, the Leaders panel's
//   Endpoint fold in look, headed with its number and what it lists
//   ("REGION 2 - SN, FN"):
//     a line saying what it holds, what carries on and what does not fit
//     Title      what it prints across its top; empty, the automatic title
//                shows as the placeholder
//     Borders    Top, Right, Bottom and Left, each on or off - the notes
//                margin's divider line
//     Lists      Overspill, then a switch per specification group; a group
//                an earlier region lists says so, because the first region
//                ticking a group is the one that gets it
//     Redraw     drag a new box for it; Delete, which undo brings back
//   The pointer over a region's fold lights that region on the sheet.
// - NOT REBUILT UNDER THE HAND. The folds are built again only when what
//   they are built from changes - which regions the sheet has, the
//   specification's groups - and never while one of their own fields has the
//   focus; every other refresh sets their values in place, so a title being
//   typed keeps its caret and the region under the pointer stays lit.
//
// INTEGRATION:
// - Na__LayoutEditor__Panel__MarginNotes__ builds it into its section (Build),
//   refreshes it with the section (Refresh) and registers its controls
//   (Register).
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (22-Sep-2026)
// - ValeVision    : not yet ported - it goes with the rest of the regions.
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

    // MODULE IMPORTS | Config, Model, Records, Tools, Specification, the Regions and the Panel Host
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__GetActiveSheet, Na__LeModel__UpdateMarginNotes, Na__LeModel__UpdateNoteRegion, Na__LeModel__DeleteNoteRegion } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeRec__REGION_SIDES, Na__LeRec__NoteRegions, Na__LeRec__NoteRegionsOn, Na__LeRec__NoteRegionById } from '../07__Core__SheetData/Na__LayoutEditor__SheetRecords__NoteRegions__.js';
    import { Na__LeTools__TOOL_SELECT, Na__LeTools__TOOL_REGION, Na__LeTools__CHANGED_EVENT, Na__LeTools__GetTool, Na__LeTools__SetTool } from '../30__System__SheetTools/Na__LayoutEditor__SheetTools__.js';
    import { Na__LeSpec__IsLoaded, Na__LeSpec__GetGroups } from './Na__LayoutEditor__SpecData__.js';
    import { Na__LeRegions__AutoTitle } from './Na__LayoutEditor__NoteRegions__.js';
    import { Na__LeRegionTool__PLACED_EVENT, Na__LeRegionTool__Arm, Na__LeRegionTool__Disarm, Na__LeRegionTool__GetTarget } from './Na__LayoutEditor__NoteRegions__Tool__.js';
    import { Na__LeRegionGrip__Highlight } from './Na__LayoutEditor__NoteRegions__Grips__.js';
    import {
        Na__LePanels__OnControl,
        Na__LePanels__Refresh,
        Na__LePanels__IsEditable,
        Na__LePanels__Row,
        Na__LePanels__Input,
        Na__LePanels__Button,
        Na__LePanels__Note
    } from '../40__Ui__Panels/Na__LayoutEditor__PanelHost__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Section It Lives In, and Where a Fold Remembers Being Open
    // ------------------------------------------------------------
    const Na__LePanelRegions__SECTION  = 'margin';
    const Na__LePanelRegions__FOLD_KEY = 'na-layouteditor-panel:fold-region-';   // <-- The panel host's prefix, so it sits with the other fold states; the sheet and the region follow
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Shape the Folds Were Last Built For, and Whether the Listeners Are Up
    // ------------------------------------------------------------
    let Na__LePanelRegions__Built     = '';
    let Na__LePanelRegions__Listening = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Remember and Recall Whether a Region's Fold Is Open
    // ------------------------------------------------------------
    function Na__LePanelRegions__FoldKey(sheetId, regionId) {
        return Na__LePanelRegions__FOLD_KEY + sheetId + ':' + regionId;
    }
    function Na__LePanelRegions__IsOpen(sheetId, regionId) {
        try { return window.localStorage.getItem(Na__LePanelRegions__FoldKey(sheetId, regionId)) === '1'; } catch (e) { return false; }
    }
    function Na__LePanelRegions__SetOpen(sheetId, regionId, open) {
        try { window.localStorage.setItem(Na__LePanelRegions__FoldKey(sheetId, regionId), open ? '1' : '0'); } catch (e) { /* storage unavailable */ }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Region's Name: Its Place in the List
    // ------------------------------------------------------------
    function Na__LePanelRegions__Name(index) {
        return Na__LeCfg__FormatLabel('RegionName', 'Region {n}', { n : index + 1 });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What a Region Lists, in a Few Words, for Its Fold's Heading
    // ------------------------------------------------------------
    function Na__LePanelRegions__Summary(region) {
        const L      = Na__LeCfg__GetLabel;
        const groups = Na__LeSpec__GetGroups();
        const parts  = [];
        if (region.Region__Overspill) parts.push(L('RegionSummaryOverspill', 'Overspill'));
        (region.Region__Groups || []).forEach((id) => { const group = groups.find((g) => g.Group__Id === id); if (group) parts.push(group.Group__Prefix); });
        return parts.length ? parts.join(', ') : L('RegionSummaryNothing', 'Nothing ticked');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The First Region Ticking Each Group (group id -> the region's index)
    // ------------------------------------------------------------
    function Na__LePanelRegions__Owners(regions) {
        const owners = new Map();
        regions.forEach((region, index) => (region.Region__Groups || []).forEach((id) => { if (!owners.has(id)) owners.set(id, index); }));
        return owners;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Line That Says What One Region Holds (and whether it is a warning)
    // ------------------------------------------------------------
    // placed is the region's line in Na__LeMargin__Report's regions, or null
    // when it is not drawn (the regions switched off).
    // ------------------------------------------------------------
    function Na__LePanelRegions__Status(region, placed, report) {
        const L = Na__LeCfg__GetLabel;
        const F = Na__LeCfg__FormatLabel;
        if (!placed) return { text : '', warn : false };
        if (report.pending) return { text : L('MarginSpecLoading', 'Loading the project specification...'), warn : false };
        if (placed.listed === 0) {
            if (report.total === 0)       return { text : L('MarginEmpty', 'Nothing to list yet: link a specification bubble to a note, or add general notes in Project Specification.'), warn : false };
            if (region.Region__Overspill) return { text : L('RegionStatusIdleOverspill', 'Empty until the margin runs out of room.'), warn : false };
            if ((region.Region__Groups || []).length) return { text : L('RegionStatusIdleGroups', 'None of this sheet\'s notes are in the groups ticked.'), warn : false };
            return { text : L('RegionStatusIdleNothing', 'Tick Overspill or a group for it to list notes.'), warn : false };
        }
        if (placed.shown === 0) return { text : L('RegionStatusTooSmall', 'Too small for its first note: make it larger or the text smaller.'), warn : true };
        let text = F('RegionStatusLists', 'Lists {shown}.', { shown : placed.shown });
        if (placed.tail > 0 && placed.carriedTo !== null) text += ' ' + F('RegionStatusContinues', '{count} carry on in {region}.', { count : placed.tail, region : Na__LePanelRegions__Name(placed.carriedTo) });
        else if (placed.lost > 0) text += ' ' + F('RegionStatusOverflow', '{count} do not fit: make it larger or the text smaller.', { count : placed.lost });
        return { text : text, warn : placed.lost > 0 };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Building
// -----------------------------------------------------------------------------

    // FUNCTION | Build the Switch and the Section's Skeleton (once, into the margin section)
    // ------------------------------------------------------------
    function Na__LePanelRegions__Build(body) {
        const L = Na__LeCfg__GetLabel;
        const toggle = Na__LePanels__Row(L('RegionsToggle', 'Overspill Note Regions'), Na__LePanels__Input('checkbox', 'margin-regions'), 'na-le-row--toggle');
        toggle.title = L('RegionsToggleTitle', 'Boxes drawn on the sheet that hold the notes the margin cannot fit, or the groups picked for them.');
        body.appendChild(toggle);

        const section = document.createElement('div');
        section.className = 'na-le-block na-le-regions';
        section.setAttribute('data-na-block', 'regions');
        const rule = document.createElement('hr');
        rule.className = 'na-le-rule';
        section.appendChild(rule);
        section.appendChild(Na__LePanels__Note(L('RegionsIntro', 'Draw a region on the sheet for the notes the margin cannot fit, or for the groups picked for it. A group ticked in a region leaves the margin.')));
        const list = document.createElement('div');
        list.className = 'na-le-regions__list';
        list.setAttribute('data-na-block', 'region-list');
        section.appendChild(list);
        if (Na__LePanels__IsEditable()) {
            const bar = document.createElement('div');
            bar.className = 'na-le-bar';
            const add = Na__LePanels__Button(L('RegionAdd', 'Add region'), 'region-add', 'na-le-btn--primary');
            add.title = L('RegionAddTitle', 'Drag a box on the sheet for a new region. It snaps as the Rectangle tool does; Esc cancels.');
            bar.appendChild(add);
            section.appendChild(bar);
            const drawing = Na__LePanels__Note(L('RegionDrawing', 'Drag a box on the sheet, or click two corners. Esc cancels.'));
            drawing.setAttribute('data-na-block', 'region-drawing');
            drawing.hidden = true;
            section.appendChild(drawing);
        }
        body.appendChild(section);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Region's Fold: Its Heading, and the Rows It Opens
    // ------------------------------------------------------------
    function Na__LePanelRegions__BuildFold(sheet, region, index, groups, editable) {
        const L    = Na__LeCfg__GetLabel;
        const id   = region.Region__Id;
        const wrap = document.createElement('div');
        wrap.className = 'na-le-region-fold';
        wrap.setAttribute('data-na-region', id);
        wrap.addEventListener('mouseenter', () => Na__LeRegionGrip__Highlight(id));   // <-- "That one", on the sheet
        wrap.addEventListener('mouseleave', () => Na__LeRegionGrip__Highlight(null));

        // THE HEADING | The Leaders panel's quiet fold toggle, with what it lists after its name
        // ------------------------------------
        const toggle = document.createElement('button');
        toggle.type      = 'button';
        toggle.className = 'na-le-adv-toggle na-le-subfold-toggle na-le-region-fold__toggle';
        toggle.innerHTML = '<span class="na-le-adv-toggle__chevron" aria-hidden="true"></span><span class="na-le-adv-toggle__label"></span><span class="na-le-region-fold__summary"></span>';
        toggle.querySelector('.na-le-adv-toggle__label').textContent = Na__LePanelRegions__Name(index);
        toggle.setAttribute('data-na-control', 'region-fold');
        toggle.setAttribute('data-na-role', id);
        wrap.appendChild(toggle);

        const block = document.createElement('div');
        block.className = 'na-le-block na-le-subfold na-le-region-fold__body';
        const status = Na__LePanels__Note('');
        status.setAttribute('data-na-part', 'status');
        block.appendChild(status);

        // TITLE | What it prints across its top
        const title = Na__LePanels__Input('text', 'region-title');
        title.setAttribute('data-na-role', id);
        block.appendChild(Na__LePanels__Row(L('RegionTitle', 'Title'), title));

        // BORDERS | Each side on its own, the margin divider's line
        // ------------------------------------
        const sides = document.createElement('span');
        sides.className = 'na-le-toggle-group na-le-toggle-group--tight';
        Na__LeRec__REGION_SIDES.forEach((side) => {
            const button = Na__LePanels__Button(L('RegionBorder' + side, side), 'region-border', 'na-le-btn--toggle', id + '|' + side);
            button.setAttribute('data-na-side', side);
            button.disabled = !editable;
            sides.appendChild(button);
        });
        const borders = document.createElement('div');                           // <-- A div, not the label row: a label would hand a click on its caption to the first side
        borders.className = 'na-le-row';
        borders.title = L('RegionBordersTitle', 'The region\'s border lines, side by side: the same line as the notes margin\'s left edge.');
        const caption = document.createElement('span');
        caption.className   = 'na-le-row__label';
        caption.textContent = L('RegionBorders', 'Borders');
        borders.appendChild(caption);
        borders.appendChild(sides);
        block.appendChild(borders);

        // LISTS | The overspill, then every group of the specification
        // ------------------------------------
        const heading = Na__LePanels__Note(L('RegionLists', 'Lists'));
        heading.classList.add('na-le-note--heading');
        block.appendChild(heading);
        const spill = Na__LePanels__Input('checkbox', 'region-overspill');
        spill.setAttribute('data-na-role', id);
        const spillRow = Na__LePanels__Row(L('RegionOverspill', 'Overspill'), spill, 'na-le-row--toggle');
        spillRow.title = L('RegionOverspillTitle', 'The notes that do not fit in the margin or in their own region, carried on in specification order after this region\'s own groups.');
        block.appendChild(spillRow);
        if (!Na__LeSpec__IsLoaded()) block.appendChild(Na__LePanels__Note(L('RegionGroupsLoading', 'Loading the project specification...')));
        else if (!groups.length) block.appendChild(Na__LePanels__Note(L('RegionGroupsNone', 'The project specification has no groups yet.')));
        groups.forEach((group) => {
            const tick = Na__LePanels__Input('checkbox', 'region-group');
            tick.setAttribute('data-na-role', id + '|' + group.Group__Id);
            const row = Na__LePanels__Row(String(group.Group__Title || group.Group__Prefix), tick, 'na-le-row--toggle na-le-region-group');
            const code = document.createElement('span');
            code.className   = 'na-le-region-group__code';
            code.textContent = group.Group__Prefix;
            row.insertBefore(code, row.firstChild);
            const taken = document.createElement('span');
            taken.className = 'na-le-region-group__taken';
            taken.setAttribute('data-na-group', group.Group__Id);
            row.insertBefore(taken, tick);
            block.appendChild(row);
        });

        // HOW TO SHAPE IT, AND THE TWO ACTIONS
        // ------------------------------------
        block.appendChild(Na__LePanels__Note(L('RegionHelp', 'Drag its edges or corners on the sheet to resize it, or the tab above it to move it.')));
        if (editable) {
            const bar = document.createElement('div');
            bar.className = 'na-le-bar';
            const redraw = Na__LePanels__Button(L('RegionRedraw', 'Redraw'), 'region-redraw', 'na-le-btn--small', id);
            redraw.title = L('RegionRedrawTitle', 'Drag a new box for this region on the sheet');
            const remove = Na__LePanels__Button(L('RegionDelete', 'Delete'), 'region-delete', 'na-le-btn--small na-le-btn--danger', id);
            remove.title = L('RegionDeleteTitle', 'Delete this region. Undo brings it back.');
            bar.appendChild(redraw);
            bar.appendChild(remove);
            block.appendChild(bar);
        }
        wrap.appendChild(block);
        const open = Na__LePanelRegions__IsOpen(sheet.Sheet__Id, id);
        block.hidden = !open;
        toggle.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', String(open));
        return wrap;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reflecting the Sheet
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Set One Region's Fold to What Its Record and the Plan Say
    // ------------------------------------------------------------
    // A read-only session's fold was built with every field disabled
    // (Na__LePanels__Input) and without Redraw or Delete, so only values move.
    // ------------------------------------------------------------
    function Na__LePanelRegions__Fill(fold, region, index, placed, report, owners) {
        const summary = fold.querySelector('.na-le-region-fold__summary');
        summary.textContent = Na__LePanelRegions__Summary(region);
        const status = Na__LePanelRegions__Status(region, placed, report);
        const note = fold.querySelector('[data-na-part="status"]');
        note.textContent = status.text;
        note.hidden      = !status.text;
        note.classList.toggle('na-le-note--warn', status.warn);

        const title = fold.querySelector('[data-na-control="region-title"]');
        if (document.activeElement !== title) title.value = region.Region__Title || '';
        title.placeholder = Na__LeRegions__AutoTitle(region);
        title.title = Na__LeCfg__FormatLabel('RegionTitleTitle', 'Printed across the top of the region. Left empty it reads {title}.', { title : Na__LeRegions__AutoTitle(region).toUpperCase() });

        fold.querySelectorAll('[data-na-control="region-border"]').forEach((button) => {
            const on = !!(region.Region__Borders && region.Region__Borders[button.getAttribute('data-na-side')]);
            button.classList.toggle('na-le-btn--active', on);
            button.setAttribute('aria-pressed', String(on));
        });
        fold.querySelector('[data-na-control="region-overspill"]').checked = region.Region__Overspill === true;
        fold.querySelectorAll('[data-na-control="region-group"]').forEach((tick) => {
            const groupId = tick.getAttribute('data-na-role').split('|')[1];
            tick.checked = (region.Region__Groups || []).indexOf(groupId) !== -1;
            const owner = owners.has(groupId) ? owners.get(groupId) : null;
            const hint  = fold.querySelector('.na-le-region-group__taken[data-na-group="' + groupId + '"]');
            const taken = owner !== null && owner < index;                       // <-- An earlier region lists it: the first to tick a group gets it
            hint.textContent = taken ? Na__LeCfg__FormatLabel('RegionGroupTaken', 'in {region}', { region : Na__LePanelRegions__Name(owner) }) : '';
            hint.title       = taken ? Na__LeCfg__FormatLabel('RegionGroupTakenTitle', '{region} lists this group, so it is listed there: a group ticked in two regions goes to the first.', { region : Na__LePanelRegions__Name(owner) }) : '';
            hint.classList.toggle('is-conflict', taken && tick.checked);
        });

        const target = Na__LeRegionTool__GetTarget();
        const redraw = fold.querySelector('[data-na-control="region-redraw"]');
        if (redraw) redraw.classList.toggle('na-le-btn--active', Na__LeTools__GetTool() === Na__LeTools__TOOL_REGION && !!target && target.regionId === region.Region__Id);
    }
    // ------------------------------------------------------------


    // FUNCTION | Reflect the Active Sheet's Regions
    // ------------------------------------------------------------
    // report is Na__LeMargin__Report for the sheet, which the margin section
    // has already asked for. The folds are rebuilt only when their shape has
    // changed, and never while one of their own fields has the focus.
    // ------------------------------------------------------------
    function Na__LePanelRegions__Refresh(body, sheet, report) {
        const on       = Na__LeRec__NoteRegionsOn(sheet);
        const editable = Na__LePanels__IsEditable();
        body.querySelector('[data-na-control="margin-regions"]').checked = on;
        const section = body.querySelector('[data-na-block="regions"]');
        section.hidden = !on;
        if (!on) { Na__LeRegionGrip__Highlight(null); return; }

        const regions = Na__LeRec__NoteRegions(sheet);
        const groups  = Na__LeSpec__IsLoaded() ? Na__LeSpec__GetGroups() : [];
        const host    = body.querySelector('[data-na-block="region-list"]');
        const shape   = JSON.stringify([ sheet.Sheet__Id, regions.map((r) => r.Region__Id), Na__LeSpec__IsLoaded(), groups.map((g) => [ g.Group__Id, g.Group__Prefix, g.Group__Title ]), editable ]);
        const typing  = document.activeElement && host.contains(document.activeElement);
        if (shape !== Na__LePanelRegions__Built && !typing) {
            host.innerHTML = '';
            Na__LeRegionGrip__Highlight(null);                                  // <-- The fold under the pointer is about to be a new element
            regions.forEach((region, index) => host.appendChild(Na__LePanelRegions__BuildFold(sheet, region, index, groups, editable)));
            Na__LePanelRegions__Built = shape;
        }
        const owners = Na__LePanelRegions__Owners(regions);
        regions.forEach((region, index) => {
            const fold = host.querySelector('.na-le-region-fold[data-na-region="' + region.Region__Id + '"]');
            if (!fold) return;
            const placed = report.regions.find((entry) => entry.id === region.Region__Id) || null;
            Na__LePanelRegions__Fill(fold, region, index, placed, report, owners);
        });

        const drawing = Na__LeTools__GetTool() === Na__LeTools__TOOL_REGION;
        const target  = Na__LeRegionTool__GetTarget();
        const add     = body.querySelector('[data-na-control="region-add"]');
        if (add) add.classList.toggle('na-le-btn--active', drawing && !!target && !target.regionId);
        const hint = body.querySelector('[data-na-block="region-drawing"]');
        if (hint) hint.hidden = !drawing;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Controls
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Put the Region Tool Up for a New Region, or for One to Be Redrawn
    // ------------------------------------------------------------
    function Na__LePanelRegions__Draw(regionId) {
        const sheet = Na__LeModel__GetActiveSheet();
        if (!sheet || !Na__LePanels__IsEditable()) return;
        Na__LeRegionTool__Arm(sheet, regionId || null);
        Na__LeTools__SetTool(Na__LeTools__TOOL_REGION);
        Na__LePanels__Refresh(Na__LePanelRegions__SECTION);
    }
    // ------------------------------------------------------------


    // FUNCTION | Register the Controls and Listen for the Tool
    // ------------------------------------------------------------
    // role is the region's id, or "id|side" and "id|groupId" for a border and
    // a group, so one handler serves every fold.
    // ------------------------------------------------------------
    function Na__LePanelRegions__Register() {
        const on    = Na__LePanels__OnControl;
        const sheet = () => Na__LeModel__GetActiveSheet();
        const can   = () => !!sheet() && Na__LePanels__IsEditable();
        const split = (role) => String(role || '').split('|');

        on('change', 'margin-regions', (e, el) => { if (can()) Na__LeModel__UpdateMarginNotes(sheet(), { regionsOn : el.checked }); });
        on('click',  'region-add',     () => Na__LePanelRegions__Draw(null));
        on('click',  'region-redraw',  (e, el, role) => Na__LePanelRegions__Draw(role));
        on('click',  'region-delete',  (e, el, role) => { if (can()) Na__LeModel__DeleteNoteRegion(sheet(), role); });
        on('change', 'region-title',   (e, el, role) => { if (can()) Na__LeModel__UpdateNoteRegion(sheet(), role, { title : el.value }); });
        on('change', 'region-overspill', (e, el, role) => { if (can()) Na__LeModel__UpdateNoteRegion(sheet(), role, { overspill : el.checked }); });
        on('change', 'region-group',   (e, el, role) => { const p = split(role); if (can()) Na__LeModel__UpdateNoteRegion(sheet(), p[0], { group : { id : p[1], on : el.checked } }); });
        on('click',  'region-border',  (e, el, role) => {
            const p      = split(role);
            const region = can() ? Na__LeRec__NoteRegionById(sheet(), p[0]) : null;
            if (!region) return;
            const borders = {};
            borders[p[1]] = !(region.Region__Borders && region.Region__Borders[p[1]]);
            Na__LeModel__UpdateNoteRegion(sheet(), p[0], { borders : borders });
        });
        on('click',  'region-fold',    (e, el, role) => {                     // <-- Folds in place: nothing on the sheet changes
            const current = sheet();
            const fold    = el.closest('.na-le-region-fold');
            const block   = fold ? fold.querySelector('.na-le-region-fold__body') : null;
            if (!current || !block) return;
            const open = block.hidden;
            block.hidden = !open;
            el.classList.toggle('is-open', open);
            el.setAttribute('aria-expanded', String(open));
            Na__LePanelRegions__SetOpen(current.Sheet__Id, role, open);
        });

        if (!Na__LePanelRegions__Listening) {
            Na__LePanelRegions__Listening = true;
            // THE TOOL | Leaving the Region tool drops what it was armed for;
            // either way the Add and Redraw buttons say whether it is up
            window.addEventListener(Na__LeTools__CHANGED_EVENT, (event) => {
                const tool = event.detail ? event.detail.tool : Na__LeTools__GetTool();
                if (tool !== Na__LeTools__TOOL_REGION) Na__LeRegionTool__Disarm();
                Na__LePanels__Refresh(Na__LePanelRegions__SECTION);
            });
            // A REGION LANDED | Select comes back up, and its fold opens
            window.addEventListener(Na__LeRegionTool__PLACED_EVENT, (event) => {
                const detail = event.detail || {};
                if (detail.sheetId && detail.regionId && detail.added) Na__LePanelRegions__SetOpen(detail.sheetId, detail.regionId, true);
                Na__LePanelRegions__Built = '';                                  // <-- Build again, so the fold opens as remembered
                if (Na__LeTools__GetTool() === Na__LeTools__TOOL_REGION) Na__LeTools__SetTool(Na__LeTools__TOOL_SELECT);
                Na__LePanels__Refresh(Na__LePanelRegions__SECTION);
            });
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Margin Notes Panel Regions API
    // ------------------------------------------------------------
    export {
        Na__LePanelRegions__Build,
        Na__LePanelRegions__Refresh,
        Na__LePanelRegions__Register
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
