#!/usr/bin/env python3
# =============================================================================
# VALEVISION 3D - ENTOURAGE - BUILD UTIL FOR THE ASSET LIBRARY
# =============================================================================
#
# FILE       : Na__Entourage__BuildUtil__Library__.py
# NAMESPACE  : Na__EntLibTool
# MODULE     : System - Entourage
# AUTHOR     : Adam Noble - Noble Architecture
# PURPOSE    : Keep the library in order: turn what SketchUp read from a component
#              into an asset, check every asset, write the index the app reads,
#              give the next free Id
# CREATED    : 05-Nov-2026
#
# DESCRIPTION:
# - USE:
#     python Na__Entourage__BuildUtil__Library__.py convert <read.json> [--force]
#         turn a SketchUp read (Na__ValeVisionMcp__EntourageSkpReader__.rb, or the
#         vv3d_entourage_import_skp tool) into asset files; a file already there is
#         left alone unless --force
#     python Na__Entourage__BuildUtil__Library__.py validate
#         every asset against the schema and the register; exit 1 on any error
#     python Na__Entourage__BuildUtil__Library__.py index [--check]
#         write EntourageLibrary__Index__.json (--check: write nothing, exit 1 when
#         the index on disk is not the index it would write)
#     python Na__Entourage__BuildUtil__Library__.py next People [--family 032]
#         the next free Id: a new family in the type's block, or the next item in one
# - THE VEGETATION LIBRARY'S TOOL (Na__Vegetation__BuildUtil__Library__.py), with convert
#   added. The core component library stays the master of a figure's drawing.
# - NOTHING LISTS A DIRECTORY on the server: an asset not in the index does not
#   exist as far as the app knows. The index is deterministic, Id order and no times
#   of its own, so it only changes when the library does.
# - STANDARD LIBRARY ONLY. `.py` never pushes to the server.
#
# FRAMES:
# - A SketchUp read is millimetres in the component's own axes, x across, y 0, z up, the
#   front on -y. An asset is millimetres in the figure's own plane, x across, y up, feet at 0.
#   A figure is flat, so no other axis is written, and the app turns it to the camera.
#
# -----------------------------------------------------------------------------
#
# DEVELOPMENT LOG:
# 05-Nov-2026 - Version 1.0.0 (ValeVision3D v2.88.0)
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

NA__ENTLIB__ROOT     = os.path.dirname(os.path.abspath(__file__))
NA__ENTLIB__REGISTER = "EntourageLibrary__Register__.json"
NA__ENTLIB__INDEX    = "EntourageLibrary__Index__.json"
NA__ENTLIB__SCHEMA   = "EntourageLibrary__Schema__AssetData__1.0.0__.json"
NA__ENTLIB__CONFIG   = os.path.join(os.path.dirname(NA__ENTLIB__ROOT), "02__Src__AppModules", "28__System__Entourage", "Na__Entourage__AppConfig__.json")
NA__ENTLIB__FILE     = re.compile(r"^(VVL_\d{2}_\d{4})__(.+)__\.json$")
NA__ENTLIB__AUTHOR   = "Adam Noble - Noble Architecture"
NA__ENTLIB__CREATED  = "05-Nov-2026"

# THE KNOWN FIGURES | What a person calls each one, looked at on a contact sheet. A new
# component not listed here takes its name from its file: rename it in the asset.
NA__ENTLIB__NAMES = {
    "60_0301": ("Man Walking",                   ["walking", "casual"]),
    "60_0302": ("Man Standing, Feet Apart",      ["standing", "jacket"]),
    "60_0303": ("Man in a Jacket, Stepping",     ["walking", "jacket"]),
    "60_0304": ("Man Leaning, Arms Folded",      ["standing", "leaning", "arms folded"]),
    "60_0305": ("Man Holding a Folder",          ["standing", "folder", "carrying"]),
    "60_0306": ("Man Standing, Looking Aside",   ["standing", "jacket"]),
    "60_0321": ("Woman in Cropped Trousers",     ["standing", "long hair"]),
    "60_0322": ("Woman in a Skirt, Stepping",    ["walking", "skirt"]),
    "60_0323": ("Woman in a Long Coat",          ["walking", "coat", "long hair"]),
    "60_0324": ("Woman Carrying a Bag",          ["standing", "carrying", "long hair"]),
    "60_0325": ("Woman Side On, Arms Folded",    ["standing", "side on", "arms folded"]),
    "60_0326": ("Woman in a Skirt, Arms Folded", ["standing", "skirt", "arms folded"]),
    "60_0500": ("Labrador, Sitting",             ["dog", "labrador", "sitting", "pet"]),
}

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | Reading
# -----------------------------------------------------------------------------

