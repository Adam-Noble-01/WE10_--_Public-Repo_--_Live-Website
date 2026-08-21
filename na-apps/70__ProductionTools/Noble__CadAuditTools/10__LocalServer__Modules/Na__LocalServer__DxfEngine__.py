#!/usr/bin/env python3
# =============================================================================
# NOBLE ARCHITECTURE - CAD AUDIT TOOLS DXF ENGINE
# =============================================================================
#
# FILE      : Na__LocalServer__DxfEngine__.py
# MODULE    : LocalServer.DxfEngine
# AUTHOR    : Adam Noble - Noble Architecture
# PURPOSE   : ezdxf-based DXF parsing (to entity JSON) and entity pruning (save)
# CREATED   : 07-Jul-2026
#
# DESCRIPTION:
# - na_parse_dxf_to_entity_json(dxf_path):
#     Reads a DXF file with ezdxf, iterates modelspace entities, serialises each
#     supported type to a plain dict, and returns the full entity + layer payload.
#     Per-entity hex colours are resolved server-side from ACI values so the
#     frontend requires no ACI colour map.
#     Supported types: LINE, ARC, CIRCLE, LWPOLYLINE, POLYLINE, SPLINE, ELLIPSE,
#                      TEXT, MTEXT, INSERT (exploded), POINT, HATCH, SOLID.
#
# - INSERT EXPLOSION:
#     Block references are exploded server-side via ezdxf virtual_entities() so
#     real block geometry (furniture, trees, cars, symbols) is visible and
#     selectable. Exploded children carry parentHandle = the INSERT handle and
#     a synthetic handle "<parent>:<n>". Deleting the parent handle prunes the
#     whole block reference from the DXF in one operation.
#
# - STANDARDS REGION EXCLUSION:
#     Before anything is serialised, Na__LocalServer__StandardsRegion__ scans for
#     the studio standards-library marker border (three nested rectangles offset
#     ~100mm apart in RGB 250,215,0). Every entity that falls inside it is
#     skipped outright — INSERTs are rejected on their insertion point so the
#     expensive explosion never runs for standards content.
#
# - na_prune_and_save_dxf(source_dxf_path, deleted_handles, output_path):
#     Re-opens the DXF with ezdxf, deletes all entities whose handles appear in
#     the deleted_handles set, then saves the result to output_path.
#
# DEPENDENCY: ezdxf (MIT licence) — pip install ezdxf>=1.4
#
# COORDINATE CONVENTION:
# - All geometry values in the JSON are in raw DXF model-space units.
# - Y is DXF-native (increases upward). The frontend Canvas module negates Y
#   when creating SVG elements to flip to screen-space (Y increases downward).
#
# -----------------------------------------------------------------------------
#
# DEVELOPMENT LOG:
# 21-Aug-2026 - Version 0.5.2
# - THE ACTUAL SKETCHUP KILLER FOUND (proven by live import bisection in
#   SketchUp 2026): the Importer copies LAYER table entries verbatim,
#   including the SOURCE document's plot-style (390), material (347), and 348
#   object handles — objects that are never imported, so the copied entries
#   dangle. AutoCAD/ezdxf/ODA ignore that; SketchUp rejects the entire file.
#   _na_sanitise_imported_layer_entries() now discards those attribs after
#   finalize; ezdxf re-emits its own valid defaults on save. Verified: the
#   identical failing file imports cleanly with only this change.
# - Empty-block INSERT cleanup: inserts whose definition ends up empty (block
#   content the Importer could not copy, or annotation-only blocks emptied by
#   the SketchUp strip) are dropped and the empty definitions purged — they
#   rendered nothing and showed up in SketchUp's summary as ignored X-Refs.
#
# 21-Aug-2026 - Version 0.5.1
# - SKETCHUP IMPORT REGRESSION FIXED: the 0.5.0 clean rebuild shipped every
#   DIMENSION with an EMPTY anonymous geometry block reference (group 2) and no
#   *D blocks at all — ezdxf 1.4's Importer binds copied entities without firing
#   Dimension.post_bind_hook(), so the virtual block content was silently
#   dropped. SketchUp's ODA-based importer rejects the whole file on those
#   dangling references. The export now fires the hook by hand for every
#   imported dimension and runs a final out_doc.audit() so an invalid entity
#   can never ship again.
# - SKETCHUP EXPORT MODE: na_export_audited_dxf(strip_annotations=True) removes
#   annotation/markup entities (TEXT, MTEXT, DIMENSION, LEADER, hatches, etc. —
#   Config__DxfExport.SketchUpStrip__EntityTypes) from modelspace AND from
#   every surviving block definition, producing a geometry-only DXF for clean
#   SketchUp imports.
#
# 19-Aug-2026 - Version 0.5.0
# - STANDARDS REGION EXCLUSION: na_serialise_doc_to_payload now detects the
#   standards-library marker border first and drops every entity inside it —
#   nothing from that region is parsed, exploded, serialised, or sent to the
#   client. Payload gains standardsRegions / standardsSkipped for the UI.
# - na_explode_insert re-tests exploded children against the regions so a block
#   whose base point sits outside the border still has its standards geometry
#   filtered out; an INSERT left with nothing but filtered children is dropped.
# - Entity colour resolution extracted to na_entity_hex_color() so the standards
#   detector and the serialiser resolve display colour through one code path.
#
# 08-Jul-2026 - Version 0.4.0
# - RESILIENT READ: na_read_dxf_document() tries the strict loader, then falls
#   back to ezdxf.recover for files other apps produced (embedded images, minor
#   structural quirks) that previously threw and rendered an EMPTY canvas.
# - EMBEDDED IMAGES: na_scan_doc_for_images / na_strip_images_from_doc plus a new
#   na_parse_dxf_with_image_decision(decision_cb, default_action) flow. On detect,
#   the caller can prompt the user to PURGE the images (removed + working file
#   re-saved) or KEEP them (IMAGE entities serialised to a corner quad + pixel
#   data URI, or a labelled placeholder frame when the raster is unavailable).
#
# 07-Jul-2026 - Version 0.3.0
# - INSERT block references exploded to real geometry (recursive, capped).
# - Added HATCH (boundary paths) and SOLID serialisation.
# - True-colour (RGB) support on entities and layers.
# - SPLINE approximation upgraded to ezdxf flattening.
#
# 07-Jul-2026 - Version 0.2.0
# - Replaced all stubs with full ezdxf implementations.
# - Added server-side ACI colour resolution to hex strings.
# - Added POLYLINE, MTEXT, and INSERT entity serialisers.
# - na_prune_and_save_dxf fully implemented.
#
# 07-Jul-2026 - Version 0.1.0
# - Initial scaffold release — both functions stubbed.
#
# =============================================================================

import os
import json
import gzip
import math
import base64
import hashlib
import mimetypes

from Na__LocalServer__StandardsRegion__ import (
    na_load_standards_settings,                                          # <-- Config__StandardsRegion settings
    na_detect_standards_regions,                                         # <-- Marker-border detection
    na_entity_in_regions,                                                # <-- Per-entity containment test
    na_extent_in_regions,                                                # <-- Per-extent containment test (exploded children)
    na_entity_extent,                                                    # <-- Cheap 2D extent, no flattening
)

try:
    import ezdxf
    _EZDXF_AVAILABLE = True
except ImportError:
    _EZDXF_AVAILABLE = False
    print("[Na__DxfEngine] WARNING: ezdxf is not installed. Run: pip install ezdxf")

# Cap for embedding a referenced raster image as a base64 data URI (keep path).
# Larger images fall back to a labelled placeholder frame so the payload stays sane.
_IMAGE_EMBED_MAX_BYTES = 12 * 1024 * 1024                                # <-- 12 MB per image ceiling


# #region ---------------------------------------------------------------------
# REGION | Entity Payload Trimming
# -----------------------------------------------------------------------------

# A large drawing serialises to tens of megabytes of JSON, and every byte is
# built by the server, pushed over HTTP, and re-parsed by the browser. Two
# cheap, lossless-in-practice reductions:
#
#   ROUNDING — ezdxf hands back full double precision, so a coordinate
#   serialises as "12345.678901234567" (18 chars) when the drawing is in
#   millimetres and nobody can see past the third decimal. Rounding to 3dp is
#   sub-micron on a mm drawing and roughly halves the length of every number.
#
#   DEFAULT OMISSION — see na_serialize_entity: color/linetype are dropped when
#   they hold their BYLAYER defaults.
#
# Both are data-driven from Config__EntityPayload.

def _na_load_payload_settings():
    """Read Config__EntityPayload once at import time (defaults if absent)."""
    try:
        import json as _json
        with open(_PAYLOAD_CONFIG_PATH, 'r', encoding='utf-8') as f:
            section = _json.load(f).get('Config__EntityPayload', {}) or {}
    except Exception:
        section = {}
    try:
        places = int(section.get('Coordinates__DecimalPlaces', 3))
    except Exception:
        places = 3
    omit  = bool(section.get('OmitDefaultColorAndLinetype', True))
    cache = bool(section.get('Cache__ReuseParsedPayload', True))
    return places, omit, cache


