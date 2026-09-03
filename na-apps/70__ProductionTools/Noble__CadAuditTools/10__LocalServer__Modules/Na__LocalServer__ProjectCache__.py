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
# 01-Sep-2026 - Version 0.5.0
# - na_get_project_version_paths() now claims its version atomically via
#   O_CREAT|O_EXCL, so concurrent saves can never write to the same archive
#   path. Previously two overlapping saves both resolved to the same __vNNN__
#   and interleaved their writes into one truncated DXF.
# - na_list_saved_projects() reports created/saved epochs for table sorting.
#
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
import threading


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
_VERSION_CLAIM_LOCK = threading.Lock()                                   # <-- Serialises version allocation
_VERSION_CLAIM_MAX_ATTEMPTS = 999                                        # <-- Ceiling on the claim retry loop


def na_get_project_version_paths(project_name):
    """
    Claim the next-version DXF + JSON save paths for a named project.

    Creates 02__SavedProjects__AuditedDxfFiles/<ProjectName>/ if missing and
    scans existing files for __vNNN__ to auto-increment the version number.

    The claim is ATOMIC. Scanning for the highest version and then writing to
    version+1 is a read-modify-write, and Flask serves this route threaded, so
    two saves fired seconds apart (or one impatient double-click) could both
    scan an empty folder, both decide "v001", and both stream a multi-hundred-MB
    DXF into the SAME path — producing a truncated archive that still returned
    HTTP 200. The version is therefore reserved by creating the DXF file with
    O_CREAT|O_EXCL: exactly one caller can win a given number, and a loser
    simply retries with the next one. A process-level lock keeps threads in this
    same interpreter from spinning through the loop unnecessarily.

    Args:
        project_name (str): User-facing project name (sanitised here).

    Returns:
        dict: { projectDir, version, versionLabel, dxfPath, jsonPath }

    Raises:
        RuntimeError: if no free version number could be claimed.
    """
    safe_project = na_sanitise_project_name(project_name)
    project_dir  = os.path.join(_resolve_save_dir(), safe_project)
    os.makedirs(project_dir, exist_ok=True)                              # <-- Ensure project subfolder exists

    with _VERSION_CLAIM_LOCK:
        max_version = 0
        for filename in os.listdir(project_dir):
            match = _VERSION_PATTERN.search(filename)
            if match:
                max_version = max(max_version, int(match.group(1)))

        version = max_version + 1                                        # <-- Auto-increment from highest found

        for _ in range(_VERSION_CLAIM_MAX_ATTEMPTS):
            version_label = f"v{version:03d}"
            base_name     = f"{safe_project}__{version_label}__"
            dxf_path      = os.path.join(project_dir, base_name + '.dxf')

            try:
                fd = os.open(dxf_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)  # <-- Reserve the slot or fail
                os.close(fd)
            except FileExistsError:
                version += 1                                             # <-- Another writer took it; step past
                continue

            print(f"[Na__ProjectCache] Claimed version {version_label} for {safe_project}")
            return {
                'projectDir'   : project_dir,
                'version'      : version,
                'versionLabel' : version_label,
                'dxfPath'      : dxf_path,
                'jsonPath'     : os.path.join(project_dir, base_name + '.json'),
            }

    raise RuntimeError(
        f"Could not claim a free version number for '{safe_project}' "
        f"after {_VERSION_CLAIM_MAX_ATTEMPTS} attempts."
    )


