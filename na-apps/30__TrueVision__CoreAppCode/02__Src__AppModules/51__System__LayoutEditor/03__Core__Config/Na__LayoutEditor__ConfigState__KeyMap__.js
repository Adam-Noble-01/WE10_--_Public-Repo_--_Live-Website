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
// - Fetches Na__LayoutEditor__KeyMappings__.json and holds the parsed key map
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
    const Na__LeCfg__KeyMapUrl  = new URL('./Na__LayoutEditor__KeyMappings__.json', import.meta.url);
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Key Map Fallback (mirrors the enabled defaults in the shipped JSON)
    // ------------------------------------------------------------
    // Only the bindings that ship switched on are repeated here. A failed
    // fetch therefore still leaves a sheet that zooms and pans exactly the
    // way Lantern Designer does, rather than one that cannot be moved.
    const Na__LeCfg__KEYMAP_FALLBACK = Object.freeze({
        guards   : { pointerIgnoreSelector   : 'input, select, button, textarea, canvas, [contenteditable="true"]',
                     wheelIgnoreSelector     : 'canvas',
                     contextMenuKeepSelector : 'input, select, button, textarea, [contenteditable="true"]',
                     paperSelector           : '.na-le-paper' },
        pointer  : [ { Id : 'Pan__MiddleOrRightDrag', Action : 'Nav__Pan', Enabled : true, Buttons : [ 'Middle', 'Right' ], Modifiers : [], ModifierMatch : 'Any' } ],
        wheel    : [ { Id : 'Zoom__Wheel', Action : 'Nav__ZoomAtCursor', Enabled : true, Modifiers : [], ModifierMatch : 'Any' } ],
        keyboard : [ { Id : 'Edit__Cancel',      Action : 'Edit__Cancel',      Enabled : true, Keys : [ 'Escape' ],               Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Edit__Delete',      Action : 'Edit__Delete',      Enabled : true, Keys : [ 'Delete', 'Backspace' ],  Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Edit__NudgeLeft',   Action : 'Edit__NudgeLeft',   Enabled : true, Keys : [ 'ArrowLeft' ],            Modifiers : [], ModifierMatch : 'CoarseOptional' },
                     { Id : 'Edit__NudgeRight',  Action : 'Edit__NudgeRight',  Enabled : true, Keys : [ 'ArrowRight' ],           Modifiers : [], ModifierMatch : 'CoarseOptional' },
                     { Id : 'Edit__NudgeUp',     Action : 'Edit__NudgeUp',     Enabled : true, Keys : [ 'ArrowUp' ],              Modifiers : [], ModifierMatch : 'CoarseOptional' },
                     { Id : 'Edit__NudgeDown',   Action : 'Edit__NudgeDown',   Enabled : true, Keys : [ 'ArrowDown' ],            Modifiers : [], ModifierMatch : 'CoarseOptional' },
                     { Id : 'Tool__Select',      Action : 'Tool__Select',      Enabled : true, Keys : [ 'v', 'V' ],               Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Tool__Text',        Action : 'Tool__Text',        Enabled : true, Keys : [ 't', 'T' ],               Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Tool__Dimension',   Action : 'Tool__Dimension',   Enabled : true, Keys : [ 'd', 'D' ],               Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Snap__Toggle',      Action : 'Snap__Toggle',      Enabled : true, Keys : [ 'F3' ],                   Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Edit__Undo',        Action : 'Edit__Undo',        Enabled : true, Keys : [ 'z', 'Z' ],               Modifiers : [ 'Ctrl' ], ModifierMatch : 'Exact' },
                     { Id : 'Edit__Redo',        Action : 'Edit__Redo',        Enabled : true, Keys : [ 'y', 'Y' ],               Modifiers : [ 'Ctrl' ], ModifierMatch : 'Exact' },
                     { Id : 'Edit__RedoShift',   Action : 'Edit__Redo',        Enabled : true, Keys : [ 'z', 'Z' ],               Modifiers : [ 'Ctrl', 'Shift' ], ModifierMatch : 'Exact' },
                     { Id : 'Edit__Deselect',    Action : 'Edit__Deselect',    Enabled : true, Keys : [ ' ' ],                    Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Edit__Finish',      Action : 'Edit__Finish',      Enabled : true, Keys : [ 'Enter' ],                Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Tool__Draw',        Action : 'Tool__Draw',        Enabled : true, Keys : [ 'l', 'L' ],               Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Tool__Rectangle',   Action : 'Tool__Rectangle',   Enabled : true, Keys : [ 'r', 'R' ],               Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Tool__Leader',      Action : 'Tool__Leader',      Enabled : true, Keys : [ 'e', 'E' ],               Modifiers : [], ModifierMatch : 'Exact' },
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
                      boxAnywhereModifier : 'Alt' },
        measure   : { start : '0123456789.,-', typing : '0123456789.,-+ xX*;mMcC', commit : [ 'Enter' ], clear : [ 'Escape', 'Delete' ], erase : [ 'Backspace' ] }
    });
    // ------------------------------------------------------------

    // MODULE VARIABLES | Parsed Key Map
    // ------------------------------------------------------------
    let Na__LeCfg__KeyMap      = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Private Key Map Reading
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Fetch the Key Map JSON Once
    // ------------------------------------------------------------
    async function Na__LeCfg__FetchKeyMap() {
        try {
            const response = await fetch(Na__LeCfg__KeyMapUrl, { cache : 'no-store' });
            if (!response.ok) {
                console.warn('[TrueVision3D LayoutEditor] Key map fetch failed (' + response.status + ') - using built-in bindings.');
                return false;
            }
            Na__LeCfg__KeyMap = await response.json();
            return true;
        } catch (error) {
            console.warn('[TrueVision3D LayoutEditor] Key map unreadable - using built-in bindings.', error);
            return false;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Key Map and Binding Resolution
// -----------------------------------------------------------------------------
//
// The control modules never name a button or a key. They describe what the
// user did and ask here what it means, so a binding is changed by editing
// Na__LayoutEditor__KeyMappings__.json and nothing else. A user personalisation
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
    // value, and what a begun value may go on to hold. commit, clear and
    // erase are key names, and act only while something is typed.
    // ------------------------------------------------------------
    function Na__LeCfg__GetMeasureKeys() {
        const fallback = Na__LeCfg__KEYMAP_FALLBACK.measure;
        const chars = (name, fb) => { const value = Na__LeCfg__KeyVal('MeasurementsBox', name, null); return typeof value === 'string' ? value : fb; };
        const keys  = (name, fb) => { const value = Na__LeCfg__KeyVal('MeasurementsBox', name, null); return Array.isArray(value) ? value.filter((k) => typeof k === 'string') : fb.slice(); };
        return {
            start  : chars('StartCharacters', fallback.start),
            typing : chars('TypingCharacters', fallback.typing),
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
    function Na__LeCfg__MatchKeyBinding(key, held) {
        if (typeof key !== 'string' || !key) return null;
        const list   = Na__LeCfg__KeyList('KeyboardBindings', Na__LeCfg__KEYMAP_FALLBACK.keyboard);
        const coarse = !!(held && held[Na__LeCfg__GetKeyboardSetup().coarseStepModifier]);
        for (let i = 0; i < list.length; i++) {
            const binding = list[i];
            if (!binding || binding.Enabled === false) continue;
            if (!Array.isArray(binding.Keys) || binding.Keys.indexOf(key) === -1) continue;
            if (!Na__LeCfg__ModifiersSatisfy(binding, held || {})) continue;
            return { id : binding.Id || null, action : binding.Action || null, coarse : coarse };
        }
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | What the Modifiers Held on a Select Press Mean
    // ------------------------------------------------------------
    // held is { Ctrl, Shift, Alt, Meta }. Returns { combine, anywhere }. combine
    // is 'add', 'toggle', 'remove', or null to replace the selection, from the
    // SelectionBindings list; the box-anywhere modifier is set aside before the
    // list is tested, so Alt+Shift still toggles. anywhere says a drag draws a
    // box even from on top of something that could be moved.
    // ------------------------------------------------------------
    function Na__LeCfg__MatchSelectionModifier(held) {
        const fallback = Na__LeCfg__KEYMAP_FALLBACK.selection;
        const name     = Na__LeCfg__KeyVal('SelectionBindings', 'BoxAnywhereModifier', fallback.boxAnywhereModifier);
        const rest     = Object.assign({}, held || {});
        const anywhere = Na__LeCfg__MODIFIERS.indexOf(name) !== -1 && !!rest[name];
        if (anywhere) rest[name] = false;
        const combines = { Select__Add : 'add', Select__Toggle : 'toggle', Select__Remove : 'remove' };
        const list     = Na__LeCfg__KeyList('SelectionBindings', fallback.list);
        for (let i = 0; i < list.length; i++) {
            const binding = list[i];
            if (!binding || binding.Enabled === false || !combines[binding.Action]) continue;
            if (Na__LeCfg__ModifiersSatisfy(binding, rest)) return { combine : combines[binding.Action], anywhere : anywhere };
        }
        return { combine : null, anywhere : anywhere };
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
        Na__LeCfg__SetKeyMap,
        Na__LeCfg__GetGuards,
        Na__LeCfg__GetKeyboardSetup,
        Na__LeCfg__GetTouchSetup,
        Na__LeCfg__GetMeasureKeys,
        Na__LeCfg__MatchPointerBinding,
        Na__LeCfg__MatchWheelBinding,
        Na__LeCfg__MatchKeyBinding,
        Na__LeCfg__MatchSelectionModifier,
        Na__LeCfg__IsPointerModifierBound,
        Na__LeCfg__GetActionCatalogue
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
