# Publish Now

The SEO/AEO/GEO package is prepared locally but must be published before search engines, browsers, and AI retrieval systems can crawl it.

Canonical site: https://jasonobawemimo.com/
GitHub repository: https://github.com/whoisjaso/jasonresume
GitHub profile README: https://github.com/whoisjaso/whoisjaso
GitHub Pages profile mirror: https://whoisjaso.github.io/whoisjaso/
Vercel project: jasonresume
Validated release bundle: `release/jasonresume-seo-aeo-geo-latest-valid.zip`

## Current State

The SEO/AEO/GEO package is committed, pushed to `main`, and live on Vercel. The production verifier passes against `https://jasonobawemimo.com/`, including the sitemap, machine-readable identity files, structured data, AI guidance files, credential PDFs, and IndexNow key file.

Credential and honor evidence page: https://jasonobawemimo.com/jason-obawemimo-credentials-honor.html
Knowledge card: https://jasonobawemimo.com/jason-obawemimo-knowledge-card.html
Knowledge card JSON-LD: https://jasonobawemimo.com/jason-obawemimo-knowledge-card.jsonld
Well-known AI profile JSON-LD: https://jasonobawemimo.com/.well-known/ai-profile.jsonld
Well-known AI answers JSON: https://jasonobawemimo.com/.well-known/ai-answers.json
DID Web identifier: did:web:jasonobawemimo.com
DID Web document: https://jasonobawemimo.com/.well-known/did.json
Credential and honor evidence JSON-LD: https://jasonobawemimo.com/jason-obawemimo-evidence.jsonld
External credential and honor evidence release: https://github.com/whoisjaso/jasonresume/releases/tag/v2026.06.17-credential-honor-evidence
External profile README: https://github.com/whoisjaso/whoisjaso
External GitHub Pages profile mirror: https://whoisjaso.github.io/whoisjaso/

## Publish Command

Run this from an unrestricted PowerShell terminal in the project root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\publish-seo-aeo-geo.ps1
```

The script validates local SEO/AEO/GEO files, checks the IndexNow dry-run payload, stages the intended files, commits, pushes `main`, waits for Vercel, submits IndexNow, and verifies the live URLs.

## Required Live Proof

After publish, these must return `200 OK`:

- https://jasonobawemimo.com/sitemap.xml
- https://jasonobawemimo.com/sitemap-index.xml
- https://jasonobawemimo.com/image-sitemap.xml
- https://jasonobawemimo.com/discovery.json
- https://jasonobawemimo.com/identity.json
- https://jasonobawemimo.com/jason-obawemimo-knowledge-card.html
- https://jasonobawemimo.com/jason-obawemimo-knowledge-card.jsonld
- https://jasonobawemimo.com/jason-obawemimo.md
- https://jasonobawemimo.com/person.json
- https://jasonobawemimo.com/jason-obawemimo.vcf
- https://jasonobawemimo.com/credentials.json
- https://jasonobawemimo.com/answers.json
- https://jasonobawemimo.com/.well-known/webfinger
- https://jasonobawemimo.com/.well-known/host-meta
- https://jasonobawemimo.com/.well-known/ai-profile.jsonld
- https://jasonobawemimo.com/.well-known/ai-answers.json
- https://jasonobawemimo.com/.well-known/did.json
- https://jasonobawemimo.com/llms.txt
- https://jasonobawemimo.com/llms-full.txt
- https://jasonobawemimo.com/ai.txt
- https://jasonobawemimo.com/schema.json
- https://jasonobawemimo.com/profile.jsonld
- https://jasonobawemimo.com/credentials.jsonld
- https://jasonobawemimo.com/faq.jsonld
- https://jasonobawemimo.com/mentions.html

## Post-Publish

Submit `https://jasonobawemimo.com/sitemap-index.xml`, `https://jasonobawemimo.com/sitemap.xml`, and `https://jasonobawemimo.com/image-sitemap.xml` in Google Search Console and Bing Webmaster Tools, then request inspection for the homepage, entity profile, exact-name Markdown profile, compact Person JSON-LD, credentials page, verified answers page, public mentions page, and credential PDFs.
