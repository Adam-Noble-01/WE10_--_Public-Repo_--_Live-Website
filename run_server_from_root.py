import http.server
import socketserver
import webbrowser
import os
import threading
from pathlib import Path

# Original absolute HTML path
html_file_path = Path(r"D:\WE10_--_Public-Repo_--_Live-Website\na-apps\NA20_WebApp_-_PlanVision\Index_-_PlanVision-App_-_2.0.0.html")

# Define server root: two levels up
server_root = html_file_path.parents[2]

# Relative path from server root to HTML file
relative_html_path = html_file_path.relative_to(server_root)

# Port for the server
PORT = 8000

# Change working directory to server root
os.chdir(server_root)

# Function to open browser after server starts
def open_browser():
    url = f"http://localhost:{PORT}/{relative_html_path.as_posix()}"
    webbrowser.open_new_tab(url)

# Set up the handler
handler = http.server.SimpleHTTPRequestHandler

# Start server in a thread
with socketserver.TCPServer(("", PORT), handler) as httpd:
    print(f"Serving at http://localhost:{PORT}")
    threading.Timer(1.5, open_browser).start()
    httpd.serve_forever()
