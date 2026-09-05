import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
const TOOLS = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REPO = path.dirname(TOOLS);
const OUT = path.join(TOOLS, 'verify', 'out') + '/';
import fs from 'fs';
const S=TOOLS;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--autoplay-policy=no-user-gesture-required'] });
async function fonts(ctx){
  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status:200, contentType:'text/css', body: fs.readFileSync(S+'/fonts/fonts.css','utf8') }));
  await ctx.route('**/pwfonts/*', r => { const f=r.request().url().split('/').pop(); r.fulfill({ status:200, contentType:'font/woff2', body: fs.readFileSync(S+'/fonts/'+f) }); });
}
const errs=[];
for (const [name,w,h,mobile] of [['desktop',1440,900,false],['mobile',390,844,true]]) {
  const ctx = await b.newContext({ viewport:{width:w,height:h}, isMobile:mobile, hasTouch:mobile });
  await fonts(ctx);
  const tracked=[];
  await ctx.route('**/api/track', async r => { try { tracked.push(JSON.parse(r.request().postData())); } catch(e){} r.fulfill({ status:204, body:'' }); });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(name+' pageerror: '+e.message));
  p.on('console', m => { if (m.type()==='error' && !/404/.test(m.text())) errs.push(name+' console: '+m.text().slice(0,160)); });
  await p.goto('http://127.0.0.1:8765/index.html', { waitUntil:'load' });
  await p.waitForSelector('#jg-gate.is-in', { timeout: 20000 });
  await p.click('.jg-path[data-role="interviewer"]');
  await p.waitForSelector('.jg-namestep input', { timeout: 5000 });
  await p.waitForTimeout(700);
  await p.screenshot({ path: S+'/v2/'+name+'-name.png' });
  await p.fill('.jg-namestep input', 'Marcus');
  await p.keyboard.press('Enter');
  await p.waitForSelector('#jg-guide.is-open', { timeout: 8000 });
  await p.waitForTimeout(2500);
  const said = await p.textContent('.jg-say');
  await p.screenshot({ path: S+'/v2/'+name+'-greet.png' });
  await p.waitForTimeout(1200);
  const ev = tracked.flatMap(t=>t.events.map(e=>e.event+(e.set?'(set '+Object.keys(e.set).join(',')+')':'')));
  console.log(name, 'greeting:', said.trim().slice(0,60), '| tracked:', ev.join(', '));
  await ctx.close();
}
// admin page with mocked metrics
const ctx = await b.newContext({ viewport:{width:1440,height:1000} }); await fonts(ctx);
const mock = { at: new Date().toISOString(),
  days: Array.from({length:30},(_,i)=>{ const d=new Date(Date.now()-(29-i)*86400000); return { d: d.toISOString().slice(0,10), v: Math.round(6+Math.sin(i/3)*4+(i%7===0?9:0)), e: 20 }; }),
  totals:[{today:14,week:71,month:263}],
  roles:[{r:'interviewer',v:88},{r:'partner',v:41},{r:'lurker',v:97},{r:'skipped',v:23}],
  funnel:[{event:'site_arrived',v:263},{event:'role_chosen',v:226},{event:'name_given',v:131},{event:'guide_finished',v:74},{event:'chat_asked',v:38},{event:'intake_sent',v:12},{event:'cta_click',v:57}],
  people:[{name:'Marcus',role:'interviewer',at:new Date(Date.now()-600000).toISOString(),city:'Houston',region:'TX',country:'US',device:'Desktop',ref:'linkedin.com'},{name:'Priya',role:'partner',at:new Date(Date.now()-7200000).toISOString(),city:'Austin',region:'TX',device:'Mobile',ref:''},{name:'Dev',role:'lurker',at:new Date(Date.now()-86400000*2).toISOString(),city:null,device:'Desktop',ref:'google.com'}],
  refs:[{r:'direct',v:120},{r:'linkedin.com',v:64},{r:'google.com',v:41},{r:'github.com',v:12}],
  devices:[{d:'Desktop',v:160},{d:'Mobile',v:95},{d:'Tablet',v:8}],
  questions:[{q:'What does Deal Packet Checker actually check?',role:'partner',at:new Date().toISOString()},{q:'Are you open to remote roles?',role:'interviewer',at:new Date(Date.now()-3600000).toISOString()}],
  intents:[{pain:'paper',v:6},{pain:'followup',v:4},{pain:'convert',v:2}] };
await ctx.route('**/api/metrics*', r => r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(mock) }));
const p = await ctx.newPage();
p.on('pageerror', e => errs.push('admin pageerror: '+e.message));
await p.goto('http://127.0.0.1:8765/admin.html', { waitUntil:'load' });
await p.waitForTimeout(600);
await p.screenshot({ path: S+'/v2/admin-gate.png' });
await p.fill('.adm__gate input', 'secret'); await p.keyboard.press('Enter');
await p.waitForSelector('.board', { timeout: 8000 }); await p.waitForTimeout(2200);
await p.hover('#chart svg', { position: { x: 600, y: 120 } }); await p.waitForTimeout(300);
await p.screenshot({ path: S+'/v2/admin-board.png', fullPage: true });
const ov = await p.evaluate(()=>({docW:document.documentElement.scrollWidth, winW:window.innerWidth}));
if (ov.docW > ov.winW+1) errs.push('admin H-OVERFLOW');
await ctx.close();
const m = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true }); await fonts(m);
await m.route('**/api/metrics*', r => r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(mock) }));
const mp = await m.newPage(); await mp.goto('http://127.0.0.1:8765/admin.html', { waitUntil:'load' });
await mp.fill('.adm__gate input', 'secret'); await mp.keyboard.press('Enter'); await mp.waitForSelector('.board', { timeout: 8000 }); await mp.waitForTimeout(2000);
await mp.screenshot({ path: S+'/v2/admin-mobile.png', fullPage: true });
const ov2 = await mp.evaluate(()=>({docW:document.documentElement.scrollWidth, winW:window.innerWidth})); if (ov2.docW > ov2.winW+1) errs.push('admin mobile H-OVERFLOW '+ov2.docW);
await b.close();
console.log(errs.length ? 'ISSUES:\n'+errs.join('\n') : 'no page errors, no overflow');
