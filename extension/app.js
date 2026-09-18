(() => {
  'use strict';
  const M = globalThis.MailWeave;
  if (!M.gmail(location.href) || window.top !== window) return;
  // A second isolated-world instance can request DOM teardown without receiving
  // email data or privileged operations. Recovery never accepts page commands.
  document.dispatchEvent(new Event('mailweave-teardown'));
  document.querySelectorAll('#mailweave-sidebar, #mailweave-layout, #mailweave-launcher').forEach(n => n.remove());
  class App {
    constructor() {
      this.source = new M.Source(); this.events = new AbortController(); this.contextKey = null;
      this.mediaPermissions = new Set(); this.displayed = []; this.snapshot = null; this.loading = false; this.destroyed = false;
      this.launcher = M.el('div', { id: 'mailweave-launcher' });
      const shadow = this.launcher.attachShadow({ mode: 'open' });
      const style = M.el('style'); style.textContent = ':host{position:fixed;right:24px;bottom:24px;z-index:2147482999}:host([data-header]){position:static;display:inline-flex;align-items:center;flex:none;margin:0 6px;vertical-align:middle}:host([hidden]){display:none!important}button{font:600 13px system-ui;color:#fff;background:#237a3b;border:1px solid #195c2b;border-radius:24px;padding:8px 14px;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere;box-shadow:0 2px 7px #0003;cursor:pointer}button:disabled{cursor:wait;opacity:.8}button:focus-visible{outline:3px solid #4285f4;outline-offset:3px}';
      this.button = M.el('button', { type: 'button', title: 'MailWeave — conversation sidebar', 'aria-label': 'Chat — open MailWeave conversation sidebar' }, 'Chat');
      shadow.append(style, this.button); document.documentElement.append(this.launcher);
      this.button.addEventListener('click', () => this.open());
      document.addEventListener('mailweave-teardown', () => this.destroy(), { signal: this.events.signal });
      window.addEventListener('resize', () => this.syncLauncher(), { signal: this.events.signal });
      window.addEventListener('hashchange', () => this.check(), { signal: this.events.signal });
      window.addEventListener('popstate', () => this.check(), { signal: this.events.signal });
      this.observer = new MutationObserver(mutations => {
        if (!mutations.some(m => !m.target.closest?.('#mailweave-sidebar, #mailweave-launcher, #mailweave-layout') && (m.type === 'childList' || ['data-message-id', 'data-legacy-message-id', 'content', 'name'].includes(m.attributeName)))) return;
        clearTimeout(this.debounce); this.debounce = setTimeout(() => this.check(), 180);
      });
      this.observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-message-id', 'data-legacy-message-id', 'content', 'name'] });
      this.check();
      M.preferences.read().then(prefs => {
        if (this.destroyed) return;
        this.autoOpen = Boolean(prefs.autoOpen); this.check();
      });
    }
    syncLauncher() {
      if (!this.launcher) return;
      const header = this.launcher.hasAttribute('data-header');
      this.launcher.hidden = !this.source.context() || (header && Boolean(this.view));
      this.button.disabled = Boolean(this.loading);
      this.button.textContent = this.loading ? 'Loading…' : 'Chat';
      this.button.setAttribute('aria-busy', String(Boolean(this.loading)));
      if (header) { this.launcher.style.removeProperty('right'); this.launcher.style.removeProperty('max-width'); return; }
      const divider = this.view?.divider.getBoundingClientRect();
      const right = divider ? innerWidth - divider.left + 16 : 24;
      this.launcher.style.right = right + 'px';
      this.launcher.style.maxWidth = Math.max(1, innerWidth - right - 8) + 'px';
    }
    placeLauncher() {
      // Use the Google apps link inside Gmail's header, never message content.
      const header = document.querySelector('#gb, header[role="banner"], [role="banner"]');
      const anchor = header && [...header.querySelectorAll('a[href]')].find(node => {
        if (node.closest('[role="main"], .a3s') || !node.getClientRects().length) return false;
        try { const url = new URL(node.href); return url.protocol === 'https:' && ['www.google.com', 'about.google'].includes(url.hostname) && /\/(?:about\/)?products\/?$/.test(url.pathname); } catch { return false; }
      });
      if (anchor) {
        let slot = anchor;
        while (slot.parentElement && slot.parentElement !== header && !['flex', 'inline-flex'].includes(getComputedStyle(slot.parentElement).display)) slot = slot.parentElement;
        if (slot.parentElement) {
          if (this.launcher.parentElement !== slot.parentElement || this.launcher.nextElementSibling !== slot) slot.before(this.launcher);
          this.launcher.toggleAttribute('data-header', true);
          return;
        }
      }
      this.launcher.removeAttribute('data-header');
      if (this.launcher.parentElement !== document.documentElement) document.documentElement.append(this.launcher);
    }
    check() {
      if (this.destroyed) return;
      this.placeLauncher();
      const context = this.source.context();
      const account = this.source.account();
      if (account !== this.account) {
        this.mediaPermissions.clear(); this.close(false); this.colors = new M.Colors(); this.source.previous = []; this.account = account;
      }
      this.syncLauncher();
      if ((context?.key ?? null) !== this.contextKey) {
        this.mediaPermissions.clear(); this.close(false); this.source.previous = []; this.contextKey = context?.key ?? null; this.dismissedKey = null;
        this.syncLauncher();
        if (context && this.autoOpen) this.open();
        return;
      }
      if (context && !this.view && this.autoOpen && this.dismissedKey !== context.key) { this.open(); return; }
      if (!this.view || this.loading || !this.snapshot || !context) return;
      const fresh = this.source.discover(context);
      const change = M.changes(this.snapshot.records, fresh.records, { ...this.snapshot.evidence, currentTotal: fresh.evidence.total });
      if (change === 'reply') { this.view.stale(true); this.hasReply = true; }
      else if (change === 'reconcile' || fresh.records.some(r => r.loaded && !this.snapshot.records.find(p => p.key === r.key)?.loaded)) {
        // Preserve the new-reply notice until an explicit refresh; don't absorb it.
        if (!this.hasReply) this.refresh(true);
      }
    }
    async setAutoOpen(value) {
      this.autoOpen = value;
      const saved = await M.preferences.write({ autoOpen: value });
      if (!saved) this.view?.say('Automatic opening changed for this session. Preference storage is unavailable.');
    }
    async open() {
      if (this.view || !this.source.context()) return;
      this.colors = new M.Colors();
      this.view = new M.View({ close: () => { this.dismissedKey = this.contextKey; this.close(); }, autoOpen: value => this.setAutoOpen(value), refresh: () => this.refresh(), copy: () => this.copy(), original: r => this.original(r), resize: () => this.syncLauncher() }, 440, this.mediaPermissions);
      this.syncLauncher();
      const currentView = this.view;
      const prefs = await M.preferences.read();
      if (this.view !== currentView) return;
      this.autoOpen = Boolean(prefs.autoOpen); this.view.autoOpen.checked = this.autoOpen;
      this.view.preferredWidth = prefs.width; this.view.resize(prefs.width, false);
      this.account = this.source.account();
      this.colors = new M.Colors([...prefs.aliases, this.account].filter(Boolean));
      await this.refresh();
    }
    async refresh(automatic = false) {
      if (!this.view) return;
      this.job?.abort(); this.job = new AbortController(); const signal = this.job.signal;
      const view = this.view; this.loading = true; view.busy(true); this.syncLauncher();
      try {
        const prefs = await M.preferences.read();
        M.abort(signal);
        this.account = this.source.account();
        this.colors = new M.Colors([...prefs.aliases, this.account].filter(Boolean));
        const account = this.account;
        // Yield a frame so the shell and its Close control paint before parsing.
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
        M.abort(signal);
        const contextKey = this.source.context()?.key;
        let snapshot, result;
        const deadline = performance.now() + 8000;
        for (let pass = 0; pass < 4; pass++) {
          snapshot = await this.source.load({ signal, budget: Math.max(0, deadline - performance.now()), progress: text => view.say(text) });
          result = await M.clean(snapshot.records, { signal, progress: text => view.say(text) });
          const fresh = this.source.discover();
          if (fresh.records.length === snapshot.records.length && fresh.records.every((r, i) => r.key === snapshot.records[i].key && r.html === snapshot.records[i].html && r.loaded === snapshot.records[i].loaded)) break;
          if (pass === 3) { snapshot = { ...fresh, context: snapshot.context, timings: snapshot.timings }; result = await M.clean(snapshot.records, { signal }); }
        }
        M.abort(signal);
        if (this.source.context()?.key !== contextKey || this.source.account() !== account) throw new DOMException('Conversation changed', 'AbortError');
        snapshot.timings = { ...snapshot.timings, ...result.timings, renderMs: await view.render(result.items, snapshot.evidence, this.colors, signal) };
        M.abort(signal);
        if (this.source.context()?.key !== contextKey) { this.close(false); return; }
        this.snapshot = snapshot; this.displayed = result.items; this.hasReply = false; view.stale(false);
        view.say(snapshot.evidence.pendingHistory ? 'Some history is still unavailable. Open older messages in Gmail, then Refresh.' : snapshot.records.some(r => !r.loaded) ? 'Some bodies are unavailable. Open their originals or Refresh to retry.' : snapshot.evidence.total === null ? 'Showing messages found on this page.' : '');
      } catch (error) {
        if (error.name !== 'AbortError') view.say(`Could not read the conversation. ${error.message}`);
      } finally {
        if (!signal.aborted && this.view === view) { this.loading = false; view.busy(false); this.syncLauncher(); }
      }
    }
    async copy() {
      if (!this.view || this.copying) return;
      this.copying = true; const view = this.view; view.copyButton.disabled = true;
      const controller = this.exportJob = new AbortController();
      try {
        view.say('Capturing fresh Gmail page data…');
        const fresh = await this.source.load({ signal: controller.signal, progress: text => view.say(text) });
        const text = M.exportThread(fresh, this.displayed, fresh.context);
        M.abort(controller.signal); await navigator.clipboard.writeText(text);
        M.abort(controller.signal);
        view.say(`Copied ${fresh.records.length} messages as private Gmail page data.${fresh.evidence.complete ? '' : ' Completeness is not confirmed.'}`);
      } catch (error) { if (error.name !== 'AbortError') view.say('Clipboard copy failed. Keep Gmail focused, allow clipboard access, and try Copy raw thread again.'); }
      finally { if (this.view === view) { this.copying = false; view.copyButton.disabled = false; } }
    }
    async original(record) {
      try { await this.source.original(record, this.job?.signal); }
      catch (error) { if (error.name !== 'AbortError') this.view?.say(error.message); }
    }
    close(focus = true) {
      this.job?.abort(); this.exportJob?.abort(); this.loading = false; this.copying = false;
      this.view?.destroy(); this.view = null; this.snapshot = null; this.displayed = []; this.hasReply = false;
      if (this.launcher) { this.syncLauncher(); if (focus && !this.launcher.hidden) this.button.focus({ preventScroll: true }); }
    }
    destroy() {
      this.destroyed = true; this.close(false); this.observer?.disconnect(); this.events.abort(); clearTimeout(this.debounce); this.launcher?.remove();
    }
  }
  M.app = new App();
})();
