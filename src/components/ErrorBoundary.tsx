import { Component } from 'react';

const ERROR_COUNT_KEY = 'deskflow-error-count';
const ERROR_MSG_KEY = 'deskflow-error-message';
const MAX_RELOADS = 2;

let globalErrorCallback: ((error: Error) => void) | null = null;
let pendingGlobalErrors: Error[] = [];

export function triggerGlobalError(error: Error) {
  if (globalErrorCallback) {
    globalErrorCallback(error);
  } else {
    pendingGlobalErrors.push(error);
  }
}

const DYNAMIC_IMPORT_PATTERN = /Failed to fetch dynamically imported module|Importing a module script failed|failed to fetch.*dynamically.*module/i;

export function isDynamicImportFailure(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '');
  return DYNAMIC_IMPORT_PATTERN.test(msg);
}

let lastAutoReloadAt = 0;
export function autoHealDynamicImport(): void {
  const now = Date.now();
  if (now - lastAutoReloadAt < 8000) return;
  lastAutoReloadAt = now;
  clearPersistedError();
  console.warn('[SelfHeal] Dynamic import failed (stale bundle after rebuild) — reloading to pick up fresh chunks.');
  window.location.reload();
}

function getPersistedErrorCount(): number {
  try {
    return parseInt(localStorage.getItem(ERROR_COUNT_KEY) || '0', 10);
  } catch {
    return 0;
  }
}

function getPersistedErrorMessage(): string {
  try {
    return localStorage.getItem(ERROR_MSG_KEY) || '';
  } catch {
    return '';
  }
}

function persistError(error: Error) {
  try {
    const msg = error.message || '';
    const prevMsg = getPersistedErrorMessage();
    const count = msg === prevMsg ? getPersistedErrorCount() + 1 : 1;
    localStorage.setItem(ERROR_COUNT_KEY, count.toString());
    localStorage.setItem(ERROR_MSG_KEY, msg);
  } catch {
    // localStorage unavailable
  }
}

function clearPersistedError() {
  try {
    localStorage.removeItem(ERROR_COUNT_KEY);
    localStorage.removeItem(ERROR_MSG_KEY);
  } catch {
    // localStorage unavailable
  }
}

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  showAlternative: boolean;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, showAlternative: getPersistedErrorCount() >= MAX_RELOADS, copied: false };
  }

  static getDerivedStateFromError(error: Error): State {
    persistError(error);
    const showAlternative = getPersistedErrorCount() >= MAX_RELOADS;
    return { hasError: true, error, showAlternative };
  }

  componentDidMount() {
    globalErrorCallback = (error: Error) => {
      this.setState({ hasError: true, error, showAlternative: getPersistedErrorCount() >= MAX_RELOADS });
    };
    if (pendingGlobalErrors.length > 0) {
      const err = pendingGlobalErrors[pendingGlobalErrors.length - 1];
      pendingGlobalErrors = [];
      this.setState({ hasError: true, error: err, showAlternative: getPersistedErrorCount() >= MAX_RELOADS });
    }
  }

  componentWillUnmount() {
    globalErrorCallback = null;
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    if (isDynamicImportFailure(error)) {
      autoHealDynamicImport();
    }
  }

  handleCopyError = () => {
    const { error } = this.state;
    if (!error) return;
    const text = `${error.message}\n\n${error.stack || ''}`;
    navigator.clipboard.writeText(text).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  handleReload = () => {
    clearPersistedError();
    window.location.reload();
  };

  navigateTo = (path: string) => {
    clearPersistedError();
    window.location.hash = `#${path}`;
    this.setState({ hasError: false, error: null, showAlternative: false });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error, showAlternative, copied } = this.state;
    const reloadCount = getPersistedErrorCount();
    
    // Check if this is an IPC/500 error
    const isIpcError = error?.message?.toLowerCase().includes('500') || 
                       error?.message?.toLowerCase().includes('internal server error') ||
                       error?.message?.toLowerCase().includes('ipc') ||
                       error?.message?.toLowerCase().includes('invoke');

    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0a0a0a] text-white p-8 overflow-auto light:bg-[var(--ws-surface)] light:text-stone-900">
        <div className="max-w-md text-center">
          <div className="text-red-400 text-6xl mb-6">!</div>
          <h1 className="text-2xl font-bold mb-4 light:text-stone-900">
            {isIpcError ? 'Server Error' : 'Something went wrong'}
          </h1>

          {isIpcError && (
            <div className="bg-red-900/40 border border-red-700/50 rounded-lg p-4 mb-6 text-sm text-red-200">
              The application encountered a server error (500). 
              This usually means the Electron backend is temporarily unavailable. 
              Click "Reload Page" to refresh the interface.
            </div>
          )}

          {showAlternative && (
              <div className="bg-amber-900/40 border border-amber-700/50 rounded-lg p-4 mb-6 text-sm text-amber-200 light:bg-amber-50 light:text-amber-900 light:border-amber-200">
                The app has crashed {reloadCount} times in a row. Try navigating to a different page instead of reloading.
              </div>
            )}

          <div className="bg-zinc-900 rounded-lg p-4 mb-6 text-left relative light:bg-white light:border-[var(--ws-border-strong)]">
            <button
              onClick={this.handleCopyError}
              className="absolute top-2 right-2 text-xs text-zinc-500 light:text-stone-500 hover:text-zinc-300 light:text-stone-700 transition-colors px-2 py-1 rounded hover:bg-zinc-800 light:hover:bg-stone-100"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <p className="text-sm font-mono text-red-300 break-all pr-12">
              {error?.message || 'Unknown error'}
            </p>
            {error?.stack && (
              <details className="mt-2">
                <summary className="text-xs text-zinc-500 light:text-stone-500 cursor-pointer hover:text-zinc-300 light:text-stone-700">Stack trace</summary>
                <pre className="text-xs text-zinc-400 light:text-stone-500 mt-2 overflow-auto max-h-60 font-mono">
                  {error.stack}
                </pre>
              </details>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={this.handleReload}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
            >
              Reload App
            </button>

            <div className="flex flex-wrap justify-center gap-2">
              <button
                onClick={() => this.navigateTo('/')}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-sm light:bg-white light:text-stone-900 light:hover:bg-stone-100 light:border-[var(--ws-border)]"
              >
                Dashboard
              </button>
              <button
                onClick={() => this.navigateTo('/activity')}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-sm light:bg-white light:text-stone-900 light:hover:bg-stone-100 light:border-[var(--ws-border)]"
              >
                Activity
              </button>
              <button
                onClick={() => this.navigateTo('/terminal')}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-sm light:bg-white light:text-stone-900 light:hover:bg-stone-100 light:border-[var(--ws-border)]"
              >
                Terminal
              </button>
              <button
                onClick={() => this.navigateTo('/ide')}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-sm light:bg-white light:text-stone-900 light:hover:bg-stone-100 light:border-[var(--ws-border)]"
              >
                IDE
              </button>
              <button
                onClick={() => this.navigateTo('/settings')}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-sm light:bg-white light:text-stone-900 light:hover:bg-stone-100 light:border-[var(--ws-border)]"
              >
                Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
