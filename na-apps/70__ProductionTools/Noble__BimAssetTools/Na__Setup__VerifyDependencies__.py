#!/usr/bin/env python3
# =============================================================================
# NOBLE BIM ASSET TOOLS | SETUP - DEPENDENCY VERIFICATION
# =============================================================================
#
# FILE       : Na__Setup__VerifyDependencies__.py
# NAMESPACE  : Na__BimAssetTools
# AUTHOR     : Adam Noble - Noble Architecture
# PURPOSE    : Confirm a fresh clone has everything it needs before first run
# CREATED    : 14-Aug-2026
#
# DESCRIPTION:
# - Run this straight after cloning. It checks every file the application loads
#   at runtime and reports exactly what is missing and how to fix it, rather than
#   leaving a blank page and a console full of 404s to interpret.
# - Separates HARD requirements, which stop the app working at all, from the
#   OPTIONAL native converter, whose absence only disables Revit conversion.
#
# USAGE:
#     python Na__Setup__VerifyDependencies__.py
#
# EXIT CODES:
#     0  everything required is present
#     1  a required dependency is missing
#
# =============================================================================

import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))

# =============================================================================
# REGION | Dependency Manifest
# =============================================================================

# Every file the browser actually requests at runtime. Verified by exercising all
# loader routes and recording what was fetched, not by reading the source.
REQUIRED_FILES = [
    # -- Application shell ---------------------------------------------------
    ("Na__BimAssetTools__App__.html",                                    "Application shell and import map"),
    ("03__AppStyles/Na__StyleSheet__BimAssetTools__.css",                "Stylesheet"),
    ("02__AppData/Na__AppData__AppConfig__.json",                        "Tolerances and export settings"),
    ("02__AppData/Na__AppData__FormatRegistry__.json",                   "Extension to loader routing"),

    # -- Local server --------------------------------------------------------
    ("Na__LocalServer__Main__.py",                                       "Static server with WASM MIME types"),
    ("10__LocalServer__Modules/Na__LocalServer__RevitConvert__.py",      "Revit conversion broker"),

    # -- three.js ------------------------------------------------------------
    ("04__Src__Dependencies__VersionLocked/01__Vendor__ThreeJs__v0.184.0/build/three.module.js",                  "three.js core"),
    ("04__Src__Dependencies__VersionLocked/01__Vendor__ThreeJs__v0.184.0/build/three.core.js",                    "three.js shared internals"),
    ("04__Src__Dependencies__VersionLocked/01__Vendor__ThreeJs__v0.184.0/examples/jsm/controls/OrbitControls.js", "Viewport navigation"),
    ("04__Src__Dependencies__VersionLocked/01__Vendor__ThreeJs__v0.184.0/examples/jsm/exporters/GLTFExporter.js", "GLB export"),
    ("04__Src__Dependencies__VersionLocked/01__Vendor__ThreeJs__v0.184.0/examples/jsm/loaders/GLTFLoader.js",     "glTF/GLB import and export verification"),
    ("04__Src__Dependencies__VersionLocked/01__Vendor__ThreeJs__v0.184.0/examples/jsm/loaders/OBJLoader.js",      "OBJ import"),
    ("04__Src__Dependencies__VersionLocked/01__Vendor__ThreeJs__v0.184.0/examples/jsm/loaders/MTLLoader.js",      "OBJ materials"),
    ("04__Src__Dependencies__VersionLocked/01__Vendor__ThreeJs__v0.184.0/examples/jsm/loaders/STLLoader.js",      "STL import"),
    ("04__Src__Dependencies__VersionLocked/01__Vendor__ThreeJs__v0.184.0/examples/jsm/loaders/PLYLoader.js",      "PLY import"),
    ("04__Src__Dependencies__VersionLocked/01__Vendor__ThreeJs__v0.184.0/examples/jsm/loaders/TDSLoader.js",      "3DS import"),
    ("04__Src__Dependencies__VersionLocked/01__Vendor__ThreeJs__v0.184.0/examples/jsm/loaders/ColladaLoader.js",  "COLLADA import"),
    ("04__Src__Dependencies__VersionLocked/01__Vendor__ThreeJs__v0.184.0/examples/jsm/loaders/FBXLoader.js",      "FBX import"),
    ("04__Src__Dependencies__VersionLocked/01__Vendor__ThreeJs__v0.184.0/examples/jsm/libs/fflate.module.js",     "FBX/COLLADA decompression"),

    # -- web-ifc -------------------------------------------------------------
    ("04__Src__Dependencies__VersionLocked/02__Vendor__WebIfc__v0.0.77/web-ifc-api.js",  "IFC parser"),
    ("04__Src__Dependencies__VersionLocked/02__Vendor__WebIfc__v0.0.77/web-ifc.wasm",    "IFC parser WASM binary"),

    # -- occt-import-js ------------------------------------------------------
    ("04__Src__Dependencies__VersionLocked/03__Vendor__OcctImportJs__v0.0.23/occt-import-js.js",   "STEP/IGES reader"),
    ("04__Src__Dependencies__VersionLocked/03__Vendor__OcctImportJs__v0.0.23/occt-import-js.wasm", "OpenCascade WASM binary"),
]

