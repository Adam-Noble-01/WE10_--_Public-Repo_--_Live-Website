#!/usr/bin/env python3
# =============================================================================
# NOBLE ARCHITECTURE - CAD AUDIT TOOLS DWG CONVERSION
# =============================================================================
#
# FILE      : Na__LocalServer__DwgConversion__.py
# MODULE    : LocalServer.DwgConversion
# AUTHOR    : Adam Noble - Noble Architecture
# PURPOSE   : Converts DWG files to DXF — ezdwg primary, ODA File Converter fallback
# CREATED   : 07-Jul-2026
#
# DESCRIPTION:
# - na_convert_dwg_to_dxf(dwg_path) returns (dxf_path | None, error_message).
# - PRIMARY: ezdwg library, run in an ISOLATED SUBPROCESS with a watchdog timeout.
#   Subprocess isolation means a crash or hang inside the Rust core can never
#   take down or freeze the Flask server — the worst case is a timeout error
#   reported cleanly back to the browser.
# - FALLBACK: ODA File Converter CLI subprocess if installed (path from config).
# - Timeout and DXF version are read from Config__DwgConversion in the app config.
#
# DWG CONVERSION LIBRARY:
# - ezdwg — https://pypi.org/project/ezdwg/  (MIT, Rust core + Python API)
# - API: ezdwg.to_dxf(source, output_path, dxf_version='R2010') -> ConvertResult
# - Verified installed version: 0.9.0
#
# ODA FILE CONVERTER (optional fallback):
# - Download: https://www.opendesign.com/guestfiles/oda_file_converter
# - Configure Config__DwgConversion.OdaConverter__ExePath if installed.
#
# -----------------------------------------------------------------------------
#
# DEVELOPMENT LOG:
# 19-Aug-2026 - Version 0.5.0
# - OdaConverter__AuditFiles and OdaConverter__RecurseSubfolders are now READ.
#   Both were config keys that na_load_conversion_settings never returned, so
#   the ODA command line hardcoded audit=1 — a full repair pass on every
#   fallback conversion, unskippable. Audit now defaults OFF; turn it back on
#   if a legacy DWG will not convert cleanly.
#
# 19-Aug-2026 - Version 0.4.0
# - CONVERSION CACHE: an identical DWG converted earlier is now reused instead
#   of reconverting, which previously cost the full multi-minute conversion on
#   every re-import of the same drawing. Keyed on the DWG's CONTENT (the upload
#   rewrites the file each time, so mtime cannot be used) plus the target DXF
#   versions, and additionally on the converted DXF's own size/mtime so an
#   in-place edit of the working file (image purge, hard delete) forces a fresh
#   conversion rather than handing back a pruned file.
#   Disable with Config__DwgConversion.Cache__ReuseConvertedDxf = false.
#
# 07-Jul-2026 - Version 0.3.0
# - ezdwg conversion moved to an isolated subprocess with configurable timeout.
# - Conversion functions now return (path, error) tuples for precise UI errors.
# - ODA fallback attempted automatically when ezdwg fails or is missing.
#
# 07-Jul-2026 - Version 0.2.0
# - Replaced ODA File Converter subprocess stub with ezdwg Python API.
#
# 07-Jul-2026 - Version 0.1.0
# - Initial scaffold release — subprocess call stubbed.
#
# =============================================================================

import os
import sys
import glob
import json
import time
import shutil
import hashlib
import subprocess


# #region ---------------------------------------------------------------------
# REGION | Cancellation Support
# -----------------------------------------------------------------------------

class Na__DwgConversion__Cancelled(Exception):
    """Raised internally when a conversion subprocess is cancelled by the user."""
    pass


def _na_run_cancellable(cmd, timeout_s, cancel_event):
    """
    Run a subprocess, polling a cancel event so the user can abort mid-conversion.

    Terminates the child process on cancellation or timeout rather than blocking
    the whole request until completion.

    Args:
        cmd          (list): Command + args to execute.
        timeout_s    (int) : Hard watchdog timeout in seconds.
        cancel_event       : threading.Event (or None) signalling cancellation.

    Returns:
        tuple(int, str, str): (returncode, stdout, stderr).

    Raises:
        Na__DwgConversion__Cancelled : if the cancel event fires.
        subprocess.TimeoutExpired    : if the watchdog timeout elapses.
    """
    proc  = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    start = time.time()

    while True:
        try:
            out, err = proc.communicate(timeout=0.4)                    # <-- Short poll slice
            return proc.returncode, out, err
        except subprocess.TimeoutExpired:
            if cancel_event is not None and cancel_event.is_set():       # <-- User pressed Cancel
                _na_terminate_process(proc)
                raise Na__DwgConversion__Cancelled()
            if time.time() - start > timeout_s:                          # <-- Watchdog exceeded
                _na_terminate_process(proc)
                raise subprocess.TimeoutExpired(cmd, timeout_s)


