#!/usr/bin/env python3
# =============================================================================
# VALEVISION 3D - VEGETATION - BUILD UTIL FOR THE ASSET LIBRARY
# =============================================================================
#
# FILE       : Na__Vegetation__BuildUtil__Library__.py
# NAMESPACE  : Na__VegLibTool
# MODULE     : System - Vegetation
# AUTHOR     : Adam Noble - Noble Architecture
# PURPOSE    : Keep the library in order: check every asset against the register
#              and the schema, write the index the app reads, give the next free Id
# CREATED    : 04-Nov-2026
#
# DESCRIPTION:
# - USE:
#     python Na__Vegetation__BuildUtil__Library__.py validate
#         every asset against the schema and the register; exit 1 on any error
#     python Na__Vegetation__BuildUtil__Library__.py index [--check]
#         write VegetationLibrary__Index__.json (--check: write nothing, exit 1
#         when the index on disk is not the index it would write)
#     python Na__Vegetation__BuildUtil__Library__.py next 07 Shrubs [--family 100]
#         the next free Id: a new family in the type's block, or the next item in one
# - PAINTERLYNPR'S TOOL, CUT DOWN (PainterlyNPR__BuildUtil__AssetLibrary__.py). An
#   asset here is one file and not five, so there are no slots and no factory.
# - NOTHING LISTS A DIRECTORY on the server: an asset not in the index does not
#   exist as far as the app knows. The index is deterministic, Id order and no times
#   of its own, so it only changes when the library does.
# - STANDARD LIBRARY ONLY, as NPR's. `.py` never pushes to the server.
#
# -----------------------------------------------------------------------------
#
# DEVELOPMENT LOG:
# 04-Nov-2026 - Version 1.0.0 (ValeVision3D v2.83.0)
# - Initial build.
#
# =============================================================================

import argparse
import json
import os
import re
import sys


# -----------------------------------------------------------------------------
# REGION | Module Constants
# -----------------------------------------------------------------------------

NA__VEGLIB__ROOT     = os.path.dirname(os.path.abspath(__file__))
NA__VEGLIB__REGISTER = "VegetationLibrary__Register__.json"
NA__VEGLIB__INDEX    = "VegetationLibrary__Index__.json"
NA__VEGLIB__SCHEMA   = "VegetationLibrary__Schema__AssetData__1.0.0__.json"
NA__VEGLIB__CONFIG   = os.path.join(os.path.dirname(NA__VEGLIB__ROOT), "02__Src__AppModules", "24__System__Vegetation", "Na__Vegetation__AppConfig__.json")
NA__VEGLIB__FILE     = re.compile(r"^(VVL_\d{2}_\d{4})__(.+)__\.json$")

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | Reading
# -----------------------------------------------------------------------------

def Na__VegLibTool__Load(rel):
    """A JSON document in the library, by its path from the library's root."""
    with open(os.path.join(NA__VEGLIB__ROOT, rel), encoding="utf-8") as handle:
        return json.load(handle)


def Na__VegLibTool__Collections():
    """The register's collections, by their code."""
    rows = Na__VegLibTool__Load(NA__VEGLIB__REGISTER)["VegetationLibrary__Register__Collections"]
    return {row["Collection__Code"]: row for row in rows}


def Na__VegLibTool__AssetFiles():
    """Every asset file on disk: (path from the root, parsed or the error), in path order."""
    found = []
    for code, collection in sorted(Na__VegLibTool__Collections().items()):
        folder = collection["Collection__Folder"]
        base = os.path.join(NA__VEGLIB__ROOT, folder)
        if not os.path.isdir(base):
            continue
        for name in sorted(os.listdir(base)):
            if not NA__VEGLIB__FILE.match(name):
                continue
            rel = folder + "/" + name
            try:
                found.append((rel, Na__VegLibTool__Load(rel)))
            except (OSError, ValueError) as error:
                found.append((rel, error))
    return found

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | A Small JSON Schema Checker
# -----------------------------------------------------------------------------

