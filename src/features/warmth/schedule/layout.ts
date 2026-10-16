/**
 * SCHEDULE LAYOUT ENGINE — the config layer.
 *
 * The four panels (calendar, agenda, upcoming, todos) do not know where they
 * sit. A LAYOUT is only an assignment of panels to named slots. That is the
 * whole trick: preset switching, swapping and hiding are all the same operation
 * — rewrite the slot map — so they cannot drift apart, and a panel never grows a
 * conditional like `if (preset === 'focus')` that only one layout can exercise.
 *
 * CLOSED-ENDED ON PURPOSE. No free coordinates, no floating windows, no
 * arbitrary sizes: a panel is in exactly one slot or it is hidden, and its size
 * is a number clamped to a per-panel min/max. Every one of those would be a
 * layout the presets never anticipated and the screenshots never showed.
 */

export type PanelId = 'calendar' | 'agenda' | 'upcoming' | 'todos';
export type ViewMode = 'day' | 'week' | 'month';
export type PresetId = 'calendar-first' | 'today-first' | 'week-first' | 'focus';

export const PANEL_IDS: PanelId[] = ['calendar', 'agenda', 'upcoming', 'todos'];

export const PRESET_IDS: PresetId[] = ['calendar-first', 'today-first', 'week-first', 'focus'];

export const PRESET_LABEL: Record<PresetId, string> = {
  'calendar-first': 'Calendar first',
  'today-first': 'Today first',
  'week-first': 'Week first',
  focus: 'Focus',
};

/** Each panel names its own size limits; the resizer reads them, so a panel can
 *  never be dragged somewhere it has no room to draw. */
export const PANEL_META: Record<PanelId, {
  label: string;
  min: number;   // fraction of its slot
  max: number;
  snap: number[]; // fractions it snaps to while dragging
}> = {
  calendar: { label: 'Calendar', min: 0.35, max: 0.75, snap: [0.4, 0.5, 0.55, 0.6, 0.65, 0.7] },
  agenda:   { label: 'Day agenda', min: 0.3, max: 0.8, snap: [0.35, 0.45, 0.5, 0.6, 0.7] },
  upcoming: { label: 'Upcoming', min: 0.25, max: 0.7, snap: [0.3, 0.4, 0.5, 0.6] },
  todos:    { label: 'Todos', min: 0.25, max: 0.7, snap: [0.3, 0.4, 0.5, 0.6] },
};

/** Which panel occupies which slot, keyed by SLOT NAME — the same key space as
 *  `PRESET_SLOTS` here and `SLOT_CELL` in the shell. Keying this map by
 *  `PanelId` instead is what made `layout.slots['left']` undefined for every
 *  slot, so `cell()` returned null four times and the Schedule tab rendered its
 *  header and then an empty grid. */
export type SlotMap = Record<string, PanelId>;

export interface ScheduleLayout {
  preset: PresetId;
  /** Which panel occupies which slot. A swap is just a two-element rewrite. */
  slots: SlotMap;
  /** Hidden panels free their space for the others. */
  hidden: Partial<Record<PanelId, boolean>>;
  /** Split fraction per slot, 0..1. Absent = the preset's own default. */
  sizes: Partial<Record<string, number>>;
}

/** Slot names per preset. EVERY preset declares four slots, including Focus —
 *  three of Focus's are `drawer-*` and render inside the slide-in panel rather
 *  than on the page. Uniform slot counts mean swapping, hiding and sizing need
 *  no `if (preset === 'focus')` anywhere, and one preset can never be the odd
 *  one out that silently skips an invariant. */
export const PRESET_SLOTS: Record<PresetId, string[]> = {
  'calendar-first': ['left', 'right-top', 'right-mid', 'right-bottom'],
  'today-first': ['left', 'right-top', 'right-bottom-left', 'right-bottom-right'],
  'week-first': ['top', 'bottom-left', 'bottom-mid', 'bottom-right'],
  focus: ['stage', 'drawer-1', 'drawer-2', 'drawer-3'],
};

/** Every slot the preset declares, each holding the panel that belongs there.
 *  Slot names come from `PRESET_SLOTS` (`left`, `right-top`, `drawer-1`, …) and
 *  `PANEL_IDS` is in the matching order, so the two zip into a bijection. */
function identity(preset: PresetId = 'today-first'): SlotMap {
  const slots: SlotMap = {};
  PRESET_SLOTS[preset].forEach((slot, i) => {
    const panel = PANEL_IDS[i];
    if (panel) slots[slot] = panel;
  });
  return slots;
}

export function defaultLayout(preset: PresetId = 'today-first'): ScheduleLayout {
  return { preset, slots: identity(preset), hidden: {}, sizes: {} };
}

/** A layout loaded from storage is untrusted — it may predate a panel, or have
 *  been hand-edited. Anything unrecognised is dropped, never rendered. */
