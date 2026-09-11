import type { AiTool, ToolParameter } from './types'
import { securityGuard } from './securityGuard'

const api = (window as any).deskflowAPI

function p(type: ToolParameter['type'], description: string, extra?: Partial<ToolParameter>): ToolParameter {
  return { type, description, ...extra }
}

export class ToolRegistry {
  private tools = new Map<string, AiTool>()

  register(tool: AiTool) {
    this.tools.set(tool.name, tool)
  }

  get(name: string): AiTool | undefined {
    return this.tools.get(name)
  }

  getAll(): AiTool[] {
    return Array.from(this.tools.values())
  }

  getByCategory(category: string): AiTool[] {
    return this.getAll().filter(t => t.category === category)
  }

  getOpenAISpecs(): Array<{
    type: 'function'
    function: { name: string; description: string; parameters: any }
  }> {
    return this.getAll().map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: this.toOpenAIProps(tool.parameters),
          required: Object.entries(tool.parameters)
            .filter(([_, p]) => p.required)
            .map(([k, _]) => k),
        },
      },
    }))
  }

  async execute(name: string, args: Record<string, any>): Promise<any> {
    const tool = this.tools.get(name)
    if (!tool) throw new Error(`Unknown tool: ${name}`)

    if (!securityGuard.isLevelAllowed(tool.securityLevel)) {
      throw new Error(`Tool ${name} requires ${tool.securityLevel} access`)
    }

    const rateCheck = securityGuard.checkRateLimit()
    if (!rateCheck.allowed) throw new Error(rateCheck.reason)

    const validation = securityGuard.validateParams(args, tool.parameters)
    if (!validation.valid) throw new Error(validation.error)

    return securityGuard.audited(name, args, () => tool.handler(args))
  }

  private toOpenAIProps(params: Record<string, ToolParameter>): Record<string, any> {
    const props: Record<string, any> = {}
    for (const [key, def] of Object.entries(params)) {
      props[key] = {
        type: def.type,
        description: def.description,
        ...(def.enum ? { enum: def.enum } : {}),
        ...(def.properties ? { properties: this.toOpenAIProps(def.properties) } : {}),
        ...(def.items ? { items: { type: def.items.type, description: def.items.description } } : {}),
      }
    }
    return props
  }
}

export const toolRegistry = new ToolRegistry()

async function checkAccess(key: string): Promise<{ allowed: boolean; message?: string }> {
  try {
    const prefs = await api.getPreferences();
    const encoded = prefs?.ai_dataAccess;
    const access = encoded ? JSON.parse(encoded) : {};
    const allowed = access[key] !== false;
    return { allowed, message: allowed ? undefined : `Access to ${key} data is disabled. You can enable it in Settings → AI Assistant → Data Access.` };
  } catch {
    return { allowed: true };
  }
}

