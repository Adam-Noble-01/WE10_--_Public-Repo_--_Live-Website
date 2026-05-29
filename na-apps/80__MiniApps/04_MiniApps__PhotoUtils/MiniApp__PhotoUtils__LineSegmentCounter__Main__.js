// =============================================================================
// NOBLE ARCHITECTURE - PHOTO UTILS - LINE SEGMENT COUNTER - MAIN
// =============================================================================
//
// FILE    : MiniApp__PhotoUtils__LineSegmentCounter__Main__.js
// PURPOSE : App state, DOM cache, interaction handlers, UI refresh, and bootstrap
// CREATED : 29-May-2026
//
// =============================================================================

// -----------------------------------------------------------------------------
// REGION | Imports
// -----------------------------------------------------------------------------

// @delegate: ./MiniApp__PhotoUtils__LineSegmentCounter__LineUtils__.js
import {
    Na__PhotoUtils__ClampValue,
    Na__PhotoUtils__GetDistanceBetweenPoints,
    Na__PhotoUtils__CreateLineRecord
} from "./MiniApp__PhotoUtils__LineSegmentCounter__LineUtils__.js";

// @delegate: ./MiniApp__PhotoUtils__LineSegmentCounter__CanvasDraw__.js
import { Na__PhotoUtils__RenderAll } from "./MiniApp__PhotoUtils__LineSegmentCounter__CanvasDraw__.js";

// @delegate: ./MiniApp__PhotoUtils__LineSegmentCounter__ImageLoader__.js
import {
    Na__PhotoUtils__LoadImageFromFile,
    Na__PhotoUtils__HandleClipboardPaste,
    Na__PhotoUtils__HandleImageDrop
} from "./MiniApp__PhotoUtils__LineSegmentCounter__ImageLoader__.js";

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Module-Level Variables
// -----------------------------------------------------------------------------

 let Na__PhotoUtils__AppConfig = null;
 let Na__PhotoUtils__Ctx       = null;

 const Na__PhotoUtils__State = {
     imageElement   : null,
     hasImage       : false,
     lines          : [],
     selectedIndex  : -1,
     mode           : "idle",
     isPointerDown  : false,
     startPoint     : null,
     previewLine    : null,
     pendingLine    : null,
     adjustStartY   : 0,
     adjustBaseSegs : 1,
     typedBuffer    : ""
 };

 const Na__PhotoUtils__Dom = {
     Na__Canvas         : document.getElementById("js__mainCanvas"),
     Na__Viewport       : document.getElementById("js__viewport"),
     Na__ImageUpload    : document.getElementById("js__imageUpload"),
     Na__EmptyState     : document.getElementById("js__emptyState"),
     Na__Status         : document.getElementById("js__status"),
     Na__SegmentInput   : document.getElementById("js__segmentInput"),
     Na__CommitButton   : document.getElementById("js__commitButton"),
     Na__CancelButton   : document.getElementById("js__cancelButton"),
     Na__UndoButton     : document.getElementById("js__undoButton"),
     Na__ClearButton    : document.getElementById("js__clearButton"),
     Na__PendingPill    : document.getElementById("js__pendingPill"),
     Na__ActiveSegments : document.getElementById("js__activeSegments"),
     Na__ActiveLength   : document.getElementById("js__activeLength"),
     Na__LinesList      : document.getElementById("js__linesList"),
     Na__NoLines        : document.getElementById("js__noLines")
 };

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Canvas and Colour Helpers
// -----------------------------------------------------------------------------

// HELPER FUNCTION | Resize the canvas element to match the loaded image
// ------------------------------------------------------------
function Na__PhotoUtils__SizeCanvasToImage(Na__Img) {
    Na__PhotoUtils__Dom.Na__Canvas.width         = Na__Img.naturalWidth;
    Na__PhotoUtils__Dom.Na__Canvas.height        = Na__Img.naturalHeight;
    Na__PhotoUtils__Dom.Na__Canvas.style.width   = Na__Img.naturalWidth  + "px";
    Na__PhotoUtils__Dom.Na__Canvas.style.height  = Na__Img.naturalHeight + "px";
}
// ------------------------------------------------------------