_PAYLOAD_CONFIG_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    '02__AppData', 'Na__AppData__AppConfig__.json'
)

_PAYLOAD_DECIMALS, _PAYLOAD_OMIT_DEFAULTS, _PAYLOAD_CACHE_ENABLED = _na_load_payload_settings()
_PAYLOAD_CACHE_SUFFIX  = '.na-payload.json.gz'                           # <-- Parsed-payload cache beside the working DXF
_PAYLOAD_CACHE_VERSION = 'v3'                                            # <-- v3: MTEXT/TEXT plain_text + rotation                                            # <-- In the cache key: a code fix that changes what
                                                                         #     the payload contains must bump this, or files
                                                                         #     cached by the old code would be served as-is


def na_payload_cache_path(dxf_path):
    """Path of the parsed-payload cache sitting beside a working DXF."""
    return dxf_path + _PAYLOAD_CACHE_SUFFIX


def _na_payload_cache_key(dxf_path):
    """
    Identity of a parse result: the DXF's own size and mtime, plus a digest of
    every setting that changes what the payload contains. Editing the working
    file, or changing the standards/payload config, invalidates the cache.
    """
    stat = os.stat(dxf_path)
    signature = '|'.join([
        _PAYLOAD_CACHE_VERSION,                                          # <-- Bump on any code change to payload semantics
        str(_PAYLOAD_DECIMALS),
        str(_PAYLOAD_OMIT_DEFAULTS),
        repr(sorted(na_load_standards_settings().items())),
    ])
    digest = hashlib.blake2b(signature.encode('utf-8'), digest_size=8).hexdigest()
    return f"{stat.st_size}|{stat.st_mtime_ns}|{digest}"


def na_read_payload_cache(dxf_path):
    """
    Return a previously parsed payload for this exact working DXF, or None.

    Parsing a large DXF costs minutes — reading back a gzipped payload costs
    seconds — so a re-import of an unchanged file skips ezdxf, block explosion,
    and serialisation entirely.
    """
    if not _PAYLOAD_CACHE_ENABLED:
        return None

    cache_path = na_payload_cache_path(dxf_path)
    if not os.path.isfile(cache_path):
        return None

    try:
        with gzip.open(cache_path, 'rt', encoding='utf-8') as f:
            record = json.load(f)
        if record.get('key') != _na_payload_cache_key(dxf_path):
            return None                                                  # <-- File or settings changed since caching
        payload = record.get('payload')
        if not isinstance(payload, dict) or 'entities' not in payload:
            return None
    except Exception as err:
        print(f"[Na__DxfEngine] Payload cache unreadable, reparsing: {err}")
        return None

    print(f"[Na__DxfEngine] Reusing cached parse — {payload.get('entityCount', 0)} entities, no DXF read")
    return payload


def na_write_payload_cache(dxf_path, payload):
    """
    Store a parsed payload beside its working DXF.

    Skipped for drawings carrying embedded images: those take an interactive
    keep/purge decision on load, and serving a cached payload would silently
    reuse an earlier answer instead of asking.
    """
    if not _PAYLOAD_CACHE_ENABLED:
        return
    if payload.get('imageCount', 0):
        return                                                           # <-- Interactive image decision must still run

    cache_path = na_payload_cache_path(dxf_path)
    try:
        record = {'key': _na_payload_cache_key(dxf_path), 'payload': payload}
        with gzip.open(cache_path, 'wt', encoding='utf-8', compresslevel=1) as f:
            json.dump(record, f)
        size_mb = os.path.getsize(cache_path) / (1024 * 1024)
        print(f"[Na__DxfEngine] Parsed payload cached ({size_mb:.1f} MB) — reload will skip the DXF parse")
    except Exception as err:
        print(f"[Na__DxfEngine] Could not write payload cache (harmless): {err}")
        try:
            os.remove(cache_path)                                        # <-- Never leave a half-written cache behind
        except Exception:
            pass


def na_round_geometry(value):
    """
    Recursively round every float in a geometry structure to the configured
    decimal places. Ints, strings, and bools pass through untouched.

    A negative Coordinates__DecimalPlaces disables rounding entirely.
    """
    if _PAYLOAD_DECIMALS < 0:
        return value                                                     # <-- Rounding disabled in config

    if isinstance(value, float):
        return round(value, _PAYLOAD_DECIMALS)
    if isinstance(value, dict):
        return {k: na_round_geometry(v) for k, v in value.items()}
    if isinstance(value, list):
        return [na_round_geometry(v) for v in value]
    return value

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | ACI Colour Map (AutoCAD Colour Index → Hex)
# -----------------------------------------------------------------------------

# Standard ACI colours (indices 1–9 and 250–255). Colours 10–249 are expanded
# spectrum values; the fallback is a light grey for unrecognised indices.
# Full 256-entry map — covers the entire ACI palette used in production DXF files.
_ACI_MAP = {
    0   : '#000000',    # Block colour (resolves to BYBLOCK — treated as black)
    1   : '#ff0000',    # Red
    2   : '#ffff00',    # Yellow
    3   : '#00ff00',    # Green
    4   : '#00ffff',    # Cyan
    5   : '#0000ff',    # Blue
    6   : '#ff00ff',    # Magenta
    7   : '#ffffff',    # White / Black (display-dependent; use white for dark canvas)
    8   : '#808080',    # Dark Grey
    9   : '#c0c0c0',    # Light Grey
    10  : '#ff0000', 11 : '#ffaaaa', 12 : '#bd0000', 13 : '#bd7e7e',
    14  : '#810000', 15 : '#815656', 16 : '#680000', 17 : '#684545',
    18  : '#4f0000', 19 : '#4f3535', 20 : '#ff3f00', 21 : '#ffbfaa',
    22  : '#bd2e00', 23 : '#bd8d7e', 24 : '#811f00', 25 : '#816056',
    26  : '#681900', 27 : '#684e45', 28  : '#4f1300', 29 : '#4f3b35',
    30  : '#ff7f00', 31 : '#ffd4aa', 32 : '#bd5e00', 33 : '#bd9d7e',
    34  : '#814000', 35 : '#816b56', 36 : '#683400', 37 : '#685645',
    38  : '#4f2700', 39 : '#4f4235', 40 : '#ffbf00', 41 : '#ffeaaa',
    42  : '#bd8d00', 43 : '#bdad7e', 44 : '#816000', 45 : '#817656',
    46  : '#684e00', 47 : '#685f45', 48 : '#4f3b00', 49 : '#4f4935',
    50  : '#ffff00', 51 : '#ffffaa', 52 : '#bdbd00', 53 : '#bdbd7e',
    54  : '#818100', 55 : '#818156', 56 : '#686800', 57 : '#686845',
    58  : '#4f4f00', 59 : '#4f4f35', 60 : '#bfff00', 61 : '#eaffaa',
    62  : '#8dbd00', 63 : '#adbd7e', 64 : '#608100', 65 : '#768156',
    66  : '#4e6800', 67 : '#5f6845', 68 : '#3b4f00', 69 : '#494f35',
    70  : '#7fff00', 71 : '#d4ffaa', 72 : '#5ebd00', 73 : '#9dbd7e',
    74  : '#408100', 75 : '#6b8156', 76 : '#346800', 77 : '#566845',
    78  : '#274f00', 79 : '#424f35', 80 : '#3fff00', 81 : '#bfffaa',
    82  : '#2ebd00', 83 : '#8dbd7e', 84 : '#1f8100', 85 : '#608156',
    86  : '#196800', 87 : '#4e6845', 88  : '#134f00', 89 : '#3b4f35',
    90  : '#00ff00', 91 : '#aaffaa', 92 : '#00bd00', 93 : '#7ebd7e',
    94  : '#008100', 95 : '#568156', 96 : '#006800', 97 : '#456845',
    98  : '#004f00', 99 : '#354f35',100 : '#00ff3f',101 : '#aaffbf',
    102 : '#00bd2e',103 : '#7ebd8d',104 : '#00811f',105 : '#568160',
    106 : '#006819',107 : '#45684e',108 : '#004f13',109 : '#354f3b',
    110 : '#00ff7f',111 : '#aaffd4',112 : '#00bd5e',113 : '#7ebd9d',
    114 : '#008140',115 : '#56816b',116 : '#006834',117 : '#456856',
    118 : '#004f27',119 : '#354f42',120 : '#00ffbf',121 : '#aaffea',
    122 : '#00bd8d',123 : '#7ebdad',124 : '#008160',125 : '#568176',
    126 : '#00684e',127 : '#45685f',128 : '#004f3b',129 : '#354f49',
    130 : '#00ffff',131 : '#aaffff',132 : '#00bdbd',133 : '#7ebdbd',
    134 : '#008181',135 : '#568181',136 : '#006868',137 : '#456868',
    138 : '#004f4f',139 : '#354f4f',140 : '#00bfff',141 : '#aaeaff',
    142 : '#008dbd',143 : '#7eadbd',144 : '#006081',145 : '#567681',
    146 : '#004e68',147 : '#455f68',148 : '#003b4f',149 : '#35494f',
    150 : '#007fff',151 : '#aad4ff',152 : '#005ebd',153 : '#7e9dbd',
    154 : '#004081',155 : '#566b81',156 : '#003468',157 : '#455668',
    158 : '#00274f',159 : '#35424f',160 : '#003fff',161 : '#aabfff',
    162 : '#002ebd',163 : '#7e8dbd',164 : '#001f81',165 : '#566081',
    166 : '#001968',167 : '#454e68',168 : '#00134f',169 : '#353b4f',
    170 : '#0000ff',171 : '#aaaaff',172 : '#0000bd',173 : '#7e7ebd',
    174 : '#000081',175 : '#565681',176 : '#000068',177 : '#454568',
    178 : '#00004f',179 : '#35354f',180 : '#3f00ff',181 : '#bfaaff',
    182 : '#2e00bd',183 : '#8d7ebd',184 : '#1f0081',185 : '#605681',
    186 : '#190068',187 : '#4e4568',188 : '#13004f',189 : '#3b354f',
    190 : '#7f00ff',191 : '#d4aaff',192 : '#5e00bd',193 : '#9d7ebd',
    194 : '#400081',195 : '#6b5681',196 : '#340068',197 : '#564568',
    198 : '#27004f',199 : '#42354f',200 : '#bf00ff',201 : '#eaaaff',
    202 : '#8d00bd',203 : '#ad7ebd',204 : '#600081',205 : '#765681',
    206 : '#4e0068',207 : '#5f4568',208 : '#3b004f',209 : '#49354f',
    210 : '#ff00ff',211 : '#ffaaff',212 : '#bd00bd',213 : '#bd7ebd',
    214 : '#810081',215 : '#815681',216 : '#680068',217 : '#684568',
    218 : '#4f004f',219 : '#4f354f',220 : '#ff00bf',221 : '#ffaaea',
    222 : '#bd008d',223 : '#bd7ead',224 : '#810060',225 : '#815676',
    226 : '#68004e',227 : '#68455f',228 : '#4f003b',229 : '#4f3549',
    230 : '#ff007f',231 : '#ffaad4',232 : '#bd005e',233 : '#bd7e9d',
    234 : '#810040',235 : '#81566b',236 : '#680034',237 : '#684556',
    238 : '#4f0027',239 : '#4f3542',240 : '#ff003f',241 : '#ffaabf',
    242 : '#bd002e',243 : '#bd7e8d',244 : '#81001f',245 : '#815660',
    246 : '#680019',247 : '#68454e',248 : '#4f0013',249 : '#4f353b',
    250 : '#333333',251 : '#505050',252 : '#696969',253 : '#828282',
    254 : '#bebebe',255 : '#f0f0f0',
}
_ACI_FALLBACK = '#a0a0a0'                                               # <-- Fallback for unknown ACI indices

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Resilient Document Reader
# -----------------------------------------------------------------------------

