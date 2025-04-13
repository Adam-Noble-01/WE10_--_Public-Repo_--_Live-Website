import http.server
import socketserver
import webbrowser
import os
import threading

# Absolute path to your HTML file
html_file_path = r"D:\WE10_--_Public-Repo_--_Live-Website\na-apps\NA20_WebApp_-_PlanVision\Index_-_PlanVision-App_-_2.0.0.html"
# Get the directory and file name
serve_directory = os.path.dirname(html_file_path)
html_file_name = os.path.basename(html_file_path)

# Define the port
PORT = 8000

# Change to the directory where the file is located
os.chdir(serve_directory)

# Function to open browser after server starts
def open_browser():
    url = f"http://localhost:{PORT}/{html_file_name}"
    webbrowser.open_new_tab(url)

# Set up the handler
handler = http.server.SimpleHTTPRequestHandler

# Start server in a thread
with socketserver.TCPServer(("", PORT), handler) as httpd:
    print(f"Serving at http://localhost:{PORT}")
    threading.Timer(1.5, open_browser).start()
    httpd.serve_forever()
