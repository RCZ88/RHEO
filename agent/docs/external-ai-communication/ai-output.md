               Now I have everything needed. Let me present the complete system design to you.

---

## Architecture Overview

The system is a **dual-interface gateway** that sits between your applications and the web UIs of AI providers. It uses a real browser (with anti-bot stealth) to interact with authenticated sessions, then exposes those sessions through both **MCP tools** (for AI agents) and an **OpenAI-compatible REST API** (for traditional code).

![Architecture Diagram](sandbox:///mnt/agents/output/architecture_diagram.svg)

---

## Core Design Decisions

### 1. Browser Layer: "Schrödinger's Browser"
To defeat Cloudflare and modern bot detection, the browser must run in **headful mode** (real window, GPU rendering). But servers don't have monitors. The solution is **Xvfb (virtual framebuffer) + VNC + noVNC** — the browser renders to a fake display that you can view via web browser at `http://gateway:6080`. To anti-bot systems, it's a real user browsing. To your server, it's fully automated. 

### 2. Anti-Bot Stack: Patchright + Human Simulation
- **Patchright** (stealth Playwright fork) patches `navigator.webdriver`, canvas fingerprints, WebGL, CDP leaks, and TLS JA3 signatures 
- **Human behavior simulator**: Bézier curve mouse movements, variable typing speeds (40-80 WPM with jitter), clipboard paste for long text, viewport randomization (±20px), and idle cursor drift

### 3. Completion Detection: 3-Tier Fallback System
Since web UIs stream responses into the DOM, we can't just wait for a network response. Each provider adapter implements three detection strategies: 

| Tier | Strategy | Example (ChatGPT) |
|------|----------|-------------------|
| **Primary** | DOM marker appearance | Copy button appears (`[data-testid="copy-button"]`) |
| **Fallback** | Button disappearance | Stop generating button vanishes |
| **Last Resort** | Text stability | Response text unchanged for 5 consecutive seconds |

### 4. Session Persistence: Isolated Profiles
Each provider gets its own persistent Chrome profile directory (`./data/profiles/{provider}/`). Login state, cookies, and localStorage survive restarts. Health checks run every 15 minutes to validate sessions. If a session expires, the system queues requests and sends a notification (Discord/Slack/SMS) for human re-auth via VNC.

### 5. Provider Adapters: Configuration-Driven
Instead of hardcoding selectors, each provider is a JSON/YAML config module with **selector fallback chains**. When ChatGPT changes a `data-testid`, the next selector in the list catches it. All adapters share the same interface but provider-specific logic for input, submit, response extraction, and completion detection.

---

## Per-Provider Specifications

| Provider | Input Method | Primary Completion Detection | Auth Method | Anti-Bot Level | Rate Limit |
|----------|-------------|------------------------------|-------------|----------------|------------|
| **ChatGPT** | `contenteditable` div, Enter key | Copy button appearance | Email/OAuth | **High** (Cloudflare Turnstile) | ~30-40/hr |
| **Claude** | `contenteditable` div, Enter key | Stop button disappearance | Email code / Google OAuth | **High** (Cloudflare) | ~45/8hr |
| **Gemini** | `textarea` / `rich-textarea`, Enter | Send spinner stop | Google OAuth | **Medium** (reCAPTCHA v3) | ~60/hr |
| **Kimi** | `textarea`, Enter | Loading indicator stop | Phone/Email + code | **Medium** | ~100/day |
| **DeepSeek** | `textarea`, Enter | Stop button disappearance | Phone/Email/QR (WeChat) | **Medium** (Chinese CAPTCHA) | ~50/day |
| **Qwen** | `textarea`, Enter or button | Send spinner stop | Phone/Alibaba account | **Medium** (slider CAPTCHA) | ~100/day |
| **GLM** | `textarea`, Enter | Stop button disappearance | Phone + SMS | **Medium** | ~60/day |
| **Grok** | `textarea`, Enter | Stop button disappearance | X (Twitter) OAuth | **High** (X bot detection) | ~25/2hr |

---

## MCP Tool Interface

The MCP server exposes these tools to any compatible client (Claude Desktop, Cursor, VS Code, etc.):

- **`send_prompt`** — Send a prompt to any provider, get back the response text
- **`get_provider_status`** — Check if a provider is ready, rate-limited, or needs re-auth
- **`setup_provider`** — Launch a VNC session for manual login/setup
- **`list_providers`** — List all configured providers and their models
- **`clear_conversation`** — Start a new chat thread
- **`upload_file`** — Upload files to providers that support it

## REST API Interface

For non-MCP clients, the gateway exposes OpenAI-compatible endpoints:

- `POST /v1/chat/completions` — Drop-in replacement for OpenAI API
- `GET /v1/models` — Lists mapped models like `chatgpt-gpt-4o`, `claude-claude-3-5-sonnet`
- `POST /v1/images/generations` — For DALL-E, Aurora, etc.
- `GET /providers/{id}/status` — Real-time provider health

---

## Credential & Session Management

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User      │────▶│  Gateway    │────▶│   Browser   │────▶│  Provider   │
│             │     │   Server    │     │  (VNC)      │     │  Login Page │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │                   │
       │ 1. Request setup  │                   │                   │
       │──────────────────▶│                   │                   │
       │                   │ 2. Launch headed  │                   │
       │                   │    browser + VNC  │                   │
       │                   │──────────────────▶│                   │
       │ 3. Open VNC URL   │                   │                   │
       │◀──────────────────│                   │                   │
       │                   │                   │ 4. Navigate to    │
       │                   │                   │    provider login │
       │                   │                   │──────────────────▶│
       │ 5. User logs in   │                   │                   │
       │    via VNC        │                   │                   │
       │──────────────────▶│                   │                   │
       │                   │ 6. Detect login   │                   │
       │                   │    success        │                   │
       │                   │◀──────────────────│                   │
       │                   │ 7. Save storage   │                   │
       │                   │    state to vault │                   │
       │ 8. Return success │                   │                   │
       │◀──────────────────│                   │                   │
```

The credential vault uses **AES-256-GCM** encryption with the master key from an environment variable (`WEBUI_GATEWAY_MASTER_KEY`). Session data (cookies, localStorage, OAuth tokens) is stored encrypted and never committed to version control.

---

## Implementation Roadmap

| Phase | Duration | Deliverables |
|-------|----------|-------------|
| **Foundation** | Week 1-2 | Docker stack (Xvfb+VNC+noVNC), Patchright integration, credential vault |
| **Core Adapters** | Week 3-4 | ChatGPT, Claude, Gemini adapters with 3-tier detection |
| **MCP Server** | Week 5 | `send_prompt`, `get_provider_status`, `setup_provider` tools |
| **REST API** | Week 6 | OpenAI-compatible endpoints with streaming SSE |
| **All Providers** | Week 7-8 | Kimi, DeepSeek, Qwen, GLM, Grok adapters |
| **Production** | Week 9-10 | Redis queue, rate limiting, health checks, dashboard, notifications |

---

## Key Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| **DOM changes break selectors** | Selector fallback chains + community-driven adapter updates |
| **Anti-bot blocks access** | Full stealth stack + Xvfb + human simulation + VNC fallback |
| **Session expiry** | Persistent contexts + health checks + auto-notification for re-auth |
| **Rate limits** | Queue system + per-provider cooldown + graceful degradation |
| **CAPTCHA / 2FA** | Human-in-the-loop via VNC + notification channels (Discord/Slack) |

---

## Downloadable Documents

**Full Technical Specification (35,000+ words):**
[AI_WebUI_Gateway_Specification.md](sandbox:///mnt/agents/output/AI_WebUI_Gateway_Specification.md)

**Architecture Diagram (SVG):**
[architecture_diagram.svg](sandbox:///mnt/agents/output/architecture_diagram.svg)

---

The specification includes complete adapter configs (selectors, detection strategies, auth flows) for all 8 providers, the full MCP tool schemas, REST API endpoint definitions, Docker Compose deployment config, monitoring metrics, and log structures. This is ready to hand off to your coding agent (OpenCode) for implementation.