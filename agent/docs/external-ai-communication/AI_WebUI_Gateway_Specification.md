# AI Web-UI Gateway: Technical Specification
## Browser-Automation-Based AI Provider Access via MCP + REST API

**Version:** 1.0  
**Date:** 2026-09-08  
**Status:** Design Phase — Ready for Implementation Review  

---

## 1. Executive Summary

This document specifies the architecture for a unified gateway that exposes web-based AI chat interfaces (Claude.ai, ChatGPT, Gemini, Kimi, DeepSeek, Qwen, GLM, Grok) as programmatic interfaces. The system uses browser automation (Playwright with stealth patches) to interact with authenticated web sessions, then exposes access through two interfaces:

1. **MCP Server** — For AI agents and IDE integrations (Claude Desktop, Cursor, VS Code, etc.)
2. **OpenAI-Compatible REST API** — For traditional application integration (curl, Python SDK, LangChain, etc.)

The core value proposition: **Access premium web-only models and generous rate limits through authenticated browser sessions, bypassing API pricing and restrictive token quotas.**

---

## 2. System Architecture

### 2.1 High-Level Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   MCP Client │  │  REST Client │  │   CLI Tool   │  │  Web Dashboard│  │
│  │ (Claude, etc)│  │ (curl, SDK)  │  │  (Setup TUI) │  │  (VNC + UI)  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
└─────────┼─────────────────┼─────────────────┼─────────────────┼──────────┘
          │                 │                 │                 │
          ▼                 ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GATEWAY SERVER (Node.js/Python)                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │   MCP Server    │  │   REST API      │  │    Credential & Session     │  │
│  │  (JSON-RPC/SSE) │  │ (OpenAI-compat) │  │        Manager              │  │
│  └────────┬────────┘  └────────┬────────┘  └─────────────────────────────┘  │
│           │                    │                                             │
│           └────────┬───────────┘                                             │
│                    ▼                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │              Request Router & Orchestrator                          │    │
│  │  • Queue management  • Rate limiting  • Provider selection          │    │
│  │  • Retry logic       • Error recovery   • Load balancing            │    │
│  └────────────────────────────────┬────────────────────────────────────┘    │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BROWSER AUTOMATION LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────────┐  │
│  │  Patchright  │  │   Xvfb+VNC   │  │   Human Behavior Simulator       │  │
│  │  (Stealth PW)│  │ (Virtual Disp)│  │  • Mouse drift                   │  │
│  │              │  │              │  │  • Typing jitter                 │  │
│  │  Anti-bot:   │  │  Human-in-   │  │  • Viewport randomization        │  │
│  │  • webdriver │  │  the-loop    │  │  • Clipboard injection           │  │
│  │  • canvas    │  │  for login   │  │  • Realistic delays              │  │
│  │  • WebGL     │  │  & CAPTCHA   │  │                                  │  │
│  │  • plugins   │  │              │  │                                  │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────────────┘  │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PROVIDER ADAPTER LAYER                                │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │
│  │ChatGPT │ │ Claude │ │ Gemini │ │  Kimi  │ │DeepSeek│ │  Qwen  │ ...    │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘        │
│                                                                             │
│  Each adapter: input selectors, submit strategy, response container,        │
│  completion detection (3-tier), auth flow, anti-bot config                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Gateway Runtime | Node.js 20+ (TypeScript) or Python 3.11+ | Fast async I/O, mature MCP SDKs |
| Browser Engine | Patchright (stealth Playwright fork) | Passes bot detection, CDP access |
| Virtual Display | Xvfb + x11vnc + noVNC | Headful on headless servers |
| Session Storage | SQLite + encrypted JSON | Lightweight, portable, secure |
| MCP Transport | stdio / SSE (Server-Sent Events) | Standard MCP transports |
| REST Framework | FastAPI (Python) or Express (Node) | OpenAPI generation, async native |
| Container | Docker + Docker Compose | Reproducible, isolated deployments |

---

## 3. Provider Adapter Specifications

Each provider adapter is a configuration module that defines:

### 3.1 Adapter Configuration Schema

