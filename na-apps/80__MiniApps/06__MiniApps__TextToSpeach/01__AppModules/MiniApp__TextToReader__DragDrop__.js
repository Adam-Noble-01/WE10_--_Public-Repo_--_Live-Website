// =============================================================================
// NOBLE ARCHITECTURE - TEXT TO READER - DRAG AND DROP
// =============================================================================
//
// FILE    : MiniApp__TextToReader__DragDrop__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Drop a Markdown, text or PDF file anywhere on the reader to read it
// CREATED : 18-Nov-2026
//
// - Only drags that carry files are taken; dragging selected text in the editor
//   keeps the browser's own behaviour.
// - File drags are always cancelled, so Edge never leaves the app to show the file.
// - While files are over the window a full-window overlay says what will happen.
//   When the source modal is open (a showModal dialog in the top layer, with the
//   page behind it inert) the dialog itself shows the drop state and its file
//   button is marked as the target instead.
// - The overlay cannot stick: it clears on drop, Esc, the pointer leaving the
//   window, the window losing focus, and a short watchdog after the last dragover.
// - A drop opens the first supported file through FileUpload's OpenFile, the same
//   way in as the picker, with the file's handle (Edge / Chrome desktop) so the
//   picker's last-folder memory follows dropped files too.
//
// =============================================================================

import { Na__TextToReader__ShowReaderStatus } from "./MiniApp__TextToReader__ReadAloud__.js";
import { Na__TextToReader__Log }              from "./MiniApp__TextToReader__ActivityLog__.js";


// -----------------------------------------------------------------------------
// REGION | Module-Level Variables
// -----------------------------------------------------------------------------

 // dragover repeats while a drag is over the page, even with the pointer still (the HTML
 // spec allows 350 ms +/- 200 ms between them), so a second's silence means the drag ended
 const Na__TextToReader__DragWatchdogMs = 1000;

 let Na__TextToReader__DropSettings     = null;
 let Na__TextToReader__DropOverlay      = null;
 let Na__TextToReader__DragActive       = false;
 let Na__TextToReader__DragWatchdog     = 0;

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Internal Helpers
// -----------------------------------------------------------------------------

// FUNCTION | Whether a drag carries files (not text, links or images from a page)
// ------------------------------------------------------------
function Na__TextToReader__IsFileDrag(Na__Event) {
    const Na__Types = Na__Event.dataTransfer?.types;
    return !!Na__Types && Array.prototype.includes.call(Na__Types, "Files");
}
// ------------------------------------------------------------


// FUNCTION | Whether the source modal is open (the drop state then lives in the dialog)
// ------------------------------------------------------------
function Na__TextToReader__IsModalOpen() {
    return !!Na__TextToReader__DropSettings?.sourceModal?.open;
}
// ------------------------------------------------------------


// FUNCTION | Build the full-window overlay once
// ------------------------------------------------------------
function Na__TextToReader__BuildOverlay(Na__Text) {
    const Na__Overlay = document.createElement("div");
    Na__Overlay.className = "TTR__drop-overlay TTR__chrome";
    Na__Overlay.setAttribute("aria-hidden", "true");
    Na__Overlay.hidden = true;

    const Na__Card = document.createElement("div");
    Na__Card.className = "TTR__drop-card";

    const Na__Icon = document.createElement("span");
    Na__Icon.className = "TTR__drop-icon TTR__icon-file";

    const Na__Title = document.createElement("span");
    Na__Title.className = "TTR__drop-title";
    Na__Title.textContent = Na__Text.OverlayTitle || "Drop to read";

    const Na__Hint = document.createElement("span");
    Na__Hint.className = "TTR__drop-hint";
    Na__Hint.textContent = Na__Text.OverlayHint || "";

    Na__Card.append(Na__Icon, Na__Title, Na__Hint);
    Na__Overlay.append(Na__Card);
    document.body.append(Na__Overlay);
    return Na__Overlay;
}
// ------------------------------------------------------------


// FUNCTION | Show the drop state: the overlay, or the dialog and its file button
// ------------------------------------------------------------
function Na__TextToReader__ShowDropState() {
    if (Na__TextToReader__IsModalOpen()) {
        Na__TextToReader__DropOverlay.hidden = true;
        Na__TextToReader__DropSettings.sourceModal.classList.add("TTR__source-modal--drop");
    } else {
        Na__TextToReader__DropSettings.sourceModal?.classList.remove("TTR__source-modal--drop");
        Na__TextToReader__DropOverlay.hidden = false;
    }
    document.body.classList.add("TTR__dragging-file");
    Na__TextToReader__DragActive = true;
}
// ------------------------------------------------------------


