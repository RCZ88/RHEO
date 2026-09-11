// ============================================================================
// AI Gateway — HumanSimulator: human-like input (spec §7.3)
// Variable typing jitter, clipboard paste for long text, realistic delays.
// Operates on `any` page — no playwright import at load time.
// ============================================================================

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export async function humanDelay(baseMs: number): Promise<void> {
  const ms = Math.max(0, baseMs * rand(0.7, 1.5));
  await new Promise((r) => setTimeout(r, ms));
}

/** Find the first selector in the fallback chain that matches a visible element. */
export async function resolveSelector(page: any, selectors: string[]): Promise<string | null> {
  for (const sel of selectors) {
    try {
      const h = await page.evaluate((s: string) => {
        try {
          const el = document.querySelector(s) as HTMLElement | null;
          if (!el) return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        } catch { return false; }
      }, sel);
      if (h) return sel;
    } catch {}
  }
  return null;
}

/**
 * Type text like a human (40–80 WPM with jitter + occasional thinking pause),
 * or paste via clipboard for long text (faster, still human-plausible).
 */
export async function humanType(page: any, selector: string, text: string): Promise<void> {
  try { await page.click(selector, { timeout: 8000 }); } catch {}
  await humanDelay(250);

  if (text.length > 400) {
    // Clipboard paste path for long prompts.
    try {
      await page.evaluate((t: string) => {
        try {
          const ae = document.activeElement as HTMLElement | null;
          if (ae && (ae as any).isContentEditable) {
            document.execCommand('selectAll', false);
            document.execCommand('insertText', false, t);
          }
        } catch {}
      }, text);
      // Verify; fall back to fill() if nothing landed.
      const ok = await page.evaluate((s: string, n: number) => {
        try {
          const el = document.querySelector(s) as HTMLElement | null;
          const t = (el?.innerText || (el as any)?.value || '').length;
          return t >= Math.min(n, 50);
        } catch { return false; }
      }, selector, text.length);
      if (ok) { await humanDelay(400); return; }
    } catch {}
    try { await page.fill(selector, text, { timeout: 10000 }); return; } catch {}
  }

  // Keystroke path with jitter.
  try {
    await page.evaluate((s: string) => {
      try {
        const el = document.querySelector(s) as HTMLElement | null;
        if (el && (el as any).isContentEditable) document.execCommand('selectAll', false);
        else if (el && (el as HTMLInputElement).select) (el as HTMLInputElement).select();
      } catch {}
    }, selector);
    const base = rand(28, 62); // ms per key ≈ 40–80 WPM
    await page.type(selector, text, { delay: base });
    // Occasional mid-sentence thinking pause.
    if (text.length > 120 && Math.random() < 0.6) await humanDelay(rand(200, 800));
  } catch {
    await page.fill(selector, text, { timeout: 15000 });
  }
  await humanDelay(250);
}

/** Submit via Enter key, button click, or both (per adapter config). */
export async function humanSubmit(
  page: any,
  method: 'enter' | 'button' | 'both',
  buttonSelectors?: string[],
  preSubmitDelay = 300,
): Promise<void> {
  await humanDelay(preSubmitDelay);
  if (method === 'enter' || method === 'both') {
    try { await page.keyboard.press('Enter'); } catch {}
    if (method === 'enter') return;
    await humanDelay(400);
  }
  if ((method === 'button' || method === 'both') && buttonSelectors) {
    const btn = await resolveSelector(page, buttonSelectors);
    if (btn) {
      try { await page.click(btn, { timeout: 5000 }); } catch {}
    }
  }
}

/** Randomize viewport ±20px per launch (spec §7.1). */
export function jitteredViewport(base: { width: number; height: number }): { width: number; height: number } {
  const j = () => Math.round(rand(-20, 20));
  return { width: base.width + j(), height: base.height + j() };
}
