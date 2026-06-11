$ErrorActionPreference = "Stop"

Write-Host "Running npm run check..." -ForegroundColor Cyan
npm run check

Write-Host "Running npm run build..." -ForegroundColor Cyan
npm run build

Write-Host "Running npm audit --audit-level=moderate..." -ForegroundColor Cyan
npm audit --audit-level=moderate

Write-Host "Validation completed." -ForegroundColor Green
