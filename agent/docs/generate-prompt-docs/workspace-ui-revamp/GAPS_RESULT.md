<aside>
🎯

**One opinionated solution** for revamping the terminal workspace UI in `src/pages/TerminalPage.tsx` only. Dark dev-tool aesthetic — Variance 5 / Motion 5 / Density 7. Borders over shadows, CSS transitions only (no Framer `whileHover`), Tailwind v4, all controls hand-built. Logic, IPC, and tab *content ownership* are untouched.

</aside>

## Global design decisions (the through-line)

These resolve the “choose one approach” asks up front so every section stays consistent.

| Decision | Choice | Rationale |
| --- | --- | --- |
| Surface color | Solid `bg-zinc-950` everywhere (sidebar, collapsed strip, panels) | Kills the 3 competing gradients; one flat substrate |
| Depth | Borders (`border-zinc-800/60`) + one inset hairline, never box-shadow | Flatter + cleaner per frontend-design skill |
| Tab bar (Req 3) | **Approach A, refined**: neutral zinc icon+label for all tabs, 2px accent underline + accent icon **only when active** | Honors “don’t remove per-tab colors” + consistency rule “2px accent bottom border”; removes the 12-color noise |
| Accent usage | Per-tab color appears in exactly 2 places: the active tab underline/icon, and a 2px left accent strip on that tab’s panel | Wayfinding without confetti |
| Primary action color | Single accent: **cyan** (`bg-cyan-600 hover:bg-cyan-500`). Retire the purple Compose gradient | One primary color; zinc for everything secondary |
| Secondary actions | Zinc-toned (`bg-zinc-800 hover:bg-zinc-700 text-zinc-200`) | ui-ux-pro-max secondary-action rule |
| Motion | `transition-colors duration-150`  • `active:scale-95`. No spring, no transform-on-hover | Motion knob = 5 |

## New design tokens — `src/index.css`

Keep `@import "tailwindcss";` at the top (v4). Add a `@theme` block for tokens and an `@layer utilities` block for the hand-built control primitives so they’re reused, not re-typed.

```css
/* src/index.css — append below @import "tailwindcss"; */
@theme {
	--ws-surface: #09090b;            /* zinc-950 — sidebar/panel substrate */
	--ws-surface-raised: #18181b;     /* zinc-900 — cards on the substrate */
	--ws-border: rgb(39 39 42 / 0.6); /* zinc-800/60 — default hairline */
	--ws-border-strong: rgb(63 63 70 / 0.6); /* zinc-700/60 — active/hover */
	--ws-accent: #06b6d4;             /* cyan-500 — single primary accent */
	--ws-radius-card: 0.5rem;         /* rounded-lg */
	--ws-dur: 150ms;
	--ws-ease: cubic-bezier(0.2, 0, 0, 1);
}

@layer utilities {
	/* Inset hairline that separates main area from sidebar (Req 1) */
	.ws-sidebar-edge { box-shadow: inset 1px 0 0 0 var(--ws-border); }

	/* Range slider (Req 5) — accent passed via --slider-accent inline */
	.ws-range { -webkit-appearance: none; appearance: none; width: 100%;
		height: 4px; border-radius: 9999px; background: #27272a; outline: none; }
	.ws-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none;
		width: 14px; height: 14px; border-radius: 9999px;
		background: var(--slider-accent, var(--ws-accent));
		border: 2px solid #09090b; cursor: pointer;
		transition: transform var(--ws-dur) var(--ws-ease); }
	.ws-range::-webkit-slider-thumb:hover { transform: scale(1.12); }
	.ws-range::-moz-range-thumb { width: 14px; height: 14px; border: 2px solid #09090b;
		border-radius: 9999px; background: var(--slider-accent, var(--ws-accent)); cursor: pointer; }

	/* Thin scrollbar (Req 9) */
	.ws-scroll { scrollbar-width: thin; scrollbar-color: #3f3f46 transparent; }
	.ws-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
	.ws-scroll::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 9999px;
		border: 2px solid transparent; background-clip: content-box; }
	.ws-scroll::-webkit-scrollbar-thumb:hover { background: #52525b; background-clip: content-box; }
	.ws-scroll::-webkit-scrollbar-track { background: transparent; }
}
```

These are the **only** CSS additions; everything else is Tailwind utility classes inline. No autoprefixer/postcss, no v3 directives.

---

## Requirement 1 — Sidebar container & resize handle

**Issue:** three-stop gradient + a 1px invisible resize handle that only reveals itself mid-drag.

**Container** (TerminalPage.tsx:2290-2333 root):

```tsx
<aside
	className="relative h-full shrink-0 bg-zinc-950 ws-sidebar-edge"
	style= width: sidebarWidth 
>
	{/* resize handle + header + tabbar + content */}
</aside>
```

- Drop `bg-gradient-to-b from-zinc-900/95 via-zinc-900/90 to-black/95 backdrop-blur-sm border-l` → `bg-zinc-950 ws-sidebar-edge`. The inset hairline gives depth without a border that fights the resize handle.

**Resize handle** — wider hit area, always faintly visible, brightens through states:

```tsx
<div
	role="separator"
	aria-orientation="vertical"
	onMouseDown={startResize}
	className={[
		'group absolute left-0 top-0 bottom-0 w-2 -ml-1 cursor-ew-resize z-10',
		'flex items-center justify-center',
	].join(' ')}
>
	{/* the visible line */}
	<span
		className={[
			'h-full w-px transition-colors duration-150',
			isResizing
				? 'w-0.5 bg-cyan-400'
				: 'bg-zinc-800 group-hover:bg-zinc-600',
		].join(' ')}
	/>
</div>
```

| State | Visible line | Hit area |
| --- | --- | --- |
| Idle | `w-px bg-zinc-800` (subtle but present) | `w-2` (8px), offset `-ml-1` so it straddles the seam |
| Hover | `group-hover:bg-zinc-600` | same |
| Active (drag) | `w-0.5 bg-cyan-400` (thickens + accent) | same; `isResizing` already tracked in state — no logic change |

---

## Requirement 2 — Sidebar header

**Issue:** cyan-tinted gradient overlay + arbitrary per-icon hover colors (cyan Info, violet BookOpen).

**Strategy:** header icons are *utility* controls, not wayfinding — so they get **one** neutral treatment: `text-zinc-500 hover:text-zinc-200`. The only colored element is the brand status dot (cyan), which signals “workspace live.”

```tsx
<header className="flex items-center justify-between px-3 h-9 border-b border-zinc-800/60">
	<div className="flex items-center gap-2">
		<span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
		<span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
			Terminal
		</span>
	</div>
	<div className="flex items-center gap-0.5">
		<button title="Workspace info" className="ws-icon-btn"><Info className="w-3.5 h-3.5" /></button>
		<button title="Feature guide" className="ws-icon-btn"><BookOpen className="w-3.5 h-3.5" /></button>
		<button title="Collapse sidebar" className="ws-icon-btn"><PanelLeftClose className="w-3.5 h-3.5" /></button>
	</div>
</header>
```