def Na__VegLibTool__Check(value, schema, path, errors):
    """Check value against the subset of draft 2020-12 the contract uses: type, enum,
    pattern, the number and length bounds, required, properties and
    additionalProperties false, items. Errors are appended as text. As NPR's."""
    kinds = schema.get("type")
    if kinds is not None:
        kinds = [kinds] if isinstance(kinds, str) else kinds
        tests = {
            "object": lambda v: isinstance(v, dict),
            "array": lambda v: isinstance(v, list),
            "string": lambda v: isinstance(v, str),
            "integer": lambda v: isinstance(v, int) and not isinstance(v, bool),
            "number": lambda v: isinstance(v, (int, float)) and not isinstance(v, bool),
            "boolean": lambda v: isinstance(v, bool),
            "null": lambda v: v is None,
        }
        if not any(tests[kind](value) for kind in kinds):
            errors.append("%s: is %s, should be %s" % (path, type(value).__name__, " or ".join(kinds)))
            return
    if "enum" in schema and value not in schema["enum"]:
        errors.append("%s: %r is not one of %s" % (path, value, ", ".join(map(str, schema["enum"]))))
    if isinstance(value, str):
        if "pattern" in schema and not re.search(schema["pattern"], value):
            errors.append("%s: %r does not match %s" % (path, value, schema["pattern"]))
        if len(value) < schema.get("minLength", 0):
            errors.append("%s: is empty" % path)
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]:
            errors.append("%s: %s is under %s" % (path, value, schema["minimum"]))
        if "maximum" in schema and value > schema["maximum"]:
            errors.append("%s: %s is over %s" % (path, value, schema["maximum"]))
        if "exclusiveMinimum" in schema and value <= schema["exclusiveMinimum"]:
            errors.append("%s: %s must be over %s" % (path, value, schema["exclusiveMinimum"]))
    if isinstance(value, dict):
        for key in schema.get("required", []):
            if key not in value:
                errors.append("%s: has no %s" % (path, key))
        props = schema.get("properties", {})
        for key, item in value.items():
            if key in props:
                Na__VegLibTool__Check(item, props[key], path + "." + key, errors)
            elif schema.get("additionalProperties") is False:
                errors.append("%s: %s is not a key it may have" % (path, key))
    if isinstance(value, list) and "items" in schema:
        for i, item in enumerate(value):
            Na__VegLibTool__Check(item, schema["items"], "%s[%d]" % (path, i), errors)

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | Validate
# -----------------------------------------------------------------------------

def Na__VegLibTool__Generators():
    """The generators the app knows: {name: [versions]}. None if the config is not there yet."""
    if not os.path.isfile(NA__VEGLIB__CONFIG):
        return None
    with open(NA__VEGLIB__CONFIG, encoding="utf-8") as handle:
        rows = json.load(handle)["Vegetation__Generators__Config"]["Vegetation__Generators__List"]
    return {row["Generator__Name"]: row["Generator__Versions"] for row in rows}


