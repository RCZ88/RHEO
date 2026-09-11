# Graph Report - .  (2026-06-14)

## Corpus Check
- 171 files · ~4,130,660 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1177 nodes · 1692 edges · 48 communities detected
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 160 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 68|Community 68]]

## God Nodes (most connected - your core abstractions)
1. `ProblemsService` - 24 edges
2. `AgentHostService` - 23 edges
3. `WorkspaceRegistryService` - 23 edges
4. `getDay()` - 22 edges
5. `RequestsService` - 21 edges
6. `RAGService` - 18 edges
7. `setHours()` - 16 edges
8. `assembleContext()` - 15 edges
9. `readFile()` - 14 edges
10. `ProjectContextService` - 13 edges

## Surprising Connections (you probably didn't know these)
- `handleCreate()` --calls--> `loadSkills()`  [INFERRED]
  C:\Users\cleme\Documents\COMPUTAH_SAYENCE\App Tracker\agent\backups\TerminalPage_2026-06-05_010713.tsx → C:\Users\cleme\Documents\COMPUTAH_SAYENCE\App Tracker\src\components\GeneralistDialog.tsx
- `handleUpdate()` --calls--> `loadSkills()`  [INFERRED]
  C:\Users\cleme\Documents\COMPUTAH_SAYENCE\App Tracker\agent\backups\TerminalPage_2026-06-05_010713.tsx → C:\Users\cleme\Documents\COMPUTAH_SAYENCE\App Tracker\src\components\GeneralistDialog.tsx
- `handleDelete()` --calls--> `loadSkills()`  [INFERRED]
  C:\Users\cleme\Documents\COMPUTAH_SAYENCE\App Tracker\agent\backups\TerminalPage_2026-06-05_010713.tsx → C:\Users\cleme\Documents\COMPUTAH_SAYENCE\App Tracker\src\components\GeneralistDialog.tsx
- `computeWeekRange()` --calls--> `getDay()`  [INFERRED]
  C:\Users\cleme\Documents\COMPUTAH_SAYENCE\App Tracker\agent\docs\ui-redesign-analytics-ai-tools\main_backend.ts → C:\Users\cleme\Documents\COMPUTAH_SAYENCE\App Tracker\dist-electron\services\GoalStore.js
- `getMondayOfWeek()` --calls--> `getDay()`  [INFERRED]
  C:\Users\cleme\Documents\COMPUTAH_SAYENCE\App Tracker\agent\docs\ui-redesign-analytics-ai-tools\main_backend.ts → C:\Users\cleme\Documents\COMPUTAH_SAYENCE\App Tracker\dist-electron\services\GoalStore.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.02
Nodes (80): acquireLock(), addLog(), backfillStatsTables(), broadcast(), build(), calculateCost(), calculateProductivityScore(), callOpenRouter() (+72 more)

### Community 1 - "Community 1"
Cohesion: 0.02
Nodes (62): acquireLock(), addLog(), backfillStatsTables(), broadcast(), build(), buildHourlyHeatmap(), calculateCost(), calculateProductivityScore() (+54 more)

