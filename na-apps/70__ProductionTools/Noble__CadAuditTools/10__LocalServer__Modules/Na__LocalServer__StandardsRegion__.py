#!/usr/bin/env python3
# =============================================================================
# NOBLE ARCHITECTURE - CAD AUDIT TOOLS STANDARDS REGION FILTER
# =============================================================================
#
# FILE      : Na__LocalServer__StandardsRegion__.py
# MODULE    : LocalServer.StandardsRegion
# AUTHOR    : Adam Noble - Noble Architecture
# PURPOSE   : Detect the office "Concept Design Standards" region in a source
#             CAD file and exclude everything inside it from the import
# CREATED   : 19-Aug-2026
#
# DESCRIPTION:
# Every incoming Noble/Vale concept drawing carries a standards library block —
# wall build-ups, window panels, hardware, tree and vehicle symbols, spec notes.
# It is never wanted in an audit and it is by far the heaviest part of the file
# to parse, explode, and render.
#
# The standards library is fenced by a marker border drawn in the studio CAD
# template: THREE nested rectangles, each offset ~100mm from the next, all drawn
# in RGB(250, 215, 0). This module finds that border and returns the region it
# encloses so the DXF engine can skip every entity inside it before any
# serialisation or block explosion happens.
#
# DETECTION SEQUENCE:
#   1. Single cheap pass over modelspace collecting only LINE / LWPOLYLINE /
#      POLYLINE entities whose resolved display colour matches the marker RGB.
#   2. Rings are recovered by two independent routes:
#      a. DIRECT — a closed marker polyline whose vertices ARE the four corners
#         of its own bounding box is a ring on its own, full stop. It is never
#         merged with anything else. This is the normal template case.
#      b. LOOSE — everything else (borders drawn as four separate LINEs, open
#         polyline chains) goes into a segment pool that is grouped into
#         connected components by shared endpoints.
#   3. A loose component is accepted as a ring when all four edges of its
#      bounding box are FULLY COVERED by segments lying along them. Coverage,
#      not total length: extra interior segments, duplicated linework, and
#      shapes that happen to touch a corner are ignored rather than fatal.
#   4. Rings are chained largest-to-smallest. A chain qualifies as a standards
#      region when it is at least Ring__MinCount deep AND every one of the four
#      edge gaps between consecutive rings falls inside the configured offset
#      window (95mm - 105mm by default).
#   5. The region is the OUTERMOST ring's bounding box, padded by a hair so the
#      marker rings themselves are treated as region content.
#
# WHY TWO ROUTES:
# The studio template draws a caption box ("Concept Design / Standards") whose
# corner sits exactly on the innermost ring's corner. Endpoint-connectivity
# grouping welds the two into one blob, which is why route (a) exists — a closed
# rectangle polyline is self-evidently a ring and must never be merged. Route (b)
# then only has to cope with borders that genuinely are loose linework.
#
# FAIL-SAFE BEHAVIOUR:
# If no qualifying border is found the module returns an empty region list and
# the import proceeds exactly as it always has. A drawing without the marker
# border is never altered by this feature.
#
# UNITS:
# Offsets and sizes are expressed in DRAWING UNITS. The app assumes millimetres
# throughout (see Config__Dimensions.Units__Suffix), so the defaults are mm.
#
# CONFIGURATION:
# All thresholds are data-driven from Config__StandardsRegion in
# 02__AppData/Na__AppData__AppConfig__.json. Enabled=false disables the feature.
#
# -----------------------------------------------------------------------------
#
# DEVELOPMENT LOG:
# 19-Aug-2026 - Version 0.2.0
# - FIX: closed rectangle polylines are now recovered directly instead of going
#   through endpoint-connectivity grouping. The template's caption box shares a
#   corner with the innermost ring, so grouping fused the two and the
#   total-length test then rejected the ring — leaving 2 rings where 3 were
#   required, so no region was ever detected on real studio drawings.
# - Loose-segment components now qualify on EDGE COVERAGE rather than total
#   length, so extra interior linework can no longer disqualify a valid border.
#
# 19-Aug-2026 - Version 0.1.0
# - Initial release — marker colour scan, ring assembly, nesting validation,
#   region containment tests for both entities and raw points.
#
# =============================================================================

