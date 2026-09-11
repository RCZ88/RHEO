// ============================================================================
// AI Gateway — BrowserManager: stealth browser lifecycle (spec §7)
// - playwright is LAZY-required inside methods: module load never fails when
//   playwright/browsers are missing; availability() reports it instead.
// - One persistent context per provider under <dataDir>/profiles/<id>.
// - Real Chrome (channel) preferred, bundled Chromium fallback.
// - Desktop app: headful window (visible for manual login); headless fallback
//   when no display. Xvfb/VNC server deployment is out of scope for desktop.
// ============================================================================
import * as fs from 'fs';
import * as path from 'path';
import type { ProviderAdapter } from './types';
import { jitteredViewport } from './HumanSimulator';

export interface ManagedSession {
  providerId: string;
  running: boolean;
  lastLaunchedAt: number;
}

interface LiveContext {
  browser: any;
  context: any;
  page: any;
  providerId: string;
}

export class BrowserManager {
  private dataDir: string;
  private live = new Map<string, LiveContext>();
  private playwrightMod: any = null;
  private playwrightTried = false;
  private playwrightError: string | null = null;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    try { fs.mkdirSync(path.join(dataDir, 'profiles'), { recursive: true }); } catch {}
  }

  /** Is the playwright npm package importable? (Browsers checked at launch.) */
  availability(): { available: boolean; error: string | null } {
    this.tryLoadPlaywright();
    return { available: !!this.playwrightMod, error: this.playwrightError };
  }

  private tryLoadPlaywright(): any {
    if (this.playwrightTried) return this.playwrightMod;
    this.playwrightTried = true;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this.playwrightMod = require('playwright');
    } catch (e: any) {
      this.playwrightMod = null;
      this.playwrightError = e?.message || 'playwright not installed';
    }
    return this.playwrightMod;
  }

  isRunning(providerId: string): boolean {
    return this.live.has(providerId);
  }

  getPage(providerId: string): any | null {
    return this.live.get(providerId)?.page || null;
  }

  profileDir(providerId: string): string {
    return path.join(this.dataDir, 'profiles', providerId);
  }

  /**
   * Launch (or reuse) a persistent-context window for a provider.
   * Restores encrypted storageState into the context when provided.
   */
  async launch(
    adapter: ProviderAdapter,
    opts?: { url?: string; storageState?: string; headless?: boolean },
  ): Promise<{ page: any; reused: boolean }> {
    const pw = this.tryLoadPlaywright();
    if (!pw) throw new Error('Playwright unavailable: ' + (this.playwrightError || 'not installed'));

    const existing = this.live.get(adapter.id);
    if (existing) {
      try {
        if (!existing.page.isClosed()) {
          if (opts?.url) {
            try { await existing.page.goto(opts.url, { waitUntil: 'domcontentloaded', timeout: 30000 }); } catch {}
          }
          return { page: existing.page, reused: true };
        }
      } catch {}
      this.live.delete(adapter.id);
    }

    const vp = jitteredViewport(adapter.antiBot.viewport);
    const noDisplay = process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY;
    const headless = opts?.headless ?? noDisplay;

    const launchOpts: any = {
      headless,
      viewport: vp,
      userAgent: undefined,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
      ],
    };

    let context: any;
    const storageState = opts?.storageState ? safeParseStorageState(opts.storageState) : undefined;
    try {
      // Prefer real Chrome binary (better TLS/JA3 fingerprint, spec §7.1).
      context = await pw.chromium.launchPersistentContext(this.profileDir(adapter.id), {
        ...launchOpts, channel: 'chrome', storageState,
      });
    } catch {
      // Fall back to bundled Chromium.
      context = await pw.chromium.launchPersistentContext(this.profileDir(adapter.id), {
        ...launchOpts, storageState,
      });
    }

    // Stealth patches (Patchright-equivalent basics for stock playwright).
    try {
      await context.addInitScript(() => {
        try {
          Object.defineProperty(navigator, 'webdriver', { get: () => false });
          (window as any).chrome = (window as any).chrome || { runtime: {} };
          const origPlugins = navigator.plugins;
          if (origPlugins.length === 0) {
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] as any });
          }
        } catch {}
      });
    } catch {}

    const page = context.pages()[0] || (await context.newPage());
    try { await page.setViewportSize(vp); } catch {}
    if (opts?.url) {
      try { await page.goto(opts.url, { waitUntil: 'domcontentloaded', timeout: 45000 }); } catch {}
    }

    // Best-effort: hide the Node/playwright env leak via CDP is not available
    // on persistent contexts pre-launch; init script above covers the basics.
    this.live.set(adapter.id, { browser: null, context, page, providerId: adapter.id });
    return { page, reused: false };
  }

  /** Export current storage state for vault persistence. */
  async exportStorageState(providerId: string): Promise<string | null> {
    const live = this.live.get(providerId);
    if (!live) return null;
    try {
      const state = await live.context.storageState();
      return JSON.stringify(state);
    } catch { return null; }
  }

  async close(providerId: string): Promise<void> {
    const live = this.live.get(providerId);
    if (!live) return;
    this.live.delete(providerId);
    try { await live.context.close(); } catch {}
  }

  async shutdown(): Promise<void> {
    const ids = [...this.live.keys()];
    for (const id of ids) {
      try { await this.close(id); } catch {}
    }
  }
}

function safeParseStorageState(json: string): any | undefined {
  try {
    const v = JSON.parse(json);
    if (v && (v.cookies || v.origins)) return v;
    return undefined;
  } catch { return undefined; }
}
