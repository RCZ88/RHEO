import { getToastDurationMs, isSticky } from '../lib/toastDuration';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import SkillDynamicForm from './SkillDynamicForm';
import DSLGenerationModal from './DSLGenerationModal';
import { VoiceInputWrapper } from '@/components/VoiceInputWrapper';

type TerminalTabInfo = { name: string; agent: string; modelTier?: string };

interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
  filePath: string;
}

type SkillsTabView = 'project' | 'browse' | 'saved';

export const SkillsTab: React.FC<{
  projectPath?: string;
  terminalTabs?: Record<string, TerminalTabInfo>;
  activeTerminalId?: string | null;
  onAddToCompose?: (skillId: string) => void;
}> = ({ projectPath, terminalTabs = {}, activeTerminalId, onAddToCompose }) => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [runningSkill, setRunningSkill] = useState<Skill | null>(null);
  const [skillPrompt, setSkillPrompt] = useState('');
  const [skillFormValues, setSkillFormValues] = useState<Record<string, any>>({});
  const [targetTerminal, setTargetTerminal] = useState('');
  const [dslSkill, setDslSkill] = useState<Skill | null>(null);
  const [activeView, setActiveView] = useState<SkillsTabView>(projectPath ? 'project' : 'browse');
  const [appSkills, setAppSkills] = useState<Skill[]>([]);
  const [savedSkillIds, setSavedSkillIds] = useState<string[]>([]);
  const [addingToProject, setAddingToProject] = useState<string | null>(null);
  const [savingSkill, setSavingSkill] = useState<string | null>(null);
  const [seedingWorkspace, setSeedingWorkspace] = useState(false);

  useEffect(() => {
    if (runningSkill?.inputs && runningSkill.inputs.length > 0) {
      const init: Record<string, any> = {};
      for (const input of runningSkill.inputs) {
        if (input.default !== undefined) {
          init[input.name] = input.default;
        } else {
          switch (input.type) {
            case 'boolean': init[input.name] = false; break;
            case 'number': init[input.name] = input.min || 0; break;
            case 'list':
            case 'multienum': init[input.name] = []; break;
            case 'enum': init[input.name] = input.choices?.[0] || ''; break;
            default: init[input.name] = '';
          }
        }
      }
      setSkillFormValues(init);
    } else {
      setSkillFormValues({});
    }
  }, [runningSkill]);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editContent, setEditContent] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [newDescription, setNewDescription] = useState('');
  const [newContent, setNewContent] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const [projectResult, appResult, savedResult] = await Promise.all([
        window.deskflowAPI?.getSkills?.(projectPath),
        window.deskflowAPI?.getAppSkills?.(),
        window.deskflowAPI?.getSavedSkills?.(),
      ]);
      if (projectResult?.success) setSkills(projectResult.data || []);
      if (appResult?.success) setAppSkills(appResult.data || []);
      if (savedResult?.success) setSavedSkillIds(savedResult.data || []);
    } catch (e) {
      console.error('[SkillsTab] Failed to load skills:', e);
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    loadSkills();
    const interval = setInterval(loadSkills, 10000);
    return () => clearInterval(interval);
  }, [loadSkills]);

  const categories = ['all', ...new Set(
    (activeView === 'project' ? skills : activeView === 'saved' ? appSkills.filter(a => savedSkillIds.includes(a.id)) : appSkills)
      .map(s => s.category || 'general')
  )];

  const filteredSkills = (() => {
    let source: Skill[];
    if (activeView === 'project') {
      source = skills;
    } else if (activeView === 'saved') {
      source = appSkills.filter(a => savedSkillIds.includes(a.id));
    } else {
      source = appSkills;
    }
    return source.filter(s => {
      if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.content.toLowerCase().includes(q);
      }
      return true;
    });
  })();

  const showNotify = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    const ms = getToastDurationMs();
    if (!isSticky(ms)) setTimeout(() => setNotification(null), ms);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const result = await window.deskflowAPI?.createSkill?.({
        name: newName.trim(),
        category: newCategory,
        description: newDescription.trim(),
        content: newContent,
        projectPath,
      });
      if (result?.success) {
        showNotify('Skill created successfully', 'success');
        setShowNewForm(false);
        setNewName(''); setNewCategory('general'); setNewDescription(''); setNewContent('');
        loadSkills();
      } else {
        showNotify(result?.error || 'Failed to create skill', 'error');
      }
    } catch (e) {
      showNotify('Failed to create skill', 'error');
    }
  };

  const handleUpdate = async () => {
    if (!editingSkill || !editName.trim()) return;
    try {
      const result = await window.deskflowAPI?.updateSkill?.({
        id: editingSkill.id,
        name: editName.trim(),
        category: editCategory,
        description: editDescription.trim(),
        content: editContent,
        projectPath,
      });
      if (result?.success) {
        showNotify('Skill updated successfully', 'success');
        setEditingSkill(null);
        loadSkills();
      } else {
        showNotify(result?.error || 'Failed to update skill', 'error');
      }
    } catch (e) {
      showNotify('Failed to update skill', 'error');
    }
  };

  const handleDelete = async (skill: Skill) => {
    if (!window.confirm(`Delete skill "${skill.name}"? This permanently removes the skill file.`)) return;
    try {
      const result = await window.deskflowAPI?.deleteSkill?.({
        id: skill.id,
        projectPath,
      });
      if (result?.success) {
        showNotify('Skill deleted', 'success');
        loadSkills();
      } else {
        showNotify(result?.error || 'Failed to delete skill', 'error');
      }
    } catch (e) {
      showNotify('Failed to delete skill', 'error');
    }
  };

  const handleAddToProject = async (skillId: string) => {
    if (!projectPath) {
      showNotify('No project selected', 'error');
      return;
    }
    setAddingToProject(skillId);
    try {
      const result = await window.deskflowAPI?.addSkillToProject?.({ skillId, projectPath });
      if (result?.success) {
        showNotify('Skill added to project', 'success');
        loadSkills();
      } else {
        showNotify(result?.error || 'Failed to add skill to project', 'error');
      }
    } catch (e) {
      showNotify('Failed to add skill to project', 'error');
    } finally {
      setAddingToProject(null);
    }
  };

  const handleSave = async (skillId: string) => {
    setSavingSkill(skillId);
    try {
      const result = await window.deskflowAPI?.saveWorkspaceSkill?.({ skillId });
      if (result?.success) {
        setSavedSkillIds(result.data || []);
        showNotify('Skill saved', 'success');
      }
    } catch (e) {
      showNotify('Failed to save skill', 'error');
    } finally {
      setSavingSkill(null);
    }
  };

  const handleUnsave = async (skillId: string) => {
    setSavingSkill(skillId);
    try {
      const result = await window.deskflowAPI?.unsaveWorkspaceSkill?.({ skillId });
      if (result?.success) {
        setSavedSkillIds(result.data || []);
        showNotify('Skill removed from saved', 'success');
      }
    } catch (e) {
      showNotify('Failed to unsave skill', 'error');
    } finally {
      setSavingSkill(null);
    }
  };

  const handleSeedWorkspace = async () => {
    if (!projectPath) { showNotify('No project selected', 'error'); return; }
    setSeedingWorkspace(true);
    try {
      const result = await window.deskflowAPI?.seedWorkspaceSkills?.({ sourceDir: projectPath });
      if (result?.success) {
        showNotify(`Synced ${result.data?.copied || 0} skills to workspace`, 'success');
        loadSkills();
      } else {
        showNotify(result?.error || 'Failed to sync skills', 'error');
      }
    } catch (e) {
      showNotify('Failed to sync skills', 'error');
    } finally {
      setSeedingWorkspace(false);
    }
  };

  const handleUse = async () => {
    if (!runningSkill) return;
    const terminalId = targetTerminal || activeTerminalId || Object.keys(terminalTabs)[0];
    if (!terminalId) {
      showNotify('No terminal available. Create a session first.', 'error');
      return;
    }
    try {
      const hasInputs = runningSkill.inputs && runningSkill.inputs.length > 0;
      const configLines = hasInputs
        ? Object.entries(skillFormValues)
            .filter(([_, v]) => v !== '' && v !== undefined && !(Array.isArray(v) && v.length === 0))
            .map(([key, val]) => `- ${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
            .join('\n')
        : '';
      const configSection = configLines ? `\n\n## Skill Configuration\n\n${configLines}` : '';
      const userSection = skillPrompt.trim() ? `\n\n${skillPrompt}` : '';
      const fullPrompt = `[Skill: ${runningSkill.name}]\n${runningSkill.content}${configSection}${userSection}`;
      await window.deskflowAPI?.terminalWrite?.(terminalId, fullPrompt + '\r\n');
      showNotify(`Sent "${runningSkill.name}" to terminal`, 'success');
      setRunningSkill(null);
      setSkillPrompt('');
    } catch (e) {
      showNotify('Failed to send to terminal', 'error');
    }
  };

  const openEditor = (skill: Skill) => {
    setEditingSkill(skill);
    setEditName(skill.name);
    setEditCategory(skill.category);
    setEditDescription(skill.description);
    setEditContent(skill.content);
  };

  const renderSkillCard = (skill: Skill, showProjectActions: boolean) => {
    const isSaved = savedSkillIds.includes(skill.id);
    const inProject = skills.some(s => s.id === skill.id);
    return (
      <div key={skill.id} className="bg-zinc-800/50 border border-zinc-700/50 rounded overflow-hidden">
        <div className="px-2 py-2 flex items-start justify-between cursor-pointer hover:bg-zinc-800/80" onClick={() => setExpandedId(expandedId === skill.id ? null : skill.id)}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-medium text-zinc-200">{skill.name}</span>
              <span className="text-[9px] px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 rounded">{skill.category || 'general'}</span>
              {isSaved && (
                <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded">Saved</span>
              )}
              {inProject && (
                <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded">In Project</span>
              )}
            </div>
            {skill.description && (
              <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-1">{skill.description}</p>
            )}
          </div>
          <div className="flex gap-1 ml-2 flex-shrink-0">
            {onAddToCompose && projectPath && inProject && (
              <button
                onClick={e => { e.stopPropagation(); onAddToCompose(skill.id); }}
                className="px-2 py-0.5 bg-cyan-600 hover:bg-cyan-500 text-cyan-100 text-[10px] rounded"
                title="Add skill to compose"
              >
                Use
              </button>
            )}
            {activeView !== 'project' && (
              isSaved ? (
                <button
                  onClick={e => { e.stopPropagation(); handleUnsave(skill.id); }}
                  disabled={savingSkill === skill.id}
                  className="px-2 py-0.5 bg-amber-600/50 hover:bg-amber-500 text-amber-200 text-[10px] rounded disabled:opacity-50"
                  title="Remove from saved"
                >
                  {savingSkill === skill.id ? '...' : 'Unsave'}
                </button>
              ) : (
                <button
                  onClick={e => { e.stopPropagation(); handleSave(skill.id); }}
                  disabled={savingSkill === skill.id}
                  className="px-2 py-0.5 bg-zinc-600 hover:bg-zinc-500 text-zinc-200 text-[10px] rounded disabled:opacity-50"
                  title="Save to workspace"
                >
                  {savingSkill === skill.id ? '...' : 'Save'}
                </button>
              )
            )}
            {showProjectActions && projectPath && !inProject && activeView !== 'project' && (
              <button
                onClick={e => { e.stopPropagation(); handleAddToProject(skill.id); }}
                disabled={addingToProject === skill.id}
                className="px-2 py-0.5 bg-indigo-600/50 hover:bg-indigo-500 text-indigo-200 text-[10px] rounded disabled:opacity-50"
                title="Add to current project"
              >
                {addingToProject === skill.id ? '...' : '+ Project'}
              </button>
            )}
            <button
              onClick={e => { e.stopPropagation(); setDslSkill(skill); }}
              className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-amber-100 text-[10px] rounded"
              title="Generate DSL frontmatter"
            >
              DSL
            </button>
            {activeView === 'project' && (
              <button
                onClick={e => { e.stopPropagation(); openEditor(skill); }}
                className="px-2 py-0.5 bg-zinc-600 hover:bg-zinc-500 text-zinc-200 text-[10px] rounded"
                title="Edit skill"
              >
                Edit
              </button>
            )}
          </div>
        </div>
        {expandedId === skill.id && (
          <div className="px-2 pb-2 border-t border-zinc-700/30">
            <pre className="mt-2 p-2 bg-zinc-900 rounded text-[10px] text-zinc-400 overflow-x-auto max-h-60 overflow-y-auto whitespace-pre-wrap font-mono">
              {skill.content}
            </pre>
            <div className="flex gap-2 mt-2">
              <span className="text-[10px] text-zinc-600">Path: {skill.filePath}</span>
              {activeView === 'project' && (
                <button onClick={() => handleDelete(skill)} className="ml-auto px-2 py-0.5 bg-red-600/30 hover:bg-red-600/50 text-red-300 text-[10px] rounded">Delete</button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-2 rounded text-xs shadow-lg transition-opacity ${
          notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0.5 mb-2.5 bg-zinc-900/50 rounded p-0.5 border border-zinc-700/40">
        <button
          onClick={() => setActiveView('project')}
          className={`flex-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
            activeView === 'project' ? 'bg-indigo-600/30 text-indigo-300' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Project ({skills.length})
        </button>
        <button
          onClick={() => setActiveView('browse')}
          className={`flex-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
            activeView === 'browse' ? 'bg-indigo-600/30 text-indigo-300' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Browse ({appSkills.length})
        </button>
        <button
          onClick={() => setActiveView('saved')}
          className={`flex-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
            activeView === 'saved' ? 'bg-indigo-600/30 text-indigo-300' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Saved ({savedSkillIds.length})
        </button>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-zinc-400">
          {activeView === 'project' ? `${skills.length} project skill${skills.length !== 1 ? 's' : ''}` :
           activeView === 'saved' ? `${savedSkillIds.length} saved` :
           `${appSkills.length} available`}
        </span>
        <button
          onClick={() => setShowNewForm(true)}
          className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded flex items-center gap-1 transition-colors duration-150 active:scale-95"
        >
          <Plus className="w-3 h-3" />
          Create Skill
        </button>
      </div>

      {/* Seed workspace banner */}
      {activeView !== 'project' && appSkills.length === 0 && projectPath && (
        <div className="mb-3 px-2.5 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-[11px] text-amber-300 mb-2">No skills in workspace library yet.</p>
          <button
            onClick={handleSeedWorkspace}
            disabled={seedingWorkspace}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-amber-100 text-[10px] rounded disabled:opacity-50"
          >
            {seedingWorkspace ? 'Syncing...' : 'Sync skills from this project'}
          </button>
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        placeholder="Search skills..."
        className="w-full mb-2 px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
      />

      {/* Category Filter */}
      {categories.length > 1 && (
        <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors duration-150 ${
                categoryFilter === cat
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50'
                  : 'bg-transparent text-zinc-400 border border-zinc-700 hover:bg-zinc-800'
              }`}
            >
              {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && <p className="text-xs text-zinc-500">Loading skills...</p>}

      {/* Empty State */}
      {!loading && filteredSkills.length === 0 && (
        <div className="px-2 py-6 bg-indigo-500/5 border border-indigo-500/20 rounded text-center">
          <Sparkles className="w-6 h-6 text-indigo-400/50 mx-auto mb-2" />
          <p className="text-xs text-zinc-500 mb-3">
            {activeView === 'project'
              ? (skills.length === 0 ? 'No project skills. Add from Browse or create one.' : 'No skills match your search.')
              : activeView === 'saved'
              ? 'No saved skills. Browse and save skills you use often.'
              : appSkills.length === 0
              ? 'Workspace library is empty. Sync skills from a project.'
              : 'No skills match your search.'}
          </p>
        </div>
      )}

      {/* Skill List */}
      {filteredSkills.length > 0 && (
        <div className="space-y-2">
          {filteredSkills.map(skill => renderSkillCard(skill, activeView !== 'project'))}
        </div>
      )}

      {/* ── Run Skill Modal ── */}
      {runningSkill && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[var(--z-overlay)]" onClick={() => setRunningSkill(null)}>
          <div className="bg-zinc-800 rounded-xl w-full max-w-lg border border-zinc-700  mx-4" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-zinc-700 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Use Skill: {runningSkill.name}</h3>
              <button onClick={() => setRunningSkill(null)} className="text-zinc-400 hover:text-zinc-200">✕</button>
            </div>
            <div className="px-4 py-3 overflow-y-auto max-h-[55vh]">
              {runningSkill.inputs && runningSkill.inputs.length > 0 ? (
                <SkillDynamicForm
                  inputs={runningSkill.inputs}
                  values={skillFormValues}
                  onChange={setSkillFormValues}
                />
              ) : (
                <div className="mb-3 p-2 bg-zinc-900 rounded max-h-28 overflow-y-auto">
                  <pre className="text-[10px] text-zinc-400 whitespace-pre-wrap font-mono">{runningSkill.content.slice(0, 500)}{runningSkill.content.length > 500 ? '...' : ''}</pre>
                </div>
              )}
              <select
                value={targetTerminal}
                onChange={e => setTargetTerminal(e.target.value)}
                className="w-full mt-3 mb-2 px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
              >
                <option value="">Active terminal ({activeTerminalId ? terminalTabs[activeTerminalId]?.name || 'unnamed' : 'none'})</option>
                {Object.entries(terminalTabs).map(([id, tab]) => (
                  <option key={id} value={id}>{tab.name} ({tab.agent})</option>
                ))}
              </select>
              <VoiceInputWrapper>
                <textarea
                  value={skillPrompt}
                  onChange={e => setSkillPrompt(e.target.value)}
                  placeholder={runningSkill.inputs && runningSkill.inputs.length > 0 ? "Additional instructions or context..." : "Enter your prompt or instructions for this skill..."}
                  className="w-full px-2.5 py-2 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 min-h-[60px] resize-y"
                />
              </VoiceInputWrapper>
            </div>
            <div className="px-4 py-3 border-t border-zinc-700 flex gap-2 justify-end">
              <button onClick={() => setRunningSkill(null)} className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs rounded">Cancel</button>
              <button onClick={handleUse} disabled={!(runningSkill.inputs && runningSkill.inputs.length > 0) && !skillPrompt.trim()} className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs rounded disabled:opacity-50">Send to Terminal</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DSL Generation Modal ── */}
      {dslSkill && (
        <DSLGenerationModal
          skill={{
            id: dslSkill.id,
            name: dslSkill.name,
            description: dslSkill.description,
            content: dslSkill.content,
            filePath: dslSkill.filePath,
          }}
          terminals={Object.entries(terminalTabs).map(([id, tab]) => ({
            id,
            label: tab.name,
            agent: tab.agent,
            topic: tab.topic,
          }))}
          activeTerminalId={activeTerminalId}
          onClose={() => setDslSkill(null)}
          onSend={async (terminalId, prompt) => {
            await window.deskflowAPI?.terminalWrite?.(terminalId, prompt + '\r\n');
            showNotify(`DSL prompt sent to terminal for "${dslSkill?.name}"`, 'success');
          }}
        />
      )}

      {/* ── Edit Skill Modal ── */}
      {editingSkill && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[var(--z-overlay)]" onClick={() => setEditingSkill(null)}>
          <div className="bg-zinc-800 rounded-xl w-full max-w-lg border border-zinc-700  mx-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-zinc-700 flex items-center justify-between flex-shrink-0">
              <h3 className="text-sm font-bold text-white">Edit Skill: {editingSkill.name}</h3>
              <button onClick={() => setEditingSkill(null)} className="text-zinc-400 hover:text-zinc-200">✕</button>
            </div>
            <div className="px-4 py-3 overflow-y-auto flex-1 space-y-2">
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Skill name" className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-200" />
              <input type="text" value={editCategory} onChange={e => setEditCategory(e.target.value)} placeholder="Category" className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-200" />
              <input type="text" value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="Description" className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-200" />
              <VoiceInputWrapper>
                <textarea value={editContent} onChange={e => setEditContent(e.target.value)} placeholder="Skill content (markdown)" className="w-full px-2.5 py-2 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-200 font-mono min-h-[200px] resize-y" />
              </VoiceInputWrapper>
            </div>
            <div className="px-4 py-3 border-t border-zinc-700 flex gap-2 justify-end flex-shrink-0">
              <button onClick={() => setEditingSkill(null)} className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs rounded">Cancel</button>
              <button onClick={handleUpdate} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Skill Modal ── */}
      {showNewForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[var(--z-overlay)]" onClick={() => setShowNewForm(false)}>
          <div className="bg-zinc-800 rounded-xl w-full max-w-lg border border-zinc-700  mx-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-zinc-700 flex items-center justify-between flex-shrink-0">
              <h3 className="text-sm font-bold text-white">Create Skill</h3>
              <button onClick={() => setShowNewForm(false)} className="text-zinc-400 hover:text-zinc-200">✕</button>
            </div>
            <div className="px-4 py-3 overflow-y-auto flex-1 space-y-2">
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Skill name *" className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-200" />
              <input type="text" value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Category (e.g., coding, testing, review)" className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-200" />
              <input type="text" value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Short description" className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-200" />
              <VoiceInputWrapper>
                <textarea value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="Skill content (markdown) — include instructions, examples, and rules..." className="w-full px-2.5 py-2 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-200 font-mono min-h-[200px] resize-y" />
              </VoiceInputWrapper>
            </div>
            <div className="px-4 py-3 border-t border-zinc-700 flex gap-2 justify-end flex-shrink-0">
              <button onClick={() => setShowNewForm(false)} className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs rounded">Cancel</button>
              <button onClick={handleCreate} disabled={!newName.trim()} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded disabled:opacity-50">Create Skill</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
