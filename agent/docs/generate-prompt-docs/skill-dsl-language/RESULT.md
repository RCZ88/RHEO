# RESULT — Skill DSL: Dynamic UI Generation from Skill Frontmatter

## 1. Language Specification

### 1a. Extended Interfaces

**File:** `src/services/SkillsService.ts`

```typescript
// ── Extended SkillIO (replaces existing) ──────────────────────

export interface SkillIO {
  name: string;
  type: 'text' | 'textarea' | 'enum' | 'boolean' | 'number' | 'file' | 'code' | 'markdown' | 'list' | 'multienum';
  description?: string;
  required?: boolean;
  source?: 'user' | 'system' | 'agent';

  // ── DSL Extensions ───────────────────────────────────────
  widget?: 'select' | 'radio' | 'switch' | 'slider' | 'text' | 'textarea' | 'code' | 'file' | 'checkbox' | 'tags';
  choices?: string[];
  default?: string | number | boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  validation?: string;           // regex pattern
  validationMessage?: string;
  group?: string;
  language?: string;             // for type: code — the language hint
}

export interface SkillOutput {
  name: string;
  type: string;
  description?: string;
  preview?: boolean;
}

export interface SkillComponent {
  name: string;
  description?: string;
  type?: string;
  required?: boolean;
  source?: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
  filePath: string;
  inputs?: SkillIO[];
  outputs?: SkillOutput[];
  components?: SkillComponent[];
}
```

### 1b. Widget Inference Table

When `widget` is not explicitly set, infer from `type` and other fields:

| `type` | Has `min`/`max`? | Inferred `widget` | Override examples |
|--------|-------------------|--------------------|-------------------|
| `enum` | — | `select` | `radio`, `select` |
| `multienum` | — | `tags` | `checkbox` group |
| `boolean` | — | `switch` | `checkbox` |
| `number` | yes | `slider` | `text` |
| `number` | no | `text` | `slider` |
| `text` | — | `text` | — |
| `textarea` | — | `textarea` | — |
| `code` | — | `code` | — |
| `file` | — | `file` | — |
| `markdown` | — | `textarea` | — |
| `list` | — | `tags` | — |

### 1c. All Valid Type + Widget Combinations

| `type` | `select` | `radio` | `switch` | `slider` | `text` | `textarea` | `code` | `file` | `checkbox` | `tags` |
|--------|----------|---------|----------|----------|--------|------------|--------|--------|------------|--------|
| `text` | | | | | ✅ | ✅ | | | | |
| `textarea` | | | | | | ✅ | | | | |
| `enum` | ✅ | ✅ | | | | | | | | |
| `multienum` | | | | | | | | | ✅ | ✅ |
| `boolean` | | | ✅ | | | | | | ✅ | |
| `number` | | | | ✅ | ✅ | | | | | |
| `file` | | | | | | | | ✅ | | |
| `code` | | | | | | | ✅ | | | |
| `markdown` | | | | | | ✅ | | | | |
| `list` | | | | | | | | | | ✅ |

---

## 2. Parser Module

**File:** `src/services/SkillDSLParser.ts` (NEW)