```typescript
interface ProviderAdapter {
  id: string;                    // "chatgpt", "claude", "gemini", etc.
  name: string;                  // Display name
  url: string;                   // Base URL

  // Input Configuration
  input: {
    selector: string[];          // Fallback chain for textarea/input
    submitMethod: "enter" | "button" | "both";
    submitButtonSelector?: string[];
    preSubmitDelay: number;      // ms to wait before submit
    clearInput: boolean;         // Whether to clear before typing
  };

  // Response Configuration
  response: {
    containerSelector: string[]; // Message bubble container
    textExtractor: string;       // JS function or selector for text
    streaming: boolean;          // Whether response streams in
  };

  // Completion Detection (3-tier fallback)
  completionDetection: {
    primary: DetectionStrategy;
    fallback: DetectionStrategy;
    lastResort: DetectionStrategy;
    timeoutMs: number;           // Absolute timeout
    pollIntervalMs: number;      // Polling frequency
  };

  // Authentication
  auth: {
    type: "email" | "oauth" | "qr" | "phone" | "sso";
    loginUrl: string;
    selectors: AuthSelectors;
    mfaHandler: "auto" | "manual" | "notification";
    sessionValidityMs: number;   // How long before re-auth needed
  };

  // Anti-bot
  antiBot: {
    cloudflare: boolean;
    captchaProvider?: string;
    requiredHeaders?: Record<string, string>;
    viewport: { width: number; height: number; };
    userAgent: string;
  };

  // Rate Limits
  rateLimit: {
    requestsPerMinute: number;
    concurrentRequests: number;
    cooldownMs: number;          // Between requests
  };
}

interface DetectionStrategy {
  type: "dom_marker" | "button_appearance" | "button_disappearance" | "text_stability" | "network_idle" | "custom_js";
  selector?: string[];         // Element to watch
  condition?: "exists" | "not_exists" | "count_increased" | "stable";
  stableDurationMs?: number;   // For text_stability
  customScript?: string;       // For custom_js
}
```

### 3.2 Per-Provider Specifications

#### **1. ChatGPT (chatgpt.com / chat.openai.com)**

| Aspect | Configuration |
|--------|--------------|
| **URL** | `https://chatgpt.com` |
| **Input Selector** | `["#prompt-textarea", "[data-testid="prompt-textarea"]", "textarea[placeholder*="Message"]"]` |
| **Submit Method** | `enter` (Shift+Enter for newline) |
| **Response Container** | `["[data-testid="conversation-turn-3"] .markdown", ".text-message", "[data-message-author-role="assistant"]"]` |
| **Primary Detection** | `button_appearance` — Copy button appears (`[data-testid="copy-button"]`) |
| **Fallback Detection** | `button_disappearance` — Stop generation button disappears (`[aria-label="Stop generating"]`) |
| **Last Resort** | `text_stability` — Poll every 1s, stable for 5s |
| **Auth Type** | `email` or `oauth` (Google/Microsoft/Apple) |
| **Login Selectors** | Email: `input[name="username"]`, Password: `input[type="password"]`, Submit: `button[type="submit"]` |
| **Anti-bot** | Cloudflare Turnstile, heavy bot detection. Requires full stealth + Xvfb |
| **Special Notes** | • Copy button count before/after is most reliable<br>• May show "Verify you are human" mid-session<br>• DALL-E images detectable via `img[alt="Generated image"]` |
| **Rate Limit** | ~30-40 requests/hour visible, soft-limit via "too many messages" banner |

#### **2. Claude (claude.ai)**

| Aspect | Configuration |
|--------|--------------|
| **URL** | `https://claude.ai/new` or `https://claude.ai/chat` |
| **Input Selector** | `["[contenteditable="true"]", "[data-testid="chat-input"]", "textarea[placeholder*="Message"]", ".ProseMirror"]` |
| **Submit Method** | `enter` |
| **Response Container** | `["[data-testid="chat-message"]", ".font-claude-message", "[data-message-role="assistant"]"]` |
| **Primary Detection** | `button_disappearance` — Stop button (`[aria-label="Stop"]`, `.stop-button`) disappears |
| **Fallback Detection** | `button_appearance` — Copy button appears |
| **Last Resort** | `text_stability` — Stable for 4s |
| **Auth Type** | `email` + verification code (no password) or `google` OAuth |
| **Login Selectors** | Email: `input[type="email"]`, Code: `input[type="text"]` (6-digit), Submit: `button[type="submit"]` |
| **Anti-bot** | Cloudflare, email verification code sent to inbox |
| **Special Notes** | • Contenteditable div, not textarea — use `page.fill()` with care<br>• Email code requires manual entry or email IMAP integration<br>• Projects/artifacts have separate DOM structures |
| **Rate Limit** | ~45 messages/8 hours on Pro, visible in UI |

