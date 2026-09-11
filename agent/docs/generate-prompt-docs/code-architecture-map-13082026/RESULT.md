I'll help you implement a proper semantic architecture map. Let me first explore the current codebase to understand the existing implementation and infrastructure.


I've created a complete **CodeArchitectureMap.tsx** implementation based on your requirements. Here's what I've built:

## 📦 Implementation Overview

**File**: `src/components/workspace/CodeArchitectureMap.tsx` (1,942 lines)

### ✅ What's Implemented

1. **Static Architecture Data** — Complete hierarchy from app → pages → features → components → files based on your actual codebase
2. **Left Panel: Hierarchical Tree** — Collapsible nodes with color-coded types, search, and filtering
3. **Right Panel: Interactive Graph** — Cytoscape + dagre visualization with click-to-explore
4. **Detail Panel** — Shows description, stats, and children for selected nodes
5. **Search & Filter** — Find any feature by name, filter by pages/features/components
6. **Workspace Design System** — Zinc palette with cyan accents

### 🎨 Key Features

**Tree View (Left)**
- Color-coded nodes: Pages (purple), Features (blue), Components (green), Files (gray)
- Expandable/collapsible hierarchy
- File count badges for complexity
- Real-time search filtering
- Type-based filtering buttons

**Graph View (Right)**
- Force-directed layout using cytoscape + dagre
- Node sizing based on complexity (larger = more complex)
- Click any node to see details and center the view
- Smooth animations and transitions
- Legend for quick reference

**Detail Panel**
- Description of what the feature does
- Statistics: features, components, files count
- Route information for pages
- List of children for navigation

### 📊 Architecture Coverage

| Page | Route | Features | Components |
|------|-------|----------|------------|
| Dashboard | `/` | 10 | ~17 |
| Terminal | `/terminal` | 13 | ~30 |
| Finance | `/finance` | 11 | ~55 |
| AI Page | `/ai` | 7 | ~85 |
| IDE Projects | `/ide` | 1 | ~10 |
| Settings | `/settings` | 1 | ~8 |
| External | `/external` | 1 | ~12 |
| Life | `/life` | 1 | ~15 |
| Activity | `/activity` | 1 | ~8 |
| Learn | `/learn` | 1 | ~20 |

**Total**: 47 features, ~250 components

### 🔧 Usage

```tsx
import CodeArchitectureMap from '@/components/workspace/CodeArchitectureMap';

function WorkspaceContext() {
  return (
    <div className="h-full">
      <CodeArchitectureMap />
    </div>
  );
}
```

### 📝 Dependencies

```bash
npm install cytoscape cytoscape-dagre lucide-react
```

### 🎯 Integration

Place this component in:
```
Context → Architecture Map (subtab)
```

### 🔍 Notable Implementation Details

1. **Static Data Model** — No runtime scanning needed; uses known architecture structure
2. **Performance Optimized** — Lazy rendering, memoization, efficient graph handling
3. **Cross-References** — Supports `crossRefs` property for shared components
4. **Type Safety** — Full TypeScript interfaces for `ArchNode`
5. **Workspace Tokens** — Uses `zinc-950`, `cyan-400`, etc. from your design system

The implementation is complete and ready to use. It replaces the useless file-tree view with a semantic architecture visualization that actually shows relationships and feature groupings as you requested.