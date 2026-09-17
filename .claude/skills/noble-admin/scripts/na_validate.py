# =============================================================================
# NOBLE ARCHITECTURE - PROJECT DATA VALIDATOR
# =============================================================================
#
# FILE       : na_validate.py
# PURPOSE    : Check a portal project's JSON against the current live schema
# AUTHOR     : Adam Noble - Noble Architecture
# CREATED    : 17-Aug-2026
#
# DESCRIPTION:
# - Validates project config, quotations, invoices, special terms, PlanVision
#   and TrueVision data files
# - Recomputes every total and flags arithmetic that does not reconcile
# - Cross-checks both registries and the specialTermsEnabled / file pairing
# - Reports ERROR (client-visible breakage), WARN (probably wrong) and INFO
#
# USAGE:
#   python na_validate.py EB03
#   python na_validate.py --all
#
# EXIT CODES: 0 = no errors, 1 = one or more errors
#
# =============================================================================

import argparse
import json
import os
import re
import sys
from datetime import datetime

# -----------------------------------------------------------------------------
# CONSTANTS | Paths, patterns and canonical values
# -----------------------------------------------------------------------------

DEFAULT_REPO_ROOT = r"D:\WE10_--_Public-Repo_--_Live-Website"
PII_STAGING_DIR   = r"C:\Users\Administrator\.claude\noble-admin-private\clientdata"

KEYS_INDEX_REL    = os.path.join("na-apps", "10__NaProjectAdmin__DocumentSystem__CoreAppCode",
                                 "03__Src__AppModules", "02__AppData",
                                 "AppConfiguration__ProjectKeysIndex__.json")
MASTER_INDEX_REL  = os.path.join("na-apps", "05__ProjectVision__CoreAppCode", "05__AppData",
                                 "ProjectVision__MasterProjectIndex__Core__.json")

CODE_PATTERN      = re.compile(r"^[A-Z]{2}\d{2}$")
QUO_REF_PATTERN   = re.compile(r"^QUO-[A-Z]{2}\d{2}-\d{4}-\d{3}$")
INV_REF_PATTERN   = re.compile(r"^INV-[A-Z]{2}\d{2}-\d{4}-\d{3}$")

VALID_CONTRACTS = {
    "general-business", "concept-design", "planning-approval", "building-regulations",
    "project-management", "building-surveying", "planvision-app", "truevision-app",
    "project-vision",
}

CANONICAL_GROUPS = {
    "Design Phase - 01 : Concept Design",
    "Design Phase - 02 : Planning Approval",
    "Design Phase - 03 : Building Regulations",
    "Additional Extras : **For Discussion & Consideration!!",
    "Third Party Fees - **Not Included!!",
}

VALID_QUOTE_STATUS   = {"draft", "sent", "accepted", "declined"}

# Invoices store unpaid/paid only. 'overdue' is derived from dueDate at render
# time by DocumentSystem__InvoiceRenderer__.js, so it should not be stored.
VALID_INVOICE_STATUS = {"unpaid", "paid"}

LEGACY_FILES = ["ProjectAdmin__Quotation__.json", "ProjectAdmin__SpecialTerms__.json"]


# -----------------------------------------------------------------------------
# REPORTER | Collects findings for one project
# -----------------------------------------------------------------------------

class Report:
    """Accumulates validation findings for a single project."""

    def __init__(self, code):
        self.code     = code
        self.errors   = []
        self.warnings = []
        self.infos    = []

    def error(self, message):
        self.errors.append(message)

    def warn(self, message):
        self.warnings.append(message)

    def info(self, message):
        self.infos.append(message)

    def render(self):
        print("\n" + "=" * 70)
        print("  {}".format(self.code))
        print("=" * 70)
        for message in self.errors:
            print("  ERROR  {}".format(message))
        for message in self.warnings:
            print("  WARN   {}".format(message))
        for message in self.infos:
            print("  INFO   {}".format(message))
        if not (self.errors or self.warnings):
            print("  OK     No issues found.")
        print("  -> {} error(s), {} warning(s)".format(len(self.errors), len(self.warnings)))


