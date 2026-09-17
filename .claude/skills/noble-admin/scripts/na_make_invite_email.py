# =============================================================================
# NOBLE ARCHITECTURE - PORTAL INVITE EMAIL BUILDER
# =============================================================================
#
# FILE       : na_make_invite_email.py
# PURPOSE    : Generate the client portal invite email card for a project
# AUTHOR     : Adam Noble - Noble Architecture
# CREATED    : 17-Aug-2026
#
# DESCRIPTION:
# - Builds an email-embeddable HTML card from the approved NP03 master template
# - Substitutes the four project-specific values: header comment, page title,
#   hub heading and the ?project= link target
# - Optionally personalises the greeting with the client name held in R2
#
# The PIN is deliberately NOT included. Sending the PIN alongside the link in
# the same email would defeat the point of gating the portal. Send it separately,
# by text or on a call.
#
# USAGE:
#   python na_make_invite_email.py SB04
#   python na_make_invite_email.py SB04 --personalise      # adds "Dear ..." line
#   python na_make_invite_email.py SB04 --open             # open in browser after
#
# WORKFLOW AFTER GENERATION:
#   1. Open the generated .html in a browser
#   2. Select all (Ctrl+A) and copy (Ctrl+C)
#   3. Paste straight into the email client - it keeps the formatting
#   4. Send the PIN separately
#
# =============================================================================

import argparse
import json
import os
import re
import sys
import webbrowser

# -----------------------------------------------------------------------------
# CONSTANTS | Paths and template
# -----------------------------------------------------------------------------

DEFAULT_REPO_ROOT = r"D:\WE10_--_Public-Repo_--_Live-Website"

EMAIL_DIR_REL     = os.path.join("na-apps", "10__NaProjectAdmin__DocumentSystem__CoreAppCode",
                                 "20__DistributionEmails")
TEMPLATE_NAME     = "Distribution__DocumentPortal__InviteEmail__.html"
OUTPUT_PATTERN    = "Distribution__DocumentPortal__InviteEmail__{code}__.html"

PORTAL_URL        = ("https://www.noble-architecture.com/na-apps/"
                     "10__NaProjectAdmin__DocumentSystem__CoreAppCode/?project={code}")

CODE_PATTERN      = re.compile(r"^[A-Z]{2}\d{2}$")

# Values baked into the master template that must be swapped out.
TEMPLATE_PROJECT_FOLDER = "NP03__AshnessClose"
TEMPLATE_PROJECT_NAME   = "Ashness Close"
TEMPLATE_PROJECT_CODE   = "NP03"


# -----------------------------------------------------------------------------
# HELPERS | Project lookup
# -----------------------------------------------------------------------------

def find_project(repo_root, code):
    """Locate the project folder. Returns (year, folder) or (None, None)."""
    portal = os.path.join(repo_root, "na-project-portal")
    for year_dir in sorted(os.listdir(portal)):
        match = re.match(r"^(\d{2})-Projects$", year_dir)
        if not match:
            continue
        year_path = os.path.join(portal, year_dir)
        if not os.path.isdir(year_path):
            continue
        for folder in sorted(os.listdir(year_path)):
            if folder.upper().startswith(code.upper()):
                return match.group(1), folder
    return None, None


def read_project_name(repo_root, year, folder):
    """Read projectName from the project config."""
    path = os.path.join(repo_root, "na-project-portal", "{}-Projects".format(year), folder,
                        "10__ProjectAdmin__AppContent", "ProjectAdmin__ProjectConfig__.json")
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle).get("projectName") or folder


def fetch_client_name(code):
    """Fetch the client name from R2 for the personalised greeting.

    Reuses na_push_clientdata's transport so the browser headers and token
    format stay in one place. Returns None when unavailable.
    """
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import na_push_clientdata as pusher
    except ImportError:
        return None

    endpoint = pusher.WORKER_BASE_URL.rstrip("/") + "/" + pusher.CLIENTDATA_PATH
    token    = pusher.make_session_token(code)
    import urllib.request
    url = "{}?project={}&token={}".format(endpoint, code, urllib.request.quote(token))
    status, body = pusher.get_json(url)
    if status == 200 and body.get("success"):
        return (body.get("data") or {}).get("clientName")
    return None


# -----------------------------------------------------------------------------
# BUILDER | Substitute project values into the template
# -----------------------------------------------------------------------------

