// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - OBJECT SNAP
// =============================================================================
//
// FILE       : Na__LayoutEditor__ObjectSnap__.js
// NAMESPACE  : Na__LeOsnap
// MODULE     : Layout Editor - Object Snap
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : AutoCAD's object snap on AutoCAD's key: F3 switches it, and the snap menu chooses which kinds of point are found and which kinds of object they are found on
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - THE WHOLE OF THE EDITOR'S SNAPPING LIVES IN THIS FOLDER. It used to be one
//   file among the sheet tools, with the move snaps in the hit resolution, the
//   grid moves in a unit of their own and a carried viewport's snapping in the
//   viewports folder. Adam, 21-Sep-2026: "create an actual object snap folder
//   ... move all of the snapping logic there, and call it back into all of the
//   tools." The units:
//     __State__         the switches: a leaf every other unit reads
//     __Geometry__      the maths: crossings, perpendiculars, centres (a leaf)
//     __Glyphs__        the marker's shapes and the menu's pictures (a leaf)
//     __Index__         a viewport's linework, filed on a grid: points and lines
//     __Sources__       what the sheet's own vectors, text, dimensions and
//                       paper offer
//     __Search__        Find and Snap: WHAT A TOOL IMPORTS
//     __Marker__        the marker on the paper: shape by kind, colour by target
//     __Moves__         a vector, or a selection, moved whole
//     __GridMoves__     a move landing on the drawing grid (F7)
//     __Menu__          the snap options dropdown
//     ViewportSnapMove  a viewport carried by a point of its own linework
//   and this file, the CONTROLLER: the switches' public face, the config and
//   every word on the screen.
// - WHY A TOOL IMPORTS __Search__ AND NOT THIS FILE. This one talks to the
//   Measurements box (the echo), which imports the very tools that snap, so a
//   tool importing it would close a cycle. The toolbar, the keyboard, the
//   right-click menu and the snap menu import this; everything that SNAPS
//   imports __Search__, and both read the same leaf.
// - HOW IT IS SWITCHED. F3 (Snap__Toggle in the key map), the Snap button on
//   the toolbar, lit while it is on, or Snapping on / off on the right-click
//   menu. Every switch is echoed as AutoCAD echoes it on its command line,
//   "<Osnap on>" / "<Osnap off>", on the line above the Measurements box. The
//   arrow beside the Snap button drops the snap menu: AutoCAD's status bar
//   button, which toggles on a click and lists the running modes on its arrow.
// - REMEMBERED IN THIS BROWSER, like Ortho (F8) and the grid: nothing is
//   written to a sheet, the browser draft or R2, and the PDF and the web
//   viewer never see it.
//
// INTEGRATION:
// - Na__LayoutEditor__Toolbar__ has the Snap button and its arrow, and re-syncs
//   on CHANGED_EVENT; Na__LayoutEditor__SheetTools__Keyboard__ runs Toggle on
//   F3; Na__LayoutEditor__SheetTools__ContextMenu__ has the on / off row.
// - Na__LayoutEditor__ObjectSnap__Menu__ switches the modes and the targets
//   through SetMode and SetTarget.
// - Na__LayoutEditor__Measurements__ shows the echo (Na__LeMeasure__Say).
// // @delegate: ./Na__LayoutEditor__ObjectSnap__State__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026). SetEnabled and Toggle
//                   came across from 30__System__SheetTools/Na__LayoutEditor__Snapping__.js
//                   1.5.0, which no longer exists (it was a re-export for an hour, until
//                   the last module importing it had been repointed here).
// - ValeVision    : not yet ported - it waits for Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation: the folder, the master switch with AutoCAD's echo,
//   the six running snap modes and five targets with their switches, the
//   marker's name switch, the config and every label.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Switches, the Marker, and the Box That Echoes Them
    // ------------------------------------------------------------
    import {
        Na__LeOsnap__MODES,
        Na__LeOsnap__TARGETS,
        Na__LeOsnap__CHANGED_EVENT,
        Na__LeOsnap__IsEnabled,
        Na__LeOsnap__IsModeOn,
        Na__LeOsnap__IsTargetOn,
        Na__LeOsnap__IsNaming,
        Na__LeOsnap__Snapshot,
        Na__LeOsnap__AssignDefaults,
        Na__LeOsnap__AssignEnabled,
        Na__LeOsnap__AssignMode,
        Na__LeOsnap__AssignTarget,
        Na__LeOsnap__AssignNaming
    } from './Na__LayoutEditor__ObjectSnap__State__.js';
    import { Na__LeOsnap__HideMarker } from './Na__LayoutEditor__ObjectSnap__Marker__.js';
    import { Na__LeMeasure__Say } from '../30__System__SheetTools/Na__LayoutEditor__Measurements__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Where the Config Is
    // ------------------------------------------------------------
    const Na__LeOsnap__ConfigUrl = new URL('./Na__LayoutEditor__ObjectSnap__Config__.json', import.meta.url);
    const Na__LeOsnap__PREFIX    = 'LayoutEditor__ObjectSnap__';
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Config
    // ------------------------------------------------------------
    let Na__LeOsnap__Config  = null;
    let Na__LeOsnap__Loading = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Config