def Na__VegLibTool__Validate():
    """Every rule, every asset: (errors, warnings, count)."""
    errors, warnings = [], []
    register = Na__VegLibTool__Load(NA__VEGLIB__REGISTER)
    numbering = register["VegetationLibrary__Register__Numbering"]
    naming = register["VegetationLibrary__Register__Naming"]
    collections = Na__VegLibTool__Collections()
    schema = Na__VegLibTool__Load(NA__VEGLIB__SCHEMA)
    generators = Na__VegLibTool__Generators()
    id_pattern = re.compile(numbering["Numbering__IdPattern"])
    retired = set(numbering["Numbering__RetiredIds"])
    seen = {}

    for code, collection in collections.items():
        if collection["Collection__Folder"] != "%s__%s" % (code, collection["Collection__Name"]):
            errors.append("Register: collection %s's folder should be %s__%s" % (code, code, collection["Collection__Name"]))
        blocks = [row["Type__Block"] for row in collection["Collection__Types"]]
        if len(set(blocks)) != len(blocks):
            errors.append("Register: collection %s gives two types one block" % code)

    files = Na__VegLibTool__AssetFiles()
    for rel, asset in files:
        where = rel.split("/")[-1]
        if isinstance(asset, Exception):
            errors.append("%s: does not parse - %s" % (where, asset))
            continue
        before = len(errors)
        Na__VegLibTool__Check(asset, schema, where, errors)
        if len(errors) > before:
            continue

        identity = asset["Asset__Identity"]
        asset_id = asset["Asset__Id"]
        if asset_id in seen:
            errors.append("%s: %s is also %s's Id" % (where, asset_id, seen[asset_id]))
        seen[asset_id] = where
        if not id_pattern.match(asset_id):
            errors.append("%s: %s breaks the Id pattern (an Id ending in 0 is a family's base)" % (where, asset_id))
        if asset_id in retired and asset["Asset__Meta"]["Meta__Status"] != "Retired":
            errors.append("%s: %s is a retired Id, and a retired Id is never reused" % (where, asset_id))

        code, number = asset_id[4:6], asset_id[7:]
        collection = collections.get(code)
        if not collection:
            errors.append("%s: collection %s is not in the register" % (where, code))
            continue
        if identity["Identity__CollectionCode"] != code:
            errors.append("%s: Identity__CollectionCode should be %s" % (where, code))
        block = next((row["Type__Block"] for row in collection["Collection__Types"] if row["Type__Name"] == identity["Identity__Type"]), None)
        if block is None:
            errors.append("%s: %s has no type %s in the register" % (where, collection["Collection__Name"], identity["Identity__Type"]))
        elif number[:2] != block:
            errors.append("%s: a %s Id is %s_%sxx" % (where, identity["Identity__Type"], code, block))
        if identity["Identity__Family"] != number[:3] or identity["Identity__Item"] != int(number[3]):
            errors.append("%s: Family and Item should be %s and %s" % (where, number[:3], number[3]))

        expected = naming["Naming__AssetFile"].format(AssetId=asset_id, Type=identity["Identity__Type"], Name=identity["Identity__Name"], Variant=identity["Identity__Variant"])
        if where != expected:
            errors.append("%s: should be named %s" % (where, expected))
        if rel != "%s/%s" % (collection["Collection__Folder"], where):
            errors.append("%s: is not in its collection's folder" % where)
        if len(rel) > naming["Naming__MaxRelativePath"]:
            errors.append("%s: is %d characters from the library, over %d" % (where, len(rel), naming["Naming__MaxRelativePath"]))

        # THE GENERATOR | The app leaves out a plant whose generator it does not have
        generator = asset["Asset__Generator"]
        if generators is None:
            warnings.append("%s: Na__Vegetation__AppConfig__.json is not there, so the generator was not checked" % where)
        elif generator["Generator__Version"] not in generators.get(generator["Generator__Name"], []):
            errors.append("%s: the app has no generator %s version %s" % (where, generator["Generator__Name"], generator["Generator__Version"]))

        # RANGES | A minimum over its maximum draws nonsense without any error
        pairs = [
            ("Asset__Masses", "Masses__CountMin", "Masses__CountMax"),
            ("Asset__Masses", "Masses__ScallopChordMinMm", "Masses__ScallopChordMaxMm"),
            ("Asset__Clumps", "Clumps__RadiusMinMm", "Clumps__RadiusMaxMm"),
            ("Asset__Clumps", "Clumps__ReachMin", "Clumps__ReachMax"),
            ("Asset__Nubs", "Nubs__RadiusMinMm", "Nubs__RadiusMaxMm"),
            ("Asset__Line", "Line__TailMinRad", "Line__TailMaxRad"),
            ("Asset__Line", "Line__CuspHookMinMm", "Line__CuspHookMaxMm"),
            ("Asset__Tufts", "Tufts__CountMin", "Tufts__CountMax"),
            ("Asset__Tufts", "Tufts__HeightMinMm", "Tufts__HeightMaxMm"),
            ("Asset__Tufts", "Tufts__BladesMin", "Tufts__BladesMax"),
        ]
        for section, low, high in pairs:
            if asset[section][low] > asset[section][high]:
                errors.append("%s: %s is over %s" % (where, low, high))

    # THE INDEX | Stale is a warning: `index` puts it right
    if os.path.isfile(os.path.join(NA__VEGLIB__ROOT, NA__VEGLIB__INDEX)):
        with open(os.path.join(NA__VEGLIB__ROOT, NA__VEGLIB__INDEX), encoding="utf-8") as handle:
            if handle.read() != Na__VegLibTool__IndexText():
                warnings.append("%s: is out of date: run index" % NA__VEGLIB__INDEX)
    else:
        warnings.append("%s: is not there: run index" % NA__VEGLIB__INDEX)
    return errors, warnings, len(files)

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | The Index
# -----------------------------------------------------------------------------

