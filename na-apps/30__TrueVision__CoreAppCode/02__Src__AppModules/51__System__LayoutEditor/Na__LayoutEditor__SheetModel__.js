// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET MODEL
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetModel__.js
// NAMESPACE  : Na__LeModel
// MODULE     : Layout Editor - Sheet Model
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Own the sheet records, their layers, viewports, text and dimensions
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - The single owner of LayoutEditor__DrawingsData.__Sheets. Every other
//   module in this folder reads and writes sheets through here, and every
//   change is announced on one event so the surface and the panels redraw
//   from the records rather than from each other.
//
// - RECORDS (three-stage keys, plan section 5)
//     Sheet       Sheet__Id, Name, Order, PaperSize, Orientation,
//                 TitleBlockStyle, Fields {...}, Layers [], Viewports [],
//                 Annotations [], Dimensions [], Shapes [], Lineweights {ViewportPt, DimensionPt}
//     Layer       Layer__Id, Name, Type, Visible, Locked, Order
//     Viewport    Viewport__Id, LayerId, Name, Kind ('2d' | '3d'), SceneId,
//                 DrawingId, FrameMm {X, Y, WidthMm, HeightMm},
//                 ScaleDenominator, PanMm {X, Y}, ImageMm {WidthMm, HeightMm},
//                 ImageOffsetMm {X, Y}, Styles {...}, MarkupMode, Locked,
//                 SnapshotAsset {Asset__Path, Asset__Fingerprint, Asset__PixelWidth}
//     Annotation  Annotation__Id, LayerId, Text, PosXMm, PosYMm, SizeMm,
//                 FontWeight, Colour, Align, LeaderXMm, LeaderYMm
//     Dimension   Dimension__Id, LayerId, ViewportId, StartXMm, StartYMm,
//                 EndXMm, EndYMm, OffsetMm, TextSizeMm, Colour, Terminator,
//                 Precision, UnitsSuffix, OverrideText
//     Shape       Shape__Id, LayerId, Points [[x, y], ...], Closed, Stroked, StrokeColour,
//                 StrokePt, FillColour (null for none)
//   Paper coordinates are millimetres from the sheet's top-left, y down.
//
// - The active sheet and the selection are session state, held here so the
//   panels and the surface agree on them.
//
// INTEGRATION:
// - Loads from Na__DrawView__ProjectData__ on its events; Save goes through
//   Na__DrawData__Save (D08).
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__SheetModel__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.2.1
// - CreateShape and UpdateShape carry Shape__Stroked (the edges toggle).
//
// 10-Sep-2026 - Version 1.2.0
// - Vector shapes: CreateShape, UpdateShape, DeleteShape ('shapes' and 'shape' reasons). CreateDimension takes silent. UpdateSheet takes lineweights.
//
// 10-Sep-2026 - Version 1.1.0
// - Viewport__Locked patch key. A save announces 'saved' instead of 'loaded', so the selection and the undo history survive it.
// - RestoreSheets puts the browser draft back after a load.
//
// 10-Sep-2026 - Version 1.0.1
// - Record helpers, normalisers and the title block fields moved to Na__LayoutEditor__SheetRecords__.js (line budget).
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 5.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Drawings Block, Drawing Records and Scenes
    // ------------------------------------------------------------
    import {
        Na__DrawData__SHEETS_KEY,
        Na__DrawData__GetBlock,
        Na__DrawData__Save,
        Na__DrawData__LOADED_EVENT,
        Na__DrawData__CHANGED_EVENT
    } from '../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    import { Na__FpData__GetPlanById } from '../42__System__FloorPlanViews/Na__FloorPlan__ProjectJson__Data__.js';
    import { Na__ElevData__GetElevationById } from '../45__System__ElevationViews/Na__Elevation__ProjectJson__Data__.js';
    import { Na__PresentationMode__ProjectJson__GetActiveConfig } from '../21__System__PresentationMode/Na__PresentationMode__ProjectJson__SceneData.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Record Helpers and Scale
    // ------------------------------------------------------------
    import {
        Na__LeRec__KIND_2D,
        Na__LeRec__KIND_3D,
        Na__LeRec__LAYER_TYPES,
        Na__LeRec__STYLE_KEYS,
        Na__LeRec__NextId,
        Na__LeRec__Find,
        Na__LeRec__NormaliseLayer,
        Na__LeRec__NormaliseViewport,
        Na__LeRec__NormaliseAnnotation,
        Na__LeRec__NormaliseDimension,
        Na__LeRec__NormaliseSheet,
        Na__LeRec__DefaultLayerId,
        Na__LeRec__BuildFields,
        Na__LeRec__NormaliseShape
    } from './Na__LayoutEditor__SheetRecords__.js';
    import { Na__LeScale__Coerce } from './Na__LayoutEditor__ScaleManager__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Events, Kinds and Id Prefixes
    // ------------------------------------------------------------
    const Na__LeModel__CHANGED_EVENT   = 'na-layouteditor-sheets-changed';
    const Na__LeModel__KIND_2D         = Na__LeRec__KIND_2D;
    const Na__LeModel__KIND_3D         = Na__LeRec__KIND_3D;
    const Na__LeModel__LAYER_TYPES     = Na__LeRec__LAYER_TYPES;
    const Na__LeModel__SCENES_KEY      = 'PresentationMode__SavedCameraScenes__Scenes';
    const Na__LeModel__STYLE_KEYS      = Na__LeRec__STYLE_KEYS;
    // ------------------------------------------------------------

    // MODULE VARIABLES | Session State
    // ------------------------------------------------------------
    let Na__LeModel__ActiveSheetId = null;
    let Na__LeModel__Selection     = null;     // <-- { kind : 'viewport' | 'annotation' | 'dimension' | 'shape', id }
    let Na__LeModel__Dirty         = false;
    let Na__LeModel__Initialized   = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Announce a Change
    // ------------------------------------------------------------
    function Na__LeModel__Dispatch(reason, sheetId, itemId) {
        window.dispatchEvent(new CustomEvent(Na__LeModel__CHANGED_EVENT, {
            detail : { reason : reason || 'change', sheetId : sheetId || Na__LeModel__ActiveSheetId, itemId : itemId || null }
        }));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Touch: Mark Dirty and Announce
    // ------------------------------------------------------------
    function Na__LeModel__Touch(reason, sheetId, itemId) {
        Na__LeModel__Dirty = true;
        Na__LeModel__Dispatch(reason, sheetId, itemId);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Sheets Array in the Drawings Block (created on demand)
    // ------------------------------------------------------------
    function Na__LeModel__Array() {
        const block = Na__DrawData__GetBlock();
        if (!block) return [];
        if (!Array.isArray(block[Na__DrawData__SHEETS_KEY])) block[Na__DrawData__SHEETS_KEY] = [];
        return block[Na__DrawData__SHEETS_KEY];
    }
    // ------------------------------------------------------------


// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Sheets
// -----------------------------------------------------------------------------

    // FUNCTION | Every Sheet, Normalised and in Order
    // ------------------------------------------------------------
    function Na__LeModel__GetSheets() {
        const list = Na__LeModel__Array().filter((s) => s && typeof s === 'object' && typeof s.Sheet__Id === 'string');
        list.forEach(Na__LeRec__NormaliseSheet);
        return list.sort((a, b) => a.Sheet__Order - b.Sheet__Order);
    }
    // ------------------------------------------------------------


    // FUNCTION | One Sheet by Id (null when absent)
    // ------------------------------------------------------------
    function Na__LeModel__GetSheetById(sheetId) {
        return Na__LeRec__Find(Na__LeModel__GetSheets(), 'Sheet__Id', sheetId);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Sheet on Screen (null when in the 3D model tab)
    // ------------------------------------------------------------
    function Na__LeModel__GetActiveSheet() {
        return Na__LeModel__ActiveSheetId ? Na__LeModel__GetSheetById(Na__LeModel__ActiveSheetId) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Switch the Active Sheet (null = 3D model)
    // ------------------------------------------------------------
    function Na__LeModel__SetActiveSheetId(sheetId) {
        const next = (sheetId && Na__LeModel__GetSheetById(sheetId)) ? sheetId : null;
        if (next === Na__LeModel__ActiveSheetId) return next;
        Na__LeModel__ActiveSheetId = next;
        Na__LeModel__Selection     = null;
        Na__LeModel__Dispatch('active', next);
        return next;
    }
    // ------------------------------------------------------------


    // FUNCTION | Create a Sheet
    // ------------------------------------------------------------
    function Na__LeModel__CreateSheet(options) {
        const opts  = options || {};
        const list  = Na__LeModel__Array();
        const sheet = {
            Sheet__Id              : Na__LeRec__NextId(list, 'Sheet_', 'Sheet__Id'),
            Sheet__Name            : (typeof opts.name === 'string' && opts.name.trim()) ? opts.name.trim() : '',
            Sheet__Order           : list.length + 1,
            Sheet__PaperSize       : opts.paperSize || null,
            Sheet__Orientation     : opts.orientation || null,
            Sheet__TitleBlockStyle : opts.titleBlockStyle || null,
            Sheet__Fields          : {},
            Sheet__Layers          : [],
            Sheet__Viewports       : [],
            Sheet__Annotations     : [],
            Sheet__Dimensions      : [],
            Sheet__Shapes          : []
        };
        list.push(sheet);
        Na__LeRec__NormaliseSheet(sheet, list.length - 1);
        Na__LeModel__Touch('sheet-created', sheet.Sheet__Id);
        return sheet;
    }
    // ------------------------------------------------------------


    // FUNCTION | Duplicate a Sheet (deep copy, fresh id, assets dropped)
    // ------------------------------------------------------------
    function Na__LeModel__DuplicateSheet(sheetId) {
        const source = Na__LeModel__GetSheetById(sheetId);
        if (!source) return null;
        const list = Na__LeModel__Array();
        const copy = JSON.parse(JSON.stringify(source));
        copy.Sheet__Id    = Na__LeRec__NextId(list, 'Sheet_', 'Sheet__Id');
        copy.Sheet__Name  = source.Sheet__Name + ' copy';
        copy.Sheet__Order = list.length + 1;
        copy.Sheet__Viewports.forEach((v) => { v.Viewport__SnapshotAsset = null; });   // <-- Snapshots are keyed by viewport id
        list.push(copy);
        Na__LeModel__Touch('sheet-created', copy.Sheet__Id);
        return copy;
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete a Sheet
    // ------------------------------------------------------------
    function Na__LeModel__DeleteSheet(sheetId) {
        const list = Na__LeModel__Array();
        for (let i = 0; i < list.length; i++) {
            if (list[i] && list[i].Sheet__Id === sheetId) {
                list.splice(i, 1);
                list.forEach((s, k) => { s.Sheet__Order = k + 1; });
                if (Na__LeModel__ActiveSheetId === sheetId) { Na__LeModel__ActiveSheetId = null; Na__LeModel__Selection = null; }
                Na__LeModel__Touch('sheet-deleted', sheetId);
                return true;
            }
        }
        return false;
    }
    // ------------------------------------------------------------


    // FUNCTION | Rename, Re-Paper, Restyle or Reorder a Sheet
    // ------------------------------------------------------------
    function Na__LeModel__UpdateSheet(sheet, patch) {
        if (!sheet || !patch) return false;
        if (typeof patch.name === 'string' && patch.name.trim()) sheet.Sheet__Name = patch.name.trim();
        if (typeof patch.paperSize === 'string') sheet.Sheet__PaperSize = patch.paperSize;
        if (typeof patch.orientation === 'string') sheet.Sheet__Orientation = patch.orientation;
        if (typeof patch.titleBlockStyle === 'string') sheet.Sheet__TitleBlockStyle = patch.titleBlockStyle;
        if (patch.lineweights && typeof patch.lineweights === 'object') {
            const lw = sheet.Sheet__Lineweights || (sheet.Sheet__Lineweights = {});
            if (Number.isFinite(patch.lineweights.viewportPt))  lw.ViewportPt  = patch.lineweights.viewportPt;
            if (Number.isFinite(patch.lineweights.dimensionPt)) lw.DimensionPt = patch.lineweights.dimensionPt;
        }
        Na__LeRec__NormaliseSheet(sheet, sheet.Sheet__Order - 1);
        Na__LeModel__Touch('sheet-updated', sheet.Sheet__Id);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Move a Sheet to a New Position in the Tab Order
    // ------------------------------------------------------------
    function Na__LeModel__ReorderSheet(sheetId, newIndex) {
        const list = Na__LeModel__GetSheets();
        const from = list.findIndex((s) => s.Sheet__Id === sheetId);
        if (from === -1) return false;
        const [ moved ] = list.splice(from, 1);
        list.splice(Math.max(0, Math.min(newIndex, list.length)), 0, moved);
        list.forEach((s, k) => { s.Sheet__Order = k + 1; });
        Na__LeModel__Touch('sheet-reordered', sheetId);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Title Block Fields With Project Defaults Filled In
    // ------------------------------------------------------------
    function Na__LeModel__GetFields(sheet) {
        return Na__LeRec__BuildFields(sheet);
    }
    // ------------------------------------------------------------


    // FUNCTION | Set One Title Block Field on a Sheet (null restores the default)
    // ------------------------------------------------------------
    function Na__LeModel__SetField(sheet, key, value) {
        if (!sheet) return false;
        if (!sheet.Sheet__Fields) sheet.Sheet__Fields = {};
        if (value === null || value === undefined) delete sheet.Sheet__Fields['Sheet__Fields__' + key];
        else sheet.Sheet__Fields['Sheet__Fields__' + key] = String(value);
        Na__LeModel__Touch('fields', sheet.Sheet__Id);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Layers
// -----------------------------------------------------------------------------

    // FUNCTION | A Sheet's Layers, Frontmost Last in Paint Order
    // ------------------------------------------------------------
    function Na__LeModel__GetLayers(sheet) {
        return sheet ? sheet.Sheet__Layers.slice().sort((a, b) => a.Layer__Order - b.Layer__Order) : [];
    }
    // ------------------------------------------------------------


    // FUNCTION | The Layer New Items of a Type Land On
    // ------------------------------------------------------------
    function Na__LeModel__DefaultLayerId(sheet, type) {
        return Na__LeRec__DefaultLayerId(sheet, type);
    }
    // ------------------------------------------------------------


    // FUNCTION | One Layer by Id
    // ------------------------------------------------------------
    function Na__LeModel__GetLayerById(sheet, layerId) {
        return sheet ? Na__LeRec__Find(sheet.Sheet__Layers, 'Layer__Id', layerId) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Add a Layer (on top)
    // ------------------------------------------------------------
    function Na__LeModel__CreateLayer(sheet, options) {
        if (!sheet) return null;
        const opts  = options || {};
        const layer = Na__LeRec__NormaliseLayer({
            Layer__Id    : Na__LeRec__NextId(sheet.Sheet__Layers, 'Layer_', 'Layer__Id'),
            Layer__Name  : opts.name,
            Layer__Type  : opts.type,
            Layer__Order : sheet.Sheet__Layers.length + 1
        }, sheet.Sheet__Layers.length);
        sheet.Sheet__Layers.push(layer);
        Na__LeModel__Touch('layers', sheet.Sheet__Id, layer.Layer__Id);
        return layer;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remove a Layer, Moving Its Items to the Default of Their Type
    // ------------------------------------------------------------
    function Na__LeModel__DeleteLayer(sheet, layerId) {
        if (!sheet || sheet.Sheet__Layers.length <= 1) return false;
        const index = sheet.Sheet__Layers.findIndex((l) => l.Layer__Id === layerId);
        if (index === -1) return false;
        sheet.Sheet__Layers.splice(index, 1);
        sheet.Sheet__Layers.forEach((l, k) => { l.Layer__Order = k + 1; });
        sheet.Sheet__Viewports.forEach((v)   => { if (v.Viewport__LayerId   === layerId) v.Viewport__LayerId   = Na__LeModel__DefaultLayerId(sheet, 'viewport'); });
        sheet.Sheet__Annotations.forEach((a) => { if (a.Annotation__LayerId === layerId) a.Annotation__LayerId = Na__LeModel__DefaultLayerId(sheet, 'annotation'); });
        sheet.Sheet__Dimensions.forEach((d)  => { if (d.Dimension__LayerId  === layerId) d.Dimension__LayerId  = Na__LeModel__DefaultLayerId(sheet, 'dimension'); });
        Na__LeModel__Touch('layers', sheet.Sheet__Id, layerId);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Change a Layer's Name, Type, Visibility or Lock
    // ------------------------------------------------------------
    function Na__LeModel__UpdateLayer(sheet, layerId, patch) {
        const layer = Na__LeModel__GetLayerById(sheet, layerId);
        if (!layer || !patch) return false;
        if (typeof patch.name === 'string' && patch.name.trim()) layer.Layer__Name = patch.name.trim();
        if (Na__LeModel__LAYER_TYPES.indexOf(patch.type) !== -1) layer.Layer__Type = patch.type;
        if (typeof patch.visible === 'boolean') layer.Layer__Visible = patch.visible;
        if (typeof patch.locked  === 'boolean') layer.Layer__Locked  = patch.locked;
        Na__LeModel__Touch('layers', sheet.Sheet__Id, layerId);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Move a Layer in the Stack (index 0 = bottom)
    // ------------------------------------------------------------
    function Na__LeModel__ReorderLayer(sheet, layerId, newIndex) {
        if (!sheet) return false;
        const list = Na__LeModel__GetLayers(sheet);
        const from = list.findIndex((l) => l.Layer__Id === layerId);
        if (from === -1) return false;
        const [ moved ] = list.splice(from, 1);
        list.splice(Math.max(0, Math.min(newIndex, list.length)), 0, moved);
        list.forEach((l, k) => { l.Layer__Order = k + 1; });
        Na__LeModel__Touch('layers', sheet.Sheet__Id, layerId);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is an Item's Layer Visible / Editable?
    // ------------------------------------------------------------
    function Na__LeModel__IsLayerVisible(sheet, layerId) {
        const layer = Na__LeModel__GetLayerById(sheet, layerId);
        return !layer || layer.Layer__Visible !== false;
    }
    function Na__LeModel__IsLayerLocked(sheet, layerId) {
        const layer = Na__LeModel__GetLayerById(sheet, layerId);
        return !!(layer && layer.Layer__Locked === true);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Viewports
// -----------------------------------------------------------------------------

    // FUNCTION | A Sheet's Viewports
    // ------------------------------------------------------------
    function Na__LeModel__GetViewports(sheet) {
        return sheet ? sheet.Sheet__Viewports : [];
    }
    // ------------------------------------------------------------


    // FUNCTION | One Viewport by Id
    // ------------------------------------------------------------
    function Na__LeModel__GetViewportById(sheet, viewportId) {
        return sheet ? Na__LeRec__Find(sheet.Sheet__Viewports, 'Viewport__Id', viewportId) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Add a Viewport
    // ------------------------------------------------------------
    // options: { kind, sceneId, drawingId, name, rect, scaleDenominator }
    // ------------------------------------------------------------
    function Na__LeModel__CreateViewport(sheet, options) {
        if (!sheet) return null;
        const opts = options || {};
        const viewport = Na__LeRec__NormaliseViewport({
            Viewport__Id               : Na__LeRec__NextId(sheet.Sheet__Viewports, 'Viewport_', 'Viewport__Id'),
            Viewport__Kind             : opts.kind,
            Viewport__SceneId          : opts.sceneId || null,
            Viewport__DrawingId        : opts.drawingId || null,
            Viewport__Name             : opts.name || '',
            Viewport__FrameMm          : opts.rect || null,
            Viewport__ScaleDenominator : opts.scaleDenominator
        }, Na__LeModel__DefaultLayerId(sheet, 'viewport'));
        sheet.Sheet__Viewports.push(viewport);
        Na__LeModel__Touch('viewports', sheet.Sheet__Id, viewport.Viewport__Id);
        return viewport;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remove a Viewport and the Sheet Dimensions Measuring Through It
    // ------------------------------------------------------------
    function Na__LeModel__DeleteViewport(sheet, viewportId) {
        if (!sheet) return false;
        const index = sheet.Sheet__Viewports.findIndex((v) => v.Viewport__Id === viewportId);
        if (index === -1) return false;
        sheet.Sheet__Viewports.splice(index, 1);
        sheet.Sheet__Dimensions.forEach((d) => { if (d.Dimension__ViewportId === viewportId) d.Dimension__ViewportId = null; });
        if (Na__LeModel__Selection && Na__LeModel__Selection.id === viewportId) Na__LeModel__Selection = null;
        Na__LeModel__Touch('viewports', sheet.Sheet__Id, viewportId);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Change a Viewport (any subset of its fields)
    // ------------------------------------------------------------
    // patch: { rect, scaleDenominator, pan, imageMm, imageOffset, styles, markupMode,
    //          name, layerId, sceneId, drawingId, kind, showScaleLabel, snapshotAsset }
    // silent: true skips the change event (live drags announce on release).
    // ------------------------------------------------------------
    function Na__LeModel__UpdateViewport(sheet, viewportId, patch, silent) {
        const viewport = Na__LeModel__GetViewportById(sheet, viewportId);
        if (!viewport || !patch) return false;

        if (patch.rect)      viewport.Viewport__FrameMm = Object.assign({}, viewport.Viewport__FrameMm, patch.rect);
        if (patch.pan)       viewport.Viewport__PanMm   = Object.assign({}, viewport.Viewport__PanMm,   patch.pan);
        if (patch.imageMm)   viewport.Viewport__ImageMm = Object.assign({}, viewport.Viewport__ImageMm, patch.imageMm);
        if (patch.imageOffset) viewport.Viewport__ImageOffsetMm = Object.assign({}, viewport.Viewport__ImageOffsetMm, patch.imageOffset);
        if (patch.styles) {
            Na__LeModel__STYLE_KEYS.forEach((key) => { if (typeof patch.styles[key] === 'boolean') viewport.Viewport__Styles[key] = patch.styles[key]; });
        }
        if (patch.scaleDenominator !== undefined) viewport.Viewport__ScaleDenominator = Na__LeScale__Coerce(patch.scaleDenominator);
        if (patch.markupMode === 'scene' || patch.markupMode === 'sheet') viewport.Viewport__MarkupMode = patch.markupMode;
        if (typeof patch.name === 'string') viewport.Viewport__Name = patch.name;
        if (typeof patch.layerId === 'string') viewport.Viewport__LayerId = patch.layerId;
        if (patch.sceneId !== undefined)   viewport.Viewport__SceneId   = patch.sceneId;
        if (patch.drawingId !== undefined) viewport.Viewport__DrawingId = patch.drawingId;
        if (patch.kind === Na__LeModel__KIND_2D || patch.kind === Na__LeModel__KIND_3D) viewport.Viewport__Kind = patch.kind;
        if (typeof patch.showScaleLabel === 'boolean') viewport.Viewport__ShowScaleLabel = patch.showScaleLabel;
        if (typeof patch.locked === 'boolean') viewport.Viewport__Locked = patch.locked;
        if (patch.snapshotAsset !== undefined) viewport.Viewport__SnapshotAsset = patch.snapshotAsset;

        Na__LeRec__NormaliseViewport(viewport, viewport.Viewport__LayerId);
        if (silent) { Na__LeModel__Dirty = true; return true; }
        Na__LeModel__Touch('viewport', sheet.Sheet__Id, viewportId);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Viewport Shows: the Scene and, for 2D, the Drawing Record
    // ------------------------------------------------------------
    // Returns { kind, scene, plan, elevation, label } with nulls where the
    // link is dangling, so a viewport whose scene was deleted still draws
    // its frame and says so.
    // ------------------------------------------------------------
    function Na__LeModel__ResolveViewportSource(viewport) {
        const config = Na__PresentationMode__ProjectJson__GetActiveConfig();
        const scenes = (config && Array.isArray(config[Na__LeModel__SCENES_KEY])) ? config[Na__LeModel__SCENES_KEY] : [];
        const scene  = viewport.Viewport__SceneId ? (scenes.find((s) => s && s.PresentationMode__Scene__Id === viewport.Viewport__SceneId) || null) : null;

        let plan = null, elevation = null;
        if (viewport.Viewport__Kind === Na__LeModel__KIND_2D) {
            plan      = viewport.Viewport__DrawingId ? Na__FpData__GetPlanById(null, viewport.Viewport__DrawingId) : null;
            elevation = (!plan && viewport.Viewport__DrawingId) ? Na__ElevData__GetElevationById(null, viewport.Viewport__DrawingId) : null;
            if (!plan && !elevation && scene) {
                if (scene.PresentationMode__Scene__FloorPlanId)  plan      = Na__FpData__GetPlanById(null, scene.PresentationMode__Scene__FloorPlanId);
                if (scene.PresentationMode__Scene__ElevationId)  elevation = Na__ElevData__GetElevationById(null, scene.PresentationMode__Scene__ElevationId);
            }
        }

        const label = viewport.Viewport__Name
            || (plan && plan.FloorPlan__Name)
            || (elevation && elevation.Elevation__Name)
            || (scene && scene.PresentationMode__Scene__Name)
            || 'Viewport';

        return { kind : viewport.Viewport__Kind, scene : scene, plan : plan, elevation : elevation, label : label };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Sheet Text and Dimensions
// -----------------------------------------------------------------------------

    // FUNCTION | A Sheet's Annotations and Dimensions
    // ------------------------------------------------------------
    function Na__LeModel__GetAnnotations(sheet) { return sheet ? sheet.Sheet__Annotations : []; }
    function Na__LeModel__GetDimensions(sheet)  { return sheet ? sheet.Sheet__Dimensions  : []; }
    // ------------------------------------------------------------


    // FUNCTION | Add a Text Item at a Paper Point
    // ------------------------------------------------------------
    function Na__LeModel__CreateAnnotation(sheet, posXMm, posYMm, options) {
        if (!sheet) return null;
        const opts = options || {};
        const item = Na__LeRec__NormaliseAnnotation({
            Annotation__Id         : Na__LeRec__NextId(sheet.Sheet__Annotations, 'Text_', 'Annotation__Id'),
            Annotation__Text       : opts.text,
            Annotation__PosXMm     : posXMm,
            Annotation__PosYMm     : posYMm,
            Annotation__SizeMm     : opts.sizeMm,
            Annotation__FontWeight : opts.fontWeight,
            Annotation__Colour     : opts.colour,
            Annotation__Align      : opts.align,
            Annotation__LeaderXMm  : Number.isFinite(opts.leaderXMm) ? opts.leaderXMm : null,
            Annotation__LeaderYMm  : Number.isFinite(opts.leaderYMm) ? opts.leaderYMm : null,
            Annotation__LayerId    : opts.layerId
        }, Na__LeModel__DefaultLayerId(sheet, 'annotation'));
        sheet.Sheet__Annotations.push(item);
        Na__LeModel__Touch('annotations', sheet.Sheet__Id, item.Annotation__Id);
        return item;
    }
    // ------------------------------------------------------------


    // FUNCTION | Change or Remove a Text Item
    // ------------------------------------------------------------
    function Na__LeModel__UpdateAnnotation(sheet, itemId, patch, silent) {
        const item = sheet ? Na__LeRec__Find(sheet.Sheet__Annotations, 'Annotation__Id', itemId) : null;
        if (!item || !patch) return false;
        if (typeof patch.text === 'string') item.Annotation__Text = patch.text;
        if (Number.isFinite(patch.posXMm)) item.Annotation__PosXMm = patch.posXMm;
        if (Number.isFinite(patch.posYMm)) item.Annotation__PosYMm = patch.posYMm;
        if (Number.isFinite(patch.sizeMm)) item.Annotation__SizeMm = patch.sizeMm;
        if (Number.isFinite(patch.fontWeight)) item.Annotation__FontWeight = patch.fontWeight;
        if (typeof patch.colour === 'string') item.Annotation__Colour = patch.colour;
        if (typeof patch.align === 'string') item.Annotation__Align = patch.align;
        if (patch.leaderXMm !== undefined) item.Annotation__LeaderXMm = Number.isFinite(patch.leaderXMm) ? patch.leaderXMm : null;
        if (patch.leaderYMm !== undefined) item.Annotation__LeaderYMm = Number.isFinite(patch.leaderYMm) ? patch.leaderYMm : null;
        if (typeof patch.layerId === 'string') item.Annotation__LayerId = patch.layerId;
        Na__LeRec__NormaliseAnnotation(item, item.Annotation__LayerId);
        if (silent) { Na__LeModel__Dirty = true; return true; }
        Na__LeModel__Touch('annotation', sheet.Sheet__Id, itemId);
        return true;
    }
    function Na__LeModel__DeleteAnnotation(sheet, itemId) {
        if (!sheet) return false;
        const index = sheet.Sheet__Annotations.findIndex((a) => a.Annotation__Id === itemId);
        if (index === -1) return false;
        sheet.Sheet__Annotations.splice(index, 1);
        if (Na__LeModel__Selection && Na__LeModel__Selection.id === itemId) Na__LeModel__Selection = null;
        Na__LeModel__Touch('annotations', sheet.Sheet__Id, itemId);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Add a Dimension Between Two Paper Points
    // ------------------------------------------------------------
    function Na__LeModel__CreateDimension(sheet, start, end, options) {
        if (!sheet || !start || !end) return null;
        const opts = options || {};
        const item = Na__LeRec__NormaliseDimension({
            Dimension__Id           : Na__LeRec__NextId(sheet.Sheet__Dimensions, 'Dim_', 'Dimension__Id'),
            Dimension__ViewportId   : opts.viewportId || null,
            Dimension__StartXMm     : start.x, Dimension__StartYMm : start.y,
            Dimension__EndXMm       : end.x,   Dimension__EndYMm   : end.y,
            Dimension__OffsetMm     : opts.offsetMm,
            Dimension__TextSizeMm   : opts.textSizeMm,
            Dimension__Colour       : opts.colour,
            Dimension__Terminator   : opts.terminator,
            Dimension__Precision    : opts.precision,
            Dimension__UnitsSuffix  : opts.unitsSuffix,
            Dimension__OverrideText : (typeof opts.overrideText === 'string') ? opts.overrideText : null,
            Dimension__LayerId      : opts.layerId
        }, Na__LeModel__DefaultLayerId(sheet, 'dimension'));
        sheet.Sheet__Dimensions.push(item);
        if (opts.silent) Na__LeModel__Dirty = true; else Na__LeModel__Touch('dimensions', sheet.Sheet__Id, item.Dimension__Id);   // <-- The dimension tool announces once, on the third click
        return item;
    }
    // ------------------------------------------------------------


    // FUNCTION | Change or Remove a Dimension
    // ------------------------------------------------------------
    function Na__LeModel__UpdateDimension(sheet, itemId, patch, silent) {
        const item = sheet ? Na__LeRec__Find(sheet.Sheet__Dimensions, 'Dimension__Id', itemId) : null;
        if (!item || !patch) return false;
        [ 'StartXMm', 'StartYMm', 'EndXMm', 'EndYMm', 'OffsetMm', 'TextSizeMm', 'Precision' ].forEach((key) => {
            const name = key.charAt(0).toLowerCase() + key.slice(1);
            if (Number.isFinite(patch[name])) item['Dimension__' + key] = patch[name];
        });
        if (typeof patch.colour === 'string') item.Dimension__Colour = patch.colour;
        if (typeof patch.terminator === 'string') item.Dimension__Terminator = patch.terminator;
        if (typeof patch.unitsSuffix === 'string') item.Dimension__UnitsSuffix = patch.unitsSuffix;
        if (patch.overrideText !== undefined) item.Dimension__OverrideText = (typeof patch.overrideText === 'string' && patch.overrideText.trim()) ? patch.overrideText : null;
        if (patch.viewportId !== undefined) item.Dimension__ViewportId = patch.viewportId;
        if (typeof patch.layerId === 'string') item.Dimension__LayerId = patch.layerId;
        Na__LeRec__NormaliseDimension(item, item.Dimension__LayerId);
        if (silent) { Na__LeModel__Dirty = true; return true; }
        Na__LeModel__Touch('dimension', sheet.Sheet__Id, itemId);
        return true;
    }
    function Na__LeModel__DeleteDimension(sheet, itemId) {
        if (!sheet) return false;
        const index = sheet.Sheet__Dimensions.findIndex((d) => d.Dimension__Id === itemId);
        if (index === -1) return false;
        sheet.Sheet__Dimensions.splice(index, 1);
        if (Na__LeModel__Selection && Na__LeModel__Selection.id === itemId) Na__LeModel__Selection = null;
        Na__LeModel__Touch('dimensions', sheet.Sheet__Id, itemId);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Create, Update and Delete a Vector Shape
    // ------------------------------------------------------------
    // points: [[x, y], ...] paper mm. options: { strokeColour, strokePt,
    // fillColour, closed, stroked, layerId, silent }. A sheet without a
    // vector layer gets one the first time a shape lands. Edges and fill
    // are either-or at the least: the normaliser puts the edges back on a
    // shape that would otherwise have nothing to show.
    // ------------------------------------------------------------
    function Na__LeModel__CreateShape(sheet, points, options) {
        if (!sheet || !Array.isArray(points)) return null;
        const opts = options || {};
        let layerId = opts.layerId || null;
        if (!layerId) {
            const layer = sheet.Sheet__Layers.find((l) => l.Layer__Type === 'vector') || Na__LeModel__CreateLayer(sheet, { name : 'Vectors', type : 'vector' });
            layerId = layer ? layer.Layer__Id : Na__LeModel__DefaultLayerId(sheet, 'vector');
        }
        const item = Na__LeRec__NormaliseShape({
            Shape__Id           : Na__LeRec__NextId(sheet.Sheet__Shapes, 'Shape_', 'Shape__Id'),
            Shape__LayerId      : layerId,
            Shape__Points       : points.map((p) => [ p[0], p[1] ]),
            Shape__Closed       : opts.closed === true,
            Shape__StrokeColour : opts.strokeColour,
            Shape__StrokePt     : opts.strokePt,
            Shape__FillColour   : (typeof opts.fillColour === 'string') ? opts.fillColour : null,
            Shape__Stroked      : opts.stroked !== false
        }, layerId);
        sheet.Sheet__Shapes.push(item);
        if (opts.silent) Na__LeModel__Dirty = true; else Na__LeModel__Touch('shapes', sheet.Sheet__Id, item.Shape__Id);   // <-- The draw tool announces once, on finishing
        return item;
    }
    function Na__LeModel__UpdateShape(sheet, itemId, patch, silent) {
        const item = sheet ? Na__LeRec__Find(sheet.Sheet__Shapes, 'Shape__Id', itemId) : null;
        if (!item || !patch) return false;
        if (Array.isArray(patch.points)) item.Shape__Points = patch.points.map((p) => [ p[0], p[1] ]);
        if (typeof patch.closed === 'boolean') item.Shape__Closed = patch.closed;
        if (typeof patch.strokeColour === 'string') item.Shape__StrokeColour = patch.strokeColour;
        if (Number.isFinite(patch.strokePt)) item.Shape__StrokePt = patch.strokePt;
        if (patch.fillColour !== undefined) item.Shape__FillColour = (typeof patch.fillColour === 'string') ? patch.fillColour : null;
        if (typeof patch.stroked === 'boolean') item.Shape__Stroked = patch.stroked;
        if (typeof patch.layerId === 'string') item.Shape__LayerId = patch.layerId;
        Na__LeRec__NormaliseShape(item, item.Shape__LayerId);
        if (silent) { Na__LeModel__Dirty = true; return true; }
        Na__LeModel__Touch('shape', sheet.Sheet__Id, itemId);
        return true;
    }
    function Na__LeModel__DeleteShape(sheet, itemId) {
        if (!sheet) return false;
        const index = sheet.Sheet__Shapes.findIndex((sh) => sh.Shape__Id === itemId);
        if (index === -1) return false;
        sheet.Sheet__Shapes.splice(index, 1);
        if (Na__LeModel__Selection && Na__LeModel__Selection.id === itemId) Na__LeModel__Selection = null;
        Na__LeModel__Touch('shapes', sheet.Sheet__Id, itemId);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Selection, Persistence and Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Select One Item on the Sheet (null clears)
    // ------------------------------------------------------------
    function Na__LeModel__SetSelection(selection) {
        const next = (selection && selection.kind && selection.id) ? { kind : selection.kind, id : selection.id } : null;
        const same = (!!next === !!Na__LeModel__Selection) && (!next || (next.kind === Na__LeModel__Selection.kind && next.id === Na__LeModel__Selection.id));
        Na__LeModel__Selection = next;
        if (!same) Na__LeModel__Dispatch('selection', Na__LeModel__ActiveSheetId, next ? next.id : null);
        return next;
    }
    function Na__LeModel__GetSelection() { return Na__LeModel__Selection; }
    // ------------------------------------------------------------


    // FUNCTION | The Selected Viewport Record (null when the selection is something else)
    // ------------------------------------------------------------
    function Na__LeModel__GetSelectedViewport() {
        const sheet = Na__LeModel__GetActiveSheet();
        if (!sheet || !Na__LeModel__Selection || Na__LeModel__Selection.kind !== 'viewport') return null;
        return Na__LeModel__GetViewportById(sheet, Na__LeModel__Selection.id);
    }
    // ------------------------------------------------------------


    // FUNCTION | Unsaved Changes?
    // ------------------------------------------------------------
    function Na__LeModel__IsDirty() { return Na__LeModel__Dirty; }
    function Na__LeModel__MarkDirty() { Na__LeModel__Dirty = true; }
    // ------------------------------------------------------------


    // FUNCTION | Put a Whole Sheet List Back (the browser draft after a load)
    // ------------------------------------------------------------
    // Replaces the live array's contents in place so the drawings block
    // still owns it, normalises every record, keeps the active sheet when
    // it survives, marks the model dirty and announces a load.
    // ------------------------------------------------------------
    function Na__LeModel__RestoreSheets(records) {
        if (!Array.isArray(records)) return false;
        const live = Na__LeModel__Array();
        live.length = 0;
        records.forEach((record) => { if (record && typeof record === 'object') live.push(JSON.parse(JSON.stringify(record))); });
        Na__LeModel__GetSheets();                                                // <-- Normalises what arrived
        if (Na__LeModel__ActiveSheetId && !Na__LeModel__GetSheetById(Na__LeModel__ActiveSheetId)) Na__LeModel__ActiveSheetId = null;
        Na__LeModel__Selection = null;
        Na__LeModel__Dirty = true;
        Na__LeModel__Dispatch('loaded', Na__LeModel__ActiveSheetId);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Save the Drawings Block (sheets ride with plans and elevations)
    // ------------------------------------------------------------
    async function Na__LeModel__Save(showToast) {
        const saved = await Na__DrawData__Save(showToast);
        if (saved) Na__LeModel__Dirty = false;
        return saved;
    }
    // ------------------------------------------------------------


    // FUNCTION | Initialize: Follow the Drawings Block Across Project Loads
    // ------------------------------------------------------------
    function Na__LeModel__Initialize() {
        if (Na__LeModel__Initialized) return true;
        Na__LeModel__Initialized = true;
        const reload = (event) => {
            const saved = !!(event && event.detail && event.detail.reason === 'saved');
            Na__LeModel__Dirty = false;
            if (Na__LeModel__ActiveSheetId && !Na__LeModel__GetSheetById(Na__LeModel__ActiveSheetId)) Na__LeModel__ActiveSheetId = null;
            if (saved) { Na__LeModel__Dispatch('saved', Na__LeModel__ActiveSheetId); return; }   // <-- The same records, now on disk: selection and undo history stay
            Na__LeModel__Selection = null;
            Na__LeModel__Dispatch('loaded', Na__LeModel__ActiveSheetId);
        };
        window.addEventListener(Na__DrawData__LOADED_EVENT,  reload);
        window.addEventListener(Na__DrawData__CHANGED_EVENT, reload);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Sheet Model API
    // ------------------------------------------------------------
    export {
        Na__LeModel__CHANGED_EVENT,
        Na__LeModel__KIND_2D,
        Na__LeModel__KIND_3D,
        Na__LeModel__LAYER_TYPES,
        Na__LeModel__Initialize,
        Na__LeModel__GetSheets,
        Na__LeModel__GetSheetById,
        Na__LeModel__GetActiveSheet,
        Na__LeModel__SetActiveSheetId,
        Na__LeModel__CreateSheet,
        Na__LeModel__DuplicateSheet,
        Na__LeModel__DeleteSheet,
        Na__LeModel__UpdateSheet,
        Na__LeModel__ReorderSheet,
        Na__LeModel__GetFields,
        Na__LeModel__SetField,
        Na__LeModel__GetLayers,
        Na__LeModel__GetLayerById,
        Na__LeModel__DefaultLayerId,
        Na__LeModel__CreateLayer,
        Na__LeModel__DeleteLayer,
        Na__LeModel__UpdateLayer,
        Na__LeModel__ReorderLayer,
        Na__LeModel__IsLayerVisible,
        Na__LeModel__IsLayerLocked,
        Na__LeModel__GetViewports,
        Na__LeModel__GetViewportById,
        Na__LeModel__CreateViewport,
        Na__LeModel__DeleteViewport,
        Na__LeModel__UpdateViewport,
        Na__LeModel__ResolveViewportSource,
        Na__LeModel__GetAnnotations,
        Na__LeModel__GetDimensions,
        Na__LeModel__CreateAnnotation,
        Na__LeModel__UpdateAnnotation,
        Na__LeModel__DeleteAnnotation,
        Na__LeModel__CreateDimension,
        Na__LeModel__UpdateDimension,
        Na__LeModel__DeleteDimension,
        Na__LeModel__CreateShape,
        Na__LeModel__UpdateShape,
        Na__LeModel__DeleteShape,
        Na__LeModel__SetSelection,
        Na__LeModel__GetSelection,
        Na__LeModel__GetSelectedViewport,
        Na__LeModel__IsDirty,
        Na__LeModel__MarkDirty,
        Na__LeModel__RestoreSheets,
        Na__LeModel__Save
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