Reusable icon-button class (used in header **and** collapsed strip for consistency):

```tsx
// ws-icon-btn = these exact classes (define as a const string in the file)
'p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors duration-150 active:scale-95'
```

- Removed: `bg-gradient-to-r from-cyan-500/[0.04] to-transparent`.
- Fixed height `h-9` (was `py-2.5`) so the header aligns to the same baseline grid as the toolbar.
- Consistent icon accent strategy: **neutral by default, zinc-200 on hover, never per-icon hues.**

*(Note: the sidebar `<aside>` keeps its dynamic width via an inline style — `style` set to an object with `width: sidebarWidth`. State and the resize logic are unchanged.)*

---

## Requirement 3 — Tab bar (12 tabs)

**Issue:** 12 simultaneous accent colors create visual noise; full `border-b-2` on every active tab is heavy; inactive/active contrast is weak.

**Solution (Approach A, refined):** Tabs are **neutral at rest**. The active tab earns its accent in two restrained ways: an accent-colored icon and a 2px accent underline (consistency rule). The four green “workspace” tabs are visually grouped with a hairline separator after Analytics.

### Single source-of-truth tab array

```tsx
// Each tab: key, icon, label, and the accent used ONLY when active.
const TABS = [
	{ key: 'presets',     icon: Zap,        label: 'Presets',     accent: 'green'   },
	{ key: 'sessions',    icon: Clock,      label: 'Sessions',    accent: 'green'   },
	{ key: 'map',         icon: Monitor,    label: 'Map',         accent: 'green'   },
	{ key: 'analytics',   icon: PieChart,   label: 'Analytics',   accent: 'green'   },
	{ key: 'issues',      icon: ListChecks, label: 'Issues',      accent: 'emerald' },
	{ key: 'files',       icon: Folder,     label: 'Files',       accent: 'yellow'  },
	{ key: 'skills',      icon: Sparkles,   label: 'Skills',      accent: 'indigo'  },
	{ key: 'design',      icon: Palette,    label: 'Design',      accent: 'pink'    },
	{ key: 'configs',     icon: Settings,   label: 'Configs',     accent: 'orange'  },
	{ key: 'history',     icon: RefreshCw,  label: 'History',     accent: 'rose'    },
	{ key: 'context',     icon: Settings2,  label: 'Context',     accent: 'amber'   },
	{ key: 'maintenance', icon: Database,   label: 'Maintenance', accent: 'violet'  },
] as const
```

### Accent lookup (avoids Tailwind dynamic-class purge problems)

Tailwind v4 cannot see runtime-built class names, so map accents to **static** class strings:

```tsx
const TAB_ACTIVE: Record<string, string> = {
	green:   'text-green-400 border-green-500',
	emerald: 'text-emerald-400 border-emerald-500',
	yellow:  'text-yellow-400 border-yellow-500',
	indigo:  'text-indigo-400 border-indigo-500',
	pink:    'text-pink-400 border-pink-500',
	orange:  'text-orange-400 border-orange-500',
	rose:    'text-rose-400 border-rose-500',
	amber:   'text-amber-400 border-amber-500',
	violet:  'text-violet-400 border-violet-500',
}
```

### Tab bar container + button

```tsx
<nav className="flex flex-wrap border-b border-zinc-800/60 px-1 pt-1">
	{TABS.map((tab, i) => {
		const active = activeTab === tab.key
		const Icon = tab.icon
		return (
			<Fragment key={tab.key}>
				<button
					onClick={() => setActiveTab(tab.key)}
					title={tab.label}
					className={[
						'flex items-center gap-1.5 px-2.5 h-8 -mb-px border-b-2',
						'text-[11px] font-medium rounded-t-md',
						'transition-colors duration-150 active:scale-95',
						active
							? TAB_ACTIVE[tab.accent]
							: 'border-transparent text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50',
					].join(' ')}
				>
					<Icon className={['w-3.5 h-3.5', active ? '' : 'opacity-80'].join(' ')} />
					<span>{tab.label}</span>
				</button>
				{/* hairline after the 4 green workspace tabs (index 3) */}
				{i === 3 && <span className="w-px h-5 self-center bg-zinc-800 mx-1" />}
			</Fragment>
		)
	})}
</nav>
```

| State | Classes |
| --- | --- |
| Inactive | `border-transparent text-zinc-500` — icon `opacity-80` |
| Hover (inactive) | `hover:text-zinc-200 hover:bg-zinc-800/50` |
| Active | accent text + `border-b-2` accent (e.g. `text-orange-400 border-orange-500`), full-opacity icon |
- **Hit area:** `px-2.5 h-8` (fixed 32px row) is larger and consistent vs the old `px-2 py-2`.
- **flex-wrap:** `-mb-px` keeps the active underline flush with the container border across wrapped rows; `rounded-t-md` softens hover fills. Wrapped rows stack cleanly because every tab is the same 32px height.
- **Grouping:** the green four read as one cluster via the `w-px h-5` hairline after Analytics.

---

## Requirement 4 — Tab content panels

### 4.1 One panel wrapper for all 12 tabs

Replace the bare `<div className="flex-1 overflow-y-auto p-2">` with a single reusable wrapper that supplies the scroll container, consistent padding, and the **2px left accent strip** matching the active tab. The strip is the panel’s only accent — it ties content back to the active tab without recoloring everything inside.

```tsx
const ACCENT_STRIP: Record<string, string> = {
	green: 'bg-green-500', emerald: 'bg-emerald-500', yellow: 'bg-yellow-500',
	indigo: 'bg-indigo-500', pink: 'bg-pink-500', orange: 'bg-orange-500',
	rose: 'bg-rose-500', amber: 'bg-amber-500', violet: 'bg-violet-500',
}

function TabPanel({ accent, children }: { accent: string; children: React.ReactNode }) {
	return (
		<div className="relative flex-1 min-h-0">
			<span className={`absolute left-0 top-0 bottom-0 w-0.5 ${ACCENT_STRIP[accent]} opacity-60`} />
			<div className="h-full overflow-y-auto ws-scroll px-3 py-3 space-y-3">
				{children}
			</div>
		</div>
	)
}
```

Every `{activeTab === 'x' && (...)}` block is wrapped: `<TabPanel accent="green">...</TabPanel>`. This gives all tabs identical `px-3 py-3 space-y-3` rhythm and a thin scrollbar. For tabs that delegate to a sub-component (Issues, Files, Skills, Design, Context, Maintenance, Analytics) the wrapper supplies the spacing and the sub-component renders inside unchanged — **no content moves, no logic changes.**

