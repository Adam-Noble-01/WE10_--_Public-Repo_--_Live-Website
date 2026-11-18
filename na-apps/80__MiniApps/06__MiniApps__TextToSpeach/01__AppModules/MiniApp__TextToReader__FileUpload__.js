// =============================================================================
// NOBLE ARCHITECTURE - TEXT TO READER - FILE UPLOAD
// =============================================================================
//
// FILE    : MiniApp__TextToReader__FileUpload__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Load a local Markdown, text or PDF file into the input textarea
// CREATED : 19-Sep-2026
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Imports
// -----------------------------------------------------------------------------

// @delegate: ./MiniApp__TextToReader__UserConfig__.js (last file and the folder it came from)
import {
    Na__TextToReader__GetLastFileHandle,
    Na__TextToReader__RememberOpenedFile
} from "./MiniApp__TextToReader__UserConfig__.js";

// @delegate: ./MiniApp__TextToReader__PdfRenderer__.js (PDFs are read by the controller's onPdfChosen)
import { Na__TextToReader__IsPdfFile } from "./MiniApp__TextToReader__PdfRenderer__.js";

// @delegate: ./MiniApp__TextToReader__ActivityLog__.js (which file opened, and from where)
import { Na__TextToReader__Log } from "./MiniApp__TextToReader__ActivityLog__.js";

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module-Level Variables
// -----------------------------------------------------------------------------

 // Chromium also remembers the last folder per picker id, as a second line behind startIn
 const Na__TextToReader__PickerId = "NaTextToReader__OpenText";

 // Set by InitialiseFileUpload: the one load configuration the picker and drag-drop share
 let Na__TextToReader__LoadSettings = null;

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Internal Helpers
// -----------------------------------------------------------------------------

// FUNCTION | Confirm the chosen file uses an accepted extension
// ------------------------------------------------------------
function Na__TextToReader__HasAcceptedExtension(Na__FileObject, Na__AcceptedExtensions) {
    if (!Na__FileObject || !Na__FileObject.name) return false;

    const Na__FileNameLower = Na__FileObject.name.toLowerCase();
    return Na__AcceptedExtensions.some((Na__Extension) => Na__FileNameLower.endsWith(Na__Extension));
}
// ------------------------------------------------------------


// FUNCTION | Read a File object as text
// ------------------------------------------------------------
function Na__TextToReader__ReadFileAsText(Na__FileObject) {
    return new Promise((Na__Resolve, Na__Reject) => {
        const Na__Reader    = new FileReader();
        Na__Reader.onload   = () => Na__Resolve(Na__Reader.result);
        Na__Reader.onerror  = () => Na__Reject(Na__Reader.error || new Error("Unable to read file."));
        Na__Reader.readAsText(Na__FileObject);
    });
}
// ------------------------------------------------------------


// FUNCTION | Write a status message and toggle the error class
// ------------------------------------------------------------
function Na__TextToReader__ShowUploadStatus(Na__StatusElement, Na__TriggerButton, Na__Message, Na__IsError) {
    if (Na__StatusElement) {
        Na__StatusElement.textContent = Na__Message;
        Na__StatusElement.classList.toggle("TTR__upload-status--error", Na__IsError === true);
    }

    if (Na__TriggerButton) {
        Na__TriggerButton.classList.toggle("TTR__upload-icon-button--error", Na__IsError === true);
        if (Na__Message) {
            Na__TriggerButton.title = Na__Message;
        }
    }
}
// ------------------------------------------------------------


// FUNCTION | Handle the hidden file input change event (browsers without a file picker API)
// ------------------------------------------------------------
async function Na__TextToReader__HandleFileInputChange(Na__Event, Na__Config) {
    const Na__SelectedFile = Na__Event.target.files && Na__Event.target.files[0];
    Na__Event.target.value = "";
    if (!Na__SelectedFile) return;
    await Na__TextToReader__LoadChosenFile(Na__SelectedFile, null, Na__Config, "picker");
}
// ------------------------------------------------------------