def _na_terminate_process(proc):
    """Best-effort terminate → kill of a child process."""
    try:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()                                                 # <-- Force kill if it ignores terminate
    except Exception:
        pass

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Module Constants
# -----------------------------------------------------------------------------

_DEFAULT_ODA_PATH   = r'C:\Program Files\ODA\ODAFileConverter\ODAFileConverter.exe'  # <-- Optional ODA fallback path
_DEFAULT_ODA_VER    = 'ACAD2018'                                         # <-- Target DXF version for ODA fallback
_DEFAULT_EZDWG_VER  = 'R2010'                                            # <-- ezdwg DXF output version
_DEFAULT_TIMEOUT_S  = 180                                                # <-- Watchdog timeout for conversion subprocess
_DEFAULT_REUSE_DXF  = True                                               # <-- Reuse an identical earlier conversion instead of redoing it
_DEFAULT_ODA_AUDIT  = False                                              # <-- ODA audit/repair pass — real time cost, off unless a file needs it
_DEFAULT_ODA_RECURSE = False                                             # <-- ODA subfolder recursion (scratch input folder holds one file)
_CONFIG_PATH        = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    '02__AppData', 'Na__AppData__AppConfig__.json'
)

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Primary Conversion Entry Point
# -----------------------------------------------------------------------------

def na_convert_dwg_to_dxf(dwg_path, cancel_event=None):
    """
    Convert a DWG file to DXF. Tries ezdwg first, then ODA File Converter.

    Args:
        dwg_path     (str): Absolute path to the source .dwg file.
        cancel_event      : threading.Event (or None) signalling cancellation.

    Returns:
        tuple(str | None, str): (output DXF path, '') on success,
                                (None, human-readable error) on failure.
                                On cancellation returns (None, '__cancelled__').
    """
    if not os.path.isfile(dwg_path):
        return None, f"Source DWG not found: {dwg_path}"

    settings = na_load_conversion_settings()
    errors   = []

    # CACHE CHECK — an identical DWG converted earlier is reused as-is
    cached = na_find_cached_conversion(dwg_path, settings)
    if cached:
        print(f"[Na__DwgConversion] Reusing cached conversion: {os.path.basename(cached)}")
        return cached, ''                                               # <-- Skips the whole converter subprocess

    try:
        # ATTEMPT 1 — ezdwg in isolated subprocess
        dxf_path, err = na_convert_dwg_via_ezdwg(dwg_path, settings, cancel_event)
        if dxf_path:
            na_record_conversion_fingerprint(dwg_path, dxf_path, settings)
            return dxf_path, ''
        errors.append(f"ezdwg: {err}")

        # ATTEMPT 2 — ODA File Converter fallback
        dxf_path, err = na_convert_dwg_via_oda(dwg_path, settings, cancel_event)
        if dxf_path:
            na_record_conversion_fingerprint(dwg_path, dxf_path, settings)
            return dxf_path, ''
        errors.append(f"ODA: {err}")

    except Na__DwgConversion__Cancelled:
        print("[Na__DwgConversion] Conversion cancelled by user")
        return None, '__cancelled__'                                    # <-- Sentinel understood by the pipeline

    combined = ' | '.join(errors)
    print(f"[Na__DwgConversion] All converters failed — {combined}")
    return None, combined

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Conversion Cache — Reuse an Identical Earlier Conversion
# -----------------------------------------------------------------------------

# Converting a large DWG costs minutes, and the temp cache holds the uploaded
# DWG at a fixed path — so re-uploading the same drawing used to pay the full
# conversion again. The upload rewrites the DWG each time, which makes file
# mtimes useless here; the cache is therefore keyed on the DWG's CONTENT.
#
# Alongside every converted DXF we drop a JSON sidecar recording:
#   source — the DWG's content digest, byte size, and target DXF versions
#   output — the converted DXF's own size and mtime as written
#
# BOTH must still match to reuse the cache. The source half catches a different
# or edited DWG and a config change. The output half matters just as much: the
# converted DXF IS the app's working file, and the image-purge and hard-delete
# flows rewrite it in place. Without that check, re-uploading a DWG would hand
# back a previously pruned working file instead of a clean import.