# -----------------------------------------------------------------------------
# HELPERS | Loading and arithmetic
# -----------------------------------------------------------------------------

def read_json(path):
    """Read JSON, returning (data, error_message)."""
    if not os.path.exists(path):
        return None, "not found"
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle), None
    except json.JSONDecodeError as exc:
        return None, "invalid JSON - {}".format(exc)


def line_total(items):
    """Sum quantity x rate across line items."""
    total = 0.0
    for item in items:
        try:
            total += float(item.get("quantity", 0)) * float(item.get("rate", 0))
        except (TypeError, ValueError):
            pass
    return total


def check_totals(report, label, items, totals):
    """Recompute subtotal, VAT and grand total; report anything that fails to reconcile."""
    if not isinstance(totals, dict):
        report.error("{}: totals block missing or not an object".format(label))
        return

    expected_subtotal = line_total(items)
    subtotal          = float(totals.get("subtotal", 0) or 0)
    vat_rate          = float(totals.get("vatRate", 0) or 0)
    vat               = float(totals.get("vat", 0) or 0)
    grand             = float(totals.get("grandTotal", 0) or 0)
    vat_applicable    = totals.get("vatApplicable")

    if abs(subtotal - expected_subtotal) > 0.01:
        report.error("{}: subtotal is {:.2f} but line items sum to {:.2f}".format(
            label, subtotal, expected_subtotal))

    if vat_applicable is False and vat_rate != 0:
        report.error("{}: vatApplicable is false but vatRate is {}".format(label, vat_rate))

    if vat_applicable is True and vat_rate == 0:
        report.warn("{}: vatApplicable is true but vatRate is 0".format(label))

    expected_vat = subtotal * vat_rate / 100.0
    if abs(vat - expected_vat) > 1.0:
        report.error("{}: vat is {:.2f} but {:.0f}% of {:.2f} is {:.2f}".format(
            label, vat, vat_rate, subtotal, expected_vat))

    if abs(grand - (subtotal + vat)) > 0.01:
        report.error("{}: grandTotal is {:.2f} but subtotal + vat is {:.2f}".format(
            label, grand, subtotal + vat))

    if vat_applicable is None:
        report.warn("{}: totals has no vatApplicable flag".format(label))


def parse_uk_date(value):
    """Parse a DD-MMM-YYYY display date, returning None on failure."""
    try:
        return datetime.strptime(value, "%d-%b-%Y")
    except (ValueError, TypeError):
        return None


# -----------------------------------------------------------------------------
# CHECKS | One function per file
# -----------------------------------------------------------------------------

def check_project_config(report, admin_dir, code):
    """Validate ProjectAdmin__ProjectConfig__.json. Returns the config or None."""
    path = os.path.join(admin_dir, "ProjectAdmin__ProjectConfig__.json")
    config, err = read_json(path)
    if err:
        report.error("ProjectAdmin__ProjectConfig__.json: {}".format(err))
        return None

    if config.get("projectCode") != code:
        report.error("config: projectCode is '{}' but the folder says '{}'".format(
            config.get("projectCode"), code))

    if not config.get("projectName"):
        report.error("config: projectName is empty")

    pin = config.get("projectPin")
    if not pin:
        report.error("config: projectPin is missing - clients cannot log in")
    elif not str(pin).startswith("sha256:"):
        report.warn("config: projectPin is stored in plain text; hash it before going live")

    if config.get("clientDataStorage") != "cloudflare-r2-encrypted":
        report.warn("config: clientDataStorage should be 'cloudflare-r2-encrypted'")

    if not config.get("projectBriefConcise"):
        report.warn("config: projectBriefConcise is empty - the welcome letter body will be blank")

    contracts = config.get("contracts") or {}
    if not contracts:
        report.error("config: no contracts defined")
    for contract_id, block in contracts.items():
        if contract_id not in VALID_CONTRACTS:
            report.error("config: unknown contract id '{}'".format(contract_id))
        for key in ("enabled", "signed", "signatureRef", "signedDate", "specialTermsEnabled"):
            if key not in block:
                report.warn("config: contract '{}' is missing '{}'".format(contract_id, key))

    if "general-business" not in contracts:
        report.warn("config: 'general-business' is a required contract and is not enabled")

    return config