function registerAll() {
  const r = (name: string, description: string, params: Record<string, ToolParameter>, level: 'read' | 'confirm' | 'admin', category: string, handler: (p: Record<string, any>) => Promise<any>) => {
    toolRegistry.register({ name, description, parameters: params, securityLevel: level, category, handler })
  }

  // ========== Goals ==========
  r('getGoals', 'Get goals for a specific date', { date: p('string', 'Date string YYYY-MM-DD', { required: true }) }, 'read', 'goals', async p => {
    const gate = await checkAccess('goals');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return api.getGoals(p.date);
  })
  r('getGoalsBatch', 'Get goals for a date range', { startDate: p('string', 'Start date YYYY-MM-DD', { required: true }), endDate: p('string', 'End date YYYY-MM-DD', { required: true }) }, 'read', 'goals', async p => {
    const gate = await checkAccess('goals');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return api.getGoalsBatch(p.startDate, p.endDate);
  })
  r('getLongtermGoals', 'Get long-term goals', {}, 'read', 'goals', async () => {
    const gate = await checkAccess('goals');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return api.getLongtermGoals();
  })
  r('saveLongtermGoal', 'Create or update a long-term goal (strategic goals, milestones, life objectives)', {
    id: p('string', 'Goal ID (omit for new goal, include to update existing)'),
    title: p('string', 'Goal title', { required: true }),
    description: p('string', 'Detailed description'),
    category: p('string', 'Category: work, learning, health, finance, personal, etc.'),
    priority: p('number', 'Priority (lower = higher priority, default 0)'),
    status: p('string', 'Status: pending, in_progress, completed, abandoned', { enum: ['pending', 'in_progress', 'completed', 'abandoned'] }),
  }, 'confirm', 'goals', async (params) => {
    const gate = await checkAccess('goals');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    const id = params.id || `lt_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    return api.saveGoal('2000-01-01', {
      id,
      title: params.title,
      description: params.description || null,
      category: params.category || 'personal',
      target: { type: 'custom' },
      status: params.status || 'pending',
      period: 'longterm',
      source: 'ai_assistant',
      priority: params.priority ?? 0,
    });
  })
  r('deleteLongtermGoal', 'Delete a long-term goal', { goalId: p('string', 'Long-term goal ID to delete', { required: true }) }, 'confirm', 'goals', async (params) => {
    const gate = await checkAccess('goals');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return api.deleteGoal(params.goalId);
  })
  r('saveGoal', 'Create or update a daily goal', { date: p('string', 'Date YYYY-MM-DD', { required: true }), goal: p('object', 'Goal object with id, text, etc.', { required: true }) }, 'confirm', 'goals', p => api.saveGoal(p.date, p.goal))
  r('deleteGoal', 'Delete a goal by ID', { goalId: p('string', 'Goal ID to delete', { required: true }) }, 'confirm', 'goals', p => api.deleteGoal(p.goalId))
  r('saveGoalReview', 'Save a goal review summary', { date: p('string', 'Date YYYY-MM-DD', { required: true }), reviewSummary: p('string', 'Review summary text', { required: true }) }, 'confirm', 'goals', p => api.saveGoalReview(p.date, p.reviewSummary))
  r('getGoalContext', 'Get goal context for AI', {}, 'read', 'goals', async () => {
    const gate = await checkAccess('goals');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return api.getGoalContext();
  })
  r('getGoal', 'Get a single goal by its ID', { goalId: p('string', 'Goal ID', { required: true }) }, 'read', 'goals', async (params) => {
    const gate = await checkAccess('goals');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return api.getGoal(params.goalId);
  })
  r('getChildGoals', 'Get all child goals (decomposition) for a parent goal', { parentId: p('string', 'Parent goal ID', { required: true }) }, 'read', 'goals', async (params) => {
    const gate = await checkAccess('goals');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return api.getChildGoals(params.parentId);
  })
  r('decomposeGoal', 'Break a long-term or strategic goal into smaller sub-goals (weekly, monthly, or daily). Creates multiple child goals linked to the parent via parent_id.', {
    parentId: p('string', 'ID of the parent goal to decompose', { required: true }),
    children: p('array', 'Array of child goal definitions', { required: true, items: { type: 'object', description: '{ title, description?, category?, period: "daily"|"weekly"|"monthly"|"quarterly", priority?, status? }' } }),
  }, 'confirm', 'goals', async (params) => {
    const gate = await checkAccess('goals');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    const children = params.children.map((c: any) => ({
      id: `child_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      title: c.title,
      description: c.description || null,
      category: c.category || 'personal',
      period: c.period || 'weekly',
      status: c.status || 'pending',
      source: 'ai_assistant',
      parent_id: params.parentId,
      priority: c.priority ?? 5,
      target: { type: 'custom' },
      date: '2000-01-01',
    }));
    return api.saveGoalsBatch(children);
  })
  r('linkGoalToProblem', 'Link a goal to a problem for traceability (goal will show the linked problem)', { goalId: p('string', 'Goal ID', { required: true }), problemId: p('string', 'Problem ID to link', { required: true }), label: p('string', 'Optional display label') }, 'confirm', 'goals', async (params) => {
    const gate = await checkAccess('goals');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return api.linkGoalToEntity(params.goalId, { type: 'problem', id: params.problemId, label: params.label });
  })
  r('linkGoalToRequest', 'Link a goal to a feature request for traceability', { goalId: p('string', 'Goal ID', { required: true }), requestId: p('string', 'Request ID to link', { required: true }), label: p('string', 'Optional display label') }, 'confirm', 'goals', async (params) => {
    const gate = await checkAccess('goals');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return api.linkGoalToEntity(params.goalId, { type: 'request', id: params.requestId, label: params.label });
  })
  r('unlinkGoalFromProblem', 'Remove a link between a goal and a problem', { goalId: p('string', 'Goal ID', { required: true }), problemId: p('string', 'Problem ID to unlink', { required: true }) }, 'confirm', 'goals', async (params) => {
    const gate = await checkAccess('goals');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return api.unlinkGoalFromEntity(params.goalId, 'problem', params.problemId);
  })
  r('unlinkGoalFromRequest', 'Remove a link between a goal and a request', { goalId: p('string', 'Goal ID', { required: true }), requestId: p('string', 'Request ID to unlink', { required: true }) }, 'confirm', 'goals', async (params) => {
    const gate = await checkAccess('goals');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return api.unlinkGoalFromEntity(params.goalId, 'request', params.requestId);
  })

  // ========== Projects ==========
  r('getProjects', 'Get all projects (non-deleted)', {}, 'read', 'projects', async () => {
    const gate = await checkAccess('projects');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return api.getProjects();
  })
  r('getAllProjects', 'Get ALL projects including deleted', {}, 'read', 'projects', async () => {
    const gate = await checkAccess('projects');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return api.getAllProjects();
  })
  r('getProjectDetails', 'Get detailed project info', { projectId: p('string', 'Project ID', { required: true }) }, 'read', 'projects', async p => {
    const gate = await checkAccess('projects');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return api.getProjectDetails(p.projectId);
  })
  r('addProject', 'Create a new project', { name: p('string', 'Project name', { required: true }), path: p('string', 'File system path', { required: true }), repositoryUrl: p('string', 'Optional git URL'), vcsType: p('string', 'VCS type (git etc)'), primaryLanguage: p('string', 'Primary programming language'), defaultIde: p('string', 'Default IDE ID') }, 'confirm', 'projects', p => api.addProject(p))
  r('updateProject', 'Update project fields', { projectId: p('string', 'Project ID', { required: true }), name: p('string', 'New name'), path: p('string', 'New path'), repositoryUrl: p('string', 'Git URL'), vcsType: p('string', 'VCS type'), primaryLanguage: p('string', 'Language'), defaultIde: p('string', 'IDE ID') }, 'confirm', 'projects', p => api.updateProject(p.projectId, p))
  r('deleteProject', 'Soft-delete a project', { projectId: p('string', 'Project ID', { required: true }) }, 'confirm', 'projects', p => api.deleteProject(p.projectId))
  r('restoreProject', 'Restore a deleted project', { projectId: p('string', 'Project ID', { required: true }) }, 'confirm', 'projects', p => api.restoreProject(p.projectId))
  r('openProject', 'Open a project in its IDE', { projectId: p('string', 'Project ID', { required: true }), ideId: p('string', 'Optional specific IDE ID') }, 'confirm', 'projects', p => api.openProject(p.projectId, p.ideId))
  r('calculateProjectHealth', 'Calculate project health score', { projectId: p('string', 'Project ID', { required: true }) }, 'read', 'projects', async p => {
    const gate = await checkAccess('projects');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return api.calculateProjectHealth(p.projectId);
  })
  r('getCommitStats', 'Get commit statistics for project(s)', { projectId: p('string', 'Optional project ID'), period: p('string', '"week" or "month"') }, 'read', 'projects', async p => {
    const gate = await checkAccess('projects');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return api.getCommitStats(p.projectId, p.period);
  })

  // ========== External Activities ==========
  r('getExternalActivities', 'Get all external activities', {}, 'read', 'external', () => api.getExternalActivities())
  r('addExternalActivity', 'Create an external activity', { name: p('string', 'Activity name', { required: true }), type: p('string', 'Activity type', { required: true }), color: p('string', 'Hex color'), icon: p('string', 'Icon identifier'), default_duration: p('number', 'Default duration in minutes') }, 'confirm', 'external', p => api.addExternalActivity(p))
  r('updateExternalActivity', 'Update an external activity', { id: p('string', 'Activity ID', { required: true }), name: p('string', 'New name'), type: p('string', 'New type'), color: p('string', 'New hex color'), icon: p('string', 'New icon'), default_duration: p('number', 'Default duration mins'), is_visible: p('boolean', 'Visibility'), is_default: p('boolean', 'Is default') }, 'confirm', 'external', p => api.updateExternalActivity(p.id, p))
  r('deleteExternalActivity', 'Delete an external activity', { id: p('string', 'Activity ID to delete', { required: true }) }, 'confirm', 'external', p => api.deleteExternalActivity(p.id))
  r('startExternalSession', 'Start tracking an external activity', { activityId: p('string', 'Activity ID to start', { required: true }) }, 'confirm', 'external', p => api.startExternalSession(p.activityId))
  r('stopExternalSession', 'Stop tracking an external session', { sessionId: p('string', 'Session ID', { required: true }), endTime: p('string', 'Optional end time ISO string') }, 'confirm', 'external', p => api.stopExternalSession(p.sessionId, p.endTime))
  r('getExternalSessions', 'Get external sessions for a period', { period: p('string', '"today", "week", "month", or "all"', { required: true }) }, 'read', 'external', p => api.getExternalSessions(p.period))
  r('getExternalStats', 'Get external activity stats', { period: p('string', '"today", "week", "month", or "all"', { required: true }) }, 'read', 'external', p => api.getExternalStats(p.period))
  r('addExternalTime', 'Manually add time to an activity', { activityId: p('string', 'Activity ID', { required: true }), durationMinutes: p('number', 'Duration in minutes', { required: true }), started_at: p('string', 'Start time ISO string'), ended_at: p('string', 'End time ISO string') }, 'confirm', 'external', p => api.addExternalTime(p.activityId, p.durationMinutes, p.started_at, p.ended_at))
  r('getActiveExternalSession', 'Get currently active external session', {}, 'read', 'external', () => api.getActiveExternalSession())

  // ========== Sleep ==========
  r('getSleepForDate', 'Get sleep data for a date', { dateStr: p('string', 'Date string YYYY-MM-DD', { required: true }) }, 'read', 'sleep', p => api.getSleepForDate(p.dateStr))
  r('addManualSleep', 'Add manual sleep entry', { started_at: p('string', 'Start time ISO', { required: true }), ended_at: p('string', 'End time ISO', { required: true }) }, 'confirm', 'sleep', p => api.addManualSleep(p))
  r('updateManualSleep', 'Update a manual sleep entry', { sessionId: p('string', 'Session ID', { required: true }), started_at: p('string', 'Start time ISO', { required: true }), ended_at: p('string', 'End time ISO', { required: true }) }, 'confirm', 'sleep', p => api.updateManualSleep(p.sessionId, p))
  r('getSleepTrends', 'Get sleep trends data', { period: p('string', '"today", "week", "month", "all"', { required: true }), dateOffset: p('number', 'Days offset from today') }, 'read', 'sleep', p => api.getSleepTrends(p.period, p.dateOffset))

  // ========== Preferences ==========
  r('getPreferences', 'Get all user preferences', {}, 'read', 'settings', () => api.getPreferences())
  r('setPreference', 'Set a user preference', { key: p('string', 'Preference key', { required: true }), value: p('string', 'Preference value (JSON string)', { required: true }) }, 'confirm', 'settings', p => api.setPreference(p.key, p.value))
  r('getExternalSettings', 'Get external settings value', { key: p('string', 'Settings key', { required: true }) }, 'read', 'settings', p => api.getExternalSettings(p.key))
  r('setExternalSettings', 'Set external settings value', { key: p('string', 'Settings key', { required: true }), value: p('string', 'Settings value', { required: true }) }, 'confirm', 'settings', p => api.setExternalSettings(p.key, p.value))

  // ========== Category Config ==========
  r('getCategoryConfig', 'Get category configuration', {}, 'read', 'categories', () => api.getCategoryConfig())
  r('getTierAssignments', 'Get tier assignments for apps/domains', {}, 'read', 'categories', () => api.getTierAssignments())
  r('setAppCategory', 'Set category for an app', { appName: p('string', 'App name', { required: true }), category: p('string', 'Category name', { required: true }) }, 'confirm', 'categories', p => api.setAppCategory(p.appName, p.category))
  r('setDomainCategory', 'Set category for a domain', { domain: p('string', 'Domain name', { required: true }), category: p('string', 'Category name', { required: true }) }, 'confirm', 'categories', p => api.setDomainCategory(p.domain, p.category))
  r('setAppTier', 'Set productivity tier for an app', { appName: p('string', 'App name', { required: true }), tier: p('string', '"productive", "neutral", or "distracting"', { required: true, enum: ['productive', 'neutral', 'distracting'] }) }, 'confirm', 'categories', p => api.setAppTier(p.appName, p.tier))
  r('setDomainTier', 'Set productivity tier for a domain', { domain: p('string', 'Domain name', { required: true }), tier: p('string', '"productive", "neutral", or "distracting"', { required: true, enum: ['productive', 'neutral', 'distracting'] }) }, 'confirm', 'categories', p => api.setDomainTier(p.domain, p.tier))
  r('setTierAssignments', 'Bulk set tier assignments', { assignments: p('object', '{ productive: string[], neutral: string[], distracting: string[] }', { required: true }) }, 'confirm', 'categories', p => api.setTierAssignments(p.assignments))

  // ========== IDE / Terminal ==========
  r('getIDEProjectsOverview', 'Get IDE projects overview with token usage and costs', { period: p('string', 'Period string'), dateOffset: p('number', 'Days offset') }, 'read', 'ide', async p => {
    const gate = await checkAccess('projects');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return api.getIDEProjectsOverview(p.period, p.dateOffset);
  })
  r('getTerminalSessions', 'Get terminal sessions', { projectId: p('string', 'Optional project ID'), limit: p('number', 'Max sessions') }, 'read', 'ide', p => api.getTerminalSessions(p.projectId, p.limit))

  // ========== Problems ==========
  r('getProblems', 'Get problems for a project', { projectId: p('string', 'Optional project ID'), projectPath: p('string', 'Optional project path') }, 'read', 'problems', async p => {
    const gate = await checkAccess('problems');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return api.getProblems(p.projectId, p.projectPath);
  })
  r('updateProblemStatus', 'Update a problem status', { problemId: p('string', 'Problem ID', { required: true }), status: p('string', 'New status', { required: true }) }, 'confirm', 'problems', p => api.updateProblemStatus({ problemId: p.problemId, status: p.status }))
  r('deleteProblem', 'Delete a problem', { problemId: p('string', 'Problem ID', { required: true }) }, 'confirm', 'problems', p => api.deleteProblem(p.problemId))

  // ========== Recording ==========
  r('getRecordingModes', 'Get current recording modes', {}, 'read', 'recording', () => api.getRecordingModes())
  r('setRecordingMode', 'Set recording mode for browser or app', { type: p('string', '"browser" or "app"', { required: true, enum: ['browser', 'app'] }), mode: p('string', '"always" or "on-view"', { required: true, enum: ['always', 'on-view'] }) }, 'confirm', 'recording', p => api.setRecordingMode(p.type, p.mode))

  // ========== Browser Stats ==========
  r('getBrowserCategoryStats', 'Get browser stats by category', { period: p('string', 'Period string', { required: true }), dateOffset: p('number', 'Days offset') }, 'read', 'stats', p => api.getBrowserCategoryStats(p.period, p.dateOffset))

  // ========== AI Context ==========
  r('getAiContext', 'Get AI context for agent', { projectId: p('string', 'Optional project ID'), since: p('string', 'ISO date filter'), limit: p('number', 'Max entries') }, 'read', 'ai', p => api.getAiContext(p))

  // ========== Requests ==========
  r('getRequests', 'Get all feature requests', { projectId: p('string', 'Optional project ID') }, 'read', 'requests', async params => {
    const gate = await checkAccess('requests');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return api.getRequests(params.projectId);
  })

  // ========== AI Usage ==========
  r('getAIUsageSummary', 'Get AI usage summary (tokens, costs, sessions per tool)', { period: p('string', 'Period string like "day", "week", "month"'), dateOffset: p('number', 'Days offset'), projectId: p('string', 'Optional project ID') }, 'read', 'ai', async params => {
    const gate = await checkAccess('aiUsage');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return api.getAIUsageSummary(params.period, params.dateOffset, params.projectId);
  })

  // ========== Dashboard Aggregates ==========
  r('getDashboardAggregates', 'Get dashboard aggregate stats (overview, app stats, hourly stats, focus time)', { period: p('string', 'Period string like "today", "week", "month", "all"', { required: true }), dateOffset: p('number', 'Days offset'), weekOffset: p('number', 'Weeks offset') }, 'read', 'stats', async params => {
    const gate = await checkAccess('dashboardStats');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return api.getDashboardAggregates(params);
  })

  // ========== Research Topics (AI Interests) ==========
  r('getInterestTopics', 'Get all active research topics that AI uses for digest generation', {}, 'read', 'ai', async () => {
    const gate = await checkAccess('aiUsage');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return api.getInterestTopics();
  })
  r('addInterestTopic', 'Add a new research topic for AI to track and include in digests', { topic: p('string', 'Research topic name (e.g. "React performance", "Rust async")', { required: true }) }, 'confirm', 'ai', async (params) => {
    const gate = await checkAccess('aiUsage');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return api.addInterestTopic(params.topic);
  })
  r('removeInterestTopic', 'Remove a research topic from AI tracking', { topic: p('string', 'Topic name to remove', { required: true }) }, 'confirm', 'ai', async (params) => {
    const gate = await checkAccess('aiUsage');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return api.removeInterestTopic(params.topic);
  })

  // ========== Checklist CRUD (AI Assistant) ==========
  r('addProblemCheck', 'Add a checklist item to a problem (tracking verification steps for bug fixes)', { problemId: p('string', 'Problem ID to add the check to', { required: true }), description: p('string', 'Short description of what to verify', { required: true }), instruction: p('string', 'Detailed verification instructions') }, 'confirm', 'checklist', async (params) => {
    const gate = await checkAccess('checklist');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return api.addProblemCheck({ problemId: params.problemId, description: params.description, instruction: params.instruction });
  })
  r('addRequestCheck', 'Add a checklist item to a feature request (tracking implementation steps)', { requestId: p('string', 'Request ID to add the check to', { required: true }), description: p('string', 'Short description of what to verify', { required: true }), instruction: p('string', 'Detailed verification instructions') }, 'confirm', 'checklist', async (params) => {
    const gate = await checkAccess('checklist');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return api.addRequestCheck({ requestId: params.requestId, description: params.description, instruction: params.instruction });
  })
  r('completeCheck', 'Mark a checklist item as completed after verifying it works', { checkId: p('string', 'Check item ID to mark completed', { required: true }) }, 'confirm', 'checklist', async (params) => {
    const gate = await checkAccess('checklist');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return api.completeCheck(params.checkId);
  })
  r('getProblemChecks', 'Get all checklist items for a problem', { problemId: p('string', 'Problem ID', { required: true }) }, 'read', 'checklist', async (params) => {
    const gate = await checkAccess('checklist');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return api.getProblemChecks(params.problemId);
  })
  r('getRequestChecks', 'Get all checklist items for a request', { requestId: p('string', 'Request ID', { required: true }) }, 'read', 'checklist', async (params) => {
    const gate = await checkAccess('checklist');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return api.getRequestChecks(params.requestId);
  })

  // ========== Workspace & Terminal State ==========
  r('getWorkspaceState', 'Get all saved workspace layouts and configs', {}, 'read', 'ide', async () => {
    try {
      return await api.listAllWorkspaces();
    } catch (err: any) {
      return { error: err.message };
    }
  })
  r('getTerminalSessionsRich', 'Get terminal sessions with details (topic, agent, status, tokens, cost)', { projectId: p('string', 'Optional project ID filter'), limit: p('number', 'Max sessions (default 20)') }, 'read', 'ide', async (params) => {
    try {
      return await api.getTerminalSessions(params.projectId, params.limit || 20);
    } catch (err: any) {
      return { error: err.message };
    }
  })
  r('getTerminalMessages', 'Get messages from a specific terminal session', { sessionId: p('string', 'Terminal session ID', { required: true }) }, 'read', 'ide', async (params) => {
    try {
      return await api.getTerminalMessages(params.sessionId);
    } catch (err: any) {
      return { error: err.message };
    }
  })

  // ========== Tutorials & Onboarding ==========
  r('getTutorialStatus', 'Check which feature tutorials have been completed', {}, 'read', 'settings', async () => {
    try {
      const raw = localStorage.getItem('tutorial-completed')
      const completed: string[] = raw ? JSON.parse(raw) : []
      return { completed, features: ['dash.score', 'dash.timer', 'dash.sessions', 'prod.score', 'browser.track', 'ide.detect', 'ext.timer', 'sleep.track'] }
    } catch {
      return { completed: [], features: [] }
    }
  })
  r('startFeatureTutorial', 'Start a guided tutorial for a specific app feature', {
    featureId: p('string', 'Feature ID to start tutorial for (e.g. "dash.timer", "ide.detect")', { required: true, enum: ['dash.score', 'dash.timer', 'dash.sessions', 'prod.score', 'browser.track', 'ide.detect', 'ext.timer', 'sleep.track'] }),
  }, 'confirm', 'settings', async (params) => {
    // Write signal to localStorage so TutorialContext picks it up on next render
    try { localStorage.setItem('tutorial:start', params.featureId) } catch {}
    return { success: true, featureId: params.featureId, message: `Tutorial for ${params.featureId} will start. Look for the highlighted walkthrough on screen.` }
  })

  // ========== Agent Prompts ==========
  r('getPrompts', 'Get agent prompts with status and progress info', { sessionId: p('string', 'Optional session ID filter'), projectId: p('string', 'Optional project ID filter') }, 'read', 'prompts', async params => {
    const gate = await checkAccess('prompts');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return api.agentPrompts.list({ sessionId: params.sessionId, projectId: params.projectId });
  })
  r('createPrompt', 'Create a new agent prompt record linked to a session', { sessionId: p('string', 'Session ID this prompt belongs to'), projectId: p('string', 'Optional project ID'), content: p('string', 'The prompt content text', { required: true }), title: p('string', 'Short title for the prompt'), category: p('string', 'Category (e.g. debug, feature, review, research)') }, 'confirm', 'prompts', async params => {
    const gate = await checkAccess('prompts');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return api.agentPrompts.create({ sessionId: params.sessionId, content: params.content, title: params.title, category: params.category, projectId: params.projectId });
  })
  r('updatePrompt', 'Update prompt status, progress percentage, and result summary', { id: p('string', 'Prompt ID to update', { required: true }), status: p('string', 'New status (pending, in_progress, completed, failed, cancelled)'), progress: p('number', 'Progress 0-100'), resultSummary: p('string', 'AI-generated summary of the prompt result') }, 'confirm', 'prompts', async params => {
    const gate = await checkAccess('prompts');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return api.agentPrompts.update({ id: params.id, status: params.status, progress: params.progress, resultSummary: params.resultSummary });
  })

  // ========== Connectors ==========
  r('getConnectors', 'List all configured connectors (email, calendar) that sync external data', {}, 'read', 'connectors', async () => {
    const gate = await checkAccess('connectors');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    try {
      return await api.connectors.list();
    } catch (err: any) {
      return { error: err.message };
    }
  })
  r('getConnectorItems', 'Get synced items (emails, events) from a connector, optionally filtered by type', { connectorId: p('string', 'Connector ID to fetch items from', { required: true }), type: p('string', 'Optional item type filter: email or event'), limit: p('number', 'Max items (default 20)') }, 'read', 'connectors', async (params) => {
    const gate = await checkAccess('connectors');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    try {
      return await api.connectors.items(params.connectorId, { type: params.type, limit: params.limit || 20 });
    } catch (err: any) {
      return { error: err.message };
    }
  })

  // ========== Connector Actions ==========
  r('replyToEmail', 'Draft a reply to an email. The user must confirm before sending.', {
    connectorId: p('string', 'Connector ID', { required: true }),
    emailId: p('string', 'Email item ID to reply to', { required: true }),
    draft: p('string', 'Draft reply content', { required: true }),
  }, 'confirm', 'connectors', async (params) => {
    const gate = await checkAccess('connectors');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return {
      _action: true,
      kind: 'reply-email',
      connectorId: params.connectorId,
      emailId: params.emailId,
      draft: params.draft,
    };
  })

  r('createCalendarEvent', 'Create a new calendar event. The user must confirm.', {
    connectorId: p('string', 'Calendar connector ID', { required: true }),
    title: p('string', 'Event title', { required: true }),
    startTime: p('string', 'ISO 8601 start time', { required: true }),
    endTime: p('string', 'ISO 8601 end time'),
    description: p('string', 'Event description'),
  }, 'confirm', 'connectors', async (params) => {
    const gate = await checkAccess('connectors');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return {
      _action: true,
      kind: 'create-event',
      connectorId: params.connectorId,
      title: params.title,
      startTime: params.startTime,
      endTime: params.endTime,
      description: params.description,
    };
  })

  r('updateCalendarEvent', 'Update an existing calendar event.', {
    connectorId: p('string', 'Calendar connector ID', { required: true }),
    eventId: p('string', 'Event item ID', { required: true }),
    title: p('string', 'New title'),
    startTime: p('string', 'New ISO 8601 start time'),
    endTime: p('string', 'New ISO 8601 end time'),
    description: p('string', 'New description'),
  }, 'confirm', 'connectors', async (params) => {
    const gate = await checkAccess('connectors');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return {
      _action: true,
      kind: 'update-event',
      connectorId: params.connectorId,
      eventId: params.eventId,
      changes: {
        ...(params.title && { title: params.title }),
        ...(params.startTime && { startTime: params.startTime }),
        ...(params.endTime && { endTime: params.endTime }),
        ...(params.description && { description: params.description }),
      },
    };
  })

  r('deleteCalendarEvent', 'Delete a calendar event.', {
    connectorId: p('string', 'Calendar connector ID', { required: true }),
    eventId: p('string', 'Event item ID', { required: true }),
  }, 'confirm', 'connectors', async (params) => {
    const gate = await checkAccess('connectors');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return {
      _action: true,
      kind: 'delete-event',
      connectorId: params.connectorId,
      eventId: params.eventId,
    };
  })

  r('markEmailRead', 'Mark an email as read or unread.', {
    connectorId: p('string', 'Email connector ID', { required: true }),
    emailId: p('string', 'Email item ID', { required: true }),
    read: p('boolean', 'True to mark read, false for unread', { required: true }),
  }, 'confirm', 'connectors', async (params) => {
    const gate = await checkAccess('connectors');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return {
      _action: true,
      kind: 'mark-read',
      connectorId: params.connectorId,
      emailId: params.emailId,
      read: params.read,
    };
  })

  r('createScheduleFromEmail', 'Create a schedule entry from an email. Use when an email mentions a meeting, class, event, or recurring commitment that should be added to the weekly schedule.', {
    title: p('string', 'Title for the schedule entry (e.g. "Team Standup", "CS101 Lecture")', { required: true }),
    day_of_week: p('number', 'Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)', { required: true }),
    start_time: p('string', 'Start time in HH:MM format (24h)', { required: true }),
    end_time: p('string', 'End time in HH:MM format (24h)', { required: true }),
    location: p('string', 'Location if mentioned (e.g. "Room 302", "Zoom link")'),
    category: p('string', 'Category: class, work, meeting, personal, email'),
    color: p('string', 'Hex color for the entry'),
  }, 'confirm', 'schedule', async (params) => {
    const gate = await checkAccess('schedule');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return {
      _action: true,
      kind: 'create-schedule-from-email',
      title: params.title,
      day_of_week: params.day_of_week,
      start_time: params.start_time,
      end_time: params.end_time,
      location: params.location,
      category: params.category || 'email',
      color: params.color || '#8b5cf6',
    };
  })

  r('createDeadlineFromEmail', 'Create a deadline from an email. Use when an email mentions a due date, submission deadline, exam, or time-sensitive task.', {
    title: p('string', 'Deadline title (e.g. "Essay Submission", "Project Report")', { required: true }),
    due_date: p('string', 'Due date in ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)', { required: true }),
    course: p('string', 'Course or category if mentioned'),
    priority: p('string', 'Priority: low, medium, high, urgent'),
    description: p('string', 'Additional details from the email'),
  }, 'confirm', 'deadlines', async (params) => {
    const gate = await checkAccess('deadlines');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return {
      _action: true,
      kind: 'create-deadline-from-email',
      title: params.title,
      due_date: params.due_date,
      course: params.course,
      priority: params.priority || 'medium',
      description: params.description,
      category: 'email',
    };
  })
}

registerAll()