import os
import json
import math


# #region ---------------------------------------------------------------------
# REGION | Module Constants and Configuration
# -----------------------------------------------------------------------------

_CONFIG_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    '02__AppData', 'Na__AppData__AppConfig__.json'
)

_MARKER_TYPES = ('LINE', 'LWPOLYLINE', 'POLYLINE')                       # <-- Only linework can form the marker border

_DEFAULTS = {
    'enabled'            : True,
    'marker_rgb'         : (250, 215, 0),                                # <-- Studio template border colour
    'color_tolerance'    : 8,                                            # <-- Per-channel RGB slack for converter drift
    'ring_min_count'     : 3,                                            # <-- "3x lines" — nesting depth required
    'ring_min_offset'    : 95.0,                                         # <-- Min gap between consecutive rings (mm)
    'ring_max_offset'    : 105.0,                                        # <-- Max gap between consecutive rings (mm)
    'join_tolerance'     : 1.0,                                          # <-- Endpoint snap distance when grouping rings (mm)
    'containment_pad'    : 1.0,                                          # <-- Region grown by this so the rings self-exclude (mm)
    'region_min_size'    : 500.0,                                        # <-- Reject tiny false-positive rectangles (mm)
    'max_marker_segments': 50000,                                        # <-- Runaway guard if the colour is used everywhere
}


def na_load_standards_settings():
    """
    Load Config__StandardsRegion from the app config JSON, falling back to the
    module defaults for any key that is missing or malformed.

    Returns:
        dict: Fully populated settings dict (see _DEFAULTS for the key set).
    """
    try:
        with open(_CONFIG_PATH, 'r', encoding='utf-8') as f:
            config = json.load(f)
        section = config.get('Config__StandardsRegion', {}) or {}
    except Exception:
        section = {}                                                     # <-- Missing/broken config falls back to defaults

    rgb = section.get('Marker__ColorRgb', _DEFAULTS['marker_rgb'])
    try:
        rgb = (int(rgb[0]), int(rgb[1]), int(rgb[2]))
    except Exception:
        rgb = _DEFAULTS['marker_rgb']

    def na_setting_number(key, default):
        try:
            return float(section.get(key, default))
        except Exception:
            return float(default)

    return {
        'enabled'            : bool(section.get('Enabled', _DEFAULTS['enabled'])),
        'marker_rgb'         : rgb,
        'color_tolerance'    : na_setting_number('Marker__ColorTolerance',       _DEFAULTS['color_tolerance']),
        'ring_min_count'     : int(na_setting_number('Ring__MinCount',           _DEFAULTS['ring_min_count'])),
        'ring_min_offset'    : na_setting_number('Ring__MinOffset_mm',           _DEFAULTS['ring_min_offset']),
        'ring_max_offset'    : na_setting_number('Ring__MaxOffset_mm',           _DEFAULTS['ring_max_offset']),
        'join_tolerance'     : na_setting_number('Ring__JoinTolerance_mm',       _DEFAULTS['join_tolerance']),
        'containment_pad'    : na_setting_number('Region__ContainmentPad_mm',    _DEFAULTS['containment_pad']),
        'region_min_size'    : na_setting_number('Region__MinSize_mm',           _DEFAULTS['region_min_size']),
        'max_marker_segments': int(na_setting_number('Marker__MaxSegments',      _DEFAULTS['max_marker_segments'])),
    }

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Public Entry Point — Detect Standards Regions
# -----------------------------------------------------------------------------

