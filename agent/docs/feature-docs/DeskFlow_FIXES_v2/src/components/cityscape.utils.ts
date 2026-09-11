import * as THREE from "three";
import type { CityLayout, HeroInput } from "./cityscape/cityGen";
import { generateCity } from "./cityscape/cityGen";

const AGENT_COLORS: Record<string, string> = {
  "claude-code": "#f97316",
  cursor: "#a855f7",
  opencode: "#3b82f6",
  gemini: "#22c55e",
  codex: "#10b981",
  qwen: "#f59e0b",
  aider: "#f59e0b",
  kilocode: "#22c55e",
};

export function agentColor(agentId: string): string {
  return AGENT_COLORS[agentId] || hashColor(agentId);
}

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 55%)`;
}

export function neon(hex: string, gain = 4): THREE.Color {
  return new THREE.Color(hex).multiplyScalar(gain);
}

const MODEL_PREFIXES: Record<string, string> = {
  claude: "claude",
  gpt: "gpt",
  gemini: "gemini",
  sonnet: "claude-sonnet",
  opus: "claude-opus",
  haiku: "claude-haiku",
};

export function modelFamily(name: string): string {
  const lower = name.toLowerCase();
  for (const [prefix, family] of Object.entries(MODEL_PREFIXES)) {
    if (lower.startsWith(prefix)) return family;
  }
  return lower
    .replace(/-\d{8,}.*$/, "")
    .replace(/v?\d+\.\d+.*$/, "")
    .trim();
}

const WINDOW_POOL: (THREE.CanvasTexture | null)[] = [];

export function getWindowTexture(
  litRatio: number,
  tint = "#bfe9ff",
): THREE.CanvasTexture {
  const idx = Math.min(Math.floor(litRatio / 0.2), 4);
  if (!WINDOW_POOL[idx]) {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 128;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#04060c";
    ctx.fillRect(0, 0, 64, 128);
    const cols = 6,
      rows = 14,
      pad = 4;
    const cw = (64 - pad * (cols + 1)) / cols;
    const ch = (128 - pad * (rows + 1)) / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const lit = Math.random() < litRatio;
        ctx.globalAlpha = lit ? 0.6 + Math.random() * 0.4 : 1;
        ctx.fillStyle = lit ? tint : "#0a0f1a";
        ctx.fillRect(pad + x * (cw + pad), pad + y * (ch + pad), cw, ch);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    WINDOW_POOL[idx] = tex;
  }
  return WINDOW_POOL[idx]!;
}

export function disposeWindowPool(): void {
  for (const t of WINDOW_POOL) if (t) t.dispose();
}

export interface BuildingDef {
  id: string;
  label: string;
  height: number;
  footprint: number;
  color: string;
  metricValue: number;
  cost: number;
  agentId?: string;
  active: boolean;
  messageCount: number;
  sessions: number;
  models: string[];
}

export interface PlacedBuilding extends BuildingDef {
  x: number;
  z: number;
  roofKind?: RoofKind;
  patternRow?: number;
}

export function hash01(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h << 5) - h + key.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h % 10000) / 10000;
}

export type RoofKind = "flat" | "pyramid" | "antenna";

export function roofFor(height: number, id: string): RoofKind {
  if (height > 11 && hash01(id) > 0.45) return "antenna";
  if (height > 5 && hash01(id + "p") > 0.6) return "pyramid";
  return "flat";
}

export function heightFor(tokens: number, maxTokens: number): number {
  const t = Math.log1p(tokens) / Math.log1p(Math.max(maxTokens, 1));
  const shaped = Math.pow(t, 0.72);
  return THREE.MathUtils.lerp(0.6, 16, shaped);
}

export function footprintFor(sessions: number, maxSessions: number): number {
  const s = Math.sqrt(sessions / Math.max(maxSessions, 1));
  // Capped so footprints stay well inside the 11-unit grid pitch (no overlap).
  return THREE.MathUtils.clamp(2.0 + s * 2.2, 2.0, 4.2);
}

export function buildingColor(agentId: string, idx: number): string {
  const base = new THREE.Color(agentColor(agentId));
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);
  const j = hash01(agentId + ":" + idx) - 0.5;
  hsl.h = (hsl.h + j * 0.04 + 1) % 1;
  hsl.l = THREE.MathUtils.clamp(hsl.l + j * 0.22, 0.18, 0.7);
  return new THREE.Color()
    .setHSL(hsl.h, Math.min(hsl.s + 0.1, 1), hsl.l)
    .getStyle();
}

export function patternRow(agentId: string): number {
  const lower = agentId.toLowerCase();
  if (
    lower.includes("claude") ||
    lower.includes("sonnet") ||
    lower.includes("opus")
  )
    return 0;
  if (
    lower.includes("gpt") ||
    lower.includes("gemini") ||
    lower.includes("qwen")
  )
    return 1;
  return 2;
}

export function layoutGrid(buildings: BuildingDef[]): PlacedBuilding[] {
  const pitch = 11;
  const cols = Math.ceil(Math.sqrt(buildings.length));
  const half = ((cols - 1) * pitch) / 2;
  return buildings.map((b, i) => {
    const gx = i % cols,
      gz = Math.floor(i / cols);
    const jx = (hash01(b.id) - 0.5) * (pitch * 0.06);
    const jz = (hash01(b.id + "z") - 0.5) * (pitch * 0.06);
    return { ...b, x: gx * pitch - half + jx, z: gz * pitch - half + jz };
  });
}

export interface CityModel {
  buildings: PlacedBuilding[];
  metricMax: number;
  costMax: number;
  cityLayout?: CityLayout;
}

export function buildCityModel(
  overview: any,
  mode: "agent" | "model" | "time",
  metric: string,
  timeDate?: string,
  allDates?: string[],
  buildupIndex?: number,
): CityModel {
  const byTool = overview?.aiUsage?.byTool || {};
  const toolIds = Object.keys(byTool);
  const metricField = metric === "messages" ? "messageCount" : metric;

  if (mode === "agent" || mode === "time") {
    const defs: BuildingDef[] = [];
    let metricMax = 0,
      costMax = 0;

    for (const toolId of toolIds) {
      const tool = byTool[toolId];
      let value = 0,
        cost = 0;
      if (mode === "time" && timeDate) {
        if (
          buildupIndex !== undefined &&
          buildupIndex >= 0 &&
          allDates &&
          allDates.length > 0
        ) {
          for (let di = 0; di <= buildupIndex && di < allDates.length; di++) {
            const day = tool.daily?.[allDates[di]] || {};
            value += metric === "cost" ? day.cost || 0 : day[metricField] || 0;
            cost += day.cost || 0;
          }
        } else {
          const day = tool.daily?.[timeDate] || {};
          value = metric === "cost" ? day.cost || 0 : day[metricField] || 0;
          cost = day.cost || 0;
        }
      } else {
        value = metric === "cost" ? tool.cost || 0 : tool[metricField] || 0;
        cost = tool.cost || 0;
      }
      if (value > metricMax) metricMax = value;
      if (cost > costMax) costMax = cost;
      const lastUsed = tool.lastUsed ? new Date(tool.lastUsed).getTime() : 0;
      defs.push({
        id: toolId,
        label: toolId,
        height: 0,
        footprint: 0,
        color: buildingColor(toolId, defs.length),
        metricValue: value,
        cost,
        agentId: toolId,
        active: lastUsed > 0 && Date.now() - lastUsed < 86400000,
        messageCount: tool.messageCount || 0,
        sessions: tool.sessions || 0,
        models: tool.models || [],
      });
    }

    for (const b of defs) {
      b.height = heightFor(b.metricValue, metricMax);
      b.footprint = footprintFor(b.sessions, costMax);
    }
    const placed = layoutGrid(defs).map((p) => ({
      ...p,
      roofKind: roofFor(p.height, p.id),
      patternRow: patternRow(p.agentId || p.id),
    }));
    const heroInputs: HeroInput[] = defs.map((b) => ({
      id: b.id,
      height01: b.metricValue / Math.max(metricMax, 1),
      weight: b.sessions,
      label: b.label,
      color: b.color,
      metricValue: b.metricValue,
      active: b.active,
    }));
    const cityLayout = generateCity({
      seed: `deskflow-${mode}-${metric}-${timeDate ?? "all"}`,
      heroes: heroInputs,
    });
    return { buildings: placed, metricMax, costMax, cityLayout };
  }

  if (mode === "model") {
    const modelMap = new Map<
      string,
      {
        tokens: number;
        messages: number;
        sessions: number;
        cost: number;
        agents: Set<string>;
        models: string[];
      }
    >();
    for (const toolId of toolIds) {
      const tool = byTool[toolId];
      const breakdown = tool.modelBreakdown || [];
      for (const entry of breakdown) {
        const family = modelFamily(entry.model || entry.name || toolId);
        if (!modelMap.has(family)) {
          modelMap.set(family, {
            tokens: 0,
            messages: 0,
            sessions: 0,
            cost: 0,
            agents: new Set(),
            models: [],
          });
        }
        const m = modelMap.get(family)!;
        m.tokens += entry.tokens || 0;
        m.messages += entry.messageCount || 0;
        m.sessions += entry.sessions || 0;
        m.cost += entry.cost || 0;
        m.agents.add(toolId);
        m.models.push(entry.model || entry.name || "");
      }
    }
    const defs: BuildingDef[] = [];
    let metricMax = 0,
      costMax = 0;
    for (const [family, data] of modelMap.entries()) {
      const value =
        metric === "cost"
          ? data.cost
          : metric === "messages"
            ? data.messages
            : metric === "tokens"
              ? data.tokens
              : data.sessions;
      if (value > metricMax) metricMax = value;
      if (data.cost > costMax) costMax = data.cost;
      const primaryAgent = data.agents.values().next().value || "unknown";
      defs.push({
        id: family,
        label: family,
        height: 0,
        footprint: 0,
        color: buildingColor(primaryAgent, defs.length),
        metricValue: value,
        cost: data.cost,
        agentId: primaryAgent,
        active: false,
        messageCount: data.messages,
        sessions: data.sessions,
        models: Array.from(data.models).slice(0, 5),
      });
    }
    for (const b of defs) {
      b.height = heightFor(b.metricValue, metricMax);
      b.footprint = footprintFor(b.sessions, costMax);
    }
    const placed = layoutGrid(defs).map((p) => ({
      ...p,
      roofKind: roofFor(p.height, p.id),
      patternRow: patternRow(p.agentId || p.id),
    }));
    const heroInputs: HeroInput[] = defs.map((b) => ({
      id: b.id,
      height01: b.metricValue / Math.max(metricMax, 1),
      weight: b.sessions,
      label: b.label,
      color: b.color,
      metricValue: b.metricValue,
      active: b.active,
    }));
    const cityLayout = generateCity({
      seed: `deskflow-${mode}`,
      heroes: heroInputs,
    });
    return { buildings: placed, metricMax, costMax, cityLayout };
  }

  return { buildings: [], metricMax: 0, costMax: 0 };
}

export function extractDateRange(overview: any): string[] {
  const byTool = overview?.aiUsage?.byTool || {};
  const dateSet = new Set<string>();
  for (const tool of Object.values(byTool) as any[]) {
    if (tool.daily) {
      for (const dateStr of Object.keys(tool.daily)) {
        dateSet.add(dateStr);
      }
    }
  }
  return Array.from(dateSet).sort();
}

export function formatMetricValue(value: number, metric: string): string {
  if (metric === "cost") return `$${value.toFixed(4)}`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

/* ------------------------------------------------------------------ */
/*  Window atlas + per-building helpers (RESULT_VISUAL_OVERHAUL §3)    */
/* ------------------------------------------------------------------ */

export const WINDOW_LIT_STEPS = [0.12, 0.32, 0.52, 0.72, 0.9] as const;

export const GRID = {
  base: "#05070f",
  grid: "#0bd7ff",
  street: "#7c3aed",
  pulse: "#ff3d81",
  scale: 2.2,
  rings: 9,
  spokes: 24,
} as const;

export const PALETTE = {
  shell: "#141826",
  roof: "#00eaff",
  fog: "#0a0c18",
} as const;

let _atlas: {
  texture: THREE.CanvasTexture;
  cols: number;
  rows: number;
} | null = null;

export type WindowAtlasQuality = "cinematic" | "balanced" | "performance";

export const WINDOW_PATTERN_COUNT = 3;

export function resetWindowAtlasCache(): void {
  if (_atlas) {
    _atlas.texture.dispose();
    _atlas = null;
  }
}

export function buildWindowAtlas(
  quality: WindowAtlasQuality = "balanced",
  tint = "#bfe9ff",
  windowTextures?: (THREE.Texture | null)[],
) {
  if (!windowTextures && _atlas) return _atlas;
  const cellH =
    quality === "performance" ? 32 : quality === "balanced" ? 64 : 128;
  const cellW = cellH / 2;
  const cols = WINDOW_LIT_STEPS.length;
  const rows = WINDOW_PATTERN_COUNT;
  const canvas = document.createElement("canvas");
  canvas.width = cellW * cols;
  canvas.height = cellH * rows;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#04060c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let pat = 0; pat < rows; pat++) {
    WINDOW_LIT_STEPS.forEach((ratio, ci) => {
      const imgIdx = pat * cols + ci;
      const tex =
        windowTextures && imgIdx < windowTextures.length
          ? windowTextures[imgIdx]
          : null;
      if (tex && tex.image && (tex.image as HTMLImageElement).complete) {
        drawCompositeCell(
          ctx,
          ci * cellW,
          pat * cellH,
          cellW,
          cellH,
          tex.image as HTMLImageElement,
          ratio,
        );
      } else {
        drawWindowCell(
          ctx,
          ci * cellW,
          pat * cellH,
          cellW,
          cellH,
          ratio,
          pat,
          tint,
        );
      }
    });
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  if (!windowTextures) {
    _atlas = { texture, cols, rows };
  }
  return { texture, cols, rows };
}

function drawWindowCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  litRatio: number,
  pattern: number,
  tint: string,
) {
  const pad = Math.max(2, Math.floor(w / 16));
  let cols = 6,
    rows = 14;
  if (pattern === 1) {
    cols = 8;
    rows = 10;
  }
  if (pattern === 2) {
    cols = 4;
    rows = 8;
  }
  const cw = (w - pad * (cols + 1)) / cols;
  const ch = (h - pad * (rows + 1)) / rows;
  ctx.fillStyle = "#0a0f1a";
  ctx.fillRect(x, y, w, h);
  for (let ry = 0; ry < rows; ry++) {
    for (let rx = 0; rx < cols; rx++) {
      const lit = Math.random() < litRatio;
      if (pattern === 1 && (rx + ry) % 2 === 0 && !lit) continue;
      if (pattern === 2 && rx > 1 && ry < rows - 2 && !lit) continue;
      ctx.globalAlpha = lit ? 0.6 + Math.random() * 0.4 : 0.7;
      ctx.fillStyle = lit ? tint : "#0a0f1a";
      ctx.fillRect(
        x + pad + rx * (cw + pad),
        y + pad + ry * (ch + pad),
        cw,
        ch,
      );
    }
  }
  ctx.globalAlpha = 1;
}

function drawCompositeCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  img: HTMLImageElement,
  litRatio: number,
) {
  ctx.drawImage(img, x, y, w, h);
  ctx.globalAlpha = 0.3 + litRatio * 0.5;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
}

export function disposeWindowAtlas(): void {
  if (_atlas) {
    _atlas.texture.dispose();
    _atlas = null;
  }
}

export const windowBucket = (lit: number) =>
  Math.min(
    WINDOW_LIT_STEPS.length - 1,
    Math.floor(lit * WINDOW_LIT_STEPS.length),
  );

export const tileRowsFor = (height: number) =>
  THREE.MathUtils.clamp(Math.round(height * 1.6), 3, 26);

export function litRatioFor(b: PlacedBuilding) {
  const base = b.active ? 0.55 : 0.18;
  const byData = THREE.MathUtils.clamp(b.height / 16, 0, 1) * 0.4;
  return THREE.MathUtils.clamp(base + byData, 0.1, 0.9);
}
