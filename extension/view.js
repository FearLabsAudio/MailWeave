(() => {
  'use strict';
  const M = globalThis.MailWeave;
  M.clampWidth = (width, viewport) => Math.round(Math.max(Math.min(300, viewport * .48), Math.min(Number(width) || 440, viewport - Math.min(480, viewport * .52))));
  M.bubbleRatio = width => .96 - .30 * Math.min(1, Math.max(0, (width - 400) / 400));
  const css = `
    :host { all: initial; font: 14px/1.5 system-ui, sans-serif; color: #eee; color-scheme: dark; }
    * { box-sizing: border-box; } button { font: inherit; cursor: pointer; }
    button:focus-visible, [tabindex]:focus-visible, a:focus-visible { outline: 3px solid #91c5ff; outline-offset: 3px; }
    .panel { height: 100dvh; background: #181818; display: flex; flex-direction: column; border-left: 1px solid #454545; }
    header { padding: 18px 18px 12px; border-bottom: 1px solid #373737; flex: none; }
    .brand { color: #abc6ac; font-size: 11px; font-weight: 750; letter-spacing: .13em; text-transform: uppercase; }
    .title { display: flex; gap: 8px; align-items: center; margin-top: 3px; flex-wrap: wrap; }
    .count { font-size: 12px; color: #bcbcbc; }
    .tools { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
    .tools button { color: #eee; border: 1px solid #505050; border-radius: 8px; background: #292929; padding: 6px 10px; font-size: 12px; }
    .auto-open { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; cursor: pointer; } .auto-open input { margin: 0; accent-color: #abc6ac; }
    .tools button:hover { background: #414141; } button:disabled { opacity: .55; cursor: progress; }
    .status { padding: 10px 18px; color: #ccc; font-size: 12px; overflow-wrap: anywhere; }
    .status:empty { display: none; } .notice { background: #26392b; color: #d9fdd3; padding: 10px 18px; font-size: 13px; }
    [hidden] { display: none !important; }
    .messages { min-height: 0; overflow: auto; overscroll-behavior: contain; flex: 1; padding: 14px 16px 24px; }
    .row { direction: ltr; width: 100%; display: flex; gap: 5px; align-items: center; margin-bottom: 17px; }
    .row.self { justify-content: flex-end; } .bubble { text-align: left; border-radius: 3px 14px 14px; padding: 11px 13px; color: #192119; width: fit-content; min-width: 0; max-width: var(--bubble-width, 96%); overflow-wrap: anywhere; cursor: pointer; }
    .self .bubble { margin-left: auto; border-radius: 14px 3px 14px 14px; } .sender { font-weight: 700; font-size: 12px; } .address { font-weight: 400; color: #465046; font-size: 11px; }
    time { display: block; color: #535b53; font-size: 10px; margin-bottom: 7px; } .body { font-size: 13px; line-height: 1.55; cursor: text; }
    .body > :first-child { margin-top: 0; } .body > :last-child { margin-bottom: 0; }
    .body p { margin: 0 0 .45em; } .body div { margin: 0; } .body div:empty { display: none; } .body ul, .body ol { padding-inline-start: 22px; }
    .body img, .body video { display: block; max-width: 100%; height: auto; } .body audio { max-width: 100%; } .load-media { margin-top: 8px; }
    .body a { color: #135da2; text-decoration: underline; } .body pre { white-space: pre-wrap; overflow-wrap: anywhere; font: 12px/1.5 monospace; }
    .body table { font: inherit; border-collapse: collapse; max-width: 100%; overflow-x: auto; } .body td, .body th { border: 0; padding: 2px 4px; }
    .body table[role="presentation"], .body table[role="presentation"] > tbody, .body table[role="presentation"] > tbody > tr, .body table[role="presentation"] > tbody > tr > td { display: block; padding: 0; }
    .body blockquote { margin: .6em 0; padding-inline-start: 10px; border-inline-start: 3px solid #8b9d91; }
    .body [data-mw-media] { display: inline-block; border: 1px dashed #788b7d; border-radius: 4px; padding: 3px 6px; font-size: 11px; }
    .placeholder { font-style: italic; color: #4d574e; } .attachment { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 28px; height: 28px; padding: 4px; border: 0; background: transparent; color: #eee; font-size: 17px; }
    .divider { position: absolute; top: 0; left: -4px; width: 8px; height: 100%; cursor: col-resize; touch-action: none; z-index: 2; }
    .divider:hover, .divider:focus-visible { background: #8ebc96; } footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex: none; color: #aaa; font-size: 10px; padding: 6px 18px; border-top: 1px solid #333; } footer span { min-width: 0; } .copy-raw { flex: none; margin-left: auto; height: 19px; padding: 0 5px; font-size: 10px; line-height: 17px; color: #ddd; background: #292929; border: 1px solid #505050; border-radius: 4px; } .copy-raw:hover { background: #414141; }
    @media (max-width: 600px) { header { padding: 10px; } .messages { padding: 10px 8px; } .tools button { padding: 5px; } }
  `;
  M.View = class {
    constructor(callbacks, width = 440, mediaPermissions = new Set()) {
      this.mediaPermissions = mediaPermissions; this.callbacks = callbacks; this.preferredWidth = width; this.events = new AbortController();
      this.host = M.el('div', { id: 'mailweave-sidebar' });
      this.host.style.cssText = 'position:fixed!important;right:0!important;top:0!important;height:100dvh!important;z-index:2147483000!important;display:block!important;';
      this.shadow = this.host.attachShadow({ mode: 'open' });
      const style = M.el('style'); style.textContent = css; this.shadow.append(style);
      this.panel = M.el('aside', { class: 'panel', 'aria-label': 'MailWeave conversation' });
      this.divider = M.el('div', { class: 'divider', role: 'separator', tabindex: '0', 'aria-label': 'Resize conversation sidebar', 'aria-orientation': 'vertical' });
      const header = M.el('header'); header.append(M.el('div', { class: 'brand' }, `MailWeave · ${M.version}`));
      const title = M.el('div', { class: 'title' }); this.count = M.el('span', { class: 'count' }, 'Loading…');
      title.append(this.count); header.append(title);
      const toolbar = M.el('div', { class: 'tools' });
      for (const [label, action] of [['Refresh', 'refresh'], ['Close', 'close']]) {
        const button = M.el('button', { type: 'button' }, label);
        button.addEventListener('click', () => callbacks[action]()); toolbar.append(button);
        this[`${action}Button`] = button;
      }
      const autoLabel = M.el('label', { class: 'auto-open' });
      this.autoOpen = M.el('input', { type: 'checkbox' });
      autoLabel.append(this.autoOpen, document.createTextNode('Open automatically'));
      this.autoOpen.addEventListener('change', () => callbacks.autoOpen?.(this.autoOpen.checked));
      toolbar.append(autoLabel);
      header.append(toolbar);
      this.notice = M.el('div', { class: 'notice', role: 'status', hidden: '' }, 'New reply available. Refresh to read it.');
      this.status = M.el('div', { class: 'status', role: 'status', 'aria-live': 'polite' });
      this.messages = M.el('div', { class: 'messages', role: 'feed', 'aria-label': 'Conversation messages', 'aria-busy': 'true' });
      const footer = M.el('footer');
      this.copyButton = M.el('button', { type: 'button', class: 'copy-raw' }, 'Copy raw thread');
      this.copyButton.addEventListener('click', () => callbacks.copy());
      footer.append(M.el('span', {}, 'Select a message to open its original'), this.copyButton);
      this.panel.append(header, this.notice, this.status, this.messages, footer);
      this.shadow.append(this.divider, this.panel);
      // One reversible stylesheet owns the layout reservation. Never move Gmail nodes.
      this.layout = M.el('style', { id: 'mailweave-layout' });
      document.head.append(this.layout); document.documentElement.append(this.host);
      const opts = { signal: this.events.signal };
      window.addEventListener('resize', () => this.resize(this.preferredWidth, false), opts);
      this.divider.addEventListener('keydown', e => {
        let value = this.width;
        if (e.key === 'ArrowLeft') value += e.shiftKey ? 50 : 20;
        else if (e.key === 'ArrowRight') value -= e.shiftKey ? 50 : 20;
        else if (e.key === 'Home') value = 300;
        else if (e.key === 'End') value = innerWidth;
        else return;
        e.preventDefault(); this.resize(value, true);
      }, opts);
      this.divider.addEventListener('pointerdown', e => {
        e.preventDefault(); this.divider.setPointerCapture(e.pointerId); this.dragging = true;
      }, opts);
      this.divider.addEventListener('pointermove', e => { if (this.dragging) this.resize(innerWidth - e.clientX, false); }, opts);
      const end = () => { if (this.dragging) { this.dragging = false; this.resize(this.width, true); } };
      this.divider.addEventListener('pointerup', end, opts); this.divider.addEventListener('pointercancel', end, opts);
      this.resize(width, false); this.say('Reading this conversation…'); this.closeButton.focus({ preventScroll: true });
    }
    resize(value, persist) {
      this.width = M.clampWidth(value, innerWidth);
      this.host.style.setProperty('width', `${this.width}px`, 'important');
      // Reserve outer layout space without overriding nested Gmail controls.
      // Nested .nH nodes also include the navigation rail and its own width caps.
      const bodyStyle = getComputedStyle(document.body);
      const margins = (parseFloat(bodyStyle.marginLeft) || 0) + (parseFloat(bodyStyle.marginRight) || 0);
      this.layout.textContent = `html { overflow-x:auto !important; } body { box-sizing:border-box !important; width:calc(100% - ${this.width + margins}px) !important; max-width:calc(100% - ${this.width + margins}px) !important; min-width:0 !important; } body > .nH, body > div:not(.nH) > .nH { max-width:100% !important; } [role="main"] { max-width:100% !important; min-width:0 !important; } .dw, .AD { max-width:calc(100vw - ${this.width}px) !important; }`;
      this.panel.style.setProperty('--bubble-width', `${M.bubbleRatio(this.width) * 100}%`);
      this.divider.setAttribute('aria-valuemin', String(M.clampWidth(0.1, innerWidth)));
      this.divider.setAttribute('aria-valuemax', String(M.clampWidth(innerWidth, innerWidth)));
      this.divider.setAttribute('aria-valuenow', String(this.width));
      this.divider.setAttribute('aria-valuetext', `${this.width} pixels`);
      this.callbacks.resize?.();
      if (persist) { this.preferredWidth = this.width; M.preferences.write({ width: this.width }).then(ok => { if (!ok) this.say('Width changed for this session. Reload Gmail to reconnect preference storage.'); }); }
    }
    say(text) { if (this.status.textContent !== text) this.status.textContent = text; }
    stale(value) { this.notice.hidden = !value; }
    busy(value) { this.refreshButton.disabled = value; this.messages.setAttribute('aria-busy', String(value)); }
    media(body, record, article) {
      const permitted = this.mediaPermissions.has(record.key);
      let blocked = false;
      for (const placeholder of body.querySelectorAll('[data-mw-media]')) {
        let sources = []; try { sources = JSON.parse(placeholder.getAttribute('data-mw-sources') || '[]').map(M.mediaURL).filter(Boolean); } catch {}
        const type = placeholder.getAttribute('data-mw-media');
        if (!['img','audio','video'].includes(type) || !sources.length) continue;
        const urls = permitted ? sources : type === 'img' ? sources.filter(M.googleImage) : [];
        if (!urls.length) { blocked = true; continue; }
        const media = M.el(type);
        const label = placeholder.getAttribute('data-mw-alt') || type;
        const fallback = () => media.replaceWith(M.el('span', { 'data-mw-media': '', role: 'note' }, label + ' — unavailable'));
        media.addEventListener('error', fallback, { once: true });
        media.setAttribute('referrerpolicy', 'no-referrer');
        media.addEventListener('click', e => e.stopPropagation());
        if (type === 'img') {
          media.alt = label; media.loading = 'lazy'; media.decoding = 'async'; media.src = urls[0];
        } else {
          media.controls = true; media.preload = 'none';
          // Audio/video do not support referrerPolicy consistently. Anonymous
          // CORS is not a substitute for it; browsers apply their media policy.
          for (const url of urls) media.append(M.el('source', { src: url }));
          let failures = 0;
          for (const source of media.children) source.addEventListener('error', () => { if (++failures === urls.length) fallback(); });
        }
        placeholder.replaceWith(media);
      }
      if (blocked && !permitted) {
        const button = M.el('button', { type: 'button', class: 'load-media', title: 'May contact external servers. Some resources may remain unavailable.' }, 'Load images / media');
        button.addEventListener('click', e => {
          e.stopPropagation(); this.mediaPermissions.add(record.key); button.remove();
          this.media(body, record, article);
        });
        article.append(button);
      }
    }
    async render(items, evidence, colors, signal) {
      const start = performance.now(), scroll = this.messages.scrollTop;
      const initialLoad = !this.hasRenderedMessages && items.length > 0;
      const bottom = initialLoad || this.messages.scrollHeight - scroll - this.messages.clientHeight < 40;
      const firstVisible = [...this.messages.children].find(n => n.offsetTop + n.offsetHeight >= scroll);
      const anchor = firstVisible ? { key: firstVisible.dataset.key, offset: firstVisible.offsetTop - scroll } : null;
      const fragment = document.createDocumentFragment(); let last = performance.now();
      for (let index = 0; index < items.length; index++) {
        M.abort(signal);
        const record = items[index], identity = colors.get(record);
        const row = M.el('div', { class: `row${identity.self ? ' self' : ''}`, 'data-key': record.key });
        const article = M.el('article', { class: 'bubble', tabindex: '0', 'aria-label': `Message ${index + 1} from ${record.sender}. Enter to open original.`, 'aria-posinset': String(index + 1), 'aria-setsize': String(items.length) });
        article.style.background = identity.color;
        const sender = M.el('div', { class: 'sender', dir: 'auto' }, record.sender);
        if (record.email && record.email !== record.sender) sender.append(M.el('span', { class: 'address' }, ` · ${record.email}`));
        if (identity.self) sender.append(M.el('span', { class: 'address' }, ' · You'));
        const body = M.el('div', { class: 'body', dir: 'auto' });
        if (record.state === 'content') body.innerHTML = record.cleanHTML;
        else body.append(M.el('p', { class: 'placeholder' }, {
          unavailable: 'Body unavailable. Open the original or Refresh to retry.', empty: record.attachments.length ? 'Attachment-only message.' : 'This message has an empty body.',
          removed: 'Only verified signature or quoted history remains. Open original to read it.', error: 'Could not process this message. Open the original or Refresh.'
        }[record.state]));
        article.append(sender, M.el('time', {}, record.timestamp || 'Date unavailable'), body);
        this.media(body, record, article);
        article.addEventListener('click', e => {
          if (e.target.closest('a, button, audio, video') || window.getSelection()?.toString() || this.shadow.getSelection?.()?.toString()) return;
          this.callbacks.original(record);
        });
        article.addEventListener('keydown', e => { if (e.target === article && ['Enter', ' '].includes(e.key)) { e.preventDefault(); this.callbacks.original(record); } });
        row.append(article);
        if (record.attachments.length) {
          const clip = M.el('button', { type: 'button', class: 'attachment', 'aria-label': `${record.attachments.length} attachments. Open original.`, title: record.attachments.map(a => a.name).join('\n') });
          const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          icon.setAttribute('viewBox', '0 0 24 24'); icon.setAttribute('width', '20'); icon.setAttribute('height', '20');
          icon.setAttribute('fill', 'none'); icon.setAttribute('stroke', 'currentColor'); icon.setAttribute('stroke-width', '2');
          icon.setAttribute('stroke-linecap', 'round'); icon.setAttribute('stroke-linejoin', 'round');
          icon.setAttribute('aria-hidden', 'true'); icon.setAttribute('focusable', 'false');
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', 'M21.4 11.6l-9.2 9.2a6 6 0 0 1-8.5-8.5l10-10a4 4 0 0 1 5.7 5.7l-10 10a2 2 0 0 1-2.8-2.8l9.2-9.2');
          icon.append(path); clip.append(icon);
          clip.addEventListener('click', () => this.callbacks.original(record)); row.append(clip);
        }
        fragment.append(row);
        if (performance.now() - last > 12) { await M.pause(0, signal); last = performance.now(); }
      }
      M.abort(signal); this.messages.replaceChildren(fragment);
      this.count.textContent = evidence.total === null ? `${items.length} found · ${items.filter(r => r.loaded).length} loaded` : `${items.filter(r => r.loaded).length} / ${evidence.total} loaded`;
      if (bottom) this.messages.scrollTop = this.messages.scrollHeight;
      if (initialLoad) {
        this.hasRenderedMessages = true;
        // Wait for the final header/status layout before positioning the feed.
        await new Promise(resolve => requestAnimationFrame(resolve));
        M.abort(signal);
        this.messages.scrollTop = this.messages.scrollHeight;
      }
      if (!bottom) {
        const target = anchor && [...this.messages.children].find(n => n.dataset.key === anchor.key);
        this.messages.scrollTop = target ? target.offsetTop - anchor.offset : scroll;
      }
      return performance.now() - start;
    }
    destroy() { this.events.abort(); this.host.remove(); this.layout.remove(); }
  };
})();
