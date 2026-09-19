// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - DRAWING REGISTER REVISION NOTES
// =============================================================================
//
// FILE       : Na__LayoutEditor__Register__Notes__.js
// NAMESPACE  : Na__LeRegNotes
// MODULE     : Layout Editor - Drawing Register Revision Notes
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Keep revision history and warning fields inside each expanded row
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - Each expanded drawing row holds its own revision history: code, date,
//   notes and an optional yellow or red warning for the detailed report.
// - Typing writes only the browser draft. Save Locally / Save to R2 on the
//   register bar is what publishes the notes.
//
// INTEGRATION:
// - Built by the register editor when a row is expanded. Reads and writes
//   through Na__LayoutEditor__Register__Data__.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : n/a (TrueVision3D first, 19-Sep-2026)
// - Back-port     : offer to ValeVision3D with the register tab.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Sep-2026 - Version 1.0.1
// - Headers, region breakdown, function wrapping and the export block brought
//   in line with the Layout Editor coding conventions. No behaviour change.
//
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Register Data and Sheet Fields
    // ------------------------------------------------------------
    import { Na__LeReg__GetRevisions, Na__LeReg__SetRevisions, Na__LeReg__Clone } from './Na__LayoutEditor__Register__Data__.js';
    import { Na__LeModel__GetFields } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Revision History Fields
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Label a Control Inside a Revision Entry
    // ------------------------------------------------------------
    function Na__LeRegNotes__Field(parent, title, element) {
        const label = document.createElement('label');
        label.className = 'na-le-register__note-field';
        const span = document.createElement('span');
        span.textContent = title;
        label.append(span, element);
        parent.appendChild(label);
        return element;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Revision Entry Card
    // ------------------------------------------------------------
    function Na__LeRegNotes__Entry(list, note, index, save, render) {
        const entry = document.createElement('section');
        entry.className = 'na-le-register__note';

        const top = document.createElement('div');
        top.className = 'na-le-register__note-top';
        [['Revision', 'Code', 'text'], ['Date', 'Date', 'date']].forEach(([label, key, type]) => {
            const input = document.createElement('input');
            input.type  = type;
            input.value = note['DrawingRegister__Revision__' + key] || '';
            input.addEventListener('input', () => {
                note['DrawingRegister__Revision__' + key] = input.value;
                save();
            });
            Na__LeRegNotes__Field(top, label, input);
        });

        const level = document.createElement('select');
        [['none', 'No warning'], ['yellow', 'Yellow — awaiting confirmation'], ['red', 'Red — unresolved / do not rely on']].forEach(([value, label]) => {
            const option = document.createElement('option');
            option.value       = value;
            option.textContent = label;
            level.appendChild(option);
        });
        level.value = note.DrawingRegister__Revision__Warning || 'none';
        Na__LeRegNotes__Field(top, 'Version warning', level);

        const remove = document.createElement('button');
        remove.type        = 'button';
        remove.textContent = 'Remove entry';
        remove.addEventListener('click', () => {
            list.splice(index, 1);
            save();
            render();
        });
        top.appendChild(remove);
        entry.appendChild(top);

        const text = document.createElement('textarea');
        text.rows        = 4;
        text.value       = note.DrawingRegister__Revision__Notes || '';
        text.placeholder = 'Describe the changes made in this revision…';
        text.addEventListener('input', () => {
            note.DrawingRegister__Revision__Notes = text.value;
            save();
        });
        Na__LeRegNotes__Field(entry, 'Changes', text);

        const warning = document.createElement('div');
        warning.hidden = level.value === 'none';
        const warningText = document.createElement('textarea');
        warningText.rows        = 2;
        warningText.value       = note.DrawingRegister__Revision__WarningText || '';
        warningText.placeholder = 'Explain what needs confirmation or client feedback…';
        warningText.addEventListener('input', () => {
            note.DrawingRegister__Revision__WarningText = warningText.value;
            save();
        });
        Na__LeRegNotes__Field(warning, 'Warning shown in the detailed report', warningText);
        level.addEventListener('change', () => {
            note.DrawingRegister__Revision__Warning = level.value;
            entry.dataset.warning = level.value;
            warning.hidden = level.value === 'none';
            save();
        });
        entry.dataset.warning = level.value;
        entry.appendChild(warning);
        return entry;
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Expandable Revision History for One Drawing
    // ------------------------------------------------------------
    function Na__LeRegNotes__Build(container, sheet) {
        const list  = Na__LeReg__Clone(Na__LeReg__GetRevisions(sheet.Sheet__Id));
        const title = document.createElement('h3');
        title.textContent = 'Revision history';
        const hint = document.createElement('p');
        hint.textContent = 'Notes are kept in this browser as you type. Save Locally writes the project file; Save to R2 publishes them.';
        const entries = document.createElement('div');
        const save    = () => Na__LeReg__SetRevisions(sheet.Sheet__Id, list);
        const render  = () => {
            entries.replaceChildren();
            list.forEach((note, index) => {
                entries.appendChild(Na__LeRegNotes__Entry(list, note, index, save, render));
            });
        };
        const add = document.createElement('button');
        add.type        = 'button';
        add.textContent = '+ Add revision entry';
        add.addEventListener('click', () => {
            list.push({
                DrawingRegister__Revision__Id          : 'Revision_' + crypto.randomUUID(),
                DrawingRegister__Revision__Code        : Na__LeModel__GetFields(sheet).Revision,
                DrawingRegister__Revision__Date        : new Date().toISOString().slice(0, 10),
                DrawingRegister__Revision__Notes       : '',
                DrawingRegister__Revision__Warning     : 'none',
                DrawingRegister__Revision__WarningText : ''
            });
            save();
            render();
        });
        container.append(title, hint, entries, add);
        render();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Drawing Register Notes API
    // ------------------------------------------------------------
    export {
        Na__LeRegNotes__Build
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