```typescript
// ═══════════════════════════════════════════════════════════════
// SkillDSLParser.ts — Parses extended YAML frontmatter into
// typed ParsedSkillInput / ParsedSkillOutput objects
// ═══════════════════════════════════════════════════════════════

import type { SkillIO, SkillOutput, SkillComponent } from './SkillsService';

export interface ParsedSkillInput extends SkillIO {
  // All SkillIO fields inherited, plus guaranteed widget inference
  widget: NonNullable<SkillIO['widget']>;
}

export interface ParsedSkillOutput extends SkillOutput {
  preview?: boolean;
}

export interface ParsedSkillConfig {
  inputs: ParsedSkillInput[];
  outputs: ParsedSkillOutput[];
  components: SkillComponent[];
  warnings: string[];
}

// ── Widget inference ────────────────────────────────────────────

function inferWidget(input: Partial<SkillIO>): NonNullable<SkillIO['widget']> {
  if (input.widget) return input.widget;

  const type = input.type || 'text';

  switch (type) {
    case 'enum': return 'select';
    case 'multienum': return 'tags';
    case 'boolean': return 'switch';
    case 'number':
      return (input.min !== undefined && input.max !== undefined) ? 'slider' : 'text';
    case 'text': return 'text';
    case 'textarea': return 'textarea';
    case 'code': return 'code';
    case 'file': return 'file';
    case 'markdown': return 'textarea';
    case 'list': return 'tags';
    default: return 'text';
  }
}

// ── Type coercion ───────────────────────────────────────────────

function coerceValue(raw: string, type: string): string | number | boolean | string[] {
  if (type === 'number') {
    const num = Number(raw);
    return isNaN(num) ? raw : num;
  }
  if (type === 'boolean') {
    return raw === 'true' || raw === '1';
  }
  if (raw.startsWith('[') && raw.endsWith(']')) {
    return raw.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
  }
  return raw;
}

// ── Frontmatter parser (enhanced) ──────────────────────────────

interface RawListItem {
  [key: string]: any;
}

function parseFrontmatterSection(frontmatter: string, key: string): RawListItem[] {
  const lines = frontmatter.split('\n');
  const results: RawListItem[] = [];
  let inSection = false;
  let currentItem: RawListItem | null = null;
  let lastProperty = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect section start
    if (line === `${key}:` || line.match(new RegExp(`^${key}:\\s*$`))) {
      inSection = true;
      continue;
    }

    // Detect section end
    if (inSection && line.match(/^\w[\w-]*:/) && !line.startsWith(' ')) {
      if (currentItem) results.push(currentItem);
      currentItem = null;
      inSection = false;
      continue;
    }

    if (!inSection) continue;
    if (line.trim() === '' || line.trim() === '#') continue;

    // New list item: "  - name: Value"
    const newItemMatch = line.match(/^  - (\w+):\s*(.*)$/);
    if (newItemMatch) {
      if (currentItem) results.push(currentItem);
      currentItem = {};
      const prop = newItemMatch[1];
      let val: any = newItemMatch[2].trim();
      val = coerceValue(val, prop);
      currentItem[prop] = val;
      lastProperty = prop;
      continue;
    }

    // Property of current item: "    name: Value"
    const propMatch = line.match(/^    (\w+):\s*(.*)$/);
    if (propMatch && currentItem) {
      const prop = propMatch[1];
      let val: any = propMatch[2].trim();
      val = coerceValue(val, prop);
      currentItem[prop] = val;
      lastProperty = prop;
      continue;
    }

    // Indented list value: "      - option1" (for choices)
    const listValueMatch = line.match(/^      - (.+)$/);
    if (listValueMatch && currentItem) {
      const value = listValueMatch[1].trim().replace(/^['"]|['"]$/g, '');
      if (!Array.isArray(currentItem[lastProperty])) {
        currentItem[lastProperty] = [value];
      } else {
        (currentItem[lastProperty] as string[]).push(value);
      }
      continue;
    }

    // Multi-line string continuation: "      continuation text"
    const continuationMatch = line.match(/^      (.+)$/);
    if (continuationMatch && currentItem && typeof currentItem[lastProperty] === 'string') {
      currentItem[lastProperty] += ' ' + continuationMatch[1].trim();
    }
  }

  if (currentItem) results.push(currentItem);
  return results;
}

function parseOutputsSection(frontmatter: string, key: string): RawListItem[] {
  return parseFrontmatterSection(frontmatter, key);
}

// ── Main parser ─────────────────────────────────────────────────

export function parseSkillDSL(frontmatter: string): ParsedSkillConfig {
  const warnings: string[] = [];

  // Parse sections
  const rawInputs = parseFrontmatterSection(frontmatter, 'inputs');
  const rawOutputs = parseOutputsSection(frontmatter, 'outputs');
  const rawComponents = parseFrontmatterSection(frontmatter, 'components');

  // Build typed inputs
  const inputs: ParsedSkillInput[] = rawInputs.map((raw: any) => {
    const input: ParsedSkillInput = {
      name: raw.name || 'Unnamed',
      type: raw.type || 'text',
      description: raw.description,
      required: raw.required === true,
      source: raw.source,
      widget: raw.widget,
      choices: Array.isArray(raw.choices) ? raw.choices : undefined,
      default: raw.default,
      placeholder: raw.placeholder,
      min: typeof raw.min === 'number' ? raw.min : undefined,
      max: typeof raw.max === 'number' ? raw.max : undefined,
      step: typeof raw.step === 'number' ? raw.step : undefined,
      validation: raw.validation,
      validationMessage: raw.validationMessage,
      group: raw.group,
      language: raw.language,
    };

    // Infer widget
    input.widget = inferWidget(input);

    // Validate: enum without choices
    if ((input.type === 'enum' || input.type === 'multienum') && (!input.choices || input.choices.length === 0)) {
      warnings.push(`Input "${input.name}": type is ${input.type} but no choices provided`);
    }

    // Validate: slider without min/max
    if (input.widget === 'slider' && (input.min === undefined || input.max === undefined)) {
      warnings.push(`Input "${input.name}": widget is slider but min/max not set, falling back to text input`);
      input.widget = 'text';
    }

    return input;
  });

  // Build typed outputs
  const outputs: ParsedSkillOutput[] = rawOutputs.map((raw: any) => ({
    name: raw.name || 'Unnamed',
    type: raw.type || 'text',
    description: raw.description,
    preview: raw.preview === true,
  }));

  // Build components (unchanged)
  const components: SkillComponent[] = rawComponents.map((raw: any) => ({
    name: raw.name || 'Unnamed',
    description: raw.description,
    type: raw.type,
    required: raw.required === true,
    source: raw.source,
  }));

  return { inputs, outputs, components, warnings };
}

// ── Integration helper ──────────────────────────────────────────

export function enhanceSkillWithDSL(skill: any): any {
  if (!skill.inputs && !skill.outputs && !skill.components) return skill;

  // Re-parse the frontmatter from the skill content if available
  const frontmatterMatch = skill.content?.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return skill;

  const parsed = parseSkillDSL(frontmatterMatch[1]);

  return {
    ...skill,
    inputs: parsed.inputs.length > 0 ? parsed.inputs : skill.inputs,
    outputs: parsed.outputs.length > 0 ? parsed.outputs : skill.outputs,
    components: parsed.components.length > 0 ? parsed.components : skill.components,
    _dslWarnings: parsed.warnings,
  };
}
```

