// =============================================================================
// TRUEVISION3D - VEGETATION - DEV CONTROLS
// =============================================================================
//
// FILE       : Na__Vegetation__DevControls__.js
// NAMESPACE  : Na__VegDev
// MODULE     : System - Vegetation
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The Dev Tools section that switches a project's vegetation on and off,
//              says where viewers start, and removes it all for good
// CREATED    : 04-Nov-2026
//
// DESCRIPTION:
// - NESTED UNDER DEV TOOLS > ASSETS (Adam, 05-Nov-2026: "in the dev menu nest vegetation in a new
//   "Assets" section"), so its switch is a tick on its own row, and this panel holds the rest.
// - ONE SWITCH (Adam, 04-Nov-2026). On makes the project's object, with every parameter
//   in it, shows the plants and puts the Vegetation section in Tools & Settings. Off keeps
//   the object and takes them away. Everything else is in that section.
// - SAVED STRAIGHT AWAY, these few only, as they decide what every viewer gets. Through
//   Na__VegData__Save, a merge of this one key, like everything else that writes it.
// - REMOVE ALL IS FINAL, so it asks for the word, as the plan says, and only then writes.
//   Switching off never deletes (Adam, v2.76.2: "Delete should mean delete", and only then).
//
// INTEGRATION:
// - Loaded by Na__Vegetation__.js for an author only. Nobody else fetches this file.
// - Markup: #naVegetationDevItem, #naVegetationDevToggle, #naVegetationDevEnable,
//   #naVegetationDevPanel, inside #naAssetsDevPanel.
// - Tuned from Vegetation__DevTools__Config in ../Na__Vegetation__AppConfig__.json.
// - @delegate: ../Na__Vegetation__.js
// - @delegate: ../../70__System__DevTools/Na__UiFeature__AssetsSection__DevControls__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 24__System__Vegetation/10__Ui__Panels/Na__Vegetation__DevControls__.js (ValeVision3D v2.98.6)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : identical (header, console prefix and the Entourage folder's number apart)
// - Divergences   : none in behaviour. Entourage is 28__System__Entourage in TrueVision (its 23
//                   is Scene Sync); the vegetation and entourage READMEs list what differs around it.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 05-Nov-2026 - Version 1.3.0 (ValeVision3D v2.89.0)
// - On by default: the tick shows on for a project with no key, and unticking is what turns one off, for everyone.
//
// 05-Nov-2026 - Version 1.2.0 (ValeVision3D v2.88.0)
// - Nested under Dev Tools > Assets, at Adam's word: the switch is a tick on the section's own row.
//
// 04-Nov-2026 - Version 1.1.0 (ValeVision3D v2.85.0)
// - The real menu and tools have arrived, so the test row has gone. Where viewers start,
//   Remove All, and a warning on a very full project. A test row saved earlier is an
//   ordinary stroke now: In This Project in the asset browser takes it out.
//
// 04-Nov-2026 - Version 1.0.0 (ValeVision3D v2.84.0)
// - Initial build: Stage 2 of ValeVision__PLAN__VegetationSystem__.md.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Vegetation's Data and Its Door
    // ------------------------------------------------------------
    import {
        Na__VegData__LoadConfig,
        Na__VegData__Current,
        Na__VegData__SetDirty,
        Na__VegData__Save
    } from '../02__Core__Data/Na__Vegetation__SceneData__.js';
    import { Na__Vegetation__IsActive, Na__Vegetation__SetEnabled, Na__Vegetation__RemoveAll } from '../Na__Vegetation__.js';
    import { Na__DevAssets__Initialize, Na__DevAssets__OPENED_EVENT } from '../../70__System__DevTools/Na__UiFeature__AssetsSection__DevControls__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Markup Ids, the Readout's Pace and the Word Remove All Asks For
    // ------------------------------------------------------------
    const Na__VegDev__ITEM_ID     = 'naVegetationDevItem';
    const Na__VegDev__TOGGLE_ID   = 'naVegetationDevToggle';
    const Na__VegDev__ENABLE_ID   = 'naVegetationDevEnable';
    const Na__VegDev__PANEL_ID    = 'naVegetationDevPanel';
    const Na__VegDev__READOUT_MS  = 500;
    const Na__VegDev__REMOVE_WORD = 'delete';
    // ------------------------------------------------------------

    // MODULE VARIABLES | Injected References and What Is Going On
    // ------------------------------------------------------------
    const Na__VegDev__State = {
        context  : null,
        panel    : null,
        toggle   : null,
        enable   : null,
        config   : null,
        busy     : false,
        removing : false,
        readout  : 0
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | An Element, a Button and the Toast
    // ------------------------------------------------------------
    function Na__VegDev__El(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined) el.textContent = text;
        return el;
    }
    function Na__VegDev__Button(text, modifierClass, onClick) {
        const button = Na__VegDev__El('button', 'na-pm-dev__btn' + (modifierClass ? ' ' + modifierClass : ''), text);
        button.type = 'button';
        button.addEventListener('click', onClick);
        return button;
    }
    function Na__VegDev__Toast(message, isError) {
        const context = Na__VegDev__State.context;
        if (context && typeof context.showToast === 'function') context.showToast(message, isError === true);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Runtime, Already Loaded Once the Project Is On
    // ------------------------------------------------------------
    function Na__VegDev__Runtime() {
        return import('../03__System__SceneLayer/Na__Vegetation__Runtime__.js');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Save the Object, and Say What Happened
    // ------------------------------------------------------------
    async function Na__VegDev__SaveAndSay(whatChanged) {
        Na__VegData__SetDirty(true);
        const result = await Na__VegData__Save();
        if (result && result.ok) {
            Na__VegDev__Toast(whatChanged + ' Saved.', false);
        } else {
            Na__VegDev__Toast(whatChanged + ' Not saved: ' + ((result && result.error) || 'the server did not answer') + '.', true);
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Panel
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Words for the Live Numbers
    // ------------------------------------------------------------
    async function Na__VegDev__WriteReadout() {
        const line = Na__VegDev__State.panel ? Na__VegDev__State.panel.querySelector('[data-na-vegetation="readout"]') : null;
        if (!line || !Na__Vegetation__IsActive()) return;
        const runtime = await Na__VegDev__Runtime();
        const stats = runtime.Na__VegRun__GetStats();
        if (!stats) return;
        line.textContent = stats.plants + ' plants, ' + stats.bushes + ' on the page. Last full redraw '
            + stats.lastFullMs.toFixed(0) + ' ms for ' + stats.lastFullDrawn + '. Buffers ' + stats.buffersMb.toFixed(0) + ' MB.';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Switch on the Section's Row Says How Things Stand
    // ------------------------------------------------------------
    function Na__VegDev__SyncSwitch() {
        const enable = Na__VegDev__State.enable;
        if (!enable) return;
        if (!Na__VegDev__State.busy) enable.checked = Na__Vegetation__IsActive();   // <-- While it is switching, the tick stays where the hand put it
        enable.disabled = Na__VegDev__State.busy;
    }
    // ------------------------------------------------------------


    // FUNCTION | Switch the Project On or Off
    // ------------------------------------------------------------
    async function Na__VegDev__ToggleEnabled() {
        const turningOn = Na__VegDev__State.enable.checked;
        Na__VegDev__State.busy = true;
        Na__VegDev__Render();
        try {
            const result = await Na__Vegetation__SetEnabled(turningOn);
            const words = turningOn ? 'Vegetation on: its menu is in Tools & Settings.' : 'Vegetation off for this project.';
            if (result && result.ok) {
                Na__VegDev__Toast(words + ' Saved.', false);
            } else {
                Na__VegDev__Toast(words + ' Not saved: ' + ((result && result.error) || 'the server did not answer') + '.', true);
            }
        } catch (error) {
            Na__VegDev__Toast('Vegetation could not be switched: ' + (error && error.message), true);
        }
        Na__VegDev__State.busy = false;
        Na__VegDev__Render();
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete Everything This Project Holds for Vegetation
    // ------------------------------------------------------------
    async function Na__VegDev__RemoveAll() {
        Na__VegDev__State.busy = true;
        Na__VegDev__Render();
        try {
            const result = await Na__Vegetation__RemoveAll();
            if (result && result.ok) {
                Na__VegDev__Toast('All vegetation removed from this project.', false);
                Na__VegDev__State.removing = false;
            } else {
                Na__VegDev__Toast('Nothing was removed: ' + ((result && result.error) || 'the server did not answer') + '.', true);
            }
        } catch (error) {
            Na__VegDev__Toast('Nothing was removed: ' + (error && error.message), true);
        }
        Na__VegDev__State.busy = false;
        Na__VegDev__Render();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where Viewers Start: the Two Rows
    // ------------------------------------------------------------
    function Na__VegDev__AppendStartRows(panel, sceneData, busy) {
        panel.appendChild(Na__VegDev__El('hr', 'na-dropdown-menu__panel-divider'));

        const showRow = Na__VegDev__El('div', 'na-dropdown-menu__panel-row na-dropdown-menu__panel-row--toggle');
        showRow.appendChild(Na__VegDev__El('span', 'na-dropdown-menu__panel-title', 'Start with plants showing'));
        const show = Na__VegDev__El('input', 'na-dropdown-menu__checkbox');
        show.type = 'checkbox';
        show.id = 'naVegetationDevShowByDefault';
        show.checked = sceneData.Vegetation__SceneData__ShowByDefault !== false;
        show.disabled = busy;
        show.addEventListener('change', () => {
            sceneData.Vegetation__SceneData__ShowByDefault = show.checked;
            Na__VegDev__SaveAndSay(show.checked ? 'Viewers start with plants showing.' : 'Viewers start with plants hidden.');
        });
        showRow.appendChild(show);
        panel.appendChild(showRow);

        panel.appendChild(Na__VegDev__El('div', 'na-dropdown-menu__panel-title', 'Starting transparency'));
        const fadeRow = Na__VegDev__El('div', 'na-dropdown-menu__panel-row');
        const fade = Na__VegDev__El('input', 'na-dropdown-menu__slider');
        fade.type = 'range';
        fade.id = 'naVegetationDevDefaultTransparency';
        fade.min = '0';
        fade.max = '100';
        fade.step = '1';
        fade.value = String(sceneData.Vegetation__SceneData__DefaultTransparencyPercent || 0);
        fade.disabled = busy;
        const fadeValue = Na__VegDev__El('span', 'na-dropdown-menu__value', fade.value + '%');
        fade.addEventListener('input', () => { fadeValue.textContent = fade.value + '%'; });
        fade.addEventListener('change', () => {
            sceneData.Vegetation__SceneData__DefaultTransparencyPercent = Number(fade.value);
            Na__VegDev__SaveAndSay('Viewers start at ' + fade.value + '% transparency.');
        });
        fadeRow.appendChild(fade);
        fadeRow.appendChild(fadeValue);
        panel.appendChild(fadeRow);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Remove All: Asks for the Word First
    // ------------------------------------------------------------
    function Na__VegDev__AppendRemoveRows(panel, busy) {
        panel.appendChild(Na__VegDev__El('hr', 'na-dropdown-menu__panel-divider'));
        if (!Na__VegDev__State.removing) {
            const row = Na__VegDev__El('div', 'na-pm-dev__actions');
            const start = Na__VegDev__Button('Remove All Vegetation...', '', () => {
                Na__VegDev__State.removing = true;
                Na__VegDev__Render();
            });
            start.id = 'naVegetationDevRemoveAll';
            start.disabled = busy;
            row.appendChild(start);
            panel.appendChild(row);
            return;
        }

        panel.appendChild(Na__VegDev__El('p', 'na-fp-dev__empty', 'Every plant, path, palette and setting goes from this project\'s file. Type ' + Na__VegDev__REMOVE_WORD + ' to confirm.'));
        const word = Na__VegDev__El('input', 'na-dropdown-menu__value-input');
        word.type = 'text';
        word.id = 'naVegetationDevRemoveWord';
        word.style.width = '100%';
        word.style.textAlign = 'left';
        panel.appendChild(word);

        const row = Na__VegDev__El('div', 'na-pm-dev__actions');
        const confirm = Na__VegDev__Button('Remove All', 'na-pm-dev__btn--primary', Na__VegDev__RemoveAll);
        confirm.id = 'naVegetationDevRemoveConfirm';
        confirm.disabled = true;
        word.addEventListener('input', () => { confirm.disabled = busy || word.value.trim().toLowerCase() !== Na__VegDev__REMOVE_WORD; });
        row.appendChild(confirm);
        row.appendChild(Na__VegDev__Button('Cancel', '', () => {
            Na__VegDev__State.removing = false;
            Na__VegDev__Render();
        }));
        panel.appendChild(row);
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Panel
    // ------------------------------------------------------------
    function Na__VegDev__Render() {
        const panel = Na__VegDev__State.panel;
        if (!panel) return;
        Na__VegDev__SyncSwitch();
        const isOn = Na__Vegetation__IsActive();
        const busy = Na__VegDev__State.busy;
        const sceneData = Na__VegData__Current();

        panel.innerHTML = '';
        panel.appendChild(Na__VegDev__El('p', 'na-fp-dev__empty', isOn
            ? 'On for this project. Its menu is in Tools & Settings. Staff can plant, and clients see the plants once saved.'
            : 'Off for this project, for everyone. Nothing loads and nothing draws. Tick it to switch on.'));

        if (isOn && sceneData) {
            const readout = Na__VegDev__El('p', 'na-fp-dev__empty');
            readout.setAttribute('data-na-vegetation', 'readout');
            panel.appendChild(readout);
            Na__VegDev__WriteReadout();

            const limit = Na__VegDev__State.config.Vegetation__DevTools__Config.Vegetation__DevTools__WarnAbovePlops;
            if (sceneData.Vegetation__SceneData__Plops.length > limit) {
                panel.appendChild(Na__VegDev__El('p', 'na-fp-dev__empty', 'Over ' + limit + ' single plants are saved in this project\'s file, and other apps read that file. Paths save far less: consider one.'));
            }
            Na__VegDev__AppendStartRows(panel, sceneData, busy);
        }
        if (sceneData) Na__VegDev__AppendRemoveRows(panel, busy);
    }
    // ------------------------------------------------------------


    // FUNCTION | Mount the Section
    // ------------------------------------------------------------
    async function Na__VegDev__Initialize(context) {
        const menuItem = document.getElementById(Na__VegDev__ITEM_ID);
        const toggle   = document.getElementById(Na__VegDev__TOGGLE_ID);
        const enable   = document.getElementById(Na__VegDev__ENABLE_ID);
        const panel    = document.getElementById(Na__VegDev__PANEL_ID);
        if (!menuItem || !toggle || !enable || !panel) return false;           // <-- Markup absent: nothing to mount into

        Na__VegDev__State.context = context;
        Na__VegDev__State.panel   = panel;
        Na__VegDev__State.toggle  = toggle;
        Na__VegDev__State.enable  = enable;
        Na__VegDev__State.config  = await Na__VegData__LoadConfig();

        Na__DevAssets__Initialize();
        menuItem.style.display = '';                                           // <-- Reveal alongside the other assets

        toggle.addEventListener('click', () => {
            const isOpen = panel.classList.contains('is-open');
            panel.classList.toggle('is-open', !isOpen);
            toggle.setAttribute('aria-expanded', String(!isOpen));
            if (!isOpen) {
                Na__VegDev__Render();                                          // <-- Rebuild on each open so the state is fresh
                Na__VegDev__State.readout = window.setInterval(Na__VegDev__WriteReadout, Na__VegDev__READOUT_MS);
            } else {
                window.clearInterval(Na__VegDev__State.readout);
            }
        });
        enable.addEventListener('change', Na__VegDev__ToggleEnabled);
        window.addEventListener(Na__DevAssets__OPENED_EVENT, Na__VegDev__SyncSwitch);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Dev Controls API
    // ------------------------------------------------------------
    export {
        Na__VegDev__Initialize
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
