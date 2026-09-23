// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PANEL: LAYERS
// =============================================================================
//
// FILE       : Na__LayoutEditor__Panel__Layers__.js
// NAMESPACE  : Na__LePanelLayers
// MODULE     : Layout Editor - Panel Layers
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The left panel: layer rows with eye, lock, reference switch, name, type, order, add, delete and a type filter
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - One row per layer, top of the list drawing frontmost (D31). Eye and
//   lock toggle, double-click renames, the type select re-tags (a tag is
//   a filter aid, any layer holds anything), and the grip at the end of
//   the row drags the layer up or down. Add creates a layer of the
//   filtered type; Delete removes the layer and re-homes its items to the
//   default layer of their kind.
// - THE GRIP IS A POINTER DRAG, NOT HTML DRAG AND DROP. The row follows the
//   pointer and the rows it passes slide aside to open the gap it will land
//   in, so the new order shows before it is committed. Nothing reaches the
//   model until release: one reorder, one undo step. A focused grip takes
//   the arrow keys too, so the order can still be changed without a mouse.
// - THE LOCK BUTTON NAMES WHAT A CLICK WILL DO: "Lock" on an open layer,
//   "Unlock" on a locked one.
// - THE REF BUTTON MAKES A REFERENCE LAYER, Blender's Selectable switch: the
//   layer is drawn and printed as ever, but nothing on it can be clicked,
//   boxed, hovered or snapped to - the pointer passes straight through to
//   whatever lies beneath. A lock is the other half: it stops an edit and
//   still offers its points to snap to. The button reads Ref either way.
// - ONE RED FOR EVERY SWITCH AWAY FROM ITS USUAL STATE: Off, Unlock (locked)
//   and Ref (a reference layer) all carry the same faint red. A finished
//   drawing has every layer On, unlocked and selectable, so a red button
//   anywhere down the three columns is one still to put back.
//
// INTEGRATION:
// - Registered into the panel host by the mode controller.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__Panel__Layers__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim; v1.1.0 authored here first and ported to ValeVision on 13-Sep-2026
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 23-Sep-2026 - Version 1.3.0
// - The On / Off button is red while the layer is Off (na-le-btn--eye
//   is-off, aria-pressed), and the Ref button's faint blue becomes the lock's
//   faint red: Adam's "when layers are off, make the button red, like with
//   the locked and the same with ref", so a layer left in any of the three
//   switched states shows at a glance.
//
// 21-Sep-2026 - Version 1.2.0
// - A third switch beside On and Lock, Ref, for Adam's "non-selectable layer
//   ... so you can see it, but nothing tries to snap or bind to it. Blender
//   has a system like this, so copy that": Blender's Selectable restriction,
//   with its snapping's Exclude Non-Selectable always on. It writes the layer
//   record's Selectable (Na__LeModel__UpdateLayer selectable), and a layer
//   switched to reference lets go of anything of its that was selected.
// - The note under the list says what Ref does.
//
// 21-Sep-2026 - Version 1.1.1
// - The Images layer type (pictures, 54__Feature__SheetImages) reads "Images"
//   in the type select and the filter.
//
// 13-Sep-2026 - Version 1.1.0
// - A grip replaces the Up and Down buttons and the whole-row HTML drag and
//   drop: press it, drag up or down, release. Arrow keys on a focused grip
//   step the layer one row.
// - The lock button reads Lock / Unlock instead of Open / Locked, and is a
//   faint red while locked.
//
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
    import { Na__LeCfg__GetLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__LAYER_TYPES,
        Na__LeModel__GetActiveSheet,
        Na__LeModel__GetLayers,
        Na__LeModel__CreateLayer,
        Na__LeModel__DeleteLayer,
        Na__LeModel__UpdateLayer,
        Na__LeModel__ReorderLayer
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
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
    const Na__LePanelLayers__TYPE_LABELS = { viewport : 'Viewports', annotation : 'Annotations', dimension : 'Dimensions', vector : 'Vectors', area : 'Floor Areas', image : 'Images', mixed : 'General' };   // <-- 'area' holds the measured rooms (59__Feature__FloorAreas), 'image' the pictures (54__Feature__SheetImages)
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Grip
    // ------------------------------------------------------------
    const Na__LePanelLayers__GRIP_SVG =                                           // <-- Six small squares, two by three: the usual "hold here and drag"
        '<svg viewBox="0 0 8 13" aria-hidden="true" focusable="false">' +
            '<rect x="0" y="0"  width="3" height="3" rx="0.6"/><rect x="5" y="0"  width="3" height="3" rx="0.6"/>' +
            '<rect x="0" y="5"  width="3" height="3" rx="0.6"/><rect x="5" y="5"  width="3" height="3" rx="0.6"/>' +
            '<rect x="0" y="10" width="3" height="3" rx="0.6"/><rect x="5" y="10" width="3" height="3" rx="0.6"/>' +
        '</svg>';
    const Na__LePanelLayers__DRAG_START_PX = 3;                                   // <-- A press that wanders less than this is a click, not a drag
    // ------------------------------------------------------------

    // MODULE VARIABLES | Filter and Drag State
    // ------------------------------------------------------------
    let Na__LePanelLayers__Filter = 'all';
    let Na__LePanelLayers__Drag   = null;                                         // <-- The reorder in flight: its rows, where each sat, where the layer will land
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


    // HELPER FUNCTION | The Layers the Filter Lets Through, Frontmost First
    // ------------------------------------------------------------
    function Na__LePanelLayers__Shown(sheet) {
        return Na__LeModel__GetLayers(sheet).filter((l) => Na__LePanelLayers__Filter === 'all' || l.Layer__Type === Na__LePanelLayers__Filter);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build One Layer Row
    // ------------------------------------------------------------
    function Na__LePanelLayers__Row(layer) {
        const editable = Na__LePanels__IsEditable();
        const locked   = layer.Layer__Locked === true;                            // <-- The same test the model locks by, so the button never disagrees with it
        const row = document.createElement('div');
        row.className = 'na-le-layer' + (layer.Layer__Visible === false ? ' na-le-layer--hidden' : '') + (locked ? ' na-le-layer--locked' : '');
        row.setAttribute('data-na-layer-id', layer.Layer__Id);

        const hidden = layer.Layer__Visible === false;                            // <-- The same test the model shows by
        const eye = Na__LePanels__Button(hidden ? 'Off' : 'On', 'layer-eye', 'na-le-btn--icon na-le-btn--eye' + (hidden ? ' is-off' : ''), layer.Layer__Id);
        eye.title = 'Show or hide';
        eye.setAttribute('aria-pressed', String(hidden));
        const lock = Na__LePanels__Button(locked ? 'Unlock' : 'Lock', 'layer-lock', 'na-le-btn--icon na-le-btn--lock' + (locked ? ' is-locked' : ''), layer.Layer__Id);
        lock.title = locked ? 'Locked - click to unlock' : 'Lock this layer';
        lock.setAttribute('aria-pressed', String(locked));

        // THE REFERENCE SWITCH | Blender's Selectable: shown, never picked
        const reference = layer.Layer__Selectable === false;                       // <-- The same test the model picks by
        const refer = Na__LePanels__Button(Na__LeCfg__GetLabel('LayerReference', 'Ref'), 'layer-ref', 'na-le-btn--icon na-le-btn--ref' + (reference ? ' is-reference' : ''), layer.Layer__Id);
        refer.title = reference
            ? Na__LeCfg__GetLabel('LayerReferenceOnTitle', 'Reference layer: shown and printed, but nothing on it can be selected or snapped to - click to make it selectable again')
            : Na__LeCfg__GetLabel('LayerReferenceTitle', 'Make this a reference layer: shown and printed, but nothing on it can be selected or snapped to');
        refer.setAttribute('aria-pressed', String(reference));

        const name = document.createElement('span');
        name.className   = 'na-le-layer__name';
        name.textContent = layer.Layer__Name;
        name.title       = editable ? 'Double-click to rename' : layer.Layer__Name;
        name.setAttribute('data-na-control', 'layer-name');
        name.setAttribute('data-na-role', layer.Layer__Id);

        const type = Na__LePanels__Select('layer-type', Na__LePanelLayers__TypeOptions(false), layer.Layer__Type);
        type.setAttribute('data-na-role', layer.Layer__Id);
        type.classList.add('na-le-select--compact');

        const grip = document.createElement('button');
        grip.type      = 'button';
        grip.className = 'na-le-layer__grip';
        grip.innerHTML = Na__LePanelLayers__GRIP_SVG;
        grip.title     = 'Drag to reorder';
        grip.setAttribute('aria-label', 'Drag to reorder, or use the arrow keys');
        grip.setAttribute('data-na-control', 'layer-grip');
        grip.setAttribute('data-na-role', layer.Layer__Id);
        [ eye, lock, refer, grip ].forEach((b) => { b.disabled = !editable; });
        if (editable) grip.addEventListener('pointerdown', (e) => Na__LePanelLayers__DragStart(e, grip, layer.Layer__Id));

        row.appendChild(eye);
        row.appendChild(lock);
        row.appendChild(refer);
        row.appendChild(name);
        row.appendChild(type);
        row.appendChild(grip);
        return row;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Grip Drag
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Press on a Grip: Measure Every Row Once
    // ------------------------------------------------------------
    // Rows and pointer are both measured from the top of the list, so a panel
    // that scrolls mid-drag still lines up. The window listens rather than the
    // grip, in the capture phase: the pointer may leave the grip, the panel or
    // the window and the drag still ends where it should.
    // ------------------------------------------------------------
    function Na__LePanelLayers__DragStart(event, grip, layerId) {
        const list = Na__LePanelLayers__List;
        if (event.button !== 0 || Na__LePanelLayers__Drag || !list || !Na__LePanels__IsEditable()) return;
        const rows = Array.from(list.children);
        const from = rows.indexOf(grip.closest('.na-le-layer'));
        if (from === -1) return;
        event.preventDefault();                                                   // <-- No text selection starting under the pointer
        const top = list.getBoundingClientRect().top;
        Na__LePanelLayers__Drag = {
            layerId   : layerId,
            pointerId : event.pointerId,
            rows      : rows,
            slots     : rows.map((r) => { const box = r.getBoundingClientRect(); return { top : box.top - top, height : box.height }; }),
            from      : from,
            to        : from,
            startY    : event.clientY - top,
            moved     : false,
            pending   : false                                                     // <-- Set when a refresh arrives mid-drag; paid at the end
        };
        try { grip.setPointerCapture(event.pointerId); } catch (err) { /* A scripted pointer has nothing to capture; the window still hears it */ }
        window.addEventListener('pointermove',   Na__LePanelLayers__DragMove, true);
        window.addEventListener('pointerup',     Na__LePanelLayers__DragUp, true);
        window.addEventListener('pointercancel', Na__LePanelLayers__DragUp, true);
        window.addEventListener('keydown',       Na__LePanelLayers__DragAbandon, true);
        window.addEventListener('blur',          Na__LePanelLayers__DragAbandon);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Move: The Row Follows, the Rows It Passes Slide Aside
    // ------------------------------------------------------------
    // A row takes a place once its LEADING EDGE passes the middle of the row
    // there - not its centre. Held at either end of the list, a row's centre
    // can only touch the end row's middle and never pass it, so the first and
    // last places would be unreachable.
    // ------------------------------------------------------------
    function Na__LePanelLayers__DragMove(event) {
        const drag = Na__LePanelLayers__Drag;
        const list = Na__LePanelLayers__List;
        if (!drag || !list || event.pointerId !== drag.pointerId) return;
        let dy = (event.clientY - list.getBoundingClientRect().top) - drag.startY;
        if (!drag.moved) {
            if (Math.abs(dy) < Na__LePanelLayers__DRAG_START_PX) return;
            drag.moved = true;
            list.classList.add('is-sorting');
            drag.rows[drag.from].classList.add('is-dragging');
            document.body.classList.add('na-le-sorting');                         // <-- The grabbing cursor holds wherever the pointer wanders
        }
        const own   = drag.slots[drag.from];
        const first = drag.slots[0];
        const last  = drag.slots[drag.slots.length - 1];
        dy = Math.max(first.top - own.top, Math.min((last.top + last.height) - (own.top + own.height), dy));   // <-- Never above the first row or below the last
        const edgeTop    = own.top + dy;
        const edgeBottom = edgeTop + own.height;
        let to = drag.from;
        drag.slots.forEach((slot, i) => {
            const middle = slot.top + slot.height / 2;
            if (i < drag.from && edgeTop < middle && i < to) to = i;              // <-- Above: the highest row whose middle the top edge has passed
            if (i > drag.from && edgeBottom > middle) to = i;                     // <-- Below: the lowest row whose middle the bottom edge has passed
        });
        drag.to = to;
        const pitch = own.height + (drag.slots.length > 1 ? drag.slots[1].top - (first.top + first.height) : 0);   // <-- One row plus the list's gap
        drag.rows.forEach((row, i) => {
            const shift = i === drag.from ? dy : ((i > drag.from && i <= to) ? -pitch : ((i < drag.from && i >= to) ? pitch : 0));
            row.style.transform = shift ? 'translateY(' + shift + 'px)' : '';
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Release, Cancel, Escape or the Window Losing Focus
    // ------------------------------------------------------------
    function Na__LePanelLayers__DragUp(event) {
        const drag = Na__LePanelLayers__Drag;
        if (drag && event.pointerId === drag.pointerId) Na__LePanelLayers__DragEnd(event.type === 'pointerup');   // <-- A cancelled pointer moves nothing
    }
    function Na__LePanelLayers__DragAbandon(event) {
        if (event.type === 'keydown') {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();                                              // <-- Escape drops the drag, not the tool or the editor
        }
        Na__LePanelLayers__DragEnd(false);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | End the Drag: One Reorder, or None
    // ------------------------------------------------------------
    // The drag is cleared BEFORE the reorder. The reorder's change event
    // refreshes this panel synchronously, and a refresh that still finds a drag
    // in flight is put off - the rows would stay in their old order.
    // ------------------------------------------------------------
    function Na__LePanelLayers__DragEnd(commit) {
        const drag = Na__LePanelLayers__Drag;
        if (!drag) return;
        Na__LePanelLayers__Drag = null;
        window.removeEventListener('pointermove',   Na__LePanelLayers__DragMove, true);
        window.removeEventListener('pointerup',     Na__LePanelLayers__DragUp, true);
        window.removeEventListener('pointercancel', Na__LePanelLayers__DragUp, true);
        window.removeEventListener('keydown',       Na__LePanelLayers__DragAbandon, true);
        window.removeEventListener('blur',          Na__LePanelLayers__DragAbandon);
        document.body.classList.remove('na-le-sorting');
        if (Na__LePanelLayers__List) Na__LePanelLayers__List.classList.remove('is-sorting');
        drag.rows.forEach((row) => { row.style.transform = ''; row.classList.remove('is-dragging'); });

        const landed = commit && drag.moved && drag.to !== drag.from && drag.rows[drag.from].isConnected;   // <-- Not if the editor closed under the drag
        const sheet  = landed ? Na__LeModel__GetActiveSheet() : null;
        const target = sheet ? drag.rows[drag.to].getAttribute('data-na-layer-id') : null;
        const index  = target ? Na__LeModel__GetLayers(sheet).findIndex((l) => l.Layer__Id === target) : -1;
        const moved  = index !== -1 && Na__LeModel__ReorderLayer(sheet, drag.layerId, index);   // <-- The landing row's place in the FULL list, so a filtered view reorders correctly
        if (!moved && drag.pending) Na__LePanelLayers__Refresh();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Arrow Keys on a Focused Grip: One Row Up or Down
    // ------------------------------------------------------------
    function Na__LePanelLayers__Step(layerId, step) {
        const sheet = Na__LeModel__GetActiveSheet();
        if (!sheet || Na__LePanelLayers__Drag || !Na__LePanels__IsEditable()) return;
        const shown = Na__LePanelLayers__Shown(sheet);
        const at    = shown.findIndex((l) => l.Layer__Id === layerId);
        const next  = at === -1 ? null : shown[at + step];
        if (!next) return;
        Na__LeModel__ReorderLayer(sheet, layerId, Na__LeModel__GetLayers(sheet).findIndex((l) => l.Layer__Id === next.Layer__Id));
        const grip = Na__LePanelLayers__List && Na__LePanelLayers__List.querySelector('[data-na-control="layer-grip"][data-na-role="' + CSS.escape(layerId) + '"]');
        if (grip) grip.focus();                                                   // <-- The rows were rebuilt: keep the keys on the same layer
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
        body.appendChild(Na__LePanels__Note(Na__LeCfg__GetLabel('LayersNote', 'Top of the list draws frontmost. Types are tags for filtering; any layer can hold anything. Ref makes a reference layer: shown and printed, but nothing on it can be selected or snapped to.')));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Rebuild the Rows
    // ------------------------------------------------------------
    function Na__LePanelLayers__Refresh() {
        if (Na__LePanelLayers__Drag) { Na__LePanelLayers__Drag.pending = true; return; }   // <-- Rebuilding mid-drag would pull the rows out from under the pointer; the drop redraws
        const list  = Na__LePanelLayers__List;
        const sheet = Na__LeModel__GetActiveSheet();
        if (!list) return;
        list.innerHTML = '';
        if (!sheet) return;
        Na__LePanelLayers__Shown(sheet).forEach((layer) => list.appendChild(Na__LePanelLayers__Row(layer)));
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
            const layers = Na__LePanelLayers__Shown(sheet);
            const last = layers[layers.length - 1];
            if (last) Na__LeModel__DeleteLayer(sheet, last.Layer__Id);
        });
        Na__LePanels__OnControl('click', 'layer-eye',  (e, el, id) => { const s = Na__LeModel__GetActiveSheet(); const l = s && s.Sheet__Layers.find((x) => x.Layer__Id === id); if (l) Na__LeModel__UpdateLayer(s, id, { visible : l.Layer__Visible === false }); });
        Na__LePanels__OnControl('click', 'layer-lock', (e, el, id) => { const s = Na__LeModel__GetActiveSheet(); const l = s && s.Sheet__Layers.find((x) => x.Layer__Id === id); if (l) Na__LeModel__UpdateLayer(s, id, { locked : !l.Layer__Locked }); });
        Na__LePanels__OnControl('click', 'layer-ref',  (e, el, id) => { const s = Na__LeModel__GetActiveSheet(); const l = s && s.Sheet__Layers.find((x) => x.Layer__Id === id); if (l) Na__LeModel__UpdateLayer(s, id, { selectable : l.Layer__Selectable === false }); });
        Na__LePanels__OnControl('keydown', 'layer-grip', (e, el, id) => {
            const step = e.key === 'ArrowUp' ? -1 : (e.key === 'ArrowDown' ? 1 : 0);
            if (!step) return;
            e.preventDefault();
            e.stopPropagation();                                                  // <-- An arrow on the grip moves the layer, not the selection on the sheet
            Na__LePanelLayers__Step(id, step);
        });
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
