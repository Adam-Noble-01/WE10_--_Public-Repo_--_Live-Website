// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - ITEM CLIPBOARD
// =============================================================================
//
// FILE       : Na__LayoutEditor__ItemClipboard__.js
// NAMESPACE  : Na__LeClip
// MODULE     : Layout Editor - Item Clipboard (text, groups and a multi-selection)
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Copy and paste text, groups, and several vectors or text items together, on top of the viewport and vector clipboard
// CREATED    : 14-Sep-2026
//
// DESCRIPTION:
// - A set on the clipboard is the selected vectors, text items and groups
//   (with every nested member). Ctrl+C / Ctrl+V / Ctrl+D and the right-click
//   menu paste the set as new records: fresh ids, members remapped, offset
//   by PasteOffsetMm. One paste is one undo step.
// - A single viewport or a single vector still goes through
//   Na__LayoutEditor__ViewportClipboard__.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__ asks RunKeyAction and MenuItems from here.
// // @delegate: ./Na__LayoutEditor__ViewportClipboard__.js
// // @delegate: ./Na__LayoutEditor__Groups__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (14-Sep-2026)
// - ValeVision    : ported 14-Sep-2026 as ValeVision3D v2.38.0 (verbatim, header only)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 14-Sep-2026 - Version 1.0.0
// - Copy, paste and duplicate for text, groups, and a multi-selection of
//   vectors and text. Nested groups remap their members. One undo step.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Geometry, Groups and the Viewport Clipboard
    // ------------------------------------------------------------
    import { Na__LeCfg__GetClipboardSetup, Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel } from './Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__GetActiveSheet,
        Na__LeModel__GetSelectionItems,
        Na__LeModel__SetSelection,
        Na__LeModel__SetSelectionItems,
        Na__LeModel__GetShapeById,
        Na__LeModel__GetAnnotationById,
        Na__LeModel__GetGroupById,
        Na__LeModel__GetLayerById,
        Na__LeModel__InsertShape,
        Na__LeModel__InsertAnnotation,
        Na__LeModel__InsertGroup,
        Na__LeModel__UpdateShape,
        Na__LeModel__UpdateAnnotation
    } from './Na__LayoutEditor__SheetModel__.js';
    import { Na__LeLayout__Solve } from './Na__LayoutEditor__SheetLayout__.js';
    import { Na__LeShapeGeo__Points, Na__LeShapeGeo__Translated } from './Na__LayoutEditor__ShapeGeometry__.js';
    import { Na__LeGroup__Expand, Na__LeGroup__ItemsBounds, Na__LeGroup__IsKind } from './Na__LayoutEditor__Groups__.js';
    import { Na__LePanels__GetContext } from './Na__LayoutEditor__PanelHost__.js';
    import {
        Na__LeClip__CopyViewport,
        Na__LeClip__PasteViewport,
        Na__LeClip__DuplicateViewport,
        Na__LeClip__HasViewport,
        Na__LeClip__CopyShape,
        Na__LeClip__PasteShape,
        Na__LeClip__DuplicateShape,
        Na__LeClip__HasShape,
        Na__LeClip__RunKeyAction as Na__LeClip__RunViewportKeyAction,
        Na__LeClip__MenuItems as Na__LeClip__ViewportMenuItems
    } from './Na__LayoutEditor__ViewportClipboard__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    const Na__LeClip__KIND_SET     = 'set';
    const Na__LeClip__SAME_SPOT_MM = 0.5;
    const Na__LeClip__MAX_STEPS    = 40;

    let Na__LeClip__HeldSet = null;   // <-- { kind:'set', roots, entries, origin, sourceSheetId }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    function Na__LeClip__Clone(record) {
        return JSON.parse(JSON.stringify(record));
    }

    function Na__LeClip__Toast(message) {
        const context = Na__LePanels__GetContext();
        if (context && typeof context.showToast === 'function') context.showToast(message, false);
    }

    function Na__LeClip__LayerFor(sheet, layerId, type) {
        const layer = layerId ? Na__LeModel__GetLayerById(sheet, layerId) : null;
        if (!layer || layer.Layer__Visible === false || layer.Layer__Locked === true) return null;
        if (type && layer.Layer__Type !== type) return null;
        return layer.Layer__Id;
    }

    function Na__LeClip__HasSet() {
        return !!Na__LeClip__HeldSet && Na__LeClip__HeldSet.kind === Na__LeClip__KIND_SET && (Na__LeClip__HeldSet.entries || []).length > 0;
    }

    function Na__LeClip__Copyable(sheet, items) {
        return (Array.isArray(items) ? items : []).filter((item) => item && Na__LeGroup__IsKind(item.kind));
    }

    function Na__LeClip__Snapshot(sheet, item) {
        if (!item) return null;
        if (item.kind === 'shape') {
            const record = Na__LeModel__GetShapeById(sheet, item.id);
            return record ? { kind : 'shape', id : item.id, record : Na__LeClip__Clone(record) } : null;
        }
        if (item.kind === 'annotation') {
            const record = Na__LeModel__GetAnnotationById(sheet, item.id);
            return record ? { kind : 'annotation', id : item.id, record : Na__LeClip__Clone(record) } : null;
        }
        if (item.kind === 'group') {
            const record = Na__LeModel__GetGroupById(sheet, item.id);
            return record ? { kind : 'group', id : item.id, record : Na__LeClip__Clone(record) } : null;
        }
        return null;
    }

    function Na__LeClip__ShiftAnnotation(record, dx, dy) {
        record.Annotation__PosXMm += dx;
        record.Annotation__PosYMm += dy;
        if (Number.isFinite(record.Annotation__LeaderXMm)) record.Annotation__LeaderXMm += dx;
        if (Number.isFinite(record.Annotation__LeaderYMm)) record.Annotation__LeaderYMm += dy;
        return record;
    }

    function Na__LeClip__PlaceSet(sheet, origin, size, startMm, fanOut) {
        const page    = Na__LeLayout__Solve(sheet).Page;
        const width   = size && Number.isFinite(size.WidthMm)  ? size.WidthMm  : 0;
        const height  = size && Number.isFinite(size.HeightMm) ? size.HeightMm : 0;
        const maxX    = Math.max(0, page.WidthMm  - width);
        const maxY    = Math.max(0, page.HeightMm - height);
        const onPaper = (x, y) => ({ X : Math.min(maxX, Math.max(0, x)), Y : Math.min(maxY, Math.max(0, y)) });
        const taken   = (spot) => {
            const hitShape = (sheet.Sheet__Shapes || []).some((shape) => {
                const box = Na__LeGroup__ItemsBounds(sheet, [ { kind : 'shape', id : shape.Shape__Id } ]);
                return box && Math.abs(box.X - spot.X) < Na__LeClip__SAME_SPOT_MM && Math.abs(box.Y - spot.Y) < Na__LeClip__SAME_SPOT_MM;
            });
            if (hitShape) return true;
            return (sheet.Sheet__Annotations || []).some((item) =>
                Math.abs(item.Annotation__PosXMm - spot.X) < Na__LeClip__SAME_SPOT_MM && Math.abs(item.Annotation__PosYMm - spot.Y) < Na__LeClip__SAME_SPOT_MM);
        };
        let spot = onPaper(startMm.x, startMm.y);
        if (!fanOut) return spot;
        const step = Na__LeCfg__GetClipboardSetup().pasteOffsetMm;
        for (let n = 1; taken(spot) && n <= Na__LeClip__MAX_STEPS; n++) spot = onPaper(origin.x + (step * n), origin.y + (step * n));
        for (let n = 1; taken(spot) && n <= Na__LeClip__MAX_STEPS; n++) spot = onPaper(origin.x - (step * n), origin.y - (step * n));
        return spot;
    }

    function Na__LeClip__ToastFor(roots) {
        const groups = roots.filter((item) => item.kind === 'group').length;
        const texts  = roots.filter((item) => item.kind === 'annotation').length;
        const shapes = roots.filter((item) => item.kind === 'shape').length;
        if (roots.length === 1 && groups) return Na__LeCfg__GetLabel('GroupCopied', 'Copied group. Ctrl+V pastes it, on this sheet or another.');
        if (roots.length === 1 && texts)  return Na__LeCfg__GetLabel('TextCopied', 'Copied text. Ctrl+V pastes it, on this sheet or another.');
        if (roots.length === 1 && shapes) return Na__LeCfg__GetLabel('ShapeCopied', 'Copied vector. Ctrl+V pastes it, on this sheet or another.');
        return Na__LeCfg__FormatLabel('SelectionCopied', 'Copied {count} items. Ctrl+V pastes them, on this sheet or another.', { count : roots.length });
    }

    function Na__LeClip__PasteLabel() {
        if (!Na__LeClip__HasSet()) {
            if (Na__LeClip__HasShape())    return Na__LeCfg__GetLabel('MenuPasteShape', 'Paste vector');
            if (Na__LeClip__HasViewport()) return Na__LeCfg__GetLabel('MenuPasteViewport', 'Paste viewport');
            return Na__LeCfg__GetLabel('MenuPasteSelection', 'Paste');
        }
        const roots = Na__LeClip__HeldSet.roots || [];
        if (roots.length === 1 && roots[0].kind === 'group')      return Na__LeCfg__GetLabel('MenuPasteGroup', 'Paste group');
        if (roots.length === 1 && roots[0].kind === 'annotation') return Na__LeCfg__GetLabel('MenuPasteText', 'Paste text');
        if (roots.length === 1 && roots[0].kind === 'shape')      return Na__LeCfg__GetLabel('MenuPasteShape', 'Paste vector');
        return Na__LeCfg__GetLabel('MenuPasteSelection', 'Paste selection');
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Copy and Paste a Set
// -----------------------------------------------------------------------------

    function Na__LeClip__CopyItems(sheet, items, quiet) {
        const roots = Na__LeClip__Copyable(sheet, items);
        if (!sheet || !roots.length) return false;
        const expanded = Na__LeGroup__Expand(sheet, roots);
        const entries  = [];
        const seen     = new Set();
        expanded.forEach((item) => {
            const key = item.kind + ':' + item.id;
            if (seen.has(key)) return;
            const snap = Na__LeClip__Snapshot(sheet, item);
            if (!snap) return;
            seen.add(key);
            entries.push(snap);
        });
        if (!entries.length) return false;
        const box = Na__LeGroup__ItemsBounds(sheet, expanded) || { X : 0, Y : 0, WidthMm : 0, HeightMm : 0 };
        Na__LeClip__HeldSet = {
            kind          : Na__LeClip__KIND_SET,
            roots         : roots.map((item) => ({ kind : item.kind, id : item.id })),
            entries       : entries,
            origin        : { x : box.X, y : box.Y },
            size          : { WidthMm : box.WidthMm, HeightMm : box.HeightMm },
            sourceSheetId : sheet.Sheet__Id
        };
        if (quiet !== true) Na__LeClip__Toast(Na__LeClip__ToastFor(roots));
        return true;
    }

    function Na__LeClip__InsertLeaves(sheet, entries, ids, dx, dy, lastKey) {
        let last = null;
        entries.forEach((entry) => {
            if (entry.kind === 'shape') {
                const record = Na__LeClip__Clone(entry.record);
                record.Shape__Points  = Na__LeShapeGeo__Translated(Na__LeShapeGeo__Points(record), dx, dy);
                record.Shape__LayerId = Na__LeClip__LayerFor(sheet, record.Shape__LayerId, 'vector');
                const key    = 'shape:' + entry.id;
                const silent = lastKey == null || key !== lastKey;
                const pasted = Na__LeModel__InsertShape(sheet, record, silent);
                if (pasted) { ids.set(key, pasted.Shape__Id); last = { kind : 'shape', id : pasted.Shape__Id }; }
            }
            if (entry.kind === 'annotation') {
                const record = Na__LeClip__ShiftAnnotation(Na__LeClip__Clone(entry.record), dx, dy);
                record.Annotation__LayerId = Na__LeClip__LayerFor(sheet, record.Annotation__LayerId, 'annotation');
                const key    = 'annotation:' + entry.id;
                const silent = lastKey == null || key !== lastKey;
                const pasted = Na__LeModel__InsertAnnotation(sheet, record, silent);
                if (pasted) { ids.set(key, pasted.Annotation__Id); last = { kind : 'annotation', id : pasted.Annotation__Id }; }
            }
        });
        return last;
    }

    function Na__LeClip__InsertGroups(sheet, entries, ids, lastKey) {
        const pending = entries.filter((entry) => entry.kind === 'group').map((entry) => Na__LeClip__Clone(entry));
        let last = null;
        for (let guard = 0; guard < 32 && pending.length; guard++) {
            const next = [];
            pending.forEach((entry) => {
                const members = (entry.record.Group__Members || []).map((member) => {
                    const mapped = ids.get(member.kind + ':' + member.id);
                    return mapped ? { kind : member.kind, id : mapped } : null;
                }).filter(Boolean);
                const waiting = (entry.record.Group__Members || []).some((member) => member.kind === 'group' && !ids.has('group:' + member.id));
                if (waiting) { next.push(entry); return; }
                const key    = 'group:' + entry.id;
                const silent = lastKey == null || key !== lastKey;
                const pasted = Na__LeModel__InsertGroup(sheet, { Group__Members : members }, silent);
                if (pasted) { ids.set(key, pasted.Group__Id); last = { kind : 'group', id : pasted.Group__Id }; }
            });
            if (next.length === pending.length) break;
            pending.length = 0;
            next.forEach((entry) => pending.push(entry));
        }
        return last;
    }

    function Na__LeClip__PasteSet(sheet, atMm) {
        if (!sheet || !Na__LeClip__HasSet()) return null;
        const held    = Na__LeClip__HeldSet;
        const origin  = held.origin || { x : 0, y : 0 };
        const start   = atMm || { x : origin.x, y : origin.y };
        const fanOut  = !atMm;
        const spot    = Na__LeClip__PlaceSet(sheet, origin, held.size, start, fanOut);
        const dx      = spot.X - origin.x;
        const dy      = spot.Y - origin.y;
        const ids     = new Map();
        const entries = held.entries || [];
        const leaf    = Na__LeClip__InsertLeaves(sheet, entries, ids, dx, dy, null);   // <-- All silent until one announce below, so groups land in the same undo step
        Na__LeClip__InsertGroups(sheet, entries, ids, null);
        if (leaf && leaf.kind === 'shape')      Na__LeModel__UpdateShape(sheet, leaf.id, {}, false);
        else if (leaf && leaf.kind === 'annotation') Na__LeModel__UpdateAnnotation(sheet, leaf.id, {}, false);
        const selected = (held.roots || []).map((root) => {
            const id = ids.get(root.kind + ':' + root.id);
            return id ? { kind : root.kind, id : id } : null;
        }).filter(Boolean);
        if (selected.length === 1) Na__LeModel__SetSelection(selected[0]);
        else if (selected.length > 1) Na__LeModel__SetSelectionItems(selected);
        return selected.length ? selected : null;
    }

    function Na__LeClip__DuplicateItems(sheet, items) {
        const previous = Na__LeClip__HeldSet;
        if (!Na__LeClip__CopyItems(sheet, items, true)) return null;
        const pasted = Na__LeClip__PasteSet(sheet, null);
        Na__LeClip__HeldSet = previous;
        return pasted;
    }

    function Na__LeClip__UsesSet(items) {
        const list     = Array.isArray(items) ? items : [];
        const copyable = Na__LeClip__Copyable(null, list);
        if (copyable.length > 1) return true;
        if (copyable.length === 1 && (copyable[0].kind === 'group' || copyable[0].kind === 'annotation')) return true;
        if (copyable.length >= 1 && list.length > 1) return true;
        return false;
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    function Na__LeClip__RunKeyAction(action, editable) {
        const sheet = Na__LeModel__GetActiveSheet();
        if (!sheet || !editable) return false;
        const items = Na__LeModel__GetSelectionItems();
        if (action === 'Edit__Copy') {
            if (Na__LeClip__UsesSet(items)) return Na__LeClip__CopyItems(sheet, items);
            Na__LeClip__HeldSet = null;
            return Na__LeClip__RunViewportKeyAction(action, editable);
        }
        if (action === 'Edit__Paste') {
            if (Na__LeClip__HasSet()) return !!Na__LeClip__PasteSet(sheet, null);
            return Na__LeClip__RunViewportKeyAction(action, editable);
        }
        if (action === 'Edit__Duplicate') {
            if (Na__LeClip__UsesSet(items)) return !!Na__LeClip__DuplicateItems(sheet, items);
            return Na__LeClip__RunViewportKeyAction(action, editable);
        }
        return false;
    }

    function Na__LeClip__MenuItems(sheet, target, pointMm) {
        const label = (key, fallback) => Na__LeCfg__GetLabel(key, fallback);
        const paste = {
            label    : Na__LeClip__PasteLabel(),
            disabled : !Na__LeClip__HasSet() && !Na__LeClip__HasShape() && !Na__LeClip__HasViewport(),
            onSelect : () => {
                if (Na__LeClip__HasSet()) Na__LeClip__PasteSet(sheet, target ? null : (pointMm || null));
                else Na__LeClip__RunViewportKeyAction('Edit__Paste', true);
            }
        };
        const items = Na__LeModel__GetSelectionItems();
        if (items.length > 1 && Na__LeClip__Copyable(sheet, items).length) {
            return [
                { label : label('MenuCopySelection', 'Copy selection'), onSelect : () => { Na__LeClip__CopyItems(sheet, items); } },
                { label : label('MenuDuplicateSelection', 'Duplicate selection'), onSelect : () => { Na__LeClip__DuplicateItems(sheet, items); } },
                paste
            ];
        }
        if (target && (target.kind === 'group' || target.Group__Id)) {
            const id = target.Group__Id || target.id;
            return [
                { label : label('MenuCopyGroup', 'Copy group'), onSelect : () => { Na__LeClip__CopyItems(sheet, [ { kind : 'group', id : id } ]); } },
                { label : label('MenuDuplicateGroup', 'Duplicate group'), onSelect : () => { Na__LeClip__DuplicateItems(sheet, [ { kind : 'group', id : id } ]); } },
                paste
            ];
        }
        if (target && (target.kind === 'annotation' || target.Annotation__Id)) {
            const id = target.Annotation__Id || target.id;
            return [
                { label : label('MenuCopyText', 'Copy text'), onSelect : () => { Na__LeClip__CopyItems(sheet, [ { kind : 'annotation', id : id } ]); } },
                { label : label('MenuDuplicateText', 'Duplicate text'), onSelect : () => { Na__LeClip__DuplicateItems(sheet, [ { kind : 'annotation', id : id } ]); } },
                paste
            ];
        }
        const viewportItems = Na__LeClip__ViewportMenuItems(sheet, target, pointMm);
        if (!viewportItems.length) return [ paste ];
        return viewportItems.map((item) => {
            if (!item || !item.onSelect) return item;
            if (item.label && String(item.label).indexOf('Paste') !== -1) return Na__LeClip__HasSet() ? paste : item;
            const inner = item.onSelect;
            return Object.assign({}, item, { onSelect : () => { Na__LeClip__HeldSet = null; inner(); } });
        });
    }

    export {
        Na__LeClip__CopyViewport,
        Na__LeClip__PasteViewport,
        Na__LeClip__DuplicateViewport,
        Na__LeClip__HasViewport,
        Na__LeClip__CopyShape,
        Na__LeClip__PasteShape,
        Na__LeClip__DuplicateShape,
        Na__LeClip__HasShape,
        Na__LeClip__CopyItems,
        Na__LeClip__PasteSet,
        Na__LeClip__HasSet,
        Na__LeClip__RunKeyAction,
        Na__LeClip__MenuItems
    };

// endregion -------------------------------------------------------------------
