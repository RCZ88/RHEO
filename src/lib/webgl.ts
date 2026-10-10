/**
 * WebGL capability probe.
 *
 * `<Canvas>` / `new WebGLRenderer()` throws "Error creating WebGL context"
 * inside a commit-phase effect when the machine has no usable GPU (VMs,
 * remote desktops, `--disable-gpu`, blocklisted drivers). An error boundary
 * can recover from that, but the throw still happens on every mount: it spams
 * the console and forces React to unwind the tree before re-rendering.
 *
 * Probe once, synchronously, and never mount a Canvas we cannot have. Callers
 * should render a static fallback instead.
 *
 * Cached: the answer cannot change within a page session.
 */
let cached: boolean | null = null;

export function webglSupported(): boolean {
  if (cached !== null) return cached;
  if (typeof document === 'undefined') return (cached = false);

  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');

    cached = !!gl;

    // Release the probe context immediately — browsers cap concurrent contexts
    // (often ~16) and a leaked one starves the real scene.
    if (gl) {
      const lose = (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context');
      lose?.loseContext();
    }
  } catch {
    // Some environments throw rather than returning null.
    cached = false;
  }

  return cached;
}

/** Reset the cache. Test-only. */
export function __resetWebglProbe() {
  cached = null;
}