def na_read_dxf_document(dxf_path):
    """
    Open a DXF resiliently.

    ezdxf.readfile() is strict — it raises DXFStructureError on files that other
    applications produce with minor structural quirks (a very common trait of
    drawings that carry raster IMAGE / IMAGEDEF data). That exception used to be
    swallowed into an empty response, so the canvas loaded blank. Here we fall
    back to ezdxf.recover, the tolerant loader built exactly for foreign files.

    Args:
        dxf_path (str): Absolute path to a DXF file.

    Returns:
        ezdxf.document.Drawing

    Raises:
        Exception if even the recover loader cannot open the file.
    """
    try:
        return ezdxf.readfile(dxf_path)                                 # <-- Fast path for well-formed files
    except Exception as strict_err:
        print(f"[Na__DxfEngine] Strict read failed ({strict_err}); retrying in recover mode…")
        from ezdxf import recover
        doc, auditor = recover.readfile(dxf_path)                       # <-- Tolerant loader for foreign DXF
        if auditor.has_errors:
            print(f"[Na__DxfEngine] Recover salvaged the file with {len(auditor.errors)} unresolved error(s)")
        return doc

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Embedded Image Detection, Purge, and Serialisation
# -----------------------------------------------------------------------------

def na_scan_doc_for_images(doc):
    """
    Return a lightweight list of the raster IMAGE entities in modelspace.

    Returns:
        list[dict]: [ { handle: str, name: str }, ... ]  (empty if none)
    """
    images = []
    try:
        for img in doc.modelspace().query('IMAGE'):
            name = ''
            try:
                idef = img.image_def
                if idef is not None:
                    name = os.path.basename((idef.dxf.get('filename', '') or '').replace('\\', '/'))
            except Exception:
                name = ''
            images.append({'handle': img.dxf.handle, 'name': name or 'image'})
    except Exception as err:
        print(f"[Na__DxfEngine] Image scan error: {err}")
    return images


def na_strip_images_from_doc(doc):
    """
    Delete every raster IMAGE entity from modelspace (the PURGE choice).

    Orphaned IMAGEDEF objects are intentionally left in the OBJECTS table —
    removing them by hand risks leaving dangling reactors and an invalid file;
    they are harmless and cost nothing once no IMAGE references them.

    Returns:
        int: number of IMAGE entities removed.
    """
    msp    = doc.modelspace()
    images = list(msp.query('IMAGE'))
    for img in images:
        try:
            msp.delete_entity(img)
        except Exception as err:
            print(f"[Na__DxfEngine] Could not delete image {img.dxf.handle}: {err}")
    if images:
        print(f"[Na__DxfEngine] Purged {len(images)} embedded image(s) from modelspace")
    return len(images)


def na_serialize_image(entity, layer_colors, dxf_dir):
    """
    Serialise a raster IMAGE entity to a corner-quad geometry record (KEEP choice).

    The IMAGE stores a lower-left insertion point plus per-pixel U/V vectors and a
    pixel size; from those we derive the four model-space corners (which handle
    rotation and non-uniform scaling for free). When the referenced raster can be
    located on disk it is embedded as a base64 data URI; otherwise the frontend
    draws a labelled placeholder frame at the correct position and size.

    Returns:
        dict | None
    """
    try:
        insert = entity.dxf.insert                                      # <-- Lower-left corner (model space)
        u_px   = entity.dxf.u_pixel                                     # <-- One-pixel vector along image X
        v_px   = entity.dxf.v_pixel                                     # <-- One-pixel vector along image Y
        size   = entity.dxf.image_size                                  # <-- (width_px, height_px)

        px_w = float(size[0])
        px_h = float(size[1])
        wx, wy = u_px[0] * px_w, u_px[1] * px_w                         # <-- Full width vector
        hx, hy = v_px[0] * px_h, v_px[1] * px_h                         # <-- Full height vector

        ox, oy = insert[0], insert[1]
        corners = [
            {'x': ox,           'y': oy},                               # <-- P0 lower-left
            {'x': ox + wx,      'y': oy + wy},                          # <-- P1 lower-right
            {'x': ox + wx + hx, 'y': oy + wy + hy},                     # <-- P2 upper-right
            {'x': ox + hx,      'y': oy + hy},                          # <-- P3 upper-left
        ]

        name, href = na_resolve_image_data(entity, dxf_dir)

        layer     = entity.dxf.get('layer',    '0')
        color_aci = entity.dxf.get('color',    256)
        hex_color = na_resolve_hex_color(color_aci, layer, layer_colors)

        return {
            'handle'   : entity.dxf.handle,
            'type'     : 'IMAGE',
            'layer'    : layer,
            'color'    : color_aci,
            'hexColor' : hex_color,                                     # <-- Placeholder frame / label colour
            'linetype' : entity.dxf.get('linetype', 'BYLAYER'),
            'geometry' : {
                'corners'     : corners,
                'widthUnits'  : math.hypot(wx, wy),
                'heightUnits' : math.hypot(hx, hy),
                'pxWidth'     : px_w,
                'pxHeight'    : px_h,
                'name'        : name,
                'href'        : href,                                   # <-- data URI or None
                'present'     : href is not None,                       # <-- False → draw placeholder frame
            },
        }
    except Exception as err:
        print(f"[Na__DxfEngine] Image serialisation error for {getattr(entity.dxf, 'handle', '?')}: {err}")
        return None


