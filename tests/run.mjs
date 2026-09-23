import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { dependency } from '../tools/dependencies.mjs';
const { chromium } = dependency('playwright');
const root = path.resolve(import.meta.dirname, '..');
const browser = await chromium.launch({ headless: true, channel: process.env.MAILWEAVE_BROWSER || 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.route('**/*', route => route.abort());
// All content is generated. No real Gmail navigation or account access.
await page.route('https://mail.google.com/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>' }));
await page.goto('https://mail.google.com/mail/u/0/#inbox/synthetic-thread');
await page.evaluate(() => {
  globalThis.savedPreferences = {};
  globalThis.chrome = { storage: { local: {
    get: async defaults => ({ ...defaults, ...savedPreferences }), set: async values => Object.assign(savedPreferences, values)
  } } };
});
for (const file of ['core.js', 'source.js', 'clean.js', 'view.js']) await page.addScriptTag({ path: path.join(root, 'extension', file) });
await page.addScriptTag({ path: path.join(root, 'tests/fixture.js') });
const results = [];
async function test(name, fn) {
  try { await page.evaluate(fn); results.push({ name, status: 'pass' }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, status: 'fail', error: error.message }); console.error(`FAIL ${name}\n${error.message}`); }
}
await page.evaluate(() => { globalThis.assert = (condition, message = 'Assertion failed') => { if (!condition) throw new Error(message); }; });
await test('01–02 / 52: five hidden cached bodies load without expansion waits', async () => {
  fixture(); const source = new MailWeave.Source(); let calls = 0; source.expand = () => { calls++; };
  const loaded = await source.load(); assert(loaded.records.length === 5); assert(loaded.records.every(r => r.loaded)); assert(calls === 0); assert(loaded.timings.expansionWaitMs < 150);
});
await test('03: empty placeholder expands into full content', async () => {
  fixture(1); const node = document.querySelector('.adn'); node.className = 'adn kv'; node.querySelector('.a3s').innerHTML = '';
  node.querySelector('.adx').addEventListener('click', () => { node.querySelector('.a3s').innerHTML = '<p>Full newly loaded content</p>'; });
  const loaded = await new MailWeave.Source().load({ budget: 700 }); assert(loaded.records[0].html.includes('Full newly loaded'));
});
await test('Regression: seven h7 rows, six collapsed without provider IDs, one expanded', async () => {
  fixture(7);
  const rows = document.querySelector('#rows');
  [...rows.children].forEach((message, index) => {
    const wrapper = MailWeave.el('div', { class: 'h7' });
    message.replaceWith(wrapper);
    if (index === 6) { wrapper.append(message); return; }
    const header = MailWeave.el('div', { class: 'ady' });
    const clickTarget = MailWeave.el('div', { class: 'aju', role: 'button' });
    clickTarget.append(message.querySelector('.gD').cloneNode(true), message.querySelector('.g3').cloneNode(true));
    header.append(clickTarget); wrapper.append(header);
    clickTarget.addEventListener('click', () => { header.remove(); wrapper.append(message); });
  });
  const source = new MailWeave.Source();
  const before = source.discover();
  assert(before.records.length === 7 && before.records.filter(r => r.loaded).length === 1);
  const snapshot = await source.load({ budget: 1000 });
  assert(snapshot.records.length === 7 && snapshot.records.every(r => r.loaded));
  assert(snapshot.records.every((r, i) => r.ids.includes(`msg-${i}`)));
  assert(MailWeave.changes(before.records, snapshot.records) === 'same');
  assert(snapshot.evidence.rowStructure.length === 7);
  const cleaned = await MailWeave.clean(snapshot.records);
  assert(cleaned.items.length === 7 && cleaned.items.every(r => r.state === 'content'));
});
await test('Regression: adv grouped history expands without inventing quoted messages', async () => {
  fixture(7);
  const rows = document.querySelector('#rows'), older = [...rows.children].slice(0, 6);
  older.forEach(n => n.remove());
  const group = MailWeave.el('div', { class: 'adv', role: 'button' }, '6'); rows.prepend(group);
  group.addEventListener('click', () => group.replaceWith(...older));
  document.querySelector('.a3s').insertAdjacentHTML('beforeend', '<div class="h7"><div class="aju">Quoted lookalike</div></div>');
  const snapshot = await new MailWeave.Source().load({ budget: 1000 });
  assert(snapshot.records.length === 7 && snapshot.records.every(r => r.loaded));
});
await test('Regression: six standalone kv headers without h7 or provider IDs plus latest body', async () => {
  fixture(7);
  const rows = document.querySelector('#rows');
  const retained = [...rows.children];
  retained.slice(0, 6).forEach((message, index) => {
    const collapsed = MailWeave.el('div', { class: 'kv' });
    collapsed.append(message.querySelector('.gD').cloneNode(true), message.querySelector('.g3').cloneNode(true));
    // A snippet is deliberately not a body and must never be displayed as one.
    collapsed.append(MailWeave.el('span', { class: 'snippet' }, `Preview ${index}`));
    message.replaceWith(collapsed);
    collapsed.addEventListener('click', () => {
      message.className = 'adn ads';
      message.querySelector('.a3s').style.display = '';
      collapsed.replaceWith(message);
    });
  });
  const source = new MailWeave.Source();
  const before = source.discover();
  assert(before.records.length === 7 && before.records.filter(r => r.loaded).length === 1);
  const after = await source.load({ budget: 1000 });
  assert(after.records.length === 7 && after.records.every(r => r.loaded));
  assert(after.records.every((r, index) => r.ids.includes(`msg-${index}`)));
  assert(MailWeave.changes(before.records, after.records) === 'same');
});
await test('Regression: unfamiliar header wrapper uses sender/date evidence, never quoted or draft UI', async () => {
  fixture(3);
  const rows = document.querySelector('#rows');
  const first = rows.firstElementChild;
  const wrapper = MailWeave.el('div', { class: 'different-header-layout', role: 'button' });
  wrapper.append(first.querySelector('.gD').cloneNode(true), first.querySelector('.g3').cloneNode(true));
  first.replaceWith(wrapper);
  wrapper.addEventListener('click', () => wrapper.replaceWith(first));
  document.querySelector('.a3s').innerHTML += '<div class="kv"><span class="gD">Quoted sender</span><span class="g3">Yesterday</span></div>';
  const draft = MailWeave.el('div', { contenteditable: 'true' });
  draft.innerHTML = '<div class="kv"><span class="gD">Draft sender</span><span class="g3">Now</span></div>'; rows.append(draft);
  const source = new MailWeave.Source();
  const initial = source.discover(); assert(initial.records.length === 3);
  const result = await source.load({ budget: 1000 }); assert(result.records.length === 3 && result.records.every(r => r.loaded));
  assert(result.evidence.headerCount === 3);
});
await test('04: preview is never substituted for unavailable body', async () => {
  fixture(1); document.querySelector('.a3s').remove(); document.querySelector('.adn').append(MailWeave.el('div', { class: 'snippet' }, 'Preview'));
  const loaded = await new MailWeave.Source().load({ budget: 20 }); assert(!loaded.records[0].loaded); assert(loaded.records[0].html === null);
});
await test('Grouped history expands through Gmail controls, and totals remain honest', async () => {
  fixture(5, { total: true }); const rows = document.querySelector('#rows'); const hidden = [rows.children[0], rows.children[1]]; hidden.forEach(n => n.remove());
  const group = MailWeave.el('div', { class: 'kQ', role: 'button' }, '2 older messages'); rows.prepend(group);
  group.addEventListener('click', () => { group.replaceWith(...hidden); });
  const result = await new MailWeave.Source().load(); assert(result.records.length === 5 && result.evidence.complete);
  document.querySelectorAll('.adn').forEach(n => n.removeAttribute('aria-setsize')); const unknown = new MailWeave.Source().discover(); assert(unknown.evidence.total === null && !unknown.evidence.complete);
});
await test('05–07: changing identities, nested wrappers, body spoofing', () => {
  fixture(2); const source = new MailWeave.Source(); const before = source.discover();
  const row = document.querySelector('.adn'); row.dataset.messageId = 'stable-new';
  const wrapper = document.createElement('div'); wrapper.dataset.messageId = 'nested'; row.append(wrapper);
  document.querySelector('.a3s').innerHTML += '<div class="adn" data-message-id="fake"><span email="fake@example.com">fake</span></div>';
  const after = source.discover(); assert(after.records.length === 2); assert(after.records[0].key === before.records[0].key); assert(MailWeave.changes(before.records, after.records) === 'same');
});
await test('08: 54 becomes 56 with early and middle rows during parsing', async () => {
  fixture(56, { total: true }); const rows = document.querySelector('#rows'), early = rows.children[2], middle = rows.children[28]; early.remove(); middle.remove();
  const source = new MailWeave.Source(); const snapshot = await source.load({ checkpoint: async (_, pass) => { if (pass === 0) { rows.insertBefore(early, rows.children[2]); rows.insertBefore(middle, rows.children[28]); } } });
  assert(snapshot.records.length === 56); assert(snapshot.records[2].ids[0] === 'msg-2'); assert(snapshot.records[28].ids[0] === 'msg-28'); assert(snapshot.evidence.complete);
});
await test('09–10 / 39: older rows reconcile, new replies notify, DOM replacement stable', () => {
  fixture(4); const rows = document.querySelector('#rows'); const middle = rows.children[1]; middle.remove(); const source = new MailWeave.Source();
  const before = source.discover(); rows.insertBefore(middle, rows.children[1]); const after = source.discover(); assert(MailWeave.changes(before.records, after.records) === 'reconcile');
  const last = rows.lastElementChild.cloneNode(true); last.dataset.messageId = 'new-reply'; last.querySelector('.g3').setAttribute('title', 'Tomorrow'); rows.append(last);
  const replied = source.discover(); assert(MailWeave.changes(after.records, replied.records) === 'reply');
  rows.replaceChild(rows.firstElementChild.cloneNode(true), rows.firstElementChild); const replacement = source.discover(); assert(MailWeave.changes(replied.records, replacement.records) === 'same');
});
await test('11: one processing failure preserves other messages', async () => {
  const old = MailWeave.cleanOne; MailWeave.cleanOne = r => { if (r.html === 'bad') throw new Error('synthetic failure'); return old(r); };
  try { const { items } = await MailWeave.clean([record('good'), record('bad'), record('also good')]); assert(items[1].state === 'error'); assert(items[0].cleanHTML.includes('good') && items[2].cleanHTML.includes('also good')); } finally { MailWeave.cleanOne = old; }
});
await test('12: loading aborts promptly', async () => {
  fixture(1); document.querySelector('.a3s').remove(); const controller = new AbortController();
  const loading = new MailWeave.Source().load({ signal: controller.signal }); controller.abort();
  let canceled = false; try { await loading; } catch (e) { canceled = e.name === 'AbortError'; } assert(canceled);
});
await test('13–20: authored text, bounded quotes, mixed wrappers, split metadata', async () => {
  const billing = 'I have not received a credit application to complete. I have also not received an invoice with our updated billing information.';
  const input = [record(`<p>${billing}</p><p>Regards, a real answer</p>`), record('<p>before</p><div class="gmail_quote"><div class="gmail_attr">On yesterday Alex wrote:</div><blockquote>old<img src="https://example.com/logo"></blockquote><p>after</p></div>'), record('<blockquote>Intentional literary quotation</blockquote>'), record('<div id="divRplyFwdMsg"><b>From:</b><span>person</span><span>@example.com</span><b>Subject:</b>old</div><p>Unknown inline answer</p><p>Subject: this is authored prose</p>'), record('<p>new text mentioning gmail_signature</p><div class="gmail_signature">Explicit signature</div>')];
  const { items } = await MailWeave.clean(input);
  assert(items[0].cleanHTML.includes(billing)); assert(items[0].cleanHTML.includes('Regards'));
  assert(items[1].cleanHTML.includes('before') && items[1].cleanHTML.includes('after') && !items[1].cleanHTML.includes('logo') && !items[1].cleanHTML.includes('yesterday'));
  assert(items[2].cleanHTML.includes('Intentional')); assert(items[3].cleanHTML.includes('Unknown inline answer') && items[3].cleanHTML.includes('Subject: this is authored') && !items[3].cleanHTML.includes('@example.com'));
  assert(items[4].cleanHTML.includes('mentioning gmail_signature') && !items[4].cleanHTML.includes('Explicit signature'));
});
await test('21–24: exact endings, whole repeats, signature-only and multiple versions', async () => {
  const singleton = await MailWeave.clean([record('<p>Answer</p><p>My footer</p>')]); assert(singleton.items[0].cleanHTML.includes('My footer'));
  const { items } = await MailWeave.clean([record('<p>First answer</p><p>Footer A</p>'), record('<p>Second answer</p><p>Footer A</p>'), record('<p>Third answer</p><p>Footer B</p>'), record('<p>Fourth answer</p><p>Footer B</p>'), record('<p>Footer A</p>')]);
  assert(items.slice(0, 4).every(r => !r.cleanHTML.includes('Footer'))); assert(items[4].cleanHTML.includes('Footer A'));
  const repeat = await MailWeave.clean([record('<p>Same</p><p>Entire message</p>'), record('<p>Same</p><p>Entire message</p>')]); assert(repeat.items.every(r => r.cleanHTML.includes('Entire message')));
  const footerOnly = await MailWeave.clean([record('<p>Body A</p><p>Name</p><p>Contact</p>'), record('<p>Body B</p><p>Name</p><p>Contact</p>'), record('<p>Name</p><p>Contact</p>')]); assert(footerOnly.items[2].cleanHTML.includes('Name') && footerOnly.items[2].cleanHTML.includes('Contact'));
});
await test('Exact sender endings: BR lines, changing versions, nonterminal repetition and unknown sender', async () => {
  const input = [
    record('<div>Answer one<br><b>Team A</b><br><a href="mailto:person@example.com">person@example.com</a></div>', 'person@example.com'),
    record('<div>Answer two<br><b>Team A</b><br><a href="mailto:person@example.com">person@example.com</a></div>', 'PERSON@example.com'),
    record('<div>Answer three<br>Changed version</div>', 'person@example.com'),
    record('<p>Team A</p><p>Still substantive text after the repetition</p>', 'person@example.com'),
    record('<p>Someone else</p><p>Team A</p>', 'different@example.com'),
    record('<p>Unknown one</p><p>Same ending</p>', ''), record('<p>Unknown two</p><p>Same ending</p>', '')
  ];
  const { items } = await MailWeave.clean(input);
  assert(items[0].cleanHTML.includes('Answer one') && !items[0].cleanHTML.includes('Team A'));
  assert(items[1].cleanHTML.includes('Answer two') && !items[1].cleanHTML.includes('person@example.com'));
  assert(items[2].cleanHTML.includes('Changed version'));
  assert(items[3].cleanHTML.includes('Team A') && items[4].cleanHTML.includes('Team A'));
  assert(items.slice(5).every(r => r.cleanHTML.includes('Same ending')));
});
await test('Exact endings compare authored regions before rewritten Outlook quote headers', async () => {
  const { items } = await MailWeave.clean([
    record('<p>Original reply A</p><table role="presentation"><tr><td>Exact ending</td><td>Same cell</td></tr></table><div id="m_123divRplyFwdMsg">From: prior</div><p>Unknown quoted region A</p>'),
    record('<p>Original reply B</p><table role="presentation"><tr><td>Exact ending</td><td>Same cell</td></tr></table><div id="m_456x_m_7divRplyFwdMsg">From: prior</div><p>Unknown quoted region B</p>')
  ]);
  assert(items.every(r => !r.cleanHTML.includes('Exact ending')));
  assert(items[0].cleanHTML.includes('Original reply A') && items[0].cleanHTML.includes('Unknown quoted region A'));
  assert(items[1].cleanHTML.includes('Original reply B') && items[1].cleanHTML.includes('Unknown quoted region B'));
});
await test('No footer guesses from language, contacts, visual styles, table markers or shared domains', async () => {
  const html = '<p>We still need the updated invoice and billing contact.</p><div style="font-size:1px;color:#aaa">Thanks and regards, Name, CEO, 123 Main St, phone 555-0100</div><table role="presentation"><tr><td><span style="font-family:template-example">​</span>Unmarked footer-like content</td></tr></table>';
  const { items } = await MailWeave.clean([record(html, 'one@company.example'), record('<p>Different body</p><p>Unmarked footer-like content</p>', 'two@company.example')]);
  assert(items[0].cleanHTML.includes('updated invoice') && items[0].cleanHTML.includes('555-0100') && items[0].cleanHTML.includes('Unmarked footer-like content'));
  assert(items[1].cleanHTML.includes('Unmarked footer-like content'));
});
await test('Rewritten mobile signatures, split reply headers, and blank-line compaction', async () => {
  const { items } = await MailWeave.clean([record('<p>Real answer</p><div id="m_123ms-outlook-mobile-signature">Explicit mobile signature</div><div><p><b>From:</b> Sender &lt;from@example.com&gt;<br><b>Sent:</b> Yesterday<br><b>To:</b> Other &lt;to@example.com&gt;<br></p><div class="yj6qo"><div class="ajR" role="button"><img alt="toggle"></div></div><div><b>Subject:</b> Metadata subject</div></div><p>Unknown inline answer</p><p><br> \n <br></p><p>Bottom-posted answer</p>')]);
  assert(items[0].cleanHTML.includes('Real answer') && items[0].cleanHTML.includes('Unknown inline answer') && items[0].cleanHTML.includes('Bottom-posted answer'));
  assert(!items[0].cleanHTML.includes('Metadata subject') && !items[0].cleanHTML.includes('Explicit mobile signature') && !items[0].cleanHTML.includes('toggle'));
  assert(!items[0].cleanHTML.includes('<br>'));
});
await test('Date metadata prefers actual Gmail date over attachment title', () => {
  fixture(1); const row = document.querySelector('.adn'); const header = MailWeave.el('div', { class: 'gH' });
  header.innerHTML = '<span title="attachment.jpg">Attachment</span>'; row.prepend(header);
  assert(new MailWeave.Source().discover().records[0].timestamp !== 'attachment.jpg');
});
await test('17: flat reply history removes exact prior content, retains inline unknown answers', async () => {
  const { items } = await MailWeave.clean([record('<p>Prior substantive message</p>'), record('<p>Current response</p><div id="divRplyFwdMsg">From: Alex</div><div>Prior substantive message</div><p>Inline new answer</p>')]);
  assert(items[1].cleanHTML.includes('Inline new answer')); assert(!items[1].cleanHTML.includes('Prior substantive message'));
});
await test('Wrapped Gmail attribution removes its bounded quote and media, preserves surrounding replies', async () => {
  const html = '<p>Current reply before history</p><div class="gmail_quote"><div><p>Another authored sentence</p><div class="adm"><div class="ajR"><div class="ajT"></div></div></div><div class="h5"><div class="gmail_attr">On yesterday Sender wrote:<br></div></div></div><blockquote class="gmail_quote"><p>Prior request</p><table><tr><td>Old signature</td></tr></table><img src="https://example.com/logo"><blockquote>Still older history</blockquote></blockquote><p>Bottom-posted current answer</p></div>';
  const { items } = await MailWeave.clean([record(html)]);
  assert(items[0].cleanHTML.includes('Current reply before history'));
  assert(items[0].cleanHTML.includes('Another authored sentence'));
  assert(items[0].cleanHTML.includes('Bottom-posted current answer'));
  assert(!/Prior request|Old signature|Still older history|yesterday|data-mw-media/.test(items[0].cleanHTML));
  assert(items[0].removals.some(e => e.category === 'bounded-client-quote' && e.mediaCount === 1));
});
await test('Attribution elsewhere in a wrapper cannot authorize removal of an unrelated quotation', async () => {
  const html = '<div class="gmail_quote"><div><div class="gmail_attr">Older attribution</div><p>I am quoting a poem next.</p></div><blockquote>Intentional quoted prose</blockquote></div>';
  const { items } = await MailWeave.clean([record(html)]);
  assert(items[0].cleanHTML.includes('I am quoting a poem next.'));
  assert(items[0].cleanHTML.includes('Intentional quoted prose'));
});
await test('25–26: clipped authored ending retained; clipped bounded quote does not disqualify author', async () => {
  const { items } = await MailWeave.clean([record('<p>Answer A</p><p>Footer</p>', undefined, { clipped: true }), record('<p>Answer B</p><p>Footer</p>')]); assert(items.every(r => r.cleanHTML.includes('Footer')));
  fixture(2); document.querySelectorAll('.a3s').forEach((b, i) => { b.innerHTML = `<p>Answer ${i}</p><p>Footer</p><blockquote type="cite">old <span class="a6S">clipped history</span></blockquote>`; });
  // Same verified email needed for sender-ending evidence.
  document.querySelectorAll('.gD').forEach(n => n.setAttribute('email', 'alex@example.com'));
  const clean = await MailWeave.clean(new MailWeave.Source().discover().records); assert(clean.items.every(r => !r.cleanHTML.includes('Footer')));
});
await test('27–29: media ownership follows verified removal boundaries', async () => {
  const { items } = await MailWeave.clean([record('<p>Answer A</p><img alt="authored photo" src="https://example.com/same"><div><p>Exact footer</p><img alt="logo" src="https://example.com/1"></div><blockquote type="cite">old<img src="https://example.com/q1"></blockquote>'), record('<p>Answer B</p><div><p>Exact footer</p><img alt="logo" src="https://example.com/2"></div><blockquote type="cite">old<img src="https://example.com/q2"></blockquote>'), record('<p>Different sender</p><img alt="unrelated photo" src="https://example.com/same">', 'other@example.com')]);
  assert(items[0].cleanHTML.includes('authored photo')); assert(!items[0].cleanHTML.includes('logo')); assert(!items[1].cleanHTML.includes('logo')); assert(items[2].cleanHTML.includes('unrelated photo'));
});
await test('30–31: layout, tables, Unicode, RTL, links, preformatted whitespace', async () => {
  const { items } = await MailWeave.clean([record('<p></p><ul><li></li><li>Keep numbered item</li></ul><table><tr><td></td><td><br></td></tr></table><table><tr><td>A</td><td>B</td></tr></table><pre>  alpha\n    beta</pre><p dir="rtl">שלום مرحبا 👋 café</p><a href="https://example.com">Meaningful link</a>')]);
  const html = items[0].cleanHTML; assert(!html.includes('<p></p>') && !html.includes('<li></li>')); assert(html.includes('<td>A</td><td>B</td>')); assert(html.includes('  alpha\n    beta')); assert(html.includes('dir="rtl"') && html.includes('👋 café')); assert(html.includes('https://example.com'));
  assert((html.match(/<table>/g) || []).length === 1);
});
await test('32–35 / 40: reserved layout, resize, restore, continuous bubbles, compose usable', async () => {
  fixture(5); let original = 0; const view = new MailWeave.View({ close() {}, refresh() {}, copy() {}, original() { original++; } }, 440);
  const gmail = document.querySelector('[role="main"]').getBoundingClientRect(), panel = view.host.getBoundingClientRect(); assert(gmail.right <= panel.left, `overlap ${gmail.right} > ${panel.left}`);
  view.resize(600, true); assert(view.width === 600); await MailWeave.pause(0); assert(savedPreferences.width === 600);
  assert(Math.abs(MailWeave.bubbleRatio(801) - MailWeave.bubbleRatio(799)) < .002); assert(MailWeave.bubbleRatio(850) <= 2 / 3);
  const compose = document.querySelector('#compose'); compose.addEventListener('click', () => { compose.dataset.clicked = 'yes'; }); compose.click(); assert(compose.dataset.clicked === 'yes');
  const reply = document.querySelector('textarea'); reply.focus(); reply.value = 'Draft survives'; assert(document.activeElement === reply);
  view.destroy(); assert(!document.querySelector('#mailweave-layout')); assert(reply.value === 'Draft survives');
});
await test('Opening and resizing preserves Gmail navigation width and label placement', () => {
  fixture(1);const root=document.querySelector('body > .nH');root.style.display='flex';
  const rail=MailWeave.el('nav',{class:'nH','aria-label':'Gmail navigation'});
  rail.style.cssText='width:220px;max-width:64px;flex-shrink:0;';
  rail.innerHTML='<div style="display:flex;flex-wrap:wrap"><span style="width:48px;height:32px">Icon</span><span style="width:64px">Mail</span></div>';
  root.prepend(rail);const main=document.querySelector('[role="main"]');main.style.cssText='flex:1;min-width:0;';
  const geometry=()=>{const r=rail.getBoundingClientRect(),label=rail.lastElementChild.lastElementChild.getBoundingClientRect();return [r.width,label.left-r.left,label.top-r.top];};
  const before=geometry(),inline=rail.getAttribute('style');
  const view=new MailWeave.View({close(){},refresh(){},copy(){},original(){}},440);
  try {
    for(const width of [440,650,320]){view.resize(width,false);assert(JSON.stringify(geometry())===JSON.stringify(before),'Gmail navigation geometry changed');assert(main.getBoundingClientRect().right<=view.host.getBoundingClientRect().left+1);}
  } finally {view.destroy();}
  assert(rail.getAttribute('style')===inline&&JSON.stringify(geometry())===JSON.stringify(before));
});
await test('36: participant colors are stable and aliases explicit', () => {
  const colors = new MailWeave.Colors(['you@example.com', 'alias@example.com']);
  assert(colors.get(record('', 'first@example.com')).color === '#ffffff');
  assert(colors.get(record('', 'you@example.com')).color === '#D9FDD3'); assert(colors.get(record('', 'alias@example.com')).self);
  const second = colors.get(record('', 'second@example.com')).color; colors.get(record('', 'third@example.com')); assert(colors.get(record('', 'second@example.com')).color === second);
});
await test('Original navigation expands cached collapsed body and restores highlight on close', async () => {
  fixture(2); const source = new MailWeave.Source(), first = source.discover().records[0], controller = new AbortController();
  await source.original(first, controller.signal); assert(first.node.classList.contains('ads')); assert(first.node.style.outline.includes('3px')); controller.abort(); assert(!first.node.style.outline);
});
await test('37: only attachment UI outside body counts', () => {
  fixture(1); document.querySelector('.a3s').innerHTML += '<div class="aQH"><div class="aZo">Fake file</div></div><img alt="logo">';
  document.querySelector('.adn').insertAdjacentHTML('beforeend', '<div class="aQH"><div class="aZo"><span class="aV3">photo.png</span><span download_url="image/png:photo.png:example">download</span></div></div>');
  const record = new MailWeave.Source().discover().records[0]; assert(record.attachments.length === 1 && record.attachments[0].name === 'photo.png');
});
await test('38: original navigation, links, selection and keyboard remain separate', async () => {
  fixture(1); let navigations = 0;
  const view = new MailWeave.View({ close() {}, refresh() {}, copy() {}, original() { navigations++; } });
  const { items } = await MailWeave.clean([record('<p>Select me</p><a href="https://example.com">Link</a>')]); await view.render(items, { total: 1 }, new MailWeave.Colors());
  const article = view.shadow.querySelector('article'), link = article.querySelector('a'); link.addEventListener('click', e => e.preventDefault()); link.click(); assert(navigations === 0);
  article.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); assert(navigations === 1);
  const range = document.createRange(); range.selectNodeContents(article.querySelector('p')); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); article.click(); assert(navigations === 1); selection.removeAllRanges(); article.click(); assert(navigations === 2); view.destroy();
});
await test('Account metadata and aliases use exact normalized email matching only', () => {
  const doc=document.implementation.createHTMLDocument('');
  doc.body.innerHTML='<a href="https://accounts.google.com/" aria-label="wrong@example.com"></a><div class="a3s"><meta name="og-profile-acct" content="spoof@example.com"></div>';
  const source=new MailWeave.Source(doc); assert(source.account()==='');
  const meta=doc.createElement('meta');meta.name='og-profile-acct';meta.content='  Owner.Name+tag@Example.COM  ';doc.head.append(meta);
  assert(source.account()==='owner.name+tag@example.com');
  const colors=new MailWeave.Colors([source.account(),' ALIAS@EXAMPLE.COM ']);
  assert(colors.get(record('body',' OWNER.NAME+TAG@example.com ')).self);
  assert(colors.get(record('body','alias@example.com')).self);
  for(const address of ['ownername+tag@example.com','owner.name@example.com','other@example.com','spoof@example.com']) assert(!colors.get(record('body',address)).self);
  meta.remove();assert(source.account()==='');
  assert(!new MailWeave.Colors(['alias@example.com']).get(record('body','owner.name+tag@example.com')).self);
});
await test('Date reply metadata and Gmail collapsed history remove exact repetitions only', async () => {
  const previous = record('<p>Prior answer.</p><p>Older detail.</p>');
  const current = record('<p>New answer.</p><div><div class="adm"><div class="ajR"></div></div><div class="h5"><div><b>From:</b> A &lt;a@example.com&gt;<br><b>Date:</b> Today<br><b>To:</b> B &lt;b@example.com&gt;<br><b>Subject:</b> Test</div><p>Prior answer.</p><p>Older detail.</p><p>Unique inline answer.</p></div></div>');
  const {items} = await MailWeave.clean([previous,current]);
  assert(items[1].cleanHTML.includes('New answer.') && items[1].cleanHTML.includes('Unique inline answer.'));
  assert(!items[1].cleanHTML.includes('Prior answer.') && !items[1].cleanHTML.includes('Older detail.') && !items[1].cleanHTML.includes('Subject:'));
});
await test('Outlook reference container removes all nested history and preserves surrounding replies', async () => {
  const {items} = await MailWeave.clean([record('<p>New message.</p><div id="m_-123x_mail-editor-reference-message-container"><p>Old attribution</p><blockquote>Old text<img alt="old logo"><div>Old disclaimer</div></blockquote></div><p>Bottom reply.</p><div id="custom-mail-editor-reference-message-container">Unverified name</div><div id="m_123Signature">Marked footer</div>')]);
  assert(items[0].cleanHTML.includes('New message.') && items[0].cleanHTML.includes('Bottom reply.') && items[0].cleanHTML.includes('Unverified name'));
  assert(!/Old|Marked footer|old logo/.test(items[0].cleanHTML));
});
await test('Image overlays do not mark bodies clipped or block exact sender endings', async () => {
  fixture(1);document.querySelector('.a3s').innerHTML='<p>Body</p><img class="a6T"><div class="a6S"><button jsaction="click:test">Save</button><div role="tooltip">Download</div></div>';
  assert(!new MailWeave.Source().discover().records[0].clipped);
  const media='<img class="a6T"><div class="a6S"><button jsaction="click:test">Save</button><div role="tooltip">Download</div></div>';
  const {items}=await MailWeave.clean([record('<p>Answer A</p><div><p>Exact footer</p>'+media+'</div>',undefined,{clipped:true}),record('<p>Answer B</p><div><p>Exact footer</p>'+media+'</div>',undefined,{clipped:true})]);
  assert(items.every(r=>!r.cleanHTML.includes('Exact footer')&&!r.cleanHTML.includes('Download')));
  document.querySelector('.a3s').innerHTML+='<a href="https://mail.google.com/mail/u/0?view=lg">Full message</a>';
  assert(new MailWeave.Source().discover().records[0].clipped);
});
await test('All incoming senders share the left edge; own bubbles share the right edge', async () => {
  fixture(1); const view=new MailWeave.View({close(){},refresh(){},copy(){},original(){}},800);
  const records=Array.from({length:8},(_,i)=>record('<p>Reply '+i+'</p>',i<6?'sender'+i+'@example.com':'owner@example.com'));
  records[2].attachments=[{name:'incoming.pdf'}]; records[7].attachments=[{name:'file.pdf'}];
  const {items}=await MailWeave.clean(records); await view.render(items,{total:8},new MailWeave.Colors(['owner@example.com']));
  const rows=[...view.shadow.querySelectorAll('.row')];
  rows.forEach((row,i)=>{const r=row.getBoundingClientRect(),b=row.querySelector('.bubble').getBoundingClientRect();const clip=row.querySelector('.attachment'),right=clip?clip.getBoundingClientRect().right:b.right;assert(Math.abs(i<6?b.left-r.left:right-r.right)<1);if(clip){assert(clip.getBoundingClientRect().left>=b.right);assert(clip.querySelector('svg')&&!clip.textContent.includes('📎'));}assert(getComputedStyle(row.querySelector('.body')).textAlign==='left');});
  assert(rows[6].textContent.includes('You')); view.destroy();
});
await test('External clipping notice after truncated quotation allows exact authored endings', async () => {
  const tail='<blockquote type="cite"><p>Truncated older content</p></blockquote><div class="iX">[Message clipped] <a href="https://mail.google.com/mail/u/0?view=lg">View entire message</a></div>';
  const {items}=await MailWeave.clean([record('<p>First reply</p><div><p>Same signature</p><img alt="logo"><p>Same disclaimer</p></div>'+tail,undefined,{clipped:true}),record('<p>Different reply</p><div><p>Same signature</p><img alt="logo"><p>Same disclaimer</p></div>'+tail,undefined,{clipped:true})]);
  assert(items.every(r=>!r.cleanHTML.includes('Same signature')&&!r.cleanHTML.includes('Same disclaimer')&&!r.cleanHTML.includes('logo')));
  assert(items[0].cleanHTML.includes('First reply')&&items[1].cleanHTML.includes('Different reply'));
});
await test('External clipping notice in authored content still prevents suffix removal', async () => {
  const notice='<div class="iX">[Message clipped] <a href="https://mail.google.com/mail/u/0?view=lg">View entire message</a></div>';
  const {items}=await MailWeave.clean([record('<p>First reply</p><p>Repeated but incomplete</p>'+notice,undefined,{clipped:true}),record('<p>Second reply</p><p>Repeated but incomplete</p>'+notice,undefined,{clipped:true})]);
  assert(items.every(r=>r.cleanHTML.includes('Repeated but incomplete')));
});
await test('Sanitized media is gated per message, refresh-stable, compact on failure', async () => {
  fixture(1); let opened=0;const view=new MailWeave.View({close(){},refresh(){},copy(){},original(){opened++;}});
  const {items}=await MailWeave.clean([record('<p>Photo</p><img src="https://external.invalid/photo.png" alt="diagram" width="4000" height="4000" onerror="evil()"><audio autoplay preload="auto" src="https://external.invalid/audio.mp3"></audio><video poster="https://external.invalid/poster.png"><source src="https://external.invalid/video.mp4"></video><img src="javascript:evil()" alt="bad"><div class="gmail_signature"><img src="https://external.invalid/logo.png"></div>')]);
  items[0].key='media-one';
  await view.render(items,{total:1},new MailWeave.Colors());
  assert(!view.shadow.querySelector('img,audio,video'));assert(view.shadow.querySelectorAll('.load-media').length===1);
  assert(!items[0].cleanHTML.includes('onerror')&&!items[0].cleanHTML.includes('width=')&&!items[0].cleanHTML.includes('logo.png'));
  view.shadow.querySelector('.load-media').click();
  assert(opened===0 && view.mediaPermissions.has('media-one'));
  const img=view.shadow.querySelector('img'),audio=view.shadow.querySelector('audio'),video=view.shadow.querySelector('video');
  assert(img.loading==='lazy' && img.referrerPolicy==='no-referrer' && !img.hasAttribute('width'));
  assert(audio.controls && video.controls && audio.preload==='none' && !audio.autoplay && !video.hasAttribute('poster'));
  img.dispatchEvent(new Event('error'));assert(!view.shadow.querySelector('img') && view.shadow.textContent.includes('diagram — unavailable'));
  await view.render(items,{total:1},new MailWeave.Colors());assert(!view.shadow.querySelector('.load-media'));
  const other={...items[0],key:'media-two'};await view.render([other],{total:1},new MailWeave.Colors());assert(view.shadow.querySelector('.load-media'));view.destroy();
});
await test('Automatic image host allowlist is HTTPS-only and exact', async () => {
  for(const url of ['https://mail.google.com/image','https://ci3.googleusercontent.com/proxy/image','https://lh3.googleusercontent.com/image'])assert(MailWeave.googleImage(url));
  for(const url of ['http://mail.google.com/image','https://mail.google.com.evil.test/image','https://googleusercontent.com.evil.test/image','https://example.com/image','data:image/png,x','javascript:alert(1)'])assert(!MailWeave.googleImage(url));
  fixture(1);const view=new MailWeave.View({close(){},refresh(){},copy(){},original(){}});
  const {items}=await MailWeave.clean([record('<img src="https://ci3.googleusercontent.com/proxy/image" alt="photo">')]);await view.render(items,{total:1},new MailWeave.Colors());
  assert(view.shadow.querySelector('img')?.loading==='lazy');assert(!view.shadow.querySelector('.load-media'));view.destroy();
});
await test('Forwarded attribution with matching mailto removes bounded history and its images', async () => {
  const html='<p>New reply</p><img src="https://ci3.googleusercontent.com/authored" alt="authored diagram"><div>On Mon, Sep 14, 2026 A &lt;<a href="mailto:a@example.com">a@example.com</a>&gt; wrote:<br></div><blockquote><p>Older reply</p><img src="https://ci3.googleusercontent.com/old" alt="old banner"><blockquote>Nested footer</blockquote></blockquote><p>Bottom reply</p>';
  const {items}=await MailWeave.clean([record(html)]);const out=items[0].cleanHTML;
  assert(out.includes('New reply')&&out.includes('Bottom reply')&&out.includes('authored diagram'));
  assert(!out.includes('Older reply')&&!out.includes('old banner')&&!out.includes('Nested footer')&&!out.includes('wrote:'));
  const unmatched=await MailWeave.clean([record(html.replace('mailto:a@example.com','mailto:other@example.com'))]);assert(unmatched.items[0].cleanHTML.includes('Older reply'));
});
await test('Flattened marked signature matches complete prior signature text and image URLs', async () => {
  const signature='<div class="gmail_signature"><div>Sender Name</div><div>Contact detail</div><img src="https://ci3.googleusercontent.com/signature"><div class="a6S"><button jsaction="click:download">Download</button></div></div>';
  const suffix='<p><span class="m_-123gmailsignatureprefix">-- </span></p><p>Sender Name</p><p>Contact detail</p><p><img src="https://ci3.googleusercontent.com/signature"></p>';
  const {items}=await MailWeave.clean([record('<p>Earlier message</p>'+signature),record('<p>New authored reply</p><img src="https://ci3.googleusercontent.com/authored" alt="authored">'+suffix)]);
  assert(items[1].cleanHTML.includes('New authored reply')&&items[1].cleanHTML.includes('authored')&&!items[1].cleanHTML.includes('Contact detail')&&!items[1].cleanHTML.includes('/signature'));
  const changed=await MailWeave.clean([record(signature),record(suffix.replace('/signature','/different'))]);assert(changed.items[1].cleanHTML.includes('Contact detail'));
});
await test('41–43: malicious HTML inert, original unchanged, no media requests', async () => {
  fixture(1); const body = document.querySelector('.a3s'); body.innerHTML = '<p style="position:fixed;inset:0" onclick="window.pwned=1">safe</p><script>window.pwned=1</script><img src="https://tracking.invalid/pixel" onerror="window.pwned=1"><a href="javascript:alert(1)">bad URL</a><iframe src="https://tracking.invalid"></iframe><form><button>Fake controls</button></form>';
  const original = body.innerHTML; const source = new MailWeave.Source().discover(); const { items } = await MailWeave.clean(source.records);
  const html = items[0].cleanHTML; assert(!/(onclick|onerror|javascript:|<script|<iframe|<form|<button|style=|src=)/i.test(html)); assert(body.innerHTML === original); assert(!globalThis.pwned);
});
await test('44–45: fresh export includes newly found rows; unrendered differs from empty', async () => {
  fixture(2); const source = new MailWeave.Source(); const first = source.discover(); first.records[0].html = ''; const clean = await MailWeave.clean(first.records.slice(0, 1));
  const fresh = await source.load(); const data = JSON.parse(MailWeave.exportThread(fresh, clean.items));
  assert(data.count === 2 && data.messages[1].originalHTML.includes('Message 2')); assert(data.messages[0].display.rendered && data.messages[0].display.state === 'empty'); assert(data.messages[1].display.state === 'not-rendered');
});
await test('48: genuine Gmail origin only', () => {
  assert(MailWeave.gmail('https://mail.google.com/mail/u/1/#inbox')); assert(!MailWeave.gmail('https://mail.google.com.evil.test/')); assert(!MailWeave.gmail('http://mail.google.com/')); assert(!MailWeave.gmail('https://evil.test/?mail.google.com'));
});
await test('No Chat context on mailbox page or body-only subject spoof', () => {
  fixture(2); document.querySelector('.hP').remove(); assert(new MailWeave.Source().context() === null);
  document.querySelector('.a3s').innerHTML += '<h2 class="hP">Spoofed thread</h2>'; assert(new MailWeave.Source().context() === null);
});
await page.setViewportSize({ width: 560, height: 800 });
await test('33: narrow viewport clamps both areas and keyboard resize persists', async () => {
  fixture(2); const view = new MailWeave.View({ close() {}, refresh() {}, copy() {}, original() {} }, 1200);
  assert(view.width <= 269); assert(document.querySelector('[role="main"]').getBoundingClientRect().right <= view.host.getBoundingClientRect().left);
  assert(view.closeButton.getBoundingClientRect().right <= innerWidth); view.divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  await MailWeave.pause(0); assert(savedPreferences.width === view.width); view.destroy();
});
await page.setViewportSize({ width: 1440, height: 1000 });
// App-level race, notice, fresh copy and reinjection tests use the real controller.
await page.addScriptTag({ path: path.join(root, 'extension/app.js') });
await test('App / 09–10 / 12 / 34 / 46 / 51: lifecycle, notices, export recovery, reinjection', async () => {
  fixture(4); const app = MailWeave.app; app.check(); await app.open(); assert(app.displayed.length === 4);
  const rows = document.querySelector('#rows'), reply = rows.lastElementChild.cloneNode(true); reply.dataset.messageId = 'new-last'; reply.querySelector('.g3').title = 'Tomorrow'; rows.append(reply); app.check(); assert(!app.view.notice.hidden);
  await app.refresh(); assert(app.displayed.length === 5 && app.view.notice.hidden);
  const clipboard = navigator.clipboard.writeText; navigator.clipboard.writeText = async () => { throw new Error('denied'); }; await app.copy(); assert(app.view.status.textContent.includes('failed')); assert(app.displayed.length === 5); navigator.clipboard.writeText = clipboard;
  let captured; navigator.clipboard.writeText = async text => { captured = JSON.parse(text); }; await app.copy(); assert(captured.count === 5); navigator.clipboard.writeText = clipboard;
  app.close(); const opening = app.open(); assert(app.view && app.view.closeButton); app.close(); await opening; assert(!app.view && !document.querySelector('#mailweave-layout'));
  await app.open(); const reading = app.refresh(); location.hash = '#inbox/other-synthetic'; app.check(); await reading; assert(!app.view && !app.snapshot);
  app.destroy(); assert(!document.querySelector('#mailweave-launcher'));
});
await page.addScriptTag({ path: path.join(root, 'extension/app.js') });
await test('Account metadata changes clear prior identity and reopen with current account', async () => {
  fixture(2); const app=MailWeave.app;
  const meta=document.createElement('meta');meta.name='og-profile-acct';meta.content='first@example.com';document.head.append(meta);
  app.check();await app.open();assert(app.colors.self.has('first@example.com'));
  app.mediaPermissions.add('test-media');
  app.close();await app.open();assert(app.mediaPermissions.has('test-media'));
  meta.content='second@example.com';
  await new Promise(r=>setTimeout(r,240));assert(!app.view);
  await app.open();assert(app.colors.self.has('second@example.com')&&!app.colors.self.has('first@example.com'));
  assert(!app.view.shadow.textContent.includes('This is me'));
  meta.remove();await new Promise(r=>setTimeout(r,240));assert(!app.view);
  await app.open();assert(!app.colors.self.has('second@example.com'));app.close();
});
await test('Automatic opening persists, follows conversations and respects manual Close', async () => {
  fixture(2);const app=MailWeave.app;app.check();await app.open();
  const checkbox=app.view.autoOpen;assert(!checkbox.checked);
  checkbox.checked=true;checkbox.dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,20));assert(savedPreferences.autoOpen===true);
  app.view.closeButton.click();app.check();assert(!app.view);
  const original=location.hash;history.replaceState(null,'','#inbox/auto-open-test');app.check();await new Promise(r=>setTimeout(r,30));
  for(let i=0;i<100&&(!app.view||app.loading);i++)await new Promise(r=>setTimeout(r,10));
  assert(app.view&&app.view.autoOpen.checked);
  app.view.autoOpen.checked=false;app.view.autoOpen.dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,20));
  assert(savedPreferences.autoOpen===false);app.close();history.replaceState(null,'',original);app.check();assert(!app.view);
});
await test('Launcher joins header controls and recovers after Gmail replaces the header', async () => {
  fixture(2); const app=MailWeave.app;app.close();
  const header=document.createElement('header');header.id='gb';header.style.display='flex';
  header.innerHTML='<button>Settings</button><div><a href="https://www.google.com/intl/en/about/products">Apps</a></div><button>Account</button>';
  document.body.prepend(header);app.check();
  assert(app.launcher.parentElement===header && app.launcher.nextElementSibling.querySelector('a'));
  assert(getComputedStyle(app.launcher).position==='static');
  const replacement=header.cloneNode(true);replacement.querySelector('#mailweave-launcher')?.remove();header.replaceWith(replacement);app.check();
  assert(app.launcher.parentElement===replacement && document.querySelectorAll('#mailweave-launcher').length===1);
  app.button.click();for(let i=0;i<100&&app.loading;i++)await new Promise(r=>setTimeout(r,10));assert(app.view);app.close();
  replacement.remove();app.check();assert(app.launcher.parentElement===document.documentElement&&!app.launcher.hasAttribute('data-header'));
});
await test('Floating launcher follows divider, loading and Close without covering sidebar', async () => {
  fixture(2);const app=MailWeave.app;app.close();app.check();
  assert(!app.launcher.hasAttribute('data-header'));let rect=app.launcher.getBoundingClientRect();
  assert(Math.abs(innerWidth-rect.right-24)<1&&Math.abs(innerHeight-rect.bottom-24)<1);
  const opening=app.open();await new Promise(r=>setTimeout(r,1));
  if(app.loading){assert(app.button.disabled&&app.button.textContent==='Loading…');}
  await opening;assert(!app.launcher.hidden&&!app.button.disabled);
  for(const width of [350,600]){app.view.resize(width,false);rect=app.launcher.getBoundingClientRect();assert(Math.abs(app.view.divider.getBoundingClientRect().left-rect.right-16)<1);assert(Math.abs(innerHeight-rect.bottom-24)<1);assert(rect.left>=0);}
  app.close();rect=app.launcher.getBoundingClientRect();assert(Math.abs(innerWidth-rect.right-24)<1);
});
await test('09 / 39: post-open middle history auto-reconciles; style and media changes do not notify', async () => {
  fixture(5); const rows = document.querySelector('#rows'), middle = rows.children[2]; middle.remove(); const app = MailWeave.app; app.check(); await app.open(); assert(app.displayed.length === 4);
  rows.insertBefore(middle, rows.children[2]); app.check();
  for (let i = 0; app.loading && i < 100; i++) await MailWeave.pause(10);
  assert(app.displayed.length === 5 && app.view.notice.hidden);
  document.querySelector('.a3s').style.display = 'none'; document.querySelector('.adn').style.zoom = '1.2'; app.view.resize(460, false); app.check(); assert(app.view.notice.hidden);
  const replacement = rows.lastElementChild.cloneNode(true); replacement.dataset.messageId = 'rerendered-provider-id'; rows.lastElementChild.replaceWith(replacement); app.check(); assert(app.view.notice.hidden);
  app.close();
});
await page.addScriptTag({ path: path.join(root, 'extension/app.js') });
await page.addScriptTag({ path: path.join(root, 'extension/app.js') });
await test('34: reinjection leaves one launcher and no old dock', () => { assert(document.querySelectorAll('#mailweave-launcher').length === 1); assert(!document.querySelector('#mailweave-layout')); MailWeave.app.destroy(); });
const performanceResults = await page.evaluate(async () => {
  const measurements = [];
  for (const count of [3, 22, 56, 200]) {
    fixture(count); const begin = performance.now(); const snapshot = await new MailWeave.Source().load(); const clean = await MailWeave.clean(snapshot.records);
    const view = new MailWeave.View({ close() {}, refresh() {}, copy() {}, original() {} });
    const renderMs = await view.render(clean.items, snapshot.evidence, new MailWeave.Colors());
    measurements.push({ messages: count, ...snapshot.timings, ...clean.timings, renderMs, totalMs: performance.now() - begin }); view.destroy();
  }
  for (const depth of [20, 100, 300]) {
    const html = '<p>Keep</p>' + '<blockquote type="cite">'.repeat(depth) + 'old' + '</blockquote>'.repeat(depth); const start = performance.now();
    const clean = await MailWeave.clean([record(html)]); assert(clean.items[0].cleanHTML.includes('Keep')); measurements.push({ nestedQuoteDepth: depth, totalMs: performance.now() - start });
  }
  return measurements;
});
console.log(JSON.stringify(performanceResults, null, 2));
await page.evaluate(async () => {
  fixture(7); const source = new MailWeave.Source(); const snapshot = await source.load();
  const bodies = ['<p>Morning! The revised project plan is ready to review.</p><p>I’ve kept the timeline flexible around the launch.</p>', '<p>Thanks, Alex. Can we move the review to Thursday?</p>', '<p>Thursday works. Here are the three things we should cover:</p><ul><li>Milestones and owners</li><li>Final design feedback</li><li>Launch checklist</li></ul>', '<p>Perfect. I’ll bring the updated estimates.</p>'];
  snapshot.records.forEach((r, i) => { r.html = bodies[i % bodies.length]; });
  snapshot.records[2].attachments = [{ name: 'Project-plan.pdf' }];
  const clean = await MailWeave.clean(snapshot.records); const view = new MailWeave.View({ close() {}, refresh() {}, copy() {}, original() {} }, 480); await view.render(clean.items, snapshot.evidence, new MailWeave.Colors(['you@example.com'])); view.say('Showing messages found on this page.'); view.messages.scrollTop = 0;
});
await fs.mkdir(path.join(root, 'test-results'), { recursive: true });
await page.screenshot({ path: path.join(root, 'test-results/sidebar.png') });
const report = { version: '1.0.30', time: new Date().toISOString(), environment: { node: process.version, os: `${os.type()} ${os.release()}`, cpu: os.cpus()[0]?.model, browser: browser.version() }, results, performance: performanceResults, liveGmail: 'NOT RUN: synthetic page only; authenticated live Gmail verification outstanding.' };
await fs.writeFile(path.join(root, 'test-results/results.json'), JSON.stringify(report, null, 2));
await browser.close();
if (results.some(r => r.status === 'fail')) process.exitCode = 1;