// -----------------------------------------------------------------------------

    // FUNCTION | One Block of the Config, a Value From It, and a Label
    // ------------------------------------------------------------
    function Na__LeOsnap__Block(name) {
        const block = Na__LeOsnap__Config ? Na__LeOsnap__Config[Na__LeOsnap__PREFIX + name] : null;
        return (block && typeof block === 'object' && !Array.isArray(block)) ? block : {};
    }
    function Na__LeOsnap__Value(block, key, fallback) {
        const value = Na__LeOsnap__Block(block)[key];
        if (typeof fallback === 'boolean') return (typeof value === 'boolean') ? value : fallback;
        return (typeof value === 'string' && value !== '') ? value : fallback;
    }
    function Na__LeOsnap__Label(key, fallback) {
        return Na__LeOsnap__Value('Labels', 'Labels__' + key, fallback);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Hand the Config's Defaults and Words to the Leaf
    // ------------------------------------------------------------
    // The leaf cannot read a config - it imports nothing - so what the config
    // asks for is pushed into it: which modes and targets start on, whether
    // the marker names what it found, and the word for each kind and target.
    // ------------------------------------------------------------
    function Na__LeOsnap__ApplyConfig() {
        const modes = {}, targets = {}, words = {};
        Na__LeOsnap__MODES.forEach((kind) => {
            const on = Na__LeOsnap__Block('Modes')['Modes__' + kind + '__DefaultOn'];
            if (typeof on === 'boolean') modes[kind] = on;
        });
        Na__LeOsnap__TARGETS.forEach((target) => {
            const on = Na__LeOsnap__Block('Targets')['Targets__' + target + '__DefaultOn'];
            if (typeof on === 'boolean') targets[target] = on;
        });
        [ 'end', 'mid', 'int', 'perp', 'cen', 'near', 'grid', 'infer' ].forEach((kind) => { words[kind] = Na__LeOsnap__Label('Mode__' + kind, ''); });
        [ 'viewport', 'shape', 'text', 'dimension', 'paper', 'grid' ].forEach((target) => { if (!words[target]) words[target] = Na__LeOsnap__Label('Target__' + target, ''); });
        Na__LeOsnap__AssignDefaults({
            modes   : modes,
            targets : targets,
            names   : Na__LeOsnap__Value('Behaviour', 'Behaviour__NameTheSnapByDefault', false),
            words   : words
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Fetch the Config Once
    // ------------------------------------------------------------
    // Never rejects. A missing file leaves every reader on its fallback -
    // AutoCAD's defaults and English words - so F3 and the menu still work.
    // ------------------------------------------------------------
    function Na__LeOsnap__Ready() {
        if (!Na__LeOsnap__Loading) {
            Na__LeOsnap__Loading = (async () => {
                try {
                    const response = await fetch(Na__LeOsnap__ConfigUrl, { cache : 'no-store' });
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    Na__LeOsnap__Config = await response.json();
                } catch (error) {
                    console.warn('[TrueVision3D LayoutEditor] Object snap config unavailable - the built-in settings are used.', error);
                    Na__LeOsnap__Config = null;
                }
                Na__LeOsnap__ApplyConfig();
                window.dispatchEvent(new CustomEvent(Na__LeOsnap__CHANGED_EVENT, { detail : Na__LeOsnap__Snapshot() }));   // <-- The toolbar's words and the menu's defaults are in: say so
                return Na__LeOsnap__Config;
            })();
        }
        return Na__LeOsnap__Loading;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Switching
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Announce That a Switch Moved
    // ------------------------------------------------------------
    function Na__LeOsnap__Announce() {
        window.dispatchEvent(new CustomEvent(Na__LeOsnap__CHANGED_EVENT, { detail : Na__LeOsnap__Snapshot() }));
    }
    // ------------------------------------------------------------


    // FUNCTION | Switch Object Snap On or Off (F3)
    // ------------------------------------------------------------
    // Remembers the choice in this browser, takes the marker down when it goes
    // off, says so the way AutoCAD does and announces it for the toolbar.
    // Returns the state.
    // ------------------------------------------------------------
    function Na__LeOsnap__SetEnabled(flag) {
        const want = flag === true;
        const was  = Na__LeOsnap__IsEnabled();
        Na__LeOsnap__AssignEnabled(want);
        if (!want) Na__LeOsnap__HideMarker();
        if (want !== was) {
            console.log('[TrueVision3D LayoutEditor] ' + (want
                ? Na__LeOsnap__Label('ConsoleOn', 'Object snap on (F3).')
                : Na__LeOsnap__Label('ConsoleOff', 'Object snap off (F3).')));
            if (Na__LeOsnap__Value('Behaviour', 'Behaviour__EchoOnSwitch', true)) {
                Na__LeMeasure__Say(want ? Na__LeOsnap__Label('EchoOn', '<Osnap on>') : Na__LeOsnap__Label('EchoOff', '<Osnap off>'));
            }
        }
        Na__LeOsnap__Announce();
        return want;
    }
    function Na__LeOsnap__Toggle() { return Na__LeOsnap__SetEnabled(!Na__LeOsnap__IsEnabled()); }
    // ------------------------------------------------------------


    // FUNCTION | Switch One Running Snap Mode
    // ------------------------------------------------------------
    // kind is one of Na__LeOsnap__MODES. The next pointer move searches with
    // it: nothing is rebuilt, because the index files every kind of point
    // whichever modes are running.
    // ------------------------------------------------------------
    function Na__LeOsnap__SetMode(kind, flag) {
        if (!Na__LeOsnap__AssignMode(kind, flag === true)) return false;
        Na__LeOsnap__HideMarker();
        Na__LeOsnap__Announce();
        return true;
    }
    function Na__LeOsnap__ToggleMode(kind) { return Na__LeOsnap__SetMode(kind, !Na__LeOsnap__IsModeOn(kind)); }
    // ------------------------------------------------------------


    // FUNCTION | Switch One Kind of Object In or Out of Reach of the Snaps
    // ------------------------------------------------------------
    function Na__LeOsnap__SetTarget(target, flag) {
        if (!Na__LeOsnap__AssignTarget(target, flag === true)) return false;
        Na__LeOsnap__HideMarker();
        Na__LeOsnap__Announce();
        return true;
    }
    function Na__LeOsnap__ToggleTarget(target) { return Na__LeOsnap__SetTarget(target, !Na__LeOsnap__IsTargetOn(target)); }
    // ------------------------------------------------------------


    // FUNCTION | Switch Whether the Marker Names What It Found
    // ------------------------------------------------------------
    function Na__LeOsnap__SetNaming(flag) {
        Na__LeOsnap__AssignNaming(flag === true);
        Na__LeOsnap__Announce();
        return Na__LeOsnap__IsNaming();
    }
    // ------------------------------------------------------------

    // THE CONFIG IS ASKED FOR AS THE EDITOR LOADS, so the toolbar's words and
    // the modes' defaults are in before the first pointer move. Never rejects.
    void Na__LeOsnap__Ready();

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Object Snap API
    // ------------------------------------------------------------
    export {
        Na__LeOsnap__MODES,
        Na__LeOsnap__TARGETS,
        Na__LeOsnap__CHANGED_EVENT,
        Na__LeOsnap__IsEnabled,
        Na__LeOsnap__SetEnabled,
        Na__LeOsnap__Toggle,
        Na__LeOsnap__IsModeOn,
        Na__LeOsnap__SetMode,
        Na__LeOsnap__ToggleMode,
        Na__LeOsnap__IsTargetOn,
        Na__LeOsnap__SetTarget,
        Na__LeOsnap__ToggleTarget,
        Na__LeOsnap__IsNaming,
        Na__LeOsnap__SetNaming,
        Na__LeOsnap__Label,
        Na__LeOsnap__Ready
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