def Na__EntLibTool__Load(rel):
    """A JSON document in the library, by its path from the library's root."""
    with open(os.path.join(NA__ENTLIB__ROOT, rel), encoding="utf-8") as handle:
        return json.load(handle)


def Na__EntLibTool__Collections():
    """The register's collections, by their code."""
    rows = Na__EntLibTool__Load(NA__ENTLIB__REGISTER)["EntourageLibrary__Register__Collections"]
    return {row["Collection__Code"]: row for row in rows}


def Na__EntLibTool__AssetFiles():
    """Every asset file on disk: (path from the root, parsed or the error), in path order."""
    found = []
    for code, collection in sorted(Na__EntLibTool__Collections().items()):
        folder = collection["Collection__Folder"]
        base = os.path.join(NA__ENTLIB__ROOT, folder)
        if not os.path.isdir(base):
            continue
        for name in sorted(os.listdir(base)):
            if not NA__ENTLIB__FILE.match(name):
                continue
            rel = folder + "/" + name
            try:
                found.append((rel, Na__EntLibTool__Load(rel)))
            except (OSError, ValueError) as error:
                found.append((rel, error))
    return found

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | Converting What SketchUp Read
# -----------------------------------------------------------------------------

def Na__EntLibTool__Points(points):
    """Points as the one string an asset holds: x,y pairs to a tenth of a millimetre."""
    def tidy(value):
        text = ("%.1f" % value)
        return text[:-2] if text.endswith(".0") else text
    return " ".join("%s,%s" % (tidy(x), tidy(y)) for x, y in points)


def Na__EntLibTool__Chains(segments):
    """Join loose segments into as few polylines as they make: a chain ends where lines fork or stop."""
    links = {}
    for a, b in segments:
        links.setdefault(a, []).append(b)
        links.setdefault(b, []).append(a)
    used = set()

    def walk(start, nxt):
        chain = [start, nxt]
        used.add(frozenset((start, nxt)))
        while len(links[chain[-1]]) == 2:
            here = chain[-1]
            onward = [p for p in links[here] if frozenset((here, p)) not in used]
            if not onward:
                break
            used.add(frozenset((here, onward[0])))
            chain.append(onward[0])
        return chain

    chains = []
    # FROM EVERY FORK OR LOOSE END FIRST, then what is left is closed loops
    for point in sorted(links):
        if len(links[point]) != 2:
            for other in links[point]:
                if frozenset((point, other)) not in used:
                    chains.append(walk(point, other))
    for point in sorted(links):
        for other in links[point]:
            if frozenset((point, other)) not in used:
                chains.append(walk(point, other))
    return chains


def Na__EntLibTool__Identity(stem):
    """What a component's file name says: (source number, type, name segment, variant, height note)."""
    match = re.match(r"^(\d{2}_\d{4})__SceneEntourage__(.+)__Var-(\d{2})__$", stem)
    if not match:
        raise SystemExit("%s: is not named as a scene entourage component (60_0301__SceneEntourage__...__Var-01__)" % stem)
    number, words, variant = match.groups()
    segments = words.split("__")
    is_person = segments[0] == "SilhouettePerson"
    name = segments[1] if is_person else (segments[1] if len(segments) > 1 else segments[0])
    return number, ("People" if is_person else "Animals"), name, "Var-" + variant


def Na__EntLibTool__AssetIdFor(number):
    """The library's Id for a component's number. An Id ending in 0 is never an asset: see the register."""
    code, rest = number.split("_")
    return "VVL_%s_%s" % (code, rest[:3] + "1" if rest.endswith("0") else rest)


