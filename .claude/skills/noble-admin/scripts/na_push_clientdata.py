# =============================================================================
# NOBLE ARCHITECTURE - CLIENT PII PUSH TO CLOUDFLARE R2
# =============================================================================
#
# FILE       : na_push_clientdata.py
# PURPOSE    : Push staged client PII to encrypted Cloudflare R2 storage
# AUTHOR     : Adam Noble - Noble Architecture
# CREATED    : 17-Aug-2026
#
# DESCRIPTION:
# - CLI equivalent of the "Save" button in Editor__ProjectConfig__.html
# - Reads the staged plaintext PII file from the private staging folder
# - POSTs to the Cloudflare Worker /projectadmin/clientdata endpoint
# - The Worker performs AES-256-GCM encryption server-side using CLIENT_DATA_KEY
#   and writes ClientData__Private__.json.enc into the R2 bucket
#
# The plaintext PII never enters the repository. Only the Worker holds the key.
#
# USAGE:
#   python na_push_clientdata.py SB04                  # push
#   python na_push_clientdata.py SB04 --verify         # read back what is stored
#   python na_push_clientdata.py SB04 --dry-run        # show payload, send nothing
#
# =============================================================================

import argparse
import base64
import json
import os
import random
import re
import string
import sys
import time
import urllib.error
import urllib.request

# -----------------------------------------------------------------------------
# CONSTANTS | Endpoint and paths
# -----------------------------------------------------------------------------

WORKER_BASE_URL   = "https://na-projectadmin-api.adam-fb3.workers.dev/"
CLIENTDATA_PATH   = "projectadmin/clientdata"

DEFAULT_REPO_ROOT = r"D:\WE10_--_Public-Repo_--_Live-Website"
PII_STAGING_DIR   = r"C:\Users\Administrator\.claude\noble-admin-private\clientdata"

CODE_PATTERN      = re.compile(r"^[A-Z]{2}\d{2}$")
REQUEST_TIMEOUT   = 30

# Cloudflare's browser-integrity check rejects the default Python-urllib agent
# with HTTP 403 / error 1010. The editor tools reach this same endpoint from a
# browser, so present a normal browser user agent and origin.
BROWSER_HEADERS = {
    "Content-Type" : "application/json",
    "User-Agent"   : ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"),
    "Accept"       : "application/json",
    "Origin"       : "http://localhost:8081",
    "Referer"      : "http://localhost:8081/",
}


# -----------------------------------------------------------------------------
# HELPERS | Token, project lookup and transport
# -----------------------------------------------------------------------------

def make_session_token(project_code):
    """Build the session token the Worker expects: base64(CODE:timestamp:random).

    Mirrors generateDevSessionToken() in Editor__ProjectConfig__.html. The Worker
    checks the project code matches and the timestamp is recent; there is no
    shared secret involved.
    """
    timestamp = int(time.time() * 1000)
    suffix    = "".join(random.choice(string.ascii_lowercase + string.digits) for _ in range(11))
    raw       = "{}:{}:{}".format(project_code, timestamp, suffix)
    return base64.b64encode(raw.encode("utf-8")).decode("ascii")


def find_project(repo_root, code):
    """Locate the project folder. Returns (year, folder) or (None, None)."""
    portal = os.path.join(repo_root, "na-project-portal")
    if not os.path.isdir(portal):
        return None, None
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


def project_name_for(repo_root, year, folder):
    """Read projectName from the project config, falling back to the folder name."""
    path = os.path.join(repo_root, "na-project-portal", "{}-Projects".format(year), folder,
                        "10__ProjectAdmin__AppContent", "ProjectAdmin__ProjectConfig__.json")
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle).get("projectName") or folder
    except (OSError, json.JSONDecodeError):
        return folder


def post_json(url, payload):
    """POST JSON and return (status_code, parsed_body)."""
    data    = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=data, method="POST", headers=BROWSER_HEADERS)
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        try:
            return exc.code, json.loads(body)
        except json.JSONDecodeError:
            return exc.code, {"error": body[:400]}
    except urllib.error.URLError as exc:
        return 0, {"error": "connection failed - {}".format(exc.reason)}


def get_json(url):
    """GET JSON and return (status_code, parsed_body)."""
    request = urllib.request.Request(url, method="GET", headers=BROWSER_HEADERS)
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        try:
            return exc.code, json.loads(body)
        except json.JSONDecodeError:
            return exc.code, {"error": body[:400]}
    except urllib.error.URLError as exc:
        return 0, {"error": "connection failed - {}".format(exc.reason)}


