import { isDynamicImportFailure, autoHealDynamicImport } from '../../ErrorBoundary';

/**
 * Shared Mermaid loader for MermaidBlock and FlowBlock.
 *
 * Why a singleton: mermaid 11.x counts initialize() calls internally and
 * re-initializing with an identical config before every render makes
 * m.render() hang forever (spinner stuck, no error, no console output).
 * We initialize exactly ONCE per app session, then only call m.render().
 */

let mermaidPromise: Promise<any> | null = null;

export function loadMermaid(): Promise<any> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid')
      .then((mermaidMod) => {
        const m = mermaidMod.default || mermaidMod;
        m.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'loose',
          flowchart: { useMaxWidth: false, htmlLabels: true },
          sequence: { useMaxWidth: false },
          logLevel: 'error',
        });
        return m;
      })
      .catch((err: unknown) => {
        mermaidPromise = null;
        if (isDynamicImportFailure(err)) {
          autoHealDynamicImport();
        }
        throw err;
      });
  }
  return mermaidPromise;
}

const RENDER_TIMEOUT_MS = 15000;

export function renderMermaidWithTimeout(m: any, diagramId: string, src: string, timeoutMs: number = RENDER_TIMEOUT_MS): Promise<{ svg: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Mermaid took too long to render this diagram (its syntax may hang this Mermaid version)'));
    }, timeoutMs);
    m.render(diagramId, src).then(
      (result: { svg: string }) => { clearTimeout(timer); resolve(result); },
      (err: unknown) => { clearTimeout(timer); reject(err); },
    );
  });
}
