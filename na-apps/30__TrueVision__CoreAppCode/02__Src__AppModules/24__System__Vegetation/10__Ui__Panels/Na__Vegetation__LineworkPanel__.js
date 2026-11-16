// =============================================================================
// TRUEVISION3D - VEGETATION - THE VEGETATION LINEWORK PANEL
// =============================================================================
//
// FILE       : Na__Vegetation__LineworkPanel__.js
// NAMESPACE  : Na__VegLine
// MODULE     : System - Vegetation
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The demo's Line Rules panel, in the app, for devs: every value saves in
//              this project's own object
// CREATED    : 04-Nov-2026
//
// DESCRIPTION:
// - Adam, 04-Nov-2026: "also add that lvegetation linework panel from the demo into a
//   section for devs too and save all parameters to a new json object with nested keys
//   eetc in my style per file that we enable the vegeation on".
// - THE KEYS ARE THE RECORD'S. Each slider names the key it writes, and its default is that
//   key in the config, so a value is one grep from where it is saved.
// - THREE KINDS OF SLIDER. Weights and what is drawn from the balls apply as they move. The
//   two that change the balls themselves (Scallop size, Small bumps) rebuild every plant,
//   so they apply when the slider is let go.
//
// INTEGRATION:
// - Opened from Tools & Settings > Vegetation (Na__Vegetation__MenuSection__.js).
// - @delegate: ../03__System__SceneLayer/Na__Vegetation__Runtime__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 24__System__Vegetation/10__Ui__Panels/Na__Vegetation__LineworkPanel__.js (ValeVision3D v2.98.6)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : identical (header, console prefix and the Entourage folder's number apart)
// - Divergences   : none in behaviour. Entourage is 28__System__Entourage in TrueVision (its 23
//                   is Scene Sync); the vegetation and entourage READMEs list what differs around it.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 04-Nov-2026 - Version 1.1.0 (ValeVision3D v2.86.0)
// - Advanced: Fill against walls, the share of the walls' brightness. Fill tone is now Fill on
//   sheets, because that is where it counts.
//
// 04-Nov-2026 - Version 1.0.0 (ValeVision3D v2.85.0)
// - Initial build: Stage 3 of ValeVision__PLAN__VegetationSystem__.md.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Shell, Runtime and Data
    // ------------------------------------------------------------
    import {
        Na__VegShell__El,
        Na__VegShell__Button,
        Na__VegShell__Slider,
        Na__VegShell__Open,
        Na__VegShell__Close,
        Na__VegShell__IsOpen,
        Na__VegShell__MarkChanged,
        Na__VegShell__BeforeChange,
        Na__VegShell__Config,
        Na__VegShell__Prepare
    } from './Na__Vegetation__PanelShell__.js';
    import {
        Na__VegRun__ApplyLineRules,
        Na__VegRun__GetSceneData,
        Na__VegRun__GetStats
    } from '../03__System__SceneLayer/Na__Vegetation__Runtime__.js';
    import { Na__VegData__DefaultsFromConfig } from '../02__Core__Data/Na__Vegetation__SceneData__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Panel and Its Sliders
    // ------------------------------------------------------------
    const Na__VegLine__PANEL_ID = 'naVegetationLineworkPanel';
    const Na__VegLine__STATS_MS = 500;
    const Na__VegLine__SLIDERS = [
        { Key : 'Vegetation__LineRules__LineWeightPx',      Label : 'Line weight',  Min : 0.4, Max : 2.0, Step : 0.05, Live : true },
        { Key : 'Vegetation__LineRules__InnerWeightShare',  Label : 'Inner weight', Min : 0.4, Max : 1.0, Step : 0.05, Live : true },
        { Key : 'Vegetation__LineRules__InnerArcsFactor',   Label : 'Inner arcs',   Min : 0.0, Max : 2.5, Step : 0.05, Live : true },
        { Key : 'Vegetation__LineRules__HooksFactor',       Label : 'Hooks',        Min : 0.0, Max : 2.0, Step : 0.05, Live : true },
        { Key : 'Vegetation__LineRules__CurlsFactor',       Label : 'Curls',        Min : 0.0, Max : 3.0, Step : 0.05, Live : true },
        { Key : 'Vegetation__LineRules__PenLiftsFactor',    Label : 'Pen lifts',    Min : 0.0, Max : 4.0, Step : 0.05, Live : true },
        { Key : 'Vegetation__LineRules__ScallopSizeFactor', Label : 'Scallop size', Min : 0.6, Max : 1.6, Step : 0.05, Live : false },
        { Key : 'Vegetation__LineRules__SmallBumpsFactor',  Label : 'Small bumps',  Min : 0.0, Max : 2.5, Step : 0.05, Live : false }
    ];
    const Na__VegLine__ADVANCED = [
        { Key : 'Vegetation__LineRulesAdvanced__SegmentPx',      Label : 'Segment size (px)',    Min : 1.0,     Max : 10.0,   Step : 0.5,     Digits : 1 },
        { Key : 'Vegetation__LineRulesAdvanced__LodSkipPx',      Label : 'Drop balls under (px)', Min : 0.0,    Max : 6.0,    Step : 0.5,     Digits : 1 },
        { Key : 'Vegetation__LineRulesAdvanced__LodInnerArcsPx', Label : 'Inner arcs from (px)', Min : 0.0,     Max : 20.0,   Step : 0.5,     Digits : 1 },
        { Key : 'Vegetation__LineRulesAdvanced__LodHooksPx',     Label : 'Hooks from (px)',      Min : 0.0,     Max : 20.0,   Step : 0.5,     Digits : 1 },
        { Key : 'Vegetation__LineRulesAdvanced__LodCurlsPx',     Label : 'Curls from (px)',      Min : 0.0,     Max : 20.0,   Step : 0.5,     Digits : 1 },
        { Key : 'Vegetation__LineRulesAdvanced__LodBladesPx',    Label : 'Blades from (px)',     Min : 0.0,     Max : 30.0,   Step : 0.5,     Digits : 1 },
        { Key : 'Vegetation__LineRulesAdvanced__FillWallShare',  Label : 'Fill against walls',   Min : 0.80,    Max : 1.05,   Step : 0.005,   Digits : 3 },
        { Key : 'Vegetation__LineRulesAdvanced__FillTone',       Label : 'Fill on sheets',       Min : 0.85,    Max : 1.0,    Step : 0.005,   Digits : 3 },
        { Key : 'Vegetation__LineRulesAdvanced__DepthBias',      Label : 'Depth bias',           Min : 0.00000, Max : 0.0002, Step : 0.00001, Digits : 5 }
    ];
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Variables
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | What the Open Panel Holds
    // ------------------------------------------------------------
    const Na__VegLine__State = {
        statsEl    : null,
        statsTimer : 0,
        controls   : []                                                        // <-- { setValue, read } for each slider, so an undo or a reset can put them right
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Panel
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Bring Every Slider Back to What the Object Says
    // ------------------------------------------------------------
    function Na__VegLine__ReadBack() {
        Na__VegLine__State.controls.forEach((control) => control.setValue(control.read()));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Slider Over One Key of the Object
    // ------------------------------------------------------------
    function Na__VegLine__MakeSlider(spec, block, digits) {
        const write = (value) => {
            Na__VegShell__BeforeChange('linework-' + spec.Key);
            block()[spec.Key] = value;
            Na__VegShell__MarkChanged();
        };
        const live = spec.Live !== false;
        const slider = Na__VegShell__Slider({
            label    : spec.Label,
            min      : spec.Min,
            max      : spec.Max,
            step     : spec.Step,
            value    : block()[spec.Key],
            format   : (value) => Number(value).toFixed(digits),
            onInput  : live ? (value) => { write(value); Na__VegRun__ApplyLineRules(); } : null,
            onChange : live ? null : (value) => { write(value); Na__VegRun__ApplyLineRules(); }
        });
        Na__VegLine__State.controls.push({ setValue : slider.setValue, read : () => block()[spec.Key] });
        return slider.row;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put Every Slider Back to the App's Defaults
    // ------------------------------------------------------------
    function Na__VegLine__Reset() {
        Na__VegShell__BeforeChange('');
        const rules = Na__VegRun__GetSceneData().Vegetation__SceneData__LineRules;
        const defaults = Na__VegData__DefaultsFromConfig(Na__VegShell__Config()).Vegetation__SceneData__LineRules;
        Object.keys(defaults).forEach((key) => {
            if (key === 'Vegetation__LineRules__Advanced') return;
            rules[key] = defaults[key];
        });
        Object.assign(rules.Vegetation__LineRules__Advanced, defaults.Vegetation__LineRules__Advanced);
        Na__VegShell__MarkChanged();
        Na__VegRun__ApplyLineRules();
        Na__VegLine__ReadBack();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Refresh the Numbers Under the Sliders
    // ------------------------------------------------------------
    function Na__VegLine__WriteStats() {
        const el = Na__VegLine__State.statsEl;
        const stats = Na__VegRun__GetStats();
        if (!el || !stats) return;
        const rows = [
            ['Plants', stats.plants],
            ['Plants in view', stats.bushes],
            ['Balls', stats.lobes],
            ['Line segments', stats.outer + stats.inner],
            ['Fill triangles', Math.round(stats.fillTris)],
            ['Lines worked out in', stats.drawMs.toFixed(1) + ' ms'],
            ['Last full redraw', stats.lastFullMs.toFixed(0) + ' ms'],
            ['Buffers', stats.buffersMb.toFixed(0) + ' MB']
        ];
        el.textContent = '';
        rows.forEach((row) => {
            const line = Na__VegShell__El('div', 'na-veg-stats__row');
            line.appendChild(Na__VegShell__El('span', '', row[0]));
            line.appendChild(Na__VegShell__El('span', 'na-veg-stats__value', String(row[1])));
            el.appendChild(line);
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Stop What the Panel Was Doing
    // ------------------------------------------------------------
    function Na__VegLine__OnClose() {
        window.clearInterval(Na__VegLine__State.statsTimer);
        window.removeEventListener('na-vegetation-object-replaced', Na__VegLine__ReadBack);
        Na__VegLine__State.statsEl  = null;
        Na__VegLine__State.controls = [];
    }
    // ------------------------------------------------------------


    // FUNCTION | Open the Panel, or Close It If It Is Open
    // ------------------------------------------------------------
    async function Na__VegLine__Toggle(context) {
        await Na__VegShell__Prepare(context);
        if (Na__VegShell__IsOpen(Na__VegLine__PANEL_ID)) {
            Na__VegShell__Close(Na__VegLine__PANEL_ID);
            return;
        }
        const panel = Na__VegShell__Open({ id : Na__VegLine__PANEL_ID, title : 'Vegetation Linework', side : 'right', width : 236, onClose : Na__VegLine__OnClose });
        const rules = () => Na__VegRun__GetSceneData().Vegetation__SceneData__LineRules;
        const advanced = () => rules().Vegetation__LineRules__Advanced;

        panel.head.insertBefore(Na__VegShell__Button('Reset', '', Na__VegLine__Reset, 'Every slider back to the app\'s defaults'), panel.head.lastChild);

        Na__VegLine__SLIDERS.forEach((spec) => panel.body.appendChild(Na__VegLine__MakeSlider(spec, rules, 2)));

        const details = Na__VegShell__El('details', 'na-veg-advanced');
        details.appendChild(Na__VegShell__El('summary', 'na-veg-advanced__title', 'Advanced'));
        Na__VegLine__ADVANCED.forEach((spec) => details.appendChild(Na__VegLine__MakeSlider(spec, advanced, spec.Digits)));
        panel.body.appendChild(details);

        panel.body.appendChild(Na__VegShell__El('div', 'na-veg-panel__section', 'This view'));
        Na__VegLine__State.statsEl = Na__VegShell__El('div', 'na-veg-stats');
        panel.body.appendChild(Na__VegLine__State.statsEl);
        Na__VegLine__WriteStats();
        Na__VegLine__State.statsTimer = window.setInterval(Na__VegLine__WriteStats, Na__VegLine__STATS_MS);
        window.addEventListener('na-vegetation-object-replaced', Na__VegLine__ReadBack);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Linework Panel API
    // ------------------------------------------------------------
    export {
        Na__VegLine__Toggle
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
