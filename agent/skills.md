# 🎯 Available Skills

**Purpose:** Documentation of available skills and when to use them.

---

## 🚀 Agent Self-Improvement

### agent-reflect
**Location:** `agent/skills/agent-reflect/`
**When to use:** After completing complex tasks, when user corrects behavior, or before context compaction

**Usage:**
```
reflect
```
Then follow the 6-step workflow to analyze conversation and extract learnings.

**What it does:**
- Scans conversation for correction signals
- Detects agent platform (OpenCode/Cursor/Claude Code)
- Classifies learnings and maps to target files
- Proposes changes with user approval

**Key patterns:**
- HIGH confidence: Explicit corrections ("never", "always", "wrong")
- MEDIUM confidence: Approved approaches ("perfect", "exactly")
- LOW confidence: Observations of what worked

---

## 🔧 Core Skills

### 1. File Operations
**When to use:** Reading, writing, editing files

**Best practices:**
- Always read before writing
- Use exact text matches for edits
- Make small, focused changes
- Verify changes after editing

**Common patterns:**
```typescript
// Read file first
const content = await read_file(filePath);

// Plan edit
const oldString = `...`;
const newString = `...`;

// Apply edit
await edit({ file_path: filePath, old_string: oldString, new_string: newString });

// Verify
const updated = await read_file(filePath);
```

### 2. Build & Test
**When to use:** After code changes

**Commands:**
```bash
npm run build:renderer  # React build
npm run build:electron  # Electron build
npm run build           # Both
npm start               # Run Electron
```

**Verification:**
- Check for build errors
- Verify dist/ and dist-electron/ exist
- Test app functionality
- Check console for errors

### 3. Debugging
**When to use:** App crashes, features not working

**Strategies:**
- Check console errors first
- Verify file paths and existence
- Test with minimal repro
- Check state.md for known issues

---

## 🎨 Project-Specific Skills

### 1. Electron IPC
**When to use:** Adding main/renderer communication

**Pattern:**
```typescript
// preload.ts
contextBridge.exposeInMainWorld('deskflowAPI', {
  getLogs: () => ipcRenderer.invoke('get-logs'),
});

// main.ts
ipcMain.handle('get-logs', async () => {
  return getLogs();
});

// renderer.ts
const logs = await window.deskflowAPI.getLogs();
```

### 2. Three.js Textures
**When to use:** Creating procedural textures

**Pattern:**
```typescript
const canvas = document.createElement('canvas');
canvas.width = 1024;
canvas.height = 512;
const ctx = canvas.getContext('2d')!;

// Draw patterns...
const texture = new THREE.CanvasTexture(canvas);
texture.colorSpace = THREE.SRGBColorSpace;
texture.needsUpdate = true;
texture.wrapS = THREE.RepeatWrapping;
texture.wrapT = THREE.RepeatWrapping;
```

### 3. R3F Components
**When to use:** Adding 3D elements

**Pattern:**
```tsx
function MyPlanet({ data }: { data: PlanetData }) {
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[data.radius, 64, 64]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}
```

### 4. Database Operations
**When to use:** Reading/writing app usage data

**Pattern:**
```typescript
// SQLite (when available)
const db = new Database(dbPath);
db.exec(`CREATE TABLE IF NOT EXISTS logs (...)`);
const stmt = db.prepare('INSERT INTO logs ...');
stmt.run(...);

// JSON fallback
const logs = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
logs.push(newLog);
fs.writeFileSync(jsonPath, JSON.stringify(logs, null, 2));
```

---

## 🚀 Advanced Skills

### 1. Performance Optimization
**When to use:** Slow rendering, FPS drops

**Techniques:**
- Reduce geometry segments (32 vs 64)
- Use instanced rendering for repeated objects
- Implement LOD (Level of Detail)
- Batch texture updates

### 2. State Management
**When to use:** Complex data flow

**Patterns:**
- React useState for UI state
- useMemo for expensive computations
- Electron IPC for main/renderer sync
- JSON/SQLite for persistence

### 3. Error Handling
**When to use:** Preventing crashes

**Patterns:**
```typescript
try {
  // Risky operation
} catch (err: any) {
  console.error('[DeskFlow] Error:', err.message);
  // Fallback behavior
}
```

---

## 📋 Skill Quick Reference

| Skill | When to Use | Key Files |
|-------|-------------|-----------|
| File Operations | Any file change | All |
| Build & Test | After code changes | package.json |
| Debugging | Issues/errors | Console |
| Electron IPC | Main/renderer comm | main.ts, preload.ts |
| Three.js Textures | Planet visuals | OrbitSystem.tsx |
| R3F Components | 3D elements | OrbitSystem.tsx |
| Database | Data storage | main.ts |
| Performance | Slow rendering | All |
| State Management | Data flow | App.tsx |
| Error Handling | Crash prevention | All |

---

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-04 | Initial creation |

---

**Last Updated:** 2026-04-04
**Maintained By:** AI Development Team
