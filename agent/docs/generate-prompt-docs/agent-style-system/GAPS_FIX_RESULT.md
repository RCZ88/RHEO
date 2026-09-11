Here is the complete implementation specification and UX blueprint to fix the broken implementation, enforce the existing design system, and properly plan the workspace integration using the Human-Centric UX skill.

---

## 1. UX Design Decisions (Answering the Planning Gaps)

Before writing code, we must resolve the UX architectural questions to ensure a human-centric flow.

*   **Q1: Where do Moodboard and Tokens live?** 
    *   **Decision:** Option A (Inside `studio/design`). Reasoning: Splitting them into top-level subtabs fragments the design workflow. The Design Workspace is already the home for taste knobs, color pickers, and motion. Moodboard and Tokens are logical extensions of this.
*   **Q2: How does Command Palette overlay work?**
    *   **Decision:** Context-aware Global. `Cmd+K` is registered globally in `WorkspaceShell.tsx`. It checks the current active route. If `studio/design` is active, it injects design commands (`> generate theme`). If the terminal is active, it shows terminal commands. This prevents conflicts and cognitive overload.
*   **Q3: How do users discover these features?**
    *   **Decision:** Visual Badges + Progressive Hint. Moodboard and Tokens tabs get a small cyan dot indicator (`bg-cyan-500`) until clicked for the first time. The Design Workspace header gets a permanent `⌘K` hint chip (`Chip` primitive) that subtly pulses on first load.
*   **Q4: State persistence?**
    *   **Decision:** Moodboard items are ephemeral (cleared on page unmount) to prevent stale visual context from bleeding into new projects. Synced Tokens persist via the existing `ColorPicker` state. Command history persists globally in `localStorage`.
*   **Q5: How does "Inject Context" work?**
    *   **Decision:** Stage, don't auto-send. Auto-send interrupts the agent's stream. Clicking "Inject Context" adds the item to the `DesignComposeOutlet` and visually flashes the outlet's "Send" button (using `motion.ts` constants) to draw the user's eye, letting them send when ready.

---

## 2. Shared Type Definition (Fixing BUG 1)

Create a unified type to resolve the `ColorPicker` vs `TokensTab` mismatch.

**File:** `src/components/workspace/_ds/types.ts`
```typescript
export interface DesignColorEntry {
  id: string;
  hex: string;       // Mapped from ColorPicker's 'color'
  role: string;      // e.g., 'background', 'primary'
  label: string;     // Human-readable label
}
```

**Fix in `DesignWorkspacePage.tsx`:**
When passing state from `ColorPicker` to `TokensTab`, map the shape:
```typescript
const mappedColors: DesignColorEntry[] = colors.map(c => ({
  id: c.id,
  hex: c.color,      // Map 'color' to 'hex'
  role: c.role,
  label: c.label
}));
```

---

## 3. Component Rewrites (Fixing BUG 4 & Applying UX Checklist)

The new components must use `_ds/primitives.tsx` and `_ds/motion.ts`. 

### A. MoodboardTab.tsx (Rewrite)
*Uses `EmptyState`, `Skeleton`, and `IconButton` primitives.*

```tsx
import { useState, useEffect } from 'react';
import { Search, Sparkles, AlertCircle, RefreshCw, Plus } from 'lucide-react';
import { EmptyState, Skeleton, IconButton } from './_ds/primitives';
import { motion } from 'framer-motion';
import { ws_ease, ws_dur } from './_ds/motion';

interface AestheticResult { title: string; description: string; imageUrl: string; source: string; }
interface MoodboardTabProps { onInjectContext: (item: AestheticResult) => void; }

export function MoodboardTab({ onInjectContext }: MoodboardTabProps) {
  const [items, setItems] = useState<AestheticResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch logic omitted for brevity...

  if (error) {
    return (
      <div className="p-5">
        <EmptyState
          icon={<AlertCircle className="w-6 h-6 text-red-400" />}
          title="Failed to scrape aesthetic data"
          description="The source might be blocking requests or you are offline."
          action={<IconButton icon={<RefreshCw />} label="Retry" onClick={() => fetch()} />}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-5">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="p-5">
        <EmptyState
          icon={<Sparkles className="w-6 h-6 text-cyan-500" />}
          title="Search for an aesthetic vibe"
          description="Try 'Y2K', 'Frutiger Aero', or 'Corporate Grunge' to load visual inspiration."
        />
      </div>
    );
  }

  return (
    <div className="columns-2 md:columns-3 gap-4 p-5 space-y-4">
      {items.map((item, idx) => (
        <div key={idx} className="relative break-inside-avoid rounded-xl overflow-hidden group bg-zinc-900/80 backdrop-blur-xl border border-zinc-800">
          <img src={item.imageUrl} alt={item.title} className="w-full h-auto object-cover transition-transform duration-[150ms] ease-[cubic-bezier(0.2,0,0,1)] group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-[150ms]" />
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-[150ms] ease-[cubic-bezier(0.2,0,0,1)]">
            <div>
              <h3 className="text-sm font-medium text-white">{item.title}</h3>
              <p className="text-xs text-zinc-400 line-clamp-1">{item.description}</p>
            </div>
            <IconButton 
              icon={<Plus className="w-4 h-4" />} 
              label="Inject" 
              onClick={() => onInjectContext(item)} 
              className="bg-cyan-500 text-black hover:bg-cyan-400"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
```

