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

from datetime import datetime

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
PROJECT_ADMIN_QUOTE_FILES   = ('ProjectAdmin__Quotation__.json', 'ProjectAdmin__Quotations__.json')
PLANVISION_CONTENT_DIR      = '20__PlanVision__AppContent'
PLANVISION_DATA_FILENAME    = 'PlanVision__ProjectData__.json'
TRUEVISION_CONTENT_DIR      = '30__TrueVision__AppContent'
TRUEVISION_DATA_FILENAME    = 'TrueVision__ProjectData__.json'

MASTER_INDEX_RELPATH        = os.path.join(
    '05__ProjectVision__CoreAppCode', '05__AppData', 'ProjectVision__MasterProjectIndex__Core__.json')

DEFAULT_YEAR                = '26'

# LAST-TOUCHED SCAN | Newest file modification time inside a project folder
# -----------------------------------------------------------------------------
# The launcher orders cards by the job last worked on, which means reading real
# file times rather than a recorded date. The whole portal walks in well under a
# tenth of a second, so this runs on every request and never needs a cache.
NA_MONTH_NAMES              = ('Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                               'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec')

TOUCH_SCAN_SKIP_DIRS        = {'.git', '.vs', '__pycache__', 'node_modules', '.idea'}
TOUCH_SCAN_SKIP_FILES       = {'Thumbs.db', 'desktop.ini', '.DS_Store'}
TOUCH_SCAN_FILE_LIMIT       = 20000                                  # <-- Safety stop, well above a real project

# The redirect stubs that sit at the top of every project folder are generated
# in bulk, so they all carry the same timestamp and say nothing about the job.
# Left in, they drag a project last opened in 2025 to the top of the list.
TOUCH_SCAN_SKIP_ROOT_FILES  = {
    'ProjectVision-WebApp.html',
    'PlanVision-WebApp.html',
    'TrueVision-WebApp.html'
}

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


def _parse_na_date(raw_value):
    """
    Parse the several date shapes written by the Noble Architecture apps into a
    sortable ISO-8601 string. Returns None when the value is absent or unparseable.

    Recognised shapes:
        "07-Sep-2026"                  <-- ProjectAdmin createdDate
        "07-Sep-2026 at 21:58"         <-- ProjectAdmin lastModified (human form)
        "2026-02-20T15:19:58.646Z"     <-- ProjectAdmin lastModified (ISO form)
        "2026-02-20"                   <-- Plain ISO date
    """
    if not isinstance(raw_value, str):
        return None

    value = raw_value.strip()
    if not value:
        return None

    # HUMAN FORM | "07-Sep-2026" with an optional " at HH:MM" tail
    human_match = re.match(
        r'^(\d{1,2})-([A-Za-z]{3})-(\d{4})(?:\s+at\s+(\d{1,2}):(\d{2}))?$', value)

    if human_match:
        day, month_name, year, hour, minute = human_match.groups()
        try:
            parsed = datetime.strptime(f"{day}-{month_name.title()}-{year}", '%d-%b-%Y')
        except ValueError:
            return None
        if hour is not None:
            parsed = parsed.replace(hour=int(hour), minute=int(minute))
        return parsed.isoformat()

    # ISO FORM | Trailing Z is not understood by fromisoformat before Python 3.11
    iso_candidate = value[:-1] + '+00:00' if value.endswith('Z') else value

    try:
        return datetime.fromisoformat(iso_candidate).replace(tzinfo=None).isoformat()
    except ValueError:
        return None


def _invert_iso(iso_value):
    """
    Turn an ISO-8601 string into a negative ordinal so an ascending sort reads
    newest first. Returns 0.0 for an empty or unparseable value.
    """
    if not iso_value:
        return 0.0

    try:
        return -datetime.fromisoformat(iso_value).timestamp()
    except (ValueError, OSError, OverflowError):
        return 0.0


def _newest_file_mtime(project_dir):
    """
    Find when a project was last actually worked on, by reading the newest file
    modification time anywhere inside its folder.

    This is deliberately not the Project Admin createdDate, nor the lastModified
    field written into the admin JSON. Saving drawings, dropping in a survey or
    re-rendering a sheet all touch files without ever rewriting that field, so a
    recorded date says when the job was opened, not when it was last touched.

    Returns (iso_string, house_date_string), both empty when nothing is readable.
    """
    if not project_dir or not os.path.isdir(project_dir):
        return '', ''

    newest    = 0.0
    inspected = 0

    for dir_path, dir_names, file_names in os.walk(project_dir):
        dir_names[:] = [name for name in dir_names if name not in TOUCH_SCAN_SKIP_DIRS]   # <-- Prune in place, so os.walk never descends

        at_project_root = os.path.normpath(dir_path) == os.path.normpath(project_dir)

        for file_name in file_names:
            if file_name in TOUCH_SCAN_SKIP_FILES:                                        # <-- OS clutter is not project work
                continue

            if at_project_root and file_name in TOUCH_SCAN_SKIP_ROOT_FILES:               # <-- Generated redirect stub, not project work
                continue

            inspected += 1
            if inspected > TOUCH_SCAN_FILE_LIMIT:                                         # <-- Guard against an asset folder that grows without bound
                break

            try:
                modified = os.stat(os.path.join(dir_path, file_name)).st_mtime
            except OSError:
                continue

            if modified > newest:
                newest = modified

        if inspected > TOUCH_SCAN_FILE_LIMIT:
            break

    if not newest:
        return '', ''

    stamp = datetime.fromtimestamp(newest)

    return stamp.isoformat(), _format_na_date(stamp)


def _format_na_date(stamp):
    """Render a datetime in the Noble Architecture house format, 17-Sep-2026."""
    return f"{stamp.day:02d}-{NA_MONTH_NAMES[stamp.month - 1]}-{stamp.year}"


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
        'unpaidInvoices'  : 0,
        'createdDate'     : '',
        'createdSort'     : '',
        'modifiedSort'    : ''
    }

    if not project_dir:
        return summary

    config_path = os.path.join(project_dir, PROJECT_ADMIN_CONTENT_DIR, PROJECT_ADMIN_CONFIG_FILE)
    config_data = _read_json_file(config_path)

    if isinstance(config_data, dict):
        summary['onDisk']      = True
        summary['description'] = config_data.get('projectDescription') or ''
        summary['projectName'] = config_data.get('projectName') or ''

        # RECENCY | createdDate is when the job was opened - the launcher sorts on it
        summary['createdDate']  = config_data.get('createdDate') or ''
        summary['createdSort']  = _parse_na_date(config_data.get('createdDate')) or ''
        summary['modifiedSort'] = _parse_na_date(config_data.get('lastModified')) or ''

        raw_pin = config_data.get('projectPin')
        # Hashed PINs (sha256:...) are not useful on the launcher, so show plain PINs only.
        if isinstance(raw_pin, str) and raw_pin.isdigit():
            summary['projectPin'] = raw_pin

    # FALLBACK | The quotation usually carries the description and site address
    # -------------------------------------------------------------------------
    # Two file names are in use across the portal: the older single-quotation
    # file, and the newer one holding a `quotations` list. Reading only the
    # first left every project on the newer format with no address at all.
    for quote_filename in PROJECT_ADMIN_QUOTE_FILES:
        quote_path = os.path.join(project_dir, PROJECT_ADMIN_CONTENT_DIR, quote_filename)
        quote_data = _read_json_file(quote_path)

        if not isinstance(quote_data, dict):
            continue

        entries = quote_data['quotations'] if isinstance(quote_data.get('quotations'), list) else [quote_data]

        for entry in entries:
            if not isinstance(entry, dict):
                continue
            if not summary['quoteDescription']:
                summary['quoteDescription'] = entry.get('projectDescription') or ''
            if not summary['address']:
                summary['address'] = entry.get('projectAddress') or ''

        if summary['address'] and summary['quoteDescription']:
            break

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

    # RECENCY | createdDate is the primary "newest job" signal, lastModified the fallback
    created_sort  = admin['createdSort']
    modified_sort = admin['modifiedSort']
    recency_sort  = created_sort or modified_sort or ''

    # LAST TOUCHED | When the folder itself last changed, which is real work done
    touched_sort, touched_date = _newest_file_mtime(lookup_dir)

    return {
        'projectCode'    : project_code,
        'projectName'    : resolved_name,
        'projectFolder'  : project_folder or '',
        'projectYear'    : project_year or '',
        'createdDate'    : admin['createdDate'],
        'createdSort'    : created_sort,
        'modifiedSort'   : modified_sort,
        'recencySort'    : recency_sort,
        'touchedDate'    : touched_date,
        'touchedSort'    : touched_sort,
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

    # SORT | Last worked on first
    # -------------------------------------------------------------------------
    # The launcher exists to get straight into the job just worked on, so the
    # newest file time inside the folder leads: drawings saved this afternoon
    # beat a project opened last year. Projects whose folder cannot be read fall
    # back to the recorded date, then to the back, newest year first, then code.
    def _sort_key(item):
        year      = item['projectYear']
        recency   = item['touchedSort'] or item['recencySort']
        year_rank = -int(year) if year.isdigit() else 0

        return (
            0 if recency else 1,                           # <-- Dated projects first
            _invert_iso(recency),                          # <-- Newest date first
            0 if year.isdigit() else 1,                    # <-- Unknown years last
            year_rank,                                     # <-- Newest year first
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
