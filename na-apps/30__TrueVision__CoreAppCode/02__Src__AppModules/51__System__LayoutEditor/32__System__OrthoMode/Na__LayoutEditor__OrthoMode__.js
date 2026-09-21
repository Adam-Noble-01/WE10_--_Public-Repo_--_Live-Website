// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - ORTHO MODE
// =============================================================================
//
// FILE       : Na__LayoutEditor__OrthoMode__.js
// NAMESPACE  : Na__LeOrtho
// MODULE     : Layout Editor - Ortho Mode
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : AutoCAD's Ortho mode on AutoCAD's key: F8 holds every new line, dimension and move square to the paper
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - WHAT ORTHO DOES. While it is on, a point picked from a point before it
//   lands on the horizontal or the vertical through that point, whichever
//   the cursor has travelled further along, so nothing can be drawn at an
//   angle. The first point of anything is free - there is nothing before it
//   to be square to - and the cursor itself is never moved: only the point
//   the click will place, and the rubber band that shows it, are held.
// - IT IS A LATCHED SHIFT. Holding Shift already held the axis in every place
//   Ortho reaches, so Ortho is exactly that constraint left switched on, and
//   the rule is AutoCAD's: the axis is held when ORTHO XOR SHIFT (the leaf,
//   Na__LayoutEditor__OrthoMode__State__, owns it). Holding Shift while Ortho
//   is on frees the cursor until Shift comes up - AutoCAD's Shift temporary
//   override - which is how one angled line is drawn in the middle of a run
//   of square ones without switching anything.
// - WHERE IT REACHES - everywhere a held Shift meant "hold the nearer axis":
//     * the Draw tool's next vertex, and the Area tool's corners drawn with it;
//     * the Dimension tool's line: Ortho makes a new dimension horizontal or
//       vertical, measuring x or y whatever its two points are, as Shift did
//       (AutoCAD's DIMLINEAR); Shift with Ortho on gives an aligned one. Its
//       two measured points are never bent to an axis, by Shift or by Ortho,
//       because an ortho dimension measures one axis whatever its span;
//     * dragging a vertex of a vector or a measured end of a dimension;
//     * moving anything whole - text, a vector, a dimension, a leader, a
//       group, a multi-item selection or a viewport frame.
//   It leaves alone what Shift means something else to: Rectangle (Shift
//   squares it), a text rotate grip (Shift steps it), a viewport corner (Shift
//   scales a 3D picture) and Shift-click on an edge (inserts a vertex). A
//   rectangle is square to the paper already - AutoCAD's RECTANG switches
//   Ortho off for its own duration, because a held corner would collapse the
//   rectangle to a line. Placing a NEW leader is left free too, where Shift
//   has never meant anything; AutoCAD holds its leader segments, but these
//   leaders are curves to a note or a bubble.
// - WHAT BEATS IT. An arrow key lock names the axis outright and wins, as it
//   always has. A typed length (the Measurements box, AutoCAD's direct
//   distance entry) runs along the held direction, and a length typed for a
//   move is exact. A snap supplies the coordinate ALONG the held axis - it
//   never pulls the point off it - which is the rule Shift already worked to
//   here, so "Ortho on" really does mean no line can be drawn at an angle.
//   AutoCAD's help says "Ortho is ignored when you enter coordinates or
//   specify an object snap"; that difference is deliberate and is written up
//   in the config's research note.
// - HOW IT IS SWITCHED. F8 (Ortho__Toggle in the key map), or the Ortho
//   button on the toolbar, which is lit while it is on - AutoCAD's ORTHO
//   button on its status bar. Every switch is echoed as AutoCAD echoes it on
//   its command line, "<Ortho on>" / "<Ortho off>", on the line above the
//   Measurements box (the sheet's nearest thing to a command line), and in
//   the console. F8 pressed mid-line re-aims the rubber band at once.
// - REMEMBERED IN THIS BROWSER, like Snap (F3). AutoCAD saves ORTHOMODE in
//   the drawing; here it is a way of drawing rather than part of a sheet, so
//   nothing is written to a sheet, the browser draft or R2, and the PDF and
//   the web viewer never see it.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__Keyboard__ runs Na__LeOrtho__Toggle on the
//   Ortho__Toggle binding (F8) and redraws whatever is being placed or
//   dragged; Na__LayoutEditor__Toolbar__ has the Ortho button, lit while Ortho
//   is on, and re-syncs on Na__LeOrtho__CHANGED_EVENT.
// - The flag and the rule live in Na__LayoutEditor__OrthoMode__State__ (a
//   leaf), which the tools and the drag read without importing this module.
// - Na__LayoutEditor__Measurements__ shows the echo (Na__LeMeasure__Say).
// // @delegate: ./Na__LayoutEditor__OrthoMode__State__.js
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
// - Initial implementation: Set and Toggle, the remembered flag, the Shift
//   override setting, the echo, the config and every label.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Flag, and the Box That Echoes It
    // ------------------------------------------------------------
    import {
        Na__LeOrtho__CHANGED_EVENT,
        Na__LeOrtho__IsOn,
        Na__LeOrtho__AssignOn,
        Na__LeOrtho__Store,
        Na__LeOrtho__AssignShiftOverride
    } from './Na__LayoutEditor__OrthoMode__State__.js';
    import { Na__LeMeasure__Say } from '../30__System__SheetTools/Na__LayoutEditor__Measurements__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Where the Config Is
    // ------------------------------------------------------------
    const Na__LeOrtho__ConfigUrl = new URL('./Na__LayoutEditor__OrthoMode__Config__.json', import.meta.url);
    const Na__LeOrtho__PREFIX    = 'LayoutEditor__OrthoMode__';
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Config
    // ------------------------------------------------------------
    let Na__LeOrtho__Config  = null;
    let Na__LeOrtho__Loading = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Config
