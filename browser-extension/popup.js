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

// ── Capture list ──
async function refreshCaptureList() {
  try {
    const r = await fetch(`${DESKFLOW_SERVER}/ai-context/stats`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) {
      const data = await r.json();
      $('captureCount').textContent = data.total || 0;
    }
  } catch {}
  // Load recent captures
  try {
    const r = await fetch(`${DESKFLOW_SERVER}/ai-context`, { signal: AbortSignal.timeout(2000) });
    // The endpoint returns list via IPC; use stats for now
    const listEl = $('capList');
    listEl.innerHTML = '<div style="font-size:11px;color:var(--dim)">No captures yet</div>';
  } catch {}
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

async function refresh() {
  let serverHealthy = false;
  try { const r = await fetch(`${DESKFLOW_SERVER}/health`, { signal: AbortSignal.timeout(2000) }); serverHealthy = r.ok; } catch { serverHealthy = false; }
  chrome.storage.local.get(['deskflow_activeTabUrl','deskflow_activeTabTitle','deskflow_activeTabDomain',
    'deskflow_sessionStart','deskflow_lastPeriodicSync','deskflow_isTrackingEnabled','deskflow_isBrowserFocused'], (data) => {
    const err = chrome.runtime.lastError;
    if (err) { $('serverVal').textContent = 'storage error'; return; }
    const activeDomain = data.deskflow_activeTabDomain || '—';
    const isTracking = data.deskflow_isTrackingEnabled !== false;
    setStatus(serverHealthy && isTracking ? 'ok' : isTracking ? 'warn' : 'off',
      serverHealthy ? (isTracking ? 'tracking' : 'paused') : 'offline');
    $('serverVal').textContent = serverHealthy ? 'connected' : 'offline';
    $('domainVal').textContent = activeDomain;
    $('titleVal').textContent = '';
    const sessionStart = data.deskflow_sessionStart || Date.now();
    $('sessionTime').textContent = fmtDuration(Date.now() - sessionStart);
    $('syncVal').textContent = fmtSync(data.deskflow_lastPeriodicSync);
  });
  if (activeTab === 'status') loadStatus();
}
