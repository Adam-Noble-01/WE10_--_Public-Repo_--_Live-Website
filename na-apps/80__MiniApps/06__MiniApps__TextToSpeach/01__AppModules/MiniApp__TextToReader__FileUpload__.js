// =============================================================================
// NOBLE ARCHITECTURE - TEXT TO READER - FILE UPLOAD
// =============================================================================
//
// FILE    : MiniApp__TextToReader__FileUpload__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Load a local Markdown or text file into the input textarea
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

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module-Level Variables
// -----------------------------------------------------------------------------

 // Chromium also remembers the last folder per picker id, as a second line behind startIn
 const Na__TextToReader__PickerId = "NaTextToReader__OpenText";

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Internal Helpers
// -----------------------------------------------------------------------------

// FUNCTION | Confirm the chosen file uses an accepted extension
// ------------------------------------------------------------
function Na__TextToReader__IsSupportedFile(Na__FileObject, Na__AcceptedExtensions) {
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
    await Na__TextToReader__LoadChosenFile(Na__SelectedFile, null, Na__Config);
}
// ------------------------------------------------------------


// FUNCTION | Open the file picker in the folder of the last file opened (Edge / Chrome desktop)
// A stale handle (file moved or deleted) is retried without startIn; Cancel is silent.
// ------------------------------------------------------------
async function Na__TextToReader__PickWithFilePicker(Na__Config) {
    const Na__Options = {
        id    : Na__TextToReader__PickerId,
        types : [{
            description : "Markdown or text",
            accept      : { "text/plain": Na__Config.acceptedExtensions }
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
    await Na__TextToReader__LoadChosenFile(await Na__Handle.getFile(), Na__Handle, Na__Config);
}
// ------------------------------------------------------------


// FUNCTION | Check, read and hand on a chosen file; remember it for next time
// ------------------------------------------------------------
async function Na__TextToReader__LoadChosenFile(Na__SelectedFile, Na__Handle, Na__Config) {
    const Na__UiText              = Na__Config.uiText;
    const Na__AcceptedExtensions  = Na__Config.acceptedExtensions;
    const Na__TargetTextarea      = Na__Config.targetTextarea;
    const Na__StatusElement       = Na__Config.statusElement;
    const Na__TriggerButton       = Na__Config.triggerButton;

    if (Na__TextToReader__IsSupportedFile(Na__SelectedFile, Na__AcceptedExtensions) === false) {
        Na__TextToReader__ShowUploadStatus(
            Na__StatusElement,
            Na__TriggerButton,
            `${Na__UiText.NaMiniApp__StatusUnsupportedPrefix}: "${Na__SelectedFile.name}". ${Na__UiText.NaMiniApp__StatusUnsupportedSuffix}`,
            true
        );
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
        onFileLoaded: Na__Config.onFileLoaded
    };

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
