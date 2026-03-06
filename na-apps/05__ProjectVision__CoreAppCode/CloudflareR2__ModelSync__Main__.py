#!/usr/bin/env python3
# =============================================================================
# NOBLE ARCHITECTURE - CLOUDFLARE R2 MODEL SYNC UTILITY
# =============================================================================
#
# FILE       : CloudflareR2__ModelSync__Main__.py
# NAMESPACE  : ProjectVision
# MODULE     : Cloudflare R2 Model Sync
# AUTHOR     : Adam Noble - Noble Architecture
# PURPOSE    : Sync GLB model files and project data to Cloudflare R2 bucket
# CREATED    : 27-Feb-2026
#
# DESCRIPTION:
# - Scans na-project-portal/{year}-Projects/ for TrueVision model groups
# - Each subfolder under 30__TrueVision__AppContent/ is a model group
# - Uploads .glb files to Cloudflare R2 via boto3 (S3-compatible API)
# - Also uploads TrueVision__ProjectData__.json for each project
# - Uses incremental sync (HEAD check, date comparison, skip/new/update)
# - Dry-run preview then yes/no confirmation before uploading
# - Colourful console output using ANSI escape codes
# - GLB purge mode: delete all GLB files from R2 for a given project
#
# USAGE:
#   python CloudflareR2__ModelSync__Main__.py
#   python CloudflareR2__ModelSync__Main__.py --dry-run-only
#   python CloudflareR2__ModelSync__Main__.py --project NP03__AshnessClose
#   python CloudflareR2__ModelSync__Main__.py --purge RB05
#   python CloudflareR2__ModelSync__Main__.py --instructions
#
# =============================================================================

import os
import sys
import re
import json
import argparse
import ctypes
import boto3
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Dict, Tuple, Optional
from dotenv import load_dotenv
from botocore.exceptions import ClientError, NoCredentialsError


# -----------------------------------------------------------------------------
# REGION | Windows Console Initialisation
# -----------------------------------------------------------------------------

def _enable_windows_ansi():
    """Enable ANSI escape code processing on Windows 10+ consoles."""
    if sys.platform != 'win32':
        return
    try:
        kernel32 = ctypes.windll.kernel32
        STD_OUTPUT_HANDLE = -11
        ENABLE_VIRTUAL_TERMINAL_PROCESSING = 0x0004
        handle = kernel32.GetStdHandle(STD_OUTPUT_HANDLE)
        mode = ctypes.c_ulong()
        kernel32.GetConsoleMode(handle, ctypes.byref(mode))
        kernel32.SetConsoleMode(handle, mode.value | ENABLE_VIRTUAL_TERMINAL_PROCESSING)
    except Exception:
        pass

_enable_windows_ansi()

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | Module Constants and Configuration
# -----------------------------------------------------------------------------

    # MODULE CONSTANTS | Paths and Prefixes
    # ------------------------------------------------------------
SCRIPT_DIR                         = Path(__file__).parent
REPO_ROOT                          = SCRIPT_DIR.parent.parent
PORTAL_ROOT                        = REPO_ROOT / 'na-project-portal'
R2_BASE_PREFIX                     = 'NaProjectPortal'
CDN_BASE_URL                       = 'https://cdn.noble-architecture.com'
ENV_FILE_PATH                      = 'API__Cloudflare/Token__CloudflareR2.env'
    # ------------------------------------------------------------

    # MODULE CONSTANTS | Folder Patterns
    # ------------------------------------------------------------
YEAR_FOLDER_PATTERN                = re.compile(r'^(\d{2})-Projects$')
PROJECT_DIR_PATTERN                = re.compile(r'^([A-Z]{2}[0-9]{2})(?:__|_-_)(.+)$')
PROJECT_CODE_PATTERN               = re.compile(r'^[A-Z]{2}\d{2}$', re.IGNORECASE)
TRUEVISION_CONTENT_FOLDER          = '30__TrueVision__AppContent'
PLANVISION_CONTENT_FOLDER          = '20__PlanVision__AppContent'
GLB_FILE_PATTERN                   = re.compile(r'^.+\.glb$', re.IGNORECASE)
JSON_PROJECT_DATA_FILENAME         = 'TrueVision__ProjectData__.json'
MASTER_PROJECT_INDEX_PATH          = SCRIPT_DIR / '05__AppData' / 'ProjectVision__MasterProjectIndex__Core__.json'
    # ------------------------------------------------------------

    # MODULE CONSTANTS | Content Types
    # ------------------------------------------------------------
CONTENT_TYPE_GLB                   = 'model/gltf-binary'
CONTENT_TYPE_JSON                  = 'application/json'
    # ------------------------------------------------------------

    # MODULE CONSTANTS | Console Colour Codes
    # ------------------------------------------------------------
