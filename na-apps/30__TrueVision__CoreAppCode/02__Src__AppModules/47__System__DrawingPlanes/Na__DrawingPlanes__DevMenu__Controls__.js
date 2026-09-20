// =============================================================================
// TRUEVISION3D - DRAWING PLANES - DEV MENU CONTROLS
// =============================================================================
//
// FILE       : Na__DrawingPlanes__DevMenu__Controls__.js
// NAMESPACE  : Na__PlaneUi
// MODULE     : Drawing Planes - Dev Menu Controls
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Build the Drawing Planes bar and the per-row plane controls that the Floor Plans and Elevations panels both carry
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - THE BAR sits at the head of both drawing panels and is the same bar in
//   each, because the state behind it is shared: All plans and All elevations
//   switch every plane of a type on or off, and Snap with its stepper sets the
//   grid every plane lands on (10, 25, 50, 100, 250 or 500 mm).
//
// - THE ROW CONTROLS sit under each drawing's name: a swatch in the plane's own
//   colour, Show plane, Move to face and - for an elevation - Aim at face. The
//   swatch is what ties a row to a plane in the 3D view, and the row of the
//   selected plane wears that colour down its left edge.
//
// - REFRESHED IN PLACE, NEVER BY REBUILDING THE PANEL. Touching a slider
//   selects its plane and the overlay announces it; if that announcement
//   rebuilt the panel, the slider under the author's hand would be replaced
//   mid-drag. So every control here keeps a small refresh function, and one
//   listener runs them all. A control whose panel has been rebuilt is dropped
//   the first time it is found detached.
//
// - Purely presentational plus three calls into the overlay and the grip. It
//   knows nothing about records, R2 or the section engine.
//
// INTEGRATION:
// - Na__FloorPlan__DevMenu__Editor__ and Na__Elevation__DevMenu__Editor__ call
//   BuildBar once per render and BuildRowControls once per row.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (20-Sep-2026)
// - ValeVision    : not yet ported.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation for the Drawing Planes build.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Drawing Planes Config, Overlay and Grip
    // ------------------------------------------------------------
    // @delegate: ./Na__DrawingPlanes__ConfigState__.js
    // @delegate: ./Na__DrawingPlanes__Overlay__.js
    // @delegate: ./Na__DrawingPlanes__Grip__.js
    // ------------------------------------------------------------
    import {
        Na__PlaneCfg__IsEnabled,
        Na__PlaneCfg__GetLabel,
        Na__PlaneCfg__FormatLabel
    } from './Na__DrawingPlanes__ConfigState__.js';
    import {
        Na__PlaneOverlay__CHANGED_EVENT,
        Na__PlaneOverlay__GetTypes,
        Na__PlaneOverlay__GetColour,
        Na__PlaneOverlay__HasModel,
        Na__PlaneOverlay__IsShown,
        Na__PlaneOverlay__SetShown,
        Na__PlaneOverlay__AreAllShown,
        Na__PlaneOverlay__SetAllShown,
        Na__PlaneOverlay__IsSelected,
        Na__PlaneOverlay__Select,
        Na__PlaneOverlay__GetSnap,
        Na__PlaneOverlay__SetSnapEnabled,
        Na__PlaneOverlay__StepSnapIncrement,
        Na__PlaneOverlay__CanStepSnapIncrement
    } from './Na__DrawingPlanes__Overlay__.js';
    import {
        Na__PlaneGrip__MODE_MOVE,
        Na__PlaneGrip__MODE_AIM,
        Na__PlaneGrip__StartFacePick,
        Na__PlaneGrip__IsPicking
    } from './Na__DrawingPlanes__Grip__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Drawing Types and the Row Card Class
    // ------------------------------------------------------------
    const Na__PlaneUi__TYPE_PLAN      = 'plan';
    const Na__PlaneUi__TYPE_ELEVATION = 'elevation';
    const Na__PlaneUi__ROW_CARD_CLASS = 'na-fp-dev__row';                        // <-- The card both drawing panels build a row in
    const Na__PlaneUi__MAX_WATCHED    = 400;                                     // <-- Above this, controls that never reached the page are dropped
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Controls That Refresh Themselves, and the One Listener
    // ------------------------------------------------------------
    const Na__PlaneUi__Watched  = new Set();   // <-- { element, refresh, seen }
    let   Na__PlaneUi__Listening = false;
    let   Na__PlaneUi__ShowToast = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | In-Place Refresh
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Run Every Live Control's Refresh, Dropping the Dead
    // ------------------------------------------------------------
    function Na__PlaneUi__RefreshAll() {
        Na__PlaneUi__Watched.forEach((entry) => {
            if (entry.element.isConnected) {
                entry.seen = true;
                entry.refresh();
            } else if (entry.seen || Na__PlaneUi__Watched.size > Na__PlaneUi__MAX_WATCHED) {
                Na__PlaneUi__Watched.delete(entry);                              // <-- Its panel was rebuilt; a new control has taken its place
            }
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Keep a Control Fresh for as Long as It Is on the Page
    // ------------------------------------------------------------
    function Na__PlaneUi__Watch(element, refresh) {
        Na__PlaneUi__Watched.add({ element : element, refresh : refresh, seen : false });
        if (!Na__PlaneUi__Listening) {
            window.addEventListener(Na__PlaneOverlay__CHANGED_EVENT, Na__PlaneUi__RefreshAll);
            Na__PlaneUi__Listening = true;
        }
        refresh();

        // Once more when the panel's render has finished: a control is built
        // before it is attached, and the part of its refresh that reaches
        // outward - the row card's coloured edge - finds nothing until it is.
        window.setTimeout(() => { if (element.isConnected) refresh(); }, 0);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show a Toast if a Host Supplied One
    // ------------------------------------------------------------
    function Na__PlaneUi__Toast(message, isError) {
        if (typeof Na__PlaneUi__ShowToast === 'function') Na__PlaneUi__ShowToast(message, isError === true);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Control Builders
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build a Dev Menu Button
    // ------------------------------------------------------------
    function Na__PlaneUi__Button(text, title, onClick) {
        const button = document.createElement('button');
        button.type        = 'button';
        button.className   = 'na-pm-dev__btn';
        button.textContent = text;
        if (title) button.title = title;
        button.addEventListener('click', onClick);
        return button;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Press or Release a Toggle Button
    // ------------------------------------------------------------
    function Na__PlaneUi__SetPressed(button, pressed) {
        button.classList.toggle('na-pm-dev__btn--primary', pressed === true);
        button.setAttribute('aria-pressed', String(pressed === true));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build One "All of a Type" Toggle
    // ------------------------------------------------------------
    function Na__PlaneUi__BuildAllToggle(type, label) {
        const button = Na__PlaneUi__Button(label, '', () => {
            if (!Na__PlaneOverlay__HasModel()) {
                Na__PlaneUi__Toast(Na__PlaneCfg__GetLabel('NoModelMessage', 'Load a model before showing drawing planes.'), true);
                return;
            }
            Na__PlaneOverlay__SetAllShown(type, !Na__PlaneOverlay__AreAllShown(type));
        });
        Na__PlaneUi__Watch(button, () => {
            const allOn = Na__PlaneOverlay__AreAllShown(type);
            Na__PlaneUi__SetPressed(button, allOn);
            button.title = allOn ? 'Hide every one of these planes.' : 'Show every one of these planes in the 3D view at once.';
        });
        return button;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Snap Toggle and Its Increment Stepper
    // ------------------------------------------------------------
    function Na__PlaneUi__BuildSnapRow() {
        const row = document.createElement('div');
        row.className = 'na-plane-dev__snap';

        const toggle = Na__PlaneUi__Button(Na__PlaneCfg__GetLabel('SnapLabel', 'Snap'), '', () => {
            Na__PlaneOverlay__SetSnapEnabled(!Na__PlaneOverlay__GetSnap().enabled);
        });

        const down  = Na__PlaneUi__Button('-', 'A finer grid', () => Na__PlaneOverlay__StepSnapIncrement(-1));
        const up    = Na__PlaneUi__Button('+', 'A coarser grid', () => Na__PlaneOverlay__StepSnapIncrement(+1));
        down.classList.add('na-plane-dev__step');
        up.classList.add('na-plane-dev__step');

        const value = document.createElement('span');
        value.className = 'na-plane-dev__increment';

        row.appendChild(toggle);
        row.appendChild(down);
        row.appendChild(value);
        row.appendChild(up);

        Na__PlaneUi__Watch(row, () => {
            const snap = Na__PlaneOverlay__GetSnap();
            Na__PlaneUi__SetPressed(toggle, snap.enabled);
            toggle.title = Na__PlaneCfg__FormatLabel(
                snap.enabled ? 'SnapOnHint' : 'SnapOffHint',
                snap.enabled ? 'Planes land on a {increment} mm grid.' : 'Planes move freely.',
                { increment : snap.incrementMm }
            );
            value.textContent = snap.incrementMm + ' mm';
            value.classList.toggle('na-plane-dev__increment--off', !snap.enabled);
            down.disabled = !Na__PlaneOverlay__CanStepSnapIncrement(-1);
            up.disabled   = !Na__PlaneOverlay__CanStepSnapIncrement(+1);
        });
        return row;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Build the Drawing Planes Bar
    // ------------------------------------------------------------
    // Returns null when the system is switched off in config, so a panel
    // appends nothing rather than an empty box.
    // ------------------------------------------------------------
    function Na__PlaneUi__BuildBar() {
        if (!Na__PlaneCfg__IsEnabled()) return null;

        const bar = document.createElement('div');
        bar.className = 'na-plane-dev__bar';

        const title = document.createElement('div');
        title.className   = 'na-dropdown-menu__panel-title';
        title.textContent = Na__PlaneCfg__GetLabel('BarTitle', 'Drawing planes in the 3D view');
        bar.appendChild(title);

        const types   = Na__PlaneOverlay__GetTypes();
        const toggles = document.createElement('div');
        toggles.className = 'na-pm-dev__actions';
        if (types.indexOf(Na__PlaneUi__TYPE_PLAN) !== -1) {
            toggles.appendChild(Na__PlaneUi__BuildAllToggle(Na__PlaneUi__TYPE_PLAN, Na__PlaneCfg__GetLabel('AllPlansLabel', 'All plans')));
        }
        if (types.indexOf(Na__PlaneUi__TYPE_ELEVATION) !== -1) {
            toggles.appendChild(Na__PlaneUi__BuildAllToggle(Na__PlaneUi__TYPE_ELEVATION, Na__PlaneCfg__GetLabel('AllElevationsLabel', 'All elevations')));
        }
        bar.appendChild(toggles);
        bar.appendChild(Na__PlaneUi__BuildSnapRow());

        const note = document.createElement('p');
        note.className   = 'na-fp-dev__empty';
        note.textContent = Na__PlaneCfg__GetLabel('BarNote', 'Drag a plane by a corner grip or its name.');
        bar.appendChild(note);
        return bar;
    }
    // ------------------------------------------------------------


    // FUNCTION | Build One Drawing's Plane Controls
    // ------------------------------------------------------------
    // options: { canAim } - an elevation can be turned to face a wall; a
    // floor plan has no bearing to turn. Returns null when the system is off.
    // ------------------------------------------------------------
    function Na__PlaneUi__BuildRowControls(type, id, options) {
        if (!Na__PlaneCfg__IsEnabled()) return null;
        const canAim = Boolean(options && options.canAim === true);

        const wrapper = document.createElement('div');
        wrapper.className = 'na-plane-dev__row';

        const swatch = document.createElement('span');
        swatch.className = 'na-plane-dev__swatch';
        swatch.title     = 'The colour of this drawing\'s plane in the 3D view.';

        const show = Na__PlaneUi__Button(
            Na__PlaneCfg__GetLabel('ShowPlaneLabel', 'Show plane'),
            Na__PlaneCfg__GetLabel('ShowPlaneHint', 'Show this drawing\'s plane in the 3D view.'),
            () => {
                if (!Na__PlaneOverlay__HasModel()) {
                    Na__PlaneUi__Toast(Na__PlaneCfg__GetLabel('NoModelMessage', 'Load a model before showing drawing planes.'), true);
                    return;
                }
                const next = !Na__PlaneOverlay__IsShown(type, id);
                Na__PlaneOverlay__SetShown(type, id, next);
                if (next) Na__PlaneOverlay__Select(type, id);                    // <-- The plane just asked for is the one to look at
            }
        );

        const moveLabel = Na__PlaneCfg__GetLabel('MoveToFaceLabel', 'Move to face');
        const aimLabel  = Na__PlaneCfg__GetLabel('AimAtFaceLabel', 'Aim at face');
        const cancel    = Na__PlaneCfg__GetLabel('CancelPickLabel', 'Cancel pick');

        const move = Na__PlaneUi__Button(moveLabel, Na__PlaneCfg__GetLabel('MoveToFaceHint', 'Then click a building face.'),
            () => Na__PlaneGrip__StartFacePick(type, id, Na__PlaneGrip__MODE_MOVE));
        const aim = canAim
            ? Na__PlaneUi__Button(aimLabel, Na__PlaneCfg__GetLabel('AimAtFaceHint', 'Then click a wall.'),
                () => Na__PlaneGrip__StartFacePick(type, id, Na__PlaneGrip__MODE_AIM))
            : null;

        wrapper.appendChild(swatch);
        wrapper.appendChild(show);
        wrapper.appendChild(move);
        if (aim) wrapper.appendChild(aim);

        Na__PlaneUi__Watch(wrapper, () => {
            const colour   = Na__PlaneOverlay__GetColour(type, id);
            const selected = Na__PlaneOverlay__IsSelected(type, id);
            swatch.style.background = colour;
            Na__PlaneUi__SetPressed(show, Na__PlaneOverlay__IsShown(type, id));

            const moving = Na__PlaneGrip__IsPicking(type, id, Na__PlaneGrip__MODE_MOVE);
            move.textContent = moving ? cancel : moveLabel;
            Na__PlaneUi__SetPressed(move, moving);
            if (aim) {
                const aiming = Na__PlaneGrip__IsPicking(type, id, Na__PlaneGrip__MODE_AIM);
                aim.textContent = aiming ? cancel : aimLabel;
                Na__PlaneUi__SetPressed(aim, aiming);
            }

            // The selected plane's row wears its colour down the left edge.
            const card = wrapper.closest('.' + Na__PlaneUi__ROW_CARD_CLASS);
            if (card) card.style.boxShadow = selected ? ('inset 4px 0 0 ' + colour) : '';
        });
        return wrapper;
    }
    // ------------------------------------------------------------


    // FUNCTION | Hand the Controls a Toast
    // ------------------------------------------------------------
    function Na__PlaneUi__Initialize(context) {
        Na__PlaneUi__ShowToast = (context && context.showToast) || null;
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Drawing Planes Dev Menu Controls API
    // ------------------------------------------------------------
    export {
        Na__PlaneUi__TYPE_PLAN,
        Na__PlaneUi__TYPE_ELEVATION,
        Na__PlaneUi__Initialize,
        Na__PlaneUi__BuildBar,
        Na__PlaneUi__BuildRowControls
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
