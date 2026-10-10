import { useState, useEffect } from 'react';
import { Search, ChevronRight, ChevronDown, ArrowRight, ArrowLeft, Diamond, X, BookOpen } from 'lucide-react';
import SkillDynamicForm from './SkillDynamicForm';
import { ModalShell, FORM_INPUT, FORM_SELECT } from './workspace/_ds/modal';

interface SkillIO {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
  source?: string;
}

interface SkillComponent {
  name: string;
  description?: string;
  type?: string;
  required?: boolean;
  source?: string;
}

interface SkillWithConfig {
  id: string;
  name: string;
  description: string;
  category: string;
  inputs?: SkillIO[];
  outputs?: SkillIO[];
  components?: SkillComponent[];
}

const categoryBorderColors: Record<string, string> = {
  design: 'border-pink-500/40',
  development: 'border-blue-500/40',
  research: 'border-cyan-500/40',
  writing: 'border-amber-500/40',
  testing: 'border-emerald-500/40',
  general: 'border-zinc-500/40',
};

const categoryBadgeColors: Record<string, string> = {
  design: 'bg-pink-500/15 text-pink-400 border border-pink-500/20',
  development: 'bg-blue-500/15 text-blue-400 border border-blue-500/20',
  research: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20',
  writing: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
  testing: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
  general: 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/20',
};

const sourceBadgeColors: Record<string, string> = {
  user: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
  system: 'bg-zinc-700/50 text-zinc-300 border border-zinc-600/30',
  agent: 'bg-violet-500/10 text-violet-400 border border-violet-500/20',
};

interface GeneralistDialogProps {
  onClose: () => void;
  onUseSkill?: (skill: any, values: Record<string, any>) => void;
}

