// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SCRAPBOOK - TILE DRAG
// =============================================================================
//
// FILE       : Na__LayoutEditor__Scrapbook__TileDrag__.js
// NAMESPACE  : Na__LeScrapDrag
// MODULE     : Layout Editor - Scrapbook Tile Drag
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : One scrapbook tile - its preview, its drag, its ghost and its drop - shared by every scrapbook library
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - The Standard, the Custom and the Parametric scrapbooks all offer tiles
//   that are dragged onto the paper the same way. This module is that way,
//   written once: a library hands it a spec and gets a tile back.
// - A spec is { id, name, title, editable, buildSet, place, modifier, caption,
//   hold, snap }. buildSet() answers the item in the item clipboard's set
//   shape - entries, roots, origin and size - which is what the preview and
//   the ghost are drawn from. place(sheet, pointMm) puts it on the sheet at a
//   paper point - centred on it, unless the spec says otherwise - and answers
//   what it selected, or null. caption(element, tile) is optional: a library
//   whose tiles say more than a name fills the caption itself.
// - hold(set) is optional: the point of the set the pointer holds, in the
//   set's own millimetres, which place is then handed. Without it the
//   pointer holds the middle. The cabinet infill is held by its bottom left
//   corner, the way a CAD block hangs from its insertion point. snap true
//   snaps that point to the drawing while it is dragged - the object snap's
//   marker shows where - and the drop lands on the point snapped to.
// - Press on a tile and drag: the item follows the pointer at the size it
//   will land at, the sheet's own zoom - faint away from the sheet, clear
//   over it. Let go over the sheet and it lands where it hangs under the
//   pointer with the Select tool up. Escape, or letting go anywhere else,
//   drops nothing.
// - Double-click a tile, or press Enter or Space on it, to place the item in
//   the middle of the view instead.
//
// INTEGRATION:
// - Na__LayoutEditor__Panel__Scrapbook__, Na__LayoutEditor__Panel__ScrapbookCustom__,
//   Na__LayoutEditor__Panel__ScrapbookParametric__ and
//   Na__LayoutEditor__Panel__ScrapbookSpecification__ build their tiles here.
// // @delegate: ./Na__LayoutEditor__Scrapbook__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (19-Sep-2026)
// - ValeVision    : ported 20-Sep-2026 as ValeVision3D v2.68.0, verbatim
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.2.0
// - spec.hold and spec.snap, for the cabinet infill (Adam: "make the
//   insertion point ... the bottom left, like a proper XY"). The ghost hangs
//   from the point hold names, and with snap that point follows the object
//   snap - the corners of the drawing, then the grid while Grid Snap is on -
//   so an item can be dropped exactly on a corner. No new export; a spec
//   without either drags exactly as before.
//
// 20-Sep-2026 - Version 1.1.0
// - spec.caption: a library may fill a tile's caption itself. Written for the
//   Specification Scrapbook (58__Feature__ScrapbookSpecification), whose rows
//   carry a note's title and text beside its bubble. No new export, and a
//   spec without one reads exactly as before - so a warm cache still holding
//   1.0.0 shows such a tile with its name, never a broken one.
//
// 19-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__Panel__Scrapbook__ 1.0.0, where the drag
//   was written for one library and knew its items by id. The gestures, the
//   ghost and the classes are unchanged; an item is now a spec.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Model, Surface, Tools, the Preview and the Panel Host
    // ------------------------------------------------------------
    import { Na__LeModel__GetActiveSheet } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import {
        Na__LeSurface__ClientToPaperMm,
        Na__LeSurface__PaperMmToClient,
        Na__LeSurface__GetElements,
        Na__LeSurface__GetPixelsPerMm,
        Na__LeSurface__GetZoom
    } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeOsnap__Snap, Na__LeOsnap__HideMarker } from '../28__System__ObjectSnap/Na__LayoutEditor__ObjectSnap__Search__.js';   // <-- For a spec that snaps the point it is held by
    import { Na__LeTools__TOOL_SELECT, Na__LeTools__SetTool } from '../30__System__SheetTools/Na__LayoutEditor__SheetTools__.js';
    import { Na__LeScrap__PreviewSvg } from './Na__LayoutEditor__Scrapbook__.js';
    import { Na__LePanels__IsEditable } from '../40__Ui__Panels/Na__LayoutEditor__PanelHost__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Classes and Gestures
    // ------------------------------------------------------------
    const Na__LeScrapDrag__TILE_CLASS      = 'na-le-scrap__item';
    const Na__LeScrapDrag__GHOST_CLASS     = 'na-le-scrap-ghost';
    const Na__LeScrapDrag__BODY_CLASS      = 'na-le-scrap-dragging';
    const Na__LeScrapDrag__OVER_CLASS      = 'is-over-sheet';
    const Na__LeScrapDrag__DRAG_START_PX   = 4;                                 // <-- A press that moves less than this is a click, not a drag
    const Na__LeScrapDrag__DOUBLE_PRESS_MS = 450;                               // <-- Two clicks on one tile inside this are a double-click
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Drag and the Last Click
    // ------------------------------------------------------------
    let Na__LeScrapDrag__Drag      = null;      // <-- { pointerId, spec, tile, startX, startY, set, preview, ghost, over, held }
    let Na__LeScrapDrag__LastClick = null;      // <-- { id, time } of a press that ended without a drag
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Placing an Item
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Stage, When It Is on the Screen
    // ------------------------------------------------------------
    function Na__LeScrapDrag__Stage() {
        const stage = Na__LeSurface__GetElements().stage;
        return (stage && stage.isConnected) ? stage : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is a Client Point Over the Sheet's Stage
    // ------------------------------------------------------------
    function Na__LeScrapDrag__IsOverSheet(clientX, clientY) {
        const stage = Na__LeScrapDrag__Stage();
        if (!stage) return false;
        const rect = stage.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    }
    // ------------------------------------------------------------


    // FUNCTION | Place an Item at a Paper Point
    // ------------------------------------------------------------
    // Centred on it, or - for a spec with hold - with the point it is held by
    // on it; the spec's place decides which.
    // The Select tool comes up first, so a tool part way through placing lets
    // go and the new item can be dragged at once. The stage takes the focus,
    // so Delete, the arrow keys and Ctrl+Z act on the item straight away.
    // ------------------------------------------------------------
    function Na__LeScrapDrag__Place(spec, centreMm) {
        const sheet = Na__LeModel__GetActiveSheet();
        if (!sheet || !spec || typeof spec.place !== 'function' || !centreMm || !Na__LePanels__IsEditable()) return null;
        Na__LeTools__SetTool(Na__LeTools__TOOL_SELECT);
        const placed = spec.place(sheet, centreMm);
        const stage  = Na__LeScrapDrag__Stage();
        if (placed && stage) { try { stage.focus({ preventScroll : true }); } catch (error) { /* focus is a courtesy */ } }
        return placed;
    }
    // ------------------------------------------------------------


    // FUNCTION | Place an Item in the Middle of the View
    // ------------------------------------------------------------
    // A view scrolled off the paper still places on it: the drop is kept on
    // the paper the way a paste is.
    // ------------------------------------------------------------
    function Na__LeScrapDrag__PlaceInView(spec) {
        const stage = Na__LeScrapDrag__Stage();
        if (!stage || !spec) return null;
        const rect = stage.getBoundingClientRect();
        return Na__LeScrapDrag__Place(spec, Na__LeSurface__ClientToPaperMm(rect.left + (rect.width / 2), rect.top + (rect.height / 2)));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Dragging an Item
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Put Up the Ghost the Drag Carries
    // ------------------------------------------------------------
    function Na__LeScrapDrag__StartGhost(drag) {
        drag.set     = drag.spec.buildSet();
        drag.preview = drag.set ? Na__LeScrap__PreviewSvg(drag.set, 'na-le-scrap-ghost__svg') : null;
        if (!drag.preview) return false;
        drag.ghost = document.createElement('div');
        drag.ghost.className = Na__LeScrapDrag__GHOST_CLASS;
        drag.ghost.innerHTML = drag.preview.markup;
        document.body.appendChild(drag.ghost);
        document.body.classList.add(Na__LeScrapDrag__BODY_CLASS);
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Point of the Set the Pointer Holds, in the Set's Own Millimetres
    // ------------------------------------------------------------
    // spec.hold's answer when it gives one - the cabinet infill's bottom left
    // corner - else the middle of the set, as every item was held.
    // ------------------------------------------------------------
    function Na__LeScrapDrag__HeldPoint(spec, set) {
        if (spec && typeof spec.hold === 'function') {
            try {
                const point = spec.hold(set);
                if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) return { x : point.x, y : point.y };
            } catch (error) { /* held by the middle instead */ }
        }
        return { x : set.origin.x + (set.size.WidthMm / 2), y : set.origin.y + (set.size.HeightMm / 2) };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where the Held Point Goes on the Paper: the Pointer, or What It Snaps To
    // ------------------------------------------------------------
    // { clientX, clientY, paper }. For a spec that snaps, the object snap's own
    // search - the corners of the drawing, the sheet's vectors, then the grid
    // while Grid Snap is on - which puts up its own marker; for any other, and
    // off the sheet, the pointer as it is.
    // ------------------------------------------------------------
    function Na__LeScrapDrag__DropPoint(spec, clientX, clientY, over) {
        const paper = Na__LeSurface__ClientToPaperMm(clientX, clientY);
        const sheet = Na__LeModel__GetActiveSheet();
        if (!spec || spec.snap !== true || !over || !sheet || !paper) {
            if (spec && spec.snap === true) Na__LeOsnap__HideMarker();
            return { clientX : clientX, clientY : clientY, paper : paper };
        }
        const hit = Na__LeOsnap__Snap(sheet, paper, null);
        if (!hit || !hit.snapped) return { clientX : clientX, clientY : clientY, paper : paper };
        const at = Na__LeSurface__PaperMmToClient(hit.x, hit.y);
        return { clientX : at.x, clientY : at.y, paper : { x : hit.x, y : hit.y } };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Keep the Ghost Under the Pointer, at the Sheet's Zoom
    // ------------------------------------------------------------
    // The point the item is held by sits on the pointer - or on what the
    // pointer snapped to - where it will land. The preview has a little room
    // round the item, so its corner is offset by that room.
    // ------------------------------------------------------------
    function Na__LeScrapDrag__MoveGhost(drag, clientX, clientY) {
        const pxPerMm = Na__LeSurface__GetPixelsPerMm() * Na__LeSurface__GetZoom();
        const preview = drag.preview;
        const held    = drag.held || (drag.held = Na__LeScrapDrag__HeldPoint(drag.spec, drag.set));
        const over    = Na__LeScrapDrag__IsOverSheet(clientX, clientY);
        const at      = Na__LeScrapDrag__DropPoint(drag.spec, clientX, clientY, over);
        const style   = drag.ghost.style;
        style.width     = (preview.widthMm  * pxPerMm) + 'px';
        style.height    = (preview.heightMm * pxPerMm) + 'px';
        style.transform = 'translate(' + (at.clientX - ((held.x - preview.leftMm) * pxPerMm)) + 'px, ' + (at.clientY - ((held.y - preview.topMm) * pxPerMm)) + 'px)';
        if (over === drag.over) return;
        drag.over = over;
        drag.ghost.classList.toggle('is-over', over);
        document.body.classList.toggle(Na__LeScrapDrag__OVER_CLASS, over);
    }
    // ------------------------------------------------------------


    // FUNCTION | End the Drag, Dropping Nothing
    // ------------------------------------------------------------
    function Na__LeScrapDrag__EndDrag() {
        const drag = Na__LeScrapDrag__Drag;
        Na__LeScrapDrag__Drag = null;
        window.removeEventListener('pointermove',   Na__LeScrapDrag__OnPointerMove, true);
        window.removeEventListener('pointerup',     Na__LeScrapDrag__OnPointerUp, true);
        window.removeEventListener('pointercancel', Na__LeScrapDrag__OnPointerCancel, true);
        window.removeEventListener('keydown',       Na__LeScrapDrag__OnKeyDown, true);
        document.body.classList.remove(Na__LeScrapDrag__BODY_CLASS, Na__LeScrapDrag__OVER_CLASS);
        if (!drag) return;
        if (drag.spec && drag.spec.snap === true) Na__LeOsnap__HideMarker();   // <-- The snap's marker is left up by the last move
        try { if (drag.tile.hasPointerCapture(drag.pointerId)) drag.tile.releasePointerCapture(drag.pointerId); } catch (error) { /* already released */ }
        if (drag.ghost && drag.ghost.parentNode) drag.ghost.parentNode.removeChild(drag.ghost);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Press on a Tile
    // ------------------------------------------------------------
    // Nothing is built until the pointer has moved far enough to be a drag.
    // The window listens in the capture phase, so the drag follows the
    // pointer even where the tile's capture could not be taken.
    // ------------------------------------------------------------
    function Na__LeScrapDrag__OnPointerDown(event, tile, spec) {
        if (event.button !== 0 || Na__LeScrapDrag__Drag || !Na__LePanels__IsEditable()) return;
        event.preventDefault();                                              // <-- No text selection, and no focus ring from a press
        Na__LeScrapDrag__Drag = { pointerId : event.pointerId, spec : spec, tile : tile, startX : event.clientX, startY : event.clientY, set : null, preview : null, ghost : null, over : false };
        try { tile.setPointerCapture(event.pointerId); } catch (error) { /* the window listeners still follow the pointer */ }
        window.addEventListener('pointermove',   Na__LeScrapDrag__OnPointerMove, true);
        window.addEventListener('pointerup',     Na__LeScrapDrag__OnPointerUp, true);
        window.addEventListener('pointercancel', Na__LeScrapDrag__OnPointerCancel, true);
        window.addEventListener('keydown',       Na__LeScrapDrag__OnKeyDown, true);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Move: Start the Ghost Once It Is a Drag, Then Follow
    // ------------------------------------------------------------
    function Na__LeScrapDrag__OnPointerMove(event) {
        const drag = Na__LeScrapDrag__Drag;
        if (!drag || event.pointerId !== drag.pointerId) return;
        if (!drag.ghost) {
            if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < Na__LeScrapDrag__DRAG_START_PX) return;
            if (!Na__LeScrapDrag__StartGhost(drag)) { Na__LeScrapDrag__EndDrag(); return; }
        }
        Na__LeScrapDrag__MoveGhost(drag, event.clientX, event.clientY);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Let Go: Drop Over the Sheet, or Count a Click
    // ------------------------------------------------------------
    // A double-click is counted here from two presses that never became
    // drags, rather than from dblclick: the press is cancelled to keep the
    // drag clean, and a browser is free to drop the mouse events it would
    // have built a dblclick from.
    // ------------------------------------------------------------
    function Na__LeScrapDrag__OnPointerUp(event) {
        const drag = Na__LeScrapDrag__Drag;
        if (!drag || event.pointerId !== drag.pointerId) return;
        const dragged = !!drag.ghost;
        const spec    = drag.spec;
        const over    = dragged && Na__LeScrapDrag__IsOverSheet(event.clientX, event.clientY);
        const landing = over ? Na__LeScrapDrag__DropPoint(spec, event.clientX, event.clientY, true).paper : null;   // <-- Snapped where the spec snaps, BEFORE the drag ends and takes the marker down
        Na__LeScrapDrag__EndDrag();
        if (dragged) {
            Na__LeScrapDrag__LastClick = null;
            if (landing) Na__LeScrapDrag__Place(spec, landing);
            return;
        }
        const last = Na__LeScrapDrag__LastClick;
        const now  = event.timeStamp;
        if (last && last.id === spec.id && (now - last.time) <= Na__LeScrapDrag__DOUBLE_PRESS_MS) {
            Na__LeScrapDrag__LastClick = null;
            Na__LeScrapDrag__PlaceInView(spec);
            return;
        }
        Na__LeScrapDrag__LastClick = { id : spec.id, time : now };
    }
    function Na__LeScrapDrag__OnPointerCancel(event) {
        if (Na__LeScrapDrag__Drag && event.pointerId === Na__LeScrapDrag__Drag.pointerId) Na__LeScrapDrag__EndDrag();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Escape Ends a Drag
    // ------------------------------------------------------------
    function Na__LeScrapDrag__OnKeyDown(event) {
        if (!Na__LeScrapDrag__Drag || event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();                                             // <-- The drag's Escape, not the sheet tools'
        Na__LeScrapDrag__EndDrag();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Tile
// -----------------------------------------------------------------------------

    // FUNCTION | One Tile: the Item's Preview and Its Name
    // ------------------------------------------------------------
    // Every tile is styled alike whatever it holds, and whichever library it
    // comes from; spec.modifier adds a class for a library that needs a hook.
    // A spec whose buildSet answers nothing still gets a tile, with its name
    // and no picture, so a broken item can be seen and removed.
    // spec.caption(element, tile), when a library gives one, fills the caption
    // in place of the name - the Specification Scrapbook's rows say a note's
    // title and text, not one word. A caption that throws leaves the name.
    // ------------------------------------------------------------
    function Na__LeScrapDrag__Tile(spec) {
        const editable = spec.editable !== false;
        const tile = document.createElement('button');
        tile.type      = 'button';
        tile.className = Na__LeScrapDrag__TILE_CLASS + (spec.modifier ? ' ' + spec.modifier : '');
        tile.setAttribute('data-na-scrap-item', spec.id);
        tile.title    = spec.title || spec.name || spec.id;
        tile.disabled = !editable;

        const thumb = document.createElement('span');
        thumb.className = 'na-le-scrap__thumb';
        let preview = null;
        try { preview = Na__LeScrap__PreviewSvg(spec.buildSet(), 'na-le-scrap__svg'); } catch (error) { console.warn('[TrueVision3D LayoutEditor] A scrapbook preview could not be drawn: ' + spec.id, error); }
        if (preview) thumb.innerHTML = preview.markup;

        const caption = document.createElement('span');
        caption.className   = 'na-le-scrap__name';
        caption.textContent = spec.name || spec.id;
        if (typeof spec.caption === 'function') {
            try { caption.textContent = ''; spec.caption(caption, tile); }
            catch (error) { caption.textContent = spec.name || spec.id; console.warn('[TrueVision3D LayoutEditor] A scrapbook caption could not be written: ' + spec.id, error); }
        }

        tile.appendChild(thumb);
        tile.appendChild(caption);
        tile.addEventListener('pointerdown', (event) => Na__LeScrapDrag__OnPointerDown(event, tile, spec));
        tile.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();                                          // <-- Not the button's own click as well
            Na__LeScrapDrag__PlaceInView(spec);
        });
        return tile;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Scrapbook Tile Drag API
    // ------------------------------------------------------------
    export {
        Na__LeScrapDrag__Tile,
        Na__LeScrapDrag__Place,
        Na__LeScrapDrag__PlaceInView,
        Na__LeScrapDrag__EndDrag
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
