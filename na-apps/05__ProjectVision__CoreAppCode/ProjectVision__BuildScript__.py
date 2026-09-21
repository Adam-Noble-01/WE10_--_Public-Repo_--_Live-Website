#!/usr/bin/env python3
# =============================================================================
# NOBLE ARCHITECTURE - PROJECT VISION BUILD SCRIPT
# =============================================================================
#
# FILE       : ProjectVision__BuildScript__.py
# AUTHOR     : Adam Noble - Noble Architecture
# PURPOSE    : Scan the project portal, validate project structures, and
#              generate the master project index for Project Vision
# CREATED    : 27-Feb-2026
#
# DESCRIPTION:
# - Scans na-project-portal/{year}-Projects/ for project directories
# - Validates project codes against [A-Z]{2}[0-9]{2} format
# - Checks sub-app content availability (ProjectAdmin, PlanVision, TrueVision)
# - Writes ProjectVision__MasterProjectIndex__Core__.json
# - Generates per-project ProjectVision-WebApp.html redirect files
# - Updates AppConfiguration__ProjectKeysIndex__.json for Project Admin
# - Writes q/index.json at the website root: the index the Project QR Code
#   resolver (q/index.html) reads to turn the short address printed on every
#   TrueVision drawing into the project's model. See build_qr_link_index.
#
# USAGE:
#   python ProjectVision__BuildScript__.py
#   python ProjectVision__BuildScript__.py --portal-root "D:\path\to\na-project-portal"
#   python ProjectVision__BuildScript__.py --qr-index-only      (rewrites q/index.json and nothing else)
#
# =============================================================================

import os
import re
import json
import argparse
from pathlib import Path
from datetime import datetime, timezone

from ProjectVision__DasBuilder__ import is_das_folder, run_das_builds
from ProjectVision__FileWriter__ import write_json_file, write_text_file


# =============================================================================
# CONSTANTS
# =============================================================================

PROJECT_CODE_PATTERN = re.compile(r'^[A-Z]{2}[0-9]{2}$')
YEAR_FOLDER_PATTERN  = re.compile(r'^(\d{2})-Projects$')
PROJECT_DIR_PATTERN  = re.compile(r'^([A-Z]{2}[0-9]{2})(?:__|_-_)(.+)$')

PLACEHOLDER_FILES = {
    'PlanVisionContent__FilesHere__.txt',
    'TrueVisionContent__FilesHere__.txt',
    'OldVersion__FilesHere__.txt',
}

LIVE_DOMAIN = 'https://www.noble-architecture.com'
CDN_BASE_URL = 'https://cdn.noble-architecture.com'
R2_BASE_PREFIX = 'NaProjectPortal'
TRUEVISION_CONTENT_FOLDER = '30__TrueVision__AppContent'
SITEPLAN_FOLDER_NAME = 'SitePlan__DrawingData'                    # TrueVision site plan store: never a design phase
SITEPLAN_FOLDER_PREFIX = 'SitePlan__DrawingData'                  # Every site plan folder starts with this, so one test finds them all
SITEPLAN_STORES = [                                               # A project may hold the site as found AND the scheme
    {'id': 'existing', 'label': 'Existing Site Plan', 'folder': 'SitePlan__DrawingData__Existing'},
    {'id': 'proposed', 'label': 'Proposed Site Plan', 'folder': 'SitePlan__DrawingData__Proposed'},
    # The original single folder. Read as the PROPOSED store and never renamed:
    # live TrueVision projects and published R2 keys point at this name.
    {'id': 'proposed', 'label': 'Proposed Site Plan', 'folder': SITEPLAN_FOLDER_NAME, 'legacy': True},
]
SITEPLAN_MANIFEST_FILENAME = 'TrueVision__SitePlanData__Manifest__.json'
SITEPLAN_FILE_PATTERN = re.compile(r'^(?:.*?__)?(TrueVision__SitePlan__[A-Za-z0-9]+)__(LineworkModel|FillModel)__\.glb$', re.IGNORECASE)
PLANVISION_CONTENT_FOLDER = '20__PlanVision__AppContent'
PLANVISION_DATA_FILENAME  = 'PlanVision__ProjectData__.json'
GLB_FILE_PATTERN = re.compile(r'^.+\.glb$', re.IGNORECASE)
DRAWING_FILE_PATTERN = re.compile(r'^.+\.(png|pdf)$', re.IGNORECASE)
PHASE_FOLDER_PATTERN = re.compile(r'^DesignPhase\d+__(.+)$')
SKIP_FOLDER_PREFIXES = ('.', '00__')

# TrueVision Dev-menu-owned keys. These are written live to R2 by the
# TrueVision Dev menu (Save Camera, Orbit Max, Navigation Modes, Presentation
# Scenes). When this build script regenerates the local project data JSON it
# must preserve any existing values for these keys so a build does not wipe
# dev-authored settings. Keep in sync with DEV_OWNED_PROJECT_DATA_KEYS in
# CloudflareR2__ModelSync__Main__.py and Na__DevSavedKeys in the TrueVision app.
TRUEVISION_DEV_OWNED_KEYS = (
    'PresentationMode__SavedCameraScenes',
    'Navmode__EnabledModes',
    'Navmode__OrbitMaxDistanceMm',
    'RenderEffect__AssetCullDistanceMm',
    'Navmode__FovOverrides',
    'Camera__DefaultPosition',
    'OrbitHelperCube__Position',
    'LayoutEditor__DrawingsData',
)


# =============================================================================
# PATH RESOLUTION
# =============================================================================