C_RESET                            = '\033[0m'
C_GREEN                            = '\033[92m'
C_YELLOW                           = '\033[93m'
C_BLUE                             = '\033[94m'
C_CYAN                             = '\033[96m'
C_RED                              = '\033[91m'
C_MAGENTA                          = '\033[95m'
C_BOLD                             = '\033[1m'
C_DIM                              = '\033[2m'
    # ------------------------------------------------------------

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | Environment and Credentials
# -----------------------------------------------------------------------------

    # FUNCTION | Load R2 Credentials from .env File
    # ------------------------------------------------------------
def load_r2_credentials() -> Tuple[bool, Optional[Dict[str, str]]]:
    """Load Cloudflare R2 credentials from the API__Cloudflare .env file."""
    env_path = SCRIPT_DIR / ENV_FILE_PATH

    if not env_path.exists():
        print(f"{C_RED}[ERROR] Credentials file not found: {env_path}{C_RESET}")
        print(f"{C_YELLOW}        Create it from the template in API__Cloudflare/{C_RESET}")
        return False, None

    load_dotenv(env_path)

    credentials = {
        'access_key_id'     : os.getenv('R2_ACCESS_KEY_ID'),
        'secret_access_key' : os.getenv('R2_SECRET_ACCESS_KEY'),
        'bucket_name'       : os.getenv('R2_BUCKET_NAME'),
        'endpoint'          : os.getenv('R2_ENDPOINT'),
    }

    missing = [k for k, v in credentials.items() if not v or v.startswith('your_')]
    if missing:
        print(f"{C_RED}[ERROR] Missing or placeholder credentials: {', '.join(missing)}{C_RESET}")
        return False, None

    return True, credentials
    # ------------------------------------------------------------

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | R2 Client Operations
# -----------------------------------------------------------------------------

    # FUNCTION | Create boto3 S3-Compatible Client for R2
    # ------------------------------------------------------------
def create_r2_client(credentials: Dict[str, str]) -> Optional[boto3.client]:
    """Create a boto3 S3-compatible client for Cloudflare R2."""
    try:
        s3_client = boto3.client(
            's3',
            endpoint_url          = credentials['endpoint'],
            aws_access_key_id     = credentials['access_key_id'],
            aws_secret_access_key = credentials['secret_access_key'],
            region_name           = 'auto',
        )
        return s3_client
    except Exception as error:
        print(f"{C_RED}[ERROR] Failed to create R2 client: {error}{C_RESET}")
        return None
    # ------------------------------------------------------------


    # FUNCTION | Check if File Exists in R2 and Return Size + LastModified
    # ------------------------------------------------------------
def check_r2_file(s3_client, bucket_name: str, key: str) -> Tuple[bool, Optional[int], Optional[datetime]]:
    """HEAD request to check if a file exists in R2 and get its size and last modified date."""
    try:
        response = s3_client.head_object(Bucket=bucket_name, Key=key)
        return True, response['ContentLength'], response['LastModified']
    except ClientError as error:
        error_code = error.response['Error']['Code']
        if error_code in ('404', '400', '403'):
            return False, None, None
        print(f"{C_RED}[ERROR] HEAD check failed for {key}: {error}{C_RESET}")
        return False, None, None
    # ------------------------------------------------------------


    # FUNCTION | Upload a Single File to R2
    # ------------------------------------------------------------
def upload_to_r2(s3_client, bucket_name: str, local_path: Path, key: str, content_type: str) -> bool:
    """Upload a file to Cloudflare R2 with the specified content type."""
    try:
        s3_client.upload_file(
            str(local_path),
            bucket_name,
            key,
            ExtraArgs={'ContentType': content_type},
        )
        return True
    except FileNotFoundError:
        print(f"{C_RED}[ERROR] Local file not found: {local_path}{C_RESET}")
        sys.stdout.flush()
        return False
    except Exception as error:
        print(f"{C_RED}[ERROR] Upload failed for {key}: {type(error).__name__}: {error}{C_RESET}")
        sys.stdout.flush()
        return False
    # ------------------------------------------------------------

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | Project and File Discovery
# -----------------------------------------------------------------------------

    # FUNCTION | Discover Year Folders in Portal Root
    # ------------------------------------------------------------
def discover_year_folders(portal_root: Path) -> List[Tuple[str, Path]]:
    """Find all {NN}-Projects directories in the portal root."""
    year_folders = []
    if not portal_root.is_dir():
        return year_folders

    for item in sorted(portal_root.iterdir()):
        if item.is_dir():
            match = YEAR_FOLDER_PATTERN.match(item.name)
            if match:
                year_folders.append((match.group(1), item))

    return year_folders
    # ------------------------------------------------------------


    # FUNCTION | Discover Projects Within a Year Folder
    # ------------------------------------------------------------
