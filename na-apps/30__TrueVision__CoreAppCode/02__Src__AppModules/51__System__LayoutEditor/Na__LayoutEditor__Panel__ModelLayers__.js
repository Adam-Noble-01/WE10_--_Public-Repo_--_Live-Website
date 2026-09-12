// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PANEL: MODEL LAYERS
// =============================================================================
//
// FILE       : Na__LayoutEditor__Panel__ModelLayers__.js
// NAMESPACE  : Na__LePanelModelLayers
// MODULE     : Layout Editor - Panel Model Layers
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Switch model categories off in one viewport without touching any other viewport or the 3D scene
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
//
// INTEGRATION:
// - Registered into the left column by the mode controller, under Render
//   Composites. Render Composites decides how the picture is drawn; this
//   decides what is in it.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : n/a - authored in TrueVision3D
// - Back-port     : PENDING to ValeVision3D.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 12-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, the Layer Map and the Panel Host
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel } from './Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__GetActiveSheet, Na__LeModel__GetSelectedViewport, Na__LeModel__UpdateViewport } from './Na__LayoutEditor__SheetModel__.js';
    import { Na__LeModelLayers__Ready, Na__LeModelLayers__Groups, Na__LeModelLayers__IsOn } from './Na__LayoutEditor__ModelLayers__.js';
    import {
        Na__LePanels__RegisterSection,
        Na__LePanels__OnControl,
        Na__LePanels__Refresh,
        Na__LePanels__IsEditable,
        Na__LePanels__Row,
        Na__LePanels__Input,
        Na__LePanels__Button,
        Na__LePanels__Note
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
    // The rows are rebuilt only when the model's inventory changes, not on
    // every refresh: a refresh runs on every model change and rebuilding
    // thirty rows each time would throw away the checkbox the pointer is on.
    // ------------------------------------------------------------
    let Na__LePanelModelLayers__BuiltKey = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Rows
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Shell: a Note, the Two Bulk Buttons and an Empty List
    // ------------------------------------------------------------
    function Na__LePanelModelLayers__Build(body) {
        const note = Na__LePanels__Note(Na__LeCfg__GetLabel('NoSelection', 'Select a viewport on the sheet.'));
        note.setAttribute('data-na-block', 'note');
        body.appendChild(note);

        const bulk = document.createElement('div');
        bulk.className = 'na-le-row na-le-row--buttons';
        bulk.setAttribute('data-na-block', 'bulk');
        bulk.appendChild(Na__LePanels__Button(Na__LeCfg__GetLabel('ModelLayersAllOn',  'All On'),  'model-layer-bulk', 'na-le-btn--icon', 'on'));
        bulk.appendChild(Na__LePanels__Button(Na__LeCfg__GetLabel('ModelLayersAllOff', 'All Off'), 'model-layer-bulk', 'na-le-btn--icon', 'off'));
        body.appendChild(bulk);

        const list = document.createElement('div');
        list.setAttribute('data-na-block', 'list');
        body.appendChild(list);

        // THE MAP ARRIVES LATE AND THAT IS FINE. Without it the rows still
        // build, under generated labels; when the fetch lands the section is
        // asked to refresh and the real wording replaces them.
        Na__LeModelLayers__Ready().then(() => {
            Na__LePanelModelLayers__BuiltKey = null;                              // <-- Force a rebuild with the real labels
            Na__LePanels__Refresh(Na__LePanelModelLayers__ID);
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Rebuild the Grouped Checkbox Rows
    // ------------------------------------------------------------
    function Na__LePanelModelLayers__Fill(list, groups) {
        list.innerHTML = '';
        groups.forEach((group) => {
            if (group.label) {
                const heading = document.createElement('p');
                heading.className   = 'na-le-note na-le-note--heading';
                heading.textContent = group.label;
                list.appendChild(heading);
            }
            group.layers.forEach((layer) => {
                const input = Na__LePanels__Input('checkbox', 'model-layer-toggle');
                input.setAttribute('data-na-role', layer.key);
                const row = Na__LePanels__Row(layer.label, input, 'na-le-row--toggle');
                row.setAttribute('data-na-model-layer', layer.key);
                row.title = layer.tags && layer.tags.length ? layer.tags.join(', ') : layer.key;   // <-- The SSOT tag name is one hover away
                list.appendChild(row);
            });
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect the Selected Viewport
    // ------------------------------------------------------------
    function Na__LePanelModelLayers__Refresh(body) {
        const viewport = Na__LeModel__GetSelectedViewport();
        const groups   = Na__LeModelLayers__Groups();
        const list     = body.querySelector('[data-na-block="list"]');
        const note     = body.querySelector('[data-na-block="note"]');
        const bulk     = body.querySelector('[data-na-block="bulk"]');

        if (groups.length === 0) {
            note.textContent = Na__LeCfg__GetLabel('ModelLayersNoModel', 'No model categories loaded.');
            note.hidden = false;
            bulk.hidden = true;
            list.innerHTML = '';
            Na__LePanelModelLayers__BuiltKey = null;
            return;
        }

        note.textContent = Na__LeCfg__GetLabel('NoSelection', 'Select a viewport on the sheet.');
        note.hidden = !!viewport;
        bulk.hidden = !viewport || !Na__LePanels__IsEditable();

        const key = groups.map((g) => g.id + ':' + g.layers.map((l) => l.key).join(',')).join('|');
        if (key !== Na__LePanelModelLayers__BuiltKey) {
            Na__LePanelModelLayers__Fill(list, groups);
            Na__LePanelModelLayers__BuiltKey = key;
        }

        list.hidden = !viewport;
        if (!viewport) return;
        groups.forEach((group) => group.layers.forEach((layer) => {
            const row = list.querySelector('[data-na-model-layer="' + CSS.escape(layer.key) + '"]');
            if (row) row.querySelector('input').checked = Na__LeModelLayers__IsOn(viewport, layer.key);
        }));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Registration
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Write a Patch to the Selected Viewport
    // ------------------------------------------------------------
    function Na__LePanelModelLayers__Apply(patch) {
        const sheet    = Na__LeModel__GetActiveSheet();
        const viewport = Na__LeModel__GetSelectedViewport();
        if (!sheet || !viewport) return;
        Na__LeModel__UpdateViewport(sheet, viewport.Viewport__Id, { modelLayers : patch });
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
            Na__LeModelLayers__Groups().forEach((group) => group.layers.forEach((layer) => { patch[layer.key] = on; }));
            Na__LePanelModelLayers__Apply(patch);
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