// FUNCTION | Clear every drop state
// ------------------------------------------------------------
function Na__TextToReader__ClearDropState() {
    clearTimeout(Na__TextToReader__DragWatchdog);
    Na__TextToReader__DragActive = false;
    if (Na__TextToReader__DropOverlay) Na__TextToReader__DropOverlay.hidden = true;
    Na__TextToReader__DropSettings?.sourceModal?.classList.remove("TTR__source-modal--drop");
    document.body.classList.remove("TTR__dragging-file");
}
// ------------------------------------------------------------


// FUNCTION | Clear the drop state if dragover stops arriving (drag ended elsewhere)
// ------------------------------------------------------------
function Na__TextToReader__ArmWatchdog() {
    clearTimeout(Na__TextToReader__DragWatchdog);
    Na__TextToReader__DragWatchdog = setTimeout(Na__TextToReader__ClearDropState, Na__TextToReader__DragWatchdogMs);
}
// ------------------------------------------------------------


// FUNCTION | Say something where the user is looking: the modal, or the reader's status line
// ------------------------------------------------------------
function Na__TextToReader__DropMessage(Na__Message) {
    if (!Na__Message) return;
    if (Na__TextToReader__IsModalOpen() && Na__TextToReader__DropSettings.statusElement) {
        Na__TextToReader__DropSettings.statusElement.textContent = Na__Message;
        return;
    }
    try {
        Na__TextToReader__ShowReaderStatus(Na__Message);
    } catch (Na__ErrorObject) {
        console.warn("Text To Reader drop:", Na__Message, Na__ErrorObject);
    }
}
// ------------------------------------------------------------


// FUNCTION | Fill {name} and {count} in an AppConfig sentence
// ------------------------------------------------------------
function Na__TextToReader__FillText(Na__Template, Na__Values) {
    return String(Na__Template || "").replace(/\{(\w+)\}/g, (Na__Match, Na__Key) =>
        (Na__Key in Na__Values ? String(Na__Values[Na__Key]) : Na__Match));
}
// ------------------------------------------------------------


// FUNCTION | Collect the dropped files and, where the browser offers them, their handles
// ------------------------------------------------------------
// getAsFileSystemHandle must be called during the drop event itself (the item list
// goes dead afterwards), so the promises are taken first and awaited later.
function Na__TextToReader__CollectDrop(Na__DataTransfer) {
    const Na__Entries = [];
    const Na__Items = Na__DataTransfer.items ? Array.from(Na__DataTransfer.items) : [];

    if (Na__Items.length) {
        for (const Na__Item of Na__Items) {
            if (Na__Item.kind !== "file") continue;
            const Na__File = Na__Item.getAsFile();
            if (!Na__File) continue;
            let Na__HandlePromise = null;
            if (typeof Na__Item.getAsFileSystemHandle === "function") {
                try {
                    Na__HandlePromise = Na__Item.getAsFileSystemHandle().catch(() => null);
                } catch {
                    Na__HandlePromise = null;
                }
            }
            Na__Entries.push({ file: Na__File, handlePromise: Na__HandlePromise });
        }
    } else {
        for (const Na__File of Array.from(Na__DataTransfer.files || [])) {
            Na__Entries.push({ file: Na__File, handlePromise: null });
        }
    }
    return Na__Entries;
}
// ------------------------------------------------------------