### Community 2 - "Community 2"
Cohesion: 0.04
Nodes (30): formatTimeFromHours(), getTotalTime(), computeChartDateRange(), getPersistedActivityFeed(), getPersistedTimerState(), handleDayClick(), loadExternalData(), getDateRange() (+22 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (5): CompactionService, DefaultLLMProvider, ContextAssemblyService, ProjectContextService, RAGService

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (17): sendFeedback(), handleSaveNotes(), handleSubmit(), executeActionsFromFile(), getProblemsService(), getProjectPath(), getRequestsService(), logActivity() (+9 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (13): loadSkills(), async(), handleAddToProject(), handleCreate(), handleCreateProblem(), handleDelete(), handleSave(), handleSeedWorkspace() (+5 more)

### Community 6 - "Community 6"
Cohesion: 0.06
Nodes (8): async(), handleCreate(), handleCreateProblem(), handleDelete(), handleSubmit(), handleUpdate(), handleUse(), showNotify()

### Community 7 - "Community 7"
Cohesion: 0.1
Nodes (10): AgentHostService, detectActionRequired(), detectAgentPrompt(), diagnoseAgentFailure(), getAgentConfig(), isAgentReady(), looksLikeShell(), stripAnsi() (+2 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (11): cleanCorruptedData(), clearToday(), confirmSleepDetection(), dismissSleepDetection(), handleStorage(), handleStorageChange(), handleTimerSync(), loadData() (+3 more)

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (14): adjustColor(), animateCamera(), calculateAngularSpeed(), calculateOrbitalPeriod(), computePlanets(), focusOnPlanet(), getPlanetColorByOrbit(), handleCategorySelect() (+6 more)

### Community 10 - "Community 10"
Cohesion: 0.16
Nodes (27): async(), formatCurrency(), formatTokens(), getMetricValue(), groupToolsByCategory(), handleAddProject(), handleClickOutside(), handleConfirmDelete() (+19 more)

### Community 11 - "Community 11"
Cohesion: 0.08
Nodes (7): async(), formatDuration(), formatHours(), localDateStr(), pad(), toLocal(), toLocal()

### Community 12 - "Community 12"
Cohesion: 0.17
Nodes (3): runInitAll(), runInitAll(), ProblemsService

### Community 13 - "Community 13"
Cohesion: 0.13
Nodes (1): WorkspaceRegistryService

### Community 14 - "Community 14"
Cohesion: 0.19
Nodes (7): coerceValue(), enhanceSkillWithDSL(), inferWidget(), parseFrontmatterSection(), parseSkillDSL(), parseFrontmatterList(), SkillsService

### Community 15 - "Community 15"
Cohesion: 0.38
Nodes (18): assembleContext(), buildAutomationsContext(), buildDeepMemoryContext(), buildDesignSkillsContext(), buildGraphifyContext(), buildLLMWikiContext(), buildParaContext(), buildQMDContext() (+10 more)

### Community 16 - "Community 16"
Cohesion: 0.13
Nodes (12): ensure_para_structure(), parse_problems(), Check GRAPH_REPORT.md exists and has content. Regenerate if broken., Create PARA directory structure in vault if it doesn't exist., Parse PROBLEMS.md into individual problem dicts (simple parser)., Sync project files to PARA-organized Obsidian vault., Sync graphify-out/ to Obsidian vault., rebuild_code_fix() (+4 more)

### Community 17 - "Community 17"
Cohesion: 0.16
Nodes (9): buildColorSchemeXml(), buildDesignLibraryAccessXml(), buildFullContext(), buildImportedComponentsXml(), closeBrowse(), handleAddComponent(), handleCopy(), handleSend() (+1 more)

### Community 18 - "Community 18"
Cohesion: 0.27
Nodes (15): checkBrowserFocus(), extractDomain(), getBrowserProcessNames(), healthCheck(), identifyBrowser(), loadState(), logPreviousSession(), onStartup() (+7 more)

### Community 19 - "Community 19"
Cohesion: 0.14
Nodes (6): init(), beep(), main(), Play a simple system beep., Speak text using offline TTS (pyttsx3 if available).     Falls back to system TT, speak()

### Community 20 - "Community 20"
Cohesion: 0.17
Nodes (3): fetchTypicalDay(), formatHours(), periodToDays()

### Community 21 - "Community 21"
Cohesion: 0.18
Nodes (2): handleEditBlur(), handleEditKeyDown()

### Community 22 - "Community 22"
Cohesion: 0.2
Nodes (4): async(), loadOverrides(), setEditingKeywordSets(), setLocalAppColors()

### Community 24 - "Community 24"
Cohesion: 0.31
Nodes (4): callProvider(), buildChain(), callWithTokenTiers(), runWithFallback()

### Community 25 - "Community 25"
Cohesion: 0.27
Nodes (6): async(), handleConfigSave(), handleRefresh(), handleToggleContext(), loadContextData(), loadContexts()

### Community 26 - "Community 26"
Cohesion: 0.56
Nodes (4): AIService, callOpenRouter(), cleanAIJson(), parseAIJson()

### Community 28 - "Community 28"
Cohesion: 0.25
Nodes (2): handleRefresh(), handleTestStart()

### Community 29 - "Community 29"
Cohesion: 0.46
Nodes (6): fmtCost(), fmtNum(), fmtSec(), getStatusBorder(), getStatusColor(), StatCard()

### Community 30 - "Community 30"
Cohesion: 0.43
Nodes (4): handleAdd(), handleDelete(), handleToggle(), loadGoals()

### Community 31 - "Community 31"
Cohesion: 0.38
Nodes (4): handleAdd(), handleImport(), handleKeyDown(), isValidHex()

### Community 33 - "Community 33"
Cohesion: 0.73
Nodes (4): AiPage(), determineMode(), getDayLabel(), getToday()

### Community 35 - "Community 35"
Cohesion: 0.53
Nodes (1): NotificationService

### Community 36 - "Community 36"
Cohesion: 0.7
Nodes (4): main(), parseArgs(), readActions(), writeActions()

### Community 37 - "Community 37"
Cohesion: 0.5
Nodes (2): formatRelTime(), SystemToggleCard()

### Community 40 - "Community 40"
Cohesion: 0.5
Nodes (2): replaceLeafInTree(), swapLeavesInTree()

### Community 41 - "Community 41"
Cohesion: 0.5
Nodes (2): addTag(), handleTagKeyDown()

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (4): fingerprintRecord(), fingerprintRows(), hashNumber(), hashString()

### Community 44 - "Community 44"
Cohesion: 0.67
Nodes (2): AfkPromptModal(), formatElapsed()

### Community 52 - "Community 52"
Cohesion: 0.67
Nodes (2): getAesthetic(), TasteKnobs()

### Community 53 - "Community 53"
Cohesion: 0.67
Nodes (2): shallowEqual(), useStableMemo()

### Community 54 - "Community 54"
Cohesion: 0.5
Nodes (1): SessionContextService

### Community 55 - "Community 55"
Cohesion: 0.67
Nodes (2): print_summary(), Print a summary of all features and their status.

### Community 56 - "Community 56"
Cohesion: 0.67
Nodes (2): print_plan(), Print the complete restoration plan.

### Community 57 - "Community 57"
Cohesion: 0.67
Nodes (1): handler()

### Community 59 - "Community 59"
Cohesion: 1.0
Nodes (2): buildPrompt(), handleSend()

### Community 60 - "Community 60"
Cohesion: 1.0
Nodes (2): groupSteps(), InitializeProgressModal()

### Community 66 - "Community 66"
Cohesion: 1.0
Nodes (2): applyFilter(), sortAndGroupChecks()

### Community 68 - "Community 68"
Cohesion: 1.0
Nodes (1): Graphify Pipeline for Windows Runs the full knowledge graph extraction pipeline

## Knowledge Gaps
- **10 isolated node(s):** `Play a simple system beep.`, `Speak text using offline TTS (pyttsx3 if available).     Falls back to system TT`, `Print a summary of all features and their status.`, `Print the complete restoration plan.`, `Graphify Pipeline for Windows Runs the full knowledge graph extraction pipeline` (+5 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 13`** (24 nodes): `WorkspaceRegistry.ts`, `WorkspaceRegistryService`, `.addPlugin()`, `.collectAllContext()`, `.defaultComposeContext()`, `.discoverFromIPC()`, `.filterWorkspaceSkills()`, `.getAllPlugins()`, `.getComposeContext()`, `.getPlugin()`, `.getPluginsByCategory()`, `.getSidebarEntries()`, `.hasPlugin()`, `.initialize()`, `.isInitialized()`, `.notify()`, `.refresh()`, `.register()`, `.registerComposeContext()`, `.size()`, `.skillToDescriptor()`, `.subscribe()`, `.unregister()`, `.unregisterComposeContext()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (12 nodes): `decHours()`, `decMinutes()`, `handleEditBlur()`, `handleEditChange()`, `handleEditKeyDown()`, `handleStartEdit()`, `incHours()`, `incMinutes()`, `setMinutes()`, `startHold()`, `stopHold()`, `DurationPicker.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (9 nodes): `defaultConfig()`, `handleClearCache()`, `handleRefresh()`, `handleSave()`, `handleStop()`, `handleTestStart()`, `loadCurrentStatus()`, `updateSource()`, `LibraryConfigModal.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (6 nodes): `NotificationService`, `.initAudio()`, `.notifyAttention()`, `.notifyComplete()`, `.playBeep()`, `NotificationService.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (5 nodes): `NewSessionDialog.tsx`, `checkInit()`, `estimateTokens()`, `formatRelTime()`, `SystemToggleCard()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (5 nodes): `createSplitFromDrag()`, `flattenPanes()`, `replaceLeafInTree()`, `swapLeavesInTree()`, `MapEditor.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (5 nodes): `addTag()`, `handleSave()`, `handleTagKeyDown()`, `removeTag()`, `SessionEditDialog.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (4 nodes): `AfkPromptModal()`, `formatElapsed()`, `formatTime()`, `AfkPromptModal.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (4 nodes): `TasteKnobs.tsx`, `getAesthetic()`, `SliderRow()`, `TasteKnobs()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (4 nodes): `useStableMemo.ts`, `deepEqual()`, `shallowEqual()`, `useStableMemo()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (4 nodes): `SessionContextService`, `.extractContext()`, `.generateBriefContext()`, `SessionContextService.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (3 nodes): `feature_inventory.py`, `print_summary()`, `Print a summary of all features and their status.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (3 nodes): `restoration_plan.py`, `print_plan()`, `Print the complete restoration plan.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (3 nodes): `preload.ts`, `handler()`, `preload.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (3 nodes): `buildPrompt()`, `handleSend()`, `DSLGenerationModal.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (3 nodes): `groupSteps()`, `InitializeProgressModal()`, `InitializeProgressModal.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (3 nodes): `applyFilter()`, `sortAndGroupChecks()`, `checklistAlgorithm.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 68`** (2 nodes): `graphify-pipeline.py`, `Graphify Pipeline for Windows Runs the full knowledge graph extraction pipeline`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getSystemInfo()` connect `Community 15` to `Community 0`, `Community 14`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `computePlanets()` connect `Community 9` to `Community 0`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `setHours()` connect `Community 2` to `Community 0`, `Community 1`, `Community 8`, `Community 11`, `Community 21`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Are the 20 inferred relationships involving `getDay()` (e.g. with `computeDateRange()` and `resolvePeriodBounds()`) actually correct?**
  _`getDay()` has 20 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Play a simple system beep.`, `Speak text using offline TTS (pyttsx3 if available).     Falls back to system TT`, `Print a summary of all features and their status.` to the rest of the system?**
  _10 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.02 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.02 - nodes in this community are weakly interconnected._