def discover_projects(year_path: Path) -> List[Dict]:
    """Find all valid project directories within a year folder."""
    projects = []
    if not year_path.is_dir():
        return projects

    for item in sorted(year_path.iterdir()):
        if not item.is_dir():
            continue
        match = PROJECT_DIR_PATTERN.match(item.name)
        if not match:
            continue

        project_code = match.group(1)
        project_name = match.group(2)

        projects.append({
            'project_code'   : project_code,
            'project_name'   : project_name,
            'project_folder' : item.name,
            'project_path'   : item,
        })

    return projects
    # ------------------------------------------------------------


    # FUNCTION | Discover Model Groups Under TrueVision Content
    # ------------------------------------------------------------
def discover_model_groups(project_path: Path) -> List[Dict]:
    """Find all model group subfolders under 30__TrueVision__AppContent/."""
    tv_content_path = project_path / TRUEVISION_CONTENT_FOLDER
    groups = []

    if not tv_content_path.is_dir():
        return groups

    for item in sorted(tv_content_path.iterdir()):
        if not item.is_dir():
            continue
        if item.name.startswith('.') or item.name.startswith('00__'):
            continue

        glb_files = sorted([
            f.name for f in item.iterdir()
            if f.is_file() and GLB_FILE_PATTERN.match(f.name)
        ])

        if glb_files:
            groups.append({
                'group_id'   : item.name,
                'group_path' : item,
                'glb_files'  : glb_files,
            })

    return groups
    # ------------------------------------------------------------


    # FUNCTION | Parse Model Group Folder Name into Label
    # ------------------------------------------------------------
def parse_group_label(group_id: str) -> str:
    """Convert a folder name like DesignPhase01__ConceptDesign__ExistingBuilding to a label."""
    parts = group_id.split('__')
    if len(parts) >= 2:
        label_parts = parts[1:]
        label = ' - '.join(label_parts)
    else:
        label = group_id

    label = re.sub(r'([a-z])([A-Z])', r'\1 \2', label)
    return label
    # ------------------------------------------------------------

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | File Sync Logic
# -----------------------------------------------------------------------------

    # FUNCTION | Build R2 Key from Local Path
    # ------------------------------------------------------------
def build_r2_key(year_folder_name: str, project_folder: str, content_folder: str, subfolder: str, filename: str) -> str:
    """Construct the R2 object key mirroring the local folder structure."""
    return f"{R2_BASE_PREFIX}/{year_folder_name}/{project_folder}/{content_folder}/{subfolder}/{filename}"
    # ------------------------------------------------------------


    # FUNCTION | Build R2 Key for Project Data JSON
    # ------------------------------------------------------------
def build_r2_key_project_data(year_folder_name: str, project_folder: str) -> str:
    """Construct the R2 key for TrueVision__ProjectData__.json."""
    return f"{R2_BASE_PREFIX}/{year_folder_name}/{project_folder}/{TRUEVISION_CONTENT_FOLDER}/{JSON_PROJECT_DATA_FILENAME}"
    # ------------------------------------------------------------


    # HELPER FUNCTION | Format File Size for Display
    # ------------------------------------------------------------
