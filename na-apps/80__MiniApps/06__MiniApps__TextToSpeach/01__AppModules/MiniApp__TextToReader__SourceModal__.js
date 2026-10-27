// =============================================================================
// NOBLE ARCHITECTURE - TEXT TO READER - TEXT SOURCE MODAL
// =============================================================================
//
// FILE    : MiniApp__TextToReader__SourceModal__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Launch modal: paste the clipboard or open a Markdown / text file
// CREATED : 27-Oct-2026
//
// The file button is wired by FileUpload__.js; this module owns the dialog
// and the clipboard. Reading the clipboard needs the click as its gesture.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module-Level Variables
// -----------------------------------------------------------------------------

 let Na__TextToReader__SourceDialog = null;
 let Na__TextToReader__SourceStatus = null;

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Internal Helpers
// -----------------------------------------------------------------------------

// FUNCTION | Read the clipboard and hand its text on, or report why not
// ------------------------------------------------------------
async function Na__TextToReader__PasteFromClipboard(Na__Config) {
    const { uiText, onText, onClipboardBlocked } = Na__Config;

    let Na__ClipboardText = null;
    try {
        Na__ClipboardText = await navigator.clipboard.readText();
    } catch (Na__ErrorObject) {
        console.warn("Text To Reader clipboard read refused:", Na__ErrorObject);
        Na__TextToReader__CloseSourceModal();
        onClipboardBlocked();
        return;
    }

    if (!Na__ClipboardText || !Na__ClipboardText.trim()) {
        Na__TextToReader__SourceStatus.textContent = uiText.NaMiniApp__ClipboardEmpty;
        return;
    }

    Na__TextToReader__CloseSourceModal();
    onText(Na__ClipboardText);
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Exports
// -----------------------------------------------------------------------------

// FUNCTION | Show the modal with a clear status line
// ------------------------------------------------------------
export function Na__TextToReader__OpenSourceModal() {
    if (!Na__TextToReader__SourceDialog || Na__TextToReader__SourceDialog.open) return;
    Na__TextToReader__SourceStatus.textContent = "";
    Na__TextToReader__SourceDialog.showModal();
}
// ------------------------------------------------------------


// FUNCTION | Close the modal if it is open
// ------------------------------------------------------------
export function Na__TextToReader__CloseSourceModal() {
    if (Na__TextToReader__SourceDialog?.open) Na__TextToReader__SourceDialog.close();
}
// ------------------------------------------------------------


// FUNCTION | Wire the clipboard and Not now buttons
// ------------------------------------------------------------
export function Na__TextToReader__InitialiseSourceModal(Na__Config) {
    const { dialog, pasteButton, laterButton, statusElement } = Na__Config || {};

    if (!dialog || !pasteButton || !laterButton || !statusElement) {
        console.error("Text To Reader source modal: missing required elements.");
        return;
    }

    Na__TextToReader__SourceDialog = dialog;
    Na__TextToReader__SourceStatus = statusElement;

    pasteButton.addEventListener("click", () => Na__TextToReader__PasteFromClipboard(Na__Config));
    laterButton.addEventListener("click", Na__TextToReader__CloseSourceModal);
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
