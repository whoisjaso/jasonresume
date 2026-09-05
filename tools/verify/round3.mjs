import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
const TOOLS = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REPO = path.dirname(TOOLS);
const OUT = path.join(TOOLS, 'verify', 'out') + '/';
import fs from 'fs';
const S=TOOLS;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--autoplay-policy=no-user-gesture-required'] });
const errs=[], notes=[];
async function fonts(ctx){
  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status:200, contentType:'text/css', body: fs.readFileSync(S+'/fonts/fonts.css','utf8') }));
  await ctx.route('**/pwfonts/*', r => { const f=r.request().url().split('/').pop(); r.fulfill({ status:200, contentType:'font/woff2', body: fs.readFileSync(S+'/fonts/'+f) }); });
  await ctx.route('**/api/track', r => r.fulfill({ status:204, body:'' }));
}
for (const [name,w,h,mobile] of [['desktop',1440,900,false],['mobile',390,844,true]]) {
  const ctx = await b.newContext({ viewport:{width:w,height:h}, isMobile:mobile, hasTouch:mobile }); await fonts(ctx);
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(name+' pageerror: '+e.message));
  p.on('console', m => { if (m.type()==='error' && !/404/.test(m.text())) errs.push(name+' console: '+m.text().slice(0,160)); });
  await p.goto('http://127.0.0.1:8765/index.html', { waitUntil:'load' });
  await p.waitForTimeout(800);
  const lock1 = await p.evaluate(()=>({ locked: document.documentElement.classList.contains('is-locked'), pos: getComputedStyle(document.body).position }));
  await p.mouse.click(w/2, h/2); // first gesture on the loader
  await p.waitForSelector('#jg-gate.is-in', { timeout: 20000 });
  const lock2 = await p.evaluate(()=>({ locked: document.documentElement.classList.contains('is-locked'), pos: getComputedStyle(document.body).position }));
  await p.click('.jg-path[data-role="interviewer"]');
  await p.waitForSelector('.jg-namestep input', { timeout: 5000 }); await p.click('[data-skip]');
  await p.waitForSelector('#jg-guide.is-open', { timeout: 8000 }); await p.waitForTimeout(1500);
  const lock3 = await p.evaluate(()=>({ locked: document.documentElement.classList.contains('is-locked'), pos: getComputedStyle(document.body).position, y: scrollY }));
  notes.push(name+' lock loader='+JSON.stringify(lock1)+' gate='+JSON.stringify(lock2)+' guide='+JSON.stringify(lock3));
  for (let i=0;i<5;i++){ await p.waitForSelector('.jg-opt', {timeout: 40000}); await p.click('.jg-opt--primary'); await p.waitForTimeout(2500); }
  const line = await p.textContent('.jg-say'); notes.push(name+' line6: '+line.trim().slice(0,80));
  await p.click('.jg-guide__skip'); await p.waitForTimeout(600);
  await p.evaluate(()=>{ document.querySelectorAll('[data-reveal],.section__head').forEach(e=>e.classList.add('in-view')); });
  await p.locator('.venture__direction').scrollIntoViewIfNeeded(); await p.waitForTimeout(900);
  await p.screenshot({ path: S+'/v2/'+name+'-direction.png' });
  if (name==='desktop') { await p.click('.nav__burger'); await p.waitForTimeout(600); const lm = await p.evaluate(()=>getComputedStyle(document.body).position); await p.keyboard.press('Escape'); await p.waitForTimeout(500); const lu = await p.evaluate(()=>getComputedStyle(document.body).position); notes.push('menu lock: '+lm+' then '+lu); }
  const ov = await p.evaluate(()=>({docW:document.documentElement.scrollWidth, winW:window.innerWidth})); if (ov.docW > ov.winW+1) errs.push(name+' H-OVERFLOW');
  await ctx.close();
}
await b.close();
console.log(notes.join('\n')); console.log(errs.length? 'ISSUES:\n'+errs.join('\n') : 'no page errors, no overflow');