export default function GeneralistDialog({ onClose, onUseSkill }: GeneralistDialogProps) {
  const [skills, setSkills] = useState<SkillWithConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [configuringSkill, setConfiguringSkill] = useState<string | null>(null);
  const [skillFormValues, setSkillFormValues] = useState<Record<string, any>>({});

  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    setLoading(true);
    try {
      const result = await window.deskflowAPI?.getSkills();
      setSkills(Array.isArray(result) ? result : (result?.data || []));
    } catch (err) {
      console.error('Failed to load skills:', err);
    } finally {
      setLoading(false);
    }
  };

  const categories = ['all', ...Array.from(new Set(skills.map(s => s.category))).sort()];

  const filteredSkills = skills.filter(skill => {
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      skill.name.toLowerCase().includes(q) ||
      (skill.description || '').toLowerCase().includes(q) ||
      (skill.inputs || []).some(i => i.name.toLowerCase().includes(q)) ||
      (skill.outputs || []).some(o => o.name.toLowerCase().includes(q)) ||
      (skill.components || []).some(c => c.name.toLowerCase().includes(q));
    const matchesCategory = categoryFilter === 'all' || skill.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const hasConfig = (skill: SkillWithConfig) =>
    (skill.inputs && skill.inputs.length > 0) ||
    (skill.outputs && skill.outputs.length > 0) ||
    (skill.components && skill.components.length > 0);

  const renderIOItem = (item: SkillIO) => (
    <div className="py-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-zinc-200 font-medium">{item.name}</span>
        {item.type && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50">
            {item.type}
          </span>
        )}
        {item.required && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
            required
          </span>
        )}
        {item.source && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${sourceBadgeColors[item.source] || sourceBadgeColors.system}`}>
            {item.source}
          </span>
        )}
      </div>
      {item.description && (
        <p className="text-[10px] text-zinc-500 mt-0.5">{item.description}</p>
      )}
    </div>
  );

  const renderComponentItem = (item: SkillComponent) => (
    <div className="py-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-zinc-200 font-medium">{item.name}</span>
        {item.type && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50">
            {item.type}
          </span>
        )}
        {item.required && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
            required
          </span>
        )}
        {item.source && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${sourceBadgeColors[item.source] || sourceBadgeColors.system}`}>
            {item.source}
          </span>
        )}
      </div>
      {item.description && (
        <p className="text-[10px] text-zinc-500 mt-0.5">{item.description}</p>
      )}
    </div>
  );

  return (
    <ModalShell
      open={true}
      onClose={onClose}
      title="Skill Configuration"
      subtitle={`${skills.length} skills available`}
      accent="purple"
      maxWidth="max-w-5xl"
    >
      {/* Search + Filter bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search skills, inputs, outputs..."
            className={`w-full pl-8 pr-3 py-1.5 text-[11px] ${FORM_INPUT}`}
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className={`text-[11px] ${FORM_SELECT} !w-auto`}
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>
              {cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </option>
          ))}
        </select>
        <span className="text-[10px] text-zinc-500 shrink-0">
          {filteredSkills.length} skill{filteredSkills.length !== 1 ? 's' : ''}
        </span>
      </div>

        <div className="px-1 py-1 flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-400 rounded-full animate-spin" />
              <span className="text-xs text-zinc-500">Loading skills...</span>
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <span className="text-xs text-zinc-500">No skills match your filters.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredSkills.map(skill => {
                const isExpanded = expandedSkill === skill.id;
                const borderColor = categoryBorderColors[skill.category] || categoryBorderColors.general;
                const badgeColor = categoryBadgeColors[skill.category] || categoryBadgeColors.general;

                return (
                  <div
                    key={skill.id}
                    className={`bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] rounded-lg border-l-2 ${borderColor} cursor-pointer hover:bg-zinc-800/50 transition-colors`}
                    onClick={() => setExpandedSkill(isExpanded ? null : skill.id)}
                  >
                    <div className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-semibold text-white truncate">
                            {skill.name}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${badgeColor}`}>
                            {skill.category}
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        )}
                      </div>
                      {skill.description && (
                        <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{skill.description}</p>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="px-3 pb-3 border-t border-zinc-800/70 pt-2.5 space-y-3">
                        {hasConfig(skill) ? (
                          <>
                            {skill.inputs && skill.inputs.length > 0 && (
                              <div>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <ArrowRight className="w-3 h-3 text-cyan-400" />
                                  <span className="text-[11px] font-medium text-cyan-400">Inputs</span>
                                  <span className="text-[9px] text-zinc-600">({skill.inputs.length})</span>
                                </div>
                                <div className="ml-4 space-y-0.5 divide-y divide-zinc-800/40">
                                  {skill.inputs.map((input, i) => (
                                    <div key={i}>{renderIOItem(input)}</div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {skill.outputs && skill.outputs.length > 0 && (
                              <div>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <ArrowLeft className="w-3 h-3 text-green-400" />
                                  <span className="text-[11px] font-medium text-green-400">Outputs</span>
                                  <span className="text-[9px] text-zinc-600">({skill.outputs.length})</span>
                                </div>
                                <div className="ml-4 space-y-0.5 divide-y divide-zinc-800/40">
                                  {skill.outputs.map((output, i) => (
                                    <div key={i}>{renderIOItem(output)}</div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {skill.components && skill.components.length > 0 && (
                              <div>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <Diamond className="w-3 h-3 text-violet-400" />
                                  <span className="text-[11px] font-medium text-violet-400">Components</span>
                                  <span className="text-[9px] text-zinc-600">({skill.components.length})</span>
                                </div>
                                <div className="ml-4 space-y-0.5 divide-y divide-zinc-800/40">
                                  {skill.components.map((comp, i) => (
                                    <div key={i}>{renderComponentItem(comp)}</div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-[11px] text-zinc-600 italic py-1">
                            No extended configuration defined.
                          </p>
                        )}

                        {skill.inputs && skill.inputs.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-zinc-800/40">
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
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
    </ModalShell>
  );
}