def na_resolve_image_data(entity, dxf_dir):
    """
    Resolve an IMAGE's raster to (display_name, data_uri_or_None).

    Tries the IMAGEDEF filename as an absolute path, then alongside the DXF, then
    just its basename beside the DXF. Anything larger than the embed ceiling, or
    not found, resolves to (name, None) so the frontend shows a placeholder.
    """
    filename = ''
    try:
        idef = entity.image_def
        if idef is not None:
            filename = idef.dxf.get('filename', '') or ''
    except Exception:
        filename = ''

    normalised = filename.replace('\\', '/')
    name       = os.path.basename(normalised) if normalised else 'image'

    candidates = []
    if normalised:
        if os.path.isabs(normalised):
            candidates.append(normalised)                              # <-- Authoring-machine absolute path
        candidates.append(os.path.join(dxf_dir, os.path.basename(normalised)))  # <-- Beside the DXF (common)
        candidates.append(os.path.join(dxf_dir, normalised))          # <-- Relative reference preserved

    for path in candidates:
        try:
            if path and os.path.isfile(path) and os.path.getsize(path) <= _IMAGE_EMBED_MAX_BYTES:
                mime = mimetypes.guess_type(path)[0] or 'image/png'
                with open(path, 'rb') as handle:
                    encoded = base64.b64encode(handle.read()).decode('ascii')
                return name, f"data:{mime};base64,{encoded}"
        except Exception:
            continue                                                   # <-- Try the next candidate path

    return name, None

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | DXF Parsing — DXF File to Entity JSON
# -----------------------------------------------------------------------------

def na_serialise_doc_to_payload(doc, dxf_path, image_action='keep'):
    """
    Walk an already-open DXF document's modelspace and build the entity/layer
    payload. INSERTs are exploded to real geometry; raster IMAGEs are serialised
    only when image_action == 'keep' (a 'purge' run has already removed them).

    Anything sitting inside a detected standards-library region is skipped before
    any serialisation work happens — that content never reaches the payload.

    Returns:
        dict: { entityCount, layers, entities, standardsRegions, standardsSkipped }
    """
    msp      = doc.modelspace()
    entities = []
    layers   = {}
    dxf_dir  = os.path.dirname(dxf_path) if dxf_path else ''

    layer_colors = na_build_layer_color_table(doc)                      # <-- ACI and hex colours per layer

    # STANDARDS REGION SCAN — one cheap pass before any expensive parsing
    standards_regions = na_detect_standards_regions(
        doc, lambda ent: na_entity_hex_color(ent, layer_colors)         # <-- Shared display-colour resolution
    )
    standards_skipped = 0

    def na_register_layer(layer_name):
        if layer_name not in layers:
            aci      = layer_colors.get(layer_name, {}).get('aci', 7)
            hex_col  = layer_colors.get(layer_name, {}).get('hex', '#ffffff')
            visible  = layer_colors.get(layer_name, {}).get('visible', True)
            layers[layer_name] = {
                'color'       : aci,                                    # <-- ACI index for reference
                'hexColor'    : hex_col,                                # <-- Resolved hex for frontend display
                'entityCount' : 0,
                'visible'     : visible,
            }
        layers[layer_name]['entityCount'] += 1

    # Serialise each modelspace entity — INSERTs explode, IMAGEs become quads
    for entity in msp:
        etype = entity.dxftype()

        # STANDARDS GATE — first test of every loop, before any parsing work
        if standards_regions and na_entity_in_regions(entity, standards_regions):
            standards_skipped += 1
            continue                                                   # <-- Inside the standards border: does not exist

        if etype == 'IMAGE':
            if image_action == 'purge':
                continue                                               # <-- Already stripped; guard for safety
            image_record = na_serialize_image(entity, layer_colors, dxf_dir)
            if image_record:
                entities.append(image_record)
                na_register_layer(image_record['layer'])
            continue

        if etype == 'INSERT':
            insert_record, children, dropped = na_explode_insert(
                entity, layer_colors, standards_regions
            )
            standards_skipped += dropped
            if insert_record and dropped and not children:
                continue                                               # <-- Every child was standards content — drop the INSERT too
            if insert_record:
                entities.append(insert_record)
                na_register_layer(insert_record['layer'])
                entities.extend(children)                               # <-- Children carry parentHandle
            continue

        serialised = na_serialize_entity(entity, layer_colors)
        if serialised:
            entities.append(serialised)
            na_register_layer(serialised['layer'])

    if standards_regions:
        print(f"[Na__DxfEngine] Standards region(s): {len(standards_regions)} — "
              f"{standards_skipped} entities excluded from the import")

    print(f"[Na__DxfEngine] Parsed {len(entities)} entities across {len(layers)} layers")
    return {
        'entityCount'      : len(entities),
        'layers'           : layers,
        'entities'         : entities,
        'standardsRegions' : standards_regions,                         # <-- Detected marker-border bounds (may be empty)
        'standardsSkipped' : standards_skipped,                         # <-- Entities never imported from those regions
    }


def na_parse_dxf_with_image_decision(dxf_path, decision_cb=None, default_action='keep'):
    """
    Resilient parse with an optional embedded-image decision hook.

    Flow:
      1. Open the document (strict → recover fallback).
      2. Scan modelspace for raster IMAGE entities.
      3. If images exist and a decision_cb is supplied, call it with the image
         list and honour the returned action:
             'purge' → delete the images, re-save the working DXF, then serialise
             'keep'  → serialise the images as corner quads
             None    → the user cancelled; return (None, 'cancelled')
         With no decision_cb, default_action is used non-interactively.

    Returns:
        tuple(dict | None, str): (payload, status) where status is 'ok' or 'cancelled'.
        The payload carries imageCount / imagesKept / imagesPurged for the UI.
    """
    if not _EZDXF_AVAILABLE:
        return na_empty_response("ezdxf not installed"), 'ok'

    if not os.path.isfile(dxf_path):
        return na_empty_response(f"DXF file not found: {dxf_path}"), 'ok'

    cached = na_read_payload_cache(dxf_path)                            # <-- Unchanged file: skip the whole parse
    if cached is not None:
        na_warm_doc_cache_async(dxf_path)                               # <-- Pre-parse in background so Export is warm
        return cached, 'ok'

    try:
        doc = na_read_dxf_document(dxf_path)                            # <-- Resilient open (recover fallback)
    except Exception as err:
        print(f"[Na__DxfEngine] Read error (strict + recover both failed): {err}")
        return na_empty_response(str(err)), 'ok'

    try:
        images = na_scan_doc_for_images(doc)
        action = default_action

        if images and decision_cb is not None:
            action = decision_cb(images)                               # <-- May block awaiting the user
            if action is None:
                return None, 'cancelled'                               # <-- User cancelled the load
        if action not in ('keep', 'purge'):
            action = 'keep'                                            # <-- Safe non-destructive default

        purged = 0
        if action == 'purge' and images:
            try:
                purged = na_strip_images_from_doc(doc)
                doc.saveas(dxf_path)                                   # <-- Persist the cleaned working file
            except Exception as err:
                print(f"[Na__DxfEngine] Image purge/save failed (continuing): {err}")

        payload = na_serialise_doc_to_payload(doc, dxf_path, image_action=action)
        payload['imageCount']   = len(images)                          # <-- Total images detected in the file
        payload['imagesKept']   = 0 if action == 'purge' else len(images)
        payload['imagesPurged'] = purged
        na_write_payload_cache(dxf_path, payload)                       # <-- Next load of this file is near-instant
        na_stash_parsed_doc(dxf_path, doc)                              # <-- First export skips the file read too
        return payload, 'ok'

    except Exception as err:
        print(f"[Na__DxfEngine] Parse error: {err}")
        return na_empty_response(str(err)), 'ok'


def na_parse_dxf_to_entity_json(dxf_path, image_action='keep'):
    """
    Backward-compatible parse entry point (non-interactive). Delegates to
    na_parse_dxf_with_image_decision with no decision hook.

    Returns:
        dict: { entityCount, layers, entities, imageCount, imagesKept, imagesPurged }
    """
    payload, _status = na_parse_dxf_with_image_decision(
        dxf_path, decision_cb=None, default_action=image_action
    )
    return payload if payload is not None else na_empty_response("parse produced no payload")

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Parsed-Document RAM Cache — Export Without Re-Reading the File
# -----------------------------------------------------------------------------

# Parsing the working DXF is the dominant export cost (~16s on a 111 MB file),
# and the server already paid it once at import. This single-slot cache keeps
# the most recently parsed document in memory, fingerprinted by the file's
# size+mtime, so an export can reuse it instead of re-reading the file.
# RAM cost is real (~6-7x file size; measured 712 MB for a 111 MB DXF), so
# files above SourceCache__MaxFileMb are never pinned.
#
# The export path never mutates the cached document — survivors are FILTERED
# into the fresh output document via Importer.import_entities() — so the slot
# stays valid across any number of exports. Any in-place rewrite of the working
# file (hard delete, image purge) changes the fingerprint and the slot simply
# misses. Single slot only: one drawing is worked on at a time, and holding
# multiple parsed 100 MB documents would be a memory liability.

import threading as _threading

_DOC_CACHE      = {'key': None, 'path': None, 'doc': None}              # <-- Single most-recent parsed document
_DOC_CACHE_LOCK = _threading.Lock()


