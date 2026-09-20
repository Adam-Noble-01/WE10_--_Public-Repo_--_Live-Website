// =============================================================================
// NOBLE ARCHITECTURE - PHOTO UTILS - CONSOLE IMAGE DOWNLOADER - MAIN
// =============================================================================
//
// FILE    : MiniApp__PhotoUtils__ConsoleImageDownloader__Main__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Load config, fetch the console snippet, copy it to the clipboard
// CREATED : 20-Sep-2026
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module-Level Variables
// -----------------------------------------------------------------------------

 const Na__ConsoleDownloader__ConfigPath = "./MiniApp__PhotoUtils__ConsoleImageDownloader__AppConfig__.json";

 let Na__ConsoleDownloader__AppConfig    = null;
 let Na__ConsoleDownloader__SnippetText  = "";
 let Na__ConsoleDownloader__ResetTimerId = null;

 const Na__ConsoleDownloader__Dom = {
     Na__AppTitle       : document.getElementById("js__appTitle"),
     Na__AppVersion     : document.getElementById("js__appVersion"),
     Na__NoticeHeading  : document.getElementById("js__noticeHeading"),
     Na__NoticeBody     : document.getElementById("js__noticeBody"),
     Na__StepsHeading   : document.getElementById("js__stepsHeading"),
     Na__StepsList      : document.getElementById("js__stepsList"),
     Na__CopyHeading    : document.getElementById("js__copyHeading"),
     Na__CopyLead       : document.getElementById("js__copyLead"),
     Na__CopyButton     : document.getElementById("js__copyButton"),
     Na__CopyStatus     : document.getElementById("js__copyStatus"),
     Na__PreviewHeading : document.getElementById("js__previewHeading"),
     Na__PreviewLead    : document.getElementById("js__previewLead"),
     Na__SnippetPreview : document.getElementById("js__snippetPreview"),
     Na__NotesHeading   : document.getElementById("js__notesHeading"),
     Na__NotesList      : document.getElementById("js__notesList"),
     Na__PageFooter     : document.getElementById("js__pageFooter")
 };

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | UI Helpers
// -----------------------------------------------------------------------------

// FUNCTION | Confirm every required DOM node was found
// ------------------------------------------------------------
function Na__ConsoleDownloader__HasRequiredDom() {
    return Object.values(Na__ConsoleDownloader__Dom).every((Na__Node) => Na__Node !== null);
}
// ------------------------------------------------------------


// FUNCTION | Fill an ordered or unordered list from a string array
// ------------------------------------------------------------
function Na__ConsoleDownloader__RenderTextList(Na__ListNode, Na__Items) {
    Na__ListNode.replaceChildren();

    if (!Array.isArray(Na__Items)) return;

    Na__Items.forEach((Na__ItemText) => {
        const Na__Item = document.createElement("li");
        Na__Item.textContent = Na__ItemText;
        Na__ListNode.appendChild(Na__Item);
    });
}
// ------------------------------------------------------------


// FUNCTION | Apply configured titles, labels and status text
// ------------------------------------------------------------
function Na__ConsoleDownloader__ApplyUiTextFromConfig() {
    const Na__UiText = Na__ConsoleDownloader__AppConfig.NaMiniApp__UiText;
    const Na__Meta   = Na__ConsoleDownloader__AppConfig.NaMiniApp__Meta;

    document.title = Na__UiText.NaMiniApp__PageTitle;

    Na__ConsoleDownloader__Dom.Na__AppTitle.textContent       = Na__UiText.NaMiniApp__AppHeading;
    Na__ConsoleDownloader__Dom.Na__AppVersion.textContent     = `v${Na__Meta.NaMiniApp__Version}`;
    Na__ConsoleDownloader__Dom.Na__NoticeHeading.textContent  = Na__UiText.NaMiniApp__NoticeHeading;
    Na__ConsoleDownloader__Dom.Na__NoticeBody.textContent     = Na__UiText.NaMiniApp__NoticeBody;
    Na__ConsoleDownloader__Dom.Na__StepsHeading.textContent   = Na__UiText.NaMiniApp__StepsHeading;
    Na__ConsoleDownloader__Dom.Na__CopyHeading.textContent    = Na__UiText.NaMiniApp__CopyHeading;
    Na__ConsoleDownloader__Dom.Na__CopyLead.textContent       = Na__UiText.NaMiniApp__CopyLead;
    Na__ConsoleDownloader__Dom.Na__CopyButton.textContent     = Na__UiText.NaMiniApp__ButtonCopy;
    Na__ConsoleDownloader__Dom.Na__PreviewHeading.textContent = Na__UiText.NaMiniApp__PreviewHeading;
    Na__ConsoleDownloader__Dom.Na__PreviewLead.textContent    = Na__UiText.NaMiniApp__PreviewLead;
    Na__ConsoleDownloader__Dom.Na__NotesHeading.textContent   = Na__UiText.NaMiniApp__NotesHeading;
    Na__ConsoleDownloader__Dom.Na__PageFooter.textContent     = Na__UiText.NaMiniApp__FooterText;

    Na__ConsoleDownloader__Dom.Na__SnippetPreview.setAttribute(
        "aria-label",
        Na__UiText.NaMiniApp__SnippetAriaLabel
    );

    Na__ConsoleDownloader__RenderTextList(
        Na__ConsoleDownloader__Dom.Na__StepsList,
        Na__ConsoleDownloader__AppConfig.NaMiniApp__Steps
    );

    Na__ConsoleDownloader__RenderTextList(
        Na__ConsoleDownloader__Dom.Na__NotesList,
        Na__ConsoleDownloader__AppConfig.NaMiniApp__Notes
    );
}
// ------------------------------------------------------------