def check_quotations(report, admin_dir, code):
    """Validate ProjectAdmin__Quotations__.json."""
    path = os.path.join(admin_dir, "ProjectAdmin__Quotations__.json")
    data, err = read_json(path)
    if err:
        report.error("ProjectAdmin__Quotations__.json: {}".format(err))
        return

    quotations = data.get("quotations")
    if not isinstance(quotations, list):
        report.error("quotations: top-level 'quotations' array is missing")
        return

    if not quotations:
        report.warn("quotations: file contains no quotations")
        return

    seen_refs = set()
    for index, quote in enumerate(quotations):
        ref   = quote.get("quotationRef", "<no ref>")
        label = "quotation {}".format(ref)

        if not QUO_REF_PATTERN.match(str(ref)):
            report.error("{}: ref does not match QUO-{}-YYYY-NNN".format(label, code))
        elif not str(ref).startswith("QUO-{}-".format(code)):
            report.error("{}: ref is for a different project code".format(label))

        if ref in seen_refs:
            report.error("{}: duplicate quotation ref".format(label))
        seen_refs.add(ref)

        status = quote.get("status")
        if status not in VALID_QUOTE_STATUS:
            report.error("{}: status '{}' is not one of {}".format(
                label, status, sorted(VALID_QUOTE_STATUS)))

        if "signatureRequired" not in quote:
            report.warn("{}: no signatureRequired flag (app assumes true)".format(label))

        if not quote.get("projectDescription"):
            report.warn("{}: projectDescription is empty".format(label))

        items = quote.get("lineItems") or []
        if not items:
            report.warn("{}: no line items".format(label))

        odd_groups = set()
        arrow_items = 0
        for item_index, item in enumerate(items):
            item_label = "{} item {}".format(label, item_index + 1)
            for key in ("description", "quantity", "unit", "rate", "group"):
                if key not in item:
                    report.error("{}: missing '{}'".format(item_label, key))
            if not item.get("description"):
                report.error("{}: description is empty".format(item_label))
            group = item.get("group")
            if group and group not in CANONICAL_GROUPS:
                odd_groups.add(group)
            # House style moved from "-> " arrows to numbered sub-points on
            # 17-Aug-2026 so they verbalise correctly under read-aloud.
            if "->" in (item.get("itemDescription") or ""):
                arrow_items += 1

        if arrow_items:
            report.warn("{}: {} item(s) use '-> ' sub-points; house style is numbered "
                        "1. 2. 3. for read-aloud".format(label, arrow_items))

        # Report each non-canonical group once, not once per line item.
        for group in sorted(odd_groups):
            report.warn("{}: group '{}' is not a canonical group name".format(label, group))

        check_totals(report, label, items, quote.get("totals"))

    # Sequence continuity
    numbers = sorted(int(str(r)[-3:]) for r in seen_refs if QUO_REF_PATTERN.match(str(r)))
    if numbers and numbers != list(range(1, len(numbers) + 1)):
        report.warn("quotations: refs are not a clean 001..NNN sequence: {}".format(numbers))


