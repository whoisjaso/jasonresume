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

$mojibakeR = "R" + [string][char]0x00C3
$mojibakeE2 = [string][char]0x00E2
$mojibakeC2 = [string][char]0x00C2

$checks = @(
  @{ Path = "/"; Contains = "Jason Obawemimo" },
  @{ Path = "/"; Contains = "linkedin.com/in/jason-obawemimo-51a76120a" },
  @{ Path = "/"; NotContains = $mojibakeR },
  @{ Path = "/"; NotContains = $mojibakeE2 },
  @{ Path = "/"; NotContains = $mojibakeC2 },
  @{ Path = "/credentials.html"; Contains = "Dean" },
  @{ Path = "/answers.html"; Contains = "web design and workflow systems" },
  @{ Path = "/answers.html"; Contains = "jason-obawemimo-51a76120a" },
  @{ Path = "/jason-obawemimo.html"; Contains = "Official Entity Profile" },
  @{ Path = "/mentions.html"; Contains = "Public Mentions" },
  @{ Path = "/mentions.html"; Contains = "City of Pearland" },
  @{ Path = "/mentions.html"; Contains = "Friendswood-September-14-2022.pdf" },
  @{ Path = "/resume-pdf.html"; Contains = "Jason Obawemimo" },
  @{ Path = "/sitemap-index.xml"; Contains = "/image-sitemap.xml" },
  @{ Path = "/sitemap.xml"; Contains = "$BaseUrl/jason-obawemimo.html" },
  @{ Path = "/sitemap.xml"; Contains = "$BaseUrl/jason-obawemimo.md" },
  @{ Path = "/sitemap.xml"; Contains = "$BaseUrl/person.json" },
  @{ Path = "/sitemap.xml"; Contains = "$BaseUrl/mentions.html" },
  @{ Path = "/image-sitemap.xml"; Contains = "jason-headshot.png" },
  @{ Path = "/feed.xml"; Contains = "Jason Obawemimo" },
  @{ Path = "/robots.txt"; Contains = "AI-Guidance: $BaseUrl/ai.txt" },
  @{ Path = "/robots.txt"; Contains = "Entity-Markdown: $BaseUrl/jason-obawemimo.md" },
  @{ Path = "/robots.txt"; Contains = "Person-JSONLD: $BaseUrl/person.json" },
  @{ Path = "/llms.txt"; Contains = "Dean's Honor List" },
  @{ Path = "/llms.txt"; Contains = "linkedin.com/in/jason-obawemimo-51a76120a" },
  @{ Path = "/llms.txt"; Contains = "person.json" },
  @{ Path = "/llms-full.txt"; Contains = "Full AI Retrieval Context" },
  @{ Path = "/llms-full.txt"; Contains = "Public Corroboration" },
  @{ Path = "/llms-full.txt"; Contains = "jason-obawemimo.md" },
  @{ Path = "/ai.txt"; Contains = "AI Retrieval Guidance" },
  @{ Path = "/discovery.json"; Contains = "Discovery Index" },
  @{ Path = "/identity.json"; Contains = "linkedin.com/in/jason-obawemimo-51a76120a" },
  @{ Path = "/identity.json"; Contains = "mentions.html" },
  @{ Path = "/jason-obawemimo.md"; Contains = "Jason Obawemimo is a Pearland, Texas based web design and workflow systems builder" },
  @{ Path = "/jason-obawemimo.md"; Contains = "https://jasonobawemimo.com/person.json" },
  @{ Path = "/person.json"; Contains = "Web Design and Workflow Systems Builder" },
  @{ Path = "/person.json"; Contains = "github.com/whoisjaso/jasonresume" },
  @{ Path = "/jason-obawemimo.vcf"; Contains = "linkedin.com/in/jason-obawemimo-51a76120a" },
  @{ Path = "/jason-obawemimo.vcf"; Contains = "mentions.html" },
  @{ Path = "/jason-obawemimo.vcf"; Contains = "jason-obawemimo.md" },
  @{ Path = "/jason-obawemimo.vcf"; Contains = "person.json" },
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
  @{ Path = "/schema.json"; Contains = "occupation-web-design-workflow-systems-builder" },
  @{ Path = "/schema.json"; Contains = "professional inquiries" },
  @{ Path = "/schema.json"; Contains = "jason-obawemimo.md" },
  @{ Path = "/schema.json"; Contains = "person.json" },
  @{ Path = "/schema.json"; Contains = "Pearland-September-14-2022.pdf" },
  @{ Path = "/schema.json"; Contains = "Friendswood-September-14-2022.pdf" },
  @{ Path = "/profile.jsonld"; Contains = "linkedin.com/in/jason-obawemimo-51a76120a" },
  @{ Path = "/profile.jsonld"; Contains = "jason-obawemimo.md" },
  @{ Path = "/profile.jsonld"; Contains = "person.json" },
  @{ Path = "/profile.jsonld"; Contains = "Friendswood-September-14-2022.pdf" },
  @{ Path = "/profile.jsonld"; Contains = "professional inquiries" },
  @{ Path = "/discovery.json"; Contains = "Friendswood-September-14-2022.pdf" },
  @{ Path = "/discovery.json"; Contains = "occupation_description" },
  @{ Path = "/identity.json"; Contains = "Friendswood-September-14-2022.pdf" },
  @{ Path = "/identity.json"; Contains = "professional inquiries" },
  @{ Path = "/credentials.jsonld"; Contains = "linkedin.com/in/jason-obawemimo-51a76120a" },
  @{ Path = "/faq.jsonld"; Contains = "linkedin.com/in/jason-obawemimo-51a76120a" },
  @{ Path = "/opensearch.xml"; Contains = "OpenSearchDescription" },
  @{ Path = "/25250c82c435407fa759bd71fbe2b1df.txt"; Contains = "25250c82c435407fa759bd71fbe2b1df" },
  @{ Path = "/assets/Jason_Obawemimo_Resume_2026.pdf"; Contains = $null },
  @{ Path = "/assets/Jason_Obawemimo_Anthropic_Certificates.pdf"; Contains = $null },
  @{ Path = "/assets/Jason_Obawemimo_Associate_Degree.pdf"; Contains = $null }
)