### Integration with SkillsService

**File:** `src/services/SkillsService.ts`

In `loadSkillFromFile()`, after the existing parsing, add:

```typescript
import { enhanceSkillWithDSL } from './SkillDSLParser';

// At the end of loadSkillFromFile, before the return:
const result = {
  id: path.basename(path.dirname(filePath)),
  name: nameMatch ? nameMatch[1].trim() : 'Unnamed',
  description: descMatch ? descMatch[1].trim() : '',
  category: catMatch ? catMatch[1].trim() : 'general',
  content,
  filePath,
  inputs: inputs.length > 0 ? inputs : undefined,
  outputs: outputs.length > 0 ? outputs : undefined,
  components: components.length > 0 ? components : undefined,
};

// Enhance with DSL parser (adds widget inference, type coercion, validation)
return enhanceSkillWithDSL(result);
```

---

## 3. Dynamic Form Renderer

**File:** `src/components/SkillDynamicForm.tsx` (NEW)

```tsx
import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, AlertCircle, FileText, X, Plus } from 'lucide-react';
import type { SkillIO } from '../services/SkillsService';

// ── Types ───────────────────────────────────────────────────────

interface SkillDynamicFormProps {
  inputs: SkillIO[];
  values?: Record<string, any>;
  onChange?: (values: Record<string, any>) => void;
  compact?: boolean;
}

interface ValidationState {
  [key: string]: { valid: boolean; message?: string };
}

// ── Main Component ──────────────────────────────────────────────

export default function SkillDynamicForm({
  inputs,
  values: externalValues,
  onChange,
  compact = false,
}: SkillDynamicFormProps) {
  // Initialize from defaults
  const initialValues: Record<string, any> = {};
  for (const input of inputs) {
    const key = input.name;
    if (input.default !== undefined) {
      initialValues[key] = input.default;
    } else {
      switch (input.type) {
        case 'boolean': initialValues[key] = false; break;
        case 'number': initialValues[key] = input.min || 0; break;
        case 'list': initialValues[key] = []; break;
        case 'multienum': initialValues[key] = []; break;
        case 'enum':
          initialValues[key] = input.choices?.[0] || '';
          break;
        default: initialValues[key] = '';
      }
    }
  }

  const [formValues, setFormValues] = useState<Record<string, any>>(
    externalValues || initialValues
  );
  const [validation, setValidation] = useState<ValidationState>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Sync with external values
  useEffect(() => {
    if (externalValues) setFormValues(externalValues);
  }, [externalValues]);

  // Notify parent on change
  const updateValue = useCallback((name: string, value: any) => {
    setFormValues(prev => {
      const next = { ...prev, [name]: value };
      onChange?.(next);
      return next;
    });
  }, [onChange]);

  // Validate a single field
  const validateField = useCallback((input: SkillIO, value: any) => {
    if (!input.validation) return { valid: true };

    try {
      const regex = new RegExp(input.validation);
      const valid = regex.test(String(value));
      return {
        valid,
        message: valid ? undefined : (input.validationMessage || `Invalid value for ${input.name}`),
      };
    } catch {
      return { valid: true };
    }
  }, []);

  // Group inputs
  const groups = new Map<string, SkillIO[]>();
  const ungrouped: SkillIO[] = [];

  for (const input of inputs) {
    if (input.group) {
      if (!groups.has(input.group)) groups.set(input.group, []);
      groups.get(input.group)!.push(input);
    } else {
      ungrouped.push(input);
    }
  }

  // Auto-expand groups that have required fields
  useEffect(() => {
    const autoExpand = new Set<string>();
    for (const [groupName, groupInputs] of groups) {
      if (groupInputs.some(i => i.required)) {
        autoExpand.add(groupName);
      }
    }
    setExpandedGroups(autoExpand);
  }, [inputs]);

  const toggleGroup = (name: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  // ── Render individual control ───────────────────────────────

  const renderControl = (input: SkillIO) => {
    const widget = input.widget || 'text';
    const value = formValues[input.name];
    const valState = validation[input.name];
    const hasError = valState && !valState.valid;

    const labelClass = 'text-[10px] font-medium text-zinc-400 mb-1 block';
    const inputClass = `w-full bg-zinc-950 border rounded-lg px-3 py-1.5 text-[11px] text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-pink-500/50 ${
      hasError ? 'border-red-500/50' : 'border-zinc-700/50'
    }`;
    const selectClass = `w-full bg-zinc-800/80 border rounded-lg px-2 py-1.5 text-[11px] text-zinc-300 focus:outline-none focus:border-zinc-600 ${
      hasError ? 'border-red-500/50' : 'border-zinc-700/50'
    }`;

    return (
      <div key={input.name} className="mb-3">
        {/* Label */}
        <label className={labelClass}>
          {input.name}
          {input.required && <span className="text-red-400 ml-0.5">*</span>}
          {input.type && (
            <span className="ml-1.5 text-[9px] text-zinc-600 font-normal">{input.type}</span>
          )}
        </label>

        {/* Control by widget */}
        {(() => {
          switch (widget) {
            // ── SELECT ──────────────────────────────
            case 'select':
              return (
                <select
                  value={value || ''}
                  onChange={e => updateValue(input.name, e.target.value)}
                  className={selectClass}
                >
                  {input.placeholder && (
                    <option value="" disabled>{input.placeholder}</option>
                  )}
                  {(input.choices || []).map(choice => (
                    <option key={choice} value={choice}>{choice}</option>
                  ))}
                </select>
              );

            // ── RADIO ───────────────────────────────
            case 'radio':
              return (
                <div className="flex flex-wrap gap-2 mt-0.5">
                  {(input.choices || []).map(choice => (
                    <label key={choice} className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name={`radio-${input.name}`}
                        value={choice}
                        checked={value === choice}
                        onChange={() => updateValue(input.name, choice)}
                        className="w-3 h-3 accent-pink-500"
                      />
                      <span className="text-[10px] text-zinc-300">{choice}</span>
                    </label>
                  ))}
                </div>
              );

            // ── SWITCH (toggle) ─────────────────────
            case 'switch':
              return (
                <button
                  type="button"
                  onClick={() => updateValue(input.name, !value)}
                  className={`w-8 h-4 rounded-full transition-colors relative ${
                    value ? 'bg-pink-600' : 'bg-zinc-700'
                  }`}
                >
                  <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                    value ? 'translate-x-4' : 'translate-x-0.5'
                  }`} />
                </button>
              );

            // ── CHECKBOX ────────────────────────────
            case 'checkbox':
              return (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!value}
                    onChange={e => updateValue(input.name, e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-800 accent-pink-500"
                  />
                  <span className="text-[10px] text-zinc-400">{input.placeholder || 'Enabled'}</span>
                </label>
              );

            // ── SLIDER ──────────────────────────────
            case 'slider':
              return (
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={input.min}
                    max={input.max}
                    step={input.step || 1}
                    value={value || input.min || 0}
                    onChange={e => updateValue(input.name, Number(e.target.value))}
                    className="flex-1 accent-pink-500"
                  />
                  <span className="text-[10px] text-zinc-400 font-mono w-10 text-right">
                    {value ?? input.min ?? 0}
                  </span>
                </div>
              );

            // ── TEXT ────────────────────────────────
            case 'text':
              return (
                <input
                  type={input.type === 'number' ? 'number' : 'text'}
                  value={value ?? ''}
                  onChange={e => updateValue(input.name, input.type === 'number' ? Number(e.target.value) : e.target.value)}
                  placeholder={input.placeholder}
                  min={input.type === 'number' ? input.min : undefined}
                  max={input.type === 'number' ? input.max : undefined}
                  step={input.type === 'number' ? input.step : undefined}
                  className={inputClass}
                  onBlur={() => {
                    if (input.validation) {
                      setValidation(prev => ({
                        ...prev,
                        [input.name]: validateField(input, value),
                      }));
                    }
                  }}
                />
              );

            // ── TEXTAREA ────────────────────────────
            case 'textarea':
              return (
                <textarea
                  value={value ?? ''}
                  onChange={e => updateValue(input.name, e.target.value)}
                  placeholder={input.placeholder}
                  rows={3}
                  className={`${inputClass} resize-none`}
                  onBlur={() => {
                    if (input.validation) {
                      setValidation(prev => ({
                        ...prev,
                        [input.name]: validateField(input, value),
                      }));
                    }
                  }}
                />
              );

            // ── CODE ────────────────────────────────
            case 'code':
              return (
                <textarea
                  value={value ?? ''}
                  onChange={e => updateValue(input.name, e.target.value)}
                  placeholder={input.placeholder || `Enter ${input.language || 'code'}...`}
                  rows={5}
                  className={`${inputClass} font-mono text-[11px] resize-y`}
                  onBlur={() => {
                    if (input.validation) {
                      setValidation(prev => ({
                        ...prev,
                        [input.name]: validateField(input, value),
                      }));
                    }
                  }}
                />
              );

            // ── FILE ────────────────────────────────
            case 'file':
              return (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={value ?? ''}
                    onChange={e => updateValue(input.name, e.target.value)}
                    placeholder={input.placeholder || 'File path...'}
                    className={`${inputClass} flex-1`}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      // Use Electron dialog if available
                      const result = await window.deskflowAPI?.showOpenDialog?.({
                        properties: ['openFile'],
                      });
                      if (result?.filePaths?.[0]) {
                        updateValue(input.name, result.filePaths[0]);
                      }
                    }}
                    className="shrink-0 px-2 py-1.5 bg-zinc-800 border border-zinc-700/50 rounded-lg text-[10px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 transition-colors"
                  >
                    <FileText className="w-3 h-3" />
                  </button>
                </div>
              );

            // ── TAGS (list / multienum) ─────────────
            case 'tags': {
              const tags: string[] = Array.isArray(value) ? value : [];
              const isMultienum = input.type === 'multienum';
              const suggestions = input.choices || [];

              return (
                <div>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {tags.map((tag, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-400 border border-pink-500/20 text-[10px]"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => {
                            const next = tags.filter((_, idx) => idx !== i);
                            updateValue(input.name, next);
                          }}
                          className="text-pink-400/60 hover:text-pink-300"
                        >
                          <X className="w-2 h-2" />
                        </button>
                      </span>
                    ))}
                  </div>

                  {isMultienum && suggestions.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {suggestions.filter(s => !tags.includes(s)).map(suggestion => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => updateValue(input.name, [...tags, suggestion])}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-700/50 hover:text-zinc-300 transition-colors"
                        >
                          <Plus className="w-2 h-2 inline mr-0.5" />
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder={input.placeholder || 'Add item...'}
                        className={`${inputClass} flex-1`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const target = e.target as HTMLInputElement;
                            const val = target.value.trim();
                            if (val && !tags.includes(val)) {
                              updateValue(input.name, [...tags, val]);
                              target.value = '';
                            }
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            }

            default:
              return (
                <input
                  type="text"
                  value={value ?? ''}
                  onChange={e => updateValue(input.name, e.target.value)}
                  className={inputClass}
                />
              );
          }
        })()}

        {/* Description */}
        {input.description && !compact && (
          <p className="text-[9px] text-zinc-600 mt-0.5">{input.description}</p>
        )}

        {/* Validation error */}
        {hasError && valState?.message && (
          <div className="flex items-center gap-1 mt-0.5">
            <AlertCircle className="w-2.5 h-2.5 text-red-400" />
            <span className="text-[9px] text-red-400">{valState.message}</span>
          </div>
        )}
      </div>
    );
  };

  // ── Render groups ────────────────────────────────────────────

  const renderGroup = (groupName: string, groupInputs: SkillIO[]) => {
    const isExpanded = expandedGroups.has(groupName);

    return (
      <div key={groupName} className="mb-3">
        <button
          type="button"
          onClick={() => toggleGroup(groupName)}
          className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-500 uppercase tracking-wider hover:text-zinc-300 transition-colors w-full mb-2"
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
          {groupName}
          <span className="text-[9px] text-zinc-700 normal-case tracking-normal">
            ({groupInputs.length})
          </span>
        </button>
        {isExpanded && (
          <div className="pl-2">
            {groupInputs.map(input => renderControl(input))}
          </div>
        )}
      </div>
    );
  };

  // ── Main render ──────────────────────────────────────────────

  if (inputs.length === 0) {
    return (
      <p className="text-[10px] text-zinc-600 italic">No configurable inputs</p>
    );
  }

  return (
    <div className="bg-zinc-900/40 backdrop-blur-sm rounded-xl p-3">
      {/* Grouped inputs */}
      {Array.from(groups.entries()).map(([name, groupInputs]) =>
        renderGroup(name, groupInputs)
      )}

      {/* Ungrouped inputs */}
      {ungrouped.map(input => renderControl(input))}
    </div>
  );
}
```

---

## 4. Integration Points

### 4a. GeneralistDialog — Add "Configure" action

**File:** `src/components/GeneralistDialog.tsx`

In the expanded skill card section, after the inputs/outputs/components display, add a form:

```tsx
// Add state:
const [configuringSkill, setConfiguringSkill] = useState<string | null>(null);
const [skillFormValues, setSkillFormValues] = useState<Record<string, any>>({});

