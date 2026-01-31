#!/usr/bin/env python3
"""
=============================================================================
NOBLE ARCHITECTURE - LOCAL DEVELOPMENT SERVER
=============================================================================

Simple HTTP server for local development and testing.

Usage:
    python start_local_server.py

Then open:
    http://localhost:8080/?project=AA00&year=26

=============================================================================
"""

import http.server
import socketserver
import os
import sys

PORT = 8080

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

def main():
    # Change to the script's directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    print("\n" + "=" * 60)
    print("  Noble Architecture - Project Admin Development Server")
    print("=" * 60)
    print(f"\n  Server running at: http://localhost:{PORT}/")
    print("\n  Test URLs:")
    print(f"    - Main app: http://localhost:{PORT}/")
    print(f"    - Example project: http://localhost:{PORT}/?project=AA00&year=26")
    print("\n  Editor Tools:")
    print(f"    - Quotation Builder: http://localhost:{PORT}/04__EditorTools/Editor__QuotationBuilder__.html")
    print(f"    - Terms Editor: http://localhost:{PORT}/04__EditorTools/Editor__TermsEditor__.html")
    print(f"    - Project Config: http://localhost:{PORT}/04__EditorTools/Editor__ProjectConfig__.html")
    print("\n  Press Ctrl+C to stop the server")
    print("=" * 60 + "\n")
    
    with socketserver.TCPServer(("", PORT), CORSRequestHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\nServer stopped.")
            sys.exit(0)

if __name__ == "__main__":
    main()

