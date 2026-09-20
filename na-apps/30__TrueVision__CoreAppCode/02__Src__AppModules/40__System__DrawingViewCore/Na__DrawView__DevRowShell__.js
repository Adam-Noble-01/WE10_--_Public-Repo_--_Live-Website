// =============================================================================
// TRUEVISION3D - DRAWING VIEW CORE - DEV MENU ROW SHELL
// =============================================================================
//
// FILE       : Na__DrawView__DevRowShell__.js
// NAMESPACE  : Na__DrawShell
// MODULE     : Drawing View Core - Dev Menu Row Shell
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The parts every drawing panel is made of - the head with its +, the row header's chips, the Update / Revert actions, the Delete below its rule, Advanced, and the two dialogs
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - FLOOR PLANS, ELEVATIONS AND CROSS SECTIONS ARE ONE KIND OF MENU. Adam,
//   20-Sep-2026: make them "behave a lot more like the animation scenes
//   menus" - one row open, a + at the top, a green Update that asks first,
//   Delete below a rule and away from everything else. Built once here so the
//   three panels cannot drift apart, in the Presentation Scenes panel's own
//   classes so the four read as one family.
// - UPDATE IS GREEN, AND IT ASKS. It replaced two buttons: a per-row Save
//   Thumbnail, and a Save at the foot of the panel that wrote every drawing at
//   once. One press now keeps ONE drawing - its settings, and its framing and
//   thumbnail when it is on screen - and the dialog in front of it says what
//   changed and which sheets are drawn from it.
// - DELETE IS BELOW A RULE, ALONE, the way Clear All Scenes is: never the
//   button beside the one that was aimed at.
// - Purely presentational. Every action is handed back through handlers; the
//   dialogs resolve a boolean and change nothing themselves.
//
// INTEGRATION:
// - Na__FloorPlan__DevMenu__*, Na__Elevation__DevMenu__* and the Cross
//   Sections placeholder build their panels from these parts.
// // @delegate: ../21__System__PresentationMode/Na__PresentationMode__DevMenu__Modal__.js
// // @delegate: ./Na__DrawView__DrawingUsage__.js
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
// - Initial implementation, for the Floor Plans and Elevations menu rebuild.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Confirm Dialog, the Sheets and Who Draws From What
    // ------------------------------------------------------------
    import { Na__PresentationMode__DevMenu__Confirm } from '../21__System__PresentationMode/Na__PresentationMode__DevMenu__Modal__.js';
    import { Na__DrawData__GetSheetsArray } from './Na__DrawView__ProjectData__.js';
    import { Na__DrawUsage__Count, Na__DrawUsage__Sentence } from './Na__DrawView__DrawingUsage__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Which Drawings Have Advanced Unfolded
    // ------------------------------------------------------------
    // Held here and not in the DOM: the panels rebuild on nearly every change,
    // and a rebuild must not fold the section somebody is working in.
    // ------------------------------------------------------------
    const Na__DrawShell__AdvancedOpenIds = new Set();
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Small Builders
// -----------------------------------------------------------------------------

    // FUNCTION | Build a Dev Menu Button
    // ------------------------------------------------------------
    function Na__DrawShell__Button(text, modifierClass, title, onClick) {
        const button = document.createElement('button');
        button.type        = 'button';
        button.className   = 'na-pm-dev__btn' + (modifierClass ? ' ' + modifierClass : '');
        button.textContent = text;
        if (title) button.title = title;
        if (typeof onClick === 'function') button.addEventListener('click', onClick);
        return button;
    }
    // ------------------------------------------------------------


    // FUNCTION | Build a Small Caption Over a Group of Controls
    // ------------------------------------------------------------
    function Na__DrawShell__Caption(text) {
        const caption = document.createElement('div');
        caption.className   = 'na-draw-dev__caption';
        caption.textContent = text;
        return caption;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Panel Head
// -----------------------------------------------------------------------------

    // FUNCTION | Build a Panel's Head: Its Title, and a Square + Beside It
    // ------------------------------------------------------------
    // options: { title, addTitle, onAdd, addDisabled }
    // The + is the Presentation Scenes panel's own: the button that makes a
    // new drawing is at the top, where it takes no scrolling to reach,
    // however many rows there are.
    // ------------------------------------------------------------
    function Na__DrawShell__BuildPanelHead(options) {
        const settings = options || {};

        const head = document.createElement('div');
        head.className = 'na-pm-dev__panel-head na-draw-dev__panel-head';

        const title = document.createElement('div');
        title.className   = 'na-dropdown-menu__panel-title na-draw-dev__panel-title';
        title.textContent = settings.title || '';
        head.appendChild(title);

        const add = document.createElement('button');
        add.type        = 'button';
        add.className   = 'na-pm-dev__square-btn';
        add.textContent = '+';
        add.title       = settings.addTitle || 'Add';
        add.setAttribute('aria-label', settings.addTitle || 'Add');
        add.disabled    = settings.addDisabled === true;
        if (typeof settings.onAdd === 'function') add.addEventListener('click', settings.onAdd);
        head.appendChild(add);

        return head;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Row Header
// -----------------------------------------------------------------------------

    // FUNCTION | Build the Colour Swatch That Leads a Row's Header
    // ------------------------------------------------------------
    // The colour of the drawing's plane in the 3D view, so a FOLDED row still
    // says which of the planes out there is its own.
    // ------------------------------------------------------------
    function Na__DrawShell__BuildSwatch(colour) {
        const swatch = document.createElement('span');
        swatch.className = 'na-draw-dev__head-swatch';
        swatch.setAttribute('aria-hidden', 'true');
        if (colour) swatch.style.background = colour;
        return swatch;
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the State Chips That Trail a Row's Header
    // ------------------------------------------------------------
    // Returns { element, set(state) }, state: { kind, isActive, isDirty }.
    // kind is a short word ("SECTION") or ''. Neutral chips, as the scenes
    // panel's are - except NOT UPDATED, which is the one state that is
    // waiting on its author.
    // ------------------------------------------------------------
    function Na__DrawShell__BuildHeaderChips() {
        const element = document.createElement('span');
        element.className = 'na-draw-dev__chips';

        const make = (modifier) => {
            const chip = document.createElement('span');
            chip.className = 'na-pm-dev__scene-badge' + (modifier ? ' ' + modifier : '');
            chip.hidden    = true;
            element.appendChild(chip);
            return chip;
        };
        const kindChip   = make('');
        const activeChip = make('na-draw-dev__chip--active');
        const dirtyChip  = make('na-draw-dev__chip--dirty');

        activeChip.textContent = 'ON SCREEN';
        activeChip.title       = 'This drawing is the one previewed in the viewport.';
        dirtyChip.textContent  = 'NOT UPDATED';
        dirtyChip.title        = 'Changed since it was last updated. Nothing is kept until Update is pressed.';

        const set = (state) => {
            const next = state || {};
            kindChip.hidden      = !next.kind;
            kindChip.textContent = next.kind || '';
            activeChip.hidden    = next.isActive !== true;
            dirtyChip.hidden     = next.isDirty !== true;
        };
        return { element, set };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Row Actions
// -----------------------------------------------------------------------------

    // FUNCTION | Build Preview / Annotate, Then Update / Revert
    // ------------------------------------------------------------
    // options: {
    //   isActive, isEditMode,
    //   previewLabel, exitPreviewLabel, annotateLabel, updateLabel, revertLabel,
    //   drawingWord,
    //   onPreviewToggle, onAnnotate, onUpdate, onRevert
    // }
    // Returns { element, refresh(state) }, state: { isDirty, isBusy }.
    //
    // A two-column grid, as the scenes panel's row actions are: looking on the
    // first line, keeping on the second, and nothing that destroys anything
    // on either - Delete is in the danger zone below.
    // ------------------------------------------------------------
    function Na__DrawShell__BuildCommitActions(options) {
        const settings = options || {};
        const word     = settings.drawingWord || 'drawing';

        const element = document.createElement('div');
        element.className = 'na-pm-dev__actions na-draw-dev__actions';

        element.appendChild(Na__DrawShell__Button(
            settings.isActive ? (settings.exitPreviewLabel || 'Exit Preview') : (settings.previewLabel || 'Preview'),
            'na-pm-dev__btn--primary',
            settings.isActive ? 'Back to the 3D view. Nothing is changed.' : 'Show this ' + word + ' in the viewport. Nothing is changed.',
            settings.onPreviewToggle
        ));

        const annotate = Na__DrawShell__Button(settings.annotateLabel || 'Annotate', '', '', settings.onAnnotate);
        annotate.disabled = settings.isActive !== true;                          // <-- Nothing to annotate until it is on screen
        annotate.title    = annotate.disabled ? ('Preview the ' + word + ' first.') : 'Mark the drawing up. Markup is kept by Update, with everything else.';
        if (settings.isEditMode) annotate.classList.add('na-pm-dev__btn--primary');
        element.appendChild(annotate);

        const update = Na__DrawShell__Button(settings.updateLabel || 'Update', 'na-draw-dev__btn--commit', '', settings.onUpdate);
        const revert = Na__DrawShell__Button(settings.revertLabel || 'Revert', '', '', settings.onRevert);
        element.appendChild(update);
        element.appendChild(revert);

        const refresh = (state) => {
            const next    = state || {};
            const isDirty = next.isDirty === true;
            const isBusy  = next.isBusy === true;

            // UPDATE | Something to keep: changes, or a preview whose framing
            // and thumbnail can be recaptured.
            update.disabled    = isBusy || !(isDirty || settings.isActive === true);
            update.textContent = isBusy ? 'Updating...' : (settings.updateLabel || 'Update');
            update.title       = update.disabled && !isBusy
                ? 'Nothing has changed. Preview the ' + word + ' to recapture its framing and thumbnail.'
                : (settings.isActive
                    ? 'Keep this ' + word + ' as it is set now, with its framing and a new thumbnail. Asks first; writes R2 and the local copy.'
                    : 'Keep this ' + word + ' as it is set now. Asks first; writes R2 and the local copy.');

            revert.disabled = isBusy || !isDirty;
            revert.title    = isDirty
                ? 'Put this ' + word + ' back to how it was last updated.'
                : 'Nothing has changed since this ' + word + ' was last updated.';
        };
        refresh({ isDirty : false, isBusy : false });

        return { element, refresh };
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Rule, and Delete Alone Beneath It
    // ------------------------------------------------------------
    // options: { label, title, onDelete }
    // ------------------------------------------------------------
    function Na__DrawShell__BuildDangerZone(options) {
        const settings = options || {};

        const zone = document.createElement('div');
        zone.className = 'na-draw-dev__danger';

        const rule = document.createElement('hr');
        rule.className = 'na-pm-dev__rule';
        zone.appendChild(rule);

        const actions = document.createElement('div');
        actions.className = 'na-pm-dev__danger-actions';
        actions.appendChild(Na__DrawShell__Button(
            settings.label || 'Delete', 'na-pm-dev__btn--danger', settings.title || '', settings.onDelete
        ));
        zone.appendChild(actions);
        return zone;
    }
    // ------------------------------------------------------------


    // FUNCTION | Build a Collapsed "Advanced" Section
    // ------------------------------------------------------------
    // The scenes panel's own Advanced: settings that are set once and rarely
    // revisited, folded away by default, their open state remembered per
    // drawing across rebuilds. Returns { element, body }.
    // ------------------------------------------------------------
    function Na__DrawShell__BuildAdvanced(drawingId, label) {
        const element = document.createElement('div');
        element.className = 'na-pm-dev__advanced';

        const toggle = document.createElement('button');
        toggle.type      = 'button';
        toggle.className = 'na-pm-dev__advanced-toggle';
        toggle.innerHTML = '';
        toggle.appendChild(document.createTextNode((label || 'Advanced') + ' '));
        const arrow = document.createElement('span');
        arrow.className = 'na-pm-dev__advanced-arrow';
        arrow.innerHTML = '&#9662;';
        toggle.appendChild(arrow);

        const body = document.createElement('div');
        body.className = 'na-pm-dev__advanced-body';

        const isOpen = Na__DrawShell__AdvancedOpenIds.has(drawingId);
        body.classList.toggle('is-open', isOpen);
        toggle.setAttribute('aria-expanded', String(isOpen));

        toggle.addEventListener('click', () => {
            const willOpen = !body.classList.contains('is-open');
            body.classList.toggle('is-open', willOpen);
            toggle.setAttribute('aria-expanded', String(willOpen));
            if (willOpen) Na__DrawShell__AdvancedOpenIds.add(drawingId);
            else          Na__DrawShell__AdvancedOpenIds.delete(drawingId);
        });

        element.appendChild(toggle);
        element.appendChild(body);
        return { element, body };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Who Draws From a Drawing
// -----------------------------------------------------------------------------

    // FUNCTION | The Sheet Viewports Drawn From One Drawing
    // ------------------------------------------------------------
    function Na__DrawShell__UsageFor(drawingId, sceneId) {
        return Na__DrawUsage__Count(Na__DrawData__GetSheetsArray(), drawingId, sceneId || null);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Saying Where a Save Landed
// -----------------------------------------------------------------------------

    // FUNCTION | The Tail of a Success Toast: R2, and the Local Copy or Why Not
    // ------------------------------------------------------------
    // report is what Na__DrawData__Save filled in: report.local is
    // { ok, skipped, error }. A local copy that was not written is said out
    // loud - R2 and the repository file disagreeing is exactly the kind of
    // thing that surfaces a week later as a drawing that "went back".
    // Returns { text, isError }.
    // ------------------------------------------------------------
    function Na__DrawShell__WhereSaved(report) {
        const local = (report && report.local) || null;
        if (local && local.ok)      return { text : 'Saved to R2 and the local project file.', isError : false };
        if (!local || local.skipped) return { text : 'Saved to R2.', isError : false };
        return { text : 'Saved to R2, but the local project file was NOT written: ' + (local.error || 'no answer') + '.', isError : true };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Dialogs
// -----------------------------------------------------------------------------

    // FUNCTION | Ask Before a Drawing Is Updated (Promise<boolean>)
    // ------------------------------------------------------------
    // options: {
    //   word            - 'elevation' | 'floor plan'
    //   name            - what it is called
    //   changes         - [ 'Plane moved 250 mm ...', ... ] (may be empty)
    //   usage           - from UsageFor
    //   movesDrawing    - true when a change repositions what sheets draw
    //   willCapture     - true when it is on screen: framing + thumbnail go too
    //   confirmLabel
    // }
    // RED when the update will move a drawing that sheets are drawn from -
    // that is the press this whole dialog exists for. Green otherwise.
    // ------------------------------------------------------------
    function Na__DrawShell__ConfirmUpdate(options) {
        const settings = options || {};
        const word     = settings.word || 'drawing';
        const usage    = settings.usage || { viewports : 0, sheets : [] };
        const changes  = Array.isArray(settings.changes) ? settings.changes.slice() : [];
        const atRisk   = settings.movesDrawing === true && usage.viewports > 0;

        changes.push(settings.willCapture
            ? 'Framing and thumbnail: recaptured from the preview on screen.'
            : 'Thumbnail: left as it is. Preview the ' + word + ' first if its card should change.');

        let footnote = '';
        if (usage.viewports > 0) {
            footnote = Na__DrawUsage__Sentence(usage, word) + ' ' + (atRisk
                ? 'They will be redrawn from the new position. Dimensions, notes and leaders lettered over them stay where '
                  + 'they are on the sheet, so they may no longer line up - check those sheets afterwards.'
                : 'Nothing that positions the drawing has changed, so they stay lined up.');
        }

        return Na__PresentationMode__DevMenu__Confirm({
            title         : 'Update "' + (settings.name || word) + '"?',
            message       : 'This keeps the ' + word + ' as it is set now and writes it to R2 and to the local project file. '
                          + 'There is no undo.',
            details       : changes,
            footnote      : footnote,
            confirmLabel  : settings.confirmLabel || 'Update',
            cancelLabel   : 'Cancel',
            isDestructive : atRisk,
            isCommit      : true
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Ask Before a Drawing Is Deleted (Promise<boolean>)
    // ------------------------------------------------------------
    // options: { word, name, usage, extra }
    // ------------------------------------------------------------
    function Na__DrawShell__ConfirmDelete(options) {
        const settings = options || {};
        const word     = settings.word || 'drawing';
        const usage    = settings.usage || { viewports : 0, sheets : [] };

        return Na__PresentationMode__DevMenu__Confirm({
            title         : 'Delete "' + (settings.name || word) + '"?',
            message       : 'The ' + word + ' goes, with its carousel card, its annotations and its dimensions, and the '
                          + 'change is written to R2 and to the local project file. There is no undo.'
                          + (settings.extra ? ' ' + settings.extra : ''),
            footnote      : usage.viewports > 0
                ? Na__DrawUsage__Sentence(usage, word) + ' Each of those viewports will have nothing left to draw.'
                : '',
            confirmLabel  : 'Delete ' + word.replace(/^\w/, (letter) => letter.toUpperCase()),
            cancelLabel   : 'Cancel',
            isDestructive : true
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Dev Menu Row Shell API
    // ------------------------------------------------------------
    export {
        Na__DrawShell__Button,
        Na__DrawShell__Caption,
        Na__DrawShell__BuildPanelHead,
        Na__DrawShell__BuildSwatch,
        Na__DrawShell__BuildHeaderChips,
        Na__DrawShell__BuildCommitActions,
        Na__DrawShell__BuildDangerZone,
        Na__DrawShell__BuildAdvanced,
        Na__DrawShell__UsageFor,
        Na__DrawShell__WhereSaved,
        Na__DrawShell__ConfirmUpdate,
        Na__DrawShell__ConfirmDelete
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
