#!/usr/bin/env python3
# =============================================================================
# NOBLE ARCHITECTURE - VECTORFORGE LOCAL SERVER CONFIGURATION
# =============================================================================
#
# FILE       : VF__LocalServer__Config__.py
# MODULE     : LocalServer.Config
# AUTHOR     : Adam Noble - Noble Architecture
# PURPOSE    : Configuration constants for the VectorForge local dev server
# CREATED    : 26-Jun-2026
#
# DESCRIPTION:
# - Single source of truth for all local server configuration values
# - Port 8006 — next available after NobleImageTools (8005)
# - Imported by VF__LocalServer__AppSetup__ and VF__LocalServer__Main__
#
# -----------------------------------------------------------------------------
#
# DEVELOPMENT LOG:
# 26-Jun-2026 - Version 1.0.0
# - Initial release
#
# =============================================================================

import os


# #region ---------------------------------------------------------------------
# REGION | Server Configuration Constants
# -----------------------------------------------------------------------------

PORT                 = 8006                                          # <-- Local dev port (8006 — next after 8005 NobleImageTools)
HOST                 = '127.0.0.1'                                   # <-- Localhost only — not exposed to network
AUTO_OPEN_BROWSER    = True                                          # <-- Auto-open browser tab on server start
BROWSER_DELAY_S      = 1.5                                           # <-- Seconds to wait before opening browser (allows Flask to bind)

APP_DIR              = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # <-- VectorForge project root (two levels up from modules folder)
INDEX_FILENAME       = 'index.html'                                  # <-- App HTML entry point

# endregion -------------------------------------------------------------------