def Na__VegLibTool__IndexText():
    """The index as it should be on disk. What a card and a search need, and the file for the rest."""
    collections = Na__VegLibTool__Collections()
    rows = []
    files = [(rel, asset) for rel, asset in Na__VegLibTool__AssetFiles() if not isinstance(asset, Exception)]
    for rel, asset in sorted(files, key=lambda pair: pair[1]["Asset__Id"]):
        identity = asset["Asset__Identity"]
        size = asset["Asset__Size"]
        collection = collections.get(identity["Identity__CollectionCode"], {})
        label = next((row["Type__Label"] for row in collection.get("Collection__Types", []) if row["Type__Name"] == identity["Identity__Type"]), identity["Identity__Type"])
        rows.append({
            "Asset__Id": asset["Asset__Id"],
            "Asset__Name": asset["Asset__Name"],
            "Asset__File": rel,
            "Asset__CollectionLabel": collection.get("Collection__Label", ""),
            "Asset__TypeLabel": label,
            "Asset__Status": asset["Asset__Meta"]["Meta__Status"],
            "Asset__Version": asset["Asset__Meta"]["Meta__Version"],
            "Asset__WidthMm": size["Size__WidthMm"],
            "Asset__HeightMm": size["Size__HeightMm"],
            "Asset__Keywords": asset["Asset__Catalogue"]["Catalogue__Keywords"],
        })
    document = {
        "VegetationLibrary__Index__Meta": {
            "Meta__Description": "Generated by Na__Vegetation__BuildUtil__Library__.py index: never edit by hand. Nothing lists a directory on the server, so an asset not listed here does not exist as far as the app knows."
        },
        "VegetationLibrary__Index__Assets": rows,
    }
    return json.dumps(document, indent=4, ensure_ascii=False) + "\n"


def Na__VegLibTool__WriteIndex(check):
    """Write the index, or with check only say whether the one on disk is current."""
    path = os.path.join(NA__VEGLIB__ROOT, NA__VEGLIB__INDEX)
    text = Na__VegLibTool__IndexText()
    current = None
    if os.path.isfile(path):
        with open(path, encoding="utf-8") as handle:
            current = handle.read()
    if check:
        print("%s: %s" % (NA__VEGLIB__INDEX, "current" if current == text else "OUT OF DATE"))
        return 0 if current == text else 1
    if current != text:
        with open(path, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(text)
    print("%s: %d assets" % (NA__VEGLIB__INDEX, len(json.loads(text)["VegetationLibrary__Index__Assets"])))
    return 0

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | The Next Free Id
# -----------------------------------------------------------------------------

def Na__VegLibTool__Next(code, type_name, family):
    """The next free Id: an item in a family if named, else the first of the next free family."""
    register = Na__VegLibTool__Load(NA__VEGLIB__REGISTER)
    collection = Na__VegLibTool__Collections().get(code)
    if not collection:
        raise SystemExit("Collection %s is not in the register." % code)
    block = next((row["Type__Block"] for row in collection["Collection__Types"] if row["Type__Name"] == type_name), None)
    if block is None:
        raise SystemExit("%s has no type %s. It has: %s" % (collection["Collection__Name"], type_name, ", ".join(row["Type__Name"] for row in collection["Collection__Types"])))

    prefix = "VVL_%s_" % code
    taken = {asset["Asset__Id"][len(prefix):] for _, asset in Na__VegLibTool__AssetFiles() if not isinstance(asset, Exception) and asset["Asset__Id"].startswith(prefix)}
    taken |= {retired[len(prefix):] for retired in register["VegetationLibrary__Register__Numbering"]["Numbering__RetiredIds"] if retired.startswith(prefix)}

    if family:
        if not (len(family) == 3 and family.isdigit() and family[:2] == block):
            raise SystemExit("Family %s is not in the %s block (%sx)." % (family, type_name, block))
        for item in range(1, 10):
            number = "%s%d" % (family, item)
            if number not in taken:
                return prefix + number
        raise SystemExit("Family %s is full." % family)

    for f in range(10):
        candidate = "%s%d" % (block, f)
        if not any(number.startswith(candidate) for number in taken):
            return "%s%s1" % (prefix, candidate)
    raise SystemExit("The %s block is full: give the type another block in the register." % type_name)

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | Main
# -----------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Keep the vegetation asset library in order.")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("validate", help="every asset against the schema and the register")
    index = commands.add_parser("index", help="write the index the app reads")
    index.add_argument("--check", action="store_true", help="write nothing; exit 1 when it is out of date")
    next_id = commands.add_parser("next", help="the next free Id")
    next_id.add_argument("collection")
    next_id.add_argument("type")
    next_id.add_argument("--family", default="")
    args = parser.parse_args()

    if args.command == "validate":
        errors, warnings, count = Na__VegLibTool__Validate()
        for line in errors:
            print("ERROR   " + line)
        for line in warnings:
            print("WARNING " + line)
        print("%d asset(s): %d error(s), %d warning(s)." % (count, len(errors), len(warnings)))
        return 1 if errors else 0
    if args.command == "index":
        return Na__VegLibTool__WriteIndex(args.check)
    print(Na__VegLibTool__Next(args.collection, args.type, args.family))
    return 0


if __name__ == "__main__":
    sys.exit(main())

# endregion -------------------------------------------------------------------
