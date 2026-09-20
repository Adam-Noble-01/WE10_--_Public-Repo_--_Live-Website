// =============================================================================
// TRUEVISION3D - FLOOR PLAN VIEWS - DEV MENU STOREY ROW
// =============================================================================
//
// FILE       : Na__FloorPlan__DevMenu__StoreyRow__.js
// NAMESPACE  : Na__FpStoreyRow
// MODULE     : Floor Plan Views - Dev Menu Storey Row
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The dropdown in a floor plan's Dev menu row that says which building storey the plan is a plan of
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - ONE ROW: a label, and a dropdown of the storeys in the order the config
//   lists them - Ground floor, First floor, Second floor, Roof plan, Basement
//   level. It shows the plan's storey whether somebody chose it or it is
//   still the guess, because either way that is what the drawings will say.
// - A GUESS SAYS THAT IT IS ONE. Under the dropdown, in small words: guessed
//   from the cut height, or from the plan's name. Picking any storey fixes it
//   and the words go. A guess that is already RIGHT cannot be fixed by picking
//   it - a dropdown does not report a choice of what it already shows - so
//   the words carry a Confirm button that stores the guess as the choice.
//   Left unconfirmed it goes on following the plan, which is usually wanted:
//   drag a new plan's plane up a storey and it reads First floor by itself.
// - THE RECORD IS WRITTEN BEFORE ANYBODY IS TOLD. onChange is called after
//   FloorPlan__StoreyLevel is on the record, so the editor that owns the row
//   can treat it as any other edit of a field that moves nothing: the plan is
//   not re-cut, no camera moves and no sheet goes out of line.
// - NEVER STALE WHEN REACHED FOR. The editor rebuilds its rows on most changes
//   but not while a slider is being dragged, and a drag can carry a guess
//   into another band. The row re-reads its plan when the pointer or the
//   focus enters it, and Refresh does the same for an editor that would
//   rather say when.
// - Purely presentational, like the row builders beside it: no state, no
//   saving, nothing about R2. Existing na-pm-dev and na-fp-dev classes only.
//
// INTEGRATION:
// - Na__FloorPlan__DevMenu__RowBuilders__ appends Build(plan, onChange) under
//   a plan's name field.
// // @delegate: ./Na__FloorPlan__ProjectJson__Data__.js
// // @delegate: ./Na__FloorPlan__ConfigState__.js
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
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Plan's Storey and the Dev Menu Wording
    // ------------------------------------------------------------
    import {
        Na__FpData__GetCutHeightMm,
        Na__FpData__GetStoreyLevel,
        Na__FpData__GetStoreyLevelChoices,
        Na__FpData__SetStoreyLevel
    } from './Na__FloorPlan__ProjectJson__Data__.js';
    import {
        Na__FpCfg__GetLabel,
        Na__FpCfg__FormatLabel
    } from './Na__FloorPlan__ConfigState__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Class Names, the Id Prefix and Where a Row Keeps Its Refresh
    // ------------------------------------------------------------
    const Na__FpStoreyRow__ROOT_CLASS  = 'na-fp-dev__storey';
    const Na__FpStoreyRow__NOTE_CLASS  = 'na-fp-dev__empty na-fp-dev__storey-note';   // <-- The panel's small grey words
    const Na__FpStoreyRow__ID_PREFIX   = 'naFpStorey__';
    const Na__FpStoreyRow__REFRESH_KEY = 'Na__FpStoreyRow__RefreshFn';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Row Assembly
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | What the Small Words Under a Guess Say
    // ------------------------------------------------------------
    function Na__FpStoreyRow__GuessWords(plan, level) {
        if (level.from === 'name') {
            return Na__FpCfg__GetLabel('StoreyGuessedFromName', 'Guessed from the plan\'s name. Choose one to fix it.');
        }
        const cutMm = Na__FpData__GetCutHeightMm(plan);
        return Na__FpCfg__FormatLabel(
            'StoreyGuessedFromHeight',
            'Guessed from the cut height ({cut} mm). Choose one to fix it.',
            { cut : Number.isFinite(cutMm) ? Math.round(cutMm).toLocaleString('en-GB') : '?' }
        );
    }
    // ------------------------------------------------------------


    // FUNCTION | Build a Floor Plan's Storey Dropdown Row
    // ------------------------------------------------------------
    // onChange(key) is called AFTER the record has been written, for a pick
    // and for Confirm alike, and never when nothing changed. Returns one
    // element holding the row and the words under it.
    // ------------------------------------------------------------
    function Na__FpStoreyRow__Build(plan, onChange) {
        const root = document.createElement('div');
        root.className = Na__FpStoreyRow__ROOT_CLASS;

        const row = document.createElement('div');
        row.className = 'na-pm-dev__row';

        const selectId = Na__FpStoreyRow__ID_PREFIX + String((plan && plan.FloorPlan__Id) || '');

        const label = document.createElement('label');
        label.className   = 'na-pm-dev__label';
        label.htmlFor     = selectId;
        label.textContent = Na__FpCfg__GetLabel('StoreyFieldLabel', 'Storey');

        const select = document.createElement('select');
        select.id        = selectId;
        select.className = 'na-pm-dev__select';
        select.title     = Na__FpCfg__GetLabel(
            'StoreyFieldHint',
            'Which building storey this is a plan of. A drawing title tied to this plan on a sheet reads it: PROPOSED GROUND FLOOR PLAN.'
        );
        Na__FpData__GetStoreyLevelChoices().forEach((choice) => {
            const option = document.createElement('option');
            option.value = choice.key;
            option.text  = choice.label;
            select.appendChild(option);
        });

        const note = document.createElement('p');
        note.className = Na__FpStoreyRow__NOTE_CLASS;

        const words = document.createElement('span');

        const confirm = document.createElement('button');
        confirm.type        = 'button';
        confirm.className   = 'na-pm-dev__btn';
        confirm.textContent = Na__FpCfg__GetLabel('StoreyConfirmLabel', 'Confirm');
        confirm.title       = Na__FpCfg__GetLabel('StoreyConfirmHint', 'Keep this storey, wherever the cut is moved to.');

        note.appendChild(words);
        note.appendChild(confirm);

        // Read the record and show what it says - the storey, and whether it
        // is still a guess.
        const refresh = () => {
            const level = Na__FpData__GetStoreyLevel(plan);
            if (!level) return;
            select.value      = level.key;
            note.hidden       = !level.guessed;
            words.textContent = level.guessed ? Na__FpStoreyRow__GuessWords(plan, level) : '';
        };

        const commit = (key) => {
            const changed = Na__FpData__SetStoreyLevel(plan, key);               // <-- The record first; it also tells the Layout Editor's titles
            refresh();
            if (changed && typeof onChange === 'function') onChange(key);
        };

        select.addEventListener('change', () => commit(select.value));
        confirm.addEventListener('click', () => {
            const level = Na__FpData__GetStoreyLevel(plan);
            if (level && level.guessed) commit(level.key);
        });

        // A slider drag does not rebuild the row, and can carry the guess into
        // another band: re-read whenever the author reaches for it.
        root.addEventListener('pointerenter', refresh);
        root.addEventListener('focusin', refresh);
        root[Na__FpStoreyRow__REFRESH_KEY] = refresh;

        row.appendChild(label);
        row.appendChild(select);
        root.appendChild(row);
        root.appendChild(note);
        refresh();
        return root;
    }
    // ------------------------------------------------------------


    // FUNCTION | Make a Built Row Re-Read Its Plan
    // ------------------------------------------------------------
    // For an editor that moves a plan's cut without rebuilding its rows.
    // Returns false for anything Build did not make.
    // ------------------------------------------------------------
    function Na__FpStoreyRow__Refresh(element) {
        const refresh = element ? element[Na__FpStoreyRow__REFRESH_KEY] : null;
        if (typeof refresh !== 'function') return false;
        refresh();
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Dev Menu Storey Row API
    // ------------------------------------------------------------
    export {
        Na__FpStoreyRow__Build,
        Na__FpStoreyRow__Refresh
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
