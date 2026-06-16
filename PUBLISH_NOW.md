# Publish Now

The SEO/AEO/GEO package is prepared locally but must be published before search engines, browsers, and AI retrieval systems can crawl it.

Canonical site: https://jasonobawemimo.com/
GitHub repository: https://github.com/whoisjaso/jasonresume
Vercel project: jasonresume
Validated release bundle: `release/jasonresume-seo-aeo-geo-latest-valid.zip`

## Current Blocker

In the Codex sandbox, local Git writes fail because `.git/index.lock` cannot be created. GitHub API writes also return `403 Resource not accessible by integration`, and the Vercel connector only returns CLI/Git deployment instructions.

The latest production check still shows the old deployment: `https://jasonobawemimo.com/sitemap.xml` has only the homepage, and `https://jasonobawemimo.com/answers.html` returns `404`. Publish the validated bundle or run the script below from an unrestricted terminal to make the AI/search files live.

## Publish Command

Run this from an unrestricted PowerShell terminal in the project root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\publish-seo-aeo-geo.ps1
```

The script validates local SEO/AEO/GEO files, stages the intended files, commits, pushes `main`, waits for Vercel, submits IndexNow, and verifies the live URLs.

## Required Live Proof

After publish, these must return `200 OK`:

- https://jasonobawemimo.com/sitemap.xml
- https://jasonobawemimo.com/sitemap-index.xml
- https://jasonobawemimo.com/image-sitemap.xml
- https://jasonobawemimo.com/discovery.json
- https://jasonobawemimo.com/identity.json
- https://jasonobawemimo.com/jason-obawemimo.vcf
- https://jasonobawemimo.com/credentials.json
- https://jasonobawemimo.com/answers.json
- https://jasonobawemimo.com/.well-known/webfinger
- https://jasonobawemimo.com/.well-known/host-meta
- https://jasonobawemimo.com/llms.txt
- https://jasonobawemimo.com/llms-full.txt
- https://jasonobawemimo.com/ai.txt
- https://jasonobawemimo.com/schema.json
- https://jasonobawemimo.com/profile.jsonld
- https://jasonobawemimo.com/credentials.jsonld
- https://jasonobawemimo.com/faq.jsonld

## Post-Publish

Submit `https://jasonobawemimo.com/sitemap-index.xml`, `https://jasonobawemimo.com/sitemap.xml`, and `https://jasonobawemimo.com/image-sitemap.xml` in Google Search Console and Bing Webmaster Tools, then request inspection for the homepage, entity profile, credentials page, verified answers page, and credential PDFs.
