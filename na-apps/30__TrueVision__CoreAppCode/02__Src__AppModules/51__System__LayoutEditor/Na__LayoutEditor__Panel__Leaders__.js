// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - LEADERS PANEL
// =============================================================================
//
// FILE       : Na__LayoutEditor__Panel__Leaders__.js
// NAMESPACE  : Na__LePanelLeaders
// MODULE     : Layout Editor - Leaders Panel
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Type, text, line, fill, transparency and endpoint for the selected leader, or for the next one
// CREATED    : 14-Sep-2026
//
// DESCRIPTION:
// - With a leader selected the controls edit it; with nothing selected they
//   set what the Leader tool (E) places next, the way the Text, Dimensions and
//   Vectors panels work.
// - TYPE: a Note (multi-line text on a leader) or a Specification bubble (a
//   code in a circle). Switching a selected leader keeps its text; a bubble
//   shows the first line of it.
// - LINE: dashed or solid, its weight in points and its colour. The endpoint
//   and the bubble edge are drawn in the line colour too.
// - FILL sits behind the text and the line, so a leader laid over a drawing
//   masks what is beneath it; Fill opacity lets that show through again.
// - TRANSPARENT LINES is off unless asked for. Tick it and the line, the
//   endpoint and the bubble edge take the Line opacity slider; untick it and
//   they are solid again.
// - ENDPOINT is a small fold of its own: filled (a solid dot) or a ring at its
//   own weight, and its size.
// - The rows that have nothing to say go away: the bubble rows for a note,
//   the fill colour and opacity while there is no fill, the ring weight on a
//   filled endpoint.
// - Sliders redraw silently while they move and announce once on release, so
//   a whole drag is one undo step.
//
// INTEGRATION:
// - Registered in the right column by the mode controller.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (14-Sep-2026)
// - ValeVision    : 1.0.0 ported 14-Sep-2026 as ValeVision v2.32.0, verbatim
//                   below the header. Later versions wait for their own
//                   sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 14-Sep-2026 - Version 1.1.0
// - Project Specification: a selected bubble shows a Spec note row - the
//   project specification's notes by group, or Not linked - and a line saying
//   what its link is: linked, linked to a deleted note, reading a note's code
//   without being linked, or reading a code no note has. Open in specification
//   shows the linked note on the Project Specification tab. Nothing changes
//   for a note leader or for the settings for new leaders.
//
// 14-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Tools, Surface, Leader Tool and Panel Host
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel, Na__LeCfg__GetLeaderSetup, Na__LeCfg__GetLineweightSetup, Na__LeCfg__GetTextSetup } from './Na__LayoutEditor__ConfigState__.js';
    import { Na__LeSpec__OPEN_EVENT, Na__LeSpec__IsLoaded, Na__LeSpec__ListNotes } from './Na__LayoutEditor__SpecData__.js';
    import { Na__LeSpecLink__Describe, Na__LeSpecLink__NoteIdOf, Na__LeSpecLink__Link } from './Na__LayoutEditor__SpecLinks__.js';
    import { Na__LeModel__GetActiveSheet, Na__LeModel__GetSelection, Na__LeModel__GetLeaders, Na__LeModel__UpdateLeader } from './Na__LayoutEditor__SheetModel__.js';
    import { Na__LeTools__GetLeaderDefaults, Na__LeTools__SetLeaderDefaults } from './Na__LayoutEditor__SheetTools__.js';
    import { Na__LeSurface__Refresh } from './Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeLeader__BeginEdit } from './Na__LayoutEditor__LeaderTool__.js';
    import {
        Na__LePanels__RegisterSection,
        Na__LePanels__OnControl,
        Na__LePanels__Refresh,
        Na__LePanels__IsEditable,
        Na__LePanels__Row,
        Na__LePanels__Input,
        Na__LePanels__Select,
        Na__LePanels__Button,
        Na__LePanels__Note,
        Na__LePanels__SliderRow,
        Na__LePanels__ShowSlider
    } from './Na__LayoutEditor__PanelHost__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Section
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Section Id and the Endpoint Fold's Memory
    // ------------------------------------------------------------
    const Na__LePanelLeaders__ID       = 'leaders';
    const Na__LePanelLeaders__FOLD_KEY = 'na-layouteditor-panel:fold-leader-endpoint';   // <-- The panel host's prefix, so it sits with the other fold states
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Selected Leader, if Any
    // ------------------------------------------------------------
    function Na__LePanelLeaders__Selected() {
        const sheet = Na__LeModel__GetActiveSheet();
        const selection = Na__LeModel__GetSelection();
        if (!sheet || !selection || selection.kind !== 'leader') return null;
        const item = Na__LeModel__GetLeaders(sheet).find((l) => l.Leader__Id === selection.id) || null;
        return item ? { sheet : sheet, item : item } : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Values on Show: the Selected Leader's, or the Settings for New Ones
    // ------------------------------------------------------------
    // Both come back in the settings' own shape - the fill as a switch beside
    // its colour - so one refresh serves either.
    // ------------------------------------------------------------
    function Na__LePanelLeaders__Values() {
        const selected = Na__LePanelLeaders__Selected();
        const d = Na__LeTools__GetLeaderDefaults();
        if (!selected) return Object.assign({}, d);
        const it = selected.item;
        return {
            type : it.Leader__Type, textSizeMm : it.Leader__TextSizeMm, fontWeight : it.Leader__FontWeight, textColour : it.Leader__TextColour,
            lineStyle : it.Leader__LineStyle, linePt : it.Leader__LinePt, lineColour : it.Leader__LineColour, lineOpacity : it.Leader__LineOpacity,
            endpointFilled : it.Leader__EndpointFilled, endpointPt : it.Leader__EndpointPt, endpointSizeMm : it.Leader__EndpointSizeMm,
            bubbleSizeMm : it.Leader__BubbleSizeMm, bubbleEdgePt : it.Leader__BubbleEdgePt,
            filled : typeof it.Leader__FillColour === 'string', fillColour : it.Leader__FillColour || d.fillColour, fillOpacity : it.Leader__FillOpacity
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Remember and Recall Whether the Endpoint Fold Is Open
    // ------------------------------------------------------------
    function Na__LePanelLeaders__FoldOpen() {
        try { return window.localStorage.getItem(Na__LePanelLeaders__FOLD_KEY) === '1'; } catch (e) { return false; }
    }
    function Na__LePanelLeaders__RememberFold(open) {
        try { window.localStorage.setItem(Na__LePanelLeaders__FOLD_KEY, open ? '1' : '0'); } catch (e) { /* storage unavailable */ }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Endpoint Fold: a Quiet Toggle and the Rows It Opens
    // ------------------------------------------------------------
    // It wears the section Advanced fold's look, but opens only the endpoint's
    // own rows, which sit under it with a faint rule down their left.
    // ------------------------------------------------------------
    function Na__LePanelLeaders__BuildEndpointFold(body, lw) {
        const L      = Na__LeCfg__GetLabel;
        const button = document.createElement('button');
        button.type      = 'button';
        button.className = 'na-le-adv-toggle na-le-subfold-toggle';
        button.innerHTML = '<span class="na-le-adv-toggle__chevron" aria-hidden="true"></span><span class="na-le-adv-toggle__label"></span>';
        button.querySelector('.na-le-adv-toggle__label').textContent = L('LeaderEndpoint', 'Endpoint');

        const block = document.createElement('div');
        block.className = 'na-le-block na-le-subfold';
        block.setAttribute('data-na-block', 'endpoint');
        block.appendChild(Na__LePanels__Row(L('LeaderEndpointFilled', 'Filled'), Na__LePanels__Input('checkbox', 'leader-end-filled')));
        block.appendChild(Na__LePanels__Row(L('LeaderEndpointPt', 'Ring pt'), Na__LePanels__Input('number', 'leader-end-pt', { min : lw.minPt, max : lw.maxPt, step : lw.stepPt })));
        block.appendChild(Na__LePanels__Row(L('LeaderEndpointSize', 'Size mm'), Na__LePanels__Input('number', 'leader-end-size', { min : 0, max : 10, step : 0.1 })));

        const show = (open) => {
            block.hidden = !open;
            button.classList.toggle('is-open', open);
            button.setAttribute('aria-expanded', String(open));
        };
        show(Na__LePanelLeaders__FoldOpen());
        button.addEventListener('click', () => {
            const open = block.hidden;
            show(open);
            Na__LePanelLeaders__RememberFold(open);
        });
        body.appendChild(button);
        body.appendChild(block);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Controls
    // ------------------------------------------------------------
    function Na__LePanelLeaders__Build(body) {
        const L     = Na__LeCfg__GetLabel;
        const setup = Na__LeCfg__GetLeaderSetup();
        const lw    = Na__LeCfg__GetLineweightSetup();
        const note  = Na__LePanels__Note('');
        note.setAttribute('data-na-block', 'note');
        body.appendChild(note);

        body.appendChild(Na__LePanels__Row(L('LeaderType', 'Type'), Na__LePanels__Select('leader-type', [
            { value : 'bubble', label : L('LeaderTypeBubble', 'Specification bubble') },
            { value : 'text',   label : L('LeaderTypeText', 'Note') }
        ])));

        // SPECIFICATION | A selected bubble's link to a project specification note
        const specSelect = document.createElement('select');
        specSelect.className = 'na-le-select';
        specSelect.setAttribute('data-na-control', 'leader-spec-note');
        const specRow = Na__LePanels__Row(L('LeaderSpecNote', 'Spec note'), specSelect);
        specRow.setAttribute('data-na-block', 'spec');
        specRow.title = L('LeaderSpecNoteTitle', 'The project specification note this bubble shows the code of. A linked bubble is renumbered with its note and listed in the sheet’s notes margin.');
        body.appendChild(specRow);
        const specStatus = Na__LePanels__Note('');
        specStatus.setAttribute('data-na-block', 'spec-status');
        body.appendChild(specStatus);

        body.appendChild(Na__LePanels__Row(L('LeaderTextSize', 'Text mm'), Na__LePanels__Input('number', 'leader-text-size', { min : setup.minTextSizeMm, max : setup.maxTextSizeMm, step : setup.textSizeStepMm })));
        body.appendChild(Na__LePanels__Row(L('LeaderWeight', 'Weight'), Na__LePanels__Select('leader-weight',
            Na__LeCfg__GetTextSetup().allowedWeights.map((w) => ({ value : w, label : w === 300 ? 'Light' : (w >= 600 ? 'Semi-bold' : 'Regular') })))));
        body.appendChild(Na__LePanels__Row(L('LeaderTextColour', 'Text colour'), Na__LePanels__Input('color', 'leader-text-colour')));

        body.appendChild(Na__LePanels__Row(L('LeaderLineStyle', 'Line'), Na__LePanels__Select('leader-line-style', [
            { value : 'dashed', label : L('LeaderLineDashed', 'Dashed') },
            { value : 'solid',  label : L('LeaderLineSolid', 'Solid') }
        ])));
        body.appendChild(Na__LePanels__Row(L('LeaderLinePt', 'Line pt'), Na__LePanels__Input('number', 'leader-line-pt', { min : lw.minPt, max : lw.maxPt, step : lw.stepPt })));
        body.appendChild(Na__LePanels__Row(L('LeaderLineColour', 'Line colour'), Na__LePanels__Input('color', 'leader-line-colour')));

        // BUBBLE | Its diameter and its edge; a code too wide for the diameter grows the circle
        const bubbleSize = Na__LePanels__Row(L('LeaderBubbleSize', 'Bubble mm'), Na__LePanels__Input('number', 'leader-bubble-size', { min : 2, max : 40, step : 0.5 }));
        const bubbleEdge = Na__LePanels__Row(L('LeaderBubbleEdgePt', 'Edge pt'), Na__LePanels__Input('number', 'leader-bubble-pt', { min : 0, max : lw.maxPt, step : lw.stepPt }));
        bubbleSize.title = L('LeaderBubbleSizeTitle', 'The bubble diameter. A code too wide for it grows the bubble to fit.');
        bubbleEdge.title = L('LeaderBubbleEdgeTitle', 'The bubble outline weight. 0 leaves the fill on its own.');
        body.appendChild(bubbleSize);
        body.appendChild(bubbleEdge);

        // FILL | Behind the text and the line
        const fill = Na__LePanels__Row(L('LeaderFill', 'Fill'), Na__LePanels__Input('checkbox', 'leader-filled'));
        fill.title = L('LeaderFillTitle', 'A fill behind the text and the line, so the leader masks the drawing beneath it.');
        body.appendChild(fill);
        body.appendChild(Na__LePanels__Row(L('LeaderFillColour', 'Fill colour'), Na__LePanels__Input('color', 'leader-fill-colour')));
        body.appendChild(Na__LePanels__SliderRow(L('LeaderFillOpacity', 'Fill opacity'), 'leader-fill-opacity'));

        // TRANSPARENT LINES | Off unless asked for
        const clear = Na__LePanels__Row(L('LeaderTransparentLines', 'Transparent lines'), Na__LePanels__Input('checkbox', 'leader-line-transparent'), 'na-le-row--toggle');
        clear.title = L('LeaderTransparentLinesTitle', 'Let the line, the endpoint and the bubble edge show what is beneath them.');
        body.appendChild(clear);
        body.appendChild(Na__LePanels__SliderRow(L('LeaderLineOpacity', 'Line opacity'), 'leader-line-opacity'));

        Na__LePanelLeaders__BuildEndpointFold(body, lw);

        if (Na__LePanels__IsEditable()) {
            const bar = document.createElement('div');
            bar.className = 'na-le-bar';
            bar.setAttribute('data-na-block', 'edit');
            bar.appendChild(Na__LePanels__Button(L('EditLeaderText', 'Edit text'), 'leader-edit', ''));
            const openSpec = Na__LePanels__Button(L('LeaderSpecOpen', 'Open in specification'), 'leader-spec-open', '');
            openSpec.setAttribute('data-na-block', 'spec-open');
            bar.appendChild(openSpec);
            body.appendChild(bar);
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect the Selection or the Defaults
    // ------------------------------------------------------------
    function Na__LePanelLeaders__Refresh(body) {
        const L        = Na__LeCfg__GetLabel;
        const selected = Na__LePanelLeaders__Selected();
        const v        = Na__LePanelLeaders__Values();
        const el       = (name) => body.querySelector('[data-na-control="' + name + '"]');
        const set      = (name, value) => { const e = el(name); if (e && document.activeElement !== e) e.value = String(value); };
        const hex      = (value, fallback) => (/^#[0-9a-fA-F]{6}$/.test(String(value)) ? value : fallback);
        const percent  = (value) => Math.round((Number.isFinite(value) ? value : 1) * 100);
        const bubble   = v.type === 'bubble';
        const filled   = v.filled === true;
        const clear    = Number.isFinite(v.lineOpacity) && v.lineOpacity < 1;

        set('leader-type', bubble ? 'bubble' : 'text');
        set('leader-text-size', v.textSizeMm);
        set('leader-weight', v.fontWeight);
        set('leader-text-colour', hex(v.textColour, '#172b3a'));
        set('leader-line-style', v.lineStyle === 'solid' ? 'solid' : 'dashed');
        set('leader-line-pt', v.linePt);
        set('leader-line-colour', hex(v.lineColour, '#172b3a'));
        set('leader-bubble-size', v.bubbleSizeMm);
        set('leader-bubble-pt', v.bubbleEdgePt);
        set('leader-fill-colour', hex(v.fillColour, '#f2f4f5'));
        set('leader-end-pt', v.endpointPt);
        set('leader-end-size', v.endpointSizeMm);
        el('leader-filled').checked           = filled;
        el('leader-line-transparent').checked = clear;
        el('leader-end-filled').checked       = v.endpointFilled === true;
        Na__LePanels__ShowSlider(body, 'leader-fill-opacity', percent(v.fillOpacity), percent(v.fillOpacity) + '%');
        Na__LePanels__ShowSlider(body, 'leader-line-opacity', percent(v.lineOpacity), percent(v.lineOpacity) + '%');

        el('leader-bubble-size').parentNode.hidden  = !bubble;
        el('leader-bubble-pt').parentNode.hidden    = !bubble;
        el('leader-fill-colour').parentNode.hidden  = !filled;
        el('leader-fill-opacity').parentNode.hidden = !filled;
        el('leader-line-opacity').parentNode.hidden = !clear;
        el('leader-end-pt').parentNode.hidden       = v.endpointFilled === true;   // <-- A solid dot has no ring to weigh

        body.querySelector('[data-na-block="note"]').textContent = selected
            ? L('LeaderSelectedNote', 'Editing the selected leader.')
            : L('LeaderDefaultsNote', 'Nothing selected: these settings apply to new leaders (E).');
        const edit = body.querySelector('[data-na-block="edit"]');
        if (edit) edit.hidden = !selected;

        // SPECIFICATION | Only a selected bubble has a link to show
        const showSpec = !!selected && bubble;
        body.querySelector('[data-na-block="spec"]').hidden        = !showSpec;
        body.querySelector('[data-na-block="spec-status"]').hidden = !showSpec;
        const openSpec = body.querySelector('[data-na-block="spec-open"]');
        if (openSpec) openSpec.hidden = !(showSpec && Na__LeSpecLink__NoteIdOf(selected.item));
        if (showSpec) Na__LePanelLeaders__RefreshSpec(body, selected.item);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect a Selected Bubble's Specification Link
    // ------------------------------------------------------------
    // The notes are listed by group, code first. The list is only rebuilt when
    // the specification's notes change, so a refresh never snaps an open list
    // shut. A link to a deleted note stays chosen, under its own option, so
    // the choice on show is always the truth about the record.
    // ------------------------------------------------------------
    function Na__LePanelLeaders__RefreshSpec(body, leader) {
        const L      = Na__LeCfg__GetLabel;
        const select = body.querySelector('[data-na-control="leader-spec-note"]');
        const status = body.querySelector('[data-na-block="spec-status"]');
        const info   = Na__LeSpecLink__Describe(leader);
        const loaded = Na__LeSpec__IsLoaded();
        const linked = Na__LeSpecLink__NoteIdOf(leader);
        const option = (value, text) => { const o = document.createElement('option'); o.value = value; o.textContent = text; return o; };

        const signature = !loaded ? 'pending' : JSON.stringify([ Na__LeSpec__ListNotes().map((e) => [ e.note.Note__Id, e.code, e.note.Note__Title ]), info.state === 'broken' ? linked : '' ]);
        if (select.getAttribute('data-na-signature') !== signature) {
            select.innerHTML = '';
            select.appendChild(option('', loaded ? L('LeaderSpecNone', 'Not linked') : L('LeaderSpecLoading', 'Loading specification...')));
            let group = null, holder = null;
            if (loaded) Na__LeSpec__ListNotes().forEach((entry) => {
                if (entry.group !== group) {
                    group  = entry.group;
                    holder = document.createElement('optgroup');
                    holder.label = entry.group.Group__Prefix + (entry.group.Group__Title ? ' - ' + entry.group.Group__Title : '');
                    select.appendChild(holder);
                }
                holder.appendChild(option(entry.note.Note__Id, entry.code + '   ' + (entry.note.Note__Title || L('SpecUntitledNote', 'Untitled note'))));
            });
            if (info.state === 'broken') select.appendChild(option(linked, Na__LeCfg__FormatLabel('LeaderSpecDeletedOption', 'A deleted note (last shown as {code})', { code : info.shown })));
            select.setAttribute('data-na-signature', signature);
        }
        if (document.activeElement !== select) select.value = linked || '';
        select.disabled = !Na__LePanels__IsEditable() || !loaded;

        const title = info.entry ? (info.entry.note.Note__Title || L('SpecUntitledNote', 'Untitled note')) : '';
        const lines = {
            linked   : Na__LeCfg__FormatLabel('LeaderSpecLinked', 'Linked to {code}, {title}. The code follows the note if it is renumbered.', { code : info.code, title : title }),
            broken   : Na__LeCfg__FormatLabel('LeaderSpecBroken', 'Its specification note was deleted. The bubble keeps its last code, {code}.', { code : info.shown }),
            matches  : Na__LeCfg__FormatLabel('LeaderSpecMatches', 'Reads {code}, a specification note, but is not linked to it. Choose it above to link.', { code : info.code }),
            unknown  : Na__LeCfg__FormatLabel('LeaderSpecUnknown', 'No specification note has the code {code}.', { code : info.shown }),
            unlinked : L('LeaderSpecUnlinked', 'Not linked to the project specification. Type a note’s code into the bubble, or choose a note above.'),
            pending  : L('LeaderSpecPending', 'Loading the project specification...')
        };
        status.textContent = lines[info.state] || '';
        status.classList.toggle('na-le-note--warn', info.state === 'broken' || info.state === 'unknown');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Apply a Change to the Selection or the Defaults
    // ------------------------------------------------------------
    function Na__LePanelLeaders__Apply(patch, defaultsPatch) {
        const selected = Na__LePanelLeaders__Selected();
        if (selected) { Na__LeModel__UpdateLeader(selected.sheet, selected.item.Leader__Id, patch); return; }   // <-- The model announces, and the panel refreshes with it
        if (!defaultsPatch) return;
        Na__LeTools__SetLeaderDefaults(defaultsPatch);
        Na__LePanels__Refresh(Na__LePanelLeaders__ID);                        // <-- Nothing announces a defaults change, so show it here
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Apply a Change Silently While a Slider Is Moving
    // ------------------------------------------------------------
    // The reading beside the slider follows at once; the leader redraws with
    // no announcement, so the release - which goes through Apply - is the one
    // undo step for the whole drag.
    // ------------------------------------------------------------
    function Na__LePanelLeaders__ApplyLive(slider, patch) {
        const reading = slider.parentNode ? slider.parentNode.querySelector('[data-na-reading]') : null;
        if (reading) reading.textContent = Math.round(parseFloat(slider.value)) + '%';
        const selected = Na__LePanelLeaders__Selected();
        if (selected) { Na__LeModel__UpdateLeader(selected.sheet, selected.item.Leader__Id, patch, true); Na__LeSurface__Refresh('markup'); return; }
        Na__LeTools__SetLeaderDefaults(patch);                                // <-- The settings share the record's patch keys for everything a slider sets
    }
    // ------------------------------------------------------------


    // FUNCTION | Register the Section and Its Controls
    // ------------------------------------------------------------
    function Na__LePanelLeaders__Register() {
        const on   = Na__LePanels__OnControl;
        const both = (key, value) => { const patch = {}; patch[key] = value; Na__LePanelLeaders__Apply(patch, Object.assign({}, patch)); };
        const num  = (key) => (e, el) => { const value = parseFloat(el.value); if (Number.isFinite(value)) both(key, value); };

        on('change', 'leader-type',        (e, el) => both('type', el.value));
        on('change', 'leader-text-size',   num('textSizeMm'));
        on('change', 'leader-weight',      (e, el) => { const value = parseInt(el.value, 10); if (Number.isFinite(value)) both('fontWeight', value); });
        on('change', 'leader-text-colour', (e, el) => both('textColour', el.value));
        on('change', 'leader-line-style',  (e, el) => both('lineStyle', el.value));
        on('change', 'leader-line-pt',     num('linePt'));
        on('change', 'leader-line-colour', (e, el) => both('lineColour', el.value));
        on('change', 'leader-bubble-size', num('bubbleSizeMm'));
        on('change', 'leader-bubble-pt',   num('bubbleEdgePt'));
        on('change', 'leader-end-filled',  (e, el) => both('endpointFilled', el.checked));
        on('change', 'leader-end-pt',      num('endpointPt'));
        on('change', 'leader-end-size',    num('endpointSizeMm'));

        // FILL | The record keeps a colour or null; the settings a switch beside the last colour
        on('change', 'leader-filled', (e, el) => {
            const colour = Na__LePanelLeaders__Values().fillColour;
            Na__LePanelLeaders__Apply({ fillColour : el.checked ? colour : null }, { filled : el.checked, fillColour : colour });
        });
        on('change', 'leader-fill-colour', (e, el) => Na__LePanelLeaders__Apply({ fillColour : el.value }, { fillColour : el.value }));

        // TRANSPARENT LINES | Ticking starts the lines at the configured see-through; unticking makes them solid
        on('change', 'leader-line-transparent', (e, el) => both('lineOpacity', el.checked ? Na__LeCfg__GetLeaderSetup().transparentOpacity : 1));

        // SLIDERS | Live on input, one announcement on release
        [ [ 'leader-fill-opacity', 'fillOpacity' ], [ 'leader-line-opacity', 'lineOpacity' ] ].forEach((pair) => {
            on('input', pair[0], (e, el) => {
                const value = parseFloat(el.value) / 100;
                if (Number.isFinite(value)) { const patch = {}; patch[pair[1]] = value; Na__LePanelLeaders__ApplyLive(el, patch); }
            });
            on('change', pair[0], (e, el) => {
                const value = parseFloat(el.value) / 100;
                if (Number.isFinite(value)) both(pair[1], value);
            });
        });

        // SPECIFICATION | Choose a note to link the bubble to it (it takes the code), or Not linked
        on('change', 'leader-spec-note', (e, el) => { const s = Na__LePanelLeaders__Selected(); if (s) Na__LeSpecLink__Link(s.sheet, s.item.Leader__Id, el.value || null); });
        on('click', 'leader-spec-open', () => {
            const s = Na__LePanelLeaders__Selected();
            if (s) window.dispatchEvent(new CustomEvent(Na__LeSpec__OPEN_EVENT, { detail : { noteId : Na__LeSpecLink__NoteIdOf(s.item) } }));
        });

        on('click', 'leader-edit', () => { const s = Na__LePanelLeaders__Selected(); if (s) Na__LeLeader__BeginEdit(s.item.Leader__Id); });
        return Na__LePanels__RegisterSection('right', {
            id : Na__LePanelLeaders__ID, title : Na__LeCfg__GetLabel('LeadersTitle', 'Leaders'),
            build : Na__LePanelLeaders__Build, refresh : Na__LePanelLeaders__Refresh
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Leaders Panel API
    // ------------------------------------------------------------
    export {
        Na__LePanelLeaders__Register
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