#### **3. Gemini (gemini.google.com)**

| Aspect | Configuration |
|--------|--------------|
| **URL** | `https://gemini.google.com/app` |
| **Input Selector** | `["rich-textarea", "[data-testid="input-area"]", "textarea[placeholder*="Ask"]", "[contenteditable="true"]"]` |
| **Submit Method** | `enter` |
| **Response Container** | `[".response-content", "[data-testid="response-text"]", ".markdown-content"]` |
| **Primary Detection** | `button_disappearance` — Send button spinner stops |
| **Fallback Detection** | `dom_marker` — "Draft saved" or timestamp appears |
| **Last Resort** | `text_stability` — Stable for 5s |
| **Auth Type** | `google` OAuth (single sign-on) |
| **Login Selectors** | Google OAuth flow — redirects to accounts.google.com |
| **Anti-bot** | Google's own bot detection (reCAPTCHA v3 invisible) |
| **Special Notes** | • Deep Google integration — uses same session as Google account<br>• File upload via Google Drive integration<br>• Extensions (YouTube, Maps) have special UI elements |
| **Rate Limit** | ~60 requests/hour, visible rate limit banner |

#### **4. Kimi (kimi.com / kimi.moonshot.cn)**

| Aspect | Configuration |
|--------|--------------|
| **URL** | `https://kimi.com` or `https://kimi.moonshot.cn` |
| **Input Selector** | `["textarea", "[data-testid="chat-input"]", ".chat-input textarea"]` |
| **Submit Method** | `enter` |
| **Response Container** | `["[data-testid="assistant-message"]", ".message-content", ".markdown-body"]` |
| **Primary Detection** | `button_disappearance` — Loading indicator stops |
| **Fallback Detection** | `text_stability` — Stable for 4s |
| **Last Resort** | `network_idle` — No network activity for 3s |
| **Auth Type** | `phone` (China) or `email` + verification code |
| **Login Selectors** | Phone: `input[type="tel"]`, Code: `input[type="number"]`, Submit: `button[type="submit"]` |
| **Anti-bot** | Moderate — Chinese CDN, SMS verification |
| **Special Notes** | • Kimi WebBridge extension available — can use CDP directly<br>• Supports file upload, web search, long context (200K+ tokens)<br>• Mobile-responsive UI |
| **Rate Limit** | Generous — ~100+ messages/day for registered users |

#### **5. DeepSeek (chat.deepseek.com)**

| Aspect | Configuration |
|--------|--------------|
| **URL** | `https://chat.deepseek.com` |
| **Input Selector** | `["textarea", "[data-testid="chat-input"]", ".input-area textarea"]` |
| **Submit Method** | `enter` |
| **Response Container** | `["[data-testid="assistant-message"]", ".message-content", ".chat-message-assistant"]` |
| **Primary Detection** | `button_disappearance` — Stop button disappears |
| **Fallback Detection** | `text_stability` — Stable for 5s |
| **Last Resort** | `custom_js` — Check for streaming CSS class removal |
| **Auth Type** | `phone` (China) or `email` + password, or `qr` (WeChat/QQ) |
| **Login Selectors** | Phone: `input[name="phone"]`, Password: `input[type="password"]` |
| **Anti-bot** | Chinese CAPTCHA, phone verification |
| **Special Notes** | • QR code login via WeChat — requires screenshot + notification<br>• DeepThink mode has separate toggle button<br>• Search mode adds web results to response<br>• Often shows "Server is busy" — needs retry logic |
| **Rate Limit** | ~50 requests/day, busy-period throttling |

#### **6. Qwen (chat.qwen.ai / tongyi.aliyun.com)**

