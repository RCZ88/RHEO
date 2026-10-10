import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, AlertCircle, FileText, X, Plus } from 'lucide-react';
import type { SkillIO } from '../services/SkillsService';

interface SkillDynamicFormProps {
  inputs: SkillIO[];
  values?: Record<string, any>;
  onChange?: (values: Record<string, any>) => void;
  compact?: boolean;
}

interface ValidationState {
  [key: string]: { valid: boolean; message?: string };
}

export default function SkillDynamicForm({
  inputs,
  values: externalValues,
  onChange,
  compact = false,
}: SkillDynamicFormProps) {
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

  useEffect(() => {
    if (externalValues) setFormValues(externalValues);
  }, [externalValues]);

  const updateValue = useCallback((name: string, value: any) => {
    setFormValues(prev => {
      const next = { ...prev, [name]: value };
      onChange?.(next);
      return next;
    });
  }, [onChange]);

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

  const renderControl = (input: SkillIO) => {
    const widget = input.widget || 'text';
    const value = formValues[input.name];
    const valState = validation[input.name];
    const hasError = valState && !valState.valid;

    const labelClass = 'text-[10px] font-medium text-zinc-400 mb-1 block';
    const inputClass = `w-full bg-zinc-950 light:bg-[var(--ws-surface)] border rounded-lg px-3 py-1.5 text-[11px] text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-pink-500/50 ${
      hasError ? 'border-red-500/50' : 'border-zinc-700/50'
    }`;
    const selectClass = `w-full bg-zinc-800/80 border rounded-lg px-2 py-1.5 text-[11px] text-zinc-300 focus:outline-none focus:border-zinc-600 ${
      hasError ? 'border-red-500/50' : 'border-zinc-700/50'
    }`;

    return (
      <div key={input.name} className="mb-3">
        <label className={labelClass}>
          {input.name}
          {input.required && <span className="text-red-400 ml-0.5">*</span>}
          {input.type && (
            <span className="ml-1.5 text-[9px] text-zinc-600 font-normal">{input.type}</span>
          )}
        </label>

        {(() => {
          switch (widget) {
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

            case 'slider':
              return (
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={input.min}
                    max={input.max}
                    step={input.step || 1}
                    value={value ?? input.min ?? 0}
                    onChange={e => updateValue(input.name, Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-[10px] text-zinc-400 font-mono w-10 text-right">
                    {value ?? input.min ?? 0}
                  </span>
                </div>
              );

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
                      const result = await (window as any).deskflowAPI?.showOpenDialog?.({
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
                          className="text-[var(--text-muted)] hover:text-pink-300"
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

        {input.description && !compact && (
          <p className="text-[9px] text-zinc-600 mt-0.5">{input.description}</p>
        )}

        {hasError && valState?.message && (
          <div className="flex items-center gap-1 mt-0.5">
            <AlertCircle className="w-2.5 h-2.5 text-red-400" />
            <span className="text-[9px] text-red-400">{valState.message}</span>
          </div>
        )}
      </div>
    );
  };

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

  if (inputs.length === 0) {
    return (
      <p className="text-[10px] text-zinc-600 italic">No configurable inputs</p>
    );
  }

  return (
    <div className="bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] backdrop-blur-sm rounded-xl p-3">
      {Array.from(groups.entries()).map(([name, groupInputs]) =>
        renderGroup(name, groupInputs)
      )}

      {ungrouped.map(input => renderControl(input))}
    </div>
  );
}
