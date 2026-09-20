# 2. Architecture Audit

## Current System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Main Process                     │
│  (src/main.ts - 33,810 lines)                               │
│  - Window management, IPC handlers, SQLite DB, tracking     │
│  - Active window polling, game detection, sleep tracking    │
│  - Backup services, terminal relay, state coordinator       │
└─────────────────────────────────────────────────────────────┘
                            ↕ IPC
┌─────────────────────────────────────────────────────────────┐
│                   Preload Bridge                             │
│  (src/preload.ts - 1,677 lines)                            │
│  - contextBridge exposing deskflowAPI                       │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                  React Renderer                              │
│  (src/App.tsx - 3,695 lines)                               │
│  - Routing, sidebar navigation, global state                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Pages (20+ pages, many 2000-5000+ lines each)       │   │
│  │ Components (100+ components, mixed quality)          │   │
│  │ Features (modular but inconsistent boundaries)       │   │
│  │ Services (API calls, context bundles)                │   │
│  │ Stores (resumeStore, authStore)                      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Boundary Analysis

### 1. Main Process ↔ Renderer Boundary

**Status**: ✅ **Mostly Clear**

The IPC boundary between main and renderer processes is well-defined:
- Explicit handler registration in main.ts
- contextBridge API in preload.ts
- TypeScript types for IPC payloads

**Issues**:
- No validation layer for incoming IPC messages
- Error handling inconsistent across handlers
- Some handlers bypass proper error propagation

**Example of Good Pattern**:
```typescript
// preload.ts - Clean exposure
contextBridge.exposeInMainWorld('deskflowAPI', {
  send: (channel: string, data: unknown) => {
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  receive: (channel: string, func: (...args: unknown[]) => void) => {
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => func(...args));
    }
  }
});
```

**Example of Problem**:
```typescript
// main.ts - No validation, direct SQL concatenation
ipcMain.handle('save-category-config', async (event, config) => {
  const sql = `INSERT INTO categories VALUES (${config.app}, ${config.domain})`;
  // Vulnerable to injection if config contains malicious data
  db.run(sql);
});
```

### 2. Pages ↔ Components Boundary

**Status**: ⚠️ **Blurred**

**Problems**:
- Pages contain component-level logic
- Components import page-level types
- No clear ownership of business logic

**Evidence**:
```typescript
// src/pages/DashboardPage.tsx (2,847 lines)
// Contains both:
// - Page-level routing logic
// - Component-level state management
// - Direct database queries via IPC
// - Business logic for session calculation
```

**Expected Pattern**:
```
Pages: Route-level composition, data fetching
Components: Pure presentation, props-driven
Features: Business logic encapsulation
```

### 3. Features ↔ Shared Boundary

**Status**: ⚠️ **Inconsistent**

Some features are self-contained:
```
/src/features/finance/
  ├── FinancePage.tsx
  ├── components/
  ├── services/
  └── types.ts
```

Others leak into shared:
```typescript
// /src/components/finance/TransactionList.tsx
import { formatCurrency } from '/src/lib/utils';  // Leaks to lib
import { useAuthStore } from '/src/stores/authStore';  // Leaks to stores
import { db } from '/src/main';  // Direct DB access!
```

### 4. Domain Logic ↔ UI Boundary

**Status**: ❌ **Mixed**

**Critical Issue**: Business logic embedded directly in presentation components.

**Example**:
```typescript
// src/pages/GoalsPage.tsx
const calculateGoalProgress = (goal: Goal) => {
  // Business rule: progress = completed tasks / total tasks
  const totalTasks = goal.tasks.length;
  const completedTasks = goal.tasks.filter(t => t.completed).length;
  return totalTasks === 0 ? 0 : (completedTasks / totalTasks) * 100;
};

// This logic should be in a domain service, not a UI component
```

**Consequence**: 
- Cannot test business logic without rendering UI
- AI agents cannot reason about domain independently
- Changes to business rules require touching UI components

### 5. State Ownership Boundary

**Status**: ⚠️ **Unclear**

**Competing State Systems**:

| System | Location | Purpose | Overlap |
|--------|----------|---------|---------|
| useState | Components | Local UI state | Minimal |
| useContext | /src/context, /src/contexts | Global UI state | High |
| Custom stores | /src/stores/*Store.ts | Complex state | High |
| Main-process state | src/main.ts | Cross-session state | Medium |
| LocalStorage | Browser | Preferences | Low |
| SQLite | Database | Persistent data | Medium |

**Problem**: Same data often exists in multiple systems simultaneously.

**Example**: Session state exists in:
1. Main process StateCoordinator
2. Renderer localStorage
3. Component useState
4. SQLite database

No clear owner for updates → race conditions possible.

## Module Cohesion Analysis

### Well-Structured Modules

✅ **IPC Handler Registration**
```typescript
// Focused responsibility: register all handlers
function registerAllHandlers(db: Database) {
  registerCategoryHandlers(db);
  registerSessionHandlers(db);
  registerTrackingHandlers(db);
  // Clear, predictable pattern
}
```

✅ **Design Token System**
```css
/* /src/index.css */
@theme inline {
  --color-primary: #ec4899;
  --color-secondary: #fbbf24;
  /* Centralized, discoverable */
}
```

### Poorly-Structured Modules

❌ **main.ts (33,810 lines)**
Responsibilities mixed together:
- Window creation
- IPC handling (600+ handlers)
- Database operations
- Active window polling
- Game detection
- Sleep tracking
- Backup scheduling
- Terminal relay
- State coordination
- Menu building
- Tray management

**Cohesion Score**: 2/10 (extremely low)

❌ **OrbitSystem.tsx (4,306 lines)**
Responsibilities mixed:
- Three.js scene setup
- Particle system
- Post-processing effects
- Data visualization logic
- Animation loops
- Texture generation
- User interaction
- Tooltip rendering

**Cohesion Score**: 3/10 (low)

## Coupling Analysis

### High Coupling Areas

**1. Direct Database Access from UI**
```typescript
// Multiple components do this:
const { data } = await window.deskflowAPI.invoke('get-sessions', { date });
// Component now coupled to:
// - IPC implementation
// - Database schema
// - Main process availability
```

**Impact**: Changing database schema requires updating UI components.

**2. Global State Dependencies**
```typescript
// Component implicitly depends on global state:
const { user } = useAuthStore();  // Where did this come from?
// AI must trace through store initialization to understand
```

**Impact**: Hidden dependencies make refactoring risky.

**3. Cross-Layer Imports**
```typescript
// UI component imports infrastructure:
import { db } from '../../main';  // Presentation → Infrastructure
// Violates dependency direction
```

### Acceptable Coupling

✅ **IPC Contract**
```typescript
// Explicit, documented coupling:
interface DeskflowAPI {
  invoke(channel: 'get-sessions', args: { date: string }): Promise<Session[]>;
}
// Clear contract, easy to mock for testing
```

## Abstraction Quality

### Useful Abstractions

✅ **Class Variance Authority (CVA)**
```typescript
const buttonVariants = cva(
  'inline-flex items-center justify-center',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
      },
      size: { /* ... */ }
    }
  }
);
// Solves real problem: consistent button variants
```

✅ **Atomic File Writes**
```typescript
// Prevents corruption on crash:
fs.writeFileSync(tempPath, data);
fs.renameSync(tempPath, targetPath);
// Simple, effective, solves real problem
```

### Unnecessary Abstractions

❌ **Over-Engineered Context Wrapper**
```typescript
// Five layers of abstraction for simple state:
const useEnhancedContextWithMiddleware = createEnhancedContext(
  withLogging(
    withValidation(
      withRetry(
        createContext(initialState)
      )
    )
  )
);
// Could be: const [state, setState] = useState(initialState);
```

❌ **Premature Generic Service**
```typescript
abstract class BaseEntityService<T extends IEntity> {
  protected abstract getRepository(): IRepository<T>;
  // ... 200 lines of generic CRUD
}
// Only one entity uses this; direct functions would be simpler
```

## Dependency Flow

### Current Flow (Problematic)

```
UI Component
    ↓ (direct IPC call)
Main Process Handler
    ↓ (direct SQL)
SQLite Database
    ↑ (callback)
Main Process Handler
    ↓ (raw data)
UI Component
    ↓ (business logic in component)
State Update
    ↓
Re-render
```

**Problems**:
- Business logic in wrong layer
- No validation between layers
- Raw database errors can reach UI

### Target Flow (Recommended)

```
UI Component
    ↓ (use case invocation)
Application Service (Use Case)
    ↓ (domain operation)
Domain Entity
    ↓ (repository interface)
Infrastructure Adapter
    ↓ (parameterized query)
SQLite Database
    ↑ (entity or error)
Infrastructure Adapter
    ↓ (domain event)
Application Service
    ↓ (state update)
State Store
    ↓ (subscription)
UI Component
```

**Benefits**:
- Each layer has single responsibility
- Validation at boundaries
- Business logic isolated and testable
- Errors transformed appropriately

## Architectural Patterns Used

| Pattern | Usage | Assessment |
|---------|-------|------------|
| **IPC Bridge** | Main ↔ Renderer | ✅ Appropriate |
| **Context Provider** | Global UI state | ⚠️ Overused |
| **Hub/Spoke** | Multi-agent coordination | ✅ Innovative |
| **Repository** | Database access | ⚠️ Inconsistent |
| **Observer** | State subscriptions | ✅ Appropriate |
| **Factory** | Component creation | ❌ Unnecessary |
| **Singleton** | Main process services | ⚠️ Makes testing hard |
| **Strategy** | Multiple state systems | ❌ Accidental complexity |

## Recommendations

### Immediate Actions

1. **Extract IPC Handlers**
   - Create `/src/infrastructure/ipc/*.ts` modules
   - Group by domain (categories, sessions, tracking, etc.)
   - Add validation at handler boundaries

2. **Add Error Boundaries**
   - Wrap major UI sections
   - Catch unhandled IPC errors
   - Provide recovery paths

3. **Remove Dead Files**
   - Delete `*.broken`, `*.corrupted`, `*.orig` files
   - Clean up unused imports

### Short-term Improvements

1. **Establish Domain Layer**
   - Create `/src/domain/entities/`
   - Move business logic out of UI
   - Define clear interfaces

2. **Consolidate State**
   - Choose primary state management approach
   - Document when to use each pattern
   - Migrate duplicate patterns

3. **Break Up God Files**
   - Split main.ts by handler category
   - Decompose large pages into features
   - Extract reusable hooks

### Long-term Restructuring

1. **Implement Clean Architecture**
   - Separate domain, application, infrastructure, presentation
   - Enforce dependency direction
   - Add comprehensive tests

2. **Standardize Patterns**
   - One way to fetch data
   - One way to manage state
   - One way to handle errors

---

**Next**: Review `03-security-assessment.md` for specific vulnerabilities found during this audit.