| Aspect | Configuration |
|--------|--------------|
| **URL** | `https://chat.qwen.ai` or `https://tongyi.aliyun.com` |
| **Input Selector** | `["textarea", "[data-testid="chat-input"]", ".chat-input"]` |
| **Submit Method** | `enter` or `button` |
| **Response Container** | `["[data-testid="assistant-message"]", ".message-content", ".answer-content"]` |
| **Primary Detection** | `button_disappearance` — Send spinner stops |
| **Fallback Detection** | `text_stability` — Stable for 4s |
| **Last Resort** | `dom_marker` — "Completed" text or timestamp |
| **Auth Type** | `phone` (China) or `email` + Alibaba account |
| **Login Selectors** | Alibaba unified login — redirects to login.alibaba.com |
| **Anti-bot** | Alibaba bot detection, slider CAPTCHA |
| **Special Notes** | • Supports multimodal (image upload)<br>• Code interpreter mode available<br>• Chinese/English bilingual interface |
| **Rate Limit** | ~100 requests/day for free tier |

#### **7. GLM (chatglm.cn / chat.zhipuai.com)**

| Aspect | Configuration |
|--------|--------------|
| **URL** | `https://chatglm.cn` or `https://chat.zhipuai.com` |
| **Input Selector** | `["textarea", "[data-testid="chat-input"]", ".input-box textarea"]` |
| **Submit Method** | `enter` |
| **Response Container** | `["[data-testid="assistant-message"]", ".message-content", ".chat-answer"]` |
| **Primary Detection** | `button_disappearance` — Stop generating button |
| **Fallback Detection** | `text_stability` — Stable for 4s |
| **Last Resort** | `network_idle` — No activity for 3s |
| **Auth Type** | `phone` (China) + SMS verification |
| **Login Selectors** | Phone: `input[type="tel"]`, Code: `input[type="number"]` |
| **Anti-bot** | Chinese phone verification, moderate bot detection |
| **Special Notes** | • AllTools mode (web search, code interpreter, drawing)<br>• Long context support<br>• File upload and image understanding |
| **Rate Limit** | ~60 requests/day |

#### **8. Grok (grok.com / x.ai)**

| Aspect | Configuration |
|--------|--------------|
| **URL** | `https://grok.com` or `https://x.com/i/grok` |
| **Input Selector** | `["textarea", "[data-testid="grok-input"]", ".chat-input textarea"]` |
| **Submit Method** | `enter` |
| **Response Container** | `["[data-testid="grok-response"]", ".message-content", ".assistant-message"]` |
| **Primary Detection** | `button_disappearance` — Stop button disappears |
| **Fallback Detection** | `text_stability` — Stable for 5s |
| **Last Resort** | `dom_marker` — Thinking/Reasoning badge disappears |
| **Auth Type** | `oauth` — X (Twitter) account required |
| **Login Selectors** | X OAuth flow — redirects to x.com/i/flow/login |
| **Anti-bot** | X's bot detection, Cloudflare |
| **Special Notes** | • Requires X Premium+ subscription for best access<br>• "Think" mode and "Big Brain" mode are toggles<br>• Image generation via Aurora<br>• Real-time X data access |
| **Rate Limit** | ~25 requests/2 hours for Premium+, less for free |

---

## 4. Session & Credential Management

### 4.1 Authentication Flow

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

### 4.2 Credential Vault

```typescript
interface CredentialVault {
  // Encryption
  encryption: {
    algorithm: "AES-256-GCM";
    keyDerivation: "PBKDF2" | "Argon2id";
    masterKeyEnv: "WEBUI_GATEWAY_MASTER_KEY";
  };

  // Storage structure
  storage: {
    path: "./data/credentials.enc";
    format: "encrypted_json";
    backupCount: 3;
  };

  // Per-provider entry
  entry: {
    providerId: string;
    authType: string;
    // For cookie-based sessions
    storageState: string;      // Playwright storageState JSON
    cookies: Cookie[];
    localStorage: Record<string, string>;
    // For OAuth
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    // Metadata
    createdAt: number;
    lastUsedAt: number;
    lastValidatedAt: number;
    isValid: boolean;
    failureCount: number;
  };
}
```

### 4.3 Session Persistence Strategy