### 4.2 Standardized Project Stats card

```tsx
<div className="rounded-lg border border-zinc-800/60 bg-zinc-900 p-3">
	<div className="flex items-center gap-1.5 mb-2">
		<span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
		<span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Project</span>
	</div>
	<dl className="grid grid-cols-3 gap-2 text-[11px]">
		<div><dt className="text-zinc-500">Language</dt><dd className="text-zinc-200 truncate">{language}</dd></div>
		<div><dt className="text-zinc-500">VCS</dt><dd className="text-zinc-200 truncate">{vcs}</dd></div>
		<div><dt className="text-zinc-500">IDE</dt><dd className="text-zinc-200 truncate">{ide}</dd></div>
	</dl>
</div>
```

Upgrades the old `bg-zinc-800/50 rounded-lg p-2` into the canonical card (border + raised surface + `p-3`).

### 4.3 Standardized EmptyState (one component, all tabs)

```tsx
function EmptyState({ icon: Icon, title, hint, action }: {
	icon: LucideIcon; title: string; hint?: string; action?: React.ReactNode
}) {
	return (
		<div className="flex flex-col items-center justify-center text-center py-10 px-4">
			<div className="w-9 h-9 rounded-lg border border-zinc-800/60 bg-zinc-900 flex items-center justify-center mb-3">
				<Icon className="w-4 h-4 text-zinc-600" />
			</div>
			<p className="text-xs font-medium text-zinc-300">{title}</p>
			{hint && <p className="text-[11px] text-zinc-500 mt-1 max-w-[200px]">{hint}</p>}
			{action && <div className="mt-3">{action}</div>}
		</div>
	)
}
```

Replaces every ad-hoc empty message (`"No presets yet"`, loose `<p className="text-xs text-zinc-500">`, and the old `<EmptyState>` variants) with one pattern.

### 4.4 Per-tab refinements

| Tab | Refinement |
| --- | --- |
| **Presets** | Add-form becomes a bordered card (`rounded-lg border border-zinc-800/60 bg-zinc-900 p-3 space-y-2`) with stacked inputs using the shared `ws-input` class (4.5). Each preset row: `group p-2.5 rounded-lg border border-zinc-800/60 hover:border-zinc-700`; hover actions `opacity-0 group-hover:opacity-100 transition-opacity duration-150`; `[SYSTEM]` becomes a standard badge. Edit dialog uses the modal template (Req 8). |
| **Sessions** | Category pills use the shared Pill (4.5). Session cards: `rounded-lg border border-zinc-800/60 bg-zinc-900 p-3` with a 2px left status border (`emerald-500` running / `zinc-700` closed). Detail view uses `p-4`, metadata as a `grid grid-cols-2 gap-2 text-[11px]`. Messages: role dot `w-1.5 h-1.5`, timestamp `text-[10px] text-zinc-500`, Quote as compact button. Filters row is `flex flex-wrap gap-1.5`. |
| **Map** | MiniMap and list each get a bordered card. The map/list divider reuses the **horizontal** variant of the resize handle (`h-2 -mt-1` with `w-full h-px` line, accent on drag) — same visual language as the sidebar handle. `mapListRatio` logic unchanged. |
| **Analytics** | Period selector uses the shared Pill group. `AnalyticsDashboard` gets a wrapping card `rounded-lg border border-zinc-800/60 p-3`; pass through `variant="full"` unchanged. |
| **Issues / Files / Skills / Design / Context / Maintenance** | No internal changes — each sub-component renders inside `TabPanel` for identical outer padding/scroll. Remove any redundant outer padding the sub-component duplicated so spacing isn’t doubled. |
| **Configs** | Each section becomes a standardized **section card**: `rounded-lg border border-zinc-800/60 bg-zinc-900` with a header row (`px-3 h-9 border-b border-zinc-800/60`, accent dot + uppercase label) and body `p-3 space-y-3`. Replaces the inconsistent accent-colored full borders with one card + a small accent dot in the header. |
| **History** | Future-proof layout: render a list scaffold now, `EmptyState` when empty (icon `RefreshCw`, title “No history yet”, hint “Prompt and command history will appear here”). Drop the rose-tinted placeholder box. |

### 4.4a Sessions tab — header & context menu

The Sessions panel gets a header row above the existing filter pills:

```tsx
<div className="flex items-center justify-between mb-3">
	<span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Agents</span>
	<div className="flex items-center gap-2">
		<ToolbarButton variant="primary" icon={Plus}>New Agent</ToolbarButton>
		<ToolbarButton variant="secondary" icon={Upload}>Import</ToolbarButton>
		<ToolbarButton variant="secondary" icon={Save}>Save</ToolbarButton>
		<ToolbarButton variant="secondary" icon={FolderOpen}>Load</ToolbarButton>
	</div>
</div>
{/* category filter pills row (existing) below */}
```

- **New Agent** (primary) → opens `NewSessionDialog`. **Import** (secondary) → `ImportSessionsDialog`. **Save** / **Load** (secondary) → persist/restore the full workspace layout (sidebar config, tab state, terminal layout).
- The category filter pills row (existing) renders directly beneath this header.

**Context menu (right-click a session card):** `onContextMenu` → `preventDefault`, render a small positioned menu at the cursor inside `<div className="fixed z-[var(--z-overlay)]">`. Container and items reuse existing tokens:

```tsx
<div className="fixed z-[var(--z-overlay)] rounded-lg border border-zinc-800/60 bg-zinc-900 p-1 shadow-lg">
	{terminals.map((t) => (
		<button key={t.id}
			className="flex items-center gap-2 w-full px-2.5 h-7 rounded-md text-[11px] text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors duration-150">
			<span className={`w-1.5 h-1.5 rounded-full ${t.statusDot}`} />
			Open in {t.name}
		</button>
	))}
</div>
```

---

### 4.5 Section-card template (Configs + reuse)

```tsx
function SectionCard({ accent, title, children }: {
	accent: string; title: string; children: React.ReactNode
}) {
	return (
		<section className="rounded-lg border border-zinc-800/60 bg-zinc-900">
			<header className="flex items-center gap-1.5 px-3 h-9 border-b border-zinc-800/60">
				<span className={`w-1.5 h-1.5 rounded-full ${ACCENT_STRIP[accent]}`} />
				<span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{title}</span>
			</header>
			<div className="p-3 space-y-3">{children}</div>
		</section>
	)
}
```

---

## Requirement 5 — Custom controls (one design each)

All controls stay hand-built (no Radix/shadcn). Define each as a small local component so the workspace stops re-typing divergent variants.

### 5.1 Toggle — standardize to ONE size (`w-9 h-5`, 16px thumb)

Retire `w-8 h-4` and `w-10 h-5`. Single component:

