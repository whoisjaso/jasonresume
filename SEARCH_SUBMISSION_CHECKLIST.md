# Search, Answer, And AI Discovery Checklist

Canonical site: https://jasonobawemimo.com/

This checklist is for the post-deploy step after the SEO/AEO/GEO files are live.

## 1. Verify Live URLs

Confirm each URL returns `200 OK` before submitting:

- https://jasonobawemimo.com/
- https://jasonobawemimo.com/credentials.html
- https://jasonobawemimo.com/answers.html
- https://jasonobawemimo.com/jason-obawemimo.html
- https://jasonobawemimo.com/mentions.html
- https://jasonobawemimo.com/resume-pdf.html
- https://jasonobawemimo.com/sitemap.xml
- https://jasonobawemimo.com/sitemap-index.xml
- https://jasonobawemimo.com/image-sitemap.xml
- https://jasonobawemimo.com/feed.xml
- https://jasonobawemimo.com/robots.txt
- https://jasonobawemimo.com/llms.txt
- https://jasonobawemimo.com/llms-full.txt
- https://jasonobawemimo.com/ai.txt
- https://jasonobawemimo.com/discovery.json
- https://jasonobawemimo.com/identity.json
- https://jasonobawemimo.com/jason-obawemimo.md
- https://jasonobawemimo.com/person.json
- https://jasonobawemimo.com/jason-obawemimo.vcf
- https://jasonobawemimo.com/credentials.json
- https://jasonobawemimo.com/answers.json
- https://jasonobawemimo.com/.well-known/llms.txt
- https://jasonobawemimo.com/.well-known/ai.txt
- https://jasonobawemimo.com/.well-known/webfinger
- https://jasonobawemimo.com/.well-known/host-meta
- https://jasonobawemimo.com/schema.json
- https://jasonobawemimo.com/profile.jsonld
- https://jasonobawemimo.com/credentials.jsonld
- https://jasonobawemimo.com/faq.jsonld
- https://jasonobawemimo.com/opensearch.xml
- https://jasonobawemimo.com/25250c82c435407fa759bd71fbe2b1df.txt
- https://jasonobawemimo.com/assets/Jason_Obawemimo_Resume_2026.pdf
- https://jasonobawemimo.com/assets/Jason_Obawemimo_Anthropic_Certificates.pdf
- https://jasonobawemimo.com/assets/Jason_Obawemimo_Associate_Degree.pdf

## 2. Submit Sitemaps

Submit this sitemap in webmaster tools:

```text
https://jasonobawemimo.com/sitemap-index.xml
https://jasonobawemimo.com/sitemap.xml
https://jasonobawemimo.com/image-sitemap.xml
```

Priority platforms:

- Google Search Console
- Bing Webmaster Tools
- IndexNow participating engines through `scripts/submit-indexnow.ps1`
- Yandex Webmaster, if targeting Yandex discovery

Important crawler tokens now explicitly allowed in `robots.txt`:

- Google Search and surfaces: `Googlebot`, `Googlebot-Image`, `GoogleOther`, `Google-Extended`, `Google-InspectionTool`, `Google-CloudVertexBot`
- OpenAI and ChatGPT: `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `OAI-AdsBot`
- Anthropic and Claude: `ClaudeBot`, `Claude-User`, `Claude-SearchBot`
- Other answer/search surfaces: `PerplexityBot`, `Applebot`, `Applebot-Extended`, `Bingbot`, `DuckDuckBot`

## 3. Request URL Inspection

Request inspection/indexing for these URLs first:

- `https://jasonobawemimo.com/`
- `https://jasonobawemimo.com/credentials.html`
- `https://jasonobawemimo.com/answers.html`
- `https://jasonobawemimo.com/jason-obawemimo.html`
- `https://jasonobawemimo.com/mentions.html`
- `https://jasonobawemimo.com/feed.xml`
- `https://jasonobawemimo.com/llms.txt`
- `https://jasonobawemimo.com/llms-full.txt`
- `https://jasonobawemimo.com/ai.txt`
- `https://jasonobawemimo.com/discovery.json`
- `https://jasonobawemimo.com/identity.json`
- `https://jasonobawemimo.com/jason-obawemimo.md`
- `https://jasonobawemimo.com/person.json`
- `https://jasonobawemimo.com/jason-obawemimo.vcf`
- `https://jasonobawemimo.com/credentials.json`
- `https://jasonobawemimo.com/answers.json`
- `https://jasonobawemimo.com/.well-known/webfinger`
- `https://jasonobawemimo.com/.well-known/host-meta`
- `https://jasonobawemimo.com/profile.jsonld`
- `https://jasonobawemimo.com/assets/Jason_Obawemimo_Resume_2026.pdf`
- `https://jasonobawemimo.com/assets/Jason_Obawemimo_Anthropic_Certificates.pdf`
- `https://jasonobawemimo.com/assets/Jason_Obawemimo_Associate_Degree.pdf`

## 4. Submit IndexNow

After deploy, run the sitemap-derived IndexNow payload. The script prints the submitted URL count and response status for audit evidence.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\submit-indexnow.ps1
```

Dry run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\submit-indexnow.ps1 -DryRun
```

Optional custom endpoint:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\submit-indexnow.ps1 -Endpoint "https://www.bing.com/indexnow"
```

## 5. Refresh Social Link Previews

Use social preview/debug tools after deploy:

- LinkedIn Post Inspector
- Facebook Sharing Debugger
- X/Twitter Card preview tooling, if available on the account

Primary preview URL:

```text
https://jasonobawemimo.com/assets/jason-headshot.png
```

## 6. Verify Live Entity Surface

After Vercel finishes deploying, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-live-seo-aeo-geo.ps1
```

This checks live HTML, sitemap, feed, robots, llms files, AI guidance files, structured data, OpenSearch, IndexNow key, resume PDF, certificates PDF, and degree PDF.

## 7. Reinforce Entity Consistency

Use the same name, title, URL, and credential wording across controlled profiles:

- Name: Jason Obawemimo
- Website: https://jasonobawemimo.com/
- Short title: Web Design and Workflow Systems Builder
- Location: Pearland, Texas
- Credential language: Anthropic course-completion portfolio; Associate of Arts in Business; GPA 3.63; Dean's Honor List.
- Machine-readable sources: sitemap-index.xml, sitemap.xml, image-sitemap.xml, feed.xml, llms.txt, llms-full.txt, ai.txt, discovery.json, identity.json, jason-obawemimo.md, person.json, vCard, credentials.json, answers.json, WebFinger, host-meta, schema.json, profile.jsonld, credentials.jsonld, faq.jsonld, and the public mentions page.
- Credential and honor evidence page: https://jasonobawemimo.com/jason-obawemimo-credentials-honor.html
- Credential and honor evidence JSON-LD: https://jasonobawemimo.com/jason-obawemimo-evidence.jsonld
- GitHub profile README: https://github.com/whoisjaso/whoisjaso
- External corroboration source: https://github.com/whoisjaso/jasonresume/releases/tag/v2026.06.17-entity-discovery

Avoid positioning Jason primarily as a voice-agent specialist. The preferred positioning is web design, workflow systems, and business value.

## 8. Monitor

Search manually over time:

- `Jason Obawemimo`
- `Jason Obawemimo website`
- `Jason Obawemimo credentials`
- `Jason Obawemimo Anthropic`
- `Jason Obawemimo Dean's Honor List`
- `Jason Obawemimo web design workflow systems`

Indexing is not instant. The goal is to make the entity clear, crawlable, and consistently reinforced across the site and platforms.
