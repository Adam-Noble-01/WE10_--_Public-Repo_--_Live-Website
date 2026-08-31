// =============================================================================
// TRUEVISION3D - FLOOR PLAN VIEWS - DEV MENU ROW BUILDERS
// =============================================================================
//
// FILE       : Na__FloorPlan__DevMenu__RowBuilders__.js
// NAMESPACE  : Na__FpRow
// MODULE     : Floor Plan Views - Dev Menu Row Builders
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Build the DOM for one floor plan's row in the Dev menu
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - Purely presentational. Every action is handed back to the editor through
//   the handlers object, so this module holds no state, saves nothing and
//   knows nothing about R2 or the section cut engine.
// - The datum slider shows BOTH the floor level and the resulting cut height
//   in one readout. Those are two different numbers and confusing them is the
//   easiest way to author a plan that slices the wrong part of the building,
//   so they are always displayed together.
// - Dragging the slider fires the live handler on every input event and the
//   commit handler once on release, which is what lets the editor recut
//   cheaply while dragging and exactly on drop.
// - Reuses the existing na-pm-dev and na-dropdown-menu classes so the panel
//   matches every other Dev menu section without new styling.
//
// INTEGRATION:
// - Na__FloorPlan__DevMenu__Editor__ supplies the handlers and appends the
//   returned elements into the Dev menu panel.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 31-Aug-2026 - Version 1.0.0
// - Initial implementation for the Floor Plan Builder. Split out of the dev
//   editor so both files stay inside the house 600-line limit.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Floor Plan Config and Derived Cut Height
    // ------------------------------------------------------------
    // @delegate: ./Na__FloorPlan__ConfigState__.js
    // @delegate: ./Na__FloorPlan__ProjectJson__Data__.js
    // ------------------------------------------------------------
    import {
        Na__FpCfg__GetDatumRangeMm,
        Na__FpCfg__GetCutOffsetMm,
        Na__FpCfg__GetLabel
    } from './Na__FloorPlan__ConfigState__.js';
    import { Na__FpData__GetCutHeightMm } from './Na__FloorPlan__ProjectJson__Data__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | View Depth Input Bounds
    // ------------------------------------------------------------
    // Blank means the ordinary infinite cut downward, so the field has no
    // sensible default - only a ceiling to stop a typo becoming a huge number.
    // ------------------------------------------------------------
    const Na__FpRow__DEPTH_MAX_MM  = 50000;
    const Na__FpRow__DEPTH_STEP_MM = 100;
    const Na__FpRow__OFFSET_STEP_MM = 50;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Generic Control Builders
