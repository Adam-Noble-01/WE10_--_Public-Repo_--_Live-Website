// =============================================================================
// NOBLE ARCHITECTURE - PHOTO UTILS - LINE SEGMENT COUNTER - CANVAS DRAW
// =============================================================================
//
// FILE    : MiniApp__PhotoUtils__LineSegmentCounter__CanvasDraw__.js
// PURPOSE : All canvas rendering operations — base image, segmented lines, full render pass
// CREATED : 29-May-2026
//
// =============================================================================

// -----------------------------------------------------------------------------
// REGION | Imports
// -----------------------------------------------------------------------------

// @delegate: ./MiniApp__PhotoUtils__LineSegmentCounter__LineUtils__.js
import {
    Na__PhotoUtils__ClampValue,
    Na__PhotoUtils__GetDistanceBetweenPoints
} from "./MiniApp__PhotoUtils__LineSegmentCounter__LineUtils__.js";

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Internal Draw Helpers
// -----------------------------------------------------------------------------

// HELPER FUNCTION | Draw a two-pass outlined stroke (shadow outline + colour fill)
// ------------------------------------------------------------
function Na__PhotoUtils__DrawOutlinedStroke(Na__Ctx, Na__DrawPathCallback) {
    Na__Ctx.save();
    Na__Ctx.lineCap     = "round";
    Na__Ctx.lineJoin    = "round";
    Na__Ctx.strokeStyle = "rgba(0,0,0,0.85)";
    Na__Ctx.lineWidth   = 7;
    Na__DrawPathCallback();
    Na__Ctx.stroke();
    Na__Ctx.restore();
}
// ------------------------------------------------------------