_FINGERPRINT_SUFFIX = '.na-src.json'                                     # <-- Sidecar written beside the converted DXF
_HASH_CHUNK_BYTES   = 1024 * 1024                                        # <-- 1 MB streaming read, constant memory


def na_find_cached_conversion(dwg_path, settings):
    """
    Return the path of a previously converted DXF that still matches this exact
    source DWG, the current conversion settings, and its own recorded output
    state — or None when there is no usable cache.
    """
    if not settings['reuse_converted_dxf']:
        return None                                                      # <-- Cache disabled in config

    dxf_path     = na_conversion_output_path(dwg_path)
    sidecar_path = dxf_path + _FINGERPRINT_SUFFIX

    if not (os.path.isfile(dxf_path) and os.path.isfile(sidecar_path)):
        return None
    try:
        with open(sidecar_path, 'r', encoding='utf-8') as f:
            recorded = json.load(f)
    except Exception:
        return None

    if recorded.get('source') != na_source_fingerprint(dwg_path, settings):
        return None                                                      # <-- Different DWG, or settings changed
    if recorded.get('output') != na_output_fingerprint(dxf_path):
        print("[Na__DwgConversion] Working DXF changed since conversion — reconverting")
        return None                                                      # <-- Working file was edited in place

    return dxf_path


def na_record_conversion_fingerprint(dwg_path, dxf_path, settings):
    """Write the sidecar that lets a later upload of the same DWG reuse this DXF."""
    if not settings['reuse_converted_dxf']:
        return
    try:
        payload = {
            'source' : na_source_fingerprint(dwg_path, settings),
            'output' : na_output_fingerprint(dxf_path),
        }
        with open(dxf_path + _FINGERPRINT_SUFFIX, 'w', encoding='utf-8') as f:
            json.dump(payload, f)
    except Exception as err:
        print(f"[Na__DwgConversion] Could not record conversion fingerprint (harmless): {err}")


def na_source_fingerprint(dwg_path, settings):
    """
    Cache key for a source DWG: content digest, byte size, and the target DXF
    versions. The upload rewrites the DWG on every import, so mtime is useless
    here — the digest is what makes "same drawing again" detectable.
    """
    digest = hashlib.blake2b(digest_size=16)
    size   = 0
    with open(dwg_path, 'rb') as f:
        while True:
            chunk = f.read(_HASH_CHUNK_BYTES)
            if not chunk:
                break
            size += len(chunk)
            digest.update(chunk)
    return f"{digest.hexdigest()}|{size}|{settings['ezdwg_dxf_version']}|{settings['oda_dxf_version']}"


def na_output_fingerprint(dxf_path):
    """
    Cheap identity of the converted DXF as it was written. Any in-place edit to
    the working file (image purge, hard delete) changes this and invalidates the
    cache — no hashing, so it stays free even on a 100 MB DXF.
    """
    stat = os.stat(dxf_path)
    return f"{stat.st_size}|{stat.st_mtime_ns}"


def na_conversion_output_path(dwg_path):
    """The DXF path a conversion of this DWG writes to (both converters agree on this)."""
    return os.path.splitext(dwg_path)[0] + '.dxf'

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | ezdwg Conversion (Isolated Subprocess + Watchdog Timeout)
# -----------------------------------------------------------------------------

