import {
  defaultLayout, withPreset, sanitizeLayout, swapPanels, toggleHidden, setSlotSize,
  snapSize, isHidden, panelsVisibleIn, PRESET_SLOTS, PANEL_IDS,
  PANEL_META, PRESET_IDS, type PanelId,
} from '../features/warmth/schedule/layout';
/* The shell's grid data is the other half of the same contract: a slot is only
 * drawable if SLOT_CELL names an area its preset's GRIDS actually declares. */
import { GRIDS, SLOT_CELL } from '../features/warmth/schedule/ScheduleLayoutShell';

/* `slots` is keyed by SLOT NAME (`PRESET_SLOTS`), NOT by panel id — `cell()`
 * reads `layout.slots[slot]` and `SLOT_CELL[preset][slot]` from the same key.
 * These helpers keep every assertion honest about which of the two it means. */
const slotOf = (l: { slots: Record<string, PanelId> }, panel: PanelId): string =>
  Object.keys(l.slots).find(s => l.slots[s] === panel) as string;

/* Every preset must place all four panels into real slots. A layout that
 * leaves a panel unplaced renders it nowhere, which is how "the goals UI is
   missing" happened once already in this repo. */

describe('layout engine — presets place every panel', () => {
  it('every preset declares 4 slots', () => {
    for (const p of PRESET_IDS) expect(PRESET_SLOTS[p]).toHaveLength(4);
  });

  it('default layout places every panel in a declared slot of its preset', () => {
    const l = defaultLayout();
    /* This previously asserted `l.slots[panelId] === panelId`, which LOCKED IN
       the panel-id key space. That is the bug that made the Schedule tab render
       an empty grid while this suite stayed green, so the assertion is now about
       the slot names the preset actually declares. */
    expect(Object.keys(l.slots).sort()).toEqual([...PRESET_SLOTS[l.preset]].sort());
    expect(new Set(Object.values(l.slots))).toEqual(new Set(PANEL_IDS));
    for (const slot of Object.keys(l.slots)) expect(PANEL_IDS).toContain(l.slots[slot]);
  });

  it('Focus shows only the calendar, everything else goes to the drawer', () => {
    expect(panelsVisibleIn(defaultLayout('focus'), 'focus')).toEqual(['calendar']);
  });

  it('withPreset rebuilds the slot map for the new preset', () => {
    /* Regression. The shell used to commit `{ ...layout, preset }`, which kept
       the OLD preset's slot names. Slots are keyed by name and every preset
       declares its own, so each slot the new preset names read undefined and
       `cell()` returned null — measured on the live bundle as week-first and
       focus rendering 0 of 4 panels. */
    const l = withPreset(defaultLayout('today-first'), 'week-first');
    expect(l.preset).toBe('week-first');
    expect(Object.keys(l.slots).sort()).toEqual([...PRESET_SLOTS['week-first']].sort());
    for (const slot of Object.keys(l.slots)) {
      expect(PANEL_IDS).toContain(l.slots[slot]);
      expect(SLOT_CELL['week-first'][slot] !== undefined).toBeTruthy();
    }
    /* hidden is keyed by panel, so it survives a preset switch */
    const hidden = withPreset(toggleHidden(defaultLayout(), 'todos'), 'calendar-first');
    expect(hidden.hidden).toEqual({ todos: true });
  });

  it('a layout hidden in Focus does not empty the other presets', () => {
    let l = defaultLayout();
    l = toggleHidden(l, 'upcoming');
    l = toggleHidden(l, 'todos');
    l = { ...l, preset: 'focus' };
    expect(panelsVisibleIn(l, 'focus')).toEqual(['calendar']);
    // switching to Today first restores a populated screen
    expect(panelsVisibleIn(l, 'today-first').length).toBeGreaterThan(0);
  });

  it('hiding the calendar in Focus leaves nothing, rather than crashing', () => {
    const l = toggleHidden(defaultLayout('focus'), 'calendar');
    expect(panelsVisibleIn(l, 'focus')).toEqual([]);
  });
});

