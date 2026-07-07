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

try:
    import ezdxf
    _EZDXF_AVAILABLE = True
except ImportError:
    _EZDXF_AVAILABLE = False
    print("[Na__DxfEngine] WARNING: ezdxf is not installed. Run: pip install ezdxf")


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
# REGION | DXF Parsing — DXF File to Entity JSON
# -----------------------------------------------------------------------------

def na_parse_dxf_to_entity_json(dxf_path):
    """
    Parse a DXF file and return a dict of entities and layer metadata.

    Args:
        dxf_path (str): Absolute path to a DXF file.

    Returns:
        dict: {
            entityCount : int,
            layers      : { layerName: { color: str, hexColor: str, entityCount: int, visible: bool } },
            entities    : [ { handle, type, layer, color, hexColor, linetype, geometry }, ... ]
        }
    """
    if not _EZDXF_AVAILABLE:
        return na_empty_response("ezdxf not installed")

    if not os.path.isfile(dxf_path):
        return na_empty_response(f"DXF file not found: {dxf_path}")

    try:
        doc      = ezdxf.readfile(dxf_path)
        msp      = doc.modelspace()
        entities = []
        layers   = {}

        # Build layer colour table from the DXF layer table
        layer_colors = na_build_layer_color_table(doc)                  # <-- ACI and hex colours per layer

        def na_register_layer(layer_name):
            if layer_name not in layers:
                aci      = layer_colors.get(layer_name, {}).get('aci', 7)
                hex_col  = layer_colors.get(layer_name, {}).get('hex', '#ffffff')
                visible  = layer_colors.get(layer_name, {}).get('visible', True)
                layers[layer_name] = {
                    'color'       : aci,                                # <-- ACI index for reference
                    'hexColor'    : hex_col,                            # <-- Resolved hex for frontend display
                    'entityCount' : 0,
                    'visible'     : visible,
                }
            layers[layer_name]['entityCount'] += 1

        # Serialise each modelspace entity — INSERTs are exploded to children
        for entity in msp:
            if entity.dxftype() == 'INSERT':
                insert_record, children = na_explode_insert(entity, layer_colors)
                if insert_record:
                    entities.append(insert_record)
                    na_register_layer(insert_record['layer'])
                    entities.extend(children)                            # <-- Children carry parentHandle
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

    except Exception as err:
        print(f"[Na__DxfEngine] Parse error: {err}")
        return na_empty_response(str(err))

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

    doc                = ezdxf.readfile(source_dxf_path)
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
