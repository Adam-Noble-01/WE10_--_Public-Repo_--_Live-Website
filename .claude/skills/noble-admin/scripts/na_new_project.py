# =============================================================================
# NOBLE ARCHITECTURE - NEW PROJECT SCAFFOLDER
# =============================================================================
#
# FILE       : na_new_project.py
# PURPOSE    : Create a portal project from the current-schema template set
# AUTHOR     : Adam Noble - Noble Architecture
# CREATED    : 17-Aug-2026
#
# DESCRIPTION:
# - Creates the full folder tree under na-project-portal/{YY}-Projects/
# - Writes current-schema JSON (plural Quotations, per-contract SpecialTerms)
# - Generates and SHA-256 hashes the project PIN
# - Updates both registries (ProjectKeysIndex + ProjectVision MasterProjectIndex)
# - Stages a client PII template OUTSIDE the repo
#
# NOTE: Deliberately does NOT reproduce start_local_server.py's legacy singular
#       ProjectAdmin__Quotation__.json / ProjectAdmin__SpecialTerms__.json.
#
# USAGE:
#   python na_new_project.py --code EB03 --name "The Firs"
#   python na_new_project.py --code SM06 --name "Wollaton Vale" --year 26 \
#       --contracts general-business,concept-design,planning-approval --dry-run
#
# =============================================================================

import argparse
import hashlib
import json
import os
import random
import re
import sys
from datetime import datetime

# -----------------------------------------------------------------------------
# CONSTANTS | Paths and defaults
# -----------------------------------------------------------------------------

DEFAULT_REPO_ROOT = r"D:\WE10_--_Public-Repo_--_Live-Website"
PII_STAGING_DIR   = r"C:\Users\Administrator\.claude\noble-admin-private\clientdata"

KEYS_INDEX_REL    = os.path.join("na-apps", "10__NaProjectAdmin__DocumentSystem__CoreAppCode",
                                 "03__Src__AppModules", "02__AppData",
                                 "AppConfiguration__ProjectKeysIndex__.json")
MASTER_INDEX_REL  = os.path.join("na-apps", "05__ProjectVision__CoreAppCode", "05__AppData",
                                 "ProjectVision__MasterProjectIndex__Core__.json")

CODE_PATTERN      = re.compile(r"^[A-Z]{2}\d{2}$")

CONTRACT_NAMES = {
    "general-business"     : "General Business Terms",
    "concept-design"       : "Concept Design Stage",
    "planning-approval"    : "Planning Approval Stage",
    "building-regulations" : "Building Regulations Stage",
    "project-management"   : "Project Management Stage",
    "building-surveying"   : "Building Surveying Service",
    "planvision-app"       : "PlanVision App Terms",
    "truevision-app"       : "TrueVision App Terms",
    "project-vision"       : "ProjectVision App Terms",
}

CONTRACT_SHORT_NAMES = {
    "general-business"     : "General Terms",
    "concept-design"       : "Concept Design",
    "planning-approval"    : "Planning",
    "building-regulations" : "Building Regs",
    "project-management"   : "Project Mgmt",
    "building-surveying"   : "Surveying",
    "planvision-app"       : "PlanVision",
    "truevision-app"       : "TrueVision",
    "project-vision"       : "ProjectVision",
}

