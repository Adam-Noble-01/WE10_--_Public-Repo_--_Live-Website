#!/usr/bin/env python3
# =============================================================================
# NOBLE ARCHITECTURE - CAD AUDIT TOOLS PROJECT CACHE
# =============================================================================
#
# FILE      : Na__LocalServer__ProjectCache__.py
# MODULE    : LocalServer.ProjectCache
# AUTHOR    : Adam Noble - Noble Architecture
# PURPOSE   : Filesystem path helpers for the temp cache and saved projects folders
# CREATED   : 07-Jul-2026
#
# DESCRIPTION:
# - Provides na_save_upload_to_temp_cache(): writes an uploaded file to the
#   temp conversion cache folder and returns its absolute path.
# - Provides na_get_save_path(): resolves the output path for a pruned/audited
#   DXF in the saved projects cache folder.
# - Ensures cache directories exist (creates on first use).
# - Cache paths are read from Na__AppData__AppConfig__.json
#   Config__ProjectCache.TempCache__Path and Config__ProjectCache.SavedProjects__Path.
#
# -----------------------------------------------------------------------------
#
# DEVELOPMENT LOG:
# 07-Jul-2026 - Version 0.1.0
# - Initial scaffold release.
#
# =============================================================================

import os
import json


# #region ---------------------------------------------------------------------
# REGION | Module Constants
# -----------------------------------------------------------------------------

_APP_DIR            = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_CONFIG_PATH        = os.path.join(_APP_DIR, '02__AppData', 'Na__AppData__AppConfig__.json')

_DEFAULT_TEMP_CACHE = os.path.join(_APP_DIR, '04__LocalProjectCache', '01__TempCache__DwgToDxfConversions')
_DEFAULT_SAVE_DIR   = os.path.join(_APP_DIR, '04__LocalProjectCache', '02__SavedProjects__AuditedDxfFiles')

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Cache Path Resolution
# -----------------------------------------------------------------------------

def na_save_upload_to_temp_cache(uploaded_file, filename):
    """
    Save a Flask uploaded file to the temp cache directory.

    Args:
        uploaded_file : werkzeug FileStorage object (from request.files).
        filename (str): Original filename from the upload.

    Returns:
        str: Absolute path of the saved file.
    """
    cache_dir  = _resolve_temp_cache_dir()
    os.makedirs(cache_dir, exist_ok=True)                               # <-- Ensure directory exists

    safe_name  = na_sanitise_filename(filename)                         # <-- Strip unsafe characters
    dest_path  = os.path.join(cache_dir, safe_name)

    uploaded_file.save(dest_path)                                       # <-- Write file to disk
    print(f"[Na__ProjectCache] Saved upload to temp cache: {dest_path}")
    return dest_path


def na_get_save_path(output_filename):
    """
    Resolve the full path for a saved/audited DXF output file.

    Args:
        output_filename (str): Desired output filename (e.g. "drawing__audited.dxf").

    Returns:
        str: Absolute path for the output DXF file.
    """
    save_dir   = _resolve_save_dir()
    os.makedirs(save_dir, exist_ok=True)                                # <-- Ensure directory exists

    safe_name  = na_sanitise_filename(output_filename)
    save_path  = os.path.join(save_dir, safe_name)
    return save_path

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Helper Functions
# -----------------------------------------------------------------------------

def _resolve_temp_cache_dir():
    """Load temp cache path from app config, falling back to default."""
    config = _load_config()
    rel_path = config.get('Config__ProjectCache', {}).get('TempCache__Path', '')
    if rel_path:
        return os.path.join(_APP_DIR, rel_path.replace('/', os.sep))
    return _DEFAULT_TEMP_CACHE


def _resolve_save_dir():
    """Load saved projects path from app config, falling back to default."""
    config = _load_config()
    rel_path = config.get('Config__ProjectCache', {}).get('SavedProjects__Path', '')
    if rel_path:
        return os.path.join(_APP_DIR, rel_path.replace('/', os.sep))
    return _DEFAULT_SAVE_DIR


def _load_config():
    """Load the app config JSON. Returns empty dict on failure."""
    try:
        with open(_CONFIG_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def na_sanitise_filename(filename):
    """
    Remove directory traversal characters from a filename.
    Keeps only the base name, strips path separators and null bytes.
    """
    safe = os.path.basename(filename)                                   # <-- Strip any directory components
    safe = safe.replace('\x00', '')                                     # <-- Remove null bytes
    if not safe:
        safe = 'upload.dxf'
    return safe

# endregion -------------------------------------------------------------------
