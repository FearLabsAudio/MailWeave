const form = document.querySelector('form');
const aliases = document.querySelector('#aliases');
const status = document.querySelector('#status');
chrome.storage.local.get({ aliases: [] }).then(p => { aliases.value = p.aliases.join('\n'); }).catch(() => { status.textContent = 'Unable to read preferences. Reload this page.'; });
form.addEventListener('submit', async e => {
  e.preventDefault();
  const addresses = [...new Set(aliases.value.split(/\n/).map(s => s.trim().toLowerCase()).filter(Boolean))];
  if (addresses.some(s => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))) { status.textContent = 'Enter one complete email address per line.'; return; }
  try { await chrome.storage.local.set({ aliases: addresses }); status.textContent = 'Saved. Close and reopen Chat to apply.'; }
  catch { status.textContent = 'Could not save. Reload this preferences page and try again.'; }
});
