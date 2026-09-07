#!/usr/bin/env python3
# =============================================================================
# NOBLE ARCHITECTURE - LOCAL DEV LAUNCHER (SHARED MODULE)
# =============================================================================
#
# FILE       : ProjectVision__DevLauncher__Shared__.py
# MODULE     : DevLauncherShared
# AUTHOR     : Adam Noble - Noble Architecture
# PURPOSE    : Shared project-discovery logic for the local dev project launcher
# CREATED    : 07-Sep-2026
#
# DESCRIPTION:
# - Builds the merged project list shown on the local dev launcher page
# - Reads the Project Vision master index and merges it with on-disk content
# - Resolves deep links into Project Vision, Project Admin, PlanVision, TrueVision
# - Imported by BOTH local dev servers so the launcher behaves identically:
#     na-apps/ProjectVision__LocalServer__Main__.py                             (port 8090)
#     na-apps/10__NaProjectAdmin__DocumentSystem__CoreAppCode/start_local_server.py (port 8081)
#
# USAGE:
#   import ProjectVision__DevLauncher__Shared__ as dev_launcher
#   directory, filename = dev_launcher.get_landing_file(REPO_ROOT)
#   payload             = dev_launcher.collect_dev_projects(REPO_ROOT)
#
# -----
#
# DEVELOPMENT LOG:
# 07-Sep-2026 - Version 1.0.0
# - Initial release
#   - Extracted from ProjectVision__LocalServer__Main__.py so the Project Admin
#     dev server can serve the same launcher
#
# =============================================================================


# #region ---------------------------------------------------------------------
# REGION | Imports
# -----------------------------------------------------------------------------

import os
import re
import json

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Configuration
# -----------------------------------------------------------------------------

DEV_LANDING_FILENAME        = 'ProjectVision__LocalServer__DevLanding__.html'

APPS_DIR_NAME               = 'na-apps'
PORTAL_DIR_NAME             = 'na-project-portal'

YEAR_FOLDER_PATTERN         = re.compile(r'^(\d{2})-Projects$')
PROJECT_FOLDER_PATTERN      = re.compile(r'^([A-Z]{2}[0-9]{2})(?:__|_-_)')

PROJECT_ADMIN_CONTENT_DIR   = '10__ProjectAdmin__AppContent'
PROJECT_ADMIN_CONFIG_FILE   = 'ProjectAdmin__ProjectConfig__.json'
PROJECT_ADMIN_INVOICES_FILE = 'ProjectAdmin__Invoices__.json'
PROJECT_ADMIN_QUOTE_FILE    = 'ProjectAdmin__Quotation__.json'
PLANVISION_CONTENT_DIR      = '20__PlanVision__AppContent'
PLANVISION_DATA_FILENAME    = 'PlanVision__ProjectData__.json'
TRUEVISION_CONTENT_DIR      = '30__TrueVision__AppContent'
TRUEVISION_DATA_FILENAME    = 'TrueVision__ProjectData__.json'

MASTER_INDEX_RELPATH        = os.path.join(
    '05__ProjectVision__CoreAppCode', '05__AppData', 'ProjectVision__MasterProjectIndex__Core__.json')

DEFAULT_YEAR                = '26'

# SUB-APPLICATION ENTRYPOINTS | Repo-relative paths under /na-apps/
# -----------------------------------------------------------------------------
# Casing matches the files on disk (TrueVision ships Index.html) and mirrors
# Na__AppUtils__UrlQuerySystem.js, so these links do not depend on the host
# filesystem being case-insensitive.
SUB_APP_PATHS = {
    'projectVision' : '05__ProjectVision__CoreAppCode/index.html',
    'projectAdmin'  : '10__NaProjectAdmin__DocumentSystem__CoreAppCode/index.html',
    'planVision'    : '20__PlanVision__CoreAppCode/PlanVision__WebApp__Main__.html',
    'trueVision'    : '30__TrueVision__CoreAppCode/Index.html'
}

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Path Helpers
# -----------------------------------------------------------------------------

