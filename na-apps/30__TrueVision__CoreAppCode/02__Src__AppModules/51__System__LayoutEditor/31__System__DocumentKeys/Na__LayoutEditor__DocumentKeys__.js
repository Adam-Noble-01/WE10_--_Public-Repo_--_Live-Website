// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - DOCUMENT KEYS
// =============================================================================
//
// FILE       : Na__LayoutEditor__DocumentKeys__.js
// NAMESPACE  : Na__LeDocKeys
// MODULE     : Layout Editor - Document Keys
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The document tabs' own keyboard - Project Specification, Drawing Register, Statements - heard before any other key in the app
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - TWO TOOL SETS THAT SHARE NOTHING. A drawing tab is a canvas, where a bare
//   letter picks a tool: R a rectangle, T text, L a line. A document tab is
//   somewhere to write, where a bare letter is a letter. So the documents have
//   a keyboard of their own, with its own key map
//   (Na__Hotkeys__DocumentTabs__.json), live only while one of
//   them is on screen - the document key scope (Na__AppUtils__KeyScope__).
// - WHAT WENT WRONG WITHOUT IT. The drawing tools' keys already stood down on
//   a document tab, but the 3D Model tab's did not: R typed into a statement
//   reset a camera nobody could see and never reached the page, and so did B,
//   T, Y and the digits. And Ctrl+S on the Statements tab saved the SHEETS -
//   the editor's one save key knew nothing of the statement being written.
// - IT GOES FIRST. One listener on the window in the capture phase, added once
//   when the editor initialises, so it hears a key before any field, any page
//   and any other keyboard in the app. A key it takes is taken outright
//   (stopImmediatePropagation): nothing else anywhere acts on it.
// - EACH DOCUMENT ANSWERS FOR ITSELF. A tab registers the actions it has an
//   answer for (Register). A key is matched against the key map and handed to
//   whichever registered document is showing. A document with no answer for a
//   binding leaves the key alone and it goes on as it would have - which is
//   how Ctrl+S on the Project Specification and the Drawing Register still
//   reaches the editor's own save. An answer may return false to decline, and
//   the key goes on then too.
// - IT NEVER EATS TYPING. A key that would type a character - a bare letter,
//   digit or symbol, with no Ctrl, Alt or Meta - is never acted on while the
//   focus is in something that takes text, whatever the key map says. That is
//   the fault this keyboard was built to end, and the rule stops a future
//   binding from bringing it back.
// - A HELD KEY ACTS ONCE. Saving and switching a view are one-shot. A repeat
//   is still taken, so the browser does not act on it either - a held Ctrl+S
//   would otherwise open the browser's Save Page dialog on the second beat.
// - META IS CTRL ON A MAC when the key map says so (Setup__MetaIsCtrl), which
//   is how the Statements tab's own keys have always behaved.
//
// INTEGRATION:
// - Na__LayoutEditor__ModeController__ waits on Ready with the editor's other
//   configs, calls Initialize once, and answers the key scope from the tab on
//   screen (Na__KeyScope__Follow).
// - Na__LayoutEditor__Statement__Page__ registers Save (Ctrl+S), the raw
//   markdown (Ctrl+/) and the Lucida Console page (Ctrl+.).
// - Na__LayoutEditor__Register__Editor__ registers Save (Ctrl+S): the
//   revision notes, to R2 and the project file.
// - The Project Specification registers nothing: its Ctrl+S goes on to the
//   editor's save, which syncs it, and its other keys belong to single
//   controls on its page (the key map's PageKeys block lists them).
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026, v2.110.0)
// - ValeVision    : not yet ported - it has no Statements tab yet, but the key
//                   scope and this keyboard fit its Layout Editor as they are.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.1.0
// - The key map file is renamed Na__Hotkeys__DocumentTabs__.json (it was
//   Na__LayoutEditor__DocumentKeys__Config__.json): one of the app's three
//   hotkey files, each named for the kind of tab it serves.
//
// 21-Sep-2026 - Version 1.0.1
// - Documentation only: the Drawing Register now registers Doc__Save.
//
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation: the key map and its fallback, the registry of
//   documents, the matching, the typing rule, and the capture listener.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Which Keyboard Is Live, and Whether the Focus Takes Typing
    // ------------------------------------------------------------
    // @delegate: ../../03__AppUtils/Na__AppUtils__KeyScope__.js
    // ------------------------------------------------------------
    import { Na__KeyScope__DOCUMENT, Na__KeyScope__Is, Na__KeyScope__IsTypingTarget } from '../../03__AppUtils/Na__AppUtils__KeyScope__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Where the Key Map Is
    // ------------------------------------------------------------
    const Na__LeDocKeys__ConfigUrl = new URL('./Na__Hotkeys__DocumentTabs__.json', import.meta.url);
    const Na__LeDocKeys__PREFIX    = 'LayoutEditor__DocumentKeys__';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Modifiers a Binding May Name, and How a Binding May Match Them
    // ------------------------------------------------------------
    const Na__LeDocKeys__MODIFIERS       = Object.freeze([ 'Ctrl', 'Shift', 'Alt', 'Meta' ]);
    const Na__LeDocKeys__MATCH_EXACT     = 'Exact';            // <-- The named modifiers and no others
    const Na__LeDocKeys__MATCH_SHIFT_OPT = 'ShiftOptional';    // <-- Exact, with Shift forgiven: / and ? are one key
    const Na__LeDocKeys__MATCH_ANY       = 'Any';              // <-- Modifiers ignored
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Key Map Built In (mirrors the shipped JSON)
    // ------------------------------------------------------------
    // Only what ships switched on. A key map that fails to load still leaves
    // the Statements tab saving on Ctrl+S rather than handing the key back to
    // the sheets.
    // ------------------------------------------------------------
    const Na__LeDocKeys__FALLBACK = Object.freeze({
        metaIsCtrl : true,
        list       : Object.freeze([
            Object.freeze({ Id : 'Doc__Save',         Action : 'Doc__Save',         Enabled : true, Keys : [ 's', 'S' ], Modifiers : [ 'Ctrl' ], ModifierMatch : 'Exact' }),
            Object.freeze({ Id : 'Doc__ToggleSource', Action : 'Doc__ToggleSource', Enabled : true, Keys : [ '/', '?' ], Modifiers : [ 'Ctrl' ], ModifierMatch : 'ShiftOptional' }),
            Object.freeze({ Id : 'Doc__ToggleMono',   Action : 'Doc__ToggleMono',   Enabled : true, Keys : [ '.', '>' ], Modifiers : [ 'Ctrl' ], ModifierMatch : 'ShiftOptional' })
        ])
    });
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Key Map, the Registered Documents and the Listener
    // ------------------------------------------------------------
    let   Na__LeDocKeys__Config    = null;
    let   Na__LeDocKeys__Loading   = null;
    let   Na__LeDocKeys__Listening = false;
    const Na__LeDocKeys__Documents = new Map();    // <-- id -> { isShowing(), actions : { Action : handler(event, binding) } }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Key Map
