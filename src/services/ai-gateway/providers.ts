// ============================================================================
// AI Gateway — per-provider adapter configs (DATA ONLY, no browser imports)
// Selector fallback chains per spec §3; DOM structures change often — update here.
// ============================================================================
import type { ProviderAdapter } from './types';

const TEXT_STABLE_4S = { type: 'text_stability', stableDurationMs: 4000 } as const;
const TEXT_STABLE_5S = { type: 'text_stability', stableDurationMs: 5000 } as const;

export const PROVIDER_ADAPTERS: ProviderAdapter[] = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    url: 'https://chatgpt.com',
    newChatUrl: 'https://chatgpt.com/',
    loginUrl: 'https://auth.openai.com/log-in',
    input: {
      selector: ['#prompt-textarea', '[data-testid="prompt-textarea"]', 'textarea[placeholder*="Message"]', '[contenteditable="true"]'],
      submitMethod: 'enter',
      preSubmitDelay: 300,
      clearInput: true,
    },
    response: {
      containerSelector: ['[data-testid="conversation-turn-3"] .markdown', '.text-message', '[data-message-author-role="assistant"]'],
      textExtractor: '.markdown',
      streaming: true,
    },
    completionDetection: {
      primary: { type: 'button_appearance', selector: ['[data-testid="copy-button"]', '[aria-label="Copy"]'], condition: 'exists' },
      fallback: { type: 'button_disappearance', selector: ['[aria-label="Stop generating"]', '[data-testid="stop-button"]'], condition: 'not_exists' },
      lastResort: { ...TEXT_STABLE_5S },
      timeoutMs: 180000,
      pollIntervalMs: 1000,
    },
    auth: { type: 'email', sessionValidityMs: 30 * 24 * 3600 * 1000 },
    antiBot: { cloudflare: true, viewport: { width: 1280, height: 800 } },
    rateLimit: { requestsPerMinute: 20, concurrentRequests: 1, cooldownMs: 3000 },
    dailyBudget: 35,
    notes: 'Heavy bot detection (Cloudflare Turnstile). Headful browser strongly recommended.',
  },
  {
    id: 'claude',
    name: 'Claude',
    url: 'https://claude.ai/new',
    newChatUrl: 'https://claude.ai/new',
    loginUrl: 'https://claude.ai/login',
    input: {
      selector: ['.ProseMirror[contenteditable="true"]', '[contenteditable="true"]', '[data-testid="chat-input"]', 'textarea[placeholder*="Message"]'],
      submitMethod: 'enter',
      preSubmitDelay: 300,
      clearInput: true,
    },
    response: {
      containerSelector: ['[data-testid="chat-message"]', '.font-claude-message', '[data-message-role="assistant"]'],
      textExtractor: '.font-claude-message',
      streaming: true,
    },
    completionDetection: {
      primary: { type: 'button_disappearance', selector: ['[aria-label="Stop"]', '.stop-button'], condition: 'not_exists' },
      fallback: { type: 'button_appearance', selector: ['[aria-label="Copy"]'], condition: 'exists' },
      lastResort: { ...TEXT_STABLE_4S },
      timeoutMs: 180000,
      pollIntervalMs: 1000,
    },
    auth: { type: 'email', sessionValidityMs: 30 * 24 * 3600 * 1000 },
    antiBot: { cloudflare: true, viewport: { width: 1280, height: 800 } },
    rateLimit: { requestsPerMinute: 10, concurrentRequests: 1, cooldownMs: 5000 },
    dailyBudget: 45,
    notes: 'Contenteditable ProseMirror input, not a textarea. Email-code login may need manual entry.',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    url: 'https://gemini.google.com/app',
    newChatUrl: 'https://gemini.google.com/app',
    loginUrl: 'https://accounts.google.com/',
    input: {
      selector: ['rich-textarea', '[data-testid="input-area"]', 'textarea[placeholder*="Ask"]', '[contenteditable="true"]'],
      submitMethod: 'enter',
      preSubmitDelay: 300,
      clearInput: true,
    },
    response: {
      containerSelector: ['.response-content', '[data-testid="response-text"]', '.markdown-content'],
      textExtractor: '.response-content',
      streaming: true,
    },
    completionDetection: {
      primary: { type: 'button_disappearance', selector: ['[aria-label="Stop"]', '.send-button.spinning'], condition: 'not_exists' },
      fallback: { type: 'dom_marker', selector: ['.response-content'], condition: 'exists' },
      lastResort: { ...TEXT_STABLE_5S },
      timeoutMs: 180000,
      pollIntervalMs: 1000,
    },
    auth: { type: 'oauth', sessionValidityMs: 30 * 24 * 3600 * 1000 },
    antiBot: { cloudflare: false, viewport: { width: 1280, height: 800 } },
    rateLimit: { requestsPerMinute: 30, concurrentRequests: 1, cooldownMs: 2000 },
    dailyBudget: 60,
    notes: 'Google OAuth — uses the same session as the Google account. Invisible reCAPTCHA v3.',
  },
  {
    id: 'kimi',
    name: 'Kimi',
    url: 'https://kimi.com',
    newChatUrl: 'https://kimi.com',
    loginUrl: 'https://kimi.com/',
    input: {
      selector: ['textarea', '[data-testid="chat-input"]', '.chat-input textarea'],
      submitMethod: 'enter',
      preSubmitDelay: 250,
      clearInput: true,
    },
    response: {
      containerSelector: ['[data-testid="assistant-message"]', '.message-content', '.markdown-body'],
      textExtractor: '.message-content',
      streaming: true,
    },
    completionDetection: {
      primary: { type: 'button_disappearance', selector: ['.loading-indicator', '[aria-label="Stop"]'], condition: 'not_exists' },
      fallback: { ...TEXT_STABLE_4S },
      lastResort: { type: 'network_idle', stableDurationMs: 3000 },
      timeoutMs: 180000,
      pollIntervalMs: 1000,
    },
    auth: { type: 'email', sessionValidityMs: 30 * 24 * 3600 * 1000 },
    antiBot: { cloudflare: false, viewport: { width: 1280, height: 800 } },
    rateLimit: { requestsPerMinute: 30, concurrentRequests: 1, cooldownMs: 2000 },
    dailyBudget: 100,
    notes: 'Generous free tier, 200K+ context. Moderate bot detection.',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    url: 'https://chat.deepseek.com',
    newChatUrl: 'https://chat.deepseek.com/',
    loginUrl: 'https://chat.deepseek.com/sign_in',
    input: {
      selector: ['textarea', '[data-testid="chat-input"]', '.input-area textarea'],
      submitMethod: 'enter',
      preSubmitDelay: 250,
      clearInput: true,
    },
    response: {
      containerSelector: ['[data-testid="assistant-message"]', '.message-content', '.chat-message-assistant'],
      textExtractor: '.message-content',
      streaming: true,
    },
    completionDetection: {
      primary: { type: 'button_disappearance', selector: ['[aria-label="Stop"]', '.stop-generating'], condition: 'not_exists' },
      fallback: { ...TEXT_STABLE_5S },
      lastResort: { type: 'custom_js', customScript: '!(document.querySelector(".streaming") || document.querySelector("[data-streaming=true]"))' },
      timeoutMs: 240000,
      pollIntervalMs: 1000,
    },
    auth: { type: 'phone', sessionValidityMs: 30 * 24 * 3600 * 1000 },
    antiBot: { cloudflare: false, viewport: { width: 1280, height: 800 } },
    rateLimit: { requestsPerMinute: 15, concurrentRequests: 1, cooldownMs: 4000 },
    dailyBudget: 50,
    notes: 'Often shows "Server is busy" — retry with backoff. QR login via WeChat needs manual scan.',
  },
  {
    id: 'qwen',
    name: 'Qwen',
    url: 'https://chat.qwen.ai',
    newChatUrl: 'https://chat.qwen.ai/',
    loginUrl: 'https://chat.qwen.ai/',
    input: {
      selector: ['textarea', '[data-testid="chat-input"]', '.chat-input'],
      submitMethod: 'enter',
      preSubmitDelay: 250,
      clearInput: true,
    },
    response: {
      containerSelector: ['[data-testid="assistant-message"]', '.message-content', '.answer-content'],
      textExtractor: '.message-content',
      streaming: true,
    },
    completionDetection: {
      primary: { type: 'button_disappearance', selector: ['.send-spinner', '[aria-label="Stop"]'], condition: 'not_exists' },
      fallback: { ...TEXT_STABLE_4S },
      lastResort: { type: 'dom_marker', selector: ['.answer-content'], condition: 'exists' },
      timeoutMs: 180000,
      pollIntervalMs: 1000,
    },
    auth: { type: 'phone', sessionValidityMs: 30 * 24 * 3600 * 1000 },
    antiBot: { cloudflare: false, viewport: { width: 1280, height: 800 } },
    rateLimit: { requestsPerMinute: 30, concurrentRequests: 1, cooldownMs: 2000 },
    dailyBudget: 100,
    notes: 'Alibaba unified login. Slider CAPTCHA may need manual solve.',
  },
  {
    id: 'glm',
    name: 'GLM (Zhipu)',
    url: 'https://chatglm.cn',
    newChatUrl: 'https://chatglm.cn/main',
    loginUrl: 'https://chatglm.cn/',
    input: {
      selector: ['textarea', '[data-testid="chat-input"]', '.input-box textarea'],
      submitMethod: 'enter',
      preSubmitDelay: 250,
      clearInput: true,
    },
    response: {
      containerSelector: ['[data-testid="assistant-message"]', '.message-content', '.chat-answer'],
      textExtractor: '.message-content',
      streaming: true,
    },
    completionDetection: {
      primary: { type: 'button_disappearance', selector: ['[aria-label="Stop"]', '.stop-generating'], condition: 'not_exists' },
      fallback: { ...TEXT_STABLE_4S },
      lastResort: { type: 'network_idle', stableDurationMs: 3000 },
      timeoutMs: 180000,
      pollIntervalMs: 1000,
    },
    auth: { type: 'phone', sessionValidityMs: 30 * 24 * 3600 * 1000 },
    antiBot: { cloudflare: false, viewport: { width: 1280, height: 800 } },
    rateLimit: { requestsPerMinute: 20, concurrentRequests: 1, cooldownMs: 3000 },
    dailyBudget: 60,
    notes: 'Phone + SMS verification (China). AllTools mode available.',
  },
  {
    id: 'grok',
    name: 'Grok',
    url: 'https://grok.com',
    newChatUrl: 'https://grok.com/',
    loginUrl: 'https://x.com/i/flow/login',
    input: {
      selector: ['textarea', '[data-testid="grok-input"]', '.chat-input textarea'],
      submitMethod: 'enter',
      preSubmitDelay: 300,
      clearInput: true,
    },
    response: {
      containerSelector: ['[data-testid="grok-response"]', '.message-content', '.assistant-message'],
      textExtractor: '.message-content',
      streaming: true,
    },
    completionDetection: {
      primary: { type: 'button_disappearance', selector: ['[aria-label="Stop"]'], condition: 'not_exists' },
      fallback: { ...TEXT_STABLE_5S },
      lastResort: { type: 'dom_marker', selector: ['[data-testid="grok-response"]'], condition: 'exists' },
      timeoutMs: 180000,
      pollIntervalMs: 1000,
    },
    auth: { type: 'oauth', sessionValidityMs: 30 * 24 * 3600 * 1000 },
    antiBot: { cloudflare: true, viewport: { width: 1280, height: 800 } },
    rateLimit: { requestsPerMinute: 10, concurrentRequests: 1, cooldownMs: 5000 },
    dailyBudget: 25,
    notes: 'Requires X account (Premium+ for full access). X bot detection + Cloudflare.',
  },
];

export function getAdapter(id: string): ProviderAdapter | undefined {
  return PROVIDER_ADAPTERS.find((a) => a.id === id);
}

export function listAdapterIds(): string[] {
  return PROVIDER_ADAPTERS.map((a) => a.id);
}