def check_invoices(report, admin_dir, code):
    """Validate ProjectAdmin__Invoices__.json."""
    path = os.path.join(admin_dir, "ProjectAdmin__Invoices__.json")
    data, err = read_json(path)
    if err:
        report.error("ProjectAdmin__Invoices__.json: {}".format(err))
        return

    invoices = data.get("invoices")
    if not isinstance(invoices, list):
        report.error("invoices: top-level 'invoices' array is missing")
        return

    seen_refs = set()
    for invoice in invoices:
        ref   = invoice.get("invoiceRef", "<no ref>")
        label = "invoice {}".format(ref)

        if not INV_REF_PATTERN.match(str(ref)):
            report.error("{}: ref does not match INV-{}-YYYY-NNN".format(label, code))
        elif not str(ref).startswith("INV-{}-".format(code)):
            report.error("{}: ref is for a different project code".format(label))

        if ref in seen_refs:
            report.error("{}: duplicate invoice ref".format(label))
        seen_refs.add(ref)

        status = invoice.get("status")
        if status == "overdue":
            report.warn("{}: status 'overdue' is derived from dueDate at render time; "
                        "store 'unpaid' instead".format(label))
        elif status not in VALID_INVOICE_STATUS:
            report.error("{}: status '{}' is not one of {}".format(
                label, status, sorted(VALID_INVOICE_STATUS)))

        if status == "paid" and not invoice.get("paidDate"):
            report.error("{}: marked paid but has no paidDate".format(label))
        if status != "paid" and invoice.get("paidDate"):
            report.warn("{}: has a paidDate but status is '{}'".format(label, status))

        issued = parse_uk_date(invoice.get("invoiceDate"))
        due    = parse_uk_date(invoice.get("dueDate"))
        if issued and due:
            days = (due - issued).days
            if days != 7:
                report.warn("{}: due date is {} days after issue; house terms are 7".format(
                    label, days))
        elif invoice.get("invoiceDate") and not due:
            report.warn("{}: dueDate missing or unparseable".format(label))

        items = invoice.get("lineItems") or []
        if not items:
            report.error("{}: no line items".format(label))
        for item_index, item in enumerate(items):
            item_label = "{} item {}".format(label, item_index + 1)
            for key in ("description", "quantity", "unit", "rate"):
                if key not in item:
                    report.error("{}: missing '{}'".format(item_label, key))

        check_totals(report, label, items, invoice.get("totals"))

        if not invoice.get("personalNote"):
            report.warn("{}: personalNote is empty".format(label))

    numbers = sorted(int(str(r)[-3:]) for r in seen_refs if INV_REF_PATTERN.match(str(r)))
    if numbers and numbers != list(range(1, len(numbers) + 1)):
        report.warn("invoices: refs are not a clean 001..NNN sequence: {}".format(numbers))


def check_special_terms(report, admin_dir, config):
    """Validate the specialTermsEnabled flags against the per-contract files."""
    if not config:
        return

    contracts     = config.get("contracts") or {}
    documents     = config.get("documents") or {}
    any_enabled   = False

    for contract_id, block in contracts.items():
        enabled  = block.get("specialTermsEnabled") is True
        filename = "SpecialTerms__{}__.json".format(contract_id)
        path     = os.path.join(admin_dir, filename)
        exists   = os.path.exists(path)

        if enabled:
            any_enabled = True
            if not exists:
                report.error("{}: specialTermsEnabled is true but {} does not exist".format(
                    contract_id, filename))
                continue

        if not exists:
            continue

        data, err = read_json(path)
        if err:
            report.error("{}: {}".format(filename, err))
            continue

        if data.get("contractId") != contract_id:
            report.error("{}: contractId is '{}' but the filename says '{}'".format(
                filename, data.get("contractId"), contract_id))

        terms = data.get("terms")
        if not isinstance(terms, list):
            report.error("{}: 'terms' must be an array".format(filename))
            continue

        if enabled and not terms:
            report.error("{}: specialTermsEnabled is true but there are no terms - "
                         "the client sees an empty box".format(contract_id))

        if terms and not enabled:
            report.warn("{}: has {} term(s) but specialTermsEnabled is false - "
                        "nothing renders".format(contract_id, len(terms)))

        ids = [term.get("id") for term in terms]
        if ids and ids != list(range(1, len(ids) + 1)):
            report.warn("{}: term ids are not sequential from 1: {}".format(filename, ids))

        for term_index, term in enumerate(terms):
            if not term.get("title"):
                report.error("{}: term {} has no title".format(filename, term_index + 1))
            if not term.get("content"):
                report.error("{}: term {} has no content".format(filename, term_index + 1))

    # documents.specialTerms does not gate rendering (contracts.{id}.specialTermsEnabled
    # does) but the Project Config editor keeps it in step, so flag the drift.
    if any_enabled and documents.get("specialTerms") is not True:
        report.warn("config: special terms are enabled on a contract but "
                    "documents.specialTerms is false - housekeeping only, does not "
                    "affect what the client sees")


