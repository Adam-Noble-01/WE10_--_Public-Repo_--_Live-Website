// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET MODEL - SHAPES
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetModel__Shapes__.js
// NAMESPACE  : Na__LeModel
// MODULE     : Layout Editor - Sheet Model - Shapes
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : A sheet's vector shapes: find, add, paste, change and remove them
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - GetShapeById, CreateShape from points and options, InsertShape for a
//   complete record (a paste or a duplicate), UpdateShape and DeleteShape.
// - A sheet without a vector layer gets one the first time a shape lands.
// - The silent paths set the dirty flag through the State unit's
//   AssignDirty (an imported let cannot be assigned).
//
// INTEGRATION:
// - Imports Na__LayoutEditor__SheetModel__State__,
//   Na__LayoutEditor__SheetModel__Layers__ (GetLayerById, DefaultLayerId,
//   CreateLayer) and Na__LayoutEditor__SheetModel__Groups__ (PruneGroups,
//   after a shape is deleted).
// - Na__LayoutEditor__SheetModel__ re-exports this unit's API. Every other
//   module imports Na__LayoutEditor__SheetModel__.js, never this unit.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the ValeVision3D v2.47.0 split of the same module (same unit, same functions)
// - Parity        : verbatim (moved code)
// - Divergences   : header; CreateShape's comment also names the gradient and dash options (the code matches the ValeVision3D unit).
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.2.1
// - A Floor Areas or Vectors layer a paste has to make goes straight over the
//   frontmost drawing (LayerIndexAboveDrawings) instead of to the bottom of the
//   list, which is now the back of the paint order.
//
// 21-Sep-2026 - Version 1.2.0
// - Floor areas. CreateShape takes `area` (the Shape__Area block) and
//   UpdateShape takes it as a patch key, MERGED so a panel that sets one field
//   does not take the other five off the room; null makes it a plain vector
//   again. ShapeLayerType and ShapeLayerId are the one rule for which layer a
//   shape lands on - a measured room on the Floor Areas layer, every other
//   vector on the Vectors layer - and both CreateShape and InsertShape ask it,
//   so a paste, a duplicate or a scrapbook drop can no longer pull a room onto
//   the Vectors layer.
//
// 21-Sep-2026 - Version 1.1.0
// - UpdateShape takes `qr`: the Shape__Qr block, replaced whole rather than
//   merged, with null taking the code off the shape. What lets the parametric
//   scrapbook's Project Portal element resize its code in place, one record,
//   without the box having to be deleted and drawn again.
//
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__SheetModel__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Record Helpers
    // ------------------------------------------------------------
    import {
        Na__LeRec__NextId,
        Na__LeRec__Find,
        Na__LeRec__NormaliseShape
    } from './Na__LayoutEditor__SheetRecords__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Sheet Model State, Layers and Groups
    // ------------------------------------------------------------
    import { Na__LeModel__Touch, Na__LeModel__Unselect, Na__LeModel__AssignDirty } from './Na__LayoutEditor__SheetModel__State__.js';
    import { Na__LeModel__GetLayerById, Na__LeModel__DefaultLayerId, Na__LeModel__CreateLayer, Na__LeModel__LayerIndexAboveDrawings } from './Na__LayoutEditor__SheetModel__Layers__.js';
    import { Na__LeModel__PruneGroups } from './Na__LayoutEditor__SheetModel__Groups__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Vector Shapes
