// =============================================================================
// TRUEVISION3D - VEGETATION - THE DEV PANELS' SHELL
// =============================================================================
//
// FILE       : Na__Vegetation__PanelShell__.js
// NAMESPACE  : Na__VegShell
// MODULE     : System - Vegetation
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : What every vegetation dev panel shares: the floating panel itself, its
//              rows and sliders, Save Vegetation, Undo and Redo, and the close guard
// CREATED    : 04-Nov-2026
//
// DESCRIPTION:
// - THE DEMO'S PANELS, IN THE APP. White panels floating over the model, as the look Adam
//   agreed in the prototype. An author's only: nothing here loads for anybody else.
// - SAVE IS A BUTTON (plan, D18): "as Save Drawing: red when changed, syncing, green".
//   Every panel shows the same state, because they are all one object. Tools change the
//   object freely, and undo works, until somebody means it.
// - CLOSING WITH UNSAVED CHANGES ASKS FIRST, with the browser's own question.
// - A PANEL OPENING ON THE RIGHT SHUTS TOOLS & SETTINGS: it would sit on the menu. The panel on
//   the left is opened by unfolding Vegetation in that menu (Adam, 06-Nov-2026), so it leaves the
//   menu as it is, and says when it closes so the menu's section folds with it.
// - AN UNDONE STEP BRINGS THE PICTURE BACK INTO LINE through the runtime, whichever panel
//   the key was pressed in.
//
// INTEGRATION:
// - Styles: ./Na__Vegetation__Styles__Panels__.css, added to the page on first use.
// - Used by ./Na__Vegetation__AssetBrowser__.js, ./Na__Vegetation__LineworkPanel__.js,
//   ./Na__Vegetation__PaletteEditor__.js and the tools in ../20__System__Tools.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 24__System__Vegetation/10__Ui__Panels/Na__Vegetation__PanelShell__.js (ValeVision3D v2.98.6)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : identical (header, console prefix and the Entourage folder's number apart)
// - Divergences   : none in behaviour. Entourage is 28__System__Entourage in TrueVision (its 23
//                   is Scene Sync); the vegetation and entourage READMEs list what differs around it.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 13-Nov-2026 - Version 1.6.1 (ValeVision3D v2.98.4)
// - Save Vegetation's hover text: it saves Show Vegetation and Transparency as everyone will open it.
//
// 11-Nov-2026 - Version 1.6.0 (ValeVision3D v2.96.0)
// - A staff save goes straight in: Save Vegetation says so. Saved before a drawing opens (Na__Vegetation__).
//
// 11-Nov-2026 - Version 1.5.0 (ValeVision3D v2.94.2)
// - Undo, Redo and Save Vegetation carry graphics (AddGlyph), in the words' own colour.
//
// 06-Nov-2026 - Version 1.4.0 (ValeVision3D v2.91.0)
// - A panel can carry an icon in its title and be the dropdown sections' panel. Only a panel on the
//   right shuts Tools & Settings. Closing a panel says so (CLOSED_EVENT).
//
// 05-Nov-2026 - Version 1.3.0 (ValeVision3D v2.89.0)
// - A save tells an Employee that it waits for an admin. AfterReplaced brings the picture, the undo steps and the panels into line when somebody else's work comes back. The right-click menu's stylesheet is added too.
//
// 05-Nov-2026 - Version 1.2.0 (ValeVision3D v2.88.0)
// - One panel a side across plants and people: each shell says when it opens one, and closes its own on that side when the other does. An undo key taken by one is not taken again by the other.
//
// 04-Nov-2026 - Version 1.1.0 (ValeVision3D v2.86.0)
// - PlantScaleSlider, the one Plant scale row every panel has, its range from the config.
//
// 04-Nov-2026 - Version 1.0.0 (ValeVision3D v2.85.0)
// - Initial build: Stage 4 of ValeVision__PLAN__VegetationSystem__.md.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Vegetation's Data and Keyboard Scope
    // ------------------------------------------------------------
    import {
        Na__VegData__DIRTY_EVENT,
        Na__VegData__IsDirty,
        Na__VegData__SetDirty,
        Na__VegData__Save,
        Na__VegData__LoadConfig
    } from '../02__Core__Data/Na__Vegetation__SceneData__.js';
    import {
        Na__VegHist__EVENT,
        Na__VegHist__Reset,
        Na__VegHist__Push,
        Na__VegHist__Undo,
        Na__VegHist__Redo,
        Na__VegHist__CanUndo,
        Na__VegHist__CanRedo
    } from '../02__Core__Data/Na__Vegetation__History__.js';
    import {
        Na__VegRun__SyncPlants,
        Na__VegRun__ApplyLineRules,
        Na__VegRun__GetSceneData
    } from '../03__System__SceneLayer/Na__Vegetation__Runtime__.js';
    import { Na__KeyScope__Is, Na__KeyScope__MODEL, Na__KeyScope__IsTypingTarget } from '../../03__AppUtils/Na__AppUtils__KeyScope__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and Variables
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Stylesheet, and How Long Saved Stays Green
    // ------------------------------------------------------------
    const Na__VegShell__STYLES_URL = new URL('./Na__Vegetation__Styles__Panels__.css', import.meta.url);
    const Na__VegShell__MENU_STYLES_URL = new URL('../../28__System__Entourage/10__Ui__Panels/Na__Entourage__Styles__Panels__.css', import.meta.url);   // <-- The right-click menu is the people's
    const Na__VegShell__SAVED_MS   = 2000;
    const Na__VegShell__OPENING_EVENT = 'na-asset-panel-opening';              // <-- Entourage's shell says and hears this too: one panel a side, whoever opened it
    const Na__VegShell__CLOSED_EVENT  = 'na-vegetation-panel-closed';          // <-- detail { id, side }: the menu section folds when the panel on the left goes
    const Na__VegShell__OWNER      = 'vegetation';
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Open Panels and the Buttons Showing Save State
    // ------------------------------------------------------------
    const Na__VegShell__State = {
        context     : null,
        config      : null,
        prepared    : false,
        sceneData   : null,                                                    // <-- The object the undo steps belong to
        panels      : new Map(),                                               // <-- id -> { root, onClose }
        saveButtons : new Set(),
        undoButtons : new Set(),
        redoButtons : new Set(),
        saving      : false,
        savedUntil  : 0,
        savedTimer  : 0
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Elements
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Make an Element
    // ------------------------------------------------------------
    function Na__VegShell__El(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined) el.textContent = text;
        return el;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Make a Small Button
    // ------------------------------------------------------------
    function Na__VegShell__Button(text, className, onClick, title) {
        const button = Na__VegShell__El('button', 'na-veg-btn' + (className ? ' ' + className : ''), text);
        button.type = 'button';
        if (title) button.title = title;
        if (onClick) button.addEventListener('click', onClick);
        return button;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put a Graphic Before a Button's Words
    // ------------------------------------------------------------
    // Adam, 11-Nov-2026: "Undo (Add graphic)  Redo (Add graphic)   Save Vegetation (Add graphic)".
    // name: 'undo', 'redo' or 'save', a class in the panels' stylesheet that masks the Tools menu's
    // icon over the words' own colour, so it is white on the red Save and as faint as the words
    // when the button cannot be used. The words go in a span of their own, for PaintSave.
    // ------------------------------------------------------------
    function Na__VegShell__AddGlyph(button, name) {
        const label = Na__VegShell__El('span', 'na-veg-btn__label', button.textContent);
        const glyph = Na__VegShell__El('span', 'na-veg-glyph na-veg-glyph--' + name);
        glyph.setAttribute('aria-hidden', 'true');
        button.textContent = '';
        button.appendChild(glyph);
        button.appendChild(label);
        button.classList.add('na-veg-btn--glyph');
        return button;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Slider with Its Name and Value
    // ------------------------------------------------------------
    // options: { label, min, max, step, value, format, onInput, onChange, title }
    // Returns { row, input, setValue }.
    // ------------------------------------------------------------
    function Na__VegShell__Slider(options) {
        const format = options.format || ((value) => Number(value).toFixed(2));
        const row    = Na__VegShell__El('label', 'na-veg-slider');
        if (options.title) row.title = options.title;
        const top = Na__VegShell__El('div', 'na-veg-slider__top');
        top.appendChild(Na__VegShell__El('span', 'na-veg-slider__label', options.label));
        const readout = Na__VegShell__El('span', 'na-veg-slider__value');
        top.appendChild(readout);
        row.appendChild(top);

        const input = Na__VegShell__El('input', 'na-veg-slider__input');
        input.type = 'range';
        input.min  = options.min;
        input.max  = options.max;
        input.step = options.step;

        const setValue = (value) => {
            input.value = value;
            readout.textContent = format(Number(value));
        };
        setValue(options.value);

        input.addEventListener('input', () => {
            readout.textContent = format(Number(input.value));
            if (options.onInput) options.onInput(Number(input.value));
        });
        input.addEventListener('change', () => {
            if (options.onChange) options.onChange(Number(input.value));
        });
        row.appendChild(input);
        return { row, input, setValue };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Plant Scale Slider, Whichever Panel It Is In
    // ------------------------------------------------------------
    // options: { label, value, title, onInput, onChange }. The range is the config's.
    // ------------------------------------------------------------
    function Na__VegShell__PlantScaleSlider(options) {
        const config = Na__VegShell__Config().Vegetation__DevTools__Config;
        return Na__VegShell__Slider({
            label    : options.label || 'Plant scale',
            title    : options.title,
            min      : config.Vegetation__DevTools__PlantScaleMin,
            max      : config.Vegetation__DevTools__PlantScaleMax,
            step     : config.Vegetation__DevTools__PlantScaleStep,
            value    : options.value > 0 ? options.value : 1,
            format   : (value) => Number(value).toFixed(2),
            onInput  : options.onInput,
            onChange : options.onChange
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Tick Box with Its Name
    // ------------------------------------------------------------
    function Na__VegShell__Tick(label, checked, onChange, title) {
        const row = Na__VegShell__El('label', 'na-veg-tick');
        if (title) row.title = title;
        const input = Na__VegShell__El('input', 'na-veg-tick__input');
        input.type = 'checkbox';
        input.checked = checked === true;
        input.addEventListener('change', () => onChange(input.checked));
        row.appendChild(input);
        row.appendChild(Na__VegShell__El('span', '', label));
        return { row, input };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Two or Three Buttons of Which One Is Lit
    // ------------------------------------------------------------
    // choices: [[value, label]...]. Returns { row, setValue }.
    // ------------------------------------------------------------
    function Na__VegShell__Choice(choices, value, onPick) {
        const row = Na__VegShell__El('div', 'na-veg-toggle');
        const buttons = new Map();
        const setValue = (current) => {
            buttons.forEach((button, key) => button.classList.toggle('na-veg-toggle__btn--active', key === current));
        };
        choices.forEach(([key, label]) => {
            const button = Na__VegShell__El('button', 'na-veg-toggle__btn', label);
            button.type = 'button';
            button.addEventListener('click', () => {
                setValue(key);
                onPick(key);
            });
            buttons.set(key, button);
            row.appendChild(button);
        });
        setValue(value);
        return { row, setValue };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Saving
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Say What the Save Buttons Should Say
    // ------------------------------------------------------------
    function Na__VegShell__PaintSave() {
        const state = Na__VegShell__State;
        const dirty = Na__VegData__IsDirty();
        const saved = !dirty && Date.now() < state.savedUntil;
        state.saveButtons.forEach((button) => {
            button.classList.toggle('na-veg-save--dirty', dirty && !state.saving);
            button.classList.toggle('na-veg-save--saving', state.saving);
            button.classList.toggle('na-veg-save--saved', saved && !state.saving);
            button.disabled = state.saving || (!dirty && !saved);
            const label = button.querySelector('.na-veg-btn__label') || button;   // <-- The words only: the graphic stays
            label.textContent = state.saving ? 'Saving...' : (saved ? 'Saved' : 'Save Vegetation');
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Save the Project's Plants
    // ------------------------------------------------------------
    async function Na__VegShell__Save() {
        const state = Na__VegShell__State;
        if (state.saving) return;
        state.saving = true;
        Na__VegShell__PaintSave();
        const result = await Na__VegData__Save();
        state.saving = false;
        const saved = !!(result && result.ok);
        if (saved) {
            state.savedUntil = Date.now() + Na__VegShell__SAVED_MS;
            window.clearTimeout(state.savedTimer);
            state.savedTimer = window.setTimeout(Na__VegShell__PaintSave, Na__VegShell__SAVED_MS + 20);
            if (result.merged) await Na__VegShell__AfterReplaced();
            const counts = result.counts || {};
            if (!result.approvedNow && (counts.added || counts.changed || counts.removed)) {
                Na__VegShell__Toast('Saved. An admin will approve it before clients see it.', false);   // <-- Only with the API's NA_STAFF_SAVES_GO_STRAIGHT_IN off
            }
        } else {
            Na__VegShell__Toast('Vegetation not saved: ' + ((result && result.error) || 'the server did not answer') + '.', true);
        }
        Na__VegShell__PaintSave();
        return saved;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Object Has Been Replaced from the Server: Bring Everything into Line
    // ------------------------------------------------------------
    // Somebody else's work came back with a save, or an approval or a put back has landed. The undo
    // steps are of something that is no longer so, and an undo would quietly undo somebody else.
    // ------------------------------------------------------------
    async function Na__VegShell__AfterReplaced() {
        const state = Na__VegShell__State;
        if (state.config) Na__VegHist__Reset(Na__VegRun__GetSceneData(), state.config.Vegetation__DevTools__Config.Vegetation__DevTools__UndoDepth);
        Na__VegRun__ApplyLineRules();
        await Na__VegRun__SyncPlants();
        window.dispatchEvent(new CustomEvent('na-vegetation-object-replaced'));
    }
    // ------------------------------------------------------------


    // FUNCTION | A Save Vegetation Button
    // ------------------------------------------------------------
    function Na__VegShell__MakeSaveButton() {
        const button = Na__VegShell__AddGlyph(Na__VegShell__Button('Save Vegetation', 'na-veg-save', Na__VegShell__Save, 'Saves your changes in this project, for everyone, clients included, with Show Vegetation and Transparency as everyone will open it. Your name and the time are kept on each plant and path you add'), 'save');
        Na__VegShell__State.saveButtons.add(button);
        Na__VegShell__PaintSave();
        return button;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Object Changed: Say So Everywhere
    // ------------------------------------------------------------
    function Na__VegShell__MarkChanged() {
        Na__VegData__SetDirty(true);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Undo and Redo
// -----------------------------------------------------------------------------

    // FUNCTION | One Step Back or Forward, and Bring the Picture into Line
    // ------------------------------------------------------------
    async function Na__VegShell__StepHistory(forward) {
        const moved = forward ? Na__VegHist__Redo() : Na__VegHist__Undo();
        if (!moved) return false;
        Na__VegShell__MarkChanged();
        Na__VegRun__ApplyLineRules();
        await Na__VegRun__SyncPlants();
        window.dispatchEvent(new CustomEvent('na-vegetation-object-replaced'));   // <-- A panel showing a value reads it again
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Grey the Buttons When There Is Nothing to Do
    // ------------------------------------------------------------
    function Na__VegShell__PaintHistory() {
        Na__VegShell__State.undoButtons.forEach((button) => { button.disabled = !Na__VegHist__CanUndo(); });
        Na__VegShell__State.redoButtons.forEach((button) => { button.disabled = !Na__VegHist__CanRedo(); });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Undo and Redo Keys, While a Panel Is Open on the 3D Model Tab
    // ------------------------------------------------------------
    function Na__VegShell__OnKeyDown(event) {
        if (Na__VegShell__State.panels.size === 0 || event.defaultPrevented) return;
        if (!Na__KeyScope__Is(Na__KeyScope__MODEL)) return;
        if (Na__KeyScope__IsTypingTarget(event.target)) return;
        if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
        const key = event.key.toLowerCase();
        const redo = key === 'y' || (key === 'z' && event.shiftKey);
        const undo = key === 'z' && !event.shiftKey;
        if (!undo && !redo) return;
        event.preventDefault();
        event.stopPropagation();
        Na__VegShell__StepHistory(redo);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Panel
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Panel Means Work on the Model: Shut Tools & Settings
    // ------------------------------------------------------------
    function Na__VegShell__ShutToolsMenu() {
        const menu = document.getElementById('naToolsMenu');
        if (menu && menu.open) menu.open = false;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Panel Open?
    // ------------------------------------------------------------
    function Na__VegShell__IsOpen(id) {
        return Na__VegShell__State.panels.has(id);
    }
    // ------------------------------------------------------------


    // FUNCTION | Close a Panel
    // ------------------------------------------------------------
    function Na__VegShell__Close(id) {
        const entry = Na__VegShell__State.panels.get(id);
        if (!entry) return;
        Na__VegShell__State.panels.delete(id);
        entry.root.querySelectorAll('.na-veg-save').forEach((button) => Na__VegShell__State.saveButtons.delete(button));
        entry.root.querySelectorAll('.na-veg-undo').forEach((button) => Na__VegShell__State.undoButtons.delete(button));
        entry.root.querySelectorAll('.na-veg-redo').forEach((button) => Na__VegShell__State.redoButtons.delete(button));
        entry.root.remove();
        if (entry.onClose) entry.onClose();
        window.dispatchEvent(new CustomEvent(Na__VegShell__CLOSED_EVENT, { detail : { id, side : entry.side } }));
    }
    // ------------------------------------------------------------


    // FUNCTION | Close Every Panel
    // ------------------------------------------------------------
    function Na__VegShell__CloseAll() {
        Array.from(Na__VegShell__State.panels.keys()).forEach(Na__VegShell__Close);
    }
    // ------------------------------------------------------------


    // HANDLER | Another System Is Opening a Panel on a Side
    // ------------------------------------------------------------
    function Na__VegShell__OnOtherOpening(event) {
        const detail = event.detail || {};
        if (detail.owner === Na__VegShell__OWNER) return;
        Na__VegShell__State.panels.forEach((entry, id) => {
            if (entry.side === detail.side) Na__VegShell__Close(id);
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Open a Panel
    // ------------------------------------------------------------
    // options: { id, title, side : 'left' | 'right', width, onClose, icon, hub }
    // icon: an element for the title. hub: the body holds dropdown sections (Na__SceneAssets__Hub__.js).
    // Returns { root, head, body, foot }, or the open one's if it is already up.
    // ------------------------------------------------------------
    function Na__VegShell__Open(options) {
        const state = Na__VegShell__State;
        if (state.panels.has(options.id)) return state.panels.get(options.id).parts;

        // ONE PANEL A SIDE | They would sit on top of each other
        state.panels.forEach((entry, id) => {
            if (entry.side === options.side) Na__VegShell__Close(id);
        });
        window.dispatchEvent(new CustomEvent(Na__VegShell__OPENING_EVENT, { detail : { side : options.side, owner : Na__VegShell__OWNER } }));

        const root = Na__VegShell__El('aside', 'na-veg-panel na-veg-panel--' + options.side + (options.hub ? ' na-veg-panel--hub' : ''));
        root.id = options.id;
        if (options.width) root.style.width = options.width + 'px';

        const head  = Na__VegShell__El('div', 'na-veg-panel__head');
        const title = Na__VegShell__El('button', 'na-veg-panel__title');
        if (options.icon) title.appendChild(options.icon);
        title.appendChild(Na__VegShell__El('span', '', options.title));
        title.type  = 'button';
        title.title = 'Fold this panel away';
        title.addEventListener('click', () => root.classList.toggle('na-veg-panel--folded'));
        head.appendChild(title);
        const close = Na__VegShell__Button('Close', 'na-veg-btn--plain', () => Na__VegShell__Close(options.id));
        head.appendChild(close);
        root.appendChild(head);

        const body = Na__VegShell__El('div', 'na-veg-panel__scroll');
        root.appendChild(body);

        const foot = Na__VegShell__El('div', 'na-veg-panel__foot');
        const undo = Na__VegShell__AddGlyph(Na__VegShell__Button('Undo', 'na-veg-undo', () => Na__VegShell__StepHistory(false), 'Ctrl+Z'), 'undo');
        const redo = Na__VegShell__AddGlyph(Na__VegShell__Button('Redo', 'na-veg-redo', () => Na__VegShell__StepHistory(true), 'Ctrl+Y'), 'redo');
        state.undoButtons.add(undo);
        state.redoButtons.add(redo);
        foot.appendChild(undo);
        foot.appendChild(redo);
        foot.appendChild(Na__VegShell__MakeSaveButton());
        root.appendChild(foot);

        document.body.appendChild(root);
        const parts = { root, head, body, foot };
        state.panels.set(options.id, { root, side : options.side, onClose : options.onClose, parts });
        if (options.side === 'right') Na__VegShell__ShutToolsMenu();             // <-- The left one came from the menu, which stays as it is
        Na__VegShell__PaintHistory();
        return parts;
    }
    // ------------------------------------------------------------


    // FUNCTION | Say Something to Whoever Is Working
    // ------------------------------------------------------------
    function Na__VegShell__Toast(message, isError) {
        const context = Na__VegShell__State.context;
        if (context && typeof context.showToast === 'function') context.showToast(message, isError === true);
    }
    // ------------------------------------------------------------


    // FUNCTION | Remember How Things Stand, Just Before a Change
    // ------------------------------------------------------------
    function Na__VegShell__BeforeChange(label) {
        Na__VegHist__Push(label);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Config, Once Prepared
    // ------------------------------------------------------------
    function Na__VegShell__Config() {
        return Na__VegShell__State.config;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get Everything Ready, Once
    // ------------------------------------------------------------
    async function Na__VegShell__Prepare(context) {
        const state = Na__VegShell__State;
        state.context = context;
        if (!state.config) state.config = await Na__VegData__LoadConfig();

        // A NEW OBJECT, A NEW HISTORY | After Remove All and Switch On, the old steps belong to nothing
        const sceneData = Na__VegRun__GetSceneData();
        if (state.prepared && sceneData !== state.sceneData) {
            state.sceneData = sceneData;
            Na__VegHist__Reset(sceneData, state.config.Vegetation__DevTools__Config.Vegetation__DevTools__UndoDepth);
        }
        if (state.prepared) return;
        state.prepared  = true;
        state.sceneData = sceneData;

        [Na__VegShell__STYLES_URL, Na__VegShell__MENU_STYLES_URL].forEach((url) => {
            if (document.querySelector('link[href="' + url.href + '"]')) return;
            const link = document.createElement('link');
            link.rel  = 'stylesheet';
            link.href = url.href;
            document.head.appendChild(link);
        });

        Na__VegHist__Reset(sceneData, state.config.Vegetation__DevTools__Config.Vegetation__DevTools__UndoDepth);

        window.addEventListener(Na__VegData__DIRTY_EVENT, Na__VegShell__PaintSave);
        window.addEventListener(Na__VegHist__EVENT, Na__VegShell__PaintHistory);
        window.addEventListener(Na__VegShell__OPENING_EVENT, Na__VegShell__OnOtherOpening);
        window.addEventListener('keydown', Na__VegShell__OnKeyDown, true);     // <-- Capture: before the 3D tab's own keys
        window.addEventListener('beforeunload', (event) => {
            if (!Na__VegData__IsDirty()) return;
            event.preventDefault();
            event.returnValue = '';                                            // <-- The browser's own leave-site question
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Panel Shell API
    // ------------------------------------------------------------
    export {
        Na__VegShell__OPENING_EVENT,
        Na__VegShell__CLOSED_EVENT,
        Na__VegShell__El,
        Na__VegShell__Button,
        Na__VegShell__Slider,
        Na__VegShell__PlantScaleSlider,
        Na__VegShell__Tick,
        Na__VegShell__Choice,
        Na__VegShell__Save,
        Na__VegShell__MakeSaveButton,
        Na__VegShell__AfterReplaced,
        Na__VegShell__MarkChanged,
        Na__VegShell__StepHistory,
        Na__VegShell__IsOpen,
        Na__VegShell__Close,
        Na__VegShell__CloseAll,
        Na__VegShell__Open,
        Na__VegShell__Toast,
        Na__VegShell__BeforeChange,
        Na__VegShell__Config,
        Na__VegShell__Prepare
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