// FUNCTION | Open the first supported file of a drop
// ------------------------------------------------------------
async function Na__TextToReader__OpenDrop(Na__Entries) {
    const { config, openFile, isSupportedFile } = Na__TextToReader__DropSettings;
    if (!Na__Entries.length) return;

    const Na__Chosen = Na__Entries.find((Na__Entry) => isSupportedFile(Na__Entry.file));
    if (!Na__Chosen) {
        Na__TextToReader__Log("warn", `Dropped ${Na__Entries.map((Na__Entry) => `"${Na__Entry.file.name}"`).join(", ")}: not a type the reader can open`);
        Na__TextToReader__DropMessage(config.UnsupportedText);
        return;
    }

    let Na__Handle = null;
    if (Na__Chosen.handlePromise) {
        const Na__Result = await Na__Chosen.handlePromise;
        if (Na__Result && Na__Result.kind === "file") Na__Handle = Na__Result;
    }

    await openFile(Na__Chosen.file, { handle: Na__Handle, source: "drop" });

    const Na__Others = Na__Entries.length - 1;
    if (Na__Others > 0) {
        // The reader's own status (preparing audio) soon takes the line, so the log keeps it too
        const Na__Note = Na__TextToReader__FillText(config.MultipleText, { name: Na__Chosen.file.name, count: Na__Others });
        Na__TextToReader__Log("info", Na__Note);
        Na__TextToReader__DropMessage(Na__Note);
    }
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Event Handlers
// -----------------------------------------------------------------------------

// FUNCTION | dragenter / dragover: claim file drags, show where they will land
// ------------------------------------------------------------
function Na__TextToReader__OnDragOver(Na__Event) {
    if (!Na__TextToReader__IsFileDrag(Na__Event)) return;
    Na__Event.preventDefault();
    Na__Event.dataTransfer.dropEffect = "copy";
    if (!Na__TextToReader__DragActive || Na__TextToReader__IsModalOpen() !== !!Na__TextToReader__DropSettings
        .sourceModal?.classList.contains("TTR__source-modal--drop")) {
        Na__TextToReader__ShowDropState();
    }
    Na__TextToReader__ArmWatchdog();
}
// ------------------------------------------------------------


// FUNCTION | dragleave: clear only when the pointer leaves the window
// ------------------------------------------------------------
function Na__TextToReader__OnDragLeave(Na__Event) {
    if (!Na__TextToReader__DragActive) return;
    // Leaving one element for another inside the page always names the next one;
    // leaving the window names nothing (or reports a point outside the viewport).
    const Na__OutOfWindow = !Na__Event.relatedTarget ||
        Na__Event.clientX <= 0 || Na__Event.clientY <= 0 ||
        Na__Event.clientX >= window.innerWidth || Na__Event.clientY >= window.innerHeight;
    if (Na__OutOfWindow) Na__TextToReader__ClearDropState();
}
// ------------------------------------------------------------


// FUNCTION | drop: never let the browser open the file itself; read it here
// ------------------------------------------------------------
function Na__TextToReader__OnDrop(Na__Event) {
    if (!Na__TextToReader__IsFileDrag(Na__Event)) return;
    Na__Event.preventDefault();
    Na__Event.stopPropagation();
    Na__TextToReader__ClearDropState();

    const Na__Entries = Na__TextToReader__CollectDrop(Na__Event.dataTransfer);
    Na__TextToReader__OpenDrop(Na__Entries).catch((Na__ErrorObject) => {
        console.error("Text To Reader drop failed:", Na__ErrorObject);
        Na__TextToReader__DropMessage(Na__ErrorObject?.message || String(Na__ErrorObject));
    });
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Exports
// -----------------------------------------------------------------------------

// FUNCTION | Wire file drops on the whole window
// ------------------------------------------------------------
export function Na__TextToReader__InitialiseDragDrop(Na__Config) {
    const { config, openFile, isSupportedFile } = Na__Config || {};
    if (typeof openFile !== "function" || typeof isSupportedFile !== "function") {
        console.error("Text To Reader drag and drop: openFile and isSupportedFile are required.");
        return;
    }
    if (Na__TextToReader__DropSettings) return;      // already wired

    Na__TextToReader__DropSettings = { ...Na__Config, config: config || {} };
    Na__TextToReader__DropOverlay  = Na__TextToReader__BuildOverlay(Na__TextToReader__DropSettings.config);

    // Capture phase on the window: the editor and the dialog never see a file drop first,
    // and events on the inert page behind the modal still arrive (they target the dialog).
    window.addEventListener("dragenter", Na__TextToReader__OnDragOver, true);
    window.addEventListener("dragover",  Na__TextToReader__OnDragOver, true);
    window.addEventListener("dragleave", Na__TextToReader__OnDragLeave, true);
    window.addEventListener("drop",      Na__TextToReader__OnDrop, true);
    window.addEventListener("dragend",   Na__TextToReader__ClearDropState, true);
    window.addEventListener("blur",      Na__TextToReader__ClearDropState);
    window.addEventListener("keydown", (Na__Event) => {
        if (Na__Event.key === "Escape" && Na__TextToReader__DragActive) Na__TextToReader__ClearDropState();
    }, true);
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
