// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PANEL: DRAWING GRID
// =============================================================================
//
// FILE       : Na__LayoutEditor__Panel__DrawingGrid__.js
// NAMESPACE  : Na__LePanelGrid
// MODULE     : Layout Editor - Panel Drawing Grid
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Document Preferences > Drawing Grid: SketchUp LayOut's Document Setup > Grid, one control for one
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - THE SAME CONTROLS AS LAYOUT'S GRID PANEL, IN THE SAME ORDER: Show Grid;
//   Grid Type (Points or Lines); Major Grid with its Spacing and Colour; Minor
//   Grid with its Subdivisions and Colour; and the options Clip grid to page
//   margins and Draw grid on top. Grid Snap sits under Show Grid, because it
//   is the other half of using the grid and LayOut keeps it on a menu this
//   editor does not have. LayOut's Print Grid is the one control left out:
//   this grid is never printed.
// - A LINE SAYS WHAT THE NUMBERS MEAN: the minor spacing and the step points
//   snap to, worked out from the spacing and the subdivisions, so "10 in 10"
//   reads as "1 mm" without doing the sum.
// - Right under the Sheet section, as Adam asked ("in the sheet menu, add a
//   sub-menu called Drawing Grid"), and folded like every other section.
// - Every change goes straight to the grid (Na__LayoutEditor__DrawingGrid__):
//   drawn again at once, remembered in this browser, never written to a sheet
//   and never an undo step. F6 and F7 tick the two boxes as they switch.
//
// INTEGRATION:
// - Registered into the left column's Document Preferences tab by the mode
//   controller, straight after Na__LayoutEditor__Panel__Sheet__.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026)
// - ValeVision    : not yet ported - it waits for Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation: LayOut's grid controls, the spacing readout, the
//   screen-only note and Reset.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Grid and the Panel Host
    // ------------------------------------------------------------
    import {
        Na__LeGrid__CHANGED_EVENT,
        Na__LeGrid__Get,
        Na__LeGrid__GetLimits,
        Na__LeGrid__Label,
        Na__LeGrid__SetShow,
        Na__LeGrid__SetSnap,
        Na__LeGrid__Update,
        Na__LeGrid__ResetSettings
    } from './Na__LayoutEditor__DrawingGrid__.js';
    import {
        Na__LePanels__RegisterSection,
        Na__LePanels__OnControl,
        Na__LePanels__Refresh,
        Na__LePanels__Row,
        Na__LePanels__Input,
        Na__LePanels__Select,
        Na__LePanels__Button,
        Na__LePanels__Note
    } from '../40__Ui__Panels/Na__LayoutEditor__PanelHost__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Section
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Section Id and the Number Boxes
    // ------------------------------------------------------------
    const Na__LePanelGrid__ID      = 'drawing-grid';
    const Na__LePanelGrid__NUMBERS = [ 'grid-major-spacing', 'grid-minor-divisions' ];
    // ------------------------------------------------------------

    // MODULE VARIABLES | Listening for the Grid Changing Elsewhere (F6, F7, the toolbar)
    // ------------------------------------------------------------
    let Na__LePanelGrid__Listening = false;
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Millimetre Figure Without Trailing Zeros
    // ------------------------------------------------------------
    function Na__LePanelGrid__Mm(value) {
        return String(Math.round(value * 1000) / 1000);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Subheading, as the Sheet Section Writes Them
    // ------------------------------------------------------------
    function Na__LePanelGrid__Heading(text) {
        const heading = document.createElement('div');
        heading.className   = 'na-le-subheading';
        heading.textContent = text;
        return heading;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Checkbox Row
    // ------------------------------------------------------------
    function Na__LePanelGrid__Toggle(label, control, title) {
        const row = Na__LePanels__Row(label, Na__LePanels__Input('checkbox', control), 'na-le-row--toggle');
        if (title) row.title = title;
        return row;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Controls
    // ------------------------------------------------------------
    function Na__LePanelGrid__Build(body) {
        const L      = Na__LeGrid__Label;
        const limits = Na__LeGrid__GetLimits();

        body.appendChild(Na__LePanelGrid__Toggle(L('ShowGrid', 'Show grid (F6)'), 'grid-show', 'SketchUp LayOut\'s View > Show Grid: draws the grid over the sheet. F6, or the Grid button on the toolbar.'));
        body.appendChild(Na__LePanelGrid__Toggle(L('GridSnap', 'Grid snap (F7)'), 'grid-snap', 'SketchUp LayOut\'s Arrange > Grid Snap: every point placed or dragged lands on the nearest grid point. Object snap (F3) still wins near a corner or a midpoint. F7, or the Grid Snap button on the toolbar.'));
        body.appendChild(Na__LePanels__Row(L('GridType', 'Grid type'), Na__LePanels__Select('grid-type', [
            { value : 'points', label : L('TypePoints', 'Points (dots)') },
            { value : 'lines',  label : L('TypeLines', 'Lines') }
        ])));

        body.appendChild(Na__LePanelGrid__Heading(L('MajorGrid', 'Major grid')));
        body.appendChild(Na__LePanelGrid__Toggle(L('LevelShow', 'Show'), 'grid-major-on', 'LayOut\'s Major Grid box: draw the heavier points or lines at the major spacing.'));
        body.appendChild(Na__LePanels__Row(L('MajorSpacing', 'Spacing mm'), Na__LePanels__Input('number', 'grid-major-spacing', { min : limits.MajorMinMm, max : limits.MajorMaxMm, step : 1 })));
        body.appendChild(Na__LePanels__Row(L('MajorColour', 'Colour'), Na__LePanels__Input('color', 'grid-major-colour')));

        body.appendChild(Na__LePanelGrid__Heading(L('MinorGrid', 'Minor grid')));
        body.appendChild(Na__LePanelGrid__Toggle(L('LevelShow', 'Show'), 'grid-minor-on', 'LayOut\'s Minor Grid box: draw the finer points or lines between the major ones - and snap to them. Unticked, points snap to the major spacing.'));
        body.appendChild(Na__LePanels__Row(L('MinorDivisions', 'Subdivisions'), Na__LePanels__Input('number', 'grid-minor-divisions', { min : limits.DivisionsMin, max : limits.DivisionsMax, step : 1 })));
        body.appendChild(Na__LePanels__Row(L('MinorColour', 'Colour'), Na__LePanels__Input('color', 'grid-minor-colour')));
        const readout = Na__LePanels__Note('');
        readout.setAttribute('data-na-role', 'grid-readout');
        body.appendChild(readout);

        body.appendChild(Na__LePanelGrid__Heading(L('Options', 'Options')));
        body.appendChild(Na__LePanelGrid__Toggle(L('ClipToMargins', 'Clip grid to page margins'), 'grid-clip', 'Draw the grid inside the sheet border only. Off, it covers the whole paper.'));
        body.appendChild(Na__LePanelGrid__Toggle(L('OnTop', 'Draw grid on top'), 'grid-ontop', 'Draw the grid over the drawings, so it can be seen anywhere. Off, it is drawn on the paper under them and shows only where the paper is bare.'));
        body.appendChild(Na__LePanels__Note(L('ScreenOnly', 'Screen only: the grid is never printed or exported, and nothing here is saved into a sheet. These settings are remembered in this browser.')));
        body.appendChild(Na__LePanels__Button(L('Reset', 'Reset grid'), 'grid-reset'));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect the Grid
    // ------------------------------------------------------------
    // A box being typed into keeps what is being typed; everything else shows
    // the grid as it stands, whoever changed it.
    // ------------------------------------------------------------
    function Na__LePanelGrid__Refresh(body) {
        const s    = Na__LeGrid__Get();
        const find = (name) => body.querySelector('[data-na-control="' + name + '"]');
        const tick = (name, on) => { const el = find(name); if (el) el.checked = on === true; };
        const put  = (name, value) => { const el = find(name); if (el && document.activeElement !== el) el.value = String(value); };
        tick('grid-show', s.Show);
        tick('grid-snap', s.Snap);
        put('grid-type', s.Type);
        tick('grid-major-on', s.ShowMajor);
        put('grid-major-spacing', Na__LePanelGrid__Mm(s.MajorSpacingMm));
        put('grid-major-colour', s.MajorColour);
        tick('grid-minor-on', s.ShowMinor);
        put('grid-minor-divisions', s.MinorDivisions);
        put('grid-minor-colour', s.MinorColour);
        tick('grid-clip', s.ClipToMargins);
        tick('grid-ontop', s.OnTop);
        const readout = body.querySelector('[data-na-role="grid-readout"]');
        if (readout) {
            readout.textContent = Na__LeGrid__Label('MinorReadout', 'Minor spacing {spacing} mm. Points snap every {step} mm.')
                .replace('{spacing}', Na__LePanelGrid__Mm(s.MinorSpacingMm))
                .replace('{step}', Na__LePanelGrid__Mm(s.SnapStepMm));
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Register the Section and Its Controls
    // ------------------------------------------------------------
    function Na__LePanelGrid__Register() {
        // A NUMBER TAKES ON ENTER, as the Sheet section's boxes do: the box
        // lets go of the focus, its change goes to the grid, and the next key
        // reaches the sheet.
        Na__LePanelGrid__NUMBERS.forEach((control) => Na__LePanels__OnControl('keydown', control, (event, input) => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); input.blur(); } }));
        Na__LePanels__OnControl('change', 'grid-show',  (e, el) => { Na__LeGrid__SetShow(el.checked); });
        Na__LePanels__OnControl('change', 'grid-snap',  (e, el) => { Na__LeGrid__SetSnap(el.checked); });
        Na__LePanels__OnControl('change', 'grid-type',  (e, el) => { Na__LeGrid__Update({ Type : el.value }); });
        Na__LePanels__OnControl('change', 'grid-major-on', (e, el) => { Na__LeGrid__Update({ ShowMajor : el.checked }); });
        Na__LePanels__OnControl('change', 'grid-minor-on', (e, el) => { Na__LeGrid__Update({ ShowMinor : el.checked }); });
        Na__LePanels__OnControl('change', 'grid-clip',  (e, el) => { Na__LeGrid__Update({ ClipToMargins : el.checked }); });
        Na__LePanels__OnControl('change', 'grid-ontop', (e, el) => { Na__LeGrid__Update({ OnTop : el.checked }); });
        Na__LePanels__OnControl('change', 'grid-major-spacing', (e, el) => {
            const mm = parseFloat(el.value);
            if (Number.isFinite(mm) && mm > 0) Na__LeGrid__Update({ MajorSpacingMm : mm });
            Na__LePanels__Refresh(Na__LePanelGrid__ID);                        // <-- An out-of-range figure shows what it was held to
        });
        Na__LePanels__OnControl('change', 'grid-minor-divisions', (e, el) => {
            const n = parseInt(el.value, 10);
            if (Number.isFinite(n) && n >= 1) Na__LeGrid__Update({ MinorDivisions : n });
            Na__LePanels__Refresh(Na__LePanelGrid__ID);
        });
        // A COLOUR FOLLOWS THE PICKER LIVE, so the grid can be judged against
        // the drawing while the colour is still being chosen.
        Na__LePanels__OnControl('input', 'grid-major-colour', (e, el) => { Na__LeGrid__Update({ MajorColour : el.value }); });
        Na__LePanels__OnControl('input', 'grid-minor-colour', (e, el) => { Na__LeGrid__Update({ MinorColour : el.value }); });
        Na__LePanels__OnControl('click', 'grid-reset', () => { Na__LeGrid__ResetSettings(); });

        // F6, F7 AND THE TOOLBAR tick the boxes here as they switch the grid.
        if (!Na__LePanelGrid__Listening) {
            Na__LePanelGrid__Listening = true;
            window.addEventListener(Na__LeGrid__CHANGED_EVENT, () => Na__LePanels__Refresh(Na__LePanelGrid__ID));
        }
        return Na__LePanels__RegisterSection('left', {
            id : Na__LePanelGrid__ID, title : Na__LeGrid__Label('SectionTitle', 'Drawing Grid'),
            build : Na__LePanelGrid__Build, refresh : Na__LePanelGrid__Refresh
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Drawing Grid Panel API
    // ------------------------------------------------------------
    export {
        Na__LePanelGrid__Register
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