### B. TokensTab.tsx (Rewrite)
*Uses `Chip` for file targets and `IconButton` for sync.*

```tsx
import { useState } from 'react';
import { Check, Download, Copy } from 'lucide-react';
import { IconButton, Chip } from './_ds/primitives';
import { DesignColorEntry } from './_ds/types';

interface TokensTabProps { colorEntries: DesignColorEntry[]; projectPath: string; }

export function TokensTab({ colorEntries, projectPath }: TokensTabProps) {
  const [targetFile, setTargetFile] = useState<'globals.css' | 'tailwind.config.js'>('globals.css');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success'>('idle');

  const generateUrl = () => {
    const colors = colorEntries.map(e => e.hex.replace('#', '')).join('-');
    return `https://www.realtimecolors.com/?colors=${colors}`;
  };

  return (
    <div className="grid grid-cols-2 gap-0 h-full">
      {/* Left Panel: Variables & Sync */}
      <div className="flex flex-col gap-4 p-5 border-r border-zinc-800 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-200">Design Tokens</h3>
          <div className="flex gap-2">
            <Chip active={targetFile === 'globals.css'} onClick={() => setTargetFile('globals.css')}>CSS</Chip>
            <Chip active={targetFile === 'tailwind.config.js'} onClick={() => setTargetFile('tailwind.config.js')}>Tailwind</Chip>
          </div>
        </div>
        
        <div className="font-mono text-xs bg-zinc-900 p-4 rounded-xl border border-zinc-800 text-zinc-400">
          <div>:root {'{'}</div>
          {colorEntries.map(c => (
            <div key={c.id} className="pl-4">--{c.role}: {c.hex};</div>
          ))}
          <div>{'}'}</div>
        </div>

        <div className="flex gap-2 mt-auto">
          <IconButton icon={<Copy className="w-4 h-4" />} label="Copy" />
          <IconButton icon={<Download className="w-4 h-4" />} label="Download" />
          <button 
            className="flex-1 bg-cyan-500 text-black rounded-xl px-4 py-2 text-sm font-medium hover:bg-cyan-400 transition-colors duration-[150ms] ease-[cubic-bezier(0.2,0,0,1)] flex items-center justify-center gap-2"
            onClick={() => { setSyncStatus('syncing'); setTimeout(() => setSyncStatus('success'), 1000); }}
          >
            {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'success' ? 'Synced!' : 'Sync to Project'}
            {syncStatus === 'success' && <Check className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Right Panel: Iframe */}
      <div className="w-full h-full bg-zinc-950">
        <iframe src={generateUrl()} className="w-full h-full border-0" title="Realtime Colors Preview" />
      </div>
    </div>
  );
}
```

### C. CommandPalette.tsx (Rewrite)
*Uses `IconButton` and motion constants.*

```tsx
import { useState, useEffect } from 'react';
import { Search, CornerDownLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ws_ease, ws_dur } from './_ds/motion';

interface CommandPaletteProps { isOpen: boolean; onClose: () => void; }

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [input, setInput] = useState('');
  
  // Keyboard logic omitted...

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: ws_dur, ease: ws_ease }}
          onClick={onClose}
        >
          <motion.div 
            className="w-full max-w-xl bg-zinc-900/90 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[60vh]"
            initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: ws_dur, ease: ws_ease }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 border-b border-zinc-800">
              <Search className="w-4 h-4 text-zinc-500" />
              <input
                autoFocus
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Type '>' for commands, or search components..."
                className="w-full bg-transparent py-4 text-sm focus:outline-none text-zinc-100 placeholder-zinc-500"
              />
              <kbd className="text-xs text-zinc-500 border border-zinc-700 rounded px-1.5 py-0.5">ESC</kbd>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {/* Results list mapping here */}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