def na_detect_standards_regions(doc, color_resolver, settings=None):
    """
    Scan a DXF modelspace for the studio standards-library marker border and
    return every region it fences off.

    Args:
        doc            : An open ezdxf document.
        color_resolver : Callable(entity) -> '#rrggbb' resolving an entity's
                         DISPLAY colour (true colour, BYLAYER, or ACI). Injected
                         by the DXF engine so colour logic lives in one place.
        settings (dict): Optional pre-loaded settings; loaded from config if None.

    Returns:
        list[dict]: [{ minX, minY, maxX, maxY, ringCount, ringOffsets }, ...].
                    Empty when the feature is disabled or no border is present.
    """
    if settings is None:
        settings = na_load_standards_settings()

    if not settings['enabled']:
        return []

    poly_rings, segments = na_collect_marker_geometry(doc, color_resolver, settings)

    rings = list(poly_rings)                                             # <-- Route (a): closed rectangle polylines
    if len(segments) >= 4:
        rings.extend(na_assemble_rings(segments, settings))              # <-- Route (b): loose linework

    rings = na_filter_and_dedupe_rings(rings, settings)
    if len(rings) < settings['ring_min_count']:
        return []                                                        # <-- Marker colour present but not as nested rings

    regions = na_chain_rings_into_regions(rings, settings)

    for region in regions:
        print(f"[Na__StandardsRegion] Standards border found — "
              f"{region['ringCount']} rings, offsets {region['ringOffsets']}, "
              f"bounds ({region['minX']:.1f}, {region['minY']:.1f}) to "
              f"({region['maxX']:.1f}, {region['maxY']:.1f})")

    return regions

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Marker Colour Scan
# -----------------------------------------------------------------------------

def na_collect_marker_geometry(doc, color_resolver, settings):
    """
    Single cheap pass over modelspace, gathering marker-coloured linework by the
    two recovery routes. No block explosion, no curve flattening — the border is
    straight linework by definition.

    Returns:
        tuple(list[dict], list[tuple]):
            (rings recovered directly from closed rectangle polylines,
             loose segments [(x1, y1, x2, y2), ...] needing connectivity work)
    """
    target     = settings['marker_rgb']
    tol        = settings['color_tolerance']
    join_tol   = settings['join_tolerance']
    max_segs   = settings['max_marker_segments']
    poly_rings = []
    segments   = []

    for entity in doc.modelspace():
        if entity.dxftype() not in _MARKER_TYPES:
            continue                                                     # <-- Type gate first — cheapest possible reject

        try:
            hex_color = color_resolver(entity)
        except Exception:
            continue
        if not na_hex_matches_rgb(hex_color, target, tol):
            continue                                                     # <-- Wrong colour — not a marker

        na_sort_marker_entity(entity, join_tol, poly_rings, segments)

        if len(segments) > max_segs:
            print(f"[Na__StandardsRegion] Marker colour segment cap ({max_segs}) hit — "
                  f"standards detection abandoned, file imports in full")
            return [], []                                                # <-- Fail safe: import everything as normal

    return poly_rings, segments


def na_sort_marker_entity(entity, join_tol, poly_rings, segments):
    """
    Route one marker entity to the right recovery path: a closed polyline that
    is already a rectangle becomes a ring outright, everything else contributes
    loose segments.
    """
    etype = entity.dxftype()

    try:
        if etype == 'LINE':
            segments.append((entity.dxf.start.x, entity.dxf.start.y,
                             entity.dxf.end.x,   entity.dxf.end.y))
            return

        if etype == 'LWPOLYLINE':
            points = [(p[0], p[1]) for p in entity.get_points()]
            closed = bool(entity.closed)
        elif etype == 'POLYLINE':
            points = [(v.dxf.location.x, v.dxf.location.y) for v in entity.vertices]
            closed = bool(entity.dxf.get('flags', 0) & 1)                # <-- Bit 0 = closed polyline
        else:
            return

        if closed:
            rect = na_rect_from_points(points, join_tol)
            if rect is not None:
                poly_rings.append(rect)
                return                                                   # <-- Self-contained ring: contributes NO segments

        for i in range(len(points) - 1):
            segments.append((points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]))
        if closed and len(points) > 2:
            segments.append((points[-1][0], points[-1][1], points[0][0], points[0][1]))

    except Exception as err:
        print(f"[Na__StandardsRegion] Segment extraction skipped for {etype}: {err}")


