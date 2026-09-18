(() => {
  'use strict';
  const M = globalThis.MailWeave;
  const ROW = '.h7, .kv, .adn, [data-message-id], [data-legacy-message-id]';
  const BODY = '.a3s';
  const EXCLUDED = '.a3s, [contenteditable="true"], [role="dialog"], [role="menu"]';
  const SENDER = '.gD, .g2[email], .go[email]';
  let serial = 0;
  const outside = node => !node.closest(EXCLUDED);
  const descendants = (node, selector) => [...node.querySelectorAll(selector)].filter(outside);
  function headerRow(sender, main) {
    // A collapsed row can lack both provider IDs and expanded-row classes.
    // Recover only a bounded Gmail header with sender + timestamp. Stop before
    // a container spanning another message, or any authored body/compose UI.
    for (let node = sender.parentElement; node && node !== main; node = node.parentElement) {
      if (!outside(node) || descendants(node, SENDER).length !== 1 || node.querySelector(BODY)) return null;
      if (node.querySelector('.g3') && !node.querySelector('.hP')) return node;
    }
    return null;
  }
  M.Source = class {
    constructor(doc = document, location = window.location) { this.doc = doc; this.location = location; this.previous = []; }
    context() {
      const mains = [...this.doc.querySelectorAll('[role="main"]')];
      const main = mains.find(n => n.getClientRects().length && n.querySelector('.hP'));
      if (!main || !main.querySelector(ROW)) return null;
      const subject = main.querySelector('.hP');
      if (subject.closest(BODY)) return null;
      return { main, key: `${this.location.pathname}${this.location.search}${this.location.hash}`, subject: subject.textContent || '' };
    }
    account() {
      return M.email(this.doc.head?.querySelector('meta[name="og-profile-acct"]')?.getAttribute('content'));
    }
    discover(context = this.context()) {
      if (!context) return { records: [], evidence: { total: null, complete: false, reason: 'No identifiable conversation' } };
      const senders = descendants(context.main, SENDER);
      const candidates = descendants(context.main, ROW);
      for (const sender of senders) {
        if (candidates.some(row => row.contains(sender))) continue;
        const row = headerRow(sender, context.main);
        if (row && !candidates.includes(row)) candidates.push(row);
      }
      candidates.sort((a, b) => a === b ? 0 : a.compareDocumentPosition(b) & 4 ? -1 : 1);
      const rows = candidates.filter(row => {
        return !candidates.some(parent => parent !== row && parent.contains(row));
      });
      const records = rows.map(node => {
        const wrappers = [node, ...node.querySelectorAll('[data-message-id], [data-legacy-message-id]')].filter(n => !n.closest(BODY));
        const ids = [...new Set(wrappers.flatMap(n => ['data-message-id', 'data-legacy-message-id'].map(a => n.getAttribute(a))).filter(Boolean))];
        const sender = [...node.querySelectorAll('.gD[email], .gD, .go[email], [email]')].find(n => !n.closest(BODY));
        // Generic titled nodes in .gH include attachment filenames.
        const date = descendants(node, '.g3')[0];
        const body = [...node.querySelectorAll(BODY)].find(n => !n.parentElement?.closest(BODY));
        // Collapsed Gmail rows use .h7 with an .ady/.aju header; the .adn
        // wrapper and provider IDs may not exist until expansion.
        const header = ['.aju', '.ady', '.adx', '.adf', '.gE'].map(selector =>
          descendants(node, selector)[0]).find(Boolean) || (node.matches('.kv') || (!body && descendants(node, SENDER).length === 1 && node.querySelector('.g3')) ? node : null);
        const expanded = node.classList.contains('ads') || Boolean(node.querySelector('.adn.ads')) || header?.getAttribute('aria-expanded') === 'true';
        const populated = Boolean(body && (body.textContent.trim() || body.querySelector('img, hr, table, br')));
        const attachments = [...node.querySelectorAll('.aQH .aZo, .aQH [download_url]')].filter(n => !n.closest(BODY))
          .filter((n, i, a) => !a.some((p, j) => i !== j && p.contains(n)))
          .map(n => ({ name: n.querySelector('.aV3')?.textContent || n.getAttribute('download') || n.getAttribute('aria-label') || 'Attachment', evidence: 'Gmail attachment area outside message body' }));
        const timestamp = date?.getAttribute('title') || date?.textContent || '';
        const email = M.email(sender?.getAttribute('email'));
        const name = sender?.getAttribute('name') || sender?.textContent || email || 'Unknown sender';
        const clip = [...node.querySelectorAll('a[href]')].filter(n => {
          try { const url = new URL(n.href); return url.origin === 'https://mail.google.com' && url.searchParams.get('view') === 'lg' && !n.closest('.gmail_quote, blockquote[type="cite"], [id$="mail-editor-reference-message-container"]'); } catch { return false; }
        });
        return { node, body, header, key: `local-${++serial}`, ids, sender: name, email, timestamp,
          fingerprint: JSON.stringify([email, name, timestamp]),
          loaded: Boolean(body && (populated || expanded)), html: body?.innerHTML ?? null,
          clipped: Boolean(clip.length), attachments };
      });
      const reconciled = M.reconcile(this.previous, records);
      this.previous = reconciled;
      const groups = [...context.main.querySelectorAll('.adx .adx, .kQ, .adx[role="button"], .adv')]
        .filter(n => !n.closest(ROW) && !n.closest(BODY) && n.getClientRects().length);
      // Gmail does not expose a universal locale-independent conversation total.
      // aria-setsize on actual rows is usable when present, inbox pagination is not.
      const totals = rows.map(n => Number(n.getAttribute('aria-setsize'))).filter(n => Number.isInteger(n) && n > 0);
      const total = totals.length && totals.every(n => n === totals[0]) ? totals[0] : null;
      return { records: reconciled, groups, evidence: { total, discovered: records.length,
        candidateCount: candidates.length,
        headerCount: senders.length,
        // Include headers the row adapter failed to recognize, not just successes.
        headerAncestry: senders.map(sender => {
          const ancestry = [];
          for (let n = sender; n && n !== context.main && ancestry.length < 8; n = n.parentElement) {
            ancestry.push({ tag: n.tagName, classes: n.className, role: n.getAttribute('role') });
          }
          return { recognized: rows.some(row => row.contains(sender)), ancestry };
        }),
        rowStructure: rows.map(n => ({ tag: n.tagName, classes: n.className,
          hasBody: Boolean(n.querySelector(BODY)), hasHeader: Boolean(n.querySelector('.ady, .aju, .adx, .adf, .gE')),
          providerIdentityCount: [n, ...n.querySelectorAll('[data-message-id], [data-legacy-message-id]')].filter(e => !e.closest(BODY) && (e.hasAttribute('data-message-id') || e.hasAttribute('data-legacy-message-id'))).length })),
        loaded: records.filter(r => r.loaded).length, groupedControls: groups.length,
        complete: total !== null && total === records.length && records.every(r => r.loaded) && !groups.length,
        reason: total === null ? 'Gmail exposes no reliable total; reporting discovered messages.' : 'Total from message aria-setsize',
        pendingHistory: Boolean(groups.length || (total !== null && total > records.length)) } };
    }
    expand(record) {
      if (record.loaded || !record.header?.isConnected) return false;
      record.header.click();
      return true;
    }
    async load({ signal, progress = () => {}, budget = 8000, checkpoint = async () => {} } = {}) {
      const start = performance.now();
      const context = this.context();
      if (!context) throw new Error('Open a Gmail conversation, then try Chat again.');
      const clicked = new Set();
      let snapshot, last = '', stable = 0, discovery = 0, waiting = 0;
      for (let pass = 0; pass < 40; pass++) {
        M.abort(signal);
        if (this.context()?.key !== context.key) throw new DOMException('Conversation changed', 'AbortError');
        const d = performance.now(); snapshot = this.discover(context); discovery += performance.now() - d;
        progress(`Reading ${snapshot.records.filter(r => r.loaded).length} of ${snapshot.evidence.total ?? snapshot.records.length} found messages…`);
        let didExpand = false;
        for (const group of snapshot.groups) if (!clicked.has(group)) { clicked.add(group); group.click(); didExpand = true; }
        for (const record of snapshot.records) if (!record.loaded && !clicked.has(record.key)) { clicked.add(record.key); didExpand = this.expand(record) || didExpand; }
        await checkpoint(snapshot, pass);
        M.abort(signal);
        const signature = snapshot.records.map(r => `${r.key}:${r.loaded}:${r.html?.length}`).join('|');
        stable = signature === last ? stable + 1 : 0; last = signature;
        const missing = snapshot.records.some(r => !r.loaded) || snapshot.evidence.pendingHistory;
        if (!didExpand && !missing && stable >= 1) break;
        if (performance.now() - start >= budget) break;
        const w = performance.now();
        await M.pause(missing || didExpand ? Math.min(220, Math.max(0, budget - (performance.now() - start))) : 0, signal);
        waiting += performance.now() - w;
      }
      M.abort(signal);
      // Final discovery is deliberately after the last yield, not the initial parse snapshot.
      snapshot = this.discover(context);
      snapshot.timings = { discoveryMs: discovery, expansionWaitMs: waiting, loadMs: performance.now() - start };
      snapshot.context = { key: context.key, subject: context.subject };
      return snapshot;
    }
    async original(record, signal) {
      M.abort(signal);
      const fresh = this.discover().records.find(r => r.key === record.key || r.ids.some(id => record.ids.includes(id)));
      if (!fresh) throw new Error('Original moved. Refresh the conversation and try again.');
      if (fresh.node.classList.contains('kv') || !fresh.loaded) fresh.header?.click();
      fresh.node.scrollIntoView({ block: 'center', behavior: 'instant' });
      const old = fresh.node.style.getPropertyValue('outline');
      const priority = fresh.node.style.getPropertyPriority('outline');
      fresh.node.style.setProperty('outline', '3px solid #4285f4', 'important');
      const restore = () => { if (fresh.node.style.outline.includes('rgb(66, 133, 244)')) { if (old) fresh.node.style.setProperty('outline', old, priority); else fresh.node.style.removeProperty('outline'); } };
      signal?.addEventListener('abort', restore, { once: true });
      setTimeout(() => { restore(); signal?.removeEventListener('abort', restore); }, 1600);
    }
  };
})();