def check_app_data(report, project_path, code, config):
    """Validate the PlanVision and TrueVision data files."""
    project_name = (config or {}).get("projectName")

    pv_path   = os.path.join(project_path, "20__PlanVision__AppContent", "PlanVision__ProjectData__.json")
    pv, err   = read_json(pv_path)
    if err:
        report.warn("PlanVision__ProjectData__.json: {}".format(err))
    else:
        library = pv.get("na-project-data-library")
        if not library:
            report.error("PlanVision: 'na-project-data-library' root key missing")
        else:
            details = library.get("project-details") or {}
            if project_name and details.get("project-name") != project_name:
                report.warn("PlanVision: project-name '{}' does not match the config's '{}'".format(
                    details.get("project-name"), project_name))
            phases  = (library.get("project-phase-config") or {}).get("available-phases") or []
            content = (library.get("project-documentation") or {}).get("phase-content") or {}
            for phase in phases:
                if phase not in content:
                    report.error("PlanVision: phase '{}' is listed as available but has no "
                                 "phase-content entry".format(phase))
            active = (library.get("project-phase-config") or {}).get("active-design-phase")
            if active and active not in phases:
                report.error("PlanVision: active-design-phase '{}' is not in available-phases".format(
                    active))

    tv_path = os.path.join(project_path, "30__TrueVision__AppContent", "TrueVision__ProjectData__.json")
    tv, err = read_json(tv_path)
    if err:
        report.warn("TrueVision__ProjectData__.json: {}".format(err))
    else:
        if tv.get("projectCode") != code:
            report.warn("TrueVision: projectCode is '{}', expected '{}'".format(
                tv.get("projectCode"), code))
        for group in tv.get("modelGroups") or []:
            for url in group.get("modelUrls") or []:
                if code not in url:
                    report.warn("TrueVision: model URL does not contain the project code: {}".format(
                        url[:90]))
                    break


def check_registries(report, repo_root, code, year, folder):
    """Cross-check both registries."""
    keys, err = read_json(os.path.join(repo_root, KEYS_INDEX_REL))
    if err:
        report.error("ProjectKeysIndex: {}".format(err))
    else:
        entry = (keys.get(year) or {}).get(code)
        if entry is None:
            report.error("ProjectKeysIndex: {} is not registered under year {} - "
                         "the admin app cannot find it".format(code, year))
        elif entry != folder:
            report.error("ProjectKeysIndex: {} points at '{}' but the folder is '{}'".format(
                code, entry, folder))

    master, err = read_json(os.path.join(repo_root, MASTER_INDEX_REL))
    if err:
        report.warn("MasterProjectIndex: {}".format(err))
    else:
        entry = (master.get("projects") or {}).get(code)
        if entry is None:
            report.warn("MasterProjectIndex: {} is not registered - ProjectVision will not "
                        "list it".format(code))
        else:
            if entry.get("projectFolder") != folder:
                report.error("MasterProjectIndex: projectFolder is '{}' but the folder is "
                             "'{}'".format(entry.get("projectFolder"), folder))
            if entry.get("projectYear") != year:
                report.error("MasterProjectIndex: projectYear is '{}' but the project sits in "
                             "{}-Projects".format(entry.get("projectYear"), year))


def check_housekeeping(report, admin_dir, code):
    """Flag legacy files and check whether client PII has been staged."""
    for filename in LEGACY_FILES:
        if os.path.exists(os.path.join(admin_dir, filename)):
            report.info("{} is present (legacy schema, not read by the live app)".format(filename))

    pii_path = os.path.join(PII_STAGING_DIR, "{}__ClientData__Private__.json".format(code))
    if not os.path.exists(pii_path):
        report.info("no staged client PII file - fine if it is already saved to R2")
    else:
        data, err = read_json(pii_path)
        if err:
            report.warn("staged PII file: {}".format(err))
        elif not data.get("clientName"):
            report.warn("staged PII file exists but clientName is empty - the welcome letter "
                        "greeting will not render")


