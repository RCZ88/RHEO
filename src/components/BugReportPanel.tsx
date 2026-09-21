import { useState, useEffect } from 'react';
import { Bug, Send, Search, ChevronDown, ChevronRight, Loader2, AlertCircle, X } from 'lucide-react';

interface AgentResponse {
  terminalId: string;
  sessionId: string;
  agent: string;
  response: 'yes' | 'no';
  reason?: string;
  respondedAt: string;
}

interface RootCauseReport {
  suspectSessions: Array<{
    sessionId: string;
    agent: string;
    confidence: 'high' | 'medium' | 'low';
    reasons: string[];
  }>;
  suspiciousFiles: string[];
  timeline: Array<{
    timestamp: string;
    event: string;
    sessionId?: string;
  }>;
  suggestedApproach: string;
}

interface BugReport {
  id: string;
  projectId: string;
  title: string;
  errorText: string;
  status: 'pending' | 'investigating' | 'identified' | 'not_my_issue' | 'fixed' | 'ignored';
  agentResponses: AgentResponse[];
  linkedProblemId?: string;
  flowType: 'manual' | 'auto-consult' | 'research';
  rootCauseReport?: RootCauseReport;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  projectId: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'text-white/50' },
  investigating: { label: 'Investigating', color: 'text-blue-300' },
  identified: { label: 'Identified', color: 'text-amber-300' },
  not_my_issue: { label: 'Not My Issue', color: 'text-white/40' },
  fixed: { label: 'Fixed', color: 'text-emerald-300' },
  ignored: { label: 'Ignored', color: 'text-zinc-500' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: 'text-white/50' };
  return <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>;
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function BugReportPanel({ projectId }: Props) {
  const [title, setTitle] = useState('');
  const [errorText, setErrorText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [investigatingId, setInvestigatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    (window as any).deskflowAPI.listBugReports({ projectId })
      .then((res: any) => {
        if (res.success) setBugReports(res.data);
      })
      .catch((e: any) => console.error('[BugReport] Failed to load reports:', e))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    const cleanup = (window as any).deskflowAPI.onContextChanged((data: any) => {
      if (data?.type === 'bug_report' || data?.type === 'problem') {
        (window as any).deskflowAPI.listBugReports({ projectId })
          .then((res: any) => { if (res.success) setBugReports(res.data); })
          .catch(() => {});
      }
    });
    return cleanup();
  }, [projectId]);

  async function handleSubmit() {
    if (!errorText.trim() || !projectId) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await (window as any).deskflowAPI.submitBugReport({
        projectId,
        title: title.trim() || undefined,
        errorText: errorText.trim(),
      });
      if (result.success) {
        setTitle('');
        setErrorText('');
        const res = await (window as any).deskflowAPI.listBugReports({ projectId });
        if (res.success) setBugReports(res.data);
      } else {
        setError(result.error || 'Failed to submit');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleInvestigate(reportId: string) {
    setInvestigatingId(reportId);
    setError(null);
    try {
      const result = await (window as any).deskflowAPI.investigateBugReport({ bugReportId: reportId });
      if (result.success) {
        setBugReports(prev => prev.map(r => r.id === reportId ? result.data : r));
      } else {
        setError(result.error || 'Investigation failed');
      }
    } catch (e: any) {
      setError(e.message || 'Investigation failed');
    } finally {
      setInvestigatingId(null);
    }
  }

  function toggleExpand(id: string) {
    setExpandedId(prev => prev === id ? null : id);
  }

  const flowLabel = (type: string) => {
    switch (type) {
      case 'manual': return 'Manual';
      case 'auto-consult': return 'Auto';
      case 'research': return 'Research';
      default: return type;
    }
  };

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto">
      <div className="flex items-center gap-2">
        <Bug size={16} className="text-purple-400" />
        <span className="text-sm font-semibold text-white/80">Bug Report</span>
      </div>

      <div className="bg-white/5 rounded-lg p-3 flex flex-col gap-2">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Title (optional)..."
          className="w-full bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-white/70 placeholder-white/30 outline-none focus:border-purple-500/40"
        />
        <textarea
          value={errorText}
          onChange={e => setErrorText(e.target.value)}
          placeholder="Paste error logs, console output, stack traces, or any error message..."
          rows={6}
          className="w-full bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-white/70 placeholder-white/30 outline-none focus:border-purple-500/40 resize-none font-mono"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={handleSubmit}
            disabled={submitting || !errorText.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-medium hover:bg-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            {submitting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            {submitting ? 'Dispatching...' : 'Submit Report'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
          <AlertCircle size={12} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X size={12} />
          </button>
        </div>
      )}

      <div className="text-[10px] font-medium text-white/30 uppercase tracking-wider">
        Past Bug Reports
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={16} className="animate-spin text-white/30" />
        </div>
      ) : bugReports.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-white/30">
          <Search size={24} />
          <span className="text-xs">No bug reports yet.</span>
          <span className="text-[10px]">Paste an error above and submit.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {bugReports.map(report => (
            <div key={report.id} className="bg-white/5 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleExpand(report.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors"
              >
                {expandedId === report.id ? <ChevronDown size={12} className="text-white/30 shrink-0" /> : <ChevronRight size={12} className="text-white/30 shrink-0" />}
                <span className="text-xs font-mono text-white/40 shrink-0">{report.id.slice(0, 12)}</span>
                <StatusBadge status={report.status} />
                <span className="text-[10px] text-white/20 ml-auto">{flowLabel(report.flowType)}</span>
                <span className="text-[10px] text-white/20">{formatRelative(report.createdAt)}</span>
              </button>

              {expandedId === report.id && (
                <div className="px-3 pb-3 flex flex-col gap-2 border-t border-white/5 pt-2">
                  {report.title && (
                    <div className="text-xs text-white/60 font-medium">{report.title}</div>
                  )}

                  <div className="text-[10px] font-medium text-white/30 uppercase">Error</div>
                  <pre className="bg-black/30 rounded-md p-2 text-[10px] font-mono text-red-300/70 whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                    {report.errorText}
                  </pre>

                  {report.agentResponses.length > 0 && (
                    <>
                      <div className="text-[10px] font-medium text-white/30 uppercase mt-1">
                        Agent Responses ({report.agentResponses.length})
                      </div>
                      {report.agentResponses.map((resp, i) => (
                        <div key={i} className="bg-zinc-900/80 rounded-md">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs ${resp.response === 'yes' ? 'text-emerald-300' : 'text-red-300'}`}>
                              {resp.response === 'yes' ? 'Yes' : 'No'}
                            </span>
                            <span className="text-[10px] text-white/40">{resp.agent}</span>
                            <span className="text-[9px] text-white/20">{resp.respondedAt ? formatRelative(resp.respondedAt) : ''}</span>
                          </div>
                          {resp.reason && (
                            <div className="text-[10px] text-white/50">{resp.reason}</div>
                          )}
                        </div>
                      ))}
                    </>
                  )}

                  {report.linkedProblemId && (
                    <div className="flex items-center gap-1.5 text-xs text-purple-300">
                      <span>Linked Problem:</span>
                      <span className="font-mono">#{report.linkedProblemId}</span>
                    </div>
                  )}

                  {report.rootCauseReport && (
                    <>
                      <div className="text-[10px] font-medium text-white/30 uppercase mt-1">Root Cause Report</div>
                      <div className="bg-amber-500/10 rounded-md p-2 flex flex-col gap-1.5">
                        {report.rootCauseReport.suspectSessions.map((s, i) => (
                          <div key={i} className="flex items-center gap-2 text-[10px]">
                            <span className={`${s.confidence === 'high' ? 'text-red-300' : 'text-amber-300'}`}>
                              [{s.confidence}]
                            </span>
                            <span className="text-white/60">{s.agent}</span>
                          </div>
                        ))}
                        <div className="text-[10px] text-white/40 mt-1">{report.rootCauseReport.suggestedApproach}</div>
                      </div>
                    </>
                  )}

                  <button
                    onClick={() => handleInvestigate(report.id)}
                    disabled={investigatingId === report.id}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 text-[10px] font-medium hover:bg-emerald-500/20 disabled:opacity-40 self-start mt-1 transition-all active:scale-95"
                  >
                    {investigatingId === report.id ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <Search size={10} />
                    )}
                    {investigatingId === report.id ? 'Investigating...' : 'Investigate (Research Mode)'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
