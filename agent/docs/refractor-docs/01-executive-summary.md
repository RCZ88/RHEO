# 1. Executive Summary

## Overall Architectural Character

RHEO is a feature-rich Electron desktop application for AI-powered productivity tracking and orchestration. The system combines:
- Real-time activity tracking (apps, websites, IDE usage)
- AI agent orchestration with terminal workspaces
- Life admin features (finance, goals, learning)
- Elaborate 3D visualization system

The codebase demonstrates **ambitious scope** with **genuine utility**, but suffers from **architectural immaturity** typical of rapidly-developed AI-assisted projects.

## Largest Strengths

### 1. Comprehensive Feature Set
- Activity tracking with granular app/window detection
- Multi-agent coordination system (Hub/Spoke pattern)
- Integrated finance tracking and goal management
- Real-time terminal workspaces for AI agents
- Resume builder with AI assistance
- Learning platform (Lyceum) integration

### 2. Strong Technical Foundations
- TypeScript strict mode throughout
- Well-defined IPC contract between main/renderer processes
- SQLite with JSON fallback for resilient storage
- Atomic file writes preventing corruption
- Session ID tracking for multi-agent workflows

### 3. Good Documentation for AI Agents
- AGENTS.md with operating procedures
- constraints.md defining boundaries
- patterns.md establishing conventions
- Agent state coordination via Hub/Spoke

## Largest Weaknesses

### 1. Severe File Bloat (CRITICAL)
| File | Lines | Risk Level |
|------|-------|------------|
| `src/main.ts` | 33,810 | CRITICAL |
| `src/pages/SettingsPage.tsx` | 5,496 | CRITICAL |
| `src/pages/TerminalPage.tsx` | 5,108 | CRITICAL |
| `src/components/ai/orbit/OrbitSystem.tsx` | 4,306 | HIGH |
| `src/pages/IDEProjectsPage.tsx` | 4,396 | HIGH |
| `src/pages/ExternalPage.tsx` | 3,448 | HIGH |
| `src/App.tsx` | 3,695 | HIGH |

**Impact**: These files are impossible to safely modify without breaking unrelated functionality. They exceed typical context windows, making AI-assisted refactoring difficult.

### 2. Security Vulnerabilities (CRITICAL)
- **SQL Injection**: Direct string concatenation in database queries
- **Input Validation**: Missing sanitization of user-provided data
- **Error Handling**: Uncaught exceptions in main process
- **Dead Files**: *.broken, *.corrupted, *.orig files in repository

### 3. Architectural Duplication
- Both `/src/context` AND `/src/contexts` directories
- Multiple competing state management approaches
- Inconsistent service patterns (classes vs functions vs objects)
- Business logic scattered across UI, services, and main process

### 4. AI Slop in Visual Design
- Heavy glassmorphism (50+ instances)
- Gradient text effects (20+ instances)
- Excessive framer-motion animations (infinite loops everywhere)
- Generic shadcn/ui component proliferation without customization
- Decorative particles and shimmer effects with zero functional value

## Most Important Problems

### Problem 1: God Files Block All Progress
**Evidence**: `main.ts` contains 33,810 lines with:
- 600+ IPC handlers
- Window management
- Database operations
- Active window polling
- Game detection
- Sleep tracking
- Backup services
- Terminal relay
- State coordination

**Consequence**: Any change requires understanding the entire file. Merge conflicts are catastrophic. Testing is impossible without manual verification of all features.

### Problem 2: No Clear Domain Layer
**Evidence**: Domain concepts (sessions, goals, focus groups, problems) are represented directly in UI components rather than through dedicated domain models.

**Consequence**: Business logic leaks into presentation code. Changes to business rules require touching UI components. AI agents cannot reason about domain independently.

### Problem 3: Visual Design Prioritizes Decoration Over Function
**Evidence**: 
- GlassCard component reduces text contrast for aesthetic effect
- Three simultaneous infinite animations on welcome screen
- Finance lock screen uses cyberpunk neon glow for financial data
- 4306-line OrbitSystem mostly for decorative particles

**Consequence**: Cognitive load increased. Accessibility compromised. Users distracted from actual tasks.

### Problem 4: Inconsistent Patterns Create Cognitive Overhead
**Evidence**:
- State: useState, useContext, custom stores, localStorage, main-process state
- Styling: Tailwind, CSS modules, inline styles, styled-components patterns
- Data fetching: direct IPC, service wrappers, custom hooks, context providers

**Consequence**: Every new feature requires guessing which pattern to use. AI agents make inconsistent choices.

## Most Important Opportunities

### Opportunity 1: Extract IPC Handlers (High Impact, Low Risk)
Extract the 600+ IPC handlers from `main.ts` into focused modules by category:
- `/src/infrastructure/ipc/category-handlers.ts`
- `/src/infrastructure/ipc/session-handlers.ts`
- `/src/infrastructure/ipc/tracking-handlers.ts`
- etc.

**Benefit**: Reduces `main.ts` by ~60% immediately. Makes handler logic discoverable. Enables targeted testing.

### Opportunity 2: Establish Domain Layer (High Impact, Medium Risk)
Create `/src/domain` directory with:
- Entities (Session, Goal, FocusGroup, Problem, etc.)
- Value objects
- Domain events
- Business rules

**Benefit**: Isolates business logic from UI and infrastructure. Makes domain concepts explicit for AI reasoning.

### Opportunity 3: Remove Visual Decoration (Medium Impact, Low Risk)
Systematically remove:
- Unnecessary animations
- Glassmorphism where it hurts readability
- Gradient text without semantic meaning
- Decorative particles

**Benefit**: Improved performance. Better accessibility. Cleaner visual hierarchy. Reduced bundle size.

### Opportunity 4: Standardize State Management (High Impact, Medium Risk)
Choose one primary approach (recommendation: Zustand for client state, main-process for shared state) and migrate other patterns.

**Benefit**: Predictable data flow. Easier debugging. Clearer ownership.

## Risk Assessment

| Risk Category | Current State | Trend | Mitigation |
|---------------|---------------|-------|------------|
| Security | HIGH | ⚠️ Worsening | Immediate SQL injection fixes |
| Maintainability | HIGH | ⚠️ Worsening | Phase-by-phase refactoring |
| Performance | MEDIUM | → Stable | Profile before optimizing |
| Accessibility | HIGH | ⚠️ Worsening | Restore focus states |
| Technical Debt | HIGH | ⚠️ Worsening | Track TODOs, prioritize |

## Recommended Priority Order

1. **CRITICAL - Security Fixes** (Week 1)
   - Fix SQL injection vulnerabilities
   - Add input sanitization
   - Remove dead files

2. **HIGH - Structural Improvements** (Weeks 2-6)
   - Extract IPC handlers from main.ts
   - Break up god components
   - Establish domain layer

3. **MEDIUM - Visual Cleanup** (Weeks 7-8)
   - Remove excessive animations
   - Simplify glassmorphism
   - Fix accessibility issues

4. **LOW - AI Optimization** (Weeks 9-10)
   - Add architecture documentation
   - Create component index
   - Add integration tests

## Success Metrics

After refactoring, the codebase should:
- ✅ Have no files exceeding 1,000 lines
- ✅ Pass security audit with zero SQL injection vectors
- ✅ Enable AI agents to locate features within 2-3 files
- ✅ Maintain 100% backward compatibility during migration
- ✅ Reduce visual decoration by 70%
- ✅ Achieve consistent patterns across all features

---

**Next Steps**: Review `03-security-assessment.md` for immediate vulnerabilities, then proceed to `10-refactoring-plan.md` for execution details.
