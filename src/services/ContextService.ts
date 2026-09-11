import { DEFAULT_CONTEXT_CONFIG, type ContextConfig } from './ContextConfig';
export { DEFAULT_CONTEXT_CONFIG, type ContextConfig } from './ContextConfig';

// Vault Sync — canonical copies live in Obsidian vault at CZVault/00_Projects/AppTracker/Graph/
// Graphify: graphify-out/GRAPH_REPORT.md  |  QMD templates: agent/templates/
// Update graphify: python agent/skills/maintain-context/graphify_maintain.py rebuild

export interface SystemInfo {
  id: string;
  name: string;
  itemCount: number;
  itemLabel: string;
  lastBuilt: string | null;
  tokenEstimate: number;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars);
}

function condenseStateMd(fullContent: string, maxTokens: number): string {
  const sections = fullContent.split(/###?\s+20\d{2}-\d{2}-\d{2}/);
  if (sections.length <= 1) return truncateToTokens(fullContent, maxTokens);
  const header = sections[0];
  const recentSections = sections.slice(-3);
  let result = header;
  for (const section of recentSections) {
    result += '\n### ' + section;
  }
  return truncateToTokens(result, maxTokens);
}

async function readFile(projectPath: string, relativePath: string): Promise<string> {
  try {
    const result = await (window as any).deskflowAPI?.readProjectFile?.(relativePath, projectPath);
    if (result?.success && result.data) return result.data as string;
  } catch {}
  return '';
}

async function listDir(projectPath: string, relativePath: string): Promise<string[]> {
  try {
    const result = await (window as any).deskflowAPI?.listDirectory?.(projectPath, relativePath);
    if (result?.success && result.data) return result.data as string[];
  } catch {}
  return [];
}

function parseSkillFrontmatter(content: string) {
  const nameMatch = content.match(/^#\s+(.+?)\n/m) || content.match(/^name:\s*(.+?)$/m);
  const descMatch = content.match(/description:\s*(.+?)$/m);
  const catMatch = content.match(/category:\s*(.+?)$/m);
  return {
    name: nameMatch?.[1]?.trim() || 'Unknown',
    description: descMatch?.[1]?.trim() || '',
    category: catMatch?.[1]?.trim() || 'general',
    content: content,
  };
}

export async function getSystemInfo(projectPath: string, config: ContextConfig): Promise<SystemInfo[]> {
  const infos: SystemInfo[] = [];
  const dapi = (window as any).deskflowAPI;

  if (config.systems.llm_wiki.enabled) {
    let count = 0;
    const files = config.systems.llm_wiki.files.length > 0
      ? config.systems.llm_wiki.files
      : ['state.md', 'context.md', 'PROBLEMS.md', 'REQUESTS.md', 'AGENTS.md', 'debugging.md'];
    for (const f of files) {
      const content = await readFile(projectPath, `agent/${f}`);
      if (content) count++;
    }
    infos.push({ id: 'llm_wiki', name: 'LLM Wiki', itemCount: count, itemLabel: 'files', lastBuilt: null, tokenEstimate: config.systems.llm_wiki.max_tokens });
  }

  if (config.systems.obsidian_skills.enabled) {
    const result = await dapi?.getSkills?.(projectPath);
    const count = result?.success ? (result.data?.length || 0) : 0;
    infos.push({ id: 'obsidian_skills', name: 'Obsidian Skills', itemCount: count, itemLabel: 'skills', lastBuilt: null, tokenEstimate: config.systems.obsidian_skills.max_tokens });
  }

  if (config.systems.graphify.enabled) {
    let nodes = 0, edges = 0, lastBuilt: string | null = null;
    const graphContent = await readFile(projectPath, 'graphify-out/graph.json');
    if (graphContent) {
      try {
        const g = JSON.parse(graphContent);
        nodes = (g.nodes || []).length;
        edges = (g.edges || []).length;
      } catch {}
    }
    const reportContent = await readFile(projectPath, 'graphify-out/GRAPH_REPORT.md');
    if (reportContent) lastBuilt = new Date().toISOString();
    infos.push({ id: 'graphify', name: 'Graphify', itemCount: nodes, itemLabel: nodes > 0 ? `${nodes} nodes` : 'not built', lastBuilt, tokenEstimate: config.systems.graphify.max_tokens });
  }

  if (config.systems.para.enabled) {
    let areas = 0;
    const items = await listDir(projectPath, 'CZVault');
    areas = items.filter(i => !i.endsWith('.md')).length;
    infos.push({ id: 'para', name: 'PARA', itemCount: areas, itemLabel: 'areas', lastBuilt: null, tokenEstimate: config.systems.para.max_tokens });
  }

  if (config.systems.qmd.enabled) {
    const templates = await listDir(projectPath, 'agent/templates');
    const count = templates.filter(t => t.endsWith('.qmd')).length;
    infos.push({ id: 'qmd', name: 'QMD Templates', itemCount: count, itemLabel: 'templates', lastBuilt: null, tokenEstimate: config.systems.qmd.max_tokens });
  }

  if (config.systems.automations.enabled) {
    const autoContent = await readFile(projectPath, 'agent/automations/automations.json');
    const count = autoContent ? (() => { try { return JSON.parse(autoContent).length; } catch { return 0; } })() : 0;
    infos.push({ id: 'automations', name: 'Automations', itemCount: count, itemLabel: 'automations', lastBuilt: null, tokenEstimate: config.systems.automations.max_tokens });
  }

  if (config.systems.design_skills?.enabled) {
    const skillCount = (config.systems.design_skills.skills || []).length;
    infos.push({ id: 'design_skills', name: 'Design Skills', itemCount: skillCount, itemLabel: 'skills', lastBuilt: null, tokenEstimate: config.systems.design_skills.max_tokens });
  }

  return infos;
}

export interface AssembleOptions {
  sessionId?: string;
  problemId?: string;
  problemTitle?: string;
}

async function readRulesCompact(projectPath: string, opts?: AssembleOptions): Promise<string> {
  const content = await readFile(projectPath, 'agent/RULES_COMPACT.md');
  if (!content) return '';
  return content
    .replace(/\{\{PROBLEM_ID\}\}/g, opts?.problemId || 'none')
    .replace(/\{\{PROBLEM_TITLE\}\}/g, opts?.problemTitle || 'none');
}

async function readFileUncapped(projectPath: string, relativePath: string): Promise<string> {
  return await readFile(projectPath, relativePath);
}

export async function assembleContext(projectPath: string, config: ContextConfig, opts?: AssembleOptions): Promise<string> {
  const budget = config.total_token_budget || 7000;
  const tier = config.model_tier || 'mid';
  let prompt = '';
  let usedTokens = 0;

  const add = async (content: string) => {
    const tokens = estimateTokens(content);
    if (usedTokens + tokens <= budget) {
      prompt += content;
      usedTokens += tokens;
    }
  };

  const forceAdd = (content: string) => {
    prompt += content;
    usedTokens += estimateTokens(content);
  };

  // ── LAYER 0: RULES COMPACT (always injected, top priority) ──
  const rulesCompact = await readRulesCompact(projectPath, opts);
  if (rulesCompact.trim()) {
    forceAdd(`[LAYER 0 — IDENTITY & CONSTRAINTS]\n${rulesCompact}\n`);
  }

  // ── LAYER 1: STATE SNAPSHOT (always injected regardless of budget) ──
  const stateContent = await readFileUncapped(projectPath, 'agent/state.md');
  if (stateContent.trim()) {
    const truncated = stateContent.length > 2000 ? condenseStateMd(stateContent, 500) : stateContent.slice(0, 2000);
    forceAdd(`[LAYER 1 — CURRENT STATE SNAPSHOT]\n${truncated}\n`);
  }

  const patternsContent = await readFileUncapped(projectPath, 'agent/patterns.md');
  if (patternsContent.trim()) {
    const truncated = patternsContent.slice(0, 1500);
    forceAdd(`[LAYER 2 — PATTERNS & CONVENTIONS]\n${truncated}\n`);
  }

  // ── LAYER 2.5: HOT MEMORIES (auto-loaded critical lessons) ──
  if (config.deep_memory?.enabled) {
    try {
      const dapi = (window as any).deskflowAPI;
      const hotMemories = await dapi?.memoryGetHot?.(config.deep_memory.hot.max_entries || 15);
      if (hotMemories && hotMemories.length > 0) {
        const maxTokens = config.deep_memory.hot.max_tokens || 1200;
        let output = '[LAYER 2.5 — CRITICAL MEMORIES (auto-loaded)]\nYou MUST remember these lessons from past sessions:\n';
        let tokenCount = estimateTokens(output);
        for (const m of hotMemories) {
          const line = `• [${m.category.toUpperCase()}] ${m.content}\n`;
          const lineTokens = estimateTokens(line);
          if (tokenCount + lineTokens > maxTokens) break;
          output += line;
          tokenCount += lineTokens;
        }
        forceAdd(output);
      }
    } catch {}
  }

  // ── LAYER 2.6: USER CONTEXT PROFILE ──
  try {
    const dapi2 = (window as any).deskflowAPI;
    const profile = await dapi2?.contextGetProfile?.();
    if (profile) {
      const traitKeys = Object.keys(profile.traits || {})
      const interestKeys = Object.keys(profile.interests || {})
      const commKeys = Object.keys(profile.communicationStyle || {})
      if (traitKeys.length > 0 || interestKeys.length > 0 || profile.summary) {
        let profileOutput = '[LAYER 2.6 — USER PROFILE (auto-derived)]\n';
        if (profile.summary) profileOutput += 'Summary: ' + profile.summary + '\n';
        if (traitKeys.length > 0) profileOutput += 'Traits: ' + traitKeys.map((k: string) => profile.traits[k].content).join(', ') + '\n';
        if (interestKeys.length > 0) profileOutput += 'Interests: ' + interestKeys.map((k: string) => profile.interests[k].content).join(', ') + '\n';
        if (commKeys.length > 0) profileOutput += 'Communication: ' + commKeys.map((k: string) => profile.communicationStyle[k].content).join(', ') + '\n';
        if (profile.activityPattern?.primary_work_window) profileOutput += 'Most active: ' + profile.activityPattern.primary_work_window + '\n';
        if (profile.activityPattern?.focus_pattern) profileOutput += 'Focus pattern: ' + profile.activityPattern.focus_pattern + '\n';
        // Memory highlights (top corrections/rules for agent guardrails)
        const highlights = profile.memoryHighlights || [];
        if (highlights.length > 0) {
          const corrections = highlights.filter((h: any) => h.source === 'signal' && h.importance > 0.5);
          if (corrections.length > 0) {
            profileOutput += 'Important rules/corrections:\n';
            for (const h of corrections.slice(0, 5)) profileOutput += `  - ${h.content}\n`;
          }
        }
        forceAdd(profileOutput);
      }
    }
  } catch {}

  // ── LAYER 3: TASK CONTEXT — Problem-Aware Injection ──
  let layer3Content = '';
  if (opts?.problemId && opts?.problemId !== 'none') {
    const problemsRaw = await readFile(projectPath, 'agent/problems.json');
    let problemDetail = `Problem ID: ${opts.problemId}\nTitle: ${opts.problemTitle || 'Unknown'}\n`;
    if (problemsRaw) {
      try {
        const problems = JSON.parse(problemsRaw);
        const match = problems.find((p: any) => p.id === opts.problemId || p.title === opts.problemTitle);
        if (match) {
          problemDetail = `Problem ID: ${match.id}\nTitle: ${match.title}\nPriority: ${match.priority || 'medium'}\nStatus: ${match.status || 'NEW'}\nDescription: ${match.description || 'N/A'}\nRoot Cause: ${match.root_cause || 'N/A'}\n`;
        }
      } catch {}
    }
    forceAdd(`[LAYER 3 — ACTIVE PROBLEM]\n${problemDetail}\n`);
  }

  // ── LAYER 4: KNOWLEDGE SYSTEMS (tier-aware) ──
  let layer4Content = '';

  const addLayer4 = async (content: string) => {
    layer4Content += content;
  };

  if (tier !== 'low' && config.systems.llm_wiki.enabled) {
    await addLayer4(await buildLLMWikiContext(projectPath, config));
  }
  if (tier !== 'low' && config.systems.obsidian_skills.enabled) {
    const skillsContent = await buildSkillIndex(projectPath, config);
    if (tier === 'mid') {
      const lines = skillsContent.split('\n');
      const truncated = lines.slice(0, 8).join('\n');
      await addLayer4(truncated + '\n');
    } else if (tier === 'low') {
      const lines = skillsContent.split('\n');
      const topSkills = lines.filter(l => {
        if (!opts?.problemTitle) return true;
        const keywords = opts.problemTitle.toLowerCase().split(/\s+/);
        return keywords.some(kw => l.toLowerCase().includes(kw) || kw.includes(l.toLowerCase().slice(0, 4)));
      });
      await addLayer4(topSkills.slice(0, 5).join('\n') + '\n');
    } else {
      await addLayer4(skillsContent);
    }
  }
  if (tier === 'top' && config.systems.graphify.enabled) {
    await addLayer4(await buildGraphifyContext(projectPath, config));
  }
  if (tier === 'top' && config.systems.para.enabled) {
    await addLayer4(await buildParaContext(projectPath, config));
  }
  if (tier !== 'low' && config.systems.qmd.enabled) {
    await addLayer4(await buildQMDContext(projectPath, config));
  }
  if (tier === 'top' && config.systems.automations.enabled) {
    await addLayer4(await buildAutomationsContext(projectPath, config));
  }
  if (config.systems.design_skills?.enabled) {
    const dsContent = await buildDesignSkillsContext(projectPath, config);
    if (tier === 'low') {
      const lines = dsContent.split('\n');
      await addLayer4(lines.slice(0, 5).join('\n') + '\n');
    } else {
      await addLayer4(dsContent);
    }
  }
  if (config.deep_memory.enabled) {
    await addLayer4(await buildDeepMemoryContext(projectPath, config));
  }

  if (layer4Content.trim()) {
    await add(`[LAYER 4 — REFERENCE MATERIAL]\n${layer4Content}\n`);
  }

  return prompt;
}

async function buildLLMWikiContext(projectPath: string, config: ContextConfig): Promise<string> {
  const maxTokens = config.systems.llm_wiki.max_tokens || 2000;
  let content = '';

  const filePriority = [
    { file: 'state.md', label: 'Project State', maxTokens: 800 },
    { file: 'context.md', label: 'Project Context', maxTokens: 600 },
    { file: 'PROBLEMS.md', label: 'Active Problems', maxTokens: 400 },
    { file: 'REQUESTS.md', label: 'Active Requests', maxTokens: 200 },
    { file: 'debugging.md', label: 'Debugging Patterns', maxTokens: 200 },
    { file: 'data.md', label: 'Data Schemas', maxTokens: 200 },
    { file: 'AGENTS.md', label: 'Agent Configuration', maxTokens: 200 },
  ];

  const enabledFiles = config.systems.llm_wiki.files;

  for (const { file, label, maxTokens: fileMax } of filePriority) {
    if (enabledFiles.length > 0 && !enabledFiles.includes(file)) continue;
    const fileContent = await readFile(projectPath, `agent/${file}`);
    if (!fileContent) continue;

    let truncated = file === 'state.md' && fileContent.length > 2000
      ? condenseStateMd(fileContent, fileMax)
      : truncateToTokens(fileContent, fileMax);

    if (truncated.trim()) {
      content += `\n## ${label}\n${truncated}\n`;
    }
  }

  return content;
}

async function buildSkillIndex(projectPath: string, config: ContextConfig): Promise<string> {
  const maxTokens = config.systems.obsidian_skills.max_tokens || 500;
  const enabledSkills = config.systems.obsidian_skills.skills;

  let content = '## Available Skills\n';
  const skillDirs = await listDir(projectPath, 'agent/skills');

  for (const skillDir of skillDirs) {
    if (!skillDir || skillDir.endsWith('.md')) continue;
    const skillContent = await readFile(projectPath, `agent/skills/${skillDir}/SKILL.md`);
    if (!skillContent) continue;
    const parsed = parseSkillFrontmatter(skillContent);
    if (enabledSkills.length > 0 && !enabledSkills.includes(parsed.name)) continue;
    const entry = `- **${parsed.name}** (${parsed.category}): ${parsed.description || 'No description'}\n`;
    if (estimateTokens(content + entry) > maxTokens) break;
    content += entry;
  }

  return content;
}

async function buildGraphifyContext(projectPath: string, config: ContextConfig): Promise<string> {
  if (!config.systems.graphify.include_summary) return '';
  const maxTokens = config.systems.graphify.max_tokens || 500;
  const summary = await readFile(projectPath, 'graphify-out/GRAPH_REPORT.md');
  if (!summary) return '## Architecture\nNo graph report available.\n';
  return truncateToTokens(summary, Math.floor(maxTokens * 0.7));
}

async function buildParaContext(projectPath: string, config: ContextConfig): Promise<string> {
  const maxTokens = config.systems.para.max_tokens || 300;
  const enabledAreas = config.systems.para.areas;

  let content = '## Project Organization (PARA)\n';
  const paraDirs = [
    { dir: '01_Areas', label: 'Areas' },
    { dir: '02_Resources', label: 'Resources' },
    { dir: '03_Archives', label: 'Archives' },
  ];

  for (const { dir, label } of paraDirs) {
    const items = await listDir(projectPath, `CZVault/${dir}`);
    const filtered = enabledAreas.length > 0 ? items.filter(i => enabledAreas.includes(i)) : items;
    content += `${label}:\n`;
    for (const item of filtered.slice(0, 10)) {
      const subItems = await listDir(projectPath, `CZVault/${dir}/${item}`);
      const mdCount = subItems.filter(f => f.endsWith('.md')).length;
      content += `  - ${item} (${mdCount} notes)\n`;
    }
  }

  return truncateToTokens(content, maxTokens);
}

async function buildQMDContext(projectPath: string, config: ContextConfig): Promise<string> {
  const maxTokens = config.systems.qmd.max_tokens || 200;
  const enabledTemplates = config.systems.qmd.templates;

  let content = '## Templates Available\n';
  const templateFiles = await listDir(projectPath, 'agent/templates');

  for (const file of templateFiles) {
    if (!file.endsWith('.qmd')) continue;
    if (enabledTemplates.length > 0 && !enabledTemplates.includes(file)) continue;
    const templateContent = await readFile(projectPath, `agent/templates/${file}`);
    if (!templateContent) continue;
    const headers = templateContent.match(/^#+\s+.+$/gm) || [];
    const templateName = file.replace('.qmd', '');
    content += `- **${templateName}**: ${headers.map(h => h.replace(/^#+\s+/, '')).join(' → ')}\n`;
  }

  return truncateToTokens(content, maxTokens);
}

async function buildAutomationsContext(projectPath: string, config: ContextConfig): Promise<string> {
  const maxTokens = config.systems.automations.max_tokens || 100;
  const autoContent = await readFile(projectPath, 'agent/automations/automations.json');
  if (!autoContent) return '';

  try {
    const automations = JSON.parse(autoContent);
    const enabled = automations.filter((a: any) => a.enabled);
    let content = `## Active Automations (${enabled.length})\n`;
    for (const auto of enabled) {
      content += `- ${auto.name}: on ${auto.trigger.event}`;
      if (auto.trigger.pattern) content += ` (${auto.trigger.pattern})`;
      content += ` → ${auto.action.type}\n`;
    }
    return truncateToTokens(content, maxTokens);
  } catch {
    return '';
  }
}

async function buildDeepMemoryContext(projectPath: string, config: ContextConfig): Promise<string> {
  const maxTokens = config.deep_memory.pattern_detection ? 500 : 200;

  let content = '## User Patterns & Preferences\n';
  const memoryContent = await readFile(projectPath, 'agent/context/deep-memory.json');
  if (memoryContent) {
    try {
      const memory = JSON.parse(memoryContent);
      const topPatterns = (memory.patterns || []).sort((a: any, b: any) => b.frequency - a.frequency).slice(0, 5);
      for (const p of topPatterns) {
        content += `- ${p.description}\n`;
      }
    } catch {}
  }

  const summariesContent = await readFile(projectPath, 'agent/context/session-summaries.json');
  if (summariesContent) {
    try {
      const data = JSON.parse(summariesContent);
      const recent = (data.summaries || []).sort((a: any, b: any) => new Date(b.ended_at).getTime() - new Date(a.ended_at).getTime()).slice(0, 3);
      if (recent.length > 0) {
        content += '\nRecent sessions:\n';
        for (const s of recent) {
          content += `- ${s.topic || s.id.slice(0, 8)}: ${s.summary}\n`;
        }
      }
    } catch {}
  }

  return truncateToTokens(content, maxTokens);
}

// ─────────────────────────────────────────────────────────────
// DESIGN SKILLS CONTEXT BUILDER
// ─────────────────────────────────────────────────────────────

async function buildDesignSkillsContext(
  projectPath: string,
  config: ContextConfig
): Promise<string> {
  const ds = config.systems.design_skills;
  if (!ds?.enabled) return '';

  const maxTokens = ds.max_tokens || 800;
  const enabledSkills = ds.skills || [];
  const levels = ds.levels || { design_variance: 5, motion_intensity: 5, visual_density: 7 };
  const includeRefs = ds.include_references ?? true;

  let content = '## Design Skills System\n';
  content += `DESIGN_VARIANCE: ${levels.design_variance} (1=Conservative, 10=Experimental)\n`;
  content += `MOTION_INTENSITY: ${levels.motion_intensity} (1=Static, 10=Cinematic)\n`;
  content += `VISUAL_DENSITY: ${levels.visual_density} (1=Airy, 10=Maximal)\n\n`;

  const designSkillDirs = ['frontend-design', 'impeccable', 'ui-ux-pro-max', 'taste-skill', 'design-taste'];
  let skillEntries = '';
  let skillCount = 0;

  for (const skillDir of designSkillDirs) {
    if (enabledSkills.length > 0 && !enabledSkills.includes(skillDir)) continue;

    const skillContent = await readFile(projectPath, `agent/skills/${skillDir}/SKILL.md`);
    if (!skillContent) continue;

    const parsed = parseSkillFrontmatter(skillContent);
    const excerpt = skillContent.slice(0, 1200).replace(/---[\s\S]*?---/, '').trim();
    const entry = `\n### ${parsed.name}\n${parsed.description}\n${excerpt.slice(0, 600)}\n`;

    if (estimateTokens(content + skillEntries + entry) > maxTokens) break;
    skillEntries += entry;
    skillCount++;
  }

  content += `Active Skills: ${skillCount}\n`;
  content += skillEntries;

  const tasteContent = await readFile(projectPath, 'agent/skills/design-taste/SKILL.md');
  if (tasteContent && estimateTokens(content + tasteContent.slice(0, 400)) <= maxTokens) {
    content += `\n### Design Taste Master\n`;
    content += tasteContent.replace(/---[\s\S]*?---/, '').slice(0, 400).trim() + '\n';
  }

  if (includeRefs) {
    const refDirs = await listDir(projectPath, 'agent/design-references');
    const refs = refDirs.filter(d => !d.endsWith('.md') && d !== 'README.md');
    if (refs.length > 0 && estimateTokens(content + 'refs') <= maxTokens) {
      content += `\n### Design References Available\n`;
      for (const ref of refs.slice(0, 8)) {
        content += `- ${ref}: agent/design-references/${ref}/DESIGN.md\n`;
      }
    }
  }

  content += `\n[END DESIGN SKILLS CONTEXT]\n\n`;
  return truncateToTokens(content, maxTokens);
}