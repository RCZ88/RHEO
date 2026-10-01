import { Component } from 'react';
import { RefreshCw } from 'lucide-react';
import { StatusScreen, STATUS_DESTINATIONS } from './StatusScreen';

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
    const msg = (error?.message || '').toLowerCase();
    const isIpcError =
      msg.includes('500') ||
      msg.includes('internal server error') ||
      msg.includes('ipc') ||
      msg.includes('invoke');

    let description: string;
    if (isIpcError) {
      description =
        'RHEO could not reach its backend process. The window is still open, so reloading usually reconnects it.';
    } else if (showAlternative) {
      description =
        `This screen has failed ${reloadCount} times in a row. Reloading may not help — open a different page below instead.`;
    } else {
      description =
        'This screen stopped responding. Reload to start it again, or open a different page below.';
    }

    const route = (typeof window !== 'undefined' && window.location.hash.replace('#', '')) || '/';

    return (
      <div className="fixed inset-0 z-[9999] overflow-auto">
        <StatusScreen
          tone="error"
          eyebrow={isIpcError ? 'Backend unreachable' : `Fault · ${route}`}
          title={isIpcError ? 'The backend did not answer' : 'This screen stopped responding'}
          description={description}
          detail={error?.message || 'Unknown error'}
          detailLabel="Error message"
          copied={copied}
          onCopy={this.handleCopyError}
          actions={[
            {
              label: 'Reload app',
              onClick: this.handleReload,
              icon: <RefreshCw className="h-3.5 w-3.5" />,
              primary: true,
            },
          ]}
          destinations={STATUS_DESTINATIONS}
          onNavigate={this.navigateTo}
        />
      </div>
    );
  }
}