# -----------------------------------------------------------------------------
# DRIVER | Locate and validate projects
# -----------------------------------------------------------------------------

def find_project(repo_root, code):
    """Locate a project folder by code. Returns (year, folder, path) or None."""
    portal = os.path.join(repo_root, "na-project-portal")
    if not os.path.isdir(portal):
        return None
    for year_dir in sorted(os.listdir(portal)):
        match = re.match(r"^(\d{2})-Projects$", year_dir)
        if not match:
            continue
        year_path = os.path.join(portal, year_dir)
        if not os.path.isdir(year_path):
            continue
        for folder in sorted(os.listdir(year_path)):
            if folder.upper().startswith(code.upper()):
                return match.group(1), folder, os.path.join(year_path, folder)
    return None


def validate_project(repo_root, code):
    """Run every check for one project and return its report."""
    report = Report(code)

    located = find_project(repo_root, code)
    if not located:
        report.error("no project folder found for code {}".format(code))
        return report

    year, folder, project_path = located
    admin_dir = os.path.join(project_path, "10__ProjectAdmin__AppContent")

    report.info("{}-Projects/{}".format(year, folder))

    if not CODE_PATTERN.match(code):
        report.error("'{}' is not a valid project code format".format(code))

    if not os.path.isdir(admin_dir):
        # Legacy 2025-era projects are PlanVision-only and never had an admin folder.
        registered = (read_json(os.path.join(repo_root, MASTER_INDEX_REL))[0] or {})
        entry      = (registered.get("projects") or {}).get(code) or {}
        if entry.get("subApps", {}).get("projectAdmin") is False:
            report.info("no 10__ProjectAdmin__AppContent - PlanVision-only project, as registered")
        else:
            report.error("10__ProjectAdmin__AppContent folder is missing")
        check_app_data(report, project_path, code, None)
        return report

    config = check_project_config(report, admin_dir, code)
    check_quotations(report, admin_dir, code)
    check_invoices(report, admin_dir, code)
    check_special_terms(report, admin_dir, config)
    check_app_data(report, project_path, code, config)
    check_registries(report, repo_root, code, year, folder)
    check_housekeeping(report, admin_dir, code)

    return report


def discover_codes(repo_root):
    """Return every project code present in the portal."""
    codes  = []
    portal = os.path.join(repo_root, "na-project-portal")
    for year_dir in sorted(os.listdir(portal)):
        if not re.match(r"^\d{2}-Projects$", year_dir):
            continue
        year_path = os.path.join(portal, year_dir)
        for folder in sorted(os.listdir(year_path)):
            if os.path.isdir(os.path.join(year_path, folder)) and len(folder) >= 4:
                candidate = folder[:4].upper()
                if CODE_PATTERN.match(candidate) and candidate not in codes:
                    codes.append(candidate)
    return codes


def main():
    parser = argparse.ArgumentParser(description="Validate Noble Architecture project data.")
    parser.add_argument("code", nargs="?", help="Project code, e.g. EB03")
    parser.add_argument("--all",  action="store_true", help="Validate every project")
    parser.add_argument("--repo", default=DEFAULT_REPO_ROOT, help="Repository root")
    args = parser.parse_args()

    if not args.code and not args.all:
        parser.error("give a project code, or --all")

    if not os.path.isdir(args.repo):
        print("ERROR: repository root not found: {}".format(args.repo))
        return 1

    codes   = discover_codes(args.repo) if args.all else [args.code.upper()]
    reports = [validate_project(args.repo, code) for code in codes]

    for report in reports:
        report.render()

    total_errors   = sum(len(r.errors) for r in reports)
    total_warnings = sum(len(r.warnings) for r in reports)

    print("\n" + "=" * 70)
    print("  {} project(s) checked - {} error(s), {} warning(s)".format(
        len(reports), total_errors, total_warnings))
    print("=" * 70 + "\n")

    return 1 if total_errors else 0


if __name__ == "__main__":
    sys.exit(main())
