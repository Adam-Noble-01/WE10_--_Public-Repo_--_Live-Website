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
#
# USAGE:
#   python ProjectVision__BuildScript__.py
#   python ProjectVision__BuildScript__.py --portal-root "D:\path\to\na-project-portal"
#
# =============================================================================

import os
import re
import json
import argparse
from pathlib import Path
from datetime import datetime, timezone


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
GLB_FILE_PATTERN = re.compile(r'^.+\.glb$', re.IGNORECASE)


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


def generate_truevision_project_data(project_code, project_name, model_groups):
    """Build the TrueVision__ProjectData__.json structure for a project."""
    return {
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
        if 'Camera__DefaultPosition' in existing_data:
            data['Camera__DefaultPosition'] = existing_data['Camera__DefaultPosition']
        if 'activeGroupIndex' in existing_data:
            data['activeGroupIndex'] = existing_data['activeGroupIndex']

        existing_labels = {}
        for g in existing_data.get('modelGroups', []):
            if g.get('groupId') and g.get('label'):
                existing_labels[g['groupId']] = g['label']
        for g in data['modelGroups']:
            if g['groupId'] in existing_labels:
                g['label'] = existing_labels[g['groupId']]

    with open(output_path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
        f.write('\n')

    print(f'  [WRITTEN] {output_path}')


# =============================================================================
# FILE WRITERS
# =============================================================================

def write_json(path, data):
    """Write JSON data to a file with consistent formatting."""
    os.makedirs(os.path.dirname(path), exist_ok=True)

    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
        f.write('\n')

    print(f'  [WRITTEN] {path}')


def write_redirect_html(project_path, html_content):
    """Write the ProjectVision-WebApp.html redirect file."""
    redirect_path = os.path.join(project_path, 'ProjectVision-WebApp.html')

    with open(redirect_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(html_content)

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

    master_index = build_master_index(all_projects)
    write_json(paths['master_index_path'], master_index)

    project_keys = build_project_keys_index(all_projects, paths['project_keys_path'])
    write_json(paths['project_keys_path'], project_keys)

    for proj in all_projects:
        html = generate_redirect_html(
            proj['projectCode'],
            proj['projectName'],
            proj['projectFolder']
        )
        write_redirect_html(proj['folderPath'], html)

    # GENERATE TRUEVISION PROJECT DATA JSON FOR EACH PROJECT WITH TV CONTENT
    tv_generated_count = 0
    for proj in all_projects:
        if not proj['subApps']['trueVision']:
            continue

        year_folder_name = f"{proj['projectYear']}-Projects"
        model_groups = discover_truevision_model_groups(
            proj['folderPath'], year_folder_name, proj['projectFolder']
        )

        if model_groups:
            tv_data = generate_truevision_project_data(
                proj['projectCode'], proj['projectName'], model_groups
            )
            write_truevision_project_data(proj['folderPath'], tv_data)
            tv_generated_count += 1

    if tv_generated_count > 0:
        print(f'\n  [INFO] Generated TrueVision__ProjectData__.json for {tv_generated_count} project(s)')

    print_summary(all_projects, warnings)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