def na_rect_from_points(points, tol):
    """
    Return a ring dict when the given vertices ARE the four corners of their own
    bounding box (in any winding or starting position), else None.
    """
    pts = list(points)
    if (len(pts) >= 2 and
            abs(pts[0][0] - pts[-1][0]) <= tol and abs(pts[0][1] - pts[-1][1]) <= tol):
        pts = pts[:-1]                                                   # <-- Drop a duplicated closing vertex
    if len(pts) != 4:
        return None

    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    if (max_x - min_x) <= tol or (max_y - min_y) <= tol:
        return None                                                      # <-- Degenerate: a line, not a rectangle

    unmatched = [(min_x, min_y), (max_x, min_y), (max_x, max_y), (min_x, max_y)]
    for px, py in pts:
        for corner in unmatched:
            if abs(px - corner[0]) <= tol and abs(py - corner[1]) <= tol:
                unmatched.remove(corner)
                break
        else:
            return None                                                  # <-- A vertex that is not a bbox corner
    if unmatched:
        return None

    return {
        'minX' : min_x, 'minY' : min_y,
        'maxX' : max_x, 'maxY' : max_y,
        'area' : (max_x - min_x) * (max_y - min_y),
    }


def na_hex_matches_rgb(hex_color, target_rgb, tolerance):
    """Compare a '#rrggbb' string against a target RGB triple within a per-channel tolerance."""
    if not hex_color or len(hex_color) != 7 or hex_color[0] != '#':
        return False
    try:
        r = int(hex_color[1:3], 16)
        g = int(hex_color[3:5], 16)
        b = int(hex_color[5:7], 16)
    except ValueError:
        return False
    return (abs(r - target_rgb[0]) <= tolerance and
            abs(g - target_rgb[1]) <= tolerance and
            abs(b - target_rgb[2]) <= tolerance)

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Ring Assembly — Segments to Rectangular Rings
# -----------------------------------------------------------------------------

def na_assemble_rings(segments, settings):
    """
    Group loose marker segments into connected components and keep those whose
    bounding-box edges are fully traced by the component's own linework.

    Coverage rather than total length: a component may carry extra interior
    segments (a caption box touching a corner, duplicated linework, a tick mark)
    and still be a perfectly good border. Only the four edges have to be drawn.

    Returns:
        list[dict]: [{ minX, minY, maxX, maxY, area }, ...] — one per ring.
    """
    join_tol = settings['join_tolerance']
    groups   = na_group_segments_by_connectivity(segments, join_tol)
    rings    = []

    for indices in groups.values():
        if len(indices) < 4:
            continue                                                     # <-- A rectangle needs at least four sides
        ring = na_component_to_ring(indices, segments, settings)
        if ring is not None:
            rings.append(ring)

    return rings


def na_component_to_ring(indices, segments, settings):
    """
    Accept one connected component as a ring when every edge of its bounding box
    is fully covered by segments running along that edge. Returns a ring dict or
    None.
    """
    tol      = settings['join_tolerance']
    min_size = settings['region_min_size']

    min_x = min_y =  float('inf')
    max_x = max_y = -float('inf')
    for i in indices:
        x1, y1, x2, y2 = segments[i]
        min_x = min(min_x, x1, x2);  max_x = max(max_x, x1, x2)
        min_y = min(min_y, y1, y2);  max_y = max(max_y, y1, y2)

    width  = max_x - min_x
    height = max_y - min_y
    if width < min_size or height < min_size:
        return None                                                      # <-- Too small to be the standards border

    bottom, top, left, right = [], [], [], []                            # <-- Spans lying along each bbox edge

    for i in indices:
        x1, y1, x2, y2 = segments[i]
        horizontal = abs(y2 - y1) <= tol
        vertical   = abs(x2 - x1) <= tol

        if horizontal:
            span = (min(x1, x2), max(x1, x2))
            if abs(y1 - min_y) <= tol:
                bottom.append(span)
            if abs(y1 - max_y) <= tol:
                top.append(span)
        if vertical:
            span = (min(y1, y2), max(y1, y2))
            if abs(x1 - min_x) <= tol:
                left.append(span)
            if abs(x1 - max_x) <= tol:
                right.append(span)

    if not (na_span_covers(bottom, min_x, max_x, tol) and
            na_span_covers(top,    min_x, max_x, tol) and
            na_span_covers(left,   min_y, max_y, tol) and
            na_span_covers(right,  min_y, max_y, tol)):
        return None                                                      # <-- Not a closed rectangular outline

    return {
        'minX' : min_x, 'minY' : min_y,
        'maxX' : max_x, 'maxY' : max_y,
        'area' : width * height,
    }