# Folders, each mapped to the placeholder file that keeps it in git.
FOLDER_TREE = {
    "01__Archive":
        ("OldVersion__FilesHere__.txt", "This folder contains archived/old versions of project files."),
    "10__ProjectAdmin__AppContent":
        ("ProjectAdminContent__FilesHere__.txt", "This folder contains Project Admin application content."),
    "20__PlanVision__AppContent":
        ("PlanVisionAppContent__FilesHere__.txt", "This folder contains PlanVision application content."),
    "20__PlanVision__AppContent/DesignPhase01__ConceptDesign__Content":
        ("ConceptFiles__Pdf&Png__GoHere__.note", ""),
    "20__PlanVision__AppContent/DesignPhase01__ConceptDesign__Content/00__Archive":
        ("ArchivedFile__GoHere__AreNotLoadedToUi__.note", ""),
    "20__PlanVision__AppContent/DesignPhase02__PlanningApproval__Content":
        ("PlanningApprovalFiles__Pdf&Png__GoHere__.note", ""),
    "20__PlanVision__AppContent/DesignPhase02__PlanningApproval__Content/00__Archive":
        ("ArchivedFile__GoHere__AreNotLoadedToUi__.note", ""),
    "20__PlanVision__AppContent/DesignPhase02__PlanningApproval__Content/01__AdminDocs":
        ("AdminDocs__GoHere__.note", ""),
    "20__PlanVision__AppContent/DesignPhase02__PlanningApproval__Content/02__DesignStatment":
        ("Design&AccessStatment__MarkdownFile__GoHere__.note", ""),
    "20__PlanVision__AppContent/DesignPhase02__PlanningApproval__Content/02__DesignStatment/00__Archive":
        ("ArchivedFile__GoHere__AreIgnoredByBuilder__.note", ""),
    "20__PlanVision__AppContent/DesignPhase02__PlanningApproval__Content/02__DesignStatment/01__Statement__ImageFiles":
        ("Design&AccessStatment__Images__GoHere__.note", ""),
    "20__PlanVision__AppContent/DesignPhase03__BuildingRegs__Content":
        ("BregsPhase__FilesHere__.note", ""),
    "20__PlanVision__AppContent/DesignPhase03__BuildingRegs__Content/00__Archive":
        ("ArchivedFile__GoHere__AreNotLoadedToUi__.note", ""),
    "20__PlanVision__AppContent/DesignPhase03__BuildingRegs__Content/01__Plans":
        ("BregsPhase__PlansElevationsEtc__Pdf&Png__GoHere__.note", ""),
    "20__PlanVision__AppContent/DesignPhase03__BuildingRegs__Content/02__ConstructionDetails":
        ("BregsPhase__ConstructionDetailDocs__Pdf&Png__GoHere__.note", ""),
    "20__PlanVision__AppContent/DesignPhase03__BuildingRegs__Content/03__3dViews":
        ("BregsPhase__3dViewsDocs__Pdf&Png__GoHere__.note", ""),
    "30__TrueVision__AppContent":
        ("TrueVisionAppContent__FilesHere__.txt", "This folder contains TrueVision application content."),
    "30__TrueVision__AppContent/DesignPhase01__ConceptDesign__ExistingBuilding":
        ("GlbModels__GoHere__.note", ""),
    "30__TrueVision__AppContent/DesignPhase01__ConceptDesign__Scheme-01":
        ("GlbModels__GoHere__.note", ""),
}


# -----------------------------------------------------------------------------
# HELPERS | Formatting and hashing
# -----------------------------------------------------------------------------

def uk_date(now=None):
    """Return a display date, e.g. 17-Aug-2026."""
    return (now or datetime.now()).strftime("%d-%b-%Y")


def uk_date_time(now=None):
    """Return a display date and time, e.g. 17-Aug-2026 at 16:52."""
    return (now or datetime.now()).strftime("%d-%b-%Y at %H:%M")


def hash_pin(plain_pin):
    """SHA-256 hash a PIN in the format the admin app validates."""
    return "sha256:" + hashlib.sha256(plain_pin.encode("utf-8")).hexdigest()


def folder_name_for(code, project_name):
    """Build the portal folder name: EB03 + 'The Firs' -> EB03__TheFirs."""
    cleaned = re.sub(r"[^A-Za-z0-9 ]", "", project_name)
    return "{}__{}".format(code, cleaned.replace(" ", ""))


def write_json(path, data, dry_run=False):
    """Write JSON with the house 4-space indent and trailing newline."""
    if dry_run:
        print("    [dry-run] would write {}".format(path))
        return
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=4, ensure_ascii=False)
        handle.write("\n")


def read_json(path):
    """Read a JSON file, returning None when it is absent."""
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


# -----------------------------------------------------------------------------
# TEMPLATES | Current-schema file bodies
# -----------------------------------------------------------------------------

