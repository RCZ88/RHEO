Looking at this, I need to:
1. Extend `SkillsService.ts` with new interfaces and frontmatter parsing
2. Create `GeneralistDialog.tsx` as a new component
3. Wire it into `TerminalPage.tsx` sidebar header
4. Update a few SKILL.md files with example config data

Let me implement all of this.

---

## File 1: `src/services/SkillsService.ts` — Extended Interfaces & Parsing

Add these interfaces after the existing `Skill` interface, then update `loadSkillFromFile`:

```typescript
// ── Add after existing Skill interface ──────────────────────────

export interface SkillIO {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
  source?: string;
}

export interface SkillComponent {
  name: string;
  description?: string;
  type?: string;
  required?: boolean;
  source?: string;
}

// ── Modify existing Skill interface ─────────────────────────────

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
  filePath: string;
  inputs?: SkillIO[];      // NEW
  outputs?: SkillIO[];     // NEW
  components?: SkillComponent[];  // NEW
}

// ── Add helper function (module level) ──────────────────────────

function parseFrontmatterList(frontmatter: string, key: string): any[] {
  const lines = frontmatter.split('\n');
  const results: any[] = [];
  let inSection = false;
  let currentItem: any = null;

  for (const line of lines) {
    // Detect start of our target section
    if (line === `${key}:` || line.match(new RegExp(`^${key}:\\s*$`))) {
      inSection = true;
      continue;
    }

    // Detect end of section (new top-level key at column 0)
    if (inSection && line.match(/^\w[\w-]*:/) && !line.startsWith(' ')) {
      if (currentItem && Object.keys(currentItem).length > 0) {
        results.push(currentItem);
      }
      currentItem = null;
      inSection = false;
      continue;
    }

    if (!inSection) continue;

    // Skip blank lines
    if (line.trim() === '') continue;

    // New list item: "  - key: value"
    const newItemMatch = line.match(/^  - (\w+):\s*(.+)$/);
    if (newItemMatch) {
      if (currentItem && Object.keys(currentItem).length > 0) {
        results.push(currentItem);
      }
      currentItem = {};
      let val: any = newItemMatch[2].trim();
      if (val === 'true') val = true;
      else if (val === 'false') val = false;
      currentItem[newItemMatch[1]] = val;
      continue;
    }

    // Property of current item: "    key: value"
    const propMatch = line.match(/^    (\w+):\s*(.+)$/);
    if (propMatch && currentItem) {
      let val: any = propMatch[2].trim();
      if (val === 'true') val = true;
      else if (val === 'false') val = false;
      else if (val.startsWith('[') && val.endsWith(']')) {
        val = val.slice(1, -1).split(',').map((s: string) => s.trim());
      }
      currentItem[propMatch[1]] = val;
    }
  }

  // Don't forget the last item
  if (currentItem && Object.keys(currentItem).length > 0) {
    results.push(currentItem);
  }

  return results;
}

// ── Update loadSkillFromFile method ─────────────────────────────
// Find the existing loadSkillFromFile method and replace it with:

private loadSkillFromFile(filePath: string): Skill | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Extract frontmatter between --- markers
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    const frontmatter = frontmatterMatch ? frontmatterMatch[1] : '';

    // Existing field parsing
    const nameMatch = content.match(/^#\s+(.+?)\n/m) || frontmatter.match(/^name:\s*(.+?)$/m);
    const descMatch = frontmatter.match(/^description:\s*(.+?)$/m);
    const catMatch = frontmatter.match(/^category:\s*(.+?)$/m);

    // NEW: Parse inputs, outputs, components from frontmatter
    const inputs = parseFrontmatterList(frontmatter, 'inputs') as SkillIO[];
    const outputs = parseFrontmatterList(frontmatter, 'outputs') as SkillIO[];
    const components = parseFrontmatterList(frontmatter, 'components') as SkillComponent[];

    return {
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
  } catch (err) {
    console.error(`Failed to load skill from ${filePath}:`, err);
    return null;
  }
}
```

---

## File 2: `src/components/GeneralistDialog.tsx` — New Component