export function sanitizeLayout(raw: unknown): ScheduleLayout {
  const base = defaultLayout();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<ScheduleLayout>;

  const preset = PRESET_IDS.includes(r.preset as PresetId) ? (r.preset as PresetId) : base.preset;

  /* Slots are keyed by slot NAME, so they are rebuilt for the preset that was
     actually loaded — a map saved under one preset must not be read as if it
     belonged to another. */
  const slots: SlotMap = (() => {
    if (!r.slots || typeof r.slots !== 'object') return identity(preset);
    const stored = r.slots as Record<string, unknown>;
    const out: SlotMap = {};
    const seen = new Set<PanelId>();
    /* 1. Honour a stored placement when it names a real, not-yet-used panel.
          A rejected entry leaves its slot EMPTY rather than falling back to the
          preset default — that default may name a panel already placed, and two
          slots holding one panel is exactly what step 2 exists to prevent. */
    for (const slot of PRESET_SLOTS[preset]) {
      const p = stored[slot] as PanelId;
      if (PANEL_IDS.includes(p) && !seen.has(p)) { out[slot] = p; seen.add(p); }
    }
    /* 2. A panel the stored map left unplaced is restored into a free slot,
          never left out — "no slot" renders as an invisible orphan. */
    for (const p of PANEL_IDS) {
      if (seen.has(p)) continue;
      const free = PRESET_SLOTS[preset].find(s => !(s in out));
      if (!free) break;
      out[free] = p;
      seen.add(p);
    }
    return out;
  })();

  const hidden: Partial<Record<PanelId, boolean>> = {};
  if (r.hidden && typeof r.hidden === 'object') {
    for (const p of PANEL_IDS) if ((r.hidden as any)[p] === true) hidden[p] = true;
  }

  const sizes: Record<string, number> = {};
  if (r.sizes && typeof r.sizes === 'object') {
    for (const [k, v] of Object.entries(r.sizes)) {
      const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
      // Clamp on LOAD, not only on drag: a stored value that no longer fits the
      // panel's current limits must not be honoured.
      /* `k` is a SLOT name, so the panel is the one placed in that slot. The
         previous `PANEL_IDS.find(p => k.includes(p))` could never match a slot
         name, so every stored size skipped its clamp. */
      const panel = slots[k];
      const meta = panel ? PANEL_META[panel] : null;
      sizes[k] = meta ? Math.min(meta.max, Math.max(meta.min, n)) : n;
    }
  }

  return { preset, slots, hidden, sizes };
}

/** The rule every mutation funnels through. Two panels trade places; nothing
 *  moves, nothing floats, and a panel that is hidden can still be swapped. */
export function swapPanels(layout: ScheduleLayout, a: PanelId, b: PanelId): ScheduleLayout {
  if (a === b) return layout;
  const slots = { ...layout.slots };
  const slotA = Object.keys(slots).find(s => slots[s] === a);
  const slotB = Object.keys(slots).find(s => slots[s] === b);
  if (!slotA || !slotB) return layout;
  slots[slotA] = b;
  slots[slotB] = a;
  return { ...layout, slots };
}

export function toggleHidden(layout: ScheduleLayout, panel: PanelId): ScheduleLayout {
  const hidden = { ...layout.hidden };
  if (hidden[panel]) delete hidden[panel];
  else hidden[panel] = true;
  return { ...layout, hidden };
}

/** Dragging a divider produces a raw fraction; it is clamped to the panel's
 *  declared window here so the caller cannot bypass the limits. */
export function setSlotSize(layout: ScheduleLayout, slot: string, raw: number): ScheduleLayout {
  const panel = layout.slots[slot];
  const meta = panel ? PANEL_META[panel] : null;
  if (!meta) return layout;
  const v = Math.min(meta.max, Math.max(meta.min, Number.isFinite(raw) ? raw : meta.min));
  return { ...layout, sizes: { ...layout.sizes, [slot]: v } };
}

export function snapSize(layout: ScheduleLayout, slot: string, raw: number): number {
  const panel = layout.slots[slot];
  const meta = panel ? PANEL_META[panel] : null;
  if (!meta) return raw;
  let best = meta.snap[0];
  let bestD = Infinity;
  for (const s of meta.snap) {
    const d = Math.abs(s - raw);
    if (d < bestD) { bestD = d; best = s; }
  }
  return Math.min(meta.max, Math.max(meta.min, best));
}

export function isHidden(layout: ScheduleLayout, panel: PanelId): boolean {
  return layout.hidden[panel] === true;
}

/** Focus hides three of the four into a drawer; the other presets must not be
 *  silently emptied by a hidden set carried over from Focus. */
export function panelsVisibleIn(layout: ScheduleLayout, preset: PresetId): PanelId[] {
  if (preset === 'focus') return isHidden(layout, 'calendar') ? [] : ['calendar'];
  return PANEL_IDS.filter(p => !isHidden(layout, p));
}

const KEY = 'schedule:layout:v1';

export async function loadLayout(): Promise<ScheduleLayout> {
  try {
    const api = (window as any).deskflowAPI;
    const res = await api?.compositionsSettingsGet?.(KEY);
    if (!res) return defaultLayout();
    const parsed = typeof res === 'string' ? JSON.parse(res) : res;
    return sanitizeLayout(parsed);
  } catch {
    return defaultLayout();
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced so a drag does not write on every frame. The write is still
 *  guaranteed: the last call wins because the timer is replaced, not queued. */
export function saveLayout(layout: ScheduleLayout): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const api = (window as any).deskflowAPI;
      api?.compositionsSettingsSet?.(KEY, JSON.stringify(layout));
    } catch { /* persistence is best-effort; the session still works */ }
  }, 220);
}
