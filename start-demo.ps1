$port = 8080
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Starting demo at http://localhost:$port"
Write-Host "Project root: $root"

Start-Process "http://localhost:$port"
python -m http.server $port --directory $root