```typescript
import { useState, useEffect } from 'react';
import { Search, ChevronRight, ChevronDown, ArrowRight, ArrowLeft, Diamond, X, BookOpen } from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────

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

// ── Color maps ──────────────────────────────────────────────────

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

// ── Component ───────────────────────────────────────────────────

export default function GeneralistDialog({ onClose }: { onClose: () => void }) {
  const [skills, setSkills] = useState<SkillWithConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    setLoading(true);
    try {
      const result = await window.deskflowAPI?.getSkills();
      setSkills(result || []);
    } catch (err) {
      console.error('Failed to load skills:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Filtering ───────────────────────────────────────────────

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

  // ── Render helpers ──────────────────────────────────────────

  const renderIOItem = (item: SkillIO, accent: string) => (
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

  // ── Main render ─────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-zinc-800 rounded-xl w-full max-w-5xl max-h-[85vh] overflow-hidden border border-zinc-700 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-4.5 h-4.5 text-violet-400" />
            <h2 className="text-lg font-bold text-white">Skill Configuration</h2>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20">
              {skills.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Filter bar ─────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-zinc-700/50 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search skills, inputs, outputs..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-900/70 border border-zinc-700/50 rounded-lg text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-colors"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs bg-zinc-900/70 border border-zinc-700/50 rounded-lg px-2.5 py-1.5 text-zinc-300 focus:outline-none focus:border-violet-500/50 cursor-pointer"
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

        {/* ── Content ────────────────────────────────────────── */}
        <div className="overflow-y-auto px-6 py-4 flex-1">
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
                    className={`bg-zinc-900/50 rounded-lg border-l-2 ${borderColor} cursor-pointer hover:bg-zinc-800/50 transition-colors`}
                    onClick={() => setExpandedSkill(isExpanded ? null : skill.id)}
                  >
                    {/* Card header */}
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

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-3 pb-3 border-t border-zinc-800/70 pt-2.5 space-y-3">
                        {hasConfig(skill) ? (
                          <>
                            {/* Inputs */}
                            {skill.inputs && skill.inputs.length > 0 && (
                              <div>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <ArrowRight className="w-3 h-3 text-cyan-400" />
                                  <span className="text-[11px] font-medium text-cyan-400">Inputs</span>
                                  <span className="text-[9px] text-zinc-600">({skill.inputs.length})</span>
                                </div>
                                <div className="ml-4 space-y-0.5 divide-y divide-zinc-800/40">
                                  {skill.inputs.map((input, i) => (
                                    <div key={i}>{renderIOItem(input, 'cyan')}</div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Outputs */}
                            {skill.outputs && skill.outputs.length > 0 && (
                              <div>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <ArrowLeft className="w-3 h-3 text-green-400" />
                                  <span className="text-[11px] font-medium text-green-400">Outputs</span>
                                  <span className="text-[9px] text-zinc-600">({skill.outputs.length})</span>
                                </div>
                                <div className="ml-4 space-y-0.5 divide-y divide-zinc-800/40">
                                  {skill.outputs.map((output, i) => (
                                    <div key={i}>{renderIOItem(output, 'green')}</div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Components */}
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
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## File 3: `src/pages/TerminalPage.tsx` — Wire In

Three changes: import, state, button, dialog render.

### 3a. Add to the lucide-react import line

Find the existing import from `'lucide-react'` and add `BookOpen`:

```typescript
// BEFORE — find the existing import line, it looks something like:
import { Plus, X, Monitor, Play, Trash2, Clock, FolderOpen, Zap, Info, PanelLeftClose, ... } from 'lucide-react';

