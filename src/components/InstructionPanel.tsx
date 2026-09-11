import { useState, useEffect, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { Send, X, FileText, Folder, Copy, Check, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import SkillDynamicForm from './SkillDynamicForm';
import { VoiceInputWrapper } from '@/components/VoiceInputWrapper';
import type { PromptLayer } from '../lib/promptAssembly';
import { renderSystemPrompt, scopeBlockFromSelected } from '../lib/promptAssembly';

interface Problem {
  id: string;
  title: string;
  status: string;
  priority: string;
  user_notes?: string;
  files: string[];
}

interface Request {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
}

interface Skill {
  id: string;
  name: string;
  description: string;
  content?: string;
}

interface InstructionConfig {
  problems: string[];
  requests: string[];
  skills?: string[];
  instruction: string;
  prompt: string;
  systemPromptIncluded?: boolean;
  agent?: string;
}

interface SystemPromptLayer extends PromptLayer {}

interface InstructionPanelProps {
  problems: Problem[];
  requests: Request[];
  onSend: (config: InstructionConfig) => void;
  onClose: () => void;
  onCancel?: () => void;
  isSending?: boolean;
  projectPath?: string;
  defaultSkills?: string[];
  sessionId?: string;
  activeTerminalId?: string | null;
  isAgentReady?: boolean;
  systemPromptLayers?: SystemPromptLayer[];
  onComposeSkillsChange?: (skills: string[]) => void;
}

function renderMarkdown(text: string): { __html: string } {
  let html = text
    .replace(/^### (.+)$/gm, '<h4 class="text-[11px] font-bold text-cyan-300 mt-2 mb-1 font-mono tracking-tight">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="text-[12px] font-bold text-amber-300 mt-3 mb-2 font-mono tracking-tight">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="text-[13px] font-bold text-white mt-4 mb-2 font-mono tracking-tight">$1</h2>')
    .replace(/\n```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-zinc-950 border border-zinc-700/50 rounded px-3 py-2 my-2 overflow-x-auto"><code class="text-[10px] text-green-300 font-mono">$2</code></pre>')
    .replace(/^\| (.+) \|$/gm, '<tr><td class="px-2 py-0.5 text-[10px] text-zinc-400">$1</td></tr>')
    .replace(/^- \[ \] (.+)$/gm, '<div class="text-[10px] text-zinc-400 my-0.5"><span class="text-zinc-600 mr-2">☐</span>$1</div>')
    .replace(/^- \[x\] (.+)$/gm, '<div class="text-[10px] text-green-400 my-0.5"><span class="text-green-600 mr-2">☑</span>$1</div>')
    .replace(/^- (.+)$/gm, '<div class="text-[10px] text-zinc-400 ml-2 my-0.5">• $1</div>')
    .replace(/^---$/gm, '<div class="border-t border-zinc-700/50 my-2"></div>')
    .replace(/`([^`\n]+)`/g, '<code class="bg-zinc-800 px-1 py-0.5 rounded text-cyan-400 text-[9px] font-mono">$1</code>');
  html = html.replace(/\n/g, '<br/>');
  return { __html: DOMPurify.sanitize(html) };
}

export function InstructionPanel({
  problems,
  requests,
  onSend,
  onClose,
  onCancel,
  isSending,
  projectPath,
  defaultSkills,
  sessionId,
  activeTerminalId,
  isAgentReady,
  systemPromptLayers,
  onComposeSkillsChange,
}: InstructionPanelProps) {
  const storageKey = sessionId ? `compose-${sessionId}` : 'compose-instruction';
  const [selectedProblems, setSelectedProblems] = useState<string[]>([]);
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>(defaultSkills || []);
  const [customInstruction, setCustomInstruction] = useState('');
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillConfigValues, setSkillConfigValues] = useState<Record<string, any>>({});
  const [agentFiles, setAgentFiles] = useState<{ name: string; path: string }[]>([]);
  const [selectedAgentFiles, setSelectedAgentFiles] = useState<string[]>([]);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [agentFileContents, setAgentFileContents] = useState<Record<string, string>>({});
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [systemPromptExpanded, setSystemPromptExpanded] = useState(false);
  const [systemPromptIncluded, setSystemPromptIncluded] = useState(true);
  const [layerToggles, setLayerToggles] = useState<Partial<Record<string, boolean>>>({});

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSelectedProblems(parsed.selectedProblems || []);
        setSelectedRequests(parsed.selectedRequests || []);
        setSelectedSkills(parsed.selectedSkills || defaultSkills || []);
        setCustomInstruction(parsed.customInstruction || '');
        setSelectedAgentFiles(parsed.selectedAgentFiles || []);
      } catch {}
    }
  }, [storageKey]);

  const persistState = useCallback(() => {
    localStorage.setItem(storageKey, JSON.stringify({
      selectedProblems,
      selectedRequests,
      selectedSkills,
      customInstruction,
      selectedAgentFiles,
    }));
  }, [storageKey, selectedProblems, selectedRequests, selectedSkills, customInstruction, selectedAgentFiles]);

  useEffect(() => { persistState(); }, [persistState]);

  useEffect(() => {
    let escapeCount = 0;
    let escapeTimer: ReturnType<typeof setTimeout>;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        escapeCount++;
        clearTimeout(escapeTimer);
        if (escapeCount >= 2) {
          onClose();
          escapeCount = 0;
        } else {
          escapeTimer = setTimeout(() => { escapeCount = 0; }, 500);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(escapeTimer);
    };
  }, [onClose]);

  useEffect(() => {
    window.deskflowAPI?.getSkills?.().then(result => {
      if (result?.success) {
        setSkills(result.data || []);
        setSkillConfigValues({});
      }
    });
  }, []);

  useEffect(() => {
    setSkillConfigValues({});
  }, [selectedSkills]);

  // Sync with external composeSkills changes
  useEffect(() => {
    if (defaultSkills) setSelectedSkills(defaultSkills);
  }, [defaultSkills?.join(',')]);

  useEffect(() => {
    if (!projectPath || !window.deskflowAPI) return;
    (window as any).deskflowAPI.listAgentDirFiles?.(projectPath).then((result: any) => {
      if (result?.success) setAgentFiles(result.data || []);
    });
  }, [projectPath]);

  const loadAgentFileContent = async (filename: string) => {
    if (!projectPath || agentFileContents[filename]) return;
    try {
      const result = await (window as any).deskflowAPI.readAgentFileContent?.(filename, projectPath);
      if (result?.success && result.data) {
        setAgentFileContents(prev => ({ ...prev, [filename]: result.data }));
      }
    } catch {}
  };

  const generatePrompt = (): string => {
    const parts: string[] = [];

    // ═══ System prompt layers (via shared assembler) ═══
    if (systemPromptIncluded && systemPromptLayers && systemPromptLayers.length > 0) {
        const includedContent = renderSystemPrompt(systemPromptLayers, {
            layerToggles,
            includeExternallyLoaded: false,
        });
        if (includedContent) {
            parts.push(includedContent);
        }
    }

    // ═══ Session scope block (when bound to a single problem/request) ═══
    const sb = scopeBlockFromSelected(selectedProblems, selectedRequests, problems, requests);
    if (sb) parts.push(sb);

    for (const skillId of selectedSkills) {
      const skill = skills.find(s => s.id === skillId);
      if (skill) {
        parts.push(`## Skill: ${skill.name}\n${skill.description ? `> ${skill.description}\n` : ''}`);
        if (skill.content) parts.push(`${skill.content}\n`);
      }
    }

    const configLines = Object.entries(skillConfigValues)
      .filter(([_, v]) => v !== '' && v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0))
      .map(([key, val]) => `- ${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
      .join('\n');
    if (configLines) {
      parts.push(`## Skill Configuration\n\n${configLines}`);
    }

    if (selectedProblems.length > 0) {
      const lines: string[] = ['## Problems to Address\n'];
      for (const id of selectedProblems) {
        const p = problems.find(x => x.id === id);
        if (p) {
          lines.push(`### ${p.id}: ${p.title}`);
          lines.push(`Status: ${p.status}`);
          if (p.user_notes) lines.push(`User notes: "${p.user_notes}"`);
          if (p.files.length > 0) lines.push(`Files: ${p.files.join(', ')}`);
          lines.push('');
        }
      }
      parts.push(lines.join('\n'));
    }

    if (selectedRequests.length > 0) {
      const lines: string[] = ['## Requests to Implement\n'];
      for (const id of selectedRequests) {
        const r = requests.find(x => x.id === id);
        if (r) {
          lines.push(`### ${r.id}: ${r.title}`);
          lines.push(`Priority: ${r.priority}`);
          if (r.description) lines.push(`Description: ${r.description}`);
          lines.push('');
        }
      }
      parts.push(lines.join('\n'));
    }

    if (selectedAgentFiles.length > 0) {
      const fileParts: string[] = [];
      for (const name of selectedAgentFiles) {
        const content = agentFileContents[name];
        if (content) {
          fileParts.push(`## Agent File: ${name}\n\n\`\`\`\n${content}\n\`\`\``);
        }
      }
      if (fileParts.length > 0) parts.push(fileParts.join('\n\n'));
    }

    if (customInstruction.trim()) {
      parts.push(`## Instructions\n\n${customInstruction.trim()}`);
    }

    return parts.join('\n---\n\n');
  };

  const activeProblems = problems.filter(p => p.status !== 'Fixed' && p.status !== 'Irrelevant');
  const activeRequests = requests.filter(r => r.status !== 'Completed' && r.status !== 'Cancelled');

  const hasSelection = selectedProblems.length > 0 || selectedRequests.length > 0 || selectedSkills.length > 0 || !!customInstruction;

  return (
<div className="px-4 py-3 bg-gradient-to-r from-zinc-800/95 to-zinc-900/90 border-b border-zinc-700/60 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium text-zinc-300">Compose Instruction</h3>
        <div className="flex items-center gap-2">
          {isSending && (
            <button
              onClick={onCancel}
              className="px-2 py-1 text-[10px] bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded flex items-center gap-1"
            >
              Cancel
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-700 rounded text-zinc-500 hover:text-zinc-300"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {activeTerminalId && (
        <div className="flex items-center gap-2 mb-3 px-2 py-1 bg-zinc-900/50 rounded border border-zinc-700/30">
          <div className={`w-1.5 h-1.5 rounded-full ${isAgentReady ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`} />
          <span className="text-[10px] text-zinc-400">
            Target: <span className="text-zinc-300 font-mono">{activeTerminalId}</span>
            {isAgentReady ? ' (ready)' : ' (spawning...)'}
          </span>
        </div>
      )}

      {/* ── System Prompt Layers ────────────────────────────────── */}
      {systemPromptLayers && systemPromptLayers.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <button
              type="button"
              onClick={() => setSystemPromptExpanded(!systemPromptExpanded)}
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              {systemPromptExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              System Prompt
              <span className="text-[10px] text-zinc-600">
                ({systemPromptLayers.filter(l => l.content?.trim()).length} layers)
              </span>
            </button>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <span className="text-[10px] text-zinc-500">Include</span>
              <input
                type="checkbox"
                checked={systemPromptIncluded}
                onChange={(e) => setSystemPromptIncluded(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-800 text-cyan-500 focus:ring-cyan-500/30 cursor-pointer"
              />
            </label>
          </div>

          {!systemPromptIncluded && (
            <p className="text-[10px] text-zinc-600 pl-4">
              System prompt will not be sent to terminal
            </p>
          )}

          {systemPromptExpanded && systemPromptIncluded && (
            <div className="space-y-1 pl-2 mt-1">
              {systemPromptLayers.map((layer) => {
                if (!layer.content?.trim()) return null;
                const isOn = layerToggles[layer.id] !== false;
                return (
                  <div
                    key={layer.id}
                    className={`bg-zinc-900/50 rounded border border-zinc-800/50 overflow-hidden ${!isOn ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-center justify-between px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-medium ${layer.color}`}>
                          {layer.label}
                        </span>
                        <span className="text-[9px] text-zinc-600">
                          {layer.content.length.toLocaleString()} chars
                        </span>
                      </div>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isOn}
                          onChange={(e) => setLayerToggles(prev => ({ ...prev, [layer.id]: e.target.checked }))}
                          className="w-3 h-3 rounded border-zinc-600 bg-zinc-800 text-cyan-500 cursor-pointer"
                        />
                      </label>
                    </div>
                    <div className="px-2 pb-1.5">
                      <pre className="text-[10px] text-zinc-500 whitespace-pre-wrap break-words max-h-20 overflow-y-auto font-mono leading-tight">
                        {layer.content.substring(0, 300)}{layer.content.length > 300 ? '...' : ''}
                      </pre>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Problems</label>
          <div className="mt-1 max-h-24 overflow-y-auto space-y-0.5 bg-zinc-900/50 rounded p-1">
            {activeProblems.length === 0 ? (
              <div className="text-[10px] text-zinc-600 px-1 py-2 text-center">No open problems</div>
            ) : activeProblems.map(p => (
              <label
                key={p.id}
                className={`flex items-center gap-1.5 px-1.5 py-1 rounded cursor-pointer text-[10px] transition-colors ${
                  selectedProblems.includes(p.id)
                    ? 'bg-green-600/20 text-green-300'
                    : 'hover:bg-zinc-800 text-zinc-400'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedProblems.includes(p.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedProblems([...selectedProblems, p.id]);
                    } else {
                      setSelectedProblems(selectedProblems.filter(x => x !== p.id));
                    }
                  }}
                  className="accent-green-500"
                />
                <span className="truncate">{p.id}: {p.title}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Requests</label>
          <div className="mt-1 max-h-24 overflow-y-auto space-y-0.5 bg-zinc-900/50 rounded p-1">
            {activeRequests.length === 0 ? (
              <div className="text-[10px] text-zinc-600 px-1 py-2 text-center">No open requests</div>
            ) : activeRequests.map(r => (
              <label
                key={r.id}
                className={`flex items-center gap-1.5 px-1.5 py-1 rounded cursor-pointer text-[10px] transition-colors ${
                  selectedRequests.includes(r.id)
                    ? 'bg-blue-600/20 text-blue-300'
                    : 'hover:bg-zinc-800 text-zinc-400'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedRequests.includes(r.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedRequests([...selectedRequests, r.id]);
                    } else {
                      setSelectedRequests(selectedRequests.filter(x => x !== r.id));
                    }
                  }}
                  className="accent-blue-500"
                />
                <span className="truncate">{r.id}: {r.title}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3 mb-3">
        <div className="flex-1">
          <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Skills ({selectedSkills.length})</label>
          <div className="mt-1 space-y-1">
            {/* Add skill button */}
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1.5">
                {skills
                  .filter(s => !selectedSkills.includes(s.id))
                  .slice(0, 5)
                  .map(s => (
                    <button
                      key={s.id}
                      onClick={() => {
                        const next = [...selectedSkills, s.id];
                        setSelectedSkills(next);
                        onComposeSkillsChange?.(next);
                      }}
                      className="px-2 py-0.5 bg-zinc-800 hover:bg-indigo-600/30 text-zinc-400 hover:text-indigo-300 text-[10px] rounded border border-zinc-700 hover:border-indigo-500/50 transition-colors"
                    >
                      + {s.name}
                    </button>
                  ))}
                {skills.filter(s => !selectedSkills.includes(s.id)).length > 5 && (
                  <span className="text-[9px] text-zinc-600 self-center">+{skills.filter(s => !selectedSkills.includes(s.id)).length - 5} more</span>
                )}
              </div>
            )}
            {/* Selected skill chips */}
            {selectedSkills.length > 0 ? (
              <div className="space-y-1.5">
                {selectedSkills.map(skillId => {
                  const skill = skills.find(s => s.id === skillId);
                  return (
                    <div key={skillId} className="bg-indigo-500/15 border border-indigo-500/30 rounded px-2 py-1">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />
                        <span className="text-[11px] text-indigo-300 flex-1 truncate">{skill?.name || skillId}</span>
                        <button
                          onClick={() => {
                            const next = selectedSkills.filter(x => x !== skillId);
                            setSelectedSkills(next);
                            onComposeSkillsChange?.(next);
                          }}
                          className="text-indigo-400/60 hover:text-indigo-300 transition-colors shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      {skill?.inputs && (
                        <div className="mt-1 pl-4">
                          <SkillDynamicForm
                            inputs={skill.inputs}
                            values={skillConfigValues}
                            onChange={setSkillConfigValues}
                            compact
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-[10px] text-zinc-500 px-1 py-2 text-center border border-dashed border-zinc-700/50 rounded">
                No skills selected. Click a skill above or pick from the Skills tab.
              </div>
            )}
          </div>
        </div>

        <div className="flex-1">
          <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Instruction</label>
          <VoiceInputWrapper>
            <textarea
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              className="w-full mt-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 min-h-[120px] max-h-[300px] resize-y"
              placeholder="Additional instructions..."
            />
          </VoiceInputWrapper>
        </div>
      </div>

      {/* Agent Files Picker */}
      {projectPath && agentFiles.length > 0 && (
        <div className="mb-3">
          <button
            onClick={() => setShowFilePicker(!showFilePicker)}
            className="flex items-center gap-1 text-[10px] font-medium text-zinc-500 uppercase tracking-wider hover:text-zinc-300 transition-colors"
          >
            <Folder className="w-3 h-3" />
            Agent Files ({selectedAgentFiles.length} selected)
            <svg className={`w-2.5 h-2.5 transition-transform duration-200 ${showFilePicker ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {showFilePicker && (
            <div className="mt-1 max-h-28 overflow-y-auto space-y-0.5 bg-zinc-900/50 rounded p-1">
              {agentFiles.length === 0 ? (
                <div className="text-[10px] text-zinc-600 px-2 py-3 text-center">No agent files found</div>
              ) : agentFiles.map((f) => (
                <label
                  key={f.path}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer text-[10px] transition-all hover:bg-zinc-800 ${
                    selectedAgentFiles.includes(f.name)
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      : 'text-zinc-400 border border-transparent'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedAgentFiles.includes(f.name)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedAgentFiles([...selectedAgentFiles, f.name]);
                        loadAgentFileContent(f.name);
                      } else {
                        setSelectedAgentFiles(selectedAgentFiles.filter(x => x !== f.name));
                      }
                    }}
                    className="accent-amber-500"
                  />
                  <FileText className="w-2.5 h-2.5 flex-shrink-0" />
                  <span className="truncate flex-1">{f.name}</span>
                  {selectedAgentFiles.includes(f.name) && (
                    <span className="text-[8px] bg-amber-500/20 text-amber-400 px-1 rounded">attached</span>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {hasSelection && (
        <div className="mb-3 bg-zinc-900/80 rounded-lg border border-zinc-700/50 overflow-hidden">
          <button
            onClick={() => setPreviewExpanded(!previewExpanded)}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-zinc-800/50 transition-colors"
          >
            <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Prompt Preview</span>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const text = generatePrompt();
                  navigator.clipboard?.writeText(text).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  });
                }}
                className="p-1 hover:bg-zinc-700 rounded text-zinc-500 hover:text-zinc-300"
                title="Copy to clipboard"
              >
                {copied ? <Check className="w-2.5 h-2.5 text-green-400" /> : <Copy className="w-2.5 h-2.5" />}
              </button>
              <ChevronDown className={`w-3 h-3 text-zinc-600 transition-transform ${previewExpanded ? 'rotate-180' : ''}`} />
            </div>
          </button>
          {previewExpanded && (
            <div
              className="px-3 pb-2 max-h-40 overflow-y-auto"
              dangerouslySetInnerHTML={renderMarkdown(generatePrompt())}
            />
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="px-3 py-1.5 bg-zinc-700/50 hover:bg-zinc-600/50 text-zinc-400 text-xs rounded transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            localStorage.removeItem(storageKey);
          }}
          className="px-3 py-1.5 bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-500 text-xs rounded transition-colors"
        >
          Clear
        </button>
        {selectedSkills.length > 0 && (
          <button
            onClick={() => { setSelectedSkills([]); onComposeSkillsChange?.([]); }}
            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400/80 text-xs rounded transition-colors flex items-center gap-1"
            title="Clear all skills"
          >
            <X className="w-3 h-3" />
            Clear Skills
          </button>
        )}
        <button
          onClick={() => {
            onSend({
              problems: selectedProblems,
              requests: selectedRequests,
              skills: selectedSkills,
              instruction: customInstruction,
              prompt: generatePrompt(),
              systemPromptIncluded: systemPromptIncluded,
            });
            setSelectedSkills([]);
            onComposeSkillsChange?.([]);
          }}
          disabled={!hasSelection || isSending}
          className="flex-1 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-zinc-700 disabled:to-zinc-700 disabled:text-zinc-500 text-white text-xs rounded flex items-center justify-center gap-1.5 transition-all"
        >
          {isSending ? (
            <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <Send className="w-3 h-3" />
          )}
          {isSending ? 'Sending...' : 'Send to Terminal'}
        </button>
      </div>
    </div>
  );
}

export default InstructionPanel;
