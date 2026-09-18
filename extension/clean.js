(() => {
  'use strict';
  const M = globalThis.MailWeave;
  const allowed = new Set('DIV P SPAN BR HR B STRONG I EM U S STRIKE SMALL SUB SUP UL OL LI DL DT DD BLOCKQUOTE PRE CODE TABLE THEAD TBODY TFOOT TR TH TD CAPTION A IMG H1 H2 H3 H4 H5 H6 BDI BDO'.split(' '));
  const active = new Set('SCRIPT STYLE IFRAME OBJECT EMBED SVG MATH FORM INPUT BUTTON TEXTAREA SELECT OPTION SOURCE LINK META BASE NOSCRIPT TEMPLATE'.split(' '));
  const blocks = 'p,div,li,pre,blockquote,table,h1,h2,h3,h4,h5,h6';
  const meaningful = text => M.normalize(text.replace(/[\u200b\ufeff]/g, ''));
  const hasContent = node => Boolean(meaningful(node.textContent) || node.querySelector('img, audio, video, [data-mw-media], pre'));
  function pairedAttribution(quote) {
    const previous = quote.previousElementSibling;
    if (!previous) return null;
    if (previous.matches('.gmail_attr, .moz-cite-prefix')) return previous;
    // Forwarding through another client can strip Gmail's attribution class.
    // Require a complete attribution-only block and a matching mailto address
    // immediately before the bounded blockquote, not a footer phrase match.
    const citation = meaningful(previous.textContent).match(/^On\s.+<([^<>\s]+@[^<>\s]+)>\s*wrote:$/s);
    if (citation && !previous.querySelector('blockquote,img,table,audio,video') && [...previous.querySelectorAll('a[href]')].some(a => {
      try { const url = new URL(a.getAttribute('href')); return url.protocol === 'mailto:' && M.email(decodeURIComponent(url.pathname)) === M.email(citation[1]); } catch { return false; }
    })) return previous;
    // Gmail wraps attribution in .h5/.im and inserts its quote-toggle UI.
    // Require an explicit client attribution at the end of the adjacent
    // wrapper. Remove only that attribution, never the entire wrapper.
    const attrs = [...previous.querySelectorAll('.gmail_attr, .moz-cite-prefix')]
      .filter(n => !n.closest('blockquote'));
    if (attrs.length !== 1) return null;
    const attr = attrs[0];
    const range = quote.ownerDocument.createRange();
    range.setStartAfter(attr); range.setEnd(previous, previous.childNodes.length);
    const tail = range.cloneContents();
    for (const toggle of tail.querySelectorAll('.adm, .yj6qo')) {
      if (!meaningful(toggle.textContent) && toggle.querySelector('.ajR')) toggle.remove();
    }
    if (meaningful(tail.textContent) || tail.querySelector('img,table,pre')) return null;
    return attr;
  }
  const clientId = (node, name) => new RegExp(`^(?:(?:m_-?\\d+)|x_)*${name}$`).test(node.id);
  // Comparison ignores formatting-only block whitespace, never substantive
  // text or table cell boundaries. It is not a fuzzy/semantic similarity test.
  function canonical(node) {
    if (node.nodeType === 3) return node.data;
    if (node.nodeType !== 1 && node.nodeType !== 11) return '';
    if (node.nodeType === 1 && node.tagName === 'PRE') return `⟦PRE:${encodeURIComponent(node.textContent)}⟧`;
    let text = [...node.childNodes].map(canonical).join('');
    if (node.nodeType === 1 && node.matches('td,th')) {
      // Nested layout cells must not multiply the same textual cell contents.
      // Leaf boundaries stay significant, including actual data-table columns.
      text = node.querySelector('table') ? text : `⟦CELL:${M.normalize(text)}⟧`;
    }
    else if (node.nodeType === 1 && node.matches(`${blocks},br,tr,hr`)) text = ` ${text} `;
    return text;
  }
  const keyOf = node => M.normalize(canonical(node).replace(/[\u200b\ufeff]/g, ''));
  function markFollowingQuote(header, root) {
    let boundary = header;
    do {
      for (let n = boundary.nextElementSibling; n; n = n.nextElementSibling) n.setAttribute('data-mw-quote', '');
      boundary = boundary.parentElement;
    } while (boundary && boundary !== root && boundary.matches('span.im, .h5'));
  }
  function indexContent(root, index) {
    const key = keyOf(root); if (key) index.add(key);
    for (const n of root.querySelectorAll(blocks)) {
      if (n.matches('blockquote') && n.parentElement?.closest('blockquote')) continue;
      if (n.parentElement?.closest('blockquote') && !n.matches('table') && n.querySelector(blocks)) continue;
      const key = keyOf(n); if (key) index.add(key);
      if (!n.matches("table,pre") && !n.querySelector("table,pre")) { const text = meaningful(n.textContent); if (text) index.add(text); }
    }
  }
  function remove(node, evidence, category) {
    evidence.push({ category, text: M.normalize(node.textContent).slice(0, 180), mediaCount: node.querySelectorAll('img').length });
    node.remove();
  }
  function compact(root, evidence) {
    // Bottom-up: only empty layout nodes; preserve BRs and PRE whitespace.
    for (const table of [...root.querySelectorAll('table')]) {
      if (root.contains(table) && !hasContent(table)) remove(table, evidence, 'empty-layout');
    }
    for (const n of [...root.querySelectorAll('p,div,span,li,ul,ol,table,tbody,tr,blockquote')].reverse()) {
      if (!n.closest('pre') && !hasContent(n) && !n.querySelector('td,th')) remove(n, evidence, 'empty-layout');
    }
    for (const n of [...root.querySelectorAll('hr')]) {
      if (!n.nextElementSibling || !n.previousElementSibling) remove(n, evidence, 'empty-layout');
    }
    for (const br of [...root.querySelectorAll('br')]) {
      if (br.closest('pre')) continue;
      const significant = (start, direction) => { let n = start; while (n && n.nodeType === 3 && !meaningful(n.textContent)) n = n[direction]; return n; };
      const before = significant(br.previousSibling, 'previousSibling'), after = significant(br.nextSibling, 'nextSibling');
      if (!before || !after || before.nodeName === 'BR' || before.nodeType === 1 && before.matches(blocks) || after.nodeType === 1 && after.matches(blocks)) remove(br, evidence, 'empty-layout');
    }
  }
  function classify(root, evidence, prior) {
    // Outlook explicitly bounds the referenced message, including nested history.
    // Remove the container before its internal metadata is transformed.
    for (const region of [...root.querySelectorAll('[id$="mail-editor-reference-message-container"]')]) {
      if (clientId(region, 'mail-editor-reference-message-container')) remove(region, evidence, 'bounded-client-quote');
    }
    // Gmail's image action overlay is UI, never authored message content.
    for (const overlay of [...root.querySelectorAll('.a6S')]) {
      if (overlay.querySelector('button[jsaction], [role="button"][jsaction]')) remove(overlay, evidence, 'gmail-image-controls');
    }
    // Gmail's collapsed-content control establishes a comparison region,
    // not permission to discard its contents. Only exact prior blocks qualify.
    for (const region of root.querySelectorAll('.h5')) {
      const toggle = region.previousElementSibling;
      if (toggle?.matches('.adm, .yj6qo') && toggle.querySelector('.ajR') && !meaningful(toggle.textContent)) region.setAttribute('data-mw-quote', '');
    }
    for (const region of [...root.querySelectorAll('[data-mw-quote]')]) {
      if (root.contains(region) && keyOf(region) && prior.has(keyOf(region))) remove(region, evidence, 'exact-prior-in-quote');
    }
    // Compare intact citations before removing their internal signatures.
    for (const quote of [...root.querySelectorAll('blockquote')]) {
      if (!prior.size || !root.contains(quote) || quote.getAttribute('type') === 'cite' || pairedAttribution(quote)) continue;
      const key = keyOf(quote);
      if (!key || !prior.has(key)) continue;
      const attribution = quote.previousElementSibling;
      if (attribution && (/^On\s.+<[^<>\s]+@[^<>\s]+>\s*wrote:$/s.test(M.normalize(attribution.textContent)) || attribution.matches('.gmail_attr, .moz-cite-prefix'))) remove(attribution, evidence, 'paired-attribution');
      remove(quote, evidence, 'exact-prior-in-quote');
    }
    for (const toggle of root.querySelectorAll('.yj6qo, .adm')) {
      if (!meaningful(toggle.textContent) && toggle.querySelector('.ajR')) remove(toggle, evidence, 'empty-layout');
    }
    for (const n of [...root.querySelectorAll('.gmail_signature, [data-smartmail="gmail_signature"], .moz-signature, [id$="ms-outlook-mobile-signature"], [id$="Signature"]')]) {
      if (n.id.endsWith('Signature') && !clientId(n, 'Signature')) continue;
      if (n.id.endsWith('ms-outlook-mobile-signature') && !clientId(n, 'ms-outlook-mobile-signature')) continue;
      if (root.contains(n)) remove(n, evidence, 'explicit-client-signature');
    }
    // A gmail_quote class alone can wrap a new reply. Require a bounded citation.
    for (const quote of [...root.querySelectorAll('blockquote[type="cite"], blockquote')]) {
      if (!root.contains(quote)) continue;
      const attribution = pairedAttribution(quote);
      const paired = Boolean(attribution);
      const exact = !paired && quote.getAttribute('type') !== 'cite' && prior.size > 0 && (prior.has(keyOf(quote)) || prior.has(M.normalize(quote.textContent))) && Boolean(M.normalize(quote.textContent));
      if (quote.getAttribute('type') === 'cite' || paired || exact) {
        if (paired) remove(attribution, evidence, 'paired-attribution');
        remove(quote, evidence, exact ? 'exact-prior-in-quote' : 'bounded-client-quote');
      }
    }
    // Outlook's header node is bounded. Never truncate its following siblings.
    for (const header of [...root.querySelectorAll('[id$="divRplyFwdMsg"]')].filter(n => clientId(n, 'divRplyFwdMsg'))) {
      markFollowingQuote(header, root);
      for (let sibling = header.nextElementSibling; sibling;) {
        const next = sibling.nextElementSibling;
        sibling.setAttribute('data-mw-quote', '');
        if ((prior.has(keyOf(sibling)) || prior.has(M.normalize(sibling.textContent))) && M.normalize(sibling.textContent)) remove(sibling, evidence, 'exact-prior-in-quote');
        sibling = next;
      }
      remove(header, evidence, 'verified-reply-header');
    }
    // Flat client history: remove only whole exact prior-message nodes within
    // established client quote context, retaining unknown inline answers.
    for (const wrapper of root.querySelectorAll('.gmail_quote, .yahoo_quoted')) {
      for (const n of [...wrapper.children]) {
        if (prior.has(M.normalize(n.textContent)) && M.normalize(n.textContent)) remove(n, evidence, 'exact-prior-in-quote');
      }
    }
    // Word-generated reply metadata may lack an ID. Require the complete
    // multi-field, line-separated header, with sender/recipient addresses.
    // A prose paragraph merely containing "Subject:" does not qualify.
    for (const header of [...root.querySelectorAll('p,div')]) {
      if (!root.contains(header)) continue;
      const labels = [...header.querySelectorAll('b,strong')].map(n => M.normalize(n.textContent));
      const text = M.normalize(header.textContent);
      if ((!['From:', 'To:', 'Subject:'].every(label => labels.includes(label)) || !['Sent:', 'Date:'].some(label => labels.includes(label))) || header.querySelectorAll('br').length < 3 || !/^From:/.test(text) || (text.match(/[^\s<>]+@[^\s<>]+/g) || []).length < 2) continue;
      const subject = [...header.querySelectorAll('b,strong')].find(n => M.normalize(n.textContent) === 'Subject:');
      const field = subject.closest('p,div');
      const walker = document.createTreeWalker(header, NodeFilter.SHOW_TEXT);
      let lastText, nextText; while ((nextText = walker.nextNode())) if (meaningful(nextText.data)) lastText = nextText;
      // Do not swallow a following reply paragraph along with header metadata.
      if (!field || !field.contains(lastText)) continue;
      let boundary = header;
      while (boundary.parentElement !== root && boundary.parentElement && keyOf(boundary.parentElement) === keyOf(header)) boundary = boundary.parentElement;
      markFollowingQuote(boundary, root);
      remove(boundary, evidence, 'verified-reply-header');
    }
    for (const region of [...root.querySelectorAll('[data-mw-quote]')]) {
      if (!root.contains(region)) continue;
      const hadText = Boolean(meaningful(region.textContent));
      const candidates = [region, ...region.querySelectorAll(blocks)];
      for (const n of candidates) if (root.contains(n) && keyOf(n) && (prior.has(keyOf(n)) || !n.matches("table,pre") && !n.querySelector("table,pre") && prior.has(meaningful(n.textContent)))) remove(n, evidence, 'exact-prior-in-quote');
      if (root.contains(region) && hadText && !meaningful(region.textContent)) remove(region, evidence, 'media-in-verified-quote');
    }
    compact(root, evidence);
  }
  function sanitize(root, evidence) {
    const doc = root.ownerDocument;
    function visit(node) {
      if (node.nodeType === 3) return doc.createTextNode(node.data);
      if (node.nodeType !== 1) return doc.createDocumentFragment();
      if (active.has(node.tagName)) {
        evidence.push({ category: 'unsafe-active-content', tag: node.tagName });
        return doc.createDocumentFragment();
      }
      if (['IMG', 'AUDIO', 'VIDEO'].includes(node.tagName)) {
        const media = doc.createElement('span');
        media.setAttribute('data-mw-media', node.tagName.toLowerCase());
        const sources = [node.getAttribute('src'), ...[...node.querySelectorAll('source[src]')].map(n => n.getAttribute('src'))].map(M.mediaURL).filter(Boolean);
        if (sources.length) media.setAttribute('data-mw-sources', JSON.stringify(sources));
        const label = node.getAttribute('alt') || node.getAttribute('aria-label') || node.tagName.toLowerCase();
        media.setAttribute('data-mw-alt', label);
        media.setAttribute('role', 'note');
        media.textContent = label + (sources.length ? ' — not loaded' : ' — unavailable');
        return media;
      }
      const target = allowed.has(node.tagName) ? doc.createElement(node.tagName.toLowerCase()) : doc.createDocumentFragment();
      if (target.nodeType === 1) {
        if (node.tagName === 'TABLE' && node.getAttribute('role') === 'presentation') target.setAttribute('role', 'presentation');
        if (['ltr', 'rtl', 'auto'].includes(node.getAttribute('dir'))) target.setAttribute('dir', node.getAttribute('dir'));
        if (node.tagName === 'A') {
          try {
            const url = new URL(node.getAttribute('href'), 'https://mail.google.com/');
            if (['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol) && node.hasAttribute('href')) {
              target.setAttribute('href', url.href); target.setAttribute('target', '_blank');
              target.setAttribute('rel', 'noopener noreferrer'); target.setAttribute('referrerpolicy', 'no-referrer');
            }
          } catch { /* Keep link text, drop malformed URL. */ }
        }
        for (const attr of ['colspan', 'rowspan', 'start', 'value']) {
          const value = node.getAttribute(attr);
          if (value && /^\d{1,3}$/.test(value)) target.setAttribute(attr, value);
        }
      }
      for (const child of node.childNodes) target.append(visit(child));
      return target;
    }
    const result = doc.createElement('div');
    for (const child of root.childNodes) result.append(visit(child));
    return result;
  }
  // Logical units are complete leaf blocks or direct text runs. Containers can
  // only be removed when every substantive child belongs to the matched suffix.
  function splitLines(root) {
    for (const node of [root, ...root.querySelectorAll('p,div')]) {
      if (!root.contains(node) && node !== root || node.closest('pre,table,[data-mw-quote]') || node.querySelector(blocks) || !node.querySelector('br')) continue;
      const lines = [];
      for (const br of [...node.querySelectorAll('br')]) {
        const range = node.ownerDocument.createRange();
        range.selectNodeContents(node); range.setEndBefore(br);
        const line = node.ownerDocument.createElement('div'); line.append(range.extractContents());
        lines.push(line); br.remove();
      }
      const final = node.ownerDocument.createElement('div'); final.append(...node.childNodes); lines.push(final);
      if (node.tagName === 'P') {
        const replacement = node.ownerDocument.createElement('div');
        if (node.hasAttribute('dir')) replacement.setAttribute('dir', node.getAttribute('dir'));
        replacement.append(...lines); node.replaceWith(replacement);
      } else node.append(...lines);
    }
  }
  function units(root) {
    const out = [];
    function walk(node) {
      if (node.nodeType === 3) { if (M.normalize(node.data)) out.push({ node, text: M.normalize(node.data) }); return; }
      if (node.nodeType !== 1) return;
      if (node.hasAttribute('data-mw-quote')) return;
      if (node.matches('pre, table')) {
        // Preserve table cell boundaries and preformatted content in comparison.
        const text = node.tagName === 'PRE' ? node.textContent : keyOf(node);
        if (M.normalize(text)) out.push({ node, text: `${node.tagName}:${text}` });
      } else if (node.matches(blocks) && !node.querySelector(blocks)) {
        if (M.normalize(node.textContent)) out.push({ node, text: M.normalize(node.textContent) });
      } else for (const child of node.childNodes) walk(child);
    }
    for (const child of root.childNodes) walk(child);
    return out;
  }
  function repeatedEndings(items) {
    const groups = new Map();
    for (const item of items) {
      if (!item.root || !item.email || item.authoredClipped) continue;
      splitLines(item.root);
      const email = M.email(item.email);
      const list = groups.get(email) || []; list.push(item); groups.set(email, list);
    }
    for (const list of groups.values()) {
      // Reverse trie indexes exact terminal sequences. Each item stops before
      // its first unit, so whole-email repetition cannot become a blank bubble.
      const trie = { children: new Map(), members: new Set() };
      for (const item of list) item.units = units(item.root);
      // A complete contribution which is itself another message's ending is
      // potentially signature-only. Preserve that contribution in full.
      const completeEndings = new Set(), fullTrie = { children: new Map(), ends: [] };
      const prefixTrie = { children: new Map() };
      for (const item of list) {
        let cursor = fullTrie;
        for (let i = item.units.length - 1; i >= 0; i--) {
          const text = item.units[i].text;
          if (!cursor.children.has(text)) cursor.children.set(text, { children: new Map(), ends: [] });
          cursor = cursor.children.get(text);
        }
        cursor.ends.push(item);
        cursor = prefixTrie; item.prefixes = [cursor];
        for (const unit of item.units) {
          if (!cursor.children.has(unit.text)) cursor.children.set(unit.text, { children: new Map() });
          cursor = cursor.children.get(unit.text); item.prefixes.push(cursor);
        }
      }
      for (const item of list) {
        let cursor = fullTrie;
        for (let i = item.units.length - 1; i > 0; i--) {
          cursor = cursor.children.get(item.units[i].text);
          for (const match of cursor.ends) completeEndings.add(match);
        }
      }
      for (const item of list) {
        if (completeEndings.has(item)) continue;
        let cursor = trie;
        for (let i = item.units.length - 1; i > 0; i--) {
          const text = item.units[i].text;
          if (!cursor.children.has(text)) cursor.children.set(text, { children: new Map(), members: new Set() });
          cursor = cursor.children.get(text); cursor.members.add(item);
        }
      }
      const plans = new Map();
      for (const item of list) {
        if (completeEndings.has(item)) continue;
        let cursor = trie, depth = 0, matched = 0;
        for (let i = item.units.length - 1; i > 0; i--) {
          cursor = cursor.children.get(item.units[i].text); depth++;
          if (!cursor || cursor.members.size < 2) break;
          // Require a differing prefix; whole-message duplicates aren't evidence.
          const prefix = item.prefixes[item.units.length - depth];
          if ([...cursor.members].some(other => other !== item && other.prefixes[other.units.length - depth] !== prefix)) matched = depth;
        }
        if (matched) plans.set(item, item.units.slice(-matched));
      }
      for (const [item, suffix] of plans) {
        const marked = new Set(suffix.map(u => u.node));
        for (const unit of suffix) {
          let region = unit.node;
          while (region.parentElement && region.parentElement !== item.root) {
            const parent = region.parentElement;
            const inside = item.units.filter(u => parent.contains(u.node));
            if (!inside.length || inside.some(u => !marked.has(u.node)) || parent.querySelector('[data-mw-quote]')) break;
            region = parent;
          }
          if (item.root.contains(region)) remove(region.nodeType === 3 ? wrapText(region) : region, item.removals, 'exact-repeated-sender-ending');
        }
        compact(item.root, item.removals);
      }
    }
  }
  function wrapText(node) { const span = node.ownerDocument.createElement('span'); node.replaceWith(span); span.append(node); return span; }
  M.cleanOne = (record, prior = new Set()) => {
    const result = { ...record, removals: [], cleanHTML: '', state: 'unavailable' };
    if (!record.loaded) return result;
    // Template parsing is inert: source HTML never enters a live document.
    const template = document.createElement('template'); template.innerHTML = record.html || '';
    const root = document.createElement('div'); root.append(template.content);
    const originallyEmpty = !hasContent(root);
    const legacyMarkers = [...root.querySelectorAll('.a6S, .a6T')];
    const clipLinks = [...root.querySelectorAll('a[href]')].filter(n => {
      try { const url = new URL(n.getAttribute('href'), 'https://mail.google.com'); return url.origin === 'https://mail.google.com' && url.searchParams.get('view') === 'lg'; } catch { return false; }
    });
    // Gmail appends its clipping notice outside the truncated HTML tree.
    // Track the last source text before that UI, before cleanup removes quotes.
    const quotedClip = new Set();
    for (const link of clipLinks) {
      const notice = link.closest('.iX');
      if (!notice) continue;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let last, text;
      while ((text = walker.nextNode())) {
        if (notice.contains(text)) break;
        if (meaningful(text.data)) last = text;
      }
      if (last?.parentElement.closest('blockquote, [id$="mail-editor-reference-message-container"]')) quotedClip.add(link);
      notice.setAttribute('data-mw-quote', '');
    }
    classify(root, result.removals, prior);
    const legacyFalsePositive = legacyMarkers.length && legacyMarkers.every(n => !root.contains(n) || n.matches('img') || n.querySelector('button[jsaction]'));
    result.authoredClipped = clipLinks.some(n => root.contains(n) && !quotedClip.has(n)) || Boolean(record.clipped && !clipLinks.length && !legacyFalsePositive);
    result.root = root;
    result.state = originallyEmpty ? 'empty' : hasContent(root) ? 'content' : 'removed';
    return result;
  };
  M.clean = async (records, { signal, progress = () => {} } = {}) => {
    const start = performance.now(), prior = new Set(), items = [];
    let lastYield = start;
    for (let i = 0; i < records.length; i++) {
      M.abort(signal);
      try {
        const item = M.cleanOne(records[i], prior); items.push(item);
        if (item.root) {
          indexContent(item.root, prior);
          const original = document.createElement('template'); original.innerHTML = records[i].html || '';
          indexContent(original.content, prior);
        }
      } catch (error) { items.push({ ...records[i], state: 'error', cleanHTML: '', removals: [{ category: 'processing-error', message: String(error.message) }] }); }
      if (performance.now() - lastYield > 12) { progress(`Cleaning ${i + 1} of ${records.length} messages…`); await M.pause(0, signal); lastYield = performance.now(); }
    }
    const classified = performance.now(); repeatedEndings(items); const compared = performance.now();
    for (const item of items) {
      M.abort(signal);
      if (item.root) {
        try {
          const safe = sanitize(item.root, item.removals); compact(safe, item.removals);
          item.cleanHTML = safe.innerHTML;
          if (item.state === 'content' && !hasContent(safe)) item.state = 'removed';
        } catch (error) { item.state = 'error'; item.cleanHTML = ''; item.removals.push({ category: 'processing-error', message: String(error.message) }); }
        delete item.authoredClipped; delete item.root; delete item.units; delete item.prefixes;
      }
      if (performance.now() - lastYield > 12) { await M.pause(0, signal); lastYield = performance.now(); }
    }
    return { items, timings: { classificationMs: classified - start, endingComparisonMs: compared - classified, sanitizeMs: performance.now() - compared } };
  };
})();