$failures = @()

$canonicalHostChecks = @(
  @{ From = "https://www.jasonobawemimo.com/"; To = "https://jasonobawemimo.com/" },
  @{ From = "https://www.jasonobawemimo.com/schema.json"; To = "https://jasonobawemimo.com/schema.json" },
  @{ From = "https://www.jasonobawemimo.com/credentials.html"; To = "https://jasonobawemimo.com/credentials.html" },
  @{ From = "https://jasonresume.vercel.app/"; To = "https://jasonobawemimo.com/" },
  @{ From = "https://jasonresume.vercel.app/schema.json"; To = "https://jasonobawemimo.com/schema.json" },
  @{ From = "https://jasonresume.vercel.app/credentials.html"; To = "https://jasonobawemimo.com/credentials.html" }
)

foreach ($hostCheck in $canonicalHostChecks) {
  $response = $null
  try {
    $response = Invoke-WebRequest -Uri $hostCheck.From -Method Head -MaximumRedirection 0 -TimeoutSec 30
  } catch {
    $response = $_.Exception.Response
    if (-not $response) {
      $failures += "$($hostCheck.From) failed: $($_.Exception.Message)"
      continue
    }
  }

  $location = [string]$response.Headers["Location"]
  if ([int]$response.StatusCode -ne 308 -or $location -ne $hostCheck.To) {
    $failures += "$($hostCheck.From) expected 308 to $($hostCheck.To), got $([int]$response.StatusCode) to $location"
    continue
  }

  Write-Host "OK $($hostCheck.From) redirects to $location"
}

foreach ($check in $checks) {
  $url = "$BaseUrl$($check.Path)"
  $containsMarker = $check["Contains"]
  $notContainsMarker = $check["NotContains"]
  try {
    if ($containsMarker -or $notContainsMarker) {
      $response = Invoke-WebRequest -Uri $url -Method Get -MaximumRedirection 5 -TimeoutSec 30
      if ($response.StatusCode -ne 200) {
        $failures += "$url returned $($response.StatusCode)"
        continue
      }
      $content = Get-ResponseText $response
      if ($containsMarker -and -not ($content -like "*$containsMarker*")) {
        $failures += "$url missing marker: $containsMarker"
        continue
      }
      if ($notContainsMarker -and ($content -like "*$notContainsMarker*")) {
        $failures += "$url contains forbidden marker: $notContainsMarker"
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
