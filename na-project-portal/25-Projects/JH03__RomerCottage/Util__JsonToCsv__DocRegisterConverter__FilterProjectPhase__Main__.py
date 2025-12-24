#!/usr/bin/env python3
"""
JSON → CSV converter with PROJECT PHASE FILTER

Targets a JSON file located in the same (root) folder as this script and
outputs a CSV with three columns:

- Document Number
- Description
- Document Revision (formatted as Rev_A, Rev_B, etc.)

The script filters documents by PROJECT PHASE based on the `Txx` token
embedded in the document filename.

Project Phase Mapping:
T01 = Concept Phase
T02 = Planning Permission Phase
T03 = Building Regulations Phase

Default phase filter is T03.
"""

import json
import csv
from pathlib import Path


# =====================================================================
# CONFIG MACROS (EDIT HERE)
# =====================================================================

# ---- Target project phase -------------------------------------------
# Options: "T01", "T02", "T03"
TARGET_PROJECT_PHASE = "T03"

# ---- File names -----------------------------------------------------
JSON_FILENAME = "JH03_-_DATA_-_Document-Library.json"
CSV_FILENAME  = "JH03_-_Document-Register.csv"


# =====================================================================
# PHASE DEFINITIONS (LOGICAL REGION)
# =====================================================================

PROJECT_PHASES = {
    "T01": "Concept Phase",
    "T02": "Planning Permission Phase",
    "T03": "Building Regulations Phase",
}


# =====================================================================
# REVISION HANDLING (LOGICAL REGION)
# =====================================================================

def extract_latest_revision(revisions: dict) -> str:
    """
    Returns the highest non-NIL revision key found
    (e.g. 'revision-b'). If none found, returns 'NIL'.
    """
    valid_revs = [
        key for key, value in revisions.items()
        if value and value != "NIL"
    ]

    if not valid_revs:
        return "NIL"

    return sorted(valid_revs)[-1]


def format_revision(revision_key: str) -> str:
    """
    Converts 'revision-a' → 'Rev_A'
    """
    if not revision_key or revision_key == "NIL":
        return "NIL"

    letter = revision_key.split("-")[-1].upper()
    return f"Rev_{letter}"


# =====================================================================
# PHASE FILTERING (LOGICAL REGION)
# =====================================================================

def document_matches_phase(file_name: str, target_phase: str) -> bool:
    """
    Determines whether a document filename matches the target
    project phase (T01 / T02 / T03).
    """
    if not file_name:
        return False

    token = f"_{target_phase}_"
    return token in file_name


# =====================================================================
# MAIN
# =====================================================================

def main():
    if TARGET_PROJECT_PHASE not in PROJECT_PHASES:
        raise ValueError(
            f"Invalid TARGET_PROJECT_PHASE '{TARGET_PROJECT_PHASE}'. "
            f"Valid options: {list(PROJECT_PHASES.keys())}"
        )

    root_dir = Path(__file__).parent
    json_path = root_dir / JSON_FILENAME
    csv_path = root_dir / CSV_FILENAME

    if not json_path.exists():
        raise FileNotFoundError(f"JSON file not found: {json_path}")

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    drawings = (
        data
        .get("na-project-data-library", {})
        .get("project-documentation", {})
        .get("project-drawings", {})
    )

    rows = []

    for _, entry in drawings.items():
        file_name = entry.get("file-name", "")

        # Skip template entries
        if "TEMPLATE" in file_name:
            continue

        # Filter by project phase
        if not document_matches_phase(file_name, TARGET_PROJECT_PHASE):
            continue

        description = entry.get("document-name", "NIL")

        revisions = entry.get("document-revisions", {})
        latest_revision_key = extract_latest_revision(revisions)
        document_revision = format_revision(latest_revision_key)

        rows.append([
            file_name,
            description,
            document_revision
        ])

    with open(csv_path, "w", newline="", encoding="utf-8") as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow([
            "Document Number",
            "Description",
            "Document Revision"
        ])
        writer.writerows(rows)

    print(
        f"CSV written to: {csv_path}\n"
        f"Filtered Phase: {TARGET_PROJECT_PHASE} "
        f"({PROJECT_PHASES[TARGET_PROJECT_PHASE]})"
    )


if __name__ == "__main__":
    main()
