#!/usr/bin/env python3
# =============================================================================
# NOBLE ARCHITECTURE - CAD AUDIT TOOLS NATIVE DIALOGS
# =============================================================================
#
# FILE      : Na__LocalServer__NativeDialogs__.py
# MODULE    : LocalServer.NativeDialogs
# AUTHOR    : Adam Noble - Noble Architecture
# PURPOSE   : Native OS file/folder pickers for the local server (Windows)
# CREATED   : 08-Jul-2026
#
# DESCRIPTION:
# - na_pick_save_path(default_name, title): opens the native "Save As" file
#   explorer so the user chooses WHERE to export the DXF, returning the chosen
#   absolute path (or None if cancelled).
# - The Tk dialog is run in an ISOLATED SHORT-LIVED SUBPROCESS rather than in the
#   Flask worker thread. Tkinter is not thread-safe and the Werkzeug dev server
#   handles each request on its own worker thread — creating a Tk root there is
#   fragile on Windows. A dedicated subprocess sidesteps every threading issue:
#   the dialog owns its own process, prints the chosen path to stdout, and exits.
# - A module lock serialises pickers so two dialogs never race.
#
# -----------------------------------------------------------------------------
#
# DEVELOPMENT LOG:
# 08-Jul-2026 - Version 0.3.5
# - Initial release — native Save-As picker via isolated subprocess.
#
# =============================================================================

import os
import sys
import subprocess
import threading


# #region ---------------------------------------------------------------------
# REGION | Module State
# -----------------------------------------------------------------------------

_DIALOG_LOCK    = threading.Lock()                                      # <-- Serialise native dialogs
_DIALOG_TIMEOUT = 300                                                   # <-- Give the user 5 minutes to choose

# Worker script run in the isolated subprocess. Reads a JSON spec on argv and
# writes the chosen path (or empty string on cancel) to stdout.
_PICKER_WORKER = r'''
import sys, json
import tkinter as tk
from tkinter import filedialog

spec = json.loads(sys.argv[1])

root = tk.Tk()
root.withdraw()                          # hide the empty root window
try:
    root.attributes('-topmost', True)    # dialog appears above the browser
except Exception:
    pass
root.update()

path = filedialog.asksaveasfilename(
    parent          = root,
    title           = spec.get('title', 'Export As'),
    initialfile     = spec.get('defaultName', 'export.dxf'),
    initialdir      = spec.get('initialDir', ''),
    defaultextension= spec.get('defaultExt', '.dxf'),
    filetypes       = [('DXF drawing', '*.dxf'), ('All files', '*.*')],
)

root.destroy()
sys.stdout.write(path or '')
'''

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Save-As Picker
# -----------------------------------------------------------------------------

def na_pick_save_path(default_name='export.dxf', title='Export DXF As', initial_dir=''):
    """
    Open the native OS "Save As" dialog and return the chosen absolute path.

    Args:
        default_name (str): Suggested filename shown in the dialog.
        title        (str): Dialog window title.
        initial_dir  (str): Folder the dialog opens in (optional).

    Returns:
        str | None: The chosen absolute path, or None if the user cancelled.
    """
    import json

    spec = json.dumps({
        'title'       : title,
        'defaultName' : default_name,
        'initialDir'  : initial_dir or '',
        'defaultExt'  : '.dxf',
    })

    cmd = [sys.executable, '-c', _PICKER_WORKER, spec]

    with _DIALOG_LOCK:                                                  # <-- One dialog at a time
        try:
            result = subprocess.run(
                cmd,
                capture_output = True,
                text           = True,
                timeout        = _DIALOG_TIMEOUT,
            )
        except subprocess.TimeoutExpired:
            print("[Na__NativeDialogs] Save-As dialog timed out")
            return None
        except Exception as err:
            print(f"[Na__NativeDialogs] Save-As dialog error: {err}")
            return None

    chosen = (result.stdout or '').strip()
    if not chosen:
        return None                                                     # <-- User cancelled the dialog

    return os.path.abspath(chosen)

# endregion -------------------------------------------------------------------
