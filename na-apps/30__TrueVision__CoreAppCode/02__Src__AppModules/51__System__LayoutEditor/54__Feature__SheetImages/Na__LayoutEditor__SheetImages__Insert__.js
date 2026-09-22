// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET IMAGES - INSERT
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetImages__Insert__.js
// NAMESPACE  : Na__LeImgIns
// MODULE     : Layout Editor - Sheet Images - Insert
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Put pictures on a sheet: dragged from the desktop, or picked with the Image button
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - DRAG PICTURE FILES ONTO THE SHEET and each lands centred where it was let
//   go, several stepped down and to the right so none hides another. The
//   Image button asks for files and centres them on the part of the sheet in
//   view. Either way a new picture takes a share of the drawing area
//   (Placement InsertWidthFraction), in its own proportions, with its frame.
// - EACH IS READ INTO MEMORY AND NOTHING IS WRITTEN (Na__LayoutEditor__SheetImages__Encode__):
//   the sheet shows a WebP of it at once, and the save that follows cuts
//   the picture the project keeps from the original - the pixels a print
//   needs at the size the picture has been given by then - and writes that,
//   into 05__Layout__DrawingDocs__Images/<document id>/ on disk (making the
//   images folder the first time a project ever keeps a picture, never at
//   build time) and onto R2. So a render dropped and then scaled down is
//   never stored at its full size anywhere.
// - THE NEW PICTURES ARE SELECTED AND MOVE IS PICKED UP, as it is for a
//   vector or a note, because the next thing wanted is nearly always to put
//   the picture exactly where it belongs.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.2.0
// - A picture dropped or picked while a group is open for editing joins that
//   group (Na__LeScope__WithAdoption), just before it is announced: it used
//   to land on the sheet outside the group, faded and out of reach.
//
// 21-Sep-2026 - Version 1.1.0
// - Nothing is written at the drop or the replace: the picture and its
//   original are held in memory (Na__LeImgPub__Hold) and the save cuts and
//   files it at its print size. The block records the original's pixels
//   (Image__SourceW / Image__SourceH) for the panel.
//
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Model, Surface, Tools and the Feature
    // ------------------------------------------------------------
    import { Na__LeModel__GetActiveSheet, Na__LeModel__CreateShape, Na__LeModel__UpdateShape, Na__LeModel__SetSelectionItems, Na__LeModel__GetLayerById, Na__LeModel__UpdateLayer } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__ClientToPaperMm, Na__LeSurface__GetElements, Na__LeSurface__GetLayout } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeTools__TOOL_SELECT } from '../30__System__SheetTools/Na__LayoutEditor__SheetTools__State__.js';
    import { Na__LeTools__SetTool, Na__LeTools__PickUpMove } from '../30__System__SheetTools/Na__LayoutEditor__SheetTools__ToolState__.js';
    import { Na__LeScope__WithAdoption } from '../30__System__SheetTools/Na__LayoutEditor__EditScope__.js';   // <-- A picture dropped while a group is open joins the group
    import { Na__LeImgCfg__Placement, Na__LeImgCfg__Frame, Na__LeImgCfg__Label, Na__LeImgCfg__Storage } from './Na__LayoutEditor__SheetImages__Setup__.js';
    import { Na__LeImgGeo__FitPlacement, Na__LeImgGeo__RectPoints } from './Na__LayoutEditor__SheetImages__Geometry__.js';
    import { Na__LeImgEnc__Refusal, Na__LeImgEnc__Prepare } from './Na__LayoutEditor__SheetImages__Encode__.js';
    import { Na__LeImgSrc__Adopt } from './Na__LayoutEditor__SheetImages__Source__.js';
    import { Na__LeImgPub__FolderOf, Na__LeImgPub__Hold } from './Na__LayoutEditor__SheetImages__Publish__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Stage's Drop Look
    // ------------------------------------------------------------
    const Na__LeImgIns__DROP_CLASS = 'na-le-stage--image-drop';
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Stage Being Listened To, the Toast, and a Drop in Hand
    // ------------------------------------------------------------
    let Na__LeImgIns__Stage     = null;
    let Na__LeImgIns__ShowToast = null;
    let Na__LeImgIns__Busy      = false;
    let Na__LeImgIns__Depth     = 0;                                           // <-- dragenter/dragleave fire for every child crossed
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Say Something in the App's Toast
    // ------------------------------------------------------------
    function Na__LeImgIns__Toast(message, isError) {
        if (typeof Na__LeImgIns__ShowToast === 'function') Na__LeImgIns__ShowToast(message, isError === true);
        else if (isError) console.warn('[TrueVision3D LayoutEditor] ' + message);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Does a Drag Carry Files
    // ------------------------------------------------------------
    function Na__LeImgIns__CarriesFiles(event) {
        const types = event && event.dataTransfer ? Array.from(event.dataTransfer.types || []) : [];
        return types.indexOf('Files') !== -1;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Middle of the Sheet in View, in Paper Millimetres
    // ------------------------------------------------------------
    function Na__LeImgIns__ViewCentreMm() {
        const stage = Na__LeSurface__GetElements().stage;
        if (!stage) return null;
        const box = stage.getBoundingClientRect();
        return Na__LeSurface__ClientToPaperMm(box.left + (box.width / 2), box.top + (box.height / 2));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show the Images Layer if It Is Hidden (a picture placed on it must appear)
    // ------------------------------------------------------------
    function Na__LeImgIns__RevealLayer(sheet, shape) {
        const layer = shape ? Na__LeModel__GetLayerById(sheet, shape.Shape__LayerId) : null;
        if (layer && layer.Layer__Visible === false) Na__LeModel__UpdateLayer(sheet, layer.Layer__Id, { visible : true });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Placing
// -----------------------------------------------------------------------------

    // FUNCTION | Store Files and Place Them on the Active Sheet
    // ------------------------------------------------------------
    // atMm: where the first goes (paper millimetres); the middle of the sheet
    // in view when not given. Resolves to the shapes placed.
    // ------------------------------------------------------------
    async function Na__LeImgIns__Place(files, atMm) {
        const sheet = Na__LeModel__GetActiveSheet();
        if (!sheet) { Na__LeImgIns__Toast(Na__LeImgCfg__Label('NoSheet', 'Open a sheet before placing a picture.'), true); return []; }
        const list = Array.from(files || []).filter(Boolean);
        if (!list.length || Na__LeImgIns__Busy) return [];
        Na__LeImgIns__Busy = true;
        const placed   = [];
        const problems = [];
        try {
            const layout    = Na__LeSurface__GetLayout();
            const drawing   = layout && layout.Drawing ? layout.Drawing : { X : 10, Y : 10, WidthMm : 200, HeightMm : 150 };
            const setup     = Na__LeImgCfg__Placement();
            const folder    = Na__LeImgPub__FolderOf(sheet);
            const start     = atMm || Na__LeImgIns__ViewCentreMm() || { x : drawing.X + (drawing.WidthMm / 2), y : drawing.Y + (drawing.HeightMm / 2) };
            const maxW      = Math.max(setup.minSizeMm, drawing.WidthMm * setup.widthFraction);
            const maxH      = Math.max(setup.minSizeMm, drawing.HeightMm * 0.9);
            for (let i = 0; i < list.length; i++) {
                const file    = list[i];
                const refusal = Na__LeImgEnc__Refusal(file);
                if (refusal) {
                    problems.push(refusal.reason === 'size'
                        ? Na__LeImgCfg__Label('TooLarge', '{name} is larger than {limit} MB.', { name : file.name, limit : refusal.limitMb })
                        : Na__LeImgCfg__Label('Refused', '{name} is not a picture this sheet can take.', { name : file.name }));
                    continue;
                }
                Na__LeImgIns__Toast(Na__LeImgCfg__Label('Storing', 'Preparing {name}...', { name : file.name }), false);
                let stored;
                try { stored = await Na__LeImgEnc__Prepare(file); }
                catch (error) {
                    console.warn('[TrueVision3D LayoutEditor] A dropped picture could not be read:', file.name, error);
                    problems.push(Na__LeImgCfg__Label('DecodeFailed', '{name} could not be read as a picture.', { name : file.name }));
                    continue;
                }
                Na__LeImgPub__Hold(stored.fileName, stored.blob, stored.source);   // <-- In memory only: the save cuts it to its print size and files that
                Na__LeImgSrc__Adopt(stored.fileName, stored.blob);                  // <-- Drawn at once, from the bytes just made
                const centre = { x : start.x + (i * setup.cascadeMm), y : start.y + (i * setup.cascadeMm) };
                const rect   = Na__LeImgGeo__FitPlacement(centre, stored.pixelW, stored.pixelH, maxW, maxH);
                // INSIDE AN OPEN GROUP the picture joins it, just before it is
                // announced, so undo takes it and its membership together.
                const shape  = Na__LeScope__WithAdoption(sheet, [ 'shape' ], () => Na__LeModel__CreateShape(sheet, Na__LeImgGeo__RectPoints(rect.x0, rect.y0, rect.w, rect.h), {
                    closed  : true,
                    stroked : false,
                    image   : {
                        Image__File    : stored.fileName,
                        Image__Folder  : folder,
                        Image__PixelW  : stored.pixelW,
                        Image__PixelH  : stored.pixelH,
                        Image__Frame   : Na__LeImgCfg__Frame().byDefault,
                        Image__Alpha   : stored.alpha === true,
                        Image__Name    : stored.name,
                        Image__SourceW : stored.source.pixelW,
                        Image__SourceH : stored.source.pixelH
                    }
                }));
                if (shape) { placed.push(shape); Na__LeImgIns__RevealLayer(sheet, shape); }
            }
        } finally {
            Na__LeImgIns__Busy = false;
        }
        if (placed.length) {
            Na__LeTools__SetTool(Na__LeTools__TOOL_SELECT);                      // <-- Whatever tool was up, the pictures are what is in hand now
            Na__LeModel__SetSelectionItems(placed.map((shape) => ({ kind : 'shape', id : shape.Shape__Id })));
            Na__LeTools__PickUpMove();                                           // <-- As a vector or a note does: the next drag puts it where it belongs
        }
        const folderName = placed.length ? placed[0].Shape__Image.Image__Folder : '';
        const summary = placed.length
            ? Na__LeImgCfg__Label('Placed', '{count} picture(s) placed on {folder}. Saving stores them at print size.', { count : placed.length, folder : folderName })
            : '';
        const words = [ summary ].concat(problems).filter(Boolean).join(' ');
        if (words) Na__LeImgIns__Toast(words, problems.length > 0);
        return placed;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Ask the Browser for Picture Files
    // ------------------------------------------------------------
    function Na__LeImgIns__Ask(multiple, then) {
        const input = document.createElement('input');
        input.type     = 'file';
        input.accept   = Na__LeImgCfg__Storage().acceptTypes.join(',');
        input.multiple = multiple === true;
        input.style.display = 'none';
        input.addEventListener('change', () => {
            const files = Array.from(input.files || []);
            input.remove();
            if (files.length) then(files);
        }, { once : true });
        document.body.appendChild(input);
        input.click();
    }
    // ------------------------------------------------------------


    // FUNCTION | Ask for Picture Files, Then Place Them in the Middle of the View
    // ------------------------------------------------------------
    function Na__LeImgIns__Pick() {
        Na__LeImgIns__Ask(true, (files) => { void Na__LeImgIns__Place(files, null); });
    }
    // ------------------------------------------------------------


    // FUNCTION | Replace a Placed Picture With Another File, Keeping Its Place and Width
    // ------------------------------------------------------------
    // For an updated render of the same view - or the same render again, to
    // bring back pixels a picture was stored without before it was enlarged:
    // the new picture takes the old one's top left corner, its width and its
    // frame, at its own proportions, uncropped. One undo step. The save cuts
    // it to its print size; the old file stays where it is until a save finds
    // nothing uses it.
    // ------------------------------------------------------------
    function Na__LeImgIns__Replace(sheet, shapeId) {
        Na__LeImgIns__Ask(false, (files) => { void Na__LeImgIns__ReplaceWith(sheet, shapeId, files[0]); });
    }
    async function Na__LeImgIns__ReplaceWith(sheet, shapeId, file) {
        const shape = sheet && Array.isArray(sheet.Sheet__Shapes) ? sheet.Sheet__Shapes.find((s) => s.Shape__Id === shapeId) : null;
        if (!shape || !shape.Shape__Image || !file || Na__LeImgIns__Busy) return false;
        const refusal = Na__LeImgEnc__Refusal(file);
        if (refusal) { Na__LeImgIns__Toast(Na__LeImgCfg__Label('Refused', '{name} is not a picture this sheet can take.', { name : file.name }), true); return false; }
        Na__LeImgIns__Busy = true;
        try {
            Na__LeImgIns__Toast(Na__LeImgCfg__Label('Storing', 'Preparing {name}...', { name : file.name }), false);
            const stored = await Na__LeImgEnc__Prepare(file);
            const folder = Na__LeImgPub__FolderOf(sheet);
            Na__LeImgPub__Hold(stored.fileName, stored.blob, stored.source);       // <-- In memory only: the save cuts it to its print size and files that
            Na__LeImgSrc__Adopt(stored.fileName, stored.blob);
            const x0 = Math.min(...shape.Shape__Points.map((p) => p[0]));
            const y0 = Math.min(...shape.Shape__Points.map((p) => p[1]));
            const w  = Math.max(...shape.Shape__Points.map((p) => p[0])) - x0;
            const h  = w * stored.pixelH / Math.max(1, stored.pixelW);
            const ok = Na__LeModel__UpdateShape(sheet, shapeId, {
                points : Na__LeImgGeo__RectPoints(x0, y0, w, h),
                image  : { Image__File : stored.fileName, Image__Folder : folder, Image__PixelW : stored.pixelW, Image__PixelH : stored.pixelH,
                           Image__Alpha : stored.alpha === true, Image__Name : stored.name, Image__Crop : null,
                           Image__SourceW : stored.source.pixelW, Image__SourceH : stored.source.pixelH }
            }, false);
            if (ok) Na__LeImgIns__Toast(Na__LeImgCfg__Label('Replaced', 'Picture replaced with {name}. Saving stores it at print size.', { name : stored.name }), false);
            return ok;
        } catch (error) {
            console.warn('[TrueVision3D LayoutEditor] The replacement picture could not be read:', file.name, error);
            Na__LeImgIns__Toast(Na__LeImgCfg__Label('DecodeFailed', '{name} could not be read as a picture.', { name : file.name }), true);
            return false;
        } finally {
            Na__LeImgIns__Busy = false;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Dropping Onto the Stage
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Four Drag Events
    // ------------------------------------------------------------
    function Na__LeImgIns__OnDragEnter(event) {
        if (!Na__LeImgIns__CarriesFiles(event)) return;
        event.preventDefault();
        Na__LeImgIns__Depth++;
        if (Na__LeImgIns__Stage) Na__LeImgIns__Stage.classList.add(Na__LeImgIns__DROP_CLASS);
    }
    function Na__LeImgIns__OnDragOver(event) {
        if (!Na__LeImgIns__CarriesFiles(event)) return;
        event.preventDefault();                                                  // <-- Without it the browser opens the file instead of letting it drop
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    }
    function Na__LeImgIns__OnDragLeave(event) {
        if (!Na__LeImgIns__CarriesFiles(event)) return;
        Na__LeImgIns__Depth = Math.max(0, Na__LeImgIns__Depth - 1);
        if (!Na__LeImgIns__Depth && Na__LeImgIns__Stage) Na__LeImgIns__Stage.classList.remove(Na__LeImgIns__DROP_CLASS);
    }
    function Na__LeImgIns__OnDrop(event) {
        if (!Na__LeImgIns__CarriesFiles(event)) return;
        event.preventDefault();
        Na__LeImgIns__Depth = 0;
        if (Na__LeImgIns__Stage) Na__LeImgIns__Stage.classList.remove(Na__LeImgIns__DROP_CLASS);
        const files = Array.from((event.dataTransfer && event.dataTransfer.files) || []);
        if (!files.length) return;
        void Na__LeImgIns__Place(files, Na__LeSurface__ClientToPaperMm(event.clientX, event.clientY));
    }
    // ------------------------------------------------------------


    // FUNCTION | Listen to the Stage for Dropped Files (the editor, while a sheet is shown)
    // ------------------------------------------------------------
    function Na__LeImgIns__Attach(options) {
        Na__LeImgIns__Detach();
        const stage = Na__LeSurface__GetElements().stage;
        if (!stage || !(options && options.editable)) return false;
        Na__LeImgIns__Stage     = stage;
        Na__LeImgIns__ShowToast = (options && options.showToast) || Na__LeImgIns__ShowToast;
        stage.addEventListener('dragenter', Na__LeImgIns__OnDragEnter);
        stage.addEventListener('dragover',  Na__LeImgIns__OnDragOver);
        stage.addEventListener('dragleave', Na__LeImgIns__OnDragLeave);
        stage.addEventListener('drop',      Na__LeImgIns__OnDrop);
        return true;
    }
    function Na__LeImgIns__Detach() {
        if (!Na__LeImgIns__Stage) return;
        Na__LeImgIns__Stage.removeEventListener('dragenter', Na__LeImgIns__OnDragEnter);
        Na__LeImgIns__Stage.removeEventListener('dragover',  Na__LeImgIns__OnDragOver);
        Na__LeImgIns__Stage.removeEventListener('dragleave', Na__LeImgIns__OnDragLeave);
        Na__LeImgIns__Stage.removeEventListener('drop',      Na__LeImgIns__OnDrop);
        Na__LeImgIns__Stage.classList.remove(Na__LeImgIns__DROP_CLASS);
        Na__LeImgIns__Stage = null;
        Na__LeImgIns__Depth = 0;
    }
    // ------------------------------------------------------------


    // FUNCTION | Where the Toast Goes
    // ------------------------------------------------------------
    function Na__LeImgIns__SetToast(showToast) {
        Na__LeImgIns__ShowToast = (typeof showToast === 'function') ? showToast : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Sheet Images Insert API
    // ------------------------------------------------------------
    export {
        Na__LeImgIns__Place,
        Na__LeImgIns__Pick,
        Na__LeImgIns__Replace,
        Na__LeImgIns__Attach,
        Na__LeImgIns__Detach,
        Na__LeImgIns__SetToast
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
