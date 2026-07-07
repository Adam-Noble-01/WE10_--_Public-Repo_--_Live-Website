#!/usr/bin/env python3
# =============================================================================
# NOBLE ARCHITECTURE - CAD AUDIT TOOLS DWG CONVERSION
# =============================================================================
#
# FILE      : Na__LocalServer__DwgConversion__.py
# MODULE    : LocalServer.DwgConversion
# AUTHOR    : Adam Noble - Noble Architecture
# PURPOSE   : Wraps ODA File Converter CLI to convert DWG files to DXF
# CREATED   : 07-Jul-2026
#
# DESCRIPTION:
# - Provides na_convert_dwg_to_dxf(dwg_path) which calls ODA File Converter
#   via subprocess to convert a DWG file to DXF in the temp cache folder.
# - Returns the path of the output DXF file, or None on failure.
# - ODA File Converter must be installed on the local machine. The path is
#   read from the app config JSON (Config__DwgConversion.OdaConverter__ExePath).
# - If the config cannot be loaded, falls back to the hardcoded default path.
#
# ODA FILE CONVERTER:
# - Download: https://www.opendesign.com/guestfiles/oda_file_converter
# - Free for personal/commercial use (binary redistribution not allowed).
# - CLI: ODAFileConverter <input_folder> <output_folder> <version> <type> <recurse> <audit>
#
# TODO (follow-up): Wire the actual subprocess call (stub below returns None).
#
# -----------------------------------------------------------------------------
#
# DEVELOPMENT LOG:
# 07-Jul-2026 - Version 0.1.0
# - Initial scaffold release — subprocess call stubbed.
#
# =============================================================================

import os
import json
import subprocess


# #region ---------------------------------------------------------------------
# REGION | Module Constants
# -----------------------------------------------------------------------------

_DEFAULT_ODA_PATH   = r'C:\Program Files\ODA\ODAFileConverter\ODAFileConverter.exe'  # <-- Default install path on Windows
_DEFAULT_DXF_VER    = 'ACAD2018'                                        # <-- Output DXF version
_CONFIG_PATH_REL    = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    '02__AppData', 'Na__AppData__AppConfig__.json'
)

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | DWG to DXF Conversion
# -----------------------------------------------------------------------------

def na_convert_dwg_to_dxf(dwg_path):
    """
    Convert a DWG file to DXF using ODA File Converter.

    Args:
        dwg_path (str): Absolute path to the source .dwg file.

    Returns:
        str | None: Absolute path to the output .dxf file, or None on failure.
    """
    oda_exe, dxf_version = na_load_oda_settings()

    if not os.path.isfile(oda_exe):
        print(f"[Na__DwgConversion] ODA File Converter not found at: {oda_exe}")
        print("  Install from: https://www.opendesign.com/guestfiles/oda_file_converter")
        print("  Then update Config__DwgConversion.OdaConverter__ExePath in Na__AppData__AppConfig__.json")
        return None

    if not os.path.isfile(dwg_path):
        print(f"[Na__DwgConversion] Source DWG file not found: {dwg_path}")
        return None

    input_folder  = os.path.dirname(dwg_path)                          # <-- ODA takes folder paths, not files
    output_folder = input_folder                                        # <-- Output alongside input (in temp cache)

    # TODO: Implement subprocess call
    # ODA CLI signature:
    #   ODAFileConverter <InputFolder> <OutputFolder> <Version> <Type> <Recurse> <Audit>
    # Example:
    #   ODAFileConverter "C:\temp" "C:\temp" ACAD2018 DXF 0 1
    #
    # cmd = [
    #     oda_exe,
    #     input_folder,
    #     output_folder,
    #     dxf_version,
    #     'DXF',
    #     '0',     # No recursion
    #     '1',     # Audit (repair) files
    # ]
    # try:
    #     result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    #     if result.returncode != 0:
    #         print(f"[Na__DwgConversion] ODA converter returned error: {result.stderr}")
    #         return None
    # except subprocess.TimeoutExpired:
    #     print("[Na__DwgConversion] ODA converter timed out after 120 seconds")
    #     return None
    # except Exception as err:
    #     print(f"[Na__DwgConversion] Subprocess error: {err}")
    #     return None

    # Derive expected DXF output path
    base_name    = os.path.splitext(os.path.basename(dwg_path))[0]
    output_path  = os.path.join(output_folder, f"{base_name}.dxf")

    print(f"[Na__DwgConversion] STUB — DWG conversion not yet implemented. Expected output: {output_path}")
    return None                                                         # <-- TODO: Return output_path once subprocess is wired

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Helper Functions
# -----------------------------------------------------------------------------

def na_load_oda_settings():
    """Load ODA converter path and DXF version target from app config JSON."""
    try:
        with open(_CONFIG_PATH_REL, 'r', encoding='utf-8') as f:
            config = json.load(f)
        dwg_config  = config.get('Config__DwgConversion', {})
        oda_path    = dwg_config.get('OdaConverter__ExePath',    _DEFAULT_ODA_PATH)
        dxf_version = dwg_config.get('OdaConverter__OutputDxfVersion', _DEFAULT_DXF_VER)
        return oda_path, dxf_version
    except Exception:
        return _DEFAULT_ODA_PATH, _DEFAULT_DXF_VER                     # <-- Fallback to defaults on config load failure

# endregion -------------------------------------------------------------------
