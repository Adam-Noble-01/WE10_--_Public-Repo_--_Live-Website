#!/usr/bin/env python3
# =============================================================================
# NOBLE ARCHITECTURE - CAD AUDIT TOOLS LOCAL SERVER CONFIGURATION
# =============================================================================
#
# FILE      : Na__LocalServer__Config__.py
# MODULE    : LocalServer.Config
# AUTHOR    : Adam Noble - Noble Architecture
# PURPOSE   : Configuration constants for the CAD Audit Tools local dev server
# CREATED   : 07-Jul-2026
#
# DESCRIPTION:
# - Single source of truth for all local server configuration values.
# - Port 8007 — next available after VectorForge (8006).
# - Imported by Na__LocalServer__AppSetup__ and Na__LocalServer__Main__.
#
# -----------------------------------------------------------------------------
#
# DEVELOPMENT LOG:
# 07-Jul-2026 - Version 0.1.0
# - Initial scaffold release.
#
# =============================================================================

import os


# #region ---------------------------------------------------------------------
# REGION | Server Configuration Constants
# -----------------------------------------------------------------------------

PORT                 = 8007                                          # <-- Local dev port (8007 — next after VectorForge 8006)
HOST                 = '127.0.0.1'                                   # <-- Localhost only — not exposed to network
AUTO_OPEN_BROWSER    = True                                          # <-- Auto-open browser tab on server start
BROWSER_DELAY_S      = 1.5                                          # <-- Seconds to wait before opening browser (allows Flask to bind)

APP_DIR              = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # <-- Project root (two levels up from modules folder)
INDEX_FILENAME       = 'Na__App__.html'                             # <-- App HTML entry point (namespaced, per ValeSpec style)

MAX_UPLOAD_MB        = 100                                          # <-- Maximum allowed upload size in megabytes
ALLOWED_EXTENSIONS   = {'dxf', 'dwg'}                              # <-- Valid file types for upload

# endregion -------------------------------------------------------------------
