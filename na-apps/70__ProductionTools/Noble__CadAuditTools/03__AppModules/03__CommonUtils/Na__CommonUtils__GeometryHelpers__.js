// =============================================================================
// NOBLE CAD AUDIT TOOLS - GEOMETRY HELPERS
// =============================================================================
//
// FILE      : Na__CommonUtils__GeometryHelpers__.js
// NAMESPACE : CadAuditTools.CommonUtils
// MODULE    : GeometryHelpers
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Geometric utility functions for box-select hit testing
// CREATED   : 07-Jul-2026
//
// DESCRIPTION:
// - Pure functions — no state, no EventBus dependency.
// - Provides hit-testing primitives used by Na__SelectionTools__BoxSelectTool__:
//   - Na__Geom__RectContainsRect     : Window select (entity fully inside box)
//   - Na__Geom__RectIntersectsRect   : Crossing select (entity bounding box touches box)
//   - Na__Geom__PointInRect          : Point inside rectangle test
//   - Na__Geom__GetEntityBoundingBox : Extracts bounding box from DXF entity geometry
// - All coordinates are in SVG drawing space (post-viewBox transform).
//
// TODO (follow-up): Implement Na__Geom__GetEntityBoundingBox for all DXF entity types.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jul-2026 - Version 0.1.0
// - Initial scaffold release — stubs for entity bounding box; rect geometry complete.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Rectangle Intersection and Containment Tests
// -----------------------------------------------------------------------------

    // FUNCTION | Test if Rect A Fully Contains Rect B (Window Select)
    // ------------------------------------------------------------
    export function Na__Geom__RectContainsRect(rectA, rectB) {
        return (
            rectB.minX >= rectA.minX &&
            rectB.maxX <= rectA.maxX &&
            rectB.minY >= rectA.minY &&
            rectB.maxY <= rectA.maxY
        );
    }
    // ------------------------------------------------------------


    // FUNCTION | Test if Two Rects Intersect (Crossing Select)
    // ------------------------------------------------------------
    export function Na__Geom__RectIntersectsRect(rectA, rectB) {
        return !(
            rectB.minX > rectA.maxX ||
            rectB.maxX < rectA.minX ||
            rectB.minY > rectA.maxY ||
            rectB.maxY < rectA.minY
        );
    }
    // ------------------------------------------------------------


    // FUNCTION | Test if a Point Is Inside a Rectangle
    // ------------------------------------------------------------
    export function Na__Geom__PointInRect(point, rect) {
        return (
            point.x >= rect.minX &&
            point.x <= rect.maxX &&
            point.y >= rect.minY &&
            point.y <= rect.maxY
        );
    }
    // ------------------------------------------------------------


    // FUNCTION | Normalise Two Corner Points to a minX/minY/maxX/maxY Rect
    // ------------------------------------------------------------
    export function Na__Geom__NormaliseRect(x1, y1, x2, y2) {
        return {
            minX : Math.min(x1, x2),
            minY : Math.min(y1, y2),
            maxX : Math.max(x1, x2),
            maxY : Math.max(y1, y2),
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Entity Bounding Box Extraction
// -----------------------------------------------------------------------------

    // FUNCTION | Extract the Axis-Aligned Bounding Box of a DXF Entity
    // ------------------------------------------------------------
    export function Na__Geom__GetEntityBoundingBox(entity) {
        if (!entity || !entity.geometry) return null;

        const g = entity.geometry;                                       // <-- Entity geometry data from ezdxf

        switch (entity.type) {
            case 'LINE':
                return Na__Geom__NormaliseRect(g.x1, g.y1, g.x2, g.y2); // <-- Line start and end points

            case 'CIRCLE':
                return {
                    minX : g.cx - g.radius,                              // <-- Centre minus radius
                    minY : g.cy - g.radius,
                    maxX : g.cx + g.radius,
                    maxY : g.cy + g.radius,
                };

            case 'ARC':
                // TODO: Proper arc bounding box (requires angle sweep computation)
                return {
                    minX : g.cx - g.radius,
                    minY : g.cy - g.radius,
                    maxX : g.cx + g.radius,
                    maxY : g.cy + g.radius,
                };

            case 'LWPOLYLINE':
            case 'POLYLINE':
                // TODO: Compute bounding box from vertex array
                if (!g.vertices || g.vertices.length === 0) return null;
                return Na__Geom__BoundsFromPoints(g.vertices);           // <-- Envelope of all vertices

            case 'TEXT':
            case 'MTEXT':
                // TODO: Proper text bounding box using insertion point + extent
                if (g.x == null || g.y == null) return null;
                return Na__Geom__NormaliseRect(g.x, g.y, g.x, g.y);     // <-- Degenerate point rect (stub)

            case 'INSERT':
                // TODO: Block reference bounding box (needs block definition lookup)
                if (g.x == null || g.y == null) return null;
                return Na__Geom__NormaliseRect(g.x, g.y, g.x, g.y);     // <-- Insertion point only (stub)

            default:
                console.warn(`[Na__GeometryHelpers] Unknown entity type for bounding box: ${entity.type}`);
                return null;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Compute an Axis-Aligned Bounding Box from a Point Array
    // ------------------------------------------------------------
    function Na__Geom__BoundsFromPoints(points) {
        if (!points || points.length === 0) return null;

        let minX =  Infinity;
        let minY =  Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        points.forEach(({ x, y }) => {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        });

        return { minX, minY, maxX, maxY };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
