param(
  [string]$BaseUrl = "https://jasonobawemimo.com"
)

$ErrorActionPreference = "Stop"

function Get-ResponseText {
  param($Response)

  if ($Response.Content -is [byte[]]) {
    return [System.Text.Encoding]::UTF8.GetString($Response.Content)
  }

  return [string]$Response.Content
}

$checks = @(
  @{ Path = "/"; Contains = "Jason Obawemimo" },
  @{ Path = "/"; Contains = "linkedin.com/in/jason-obawemimo-51a76120a" },
  @{ Path = "/credentials.html"; Contains = "Dean" },
  @{ Path = "/answers.html"; Contains = "web design and workflow systems" },
  @{ Path = "/answers.html"; Contains = "jason-obawemimo-51a76120a" },
  @{ Path = "/jason-obawemimo.html"; Contains = "Official Entity Profile" },
  @{ Path = "/resume-pdf.html"; Contains = "Jason Obawemimo" },
  @{ Path = "/sitemap-index.xml"; Contains = "/image-sitemap.xml" },
  @{ Path = "/sitemap.xml"; Contains = "$BaseUrl/jason-obawemimo.html" },
  @{ Path = "/image-sitemap.xml"; Contains = "jason-headshot.png" },
  @{ Path = "/feed.xml"; Contains = "Jason Obawemimo" },
  @{ Path = "/robots.txt"; Contains = "AI-Guidance: $BaseUrl/ai.txt" },
  @{ Path = "/llms.txt"; Contains = "Dean's Honor List" },
  @{ Path = "/llms.txt"; Contains = "linkedin.com/in/jason-obawemimo-51a76120a" },
  @{ Path = "/llms-full.txt"; Contains = "Full AI Retrieval Context" },
  @{ Path = "/ai.txt"; Contains = "AI Retrieval Guidance" },
  @{ Path = "/discovery.json"; Contains = "Discovery Index" },
  @{ Path = "/identity.json"; Contains = "linkedin.com/in/jason-obawemimo-51a76120a" },
  @{ Path = "/jason-obawemimo.vcf"; Contains = "linkedin.com/in/jason-obawemimo-51a76120a" },
  @{ Path = "/credentials.json"; Contains = "Dean's Honor List" },
  @{ Path = "/answers.json"; Contains = "Verified Answers" },
  @{ Path = "/.well-known/llms.txt"; Contains = "Jason Obawemimo LLM Context" },
  @{ Path = "/.well-known/ai.txt"; Contains = "AI Retrieval Guidance" },
  @{ Path = "/.well-known/webfinger"; Contains = "linkedin.com/in/jason-obawemimo-51a76120a" },
  @{ Path = "/.well-known/host-meta"; Contains = "jasonobawemimo.com/.well-known/webfinger" },
  @{ Path = "/.well-known/host-meta"; Contains = "linkedin.com/in/jason-obawemimo-51a76120a" },
  @{ Path = "/humans.txt"; Contains = "Web Design and Workflow Systems Builder" },
  @{ Path = "/schema.json"; Contains = "SearchAction" },
  @{ Path = "/schema.json"; Contains = "jason-obawemimo-51a76120a" },
  @{ Path = "/profile.jsonld"; Contains = "linkedin.com/in/jason-obawemimo-51a76120a" },
  @{ Path = "/credentials.jsonld"; Contains = "linkedin.com/in/jason-obawemimo-51a76120a" },
  @{ Path = "/faq.jsonld"; Contains = "linkedin.com/in/jason-obawemimo-51a76120a" },
  @{ Path = "/opensearch.xml"; Contains = "OpenSearchDescription" },
  @{ Path = "/25250c82c435407fa759bd71fbe2b1df.txt"; Contains = "25250c82c435407fa759bd71fbe2b1df" },
  @{ Path = "/assets/Jason_Obawemimo_Resume_2026.pdf"; Contains = $null },
  @{ Path = "/assets/Jason_Obawemimo_Anthropic_Certificates.pdf"; Contains = $null },
  @{ Path = "/assets/Jason_Obawemimo_Associate_Degree.pdf"; Contains = $null }
)

$failures = @()

foreach ($check in $checks) {
  $url = "$BaseUrl$($check.Path)"
  try {
    if ($check.Contains) {
      $response = Invoke-WebRequest -Uri $url -Method Get -MaximumRedirection 5 -TimeoutSec 30
      if ($response.StatusCode -ne 200) {
        $failures += "$url returned $($response.StatusCode)"
        continue
      }
      $content = Get-ResponseText $response
      if (-not ($content -like "*$($check.Contains)*")) {
        $failures += "$url missing marker: $($check.Contains)"
        continue
      }
    } else {
      $response = Invoke-WebRequest -Uri $url -Method Head -MaximumRedirection 5 -TimeoutSec 30
      if ($response.StatusCode -ne 200) {
        $failures += "$url returned $($response.StatusCode)"
        continue
      }
    }
    Write-Host "OK $url"
  } catch {
    $failures += "$url failed: $($_.Exception.Message)"
  }
}

if ($failures.Count -gt 0) {
  $failures | ForEach-Object { Write-Host "FAIL $_" }
  throw "Live verification failed for $($failures.Count) URL(s)."
}

Write-Host "Live SEO/AEO/GEO verification passed."