def summarise(client_data):
    """Print a readable summary without dumping every field."""
    def addr(block):
        parts = [block.get(k, "") for k in ("houseNameNo", "street", "district", "county", "postcode")]
        return ", ".join(p for p in parts if p)

    print("    name           : {}".format(client_data.get("clientName") or "(empty)"))
    print("    email          : {}".format(client_data.get("clientEmail") or "(empty)"))
    print("    phone          : {}".format(client_data.get("clientPhone") or "(empty)"))
    print("    client address : {}".format(addr(client_data.get("clientAddress") or {}) or "(empty)"))
    print("    site address   : {}".format(addr(client_data.get("projectAddress") or {}) or "(empty)"))
    secondary = client_data.get("secondaryContact") or {}
    if secondary.get("name"):
        print("    secondary      : {} / {} / {}".format(
            secondary.get("name", ""), secondary.get("email", ""), secondary.get("phone", "")))


# -----------------------------------------------------------------------------
# MAIN | Push or verify
# -----------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Push staged client PII to encrypted R2 storage.")
    parser.add_argument("code",       help="Project code, e.g. SB04")
    parser.add_argument("--verify",   action="store_true", help="Read back what R2 currently holds")
    parser.add_argument("--dry-run",  action="store_true", help="Show the payload without sending")
    parser.add_argument("--file",     default=None, help="Override the staged PII file path")
    parser.add_argument("--repo",     default=DEFAULT_REPO_ROOT, help="Repository root")
    parser.add_argument("--worker",   default=WORKER_BASE_URL, help="Worker base URL")
    args = parser.parse_args()

    code = args.code.strip().upper()
    if not CODE_PATTERN.match(code):
        print("ERROR: '{}' is not a valid project code.".format(code))
        return 1

    year, folder = find_project(args.repo, code)
    if not year:
        print("ERROR: no project folder found for {}.".format(code))
        return 1

    endpoint = args.worker.rstrip("/") + "/" + CLIENTDATA_PATH

    # --- Verify mode ---------------------------------------------------------
    if args.verify:
        token = make_session_token(code)
        url   = "{}?project={}&token={}".format(endpoint, code, urllib.request.quote(token))
        print("\nReading client data for {} from R2...".format(code))
        status, body = get_json(url)
        if status == 200 and body.get("success"):
            # The store endpoint takes 'clientData'; the retrieve endpoint returns 'data'.
            print("  Stored in R2:")
            summarise(body.get("data") or body.get("clientData") or {})
            return 0
        print("  No usable data returned (HTTP {}): {}".format(
            status, body.get("error") or body.get("message") or body))
        return 1

    # --- Load staged file ----------------------------------------------------
    pii_path = args.file or os.path.join(PII_STAGING_DIR,
                                         "{}__ClientData__Private__.json".format(code))
    if not os.path.exists(pii_path):
        print("ERROR: staged PII file not found: {}".format(pii_path))
        return 1

    with open(pii_path, "r", encoding="utf-8") as handle:
        client_data = json.load(handle)

    if not client_data.get("clientName"):
        print("ERROR: clientName is empty in the staged file - nothing worth pushing.")
        return 1

    project_name = project_name_for(args.repo, year, folder)

    print("\n  Project : {} ({}-Projects/{})".format(code, year, folder))
    print("  Target  : {}".format(endpoint))
    print("  Source  : {}".format(pii_path))
    print("  Payload :")
    summarise(client_data)

    if args.dry_run:
        print("\n  [dry-run] nothing sent.\n")
        return 0

    payload = {
        "projectCode"  : code,
        "year"         : year,
        "projectName"  : project_name,
        "clientData"   : client_data,
        "sessionToken" : make_session_token(code),
    }

    print("\n  Pushing to Cloudflare R2 (Worker encrypts with AES-256-GCM)...")
    status, body = post_json(endpoint, payload)

    if status == 200 and body.get("success"):
        print("  OK - {}".format(body.get("message", "stored")))
        print("  Key: NaProjectPortal/{}-Projects/{}/10__ProjectAdmin__AppContent/"
              "ClientData__Private__.json.enc".format(body.get("year", year), folder))
        print("\n  Reload the client portal - the TO block should now populate.\n")
        return 0

    print("  FAILED (HTTP {}): {}".format(status, body.get("error") or body.get("message") or body))
    return 1


if __name__ == "__main__":
    sys.exit(main())