# Application modules, checked as a group because they all matter equally.
REQUIRED_MODULE_DIRECTORIES = [
    ("03__AppModules/01__AppCore",           5),
    ("03__AppModules/02__UI",                4),
    ("03__AppModules/03__FileIngest",        2),
    ("03__AppModules/04__Loaders__Ifc",      2),
    ("03__AppModules/05__Loaders__Cad",      1),
    ("03__AppModules/06__Loaders__Mesh",     1),
    ("03__AppModules/07__Loaders__Revit",    2),
    ("03__AppModules/10__Env3d__Viewer",     1),
    ("03__AppModules/20__System__AssetAudit",1),
    ("03__AppModules/80__System__GlbExport", 1),
]

# endregion -------------------------------------------------------------------


# =============================================================================
# REGION | Checks
# =============================================================================

# -----------------------------------------------------------------------------
# FUNCTION | Verify Every Required Runtime File Is Present
# -----------------------------------------------------------------------------
def Na__Setup__CheckRequiredFiles():
    missing = []

    for relative_path, purpose in REQUIRED_FILES:
        if not os.path.isfile(os.path.join(PROJECT_ROOT, relative_path)):
            missing.append((relative_path, purpose))

    return missing


# -----------------------------------------------------------------------------
# FUNCTION | Verify Each Module Folder Holds Its Expected Module Count
# -----------------------------------------------------------------------------
def Na__Setup__CheckModules():
    problems = []

    for relative_path, expected_count in REQUIRED_MODULE_DIRECTORIES:
        directory = os.path.join(PROJECT_ROOT, relative_path)

        if not os.path.isdir(directory):
            problems.append(f"{relative_path} is missing entirely")
            continue

        found = len([n for n in os.listdir(directory) if n.endswith(".mjs")])
        if found < expected_count:
            problems.append(f"{relative_path} holds {found} modules, expected {expected_count}")

    return problems


# -----------------------------------------------------------------------------
# FUNCTION | Report on the Optional Native Converter
# -----------------------------------------------------------------------------
def Na__Setup__CheckConverter():
    sys.path.insert(0, os.path.join(PROJECT_ROOT, "10__LocalServer__Modules"))
    try:
        import Na__LocalServer__RevitConvert__ as RevitConvert
        return RevitConvert.Na__RevitConvert__FindConverter()
    except Exception:
        return None


# -----------------------------------------------------------------------------
# FUNCTION | Confirm the Python Version Is New Enough
# -----------------------------------------------------------------------------
def Na__Setup__CheckPython():
    # 3.8 is the floor: the server relies on f-strings, pathlib behaviour and
    # threading semantics that are stable from there onward.
    return sys.version_info >= (3, 8)

# endregion -------------------------------------------------------------------


# =============================================================================
# REGION | Report
# =============================================================================

def Na__Setup__Run():
    print("=" * 74)
    print("  NOBLE BIM ASSET TOOLS - DEPENDENCY VERIFICATION")
    print("=" * 74)
    print(f"  Project root : {PROJECT_ROOT}\n")

    failed = False

    # -- Python ------------------------------------------------------------
    version_text = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    if Na__Setup__CheckPython():
        print(f"  [ OK ]  Python {version_text}")
    else:
        print(f"  [FAIL]  Python {version_text} is too old. Python 3.8 or newer is required.")
        failed = True

    # -- Required files ------------------------------------------------------
    missing = Na__Setup__CheckRequiredFiles()
    if not missing:
        print(f"  [ OK ]  All {len(REQUIRED_FILES)} required runtime files present")
    else:
        print(f"  [FAIL]  {len(missing)} required file(s) missing:")
        for relative_path, purpose in missing:
            print(f"            - {relative_path}")
            print(f"              ({purpose})")
        failed = True

    # -- Modules -------------------------------------------------------------
    problems = Na__Setup__CheckModules()
    if not problems:
        total = sum(count for _, count in REQUIRED_MODULE_DIRECTORIES)
        print(f"  [ OK ]  All {total} application modules present")
    else:
        print("  [FAIL]  Application modules incomplete:")
        for problem in problems:
            print(f"            - {problem}")
        failed = True

    # -- Optional converter --------------------------------------------------
    converter = Na__Setup__CheckConverter()
    print()
    if converter:
        is_vendored = "04__Vendor__DdcRvt2Ifc" in converter
        print(f"  [ OK ]  Revit to IFC conversion available")
        print(f"            {'vendored copy' if is_vendored else 'studio fallback'}: {converter}")
    else:
        print("  [ -- ]  Revit to IFC conversion NOT available (optional)")
        print("            Everything else works. Revit files will still be audited")
        print("            for parameters, thumbnails and version data, but cannot")
        print("            be converted to geometry.")
        print()
        print("            To enable it, place the DDC converter at:")
        print("              04__Src__Dependencies__VersionLocked/")
        print("                04__Vendor__DdcRvt2Ifc__v18.1.0/")
        print("                  DDC_REVIT2IFC_CONVERTER/RVT2IFCconverter.exe")
        print()
        print("            It is not committed to source control: it is 720 MB and")
        print("            bundles LibXL and the ODA SDK, whose licences prohibit")
        print("            redistribution. Download it from DataDrivenConstruction.")

    # -- Verdict -------------------------------------------------------------
    print()
    print("=" * 74)
    if failed:
        print("  RESULT: FAILED - the application will not run until the above is fixed.")
        print("=" * 74)
        return 1

    print("  RESULT: READY")
    print()
    print("  Start the application with:")
    print("      Na__LocalServer__Main__.bat")
    print("=" * 74)
    return 0

# endregion -------------------------------------------------------------------


if __name__ == "__main__":
    sys.exit(Na__Setup__Run())