def na_convert_dwg_via_ezdwg(dwg_path, settings, cancel_event=None):
    """
    Run ezdwg.to_dxf in a separate Python process so a hang or native crash
    cannot affect the Flask server. Returns (dxf_path | None, error_message).

    Raises Na__DwgConversion__Cancelled if the cancel event fires.
    """
    output_path = na_conversion_output_path(dwg_path)                   # <-- Output DXF alongside source DWG
    timeout_s   = settings['ezdwg_timeout_s']
    dxf_version = settings['ezdwg_dxf_version']

    worker_code = (
        "import sys, ezdwg\n"
        "src, out, ver = sys.argv[1], sys.argv[2], sys.argv[3]\n"
        "ezdwg.to_dxf(src, out, dxf_version=ver)\n"
        "print('OK')\n"
    )

    cmd = [sys.executable, '-c', worker_code, dwg_path, output_path, dxf_version]

    try:
        print(f"[Na__DwgConversion] ezdwg converting (timeout {timeout_s}s): {os.path.basename(dwg_path)}")
        returncode, _stdout, stderr = _na_run_cancellable(cmd, timeout_s, cancel_event)
    except subprocess.TimeoutExpired:
        return None, f"conversion timed out after {timeout_s}s (large or complex DWG — raise Ezdwg__TimeoutSeconds in app config)"
    except Na__DwgConversion__Cancelled:
        raise                                                           # <-- Propagate to na_convert_dwg_to_dxf
    except Exception as err:
        return None, f"subprocess launch error: {err}"

    if returncode != 0:
        stderr_tail = (stderr or '').strip().splitlines()
        detail      = stderr_tail[-1] if stderr_tail else 'unknown error'
        if 'ModuleNotFoundError' in detail:
            return None, "ezdwg is not installed — run: pip install \"ezdwg[dxf]\""
        return None, detail

    if not os.path.isfile(output_path):
        return None, "ezdwg ran but produced no output file"

    print(f"[Na__DwgConversion] ezdwg conversion successful: {os.path.basename(output_path)}")
    return output_path, ''

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | ODA File Converter Fallback
# -----------------------------------------------------------------------------

def na_convert_dwg_via_oda(dwg_path, settings, cancel_event=None):
    """
    Fallback: convert via ODA File Converter CLI if installed.

    ODA CLI: ODAFileConverter <InputFolder> <OutputFolder> <Version> <Type> <Recurse> <Audit>

    ODA operates on FOLDERS and refuses when output folder == input folder, so
    the source DWG is isolated in a dedicated input folder and converted into a
    separate output folder. The resulting DXF is then relocated beside the
    original working file and the scratch folders are removed.

    Returns (dxf_path | None, error_message).
    Raises Na__DwgConversion__Cancelled if the cancel event fires.
    """
    oda_exe     = na_resolve_oda_exe_path(settings['oda_exe_path'])      # <-- Config path first, then auto-detect versioned installs
    dxf_version = settings['oda_dxf_version']

    if not oda_exe:
        return None, ("ODA File Converter not found. Install the free ODA File Converter "
                      "(opendesign.com/guestfiles/oda_file_converter) — it handles legacy DWG "
                      "versions (e.g. R12/AC1009) that ezdwg cannot read. No config edit needed; "
                      "standard install locations are auto-detected on the next upload")

    base_name     = os.path.splitext(os.path.basename(dwg_path))[0]      # <-- DWG name without extension
    work_root     = os.path.join(os.path.dirname(dwg_path), '__oda_work__')  # <-- Scratch area beside source
    input_folder  = os.path.join(work_root, 'in')                        # <-- Isolated single-file input folder
    output_folder = os.path.join(work_root, 'out')                       # <-- Distinct output folder (ODA requirement)

    try:
        na_prepare_oda_workspace(dwg_path, input_folder, output_folder)  # <-- Fresh folders + copy of the DWG
    except Exception as err:
        return None, f"ODA workspace setup failed: {err}"

    cmd = [
        oda_exe,
        input_folder,
        output_folder,
        dxf_version,
        'DXF',
        '1' if settings['oda_recurse']     else '0',                     # <-- Recurse into subfolders
        '1' if settings['oda_audit_files'] else '0',                     # <-- Audit/repair pass (slow — off by default)
    ]

    try:
        returncode, _stdout, stderr = _na_run_cancellable(cmd, settings['ezdwg_timeout_s'], cancel_event)
    except subprocess.TimeoutExpired:
        _remove_tree(work_root)
        return None, "ODA converter timed out"
    except Na__DwgConversion__Cancelled:
        _remove_tree(work_root)                                         # <-- Clean scratch before propagating
        raise
    except Exception as err:
        _remove_tree(work_root)
        return None, f"ODA subprocess error: {err}"

    # ODA File Converter frequently returns a non-zero exit code even on success,
    # so success is judged by the presence of the output DXF, not the exit code.
    output_path = os.path.join(output_folder, f"{base_name}.dxf")

    if not os.path.isfile(output_path):
        stderr_tail = (stderr or '').strip()[:200]
        _remove_tree(work_root)
        detail = f" (exit {returncode}: {stderr_tail})" if stderr_tail else f" (exit {returncode})"
        return None, f"ODA ran but produced no output file{detail}"

    final_path = na_conversion_output_path(dwg_path)                     # <-- Relocate beside source, matching ezdwg convention
    try:
        if os.path.isfile(final_path):
            os.remove(final_path)                                       # <-- Overwrite any stale conversion
        os.replace(output_path, final_path)                            # <-- Atomic move within same drive
    except Exception as err:
        _remove_tree(work_root)
        return None, f"ODA output relocation failed: {err}"

    _remove_tree(work_root)                                              # <-- Clean scratch folders
    print(f"[Na__DwgConversion] ODA conversion successful: {os.path.basename(final_path)}")
    return final_path, ''

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Helper Functions
# -----------------------------------------------------------------------------