def na_span_covers(spans, lo, hi, tol):
    """True when the given 1D spans, merged, cover [lo, hi] end to end."""
    if not spans:
        return False
    spans   = sorted(spans)
    covered = 0.0
    cur_lo, cur_hi = spans[0]
    for s_lo, s_hi in spans[1:]:
        if s_lo <= cur_hi + tol:
            cur_hi = max(cur_hi, s_hi)                                   # <-- Overlapping or touching: extend
        else:
            covered += cur_hi - cur_lo                                   # <-- Gap: bank the run and start a new one
            cur_lo, cur_hi = s_lo, s_hi
    covered += cur_hi - cur_lo
    return covered >= (hi - lo) - tol


def na_filter_and_dedupe_rings(rings, settings):
    """
    Drop rings below the minimum size and collapse duplicates (the same
    rectangle drawn twice), which would otherwise spawn a duplicate region.
    """
    min_size = settings['region_min_size']
    tol      = settings['join_tolerance']
    kept     = []
    seen     = set()

    for ring in rings:
        if (ring['maxX'] - ring['minX']) < min_size or (ring['maxY'] - ring['minY']) < min_size:
            continue
        quant = max(tol, 1e-9)
        key   = (round(ring['minX'] / quant), round(ring['minY'] / quant),
                 round(ring['maxX'] / quant), round(ring['maxY'] / quant))
        if key in seen:
            continue                                                     # <-- Same rectangle already recorded
        seen.add(key)
        kept.append(ring)

    return kept


def na_group_segments_by_connectivity(segments, join_tol):
    """
    Union-find over segment endpoints — segments sharing an endpoint (within
    join_tol) land in the same group. A spatial hash keeps this linear, and the
    tolerance stays far below the ring offset so nested rings never merge.

    Returns:
        dict[int, list[int]]: { rootIndex: [segmentIndex, ...] }
    """
    parent    = list(range(len(segments)))
    cell_size = max(join_tol, 1e-9)
    buckets   = {}                                                       # <-- (cellX, cellY) -> [(x, y, segIndex), ...]

    def na_find_root(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]                                # <-- Path halving
            i = parent[i]
        return i

    def na_union(a, b):
        ra, rb = na_find_root(a), na_find_root(b)
        if ra != rb:
            parent[rb] = ra

    for index, (x1, y1, x2, y2) in enumerate(segments):
        for (px, py) in ((x1, y1), (x2, y2)):
            cx = int(math.floor(px / cell_size))
            cy = int(math.floor(py / cell_size))
            for dx in (-1, 0, 1):                                        # <-- 3x3 sweep so cell-boundary points still meet
                for dy in (-1, 0, 1):
                    for (qx, qy, other) in buckets.get((cx + dx, cy + dy), ()):
                        if abs(qx - px) <= join_tol and abs(qy - py) <= join_tol:
                            na_union(index, other)
            buckets.setdefault((cx, cy), []).append((px, py, index))

    groups = {}
    for index in range(len(segments)):
        groups.setdefault(na_find_root(index), []).append(index)
    return groups

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Nesting Validation — Rings to Regions
# -----------------------------------------------------------------------------

