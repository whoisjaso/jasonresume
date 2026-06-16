param(
  [string]$SearchEngineHost = "api.indexnow.org",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$hostName = "jasonobawemimo.com"
$key = "25250c82c435407fa759bd71fbe2b1df"
$keyLocation = "https://jasonobawemimo.com/$key.txt"
$urls = @(
  "https://jasonobawemimo.com/",
  "https://jasonobawemimo.com/credentials.html",
  "https://jasonobawemimo.com/answers.html",
  "https://jasonobawemimo.com/jason-obawemimo.html",
  "https://jasonobawemimo.com/resume-pdf.html",
  "https://jasonobawemimo.com/sitemap-index.xml",
  "https://jasonobawemimo.com/sitemap.xml",
  "https://jasonobawemimo.com/image-sitemap.xml",
  "https://jasonobawemimo.com/feed.xml",
  "https://jasonobawemimo.com/llms.txt",
  "https://jasonobawemimo.com/llms-full.txt",
  "https://jasonobawemimo.com/ai.txt",
  "https://jasonobawemimo.com/discovery.json",
  "https://jasonobawemimo.com/identity.json",
  "https://jasonobawemimo.com/jason-obawemimo.vcf",
  "https://jasonobawemimo.com/credentials.json",
  "https://jasonobawemimo.com/answers.json",
  "https://jasonobawemimo.com/.well-known/llms.txt",
  "https://jasonobawemimo.com/.well-known/ai.txt",
  "https://jasonobawemimo.com/.well-known/webfinger",
  "https://jasonobawemimo.com/.well-known/host-meta",
  "https://jasonobawemimo.com/schema.json",
  "https://jasonobawemimo.com/profile.jsonld",
  "https://jasonobawemimo.com/credentials.jsonld",
  "https://jasonobawemimo.com/faq.jsonld",
  "https://jasonobawemimo.com/opensearch.xml",
  "https://jasonobawemimo.com/assets/Jason_Obawemimo_Resume_2026.pdf",
  "https://jasonobawemimo.com/assets/Jason_Obawemimo_Anthropic_Certificates.pdf",
  "https://jasonobawemimo.com/assets/Jason_Obawemimo_Associate_Degree.pdf"
)

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

$uri = "https://$SearchEngineHost/indexnow"
Invoke-RestMethod -Uri $uri -Method Post -ContentType "application/json; charset=utf-8" -Body $json
