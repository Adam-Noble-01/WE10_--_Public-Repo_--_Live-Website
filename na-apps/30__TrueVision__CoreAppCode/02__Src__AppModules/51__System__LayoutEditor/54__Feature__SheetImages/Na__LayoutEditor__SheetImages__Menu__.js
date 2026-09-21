// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET IMAGES - MENU
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetImages__Menu__.js
// NAMESPACE  : Na__LeImgMenu
// MODULE     : Layout Editor - Sheet Images - Menu
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : What a picture's right-click menu offers: its frame, its crop, and replacing it
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - Asked for by the sheet's context menu for any shape, and answering only
//   for a picture (null otherwise), the way the Floor Areas menu answers for
//   a measured room. A picture offers none of a vector's entries: it has no
//   points to edit, no edge to open or close and no floor to measure.
// - The first line says what was right-clicked - the picture's name and the
//   resolution it prints at - so "which render is this?" is answered without
//   opening a panel.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Model and the Feature
    // ------------------------------------------------------------
    import { Na__LeModel__UpdateShape, Na__LeModel__IsLayerLocked } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeImgGeo__Rect, Na__LeImgGeo__WholeRect, Na__LeImgGeo__RectPoints, Na__LeImgGeo__PrintDpi } from './Na__LayoutEditor__SheetImages__Geometry__.js';
    import { Na__LeImgCfg__Label } from './Na__LayoutEditor__SheetImages__Setup__.js';
    import { Na__LeImgDraw__Block } from './Na__LayoutEditor__SheetImages__Paint__.js';
    import { Na__LeImgCrop__Open } from './Na__LayoutEditor__SheetImages__Crop__.js';
    import { Na__LeImgIns__Replace } from './Na__LayoutEditor__SheetImages__Insert__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Actions
// -----------------------------------------------------------------------------

    // FUNCTION | Frame On or Off (one undo step)
    // ------------------------------------------------------------
    function Na__LeImgMenu__SetFrame(sheet, shapeId, on) {
        return Na__LeModel__UpdateShape(sheet, shapeId, { image : { Image__Frame : on === true } }, false);
    }
    // ------------------------------------------------------------


    // FUNCTION | Take the Crop Off: the Whole Picture, Where It Is (one undo step)
    // ------------------------------------------------------------
    function Na__LeImgMenu__ResetCrop(sheet, shape) {
        const block = Na__LeImgDraw__Block(shape);
        if (!block || !block.Image__Crop) return false;
        const whole = Na__LeImgGeo__WholeRect(Na__LeImgGeo__Rect(shape.Shape__Points), block.Image__Crop);
        return Na__LeModel__UpdateShape(sheet, shape.Shape__Id, { points : Na__LeImgGeo__RectPoints(whole.x0, whole.y0, whole.w, whole.h), image : { Image__Crop : null } }, false);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | The Menu Rows for a Picture, or null When the Shape Is Not One
    // ------------------------------------------------------------
    function Na__LeImgMenu__ItemsFor(sheet, shape) {
        const block = Na__LeImgDraw__Block(shape);
        if (!sheet || !block) return null;
        const L      = Na__LeImgCfg__Label;
        const locked = Na__LeModel__IsLayerLocked(sheet, shape.Shape__LayerId);
        const rect   = Na__LeImgGeo__Rect(shape.Shape__Points);
        const dpi    = Math.round(Na__LeImgGeo__PrintDpi(rect, block.Image__PixelW, block.Image__PixelH, block.Image__Crop));
        const on     = block.Image__Frame !== false;
        return [
            { label : (block.Image__Name || block.Image__File) + '  -  ' + dpi + ' dpi', disabled : true },
            { separator : true },
            { label : L('MenuFrameOn', 'Show frame'), checked : on, disabled : locked,
              onSelect : () => { Na__LeImgMenu__SetFrame(sheet, shape.Shape__Id, !on); } },
            { label : L('MenuCrop', 'Crop picture...'), disabled : locked,
              onSelect : () => { Na__LeImgCrop__Open(sheet, shape.Shape__Id); } },
            { label : L('MenuResetCrop', 'Reset crop'), disabled : locked || !block.Image__Crop,
              onSelect : () => { Na__LeImgMenu__ResetCrop(sheet, shape); } },
            { label : L('MenuReplace', 'Replace picture...'), disabled : locked,
              onSelect : () => { Na__LeImgIns__Replace(sheet, shape.Shape__Id); } },
            { separator : true }
        ];
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Sheet Images Menu API
    // ------------------------------------------------------------
    export {
        Na__LeImgMenu__ItemsFor,
        Na__LeImgMenu__SetFrame,
        Na__LeImgMenu__ResetCrop
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
