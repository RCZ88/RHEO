const DESKFLOW_SERVER = 'http://localhost:54321';
const $ = (id) => document.getElementById(id);

function fmtDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600); const m = Math.floor((total % 3600) / 60); const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
}
function fmtSync(ts) {
  if (!ts) return '—'; const diff = Date.now() - ts;
  if (diff < 5000) return 'just now'; if (diff < 60000) return `${Math.floor(diff/1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`; return new Date(ts).toLocaleTimeString();
}
function setStatus(ok, label) {
  $('statusDot').className = 'hdr-dot ' + ok;
  $('statusLabel').textContent = label;
}
function showStatus(text, ok) {
  const el = $('manualStatus');
  el.textContent = text;
  el.className = 'status-msg show ' + (ok ? 'ok' : 'err');
  setTimeout(() => { el.className = 'status-msg'; }, 2500);
}

// ── Tab bar ──
let activeTab = 'capture';
document.querySelectorAll('.dk-ext-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    activeTab = btn.dataset.tab;
    document.querySelectorAll('.dk-ext-tab').forEach(b => b.classList.remove('dk-ext-tab--active'));
    document.querySelectorAll('.dk-ext-tab-content').forEach(c => c.classList.remove('dk-ext-tab-content--active'));
    btn.classList.add('dk-ext-tab--active');
    const panel = $('tab-' + activeTab);
    if (panel) panel.classList.add('dk-ext-tab-content--active');
    if (activeTab === 'capture') refreshCaptureList();
    if (activeTab === 'topics') loadTopics();
    if (activeTab === 'status') loadStatus();
  });
});

// ── Capture list ─────────────────────────────────────────────────────────────
// Was a stub: it hit /ai-context/stats (a route that did not exist -> 404) and
// then wrote "No captures yet" unconditionally, so the list was empty no matter
// what had actually been saved. It now reads the real endpoints and renders
// proper empty / loading / error / populated states.
const PROVIDER_TINT = {
  chatgpt: '#10a37f', claude: '#d97757', gemini: '#4285f4', perplexity: '#20808d',
  deepseek: '#4d6bfe', qwen: '#615ced', kimi: '#1d1d1f', chatglm: '#3859ff',
  you: '#c8a2c8', huggingface: '#ffd21e', poe: '#5d5cde', character: '#000000',
};
function tintFor(p) { return PROVIDER_TINT[String(p || '').toLowerCase()] || 'var(--muted)'; }