// AFTER — add BookOpen to the same import:
import { Plus, X, Monitor, Play, Trash2, Clock, FolderOpen, Zap, Info, PanelLeftClose, ..., BookOpen } from 'lucide-react';
```

### 3b. Add import for GeneralistDialog

Near the top of the file with other component imports:

```typescript
import GeneralistDialog from '../components/GeneralistDialog';
```

### 3c. Add state variables

Find the block of `useState` declarations (around line 155-190) and add:

```typescript
const [showGeneralistDialog, setShowGeneralistDialog] = useState(false);
```

### 3d. Add button in sidebar header

Find the sidebar header (around line 1605-1623). It currently looks like:

```tsx
<div className="flex items-center justify-between px-2 py-2 border-b border-zinc-800/70">
  <span className="text-xs text-zinc-500 font-medium">Terminal</span>
  <div className="flex items-center gap-1">
    <button onClick={() => setShowFeaturesDialog(true)}
      className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-cyan-300"
      title="Workspace Features">
      <Info className="w-3.5 h-3.5" />
    </button>
    <button onClick={() => setSidebarOpen(false)}
      className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-300">
      <PanelLeftClose className="w-3.5 h-3.5" />
    </button>
  </div>
</div>
```

Add the Generalist button between the Info button and the PanelLeftClose button:

```tsx
<div className="flex items-center justify-between px-2 py-2 border-b border-zinc-800/70">
  <span className="text-xs text-zinc-500 font-medium">Terminal</span>
  <div className="flex items-center gap-1">
    <button onClick={() => setShowFeaturesDialog(true)}
      className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-cyan-300"
      title="Workspace Features">
      <Info className="w-3.5 h-3.5" />
    </button>
    <button onClick={() => setShowGeneralistDialog(true)}
      className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-violet-300"
      title="Skill Configuration">
      <BookOpen className="w-3.5 h-3.5" />
    </button>
    <button onClick={() => setSidebarOpen(false)}
      className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-300">
      <PanelLeftClose className="w-3.5 h-3.5" />
    </button>
  </div>
</div>
```

### 3e. Render the dialog

Find where `FeaturesDialog` is rendered (search for `showFeaturesDialog`). Add the GeneralistDialog next to it:

```tsx
{showFeaturesDialog && (
  <FeaturesDialog onClose={() => setShowFeaturesDialog(false)} />
)}
{showGeneralistDialog && (
  <GeneralistDialog onClose={() => setShowGeneralistDialog(false)} />
)}
```

---

## File 4: Example SKILL.md Updates

Add `inputs`/`outputs`/`components` blocks to the YAML frontmatter of these skills:

### `agent/skills/generate-prompt/SKILL.md`

```yaml
---
id: generate-prompt
name: Generate Prompt
category: design
applicable_to: [prompts, design-specs]
version: 1.2.0
created: 2026-04-19
tags: [prompts, design, engineering]
inputs:
  - name: User Request
    type: text
    description: The user's original verbatim request
    required: true
    source: user
  - name: Context Bundle
    type: file
    description: CONTEXT_BUNDLE.md reference document
    required: true
    source: system
  - name: Design Constraints
    type: text
    description: Optional constraints or preferences
    required: false
    source: user
outputs:
  - name: Design Prompt
    type: markdown
    description: High-fidelity design specification prompt
  - name: Component Breakdown
    type: list
    description: Identified UI components and their relationships
components:
  - name: Raw Request Block
    description: User's verbatim request section
    source: user
  - name: Context Reference
    description: CONTEXT_BUNDLE.md as source of truth
    source: system
  - name: Prompt Template
    description: Base prompt structure with variable slots
    source: system
---
```

### `agent/skills/deep-research/SKILL.md`

```yaml
---
id: deep-research
name: Deep Research
category: research
inputs:
  - name: Research Topic
    type: text
    description: The topic or question to research
    required: true
    source: user
  - name: Depth Level
    type: enum
    description: How deep to investigate (surface, standard, deep)
    required: false
    source: user
  - name: Existing Context
    type: file
    description: Prior research or context documents
    required: false
    source: system
outputs:
  - name: Research Report
    type: markdown
    description: Comprehensive research findings document
  - name: Source List
    type: list
    description: Referenced sources, URLs, and citations
  - name: Key Findings
    type: list
    description: Bullet-point summary of critical discoveries
components:
  - name: Search Strategy
    description: Defines search terms, angles, and approach
    source: agent
  - name: Synthesis Engine
    description: Combines findings into a coherent narrative
    source: system
  - name: Citation Tracker
    description: Maintains source attribution throughout
    source: agent
