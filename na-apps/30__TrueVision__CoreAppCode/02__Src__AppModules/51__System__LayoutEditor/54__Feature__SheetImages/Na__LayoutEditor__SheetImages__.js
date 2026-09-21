// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET IMAGES
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetImages__.js
// NAMESPACE  : Na__LeImg
// MODULE     : Layout Editor - Sheet Images
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Pictures on a sheet - CGIs, photographs - composed with the drawings: the feature's entry point
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - A PICTURE IS A VECTOR SHAPE CARRYING Shape__Image, the decision Floor
//   Areas made for rooms and for the same reason: selecting, moving,
//   snapping, copying, stacking, locking, hiding, printing and undoing all
//   come for free, and none of those systems had to learn what a picture is.
//   Its four points are the corners of the part that shows; the block names
//   the stored file and the part of it that is kept (Na__LayoutEditor__SheetRecords__).
// - THE FEATURE, MODULE BY MODULE:
//     Setup     the config, a leaf
//     Geometry  the box, the crop, the corner scale, the names - a leaf
//     Painter   a 'picture' primitive as SVG and into jsPDF - a leaf
//     Paint     a picture shape as that primitive (called by the shape painter)
//     Source    where the bytes come from: R2, then Pages; the repository on localhost
//     Encode    what is stored for a dropped file, and the PDF's print copies
//     Store     the local server's routes: the project folder, filed by document id
//     Publish   the save step that files pictures under their drawing's id on R2
//     Insert    dropping and picking files; replacing a picture
//     Handles   the four corner grips and the corner scale
//     Crop      the crop overlay
//     Menu      the right-click rows
//     Pdf       cutting print copies before a page is drawn
//     Panel     the Images section
// - THIS MODULE wires them up: it loads the config, repaints the sheet when a
//   picture arrives, gives the source the editor's extra folders to look in,
//   and in the editor registers the save step and the grips and listens for
//   dropped files while a sheet is shown.
//
// INTEGRATION:
// - Na__LayoutEditor__ModeController__: Ready in the first-open wait,
//   Initialize after the model, AttachInput / DetachInput with the rest of
//   the sheet's input, the panel after Vectors, SectionForKind for a picture.
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

    // MODULE IMPORTS | Drawings Data, Surface and the Feature
    // ------------------------------------------------------------
    import { Na__DrawData__GetSheetsArray, Na__DrawData__LOADED_EVENT } from '../../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    import { Na__LeSurface__Refresh } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LePanels__Refresh } from '../40__Ui__Panels/Na__LayoutEditor__PanelHost__.js';
    import { Na__LeImgCfg__Ready } from './Na__LayoutEditor__SheetImages__Setup__.js';
    import { Na__LeImgDraw__Block } from './Na__LayoutEditor__SheetImages__Paint__.js';
    import { Na__LeImgSrc__CHANGED_EVENT, Na__LeImgSrc__SetFolderFinder } from './Na__LayoutEditor__SheetImages__Source__.js';
    import { Na__LeImgPub__FolderOf, Na__LeImgPub__Register, Na__LeImgPub__Reset } from './Na__LayoutEditor__SheetImages__Publish__.js';
    import { Na__LeImgIns__Attach, Na__LeImgIns__Detach, Na__LeImgIns__SetToast } from './Na__LayoutEditor__SheetImages__Insert__.js';
    import { Na__LeImgHandle__Attach } from './Na__LayoutEditor__SheetImages__Handles__.js';
    import { Na__LeImgCrop__Close } from './Na__LayoutEditor__SheetImages__Crop__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Set Up Once
    // ------------------------------------------------------------
    let Na__LeImg__Initialized = false;
    let Na__LeImg__Editable    = false;
    let Na__LeImg__ShowToast   = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Every Folder a File Might Be In: Where Each Drawing Using It Wants It, and Where It Was Filed
    // ------------------------------------------------------------
    // Read off the raw drawings block - no sheet is normalised to answer - and
    // asked only when the folder a record names did not have the picture.
    // ------------------------------------------------------------
    function Na__LeImg__FoldersFor(file) {
        const folders = [];
        (Na__DrawData__GetSheetsArray() || []).forEach((sheet) => {
            (sheet && Array.isArray(sheet.Sheet__Shapes) ? sheet.Sheet__Shapes : []).forEach((shape) => {
                const block = Na__LeImgDraw__Block(shape);
                if (!block || block.Image__File !== file) return;
                folders.push(Na__LeImgPub__FolderOf(sheet));
                if (block.Image__Folder) folders.push(block.Image__Folder);
            });
        });
        return folders.filter((folder, index) => folders.indexOf(folder) === index);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Picture Arrived (or Was Found Missing): Draw the Sheet Again
    // ------------------------------------------------------------
    function Na__LeImg__OnSource() {
        Na__LeSurface__Refresh('markup');
        Na__LePanels__Refresh('images');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | The Config, Loaded Once (never rejects)
    // ------------------------------------------------------------
    function Na__LeImg__Ready() {
        return Na__LeImgCfg__Ready();
    }
    // ------------------------------------------------------------


    // FUNCTION | Set the Feature Up (once)
    // ------------------------------------------------------------
    // options: { editable, showToast }. The viewer gets the source and the
    // repaint; the editor also gets the save step, the grips and the drop.
    // ------------------------------------------------------------
    function Na__LeImg__Initialize(options) {
        if (Na__LeImg__Initialized) return true;
        Na__LeImg__Initialized = true;
        Na__LeImg__Editable  = !!(options && options.editable);
        Na__LeImg__ShowToast = (options && typeof options.showToast === 'function') ? options.showToast : null;
        Na__LeImgSrc__SetFolderFinder((file) => Na__LeImg__FoldersFor(file));
        window.addEventListener(Na__LeImgSrc__CHANGED_EVENT, Na__LeImg__OnSource);
        window.addEventListener(Na__DrawData__LOADED_EVENT, () => { Na__LeImgPub__Reset(); });   // <-- Another project: what was known to be where is not known any more
        if (Na__LeImg__Editable) {
            Na__LeImgPub__Register();                                             // <-- Every drawings save files the pictures first
            Na__LeImgHandle__Attach();                                            // <-- A selected picture's corner grips
            Na__LeImgIns__SetToast(Na__LeImg__ShowToast);
        }
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is This Shape a Picture
    // ------------------------------------------------------------
    function Na__LeImg__Is(shape) {
        return !!Na__LeImgDraw__Block(shape);
    }
    // ------------------------------------------------------------


    // FUNCTION | Listen for Dropped Files While a Sheet Is Shown (the editor only)
    // ------------------------------------------------------------
    function Na__LeImg__AttachInput() {
        if (!Na__LeImg__Editable) return false;
        return Na__LeImgIns__Attach({ editable : true, showToast : Na__LeImg__ShowToast });
    }
    function Na__LeImg__DetachInput() {
        Na__LeImgCrop__Close(true);                                              // <-- Leaving the sheet keeps a crop in progress, as clicking away does
        Na__LeImgIns__Detach();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Sheet Images API
    // ------------------------------------------------------------
    export {
        Na__LeImg__Ready,
        Na__LeImg__Initialize,
        Na__LeImg__Is,
        Na__LeImg__AttachInput,
        Na__LeImg__DetachInput
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
