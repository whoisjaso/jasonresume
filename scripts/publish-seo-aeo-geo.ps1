param(
  [string]$CommitMessage = "Optimize search and AI discovery metadata",
  [switch]$SkipIndexNow,
  [switch]$ValidateOnly
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Validating local SEO/AEO/GEO files..."
$validationScript = @'
const fs = require('fs');
const linkedInUrl = 'https://www.linkedin.com/in/jason-obawemimo-51a76120a/';
const publicSourceUrls = [
  'https://documents.pearlandtx.gov/WebLink/DocView.aspx?dbid=0&id=1827555&repo=City-Of-Pearland',
  'https://myreporternews.com/wp-content/uploads/2023/08/Pearland-September-14-2022.pdf',
  'https://myreporternews.com/wp-content/uploads/2023/08/Friendswood-September-14-2022.pdf'
];
const mojibakeMarkers = [
  String.fromCodePoint(0x00c3),
  String.fromCodePoint(0x00c2),
  String.fromCodePoint(0x00e2)
];
const htmlFiles = ['index.html', 'credentials.html', 'answers.html', 'resume-pdf.html', 'jason-obawemimo.html', 'mentions.html'];
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  for (const [, json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(json);
  if (!html.includes('/schema.json')) throw new Error(`${file} missing schema.json link`);
  if (!html.includes('https://github.com/whoisjaso')) throw new Error(`${file} missing GitHub rel=me identity link`);
  if (!html.includes(linkedInUrl)) throw new Error(`${file} missing LinkedIn rel=me identity link`);
  if (!html.includes('/profile.jsonld')) throw new Error(`${file} missing profile.jsonld link`);
  if (!html.includes('/sitemap-index.xml')) throw new Error(`${file} missing sitemap-index.xml link`);
  if (!html.includes('/image-sitemap.xml')) throw new Error(`${file} missing image-sitemap.xml link`);
  if (!html.includes('/feed.xml')) throw new Error(`${file} missing feed.xml link`);
  if (!html.includes('/llms.txt')) throw new Error(`${file} missing llms.txt link`);
  if (!html.includes('/llms-full.txt')) throw new Error(`${file} missing llms-full.txt link`);
  if (!html.includes('/ai.txt')) throw new Error(`${file} missing ai.txt link`);
  if (!html.includes('/discovery.json')) throw new Error(`${file} missing discovery.json link`);
  if (!html.includes('/identity.json')) throw new Error(`${file} missing identity.json link`);
  if (!html.includes('/credentials.json')) throw new Error(`${file} missing credentials.json link`);
  if (!html.includes('/answers.json')) throw new Error(`${file} missing answers.json link`);
  if (!html.includes('/jason-obawemimo.vcf')) throw new Error(`${file} missing vCard link`);
  if (!html.includes('/site.webmanifest')) throw new Error(`${file} missing site.webmanifest link`);
  if (!html.includes('/.well-known/webfinger')) throw new Error(`${file} missing WebFinger link`);
  if (!html.includes('/.well-known/host-meta')) throw new Error(`${file} missing host-meta link`);
  if (!html.includes('/opensearch.xml')) throw new Error(`${file} missing opensearch.xml link`);
  if (!html.includes('/credentials.jsonld')) throw new Error(`${file} missing credentials.jsonld link`);
  if (!html.includes('/faq.jsonld')) throw new Error(`${file} missing faq.jsonld link`);
}
const crawlableTextFiles = [
  ...htmlFiles,
  'schema.json',
  'profile.jsonld',
  'credentials.jsonld',
  'faq.jsonld',
  'discovery.json',
  'identity.json',
  'credentials.json',
  'answers.json',
  'llms.txt',
  'llms-full.txt',
  'ai.txt',
  '.well-known/ai.txt',
  '.well-known/llms.txt',
  '.well-known/webfinger',
  '.well-known/host-meta',
  'humans.txt',
  'robots.txt',
  'feed.xml',
  'sitemap.xml',
  'opensearch.xml'
];
for (const file of crawlableTextFiles) {
  const body = fs.readFileSync(file, 'utf8');
  for (const marker of mojibakeMarkers) {
    if (body.includes(marker)) throw new Error(`${file} contains mojibake marker ${marker}`);
  }
}
const schema = JSON.parse(fs.readFileSync('schema.json', 'utf8'));
const profile = JSON.parse(fs.readFileSync('profile.jsonld', 'utf8'));
const credentialGraph = JSON.parse(fs.readFileSync('credentials.jsonld', 'utf8'));
const faqGraph = JSON.parse(fs.readFileSync('faq.jsonld', 'utf8'));
const discovery = JSON.parse(fs.readFileSync('discovery.json', 'utf8'));
const identity = JSON.parse(fs.readFileSync('identity.json', 'utf8'));
const credentials = JSON.parse(fs.readFileSync('credentials.json', 'utf8'));
const answers = JSON.parse(fs.readFileSync('answers.json', 'utf8'));
const webfinger = JSON.parse(fs.readFileSync('.well-known/webfinger', 'utf8'));
JSON.parse(fs.readFileSync('site.webmanifest', 'utf8'));
const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('site.webmanifest', 'utf8'));
if (!Array.isArray(vercelConfig.redirects) || !vercelConfig.redirects.some(rule =>
  rule.source === '/' &&
  rule.destination === 'https://jasonobawemimo.com/' &&
  rule.permanent === true &&
  Array.isArray(rule.has) &&
  rule.has.some(condition => condition.type === 'header' && condition.key === 'host' && condition.value === 'www.jasonobawemimo.com')
) || !vercelConfig.redirects.some(rule =>
  rule.source === '/:path*' &&
  rule.destination === 'https://jasonobawemimo.com/:path*' &&
  rule.permanent === true &&
  Array.isArray(rule.has) &&
  rule.has.some(condition => condition.type === 'header' && condition.key === 'host' && condition.value === 'www.jasonobawemimo.com')
)) throw new Error('vercel.json missing www-to-apex canonical redirect');
if (!JSON.stringify(manifest).includes('/jason-obawemimo.html') || !JSON.stringify(manifest).includes('/llms-full.txt')) throw new Error('site.webmanifest missing profile or AI context shortcut');
if (!fs.readFileSync('feed.xml', 'utf8').includes('Jason Obawemimo')) throw new Error('feed.xml missing Jason Obawemimo');
if (!fs.readFileSync('ai.txt', 'utf8').includes('Jason Obawemimo')) throw new Error('ai.txt missing Jason Obawemimo');
if (!fs.readFileSync('ai.txt', 'utf8').includes(linkedInUrl)) throw new Error('ai.txt missing LinkedIn profile');
if (!fs.readFileSync('.well-known/ai.txt', 'utf8').includes('Jason Obawemimo')) throw new Error('.well-known/ai.txt missing Jason Obawemimo');
if (!fs.readFileSync('.well-known/ai.txt', 'utf8').includes(linkedInUrl)) throw new Error('.well-known/ai.txt missing LinkedIn profile');
if (!fs.readFileSync('.well-known/llms.txt', 'utf8').includes('Jason Obawemimo')) throw new Error('.well-known/llms.txt missing Jason Obawemimo');
if (!fs.readFileSync('.well-known/llms.txt', 'utf8').includes(linkedInUrl)) throw new Error('.well-known/llms.txt missing LinkedIn profile');
const credential = schema['@graph'].find(node => node['@id'] === 'https://jasonobawemimo.com/#credential-anthropic');
const person = schema['@graph'].find(node => node['@id'] === 'https://jasonobawemimo.com/#jason-obawemimo');
const occupation = schema['@graph'].find(node => node['@id'] === 'https://jasonobawemimo.com/#occupation-web-design-workflow-systems-builder');
const sitemap = fs.readFileSync('sitemap.xml', 'utf8');
const sitemapIndex = fs.readFileSync('sitemap-index.xml', 'utf8');
const imageSitemap = fs.readFileSync('image-sitemap.xml', 'utf8');
const robots = fs.readFileSync('robots.txt', 'utf8');
const hostMeta = fs.readFileSync('.well-known/host-meta', 'utf8');
const vcard = fs.readFileSync('jason-obawemimo.vcf', 'utf8');
if (!credential || credential.about.length !== 19) throw new Error('Expected 19 Anthropic courses in schema.json');
if (!person || person.hasOccupation?.['@id'] !== 'https://jasonobawemimo.com/#occupation-web-design-workflow-systems-builder') throw new Error('schema.json missing canonical occupation link');
if (!person.contactPoint || person.contactPoint.email !== 'jobawems@gmail.com') throw new Error('schema.json missing professional contact point');
if (!Array.isArray(person.knowsLanguage) || !person.knowsLanguage.includes('English')) throw new Error('schema.json missing knowsLanguage English');
if (!occupation || occupation.name !== 'Web Design and Workflow Systems Builder' || !JSON.stringify(occupation).includes('Model Context Protocol')) throw new Error('schema.json missing occupation node');
if (profile['@id'] !== 'https://jasonobawemimo.com/#jason-obawemimo') throw new Error('profile.jsonld missing canonical Person @id');
if (!profile.hasOccupation || profile.hasOccupation.name !== 'Web Design and Workflow Systems Builder') throw new Error('profile.jsonld missing occupation');
if (!profile.contactPoint || profile.contactPoint.email !== 'jobawems@gmail.com') throw new Error('profile.jsonld missing contact point');
const courseList = credentialGraph['@graph'].find(node => node['@id'] === 'https://jasonobawemimo.com/#anthropic-course-list');
if (!courseList || courseList.numberOfItems !== 19 || courseList.itemListElement.length !== 19) throw new Error('credentials.jsonld missing 19 course ItemList');
if (faqGraph['@type'] !== 'FAQPage' || faqGraph.mainEntity.length !== 7) throw new Error('faq.jsonld missing 7 FAQ answers');
if (discovery.entity.name !== 'Jason Obawemimo') throw new Error('discovery.json missing Jason Obawemimo name');
if (discovery.entity.occupation !== 'Web Design and Workflow Systems Builder' || !discovery.preferred_positioning.occupation_description) throw new Error('discovery.json missing occupation description');
if (identity.name !== 'Jason Obawemimo') throw new Error('identity.json missing Jason Obawemimo name');
if (!identity.occupation || identity.occupation.name !== 'Web Design and Workflow Systems Builder') throw new Error('identity.json missing occupation');
if (!identity.contact || identity.contact.contact_type !== 'professional inquiries') throw new Error('identity.json missing professional contact type');
if (credentials.anthropic_course_completion_portfolio.course_count !== 19) throw new Error('credentials.json missing 19 Anthropic courses');
if (!credentials.education || !/Dean/.test(credentials.education.honor)) throw new Error('credentials.json missing Dean honor');
if (!Array.isArray(answers.answers) || answers.answers.length < 7) throw new Error('answers.json missing verified answers');
if (webfinger.subject !== 'acct:jobawems@jasonobawemimo.com') throw new Error('WebFinger subject mismatch');
if (!webfinger.links.some(link => link.rel === 'me' && link.href === linkedInUrl)) throw new Error('WebFinger missing LinkedIn rel=me');
if (!webfinger.links.some(link => link.rel === 'me' && link.href === 'https://github.com/whoisjaso')) throw new Error('WebFinger missing GitHub rel=me');
if (!hostMeta.includes('rel=' + String.fromCharCode(34) + 'me' + String.fromCharCode(34)) || !hostMeta.includes(linkedInUrl) || !hostMeta.includes('https://github.com/whoisjaso')) throw new Error('host-meta missing rel=me identity links');
if (!vcard.includes('FN:Jason Obawemimo') || !vcard.includes('URL:https://jasonobawemimo.com/')) throw new Error('vCard missing canonical identity');
if (!vcard.includes(linkedInUrl)) throw new Error('vCard missing LinkedIn profile');
if (!vcard.includes('https://jasonobawemimo.com/mentions.html')) throw new Error('vCard missing public mentions page');
if (!JSON.stringify(schema).includes('https://github.com/whoisjaso')) throw new Error('schema.json missing GitHub sameAs identity link');
if (!JSON.stringify(profile).includes('https://github.com/whoisjaso')) throw new Error('profile.jsonld missing GitHub sameAs identity link');
if (!JSON.stringify(identity).includes('https://github.com/whoisjaso')) throw new Error('identity.json missing GitHub sameAs identity link');
for (const [name, value] of Object.entries({ schema, profile, credentialGraph, faqGraph, discovery, identity, credentials, answers, webfinger })) {
  if (!JSON.stringify(value).includes(linkedInUrl)) throw new Error(`${name} missing LinkedIn identity link`);
}
for (const sourceUrl of publicSourceUrls) {
  if (!fs.readFileSync('mentions.html', 'utf8').includes(sourceUrl)) throw new Error(`mentions.html missing public source ${sourceUrl}`);
  for (const [name, value] of Object.entries({ schema, profile, discovery, identity })) {
    if (!JSON.stringify(value).includes(sourceUrl)) throw new Error(`${name} missing public source ${sourceUrl}`);
  }
}
if (!schema['@graph'].some(node => node['@type'] === 'ImageObject' && node['@id'] === 'https://jasonobawemimo.com/#headshot')) throw new Error('schema.json missing headshot ImageObject');
if ([...sitemap.matchAll(/<loc>/g)].length !== 28) throw new Error('Expected 28 sitemap URLs');
if ([...sitemapIndex.matchAll(/<loc>/g)].length !== 2) throw new Error('Expected 2 sitemap-index URLs');
if (!sitemapIndex.includes('https://jasonobawemimo.com/image-sitemap.xml')) throw new Error('sitemap-index.xml missing image sitemap');
if (!imageSitemap.includes('https://jasonobawemimo.com/assets/jason-headshot.png')) throw new Error('image-sitemap.xml missing headshot');
for (const requiredUrl of ['/jason-obawemimo.html', '/mentions.html', '/llms-full.txt', '/profile.jsonld', '/credentials.jsonld', '/faq.jsonld', '/opensearch.xml', '/feed.xml', '/ai.txt', '/discovery.json', '/identity.json', '/credentials.json', '/answers.json', '/.well-known/llms.txt', '/.well-known/ai.txt', '/.well-known/webfinger', '/.well-known/host-meta']) {
  if (!sitemap.includes(`https://jasonobawemimo.com${requiredUrl}`)) throw new Error(`sitemap.xml missing ${requiredUrl}`);
}
if (!robots.includes('Sitemap: https://jasonobawemimo.com/sitemap-index.xml')) throw new Error('robots.txt missing sitemap-index.xml reference');
if (!robots.includes('Sitemap: https://jasonobawemimo.com/image-sitemap.xml')) throw new Error('robots.txt missing image-sitemap.xml reference');
if (!robots.includes('Sitemap: https://jasonobawemimo.com/feed.xml')) throw new Error('robots.txt missing feed.xml sitemap reference');
if (!robots.includes('AI-Guidance: https://jasonobawemimo.com/ai.txt')) throw new Error('robots.txt missing AI guidance reference');
if (!robots.includes('Discovery: https://jasonobawemimo.com/discovery.json')) throw new Error('robots.txt missing discovery.json reference');
if (!robots.includes('Identity: https://jasonobawemimo.com/identity.json')) throw new Error('robots.txt missing identity.json reference');
if (!robots.includes('Credentials: https://jasonobawemimo.com/credentials.json')) throw new Error('robots.txt missing credentials.json reference');
if (!robots.includes('Credentials-JSONLD: https://jasonobawemimo.com/credentials.jsonld')) throw new Error('robots.txt missing credentials.jsonld reference');
if (!robots.includes('Answers: https://jasonobawemimo.com/answers.json')) throw new Error('robots.txt missing answers.json reference');
if (!robots.includes('FAQ-JSONLD: https://jasonobawemimo.com/faq.jsonld')) throw new Error('robots.txt missing faq.jsonld reference');
if (!robots.includes('WebFinger: https://jasonobawemimo.com/.well-known/webfinger')) throw new Error('robots.txt missing WebFinger reference');
if (!robots.includes('Host-Meta: https://jasonobawemimo.com/.well-known/host-meta')) throw new Error('robots.txt missing host-meta reference');
for (const crawler of ['OAI-SearchBot', 'GPTBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'Googlebot-Image', 'GoogleOther', 'Applebot', 'Applebot-Extended', 'Bingbot', 'DuckDuckBot']) {
  if (!robots.includes(`User-agent: ${crawler}`)) throw new Error(`robots.txt missing ${crawler}`);
}
if (['index.html','credentials.html','answers.html','resume-pdf.html','jason-obawemimo.html','mentions.html','sitemap.xml','sitemap-index.xml','image-sitemap.xml','llms.txt','llms-full.txt','ai.txt','discovery.json','identity.json','jason-obawemimo.vcf','credentials.json','credentials.jsonld','faq.jsonld','answers.json','.well-known/ai.txt','.well-known/llms.txt','.well-known/webfinger','.well-known/host-meta','humans.txt','SEARCH_SUBMISSION_CHECKLIST.md','README.md','PUBLISH_NOW.md','feed.xml'].some(file => fs.readFileSync(file, 'utf8').includes('jason-obawemimo-og.png'))) {
  throw new Error('Generated social PNG is still referenced');
}
console.log('Validation passed');
'@
node -e $validationScript
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) { throw "local SEO/AEO/GEO validation failed with exit code $exitCode" }

$indexNowDryRun = powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\submit-indexnow.ps1 -DryRun
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) { throw "IndexNow dry-run failed with exit code $exitCode" }
$indexNowPayload = ($indexNowDryRun | Out-String) | ConvertFrom-Json
if ($indexNowPayload.urlList.Count -lt 34) { throw "IndexNow dry-run has too few URLs" }
if ($indexNowPayload.urlList -notcontains "https://jasonobawemimo.com/mentions.html") { throw "IndexNow dry-run missing public mentions page" }
foreach ($requiredIndexNowUrl in @("https://jasonobawemimo.com/robots.txt", "https://jasonobawemimo.com/site.webmanifest", "https://jasonobawemimo.com/25250c82c435407fa759bd71fbe2b1df.txt")) {
  if ($indexNowPayload.urlList -notcontains $requiredIndexNowUrl) { throw "IndexNow dry-run missing $requiredIndexNowUrl" }
}