```tsx
function Toggle({ checked, onChange, label }: {
	checked: boolean; onChange: (v: boolean) => void; label?: string
}) {
	return (
		<button
			role="switch"
			aria-checked={checked}
			aria-label={label}
			onClick={() => onChange(!checked)}
			className={[
				'relative inline-flex items-center w-9 h-5 rounded-full shrink-0',
				'transition-colors duration-150 active:scale-95',
				'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40',
				checked ? 'bg-cyan-600' : 'bg-zinc-700',
			].join(' ')}
		>
			<span
				className={[
					'inline-block w-4 h-4 rounded-full bg-white shadow-sm',
					'transition-transform duration-150',
					checked ? 'translate-x-[18px]' : 'translate-x-0.5',
				].join(' ')}
			/>
		</button>
	)
}
```

| State | Track | Thumb |
| --- | --- | --- |
| Off | `bg-zinc-700` | `translate-x-0.5` |
| On | `bg-cyan-600` | `translate-x-[18px]` |
| Focus | `ring-2 ring-cyan-500/40` | — |

Note: the thumb `transition-transform` is a position change, not a hover transform — allowed under Motion=5.

### 5.2 Slider — reuse the `.ws-range` utility

No more inline accent classes scattered per slider. Use the CSS utility; pass the rare non-default accent via a CSS variable.

```tsx
// Default (cyan) slider
<input type="range" min={3} max={30} value={threshold}
	onChange={(e) => setThreshold(+e.target.value)}
	className="ws-range" />

// Amber slider (e.g. Lock TTL) — accent via inline CSS var
<input type="range" min={30} max={600} value={ttl}
	onChange={(e) => setTtl(+e.target.value)}
	className="ws-range"
	style={sliderAccentAmber} /> // style sets '--slider-accent' to '#f59e0b'
```

Track `4px #27272a`, thumb `14px` with a 2px `#09090b` ring; thumb scales `1.12` on hover. Consistent everywhere; the per-section accent is the only variable.

### 5.3 Select — refined native dropdown

Keep native `<select>` (accessible, hand-built styling). One class string:

```tsx
// ws-select
'h-7 w-full rounded-md bg-zinc-900 border border-zinc-800/60 px-2 pr-7 text-[11px] text-zinc-200 '
+ 'appearance-none bg-no-repeat bg-[right_0.5rem_center] '
+ 'hover:border-zinc-700 focus:border-cyan-500/60 focus:outline-none '
+ 'transition-colors duration-150'
```

Use a background-image chevron (data-URI) or a positioned `<ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />` inside a `relative` wrapper. Options inherit OS rendering — acceptable for a dev tool.

### 5.4 Pill — one pattern for Sessions categories + Configs model tier

```tsx
function Pill({ active, onClick, dotClass, children }: {
	active: boolean; onClick: () => void; dotClass?: string; children: React.ReactNode
}) {
	return (
		<button
			onClick={onClick}
			className={[
				'inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-medium',
				'transition-colors duration-150 active:scale-95 border',
				active
					? 'bg-zinc-200 text-zinc-900 border-transparent'
					: 'bg-transparent text-zinc-400 border-zinc-800/60 hover:text-zinc-200 hover:border-zinc-700',
			].join(' ')}
		>
			{dotClass && <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />}
			{children}
		</button>
	)
}
```

Active = high-contrast `bg-zinc-200 text-zinc-900` (works for any context, no per-pill color juggling). Category dots still carry their semantic color via `dotClass` (red Bug Fix, blue Feature, etc.) so filtering wayfinding is preserved.

---

## Requirement 6 — Collapsed sidebar strip

**Issue:** gradient background + afterthought spacing.

**Solution:** a deliberate “tool rack” on solid `bg-zinc-950` reusing the exact `ws-icon-btn` class from the header, plus a CSS-only hover tooltip.

```tsx
<div className="h-full w-10 bg-zinc-950 ws-sidebar-edge flex flex-col items-center gap-1 py-2">
	<button title="Workspace info" className="ws-icon-btn ws-tip" data-tip="Info">
		<Info className="w-4 h-4" />
	</button>
	<button title="Feature guide" className="ws-icon-btn ws-tip" data-tip="Guide">
		<BookOpen className="w-4 h-4" />
	</button>
	<span className="w-5 h-px bg-zinc-800 my-1" />
	<button title="Expand sidebar" className="ws-icon-btn ws-tip" data-tip="Expand"
		onClick={() => setSidebarOpen(true)}>
		<PanelLeft className="w-4 h-4" />
	</button>
</div>
```

CSS-only tooltip (add to the `@layer utilities` block):

```css
.ws-tip { position: relative; }
.ws-tip::after {
	content: attr(data-tip);
	position: absolute; right: calc(100% + 8px); top: 50%; transform: translateY(-50%);
	white-space: nowrap; padding: 2px 6px; border-radius: 6px;
	background: #18181b; border: 1px solid var(--ws-border);
	color: #e4e4e7; font-size: 10px; line-height: 1;
	opacity: 0; pointer-events: none;
	transition: opacity var(--ws-dur) var(--ws-ease);
}
.ws-tip:hover::after { opacity: 1; }
```

- Background now matches the expanded sidebar (`bg-zinc-950 ws-sidebar-edge`).
- Hover colors are neutral (inherited from `ws-icon-btn`) — no more random cyan/violet.
- Width fixed at `w-10` (40px) tool rack; `gap-1` + a `w-5 h-px` divider read as intentional.
- **Expand transition (CSS-only):** animate the sidebar wrapper’s width with `transition-[width] duration-200 [transition-timing-function:var(--ws-ease)]`. Collapsed = `w-10`, expanded = `sidebarWidth`. No layout-logic change — only a transition class on the wrapper. (If `sidebarWidth` is applied via inline style, add `transition: width 200ms var(--ws-ease)` to that element instead.)

---

## Requirement 7 — Toolbar & terminal area

### 7.1 Toolbar buttons — one button system

Define a `ToolbarButton` with `variant="primary" | "secondary"`. All are `h-7`, `text-[11px]`, `gap-1.5` icon+label, `rounded-lg`, `active:scale-95`.

```tsx
function ToolbarButton({ variant = 'secondary', icon: Icon, children, ...props }: {
	variant?: 'primary' | 'secondary'; icon?: LucideIcon; children: React.ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
	return (
		<button
			{...props}
			className={[
				'inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-medium',
				'transition-colors duration-150 active:scale-95',
				variant === 'primary'
					? 'bg-cyan-600 hover:bg-cyan-500 text-white'
					: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200',
			].join(' ')}
		>
			{Icon && <Icon className="w-3.5 h-3.5" />}
			{children}
		</button>
	)
}
```

