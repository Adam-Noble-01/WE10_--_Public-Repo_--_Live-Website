// =============================================================================
// NOBLE ARCHITECTURE - TEXT TO READER - TEXT RECOGNITION (OCR) MODAL
// =============================================================================
//
// FILE    : MiniApp__TextToReader__OcrModal__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Ask once before downloading text recognition for a PDF's scanned pages
// CREATED : 18-Nov-2026
//
// The first time a PDF has scanned pages and the OCR model is not on the device, this
// modal (the voice modal's look) says how many pages are scans and how big the download
// is. Download installs the model through the OCR module (OCR contract v1, SHA-256
// checked, kept for offline use) with a progress bar; Not now, Esc or a newer file
// leaves those pages unread. Once installed, scanned pages are read without asking.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Imports
// -----------------------------------------------------------------------------

// @delegate: ./MiniApp__TextToReader__ActivityLog__.js (download time and failures)
import { Na__TextToReader__LogTimer } from "./MiniApp__TextToReader__ActivityLog__.js";

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module-Level Variables
// -----------------------------------------------------------------------------

 const Na__OcrModal__Nodes = {
     dialog   : document.getElementById("js__ocrModal"),
     title    : document.getElementById("js__ocrModalTitle"),
     text     : document.getElementById("js__ocrModalText"),
     progress : document.getElementById("js__ocrModalProgress"),
     status   : document.getElementById("js__ocrModalStatus"),
     download : document.getElementById("js__ocrModalDownload"),
     later    : document.getElementById("js__ocrModalLater")
 };

 let Na__OcrModal__UiText = {};

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Internal Helpers
// -----------------------------------------------------------------------------

// FUNCTION | Format - Fill a UI text template's {name} placeholders
// ------------------------------------------------------------
function Na__OcrModal__Format(Na__Template, Na__Values) {
    return String(Na__Template || "").replace(/\{(\w+)\}/g, (Na__Match, Na__Key) =>
        (Na__Key in Na__Values ? String(Na__Values[Na__Key]) : Na__Match));
}
// ------------------------------------------------------------


// FUNCTION | Megabytes - Bytes as "46.1"
// ------------------------------------------------------------
function Na__OcrModal__Megabytes(Na__Bytes) {
    return (Math.max(0, Number(Na__Bytes) || 0) / 1e6).toFixed(1);
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Exports
// -----------------------------------------------------------------------------

// FUNCTION | InitialiseOcrModal - Paint the modal's fixed text from the AppConfig
// ------------------------------------------------------------
export function Na__TextToReader__InitialiseOcrModal(Na__UiText) {
    Na__OcrModal__UiText = Na__UiText || {};
    if (!Na__OcrModal__Nodes.dialog) return;
    Na__OcrModal__Nodes.title.textContent    = Na__OcrModal__UiText.NaMiniApp__OcrTitle || Na__OcrModal__Nodes.title.textContent;
    Na__OcrModal__Nodes.download.textContent = Na__OcrModal__UiText.NaMiniApp__OcrDownload || Na__OcrModal__Nodes.download.textContent;
    Na__OcrModal__Nodes.later.textContent    = Na__OcrModal__UiText.NaMiniApp__OcrLater || Na__OcrModal__Nodes.later.textContent;
}
// ------------------------------------------------------------


// FUNCTION | AskOcrConsent - Ask, and install on Download; resolves true once installed
// ------------------------------------------------------------
// Na__Request: { scanPages, pages, status: { tier, bytesToDownload }, install({ onProgress, signal }) },
// as PdfRenderer's onOcrConsent passes it. Na__Signal (the PDF job's) closes the modal when a
// newer file replaces this one.
export function Na__TextToReader__AskOcrConsent(Na__Request, Na__Signal) {
    const Na__Nodes = Na__OcrModal__Nodes;
    if (!Na__Nodes.dialog || Na__Signal?.aborted) return Promise.resolve(false);

    return new Promise((Na__Resolve) => {
        const Na__Ui = Na__OcrModal__UiText;
        const Na__Megabytes = Na__OcrModal__Megabytes(Na__Request.status?.bytesToDownload);
        const Na__Template = Na__Request.scanPages === 1 ? Na__Ui.NaMiniApp__OcrConsentOne : Na__Ui.NaMiniApp__OcrConsentMany;
        Na__Nodes.text.textContent = Na__OcrModal__Format(Na__Template, {
            count : Na__Request.scanPages,
            pages : Na__Request.pages,
            mb    : Na__Megabytes
        });
        Na__Nodes.status.textContent = "";
        Na__Nodes.progress.hidden = true;
        Na__Nodes.progress.value = 0;
        Na__Nodes.download.disabled = false;
        Na__Nodes.later.disabled = false;

        const Na__Install = new AbortController();
        let Na__Settled = false;

        const Na__Finish = (Na__Installed) => {
            if (Na__Settled) return;
            Na__Settled = true;
            Na__Nodes.download.removeEventListener("click", Na__OnDownload);
            Na__Nodes.later.removeEventListener("click", Na__OnLater);
            Na__Nodes.dialog.removeEventListener("cancel", Na__OnCancel);
            Na__Signal?.removeEventListener("abort", Na__OnAbort);
            if (Na__Nodes.dialog.open) Na__Nodes.dialog.close();
            Na__Resolve(Na__Installed);
        };

        const Na__OnDownload = async () => {
            Na__Nodes.download.disabled = true;
            Na__Nodes.progress.hidden = false;
            Na__Nodes.status.textContent = "";
            const Na__Timer = Na__TextToReader__LogTimer(`Downloading text recognition (${Na__Request.status?.tier || "model"}, ${Na__Megabytes} MB)`);
            try {
                await Na__Request.install({
                    signal     : Na__Install.signal,
                    onProgress : ({ loaded, total }) => {
                        const Na__Total = total || Number(Na__Request.status?.bytesToDownload) || 0;
                        if (Na__Total > 0) Na__Nodes.progress.value = Math.round(Math.min(1, loaded / Na__Total) * 100);
                        Na__Nodes.status.textContent = Na__OcrModal__Format(Na__Ui.NaMiniApp__OcrInstalling, {
                            loaded : Na__OcrModal__Megabytes(loaded),
                            total  : Na__OcrModal__Megabytes(Na__Total)
                        });
                    }
                });
                Na__Timer(`Text recognition installed (${Na__Request.status?.tier || "model"}, ${Na__Megabytes} MB)`);
                Na__Finish(true);
            } catch (Na__Error) {
                if (Na__Settled) return;   // Not now or a newer file already closed the modal
                Na__Timer.fail(Na__Error);
                Na__Nodes.progress.hidden = true;
                Na__Nodes.download.disabled = false;
                Na__Nodes.status.textContent = Na__OcrModal__Format(Na__Ui.NaMiniApp__OcrInstallFailed, {
                    error : Na__Error?.message || String(Na__Error)
                });
            }
        };
        const Na__OnLater = () => {
            Na__Install.abort();
            Na__Finish(false);
        };
        const Na__OnCancel = (Na__Event) => {
            Na__Event.preventDefault();   // Esc is Not now, never a half-closed install
            Na__OnLater();
        };
        const Na__OnAbort = () => {
            Na__Install.abort();
            Na__Finish(false);
        };

        Na__Nodes.download.addEventListener("click", Na__OnDownload);
        Na__Nodes.later.addEventListener("click", Na__OnLater);
        Na__Nodes.dialog.addEventListener("cancel", Na__OnCancel);
        Na__Signal?.addEventListener("abort", Na__OnAbort, { once: true });
        Na__Nodes.dialog.showModal();
    });
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
