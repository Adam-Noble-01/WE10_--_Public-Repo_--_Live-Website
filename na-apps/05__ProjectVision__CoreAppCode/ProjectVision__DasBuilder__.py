#!/usr/bin/env python3
# =============================================================================
# NOBLE ARCHITECTURE - DESIGN & ACCESS STATEMENT BUILDER
# =============================================================================
#
# FILE       : ProjectVision__DasBuilder__.py
# NAMESPACE  : ProjectVision
# MODULE     : Design & Access Statement Builder
# AUTHOR     : Adam Noble - Noble Architecture
# PURPOSE    : Convert Design & Access Statement markdown to HTML and maintain
#              the design-access-statement object in PlanVision project data
# CREATED    : 18-Jul-2026
#
# DESCRIPTION:
# - Locates the NN__DesignStatment folder under a project's PlanVision phases
# - Resolves stale production-machine image links in the markdown file so all
#   images point at 01__Statement__ImageFiles/ relative to the statement root
# - Copies referenced images into 01__Statement__ImageFiles/ when they still
#   resolve on the local machine but have not yet been bundled
# - Converts the markdown to a standalone HTML document styled by the common
#   StyleSheet__DesignAccessStatement__.css (single source of truth)
# - Writes the design-access-statement object into PlanVision__ProjectData__.json
#   so PlanVision can resolve the HTML + image CDN links downstream
#
# USAGE:
#   python ProjectVision__DasBuilder__.py --project JH03__RomerCottage
#   python ProjectVision__DasBuilder__.py --project JH03__RomerCottage --dry-run-check
#   (also imported by ProjectVision__BuildScript__.py via run_das_builds)
#
# =============================================================================

import os
import re
import json
import shutil
import argparse
from pathlib import Path
from datetime import datetime
from urllib.parse import unquote, quote


# -----------------------------------------------------------------------------
# REGION | Module Constants and Configuration
# -----------------------------------------------------------------------------

    # MODULE CONSTANTS | Paths, Prefixes, and URLs
    # ------------------------------------------------------------
LIVE_DOMAIN                        = 'https://www.noble-architecture.com'
CDN_BASE_URL                       = 'https://cdn.noble-architecture.com'
R2_BASE_PREFIX                     = 'NaProjectPortal'
PLANVISION_CONTENT_FOLDER          = '20__PlanVision__AppContent'
PLANVISION_DATA_FILENAME           = 'PlanVision__ProjectData__.json'
DAS_IMAGE_FOLDER                   = '01__Statement__ImageFiles'
DAS_COMMON_STYLESHEET_URL          = (
    f'{LIVE_DOMAIN}/na-apps/20__PlanVision__CoreAppCode'
    f'/04__Style__AppStylesheets/StyleSheet__DesignAccessStatement__.css'
)
    # ------------------------------------------------------------

    # MODULE CONSTANTS | Folder and File Patterns
    # ------------------------------------------------------------
DAS_FOLDER_PATTERN                 = re.compile(r'^\d{2}__DesignState?ment$', re.IGNORECASE)
PHASE_FOLDER_PATTERN               = re.compile(r'^DesignPhase\d+__.+$')
IMAGE_FILE_PATTERN                 = re.compile(r'^.+\.(png|jpg|jpeg|webp|svg|gif)$', re.IGNORECASE)
MD_IMAGE_LINK_PATTERN              = re.compile(r'!\[([^\]]*)\]\(([^)]+)\)')
HTML_IMAGE_SRC_PATTERN             = re.compile(r'(<img\b[^>]*?\bsrc\s*=\s*["\'])([^"\']+)(["\'])', re.IGNORECASE)
FRONT_MATTER_PATTERN               = re.compile(r'^﻿?---\s*\n(.*?)\n---\s*\n', re.DOTALL)
MARK_HIGHLIGHT_PATTERN             = re.compile(r'==([^=\n][^=\n]*?)==')
SKIP_FOLDER_PREFIXES               = ('.', '00__')
    # ------------------------------------------------------------

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | Statement Folder and Markdown Discovery
# -----------------------------------------------------------------------------

    # FUNCTION | Check if a Folder Name is a Design Statement Folder
    # ------------------------------------------------------------