if ($ValidateOnly) {
  Write-Host "Validation-only complete."
  return
}

$files = @(
  "index.html",
  "resume-pdf.html",
  "robots.txt",
  "site.css",
  "sitemap.xml",
  "sitemap-index.xml",
  "image-sitemap.xml",
  "feed.xml",
  "vercel.json",
  "README.md",
  "PUBLISH_NOW.md",
  "CITATION.cff",
  "ai.txt",
  "discovery.json",
  "identity.json",
  "jason-obawemimo.vcf",
  "credentials.json",
  "credentials.jsonld",
  "faq.jsonld",
  "answers.json",
  "jason-obawemimo.html",
  "mentions.html",
  "answers.html",
  "credentials.html",
  "schema.json",
  "profile.jsonld",
  "llms.txt",
  "llms-full.txt",
  "opensearch.xml",
  ".well-known/ai.txt",
  ".well-known/llms.txt",
  ".well-known/webfinger",
  ".well-known/host-meta",
  "site.webmanifest",
  "humans.txt",
  "browserconfig.xml",
  "SEARCH_SUBMISSION_CHECKLIST.md",
  "scripts/submit-indexnow.ps1",
  "scripts/verify-live-seo-aeo-geo.ps1",
  "scripts/publish-seo-aeo-geo.ps1",
  "25250c82c435407fa759bd71fbe2b1df.txt"
)