// HELPER FUNCTION | Draw a rounded rectangle path (polyfills ctx.roundRect for older engines)
// ------------------------------------------------------------
function Na__PhotoUtils__DrawRoundRect(Na__Ctx, Na__X, Na__Y, Na__W, Na__H, Na__Radius) {
    if (Na__Ctx.roundRect) {
        Na__Ctx.roundRect(Na__X, Na__Y, Na__W, Na__H, Na__Radius);
        return;
    }
    const Na__R = Math.min(Na__Radius, Na__W / 2, Na__H / 2);
    Na__Ctx.moveTo(Na__X + Na__R, Na__Y);
    Na__Ctx.arcTo(Na__X + Na__W,  Na__Y,          Na__X + Na__W,  Na__Y + Na__H,  Na__R);
    Na__Ctx.arcTo(Na__X + Na__W,  Na__Y + Na__H,  Na__X,          Na__Y + Na__H,  Na__R);
    Na__Ctx.arcTo(Na__X,          Na__Y + Na__H,  Na__X,          Na__Y,          Na__R);
    Na__Ctx.arcTo(Na__X,          Na__Y,          Na__X + Na__W,  Na__Y,          Na__R);
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Exports
// -----------------------------------------------------------------------------

// FUNCTION | Clear canvas and redraw the base image layer (or background fill)
// ------------------------------------------------------------
export function Na__PhotoUtils__DrawImageBaseLayer(Na__Ctx, Na__Canvas, Na__ImageElement, Na__HasImage, Na__Defaults) {
    Na__Ctx.clearRect(0, 0, Na__Canvas.width, Na__Canvas.height);

    if (Na__HasImage && Na__ImageElement) {
        Na__Ctx.drawImage(Na__ImageElement, 0, 0, Na__Canvas.width, Na__Canvas.height);
    } else {
        Na__Ctx.fillStyle = Na__Defaults.NaMiniApp__CanvasBackgroundColour;
        Na__Ctx.fillRect(0, 0, Na__Canvas.width, Na__Canvas.height);
    }
}
// ------------------------------------------------------------


// FUNCTION | Draw a single segmented line — main line, tick marks, optional segment label
// ------------------------------------------------------------
export function Na__PhotoUtils__DrawSegmentedLine(Na__Ctx, Na__Line, Na__Options, Na__Defaults) {
    const Na__PointA = { x: Na__Line.x1, y: Na__Line.y1 };
    const Na__PointB = { x: Na__Line.x2, y: Na__Line.y2 };
    const Na__Length = Na__PhotoUtils__GetDistanceBetweenPoints(Na__PointA, Na__PointB);

    if (Na__Length < 1) return;

    const Na__Dx       = (Na__Line.x2 - Na__Line.x1) / Na__Length;
    const Na__Dy       = (Na__Line.y2 - Na__Line.y1) / Na__Length;
    const Na__Nx       = -Na__Dy;
    const Na__Ny       =  Na__Dx;
    const Na__BaseTick = Na__PhotoUtils__ClampValue(Na__Length * 0.035, 10, 28);
    const Na__TickHalf = Na__Options.pending ? Na__BaseTick * 0.72 : Na__BaseTick * 0.62;
    const Na__LineW    = Na__Options.pending ? 4 : 3;
    const Na__SegCount = Na__PhotoUtils__ClampValue(
        Math.round(Na__Line.segments),
        Na__Defaults.NaMiniApp__MinSegments,
        Na__Defaults.NaMiniApp__MaxSegments
    );

    Na__PhotoUtils__DrawOutlinedStroke(Na__Ctx, () => {
        Na__Ctx.beginPath();
        Na__Ctx.moveTo(Na__Line.x1, Na__Line.y1);
        Na__Ctx.lineTo(Na__Line.x2, Na__Line.y2);
    });

    Na__Ctx.save();
    Na__Ctx.lineCap     = "round";
    Na__Ctx.lineJoin    = "round";
    Na__Ctx.strokeStyle = Na__Line.colour;
    Na__Ctx.lineWidth   = Na__LineW;
    Na__Ctx.beginPath();
    Na__Ctx.moveTo(Na__Line.x1, Na__Line.y1);
    Na__Ctx.lineTo(Na__Line.x2, Na__Line.y2);
    Na__Ctx.stroke();
    Na__Ctx.restore();

    for (let Na__I = 0; Na__I <= Na__SegCount; Na__I++) {
        const Na__T  = Na__I / Na__SegCount;
        const Na__Px = Na__Line.x1 + (Na__Line.x2 - Na__Line.x1) * Na__T;
        const Na__Py = Na__Line.y1 + (Na__Line.y2 - Na__Line.y1) * Na__T;

        Na__PhotoUtils__DrawOutlinedStroke(Na__Ctx, () => {
            Na__Ctx.beginPath();
            Na__Ctx.moveTo(Na__Px - Na__Nx * Na__TickHalf, Na__Py - Na__Ny * Na__TickHalf);
            Na__Ctx.lineTo(Na__Px + Na__Nx * Na__TickHalf, Na__Py + Na__Ny * Na__TickHalf);
        });

        Na__Ctx.save();
        Na__Ctx.lineCap     = "round";
        Na__Ctx.strokeStyle = Na__Line.colour;
        Na__Ctx.lineWidth   = Na__LineW;
        Na__Ctx.beginPath();
        Na__Ctx.moveTo(Na__Px - Na__Nx * Na__TickHalf, Na__Py - Na__Ny * Na__TickHalf);
        Na__Ctx.lineTo(Na__Px + Na__Nx * Na__TickHalf, Na__Py + Na__Ny * Na__TickHalf);
        Na__Ctx.stroke();
        Na__Ctx.restore();
    }

    if (Na__Options.selected || Na__Options.pending) {
        const Na__Mx        = (Na__Line.x1 + Na__Line.x2) / 2;
        const Na__My        = (Na__Line.y1 + Na__Line.y2) / 2;
        const Na__Label     = String(Na__SegCount);
        Na__Ctx.save();
        Na__Ctx.font        = "700 18px Arial, sans-serif";
        const Na__TextWidth = Na__Ctx.measureText(Na__Label).width;
        Na__Ctx.fillStyle   = "rgba(0,0,0,0.78)";
        Na__Ctx.strokeStyle = Na__Line.colour;
        Na__Ctx.lineWidth   = 2;
        Na__Ctx.beginPath();
        Na__PhotoUtils__DrawRoundRect(Na__Ctx, Na__Mx - Na__TextWidth / 2 - 10, Na__My - 31, Na__TextWidth + 20, 24, 8);
        Na__Ctx.fill();
        Na__Ctx.stroke();
        Na__Ctx.fillStyle = "#fff";
        Na__Ctx.fillText(Na__Label, Na__Mx - Na__TextWidth / 2, Na__My - 13);
        Na__Ctx.restore();
    }
}
// ------------------------------------------------------------


// FUNCTION | Execute a full render pass — base image, all committed lines, active line
// ------------------------------------------------------------
export function Na__PhotoUtils__RenderAll(Na__Ctx, Na__Canvas, Na__State, Na__Defaults) {
    Na__PhotoUtils__DrawImageBaseLayer(Na__Ctx, Na__Canvas, Na__State.imageElement, Na__State.hasImage, Na__Defaults);

    Na__State.lines.forEach((Na__Line, Na__Index) => {
        Na__PhotoUtils__DrawSegmentedLine(Na__Ctx, Na__Line, { selected: Na__Index === Na__State.selectedIndex }, Na__Defaults);
    });

    if (Na__State.previewLine) {
        Na__PhotoUtils__DrawSegmentedLine(Na__Ctx, Na__State.previewLine, { pending: true }, Na__Defaults);
    }

    if (Na__State.pendingLine) {
        Na__PhotoUtils__DrawSegmentedLine(Na__Ctx, Na__State.pendingLine, { pending: true }, Na__Defaults);
    }
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