def Na__EntLibTool__Convert(path, force):
    """Turn a SketchUp read into asset files. Returns the count written."""
    with open(path, encoding="utf-8") as handle:
        rows = json.load(handle)
    written = 0
    for row in rows:
        stem = row["file"][:-4] if row["file"].lower().endswith(".skp") else row["file"]
        number, type_name, name_segment, variant = Na__EntLibTool__Identity(stem)
        asset_id = Na__EntLibTool__AssetIdFor(number)
        code, digits = asset_id[4:6], asset_id[7:]

        faces = row["faces"]
        points = [p for face in faces for loop in face["loops"] for p in loop["pts"]]
        points += [p for edge in row["loose_edges"] for p in edge]
        if not points:
            raise SystemExit("%s: holds no geometry" % row["file"])
        if any(abs(p[1]) > 0.05 for p in points):
            raise SystemExit("%s: is not flat in its own x z plane" % row["file"])
        floor = min(p[2] for p in points)
        flat = lambda p: (round(p[0], 1), round(p[2] - floor, 1))              # <-- Feet at height 0: a figure stands on the surface it is dropped on

        figure = {}
        if len(faces) == 1 and not row["loose_edges"] and len(faces[0]["loops"]) == 1:
            figure["Figure__Kind"] = "Silhouette"
            loop = []
            for p in faces[0]["loops"][0]["pts"]:
                q = flat(p)
                if not loop or q != loop[-1]:
                    loop.append(q)
            if loop[0] == loop[-1]:
                loop.pop()
            figure["Figure__OutlineMm"] = Na__EntLibTool__Points(loop)
        else:
            figure["Figure__Kind"] = "LineDrawing"
            uses = {}
            face_rows = []
            for face in faces:
                outer, holes = None, []
                for loop in face["loops"]:
                    pts = [flat(p) for p in loop["pts"]]
                    for a, b in zip(pts, pts[1:] + pts[:1]):
                        if a != b:
                            key = frozenset((a, b))
                            uses[key] = uses.get(key, 0) + 1
                    if loop["outer"]:
                        outer = pts
                    else:
                        holes.append(Na__EntLibTool__Points(pts))
                face_rows.append({"Face__OuterMm": Na__EntLibTool__Points(outer), "Face__HolesMm": holes})
            outer_lines, inner_lines = [], []
            for key, count in uses.items():
                a, b = sorted(key)
                (outer_lines if count == 1 else inner_lines).append((a, b))
            for a, b in row["loose_edges"]:
                p, q = flat(a), flat(b)
                if p != q:
                    inner_lines.append((p, q))
            figure["Figure__FacesMm"] = face_rows
            figure["Figure__OuterChainsMm"] = [Na__EntLibTool__Points(chain) for chain in Na__EntLibTool__Chains(outer_lines)]
            figure["Figure__InnerChainsMm"] = [Na__EntLibTool__Points(chain) for chain in Na__EntLibTool__Chains(inner_lines)]

        xs = [p[0] for p in points]
        zs = [p[2] for p in points]
        width_mm, height_mm = int(round(max(xs) - min(xs))), int(round(max(zs) - min(zs)))
        words, keywords = NA__ENTLIB__NAMES.get(number, (" ".join(name_segment.split("-")), []))
        kind_words = ({"Man": ["person", "man"], "Woman": ["person", "woman"]}.get(name_segment, ["person"]) if type_name == "People" else ["animal"])
        metres = "%.2f m tall" % (height_mm / 1000.0)
        noun = {"Man": "a man", "Woman": "a woman", "Labrador": "a labrador, sitting"}.get(name_segment, words.lower())
        drawn = "Flat silhouette" if figure["Figure__Kind"] == "Silhouette" else "Line drawing"
        file_name = re.sub(r"[^A-Za-z0-9-]", "", name_segment)

        asset = {
            "Asset__Id": asset_id,
            "Asset__Name": words,
            "Asset__Description": "%s of %s, %s and %d mm wide. Always turns to face the camera, as it does in SketchUp." % (drawn, noun, metres, width_mm),
            "Asset__Meta": {"Meta__Version": "1.0.0", "Meta__Created": NA__ENTLIB__CREATED, "Meta__Author": NA__ENTLIB__AUTHOR, "Meta__Status": "Active"},
            "Asset__Identity": {
                "Identity__CollectionCode": code,
                "Identity__Type": type_name,
                "Identity__Family": digits[:3],
                "Identity__Item": int(digits[3]),
                "Identity__Name": file_name,
                "Identity__Variant": variant,
            },
            "Asset__Source": {
                "Source__SketchUpFile": row["file"],
                "Source__Note": "Converted from the core component library, which stays the master of this drawing. Its grey material is left behind: the app fills a figure with the walls' own brightness.",
            },
            "Asset__Generator": {"Generator__Name": "FlatFigure", "Generator__Version": 1},
            "Asset__Catalogue": {"Catalogue__Keywords": kind_words + keywords},
            "Asset__Size": {"Size__WidthMm": width_mm, "Size__HeightMm": height_mm},
            "Asset__Figure": figure,
        }

        folder = Na__EntLibTool__Collections()[code]["Collection__Folder"]
        target = os.path.join(NA__ENTLIB__ROOT, folder, "%s__%s__%s__%s__.json" % (asset_id, type_name, file_name, variant))
        if os.path.isfile(target) and not force:
            print("kept     %s (already there; --force replaces it)" % os.path.basename(target))
            continue
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(json.dumps(asset, indent=4, ensure_ascii=False) + "\n")
        print("written  %s  %s x %s mm  %s" % (os.path.basename(target), width_mm, height_mm, figure["Figure__Kind"]))
        written += 1
    return written

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | A Small JSON Schema Checker
# -----------------------------------------------------------------------------