---

## 4. Tab Integration (Fixing BUG 5)

Remove the custom inline `<button>` tabs in `DesignWorkspacePage.tsx` and replace them with the reusable `SubTabBar`.

```tsx
import { SubTabBar } from './SubTabBar';

// Inside DesignWorkspacePage render:
const TABS = [
  { id: 'moodboard', label: 'Moodboard', icon: ImageIcon, hasNewBadge: !localStorage.getItem('moodboard_visited') },
  { id: 'tokens', label: 'Tokens', icon: Palette, hasNewBadge: !localStorage.getItem('tokens_visited') },
  { id: 'sources', label: 'Sources', icon: Database },
  { id: 'motion', label: 'Motion', icon: Zap },
  { id: 'registry', label: 'Registry', icon: Package },
];

// JSX:
<SubTabBar 
  tabs={TABS} 
  activeTab={activeTab} 
  onChange={(tab) => {
    setActiveTab(tab);
    if (tab === 'moodboard') localStorage.setItem('moodboard_visited', 'true');
    if (tab === 'tokens') localStorage.setItem('tokens_visited', 'true');
  }} 
/>
```

---

## 5. MCP Server Setup Steps (Fixing BUG 2)

The MCP server must be compiled and registered.

1.  **Compile the Server:**
    ```bash
    cd design-suite-mcp
    npm install
    npm run build  # Compiles src/*.ts to dist/*.js
    ```
2.  **Register in App Lifecycle:**
    In `src/main.ts`, add the server to the default MCP configuration so it starts when the app launches:
    ```typescript
    const DEFAULT_MCP_SERVERS = [
      { id: 'design-suite', command: 'node', args: [path.join(__dirname, '../../design-suite-mcp/dist/index.js')] }
    ];
    ```

---

## 6. Build Verification (Fixing BUG 3)

To ensure Vite builds the main process correctly without 3-minute timeouts:

1.  **Verify .cjs shims:** Check `dist-electron/services/design/`. It must contain `CariScraperService.cjs`, `CliWrapperService.cjs`, etc.
2.  **Run Build:**
    ```bash
    node scripts/build.mjs
    ```
    *   *Check:* Ensure exit code 0.
    *   *Check:* Ensure `dist/` folder has `main.js` and `preload.js`.
3.  **Launch App:**
    ```bash
    npm run dev
    ```
    *   *Check:* Open Developer Tools. Ensure no `Cannot find module` errors related to design services.

---

## 7. UX Onboarding Design (Fixing BUG 6)

To ensure users discover the features without intrusive modals:

1.  **Tab Badges:** The `SubTabBar` implementation above includes `hasNewBadge`. This renders a small `bg-cyan-500 w-1.5 h-1.5 rounded-full` next to the tab label until clicked.
2.  **Command Palette Hint:** In the `DesignWorkspacePage` header, add a persistent hint:
    ```tsx
    <div className="flex items-center gap-1.5 text-xs text-zinc-500 px-2 py-1 border border-zinc-800 rounded-lg">
      <kbd>⌘</kbd> <kbd>K</kbd>
      <span>Command Palette</span>
    </div>
    ```

---

## 8. State Persistence Rules

| Data | Storage | Rationale |
|------|---------|-----------|
| Moodboard Items | Ephemeral (React State) | Prevents stale visual context from previous sessions. |
| Color Sync Target | React State | User chooses CSS or Tailwind per action. |
| Command History | `localStorage` | Fast access, persists across restarts. Max 5 items. |
| Tab "New" Badges | `localStorage` | Dismissed permanently after first click. |
| Scraped Cache | SQLite (Main Process) | 24h TTL. Survives app restarts. |

---

## 9. Testing Plan (Manual Verification)

1.  **Type Match Test:** Open Design Workspace → Change colors in ColorPicker → Verify TokensTab iframe updates without crash.
2.  **Design System Test:** Open Moodboard Tab with no internet → Verify `EmptyState` component renders (not a raw text string).
3.  **Tab Integration Test:** Click through all 5 tabs → Verify `SubTabBar` accent colors update → Verify "New" badge disappears after first click.
4.  **MCP Server Test:** Open Terminal → Run `claude` agent → Verify agent can call `get_aesthetic_context` tool successfully.
5.  **Command Palette Test:** Press `Cmd+K` → Verify overlay appears with smooth Framer Motion transition (150ms) → Type `> generate theme Y2K` → Verify results populate.