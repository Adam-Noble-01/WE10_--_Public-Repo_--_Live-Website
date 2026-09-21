// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - OBJECT SNAP - STATE
// =============================================================================
//
// FILE       : Na__LayoutEditor__ObjectSnap__State__.js
// NAMESPACE  : Na__LeOsnap
// MODULE     : Layout Editor - Object Snap - State
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Whether object snap is on, which snap modes are running and which kinds of object may be snapped to
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - THREE SETS OF SWITCHES, AND THE WORDS THEY ARE NAMED BY.
//     * Object snap itself (F3, AutoCAD's OSNAP): everything on or off.
//     * The RUNNING SNAP MODES, AutoCAD's list: Endpoint, Midpoint,
//       Intersection, Perpendicular, Centre and Nearest. Each is a KIND, and
//       the kind is what a snap hit says it found - so the marker's glyph, the
//       menu's illustration and the search's weights all key on one word.
//     * The TARGETS, which is this editor's own: what KIND OF OBJECT may be
//       snapped to - a viewport's linework, a vector, text, a dimension, the
//       sheet's own paper (border, title block, notes margin). The target is
//       what the marker's COLOUR says, so the same word names the switch and
//       the colour.
// - THIS FILE IS A LEAF ON PURPOSE, as the Ortho and Drawing Grid states are.
//   The search reads these flags on every pointer move, and the controller
//   that switches them talks to the Measurements box, which imports the very
//   tools that snap. Holding the flags here, with no imports at all, lets
//   every side read them without an import cycle.
// - REMEMBERED IN THIS BROWSER, like Ortho (F8) and the grid: a way of
//   drawing, never part of a sheet. The master switch keeps the storage key it
//   has always had, so nobody's F3 choice is lost by the move to this folder.
//   A mode or a target nobody has switched falls to its default, which the
//   controller hands in from the config (AssignDefaults).
//
// INTEGRATION:
// - Na__LayoutEditor__ObjectSnap__ (the controller) is the only caller of the
//   Assign and Store functions; everyone else switches through its Set and
//   Toggle functions, which announce CHANGED_EVENT.
// - Na__LayoutEditor__ObjectSnap__Search__, __Index__, __Sources__ and
//   __Marker__ read IsEnabled, IsModeOn and IsTargetOn and the constants.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026). The master switch and
//                   KIND_END / KIND_MID / KIND_GRID came across from
//                   30__System__SheetTools/Na__LayoutEditor__Snapping__.js 1.5.0.
// - ValeVision    : not yet ported - it waits for Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation: the master switch (moved), the six running snap
//   modes, the five targets, their defaults and their remembered copies.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | What a Snap Hit Found: the Kinds
    // ------------------------------------------------------------
    // The first six are the running snap modes the menu lists, in the order it
    // lists them. GRID and INFER are never switched here: the grid is the
    // drawing grid's fallback (F7) and an inferred line is the Dimension
    // tool's own.
    // ------------------------------------------------------------
    const Na__LeOsnap__KIND_END   = 'end';                                  // <-- Endpoint: a corner, the end of a line (a square)
    const Na__LeOsnap__KIND_MID   = 'mid';                                  // <-- Midpoint: the middle of a line (a triangle)
    const Na__LeOsnap__KIND_INT   = 'int';                                  // <-- Intersection: where two lines cross (a cross)
    const Na__LeOsnap__KIND_PERP  = 'perp';                                 // <-- Perpendicular: where the line being drawn meets another square on (a right angle)
    const Na__LeOsnap__KIND_CEN   = 'cen';                                  // <-- Centre: the middle of a closed vector, a circle, an arc or a text box (a circle)
    const Na__LeOsnap__KIND_NEAR  = 'near';                                 // <-- Nearest: the closest point on a line (an hourglass)
    const Na__LeOsnap__KIND_GRID  = 'grid';                                 // <-- A point of the drawing grid (Grid Snap, F7): only ever the fallback
    const Na__LeOsnap__KIND_INFER = 'infer';                                // <-- The Dimension tool's inferred line: it lines up with another dimension's
    const Na__LeOsnap__MODES      = Object.freeze([ Na__LeOsnap__KIND_END, Na__LeOsnap__KIND_MID, Na__LeOsnap__KIND_INT, Na__LeOsnap__KIND_PERP, Na__LeOsnap__KIND_CEN, Na__LeOsnap__KIND_NEAR ]);
    // ------------------------------------------------------------

    // MODULE CONSTANTS | What Was Snapped To: the Targets (the marker's colour)
    // ------------------------------------------------------------
    const Na__LeOsnap__TARGET_VIEWPORT  = 'viewport';                       // <-- Purple: the projected linework inside a 2D viewport
    const Na__LeOsnap__TARGET_SHAPE     = 'shape';                          // <-- Blue: a vector drawn on the sheet
    const Na__LeOsnap__TARGET_TEXT      = 'text';                           // <-- Orange: a text item's box
    const Na__LeOsnap__TARGET_DIMENSION = 'dimension';                      // <-- Red: a dimension's measured points
    const Na__LeOsnap__TARGET_PAPER     = 'paper';                          // <-- Slate: the border, the title block and the notes margin
    const Na__LeOsnap__TARGET_GRID      = 'grid';                           // <-- Slate too, and never a switch here: Grid Snap (F7) owns it
    const Na__LeOsnap__TARGETS          = Object.freeze([ Na__LeOsnap__TARGET_VIEWPORT, Na__LeOsnap__TARGET_SHAPE, Na__LeOsnap__TARGET_TEXT, Na__LeOsnap__TARGET_DIMENSION, Na__LeOsnap__TARGET_PAPER ]);
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Event, and Where the Choices Are Remembered
    // ------------------------------------------------------------
    const Na__LeOsnap__CHANGED_EVENT     = 'na-layouteditor-snap-changed';  // <-- detail { enabled, modes, targets }
    const Na__LeOsnap__STORE_KEY         = 'na-layouteditor-osnap';         // <-- '1' on, '0' off: the key F3 has always used
    const Na__LeOsnap__MODES_STORE_KEY   = 'na-layouteditor-osnap-modes';   // <-- JSON { end : true, near : false, ... }: only what has been switched
    const Na__LeOsnap__TARGETS_STORE_KEY = 'na-layouteditor-osnap-targets'; // <-- JSON { text : false, ... }: only what has been switched
    const Na__LeOsnap__NAMES_STORE_KEY   = 'na-layouteditor-osnap-names';   // <-- '1' the marker names what it found, '0' it does not
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Switches (null until first asked) and Their Defaults
    // ------------------------------------------------------------
    // AutoCAD ships with Endpoint, Midpoint... most of its list running and
    // Nearest off, because Nearest answers everywhere along every line and
    // would be in the way of every other mode. The same here until the config
    // says otherwise.
    // ------------------------------------------------------------
    let Na__LeOsnap__Enabled  = null;
    let Na__LeOsnap__Modes    = null;                                        // <-- { kind : boolean } the browser's own choices, read once
    let Na__LeOsnap__Targets  = null;                                        // <-- { target : boolean } likewise
    let Na__LeOsnap__Names    = null;                                        // <-- Does the marker name what it found ("Endpoint - Viewport")
    let Na__LeOsnap__Words    = {};                                          // <-- kind or target -> the word the config gives it, for the marker's name
    const Na__LeOsnap__Defaults = {
        enabled : true,
        names   : false,
        modes   : { end : true, mid : true, int : true, perp : true, cen : true, near : false },
        targets : { viewport : true, shape : true, text : true, dimension : true, paper : true }
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading and Remembering
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Read a Remembered Value, or Null
    // ------------------------------------------------------------
    function Na__LeOsnap__Read(key) {
        try { return window.localStorage.getItem(key); } catch (error) { return null; }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read a Remembered Set of Switches ({ name : boolean }), Never Null
    // ------------------------------------------------------------
    function Na__LeOsnap__ReadSet(key, names) {
        const out = {};
        let parsed = null;
        try { parsed = JSON.parse(Na__LeOsnap__Read(key) || 'null'); } catch (error) { parsed = null; }
        if (parsed && typeof parsed === 'object') names.forEach((name) => { if (typeof parsed[name] === 'boolean') out[name] = parsed[name]; });
        return out;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is Object Snap On (F3: the master switch)
    // ------------------------------------------------------------
    function Na__LeOsnap__IsEnabled() {
        if (Na__LeOsnap__Enabled === null) {
            const stored = Na__LeOsnap__Read(Na__LeOsnap__STORE_KEY);
            Na__LeOsnap__Enabled = stored === null ? Na__LeOsnap__Defaults.enabled : stored === '1';
        }
        return Na__LeOsnap__Enabled;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is One Running Snap Mode On (the mode alone, whatever F3 says)
    // ------------------------------------------------------------
    function Na__LeOsnap__IsModeOn(kind) {
        if (Na__LeOsnap__Modes === null) Na__LeOsnap__Modes = Na__LeOsnap__ReadSet(Na__LeOsnap__MODES_STORE_KEY, Na__LeOsnap__MODES);
        if (typeof Na__LeOsnap__Modes[kind] === 'boolean') return Na__LeOsnap__Modes[kind];
        return Na__LeOsnap__Defaults.modes[kind] === true;
    }
    // ------------------------------------------------------------


    // FUNCTION | May One Kind of Object Be Snapped To
    // ------------------------------------------------------------
    function Na__LeOsnap__IsTargetOn(target) {
        if (Na__LeOsnap__Targets === null) Na__LeOsnap__Targets = Na__LeOsnap__ReadSet(Na__LeOsnap__TARGETS_STORE_KEY, Na__LeOsnap__TARGETS);
        if (typeof Na__LeOsnap__Targets[target] === 'boolean') return Na__LeOsnap__Targets[target];
        return Na__LeOsnap__Defaults.targets[target] !== false;
    }
    // ------------------------------------------------------------


    // FUNCTION | Does the Marker Name What It Found, and the Word for a Kind or a Target
    // ------------------------------------------------------------
    // AutoCAD's AutoSnap tooltip: "Endpoint", "Midpoint". Off until asked for,
    // because the glyph and its colour already say both things; the words are
    // there for learning the two codes, and come from the config.
    // ------------------------------------------------------------
    function Na__LeOsnap__IsNaming() {
        if (Na__LeOsnap__Names === null) {
            const stored = Na__LeOsnap__Read(Na__LeOsnap__NAMES_STORE_KEY);
            Na__LeOsnap__Names = stored === null ? Na__LeOsnap__Defaults.names : stored === '1';
        }
        return Na__LeOsnap__Names;
    }
    function Na__LeOsnap__WordFor(name, fallback) {
        const word = Na__LeOsnap__Words[name];
        return (typeof word === 'string' && word !== '') ? word : (fallback || '');
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Switch at Once (a copy, for the event and the menu)
    // ------------------------------------------------------------
    function Na__LeOsnap__Snapshot() {
        const modes = {}, targets = {};
        Na__LeOsnap__MODES.forEach((kind) => { modes[kind] = Na__LeOsnap__IsModeOn(kind); });
        Na__LeOsnap__TARGETS.forEach((target) => { targets[target] = Na__LeOsnap__IsTargetOn(target); });
        return { enabled : Na__LeOsnap__IsEnabled(), names : Na__LeOsnap__IsNaming(), modes : modes, targets : targets };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Assigning (the controller's only)
// -----------------------------------------------------------------------------

    // FUNCTION | The Defaults the Config Asks For
    // ------------------------------------------------------------
    // Only what the browser has never switched falls to a default, so a
    // config that lands after the first pointer move changes nothing a user
    // has chosen.
    // ------------------------------------------------------------
    function Na__LeOsnap__AssignDefaults(defaults) {
        const from = defaults && typeof defaults === 'object' ? defaults : {};
        if (typeof from.enabled === 'boolean') {
            Na__LeOsnap__Defaults.enabled = from.enabled;
            if (Na__LeOsnap__Read(Na__LeOsnap__STORE_KEY) === null) Na__LeOsnap__Enabled = null;   // <-- Never switched here: ask again, against the new default
        }
        Na__LeOsnap__MODES.forEach((kind) => { if (from.modes && typeof from.modes[kind] === 'boolean') Na__LeOsnap__Defaults.modes[kind] = from.modes[kind]; });
        Na__LeOsnap__TARGETS.forEach((target) => { if (from.targets && typeof from.targets[target] === 'boolean') Na__LeOsnap__Defaults.targets[target] = from.targets[target]; });
        if (typeof from.names === 'boolean') {
            Na__LeOsnap__Defaults.names = from.names;
            if (Na__LeOsnap__Read(Na__LeOsnap__NAMES_STORE_KEY) === null) Na__LeOsnap__Names = null;
        }
        if (from.words && typeof from.words === 'object') Na__LeOsnap__Words = Object.assign({}, from.words);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Assign and Remember Whether the Marker Names What It Found
    // ------------------------------------------------------------
    function Na__LeOsnap__AssignNaming(flag) {
        Na__LeOsnap__Names = flag === true;
        try { window.localStorage.setItem(Na__LeOsnap__NAMES_STORE_KEY, Na__LeOsnap__Names ? '1' : '0'); } catch (error) { /* storage unavailable */ }
        return Na__LeOsnap__Names;
    }
    // ------------------------------------------------------------


    // FUNCTION | Assign and Remember the Master Switch
    // ------------------------------------------------------------
    // A let cannot be assigned through an import, so each flag and the one
    // function that writes it stay together here. Nothing is announced: that
    // is the controller's job, so this file can stay a leaf.
    // ------------------------------------------------------------
    function Na__LeOsnap__AssignEnabled(flag) {
        Na__LeOsnap__Enabled = flag === true;
        try { window.localStorage.setItem(Na__LeOsnap__STORE_KEY, Na__LeOsnap__Enabled ? '1' : '0'); } catch (error) { /* storage unavailable: the flag still works for this session */ }
        return Na__LeOsnap__Enabled;
    }
    // ------------------------------------------------------------


    // FUNCTION | Assign and Remember One Running Snap Mode
    // ------------------------------------------------------------
    function Na__LeOsnap__AssignMode(kind, flag) {
        if (Na__LeOsnap__MODES.indexOf(kind) === -1) return false;
        Na__LeOsnap__IsModeOn(kind);                                             // <-- Reads the remembered set in, if it has not been yet
        Na__LeOsnap__Modes[kind] = flag === true;
        try { window.localStorage.setItem(Na__LeOsnap__MODES_STORE_KEY, JSON.stringify(Na__LeOsnap__Modes)); } catch (error) { /* storage unavailable */ }
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Assign and Remember One Target
    // ------------------------------------------------------------
    function Na__LeOsnap__AssignTarget(target, flag) {
        if (Na__LeOsnap__TARGETS.indexOf(target) === -1) return false;
        Na__LeOsnap__IsTargetOn(target);
        Na__LeOsnap__Targets[target] = flag === true;
        try { window.localStorage.setItem(Na__LeOsnap__TARGETS_STORE_KEY, JSON.stringify(Na__LeOsnap__Targets)); } catch (error) { /* storage unavailable */ }
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Object Snap State
    // ------------------------------------------------------------
    export {
        Na__LeOsnap__KIND_END,
        Na__LeOsnap__KIND_MID,
        Na__LeOsnap__KIND_INT,
        Na__LeOsnap__KIND_PERP,
        Na__LeOsnap__KIND_CEN,
        Na__LeOsnap__KIND_NEAR,
        Na__LeOsnap__KIND_GRID,
        Na__LeOsnap__KIND_INFER,
        Na__LeOsnap__MODES,
        Na__LeOsnap__TARGET_VIEWPORT,
        Na__LeOsnap__TARGET_SHAPE,
        Na__LeOsnap__TARGET_TEXT,
        Na__LeOsnap__TARGET_DIMENSION,
        Na__LeOsnap__TARGET_PAPER,
        Na__LeOsnap__TARGET_GRID,
        Na__LeOsnap__TARGETS,
        Na__LeOsnap__CHANGED_EVENT,
        Na__LeOsnap__IsEnabled,
        Na__LeOsnap__IsModeOn,
        Na__LeOsnap__IsTargetOn,
        Na__LeOsnap__IsNaming,
        Na__LeOsnap__WordFor,
        Na__LeOsnap__Snapshot,
        Na__LeOsnap__AssignDefaults,
        Na__LeOsnap__AssignNaming,
        Na__LeOsnap__AssignEnabled,
        Na__LeOsnap__AssignMode,
        Na__LeOsnap__AssignTarget
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