def na_list_saved_projects():
    """
    Enumerate saved projects and their versions, enriched with metadata read
    from each version's JSON sidecar (saved date, source file, deleted count).

    Every version also carries sortable epoch timestamps alongside the display
    strings, plus the PROJECT-level creation date (the earliest save across all
    of that project's versions), so the frontend table can order on any column
    without re-parsing formatted dates.

    Returns:
        list[dict]: [ { name, createdAt, createdAtEpoch, versions: [ {
            label, dxfFile, jsonFile, dxfPath, savedAt, savedAtEpoch,
            createdAt, createdAtEpoch, sourceFilename, deletedCount,
            dimensionCount
        } ] } ]  — versions sorted newest-first.
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
            slot  = versions.setdefault(label, {
                'label'    : label,
                'number'   : int(match.group(1)),
                'dxfFile'  : None,
                'jsonFile' : None,
                'dxfPath'  : None,
            })
            full_path = os.path.join(project_dir, filename)
            if filename.lower().endswith('.dxf'):
                slot['dxfFile'] = filename
                slot['dxfPath'] = full_path
            elif filename.lower().endswith('.json'):
                slot['jsonFile'] = filename

        # Enrich each version with sidecar metadata
        for slot in versions.values():
            meta = _read_version_metadata(project_dir, slot['jsonFile'])
            slot['sourceFilename'] = meta.get('sourceFilename', '')
            slot['deletedCount']   = meta.get('deletedCount', 0)
            slot['dimensionCount'] = len(meta.get('dimensions', []) or [])

            epoch = _parse_timestamp(meta.get('savedAt', ''))            # <-- Sidecar date is authoritative
            if epoch is None:
                epoch = _file_mtime(slot['dxfPath'])                     # <-- Pre-sidecar saves fall back to the DXF
            slot['savedAtEpoch'] = epoch
            slot['savedAt']      = meta.get('savedAt', '') or _format_timestamp(epoch)

        version_list = sorted(versions.values(), key=lambda v: v['number'], reverse=True)  # <-- Newest first

        created_epoch = _earliest_epoch(version_list)                    # <-- First version saved = project birth
        if created_epoch is None:
            created_epoch = _file_mtime(project_dir)                     # <-- Otherwise the folder's own date
        created_display = _format_timestamp(created_epoch)

        for slot in version_list:
            slot['createdAt']      = created_display                     # <-- Same on every row of a project
            slot['createdAtEpoch'] = created_epoch

        projects.append({
            'name'           : entry,
            'versionCount'   : len(version_list),
            'createdAt'      : created_display,
            'createdAtEpoch' : created_epoch,
            'versions'       : version_list,
        })

    return projects


def na_resolve_project_version_dxf(project_name, version_label):
    """
    Resolve the absolute DXF path for a specific saved project version,
    guarding against path traversal (result must live under the save dir).

    Args:
        project_name  (str): Saved project folder name.
        version_label (str): Version label, e.g. 'v003' (or bare '3').

    Returns:
        str | None: Absolute DXF path if it exists inside the save dir, else None.
    """
    save_dir     = _resolve_save_dir()
    safe_project = na_sanitise_project_name(project_name)
    project_dir  = os.path.join(save_dir, safe_project)

    if not os.path.isdir(project_dir):
        return None

    match = re.search(r'(\d+)', str(version_label or ''))               # <-- Accept 'v003', '003', or '3'
    if not match:
        return None
    number = int(match.group(1))

    for filename in os.listdir(project_dir):
        m = _VERSION_PATTERN.search(filename)
        if m and int(m.group(1)) == number and filename.lower().endswith('.dxf'):
            candidate = os.path.abspath(os.path.join(project_dir, filename))
            if candidate.startswith(os.path.abspath(save_dir) + os.sep):  # <-- Traversal guard
                return candidate
    return None


def na_open_project_working_copy(project_name, version_label):
    """
    Copy a saved project version's DXF into the temp cache as a FRESH working
    file, so edits made after opening a project never mutate the archived
    version. Also returns the sidecar metadata (dimensions to restore, etc.).

    Args:
        project_name  (str): Saved project folder name.
        version_label (str): Version label, e.g. 'v003'.

    Returns:
        dict | None: { workingPath, filename, metadata } or None if not found.
    """
    dxf_path = na_resolve_project_version_dxf(project_name, version_label)
    if not dxf_path:
        return None

    safe_project = na_sanitise_project_name(project_name)
    match        = re.search(r'(\d+)', str(version_label or ''))
    label        = f"v{int(match.group(1)):03d}" if match else 'v001'
    filename     = f"{safe_project}__{label}.dxf"                        # <-- Display + working file name

    cache_dir    = _resolve_temp_cache_dir()
    os.makedirs(cache_dir, exist_ok=True)
    working_path = os.path.join(cache_dir, filename)

    shutil.copy2(dxf_path, working_path)                                # <-- Fresh working copy — archive stays intact
    print(f"[Na__ProjectCache] Opened project working copy: {filename}")

    # Load the sidecar metadata (dimensions to restore on the frontend)
    project_dir = os.path.dirname(dxf_path)
    json_name   = os.path.splitext(os.path.basename(dxf_path))[0] + '.json'
    metadata    = _read_version_metadata(project_dir, json_name)

    return {'workingPath': working_path, 'filename': filename, 'metadata': metadata}


def _read_version_metadata(project_dir, json_filename):
    """Read a version's JSON sidecar, returning {} on any error."""
    if not json_filename:
        return {}
    try:
        with open(os.path.join(project_dir, json_filename), 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}

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


# --- Timestamp Helpers | Saved / Created Dates for the Project Table ---------

_TIMESTAMP_FORMAT = '%Y-%m-%d %H:%M:%S'                                  # <-- Sortable as plain text too


def _parse_timestamp(text):
    """Parse a '%Y-%m-%d %H:%M:%S' sidecar date to epoch seconds, or None."""
    if not text:
        return None
    try:
        return time.mktime(time.strptime(str(text), _TIMESTAMP_FORMAT))
    except Exception:
        return None


def _format_timestamp(epoch):
    """Render epoch seconds as a display date, or '' when unknown."""
    if epoch is None:
        return ''
    try:
        return time.strftime(_TIMESTAMP_FORMAT, time.localtime(epoch))
    except Exception:
        return ''


def _file_mtime(path):
    """Modified time of a file or folder as epoch seconds, or None."""
    if not path:
        return None
    try:
        return os.path.getmtime(path)
    except Exception:
        return None


def _earliest_epoch(version_list):
    """Oldest known save across a project's versions, or None if none dated."""
    stamps = [v.get('savedAtEpoch') for v in version_list if v.get('savedAtEpoch')]
    return min(stamps) if stamps else None


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
