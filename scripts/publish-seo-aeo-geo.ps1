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
const sourceReleaseUrl = 'https://github.com/whoisjaso/jasonresume/releases/tag/v2026.06.17-credential-honor-evidence';
const githubProfileReadmeUrl = 'https://github.com/whoisjaso/whoisjaso';
const githubPagesProfileMirrorUrl = 'https://whoisjaso.github.io/whoisjaso/';
const evidencePageUrl = 'https://jasonobawemimo.com/jason-obawemimo-credentials-honor.html';
const evidenceJsonLdUrl = 'https://jasonobawemimo.com/jason-obawemimo-evidence.jsonld';
const knowledgeCardUrl = 'https://jasonobawemimo.com/jason-obawemimo-knowledge-card.html';
const knowledgeCardJsonLdUrl = 'https://jasonobawemimo.com/jason-obawemimo-knowledge-card.jsonld';
const wellKnownAiProfileUrl = 'https://jasonobawemimo.com/.well-known/ai-profile.jsonld';
const wellKnownAiAnswersUrl = 'https://jasonobawemimo.com/.well-known/ai-answers.json';
const didWeb = 'did:web:jasonobawemimo.com';
const didDocumentUrl = 'https://jasonobawemimo.com/.well-known/did.json';
const citationCffUrl = 'https://jasonobawemimo.com/CITATION.cff';
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
const htmlFiles = ['index.html', 'credentials.html', 'answers.html', 'resume-pdf.html', 'jason-obawemimo.html', 'mentions.html', 'jason-obawemimo-credentials-honor.html', 'jason-obawemimo-knowledge-card.html'];
const vercelIgnore = fs.readFileSync('.vercelignore', 'utf8');
if (!vercelIgnore.includes('release/')) throw new Error('.vercelignore must exclude generated release archives');
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  for (const [, json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(json);
  if (!html.includes('rel="cite-as" href="https://jasonobawemimo.com/"')) throw new Error(`${file} missing cite-as canonical link`);
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
  if (!html.includes('/jason-obawemimo.md')) throw new Error(`${file} missing exact-name Markdown profile link`);
  if (!html.includes('/person.json')) throw new Error(`${file} missing compact Person JSON-LD link`);
  if (!html.includes('/credentials.json')) throw new Error(`${file} missing credentials.json link`);
  if (!html.includes('/answers.json')) throw new Error(`${file} missing answers.json link`);
  if (!html.includes('/.well-known/ai-answers.json')) throw new Error(`${file} missing well-known AI answers JSON link`);
  if (!html.includes('/.well-known/ai-profile.jsonld')) throw new Error(`${file} missing well-known AI profile JSON-LD link`);
  if (!html.includes('/.well-known/did.json')) throw new Error(`${file} missing DID Web document link`);
  if (!html.includes('/CITATION.cff')) throw new Error(`${file} missing CITATION.cff link`);
  if (!html.includes('/jason-obawemimo.vcf')) throw new Error(`${file} missing vCard link`);
  if (!html.includes('/site.webmanifest')) throw new Error(`${file} missing site.webmanifest link`);
  if (!html.includes('/.well-known/webfinger')) throw new Error(`${file} missing WebFinger link`);
  if (!html.includes('/.well-known/host-meta')) throw new Error(`${file} missing host-meta link`);
  if (!html.includes('/opensearch.xml')) throw new Error(`${file} missing opensearch.xml link`);
  if (!html.includes('/credentials.jsonld')) throw new Error(`${file} missing credentials.jsonld link`);
  if (!html.includes('/jason-obawemimo-evidence.jsonld')) throw new Error(`${file} missing evidence JSON-LD link`);
  if (!html.includes('/jason-obawemimo-knowledge-card.jsonld')) throw new Error(`${file} missing knowledge card JSON-LD link`);
  if (!html.includes('/faq.jsonld')) throw new Error(`${file} missing faq.jsonld link`);
}
const crawlableTextFiles = [
  ...htmlFiles,
  'schema.json',
  'profile.jsonld',
  'credentials.jsonld',
  'jason-obawemimo-evidence.jsonld',
  'jason-obawemimo-knowledge-card.jsonld',
  'faq.jsonld',
  'discovery.json',
  'identity.json',
  'jason-obawemimo.md',
  'person.json',
  'credentials.json',
  'answers.json',
  'llms.txt',
  'llms-full.txt',
  'ai.txt',
  '.well-known/ai.txt',
  '.well-known/llms.txt',
  '.well-known/ai-profile.jsonld',
  '.well-known/ai-answers.json',
  '.well-known/did.json',
  '.well-known/webfinger',
  '.well-known/host-meta',
  'CITATION.cff',
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
const evidenceGraph = JSON.parse(fs.readFileSync('jason-obawemimo-evidence.jsonld', 'utf8'));
const knowledgeCardGraph = JSON.parse(fs.readFileSync('jason-obawemimo-knowledge-card.jsonld', 'utf8'));
const faqGraph = JSON.parse(fs.readFileSync('faq.jsonld', 'utf8'));
const discovery = JSON.parse(fs.readFileSync('discovery.json', 'utf8'));
const identity = JSON.parse(fs.readFileSync('identity.json', 'utf8'));
const personJson = JSON.parse(fs.readFileSync('person.json', 'utf8'));
const credentials = JSON.parse(fs.readFileSync('credentials.json', 'utf8'));
const answers = JSON.parse(fs.readFileSync('answers.json', 'utf8'));
const webfinger = JSON.parse(fs.readFileSync('.well-known/webfinger', 'utf8'));
const wellKnownAiProfile = JSON.parse(fs.readFileSync('.well-known/ai-profile.jsonld', 'utf8'));
const wellKnownAiAnswers = JSON.parse(fs.readFileSync('.well-known/ai-answers.json', 'utf8'));
const didDocument = JSON.parse(fs.readFileSync('.well-known/did.json', 'utf8'));
JSON.parse(fs.readFileSync('site.webmanifest', 'utf8'));
const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('site.webmanifest', 'utf8'));
function hasCanonicalHostRedirect(hostname) {
  return Array.isArray(vercelConfig.redirects) && vercelConfig.redirects.some(rule =>
    rule.source === '/(.*)' &&
    rule.destination === 'https://jasonobawemimo.com/$1' &&
    rule.permanent === true &&
    Array.isArray(rule.has) &&
    rule.has.some(condition => condition.type === 'header' && condition.key === 'host' && condition.value === hostname)
  );
}
function hasHeaderSource(source, contentType) {
  return Array.isArray(vercelConfig.headers) && vercelConfig.headers.some(rule =>
    rule.source === source &&
    Array.isArray(rule.headers) &&
    rule.headers.some(header => header.key === 'Content-Type' && header.value === contentType)
  );
}
if (!hasCanonicalHostRedirect('www.jasonobawemimo.com')) throw new Error('vercel.json missing www-to-apex canonical redirect');
if (!hasCanonicalHostRedirect('jasonresume.vercel.app')) throw new Error('vercel.json missing Vercel alias-to-apex canonical redirect');
if (!hasHeaderSource('/.well-known/ai-profile.jsonld', 'application/ld+json; charset=utf-8')) throw new Error('vercel.json missing well-known AI profile JSON-LD header');
if (!hasHeaderSource('/.well-known/ai-answers.json', 'application/json; charset=utf-8')) throw new Error('vercel.json missing well-known AI answers JSON header');
if (!hasHeaderSource('/.well-known/did.json', 'application/did+json; charset=utf-8')) throw new Error('vercel.json missing DID Web document header');
if (!hasHeaderSource('/CITATION.cff', 'text/yaml; charset=utf-8')) throw new Error('vercel.json missing CITATION.cff header');
if (!JSON.stringify(manifest).includes('/jason-obawemimo.html') || !JSON.stringify(manifest).includes('/llms-full.txt') || !JSON.stringify(manifest).includes('/person.json') || !JSON.stringify(manifest).includes('/jason-obawemimo-credentials-honor.html') || !JSON.stringify(manifest).includes('/jason-obawemimo-knowledge-card.html')) throw new Error('site.webmanifest missing profile, AI context, evidence, knowledge card, or Person JSON-LD shortcut');
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
const website = schema['@graph'].find(node => node['@id'] === 'https://jasonobawemimo.com/#website');
const homepage = schema['@graph'].find(node => node['@id'] === 'https://jasonobawemimo.com/#homepage');
const knowledgeCardPage = schema['@graph'].find(node => node['@id'] === 'https://jasonobawemimo.com/jason-obawemimo-knowledge-card.html#knowledge-card');
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
if (!website || !Array.isArray(website.hasPart) || website.hasPart.length < 8) throw new Error('schema.json missing WebSite hasPart page graph');
for (const requiredPartId of ['https://jasonobawemimo.com/#homepage', 'https://jasonobawemimo.com/jason-obawemimo.html#profile-page', 'https://jasonobawemimo.com/credentials.html#webpage', 'https://jasonobawemimo.com/jason-obawemimo-credentials-honor.html#evidence-page', 'https://jasonobawemimo.com/jason-obawemimo-knowledge-card.html#knowledge-card', 'https://jasonobawemimo.com/answers.html#webpage', 'https://jasonobawemimo.com/mentions.html#webpage', 'https://jasonobawemimo.com/resume-pdf.html#webpage']) {
  if (!website.hasPart.some(part => part['@id'] === requiredPartId)) throw new Error(`schema.json WebSite hasPart missing ${requiredPartId}`);
}
if (!homepage || homepage['@type'] !== 'ProfilePage' || homepage.mainEntity?.['@id'] !== 'https://jasonobawemimo.com/#jason-obawemimo') throw new Error('schema.json missing homepage ProfilePage node');
if (!JSON.stringify(homepage).includes(wellKnownAiProfileUrl) || !JSON.stringify(homepage).includes(wellKnownAiAnswersUrl) || !JSON.stringify(homepage).includes('SpeakableSpecification')) throw new Error('schema.json homepage ProfilePage missing AI links or speakable guidance');
if (!knowledgeCardPage || knowledgeCardPage['@type'] !== 'ProfilePage' || knowledgeCardPage.mainEntity?.['@id'] !== 'https://jasonobawemimo.com/#jason-obawemimo') throw new Error('schema.json missing knowledge-card ProfilePage node');
if (!JSON.stringify(knowledgeCardPage).includes(knowledgeCardJsonLdUrl) || !JSON.stringify(knowledgeCardPage).includes(wellKnownAiProfileUrl) || !JSON.stringify(knowledgeCardPage).includes(wellKnownAiAnswersUrl)) throw new Error('schema.json knowledge-card ProfilePage missing high-signal links');
if (profile['@id'] !== 'https://jasonobawemimo.com/#jason-obawemimo') throw new Error('profile.jsonld missing canonical Person @id');
if (!profile.hasOccupation || profile.hasOccupation.name !== 'Web Design and Workflow Systems Builder') throw new Error('profile.jsonld missing occupation');
if (!profile.contactPoint || profile.contactPoint.email !== 'jobawems@gmail.com') throw new Error('profile.jsonld missing contact point');
const courseList = credentialGraph['@graph'].find(node => node['@id'] === 'https://jasonobawemimo.com/#anthropic-course-list');
if (!courseList || courseList.numberOfItems !== 19 || courseList.itemListElement.length !== 19) throw new Error('credentials.jsonld missing 19 course ItemList');
if (!evidenceGraph['@graph']?.some(node => node['@id'] === 'https://jasonobawemimo.com/jason-obawemimo-evidence.jsonld#dataset')) throw new Error('evidence JSON-LD missing dataset node');
if (!JSON.stringify(evidenceGraph).includes('Dean') || !JSON.stringify(evidenceGraph).includes('Honor List') || !JSON.stringify(evidenceGraph).includes('GPA 3.63')) throw new Error('evidence JSON-LD missing honor or GPA');
if (!knowledgeCardGraph['@graph']?.some(node => node['@id'] === 'https://jasonobawemimo.com/jason-obawemimo-knowledge-card.jsonld#dataset')) throw new Error('knowledge card JSON-LD missing dataset node');
if (!JSON.stringify(knowledgeCardGraph).includes('jasonobawemimo.com') || !JSON.stringify(knowledgeCardGraph).includes('Dean') || !JSON.stringify(knowledgeCardGraph).includes('GPA 3.63')) throw new Error('knowledge card JSON-LD missing canonical website, honor, or GPA');
if (!wellKnownAiProfile['@graph']?.some(node => node['@id'] === 'https://jasonobawemimo.com/.well-known/ai-profile.jsonld#dataset')) throw new Error('well-known AI profile JSON-LD missing dataset node');
if (!JSON.stringify(wellKnownAiProfile).includes('Jason Obawemimo') || !JSON.stringify(wellKnownAiProfile).includes('Dean') || !JSON.stringify(wellKnownAiProfile).includes('GPA 3.63')) throw new Error('well-known AI profile JSON-LD missing name, honor, or GPA');
if (wellKnownAiAnswers.canonical_url !== wellKnownAiAnswersUrl || wellKnownAiAnswers.entity?.name !== 'Jason Obawemimo') throw new Error('well-known AI answers JSON missing canonical URL or entity name');
if (!JSON.stringify(wellKnownAiAnswers).includes('Dean') || !JSON.stringify(wellKnownAiAnswers).includes('GPA 3.63') || !JSON.stringify(wellKnownAiAnswers).includes(knowledgeCardUrl)) throw new Error('well-known AI answers JSON missing honor, GPA, or knowledge card URL');
if (didDocument.id !== didWeb || didDocument.controller !== didWeb) throw new Error('DID Web document missing canonical id or controller');
if (!Array.isArray(didDocument.alsoKnownAs) || !didDocument.alsoKnownAs.includes(linkedInUrl) || !didDocument.alsoKnownAs.includes(githubProfileReadmeUrl)) throw new Error('DID Web document missing identity aliases');
if (!JSON.stringify(didDocument).includes(wellKnownAiProfileUrl) || !JSON.stringify(didDocument).includes(wellKnownAiAnswersUrl) || !JSON.stringify(didDocument).includes(knowledgeCardJsonLdUrl) || !JSON.stringify(didDocument).includes(evidencePageUrl) || !JSON.stringify(didDocument).includes(citationCffUrl)) throw new Error('DID Web document missing high-signal service endpoints');
if (faqGraph['@type'] !== 'FAQPage' || faqGraph.mainEntity.length !== 8) throw new Error('faq.jsonld missing 8 FAQ answers');
if (discovery.entity.name !== 'Jason Obawemimo') throw new Error('discovery.json missing Jason Obawemimo name');
if (discovery.entity.occupation !== 'Web Design and Workflow Systems Builder' || !discovery.preferred_positioning.occupation_description) throw new Error('discovery.json missing occupation description');
if (identity.name !== 'Jason Obawemimo') throw new Error('identity.json missing Jason Obawemimo name');
if (!identity.occupation || identity.occupation.name !== 'Web Design and Workflow Systems Builder') throw new Error('identity.json missing occupation');
if (!identity.contact || identity.contact.contact_type !== 'professional inquiries') throw new Error('identity.json missing professional contact type');
if (personJson['@id'] !== 'https://jasonobawemimo.com/#jason-obawemimo') throw new Error('person.json missing canonical Person @id');
if (personJson.name !== 'Jason Obawemimo') throw new Error('person.json missing Jason Obawemimo name');
if (personJson.jobTitle !== 'Web Design and Workflow Systems Builder') throw new Error('person.json missing preferred title');
if (!JSON.stringify(personJson).includes('https://github.com/whoisjaso/jasonresume')) throw new Error('person.json missing source repository');
if (!JSON.stringify(personJson).includes(sourceReleaseUrl)) throw new Error('person.json missing source release');
if (!fs.readFileSync('jason-obawemimo.md', 'utf8').includes('Jason Obawemimo is a Pearland, Texas based web design and workflow systems builder')) throw new Error('jason-obawemimo.md missing preferred summary');
if (!fs.readFileSync('jason-obawemimo.md', 'utf8').includes('https://jasonobawemimo.com/person.json')) throw new Error('jason-obawemimo.md missing person.json reference');
if (!fs.readFileSync('jason-obawemimo.md', 'utf8').includes(sourceReleaseUrl)) throw new Error('jason-obawemimo.md missing source release');
if (!fs.readFileSync('jason-obawemimo.md', 'utf8').includes(githubProfileReadmeUrl)) throw new Error('jason-obawemimo.md missing GitHub profile README');
if (!fs.readFileSync('jason-obawemimo.md', 'utf8').includes(githubPagesProfileMirrorUrl)) throw new Error('jason-obawemimo.md missing GitHub Pages profile mirror');
if (!fs.readFileSync('jason-obawemimo.md', 'utf8').includes(evidencePageUrl) || !fs.readFileSync('jason-obawemimo.md', 'utf8').includes(evidenceJsonLdUrl)) throw new Error('jason-obawemimo.md missing credential evidence URLs');
if (!fs.readFileSync('jason-obawemimo.md', 'utf8').includes(knowledgeCardUrl) || !fs.readFileSync('jason-obawemimo.md', 'utf8').includes(knowledgeCardJsonLdUrl)) throw new Error('jason-obawemimo.md missing knowledge card URLs');
if (credentials.anthropic_course_completion_portfolio.course_count !== 19) throw new Error('credentials.json missing 19 Anthropic courses');
if (!credentials.education || !/Dean/.test(credentials.education.honor)) throw new Error('credentials.json missing Dean honor');
if (!Array.isArray(answers.answers) || answers.answers.length < 8) throw new Error('answers.json missing verified answers');
if (webfinger.subject !== 'acct:jobawems@jasonobawemimo.com') throw new Error('WebFinger subject mismatch');
if (!webfinger.links.some(link => link.rel === 'me' && link.href === linkedInUrl)) throw new Error('WebFinger missing LinkedIn rel=me');
if (!webfinger.links.some(link => link.rel === 'me' && link.href === 'https://github.com/whoisjaso')) throw new Error('WebFinger missing GitHub rel=me');
if (!hostMeta.includes('rel=' + String.fromCharCode(34) + 'me' + String.fromCharCode(34)) || !hostMeta.includes(linkedInUrl) || !hostMeta.includes('https://github.com/whoisjaso')) throw new Error('host-meta missing rel=me identity links');
if (!vcard.includes('FN:Jason Obawemimo') || !vcard.includes('URL:https://jasonobawemimo.com/')) throw new Error('vCard missing canonical identity');
if (!vcard.includes(linkedInUrl)) throw new Error('vCard missing LinkedIn profile');
if (!vcard.includes('https://jasonobawemimo.com/mentions.html')) throw new Error('vCard missing public mentions page');
if (!vcard.includes('https://jasonobawemimo.com/jason-obawemimo.md')) throw new Error('vCard missing Markdown profile');
if (!vcard.includes('https://jasonobawemimo.com/person.json')) throw new Error('vCard missing Person JSON-LD');
if (!vcard.includes('https://github.com/whoisjaso')) throw new Error('vCard missing GitHub profile');
if (!vcard.includes(githubProfileReadmeUrl)) throw new Error('vCard missing GitHub profile README');
if (!vcard.includes(githubPagesProfileMirrorUrl)) throw new Error('vCard missing GitHub Pages profile mirror');
if (!vcard.includes(evidencePageUrl) || !vcard.includes(evidenceJsonLdUrl)) throw new Error('vCard missing credential evidence URLs');
if (!vcard.includes(knowledgeCardUrl) || !vcard.includes(knowledgeCardJsonLdUrl)) throw new Error('vCard missing knowledge card URLs');
if (!vcard.includes(wellKnownAiProfileUrl) || !vcard.includes(wellKnownAiAnswersUrl)) throw new Error('vCard missing well-known AI URLs');
if (!vcard.includes(didDocumentUrl)) throw new Error('vCard missing DID Web document URL');
if (!vcard.includes(citationCffUrl)) throw new Error('vCard missing CITATION.cff URL');
if (!vcard.includes(sourceReleaseUrl)) throw new Error('vCard missing source release');
if (!JSON.stringify(schema).includes('https://github.com/whoisjaso')) throw new Error('schema.json missing GitHub sameAs identity link');
if (!JSON.stringify(profile).includes('https://github.com/whoisjaso')) throw new Error('profile.jsonld missing GitHub sameAs identity link');
if (!JSON.stringify(identity).includes('https://github.com/whoisjaso')) throw new Error('identity.json missing GitHub sameAs identity link');
if (!fs.readFileSync('jason-obawemimo.html', 'utf8').includes(githubProfileReadmeUrl)) throw new Error('jason-obawemimo.html missing GitHub profile README');
if (!fs.readFileSync('jason-obawemimo.html', 'utf8').includes(githubPagesProfileMirrorUrl)) throw new Error('jason-obawemimo.html missing GitHub Pages profile mirror');
if (!fs.readFileSync('jason-obawemimo.html', 'utf8').includes(knowledgeCardUrl) || !fs.readFileSync('jason-obawemimo.html', 'utf8').includes(knowledgeCardJsonLdUrl)) throw new Error('jason-obawemimo.html missing knowledge card URLs');
if (!fs.readFileSync('jason-obawemimo-credentials-honor.html', 'utf8').includes('Jason Obawemimo Credentials and Dean') || !fs.readFileSync('jason-obawemimo-credentials-honor.html', 'utf8').includes(evidenceJsonLdUrl)) throw new Error('credential evidence page missing title or JSON-LD reference');
for (const [name, value] of Object.entries({ schema, profile, personJson, credentialGraph, evidenceGraph, knowledgeCardGraph, wellKnownAiProfile, wellKnownAiAnswers, didDocument, faqGraph, discovery, identity, credentials, answers, webfinger })) {
  if (!JSON.stringify(value).includes(linkedInUrl)) throw new Error(`${name} missing LinkedIn identity link`);
}
for (const [name, value] of Object.entries({ schema, profile, personJson, evidenceGraph, knowledgeCardGraph, wellKnownAiProfile, wellKnownAiAnswers, didDocument, discovery, identity, credentials, answers, webfinger })) {
  if (!JSON.stringify(value).includes(sourceReleaseUrl)) throw new Error(`${name} missing source release`);
}
for (const [name, value] of Object.entries({ schema, profile, personJson, evidenceGraph, knowledgeCardGraph, wellKnownAiProfile, wellKnownAiAnswers, didDocument, discovery, identity, credentials, answers, webfinger })) {
  if (!JSON.stringify(value).includes(githubProfileReadmeUrl)) throw new Error(`${name} missing GitHub profile README`);
  if (!JSON.stringify(value).includes(githubPagesProfileMirrorUrl)) throw new Error(`${name} missing GitHub Pages profile mirror`);
}
for (const [name, value] of Object.entries({ schema, profile, personJson, evidenceGraph, knowledgeCardGraph, wellKnownAiProfile, wellKnownAiAnswers, didDocument, discovery, identity, credentials, answers, webfinger })) {
  if (!JSON.stringify(value).includes(evidencePageUrl) || !JSON.stringify(value).includes(evidenceJsonLdUrl)) throw new Error(`${name} missing credential evidence URLs`);
  if (!JSON.stringify(value).includes(knowledgeCardUrl) || !JSON.stringify(value).includes(knowledgeCardJsonLdUrl)) throw new Error(`${name} missing knowledge card URLs`);
}
for (const [name, value] of Object.entries({ schema, profile, personJson, knowledgeCardGraph, wellKnownAiProfile, wellKnownAiAnswers, didDocument, discovery, identity, credentials, answers, webfinger })) {
  if (!JSON.stringify(value).includes(wellKnownAiProfileUrl) || !JSON.stringify(value).includes(wellKnownAiAnswersUrl)) throw new Error(`${name} missing well-known AI URLs`);
}
for (const [name, value] of Object.entries({ schema, profile, personJson, credentialGraph, evidenceGraph, knowledgeCardGraph, wellKnownAiProfile, wellKnownAiAnswers, didDocument, discovery, identity, credentials, answers, webfinger })) {
  if (!JSON.stringify(value).includes(citationCffUrl)) throw new Error(`${name} missing CITATION.cff URL`);
}
for (const file of ['llms.txt', 'llms-full.txt', 'ai.txt', '.well-known/ai.txt', '.well-known/llms.txt', '.well-known/host-meta', 'README.md', 'PUBLISH_NOW.md', 'SEARCH_SUBMISSION_CHECKLIST.md']) {
  if (!fs.readFileSync(file, 'utf8').includes(sourceReleaseUrl)) throw new Error(`${file} missing source release`);
  if (!fs.readFileSync(file, 'utf8').includes(githubProfileReadmeUrl)) throw new Error(`${file} missing GitHub profile README`);
  if (!fs.readFileSync(file, 'utf8').includes(githubPagesProfileMirrorUrl)) throw new Error(`${file} missing GitHub Pages profile mirror`);
  if (!fs.readFileSync(file, 'utf8').includes(evidencePageUrl) || !fs.readFileSync(file, 'utf8').includes(evidenceJsonLdUrl)) throw new Error(`${file} missing credential evidence URLs`);
  if (!fs.readFileSync(file, 'utf8').includes(knowledgeCardUrl) || !fs.readFileSync(file, 'utf8').includes(knowledgeCardJsonLdUrl)) throw new Error(`${file} missing knowledge card URLs`);
  if (!fs.readFileSync(file, 'utf8').includes(wellKnownAiProfileUrl) || !fs.readFileSync(file, 'utf8').includes(wellKnownAiAnswersUrl)) throw new Error(`${file} missing well-known AI URLs`);
  if (!fs.readFileSync(file, 'utf8').includes(didWeb) || !fs.readFileSync(file, 'utf8').includes(didDocumentUrl)) throw new Error(`${file} missing DID Web URLs`);
  if (!fs.readFileSync(file, 'utf8').includes(citationCffUrl)) throw new Error(`${file} missing CITATION.cff URL`);
}
for (const sourceUrl of publicSourceUrls) {
  if (!fs.readFileSync('mentions.html', 'utf8').includes(sourceUrl)) throw new Error(`mentions.html missing public source ${sourceUrl}`);
  for (const [name, value] of Object.entries({ schema, profile, personJson, discovery, identity })) {
    if (!JSON.stringify(value).includes(sourceUrl)) throw new Error(`${name} missing public source ${sourceUrl}`);
  }
}
if (!schema['@graph'].some(node => node['@type'] === 'ImageObject' && node['@id'] === 'https://jasonobawemimo.com/#headshot')) throw new Error('schema.json missing headshot ImageObject');
if ([...sitemap.matchAll(/<loc>/g)].length !== 38) throw new Error('Expected 38 sitemap URLs');
if ([...sitemapIndex.matchAll(/<loc>/g)].length !== 2) throw new Error('Expected 2 sitemap-index URLs');
if (!sitemapIndex.includes('https://jasonobawemimo.com/image-sitemap.xml')) throw new Error('sitemap-index.xml missing image sitemap');
if (!imageSitemap.includes('https://jasonobawemimo.com/assets/jason-headshot.png')) throw new Error('image-sitemap.xml missing headshot');
for (const requiredUrl of ['/jason-obawemimo.html', '/jason-obawemimo-credentials-honor.html', '/jason-obawemimo-knowledge-card.html', '/jason-obawemimo.md', '/person.json', '/mentions.html', '/llms-full.txt', '/profile.jsonld', '/credentials.jsonld', '/jason-obawemimo-evidence.jsonld', '/jason-obawemimo-knowledge-card.jsonld', '/faq.jsonld', '/opensearch.xml', '/feed.xml', '/ai.txt', '/discovery.json', '/identity.json', '/credentials.json', '/answers.json', '/CITATION.cff', '/.well-known/llms.txt', '/.well-known/ai.txt', '/.well-known/ai-profile.jsonld', '/.well-known/ai-answers.json', '/.well-known/did.json', '/.well-known/webfinger', '/.well-known/host-meta']) {
  if (!sitemap.includes(`https://jasonobawemimo.com${requiredUrl}`)) throw new Error(`sitemap.xml missing ${requiredUrl}`);
}
if (!robots.includes('Sitemap: https://jasonobawemimo.com/sitemap-index.xml')) throw new Error('robots.txt missing sitemap-index.xml reference');
if (!robots.includes('Sitemap: https://jasonobawemimo.com/image-sitemap.xml')) throw new Error('robots.txt missing image-sitemap.xml reference');
if (!robots.includes('Sitemap: https://jasonobawemimo.com/feed.xml')) throw new Error('robots.txt missing feed.xml sitemap reference');
if (!robots.includes('AI-Guidance: https://jasonobawemimo.com/ai.txt')) throw new Error('robots.txt missing AI guidance reference');
if (!robots.includes('Well-Known-AI-Profile: https://jasonobawemimo.com/.well-known/ai-profile.jsonld')) throw new Error('robots.txt missing well-known AI profile reference');
if (!robots.includes('Well-Known-AI-Answers: https://jasonobawemimo.com/.well-known/ai-answers.json')) throw new Error('robots.txt missing well-known AI answers reference');
if (!robots.includes('DID-Web: did:web:jasonobawemimo.com')) throw new Error('robots.txt missing DID Web identifier');
if (!robots.includes('DID-Document: https://jasonobawemimo.com/.well-known/did.json')) throw new Error('robots.txt missing DID Web document reference');
if (!robots.includes('Citation-CFF: https://jasonobawemimo.com/CITATION.cff')) throw new Error('robots.txt missing CITATION.cff reference');
if (!robots.includes('Discovery: https://jasonobawemimo.com/discovery.json')) throw new Error('robots.txt missing discovery.json reference');
if (!robots.includes('Identity: https://jasonobawemimo.com/identity.json')) throw new Error('robots.txt missing identity.json reference');
if (!robots.includes('Entity-Markdown: https://jasonobawemimo.com/jason-obawemimo.md')) throw new Error('robots.txt missing jason-obawemimo.md reference');
if (!robots.includes('Person-JSONLD: https://jasonobawemimo.com/person.json')) throw new Error('robots.txt missing person.json reference');
if (!robots.includes('Credentials: https://jasonobawemimo.com/credentials.json')) throw new Error('robots.txt missing credentials.json reference');
if (!robots.includes('Credentials-JSONLD: https://jasonobawemimo.com/credentials.jsonld')) throw new Error('robots.txt missing credentials.jsonld reference');
if (!robots.includes('Credential-Honor-Evidence: https://jasonobawemimo.com/jason-obawemimo-credentials-honor.html')) throw new Error('robots.txt missing credential evidence page reference');
if (!robots.includes('Credential-Honor-Evidence-JSONLD: https://jasonobawemimo.com/jason-obawemimo-evidence.jsonld')) throw new Error('robots.txt missing credential evidence JSON-LD reference');
if (!robots.includes('Knowledge-Card: https://jasonobawemimo.com/jason-obawemimo-knowledge-card.html')) throw new Error('robots.txt missing knowledge card reference');
if (!robots.includes('Knowledge-Card-JSONLD: https://jasonobawemimo.com/jason-obawemimo-knowledge-card.jsonld')) throw new Error('robots.txt missing knowledge card JSON-LD reference');
if (!robots.includes('Answers: https://jasonobawemimo.com/answers.json')) throw new Error('robots.txt missing answers.json reference');
if (!robots.includes('FAQ-JSONLD: https://jasonobawemimo.com/faq.jsonld')) throw new Error('robots.txt missing faq.jsonld reference');
if (!robots.includes('WebFinger: https://jasonobawemimo.com/.well-known/webfinger')) throw new Error('robots.txt missing WebFinger reference');
if (!robots.includes('Host-Meta: https://jasonobawemimo.com/.well-known/host-meta')) throw new Error('robots.txt missing host-meta reference');
for (const crawler of ['OAI-SearchBot', 'GPTBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'Googlebot-Image', 'GoogleOther', 'Applebot', 'Applebot-Extended', 'Bingbot', 'DuckDuckBot', 'DuckAssistBot', 'Bravebot', 'YouBot', 'CCBot', 'Bytespider', 'Amazonbot', 'Meta-ExternalAgent', 'FacebookBot', 'cohere-ai', 'Diffbot']) {
  if (!robots.includes(`User-agent: ${crawler}`)) throw new Error(`robots.txt missing ${crawler}`);
}
if (['index.html','credentials.html','answers.html','resume-pdf.html','jason-obawemimo.html','jason-obawemimo-credentials-honor.html','jason-obawemimo-knowledge-card.html','mentions.html','sitemap.xml','sitemap-index.xml','image-sitemap.xml','llms.txt','llms-full.txt','ai.txt','discovery.json','identity.json','jason-obawemimo.md','person.json','jason-obawemimo.vcf','credentials.json','credentials.jsonld','jason-obawemimo-evidence.jsonld','jason-obawemimo-knowledge-card.jsonld','.well-known/ai-profile.jsonld','.well-known/ai-answers.json','.well-known/did.json','faq.jsonld','answers.json','.well-known/ai.txt','.well-known/llms.txt','.well-known/webfinger','.well-known/host-meta','CITATION.cff','humans.txt','SEARCH_SUBMISSION_CHECKLIST.md','README.md','PUBLISH_NOW.md','feed.xml'].some(file => fs.readFileSync(file, 'utf8').includes('jason-obawemimo-og.png'))) {
  throw new Error('Generated social PNG is still referenced');
}
console.log('Validation passed');
'@
$validationScriptPath = Join-Path $env:TEMP "jasonresume-seo-aeo-geo-validation.js"
Set-Content -Path $validationScriptPath -Value $validationScript -Encoding UTF8
try {
  node $validationScriptPath
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) { throw "local SEO/AEO/GEO validation failed with exit code $exitCode" }
} finally {
  Remove-Item -LiteralPath $validationScriptPath -Force -ErrorAction SilentlyContinue
}

$indexNowDryRun = powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\submit-indexnow.ps1 -DryRun
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) { throw "IndexNow dry-run failed with exit code $exitCode" }
$indexNowPayload = ($indexNowDryRun | Out-String) | ConvertFrom-Json
if ($indexNowPayload.urlList.Count -lt 36) { throw "IndexNow dry-run has too few URLs" }
if ($indexNowPayload.urlList -notcontains "https://jasonobawemimo.com/mentions.html") { throw "IndexNow dry-run missing public mentions page" }
if ($indexNowPayload.urlList -notcontains "https://jasonobawemimo.com/jason-obawemimo-credentials-honor.html") { throw "IndexNow dry-run missing credential evidence page" }
if ($indexNowPayload.urlList -notcontains "https://jasonobawemimo.com/jason-obawemimo-evidence.jsonld") { throw "IndexNow dry-run missing credential evidence JSON-LD" }
if ($indexNowPayload.urlList -notcontains "https://jasonobawemimo.com/jason-obawemimo-knowledge-card.html") { throw "IndexNow dry-run missing knowledge card page" }
if ($indexNowPayload.urlList -notcontains "https://jasonobawemimo.com/jason-obawemimo-knowledge-card.jsonld") { throw "IndexNow dry-run missing knowledge card JSON-LD" }
if ($indexNowPayload.urlList -notcontains "https://jasonobawemimo.com/.well-known/ai-profile.jsonld") { throw "IndexNow dry-run missing well-known AI profile JSON-LD" }
if ($indexNowPayload.urlList -notcontains "https://jasonobawemimo.com/.well-known/ai-answers.json") { throw "IndexNow dry-run missing well-known AI answers JSON" }
if ($indexNowPayload.urlList -notcontains "https://jasonobawemimo.com/.well-known/did.json") { throw "IndexNow dry-run missing DID Web document" }
if ($indexNowPayload.urlList -notcontains "https://jasonobawemimo.com/CITATION.cff") { throw "IndexNow dry-run missing CITATION.cff" }
if ($indexNowPayload.urlList -notcontains "https://jasonobawemimo.com/jason-obawemimo.md") { throw "IndexNow dry-run missing exact-name Markdown profile" }
if ($indexNowPayload.urlList -notcontains "https://jasonobawemimo.com/person.json") { throw "IndexNow dry-run missing compact Person JSON-LD" }
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
  "site.js",
  "sitemap.xml",
  "sitemap-index.xml",
  "image-sitemap.xml",
  "feed.xml",
  "vercel.json",
  ".vercelignore",
  "README.md",
  "PUBLISH_NOW.md",
  "CITATION.cff",
  "ai.txt",
  "discovery.json",
  "identity.json",
  "jason-obawemimo.md",
  "jason-obawemimo-credentials-honor.html",
  "jason-obawemimo-evidence.jsonld",
  "jason-obawemimo-knowledge-card.html",
  "jason-obawemimo-knowledge-card.jsonld",
  "person.json",
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
  ".well-known/ai-profile.jsonld",
  ".well-known/ai-answers.json",
  ".well-known/did.json",
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
  "https://jasonobawemimo.com/jason-obawemimo-credentials-honor.html",
  "https://jasonobawemimo.com/jason-obawemimo-knowledge-card.html",
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
  "https://jasonobawemimo.com/jason-obawemimo.md",
  "https://jasonobawemimo.com/person.json",
  "https://jasonobawemimo.com/jason-obawemimo.vcf",
  "https://jasonobawemimo.com/credentials.json",
  "https://jasonobawemimo.com/answers.json",
  "https://jasonobawemimo.com/.well-known/llms.txt",
  "https://jasonobawemimo.com/.well-known/ai.txt",
  "https://jasonobawemimo.com/.well-known/ai-profile.jsonld",
  "https://jasonobawemimo.com/.well-known/ai-answers.json",
  "https://jasonobawemimo.com/.well-known/did.json",
  "https://jasonobawemimo.com/CITATION.cff",
  "https://jasonobawemimo.com/.well-known/webfinger",
  "https://jasonobawemimo.com/.well-known/host-meta",
  "https://jasonobawemimo.com/humans.txt",
  "https://jasonobawemimo.com/schema.json",
  "https://jasonobawemimo.com/profile.jsonld",
  "https://jasonobawemimo.com/credentials.jsonld",
  "https://jasonobawemimo.com/jason-obawemimo-evidence.jsonld",
  "https://jasonobawemimo.com/jason-obawemimo-knowledge-card.jsonld",
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