def build_project_config(code, project_name, contracts, hashed_pin, now):
    """Build ProjectAdmin__ProjectConfig__.json."""
    contract_block = {}
    for contract_id in contracts:
        contract_block[contract_id] = {
            "enabled"             : True,
            "signed"              : False,
            "signatureRef"        : None,
            "signedDate"          : None,
            "specialTermsEnabled" : False,
        }

    return {
        "projectCode"         : code,
        "projectName"         : project_name,
        "projectBriefConcise" : "",
        "projectBriefFull"    : "",
        "specialNotes"        : "",
        "projectPin"          : hashed_pin,
        "clientDataStorage"   : "cloudflare-r2-encrypted",
        "contracts"           : contract_block,
        "documents"           : {"quotation": True, "specialTerms": False},
        "createdDate"         : uk_date(now),
        "lastModified"        : uk_date_time(now),
    }


def build_quotations(code, now):
    """Build ProjectAdmin__Quotations__.json with a single empty draft."""
    return {
        "quotations": [
            {
                "quotationRef"       : "QUO-{}-{}-001".format(code, now.year),
                "quotationName"      : "Main Quote",
                "signatureRequired"  : True,
                "quotationDate"      : uk_date(now),
                "projectAddress"     : "",
                "projectDescription" : "",
                "clientDataStorage"  : "cloudflare-r2-encrypted",
                "status"             : "draft",
                "lineItems"          : [],
                "totals": {
                    "subtotal"     : 0,
                    "vatApplicable": True,
                    "vatRate"      : 20,
                    "vat"          : 0,
                    "grandTotal"   : 0,
                },
                "additionalTerms"    : "",
                "createdDate"        : uk_date_time(now),
                "lastModified"       : uk_date_time(now),
            }
        ]
    }


def build_special_terms(contract_id, now):
    """Build SpecialTerms__{contractId}__.json."""
    return {
        "contractId"   : contract_id,
        "contractName" : CONTRACT_NAMES.get(contract_id, contract_id),
        "sectionTitle" : "Special Terms - {}".format(CONTRACT_SHORT_NAMES.get(contract_id, contract_id)),
        "introduction" : "The following special conditions apply to this contract.",
        "terms"        : [],
        "lastUpdated"  : uk_date_time(now),
    }


def build_planvision(project_name, now):
    """Build PlanVision__ProjectData__.json (kebab-case, PlanVision only)."""
    return {
        "na-project-data-library": {
            "project-details": {
                "project-name"          : project_name,
                "project-name-nickname" : project_name,
                "project-address"       : "",
                "project-description"   : "",
                "client-name"           : "",
            },
            "project-phase-config": {
                "active-design-phase" : "DesignPhase01",
                "available-phases"    : ["DesignPhase01"],
                "phase-last-updated"  : uk_date(now),
            },
            "project-documentation": {
                "phase-content": {
                    "DesignPhase01": {
                        "phase-folder"     : "DesignPhase01__ConceptDesign__Content",
                        "folder-structure" : [],
                    }
                }
            },
            "design-access-statement": {"das-enabled": False},
        }
    }


def build_truevision(code, project_name):
    """Build TrueVision__ProjectData__.json. modelUrls are populated by the R2 sync."""
    return {
        "projectCode"      : code,
        "projectName"      : project_name,
        "activeGroupIndex" : 0,
        "modelGroups"      : [],
        "Camera__DefaultPosition": {
            "Camera__DefaultPos": {
                "Camera__DefaultPos__PosX": 12000,
                "Camera__DefaultPos__PosY": 4000,
                "Camera__DefaultPos__PosZ": 14000,
            },
            "Camera__DefaultRotation": {
                "Camera__DefaultRotation__RotX": -0.07,
                "Camera__DefaultRotation__RotY": 0.33,
                "Camera__DefaultRotation__RotZ": 0.02,
            },
            "Camera__DefaultMisc": {"Camera__DefaultMisc__Fov": 45},
        },
        "Navmode__EnabledModes": {
            "Navmode__EnabledModes__Walk": True,
            "Navmode__EnabledModes__Fly" : True,
        },
    }