// FUNCTION | Set the live status line and optional error/copied modifier
// ------------------------------------------------------------
function Na__ConsoleDownloader__SetStatus(Na__Message, Na__Tone) {
    const Na__StatusNode = Na__ConsoleDownloader__Dom.Na__CopyStatus;

    Na__StatusNode.textContent = Na__Message;
    Na__StatusNode.classList.remove("CID__status--copied", "CID__status--error");

    if (Na__Tone === "copied") {
        Na__StatusNode.classList.add("CID__status--copied");
        return;
    }

    if (Na__Tone === "error") {
        Na__StatusNode.classList.add("CID__status--error");
    }
}
// ------------------------------------------------------------


// FUNCTION | Restore the copy button label after the configured delay
// ------------------------------------------------------------
function Na__ConsoleDownloader__ResetCopyButtonLater() {
    const Na__UiText    = Na__ConsoleDownloader__AppConfig.NaMiniApp__UiText;
    const Na__ResetMs   = Na__ConsoleDownloader__AppConfig.NaMiniApp__Defaults.NaMiniApp__CopiedResetMs;
    const Na__Button    = Na__ConsoleDownloader__Dom.Na__CopyButton;

    if (Na__ConsoleDownloader__ResetTimerId !== null) {
        window.clearTimeout(Na__ConsoleDownloader__ResetTimerId);
    }

    Na__ConsoleDownloader__ResetTimerId = window.setTimeout(() => {
        Na__Button.textContent = Na__UiText.NaMiniApp__ButtonCopy;
        Na__Button.classList.remove("CID__copy-button--copied");
        Na__ConsoleDownloader__ResetTimerId = null;
    }, Na__ResetMs);
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Clipboard
// -----------------------------------------------------------------------------

// FUNCTION | Select the visible snippet preview so copy / Ctrl+C has a target
// ------------------------------------------------------------
function Na__ConsoleDownloader__SelectSnippetPreview() {
    const Na__Preview = Na__ConsoleDownloader__Dom.Na__SnippetPreview;
    if (!Na__Preview) return false;

    Na__Preview.focus();
    const Na__Selection = window.getSelection();
    const Na__Range     = document.createRange();
    Na__Range.selectNodeContents(Na__Preview);
    Na__Selection.removeAllRanges();
    Na__Selection.addRange(Na__Range);
    return true;
}
// ------------------------------------------------------------


// FUNCTION | Synchronous copy while the click is still a user gesture
// ------------------------------------------------------------
function Na__ConsoleDownloader__CopyTextWithExecCommand(Na__Payload) {
    if (Na__ConsoleDownloader__SelectSnippetPreview() === true) {
        if (document.execCommand("copy") === true) return true;
    }

    const Na__TempArea = document.createElement("textarea");
    Na__TempArea.value               = Na__Payload;
    Na__TempArea.setAttribute("readonly", "");
    Na__TempArea.style.position      = "fixed";
    Na__TempArea.style.top           = "0";
    Na__TempArea.style.left          = "0";
    Na__TempArea.style.width         = "2px";
    Na__TempArea.style.height        = "2px";
    document.body.appendChild(Na__TempArea);
    Na__TempArea.focus();
    Na__TempArea.select();
    Na__TempArea.setSelectionRange(0, Na__Payload.length);

    const Na__DidCopy = document.execCommand("copy");
    document.body.removeChild(Na__TempArea);
    return Na__DidCopy === true;
}
// ------------------------------------------------------------


// FUNCTION | Copy text to the clipboard, execCommand first so the click gesture is still valid
// ------------------------------------------------------------
async function Na__ConsoleDownloader__CopyTextToClipboard(Na__Text) {
    const Na__Payload = String(Na__Text || "");

    try {
        if (Na__ConsoleDownloader__CopyTextWithExecCommand(Na__Payload) === true) {
            return true;
        }
    } catch (Na__ExecError) {
        console.warn("execCommand copy failed.", Na__ExecError);
    }

    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(Na__Payload);
            return true;
        } catch (Na__ClipboardError) {
            console.warn("Clipboard API copy failed.", Na__ClipboardError);
        }
    }

    Na__ConsoleDownloader__SelectSnippetPreview();
    return false;
}
// ------------------------------------------------------------