def na_chain_rings_into_regions(rings, settings):
    """
    Chain rings largest-to-smallest. A chain only qualifies as a standards
    region when it is at least Ring__MinCount deep and EVERY edge gap between
    consecutive rings sits inside the configured offset window — which is what
    separates a genuine offset border from an unrelated yellow rectangle.

    Returns:
        list[dict]: [{ minX, minY, maxX, maxY, ringCount, ringOffsets }, ...]
    """
    min_off   = settings['ring_min_offset']
    max_off   = settings['ring_max_offset']
    min_count = settings['ring_min_count']
    pad       = settings['containment_pad']

    ordered  = sorted(rings, key=lambda r: r['area'], reverse=True)
    consumed = set()
    regions  = []

    for i, outer in enumerate(ordered):
        if i in consumed:
            continue

        chain   = [i]
        offsets = []
        current = outer

        for j in range(i + 1, len(ordered)):
            if j in consumed:
                continue
            gaps = na_ring_edge_gaps(current, ordered[j])
            if all(min_off <= g <= max_off for g in gaps):
                chain.append(j)
                offsets.append(round(sum(gaps) / 4.0, 1))                # <-- Mean gap, for the log/report
                current = ordered[j]

        if len(chain) < min_count:
            continue

        consumed.update(chain)
        regions.append({
            # float() coercion: ezdxf hands back numpy scalars for polyline
            # vertices, which read badly in logs and leak an array type into the
            # JSON payload. Plain floats from here on.
            'minX'        : float(outer['minX'] - pad),
            'minY'        : float(outer['minY'] - pad),
            'maxX'        : float(outer['maxX'] + pad),
            'maxY'        : float(outer['maxY'] + pad),
            'ringCount'   : len(chain),
            'ringOffsets' : [float(o) for o in offsets],
        })

    return regions


def na_ring_edge_gaps(outer, inner):
    """Return the (left, right, bottom, top) edge gaps from `outer` to `inner`."""
    return (
        inner['minX'] - outer['minX'],                                   # <-- Left
        outer['maxX'] - inner['maxX'],                                   # <-- Right
        inner['minY'] - outer['minY'],                                   # <-- Bottom
        outer['maxY'] - inner['maxY'],                                   # <-- Top
    )

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Containment Tests — Is This Entity Inside a Standards Region?
# -----------------------------------------------------------------------------

def na_point_in_regions(x, y, regions):
    """True when the point falls inside any standards region."""
    for r in regions:
        if r['minX'] <= x <= r['maxX'] and r['minY'] <= y <= r['maxY']:
            return True
    return False


def na_extent_in_regions(extent, regions):
    """True when an (minX, minY, maxX, maxY) extent is fully inside any region."""
    if extent is None:
        return False                                                     # <-- Unknown extent — process it as normal
    min_x, min_y, max_x, max_y = extent
    for r in regions:
        if (min_x >= r['minX'] and max_x <= r['maxX'] and
                min_y >= r['minY'] and max_y <= r['maxY']):
            return True
    return False


def na_entity_in_regions(entity, regions):
    """
    True when an entity lies wholly inside a standards region.

    INSERTs are judged on their insertion point alone — deliberately, because
    the whole point of this filter is to skip block references BEFORE the
    expensive virtual_entities() explosion. Exploded children are re-tested
    individually by the DXF engine, so an insert whose base point sits outside
    the border still has its standards geometry filtered out.
    """
    if not regions:
        return False

    if entity.dxftype() == 'INSERT':
        try:
            return na_point_in_regions(entity.dxf.insert.x, entity.dxf.insert.y, regions)
        except Exception:
            return False

    return na_extent_in_regions(na_entity_extent(entity), regions)


