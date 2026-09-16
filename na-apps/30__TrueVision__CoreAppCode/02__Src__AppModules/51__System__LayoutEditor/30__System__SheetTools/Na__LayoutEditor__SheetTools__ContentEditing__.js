// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET TOOLS - CONTENT EDITING
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetTools__ContentEditing__.js
// NAMESPACE  : Na__LeTools
// MODULE     : Layout Editor - Sheet Tools - Content Editing
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Enter and leave the editing of a viewport's content, and put its drawing back in the middle of the frame
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - SetEditingViewport: while a viewport's content is being edited a drag
//   inside it moves the drawing (2D: the window pans; 3D: the picture
//   slides) and the frame stays where it is. The viewport is selected as it
//   goes in and the stage cursor shows grab. A locked viewport or a read-only
//   session refuses it; null leaves the mode.
// - RecentreViewport: a 2D drawing is centred on its frame; a 3D picture is
//   centred at the zoom it is drawn at (Na__LayoutEditor__Viewport3dZoom__).
//   One announcement, so one history step.
// - A file of its own because three others reach it: the double click
//   (Na__LayoutEditor__SheetTools__PointerPress__), the context menu and the
//   keys (Escape, Space and Enter leave the mode). The context menu also
//   needs the keyboard's DeleteSelection, so with content editing kept here
//   no two sheet tools files import each other.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__ re-exports both under the same names.
// - Called by Na__LayoutEditor__SheetTools__PointerPress__,
//   Na__LayoutEditor__SheetTools__Keyboard__ and
//   Na__LayoutEditor__SheetTools__ContextMenu__.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the ValeVision3D v2.47.0 split of the same module (same unit, same functions)
// - Parity        : verbatim (moved code)
// - Divergences   : n/a
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__SheetTools__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Model, Surface, Viewports
    // ------------------------------------------------------------
    import {
        Na__LeModel__KIND_2D,
        Na__LeModel__GetActiveSheet,
        Na__LeModel__GetViewportById,
        Na__LeModel__UpdateViewport,
        Na__LeModel__SetSelection,
        Na__LeModel__GetSelection
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__SetEditingViewport } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeVp2d__CentreOnDrawing } from '../20__System__Viewports/Na__LayoutEditor__Viewport2d__.js';
    import { Na__LeVpZoom__CentredOffset } from '../20__System__Viewports/Na__LayoutEditor__Viewport3dZoom__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Sheet Tools State and Hit Resolution
    // ------------------------------------------------------------
    import { Na__LeTools__Stage, Na__LeTools__Editable } from './Na__LayoutEditor__SheetTools__State__.js';
    import { Na__LeTools__IsViewportLocked } from './Na__LayoutEditor__SheetTools__HitResolution__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Content Editing
// -----------------------------------------------------------------------------

    // FUNCTION | Enter or Leave Content Editing on a Viewport (double-click)
    // ------------------------------------------------------------
    // While a viewport's content is being edited a drag inside it moves the
    // drawing (2D: the window pans; 3D: the picture slides) and the frame
    // stays where it is. Null leaves the mode.
    // ------------------------------------------------------------
    function Na__LeTools__SetEditingViewport(viewportId) {
        const sheet    = Na__LeModel__GetActiveSheet();
        const viewport = (sheet && viewportId) ? Na__LeModel__GetViewportById(sheet, viewportId) : null;
        if (viewport && (!Na__LeTools__Editable || Na__LeTools__IsViewportLocked(sheet, viewport))) return false;
        if (viewport) {
            const selection = Na__LeModel__GetSelection();
            if (!selection || selection.kind !== 'viewport' || selection.id !== viewportId) Na__LeModel__SetSelection({ kind : 'viewport', id : viewportId });
        }
        Na__LeSurface__SetEditingViewport(viewport ? viewportId : null);
        if (Na__LeTools__Stage) Na__LeTools__Stage.style.cursor = viewport ? 'grab' : '';
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put the Drawing Back in the Middle of Its Frame
    // ------------------------------------------------------------
    function Na__LeTools__RecentreViewport(sheet, viewportId) {
        const viewport = Na__LeModel__GetViewportById(sheet, viewportId);
        if (!viewport || Na__LeTools__IsViewportLocked(sheet, viewport)) return false;
        if (viewport.Viewport__Kind === Na__LeModel__KIND_2D) Na__LeVp2d__CentreOnDrawing(sheet, viewport);
        else Na__LeModel__UpdateViewport(sheet, viewportId, { imageOffset : Na__LeVpZoom__CentredOffset(viewport) }, true);   // <-- The picture's middle on the frame's middle, at the zoom it is drawn at
        return Na__LeModel__UpdateViewport(sheet, viewportId, {}, false);      // <-- One announcement: one history step
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Sheet Tools Content Editing
    // ------------------------------------------------------------
    export {
        Na__LeTools__SetEditingViewport,
        Na__LeTools__RecentreViewport
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