def _na_doc_cache_settings():
    """Read Config__DxfExport source-cache settings (defaults: on, 512 MB cap)."""
    try:
        with open(_PAYLOAD_CONFIG_PATH, 'r', encoding='utf-8') as f:
            section = json.load(f).get('Config__DxfExport', {}) or {}
    except Exception:
        section = {}
    enabled = bool(section.get('SourceCache__Enabled', True))
    try:
        max_mb = float(section.get('SourceCache__MaxFileMb', 256))
    except Exception:
        max_mb = 256.0
    return enabled, max_mb


def _na_doc_fingerprint(dxf_path):
    """Cheap identity of the on-disk working file (size + mtime)."""
    stat = os.stat(dxf_path)
    return f"{os.path.abspath(dxf_path)}|{stat.st_size}|{stat.st_mtime_ns}"


def na_stash_parsed_doc(dxf_path, doc):
    """
    Offer a freshly parsed document to the RAM slot. Call ONLY when the document
    matches the file on disk exactly (straight after a parse, or after the parse
    path itself re-saved the file).
    """
    enabled, max_mb = _na_doc_cache_settings()
    if not enabled:
        return
    try:
        if os.path.getsize(dxf_path) > max_mb * 1024 * 1024:
            return                                                       # <-- Too large to pin in memory
        key = _na_doc_fingerprint(dxf_path)
    except OSError:
        return
    with _DOC_CACHE_LOCK:
        _DOC_CACHE['key']  = key
        _DOC_CACHE['path'] = os.path.abspath(dxf_path)
        _DOC_CACHE['doc']  = doc
    print(f"[Na__DxfEngine] Parsed document cached in RAM — exports skip the file read")


def na_get_cached_doc(dxf_path):
    """Return the cached document if it still matches the file on disk, else None."""
    enabled, _max_mb = _na_doc_cache_settings()
    if not enabled:
        return None
    try:
        key = _na_doc_fingerprint(dxf_path)
    except OSError:
        return None
    with _DOC_CACHE_LOCK:
        if _DOC_CACHE['key'] == key and _DOC_CACHE['doc'] is not None:
            return _DOC_CACHE['doc']
    return None


_DOC_WARM_INFLIGHT = set()                                               # <-- Paths with a warm parse already running


def na_warm_doc_cache_async(dxf_path):
    """
    Parse the document on a background thread and stash it in the RAM slot.

    Called when an import is served from the payload cache: the import returns
    instantly WITHOUT parsing, which used to leave the slot cold — so the first
    export after a server restart (or after switching drawings) paid the full
    file read. Warming in the background means the document is ready by the
    time the user has looked at the drawing and reached for Export.
    """
    enabled, max_mb = _na_doc_cache_settings()
    if not enabled:
        return
    try:
        if os.path.getsize(dxf_path) > max_mb * 1024 * 1024:
            return                                                       # <-- Too large to pin in memory
    except OSError:
        return
    if na_get_cached_doc(dxf_path) is not None:
        return                                                           # <-- Already warm for this exact file state

    path_key = os.path.abspath(dxf_path)
    with _DOC_CACHE_LOCK:
        if path_key in _DOC_WARM_INFLIGHT:
            return                                                       # <-- A warm parse is already running
        _DOC_WARM_INFLIGHT.add(path_key)

    def _na_warm_worker():
        try:
            print(f"[Na__DxfEngine] Warming document cache in background: {os.path.basename(dxf_path)}")
            doc = na_read_dxf_document(dxf_path)
            na_stash_parsed_doc(dxf_path, doc)
        except Exception as err:
            print(f"[Na__DxfEngine] Background warm failed (export will parse on demand): {err}")
        finally:
            with _DOC_CACHE_LOCK:
                _DOC_WARM_INFLIGHT.discard(path_key)

    _threading.Thread(target=_na_warm_worker, daemon=True, name='NaDocWarm').start()

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | DXF Export — Audited, Standards-Free, Rebuilt Clean
# -----------------------------------------------------------------------------

# The working DXF carries everything the source file had: the full standards
# library (~94% of a typical studio drawing) plus thousands of block definitions
# nothing references once that content is gone. na_prune_and_save_dxf() only
# removes the user's deleted handles, so an export used to re-write the whole
# 100 MB file even when the viewer showed a few thousand scheme entities.
#
# The export path now:
#   1. Deletes the user's soft-deleted handles (as before).
#   2. Deletes everything inside the standards marker border — same detection
#      as import, so the export matches what the viewer shows.
#   3. REBUILDS the drawing into a fresh document via ezdxf's Importer, which
#      copies only the surviving entities plus the resources they actually
#      reference (block definitions, layers, linetypes, text/dim styles).
#      Deleting unused blocks in place was tried and abandoned: dynamic-block
#      extension dictionaries and dead blocks referencing each other keep
#      thousands of definitions "referenced" (measured 30.8 MB vs 5.6 MB).
#
# MEASURED on Test-01__PurgeCad: 106 MB / 30s  →  5.6 MB / 21s, audit-clean.
#
# TRADE-OFFS of the rebuild (all config-gated, see Config__DxfExport):
#   - Modelspace only — paperspace layouts are not carried into the export.
#   - DIMASSOC objects are dropped → dimensions become non-associative.
#   - Types the Importer cannot copy (REGION, MULTILEADER) are skipped and
#     REPORTED in the result rather than silently lost.
# Set RebuildCleanDocument=false to fall back to writing the full document.

_EXPORT_HEADER_VARS = (
    '$INSUNITS', '$MEASUREMENT', '$LUNITS', '$AUNITS', '$LTSCALE',
    '$EXTMIN', '$EXTMAX', '$LIMMIN', '$LIMMAX', '$DIMSCALE',
)                                                                        # <-- Header vars a receiver needs to interpret the file

_EXPORT_STRIP_DEFAULTS = (
    'TEXT', 'MTEXT', 'DIMENSION', 'LEADER', 'MULTILEADER', 'MLEADER',
    'ATTDEF', 'ATTRIB', 'TOLERANCE', 'ACAD_TABLE', 'WIPEOUT', 'POINT',
    'HATCH',
)                                                                        # <-- Annotation/markup types the SketchUp export removes


def _na_load_export_settings():
    """Read Config__DxfExport (defaults: both behaviours on)."""
    try:
        with open(_PAYLOAD_CONFIG_PATH, 'r', encoding='utf-8') as f:
            section = json.load(f).get('Config__DxfExport', {}) or {}
    except Exception:
        section = {}
    strip_types = section.get('SketchUpStrip__EntityTypes', None)
    if not isinstance(strip_types, list) or not strip_types:
        strip_types = list(_EXPORT_STRIP_DEFAULTS)
    return {
        'exclude_standards' : bool(section.get('ExcludeStandardsRegion',  True)),
        'rebuild_clean'     : bool(section.get('RebuildCleanDocument',    True)),
        'strip_types'       : {str(t).upper() for t in strip_types},
    }


def _na_strip_annotations_from_blocks(doc, strip_types):
    """
    Purge annotation entities from every REAL block definition in a document
    (layout pseudo-blocks are skipped — modelspace is handled by the survivor
    filter). Blocks arrive via surviving INSERTs, and furniture/symbol blocks
    routinely carry their own labels — "strip ANY text" has to reach inside.

    Returns:
        int: number of entities removed from block definitions.
    """
    removed = 0
    for block in doc.blocks:
        if getattr(block.block_record, 'is_any_layout', False):
            continue                                                     # <-- *Model_Space / *Paper_Space content is the layout itself
        victims = [e for e in block if e.dxftype() in strip_types]
        for entity in victims:
            try:
                block.delete_entity(entity)
                removed += 1
            except Exception as err:
                print(f"[Na__DxfEngine] Could not strip {entity.dxftype()} from block '{block.name}': {err}")
    return removed


def _na_sanitise_imported_layer_entries(out_doc):
    """
    Discard dangling object-pointer attributes from Importer-copied LAYER
    table entries.

    The Importer copies layer records verbatim — including the SOURCE
    document's plot-style handle (group 390), material handle (347), and the
    rarely-used 348 pointer. Those objects are never imported, so in the
    rebuilt document the handles point at nothing. AutoCAD-family readers and
    ezdxf ignore the dangle; SketchUp 2026's DXF importer follows the pointers
    and rejects the ENTIRE file with a bare "Import Failed".

    Bisected empirically on a failing export (21-Aug-2026): the identical file
    imports cleanly into SketchUp once these attribs are dropped. ezdxf simply
    omits the optional groups on save, which every tested reader accepts.

    Returns:
        int: number of layer entries cleaned.
    """
    cleaned = 0
    for layer in out_doc.layers:
        dirty = False
        for attrib in ('plotstyle_handle', 'material_handle', 'unknown1'):
            if layer.dxf.hasattr(attrib):
                layer.dxf.discard(attrib)
                dirty = True
        if dirty:
            cleaned += 1
    return cleaned