- **Compose** = `variant="primary"` (cyan). The purple gradient `from-purple-600 to-indigo-600` is **retired** — single accent.
- **Quick** and **Save** = `variant="secondary"` (zinc). Save keeps its 💾/`Save` icon at `w-3.5 h-3.5`.
- **Terminal status indicator:** `inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-zinc-800/60` with a `w-1.5 h-1.5 rounded-full bg-green-400` dot + agent name (`text-[11px] text-zinc-300`); bound-problem as a standard badge.

### 7.1a Toolbar — project controls (left group)

Req 7.1 covered the right-group actions (Compose / Quick / Save + terminal binding). The toolbar's **left group** adds project-scoped controls. All reuse existing primitives — no new tokens.

**Full toolbar layout** — one flex row, left + right groups split by the same hairline used between tab groups:

```tsx
<div className="flex items-center gap-2 px-3 h-9 border-b border-zinc-800/60 bg-zinc-950">
	{/* LEFT GROUP — project */}
	<select className="ws-select max-w-[180px]">{/* deskflowAPI.getProjects() */}</select>
	<ProjectInfoBadge />
	<ToolbarButton variant="secondary" icon={Plus}>Terminal</ToolbarButton>
	<ToolbarButton variant="secondary" icon={Wrench}>Setup</ToolbarButton>

	<span className="w-px h-5 bg-zinc-800" /> {/* group separator */}

	{/* RIGHT GROUP — actions (Req 7.1) */}
	<div className="ml-auto flex items-center gap-2">
		<TerminalBindingBadge />
		<ToolbarButton variant="primary" icon={Send}>Compose</ToolbarButton>
		<ToolbarButton variant="secondary">Quick</ToolbarButton>
		<ToolbarButton variant="secondary" icon={Save}>Save</ToolbarButton>
	</div>
</div>
```

- **A.1 Project selector** — native `<select className="ws-select max-w-[180px]">` (Req 5.3 class), `h-7` to match `ToolbarButton`. Lists `deskflowAPI.getProjects()`. Far left.
- **A.2 Project info badge** — mirrors the Req 7.1 terminal status indicator: `inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-zinc-800/60` with a `w-1.5 h-1.5 rounded-full bg-green-400` dot + project name (`text-[11px] text-zinc-300`). Path / language / VCS surface on hover via `ws-tip` (`data-tip`) or a `title` attribute.
- **A.3 Open Terminal** — `ToolbarButton variant="secondary"` + `Plus`, label “Terminal”. Creates a new terminal tab + layout entry (distinct from the tab-bar “+”). Sits between the badge and Setup.
- **A.4 Setup** — `ToolbarButton variant="secondary"` + `Wrench`, label “Setup”. Opens `NewSessionDialog` in `initialize` mode. Standard secondary zinc — no special amber.
- **Separator** — `w-px h-5 bg-zinc-800`, the same hairline as the tab-group divider (Req 3). The right group uses `ml-auto` so it pins to the toolbar's right edge.

---

### 7.2 Instruction panel / quick input cohesion

Wrap both in the canonical card and align controls to the toolbar grid:

```tsx
<div className="rounded-lg border border-zinc-800/60 bg-zinc-900 p-3 space-y-2">
	<textarea
		className="w-full min-h-[64px] rounded-md bg-zinc-950 border border-zinc-800/60 px-2.5 py-2
			text-xs text-zinc-200 placeholder:text-zinc-600 resize-y ws-scroll
			focus:border-cyan-500/60 focus:outline-none transition-colors duration-150"
		placeholder="Type an instruction…  @ to route to a terminal"
	/>
	<div className="flex items-center justify-between gap-2">
		<select className="ws-select max-w-[160px]">{/* session target */}</select>
		<div className="flex items-center gap-2">
			<ToolbarButton variant="secondary">Save</ToolbarButton>
			<ToolbarButton variant="primary" icon={Send}>Send</ToolbarButton>
		</div>
	</div>
</div>
```

Textarea, select, and buttons now share radius, border, and the cyan focus ring — one cohesive composer.

### 7.2a Full InstructionPanel (Compose surface)

Req 7.2 covered the **quick** inline input. Clicking **Compose** opens the full `InstructionPanel` (`src/components/InstructionPanel.tsx`) — a richer compose surface. Wrap the whole component in the canonical card: `rounded-lg border border-zinc-800/60 bg-zinc-900 p-3 space-y-3`. Sections top-to-bottom:

| Section | Design |
| --- | --- |
| **Mode selector** | Row of `Pill` (Req 5.4): “Compose” / “Quick”. Active = `bg-zinc-200 text-zinc-900`. “Quick” collapses the panel to just the textarea (hides problem/request/skill selectors). |
| **Link problem / request** | Two `Toggle` (Req 5.1) labeled “Link problem” and “Link request”. Each, when on, reveals a `<select className="ws-select">` below it listing available problems/requests. |
| **Skill selector** | `<select className="ws-select max-w-[200px]">` from `getSkills()`, under a `text-[10px] font-semibold uppercase tracking-wider text-zinc-500` label. |
| **Instruction textarea** | Same as Req 7.2 (min `min-h-[80px]`): `w-full rounded-md bg-zinc-950 border border-zinc-800/60 px-2.5 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 resize-y ws-scroll focus:border-cyan-500/60 focus:outline-none transition-colors duration-150`. |
| **Agent file picker** | `<select className="ws-select max-w-[200px]">` of agent files, under a `text-[10px]` label. |
| **Prompt preview** | Read-only assembled prompt: `rounded-md bg-zinc-950 border border-zinc-800/60 p-2 text-[11px] text-zinc-400 font-mono max-h-[200px] overflow-y-auto ws-scroll`. |
| **Action footer** | `flex items-center justify-between gap-2`. Left: `<select className="ws-select max-w-[160px]">` session target. Right: `ToolbarButton variant="secondary"` (Save) + `ToolbarButton variant="primary" icon={Send}` (Send). |

**Auto-persist (unchanged behavior):** the textarea debounce-saves to `localStorage['compose-instruction']` on each keystroke and restores on open. The restyle does not touch this logic.

---

### 7.3 Terminal tab bar

Standardize each tab to `h-8`, `text-[11px]`, keep the group color as a **2px top strip** (the one place group color lives).

```tsx
<div
	role="tab"
	aria-selected={isActive}
	className={[
		'group relative flex items-center gap-1.5 h-8 px-3 shrink-0',
		'border-r border-zinc-800/60 text-[11px] transition-colors duration-150 active:scale-95',
		isActive ? 'bg-zinc-900 text-zinc-100' : 'bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50',
	].join(' ')}
>
	{/* group color strip */}
	<span className={`absolute left-0 right-0 top-0 h-0.5 ${groupColorClass}`} />
	<Monitor className="w-3.5 h-3.5 opacity-80" />
	<span className={`w-1.5 h-1.5 rounded-full ${statusDotClass}`} />
	<span className="truncate max-w-[120px]">{name}</span>
	{tier && <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-zinc-800 text-zinc-300">{tier}</span>}
	<button className="ml-0.5 p-0.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800
		opacity-0 group-hover:opacity-100 transition-opacity duration-150" title="Close">
		<X className="w-3 h-3" />
	</button>
</div>
```

