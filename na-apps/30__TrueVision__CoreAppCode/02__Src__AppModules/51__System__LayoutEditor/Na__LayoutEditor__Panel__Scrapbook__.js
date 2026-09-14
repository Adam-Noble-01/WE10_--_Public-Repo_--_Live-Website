// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PANEL: SCRAPBOOK
// =============================================================================
//
// FILE       : Na__LayoutEditor__Panel__Scrapbook__.js
// NAMESPACE  : Na__LePanelScrap
// MODULE     : Layout Editor - Panel Scrapbook
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Show the Scrapbook's items for the active sheet and drag them onto the paper
// CREATED    : 14-Sep-2026
//
// DESCRIPTION:
// - One tile per item offered on the active sheet's drawing type
//   (Na__LayoutEditor__Scrapbook__), each with its preview and its name, and
//   every tile styled alike. The section only shows on a sheet that has
//   items - today, site plan sheets.
// - Press on a tile and drag: the item follows the pointer at the size it
//   will land at, the sheet's own zoom - faint away from the sheet, clear
//   over it. Let go over the sheet and it lands centred under the pointer,
//   grouped and selected, with the Select tool up. Escape, or letting go
//   anywhere else, drops nothing.
// - Double-click a tile, or press Enter on it, to place the item in the
//   middle of the view instead.
//
// INTEGRATION:
// - Registered in the left column by the mode controller, after Sheet.
// // @delegate: ./Na__LayoutEditor__Scrapbook__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (14-Sep-2026)
// - ValeVision    : not yet ported; see Na__LayoutEditor__Scrapbook__.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 14-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Model, Surface, Tools, Scrapbook and the Panel Host
    // ------------------------------------------------------------
    import { Na__LeModel__CHANGED_EVENT, Na__LeModel__GetActiveSheet, Na__LeModel__IsSitePlanSheet } from './Na__LayoutEditor__SheetModel__.js';
    import {
        Na__LeSurface__ClientToPaperMm,
        Na__LeSurface__GetElements,
        Na__LeSurface__GetPixelsPerMm,
        Na__LeSurface__GetZoom
    } from './Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeTools__TOOL_SELECT, Na__LeTools__SetTool } from './Na__LayoutEditor__SheetTools__.js';
    import {
        Na__LeScrap__STATUS_FAILED,
        Na__LeScrap__Ready,
        Na__LeScrap__GetStatus,
        Na__LeScrap__Label,
        Na__LeScrap__ItemsFor,
        Na__LeScrap__ItemName,
        Na__LeScrap__BuildSet,
        Na__LeScrap__PreviewSvg,
        Na__LeScrap__Insert
    } from './Na__LayoutEditor__Scrapbook__.js';
    import {
        Na__LePanels__RegisterSection,
        Na__LePanels__SetSectionVisible,
        Na__LePanels__Refresh,
        Na__LePanels__OnControl,
        Na__LePanels__IsEditable,
        Na__LePanels__Note
    } from './Na__LayoutEditor__PanelHost__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Section, Control, Classes and Gestures
    // ------------------------------------------------------------
    const Na__LePanelScrap__ID              = 'scrapbook';
    const Na__LePanelScrap__CONTROL         = 'scrapbook-item';
    const Na__LePanelScrap__GHOST_CLASS     = 'na-le-scrap-ghost';
    const Na__LePanelScrap__BODY_CLASS      = 'na-le-scrap-dragging';
    const Na__LePanelScrap__OVER_CLASS      = 'is-over-sheet';
    const Na__LePanelScrap__DRAG_START_PX   = 4;                                // <-- A press that moves less than this is a click, not a drag
    const Na__LePanelScrap__DOUBLE_PRESS_MS = 450;                              // <-- Two clicks on one tile inside this are a double-click
    const Na__LePanelScrap__SHOW_REASONS    = Object.freeze([ 'active', 'loaded', 'sheet-created', 'sheet-deleted', 'sheet-updated' ]);   // <-- The changes that can alter which sheet, or which drawing type, is up
    // ------------------------------------------------------------

    // MODULE VARIABLES | Tiles, the Drag and the Last Click
    // ------------------------------------------------------------
    let Na__LePanelScrap__Signature = null;     // <-- What the tiles were last built for, so a refresh per model change rebuilds nothing
    let Na__LePanelScrap__Drag      = null;     // <-- { pointerId, itemId, tile, startX, startY, set, preview, ghost, over }
    let Na__LePanelScrap__LastClick = null;     // <-- { itemId, time } of a press that ended without a drag
    let Na__LePanelScrap__Listening = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Placing an Item
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Stage, When It Is on the Screen
    // ------------------------------------------------------------
    function Na__LePanelScrap__Stage() {
        const stage = Na__LeSurface__GetElements().stage;
        return (stage && stage.isConnected) ? stage : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is a Client Point Over the Sheet's Stage
    // ------------------------------------------------------------
    function Na__LePanelScrap__IsOverSheet(clientX, clientY) {
        const stage = Na__LePanelScrap__Stage();
        if (!stage) return false;
        const rect = stage.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    }
    // ------------------------------------------------------------


    // FUNCTION | Place an Item Centred on a Paper Point
    // ------------------------------------------------------------
    // The Select tool comes up first, so a tool part way through placing lets
    // go and the new group can be dragged at once. The stage takes the focus,
    // so Delete, the arrow keys and Ctrl+Z act on the item straight away.
    // ------------------------------------------------------------
    function Na__LePanelScrap__Place(itemId, centreMm) {
        const sheet = Na__LeModel__GetActiveSheet();
        if (!sheet || !centreMm || !Na__LePanels__IsEditable()) return null;
        Na__LeTools__SetTool(Na__LeTools__TOOL_SELECT);
        const placed = Na__LeScrap__Insert(sheet, itemId, centreMm);
        const stage  = Na__LePanelScrap__Stage();
        if (placed && stage) { try { stage.focus({ preventScroll : true }); } catch (error) { /* focus is a courtesy */ } }
        return placed;
    }
    // ------------------------------------------------------------


    // FUNCTION | Place an Item in the Middle of the View
    // ------------------------------------------------------------
    // A view scrolled off the paper still places on it: the drop is kept on
    // the paper the way a paste is.
    // ------------------------------------------------------------
    function Na__LePanelScrap__PlaceInView(itemId) {
        const stage = Na__LePanelScrap__Stage();
        if (!stage || !itemId) return null;
        const rect = stage.getBoundingClientRect();
        return Na__LePanelScrap__Place(itemId, Na__LeSurface__ClientToPaperMm(rect.left + (rect.width / 2), rect.top + (rect.height / 2)));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Dragging an Item
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Put Up the Ghost the Drag Carries
    // ------------------------------------------------------------
    function Na__LePanelScrap__StartGhost(drag) {
        drag.set     = Na__LeScrap__BuildSet(drag.itemId);
        drag.preview = drag.set ? Na__LeScrap__PreviewSvg(drag.set, 'na-le-scrap-ghost__svg') : null;
        if (!drag.preview) return false;
        drag.ghost = document.createElement('div');
        drag.ghost.className = Na__LePanelScrap__GHOST_CLASS;
        drag.ghost.innerHTML = drag.preview.markup;
        document.body.appendChild(drag.ghost);
        document.body.classList.add(Na__LePanelScrap__BODY_CLASS);
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Keep the Ghost Under the Pointer, at the Sheet's Zoom
    // ------------------------------------------------------------
    // The item's centre sits on the pointer, where it will land. The preview
    // has a little room round the item, so its corner is offset by that room.
    // ------------------------------------------------------------
    function Na__LePanelScrap__MoveGhost(drag, clientX, clientY) {
        const pxPerMm = Na__LeSurface__GetPixelsPerMm() * Na__LeSurface__GetZoom();
        const preview = drag.preview;
        const centreX = drag.set.origin.x + (drag.set.size.WidthMm  / 2);
        const centreY = drag.set.origin.y + (drag.set.size.HeightMm / 2);
        const style   = drag.ghost.style;
        style.width     = (preview.widthMm  * pxPerMm) + 'px';
        style.height    = (preview.heightMm * pxPerMm) + 'px';
        style.transform = 'translate(' + (clientX - ((centreX - preview.leftMm) * pxPerMm)) + 'px, ' + (clientY - ((centreY - preview.topMm) * pxPerMm)) + 'px)';
        const over = Na__LePanelScrap__IsOverSheet(clientX, clientY);
        if (over === drag.over) return;
        drag.over = over;
        drag.ghost.classList.toggle('is-over', over);
        document.body.classList.toggle(Na__LePanelScrap__OVER_CLASS, over);
    }
    // ------------------------------------------------------------


    // FUNCTION | End the Drag, Dropping Nothing
    // ------------------------------------------------------------
    function Na__LePanelScrap__EndDrag() {
        const drag = Na__LePanelScrap__Drag;
        Na__LePanelScrap__Drag = null;
        window.removeEventListener('pointermove',   Na__LePanelScrap__OnPointerMove, true);
        window.removeEventListener('pointerup',     Na__LePanelScrap__OnPointerUp, true);
        window.removeEventListener('pointercancel', Na__LePanelScrap__OnPointerCancel, true);
        window.removeEventListener('keydown',       Na__LePanelScrap__OnKeyDown, true);
        document.body.classList.remove(Na__LePanelScrap__BODY_CLASS, Na__LePanelScrap__OVER_CLASS);
        if (!drag) return;
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
    function Na__LePanelScrap__OnPointerDown(event, tile, itemId) {
        if (event.button !== 0 || Na__LePanelScrap__Drag || !Na__LePanels__IsEditable()) return;
        event.preventDefault();                                              // <-- No text selection, and no focus ring from a press
        Na__LePanelScrap__Drag = { pointerId : event.pointerId, itemId : itemId, tile : tile, startX : event.clientX, startY : event.clientY, set : null, preview : null, ghost : null, over : false };
        try { tile.setPointerCapture(event.pointerId); } catch (error) { /* the window listeners still follow the pointer */ }
        window.addEventListener('pointermove',   Na__LePanelScrap__OnPointerMove, true);
        window.addEventListener('pointerup',     Na__LePanelScrap__OnPointerUp, true);
        window.addEventListener('pointercancel', Na__LePanelScrap__OnPointerCancel, true);
        window.addEventListener('keydown',       Na__LePanelScrap__OnKeyDown, true);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Move: Start the Ghost Once It Is a Drag, Then Follow
    // ------------------------------------------------------------
    function Na__LePanelScrap__OnPointerMove(event) {
        const drag = Na__LePanelScrap__Drag;
        if (!drag || event.pointerId !== drag.pointerId) return;
        if (!drag.ghost) {
            if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < Na__LePanelScrap__DRAG_START_PX) return;
            if (!Na__LePanelScrap__StartGhost(drag)) { Na__LePanelScrap__EndDrag(); return; }
        }
        Na__LePanelScrap__MoveGhost(drag, event.clientX, event.clientY);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Let Go: Drop Over the Sheet, or Count a Click
    // ------------------------------------------------------------
    // A double-click is counted here from two presses that never became
    // drags, rather than from dblclick: the press is cancelled to keep the
    // drag clean, and a browser is free to drop the mouse events it would
    // have built a dblclick from.
    // ------------------------------------------------------------
    function Na__LePanelScrap__OnPointerUp(event) {
        const drag = Na__LePanelScrap__Drag;
        if (!drag || event.pointerId !== drag.pointerId) return;
        const dragged = !!drag.ghost;
        const itemId  = drag.itemId;
        Na__LePanelScrap__EndDrag();
        if (dragged) {
            Na__LePanelScrap__LastClick = null;
            if (Na__LePanelScrap__IsOverSheet(event.clientX, event.clientY)) Na__LePanelScrap__Place(itemId, Na__LeSurface__ClientToPaperMm(event.clientX, event.clientY));
            return;
        }
        const last = Na__LePanelScrap__LastClick;
        const now  = event.timeStamp;
        if (last && last.itemId === itemId && (now - last.time) <= Na__LePanelScrap__DOUBLE_PRESS_MS) {
            Na__LePanelScrap__LastClick = null;
            Na__LePanelScrap__PlaceInView(itemId);
            return;
        }
        Na__LePanelScrap__LastClick = { itemId : itemId, time : now };
    }
    function Na__LePanelScrap__OnPointerCancel(event) {
        if (Na__LePanelScrap__Drag && event.pointerId === Na__LePanelScrap__Drag.pointerId) Na__LePanelScrap__EndDrag();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Escape Ends a Drag
    // ------------------------------------------------------------
    function Na__LePanelScrap__OnKeyDown(event) {
        if (!Na__LePanelScrap__Drag || event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();                                             // <-- The drag's Escape, not the sheet tools'
        Na__LePanelScrap__EndDrag();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Section
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One Tile: the Item's Preview and Its Name
    // ------------------------------------------------------------
    function Na__LePanelScrap__Tile(item, editable) {
        const name = Na__LeScrap__ItemName(item);
        const tile = document.createElement('button');
        tile.type      = 'button';
        tile.className = 'na-le-scrap__item';
        tile.setAttribute('data-na-control', Na__LePanelScrap__CONTROL);
        tile.setAttribute('data-na-role', item.Item__Id);
        tile.title    = editable ? Na__LeScrap__Label('ItemTitle', '{name}: drag onto the sheet, or double-click to place it in the middle of the view.', { name : name }) : name;
        tile.disabled = !editable;

        const thumb   = document.createElement('span');
        thumb.className = 'na-le-scrap__thumb';
        const preview = Na__LeScrap__PreviewSvg(Na__LeScrap__BuildSet(item), 'na-le-scrap__svg');
        if (preview) thumb.innerHTML = preview.markup;

        const caption = document.createElement('span');
        caption.className   = 'na-le-scrap__name';
        caption.textContent = name;

        tile.appendChild(thumb);
        tile.appendChild(caption);
        tile.addEventListener('pointerdown', (event) => Na__LePanelScrap__OnPointerDown(event, tile, item.Item__Id));
        return tile;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Section Body
    // ------------------------------------------------------------
    function Na__LePanelScrap__Build(body) {
        const note = Na__LePanels__Note('');
        note.setAttribute('data-na-scrap', 'note');
        const grid = document.createElement('div');
        grid.className = 'na-le-scrap';
        grid.setAttribute('data-na-scrap', 'grid');
        body.appendChild(note);
        body.appendChild(grid);
        Na__LePanelScrap__Signature = null;                                  // <-- A new body has no tiles yet
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect the Active Sheet
    // ------------------------------------------------------------
    function Na__LePanelScrap__Refresh(body) {
        const sheet    = Na__LeModel__GetActiveSheet();
        const status   = Na__LeScrap__GetStatus();
        const editable = Na__LePanels__IsEditable();
        const items    = Na__LeScrap__ItemsFor(sheet);
        const note     = body.querySelector('[data-na-scrap="note"]');
        const grid     = body.querySelector('[data-na-scrap="grid"]');
        if (note) {
            if (status === Na__LeScrap__STATUS_FAILED) note.textContent = Na__LeScrap__Label('Failed', 'The scrapbook could not be read, so it has no items.');
            else if (editable) note.textContent = Na__LeScrap__Label('Hint', 'Drag an item onto the sheet. Double-click one to place it in the middle of the view.');
            else note.textContent = Na__LeScrap__Label('ReadOnly', 'Items can only be placed while sheets are editable.');
        }
        if (!grid) return;
        const signature = [ status, editable ? 'edit' : 'view' ].concat(items.map((item) => item.Item__Id)).join('|');
        if (signature === Na__LePanelScrap__Signature) return;
        Na__LePanelScrap__Signature = signature;
        grid.innerHTML = '';
        items.forEach((item) => grid.appendChild(Na__LePanelScrap__Tile(item, editable)));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show the Section Only on a Sheet That Has Items
    // ------------------------------------------------------------
    // Run on every change of sheet or drawing type, folded or not - a panel
    // refresh skips a folded section, and a folded Scrapbook must still leave
    // an architectural sheet. A config that could not be read still shows on
    // a site plan sheet, where the items are expected, to say so.
    // ------------------------------------------------------------
    function Na__LePanelScrap__Sync() {
        const sheet  = Na__LeModel__GetActiveSheet();
        const failed = Na__LeScrap__GetStatus() === Na__LeScrap__STATUS_FAILED;
        const show   = !!sheet && (Na__LeScrap__ItemsFor(sheet).length > 0 || (failed && Na__LeModel__IsSitePlanSheet(sheet)));
        Na__LePanels__SetSectionVisible(Na__LePanelScrap__ID, show);
        if (!show) { Na__LePanelScrap__EndDrag(); return; }
        Na__LePanels__Refresh(Na__LePanelScrap__ID);
    }
    function Na__LePanelScrap__OnModelChanged(event) {
        const reason = (event && event.detail) ? event.detail.reason : '';
        if (Na__LePanelScrap__SHOW_REASONS.indexOf(reason) !== -1) Na__LePanelScrap__Sync();
    }
    // ------------------------------------------------------------


    // FUNCTION | Register the Section and Its Controls
    // ------------------------------------------------------------
    function Na__LePanelScrap__Register() {
        Na__LePanels__OnControl('keydown', Na__LePanelScrap__CONTROL, (event, el, itemId) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();                                          // <-- Not the button's own click as well
            Na__LePanelScrap__PlaceInView(itemId);
        });
        if (!Na__LePanelScrap__Listening) {
            Na__LePanelScrap__Listening = true;
            window.addEventListener(Na__LeModel__CHANGED_EVENT, Na__LePanelScrap__OnModelChanged);
        }
        const entry = Na__LePanels__RegisterSection('left', {
            id : Na__LePanelScrap__ID, title : Na__LeScrap__Label('Title', 'Scrapbook'),
            build : Na__LePanelScrap__Build, refresh : Na__LePanelScrap__Refresh
        });
        Na__LePanels__SetSectionVisible(Na__LePanelScrap__ID, false);           // <-- Hidden until the config says the active sheet has items
        Na__LeScrap__Ready().then(() => {
            const title = entry ? entry.root.querySelector('.na-le-section__title') : null;
            if (title) title.textContent = Na__LeScrap__Label('Title', 'Scrapbook');
            Na__LePanelScrap__Sync();
        });
        return entry;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Scrapbook Panel API
    // ------------------------------------------------------------
    export {
        Na__LePanelScrap__Register,
        Na__LePanelScrap__PlaceInView
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
