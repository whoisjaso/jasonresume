param(
  [string]$Endpoint = "https://api.indexnow.org/indexnow",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$hostName = "jasonobawemimo.com"
$key = "25250c82c435407fa759bd71fbe2b1df"
$keyLocation = "https://jasonobawemimo.com/$key.txt"

[xml]$sitemap = Get-Content -Path "sitemap.xml" -Raw
$sitemapUrls = @($sitemap.urlset.url | ForEach-Object { [string]$_.loc } | Where-Object { $_ })
$extraUrls = @(
  "https://jasonobawemimo.com/sitemap-index.xml",
  "https://jasonobawemimo.com/sitemap.xml",
  "https://jasonobawemimo.com/image-sitemap.xml",
  "https://jasonobawemimo.com/robots.txt",
  "https://jasonobawemimo.com/site.webmanifest",
  "https://jasonobawemimo.com/$key.txt"
)
$urls = @($sitemapUrls + $extraUrls | Sort-Object -Unique)

$payload = @{
  host = $hostName
  key = $key
  keyLocation = $keyLocation
  urlList = $urls
}

$json = $payload | ConvertTo-Json -Depth 4

if ($DryRun) {
  $json
  return
}

Write-Host "Submitting $($urls.Count) URLs to IndexNow endpoint: $Endpoint"

try {
  $response = Invoke-WebRequest -Uri $Endpoint -Method Post -ContentType "application/json; charset=utf-8" -Body $json -TimeoutSec 30
  Write-Host "IndexNow status: $($response.StatusCode) $($response.StatusDescription)"
  if ($response.Content) {
    Write-Host "IndexNow response: $($response.Content)"
  }
} catch {
  if ($_.Exception.Response) {
    $statusCode = [int]$_.Exception.Response.StatusCode
    $statusDescription = $_.Exception.Response.StatusDescription
    throw "IndexNow submission failed: $statusCode $statusDescription"
  }

  throw
}