function relTime(ms) {
  if (!ms) return '';
  const d = Math.floor((Date.now() - ms) / 1000);
  if (d < 60) return 'just now';
  if (d < 3600) return Math.floor(d / 60) + 'm ago';
  if (d < 86400) return Math.floor(d / 3600) + 'h ago';
  if (d < 604800) return Math.floor(d / 86400) + 'd ago';
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

async function refreshCaptureList() {
  const listEl = $('capList');
  if (!listEl) return;

  // ── loading: skeleton rows matching the real row shape, not a bare spinner ──
  if (!listEl.dataset.loaded) {
    listEl.innerHTML = [0, 1].map(() =>
      '<div class="cap-row cap-row--skeleton"><div class="sk-line"></div><div class="sk-line sk-line--short"></div></div>'
    ).join('');
  }

  let stats = null;
  try {
    const r = await fetch(`${DESKFLOW_SERVER}/ai-context/stats`, { signal: AbortSignal.timeout(2500) });
    if (r.ok) stats = await r.json();
  } catch { /* handled below */ }

  if (stats) {
    const c = $('captureCount'); if (c) c.textContent = stats.today || 0;
    const t = $('totalCount'); if (t) t.textContent = stats.total || 0;
  }

  let data = null;
  try {
    const r = await fetch(`${DESKFLOW_SERVER}/ai-context/list?limit=12`, { signal: AbortSignal.timeout(2500) });
    if (r.ok) data = await r.json();
  } catch { /* handled below */ }

  // ── error: plain cause + recovery. Never a raw status code. ──
  if (!data) {
    listEl.dataset.loaded = '1';
    listEl.innerHTML = '<div class="cap-msg cap-msg--err">'
      + '<span>Could not reach RHEO.</span>'
      + '<button class="cap-retry" id="capRetry">Retry</button></div>';
    const btn = $('capRetry');
    if (btn) btn.addEventListener('click', () => { delete listEl.dataset.loaded; refreshCaptureList(); });
    return;
  }

  const rows = Array.isArray(data.captures) ? data.captures : [];
  listEl.dataset.loaded = '1';

  // ── empty: explain what would be here, not "No data" ──
  if (!rows.length) {
    listEl.innerHTML = '<div class="cap-msg">'
      + '<span>Saved conversations appear here.</span>'
      + '<em>Open ChatGPT, Claude or Gemini and the bridge captures as you chat.</em></div>';
    return;
  }

  // ── populated ──
  listEl.innerHTML = rows.map(c => {
    const tint = tintFor(c.provider);
    const host = (() => { try { return new URL(c.url).hostname.replace(/^www\./, ''); } catch { return c.provider || 'chat'; } })();
    return '<button class="cap-row" data-id="' + c.id + '" data-url="' + (c.url || '').replace(/"/g, '&quot;') + '" title="Open this conversation">'
      + '<span class="cap-dot" style="background:' + tint + '"></span>'
      + '<span class="cap-main">'
        + '<span class="cap-title">' + escapeHtml(c.title || host) + '</span>'
        + '<span class="cap-sub">' + escapeHtml(host) + ' · ' + relTime(c.capturedAt) + '</span>'
      + '</span>'
      + '<span class="cap-go">→</span>'
      + '</button>';
  }).join('');

  listEl.querySelectorAll('.cap-row[data-id]').forEach(row => {
    row.addEventListener('click', () => {
      const url = row.getAttribute('data-url');
      if (url) { try { chrome.tabs.create({ url }); } catch (e) { window.open(url, '_blank'); } }
    });
  });
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── Topics & Categories ──
async function loadTopics() {
  // Load categories
  try {
    const r = await fetch(`${DESKFLOW_SERVER}/extension/chart-categories`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) {
      const data = await r.json();
      const catList = $('catList');
      catList.innerHTML = '';
      for (const cat of (data.categories || [])) {
        const row = document.createElement('div');
        row.className = 'dk-ext-category-row';
        row.innerHTML = `<div><span style="color:${cat.color};font-weight:600;">${cat.label}</span> <span style="font-size:10px;color:var(--muted);">${(cat.domains||[]).length} domains</span></div>`;
        catList.appendChild(row);
      }
      if (!data.categories?.length) catList.innerHTML = '<div style="font-size:11px;color:var(--dim)">No custom categories</div>';
    }
  } catch {}
  // Load topics
  try {
    const r = await fetch(`${DESKFLOW_SERVER}/extension/topics`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) {
      const data = await r.json();
      const topicList = $('topicList');
      topicList.innerHTML = '';
      for (const t of (data.topics || [])) {
        const chip = document.createElement('span');
        chip.className = 'topic-chip';
        chip.innerHTML = `${t.topic} <span class="remove" data-id="${t.id}">×</span>`;
        chip.querySelector('.remove').addEventListener('click', async () => {
          try { await fetch(`${DESKFLOW_SERVER}/extension/topics/${t.id}`, { method: 'DELETE' }); loadTopics(); } catch {}
        });
        topicList.appendChild(chip);
      }
      if (!data.topics?.length) topicList.innerHTML = '<div style="font-size:11px;color:var(--dim)">No topics yet</div>';
    }
  } catch {}
  const sub = $('topicsSub');
  sub.textContent = 'Topics & categories for this session';
}

// AI-suggest button
$('addTopicBtn')?.addEventListener('click', async () => {
  try {
    const r = await fetch(`${DESKFLOW_SERVER}/extension/topics/ai-suggest`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lookbackDays: 7 }),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return;
    const data = await r.json();
    const topicList = $('topicList');
    for (const s of (data.suggested || [])) {
      const chip = document.createElement('span');
      chip.className = 'topic-chip topic-chip--suggested';
      chip.innerHTML = `${s.topic} (${Math.round(s.confidence * 100)}%) <span class="remove" data-topic="${s.topic}">✓</span> <span class="remove">×</span>`;
      chip.querySelector('.remove:nth-child(2)').addEventListener('click', async () => {
        try { await fetch(`${DESKFLOW_SERVER}/extension/topics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: s.topic }), signal: AbortSignal.timeout(3000) }); loadTopics(); } catch {}
      });
      chip.querySelector('.remove:nth-child(3)').addEventListener('click', () => chip.remove());
      topicList.appendChild(chip);
    }
  } catch {}
});

// ── AI Chat ──
let chatMessages = [];
let chatConversationId = null;

async function renderChat() {
  const container = $('chatMessages');
  container.innerHTML = '';
  for (const msg of chatMessages) {
    const bubble = document.createElement('div');
    bubble.className = 'dk-ext-chat-bubble ' + (msg.role === 'user' ? 'dk-ext-chat-bubble--user' : 'dk-ext-chat-bubble--ai');
    bubble.textContent = msg.content;
    container.appendChild(bubble);
  }
  container.scrollTop = container.scrollHeight;
}

async function sendChatMessage() {
  const input = $('chatInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  chatMessages.push({ role: 'user', content: text });
  renderChat();
  try {
    const r = await fetch(`${DESKFLOW_SERVER}/extension/ai-chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, conversationId: chatConversationId }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    chatMessages.push({ role: 'assistant', content: data.reply });
    chatConversationId = data.conversationId;
    renderChat();
    $('insertBtn').classList.add('visible');
  } catch (e) {
    chatMessages.push({ role: 'assistant', content: 'Error: ' + e.message });
    renderChat();
  }
}

$('chatSendBtn')?.addEventListener('click', sendChatMessage);
$('chatInput')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChatMessage(); });
$('insertBtn')?.addEventListener('click', () => {
  const lastReply = chatMessages.filter(m => m.role === 'assistant').pop();
  if (!lastReply) return;
  // Use the existing DESKFLOW_INSERT_CONTEXT / INSERT_INTO_CHAT mechanism
  try {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'DESKFLOW_INSERT_CONTEXT', text: lastReply.content }, () => {});
      }
    });
  } catch {}
});