// In the expanded section, after existing IO display:
{hasConfig(skill) && (
  <div className="mt-3 pt-2 border-t border-zinc-800/40">
    {configuringSkill === skill.id ? (
      <div>
        <SkillDynamicForm
          inputs={skill.inputs || []}
          values={skillFormValues}
          onChange={setSkillFormValues}
          compact
        />
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => {
              // Pass values to parent via callback
              onUseSkill?.(skill, skillFormValues);
              setConfiguringSkill(null);
            }}
            className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-pink-600/20 text-pink-400 border border-pink-500/30 hover:bg-pink-600/30 transition-colors"
          >
            Use Skill
          </button>
          <button
            onClick={() => setConfiguringSkill(null)}
            className="px-3 py-1.5 rounded-lg text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    ) : (
      <button
        onClick={() => {
          setConfiguringSkill(skill.id);
          setSkillFormValues({});
        }}
        className="text-[10px] text-pink-400 hover:text-pink-300 transition-colors"
      >
        Configure & Use →
      </button>
    )}
  </div>
)}
```

Add `onUseSkill` to `GeneralistDialogProps`:

```typescript
interface GeneralistDialogProps {
  onClose: () => void;
  onUseSkill?: (skill: any, values: Record<string, any>) => void;
}
```

### 4b. InstructionPanel — Pre-fill from skill config

**File:** `src/components/InstructionPanel.tsx`

When a skill is selected, show its dynamic form:

```tsx
// Add state:
const [skillConfigValues, setSkillConfigValues] = useState<Record<string, any>>({});
const [activeSkillData, setActiveSkillData] = useState<any>(null);

