# 10. Phased Refactoring Execution Plan

## Overview

This document provides a **step-by-step, independent-phase refactoring plan** that allows safe, incremental improvements without breaking the application. Each phase can be completed independently and maintains full app functionality.

## Guiding Principles

1. **Independent Phases**: No phase depends on completion of another
2. **App Stability**: Application remains fully functional after each phase
3. **Small Commits**: Each change is atomic and reviewable
4. **Rollback Safety**: Any phase can be reverted without affecting others
5. **Parallel Development**: Feature work can continue during refactoring

---

## Branch Strategy

```bash
# Create base branch for all refactoring work
git checkout main
git checkout -b refactor/architecture-base

# Create phase branches from architecture-base
git checkout -b refactor/phase-1-security    # Security fixes
git checkout -b refactor/phase-2-structure   # Extract modules
git checkout -b refactor/phase-3-components  # Break up god components
git checkout -b refactor/phase-4-domain      # Establish domain layer
git checkout -b refactor/phase-5-ui          # Visual cleanup
git checkout -b refactor/phase-6-tests       # Add tests
```

**Important**: All phase branches are created from `refactor/architecture-base`, NOT from each other. This ensures independence.

---

## Phase 1: Critical Security Fixes

**Branch**: `refactor/phase-1-security`
**Risk Level**: LOW (if done carefully)
**Time Estimate**: 1-2 days
**App Impact**: None (fixes are backward compatible)

### Tasks

#### 1.1 Fix SQL Injection Vulnerabilities

**Files to Modify**: `src/main.ts`

**Action**: Convert all string-concatenated SQL queries to parameterized queries.

**AI Prompt for Implementation**:
```
You are fixing critical SQL injection vulnerabilities in the Electron main process.

TASK: Convert all SQL queries in IPC handlers from string concatenation to parameterized queries.

RULES:
1. Never concatenate user input into SQL strings
2. Always use ? placeholders with parameter arrays
3. Add input validation before database operations
4. Wrap all handlers in try-catch blocks
5. Maintain exact same functionality - no behavior changes

EXAMPLE CONVERSION:

Before:
```typescript
ipcMain.handle('save-category', async (event, config) => {
  const sql = `INSERT INTO categories (app, domain) VALUES ('${config.app}', '${config.domain}')`;
  db.run(sql);
});
```

After:
```typescript
ipcMain.handle('save-category', async (event, config) => {
  try {
    // Validate
    if (!config.app || typeof config.app !== 'string') {
      throw new Error('Invalid app name');
    }
    
    // Sanitize
    const sanitizedApp = config.app.replace(/\0/g, '').slice(0, 255);
    const sanitizedDomain = config.domain?.replace(/\0/g, '').slice(0, 255) || '';
    
    // Parameterized query
    const sql = 'INSERT INTO categories (app, domain) VALUES (?, ?)';
    return new Promise((resolve, reject) => {
      db.run(sql, [sanitizedApp, sanitizedDomain], function(err) {
        if (err) reject(err);
        else resolve({ success: true, id: this.lastID });
      });
    });
  } catch (error) {
    console.error('Error saving category:', error);
    throw error;
  }
});
```

PROCESS:
1. Search for all `db.run(` calls in main.ts
2. Identify any with template literals or string concatenation
3. Convert to parameterized form
4. Add validation and sanitization
5. Add try-catch if not present
6. Test each handler individually

START WITH: Category-related handlers (lowest risk)
THEN: Session handlers
FINALLY: All other handlers

VERIFY: After each conversion, test the feature manually to ensure it still works.
```

#### 1.2 Remove Dead Files

**Files to Delete**: All `*.broken`, `*.corrupted`, `*.orig`, `*.bak` files

**AI Prompt**:
```
TASK: Clean up dead backup files from the repository.

COMMANDS TO RUN:
```bash
# Find all backup files
find . -name "*.broken" -type f
find . -name "*.corrupted" -type f
find . -name "*.orig" -type f
find . -name "*.bak" -type f

# Review the list, then delete:
find . -name "*.broken" -type f -delete
find . -name "*.corrupted" -type f -delete
find . -name "*.orig" -type f -delete
find . -name "*.bak" -type f -delete

# Update .gitignore
echo "# Backup files" >> .gitignore
echo "*.broken" >> .gitignore
echo "*.corrupted" >> .gitignore
echo "*.orig" >> .gitignore
echo "*.bak" >> .gitignore
```

VERIFY: Run `git status` to see all deletions staged.
```

#### 1.3 Add Global Error Handling

**Files to Modify**: `src/main.ts`

**AI Prompt**:
```
TASK: Add comprehensive error handling to prevent main process crashes.

ADD to top of main.ts (after imports):
```typescript
// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  // Log to file in production
  // Don't crash - attempt recovery
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Log to file
  // Attempt graceful shutdown
});
```

WRAP all existing IPC handlers in try-catch (use the pattern from task 1.1).

VERIFY: Intentionally trigger an error in a test handler to confirm it doesn't crash the app.
```