// HELPER FUNCTION | Get the next colour from the configured palette
// ------------------------------------------------------------
function Na__PhotoUtils__GetNextLineColour() {
    const Na__Palette = Na__PhotoUtils__AppConfig.NaMiniApp__ColourPalette;
    return Na__Palette[Na__PhotoUtils__State.lines.length % Na__Palette.length];
}
// ------------------------------------------------------------


// HELPER FUNCTION | Convert a pointer event coordinate to canvas-space {x, y}
// ------------------------------------------------------------
function Na__PhotoUtils__GetPointerPositionOnCanvas(Na__Event) {
    const Na__Rect   = Na__PhotoUtils__Dom.Na__Canvas.getBoundingClientRect();
    const Na__Canvas = Na__PhotoUtils__Dom.Na__Canvas;
    return {
        x : (Na__Event.clientX - Na__Rect.left) * (Na__Canvas.width  / Na__Rect.width),
        y : (Na__Event.clientY - Na__Rect.top)  * (Na__Canvas.height / Na__Rect.height)
    };
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | UI State Helpers
// -----------------------------------------------------------------------------

// HELPER FUNCTION | Update the topbar status message
// ------------------------------------------------------------
function Na__PhotoUtils__SetStatus(Na__Text) {
    Na__PhotoUtils__Dom.Na__Status.textContent = Na__Text;
}
// ------------------------------------------------------------


// HELPER FUNCTION | Read and validate the current segment count from the input field
// ------------------------------------------------------------
function Na__PhotoUtils__GetCurrentSegmentCount() {
    const Na__Defaults = Na__PhotoUtils__AppConfig.NaMiniApp__Defaults;
    return Na__PhotoUtils__ClampValue(
        parseInt(Na__PhotoUtils__Dom.Na__SegmentInput.value || "1", 10),
        Na__Defaults.NaMiniApp__MinSegments,
        Na__Defaults.NaMiniApp__MaxSegments
    );
}
// ------------------------------------------------------------


// HELPER FUNCTION | Build a single line report card element
// ------------------------------------------------------------
function Na__PhotoUtils__BuildLineCard(Na__Line, Na__Index) {
    const Na__UiText     = Na__PhotoUtils__AppConfig.NaMiniApp__UiText;
    const Na__IsSelected = Na__Index === Na__PhotoUtils__State.selectedIndex;
    const Na__Length     = Na__PhotoUtils__GetDistanceBetweenPoints(
        { x: Na__Line.x1, y: Na__Line.y1 },
        { x: Na__Line.x2, y: Na__Line.y2 }
    );
    const Na__SegLength  = Na__Length / Math.max(1, Na__Line.segments);
    const Na__Card       = document.createElement("div");

    Na__Card.className   = "PLSC__line-card" + (Na__IsSelected ? " PLSC__line-card--selected" : "");
    Na__Card.innerHTML   = `
        <div class="PLSC__line-title">
            <div class="PLSC__line-title-left">
                <span class="PLSC__line-swatch" style="background:${Na__Line.colour}"></span>
                <span>Line ${Na__Index + 1}</span>
            </div>
            <span>${Na__Line.segments} ${Na__UiText.NaMiniApp__LineCardSegSuffix}</span>
        </div>
        <div class="PLSC__line-meta">
            <span>${Na__UiText.NaMiniApp__LineCardLengthLabel} <b>${Math.round(Na__Length)} ${Na__UiText.NaMiniApp__LineCardPxSuffix}</b></span>
            <span>${Na__UiText.NaMiniApp__LineCardEachLabel} <b>${Na__SegLength.toFixed(1)} ${Na__UiText.NaMiniApp__LineCardPxSuffix}</b></span>
            <span>${Na__UiText.NaMiniApp__LineCardPointALabel} <b>${Math.round(Na__Line.x1)}, ${Math.round(Na__Line.y1)}</b></span>
            <span>${Na__UiText.NaMiniApp__LineCardPointBLabel} <b>${Math.round(Na__Line.x2)}, ${Math.round(Na__Line.y2)}</b></span>
        </div>
        <div class="PLSC__line-actions">
            <button class="PLSC__button PLSC__button--small" data-action="select">${Na__UiText.NaMiniApp__ButtonSelect}</button>
            <button class="PLSC__button PLSC__button--small PLSC__button--danger" data-action="delete">${Na__UiText.NaMiniApp__ButtonDelete}</button>
        </div>
    `;

    Na__Card.addEventListener("click", (Na__Event) => {
        const Na__Action = Na__Event.target?.dataset?.action;

        if (Na__Action === "delete") {
            Na__PhotoUtils__State.lines.splice(Na__Index, 1);
            Na__PhotoUtils__State.selectedIndex = -1;
        } else {
            Na__PhotoUtils__State.selectedIndex          = Na__Index;
            Na__PhotoUtils__Dom.Na__SegmentInput.value   = Na__PhotoUtils__State.lines[Na__Index].segments;
        }

        Na__PhotoUtils__RunRenderCycle();
    });

    return Na__Card;
}
// ------------------------------------------------------------


// FUNCTION | Refresh all UI controls — metrics, button states, lines report
// ------------------------------------------------------------
function Na__PhotoUtils__RefreshUi() {
    const Na__State     = Na__PhotoUtils__State;
    const Na__UiText    = Na__PhotoUtils__AppConfig.NaMiniApp__UiText;
    const Na__Defaults  = Na__PhotoUtils__AppConfig.NaMiniApp__Defaults;
    const Na__Active    = Na__State.pendingLine || Na__State.previewLine
                       || (Na__State.selectedIndex >= 0 ? Na__State.lines[Na__State.selectedIndex] : null);

    if (Na__Active) {
        const Na__Length = Na__PhotoUtils__GetDistanceBetweenPoints(
            { x: Na__Active.x1, y: Na__Active.y1 },
            { x: Na__Active.x2, y: Na__Active.y2 }
        );
        Na__PhotoUtils__Dom.Na__ActiveSegments.textContent = Na__Active.segments;
        Na__PhotoUtils__Dom.Na__ActiveLength.textContent   = Math.round(Na__Length) + " " + Na__UiText.NaMiniApp__LineCardPxSuffix;
    } else {
        Na__PhotoUtils__Dom.Na__ActiveSegments.textContent = "-";
        Na__PhotoUtils__Dom.Na__ActiveLength.textContent   = "-";
    }

    Na__PhotoUtils__Dom.Na__PendingPill.classList.toggle("PLSC__pending-pill--visible", Na__State.mode === "adjusting");
    Na__PhotoUtils__Dom.Na__CommitButton.disabled = Na__State.mode !== "adjusting";
    Na__PhotoUtils__Dom.Na__CancelButton.disabled = Na__State.mode !== "adjusting" && Na__State.mode !== "drawing";

    Na__PhotoUtils__Dom.Na__LinesList.innerHTML = "";
    Na__PhotoUtils__Dom.Na__NoLines.style.display = Na__State.lines.length ? "none" : "block";

    Na__State.lines.forEach((Na__Line, Na__Index) => {
        Na__PhotoUtils__Dom.Na__LinesList.appendChild(Na__PhotoUtils__BuildLineCard(Na__Line, Na__Index));
    });
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Render Cycle
// -----------------------------------------------------------------------------

// FUNCTION | Execute canvas render pass then refresh all UI controls
// ------------------------------------------------------------
function Na__PhotoUtils__RunRenderCycle() {
    Na__PhotoUtils__RenderAll(
        Na__PhotoUtils__Ctx,
        Na__PhotoUtils__Dom.Na__Canvas,
        Na__PhotoUtils__State,
        Na__PhotoUtils__AppConfig.NaMiniApp__Defaults
    );
    Na__PhotoUtils__RefreshUi();
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Image Loading
// -----------------------------------------------------------------------------

// FUNCTION | Callback invoked when any image source has successfully loaded
// ------------------------------------------------------------
function Na__PhotoUtils__OnImageLoaded(Na__Img, Na__Filename) {
    Na__PhotoUtils__State.imageElement   = Na__Img;
    Na__PhotoUtils__State.hasImage       = true;
    Na__PhotoUtils__State.lines          = [];
    Na__PhotoUtils__State.selectedIndex  = -1;
    Na__PhotoUtils__State.previewLine    = null;
    Na__PhotoUtils__State.pendingLine    = null;
    Na__PhotoUtils__State.mode           = "idle";

    Na__PhotoUtils__SizeCanvasToImage(Na__Img);
    Na__PhotoUtils__Dom.Na__EmptyState.style.display = "none";

    const Na__Label = Na__Filename
        ? `Loaded ${Na__Filename} at ${Na__Img.naturalWidth} × ${Na__Img.naturalHeight}px.`
        : `Image loaded at ${Na__Img.naturalWidth} × ${Na__Img.naturalHeight}px.`;
    Na__PhotoUtils__SetStatus(Na__Label);
    Na__PhotoUtils__RunRenderCycle();
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Interaction Handlers
// -----------------------------------------------------------------------------

// FUNCTION | Begin drawing a new line from the pointer down position
// ------------------------------------------------------------
function Na__PhotoUtils__BeginLineDrawing(Na__Point) {
    if (!Na__PhotoUtils__State.hasImage) return;

    const Na__Defaults = Na__PhotoUtils__AppConfig.NaMiniApp__Defaults;
    Na__PhotoUtils__State.selectedIndex  = -1;
    Na__PhotoUtils__State.isPointerDown  = true;
    Na__PhotoUtils__State.mode           = "drawing";
    Na__PhotoUtils__State.startPoint     = Na__Point;
    Na__PhotoUtils__State.typedBuffer    = "";
    Na__PhotoUtils__State.previewLine    = Na__PhotoUtils__CreateLineRecord(
        Na__Point.x, Na__Point.y,
        Na__Point.x, Na__Point.y,
        Na__PhotoUtils__GetCurrentSegmentCount(),
        Na__PhotoUtils__GetNextLineColour(),
        Na__Defaults
    );

    Na__PhotoUtils__SetStatus(Na__PhotoUtils__AppConfig.NaMiniApp__UiText.NaMiniApp__StatusDrawing);
    Na__PhotoUtils__RunRenderCycle();
}
// ------------------------------------------------------------


// FUNCTION | Update the preview line endpoint as the pointer moves during drawing
// ------------------------------------------------------------
function Na__PhotoUtils__UpdateLineDrawing(Na__Point) {
    if (Na__PhotoUtils__State.mode !== "drawing" || !Na__PhotoUtils__State.previewLine) return;

    Na__PhotoUtils__State.previewLine.x2 = Na__Point.x;
    Na__PhotoUtils__State.previewLine.y2 = Na__Point.y;
    Na__PhotoUtils__RunRenderCycle();
}
// ------------------------------------------------------------


// FUNCTION | Finalise the drawn line — transitions to adjusting mode or cancels if too short
// ------------------------------------------------------------
function Na__PhotoUtils__FinishLineDrawing(Na__Point) {
    if (Na__PhotoUtils__State.mode !== "drawing" || !Na__PhotoUtils__State.previewLine) return;

    const Na__Defaults = Na__PhotoUtils__AppConfig.NaMiniApp__Defaults;
    Na__PhotoUtils__State.previewLine.x2 = Na__Point.x;
    Na__PhotoUtils__State.previewLine.y2 = Na__Point.y;

    const Na__Length = Na__PhotoUtils__GetDistanceBetweenPoints(
        { x: Na__PhotoUtils__State.previewLine.x1, y: Na__PhotoUtils__State.previewLine.y1 },
        { x: Na__PhotoUtils__State.previewLine.x2, y: Na__PhotoUtils__State.previewLine.y2 }
    );

    if (Na__Length < Na__Defaults.NaMiniApp__MinLineLength) {
        Na__PhotoUtils__State.mode          = "idle";
        Na__PhotoUtils__State.isPointerDown = false;
        Na__PhotoUtils__State.startPoint    = null;
        Na__PhotoUtils__State.previewLine   = null;
        Na__PhotoUtils__SetStatus(Na__PhotoUtils__AppConfig.NaMiniApp__UiText.NaMiniApp__StatusTooShort);
        Na__PhotoUtils__RunRenderCycle();
        return;
    }

    Na__PhotoUtils__State.pendingLine    = Na__PhotoUtils__State.previewLine;
    Na__PhotoUtils__State.previewLine    = null;
    Na__PhotoUtils__State.isPointerDown  = false;
    Na__PhotoUtils__State.startPoint     = null;
    Na__PhotoUtils__State.mode           = "adjusting";
    Na__PhotoUtils__State.adjustStartY   = Na__Point.y;
    Na__PhotoUtils__State.adjustBaseSegs = Na__PhotoUtils__State.pendingLine.segments;
    Na__PhotoUtils__State.typedBuffer    = "";

    Na__PhotoUtils__Dom.Na__SegmentInput.value = Na__PhotoUtils__State.pendingLine.segments;
    Na__PhotoUtils__SetStatus(Na__PhotoUtils__AppConfig.NaMiniApp__UiText.NaMiniApp__StatusAdjusting);
    Na__PhotoUtils__RunRenderCycle();
}
// ------------------------------------------------------------


// FUNCTION | Adjust segment count on the pending line by vertical mouse movement
// ------------------------------------------------------------
function Na__PhotoUtils__UpdatePendingLineDivisions(Na__Point) {
    if (Na__PhotoUtils__State.mode !== "adjusting" || !Na__PhotoUtils__State.pendingLine) return;
    if (Na__PhotoUtils__State.typedBuffer) return;

    const Na__Defaults  = Na__PhotoUtils__AppConfig.NaMiniApp__Defaults;
    const Na__DeltaUp   = Na__PhotoUtils__State.adjustStartY - Na__Point.y;
    const Na__Change    = Math.round(Na__DeltaUp / Na__Defaults.NaMiniApp__AdjustDeltaPerPixel);
    Na__PhotoUtils__State.pendingLine.segments = Na__PhotoUtils__ClampValue(
        Na__PhotoUtils__State.adjustBaseSegs + Na__Change,
        Na__Defaults.NaMiniApp__MinSegments,
        Na__Defaults.NaMiniApp__MaxSegments
    );

    Na__PhotoUtils__Dom.Na__SegmentInput.value = Na__PhotoUtils__State.pendingLine.segments;
    Na__PhotoUtils__RunRenderCycle();
}
// ------------------------------------------------------------


// FUNCTION | Commit the pending line to the lines array
// ------------------------------------------------------------
function Na__PhotoUtils__CommitPendingLine() {
    if (Na__PhotoUtils__State.mode !== "adjusting" || !Na__PhotoUtils__State.pendingLine) return;

    Na__PhotoUtils__State.pendingLine.segments = Na__PhotoUtils__GetCurrentSegmentCount();
    Na__PhotoUtils__State.lines.push(Na__PhotoUtils__State.pendingLine);
    Na__PhotoUtils__State.selectedIndex        = Na__PhotoUtils__State.lines.length - 1;
    Na__PhotoUtils__State.pendingLine          = null;
    Na__PhotoUtils__State.mode                 = "idle";
    Na__PhotoUtils__State.typedBuffer          = "";

    Na__PhotoUtils__SetStatus(Na__PhotoUtils__AppConfig.NaMiniApp__UiText.NaMiniApp__StatusCommitted);
    Na__PhotoUtils__RunRenderCycle();
}
// ------------------------------------------------------------


// FUNCTION | Cancel the current drawing or adjusting operation
// ------------------------------------------------------------
function Na__PhotoUtils__CancelActiveLine() {
    if (Na__PhotoUtils__State.mode === "drawing") {
        Na__PhotoUtils__State.previewLine   = null;
        Na__PhotoUtils__State.isPointerDown = false;
        Na__PhotoUtils__State.startPoint    = null;
    }

    if (Na__PhotoUtils__State.mode === "adjusting") {
        Na__PhotoUtils__State.pendingLine = null;
    }

    Na__PhotoUtils__State.mode        = "idle";
    Na__PhotoUtils__State.typedBuffer = "";

    Na__PhotoUtils__SetStatus(Na__PhotoUtils__AppConfig.NaMiniApp__UiText.NaMiniApp__StatusCancelled);
    Na__PhotoUtils__RunRenderCycle();
}
// ------------------------------------------------------------


// FUNCTION | Set the active segment count and apply it to the relevant line
// ------------------------------------------------------------
function Na__PhotoUtils__SetActiveSegmentCount(Na__Value) {
    const Na__Defaults   = Na__PhotoUtils__AppConfig.NaMiniApp__Defaults;
    const Na__SafeValue  = Na__PhotoUtils__ClampValue(
        parseInt(Na__Value || "1", 10),
        Na__Defaults.NaMiniApp__MinSegments,
        Na__Defaults.NaMiniApp__MaxSegments
    );
    Na__PhotoUtils__Dom.Na__SegmentInput.value = Na__SafeValue;

    if      (Na__PhotoUtils__State.pendingLine)                                      Na__PhotoUtils__State.pendingLine.segments = Na__SafeValue;
    else if (Na__PhotoUtils__State.previewLine)                                      Na__PhotoUtils__State.previewLine.segments = Na__SafeValue;
    else if (Na__PhotoUtils__State.selectedIndex >= 0 && Na__PhotoUtils__State.lines[Na__PhotoUtils__State.selectedIndex]) {
        Na__PhotoUtils__State.lines[Na__PhotoUtils__State.selectedIndex].segments = Na__SafeValue;
    }

    Na__PhotoUtils__RunRenderCycle();
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Keyboard Handler
// -----------------------------------------------------------------------------

// FUNCTION | Handle global keyboard shortcuts
// ------------------------------------------------------------
function Na__PhotoUtils__HandleKeyDown(Na__Event) {
    const Na__ActiveTag       = document.activeElement?.tagName.toLowerCase() || "";
    const Na__IsTypingInField = Na__ActiveTag === "input" || Na__ActiveTag === "textarea";
    const Na__State           = Na__PhotoUtils__State;
    const Na__UiText          = Na__PhotoUtils__AppConfig.NaMiniApp__UiText;
    const Na__Defaults        = Na__PhotoUtils__AppConfig.NaMiniApp__Defaults;

    if (Na__Event.key === "Escape") {
        Na__PhotoUtils__CancelActiveLine();
        return;
    }

    if (Na__Event.key === "Enter" && Na__State.mode === "adjusting") {
        Na__Event.preventDefault();
        Na__PhotoUtils__CommitPendingLine();
        return;
    }

    if ((Na__Event.key === "Delete" || Na__Event.key === "Backspace")
            && Na__State.selectedIndex >= 0
            && Na__State.mode === "idle"
            && !Na__IsTypingInField) {
        Na__State.lines.splice(Na__State.selectedIndex, 1);
        Na__State.selectedIndex = -1;
        Na__PhotoUtils__SetStatus(Na__UiText.NaMiniApp__StatusLineDeleted);
        Na__PhotoUtils__RunRenderCycle();
        return;
    }

    if (Na__IsTypingInField) return;

    if ((Na__Event.key === "+" || Na__Event.key === "=") && (Na__State.pendingLine || Na__State.selectedIndex >= 0)) {
        Na__Event.preventDefault();
        const Na__Current = Na__State.pendingLine ? Na__State.pendingLine.segments : Na__State.lines[Na__State.selectedIndex].segments;
        Na__PhotoUtils__SetActiveSegmentCount(Na__Current + 1);
        return;
    }

    if ((Na__Event.key === "-" || Na__Event.key === "_") && (Na__State.pendingLine || Na__State.selectedIndex >= 0)) {
        Na__Event.preventDefault();
        const Na__Current = Na__State.pendingLine ? Na__State.pendingLine.segments : Na__State.lines[Na__State.selectedIndex].segments;
        Na__PhotoUtils__SetActiveSegmentCount(Na__Current - 1);
        return;
    }

    if (Na__State.mode === "adjusting" && Na__State.pendingLine) {
        if (/^[0-9]$/.test(Na__Event.key)) {
            Na__Event.preventDefault();
            Na__State.typedBuffer = (Na__State.typedBuffer + Na__Event.key).slice(0, Na__Defaults.NaMiniApp__TypedBufferMaxLength);
            Na__PhotoUtils__SetActiveSegmentCount(parseInt(Na__State.typedBuffer, 10));
            return;
        }

        if (Na__Event.key === "Backspace") {
            Na__Event.preventDefault();
            Na__State.typedBuffer = Na__State.typedBuffer.slice(0, -1);
            if (Na__State.typedBuffer) Na__PhotoUtils__SetActiveSegmentCount(parseInt(Na__State.typedBuffer, 10));
        }
    }
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | App Initialisation
// -----------------------------------------------------------------------------

// FUNCTION | Apply all UI text labels sourced from the app config
// ------------------------------------------------------------
function Na__PhotoUtils__ApplyUiTextFromConfig() {
    const Na__UiText     = Na__PhotoUtils__AppConfig.NaMiniApp__UiText;
    const Na__Defaults   = Na__PhotoUtils__AppConfig.NaMiniApp__Defaults;

    document.title                                       = Na__PhotoUtils__AppConfig.NaMiniApp__Meta.NaMiniApp__AppTitle;
    Na__PhotoUtils__Dom.Na__SegmentInput.value           = Na__Defaults.NaMiniApp__DefaultSegmentCount;
    Na__PhotoUtils__Dom.Na__CommitButton.textContent     = Na__UiText.NaMiniApp__ButtonCommit;
    Na__PhotoUtils__Dom.Na__CancelButton.textContent     = Na__UiText.NaMiniApp__ButtonCancel;
    Na__PhotoUtils__Dom.Na__UndoButton.textContent       = Na__UiText.NaMiniApp__ButtonUndo;
    Na__PhotoUtils__Dom.Na__ClearButton.textContent      = Na__UiText.NaMiniApp__ButtonClear;
    Na__PhotoUtils__Dom.Na__PendingPill.textContent      = Na__UiText.NaMiniApp__PillAdjusting;

    Na__PhotoUtils__SetStatus(Na__UiText.NaMiniApp__StatusReady);
}
// ------------------------------------------------------------


// FUNCTION | Register all UI and canvas event listeners
// ------------------------------------------------------------
function Na__PhotoUtils__RegisterEventListeners() {
    const Na__Canvas   = Na__PhotoUtils__Dom.Na__Canvas;
    const Na__Viewport = Na__PhotoUtils__Dom.Na__Viewport;

    Na__Canvas.addEventListener("pointerdown", (Na__Event) => {
        const Na__Point = Na__PhotoUtils__GetPointerPositionOnCanvas(Na__Event);
        if (Na__PhotoUtils__State.mode === "adjusting") {
            Na__PhotoUtils__CommitPendingLine();
            return;
        }
        Na__Canvas.setPointerCapture(Na__Event.pointerId);
        Na__PhotoUtils__BeginLineDrawing(Na__Point);
    });

    Na__Canvas.addEventListener("pointermove", (Na__Event) => {
        const Na__Point = Na__PhotoUtils__GetPointerPositionOnCanvas(Na__Event);
        if      (Na__PhotoUtils__State.mode === "drawing"   && Na__PhotoUtils__State.isPointerDown) Na__PhotoUtils__UpdateLineDrawing(Na__Point);
        else if (Na__PhotoUtils__State.mode === "adjusting")                                        Na__PhotoUtils__UpdatePendingLineDivisions(Na__Point);
    });

    Na__Canvas.addEventListener("pointerup", (Na__Event) => {
        const Na__Point = Na__PhotoUtils__GetPointerPositionOnCanvas(Na__Event);
        if (Na__PhotoUtils__State.mode === "drawing") Na__PhotoUtils__FinishLineDrawing(Na__Point);
        try { Na__Canvas.releasePointerCapture(Na__Event.pointerId); } catch (_) {}
    });

    Na__Canvas.addEventListener("pointercancel", () => {
        if (Na__PhotoUtils__State.mode === "drawing") Na__PhotoUtils__CancelActiveLine();
    });

    Na__PhotoUtils__Dom.Na__ImageUpload.addEventListener("change", (Na__Event) => {
        const Na__File = Na__Event.target.files && Na__Event.target.files[0];
        Na__PhotoUtils__LoadImageFromFile(Na__File, Na__PhotoUtils__OnImageLoaded);
    });

    Na__PhotoUtils__Dom.Na__SegmentInput.addEventListener("input", () => {
        Na__PhotoUtils__State.typedBuffer = "";
        Na__PhotoUtils__SetActiveSegmentCount(Na__PhotoUtils__Dom.Na__SegmentInput.value);
    });

    Na__PhotoUtils__Dom.Na__CommitButton.addEventListener("click", Na__PhotoUtils__CommitPendingLine);
    Na__PhotoUtils__Dom.Na__CancelButton.addEventListener("click", Na__PhotoUtils__CancelActiveLine);

    Na__PhotoUtils__Dom.Na__UndoButton.addEventListener("click", () => {
        if (!Na__PhotoUtils__State.lines.length) return;
        Na__PhotoUtils__State.lines.pop();
        Na__PhotoUtils__State.selectedIndex = -1;
        Na__PhotoUtils__SetStatus(Na__PhotoUtils__AppConfig.NaMiniApp__UiText.NaMiniApp__StatusUndone);
        Na__PhotoUtils__RunRenderCycle();
    });

    Na__PhotoUtils__Dom.Na__ClearButton.addEventListener("click", () => {
        Na__PhotoUtils__State.lines         = [];
        Na__PhotoUtils__State.selectedIndex = -1;
        Na__PhotoUtils__State.pendingLine   = null;
        Na__PhotoUtils__State.previewLine   = null;
        Na__PhotoUtils__State.mode          = "idle";
        const Na__UiText = Na__PhotoUtils__AppConfig.NaMiniApp__UiText;
        Na__PhotoUtils__SetStatus(Na__PhotoUtils__State.hasImage ? Na__UiText.NaMiniApp__StatusCleared : Na__UiText.NaMiniApp__StatusReady);
        Na__PhotoUtils__RunRenderCycle();
    });

    Na__Viewport.addEventListener("dragover", (Na__Event) => {
        Na__Event.preventDefault();
        Na__Viewport.classList.add("PLSC__viewport--drag-active");
    });

    Na__Viewport.addEventListener("dragleave", (Na__Event) => {
        if (!Na__Viewport.contains(Na__Event.relatedTarget)) {
            Na__Viewport.classList.remove("PLSC__viewport--drag-active");
        }
    });

    Na__Viewport.addEventListener("drop", (Na__Event) => {
        Na__Viewport.classList.remove("PLSC__viewport--drag-active");
        Na__PhotoUtils__HandleImageDrop(Na__Event, Na__PhotoUtils__OnImageLoaded);
    });

    window.addEventListener("paste", (Na__Event) => {
        Na__PhotoUtils__HandleClipboardPaste(Na__Event, Na__PhotoUtils__OnImageLoaded);
    });

    window.addEventListener("keydown", Na__PhotoUtils__HandleKeyDown);
}
// ------------------------------------------------------------


// FUNCTION | Load app config, apply UI text, and wire all event listeners
// ------------------------------------------------------------
async function Na__PhotoUtils__BootstrapApp() {
    const Na__ConfigResponse = await fetch("./MiniApp__PhotoUtils__LineSegmentCounter__AppConfig__.json");
    if (!Na__ConfigResponse.ok) {
        throw new Error(`Failed to load app config (HTTP ${Na__ConfigResponse.status}).`);
    }

    Na__PhotoUtils__AppConfig = await Na__ConfigResponse.json();
    Na__PhotoUtils__Ctx       = Na__PhotoUtils__Dom.Na__Canvas.getContext("2d");

    Na__PhotoUtils__ApplyUiTextFromConfig();
    Na__PhotoUtils__RegisterEventListeners();
    Na__PhotoUtils__RunRenderCycle();
}
// ------------------------------------------------------------


// INITIALISE | Run bootstrap on DOM ready
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    Na__PhotoUtils__BootstrapApp().catch((Na__ErrorObject) => {
        console.error("Line Segment Counter bootstrap failed:", Na__ErrorObject);
    });
});
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
