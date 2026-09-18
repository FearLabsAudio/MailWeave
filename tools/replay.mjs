// Local, explicitly supplied export replay. Never fetches email media.
import fs from 'node:fs/promises';
import path from 'node:path';
import { dependency } from './dependencies.mjs';
const root = path.resolve(import.meta.dirname, '..');
const capture = JSON.parse(await fs.readFile(process.argv[2], 'utf8'));
const { chromium } = dependency('playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 1100 } });
  await page.route('**/*', r => r.abort());
  for (const name of ['core', 'clean', 'view']) await page.addScriptTag({ path: path.join(root, `extension/${name}.js`) });
  const summary = await page.evaluate(async ({ capture, inspect }) => {
    const records = capture.messages.map((r, i) => ({ ...r, key: String(i), ids: r.identity, html: r.originalHTML }));
    const cleaned = await MailWeave.clean(records);
    const details = records.map((r, i) => {
      const template = document.createElement('template'); template.innerHTML = r.html || '';
      const describe = n => ({ tag: n.tagName, id: n.id, cls: n.className, role: n.getAttribute('role'), text: MailWeave.normalize(n.textContent).slice(0, 110) });
      return { index: i, sender: r.sender, email: r.email, originalLength: r.html?.length,
        cleanedLength: cleaned.items[i].cleanHTML.length,
        cleanedText: (() => { const t = document.createElement('template'); t.innerHTML = cleaned.items[i].cleanHTML; return t.content.textContent; })(),
        removals: cleaned.items[i].removals.map(e => e.category),
        ...(inspect ? { signatureAncestry: [...template.content.querySelectorAll('span[style]')].filter(n => n.getAttribute('style').includes('template-')).slice(0, 1).map(n => { const a=[]; for(let p=n;p && a.length<18;p=p.parentElement) a.push({...describe(p),style:p.getAttribute('style'),length:p.textContent.length}); return a; }),
          markers: [...template.content.querySelectorAll('[id], [class], blockquote, table[role]')].filter(n => /rply|fwd|signature|quote|append|olk|body/i.test(n.id + ' ' + n.className) || n.matches('blockquote, table[role]')).map(describe),
          headerNodes: [...template.content.querySelectorAll('div,p')].filter(n => /^From:/i.test(n.textContent.trim()) && n.textContent.length < 1200).map(n => ({ ...describe(n), html: n.outerHTML.slice(0, 4000), parent: describe(n.parentElement), next: n.nextElementSibling && describe(n.nextElementSibling) })) } : {}) };
    });
    const view = new MailWeave.View({ close() {}, copy() {}, refresh() {}, original() {} }, 540);
    await view.render(cleaned.items, { total: records.length }, new MailWeave.Colors());
    view.messages.scrollTop = 0;
    return { version: MailWeave.version, timings: cleaned.timings, messages: details };
  }, { capture, inspect: process.argv.includes('--inspect') });
  if (process.argv.includes('--screenshot')) {
    await fs.mkdir(path.join(root, 'private'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'private/replay.png') });
  }
  console.log(JSON.stringify(summary, null, 2));
} finally { await browser.close(); }