def _na_drop_empty_block_inserts(out_doc):
    """
    Remove INSERTs that reference an EMPTY block definition, then purge those
    empty definitions.

    A block can end up empty two ways: the Importer drops content it cannot
    copy (REGION etc.), and the SketchUp strip removes annotation-only content.
    The leftover INSERT renders nothing anywhere, and SketchUp flags it as an
    ignored X-Ref in its import summary — noise that reads like data loss.

    Returns:
        tuple(int, int): (inserts removed, empty block definitions purged)
    """
    layout_names = {'*Model_Space', '*Paper_Space'}
    empty_blocks = {b.name for b in out_doc.blocks
                    if not getattr(b.block_record, 'is_any_layout', False)
                    and b.name not in layout_names
                    and len(b) == 0}
    if not empty_blocks:
        return 0, 0

    inserts_removed = 0
    spaces = [out_doc.modelspace()]
    spaces.extend(b for b in out_doc.blocks
                  if not getattr(b.block_record, 'is_any_layout', False))
    for space in spaces:
        for ins in list(space.query('INSERT')):
            if ins.dxf.get('name', '') in empty_blocks:
                try:
                    space.delete_entity(ins)
                    inserts_removed += 1
                except Exception as err:
                    print(f"[Na__DxfEngine] Could not drop empty-block INSERT {ins.dxf.handle}: {err}")

    blocks_purged = 0
    for name in empty_blocks:
        try:
            out_doc.blocks.delete_block(name, safe=True)                 # <-- safe=True refuses if still referenced
            blocks_purged += 1
        except Exception:
            pass                                                         # <-- Still referenced somewhere — leave it
    return inserts_removed, blocks_purged


def _na_repair_dimension_geometry_blocks(out_doc):
    """
    Rebuild the anonymous *D geometry block of every DIMENSION the Importer
    copied into out_doc.

    EZDXF 1.4 GAP: Dimension.copy() discards the geometry block reference and
    stashes the block's content on the copy as virtual_block_content, expecting
    post_bind_hook() to recreate a real *D block when the copy is bound to a
    document. The Importer binds copies via entitydb.add()/add_entity(), which
    never fires that hook — so every exported DIMENSION arrived with group 2
    empty and no *D blocks. That violates the DXF spec (group 2 is required)
    and ODA-based importers (SketchUp) reject the entire file on it.

    Returns:
        int: number of dimensions whose geometry block was rebuilt.
    """
    repaired = 0
    spaces   = [out_doc.modelspace()]
    spaces.extend(b for b in out_doc.blocks
                  if not getattr(b.block_record, 'is_any_layout', False))  # <-- Dims nested in imported blocks break the same way
    for space in spaces:
        for dim in space.query('DIMENSION'):
            if getattr(dim, 'virtual_block_content', None):
                dim.post_bind_hook()                                     # <-- Creates the *D block, sets dim.dxf.geometry
                repaired += 1
    return repaired


def na_export_audited_dxf(source_dxf_path, deleted_handles, output_path, strip_annotations=False):
    """
    Write the audited drawing to output_path: user deletions applied, standards
    region excluded, and the document rebuilt clean so the export contains only
    what the drawing actually uses.

    Args:
        strip_annotations (bool): SketchUp mode — additionally remove every
            annotation/markup entity (Config__DxfExport.SketchUpStrip__EntityTypes;
            text, dimensions, leaders, hatches, …) from modelspace and from all
            surviving block definitions, leaving a geometry-only file.

    Returns:
        dict: { userPruned, standardsRemoved, regionCount, entityCount,
                rebuilt, skippedTypes, fileSizeMb,
                annotationsStripped, dimBlocksRepaired, auditFixes }
    """
    if not _EZDXF_AVAILABLE:
        raise RuntimeError("ezdxf is not installed — cannot export DXF")

    settings    = _na_load_export_settings()
    strip_types = settings['strip_types'] if strip_annotations else frozenset()

    # SOURCE DOCUMENT — reuse the in-RAM parse when it still matches the file.
    # The filter-based rebuild below never mutates it, so the slot survives the
    # export and every later export of the same working file skips the read.
    doc = na_get_cached_doc(source_dxf_path)
    if doc is None:
        doc = na_read_dxf_document(source_dxf_path)                      # <-- Resilient open (recover fallback)
        na_stash_parsed_doc(source_dxf_path, doc)
    else:
        print("[Na__DxfEngine] Export using in-RAM document — file read skipped")
    msp = doc.modelspace()

    # EXCLUSION SETS — computed against the UNTOUCHED source document
    handles_to_delete = set(deleted_handles)

    regions      = []
    region_count = 0
    if settings['exclude_standards']:
        layer_colors = na_build_layer_color_table(doc)
        regions      = na_detect_standards_regions(
            doc, lambda ent: na_entity_hex_color(ent, layer_colors)
        )
        region_count = len(regions)

    # SURVIVOR FILTER — one pass, no deletions, source document unchanged
    survivors            = []
    user_pruned          = 0
    standards_removed    = 0
    annotations_stripped = 0
    for entity in msp:
        if entity.dxf.handle in handles_to_delete:
            user_pruned += 1
            continue
        if regions and na_entity_in_regions(entity, regions):
            standards_removed += 1
            continue
        if strip_types and entity.dxftype() in strip_types:
            annotations_stripped += 1                                    # <-- SketchUp mode: annotation never reaches the output
            continue
        survivors.append(entity)

    rebuilt             = False
    skipped_types       = {}
    out_doc             = None
    dim_blocks_repaired = 0

    if settings['rebuild_clean']:
        try:
            from ezdxf.addons import Importer                            # <-- Lazy: only the export path needs it

            before = {}
            for entity in survivors:
                etype = entity.dxftype()
                before[etype] = before.get(etype, 0) + 1

            out_doc  = ezdxf.new(dxfversion=doc.dxfversion)
            importer = Importer(doc, out_doc)
            importer.import_entities(survivors, out_doc.modelspace())    # <-- Copies survivors; source doc untouched
            importer.finalize()                                          # <-- Pulls in required blocks/layers/styles only

            dim_blocks_repaired = _na_repair_dimension_geometry_blocks(out_doc)  # <-- Importer never fires post_bind_hook (SketchUp killer #1)
            layers_cleaned      = _na_sanitise_imported_layer_entries(out_doc)   # <-- Copied layers carry dangling handles (SketchUp killer #2)
            if layers_cleaned:
                print(f"[Na__DxfEngine] Sanitised {layers_cleaned} imported layer entr(y/ies) — dangling plot-style/material handles dropped")

            for var in _EXPORT_HEADER_VARS:
                try:
                    if var in doc.header:
                        out_doc.header[var] = doc.header[var]
                except Exception:
                    pass

            after = {}
            for entity in out_doc.modelspace():
                etype = entity.dxftype()
                after[etype] = after.get(etype, 0) + 1
            skipped_types = {t: n - after.get(t, 0) for t, n in before.items()
                             if n - after.get(t, 0) > 0}                 # <-- Importer-unsupported types (e.g. REGION)
            rebuilt = True
        except Exception as err:
            print(f"[Na__DxfEngine] Clean rebuild failed ({err}) — exporting full document instead")
            out_doc = None

    if out_doc is None:
        # FALLBACK — full-document write. This path MUTATES a document, so it
        # works on its own fresh parse and never touches the RAM-cached copy.
        out_doc = na_read_dxf_document(source_dxf_path)
        out_msp = out_doc.modelspace()
        victims = [e for e in out_msp
                   if e.dxf.handle in handles_to_delete
                   or (regions and na_entity_in_regions(e, regions))
                   or (strip_types and e.dxftype() in strip_types)]
        for entity in victims:
            out_msp.delete_entity(entity)

    if strip_types:
        stripped_in_blocks = _na_strip_annotations_from_blocks(out_doc, strip_types)
        annotations_stripped += stripped_in_blocks                       # <-- Labels inside furniture/symbol blocks count too

    empty_inserts_dropped, _empty_blocks_purged = _na_drop_empty_block_inserts(out_doc)
    if empty_inserts_dropped:
        print(f"[Na__DxfEngine] Dropped {empty_inserts_dropped} INSERT(s) of empty block definitions")

    audit_fixes = 0
    if rebuilt:
        # SAFETY NET — the rebuilt document is small, so a full audit is cheap.
        # Anything irreparable (e.g. a dimension whose geometry block could not
        # be recovered) is removed here rather than shipped to a strict importer.
        # The fallback full-fat document is left as-is: it keeps the source
        # structure that receivers already accepted, and auditing 100+ MB is slow.
        try:
            auditor     = out_doc.audit()
            audit_fixes = len(auditor.fixes)
            if audit_fixes:
                print(f"[Na__DxfEngine] Export audit applied {audit_fixes} automatic fix(es)")
        except Exception as err:
            print(f"[Na__DxfEngine] Export audit skipped ({err})")

    os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
    out_doc.saveas(output_path)

    stats = {
        'userPruned'          : user_pruned,
        'standardsRemoved'    : standards_removed,
        'regionCount'         : region_count,
        'entityCount'         : len(out_doc.modelspace()),
        'rebuilt'             : rebuilt,
        'skippedTypes'        : skipped_types,
        'fileSizeMb'          : round(os.path.getsize(output_path) / (1024 * 1024), 2),
        'annotationsStripped' : annotations_stripped,
        'dimBlocksRepaired'   : dim_blocks_repaired,
        'emptyInsertsDropped' : empty_inserts_dropped,
        'auditFixes'          : audit_fixes,
    }
    print(f"[Na__DxfEngine] Export written — {stats['entityCount']} entities, "
          f"{stats['fileSizeMb']} MB (user pruned {stats['userPruned']}, "
          f"standards removed {stats['standardsRemoved']}, rebuilt={rebuilt}, "
          f"dim blocks repaired {dim_blocks_repaired}, "
          f"annotations stripped {annotations_stripped}, "
          f"skipped={skipped_types or 'none'})")
    return stats

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | DXF Pruning — Remove Deleted Entities and Save
# -----------------------------------------------------------------------------