1. **Persistent Browser Contexts**: Each provider gets an isolated `user-data-dir`
   ```bash
   ./data/profiles/
   ├── chatgpt/
   │   ├── Default/
   │   ├── Cookies
   │   └── Local State
   ├── claude/
   ├── gemini/
   └── ...
   ```

2. **Storage State Export/Import**: Playwright's `context.storageState()` saved after successful login

3. **Health Check Cron**: Every 15 minutes, validate sessions by checking login state via quick DOM probe

4. **Auto-refresh**: For OAuth tokens, automatic refresh before expiry

5. **Graceful Degradation**: If session invalid, queue request and notify user via dashboard + notification channel (Discord/Slack/email)

### 4.4 Human-in-the-Loop for MFA/CAPTCHA

When automated login fails or CAPTCHA appears:

1. **Detection**: Browser automation detects challenge page (Cloudflare, CAPTCHA, 2FA prompt)
2. **Notification**: Send alert via configured channel (webhook, SMS, push)
3. **VNC Access**: User opens `http://gateway:6080` to view live browser
4. **Resolution**: User solves challenge in real browser
5. **Resume**: Automation detects success and continues

---

## 5. MCP Server Specification

### 5.1 Server Info

```json
{
  "name": "ai-webui-gateway",
  "version": "1.0.0",
  "description": "Access web-based AI providers via browser automation",
  "transport": ["stdio", "sse"]
}
```

### 5.2 Tools

#### `send_prompt`
Send a prompt to a specific provider and return the response.

```json
{
  "name": "send_prompt",
  "description": "Send a prompt to an AI provider via web UI automation",
  "inputSchema": {
    "type": "object",
    "properties": {
      "provider": {
        "type": "string",
        "enum": ["chatgpt", "claude", "gemini", "kimi", "deepseek", "qwen", "glm", "grok"],
        "description": "Target AI provider"
      },
      "prompt": {
        "type": "string",
        "description": "The prompt text to send"
      },
      "model": {
        "type": "string",
        "description": "Optional model variant (e.g., 'gpt-4o', 'claude-3-5-sonnet')"
      },
      "conversationId": {
        "type": "string",
        "description": "Optional conversation ID for continuity"
      },
      "timeout": {
        "type": "number",
        "default": 120000,
        "description": "Max wait time in ms"
      }
    },
    "required": ["provider", "prompt"]
  }
}
```

**Returns:**
```json
{
  "content": [{"type": "text", "text": "The AI response text..."}],
  "metadata": {
    "provider": "chatgpt",
    "model": "gpt-4o",
    "durationMs": 8500,
    "completionStrategy": "copy_button",
    "conversationId": "conv_abc123"
  }
}
```

#### `get_provider_status`
Check the health and availability of a provider.

```json
{
  "name": "get_provider_status",
  "description": "Get current status of a provider session",
  "inputSchema": {
    "type": "object",
    "properties": {
      "provider": {
        "type": "string",
        "enum": ["chatgpt", "claude", "gemini", "kimi", "deepseek", "qwen", "glm", "grok"]
      }
    },
    "required": ["provider"]
  }
}
```

**Returns:**
```json
{
  "content": [{"type": "text", "text": "Provider status report"}],
  "metadata": {
    "provider": "chatgpt",
    "status": "ready",        // ready | authenticating | rate_limited | error | disabled
    "sessionValid": true,
    "lastUsedAt": "2026-09-08T01:30:00Z",
    "requestsRemaining": 25,
    "queueDepth": 0,
    "antiBotScore": 0.15,     // 0-1, lower is better
    "vncUrl": "http://localhost:6080"
  }
}
```

#### `list_providers`
List all available providers and their configurations.

#### `setup_provider`
Initiate authentication setup for a provider (launches VNC session).

```json
{
  "name": "setup_provider",
  "description": "Start authentication setup for a provider via VNC",
  "inputSchema": {
    "type": "object",
    "properties": {
      "provider": { "type": "string" },
      "authMethod": { "type": "string", "enum": ["email", "oauth", "qr", "phone"] }
    },
    "required": ["provider"]
  }
}
```

**Returns:** VNC URL for manual login.

#### `clear_conversation`
Start a new conversation thread on the provider.

#### `upload_file`
Upload a file to the provider (if supported).

### 5.3 Resources

