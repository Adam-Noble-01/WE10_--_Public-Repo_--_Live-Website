// =============================================================================
// TRUEVISION3D - APP UTILS - KEY SCOPE
// =============================================================================
//
// FILE       : Na__AppUtils__KeyScope__.js
// NAMESPACE  : Na__KeyScope
// MODULE     : App Utils - Key Scope
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Say which of the app's three keyboards is live: the 3D model's, a drawing's or a document's
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - THREE TOOL SETS, THREE KEYBOARDS, ONE LIVE AT A TIME.
//     model     The 3D Model tab. R resets the view, B, T and Y pick Orbit,
//               Walk and Fly, 1-9 and Page Up / Page Down go to presentation
//               scenes (Na__Hotkeys__Manager, Na__Hotkeys__3dModelTab__.json).
//     sheet     A drawing tab. Bare letters pick the drawing tools - V, M, T,
//               R, L, D, E, A, B - K is Draft mode, and Page Up / Page Down
//               turn the drawings (Na__LayoutEditor__SheetTools__Keyboard__,
//               Na__LayoutEditor__Controls__Pc__,
//               Na__Hotkeys__DrawingTabs__.json).
//     document  The Project Specification, the Drawing Register and the
//               Statements. A bare letter is a letter; the documents' own keys
//               are chords (Na__LayoutEditor__DocumentKeys__,
//               Na__Hotkeys__DocumentTabs__.json).
// - ONE HOTKEY FILE PER KIND OF TAB, each named for it: Na__Hotkeys__3dModelTab__
//   (02__AppData), Na__Hotkeys__DrawingTabs__ (51__System__LayoutEditor/
//   03__Core__Config) and Na__Hotkeys__DocumentTabs__ (51__System__LayoutEditor/
//   31__System__DocumentKeys). A key belongs in the file of the tab it works on.
// - WHY THIS EXISTS. The 3D Model tab's keys were listened for on the window
//   for the whole session and asked nothing about which tab was up, so they
//   went on answering under the drawings and the documents. R typed into a
//   statement reset a camera nobody could see and never reached the page, and
//   B, T, Y and the digits went the same way. T on a drawing picked the Text
//   tool AND put the hidden model into Walk mode. Every keyboard now asks which
//   scope is live before it acts.
// - THIS FILE IS A LEAF ON PURPOSE. The 3D hotkeys live under
//   10__NavigationAndCameras and never import the Layout Editor, and the Layout
//   Editor's mode controller is the only thing that knows which tab is up.
//   Holding the question here, with no imports at all, lets both ask it
//   without either importing the other.
// - THE SCOPE IS READ, NEVER STORED. The mode controller hands over the one
//   function that answers it from what is on screen (Follow), and every key
//   asks afresh. There is no copy to fall out of step: a tab that fails half
//   way through opening, or a path nobody thought to route, cannot leave the
//   wrong keyboard live.
// - IsTypingTarget is the test the 3D hotkeys always made - a text box, a
//   text area or a list has the focus - with the one case it missed added:
//   anything contenteditable. The statement being written is one, and so is a
//   plan annotation label being edited on the 3D Model tab.
//
// INTEGRATION:
// - Na__LayoutEditor__ModeController__ is the ONE source. It hands its reader
//   to Follow when it initialises; until then, and in a build without the
//   Layout Editor, the scope is the 3D model's.
// - Na__Hotkeys__Manager acts only in the model scope, and
//   Na__LayoutEditor__DocumentKeys__ only in the document scope. The sheet's
//   own keyboard is attached only while a drawing tab is up, so it keeps to
//   the sheet scope already.
// - The drawing tabs' keys (Na__LayoutEditor__SheetTools__Keyboard__ and
//   Na__LayoutEditor__Controls__Pc__) ask ControlKeepsKey before they stand
//   down for a focused control.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026, v2.110.0)
// - ValeVision    : not yet ported. ValeVision's own hotkey handler and its
//                   Layout Editor have the same shape, so the same leaf fits.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.1.0
// - ControlKeepsKey: which keys a focused control uses itself. A tick box, a
//   list or a button keeps the focus after it is clicked, and the drawing
//   tabs' keyboard stood down for ANY focused control - so after ticking a box
//   or picking from a list, M, V, Escape and Delete went nowhere until
//   something else was clicked, and a list took the letter for itself (M chose
//   "Medium" in the Raster list). Only the keys a control really uses stay
//   with it now.
// - The three hotkey files it names are renamed for the tab each serves:
//   Na__Hotkeys__3dModelTab__.json, Na__Hotkeys__DrawingTabs__.json and
//   Na__Hotkeys__DocumentTabs__.json.
//
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation: the three scopes, the reader the scope follows,
//   the questions and the typing test.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Three Scopes
    // ------------------------------------------------------------
    const Na__KeyScope__MODEL    = 'model';       // <-- The 3D Model tab: the view's own keys
    const Na__KeyScope__SHEET    = 'sheet';       // <-- A drawing tab: the drawing tools' keys
    const Na__KeyScope__DOCUMENT = 'document';    // <-- A document tab: typing, and the documents' own keys
    const Na__KeyScope__ALL      = Object.freeze([ Na__KeyScope__MODEL, Na__KeyScope__SHEET, Na__KeyScope__DOCUMENT ]);
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Function That Answers Which Scope Is Live (none: the 3D model's)
    // ------------------------------------------------------------
    let Na__KeyScope__Reader = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Following and Reading the Scope
// -----------------------------------------------------------------------------

    // FUNCTION | Hand Over the One Function That Answers the Scope (the mode controller's)
    // ------------------------------------------------------------
    // Returns true when it was taken. Anything but a function is refused and
    // the reader already held is kept.
    // ------------------------------------------------------------
    function Na__KeyScope__Follow(reader) {
        if (typeof reader !== 'function') return false;
        Na__KeyScope__Reader = reader;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Keyboard Is Live
    // ------------------------------------------------------------
    // Asked afresh on every key. A reader that fails, or answers with a name
    // that is not one of the three, gives the 3D model's scope: the keyboard
    // the app had before the Layout Editor existed, never a deaf one.
    // ------------------------------------------------------------
    function Na__KeyScope__Get() {
        if (!Na__KeyScope__Reader) return Na__KeyScope__MODEL;
        let scope;
        try { scope = Na__KeyScope__Reader(); } catch (error) { return Na__KeyScope__MODEL; }
        return Na__KeyScope__ALL.indexOf(scope) === -1 ? Na__KeyScope__MODEL : scope;
    }
    function Na__KeyScope__Is(scope) {
        return Na__KeyScope__Get() === scope;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Typing Test
// -----------------------------------------------------------------------------

    // FUNCTION | Does This Element Take Typed Text
    // ------------------------------------------------------------
    // A text box, a text area, a list - or anything contenteditable, which is
    // what the 3D hotkeys' own test left out. A bare key must never be taken
    // from any of them: the letter is the person's, not a shortcut's.
    // ------------------------------------------------------------
    function Na__KeyScope__IsTypingTarget(element) {
        if (!element) return false;
        if (element.isContentEditable === true) return true;
        const tag = String(element.tagName || '').toUpperCase();
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    }
    // ------------------------------------------------------------


    // MODULE CONSTANTS | The Keys a Focused Control Uses Itself
    // ------------------------------------------------------------
    const Na__KeyScope__PRESS_KEYS    = Object.freeze([ ' ', 'Enter' ]);                                 // <-- Tick it, choose it, press it
    const Na__KeyScope__STEP_KEYS     = Object.freeze([ 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown' ]);   // <-- Step through a list, a slider or a figure
    const Na__KeyScope__NUMBER_KEYS   = Object.freeze([ 'Backspace', 'Delete', 'Escape' ]);            // <-- Editing a figure being typed
    const Na__KeyScope__NUMBER_CHARS  = '0123456789.,-+eE';                                              // <-- What a number box can hold
    const Na__KeyScope__NO_TEXT_TYPES = Object.freeze([ 'checkbox', 'radio', 'range', 'color', 'button', 'submit', 'reset', 'file', 'image', 'number' ]);
    // ------------------------------------------------------------


    // FUNCTION | Does a Focused Control Use This Key Itself
    // ------------------------------------------------------------
    // A TICK BOX, A LIST OR A BUTTON KEEPS THE FOCUS AFTER IT IS CLICKED, and a
    // keyboard that stood down for any focused control stood down for every
    // bare key: after ticking a box or picking from a list, M, V, Escape and
    // Delete all went nowhere until something else was clicked - and a list
    // took the letter for itself, so M chose "Medium" in the Raster list. A
    // control needs only a handful of keys, and only those stay with it:
    //   a text box, a text area, anything contenteditable   every key
    //   a number box   its figures (0-9 . , - + e), the arrows, Home, End,
    //                  Page Up / Page Down, Backspace, Delete, Escape, Space
    //                  and Enter
    //   a list, a radio button, a slider   the arrows, Home, End, Page Up,
    //                  Page Down, Space and Enter
    //   a tick box, a button, a colour or file picker, a link   Space, Enter
    // Every other key - a tool letter, Escape off a list, an F key - is the
    // live keyboard's to answer. With nothing focused, nothing is kept.
    // Chords are not asked about here: each keyboard decides its own.
    // ------------------------------------------------------------
    function Na__KeyScope__ControlKeepsKey(element, key) {
        if (!element || typeof key !== 'string') return false;
        if (element.isContentEditable === true) return true;
        const tag   = String(element.tagName || '').toUpperCase();
        const press = Na__KeyScope__PRESS_KEYS.indexOf(key) !== -1;
        const step  = Na__KeyScope__STEP_KEYS.indexOf(key) !== -1;
        if (tag === 'TEXTAREA') return true;
        if (tag === 'SELECT')   return press || step;
        if (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY') return press;
        if (tag !== 'INPUT')    return false;                                   // <-- The stage, the page, a panel: nothing to keep
        const type = String(element.type || 'text').toLowerCase();
        if (type === 'number') return press || step || Na__KeyScope__NUMBER_KEYS.indexOf(key) !== -1 || (key.length === 1 && Na__KeyScope__NUMBER_CHARS.indexOf(key) !== -1);
        if (type === 'radio' || type === 'range') return press || step;
        if (Na__KeyScope__NO_TEXT_TYPES.indexOf(type) !== -1) return press;    // <-- A tick box, a colour or a file picker, the button kinds
        return true;                                                            // <-- Every other input takes typed text
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | App Utils Key Scope
    // ------------------------------------------------------------
    export {
        Na__KeyScope__MODEL,
        Na__KeyScope__SHEET,
        Na__KeyScope__DOCUMENT,
        Na__KeyScope__Follow,
        Na__KeyScope__Get,
        Na__KeyScope__Is,
        Na__KeyScope__IsTypingTarget,
        Na__KeyScope__ControlKeepsKey
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