### Success Criteria

- [ ] Zero SQL injection vulnerabilities remain
- [ ] All dead files removed
- [ ] All IPC handlers have try-catch
- [ ] Global error handlers installed
- [ ] App passes manual testing of all features
- [ ] No regressions introduced

### Rollback Plan

If issues arise:
```bash
git checkout refactor/architecture-base
git branch -D refactor/phase-1-security
# Fix the issue in a new branch
```

---

## Phase 2: Extract IPC Handlers

**Branch**: `refactor/phase-2-structure`
**Risk Level**: MEDIUM
**Time Estimate**: 3-5 days
**App Impact**: None (internal restructuring)

### Tasks

#### 2.1 Create IPC Handler Modules

**New Directory Structure**:
```
src/infrastructure/ipc/
├── index.ts              # Exports all handlers
├── category-handlers.ts  # Category-related handlers
├── session-handlers.ts   # Session-related handlers
├── tracking-handlers.ts  # Activity tracking handlers
├── goal-handlers.ts      # Goal management handlers
├── finance-handlers.ts   # Finance handlers
└── system-handlers.ts    # System/app lifecycle handlers
```

**AI Prompt**:
```
TASK: Extract category-related IPC handlers from main.ts into a dedicated module.

STEP 1: Create src/infrastructure/ipc/category-handlers.ts
```typescript
import { BrowserWindow, ipcMain } from 'electron';
import Database from 'better-sqlite3';