describe('layout engine — swapping', () => {
  it('two panels trade places and nothing else moves', () => {
    const before = defaultLayout();
    const after = swapPanels(before, 'calendar', 'todos');
    expect(slotOf(after, 'todos')).toBe(slotOf(before, 'calendar'));
    expect(slotOf(after, 'calendar')).toBe(slotOf(before, 'todos'));
    expect(slotOf(after, 'agenda')).toBe(slotOf(before, 'agenda'));
    expect(slotOf(after, 'upcoming')).toBe(slotOf(before, 'upcoming'));
  });

  it('is its own inverse', () => {
    const l = defaultLayout();
    const once = swapPanels(l, 'calendar', 'upcoming');
    expect(swapPanels(once, 'calendar', 'upcoming')).toEqual(l);
  });

  it('swapping a panel with itself changes nothing', () => {
    const l = defaultLayout();
    expect(swapPanels(l, 'agenda', 'agenda')).toEqual(l);
  });

  it('swapping an unknown panel is a no-op, not a corruption', () => {
    const l = defaultLayout();
    expect(swapPanels(l, 'calendar', 'nope' as PanelId)).toEqual(l);
  });

  it('can swap a HIDDEN panel — hidden is not unplaced', () => {
    let l = toggleHidden(defaultLayout(), 'todos');
    l = swapPanels(l, 'calendar', 'todos');
    expect(slotOf(l, 'todos')).toBe(slotOf(defaultLayout(), 'calendar'));
    expect(isHidden(l, 'todos')).toBe(true);   // visibility travels with the slot's panel
  });
});

describe('layout engine — hiding', () => {
  it('toggles both ways and does not accumulate junk keys', () => {
    let l = toggleHidden(defaultLayout(), 'upcoming');
    expect(isHidden(l, 'upcoming')).toBe(true);
    l = toggleHidden(l, 'upcoming');
    expect(isHidden(l, 'upcoming')).toBe(false);
    expect(Object.keys(l.hidden)).toHaveLength(0);
  });

  it('hiding one panel leaves the rest visible', () => {
    const l = toggleHidden(defaultLayout(), 'calendar');
    expect(panelsVisibleIn(l, 'today-first')).not.toContain('calendar');
    expect(panelsVisibleIn(l, 'today-first')).toHaveLength(3);
  });
});

describe('layout engine — resize limits', () => {
  it('clamps to the panel min', () => {
    const base = defaultLayout();
    const slot = slotOf(base, 'calendar');
    const l = setSlotSize(base, slot, 0.01);
    expect(l.sizes[slot]).toBe(PANEL_META.calendar.min);
  });

  it('clamps to the panel max', () => {
    const base = defaultLayout();
    const slot = slotOf(base, 'calendar');
    const l = setSlotSize(base, slot, 5);
    expect(l.sizes[slot]).toBe(PANEL_META.calendar.max);
  });

  it('snaps to the nearest allowed step', () => {
    const l = defaultLayout();
    const snapped = snapSize(l, slotOf(l, 'calendar'), 0.52);
    expect(PANEL_META.calendar.snap).toContain(snapped);
  });

  it('a snapped value is always inside the limits', () => {
    const l = defaultLayout();
    for (const slot of Object.keys(l.slots)) {
      const meta = PANEL_META[l.slots[slot]];
      for (const raw of [0, 0.2, 0.45, 0.99, 1]) {
        const s = snapSize(l, slot, raw);
        expect(s).toBeGreaterThanOrEqual(meta.min);
        expect(s).toBeLessThanOrEqual(meta.max);
      }
    }
  });

  it('an unknown slot is ignored rather than stored', () => {
    const l = setSlotSize(defaultLayout(), 'nowhere', 0.5);
    expect(l.sizes).toEqual({});
  });

  it('limits follow the panel that LANDED in the slot, after a swap', () => {
    // The slot's panel changed, so the clamp must be re-derived, not reused.
    let l = swapPanels(defaultLayout(), 'calendar', 'todos');
    const slot = slotOf(l, 'todos');               // the calendar slot now holds 'todos'
    l = setSlotSize(l, slot, 0.9);
    expect(l.sizes[slot]).toBe(PANEL_META.todos.max);
  });
});