// -----------------------------------------------------------------------------

    // FUNCTION | Fetch the Key Map Once
    // ------------------------------------------------------------
    // Never rejects. A missing or unreadable file leaves the built-in bindings
    // in force, so a document's keys still work and the editor still opens.
    // ------------------------------------------------------------
    function Na__LeDocKeys__Ready() {
        if (!Na__LeDocKeys__Loading) {
            Na__LeDocKeys__Loading = (async () => {
                try {
                    const response = await fetch(Na__LeDocKeys__ConfigUrl, { cache : 'no-store' });
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    Na__LeDocKeys__Config = await response.json();
                } catch (error) {
                    console.warn('[TrueVision3D LayoutEditor] Document key map unavailable - the built-in bindings are used.', error);
                    Na__LeDocKeys__Config = null;
                }
                return Na__LeDocKeys__Config;
            })();
        }
        return Na__LeDocKeys__Loading;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Value From a Block of the Key Map
    // ------------------------------------------------------------
    function Na__LeDocKeys__Value(block, name, fallback) {
        const section = Na__LeDocKeys__Config ? Na__LeDocKeys__Config[Na__LeDocKeys__PREFIX + block] : null;
        const value   = section ? section[block + '__' + name] : undefined;
        return (value === undefined || value === null) ? fallback : value;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Bindings, and Whether Command Counts as Ctrl
    // ------------------------------------------------------------
    function Na__LeDocKeys__GetBindings() {
        const list = Na__LeDocKeys__Value('Bindings', 'List', null);
        return Array.isArray(list) ? list : Na__LeDocKeys__FALLBACK.list;
    }
    function Na__LeDocKeys__MetaIsCtrl() {
        return Na__LeDocKeys__Value('Setup', 'MetaIsCtrl', Na__LeDocKeys__FALLBACK.metaIsCtrl) !== false;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Matching a Key Press
// -----------------------------------------------------------------------------

    // FUNCTION | The Modifiers Held, the Way a Binding Names Them
    // ------------------------------------------------------------
    // With MetaIsCtrl, Command is folded into Ctrl and Meta itself reads as
    // not held, so one binding answers on Windows and on a Mac alike.
    // ------------------------------------------------------------
    function Na__LeDocKeys__Held(event, metaIsCtrl) {
        const meta = !!event.metaKey;
        return {
            Ctrl  : !!event.ctrlKey || (metaIsCtrl && meta),
            Shift : !!event.shiftKey,
            Alt   : !!event.altKey,
            Meta  : metaIsCtrl ? false : meta
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Whether the Held Modifiers Satisfy One Binding
    // ------------------------------------------------------------
    // Exact is what stops a Ctrl binding firing on Ctrl+Alt - which is also
    // what AltGr reports on Windows, so a character typed with AltGr can never
    // be mistaken for a shortcut.
    // ------------------------------------------------------------
    function Na__LeDocKeys__ModifiersSatisfy(binding, held) {
        const mode = binding.ModifierMatch || Na__LeDocKeys__MATCH_EXACT;
        if (mode === Na__LeDocKeys__MATCH_ANY) return true;
        const named = Array.isArray(binding.Modifiers) ? binding.Modifiers : [];
        for (const name of Na__LeDocKeys__MODIFIERS) {
            if (name === 'Shift' && mode === Na__LeDocKeys__MATCH_SHIFT_OPT) continue;
            if (!!held[name] !== (named.indexOf(name) !== -1)) return false;
        }
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | The First Enabled Binding That Answers This Key (null when none does)
    // ------------------------------------------------------------
    function Na__LeDocKeys__Match(list, key, held) {
        if (!Array.isArray(list) || typeof key !== 'string' || !key) return null;
        for (const binding of list) {
            if (!binding || binding.Enabled === false || !binding.Action) continue;
            if (!Array.isArray(binding.Keys) || binding.Keys.indexOf(key) === -1) continue;
            if (!Na__LeDocKeys__ModifiersSatisfy(binding, held || {})) continue;
            return binding;
        }
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Would This Key Type a Character
    // ------------------------------------------------------------
    // One character long, and held with nothing that turns a key into a
    // command. Shift alone still types - it is how a capital is made.
    // ------------------------------------------------------------
    function Na__LeDocKeys__TypesCharacter(key, held) {
        return typeof key === 'string' && key.length === 1 && !held.Ctrl && !held.Alt && !held.Meta;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Documents
// -----------------------------------------------------------------------------

    // FUNCTION | A Document Tab Says Which Actions It Answers
    // ------------------------------------------------------------
    // spec: { isShowing() , actions : { Doc__Save : handler, ... } }. A handler
    // is called with (event, binding) and takes the key unless it returns
    // false. Registering the same id again replaces the earlier entry.
    // ------------------------------------------------------------
    function Na__LeDocKeys__Register(id, spec) {
        if (typeof id !== 'string' || !id || !spec || typeof spec.isShowing !== 'function') return false;
        const actions = {};
        for (const [ action, handler ] of Object.entries(spec.actions || {})) {
            if (typeof handler === 'function') actions[action] = handler;
        }
        Na__LeDocKeys__Documents.set(id, { isShowing : spec.isShowing, actions : actions });
        return true;
    }
    function Na__LeDocKeys__Unregister(id) {
        return Na__LeDocKeys__Documents.delete(id);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Registered Document on Screen (null when none is)
    // ------------------------------------------------------------
    function Na__LeDocKeys__Showing() {
        for (const entry of Na__LeDocKeys__Documents.values()) {
            try { if (entry.isShowing()) return entry; }
            catch (error) { /* a document that cannot say is taken as not showing */ }
        }
        return null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Listening
// -----------------------------------------------------------------------------

    // FUNCTION | A Key Went Down Anywhere in the App
    // ------------------------------------------------------------
    // Silent unless a document tab has the keyboard. A key that types a
    // character into a field is never looked at; a key no binding names, or
    // one the document on screen has no answer for, is left exactly as it
    // was. Only a key a document takes is stopped - outright, so neither the
    // browser nor any other keyboard in the app acts on it as well.
    // ------------------------------------------------------------
    function Na__LeDocKeys__OnKeyDown(event) {
        if (!Na__KeyScope__Is(Na__KeyScope__DOCUMENT)) return;                   // <-- A drawing, or the 3D model, has the keyboard
        if (event.defaultPrevented || event.isComposing) return;                 // <-- Already answered, or an input method is composing
        const key  = event.key;
        const held = Na__LeDocKeys__Held(event, Na__LeDocKeys__MetaIsCtrl());
        if (Na__LeDocKeys__TypesCharacter(key, held) && Na__KeyScope__IsTypingTarget(event.target)) return;   // <-- A letter typed is a letter
        const binding = Na__LeDocKeys__Match(Na__LeDocKeys__GetBindings(), key, held);
        if (!binding) return;
        const showing = Na__LeDocKeys__Showing();
        const handler = showing ? showing.actions[binding.Action] : null;
        if (typeof handler !== 'function') return;                               // <-- No answer here: the key goes on as it would have

        let answer = true;
        if (!event.repeat) {                                                     // <-- Held down: taken, but acted on once
            try { answer = handler(event, binding); }
            catch (error) { console.error('[TrueVision3D LayoutEditor] Document key ' + binding.Action + ' failed:', error); }
        }
        if (answer === false) return;                                            // <-- Declined: the key goes on
        event.preventDefault();
        event.stopImmediatePropagation();                                        // <-- The document's key, and nobody else's
    }
    // ------------------------------------------------------------


    // FUNCTION | Start Listening (once, for the life of the page)
    // ------------------------------------------------------------
    function Na__LeDocKeys__Initialize() {
        if (Na__LeDocKeys__Listening) return false;
        Na__LeDocKeys__Listening = true;
        window.addEventListener('keydown', Na__LeDocKeys__OnKeyDown, true);      // <-- Capture on the window: ahead of every field, page and keyboard in the app
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Binding Written Out for a Tooltip ("Ctrl+S"; '' when unbound)
    // ------------------------------------------------------------
    function Na__LeDocKeys__KeyLabel(action) {
        const binding = Na__LeDocKeys__GetBindings().find((entry) => entry && entry.Enabled !== false && entry.Action === action && Array.isArray(entry.Keys) && entry.Keys.length);
        if (!binding) return '';
        const named = Array.isArray(binding.Modifiers) ? binding.Modifiers : [];
        const parts = Na__LeDocKeys__MODIFIERS.filter((name) => named.indexOf(name) !== -1);
        const key   = String(binding.Keys[0]);
        parts.push(key.length === 1 ? key.toUpperCase() : key);
        return parts.join('+');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Document Keys
    // ------------------------------------------------------------
    export {
        Na__LeDocKeys__Ready,
        Na__LeDocKeys__Initialize,
        Na__LeDocKeys__Register,
        Na__LeDocKeys__Unregister,
        Na__LeDocKeys__GetBindings,
        Na__LeDocKeys__Match,
        Na__LeDocKeys__Held,
        Na__LeDocKeys__TypesCharacter,
        Na__LeDocKeys__OnKeyDown,
        Na__LeDocKeys__KeyLabel
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