// FUNCTION | Copy the loaded snippet and report success or failure
// ------------------------------------------------------------
async function Na__ConsoleDownloader__HandleCopyClick() {
    const Na__UiText = Na__ConsoleDownloader__AppConfig.NaMiniApp__UiText;
    const Na__Button = Na__ConsoleDownloader__Dom.Na__CopyButton;

    if (Na__ConsoleDownloader__SnippetText === "") {
        Na__ConsoleDownloader__SetStatus(Na__UiText.NaMiniApp__StatusSnippetMissing, "error");
        return;
    }

    const Na__DidCopy = await Na__ConsoleDownloader__CopyTextToClipboard(
        Na__ConsoleDownloader__SnippetText
    );

    if (Na__DidCopy === true) {
        Na__Button.textContent = Na__UiText.NaMiniApp__ButtonCopied;
        Na__Button.classList.add("CID__copy-button--copied");
        Na__ConsoleDownloader__SetStatus(Na__UiText.NaMiniApp__StatusCopied, "copied");
        Na__ConsoleDownloader__ResetCopyButtonLater();
        return;
    }

    Na__Button.textContent = Na__UiText.NaMiniApp__ButtonCopy;
    Na__Button.classList.remove("CID__copy-button--copied");
    Na__ConsoleDownloader__SetStatus(Na__UiText.NaMiniApp__StatusFailed, "error");
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Data Load
// -----------------------------------------------------------------------------

// FUNCTION | Fetch the paste-ready snippet file as plain text
// ------------------------------------------------------------
// @delegate: ./MiniApp__PhotoUtils__ConsoleImageDownloader__Snippet__HomeflowCarousel__.js
async function Na__ConsoleDownloader__LoadSnippetText(Na__SnippetFileName) {
    const Na__Response = await fetch(Na__SnippetFileName, { cache: "no-cache" });
    if (!Na__Response.ok) {
        throw new Error(`Failed to load snippet (HTTP ${Na__Response.status}).`);
    }

    const Na__RawText = await Na__Response.text();
    return Na__RawText.replace(/\r\n/g, "\n").replace(/\s+$/, "") + "\n";
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Bootstrap
// -----------------------------------------------------------------------------

// FUNCTION | Load config, paint UI text, load snippet, wire the copy button
// ------------------------------------------------------------
async function Na__ConsoleDownloader__BootstrapApp() {
    if (Na__ConsoleDownloader__HasRequiredDom() === false) {
        document.body.textContent = "Error: Essential HTML elements are missing.";
        return;
    }

    const Na__ConfigResponse = await fetch(Na__ConsoleDownloader__ConfigPath, { cache: "no-cache" });
    if (!Na__ConfigResponse.ok) {
        throw new Error(`Failed to load app config (HTTP ${Na__ConfigResponse.status}).`);
    }

    Na__ConsoleDownloader__AppConfig = await Na__ConfigResponse.json();
    const Na__UiText = Na__ConsoleDownloader__AppConfig.NaMiniApp__UiText;

    Na__ConsoleDownloader__ApplyUiTextFromConfig();
    Na__ConsoleDownloader__SetStatus(Na__UiText.NaMiniApp__StatusIdle, "idle");

    try {
        const Na__SnippetFile = Na__ConsoleDownloader__AppConfig.NaMiniApp__Assets.NaMiniApp__SnippetFile;
        Na__ConsoleDownloader__SnippetText = await Na__ConsoleDownloader__LoadSnippetText(Na__SnippetFile);
        Na__ConsoleDownloader__Dom.Na__SnippetPreview.textContent = Na__ConsoleDownloader__SnippetText;
        Na__ConsoleDownloader__Dom.Na__CopyButton.disabled = false;
    } catch (Na__ErrorObject) {
        console.error("Snippet load failed.", Na__ErrorObject);
        Na__ConsoleDownloader__SetStatus(Na__UiText.NaMiniApp__StatusSnippetMissing, "error");
        Na__ConsoleDownloader__Dom.Na__CopyButton.disabled = true;
        return;
    }

    Na__ConsoleDownloader__Dom.Na__CopyButton.addEventListener(
        "click",
        Na__ConsoleDownloader__HandleCopyClick
    );
}
// ------------------------------------------------------------


// INITIALISE | Run bootstrap on DOM ready
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    Na__ConsoleDownloader__BootstrapApp().catch((Na__ErrorObject) => {
        console.error("Console Image Downloader bootstrap failed:", Na__ErrorObject);
        const Na__Status = document.getElementById("js__copyStatus");
        if (Na__Status) {
            Na__Status.textContent = "Unable to load app configuration.";
            Na__Status.classList.add("CID__status--error");
        }
    });
});
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
