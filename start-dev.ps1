# Starts the Kilowatch backend monitor and the Expo dev server,
# each in its own PowerShell window.
# Usage: right-click > Run with PowerShell, or from a terminal:  .\start-dev.ps1

$root = $PSScriptRoot

Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$root\kilowatch-backend'; Write-Host 'KILOWATCH BACKEND MONITOR' -ForegroundColor Green; npm start"
)

Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$root\kilowatch-app'; Write-Host 'KILOWATCH APP (EXPO)' -ForegroundColor Cyan; npx expo start --dev-client"
)