- Tab height standard `h-8` (was `px-3 py-1.5`).
- Model tier + category use the **standard badge** spec (`px-1.5 py-0.5 rounded-md text-[10px] font-medium`).
- Close button reveals on hover (`opacity-0 group-hover:opacity-100`).
- **“+” new terminal:** `ws-icon-btn` sized `h-8 w-8`, `Plus` icon. Group pills reuse the shared `Pill`.
- Terminal area / `TerminalLayout` (PaneNode) is **unchanged** — only the tab chrome is restyled.

#### 7.3a Terminal tab indicators (lock count, session, drag)

Add two badges after the model-tier badge, using the standard badge footprint (`px-1.5 py-0.5 rounded-md text-[10px] font-medium`):

```tsx
{/* file lock count — amber */}
{fileLockCount > 0 && (
	<span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/15 text-amber-400">
		{fileLockCount}
	</span>
)}
{/* active session bound — cyan "S" */}
{hasSession && (
	<span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-cyan-500/15 text-cyan-400">
		S
	</span>
)}
```

Order on the tab: name → tier → lock count → session “S” → close button.

> *Drag-and-drop reorder (existing @dnd-kit behavior) is unchanged. The `h-8` tab height leaves sufficient hit area for drag initiation. No visual drag handle is added — the entire tab is the handle.*
> 

### 7.4 Terminal layout area (in-scope chrome)

`TerminalLayout` / `PaneNode` / xterm internals stay untouched, but three **surrounding** elements in the terminal area are in scope.

**D.1 Error notification bar** — dismissible bar above the panes, `h-8` to stay on the toolbar grid; subtle tints so it never competes with tab accents:

```tsx
<div className={[
	'flex items-center justify-between gap-2 px-3 h-8 text-[11px] font-medium',
	type === 'error'   ? 'bg-red-500/10 text-red-400 border-b border-red-500/20' :
	type === 'warning' ? 'bg-yellow-500/10 text-yellow-400 border-b border-yellow-500/20' :
	                     'bg-green-500/10 text-green-400 border-b border-green-500/20',
].join(' ')}>
	<span>{message}</span>
	<button onClick={onDismiss} className="ws-icon-btn"><X className="w-3 h-3" /></button>
</div>
```

**D.2 Empty terminal state** — when no terminals exist, use `EmptyState` (Req 4.3):

```tsx
<EmptyState
	icon={Monitor}
	title="No terminals open"
	hint="Create a terminal to start working"
	action={<ToolbarButton variant="primary" icon={Plus}>Open Terminal</ToolbarButton>}
/>
```

**D.3 Agent status overlay** — centered overlay on the pane while an agent initializes or fails. Reuses the `Modal` backdrop recipe (`bg-zinc-950/60 backdrop-blur-sm`) and Tailwind `animate-pulse` (no Framer Motion):

```tsx
<div className="absolute inset-0 flex items-center justify-center bg-zinc-950/60 backdrop-blur-sm z-10">
	<div className="flex flex-col items-center gap-2 p-4">
		{status === 'initializing' && (
			<>
				<span className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
				<span className="text-xs text-zinc-300">Initializing agent…</span>
			</>
		)}
		{status === 'failed' && (
			<>
				<span className="w-3 h-3 rounded-full bg-amber-400" />
				<span className="text-xs text-zinc-300">Agent failed.</span>
				<ToolbarButton variant="secondary">Retry</ToolbarButton>
			</>
		)}
	</div>
</div>
```

---

## Requirement 8 — Dialogs & modals (one template)

**Issue:** mixed `GlassCard` vs plain `bg-zinc-800/900`, overlay z varies (`z-[var(--z-overlay)]` vs `z-[100]`), and the Confirm dialog is duplicated in two styles.

**Solution:** one `Modal` shell every workspace dialog renders through. Overlay, max-width, radius, padding, and the optional 250ms entrance are all centralized. Delete the duplicate Confirm variant and route both call sites through the single `<Modal>`.

```tsx
function Modal({ open, onClose, title, children, footer, width = 'max-w-md' }: {
	open: boolean; onClose: () => void; title: string; width?: string
	children: React.ReactNode; footer?: React.ReactNode
}) {
	if (!open) return null
	return (
		<div
			className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[var(--z-overlay)] flex items-center justify-center p-4"
			onClick={onClose}
		>
			<div
				role="dialog" aria-modal="true" aria-label={title}
				onClick={(e) => e.stopPropagation()}
				className={[
					'w-full', width,
					'rounded-xl border border-zinc-800/60 bg-zinc-900',
					'animate-[ws-modal-in_250ms_cubic-bezier(0.2,0,0,1)]',
				].join(' ')}
			>
				<header className="flex items-center justify-between px-4 h-11 border-b border-zinc-800/60">
					<h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
					<button onClick={onClose} className="ws-icon-btn"><X className="w-4 h-4" /></button>
				</header>
				<div className="p-4 space-y-3 text-xs text-zinc-300">{children}</div>
				{footer && (
					<footer className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-800/60">
						{footer}
					</footer>
				)}
			</div>
		</div>
	)
}
```

Optional CSS-only entrance (no Framer Motion needed) — add to `index.css`:

```css
@keyframes ws-modal-in {
	from { opacity: 0; transform: translateY(4px) scale(0.98); }
	to   { opacity: 1; transform: translateY(0) scale(1); }
}
```

| Token | Value |
| --- | --- |
| Overlay | `fixed inset-0 bg-black/60 backdrop-blur-sm z-[var(--z-overlay)]` (single z everywhere) |
| Container | `rounded-xl border border-zinc-800/60 bg-zinc-900`, width `max-w-md` (default) / `max-w-lg` (Messages Viewer) / `max-w-xl` (Features) |
| Header / body / footer | `h-11 px-4` / `p-4 space-y-3` / `px-4 py-3` with top border |
| Footer buttons | Cancel/Close = `ToolbarButton` secondary; confirm = primary (or `bg-red-600 hover:bg-red-500` for destructive) |
| Entrance | `ws-modal-in` 250ms `cubic-bezier(0.2,0,0,1)` |

Applies to: Save Checkpoint, Close Workspace, Confirm (de-duplicated), SessionEdit, Features, Generalist, Messages Viewer, Edit Preset. `GlassCard` is retained only as a non-modal content card; dialogs use `Modal`.

### 8.1 Additional dialogs (same `Modal`, zero custom styling)

