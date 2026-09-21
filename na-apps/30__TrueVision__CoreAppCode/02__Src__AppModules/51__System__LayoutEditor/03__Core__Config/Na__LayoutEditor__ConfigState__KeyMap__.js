// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - CONFIG STATE - KEY MAP
// =============================================================================
//
// FILE       : Na__LayoutEditor__ConfigState__KeyMap__.js
// NAMESPACE  : Na__LeCfg
// MODULE     : Layout Editor - Config State - Key Map
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Own the key map JSON and answer what a button, a wheel turn or a key press means
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - Fetches Na__Hotkeys__DrawingTabs__.json and holds the parsed key map
//   beside its built-in fallback (the bindings that ship switched on).
// - Answers what a mouse or pen press, a wheel turn, a key press or the
//   modifiers held on a select press mean, and supplies the guard selectors,
//   the keyboard and touch setups, the keys the Measurements box reads and
//   the bindable action catalogue.
// - The key map state sits here with both functions that assign it
//   (FetchKeyMap and SetKeyMap), so no other unit writes to it.
//
// INTEGRATION:
// - Na__LayoutEditor__ConfigState__ calls FetchKeyMap from Ready and
//   re-exports the public functions, so the control modules and the sheet
//   tools keep importing Na__LayoutEditor__ConfigState__.js.
// - Shares PREFIX with Na__LayoutEditor__ConfigState__Readers__.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the ValeVision3D v2.47.0 split of the same module (same unit, same functions)
// - Parity        : verbatim (moved code)
// - Divergences   : Console prefix only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.9.0
// - View__AxesToggle on F9 in the built-in fallback, the same binding as the
//   new row in the shipped key map: the Drawing Axes Overlay
//   (33__System__DrawingAxes), SketchUp's red and green axes carried by the
//   cursor out to the edges of the sheet.
//
// 21-Sep-2026 - Version 1.8.0
// - MatchKeyBinding takes an optional context, and a binding may carry a When
//   ("InContainer"): it matches only while the context says so. T is Trim while
//   a container is open and Text elsewhere. No context, no When match, so every
//   other caller is unchanged.
// - The fallback carries the vector tools' keys (37__System__VectorTools),
//   mirroring the new rows in the shipped JSON: Trim T (in a container), Extend
//   Shift+T, Join J, Split U, Offset F, Fillet Shift+F, Chamfer Shift+C, Circle
//   C and Arc Shift+A.
//
// 21-Sep-2026 - Version 1.7.0
// - GetMeasureKeys reads MeasurementsBox ArrayCharacters (x X * /, in the
//   shipped JSON and the fallback alike): what may begin or continue a value
//   while a copy is on offer to be arrayed, SketchUp's 3x and /3.
//
// 21-Sep-2026 - Version 1.6.0
// - CopyDragModifier (SelectionBindings, Ctrl): SketchUp LayOut's Ctrl-drag,
//   a move that carries a copy and leaves the original where it was.
//   MatchSelectionModifier reports it as `copy` without setting it aside, so
//   Ctrl still adds at the press; GetCopyDragModifier and IsCopyDragKey let
//   the sheet tools flip a move in flight on the key. The fallback carries it,
//   mirroring the new key in the shipped JSON.
//
// 21-Sep-2026 - Version 1.5.0
// - THE FALLBACK HAD NO MOVE KEY. It had drifted from the shipped JSON since
//   17-Sep: no Tool__Move (M), no Tool__SelectSpace (the space bar arms
//   Select), no Edit__Save (Ctrl+S), and the space bar still cleared the
//   selection (Edit__Deselect, which the JSON ships switched off). So whenever
//   the key file failed to load - a moment offline, or the file caught half
//   written by an editor - M did nothing for the whole session. Brought level,
//   and Na__Test__DrawingTabKeys__ (80__Testing__PrototypeEnvironment) now
//   fails the moment the two resolve any key differently.
// - ReloadKeyMap reads the key file again. The bindings in force stay until
//   the new file has loaded, a read that fails keeps them, and a key map
//   handed in (SetKeyMap) is never replaced. The mode controller asks for it
//   whenever a drawing tab is opened from another tab, so a key file that
//   failed to load no longer costs the whole session.
// - The key file is renamed Na__Hotkeys__DrawingTabs__.json (it was
//   Na__LayoutEditor__KeyMappings__.json): one of the app's three hotkey files,
//   each named for the kind of tab it serves.
//
// 21-Sep-2026 - Version 1.4.0
// - The fallback carries View__GridToggle (F6, Show Grid) and
//   Snap__GridToggle (F7, Grid Snap), mirroring the new rows in the shipped
//   JSON, so the drawing grid still switches if the key map fails to load.
//
// 21-Sep-2026 - Version 1.3.0
// - The fallback carries Ortho__Toggle (F8, Ortho mode), mirroring the new row
//   in the shipped JSON, so F8 still switches Ortho if the key map fails to
//   load. The JSON's Ctrl+L alternate ships off and so is not repeated here.
//
// 21-Sep-2026 - Version 1.2.0
// - The fallback carries Nav__PreviousSheet (Page Up) and Nav__NextSheet
//   (Page Down), mirroring the new rows in the shipped JSON: they turn the
//   drawings on a drawing tab. The older drift noted under 1.1.0 is still
//   left for its own change.
//
// 21-Sep-2026 - Version 1.1.0
// - The fallback carries View__DraftToggle (K, Draft mode), mirroring the new
//   row in the shipped JSON, so K still works if the key map fails to load.
//   (The fallback has drifted from the JSON elsewhere - it lacks
//   Tool__SelectSpace, Tool__Move and Edit__Save and still has Edit__Deselect
//   on the space bar - which is left for its own change.)
//
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__ConfigState__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Shared Key Prefix
    // ------------------------------------------------------------
    import { Na__LeCfg__PREFIX } from './Na__LayoutEditor__ConfigState__Readers__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Key Map Location
    // ------------------------------------------------------------
    const Na__LeCfg__KeyMapUrl  = new URL('./Na__Hotkeys__DrawingTabs__.json', import.meta.url);
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Key Map Fallback (mirrors the enabled defaults in the shipped JSON)
    // ------------------------------------------------------------
    // Only the bindings that ship switched on are repeated here. A failed
    // fetch therefore still leaves a sheet that zooms and pans exactly the
    // way Lantern Designer does, rather than one that cannot be moved.
    // Na__Test__DrawingTabKeys__ checks every key resolves the same through
    // this list as through the shipped file: add a binding to both or neither.
    const Na__LeCfg__KEYMAP_FALLBACK = Object.freeze({
        guards   : { pointerIgnoreSelector   : 'input, select, button, textarea, canvas, [contenteditable="true"]',
                     wheelIgnoreSelector     : 'canvas',
                     contextMenuKeepSelector : 'input, select, button, textarea, [contenteditable="true"]',
                     paperSelector           : '.na-le-paper' },
        pointer  : [ { Id : 'Pan__MiddleOrRightDrag', Action : 'Nav__Pan', Enabled : true, Buttons : [ 'Middle', 'Right' ], Modifiers : [], ModifierMatch : 'Any' } ],
        wheel    : [ { Id : 'Zoom__Wheel', Action : 'Nav__ZoomAtCursor', Enabled : true, Modifiers : [], ModifierMatch : 'Any' } ],
        keyboard : [ { Id : 'Nav__PreviousSheet', Action : 'Nav__PreviousSheet', Enabled : true, Keys : [ 'PageUp' ],            Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Nav__NextSheet',    Action : 'Nav__NextSheet',    Enabled : true, Keys : [ 'PageDown' ],             Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Edit__Cancel',      Action : 'Edit__Cancel',      Enabled : true, Keys : [ 'Escape' ],               Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Edit__Delete',      Action : 'Edit__Delete',      Enabled : true, Keys : [ 'Delete', 'Backspace' ],  Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Edit__NudgeLeft',   Action : 'Edit__NudgeLeft',   Enabled : true, Keys : [ 'ArrowLeft' ],            Modifiers : [], ModifierMatch : 'CoarseOptional' },
                     { Id : 'Edit__NudgeRight',  Action : 'Edit__NudgeRight',  Enabled : true, Keys : [ 'ArrowRight' ],           Modifiers : [], ModifierMatch : 'CoarseOptional' },
                     { Id : 'Edit__NudgeUp',     Action : 'Edit__NudgeUp',     Enabled : true, Keys : [ 'ArrowUp' ],              Modifiers : [], ModifierMatch : 'CoarseOptional' },
                     { Id : 'Edit__NudgeDown',   Action : 'Edit__NudgeDown',   Enabled : true, Keys : [ 'ArrowDown' ],            Modifiers : [], ModifierMatch : 'CoarseOptional' },
                     { Id : 'Tool__Select',      Action : 'Tool__Select',      Enabled : true, Keys : [ 'v', 'V' ],               Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Tool__Move',        Action : 'Tool__Move',        Enabled : true, Keys : [ 'm', 'M' ],               Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Tool__Trim',        Action : 'Tool__Trim',        Enabled : true, Keys : [ 't', 'T' ],               Modifiers : [], ModifierMatch : 'Exact', When : 'InContainer' },
                     { Id : 'Tool__Extend',      Action : 'Tool__Extend',      Enabled : true, Keys : [ 't', 'T' ],               Modifiers : [ 'Shift' ], ModifierMatch : 'Exact' },
                     { Id : 'Tool__Join',        Action : 'Tool__Join',        Enabled : true, Keys : [ 'j', 'J' ],               Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Tool__Split',       Action : 'Tool__Split',       Enabled : true, Keys : [ 'u', 'U' ],               Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Tool__Offset',      Action : 'Tool__Offset',      Enabled : true, Keys : [ 'f', 'F' ],               Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Tool__Fillet',      Action : 'Tool__Fillet',      Enabled : true, Keys : [ 'f', 'F' ],               Modifiers : [ 'Shift' ], ModifierMatch : 'Exact' },
                     { Id : 'Tool__Chamfer',     Action : 'Tool__Chamfer',     Enabled : true, Keys : [ 'c', 'C' ],               Modifiers : [ 'Shift' ], ModifierMatch : 'Exact' },
                     { Id : 'Tool__Text',        Action : 'Tool__Text',        Enabled : true, Keys : [ 't', 'T' ],               Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Tool__Dimension',   Action : 'Tool__Dimension',   Enabled : true, Keys : [ 'd', 'D' ],               Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Snap__Toggle',      Action : 'Snap__Toggle',      Enabled : true, Keys : [ 'F3' ],                   Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Ortho__Toggle',     Action : 'Ortho__Toggle',     Enabled : true, Keys : [ 'F8' ],                   Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'View__DraftToggle', Action : 'View__DraftToggle', Enabled : true, Keys : [ 'k', 'K' ],               Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'View__GridToggle',  Action : 'View__GridToggle',  Enabled : true, Keys : [ 'F6' ],                   Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Snap__GridToggle',  Action : 'Snap__GridToggle',  Enabled : true, Keys : [ 'F7' ],                   Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'View__AxesToggle',  Action : 'View__AxesToggle',  Enabled : true, Keys : [ 'F9' ],                   Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Edit__Save',        Action : 'Edit__Save',        Enabled : true, Keys : [ 's', 'S' ],               Modifiers : [ 'Ctrl' ], ModifierMatch : 'Exact' },
                     { Id : 'Edit__Undo',        Action : 'Edit__Undo',        Enabled : true, Keys : [ 'z', 'Z' ],               Modifiers : [ 'Ctrl' ], ModifierMatch : 'Exact' },
                     { Id : 'Edit__Redo',        Action : 'Edit__Redo',        Enabled : true, Keys : [ 'y', 'Y' ],               Modifiers : [ 'Ctrl' ], ModifierMatch : 'Exact' },
                     { Id : 'Edit__RedoShift',   Action : 'Edit__Redo',        Enabled : true, Keys : [ 'z', 'Z' ],               Modifiers : [ 'Ctrl', 'Shift' ], ModifierMatch : 'Exact' },
                     { Id : 'Tool__SelectSpace', Action : 'Tool__SelectToggle', Enabled : true, Keys : [ ' ' ],                   Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Edit__Finish',      Action : 'Edit__Finish',      Enabled : true, Keys : [ 'Enter' ],                Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Tool__Draw',        Action : 'Tool__Draw',        Enabled : true, Keys : [ 'l', 'L' ],               Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Tool__Rectangle',   Action : 'Tool__Rectangle',   Enabled : true, Keys : [ 'r', 'R' ],               Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Tool__Circle',      Action : 'Tool__Circle',      Enabled : true, Keys : [ 'c', 'C' ],               Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Tool__Arc',         Action : 'Tool__Arc',         Enabled : true, Keys : [ 'a', 'A' ],               Modifiers : [ 'Shift' ], ModifierMatch : 'Exact' },
                     { Id : 'Tool__Leader',      Action : 'Tool__Leader',      Enabled : true, Keys : [ 'e', 'E' ],               Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Tool__FloorArea',   Action : 'Tool__FloorArea',   Enabled : true, Keys : [ 'a', 'A' ],               Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Tool__EyedropperPalette', Action : 'Tool__EyedropperPalette', Enabled : true, Keys : [ 'b', 'B' ], Modifiers : [ 'Shift' ], ModifierMatch : 'Exact' },
                     { Id : 'Tool__Eyedropper',  Action : 'Tool__Eyedropper',  Enabled : true, Keys : [ 'b', 'B' ],               Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Edit__Ungroup',     Action : 'Edit__Ungroup',     Enabled : true, Keys : [ 'g', 'G' ],               Modifiers : [ 'Ctrl', 'Shift' ], ModifierMatch : 'Exact' },
                     { Id : 'Edit__Group',       Action : 'Edit__Group',       Enabled : true, Keys : [ 'g', 'G' ],               Modifiers : [ 'Ctrl' ], ModifierMatch : 'Exact' },
                     { Id : 'Edit__Copy',        Action : 'Edit__Copy',        Enabled : true, Keys : [ 'c', 'C' ],               Modifiers : [ 'Ctrl' ], ModifierMatch : 'Exact' },
                     { Id : 'Edit__Cut',         Action : 'Edit__Cut',         Enabled : true, Keys : [ 'x', 'X' ],               Modifiers : [ 'Ctrl' ], ModifierMatch : 'Exact' },
                     { Id : 'Edit__Paste',       Action : 'Edit__Paste',       Enabled : true, Keys : [ 'v', 'V' ],               Modifiers : [ 'Ctrl' ], ModifierMatch : 'Exact' },
                     { Id : 'Edit__Duplicate',   Action : 'Edit__Duplicate',   Enabled : true, Keys : [ 'd', 'D' ],               Modifiers : [ 'Ctrl' ], ModifierMatch : 'Exact' } ],
        keyboardSetup : { ignoreWhenTyping : true, coarseStepModifier : 'Shift', nudgeStepMm : 1, nudgeCoarseStepMm : 10,
                          panStepPx : 60, panCoarseStepPx : 240, zoomKeyStep : 1.15 },
        touch    : { oneFingerPanOnStage : true, oneFingerPanOnPaper : false, twoFingerPan : true, pinchZoom : true,
                     doubleTapFit : true, doubleTapWindowMs : 320, doubleTapSlopPx : 24, panStartSlopPx : 6, pinchStartSlopPx : 8 },
        selection : { list : [ { Id : 'Select__Remove', Action : 'Select__Remove', Enabled : true, Modifiers : [ 'Ctrl', 'Shift' ], ModifierMatch : 'Exact' },
                               { Id : 'Select__Add',    Action : 'Select__Add',    Enabled : true, Modifiers : [ 'Ctrl' ],          ModifierMatch : 'Exact' },
                               { Id : 'Select__Toggle', Action : 'Select__Toggle', Enabled : true, Modifiers : [ 'Shift' ],         ModifierMatch : 'Exact' } ],
                      boxAnywhereModifier : 'Alt', copyDragModifier : 'Ctrl' },
        measure   : { start : '0123456789.,-', typing : '0123456789.,-+ xX*;mMcC', array : 'xX*/', commit : [ 'Enter' ], clear : [ 'Escape', 'Delete' ], erase : [ 'Backspace' ] }
    });
    // ------------------------------------------------------------

    // MODULE VARIABLES | Parsed Key Map
    // ------------------------------------------------------------
    let Na__LeCfg__KeyMap          = null;
    let Na__LeCfg__KeyMapHandedIn  = false;   // <-- A key map handed in (SetKeyMap) is never replaced by a re-read of the file
    let Na__LeCfg__KeyMapReading   = null;    // <-- The re-read in flight, shared by a second call
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Private Key Map Reading
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Fetch the Key Map JSON Once
    // ------------------------------------------------------------
    async function Na__LeCfg__FetchKeyMap() {
        const keeping = () => (Na__LeCfg__KeyMap ? 'the bindings already loaded stay in force.' : 'using built-in bindings.');
        try {
            const response = await fetch(Na__LeCfg__KeyMapUrl, { cache : 'no-store' });
            if (!response.ok) {
                console.warn('[TrueVision3D LayoutEditor] Key map fetch failed (' + response.status + ') - ' + keeping());
                return false;
            }
            Na__LeCfg__KeyMap = await response.json();                        // <-- Only a file that parsed replaces the map in force
            return true;
        } catch (error) {
            console.warn('[TrueVision3D LayoutEditor] Key map unreadable - ' + keeping(), error);
            return false;
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Read the Key File Again (a drawing tab opened from another tab)
    // ------------------------------------------------------------
    // Never throws and never drops a working key map. FetchKeyMap replaces the
    // map only once the new file has loaded and parsed, so the bindings in
    // force stay until then, and a read that fails keeps them: only a first
    // load that fails leaves the built-in list. A second call while a read is
    // out shares it. A key map handed in through SetKeyMap - a personal one -
    // stays exactly as it was handed in. Resolves true when a file was read.
    // ------------------------------------------------------------
    function Na__LeCfg__ReloadKeyMap() {
        if (Na__LeCfg__KeyMapHandedIn) return Promise.resolve(false);
        if (!Na__LeCfg__KeyMapReading) Na__LeCfg__KeyMapReading = Na__LeCfg__FetchKeyMap().finally(() => { Na__LeCfg__KeyMapReading = null; });
        return Na__LeCfg__KeyMapReading;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Key Map and Binding Resolution
// -----------------------------------------------------------------------------
//
// The control modules never name a button or a key. They describe what the
// user did and ask here what it means, so a binding is changed by editing
// Na__Hotkeys__DrawingTabs__.json and nothing else. A user personalisation
// screen can later write overrides in the same shape and hand them in through
// SetKeyMap without a single control module changing.
//

    // MODULE CONSTANTS | The Modifiers a Binding May Name
    // ------------------------------------------------------------
    const Na__LeCfg__MODIFIERS = [ 'Ctrl', 'Shift', 'Alt', 'Meta', 'Space' ];
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read a Value From a Key Map Block
    // ------------------------------------------------------------
    function Na__LeCfg__KeyVal(blockName, keyName, fallback) {
        const block = Na__LeCfg__KeyMap ? Na__LeCfg__KeyMap[Na__LeCfg__PREFIX + blockName + '__Config'] : null;
        const value = block ? block[Na__LeCfg__PREFIX + blockName + '__' + keyName] : undefined;
        return (value === undefined || value === null) ? fallback : value;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read a Binding List, or the Built-In One
    // ------------------------------------------------------------
    function Na__LeCfg__KeyList(blockName, fallbackList) {
        const list = Na__LeCfg__KeyVal(blockName, 'List', null);
        return Array.isArray(list) ? list : fallbackList;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Whether the Held Modifiers Satisfy One Binding
    // ------------------------------------------------------------
    // Exact means the named modifiers are the only ones held, which is what
    // stops a ctrl binding from also firing the plain one. Any ignores
    // modifiers entirely, which is the Lantern Designer behaviour and the
    // shipped default for the wheel and the pan. CoarseOptional is Exact with
    // the coarse step modifier forgiven, so shift can grow a nudge without
    // needing a second binding for every arrow key.
    function Na__LeCfg__ModifiersSatisfy(binding, held) {
        const mode = binding.ModifierMatch || 'Exact';
        if (mode === 'Any') return true;
        const named   = Array.isArray(binding.Modifiers) ? binding.Modifiers : [];
        const forgive = (mode === 'CoarseOptional') ? Na__LeCfg__KeyVal('KeyboardBindings', 'CoarseStepModifier', Na__LeCfg__KEYMAP_FALLBACK.keyboardSetup.coarseStepModifier) : null;
        for (let i = 0; i < Na__LeCfg__MODIFIERS.length; i++) {
            const name = Na__LeCfg__MODIFIERS[i];
            if (name === forgive) continue;
            if (!!held[name] !== (named.indexOf(name) !== -1)) return false;
        }
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Hand a Key Map In (a saved user personalisation)
    // ------------------------------------------------------------
    function Na__LeCfg__SetKeyMap(keyMap) {
        Na__LeCfg__KeyMap = (keyMap && typeof keyMap === 'object') ? keyMap : null;
        Na__LeCfg__KeyMapHandedIn = !!Na__LeCfg__KeyMap;                     // <-- Kept over the shipped file until it is handed back (null)
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Guard Selectors
    // ------------------------------------------------------------
    function Na__LeCfg__GetGuards() {
        const fallback = Na__LeCfg__KEYMAP_FALLBACK.guards;
        return {
            pointerIgnoreSelector   : Na__LeCfg__KeyVal('Guards', 'PointerIgnoreSelector',   fallback.pointerIgnoreSelector),
            wheelIgnoreSelector     : Na__LeCfg__KeyVal('Guards', 'WheelIgnoreSelector',     fallback.wheelIgnoreSelector),
            contextMenuKeepSelector : Na__LeCfg__KeyVal('Guards', 'ContextMenuKeepSelector', fallback.contextMenuKeepSelector),
            paperSelector           : Na__LeCfg__KeyVal('Guards', 'PaperSelector',           fallback.paperSelector)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Keyboard Setup
    // ------------------------------------------------------------
    function Na__LeCfg__GetKeyboardSetup() {
        const fallback = Na__LeCfg__KEYMAP_FALLBACK.keyboardSetup;
        return {
            ignoreWhenTyping   : Na__LeCfg__KeyVal('KeyboardBindings', 'IgnoreWhenTyping',   fallback.ignoreWhenTyping) !== false,
            coarseStepModifier : Na__LeCfg__KeyVal('KeyboardBindings', 'CoarseStepModifier', fallback.coarseStepModifier),
            nudgeStepMm        : Na__LeCfg__KeyVal('KeyboardBindings', 'NudgeStepMm',        fallback.nudgeStepMm),
            nudgeCoarseStepMm  : Na__LeCfg__KeyVal('KeyboardBindings', 'NudgeCoarseStepMm',  fallback.nudgeCoarseStepMm),
            panStepPx          : Na__LeCfg__KeyVal('KeyboardBindings', 'PanStepPx',          fallback.panStepPx),
            panCoarseStepPx    : Na__LeCfg__KeyVal('KeyboardBindings', 'PanCoarseStepPx',    fallback.panCoarseStepPx),
            zoomKeyStep        : Na__LeCfg__KeyVal('KeyboardBindings', 'ZoomKeyStep',        fallback.zoomKeyStep)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Touch Setup
    // ------------------------------------------------------------
    function Na__LeCfg__GetTouchSetup() {
        const fallback = Na__LeCfg__KEYMAP_FALLBACK.touch;
        return {
            oneFingerPanOnStage : Na__LeCfg__KeyVal('TouchBindings', 'OneFingerPanOnStage', fallback.oneFingerPanOnStage) !== false,
            oneFingerPanOnPaper : Na__LeCfg__KeyVal('TouchBindings', 'OneFingerPanOnPaper', fallback.oneFingerPanOnPaper) === true,
            twoFingerPan        : Na__LeCfg__KeyVal('TouchBindings', 'TwoFingerPan',        fallback.twoFingerPan) !== false,
            pinchZoom           : Na__LeCfg__KeyVal('TouchBindings', 'PinchZoom',           fallback.pinchZoom) !== false,
            doubleTapFit        : Na__LeCfg__KeyVal('TouchBindings', 'DoubleTapFit',        fallback.doubleTapFit) !== false,
            doubleTapWindowMs   : Na__LeCfg__KeyVal('TouchBindings', 'DoubleTapWindowMs',   fallback.doubleTapWindowMs),
            doubleTapSlopPx     : Na__LeCfg__KeyVal('TouchBindings', 'DoubleTapSlopPx',     fallback.doubleTapSlopPx),
            panStartSlopPx      : Na__LeCfg__KeyVal('TouchBindings', 'PanStartSlopPx',      fallback.panStartSlopPx),
            pinchStartSlopPx    : Na__LeCfg__KeyVal('TouchBindings', 'PinchStartSlopPx',    fallback.pinchStartSlopPx)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Keys the Measurements Box Reads
    // ------------------------------------------------------------
    // start and typing are strings of single characters: what may begin a
    // value, and what a begun value may go on to hold. array is what may also
    // begin or continue one while a copy is on offer to be arrayed (3x, *3,
    // /3) - and only then, so x stays a plain key the rest of the time. commit,
    // clear and erase are key names, and act only while something is typed.
    // ------------------------------------------------------------
    function Na__LeCfg__GetMeasureKeys() {
        const fallback = Na__LeCfg__KEYMAP_FALLBACK.measure;
        const chars = (name, fb) => { const value = Na__LeCfg__KeyVal('MeasurementsBox', name, null); return typeof value === 'string' ? value : fb; };
        const keys  = (name, fb) => { const value = Na__LeCfg__KeyVal('MeasurementsBox', name, null); return Array.isArray(value) ? value.filter((k) => typeof k === 'string') : fb.slice(); };
        return {
            start  : chars('StartCharacters', fallback.start),
            typing : chars('TypingCharacters', fallback.typing),
            array  : chars('ArrayCharacters', fallback.array),
            commit : keys('CommitKeys', fallback.commit),
            clear  : keys('ClearKeys', fallback.clear),
            erase  : keys('EraseKeys', fallback.erase)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Mouse or Pen Press Means (null when it means nothing)
    // ------------------------------------------------------------
    // input is { button : 'Left' | 'Middle' | 'Right', modifiers : {...}, emptyStage : bool }
    function Na__LeCfg__MatchPointerBinding(input) {
        if (!input || !input.button) return null;
        const list = Na__LeCfg__KeyList('PointerBindings', Na__LeCfg__KEYMAP_FALLBACK.pointer);
        for (let i = 0; i < list.length; i++) {
            const binding = list[i];
            if (!binding || binding.Enabled === false) continue;
            if (!Array.isArray(binding.Buttons) || binding.Buttons.indexOf(input.button) === -1) continue;
            if (binding.RequiresEmptyStage === true && !input.emptyStage) continue;
            if (!Na__LeCfg__ModifiersSatisfy(binding, input.modifiers || {})) continue;
            return binding.Action || null;
        }
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Wheel Turn Means (null when it means nothing)
    // ------------------------------------------------------------
    function Na__LeCfg__MatchWheelBinding(held) {
        const list = Na__LeCfg__KeyList('WheelBindings', Na__LeCfg__KEYMAP_FALLBACK.wheel);
        for (let i = 0; i < list.length; i++) {
            const binding = list[i];
            if (!binding || binding.Enabled === false) continue;
            if (!Na__LeCfg__ModifiersSatisfy(binding, held || {})) continue;
            return binding.Action || null;
        }
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Key Press Means (null when it means nothing)
    // ------------------------------------------------------------
    // Returns { id, action, coarse } so a caller can size its own step from the
    // coarse modifier without having to know which modifier that is.
    //
    // A BINDING MAY NAME WHEN IT APPLIES ("When": "InContainer"). context is
    // { InContainer : bool, ... } - what the caller knows about the situation
    // the key was pressed in - and a binding with a When is only a match while
    // context says that situation is so. It is how one key means two things
    // without either module knowing about the other: T is the Trim tool while
    // a group or a vector is open for editing and the Text tool out on the
    // sheet. A caller that passes no context never matches a When binding, so
    // every reader from before contexts existed resolves every key as it did.
    function Na__LeCfg__MatchKeyBinding(key, held, context) {
        if (typeof key !== 'string' || !key) return null;
        const list   = Na__LeCfg__KeyList('KeyboardBindings', Na__LeCfg__KEYMAP_FALLBACK.keyboard);
        const coarse = !!(held && held[Na__LeCfg__GetKeyboardSetup().coarseStepModifier]);
        for (let i = 0; i < list.length; i++) {
            const binding = list[i];
            if (!binding || binding.Enabled === false) continue;
            if (!Array.isArray(binding.Keys) || binding.Keys.indexOf(key) === -1) continue;
            if (!Na__LeCfg__ModifiersSatisfy(binding, held || {})) continue;
            if (typeof binding.When === 'string' && binding.When && !(context && context[binding.When] === true)) continue;   // <-- Not the situation this binding is for
            return { id : binding.Id || null, action : binding.Action || null, coarse : coarse };
        }
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | What the Modifiers Held on a Select Press Mean
    // ------------------------------------------------------------
    // held is { Ctrl, Shift, Alt, Meta }. Returns { combine, anywhere, copy }.
    // combine is 'add', 'toggle', 'remove', or null to replace the selection,
    // from the SelectionBindings list; the box-anywhere modifier is set aside
    // before the list is tested, so Alt+Shift still toggles. anywhere says a
    // drag draws a box even from on top of something that could be moved.
    // copy says the copy-drag modifier is held, so a move that starts from this
    // press carries a copy. It is NOT set aside: Ctrl still adds an unselected
    // item at the press, as LayOut's does, and the drag then copies the lot.
    // ------------------------------------------------------------
    function Na__LeCfg__MatchSelectionModifier(held) {
        const fallback = Na__LeCfg__KEYMAP_FALLBACK.selection;
        const name     = Na__LeCfg__KeyVal('SelectionBindings', 'BoxAnywhereModifier', fallback.boxAnywhereModifier);
        const rest     = Object.assign({}, held || {});
        const anywhere = Na__LeCfg__MODIFIERS.indexOf(name) !== -1 && !!rest[name];
        const copyName = Na__LeCfg__GetCopyDragModifier();
        const copy     = !!copyName && !!(held || {})[copyName];
        if (anywhere) rest[name] = false;
        const combines = { Select__Add : 'add', Select__Toggle : 'toggle', Select__Remove : 'remove' };
        const list     = Na__LeCfg__KeyList('SelectionBindings', fallback.list);
        for (let i = 0; i < list.length; i++) {
            const binding = list[i];
            if (!binding || binding.Enabled === false || !combines[binding.Action]) continue;
            if (Na__LeCfg__ModifiersSatisfy(binding, rest)) return { combine : combines[binding.Action], anywhere : anywhere, copy : copy };
        }
        return { combine : null, anywhere : anywhere, copy : copy };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Modifier That Makes a Move Carry a Copy (null when switched off)
    // ------------------------------------------------------------
    // SketchUp LayOut's Ctrl-drag: held on the press of a move, or pressed
    // during one, the drag carries a copy and leaves the original where it
    // was. Space is never it - it is the pan's. An empty value switches
    // copying by drag off.
    // ------------------------------------------------------------
    function Na__LeCfg__GetCopyDragModifier() {
        const name = Na__LeCfg__KeyVal('SelectionBindings', 'CopyDragModifier', Na__LeCfg__KEYMAP_FALLBACK.selection.copyDragModifier);
        return (name !== 'Space' && Na__LeCfg__MODIFIERS.indexOf(name) !== -1) ? name : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is This Key (a KeyboardEvent key) the Copy-Drag Modifier Itself
    // ------------------------------------------------------------
    // What the key reports when it goes down on its own: Ctrl is 'Control'.
    // The sheet tools flip a move in flight between a copy and a move on it.
    // ------------------------------------------------------------
    function Na__LeCfg__IsCopyDragKey(key) {
        const name = Na__LeCfg__GetCopyDragModifier();
        const keys = { Ctrl : 'Control', Shift : 'Shift', Alt : 'Alt', Meta : 'Meta' };
        return !!name && keys[name] === key;
    }
    // ------------------------------------------------------------


    // FUNCTION | Whether Any Enabled Pointer Binding Wants a Given Modifier
    // ------------------------------------------------------------
    // The PC module asks this before it takes the space bar away from the
    // browser, so space keeps scrolling the stage while no binding uses it.
    function Na__LeCfg__IsPointerModifierBound(name) {
        const list = Na__LeCfg__KeyList('PointerBindings', Na__LeCfg__KEYMAP_FALLBACK.pointer);
        for (let i = 0; i < list.length; i++) {
            const binding = list[i];
            if (!binding || binding.Enabled === false) continue;
            if ((binding.ModifierMatch || 'Exact') === 'Any') continue;
            if (Array.isArray(binding.Modifiers) && binding.Modifiers.indexOf(name) !== -1) return true;
        }
        return false;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Bindable Action Catalogue (for a personalisation screen)
    // ------------------------------------------------------------
    function Na__LeCfg__GetActionCatalogue() {
        const list = Na__LeCfg__KeyVal('Actions', 'List', null);
        return Array.isArray(list) ? list : [];
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Config State Key Map
    // ------------------------------------------------------------
    export {
        Na__LeCfg__FetchKeyMap,
        Na__LeCfg__ReloadKeyMap,
        Na__LeCfg__SetKeyMap,
        Na__LeCfg__GetGuards,
        Na__LeCfg__GetKeyboardSetup,
        Na__LeCfg__GetTouchSetup,
        Na__LeCfg__GetMeasureKeys,
        Na__LeCfg__MatchPointerBinding,
        Na__LeCfg__MatchWheelBinding,
        Na__LeCfg__MatchKeyBinding,
        Na__LeCfg__MatchSelectionModifier,
        Na__LeCfg__GetCopyDragModifier,
        Na__LeCfg__IsCopyDragKey,
        Na__LeCfg__IsPointerModifierBound,
        Na__LeCfg__GetActionCatalogue
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