// -----------------------------------------------------------------------------

    // FUNCTION | Build a Dev Menu Button
    // ------------------------------------------------------------
    function Na__FpRow__BuildButton(text, modifierClass, onClick) {
        const button = document.createElement('button');
        button.type        = 'button';
        button.className   = 'na-pm-dev__btn' + (modifierClass ? ' ' + modifierClass : '');
        button.textContent = text;
        button.addEventListener('click', onClick);
        return button;
    }
    // ------------------------------------------------------------


    // FUNCTION | Build a Labelled Millimetre Number Input Row
    // ------------------------------------------------------------
    // onChange receives a finite number, or null when the field is cleared.
    // ------------------------------------------------------------
    function Na__FpRow__BuildNumberRow(labelText, value, min, max, step, placeholder, onChange) {
        const row = document.createElement('div');
        row.className = 'na-dropdown-menu__panel-row';

        const caption = document.createElement('span');
        caption.className   = 'na-dropdown-menu__value';
        caption.textContent = labelText;

        const input = document.createElement('input');
        input.type      = 'number';
        input.className = 'na-pm-dev__input na-pm-dev__input--short';
        if (Number.isFinite(min))  input.min  = String(min);
        if (Number.isFinite(max))  input.max  = String(max);
        if (Number.isFinite(step)) input.step = String(step);
        input.value       = Number.isFinite(value) ? String(value) : '';
        input.placeholder = placeholder || '';
        input.addEventListener('change', () => {
            onChange(input.value === '' ? null : parseFloat(input.value));
        });

        const unit = document.createElement('span');
        unit.className   = 'na-dropdown-menu__value';
        unit.textContent = 'mm';

        row.appendChild(caption);
        row.appendChild(input);
        row.appendChild(unit);
        return { row, input };
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Floor Datum Slider With a Live Cut Readout
    // ------------------------------------------------------------
    // Returns refreshReadout so the caller can re-render the readout when the
    // cut offset changes without rebuilding the whole row.
    // ------------------------------------------------------------
    function Na__FpRow__BuildDatumSlider(plan, onLiveChange, onCommit) {
        const range = Na__FpCfg__GetDatumRangeMm();

        const wrapper = document.createElement('div');
        wrapper.className = 'na-fp-dev__slider-row';

        const slider = document.createElement('input');
        slider.type      = 'range';
        slider.className = 'na-fp-dev__slider';
        slider.min       = String(range.minMm);
        slider.max       = String(range.maxMm);
        slider.step      = String(range.stepMm);
        slider.value     = String(plan.FloorPlan__FloorDatumMm);
        slider.title     = 'Floor level. 0 is the model ground floor.';

        const readout = document.createElement('span');
        readout.className = 'na-fp-dev__readout';

        // Both numbers, always. The datum is what the author sets; the cut is
        // where the model is actually sliced, and they are never the same.
        const refreshReadout = () => {
            readout.textContent = plan.FloorPlan__FloorDatumMm + ' mm  (cut at '
                + Na__FpData__GetCutHeightMm(plan) + ' mm)';
        };
        refreshReadout();

        slider.addEventListener('input', () => {
            plan.FloorPlan__FloorDatumMm = parseFloat(slider.value);
            refreshReadout();
            onLiveChange();                                                      // <-- Throttled recut while dragging
        });
        slider.addEventListener('change', () => {
            plan.FloorPlan__FloorDatumMm = parseFloat(slider.value);
            refreshReadout();
            onCommit();                                                          // <-- Exact recut on release
        });

        wrapper.appendChild(slider);
        wrapper.appendChild(readout);
        return { wrapper, slider, refreshReadout };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Plan Row Assembly
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the Name Field
    // ------------------------------------------------------------
    function Na__FpRow__BuildNameField(plan, onRename) {
        const input = document.createElement('input');
        input.type      = 'text';
        input.className = 'na-pm-dev__input na-fp-dev__name';
        input.value     = plan.FloorPlan__Name;
        input.title     = 'Also the label on the carousel card';
        input.addEventListener('change', () => {
            const next = input.value.trim();
            if (next.length === 0) {
                input.value = plan.FloorPlan__Name;                              // <-- Never let a plan lose its name
                return;
            }
            plan.FloorPlan__Name = next;
            onRename();
        });
        return input;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Preview / Annotate / Delete Actions
    // ------------------------------------------------------------
    function Na__FpRow__BuildActions(handlers) {
        const actions = document.createElement('div');
        actions.className = 'na-pm-dev__actions';

        actions.appendChild(Na__FpRow__BuildButton(
            handlers.isActive
                ? Na__FpCfg__GetLabel('ExitPreviewLabel', 'Exit Preview')
                : Na__FpCfg__GetLabel('PreviewLabel', 'Preview'),
            'na-pm-dev__btn--primary',
            handlers.onPreviewToggle
        ));

        const annotateBtn = Na__FpRow__BuildButton(
            Na__FpCfg__GetLabel('AnnotateLabel', 'Annotate'), '', handlers.onAnnotate
        );
        annotateBtn.disabled = !handlers.isActive;                               // <-- Nothing to annotate until it is on screen
        if (handlers.isEditMode) annotateBtn.classList.add('na-pm-dev__btn--primary');
        actions.appendChild(annotateBtn);

        actions.appendChild(Na__FpRow__BuildButton(
            'Delete', 'na-pm-dev__btn--danger', handlers.onDelete
        ));
        return actions;
    }
    // ------------------------------------------------------------


    // FUNCTION | Build One Floor Plan's Complete Editor Row
    // ------------------------------------------------------------
    // handlers: {
    //   isActive, isEditMode,
    //   onRename, onDatumLive, onDatumCommit,
    //   onOffsetChange, onDepthChange,
    //   onPreviewToggle, onAnnotate, onDelete
    // }
    // ------------------------------------------------------------
    function Na__FpRow__BuildPlanRow(plan, handlers) {
        const cutOffset = Na__FpCfg__GetCutOffsetMm();

        const rowRoot = document.createElement('div');
        rowRoot.className = 'na-fp-dev__row' + (handlers.isActive ? ' na-fp-dev__row--active' : '');

        rowRoot.appendChild(Na__FpRow__BuildNameField(plan, handlers.onRename));

        // FLOOR LEVEL | The datum the author actually thinks in
        const datumCaption = document.createElement('div');
        datumCaption.className   = 'na-dropdown-menu__panel-title';
        datumCaption.textContent = Na__FpCfg__GetLabel('DatumFieldLabel', 'Floor level');
        rowRoot.appendChild(datumCaption);

        const datum = Na__FpRow__BuildDatumSlider(plan, handlers.onDatumLive, handlers.onDatumCommit);
        rowRoot.appendChild(datum.wrapper);

        // CUT ABOVE FLOOR | Standard architectural cut height
        rowRoot.appendChild(Na__FpRow__BuildNumberRow(
            Na__FpCfg__GetLabel('CutOffsetFieldLabel', 'Cut above floor'),
            plan.FloorPlan__CutOffsetMm,
            cutOffset.minMm, cutOffset.maxMm, Na__FpRow__OFFSET_STEP_MM, '',
            (value) => {
                if (!Number.isFinite(value)) return;
                plan.FloorPlan__CutOffsetMm = value;
                datum.refreshReadout();                                          // <-- Cut height moved, datum did not
                handlers.onOffsetChange();
            }
        ).row);

        // VIEW DEPTH | Optional. Blank is the ordinary infinite cut downward,
        // needed only when a model has no floor slabs to occlude the storey
        // below the one being drawn.
        rowRoot.appendChild(Na__FpRow__BuildNumberRow(
            Na__FpCfg__GetLabel('ViewDepthFieldLabel', 'View depth'),
            plan.FloorPlan__ViewDepthMm,
            0, Na__FpRow__DEPTH_MAX_MM, Na__FpRow__DEPTH_STEP_MM,
            Na__FpCfg__GetLabel('ViewDepthPlaceholder', 'Full'),
            (value) => {
                plan.FloorPlan__ViewDepthMm = (Number.isFinite(value) && value > 0) ? value : null;
                handlers.onDepthChange();
            }
        ).row);

        rowRoot.appendChild(Na__FpRow__BuildActions(handlers));
        return rowRoot;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Floor Plan Dev Menu Row Builder API
    // ------------------------------------------------------------
    export {
        Na__FpRow__BuildButton,
        Na__FpRow__BuildNumberRow,
        Na__FpRow__BuildDatumSlider,
        Na__FpRow__BuildPlanRow
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
