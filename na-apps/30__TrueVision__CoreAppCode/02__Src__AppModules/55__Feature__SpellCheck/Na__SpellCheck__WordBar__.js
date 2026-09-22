// =============================================================================
// TRUEVISION3D - SPELL CHECK - WORD BAR
// =============================================================================
//
// FILE       : Na__SpellCheck__WordBar__.js
// NAMESPACE  : Na__SpellBar
// MODULE     : Spell Check - Word Bar
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : One line under spell-checked boxes that follows the caret: Add the word under it to the dictionary, or say the dictionary already has it
// CREATED    : 22-Sep-2026
//
// DESCRIPTION:
// - WHY A BAR AND NOT A MENU. A right click on a word the browser has
//   underlined opens the BROWSER'S menu, with its suggestions - the most
//   useful thing a spell check does - and a page cannot add a row to it, nor
//   show its own menu without losing those suggestions. So the right click
//   stays the browser's, and the practice's dictionary is one line under the
//   box instead. A right click on a word moves the caret into it, so the bar
//   is already naming that word when the menu is closed.
// - WHAT IT SAYS, for the word the caret is in (or a single word selected):
//     not in the dictionary    [Add "Kingspam" to Dictionary]
//     added from the app       "Velux" is in the dictionary: Added in TrueVision
//                              [Remove "Velux" from Dictionary]
//     in a hand-made group     "Kingspan" is in the dictionary: Manufacturers and Brands
//     part of an entry         "Farrow" is accepted as part of "Farrow & Ball" (...)
//     no word                  nothing - the line keeps its height, so the box
//                              does not jump as the caret moves
//   Remove is offered only for the app's own words: a word in a group Adam
//   made is taken out of the file by hand, never by a stray click.
// - WHERE IT CANNOT WRITE - no ProjectVision local server, or one started
//   before the route existed - the button stays, greyed, and its hover text
//   says which.
// - A press on the button never takes the focus from the box, so the caret,
//   and the edit the box belongs to, stay where they were.
//
// INTEGRATION:
// - Built through Na__SpellCheck__.js (Na__SpellCheck__WordBar). Listens for
//   the boxes' CARET_EVENT and the dictionary's CHANGED_EVENT.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (22-Sep-2026)
// - ValeVision    : not yet ported. Nothing here is app-specific.
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

    // MODULE IMPORTS | The Dictionary and the Box's Caret Event
    // ------------------------------------------------------------
    import {
        Na__SpellCheck__CHANGED_EVENT,
        Na__SpellCheck__Ready,
        Na__SpellCheck__IsLoaded,
        Na__SpellCheck__IsWritable,
        Na__SpellCheck__ReadOnlyMessage,
        Na__SpellCheck__Label,
        Na__SpellCheck__EntryFor,
        Na__SpellCheck__Add,
        Na__SpellCheck__Remove
    } from './Na__SpellCheck__Dictionary__.js';
    import { Na__SpellField__CARET_EVENT } from './Na__SpellCheck__Field__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Group the App Writes Into (the server's APP_GROUP_KEY)
    // ------------------------------------------------------------
    const Na__SpellBar__APP_GROUP = 'AddedInTheApp';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Bar
