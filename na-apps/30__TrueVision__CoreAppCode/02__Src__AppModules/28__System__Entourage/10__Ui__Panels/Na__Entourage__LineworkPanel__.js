// =============================================================================
// TRUEVISION3D - ENTOURAGE - THE LINEWORK PANEL
// =============================================================================
//
// FILE       : Na__Entourage__LineworkPanel__.js
// NAMESPACE  : Na__EntLine
// MODULE     : System - Entourage
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Entourage Linework: every line rule as a slider, for an author, saved
//              in the project's object
// CREATED    : 05-Nov-2026
//
// DESCRIPTION:
// - Adam, 05-Nov-2026: "on my developer version add all the same exposed parameters so i can
//   tweak if needed". The Vegetation Linework panel's shape, with what a figure has: there are
//   no balls here, so no scallops or bumps, and smoothing in their place.
// - EVERY SLIDER IS LIVE. A figure is a few hundred segments, so even the sliders that change the
//   lines themselves redraw as they move.
//
// INTEGRATION:
// - Opened from Tools & Settings > Entourage (./Na__Entourage__MenuSection__.js).
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 23__System__Entourage/10__Ui__Panels/Na__Entourage__LineworkPanel__.js (ValeVision3D v2.98.6)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : identical (header, console prefix and the Entourage folder's number apart)
// - Divergences   : none in behaviour. Entourage is 28__System__Entourage in TrueVision (its 23
//                   is Scene Sync); the vegetation and entourage READMEs list what differs around it.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 05-Nov-2026 - Version 1.0.0 (ValeVision3D v2.88.0)
// - Initial build.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Shell, Runtime and Data
    // ------------------------------------------------------------
    import {
        Na__EntShell__El,
        Na__EntShell__Button,
        Na__EntShell__Slider,
        Na__EntShell__Open,
        Na__EntShell__Close,
        Na__EntShell__IsOpen,
        Na__EntShell__MarkChanged,
        Na__EntShell__BeforeChange,
        Na__EntShell__Config,
        Na__EntShell__Prepare
    } from './Na__Entourage__PanelShell__.js';
    import {
        Na__EntRun__ApplyLineRules,
        Na__EntRun__GetSceneData,
        Na__EntRun__GetStats
    } from '../03__System__SceneLayer/Na__Entourage__Runtime__.js';
    import { Na__EntData__DefaultsFromConfig } from '../02__Core__Data/Na__Entourage__SceneData__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and Variables
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Panel and Its Sliders
    // ------------------------------------------------------------
    const Na__EntLine__PANEL_ID = 'naEntourageLineworkPanel';
    const Na__EntLine__STATS_MS = 500;
    const Na__EntLine__SLIDERS = [
        { Key : 'Entourage__LineRules__LineWeightPx',     Label : 'Line weight',  Min : 0.3, Max : 2.0, Step : 0.05, Digits : 2, Title : 'Pixels, as the model\'s own lines' },
        { Key : 'Entourage__LineRules__InnerWeightShare', Label : 'Inner weight', Min : 0.3, Max : 1.0, Step : 0.05, Digits : 2, Title : 'Hooks and a drawing\'s inner lines, as a share of the outline' },
        { Key : 'Entourage__LineRules__HooksFactor',      Label : 'Hooks',        Min : 0.0, Max : 2.0, Step : 0.05, Digits : 2, Title : 'At a sharp notch the line carries on inward. 0 is none' },
        { Key : 'Entourage__LineRules__PenLiftsFactor',   Label : 'Pen lifts',    Min : 0.0, Max : 4.0, Step : 0.05, Digits : 2, Title : 'Small gaps in the outline. 2 is twice as many, 0 is an unbroken line' },
        { Key : 'Entourage__LineRules__SmoothingPasses',  Label : 'Smoothing',    Min : 0,   Max : 4,   Step : 1,    Digits : 0, Title : 'How far a traced outline is rounded. Its real corners stay' }
    ];
    const Na__EntLine__ADVANCED = [
        { Key : 'Entourage__LineRulesAdvanced__CornerDeg',      Label : 'Corner from (deg)',    Min : 20,      Max : 120,    Step : 1,       Digits : 0 },
        { Key : 'Entourage__LineRulesAdvanced__CornerSpanMm',   Label : 'Corner span (mm)',     Min : 5,       Max : 80,     Step : 1,       Digits : 0 },
        { Key : 'Entourage__LineRulesAdvanced__PenLiftEveryMm', Label : 'Pen lift every (mm)',  Min : 150,     Max : 2000,   Step : 10,      Digits : 0 },
        { Key : 'Entourage__LineRulesAdvanced__PenLiftGapMm',   Label : 'Pen lift gap (mm)',    Min : 4,       Max : 80,     Step : 1,       Digits : 0 },
        { Key : 'Entourage__LineRulesAdvanced__HookNotchDeg',   Label : 'Hook notch from (deg)', Min : 20,     Max : 150,    Step : 1,       Digits : 0 },
        { Key : 'Entourage__LineRulesAdvanced__HookChance',     Label : 'Hook chance',          Min : 0,       Max : 1,      Step : 0.01,    Digits : 2 },
        { Key : 'Entourage__LineRulesAdvanced__HookMinMm',      Label : 'Hook shortest (mm)',   Min : 10,      Max : 300,    Step : 5,       Digits : 0 },
        { Key : 'Entourage__LineRulesAdvanced__HookMaxMm',      Label : 'Hook longest (mm)',    Min : 10,      Max : 500,    Step : 5,       Digits : 0 },
        { Key : 'Entourage__LineRulesAdvanced__FillWallShare',  Label : 'Fill against walls',   Min : 0.80,    Max : 1.05,   Step : 0.005,   Digits : 3 },
        { Key : 'Entourage__LineRulesAdvanced__FillTone',       Label : 'Fill on sheets',       Min : 0.85,    Max : 1.0,    Step : 0.005,   Digits : 3 },
        { Key : 'Entourage__LineRulesAdvanced__DepthBias',      Label : 'Depth bias',           Min : 0.00000, Max : 0.0002, Step : 0.00001, Digits : 5 }
    ];
    // ------------------------------------------------------------

    // MODULE VARIABLES | What the Open Panel Holds
    // ------------------------------------------------------------
    const Na__EntLine__State = {
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
    function Na__EntLine__ReadBack() {
        Na__EntLine__State.controls.forEach((control) => control.setValue(control.read()));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Slider Over One Key of the Object
    // ------------------------------------------------------------
    function Na__EntLine__MakeSlider(spec, block) {
        const slider = Na__EntShell__Slider({
            label   : spec.Label,
            title   : spec.Title,
            min     : spec.Min,
            max     : spec.Max,
            step    : spec.Step,
            value   : block()[spec.Key],
            format  : (value) => Number(value).toFixed(spec.Digits),
            onInput : (value) => {
                Na__EntShell__BeforeChange('linework-' + spec.Key);
                block()[spec.Key] = value;
                Na__EntShell__MarkChanged();
                Na__EntRun__ApplyLineRules();
            }
        });
        Na__EntLine__State.controls.push({ setValue : slider.setValue, read : () => block()[spec.Key] });
        return slider.row;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put Every Slider Back to the App's Defaults
    // ------------------------------------------------------------
    function Na__EntLine__Reset() {
        Na__EntShell__BeforeChange('');
        const rules = Na__EntRun__GetSceneData().Entourage__SceneData__LineRules;
        const defaults = Na__EntData__DefaultsFromConfig(Na__EntShell__Config()).Entourage__SceneData__LineRules;
        Object.keys(defaults).forEach((key) => {
            if (key === 'Entourage__LineRules__Advanced') return;
            rules[key] = defaults[key];
        });
        Object.assign(rules.Entourage__LineRules__Advanced, defaults.Entourage__LineRules__Advanced);
        Na__EntShell__MarkChanged();
        Na__EntRun__ApplyLineRules();
        Na__EntLine__ReadBack();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Refresh the Numbers Under the Sliders
    // ------------------------------------------------------------
    function Na__EntLine__WriteStats() {
        const el = Na__EntLine__State.statsEl;
        const stats = Na__EntRun__GetStats();
        if (!el || !stats) return;
        const rows = [
            ['Figures', stats.figures],
            ['Line segments', stats.outer + stats.inner],
            ['Fill triangles', Math.round(stats.fillTris)],
            ['Turned to the camera in', stats.writeMs.toFixed(2) + ' ms']
        ];
        el.textContent = '';
        rows.forEach((row) => {
            const line = Na__EntShell__El('div', 'na-veg-stats__row');
            line.appendChild(Na__EntShell__El('span', '', row[0]));
            line.appendChild(Na__EntShell__El('span', 'na-veg-stats__value', String(row[1])));
            el.appendChild(line);
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Stop What the Panel Was Doing
    // ------------------------------------------------------------
    function Na__EntLine__OnClose() {
        window.clearInterval(Na__EntLine__State.statsTimer);
        window.removeEventListener('na-entourage-object-replaced', Na__EntLine__ReadBack);
        Na__EntLine__State.statsEl  = null;
        Na__EntLine__State.controls = [];
    }
    // ------------------------------------------------------------


    // FUNCTION | Open the Panel, or Close It If It Is Open
    // ------------------------------------------------------------
    async function Na__EntLine__Toggle(context) {
        await Na__EntShell__Prepare(context);
        if (Na__EntShell__IsOpen(Na__EntLine__PANEL_ID)) {
            Na__EntShell__Close(Na__EntLine__PANEL_ID);
            return;
        }
        const panel = Na__EntShell__Open({ id : Na__EntLine__PANEL_ID, title : 'Entourage Linework', side : 'right', width : 268, onClose : Na__EntLine__OnClose });
        const rules = () => Na__EntRun__GetSceneData().Entourage__SceneData__LineRules;
        const advanced = () => rules().Entourage__LineRules__Advanced;

        panel.head.insertBefore(Na__EntShell__Button('Reset', '', Na__EntLine__Reset, 'Every slider back to the app\'s defaults'), panel.head.lastChild);

        Na__EntLine__SLIDERS.forEach((spec) => panel.body.appendChild(Na__EntLine__MakeSlider(spec, rules)));

        const details = Na__EntShell__El('details', 'na-veg-advanced');
        details.appendChild(Na__EntShell__El('summary', 'na-veg-advanced__title', 'Advanced'));
        Na__EntLine__ADVANCED.forEach((spec) => details.appendChild(Na__EntLine__MakeSlider(spec, advanced)));
        panel.body.appendChild(details);

        panel.body.appendChild(Na__EntShell__El('div', 'na-veg-panel__section', 'This view'));
        Na__EntLine__State.statsEl = Na__EntShell__El('div', 'na-veg-stats');
        panel.body.appendChild(Na__EntLine__State.statsEl);
        Na__EntLine__WriteStats();
        Na__EntLine__State.statsTimer = window.setInterval(Na__EntLine__WriteStats, Na__EntLine__STATS_MS);
        window.addEventListener('na-entourage-object-replaced', Na__EntLine__ReadBack);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Linework Panel API
    // ------------------------------------------------------------
    export {
        Na__EntLine__Toggle
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
