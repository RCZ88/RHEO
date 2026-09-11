import { AppWindow, Boxes, Circle, Command, Minus, PanelLeft, PanelRight, Plus, Search, Sparkles, Square, X } from "lucide-react";
import type { Store } from "../hooks/useConsoleStore";
import { isElectron } from "../lib/electron";
import { timeAgo } from "../lib/utils";

export function TitleBar({ store, onPalette, onSaveWs, onWorkspaces, onPresets, onNewTab, leftOpen, setLeftOpen, rightOpen, setRightOpen }: {
  store: Store; onPalette: () => void; onSaveWs: () => void; onWorkspaces: () => void; onPresets: () => void; onNewTab: () => void;
  leftOpen: boolean; setLeftOpen: (v: boolean) => void; rightOpen: boolean; setRightOpen: (v: boolean) => void;
}) {
  const lastCmd = store.history[0];
  const electron = isElectron();
  return (
    <div className="h-12 shrink-0 flex items-center gap-3 px-3 border-b relative z-30" style={{ background: "var(--t-panel)", borderColor: "var(--t-border)" }}>
      <div className="flex items-center gap-1.5 pr-1" role="group" aria-label="window controls">
        <button title="Minimize" aria-label="minimize" className="w-7 h-7 rounded-lg grid place-items-center hover:bg-white/10 text-[var(--t-muted)] hover:text-[var(--t-fg)] transition"><Minus size={14} /></button>
        <button title="Maximize" aria-label="maximize" className="w-7 h-7 rounded-lg grid place-items-center hover:bg-white/10 text-[var(--t-muted)] hover:text-[var(--t-fg)] transition"><Square size={12} /></button>
        <button title="Close" aria-label="close" className="w-7 h-7 rounded-lg grid place-items-center hover:bg-red-500/90 hover:text-white text-[var(--t-muted)] transition"><X size={14} /></button>
      </div>
      <div className="w-px h-6" style={{ background: "var(--t-border)" }} />
      <div className="flex items-center gap-2.5 select-none">
        <div className="w-8 h-8 rounded-[10px] grid place-items-center shadow-lg" style={{ background: "linear-gradient(135deg, var(--t-accent), var(--t-accent2))", boxShadow: "0 4px 18px -4px var(--t-accent)" }}>
          <AppWindow size={17} className="text-white" />
        </div>
        <div className="leading-none">
          <div className="display font-bold text-[13.5px] tracking-tight" style={{ color: "var(--t-fg)" }}>Penguin Console</div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[9.5px] font-semibold px-1.5 py-px rounded-md mono" style={{ background: "color-mix(in srgb, var(--t-accent) 16%, transparent)", color: "var(--t-accent)" }}>{electron ? "ELECTRON · NATIVE" : "ELECTRON 31"}</span>
            <span className="text-[9.5px] font-semibold px-1.5 py-px rounded-md mono flex items-center gap-1" style={{ background: "rgba(52,211,153,.12)", color: "#34d399" }}><Circle size={6} className="fill-current" />LINUX</span>
          </div>
        </div>
      </div>
      <button onClick={onPalette} className="hidden md:flex flex-1 max-w-md mx-auto items-center gap-2.5 px-3.5 h-9 rounded-xl border text-[12.5px] transition hover:border-[var(--t-accent)] group" style={{ background: "var(--t-bg)", borderColor: "var(--t-border)", color: "var(--t-muted)" }}>
        <Search size={14} />
        <span className="flex-1 text-left">Jump to tab, command, workspace…</span>
        <span className="flex items-center gap-1 text-[10.5px] mono px-1.5 py-0.5 rounded-md border" style={{ borderColor: "var(--t-border)" }}><Command size={11} />K</span>
      </button>
      <div className="flex-1 md:hidden" />
      {lastCmd && (
        <div className="hidden xl:flex items-center gap-2 text-[11px] mono px-2.5 py-1.5 rounded-lg border max-w-[240px]" style={{ borderColor: "var(--t-border)", background: "var(--t-bg)", color: "var(--t-muted)" }}>
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: lastCmd.exitCode === 0 ? "#34d399" : "#fb7185" }} />
          <span className="truncate">$ {lastCmd.command}</span>
          <span className="shrink-0 opacity-60">{timeAgo(lastCmd.timestamp)}</span>
        </div>
      )}
      <div className="flex items-center gap-1">
        <button onClick={() => setLeftOpen(!leftOpen)} title="Toggle sidebar" aria-pressed={leftOpen} className="w-8 h-8 rounded-lg grid place-items-center transition" style={{ color: leftOpen ? "var(--t-accent)" : "var(--t-muted)", background: leftOpen ? "color-mix(in srgb, var(--t-accent) 14%, transparent)" : "transparent" }}><PanelLeft size={16} /></button>
        <button onClick={() => setRightOpen(!rightOpen)} title="Toggle inspector" aria-pressed={rightOpen} className="w-8 h-8 rounded-lg grid place-items-center transition" style={{ color: rightOpen ? "var(--t-accent)" : "var(--t-muted)", background: rightOpen ? "color-mix(in srgb, var(--t-accent) 14%, transparent)" : "transparent" }}><PanelRight size={16} /></button>
        <div className="w-px h-5 mx-1" style={{ background: "var(--t-border)" }} />
        <button onClick={onPresets} title="Preset gallery" className="h-8 px-2.5 rounded-lg hidden sm:flex items-center gap-1.5 text-[12px] font-medium transition hover:bg-white/10" style={{ color: "var(--t-muted)" }}><Sparkles size={14} />Presets</button>
        <button onClick={onWorkspaces} title="Workspaces" className="h-8 px-2.5 rounded-lg hidden sm:flex items-center gap-1.5 text-[12px] font-medium transition hover:bg-white/10" style={{ color: "var(--t-muted)" }}><Boxes size={14} />{store.workspaces.length > 0 && <span className="text-[10px] mono px-1 rounded" style={{ background: "var(--t-accent)", color: "#fff" }}>{store.workspaces.length}</span>}</button>
        <button onClick={onSaveWs} title="Save workspace (Ctrl+Shift+S)" className="h-8 px-3 rounded-lg hidden sm:flex items-center gap-1.5 text-[12px] font-semibold text-white transition hover:brightness-110" style={{ background: "linear-gradient(135deg, var(--t-accent), var(--t-accent2))" }}><Plus size={14} />Workspace</button>
        <button onClick={onNewTab} title="New tab (Ctrl+Shift+T)" className="w-8 h-8 rounded-lg grid place-items-center text-white transition hover:brightness-110" style={{ background: "color-mix(in srgb, var(--t-accent) 80%, #000)" }}><Plus size={16} /></button>
      </div>
    </div>
  );
}
