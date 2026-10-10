import { AppWindow, Boxes, Circle, Command, MoreHorizontal, PanelLeft, PanelRight, Plus, Save, Search, Pencil } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Store } from "../hooks/useConsoleStore";
import { isElectron } from "../lib/electron";
import { timeAgo } from "../lib/utils";

/* ONE button language for the whole rail. The rail used to hand-write a slightly
   different className on all seven controls (two of them still said
   `hover:bg-white/10`, a raw literal, and two filled the whole button with the
   accent). Deriving them from one constant is what stops the drift coming back. */
const ICON_BTN =
  "w-8 h-8 rounded-lg grid place-items-center transition-colors shrink-0";
const ICON_BTN_IDLE =
  "text-[var(--t-muted)] hover:bg-[var(--t-fg)]/[0.06] hover:text-[var(--t-fg)]";
const ICON_BTN_ON =
  "text-[var(--t-fg)] bg-[var(--t-fg)]/[0.08]";
const TEXT_BTN =
  "h-8 px-2.5 rounded-lg text-[12px] font-medium border transition-colors flex items-center gap-1.5 " +
  "hover:bg-[var(--t-fg)]/[0.06]";

export function TitleBar({ store, onPalette, onSaveWs, onWorkspaces, onPresets, onNewTab, leftOpen, setLeftOpen, rightOpen, setRightOpen, demoMode, setDemoMode, onRename }: {
  store: Store; onPalette: () => void; onSaveWs: () => void; onWorkspaces: () => void; onPresets: () => void; onNewTab: () => void;
  leftOpen: boolean; setLeftOpen: (v: boolean) => void; rightOpen: boolean; setRightOpen: (v: boolean) => void;
  demoMode: boolean; setDemoMode: (v: boolean) => void;
  onRename: () => void;
}) {
  const lastCmd = store.history[0];
  const electron = isElectron();
  return (
    <div
      className="df-rail-edge h-11 shrink-0 flex items-center gap-2 px-3 border-b relative z-30"
      style={{ background: "var(--t-panel)", borderColor: "var(--t-border)" }}
    >
      {/* Identity. This was a 135deg gradient tile with an 18px accent-coloured
          glow behind it — LAMINAR §7 bans decorative gradient + glow on chrome,
          and once --t-accent2 was rebound to --color-muted-foreground the
          gradient resolved to cyan->grey, which just looked muddy. Flat hairline
          square, accent glyph, no glow. */}
      <div className="flex items-center gap-2 select-none shrink-0">
        <div
          className="w-7 h-7 rounded-lg grid place-items-center border"
          style={{ borderColor: "var(--t-border)", color: "var(--t-accent)" }}
          aria-hidden="true"
        >
          <AppWindow size={15} />
        </div>
        <span className="font-semibold text-[13px] tracking-tight whitespace-nowrap" style={{ color: "var(--t-fg)" }}>
          Penguin Console
        </span>
      </div>

      <div className="w-px h-5 shrink-0" style={{ background: "var(--t-border)" }} />

      {/* Command palette. It used to sit centred with mx-auto and a bright accent
          hover border, which made the biggest, loudest object in the rail a
          search box. It is a means of navigation, not the headline: quiet by
          default, accent only while focused. */}
      <button
        onClick={onPalette}
        className="hidden md:flex items-center gap-2 h-8 px-2.5 rounded-lg border text-[12px] transition-colors focus-within:border-[var(--t-accent)] group"
        style={{ background: "var(--t-bg)", borderColor: "var(--t-border)", color: "var(--t-muted)" }}
      >
        <Search size={13} />
        <span className="text-left whitespace-nowrap">Jump to…</span>
        <span
          className="flex items-center gap-0.5 text-[10px] mono px-1 py-px rounded border"
          style={{ borderColor: "var(--t-border)" }}
        >
          <Command size={9} />K
        </span>
      </button>

      {/* Last command. Real information — did my last thing work — so it earns
          its place in the rail, but as quiet mono text, not a bordered chip. */}
      {lastCmd && (
        <div className="hidden xl:flex items-center gap-2 text-[11px] mono min-w-0 max-w-[220px]" style={{ color: "var(--t-muted)" }}>
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: lastCmd.exitCode === 0 ? "var(--pc-success)" : "var(--pc-danger)" }}
          />
          <span className="truncate">$ {lastCmd.command}</span>
          <span className="shrink-0 opacity-60">{timeAgo(lastCmd.timestamp)}</span>
        </div>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-1 shrink-0">
        {/* DEMO/REAL is the one control that reports executable state, so it keeps
            a filled dot. Green/amber here are SEMANTIC (real vs simulated), which
            LAMINAR §2 permits — they are not decoration and not a second surface hue. */}
        <button
          onClick={() => setDemoMode(!demoMode)}
          data-testid="mode-toggle"
          data-mode={demoMode ? "demo" : "real"}
          aria-pressed={!demoMode}
          title={demoMode ? "Simulated shell — click to run REAL commands on this machine" : "Real shell — click to switch to the simulated DEMO console"}
          className={`h-8 px-2 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1.5 border ${demoMode ? 'text-[var(--pc-warning)]' : 'text-[var(--pc-success)]'}`}
          style={{
            borderColor: demoMode ? "color-mix(in srgb, var(--pc-warning) 34%, transparent)" : "color-mix(in srgb, var(--pc-success) 34%, transparent)",
            background: demoMode ? "color-mix(in srgb, var(--pc-warning) 12%, transparent)" : "color-mix(in srgb, var(--pc-success) 12%, transparent)",
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: demoMode ? "var(--pc-warning)" : "var(--pc-success)" }}
          />
          {demoMode ? "DEMO" : "REAL"}
        </button>

        <button
          onClick={() => setLeftOpen(!leftOpen)}
          title={leftOpen ? "Hide sidebar" : "Show sidebar"}
          aria-label={leftOpen ? "Hide sidebar" : "Show sidebar"}
          aria-pressed={leftOpen}
          className={`${ICON_BTN} ${leftOpen ? ICON_BTN_ON : ICON_BTN_IDLE}`}
        >
          <PanelLeft size={15} />
        </button>

        <button
          onClick={() => setRightOpen(!rightOpen)}
          title={rightOpen ? "Hide inspector" : "Show inspector"}
          aria-label={rightOpen ? "Hide inspector" : "Show inspector"}
          aria-pressed={rightOpen}
          className={`${ICON_BTN} ${rightOpen ? ICON_BTN_ON : ICON_BTN_IDLE}`}
        >
          <PanelRight size={15} />
        </button>

        <div className="w-px h-5 mx-1 shrink-0" style={{ background: "var(--t-border)" }} />

        <button
          onClick={onSaveWs}
          title="Save workspace (Ctrl+Shift+S)"
          className={`${TEXT_BTN} hidden sm:flex`}
          style={{ borderColor: "var(--t-border)", color: "var(--t-fg)" }}
        >
          <Save size={13} />Save
        </button>

        {/* The rest of the rail's verbs live in ONE menu. Seven equal-weight
            buttons was the chip wall; five controls + one overflow is a rail. */}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="More console actions"
            className={`${ICON_BTN} ${ICON_BTN_IDLE}`}
          >
            <MoreHorizontal size={15} />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={onRename}>
              <Pencil size={13} />
              Rename tab
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onWorkspaces}>
              <Boxes size={13} />
              Workspaces
              {store.workspaces.length > 0 && (
                <span className="ml-auto text-[10px] mono" style={{ color: "var(--t-muted)" }}>
                  {store.workspaces.length}
                </span>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onPresets}>
              <Circle size={13} />
              Presets
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onNewTab}>
              <Plus size={13} />
              New tab
              <span className="ml-auto text-[10px] mono" style={{ color: "var(--t-muted)" }}>
                ⇧⌃T
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          onClick={onNewTab}
          title="New tab (Ctrl+Shift+T)"
          aria-label="New tab"
          className={`${ICON_BTN} ${ICON_BTN_IDLE}`}
        >
          <Plus size={15} />
        </button>
      </div>

      <span className="sr-only">{electron ? "Electron native build" : "Electron 31"}</span>
    </div>
  );
}
