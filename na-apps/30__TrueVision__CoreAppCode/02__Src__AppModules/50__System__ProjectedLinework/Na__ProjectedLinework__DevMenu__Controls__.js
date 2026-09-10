// =============================================================================
// TRUEVISION3D - PROJECTED LINEWORK - DEV MENU CONTROLS
// =============================================================================
//
// FILE       : Na__ProjectedLinework__DevMenu__Controls__.js
// NAMESPACE  : Na__PlDev
// MODULE     : Projected Linework - Dev Menu Controls
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Localhost-only section for watching, forcing, baking and checking the projection
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - A Dev Tools section beside Floor Plans and Elevations: the overlay switch,
//   the backend, Force Render, Bake All to R2, Clear Cache and the Diff
//   harness, with the last render's timings and a per-drawing asset status
//   list (cached, stale, missing).
//
// - THE DIFF holds the shipping backend against the untouched vendored
//   generator on the drawing on screen with the cut and the hidden class
//   off, because those are the parts the vendored generator cannot do, and
//   reports every segment that moved. That is how a kernel change is
//   accepted: not by looking at the drawing and deciding it seems fine.
//
// INTEGRATION:
// - Initialized from index.html alongside the other localhost-only dev tools.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 50__System__ProjectedLinework/Na__ProjectedLinework__DevMenu__Controls__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 4.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Pipeline, Persistence, Views, Stage, Diff Harness
    // ------------------------------------------------------------
    import {
        Na__PlCfg__IsEnabled,
        Na__PlCfg__SetEnabled,
        Na__PlCfg__Set,
        Na__PlCfg__GetPerformanceSetup,
        Na__PlCfg__GetLabel
    } from './Na__ProjectedLinework__ConfigAccess__.js';
    import {
        Na__PlPipe__CHANGED_EVENT,
        Na__PlPipe__Evaluate,
        Na__PlPipe__ForceRender,
        Na__PlPipe__ClearCache,
        Na__PlPipe__GetStatus,
        Na__PlPipe__RenderDefinition
    } from './Na__ProjectedLinework__Pipeline__.js';
    import {
        Na__PlStore__AssetStatus,
        Na__PlStore__BakeAll
    } from './Na__ProjectedLinework__Persistence__.js';
    import {
        Na__PlView__FromActiveDrawing,
        Na__PlView__FromAllDrawings
    } from './Na__ProjectedLinework__ViewDefinition__.js';
    import { Na__PlStage__Describe } from './Na__ProjectedLinework__ModelStage__.js';
    import { Na__PlProjector__BuildOptions } from './Na__ProjectedLinework__Projector__.js';
    import {
        Na__ProjectedLinework__DiffHarness__Compare,
        Na__ProjectedLinework__DiffHarness__LogReport
    } from './Na__ProjectedLinework__DiffHarness__.js';
    import { Na__DrawData__CHANGED_EVENT } from '../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | DOM Identifiers
    // ------------------------------------------------------------
    const Na__PlDev__ITEM_ID   = 'naProjectedLineworkDevItem';
    const Na__PlDev__TOGGLE_ID = 'naProjectedLineworkDevToggle';
    const Na__PlDev__PANEL_ID  = 'naProjectedLineworkDevPanel';
    const Na__PlDev__BACKENDS  = [ 'cpu', 'webgpu', 'legacy' ];
    // ------------------------------------------------------------

    // MODULE VARIABLES | Host Context
    // ------------------------------------------------------------
    let Na__PlDev__Panel      = null;
    let Na__PlDev__ModelRoot  = null;
    let Na__PlDev__ShowToast  = null;
    let Na__PlDev__Busy       = false;
    let Na__PlDev__LastNote   = '';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Builders
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build a Dev Menu Button
    // ------------------------------------------------------------
    function Na__PlDev__Button(text, modifierClass, onClick) {
        const button = document.createElement('button');
        button.type        = 'button';
        button.className   = 'na-pm-dev__btn' + (modifierClass ? ' ' + modifierClass : '');
        button.textContent = text;
        button.disabled    = Na__PlDev__Busy;
        button.addEventListener('click', onClick);
        return button;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show a Toast if the Host Supplied One
    // ------------------------------------------------------------
    function Na__PlDev__Toast(message, isError) {
        if (typeof Na__PlDev__ShowToast === 'function') Na__PlDev__ShowToast(message, isError === true);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Status Line
    // ------------------------------------------------------------
    function Na__PlDev__BuildStatus() {
        const status = Na__PlPipe__GetStatus();
        const line   = document.createElement('p');
        line.className = 'na-fp-dev__empty na-pl-dev__status';

        if (!status.drawingId) {
            line.textContent = Na__PlCfg__GetLabel('StatusIdle', 'No drawing on screen.');
        } else if (status.isWorking) {
            line.textContent = Na__PlCfg__GetLabel('StatusWorking', 'Projecting...') + (status.phase ? (' ' + status.phase) : '') + ' (' + status.drawingName + ')';
        } else if (status.status === 'toolarge') {
            line.textContent = Na__PlCfg__GetLabel('TooManyTrianglesMessage', 'Model too large for exact linework on this device; the drawing shows the render alone.');
        } else if (status.cached) {
            line.textContent = Na__PlCfg__GetLabel('StatusReady', 'Linework ready.') + ' (' + status.drawingName + ')';
        } else {
            line.textContent = status.drawingName + ': ' + status.status;
        }
        return line;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Enabled Toggle and the Backend Select
    // ------------------------------------------------------------
    function Na__PlDev__BuildSettings() {
        const wrapper = document.createElement('div');
        wrapper.className = 'na-fp-dev__styles';

        const label = document.createElement('label');
        label.className = 'na-fp-dev__style';
        const check = document.createElement('input');
        check.type      = 'checkbox';
        check.className = 'na-pm-dev__checkbox';
        check.checked   = Na__PlCfg__IsEnabled();
        check.addEventListener('change', () => {
            Na__PlCfg__SetEnabled(check.checked);
            Na__PlPipe__Evaluate();
        });
        const text = document.createElement('span');
        text.textContent = Na__PlCfg__GetLabel('EnabledLabel', 'Overlay enabled');
        label.appendChild(check);
        label.appendChild(text);
        wrapper.appendChild(label);

        const row = document.createElement('div');
        row.className = 'na-dropdown-menu__panel-row';
        const caption = document.createElement('span');
        caption.className   = 'na-dropdown-menu__value';
        caption.textContent = Na__PlCfg__GetLabel('BackendLabel', 'Backend');
        const select = document.createElement('select');
        select.className = 'na-pm-dev__select';
        const current = Na__PlCfg__GetPerformanceSetup().backend;
        Na__PlDev__BACKENDS.forEach((name) => {
            const option = document.createElement('option');
            option.value = name; option.textContent = name; option.selected = (name === current);
            select.appendChild(option);
        });
        select.addEventListener('change', () => {
            Na__PlCfg__Set('Performance', 'Backend', select.value);
            Na__PlPipe__ClearCache();                                             // <-- Nothing rendered under the old backend survives
        });
        row.appendChild(caption);
        row.appendChild(select);
        wrapper.appendChild(row);
        return wrapper;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Timings Table From the Last Report
    // ------------------------------------------------------------
    function Na__PlDev__BuildTimings() {
        const report = Na__PlPipe__GetStatus().lastReport;
        const table  = document.createElement('table');
        table.className = 'na-pl-dev__timings';
        if (!report) return table;

        const rows = [
            [ 'Backend',      report.Backend ],
            [ 'Triangles',    String(report.TriangleTotal) + (report.CollectReused ? ' (model reused)' : '') ],
            [ 'Occluders',    String(report.OccluderCount) ],
            [ 'Edges',        String(report.EdgeCount) ],
            [ 'Cut lines',    String(report.IntersectionCount || 0) ],
            [ 'Segments',     String(report.SegmentCount) ],
            [ 'Project ms',   String(report.ProjectMs) ],
            [ 'Total ms',     String(report.TotalMs) ]
        ];
        (report.Phases || []).forEach((phase) => rows.push([ phase.Phase, phase.Ms + ' ms' ]));

        rows.forEach((pair) => {
            const tr = document.createElement('tr');
            const th = document.createElement('th'); th.textContent = pair[0];
            const td = document.createElement('td'); td.textContent = pair[1];
            tr.appendChild(th); tr.appendChild(td); table.appendChild(tr);
        });
        return table;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Per-Drawing Asset Status List
    // ------------------------------------------------------------
    function Na__PlDev__BuildAssets() {
        const list  = document.createElement('div');
        list.className = 'na-pl-dev__assets';
        const model = Na__PlStage__Describe(Na__PlDev__ModelRoot).Fingerprint;

        Na__PlView__FromAllDrawings().forEach((definition) => {
            const row  = document.createElement('div');
            row.className = 'na-pl-dev__asset';
            const name = document.createElement('span');
            name.textContent = definition.DrawingName + ' (' + definition.Kind + ')';
            const status = Na__PlStore__AssetStatus(definition, model);
            const badge  = document.createElement('span');
            badge.className   = 'na-pl-dev__badge na-pl-dev__badge--' + status;
            badge.textContent = Na__PlCfg__GetLabel(status === 'cached' ? 'StatusCached' : status === 'stale' ? 'StatusStale' : 'StatusMissing', status);
            row.appendChild(name);
            row.appendChild(badge);
            list.appendChild(row);
        });
        return list;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Actions
// -----------------------------------------------------------------------------

    // FUNCTION | Bake Every Drawing to R2
    // ------------------------------------------------------------
    async function Na__PlDev__Bake(force) {
        if (Na__PlDev__Busy) return;
        Na__PlDev__Busy = true;
        Na__PlDev__Render();
        try {
            const counts = await Na__PlStore__BakeAll({
                showToast  : Na__PlDev__ShowToast,
                force      : force === true,
                onProgress : (progress) => { Na__PlDev__LastNote = 'Baking ' + progress.index + ' of ' + progress.total + ': ' + progress.name; Na__PlDev__Render(); }
            });
            Na__PlDev__LastNote = 'Baked ' + counts.baked + ', skipped ' + counts.skipped + ', refused ' + counts.refused + ', failed ' + counts.failed + '.';
            Na__PlDev__Toast(Na__PlDev__LastNote, counts.failed > 0);
        } finally {
            Na__PlDev__Busy = false;
            Na__PlDev__Render();
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Hold the CPU Backend Against the Vendored Generator
    // ------------------------------------------------------------
    async function Na__PlDev__Diff() {
        if (Na__PlDev__Busy) return;
        const definition = Na__PlView__FromActiveDrawing();
        if (!definition) { Na__PlDev__Toast('Preview a drawing first, then run the Diff.', true); return; }

        Na__PlDev__Busy = true;
        Na__PlDev__LastNote = 'Running Diff...';
        Na__PlDev__Render();

        try {
            const plain = Object.assign({}, definition, { Cut : null, Styles : Object.assign({}, definition.Styles, { hiddenLines : false }) });
            plain.RecordHash = definition.RecordHash + ':diff';

            const runs = {};
            for (const backend of [ 'cpu', 'legacy' ]) {
                const options   = Na__PlProjector__BuildOptions(plain, backend);
                const startedAt = performance.now();
                const result    = await Na__PlPipe__RenderDefinition(plain, options, null, null);
                runs[backend]   = { Segments : result.Classes.visible, Ms : Math.round(performance.now() - startedAt) };
            }

            const report = Na__ProjectedLinework__DiffHarness__Compare('cpu:' + definition.ViewKey, runs.cpu.Segments, 'legacy:' + definition.ViewKey, runs.legacy.Segments, {});
            Na__ProjectedLinework__DiffHarness__LogReport(report);
            Na__PlDev__LastNote = 'Diff: cpu ' + runs.cpu.Ms + ' ms, legacy ' + runs.legacy.Ms + ' ms. See the console table.';
        } catch (diffError) {
            console.error('[TrueVision3D ProjectedLinework] Diff failed:', diffError);
            Na__PlDev__LastNote = 'Diff failed - see console.';
        } finally {
            Na__PlDev__Busy = false;
            Na__PlDev__Render();
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Panel Render and Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Rebuild the Whole Panel
    // ------------------------------------------------------------
    function Na__PlDev__Render() {
        if (!Na__PlDev__Panel) return;
        Na__PlDev__Panel.innerHTML = '';

        const title = document.createElement('div');
        title.className   = 'na-dropdown-menu__panel-title';
        title.textContent = Na__PlCfg__GetLabel('SectionTitle', 'Projected Linework');
        Na__PlDev__Panel.appendChild(title);

        Na__PlDev__Panel.appendChild(Na__PlDev__BuildStatus());
        Na__PlDev__Panel.appendChild(Na__PlDev__BuildSettings());

        const actions = document.createElement('div');
        actions.className = 'na-pm-dev__actions';
        actions.appendChild(Na__PlDev__Button(Na__PlCfg__GetLabel('ForceRenderLabel', 'Force Render'), 'na-pm-dev__btn--primary', () => { void Na__PlPipe__ForceRender(); }));
        actions.appendChild(Na__PlDev__Button(Na__PlCfg__GetLabel('BakeLabel', 'Bake All to R2'), '', () => { void Na__PlDev__Bake(false); }));
        actions.appendChild(Na__PlDev__Button(Na__PlCfg__GetLabel('ClearCacheLabel', 'Clear Cache'), '', () => Na__PlPipe__ClearCache()));
        actions.appendChild(Na__PlDev__Button(Na__PlCfg__GetLabel('DiffLabel', 'Run Diff (cpu vs legacy)'), '', () => { void Na__PlDev__Diff(); }));
        Na__PlDev__Panel.appendChild(actions);

        if (Na__PlDev__LastNote) {
            const note = document.createElement('p');
            note.className   = 'na-fp-dev__empty';
            note.textContent = Na__PlDev__LastNote;
            Na__PlDev__Panel.appendChild(note);
        }

        Na__PlDev__Panel.appendChild(Na__PlDev__BuildTimings());
        Na__PlDev__Panel.appendChild(Na__PlDev__BuildAssets());
    }
    // ------------------------------------------------------------


    // FUNCTION | Initialize the Localhost-Only Projected Linework Section
    // ------------------------------------------------------------
    // context: { modelRoot, showToast }
    // ------------------------------------------------------------
    function Na__ProjectedLinework__DevMenu__Initialize(context) {
        const menuItem = document.getElementById(Na__PlDev__ITEM_ID);
        const toggle   = document.getElementById(Na__PlDev__TOGGLE_ID);
        const panel    = document.getElementById(Na__PlDev__PANEL_ID);
        if (!menuItem || !toggle || !panel) return false;

        Na__PlDev__Panel     = panel;
        Na__PlDev__ModelRoot = (context && context.modelRoot) || null;
        Na__PlDev__ShowToast = (context && context.showToast) || null;

        menuItem.style.display = '';

        toggle.addEventListener('click', () => {
            const isOpen = panel.classList.contains('is-open');
            panel.classList.toggle('is-open', !isOpen);
            toggle.setAttribute('aria-expanded', String(!isOpen));
            if (!isOpen) Na__PlDev__Render();
        });

        const refresh = () => { if (panel.classList.contains('is-open')) Na__PlDev__Render(); };
        window.addEventListener(Na__PlPipe__CHANGED_EVENT, refresh);
        window.addEventListener(Na__DrawData__CHANGED_EVENT, refresh);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Projected Linework Dev Menu API
    // ------------------------------------------------------------
    export {
        Na__ProjectedLinework__DevMenu__Initialize
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