// -----------------------------------------------------------------------------

    // FUNCTION | What the Bar Says About a Word: { action, word, note, title, disabled }
    // ------------------------------------------------------------
    // action: 'add', 'remove' or null. A pure answer from the dictionary's
    // state, so it can be asked without a page.
    // ------------------------------------------------------------
    function Na__SpellBar__Describe(info) {
        const L = Na__SpellCheck__Label;
        if (!Na__SpellCheck__IsLoaded()) return { action : null, word : null, note : L('Loading', 'Reading the spelling dictionary...'), title : '', disabled : true };
        if (!info || !info.word) return { action : null, word : null, note : '', title : '', disabled : true };
        const word        = info.word;
        const entry       = Na__SpellCheck__EntryFor(word);
        const readOnlyWhy = Na__SpellCheck__ReadOnlyMessage();                   // <-- The dictionary's own sentence: a restart, a broken file, or no local server
        if (!entry) {
            return { action : 'add', word : word, note : '', title : Na__SpellCheck__IsWritable() ? L('AddWordTitle', 'Add {word} to the TrueVision spelling dictionary.', { word : word }) : readOnlyWhy, disabled : !Na__SpellCheck__IsWritable() };
        }
        if (!entry.whole) {
            return { action : null, word : word, note : L('InEntry', '"{word}" is accepted as part of "{entry}" ({group})', { word : word, entry : entry.entry, group : entry.groupTitle }), title : '', disabled : true };
        }
        const note = L('InGroup', '"{word}" is in the dictionary: {group}', { word : entry.entry, group : entry.groupTitle });
        if (entry.groupKey !== Na__SpellBar__APP_GROUP) return { action : null, word : word, note : note, title : '', disabled : true };
        return { action : 'remove', word : entry.entry, note : note, title : Na__SpellCheck__IsWritable() ? L('RemoveTitle', 'Take {word} out of the TrueVision spelling dictionary.', { word : entry.entry }) : readOnlyWhy, disabled : !Na__SpellCheck__IsWritable() };
    }
    // ------------------------------------------------------------


    // FUNCTION | Make a Word Bar for One or More Boxes
    // ------------------------------------------------------------
    // options: { fields : [box handle, ...], showToast(message, isError) }.
    // Returns { element, refresh(), destroy() }. The bar follows whichever of
    // its boxes last moved its caret.
    // ------------------------------------------------------------
    function Na__SpellBar__Create(options) {
        const opts   = options || {};
        const fields = (opts.fields || []).filter(Boolean);
        const bar    = document.createElement('div');
        bar.className = 'na-spellcheck-bar';
        bar.setAttribute('aria-live', 'polite');
        const note   = document.createElement('span');
        note.className = 'na-spellcheck-bar__note';
        const button = document.createElement('button');
        button.type      = 'button';
        button.className = 'na-spellcheck-bar__button';
        button.hidden    = true;
        bar.appendChild(note);
        bar.appendChild(button);

        const state = { field : fields[0] || null, shown : null, busy : false, listeners : [] };
        const toast = (message, isError) => { if (typeof opts.showToast === 'function') opts.showToast(message, isError === true); };

        const refresh = () => {
            const info = state.field ? state.field.wordAtCaret() : null;
            const said = Na__SpellBar__Describe(info);
            const L    = Na__SpellCheck__Label;
            state.shown = said;
            note.textContent = said.note;
            note.hidden      = said.note === '';
            button.hidden    = !said.action;
            if (said.action) {
                button.textContent = said.action === 'add' ? L('AddWord', 'Add "{word}" to Dictionary', { word : said.word }) : L('RemoveWord', 'Remove "{word}" from Dictionary', { word : said.word });
                button.title       = said.title;
                button.disabled    = said.disabled || state.busy;
            }
        };

        // A PRESS NEVER TAKES THE FOCUS FROM THE BOX: the caret and the edit
        // stay put, and the box's owner never reads the press as leaving it.
        const keep = (event) => event.preventDefault();
        button.addEventListener('pointerdown', keep);
        button.addEventListener('mousedown', keep);
        button.addEventListener('click', async () => {
            const said = state.shown;
            if (!said || !said.action || button.disabled) return;
            const L = Na__SpellCheck__Label;
            state.busy = true;
            refresh();
            const result = said.action === 'add' ? await Na__SpellCheck__Add(said.word) : await Na__SpellCheck__Remove(said.word);
            state.busy = false;
            if (!result.ok) toast(L('Failed', 'The dictionary was not changed: {reason}', { reason : result.error }), true);
            else if (said.action === 'add') toast(result.changed ? L('Added', 'Added "{word}" to the TrueVision dictionary.', { word : result.word }) : L('AlreadyThere', '"{word}" is already in the TrueVision dictionary.', { word : result.word }), false);
            else toast(result.changed ? L('Removed', 'Took "{word}" out of the TrueVision dictionary.', { word : result.word }) : L('NotRemoved', '"{word}" was not in the dictionary on its own, so nothing was taken out.', { word : result.word }), false);
            refresh();
        });

        const onCaret = (event) => {
            const field = event.detail ? event.detail.field : null;
            if (field && fields.indexOf(field) !== -1) state.field = field;
            refresh();
        };
        fields.forEach((field) => { field.element.addEventListener(Na__SpellField__CARET_EVENT, onCaret); state.listeners.push([ field.element, Na__SpellField__CARET_EVENT, onCaret ]); });
        window.addEventListener(Na__SpellCheck__CHANGED_EVENT, refresh);
        state.listeners.push([ window, Na__SpellCheck__CHANGED_EVENT, refresh ]);
        Na__SpellCheck__Ready().then(refresh);
        refresh();

        return {
            element : bar,
            refresh : refresh,
            destroy : () => { state.listeners.forEach((entry) => entry[0].removeEventListener(entry[1], entry[2])); state.listeners = []; }
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Spell Check Word Bar API
    // ------------------------------------------------------------
    export {
        Na__SpellBar__Describe,
        Na__SpellBar__Create
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
