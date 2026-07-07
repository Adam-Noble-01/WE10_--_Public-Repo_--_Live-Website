#!/usr/bin/env python3
# =============================================================================
# NOBLE ARCHITECTURE - CAD AUDIT TOOLS DXF ENGINE
# =============================================================================
#
# FILE      : Na__LocalServer__DxfEngine__.py
# MODULE    : LocalServer.DxfEngine
# AUTHOR    : Adam Noble - Noble Architecture
# PURPOSE   : ezdxf-based DXF parsing (to JSON) and entity pruning (save)
# CREATED   : 07-Jul-2026
#
# DESCRIPTION:
# - na_parse_dxf_to_entity_json(dxf_path):
#     Reads a DXF file with ezdxf and returns a dict suitable for JSON
#     serialisation to the frontend. Entity geometry is extracted per-type.
#     Supported types: LINE, ARC, CIRCLE, LWPOLYLINE, POLYLINE, TEXT, MTEXT, INSERT.
#
# - na_prune_and_save_dxf(source_dxf_path, deleted_handles, output_path):
#     Re-opens the DXF with ezdxf, deletes entities whose handles appear in
#     the deleted_handles list, and saves the result to output_path.
#
# DEPENDENCY: ezdxf (MIT licence) — pip install ezdxf
#
# TODO (follow-up): Implement actual ezdxf parsing and pruning (stubs below).
#
# -----------------------------------------------------------------------------
#
# DEVELOPMENT LOG:
# 07-Jul-2026 - Version 0.1.0
# - Initial scaffold release — both functions stubbed with correct signatures.
#
# =============================================================================

import os

try:
    import ezdxf
    from ezdxf.math import BoundingBox2d
    _EZDXF_AVAILABLE = True
except ImportError:
    _EZDXF_AVAILABLE = False
    print("[Na__DxfEngine] WARNING: ezdxf is not installed. Run: pip install ezdxf")


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
            layers      : { layerName: { color: int, entityCount: int } },
            entities    : [
                {
                    handle   : str,
                    type     : str,
                    layer    : str,
                    color    : int,
                    linetype : str,
                    geometry : dict,
                },
                ...
            ]
        }
    """
    if not _EZDXF_AVAILABLE:
        return _stub_empty_response("ezdxf not installed")

    if not os.path.isfile(dxf_path):
        return _stub_empty_response(f"DXF file not found: {dxf_path}")

    # TODO: Implement ezdxf parsing
    #
    # try:
    #     doc      = ezdxf.readfile(dxf_path)
    #     msp      = doc.modelspace()
    #     entities = []
    #     layers   = {}
    #
    #     for entity in msp:
    #         entity_dict = na_serialize_entity(entity)
    #         if entity_dict:
    #             entities.append(entity_dict)
    #             layer_name = entity_dict['layer']
    #             if layer_name not in layers:
    #                 layer   = doc.layers.get(layer_name)
    #                 layers[layer_name] = {
    #                     'color'       : layer.color if layer else 7,
    #                     'entityCount' : 0,
    #                 }
    #             layers[layer_name]['entityCount'] += 1
    #
    #     return {
    #         'entityCount' : len(entities),
    #         'layers'      : layers,
    #         'entities'    : entities,
    #     }
    # except Exception as err:
    #     print(f"[Na__DxfEngine] Parse error: {err}")
    #     return _stub_empty_response(str(err))

    print(f"[Na__DxfEngine] STUB — na_parse_dxf_to_entity_json called for: {os.path.basename(dxf_path)}")
    return _stub_empty_response("DXF parsing not yet implemented")

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
        Exception on ezdxf error or file I/O failure.
    """
    if not _EZDXF_AVAILABLE:
        raise RuntimeError("ezdxf is not installed — cannot prune DXF")

    # TODO: Implement ezdxf pruning
    #
    # doc = ezdxf.readfile(source_dxf_path)
    # msp = doc.modelspace()
    # handles_to_delete = set(deleted_handles)
    # entities_to_delete = [
    #     entity for entity in msp
    #     if entity.dxf.handle in handles_to_delete
    # ]
    # for entity in entities_to_delete:
    #     msp.delete_entity(entity)
    #
    # os.makedirs(os.path.dirname(output_path), exist_ok=True)
    # doc.saveas(output_path)
    # print(f"[Na__DxfEngine] Saved pruned DXF ({len(entities_to_delete)} entities removed) to: {output_path}")
    # return output_path

    print(f"[Na__DxfEngine] STUB — na_prune_and_save_dxf called. Would remove {len(deleted_handles)} entities.")
    raise NotImplementedError("DXF pruning not yet implemented")

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Entity Serialisation Helpers (Stub)
# -----------------------------------------------------------------------------

def na_serialize_entity(entity):
    """
    Convert an ezdxf entity object to a plain dict for JSON serialisation.
    Returns None if the entity type is not supported.

    TODO: Implement per-type geometry extraction.
    Supported types: LINE, ARC, CIRCLE, LWPOLYLINE, POLYLINE, TEXT, MTEXT, INSERT.
    """
    # TODO: Implement entity serialisation
    # Example for LINE:
    # if entity.dxftype() == 'LINE':
    #     return {
    #         'handle'   : entity.dxf.handle,
    #         'type'     : 'LINE',
    #         'layer'    : entity.dxf.layer,
    #         'color'    : entity.dxf.get('color', 256),
    #         'linetype' : entity.dxf.get('linetype', 'BYLAYER'),
    #         'geometry' : {
    #             'x1' : entity.dxf.start.x,
    #             'y1' : entity.dxf.start.y,
    #             'x2' : entity.dxf.end.x,
    #             'y2' : entity.dxf.end.y,
    #         }
    #     }
    return None

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Helper Functions
# -----------------------------------------------------------------------------

def _stub_empty_response(reason=''):
    """Return a valid but empty entity response dict for stub use."""
    if reason:
        print(f"[Na__DxfEngine] Stub response reason: {reason}")
    return {
        'entityCount' : 0,
        'layers'      : {},
        'entities'    : [],
    }

# endregion -------------------------------------------------------------------