def is_das_folder(folder_name):
    """Return True for statement folders such as 02__DesignStatment (both spellings)."""
    return bool(DAS_FOLDER_PATTERN.match(folder_name))
    # ------------------------------------------------------------


    # FUNCTION | Locate the Design Statement Folder for a Project
    # ------------------------------------------------------------
def find_das_folder(project_path):
    """Scan PlanVision phase folders for a statement folder.

    Returns (phase_folder_name, das_folder_name, das_path) for the LAST design
    phase that contains one (later phases supersede earlier ones), or None.
    """
    pv_path = os.path.join(project_path, PLANVISION_CONTENT_FOLDER)
    result  = None

    if not os.path.isdir(pv_path):
        return None

    for phase_entry in sorted(os.listdir(pv_path)):
        phase_path = os.path.join(pv_path, phase_entry)
        if not os.path.isdir(phase_path) or not PHASE_FOLDER_PATTERN.match(phase_entry):
            continue

        for sub_entry in sorted(os.listdir(phase_path)):
            sub_path = os.path.join(phase_path, sub_entry)
            if os.path.isdir(sub_path) and is_das_folder(sub_entry):
                result = (phase_entry, sub_entry, sub_path)

    return result
    # ------------------------------------------------------------


    # FUNCTION | Locate the Statement Markdown File
    # ------------------------------------------------------------
def find_markdown_file(das_path):
    """Return the newest .md file in the statement folder root (archive ignored)."""
    candidates = []

    for entry in sorted(os.listdir(das_path)):
        entry_path = os.path.join(das_path, entry)
        if os.path.isfile(entry_path) and entry.lower().endswith('.md'):
            candidates.append(entry_path)

    if not candidates:
        return None

    return max(candidates, key=lambda p: os.path.getmtime(p))
    # ------------------------------------------------------------

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | Markdown Image Link Resolution
# -----------------------------------------------------------------------------

    # HELPER FUNCTION | Extract the Bare Filename from a Link Target
    # ------------------------------------------------------------
def extract_image_filename(link_target):
    """Reduce any absolute / relative / URL-encoded link to its bare filename."""
    cleaned = link_target.strip().strip('<>').split('?')[0]
    cleaned = re.sub(r'\s+"[^"]*"$', '', cleaned)                       # <-- Strip optional md title
    cleaned = cleaned.replace('\\', '/')
    return unquote(cleaned.split('/')[-1])
    # ------------------------------------------------------------


    # HELPER FUNCTION | Build the Relative Statement Image Link
    # ------------------------------------------------------------
def build_relative_image_link(filename):
    """Return the statement-root-relative link, URL-encoding unsafe characters."""
    return f'{DAS_IMAGE_FOLDER}/{quote(filename)}'
    # ------------------------------------------------------------


    # HELPER FUNCTION | Ensure a Referenced Image Exists in the Image Folder
    # ------------------------------------------------------------
def ensure_image_bundled(link_target, filename, das_path, md_dir, report):
    """Check the image folder for the file; copy from the original path if needed.

    Returns True when the image is present in 01__Statement__ImageFiles after
    this call, False when it could not be located anywhere.
    """
    image_dir   = os.path.join(das_path, DAS_IMAGE_FOLDER)
    bundled     = os.path.join(image_dir, filename)

    if os.path.isfile(bundled):
        return True

    # Attempt recovery from the original (production machine) link target
    raw_path = unquote(link_target.strip().strip('<>'))
    raw_path = re.sub(r'\s+"[^"]*"$', '', raw_path)
    source_candidates = [raw_path, os.path.join(md_dir, raw_path)]

    for candidate in source_candidates:
        if candidate and os.path.isfile(candidate):
            os.makedirs(image_dir, exist_ok=True)
            shutil.copy2(candidate, bundled)
            report['copied'].append(filename)
            return True

    report['missing'].append(filename)
    return False
    # ------------------------------------------------------------


    # FUNCTION | Rewrite All Image Links in the Markdown Text
    # ------------------------------------------------------------