describe('layout engine — sanitize (untrusted storage)', () => {
  it('falls back to defaults on junk', () => {
    expect(sanitizeLayout(null)).toEqual(defaultLayout());
    expect(sanitizeLayout('nope')).toEqual(defaultLayout());
    expect(sanitizeLayout(42)).toEqual(defaultLayout());
  });

  it('drops an unknown preset', () => {
    expect(sanitizeLayout({ preset: 'warp-drive' }).preset).toBe('today-first');
  });

  it('restores a panel that a hand-edited map left unplaced', () => {
    // `left` and `right-top` really are slot names in the default preset.
    const l = sanitizeLayout({ slots: { left: 'agenda', 'right-top': 'calendar' } });
    for (const p of PANEL_IDS) expect(Object.values(l.slots)).toContain(p);
  });

  it('rejects a slot pointing at a panel already placed twice', () => {
    const l = sanitizeLayout({ slots: { left: 'agenda', 'right-top': 'agenda' } });
    const placed = Object.values(l.slots);
    expect(new Set(placed).size).toBe(4);   // no duplicates survive
    expect(placed).toContain('calendar');   // and the evicted panel is restored
  });

  it('clamps a stored size that no longer fits its limits', () => {
    // `sizes` is keyed by SLOT name, like `slots` itself, and the limits come
    // from the panel that slot holds. In today-first the calendar is `right-top`
    // (`left` is the agenda's full-height column), so that is the slot whose
    // stored 99% must clamp to the CALENDAR's max — not to whatever panel
    // happens to sit first in the slot list.
    const l = sanitizeLayout({ sizes: { 'right-top': 99 } });
    expect(l.sizes['right-top']).toBe(PANEL_META.calendar.max);
  });

  it('ignores a non-numeric stored size instead of rendering NaN', () => {
    const l = sanitizeLayout({ sizes: { left: 'wide' } });
    // the value must be a usable number, not NaN — NaN in a flex-basis silently
    // collapses the panel to zero width with no error anywhere
    expect(typeof l.sizes.left).toBe('number');
    expect(Number.isNaN(l.sizes.left)).toBe(false);
    expect(l.sizes.left).toBeGreaterThan(0);
  });

  it('keeps only boolean hidden flags', () => {
    const l = sanitizeLayout({ hidden: { calendar: 'yes', agenda: true } });
    expect(l.hidden).toEqual({ agenda: true });
  });

  it('round-trips a valid layout unchanged', () => {
    const l = swapPanels(toggleHidden(defaultLayout(), 'todos'), 'calendar', 'agenda');
    expect(sanitizeLayout(JSON.parse(JSON.stringify(l)))).toEqual(l);
  });
});

describe('layout engine — persistence shape', () => {
  it('survives a restart with the same slots, hidden set and sizes', () => {
    let l = defaultLayout('week-first');
    l = swapPanels(l, 'agenda', 'upcoming');
    l = toggleHidden(l, 'todos');
    l = setSlotSize(l, 'top', 0.62);

    const restored = sanitizeLayout(JSON.parse(JSON.stringify(l)));
    expect(restored.preset).toBe('week-first');
    // the swap survived the round-trip: `upcoming` is where `agenda` started
    expect(slotOf(restored, 'upcoming')).toBe(slotOf(defaultLayout('week-first'), 'agenda'));
    expect(isHidden(restored, 'todos')).toBe(true);
    expect(restored.sizes.top).toBeCloseTo(0.62, 5);
  });
});

describe('layout engine — shell contract (slot name is the join key)', () => {
  /* The exact defect this locks out: `identity()` keyed `slots` by PANEL id
     while `cell()` looks it up by SLOT name, so `layout.slots['left']` was
     undefined for every slot, `cell()` returned null four times, and the
     Schedule tab rendered its header and then an empty grid. */
  it('every slot of every preset resolves to a panel', () => {
    for (const preset of PRESET_IDS) {
      const l = defaultLayout(preset);
      const names = PRESET_SLOTS[preset];
      expect(Object.keys(l.slots).sort()).toEqual([...names].sort());
      for (const name of names) expect(PANEL_IDS).toContain(l.slots[name]);
      expect(new Set(Object.values(l.slots)).size).toBe(names.length);
    }
  });

  /* And the second defect: `today-first` named `bl`/`br` areas that its grid
     template never declared, so those two panels fell into IMPLICIT tracks.
     `drawer-*` slots are skipped — they render inside the Focus drawer, whose
     container is not this grid, so their `gridArea` is inert. */
  it('every grid area a slot names is declared by the preset template', () => {
    for (const preset of PRESET_IDS) {
      /* An ARRAY, not a Set: the runner's `toContain` is `includes`, so it
         renders a Set as `{}` and the failure reads as an empty collection. */
      const areas = GRIDS[preset].areas
        .match(/"[^"]+"/g)!
        .flatMap(row => row.replace(/"/g, '').split(/\s+/));
      for (const slot of PRESET_SLOTS[preset]) {
        if (slot.startsWith('drawer')) continue;
        expect(areas).toContain(SLOT_CELL[preset][slot]);
      }
    }
  });
});