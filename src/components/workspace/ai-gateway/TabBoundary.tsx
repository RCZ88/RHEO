// AI Gateway — a boundary scoped to ONE tab.
//
// Deliberately NOT src/components/ErrorBoundary.tsx: that one renders
// `fixed inset-0 z-[9999]` (a full-screen takeover) and auto-reloads the window.
// One bad gateway tab must not replace the whole workspace view — which is very
// likely what made "none of the pages are working" look like a total outage
// rather than one broken surface.
import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props { children: ReactNode; label: string; onReset?: () => void; }
interface State { error: Error | null; }

export class TabBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    // Switching tabs must clear the error, or one broken tab poisons the rest.
    if (prev.label !== this.props.label && this.state.error) {
      this.setState({ error: null });
    }
  }

  reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children as any;
    return (
      <div className="rounded-xl bg-red-500/10 ring-1 ring-red-500/20 p-3 flex items-start gap-2 min-w-0">
        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-red-200">
            {this.props.label} crashed while rendering
          </p>
          <p className="text-[11px] text-red-300/90 mt-1 font-mono break-words whitespace-pre-wrap">
            {error?.message || String(error)}
          </p>
          <button
            onClick={this.reset}
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-red-200 underline underline-offset-2"
          >
            <RefreshCw className="w-3 h-3" /> Retry this tab
          </button>
        </div>
      </div>
    );
  }
}