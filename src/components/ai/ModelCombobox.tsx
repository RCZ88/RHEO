// ModelCombobox — the one "type, then select" control for every model field.
//
// Why this exists: models used to be entered as a comma-separated string in the
// provider editor ("auto, fast, reasoning") and picked from a bare <select> in
// the routing modal. Neither lets you TYPE a model name and SEE it match — this
// is the input shape the user asked for ("the model is inserted through typing
// then selecting, with a proper list to store those").
//
// Two shapes, one interaction contract:
//   <ModelSelect>  string   — pick ONE model (per-feature assignment)
//   <ModelsField>  string[] — store MANY models (a provider's model list)
//
// Dependency-free by design: the shadcn registry's combobox requires `cmdk` or
// `@base-ui/react` (neither is installed in this app) and this control lives
// inside an existing dialog, so it needs no portal. The interaction contract
// is the canonical one: focus opens the list, typing filters, ArrowUp/Down
// walk options, Enter picks, Escape closes, Backspace-on-empty removes a chip.
//
// House rules: radii {8px, pill}, ONE signal hue (var(--page-accent)), mono
// for model ids, focus-visible rings, nothing animates.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";

const FIELD_STYLE: CSSProperties = {
  background: "var(--color-background)",
  border: "1px solid var(--ws-border)",
  color: "var(--color-foreground)",
};

const MENU_STYLE: CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--ws-border-strong)",
  borderRadius: 8,
  boxShadow: "0 10px 26px color-mix(in srgb, black 38%, transparent)",
};

/** Case-insensitive filter; prefix matches rank before substring matches. */
function rankOptions(options: string[], query: string): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const o of options) {
    if (!seen.has(o)) {
      seen.add(o);
      unique.push(o);
    }
  }
  const q = query.trim().toLowerCase();
  if (!q) return unique;
  const starts: string[] = [];
  const contains: string[] = [];
  for (const o of unique) {
    const lo = o.toLowerCase();
    if (lo.startsWith(q)) starts.push(o);
    else if (lo.includes(q)) contains.push(o);
  }
  return [...starts, ...contains];
}

/** Close-on-outside-click for a menu anchored inside the returned wrapper. */
function useClickOutside(onOutside: () => void) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && e.target instanceof Node && !wrapRef.current.contains(e.target)) {
        onOutside();
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onOutside]);
  return wrapRef;
}

interface OptionRowProps {
  label: string;
  active: boolean;
  onHover: () => void;
  onPick: () => void;
  icon?: "check" | "plus";
  hint?: string;
}

function OptionRow({ label, active, onHover, onPick, icon, hint }: OptionRowProps) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onMouseDown={(e) => e.preventDefault()}
      onMouseEnter={onHover}
      onClick={onPick}
      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px]"
      style={{
        fontFamily: "var(--font-mono)",
        background: active ? "var(--page-accent-12)" : "transparent",
        color: active ? "var(--color-foreground)" : "var(--color-muted-foreground)",
      }}
    >
      {icon === "check" && <Check size={11} style={{ color: "var(--page-accent)", flexShrink: 0 }} />}
      {icon === "plus" && <Plus size={11} style={{ flexShrink: 0 }} />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint && (
        <span className="shrink-0 text-[9px]" style={{ color: "var(--color-muted-foreground)" }}>
          {hint}
        </span>
      )}
    </button>
  );
}