def na_prune_and_save_dxf(source_dxf_path, deleted_handles, output_path):
    """
    Remove entities with the given handles from the DXF and save to output_path.

    Args:
        source_dxf_path  (str)       : Absolute path to the source DXF.
        deleted_handles  (list[str]) : Entity handle strings to remove.
        output_path      (str)       : Absolute path for the pruned output DXF.

    Returns:
        str: The output_path on success.

    Raises:
        RuntimeError if ezdxf is not installed.
        Exception on ezdxf error or file I/O failure.
    """
    if not _EZDXF_AVAILABLE:
        raise RuntimeError("ezdxf is not installed — cannot prune DXF")

    doc                = na_read_dxf_document(source_dxf_path)          # <-- Resilient open (recover fallback)
    msp                = doc.modelspace()
    handles_to_delete  = set(deleted_handles)                           # <-- O(1) membership test

    # Collect entities marked for deletion in a separate pass to avoid
    # modifying the iterator while iterating.
    entities_to_delete = [
        entity for entity in msp
        if entity.dxf.handle in handles_to_delete
    ]

    for entity in entities_to_delete:
        msp.delete_entity(entity)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    doc.saveas(output_path)

    removed = len(entities_to_delete)
    print(f"[Na__DxfEngine] Saved pruned DXF — {removed} entities removed → {os.path.basename(output_path)}")
    return output_path

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | INSERT Explosion — Block References to Real Geometry
# -----------------------------------------------------------------------------

_INSERT_MAX_CHILDREN   = 5000                                            # <-- Per-insert exploded entity cap
_INSERT_MAX_DEPTH      = 4                                               # <-- Nested block recursion limit


def na_explode_insert(insert_entity, layer_colors, standards_regions=None):
    """
    Explode an INSERT (block reference) into display geometry via ezdxf
    virtual_entities(). Children carry parentHandle = the INSERT handle so the
    frontend selects/deletes the whole block reference as one unit.

    Any exploded child landing inside a standards region is discarded here. The
    caller already rejected inserts whose base point sits inside the border, so
    this only catches the awkward case of a block placed outside the border but
    drawing its content inside it.

    Returns:
        tuple(dict | None, list[dict], int):
            (INSERT record, exploded child records, children dropped as standards)
    """
    parent = na_serialize_entity(insert_entity, layer_colors)
    if parent is None:
        return None, [], 0

    children = []
    dropped  = [0]                                                       # <-- Children discarded as standards content
    counter  = [0]                                                       # <-- Mutable counter shared across recursion

    def na_walk(entity, depth):
        if counter[0] >= _INSERT_MAX_CHILDREN or depth > _INSERT_MAX_DEPTH:
            return
        try:
            virtual_children = list(entity.virtual_entities())
        except Exception as err:
            print(f"[Na__DxfEngine] virtual_entities failed for {entity.dxf.handle}: {err}")
            return

        for child in virtual_children:
            if counter[0] >= _INSERT_MAX_CHILDREN:
                return
            if child.dxftype() == 'INSERT':
                na_walk(child, depth + 1)                                # <-- Recurse into nested blocks
                continue

            if standards_regions and na_extent_in_regions(na_entity_extent(child), standards_regions):
                dropped[0] += 1
                continue                                                 # <-- Block geometry drawn inside the standards border

            serialised = na_serialize_entity(child, layer_colors)
            if serialised:
                counter[0] += 1
                serialised['handle']       = f"{parent['handle']}:{counter[0]}"  # <-- Synthetic child handle
                serialised['parentHandle'] = parent['handle']            # <-- Deletion unit = the INSERT
                children.append(serialised)

    na_walk(insert_entity, 1)

    parent['childCount'] = len(children)                                 # <-- Frontend skips crosshair when > 0
    return parent, children, dropped[0]

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Entity Serialisation
# -----------------------------------------------------------------------------

def na_serialize_entity(entity, layer_colors):
    """
    Convert an ezdxf entity to a plain dict for JSON serialisation.

    Args:
        entity       : An ezdxf entity object from modelspace iteration.
        layer_colors : Dict of { layerName: { aci, hex, visible } } from na_build_layer_color_table.

    Returns:
        dict | None — None if the entity type is unsupported or geometry is absent.
    """
    entity_type = entity.dxftype()
    handle      = entity.dxf.handle
    layer       = entity.dxf.get('layer',    '0')
    color_aci   = entity.dxf.get('color',    256)                       # <-- 256 = BYLAYER
    linetype    = entity.dxf.get('linetype', 'BYLAYER')
    hex_color   = na_entity_hex_color(entity, layer_colors)             # <-- Shared display-colour resolution

    base = {
        'handle'   : handle,
        'type'     : entity_type,
        'layer'    : layer,
        'hexColor' : hex_color,                                         # <-- Pre-resolved hex for frontend
    }

    # PAYLOAD TRIM — color/linetype are read only by the Properties panel, which
    # already falls back to 'BYLAYER' when absent. On a real drawing the vast
    # majority of entities are BYLAYER, so omitting the defaults removes two
    # keys from most of the payload for no loss of information.
    if not _PAYLOAD_OMIT_DEFAULTS or color_aci != 256:
        base['color'] = color_aci
    if not _PAYLOAD_OMIT_DEFAULTS or linetype != 'BYLAYER':
        base['linetype'] = linetype

    geometry = na_extract_geometry(entity, entity_type)
    if geometry is None:
        return None                                                     # <-- Unsupported or degenerate entity

    base['geometry'] = na_round_geometry(geometry)
    return base


