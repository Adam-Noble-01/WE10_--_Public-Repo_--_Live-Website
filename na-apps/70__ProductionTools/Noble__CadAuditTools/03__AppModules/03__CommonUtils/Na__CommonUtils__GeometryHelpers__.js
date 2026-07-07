// =============================================================================
// NOBLE CAD AUDIT TOOLS - GEOMETRY HELPERS
// =============================================================================
//
// FILE      : Na__CommonUtils__GeometryHelpers__.js
// NAMESPACE : CadAuditTools.CommonUtils
// MODULE    : GeometryHelpers
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Geometric utility functions for selection hit testing and snapping
// CREATED   : 07-Jul-2026
//
// DESCRIPTION:
// - Pure functions — no state, no EventBus dependency.
// - ALL COORDINATES ARE IN DXF MODEL SPACE (Y increases upward). Callers
//   convert screen/SVG coordinates to DXF space before calling these.
// - Rectangle tests   : window/crossing box select.
// - Polygon tests     : lasso select (point-in-polygon, segment intersection).
// - Segment extraction: each entity approximated as line segments for precise
//   crossing-select and click-select distance tests (not just bounding boxes).
// - Snap points       : endpoint / midpoint / centre extraction for dimensions.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jul-2026 - Version 0.3.0
// - Added precise segment-based hit testing (rect + polygon + point distance).
// - Added lasso polygon containment/intersection tests.
// - Added snap point extraction for the dimension tools.
// - Added HATCH path support to bounding box extraction.
//
// 07-Jul-2026 - Version 0.1.0
// - Initial scaffold release — rect geometry complete, entity bbox added.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Curve Sampling Densities
    // ------------------------------------------------------------
    const Na__GEOM_CIRCLE_SEGMENTS  = 24;  // <-- Segments per full circle for hit testing
    const Na__GEOM_ARC_SEGMENTS     = 16;  // <-- Segments per arc sweep for hit testing
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


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
// REGION | Segment Intersection Primitives
// -----------------------------------------------------------------------------

    // FUNCTION | Test if Two Line Segments Intersect
    // ------------------------------------------------------------
    export function Na__Geom__SegmentIntersectsSegment(a1, a2, b1, b2) {
        const d1 = Na__Geom__CrossOrientation(b1, b2, a1);
        const d2 = Na__Geom__CrossOrientation(b1, b2, a2);
        const d3 = Na__Geom__CrossOrientation(a1, a2, b1);
        const d4 = Na__Geom__CrossOrientation(a1, a2, b2);

        if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
            ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;    // <-- Proper crossing

        if (d1 === 0 && Na__Geom__PointOnSegment(b1, b2, a1)) return true; // <-- Collinear touching cases
        if (d2 === 0 && Na__Geom__PointOnSegment(b1, b2, a2)) return true;
        if (d3 === 0 && Na__Geom__PointOnSegment(a1, a2, b1)) return true;
        if (d4 === 0 && Na__Geom__PointOnSegment(a1, a2, b2)) return true;
        return false;
    }
    // ------------------------------------------------------------


    // FUNCTION | Test if a Segment Intersects or Enters a Rectangle
    // ------------------------------------------------------------
    export function Na__Geom__SegmentIntersectsRect(p1, p2, rect) {
        if (Na__Geom__PointInRect(p1, rect) || Na__Geom__PointInRect(p2, rect)) return true; // <-- Endpoint inside

        const corners = [
            { x: rect.minX, y: rect.minY },
            { x: rect.maxX, y: rect.minY },
            { x: rect.maxX, y: rect.maxY },
            { x: rect.minX, y: rect.maxY },
        ];
        for (let i = 0; i < 4; i++) {
            if (Na__Geom__SegmentIntersectsSegment(p1, p2, corners[i], corners[(i + 1) % 4])) return true; // <-- Crosses an edge
        }
        return false;
    }
    // ------------------------------------------------------------


    // FUNCTION | Shortest Distance from a Point to a Line Segment
    // ------------------------------------------------------------
    export function Na__Geom__DistancePointToSegment(pt, p1, p2) {
        const dx  = p2.x - p1.x;
        const dy  = p2.y - p1.y;
        const len2 = dx * dx + dy * dy;

        if (len2 === 0) return Math.hypot(pt.x - p1.x, pt.y - p1.y);    // <-- Degenerate segment = point

        let t = ((pt.x - p1.x) * dx + (pt.y - p1.y) * dy) / len2;
        t = Math.max(0, Math.min(1, t));                                 // <-- Clamp projection onto segment

        const cx = p1.x + t * dx;
        const cy = p1.y + t * dy;
        return Math.hypot(pt.x - cx, pt.y - cy);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Cross-Product Orientation of Point C Relative to Segment AB
    // ------------------------------------------------------------
    function Na__Geom__CrossOrientation(a, b, c) {
        return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Test if Point P Lies Within the Bounding Span of Segment AB
    // ------------------------------------------------------------
    function Na__Geom__PointOnSegment(a, b, p) {
        return (
            Math.min(a.x, b.x) <= p.x && p.x <= Math.max(a.x, b.x) &&
            Math.min(a.y, b.y) <= p.y && p.y <= Math.max(a.y, b.y)
        );
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Polygon Tests (Lasso Select)
// -----------------------------------------------------------------------------

    // FUNCTION | Test if a Point Is Inside a Polygon (Ray Casting)
    // ------------------------------------------------------------
    export function Na__Geom__PointInPolygon(pt, polygon) {
        let inside = false;
        const n = polygon.length;
        for (let i = 0, j = n - 1; i < n; j = i++) {
            const pi = polygon[i];
            const pj = polygon[j];
            if (((pi.y > pt.y) !== (pj.y > pt.y)) &&
                (pt.x < ((pj.x - pi.x) * (pt.y - pi.y)) / (pj.y - pi.y) + pi.x)) {
                inside = !inside;                                        // <-- Toggle on each edge crossing
            }
        }
        return inside;
    }
    // ------------------------------------------------------------


    // FUNCTION | Test if a Segment Intersects a Polygon Boundary or Interior
    // ------------------------------------------------------------
    export function Na__Geom__SegmentIntersectsPolygon(p1, p2, polygon) {
        if (Na__Geom__PointInPolygon(p1, polygon) || Na__Geom__PointInPolygon(p2, polygon)) return true;

        const n = polygon.length;
        for (let i = 0, j = n - 1; i < n; j = i++) {
            if (Na__Geom__SegmentIntersectsSegment(p1, p2, polygon[j], polygon[i])) return true;
        }
        return false;
    }
    // ------------------------------------------------------------


    // FUNCTION | Test if a Segment Is FULLY Inside a Polygon (Window Lasso)
    // ------------------------------------------------------------
    export function Na__Geom__SegmentInPolygon(p1, p2, polygon) {
        if (!Na__Geom__PointInPolygon(p1, polygon) || !Na__Geom__PointInPolygon(p2, polygon)) return false;

        const n = polygon.length;
        for (let i = 0, j = n - 1; i < n; j = i++) {
            if (Na__Geom__SegmentIntersectsSegment(p1, p2, polygon[j], polygon[i])) return false; // <-- Pokes out through an edge
        }
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Entity Segment Extraction
// -----------------------------------------------------------------------------

    // FUNCTION | Approximate an Entity as an Array of Line Segments (DXF Space)
    // ------------------------------------------------------------
    export function Na__Geom__GetEntitySegments(entity) {
        if (!entity || !entity.geometry) return [];

        const g = entity.geometry;

        switch (entity.type) {
            case 'LINE':
                return [[{ x: g.x1, y: g.y1 }, { x: g.x2, y: g.y2 }]];

            case 'CIRCLE':
                return Na__Geom__SampleArcSegments(g.cx, g.cy, g.radius, 0, 360, Na__GEOM_CIRCLE_SEGMENTS);

            case 'ARC':
                return Na__Geom__SampleArcSegments(g.cx, g.cy, g.radius, g.startAngle, g.endAngle, Na__GEOM_ARC_SEGMENTS);

            case 'LWPOLYLINE':
            case 'POLYLINE':
            case 'SPLINE':
            case 'SOLID':
            case 'TRACE':
                return Na__Geom__PolylineSegments(g.vertices, g.closed);

            case 'ELLIPSE': {
                const segs   = [];
                const startP = g.startParam ?? 0;
                let   span   = (g.endParam ?? Math.PI * 2) - startP;
                if (span <= 0) span += Math.PI * 2;
                const steps  = Na__GEOM_CIRCLE_SEGMENTS;
                const rot    = (g.rotation ?? 0) * Math.PI / 180;
                let prev = null;
                for (let i = 0; i <= steps; i++) {
                    const t  = startP + span * (i / steps);
                    const ex = g.rx * Math.cos(t);
                    const ey = g.ry * Math.sin(t);
                    const pt = {
                        x : g.cx + ex * Math.cos(rot) - ey * Math.sin(rot),
                        y : g.cy + ex * Math.sin(rot) + ey * Math.cos(rot),
                    };
                    if (prev) segs.push([prev, pt]);
                    prev = pt;
                }
                return segs;
            }

            case 'HATCH': {
                const segs = [];
                (g.paths || []).forEach((path) => {
                    segs.push(...Na__Geom__PolylineSegments(path.vertices, path.closed));
                });
                return segs;
            }

            case 'TEXT':
            case 'MTEXT':
            case 'INSERT':
            case 'POINT': {
                const bbox = Na__Geom__GetEntityBoundingBox(entity);     // <-- Fall back to bbox outline
                if (!bbox) return [];
                const c = [
                    { x: bbox.minX, y: bbox.minY },
                    { x: bbox.maxX, y: bbox.minY },
                    { x: bbox.maxX, y: bbox.maxY },
                    { x: bbox.minX, y: bbox.maxY },
                ];
                return [[c[0], c[1]], [c[1], c[2]], [c[2], c[3]], [c[3], c[0]]];
            }

            default:
                return [];
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build Segment Array from a Vertex List
    // ------------------------------------------------------------
    function Na__Geom__PolylineSegments(vertices, closed) {
        if (!vertices || vertices.length < 2) return [];
        const segs = [];
        for (let i = 0; i < vertices.length - 1; i++) {
            segs.push([vertices[i], vertices[i + 1]]);
        }
        if (closed && vertices.length > 2) {
            segs.push([vertices[vertices.length - 1], vertices[0]]);    // <-- Closing segment
        }
        return segs;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Sample an Arc into Line Segments
    // ------------------------------------------------------------
    function Na__Geom__SampleArcSegments(cx, cy, radius, startDeg, endDeg, steps) {
        let a0 = startDeg * Math.PI / 180;
        let a1 = endDeg   * Math.PI / 180;
        if (a1 <= a0) a1 += 2 * Math.PI;                                 // <-- Wrap CCW sweep

        const segs = [];
        let prev = null;
        for (let i = 0; i <= steps; i++) {
            const a  = a0 + (a1 - a0) * (i / steps);
            const pt = { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
            if (prev) segs.push([prev, pt]);
            prev = pt;
        }
        return segs;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Entity-Level Hit Tests
// -----------------------------------------------------------------------------

    // FUNCTION | Test if an Entity Is FULLY Inside a Rect (Window Select)
    // ------------------------------------------------------------
    export function Na__Geom__EntityInRect(entity, rect) {
        const bbox = Na__Geom__GetEntityBoundingBox(entity);
        if (!bbox) return false;
        return Na__Geom__RectContainsRect(rect, bbox);                   // <-- Bbox containment is exact for "fully inside"
    }
    // ------------------------------------------------------------


    // FUNCTION | Test if an Entity Touches or Crosses a Rect (Crossing Select)
    // ------------------------------------------------------------
    export function Na__Geom__EntityIntersectsRect(entity, rect) {
        const bbox = Na__Geom__GetEntityBoundingBox(entity);
        if (!bbox) return false;
        if (!Na__Geom__RectIntersectsRect(rect, bbox)) return false;     // <-- Cheap bbox rejection first
        if (Na__Geom__RectContainsRect(rect, bbox))    return true;      // <-- Fully inside = trivially touching

        const segments = Na__Geom__GetEntitySegments(entity);           // <-- Precise segment-level test
        return segments.some(([p1, p2]) => Na__Geom__SegmentIntersectsRect(p1, p2, rect));
    }
    // ------------------------------------------------------------


    // FUNCTION | Test if an Entity Is FULLY Inside a Polygon (Window Lasso)
    // ------------------------------------------------------------
    export function Na__Geom__EntityInPolygon(entity, polygon, polygonBBox) {
        const bbox = Na__Geom__GetEntityBoundingBox(entity);
        if (!bbox) return false;
        if (polygonBBox && !Na__Geom__RectContainsRect(polygonBBox, bbox)) return false; // <-- Cheap rejection

        const segments = Na__Geom__GetEntitySegments(entity);
        if (segments.length === 0) return false;
        return segments.every(([p1, p2]) => Na__Geom__SegmentInPolygon(p1, p2, polygon));
    }
    // ------------------------------------------------------------


    // FUNCTION | Test if an Entity Touches a Polygon (Crossing Lasso)
    // ------------------------------------------------------------
    export function Na__Geom__EntityIntersectsPolygon(entity, polygon, polygonBBox) {
        const bbox = Na__Geom__GetEntityBoundingBox(entity);
        if (!bbox) return false;
        if (polygonBBox && !Na__Geom__RectIntersectsRect(polygonBBox, bbox)) return false; // <-- Cheap rejection

        const segments = Na__Geom__GetEntitySegments(entity);
        return segments.some(([p1, p2]) => Na__Geom__SegmentIntersectsPolygon(p1, p2, polygon));
    }
    // ------------------------------------------------------------


    // FUNCTION | Shortest Distance from a Point to an Entity (Click Select)
    // ------------------------------------------------------------
    export function Na__Geom__DistancePointToEntity(pt, entity) {
        const segments = Na__Geom__GetEntitySegments(entity);
        let best = Infinity;
        segments.forEach(([p1, p2]) => {
            const d = Na__Geom__DistancePointToSegment(pt, p1, p2);
            if (d < best) best = d;
        });
        return best;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Snap Point Extraction (Dimension Tools)
// -----------------------------------------------------------------------------

    // FUNCTION | Extract Snap Points from an Entity — Endpoints, Midpoints, Centres
    // ------------------------------------------------------------
    export function Na__Geom__GetEntitySnapPoints(entity) {
        if (!entity || !entity.geometry) return [];

        const g     = entity.geometry;
        const snaps = [];

        switch (entity.type) {
            case 'LINE':
                snaps.push({ x: g.x1, y: g.y1, kind: 'endpoint' });
                snaps.push({ x: g.x2, y: g.y2, kind: 'endpoint' });
                snaps.push({ x: (g.x1 + g.x2) / 2, y: (g.y1 + g.y2) / 2, kind: 'midpoint' });
                break;

            case 'CIRCLE':
                snaps.push({ x: g.cx, y: g.cy, kind: 'center' });
                snaps.push({ x: g.cx + g.radius, y: g.cy, kind: 'endpoint' }); // <-- Quadrant points
                snaps.push({ x: g.cx - g.radius, y: g.cy, kind: 'endpoint' });
                snaps.push({ x: g.cx, y: g.cy + g.radius, kind: 'endpoint' });
                snaps.push({ x: g.cx, y: g.cy - g.radius, kind: 'endpoint' });
                break;

            case 'ARC': {
                snaps.push({ x: g.cx, y: g.cy, kind: 'center' });
                const a0 = g.startAngle * Math.PI / 180;
                let   a1 = g.endAngle   * Math.PI / 180;
                if (a1 <= a0) a1 += 2 * Math.PI;
                snaps.push({ x: g.cx + g.radius * Math.cos(a0), y: g.cy + g.radius * Math.sin(a0), kind: 'endpoint' });
                snaps.push({ x: g.cx + g.radius * Math.cos(a1), y: g.cy + g.radius * Math.sin(a1), kind: 'endpoint' });
                const am = (a0 + a1) / 2;
                snaps.push({ x: g.cx + g.radius * Math.cos(am), y: g.cy + g.radius * Math.sin(am), kind: 'midpoint' });
                break;
            }

            case 'LWPOLYLINE':
            case 'POLYLINE':
            case 'SPLINE':
            case 'SOLID':
            case 'TRACE': {
                const verts = g.vertices || [];
                verts.forEach((v) => snaps.push({ x: v.x, y: v.y, kind: 'endpoint' }));
                for (let i = 0; i < verts.length - 1; i++) {
                    snaps.push({
                        x    : (verts[i].x + verts[i + 1].x) / 2,
                        y    : (verts[i].y + verts[i + 1].y) / 2,
                        kind : 'midpoint',
                    });
                }
                break;
            }

            case 'ELLIPSE':
                snaps.push({ x: g.cx, y: g.cy, kind: 'center' });
                break;

            case 'TEXT':
            case 'MTEXT':
            case 'INSERT':
            case 'POINT':
                if (g.x != null && g.y != null) {
                    snaps.push({ x: g.x, y: g.y, kind: 'endpoint' });    // <-- Insertion point
                }
                break;

            default:
                break;
        }

        return snaps;
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
                return Na__Geom__ArcBounds(g.cx, g.cy, g.radius, g.startAngle, g.endAngle);

            case 'LWPOLYLINE':
            case 'POLYLINE':
            case 'SPLINE':
            case 'SOLID':
            case 'TRACE':
                if (!g.vertices || g.vertices.length === 0) return null;
                return Na__Geom__BoundsFromPoints(g.vertices);           // <-- Envelope of all vertices

            case 'HATCH': {
                const allVerts = (g.paths || []).flatMap((p) => p.vertices || []);
                if (allVerts.length === 0) return null;
                return Na__Geom__BoundsFromPoints(allVerts);
            }

            case 'ELLIPSE': {
                // Approximate with the outer bounding box of rx/ry
                const erx = g.rx ?? g.radius ?? 0;
                const ery = g.ry ?? g.radius ?? 0;
                return {
                    minX : g.cx - erx,
                    minY : g.cy - ery,
                    maxX : g.cx + erx,
                    maxY : g.cy + ery,
                };
            }

            case 'TEXT':
            case 'MTEXT': {
                // Use insertion point + approximate extent from height and text length
                if (g.x == null || g.y == null) return null;
                const textW = (g.text ? g.text.length : 1) * (g.height ?? 2.5) * 0.6;
                const textH = g.height ?? 2.5;
                return {
                    minX : g.x,
                    minY : g.y,
                    maxX : g.x + textW,
                    maxY : g.y + textH,
                };
            }

            case 'INSERT':
            case 'POINT':
                // Insertion/point uses a small tolerance box around the origin
                if (g.x == null || g.y == null) return null;
                return Na__Geom__NormaliseRect(g.x - 0.5, g.y - 0.5, g.x + 0.5, g.y + 0.5);

            default:
                return null;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Compute the Tight Axis-Aligned Bounding Box of an Arc
    // ------------------------------------------------------------
    function Na__Geom__ArcBounds(cx, cy, radius, startAngleDeg, endAngleDeg) {
        // Sample the start and end points
        let startRad = startAngleDeg * Math.PI / 180;
        let endRad   = endAngleDeg   * Math.PI / 180;
        if (endRad <= startRad) endRad += 2 * Math.PI;                 // <-- Wrap CCW arc

        const pts = [
            { x: cx + radius * Math.cos(startRad), y: cy + radius * Math.sin(startRad) },
            { x: cx + radius * Math.cos(endRad),   y: cy + radius * Math.sin(endRad)   },
        ];

        // Add axis-aligned extremes that lie within the arc sweep
        const axisAngles = [0, 90, 180, 270];                          // <-- +X, +Y, -X, -Y extremes
        axisAngles.forEach((deg) => {
            const rad = deg * Math.PI / 180;
            if (Na__Geom__AngleInArcSweep(rad, startRad, endRad)) {
                pts.push({ x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) });
            }
        });

        return Na__Geom__BoundsFromPoints(pts);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Test Whether an Angle (Rad) Falls Within an Arc Sweep
    // ------------------------------------------------------------
    function Na__Geom__AngleInArcSweep(angle, startRad, endRad) {
        // Normalise angle into [startRad, endRad] range by shifting by 2π if needed
        while (angle < startRad) angle += 2 * Math.PI;
        return angle <= endRad;
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
