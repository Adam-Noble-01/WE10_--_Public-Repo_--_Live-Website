// =============================================================================
// NOBLE ARCHITECTURE - PHOTO UTILS - LINE SEGMENT COUNTER - LINE UTILITIES
// =============================================================================
//
// FILE    : MiniApp__PhotoUtils__LineSegmentCounter__LineUtils__.js
// PURPOSE : Pure math helpers for line geometry and segment record creation
// CREATED : 29-May-2026
//
// =============================================================================

// -----------------------------------------------------------------------------
// REGION | Exports
// -----------------------------------------------------------------------------

// HELPER FUNCTION | Clamp a numeric value within a min/max range
// ------------------------------------------------------------
export function Na__PhotoUtils__ClampValue(Na__Value, Na__Min, Na__Max) {
    return Math.max(Na__Min, Math.min(Na__Max, Na__Value));
}
// ------------------------------------------------------------


// HELPER FUNCTION | Calculate Euclidean distance between two {x, y} points
// ------------------------------------------------------------
export function Na__PhotoUtils__GetDistanceBetweenPoints(Na__PointA, Na__PointB) {
    const Na__Dx = Na__PointB.x - Na__PointA.x;
    const Na__Dy = Na__PointB.y - Na__PointA.y;
    return Math.sqrt(Na__Dx * Na__Dx + Na__Dy * Na__Dy);
}
// ------------------------------------------------------------


// HELPER FUNCTION | Create a new line record object from raw coordinates
// ------------------------------------------------------------
export function Na__PhotoUtils__CreateLineRecord(Na__X1, Na__Y1, Na__X2, Na__Y2, Na__Segments, Na__Colour, Na__Defaults) {
    const Na__ClampedSegments = Na__PhotoUtils__ClampValue(
        Math.round(Na__Segments || 1),
        Na__Defaults.NaMiniApp__MinSegments,
        Na__Defaults.NaMiniApp__MaxSegments
    );

    return {
        id       : Date.now().toString(36) + Math.random().toString(36).slice(2),
        x1       : Na__X1,
        y1       : Na__Y1,
        x2       : Na__X2,
        y2       : Na__Y2,
        segments : Na__ClampedSegments,
        colour   : Na__Colour
    };
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
