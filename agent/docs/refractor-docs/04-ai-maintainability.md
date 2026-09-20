# 4. AI Maintainability Assessment

## Overview

This document evaluates how easily AI coding agents can understand, modify, debug, and extend the RHEO codebase. The assessment is based on the premise that **good engineering for humans is also good engineering for AI**, but AI has additional constraints around context windows and pattern recognition.

## AI Readability Scorecard

| Category | Score | Status |
|----------|-------|--------|
| File Size Appropriateness | 2/10 | ❌ Critical |
| Naming Clarity | 7/10 | ✅ Good |
| Pattern Consistency | 4/10 | ⚠️ Poor |
| Boundary Explicitness | 5/10 | ⚠️ Moderate |
| Documentation Quality | 6/10 | ✅ Good |
| Type Safety | 8/10 | ✅ Excellent |
| Test Coverage | 1/10 | ❌ Critical |
| Overall | 4.7/10 | ⚠️ Needs Work |

---

## Critical Issues for AI Understanding

### 1. File Sizes Exceed Context Windows

**Problem**: Key files are too large to fit in a single context window alongside other necessary code.

**Evidence**:
```
src/main.ts                    33,810 lines  (~150,000 tokens)
src/pages/SettingsPage.tsx      5,496 lines  (~25,000 tokens)
src/pages/TerminalPage.tsx      5,108 lines  (~23,000 tokens)
src/components/orbit/OrbitSystem.tsx  4,306 lines  (~19,000 tokens)
```

**AI Impact**:
- Cannot load entire file + related files + tests in one context
- Must use chunking strategies, increasing error risk
- Easy to miss relevant code sections
- High probability of introducing regressions

**Example Scenario**:
```
AI Task: "Add a new IPC handler for exporting goals"

Required Context:
1. main.ts (33,810 lines) - to find where to add handler
2. preload.ts (1,677 lines) - to expose API
3. types.ts - to add type definitions
4. Existing goal handlers (scattered in main.ts)
5. Database schema (in main.ts ~line 800)

Total tokens needed: ~200,000+ tokens
Typical context window: 128,000 tokens
Result: Cannot fit everything, must guess or chunk
```

**Recommendation**: 
- Maximum file size: 500 lines for components, 300 lines for utilities
- Extract IPC handlers into category-specific modules
- Split pages >1000 lines into feature components

---

### 2. Multiple Competing Patterns

**Problem**: Same functionality implemented multiple different ways.

**State Management Examples**:
```typescript
// Pattern 1: useState (local)
const [count, setCount] = useState(0);

// Pattern 2: useContext (global)
const { user } = useContext(AuthContext);

// Pattern 3: Custom store
const { state, dispatch } = useResumeStore();

// Pattern 4: Main process state
const state = await window.deskflowAPI.invoke('get-state');

// Pattern 5: LocalStorage
localStorage.setItem('pref', value);

// Pattern 6: Direct database
const rows = db.all('SELECT * FROM table');
```

**AI Impact**:
- Cannot predict which pattern to use for new features
- Risk of introducing inconsistent patterns
- Harder to find existing implementations
- Increased cognitive load when modifying code

**Recommendation**: 
- Document preferred pattern for each use case
- Migrate exceptions to standard pattern
- Add ESLint rules to enforce consistency

---

### 3. Hidden Dependencies

**Problem**: Components depend on global state without explicit props.

**Evidence**:
```typescript
// Component appears pure but has hidden dependencies:
function GoalList() {
  const { user } = useAuthStore();  // Hidden dependency
  const goals = useGoalStore();     // Hidden dependency
  const theme = useContext(ThemeContext);  // Hidden dependency
  
  return <div>{/* ... */}</div>;
}

// AI cannot tell dependencies from function signature
// Must read entire component body to understand coupling
```

**AI Impact**:
- Cannot determine blast radius of changes from signature
- May modify component without understanding all dependencies
- Testing requires setting up global state, not just props

**Recommendation**: 
```typescript
// Make dependencies explicit:
function GoalList({ 
  user, 
  goals, 
  theme 
}: GoalListProps) {
  return <div>{/* ... */}</div>;
}

// Parent handles dependency injection:
<GoalList 
  user={authStore.user} 
  goals={goalStore.goals}
  theme={themeContext.theme}
/>
```

---

### 4. Scattered Related Code

**Problem**: Related functionality distributed across many files.

**Example: Adding a New Feature**
```
To add "Project Tracking" feature, AI must modify:

1. /src/main.ts (add IPC handlers)
2. /src/preload.ts (expose API)
3. /src/types/index.ts (add types)
4. /src/App.tsx (add route)
5. /src/components/sidebar/Sidebar.tsx (add nav item)
6. /src/pages/ProjectsPage.tsx (create page)
7. /src/stores/projectStore.ts (create store)
8. /src/services/projectService.ts (create service)
9. /src/lib/constants.ts (add constants)
10. /src/index.css (add styles)

Files to inspect: 10+
Directories: 8
Lines of existing code to scan: ~50,000
```

**AI Impact**:
- High chance of missing a required file
- Easy to put code in wrong location
- Difficult to understand complete feature flow
- Onboarding time excessive

**Recommendation**: 
- Use feature-based organization:
```
/src/features/projects/
  ├── ProjectsPage.tsx
  ├── components/
  ├── hooks/
  ├── services/
  ├── types.ts
  └── index.ts
```

---

## Strengths for AI Understanding

### 1. Comprehensive Documentation Files

✅ **AGENTS.md** - Clear operating procedures
✅ **constraints.md** - Defined boundaries
✅ **patterns.md** - Established conventions
✅ **agent/state.md** - Cross-session visibility

**Example from AGENTS.md**:
```markdown
## Skill Router Pattern
Before executing any task:
1. Load appropriate skills
2. Validate task scope
3. Execute with monitoring
4. Update state hub
```

