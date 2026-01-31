#!/usr/bin/env python3
"""
=============================================================================
NOBLE ARCHITECTURE - LOCAL DEVELOPMENT SERVER
=============================================================================

Simple HTTP server for local development and testing.

Usage:
    python start_local_server.py

The browser will automatically open to http://localhost:8080/

=============================================================================
"""

import http.server
import socketserver
import os
import sys
import webbrowser
import threading
import time
import platform

PORT = 8080
SERVER_URL = f"http://localhost:{PORT}/"

class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP request handler with CORS headers for local development."""
    
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

def open_browser():
    """Open the browser after a short delay to ensure server is ready."""
    time.sleep(1.5)                                      # <-- Wait for server to start
    
    print(f"  Opening browser to {SERVER_URL}...")
    
    try:
        # Open browser (will focus existing tab if already open)
        webbrowser.open(SERVER_URL)
        
        # Platform-specific focus handling
        if platform.system() == 'Windows':
            # On Windows, bring the browser window to front
            time.sleep(0.5)                              # <-- Wait for browser to open
            try:
                import subprocess
                # Use PowerShell to bring browser to foreground
                subprocess.run([
                    'powershell', '-Command',
                    "(New-Object -ComObject WScript.Shell).AppActivate((Get-Process | Where-Object {$_.MainWindowTitle -like '*localhost*' -or $_.ProcessName -like '*chrome*' -or $_.ProcessName -like '*firefox*' -or $_.ProcessName -like '*msedge*'} | Select-Object -First 1).Id)"
                ], capture_output=True, timeout=2)
            except:
                pass                                     # <-- Fail silently if focus doesn't work
                
        elif platform.system() == 'Darwin':              # <-- macOS
            time.sleep(0.5)
            try:
                import subprocess
                # Bring browser to front on macOS
                subprocess.run(['osascript', '-e', 'tell application "System Events" to set frontmost of first process whose frontmost is true to false'])
                subprocess.run(['osascript', '-e', 'tell application "System Events" to set frontmost of first process whose name contains "Chrome" or name contains "Firefox" or name contains "Safari" to true'])
            except:
                pass
                
    except Exception as e:
        print(f"  Note: Could not auto-open browser: {e}")
        print(f"  Please manually open: {SERVER_URL}")

def main():
    # Change to the script's directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    print("\n" + "=" * 60)
    print("  Noble Architecture - Project Admin Development Server")
    print("=" * 60)
    print(f"\n  Server running at: {SERVER_URL}")
    print("\n  Test URLs:")
    print(f"    - Main app: {SERVER_URL}")
    print(f"    - Example project: {SERVER_URL}?project=AA00&year=26")
    print("\n  Editor Tools:")
    print(f"    - Project Index Builder: {SERVER_URL}04__EditorTools/Editor__ProjectIndexBuilder__.html")
    print(f"    - Project Config: {SERVER_URL}04__EditorTools/Editor__ProjectConfig__.html")
    print(f"    - Quotation Builder: {SERVER_URL}04__EditorTools/Editor__QuotationBuilder__.html")
    print(f"    - Terms Editor: {SERVER_URL}04__EditorTools/Editor__TermsEditor__.html")
    print("\n  Press Ctrl+C to stop the server")
    print("=" * 60 + "\n")
    
    # Start browser in background thread
    browser_thread = threading.Thread(target=open_browser, daemon=True)
    browser_thread.start()
    
    with socketserver.TCPServer(("", PORT), CORSRequestHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\nServer stopped.")
            sys.exit(0)

if __name__ == "__main__":
    main()