// ── Status tab ──
async function loadStatus() {
  try {
    const r = await fetch(`${DESKFLOW_SERVER}/health`, { signal: AbortSignal.timeout(2000) });
    $('statusServerVal').textContent = r.ok ? 'connected' : 'offline';
    $('statusSub').textContent = r.ok ? 'Server online' : 'Server offline';
  } catch { $('statusServerVal').textContent = 'offline'; $('statusSub').textContent = 'Server offline'; }
  // Offline queue length (read directly from chrome.storage.local)
  try {
    const { deskflow_retry_queue } = await chrome.storage.local.get('deskflow_retry_queue');
    const queue = deskflow_retry_queue || [];
    $('queueLength').innerHTML = `${queue.length} ${queue.length ? `<span class="dk-ext-queue-badge">${queue.length}</span>` : ''}`;
  } catch {}
  // Pending extractions
  try {
    const r = await fetch(`${DESKFLOW_SERVER}/extension/episode-status?captureId=0`, { signal: AbortSignal.timeout(2000) });
    // Use get-job-stats if available; else show placeholder
    $('pendingExtractions').textContent = '—';
  } catch {}
  $('lastFlush').textContent = fmtSync(Date.now() - 30000);
}

// Flush now
$('flushNowBtn')?.addEventListener('click', async () => {
  try {
    // Trigger drainRetryQueue via the extension poll mechanism
    await fetch(`${DESKFLOW_SERVER}/extension/poll`, { signal: AbortSignal.timeout(3000) });
    $('lastFlush').textContent = fmtSync(Date.now());
    loadStatus();
  } catch {}
});

// ── Tracking toggle ──
function toggleTracking() {
  chrome.storage.local.get('deskflow_isTrackingEnabled', (data) => {
    const next = !(data.deskflow_isTrackingEnabled !== false);
    chrome.storage.local.set({ deskflow_isTrackingEnabled: next }, () => {
      const toggle = $('trackToggle'); toggle.classList.toggle('on', next);
      toggle.setAttribute('aria-checked', String(next));
      if (next) setStatus('ok', 'tracking'); else setStatus('warn', 'paused');
    });
  });
}

// ── Open panel ──
$('openPanelBtn')?.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { type: 'DF_TOGGLE_PANEL' });
      window.close();
    }
  } catch {}
});

// ── Init ──
try { const ua = navigator.userAgent; const brand = ua.includes('Edg/') ? 'edge' : ua.includes('OPR/') ? 'opera' : ua.includes('Chrome') ? 'chrome' : 'browser'; ['browserPill','browserPill2','browserPill3','browserPill4'].forEach(id => { const el = $(id); if (el) el.textContent = brand; }); } catch {}

$('trackToggle').addEventListener('click', toggleTracking);
$('trackToggle').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleTracking(); } });
setInterval(refresh, 1000);
refresh();
fetchCaptureCount();

