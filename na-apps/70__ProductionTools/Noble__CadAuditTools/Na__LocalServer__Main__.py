#!/usr/bin/env python3
# =============================================================================
# NOBLE ARCHITECTURE - CAD AUDIT TOOLS LOCAL DEVELOPMENT SERVER
# =============================================================================
#
# FILE      : Na__LocalServer__Main__.py
# MODULE    : LocalServer
# AUTHOR    : Adam Noble - Noble Architecture
# PURPOSE   : Entry point for the Noble CAD Audit Tools Flask local server
# CREATED   : 07-Jul-2026
#
# DESCRIPTION:
# - Lean entry point — wires together server modules and starts Flask.
# - All server logic is delegated to 10__LocalServer__Modules/.
# - Opens browser to http://127.0.0.1:8007/ on startup.
# - Exposes API routes for DWG/DXF upload, conversion, and save.
#
# USAGE:
#   python Na__LocalServer__Main__.py             (opens browser tab)
#   python Na__LocalServer__Main__.py --silent    (no browser — for shell:startup)
#   Or use: Na__LocalServer__Main__.bat  /  Na__LocalServer__Silent__.vbs
#
# -----------------------------------------------------------------------------
#
# DEVELOPMENT LOG:
# 07-Jul-2026 - Version 0.3.0
# - Added --silent flag: suppresses the auto browser launch for startup use.
#
# 07-Jul-2026 - Version 0.1.0
# - Initial scaffold release.
#
# =============================================================================


# #region ---------------------------------------------------------------------
# REGION | Imports
# -----------------------------------------------------------------------------

import os
import sys
import threading


# HELPER FUNCTION | Force UTF-8 Console Encoding (Windows cp1252 Safety)
# ------------------------------------------------------------
def na_force_utf8_console():
    """
    Reconfigure stdout/stderr to UTF-8 so console prints containing Unicode
    glyphs (em dashes, → arrows, etc.) never raise UnicodeEncodeError on the
    Windows cp1252 console — which otherwise crashes API requests mid-print.
    Guarded for pythonw/--silent launches where the streams may be None.
    """
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding='utf-8', errors='backslashreplace')  # <-- Py3.7+ live re-encode
        except Exception:
            pass                                                     # <-- No stream (pythonw) or unsupported — ignore
# ------------------------------------------------------------

na_force_utf8_console()                                              # <-- Must run before any Unicode print

MODULES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '10__LocalServer__Modules')  # <-- Resolve server modules folder
if MODULES_DIR not in sys.path:
    sys.path.insert(0, MODULES_DIR)                                  # <-- Add to path so module names resolve cleanly

# @delegate: 10__LocalServer__Modules/Na__LocalServer__Config__.py
# @delegate: 10__LocalServer__Modules/Na__LocalServer__AppSetup__.py
# @delegate: 10__LocalServer__Modules/Na__LocalServer__ApiRoutes__.py

from Na__LocalServer__Config__   import HOST, PORT, AUTO_OPEN_BROWSER, BROWSER_DELAY_S  # <-- Server config constants
from Na__LocalServer__AppSetup__ import app, open_browser, print_banner                 # <-- Flask app + utilities
import Na__LocalServer__ApiRoutes__                                                      # <-- Registers API route handlers on app

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Main Entry Point
# -----------------------------------------------------------------------------

if __name__ == '__main__':

    SILENT_MODE = '--silent' in sys.argv                             # <-- shell:startup / Open-With launcher mode

    print_banner()                                                   # <-- Print server info to console

    if AUTO_OPEN_BROWSER and not SILENT_MODE:                        # <-- Conditionally launch browser tab
        threading.Timer(BROWSER_DELAY_S, open_browser).start()      # <-- Delayed open ensures Flask has bound the port

    app.run(
        host         = HOST,
        port         = PORT,
        debug        = False,
        use_reloader = False,
        threaded     = True                                          # <-- Serve status polls while a conversion job runs
    )

# endregion -------------------------------------------------------------------