Every dialog below renders through the Req 8 `Modal` shell — only `width`, `title`, body, and footer change.

| Dialog | Width | Body / notes |
| --- | --- | --- |
| **NewSessionDialog** | `max-w-lg` | Two `Pill` modes (Create / Initialize), terminal-mode `ws-select`, 6 context-system `Toggle` rows (`flex items-center justify-between py-1`), token-budget `.ws-range` slider, context-map card (`p-2 text-[11px]` bordered). Footer: Cancel (secondary) + Create/Initialize (primary). |
| **InitializeProgressModal** | `max-w-xl` | Grouped progress list — each directory group is a `SectionCard` (Req 4.5) with a progress counter; each file row `flex items-center gap-2 h-7 text-[11px]`; click to reveal a `p-2 text-[10px] font-mono bg-zinc-950 rounded-md ws-scroll` preview. Error rows: red dot + retry. On success → green “Workspace Ready” summary card. Footer: Close. |
| **ImportSessionsDialog** | `max-w-md` | Instructions (`text-xs text-zinc-400`), a CLI command block `rounded-md bg-zinc-950 border border-zinc-800/60 p-2 text-[11px] font-mono text-zinc-300`, “Run Import”. Footer: Cancel + Import (primary). |
| **RoutingDisambiguationDialog** | `max-w-md` | Running terminals as selectable rows `flex items-center gap-2 h-9 px-2 rounded-md hover:bg-zinc-800/50 cursor-pointer`; selected = `bg-zinc-800 border border-zinc-700`; each shows dot + name + agent type. Footer: Cancel + Route (primary). |
| **PromptDesignDialog** | `max-w-lg` | Sections as cards (`rounded-lg border border-zinc-800/60 bg-zinc-900 p-3`): instruction textarea, skill `ws-select`, generate. Footer: Cancel + Generate (primary). |
| **DSLGenerationModal** | `max-w-md` | Config inputs (`ws-select` / input), preview `rounded-md bg-zinc-950 border border-zinc-800/60 p-2 text-[11px] font-mono ws-scroll`. Footer: Cancel + Generate (primary). |

**RoutingToast** (not a modal — transient toast): `fixed bottom-4 right-4 z-[var(--z-overlay)] rounded-lg border border-zinc-800/60 bg-zinc-900 p-3 shadow-lg flex items-center gap-2 min-w-[200px] max-w-[320px]`, with a `w-4 h-4` cyan/amber icon, message (`text-xs text-zinc-300`), and a `ws-icon-btn` dismiss (`w-5 h-5`). Entrance reuses `animate-[ws-modal-in_250ms_ease]`; exit just unmounts.

**Complete modal width reference:**

| Dialog | Width |
| --- | --- |
| Save Checkpoint | `max-w-md` |
| Close Workspace | `max-w-sm` |
| Confirm | `max-w-sm` |
| SessionEdit | `max-w-md` |
| Features | `max-w-xl` |
| Generalist | `max-w-lg` |
| Messages Viewer | `max-w-lg` |
| Edit Preset | `max-w-sm` |
| NewSessionDialog | `max-w-lg` |
| InitializeProgressModal | `max-w-xl` |
| ImportSessionsDialog | `max-w-md` |
| RoutingDisambiguation | `max-w-md` |
| PromptDesignDialog | `max-w-lg` |
| DSLGenerationModal | `max-w-md` |

---

## Requirement 9 — Visual consistency rules (the enforcement table)

These are the canonical values. Every component above already conforms; use this as the review checklist.

| Rule | Value | Where encoded |
| --- | --- | --- |
| Tab active indicator | 2px accent bottom border (`border-b-2`  • accent) | Req 3 |
| Card radius | `rounded-lg` (cards) / `rounded-xl` (modals) | Req 4, 8 |
| Card padding | `p-3` standard, `p-4` detail/modal | Req 4, 8 |
| Button radius | `rounded-lg` | Req 7 `ToolbarButton` |
| Button padding | `px-3` (h-7) standard, `px-2` compact | Req 7 |
| Font sizes | `text-[10px]` metadata / `text-[11px]`–`text-xs` body / `text-sm` headings | throughout |
| Section spacing | `space-y-3` | `TabPanel`, `SectionCard` |
| Gaps | `gap-1.5` icon+label / `gap-2` button groups | throughout |
| Transition | `transition-colors duration-150` | every interactive class |
| Press | `active:scale-95` | every button |
| Badge | `px-1.5 py-0.5 rounded-md text-[10px] font-medium` | Req 7, badge spec below |
| Status dot | `w-1.5 h-1.5 rounded-full` | throughout |
| Scrollbar | `.ws-scroll` (thin) | index.css |

**Standard badge** (define once, reuse):

```tsx
function Badge({ tone = 'zinc', children }: { tone?: 'zinc' | 'blue' | 'green'; children: React.ReactNode }) {
	const tones = {
		zinc:  'bg-zinc-800 text-zinc-300',
		blue:  'bg-blue-500/15 text-blue-300',   // [SYSTEM] preset marker
		green: 'bg-green-500/15 text-green-300',
	}
	return (
		<span className={`px-1.5 py-0.5 rounded-md text-[10px] font-medium ${tones[tone]}`}>
			{children}
		</span>
	)
}
```

---

## Deliverable 1 — Before / After gallery

