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
#   python Na__LocalServer__Main__.py
#   Or use: Na__LocalServer__Main__.bat
#
# -----------------------------------------------------------------------------
#
# DEVELOPMENT LOG:
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

    print_banner()                                                   # <-- Print server info to console

    if AUTO_OPEN_BROWSER:                                            # <-- Conditionally launch browser tab
        threading.Timer(BROWSER_DELAY_S, open_browser).start()      # <-- Delayed open ensures Flask has bound the port

    app.run(
        host         = HOST,
        port         = PORT,
        debug        = False,
        use_reloader = False
    )

# endregion -------------------------------------------------------------------