def format_size(size_bytes: int) -> str:
    """Format file size in human-readable format."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.2f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"
    # ------------------------------------------------------------


    # FUNCTION | Determine Upload Action for a Single File
    # ------------------------------------------------------------
def determine_action(s3_client, bucket_name: str, local_path: Path, r2_key: str) -> Tuple[str, str]:
    """Compare local file date to R2 LastModified and return action (new/update/skip) with detail."""
    stat        = local_path.stat()
    local_size  = stat.st_size
    local_mtime = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc)
    exists, remote_size, remote_mtime = check_r2_file(s3_client, bucket_name, r2_key)

    if not exists:
        return 'new', f"NEW ({format_size(local_size)})"
    elif local_mtime > remote_mtime:
        return 'update', (
            f"UPDATE (local {local_mtime:%Y-%m-%d %H:%M} "
            f"vs remote {remote_mtime:%Y-%m-%d %H:%M})"
        )
    else:
        return 'skip', f"SKIP ({format_size(local_size)})"
    # ------------------------------------------------------------


    # FUNCTION | Collect All Sync Operations for a Project
    # ------------------------------------------------------------
def collect_sync_operations(
    s3_client, bucket_name: str,
    year_folder_name: str, project: Dict, model_groups: List[Dict],
    project_data_path: Optional[Path]
) -> List[Dict]:
    """Build a list of all file operations (GLB + JSON) for one project."""
    operations = []

    for group in model_groups:
        for filename in group['glb_files']:
            local_path = group['group_path'] / filename
            r2_key = build_r2_key(
                year_folder_name, project['project_folder'],
                TRUEVISION_CONTENT_FOLDER, group['group_id'], filename
            )
            action, detail = determine_action(s3_client, bucket_name, local_path, r2_key)

            operations.append({
                'local_path'   : local_path,
                'r2_key'       : r2_key,
                'content_type' : CONTENT_TYPE_GLB,
                'action'       : action,
                'detail'       : detail,
                'size'         : local_path.stat().st_size,
                'group_id'     : group['group_id'],
                'filename'     : filename,
            })

    if project_data_path and project_data_path.is_file():
        r2_key = build_r2_key_project_data(year_folder_name, project['project_folder'])
        action, detail = determine_action(s3_client, bucket_name, project_data_path, r2_key)
        operations.append({
            'local_path'   : project_data_path,
            'r2_key'       : r2_key,
            'content_type' : CONTENT_TYPE_JSON,
            'action'       : action,
            'detail'       : detail,
            'size'         : project_data_path.stat().st_size,
            'group_id'     : '__project_data__',
            'filename'     : JSON_PROJECT_DATA_FILENAME,
        })

    return operations
    # ------------------------------------------------------------

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | Console Output and Reporting
# -----------------------------------------------------------------------------

    # FUNCTION | Print Discovery Banner
    # ------------------------------------------------------------
def print_banner():
    """Print the utility title banner."""
    print(f"\n{C_CYAN}{C_BOLD}{'=' * 80}{C_RESET}")
    print(f"{C_CYAN}{C_BOLD}  NOBLE ARCHITECTURE - CLOUDFLARE R2 MODEL SYNC UTILITY{C_RESET}")
    print(f"{C_CYAN}{C_BOLD}{'=' * 80}{C_RESET}")
    print(f"{C_BLUE}  Target: Cloudflare R2 Bucket (noble-architecture-cdn){C_RESET}")
    print(f"{C_BLUE}  Prefix: {R2_BASE_PREFIX}/{C_RESET}\n")
    # ------------------------------------------------------------


    # FUNCTION | Print Operations Preview for a Project
    # ------------------------------------------------------------
def print_project_operations(project: Dict, operations: List[Dict]):
    """Print the sync operations preview for one project."""
    if not operations:
        print(f"  {C_YELLOW}[!] {project['project_folder']} - No syncable files found{C_RESET}\n")
        return

    new_count    = sum(1 for op in operations if op['action'] == 'new')
    update_count = sum(1 for op in operations if op['action'] == 'update')
    skip_count   = sum(1 for op in operations if op['action'] == 'skip')
    total_size   = sum(op['size'] for op in operations)

    print(f"  {C_CYAN}{C_BOLD}[PROJECT] {project['project_folder']}{C_RESET}")
    print(f"           Files: {len(operations)}  |  "
          f"{C_GREEN}New: {new_count}{C_RESET}  |  "
          f"{C_YELLOW}Update: {update_count}{C_RESET}  |  "
          f"{C_BLUE}Skip: {skip_count}{C_RESET}  |  "
          f"Size: {format_size(total_size)}")

    current_group = None
    for op in operations:
        if op['group_id'] != current_group:
            current_group = op['group_id']
            if current_group == '__project_data__':
                print(f"    {C_MAGENTA}[Config]{C_RESET}")
            else:
                print(f"    {C_DIM}[{current_group}]{C_RESET}")

        if op['action'] == 'new':
            print(f"      {C_GREEN}[+] {op['filename']}{C_RESET} - {op['detail']}")
        elif op['action'] == 'update':
            print(f"      {C_YELLOW}[^] {op['filename']}{C_RESET} - {op['detail']}")
        elif op['action'] == 'skip':
            print(f"      {C_BLUE}[=] {op['filename']}{C_RESET} - {op['detail']}")

    print()
    # ------------------------------------------------------------


    # FUNCTION | Print Final Summary
    # ------------------------------------------------------------
def print_summary(all_operations: List[Dict], dry_run: bool):
    """Print the overall sync summary."""
    total       = len(all_operations)
    new_count   = sum(1 for op in all_operations if op['action'] == 'new')
    upd_count   = sum(1 for op in all_operations if op['action'] == 'update')
    skip_count  = sum(1 for op in all_operations if op['action'] == 'skip')
    total_size  = sum(op['size'] for op in all_operations)

    print(f"{C_CYAN}{'=' * 80}{C_RESET}")
    print(f"{C_CYAN}{C_BOLD}  SYNC SUMMARY{C_RESET}")
    print(f"{C_CYAN}{'=' * 80}{C_RESET}")
    print(f"  Total files scanned  : {total}")
    print(f"  {C_GREEN}New uploads          : {new_count}{C_RESET}")
    print(f"  {C_YELLOW}Updated files        : {upd_count}{C_RESET}")
    print(f"  {C_BLUE}Skipped (unchanged)  : {skip_count}{C_RESET}")
    print(f"  Total data size      : {format_size(total_size)}")

    if dry_run:
        print(f"\n  {C_YELLOW}{C_BOLD}DRY RUN - No files were uploaded{C_RESET}")

    print(f"{C_CYAN}{'=' * 80}{C_RESET}\n")
    # ------------------------------------------------------------

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | User Confirmation
# -----------------------------------------------------------------------------

    # FUNCTION | Prompt for Upload Confirmation
    # ------------------------------------------------------------
def prompt_confirmation() -> bool:
    """Ask user to confirm upload. Returns True if confirmed."""
    print(f"\n{C_YELLOW}{C_BOLD}{'=' * 80}{C_RESET}")
    print(f"{C_YELLOW}{C_BOLD}  CONFIRMATION REQUIRED{C_RESET}")
    print(f"{C_YELLOW}{C_BOLD}{'=' * 80}{C_RESET}")

    try:
        response = input(
            f"\n  {C_CYAN}Proceed with uploading files to Cloudflare R2? (yes/no): {C_RESET}"
        ).strip().lower()

        if response in ('yes', 'y'):
            print(f"  {C_GREEN}[OK] Confirmed - Proceeding with upload...{C_RESET}\n")
            return True
        else:
            print(f"  {C_RED}[CANCEL] Upload cancelled. No files were uploaded.{C_RESET}\n")
            return False
    except (KeyboardInterrupt, EOFError):
        print(f"\n  {C_RED}[CANCEL] Cancelled by user.{C_RESET}\n")
        return False
    # ------------------------------------------------------------

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | Project GLB Purge
# -----------------------------------------------------------------------------

    # FUNCTION | Resolve Project Info from Code
    # ------------------------------------------------------------
def resolve_project_info(project_code: str) -> Optional[Dict[str, str]]:
    """Look up a project code in the master index, falling back to folder scan."""
    code = project_code.upper()

    if MASTER_PROJECT_INDEX_PATH.is_file():
        try:
            with open(MASTER_PROJECT_INDEX_PATH, 'r', encoding='utf-8') as fh:
                index = json.load(fh)
            entry = index.get('projects', {}).get(code)
            if entry:
                return {
                    'project_code'   : code,
                    'project_name'   : entry.get('projectName', code),
                    'project_folder' : entry.get('projectFolder', ''),
                    'project_year'   : entry.get('projectYear', ''),
                }
        except (json.JSONDecodeError, KeyError):
            pass

    for year_code, year_path in discover_year_folders(PORTAL_ROOT):
        for project in discover_projects(year_path):
            if project['project_code'] == code:
                return {
                    'project_code'   : code,
                    'project_name'   : project['project_name'],
                    'project_folder' : project['project_folder'],
                    'project_year'   : year_code,
                }

    return None
    # ------------------------------------------------------------


    # FUNCTION | Purge GLB Files from R2 for a Project
    # ------------------------------------------------------------
def purge_project_glbs(s3_client, bucket_name: str, project_info: Dict[str, str]) -> int:
    """List and delete all .glb objects under a project's TrueVision prefix."""
    prefix = (
        f"{R2_BASE_PREFIX}/"
        f"{project_info['project_year']}-Projects/"
        f"{project_info['project_folder']}/"
        f"{TRUEVISION_CONTENT_FOLDER}/"
    )

    # -- Warning banner -------------------------------------------------------
    print(f"\n{C_RED}{C_BOLD}{'=' * 80}{C_RESET}")
    print(f"{C_RED}{C_BOLD}  WARNING - DESTRUCTIVE OPERATION - GLB PURGE{C_RESET}")
    print(f"{C_RED}{C_BOLD}{'=' * 80}{C_RESET}")
    print(f"  Project Code   : {C_YELLOW}{C_BOLD}{project_info['project_code']}{C_RESET}")
    print(f"  Project Name   : {C_YELLOW}{C_BOLD}{project_info['project_name']}{C_RESET}")
    print(f"  Project Folder : {C_CYAN}{project_info['project_folder']}{C_RESET}")
    print(f"  R2 Prefix      : {C_CYAN}{prefix}{C_RESET}")
    print(f"\n  {C_RED}This will permanently delete ALL .glb files under this prefix.{C_RESET}")
    print(f"{C_RED}{C_BOLD}{'=' * 80}{C_RESET}")

    # -- Enumerate GLB keys before confirming ---------------------------------
    print(f"\n  {C_BLUE}[SCAN] Listing GLB files in R2...{C_RESET}")
    sys.stdout.flush()

    glb_keys        = []
    continuation    = None

    while True:
        list_kwargs = {'Bucket': bucket_name, 'Prefix': prefix, 'MaxKeys': 1000}
        if continuation:
            list_kwargs['ContinuationToken'] = continuation

        response = s3_client.list_objects_v2(**list_kwargs)

        for obj in response.get('Contents', []):
            if obj['Key'].lower().endswith('.glb'):
                glb_keys.append(obj['Key'])

        if response.get('IsTruncated'):
            continuation = response['NextContinuationToken']
        else:
            break

    if not glb_keys:
        print(f"  {C_YELLOW}[INFO] No GLB files found under this prefix. Nothing to purge.{C_RESET}\n")
        return 0

    print(f"  {C_YELLOW}Found {len(glb_keys)} GLB file(s) to delete:{C_RESET}\n")
    for key in glb_keys:
        short_key = key.replace(prefix, '')
        print(f"    {C_RED}[-] {short_key}{C_RESET}")

    # -- Confirmation ---------------------------------------------------------
    print(f"\n  {C_RED}{C_BOLD}Type 'yes' to confirm deletion of all "
          f"{len(glb_keys)} GLB file(s) for "
          f"{project_info['project_code']} ({project_info['project_name']}).{C_RESET}")

    try:
        response = input(f"  {C_RED}Confirm purge (yes/no): {C_RESET}").strip().lower()
    except (KeyboardInterrupt, EOFError):
        print(f"\n  {C_BLUE}[CANCEL] Purge cancelled by user.{C_RESET}\n")
        return 0

    if response != 'yes':
        print(f"  {C_BLUE}[CANCEL] Purge cancelled. No files were deleted.{C_RESET}\n")
        return 0

    # -- Delete ---------------------------------------------------------------
    print(f"\n  {C_RED}{C_BOLD}MODE: PURGING GLB FILES FROM R2{C_RESET}\n")

    deleted  = 0
    errors   = 0

    for key in glb_keys:
        try:
            s3_client.delete_object(Bucket=bucket_name, Key=key)
            deleted += 1
            short_key = key.replace(prefix, '')
            print(f"  {C_RED}[DELETED] {short_key}{C_RESET}")
        except Exception as error:
            errors += 1
            print(f"  {C_RED}[ERROR] Failed to delete {key}: {error}{C_RESET}")
        sys.stdout.flush()

    # -- Summary --------------------------------------------------------------
    print(f"\n{C_CYAN}{'=' * 80}{C_RESET}")
    print(f"{C_CYAN}{C_BOLD}  PURGE SUMMARY{C_RESET}")
    print(f"{C_CYAN}{'=' * 80}{C_RESET}")
    print(f"  Project        : {project_info['project_code']} ({project_info['project_name']})")
    print(f"  {C_RED}Deleted          : {deleted}{C_RESET}")
    if errors:
        print(f"  {C_RED}Errors           : {errors}{C_RESET}")
    print(f"{C_CYAN}{'=' * 80}{C_RESET}\n")

    return 0 if errors == 0 else 1
    # ------------------------------------------------------------


    # FUNCTION | Run R2 Purge Pipeline
    # ------------------------------------------------------------
