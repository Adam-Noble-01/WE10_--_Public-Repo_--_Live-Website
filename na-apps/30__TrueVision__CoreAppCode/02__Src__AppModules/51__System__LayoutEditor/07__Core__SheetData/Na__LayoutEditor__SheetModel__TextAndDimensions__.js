// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET MODEL - TEXT AND DIMENSIONS
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetModel__TextAndDimensions__.js
// NAMESPACE  : Na__LeModel
// MODULE     : Layout Editor - Sheet Model - Text and Dimensions
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : A sheet's text items and dimensions: find, add, paste, change and remove them
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - Text items: the list and one by id, CreateAnnotation at a paper point,
//   InsertAnnotation for a complete record (a paste), UpdateAnnotation
//   (the turn is kept by SetAnnotationRotation) and DeleteAnnotation.
// - Dimensions: the list, CreateDimension between two paper points,
//   UpdateDimension and DeleteDimension.
// - The silent paths set the dirty flag through the State unit's
//   AssignDirty (an imported let cannot be assigned).
//
// INTEGRATION:
// - Imports Na__LayoutEditor__SheetModel__State__,
//   Na__LayoutEditor__SheetModel__Layers__ (GetLayerById, DefaultLayerId)
//   and Na__LayoutEditor__SheetModel__Groups__ (PruneGroups, after a text
//   item is deleted).
// - Na__LayoutEditor__SheetModel__ re-exports this unit's API. Every other
//   module imports Na__LayoutEditor__SheetModel__.js, never this unit.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the ValeVision3D v2.47.0 split of the same module (same unit, same functions)
// - Parity        : verbatim (moved code)
// - Divergences   : header; CreateDimension and UpdateDimension carry Measure at scale (atScale) and the fixed length extension lines (startExtensionMm, endExtensionMm, extensionsLinked), which the ValeVision3D unit does not.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
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
        Na__LeRec__NormaliseAnnotation,
        Na__LeRec__NormaliseDimension
    } from './Na__LayoutEditor__SheetRecords__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Sheet Model State, Layers and Groups
    // ------------------------------------------------------------
    import { Na__LeModel__Touch, Na__LeModel__Unselect, Na__LeModel__AssignDirty } from './Na__LayoutEditor__SheetModel__State__.js';
    import { Na__LeModel__GetLayerById, Na__LeModel__DefaultLayerId } from './Na__LayoutEditor__SheetModel__Layers__.js';
    import { Na__LeModel__PruneGroups } from './Na__LayoutEditor__SheetModel__Groups__.js';
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


    // HELPER FUNCTION | Set How Far a Text Item Is Turned
    // ------------------------------------------------------------
    // Degrees clockwise about its anchor, wrapped into (-180, 180] and kept to
    // a thousandth of a degree. Level removes the key, so a text item that has
    // never been turned - or has been turned back - saves exactly as before.
    // ------------------------------------------------------------
    function Na__LeModel__SetAnnotationRotation(item, deg) {
        let d = Math.round((deg % 360) * 1000) / 1000;
        if (d <= -180) d += 360;
        if (d > 180) d -= 360;
        if (d === 0) delete item.Annotation__RotationDeg;
        else item.Annotation__RotationDeg = d;
    }
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
        if (Number.isFinite(opts.rotationDeg)) Na__LeModel__SetAnnotationRotation(item, opts.rotationDeg);
        sheet.Sheet__Annotations.push(item);
        Na__LeModel__Touch('annotations', sheet.Sheet__Id, item.Annotation__Id);
        return item;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put a Complete Text Record Onto a Sheet (fresh id)
    // ------------------------------------------------------------
    // A paste of a text item, the way InsertShape pastes a vector. silent
    // skips the announcement so several items can land as one undo step.
    // ------------------------------------------------------------
    function Na__LeModel__InsertAnnotation(sheet, record, silent) {
        if (!sheet || !record || typeof record !== 'object') return null;
        const item = JSON.parse(JSON.stringify(record));
        item.Annotation__Id = Na__LeRec__NextId(sheet.Sheet__Annotations, 'Text_', 'Annotation__Id');
        let layerId = item.Annotation__LayerId;
        if (!Na__LeModel__GetLayerById(sheet, layerId)) layerId = Na__LeModel__DefaultLayerId(sheet, 'annotation');
        Na__LeRec__NormaliseAnnotation(item, layerId);
        sheet.Sheet__Annotations.push(item);
        if (silent) { Na__LeModel__AssignDirty(true); return item; }
        Na__LeModel__Touch('annotations', sheet.Sheet__Id, item.Annotation__Id);
        return item;
    }
    // ------------------------------------------------------------


    // FUNCTION | One Text Item by Id
    // ------------------------------------------------------------
    function Na__LeModel__GetAnnotationById(sheet, itemId) {
        return sheet ? Na__LeRec__Find(sheet.Sheet__Annotations, 'Annotation__Id', itemId) : null;
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
        if (Number.isFinite(patch.rotationDeg)) Na__LeModel__SetAnnotationRotation(item, patch.rotationDeg);
        Na__LeRec__NormaliseAnnotation(item, item.Annotation__LayerId);
        if (silent) { Na__LeModel__AssignDirty(true); return true; }
        Na__LeModel__Touch('annotation', sheet.Sheet__Id, itemId);
        return true;
    }
    function Na__LeModel__DeleteAnnotation(sheet, itemId) {
        if (!sheet) return false;
        const index = sheet.Sheet__Annotations.findIndex((a) => a.Annotation__Id === itemId);
        if (index === -1) return false;
        sheet.Sheet__Annotations.splice(index, 1);
        Na__LeModel__Unselect(itemId);
        Na__LeModel__PruneGroups(sheet);
        Na__LeModel__Touch('annotations', sheet.Sheet__Id, itemId);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Add a Dimension Between Two Paper Points
    // ------------------------------------------------------------
    function Na__LeModel__CreateDimension(sheet, start, end, options) {
        if (!sheet || !start || !end) return null;
        const opts = options || {};
        const record = {
            Dimension__Id           : Na__LeRec__NextId(sheet.Sheet__Dimensions, 'Dim_', 'Dimension__Id'),
            Dimension__ViewportId   : opts.viewportId || null,
            Dimension__StartXMm     : start.x, Dimension__StartYMm : start.y,
            Dimension__EndXMm       : end.x,   Dimension__EndYMm   : end.y,
            Dimension__OffsetMm     : opts.offsetMm,
            Dimension__TextSizeMm   : opts.textSizeMm,
            Dimension__Colour       : opts.colour,
            Dimension__Terminator   : opts.terminator,
            Dimension__TickLengthMm : opts.tickLengthMm,                       // <-- How large the ticks, arrows or dots are; the normaliser drops anything else
            Dimension__Precision    : opts.precision,
            Dimension__UnitsSuffix  : opts.unitsSuffix,
            Dimension__OverrideText : (typeof opts.overrideText === 'string') ? opts.overrideText : null,
            Dimension__Orientation  : opts.orientation,                        // <-- 'aligned', 'horizontal' or 'vertical'; the normaliser makes anything else aligned
            Dimension__StartExtensionMm : opts.startExtensionMm,               // <-- A length cuts the extension line short; the normaliser drops anything else
            Dimension__EndExtensionMm   : opts.endExtensionMm,
            Dimension__ExtensionsLinked : opts.extensionsLinked,               // <-- Kept only as false
            Dimension__LayerId      : opts.layerId
        };
        if (typeof opts.atScale === 'boolean') record.Dimension__AtScale = opts.atScale;   // <-- Measure at scale; left out, no key, and the record reads as one from before it
        const item = Na__LeRec__NormaliseDimension(record, Na__LeModel__DefaultLayerId(sheet, 'dimension'));
        sheet.Sheet__Dimensions.push(item);
        if (opts.silent) Na__LeModel__AssignDirty(true); else Na__LeModel__Touch('dimensions', sheet.Sheet__Id, item.Dimension__Id);   // <-- The dimension tool announces once, on the third click
        return item;
    }
    // ------------------------------------------------------------


    // FUNCTION | Insert a Complete Dimension Record With a Fresh Id
    // ------------------------------------------------------------
    function Na__LeModel__InsertDimension(sheet, record, silent) {
        if (!sheet || !record || typeof record !== 'object') return null;
        const item = JSON.parse(JSON.stringify(record));
        item.Dimension__Id = Na__LeRec__NextId(sheet.Sheet__Dimensions, 'Dim_', 'Dimension__Id');
        let layerId = item.Dimension__LayerId;
        if (!Na__LeModel__GetLayerById(sheet, layerId)) layerId = Na__LeModel__DefaultLayerId(sheet, 'dimension');
        Na__LeRec__NormaliseDimension(item, layerId);
        sheet.Sheet__Dimensions.push(item);
        if (silent) { Na__LeModel__AssignDirty(true); return item; }
        Na__LeModel__Touch('dimensions', sheet.Sheet__Id, item.Dimension__Id);
        return item;
    }
    // ------------------------------------------------------------


    // FUNCTION | Change or Remove a Dimension
    // ------------------------------------------------------------
    function Na__LeModel__UpdateDimension(sheet, itemId, patch, silent) {
        const item = sheet ? Na__LeRec__Find(sheet.Sheet__Dimensions, 'Dimension__Id', itemId) : null;
        if (!item || !patch) return false;
        [ 'StartXMm', 'StartYMm', 'EndXMm', 'EndYMm', 'OffsetMm', 'TextSizeMm', 'TickLengthMm', 'Precision', 'TextDXMm', 'TextDYMm' ].forEach((key) => {
            const name = key.charAt(0).toLowerCase() + key.slice(1);
            if (Number.isFinite(patch[name])) item['Dimension__' + key] = patch[name];
        });
        if (typeof patch.colour === 'string') item.Dimension__Colour = patch.colour;
        if (typeof patch.terminator === 'string') item.Dimension__Terminator = patch.terminator;
        if (typeof patch.unitsSuffix === 'string') item.Dimension__UnitsSuffix = patch.unitsSuffix;
        if (typeof patch.orientation === 'string') item.Dimension__Orientation = patch.orientation;
        if (typeof patch.atScale === 'boolean') item.Dimension__AtScale = patch.atScale;               // <-- Measure at scale, from the Dimensions panel
        if (patch.startExtensionMm !== undefined) item.Dimension__StartExtensionMm = patch.startExtensionMm;   // <-- null, or anything but a length, is the full line
        if (patch.endExtensionMm !== undefined)   item.Dimension__EndExtensionMm   = patch.endExtensionMm;
        if (typeof patch.extensionsLinked === 'boolean') item.Dimension__ExtensionsLinked = patch.extensionsLinked;   // <-- The normaliser keeps only false
        if (patch.overrideText !== undefined) item.Dimension__OverrideText = (typeof patch.overrideText === 'string' && patch.overrideText.trim()) ? patch.overrideText : null;
        if (patch.viewportId !== undefined) item.Dimension__ViewportId = patch.viewportId;
        if (typeof patch.layerId === 'string') item.Dimension__LayerId = patch.layerId;
        Na__LeRec__NormaliseDimension(item, item.Dimension__LayerId);
        if (silent) { Na__LeModel__AssignDirty(true); return true; }
        Na__LeModel__Touch('dimension', sheet.Sheet__Id, itemId);
        return true;
    }
    function Na__LeModel__DeleteDimension(sheet, itemId) {
        if (!sheet) return false;
        const index = sheet.Sheet__Dimensions.findIndex((d) => d.Dimension__Id === itemId);
        if (index === -1) return false;
        sheet.Sheet__Dimensions.splice(index, 1);
        Na__LeModel__Unselect(itemId);
        Na__LeModel__Touch('dimensions', sheet.Sheet__Id, itemId);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Sheet Model Text and Dimensions API
    // ------------------------------------------------------------
    export {
        Na__LeModel__GetAnnotations,
        Na__LeModel__GetAnnotationById,
        Na__LeModel__GetDimensions,
        Na__LeModel__CreateAnnotation,
        Na__LeModel__InsertAnnotation,
        Na__LeModel__UpdateAnnotation,
        Na__LeModel__DeleteAnnotation,
        Na__LeModel__CreateDimension,
        Na__LeModel__InsertDimension,
        Na__LeModel__UpdateDimension,
        Na__LeModel__DeleteDimension
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
