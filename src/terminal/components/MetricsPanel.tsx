import { useEffect, useRef, useState } from "react";
import { Activity, Cpu, MemoryStick, Gauge, MonitorSmartphone } from "lucide-react";

type Sample = {
  ts: number;
  cpuPct: number | null;
  memPct: number;
  gpuPct: number | null;
  appRssMB: number;
};

type Metrics = {
  cpuPct: number | null;
  cpuCount: number;
  cpuModel: string;
  loadAvg: number[];
  memTotalMB: number;
  memUsedMB: number;
  memPct: number;
  appRssMB: number;
  appHeapMB: number;
  uptimeH: number;
  gpu: { available: boolean; name: string; utilPct: number | null; memUsedMB: number | null; memTotalMB: number | null };
};

const HISTORY = 60;
const POLL_MS = 2000;

const api = () => (window as any).deskflowAPI;

/** Circular sparkline. Pure SVG so it inherits theme colour and needs no chart lib. */
function Spark({ data, pick, height = 34 }: { data: Sample[]; pick: (s: Sample) => number | null; height?: number }) {
  const pts = data.map(pick);
  const w = 100;
  const step = pts.length > 1 ? w / (pts.length - 1) : w;
  let d = "";
  let started = false;
  pts.forEach((v, i) => {
    if (v == null) return;
    const x = i * step;
    const y = height - (Math.max(0, Math.min(100, v)) / 100) * height;
    d += `${started ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)} `;
    started = true;
  });
  if (!started) return <div className="text-[10px] mono" style={{ color: "var(--t-muted)" }}>collecting…</div>;
  const last = pts.filter((v) => v != null).slice(-1)[0] ?? 0;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} aria-hidden="true">
      <path d={d} fill="none" stroke="var(--t-accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={(pts.length - 1) * step} cy={height - (Math.max(0, Math.min(100, last)) / 100) * height} r="2" fill="var(--t-accent)" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Ring gauge — one signal hue, no rainbow. */
function Ring({ pct, label, value, icon }: { pct: number | null; label: string; value: string; icon: React.ReactNode }) {
  const p = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  const r = 22, c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative shrink-0" style={{ width: 54, height: 54 }}>
        <svg viewBox="0 0 54 54" className="w-full h-full -rotate-90">
          <circle cx="27" cy="27" r={r} fill="none" stroke="var(--t-border)" strokeWidth="4" />
          <circle cx="27" cy="27" r={r} fill="none" stroke="var(--t-accent)" strokeWidth="4" strokeLinecap="round"
            strokeDasharray={`${(c * p) / 100} ${c}`} style={{ transition: "stroke-dasharray 250ms cubic-bezier(0.16,1,0.3,1)" }} />
        </svg>
        <span className="absolute inset-0 grid place-items-center" style={{ color: "var(--t-muted)" }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <div className="text-[9.5px] mono uppercase tracking-wider" style={{ color: "var(--t-muted)" }}>{label}</div>
        <div className="text-[15px] font-semibold mono leading-tight" style={{ color: "var(--t-fg)" }}>{value}</div>
      </div>
    </div>
  );
}