def get_apps_dir(repo_root):
    """Absolute path to the na-apps directory."""
    return os.path.join(repo_root, APPS_DIR_NAME)


def get_portal_root(repo_root):
    """Absolute path to the na-project-portal directory."""
    return os.path.join(repo_root, PORTAL_DIR_NAME)


def get_landing_file(repo_root):
    """
    Locate the dev launcher HTML page.
    Returns (directory, filename) for send_from_directory, or None when missing.
    """
    apps_dir = get_apps_dir(repo_root)

    if os.path.isfile(os.path.join(apps_dir, DEV_LANDING_FILENAME)):
        return apps_dir, DEV_LANDING_FILENAME

    return None


def _read_json_file(file_path):
    """Read a JSON file, returning None when missing or unreadable."""
    if not file_path or not os.path.isfile(file_path):
        return None

    try:
        with open(file_path, 'r', encoding='utf-8-sig') as file_handle:
            return json.load(file_handle)
    except Exception as error:
        print(f"[DevLauncher] Could not parse JSON: {file_path} ({type(error).__name__}: {error})")
        return None


def _build_sub_app_url(sub_app_key, project_code, project_folder, project_year):
    """Build a repo-root-relative sub-application URL with project query params."""
    sub_app_path = SUB_APP_PATHS.get(sub_app_key)
    if not sub_app_path or not project_code:
        return None

    query_parts = [f"project={project_code}"]

    if project_folder:
        query_parts.append(f"project-folder={project_folder}")

    if project_year:
        query_parts.append(f"year={project_year}")

    return f"/{APPS_DIR_NAME}/{sub_app_path}?{'&'.join(query_parts)}"

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Per-Application Content Summaries
# -----------------------------------------------------------------------------

def _summarise_project_admin(project_dir):
    """Read Project Admin content for description, address, PIN and unpaid invoices."""
    summary = {
        'onDisk'          : False,
        'description'     : '',
        'quoteDescription': '',
        'address'         : '',
        'projectName'     : '',
        'projectPin'      : '',
        'unpaidInvoices'  : 0
    }

    if not project_dir:
        return summary

    config_path = os.path.join(project_dir, PROJECT_ADMIN_CONTENT_DIR, PROJECT_ADMIN_CONFIG_FILE)
    config_data = _read_json_file(config_path)

    if isinstance(config_data, dict):
        summary['onDisk']      = True
        summary['description'] = config_data.get('projectDescription') or ''
        summary['projectName'] = config_data.get('projectName') or ''

        raw_pin = config_data.get('projectPin')
        # Hashed PINs (sha256:...) are not useful on the launcher, so show plain PINs only.
        if isinstance(raw_pin, str) and raw_pin.isdigit():
            summary['projectPin'] = raw_pin

    # FALLBACK | The quotation usually carries the description and site address
    quote_path = os.path.join(project_dir, PROJECT_ADMIN_CONTENT_DIR, PROJECT_ADMIN_QUOTE_FILE)
    quote_data = _read_json_file(quote_path)

    if isinstance(quote_data, dict):
        summary['quoteDescription'] = quote_data.get('projectDescription') or ''
        summary['address']          = quote_data.get('projectAddress') or ''

    invoices_path = os.path.join(project_dir, PROJECT_ADMIN_CONTENT_DIR, PROJECT_ADMIN_INVOICES_FILE)
    invoices_data = _read_json_file(invoices_path)

    if isinstance(invoices_data, dict):
        invoices = invoices_data.get('invoices')
        if isinstance(invoices, list):
            summary['unpaidInvoices'] = sum(
                1 for invoice in invoices
                if isinstance(invoice, dict) and str(invoice.get('status', '')).lower() not in ('paid', 'cancelled', 'void')
            )

    return summary


