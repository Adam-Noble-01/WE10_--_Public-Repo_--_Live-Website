// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PANEL: CUSTOM SCRAPBOOK
// =============================================================================
//
// FILE       : Na__LayoutEditor__Panel__ScrapbookCustom__.js
// NAMESPACE  : Na__LePanelScrapCustom
// MODULE     : Layout Editor - Panel Custom Scrapbook
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The Custom Scrapbook's section: browse the saved items by category and drag them onto the paper, and save the current selection as a new one
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - ONE CATEGORY AT A TIME. The list at the top picks one of the library's
//   folders; its items show as tiles under it, newest first, and the same
//   choice is where a save goes - so what is saved appears in front of the
//   person who saved it. The choice is remembered per browser.
// - A TILE IS A SCRAPBOOK TILE: dragged onto the paper or double-clicked,
//   through Na__LayoutEditor__Scrapbook__TileDrag__ like every library's.
//   Right-click one to delete it, behind the house confirm dialog; the file
//   is moved to the library's quarantine folder, never erased.
// - SAVE THE SELECTION. Select anything on the sheet, name it, press Save.
//   The line under the button always says what Save would do, or why it
//   cannot: nothing selected, only viewports selected, no local server, or a
//   local server that needs restarting to load the scrapbook routes.
// - Shown on every sheet. Items are read a category at a time, as each is
//   first looked at.
//
// INTEGRATION:
// - Registered by the mode controller on the right column's Scrapbook tab,
//   after the Standard and the Parametric Scrapbooks.
// // @delegate: ./Na__LayoutEditor__ScrapbookCustom__.js
// // @delegate: ../55__Feature__Scrapbook/Na__LayoutEditor__Scrapbook__TileDrag__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (19-Sep-2026)
// - ValeVision    : not yet ported; see Na__LayoutEditor__ScrapbookCustom__.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Model, the Confirm Dialog, the Menu, the Tile Drag, the Panel Host, the Library and the Transport's Reasons
    // ------------------------------------------------------------
    import { Na__LeModel__CHANGED_EVENT, Na__LeModel__GetActiveSheet, Na__LeModel__GetSelectionItems } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__AppUtils__ConfirmDialog__Show } from '../../03__AppUtils/Na__AppUtils__ConfirmDialog.js';
    import { Na__LeMenu__Open } from '../30__System__SheetTools/Na__LayoutEditor__ContextMenu__.js';
    import { Na__LeScrap__TAB_ID } from '../55__Feature__Scrapbook/Na__LayoutEditor__Scrapbook__.js';
    import { Na__LeScrapDrag__Tile } from '../55__Feature__Scrapbook/Na__LayoutEditor__Scrapbook__TileDrag__.js';
    import {
        Na__LePanels__RegisterSection,
        Na__LePanels__Refresh,
        Na__LePanels__OnControl,
        Na__LePanels__IsEditable,
        Na__LePanels__GetContext,
        Na__LePanels__Row,
        Na__LePanels__Input,
        Na__LePanels__Select,
        Na__LePanels__FillSelect,
        Na__LePanels__Button,
        Na__LePanels__Note
    } from '../40__Ui__Panels/Na__LayoutEditor__PanelHost__.js';
    import {
        Na__LeScrapCustom__STATUS_LOADING,
        Na__LeScrapCustom__STATUS_FAILED,
        Na__LeScrapCustom__CHANGED_EVENT,
        Na__LeScrapCustom__Ready,
        Na__LeScrapCustom__Reload,
        Na__LeScrapCustom__Label,
        Na__LeScrapCustom__GetStatus,
        Na__LeScrapCustom__IsWritable,
        Na__LeScrapCustom__WhyReadOnly,
        Na__LeScrapCustom__MaxNameLength,
        Na__LeScrapCustom__Categories,
        Na__LeScrapCustom__CategoryName,
        Na__LeScrapCustom__EntriesIn,
        Na__LeScrapCustom__EntryName,
        Na__LeScrapCustom__GetItem,
        Na__LeScrapCustom__LoadCategory,
        Na__LeScrapCustom__BuildSet,
        Na__LeScrapCustom__Insert,
        Na__LeScrapCustom__Saveable,
        Na__LeScrapCustom__Save,
        Na__LeScrapCustom__Delete
    } from './Na__LayoutEditor__ScrapbookCustom__.js';
    import { Na__LeScrapCustomIo__WHY_RESTART } from './Na__LayoutEditor__ScrapbookCustom__Transport__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Section, Storage Key and the Changes the Save Line Answers To
    // ------------------------------------------------------------
    const Na__LePanelScrapCustom__ID            = 'scrapbook-custom';
    const Na__LePanelScrapCustom__STORE_KEY     = 'na-layouteditor-scrapbook-custom:category';
    const Na__LePanelScrapCustom__SAVE_REASONS  = Object.freeze([ 'selection', 'active', 'loaded', 'sheet-deleted' ]);   // <-- What can alter what Save would take
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Category on Show, Its Tiles and a Save in Flight
    // ------------------------------------------------------------
    let Na__LePanelScrapCustom__Category  = null;
    let Na__LePanelScrapCustom__Signature = null;   // <-- What the tiles were last built for, so a refresh per model change rebuilds nothing
    let Na__LePanelScrapCustom__Busy      = false;
    let Na__LePanelScrapCustom__Listening = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Say Something in the Editor's Toast
    // ------------------------------------------------------------
    function Na__LePanelScrapCustom__Toast(message, isError) {
        const context = Na__LePanels__GetContext();
        if (context && typeof context.showToast === 'function') context.showToast(message, isError === true);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Category on Show: the Remembered One, Else the First
    // ------------------------------------------------------------
    function Na__LePanelScrapCustom__CurrentCategory() {
        const categories = Na__LeScrapCustom__Categories();
        if (!categories.length) return null;
        if (Na__LePanelScrapCustom__Category === null) {
            try { Na__LePanelScrapCustom__Category = window.localStorage.getItem(Na__LePanelScrapCustom__STORE_KEY); } catch (error) { /* storage is a courtesy */ }
        }
        if (!categories.some((category) => category.folder === Na__LePanelScrapCustom__Category)) Na__LePanelScrapCustom__Category = categories[0].folder;
        return Na__LePanelScrapCustom__Category;
    }
    function Na__LePanelScrapCustom__SetCategory(folder) {
        Na__LePanelScrapCustom__Category = folder;
        try { window.localStorage.setItem(Na__LePanelScrapCustom__STORE_KEY, folder); } catch (error) { /* storage is a courtesy */ }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Tiles
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | An Index Entry as the Tile Drag's Spec
    // ------------------------------------------------------------
    function Na__LePanelScrapCustom__Spec(entry, itemDocument, editable) {
        const name = Na__LeScrapCustom__EntryName(entry);
        return {
            id       : 'custom:' + entry.Item__File,
            name     : name,
            title    : editable ? Na__LeScrapCustom__Label('ItemTitle', '{name}: drag onto the sheet, or double-click to place it in the middle of the view. Right-click to delete it.', { name : name }) : name,
            editable : editable,
            modifier : 'na-le-scrap__item--custom',
            buildSet : () => Na__LeScrapCustom__BuildSet(itemDocument),
            place    : (sheet, centreMm) => Na__LeScrapCustom__Insert(sheet, itemDocument, centreMm)
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Right-Click a Tile: Delete It, or Reload the Library
    // ------------------------------------------------------------
    // Delete asks first, and says where the file goes. A library that cannot
    // be written to still offers Reload.
    // ------------------------------------------------------------
    function Na__LePanelScrapCustom__OnTileMenu(event, entry) {
        event.preventDefault();
        const name = Na__LeScrapCustom__EntryName(entry);
        Na__LeMenu__Open(event.clientX, event.clientY, [
            { label : Na__LeScrapCustom__Label('MenuDelete', 'Delete {name}', { name : name }), danger : true, disabled : !Na__LeScrapCustom__IsWritable() || !Na__LePanels__IsEditable(),
              onSelect : async () => {
                  const ok = await Na__AppUtils__ConfirmDialog__Show({
                      title : Na__LeScrapCustom__Label('MenuDelete', 'Delete {name}', { name : name }),
                      message : Na__LeScrapCustom__Label('ConfirmDelete', 'Delete {name} from the Custom Scrapbook? The file is moved to the scrapbook\'s quarantine folder, not erased.', { name : name }),
                      confirmLabel : 'Delete', isDestructive : true
                  });
                  if (!ok) return;
                  const result = await Na__LeScrapCustom__Delete(entry);
                  Na__LePanelScrapCustom__Toast(result.ok
                      ? Na__LeScrapCustom__Label('ToastDeleted', 'Moved {name} to the scrapbook\'s quarantine folder.', { name : name })
                      : Na__LeScrapCustom__Label('ToastDeleteFailed', '{name} was not deleted: {reason}', { name : name, reason : result.error }), !result.ok);
              } },
            { separator : true },
            { label : Na__LeScrapCustom__Label('MenuReload', 'Reload the scrapbook'), onSelect : () => { Na__LeScrapCustom__Reload(); } }
        ]);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Section
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the Section Body
    // ------------------------------------------------------------
    function Na__LePanelScrapCustom__Build(body) {
        const L = Na__LeScrapCustom__Label;
        body.appendChild(Na__LePanels__Row(L('Category', 'Category'), Na__LePanels__Select('scrap-custom-category', [], null)));

        const note = Na__LePanels__Note('');
        note.setAttribute('data-na-scrap-custom', 'note');
        body.appendChild(note);

        const grid = document.createElement('div');
        grid.className = 'na-le-scrap';
        grid.setAttribute('data-na-scrap-custom', 'grid');
        body.appendChild(grid);

        const save = document.createElement('div');
        save.className = 'na-le-scrap-save';
        const heading = document.createElement('p');
        heading.className   = 'na-le-scrap-save__heading';
        heading.textContent = L('SaveHeading', 'Save the selection');
        save.appendChild(heading);
        const name = Na__LePanels__Input('text', 'scrap-custom-name', { maxLength : Na__LeScrapCustom__MaxNameLength() });
        name.placeholder = L('SaveNameHint', 'What to call it');
        save.appendChild(Na__LePanels__Row(L('SaveName', 'Name'), name));
        const bar = document.createElement('div');
        bar.className = 'na-le-bar';
        bar.appendChild(Na__LePanels__Button('', 'scrap-custom-save', ''));
        save.appendChild(bar);
        const status = Na__LePanels__Note('');
        status.setAttribute('data-na-scrap-custom', 'status');
        save.appendChild(status);
        body.appendChild(save);
        Na__LePanelScrapCustom__Signature = null;                            // <-- A new body has no tiles yet
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What the Line Under the Save Button Says, and Whether Save Can Run
    // ------------------------------------------------------------
    function Na__LePanelScrapCustom__SaveState(categoryName) {
        const L = Na__LeScrapCustom__Label;
        if (Na__LePanelScrapCustom__Busy) return { can : false, warn : false, text : L('Saving', 'Saving...') };
        if (!Na__LePanels__IsEditable())  return { can : false, warn : false, text : L('ReadOnlyView', 'Items can only be placed while sheets are editable.') };
        if (!Na__LeScrapCustom__IsWritable()) {
            const restart = Na__LeScrapCustom__WhyReadOnly() === Na__LeScrapCustomIo__WHY_RESTART;
            return { can : false, warn : true, text : restart
                ? L('SaveRestart', 'The ProjectVision local server is running without the scrapbook routes. Restart it, then save.')
                : L('SaveNoServer', 'Saving needs the ProjectVision local server. This library is read-only here.') };
        }
        const taken = Na__LeScrapCustom__Saveable(Na__LeModel__GetSelectionItems());
        if (!taken.roots.length) return { can : false, warn : taken.refused > 0, text : taken.refused > 0
            ? L('SaveViewports', 'Viewports cannot be saved: they belong to this project. Leave them out of the selection.')
            : L('SaveNothing', 'Select something on the sheet - vectors, text, leaders, dimensions or groups - to save it here.') };
        return { can : true, warn : false, text : L('SaveReady', '{count} selected. Name it and save it to {category}.', { count : taken.roots.length, category : categoryName })
            + (taken.refused > 0 ? ' ' + L('SaveViewports', 'Viewports cannot be saved: they belong to this project. Leave them out of the selection.') : '') };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect the Library and the Selection
    // ------------------------------------------------------------
    // The tiles are rebuilt only when what they show has changed; the save
    // line is rewritten every time, since it follows the selection.
    // ------------------------------------------------------------
    function Na__LePanelScrapCustom__Refresh(body) {
        const L        = Na__LeScrapCustom__Label;
        const status   = Na__LeScrapCustom__GetStatus();
        const editable = Na__LePanels__IsEditable();
        const folder   = Na__LePanelScrapCustom__CurrentCategory();
        const el       = (name) => body.querySelector('[data-na-control="' + name + '"]');
        const part     = (name) => body.querySelector('[data-na-scrap-custom="' + name + '"]');
        const entries  = folder ? Na__LeScrapCustom__EntriesIn(folder) : [];
        const category = Na__LeScrapCustom__CategoryName(folder);

        const select = el('scrap-custom-category');
        const counts = Na__LeScrapCustom__Categories().map((entry) => ({ value : entry.folder, label : entry.name + ' (' + Na__LeScrapCustom__EntriesIn(entry.folder).length + ')' }));
        if (document.activeElement !== select) Na__LePanels__FillSelect(select, counts, folder);
        select.disabled = false;                                             // <-- Browsing is never locked, even in a read-only session

        if (status === Na__LeScrapCustom__STATUS_LOADING) part('note').textContent = L('Loading', 'Reading the scrapbook...');
        else if (status === Na__LeScrapCustom__STATUS_FAILED) part('note').textContent = L('Failed', 'The custom scrapbook could not be read.');
        else if (!entries.length) part('note').textContent = L('Empty', 'Nothing saved in {category} yet.', { category : category });
        else part('note').textContent = editable ? L('Hint', 'Your saved items. Drag one onto the sheet, or double-click it. Right-click one to delete it.') : L('ReadOnlyView', 'Items can only be placed while sheets are editable.');

        if (folder) Na__LeScrapCustom__LoadCategory(folder);                   // <-- Asks only for what has not been read; tells this section when it lands
        const grid      = part('grid');
        const signature = [ status, editable ? 'edit' : 'view', folder ].concat(entries.map((entry) => entry.Item__File + '@' + entry.Item__UpdatedIso + (Na__LeScrapCustom__GetItem(entry) === undefined ? '?' : ''))).join('|');
        if (signature !== Na__LePanelScrapCustom__Signature) {
            Na__LePanelScrapCustom__Signature = signature;
            grid.innerHTML = '';
            entries.forEach((entry) => {
                const itemDocument = Na__LeScrapCustom__GetItem(entry);
                if (itemDocument === undefined) return;                       // <-- Still on its way: its tile arrives with it
                const tile = Na__LeScrapDrag__Tile(Na__LePanelScrapCustom__Spec(entry, itemDocument, editable && itemDocument !== null));
                tile.addEventListener('contextmenu', (event) => Na__LePanelScrapCustom__OnTileMenu(event, entry));
                grid.appendChild(tile);
            });
        }

        const state  = Na__LePanelScrapCustom__SaveState(category);
        const button = el('scrap-custom-save');
        button.textContent = L('SaveButton', 'Save Selection to {category}', { category : category });
        button.disabled    = !state.can;
        el('scrap-custom-name').disabled = !editable || !Na__LeScrapCustom__IsWritable();   // <-- The name can be typed before anything is selected
        part('status').textContent = state.text;
        part('status').classList.toggle('na-le-note--warn', state.warn);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Save the Selection Under the Typed Name
    // ------------------------------------------------------------
    async function Na__LePanelScrapCustom__OnSave(body) {
        if (Na__LePanelScrapCustom__Busy) return;
        const L      = Na__LeScrapCustom__Label;
        const sheet  = Na__LeModel__GetActiveSheet();
        const folder = Na__LePanelScrapCustom__CurrentCategory();
        const field  = body.querySelector('[data-na-control="scrap-custom-name"]');
        const name   = field ? field.value.trim() : '';
        if (!sheet || !folder) return;
        if (name === '') { Na__LePanelScrapCustom__Toast(L('SaveNeedsName', 'Give it a name first.'), true); if (field) field.focus(); return; }
        Na__LePanelScrapCustom__Busy = true;
        Na__LePanels__Refresh(Na__LePanelScrapCustom__ID);
        const result = await Na__LeScrapCustom__Save(sheet, Na__LeModel__GetSelectionItems(), name, folder);
        Na__LePanelScrapCustom__Busy = false;
        if (result.ok && field) field.value = '';
        Na__LePanelScrapCustom__Toast(result.ok
            ? L('ToastSaved', 'Saved {name} to {category}.', { name : name, category : Na__LeScrapCustom__CategoryName(folder) })
            : L('ToastSaveFailed', '{name} was not saved: {reason}', { name : name, reason : result.error }), !result.ok);
        Na__LePanels__Refresh(Na__LePanelScrapCustom__ID);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Changes That Redraw the Section
    // ------------------------------------------------------------
    function Na__LePanelScrapCustom__OnModelChanged(event) {
        const reason = (event && event.detail) ? event.detail.reason : '';
        if (Na__LePanelScrapCustom__SAVE_REASONS.indexOf(reason) !== -1) Na__LePanels__Refresh(Na__LePanelScrapCustom__ID);
    }
    function Na__LePanelScrapCustom__OnLibraryChanged() {
        Na__LePanels__Refresh(Na__LePanelScrapCustom__ID);
    }
    // ------------------------------------------------------------


    // FUNCTION | Register the Section and Its Controls
    // ------------------------------------------------------------
    function Na__LePanelScrapCustom__Register() {
        const link = document.createElement('link');
        link.rel  = 'stylesheet';
        link.href = new URL('./Na__LayoutEditor__Styles__ScrapbookCustom__.css', import.meta.url).href;
        document.head.appendChild(link);

        Na__LePanels__OnControl('change', 'scrap-custom-category', (event, el) => { Na__LePanelScrapCustom__SetCategory(el.value); Na__LePanels__Refresh(Na__LePanelScrapCustom__ID); });
        Na__LePanels__OnControl('click',  'scrap-custom-save',     (event, el) => { Na__LePanelScrapCustom__OnSave(el.closest('.na-le-section__body')); });
        Na__LePanels__OnControl('keydown', 'scrap-custom-name',    (event, el) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            Na__LePanelScrapCustom__OnSave(el.closest('.na-le-section__body'));
        });
        if (!Na__LePanelScrapCustom__Listening) {
            Na__LePanelScrapCustom__Listening = true;
            window.addEventListener(Na__LeModel__CHANGED_EVENT, Na__LePanelScrapCustom__OnModelChanged);
            window.addEventListener(Na__LeScrapCustom__CHANGED_EVENT, Na__LePanelScrapCustom__OnLibraryChanged);
        }
        const entry = Na__LePanels__RegisterSection('right', {
            id : Na__LePanelScrapCustom__ID, title : Na__LeScrapCustom__Label('Title', 'Custom Scrapbook'), tab : Na__LeScrap__TAB_ID,
            build : Na__LePanelScrapCustom__Build, refresh : Na__LePanelScrapCustom__Refresh
        });
        Na__LeScrapCustom__Ready().then(() => {
            const title = entry ? entry.root.querySelector('.na-le-section__title') : null;
            if (title) title.textContent = Na__LeScrapCustom__Label('Title', 'Custom Scrapbook');
            Na__LePanels__Refresh(Na__LePanelScrapCustom__ID);
        });
        return entry;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Custom Scrapbook Panel API
    // ------------------------------------------------------------
    export {
        Na__LePanelScrapCustom__Register
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
