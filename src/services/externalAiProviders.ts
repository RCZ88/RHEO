// External AI provider catalog — the single source of truth for "which AI, and
// where does it live".
//
// Before this, provider URLs were hardcoded per feature: PromptBuilder.tsx
// opened `https://chatgpt.com` regardless of what the user picked, and
// AIBridge.tsx carried its own claude.ai constant. So "open in browser" always
// opened ChatGPT, there was no copy-link, and there was no way to see which AIs
// you are actually signed in to.
//
// `id` values deliberately match `services/ai-gateway/providers.ts` adapter ids
// so the launcher's sign-in state and the vault keys are the same string.

export interface ExternalAiProvider {
  id: string;
  name: string;
  /** New-chat / home URL to open. */
  url: string;
  /** Match patterns so the extension can find the tab after it opens. */
  patterns: string[];
  /** One accent hex per provider, for the tile identity only (not chrome). */
  color: string;
}

export const EXTERNAL_AI_PROVIDERS: ExternalAiProvider[] = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    url: 'https://chatgpt.com/',
    patterns: ['*://chatgpt.com/*', '*://chat.openai.com/*'],
    color: '#10a37f',
  },
  {
    id: 'claude',
    name: 'Claude',
    url: 'https://claude.ai/new',
    patterns: ['*://claude.ai/*'],
    color: '#d97757',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    url: 'https://gemini.google.com/app',
    patterns: ['*://gemini.google.com/*'],
    color: '#4285f4',
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    url: 'https://www.perplexity.ai/',
    patterns: ['*://perplexity.ai/*', '*://www.perplexity.ai/*'],
    color: '#20808d',
  },
  {
    id: 'you',
    name: 'You.com',
    url: 'https://you.com/',
    patterns: ['*://you.com/*'],
    color: '#5b5bd6',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    url: 'https://chat.deepseek.com/',
    patterns: ['*://deepseek.com/*', '*://chat.deepseek.com/*'],
    color: '#4d6bfe',
  },
  {
    id: 'grok',
    name: 'Grok',
    url: 'https://grok.com/',
    patterns: ['*://grok.com/*', '*://x.com/*'],
    color: '#e5e5e5',
  },
  {
    id: 'kimi',
    name: 'Kimi',
    url: 'https://kimi.moonshot.cn/',
    patterns: ['*://kimi.moonshot.cn/*'],
    color: '#6b46ff',
  },
  {
    id: 'qwen',
    name: 'Qwen',
    url: 'https://chat.qwen.ai/',
    patterns: ['*://chat.qwen.ai/*'],
    color: '#6f42c1',
  },
  {
    id: 'glm',
    name: 'GLM',
    url: 'https://chatglm.cn/',
    patterns: ['*://chatglm.cn/*'],
    color: '#3859ff',
  },
];

export const PROVIDER_BY_ID: Record<string, ExternalAiProvider> =
  Object.fromEntries(EXTERNAL_AI_PROVIDERS.map((p) => [p.id, p]));

export function getProvider(id: string | null | undefined): ExternalAiProvider | null {
  if (!id) return null;
  return PROVIDER_BY_ID[id] || null;
}

/**
 * Open a URL in the user's real browser. Routed through the main process
 * because `window.open` from the renderer opens an Electron window, not their
 * browser — which is exactly the bug that made "open in browser" useless.
 */
export async function openInBrowser(url: string): Promise<boolean> {
  try {
    const api = (window as any).deskflowAPI;
    if (typeof api?.openExternalUrl === 'function') {
      const r = await api.openExternalUrl(url);
      return !!r?.ok;
    }
  } catch {
    /* fall through to the window fallback */
  }
  try {
    window.open(url, '_blank', 'noopener');
    return true;
  } catch {
    return false;
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}