def resolve_markdown_image_links(md_text, das_path, md_dir, report):
    """Re-point every image reference at 01__Statement__ImageFiles/<filename>.

    Only the filename portion of each stale production link is trusted; the
    path prefix is rebuilt so the markdown resolves relative to its new root.
    """

    def replace_md_image(match):
        alt, target = match.group(1), match.group(2)
        filename    = extract_image_filename(target)
        if not IMAGE_FILE_PATTERN.match(filename):
            return match.group(0)                                       # <-- Not an image link; leave untouched
        ensure_image_bundled(target, filename, das_path, md_dir, report)
        new_link = build_relative_image_link(filename)
        if new_link != target.strip():
            report['relinked'].append(filename)
        return f'![{alt}]({new_link})'

    def replace_html_image(match):
        prefix, target, suffix = match.group(1), match.group(2), match.group(3)
        filename = extract_image_filename(target)
        if not IMAGE_FILE_PATTERN.match(filename):
            return match.group(0)
        ensure_image_bundled(target, filename, das_path, md_dir, report)
        new_link = build_relative_image_link(filename)
        if new_link != target.strip():
            report['relinked'].append(filename)
        return f'{prefix}{new_link}{suffix}'

    md_text = MD_IMAGE_LINK_PATTERN.sub(replace_md_image, md_text)
    md_text = HTML_IMAGE_SRC_PATTERN.sub(replace_html_image, md_text)
    return md_text
    # ------------------------------------------------------------

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | Front Matter and Markdown Conversion
# -----------------------------------------------------------------------------

    # FUNCTION | Split YAML Front Matter from the Markdown Body
    # ------------------------------------------------------------
def split_front_matter(md_text):
    """Return (front_matter_dict, body_text); front matter is optional."""
    meta  = {}
    match = FRONT_MATTER_PATTERN.match(md_text)

    if not match:
        return meta, md_text

    for line in match.group(1).splitlines():
        if ':' in line:
            key, _, value = line.partition(':')
            meta[key.strip().lower()] = value.strip().strip('"\'')

    return meta, md_text[match.end():]
    # ------------------------------------------------------------


    # FUNCTION | Resolve the Document Display Title
    # ------------------------------------------------------------
def resolve_document_title(meta, body_text, project_code):
    """Prefer front matter title, then first H1 heading, then a default."""
    if meta.get('title'):
        return meta['title']

    h1_match = re.search(r'^#\s+(.+)$', body_text, re.MULTILINE)
    if h1_match:
        return h1_match.group(1).strip()

    return f'{project_code} - Design & Access Statement'
    # ------------------------------------------------------------


    # FUNCTION | Convert Markdown Body Text to HTML
    # ------------------------------------------------------------
def convert_markdown_to_html(body_text):
    """Convert markdown to HTML using python-markdown with NA-relevant extensions."""
    try:
        import markdown
    except ImportError:
        raise RuntimeError(
            "The 'markdown' package is required. Install with: python -m pip install markdown"
        )

    body_text = MARK_HIGHLIGHT_PATTERN.sub(r'<mark>\1</mark>', body_text)   # <-- Typora ==highlight== support

    return markdown.markdown(
        body_text,
        extensions=['tables', 'fenced_code', 'sane_lists', 'md_in_html'],
        output_format='html5',
    )
    # ------------------------------------------------------------


    # FUNCTION | Wrap Converted HTML in the Standalone Document Template
    # ------------------------------------------------------------
def build_html_document(document_title, body_html, project_code):
    """Build the full standalone HTML page linked to the common DAS stylesheet.

    Image links stay relative to the statement folder so the document renders
    correctly on the CDN, on the live site, and when opened from the local
    project portal folder. PlanVision rewrites them to CDN URLs at load time.
    """
    generated_stamp = datetime.now().strftime('%d-%b-%Y %H:%M')

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="generator" content="Noble Architecture - ProjectVision DAS Builder">
    <meta name="na-project-code" content="{project_code}">
    <meta name="na-generated" content="{generated_stamp}">
    <title>{document_title}</title>
    <link rel="stylesheet" href="{DAS_COMMON_STYLESHEET_URL}">
</head>
<body class="na_das_page">
    <article class="na_das_document">
{body_html}
    </article>
