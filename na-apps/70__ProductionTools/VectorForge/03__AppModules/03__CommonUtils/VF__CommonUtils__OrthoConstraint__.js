// =============================================================================
// VECTORFORGE - ORTHO CONSTRAINT UTILITY
// =============================================================================
//
// FILE      : VF__CommonUtils__OrthoConstraint__.js
// NAMESPACE : VectorForge.CommonUtils
// MODULE    : OrthoConstraint
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Shared orthogonal axis-lock helper used by drawing tools and
//             point-edit drag handlers when Shift is held
// CREATED   : 26-Jun-2026
//
// DESCRIPTION:
// - Provides a single exported function that constrains a cursor point to the
//   nearest axis (horizontal or vertical) relative to a fixed anchor point.
// - Direction is inferred from the dominant delta: whichever of |dx| or |dy|
//   is larger determines the locked axis.
// - When Shift is not held the function is a no-op — it returns the cursor
//   unchanged — keeping call sites simple with a single conditional entry.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 26-Jun-2026 - Version 1.0.0
// - Initial stable release.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Ortho Constraint Helper
// -----------------------------------------------------------------------------

    // FUNCTION | ConstrainPointToOrtho — Lock Cursor to Nearest Axis From Anchor
    // ------------------------------------------------------------
    export function VF__CommonUtils__ConstrainPointToOrtho(anchorX, anchorY, cursorX, cursorY, shiftHeld) {
        if (!shiftHeld) return { x: cursorX, y: cursorY }; // <-- No-op when Shift not held

        const dx = Math.abs(cursorX - anchorX); // <-- Horizontal distance from anchor
        const dy = Math.abs(cursorY - anchorY); // <-- Vertical distance from anchor

        if (dx >= dy) {
            return { x: cursorX, y: anchorY }; // <-- Dominant horizontal — lock to anchor Y
        } else {
            return { x: anchorX, y: cursorY }; // <-- Dominant vertical   — lock to anchor X
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