---
```

### `agent/skills/fix-problems/SKILL.md`

```yaml
---
id: fix-problems
name: Fix Problems
category: development
inputs:
  - name: Problem Description
    type: text
    description: The bug or issue to fix
    required: true
    source: user
  - name: Error Logs
    type: text
    description: Relevant error messages and stack traces
    required: false
    source: system
  - name: Codebase Context
    type: file
    description: Related source files and architecture docs
    required: false
    source: system
outputs:
  - name: Fix Patch
    type: code
    description: Code changes that resolve the problem
  - name: Explanation
    type: markdown
    description: Root cause analysis and fix rationale
components:
  - name: Root Cause Analysis
    description: Identifies the underlying cause of the issue
    source: agent
  - name: Verification Steps
    description: Steps to confirm the fix resolves the problem
    source: agent
  - name: Regression Check
    description: Ensures fix doesn't introduce new issues
    source: agent
---
```

### `agent/skills/recursive-playwright/SKILL.md`

```yaml
---
id: recursive-playwright
name: Recursive Playwright
category: testing
inputs:
  - name: Target URL
    type: text
    description: URL of the application to test
    required: true
    source: user
  - name: Test Scope
    type: enum
    description: Breadth of testing (smoke, functional, full)
    required: false
    source: user
  - name: Auth Credentials
    type: text
    description: Login credentials if app requires authentication
    required: false
    source: user
outputs:
  - name: Test Results
    type: markdown
    description: Detailed test execution results and findings
  - name: Bug Reports
    type: list
    description: Discovered issues with reproduction steps
components:
  - name: Playwright Runner
    description: Executes browser automation scripts
    source: system
  - name: Recursive Explorer
    description: Discovers and traverses application routes
    source: agent
  - name: Result Analyzer
    description: Interprets test outcomes and flags failures
    source: agent
---
```

### `agent/skills/readme-generator/SKILL.md`

```yaml
---
id: readme-generator
name: README Generator
category: writing
inputs:
  - name: Project Path
    type: file
    description: Root directory of the project
    required: true
    source: user
  - name: Package JSON
    type: file
    description: package.json for dependency and script info
    required: true
    source: system
  - name: Style Preference
    type: enum
    description: Output style (minimal, standard, comprehensive)
    required: false
    source: user
outputs:
  - name: README Content
    type: markdown
    description: Generated README.md file content
components:
  - name: Project Scanner
    description: Analyzes project structure and key files
    source: system
  - name: Template Engine
    description: Fills README template with project data
    source: system
---
```

### `agent/skills/maintain-context/SKILL.md`

```yaml
---
id: maintain-context
name: Maintain Context
category: general
inputs:
  - name: Session History
    type: text
    description: Recent conversation or session context
    required: true
    source: system
  - name: State File
    type: file
    description: Current agent/state.md content
    required: true
    source: system
outputs:
  - name: Updated State
    type: markdown
    description: Revised state.md with current progress
  - name: Context Summary
    type: text
    description: Compressed context for token efficiency
components:
  - name: State Tracker
    description: Monitors what has changed since last update
    source: system
  - name: Context Compressor
    description: Reduces token count while preserving key info
    source: agent
---
```

---

## Verification Checklist

1. **`npm run build`** — Must compile both renderer (vite) and electron (tsc) with zero errors
2. **Open terminal sidebar** → click the 📖 (BookOpen) button in the header, next to ℹ️
3. **Dialog opens** — glass overlay with violet-accented header, skill grid loads
4. **Search** — type "prompt" → filters to generate-prompt and related skills
5. **Category dropdown** — select "design" → shows only design-category skills
6. **Click a skill card** — expands to show Inputs (→ cyan), Outputs (← green), Components (◆ violet)
7. **Skill without config** — shows "No extended configuration defined."
8. **Click ✕ or backdrop** — dialog closes cleanly
9. **Existing Skills tab** — still works, CRUD unchanged
10. **Skills with new frontmatter** — data flows from SKILL.md → SkillsService parser → IPC → GeneralistDialog render