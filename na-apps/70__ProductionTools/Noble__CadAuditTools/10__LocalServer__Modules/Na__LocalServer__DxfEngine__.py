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
import math
import base64
import mimetypes

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

    Returns:
        dict: { entityCount, layers, entities }
    """
    msp      = doc.modelspace()
    entities = []
    layers   = {}
    dxf_dir  = os.path.dirname(dxf_path) if dxf_path else ''

    layer_colors = na_build_layer_color_table(doc)                      # <-- ACI and hex colours per layer

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

        if etype == 'IMAGE':
            if image_action == 'purge':
                continue                                               # <-- Already stripped; guard for safety
            image_record = na_serialize_image(entity, layer_colors, dxf_dir)
            if image_record:
                entities.append(image_record)
                na_register_layer(image_record['layer'])
            continue

        if etype == 'INSERT':
            insert_record, children = na_explode_insert(entity, layer_colors)
            if insert_record:
                entities.append(insert_record)
                na_register_layer(insert_record['layer'])
                entities.extend(children)                               # <-- Children carry parentHandle
            continue

        serialised = na_serialize_entity(entity, layer_colors)
        if serialised:
            entities.append(serialised)
            na_register_layer(serialised['layer'])

    print(f"[Na__DxfEngine] Parsed {len(entities)} entities across {len(layers)} layers")
    return {
        'entityCount' : len(entities),
        'layers'      : layers,
        'entities'    : entities,
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


def na_explode_insert(insert_entity, layer_colors):
    """
    Explode an INSERT (block reference) into display geometry via ezdxf
    virtual_entities(). Children carry parentHandle = the INSERT handle so the
    frontend selects/deletes the whole block reference as one unit.

    Returns:
        tuple(dict | None, list[dict]): (INSERT record, exploded child records)
    """
    parent = na_serialize_entity(insert_entity, layer_colors)
    if parent is None:
        return None, []

    children = []
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

            serialised = na_serialize_entity(child, layer_colors)
            if serialised:
                counter[0] += 1
                serialised['handle']       = f"{parent['handle']}:{counter[0]}"  # <-- Synthetic child handle
                serialised['parentHandle'] = parent['handle']            # <-- Deletion unit = the INSERT
                children.append(serialised)

    na_walk(insert_entity, 1)

    parent['childCount'] = len(children)                                 # <-- Frontend skips crosshair when > 0
    return parent, children

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

    # Resolve display colour: true colour (RGB) wins, then BYLAYER/ACI resolution
    true_color = entity.dxf.get('true_color', None)
    if true_color is not None:
        hex_color = f"#{true_color & 0xFFFFFF:06x}"                     # <-- 24-bit RGB packed int → hex
    else:
        hex_color = na_resolve_hex_color(color_aci, layer, layer_colors)

    base = {
        'handle'   : handle,
        'type'     : entity_type,
        'layer'    : layer,
        'color'    : color_aci,
        'hexColor' : hex_color,                                         # <-- Pre-resolved hex for frontend
        'linetype' : linetype,
    }

    geometry = na_extract_geometry(entity, entity_type)
    if geometry is None:
        return None                                                     # <-- Unsupported or degenerate entity

    base['geometry'] = geometry
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
            return {
                'x'        : entity.dxf.insert.x,
                'y'        : entity.dxf.insert.y,
                'text'     : entity.dxf.get('text',     ''),
                'height'   : entity.dxf.get('height',    2.5),
                'rotation' : entity.dxf.get('rotation',  0.0),
            }

        if entity_type == 'MTEXT':
            # entity.text strips formatting codes; entity.dxf.text has raw codes
            plain_text = entity.text if hasattr(entity, 'text') else entity.dxf.get('text', '')
            return {
                'x'      : entity.dxf.insert.x,
                'y'      : entity.dxf.insert.y,
                'text'   : plain_text,
                'height' : entity.dxf.get('char_height', 2.5),
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
            type_name = getattr(edge_type, 'name', str(edge_type))
            if 'LINE' in str(type_name).upper():
                vertices.append({'x': edge.start[0], 'y': edge.start[1]})
                vertices.append({'x': edge.end[0],   'y': edge.end[1]})
            elif 'ARC' in str(type_name).upper():
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
        'entityCount' : 0,
        'layers'      : {},
        'entities'    : [],
    }

# endregion -------------------------------------------------------------------
