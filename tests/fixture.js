globalThis.fixture = (count = 5, { expanded = false, total = false } = {}) => {
  document.body.innerHTML = '<div class="nH"><div role="main"><h2 class="hP">Project planning — synthetic conversation</h2><div id="rows"></div><button id="compose">Compose</button><textarea aria-label="Reply"></textarea></div></div>';
  const rows = document.querySelector('#rows');
  for (let i = 0; i < count; i++) {
    const row = document.createElement('div'); row.className = `adn ${expanded || i === count - 1 ? 'ads' : 'kv'}`;
    row.dataset.messageId = `msg-${i}`;
    if (total) row.setAttribute('aria-setsize', String(count));
    row.innerHTML = `<div class="adx" role="button"><span class="gD" email="${i % 2 ? 'you@example.com' : 'alex@example.com'}" name="${i % 2 ? 'You' : 'Alex'}">${i % 2 ? 'You' : 'Alex'}</span><span class="g3" title="2026-09-17 09:${String(i).padStart(2, '0')}">09:${i}</span></div><div class="a3s" ${expanded || i === count - 1 ? '' : 'style="display:none"'}><p>Message ${i + 1}: planning update.</p><p>Details for milestone ${i + 1}.</p></div>`;
    row.querySelector('.adx').addEventListener('click', () => { row.classList.remove('kv'); row.classList.add('ads'); row.querySelector('.a3s').style.display = ''; });
    rows.append(row);
  }
  return rows;
};
globalThis.record = (html, email = 'alex@example.com', extra = {}) => ({ key: crypto.randomUUID(), ids: [], sender: email, email, timestamp: 'Today', loaded: true, clipped: false, attachments: [], html, ...extra });