def build_client_data_stub():
    """Build the PII staging template. Never written inside the repo."""
    empty_address = {"houseNameNo": "", "street": "", "district": "", "county": "", "postcode": ""}
    return {
        "clientName"       : "",
        "clientEmail"      : "",
        "clientPhone"      : "",
        "clientAddress"    : dict(empty_address),
        "projectAddress"   : dict(empty_address),
        "secondaryContact" : {"name": "", "email": "", "phone": ""},
    }


# -----------------------------------------------------------------------------
# REGISTRIES | Keep both indexes in step
# -----------------------------------------------------------------------------

def update_keys_index(repo_root, year, code, folder, dry_run=False):
    """Add the project to AppConfiguration__ProjectKeysIndex__.json."""
    path  = os.path.join(repo_root, KEYS_INDEX_REL)
    index = read_json(path)
    if index is None:
        return False, "keys index not found at {}".format(path)

    index.setdefault(year, {})[code] = folder
    write_json(path, index, dry_run)
    return True, path


def update_master_index(repo_root, year, code, project_name, folder, dry_run=False):
    """Add the project to ProjectVision__MasterProjectIndex__Core__.json."""
    path  = os.path.join(repo_root, MASTER_INDEX_REL)
    index = read_json(path)
    if index is None:
        return False, "master index not found at {}".format(path)

    index.setdefault("projects", {})[code] = {
        "projectCode"   : code,
        "projectName"   : project_name,
        "projectFolder" : folder,
        "projectYear"   : year,
        "subApps"       : {"projectAdmin": True, "planVision": False, "trueVision": False},
    }
    write_json(path, index, dry_run)
    return True, path


def find_code_collision(repo_root, code):
    """Return (year, folder) if the code is already registered, else None."""
    index = read_json(os.path.join(repo_root, KEYS_INDEX_REL)) or {}
    for year, projects in index.items():
        if isinstance(projects, dict) and code in projects:
            return year, projects[code]
    return None