- `providers://list` — JSON list of all providers
- `providers://{id}/config` — Provider adapter configuration
- `providers://{id}/status` — Real-time status
- `session://{provider}/history` — Recent conversation history

### 5.4 Prompts

- `provider-selection` — Help user choose the right provider
- `troubleshooting` — Guide for fixing common issues

---

## 6. REST API Specification

### 6.1 OpenAI-Compatible Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/chat/completions` | POST | Main chat completion endpoint |
| `/v1/models` | GET | List available models (mapped from providers) |
| `/v1/images/generations` | POST | Image generation (DALL-E, etc.) |
| `/health` | GET | Gateway health check |
| `/providers` | GET | List all providers and status |
| `/providers/{id}/status` | GET | Specific provider status |
| `/providers/{id}/setup` | POST | Initiate setup flow |
| `/providers/{id}/session` | DELETE | Clear session/logout |

### 6.2 Chat Completions Request

```json
POST /v1/chat/completions
Content-Type: application/json
Authorization: Bearer {gateway-api-key}

{
  "model": "chatgpt-gpt-4o",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Explain quantum computing"}
  ],
  "stream": false,
  "temperature": 0.7,
  "max_tokens": 2000
}
```

**Model naming convention:** `{provider}-{model-id}` (e.g., `chatgpt-gpt-4o`, `claude-claude-3-5-sonnet`, `gemini-gemini-1-5-pro`)

### 6.3 Chat Completions Response

```json
{
  "id": "chatcmpl-webui-abc123",
  "object": "chat.completion",
  "created": 1725753600,
  "model": "chatgpt-gpt-4o",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Quantum computing is a form of computation that harnesses..."
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 150,
    "total_tokens": 165
  },
  "webui_metadata": {
    "provider": "chatgpt",
    "detection_strategy": "copy_button",
    "duration_ms": 8200,
    "browser_session": "sess_xyz789"
  }
}
```

### 6.4 Streaming Support (SSE)

For `stream: true`, emit SSE events mimicking OpenAI's format:

```
data: {"id":"...","object":"chat.completion.chunk","choices":[{"delta":{"role":"assistant"}}]}

data: {"id":"...","object":"chat.completion.chunk","choices":[{"delta":{"content":"Quantum"}}]}

data: {"id":"...","object":"chat.completion.chunk","choices":[{"delta":{"content":" computing"}}]}

data: [DONE]
```

**Implementation:** Since web UIs stream token-by-token into DOM, use a MutationObserver to detect text changes and emit SSE chunks in real-time.

---

## 7. Anti-Bot & Stealth Strategy

### 7.1 Detection Vectors & Mitigations

