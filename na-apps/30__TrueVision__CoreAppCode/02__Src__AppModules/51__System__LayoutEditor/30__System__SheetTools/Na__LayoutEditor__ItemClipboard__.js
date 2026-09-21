// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - ITEM CLIPBOARD
// =============================================================================
//
// FILE       : Na__LayoutEditor__ItemClipboard__.js
// NAMESPACE  : Na__LeClip
// MODULE     : Layout Editor - Item Clipboard (text, leaders, groups and a multi-selection)
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Copy and paste text, leaders, groups, and several vectors or text items together, on top of the viewport and vector clipboard
// CREATED    : 14-Sep-2026
//
// DESCRIPTION:
// - A set on the clipboard is the selected vectors, text items, leaders and
//   groups (with every nested member). Ctrl+C / Ctrl+V / Ctrl+D and the
//   right-click menu copy, paste and duplicate it: fresh ids, members
//   remapped. One paste is one undo step.
// - A paste (Ctrl+V, or the menu's Paste on an item) always lands in the
//   same place the set was copied from - on this sheet or any other - and a
//   toast confirms it, since landing exactly in place is otherwise invisible.
//   Duplicate (Ctrl+D) is the one that steps clear by PasteOffsetMm, because
//   it shows no toast: the step is what says it worked.
// - Ctrl+X cuts unlocked roots; Ctrl+C/V share one selection clipboard for
//   vectors, text, leaders, dimensions, viewports and nested groups.
//   Clipboard coordinates stay unchanged even outside the page boundary.
// - A paste on ANOTHER sheet brings its layers: each item lands on the
//   layer of the same name there, and a sheet without that layer gets one,
//   in the same place in the list (Na__LeClip__Landing).
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__ asks RunKeyAction and MenuItems from here.
// - Na__LayoutEditor__Scrapbook__ drops its items through InsertSet.
// - Na__LayoutEditor__SheetTools__CopyDrag__ clones a Ctrl-drag's copy
//   through CloneInPlace.
// // @delegate: ../20__System__Viewports/Na__LayoutEditor__ViewportClipboard__.js
// // @delegate: ../15__Core__Markup/Na__LayoutEditor__Groups__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (14-Sep-2026)
// - ValeVision    : ported 14-Sep-2026 as ValeVision3D v2.38.0 (verbatim, header only)
// - Divergences   : 1.1.0 InsertSet, TrueVision first (14-Sep-2026, for the Scrapbook); not yet in ValeVision.
//                   1.2.0 Leaders and paste-in-place, TrueVision first (18-Sep-2026); not yet in ValeVision.
//                   1.5.0 and 1.6.0 Copies keep their layers, on the sheet and across sheets, TrueVision
//                   first (21-Sep-2026); not yet in ValeVision.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.6.0
// - A PASTE ON ANOTHER SHEET BRINGS ITS LAYERS. Each item lands on the layer
//   of the same NAME there: layer ids are per sheet - Layer_006 is Guides on
//   one sheet and Images on the next - but a name is what the user made. A
//   sheet without that layer gets one, with the source's name and type, in
//   the same place in the list: directly over the layer it sat over on the
//   sheet it came from (Na__LeModel__LayerIndexLike). A copy keeps its
//   sheet's layer list for this (sourceLayers). Copy and cut alike, and the
//   layer made rides in the paste's one undo step.
// - A layer found hidden is switched on: a paste that vanished would read as
//   one that failed. A LOCKED layer takes nothing, as a locked layer takes
//   nothing from the Layer flyout - its items go to their kind's layer. A
//   REFERENCE layer takes them, as the layer they came from did, and they
//   are left out of the selection. The toast names every layer made,
//   switched on, locked or reference.
// - A paste on the sheet it came from, a Duplicate and a Ctrl-drag copy keep
//   1.5.0's rule, and so does a Scrapbook item, which brings no layers.
//
// 21-Sep-2026 - Version 1.5.0
// - A COPY LANDING ON THE SHEET IT CAME FROM KEEPS ITS ORIGINAL'S LAYER,
//   whatever that layer's type (LayerFor's sameSheet). A line moved onto a
//   layer of the user's own with the Layer flyout - Construction Lines,
//   typed General - used to have every duplicate, Ctrl-drag copy and paste
//   of it sent back to Vectors, because the layer was not a 'vector' one.
//   Layer ids are per sheet, so a copy landing on ANOTHER sheet still needs a
//   layer of its own type there, as before.
// - No copy lands on a REFERENCE layer (Layer__Selectable false), as none
//   lands on a hidden or a locked one: it would be out of reach the moment it
//   landed. It goes to its kind's layer instead.
//
// 21-Sep-2026 - Version 1.4.0
// - CloneInPlace: the records Duplicate would make, landing exactly on the
//   originals and announcing nothing, for the Ctrl-drag copy
//   (Na__LayoutEditor__SheetTools__CopyDrag__), which carries them off at
//   once and announces on release - one undo step. Copy's snapshot loop is
//   now Entries, shared by the two.
//
// 19-Sep-2026 - Version 1.3.0
// - Complete mixed selections, dimensions and viewports; cut; exact in-place
//   cross-sheet paste; remapped dimension hosts and nested group members.
//
// 18-Sep-2026 - Version 1.2.0
// - Leaders join the set: copyable, pasteable and duplicable the way text
//   already is (Ctrl+C / Ctrl+V / Ctrl+D and the right-click menu), even
//   though a leader still cannot join a group. A paste no longer fans out
//   looking for a free spot - it always lands in the same place, and a
//   toast (TextPasted, ShapePasted, LeaderPasted, GroupPasted,
//   SelectionPasted) says so. Duplicate keeps the fan-out; it has no toast
//   of its own.
//
// 14-Sep-2026 - Version 1.1.0
// - InsertSet: the paste of a set that did not come from the clipboard - a
//   Scrapbook item (Na__LayoutEditor__Scrapbook__). PasteSet is now InsertSet
//   with the held set, so nothing about a paste changes.
//
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
    import { Na__LeCfg__GetClipboardSetup, Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__GetActiveSheet,
        Na__LeModel__GetSelectionItems,
        Na__LeModel__SetSelection,
        Na__LeModel__SetSelectionItems,
        Na__LeModel__GetShapeById,
        Na__LeModel__GetAnnotationById,
        Na__LeModel__GetGroupById,
        Na__LeModel__GetLeaderById,
        Na__LeModel__GetLayers,
        Na__LeModel__GetLayerById,
        Na__LeModel__GetLayerByName,
        Na__LeModel__LayerIndexLike,
        Na__LeModel__DefaultLayerId,
        Na__LeModel__CreateLayer,
        Na__LeModel__UpdateLayer,
        Na__LeModel__IsItemPickable,
        Na__LeModel__GetViewportById,
        Na__LeModel__IsLayerLocked,
        Na__LeModel__DeleteItems,
        Na__LeModel__InsertViewport,
        Na__LeModel__InsertDimension,
        Na__LeModel__UpdateViewport,
        Na__LeModel__UpdateDimension,
        Na__LeModel__InsertShape,
        Na__LeModel__ShapeLayerType,
        Na__LeModel__InsertAnnotation,
        Na__LeModel__InsertGroup,
        Na__LeModel__InsertLeader,
        Na__LeModel__UpdateShape,
        Na__LeModel__UpdateAnnotation,
        Na__LeModel__UpdateLeader
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeLayout__Solve } from '../07__Core__SheetData/Na__LayoutEditor__SheetLayout__.js';
    import { Na__LeDrawScale__DimensionAtScale } from '../07__Core__SheetData/Na__LayoutEditor__DrawingScale__.js';
    import { Na__LeShapeGeo__Points, Na__LeShapeGeo__Translated } from '../15__Core__Markup/Na__LayoutEditor__ShapeGeometry__.js';
    import { Na__LeGroup__Expand, Na__LeGroup__ItemsBounds } from '../15__Core__Markup/Na__LayoutEditor__Groups__.js';
    import { Na__LePanels__GetContext } from '../40__Ui__Panels/Na__LayoutEditor__PanelHost__.js';
    import {
        Na__LeClip__CopyViewport,
        Na__LeClip__PasteViewport,
        Na__LeClip__DuplicateViewport,
        Na__LeClip__HasViewport,
        Na__LeClip__CopyShape,
        Na__LeClip__PasteShape,
        Na__LeClip__DuplicateShape,
        Na__LeClip__HasShape,
        Na__LeClip__RunKeyAction as Na__LeClip__RunViewportKeyAction
    } from '../20__System__Viewports/Na__LayoutEditor__ViewportClipboard__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    const Na__LeClip__KIND_SET     = 'set';
    const Na__LeClip__SAME_SPOT_MM = 0.5;
    const Na__LeClip__MAX_STEPS    = 40;

    // A leader is not a groupable kind (Na__LeGroup__KINDS leaves it out, so
    // Ctrl+G never takes it - see Na__LayoutEditor__Groups__), but it is a
    // "Set" member here: Copy, Duplicate and Paste all read it through this
    // list rather than through Na__LeGroup__IsKind.
    const Na__LeClip__COPYABLE_KINDS = Object.freeze([ 'shape', 'annotation', 'group', 'leader', 'dimension', 'viewport' ]);

    let Na__LeClip__HeldSet = null;   // <-- { kind:'set', roots, entries, origin, size, sourceSheetId, sourceLayers }

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

    // HELPER FUNCTION | The Layer a Copy Keeps, or Null for Its Kind's Layer
    // ------------------------------------------------------------
    // Never a hidden, a locked or a reference layer: a copy there would
    // vanish, refuse to move or be out of reach the moment it landed. Layer
    // ids are per sheet, so on ANOTHER sheet the same id may name a layer of
    // another purpose, and type, when given, must match there. On the sheet
    // it came from (sameSheet) the id names the very layer the original is on,
    // and the copy stays on it whatever its type - a user's own layer made
    // with the Layer flyout included.
    // ------------------------------------------------------------
    function Na__LeClip__LayerFor(sheet, layerId, type, sameSheet) {
        const layer = layerId ? Na__LeModel__GetLayerById(sheet, layerId) : null;
        if (!layer || layer.Layer__Visible === false || layer.Layer__Locked === true || layer.Layer__Selectable === false) return null;
        if (type && layer.Layer__Type !== type && sameSheet !== true) return null;
        return layer.Layer__Id;
    }

    // HELPER FUNCTION | A Sheet's Layers as a Copy Keeps Them (the top of the list first)
    // ------------------------------------------------------------
    // Each layer's id, name and type: enough to find the same layer on
    // another sheet by its name, or to make it there in the same place in the
    // list (Na__LeClip__Landing).
    // ------------------------------------------------------------
    function Na__LeClip__LayerList(sheet) {
        return Na__LeModel__GetLayers(sheet).map((layer) => ({ Layer__Id : layer.Layer__Id, Layer__Name : layer.Layer__Name, Layer__Type : layer.Layer__Type }));
    }
    // ------------------------------------------------------------

    // HELPER FUNCTION | How One Insert Chooses Its Layers
    // ------------------------------------------------------------
    // same: landing on the sheet the set came from. layers: that sheet's layer
    // list, when the set brought one - a copy does, a Scrapbook item does not.
    // found: each source layer settled once per insert, so forty lines on one
    // layer make one layer and one note. report: the layers made, switched
    // on, found locked and found reference, for the toast.
    // ------------------------------------------------------------
    function Na__LeClip__Route(sheet, sourceSheetId, sourceLayers) {
        return {
            same   : sourceSheetId === sheet.Sheet__Id,
            layers : Array.isArray(sourceLayers) && sourceLayers.length ? sourceLayers : null,
            found  : new Map(),
            report : { made : [], shown : [], locked : [], reference : [] }
        };
    }
    // ------------------------------------------------------------

    function Na__LeClip__Note(list, layer) {
        if (!list.some((noted) => noted.Layer__Id === layer.Layer__Id)) list.push(layer);
    }

    // HELPER FUNCTION | This Sheet's Layer of the Same Name as a Source Layer, Made if It Has None
    // ------------------------------------------------------------
    // Made with the source layer's name and type, in the same place in the
    // list (Na__LeModel__LayerIndexLike), silently: the insert announces once
    // for everything. null for a layer the source list does not name, or one
    // with no name to go by.
    // ------------------------------------------------------------
    function Na__LeClip__SameLayer(sheet, layerId, route) {
        if (route.found.has(layerId)) return route.found.get(layerId);
        const at   = route.layers.findIndex((layer) => layer.Layer__Id === layerId);
        const from = at === -1 ? null : route.layers[at];
        let layer  = null;
        if (from && typeof from.Layer__Name === 'string' && from.Layer__Name.trim()) {
            layer = Na__LeModel__GetLayerByName(sheet, from.Layer__Name);
            if (!layer) {
                const index = Na__LeModel__LayerIndexLike(sheet, route.layers.map((source) => source.Layer__Name), at);
                layer = Na__LeModel__CreateLayer(sheet, { name : from.Layer__Name, type : from.Layer__Type, index : index, silent : true });
                if (layer) route.report.made.push(layer);
            }
        }
        route.found.set(layerId, layer);
        return layer;
    }
    // ------------------------------------------------------------

    // HELPER FUNCTION | The Layer a Copy Lands On (null for its kind's layer)
    // ------------------------------------------------------------
    // On the sheet it came from, or for a set that brought no layers (a
    // Scrapbook item), LayerFor, as ever. From ANOTHER sheet, the layer of the
    // same name here (Na__LeClip__SameLayer) - layer ids are per sheet, and a
    // name is what the user made:
    // - found hidden, it is switched on, since a paste that vanished would
    //   read as one that failed;
    // - found LOCKED, it takes nothing, as a locked layer takes nothing from
    //   the Layer flyout, and the copy goes to its kind's layer - unless that
    //   is this very layer, where it was going anyway;
    // - found REFERENCE, it takes the copy as the source layer did. The copy
    //   is seen, and left out of the selection (Na__LeClip__InsertSet).
    // type is the kind's layer type, null for a viewport.
    // ------------------------------------------------------------
    function Na__LeClip__Landing(sheet, layerId, type, route) {
        if (route.same || !route.layers) return Na__LeClip__LayerFor(sheet, layerId, type, route.same);
        const layer = Na__LeClip__SameLayer(sheet, layerId, route);
        if (!layer) return Na__LeClip__LayerFor(sheet, layerId, type, false);
        if (layer.Layer__Locked === true) {
            if (Na__LeModel__DefaultLayerId(sheet, type || 'viewport') === layer.Layer__Id) return layer.Layer__Id;
            Na__LeClip__Note(route.report.locked, layer);
            return null;
        }
        if (layer.Layer__Visible === false) {
            Na__LeModel__UpdateLayer(sheet, layer.Layer__Id, { visible : true }, true);
            Na__LeClip__Note(route.report.shown, layer);
        }
        if (layer.Layer__Selectable === false) Na__LeClip__Note(route.report.reference, layer);
        return layer.Layer__Id;
    }
    // ------------------------------------------------------------

    // HELPER FUNCTION | What a Paste Did to This Sheet's Layers, in Words for Its Toast
    // ------------------------------------------------------------
    function Na__LeClip__LayerNotes(report) {
        const notes = [];
        const say   = (list, key, fallbackOne, fallbackMany) => {
            if (!Array.isArray(list) || !list.length) return;
            const names = list.map((layer) => layer.Layer__Name);
            notes.push(names.length === 1
                ? Na__LeCfg__FormatLabel(key + 'One', fallbackOne, { layer : names[0] })
                : Na__LeCfg__FormatLabel(key, fallbackMany, { count : names.length, layers : names.join(', ') }));
        };
        if (!report) return notes;
        say(report.made,      'PasteLayerMade',      'Added the {layer} layer to this sheet, in the same place in the list.', 'Added {count} layers to this sheet, in the same places in the list: {layers}.');
        say(report.shown,     'PasteLayerShown',     'Switched on the {layer} layer, which was hidden.', 'Switched on {count} hidden layers: {layers}.');
        say(report.locked,    'PasteLayerLocked',    'The {layer} layer is locked on this sheet, so what came from it went to its usual layer.', '{count} layers are locked on this sheet ({layers}), so what came from them went to their usual layers.');
        say(report.reference, 'PasteLayerReference', 'The {layer} layer is a reference layer on this sheet: what landed on it can be seen, not picked.', '{count} layers are reference layers on this sheet ({layers}): what landed on them can be seen, not picked.');
        return notes;
    }
    // ------------------------------------------------------------

    function Na__LeClip__HasSet() {
        return !!Na__LeClip__HeldSet && Na__LeClip__HeldSet.kind === Na__LeClip__KIND_SET && (Na__LeClip__HeldSet.entries || []).length > 0;
    }

    function Na__LeClip__Copyable(sheet, items) {
        return (Array.isArray(items) ? items : []).filter((item) => item && Na__LeClip__COPYABLE_KINDS.indexOf(item.kind) !== -1);
    }

    function Na__LeClip__Snapshot(sheet, item) {
        if (!item) return null;
        if (item.kind === 'dimension') {
            const record = (sheet.Sheet__Dimensions || []).find((dim) => dim.Dimension__Id === item.id);
            if (!record) return null;
            const copy = Na__LeClip__Clone(record);
            if (typeof copy.Dimension__AtScale !== 'boolean') copy.Dimension__AtScale = Na__LeDrawScale__DimensionAtScale(sheet, record);
            return { kind : item.kind, id : item.id, record : copy };
        }
        if (item.kind === 'viewport') {
            const record = Na__LeModel__GetViewportById(sheet, item.id);
            return record ? { kind : item.kind, id : item.id, record : Na__LeClip__Clone(record) } : null;
        }
        if (item.kind === 'shape') {
            const record = Na__LeModel__GetShapeById(sheet, item.id);
            return record ? { kind : 'shape', id : item.id, record : Na__LeClip__Clone(record) } : null;
        }
        if (item.kind === 'annotation') {
            const record = Na__LeModel__GetAnnotationById(sheet, item.id);
            return record ? { kind : 'annotation', id : item.id, record : Na__LeClip__Clone(record) } : null;
        }
        if (item.kind === 'leader') {
            const record = Na__LeModel__GetLeaderById(sheet, item.id);
            return record ? { kind : 'leader', id : item.id, record : Na__LeClip__Clone(record) } : null;
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

    function Na__LeClip__ShiftLeader(record, dx, dy) {
        record.Leader__TipXMm    += dx;
        record.Leader__TipYMm    += dy;
        record.Leader__AnchorXMm += dx;
        record.Leader__AnchorYMm += dy;
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
            const hitAnnotation = (sheet.Sheet__Annotations || []).some((item) =>
                Math.abs(item.Annotation__PosXMm - spot.X) < Na__LeClip__SAME_SPOT_MM && Math.abs(item.Annotation__PosYMm - spot.Y) < Na__LeClip__SAME_SPOT_MM);
            if (hitAnnotation) return true;
            return (sheet.Sheet__Leaders || []).some((leader) => {
                const box = Na__LeGroup__ItemsBounds(sheet, [ { kind : 'leader', id : leader.Leader__Id } ]);
                return box && Math.abs(box.X - spot.X) < Na__LeClip__SAME_SPOT_MM && Math.abs(box.Y - spot.Y) < Na__LeClip__SAME_SPOT_MM;
            });
        };
        let spot = onPaper(startMm.x, startMm.y);
        if (!fanOut) return spot;
        const step = Na__LeCfg__GetClipboardSetup().pasteOffsetMm;
        for (let n = 1; taken(spot) && n <= Na__LeClip__MAX_STEPS; n++) spot = onPaper(origin.x + (step * n), origin.y + (step * n));
        for (let n = 1; taken(spot) && n <= Na__LeClip__MAX_STEPS; n++) spot = onPaper(origin.x - (step * n), origin.y - (step * n));
        return spot;
    }

    function Na__LeClip__ToastFor(roots) {
        const groups  = roots.filter((item) => item.kind === 'group').length;
        const texts   = roots.filter((item) => item.kind === 'annotation').length;
        const shapes  = roots.filter((item) => item.kind === 'shape').length;
        const leaders = roots.filter((item) => item.kind === 'leader').length;
        if (roots.length === 1 && groups)  return Na__LeCfg__GetLabel('GroupCopied', 'Copied group. Ctrl+V pastes it, on this sheet or another.');
        if (roots.length === 1 && texts)   return Na__LeCfg__GetLabel('TextCopied', 'Copied text. Ctrl+V pastes it, on this sheet or another.');
        if (roots.length === 1 && shapes)  return Na__LeCfg__GetLabel('ShapeCopied', 'Copied vector. Ctrl+V pastes it, on this sheet or another.');
        if (roots.length === 1 && leaders) return Na__LeCfg__GetLabel('LeaderCopied', 'Copied leader. Ctrl+V pastes it, on this sheet or another.');
        return Na__LeCfg__FormatLabel('SelectionCopied', 'Copied {count} items. Ctrl+V pastes them, on this sheet or another.', { count : roots.length });
    }

    // HELPER FUNCTION | The Toast Shown When a Set Actually Lands (Paste, not Duplicate or a Scrapbook drop)
    // ------------------------------------------------------------
    // Duplicate already shows the copy stepped clear of the original, so it
    // stays quiet. Paste now always lands in the same place it was copied
    // from, so without a word there would be nothing on screen to say it
    // worked - this is that word.
    // ------------------------------------------------------------
    function Na__LeClip__PastedToastFor(roots) {
        const groups  = roots.filter((item) => item.kind === 'group').length;
        const texts   = roots.filter((item) => item.kind === 'annotation').length;
        const shapes  = roots.filter((item) => item.kind === 'shape').length;
        const leaders = roots.filter((item) => item.kind === 'leader').length;
        if (roots.length === 1 && groups)  return Na__LeCfg__GetLabel('GroupPasted', 'Pasted group in the same place.');
        if (roots.length === 1 && texts)   return Na__LeCfg__GetLabel('TextPasted', 'Pasted text in the same place.');
        if (roots.length === 1 && shapes)  return Na__LeCfg__GetLabel('ShapePasted', 'Pasted vector in the same place.');
        if (roots.length === 1 && leaders) return Na__LeCfg__GetLabel('LeaderPasted', 'Pasted leader in the same place.');
        return Na__LeCfg__FormatLabel('SelectionPasted', 'Pasted {count} items in the same place.', { count : roots.length });
    }
    // ------------------------------------------------------------

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
        if (roots.length === 1 && roots[0].kind === 'leader')     return Na__LeCfg__GetLabel('MenuPasteLeader', 'Paste leader');
        return Na__LeCfg__GetLabel('MenuPasteSelection', 'Paste selection');
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Copy and Paste a Set
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Snapshot of Every Record a Set Holds, Each Once
    // ------------------------------------------------------------
    // expanded: the roots with every nested member (Na__LeGroup__Expand). What
    // Copy puts on the clipboard, and what a Ctrl-drag copy clones in place.
    // ------------------------------------------------------------
    function Na__LeClip__Entries(sheet, expanded) {
        const entries = [];
        const seen    = new Set();
        expanded.forEach((item) => {
            const key = item.kind + ':' + item.id;
            if (seen.has(key)) return;
            const snap = Na__LeClip__Snapshot(sheet, item);
            if (!snap) return;
            seen.add(key);
            entries.push(snap);
        });
        return entries;
    }
    // ------------------------------------------------------------

    function Na__LeClip__CopyItems(sheet, items, quiet) {
        const roots = Na__LeClip__Copyable(sheet, items);
        if (!sheet || !roots.length) return false;
        const expanded = Na__LeGroup__Expand(sheet, roots);
        const entries  = Na__LeClip__Entries(sheet, expanded);
        if (!entries.length) return false;
        const box = Na__LeGroup__ItemsBounds(sheet, expanded) || { X : 0, Y : 0, WidthMm : 0, HeightMm : 0 };
        Na__LeClip__HeldSet = {
            kind          : Na__LeClip__KIND_SET,
            roots         : roots.map((item) => ({ kind : item.kind, id : item.id })),
            entries       : entries,
            origin        : { x : box.X, y : box.Y },
            size          : { WidthMm : box.WidthMm, HeightMm : box.HeightMm },
            sourceSheetId : sheet.Sheet__Id,
            sourceLayers  : Na__LeClip__LayerList(sheet)                        // <-- So a paste on another sheet can find, or make, the same layers there
        };
        if (quiet !== true) Na__LeClip__Toast(Na__LeClip__ToastFor(roots));
        return true;
    }

    // HELPER FUNCTION | Put a Set's Leaves In, Silently Unless lastKey Names One
    // ------------------------------------------------------------
    // route (Na__LeClip__Route) says how each one's layer is chosen: on the
    // sheet it came from, every copy keeps its original's layer; on another,
    // the layer of the same name, made if missing (Na__LeClip__Landing).
    // ------------------------------------------------------------
    function Na__LeClip__InsertLeaves(sheet, entries, ids, dx, dy, lastKey, route) {
        let last = null;
        // Insert viewports first, so dimensions can point to their new ids.
        const ordered = entries.filter((entry) => entry.kind === 'viewport').concat(entries.filter((entry) => entry.kind !== 'viewport'));
        ordered.forEach((entry) => {
            if (entry.kind === 'viewport') {
                const record = Na__LeClip__Clone(entry.record);
                record.Viewport__FrameMm.X += dx;
                record.Viewport__FrameMm.Y += dy;
                record.Viewport__LayerId = Na__LeClip__Landing(sheet, record.Viewport__LayerId, null, route);
                record.Viewport__Locked = false;
                if (!Na__LeCfg__GetClipboardSetup().copySnapshot) record.Viewport__SnapshotAsset = null;
                const key = 'viewport:' + entry.id;
                const pasted = Na__LeModel__InsertViewport(sheet, record, lastKey == null || key !== lastKey);
                if (pasted) { ids.set(key, pasted.Viewport__Id); last = { kind : 'viewport', id : pasted.Viewport__Id }; }
            }
            if (entry.kind === 'dimension') {
                const record = Na__LeClip__Clone(entry.record);
                record.Dimension__StartXMm += dx; record.Dimension__EndXMm += dx;
                record.Dimension__StartYMm += dy; record.Dimension__EndYMm += dy;
                record.Dimension__LayerId = Na__LeClip__Landing(sheet, record.Dimension__LayerId, 'dimension', route);
                const host = record.Dimension__ViewportId;
                record.Dimension__ViewportId = ids.get('viewport:' + host)
                    || (route.same && Na__LeModel__GetViewportById(sheet, host) ? host : null);
                const key = 'dimension:' + entry.id;
                const pasted = Na__LeModel__InsertDimension(sheet, record, lastKey == null || key !== lastKey);
                if (pasted) { ids.set(key, pasted.Dimension__Id); last = { kind : 'dimension', id : pasted.Dimension__Id }; }
            }
            if (entry.kind === 'shape') {
                const record = Na__LeClip__Clone(entry.record);
                record.Shape__Points  = Na__LeShapeGeo__Translated(Na__LeShapeGeo__Points(record), dx, dy);
                record.Shape__LayerId = Na__LeClip__Landing(sheet, record.Shape__LayerId, Na__LeModel__ShapeLayerType(record), route);   // <-- Without a layer to follow, a measured room wants the Floor Areas layer, not the Vectors one
                const key    = 'shape:' + entry.id;
                const silent = lastKey == null || key !== lastKey;
                const pasted = Na__LeModel__InsertShape(sheet, record, silent);
                if (pasted) { ids.set(key, pasted.Shape__Id); last = { kind : 'shape', id : pasted.Shape__Id }; }
            }
            if (entry.kind === 'annotation') {
                const record = Na__LeClip__ShiftAnnotation(Na__LeClip__Clone(entry.record), dx, dy);
                record.Annotation__LayerId = Na__LeClip__Landing(sheet, record.Annotation__LayerId, 'annotation', route);
                const key    = 'annotation:' + entry.id;
                const silent = lastKey == null || key !== lastKey;
                const pasted = Na__LeModel__InsertAnnotation(sheet, record, silent);
                if (pasted) { ids.set(key, pasted.Annotation__Id); last = { kind : 'annotation', id : pasted.Annotation__Id }; }
            }
            if (entry.kind === 'leader') {
                const record = Na__LeClip__ShiftLeader(Na__LeClip__Clone(entry.record), dx, dy);
                record.Leader__LayerId = Na__LeClip__Landing(sheet, record.Leader__LayerId, 'annotation', route);
                const key    = 'leader:' + entry.id;
                const silent = lastKey == null || key !== lastKey;
                const pasted = Na__LeModel__InsertLeader(sheet, record, silent);
                if (pasted) { ids.set(key, pasted.Leader__Id); last = { kind : 'leader', id : pasted.Leader__Id }; }
            }
        });
        return last;
    }

    function Na__LeClip__InsertGroups(sheet, entries, ids, lastKey) {
        const pending = entries.filter((entry) => entry.kind === 'group').map((entry) => Na__LeClip__Clone(entry));
        let last = null;
        for (let guard = 0; guard < entries.length && pending.length; guard++) {
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
                const pasted = Na__LeModel__InsertGroup(sheet, { ...entry.record, Group__Members : members }, silent);
                if (pasted) { ids.set(key, pasted.Group__Id); last = { kind : 'group', id : pasted.Group__Id }; }
            });
            if (next.length === pending.length) break;
            pending.length = 0;
            next.forEach((entry) => pending.push(entry));
        }
        return last;
    }

    // FUNCTION | Put a Set Onto a Sheet as New Records (one undo step)
    // ------------------------------------------------------------
    // set: { roots, entries, origin, size } - the held clipboard set, or one
    // built elsewhere, such as a Scrapbook item (Na__LayoutEditor__Scrapbook__).
    // atMm is where the set's top-left corner goes, kept on the paper; without
    // it the set lands exactly where it came from. fanOut, when true, steps
    // that landing spot clear of a copy already sitting there - Duplicate
    // wants that (it is silent, so the step is the only sign it worked);
    // an ordinary paste does not (it always lands in place and says so with
    // a toast instead). The new roots are selected and returned.
    //
    // A set that brought its sheet's layers (sourceLayers - a copy does)
    // lands on the same layers by name on another sheet, any missing made in
    // the same place in the list, within the same undo step
    // (Na__LeClip__Landing). What lands on a reference layer is returned but
    // not selected, since the pointer cannot reach it. report, when given, is
    // filled with the layers made, switched on, found locked and found
    // reference: { made, shown, locked, reference }.
    // ------------------------------------------------------------
    function Na__LeClip__InsertSet(sheet, set, atMm, fanOut, report) {
        if (!sheet || !set || !Array.isArray(set.entries) || set.entries.length === 0) return null;
        const origin  = set.origin || { x : 0, y : 0 };
        const start   = atMm || { x : origin.x, y : origin.y };
        const spot    = !atMm && !fanOut ? { X : origin.x, Y : origin.y } : Na__LeClip__PlaceSet(sheet, origin, set.size, start, !!fanOut);
        const dx      = spot.X - origin.x;
        const dy      = spot.Y - origin.y;
        const ids     = new Map();
        const entries = set.entries;
        const route   = Na__LeClip__Route(sheet, set.sourceSheetId, set.sourceLayers);
        const leaf    = Na__LeClip__InsertLeaves(sheet, entries, ids, dx, dy, null, route);   // <-- All silent until one announce below, so groups - and any layer the paste brings - land in the same undo step
        Na__LeClip__InsertGroups(sheet, entries, ids, null);
        if (leaf && leaf.kind === 'shape')           Na__LeModel__UpdateShape(sheet, leaf.id, {}, false);
        else if (leaf && leaf.kind === 'annotation') Na__LeModel__UpdateAnnotation(sheet, leaf.id, {}, false);
        else if (leaf && leaf.kind === 'leader')     Na__LeModel__UpdateLeader(sheet, leaf.id, {}, false);
        else if (leaf && leaf.kind === 'dimension')  Na__LeModel__UpdateDimension(sheet, leaf.id, {}, false);
        else if (leaf && leaf.kind === 'viewport')   Na__LeModel__UpdateViewport(sheet, leaf.id, {}, false);
        // A mixed paste must repaint its frames as well as its markup. Every
        // record is already inserted, so this observes the same history state.
        const viewportId = entries.filter((entry) => entry.kind === 'viewport').map((entry) => ids.get('viewport:' + entry.id)).find(Boolean);
        if (viewportId && leaf && leaf.kind !== 'viewport') Na__LeModel__UpdateViewport(sheet, viewportId, {}, false);
        // A LAYER MADE OR SWITCHED ON is news to the Layers list and to the
        // paint order, which a vector's or a text's announcement never
        // redraws: 'layers' redraws both. Still the same history state.
        const restacked = route.report.made.concat(route.report.shown);
        if (restacked.length) Na__LeModel__UpdateLayer(sheet, restacked[0].Layer__Id, {}, false);
        if (report && typeof report === 'object') Object.assign(report, route.report);
        const landed = (set.roots || []).map((root) => {
            const id = ids.get(root.kind + ':' + root.id);
            return id ? { kind : root.kind, id : id } : null;
        }).filter(Boolean);
        const selected = landed.filter((item) => Na__LeModel__IsItemPickable(sheet, item));   // <-- What landed on a reference layer is seen, not picked
        if (selected.length === 1) Na__LeModel__SetSelection(selected[0]);
        else if (selected.length > 1 || landed.length) Na__LeModel__SetSelectionItems(selected);
        return landed.length ? landed : null;
    }

    // FUNCTION | Paste the Held Set (Ctrl+V or the menu) - Always In Place
    // ------------------------------------------------------------
    // No fan-out: a paste lands on top of the copy it came from (or at atMm,
    // when the menu gave an explicit spot), on this sheet or any other. A
    // toast says so, since landing exactly in place is otherwise invisible,
    // and names any layer the paste made, switched on, or could not use.
    // ------------------------------------------------------------
    function Na__LeClip__PasteSet(sheet, atMm) {
        if (!sheet || !Na__LeClip__HasSet()) return null;
        const roots  = Na__LeClip__HeldSet.roots || [];
        const report = {};
        const pasted = Na__LeClip__InsertSet(sheet, Na__LeClip__HeldSet, atMm, false, report);
        if (pasted) Na__LeClip__Toast([ Na__LeClip__PastedToastFor(roots) ].concat(Na__LeClip__LayerNotes(report)).join(' '));
        return pasted;
    }
    // ------------------------------------------------------------

    // FUNCTION | Duplicate the Selection in One Step (Ctrl+D) - Stepped Clear, No Toast
    // ------------------------------------------------------------
    // The clipboard is left holding whatever it held before. Duplicate keeps
    // the fan-out: with no toast of its own, the step is what tells you it
    // worked.
    // ------------------------------------------------------------
    function Na__LeClip__DuplicateItems(sheet, items) {
        const previous = Na__LeClip__HeldSet;
        if (!Na__LeClip__CopyItems(sheet, items, true)) return null;
        const pasted = Na__LeClip__InsertSet(sheet, Na__LeClip__HeldSet, null, true);
        Na__LeClip__HeldSet = previous;
        return pasted;
    }
    // ------------------------------------------------------------

    // FUNCTION | Clone Items Exactly Where They Are, Silently (a Ctrl-drag copy)
    // ------------------------------------------------------------
    // The records Duplicate would make - fresh ids, a group's members and a
    // dimension's viewport remapped, a viewport unlocked - landing exactly on
    // the originals and announcing nothing: the copy drag carries them off at
    // once, and its release is the one undo step
    // (Na__LayoutEditor__SheetTools__CopyDrag__). The clipboard and the
    // selection are left alone. Returns { roots, from, items } - the new roots
    // with from[i] the root roots[i] was cloned from, and every record put in,
    // so a copy called off can be taken back out - or null when nothing could
    // be cloned (and then nothing is left behind).
    // ------------------------------------------------------------
    function Na__LeClip__CloneInPlace(sheet, items) {
        const roots = Na__LeClip__Copyable(sheet, items);
        if (!sheet || !roots.length) return null;
        const entries = Na__LeClip__Entries(sheet, Na__LeGroup__Expand(sheet, roots));
        if (!entries.length) return null;
        const ids = new Map();
        Na__LeClip__InsertLeaves(sheet, entries, ids, 0, 0, null, Na__LeClip__Route(sheet, sheet.Sheet__Id, null));   // <-- No last key: every record goes in silently, each on its original's layer
        Na__LeClip__InsertGroups(sheet, entries, ids, null);
        const made = (item) => { const id = ids.get(item.kind + ':' + item.id); return id ? { kind : item.kind, id : id } : null; };
        const all  = entries.map(made).filter(Boolean);
        const from = roots.filter((root) => !!made(root));
        if (!from.length) {
            if (all.length) Na__LeModel__DeleteItems(sheet, all, true);          // <-- A set whose roots could not land is no copy at all
            return null;
        }
        return { roots : from.map(made), from : from.map((root) => ({ kind : root.kind, id : root.id })), items : all };
    }
    // ------------------------------------------------------------

    function Na__LeClip__UsesSet(items) {
        return Na__LeClip__Copyable(null, items).length > 0;
    }

    // Copy before removing anything. A group containing a locked member stays
    // intact; other unlocked roots in the selection may still be cut.
    function Na__LeClip__CutItems(sheet, items) {
        const roots = Na__LeClip__Copyable(sheet, items).filter((root) =>
            Na__LeGroup__Expand(sheet, [ root ]).every((item) => {
                const snap = Na__LeClip__Snapshot(sheet, item);
                if (!snap) return false;
                if (item.kind === 'group') return true;
                const prefix = item.kind.charAt(0).toUpperCase() + item.kind.slice(1);
                return !Na__LeModel__IsLayerLocked(sheet, snap.record[prefix + '__LayerId'])
                    && !(item.kind === 'viewport' && snap.record.Viewport__Locked === true);
            }));
        if (!roots.length || !Na__LeClip__CopyItems(sheet, roots, true)) return false;
        const removed = Na__LeModel__DeleteItems(sheet, Na__LeGroup__Expand(sheet, roots));
        if (removed) Na__LeClip__Toast(Na__LeCfg__FormatLabel('SelectionCut', 'Cut {count} items. Ctrl+V pastes them in place on this sheet or another.', { count : roots.length }));
        return removed > 0;
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    function Na__LeClip__RunKeyAction(action, editable) {
        const sheet = Na__LeModel__GetActiveSheet();
        if (!sheet || !editable) return false;
        const items = Na__LeModel__GetSelectionItems();
        if (action === 'Edit__Cut') return Na__LeClip__CutItems(sheet, items);
        if (action === 'Edit__Copy') {
            return Na__LeClip__CopyItems(sheet, items);
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
                if (Na__LeClip__HasSet()) Na__LeClip__PasteSet(sheet, null);
                else Na__LeClip__RunViewportKeyAction('Edit__Paste', true);
            }
        };
        const selected = Na__LeModel__GetSelectionItems();
        const kind = target && (target.kind || Na__LeClip__COPYABLE_KINDS.find((k) => target[k.charAt(0).toUpperCase() + k.slice(1) + '__Id']));
        const id = target && kind && (target.id || target[kind.charAt(0).toUpperCase() + kind.slice(1) + '__Id']);
        const items = selected.length > 1 ? selected : (id ? [ { kind, id } ] : []);
        if (!Na__LeClip__Copyable(sheet, items).length) return [ paste ];
        return [
            { label : label('MenuCutSelection', 'Cut selection'), onSelect : () => { Na__LeClip__CutItems(sheet, items); } },
            { label : label('MenuCopySelection', 'Copy selection'), onSelect : () => { Na__LeClip__CopyItems(sheet, items); } },
            { label : label('MenuDuplicateSelection', 'Duplicate selection'), onSelect : () => { Na__LeClip__DuplicateItems(sheet, items); } },
            paste
        ];
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
        Na__LeClip__CutItems,
        Na__LeClip__PasteSet,
        Na__LeClip__InsertSet,
        Na__LeClip__CloneInPlace,
        Na__LeClip__HasSet,
        Na__LeClip__RunKeyAction,
        Na__LeClip__MenuItems
    };

// endregion -------------------------------------------------------------------
