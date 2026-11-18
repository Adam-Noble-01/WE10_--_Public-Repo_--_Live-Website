// =============================================================================
// NOBLE ARCHITECTURE - TEXT TO READER - MAIN
// =============================================================================
//
// FILE    : MiniApp__TextToReader__Main__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : DOM cache, event wiring, config load and application bootstrap
// CREATED : 19-Sep-2026
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Imports
// -----------------------------------------------------------------------------

// @delegate: ./MiniApp__TextToReader__FileUpload__.js
import {
    Na__TextToReader__InitialiseFileUpload,
    Na__TextToReader__OpenFile,
    Na__TextToReader__IsSupportedFile
} from "./MiniApp__TextToReader__FileUpload__.js";

// @delegate: ./MiniApp__TextToReader__ViewTabs__.js
import {
    Na__TextToReader__GetActiveMode,
    Na__TextToReader__SetActiveMode,
    Na__TextToReader__InitialiseViewTabs
} from "./MiniApp__TextToReader__ViewTabs__.js";

// @delegate: ./MiniApp__TextToReader__SourceModal__.js
import {
    Na__TextToReader__InitialiseSourceModal,
    Na__TextToReader__OpenSourceModal,
    Na__TextToReader__CloseSourceModal
} from "./MiniApp__TextToReader__SourceModal__.js";

// @delegate: ./MiniApp__TextToReader__WordJump__.js
import { Na__TextToReader__InitialiseWordJump } from "./MiniApp__TextToReader__WordJump__.js";

// @delegate: ./MiniApp__TextToReader__MarkdownRender__.js
import {
    Na__TextToReader__LoadMarkedLibrary,
    Na__TextToReader__RenderInputToHtml,
    Na__TextToReader__BuildErrorHtml
} from "./MiniApp__TextToReader__MarkdownRender__.js";

// @delegate: ./MiniApp__TextToReader__UserConfig__.js
import { Na__TextToReader__LoadUserConfig } from "./MiniApp__TextToReader__UserConfig__.js";

// @delegate: ./MiniApp__TextToReader__ActivityLog__.js
import {
    Na__TextToReader__InitialiseActivityLog,
    Na__TextToReader__Log,
    Na__TextToReader__LogTimer
} from "./MiniApp__TextToReader__ActivityLog__.js";

// @delegate: ./MiniApp__TextToReader__PdfRenderer__.js
import { Na__TextToReader__PdfToMarkdown } from "./MiniApp__TextToReader__PdfRenderer__.js";

// @delegate: ./MiniApp__TextToReader__OcrModal__.js
import {
    Na__TextToReader__InitialiseOcrModal,
    Na__TextToReader__AskOcrConsent
} from "./MiniApp__TextToReader__OcrModal__.js";

// @delegate: ./MiniApp__TextToReader__CompactTransport__.js
import {
    Na__TextToReader__InitialiseCompactTransport,
    Na__TextToReader__ResetCompactTransport
} from "./MiniApp__TextToReader__CompactTransport__.js";