// When skill selection changes, load skill data:
useEffect(() => {
  if (selectedSkill) {
    const skill = skills?.find(s => s.id === selectedSkill || s.name === selectedSkill);
    setActiveSkillData(skill || null);
    setSkillConfigValues({});
  } else {
    setActiveSkillData(null);
    setSkillConfigValues({});
  }
}, [selectedSkill, skills]);

// In the JSX, after skill selector:
{activeSkillData?.inputs && activeSkillData.inputs.length > 0 && (
  <div className="mb-3">
    <SkillDynamicForm
      inputs={activeSkillData.inputs}
      values={skillConfigValues}
      onChange={setSkillConfigValues}
      compact
    />
  </div>
)}
```

Modify `generatePrompt()` to include skill config values:

```typescript
// In generatePrompt(), after skill content:
if (selectedSkill && Object.keys(skillConfigValues).length > 0) {
    const configLines = Object.entries(skillConfigValues)
        .filter(([_, v]) => v !== '' && v !== undefined && v !== null)
        .map(([key, val]) => `- ${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
        .join('\n');
    if (configLines) {
        parts.push(`## Skill Configuration\n\n${configLines}`);
    }
}
```

### 4c. Props Interface Summary

| Integration Point | Props | Type |
|---|---|---|
| `GeneralistDialog` | `onUseSkill` | `(skill, values) => void` |
| `InstructionPanel` | (internal state) | `skillConfigValues: Record<string, any>` |
| `SkillDynamicForm` | `inputs`, `values?`, `onChange?`, `compact?` | See above |

---

## 5. Language Guide

### Skill DSL Reference

#### Quick Start

Add `inputs` to your SKILL.md frontmatter with `type` and optionally `widget`, `choices`, `default`:

```yaml
---
id: my-skill
name: My Skill
category: development
inputs:
  - name: Framework
    type: enum
    choices: [react, vue, svelte]
    default: react
    required: true
  - name: Max Lines
    type: number
    min: 10
    max: 500
    step: 10
    default: 100
