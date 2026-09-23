/* MailWeave. Independently authored; no email content is persisted. */
(() => {
  'use strict';
  globalThis.MailWeave?.app?.destroy();
  const M = globalThis.MailWeave = {};
  M.version = '1.0.30';
  M.gmail = url => { try { return new URL(url).origin === 'https://mail.google.com'; } catch { return false; } };
  M.normalize = text => (text || '').replace(/\s+/gu, ' ').trim();
  M.email = text => (text || '').trim().toLowerCase();
  M.mediaURL = value => {
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; }
  };
  M.googleImage = value => {
    const valid = M.mediaURL(value); if (!valid) return false;
    const url = new URL(valid);
    return url.protocol === 'https:' && (url.hostname === 'mail.google.com' || /^ci[0-9]+\.googleusercontent\.com$/.test(url.hostname) || url.hostname === 'lh3.googleusercontent.com');
  };
  M.abort = signal => { if (signal?.aborted) throw new DOMException('Canceled', 'AbortError'); };
  M.pause = (ms = 0, signal) => new Promise((resolve, reject) => {
    M.abort(signal);
    const stop = () => { clearTimeout(timer); reject(new DOMException('Canceled', 'AbortError')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', stop); resolve(); }, ms);
    signal?.addEventListener('abort', stop, { once: true });
  });
  M.el = (tag, attrs = {}, text) => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  M.preferences = {
    async read() { try { return await chrome.storage.local.get({ width: 440, aliases: [], autoOpen: false }); } catch { return { width: 440, aliases: [] }; } },
    async write(value) { try { await chrome.storage.local.set(value); return true; } catch { return false; } }
  };
  M.Colors = class {
    constructor(aliases = []) { this.self = new Set(aliases.map(M.email)); this.people = new Map(); }
    get(record) {
      const key = M.email(record.email) || `unknown:${record.key}`;
      if (this.self.has(key)) return { color: '#D9FDD3', self: true, index: 0 };
      if (!this.people.has(key)) this.people.set(key, this.people.size);
      const index = this.people.get(key);
      return { color: ['#ffffff', '#e4edff', '#ffe7d9', '#eee3ff', '#fff1c9', '#f5e2ec'][index % 6], self: false, index };
    }
  };
  // Provider identity, DOM continuity, then occurrence-aware metadata continuity.
  // Metadata matches reconcile replacements; they never deduplicate source rows.
  M.reconcile = (previous, current) => {
    const used = new Set();
    return current.map((record, index) => {
      let old = previous.find(x => !used.has(x) && ((record.ids.length && x.ids.some(id => record.ids.includes(id))) || x.node === record.node));
      if (!old) old = previous.find((x, oldIndex) => !used.has(x) && x.fingerprint === record.fingerprint &&
        (!x.ids.length || !record.ids.length || (previous.length === current.length && index === oldIndex)));
      if (old) { used.add(old); record.key = old.key; record.ids = [...new Set([...old.ids, ...record.ids])]; }
      return record;
    });
  };
  M.changes = (previous, current, evidence = {}) => {
    if (!previous.length) return 'reconcile';
    const known = new Set(previous.map(x => x.key));
    const added = current.filter(x => !known.has(x.key));
    if (!added.length) return 'same';
    const tail = current.findIndex(x => x.key === previous.at(-1).key);
    const appended = tail >= 0 && added.some(x => current.indexOf(x) > tail && x.ids.length);
    // An unresolved grouped/known-total load cannot establish a new reply baseline.
    const totalGrew = Number.isInteger(evidence.total) && Number.isInteger(evidence.currentTotal) && evidence.currentTotal > evidence.total;
    return appended && (!evidence.pendingHistory || totalGrew) ? 'reply' : 'reconcile';
  };
  M.exportThread = (snapshot, displayed = [], context = {}) => {
    const display = new Map(displayed.map(r => [r.key, r]));
    return JSON.stringify({
      format: 'mailweave-gmail-page-data', schemaVersion: 1, extensionVersion: M.version,
      capturedAt: new Date().toISOString(), context,
      scope: 'Gmail conversation page data only; not MIME/EML, attachment bytes, or guaranteed server-complete history. Private: review before sharing.',
      discovery: snapshot.evidence, count: snapshot.records.length,
      loadedCount: snapshot.records.filter(r => r.loaded).length,
      clippedCount: snapshot.records.filter(r => r.clipped).length,
      timings: snapshot.timings,
      messages: snapshot.records.map((r, order) => {
        const d = display.get(r.key);
        return { order, identity: r.ids, localKey: r.key, sender: r.sender, email: r.email,
          timestamp: r.timestamp, loaded: r.loaded, clipped: r.clipped,
          attachments: r.attachments, originalHTML: r.html,
          display: d ? { rendered: true, state: d.state, html: d.cleanHTML, removals: d.removals } : { rendered: false, state: 'not-rendered' } };
      })
    }, null, 2);
  };
})();
