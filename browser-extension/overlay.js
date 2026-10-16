// RHEO Overlay — Full inline controls ON the AI chat website
// Sidebar panel + floating toolbar + per-message copy buttons + prompt library
(() => {
  if (!chrome?.runtime?.id) return;
  if (window.__dfOverlay) return;
  window.__dfOverlay = true;

  const SERVER = 'http://localhost:54321';
  const PROVIDERS = {
    'chatgpt.com': { name: 'ChatGPT', color: '#10a37f', letter: 'G',
      inputSel: 'textarea[id="prompt-textarea"], div#prompt-textarea',
      msgSel: '[data-message-author-role]',
      roleAttr: 'data-message-author-role',
      assistantVal: 'assistant' },
    'chat.openai.com': { name: 'ChatGPT', color: '#10a37f', letter: 'G',
      inputSel: 'textarea[id="prompt-textarea"], div#prompt-textarea',
      msgSel: '[data-message-author-role]',
      roleAttr: 'data-message-author-role',
      assistantVal: 'assistant' },
    'claude.ai': { name: 'Claude', color: '#d97706', letter: 'C',
      inputSel: 'div[contenteditable="true"], textarea',
      msgSel: '[data-is-streaming], .font-claude-message',
      roleAttr: null,
      assistantVal: null },
    'perplexity.ai': { name: 'Perplexity', color: '#20b2aa', letter: 'P',
      inputSel: 'textarea',
      msgSel: '.prose, .answer',
      roleAttr: null,
      assistantVal: null },
    'you.com': { name: 'You.com', color: '#6366f1', letter: 'Y',
      inputSel: 'textarea, [contenteditable="true"]',
      msgSel: '.chat-message, .message-content',
      roleAttr: null,
      assistantVal: null },
    'gemini.google.com': { name: 'Gemini', color: '#4285f4', letter: 'B',
      inputSel: 'div[contenteditable="true"], rich-textarea',
      msgSel: '.model-response-text, .response-container',
      roleAttr: null,
      assistantVal: null },
    'chat.qwen.ai': { name: 'Qwen', color: '#6153e0', letter: 'Q',
      inputSel: 'textarea, div[contenteditable="true"]',
      msgSel: '.message-content, .chat-message',
      roleAttr: null,
      assistantVal: null },
    'kimi.moonshot.cn': { name: 'Kimi', color: '#000000', letter: 'K',
      inputSel: 'textarea, div[contenteditable="true"]',
      msgSel: '.message-content, .chat-message',
      roleAttr: null,
      assistantVal: null },
    'chatglm.cn': { name: 'GLM', color: '#3b82f6', letter: 'Z',
      inputSel: 'textarea, div[contenteditable="true"]',
      msgSel: '.message-content, .chat-message',
      roleAttr: null,
      assistantVal: null },
    'huggingface.co': { name: 'HuggingFace', color: '#ffd21e', letter: 'H',
      inputSel: 'textarea',
      msgSel: '.message, [class*="message"]',
      roleAttr: null,
      assistantVal: null },
    'poe.com': { name: 'Poe', color: '#6366f1', letter: 'O',
      inputSel: 'textarea',
      msgSel: '.Message, [class*="message"]',
      roleAttr: null,
      assistantVal: null },
    'character.ai': { name: 'Character.ai', color: '#000000', letter: 'A',
      inputSel: 'textarea, div[contenteditable="true"]',
      msgSel: '[class*="message"]',
      roleAttr: null,
      assistantVal: null },
    'deepseek.com': { name: 'DeepSeek', color: '#4f46e5', letter: 'D',
      inputSel: 'textarea, div[contenteditable="true"]',
      msgSel: '[class*="message-content"], [class*="markdown"]',
      roleAttr: null,
      assistantVal: null },
  };

  const host = location.hostname.replace(/^www\./, '');
  const P = PROVIDERS[host];
  if (!P) return;

  let panelOpen = false;
  let promptLibOpen = false;
  let serverUp = false;
  let captureCount = 0;
  let lastCapture = null;
  let activeTab = 'capture';

  // Lucide SVG icons — inline for browser extension (no React available)
  const ICONS = {
    capture: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg>',
    brain: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/></svg>',
    copy: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
    check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    wand: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h0"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/></svg>',
    book: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    bot: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>',
  };

  // ─── CSS ────────────────────────────────────────────────
  // Applied: frontend-design (tokens, glass, pills), Human-Centric UX (states, hierarchy, 44px targets),
  // Impeccable (8px grid, type scale, no box-shadow, focus rings), Motion L2 (150-300ms, hover lift, press),
  // Design Taste (variance=5, motion=5, density=7), UI UX Pro Max (dev tool dark glass, single accent),
  // Taste Skill (anti-repetition, contextual memory), no-ai-slop (no generic gradients, no icon-only)
  const CSS = `
    @media (prefers-reduced-motion:reduce) {
      *,*::before,*::after { animation-duration:.01ms !important; animation-iteration-count:1 !important;
        transition-duration:.01ms !important; scroll-behavior:auto !important; }
    }
    @keyframes df-breathe { 0%,100%{opacity:.45;transform:scale(1)} 50%{opacity:.9;transform:scale(1.15)} }
    @keyframes df-fade-in { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }

    /* ── FAB (44px min touch target per Impeccable §6) ── */
    #df-fab {
      position:fixed; bottom:24px; right:24px; z-index:2147483640;
      width:44px; height:44px; border-radius:12px;
      border:1px solid rgba(255,255,255,.08); /* Impeccable: no box-shadow on dark */
      background:rgba(24,24,27,.8); backdrop-filter:blur(24px); /* Frontend Design: glass */
      color:#fafafa; font-weight:700; font-size:16px;
      font-family:system-ui,-apple-system,sans-serif; /* Impeccable: max 2 fonts */
      display:flex; align-items:center; justify-content:center; cursor:pointer;
      transition:transform 150ms cubic-bezier(.16,1,.3,1), border-color 150ms, background 150ms; /* Motion: fast */
      /* Impeccable: transform+opacity only, no width/height/top/left */
    }
    #df-fab:hover { border-color:rgba(255,255,255,.18); background:rgba(24,24,27,.95); transform:translateY(-1px); } /* Motion: hover lift L2 */
    #df-fab:active { transform:scale(.97); } /* Motion: press feedback L1 */
    #df-fab:focus-visible { outline:none; box-shadow:0 0 0 2px rgba(236,72,153,.5); } /* Impeccable: custom focus ring */
    #df-fab .df-dot {
      position:absolute; top:8px; right:8px; width:6px; height:6px;
      border-radius:50%; border:1.5px solid #18181b;
    }
    #df-fab .df-dot.on { background:#34d399; animation:df-breathe 2.4s ease-in-out infinite; } /* Motion: breathing status dot L2 */
    #df-fab .df-dot.off { background:#ef4444; }

    /* ── TOOLBAR (progressive disclosure: hidden until hover FAB) ── */
    #df-toolbar {
      position:fixed; bottom:80px; right:24px; z-index:2147483640;
      display:none; flex-direction:column; gap:4px;
    }
    #df-toolbar.show { display:flex; animation:df-fade-in 200ms cubic-bezier(.16,1,.3,1); } /* Motion: transitional enter L1 */
    .df-tb {
      width:40px; height:40px; border-radius:10px; border:1px solid rgba(255,255,255,.06);
      background:rgba(24,24,27,.85); backdrop-filter:blur(20px);
      color:#a1a1aa; cursor:pointer; font-size:0;
      display:flex; align-items:center; justify-content:center;
      transition:transform 150ms cubic-bezier(.16,1,.3,1), color 150ms, border-color 150ms; position:relative;
    }
    .df-tb svg { width:16px; height:16px; flex-shrink:0; }
    .df-tb:hover { color:#fafafa; border-color:rgba(255,255,255,.12); transform:translateY(-1px); } /* Motion: hover lift */
    .df-tb:active { transform:scale(.97); } /* Motion: press */
    .df-tb:focus-visible { outline:none; box-shadow:0 0 0 2px rgba(236,72,153,.5); }
    .df-tb .tip {
      position:absolute; right:48px; top:50%; transform:translateY(-50%);
      padding:4px 10px; border-radius:8px; font-size:11px; font-weight:500;
      background:#18181b; border:1px solid rgba(255,255,255,.06);
      color:#fafafa; white-space:nowrap; pointer-events:none;
      opacity:0; transition:opacity 150ms;
    }
    .df-tb:hover .tip { opacity:1; } /* Human-Centric: every icon has a label */
    .df-tb.ok { color:#34d399; border-color:rgba(52,211,153,.2); }

    /* ── PER-MESSAGE BUTTONS ── */
    .df-mb {
      position:absolute; top:4px; right:4px; z-index:10;
      width:28px; height:28px; border-radius:8px; border:1px solid rgba(255,255,255,.04);
      background:rgba(24,24,27,.7); backdrop-filter:blur(12px);
      color:#71717a; cursor:pointer; font-size:0;
      display:none; align-items:center; justify-content:center;
      transition:color 150ms, border-color 150ms;
    }
    .df-mb svg { width:12px; height:12px; flex-shrink:0; }
    .df-mw:hover .df-mb { display:flex; }
    .df-mb:hover { color:#fafafa; border-color:rgba(255,255,255,.1); }
    .df-mb:focus-visible { outline:none; box-shadow:0 0 0 2px rgba(236,72,153,.5); }
    .df-mb.ok { color:#34d399; border-color:rgba(52,211,153,.2); }

    /* ── SIDE PANEL ── */
    #df-panel {
      position:fixed; top:0; right:0; bottom:0; width:380px; max-width:90vw;
      z-index:2147483640;
      background:rgba(9,9,11,.92); backdrop-filter:blur(32px); /* Frontend Design: glass elevated */
      border-left:1px solid rgba(255,255,255,.06);
      transform:translateX(100%); transition:transform 250ms cubic-bezier(.16,1,.3,1); /* Motion: normal */
      font-family:system-ui,-apple-system,sans-serif; color:#fafafa;
      display:flex; flex-direction:column; overflow:hidden;
    }
    #df-panel.open { transform:translateX(0); }

    /* Header — SectionHeader pattern from Frontend Design */
    .df-hd {
      padding:16px 20px; border-bottom:1px solid rgba(255,255,255,.06);
      display:flex; align-items:center; gap:12px; flex-shrink:0;
    }
    .df-hd-icon {
      width:32px; height:32px; border-radius:10px; display:flex; align-items:center; justify-content:center;
      background:rgba(255,255,255,.06); color:#fafafa;
      font-weight:700; font-size:14px; flex-shrink:0;
    }
    .df-hd-title { font-size:14px; font-weight:600; color:#fafafa; letter-spacing:-.01em; } /* Frontend Design: 15px section */
    .df-hd-sub { font-size:11px; color:#71717a; margin-top:1px; } /* Frontend Design: 11px badge/meta */
    .df-hd-x {
      margin-left:auto; width:28px; height:28px; border-radius:8px;
      border:1px solid rgba(255,255,255,.06); background:transparent;
      color:#71717a; cursor:pointer; font-size:13px;
      display:flex; align-items:center; justify-content:center;
      transition:color 150ms, background 150ms;
    }
    .df-hd-x:hover { color:#fafafa; background:rgba(255,255,255,.06); }

    /* Tabs — TabBar pills from Frontend Design */
    .df-tabs {
      display:flex; padding:6px 16px; gap:2px;
      border-bottom:1px solid rgba(255,255,255,.06); flex-shrink:0;
    }
    .df-tab {
      flex:1; padding:8px 0; border-radius:8px; border:none; /* Impeccable: 8px grid */
      background:transparent; color:#71717a;
      font-size:12px; font-weight:500; cursor:pointer;
      font-family:inherit; text-align:center; transition:color 150ms, background 150ms;
    }
    .df-tab:hover { color:#a1a1aa; }
    .df-tab.on { color:#fafafa; background:rgba(255,255,255,.08); } /* Frontend Design: active pill */

    /* Body */
    .df-bd { flex:1; overflow-y:auto; padding:16px 20px; }
    .df-bd::-webkit-scrollbar { width:4px; }
    .df-bd::-webkit-scrollbar-thumb { background:rgba(255,255,255,.06); border-radius:2px; }

    /* Glass card — Frontend Design default variant */
    .df-gc {
      border-radius:12px; border:1px solid rgba(255,255,255,.06);
      background:rgba(24,24,27,.6); backdrop-filter:blur(12px);
      padding:16px; margin-bottom:12px; /* Frontend Design: p-5=20px, we use 16px for density=7 */
      transition:border-color 150ms;
    }
    .df-gc:hover { border-color:rgba(255,255,255,.1); }

    /* Section label — Impeccable typography */
    .df-lb {
      font-size:11px; font-weight:600; text-transform:uppercase;
      letter-spacing:.06em; color:#71717a; margin-bottom:8px; /* Impeccable: 8px grid */
    }

    /* Status row */
    .df-sr {
      display:flex; align-items:center; gap:10px;
      padding:10px 12px; border-radius:10px;
      background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.04);
      margin-bottom:12px;
    }
    .df-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
    .df-dot.on { background:#34d399; }
    .df-dot.off { background:#ef4444; }
    .df-sr-text { font-size:12px; color:#a1a1aa; flex:1; }
    .df-sr-text b { color:#fafafa; font-weight:600; }

    /* Stat cards — Frontend Design StatCard */
    .df-stats { display:flex; gap:8px; margin-bottom:12px; }
    .df-stat {
      flex:1; padding:14px 12px; border-radius:10px; text-align:center;
      background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.04);
    }
    .df-stat-v { font-size:20px; font-weight:700; line-height:1; letter-spacing:-.02em; font-variant-numeric:tabular-nums; } /* UI UX Pro Max: tabular nums */
    .df-stat-l { font-size:10px; color:#71717a; margin-top:4px; }

    /* Capture button — Human-Centric: primary action, obvious in <1s */
    .df-cap {
      width:100%; padding:10px; border-radius:10px; border:1px solid rgba(255,255,255,.08);
      background:rgba(255,255,255,.04); color:#fafafa;
      font-size:13px; font-weight:500; cursor:pointer;
      font-family:inherit; transition:transform 150ms cubic-bezier(.16,1,.3,1), background 150ms, border-color 150ms;
    }
    .df-cap:hover { background:rgba(255,255,255,.08); border-color:rgba(255,255,255,.15); transform:translateY(-1px); }
    .df-cap:active { transform:scale(.98); }
    .df-cap:focus-visible { outline:none; box-shadow:0 0 0 2px rgba(236,72,153,.5); }
    .df-cap.ok { color:#34d399; border-color:rgba(52,211,153,.2); }

    /* Action grid */
    .df-ag { display:grid; grid-template-columns:1fr 1fr; gap:8px; } /* Impeccable: 8px grid */
    .df-ab {
      padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,.04);
      background:rgba(255,255,255,.02); color:#a1a1aa; cursor:pointer;
      font-family:inherit; text-align:left; display:flex; flex-direction:column; gap:6px;
      transition:transform 150ms cubic-bezier(.16,1,.3,1), color 150ms, border-color 150ms, background 150ms;
    }
    .df-ab:hover { color:#fafafa; border-color:rgba(255,255,255,.1); background:rgba(255,255,255,.05); transform:translateY(-1px); }
    .df-ab:active { transform:scale(.98); }
    .df-ab:focus-visible { outline:none; box-shadow:0 0 0 2px rgba(236,72,153,.5); }
    .df-ab-ic { font-size:16px; font-style:normal; line-height:1; }
    .df-ab-nm { font-size:12px; font-weight:500; }
    .df-ab-ds { font-size:10px; color:#52525b; }

    /* Inject buttons */
    .df-ib {
      width:100%; padding:8px 12px; border-radius:8px;
      border:1px solid rgba(255,255,255,.06); background:rgba(255,255,255,.03);
      color:#a1a1aa; font-size:12px; font-weight:500;
      cursor:pointer; font-family:inherit; margin-top:4px; text-align:left;
      transition:color 150ms, background 150ms;
    }
    .df-ib:hover { color:#fafafa; background:rgba(255,255,255,.06); }
    .df-ib:focus-visible { outline:none; box-shadow:0 0 0 2px rgba(236,72,153,.5); }

    /* History items */
    .df-hi {
      padding:10px 12px; border-radius:10px;
      border:1px solid rgba(255,255,255,.04); background:rgba(255,255,255,.02);
      margin-bottom:6px; cursor:pointer;
      transition:border-color 150ms, background 150ms;
    }
    .df-hi:hover { border-color:rgba(255,255,255,.1); background:rgba(255,255,255,.04); }
    .df-hi-t { font-size:13px; font-weight:500; margin-bottom:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .df-hi-m { font-size:11px; color:#71717a; display:flex; gap:8px; align-items:center; }

    /* Badge — Frontend Design StatusBadge */
    .df-bg {
      display:inline-flex; padding:2px 8px; border-radius:999px;
      font-size:10px; font-weight:500;
      background:rgba(255,255,255,.06); color:#a1a1aa;
    }

    /* Empty state — Human-Centric UX pillar 4: never blank */
    .df-empty { text-align:center; padding:40px 16px; color:#52525b; }
    .df-empty-i { font-size:28px; margin-bottom:8px; opacity:.3; }
    .df-empty-t { font-size:13px; line-height:1.6; }

    /* Footer */
    .df-ft {
      padding:10px 20px; border-top:1px solid rgba(255,255,255,.06);
      font-size:10px; color:#3f3f46; flex-shrink:0;
    }

    /* Toast — Human-Centric: immediate feedback */
    #df-toast {
      position:fixed; bottom:80px; right:24px; z-index:2147483641;
      padding:8px 16px; border-radius:10px; font-size:12px; font-weight:500;
      background:rgba(24,24,27,.9); border:1px solid rgba(255,255,255,.08);
      backdrop-filter:blur(20px); color:#fafafa;
      transform:translateY(8px); opacity:0;
      transition:transform 200ms cubic-bezier(.16,1,.3,1), opacity 200ms, color 200ms, border-color 200ms;
      pointer-events:none; font-family:system-ui,-apple-system,sans-serif;
    }
    #df-toast.show { transform:translateY(0); opacity:1; }
    #df-toast.ok { color:#34d399; border-color:rgba(52,211,153,.2); }
    #df-toast.err { color:#f87171; border-color:rgba(248,113,113,.2); }

    /* Prompt selector */
    .df-pi-d { font-size:10px; color:#52525b; margin-top:1px; }

    /* Prompt selector panel */
    #df-ps {
      position:fixed; bottom:130px; right:24px; z-index:2147483640;
      width:300px; max-height:400px; overflow-y:auto;
      background:rgba(24,24,27,.92); backdrop-filter:blur(24px);
      border:1px solid rgba(255,255,255,.08); border-radius:12px;
      display:none; padding:8px;
    }
    #df-ps.show { display:block; animation:df-fade-in 200ms cubic-bezier(.16,1,.3,1); }
    .df-ps-title { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; color:#71717a; padding:6px 8px; }
    .df-ps-item { padding:10px 12px; border-radius:8px; cursor:pointer; transition:background 150ms; }
    .df-ps-item:hover { background:rgba(255,255,255,.06); }
    .df-ps-nm { font-size:12px; font-weight:500; color:#fafafa; }
    .df-ps-ds { font-size:10px; color:#52525b; margin-top:2px; }
    .df-ps-loading, .df-ps-empty { text-align:center; padding:20px; font-size:12px; color:#71717a; }

    /* Prompt field config (dynamic selection step) */
    .df-ps-back {
      display:inline-flex; align-items:center; gap:4px; padding:6px 10px; margin:0 0 10px 2px;
      border-radius:8px; border:1px solid rgba(255,255,255,.06); background:rgba(255,255,255,.03);
      color:#a1a1aa; font-size:11px; font-weight:500; cursor:pointer; font-family:inherit;
      transition:color 150ms, background 150ms, border-color 150ms;
    }
    .df-ps-back:hover { color:#fafafa; background:rgba(255,255,255,.06); border-color:rgba(255,255,255,.12); }
    .df-ps-head { font-size:13px; font-weight:600; color:#fafafa; margin:2px 2px 2px; }
    .df-ps-sub { font-size:11px; color:#71717a; margin:0 2px 12px; }
    .df-ps-sec { margin-bottom:14px; }
    .df-ps-sec-lb {
      font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.06em;
      color:#71717a; margin-bottom:8px;
    }
    .df-ps-chk {
      display:flex; align-items:center; gap:10px; padding:9px 12px; margin-bottom:6px;
      border-radius:8px; border:1px solid rgba(255,255,255,.05);
      background:rgba(255,255,255,.02); cursor:pointer;
      transition:border-color 150ms, background 150ms;
    }
    .df-ps-chk:hover { border-color:rgba(255,255,255,.12); background:rgba(255,255,255,.05); }
    .df-ps-chk.on { border-color:rgba(236,72,153,.35); background:rgba(236,72,153,.08); }
    .df-ps-chk input { accent-color:#ec4899; width:15px; height:15px; flex-shrink:0; cursor:pointer; }
    .df-ps-chk-nm { font-size:12px; font-weight:500; color:#fafafa; }
    .df-ps-chk-ds { font-size:10px; color:#52525b; margin-top:1px; }
    .df-ps-chk-tx { display:flex; flex-direction:column; }
    .df-ps-ta {
      width:100%; min-height:64px; resize:vertical; padding:10px 12px; border-radius:8px;
      border:1px solid rgba(255,255,255,.06); background:rgba(255,255,255,.03);
      color:#fafafa; font-size:12px; font-family:inherit; line-height:1.5;
    }
    .df-ps-ta:focus { outline:none; border-color:rgba(236,72,153,.4); box-shadow:0 0 0 2px rgba(236,72,153,.15); }
    .df-ps-inj {
      width:100%; padding:11px; border-radius:10px; margin-top:6px;
      border:1px solid rgba(236,72,153,.3); background:rgba(236,72,153,.12);
      color:#fafafa; font-size:13px; font-weight:600; cursor:pointer; font-family:inherit;
      transition:transform 150ms cubic-bezier(.16,1,.3,1), background 150ms, border-color 150ms;
    }
    .df-ps-inj:hover { background:rgba(236,72,153,.2); border-color:rgba(236,72,153,.5); transform:translateY(-1px); }
    .df-ps-inj:active { transform:scale(.98); }
    .df-ps-inj:focus-visible { outline:none; box-shadow:0 0 0 2px rgba(236,72,153,.5); }
  `;

  // ─── Helpers ────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const wait = ms => new Promise(r => setTimeout(r, ms));

  function toast(msg, type) {
    let t = $('df-toast');
    if (!t) { t = document.createElement('div'); t.id = 'df-toast'; document.documentElement.appendChild(t); }
    t.textContent = msg; t.className = type || '';
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => t.classList.remove('show'), 2200);
  }

  async function ping() {
    try {
      const r = await fetch(SERVER+'/health', {signal:AbortSignal.timeout(3000)});
      serverUp = r.ok;
      if (!serverUp) console.log('[RHEO] Health check failed:', r.status);
    } catch (e) {
      serverUp = false;
      console.log('[RHEO] Health check error:', e.message);
    }
    const d = document.querySelector('#df-fab .df-fab-dot');
    if (d) d.className = 'df-fab-dot' + (serverUp ? '' : ' off');
    // Update status text in panel if open
    const statusEl = document.querySelector('.df-sr-text');
    if (statusEl && panelOpen) {
      statusEl.innerHTML = serverUp ? '<b>Connected</b> to RHEO' : 'Offline — start RHEO app';
    }
  }

  async function stats() {
    if (!serverUp) return;
    try {
      const r = await fetch(SERVER+'/ai-context/stats', {signal:AbortSignal.timeout(3000)});
      if (r.ok) {
        const d = await r.json();
        captureCount = d.total||0;
        lastCapture = d.newest||null;
        renderPanel();
      } else {
        console.log('[RHEO] Stats endpoint returned:', r.status);
      }
    } catch (e) {
      console.log('[RHEO] Stats fetch error:', e.message);
    }
  }

  async function history() {
    if (!serverUp) return;
    try {
      const r = await fetch(SERVER+'/ai-context/list?limit=15', {signal:AbortSignal.timeout(3000)});
      if (r.ok) {
        const d = await r.json();
        renderHist(d.captures||[]);
      } else {
        console.log('[RHEO] History endpoint returned:', r.status);
        renderHist([]);
      }
    } catch (e) {
      console.log('[RHEO] History fetch error:', e.message);
      renderHist([]);
    }
  }

  function timeAgo(ts) { const d=Date.now()-new Date(ts).getTime(); if(d<5e3)return'now';if(d<6e4)return Math.floor(d/1000)+'s';if(d<36e5)return Math.floor(d/6e4)+'m';return new Date(ts).toLocaleTimeString(); }

  // ─── Scrape all messages from chat ──────────────────────
  function scrapeAll() {
    const msgs = [];
    document.querySelectorAll(P.msgSel).forEach(el => {
      const text = el.innerText?.trim();
      if (!text || text.length < 10) return;
      if (!el.offsetParent) return; // hidden
      const role = P.roleAttr ? (el.getAttribute(P.roleAttr) || el.closest(`[${P.roleAttr}]`)?.getAttribute(P.roleAttr) || 'assistant') : 'assistant';
      msgs.push({role, content:text.slice(0,8000)});
    });
    return msgs;
  }

  // ─── Inject copy buttons on each message ────────────────
  function injectCopyButtons() {
    document.querySelectorAll(P.msgSel).forEach(el => {
      if (el.dataset.dfCopy) return;
      // Skip non-message elements (too small, hidden, or empty)
      const text = el.innerText?.trim();
      if (!text || text.length < 10) return;
      if (!el.offsetParent) return; // hidden
      // Only attach to the actual message element, not a large ancestor
      el.style.position = 'relative';
      el.classList.add('df-mw');
      const btn = document.createElement('button');
      btn.className = 'df-mb';
      btn.innerHTML = ICONS.copy;
      btn.title = 'Copy message';
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const t = el.innerText?.trim();
        if (t) {
          navigator.clipboard.writeText(t).then(() => {
            btn.classList.add('ok'); btn.innerHTML = ICONS.check;
            setTimeout(() => { btn.classList.remove('ok'); btn.innerHTML = ICONS.copy; }, 1500);
          });
        }
      });
      el.appendChild(btn);
      el.dataset.dfCopy = '1';
    });
  }

  // ─── Inject "Save" button on each assistant message ─────
  function injectSaveButtons() {
    document.querySelectorAll(P.msgSel).forEach(el => {
      if (el.dataset.dfSave) return;
      const isAssistant = P.roleAttr ? (el.getAttribute(P.roleAttr) === P.assistantVal || el.closest(`[${P.roleAttr}="${P.assistantVal}"]`) === el) : true;
      if (!isAssistant) return;
      const text = el.innerText?.trim();
      if (!text || text.length < 10) return;
      if (!el.offsetParent) return;
      el.style.position = 'relative';
      el.classList.add('df-mw');
      const btn = document.createElement('button');
      btn.className = 'df-mb';
      btn.style.right = '36px';
      btn.innerHTML = ICONS.brain;
      btn.title = 'Send to Brain';
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const t = el.innerText?.trim();
        if (!t) return;
        try {
          await fetch(SERVER+'/ai-context', {method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({captures:[{provider:P.name.toLowerCase(),messages:[{role:'assistant',content:t}],url:location.href,title:document.title,source:'inline-save',timestamp:new Date().toISOString(),captureKey:`save:${Date.now()}`}]}),
            signal:AbortSignal.timeout(5000)});
          btn.innerHTML = ICONS.check; btn.classList.add('ok');
          toast('Sent to Brain','ok');
          setTimeout(() => { btn.innerHTML = ICONS.brain; btn.classList.remove('ok'); }, 2000);
        } catch { toast('Failed','err'); }
      });
      el.appendChild(btn);
      el.dataset.dfSave = '1';
    });
  }

  // ─── Capture chat ───────────────────────────────────────
  async function captureChat() {
    const btn = $('df-cap-btn');
    if (btn) { btn.textContent = 'Capturing…'; btn.disabled = true; }
    const msgs = scrapeAll();
    if (!msgs.length) { toast('No messages found','err'); rstCap(); return; }
    try {
      const r = await fetch(SERVER+'/ai-context', {method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({captures:[{provider:P.name.toLowerCase(),messages:msgs,url:location.href,title:document.title,source:'overlay',timestamp:new Date().toISOString(),captureKey:`ov:${Date.now()}`}]}),
        signal:AbortSignal.timeout(5000)});
      if (r.ok) {
        captureCount++; lastCapture = new Date().toISOString();
        toast(`Captured ${msgs.length} messages `,'ok');
        if (btn) { btn.textContent = ' Captured'; btn.classList.add('ok'); }
        setTimeout(rstCap, 2000); stats();
      } else { toast('Error','err'); rstCap(); }
    } catch { toast('RHEO offline','err'); rstCap(); }
  }
  function rstCap() { const b=$('df-cap-btn'); if(b){b.textContent='Capture This Chat';b.disabled=false;b.classList.remove('ok');} }

  // ─── Send to Brain ──────────────────────────────────────
  async function sendBrain() {
    const msgs = scrapeAll();
    if (!msgs.length) { toast('No messages','err'); return; }
    try {
      await fetch(SERVER+'/ai-context', {method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({captures:[{provider:P.name.toLowerCase(),messages:msgs,url:location.href,title:document.title,source:'brain',timestamp:new Date().toISOString(),captureKey:`br:${Date.now()}`}]}),
        signal:AbortSignal.timeout(5000)});
      toast('Sent to Brain ','ok');
    } catch { toast('Failed','err'); }
  }

  // ─── Copy transcript ────────────────────────────────────
  function copyAll() {
    const msgs = scrapeAll();
    if (!msgs.length) { toast('No messages','err'); return; }
    navigator.clipboard.writeText(msgs.map(m=>`[${m.role}]\n${m.content}`).join('\n\n')).then(()=>toast('Copied ','ok'),()=>toast('Failed','err'));
  }

  // ─── Inject context into chat input ─────────────────────
  async function injectIntoChat(type) {
    let text = '';
    if (type === 'recent') {
      try {
        const r = await fetch(SERVER+'/ai-context/list?limit=3', {signal:AbortSignal.timeout(3000)});
        if (r.ok) { const d = await r.json(); text = (d.captures||[]).map(c=>`[${c.provider}] ${c.title||''}\n${(c.messages||[]).map(m=>`${m.role}: ${m.content.slice(0,300)}`).join('\n')}`).join('\n---\n'); }
      } catch {}
    } else if (type === 'problems') {
      try {
        const r = await fetch(SERVER+'/assemble-context', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:'problems',tokenBudget:1000}),signal:AbortSignal.timeout(3000)});
        if (r.ok) { const d = await r.json(); text = d.context || ''; }
      } catch {}
    } else if (type === 'custom') {
      text = prompt('Text to inject:');
    }
    if (!text) { toast('Nothing to inject','err'); return; }
    const el = document.querySelector(P.inputSel);
    if (el) {
      el.focus();
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') { el.value = text; }
      else { el.innerText = text; }
      el.dispatchEvent(new Event('input', {bubbles:true}));
      el.dispatchEvent(new Event('change', {bubbles:true}));
      toast('Injected ','ok');
    } else { toast('No input found','err'); }
  }

  // ─── Panel renderers ────────────────────────────────────
  function renderCapture() {
    if (!serverUp) {
      return `
        <div class="df-gc">
          <div class="df-empty">
            <div class="df-empty-i">!</div>
            <div class="df-empty-t">RHEO app is not running.<br>Start the app to use AI features.</div>
          </div>
        </div>
      `;
    }
    return `
      <div class="df-gc">
        <div class="df-sr"><div class="df-dot on"></div><div class="df-sr-text"><b>Connected</b> to RHEO</div></div>
        <div class="df-stats">
          <div class="df-stat"><div class="df-stat-v" style="color:#fafafa">${captureCount}</div><div class="df-stat-l">Captures</div></div>
          <div class="df-stat"><div class="df-stat-v" style="color:#a1a1aa">${lastCapture?timeAgo(lastCapture):'—'}</div><div class="df-stat-l">Last sync</div></div>
        </div>
        <button class="df-cap" id="df-cap-btn">Capture This Chat</button>
      </div>
      <div class="df-lb">Quick Actions</div>
      <div class="df-ag">
        <button class="df-ab" id="a-brain"><span class="df-ab-ic">${ICONS.brain}</span><span class="df-ab-nm">Send to Brain</span><span class="df-ab-ds">Knowledge graph</span></button>
        <button class="df-ab" id="a-lesson"><span class="df-ab-ic">${ICONS.book}</span><span class="df-ab-nm">Create Lesson</span><span class="df-ab-ds">Learn content</span></button>
        <button class="df-ab" id="a-copy"><span class="df-ab-ic">${ICONS.copy}</span><span class="df-ab-nm">Copy All</span><span class="df-ab-ds">Full transcript</span></button>
        <button class="df-ab" id="a-prompts"><span class="df-ab-ic">${ICONS.wand}</span><span class="df-ab-nm">Prompts</span><span class="df-ab-ds">Library</span></button>
      </div>
      <div class="df-lb" style="margin-top:16px">Inject into Chat</div>
      <button class="df-ib" id="a-inj-recent">→ Recent Captures</button>
      <button class="df-ib" id="a-inj-problems">→ Active Problems</button>
      <button class="df-ib" id="a-inj-custom">→ Custom Text…</button>
    `;
  }

  function renderHist() {
    return `<div class="df-lb">Recent Captures</div><div id="df-hl">
      <div class="df-hi" style="pointer-events:none;opacity:.5"><div class="df-hi-t" style="background:rgba(255,255,255,.06);border-radius:4px;height:14px;width:60%"></div><div class="df-hi-m"><span style="background:rgba(255,255,255,.04);border-radius:4px;height:10px;width:40px;display:inline-block"></span></div></div>
      <div class="df-hi" style="pointer-events:none;opacity:.3"><div class="df-hi-t" style="background:rgba(255,255,255,.06);border-radius:4px;height:14px;width:45%"></div><div class="df-hi-m"><span style="background:rgba(255,255,255,.04);border-radius:4px;height:10px;width:35px;display:inline-block"></span></div></div>
    </div>`;
  }

  function renderActions() {
    return `
      <div class="df-lb">Content Creation</div>
      <div class="df-ag">
        <button class="df-ab" id="a-les2"><span class="df-ab-ic">${ICONS.book}</span><span class="df-ab-nm">Full Lesson</span><span class="df-ab-ds">From chat</span></button>
        <button class="df-ab" id="a-quiz"><span class="df-ab-ic">${ICONS.bot}</span><span class="df-ab-nm">Quiz</span><span class="df-ab-ds">Test knowledge</span></button>
        <button class="df-ab" id="a-flash"><span class="df-ab-ic">${ICONS.copy}</span><span class="df-ab-nm">Flashcards</span><span class="df-ab-ds">Key terms</span></button>
        <button class="df-ab" id="a-sum"><span class="df-ab-ic">${ICONS.wand}</span><span class="df-ab-nm">Summarize</span><span class="df-ab-ds">AI summary</span></button>
      </div>
      <div class="df-lb" style="margin-top:16px">Research</div>
      <div class="df-ag">
        <button class="df-ab" id="a-ext"><span class="df-ab-ic">${ICONS.brain}</span><span class="df-ab-nm">Extract</span><span class="df-ab-ds">Entities & facts</span></button>
        <button class="df-ab" id="a-exp"><span class="df-ab-ic">${ICONS.copy}</span><span class="df-ab-nm">Export MD</span><span class="df-ab-ds">Download</span></button>
      </div>
    `;
  }

  function renderSettings() {
    return `
      <div class="df-gc"><div class="df-lb">Connection</div><div class="df-sr"><div class="df-dot ${serverUp?'on':'off'}"></div><div class="df-sr-text">${serverUp?'<b>localhost:54321</b>':'Offline'}</div></div></div>
      <div class="df-gc"><div class="df-lb">Provider</div><div class="df-sr"><div style="font-size:15px;font-weight:700;color:#fafafa;width:24px;text-align:center">${P.letter}</div><div class="df-sr-text"><b>${P.name}</b></div></div></div>
    `;
  }

  function renderHistList(caps) {
    const el = $('df-hl'); if (!el) return;
    if (!caps.length) {
      el.innerHTML = '<div class="df-empty"><div class="df-empty-i">—</div><div class="df-empty-t">No captures yet.<br>Capture a chat to see it here.</div></div>';
      return;
    }
    el.innerHTML = caps.map(c => {
      const n = c.messages?.length||0; const t = c.title||c.url?.split('/').pop()||'Untitled';
      return `<div class="df-hi" data-id="${c.id}"><div class="df-hi-t">${esc(t)}</div><div class="df-hi-m"><span class="df-bg">${c.provider}</span><span>${n} msgs</span><span>${c.captured_at?timeAgo(c.captured_at):''}</span></div></div>`;
    }).join('');
  }

  // ─── Panel render + bind ────────────────────────────────
  function renderPanel() {
    const b = document.querySelector('#df-panel .df-bd'); if (!b) return;
    switch(activeTab) {
      case 'capture': b.innerHTML = renderCapture(); break;
      case 'history': b.innerHTML = renderHist(); history(); break;
      case 'actions': b.innerHTML = renderActions(); break;
      case 'settings': b.innerHTML = renderSettings(); break;
    }
    bindPanel();
  }

  function bindPanel() {
    $('df-cap-btn')?.addEventListener('click', captureChat);
    $('a-brain')?.addEventListener('click', sendBrain);
    $('a-copy')?.addEventListener('click', copyAll);
    $('a-prompts')?.addEventListener('click', () => { promptLibOpen = !promptLibOpen; $('df-ps')?.classList.toggle('show', promptLibOpen); });
    $('a-inj-recent')?.addEventListener('click', () => injectIntoChat('recent'));
    $('a-inj-problems')?.addEventListener('click', () => injectIntoChat('problems'));
    $('a-inj-custom')?.addEventListener('click', () => injectIntoChat('custom'));
    $('a-lesson')?.addEventListener('click', () => toast('Open Learn in RHEO',''));
    $('a-les2')?.addEventListener('click', () => toast('Open Learn in RHEO',''));
    $('a-quiz')?.addEventListener('click', () => toast('Open Learn in RHEO',''));
    $('a-flash')?.addEventListener('click', () => toast('Open Learn in RHEO',''));
    $('a-sum')?.addEventListener('click', sendBrain);
    $('a-ext')?.addEventListener('click', sendBrain);
    $('a-exp')?.addEventListener('click', () => {
      const msgs = scrapeAll();
      if (!msgs.length) return;
      const md = msgs.map(m=>`### ${m.role}\n\n${m.content}`).join('\n\n---\n\n');
      const b = new Blob([md],{type:'text/markdown'}); const u = URL.createObjectURL(b);
      const a = document.createElement('a'); a.href=u; a.download=`chat-${Date.now()}.md`; a.click();
      URL.revokeObjectURL(u); toast('Exported ','ok');
    });
    document.querySelectorAll('.df-hi').forEach(el => el.addEventListener('click', () => toast(`View #${el.dataset.id} in RHEO`,'')));
  }

  // ─── Build everything ───────────────────────────────────
  function build() {
    // Styles
    const s = document.createElement('style'); s.textContent = CSS; document.documentElement.appendChild(s);

    // FAB
    const fab = document.createElement('button'); fab.id = 'df-fab';
    fab.innerHTML = `${P.letter}<div class="df-fab-dot off"></div>`;
    fab.title = `RHEO — ${P.name}`;
    document.documentElement.appendChild(fab);

    // Floating toolbar — toggle on FAB click, not hover
    const tb = document.createElement('div'); tb.id = 'df-toolbar';
    tb.innerHTML = `
      <button class="df-tb" id="tb-cap" title="Capture this chat">${ICONS.capture}<span class="tip">Capture</span></button>
      <button class="df-tb" id="tb-brain" title="Send all messages to Brain">${ICONS.brain}<span class="tip">Brain</span></button>
      <button class="df-tb" id="tb-copy" title="Copy full transcript">${ICONS.copy}<span class="tip">Copy</span></button>
      <button class="df-tb" id="tb-ce" title="Content Engine prompts">${ICONS.wand}<span class="tip">Content Engine</span></button>
      <button class="df-tb" id="tb-learn" title="Learn/Lyceum prompts">${ICONS.book}<span class="tip">Lessons</span></button>
      <button class="df-tb" id="tb-ai" title="Other AI features">${ICONS.bot}<span class="tip">AI Tools</span></button>
    `;
    document.documentElement.appendChild(tb);

    // Toggle toolbar on FAB click (not hover)
    fab.addEventListener('click', () => {
      panelOpen = !panelOpen;
      document.getElementById('df-panel')?.classList.toggle('open', panelOpen);
      tb.classList.toggle('show', !panelOpen && !tb.classList.contains('show'));
      if (panelOpen) { ping(); stats(); }
    });
    // Close toolbar when clicking outside
    document.addEventListener('click', (e) => {
      if (!tb.contains(e.target) && !fab.contains(e.target) && !panelOpen) {
        tb.classList.remove('show');
      }
    });

    // Toolbar buttons
    $('tb-cap')?.addEventListener('click', async () => {
      const btn = $('tb-cap');
      const msgs = scrapeAll();
      if (!msgs.length) { toast('No messages','err'); return; }
      try {
        await fetch(SERVER+'/ai-context', {method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({captures:[{provider:P.name.toLowerCase(),messages:msgs,url:location.href,title:document.title,source:'toolbar',timestamp:new Date().toISOString(),captureKey:`tb:${Date.now()}`}]}),
          signal:AbortSignal.timeout(5000)});
        captureCount++; btn.classList.add('ok');
        toast(`Captured ${msgs.length}`,'ok');
        setTimeout(() => btn.classList.remove('ok'), 2000);
        stats();
      } catch { toast('Offline','err'); }
    });
    $('tb-brain')?.addEventListener('click', sendBrain);
    $('tb-copy')?.addEventListener('click', copyAll);

    // Content Engine prompts
    $('tb-ce')?.addEventListener('click', () => openPromptSelector('content-engine'));
    // Learn prompts
    $('tb-learn')?.addEventListener('click', () => openPromptSelector('learn'));
    // AI Tools prompts
    $('tb-ai')?.addEventListener('click', () => openPromptSelector('ai-tools'));

    // Prompt selector panel
    const ps = document.createElement('div'); ps.id = 'df-ps';
    ps.innerHTML = `<div id="df-ps-inner"></div>`;
    document.documentElement.appendChild(ps);

    // Per-type field/section configuration for the dynamic prompt builder.
    // sections  → content-engine script sections the user can include
    // fields    → learn/ai-tool output fields the user can request (passed as [FILL THIS] markers)
    // frameMode → strict/loose toggle
    // style     → learn writing style selector
    // context   → free-text "based on this conversation" box
    const PROMPT_FIELDS = {
      classify:    { frameMode:true },
      synthesize:  { frameMode:true },
      script:      { sections:['retention','hooks','frames','lessons','format'], frameMode:true },
      gates:       {},
      seo:         {},
      analytics:   {},
      lessons:     {},
      reflection:  {},
      frameworks:  {},
      'create-lesson':    { style:true, context:true, fields:['title','overview','concepts','practice_questions'] },
      'create-quiz':      { style:true, context:true, fields:['questions'] },
      'create-flashcards':{ style:true, context:true, fields:['cards'] },
      'summarize':        { style:true, context:true, fields:['title','summary','key_points','suggested_topic'] },
      'refine-lesson':    { style:true, context:true, fields:['improvements','missing_concepts','overall_quality'] },
      brainstorm:         { context:true, fields:['ideas'] },
      'research-digest':  { context:true, fields:['topic','summary','key_findings','sources','action_items'] },
      'resume-builder':   { context:true, fields:['section'] },
      'goal-assistant':   { context:true, fields:['goals'] },
      'category':         { fields:['categories'] },
      'monthly-recap':    { fields:['recap'] },
    };
    const SECTION_LABELS = { retention:'Retention Evidence', hooks:'Hook & Pattern Interrupt', frames:'Script Frames', lessons:'Lessons Extract', format:'Output Format' };
    const STYLE_OPTIONS = [
      { v:'concise', l:'Concise', d:'Tight, direct output' },
      { v:'detailed', l:'Detailed', d:'Full explanations' },
      { v:'socratic', l:'Socratic', d:'Question-led, guided' },
    ];

    async function openPromptSelector(category) {
      const inner = document.getElementById('df-ps-inner');
      if (!inner) return;
      ps.classList.toggle('show');
      if (!ps.classList.contains('show')) return;
      inner.innerHTML = '<div class="df-ps-loading">Loading prompts...</div>';
      try {
        const r = await fetch(SERVER+'/ai-prompts', {signal:AbortSignal.timeout(3000)});
        if (!r.ok) throw new Error('Server error');
        const data = await r.json();
        const filtered = data.prompts.filter(p => p.category === category);
        inner.__prompts = filtered;
        ps.dataset.category = category;
        if (!filtered.length) { inner.innerHTML = '<div class="df-ps-empty">No prompts available</div>'; return; }
        inner.innerHTML = `<div class="df-ps-title">${category.replace('-',' ')}</div>` +
          filtered.map(p => `<div class="df-ps-item" data-type="${p.type}"><div class="df-ps-nm">${p.label}</div><div class="df-ps-ds">${p.description}</div></div>`).join('');
        inner.querySelectorAll('.df-ps-item').forEach(el => el.addEventListener('click', () => renderPromptConfig(el.dataset.type)));
      } catch { inner.innerHTML = '<div class="df-ps-empty">Offline</div>'; }
    }

    // Step 2: dynamic field/section selection for the chosen prompt type
    function renderPromptConfig(type) {
      const inner = document.getElementById('df-ps-inner');
      if (!inner) return;
      const cfg = PROMPT_FIELDS[type] || {};
      const meta = (inner.__prompts || []).find(p => p.type === type) || {};
      let body = '';

      if (cfg.sections && cfg.sections.length) {
        body += `<div class="df-ps-sec"><div class="df-ps-sec-lb">Sections to include</div>` +
          cfg.sections.map(s => `<label class="df-ps-chk on" data-grp="sections" data-val="${s}"><input type="checkbox" checked><span class="df-ps-chk-tx"><span class="df-ps-chk-nm">${SECTION_LABELS[s]||s}</span></span></label>`).join('') +
          `</div>`;
      }
      if (cfg.fields && cfg.fields.length) {
        body += `<div class="df-ps-sec"><div class="df-ps-sec-lb">Fields to fill</div>` +
          cfg.fields.map(f => `<label class="df-ps-chk on" data-grp="fields" data-val="${f}"><input type="checkbox" checked><span class="df-ps-chk-tx"><span class="df-ps-chk-nm">${f}</span></span></label>`).join('') +
          `</div>`;
      }
      if (cfg.frameMode) {
        body += `<div class="df-ps-sec"><div class="df-ps-sec-lb">Rigor</div>` +
          `<label class="df-ps-chk on" data-grp="frameMode" data-val="strict"><input type="checkbox" checked><span class="df-ps-chk-tx"><span class="df-ps-chk-nm">Strict</span><span class="df-ps-chk-ds">Every field mandatory</span></span></label>` +
          `<label class="df-ps-chk" data-grp="frameMode" data-val="loose"><input type="checkbox"><span class="df-ps-chk-tx"><span class="df-ps-chk-nm">Loose</span><span class="df-ps-chk-ds">Creative variation allowed</span></span></label>` +
          `</div>`;
      }
      if (cfg.style) {
        body += `<div class="df-ps-sec"><div class="df-ps-sec-lb">Writing style</div>` +
          STYLE_OPTIONS.map((o,i) => `<label class="df-ps-chk ${i===0?'on':''}" data-grp="style" data-val="${o.v}"><input type="checkbox" ${i===0?'checked':''}><span class="df-ps-chk-tx"><span class="df-ps-chk-nm">${o.l}</span><span class="df-ps-chk-ds">${o.d}</span></span></label>`).join('') +
          `</div>`;
      }
      if (cfg.context) {
        body += `<div class="df-ps-sec"><div class="df-ps-sec-lb">Context (optional)</div>` +
          `<textarea class="df-ps-ta" id="df-ps-ctx" placeholder="Paste relevant conversation snippets or notes the AI should base this on..."></textarea></div>`;
      }

      inner.innerHTML = `
        <button class="df-ps-back" id="df-ps-back">‹ Back to prompts</button>
        <div class="df-ps-head">${meta.label || type}</div>
        <div class="df-ps-sub">${meta.description || 'Select what to include, then build.'}</div>
        ${body}
        <button class="df-ps-inj" id="df-ps-inj">Build &amp; Inject Prompt</button>
      `;
      inner.querySelectorAll('.df-ps-chk').forEach(lbl => {
        const cb = lbl.querySelector('input');
        lbl.addEventListener('click', e => { if (e.target !== cb) { cb.checked = !cb.checked; } lbl.classList.toggle('on', cb.checked); });
        cb.addEventListener('change', () => lbl.classList.toggle('on', cb.checked));
      });
      $('df-ps-back')?.addEventListener('click', () => { ps.dataset.category && openPromptSelector(ps.dataset.category); });
      $('df-ps-inj')?.addEventListener('click', () => buildAndInject(type, collectOpts(inner, cfg)));
    }

    // Read selected options from the config UI
    function collectOpts(inner, cfg) {
      const opts = { sections: [], fields: {}, frameMode: 'loose', style: '' };
      inner.querySelectorAll('.df-ps-chk.on input:checked').forEach(cb => {
        const lbl = cb.closest('.df-ps-chk');
        const grp = lbl.dataset.grp, val = lbl.dataset.val;
        if (grp === 'sections') opts.sections.push(val);
        else if (grp === 'frameMode') opts.frameMode = val;
        else if (grp === 'style') opts.style = val;
        else if (grp === 'fields') opts.fields[val] = '';
      });
      if (cfg.sections && !opts.sections.length) opts.sections = cfg.sections;
      const ctx = $('df-ps-ctx');
      const thought = ctx ? ctx.value.trim() : '';
      return { ...opts, thought: thought || undefined };
    }

    async function buildAndInject(type, opts) {
      opts = opts || { sections:['retention','hooks','frameworks','lessons','format'], frameMode:'strict', fields:{} };
      toast('Building prompt...');
      try {
        const r = await fetch(SERVER+'/ai-prompts/build', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            type,
            sections: opts.sections || ['retention','hooks','frameworks','lessons','format'],
            frameMode: opts.frameMode || 'strict',
            fields: opts.fields || {},
            style: opts.style || undefined,
            thought: opts.thought
          }),
          signal:AbortSignal.timeout(10000)
        });
        if (!r.ok) throw new Error('Build failed');
        const data = await r.json();
        if (!data.ok || !data.prompt) { toast(data.error||'Build failed','err'); return; }
        // Inject into chat input
        const inputs = [document.querySelector('textarea[placeholder*="Message"]'),document.querySelector('textarea[aria-label*="Message"]'),document.querySelector('[contenteditable="true"][role="textbox"]'),document.querySelector('textarea'),document.querySelector('[contenteditable="true"]')];
        const target = inputs.find(el=>el&&el.offsetParent!==null);
        if (target) {
          target.focus();
          if(target.tagName==='TEXTAREA'||target.tagName==='INPUT'){target.value=data.prompt;}else{target.innerText=data.prompt;}
          target.dispatchEvent(new Event('input',{bubbles:true}));
          toast('Prompt injected');
          ps.classList.remove('show');
        } else { toast('No chat input found','err'); }
      } catch { toast('Failed','err'); }
    }

    // Panel
    const panel = document.createElement('div'); panel.id = 'df-panel';
    panel.innerHTML = `
      <div class="df-hd">
        <div class="df-hd-icon">${P.letter}</div>
        <div><div class="df-hd-title">RHEO × ${P.name}</div><div class="df-hd-sub">AI Context Bridge</div></div>
        <button class="df-hd-x" id="df-px">✕</button>
      </div>
      <div class="df-tabs">
        <button class="df-tab on" data-t="capture">Capture</button>
        <button class="df-tab" data-t="history">History</button>
        <button class="df-tab" data-t="actions">Actions</button>
        <button class="df-tab" data-t="settings">Settings</button>
      </div>
      <div class="df-bd"></div>
      <div class="df-ft">RHEO Bridge v1.3.0</div>
    `;
    document.documentElement.appendChild(panel);

    panel.querySelectorAll('.df-tab').forEach(t => t.addEventListener('click', () => {
      panel.querySelectorAll('.df-tab').forEach(x=>x.classList.remove('on'));
      t.classList.add('on'); activeTab = t.dataset.t; renderPanel();
    }));
    $('df-px')?.addEventListener('click', () => { panelOpen = false; panel.classList.remove('open'); });

    renderPanel();

    // Inject copy/save buttons periodically
    let injectTimer = null;
    const observer = new MutationObserver(() => {
      if (injectTimer) clearTimeout(injectTimer);
      injectTimer = setTimeout(() => { injectCopyButtons(); injectSaveButtons(); }, 500);
    });
    observer.observe(document.body, {childList:true, subtree:true});
    injectCopyButtons(); injectSaveButtons();
  }

  // ─── Listen for popup (via chrome.runtime or postMessage from focusOverlay) ──
  try { chrome.runtime.onMessage?.addListener(msg => { if (msg?.type==='DF_TOGGLE_PANEL') { panelOpen=!panelOpen; document.getElementById('df-panel')?.classList.toggle('open',panelOpen); if(panelOpen){ping();stats();} } }); } catch (e) {}
  window.addEventListener('message', (e) => { if (e.data?.type==='DF_TOGGLE_PANEL') { panelOpen=!panelOpen; document.getElementById('df-panel')?.classList.toggle('open',panelOpen); if(panelOpen){ping();stats();} } });

  // ─── Init ───────────────────────────────────────────────
  build(); ping(); setInterval(ping, 15000);
  console.log(`[RHEO] Full overlay active: ${P.name}`);
})();