Write-Host "Staging intended files..."
git add -- $files
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) { throw "git add failed with exit code $exitCode" }

git diff --cached --check
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) { throw "git diff --cached --check failed with exit code $exitCode" }

git diff --cached --quiet
$diffExitCode = $LASTEXITCODE
if ($diffExitCode -eq 1) {
  Write-Host "Creating commit..."
  git commit -m $CommitMessage
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) { throw "git commit failed with exit code $exitCode" }
} elseif ($diffExitCode -eq 0) {
  Write-Host "No staged changes to commit."
} else {
  throw "git diff --cached --quiet failed with exit code $diffExitCode"
}

Write-Host "Pushing main..."
git push origin main
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) { throw "git push failed with exit code $exitCode" }

$urls = @(
  "https://jasonobawemimo.com/",
  "https://jasonobawemimo.com/credentials.html",
  "https://jasonobawemimo.com/answers.html",
  "https://jasonobawemimo.com/jason-obawemimo.html",
  "https://jasonobawemimo.com/mentions.html",
  "https://jasonobawemimo.com/resume-pdf.html",
  "https://jasonobawemimo.com/sitemap.xml",
  "https://jasonobawemimo.com/sitemap-index.xml",
  "https://jasonobawemimo.com/image-sitemap.xml",
  "https://jasonobawemimo.com/feed.xml",
  "https://jasonobawemimo.com/robots.txt",
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
  "https://jasonobawemimo.com/humans.txt",
  "https://jasonobawemimo.com/schema.json",
  "https://jasonobawemimo.com/profile.jsonld",
  "https://jasonobawemimo.com/credentials.jsonld",
  "https://jasonobawemimo.com/faq.jsonld",
  "https://jasonobawemimo.com/opensearch.xml",
  "https://jasonobawemimo.com/25250c82c435407fa759bd71fbe2b1df.txt"
)