export interface ModelSelectProps {
  value: string;
  options: string[];
  onChange: (model: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

/** Single-value typeahead: type to filter a provider's stored models. */
export function ModelSelect({ value, options, onChange, placeholder = "Select a model", disabled }: ModelSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(0);
  const listId = useId();

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);
  const wrapRef = useClickOutside(close);

  const rows = useMemo(() => rankOptions(options, query), [options, query]);
  useEffect(() => {
    setHi(0);
  }, [query]);

  const pick = useCallback(
    (m: string) => {
      onChange(m);
      setOpen(false);
      setQuery("");
    },
    [onChange],
  );

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (!rows.length) return;
      setHi((h) => (e.key === "ArrowDown" ? (h + 1) % rows.length : (h - 1 + rows.length) % rows.length));
      return;
    }
    if (e.key === "Enter") {
      if (open && rows.length) {
        e.preventDefault();
        pick(rows[Math.min(hi, rows.length - 1)]);
      }
      return;
    }
    if (e.key === "Escape" || e.key === "Tab") close();
  };

  return (
    <div ref={wrapRef} className="relative">
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        value={open ? query : value}
        placeholder={open && value ? value : placeholder}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="w-full rounded-lg px-2 py-1.5 pr-7 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] disabled:opacity-50"
        style={{ ...FIELD_STYLE, fontFamily: "var(--font-mono)" }}
      />
      <ChevronsUpDown
        size={12}
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
        style={{ color: "var(--color-muted-foreground)" }}
      />
      {open && (
        <div id={listId} role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-52 overflow-y-auto p-1" style={MENU_STYLE}>
          {rows.length === 0 ? (
            <p className="px-2.5 py-2 text-[10px]" style={{ color: "var(--color-muted-foreground)" }}>
              {options.length === 0 ? "No models stored for this provider yet." : `Nothing matches “${query}”.`}
            </p>
          ) : (
            rows.map((m, i) => (
              <OptionRow
                key={m}
                label={m}
                active={i === hi}
                icon={m === value ? "check" : undefined}
                onHover={() => setHi(i)}
                onPick={() => pick(m)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export interface ModelsFieldProps {
  value: string[];
  options: string[];
  onChange: (models: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Multi-value typeahead: the provider's stored model list. Chips are the list;
 * the input adds. Suggestions come from the caller (template catalogue +
 * models already used by other providers); anything typed that is not in the
 * catalogue becomes a custom entry.
 */
export function ModelsField({ value, options, onChange, placeholder = "Type a model id…", disabled }: ModelsFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);
  const wrapRef = useClickOutside(close);

  const pool = useMemo(() => options.filter((o) => !value.includes(o)), [options, value]);
  const rows = useMemo(() => rankOptions(pool, query), [pool, query]);
  const trimmed = query.trim();
  const canCreate =
    trimmed.length > 0 &&
    !value.includes(trimmed) &&
    !options.some((o) => o.toLowerCase() === trimmed.toLowerCase());

  type Item = { kind: "model" | "create"; label: string };
  const items: Item[] = useMemo(() => {
    const list: Item[] = rows.map((r) => ({ kind: "model" as const, label: r }));
    if (canCreate) list.push({ kind: "create", label: trimmed });
    return list;
  }, [rows, canCreate, trimmed]);

  useEffect(() => {
    setHi(0);
  }, [query]);

  const add = useCallback(
    (m: string) => {
      const t = m.trim();
      if (!t || value.includes(t)) return;
      onChange([...value, t]);
      setQuery("");
      setHi(0);
      setOpen(true);
    },
    [value, onChange],
  );

  const remove = (m: string) => onChange(value.filter((x) => x !== m));

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (items.length) add(items[Math.min(hi, items.length - 1)].label);
      else if (trimmed) add(trimmed);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      if (items.length) setHi((h) => (h + 1) % items.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (items.length) setHi((h) => (h - 1 + items.length) % items.length);
      return;
    }
    if (e.key === "Backspace" && query === "" && value.length) {
      onChange(value.slice(0, -1));
      return;
    }
    if (e.key === "Escape") close();
  };

  return (
    <div ref={wrapRef} className="relative">
      <div
        className="flex flex-wrap items-center gap-1.5 rounded-lg p-1.5 focus-within:ring-2 focus-within:ring-[var(--page-accent)]"
        style={{ ...FIELD_STYLE, opacity: disabled ? 0.5 : 1 }}
        onClick={() => {
          if (disabled) return;
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        {value.map((m) => (
          <span
            key={m}
            className="inline-flex items-center gap-1 rounded-full py-0.5 pl-2 pr-1 text-[10px]"
            style={{ background: "var(--page-accent-12)", color: "var(--color-foreground)", fontFamily: "var(--font-mono)" }}
          >
            {m}
            <button
              type="button"
              aria-label={`Remove ${m}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                remove(m);
              }}
              className="rounded-full p-0.5"
              style={{ color: "var(--color-muted-foreground)" }}
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={query}
          disabled={disabled}
          placeholder={value.length ? "" : placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="min-w-[110px] flex-1 bg-transparent px-1 py-0.5 text-[11px] outline-none"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-foreground)" }}
        />
      </div>
      {value.length === 0 && !open && (
        <p className="mt-1 text-[10px]" style={{ color: "var(--color-muted-foreground)" }}>
          Nothing stored yet — type an id or pick a suggestion. Enter adds, Backspace removes.
        </p>
      )}
      {open && (
        <div id={listId} role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-52 overflow-y-auto p-1" style={MENU_STYLE}>
          {items.length === 0 ? (
            <p className="px-2.5 py-2 text-[10px]" style={{ color: "var(--color-muted-foreground)" }}>
              {value.length === 0 ? "Type a model id to add it." : "Every suggestion is already in the list."}
            </p>
          ) : (
            items.map((it, i) => (
              <OptionRow
                key={`${it.kind}:${it.label}`}
                label={it.kind === "create" ? `Add “${it.label}”` : it.label}
                active={i === hi}
                icon="plus"
                hint={it.kind === "create" ? "custom" : undefined}
                onHover={() => setHi(i)}
                onPick={() => add(it.label)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