export function registerCategoryHandlers(db: Database) {
  // Handler 1: Get all category configs
  ipcMain.handle('get-category-configs', async () => {
    try {
      const sql = 'SELECT * FROM category_configs';
      return new Promise((resolve, reject) => {
        db.all(sql, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    } catch (error) {
      console.error('Error getting category configs:', error);
      throw error;
    }
  });

  // Handler 2: Save category config
  ipcMain.handle('save-category-config', async (event, config) => {
    // ... (use secure pattern from Phase 1)
  });

  // Add all other category-related handlers here
}
```

STEP 2: In main.ts, replace the old handlers with:
```typescript
import { registerCategoryHandlers } from './infrastructure/ipc/category-handlers';

// In your handler registration function:
registerCategoryHandlers(db);
```

STEP 3: Verify all handlers are registered and working
STEP 4: Delete the old handler code from main.ts

REPEAT this process for each handler category:
- Sessions
- Tracking
- Goals
- Finance
- System

VERIFY: Test each feature after extraction to ensure handlers still work.
```

#### 2.2 Update Preload Layer

**Files to Modify**: `src/preload.ts`

**AI Prompt**:
```
TASK: Ensure preload.ts properly exposes all IPC channels.

REVIEW src/preload.ts and verify:
1. All IPC channels used by handlers are in validChannels array
2. contextBridge exposes all necessary methods
3. TypeScript types match handler signatures

ADD any missing channels discovered during handler extraction.

VERIFY: Build the app and check for TypeScript errors.
```

### Success Criteria

- [ ] main.ts reduced by ~60% (from 33,810 to <15,000 lines)
- [ ] Each handler module <500 lines
- [ ] All handlers still functional
- [ ] Clear organization by domain
- [ ] Easy to find where to add new handlers

---

## Phase 3: Break Up God Components

**Branch**: `refactor/phase-3-components`
**Risk Level**: MEDIUM-HIGH
**Time Estimate**: 5-7 days
**App Impact**: None (internal component structure)

### Target Components

| Component | Current Lines | Target Lines | Split Strategy |
|-----------|---------------|--------------|----------------|
| SettingsPage.tsx | 5,496 | <500 each | Extract sections into feature components |
| TerminalPage.tsx | 5,108 | <500 each | Separate terminal, controls, logs |
| OrbitSystem.tsx | 4,306 | <500 each | Separate scene, particles, effects, data viz |
| IDEProjectsPage.tsx | 4,396 | <500 each | Extract project cards, forms, lists |

**AI Prompt for SettingsPage**:
```
TASK: Break up SettingsPage.tsx (5,496 lines) into smaller, focused components.

ANALYSIS: SettingsPage contains these logical sections:
1. User profile settings
2. Notification preferences
3. Privacy settings
4. Appearance settings
5. Keyboard shortcuts
6. Backup/export settings
7. Advanced settings

STRATEGY:
1. Create /src/features/settings/ directory
2. Extract each section into its own component:
   - ProfileSettings.tsx (~400 lines)
   - NotificationSettings.tsx (~300 lines)
   - PrivacySettings.tsx (~500 lines)
   - AppearanceSettings.tsx (~400 lines)
   - ShortcutSettings.tsx (~600 lines)
   - BackupSettings.tsx (~500 lines)
   - AdvancedSettings.tsx (~400 lines)

3. Create SettingsPage.tsx as orchestrator (~300 lines):
```typescript
export function SettingsPage() {
  return (
    <div className="settings-page">
      <ProfileSettings />
      <NotificationSettings />
      <PrivacySettings />
      <AppearanceSettings />
      <ShortcutSettings />
      <BackupSettings />
      <AdvancedSettings />
    </div>
  );
}
```

4. Move shared hooks to /src/features/settings/hooks/
5. Move utilities to /src/features/settings/utils/
6. Keep only routing/orchestration logic in main SettingsPage

RULES:
- Preserve all existing functionality
- Keep props interfaces explicit
- Maintain same visual appearance
- Add JSDoc comments explaining each component's purpose

VERIFY: Manually test each settings section after extraction.
```

### Success Criteria

- [ ] No component exceeds 1,000 lines
- [ ] Each component has single responsibility
- [ ] Props clearly define dependencies
- [ ] Visual appearance unchanged
- [ ] All features still work

---

## Phase 4: Establish Domain Layer

**Branch**: `refactor/phase-4-domain`
**Risk Level**: HIGH
**Time Estimate**: 7-10 days
**App Impact**: None (new layer, backward compatible)

### Tasks

#### 4.1 Create Domain Entities

**New Directory Structure**:
```
src/domain/
├── entities/
│   ├── Session.ts
│   ├── Goal.ts
│   ├── FocusGroup.ts
│   └── Problem.ts
├── value-objects/
│   ├── TimeRange.ts
│   └── ActivityType.ts
├── events/
│   ├── SessionStarted.ts
│   └── GoalCompleted.ts
└── services/
    ├── SessionCalculator.ts
    └── GoalProgressTracker.ts
```

**AI Prompt**:
```
TASK: Create domain entity for Session.

CREATE src/domain/entities/Session.ts:
```typescript
/**
 * Session entity representing a focused work period.
 * 
 * Business Rules:
 * - A session must have a start time
 * - A session may have an end time (null if ongoing)
 * - Session duration cannot exceed 24 hours
 * - Sessions belong to exactly one app
 */
export interface SessionEntity {
  readonly id: string;
  readonly startTime: number;  // Unix timestamp
  readonly endTime: number | null;
  readonly appName: string;
  readonly windowTitle: string | null;
  readonly projectId: string | null;
  
  // Business logic methods
  getDuration(): number;  // Returns milliseconds
  isOngoing(): boolean;
  isValid(): boolean;
}

export function createSession(data: Partial<SessionEntity>): SessionEntity {
  // Validation logic
  if (!data.startTime) {
    throw new Error('Session must have start time');
  }
  
  // Business rule: max 24 hours
  if (data.endTime) {
    const duration = data.endTime - data.startTime;
    if (duration > 24 * 60 * 60 * 1000) {
      throw new Error('Session cannot exceed 24 hours');
    }
  }
  
  return {
    id: data.id || crypto.randomUUID(),
    startTime: data.startTime,
    endTime: data.endTime ?? null,
    appName: data.appName || '',
    windowTitle: data.windowTitle ?? null,
    projectId: data.projectId ?? null,
    
    getDuration(): number {
      return (this.endTime || Date.now()) - this.startTime;
    },
    
    isOngoing(): boolean {
      return this.endTime === null;
    },
    
    isValid(): boolean {
      return this.appName.length > 0 && this.startTime > 0;
    }
  };
}
```

REPEAT for other entities: Goal, FocusGroup, Problem, etc.

VERIFY: Write unit tests for each entity's business logic.
```

#### 4.2 Create Repository Interfaces

**AI Prompt**:
```
TASK: Create repository pattern for database access.

CREATE src/domain/repositories/SessionRepository.ts:
```typescript
import { SessionEntity } from '../entities/Session';

export interface SessionRepository {
  findById(id: string): Promise<SessionEntity | null>;
  findAll(filters: SessionFilters): Promise<SessionEntity[]>;
  create(session: SessionEntity): Promise<void>;
  update(id: string, updates: Partial<SessionEntity>): Promise<void>;
  delete(id: string): Promise<void>;
}

// Infrastructure implements this interface
// Domain layer only knows the interface, not implementation
```

IMPLEMENT in infrastructure:
```typescript
// src/infrastructure/repositories/sqlite-session-repository.ts
import { SessionRepository } from '../../domain/repositories/SessionRepository';
import { SessionEntity } from '../../domain/entities/Session';
import Database from 'better-sqlite3';

export class SqliteSessionRepository implements SessionRepository {
  constructor(private db: Database) {}
  
  async findById(id: string): Promise<SessionEntity | null> {
    // Use parameterized queries
    // Map to SessionEntity
  }
  
  // Implement other methods...
}
```

BENEFIT: Domain logic isolated from database implementation.
```

### Success Criteria

- [ ] All domain entities defined
- [ ] Business logic moved out of UI components
- [ ] Repository interfaces abstract database
- [ ] Domain layer has zero dependencies on UI/infrastructure
- [ ] Unit tests pass for all domain logic

---

## Phase 5: Visual Cleanup

**Branch**: `refactor/phase-5-ui`
**Risk Level**: LOW
**Time Estimate**: 3-5 days
**App Impact**: Visual changes only (functional behavior unchanged)

### Tasks

#### 5.1 Remove Excessive Animations

**AI Prompt**:
```
TASK: Remove decorative animations that don't add functional value.

SEARCH for these patterns in CSS/TSX:
- animation:.*infinite
- useSpring with loop:true
- gradient animations
- shimmer effects
- particle systems (decorative only)

REMOVE or make optional:
1. Gradient text animations (keep static gradients if needed)
2. Shimmer loaders (replace with simple spinners)
3. Background particles (remove entirely)
4. Infinite breathing/pulsing effects
5. Marquee text animations

KEEP:
1. Loading spinners (functional)
2. Transition animations (fade, slide - under 300ms)
3. Hover state changes
4. Focus indicators

EXAMPLE REMOVAL:

Before:
```css
.lyceum-animate-gradient {
  animation: lyceum-gradient 8s linear infinite;
}
```

After:
```css
/* Removed decorative animation */
.lyceum-gradient-bg {
  background: linear-gradient(45deg, #ec4899, #fbbf24);
}
```

VERIFY: Visual appearance is cleaner but still polished.
```

#### 5.2 Simplify Glassmorphism

**AI Prompt**:
```
TASK: Replace glassmorphism where it hurts readability.

IDENTIFY GlassCard usage:
```bash
grep -r "GlassCard" src/ --include="*.tsx"
```

REPLACE with solid backgrounds where:
- Text contrast is reduced
- Content is dense (tables, forms)
- Multiple cards overlap

EXAMPLE:

Before:
```tsx
<GlassCard className="bg-zinc-900/60 backdrop-blur-xl">
  <p className="text-zinc-300">Hard to read text</p>
</GlassCard>
```

After:
```tsx
<div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
  <p className="text-zinc-100">High contrast, easy to read</p>
</div>
```

KEEP glassmorphism only for:
- Hero sections (low text density)
- Decorative elements
- Modal backdrops

VERIFY: Improved readability, especially for long-form content.
```

#### 5.3 Restore Focus States

**AI Prompt**:
```
TASK: Restore accessibility focus indicators.

SEARCH for: `outline: none` or `outline: 0`

REMOVE these rules from index.css

ADD proper focus styles:
```css
:focus-visible {
  outline: 2px solid #ec4899;
  outline-offset: 2px;
}

button:focus-visible,
a:focus-visible {
  outline: 2px solid #ec4899;
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(236, 72, 153, 0.3);
}
```

VERIFY: Tab through all interactive elements and confirm visible focus rings.
```

### Success Criteria

- [ ] Reduced animation count by 70%
- [ ] Improved text contrast ratios
- [ ] Focus states restored
- [ ] Performance improved (fewer GPU operations)
- [ ] Accessibility score increased

---

## Phase 6: Add Tests

**Branch**: `refactor/phase-6-tests`
**Risk Level**: LOW
**Time Estimate**: Ongoing
**App Impact**: None (tests only)

### Tasks

#### 6.1 Set Up Testing Infrastructure

**AI Prompt**:
```
TASK: Configure testing framework.

INSTALL:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

CONFIGURE vitest.config.ts:
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['**/*.test.ts', '**/*.test.tsx']
  }
});
```

CREATE src/test/setup.ts:
```typescript
import '@testing-library/jest-dom';
```

VERIFY: Run a simple test to confirm setup works.
```

#### 6.2 Write Critical Path Tests

**AI Prompt**:
```
TASK: Write integration tests for critical user flows.

PRIORITIZE:
1. Session creation and tracking
2. Goal creation and progress updates
3. Category configuration
4. Data persistence (save/load)
5. IPC handler error handling

EXAMPLE TEST:
```typescript
// src/__tests__/session-tracking.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

describe('Session Tracking', () => {
  it('creates a new session when user starts focus', async () => {
    // Mock IPC call
    vi.mocked(window.deskflowAPI.invoke).mockResolvedValue({ success: true });
    
    render(<FocusButton />);
    
    fireEvent.click(screen.getByText('Start Focus'));
    
    expect(window.deskflowAPI.invoke).toHaveBeenCalledWith(
      'start-session',
      expect.objectContaining({
        appName: expect.any(String),
        startTime: expect.any(Number)
      })
    );
  });
});
```

AIM FOR: 80% coverage on critical paths first.
```

### Success Criteria

- [ ] Testing infrastructure configured
- [ ] Critical path tests written
- [ ] CI pipeline runs tests
- [ ] Coverage reports generated
- [ ] Tests run on every PR

---

## Execution Order

While phases are independent, recommended order:

1. **Phase 1** (Security) - Do first, highest priority
2. **Phase 2** (Extract IPC) - Quick win, reduces main.ts size
3. **Phase 3** (Components) - Improves maintainability
4. **Phase 4** (Domain) - Architectural improvement
5. **Phase 5** (UI Cleanup) - Quality of life
6. **Phase 6** (Tests) - Enables safe future refactoring

## Monitoring Progress

Track these metrics per phase:

| Metric | Before | After Phase 1 | After Phase 2 | Target |
|--------|--------|---------------|---------------|--------|
| main.ts lines | 33,810 | 33,810 | <15,000 | <5,000 |
| Security issues | 10+ | 0 | 0 | 0 |
| Avg component size | 892 | 892 | 892 | <300 |
| Test coverage | 0% | 0% | 0% | 80%+ |

## Conflict Resolution

If feature development conflicts with refactoring:

1. Complete feature on feature branch
2. Merge feature into `refactor/architecture-base`
3. Rebase refactoring phases onto updated base
4. Resolve conflicts in refactoring branches

## Final Integration

Once all phases complete and tested:

```bash
# Merge all phases into architecture-base
git checkout refactor/architecture-base
git merge refactor/phase-1-security
git merge refactor/phase-2-structure
git merge refactor/phase-3-components
git merge refactor/phase-4-domain
git merge refactor/phase-5-ui
git merge refactor/phase-6-tests

# Test thoroughly
npm run build
npm run test

# Create PR to main
git checkout main
git merge refactor/architecture-base
```

---

**Ready to Begin**: Start with Phase 1 using the provided AI prompts.