---
```

#### Type → Widget Mapping

| `type` | Auto `widget` | Override with |
|--------|---------------|---------------|
| `enum` | `select` | `widget: radio` |
| `multienum` | `tags` | `widget: checkbox` |
| `boolean` | `switch` | `widget: checkbox` |
| `number` (with min/max) | `slider` | `widget: text` |
| `number` (no min/max) | `text` | `widget: slider` |
| `text` | `text` | — |
| `textarea` | `textarea` | — |
| `code` | `code` | — |
| `file` | `file` | — |
| `markdown` | `textarea` | — |
| `list` | `tags` | — |

#### All Fields Reference

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | ✅ | — | Display label for the input |
| `type` | string | ✅ | `text` | Data type: text, textarea, enum, boolean, number, file, code, markdown, list, multienum |
| `widget` | string | ❌ | inferred | UI control: select, radio, switch, slider, text, textarea, code, file, checkbox, tags |
| `choices` | string[] | for enum/multienum | — | Selectable options |
| `default` | any | ❌ | — | Initial value |
| `description` | string | ❌ | — | Help text shown below the control |
| `required` | boolean | ❌ | false | Shows `*` indicator and validates presence |
| `placeholder` | string | ❌ | — | Placeholder text for empty inputs |
| `source` | string | ❌ | — | Who provides this: user, system, agent |
| `min` | number | ❌ | — | Minimum value (number/slider) |
| `max` | number | ❌ | — | Maximum value (number/slider) |
| `step` | number | ❌ | 1 | Step increment (number/slider) |
| `validation` | string | ❌ | — | Regex pattern for validation |
| `validationMessage` | string | ❌ | — | Error message when validation fails |
| `group` | string | ❌ | — | Group name for visual grouping |
| `language` | string | ❌ | — | Language hint for type: code |

#### Output Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | ✅ | — | Output label |
| `type` | string | ✅ | `text` | Data type of the output |
| `description` | string | ❌ | — | What the output contains |
| `preview` | boolean | ❌ | false | Whether to show inline preview |

#### Complete Example

```yaml
---
id: deep-research
name: Deep Research
category: research
inputs:
  - name: Research Topic
    type: text
    required: true
    placeholder: Enter topic or question...
    group: Query

  - name: Depth Level
    type: enum
    choices:
      - surface
      - standard
      - deep
    default: standard
    description: How thorough the investigation should be
    group: Query

  - name: Max Sources
    type: number
    min: 3
    max: 50
    step: 1
    default: 10
    group: Parameters

  - name: Include Code Examples
    type: boolean
    default: false
    group: Parameters

  - name: Research Domains
    type: multienum
    choices: [academic, technical, news, social, documentation]
    default: [technical, documentation]
    group: Scope

  - name: System Prompt Additions
    type: textarea
    placeholder: Extra instructions for the researcher...
    group: Advanced

  - name: Excluded Terms
    type: list
    placeholder: Add term...
    group: Scope

