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
import { Na__TextToReader__InitialiseFileUpload } from "./MiniApp__TextToReader__FileUpload__.js";

// @delegate: ./MiniApp__TextToReader__MarkdownRender__.js
import {
    Na__TextToReader__LoadMarkedLibrary,
    Na__TextToReader__RenderInputToHtml,
    Na__TextToReader__BuildErrorHtml
} from "./MiniApp__TextToReader__MarkdownRender__.js";

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module-Level Variables
// -----------------------------------------------------------------------------

 const Na__TextToReader__ConfigPath = "./MiniApp__TextToReader__AppConfig__.json";   // Resolved against the page, not the module folder

 let Na__TextToReader__AppConfig   = null;
 let Na__TextToReader__MarkedParse = null;

 const Na__TextToReader__Dom = {
     Na__AppTitle          : document.getElementById("js__appTitle"),
     Na__AppVersion        : document.getElementById("js__appVersion"),
     Na__InputLabel        : document.getElementById("js__inputLabel"),
     Na__InputText         : document.getElementById("js__inputText"),
     Na__UploadFileButton  : document.getElementById("js__uploadFileButton"),
     Na__FileUploadInput   : document.getElementById("js__fileUploadInput"),
     Na__UploadFileStatus  : document.getElementById("js__uploadFileStatus"),
     Na__ActionsHeading    : document.getElementById("js__actionsHeading"),
     Na__RenderButton      : document.getElementById("js__renderButton"),
     Na__ClearButton       : document.getElementById("js__clearButton"),
     Na__OutputHeading     : document.getElementById("js__outputHeading"),
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
    Na__TextToReader__Dom.Na__InputLabel.textContent       = Na__UiText.NaMiniApp__InputLabel;
    Na__TextToReader__Dom.Na__InputText.placeholder        = Na__UiText.NaMiniApp__InputPlaceholder;
    Na__TextToReader__Dom.Na__UploadFileButton.textContent = Na__UiText.NaMiniApp__UploadButton;
    Na__TextToReader__Dom.Na__ActionsHeading.textContent   = Na__UiText.NaMiniApp__ActionsHeading;
    Na__TextToReader__Dom.Na__RenderButton.textContent     = Na__UiText.NaMiniApp__RenderButton;
    Na__TextToReader__Dom.Na__ClearButton.textContent      = Na__UiText.NaMiniApp__ClearButton;
    Na__TextToReader__Dom.Na__OutputHeading.textContent    = Na__UiText.NaMiniApp__OutputHeading;
    Na__TextToReader__Dom.Na__PageFooter.textContent       = Na__UiText.NaMiniApp__FooterText;
}
// ------------------------------------------------------------


// FUNCTION | Write an error into the output pane
// ------------------------------------------------------------
function Na__TextToReader__ShowOutputError(Na__Message) {
    Na__TextToReader__Dom.Na__Output.innerHTML = Na__TextToReader__BuildErrorHtml(Na__Message);
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Event Handlers
// -----------------------------------------------------------------------------

// FUNCTION | Render the current textarea contents
// ------------------------------------------------------------
function Na__TextToReader__HandleRenderClick(Na__Event) {
    Na__Event.preventDefault();

    const Na__UiText = Na__TextToReader__AppConfig.NaMiniApp__UiText;

    if (!Na__TextToReader__MarkedParse) {
        Na__TextToReader__ShowOutputError(Na__UiText.NaMiniApp__ErrorMarkedMissing);
        return;
    }

    try {
        const Na__RawInput  = Na__TextToReader__Dom.Na__InputText.value;
        const Na__FinalHtml = Na__TextToReader__RenderInputToHtml(
            Na__RawInput,
            Na__TextToReader__MarkedParse,
            Na__TextToReader__AppConfig
        );

        Na__TextToReader__Dom.Na__Output.innerHTML = Na__FinalHtml;

        const Na__Breakpoint = Na__TextToReader__AppConfig.NaMiniApp__Defaults.NaMiniApp__MobileScrollBreakpoint;
        if (window.innerWidth <= Na__Breakpoint) {
            Na__TextToReader__Dom.Na__Output.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
    } catch (Na__ErrorObject) {
        Na__TextToReader__ShowOutputError(
            `${Na__UiText.NaMiniApp__ErrorRenderPrefix}: ${Na__ErrorObject.message}`
        );
    }
}
// ------------------------------------------------------------


// FUNCTION | Clear the input, output and upload status
// ------------------------------------------------------------
function Na__TextToReader__HandleClearClick() {
    Na__TextToReader__Dom.Na__InputText.value                    = "";
    Na__TextToReader__Dom.Na__Output.innerHTML                   = "";
    Na__TextToReader__Dom.Na__UploadFileStatus.textContent       = "";
    Na__TextToReader__Dom.Na__UploadFileStatus.classList.remove("TTR__upload-status--error");
}
// ------------------------------------------------------------


// FUNCTION | Attach button listeners and the file-upload module
// ------------------------------------------------------------
function Na__TextToReader__RegisterEventListeners() {
    const Na__Defaults = Na__TextToReader__AppConfig.NaMiniApp__Defaults;
    const Na__UiText   = Na__TextToReader__AppConfig.NaMiniApp__UiText;

    Na__TextToReader__Dom.Na__RenderButton.addEventListener("click", Na__TextToReader__HandleRenderClick);
    Na__TextToReader__Dom.Na__ClearButton.addEventListener("click",  Na__TextToReader__HandleClearClick);

    // @delegate: ./MiniApp__TextToReader__FileUpload__.js
    Na__TextToReader__InitialiseFileUpload({
        triggerButton       : Na__TextToReader__Dom.Na__UploadFileButton,
        fileInput           : Na__TextToReader__Dom.Na__FileUploadInput,
        targetTextarea      : Na__TextToReader__Dom.Na__InputText,
        statusElement       : Na__TextToReader__Dom.Na__UploadFileStatus,
        acceptedExtensions  : Na__Defaults.NaMiniApp__AcceptedFileExtensions,
        uiText              : Na__UiText
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

    const Na__ConfigResponse = await fetch(Na__TextToReader__ConfigPath, { cache: "no-cache" });
    if (!Na__ConfigResponse.ok) {
        throw new Error(`Failed to load app config (HTTP ${Na__ConfigResponse.status}).`);
    }

    Na__TextToReader__AppConfig = await Na__ConfigResponse.json();

    const Na__MarkedEsmUrl = Na__TextToReader__AppConfig.NaMiniApp__Assets.NaMiniApp__MarkedEsmUrl;
    Na__TextToReader__MarkedParse = await Na__TextToReader__LoadMarkedLibrary(Na__MarkedEsmUrl);

    Na__TextToReader__ApplyUiTextFromConfig();
    Na__TextToReader__RegisterEventListeners();
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
