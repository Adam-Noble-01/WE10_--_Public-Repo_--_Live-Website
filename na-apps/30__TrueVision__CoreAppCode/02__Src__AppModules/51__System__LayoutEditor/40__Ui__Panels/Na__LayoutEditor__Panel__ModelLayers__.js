// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PANEL: MODEL LAYERS
// =============================================================================
//
// FILE       : Na__LayoutEditor__Panel__ModelLayers__.js
// NAMESPACE  : Na__LePanelModelLayers
// MODULE     : Layout Editor - Panel Model Layers
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Switch model categories off, and restyle their projected linework, in one viewport without touching any other
// CREATED    : 12-Sep-2026
//
// DESCRIPTION:
// - One checkbox per model category the project actually loaded, grouped and
//   named by Na__LayoutEditor__ModelLayers__Config__.json, which pairs the
//   Noble Architecture SketchUp tag names from the SSOT with short labels.
// - The setting belongs to the selected viewport alone, so the same elevation
//   can appear twice on one sheet - once furnished for the client, once bare
//   for the builder - and the 3D model tab is left exactly as the user left it.
// - Switching a category off removes it from the viewport's rendered picture
//   AND from its projected vector linework, because a drawing that still has
//   the sofa outlined in it has not had the sofa switched off.
// - An Advanced fold under the title reveals, inline in every row between the
//   name and the checkbox, that category's edge colour, line type and weight.
//   These style the 2D PROJECTED LINEWORK only. Folded, the panel is exactly the
//   panel it was: this is meant to be rarely opened, because every new viewport
//   already draws at the config defaults.
//
// INTEGRATION:
// - Registered into the left column by the mode controller, under Render
//   Composites. Render Composites decides how the picture is drawn; this
//   decides what is in it and how each part of it is inked.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : n/a - authored in TrueVision3D
// - Back-port     : done - ValeVision3D v2.30.0 (13-Sep-2026), verbatim below the header.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 14-Sep-2026 - Version 1.3.0
// - A site plan viewport's rows are its site plan layers. The list rebuilds when
//   the site plan data arrives, and says so while there is none.
//
// 13-Sep-2026 - Version 1.2.0
// - The rows are the categories of the selected viewport's own design phase,
//   which on a viewport of the existing building are not the proposal's.
//
// 12-Sep-2026 - Version 1.1.0
// - Advanced fold: per-category edge colour, line type and weight inline in
//   each row, a reset per row, and a reset for the whole viewport. Only shown
//   for a 2D viewport, which is the only kind with projected linework to style.
//
// 12-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, the Layer Map, Edge Styles and the Panel Host
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__KIND_2D, Na__LeModel__GetActiveSheet, Na__LeModel__GetSelectedViewport, Na__LeModel__UpdateViewport } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeModelLayers__Ready, Na__LeModelLayers__Groups, Na__LeModelLayers__IsOn } from '../25__System__RenderStyles/Na__LayoutEditor__ModelLayers__.js';
    import { Na__LeSource__CategoryKeys } from '../20__System__Viewports/Na__LayoutEditor__ModelSource__.js';
    import { Na__SpStore__CHANGED_EVENT } from '../../52__System__SitePlanData/Na__SitePlan__Store__.js';
    import {
        Na__LeEdge__FIELD,
        Na__LeEdge__CAT_FIELD,
        Na__LeEdge__Ready,
        Na__LeEdge__IsLoaded,
        Na__LeEdge__Colours,
        Na__LeEdge__LineTypes,
        Na__LeEdge__WeightBounds,
        Na__LeEdge__Effective,
        Na__LeEdge__Patch,
        Na__LeEdge__ResetPatch,
        Na__LeEdge__OverrideCount
    } from '../25__System__RenderStyles/Na__LayoutEditor__EdgeStyles__.js';
    import {
        Na__LePanels__RegisterSection,
        Na__LePanels__OnControl,
        Na__LePanels__Refresh,
        Na__LePanels__IsEditable,
        Na__LePanels__Row,
        Na__LePanels__Input,
        Na__LePanels__Select,
        Na__LePanels__Button,
        Na__LePanels__Note,
        Na__LePanels__AdvancedToggle,
        Na__LePanels__IsAdvanced
    } from './Na__LayoutEditor__PanelHost__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Section Id
    // ------------------------------------------------------------
    const Na__LePanelModelLayers__ID = 'modellayers';
    // ------------------------------------------------------------

    // MODULE VARIABLES | What the Rows Were Last Built From
    // ------------------------------------------------------------
    // The rows are rebuilt only when the model's inventory or the palette
    // changes, not on every refresh: a refresh runs on every model change and
    // rebuilding thirty rows each time would throw away the control the pointer
    // is on - which, with a dropdown open, closes it under the cursor.
    // ------------------------------------------------------------
    let Na__LePanelModelLayers__BuiltKey = null;
    let Na__LePanelModelLayers__IdSeed   = 0;
    const Na__LePanelModelLayers__Labels = new Map();   // <-- categoryKey -> label, for the record's human-readable name
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Rows
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Shell: Advanced Fold, a Note, the Bulk Buttons and an Empty List
    // ------------------------------------------------------------
    function Na__LePanelModelLayers__Build(body) {
        Na__LePanels__AdvancedToggle(body, Na__LePanelModelLayers__ID, Na__LeCfg__GetLabel('AdvancedToggle', 'Advanced'));

        const note = Na__LePanels__Note(Na__LeCfg__GetLabel('NoSelection', 'Select a viewport on the sheet.'));
        note.setAttribute('data-na-block', 'note');
        body.appendChild(note);

        const bulk = document.createElement('div');
        bulk.className = 'na-le-row na-le-row--buttons';
        bulk.setAttribute('data-na-block', 'bulk');
        bulk.appendChild(Na__LePanels__Button(Na__LeCfg__GetLabel('ModelLayersAllOn',  'All On'),  'model-layer-bulk', 'na-le-btn--icon', 'on'));
        bulk.appendChild(Na__LePanels__Button(Na__LeCfg__GetLabel('ModelLayersAllOff', 'All Off'), 'model-layer-bulk', 'na-le-btn--icon', 'off'));
        const resetAll = Na__LePanels__Button(Na__LeCfg__GetLabel('EdgeStylesResetAll', 'Reset Styles'), 'edge-reset-all', 'na-le-btn--icon na-le-adv');
        resetAll.title = Na__LeCfg__GetLabel('EdgeStylesResetAllHint', 'Put every category in this viewport back to the config defaults');
        bulk.appendChild(resetAll);
        body.appendChild(bulk);

        const list = document.createElement('div');
        list.setAttribute('data-na-block', 'list');
        body.appendChild(list);

        // THE TWO CONFIGS ARRIVE LATE AND THAT IS FINE. Without the layer map the
        // rows build under generated labels; without the palette the dropdowns
        // hold the built-in greys. Either landing asks for a rebuild.
        const rebuild = () => { Na__LePanelModelLayers__BuiltKey = null; Na__LePanels__Refresh(Na__LePanelModelLayers__ID); };
        Na__LeModelLayers__Ready().then(rebuild);
        Na__LeEdge__Ready().then(rebuild);
        window.addEventListener(Na__SpStore__CHANGED_EVENT, (event) => { if (!event.detail || event.detail.reason !== 'layer-loaded') rebuild(); });   // <-- Site plan layers arrive with their data
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Column Headings Over the Inline Cluster
    // ------------------------------------------------------------
    // Once above the list rather than repeated per row: thirty rows each saying
    // "Colour" is noise, and the headings line up with the controls below.
    // ------------------------------------------------------------
    function Na__LePanelModelLayers__Head() {
        const head = document.createElement('div');
        head.className = 'na-le-adv na-le-adv-head';
        head.setAttribute('data-na-block', 'edge-head');
        const cells = [
            [ 'na-le-adv-head__spacer', '' ],
            [ 'na-le-adv-head__cell', Na__LeCfg__GetLabel('EdgeColourHead', 'Colour'), '108px' ],
            [ 'na-le-adv-head__cell', Na__LeCfg__GetLabel('EdgeTypeHead',   'Type'),    '82px' ],
            [ 'na-le-adv-head__cell', Na__LeCfg__GetLabel('EdgeWeightHead', 'Weight'),  '74px' ],
            [ 'na-le-adv-head__cell', '', '16px' ]
        ];
        cells.forEach((cell) => {
            const span = document.createElement('span');
            span.className   = cell[0];
            span.textContent = cell[1];
            if (cell[2]) span.style.width = cell[2];
            head.appendChild(span);
        });
        return head;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Inline Colour, Type and Weight Controls for One Category
    // ------------------------------------------------------------
    function Na__LePanelModelLayers__EdgeCluster(layerKey) {
        const cluster = document.createElement('span');
        cluster.className = 'na-le-row__adv na-le-adv';

        const swatch = document.createElement('span');
        swatch.className = 'na-le-adv-swatch';
        cluster.appendChild(swatch);

        const colour = Na__LePanels__Select('edge-colour', Na__LeEdge__Colours().map((c) => ({ value : c.alias, label : c.label })), null);
        colour.classList.add('na-le-adv-colour');
        colour.setAttribute('data-na-role', layerKey);
        cluster.appendChild(colour);

        const type = Na__LePanels__Select('edge-type', Na__LeEdge__LineTypes().map((t) => ({ value : t.alias, label : t.label })), null);
        type.classList.add('na-le-adv-type');
        type.setAttribute('data-na-role', layerKey);
        cluster.appendChild(type);

        const bounds = Na__LeEdge__WeightBounds();
        const weight = Na__LePanels__Input('number', 'edge-weight', { min : bounds.min, max : bounds.max, step : bounds.step });
        weight.classList.add('na-le-adv-weight');
        weight.setAttribute('data-na-role', layerKey);
        weight.title = Na__LeCfg__GetLabel('EdgeWeightHint', 'Multiplier on the sheet viewport lineweight: 1.00 is the master, 0.50 is half');
        cluster.appendChild(weight);

        const reset = Na__LePanels__Button('↺', 'edge-reset', 'na-le-adv-reset', layerKey);
        reset.title = Na__LeCfg__GetLabel('ResetToDefault', 'Back to the config default');
        cluster.appendChild(reset);

        return cluster;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Rebuild the Grouped Checkbox Rows
    // ------------------------------------------------------------
    function Na__LePanelModelLayers__Fill(list, groups) {
        list.innerHTML = '';
        Na__LePanelModelLayers__Labels.clear();
        list.appendChild(Na__LePanelModelLayers__Head());

        groups.forEach((group) => {
            if (group.label) {
                const heading = document.createElement('p');
                heading.className   = 'na-le-note na-le-note--heading';
                heading.textContent = group.label;
                list.appendChild(heading);
            }
            group.layers.forEach((layer) => {
                Na__LePanelModelLayers__Labels.set(layer.key, layer.label);

                const input = Na__LePanels__Input('checkbox', 'model-layer-toggle');
                input.setAttribute('data-na-role', layer.key);
                input.id = 'na-le-ml-' + (++Na__LePanelModelLayers__IdSeed);

                const row = Na__LePanels__Row(layer.label, input, 'na-le-row--toggle');
                // THE LABEL NAMES ITS CHECKBOX EXPLICITLY. With three controls
                // now sitting between the name and the checkbox, an implicit
                // label would adopt the FIRST of them - so clicking "Walls" would
                // open the colour dropdown instead of switching the walls off.
                row.htmlFor = input.id;
                row.setAttribute('data-na-model-layer', layer.key);
                row.title = layer.tags && layer.tags.length ? layer.tags.join(', ') : layer.key;   // <-- The SSOT tag name is one hover away
                row.insertBefore(Na__LePanelModelLayers__EdgeCluster(layer.key), input);
                list.appendChild(row);
            });
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect One Row's Edge Style
    // ------------------------------------------------------------
    function Na__LePanelModelLayers__ReflectEdge(row, viewport, layerKey) {
        const effective = Na__LeEdge__Effective(viewport, layerKey);
        const set = (name, value) => {
            const el = row.querySelector('[data-na-control="' + name + '"]');
            if (el && document.activeElement !== el) el.value = value;
        };
        set('edge-colour', effective.colour);
        set('edge-type',   effective.lineType);
        set('edge-weight', effective.weight.toFixed(Na__LeEdge__WeightBounds().decimals));
        const swatch = row.querySelector('.na-le-adv-swatch');
        if (swatch) swatch.style.background = effective.hex;
        row.classList.toggle('is-overridden', effective.overridden);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect the Selected Viewport
    // ------------------------------------------------------------
    function Na__LePanelModelLayers__Refresh(body) {
        const viewport = Na__LeModel__GetSelectedViewport();
        const groups   = Na__LeModelLayers__Groups(Na__LeSource__CategoryKeys(viewport));   // <-- The selected viewport's design phase; null keeps the live model's
        const list     = body.querySelector('[data-na-block="list"]');
        const note     = body.querySelector('[data-na-block="note"]');
        const bulk     = body.querySelector('[data-na-block="bulk"]');

        if (groups.length === 0) {
            note.textContent = (viewport && viewport.Viewport__SitePlan) ? Na__LeCfg__GetLabel('SitePlanNoLayers', 'No site plan layers loaded yet.') : Na__LeCfg__GetLabel('ModelLayersNoModel', 'No model categories loaded.');
            note.hidden = false;
            bulk.hidden = true;
            list.innerHTML = '';
            Na__LePanelModelLayers__BuiltKey = null;
            return;
        }

        note.textContent = Na__LeCfg__GetLabel('NoSelection', 'Select a viewport on the sheet.');
        note.hidden = !!viewport;
        bulk.hidden = !viewport || !Na__LePanels__IsEditable();

        const key = (Na__LeEdge__IsLoaded() ? 'p1' : 'p0') + '#' +
                    groups.map((g) => g.id + ':' + g.layers.map((l) => l.key).join(',')).join('|');
        if (key !== Na__LePanelModelLayers__BuiltKey) {
            Na__LePanelModelLayers__Fill(list, groups);
            Na__LePanelModelLayers__BuiltKey = key;
        }

        list.hidden = !viewport;
        if (!viewport) return;

        // EDGE STYLES ONLY MEAN SOMETHING ON A DRAWING. A 3D viewport has no
        // projected linework, so its rows show the checkbox alone even with the
        // fold open, rather than offering controls that would change nothing.
        const edgesApply = viewport.Viewport__Kind === Na__LeModel__KIND_2D;
        const showEdges  = edgesApply && Na__LePanels__IsAdvanced(Na__LePanelModelLayers__ID);
        list.classList.toggle('na-le-list--no-edges', !edgesApply);
        const resetAll = bulk.querySelector('[data-na-control="edge-reset-all"]');
        if (resetAll) {
            resetAll.hidden   = !edgesApply;
            resetAll.disabled = Na__LeEdge__OverrideCount(viewport) === 0;
        }

        groups.forEach((group) => group.layers.forEach((layer) => {
            const row = list.querySelector('[data-na-model-layer="' + CSS.escape(layer.key) + '"]');
            if (!row) return;
            row.querySelector('[data-na-control="model-layer-toggle"]').checked = Na__LeModelLayers__IsOn(viewport, layer.key);
            if (showEdges) Na__LePanelModelLayers__ReflectEdge(row, viewport, layer.key);
            else row.classList.remove('is-overridden');
        }));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Registration
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Write a Visibility Patch to the Selected Viewport
    // ------------------------------------------------------------
    function Na__LePanelModelLayers__Apply(patch) {
        const sheet    = Na__LeModel__GetActiveSheet();
        const viewport = Na__LeModel__GetSelectedViewport();
        if (!sheet || !viewport) return;
        Na__LeModel__UpdateViewport(sheet, viewport.Viewport__Id, { modelLayers : patch });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write an Edge Style Patch to the Selected Viewport
    // ------------------------------------------------------------
    // part is 'colour' | 'lineType' | 'weight', or 'reset' to clear the category.
    // ------------------------------------------------------------
    function Na__LePanelModelLayers__ApplyEdge(layerKey, part, value) {
        const sheet    = Na__LeModel__GetActiveSheet();
        const viewport = Na__LeModel__GetSelectedViewport();
        if (!sheet || !viewport || !layerKey) return;
        const patch = part === 'reset'
            ? Na__LeEdge__ResetPatch(layerKey)
            : Na__LeEdge__Patch(viewport, layerKey, Na__LePanelModelLayers__Labels.get(layerKey), part, value);
        Na__LeModel__UpdateViewport(sheet, viewport.Viewport__Id, { projectedEdges : patch });
    }
    // ------------------------------------------------------------


    // FUNCTION | Register the Section and Its Controls
    // ------------------------------------------------------------
    function Na__LePanelModelLayers__Register() {
        Na__LePanels__OnControl('change', 'model-layer-toggle', (e, el, key) => {
            const patch = {};
            patch[key]  = el.checked;
            Na__LePanelModelLayers__Apply(patch);
        });
        Na__LePanels__OnControl('click', 'model-layer-bulk', (e, el, role) => {
            const on    = role === 'on';
            const patch = {};
            Na__LeModelLayers__Groups(Na__LeSource__CategoryKeys(Na__LeModel__GetSelectedViewport())).forEach((group) => group.layers.forEach((layer) => { patch[layer.key] = on; }));
            Na__LePanelModelLayers__Apply(patch);
        });

        Na__LePanels__OnControl('change', 'edge-colour', (e, el, key) => Na__LePanelModelLayers__ApplyEdge(key, 'colour', el.value));
        Na__LePanels__OnControl('change', 'edge-type',   (e, el, key) => Na__LePanelModelLayers__ApplyEdge(key, 'lineType', el.value));
        Na__LePanels__OnControl('change', 'edge-weight', (e, el, key) => {
            if (Number.isFinite(parseFloat(el.value))) Na__LePanelModelLayers__ApplyEdge(key, 'weight', el.value);
        });
        Na__LePanels__OnControl('click', 'edge-reset', (e, el, key) => {
            e.preventDefault();                                                   // <-- Inside a label: do not let the click reach the checkbox
            Na__LePanelModelLayers__ApplyEdge(key, 'reset', null);
        });
        Na__LePanels__OnControl('click', 'edge-reset-all', () => {
            const sheet    = Na__LeModel__GetActiveSheet();
            const viewport = Na__LeModel__GetSelectedViewport();
            if (!sheet || !viewport) return;
            const held  = viewport[Na__LeEdge__FIELD];
            const map   = held ? held[Na__LeEdge__CAT_FIELD] : null;
            if (!map) return;
            const patch = {};
            Object.keys(map).forEach((key) => { patch[key] = null; });
            Na__LeModel__UpdateViewport(sheet, viewport.Viewport__Id, { projectedEdges : patch });
        });

        return Na__LePanels__RegisterSection('left', {
            id : Na__LePanelModelLayers__ID, title : Na__LeCfg__GetLabel('ModelLayersTitle', 'Model Layers'),
            build : Na__LePanelModelLayers__Build, refresh : Na__LePanelModelLayers__Refresh,
            defaultOpen : false                                                   // <-- Thirty rows: folded until wanted
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Model Layers Panel API
    // ------------------------------------------------------------
    export {
        Na__LePanelModelLayers__Register
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
