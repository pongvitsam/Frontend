# Deploy to Google Apps Script production (same URL — no new deployment)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

Write-Host "Pushing source to Apps Script..." -ForegroundColor Cyan
clasp push
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$config = Get-Content (Join-Path $root "deploy.config.json") | ConvertFrom-Json
$deploymentId = $config.productionDeploymentId

Write-Host "Updating production deployment (URL unchanged)..." -ForegroundColor Cyan
clasp deploy -i $deploymentId -d "Production"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Done. Production URL:" -ForegroundColor Green
Write-Host $config.productionUrl