def build_email(template, code, project_name, folder, client_name=None):
    """Return the template with all project-specific values swapped."""
    html = template

    # 1 | Header comment
    html = html.replace("PROJECT    : {}".format(TEMPLATE_PROJECT_FOLDER),
                        "PROJECT    : {}".format(folder))

    # 2 | Page title
    html = html.replace("Project Admin Email Card - {}".format(TEMPLATE_PROJECT_NAME),
                        "Project Admin Email Card - {}".format(project_name))

    # 3 | Hub heading
    html = html.replace("{} Project Hub".format(TEMPLATE_PROJECT_NAME),
                        "{} Project Hub".format(project_name))

    # 4 | Portal link
    html = html.replace(PORTAL_URL.format(code=TEMPLATE_PROJECT_CODE),
                        PORTAL_URL.format(code=code))

    # 5 | Optional personalised greeting, inserted above the standard welcome text
    if client_name:
        anchor = "Welcome to your Documentation Portal. <br> <br>"
        if anchor in html:
            html = html.replace(anchor, "Dear {},<br><br>\n                    {}".format(
                client_name, anchor))

    return html


def verify(html, code, project_name):
    """Confirm no template values survived the substitution."""
    problems = []
    if TEMPLATE_PROJECT_CODE in html:
        problems.append("template project code {} still present".format(TEMPLATE_PROJECT_CODE))
    if TEMPLATE_PROJECT_NAME in html:
        problems.append("template project name '{}' still present".format(TEMPLATE_PROJECT_NAME))
    if PORTAL_URL.format(code=code) not in html:
        problems.append("portal link for {} not found".format(code))
    if "{} Project Hub".format(project_name) not in html:
        problems.append("hub heading for '{}' not found".format(project_name))
    return problems


# -----------------------------------------------------------------------------
# MAIN
# -----------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Build the portal invite email for a project.")
    parser.add_argument("code",          help="Project code, e.g. SB04")
    parser.add_argument("--personalise", action="store_true",
                        help="Add a 'Dear <client>' line using the name held in R2")
    parser.add_argument("--open",        action="store_true", dest="open_after",
                        help="Open the generated file in a browser")
    parser.add_argument("--repo",        default=DEFAULT_REPO_ROOT, help="Repository root")
    args = parser.parse_args()

    code = args.code.strip().upper()
    if not CODE_PATTERN.match(code):
        print("ERROR: '{}' is not a valid project code.".format(code))
        return 1

    year, folder = find_project(args.repo, code)
    if not year:
        print("ERROR: no project folder found for {}.".format(code))
        return 1

    project_name  = read_project_name(args.repo, year, folder)
    email_dir     = os.path.join(args.repo, EMAIL_DIR_REL)
    template_path = os.path.join(email_dir, TEMPLATE_NAME)

    if not os.path.exists(template_path):
        print("ERROR: master template not found: {}".format(template_path))
        return 1

    with open(template_path, "r", encoding="utf-8") as handle:
        template = handle.read()

    client_name = None
    if args.personalise:
        client_name = fetch_client_name(code)
        if not client_name:
            print("  NOTE: could not read the client name from R2 - "
                  "generating without a personalised greeting.")

    html     = build_email(template, code, project_name, folder, client_name)
    problems = verify(html, code, project_name)
    if problems:
        print("ERROR: substitution incomplete:")
        for problem in problems:
            print("  - {}".format(problem))
        return 1

    out_path = os.path.join(email_dir, OUTPUT_PATTERN.format(code=code))
    with open(out_path, "w", encoding="utf-8") as handle:
        handle.write(html)

    print("\n  Invite email built for {} - {}".format(code, project_name))
    print("  File   : {}".format(out_path))
    print("  Links  : {}".format(PORTAL_URL.format(code=code)))
    if client_name:
        print("  Greeting: Dear {},".format(client_name))
    print("\n  To send:")
    print("    1. Open the file in a browser")
    print("    2. Select all (Ctrl+A), copy (Ctrl+C)")
    print("    3. Paste into the email - formatting is preserved")
    print("    4. Send the PIN separately, NOT in this email\n")

    if args.open_after:
        webbrowser.open("file:///" + out_path.replace("\\", "/"))

    return 0


if __name__ == "__main__":
    sys.exit(main())
