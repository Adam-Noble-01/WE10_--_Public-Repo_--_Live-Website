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
#   python Na__LocalServer__Main__.py -r          (RESET — kill any instance holding
#                                                  port 8007, then start fresh;
#                                                  also accepts -R / --r / --R /
#                                                  --reset / --restart)
#   Or use: Na__LocalServer__Main__.bat  /  Na__LocalServer__Silent__.vbs
#   The .bat forwards its arguments, so:  Na__LocalServer__Main__.bat -r
#
# PORT GUARD:
#   Werkzeug binds with SO_REUSEADDR, so on Windows a second server instance
#   can bind port 8007 alongside an existing one — it looks alive but NEVER
#   receives a request, while the old instance keeps serving stale code. That
#   ghost cost a full day of "my changes do nothing" debugging (see DEVLOG
#   19-Aug-2026). Startup therefore probes the port with SO_EXCLUSIVEADDRUSE:
#     - port free      → start normally
#     - port held      → REFUSE loudly, naming the owning PID
#     - port held + -r → kill the owner(s), wait for the port, start fresh
#
# -----------------------------------------------------------------------------
#
# DEVELOPMENT LOG:
# 19-Aug-2026 - Version 0.4.0
# - Added -r / -R / --reset flag: kills whatever holds port 8007, then starts.
# - Startup now refuses loudly when the port is already held (instead of
#   silently double-binding into a shadow instance that never serves).
#
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
import time
import socket
import threading
import subprocess


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
# REGION | Port Guard — Detect / Reclaim an Already-Running Instance
# -----------------------------------------------------------------------------

def na_port_is_free(port):
    """
    True when nothing on this machine holds the port. The probe binds with
    SO_EXCLUSIVEADDRUSE, which fails against ANY existing socket — including a
    Werkzeug listener bound with SO_REUSEADDR that a plain bind would silently
    sit alongside (the exact ghost this guard exists to prevent).
    """
    probe = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        if hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):                   # <-- Windows-only option
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        probe.bind((HOST, port))
        return True
    except OSError:
        return False
    finally:
        probe.close()


def na_find_port_listener_pids(port):
    """Return PIDs of processes LISTENING on the port (netstat parse, self excluded)."""
    try:
        out = subprocess.run(['netstat', '-ano', '-p', 'tcp'],
                             capture_output=True, text=True, timeout=10).stdout
    except Exception:
        return []

    pids   = set()
    needle = f':{port}'
    for line in out.splitlines():
        parts = line.split()
        # IPv4 row shape: TCP  <local>  <foreign>  <state>  <pid>
        if (len(parts) >= 5 and parts[0].upper() == 'TCP'
                and parts[1].endswith(needle) and 'LISTEN' in parts[3].upper()):
            try:
                pid = int(parts[4])
            except ValueError:
                continue
            if pid > 0 and pid != os.getpid():
                pids.add(pid)
    return sorted(pids)


def na_describe_pid(pid):
    """Best-effort process name for a PID, for readable console messages."""
    try:
        out = subprocess.run(['tasklist', '/FI', f'PID eq {pid}', '/FO', 'CSV', '/NH'],
                             capture_output=True, text=True, timeout=10).stdout
        first = out.strip().splitlines()[0]
        return first.split('","')[0].strip('"') or 'unknown'
    except Exception:
        return 'unknown'


def na_reclaim_port(port):
    """
    Kill every process listening on the port, then wait for it to come free.
    Returns True when the port is usable, False when reclaim failed.
    """
    pids = na_find_port_listener_pids(port)
    if not pids:
        print(f"[Na__PortGuard] Port {port} is held but no LISTENING owner found — "
              f"likely a closing socket; waiting for it to release…")
    for pid in pids:
        name = na_describe_pid(pid)
        try:
            subprocess.run(['taskkill', '/F', '/PID', str(pid)],
                           capture_output=True, text=True, timeout=10)
            print(f"[Na__PortGuard] Killed PID {pid} ({name}) holding port {port}")
        except Exception as err:
            print(f"[Na__PortGuard] Could not kill PID {pid} ({name}): {err}")

    deadline = time.time() + 5.0                                     # <-- Socket teardown can lag the kill
    while time.time() < deadline:
        if na_port_is_free(port):
            print(f"[Na__PortGuard] Port {port} reclaimed")
            return True
        time.sleep(0.25)
    return False


def na_guard_port_or_exit(port, reset_mode):
    """
    Enforce single-instance behaviour before Flask binds:
      port free              → return (start normally)
      port held, reset_mode  → kill owner(s) and return, or exit(1) on failure
      port held, no flag     → print a loud refusal naming the owner, exit(1)
    """
    if na_port_is_free(port):
        if reset_mode:
            print(f"[Na__PortGuard] No existing instance on port {port} — starting fresh")
        return

    if reset_mode:
        if not na_reclaim_port(port):
            print(f"[Na__PortGuard] ERROR: port {port} still held after reset — not started")
            sys.exit(1)
        return

    owners = na_find_port_listener_pids(port)
    detail = ', '.join(f"PID {p} ({na_describe_pid(p)})" for p in owners) or 'unknown owner'
    print("")
    print("=" * 76)
    print(f"  PORT {port} IS ALREADY IN USE — SERVER NOT STARTED")
    print(f"  Held by: {detail}")
    print("  This is usually the silent instance launched at Windows login.")
    print("  A second copy would bind but NEVER receive requests, so this")
    print("  launch has been refused instead of creating a ghost instance.")
    print("")
    print("  To kill the old instance and take the port, run with reset:")
    print("      python Na__LocalServer__Main__.py -r")
    print("=" * 76)
    print("")
    sys.exit(1)

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Main Entry Point
# -----------------------------------------------------------------------------

if __name__ == '__main__':

    SILENT_MODE = '--silent' in sys.argv                             # <-- shell:startup / Open-With launcher mode
    RESET_MODE  = any(arg.lower() in ('-r', '--r', '--reset', '--restart')
                      for arg in sys.argv[1:])                       # <-- -r / -R / --R … : reclaim port 8007 first

    na_guard_port_or_exit(PORT, RESET_MODE)                          # <-- Single-instance guard (may exit)

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