def resolve_paths(portal_root):
    """Resolve all output paths relative to the portal root."""
    repo_root = os.path.dirname(portal_root)

    return {
        'portal_root'       : portal_root,
        'repo_root'         : repo_root,
        'master_index_path' : os.path.join(
            repo_root, 'na-apps',
            '05__ProjectVision__CoreAppCode',
            '05__AppData',
            'ProjectVision__MasterProjectIndex__Core__.json'
        ),
        'project_keys_path' : os.path.join(
            repo_root, 'na-apps',
            '10__NaProjectAdmin__DocumentSystem__CoreAppCode',
            '03__Src__AppModules', '02__AppData',
            'AppConfiguration__ProjectKeysIndex__.json'
        ),
        # The website root's q/ folder. PRINTED QR CODES POINT AT IT, so the
        # folder name is one letter on purpose and must never change: see
        # build_qr_link_index.
        'qr_index_path'     : os.path.join(repo_root, 'q', 'index.json'),
    }


# =============================================================================
# PROJECT DISCOVERY
# =============================================================================

def discover_year_folders(portal_root):
    """Find all {NN}-Projects directories in the portal root."""
    year_folders = []

    if not os.path.isdir(portal_root):
        print(f'  [WARNING] Portal root not found: {portal_root}')
        return year_folders

    for entry in sorted(os.listdir(portal_root)):
        match = YEAR_FOLDER_PATTERN.match(entry)
        if match and os.path.isdir(os.path.join(portal_root, entry)):
            year_folders.append((match.group(1), entry))

    return year_folders


def discover_projects(portal_root, year_code, year_folder_name):
    """Find all valid project directories within a year folder."""
    projects = []
    year_path = os.path.join(portal_root, year_folder_name)

    if not os.path.isdir(year_path):
        return projects

    for entry in sorted(os.listdir(year_path)):
        entry_path = os.path.join(year_path, entry)
        if not os.path.isdir(entry_path):
            continue

        match = PROJECT_DIR_PATTERN.match(entry)
        if not match:
            continue

        project_code = match.group(1)
        if not PROJECT_CODE_PATTERN.match(project_code):
            print(f'  [WARNING] Invalid project code in folder name: {entry}')
            continue

        projects.append({
            'projectCode'   : project_code,
            'projectFolder' : entry,
            'projectYear'   : year_code,
            'folderPath'    : entry_path,
        })

    return projects


# =============================================================================
# CONTENT DETECTION
# =============================================================================

def dir_has_real_content(dir_path):
    """Check if a directory contains files beyond placeholder .txt files."""
    if not os.path.isdir(dir_path):
        return False

    for root, _dirs, files in os.walk(dir_path):
        for f in files:
            if f not in PLACEHOLDER_FILES:
                return True

    return False


def read_project_config(project_path):
    """Read ProjectAdmin__ProjectConfig__.json if it exists."""
    config_path = os.path.join(
        project_path,
        '10__ProjectAdmin__AppContent',
        'ProjectAdmin__ProjectConfig__.json'
    )

    if not os.path.isfile(config_path):
        return None

    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        print(f'  [WARNING] Failed to read config: {config_path} ({e})')
        return None


def detect_sub_app_availability(project_path):
    """Determine which sub-apps have content for a project."""
    admin_config_exists = os.path.isfile(os.path.join(
        project_path,
        '10__ProjectAdmin__AppContent',
        'ProjectAdmin__ProjectConfig__.json'
    ))

    plan_vision_dir = os.path.join(project_path, '20__PlanVision__AppContent')
    plan_vision_has_content = dir_has_real_content(plan_vision_dir)

    true_vision_dir = os.path.join(project_path, '30__TrueVision__AppContent')
    true_vision_has_content = dir_has_real_content(true_vision_dir)

    return {
        'projectAdmin' : admin_config_exists,
        'planVision'   : plan_vision_has_content,
        'trueVision'   : true_vision_has_content,
    }


# =============================================================================
# OUTPUT GENERATORS
# =============================================================================

def build_master_index(all_projects):
    """Build the master project index JSON structure."""
    projects_dict = {}

    for proj in all_projects:
        projects_dict[proj['projectCode']] = {
            'projectCode'   : proj['projectCode'],
            'projectName'   : proj['projectName'],
            'projectFolder' : proj['projectFolder'],
            'projectYear'   : proj['projectYear'],
            'subApps'       : proj['subApps'],
        }

    return {
        'buildTimestamp' : datetime.now(timezone.utc).isoformat(),
        'projects'       : projects_dict,
    }


def build_qr_link_index(all_projects):
    """Build q/index.json: what the Project QR Code resolver looks a code up in.

    Every TrueVision drawing, register and specification carries one QR code.
    It encodes https://www.noble-architecture.com/q/?PS01 - 42 bytes, which is
    exactly what a 29 module symbol holds - and q/index.html reads this file to
    send the phone on to the project's full TrueVision address. The long address
    would need a 49 module symbol, which a phone cannot read at title block size.

    EVERY valid project is listed, whether or not it has TrueVision content yet.
    A printed code sits in a site bag for years, and it must never stop working
    because a content check changed its mind about a folder.

    The shape - projects, keyed by code, with projectFolder and projectYear -
    is the master index's on purpose: the resolver falls back to that file, and
    reads both the same way. Do not rename these keys without changing
    q/index.html in the same commit.
    """
    projects_dict = {}

    for proj in sorted(all_projects, key=lambda p: p['projectCode']):
        projects_dict[proj['projectCode']] = {
            'projectFolder' : proj['projectFolder'],
            'projectYear'   : proj['projectYear'],
        }

    return {
        'q__Description' : (
            'GENERATED by na-apps/05__ProjectVision__CoreAppCode/ProjectVision__BuildScript__.py '
            'on every build - never edit by hand. Read by q/index.html, which turns the short '
            'address printed in the QR code on every TrueVision drawing (/q/?PS01) into the '
            'project\'s full TrueVision address. PRINTED CODES DEPEND ON THIS FOLDER: it must '
            'never be moved, renamed or removed.'
        ),
        'buildTimestamp' : datetime.now(timezone.utc).isoformat(),
        'projects'       : projects_dict,
    }


