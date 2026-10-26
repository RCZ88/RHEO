let visible = false;
const listeners = new Set<(v: boolean) => void>();

export function isDictationVisible() { return visible; }
export function showDictation() { if (!visible) { visible = true; listeners.forEach(fn => fn(true)); } }
export function hideDictation() { if (visible) { visible = false; listeners.forEach(fn => fn(false)); } }
export function toggleDictation() { visible = !visible; listeners.forEach(fn => fn(visible)); }
export function subscribeDictation(fn: (v: boolean) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
