// =============================================================================
// TRUEVISION3D - ENTOURAGE - THE DEV PANELS' SHELL
// =============================================================================
//
// FILE       : Na__Entourage__PanelShell__.js
// NAMESPACE  : Na__EntShell
// MODULE     : System - Entourage
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : What every entourage dev panel shares: the floating panel itself, its rows
//              and sliders, Save Entourage, Undo and Redo, and the close guard
// CREATED    : 05-Nov-2026
//
// DESCRIPTION:
// - THE PLANTS' PANELS (Na__Vegetation__PanelShell__.js), with the same classes, so the two
//   read as one family. Staff's only: nothing here loads for a client.
// - SAVE IS A BUTTON: red when changed, syncing, green. Every panel shows the same state.
// - CLOSING WITH UNSAVED CHANGES ASKS FIRST, with the browser's own question.
// - ONE PANEL A SIDE, WHOEVER OPENED IT. Both systems say when they open a panel, so plants'
//   and people's panels never sit on top of each other.
// - A PANEL OPENING ON THE RIGHT SHUTS TOOLS & SETTINGS: it would sit on the menu. The panel on
//   the left is opened by unfolding Entourage in that menu (Adam, 06-Nov-2026), so it leaves the
//   menu as it is, and says when it closes so the menu's section folds with it.
//
// INTEGRATION:
// - Styles: the plants' stylesheet, for the shared classes, and
//   ./Na__Entourage__Styles__Panels__.css, both added to the page on first use.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 23__System__Entourage/10__Ui__Panels/Na__Entourage__PanelShell__.js (ValeVision3D v2.98.6)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : identical (header, console prefix and the Entourage folder's number apart)
// - Divergences   : none in behaviour. Entourage is 28__System__Entourage in TrueVision (its 23
//                   is Scene Sync); the vegetation and entourage READMEs list what differs around it.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 13-Nov-2026 - Version 1.4.1 (ValeVision3D v2.98.4)
// - Save Entourage's hover text: it saves Show Entourage and Transparency as everyone will open it.
//
// 11-Nov-2026 - Version 1.4.0 (ValeVision3D v2.96.0)
// - A staff save goes straight in: Save Entourage says so. Saved before a drawing opens (Na__Entourage__).
//
// 11-Nov-2026 - Version 1.3.0 (ValeVision3D v2.95.0)
// - JamesificationSlider: height only, 1 to 1.50.
//
// 06-Nov-2026 - Version 1.2.0 (ValeVision3D v2.91.0)
// - A panel can carry an icon in its title and be the dropdown sections' panel. Only a panel on the
//   right shuts Tools & Settings. Closing a panel says so (CLOSED_EVENT).
//
// 05-Nov-2026 - Version 1.1.0 (ValeVision3D v2.89.0)
// - A save tells an Employee that it waits for an admin. AfterReplaced brings the picture, the undo
//   steps and the panels into line when somebody else's work comes back from the server.
//
// 05-Nov-2026 - Version 1.0.0 (ValeVision3D v2.88.0)
// - Initial build.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Entourage's Data and Keyboard Scope
    // ------------------------------------------------------------
    import {
        Na__EntData__DIRTY_EVENT,
        Na__EntData__IsDirty,
        Na__EntData__SetDirty,
        Na__EntData__Save,
        Na__EntData__LoadConfig
    } from '../02__Core__Data/Na__Entourage__SceneData__.js';
    import {
        Na__EntHist__EVENT,
        Na__EntHist__Reset,
        Na__EntHist__Push,
        Na__EntHist__Undo,
        Na__EntHist__Redo,
        Na__EntHist__CanUndo,
        Na__EntHist__CanRedo
    } from '../02__Core__Data/Na__Entourage__History__.js';
    import {
        Na__EntRun__SyncFigures,
        Na__EntRun__ApplyLineRules,
        Na__EntRun__GetSceneData
    } from '../03__System__SceneLayer/Na__Entourage__Runtime__.js';
    import { Na__KeyScope__Is, Na__KeyScope__MODEL, Na__KeyScope__IsTypingTarget } from '../../03__AppUtils/Na__AppUtils__KeyScope__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and Variables
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Stylesheets, and How Long Saved Stays Green
    // ------------------------------------------------------------
    const Na__EntShell__STYLE_URLS = [
        new URL('../../24__System__Vegetation/10__Ui__Panels/Na__Vegetation__Styles__Panels__.css', import.meta.url),
        new URL('./Na__Entourage__Styles__Panels__.css', import.meta.url)
    ];
    const Na__EntShell__SAVED_MS       = 2000;
    const Na__EntShell__OPENING_EVENT  = 'na-asset-panel-opening';             // <-- Both systems' shells say and hear this: one panel a side
    const Na__EntShell__CLOSED_EVENT   = 'na-entourage-panel-closed';          // <-- detail { id, side }: the menu section folds when the panel on the left goes
    const Na__EntShell__OWNER          = 'entourage';
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Open Panels and the Buttons Showing Save State
    // ------------------------------------------------------------
    const Na__EntShell__State = {
        context     : null,
        config      : null,
        prepared    : false,
        sceneData   : null,                                                    // <-- The object the undo steps belong to
        panels      : new Map(),                                               // <-- id -> { root, side, onClose, parts }
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
    function Na__EntShell__El(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined) el.textContent = text;
        return el;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Make a Small Button
    // ------------------------------------------------------------
    function Na__EntShell__Button(text, className, onClick, title) {
        const button = Na__EntShell__El('button', 'na-veg-btn' + (className ? ' ' + className : ''), text);
        button.type = 'button';
        if (title) button.title = title;
        if (onClick) button.addEventListener('click', onClick);
        return button;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Slider with Its Name and Value
    // ------------------------------------------------------------
    // options: { label, min, max, step, value, format, onInput, onChange, title }
    // Returns { row, input, setValue }.
    // ------------------------------------------------------------
    function Na__EntShell__Slider(options) {
        const format = options.format || ((value) => Number(value).toFixed(2));
        const row    = Na__EntShell__El('label', 'na-veg-slider');
        if (options.title) row.title = options.title;
        const top = Na__EntShell__El('div', 'na-veg-slider__top');
        top.appendChild(Na__EntShell__El('span', 'na-veg-slider__label', options.label));
        const readout = Na__EntShell__El('span', 'na-veg-slider__value');
        top.appendChild(readout);
        row.appendChild(top);

        const input = Na__EntShell__El('input', 'na-veg-slider__input');
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


    // HELPER FUNCTION | A Figure Scale Slider, Whichever Panel It Is In
    // ------------------------------------------------------------
    function Na__EntShell__ScaleSlider(options) {
        const config = Na__EntShell__Config().Entourage__DevTools__Config;
        return Na__EntShell__Slider({
            label    : options.label || 'Scale',
            title    : options.title,
            min      : config.Entourage__DevTools__ScaleMin,
            max      : config.Entourage__DevTools__ScaleMax,
            step     : config.Entourage__DevTools__ScaleStep,
            value    : options.value > 0 ? options.value : 1,
            format   : (value) => Number(value).toFixed(2),
            onInput  : options.onInput,
            onChange : options.onChange
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Jamesification Slider: a Figure's Height Only, 1 to 1.50
    // ------------------------------------------------------------
    // Adam, 11-Nov-2026: "add a second slider that scales along height axis only name the sider
    // Jamesification and make it only go 1 - 1.50 to stretch peoples height"
    // ------------------------------------------------------------
    function Na__EntShell__JamesificationSlider(options) {
        const config = Na__EntShell__Config().Entourage__DevTools__Config;
        return Na__EntShell__Slider({
            label    : 'Jamesification',
            title    : options.title,
            min      : config.Entourage__DevTools__JamesificationMin,
            max      : config.Entourage__DevTools__JamesificationMax,
            step     : config.Entourage__DevTools__JamesificationStep,
            value    : options.value > 0 ? options.value : 1,
            format   : (value) => Number(value).toFixed(2),
            onInput  : options.onInput,
            onChange : options.onChange
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Saving
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Say What the Save Buttons Should Say
    // ------------------------------------------------------------
    function Na__EntShell__PaintSave() {
        const state = Na__EntShell__State;
        const dirty = Na__EntData__IsDirty();
        const saved = !dirty && Date.now() < state.savedUntil;
        state.saveButtons.forEach((button) => {
            button.classList.toggle('na-veg-save--dirty', dirty && !state.saving);
            button.classList.toggle('na-veg-save--saving', state.saving);
            button.classList.toggle('na-veg-save--saved', saved && !state.saving);
            button.disabled = state.saving || (!dirty && !saved);
            button.textContent = state.saving ? 'Saving...' : (saved ? 'Saved' : 'Save Entourage');
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Save the Project's Figures
    // ------------------------------------------------------------
    async function Na__EntShell__Save() {
        const state = Na__EntShell__State;
        if (state.saving) return;
        state.saving = true;
        Na__EntShell__PaintSave();
        const result = await Na__EntData__Save();
        state.saving = false;
        const saved = !!(result && result.ok);
        if (saved) {
            state.savedUntil = Date.now() + Na__EntShell__SAVED_MS;
            window.clearTimeout(state.savedTimer);
            state.savedTimer = window.setTimeout(Na__EntShell__PaintSave, Na__EntShell__SAVED_MS + 20);
            if (result.merged) await Na__EntShell__AfterReplaced();
            const counts = result.counts || {};
            if (!result.approvedNow && (counts.added || counts.changed || counts.removed)) {
                Na__EntShell__Toast('Saved. An admin will approve it before clients see it.', false);   // <-- Only with the API's NA_STAFF_SAVES_GO_STRAIGHT_IN off
            }
        } else {
            Na__EntShell__Toast('Entourage not saved: ' + ((result && result.error) || 'the server did not answer') + '.', true);
        }
        Na__EntShell__PaintSave();
        return saved;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Object Has Been Replaced from the Server: Bring Everything into Line
    // ------------------------------------------------------------
    // Somebody else's work came back with a save, or an approval or a put back has landed. The undo
    // steps are of something that is no longer so, and an undo would quietly undo somebody else.
    // ------------------------------------------------------------
    async function Na__EntShell__AfterReplaced() {
        const state = Na__EntShell__State;
        if (state.config) Na__EntHist__Reset(Na__EntRun__GetSceneData(), state.config.Entourage__DevTools__Config.Entourage__DevTools__UndoDepth);
        Na__EntRun__ApplyLineRules();
        await Na__EntRun__SyncFigures();
        window.dispatchEvent(new CustomEvent('na-entourage-object-replaced'));
    }
    // ------------------------------------------------------------


    // FUNCTION | A Save Entourage Button
    // ------------------------------------------------------------
    function Na__EntShell__MakeSaveButton() {
        const button = Na__EntShell__Button('Save Entourage', 'na-veg-save', Na__EntShell__Save, 'Saves your changes in this project, for everyone, clients included, with Show Entourage and Transparency as everyone will open it. Your name and the time are kept on each person you add');
        Na__EntShell__State.saveButtons.add(button);
        Na__EntShell__PaintSave();
        return button;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Object Changed: Say So Everywhere
    // ------------------------------------------------------------
    function Na__EntShell__MarkChanged() {
        Na__EntData__SetDirty(true);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Undo and Redo
// -----------------------------------------------------------------------------

    // FUNCTION | One Step Back or Forward, and Bring the Picture into Line
    // ------------------------------------------------------------
    async function Na__EntShell__StepHistory(forward) {
        const moved = forward ? Na__EntHist__Redo() : Na__EntHist__Undo();
        if (!moved) return false;
        Na__EntShell__MarkChanged();
        Na__EntRun__ApplyLineRules();
        await Na__EntRun__SyncFigures();
        window.dispatchEvent(new CustomEvent('na-entourage-object-replaced'));  // <-- A panel showing a value reads it again
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Grey the Buttons When There Is Nothing to Do
    // ------------------------------------------------------------
    function Na__EntShell__PaintHistory() {
        Na__EntShell__State.undoButtons.forEach((button) => { button.disabled = !Na__EntHist__CanUndo(); });
        Na__EntShell__State.redoButtons.forEach((button) => { button.disabled = !Na__EntHist__CanRedo(); });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Undo and Redo Keys, While a Panel Is Open on the 3D Model Tab
    // ------------------------------------------------------------
    function Na__EntShell__OnKeyDown(event) {
        if (Na__EntShell__State.panels.size === 0 || event.defaultPrevented) return;
        if (!Na__KeyScope__Is(Na__KeyScope__MODEL)) return;
        if (Na__KeyScope__IsTypingTarget(event.target)) return;
        if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
        const key = event.key.toLowerCase();
        const redo = key === 'y' || (key === 'z' && event.shiftKey);
        const undo = key === 'z' && !event.shiftKey;
        if (!undo && !redo) return;
        event.preventDefault();
        event.stopPropagation();
        Na__EntShell__StepHistory(redo);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Panel
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Panel Means Work on the Model: Shut Tools & Settings
    // ------------------------------------------------------------
    function Na__EntShell__ShutToolsMenu() {
        const menu = document.getElementById('naToolsMenu');
        if (menu && menu.open) menu.open = false;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Panel Open?
    // ------------------------------------------------------------
    function Na__EntShell__IsOpen(id) {
        return Na__EntShell__State.panels.has(id);
    }
    // ------------------------------------------------------------


    // FUNCTION | Close a Panel
    // ------------------------------------------------------------
    function Na__EntShell__Close(id) {
        const entry = Na__EntShell__State.panels.get(id);
        if (!entry) return;
        Na__EntShell__State.panels.delete(id);
        entry.root.querySelectorAll('.na-veg-save').forEach((button) => Na__EntShell__State.saveButtons.delete(button));
        entry.root.querySelectorAll('.na-veg-undo').forEach((button) => Na__EntShell__State.undoButtons.delete(button));
        entry.root.querySelectorAll('.na-veg-redo').forEach((button) => Na__EntShell__State.redoButtons.delete(button));
        entry.root.remove();
        if (entry.onClose) entry.onClose();
        window.dispatchEvent(new CustomEvent(Na__EntShell__CLOSED_EVENT, { detail : { id, side : entry.side } }));
    }
    // ------------------------------------------------------------


    // FUNCTION | Close Every Panel
    // ------------------------------------------------------------
    function Na__EntShell__CloseAll() {
        Array.from(Na__EntShell__State.panels.keys()).forEach(Na__EntShell__Close);
    }
    // ------------------------------------------------------------


    // HANDLER | Another System Is Opening a Panel on a Side
    // ------------------------------------------------------------
    function Na__EntShell__OnOtherOpening(event) {
        const detail = event.detail || {};
        if (detail.owner === Na__EntShell__OWNER) return;
        Na__EntShell__State.panels.forEach((entry, id) => {
            if (entry.side === detail.side) Na__EntShell__Close(id);
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Open a Panel
    // ------------------------------------------------------------
    // options: { id, title, side : 'left' | 'right', width, onClose, icon, hub }
    // icon: an element for the title. hub: the body holds dropdown sections (Na__SceneAssets__Hub__.js).
    // Returns { root, head, body, foot }, or the open one's if it is already up.
    // ------------------------------------------------------------
    function Na__EntShell__Open(options) {
        const state = Na__EntShell__State;
        if (state.panels.has(options.id)) return state.panels.get(options.id).parts;

        // ONE PANEL A SIDE | They would sit on top of each other
        state.panels.forEach((entry, id) => {
            if (entry.side === options.side) Na__EntShell__Close(id);
        });
        window.dispatchEvent(new CustomEvent(Na__EntShell__OPENING_EVENT, { detail : { side : options.side, owner : Na__EntShell__OWNER } }));

        const root = Na__EntShell__El('aside', 'na-veg-panel na-veg-panel--' + options.side + (options.hub ? ' na-veg-panel--hub' : ''));
        root.id = options.id;
        if (options.width) root.style.width = options.width + 'px';

        const head  = Na__EntShell__El('div', 'na-veg-panel__head');
        const title = Na__EntShell__El('button', 'na-veg-panel__title');
        if (options.icon) title.appendChild(options.icon);
        title.appendChild(Na__EntShell__El('span', '', options.title));
        title.type  = 'button';
        title.title = 'Fold this panel away';
        title.addEventListener('click', () => root.classList.toggle('na-veg-panel--folded'));
        head.appendChild(title);
        const close = Na__EntShell__Button('Close', 'na-veg-btn--plain', () => Na__EntShell__Close(options.id));
        head.appendChild(close);
        root.appendChild(head);

        const body = Na__EntShell__El('div', 'na-veg-panel__scroll');
        root.appendChild(body);

        const foot = Na__EntShell__El('div', 'na-veg-panel__foot');
        const undo = Na__EntShell__Button('Undo', 'na-veg-undo', () => Na__EntShell__StepHistory(false), 'Ctrl+Z');
        const redo = Na__EntShell__Button('Redo', 'na-veg-redo', () => Na__EntShell__StepHistory(true), 'Ctrl+Y');
        state.undoButtons.add(undo);
        state.redoButtons.add(redo);
        foot.appendChild(undo);
        foot.appendChild(redo);
        foot.appendChild(Na__EntShell__MakeSaveButton());
        root.appendChild(foot);

        document.body.appendChild(root);
        const parts = { root, head, body, foot };
        state.panels.set(options.id, { root, side : options.side, onClose : options.onClose, parts });
        if (options.side === 'right') Na__EntShell__ShutToolsMenu();             // <-- The left one came from the menu, which stays as it is
        Na__EntShell__PaintHistory();
        return parts;
    }
    // ------------------------------------------------------------


    // FUNCTION | Say Something to Whoever Is Working
    // ------------------------------------------------------------
    function Na__EntShell__Toast(message, isError) {
        const context = Na__EntShell__State.context;
        if (context && typeof context.showToast === 'function') context.showToast(message, isError === true);
    }
    // ------------------------------------------------------------


    // FUNCTION | Remember How Things Stand, Just Before a Change
    // ------------------------------------------------------------
    function Na__EntShell__BeforeChange(label) {
        Na__EntHist__Push(label);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Config, Once Prepared
    // ------------------------------------------------------------
    function Na__EntShell__Config() {
        return Na__EntShell__State.config;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get Everything Ready, Once
    // ------------------------------------------------------------
    async function Na__EntShell__Prepare(context) {
        const state = Na__EntShell__State;
        state.context = context;
        if (!state.config) state.config = await Na__EntData__LoadConfig();

        // A NEW OBJECT, A NEW HISTORY | After Remove All and Switch On, the old steps belong to nothing
        const sceneData = Na__EntRun__GetSceneData();
        if (state.prepared && sceneData !== state.sceneData) {
            state.sceneData = sceneData;
            Na__EntHist__Reset(sceneData, state.config.Entourage__DevTools__Config.Entourage__DevTools__UndoDepth);
        }
        if (state.prepared) return;
        state.prepared  = true;
        state.sceneData = sceneData;

        Na__EntShell__STYLE_URLS.forEach((url) => {
            if (document.querySelector('link[href="' + url.href + '"]')) return;
            const link = document.createElement('link');
            link.rel  = 'stylesheet';
            link.href = url.href;
            document.head.appendChild(link);
        });

        Na__EntHist__Reset(sceneData, state.config.Entourage__DevTools__Config.Entourage__DevTools__UndoDepth);

        window.addEventListener(Na__EntData__DIRTY_EVENT, Na__EntShell__PaintSave);
        window.addEventListener(Na__EntHist__EVENT, Na__EntShell__PaintHistory);
        window.addEventListener(Na__EntShell__OPENING_EVENT, Na__EntShell__OnOtherOpening);
        window.addEventListener('keydown', Na__EntShell__OnKeyDown, true);     // <-- Capture: before the 3D tab's own keys
        window.addEventListener('beforeunload', (event) => {
            if (!Na__EntData__IsDirty()) return;
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
        Na__EntShell__OPENING_EVENT,
        Na__EntShell__CLOSED_EVENT,
        Na__EntShell__El,
        Na__EntShell__Button,
        Na__EntShell__Slider,
        Na__EntShell__ScaleSlider,
        Na__EntShell__JamesificationSlider,
        Na__EntShell__MakeSaveButton,
        Na__EntShell__Save,
        Na__EntShell__AfterReplaced,
        Na__EntShell__MarkChanged,
        Na__EntShell__StepHistory,
        Na__EntShell__IsOpen,
        Na__EntShell__Close,
        Na__EntShell__CloseAll,
        Na__EntShell__Open,
        Na__EntShell__Toast,
        Na__EntShell__BeforeChange,
        Na__EntShell__Config,
        Na__EntShell__Prepare
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