// @delegate: ./MiniApp__TextToReader__ReadAloud__.js
import {
    Na__TextToReader__InitialiseReadAloud,
    Na__TextToReader__StopReadAloud,
    Na__TextToReader__SetReadAloudVisible,
    Na__TextToReader__StartLoadedText,
    Na__TextToReader__IsReadAloudBusy,
    Na__TextToReader__ShowReaderStatus
} from "./MiniApp__TextToReader__ReadAloud__.js";

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module-Level Variables
// -----------------------------------------------------------------------------

 const Na__TextToReader__ConfigPath = "./MiniApp__TextToReader__AppConfig__.json";   // Resolved against the page, not the module folder

 // The release's ?v= (this script's own URL carries it). The config is fetched with it, like
 // every other app file: the previous release's service worker serves the first visit after
 // a release from its own cache, and an unversioned config URL would hand the new code the
 // old config (1.9.7 found this: no ".pdf", so PDFs were refused until a second reload).
 const Na__TextToReader__ReleaseVersion = new URL(import.meta.url).searchParams.get("v");

 // Drag and drop (WORKER__DragDrop's module), loaded after start-up so a missing or failing
 // module can never stop the reader opening; the import map gives it its versioned URL
 const Na__TextToReader__DragDropModuleUrl = "./MiniApp__TextToReader__DragDrop__.js";

 let Na__TextToReader__AppConfig   = null;
 let Na__TextToReader__MarkedParse = null;

 // PDF being read: its AbortController (a newer file cancels it), whether its text is on
 // screen yet, and text held back while read-aloud is busy with what is on screen
 let Na__TextToReader__PdfJob          = null;
 let Na__TextToReader__PdfShown        = false;
 let Na__TextToReader__PdfPending      = null;
 let Na__TextToReader__PdfPendingTimer = 0;
 let Na__TextToReader__HoldAutoStart   = false;   // partial PDF text: show it, prepare speech only once whole

 const Na__TextToReader__Dom = {
     Na__AppTitle          : document.getElementById("js__appTitle"),
     Na__AppVersion        : document.getElementById("js__appVersion"),
     Na__TabEdit           : document.getElementById("js__tabEdit"),
     Na__TabRead           : document.getElementById("js__tabRead"),
     Na__InputText         : document.getElementById("js__inputText"),
     Na__UploadFileButton  : document.getElementById("js__uploadFileButton"),
     Na__FileUploadInput   : document.getElementById("js__fileUploadInput"),
     Na__UploadFileStatus  : document.getElementById("js__uploadFileStatus"),
     Na__SourceModal       : document.getElementById("js__sourceModal"),
     Na__SourceTitle       : document.getElementById("js__sourceModalTitle"),
     Na__SourcePaste       : document.getElementById("js__sourcePaste"),
     Na__SourcePasteLabel  : document.getElementById("js__sourcePasteLabel"),
     Na__SourceFile        : document.getElementById("js__sourceFile"),
     Na__SourceFileLabel   : document.getElementById("js__sourceFileLabel"),
     Na__SourceLater       : document.getElementById("js__sourceLater"),
     Na__Output            : document.getElementById("js__output"),
     Na__PageFooter        : document.getElementById("js__pageFooter")
 };

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | UI Helpers
// -----------------------------------------------------------------------------

// FUNCTION | Confirm every required DOM node was found
// ------------------------------------------------------------
function Na__TextToReader__HasRequiredDom() {
    return Object.values(Na__TextToReader__Dom).every((Na__Node) => Na__Node !== null);
}
// ------------------------------------------------------------


// FUNCTION | Apply configured titles, labels and button text
// ------------------------------------------------------------
function Na__TextToReader__ApplyUiTextFromConfig() {
    const Na__UiText = Na__TextToReader__AppConfig.NaMiniApp__UiText;
    const Na__Meta   = Na__TextToReader__AppConfig.NaMiniApp__Meta;

    document.title = Na__UiText.NaMiniApp__PageTitle;

    Na__TextToReader__Dom.Na__AppTitle.textContent         = Na__UiText.NaMiniApp__AppHeading;
    Na__TextToReader__Dom.Na__AppVersion.textContent       = `v${Na__Meta.NaMiniApp__Version}`;
    Na__TextToReader__Dom.Na__TabEdit.textContent          = Na__UiText.NaMiniApp__TabEdit;
    Na__TextToReader__Dom.Na__TabRead.textContent          = Na__UiText.NaMiniApp__TabRead;
    Na__TextToReader__Dom.Na__InputText.placeholder        = Na__UiText.NaMiniApp__InputPlaceholder;
    Na__TextToReader__Dom.Na__SourceTitle.textContent      = Na__UiText.NaMiniApp__SourceTitle;
    Na__TextToReader__Dom.Na__SourcePasteLabel.textContent = Na__UiText.NaMiniApp__SourcePaste;
    Na__TextToReader__Dom.Na__SourceFileLabel.textContent  = Na__UiText.NaMiniApp__SourceFile;
    Na__TextToReader__Dom.Na__SourceLater.textContent      = Na__UiText.NaMiniApp__SourceLater;
    Na__TextToReader__Dom.Na__PageFooter.textContent       = Na__UiText.NaMiniApp__FooterText;

    Na__TextToReader__Dom.Na__UploadFileButton.setAttribute("title", Na__UiText.NaMiniApp__UploadButton);
}
// ------------------------------------------------------------


// FUNCTION | Write an error into the output pane
// ------------------------------------------------------------
function Na__TextToReader__ShowOutputError(Na__Message) {
    Na__TextToReader__Dom.Na__Output.innerHTML = Na__TextToReader__BuildErrorHtml(Na__Message);
}
// ------------------------------------------------------------


