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
}
for (const [name,w,h,mobile] of [['desktop',1440,900,false],['mobile',390,844,true]]) {
  const ctx = await b.newContext({ viewport:{width:w,height:h}, deviceScaleFactor:1, isMobile:mobile, hasTouch:mobile });
  await fonts(ctx);
  const p = await ctx.newPage();
  const bad=[];
  p.on('console', m => { if (m.type()==='error') errs.push(name+' console: '+m.text().slice(0,200)); });
  p.on('pageerror', e => errs.push(name+' pageerror: '+e.message));
  p.on('response', r => { if (r.status()>=400 && !r.url().includes('/api/guide')) bad.push(r.status()+' '+r.url().replace('http://127.0.0.1:8765','')); });
  await p.goto('http://127.0.0.1:8765/index.html', { waitUntil:'load' });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: OUT+name+'-1-loader.png' });
  // let the loader finish on its own (first visit: 3.6s + film)
  await p.waitForSelector('#jg-gate.is-in', { timeout: 20000 });
  notes.push(name+': gate reached after loader in '+Math.round(performance.now())+'ms');
  await p.waitForTimeout(1300);
  await p.screenshot({ path: OUT+name+'-2-gate.png' });
  await p.click('.jg-path[data-role="interviewer"]');
  await p.waitForSelector('#jg-guide.is-open', { timeout: 8000 });
  await p.waitForSelector('.jg-say.is-done', { timeout: 30000 });
  await p.waitForTimeout(400);
  await p.screenshot({ path: OUT+name+'-3-line1.png' });
  // advance through lines 2..6 and capture annotation states
  for (let i=2;i<=6;i++){
    await p.click('.jg-opt--primary');
    await p.waitForSelector('.jg-say.is-done', { timeout: 40000 });
    await p.waitForTimeout(500);
    const mark = await p.evaluate(()=>{ const m=document.querySelector('[data-mark].is-marked'); const path=document.querySelector('#jg-ink path'); return { mark: m?m.dataset.mark:null, path: !!path, len: path? path.getTotalLength():0, y: m? Math.round(m.getBoundingClientRect().top):null, guideTop: Math.round(document.querySelector('#jg-guide').getBoundingClientRect().top) }; });
    notes.push(name+' line'+i+' '+JSON.stringify(mark));
    if (i===2||i===3||i===5) await p.screenshot({ path: OUT+name+'-4-line'+i+'.png' });
  }
  // skip tour, open menu
  await p.click('.jg-guide__skip');
  await p.waitForTimeout(600);
  await p.evaluate(()=>window.scrollTo(0,0));
  await p.waitForTimeout(400);
  await p.screenshot({ path: OUT+name+'-5-hero.png' });
  await p.click('.nav__burger');
  await p.waitForTimeout(1100);
  await p.screenshot({ path: OUT+name+'-6-menu.png' });
  await p.keyboard.press('Escape');
  await p.waitForTimeout(500);
  // laptop
  await p.locator('.device').scrollIntoViewIfNeeded();
  await p.waitForTimeout(2600);
  const film = await p.evaluate(()=>{ const v=document.querySelector('.device__film'); return { paused:v.paused, t:v.currentTime, ready:v.readyState }; });
  notes.push(name+' laptop film '+JSON.stringify(film));
  await p.screenshot({ path: OUT+name+'-7-device.png' });
  const ov = await p.evaluate(()=>({docW:document.documentElement.scrollWidth, winW:window.innerWidth}));
  const cardW = await p.evaluate(()=>{ const g=document.querySelector('#jg-guide'); const r=g.getBoundingClientRect(); return {left:Math.round(r.left), right:Math.round(r.right), w:window.innerWidth}; });
  notes.push(name+' card box '+JSON.stringify(cardW));
  const focus = await p.evaluate(()=>document.body.className);
  notes.push(name+' body class after skip: '+focus);
  if (ov.docW > ov.winW+1) errs.push(`${name} H-OVERFLOW ${ov.docW} vs ${ov.winW}`);
  if (bad.length) errs.push(name+' bad responses: '+[...new Set(bad)].join(', '));
  await ctx.close();
}
await b.close();
console.log(notes.join('\n'));
console.log(errs.length? 'ISSUES:\n'+errs.join('\n') : 'no console errors, no overflow, no 404s');