**AI Benefit**: Explicit instructions reduce guesswork.

---

### 2. Strong TypeScript Usage

✅ Strict mode enabled
✅ Most interfaces well-defined
✅ Type errors caught at compile time

**Example**:
```typescript
interface Session {
  id: string;
  startTime: number;
  endTime: number;
  appName: string;
  windowTitle?: string;
}

// AI knows exactly what shape data should be
```

**AI Benefit**: Types serve as executable documentation.

---

### 3. Consistent Naming Conventions

✅ PascalCase for components
✅ camelCase for functions/variables
✅ UPPER_SNAKE_CASE for constants
✅ Descriptive names (not `data`, `item`, etc.)

**AI Benefit**: Predictable naming reduces cognitive load.

---

## AI Cognitive Load Analysis

### Task: Fix a Bug in Session Tracking

**Current Architecture**:
```
Steps Required:
1. Identify bug location (scan main.ts ~33,810 lines)
2. Find related IPC handlers (scattered throughout main.ts)
3. Locate database queries (mixed with handlers)
4. Understand state flow (main → preload → renderer → store)
5. Trace state updates (multiple stores possible)
6. Find UI components displaying data (search multiple pages)
7. Verify fix doesn't break other features (manual testing)

Files to inspect: 8-12
Lines to scan: ~50,000
Time estimate: 2-4 hours
Error risk: HIGH
```

**Target Architecture**:
```
Steps Required:
1. Identify bug location (scan /src/infrastructure/ipc/session-handlers.ts ~300 lines)
2. Find related IPC handlers (same file)
3. Locate database queries (in /src/infrastructure/db/session-repository.ts)
4. Understand state flow (documented in ARCHITECTURE.md)
5. Trace state updates (single store: /src/state/session-store.ts)
6. Find UI components (in /src/features/sessions/)
7. Run automated tests

Files to inspect: 4-6
Lines to scan: ~2,000
Time estimate: 30-60 minutes
Error risk: LOW
```

**Improvement Factor**: 4x faster, 80% less code to scan, significantly lower risk

---

## Pattern Recognition Opportunities

### Patterns AI Can Leverage

✅ **IPC Handler Registration**
```typescript
// Consistent pattern across all handlers:
ipcMain.handle('action-name', async (event, payload) => {
  try {
    validate(payload);
    const result = await doAction(payload);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

✅ **React Component Structure**
```typescript
// Most components follow this pattern:
interface Props { /* ... */ }

export function ComponentName({ prop1, prop2 }: Props) {
  // 1. Hooks
  // 2. State
  // 3. Effects
  // 4. Handlers
  // 5. Render
}
```

### Patterns That Confuse AI

❌ **Inconsistent Error Handling**
```typescript
// Some handlers throw:
throw new Error('Failed');

// Some return error objects:
return { error: 'Failed' };

// Some log and continue:
console.error('Failed');
return result;
```

❌ **Mixed Export Styles**
```typescript
// Default exports:
export default Component;

// Named exports:
export { Component };

// Both in same file:
export default Component;
export const helper = () => {};
```

---

## Recommendations for AI Optimization

### Priority 1: Reduce File Sizes

**Action**: Split files >500 lines
**Benefit**: Fits in context with related code
**Effort**: High but one-time

### Priority 2: Standardize Patterns

**Action**: Choose one way for each concern
**Benefit**: Predictable code generation
**Effort**: Medium, ongoing

### Priority 3: Make Dependencies Explicit

**Action**: Pass via props, not global state
**Benefit**: Clear blast radius
**Effort**: Medium

### Priority 4: Add Architecture Documentation

**Action**: Create ARCHITECTURE.md with diagrams
**Benefit**: Faster onboarding
**Effort**: Low

### Priority 5: Add Tests

**Action**: Write integration tests for critical paths
**Benefit**: Safe refactoring, regression prevention
**Effort**: High but essential

---

## AI Agent Workflow Optimization

### Current Workflow (Suboptimal)
```
1. Read task description
2. Search codebase for relevant files (grep/ripgrep)
3. Read multiple large files
4. Mentally construct architecture model
5. Identify change locations
6. Make changes
7. Manually verify (no tests)
8. Hope for best
```

### Optimized Workflow (Target)
```
1. Read task description
2. Consult ARCHITECTURE.md for location guidance
3. Read focused modules (<500 lines each)
4. Follow documented patterns
5. Make changes
6. Run automated tests
7. Verify with type checker
8. Confident submission
```

---

## Metrics for AI Friendliness

Track these metrics during refactoring:

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Avg file size | 892 lines | <300 lines | LOC count |
| Max file size | 33,810 lines | <1000 lines | LOC count |
| Files per feature | 8-12 | 3-5 | Count modifications |
| Lines to scan | ~50,000 | <5,000 | Estimate per task |
| Pattern variations | 4-6 per concern | 1 per concern | Manual audit |
| Test coverage | 0% | 80%+ | Coverage tool |
| Time to onboard | Days | Hours | Measure |

---

## Conclusion

The RHEO codebase has **strong fundamentals** (TypeScript, documentation, naming) but suffers from **structural issues** that significantly impair AI-assisted development. The primary problems are:

1. **File sizes** that exceed practical context windows
2. **Pattern inconsistency** that creates decision paralysis
3. **Hidden dependencies** that obscure change impact
4. **Scattered code** that increases search costs

Addressing these issues will make the codebase not only better for AI agents but also significantly more maintainable for human developers. The recommended changes align with established software engineering best practices, suggesting that **optimizing for AI is largely about practicing good engineering consistently**.

---

**Next Steps**: Implement recommendations from `10-refactoring-plan.md` to systematically improve AI maintainability.
