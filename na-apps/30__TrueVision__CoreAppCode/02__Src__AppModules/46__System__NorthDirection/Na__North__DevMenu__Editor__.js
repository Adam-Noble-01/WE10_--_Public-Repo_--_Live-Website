// =============================================================================
// TRUEVISION3D - NORTH DIRECTION - DEV MENU EDITOR
// =============================================================================
//
// FILE       : Na__North__DevMenu__Editor__.js
// NAMESPACE  : Na__NorthDev
// MODULE     : North Direction - Dev Menu Editor
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The Dev menu's North Direction section: draw the compass, type or nudge the bearing, see what every elevation will be called, and save
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - DRAW COMPASS arms the pick tool: one click where the compass sits, a
//   second towards north. The compass follows the pointer between them, and
//   the panel says which click it is waiting for.
// - THE BEARING FIELD is the same number, typed. A model drawn north-up is set
//   to 0 here in one keystroke; a bearing off a survey goes straight in.
// - WHAT THE ELEVATIONS WILL BE CALLED is the proof. Every elevation is listed
//   with its stored bearing and the compass word north now gives it, so a
//   compass pointed the wrong way round shows at once as "South" against the
//   wall everybody knows faces north. The list follows the compass live while
//   it is being aimed.
// - SET IS NOT SAVED. Setting north changes the project in memory and every
//   open sheet follows at once; Save North keeps it, through the drawings
//   block's own save. The status line says when the two differ.
// - SHOW COMPASS KEEPS THE COMPASS UP. Without it the compass is in the scene
//   only while the panel is open, as it always was, and is disposed the moment
//   it closes. With it the compass stays - the same bargain a drawing plane
//   that has been switched on makes - so north can be read while orbiting the
//   model with the plan and elevation planes switched on beside it. The
//   browser remembers the toggle, so it survives a reload. It can be left on
//   safely because the compass is an interactive overlay: no render but the
//   live 3D frame can see it - see Na__North__CompassGizmo__.
//
// INTEGRATION:
// - Initialised from index.html with the model root and the toast.
// - Markup: #naNorthDevItem, #naNorthDevToggle, #naNorthDevPanel.
// // @delegate: ./Na__North__PickTool__.js
// // @delegate: ./Na__North__CompassGizmo__.js
// // @delegate: ./Na__North__ProjectJson__Data__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (19-Sep-2026)
// - ValeVision    : not yet ported.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.1.0
// - Show Compass: a persistent toggle, matching the drawing planes.
//
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation, after Na__Elevation__DevMenu__Editor__.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js Core
    // ------------------------------------------------------------
    import * as THREE from 'three';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Authoring Gate, the Drawings and the North System
    // ------------------------------------------------------------
    import { Na__DevGate__IsAuthoringEnabled } from '../03__AppUtils/Na__AppUtils__DevGate__.js';
    import { Na__Math__ConvertMmToUnits, Na__Math__ConvertUnitsToMm } from '../04__MathUtils/Na__Math__Units.js';
    import { Na__DrawData__CHANGED_EVENT, Na__DrawData__GetElevationsArray } from '../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    import { Na__NorthMath__Wrap, Na__NorthMath__FacingWord } from './Na__North__Compass__.js';
    import { Na__NorthCfg__Load, Na__NorthCfg__GetCompassSetup, Na__NorthCfg__GetLabel, Na__NorthCfg__FormatLabel } from './Na__North__ConfigState__.js';
    import {
        Na__NorthData__CHANGED_EVENT,
        Na__NorthData__IsSet,
        Na__NorthData__GetBearingDeg,
        Na__NorthData__GetOriginMm,
        Na__NorthData__Set,
        Na__NorthData__Clear,
        Na__NorthData__Save
    } from './Na__North__ProjectJson__Data__.js';
    import { Na__NorthGizmo__RadiusFor, Na__NorthGizmo__Show, Na__NorthGizmo__Dispose, Na__NorthGizmo__IsKept, Na__NorthGizmo__SetKept } from './Na__North__CompassGizmo__.js';
    import { Na__NorthPick__Start, Na__NorthPick__Cancel, Na__NorthPick__IsActive, Na__NorthPick__IsAiming } from './Na__North__PickTool__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Markup Ids
    // ------------------------------------------------------------
    const Na__NorthDev__ITEM_ID   = 'naNorthDevItem';
    const Na__NorthDev__TOGGLE_ID = 'naNorthDevToggle';
    const Na__NorthDev__PANEL_ID  = 'naNorthDevPanel';
    // ------------------------------------------------------------

    // MODULE VARIABLES | Injected References and What Was Last Saved
    // ------------------------------------------------------------
    let Na__NorthDev__Panel       = null;
    let Na__NorthDev__ModelRoot   = null;
    let Na__NorthDev__ShowToast   = null;
    let Na__NorthDev__Initialized = false;
    let Na__NorthDev__SavedState  = undefined;   // <-- The bearing R2 holds, as far as this session knows: undefined until the first render
    let Na__NorthDev__AimBearing  = null;        // <-- The bearing under the pointer while aiming; null otherwise
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Toast, Bounds and the Open State
    // ------------------------------------------------------------
    function Na__NorthDev__Toast(message, isError) {
        if (typeof Na__NorthDev__ShowToast === 'function') Na__NorthDev__ShowToast(message, isError === true);
    }
    function Na__NorthDev__Bounds() {
        if (!Na__NorthDev__ModelRoot) return null;
        const box = new THREE.Box3().setFromObject(Na__NorthDev__ModelRoot);
        return box.isEmpty() ? null : box;
    }
    function Na__NorthDev__IsOpen() {
        return !!Na__NorthDev__Panel && Na__NorthDev__Panel.classList.contains('is-open');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Bearing as the Panel Writes It
    // ------------------------------------------------------------
    function Na__NorthDev__BearingText(bearingDeg) {
        return Na__NorthMath__Wrap(bearingDeg).toFixed(Na__NorthCfg__GetCompassSetup().decimals);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where the Compass Stands When Nobody Has Drawn One
    // ------------------------------------------------------------
    // The middle of the model, in scene units, at ground level (y = 0) when
    // the model straddles it - PS02's reaches five metres below, with its site
    // - else at its foot; the world origin with nothing loaded.
    // ------------------------------------------------------------
    function Na__NorthDev__DefaultOrigin() {
        const box = Na__NorthDev__Bounds();
        if (!box) return { x : 0, y : 0, z : 0 };
        const centre = box.getCenter(new THREE.Vector3());
        return { x : centre.x, y : (box.min.y <= 0 && box.max.y >= 0) ? 0 : box.min.y, z : centre.z };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put the Stored Compass in the Scene, or Take It Out
    // ------------------------------------------------------------
    // The compass is up while the panel is open, as it always was, AND while
    // Show Compass is switched on - which is the point of switching it on:
    // the panel can then be closed and the compass read from the model,
    // beside whichever drawing planes are switched on.
    //
    // Left alone while a compass is being drawn: the pick tool is showing
    // one that follows the pointer, and north is not set until the second
    // click, so this would take it down mid-aim.
    // ------------------------------------------------------------
    function Na__NorthDev__SyncCompass() {
        if (Na__NorthPick__IsActive()) return;
        const bearing = Na__NorthData__GetBearingDeg();
        const wanted  = Na__NorthGizmo__IsKept() || Na__NorthDev__IsOpen();
        if (bearing === null || !wanted) { Na__NorthGizmo__Dispose(); return; }  // <-- Nothing to point at, or nobody asking: the geometry goes with it
        const held   = Na__NorthData__GetOriginMm();
        const origin = held ? { x : Na__Math__ConvertMmToUnits(held.x), y : Na__Math__ConvertMmToUnits(held.y), z : Na__Math__ConvertMmToUnits(held.z) } : Na__NorthDev__DefaultOrigin();
        Na__NorthGizmo__Show(origin, bearing, Na__NorthGizmo__RadiusFor(Na__NorthDev__Bounds()), false);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Switch Show Compass On or Off
    // ------------------------------------------------------------
    function Na__NorthDev__ToggleKept() {
        Na__NorthGizmo__SetKept(!Na__NorthGizmo__IsKept());
        Na__NorthDev__SyncCompass();
        Na__NorthDev__Render();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Actions
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Draw Compass, or Cancel the One Being Drawn
    // ------------------------------------------------------------
    function Na__NorthDev__ToggleDraw() {
        if (Na__NorthPick__IsActive()) { Na__NorthPick__Cancel(); return; }
        if (!Na__NorthDev__Bounds()) {
            Na__NorthDev__Toast(Na__NorthCfg__GetLabel('NoModelMessage', 'Load a model before drawing the compass.'), true);
            return;
        }
        const radius = Na__NorthGizmo__RadiusFor(Na__NorthDev__Bounds());
        const held   = Na__NorthData__GetBearingDeg();
        Na__NorthPick__Start({
            onOrigin    : (point) => {
                Na__NorthDev__AimBearing = (held === null) ? 0 : held;
                Na__NorthGizmo__Show(point, Na__NorthDev__AimBearing, radius, true);
                Na__NorthDev__Render();
            },
            onAim       : (point, bearingDeg) => {
                Na__NorthDev__AimBearing = bearingDeg;
                Na__NorthGizmo__Show(point, bearingDeg, radius, true);
                Na__NorthDev__RenderLive();
            },
            onPicked    : (result) => {
                Na__NorthDev__AimBearing = null;
                const stored = Na__NorthData__Set(result.bearingDeg, result.originMm);
                Na__NorthDev__Toast(Na__NorthCfg__FormatLabel('SetMessage', 'North set to {bearing} degrees. Save it to keep it.', { bearing : Na__NorthDev__BearingText(stored) }));
                Na__NorthDev__SyncCompass();
                Na__NorthDev__Render();
            },
            onCancelled : () => {
                Na__NorthDev__AimBearing = null;
                Na__NorthDev__Toast(Na__NorthCfg__GetLabel('CancelledMessage', 'Compass cancelled.'));
                Na__NorthDev__SyncCompass();
                Na__NorthDev__Render();
            }
        });
        Na__NorthDev__Render();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Bearing Typed Into the Field
    // ------------------------------------------------------------
    // Keeps where the compass was drawn; with no compass yet it stands at the
    // foot of the model's middle.
    // ------------------------------------------------------------
    function Na__NorthDev__TypeBearing(value) {
        if (!Number.isFinite(value)) { Na__NorthDev__Render(); return; }
        const origin = Na__NorthData__GetOriginMm() ? undefined : (() => {
            const at = Na__NorthDev__DefaultOrigin();
            return { x : Na__Math__ConvertUnitsToMm(at.x), y : Na__Math__ConvertUnitsToMm(at.y), z : Na__Math__ConvertUnitsToMm(at.z) };
        })();
        const stored = Na__NorthData__Set(value, origin);
        Na__NorthDev__Toast(Na__NorthCfg__FormatLabel('SetMessage', 'North set to {bearing} degrees. Save it to keep it.', { bearing : Na__NorthDev__BearingText(stored) }));
        Na__NorthDev__SyncCompass();
        Na__NorthDev__Render();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Clear North
    // ------------------------------------------------------------
    function Na__NorthDev__Clear() {
        if (!Na__NorthData__IsSet()) return;
        if (!window.confirm(Na__NorthCfg__GetLabel('ClearPrompt', 'Clear the north direction? Drawing titles that use it go back to {{Direction}}.'))) return;
        Na__NorthPick__Cancel();
        Na__NorthData__Clear();
        Na__NorthDev__Toast(Na__NorthCfg__GetLabel('ClearedMessage', 'North cleared. Save to keep it cleared.'));
        Na__NorthDev__SyncCompass();
        Na__NorthDev__Render();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Save North With the Drawings
    // ------------------------------------------------------------
    async function Na__NorthDev__Save() {
        const saved = await Na__NorthData__Save((message, isError) => { if (isError) Na__NorthDev__Toast(message, true); });
        if (!saved) return false;
        Na__NorthDev__SavedState = Na__NorthData__GetBearingDeg();
        Na__NorthDev__Toast(Na__NorthCfg__GetLabel('SavedMessage', 'North direction saved with the drawings.'));
        Na__NorthDev__Render();
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Panel Render
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Small Builders in the Dev Menu's Own Classes
    // ------------------------------------------------------------
    function Na__NorthDev__El(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined) el.textContent = text;
        return el;
    }
    function Na__NorthDev__Button(text, modifierClass, onClick) {
        const button = Na__NorthDev__El('button', 'na-pm-dev__btn' + (modifierClass ? ' ' + modifierClass : ''), text);
        button.type = 'button';
        button.addEventListener('click', onClick);
        return button;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Bearing the Panel Is Showing: the One Being Aimed, Else the One Held
    // ------------------------------------------------------------
    function Na__NorthDev__ShownBearing() {
        return (Na__NorthDev__AimBearing !== null) ? Na__NorthDev__AimBearing : Na__NorthData__GetBearingDeg();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Status Line and the Elevation List, Which Follow the Compass Live
    // ------------------------------------------------------------
    function Na__NorthDev__RenderLive() {
        if (!Na__NorthDev__Panel) return;
        const status = Na__NorthDev__Panel.querySelector('[data-na-north="status"]');
        const list   = Na__NorthDev__Panel.querySelector('[data-na-north="elevations"]');
        const field  = Na__NorthDev__Panel.querySelector('[data-na-north="bearing"]');
        const shown  = Na__NorthDev__ShownBearing();
        const setup  = Na__NorthCfg__GetCompassSetup();

        if (status) {
            let text = (shown === null)
                ? Na__NorthCfg__GetLabel('StatusUnset', 'North has not been set. Until it is, drawing titles that need it read {{Direction}} and elevations keep the names they were given.')
                : Na__NorthCfg__FormatLabel('StatusSet', 'North is {bearing} degrees clockwise of the model\'s -Z axis (SketchUp\'s green axis).', { bearing : Na__NorthDev__BearingText(shown) });
            if (Na__NorthDev__AimBearing === null && Na__NorthData__GetBearingDeg() !== Na__NorthDev__SavedState) text += ' ' + Na__NorthCfg__GetLabel('StatusUnsaved', 'Not saved yet.');
            status.textContent = text;
        }
        if (field && document.activeElement !== field) field.value = (shown === null) ? '' : Na__NorthDev__BearingText(shown);

        if (!list) return;
        list.innerHTML = '';
        const elevations = (Na__DrawData__GetElevationsArray() || []).filter((elevation) => !!elevation && typeof elevation === 'object');
        if (elevations.length === 0) {
            list.appendChild(Na__NorthDev__El('p', 'na-fp-dev__empty', Na__NorthCfg__GetLabel('NoElevations', 'This project has no elevations yet.')));
            return;
        }
        elevations.forEach((elevation) => {
            const azimuth = Number(elevation.Elevation__AzimuthDeg);
            const tokens  = { name : elevation.Elevation__Name || elevation.Elevation__Id, azimuth : Number.isFinite(azimuth) ? String(azimuth) : '?' };
            const word    = (shown === null) ? '' : Na__NorthMath__FacingWord(azimuth, shown, setup.halfWidthDeg, setup.words);
            const row     = Na__NorthDev__El('div', 'na-north-dev__elevation');
            row.textContent = word
                ? Na__NorthCfg__FormatLabel('ElevationRowFormat', '{name} ({azimuth} degrees) faces {word}', Object.assign({ word : word }, tokens))
                : Na__NorthCfg__FormatLabel('ElevationRowUnset', '{name} ({azimuth} degrees)', tokens);
            list.appendChild(row);
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Rebuild the Whole North Direction Panel
    // ------------------------------------------------------------
    function Na__NorthDev__Render() {
        if (!Na__NorthDev__Panel) return;
        if (Na__NorthDev__SavedState === undefined) Na__NorthDev__SavedState = Na__NorthData__GetBearingDeg();   // <-- What the project arrived with is what R2 holds
        Na__NorthDev__Panel.innerHTML = '';

        Na__NorthDev__Panel.appendChild(Na__NorthDev__El('div', 'na-dropdown-menu__panel-title', Na__NorthCfg__GetLabel('SectionTitle', 'North Direction')));

        const status = Na__NorthDev__El('p', 'na-fp-dev__empty');
        status.setAttribute('data-na-north', 'status');
        Na__NorthDev__Panel.appendChild(status);

        const picking = Na__NorthPick__IsActive();
        if (picking) {
            const hint = Na__NorthPick__IsAiming()
                ? Na__NorthCfg__GetLabel('PickSecondHint', 'Now click towards north. Hold Shift to snap; Esc cancels.')
                : Na__NorthCfg__GetLabel('PickFirstHint', 'Click where the compass should sit.');
            Na__NorthDev__Panel.appendChild(Na__NorthDev__El('p', 'na-fp-dev__empty na-north-dev__hint', hint));
        }

        const row = Na__NorthDev__El('div', 'na-dropdown-menu__panel-row');
        row.appendChild(Na__NorthDev__El('span', 'na-dropdown-menu__value', Na__NorthCfg__GetLabel('BearingFieldLabel', 'Bearing')));
        const field = document.createElement('input');
        field.type      = 'number';
        field.className = 'na-pm-dev__input na-pm-dev__input--short';
        field.min = '0'; field.max = '360'; field.step = '0.5';
        field.disabled  = picking;
        field.setAttribute('data-na-north', 'bearing');
        field.addEventListener('change', () => Na__NorthDev__TypeBearing(field.value === '' ? NaN : parseFloat(field.value)));
        row.appendChild(field);
        row.appendChild(Na__NorthDev__El('span', 'na-dropdown-menu__value', 'deg'));
        Na__NorthDev__Panel.appendChild(row);

        const actions = Na__NorthDev__El('div', 'na-pm-dev__actions');
        const drawLabel = picking ? Na__NorthCfg__GetLabel('CancelDrawLabel', 'Cancel')
            : (Na__NorthData__IsSet() ? Na__NorthCfg__GetLabel('RedrawLabel', 'Redraw Compass') : Na__NorthCfg__GetLabel('DrawLabel', 'Draw Compass'));
        actions.appendChild(Na__NorthDev__Button(drawLabel, '', Na__NorthDev__ToggleDraw));
        const clear = Na__NorthDev__Button(Na__NorthCfg__GetLabel('ClearLabel', 'Clear North'), '', Na__NorthDev__Clear);
        clear.disabled = picking || !Na__NorthData__IsSet();
        actions.appendChild(clear);

        // SHOW COMPASS | Pressed while the compass is being kept, the same
        // pressed look a drawing plane's Show plane button wears.
        const kept = Na__NorthGizmo__IsKept();
        const keep = Na__NorthDev__Button(Na__NorthCfg__GetLabel('ShowCompassLabel', 'Show Compass'), kept ? 'na-pm-dev__btn--primary' : '', Na__NorthDev__ToggleKept);
        keep.setAttribute('aria-pressed', String(kept));
        keep.disabled = picking || !Na__NorthData__IsSet();
        keep.title    = kept
            ? Na__NorthCfg__GetLabel('ShowCompassOnHint',  'The compass stays in the 3D view with the panel closed, so it can be read while orbiting the model alongside the drawing planes. Kept between visits.')
            : Na__NorthCfg__GetLabel('ShowCompassOffHint', 'Leave the compass in the 3D view once this panel is closed.');
        actions.appendChild(keep);
        Na__NorthDev__Panel.appendChild(actions);

        Na__NorthDev__Panel.appendChild(Na__NorthDev__El('div', 'na-dropdown-menu__panel-title', Na__NorthCfg__GetLabel('ElevationsTitle', 'What the elevations will be called')));
        const list = Na__NorthDev__El('div', 'na-north-dev__elevations');
        list.setAttribute('data-na-north', 'elevations');
        Na__NorthDev__Panel.appendChild(list);

        const saveActions = Na__NorthDev__El('div', 'na-pm-dev__actions');
        const save = Na__NorthDev__Button(Na__NorthCfg__GetLabel('SaveLabel', 'Save North'), 'na-pm-dev__btn--primary', Na__NorthDev__Save);
        save.disabled = picking;
        saveActions.appendChild(save);
        Na__NorthDev__Panel.appendChild(saveActions);

        Na__NorthDev__RenderLive();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize the Authoring-Only North Direction Section
    // ------------------------------------------------------------
    // context: { modelRoot, showToast }
    // Resolves false, leaving the section hidden, when authoring is locked,
    // the markup is absent or the config switches the tool off. A saved north
    // is read and used all the same - see Na__North__ProjectJson__Data__.
    // ------------------------------------------------------------
    async function Na__North__DevMenu__Initialize(context) {
        if (Na__NorthDev__Initialized) return true;
        if (!Na__DevGate__IsAuthoringEnabled()) return false;
        const menuItem = document.getElementById(Na__NorthDev__ITEM_ID);
        const toggle   = document.getElementById(Na__NorthDev__TOGGLE_ID);
        const panel    = document.getElementById(Na__NorthDev__PANEL_ID);
        if (!menuItem || !toggle || !panel) return false;                        // <-- Markup absent: nothing to mount into
        if (!(await Na__NorthCfg__Load())) return false;                         // <-- Switched off in config: no section at all

        Na__NorthDev__Panel       = panel;
        Na__NorthDev__ModelRoot   = (context && context.modelRoot) || null;
        Na__NorthDev__ShowToast   = (context && context.showToast) || null;
        Na__NorthDev__Initialized = true;

        menuItem.style.display = '';                                             // <-- Reveal alongside the other dev tools

        toggle.addEventListener('click', () => {
            const isOpen = panel.classList.contains('is-open');
            panel.classList.toggle('is-open', !isOpen);
            toggle.setAttribute('aria-expanded', String(!isOpen));
            if (!isOpen) {
                Na__NorthDev__Render();                                          // <-- Rebuild on each open so data is fresh
                Na__NorthDev__SyncCompass();
            } else {
                // Authoring is done. The compass that was only up because the
                // panel was goes; a compass SWITCHED ON stays, which is the
                // point of switching it on.
                Na__NorthPick__Cancel();
                Na__NorthDev__SyncCompass();
            }
        });

        // A project switch replaces the drawings block, and north with it; a
        // save from another panel lands whatever north is held.
        window.addEventListener(Na__DrawData__CHANGED_EVENT, () => {
            Na__NorthDev__SavedState = Na__NorthData__GetBearingDeg();
            if (Na__NorthDev__IsOpen()) Na__NorthDev__Render();
            Na__NorthDev__SyncCompass();                                         // <-- Also with the panel shut: a kept compass follows the project it belongs to
        });
        window.addEventListener(Na__NorthData__CHANGED_EVENT, () => {
            if (Na__NorthDev__IsOpen() && !Na__NorthPick__IsActive()) Na__NorthDev__RenderLive();
            Na__NorthDev__SyncCompass();
        });

        Na__NorthDev__SyncCompass();                                             // <-- A compass switched on in an earlier visit comes back up with the model
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Point the Editor at a Different Model Root
    // ------------------------------------------------------------
    function Na__North__DevMenu__SetModelRoot(modelRoot) {
        Na__NorthDev__ModelRoot = modelRoot || null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | North Direction Dev Menu Editor API
    // ------------------------------------------------------------
    export {
        Na__North__DevMenu__Initialize,
        Na__North__DevMenu__SetModelRoot
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
