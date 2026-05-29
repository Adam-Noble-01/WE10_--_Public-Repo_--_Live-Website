// =============================================================================
// NOBLE ARCHITECTURE - PHOTO UTILS - LINE SEGMENT COUNTER - IMAGE LOADER
// =============================================================================
//
// FILE    : MiniApp__PhotoUtils__LineSegmentCounter__ImageLoader__.js
// PURPOSE : Image acquisition from file input, clipboard paste, and drag & drop
// CREATED : 29-May-2026
//
// =============================================================================

// -----------------------------------------------------------------------------
// REGION | Internal Helpers
// -----------------------------------------------------------------------------

// HELPER FUNCTION | Decode a File/Blob into an HTMLImageElement via FileReader
// ------------------------------------------------------------
function Na__PhotoUtils__DecodeFileToImage(Na__FileObject, Na__OnLoad) {
    const Na__Reader  = new FileReader();
    Na__Reader.onload = (Na__ReaderEvent) => {
        const Na__Img    = new Image();
        Na__Img.onload   = () => Na__OnLoad(Na__Img, Na__FileObject.name || "");
        Na__Img.src      = Na__ReaderEvent.target.result;
    };
    Na__Reader.readAsDataURL(Na__FileObject);
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Exports
// -----------------------------------------------------------------------------

// FUNCTION | Load an image from a File object (file input change event)
// ------------------------------------------------------------
export function Na__PhotoUtils__LoadImageFromFile(Na__FileObject, Na__OnLoad) {
    if (!Na__FileObject) return;
    Na__PhotoUtils__DecodeFileToImage(Na__FileObject, Na__OnLoad);
}
// ------------------------------------------------------------


// FUNCTION | Extract and load the first image blob from a clipboard paste event
// ------------------------------------------------------------
export function Na__PhotoUtils__HandleClipboardPaste(Na__PasteEvent, Na__OnLoad) {
    const Na__Items = Na__PasteEvent.clipboardData && Na__PasteEvent.clipboardData.items;
    if (!Na__Items) return;

    for (const Na__Item of Na__Items) {
        if (!Na__Item.type.startsWith("image/")) continue;

        const Na__Blob = Na__Item.getAsFile();
        if (!Na__Blob) continue;

        Na__PasteEvent.preventDefault();
        Na__PhotoUtils__DecodeFileToImage(Na__Blob, Na__OnLoad);
        return;
    }
}
// ------------------------------------------------------------


// FUNCTION | Extract and load the first image file from a drag-and-drop event
// ------------------------------------------------------------
export function Na__PhotoUtils__HandleImageDrop(Na__DropEvent, Na__OnLoad) {
    Na__DropEvent.preventDefault();

    const Na__Files      = Na__DropEvent.dataTransfer && Na__DropEvent.dataTransfer.files;
    if (!Na__Files || !Na__Files.length) return;

    const Na__FirstImage = Array.from(Na__Files).find((Na__File) => Na__File.type.startsWith("image/"));
    if (!Na__FirstImage) return;

    Na__PhotoUtils__DecodeFileToImage(Na__FirstImage, Na__OnLoad);
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
