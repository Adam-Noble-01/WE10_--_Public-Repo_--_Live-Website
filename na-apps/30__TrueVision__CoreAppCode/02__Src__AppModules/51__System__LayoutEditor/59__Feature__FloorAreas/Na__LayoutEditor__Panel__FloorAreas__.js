// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PANEL: FLOOR AREAS
// =============================================================================
//
// FILE       : Na__LayoutEditor__Panel__FloorAreas__.js
// NAMESPACE  : Na__LePanelArea
// MODULE     : Layout Editor - Panel Floor Areas
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The Floor Areas panel - draw a room, name it, colour it, file it under a group, and read the whole sheet's index with its totals
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - Below Patterns in the right column, as Adam asked. Unfolded it holds, in
//   the order a room is actually measured: the layer's own switch, the two
//   ways of drawing one, the selected room's settings, and THE INDEX - every
//   room on the sheet under its group with a subtotal, the ungrouped last,
//   and the sheet's total at the foot.
// - THE INDEX IS THE FEATURE. Naming rooms is only worth doing if the numbers
//   can be read together, so the list is not a list of shapes: it is grouped,
//   totalled, clickable through to the room on the paper, and it is where
//   groups are made, renamed, recoloured, reordered and deleted.
// - NOTHING HERE WRITES A STYLE THROUGH THE PANEL HOST'S MULTI-SELECTION
//   PATH. That path filters a patch through the eyedropper's trait table -
//   a table about copying LOOKS - and a name or a group would be dropped by
//   it without a word. Several rooms are written one at a time, silently,
//   with one announcement at the end, which is also one undo step.
//
// INTEGRATION:
// - Registered by Na__LayoutEditor__ModeController__ straight after the
//   Patterns panel, so it sits last in the right column's Properties tab.
// // @delegate: ./Na__LayoutEditor__FloorAreas__.js
// // @delegate: ./Na__LayoutEditor__FloorAreas__Tool__.js
// // @delegate: ./Na__LayoutEditor__FloorAreas__Table__.js
// // @delegate: ./Na__LayoutEditor__FloorAreas__LabelGrip__.js
// - Registration also attaches the label grip (Na__LeAreaGrip__Attach): the
//   panel's registration is the one place the feature boots once, and the
//   grip's styles live in the stylesheet it links.
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
// 21-Sep-2026 - Version 1.2.0
// - Register attaches the label grip, so an open room's label can be dragged
//   (Na__LayoutEditor__FloorAreas__LabelGrip__). Centre the label, already
//   here, is how it goes back.
//
// 21-Sep-2026 - Version 1.1.0
// - Outline: a switch for the line round a room, in the selected block, the
//   several-rooms block (half-set shows as indeterminate; a click sets them
//   all) and the New areas block. It writes the vector's own Shape__Stroked
//   through PaintSelected, one undo step, so the Vectors panel's Edges box and
//   this one are the same setting seen from two places.
//
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Panel Host, Model, Tools and the Floor Area System
    // ------------------------------------------------------------
    import {
        Na__LePanels__RegisterSection,
        Na__LePanels__OnControl,
        Na__LePanels__Refresh,
        Na__LePanels__IsEditable,
        Na__LePanels__Row,
        Na__LePanels__Input,
        Na__LePanels__Select,
        Na__LePanels__FillSelect,
        Na__LePanels__Button,
        Na__LePanels__Note,
        Na__LePanels__SliderRow,
        Na__LePanels__ShowSlider,
        Na__LePanels__GetContext
    } from '../40__Ui__Panels/Na__LayoutEditor__PanelHost__.js';
    import {
        Na__LeModel__CHANGED_EVENT,
        Na__LeModel__GetActiveSheet,
        Na__LeModel__GetSelection,
        Na__LeModel__GetSelectionItems,
        Na__LeModel__SetSelection,
        Na__LeModel__GetShapeById,
        Na__LeModel__UpdateShape,
        Na__LeModel__GetAreaGroups,
        Na__LeModel__AddAreaGroup,
        Na__LeModel__RenameAreaGroup,
        Na__LeModel__SetAreaGroupColour,
        Na__LeModel__MoveAreaGroup,
        Na__LeModel__DeleteAreaGroup,
        Na__LeModel__AnnounceAreas,
        Na__LeModel__AreaGroupKey
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeCfg__GetScaleSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeDrawScale__Label } from '../07__Core__SheetData/Na__LayoutEditor__DrawingScale__.js';
    import { Na__LeTools__TOOL_AREA, Na__LeTools__CHANGED_EVENT, Na__LeTools__GetTool, Na__LeTools__SetTool } from '../30__System__SheetTools/Na__LayoutEditor__SheetTools__.js';
    import { Na__LeSurface__Refresh } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeAreaGeo__Encloses } from './Na__LayoutEditor__FloorAreas__Geometry__.js';
    import {
        Na__LeArea__LABEL_BOTH,
        Na__LeArea__LABEL_NAME,
        Na__LeArea__LABEL_VALUE,
        Na__LeArea__LABEL_NONE,
        Na__LeArea__SOURCE_FIXED,
        Na__LeArea__SOURCE_VIEWPORT,
        Na__LeArea__Ready,
        Na__LeArea__Value,
        Na__LeArea__Label,
        Na__LeArea__Is,
        Na__LeArea__NameOf,
        Na__LeArea__GroupOf,
        Na__LeArea__LabelModeOf,
        Na__LeArea__TextSizeOf,
        Na__LeArea__LabelOffsetOf,
        Na__LeArea__Measure,
        Na__LeArea__Index,
        Na__LeArea__IsShown,
        Na__LeArea__IsLocked,
        Na__LeArea__SetShown,
        Na__LeArea__SetLocked,
        Na__LeArea__IsShapeLocked,
        Na__LeArea__NewSettings,
        Na__LeArea__SetNewSettings,
        Na__LeArea__NextGroupColour,
        Na__LeArea__FormatArea,
        Na__LeArea__FormatLength,
        Na__LeArea__ViewportName,
        Na__LeArea__Patch,
        Na__LeArea__PatchMany,
        Na__LeArea__SetGroup,
        Na__LeArea__PaintGroup,
        Na__LeArea__Make,
        Na__LeArea__Unmake
    } from './Na__LayoutEditor__FloorAreas__.js';
    import { Na__LeAreaTool__PLACED_EVENT, Na__LeAreaTool__IsRectangle, Na__LeAreaTool__SetRectangle } from './Na__LayoutEditor__FloorAreas__Tool__.js';
    import { Na__LeAreaTable__FORM_AREAS, Na__LeAreaTable__FORM_GROUPS, Na__LeAreaTable__Insert } from './Na__LayoutEditor__FloorAreas__Table__.js';
    import { Na__LeAreaGrip__Attach } from './Na__LayoutEditor__FloorAreas__LabelGrip__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Identity and the Value the Group Lists Use for "make a new one"
    // ------------------------------------------------------------
    const Na__LePanelArea__ID       = 'floor-areas';
    const Na__LePanelArea__NEW      = '@new';                                    // <-- Never a group name: a name is trimmed, so it can never begin with @
    const Na__LePanelArea__NONE     = '';
    const Na__LePanelArea__RENAME_EVENT = 'na-layouteditor-area-rename';         // <-- The context menu asking for the cursor to be put in the name box
    // ------------------------------------------------------------

    // MODULE VARIABLES | Wiring
    // ------------------------------------------------------------
    let Na__LePanelArea__Listening = false;
    let Na__LePanelArea__FocusName = false;    // <-- A room has just landed, or a rename was asked for: put the cursor in the name box on the next refresh
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading the Selection
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Rooms and the Plain Shapes That Are Selected
    // ------------------------------------------------------------
    // { sheet, areas : [record], shape : the one selected shape or null }.
    // Groups are NOT opened up: a room inside a group is moved with the group,
    // and editing one from in here would be editing something the selection
    // does not show.
    // ------------------------------------------------------------
    function Na__LePanelArea__Selected() {
        const sheet = Na__LeModel__GetActiveSheet();
        if (!sheet) return { sheet : null, areas : [], shape : null };
        const shapes = Na__LeModel__GetSelectionItems()
            .filter((item) => item.kind === 'shape')
            .map((item) => Na__LeModel__GetShapeById(sheet, item.id))
            .filter(Boolean);
        const one = Na__LeModel__GetSelection();
        return {
            sheet : sheet,
            areas : shapes.filter(Na__LeArea__Is),
            shape : (one && one.kind === 'shape') ? Na__LeModel__GetShapeById(sheet, one.id) : null
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Say Something in the Editor's Toast
    // ------------------------------------------------------------
    function Na__LePanelArea__Toast(message) {
        const context = Na__LePanels__GetContext();
        if (context && typeof context.showToast === 'function') context.showToast(message, false);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Building the Panel
// -----------------------------------------------------------------------------

    // FUNCTION | Build the Panel Body
    // ------------------------------------------------------------
    function Na__LePanelArea__Build(body) {
        const L = Na__LeArea__Label;

        body.appendChild(Na__LePanelArea__Part(Na__LePanels__Note(L('PanelIntro', 'Draw round a room to measure it.')), 'intro'));

        // THE LAYER | One switch for the whole overlay, which is how it is
        // meant to be worked: drawn once, hidden, brought back to move a corner
        const show = Na__LePanels__Input('checkbox', 'area-show');
        body.appendChild(Na__LePanels__Row(L('ShowLayer', 'Show on the sheet'), show, 'na-le-row--toggle'));
        const lock = Na__LePanels__Input('checkbox', 'area-lock');
        body.appendChild(Na__LePanels__Row(L('LockLayer', 'Lock'), lock, 'na-le-row--toggle'));

        const draw = document.createElement('div');
        draw.className = 'na-le-bar';
        draw.appendChild(Na__LePanels__Button(L('DrawButton', 'Draw an area'), 'area-draw', 'na-le-btn--primary'));
        draw.appendChild(Na__LePanels__Button(L('DrawRectButton', 'Rectangle'), 'area-mode', 'na-le-btn--toggle'));
        body.appendChild(draw);
        body.appendChild(Na__LePanelArea__Part(Na__LePanels__Note(L('DrawingNote', '')), 'draw-note'));

        const make = document.createElement('div');
        make.className = 'na-le-bar';
        make.appendChild(Na__LePanels__Button(L('MakeAreaButton', 'Measure this shape'), 'area-make', ''));
        body.appendChild(Na__LePanelArea__Part(make, 'make'));

        // THE SELECTED ROOM | Everything about one room, in the order it is asked
        const one = document.createElement('div');
        one.setAttribute('data-na-area', 'one');
        one.appendChild(Na__LePanels__Note(L('SelectedHeading', 'The selected area')));
        one.lastChild.classList.add('na-le-note--heading');
        one.appendChild(Na__LePanels__Row(L('Name', 'Name'), Na__LePanels__Input('text', 'area-name', { maxlength : 120, placeholder : L('NamePlaceholder', 'Kitchen') })));
        one.appendChild(Na__LePanels__Row(L('Group', 'Group'), Na__LePanels__Select('area-group', [], '')));
        one.appendChild(Na__LePanels__Row(L('Colour', 'Colour'), Na__LePanels__Input('color', 'area-colour')));
        one.appendChild(Na__LePanels__SliderRow(L('Opacity', 'Opacity'), 'area-opacity'));
        one.appendChild(Na__LePanelArea__OutlineRow('area-stroked'));
        one.appendChild(Na__LePanels__Row(L('LabelShows', 'Label shows'), Na__LePanels__Select('area-label', [], '')));
        one.appendChild(Na__LePanels__Row(L('TextSize', 'Label size (mm)'), Na__LePanels__Input('number', 'area-text-size', { min : 0.8, max : 20, step : 0.1 })));
        one.appendChild(Na__LePanels__Row(L('Scale', 'Measured at'), Na__LePanels__Select('area-scale', [], '')));
        const reads = Na__LePanels__Note('');
        reads.classList.add('na-le-area__reads');
        reads.setAttribute('data-na-area', 'reads');
        one.appendChild(reads);
        const warn = Na__LePanels__Note('');
        warn.setAttribute('data-na-area', 'warn');
        one.appendChild(warn);
        const tidy = document.createElement('div');
        tidy.className = 'na-le-bar';
        tidy.appendChild(Na__LePanels__Button(L('ResetLabel', 'Centre the label'), 'area-centre', ''));
        tidy.appendChild(Na__LePanels__Button(L('ConvertToVector', 'Make it a plain vector'), 'area-unmake', ''));
        one.appendChild(tidy);
        body.appendChild(one);

        // SEVERAL ROOMS | What can honestly be done to all of them at once
        const many = document.createElement('div');
        many.setAttribute('data-na-area', 'many');
        const manyNote = Na__LePanels__Note('');
        manyNote.setAttribute('data-na-area', 'many-note');
        manyNote.classList.add('na-le-note--heading');
        many.appendChild(manyNote);
        many.appendChild(Na__LePanels__Row(L('Group', 'Group'), Na__LePanels__Select('area-group-many', [], '')));
        many.appendChild(Na__LePanels__Row(L('Colour', 'Colour'), Na__LePanels__Input('color', 'area-colour-many')));
        many.appendChild(Na__LePanelArea__OutlineRow('area-stroked-many'));
        body.appendChild(many);

        // NEW AREAS | The settings the next room drawn takes
        const fresh = document.createElement('div');
        fresh.setAttribute('data-na-area', 'new');
        fresh.appendChild(Na__LePanels__Note(L('DefaultsHeading', 'New areas')));
        fresh.lastChild.classList.add('na-le-note--heading');
        fresh.appendChild(Na__LePanels__Row(L('Group', 'Group'), Na__LePanels__Select('area-new-group', [], '')));
        fresh.appendChild(Na__LePanels__Row(L('Colour', 'Colour'), Na__LePanels__Input('color', 'area-new-colour')));
        fresh.appendChild(Na__LePanels__SliderRow(L('Opacity', 'Opacity'), 'area-new-opacity'));
        fresh.appendChild(Na__LePanelArea__OutlineRow('area-new-stroked'));
        fresh.appendChild(Na__LePanels__Row(L('LabelShows', 'Label shows'), Na__LePanels__Select('area-new-label', [], '')));
        fresh.appendChild(Na__LePanels__Note(L('DefaultsNote', '')));
        body.appendChild(fresh);

        // THE INDEX | Every room on the sheet, under its group, with the totals
        const index = document.createElement('div');
        index.className = 'na-le-area-index';
        index.setAttribute('data-na-area', 'index');
        body.appendChild(Na__LePanelArea__Part(Na__LePanels__Note(L('IndexHeading', 'Area index')), 'index-heading'));
        body.lastChild.classList.add('na-le-note--heading');
        body.appendChild(index);

        const groups = document.createElement('div');
        groups.className = 'na-le-bar';
        groups.appendChild(Na__LePanels__Button(L('AddGroup', 'New group'), 'area-add-group', ''));
        body.appendChild(groups);

        // THE SCHEDULES | The same two tiles the Parametric Scrapbook offers,
        // put where somebody who has just measured a floor is looking
        body.appendChild(Na__LePanelArea__Part(Na__LePanels__Note(L('TablesHeading', 'Schedules')), 'tables-heading'));
        body.lastChild.classList.add('na-le-note--heading');
        body.appendChild(Na__LePanelArea__Part(Na__LePanels__Note(L('TablesNote', '')), 'tables-note'));
        const tables = document.createElement('div');
        tables.className = 'na-le-bar';
        tables.appendChild(Na__LePanels__Button(L('InsertSchedule', 'Insert area schedule'), 'area-insert-schedule', ''));
        tables.appendChild(Na__LePanels__Button(L('InsertSummary', 'Insert group summary'), 'area-insert-summary', ''));
        body.appendChild(tables);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Tag an Element So the Refresh Can Find It
    // ------------------------------------------------------------
    function Na__LePanelArea__Part(element, name) {
        element.setAttribute('data-na-area', name);
        return element;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Outline Switch
    // ------------------------------------------------------------
    // The line round a room, on or off - the vector's own edge, the Vectors
    // panel's Edges, put beside the colour and the opacity because a room with
    // its outline off is judged by its wash alone. Built three times: for the
    // room selected, for several, and for the next one drawn.
    // ------------------------------------------------------------
    function Na__LePanelArea__OutlineRow(control) {
        const row = Na__LePanels__Row(Na__LeArea__Label('Outline', 'Outline'), Na__LePanels__Input('checkbox', control));
        row.title = Na__LeArea__Label('OutlineTitle', 'The line round the room. Off shows the colour alone.');
        return row;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reflecting the Sheet
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Options Every Group List Offers
    // ------------------------------------------------------------
    function Na__LePanelArea__GroupOptions(sheet) {
        const L = Na__LeArea__Label;
        return [ { value : Na__LePanelArea__NONE, label : L('GroupNone', 'Ungrouped') } ]
            .concat(Na__LeModel__GetAreaGroups(sheet).map((group) => ({ value : group.AreaGroup__Name, label : group.AreaGroup__Name })))
            .concat([ { value : Na__LePanelArea__NEW, label : L('GroupNew', 'New group...') } ]);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Scales the "Measured at" List Offers
    // ------------------------------------------------------------
    // Automatic first, saying what the room is reading and where it read it;
    // then the app's scales and the site plan's.
    // ------------------------------------------------------------
    function Na__LePanelArea__ScaleOptions(measured) {
        const L     = Na__LeArea__Label;
        const setup = Na__LeCfg__GetScaleSetup();
        const auto  = measured.source === Na__LeArea__SOURCE_VIEWPORT
            ? L('ScaleAuto', 'The drawing under it ({scale})', { scale : Na__LeDrawScale__Label(measured.denominator) })
            : L('ScaleAutoSheet', 'The sheet\'s scale ({scale})', { scale : Na__LeDrawScale__Label(measured.denominator) });
        const shown = [];
        [].concat(setup.denominators || [], setup.sitePlanDenominators || []).forEach((value) => {
            if (typeof value === 'number' && value > 0 && shown.indexOf(value) === -1) shown.push(value);
        });
        if (measured.source === Na__LeArea__SOURCE_FIXED && shown.indexOf(measured.denominator) === -1) shown.push(measured.denominator);
        shown.sort((a, b) => a - b);
        return [ { value : '', label : auto } ].concat(shown.map((value) => ({ value : value, label : Na__LeDrawScale__Label(value) })));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Label Modes
    // ------------------------------------------------------------
    function Na__LePanelArea__LabelOptions() {
        const L = Na__LeArea__Label;
        return [
            { value : Na__LeArea__LABEL_BOTH,  label : L('LabelBoth', 'Name and area') },
            { value : Na__LeArea__LABEL_NAME,  label : L('LabelName', 'Name only') },
            { value : Na__LeArea__LABEL_VALUE, label : L('LabelValue', 'Area only') },
            { value : Na__LeArea__LABEL_NONE,  label : L('LabelNone', 'Nothing') }
        ];
    }
    // ------------------------------------------------------------


    // FUNCTION | Reflect the Sheet, the Selection and the Index
    // ------------------------------------------------------------
    // A CONTROL BEING TYPED INTO IS LEFT ALONE, as in every panel here - and
    // the index is left standing whole while one of its own boxes has the
    // focus, because rebuilding it would take the caret with it mid-rename.
    // ------------------------------------------------------------
    function Na__LePanelArea__Refresh(body) {
        const L        = Na__LeArea__Label;
        const picked   = Na__LePanelArea__Selected();
        const sheet    = picked.sheet;
        const editable = Na__LePanels__IsEditable();
        const el       = (name) => body.querySelector('[data-na-control="' + name + '"]');
        const part     = (name) => body.querySelector('[data-na-area="' + name + '"]');
        if (!sheet) return;

        const locked = Na__LeArea__IsLocked(sheet);
        const usable = editable && !locked;

        el('area-show').checked = Na__LeArea__IsShown(sheet);
        el('area-lock').checked = locked;
        el('area-show').disabled = !editable;
        el('area-lock').disabled = !editable;

        const drawing = Na__LeTools__GetTool() === Na__LeTools__TOOL_AREA;
        const drawBtn = el('area-draw');
        drawBtn.classList.toggle('na-le-btn--active', drawing);
        drawBtn.disabled = !usable;
        const modeBtn = el('area-mode');
        modeBtn.classList.toggle('na-le-btn--active', Na__LeAreaTool__IsRectangle());
        modeBtn.disabled = !usable;
        part('draw-note').textContent = drawing ? L('DrawingNote', '') : '';
        part('draw-note').hidden      = !drawing;

        // MEASURE THIS SHAPE | Only for a plain closed vector, which is the
        // one thing that can become a room without being drawn again
        const candidate = picked.shape && !Na__LeArea__Is(picked.shape) && Na__LeAreaGeo__Encloses(picked.shape.Shape__Points);
        part('make').hidden = !candidate || !usable;

        const one  = (picked.areas.length === 1 && picked.shape && Na__LeArea__Is(picked.shape)) ? picked.shape : null;
        const many = picked.areas.length > 1 ? picked.areas : null;
        part('one').hidden  = !one;
        part('many').hidden = !many;
        part('new').hidden  = !!one || !!many;

        if (one) Na__LePanelArea__ReflectOne(body, sheet, one, usable && !Na__LeArea__IsShapeLocked(sheet, one));
        if (many) {
            const total = many.reduce((sum, shape) => sum + Na__LeArea__Measure(sheet, shape).m2, 0);
            part('many-note').textContent = L('SelectedMany', '{count} areas selected - {area} in total.', { count : many.length, area : Na__LeArea__FormatArea(total) });
            Na__LePanels__FillSelect(el('area-group-many'), Na__LePanelArea__GroupOptions(sheet), '');
            el('area-group-many').disabled  = !usable;
            el('area-colour-many').disabled = !usable;
            const outlined = many.filter((shape) => shape.Shape__Stroked !== false).length;
            el('area-stroked-many').checked       = outlined === many.length;
            el('area-stroked-many').indeterminate = outlined > 0 && outlined < many.length;   // <-- Some with, some without: a click sets them all
            el('area-stroked-many').disabled      = !usable;
        }
        if (!one && !many) Na__LePanelArea__ReflectNew(body, sheet, usable);

        Na__LePanelArea__ReflectIndex(body, sheet, usable);
        [ 'area-add-group', 'area-insert-schedule', 'area-insert-summary' ].forEach((name) => { el(name).disabled = !editable; });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect the One Selected Room
    // ------------------------------------------------------------
    function Na__LePanelArea__ReflectOne(body, sheet, shape, usable) {
        const L        = Na__LeArea__Label;
        const el       = (name) => body.querySelector('[data-na-control="' + name + '"]');
        const part     = (name) => body.querySelector('[data-na-area="' + name + '"]');
        const measured = Na__LeArea__Measure(sheet, shape);

        const name = el('area-name');
        if (document.activeElement !== name) name.value = Na__LeArea__NameOf(shape);
        Na__LePanels__FillSelect(el('area-group'), Na__LePanelArea__GroupOptions(sheet), Na__LeArea__GroupOf(shape));
        el('area-colour').value = (typeof shape.Shape__FillColour === 'string') ? shape.Shape__FillColour : Na__LeArea__Value('Defaults', 'Defaults__FillColour', '#bcd9ee');
        const opacity = Math.round((Number.isFinite(shape.Shape__FillOpacity) ? shape.Shape__FillOpacity : 1) * 100);
        Na__LePanels__ShowSlider(body, 'area-opacity', opacity, opacity + '%');
        el('area-stroked').checked = shape.Shape__Stroked !== false;
        Na__LePanels__FillSelect(el('area-label'), Na__LePanelArea__LabelOptions(), Na__LeArea__LabelModeOf(shape));
        const size = el('area-text-size');
        if (document.activeElement !== size) size.value = String(Math.round(Na__LeArea__TextSizeOf(shape) * 10) / 10);
        Na__LePanels__FillSelect(el('area-scale'), Na__LePanelArea__ScaleOptions(measured), measured.source === Na__LeArea__SOURCE_FIXED ? measured.denominator : '');

        // WHAT IT MEASURES, IN WORDS. The one line somebody checks a drawing
        // against: how much floor, how far round it, at what scale, and off
        // which drawing that scale came.
        const scale = Na__LeDrawScale__Label(measured.denominator);
        part('reads').textContent = measured.source === Na__LeArea__SOURCE_VIEWPORT
            ? L('ReadsFrom', '{area}, {perimeter} round, at {scale} from {name}', { area : Na__LeArea__FormatArea(measured.m2), perimeter : Na__LeArea__FormatLength(measured.perimeterM), scale : scale, name : Na__LeArea__ViewportName(measured.viewport) })
            : L('Reads', '{area}, {perimeter} round, at {scale}', { area : Na__LeArea__FormatArea(measured.m2), perimeter : Na__LeArea__FormatLength(measured.perimeterM), scale : scale });
        part('warn').textContent = measured.crossing ? L('Crossed', 'This outline crosses itself, so it has no area.') : '';
        part('warn').hidden      = !measured.crossing;

        const offset = Na__LeArea__LabelOffsetOf(shape);
        el('area-centre').disabled = !usable || Math.hypot(offset.dx, offset.dy) < 1e-6;
        el('area-unmake').disabled = !usable;
        [ 'area-name', 'area-group', 'area-colour', 'area-opacity', 'area-stroked', 'area-label', 'area-text-size', 'area-scale' ].forEach((control) => { el(control).disabled = !usable; });

        // A ROOM THAT HAS JUST LANDED gets the cursor, so its real name can
        // simply be typed. Only once, and never while something else has it.
        if (Na__LePanelArea__FocusName && usable) {
            Na__LePanelArea__FocusName = false;
            try { name.focus(); name.select(); } catch (error) { /* a field that cannot take focus is not worth an error */ }
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect the Settings for New Rooms
    // ------------------------------------------------------------
    function Na__LePanelArea__ReflectNew(body, sheet, usable) {
        const el       = (name) => body.querySelector('[data-na-control="' + name + '"]');
        const settings = Na__LeArea__NewSettings();
        Na__LePanels__FillSelect(el('area-new-group'), Na__LePanelArea__GroupOptions(sheet), settings.group);
        el('area-new-colour').value = settings.fillColour;
        const opacity = Math.round(settings.fillOpacity * 100);
        Na__LePanels__ShowSlider(body, 'area-new-opacity', opacity, opacity + '%');
        el('area-new-stroked').checked = settings.stroked !== false;
        Na__LePanels__FillSelect(el('area-new-label'), Na__LePanelArea__LabelOptions(), settings.label);
        [ 'area-new-group', 'area-new-colour', 'area-new-opacity', 'area-new-stroked', 'area-new-label' ].forEach((control) => { el(control).disabled = !usable; });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Draw the Index: Every Room, Under Its Group, With the Totals
    // ------------------------------------------------------------
    // Rebuilt whole on every refresh, EXCEPT while one of its own boxes has
    // the focus - a group being renamed or recoloured would otherwise lose the
    // caret to its own change event.
    // ------------------------------------------------------------
    function Na__LePanelArea__ReflectIndex(body, sheet, usable) {
        const L    = Na__LeArea__Label;
        const host = body.querySelector('[data-na-area="index"]');
        if (!host) return;
        if (document.activeElement && host.contains(document.activeElement)) return;   // <-- Mid-rename: leave the list exactly as it is

        const index = Na__LeArea__Index(sheet);
        host.innerHTML = '';
        if (!index.count && !index.groups.length) {
            host.appendChild(Na__LePanels__Note(L('IndexEmpty', 'No areas on this sheet yet.')));
            return;
        }

        index.groups.forEach((group) => host.appendChild(Na__LePanelArea__GroupBlock(group, usable, false)));
        if (index.ungrouped.count) host.appendChild(Na__LePanelArea__GroupBlock(Object.assign({}, index.ungrouped, { name : L('IndexUngrouped', 'Ungrouped') }), usable, true));

        const total = document.createElement('div');
        total.className = 'na-le-area-total';
        total.innerHTML = '<span class="na-le-area-total__name"></span><span class="na-le-area-total__value"></span>';
        total.querySelector('.na-le-area-total__name').textContent  = L('IndexTotal', 'Total');
        total.querySelector('.na-le-area-total__value').textContent = Na__LeArea__FormatArea(index.totalM2);
        host.appendChild(total);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Group of the Index, With Its Rooms and Its Subtotal
    // ------------------------------------------------------------
    function Na__LePanelArea__GroupBlock(group, usable, isUngrouped) {
        const L     = Na__LeArea__Label;
        const block = document.createElement('div');
        block.className = 'na-le-area-group';

        const head = document.createElement('div');
        head.className = 'na-le-area-group__head';

        if (!isUngrouped) {
            const swatch = Na__LePanels__Input('color', 'area-group-colour');
            swatch.value = group.colour || '#cdd6e3';
            swatch.title = L('GroupColour', 'The colour its areas are painted');
            swatch.setAttribute('data-na-role', group.name);
            swatch.disabled = !usable;
            head.appendChild(swatch);
        }

        const name = document.createElement('span');
        name.className   = 'na-le-area-group__name';
        name.textContent = group.name;
        if (!isUngrouped) {
            name.title = L('GroupRename', 'Double-click to rename');
            name.setAttribute('data-na-control', 'area-group-name');
            name.setAttribute('data-na-role', group.name);
        }
        head.appendChild(name);

        const value = document.createElement('span');
        value.className   = 'na-le-area-group__value';
        value.textContent = Na__LeArea__FormatArea(group.m2);
        value.title       = group.count === 1 ? L('IndexCountOne', '1 area') : L('IndexCount', '{count} areas', { count : group.count });
        head.appendChild(value);

        if (!isUngrouped) {
            // THREE BUTTONS AND NO MORE. A fourth - "paint its areas" - cost
            // the heading forty pixels and squeezed "Ground Floor" down to
            // "G", which is worse than useless on the one line that says which
            // floor a subtotal belongs to. Changing the swatch paints the
            // rooms, which is what the swatch was always going to be asked to
            // do, so the button had nothing left to say.
            [ [ 'area-group-up',    '↑', L('GroupUp', 'Move up') ],
              [ 'area-group-down',  '↓', L('GroupDown', 'Move down') ],
              [ 'area-group-delete', '×', L('GroupDelete', 'Delete the group') ] ].forEach((entry) => {
                const button = Na__LePanels__Button(entry[1], entry[0], 'na-le-btn--icon', group.name);
                button.title    = entry[2];
                button.disabled = !usable;
                head.appendChild(button);
            });
        }
        block.appendChild(head);

        group.areas.forEach((row) => {
            const line = document.createElement('button');
            line.type      = 'button';
            line.className = 'na-le-area-row' + (row.crossing ? ' is-broken' : '');
            line.setAttribute('data-na-control', 'area-row');
            line.setAttribute('data-na-role', row.id);
            line.title = L('RowSelect', 'Select it on the sheet');
            const dot = document.createElement('span');
            dot.className = 'na-le-area-row__dot';
            if (row.colour) dot.style.background = row.colour;
            const label = document.createElement('span');
            label.className   = 'na-le-area-row__name';
            label.textContent = row.name || L('Label__UnnamedText', 'Unnamed');
            const figure = document.createElement('span');
            figure.className   = 'na-le-area-row__value';
            figure.textContent = row.crossing ? L('Crossed', 'crosses itself') : Na__LeArea__FormatArea(row.m2);
            line.appendChild(dot);
            line.appendChild(label);
            line.appendChild(figure);
            block.appendChild(line);
        });
        return block;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Editing
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Write One Field of Every Selected Room (one undo step)
    // ------------------------------------------------------------
    function Na__LePanelArea__PatchSelected(patch) {
        const picked = Na__LePanelArea__Selected();
        if (!picked.sheet || !picked.areas.length) return 0;
        return Na__LeArea__PatchMany(picked.sheet, picked.areas.map((shape) => shape.Shape__Id), patch);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Paint Every Selected Room (live while a slider moves, one step when it is let go)
    // ------------------------------------------------------------
    function Na__LePanelArea__PaintSelected(patch, live) {
        const picked = Na__LePanelArea__Selected();
        if (!picked.sheet || !picked.areas.length) return 0;
        let written = 0;
        picked.areas.forEach((shape) => { if (Na__LeModel__UpdateShape(picked.sheet, shape.Shape__Id, patch, true)) written++; });
        if (!written) return 0;
        if (live) Na__LeSurface__Refresh('markup');                               // <-- Silent: the paper follows the slider, the history waits for the release
        else Na__LeModel__AnnounceAreas(picked.sheet, picked.areas.length === 1 ? picked.areas[0].Shape__Id : null);
        return written;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Group List Answered With "New group..."
    // ------------------------------------------------------------
    // The new group is made at once, named "Group n" and given the next colour
    // in the palette, and whatever asked for it is filed under it. Renaming it
    // is a double click away in the index, which is quicker than any dialog
    // and cannot be cancelled halfway.
    // ------------------------------------------------------------
    function Na__LePanelArea__NewGroupName(sheet) {
        const taken = Na__LeModel__GetAreaGroups(sheet).map((group) => Na__LeModel__AreaGroupKey(group.AreaGroup__Name));
        let next = taken.length + 1;
        let name = Na__LeArea__Label('NewGroupName', 'Group {n}', { n : next });
        while (taken.indexOf(Na__LeModel__AreaGroupKey(name)) !== -1) { next++; name = Na__LeArea__Label('NewGroupName', 'Group {n}', { n : next }); }
        return name;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Rename a Group In Place
    // ------------------------------------------------------------
    // The Layers panel's idiom: the name becomes a box, Enter or a click away
    // commits it, Escape puts it back.
    // ------------------------------------------------------------
    function Na__LePanelArea__Rename(element, was) {
        const sheet = Na__LeModel__GetActiveSheet();
        if (!sheet || !Na__LePanels__IsEditable()) return;
        const input = document.createElement('input');
        input.type      = 'text';
        input.className = 'na-le-input na-le-area-group__rename';
        input.value     = was;
        input.maxLength = 120;
        element.replaceWith(input);
        input.focus();
        input.select();
        let done = false;
        const finish = (keep) => {
            if (done) return;
            done = true;
            const now = input.value.replace(/\s+/g, ' ').trim();
            if (keep && now !== '' && now !== was) Na__LeModel__RenameAreaGroup(sheet, was, now);
            Na__LePanels__Refresh(Na__LePanelArea__ID);
        };
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter')  { event.preventDefault(); finish(true); }
            if (event.key === 'Escape') { event.preventDefault(); finish(false); }
        });
        input.addEventListener('blur', () => finish(true));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Registration
// -----------------------------------------------------------------------------

    // FUNCTION | Register the Panel and Its Controls (right column, after Patterns)
    // ------------------------------------------------------------
    function Na__LePanelArea__Register() {
        const link = document.createElement('link');
        link.rel  = 'stylesheet';
        link.href = new URL('./Na__LayoutEditor__Styles__FloorAreas__.css', import.meta.url).href;
        document.head.appendChild(link);
        Na__LeAreaGrip__Attach();                                                // <-- An open room's label drags from a dashed box round it (its styles are in the sheet above)

        const on    = Na__LePanels__OnControl;
        const sheet = () => Na__LeModel__GetActiveSheet();
        const again = () => Na__LePanels__Refresh(Na__LePanelArea__ID);

        // THE LAYER AND THE TOOL
        on('change', 'area-show', (event, el) => { Na__LeArea__SetShown(sheet(), el.checked); });
        on('change', 'area-lock', (event, el) => { Na__LeArea__SetLocked(sheet(), el.checked); });
        on('click',  'area-draw', () => { Na__LeTools__SetTool(Na__LeTools__TOOL_AREA); again(); });
        on('click',  'area-mode', () => { Na__LeAreaTool__SetRectangle(!Na__LeAreaTool__IsRectangle()); again(); });
        on('click',  'area-make', () => {
            const picked = Na__LePanelArea__Selected();
            if (!picked.shape) return;
            const name = Na__LeArea__Make(picked.sheet, picked.shape.Shape__Id);
            if (!name) { Na__LePanelArea__Toast(Na__LeArea__Label('ToastNotClosed', 'A floor area has to be a closed shape of at least three corners.')); return; }
            Na__LePanelArea__FocusName = true;
            again();
        });

        // THE SELECTED ROOM
        on('change', 'area-name',  (event, el) => { Na__LePanelArea__PatchSelected({ Area__Name : el.value }); });
        on('change', 'area-label', (event, el) => { Na__LePanelArea__PatchSelected({ Area__Label : el.value }); });
        on('change', 'area-text-size', (event, el) => {
            const mm = parseFloat(el.value);
            Na__LePanelArea__PatchSelected({ Area__TextSizeMm : Number.isFinite(mm) && mm > 0 ? mm : null });
        });
        on('change', 'area-scale', (event, el) => {
            const denominator = parseFloat(el.value);
            Na__LePanelArea__PatchSelected({ Area__ScaleDenominator : Number.isFinite(denominator) && denominator > 0 ? denominator : null });
        });
        on('change', 'area-colour', (event, el) => { Na__LePanelArea__PaintSelected({ fillColour : el.value }, false); });
        on('input',  'area-opacity', (event, el) => {
            const value = Math.max(0, Math.min(100, parseInt(el.value, 10) || 0));
            Na__LePanelArea__PaintSelected({ fillOpacity : value / 100 }, true);
            Na__LePanels__ShowSlider(el.closest('.na-le-section__body'), 'area-opacity', value, value + '%');
        });
        on('change', 'area-opacity', (event, el) => {
            const value = Math.max(0, Math.min(100, parseInt(el.value, 10) || 0));
            Na__LePanelArea__PaintSelected({ fillOpacity : value / 100 }, false);
        });
        // THE OUTLINE | The vector's own edge. A room can always lose it - its
        // label means it is never invisible - so nothing has to be put on in
        // its place, unlike a plain vector losing its last paint.
        on('change', 'area-stroked',      (event, el) => { Na__LePanelArea__PaintSelected({ stroked : el.checked }, false); });
        on('change', 'area-stroked-many', (event, el) => { Na__LePanelArea__PaintSelected({ stroked : el.checked }, false); });
        on('click',  'area-centre', () => { Na__LePanelArea__PatchSelected({ Area__LabelDXMm : 0, Area__LabelDYMm : 0 }); });
        on('click',  'area-unmake', () => {
            const picked = Na__LePanelArea__Selected();
            picked.areas.forEach((shape) => Na__LeArea__Unmake(picked.sheet, shape.Shape__Id));
            if (picked.areas.length) Na__LePanelArea__Toast(Na__LeArea__Label('ToastConverted', 'It is a plain vector again.'));
        });

        // THE GROUP LISTS | One handler for all three, since they mean the same thing
        const fileUnder = (el, ids) => {
            const live = sheet();
            if (!live) return;
            const name = el.value === Na__LePanelArea__NEW ? Na__LeModel__AddAreaGroup(live, Na__LePanelArea__NewGroupName(live), Na__LeArea__NextGroupColour(live), true) : el.value;
            if (ids && ids.length) Na__LeArea__SetGroup(live, ids, name);
            else { Na__LeArea__SetNewSettings({ group : name }); if (el.value === Na__LePanelArea__NEW) Na__LeModel__AnnounceAreas(live); }
            again();
        };
        on('change', 'area-group',      (event, el) => { fileUnder(el, Na__LePanelArea__Selected().areas.map((shape) => shape.Shape__Id)); });
        on('change', 'area-group-many', (event, el) => { fileUnder(el, Na__LePanelArea__Selected().areas.map((shape) => shape.Shape__Id)); });
        on('change', 'area-new-group',  (event, el) => { fileUnder(el, null); });
        on('change', 'area-colour-many', (event, el) => { Na__LePanelArea__PaintSelected({ fillColour : el.value }, false); });

        // THE SETTINGS FOR NEW ROOMS
        on('change', 'area-new-colour', (event, el) => { Na__LeArea__SetNewSettings({ fillColour : el.value }); });
        on('input',  'area-new-opacity', (event, el) => {
            const value = Math.max(0, Math.min(100, parseInt(el.value, 10) || 0));
            Na__LeArea__SetNewSettings({ fillOpacity : value / 100 });
            Na__LePanels__ShowSlider(el.closest('.na-le-section__body'), 'area-new-opacity', value, value + '%');
        });
        on('change', 'area-new-label', (event, el) => { Na__LeArea__SetNewSettings({ label : el.value }); });
        on('change', 'area-new-stroked', (event, el) => { Na__LeArea__SetNewSettings({ stroked : el.checked }); });

        // THE INDEX
        on('click',    'area-row',          (event, el, id) => { Na__LeModel__SetSelection({ kind : 'shape', id : id }); });
        on('click',    'area-add-group',    () => { const live = sheet(); if (live) Na__LeModel__AddAreaGroup(live, Na__LePanelArea__NewGroupName(live), Na__LeArea__NextGroupColour(live)); });
        on('dblclick', 'area-group-name',   (event, el, name) => { Na__LePanelArea__Rename(el, name); });
        // A GROUP'S COLOUR IS THE COLOUR ITS ROOMS ARE PAINTED, so setting it
        // paints them - silently, and announced once by the paint, which is
        // one undo step for the pair. A group with no rooms yet still has to
        // announce, or the colour it was just given would not be a step at all.
        on('change',   'area-group-colour', (event, el, name) => {
            const live = sheet();
            if (!live) return;
            Na__LeModel__SetAreaGroupColour(live, name, el.value, true);
            if (!Na__LeArea__PaintGroup(live, name)) Na__LeModel__AnnounceAreas(live);
        });
        on('click',    'area-group-up',     (event, el, name) => { Na__LeModel__MoveAreaGroup(sheet(), name, -1); });
        on('click',    'area-group-down',   (event, el, name) => { Na__LeModel__MoveAreaGroup(sheet(), name, 1); });
        on('click',    'area-group-delete', (event, el, name) => { Na__LeModel__DeleteAreaGroup(sheet(), name); });

        // THE SCHEDULES
        on('click', 'area-insert-schedule', () => { if (Na__LeAreaTable__Insert(sheet(), Na__LeAreaTable__FORM_AREAS))  Na__LePanelArea__Toast(Na__LeArea__Label('TableInserted', 'Schedule placed in the middle of the view.')); });
        on('click', 'area-insert-summary',  () => { if (Na__LeAreaTable__Insert(sheet(), Na__LeAreaTable__FORM_GROUPS)) Na__LePanelArea__Toast(Na__LeArea__Label('TableInserted', 'Schedule placed in the middle of the view.')); });

        if (!Na__LePanelArea__Listening) {
            Na__LePanelArea__Listening = true;
            window.addEventListener(Na__LeModel__CHANGED_EVENT, again);
            window.addEventListener(Na__LeTools__CHANGED_EVENT, again);
            window.addEventListener(Na__LeAreaTool__PLACED_EVENT, () => { Na__LePanelArea__FocusName = true; again(); });
            window.addEventListener(Na__LePanelArea__RENAME_EVENT, () => { Na__LePanelArea__FocusName = true; again(); });
        }

        const entry = Na__LePanels__RegisterSection('right', {
            id : Na__LePanelArea__ID, title : Na__LeArea__Label('PanelTitle', 'Floor Areas'),
            build : Na__LePanelArea__Build, refresh : Na__LePanelArea__Refresh
        });
        Na__LeArea__Ready().then(() => {
            const title = entry ? entry.root.querySelector('.na-le-section__title') : null;
            if (title) title.textContent = Na__LeArea__Label('PanelTitle', 'Floor Areas');
            again();
        });
        return entry;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Floor Areas Panel API
    // ------------------------------------------------------------
    export {
        Na__LePanelArea__ID,
        Na__LePanelArea__Register
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