</body>
</html>
'''
    # ------------------------------------------------------------

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | Project Data JSON Update
# -----------------------------------------------------------------------------

    # FUNCTION | Collect the Bundled Statement Image Inventory
    # ------------------------------------------------------------
def collect_statement_images(das_path):
    """List image filenames currently bundled in 01__Statement__ImageFiles/."""
    image_dir = os.path.join(das_path, DAS_IMAGE_FOLDER)
    if not os.path.isdir(image_dir):
        return []

    return sorted([
        f for f in os.listdir(image_dir)
        if os.path.isfile(os.path.join(image_dir, f)) and IMAGE_FILE_PATTERN.match(f)
    ])
    # ------------------------------------------------------------


    # FUNCTION | Build the design-access-statement Data Object
    # ------------------------------------------------------------
def build_das_data_object(year_folder_name, project_folder, phase_folder,
                          das_folder, md_filename, html_filename,
                          pdf_filename, document_title, images):
    """Assemble the JSON object PlanVision reads to resolve all DAS links."""
    das_rel_path  = f'{PLANVISION_CONTENT_FOLDER}/{phase_folder}/{das_folder}'
    cdn_base_url  = (f'{CDN_BASE_URL}/{R2_BASE_PREFIX}/{year_folder_name}'
                     f'/{project_folder}/{das_rel_path}')
    live_base_url = (f'{LIVE_DOMAIN}/na-project-portal/{year_folder_name}'
                     f'/{project_folder}/{das_rel_path}')

    return {
        'das-enabled'          : True,
        'das-document-title'   : document_title,
        'das-phase-folder'     : phase_folder,
        'das-statement-folder' : das_folder,
        'das-markdown-file'    : md_filename,
        'das-html-file'        : html_filename,
        'das-pdf-file'         : pdf_filename,
        'das-last-built'       : datetime.now().strftime('%d-%b-%Y'),
        'das-document-links'   : {
            'das-base-url--cdn'  : cdn_base_url,
            'das-base-url--live' : live_base_url,
            'das-html-url--cdn'  : f'{cdn_base_url}/{quote(html_filename)}',
            'das-html-url--live' : f'{live_base_url}/{quote(html_filename)}',
            'das-pdf-url--cdn'   : f'{cdn_base_url}/{quote(pdf_filename)}' if pdf_filename else None,
            'das-pdf-url--live'  : f'{live_base_url}/{quote(pdf_filename)}' if pdf_filename else None,
        },
        'das-image-files'      : {
            'das-image-folder' : DAS_IMAGE_FOLDER,
            'das-images'       : images,
        },
    }
    # ------------------------------------------------------------


    # FUNCTION | Write the DAS Object into PlanVision Project Data JSON
    # ------------------------------------------------------------
def update_project_data_json(project_path, das_object):
    """Merge the design-access-statement object into the project data JSON."""
    json_path = os.path.join(project_path, PLANVISION_CONTENT_FOLDER, PLANVISION_DATA_FILENAME)
    data      = {}

    if os.path.isfile(json_path):
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            print(f'  [WARNING] Could not read project data JSON, rebuilding: {e}')

    library = data.setdefault('na-project-data-library', {})
    library['design-access-statement'] = das_object

    with open(json_path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
        f.write('\n')

    return json_path
    # ------------------------------------------------------------

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | Per-Project Build Orchestration
# -----------------------------------------------------------------------------

    # FUNCTION | Build the Design & Access Statement for One Project
    # ------------------------------------------------------------
def build_das_for_project(project_path, year_folder_name, project_folder,
                          project_code, dry_run=False):
    """Full DAS build: relink markdown, convert to HTML, update project JSON.

    Returns a status string: 'built', 'no-das-folder', 'no-markdown', 'dry-run'.
    """
    das_location = find_das_folder(project_path)
    if not das_location:
        return 'no-das-folder'

    phase_folder, das_folder, das_path = das_location

    md_path = find_markdown_file(das_path)
    if not md_path:
        return 'no-markdown'

    md_filename   = os.path.basename(md_path)
    html_filename = f'{os.path.splitext(md_filename)[0]}.html'

    if dry_run:
        print(f'  [DRY-RUN] Would build DAS: {das_path}\\{md_filename} -> {html_filename}')
        return 'dry-run'

    # STEP 1 | Resolve image links inside the markdown (relink + bundle copies)
    with open(md_path, 'r', encoding='utf-8-sig') as f:
        original_text = f.read()

    report   = {'relinked': [], 'copied': [], 'missing': []}
    resolved = resolve_markdown_image_links(original_text, das_path, os.path.dirname(md_path), report)

    if resolved != original_text:
        with open(md_path, 'w', encoding='utf-8', newline='\n') as f:
            f.write(resolved)
        print(f'  [RELINKED] {md_filename} ({len(report["relinked"])} image link(s) resolved)')

    if report['copied']:
        print(f'  [BUNDLED] Copied {len(report["copied"])} image(s) into {DAS_IMAGE_FOLDER}/')
    for missing in report['missing']:
        print(f'  [WARNING] Statement image not found anywhere: {missing}')

    # STEP 2 | Convert markdown to the standalone HTML document
    meta, body_text = split_front_matter(resolved)
    document_title  = resolve_document_title(meta, body_text, project_code)
    body_html       = convert_markdown_to_html(body_text)
    html_document   = build_html_document(document_title, body_html, project_code)

    html_path = os.path.join(das_path, html_filename)
    with open(html_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(html_document)
    print(f'  [WRITTEN] {html_path}')

    # STEP 3 | Detect an optional statement PDF for the fallback route
    pdf_filename = None
    for entry in sorted(os.listdir(das_path)):
        if entry.lower().endswith('.pdf') and os.path.isfile(os.path.join(das_path, entry)):
            pdf_filename = entry
            break

    # STEP 4 | Update the PlanVision project data JSON with the DAS object
    images     = collect_statement_images(das_path)
    das_object = build_das_data_object(
        year_folder_name, project_folder, phase_folder, das_folder,
        md_filename, html_filename, pdf_filename, document_title, images
    )
    json_path = update_project_data_json(project_path, das_object)
    print(f'  [WRITTEN] {json_path} (design-access-statement object updated)')

    return 'built'
    # ------------------------------------------------------------


    # FUNCTION | Run DAS Builds for a List of Discovered Projects
    # ------------------------------------------------------------
def run_das_builds(target_projects, dry_run=False):
    """Entry point used by ProjectVision__BuildScript__.py.

    Accepts the build script's project dicts (projectCode / projectFolder /
    projectYear / folderPath) and returns the number of statements built.
    """
    built_count = 0

    for proj in target_projects:
        year_folder_name = f"{proj['projectYear']}-Projects"
        status = build_das_for_project(
            proj['folderPath'], year_folder_name,
            proj['projectFolder'], proj['projectCode'], dry_run=dry_run
        )

        if status in ('built', 'dry-run'):
            built_count += 1
        elif status == 'no-markdown':
            print(f'  [INFO] {proj["projectCode"]}: statement folder present but no markdown file yet')

    if built_count:
        print(f'\n  [INFO] Design & Access Statement built for {built_count} project(s)')

    return built_count
    # ------------------------------------------------------------

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | CLI Entry Point
# -----------------------------------------------------------------------------

    # FUNCTION | Standalone Command Line Execution
    # ------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description='Noble Architecture - Design & Access Statement Builder'
    )
    parser.add_argument(
        '--portal-root',
        default=None,
        help='Path to na-project-portal directory (auto-detected if not provided)'
    )
    parser.add_argument(
        '--project',
        required=True,
        help='Target project folder name (e.g. JH03__RomerCottage)'
    )
    parser.add_argument(
        '--dry-run-check',
        action='store_true',
        help='Preview the build without writing any files'
    )
    args = parser.parse_args()

    if args.portal_root:
        portal_root = os.path.abspath(args.portal_root)
    else:
        script_dir  = os.path.dirname(os.path.abspath(__file__))
        portal_root = os.path.normpath(os.path.join(script_dir, '..', '..', 'na-project-portal'))

    project_folder = args.project.strip()
    code_match     = re.match(r'^([A-Z]{2}[0-9]{2})', project_folder.upper())
    project_code   = code_match.group(1) if code_match else project_folder[:4].upper()

    for entry in sorted(os.listdir(portal_root)):
        year_match = re.match(r'^(\d{2})-Projects$', entry)
        if not year_match:
            continue
        project_path = os.path.join(portal_root, entry, project_folder)
        if os.path.isdir(project_path):
            print(f'\n  [TARGET] {project_folder} ({entry})')
            status = build_das_for_project(
                project_path, entry, project_folder, project_code,
                dry_run=args.dry_run_check
            )
            print(f'  [RESULT] {status}\n')
            return 0 if status in ('built', 'dry-run') else 1

    print(f'  [ERROR] Project folder not found in portal: {project_folder}')
    return 1
    # ------------------------------------------------------------


if __name__ == '__main__':
    raise SystemExit(main())

# endregion -------------------------------------------------------------------
