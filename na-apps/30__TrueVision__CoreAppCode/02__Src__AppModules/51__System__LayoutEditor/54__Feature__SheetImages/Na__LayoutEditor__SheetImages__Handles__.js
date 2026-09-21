// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET IMAGES - HANDLES
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetImages__Handles__.js
// NAMESPACE  : Na__LeImgHandle
// MODULE     : Layout Editor - Sheet Images - Handles
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : A selected picture's four corner grips, and the drag that scales it from a corner without ever stretching it
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - CORNERS ONLY. A selected picture shows a grip on each corner and none on
//   its sides: a side grip could only stretch it. A corner drag scales the
//   picture about the OPPOSITE corner, which stays exactly where it is, along
//   the box's diagonal - so its proportions cannot change. The one way to
//   change them is the crop.
// - IT SNAPS LIKE EVERYTHING ELSE. The corner is looked for in the sheet's
//   own snap system (Na__LeOsnap__Snap: linework, vectors, other pictures'
//   corners and edge middles, and the drawing grid when that is on), with
//   the picture itself left out. A box that must keep its proportions cannot
//   put its corner on any point at all, so it lines up the edge nearer the
//   point instead - which is what aligning one picture with another needs.
//   Other things snap to a picture's corners and edge middles for free: its
//   points ARE its corners (Na__LeOsnap__FindOnSheet).
// - THE GRIPS TAKE THEIR OWN PRESSES, the way the parametric scrapbook's
//   stretch grips do: a press on one never reaches the sheet tools, and the
//   drag runs on window listeners until the button comes up. One undo step
//   per drag; Escape puts the picture back as it was.
// - A picture on a locked layer shows no grips, and no vertex grips either.
//
// INTEGRATION:
// - Registered with Na__LeGrips__RegisterShapeProvider, so the grips are
//   drawn wherever the selection's grips are.
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

    // MODULE IMPORTS | Grips, Model, Surface, Snapping, Menus and the Feature
    // ------------------------------------------------------------
    import { Na__LeGrips__RegisterShapeProvider } from '../30__System__SheetTools/Na__LayoutEditor__Grips__.js';
    import { Na__LeModel__GetSheetById, Na__LeModel__GetShapeById, Na__LeModel__UpdateShape, Na__LeModel__IsLayerLocked } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__ClientToPaperMm, Na__LeSurface__Refresh } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeOsnap__Snap, Na__LeOsnap__HideMarker } from '../30__System__SheetTools/Na__LayoutEditor__Snapping__.js';
    import { Na__LeMenu__Close } from '../30__System__SheetTools/Na__LayoutEditor__ContextMenu__.js';
    import { Na__LeImgGeo__Rect, Na__LeImgGeo__Corner, Na__LeImgGeo__CornerScale, Na__LeImgGeo__RectPoints } from './Na__LayoutEditor__SheetImages__Geometry__.js';
    import { Na__LeImgCfg__Placement } from './Na__LayoutEditor__SheetImages__Setup__.js';
    import { Na__LeImgDraw__Block } from './Na__LayoutEditor__SheetImages__Paint__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Classes, Cursors and What a Grip Keeps From the Stage
    // ------------------------------------------------------------
    const Na__LeImgHandle__CLASS      = 'na-le-grip na-le-grip--img-corner';
    const Na__LeImgHandle__CURSORS    = [ 'nwse-resize', 'nesw-resize', 'nwse-resize', 'nesw-resize' ];   // <-- Top left, top right, bottom right, bottom left
    const Na__LeImgHandle__BODY_CLASS = 'na-le-img-scaling';
    const Na__LeImgHandle__SWALLOWED  = Object.freeze([ 'pointerup', 'click', 'dblclick', 'contextmenu' ]);   // <-- Kept from the stage as well as the press
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Drag in Flight, and Whether the Provider Is Registered
    // ------------------------------------------------------------
    let Na__LeImgHandle__Drag       = null;       // <-- { pointerId, sheetId, shapeId, corner, start, points, moved }
    let Na__LeImgHandle__Registered = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Grips
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One Corner Grip, Taking Its Own Presses
    // ------------------------------------------------------------
    function Na__LeImgHandle__Add(layer, point, ppm, sizePx, zoom, corner, onPress) {
        const grip = document.createElement('div');
        grip.className    = Na__LeImgHandle__CLASS;
        grip.style.left   = ((point.x * ppm) - (sizePx / 2)) + 'px';
        grip.style.top    = ((point.y * ppm) - (sizePx / 2)) + 'px';
        grip.style.width  = sizePx + 'px';
        grip.style.height = sizePx + 'px';
        grip.style.borderWidth = (1 / (zoom > 0 ? zoom : 1)) + 'px';            // <-- One screen pixel inside the paper's scale
        grip.style.cursor = Na__LeImgHandle__CURSORS[corner];
        grip.setAttribute('data-na-img-corner', String(corner));
        grip.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;                                     // <-- A right drag still pans the sheet from over a grip
            event.preventDefault();
            event.stopPropagation();                                            // <-- The grip's press, not the sheet tools'
            onPress(event);
        });
        Na__LeImgHandle__SWALLOWED.forEach((name) => grip.addEventListener(name, (event) => { if (event.button === 0 || name === 'dblclick') event.stopPropagation(); }));
        layer.appendChild(grip);
        return grip;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Shape Grip Provider: a Picture's Four Corners
    // ------------------------------------------------------------
    // Answers true for every picture, grips or not, so a picture never shows
    // the vertex grips a vector does.
    // ------------------------------------------------------------
    function Na__LeImgHandle__Render(layer, sheet, selection, ppm, zoom, sizePx, shape) {
        if (!Na__LeImgDraw__Block(shape)) return false;
        if (Na__LeModel__IsLayerLocked(sheet, shape.Shape__LayerId)) return true;   // <-- Locked: nothing to take hold of
        const rect = Na__LeImgGeo__Rect(shape.Shape__Points);
        for (let corner = 0; corner < 4; corner++) {
            Na__LeImgHandle__Add(layer, Na__LeImgGeo__Corner(rect, corner), ppm, sizePx, zoom, corner,
                (event) => Na__LeImgHandle__Begin(event, sheet, shape.Shape__Id, corner));
        }
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Corner Drag
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Begin: Remember the Box, Listen on the Window
    // ------------------------------------------------------------
    function Na__LeImgHandle__Begin(event, sheet, shapeId, corner) {
        if (Na__LeImgHandle__Drag) return;
        const shape = Na__LeModel__GetShapeById(sheet, shapeId);
        if (!shape) return;
        Na__LeMenu__Close();
        Na__LeImgHandle__Drag = {
            pointerId : event.pointerId,
            sheetId   : sheet.Sheet__Id,
            shapeId   : shapeId,
            corner    : corner,
            start     : Na__LeImgGeo__Rect(shape.Shape__Points),
            points    : shape.Shape__Points.map((p) => [ p[0], p[1] ]),
            moved     : false
        };
        document.body.classList.add(Na__LeImgHandle__BODY_CLASS);
        document.body.style.setProperty('--na-le-img-scale-cursor', Na__LeImgHandle__CURSORS[corner]);
        window.addEventListener('pointermove',   Na__LeImgHandle__OnMove, true);
        window.addEventListener('pointerup',     Na__LeImgHandle__OnUp, true);
        window.addEventListener('pointercancel', Na__LeImgHandle__OnCancel, true);
        window.addEventListener('keydown',       Na__LeImgHandle__OnKey, true);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Move: Scale Along the Diagonal, the Nearer Edge Snapped
    // ------------------------------------------------------------
    function Na__LeImgHandle__OnMove(event) {
        const drag = Na__LeImgHandle__Drag;
        if (!drag || event.pointerId !== drag.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        const sheet = Na__LeModel__GetSheetById(drag.sheetId);
        const point = Na__LeSurface__ClientToPaperMm(event.clientX, event.clientY);
        if (!sheet || !point) return;
        const snap = Na__LeOsnap__Snap(sheet, point, { kind : 'shape', id : drag.shapeId });   // <-- Everything else on the sheet, and the grid when it is on; never itself
        const rect = Na__LeImgGeo__CornerScale(drag.start, drag.corner, point, Na__LeImgCfg__Placement().minSizeMm, snap.snapped ? snap : null);
        drag.moved = true;
        Na__LeModel__UpdateShape(sheet, drag.shapeId, { points : Na__LeImgGeo__RectPoints(rect.x0, rect.y0, rect.w, rect.h) }, true);
        Na__LeSurface__Refresh('markup');
        Na__LeSurface__Refresh('selection');                                    // <-- The box and these grips follow the corner
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | End: One Undo Step, or the Box Put Back
    // ------------------------------------------------------------
    function Na__LeImgHandle__End(keep) {
        const drag = Na__LeImgHandle__Drag;
        if (!drag) return;
        Na__LeImgHandle__Drag = null;
        window.removeEventListener('pointermove',   Na__LeImgHandle__OnMove, true);
        window.removeEventListener('pointerup',     Na__LeImgHandle__OnUp, true);
        window.removeEventListener('pointercancel', Na__LeImgHandle__OnCancel, true);
        window.removeEventListener('keydown',       Na__LeImgHandle__OnKey, true);
        document.body.classList.remove(Na__LeImgHandle__BODY_CLASS);
        document.body.style.removeProperty('--na-le-img-scale-cursor');
        Na__LeOsnap__HideMarker();
        const sheet = Na__LeModel__GetSheetById(drag.sheetId);
        if (!sheet || !drag.moved) return;
        if (keep) Na__LeModel__UpdateShape(sheet, drag.shapeId, {}, false);     // <-- Announced once: the whole scale is one step
        else {
            Na__LeModel__UpdateShape(sheet, drag.shapeId, { points : drag.points }, true);
            Na__LeSurface__Refresh('markup');
            Na__LeSurface__Refresh('selection');
        }
    }
    function Na__LeImgHandle__OnUp(event) {
        if (!Na__LeImgHandle__Drag || event.pointerId !== Na__LeImgHandle__Drag.pointerId) return;
        event.stopPropagation();
        Na__LeImgHandle__End(true);
    }
    function Na__LeImgHandle__OnCancel(event) {
        if (Na__LeImgHandle__Drag && event.pointerId === Na__LeImgHandle__Drag.pointerId) Na__LeImgHandle__End(false);
    }
    function Na__LeImgHandle__OnKey(event) {
        if (!Na__LeImgHandle__Drag || event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();                                                // <-- The drag's Escape, not the sheet tools'
        Na__LeImgHandle__End(false);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Register the Corner Grips With the Grips Module (once)
    // ------------------------------------------------------------
    function Na__LeImgHandle__Attach() {
        if (Na__LeImgHandle__Registered) return true;
        Na__LeImgHandle__Registered = Na__LeGrips__RegisterShapeProvider(Na__LeImgHandle__Render);
        return Na__LeImgHandle__Registered;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Corner Being Dragged
    // ------------------------------------------------------------
    function Na__LeImgHandle__IsDragging() { return !!Na__LeImgHandle__Drag; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Sheet Images Handles API
    // ------------------------------------------------------------
    export {
        Na__LeImgHandle__Attach,
        Na__LeImgHandle__IsDragging
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
