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
# - Provides na_get_project_version_paths(): per-project subfolder with
#   auto-incrementing __vNNN__ version numbering for DXF + JSON metadata pairs.
# - Provides na_list_saved_projects(): enumerates saved projects and versions.
# - Provides na_write_hot_cache_state(): persists undo/redo snapshots to the
#   hot cache folder, trimming oldest files beyond the configured maximum.
# - Provides na_create_working_backup() / na_restore_working_backup(): snapshot
#   and restore the working DXF around an in-place hard-delete prune, so the
#   physical removal of entities (Shift+Delete) remains undoable.
# - Ensures cache directories exist (creates on first use).
# - Cache paths are read from Na__AppData__AppConfig__.json
#   Config__ProjectCache.* / Config__UndoRedo.HotCache__* sections.
#
# -----------------------------------------------------------------------------
#
# DEVELOPMENT LOG:
# 07-Jul-2026 - Version 0.3.3
# - Added working-file backup/restore helpers for undoable hard-delete.
#
# 07-Jul-2026 - Version 0.3.0
# - Added per-project versioned save paths, project listing, and hot cache.
#
# 07-Jul-2026 - Version 0.1.0
# - Initial scaffold release.
#
# =============================================================================

import os
import re
import json
import time
import shutil
import uuid


# #region ---------------------------------------------------------------------
# REGION | Module Constants
# -----------------------------------------------------------------------------

_APP_DIR            = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_CONFIG_PATH        = os.path.join(_APP_DIR, '02__AppData', 'Na__AppData__AppConfig__.json')

_DEFAULT_TEMP_CACHE    = os.path.join(_APP_DIR, '04__LocalProjectCache', '01__TempCache__DwgToDxfConversions')
_DEFAULT_SAVE_DIR      = os.path.join(_APP_DIR, '04__LocalProjectCache', '02__SavedProjects__AuditedDxfFiles')
_DEFAULT_WORKING_BACKUP_DIR = os.path.join(_APP_DIR, '04__LocalProjectCache', '05__WorkingFileBackups')
_DEFAULT_WORKING_BACKUP_MAX = 40                                     # <-- Fallback cap if config key is absent

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
# REGION | Versioned Project Save Paths
# -----------------------------------------------------------------------------

_VERSION_PATTERN = re.compile(r'__v(\d{3})__')                           # <-- Matches __vNNN__ in filenames


def na_get_project_version_paths(project_name):
    """
    Resolve the next-version DXF + JSON save paths for a named project.

    Creates 02__SavedProjects__AuditedDxfFiles/<ProjectName>/ if missing and
    scans existing files for __vNNN__ to auto-increment the version number.

    Args:
        project_name (str): User-facing project name (sanitised here).

    Returns:
        dict: { projectDir, version, versionLabel, dxfPath, jsonPath }
    """
    safe_project = na_sanitise_project_name(project_name)
    project_dir  = os.path.join(_resolve_save_dir(), safe_project)
    os.makedirs(project_dir, exist_ok=True)                              # <-- Ensure project subfolder exists

    max_version = 0
    for filename in os.listdir(project_dir):
        match = _VERSION_PATTERN.search(filename)
        if match:
            max_version = max(max_version, int(match.group(1)))

    version       = max_version + 1                                      # <-- Auto-increment from highest found
    version_label = f"v{version:03d}"
    base_name     = f"{safe_project}__{version_label}__"

    return {
        'projectDir'   : project_dir,
        'version'      : version,
        'versionLabel' : version_label,
        'dxfPath'      : os.path.join(project_dir, base_name + '.dxf'),
        'jsonPath'     : os.path.join(project_dir, base_name + '.json'),
    }


def na_list_saved_projects():
    """
    Enumerate saved projects and their versions.

    Returns:
        list[dict]: [ { name, versions: [ { label, dxfFile, jsonFile } ] } ]
    """
    save_dir = _resolve_save_dir()
    if not os.path.isdir(save_dir):
        return []

    projects = []
    for entry in sorted(os.listdir(save_dir)):
        project_dir = os.path.join(save_dir, entry)
        if not os.path.isdir(project_dir):
            continue

        versions = {}
        for filename in sorted(os.listdir(project_dir)):
            match = _VERSION_PATTERN.search(filename)
            if not match:
                continue
            label = f"v{int(match.group(1)):03d}"
            slot  = versions.setdefault(label, {'label': label, 'dxfFile': None, 'jsonFile': None})
            if filename.lower().endswith('.dxf'):
                slot['dxfFile'] = filename
            elif filename.lower().endswith('.json'):
                slot['jsonFile'] = filename

        projects.append({
            'name'     : entry,
            'versions' : list(versions.values()),
        })

    return projects

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Undo/Redo Hot Cache
# -----------------------------------------------------------------------------