outputs:
  - name: Research Report
    type: markdown
    description: Comprehensive research findings
    preview: true
  - name: Source List
    type: list
    description: All referenced sources with URLs
  - name: Key Findings
    type: list
    description: Bullet-point summary of discoveries
---
```

#### Migration Guide

Existing SKILL.md files work without changes — all new fields are optional. To upgrade:

1. **Replace description-embedded choices** with explicit `choices` array:
   ```yaml
   # BEFORE:
   - name: Depth Level
     type: enum
     description: How deep to investigate (surface, standard, deep)

   # AFTER:
   - name: Depth Level
     type: enum
     choices: [surface, standard, deep]
     default: standard
     description: How deep to investigate
   ```

2. **Add `widget` overrides** only when you want non-default UI:
   ```yaml
   - name: Style
     type: enum
     choices: [minimal, standard, detailed]
     widget: radio   # override default select
   ```

3. **Add `group`** to organize related inputs visually.

4. **Add `validation`** for custom rules:
   ```yaml
   - name: API Key
     type: text
     validation: ^sk-[a-zA-Z0-9]{32,}$
     validationMessage: Must be a valid API key starting with sk-
   ```

#### YAML List Syntax

Use either inline or indented format for choices:

```yaml
# Inline:
choices: [surface, standard, deep]