def build_project_keys_index(all_projects, existing_keys_path):
    """Build the ProjectKeysIndex JSON, preserving existing year entries."""
    index = {}

    if os.path.isfile(existing_keys_path):
        try:
            with open(existing_keys_path, 'r', encoding='utf-8') as f:
                index = json.load(f)
        except (json.JSONDecodeError, OSError):
            pass

    for year_str in [str(y) for y in range(20, 27)]:
        if year_str not in index:
            index[year_str] = {}

    for proj in all_projects:
        year = proj['projectYear']
        code = proj['projectCode']
        folder = proj['projectFolder']

        if year not in index:
            index[year] = {}

        index[year][code] = folder

    return dict(sorted(index.items(), key=lambda x: x[0]))


def generate_redirect_html(project_code, project_name, project_folder):
    """Generate the ProjectVision-WebApp.html redirect content."""
    target_url = (
        f'{LIVE_DOMAIN}/na-apps/05__ProjectVision__CoreAppCode/index.html'
        f'?project={project_code}&project-folder={project_folder}'
    )

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="0; url={target_url}">
    <title>Redirecting to Project Vision...</title>
    <style>
        @font-face {{
            font-family   :  'Open Sans';
            font-style    :  normal;
            font-weight   :  400;
            src           :  url('{LIVE_DOMAIN}/assets/AD04_-_LIBR_-_Common_-_Front-Files/AD04_01_-_Standard-Font_-_Open-Sans-Regular.ttf') format('truetype');
            font-display  :  swap;
        }}

        body {{
            font-family      :  'Open Sans', Arial, sans-serif;
            background-color :  #f8f7f5;
            display          :  flex;
            justify-content  :  center;
            align-items      :  center;
            min-height       :  100vh;
            margin           :  0;
            color            :  #555041;
        }}

        .redirect-message {{
            text-align    :  center;
            padding       :  40px;
            background    :  white;
            border        :  2px solid #555041;
            border-radius :  8px;
            max-width     :  500px;
        }}

        .redirect-message h1 {{
            color          :  #555041;
            margin-bottom  :  20px;
            font-size      :  22px;
        }}

        .redirect-message p {{
            margin-bottom  :  20px;
            line-height    :  1.6;
        }}

        .redirect-message a {{
            color            :  #555041;
            text-decoration  :  underline;
        }}
    </style>
</head>
<body>
    <div class="redirect-message">
        <h1>Redirecting to Project Vision...</h1>
        <p>You are being redirected to the {project_name} Project Hub.</p>
        <p>If you are not redirected automatically, <a href="{target_url}">click here</a>.</p>
    </div>

    <script>
        setTimeout(function() {{
            window.location.href = '{target_url}';
        }}, 100);
    </script>
