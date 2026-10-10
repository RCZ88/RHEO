import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Appearance, PaneNode, PaneState, TerminalTab, ThemeDef } from "../lib/types";
import type { Store } from "../hooks/useConsoleStore";
import { cx, fmtTime } from "../lib/utils";
import { Bell, Check, Copy, Search, SplitSquareHorizontal, SplitSquareVertical, X, ZoomIn } from "lucide-react";

function shellTag(shell?: string) {
  if (shell === "bash") return "bash";
  if (shell === "fish") return "fish";
  return "zsh";
}

export function Prompt({ pane, theme, appearance, shell }: { pane: PaneState; theme: ThemeDef; appearance: Appearance; shell?: string }) {
  const short = pane.cwd.replace("/home/user", "~");
  const u = theme.promptUser, p = theme.promptPath;
  const fail = (pane.lastExit ?? 0) !== 0;
  const sym = fail ? "✗" : shell === "fish" ? ">" : "❯";
  if (appearance.promptStyle === "minimal")
    return <span><span style={{ color: p }} className="font-semibold">{short}</span><span style={{ color: fail ? "var(--pc-danger)" : "var(--t-accent)" }} className="font-bold"> {sym} </span></span>;
  if (appearance.promptStyle === "two-line")
    return <span><span style={{ color: u }} className="font-bold">user@penguin</span><span style={{ color: "var(--t-muted)" }}> in </span><span style={{ color: p }} className="font-semibold">{short}</span>{fail && <span className="font-bold" style={{ color: "var(--pc-danger)" }}> ✗{pane.lastExit}</span>}<br /><span style={{ color: fail ? "var(--pc-danger)" : "var(--t-accent)" }} className="font-bold">{sym} </span></span>;
  if (appearance.promptStyle === "powerline")
    return (
      <span className="font-semibold">
        <span className="px-1.5 py-px rounded-l-md text-[11px]" style={{ background: fail ? "var(--pc-danger)" : "var(--t-accent)", color: "var(--t-bg)" }}>user@penguin</span>
        <span className="px-1.5 py-px rounded-r-md text-[11px]" style={{ background: "color-mix(in srgb, var(--t-accent2) 30%, transparent)", color: p }}>{short}</span>
        <span style={{ color: fail ? "var(--pc-danger)" : "var(--t-accent)" }}> {sym} </span>
      </span>
    );
  return <span><span style={{ color: u }} className="font-bold">user@penguin</span><span style={{ color: "var(--t-muted)" }}>:</span><span style={{ color: p }} className="font-semibold">{short}</span><span style={{ color: "var(--t-muted)" }}>{shell === "fish" ? "> " : "$ "}</span></span>;
}

function LineColor(type: string, theme: Pick<ThemeDef, "fg" | "accent" | "muted">) {
  switch (type) {
    case "input": return "var(--t-fg)";
    case "error": return "var(--t-accent)";
    case "success": return "var(--t-accent)";
    case "system": return "var(--t-accent)";
    case "dim": return "var(--t-muted)";
    default: return "var(--t-fg)";
  }
}