# Indented:
choices:
  - surface
  - standard
  - deep
```

Both are valid. The parser handles both formats.

---

## 6. Backend Audit Table

| Feature | File | Status |
|---------|------|--------|
| Extended `SkillIO` interface | `src/services/SkillsService.ts` | Modify existing |
| `SkillOutput` interface with `preview` | `src/services/SkillsService.ts` | Modify existing |
| `SkillDSLParser.ts` | `src/services/SkillDSLParser.ts` | **New file** |
| `SkillDynamicForm.tsx` | `src/components/SkillDynamicForm.tsx` | **New file** |
| Widget inference logic | `SkillDSLParser.ts` | New |
| Type coercion | `SkillDSLParser.ts` | New |
| Validation engine | `SkillDynamicForm.tsx` | New |
| Group rendering | `SkillDynamicForm.tsx` | New |
| `enhanceSkillWithDSL()` integration | `SkillsService.ts` | Modify `loadSkillFromFile()` |
| GeneralistDialog "Configure" action | `GeneralistDialog.tsx` | Modify |
| InstructionPanel skill form | `InstructionPanel.tsx` | Modify |
| `getSkills` IPC | `preload.ts` | Unchanged |
| `showOpenDialog` for file widget | `preload.ts` | Needs addition |
| SKILL.md frontmatter | `agent/skills/*/SKILL.md` | Optional upgrade |