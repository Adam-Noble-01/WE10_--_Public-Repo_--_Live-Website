#!/usr/bin/env python3
# =============================================================================
# NOBLE ARCHITECTURE - PROJECT VISION TARGETED BUILD DEV TOOL
# =============================================================================
#
# FILE       : ProjectVision__DevTool__TargetedBuild__.py
# AUTHOR     : Adam Noble - Noble Architecture
# PURPOSE    : Run ProjectVision__BuildScript__.py in targeted mode with an
#              interactive no-argument workflow and dry-run preview support
# CREATED    : 16-Mar-2026
#
# DESCRIPTION:
# - Wraps ProjectVision__BuildScript__.py for focused per-project workflows
# - Supports --project <ProjectCode__ProjectName> targeting
# - Supports --dry-run-check preview mode (no writes)
# - Shows an interactive menu when launched without arguments
# - Keeps full build script as the single source of truth
#
# USAGE:
#   python 95__AppMacro__DevTools/ProjectVision__DevTool__TargetedBuild__.py
#   python 95__AppMacro__DevTools/ProjectVision__DevTool__TargetedBuild__.py --project JH03__RomerCottage --dry-run-check
#   python 95__AppMacro__DevTools/ProjectVision__DevTool__TargetedBuild__.py --project JH03__RomerCottage
#   python 95__AppMacro__DevTools/ProjectVision__DevTool__TargetedBuild__.py --instructions
#
# =============================================================================

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path


# =============================================================================
# CONSTANTS
# =============================================================================

SCRIPT_DIR            = Path(__file__).parent
APP_ROOT              = SCRIPT_DIR.parent
BUILD_SCRIPT_PATH     = APP_ROOT / 'ProjectVision__BuildScript__.py'
DEFAULT_PORTAL_ROOT   = APP_ROOT.parent.parent / 'na-project-portal'
YEAR_FOLDER_PATTERN   = re.compile(r'^(\d{2})-Projects$')
PROJECT_DIR_PATTERN   = re.compile(r'^([A-Z]{2}[0-9]{2})(?:__|_-_)(.+)$')


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def show_banner():
    print('')
    print('=' * 78)
    print('  NOBLE ARCHITECTURE - PROJECT VISION TARGETED BUILD DEV TOOL')
    print('=' * 78)
    print('')
    sys.stdout.flush()


def show_help():
    print('  COMMANDS')
    print('  ------------------------------------------------------------------------')
    print('  python ProjectVision__DevTool__TargetedBuild__.py')
    print('      Launch interactive mode')
    print('')
    print('  python ProjectVision__DevTool__TargetedBuild__.py --project JH03__RomerCottage --dry-run-check')
    print('      Preview a targeted build without writing files')
    print('')
    print('  python ProjectVision__DevTool__TargetedBuild__.py --project JH03__RomerCottage')
    print('      Run a targeted build and write outputs')
    print('')
    print('  python ProjectVision__DevTool__TargetedBuild__.py --list-projects')
    print('      List discoverable project folders')
    print('')
    print('  PROJECT ARGUMENT')
    print('  ------------------------------------------------------------------------')
    print('  Use the project folder name, not just the code.')
    print('  Example: JH03__RomerCottage')
    print('')


def resolve_portal_root(portal_root_override):
    if portal_root_override:
        return Path(portal_root_override).resolve()
    return DEFAULT_PORTAL_ROOT.resolve()


def discover_projects(portal_root):
    projects = []

    if not portal_root.is_dir():
        return projects

    for entry in sorted(portal_root.iterdir()):
        if not entry.is_dir():
            continue

        year_match = YEAR_FOLDER_PATTERN.match(entry.name)
        if not year_match:
            continue

        year_code = year_match.group(1)

        for project_dir in sorted(entry.iterdir()):
            if not project_dir.is_dir():
                continue

            project_match = PROJECT_DIR_PATTERN.match(project_dir.name)
            if not project_match:
                continue

            projects.append({
                'projectCode'   : project_match.group(1),
                'projectFolder' : project_dir.name,
                'projectYear'   : year_code,
            })

    return projects


def list_projects(portal_root):
    projects = discover_projects(portal_root)

    print(f'  Portal root: {portal_root}')
    print('')

    if not projects:
        print('  [INFO] No project folders discovered.')
        return

    print('  DISCOVERED PROJECTS')
    print('  ------------------------------------------------------------------------')
    for project in projects:
        print(f'  {project["projectYear"]}-Projects | {project["projectFolder"]}')
    print('')


def project_exists(portal_root, project_folder):
    projects = discover_projects(portal_root)
    return next((p for p in projects if p['projectFolder'] == project_folder), None)