| Vector | Detection Method | Mitigation |
|--------|-----------------|------------|
| `navigator.webdriver` | JS property check | Patchright sets to `false` |
| CDP protocol leak | Runtime object inspection | Patchright patches CDP exposure |
| Canvas fingerprint | `toDataURL()` consistency | Random noise injection |
| WebGL renderer | `getParameter()` | Spoof real GPU string |
| Plugins length | `navigator.plugins.length` | Inject fake plugin list |
| User-Agent | Header + JS consistency | Match UA to browser version |
| Viewport | Fixed dimensions | Randomize ±20px per launch |
| Mouse movement | Instant/pixel-perfect paths | Bézier curves with random delays |
| Typing pattern | Uniform inter-key delay | Gaussian jitter + occasional pauses |
| TLS fingerprint | JA3/JA4 hash | Use real Chrome binary (not Playwright's) |

### 7.2 Browser Launch Configuration

```javascript
const launchOptions = {
  headless: false,           // MUST be false for Cloudflare
  executablePath: "/usr/bin/google-chrome-stable", // Real Chrome, not bundled
  args: [
    `--disable-blink-features=AutomationControlled`,
    `--disable-web-security`,
    `--disable-features=IsolateOrigins,site-per-process`,
    `--disable-site-isolation-trials`,
    `--window-size=${1280 + jitterX},${720 + jitterY}`,
    `--user-data-dir=./data/profiles/${providerId}`,
    `--no-first-run`,
    `--no-default-browser-check`,
    `--disable-default-apps`,
    `--disable-extensions-except=${essentialExtensions}`,
    `--disable-background-timer-throttling`,
    `--disable-backgrounding-occluded-windows`,
    `--disable-renderer-backgrounding`,
  ],
  env: {
    // Hide Playwright-specific env vars
    PW_TEST_SCREENSHOT_NO_FONTS_READY: undefined,
    PLAYWRIGHT_BROWSERS_PATH: undefined,
  }
};
```

### 7.3 Human Simulation Details

**Text Input:**
- Use clipboard paste for long text (faster, more human)
- For short text, type with variable delay: `delay = baseDelay + random(-30%, +50%)`
- Occasional "thinking pause": 200-800ms mid-sentence
- Never type at exactly 50 WPM — vary between 40-80 WPM

**Mouse Movement:**
- Move to input field via Bézier curve (not straight line)
- 5-15 intermediate points
- Variable speed: fast for long distances, slow near target
- "Overshoot" slightly and correct (human imprecision)
- Random idle drift during "thinking" periods

**Timing:**
- Random viewport jitter on launch
- Scroll page before interacting (humans read first)
- Wait for images to load (real users don't interact with blank pages)

### 7.4 CAPTCHA Handling

| CAPTCHA Type | Strategy |
|-------------|----------|
| Cloudflare Turnstile | Xvfb + VNC — human solves via browser |
| reCAPTCHA v2 | VNC + notification to user |
| reCAPTCHA v3 (invisible) | Stealth patches + real behavior |
| hCaptcha | VNC + notification |
| Chinese slider | VNC + notification |
| SMS/Email code | Automated IMAP/SMS gateway OR manual VNC entry |

---

## 8. Deployment & Operations

### 8.1 Docker Compose Stack

```yaml
version: '3.8'
services:
  gateway:
    build: .
    ports:
      - "8000:8000"    # REST API
      - "3000:3000"    # MCP SSE
      - "6080:6080"    # noVNC web viewer
    environment:
      - WEBUI_GATEWAY_MASTER_KEY=${MASTER_KEY}
      - NODE_ENV=production
    volumes:
      - ./data:/app/data        # Persistent profiles & credentials
      - /dev/shm:/dev/shm       # Shared memory for Chrome
    depends_on:
      - redis
    deploy:
      resources:
        limits:
          memory: 4G
    cap_add:
      - SYS_ADMIN              # Required for Chrome sandbox

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes

  # Optional: Notification service
  notify:
    image: containrrr/shoutrrr
    environment:
      - SHOUTRRR_URL=discord://token@id

volumes:
  redis-data:
```

### 8.2 Resource Requirements

| Component | CPU | RAM | Storage | Notes |
|-----------|-----|-----|---------|-------|
| Gateway API | 0.5 cores | 256MB | 1GB | Lightweight Node.js/FastAPI |
| Per Browser | 1 core | 1-2GB | 500MB | Chrome is heavy |
| 8 Providers | 8 cores | 8-16GB | 4GB | Concurrent operation |
| Xvfb | 0.1 core | 50MB | 0 | Minimal overhead |
| Redis | 0.25 cores | 256MB | 1GB | Queue & session cache |

**Recommended:** 8-core, 16GB RAM minimum for all 8 providers concurrently.

### 8.3 Monitoring & Observability

| Metric | Source | Alert Threshold |
|--------|--------|----------------|
| Provider response time | Gateway logs | >30s |
| Session validity | Health checks | `isValid === false` |
| Anti-bot score | Browser telemetry | >0.7 |
| Queue depth | Redis | >10 pending |
| Rate limit hits | Provider responses | >3/hour |
| Browser crash count | Process monitor | >2/hour |
| VNC connection count | noVNC logs | Unexpected spikes |

### 8.4 Log Structure

```json
{
  "timestamp": "2026-09-08T01:30:00Z",
  "level": "info",
  "provider": "chatgpt",
  "event": "prompt_completed",
  "duration_ms": 8200,
  "detection_strategy": "copy_button",
  "prompt_length": 150,
  "response_length": 1200,
  "session_id": "sess_xyz789",
  "anti_bot_score": 0.12,
  "retry_count": 0
}
```

---

## 9. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Project scaffolding (TypeScript/Node.js + FastAPI hybrid or pure Python)
- [ ] Docker Compose setup with Xvfb + VNC + noVNC
- [ ] Browser manager with Patchright integration
- [ ] Basic stealth patch application
- [ ] Credential vault with AES-256 encryption

### Phase 2: Core Adapters (Week 3-4)
- [ ] ChatGPT adapter (most documented, reference implementation)
- [ ] Claude adapter
- [ ] Gemini adapter
- [ ] 3-tier completion detection system
- [ ] Selector fallback chain system
- [ ] Session persistence (storageState)

### Phase 3: MCP Server (Week 5)
- [ ] MCP SDK integration
- [ ] `send_prompt` tool
- [ ] `get_provider_status` tool
- [ ] `setup_provider` tool
- [ ] Resource endpoints
- [ ] stdio + SSE transport support

### Phase 4: REST API (Week 6)
- [ ] OpenAI-compatible `/v1/chat/completions`
- [ ] `/v1/models` endpoint
- [ ] Streaming SSE support
- [ ] Image generation endpoint
- [ ] API key authentication

### Phase 5: Additional Providers (Week 7-8)
- [ ] Kimi adapter (with WebBridge CDP option)
- [ ] DeepSeek adapter (QR code handling)
- [ ] Qwen adapter
- [ ] GLM adapter
- [ ] Grok adapter (X OAuth)

### Phase 6: Production Hardening (Week 9-10)
- [ ] Queue management with Redis
- [ ] Rate limiting per provider
- [ ] Auto-retry with exponential backoff
- [ ] Health check automation
- [ ] Notification system (Discord/Slack)
- [ ] Dashboard UI
- [ ] Comprehensive logging
- [ ] Documentation & examples

---

## 10. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| DOM changes break selectors | High | High | Selector fallback chains + auto-detection + community updates |
| Anti-bot detection blocks access | Medium | High | Stealth patches + Xvfb + human simulation + VNC fallback |
| Provider ToS violation | Medium | Medium | Educational use only, no commercial resale, respect rate limits |
| Session expiry requires frequent re-auth | Medium | Medium | Persistent contexts + health checks + notification system |
| Browser crashes / memory leaks | Medium | Medium | Process monitoring + auto-restart + resource limits |
| Concurrent request serialization | High | Medium | Queue system + clear documentation of single-session limitation |
| CAPTCHA / 2FA blocks automation | Medium | High | Human-in-the-loop via VNC + notification channels |

---

## 11. Appendix: Selector Research Notes

### ChatGPT DOM Structure (as of 2026-09)
```html
<!-- Input -->
<div id="prompt-textarea" contenteditable="true" data-testid="prompt-textarea">
  <p>User message here</p>
</div>

<!-- Stop button (visible during generation) -->
<button aria-label="Stop generating" data-testid="stop-button">

<!-- Copy button (appears after completion) -->
<button aria-label="Copy" data-testid="copy-button">

<!-- Assistant message -->
<div data-message-author-role="assistant" data-testid="conversation-turn-3">
  <div class="markdown prose">
    <!-- Response text -->
  </div>
</div>
```

### Claude DOM Structure
```html
<!-- Input -->
<div class="ProseMirror" contenteditable="true" role="textbox">
  <p>User message</p>
</div>

<!-- Send button -->
<button aria-label="Send message">

<!-- Stop button -->
<button aria-label="Stop">
  <svg>...</svg>
</button>

<!-- Assistant message -->
<div data-testid="chat-message" data-message-role="assistant">
  <div class="font-claude-message">
    <!-- Response text -->
  </div>
</div>
```

---

## 12. References

- CatGPT-Gateway: Reverse-engineered ChatGPT UI automation — [dev.to article](https://dev.to/gautamvhavle/i-reverse-engineered-chatgpts-ui-into-an-openai-compatible-api-and-heres-why-you-shouldnt-ch)
- Playwright MCP Server (Microsoft) — [Official](https://github.com/microsoft/playwright-mcp)
- Kimi WebBridge — Browser extension for CDP automation
- Patchright — Stealth Playwright fork for anti-bot
- MCP Specification — [modelcontextprotocol.io](https://modelcontextprotocol.io)

---

*This specification is a living document. Provider DOM structures change frequently; adapters must be updated reactively.*