// FUNCTION | Open the file picker in the folder of the last file opened (Edge / Chrome desktop)
// A stale handle (file moved or deleted) is retried without startIn; Cancel is silent.
// ------------------------------------------------------------
async function Na__TextToReader__PickWithFilePicker(Na__Config) {
    // One file type holding both, so PDFs show without switching the picker's filter
    const Na__TextExtensions = Na__Config.acceptedExtensions.filter((Na__Extension) => Na__Extension !== ".pdf");
    const Na__Accept = { "text/plain": Na__TextExtensions };
    if (Na__Config.acceptedExtensions.includes(".pdf")) Na__Accept["application/pdf"] = [".pdf"];
    const Na__Options = {
        id    : Na__TextToReader__PickerId,
        types : [{
            description : Na__Accept["application/pdf"] ? "Markdown, text or PDF" : "Markdown or text",
            accept      : Na__Accept
        }]
    };
    const Na__LastHandle = await Na__TextToReader__GetLastFileHandle();
    if (Na__LastHandle) Na__Options.startIn = Na__LastHandle;

    let Na__Handles = null;
    try {
        Na__Handles = await window.showOpenFilePicker(Na__Options);
    } catch (Na__ErrorObject) {
        if (Na__ErrorObject.name === "AbortError") return;
        if (!Na__Options.startIn) throw Na__ErrorObject;
        delete Na__Options.startIn;
        Na__Handles = await window.showOpenFilePicker(Na__Options);
    }

    const Na__Handle = Na__Handles[0];
    await Na__TextToReader__LoadChosenFile(await Na__Handle.getFile(), Na__Handle, Na__Config, "picker");
}
// ------------------------------------------------------------


