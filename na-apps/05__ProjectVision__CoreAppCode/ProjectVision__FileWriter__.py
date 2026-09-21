#!/usr/bin/env python3
# =============================================================================
# NOBLE ARCHITECTURE - PROJECTVISION FILE WRITER
# =============================================================================
#
# FILE       : ProjectVision__FileWriter__.py
# NAMESPACE  : ProjectVision
# MODULE     : File Writer
# AUTHOR     : Adam Noble - Noble Architecture
# PURPOSE    : Replace a generated file whole, even while another process is
#              reading it
# CREATED    : 21-Sep-2026
#
# DESCRIPTION:
# - open(path, 'w') truncates the file where it stands. Windows refuses to
#   truncate a file another process has memory-mapped, and `git diff` maps every
#   modified file it compares - the Claude app, editors and other sessions run
#   it constantly. Python reports the refusal (ERROR_USER_MAPPED_FILE, 1224) as
#   "[Errno 22] Invalid argument". It aborted the build on 20-Sep-2026 (a DAS
#   HTML file) and again on 21-Sep-2026 (the master project index).
# - Writing a temp file beside the target and renaming it over the target is
#   allowed while the view is mapped, and a crash mid-write can never leave a
#   half-written file behind.
# - A reader that holds the file OPEN rather than mapped can still refuse the
#   rename for a moment, so the rename is retried briefly before it fails.
#
# USAGE:
#   from ProjectVision__FileWriter__ import write_json_file, write_text_file
#
# =============================================================================

import os
import json
import time
import tempfile


    # MODULE CONSTANTS | Rename Retry Schedule
    # ------------------------------------------------------------
REPLACE_RETRY_DELAYS_S             = (0.05, 0.1, 0.2, 0.4, 0.8, 1.6)   # <-- About 3 s in all, then the error stands
    # ------------------------------------------------------------


    # FUNCTION | Replace a File With New Bytes Through a Temp File
    # ------------------------------------------------------------
def write_bytes_file(path, data):
    """Write `data` to a temp file in the target's folder, then rename it over `path`.

    The folder must already exist, exactly as it had to for open(path, 'w').
    """
    directory = os.path.dirname(os.path.abspath(path))
    handle, temp_path = tempfile.mkstemp(
        prefix=os.path.basename(path) + '.', suffix='.writing', dir=directory
    )
    try:
        with os.fdopen(handle, 'wb') as f:
            f.write(data)

        for delay in REPLACE_RETRY_DELAYS_S + (None,):
            try:
                os.replace(temp_path, path)
                return
            except PermissionError:
                if delay is None:
                    raise
                time.sleep(delay)                                      # <-- Held open by a reader; try again
    except BaseException:
        try:
            os.remove(temp_path)
        except OSError:
            pass
        raise
    # ------------------------------------------------------------


    # FUNCTION | Replace a File With UTF-8 Text
    # ------------------------------------------------------------
def write_text_file(path, text):
    """Write `text` as UTF-8 with its newlines exactly as given (no CRLF translation)."""
    write_bytes_file(path, text.encode('utf-8'))
    # ------------------------------------------------------------


    # FUNCTION | Replace a File With Pretty-Printed JSON
    # ------------------------------------------------------------
def write_json_file(path, data):
    """Write `data` as 4-space indented JSON with a trailing newline."""
    write_text_file(path, json.dumps(data, indent=4, ensure_ascii=False) + '\n')
    # ------------------------------------------------------------
