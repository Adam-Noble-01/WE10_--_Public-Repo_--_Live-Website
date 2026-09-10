// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PANEL: LAYERS
// =============================================================================
//
// FILE       : Na__LayoutEditor__Panel__Layers__.js
// NAMESPACE  : Na__LePanelLayers
// MODULE     : Layout Editor - Panel Layers
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The left panel: layer rows with eye, lock, name, type, order, add, delete and a type filter
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - One row per layer, top of the list drawing frontmost (D31). Eye and
//   lock toggle, double-click renames, the type select re-tags (a tag is
//   a filter aid, any layer holds anything), the arrows and HTML drag and
//   drop reorder. Add creates a layer of the filtered type; Delete removes
//   the layer and re-homes its items to the default layer of their kind.
//
// INTEGRATION:
// - Registered into the panel host by the mode controller.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__Panel__Layers__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.0.1
// - Vectors layer type.
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 5.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model and Panel Host
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel } from './Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__LAYER_TYPES,
        Na__LeModel__GetActiveSheet,
        Na__LeModel__GetLayers,
        Na__LeModel__CreateLayer,
        Na__LeModel__DeleteLayer,
        Na__LeModel__UpdateLayer,
        Na__LeModel__ReorderLayer
    } from './Na__LayoutEditor__SheetModel__.js';
    import {
        Na__LePanels__RegisterSection,
        Na__LePanels__OnControl,
        Na__LePanels__IsEditable,
        Na__LePanels__Button,
        Na__LePanels__Select,
        Na__LePanels__Note
    } from './Na__LayoutEditor__PanelHost__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Section Id and Type Labels
    // ------------------------------------------------------------
    const Na__LePanelLayers__ID = 'layers';
    const Na__LePanelLayers__TYPE_LABELS = { viewport : 'Viewports', annotation : 'Annotations', dimension : 'Dimensions', vector : 'Vectors', mixed : 'General' };
    // ------------------------------------------------------------

    // MODULE VARIABLES | Filter and Drag State
    // ------------------------------------------------------------
    let Na__LePanelLayers__Filter = 'all';
    let Na__LePanelLayers__DragId = null;
    let Na__LePanelLayers__List   = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Rows
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Type Options for a Select
    // ------------------------------------------------------------
    function Na__LePanelLayers__TypeOptions(includeAll) {
        const list = Na__LeModel__LAYER_TYPES.map((t) => ({ value : t, label : Na__LePanelLayers__TYPE_LABELS[t] || t }));
        return includeAll ? [ { value : 'all', label : Na__LeCfg__GetLabel('LayerFilterAll', 'All layers') } ].concat(list) : list;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build One Layer Row
    // ------------------------------------------------------------
    function Na__LePanelLayers__Row(sheet, layer, index, count) {
        const editable = Na__LePanels__IsEditable();
        const row = document.createElement('div');
        row.className = 'na-le-layer' + (layer.Layer__Visible === false ? ' na-le-layer--hidden' : '') + (layer.Layer__Locked ? ' na-le-layer--locked' : '');
        row.setAttribute('data-na-layer-id', layer.Layer__Id);
        row.draggable = editable;

        const eye = Na__LePanels__Button(layer.Layer__Visible === false ? 'Off' : 'On', 'layer-eye', 'na-le-btn--icon', layer.Layer__Id);
        eye.title = 'Show or hide';
        const lock = Na__LePanels__Button(layer.Layer__Locked ? 'Locked' : 'Open', 'layer-lock', 'na-le-btn--icon', layer.Layer__Id);
        lock.title = 'Lock or unlock';

        const name = document.createElement('span');
        name.className   = 'na-le-layer__name';
        name.textContent = layer.Layer__Name;
        name.title       = editable ? 'Double-click to rename' : layer.Layer__Name;
        name.setAttribute('data-na-control', 'layer-name');
        name.setAttribute('data-na-role', layer.Layer__Id);

        const type = Na__LePanels__Select('layer-type', Na__LePanelLayers__TypeOptions(false), layer.Layer__Type);
        type.setAttribute('data-na-role', layer.Layer__Id);
        type.classList.add('na-le-select--compact');

        const up   = Na__LePanels__Button('Up', 'layer-up', 'na-le-btn--icon', layer.Layer__Id);
        const down = Na__LePanels__Button('Down', 'layer-down', 'na-le-btn--icon', layer.Layer__Id);
        up.disabled   = !editable || index === 0;
        down.disabled = !editable || index === count - 1;
        [ eye, lock ].forEach((b) => { b.disabled = !editable; });

        row.appendChild(eye);
        row.appendChild(lock);
        row.appendChild(name);
        row.appendChild(type);
        row.appendChild(up);
        row.appendChild(down);

        if (editable) {
            row.addEventListener('dragstart', (e) => { Na__LePanelLayers__DragId = layer.Layer__Id; e.dataTransfer.effectAllowed = 'move'; row.classList.add('is-dragging'); });
            row.addEventListener('dragend', () => { Na__LePanelLayers__DragId = null; row.classList.remove('is-dragging'); });
            row.addEventListener('dragover', (e) => { if (Na__LePanelLayers__DragId && Na__LePanelLayers__DragId !== layer.Layer__Id) { e.preventDefault(); row.classList.add('is-drop-target'); } });
            row.addEventListener('dragleave', () => row.classList.remove('is-drop-target'));
            row.addEventListener('drop', (e) => {
                e.preventDefault();
                row.classList.remove('is-drop-target');
                if (!Na__LePanelLayers__DragId || Na__LePanelLayers__DragId === layer.Layer__Id) return;
                const target = Na__LeModel__GetLayers(sheet).findIndex((l) => l.Layer__Id === layer.Layer__Id);
                Na__LeModel__ReorderLayer(sheet, Na__LePanelLayers__DragId, target);
            });
        }
        return row;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Section
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the Static Parts
    // ------------------------------------------------------------
    function Na__LePanelLayers__Build(body) {
        const bar = document.createElement('div');
        bar.className = 'na-le-bar';
        bar.appendChild(Na__LePanels__Select('layer-filter', Na__LePanelLayers__TypeOptions(true), Na__LePanelLayers__Filter));
        bar.querySelector('select').disabled = false;                             // <-- Filtering is fine when read-only
        if (Na__LePanels__IsEditable()) bar.appendChild(Na__LePanels__Button(Na__LeCfg__GetLabel('AddLayer', 'Add'), 'layer-add', 'na-le-btn--primary'));
        body.appendChild(bar);
        Na__LePanelLayers__List = document.createElement('div');
        Na__LePanelLayers__List.className = 'na-le-layers';
        body.appendChild(Na__LePanelLayers__List);
        if (Na__LePanels__IsEditable()) {
            const foot = document.createElement('div');
            foot.className = 'na-le-bar';
            foot.appendChild(Na__LePanels__Button(Na__LeCfg__GetLabel('DeleteLayer', 'Delete selected type'), 'layer-delete', 'na-le-btn--danger'));
            body.appendChild(foot);
        }
        body.appendChild(Na__LePanels__Note(Na__LeCfg__GetLabel('LayersNote', 'Top of the list draws frontmost. Types are tags for filtering; any layer can hold anything.')));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Rebuild the Rows
    // ------------------------------------------------------------
    function Na__LePanelLayers__Refresh() {
        const list  = Na__LePanelLayers__List;
        const sheet = Na__LeModel__GetActiveSheet();
        if (!list) return;
        list.innerHTML = '';
        if (!sheet) return;
        const layers = Na__LeModel__GetLayers(sheet).filter((l) => Na__LePanelLayers__Filter === 'all' || l.Layer__Type === Na__LePanelLayers__Filter);
        const all    = Na__LeModel__GetLayers(sheet);
        layers.forEach((layer) => list.appendChild(Na__LePanelLayers__Row(sheet, layer, all.indexOf(layer), all.length)));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Inline Rename on Double Click
    // ------------------------------------------------------------
    function Na__LePanelLayers__Rename(el, layerId) {
        const sheet = Na__LeModel__GetActiveSheet();
        if (!sheet || !Na__LePanels__IsEditable()) return;
        const input = document.createElement('input');
        input.type      = 'text';
        input.className = 'na-le-input na-le-input--inline';
        input.value     = el.textContent;
        const commit = () => { const v = input.value.trim(); if (v) Na__LeModel__UpdateLayer(sheet, layerId, { name : v }); else Na__LePanelLayers__Refresh(); };
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } if (e.key === 'Escape') { input.value = el.textContent; input.blur(); } e.stopPropagation(); });
        input.addEventListener('blur', commit);
        el.replaceWith(input);
        input.focus(); input.select();
    }
    // ------------------------------------------------------------


    // FUNCTION | Register the Section and Its Controls
    // ------------------------------------------------------------
    function Na__LePanelLayers__Register() {
        Na__LePanels__OnControl('change', 'layer-filter', (e, el) => { Na__LePanelLayers__Filter = el.value; Na__LePanelLayers__Refresh(); });
        Na__LePanels__OnControl('click', 'layer-add', () => {
            const sheet = Na__LeModel__GetActiveSheet();
            if (!sheet) return;
            const type = Na__LePanelLayers__Filter === 'all' ? 'mixed' : Na__LePanelLayers__Filter;
            Na__LeModel__CreateLayer(sheet, { name : (Na__LePanelLayers__TYPE_LABELS[type] || 'Layer') + ' ' + (sheet.Sheet__Layers.length + 1), type : type });
        });
        Na__LePanels__OnControl('click', 'layer-delete', () => {
            const sheet = Na__LeModel__GetActiveSheet();
            if (!sheet) return;
            const layers = Na__LeModel__GetLayers(sheet).filter((l) => Na__LePanelLayers__Filter === 'all' || l.Layer__Type === Na__LePanelLayers__Filter);
            const last = layers[layers.length - 1];
            if (last) Na__LeModel__DeleteLayer(sheet, last.Layer__Id);
        });
        Na__LePanels__OnControl('click', 'layer-eye',  (e, el, id) => { const s = Na__LeModel__GetActiveSheet(); const l = s && s.Sheet__Layers.find((x) => x.Layer__Id === id); if (l) Na__LeModel__UpdateLayer(s, id, { visible : l.Layer__Visible === false }); });
        Na__LePanels__OnControl('click', 'layer-lock', (e, el, id) => { const s = Na__LeModel__GetActiveSheet(); const l = s && s.Sheet__Layers.find((x) => x.Layer__Id === id); if (l) Na__LeModel__UpdateLayer(s, id, { locked : !l.Layer__Locked }); });
        Na__LePanels__OnControl('click', 'layer-up',   (e, el, id) => { const s = Na__LeModel__GetActiveSheet(); if (!s) return; const i = Na__LeModel__GetLayers(s).findIndex((x) => x.Layer__Id === id); if (i > 0) Na__LeModel__ReorderLayer(s, id, i - 1); });
        Na__LePanels__OnControl('click', 'layer-down', (e, el, id) => { const s = Na__LeModel__GetActiveSheet(); if (!s) return; const i = Na__LeModel__GetLayers(s).findIndex((x) => x.Layer__Id === id); if (i >= 0) Na__LeModel__ReorderLayer(s, id, i + 1); });
        Na__LePanels__OnControl('change', 'layer-type', (e, el, id) => { const s = Na__LeModel__GetActiveSheet(); if (s) Na__LeModel__UpdateLayer(s, id, { type : el.value }); });
        Na__LePanels__OnControl('dblclick', 'layer-name', (e, el, id) => Na__LePanelLayers__Rename(el, id));
        return Na__LePanels__RegisterSection('left', {
            id : Na__LePanelLayers__ID, title : Na__LeCfg__GetLabel('LayersTitle', 'Layers'),
            build : Na__LePanelLayers__Build, refresh : Na__LePanelLayers__Refresh
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layers Panel API
    // ------------------------------------------------------------
    export {
        Na__LePanelLayers__Register
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