function highlight(text: string, q: string): React.ReactNode {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return <>{text.slice(0, i)}<mark className="hl-mark">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

/** One scrollback row. Memoised so that typing in the input re-renders the prompt
 *  row only, instead of the entire scrollback (which reached 800 rows and made
 *  every keystroke visibly lag). */
const TermLineRow = memo(function TermLineRow({ l, q, fg, accent, muted, fontSize, onCopy }: {
  l: { id: string; type: string; text: string; timestamp: number };
  q: string; fg: string; accent: string; muted: string; fontSize: number; onCopy: (t: string) => void;
}) {
  return (
    <div className="group/line flex gap-1.5 items-baseline anim-sweep" style={{ color: LineColor(l.type, { fg, accent, muted }) }}>
      {l.type === "input" ? (
        <>
          <span className="shrink-0 opacity-50 select-none" style={{ fontSize: fontSize - 2 }}>▸</span>
          <span className="break-words whitespace-pre-wrap flex-1 font-medium">{highlight(l.text, q)}</span>
          <span className="shrink-0 text-[9px] mono opacity-0 group-hover/line:opacity-60">{fmtTime(l.timestamp)}</span>
        </>
      ) : (
        <>
          <span className="df-line whitespace-pre block min-w-0 flex-1" style={{ opacity: l.type === "dim" ? 0.85 : 1 }}>{highlight(l.text, q)}</span>
          <button onClick={(e) => { e.stopPropagation(); onCopy(l.text); }} className="shrink-0 opacity-0 group-hover/line:opacity-60 hover:!opacity-100 transition" style={{ color: muted }} aria-label="copy line"><Copy size={10} /></button>
        </>
      )}
    </div>
  );
});

const PaneBtn = ({ title, onClick, danger, children }: { title: string; onClick: (e: React.MouseEvent) => void; danger?: boolean; children: React.ReactNode }) => (
  <button
    title={title}
    aria-label={title}
    onClick={onClick}
    className={`w-5 h-5 rounded grid place-items-center shrink-0 transition-colors ${danger ? "hover:bg-[color-mix(in_srgb,var(--pc-danger)_25%,transparent)] hover:text-[var(--pc-danger)]" : "hover:bg-white/[0.07]"}`}
    style={{ color: "var(--t-muted)" }}
  >
    {children}
  </button>
);

export function TermPane({ store, tab, pane, focused, findQ, onBell }: { store: Store; tab: TerminalTab; pane: PaneState; focused: boolean; findQ?: string; onBell?: () => void }) {
  const { theme, appearance } = { theme: store.theme, appearance: store.appearance };
  const [draft, setDraft] = useState("");
  const [localHist, setLocalHist] = useState(-1);
  const [toast, setToast] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const leafCount = Object.keys(tab.panes).length;
  const dense = appearance.density === "compact";

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [pane.lines.length, tab.id]);

  const flash = useCallback((m: string) => { setToast(m); window.setTimeout(() => setToast(null), 1400); }, []);

  const copyLine = useCallback((txt: string) => { navigator.clipboard?.writeText(txt).catch(() => {}); flash("copied"); }, [flash]);

  const lineRows = useMemo(
    () => pane.lines.map((l) => (
      <TermLineRow key={l.id} l={l} q={findQ ?? ""} fg={"var(--t-fg)"} accent={"var(--t-accent)"} muted={"var(--t-muted)"} fontSize={appearance.fontSize} onCopy={copyLine} />
    )),
    [pane.lines, findQ, "var(--t-fg)", "var(--t-accent)", "var(--t-muted)", appearance.fontSize, copyLine],
  );

  const submit = (cmd: string) => {
    store.runCommand(tab.id, pane.id, cmd);
    setDraft("");
    setLocalHist(-1);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const el = e.target as HTMLInputElement;
    // Ctrl+Shift combos: custom terminal behavior
    if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
      if (e.key === "c") {
        e.preventDefault();
        const txt = el.selectionStart !== el.selectionEnd ? el.value.slice(el.selectionStart, el.selectionEnd) : el.value;
        navigator.clipboard?.writeText(txt).catch(() => {});
        flash("copied");
        return;
      }
      if (e.key === "v") {
        e.preventDefault();
        navigator.clipboard?.readText().then((t) => { if (t) setDraft((d) => d + t); }).catch(() => {});
        return;
      }
      if (e.key === "a") {
        e.preventDefault();
        el.select();
        return;
      }
      if (e.key === "x") {
        e.preventDefault();
        const txt = el.selectionStart !== el.selectionEnd ? el.value.slice(el.selectionStart, el.selectionEnd) : el.value;
        navigator.clipboard?.writeText(txt).catch(() => {});
        setDraft((d) => d.slice(0, el.selectionStart) + d.slice(el.selectionEnd));
        flash("cut");
        return;
      }
    }
    // Ctrl / Cmd without shift: let browser handle natively (copy/paste/cut/select-all/undo/save)
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "l") {
        e.preventDefault();
        store.mutateTab(tab.id, (t) => ({ ...t, panes: { ...t.panes, [pane.id]: { ...t.panes[pane.id], lines: [] } } }));
        return;
      }
      // Ctrl+C / Ctrl+V / Ctrl+A / Ctrl+X / Ctrl+Z / Ctrl+S — native browser behavior, no preventDefault
      return;
    }
    if (e.key === "Enter") { submit(el.value); }
    else if (e.key === "ArrowUp") {
      e.preventDefault();
      const h = pane.cmdHistory;
      if (!h.length) return;
      const n = Math.min(localHist + 1, h.length - 1);
      setLocalHist(n);
      setDraft(h[n]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const h = pane.cmdHistory;
      const n = localHist - 1;
      if (n < 0) { setLocalHist(-1); setDraft(""); } else { setLocalHist(n); setDraft(h[n]); }
    }
    else if (e.key === "Tab") {
      e.preventDefault();
      const parts = el.value.split(/\s+/);
      const last = parts[parts.length - 1] ?? "";
      if (!last) return;
      const cands = ["git", "docker", "kubectl", "npm", "ls", "cd", "cat", "htop", "ssh", "systemctl", "journalctl", "neofetch", "sensors", "ffmpeg", "python3", "tail", "grep", "find"].filter((c) => c.startsWith(last) && c !== last);
      if (cands.length === 1) { parts[parts.length - 1] = cands[0]; setDraft(parts.join(" ")); }
      else if (cands.length > 1) flash(cands.join("   "));
    }
  };

  return (
    <div
      onClick={() => { store.focusPane(tab.id, pane.id); inputRef.current?.focus(); }}
      className={cx("term-pane relative flex flex-col min-h-0 min-w-0 h-full rounded-xl border overflow-hidden transition-shadow")}
      style={{
        background: `color-mix(in srgb, ${"var(--t-panel)"} ${Math.round(appearance.opacity * 100)}%, transparent)`,
        borderColor: focused ? tab.color : "var(--t-border)",
        boxShadow: focused ? `0 0 0 1px ${tab.color}88, 0 10px 30px -14px ${tab.color}55` : undefined,
        fontFamily: `'${appearance.fontFamily}', monospace`,
        fontSize: appearance.fontSize,
        lineHeight: appearance.lineHeight,
        backdropFilter: appearance.transparency ? "blur(14px)" : undefined,
      }}
      role="log"
      aria-label={`terminal pane ${pane.cwd}`}
    >
      {/* One quiet chrome bar per pane. Previously TWO bars existed: the first
          only when split, and a second whose entire purpose was a single copy
          button. Controls now reveal on hover/focus so the pane reads as one
          surface instead of a box of buttons inside a box inside a box. */}
      <div
        className={cx(
          "term-pane-bar flex items-center gap-1 pl-2 pr-1 h-7 shrink-0 border-b select-none",
          "opacity-60 focus-within:opacity-100 hover:opacity-100 transition-opacity"
        )}
        style={{ borderColor: "var(--t-border)", background: "color-mix(in srgb, var(--t-bg) 45%, transparent)" }}
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: focused ? tab.color : "var(--t-muted)" }} />
        <span className="text-[10px] mono truncate flex-1" style={{ color: "var(--t-muted)" }}>
          {pane.cwd.replace("/home/user", "~")} · {shellTag(tab.shell)}
        </span>
        {pane.lastExit !== 0 && (
          <span className="text-[9px] mono font-bold px-1 rounded" style={{ background: "color-mix(in srgb, var(--pc-danger) 15%, transparent)", color: "var(--pc-danger)" }}>✗{pane.lastExit}</span>
        )}
        <PaneBtn title="Copy all in pane" onClick={(e) => { e.stopPropagation(); store.copyAllContent(tab.id, pane.id); flash("copied all"); }}><Copy size={11} /></PaneBtn>
        <PaneBtn title="Find in pane" onClick={(e) => { e.stopPropagation(); onBell?.(); }}><Search size={11} /></PaneBtn>
        {leafCount > 1 && (
          <>
            <PaneBtn title="Split horizontal" onClick={(e) => { e.stopPropagation(); store.splitPane(tab.id, pane.id, "row"); }}><SplitSquareHorizontal size={11} /></PaneBtn>
            <PaneBtn title="Split vertical" onClick={(e) => { e.stopPropagation(); store.splitPane(tab.id, pane.id, "col"); }}><SplitSquareVertical size={11} /></PaneBtn>
            <PaneBtn title="Zoom pane" onClick={(e) => { e.stopPropagation(); store.setZoom({ tabId: tab.id, paneId: pane.id }); }}><ZoomIn size={11} /></PaneBtn>
            <PaneBtn title="Close pane" danger onClick={(e) => { e.stopPropagation(); store.closePane(tab.id, pane.id); }}><X size={11} /></PaneBtn>
          </>
        )}
      </div>
      <div ref={scrollRef} className={cx("df-scroll flex-1 overflow-y-auto min-h-0 pane-find", dense && "leading-snug")} style={{ padding: dense ? Math.max(6, appearance.padding - 6) : appearance.padding }}>
        {lineRows}
        <div className="flex items-baseline gap-1 mt-0.5">
          <div className="shrink-0"><Prompt pane={pane} theme={theme} appearance={appearance} shell={tab.shell} /></div>
          <div className="relative flex-1 flex items-center">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => { setDraft(e.target.value); setLocalHist(-1); }}
              onKeyDown={onKey}
              onFocus={() => store.focusPane(tab.id, pane.id)}
              spellCheck={false} autoComplete="off" autoCorrect="off" autoCapitalize="off"
              className="w-full bg-transparent outline-none"
              style={{ color: "var(--t-fg)", caretColor: "var(--t-accent)" }}
              aria-label="terminal input"
            />
            {focused && !draft && <span className="absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none" style={{ width: appearance.cursorStyle === "beam" ? 2 : 8, height: appearance.fontSize + 2 }}><span className={appearance.cursorBlink ? "t-cursor-blink block w-full h-full" : "block w-full h-full"} style={{ background: appearance.cursorStyle === "beam" ? "var(--t-accent)" : "var(--t-accent)", opacity: 0.9, width: appearance.cursorStyle === "beam" ? 2 : 8, borderBottom: appearance.cursorStyle === "underline" ? `2px solid ${"var(--t-accent)"}` : undefined, backgroundColor: appearance.cursorStyle === "underline" ? "transparent" : "var(--t-accent)" }} /></span>}
          </div>
        </div>
        {toast && <div className="mt-1 text-[10.5px] mono px-2 py-1 rounded-lg inline-block" style={{ background: "var(--t-bg)", color: "var(--t-muted)", border: `1px solid ${"var(--t-border)"}` }}>{toast}</div>}
      </div>
      {store.appearance.showStatusBar && (
        <div className="flex items-center gap-2 px-2.5 h-6 shrink-0 border-t text-[9.5px] mono select-none" style={{ borderColor: "var(--t-border)", color: "var(--t-muted)", background: "color-mix(in srgb, var(--t-bg) 60%, transparent)" }}>
          <span className="truncate">{pane.cwd.replace("/home/user", "~")}</span>
          <div className="flex-1" />
          <span>{shellTag(tab.shell)}</span>
          <span>{pane.cmdHistory.length} hist</span>
          {focused && <span style={{ color: tab.color }}>● live</span>}
        </div>
      )}
    </div>
  );
}