// FUNCTION | Check, read and hand on a chosen file; remember it for next time
// Na__Source: "picker" or "drop", for the activity log
// ------------------------------------------------------------
async function Na__TextToReader__LoadChosenFile(Na__SelectedFile, Na__Handle, Na__Config, Na__Source) {
    const Na__UiText              = Na__Config.uiText;
    const Na__AcceptedExtensions  = Na__Config.acceptedExtensions;
    const Na__TargetTextarea      = Na__Config.targetTextarea;
    const Na__StatusElement       = Na__Config.statusElement;
    const Na__TriggerButton       = Na__Config.triggerButton;

    if (Na__TextToReader__HasAcceptedExtension(Na__SelectedFile, Na__AcceptedExtensions) === false) {
        Na__TextToReader__ShowUploadStatus(
            Na__StatusElement,
            Na__TriggerButton,
            `${Na__UiText.NaMiniApp__StatusUnsupportedPrefix}: "${Na__SelectedFile.name}". ${Na__UiText.NaMiniApp__StatusUnsupportedSuffix}`,
            true
        );
        return;
    }

    Na__TextToReader__Log("info", `Opened "${Na__SelectedFile.name}" (${Na__Source || "picker"})`);

    // A PDF goes to the controller, which reads it into the article page by page
    if (Na__TextToReader__IsPdfFile(Na__SelectedFile) && typeof Na__Config.onPdfChosen === "function") {
        try {
            const Na__Details = await Na__Config.onPdfChosen(Na__SelectedFile);
            if (!Na__Details) return;   // replaced by a newer file before it finished
            Na__TextToReader__ShowUploadStatus(
                Na__StatusElement,
                Na__TriggerButton,
                `${Na__UiText.NaMiniApp__StatusLoadedPrefix} "${Na__SelectedFile.name}"`,
                false
            );
            Na__TextToReader__RememberOpenedFile(Na__SelectedFile.name, Na__Handle, Na__Details);
        } catch (Na__ErrorObject) {
            Na__TextToReader__ShowUploadStatus(
                Na__StatusElement,
                Na__TriggerButton,
                `${Na__UiText.NaMiniApp__StatusReadErrorPrefix}: ${Na__ErrorObject.message}`,
                true
            );
        }
        return;
    }

    try {
        const Na__FileText = await Na__TextToReader__ReadFileAsText(Na__SelectedFile);

        if (Na__TargetTextarea) {
            Na__TargetTextarea.value = Na__FileText;
            Na__TargetTextarea.dispatchEvent(new Event("input", { bubbles: true }));
        }

        Na__TextToReader__ShowUploadStatus(
            Na__StatusElement,
            Na__TriggerButton,
            `${Na__UiText.NaMiniApp__StatusLoadedPrefix} "${Na__SelectedFile.name}"`,
            false
        );

        // Not awaited: storage must never hold up showing the text
        Na__TextToReader__RememberOpenedFile(Na__SelectedFile.name, Na__Handle);

        if (typeof Na__Config.onFileLoaded === "function") {
            Na__Config.onFileLoaded(Na__FileText, Na__SelectedFile);
        }
    } catch (Na__ErrorObject) {
        Na__TextToReader__ShowUploadStatus(
            Na__StatusElement,
            Na__TriggerButton,
            `${Na__UiText.NaMiniApp__StatusReadErrorPrefix}: ${Na__ErrorObject.message}`,
            true
        );
    }
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Exports
// -----------------------------------------------------------------------------

// FUNCTION | IsSupportedFile - Whether a file has one of the AppConfig's accepted extensions
// ------------------------------------------------------------
export function Na__TextToReader__IsSupportedFile(Na__File) {
    return Na__TextToReader__HasAcceptedExtension(Na__File, Na__TextToReader__LoadSettings?.acceptedExtensions || []);
}
// ------------------------------------------------------------


// FUNCTION | OpenFile - The one way in for a file, from the picker or a drop
// ------------------------------------------------------------
// Routes .md / .markdown / .txt to the editor and .pdf to the controller's PDF reader,
// reports an unsupported type in the source modal's status line, and keeps the last-file
// record. Na__Options.handle (a FileSystemFileHandle from a drop, optional) becomes the
// last-folder handle, as the picker's does; Na__Options.source is "picker" or "drop".
export async function Na__TextToReader__OpenFile(Na__File, Na__Options = {}) {
    if (!Na__TextToReader__LoadSettings) throw new Error("Text To Reader file upload is not initialised.");
    await Na__TextToReader__LoadChosenFile(Na__File, Na__Options.handle || null, Na__TextToReader__LoadSettings,
        Na__Options.source || "picker");
}
// ------------------------------------------------------------


// FUNCTION | Wire the upload button, hidden input, textarea and status span
// ------------------------------------------------------------
export function Na__TextToReader__InitialiseFileUpload(Na__Config) {
    const {
        triggerButton,
        fileInput,
        targetTextarea,
        statusElement,
        acceptedExtensions,
        uiText
    } = Na__Config || {};

    if (!triggerButton || !fileInput || !targetTextarea) {
        console.error("Text To Reader file upload: missing required elements.");
        return;
    }

    const Na__LoadConfig = {
        triggerButton,
        targetTextarea,
        statusElement,
        acceptedExtensions,
        uiText,
        onFileLoaded: Na__Config.onFileLoaded,
        onPdfChosen : Na__Config.onPdfChosen
    };
    Na__TextToReader__LoadSettings = Na__LoadConfig;

    // The picker API can open in the last folder; phones, Firefox and Safari use the plain input
    triggerButton.addEventListener("click", () => {
        if (typeof window.showOpenFilePicker !== "function") {
            fileInput.click();
            return;
        }
        Na__TextToReader__PickWithFilePicker(Na__LoadConfig).catch((Na__ErrorObject) => {
            console.warn("Text To Reader file picker failed; using the file input:", Na__ErrorObject);
            fileInput.click();
        });
    });

    fileInput.addEventListener("change", (Na__Event) => {
        Na__TextToReader__HandleFileInputChange(Na__Event, Na__LoadConfig);
    });
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