$redirectChecks = @(
  @{ From = "https://www.jasonobawemimo.com/"; To = "https://jasonobawemimo.com/" },
  @{ From = "https://www.jasonobawemimo.com/schema.json"; To = "https://jasonobawemimo.com/schema.json" },
  @{ From = "https://www.jasonobawemimo.com/credentials.html"; To = "https://jasonobawemimo.com/credentials.html" },
  @{ From = "https://jasonresume.vercel.app/"; To = "https://jasonobawemimo.com/" },
  @{ From = "https://jasonresume.vercel.app/schema.json"; To = "https://jasonobawemimo.com/schema.json" },
  @{ From = "https://jasonresume.vercel.app/credentials.html"; To = "https://jasonobawemimo.com/credentials.html" }
)

Write-Host "Polling canonical host redirects..."
$pendingRedirects = @($redirectChecks)
$deadline = (Get-Date).AddMinutes(8)
while ($pendingRedirects.Count -gt 0 -and (Get-Date) -lt $deadline) {
  $nextPending = @()
  foreach ($redirectCheck in $pendingRedirects) {
    $response = $null
    try {
      $response = Invoke-WebRequest -Uri $redirectCheck.From -Method Head -MaximumRedirection 0 -TimeoutSec 30
    } catch {
      $response = $_.Exception.Response
    }

    if ($response -and [int]$response.StatusCode -eq 308 -and [string]$response.Headers["Location"] -eq $redirectCheck.To) {
      Write-Host "308 $($redirectCheck.From) -> $($redirectCheck.To)"
    } else {
      Write-Host "Waiting for redirect $($redirectCheck.From)"
      $nextPending += $redirectCheck
    }
  }
  $pendingRedirects = @($nextPending)
  if ($pendingRedirects.Count -gt 0) { Start-Sleep -Seconds 10 }
}

if ($pendingRedirects.Count -gt 0) {
  $pending = $pendingRedirects | ForEach-Object { "$($_.From) -> $($_.To)" }
  throw "Timed out waiting for canonical redirects: $($pending -join ', ')"
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
