// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PANEL: SCRAPBOOK
// =============================================================================
//
// FILE       : Na__LayoutEditor__Panel__Scrapbook__.js
// NAMESPACE  : Na__LePanelScrap
// MODULE     : Layout Editor - Panel Scrapbook
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Show the Standard Scrapbook's items for the active sheet
// CREATED    : 14-Sep-2026
//
// DESCRIPTION:
// - One tile per item offered on the active sheet's drawing type
//   (Na__LayoutEditor__Scrapbook__), each with its preview and its name, and
//   every tile styled alike. The section only shows on a sheet that has
//   items - today, site plan sheets.
// - This is the Standard library: items a developer wrote into the config.
//   The Custom library (56__Feature__ScrapbookCustom) and the Parametric one
//   (57__Feature__ScrapbookParametric) have sections of their own.
// - A tile is dragged onto the paper, or double-clicked to land in the middle
//   of the view. Both gestures belong to Na__LayoutEditor__Scrapbook__TileDrag__,
//   which every scrapbook library shares.
//
// INTEGRATION:
// - Registered in the left column by the mode controller, after Sheet.
// // @delegate: ./Na__LayoutEditor__Scrapbook__.js
// // @delegate: ./Na__LayoutEditor__Scrapbook__TileDrag__.js
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
// 19-Sep-2026 - Version 1.1.0
// - The tile, its drag, its ghost and its drop moved out to
//   Na__LayoutEditor__Scrapbook__TileDrag__, so the Custom and Parametric
//   scrapbooks drag the same way from the same code. Nothing about the
//   gestures changed. The keyboard placing is the tile's own now, rather
//   than a delegated panel control.
//
// 14-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Model, Scrapbook, the Tile Drag and the Panel Host
    // ------------------------------------------------------------
    import { Na__LeModel__CHANGED_EVENT, Na__LeModel__GetActiveSheet, Na__LeModel__IsSitePlanSheet } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import {
        Na__LeScrap__STATUS_FAILED,
        Na__LeScrap__Ready,
        Na__LeScrap__GetStatus,
        Na__LeScrap__Label,
        Na__LeScrap__ItemsFor,
        Na__LeScrap__GetItem,
        Na__LeScrap__ItemName,
        Na__LeScrap__BuildSet,
        Na__LeScrap__Insert
    } from './Na__LayoutEditor__Scrapbook__.js';
    import { Na__LeScrapDrag__Tile, Na__LeScrapDrag__PlaceInView, Na__LeScrapDrag__EndDrag } from './Na__LayoutEditor__Scrapbook__TileDrag__.js';
    import {
        Na__LePanels__RegisterSection,
        Na__LePanels__SetSectionVisible,
        Na__LePanels__Refresh,
        Na__LePanels__IsEditable,
        Na__LePanels__Note
    } from '../40__Ui__Panels/Na__LayoutEditor__PanelHost__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Section and the Changes That Can Alter What It Shows
    // ------------------------------------------------------------
    const Na__LePanelScrap__ID           = 'scrapbook';
    const Na__LePanelScrap__SHOW_REASONS = Object.freeze([ 'active', 'loaded', 'sheet-created', 'sheet-deleted', 'sheet-updated' ]);   // <-- The changes that can alter which sheet, or which drawing type, is up
    // ------------------------------------------------------------

    // MODULE VARIABLES | Tiles
    // ------------------------------------------------------------
    let Na__LePanelScrap__Signature = null;     // <-- What the tiles were last built for, so a refresh per model change rebuilds nothing
    let Na__LePanelScrap__Listening = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Items as Tiles
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | An Item as the Tile Drag's Spec
    // ------------------------------------------------------------
    function Na__LePanelScrap__Spec(item, editable) {
        const name = Na__LeScrap__ItemName(item);
        return {
            id       : 'standard:' + item.Item__Id,
            name     : name,
            title    : editable ? Na__LeScrap__Label('ItemTitle', '{name}: drag onto the sheet, or double-click to place it in the middle of the view.', { name : name }) : name,
            editable : editable,
            buildSet : () => Na__LeScrap__BuildSet(item),
            place    : (sheet, centreMm) => Na__LeScrap__Insert(sheet, item.Item__Id, centreMm)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Place an Item in the Middle of the View, by Its Id
    // ------------------------------------------------------------
    function Na__LePanelScrap__PlaceInView(itemId) {
        const item = Na__LeScrap__GetItem(itemId);
        return item ? Na__LeScrapDrag__PlaceInView(Na__LePanelScrap__Spec(item, Na__LePanels__IsEditable())) : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Section
// -----------------------------------------------------------------------------

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
        items.forEach((item) => grid.appendChild(Na__LeScrapDrag__Tile(Na__LePanelScrap__Spec(item, editable))));
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
        if (!show) { Na__LeScrapDrag__EndDrag(); return; }
        Na__LePanels__Refresh(Na__LePanelScrap__ID);
    }
    function Na__LePanelScrap__OnModelChanged(event) {
        const reason = (event && event.detail) ? event.detail.reason : '';
        if (Na__LePanelScrap__SHOW_REASONS.indexOf(reason) !== -1) Na__LePanelScrap__Sync();
    }
    // ------------------------------------------------------------


    // FUNCTION | Register the Section
    // ------------------------------------------------------------
    function Na__LePanelScrap__Register() {
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