def na_extract_geometry(entity, entity_type):
    """
    Extract geometry data from an ezdxf entity as a plain dict.
    Returns None for unsupported entity types.
    """
    try:
        if entity_type == 'LINE':
            return {
                'x1' : entity.dxf.start.x,
                'y1' : entity.dxf.start.y,
                'x2' : entity.dxf.end.x,
                'y2' : entity.dxf.end.y,
            }

        if entity_type == 'ARC':
            return {
                'cx'         : entity.dxf.center.x,
                'cy'         : entity.dxf.center.y,
                'radius'     : entity.dxf.radius,
                'startAngle' : entity.dxf.start_angle,                 # <-- Degrees, CCW from +X axis
                'endAngle'   : entity.dxf.end_angle,
            }

        if entity_type == 'CIRCLE':
            return {
                'cx'     : entity.dxf.center.x,
                'cy'     : entity.dxf.center.y,
                'radius' : entity.dxf.radius,
            }

        if entity_type == 'LWPOLYLINE':
            # get_points() returns [(x, y, start_width, end_width, bulge), ...]
            pts     = list(entity.get_points())
            vertices = [{'x': p[0], 'y': p[1]} for p in pts]
            return {
                'vertices' : vertices,
                'closed'   : bool(entity.closed),                      # <-- ezdxf LWPolyline.closed property
            }

        if entity_type == 'POLYLINE':
            # Legacy POLYLINE — iterate vertex sub-entities
            vertices = []
            for v in entity.vertices:
                vertices.append({'x': v.dxf.location.x, 'y': v.dxf.location.y})
            if not vertices:
                return None
            return {
                'vertices' : vertices,
                'closed'   : bool(entity.dxf.get('flags', 0) & 1),    # <-- Bit 0 = closed flag
            }

        if entity_type == 'TEXT':
            try:
                text = entity.plain_text()                             # <-- Strips %%u / %%d control codes
            except Exception:
                text = entity.dxf.get('text', '')
            return {
                'x'        : entity.dxf.insert.x,
                'y'        : entity.dxf.insert.y,
                'text'     : text,
                'height'   : entity.dxf.get('height',    2.5),
                'rotation' : entity.dxf.get('rotation',  0.0),
            }

        if entity_type == 'MTEXT':
            # plain_text() is the METHOD that strips inline codes ({\L...}, \P);
            # the .text ATTRIBUTE is the raw string — using it leaked formatting
            # codes into the canvas and inflated text hit boxes to match.
            try:
                text = entity.plain_text()                             # <-- Codes stripped, paragraphs become '\n'
            except Exception:
                text = entity.dxf.get('text', '')
            return {
                'x'        : entity.dxf.insert.x,
                'y'        : entity.dxf.insert.y,
                'text'     : text,
                'height'   : entity.dxf.get('char_height', 2.5),
                'rotation' : entity.dxf.get('rotation',    0.0),       # <-- MTEXT rotates too — was never serialised
            }

        if entity_type == 'INSERT':
            return {
                'x'        : entity.dxf.insert.x,
                'y'        : entity.dxf.insert.y,
                'name'     : entity.dxf.name,
                'xscale'   : entity.dxf.get('xscale',   1.0),
                'yscale'   : entity.dxf.get('yscale',   1.0),
                'rotation' : entity.dxf.get('rotation', 0.0),
            }

        if entity_type == 'POINT':
            return {
                'x' : entity.dxf.location.x,
                'y' : entity.dxf.location.y,
            }

        if entity_type == 'SPLINE':
            # Approximate spline via ezdxf flattening (accurate), with
            # fit/control point fallbacks for degenerate splines.
            pts = []
            try:
                pts = [{'x': p.x, 'y': p.y} for p in entity.flattening(distance=0.1, segments=8)]
            except Exception:
                pass
            if not pts and hasattr(entity, 'fit_points') and entity.fit_points:
                pts = [{'x': p[0], 'y': p[1]} for p in entity.fit_points]
            if not pts and hasattr(entity, 'control_points') and entity.control_points:
                pts = [{'x': p[0], 'y': p[1]} for p in entity.control_points]
            if not pts:
                return None
            return {'vertices': pts, 'closed': bool(entity.closed)}   # <-- Rendered as polyline approximation

        if entity_type == 'ELLIPSE':
            cx    = entity.dxf.center.x
            cy    = entity.dxf.center.y
            major = entity.dxf.major_axis                              # <-- Vec3
            ratio = entity.dxf.ratio                                   # <-- minor/major ratio
            rx    = math.sqrt(major.x ** 2 + major.y ** 2)
            ry    = rx * ratio
            rotation = math.degrees(math.atan2(major.y, major.x))     # <-- Major axis angle from +X
            return {
                'cx'       : cx,
                'cy'       : cy,
                'rx'       : rx,
                'ry'       : ry,
                'rotation' : rotation,
                'startParam' : entity.dxf.get('start_param', 0.0),
                'endParam'   : entity.dxf.get('end_param',   6.283185),
            }

        if entity_type == 'HATCH':
            # Serialise boundary paths only — enough to see and select hatching
            paths = []
            for path in entity.paths:
                vertices = na_hatch_path_vertices(path)
                if len(vertices) >= 2:
                    paths.append({'vertices': vertices, 'closed': True})
            if not paths:
                return None
            return {'paths': paths}

        if entity_type in ('SOLID', 'TRACE'):
            # SOLID vertex order is 0,1,3,2 in DXF — reorder for a sane outline
            corners = []
            for attr in ('vtx0', 'vtx1', 'vtx3', 'vtx2'):
                v = entity.dxf.get(attr, None)
                if v is not None:
                    corners.append({'x': v.x, 'y': v.y})
            if len(corners) < 3:
                return None
            return {'vertices': corners, 'closed': True, 'filled': True}

        # Unsupported entity type — skip silently
        return None

    except Exception as err:
        print(f"[Na__DxfEngine] Geometry extraction error for {entity_type}/{entity.dxf.handle}: {err}")
        return None

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Colour Resolution Helpers
# -----------------------------------------------------------------------------

def na_hatch_path_vertices(path):
    """
    Extract an approximate vertex loop from a HATCH boundary path.
    Handles PolylinePath (direct vertices) and EdgePath (line/arc edges).
    """
    vertices = []

    if hasattr(path, 'vertices'):                                        # <-- PolylinePath
        for v in path.vertices:
            vertices.append({'x': v[0], 'y': v[1]})
        return vertices

    if hasattr(path, 'edges'):                                           # <-- EdgePath
        for edge in path.edges:
            edge_type = getattr(edge, 'type', None)
            type_name = str(getattr(edge_type, 'name', str(edge_type))).upper()

            # ORDER MATTERS: 'SPLINE' contains the substring 'LINE', so spline
            # edges MUST be tested first or they hit the line handler and throw
            # ('SplineEdge' has no .start), silently dropping the whole hatch.
            if 'SPLINE' in type_name:
                pts = (list(getattr(edge, 'fit_points', None) or ())
                       or list(getattr(edge, 'control_points', None) or ()))
                for p in pts:                                            # <-- Polyline approximation of the curve
                    vertices.append({'x': p[0], 'y': p[1]})
            elif 'ELLIPSE' in type_name:
                try:
                    cx, cy = edge.center[0], edge.center[1]
                    mx, my = edge.major_axis[0], edge.major_axis[1]
                    rx     = math.hypot(mx, my)
                    ry     = rx * edge.ratio
                    rot    = math.atan2(my, mx)
                    a0     = getattr(edge, 'start_param', 0.0)
                    a1     = getattr(edge, 'end_param', 2 * math.pi)
                    if a1 <= a0:
                        a1 += 2 * math.pi
                    steps = max(4, int((a1 - a0) / (2 * math.pi) * 32))
                    for i in range(steps + 1):
                        t  = a0 + (a1 - a0) * i / steps
                        ex = rx * math.cos(t)
                        ey = ry * math.sin(t)
                        vertices.append({'x': cx + ex * math.cos(rot) - ey * math.sin(rot),
                                         'y': cy + ex * math.sin(rot) + ey * math.cos(rot)})
                except Exception:
                    continue
            elif 'ARC' in type_name:
                try:
                    cx, cy  = edge.center[0], edge.center[1]
                    r       = edge.radius
                    a0      = math.radians(edge.start_angle)
                    a1      = math.radians(edge.end_angle)
                    if a1 <= a0:
                        a1 += 2 * math.pi
                    steps = max(4, int((a1 - a0) / (2 * math.pi) * 32))
                    for i in range(steps + 1):
                        a = a0 + (a1 - a0) * i / steps
                        vertices.append({'x': cx + r * math.cos(a), 'y': cy + r * math.sin(a)})
                except Exception:
                    continue
            elif 'LINE' in type_name:
                vertices.append({'x': edge.start[0], 'y': edge.start[1]})
                vertices.append({'x': edge.end[0],   'y': edge.end[1]})
    return vertices


def na_build_layer_color_table(doc):
    """
    Build a dict of { layerName: { aci: int, hex: str, visible: bool } }
    from the DXF document's layer table. Layer true colour (RGB) wins over ACI.
    """
    table = {}
    for layer in doc.layers:
        aci     = layer.color                                           # <-- Negative = layer is frozen/off
        visible = aci >= 0
        aci_abs = abs(aci)
        hex_col = _ACI_MAP.get(aci_abs, _ACI_FALLBACK)
        rgb     = getattr(layer, 'rgb', None)                           # <-- ezdxf: true colour tuple or None
        if rgb:
            hex_col = f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"
        table[layer.dxf.name] = {
            'aci'     : aci_abs,
            'hex'     : hex_col,
            'visible' : visible,
        }
    return table


def na_entity_hex_color(entity, layer_colors):
    """
    Resolve an entity's DISPLAY colour to a '#rrggbb' string.

    True colour (RGB) wins, otherwise the ACI value is resolved through the
    BYLAYER/BYBLOCK rules. Single code path shared by the serialiser and the
    standards-region marker scan so both agree on what colour an entity is.
    """
    true_color = entity.dxf.get('true_color', None)
    if true_color is not None:
        return f"#{true_color & 0xFFFFFF:06x}"                          # <-- 24-bit RGB packed int → hex

    layer     = entity.dxf.get('layer', '0')
    color_aci = entity.dxf.get('color', 256)                            # <-- 256 = BYLAYER
    return na_resolve_hex_color(color_aci, layer, layer_colors)


def na_resolve_hex_color(color_aci, layer_name, layer_colors):
    """
    Resolve an entity's colour (ACI integer) to a hex string.

    - 256 = BYLAYER  → use the layer's resolved colour
    - 0   = BYBLOCK  → use white (default for standalone audit use)
    - 1–255          → direct ACI lookup
    """
    if color_aci == 256:                                                # <-- BYLAYER
        return layer_colors.get(layer_name, {}).get('hex', _ACI_FALLBACK)
    if color_aci == 0:                                                  # <-- BYBLOCK
        return '#ffffff'
    return _ACI_MAP.get(color_aci, _ACI_FALLBACK)

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Helper Functions
# -----------------------------------------------------------------------------

def na_empty_response(reason=''):
    """Return a valid but empty entity response dict."""
    if reason:
        print(f"[Na__DxfEngine] Empty response — reason: {reason}")
    return {
        'entityCount'      : 0,
        'layers'           : {},
        'entities'         : [],
        'standardsRegions' : [],
        'standardsSkipped' : 0,
    }

# endregion -------------------------------------------------------------------