export function MetricsPanel({ store }: { store: any }) {
  const [m, setM] = useState<Metrics | null>(null);
  const [hist, setHist] = useState<Sample[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await api()?.consoleMetrics?.();
        if (!alive) return;
        if (res?.success && res.data) {
          setM(res.data);
          setErr(null);
          setHist((h) => [...h, {
            ts: Date.now(),
            cpuPct: res.data.cpuPct,
            memPct: res.data.memPct,
            gpuPct: res.data.gpu?.available ? res.data.gpu.utilPct : null,
            appRssMB: res.data.appRssMB,
          }].slice(-HISTORY));
        } else if (res?.error) {
          setErr(res.error);
        }
      } catch (e: any) {
        if (alive) setErr(e?.message || "metrics unavailable");
      }
    };
    tick();
    if (!paused) timer.current = window.setInterval(tick, POLL_MS);
    return () => { alive = false; if (timer.current) window.clearInterval(timer.current); };
  }, [paused]);

  if (err) {
    return (
      <div className="p-4 text-[12px]">
        <div style={{ color: "var(--pc-danger)" }}>Metrics unavailable — {err}</div>
        <div className="mt-1 text-[11px]" style={{ color: "var(--t-muted)" }}>The main process did not answer console:metrics.</div>
      </div>
    );
  }
  if (!m) {
    return <div className="p-4 text-[12px] mono" style={{ color: "var(--t-muted)" }}>Sampling…</div>;
  }

  const fmtMB = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`);

  // Per-pane attribution: these panes are NOT separate OS processes, so what is
  // honestly measurable is the console's own cost per pane (retained scrollback +
  // commands run). Labelled honestly rather than pretending it is process RSS.
  const panes: Array<{ id: string; tab: string; pane: string; lines: number; cmds: number; cwd: string }> = [];
  for (const t of store.tabs ?? []) {
    for (const p of Object.values<any>(t.panes ?? {})) {
      panes.push({ id: `${t.id}:${(p as any).id}`, tab: t.label, pane: (p as any).id, lines: (p as any).lines?.length ?? 0, cmds: (p as any).cmdHistory?.length ?? 0, cwd: (p as any).cwd ?? "" });
    }
  }
  panes.sort((a, b) => b.lines - a.lines);
  const totalLines = panes.reduce((a, p) => a + p.lines, 0);
  const maxLines = Math.max(1, ...panes.map((p) => p.lines));

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ color: "var(--t-fg)" }}>
      <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0" style={{ borderColor: "var(--t-border)" }}>
        <Activity size={13} style={{ color: "var(--t-accent)" }} />
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--t-muted)" }}>Resources</span>
        <div className="flex-1" />
        <button onClick={() => setPaused((p) => !p)}
          className="text-[10.5px] mono px-1.5 py-0.5 rounded transition-colors hover:bg-[var(--t-panel)]"
          style={{ color: "var(--t-muted)" }}>{paused ? "Resume" : "Pause"}</button>
      </div>

      <div className="grid grid-cols-3 gap-2 p-3">
        <Ring pct={m.cpuPct} label="CPU" value={m.cpuPct == null ? "—" : `${m.cpuPct}%`} icon={<Cpu size={13} />} />
        <Ring pct={m.memPct} label="RAM" value={`${m.memPct}%`} icon={<MemoryStick size={13} />} />
        <Ring pct={m.gpu.available ? m.gpu.utilPct : null} label="GPU" value={m.gpu.available ? `${m.gpu.utilPct ?? 0}%` : "n/a"} icon={<Gauge size={13} />} />
      </div>

      <div className="px-3 pb-3 space-y-2">
        <div style={{ color: "var(--t-muted)" }}>
          <div className="text-[9.5px] mono uppercase tracking-wider">CPU · last {hist.length} samples</div>
          <Spark data={hist} pick={(s) => s.cpuPct} />
        </div>
        <div style={{ color: "var(--t-muted)" }}>
          <div className="text-[9.5px] mono uppercase tracking-wider">RAM · system</div>
          <Spark data={hist} pick={(s) => s.memPct} />
        </div>
        {m.gpu.available && (
          <div style={{ color: "var(--t-muted)" }}>
            <div className="text-[9.5px] mono uppercase tracking-wider">GPU · utilisation</div>
            <Spark data={hist} pick={(s) => s.gpuPct} />
          </div>
        )}
      </div>

      <div className="px-3 pb-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] mono" style={{ color: "var(--t-muted)" }}>
        <span>CPU model</span><span className="truncate text-right" style={{ color: "var(--t-fg)" }}>{m.cpuModel?.slice(0, 26)}</span>
        <span>Cores</span><span className="text-right" style={{ color: "var(--t-fg)" }}>{m.cpuCount}</span>
        <span>Load avg</span><span className="text-right" style={{ color: "var(--t-fg)" }}>{m.loadAvg.join(" · ")}</span>
        <span>RAM used</span><span className="text-right" style={{ color: "var(--t-fg)" }}>{fmtMB(m.memUsedMB)} / {fmtMB(m.memTotalMB)}</span>
        <span>RHEO (this app)</span><span className="text-right" style={{ color: "var(--t-fg)" }}>{fmtMB(m.appRssMB)} RSS</span>
        <span>Heap</span><span className="text-right" style={{ color: "var(--t-fg)" }}>{fmtMB(m.appHeapMB)}</span>
        <span>Uptime</span><span className="text-right" style={{ color: "var(--t-fg)" }}>{m.uptimeH} h</span>
        <span>GPU</span><span className="truncate text-right" style={{ color: m.gpu.available ? "var(--t-fg)" : "var(--t-muted)" }}>{m.gpu.name}</span>
        {m.gpu.available && m.gpu.memTotalMB != null && (
          <>
            <span>VRAM</span><span className="text-right" style={{ color: "var(--t-fg)" }}>{fmtMB(m.gpu.memUsedMB ?? 0)} / {fmtMB(m.gpu.memTotalMB)}</span>
          </>
        )}
      </div>

      <div className="px-3 pb-4">
        <div className="flex items-center gap-1.5 mb-1.5">
          <MonitorSmartphone size={12} style={{ color: "var(--t-muted)" }} />
          <span className="text-[9.5px] mono uppercase tracking-wider" style={{ color: "var(--t-muted)" }}>
            Per pane · {panes.length} panes · {totalLines} lines held
          </span>
        </div>
        <p className="text-[10px] mb-2 leading-relaxed" style={{ color: "var(--t-muted)" }}>
          Console panes are not separate OS processes, so this is the console&apos;s own cost per pane —
          retained scrollback and commands run — not per-process RSS.
        </p>
        <div className="space-y-1">
          {panes.map((p) => (
            <div key={p.id} className="text-[10.5px] mono">
              <div className="flex items-center gap-1.5">
                <span className="truncate" style={{ color: "var(--t-fg)" }}>{p.tab}</span>
                <span className="opacity-50">·</span>
                <span className="truncate" style={{ color: "var(--t-muted)" }}>{p.cwd.replace("/home/user", "~")}</span>
                <span className="ml-auto shrink-0" style={{ color: "var(--t-muted)" }}>{p.lines}L · {p.cmds}cmd</span>
              </div>
              <div className="mt-0.5 h-1 rounded-full overflow-hidden" style={{ background: "var(--t-border)" }}>
                <div className="h-full rounded-full" style={{ width: `${(p.lines / maxLines) * 100}%`, background: "var(--t-accent)", transition: "width 250ms cubic-bezier(0.16,1,0.3,1)" }} />
              </div>
            </div>
          ))}
          {panes.length === 0 && <div className="text-[11px]" style={{ color: "var(--t-muted)" }}>No panes open.</div>}
        </div>
      </div>
    </div>
  );
}