def run_r2_purge(project_code: str) -> int:
    """Validate, connect, resolve project, and purge its GLB files from R2."""
    code = project_code.upper()

    print(f"\n{C_CYAN}{C_BOLD}{'=' * 80}{C_RESET}")
    print(f"{C_CYAN}{C_BOLD}  NOBLE ARCHITECTURE - CLOUDFLARE R2 GLB PURGE{C_RESET}")
    print(f"{C_CYAN}{C_BOLD}{'=' * 80}{C_RESET}\n")

    # Validate project code format
    if not PROJECT_CODE_PATTERN.match(code):
        print(f"  {C_RED}[ERROR] Invalid project code format: '{project_code}'{C_RESET}")
        print(f"  {C_YELLOW}        Expected format: two letters + two digits (e.g. RB05, NP03){C_RESET}\n")
        return 1

    # Load credentials
    print(f"  {C_BLUE}[INIT] Loading Cloudflare R2 credentials...{C_RESET}")
    success, credentials = load_r2_credentials()
    if not success:
        return 1
    print(f"  {C_GREEN}[OK] Credentials loaded - Bucket: {credentials['bucket_name']}{C_RESET}\n")

    # Create client
    print(f"  {C_BLUE}[INIT] Connecting to Cloudflare R2...{C_RESET}")
    s3_client = create_r2_client(credentials)
    if not s3_client:
        return 1

    bucket_name = credentials['bucket_name']

    try:
        s3_client.list_objects_v2(Bucket=bucket_name, Prefix=R2_BASE_PREFIX + '/', MaxKeys=1)
        print(f"  {C_GREEN}[OK] Connected to Cloudflare R2 (credentials verified){C_RESET}\n")
    except Exception as error:
        print(f"  {C_RED}[ERROR] R2 connection test failed: {error}{C_RESET}\n")
        return 1

    # Resolve project
    print(f"  {C_BLUE}[RESOLVE] Looking up project code: {code}...{C_RESET}")
    project_info = resolve_project_info(code)

    if not project_info:
        print(f"  {C_RED}[ERROR] Project '{code}' not found in master index or local folders.{C_RESET}\n")
        return 1

    print(f"  {C_GREEN}[OK] Resolved: {project_info['project_folder']} "
          f"({project_info['project_name']}){C_RESET}\n")

    return purge_project_glbs(s3_client, bucket_name, project_info)
    # ------------------------------------------------------------

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | Main Entry Point
# -----------------------------------------------------------------------------

    # FUNCTION | Main Sync Execution
    # ------------------------------------------------------------
