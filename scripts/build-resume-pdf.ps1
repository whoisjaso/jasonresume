$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$htmlPath = Join-Path $root "resume-pdf.html"
$pdfPath = Join-Path $root "assets\Jason_Obawemimo_Resume_2026.pdf"
$userDataDir = Join-Path $env:TEMP ("chrome-resume-pdf-" + [guid]::NewGuid().ToString())

$chromeCandidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)

$chrome = $chromeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $chrome) {
  throw "Chrome or Edge was not found. Install a Chromium browser or update scripts/build-resume-pdf.ps1."
}

$htmlUri = [System.Uri]::new((Resolve-Path -LiteralPath $htmlPath).Path).AbsoluteUri
New-Item -ItemType Directory -Force -Path $userDataDir | Out-Null

try {
  & $chrome `
    "--headless=new" `
    "--disable-gpu" `
    "--no-sandbox" `
    "--no-pdf-header-footer" `
    "--user-data-dir=$userDataDir" `
    "--print-to-pdf=$pdfPath" `
    $htmlUri | Out-Null
} finally {
  if (Test-Path -LiteralPath $userDataDir) {
    Remove-Item -LiteralPath $userDataDir -Recurse -Force
  }
}

if (-not (Test-Path -LiteralPath $pdfPath)) {
  throw "PDF was not created: $pdfPath"
}

Get-Item -LiteralPath $pdfPath | Select-Object FullName, Length, LastWriteTime
