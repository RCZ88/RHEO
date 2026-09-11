import confetti from 'canvas-confetti';

const FOCUS_PALETTE = ['#ec4899', '#34d399', '#f472b6', '#a7f3d0'];

export function celebrateFocusCompletion(originEl?: HTMLElement | null) {
  if (typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  let origin = { x: 0.5, y: 0.4 };
  if (originEl) {
    const rect = originEl.getBoundingClientRect();
    origin = {
      x: (rect.left + rect.width / 2) / window.innerWidth,
      y: (rect.top + rect.height / 2) / window.innerHeight,
    };
  }

  confetti({
    particleCount: 70,
    spread: 70,
    startVelocity: 32,
    gravity: 1,
    scalar: 0.9,
    ticks: 220,
    colors: FOCUS_PALETTE,
    origin,
  });
}

const SEEN_KEY = 'deskflow.focus.seenCompletions.v1';

function loadSeen(): number[] {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch { return []; }
}

export function hasSeenCompletion(sessionId: number): boolean {
  return loadSeen().includes(sessionId);
}

export function markCompletionSeen(sessionId: number): void {
  const seen = loadSeen();
  if (!seen.includes(sessionId)) {
    seen.push(sessionId);
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen.slice(-200)));
  }
}
