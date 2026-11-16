// =============================================================================
// TRUEVISION3D - ENTOURAGE - DEV CONTROLS
// =============================================================================
//
// FILE       : Na__Entourage__DevControls__.js
// NAMESPACE  : Na__EntDev
// MODULE     : System - Entourage
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Entourage's part of Dev Tools > Assets: the switch, where viewers start,
//              and removing it all for good
// CREATED    : 05-Nov-2026
//
// DESCRIPTION:
// - Adam, 05-Nov-2026: "in the dev menu nest vegetation in a new "Assets" section and have
//   entourage, vegetation and furnishings as sub sections ... then each has a toggle and nicely
//   nested otherwise the menuy will get too large".
// - ONE SWITCH, on the section's own row. A project is on unless it has been unticked here (Adam,
//   05-Nov-2026: "make the admin ticked on boxes on by default now ... keep those gates so i can
//   disable though"). Off keeps the object and takes the figures and the Entourage section of Tools &
//   Settings away, for everyone. Everything else is in that section.
// - SAVED STRAIGHT AWAY, these few only, as they decide what every viewer gets.
// - REMOVE ALL IS FINAL, so it asks for the word, and only then writes.
//
// INTEGRATION:
// - Loaded by ../Na__Entourage__.js for an author only. Nobody else fetches this file.
// - Markup: #naEntourageDevItem, #naEntourageDevToggle, #naEntourageDevEnable,
//   #naEntourageDevPanel, inside #naAssetsDevPanel.
// - @delegate: ../Na__Entourage__.js
// - @delegate: ../../70__System__DevTools/Na__UiFeature__AssetsSection__DevControls__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 23__System__Entourage/10__Ui__Panels/Na__Entourage__DevControls__.js (ValeVision3D v2.98.6)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : identical (header, console prefix and the Entourage folder's number apart)
// - Divergences   : none in behaviour. Entourage is 28__System__Entourage in TrueVision (its 23
//                   is Scene Sync); the vegetation and entourage READMEs list what differs around it.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 05-Nov-2026 - Version 1.1.0 (ValeVision3D v2.89.0)
// - On by default: the tick shows on for a project with no key, and unticking is what turns one off, for everyone.
//
// 05-Nov-2026 - Version 1.0.0 (ValeVision3D v2.88.0)
// - Initial build.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Entourage's Data, Its Door, and the Assets Section
    // ------------------------------------------------------------
    import {
        Na__EntData__LoadConfig,
        Na__EntData__Current,
        Na__EntData__SetDirty,
        Na__EntData__Save
    } from '../02__Core__Data/Na__Entourage__SceneData__.js';
    import { Na__Entourage__IsActive, Na__Entourage__SetEnabled, Na__Entourage__RemoveAll } from '../Na__Entourage__.js';
    import { Na__DevAssets__Initialize, Na__DevAssets__OPENED_EVENT } from '../../70__System__DevTools/Na__UiFeature__AssetsSection__DevControls__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Markup Ids, the Readout's Pace and the Word Remove All Asks For
    // ------------------------------------------------------------
    const Na__EntDev__ITEM_ID     = 'naEntourageDevItem';
    const Na__EntDev__TOGGLE_ID   = 'naEntourageDevToggle';
    const Na__EntDev__ENABLE_ID   = 'naEntourageDevEnable';
    const Na__EntDev__PANEL_ID    = 'naEntourageDevPanel';
    const Na__EntDev__READOUT_MS  = 500;
    const Na__EntDev__REMOVE_WORD = 'delete';
    // ------------------------------------------------------------

    // MODULE VARIABLES | Injected References and What Is Going On
    // ------------------------------------------------------------
    const Na__EntDev__State = {
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
    function Na__EntDev__El(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined) el.textContent = text;
        return el;
    }
    function Na__EntDev__Button(text, modifierClass, onClick) {
        const button = Na__EntDev__El('button', 'na-pm-dev__btn' + (modifierClass ? ' ' + modifierClass : ''), text);
        button.type = 'button';
        button.addEventListener('click', onClick);
        return button;
    }
    function Na__EntDev__Toast(message, isError) {
        const context = Na__EntDev__State.context;
        if (context && typeof context.showToast === 'function') context.showToast(message, isError === true);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Save the Object, and Say What Happened
    // ------------------------------------------------------------
    async function Na__EntDev__SaveAndSay(whatChanged) {
        Na__EntData__SetDirty(true);
        const result = await Na__EntData__Save();
        if (result && result.ok) {
            Na__EntDev__Toast(whatChanged + ' Saved.', false);
        } else {
            Na__EntDev__Toast(whatChanged + ' Not saved: ' + ((result && result.error) || 'the server did not answer') + '.', true);
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Panel
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Words for the Live Numbers
    // ------------------------------------------------------------
    async function Na__EntDev__WriteReadout() {
        const line = Na__EntDev__State.panel ? Na__EntDev__State.panel.querySelector('[data-na-entourage="readout"]') : null;
        if (!line || !Na__Entourage__IsActive()) return;
        const runtime = await import('../03__System__SceneLayer/Na__Entourage__Runtime__.js');
        const stats = runtime.Na__EntRun__GetStats();
        if (!stats) return;
        line.textContent = stats.figures + ' figures, ' + (stats.outer + stats.inner) + ' line segments, written in ' + stats.writeMs.toFixed(1) + ' ms.';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Switch on the Section's Row Says How Things Stand
    // ------------------------------------------------------------
    function Na__EntDev__SyncSwitch() {
        const enable = Na__EntDev__State.enable;
        if (!enable) return;
        if (!Na__EntDev__State.busy) enable.checked = Na__Entourage__IsActive();   // <-- While it is switching, the tick stays where the hand put it
        enable.disabled = Na__EntDev__State.busy;
    }
    // ------------------------------------------------------------


    // FUNCTION | Switch the Project On or Off
    // ------------------------------------------------------------
    async function Na__EntDev__ToggleEnabled() {
        const turningOn = Na__EntDev__State.enable.checked;
        Na__EntDev__State.busy = true;
        Na__EntDev__Render();
        try {
            const result = await Na__Entourage__SetEnabled(turningOn);
            const words = turningOn ? 'Entourage on: its menu is in Tools & Settings.' : 'Entourage off for this project.';
            if (result && result.ok) {
                Na__EntDev__Toast(words + ' Saved.', false);
            } else {
                Na__EntDev__Toast(words + ' Not saved: ' + ((result && result.error) || 'the server did not answer') + '.', true);
            }
        } catch (error) {
            Na__EntDev__Toast('Entourage could not be switched: ' + (error && error.message), true);
        }
        Na__EntDev__State.busy = false;
        Na__EntDev__Render();
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete Everything This Project Holds for Entourage
    // ------------------------------------------------------------
    async function Na__EntDev__RemoveAll() {
        Na__EntDev__State.busy = true;
        Na__EntDev__Render();
        try {
            const result = await Na__Entourage__RemoveAll();
            if (result && result.ok) {
                Na__EntDev__Toast('All entourage removed from this project.', false);
                Na__EntDev__State.removing = false;
            } else {
                Na__EntDev__Toast('Nothing was removed: ' + ((result && result.error) || 'the server did not answer') + '.', true);
            }
        } catch (error) {
            Na__EntDev__Toast('Nothing was removed: ' + (error && error.message), true);
        }
        Na__EntDev__State.busy = false;
        Na__EntDev__Render();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where Viewers Start: the Two Rows
    // ------------------------------------------------------------
    function Na__EntDev__AppendStartRows(panel, sceneData, busy) {
        panel.appendChild(Na__EntDev__El('hr', 'na-dropdown-menu__panel-divider'));

        const showRow = Na__EntDev__El('div', 'na-dropdown-menu__panel-row na-dropdown-menu__panel-row--toggle');
        showRow.appendChild(Na__EntDev__El('span', 'na-dropdown-menu__panel-title', 'Start with people showing'));
        const show = Na__EntDev__El('input', 'na-dropdown-menu__checkbox');
        show.type = 'checkbox';
        show.id = 'naEntourageDevShowByDefault';
        show.checked = sceneData.Entourage__SceneData__ShowByDefault !== false;
        show.disabled = busy;
        show.addEventListener('change', () => {
            sceneData.Entourage__SceneData__ShowByDefault = show.checked;
            Na__EntDev__SaveAndSay(show.checked ? 'Viewers start with people showing.' : 'Viewers start with people hidden.');
        });
        showRow.appendChild(show);
        panel.appendChild(showRow);

        panel.appendChild(Na__EntDev__El('div', 'na-dropdown-menu__panel-title', 'Starting transparency'));
        const fadeRow = Na__EntDev__El('div', 'na-dropdown-menu__panel-row');
        const fade = Na__EntDev__El('input', 'na-dropdown-menu__slider');
        fade.type = 'range';
        fade.id = 'naEntourageDevDefaultTransparency';
        fade.min = '0';
        fade.max = '100';
        fade.step = '1';
        fade.value = String(sceneData.Entourage__SceneData__DefaultTransparencyPercent || 0);
        fade.disabled = busy;
        const fadeValue = Na__EntDev__El('span', 'na-dropdown-menu__value', fade.value + '%');
        fade.addEventListener('input', () => { fadeValue.textContent = fade.value + '%'; });
        fade.addEventListener('change', () => {
            sceneData.Entourage__SceneData__DefaultTransparencyPercent = Number(fade.value);
            Na__EntDev__SaveAndSay('Viewers start at ' + fade.value + '% transparency.');
        });
        fadeRow.appendChild(fade);
        fadeRow.appendChild(fadeValue);
        panel.appendChild(fadeRow);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Remove All: Asks for the Word First
    // ------------------------------------------------------------
    function Na__EntDev__AppendRemoveRows(panel, busy) {
        panel.appendChild(Na__EntDev__El('hr', 'na-dropdown-menu__panel-divider'));
        if (!Na__EntDev__State.removing) {
            const row = Na__EntDev__El('div', 'na-pm-dev__actions');
            const start = Na__EntDev__Button('Remove All Entourage...', '', () => {
                Na__EntDev__State.removing = true;
                Na__EntDev__Render();
            });
            start.id = 'naEntourageDevRemoveAll';
            start.disabled = busy;
            row.appendChild(start);
            panel.appendChild(row);
            return;
        }

        panel.appendChild(Na__EntDev__El('p', 'na-fp-dev__empty', 'Every figure and setting goes from this project\'s file. Type ' + Na__EntDev__REMOVE_WORD + ' to confirm.'));
        const word = Na__EntDev__El('input', 'na-dropdown-menu__value-input');
        word.type = 'text';
        word.id = 'naEntourageDevRemoveWord';
        word.style.width = '100%';
        word.style.textAlign = 'left';
        panel.appendChild(word);

        const row = Na__EntDev__El('div', 'na-pm-dev__actions');
        const confirm = Na__EntDev__Button('Remove All', 'na-pm-dev__btn--primary', Na__EntDev__RemoveAll);
        confirm.id = 'naEntourageDevRemoveConfirm';
        confirm.disabled = true;
        word.addEventListener('input', () => { confirm.disabled = busy || word.value.trim().toLowerCase() !== Na__EntDev__REMOVE_WORD; });
        row.appendChild(confirm);
        row.appendChild(Na__EntDev__Button('Cancel', '', () => {
            Na__EntDev__State.removing = false;
            Na__EntDev__Render();
        }));
        panel.appendChild(row);
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Panel
    // ------------------------------------------------------------
    function Na__EntDev__Render() {
        const panel = Na__EntDev__State.panel;
        if (!panel) return;
        Na__EntDev__SyncSwitch();
        const isOn = Na__Entourage__IsActive();
        const busy = Na__EntDev__State.busy;
        const sceneData = Na__EntData__Current();

        panel.innerHTML = '';
        panel.appendChild(Na__EntDev__El('p', 'na-fp-dev__empty', isOn
            ? 'On for this project. Its menu is in Tools & Settings. Staff can place people, and clients see them once saved.'
            : 'Off for this project, for everyone. Nothing loads and nothing draws. Tick it to switch on.'));

        if (isOn && sceneData) {
            const readout = Na__EntDev__El('p', 'na-fp-dev__empty');
            readout.setAttribute('data-na-entourage', 'readout');
            panel.appendChild(readout);
            Na__EntDev__WriteReadout();

            const limit = Na__EntDev__State.config.Entourage__DevTools__Config.Entourage__DevTools__WarnAboveFigures;
            if (sceneData.Entourage__SceneData__Figures.length > limit) {
                panel.appendChild(Na__EntDev__El('p', 'na-fp-dev__empty', 'Over ' + limit + ' figures are saved in this project\'s file, and other apps read that file.'));
            }
            Na__EntDev__AppendStartRows(panel, sceneData, busy);
        }
        if (sceneData) Na__EntDev__AppendRemoveRows(panel, busy);
    }
    // ------------------------------------------------------------


    // FUNCTION | Mount the Section
    // ------------------------------------------------------------
    async function Na__EntDev__Initialize(context) {
        const menuItem = document.getElementById(Na__EntDev__ITEM_ID);
        const toggle   = document.getElementById(Na__EntDev__TOGGLE_ID);
        const enable   = document.getElementById(Na__EntDev__ENABLE_ID);
        const panel    = document.getElementById(Na__EntDev__PANEL_ID);
        if (!menuItem || !toggle || !enable || !panel) return false;           // <-- Markup absent: nothing to mount into

        Na__EntDev__State.context = context;
        Na__EntDev__State.panel   = panel;
        Na__EntDev__State.toggle  = toggle;
        Na__EntDev__State.enable  = enable;
        Na__EntDev__State.config  = await Na__EntData__LoadConfig();

        Na__DevAssets__Initialize();
        menuItem.style.display = '';                                           // <-- Reveal alongside the other assets

        toggle.addEventListener('click', () => {
            const isOpen = panel.classList.contains('is-open');
            panel.classList.toggle('is-open', !isOpen);
            toggle.setAttribute('aria-expanded', String(!isOpen));
            if (!isOpen) {
                Na__EntDev__Render();                                          // <-- Rebuild on each open so the state is fresh
                Na__EntDev__State.readout = window.setInterval(Na__EntDev__WriteReadout, Na__EntDev__READOUT_MS);
            } else {
                window.clearInterval(Na__EntDev__State.readout);
            }
        });
        enable.addEventListener('change', Na__EntDev__ToggleEnabled);
        window.addEventListener(Na__DevAssets__OPENED_EVENT, Na__EntDev__SyncSwitch);
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
        Na__EntDev__Initialize
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