export function BellHint() {
  return <span className="hidden"><Bell size={8} /><Check size={8} /></span>;
}

export function SplitView({ store, tab, node, findQ, onFind }: { store: Store; tab: TerminalTab; node: PaneNode; findQ?: string; onFind?: () => void }) {
  
  const dragIdRef = useRef<string | null>(null);

  const onDown = (e: React.MouseEvent, n: Extract<PaneNode, { kind: "split" }>) => {
    e.preventDefault(); e.stopPropagation();
    dragIdRef.current = n.id;
    const parent = (e.currentTarget.parentElement as HTMLElement);
    const rect = parent.getBoundingClientRect();
    const startX = e.clientX, startY = e.clientY, base = n.ratio;
    const move = (ev: MouseEvent) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      const delta = n.direction === "row" ? dx / Math.max(80, rect.width) : dy / Math.max(80, rect.height);
      store.setSplitRatio(tab.id, n.id, base + delta);
    };
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); dragIdRef.current = null; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const zoomPane = (paneId: string) => store.setZoom({ tabId: tab.id, paneId });

  if (node.kind === "pane") {
    const pane = tab.panes[node.paneId];
    if (!pane) return <div className="flex-1 rounded-xl border grid place-items-center text-[12px]" style={{ borderColor: "var(--t-border)", color: "var(--t-muted)" }}>pane gone — <button className="underline ml-1" onClick={() => store.closePane(tab.id, node.paneId)}>reset</button></div>;
    return (
      <div className="flex-1 min-h-0 min-w-0 flex">
        <div className="flex-1 min-h-0 min-w-0">
          <TermPane store={store} tab={tab} pane={pane} focused={tab.activePaneId === pane.id} findQ={findQ} onBell={onFind} />
        </div>
      </div>
    );
  }

  const row = node.direction === "row";
  return (
    <div className="flex-1 min-h-0 min-w-0 flex" style={{ flexDirection: row ? "row" : "column" }}>
      <div className="flex min-h-0 min-w-0" style={{ flex: node.ratio, flexDirection: row ? "row" : "column" }}>
        <SplitView store={store} tab={tab} node={node.children[0]} findQ={findQ} onFind={onFind} />
      </div>
      <div
        role="separator"
        aria-orientation={row ? "vertical" : "horizontal"}
        aria-label={`resize split ${Math.round(node.ratio * 100)} percent`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); store.setSplitRatio(tab.id, node.id, node.ratio - 0.02); }
          if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); store.setSplitRatio(tab.id, node.id, node.ratio + 0.02); }
          if (e.key === "0") store.setSplitRatio(tab.id, node.id, 0.5);
        }}
        onDoubleClick={() => store.setSplitRatio(tab.id, node.id, 0.5)}
        onMouseDown={(e) => onDown(e, node)}
        className="split-divider shrink-0 rounded-full relative z-10 group/div"
        style={{
          background: "var(--t-border)",
          cursor: row ? "col-resize" : "row-resize",
          ...(row ? { width: 9, margin: "4px 2px" } : { height: 9, margin: "2px 4px" }),
        }}
        title="Drag to resize · double-click 50/50 · arrows nudge"
      >
        <div className="div-tools absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-0.5 p-0.5 rounded-lg" style={{ background: "var(--t-panel2)", border: "1px solid var(--t-border)", flexDirection: row ? "column" : "row" }}>
          <button title="Flip orientation" onClick={(e) => { e.stopPropagation(); store.flipSplitAction(tab.id, node.id); }} className="w-5 h-5 rounded grid place-items-center hover:bg-white/10" style={{ color: "var(--t-fg)" }}><SplitSquareHorizontal size={11} /></button>
          <button title="Zoom first pane" onClick={(e) => { e.stopPropagation(); const ids = getLeafIds(node.children[0]); if (ids[0]) zoomPane(ids[0]); }} className="w-5 h-5 rounded grid place-items-center hover:bg-white/10" style={{ color: "var(--t-fg)" }}><ZoomIn size={11} /></button>
        </div>
      </div>
      <div className="flex min-h-0 min-w-0" style={{ flex: 1 - node.ratio, flexDirection: row ? "row" : "column" }}>
        <SplitView store={store} tab={tab} node={node.children[1]} findQ={findQ} onFind={onFind} />
      </div>
    </div>
  );
}

function getLeafIds(n: PaneNode): string[] {
  if (n.kind === "pane") return [n.paneId];
  return [...getLeafIds(n.children[0]), ...getLeafIds(n.children[1])];
}