def prompt_input(prompt_text):
    try:
        return input(prompt_text).strip()
    except (EOFError, KeyboardInterrupt):
        print('\n  [CANCEL] Operation cancelled.')
        return None


def prompt_project_folder(portal_root):
    print('  Enter the exact project folder name.')
    print('  Example: JH03__RomerCottage')
    print("  Type 'list' to show all project folders.")
    print('')

    while True:
        value = prompt_input('  Project folder: ')
        if value is None:
            return None

        if value.lower() in ('', '0', 'exit', 'quit'):
            return None

        if value.lower() == 'list':
            print('')
            list_projects(portal_root)
            continue

        project = project_exists(portal_root, value)
        if project:
            print('')
            print(f'  [PROJECT] {project["projectCode"]}')
            print(f'  [FOLDER]  {project["projectFolder"]}')
            print(f'  [YEAR]    {project["projectYear"]}-Projects')
            print('')
            return project['projectFolder']

        print(f"  [ERROR] Project folder not found: {value}")
        print("  Try again, or type 'list' to browse discoverable folders.")
        print('')


def show_interactive_menu():
    print('  What would you like to do?')
    print('')
    print('  [1] Dry-run check for a specific project')
    print('  [2] Run targeted build for a specific project')
    print('  [3] Show instructions')
    print('  [4] List discoverable project folders')
    print('  [0] Exit')
    print('')
    return prompt_input('  Enter choice (0-4): ')


def build_command(project_folder, portal_root, dry_run_check):
    command = [
        sys.executable,
        str(BUILD_SCRIPT_PATH),
        '--project', project_folder,
        '--portal-root', str(portal_root)
    ]

    if dry_run_check:
        command.append('--dry-run-check')

    return command


def run_build(project_folder, portal_root, dry_run_check):
    if not BUILD_SCRIPT_PATH.is_file():
        print(f'  [ERROR] Build script not found: {BUILD_SCRIPT_PATH}')
        return 1

    command = build_command(project_folder, portal_root, dry_run_check)

    print('')
    print('  RUN CONFIGURATION')
    print('  ------------------------------------------------------------------------')
    print(f'  Project folder : {project_folder}')
    print(f'  Portal root    : {portal_root}')
    print(f'  Mode           : {"DRY RUN CHECK" if dry_run_check else "TARGETED BUILD"}')
    print('')
    print(f'  [RUN] {" ".join(command)}')
    print('')
    sys.stdout.flush()

    result = subprocess.run(command, cwd=APP_ROOT)
    return result.returncode


def run_interactive_mode(portal_root):
    while True:
        choice = show_interactive_menu()
        if choice is None:
            return 0

        if choice == '0':
            print('  Exiting.')
            return 0

        if choice == '3':
            print('')
            show_help()
            continue

        if choice == '4':
            print('')
            list_projects(portal_root)
            continue

        if choice not in ('1', '2'):
            print(f"  [ERROR] Invalid choice: '{choice}'")
            print('')
            continue

        print('')
        project_folder = prompt_project_folder(portal_root)
        if not project_folder:
            print('  [CANCEL] No project selected.')
            print('')
            continue

        dry_run_check = (choice == '1')
        return run_build(project_folder, portal_root, dry_run_check)


# =============================================================================
# MAIN
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='Project Vision DevTool - Targeted Build Runner',
        add_help=True
    )
    parser.add_argument(
        '--project',
        default=None,
        help='Project folder target (e.g. JH03__RomerCottage)'
    )
    parser.add_argument(
        '--dry-run-check',
        action='store_true',
        help='Preview mode (no writes)'
    )
    parser.add_argument(
        '--portal-root',
        default=None,
        help='Optional portal root override'
    )
    parser.add_argument(
        '--instructions', '--Instructions', '--help-detail',
        dest='show_instructions',
        action='store_true',
        help='Show usage instructions and exit'
    )
    parser.add_argument(
        '--list-projects',
        action='store_true',
        help='List discoverable project folders and exit'
    )
    args = parser.parse_args()

    portal_root = resolve_portal_root(args.portal_root)

    show_banner()

    if not portal_root.is_dir():
        print(f'  [ERROR] Portal root not found: {portal_root}')
        return 1

    if args.show_instructions:
        show_help()
        return 0

    if args.list_projects:
        list_projects(portal_root)
        return 0

    if not args.project:
        return run_interactive_mode(portal_root)

    project = project_exists(portal_root, args.project)
    if not project:
        print(f'  [ERROR] Project folder not found: {args.project}')
        print('')
        print("  Use '--list-projects' to browse valid folder names.")
        return 1

    return run_build(args.project, portal_root, args.dry_run_check)


if __name__ == '__main__':
    raise SystemExit(main())