| Area | Before | After |
| --- | --- | --- |
| Sidebar container | `bg-gradient-to-b from-zinc-900/95 via-zinc-900/90 to-black/95 backdrop-blur-sm border-l` | `bg-zinc-950 ws-sidebar-edge` |
| Resize handle | `w-1` invisible until drag | `w-2` hit area + `w-px bg-zinc-800` line → `group-hover:bg-zinc-600` → `bg-cyan-400` on drag |
| Header | `bg-gradient-to-r from-cyan-500/[0.04]…`  • per-icon cyan/violet hovers, `py-2.5` | flat `h-9 border-b`, all icons `ws-icon-btn` (zinc-500→zinc-200) |
| Tab bar | 12 colored tabs, `border-b-2` always, `px-2 py-2` | neutral zinc tabs, accent only when active, `px-2.5 h-8`, green group hairline |
| Panel | `flex-1 overflow-y-auto p-2`, mixed inner padding | `TabPanel` w/ 2px left accent strip + `px-3 py-3 space-y-3 ws-scroll` |
| Project Stats | `bg-zinc-800/50 rounded-lg p-2` | `rounded-lg border border-zinc-800/60 bg-zinc-900 p-3` card |
| Session card | ad-hoc GlassCard variants | `rounded-lg border border-zinc-800/60 bg-zinc-900 p-3`  • 2px status left border |
| Configs sections | full accent-colored borders per section | `SectionCard` (neutral border + accent dot in header) |
| Toggle | `w-8 h-4` / `w-9 h-5` / `w-10 h-5` | one `Toggle` — `w-9 h-5`, cyan-on, zinc-off |
| Slider | raw range + scattered inline accents | `.ws-range` utility, accent via `--slider-accent` |
| Pills | divergent per-context styles | one `Pill` — active `bg-zinc-200 text-zinc-900` |
| Collapsed strip | `bg-gradient-to-b…`, random hover hues | `bg-zinc-950 ws-sidebar-edge` tool rack + `ws-tip` tooltips |
| Compose button | `from-purple-600 to-indigo-600` gradient | `ToolbarButton` primary (cyan) |
| Terminal tab | `px-3 py-1.5`, group top-border | `h-8`, 2px group top strip, hover-reveal close |
| Dialogs | mixed GlassCard/plain, `z-[100]` vs `z-[var(--z-overlay)]`, duplicated Confirm | one `Modal` shell, single overlay z, de-duplicated |
| Project selector | raw native `<select>` | `ws-select h-7 max-w-[180px]` |
| Project info badge | inline text | `h-7 px-2.5 rounded-lg border` with dot + tooltip |
| Open Terminal / Setup | inconsistently styled | `ToolbarButton` secondary (Plus / Wrench) |
| InstructionPanel | separate component, no card | `rounded-lg border border-zinc-800/60 bg-zinc-900 p-3 space-y-3` card |
| File lock count | ad-hoc badge | `px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400` |
| Session “S” indicator | ad-hoc badge | `px-1.5 py-0.5 rounded-md bg-cyan-500/15 text-cyan-400` |
| Error notification bar | various ad-hoc colors | `h-8 px-3` bar, `bg-*-500/10 border-*-500/20` |
| Empty terminal state | raw button | `EmptyState` (icon + title + hint + primary button) |
| Agent status overlay | raw centered div | `bg-zinc-950/60 backdrop-blur-sm`  • `animate-pulse` dot |
| Sessions header | no consistent pattern | `flex justify-between` with New/Import/Save/Load |
| NewSessionDialog | GlassCard or plain | `Modal` `max-w-lg` |
| InitializeProgressModal | GlassCard or plain | `Modal` `max-w-xl` with `SectionCard` groups |
| Other dialogs (Import, Routing, Prompt, DSL) | various | `Modal` template |
| RoutingToast | plain div | `rounded-lg border shadow-lg`  • `ws-modal-in` entrance |

## Deliverable 4 — Migration order

Do it in dependency order so shared primitives exist before consumers use them.

1. **Session 1 — Tokens & primitives.** Add the `@theme` + `@layer utilities` CSS (tokens, `.ws-range`, `.ws-scroll`, `.ws-tip`, `ws-modal-in`). Define the const strings/components: `ws-icon-btn`, `ws-select`, `Toggle`, `Pill`, `Badge`, `EmptyState`, `ToolbarButton`, `Modal`, `SectionCard`, `TabPanel` + the `TAB_ACTIVE` / `ACCENT_STRIP` maps. Nothing visually changes yet — pure groundwork.
2. **Session 2 — Sidebar shell (Req 1, 2, 3, 6).** Container bg + resize handle, header, tab bar (swap to the `TABS` array), collapsed strip. These are structural and low-risk.
3. **Session 3 — Panels (Req 4).** Wrap all 12 tabs in `TabPanel`, swap Project Stats + every empty state to the standards, convert Configs to `SectionCard`, restyle Presets/Sessions/Map/Analytics inline content. Largest session.
4. **Session 4 — Toolbar & terminal tabs (Req 7) + controls sweep (Req 5).** Replace Compose gradient + toolbar buttons, instruction/quick composer, terminal tab chrome; find/replace remaining raw toggles/sliders/selects/pills with the primitives.
5. **Session 5 — Dialogs (Req 8) + consistency pass (Req 9).** Route every dialog through `Modal`, delete the duplicate Confirm, then walk the Req 9 table top-to-bottom as a final audit.

**Dependency note:** Sessions 2–5 all import from Session 1. Within a session, sub-components (Issues/Files/Skills/Design/Context/Maintenance) only need their redundant outer padding removed — they can be touched last.

## Deliverable 5 — Edge cases

| Case | Handling |
| --- | --- |
| Tab flex-wrap | Every tab is fixed `h-8`; wrapped rows stack evenly. `-mb-px` keeps active underlines aligned to the container border on each row. `pt-1` gives the top row breathing room. |
| Narrow sidebar (240px min) | At 240px the tab bar wraps to ~3 rows — acceptable. Cards are fluid (`w-full`); `truncate` on names/paths prevents overflow. Project Stats `grid-cols-3` stays legible at 240px; if tighter, it can fall to `grid-cols-1` via no extra logic (content wraps). |
| Collapsed → expanded | `transition-[width] 200ms var(--ws-ease)` on the wrapper; collapsed `w-10` → `sidebarWidth`. Content cross-fade not needed — content mounts at end of transition (existing conditional render). |
| Empty states (all tabs) | Single `EmptyState` component; Presets/Sessions/History/Skills/Files each pass their own icon+title+hint. No more divergent strings. |
| Long session/terminal names | `truncate max-w-[120px]` (tabs) / `truncate` in cards; full text in `title` attr. |
| Many terminal tabs | Tab strip is horizontally scrollable (`overflow-x-auto ws-scroll`); `shrink-0` on each tab prevents squashing. |
| Active tab while wrapped | Accent underline travels with the tab to whatever row it wraps to — no fixed-position indicator to desync. |

## Deliverable 6 — Non-goals (we are NOT changing)

- **No files other than** `src/pages/TerminalPage.tsx` and `src/index.css` (plus the listed sub-components, *visual padding only*).
- **No** App.tsx, PageShell, Dashboard, Settings, Database, Browser, or any non-workspace page.
- **No** business logic, state, IPC, or event wiring — `activeTab`, `sidebarWidth`, `isResizing`, `mapListRatio`, drag-and-drop handlers, message queue, all untouched.
- **No** adding/removing features from any tab, and **no** moving content between tabs.
- **No** external UI libraries (Radix/shadcn/headless), **no** Framer Motion `whileHover`/spring, **no** box-shadow depth, **no** Tailwind v3 directives.
- **Not** restyling terminal internals (`TerminalLayout` / `PaneNode` / xterm theme), the pane hover overlay controls (split/close), or split-handle dragging — only the surrounding chrome.
- **In scope (corrected):** the terminal **error notification bar** (Gap D.1, §7.4) and **agent status overlay** (Gap D.3, §7.4) ARE visible workspace UI and are restyled — they are *not* terminal internals, so they no longer count as non-goals.
- **Not** changing the per-tab accent *colors* themselves (semantic wayfinding preserved) — only *where and how* they appear.