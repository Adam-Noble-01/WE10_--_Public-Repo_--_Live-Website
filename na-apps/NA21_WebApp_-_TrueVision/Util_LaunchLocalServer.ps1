# Start simple HTTP server on port 8080 in current directory
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'python -m http.server 8080'

# Give server a moment to start
Start-Sleep -Seconds 2

# Open browser to Index.html (make sure capitalisation matches actual file name)
Start-Process "http://localhost:8080/Index.html"