def _summarise_plan_vision(project_dir):
    """Read PlanVision content for the active phase and total drawing count."""
    summary = {
        'onDisk'        : False,
        'activePhase'   : '',
        'drawingCount'  : 0,
        'projectName'   : '',
        'description'   : '',
        'address'       : ''
    }

    if not project_dir:
        return summary

    data_path = os.path.join(project_dir, PLANVISION_CONTENT_DIR, PLANVISION_DATA_FILENAME)
    data      = _read_json_file(data_path)

    if not isinstance(data, dict):
        return summary

    summary['onDisk'] = True

    library = data.get('na-project-data-library')
    if not isinstance(library, dict):
        return summary

    details = library.get('project-details')
    if isinstance(details, dict):
        summary['projectName'] = details.get('project-name') or ''
        summary['description'] = details.get('project-description') or ''
        summary['address']     = details.get('project-address') or ''

    phase_config = library.get('project-phase-config')
    if isinstance(phase_config, dict):
        summary['activePhase'] = phase_config.get('active-design-phase') or ''

    documentation = library.get('project-documentation')
    if isinstance(documentation, dict):
        phase_content = documentation.get('phase-content')
        if isinstance(phase_content, dict):
            for phase in phase_content.values():
                if not isinstance(phase, dict):
                    continue
                for folder in phase.get('folder-structure') or []:
                    if isinstance(folder, dict) and isinstance(folder.get('files'), list):
                        summary['drawingCount'] += len(folder['files'])

    return summary


def _summarise_true_vision(project_dir):
    """Read TrueVision content for the model group (scene) count."""
    summary = {
        'onDisk'      : False,
        'sceneCount'  : 0,
        'projectName' : ''
    }

    if not project_dir:
        return summary

    data_path = os.path.join(project_dir, TRUEVISION_CONTENT_DIR, TRUEVISION_DATA_FILENAME)
    data      = _read_json_file(data_path)

    if not isinstance(data, dict):
        return summary

    summary['onDisk']      = True
    summary['projectName'] = data.get('projectName') or ''

    model_groups = data.get('modelGroups')
    if isinstance(model_groups, list):
        summary['sceneCount'] = len(model_groups)

    return summary

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Project Discovery and Merge
# -----------------------------------------------------------------------------

def _scan_portal_folders(repo_root):
    """Map every on-disk project folder to its year: { 'NP03': ('26', 'NP03__AshnessClose') }."""
    discovered  = {}
    portal_root = get_portal_root(repo_root)

    if not os.path.isdir(portal_root):
        return discovered

    for year_entry in sorted(os.listdir(portal_root)):
        year_match = YEAR_FOLDER_PATTERN.match(year_entry)
        if not year_match:
            continue

        year_code = year_match.group(1)
        year_path = os.path.join(portal_root, year_entry)

        if not os.path.isdir(year_path):
            continue

        for project_folder in sorted(os.listdir(year_path)):
            if not os.path.isdir(os.path.join(year_path, project_folder)):
                continue

            code_match = PROJECT_FOLDER_PATTERN.match(project_folder)
            if not code_match:
                continue

            discovered[code_match.group(1)] = (year_code, project_folder)

    return discovered


