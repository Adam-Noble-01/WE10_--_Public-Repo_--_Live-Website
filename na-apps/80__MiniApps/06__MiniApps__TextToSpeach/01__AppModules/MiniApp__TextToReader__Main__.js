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
import { Na__TextToReader__InitialiseActivityLog } from "./MiniApp__TextToReader__ActivityLog__.js";

// @delegate: ./MiniApp__TextToReader__ReadAloud__.js
import {
    Na__TextToReader__InitialiseReadAloud,
    Na__TextToReader__StopReadAloud,
    Na__TextToReader__SetReadAloudVisible
} from "./MiniApp__TextToReader__ReadAloud__.js";

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
    if (Na__TextToReader__GetActiveMode() === "read") {
        Na__TextToReader__RenderCurrentInput();
        Na__TextToReader__FocusReadableArticle();
    } else {
        Na__TextToReader__SetActiveMode("read");
    }
    Na__TextToReader__Dom.Na__Output.closest(".TTR__panel--output")?.scrollTo({ top: 0 });
}
// ------------------------------------------------------------


// FUNCTION | Put clipboard text into the editor and read it
// ------------------------------------------------------------
function Na__TextToReader__HandleClipboardText(Na__Text) {
    Na__TextToReader__Dom.Na__InputText.value = Na__Text;
    Na__TextToReader__ShowTextInReadView();
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
    Na__TextToReader__CloseSourceModal();
    Na__TextToReader__ShowTextInReadView();
}
// ------------------------------------------------------------


// FUNCTION | Switch Read / Edit and render when entering Read
// ------------------------------------------------------------
function Na__TextToReader__HandleModeChange(Na__Mode) {
    Na__TextToReader__ApplyPanelVisibility(Na__Mode);
    Na__TextToReader__SetReadAloudVisible(Na__Mode === "read");
    if (Na__Mode !== "read") Na__TextToReader__StopReadAloud();

    if (Na__Mode === "read") {
        Na__TextToReader__RenderCurrentInput();
        Na__TextToReader__FocusReadableArticle();
        return;
    }

    if (Na__Mode === "edit") {
        Na__TextToReader__Dom.Na__InputText.focus();
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
        onFileLoaded        : Na__TextToReader__HandleFileLoaded
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
        stop    : document.getElementById("js__audioStop")
    });
    Na__TextToReader__RegisterEventListeners();
    Na__TextToReader__ApplyPanelVisibility(Na__TextToReader__GetActiveMode());

    // Launch: ask for text first; the voice download prompt waits until this modal closes.
    // Text the browser restored into the editor (a reload) is shown instead.
    if (Na__TextToReader__Dom.Na__InputText.value.trim()) {
        Na__TextToReader__RenderCurrentInput();
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
