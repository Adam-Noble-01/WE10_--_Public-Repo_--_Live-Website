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


// FUNCTION | Handle the hidden file input change event
// ------------------------------------------------------------
async function Na__TextToReader__HandleFileInputChange(Na__Event, Na__Config) {
    const Na__SelectedFile = Na__Event.target.files && Na__Event.target.files[0];
    if (!Na__SelectedFile) return;

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
        Na__Event.target.value = "";
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
    } finally {
        Na__Event.target.value = "";
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

    triggerButton.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", (Na__Event) => {
        Na__TextToReader__HandleFileInputChange(Na__Event, {
            triggerButton,
            targetTextarea,
            statusElement,
            acceptedExtensions,
            uiText,
            onFileLoaded: Na__Config.onFileLoaded
        });
    });
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