def Na__EntLibTool__Check(value, schema, path, errors):
    """Check value against the subset of draft 2020-12 the contract uses, as the vegetation library's tool does."""
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
                Na__EntLibTool__Check(item, props[key], path + "." + key, errors)
            elif schema.get("additionalProperties") is False:
                errors.append("%s: %s is not a key it may have" % (path, key))
    if isinstance(value, list) and "items" in schema:
        for i, item in enumerate(value):
            Na__EntLibTool__Check(item, schema["items"], "%s[%d]" % (path, i), errors)

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | Validate
# -----------------------------------------------------------------------------

def Na__EntLibTool__Generators():
    """The generators the app knows: {name: [versions]}. None if the config is not there yet."""
    if not os.path.isfile(NA__ENTLIB__CONFIG):
        return None
    with open(NA__ENTLIB__CONFIG, encoding="utf-8") as handle:
        rows = json.load(handle)["Entourage__Generators__Config"]["Entourage__Generators__List"]
    return {row["Generator__Name"]: row["Generator__Versions"] for row in rows}


def Na__EntLibTool__PointsOk(text):
    """Is this string pairs of numbers, at least three of them?"""
    pairs = text.split(" ")
    if len(pairs) < 2:
        return False
    try:
        for pair in pairs:
            x, y = pair.split(",")
            float(x), float(y)
    except ValueError:
        return False
    return True


def Na__EntLibTool__Validate():
    """Every rule, every asset: (errors, warnings, count)."""
    errors, warnings = [], []
    register = Na__EntLibTool__Load(NA__ENTLIB__REGISTER)
    numbering = register["EntourageLibrary__Register__Numbering"]
    naming = register["EntourageLibrary__Register__Naming"]
    collections = Na__EntLibTool__Collections()
    schema = Na__EntLibTool__Load(NA__ENTLIB__SCHEMA)
    generators = Na__EntLibTool__Generators()
    id_pattern = re.compile(numbering["Numbering__IdPattern"])
    retired = set(numbering["Numbering__RetiredIds"])
    seen = {}

    for code, collection in collections.items():
        if collection["Collection__Folder"] != "%s__%s" % (code, collection["Collection__Name"]):
            errors.append("Register: collection %s's folder should be %s__%s" % (code, code, collection["Collection__Name"]))
        blocks = [row["Type__Block"] for row in collection["Collection__Types"]]
        if len(set(blocks)) != len(blocks):
            errors.append("Register: collection %s gives two types one block" % code)

    files = Na__EntLibTool__AssetFiles()
    for rel, asset in files:
        where = rel.split("/")[-1]
        if isinstance(asset, Exception):
            errors.append("%s: does not parse - %s" % (where, asset))
            continue
        before = len(errors)
        Na__EntLibTool__Check(asset, schema, where, errors)
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

        # THE GENERATOR | The app leaves out a figure whose generator it does not have
        generator = asset["Asset__Generator"]
        if generators is None:
            warnings.append("%s: Na__Entourage__AppConfig__.json is not there, so the generator was not checked" % where)
        elif generator["Generator__Version"] not in generators.get(generator["Generator__Name"], []):
            errors.append("%s: the app has no generator %s version %s" % (where, generator["Generator__Name"], generator["Generator__Version"]))

        # THE FIGURE | Each kind holds what it draws from, and every string really is points
        figure = asset["Asset__Figure"]
        if figure["Figure__Kind"] == "Silhouette":
            if not Na__EntLibTool__PointsOk(figure.get("Figure__OutlineMm", "")):
                errors.append("%s: a Silhouette needs a Figure__OutlineMm of x,y pairs" % where)
        else:
            if not figure.get("Figure__FacesMm") or not figure.get("Figure__OuterChainsMm"):
                errors.append("%s: a LineDrawing needs Figure__FacesMm and Figure__OuterChainsMm" % where)
            texts = [face["Face__OuterMm"] for face in figure.get("Figure__FacesMm", [])]
            texts += [hole for face in figure.get("Figure__FacesMm", []) for hole in face["Face__HolesMm"]]
            texts += figure.get("Figure__OuterChainsMm", []) + figure.get("Figure__InnerChainsMm", [])
            if not all(Na__EntLibTool__PointsOk(text) for text in texts):
                errors.append("%s: holds a string that is not x,y pairs" % where)

    # THE INDEX | Stale is a warning: `index` puts it right
    if os.path.isfile(os.path.join(NA__ENTLIB__ROOT, NA__ENTLIB__INDEX)):
        with open(os.path.join(NA__ENTLIB__ROOT, NA__ENTLIB__INDEX), encoding="utf-8") as handle:
            if handle.read() != Na__EntLibTool__IndexText():
                warnings.append("%s: is out of date: run index" % NA__ENTLIB__INDEX)
    else:
        warnings.append("%s: is not there: run index" % NA__ENTLIB__INDEX)
    return errors, warnings, len(files)

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | The Index
# -----------------------------------------------------------------------------