def run_r2_sync(
    target_project: Optional[str] = None,
    dry_run_only: bool = False,
    auto_confirm_upload: bool = False
):
    """Execute the full R2 sync pipeline. Called by the build script or CLI."""

    print_banner()

    # STEP 1 | Load credentials
    print(f"  {C_BLUE}[INIT] Loading Cloudflare R2 credentials...{C_RESET}")
    success, credentials = load_r2_credentials()
    if not success:
        return 1
    print(f"  {C_GREEN}[OK] Credentials loaded - Bucket: {credentials['bucket_name']}{C_RESET}\n")

    # STEP 2 | Create R2 client
    print(f"  {C_BLUE}[INIT] Connecting to Cloudflare R2...{C_RESET}")
    s3_client = create_r2_client(credentials)
    if not s3_client:
        return 1

    bucket_name = credentials['bucket_name']

    # STEP 2b | Validate credentials with a test request
    try:
        s3_client.list_objects_v2(Bucket=bucket_name, Prefix=R2_BASE_PREFIX + '/', MaxKeys=1)
        print(f"  {C_GREEN}[OK] Connected to Cloudflare R2 (credentials verified){C_RESET}\n")
    except ClientError as error:
        error_code = error.response['Error']['Code']
        print(f"  {C_RED}[ERROR] R2 credential verification failed ({error_code}){C_RESET}")
        print(f"  {C_YELLOW}        Check R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY in:{C_RESET}")
        print(f"  {C_YELLOW}        {SCRIPT_DIR / ENV_FILE_PATH}{C_RESET}")
        print(f"  {C_YELLOW}        The Access Key ID should be a ~32-char alphanumeric string,{C_RESET}")
        print(f"  {C_YELLOW}        not a token name. Find it in Cloudflare Dashboard > R2 > API Tokens.{C_RESET}\n")
        return 1
    except Exception as error:
        print(f"  {C_RED}[ERROR] R2 connection test failed: {error}{C_RESET}\n")
        return 1

    # STEP 3 | Discover year folders
    year_folders = discover_year_folders(PORTAL_ROOT)
    if not year_folders:
        print(f"  {C_YELLOW}[WARNING] No year folders found in {PORTAL_ROOT}{C_RESET}")
        return 0

    print(f"  {C_BLUE}[SCAN] Found {len(year_folders)} year folder(s): "
          f"{', '.join(yf[0] + '-Projects' for yf in year_folders)}{C_RESET}\n")

    # STEP 4 | Discover projects and collect operations
    all_operations = []
    project_op_groups = []

    for year_code, year_path in year_folders:
        year_folder_name = year_path.name
        projects = discover_projects(year_path)

        for project in projects:
            if target_project and project['project_folder'] != target_project:
                continue

            model_groups = discover_model_groups(project['project_path'])
            if not model_groups:
                continue

            project_data_path = (
                project['project_path'] / TRUEVISION_CONTENT_FOLDER / JSON_PROJECT_DATA_FILENAME
            )

            operations = collect_sync_operations(
                s3_client, bucket_name,
                year_folder_name, project, model_groups,
                project_data_path if project_data_path.is_file() else None
            )

            if operations:
                all_operations.extend(operations)
                project_op_groups.append((project, operations))

    if not all_operations:
        print(f"  {C_YELLOW}[INFO] No TrueVision model files found to sync.{C_RESET}\n")
        return 0

    # STEP 5 | Print dry-run preview
    print(f"  {C_YELLOW}{C_BOLD}MODE: DRY RUN (preview){C_RESET}\n")

    for project, operations in project_op_groups:
        print_project_operations(project, operations)

    print_summary(all_operations, dry_run=True)

    needs_upload = any(op['action'] in ('new', 'update') for op in all_operations)

    if dry_run_only:
        return 0

    if not needs_upload:
        print(f"  {C_GREEN}All files are up to date. No uploads needed.{C_RESET}\n")
        return 0

    # STEP 6 | Confirm and upload
    if auto_confirm_upload:
        print(f"  {C_GREEN}[OK] Upload confirmed by caller. Skipping interactive prompt.{C_RESET}\n")
    elif not prompt_confirmation():
        return 0

    print(f"  {C_GREEN}{C_BOLD}MODE: UPLOADING FILES TO R2{C_RESET}\n")

    upload_success = 0
    upload_fail    = 0

    for op in all_operations:
        if op['action'] == 'skip':
            continue

        ok = upload_to_r2(s3_client, bucket_name, op['local_path'], op['r2_key'], op['content_type'])
        if ok:
            upload_success += 1
            print(f"  {C_GREEN}[UPLOADED] {op['r2_key']}{C_RESET}")
        else:
            upload_fail += 1
        sys.stdout.flush()

    print(f"\n  {C_GREEN}{C_BOLD}Upload complete! "
          f"{upload_success} file(s) uploaded, {upload_fail} failed.{C_RESET}\n")
    sys.stdout.flush()

    return 0 if upload_fail == 0 else 1
    # ------------------------------------------------------------

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | CLI Entry Point
# -----------------------------------------------------------------------------

    # CONSTANT | Instructions Text
    # ------------------------------------------------------------