def _describe_project(repo_root, project_code, project_name, project_folder,
                      project_year, indexed, indexed_sub_apps):
    """Merge master-index metadata with the on-disk content for one project."""
    portal_root   = get_portal_root(repo_root)
    project_dir   = os.path.join(portal_root, f"{project_year}-Projects", project_folder) if project_folder else ''
    folder_exists = bool(project_dir) and os.path.isdir(project_dir)

    lookup_dir = project_dir if folder_exists else ''

    admin = _summarise_project_admin(lookup_dir)
    plans = _summarise_plan_vision(lookup_dir)
    three = _summarise_true_vision(lookup_dir)

    # RESOLVE | Prefer the richest name and description available
    resolved_name = (
        project_name
        or admin['projectName']
        or plans['projectName']
        or three['projectName']
        or project_code
    )
    resolved_desc = admin['description'] or plans['description'] or admin['quoteDescription']
    resolved_addr = admin['address'] or plans['address']

    # AVAILABILITY | On-disk content decides, because that is what will actually load.
    #                The master index flag is reported alongside so a stale index shows up.
    sub_apps       = {}
    index_is_stale = False

    for key, on_disk in (
        ('projectAdmin', admin['onDisk']),
        ('planVision',   plans['onDisk']),
        ('trueVision',   three['onDisk'])
    ):
        on_disk    = bool(on_disk)
        is_indexed = bool(indexed_sub_apps.get(key))

        if indexed and is_indexed != on_disk:
            index_is_stale = True

        sub_apps[key] = {
            'available' : on_disk,
            'indexed'   : is_indexed,
            'onDisk'    : on_disk,
            'url'       : _build_sub_app_url(key, project_code, project_folder, project_year) if on_disk else None
        }

    return {
        'projectCode'    : project_code,
        'projectName'    : resolved_name,
        'projectFolder'  : project_folder or '',
        'projectYear'    : project_year or '',
        'indexed'        : bool(indexed),
        'indexStale'     : index_is_stale,
        'folderExists'   : folder_exists,
        'description'    : resolved_desc,
        'address'        : resolved_addr,
        'projectPin'     : admin['projectPin'],
        'unpaidInvoices' : admin['unpaidInvoices'],
        'activePhase'    : plans['activePhase'],
        'drawingCount'   : plans['drawingCount'],
        'sceneCount'     : three['sceneCount'],
        'isLive'         : any(entry['available'] for entry in sub_apps.values()),
        'subApps'        : sub_apps,
        'hubUrl'         : _build_sub_app_url('projectVision', project_code, project_folder, project_year)
    }


def collect_dev_projects(repo_root, default_year=DEFAULT_YEAR):
    """Build the merged project list used by the local dev launcher page."""
    master_index = _read_json_file(os.path.join(get_apps_dir(repo_root), MASTER_INDEX_RELPATH)) or {}
    indexed      = master_index.get('projects') if isinstance(master_index.get('projects'), dict) else {}
    on_disk      = _scan_portal_folders(repo_root)

    projects = []

    # INDEXED PROJECTS | Everything the master index knows about
    for project_code, entry in indexed.items():
        if not isinstance(entry, dict):
            continue

        project_year   = str(entry.get('projectYear') or default_year)
        project_folder = entry.get('projectFolder') or ''

        # Fall back to the on-disk folder when the index entry is incomplete.
        if not project_folder and project_code in on_disk:
            project_year, project_folder = on_disk[project_code]

        projects.append(_describe_project(
            repo_root        = repo_root,
            project_code     = project_code,
            project_name     = entry.get('projectName') or '',
            project_folder   = project_folder,
            project_year     = project_year,
            indexed          = True,
            indexed_sub_apps = entry.get('subApps') if isinstance(entry.get('subApps'), dict) else {}
        ))

    # UNINDEXED PROJECTS | On disk but missing from the master index
    for project_code, (project_year, project_folder) in on_disk.items():
        if project_code in indexed:
            continue

        projects.append(_describe_project(
            repo_root        = repo_root,
            project_code     = project_code,
            project_name     = '',
            project_folder   = project_folder,
            project_year     = project_year,
            indexed          = False,
            indexed_sub_apps = {}
        ))

    # SORT | Newest year first, then projects that have content, then by code
    def _sort_key(item):
        year = item['projectYear']
        return (
            0 if year.isdigit() else 1,                    # <-- Unknown years last
            -int(year) if year.isdigit() else 0,           # <-- Newest year first
            0 if item['isLive'] else 1,                    # <-- Projects with content first
            item['projectCode']
        )

    projects.sort(key=_sort_key)

    years = sorted({item['projectYear'] for item in projects if item['projectYear']}, reverse=True)

    return {
        'currentYear' : years[0] if years else default_year,
        'years'       : years,
        'projects'    : projects
    }

# endregion -------------------------------------------------------------------