</body>
</html>
'''


# =============================================================================
# TRUEVISION PROJECT DATA GENERATION
# =============================================================================

def discover_truevision_model_groups(project_path, year_folder_name, project_folder):
    """Discover model group subfolders and their GLB files under TrueVision content."""
    tv_path = os.path.join(project_path, TRUEVISION_CONTENT_FOLDER)
    groups = []

    if not os.path.isdir(tv_path):
        return groups

    for entry in sorted(os.listdir(tv_path)):
        entry_path = os.path.join(tv_path, entry)
        if not os.path.isdir(entry_path):
            continue
        if entry.startswith('.') or entry.startswith('00__'):
            continue
        if entry.startswith(SITEPLAN_FOLDER_PREFIX):
            continue                                                   # Site plan data is its own store (SitePlan__DataStores), not a design phase

        glb_files = sorted([
            f for f in os.listdir(entry_path)
            if os.path.isfile(os.path.join(entry_path, f)) and GLB_FILE_PATTERN.match(f)
        ])

        if not glb_files:
            continue

        model_urls = [
            f"{CDN_BASE_URL}/{R2_BASE_PREFIX}/{year_folder_name}/{project_folder}"
            f"/{TRUEVISION_CONTENT_FOLDER}/{entry}/{f}"
            for f in glb_files
        ]

        label = parse_group_label(entry)

        groups.append({
            'groupId'   : entry,
            'label'     : label,
            'modelUrls' : model_urls,
        })

    return groups


def discover_truevision_siteplan_store(project_path, year_folder_name, project_folder,
                                       store_folder=SITEPLAN_FOLDER_NAME, store_id='proposed'):
    """Describe ONE of the project's site plan stores for TrueVision.

    The GLB Builder's Site Plan Export writes one linework GLB per site plan tag, a fill GLB for
    fill tags, and a manifest. The folder is never a design phase: TrueVision reads it through this
    build-owned SitePlan__DataStore key, regenerated on every run. Layers come from the manifest when
    there is one, otherwise from the file names. Returns None when the folder holds no site plan GLBs.
    """
    store_path = os.path.join(project_path, TRUEVISION_CONTENT_FOLDER, store_folder)
    if not os.path.isdir(store_path):
        return None

    glb_files = sorted(
        f for f in os.listdir(store_path)
        if os.path.isfile(os.path.join(store_path, f)) and GLB_FILE_PATTERN.match(f)
    )
    if not glb_files:
        return None

    base_url = (
        f"{CDN_BASE_URL}/{R2_BASE_PREFIX}/{year_folder_name}/{project_folder}"
        f"/{TRUEVISION_CONTENT_FOLDER}/{store_folder}"
    )
    present = set(glb_files)

    manifest = None
    manifest_path = os.path.join(store_path, SITEPLAN_MANIFEST_FILENAME)
    if os.path.isfile(manifest_path):
        try:
            with open(manifest_path, 'r', encoding='utf-8') as f:
                manifest = json.load(f)
        except (json.JSONDecodeError, OSError) as error:
            print(f'  [WARNING] {project_folder}: site plan manifest unreadable, layers taken from file names ({error})')
            manifest = None

    layers = []
    if isinstance(manifest, dict) and isinstance(manifest.get('SitePlanData__Layers'), list):
        for entry in manifest['SitePlanData__Layers']:
            if not isinstance(entry, dict):
                continue
            linework = entry.get('Layer__LineworkFile')
            fill = entry.get('Layer__FillFile')
            if linework not in present:
                print(f'  [WARNING] {project_folder}: the site plan manifest lists {linework}, which is not in {store_folder}')
                continue
            layers.append({
                'Layer__CategoryKey'     : entry.get('Layer__CategoryKey'),
                'Layer__TagName'         : entry.get('Layer__TagName'),
                'Layer__Label'           : entry.get('Layer__Label'),
                'Layer__Group'           : entry.get('Layer__Group'),
                'Layer__DrawOrder'       : entry.get('Layer__DrawOrder'),
                'Layer__ZIndexLine'      : entry.get('Layer__ZIndexLine'),
                'Layer__ZIndexFill'      : entry.get('Layer__ZIndexFill'),
                'Layer__LineworkUrl'     : f'{base_url}/{linework}',
                'Layer__FillUrl'         : f'{base_url}/{fill}' if fill in present else None,
                'Layer__Style'           : entry.get('Layer__Style'),
                'Layer__VisibleAtScales' : entry.get('Layer__VisibleAtScales'),
                'Layer__SegmentCount'    : entry.get('Layer__SegmentCount'),
                'Layer__BoundsMm'        : entry.get('Layer__BoundsMm'),
            })
    else:
        by_key = {}
        for filename in glb_files:
            match = SITEPLAN_FILE_PATTERN.match(filename)
            if not match:
                print(f'  [WARNING] {project_folder}: {filename} in {store_folder} is not a site plan GLB name, skipped')
                continue
            slot = by_key.setdefault(match.group(1), {})
            slot['fill' if match.group(2).lower() == 'fillmodel' else 'linework'] = filename
        for category_key in sorted(by_key):
            files = by_key[category_key]
            if 'linework' not in files:
                continue
            label = re.sub(r'([a-z])([A-Z])', r'\1 \2', category_key.replace('TrueVision__SitePlan__', ''))
            layers.append({
                'Layer__CategoryKey'     : category_key,
                'Layer__TagName'         : None,
                'Layer__Label'           : label,
                'Layer__Group'           : None,
                'Layer__DrawOrder'       : None,
                'Layer__ZIndexLine'      : None,
                'Layer__ZIndexFill'      : None,
                'Layer__LineworkUrl'     : f"{base_url}/{files['linework']}",
                'Layer__FillUrl'         : f"{base_url}/{files['fill']}" if 'fill' in files else None,
                'Layer__Style'           : None,
                'Layer__VisibleAtScales' : None,
                'Layer__SegmentCount'    : None,
                'Layer__BoundsMm'        : None,
            })

    if not layers:
        return None

    meta = manifest if isinstance(manifest, dict) else {}
    return {
        'SitePlan__StoreId'       : store_id,
        'SitePlan__FolderName'    : store_folder,
        'SitePlan__ManifestUrl'   : f'{base_url}/{SITEPLAN_MANIFEST_FILENAME}' if meta else None,
        'SitePlan__ExportedIso'   : meta.get('SitePlanData__ExportedIso'),
        'SitePlan__NorthAngleDeg' : meta.get('SitePlanData__NorthAngleDeg'),
        'SitePlan__BoundsMm'      : meta.get('SitePlanData__BoundsMm'),
        'SitePlan__Layers'        : layers,
    }


def discover_truevision_siteplan_stores(project_path, year_folder_name, project_folder):
    """Describe EVERY site plan store the project holds, in catalogue order.

    A project may hold an Existing site plan, a Proposed one, or the original single
    SitePlan__DrawingData folder, which is read as the Proposed store. Only the FIRST
    folder found for a store id is used, so the named folder wins over the original one
    and a project cannot publish the same store twice. Returns [] when it holds none.
    """
    stores = []
    seen = set()
    for entry in SITEPLAN_STORES:
        if entry["id"] in seen:
            continue
        store = discover_truevision_siteplan_store(
            project_path, year_folder_name, project_folder, entry["folder"], entry["id"]
        )
        if store:
            stores.append(store)
            seen.add(entry["id"])
    return stores


def parse_group_label(group_id):
    """Convert a folder name like DesignPhase01__ConceptDesign__ExistingBuilding to a label."""
    parts = group_id.split('__')
    if len(parts) >= 2:
        label_parts = parts[1:]
        label = ' - '.join(label_parts)
    else:
        label = group_id

    label = re.sub(r'([a-z])([A-Z])', r'\1 \2', label)
    return label


def generate_truevision_project_data(project_code, project_name, model_groups, siteplan_stores=None):
    """Build the TrueVision__ProjectData__.json structure for a project."""
    data = {
        'projectCode'      : project_code,
        'projectName'      : project_name,
        'activeGroupIndex' : 0,
        'modelGroups'      : model_groups,
        'Camera__DefaultPosition' : {
            'Camera__DefaultPosition__PosX' : 0,
            'Camera__DefaultPosition__PosY' : 5000,
            'Camera__DefaultPosition__PosZ' : 15000,
            'Camera__DefaultFov'            : 50,
        },
    }
    # Build-owned: regenerated every run, never a dev key.
    stores = siteplan_stores or []
    if isinstance(stores, dict):
        stores = [stores]                                              # A single store still works, for any caller that passes one
    if stores:
        data['SitePlan__DataStores'] = stores
        # The legacy single key stays, holding the PROPOSED store, so a TrueVision
        # build that predates two stores keeps reading exactly what it read before.
        legacy = next((s for s in stores if s.get('SitePlan__StoreId') == 'proposed'), None)
        if legacy:
            data['SitePlan__DataStore'] = legacy
    return data


def write_truevision_project_data(project_path, data):
    """Write TrueVision__ProjectData__.json into the project's TrueVision content folder."""
    tv_dir = os.path.join(project_path, TRUEVISION_CONTENT_FOLDER)
    os.makedirs(tv_dir, exist_ok=True)
    output_path = os.path.join(tv_dir, 'TrueVision__ProjectData__.json')

    existing_data = None
    if os.path.isfile(output_path):
        try:
            with open(output_path, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
        except (json.JSONDecodeError, OSError):
            pass

    if existing_data:
        # Preserve all Dev-menu-owned keys (camera, orbit, nav modes, scenes)
        # so regenerating the project data does not wipe dev-authored settings.
        for dev_key in TRUEVISION_DEV_OWNED_KEYS:
            if dev_key in existing_data:
                data[dev_key] = existing_data[dev_key]
        if 'activeGroupIndex' in existing_data:
            data['activeGroupIndex'] = existing_data['activeGroupIndex']

        existing_labels = {}
        for g in existing_data.get('modelGroups', []):
            if g.get('groupId') and g.get('label'):
                existing_labels[g['groupId']] = g['label']
        for g in data['modelGroups']:
            if g['groupId'] in existing_labels:
                g['label'] = existing_labels[g['groupId']]

    write_json_file(output_path, data)

    print(f'  [WRITTEN] {output_path}')


# =============================================================================
# PLANVISION PROJECT DATA GENERATION
# =============================================================================

def parse_folder_label(folder_name):
    """Convert a folder name like '01__FloorPlans' or 'DesignPhase01__ConceptDesign__Content' to a readable label."""
    cleaned = re.sub(r'^\d+__', '', folder_name)
    cleaned = re.sub(r'^DesignPhase\d+__', '', cleaned)
    cleaned = re.sub(r'__Content$', '', cleaned)
    parts = cleaned.split('__')
    label = ' - '.join(p for p in parts if p)
    label = re.sub(r'([a-z])([A-Z])', r'\1 \2', label)
    return label or folder_name


def parse_drawing_button_name(filename):
    """Convert a drawing filename to a default button label.

    Strips the extension and replaces __ delimiters with spaces.
    """
    name = re.sub(r'\.(png|pdf)$', '', filename, flags=re.IGNORECASE)
    name = name.rstrip('_')
    parts = name.split('__')
    return ' '.join(p for p in parts if p)


def discover_planvision_folder(dir_path, depth=0, max_depth=3):
    """Recursively discover drawing files and subfolders within a PlanVision folder.

    Returns a list of folder-structure entries matching the PlanVision JSON schema.
    """
    if depth > max_depth or not os.path.isdir(dir_path):
        return []

    png_bases = set()
    pdf_bases = set()

    for f in sorted(os.listdir(dir_path)):
        fpath = os.path.join(dir_path, f)
        if not os.path.isfile(fpath):
            continue
        if not DRAWING_FILE_PATTERN.match(f):
            continue

        base = os.path.splitext(f)[0]
        ext = os.path.splitext(f)[1].lower()

        if ext == '.png':
            png_bases.add(base)
        elif ext == '.pdf':
            pdf_bases.add(base)

    all_bases = sorted(png_bases | pdf_bases)

    subfolders = []
    for entry in sorted(os.listdir(dir_path)):
        entry_path = os.path.join(dir_path, entry)
        if not os.path.isdir(entry_path):
            continue
        if any(entry.startswith(p) for p in SKIP_FOLDER_PREFIXES) or is_das_folder(entry):
            continue

        sub_entries = discover_planvision_folder(entry_path, depth + 1, max_depth)
        if sub_entries is not None:
            sub_label = parse_folder_label(entry)
            sub_item = {
                'folder'  : entry,
                'label'   : sub_label,
                'label-override' : False,
            }
            sub_files = sub_entries.get('files', []) if isinstance(sub_entries, dict) else []
            sub_subs  = sub_entries.get('subfolders', []) if isinstance(sub_entries, dict) else []

            if sub_files:
                sub_item['files'] = sub_files
            if sub_subs:
                sub_item['subfolders'] = sub_subs

            if sub_files or sub_subs:
                subfolders.append(sub_item)

    return {
        'files'      : all_bases,
        'subfolders' : subfolders,
    }


def discover_planvision_phases(project_path):
    """Discover all design phase folders and their content under 20__PlanVision__AppContent."""
    pv_path = os.path.join(project_path, PLANVISION_CONTENT_FOLDER)
    phases = []

    if not os.path.isdir(pv_path):
        return phases

    for entry in sorted(os.listdir(pv_path)):
        entry_path = os.path.join(pv_path, entry)
        if not os.path.isdir(entry_path):
            continue
        if any(entry.startswith(p) for p in SKIP_FOLDER_PREFIXES):
            continue

        match = PHASE_FOLDER_PATTERN.match(entry)
        if not match:
            continue

        phase_key_match = re.match(r'^(DesignPhase\d+)', entry)
        phase_key = phase_key_match.group(1) if phase_key_match else entry

        folder_structure = []
        for sub_entry in sorted(os.listdir(entry_path)):
            sub_path = os.path.join(entry_path, sub_entry)

            if os.path.isdir(sub_path):
                if any(sub_entry.startswith(p) for p in SKIP_FOLDER_PREFIXES) or is_das_folder(sub_entry):
                    continue
                content = discover_planvision_folder(sub_path, depth=1)
                label = parse_folder_label(sub_entry)
                item = {
                    'folder'         : sub_entry,
                    'label'          : label,
                    'label-override' : False,
                    'document-type'  : 'Drawing',
                    'document-scale' : '1:50',
                    'document-size'  : 'A2',
                }
                if content.get('files'):
                    item['files'] = content['files']
                if content.get('subfolders'):
                    item['subfolders'] = content['subfolders']
                if content.get('files') or content.get('subfolders'):
                    folder_structure.append(item)

        root_content = discover_planvision_folder(entry_path, depth=0)
        if root_content.get('files'):
            folder_structure.insert(0, {
                'label'          : parse_folder_label(entry),
                'label-override' : False,
                'document-type'  : 'Drawing',
                'document-scale' : '1:50',
                'document-size'  : 'A2',
                'files'          : root_content['files'],
            })

        if folder_structure:
            phases.append({
                'phase_key'        : phase_key,
                'phase_folder'     : entry,
                'folder_structure' : folder_structure,
            })

    return phases


def generate_planvision_project_data(project_code, project_name, phases):
    """Build the PlanVision__ProjectData__.json structure."""
    phase_content = {}
    available_phases = []

    for phase in phases:
        key = phase['phase_key']
        available_phases.append(key)
        phase_content[key] = {
            'phase-folder'     : phase['phase_folder'],
            'folder-structure' : phase['folder_structure'],
        }

    active_phase = available_phases[-1] if available_phases else 'DesignPhase01'

    return {
        'na-project-data-library' : {
            'project-details' : {
                'project-name'          : project_name,
                'project-name-nickname' : project_name,
                'project-address'       : '',
                'project-description'   : '',
                'client-name'           : '',
            },
            'project-phase-config' : {
                'active-design-phase' : active_phase,
                'available-phases'    : available_phases,
                'phase-last-updated'  : datetime.now().strftime('%d-%b-%Y'),
            },
            'project-documentation' : {
                'phase-content' : phase_content,
            },
        }
    }


def merge_planvision_existing_data(new_data, existing_data):
    """Preserve manual overrides from existing PlanVision JSON when regenerating."""
    if not existing_data:
        return new_data

    new_lib = new_data.get('na-project-data-library', {})
    old_lib = existing_data.get('na-project-data-library', {})

    old_details = old_lib.get('project-details', {})
    new_details = new_lib.get('project-details', {})
    for key in ('project-name', 'project-name-nickname', 'project-address',
                'project-description', 'client-name'):
        if old_details.get(key):
            new_details[key] = old_details[key]

    # Preserve the design-access-statement object (owned by the DAS builder)
    if old_lib.get('design-access-statement'):
        new_lib['design-access-statement'] = old_lib['design-access-statement']

    old_phase_cfg = old_lib.get('project-phase-config', {})
    new_phase_cfg = new_lib.get('project-phase-config', {})
    old_active = old_phase_cfg.get('active-design-phase')
    new_available = new_phase_cfg.get('available-phases', [])
    if old_active and old_active in new_available:
        new_phase_cfg['active-design-phase'] = old_active

    old_phases = old_lib.get('project-documentation', {}).get('phase-content', {})
    new_phases = new_lib.get('project-documentation', {}).get('phase-content', {})

    for phase_key, new_phase in new_phases.items():
        old_phase = old_phases.get(phase_key, {})
        old_folders = {_build_folder_id(f): f for f in old_phase.get('folder-structure', [])}

        for folder_entry in new_phase.get('folder-structure', []):
            fid = _build_folder_id(folder_entry)
            old_folder = old_folders.get(fid)
            if not old_folder:
                continue

            if old_folder.get('label-override', False):
                folder_entry['label'] = old_folder['label']
                folder_entry['label-override'] = True

            for prop in ('document-type', 'document-scale', 'document-size'):
                if old_folder.get(prop):
                    folder_entry[prop] = old_folder[prop]

            _merge_file_labels(folder_entry, old_folder)

            _merge_subfolder_labels(folder_entry.get('subfolders', []),
                                    old_folder.get('subfolders', []))

    return new_data


def _build_folder_id(folder_entry):
    """Create a stable identifier for a folder entry."""
    return folder_entry.get('folder', folder_entry.get('label', ''))


def _get_file_base(file_entry):
    """Return the base filename string from either a plain string or an object file entry."""
    if isinstance(file_entry, dict):
        return file_entry.get('filename', '')
    return file_entry


def _merge_file_labels(new_folder, old_folder):
    """Preserve file label overrides from the existing JSON into the freshly-generated folder.

    File entries may be plain strings (auto-generated) or objects with a 'label' key
    (manually overridden).  When the old folder has an object entry for a given filename,
    the label is carried forward into the new folder's files list.
    """
    old_files = old_folder.get('files', [])
    new_files = new_folder.get('files', [])

    if not old_files or not new_files:
        return

    # Build a lookup of filename -> label for any object entries in the old files list
    old_labels = {}
    for f in old_files:
        if isinstance(f, dict) and f.get('label'):
            old_labels[f['filename']] = f['label']

    if not old_labels:
        return  # <-- Nothing to preserve

    # Upgrade any matching plain-string entries in the new list to objects with labels
    for i, f in enumerate(new_files):
        base = _get_file_base(f)
        if base in old_labels:
            new_files[i] = {'filename': base, 'label': old_labels[base]}


def _merge_subfolder_labels(new_subs, old_subs):
    """Recursively preserve label-override flags and file label overrides in subfolders."""
    old_map = {_build_folder_id(s): s for s in old_subs}
    for sub in new_subs:
        old_sub = old_map.get(_build_folder_id(sub))
        if old_sub and old_sub.get('label-override', False):
            sub['label'] = old_sub['label']
            sub['label-override'] = True
        if old_sub:
            _merge_file_labels(sub, old_sub)
            _merge_subfolder_labels(sub.get('subfolders', []),
                                    old_sub.get('subfolders', []))


def write_planvision_project_data(project_path, data):
    """Write PlanVision__ProjectData__.json into the project's PlanVision content folder."""
    pv_dir = os.path.join(project_path, PLANVISION_CONTENT_FOLDER)
    os.makedirs(pv_dir, exist_ok=True)
    output_path = os.path.join(pv_dir, PLANVISION_DATA_FILENAME)

    existing_data = None
    if os.path.isfile(output_path):
        try:
            with open(output_path, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
        except (json.JSONDecodeError, OSError):
            pass

    data = merge_planvision_existing_data(data, existing_data)

    write_json_file(output_path, data)

    print(f'  [WRITTEN] {output_path}')


# =============================================================================
# FILE WRITERS
# =============================================================================

def write_json(path, data):
    """Write JSON data to a file with consistent formatting."""
    os.makedirs(os.path.dirname(path), exist_ok=True)

    write_json_file(path, data)                                        # <-- Temp + rename: a git diff mapping the file cannot block it

    print(f'  [WRITTEN] {path}')


def write_redirect_html(project_path, html_content):
    """Write the ProjectVision-WebApp.html redirect file."""
    redirect_path = os.path.join(project_path, 'ProjectVision-WebApp.html')

    write_text_file(redirect_path, html_content)

    print(f'  [WRITTEN] {redirect_path}')


# =============================================================================
# SUMMARY TABLE
# =============================================================================

def print_summary(all_projects, warnings):
    """Print a formatted summary table of discovered projects."""
    print('\n' + '=' * 78)
    print('  PROJECT VISION BUILD SUMMARY')
    print('=' * 78)

    if not all_projects:
        print('  No projects found.')
        print('=' * 78)
        return

    header = f'  {"Code":<6} {"Year":<6} {"Name":<24} {"Admin":<8} {"Plan":<8} {"3D":<8}'
    print(header)
    print('  ' + '-' * 74)

    for proj in sorted(all_projects, key=lambda p: (p['projectYear'], p['projectCode'])):
        sa = proj['subApps']
        admin_mark = 'YES' if sa['projectAdmin'] else '-'
        plan_mark  = 'YES' if sa['planVision']   else '-'
        tv_mark    = 'YES' if sa['trueVision']   else '-'

        print(f'  {proj["projectCode"]:<6} {proj["projectYear"]:<6} '
              f'{proj["projectName"]:<24} {admin_mark:<8} {plan_mark:<8} {tv_mark:<8}')

    print('  ' + '-' * 74)
    print(f'  Total: {len(all_projects)} project(s)')

    if warnings:
        print('\n  WARNINGS:')
        for w in warnings:
            print(f'    - {w}')

    print('=' * 78 + '\n')


# =============================================================================
# MAIN
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='Project Vision Build Script - Scan and index all projects'
    )
    parser.add_argument(
        '--portal-root',
        default=None,
        help='Path to na-project-portal directory (auto-detected if not provided)'
    )
    parser.add_argument(
        '--project',
        default=None,
        help='Target a single project folder (e.g. JH03__RomerCottage)'
    )
    parser.add_argument(
        '--dry-run-check',
        action='store_true',
        help='Preview all changes without writing any files'
    )
    parser.add_argument(
        '--qr-index-only',
        action='store_true',
        help='Rewrite q/index.json (the Project QR Code resolver index) and nothing else'
    )
    args = parser.parse_args()

    if args.portal_root:
        portal_root = os.path.abspath(args.portal_root)
    else:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        portal_root = os.path.normpath(
            os.path.join(script_dir, '..', '..', 'na-project-portal')
        )

    print(f'\n  Portal root: {portal_root}')

    if not os.path.isdir(portal_root):
        print(f'  [ERROR] Portal root directory not found: {portal_root}')
        return 1

    paths = resolve_paths(portal_root)
    all_projects = []
    warnings = []

    year_folders = discover_year_folders(portal_root)
    print(f'  Found {len(year_folders)} year folder(s): '
          + ', '.join(yf[1] for yf in year_folders))

    for year_code, year_folder_name in year_folders:
        projects = discover_projects(portal_root, year_code, year_folder_name)
        print(f'  [{year_folder_name}] {len(projects)} project(s)')

        for proj in projects:
            config = read_project_config(proj['folderPath'])
            sub_apps = detect_sub_app_availability(proj['folderPath'])

            project_name = proj['projectCode']
            if config and config.get('projectName'):
                project_name = config['projectName']

            if config and config.get('projectCode') != proj['projectCode']:
                warnings.append(
                    f'{proj["projectFolder"]}: folder code {proj["projectCode"]} '
                    f'does not match config code {config.get("projectCode")}'
                )

            proj['projectName'] = project_name
            proj['subApps']     = sub_apps
            all_projects.append(proj)

    target_projects = all_projects
    if args.project:
        target_folder = args.project.strip()
        target_projects = [p for p in all_projects if p['projectFolder'] == target_folder]
        if not target_projects:
            print(f'  [ERROR] Target project folder not found: {target_folder}')
            return 1
        print(f'  [TARGET] Running in targeted mode for: {target_folder}')

    # THE QR RESOLVER INDEX ALWAYS LISTS EVERY PROJECT, even on a targeted run:
    # it is one file for the whole site, and a run aimed at one job must not
    # drop every other job's printed codes out of it.
    qr_link_index = build_qr_link_index(all_projects)

    if args.qr_index_only:
        if args.dry_run_check:
            print(f'  [DRY-RUN] Would write: {paths["qr_index_path"]}')
        else:
            write_json(paths['qr_index_path'], qr_link_index)
        print(f'  [INFO] QR resolver index: {len(qr_link_index["projects"])} project(s). Nothing else was built.')
        return 0

    master_index = build_master_index(all_projects)
    project_keys = build_project_keys_index(all_projects, paths['project_keys_path'])

    if args.dry_run_check:
        print('\n' + '=' * 78)
        print('  DRY RUN CHECK MODE (NO FILES WRITTEN)')
        print('=' * 78)
        print(f'  [DRY-RUN] Would write: {paths["master_index_path"]}')
        print(f'  [DRY-RUN] Would write: {paths["project_keys_path"]}')
        print(f'  [DRY-RUN] Would write: {paths["qr_index_path"]}')
    else:
        write_json(paths['master_index_path'], master_index)
        write_json(paths['project_keys_path'], project_keys)
        write_json(paths['qr_index_path'], qr_link_index)

    for proj in target_projects:
        html = generate_redirect_html(
            proj['projectCode'],
            proj['projectName'],
            proj['projectFolder']
        )
        if args.dry_run_check:
            redirect_path = os.path.join(proj['folderPath'], 'ProjectVision-WebApp.html')
            print(f'  [DRY-RUN] Would write redirect: {redirect_path}')
        else:
            write_redirect_html(proj['folderPath'], html)

    # GENERATE TRUEVISION PROJECT DATA JSON FOR EACH PROJECT WITH TV CONTENT
    tv_generated_count = 0
    for proj in target_projects:
        if not proj['subApps']['trueVision']:
            continue

        year_folder_name = f"{proj['projectYear']}-Projects"
        model_groups = discover_truevision_model_groups(
            proj['folderPath'], year_folder_name, proj['projectFolder']
        )
        siteplan_stores = discover_truevision_siteplan_stores(
            proj['folderPath'], year_folder_name, proj['projectFolder']
        )

        if model_groups or siteplan_stores:
            tv_data = generate_truevision_project_data(
                proj['projectCode'], proj['projectName'], model_groups, siteplan_stores
            )
            if args.dry_run_check:
                output_path = os.path.join(proj['folderPath'], TRUEVISION_CONTENT_FOLDER, 'TrueVision__ProjectData__.json')
                print(f'  [DRY-RUN] Would write: {output_path}')
            else:
                write_truevision_project_data(proj['folderPath'], tv_data)
            tv_generated_count += 1

    if tv_generated_count > 0:
        print(f'\n  [INFO] Generated TrueVision__ProjectData__.json for {tv_generated_count} project(s)')

    # GENERATE PLANVISION PROJECT DATA JSON FOR EACH PROJECT WITH PV CONTENT
    pv_generated_count = 0
    for proj in target_projects:
        if not proj['subApps']['planVision']:
            continue

        phases = discover_planvision_phases(proj['folderPath'])
        if phases:
            pv_data = generate_planvision_project_data(
                proj['projectCode'], proj['projectName'], phases
            )
            if args.dry_run_check:
                output_path = os.path.join(proj['folderPath'], PLANVISION_CONTENT_FOLDER, PLANVISION_DATA_FILENAME)
                print(f'  [DRY-RUN] Would write: {output_path}')
            else:
                write_planvision_project_data(proj['folderPath'], pv_data)
            pv_generated_count += 1

    if pv_generated_count > 0:
        print(f'\n  [INFO] Generated PlanVision__ProjectData__.json for {pv_generated_count} project(s)')

    # BUILD DESIGN & ACCESS STATEMENTS (markdown relink -> HTML + JSON DAS object)
    run_das_builds(target_projects, dry_run=args.dry_run_check)

    print_summary(all_projects, warnings)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