// -----------------------------------------------------------------------------

    // FUNCTION | One Block of the Config, a Value From It, and a Label
    // ------------------------------------------------------------
    function Na__LeOrtho__Block(name) {
        const block = Na__LeOrtho__Config ? Na__LeOrtho__Config[Na__LeOrtho__PREFIX + name] : null;
        return (block && typeof block === 'object' && !Array.isArray(block)) ? block : {};
    }
    function Na__LeOrtho__Value(block, key, fallback) {
        const value = Na__LeOrtho__Block(block)[key];
        if (typeof fallback === 'boolean') return (typeof value === 'boolean') ? value : fallback;
        return (typeof value === 'string' && value !== '') ? value : fallback;
    }
    function Na__LeOrtho__Label(key, fallback) {
        return Na__LeOrtho__Value('Labels', 'Labels__' + key, fallback);
    }
    // ------------------------------------------------------------


    // FUNCTION | Fetch the Config Once, and Take Its Shift Setting
    // ------------------------------------------------------------
    // Never rejects. A missing file leaves every reader on its fallback -
    // AutoCAD's behaviour and English words - so F8 still works.
    // ------------------------------------------------------------
    function Na__LeOrtho__Ready() {
        if (!Na__LeOrtho__Loading) {
            Na__LeOrtho__Loading = (async () => {
                try {
                    const response = await fetch(Na__LeOrtho__ConfigUrl, { cache : 'no-store' });
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    Na__LeOrtho__Config = await response.json();
                } catch (error) {
                    console.warn('[TrueVision3D LayoutEditor] Ortho mode config unavailable - the built-in settings are used.', error);
                    Na__LeOrtho__Config = null;
                }
                Na__LeOrtho__AssignShiftOverride(Na__LeOrtho__Value('Behaviour', 'Behaviour__ShiftTemporaryOverride', true));
                return Na__LeOrtho__Config;
            })();
        }
        return Na__LeOrtho__Loading;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Switching Ortho On and Off
// -----------------------------------------------------------------------------

    // FUNCTION | Switch Ortho Mode On or Off
    // ------------------------------------------------------------
    // Remembers the choice in this browser, says so the way AutoCAD does and
    // announces it for the toolbar. Redrawing whatever is half placed is the
    // caller's: the keyboard knows what is in flight, and a toolbar click has
    // the pointer off the sheet anyway, so the next move over it redraws.
    // Returns the state.
    // ------------------------------------------------------------
    function Na__LeOrtho__Set(flag) {
        const want = flag === true;
        if (want === Na__LeOrtho__IsOn()) return want;
        Na__LeOrtho__AssignOn(want);
        Na__LeOrtho__Store(want);
        console.log('[TrueVision3D LayoutEditor] ' + (want
            ? Na__LeOrtho__Label('ConsoleOn', 'Ortho mode on (F8): new lines, dimensions and moves are held horizontal or vertical. Hold Shift to draw one at an angle.')
            : Na__LeOrtho__Label('ConsoleOff', 'Ortho mode off (F8): lines are drawn at any angle. Hold Shift to hold one square.')));
        if (Na__LeOrtho__Value('Behaviour', 'Behaviour__EchoOnSwitch', true)) {
            Na__LeMeasure__Say(want ? Na__LeOrtho__Label('EchoOn', '<Ortho on>') : Na__LeOrtho__Label('EchoOff', '<Ortho off>'));
        }
        window.dispatchEvent(new CustomEvent(Na__LeOrtho__CHANGED_EVENT, { detail : { enabled : want } }));
        return want;
    }
    function Na__LeOrtho__Toggle() {
        return Na__LeOrtho__Set(!Na__LeOrtho__IsOn());
    }
    // ------------------------------------------------------------

    // THE CONFIG IS ASKED FOR AS THE EDITOR LOADS, so the toolbar's words and
    // the Shift setting are in before the first key. Never rejects.
    void Na__LeOrtho__Ready();

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Ortho Mode API
    // ------------------------------------------------------------
    export {
        Na__LeOrtho__CHANGED_EVENT,
        Na__LeOrtho__IsOn,
        Na__LeOrtho__Set,
        Na__LeOrtho__Toggle,
        Na__LeOrtho__Label,
        Na__LeOrtho__Ready
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