Write-Host "Polling live deployment..."
$deadline = (Get-Date).AddMinutes(8)
$remaining = [System.Collections.Generic.HashSet[string]]::new([string[]]$urls)
while ($remaining.Count -gt 0 -and (Get-Date) -lt $deadline) {
  foreach ($url in @($remaining)) {
    try {
      $response = Invoke-WebRequest -Uri $url -Method Head -MaximumRedirection 5 -TimeoutSec 30
      if ($response.StatusCode -eq 200) {
        Write-Host "200 $url"
        [void]$remaining.Remove($url)
      }
    } catch {
      Write-Host "Waiting for $url"
    }
  }
  if ($remaining.Count -gt 0) { Start-Sleep -Seconds 10 }
}

if ($remaining.Count -gt 0) {
  throw "Timed out waiting for live URLs: $($remaining -join ', ')"
}

if (-not $SkipIndexNow) {
  Write-Host "Submitting IndexNow URL set..."
  powershell -ExecutionPolicy Bypass -File .\scripts\submit-indexnow.ps1
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) { throw "IndexNow submission failed with exit code $exitCode" }
}

Write-Host "Running live SEO/AEO/GEO verification..."
powershell -ExecutionPolicy Bypass -File .\scripts\verify-live-seo-aeo-geo.ps1
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) { throw "Live SEO/AEO/GEO verification failed with exit code $exitCode" }

Write-Host "Published and verified."
