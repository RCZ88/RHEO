import { PageShell } from '@/components/PageShell';
import { TimePanel } from '@/components/TimePanel';
import { Timer } from 'lucide-react';

console.log(
  '%c[TimeToolsPage] v1.0 loaded',
  'color: #fbbf24; font-weight: bold',
);

export default function TimeToolsPage() {
  return (
    <PageShell page="time-tools" variant="default" className="p-6 space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Time Tools · Stopwatch · Timer · Alarms
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
          <Timer className="w-5 h-5 text-[var(--page-accent)]" />
          Time Controls
        </h1>
        <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--text-secondary)]">
          The unified time dashboard. Start a stopwatch, set a timer, or create an alarm —
          everything you start here also appears on the top-bar clock dropdown, the AI deck
          Time card, and the Life page Self tab.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
          <TimePanel />
        </div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Quick actions</h3>
          <div className="space-y-2">
            <p className="text-xs text-[var(--text-muted)]">
              Start a stopwatch, timer, or alarm from the top-bar clock dropdown,
              or use the AI assistant: "set a 25 minute focus timer".
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              All state is shared via a single store — changes anywhere update everywhere.
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Alarms fire as native notifications when the app is running.
            </p>
          </div>
        </div>
      </div>
    </PageShell>
  );
}