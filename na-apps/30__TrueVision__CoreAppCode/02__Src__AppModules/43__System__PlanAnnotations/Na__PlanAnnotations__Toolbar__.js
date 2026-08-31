// =============================================================================
// TRUEVISION3D - PLAN ANNOTATIONS - EDITING TOOLBAR
// =============================================================================
//
// FILE       : Na__PlanAnnotations__Toolbar__.js
// NAMESPACE  : Na__PlanAnnoBar
// MODULE     : Plan Annotations - Editing Toolbar
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Floating controls for placing and styling floor plan text
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - A small bar that appears over a plan while it is being marked up in
//   developer mode. It carries Add, Delete, text size and font weight, plus a
//   hint line that changes with what the author is doing.
// - The font weight list is built from the config's allowed weights, which
//   are the three Open Sans faces the app actually loads. Offering any other
//   weight would render a browser-synthesised face and look wrong.
// - Size and weight act on the current selection. With nothing selected they
//   are disabled rather than hidden, so the bar never changes shape as labels
//   are clicked around - the controls simply grey out.
// - Built entirely in JavaScript rather than authored into Index.html,
//   because it only ever exists in developer mode on a floor plan scene.
//
// INTEGRATION:
// - Na__FloorPlan__ModeController__ mounts it alongside the annotation editor
//   and unmounts it on leaving plan mode.
// - Every action is delegated to Na__PlanAnnotations__Editor__; this module
//   holds no annotation state of its own.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 31-Aug-2026 - Version 1.0.0
// - Initial implementation for the Floor Plan Builder.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Annotation Data and Editor
    // ------------------------------------------------------------
    // @delegate: ./Na__PlanAnnotations__Data__.js
    // @delegate: ./Na__PlanAnnotations__Editor__.js
    // ------------------------------------------------------------
    import {
        Na__PlanAnno__GetTextSetup,
        Na__PlanAnno__GetLabel
    } from './Na__PlanAnnotations__Data__.js';
    import {
        Na__PlanAnnoEdit__CommitPendingEdit,
        Na__PlanAnnoEdit__GetSelected,
        Na__PlanAnnoEdit__SetPlacing,
        Na__PlanAnnoEdit__IsPlacing,
        Na__PlanAnnoEdit__DeleteSelected,
        Na__PlanAnnoEdit__UpdateSelected
    } from './Na__PlanAnnotations__Editor__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


    // MODULE IMPORTS | Plan Dimensions Editor
    // ------------------------------------------------------------
    // @delegate: ../44__System__PlanDimensions/Na__PlanDimensions__Editor__.js
    // ------------------------------------------------------------
    import {
        Na__PlanDimEdit__BeginPlacement,
        Na__PlanDimEdit__CancelPlacement,
        Na__PlanDimEdit__IsPlacing,
        Na__PlanDimEdit__GetSelectedId,
        Na__PlanDimEdit__DeleteSelected as Na__PlanDimEdit__DeleteSelectedDimension
    } from '../44__System__PlanDimensions/Na__PlanDimensions__Editor__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Dimension Axis Constraints and Focus Arbiter
    // ------------------------------------------------------------
    // @delegate: ../44__System__PlanDimensions/Na__PlanDimensions__AxisLock__.js
    // @delegate: ../42__System__FloorPlanViews/Na__FloorPlan__MarkupFocus__.js
    // ------------------------------------------------------------
    import {
        Na__PlanDimAxis__IsOrthoMode,
        Na__PlanDimAxis__ToggleOrthoMode,
        Na__PlanDimAxis__GetLockedAxis
    } from '../44__System__PlanDimensions/Na__PlanDimensions__AxisLock__.js';
    import { Na__PlanDimGrid__AXIS_X } from '../44__System__PlanDimensions/Na__PlanDimensions__Grid__.js';
    import {
        Na__PlanDim__GetNewDefaults,
        Na__PlanDim__SetNewDefaults,
        Na__PlanDim__GetTextSetup,
        Na__PlanDim__Update,
        Na__PlanDim__F_SIZE,
        Na__PlanDim__F_COLOR
    } from '../44__System__PlanDimensions/Na__PlanDimensions__Data__.js';
    import { Na__PlanDimEdit__GetSelectedRecord } from '../44__System__PlanDimensions/Na__PlanDimensions__Editor__.js';
    import { Na__PlanDimLayer__Sync } from '../44__System__PlanDimensions/Na__PlanDimensions__Overlay__.js';
    import {
        Na__FpFocus__DIMENSIONS,
        Na__FpFocus__CAP_DELETE,
        Na__FpFocus__ShouldHandle
    } from '../42__System__FloorPlanViews/Na__FloorPlan__MarkupFocus__.js';
    // ------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | DOM Identifiers
    // ------------------------------------------------------------
    const Na__PlanAnnoBar__ROOT_ID = 'naPlanAnnotationToolbar';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Mounted Toolbar and Its Controls
    // ------------------------------------------------------------
    let Na__PlanAnnoBar__Root       = null;
    let Na__PlanAnnoBar__AddBtn     = null;
    let Na__PlanAnnoBar__AddDimBtn  = null;
    let Na__PlanAnnoBar__DeleteBtn  = null;
    let Na__PlanAnnoBar__OrthoBtn   = null;
    let Na__PlanAnnoBar__DimSizeInput = null;
    let Na__PlanAnnoBar__DimColorInput = null;
    let Na__PlanAnnoBar__SizeInput  = null;
    let Na__PlanAnnoBar__WeightSel  = null;
    let Na__PlanAnnoBar__HintEl     = null;
    let Na__PlanAnnoBar__OnDone     = null;   // <-- Host callback for the Done button
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | DOM Builders
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build a Toolbar Button
    // ------------------------------------------------------------
    function Na__PlanAnnoBar__BuildButton(text, modifierClass, onClick) {
        const button = document.createElement('button');
        button.type      = 'button';
        button.className = 'na-plan-anno__btn' + (modifierClass ? ' ' + modifierClass : '');
        button.textContent = text;
        button.addEventListener('click', onClick);
        return button;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build a Labelled Field Wrapper
    // ------------------------------------------------------------
    function Na__PlanAnnoBar__BuildField(labelText, control) {
        const field = document.createElement('label');
        field.className = 'na-plan-anno__toolbar-field';

        const caption = document.createElement('span');
        caption.textContent = labelText;

        field.appendChild(caption);
        field.appendChild(control);
        return field;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Text Size Input
    // ------------------------------------------------------------
    // Sizes are real millimetres, so the number here is the height the text
    // would print at on the drawing, not a pixel size.
    // ------------------------------------------------------------
    function Na__PlanAnnoBar__BuildSizeInput() {
        const setup = Na__PlanAnno__GetTextSetup();

        const input = document.createElement('input');
        input.type      = 'number';
        input.className = 'na-plan-anno__input';
        input.min       = String(setup.minSizeMm);
        input.max       = String(setup.maxSizeMm);
        input.step      = String(setup.sizeStepMm);
        input.title     = 'Text height in millimetres';

        // Live feedback on every keystroke, but the whole adjustment collapses
        // into ONE undo step - committed when the field settles, not per event.
        input.addEventListener('input', () => {
            const sizeMm = parseFloat(input.value);
            if (Number.isFinite(sizeMm)) Na__PlanAnnoEdit__UpdateSelected({ sizeMm: sizeMm });
        });
        input.addEventListener('change', Na__PlanAnnoEdit__CommitPendingEdit);
        input.addEventListener('blur',   Na__PlanAnnoEdit__CommitPendingEdit);
        return input;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Dimension Text Size Field
    // ------------------------------------------------------------
    // Acts on the NEW-dimension defaults, and on the selected dimension too
    // when there is one. Setting it before drawing is the point: a dimension
    // should be previewed at the size it will be created at, not placed and
    // then corrected.
    // ------------------------------------------------------------
    function Na__PlanAnnoBar__BuildDimSizeInput() {
        const setup = Na__PlanDim__GetTextSetup();

        const input = document.createElement('input');
        input.type      = 'number';
        input.className = 'na-plan-anno__input';
        input.min       = String(setup.minSizeMm);
        input.max       = String(setup.maxSizeMm);
        input.step      = String(setup.sizeStepMm);
        input.title     = 'Dimension text height in millimetres, applied to the next dimension';

        input.addEventListener('input', () => {
            const sizeMm = parseFloat(input.value);
            if (!Number.isFinite(sizeMm)) return;
            Na__PlanAnnoBar__ApplyDimStyle({ sizeMm: sizeMm });
        });
        return input;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Dimension Colour Swatch
    // ------------------------------------------------------------
    function Na__PlanAnnoBar__BuildDimColorInput() {
        const input = document.createElement('input');
        input.type      = 'color';
        input.className = 'na-plan-anno__swatch';
        input.title     = 'Dimension colour, applied to the next dimension';

        input.addEventListener('input', () => {
            Na__PlanAnnoBar__ApplyDimStyle({ color: input.value });
        });
        return input;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Push a Style Change to the Defaults and the Selection
    // ------------------------------------------------------------
    // One call so the control cannot set a default without also updating the
    // dimension the author is looking at, which would read as the control
    // doing nothing.
    // ------------------------------------------------------------
    function Na__PlanAnnoBar__ApplyDimStyle(patch) {
        Na__PlanDim__SetNewDefaults(patch);

        const record = Na__PlanDimEdit__GetSelectedRecord();
        if (record) {
            Na__PlanDim__Update(record, patch);
            Na__PlanDimLayer__Sync();
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Font Weight Selector
    // ------------------------------------------------------------
    function Na__PlanAnnoBar__BuildWeightSelect() {
        const setup  = Na__PlanAnno__GetTextSetup();
        const select = document.createElement('select');
        select.className = 'na-plan-anno__select';

        for (let i = 0; i < setup.allowedWeights.length; i++) {
            const weight = setup.allowedWeights[i];
            const option = document.createElement('option');
            option.value       = String(weight);
            option.textContent = (setup.weightLabels && setup.weightLabels[String(weight)])
                ? setup.weightLabels[String(weight)]
                : String(weight);
            select.appendChild(option);
        }

        select.addEventListener('change', () => {
            Na__PlanAnnoEdit__UpdateSelected({ fontWeight: parseInt(select.value, 10) });
            Na__PlanAnnoEdit__CommitPendingEdit();                               // <-- One choice is one atomic edit
        });
        return select;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build a Vertical Divider
    // ------------------------------------------------------------
    function Na__PlanAnnoBar__BuildDivider() {
        const divider = document.createElement('span');
        divider.className = 'na-plan-anno__toolbar-divider';
        return divider;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Toolbar Assembly
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Assemble the Whole Toolbar
    // ------------------------------------------------------------
    function Na__PlanAnnoBar__Build() {
        const root = document.createElement('div');
        root.id        = Na__PlanAnnoBar__ROOT_ID;
        root.className = 'na-plan-anno__toolbar';
        root.setAttribute('role', 'toolbar');
        root.setAttribute('aria-label', Na__PlanAnno__GetLabel('ToolbarTitle', 'Plan Annotations'));
        root.title = Na__PlanAnno__GetLabel(                                     // <-- Shortcuts are discoverable without crowding the bar
            'ShortcutsHint',
            'Ctrl+C copy, Ctrl+V paste, Ctrl+Z undo, Ctrl+Y redo, Del removes.'
        );

        const title = document.createElement('span');
        title.className   = 'na-plan-anno__toolbar-title';
        title.textContent = Na__PlanAnno__GetLabel('ToolbarTitle', 'Plan Annotations');
        root.appendChild(title);

        // ADD | Arms placement; the next click on the plan drops a label
        Na__PlanAnnoBar__AddBtn = Na__PlanAnnoBar__BuildButton(
            Na__PlanAnno__GetLabel('AddLabel', '+ Add Text'),
            'na-plan-anno__btn--primary',
            () => {
                Na__PlanAnnoEdit__SetPlacing(!Na__PlanAnnoEdit__IsPlacing());
                Na__PlanAnnoBar__Refresh();
            }
        );
        root.appendChild(Na__PlanAnnoBar__AddBtn);

        // ADD DIMENSION | Arms two-click placement on the snap grid
        // ------------------------------------------------------------
        // Mutually exclusive with text placement: arming either disarms the
        // other, because one click on the plan cannot mean two things.
        // ------------------------------------------------------------
        Na__PlanAnnoBar__AddDimBtn = Na__PlanAnnoBar__BuildButton(
            '+ Add Dimension',
            'na-plan-anno__btn--primary',
            () => {
                if (Na__PlanDimEdit__IsPlacing()) {
                    Na__PlanDimEdit__CancelPlacement();
                } else {
                    Na__PlanAnnoEdit__SetPlacing(false);                         // <-- Stand the text tool down first
                    Na__PlanDimEdit__BeginPlacement();
                }
                Na__PlanAnnoBar__Refresh();
            }
        );
        root.appendChild(Na__PlanAnnoBar__AddDimBtn);

        // ORTHO | Persistent constraint: while it is on, no dimension can come
        // out diagonal at all. Distinct from Shift, which constrains only for
        // as long as it is held, and from an arrow key lock, which pins one
        // specific axis.
        // ------------------------------------------------------------
        Na__PlanAnnoBar__OrthoBtn = Na__PlanAnnoBar__BuildButton(
            'Ortho',
            '',
            () => {
                Na__PlanDimAxis__ToggleOrthoMode();
                Na__PlanAnnoBar__Refresh();
            }
        );
        Na__PlanAnnoBar__OrthoBtn.title =
            'Force every dimension square. Shift constrains while held; arrow keys lock one axis.';
        root.appendChild(Na__PlanAnnoBar__OrthoBtn);

        // DIMENSION STYLE | Pre-configuration. These act on the NEXT dimension
        // and on the selected one, and the placement preview renders from the
        // same values.
        Na__PlanAnnoBar__DimSizeInput = Na__PlanAnnoBar__BuildDimSizeInput();
        root.appendChild(Na__PlanAnnoBar__BuildField('Dim', Na__PlanAnnoBar__DimSizeInput));

        Na__PlanAnnoBar__DimColorInput = Na__PlanAnnoBar__BuildDimColorInput();
        root.appendChild(Na__PlanAnnoBar__DimColorInput);

        root.appendChild(Na__PlanAnnoBar__BuildDivider());

        // SIZE AND WEIGHT | Act on the current selection
        Na__PlanAnnoBar__SizeInput = Na__PlanAnnoBar__BuildSizeInput();
        root.appendChild(Na__PlanAnnoBar__BuildField(
            Na__PlanAnno__GetLabel('SizeLabel', 'Size'), Na__PlanAnnoBar__SizeInput
        ));

        Na__PlanAnnoBar__WeightSel = Na__PlanAnnoBar__BuildWeightSelect();
        root.appendChild(Na__PlanAnnoBar__BuildField(
            Na__PlanAnno__GetLabel('WeightLabel', 'Weight'), Na__PlanAnnoBar__WeightSel
        ));

        Na__PlanAnnoBar__DeleteBtn = Na__PlanAnnoBar__BuildButton(
            Na__PlanAnno__GetLabel('DeleteLabel', 'Delete'),
            'na-plan-anno__btn--danger',
            () => {
                // Routed through the SAME arbiter call the Delete key makes,
                // so the button and the key can never disagree about which
                // layer they act on. The focused layer gets first refusal and
                // the key falls through to whichever layer actually has a
                // selection.
                if (Na__FpFocus__ShouldHandle(Na__FpFocus__DIMENSIONS, Na__FpFocus__CAP_DELETE)) {
                    Na__PlanDimEdit__DeleteSelectedDimension();
                } else {
                    Na__PlanAnnoEdit__DeleteSelected();
                }
                Na__PlanAnnoBar__Refresh();
            }
        );
        root.appendChild(Na__PlanAnnoBar__DeleteBtn);

        root.appendChild(Na__PlanAnnoBar__BuildDivider());

        Na__PlanAnnoBar__HintEl = document.createElement('span');
        Na__PlanAnnoBar__HintEl.className = 'na-plan-anno__toolbar-hint';
        root.appendChild(Na__PlanAnnoBar__HintEl);

        root.appendChild(Na__PlanAnnoBar__BuildButton(
            Na__PlanAnno__GetLabel('DoneLabel', 'Done'),
            '',
            () => {
                if (typeof Na__PlanAnnoBar__OnDone === 'function') Na__PlanAnnoBar__OnDone();
            }
        ));

        return root;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Mount the Toolbar Into a Host Element
    // ------------------------------------------------------------
    // context: { hostElement, onDone }
    // ------------------------------------------------------------
    function Na__PlanAnnoBar__Mount(context) {
        if (!context || !context.hostElement) return false;

        Na__PlanAnnoBar__Unmount();                                              // <-- Never stack two bars

        Na__PlanAnnoBar__OnDone = (typeof context.onDone === 'function') ? context.onDone : null;
        Na__PlanAnnoBar__Root   = Na__PlanAnnoBar__Build();

        context.hostElement.appendChild(Na__PlanAnnoBar__Root);
        Na__PlanAnnoBar__Refresh();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remove the Toolbar
    // ------------------------------------------------------------
    function Na__PlanAnnoBar__Unmount() {
        if (Na__PlanAnnoBar__Root && Na__PlanAnnoBar__Root.parentElement) {
            Na__PlanAnnoBar__Root.parentElement.removeChild(Na__PlanAnnoBar__Root);
        }
        Na__PlanAnnoBar__Root      = null;
        Na__PlanAnnoBar__AddBtn    = null;
        Na__PlanAnnoBar__AddDimBtn = null;
        Na__PlanAnnoBar__DeleteBtn = null;
        Na__PlanAnnoBar__OrthoBtn  = null;
        Na__PlanAnnoBar__DimSizeInput  = null;
        Na__PlanAnnoBar__DimColorInput = null;
        Na__PlanAnnoBar__SizeInput = null;
        Na__PlanAnnoBar__WeightSel = null;
        Na__PlanAnnoBar__HintEl    = null;
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Hint That Fits the Live Constraint
    // ------------------------------------------------------------
    // An axis lock is invisible unless it is said out loud, so whichever
    // constraint is actually holding the pick is what the bar reports.
    // ------------------------------------------------------------
    function Na__PlanAnnoBar__DimensionHint() {
        const locked = Na__PlanDimAxis__GetLockedAxis();
        if (locked) {
            return (locked === Na__PlanDimGrid__AXIS_X)
                ? 'Locked to the X axis. Press Left or Right again to release.'
                : 'Locked to the Y axis. Press Up or Down again to release.';
        }
        if (Na__PlanDimAxis__IsOrthoMode()) {
            return 'Ortho on - dimensions are forced square. Snaps to 5 mm.';
        }
        return 'Click the start, then the end. Shift constrains, arrow keys lock an axis.';
    }
    // ------------------------------------------------------------


    // FUNCTION | Sync the Controls With the Current Selection
    // ------------------------------------------------------------
    // Wired to the editor's onChanged callback, so selecting a label or
    // committing an edit immediately refreshes what the bar shows.
    // ------------------------------------------------------------
    function Na__PlanAnnoBar__Refresh() {
        if (!Na__PlanAnnoBar__Root) return;

        const selected    = Na__PlanAnnoEdit__GetSelected();
        const placing     = Na__PlanAnnoEdit__IsPlacing();
        const dimPlacing  = Na__PlanDimEdit__IsPlacing();
        const dimSelected = Na__PlanDimEdit__GetSelectedId() !== null;

        // ADD | Reads as a toggle while placement is armed
        if (Na__PlanAnnoBar__AddBtn) {
            Na__PlanAnnoBar__AddBtn.classList.toggle('na-plan-anno__btn--active', placing);
        }
        if (Na__PlanAnnoBar__AddDimBtn) {
            Na__PlanAnnoBar__AddDimBtn.classList.toggle('na-plan-anno__btn--active', dimPlacing);
        }
        if (Na__PlanAnnoBar__OrthoBtn) {
            Na__PlanAnnoBar__OrthoBtn.classList.toggle('na-plan-anno__btn--active', Na__PlanDimAxis__IsOrthoMode());
        }

        // DIMENSION STYLE | Shows the selected dimension when there is one,
        // otherwise the defaults the next one will be created with. Never
        // disabled - pre-configuring with nothing selected is the whole point.
        const dimRecord   = Na__PlanDimEdit__GetSelectedRecord();
        const dimDefaults = Na__PlanDim__GetNewDefaults();

        if (Na__PlanAnnoBar__DimSizeInput && document.activeElement !== Na__PlanAnnoBar__DimSizeInput) {
            Na__PlanAnnoBar__DimSizeInput.value = String(
                dimRecord ? dimRecord[Na__PlanDim__F_SIZE] : dimDefaults.sizeMm
            );
        }
        if (Na__PlanAnnoBar__DimColorInput && document.activeElement !== Na__PlanAnnoBar__DimColorInput) {
            Na__PlanAnnoBar__DimColorInput.value =
                dimRecord ? dimRecord[Na__PlanDim__F_COLOR] : dimDefaults.color;
        }

        // SIZE AND WEIGHT | Greyed rather than hidden, so the bar never jumps
        if (Na__PlanAnnoBar__SizeInput) {
            Na__PlanAnnoBar__SizeInput.disabled = !selected;
            Na__PlanAnnoBar__SizeInput.value    = selected ? String(selected.sizeMm) : '';
        }
        if (Na__PlanAnnoBar__WeightSel) {
            Na__PlanAnnoBar__WeightSel.disabled = !selected;
            if (selected) Na__PlanAnnoBar__WeightSel.value = String(selected.fontWeight);
        }
        if (Na__PlanAnnoBar__DeleteBtn) {
            Na__PlanAnnoBar__DeleteBtn.disabled = !selected && !dimSelected;     // <-- Live for either kind of selection
        }

        // HINT | Says the next useful thing rather than a fixed caption
        if (Na__PlanAnnoBar__HintEl) {
            if (dimPlacing) {
                Na__PlanAnnoBar__HintEl.textContent = Na__PlanAnnoBar__DimensionHint();
            } else if (placing) {
                Na__PlanAnnoBar__HintEl.textContent = Na__PlanAnno__GetLabel('PlaceHint', 'Click the plan to place the label.');
            } else if (dimSelected) {
                Na__PlanAnnoBar__HintEl.textContent = 'Drag the dimension to change its offset.';
            } else if (selected) {
                Na__PlanAnnoBar__HintEl.textContent = Na__PlanAnno__GetLabel('EditHint', 'Double-click to edit, drag to move.');
            } else {
                Na__PlanAnnoBar__HintEl.textContent = Na__PlanAnno__GetLabel('NoSelectionHint', 'Select a label to change its size or weight.');
            }
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the Toolbar Mounted?
    // ------------------------------------------------------------
    function Na__PlanAnnoBar__IsMounted() {
        return Na__PlanAnnoBar__Root !== null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Plan Annotation Toolbar API
    // ------------------------------------------------------------
    export {
        Na__PlanAnnoBar__Mount,
        Na__PlanAnnoBar__Unmount,
        Na__PlanAnnoBar__Refresh,
        Na__PlanAnnoBar__IsMounted
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