def na_write_hot_cache_state(state_dict):
    """
    Persist an undo/redo state snapshot to the hot cache folder as JSON.
    Oldest files are trimmed once the folder exceeds HotCache__MaxFiles.

    Args:
        state_dict (dict): Arbitrary JSON-serialisable undo state payload.

    Returns:
        str: Absolute path of the written snapshot file.
    """
    config     = _load_config()
    undo_cfg   = config.get('Config__UndoRedo', {})
    rel_path   = undo_cfg.get('HotCache__Path', '04__LocalProjectCache/03__HotCache__UndoRedoStates')
    max_files  = undo_cfg.get('HotCache__MaxFiles', 120)

    cache_dir  = os.path.join(_APP_DIR, rel_path.replace('/', os.sep))
    os.makedirs(cache_dir, exist_ok=True)                                # <-- Ensure hot cache folder exists

    timestamp  = time.strftime('%Y%m%d-%H%M%S') + f"-{int(time.time() * 1000) % 1000:03d}"
    file_path  = os.path.join(cache_dir, f"Na__UndoState__{timestamp}__.json")

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(state_dict, f, indent=2)

    _trim_hot_cache(cache_dir, max_files)                                # <-- Keep folder bounded
    return file_path


def _trim_hot_cache(cache_dir, max_files):
    """Delete oldest snapshot files beyond max_files (by modified time)."""
    try:
        snapshots = [
            os.path.join(cache_dir, f) for f in os.listdir(cache_dir)
            if f.startswith('Na__UndoState__') and f.endswith('.json')
        ]
        if len(snapshots) <= max_files:
            return
        snapshots.sort(key=os.path.getmtime)                             # <-- Oldest first
        for old_file in snapshots[:len(snapshots) - max_files]:
            os.remove(old_file)
    except Exception as err:
        print(f"[Na__ProjectCache] Hot cache trim skipped: {err}")

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Working File Backup / Restore — Undoable Hard-Delete
# -----------------------------------------------------------------------------

def na_create_working_backup(working_path):
    """
    Copy the current working DXF to the backups folder before an in-place
    hard-delete prune, so the operation can be undone by restoring this exact
    snapshot. Called once per prune-working request — every hard-delete
    (and every redo of one) gets its own backup token.

    Args:
        working_path (str): Absolute path to the working DXF about to be pruned.

    Returns:
        dict: { backupId, backupPath }

    Raises:
        FileNotFoundError: if working_path does not exist.
    """
    if not os.path.isfile(working_path):
        raise FileNotFoundError(f"Working file not found: {working_path}")

    backup_dir = _resolve_working_backup_dir()
    os.makedirs(backup_dir, exist_ok=True)                               # <-- Ensure backups folder exists

    backup_id   = uuid.uuid4().hex                                       # <-- Opaque, collision-free backup token
    base_name   = na_sanitise_filename(working_path)
    backup_path = os.path.join(backup_dir, f"{backup_id}__{base_name}")

    shutil.copy2(working_path, backup_path)                              # <-- Preserve mtime for oldest-first trim
    print(f"[Na__ProjectCache] Working file backed up before prune: {os.path.basename(backup_path)}")

    _trim_working_backups(backup_dir)                                    # <-- Keep folder bounded
    return {'backupId': backup_id, 'backupPath': backup_path}


def na_restore_working_backup(backup_id, working_path):
    """
    Restore a previously created working-file backup over the current
    working path — used to undo a hard-delete prune.

    Args:
        backup_id    (str): Token returned by na_create_working_backup().
        working_path (str): Absolute path of the working DXF to overwrite.

    Returns:
        str: working_path on success.

    Raises:
        FileNotFoundError: if the backup cannot be located.
    """
    backup_dir  = _resolve_working_backup_dir()
    backup_path = _find_working_backup_path(backup_dir, backup_id)

    if not backup_path:
        raise FileNotFoundError(f"Backup not found for id: {backup_id}")

    os.makedirs(os.path.dirname(working_path), exist_ok=True)
    shutil.copy2(backup_path, working_path)                              # <-- Overwrite pruned file with the backup
    print(f"[Na__ProjectCache] Working file restored from backup: {backup_id}")
    return working_path

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Helper Functions
# -----------------------------------------------------------------------------

def na_sanitise_project_name(project_name):
    """
    Sanitise a project name for use as a folder name.
    Strips path separators and characters invalid on Windows filesystems.
    """
    safe = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', str(project_name or '')).strip().strip('.')
    if not safe:
        safe = 'UntitledProject'
    return safe


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


def _resolve_working_backup_dir():
    """Load working-file backups path from app config, falling back to default."""
    config = _load_config()
    rel_path = config.get('Config__ProjectCache', {}).get('WorkingBackups__Path', '')
    if rel_path:
        return os.path.join(_APP_DIR, rel_path.replace('/', os.sep))
    return _DEFAULT_WORKING_BACKUP_DIR


def _find_working_backup_path(backup_dir, backup_id):
    """Locate the backup file for a given backup id (filename prefix match)."""
    if not os.path.isdir(backup_dir):
        return None
    prefix = f"{backup_id}__"
    for filename in os.listdir(backup_dir):
        if filename.startswith(prefix):
            return os.path.join(backup_dir, filename)
    return None


def _trim_working_backups(backup_dir):
    """Delete oldest working-file backups beyond WorkingBackups__MaxFiles."""
    try:
        config    = _load_config()
        max_files = config.get('Config__ProjectCache', {}).get('WorkingBackups__MaxFiles', _DEFAULT_WORKING_BACKUP_MAX)
        backups   = [os.path.join(backup_dir, f) for f in os.listdir(backup_dir)]
        if len(backups) <= max_files:
            return
        backups.sort(key=os.path.getmtime)                               # <-- Oldest first
        for old_file in backups[:len(backups) - max_files]:
            os.remove(old_file)
    except Exception as err:
        print(f"[Na__ProjectCache] Working backup trim skipped: {err}")


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