// ── Connect gate (Firefox / Zen MV3) ────────────────────────────────────────
// Firefox grants declared host_permissions only if the user opts in. Until they
// do, every fetch() to localhost:54321 from here AND from the background worker
// fails — so the popup used to show a permanent, unexplained "offline".
// This asks the background worker what is actually wrong and shows the fix.
async function checkConnectivity() {
  let res = null;
  try {
    res = await chrome.runtime.sendMessage({ type: 'DESKFLOW_DIAGNOSE' });
  } catch (e) {
    res = null;
  }
  const gate = $('connectGate');
  const why = $('connectWhy');
  const btn = $('connectBtn');
  if (!gate) return;

  // Healthy: hide the gate entirely so it never occupies the popup.
  if (res && res.permissions && res.reachable) {
    gate.style.display = 'none';
    return;
  }
  gate.style.display = 'block';
  if (res && !res.permissions) {
    why.textContent = 'This browser has not granted the extension access to the '
      + 'RHEO app on this computer. Without it the extension cannot send anything.';
  } else if (res && !res.reachable) {
    why.textContent = 'Permission is granted, but the RHEO app is not answering '
      + 'on port 54321. Start RHEO and try again.';
  } else {
    why.textContent = 'Could not check the connection. Open the extension\u2019s developer '
      + 'console for details.';
  }
  if (btn) btn.disabled = false;
}

const connectBtn = $('connectBtn');
if (connectBtn) {
  connectBtn.addEventListener('click', async () => {
    connectBtn.disabled = true;
    connectBtn.textContent = 'Connecting…';
    try { await chrome.runtime.sendMessage({ type: 'DESKFLOW_REQUEST_PERMISSIONS' }); }
    catch (e) { /* surfaced by checkConnectivity below */ }
    await checkConnectivity();
    await refresh();
    const gate = $('connectGate');
    const stillFailing = gate && gate.style.display !== 'none';
    if (stillFailing) {
      connectBtn.disabled = false;
      connectBtn.textContent = 'Connect to RHEO';
    }
  });
}

checkConnectivity();
setInterval(checkConnectivity, 5000);

async function refresh() {
  let serverHealthy = false;
  try { const r = await fetch(`${DESKFLOW_SERVER}/health`, { signal: AbortSignal.timeout(2000) }); serverHealthy = r.ok; } catch { serverHealthy = false; }
  chrome.storage.local.get(['deskflow_activeTabUrl','deskflow_activeTabTitle','deskflow_activeTabDomain',
    'deskflow_sessionStart','deskflow_lastPeriodicSync','deskflow_isTrackingEnabled','deskflow_isBrowserFocused'], (data) => {
    const err = chrome.runtime.lastError;
    if (err) { $('serverVal').textContent = 'storage error'; return; }
    const activeDomain = data.deskflow_activeTabDomain || '';
    const activeUrl = data.deskflow_activeTabUrl || '';
    const activeTitle = data.deskflow_activeTabTitle || '';
    const isTracking = data.deskflow_isTrackingEnabled !== false;

    setStatus(serverHealthy && isTracking ? 'ok' : isTracking ? 'warn' : 'off',
      !serverHealthy ? 'offline' : isTracking ? 'recording' : 'paused');
    $('serverVal').textContent = !serverHealthy ? 'RHEO not running'
      : isTracking ? 'connected' : 'connected · paused';

    // ── hero: identity first, then the page, then state ──
    $('domainVal').textContent = activeDomain || 'No page open';
    $('titleVal').textContent = activeTitle || (activeDomain ? '—' : 'Open a page to start tracking');
    const fav = $('siteFavicon');
    if (fav) {
      let iconUrl = '';
      try { if (activeUrl) iconUrl = new URL(activeUrl).origin + '/favicon.ico'; } catch {}
      if (iconUrl) {
        fav.src = iconUrl;
        fav.onload = () => { fav.style.opacity = '1'; };
        fav.onerror = () => { fav.style.opacity = '0'; };
      } else { fav.style.opacity = '0'; }
    }
    const st = $('siteState');
    if (st) {
      const label = !activeDomain ? 'idle' : !serverHealthy ? 'offline' : isTracking ? 'recording' : 'paused';
      st.textContent = label;
      st.className = 'pill pill--' + label;
    }
    const hint = $('siteHint');
    if (hint) {
      hint.textContent = !activeDomain ? 'Open a page to start tracking.'
        : !serverHealthy ? 'RHEO is not running, so nothing is being saved.'
        : !isTracking ? 'Tracking is paused — turn it back on above.'
        : activeDomain.includes('localhost') || activeDomain.startsWith('127.')
          ? 'Local pages are never tracked.'
          : 'Recording time on this page.';
    }
    const sessionStart = data.deskflow_sessionStart || Date.now();
    $('sessionTime').textContent = fmtDuration(Date.now() - sessionStart);
    $('syncVal').textContent = fmtSync(data.deskflow_lastPeriodicSync);
  });
  if (activeTab === 'status') loadStatus();
}