// FUNCTION | Show or hide a node for both layout and the accessibility tree
// ------------------------------------------------------------
function Na__TextToReader__SetNodeHidden(Na__Node, Na__IsHidden) {
    if (!Na__Node) return;

    if (Na__IsHidden === true) {
        Na__Node.setAttribute("hidden", "");
        Na__Node.setAttribute("aria-hidden", "true");
        return;
    }

    Na__Node.removeAttribute("hidden");
    Na__Node.removeAttribute("aria-hidden");
}
// ------------------------------------------------------------


// FUNCTION | Hide editor chrome from read-aloud when it is not on screen
// ------------------------------------------------------------
function Na__TextToReader__ApplyPanelVisibility(Na__Mode) {
    const Na__InputPanel   = document.querySelector(".TTR__panel--input");
    const Na__OutputPanel  = document.querySelector(".TTR__panel--output");
    const Na__Footer       = document.querySelector(".FOOT__container");

    Na__TextToReader__SetNodeHidden(Na__InputPanel,   Na__Mode === "read");
    Na__TextToReader__SetNodeHidden(Na__OutputPanel,  Na__Mode === "edit");

    if (Na__Footer) {
        if (Na__Mode === "read") {
            Na__Footer.setAttribute("hidden", "");
        } else {
            Na__Footer.removeAttribute("hidden");
        }
        Na__Footer.setAttribute("aria-hidden", "true");
    }
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Event Handlers
// -----------------------------------------------------------------------------

// FUNCTION | Render the current textarea contents into the article
// ------------------------------------------------------------
function Na__TextToReader__RenderCurrentInput() {
    const Na__UiText = Na__TextToReader__AppConfig.NaMiniApp__UiText;

    if (!Na__TextToReader__MarkedParse) {
        Na__TextToReader__ShowOutputError(Na__UiText.NaMiniApp__ErrorMarkedMissing);
        return false;
    }

    try {
        const Na__RawInput  = Na__TextToReader__Dom.Na__InputText.value;
        const Na__FinalHtml = Na__TextToReader__RenderInputToHtml(
            Na__RawInput,
            Na__TextToReader__MarkedParse,
            Na__TextToReader__AppConfig
        );

        Na__TextToReader__StopReadAloud();
        Na__TextToReader__Dom.Na__Output.innerHTML = Na__FinalHtml;
        return true;
    } catch (Na__ErrorObject) {
        Na__TextToReader__ShowOutputError(
            `${Na__UiText.NaMiniApp__ErrorRenderPrefix}: ${Na__ErrorObject.message}`
        );
        return false;
    }
}
// ------------------------------------------------------------


// FUNCTION | Show newly arrived text in the Read view from the top
// ------------------------------------------------------------
function Na__TextToReader__ShowTextInReadView() {
    Na__TextToReader__HoldAutoStart = false;
    if (Na__TextToReader__GetActiveMode() === "read") {
        if (Na__TextToReader__RenderCurrentInput()) Na__TextToReader__StartLoadedText();
        Na__TextToReader__FocusReadableArticle();
    } else {
        // The Read tab's mode-change handler renders and starts playback.
        Na__TextToReader__SetActiveMode("read");
    }
    Na__TextToReader__ResetCompactTransport();
}
// ------------------------------------------------------------


// FUNCTION | Stop reading a PDF that new text has replaced
// ------------------------------------------------------------
function Na__TextToReader__CancelPdfJob() {
    Na__TextToReader__PdfJob?.abort();
    Na__TextToReader__PdfJob = null;
    Na__TextToReader__PdfPending = null;
    clearInterval(Na__TextToReader__PdfPendingTimer);
    Na__TextToReader__PdfPendingTimer = 0;
}
// ------------------------------------------------------------


// FUNCTION | Put clipboard text into the editor and read it
// ------------------------------------------------------------
function Na__TextToReader__HandleClipboardText(Na__Text) {
    Na__TextToReader__CancelPdfJob();
    Na__TextToReader__Dom.Na__InputText.value = Na__Text;
    Na__TextToReader__ShowTextInReadView();
}
// ------------------------------------------------------------


// FUNCTION | Full screen button: toggles the page's full screen where the browser allows it
// ------------------------------------------------------------
function Na__TextToReader__InitialiseFullscreen(Na__Button) {
    if (!Na__Button) return;
    if (!document.documentElement.requestFullscreen) {
        Na__Button.hidden = true;   // iPhone Safari has no Fullscreen API for pages
        return;
    }
    Na__Button.addEventListener("click", () => {
        const Na__Request = document.fullscreenElement
            ? document.exitFullscreen()
            : document.documentElement.requestFullscreen({ navigationUI: "hide" });
        Na__Request.catch((Na__ErrorObject) => console.warn("Text To Reader full screen refused:", Na__ErrorObject));
    });
    document.addEventListener("fullscreenchange", () => {
        const Na__On = Boolean(document.fullscreenElement);
        Na__Button.setAttribute("aria-pressed", String(Na__On));
        Na__Button.title = Na__On ? "Exit full screen" : "Full screen";
    });
}
// ------------------------------------------------------------


// FUNCTION | Paste action (right-click menu, long-press on a blank Read view): clipboard text replaces the text
// ------------------------------------------------------------
async function Na__TextToReader__PasteFromMenu() {
    let Na__Text = "";
    try {
        Na__Text = await navigator.clipboard.readText();
    } catch (Na__ErrorObject) {
        console.warn("Text To Reader clipboard read refused:", Na__ErrorObject);
        Na__TextToReader__HandleClipboardBlocked();
        return;
    }
    if (!Na__Text.trim()) {
        // Nothing to paste: the launch modal says so and offers a file instead
        Na__TextToReader__OpenSourceModal();
        Na__TextToReader__Dom.Na__UploadFileStatus.textContent = Na__TextToReader__AppConfig.NaMiniApp__UiText.NaMiniApp__ClipboardEmpty;
        return;
    }
    Na__TextToReader__HandleClipboardText(Na__Text);
}
// ------------------------------------------------------------


// FUNCTION | Clipboard refused: open Edit so the text can be pasted by hand
// ------------------------------------------------------------
function Na__TextToReader__HandleClipboardBlocked() {
    const Na__UiText = Na__TextToReader__AppConfig.NaMiniApp__UiText;
    Na__TextToReader__Dom.Na__InputText.placeholder = Na__UiText.NaMiniApp__ClipboardBlockedPlaceholder;
    Na__TextToReader__SetActiveMode("edit");
}
// ------------------------------------------------------------


// FUNCTION | Place keyboard focus on the readable article
// ------------------------------------------------------------
function Na__TextToReader__FocusReadableArticle() {
    const Na__Output = Na__TextToReader__Dom.Na__Output;
    if (!Na__Output || typeof Na__Output.focus !== "function") return;

    Na__Output.focus({ preventScroll: true });
}
// ------------------------------------------------------------


// FUNCTION | After a local file loads, close the modal and read it
// ------------------------------------------------------------
function Na__TextToReader__HandleFileLoaded() {
    Na__TextToReader__CancelPdfJob();
    Na__TextToReader__CloseSourceModal();
    Na__TextToReader__ShowTextInReadView();
}
// ------------------------------------------------------------


// FUNCTION | Switch Read / Edit and render when entering Read
// ------------------------------------------------------------
function Na__TextToReader__HandleModeChange(Na__Mode) {
    Na__TextToReader__ApplyPanelVisibility(Na__Mode);
    Na__TextToReader__ResetCompactTransport();
    Na__TextToReader__SetReadAloudVisible(Na__Mode === "read");
    if (Na__Mode !== "read") Na__TextToReader__StopReadAloud();

    if (Na__Mode === "read") {
        if (Na__TextToReader__RenderCurrentInput() && !Na__TextToReader__HoldAutoStart) Na__TextToReader__StartLoadedText();
        Na__TextToReader__FocusReadableArticle();
        return;
    }

    if (Na__Mode === "edit") {
        Na__TextToReader__Dom.Na__InputText.focus();
    }
}
// ------------------------------------------------------------


// FUNCTION | Fill a UI text template's {name} placeholders
// ------------------------------------------------------------
function Na__TextToReader__FormatText(Na__Template, Na__Values) {
    return String(Na__Template || "").replace(/\{(\w+)\}/g, (Na__Match, Na__Key) =>
        (Na__Key in Na__Values ? String(Na__Values[Na__Key]) : Na__Match));
}
// ------------------------------------------------------------


// FUNCTION | "1 page", "3 pages"
// ------------------------------------------------------------
function Na__TextToReader__CountText(Na__Count, Na__Noun) {
    return `${Na__Count} ${Na__Noun}${Na__Count === 1 ? "" : "s"}`;
}
// ------------------------------------------------------------


// FUNCTION | "2", "2 and 5", "2, 5 and 7"
// ------------------------------------------------------------
function Na__TextToReader__ListText(Na__Items) {
    if (Na__Items.length <= 1) return Na__Items.join("");
    return Na__Items.slice(0, -1).join(", ") + " and " + Na__Items[Na__Items.length - 1];
}
// ------------------------------------------------------------


// FUNCTION | Show a PDF's text: what is read so far, or the whole document
// ------------------------------------------------------------
// The first text replaces whatever was on screen, as any new file does. After that, while
// read-aloud is preparing, holding or playing audio, the article is left alone and the
// newest text waits (checked each second), so the listener's audio and place survive.
// Speech is prepared automatically only once the whole PDF is in.
function Na__TextToReader__ShowPdfText(Na__Markdown, Na__IsFinal) {
    Na__TextToReader__Dom.Na__InputText.value = Na__Markdown;
    if (Na__TextToReader__PdfShown && Na__TextToReader__IsReadAloudBusy()) {
        Na__TextToReader__PdfPending = { markdown: Na__Markdown, final: Na__IsFinal };
        if (!Na__TextToReader__PdfPendingTimer) {
            Na__TextToReader__PdfPendingTimer = setInterval(() => {
                if (Na__TextToReader__IsReadAloudBusy() || !Na__TextToReader__PdfPending) return;
                const Na__Pending = Na__TextToReader__PdfPending;
                Na__TextToReader__ShowPdfText(Na__Pending.markdown, Na__Pending.final);
            }, 1000);
        }
        return;
    }
    clearInterval(Na__TextToReader__PdfPendingTimer);
    Na__TextToReader__PdfPendingTimer = 0;
    Na__TextToReader__PdfPending = null;
    Na__TextToReader__PdfShown = true;

    if (Na__IsFinal) {
        Na__TextToReader__ShowTextInReadView();
        return;
    }
    Na__TextToReader__HoldAutoStart = true;
    if (Na__TextToReader__GetActiveMode() === "read") {
        Na__TextToReader__RenderCurrentInput();
        Na__TextToReader__ResetCompactTransport();
    } else {
        Na__TextToReader__SetActiveMode("read");
    }
}
// ------------------------------------------------------------


// FUNCTION | Read a chosen PDF into the article; resolves its details, or null if a newer file replaced it
// ------------------------------------------------------------
async function Na__TextToReader__HandlePdfChosen(Na__File) {
    const Na__UiText = Na__TextToReader__AppConfig.NaMiniApp__UiText;
    Na__TextToReader__CancelPdfJob();
    const Na__Job = new AbortController();
    Na__TextToReader__PdfJob = Na__Job;
    Na__TextToReader__PdfShown = false;

    Na__TextToReader__CloseSourceModal();
    Na__TextToReader__StopReadAloud();

    // A newer file (or pasted text) aborts this job; until then it is current, finished or not
    const Na__IsCurrent = () => !Na__Job.signal.aborted;
    const Na__Status = (Na__Message, Na__Fraction) => {
        if (Na__IsCurrent()) Na__TextToReader__ShowReaderStatus(Na__Message, Na__Fraction);
    };
    const Na__Timer = Na__TextToReader__LogTimer(`Reading PDF "${Na__File.name}"`);

    try {
        const Na__Result = await Na__TextToReader__PdfToMarkdown(await Na__File.arrayBuffer(), {
            config     : Na__TextToReader__AppConfig.NaMiniApp__Pdf,
            signal     : Na__Job.signal,
            onProgress : ({ phase, page, pages, pageNumber }) => {
                if (phase === "open") {
                    Na__Status(Na__TextToReader__FormatText(Na__UiText.NaMiniApp__PdfOpening, { name: Na__File.name }), 0);
                } else if (phase === "text") {
                    Na__Status(Na__TextToReader__FormatText(Na__UiText.NaMiniApp__PdfReading, { page, pages }), page / pages);
                } else if (phase === "ocr-failed") {
                    // One scanned page failed; the rest of the PDF carries on (named again at the end)
                    Na__Status(Na__TextToReader__FormatText(Na__UiText.NaMiniApp__PdfOcrFailedPage, { pageNumber }), page / pages);
                } else {
                    Na__Status(Na__TextToReader__FormatText(Na__UiText.NaMiniApp__PdfRecognising, { page, pages, pageNumber }), (page - 1) / pages);
                }
            },
            onPartial  : (Na__Markdown) => {
                if (Na__IsCurrent()) Na__TextToReader__ShowPdfText(Na__Markdown, false);
            },
            // Scanned pages and no OCR model yet: ask once, install on Download
            onOcrConsent : (Na__Request) => Na__TextToReader__AskOcrConsent(Na__Request, Na__Job.signal)
        });
        if (!Na__IsCurrent()) return null;
        if (Na__TextToReader__PdfJob === Na__Job) Na__TextToReader__PdfJob = null;

        // Skipped scans are either failed recognitions (named by page) or pages left unread
        // because text recognition is not installed
        const Na__Failed = Array.isArray(Na__Result.failedPages) ? Na__Result.failedPages : [];
        const Na__NotInstalled = Math.max(0, Na__Result.skippedPages - Na__Failed.length);
        const Na__FailedText = Na__Failed.length
            ? Na__TextToReader__FormatText(Na__Failed.length === 1 ? Na__UiText.NaMiniApp__PdfPagesFailedOne : Na__UiText.NaMiniApp__PdfPagesFailedMany,
                { pages: Na__TextToReader__ListText(Na__Failed) })
            : "";
        const Na__Readable = Na__Result.textPages + Na__Result.ocrPages;
        const Na__Seconds = (Na__Result.ms / 1000).toFixed(1);
        const Na__Summary = `${Na__TextToReader__CountText(Na__Result.pages, "page")}: ${Na__Result.textPages} text` +
            (Na__Result.ocrPages ? `, ${Na__Result.ocrPages} by text recognition (${(Na__Result.ocrMs / 1000).toFixed(1)} s)` : "") +
            (Na__Failed.length ? `, recognition failed on ${Na__Failed.length === 1 ? "page" : "pages"} ${Na__TextToReader__ListText(Na__Failed)}` : "") +
            (Na__NotInstalled ? `, ${Na__NotInstalled} scanned not read` : "");
        const Na__Scans = Na__TextToReader__CountText(Na__NotInstalled, "scanned page");
        const Na__ScansText = Na__NotInstalled ? Na__TextToReader__FormatText(Na__UiText.NaMiniApp__PdfScansSkipped, { scans: Na__Scans }) : "";
        if (Na__FailedText) Na__TextToReader__Log("warn", `"${Na__File.name}": ${Na__FailedText}`);
        if (Na__ScansText) Na__TextToReader__Log("warn", Na__ScansText);
        if (!Na__Readable || !Na__Result.markdown.replace(/<!--[\s\S]*?-->/g, "").trim()) {
            throw new Error(Na__FailedText && !Na__NotInstalled ? Na__FailedText
                : Na__NotInstalled ? Na__TextToReader__FormatText(Na__UiText.NaMiniApp__PdfOnlyScans, { scans: Na__Scans })
                : Na__UiText.NaMiniApp__PdfNoText);
        }

        // Timed only once something is readable; an unreadable PDF is logged once, as a failure
        Na__Timer(`Read PDF "${Na__File.name}": ${Na__Summary}`);
        Na__TextToReader__ShowPdfText(Na__Result.markdown, true);
        const Na__Done = Na__TextToReader__FormatText(Na__UiText.NaMiniApp__PdfDone, { pages: Na__TextToReader__CountText(Na__Result.pages, "page"), seconds: Na__Seconds }) +
            (Na__FailedText ? " " + Na__FailedText : "") +
            (Na__ScansText ? " " + Na__ScansText : "") +
            (Na__TextToReader__PdfPending ? " " + Na__UiText.NaMiniApp__PdfWaitingForStop : "");
        Na__TextToReader__ShowReaderStatus(Na__Done, null);

        return {
            kind  : "pdf",
            pages : { total: Na__Result.pages, text: Na__Result.textPages, ocr: Na__Result.ocrPages, skipped: Na__Result.skippedPages, failed: Na__Failed },
            ms    : Na__Result.ms
        };
    } catch (Na__ErrorObject) {
        if (!Na__IsCurrent()) return null;   // a newer file took over; its own job reports
        if (Na__TextToReader__PdfJob === Na__Job) Na__TextToReader__PdfJob = null;
        Na__TextToReader__HoldAutoStart = false;
        Na__TextToReader__ShowReaderStatus("", null);
        const Na__Message = Na__ErrorObject?.name === "PasswordException" ? Na__UiText.NaMiniApp__PdfPassword
            : Na__ErrorObject?.name === "InvalidPDFException" ? Na__UiText.NaMiniApp__PdfInvalid
            : (Na__ErrorObject?.message || String(Na__ErrorObject));
        Na__Timer.fail(Na__Message);
        Na__TextToReader__OpenSourceModal();
        throw new Error(Na__Message);
    }
}
// ------------------------------------------------------------


// FUNCTION | Attach button listeners, tabs and the file-upload module
// ------------------------------------------------------------
function Na__TextToReader__RegisterEventListeners() {
    const Na__Defaults = Na__TextToReader__AppConfig.NaMiniApp__Defaults;
    const Na__UiText   = Na__TextToReader__AppConfig.NaMiniApp__UiText;

    // @delegate: ./MiniApp__TextToReader__ViewTabs__.js
    Na__TextToReader__InitialiseViewTabs({
        tabButtons   : [
            Na__TextToReader__Dom.Na__TabRead,
            Na__TextToReader__Dom.Na__TabEdit
        ],
        defaultMode  : Na__Defaults.NaMiniApp__DefaultView,
        onModeChange : Na__TextToReader__HandleModeChange
    });

    // @delegate: ./MiniApp__TextToReader__SourceModal__.js
    Na__TextToReader__InitialiseSourceModal({
        dialog             : Na__TextToReader__Dom.Na__SourceModal,
        pasteButton        : Na__TextToReader__Dom.Na__SourcePaste,
        laterButton        : Na__TextToReader__Dom.Na__SourceLater,
        statusElement      : Na__TextToReader__Dom.Na__UploadFileStatus,
        uiText             : Na__UiText,
        onText             : Na__TextToReader__HandleClipboardText,
        onClipboardBlocked : Na__TextToReader__HandleClipboardBlocked
    });
    Na__TextToReader__Dom.Na__UploadFileButton.addEventListener("click", Na__TextToReader__OpenSourceModal);

    // @delegate: ./MiniApp__TextToReader__FileUpload__.js
    // The modal's file button opens the picker; errors show in the modal's status line.
    Na__TextToReader__InitialiseFileUpload({
        triggerButton       : Na__TextToReader__Dom.Na__SourceFile,
        fileInput           : Na__TextToReader__Dom.Na__FileUploadInput,
        targetTextarea      : Na__TextToReader__Dom.Na__InputText,
        statusElement       : Na__TextToReader__Dom.Na__UploadFileStatus,
        acceptedExtensions  : Na__Defaults.NaMiniApp__AcceptedFileExtensions,
        uiText              : Na__UiText,
        onFileLoaded        : Na__TextToReader__HandleFileLoaded,
        onPdfChosen         : Na__TextToReader__HandlePdfChosen
    });

    // @delegate: ./MiniApp__TextToReader__DragDrop__.js
    // Files dropped on the page open through the same FileUpload entry as the picker
    import(Na__TextToReader__DragDropModuleUrl)
        .then(({ Na__TextToReader__InitialiseDragDrop }) => Na__TextToReader__InitialiseDragDrop({
            config          : Na__TextToReader__AppConfig.NaMiniApp__DragDrop,
            appConfig       : Na__TextToReader__AppConfig,
            dropTarget      : document.body,
            openFile        : Na__TextToReader__OpenFile,
            isSupportedFile : Na__TextToReader__IsSupportedFile,
            sourceModal     : Na__TextToReader__Dom.Na__SourceModal,
            statusElement   : Na__TextToReader__Dom.Na__UploadFileStatus
        }))
        .catch((Na__ErrorObject) => console.warn("Text To Reader: drag and drop not available:", Na__ErrorObject));

    // Native paste into Edit: let the browser insert text before rendering and starting.
    // A coalesced input fallback also catches mobile keyboards that skip the paste event.
    let Na__NativePasteTimer = 0;
    const Na__QueueNativePaste = () => {
        clearTimeout(Na__NativePasteTimer);
        Na__NativePasteTimer = setTimeout(() => {
            if (Na__TextToReader__Dom.Na__InputText.value.trim()) Na__TextToReader__ShowTextInReadView();
        }, 0);
    };
    Na__TextToReader__Dom.Na__InputText.addEventListener("paste", Na__QueueNativePaste);
    Na__TextToReader__Dom.Na__InputText.addEventListener("input", (Na__Event) => {
        if (Na__Event.inputType === "insertFromPaste" || Na__Event.inputType === "insertFromDrop") {
            Na__QueueNativePaste();
        }
    });
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Bootstrap
// -----------------------------------------------------------------------------

// FUNCTION | Load config, load Marked.js, paint UI text and wire events
// ------------------------------------------------------------
async function Na__TextToReader__BootstrapApp() {
    if (Na__TextToReader__HasRequiredDom() === false) {
        document.body.innerHTML = '<p class="TTR__error-message" style="padding: 20px;">Error: Essential HTML elements are missing.</p>';
        return;
    }

    const Na__ConfigUrl = Na__TextToReader__ReleaseVersion
        ? `${Na__TextToReader__ConfigPath}?v=${encodeURIComponent(Na__TextToReader__ReleaseVersion)}`
        : Na__TextToReader__ConfigPath;
    const Na__ConfigResponse = await fetch(Na__ConfigUrl, { cache: "no-cache" });
    if (!Na__ConfigResponse.ok) {
        throw new Error(`Failed to load app config (HTTP ${Na__ConfigResponse.status}).`);
    }

    Na__TextToReader__AppConfig = await Na__ConfigResponse.json();

    const Na__MarkedEsmUrl = Na__TextToReader__AppConfig.NaMiniApp__Assets.NaMiniApp__MarkedEsmUrl;
    Na__TextToReader__MarkedParse = await Na__TextToReader__LoadMarkedLibrary(Na__MarkedEsmUrl);

    Na__TextToReader__ApplyUiTextFromConfig();
    Na__TextToReader__InitialiseOcrModal(Na__TextToReader__AppConfig.NaMiniApp__UiText);

    // The Na logo opens the activity log: processing times and failures, kept across reloads
    Na__TextToReader__InitialiseActivityLog({
        trigger : document.getElementById("js__appLogo"),
        dialog  : document.getElementById("js__logModal"),
        list    : document.getElementById("js__logList"),
        device  : document.getElementById("js__logDevice"),
        copy    : document.getElementById("js__logCopy"),
        clear   : document.getElementById("js__logClear"),
        close   : document.getElementById("js__logClose"),
        version : Na__TextToReader__AppConfig.NaMiniApp__Meta.NaMiniApp__Version
    });

    // @delegate: ./MiniApp__TextToReader__UserConfig__.js
    // This user's remembered voice, speed and pitch; must load before read aloud starts
    await Na__TextToReader__LoadUserConfig(
        Na__TextToReader__AppConfig.NaMiniApp__ReadAloud,
        Na__TextToReader__AppConfig.NaMiniApp__Meta.NaMiniApp__Version
    );
    Na__TextToReader__InitialiseReadAloud({
        config  : Na__TextToReader__AppConfig.NaMiniApp__ReadAloud,
        article : Na__TextToReader__Dom.Na__Output
    });
    // @delegate: ./MiniApp__TextToReader__WordJump__.js
    // Double-click / long-press a word to play from its sentence; custom right-click menu
    Na__TextToReader__InitialiseWordJump({
        article : Na__TextToReader__Dom.Na__Output,
        audio   : document.getElementById("js__audioElement"),
        menu    : document.getElementById("js__wordMenu"),
        prepare : document.getElementById("js__audioPrepare"),
        pause   : document.getElementById("js__audioPause"),
        stop    : document.getElementById("js__audioStop"),
        onPaste : Na__TextToReader__PasteFromMenu
    });
    Na__TextToReader__RegisterEventListeners();
    Na__TextToReader__InitialiseCompactTransport();
    Na__TextToReader__InitialiseFullscreen(document.getElementById("js__fullscreenButton"));
    Na__TextToReader__ApplyPanelVisibility(Na__TextToReader__GetActiveMode());

    // Launch: ask for text first; the voice download prompt waits until this modal closes.
    // Text the browser restored into the editor (a reload) is shown instead.
    if (Na__TextToReader__Dom.Na__InputText.value.trim()) {
        if (Na__TextToReader__RenderCurrentInput() && Na__TextToReader__GetActiveMode() === "read") {
            Na__TextToReader__StartLoadedText();
        }
    } else {
        Na__TextToReader__OpenSourceModal();
    }
    Na__TextToReader__SetReadAloudVisible(Na__TextToReader__GetActiveMode() === "read");
}
// ------------------------------------------------------------


// INITIALISE | Run bootstrap on DOM ready
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    Na__TextToReader__BootstrapApp().catch((Na__ErrorObject) => {
        console.error("Text To Reader bootstrap failed:", Na__ErrorObject);
        const Na__Output = document.getElementById("js__output");
        if (Na__Output) {
            Na__Output.textContent = "Unable to load app configuration.";
        }
    });
});
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