def na_entity_extent(entity):
    """
    Cheap 2D extent for an entity — no flattening, no explosion. Returns
    (minX, minY, maxX, maxY), or None when the type has no cheap extent (which
    makes the containment test fail safe and the entity import as normal).
    """
    etype = entity.dxftype()

    try:
        if etype == 'LINE':
            s, e = entity.dxf.start, entity.dxf.end
            return (min(s.x, e.x), min(s.y, e.y), max(s.x, e.x), max(s.y, e.y))

        if etype in ('CIRCLE', 'ARC'):
            c, r = entity.dxf.center, entity.dxf.radius
            return (c.x - r, c.y - r, c.x + r, c.y + r)                  # <-- Full-circle extent bounds any arc of it

        if etype == 'ELLIPSE':
            c     = entity.dxf.center
            major = entity.dxf.major_axis
            rx    = math.hypot(major.x, major.y)
            return (c.x - rx, c.y - rx, c.x + rx, c.y + rx)              # <-- Major radius bounds both axes

        if etype == 'LWPOLYLINE':
            return na_points_extent([(p[0], p[1]) for p in entity.get_points()])

        if etype == 'POLYLINE':
            return na_points_extent([(v.dxf.location.x, v.dxf.location.y) for v in entity.vertices])

        if etype == 'SPLINE':
            pts = list(getattr(entity, 'control_points', []) or [])       # <-- Control hull bounds the curve
            if not pts:
                pts = list(getattr(entity, 'fit_points', []) or [])
            return na_points_extent([(p[0], p[1]) for p in pts])

        if etype in ('SOLID', 'TRACE'):
            pts = []
            for attr in ('vtx0', 'vtx1', 'vtx2', 'vtx3'):
                v = entity.dxf.get(attr, None)
                if v is not None:
                    pts.append((v.x, v.y))
            return na_points_extent(pts)

        if etype == 'POINT':
            p = entity.dxf.location
            return (p.x, p.y, p.x, p.y)

        if etype in ('TEXT', 'MTEXT', 'ATTRIB'):
            p = entity.dxf.insert
            return (p.x, p.y, p.x, p.y)                                  # <-- Insert point only; good enough to place it

        if etype == 'HATCH':
            return na_hatch_extent(entity)

        if etype == 'IMAGE':
            p = entity.dxf.insert
            return (p.x, p.y, p.x, p.y)

    except Exception:
        return None                                                      # <-- Any surprise geometry imports as normal

    return None


def na_points_extent(points):
    """Extent of a point list, or None when there are none."""
    if not points:
        return None
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return (min(xs), min(ys), max(xs), max(ys))


def na_hatch_extent(entity):
    """
    Approximate a HATCH extent from its boundary paths without flattening arcs —
    polyline vertices directly, arc edges via centre +/- radius.
    """
    points = []
    for path in entity.paths:
        if hasattr(path, 'vertices'):
            points.extend((v[0], v[1]) for v in path.vertices)
            continue
        for edge in getattr(path, 'edges', ()):
            type_name = str(getattr(getattr(edge, 'type', None), 'name', getattr(edge, 'type', ''))).upper()
            # 'SPLINE' contains 'LINE' — test it first or spline edges hit the
            # line handler and throw (SplineEdge has no .start)
            if 'SPLINE' in type_name:
                pts = (list(getattr(edge, 'fit_points', None) or ())
                       or list(getattr(edge, 'control_points', None) or ()))
                points.extend((p[0], p[1]) for p in pts)                 # <-- Control hull bounds the curve
            elif 'ELLIPSE' in type_name:
                cx, cy = edge.center[0], edge.center[1]
                mx, my = edge.major_axis[0], edge.major_axis[1]
                r      = math.hypot(mx, my)                              # <-- Major radius bounds both axes
                points.append((cx - r, cy - r))
                points.append((cx + r, cy + r))
            elif 'ARC' in type_name:
                cx, cy = edge.center[0], edge.center[1]
                r      = getattr(edge, 'radius', 0.0) or 0.0
                points.append((cx - r, cy - r))
                points.append((cx + r, cy + r))
            elif 'LINE' in type_name:
                points.append((edge.start[0], edge.start[1]))
                points.append((edge.end[0],   edge.end[1]))
    return na_points_extent(points)

# endregion -------------------------------------------------------------------
