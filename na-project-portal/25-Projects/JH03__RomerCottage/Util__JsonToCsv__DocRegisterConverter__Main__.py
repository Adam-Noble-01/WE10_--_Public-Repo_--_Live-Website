#!/usr/bin/env python3
"""
JSON → CSV converter

Targets a JSON file located in the same (root) folder as this script and
outputs a CSV with three columns:

- File Name
- Description
- Document Revision (formatted as Rev_A, Rev_B, etc.)

Designed specifically for the JH03_-_DATA_-_Document-Library.json structure.
"""

import json
import csv
from pathlib import Path


# ---------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------

JSON_FILENAME = "JH03_-_DATA_-_Document-Library.json"
CSV_FILENAME  = "JH03_-_Document-Register.csv"


# ---------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------

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


# ---------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------

def main():
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

        # Skip template entry
        if "TEMPLATE" in file_name:
            continue

        document_number = file_name or "NIL"
        description = entry.get("document-name", "NIL")

        revisions = entry.get("document-revisions", {})
        latest_revision_key = extract_latest_revision(revisions)
        document_revision = format_revision(latest_revision_key)

        rows.append([
            document_number,
            description,
            document_revision
        ])

    with open(csv_path, "w", newline="", encoding="utf-8") as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow([
            "Document File Name",
            "Document Description",
            "Document Revision"
        ])
        writer.writerows(rows)

    print(f"CSV written to: {csv_path}")


if __name__ == "__main__":
    main()