# -----------------------------------------------------------------------------
# MAIN | Scaffold the project
# -----------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Scaffold a Noble Architecture portal project.")
    parser.add_argument("--code",      required=True, help="Project code, e.g. EB03")
    parser.add_argument("--name",      required=True, help="Project name, e.g. 'The Firs'")
    parser.add_argument("--year",      default=None,  help="Two-digit year folder (default: current year)")
    parser.add_argument("--contracts", default="general-business,concept-design",
                        help="Comma-separated contract IDs to enable")
    parser.add_argument("--pin",       default=None,  help="Four-digit PIN (default: random)")
    parser.add_argument("--repo",      default=DEFAULT_REPO_ROOT, help="Repository root")
    parser.add_argument("--dry-run",   action="store_true", help="Report actions without writing")
    args = parser.parse_args()

    now        = datetime.now()
    code       = args.code.strip().upper()
    year       = args.year or now.strftime("%y")
    repo_root  = args.repo
    dry        = args.dry_run

    # --- Validate ------------------------------------------------------------
    if not CODE_PATTERN.match(code):
        print("ERROR: '{}' is not a valid project code. Required format: two uppercase "
              "letters + two digits, e.g. EB03.".format(code))
        return 1

    if code.endswith("00"):
        print("ERROR: sequence 00 is reserved for the AA00 example project. Start at 01.")
        return 1

    if not os.path.isdir(repo_root):
        print("ERROR: repository root not found: {}".format(repo_root))
        return 1

    collision = find_code_collision(repo_root, code)
    if collision:
        print("ERROR: project code {} is already registered for year {} as '{}'.".format(
            code, collision[0], collision[1]))
        return 1

    contracts = [c.strip() for c in args.contracts.split(",") if c.strip()]
    unknown   = [c for c in contracts if c not in CONTRACT_NAMES]
    if unknown:
        print("ERROR: unknown contract id(s): {}".format(", ".join(unknown)))
        print("       Valid ids: {}".format(", ".join(sorted(CONTRACT_NAMES))))
        return 1

    folder       = folder_name_for(code, args.name)
    project_path = os.path.join(repo_root, "na-project-portal", "{}-Projects".format(year), folder)

    if os.path.exists(project_path):
        print("ERROR: project folder already exists: {}".format(project_path))
        return 1

    # Adam picks memorable PINs and will override a random one. Ask before running.
    if not args.pin:
        print("\n  NOTE: no --pin given, generating a random one. Adam normally chooses\n"
              "        his own memorable four-digit PIN - check before handing this over.")
    plain_pin  = args.pin or "{:04d}".format(random.randint(1000, 9999))
    hashed_pin = hash_pin(plain_pin)

    # --- Create folder tree --------------------------------------------------
    print("\nCreating {} ({}) in {}-Projects".format(code, args.name, year))
    print("  Path: {}".format(project_path))

    for rel_folder, (placeholder, body) in FOLDER_TREE.items():
        abs_folder = os.path.join(project_path, rel_folder.replace("/", os.sep))
        if not dry:
            os.makedirs(abs_folder, exist_ok=True)
            with open(os.path.join(abs_folder, placeholder), "w", encoding="utf-8") as handle:
                handle.write(body or "Placeholder - keeps this folder tracked in git.")
    print("  Folders: {} created".format(len(FOLDER_TREE)))

    # --- Write project files -------------------------------------------------
    admin_dir = os.path.join(project_path, "10__ProjectAdmin__AppContent")
    written   = []

    def emit(directory, filename, payload):
        write_json(os.path.join(directory, filename), payload, dry)
        written.append(filename)

    emit(admin_dir, "ProjectAdmin__ProjectConfig__.json",
         build_project_config(code, args.name, contracts, hashed_pin, now))
    emit(admin_dir, "ProjectAdmin__Quotations__.json", build_quotations(code, now))
    emit(admin_dir, "ProjectAdmin__Invoices__.json", {"invoices": []})

    for contract_id in contracts:
        emit(admin_dir, "SpecialTerms__{}__.json".format(contract_id),
             build_special_terms(contract_id, now))

    emit(os.path.join(project_path, "20__PlanVision__AppContent"),
         "PlanVision__ProjectData__.json", build_planvision(args.name, now))
    emit(os.path.join(project_path, "30__TrueVision__AppContent"),
         "TrueVision__ProjectData__.json", build_truevision(code, args.name))

    print("  Files:   {} written".format(len(written)))
    for name in written:
        print("    - {}".format(name))

    # --- Stage PII outside the repo -----------------------------------------
    pii_path = os.path.join(PII_STAGING_DIR, "{}__ClientData__Private__.json".format(code))
    if not dry:
        os.makedirs(PII_STAGING_DIR, exist_ok=True)
        write_json(pii_path, build_client_data_stub(), False)
    print("  PII staged (outside repo): {}".format(pii_path))

    # --- Registries ----------------------------------------------------------
    ok_keys, keys_msg     = update_keys_index(repo_root, year, code, folder, dry)
    ok_master, master_msg = update_master_index(repo_root, year, code, args.name, folder, dry)

    print("  Keys index:   {}".format("updated" if ok_keys else "FAILED - " + str(keys_msg)))
    print("  Master index: {}".format("updated" if ok_master else "FAILED - " + str(master_msg)))

    # --- Summary -------------------------------------------------------------
    print("\n" + "=" * 70)
    print("  PROJECT {} CREATED{}".format(code, "  [DRY RUN - nothing written]" if dry else ""))
    print("=" * 70)
    print("  PIN (plain, note it now): {}".format(plain_pin))
    print("  Stored hashed as        : {}...".format(hashed_pin[:24]))
    print("  Contracts enabled       : {}".format(", ".join(contracts)))
    print("\n  Still to fill in:")
    print("    - projectBriefConcise / projectBriefFull / specialNotes  (project config)")
    print("    - quotation line items                                   (Quotation Manager)")
    print("    - client PII                                             (staged file above)")
    print("    - specialTermsEnabled flags + terms                      (Contract Manager)")
    print("\n  Not committed. Review in the GUI editors, then commit and push.")
    print("=" * 70 + "\n")

    if not (ok_keys and ok_master):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