def Na__EntLibTool__IndexText():
    """The index as it should be on disk. What a card and a search need, and the file for the rest."""
    collections = Na__EntLibTool__Collections()
    rows = []
    files = [(rel, asset) for rel, asset in Na__EntLibTool__AssetFiles() if not isinstance(asset, Exception)]
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
        "EntourageLibrary__Index__Meta": {
            "Meta__Description": "Generated by Na__Entourage__BuildUtil__Library__.py index: never edit by hand. Nothing lists a directory on the server, so an asset not listed here does not exist as far as the app knows."
        },
        "EntourageLibrary__Index__Assets": rows,
    }
    return json.dumps(document, indent=4, ensure_ascii=False) + "\n"


def Na__EntLibTool__WriteIndex(check):
    """Write the index, or with check only say whether the one on disk is current."""
    path = os.path.join(NA__ENTLIB__ROOT, NA__ENTLIB__INDEX)
    text = Na__EntLibTool__IndexText()
    current = None
    if os.path.isfile(path):
        with open(path, encoding="utf-8") as handle:
            current = handle.read()
    if check:
        print("%s: %s" % (NA__ENTLIB__INDEX, "current" if current == text else "OUT OF DATE"))
        return 0 if current == text else 1
    if current != text:
        with open(path, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(text)
    print("%s: %d assets" % (NA__ENTLIB__INDEX, len(json.loads(text)["EntourageLibrary__Index__Assets"])))
    return 0

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | The Next Free Id
# -----------------------------------------------------------------------------

def Na__EntLibTool__Next(type_name, family):
    """The next free Id: an item in a family if named, else the first of the next free family."""
    register = Na__EntLibTool__Load(NA__ENTLIB__REGISTER)
    code = "60"
    collection = Na__EntLibTool__Collections()[code]
    block = next((row["Type__Block"] for row in collection["Collection__Types"] if row["Type__Name"] == type_name), None)
    if block is None:
        raise SystemExit("%s has no type %s. It has: %s" % (collection["Collection__Name"], type_name, ", ".join(row["Type__Name"] for row in collection["Collection__Types"])))

    prefix = "VVL_%s_" % code
    taken = {asset["Asset__Id"][len(prefix):] for _, asset in Na__EntLibTool__AssetFiles() if not isinstance(asset, Exception) and asset["Asset__Id"].startswith(prefix)}
    taken |= {retired[len(prefix):] for retired in register["EntourageLibrary__Register__Numbering"]["Numbering__RetiredIds"] if retired.startswith(prefix)}

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
    parser = argparse.ArgumentParser(description="Keep the entourage asset library in order.")
    commands = parser.add_subparsers(dest="command", required=True)
    convert = commands.add_parser("convert", help="turn a SketchUp read into asset files")
    convert.add_argument("read")
    convert.add_argument("--force", action="store_true", help="replace a file already there")
    commands.add_parser("validate", help="every asset against the schema and the register")
    index = commands.add_parser("index", help="write the index the app reads")
    index.add_argument("--check", action="store_true", help="write nothing; exit 1 when it is out of date")
    next_id = commands.add_parser("next", help="the next free Id")
    next_id.add_argument("type")
    next_id.add_argument("--family", default="")
    args = parser.parse_args()

    if args.command == "convert":
        print("%d asset(s) written." % Na__EntLibTool__Convert(args.read, args.force))
        return 0
    if args.command == "validate":
        errors, warnings, count = Na__EntLibTool__Validate()
        for line in errors:
            print("ERROR   " + line)
        for line in warnings:
            print("WARNING " + line)
        print("%d asset(s): %d error(s), %d warning(s)." % (count, len(errors), len(warnings)))
        return 1 if errors else 0
    if args.command == "index":
        return Na__EntLibTool__WriteIndex(args.check)
    print(Na__EntLibTool__Next(args.type, args.family))
    return 0


if __name__ == "__main__":
    sys.exit(main())

# endregion -------------------------------------------------------------------
