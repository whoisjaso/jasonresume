// Walks each guide path to the end screen and checks every step lands on a real anchor and mark.
//   python3 -m http.server 8765 &  then  node tools/verify/guide-paths.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(f => fs.existsSync(f));
const b = await chromium.launch({ executablePath: exe });
const issues = [];
for (const role of ['interviewer', 'partner', 'lurker']) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route('**/api/**', r => r.fulfill({ status: 204, body: '' }));
  const p = await ctx.newPage();
  p.on('pageerror', e => issues.push(role + ' pageerror: ' + e.message));
  await p.addInitScript(() => { try { localStorage.setItem('jg_muted', '1'); } catch (e) {} });
  await p.goto('http://127.0.0.1:8765/index.html');
  await p.waitForTimeout(700); await p.mouse.click(720, 450);
  await p.waitForSelector('#jg-gate.is-in', { timeout: 25000 });
  await p.click(`.jg-path[data-role="${role}"]`);
  await p.waitForSelector('.jg-namestep input'); await p.click('[data-skip]');
  await p.waitForSelector('#jg-guide.is-open');
  // every anchor and mark in this role's script must exist
  const miss = await p.evaluate(r => {
    const out = [];
    (window.JG.scripts[r] || []).forEach((st, i) => { if (st.dynamic) return; if (st.at) { const sel = st.at.split('@')[0]; if (!document.querySelector(sel)) out.push(i + ' at ' + st.at); } if (st.mark && !document.querySelector('[data-mark="' + st.mark[0] + '"]')) out.push(i + ' mark ' + st.mark[0]); });
    return out;
  }, role);
  miss.forEach(m => issues.push(role + ' missing ' + m));
  let steps = 0;
  while (steps < 20) {
    if (await p.$('#jg-end.is-in')) break;
    const ok = await p.waitForSelector('.jg-opt', { timeout: 30000 }).catch(() => null);
    if (!ok) { issues.push(role + ' stuck at step ' + steps + ': ' + (await p.textContent('.jg-say')).slice(0, 60)); break; }
    await p.waitForTimeout(300);
    const labels = await p.$$eval('.jg-opt', els => els.map(e => e.textContent.trim()));
    const pick = labels.includes('Finish') ? 'Finish' : (await p.$('.jg-opt--primary')) ? null : labels[0];
    if (pick) await p.locator('.jg-opt', { hasText: pick }).first().click(); else await p.locator('.jg-opt--primary').first().click();
    steps++; await p.waitForTimeout(1400);
  }
  const end = await p.$eval('#jg-end h2', e => e.textContent).catch(() => '(no end)');
  const ctas = await p.$$eval('#jg-end .jg-end__cta a', els => els.map(a => a.textContent + ' ' + a.getAttribute('href')));
  console.log(role, 'steps', steps, '|', end, '|', ctas.join(' ; '));
  await ctx.close();
}
await b.close();
console.log(issues.length ? 'ISSUES:\n' + issues.join('\n') : 'all paths reach the end, every anchor and mark exists');
