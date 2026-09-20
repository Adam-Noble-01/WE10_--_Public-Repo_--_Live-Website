# =============================================================================
# TRUEVISION3D - VERIFY - RUBY SYNTAX (SketchUp's own embedded interpreter)
# =============================================================================
#
# FILE       : Na__Verify__RubySyntax__.py
# PURPOSE    : Syntax-check SketchUp plugin Ruby without SketchUp, and without a
#              ruby.exe - there is none on this machine
# CREATED    : 20-Sep-2026
#
# WHY THIS EXISTS:
# - The studio PC has no Ruby interpreter, so plugin Ruby has always gone to
#   Adam unchecked. Twice now a plain syntax error has reached him and stopped
#   the plugin loading - most recently a hash key written "path : value", which
#   Ruby only accepts as "path: value".
# - SketchUp ships its interpreter as a DLL (x64-ucrt-ruby320.dll) with no host
#   executable. This loads that DLL through ctypes, boots it, and asks Ruby
#   itself to compile each file with RubyVM::InstructionSequence.compile.
#   It is Ruby's real parser, not a heuristic.
# - NOTHING IS EXECUTED. compile() parses and stops; no plugin code runs, no
#   SketchUp API is touched, and a file that references Sketchup:: constants
#   still checks clean because those are resolved at run time, not parse time.
#
# USAGE:
#   python 80__Testing__PrototypeEnvironment/Na__Verify__RubySyntax__.py            (the GLB Builder modules)
#   python 80__Testing__PrototypeEnvironment/Na__Verify__RubySyntax__.py <path>...  (named files or folders)
#
# EXIT CODE: 0 all files parse, 1 a file failed, 2 the interpreter is unavailable.
#
# =============================================================================

import ctypes
import glob
import os
import sys

sys.dont_write_bytecode = True

# -----------------------------------------------------------------------------
# REGION | Locating SketchUp's Embedded Interpreter
# -----------------------------------------------------------------------------

SKETCHUP_ROOTS = [
    r"C:\Program Files\SketchUp\SketchUp 2026\SketchUp",
    r"C:\Program Files\SketchUp\SketchUp 2025\SketchUp",
    r"C:\Program Files\SketchUp\SketchUp 2024\SketchUp",
]

DEFAULT_TARGET = os.path.join(
    os.environ.get("APPDATA", ""), "SketchUp", "SketchUp 2026", "SketchUp",
    "Plugins", "Na__TrueVision__GlbBuilderUtility__Modules__",
)


def find_ruby_dll():
    """The newest SketchUp Ruby DLL on this machine, or None."""
    for root in SKETCHUP_ROOTS:
        if not os.path.isdir(root):
            continue
        for name in sorted(os.listdir(root)):
            if name.lower().startswith("x64-") and "ruby" in name.lower() and name.lower().endswith(".dll"):
                return os.path.join(root, name)
    return None


def boot_ruby(dll_path):
    """Load and initialise the interpreter. Returns the loaded library."""
    os.add_dll_directory(os.path.dirname(dll_path))          # its siblings must resolve
    lib = ctypes.CDLL(dll_path)

    argc = ctypes.c_int(1)
    arg0 = ctypes.create_string_buffer(b"rubycheck")
    argv_arr = (ctypes.c_char_p * 2)(ctypes.cast(arg0, ctypes.c_char_p), None)
    argv = ctypes.pointer(ctypes.cast(argv_arr, ctypes.POINTER(ctypes.c_char_p)))

    lib.ruby_sysinit(ctypes.byref(argc), argv)
    lib.ruby_init()
    lib.ruby_init_loadpath()

    lib.rb_eval_string_protect.restype = ctypes.c_void_p
    lib.rb_eval_string_protect.argtypes = [ctypes.c_char_p, ctypes.POINTER(ctypes.c_int)]
    return lib


def ruby_eval(lib, code):
    """Evaluate a snippet. Returns (ok, raised_state)."""
    state = ctypes.c_int(0)
    lib.rb_eval_string_protect(code.encode("utf-8"), ctypes.byref(state))
    return state.value == 0, state.value

# endregion -------------------------------------------------------------------


# -----------------------------------------------------------------------------
# REGION | Checking Files
# -----------------------------------------------------------------------------

# Ruby compiles the file and reports the first syntax error. Anything that is not
# a SyntaxError (a missing constant, say) is NOT a parse problem and is ignored.
CHECK = r'''
begin
  src = File.binread(%s).force_encoding("UTF-8")
  RubyVM::InstructionSequence.compile(src, %s)
  $na_result = "OK"
rescue SyntaxError => e
  $na_result = "SYNTAX\n" + e.message.to_s
rescue Exception => e
  $na_result = "OK"
end
File.binwrite(%s, $na_result)
'''


def check_file(lib, path, scratch):
    q = lambda s: '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'
    ok, _ = ruby_eval(lib, CHECK % (q(path), q(os.path.basename(path)), q(scratch)))
    if not ok:
        return False, "the checker itself raised while reading this file"
    with open(scratch, "r", encoding="utf-8", errors="replace") as f:
        out = f.read()
    if out.startswith("OK"):
        return True, ""
    return False, out.split("\n", 1)[1].strip() if "\n" in out else out


def collect(targets):
    files = []
    for t in targets:
        if os.path.isdir(t):
            files += sorted(glob.glob(os.path.join(t, "**", "*.rb"), recursive=True))
        elif t.endswith(".rb"):
            files.append(t)
    return files

# endregion -------------------------------------------------------------------


def main():
    targets = sys.argv[1:] or [DEFAULT_TARGET]
    files = collect(targets)

    print("TrueVision3D - Ruby syntax, through SketchUp's own interpreter")
    if not files:
        print("  no .rb files found in: " + ", ".join(targets))
        return 1

    dll = find_ruby_dll()
    if not dll:
        print("  SKIPPED - no SketchUp Ruby DLL found. Looked in:")
        for r in SKETCHUP_ROOTS:
            print("    " + r)
        return 2

    print("  interpreter   : " + os.path.basename(dll))
    print("  files to check: %d\n" % len(files))

    try:
        lib = boot_ruby(dll)
    except OSError as error:
        print("  SKIPPED - the interpreter would not load: %s" % error)
        return 2

    scratch = os.path.join(os.environ.get("TEMP", "."), "na__rubycheck__result.txt")
    failures = []
    for path in files:
        ok, message = check_file(lib, path, scratch)
        if not ok:
            failures.append((path, message))
            print("  FAIL  %s" % os.path.basename(path))
            for line in message.splitlines():
                print("        %s" % line)

    print()
    if failures:
        print("  FAIL - %d of %d file(s) do not parse." % (len(failures), len(files)))
        return 1
    print("  PASS - all %d file(s) parse." % len(files))
    return 0


if __name__ == "__main__":
    sys.exit(main())