INSTRUCTIONS_TEXT = f"""
{C_CYAN}{C_BOLD}{'=' * 80}{C_RESET}
{C_CYAN}{C_BOLD}  NOBLE ARCHITECTURE - CLOUDFLARE R2 MODEL SYNC UTILITY{C_RESET}
{C_CYAN}{C_BOLD}  Instructions & Usage Guide{C_RESET}
{C_CYAN}{C_BOLD}{'=' * 80}{C_RESET}

  {C_BOLD}OVERVIEW{C_RESET}
  This utility syncs GLB model files and TrueVision project data from
  the local na-project-portal directory to the Cloudflare R2 CDN bucket.
  It can also purge (delete) all GLB files for a specific project.

  {C_BOLD}HOW IT WORKS{C_RESET}
  1. Scans na-project-portal/{{year}}-Projects/ for project folders
  2. Finds all .glb files under 30__TrueVision__AppContent/ subfolders
  3. Compares local file dates against remote R2 timestamps
  4. Shows a dry-run preview of new, updated, and unchanged files
  5. Prompts for confirmation before uploading

  {C_BOLD}COMMANDS{C_RESET}

  {C_GREEN}Default sync (all projects):{C_RESET}
    python CloudflareR2__ModelSync__Main__.py

  {C_GREEN}Dry run only (preview, no upload):{C_RESET}
    python CloudflareR2__ModelSync__Main__.py --dry-run-only

  {C_GREEN}Sync a single project:{C_RESET}
    python CloudflareR2__ModelSync__Main__.py --project RB05__WestFarm

  {C_GREEN}Purge all GLB files for a project:{C_RESET}
    python CloudflareR2__ModelSync__Main__.py --purge RB05

  {C_GREEN}Via the build pipeline (.bat):{C_RESET}
    ProjectVision__BuildScript__.bat
    ProjectVision__BuildScript__.bat --purge RB05

  {C_BOLD}PURGE MODE{C_RESET}
  The --purge flag accepts a project code (e.g. RB05, NP03).
  It resolves the project name from the master index, lists all .glb
  files in the R2 bucket under that project's TrueVision prefix, and
  asks for explicit 'yes' confirmation before deleting them.
  JSON config files are not affected by purge.
  Aliases: --purge, --Purge, --purgeGlb, --PurgeGlb

  {C_BOLD}FILE COMPARISON{C_RESET}
  Files are compared by modification date (local mtime vs R2 LastModified).
  If the local file is newer than the R2 copy, it is marked for update.
  Files with equal or older local dates are skipped.

  {C_BOLD}PROJECT CODE FORMAT{C_RESET}
  Two uppercase letters + two digits: AA00, RB05, NP03, etc.
  The code maps to a project folder like RB05__WestFarm via the
  master project index (ProjectVision__MasterProjectIndex__Core__.json).

  {C_BOLD}CREDENTIALS{C_RESET}
  R2 credentials are loaded from:
    API__Cloudflare/Token__CloudflareR2.env
  Required keys: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
                 R2_BUCKET_NAME, R2_ENDPOINT

{C_CYAN}{C_BOLD}{'=' * 80}{C_RESET}
"""
    # ------------------------------------------------------------


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Noble Architecture - Cloudflare R2 Model Sync Utility',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            'Examples:\n'
            '  python CloudflareR2__ModelSync__Main__.py\n'
            '  python CloudflareR2__ModelSync__Main__.py --dry-run-only\n'
            '  python CloudflareR2__ModelSync__Main__.py --project RB05__WestFarm\n'
            '  python CloudflareR2__ModelSync__Main__.py --purge RB05\n'
            '  python CloudflareR2__ModelSync__Main__.py --instructions\n'
        ),
    )
    parser.add_argument(
        '--dry-run-only',
        action='store_true',
        help='Preview changes only without uploading.',
    )
    parser.add_argument(
        '--project',
        type=str,
        metavar='FOLDER_NAME',
        help='Sync only a specific project folder (e.g. NP03__AshnessClose).',
    )
    parser.add_argument(
        '--purge', '--Purge', '--purgeGlb', '--PurgeGlb',
        dest='purge_project',
        type=str,
        metavar='PROJECT_CODE',
        help='Purge all GLB files from R2 for a project code (e.g. RB05).',
    )
    parser.add_argument(
        '--instructions', '--Instructions',
        dest='show_instructions',
        action='store_true',
        help='Show detailed usage instructions and exit.',
    )

    args = parser.parse_args()

    if args.show_instructions:
        print(INSTRUCTIONS_TEXT)
        raise SystemExit(0)

    try:
        if args.purge_project:
            exit_code = run_r2_purge(project_code=args.purge_project)
        else:
            exit_code = run_r2_sync(
                target_project=args.project,
                dry_run_only=args.dry_run_only,
            )
    except Exception as error:
        import traceback
        print(f"\n{C_RED}{C_BOLD}[FATAL] Unhandled exception:{C_RESET}")
        traceback.print_exc()
        sys.stdout.flush()
        exit_code = 1

    raise SystemExit(exit_code)
