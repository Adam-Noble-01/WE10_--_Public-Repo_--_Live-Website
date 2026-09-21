// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PANEL - SHEET IMAGES
// =============================================================================
//
// FILE       : Na__LayoutEditor__Panel__SheetImages__.js
// NAMESPACE  : Na__LePanelImages
// MODULE     : Layout Editor - Panel - Sheet Images
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The Images section: the selected picture's file, folder, print resolution, width and frame
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - On the Properties tab, opened by itself when a picture is selected
//   (the mode controller's SectionForKind), folded with the rest otherwise.
// - WHAT IT SAYS: the file the picture is stored as and the document folder
//   it is filed in - so a renumber can be seen to have moved it - its pixel
//   size, and the resolution it prints at the size it is drawn, with a
//   warning when that is soft. WHAT IT SETS: the width (the height follows:
//   a picture is never stretched), the frame, and the crop and replace
//   actions the right-click menu offers.
// - Several pictures selected: how many, and one frame switch for all.
// - PRINT SIZE: the save stores a picture at the pixels a print needs at its
//   size on the sheet. Pixels says so ("2320 x 1305 of 3840 x 2160"), and
//   the note under Prints at says what happens next when the picture is
//   drawn larger than it was stored for: the next save cuts it again (its
//   original is in memory this session), or Replace brings the pixels back
//   (it was saved in an earlier session), or - the original has no more -
//   it may print soft.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.1.0
// - Pixels shows the original's size beside the stored one; the note under
//   Prints at knows about print-size storage (Na__LeImgPub__HasSource).
//
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Panel Host, Model and the Feature
    // ------------------------------------------------------------
    import {
        Na__LePanels__RegisterSection,
        Na__LePanels__OnControl,
        Na__LePanels__Refresh,
        Na__LePanels__IsEditable,
        Na__LePanels__Row,
        Na__LePanels__Input,
        Na__LePanels__Button,
        Na__LePanels__Note
    } from '../40__Ui__Panels/Na__LayoutEditor__PanelHost__.js';
    import { Na__LeModel__GetActiveSheet, Na__LeModel__GetShapeById, Na__LeModel__GetSelectionItems, Na__LeModel__UpdateShape, Na__LeModel__IsLayerLocked } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeImgGeo__Rect, Na__LeImgGeo__RectPoints, Na__LeImgGeo__PrintDpi } from './Na__LayoutEditor__SheetImages__Geometry__.js';
    import { Na__LeImgCfg__Label, Na__LeImgCfg__Ready, Na__LeImgCfg__Placement, Na__LeImgCfg__Storage } from './Na__LayoutEditor__SheetImages__Setup__.js';
    import { Na__LeImgDraw__Block } from './Na__LayoutEditor__SheetImages__Paint__.js';
    import { Na__LeImgCrop__Open } from './Na__LayoutEditor__SheetImages__Crop__.js';
    import { Na__LeImgIns__Pick, Na__LeImgIns__Replace } from './Na__LayoutEditor__SheetImages__Insert__.js';
    import { Na__LeImgMenu__SetFrame, Na__LeImgMenu__ResetCrop } from './Na__LayoutEditor__SheetImages__Menu__.js';
    import { Na__LeImgPub__HasSource } from './Na__LayoutEditor__SheetImages__Publish__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Section, the Resolution That Starts to Print Soft, and How Near Print Size Counts as There
    // ------------------------------------------------------------
    const Na__LePanelImages__ID       = 'images';
    const Na__LePanelImages__SOFT_DPI = 150;
    const Na__LePanelImages__NEAR     = 0.95;                                    // <-- The save's own slack: within it a picture is not cut again
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Pictures Selected on the Active Sheet
    // ------------------------------------------------------------
    // Read off the selection itself: the panel host's SelectedOfKind answers
    // only for a selection of two or more, and one picture is the usual case.
    // ------------------------------------------------------------
    function Na__LePanelImages__Selected() {
        const sheet = Na__LeModel__GetActiveSheet();
        if (!sheet) return { sheet : null, shapes : [] };
        const shapes = Na__LeModel__GetSelectionItems()
            .filter((item) => item && item.kind === 'shape')
            .map((item) => Na__LeModel__GetShapeById(sheet, item.id))
            .filter((shape) => !!Na__LeImgDraw__Block(shape));
        return { sheet : sheet, shapes : shapes };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Read-Only Value in a Row
    // ------------------------------------------------------------
    function Na__LePanelImages__Value(role) {
        const span = document.createElement('span');
        span.className = 'na-le-img-panel__value';
        span.setAttribute('data-na-img-value', role);
        return span;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Build and Refresh
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the Section Once
    // ------------------------------------------------------------
    function Na__LePanelImages__Build(body) {
        const L = Na__LeImgCfg__Label;
        const none = Na__LePanels__Note(L('PanelNone', 'Select a picture on the sheet to see its file, its print resolution and its frame. Drag picture files onto the sheet, or use the Image button, to place one.'));
        none.setAttribute('data-na-img-part', 'none');
        body.appendChild(none);

        const one = document.createElement('div');
        one.setAttribute('data-na-img-part', 'one');
        one.appendChild(Na__LePanels__Row(L('PanelFile', 'File'),     Na__LePanelImages__Value('file')));
        one.appendChild(Na__LePanels__Row(L('PanelFolder', 'Folder'), Na__LePanelImages__Value('folder')));
        one.appendChild(Na__LePanels__Row(L('PanelPixels', 'Pixels'), Na__LePanelImages__Value('pixels')));
        one.appendChild(Na__LePanels__Row(L('PanelPrints', 'Prints at'), Na__LePanelImages__Value('dpi')));
        one.appendChild(Na__LePanels__Row(L('PanelWidth', 'Width (mm)'), Na__LePanels__Input('number', 'img-width', { min : 1, step : 1 })));
        const soft = Na__LePanels__Note('');
        soft.className += ' na-le-img-panel__soft';
        soft.setAttribute('data-na-img-part', 'soft');
        one.appendChild(soft);
        body.appendChild(one);

        const many = Na__LePanels__Note('');
        many.setAttribute('data-na-img-part', 'many');
        body.appendChild(many);

        const frame = Na__LePanels__Input('checkbox', 'img-frame');
        const frameRow = Na__LePanels__Row(L('PanelFrame', 'Frame'), frame);
        frameRow.setAttribute('data-na-img-part', 'frame');
        body.appendChild(frameRow);

        const actions = document.createElement('div');
        actions.className = 'na-le-row na-le-img-panel__actions';
        actions.setAttribute('data-na-img-part', 'actions');
        actions.appendChild(Na__LePanels__Button(L('MenuCrop', 'Crop picture...'), 'img-crop'));
        actions.appendChild(Na__LePanels__Button(L('MenuResetCrop', 'Reset crop'), 'img-reset-crop'));
        actions.appendChild(Na__LePanels__Button(L('MenuReplace', 'Replace picture...'), 'img-replace'));
        body.appendChild(actions);

        if (Na__LePanels__IsEditable()) {
            const place = document.createElement('div');
            place.className = 'na-le-row na-le-img-panel__actions';
            place.appendChild(Na__LePanels__Button(L('ToolImage', 'Image') + '...', 'img-place', 'na-le-btn--primary'));
            body.appendChild(place);
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show What Is Selected
    // ------------------------------------------------------------
    function Na__LePanelImages__Refresh(body) {
        const L      = Na__LeImgCfg__Label;
        const picked = Na__LePanelImages__Selected();
        const count  = picked.shapes.length;
        const part   = (name) => body.querySelector('[data-na-img-part="' + name + '"]');
        const value  = (name) => body.querySelector('[data-na-img-value="' + name + '"]');
        part('none').hidden    = count > 0;
        part('one').hidden     = count !== 1;
        part('many').hidden    = count < 2;
        part('frame').hidden   = count < 1;
        part('actions').hidden = count !== 1;
        if (!count) return;

        const locked = picked.shapes.some((shape) => Na__LeModel__IsLayerLocked(picked.sheet, shape.Shape__LayerId));
        const frames = picked.shapes.map((shape) => Na__LeImgDraw__Block(shape).Image__Frame !== false);
        const frame  = body.querySelector('[data-na-control="img-frame"]');
        frame.checked       = frames.every(Boolean);
        frame.indeterminate = !frames.every(Boolean) && frames.some(Boolean);
        frame.disabled      = locked || !Na__LePanels__IsEditable();

        if (count > 1) {
            part('many').textContent = L('PanelMany', '{count} pictures selected.', { count : count });
            return;
        }
        const shape = picked.shapes[0];
        const block = Na__LeImgDraw__Block(shape);
        const rect  = Na__LeImgGeo__Rect(shape.Shape__Points);
        const dpi   = Math.round(Na__LeImgGeo__PrintDpi(rect, block.Image__PixelW, block.Image__PixelH, block.Image__Crop));
        const cut   = block.Image__SourceW > block.Image__PixelW;                // <-- Stored with fewer pixels than the original: sized for print
        value('file').textContent   = block.Image__Name || block.Image__File;
        value('file').title         = block.Image__File;
        value('folder').textContent = block.Image__Folder || '-';
        value('pixels').textContent = cut
            ? L('PanelPixelsOf', '{w} x {h} of {sw} x {sh}', { w : block.Image__PixelW, h : block.Image__PixelH, sw : block.Image__SourceW, sh : block.Image__SourceH }) + (block.Image__Crop ? ' (cropped)' : '')
            : block.Image__PixelW + ' x ' + block.Image__PixelH + (block.Image__Crop ? ' (cropped)' : '');
        value('dpi').textContent    = dpi + ' dpi';
        const width = body.querySelector('[data-na-control="img-width"]');
        if (document.activeElement !== width) width.value = rect.w.toFixed(1);
        width.disabled = locked || !Na__LePanels__IsEditable();
        // THE NOTE | What happens when the picture is drawn larger than it was
        // stored for. The print dpi, not the dpi times any headroom: the note
        // is about what prints.
        const printDpi = Math.round(Na__LeImgCfg__Storage().printDpi);
        const held     = Na__LeImgPub__HasSource(block.Image__File);              // <-- Dropped or replaced this session: the next save cuts it from the original
        const best     = cut ? Math.round(Na__LeImgGeo__PrintDpi(rect, block.Image__SourceW, block.Image__SourceH, block.Image__Crop)) : dpi;   // <-- The most the original can give here
        const over     = dpi > printDpi / Na__LePanelImages__NEAR && Math.max(block.Image__PixelW, block.Image__PixelH) > 256;
        const under    = dpi < printDpi * Na__LePanelImages__NEAR && best > dpi / Na__LePanelImages__NEAR;
        const soft     = part('soft');
        let   note = '', info = false;
        if (held && (over || under)) {
            note = L('PanelRecut', 'Saving stores it at {dpi} dpi for this size.', { dpi : Math.min(printDpi, best) });
            info = true;
        } else if (under) {
            note = L('PanelReplace', 'Stored for a smaller size. Replace it with the original render to print sharp at {dpi} dpi.', { dpi : Math.min(printDpi, best) });
        } else if (dpi < Na__LePanelImages__SOFT_DPI) {
            note = L('PanelLowRes', 'Below {dpi} dpi at this size: it may print soft.', { dpi : Na__LePanelImages__SOFT_DPI });
        }
        soft.hidden      = !note;
        soft.textContent = note;
        soft.classList.toggle('na-le-img-panel__soft--info', info);
        body.querySelector('[data-na-control="img-reset-crop"]').disabled = locked || !block.Image__Crop;
        body.querySelector('[data-na-control="img-crop"]').disabled       = locked;
        body.querySelector('[data-na-control="img-replace"]').disabled    = locked;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Registration
// -----------------------------------------------------------------------------

    // FUNCTION | Register the Section and Its Controls
    // ------------------------------------------------------------
    function Na__LePanelImages__Register() {
        const on    = Na__LePanels__OnControl;
        const again = () => Na__LePanels__Refresh(Na__LePanelImages__ID);

        on('click', 'img-place', () => { Na__LeImgIns__Pick(); });
        on('change', 'img-frame', (event, el) => {
            const picked = Na__LePanelImages__Selected();
            picked.shapes.forEach((shape) => Na__LeImgMenu__SetFrame(picked.sheet, shape.Shape__Id, el.checked));
            again();
        });
        on('change', 'img-width', (event, el) => {
            const picked = Na__LePanelImages__Selected();
            const want   = parseFloat(el.value);
            if (picked.shapes.length !== 1 || !(want > 0)) { again(); return; }
            const shape = picked.shapes[0];
            const rect  = Na__LeImgGeo__Rect(shape.Shape__Points);
            const w     = Math.max(Na__LeImgCfg__Placement().minSizeMm, want);
            Na__LeModel__UpdateShape(picked.sheet, shape.Shape__Id, { points : Na__LeImgGeo__RectPoints(rect.x0, rect.y0, w, w * rect.h / Math.max(1e-6, rect.w)) }, false);   // <-- The top left stays put; the height follows the width
        });
        on('click', 'img-crop', () => {
            const picked = Na__LePanelImages__Selected();
            if (picked.shapes.length === 1) Na__LeImgCrop__Open(picked.sheet, picked.shapes[0].Shape__Id);
        });
        on('click', 'img-reset-crop', () => {
            const picked = Na__LePanelImages__Selected();
            if (picked.shapes.length === 1) Na__LeImgMenu__ResetCrop(picked.sheet, picked.shapes[0]);
        });
        on('click', 'img-replace', () => {
            const picked = Na__LePanelImages__Selected();
            if (picked.shapes.length === 1) Na__LeImgIns__Replace(picked.sheet, picked.shapes[0].Shape__Id);
        });

        const entry = Na__LePanels__RegisterSection('right', {
            id : Na__LePanelImages__ID, title : Na__LeImgCfg__Label('PanelTitle', 'Images'),
            build : Na__LePanelImages__Build, refresh : Na__LePanelImages__Refresh
        });
        Na__LeImgCfg__Ready().then(() => {                                      // <-- The words may land after the section is built
            const title = entry ? entry.root.querySelector('.na-le-section__title') : null;
            if (title) title.textContent = Na__LeImgCfg__Label('PanelTitle', 'Images');
            again();
        });
        return entry;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Sheet Images Panel API
    // ------------------------------------------------------------
    export {
        Na__LePanelImages__ID,
        Na__LePanelImages__Register
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