# ODA installs into a version-numbered folder (e.g. "ODAFileConverter 26.4.0"),
# so the exact path changes per release. These globs auto-detect any version.
_ODA_SEARCH_GLOBS = [
    r'C:\Program Files\ODA\*ODAFileConverter*\ODAFileConverter.exe',    # <-- Default 64-bit install root
    r'C:\Program Files (x86)\ODA\*ODAFileConverter*\ODAFileConverter.exe',  # <-- 32-bit fallback root
    r'C:\Program Files\ODA\ODAFileConverter*\ODAFileConverter.exe',     # <-- Unversioned/legacy layout
]


def na_prepare_oda_workspace(dwg_path, input_folder, output_folder):
    """
    Create clean isolated input/output folders for an ODA conversion and copy
    the single source DWG into the input folder.

    ODA converts an entire folder, so isolating one DWG prevents it from picking
    up unrelated files and guarantees the input/output folders differ.
    """
    _remove_tree(os.path.dirname(input_folder))                         # <-- Wipe any prior scratch workspace
    os.makedirs(input_folder,  exist_ok=True)                           # <-- Fresh input folder
    os.makedirs(output_folder, exist_ok=True)                           # <-- Fresh, distinct output folder
    shutil.copy2(dwg_path, os.path.join(input_folder, os.path.basename(dwg_path)))  # <-- Isolate the source DWG


def _remove_tree(path):
    """Silently remove a directory tree if it exists (best-effort cleanup)."""
    shutil.rmtree(path, ignore_errors=True)


def na_resolve_oda_exe_path(configured_path):
    """
    Resolve the ODA File Converter executable path.

    Order of resolution:
      1. The configured path from app config, if it exists on disk.
      2. Auto-detected version-numbered install folders under Program Files.

    Args:
        configured_path (str): OdaConverter__ExePath value from app config.

    Returns:
        str | None: Absolute path to ODAFileConverter.exe, or None if not found.
    """
    if configured_path and os.path.isfile(configured_path):
        return configured_path                                          # <-- Explicit config path wins

    for pattern in _ODA_SEARCH_GLOBS:
        matches = sorted(glob.glob(pattern), reverse=True)              # <-- Highest version first
        for candidate in matches:
            if os.path.isfile(candidate):
                print(f"[Na__DwgConversion] Auto-detected ODA File Converter: {candidate}")
                return candidate

    return None                                                         # <-- Not installed anywhere known


def na_load_conversion_settings():
    """Load conversion settings from app config JSON, falling back to defaults."""
    try:
        with open(_CONFIG_PATH, 'r', encoding='utf-8') as f:
            config = json.load(f)
        dwg_config = config.get('Config__DwgConversion', {})
    except Exception:
        dwg_config = {}

    return {
        'ezdwg_dxf_version' : dwg_config.get('Ezdwg__OutputDxfVersion',         _DEFAULT_EZDWG_VER),
        'ezdwg_timeout_s'   : dwg_config.get('Ezdwg__TimeoutSeconds',           _DEFAULT_TIMEOUT_S),
        'oda_exe_path'      : dwg_config.get('OdaConverter__ExePath',           _DEFAULT_ODA_PATH),
        'oda_dxf_version'   : dwg_config.get('OdaConverter__OutputDxfVersion',  _DEFAULT_ODA_VER),
        'reuse_converted_dxf': bool(dwg_config.get('Cache__ReuseConvertedDxf', _DEFAULT_REUSE_DXF)),
        'oda_audit_files'   : bool(dwg_config.get('OdaConverter__AuditFiles',       _DEFAULT_ODA_AUDIT)),
        'oda_recurse'       : bool(dwg_config.get('OdaConverter__RecurseSubfolders', _DEFAULT_ODA_RECURSE)),
    }

# endregion -------------------------------------------------------------------