// -----------------------------------------------------------------------------

    // FUNCTION | One Vector Shape by Id
    // ------------------------------------------------------------
    function Na__LeModel__GetShapeById(sheet, itemId) {
        return sheet ? Na__LeRec__Find(sheet.Sheet__Shapes, 'Shape__Id', itemId) : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Which Kind of Layer a Shape Belongs On
    // ------------------------------------------------------------
    // A measured room belongs on the Floor Areas layer and every other vector
    // on the Vectors layer. Asked by the two ways a shape reaches a sheet, so
    // a room pasted, duplicated or dropped from a scrapbook cannot be pulled
    // onto the Vectors layer and lost among the linework - which is what
    // happened before this existed, because a shape's layer was simply
    // required to be a 'vector' one.
    // ------------------------------------------------------------
    function Na__LeModel__ShapeLayerType(record) {
        const area = record ? record.Shape__Area : null;
        return (area && typeof area === 'object' && !Array.isArray(area)) ? 'area' : 'vector';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Layer a Shape of That Kind Lands On, Made if the Sheet Has None
    // ------------------------------------------------------------
    // A layer made here goes straight over the frontmost drawing, not to the
    // bottom of the list: the list is the paint order, and at the bottom a
    // pasted vector would land behind the very drawing it was pasted onto.
    // ------------------------------------------------------------
    function Na__LeModel__ShapeLayerId(sheet, type) {
        const found = sheet.Sheet__Layers.find((l) => l.Layer__Type === type)
            || Na__LeModel__CreateLayer(sheet, { name : type === 'area' ? 'Floor Areas' : 'Vectors', type : type, index : Na__LeModel__LayerIndexAboveDrawings(sheet) });
        return found ? found.Layer__Id : Na__LeModel__DefaultLayerId(sheet, type);
    }
    // ------------------------------------------------------------


    // FUNCTION | Put a Complete Vector Record Onto a Sheet (fresh id, one announcement)
    // ------------------------------------------------------------
    // Where CreateShape builds a shape from points and a handful of options,
    // this takes a complete record - vertices, closed, edges, fill, gradient,
    // opacities - deep-copies it and gives it a fresh id, so a vector copied
    // once can be put down again with every setting intact. A layer id the
    // sheet does not have, or that is not a vector layer, falls back to the
    // default vector layer; a sheet without one gets one. Appended last, so
    // it draws in front on its layer. One announcement, so one undo step.
    // ------------------------------------------------------------
    function Na__LeModel__InsertShape(sheet, record, silent) {
        if (!sheet || !record || typeof record !== 'object') return null;
        const item = JSON.parse(JSON.stringify(record));
        item.Shape__Id = Na__LeRec__NextId(sheet.Sheet__Shapes, 'Shape_', 'Shape__Id');
        let layerId = item.Shape__LayerId;
        const wanted = Na__LeModel__ShapeLayerType(item);                        // <-- A measured room wants an 'area' layer, every other vector a 'vector' one
        const layer  = Na__LeModel__GetLayerById(sheet, layerId);
        if (!layer || layer.Layer__Type !== wanted) layerId = Na__LeModel__ShapeLayerId(sheet, wanted);
        Na__LeRec__NormaliseShape(item, layerId);
        sheet.Sheet__Shapes.push(item);
        if (silent) { Na__LeModel__AssignDirty(true); return item; }
        Na__LeModel__Touch('shapes', sheet.Sheet__Id, item.Shape__Id);
        return item;
    }
    // ------------------------------------------------------------


    // FUNCTION | Create, Update and Delete a Vector Shape
    // ------------------------------------------------------------
    // points: [[x, y], ...] paper mm. options: { strokeColour, strokePt,
    // fillColour, fillOpacity, strokeOpacity, closed, stroked, gradient, dash,
    // layerId, silent }. A sheet without a
    // vector layer gets one the first time a shape lands. Edges and fill
    // are either-or at the least: the normaliser puts the edges back on a
    // shape that would otherwise have nothing to show.
    // ------------------------------------------------------------
    function Na__LeModel__CreateShape(sheet, points, options) {
        if (!sheet || !Array.isArray(points)) return null;
        const opts = options || {};
        const area = (opts.area && typeof opts.area === 'object') ? opts.area : null;   // <-- The Floor Area block, when the Area tool is the one drawing
        let layerId = opts.layerId || null;
        if (!layerId) layerId = Na__LeModel__ShapeLayerId(sheet, area ? 'area' : 'vector');
        const item = Na__LeRec__NormaliseShape({
            Shape__Id           : Na__LeRec__NextId(sheet.Sheet__Shapes, 'Shape_', 'Shape__Id'),
            Shape__LayerId      : layerId,
            Shape__Points       : points.map((p) => [ p[0], p[1] ]),
            Shape__Closed       : opts.closed === true,
            Shape__StrokeColour : opts.strokeColour,
            Shape__StrokePt     : opts.strokePt,
            Shape__FillColour   : (typeof opts.fillColour === 'string') ? opts.fillColour : null,
            Shape__Stroked      : opts.stroked !== false,
            Shape__FillOpacity  : opts.fillOpacity,                            // <-- Left out, or not 0 to 1: the normaliser makes it solid
            Shape__Hatch        : (opts.hatch && typeof opts.hatch === 'object') ? opts.hatch : null,   // <-- The normaliser drops it unless it names a pattern
            Shape__StrokeOpacity: opts.strokeOpacity,
            Shape__Gradient     : (opts.gradient && typeof opts.gradient === 'object') ? opts.gradient : null,   // <-- The normaliser copies it, so the caller's object is never shared
            Shape__LineStyle    : (opts.dash && typeof opts.dash === 'object') ? opts.dash : null,
            Shape__Area         : area                                          // <-- The normaliser drops it unless it is an object, and holds a room closed
        }, layerId);
        sheet.Sheet__Shapes.push(item);
        if (opts.silent) Na__LeModel__AssignDirty(true); else Na__LeModel__Touch('shapes', sheet.Sheet__Id, item.Shape__Id);   // <-- The draw tool announces once, on finishing
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
        if (patch.gradient !== undefined) item.Shape__Gradient = (patch.gradient && typeof patch.gradient === 'object') ? patch.gradient : null;   // <-- null clears it; the normaliser below copies it fresh
        if (patch.dash !== undefined) item.Shape__LineStyle = (patch.dash && typeof patch.dash === 'object') ? patch.dash : null;                   // <-- null is a solid edge
        if (typeof patch.stroked === 'boolean') item.Shape__Stroked = patch.stroked;
        if (Number.isFinite(patch.fillOpacity))   item.Shape__FillOpacity   = patch.fillOpacity;
        // MERGED, NOT REPLACED, so setting the scale leaves the pattern and the
        // rotation alone. `null` is how the panel says "no hatch at all".
        if (patch.hatch !== undefined) {
            item.Shape__Hatch = (patch.hatch && typeof patch.hatch === 'object')
                ? Object.assign({}, item.Shape__Hatch, patch.hatch)
                : null;
        }
        // REPLACED, NOT MERGED, unlike the hatch above: the QR block holds one
        // number and whoever sets it is building the whole box, so a half-set
        // block is never what is wanted. `null` takes the code off the shape.
        if (patch.qr !== undefined) {
            item.Shape__Qr = (patch.qr && typeof patch.qr === 'object') ? Object.assign({}, patch.qr) : null;
        }
        // MERGED, NOT REPLACED, like the hatch above: the Floor Areas panel
        // sets one field at a time - a name, a group, a label mode - and a
        // patch of one must not take the other five off the room. `null` is
        // how "this is a plain vector again" is said, and it takes the whole
        // block with it.
        if (patch.area !== undefined) {
            item.Shape__Area = (patch.area && typeof patch.area === 'object')
                ? Object.assign({}, item.Shape__Area, patch.area)
                : null;
        }
        if (Number.isFinite(patch.strokeOpacity)) item.Shape__StrokeOpacity = patch.strokeOpacity;
        if (typeof patch.layerId === 'string') item.Shape__LayerId = patch.layerId;
        Na__LeRec__NormaliseShape(item, item.Shape__LayerId);
        if (silent) { Na__LeModel__AssignDirty(true); return true; }
        Na__LeModel__Touch('shape', sheet.Sheet__Id, itemId);
        return true;
    }
    function Na__LeModel__DeleteShape(sheet, itemId) {
        if (!sheet) return false;
        const index = sheet.Sheet__Shapes.findIndex((sh) => sh.Shape__Id === itemId);
        if (index === -1) return false;
        sheet.Sheet__Shapes.splice(index, 1);
        Na__LeModel__Unselect(itemId);
        Na__LeModel__PruneGroups(sheet);
        Na__LeModel__Touch('shapes', sheet.Sheet__Id, itemId);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Sheet Model Shapes API
    // ------------------------------------------------------------
    export {
        Na__LeModel__GetShapeById,
        Na__LeModel__ShapeLayerType,
        Na__LeModel__ShapeLayerId,
        Na__LeModel__CreateShape,
        Na__LeModel__InsertShape,
        Na__LeModel__UpdateShape,
        Na__LeModel__DeleteShape
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
