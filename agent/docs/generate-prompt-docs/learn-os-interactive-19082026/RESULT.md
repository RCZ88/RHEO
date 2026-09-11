# RESULT.md — Lyceum Learn OS: Interactive Pedagogy, Clarification Engine & Rich Annotation System

**Summary:** This specification resolves the "theory-dump" failure mode in technical lesson generation by introducing a strict **Practical-First Pedagogical Stance** and a **Socratic Clarification Flow** (Task E). To address the lack of syntax-level and mathematical explanations, we introduce native `::: annotated-code` and `::: annotated-math` directive blocks with interactive pointer/variable overlays (Task G). This is deployed alongside the mandated infrastructure upgrades: editable grounding sources (A), non-AI visual asset pipelines (B), full-screen profile expansion with STT (C), and bidirectional Context Brain integration (D).

---

## 2. RESEARCH & PEDAGOGICAL ANALYSIS (Task F + Core User Complaint)

### The "Theory Trap" in Technical Generation
Current LLM behavior defaults to "encyclopedia mode" when asked about programming languages (e.g., C history, memory model theory) rather than "syntax/practical mode" (how `*ptr` works, line-by-line execution). Qwen AI and Gemini solve this via **Deep Research** and **Socratic Clarification**—they refuse to generate until the user's exact mental model and goal are mapped.

### Proposed System Adjustments
1. **The "No-Fluff" System Prompt Rule**: Update `master-prompt.md` to explicitly ban historical/contextual fluff for practical coding topics. Mandate line-by-line syntax breakdown using the new `annotated-code` blocks.
2. **Socratic Clarification Flow**: Instruct the AI to output a structured JSON `<clarification>` block instead of `.lmd` if the user's prompt lacks technical constraints. The `CreateLessonDialog` intercepts this, prompts the user, and re-injects the answers.
3. **Interactive Variable Pointers**: Math and Code blocks must support inline reference markers (`// @1`, `// @var:x`) that map to hoverable/clickable explanation nodes below the block.

---

## 3. PER-TASK SPECIFICATIONS

### Engineering G: Annotated Code & Math Blocks (Core Pedagogical Fix)
*Addresses: "No UI to explain code line-by-line / math variables without relying on comments."*

#### 1. Parser Extension (`src/services/learn/parseLessonMarkdown.ts`)
Add support for `::: annotated-code` and `::: annotated-math`.

```typescript
// src/services/learn/parseLessonMarkdown.ts (Add near other ::: directive parsers)
// LF line endings required for this file

const ANNOTATED_CODE_REGEX = /^:::\s+annotated-code(?:\s+([a-zA-Z0-9_+-]+))?\s*$/;
const ANNOTATED_MATH_REGEX = /^:::\s+annotated-math\s*$/;

// Inside the main block-parsing loop:
if (ANNOTATED_CODE_REGEX.test(line)) {
  const lang = line.match(ANNOTATED_CODE_REGEX)[1] || 'text';
  const blockId = `block_${blockIndex++}`;
  let i = lineIndex + 1;
  const innerLines: string[] = [];
  while (i < lines.length && !lines[i].startsWith(':::')) {
    innerLines.push(lines[i]);
    i++;
  }
  
  // Parse inner content: separate code fence from annotation list
  const codeMatch = innerLines.join('\n').match(/```[\s\S]*?```/);
  const codeContent = codeMatch ? codeMatch[0] : '';
  const annotations = parseAnnotations(innerLines.join('\n')); // Helper to extract - [@id] text
  
  blocks.push({
    id: blockId,
    type: 'annotated-code',
    lang,
    content: codeContent,
    annotations // Array of { id: string, text: string }
  });
  lineIndex = i;
  continue;
}
// Repeat similar logic for ANNOTATED_MATH_REGEX
```

#### 2. Renderer UI (`src/components/learn/blocks/AnnotatedCodeBlock.tsx`)
*New file. Uses shadcn `tooltip` and `collapsible`.*

```tsx
// src/components/learn/blocks/AnnotatedCodeBlock.tsx
import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'; // Assuming existing or use standard <pre><code>
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

console.log('%c[AnnotatedCodeBlock] v1.0 loaded', 'color: #fbbf24; font-weight: bold');

export function AnnotatedCodeBlock({ block }: { block: any }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  
  // Parse code to inject highlight markers for lines containing // @id
  const renderCode = () => {
    // Strip the // @id from the visible code, but keep it for mapping
    // ... implementation details ...
  };

  return (
    <div className="my-6 rounded-xl border border-zinc-800 bg-zinc-900/80 overflow-hidden">
      <div className="p-4 bg-zinc-950/50 border-b border-zinc-800 flex items-center justify-between">
        <span className="text-xs font-mono text-zinc-500 uppercase">{block.lang}</span>
        <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-500">Interactive Syntax</Badge>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {/* Left: Code */}
        <div className="p-4 font-mono text-sm overflow-x-auto border-r border-zinc-800">
          <pre className="text-zinc-300">
            {/* Render code lines, wrapping lines with @id in TooltipTrigger */}
            {block.content.split('\n').map((line, idx) => {
               const match = line.match(/\/\/\s*@([a-zA-Z0-9_-]+)/);
               if (match) {
                 const id = match[1];
                 const cleanLine = line.replace(/\/\/\s*@[a-zA-Z0-9_-]+/, '');
                 return (
                   <TooltipProvider key={idx}>
                     <TooltipTrigger asChild>
                       <div 
                         className={cn("cursor-pointer hover:bg-amber-500/10 transition-colors rounded px-1 -mx-1", activeId === id && "bg-amber-500/20")}
                         onMouseEnter={() => setActiveId(id)}
                         onMouseLeave={() => setActiveId(null)}
                       >
                         {cleanLine}
                       </div>
                     </TooltipTrigger>
                     <TooltipContent side="right" className="max-w-xs bg-zinc-800 border-zinc-700">
                       {block.annotations.find(a => a.id === id)?.text}
                     </TooltipContent>
                   </TooltipProvider>
                 );
               }
               return <div key={idx} className="text-zinc-500">{line}</div>;
            })}
          </pre>
        </div>
        
        {/* Right: Annotation List */}
        <div className="p-4 space-y-3 bg-zinc-900/40">
          <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Syntax Breakdown</h4>
          {block.annotations.map((ann: any) => (
            <div 
              key={ann.id}
              className={cn("p-3 rounded-lg border transition-all", activeId === ann.id ? "border-amber-500/50 bg-amber-500/5" : "border-zinc-800 bg-zinc-900/50")}
              onMouseEnter={() => setActiveId(ann.id)}
              onMouseLeave={() => setActiveId(null)}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-amber-500">@{ann.id}</span>
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed" dangerouslySetInnerHTML={{__html: ann.text}} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```
*(Note: Implement `AnnotatedMathBlock.tsx` similarly, using KaTeX/MathJax for rendering and mapping `@var` markers to hoverable SVG overlays).*

---

### Engineering E: Socratic Clarification Flow & Unlock Map
*Addresses: "AI needs to ask questions... prerequisites showing... unlock the others."*

#### 1. Prompt Library Update (`src/services/learn/promptLibrary.ts`)
Inject the Clarification Directive into `composeAuthorSystemPrompt`.

```typescript
// src/services/learn/promptLibrary.ts (Diff)
 export function composeAuthorSystemPrompt(lib: PromptLibrary, opts?: { part?: number; profile?: LearnerProfile }): string {
   const parts: string[] = [];
   parts.push(`## Format\n${lib.format}`);
   parts.push(`## Teaching Style\n${lib.style}`);
+  parts.push(`## Pedagogical Stance\n${PEDAGOGICAL_STANCE}`);
+  parts.push(`## Clarification Protocol\n${CLARIFICATION_PROTOCOL}`);
   // ...
 }

+const PEDAGOGICAL_STANCE = `
+**Practical-First Mandate:** For technical/coding topics, BAN historical context, theory dumps, and "encyclopedia" introductions. 
+Assume the learner knows *what* the tool is; they need to know *how the syntax works*. 
+Mandatory: Use \`::: annotated-code\` blocks to break down syntax line-by-line. Explain pointers, memory layout, and execution flow via interactive annotations, not prose paragraphs.
+`;
+
+const CLARIFICATION_PROTOCOL = `
+**Socratic Clarification:** Before generating the lesson, evaluate the user's request. 
+If the request is underspecified (missing depth, unclear goal, no stated constraints), DO NOT generate the .lmd. 
+Instead, output EXACTLY this JSON block and nothing else:
+\`\`\`json
+{"clarification_needed": true, "questions": ["Question 1?", "Question 2?"]}
+\`\`\`
+If you can reasonably infer the missing context from the Learner Profile, generate the lesson but explicitly state your assumptions in a \`::: callout info\` block.
+`;
```

#### 2. Dialog Interception (`src/components/learn/CreateLessonDialog.tsx`)
Add a state to handle the clarification JSON response from the AI.

```typescript
// src/components/learn/CreateLessonDialog.tsx (Diff inside AI response handler)
 const handleAiResponse = (text: string) => {
+  const clarificationMatch = text.match(/```json\n([\s\S]*?)\n```/);
+  if (clarificationMatch) {
+    try {
+      const parsed = JSON.parse(clarificationMatch[1]);
+      if (parsed.clarification_needed && parsed.questions) {
+        setClarificationQuestions(parsed.questions);
+        setStep('clarification'); // New UI step to render textareas for answers
+        return;
+      }
+    } catch (e) { /* fallback to normal parse */ }
+  }
   // ... existing .lmd parsing ...
 }
```

#### 3. Curriculum Unlock Graph (`src/services/learn/curriculum.ts`)
Populate the missing `prereqSlugs` DAG for the 13 cs-ai topics.

```typescript
// src/services/learn/curriculum.ts (Update CURRICULUM_TOPICS array)
// Example DAG mapping:
// Part 0 (Discovery) -> Part 1 (Git/Systems Lens) -> Part 2 (Optimization) -> Part 3 (Inference)
// Part 4 (Data Eng) -> Part 6 (MLOps)
// Add `prereqSlugs: ['the-systems-lens', 'measure-first-profiling-before-you-guess']` to advanced topics.
```

---

### Engineering A: Editable Grounding Links
*Addresses: "No feature to edit the links added on the generation."*

#### 1. IPC & Repo (`src/services/learn/index.ts` & `db/repo.ts`)
```typescript
// src/services/learn/db/repo.ts
export function updateSourcesForNode(db: Database, nodeId: string, sources: any[]) {
  const txn = db.transaction(() => {
    db.prepare('DELETE FROM learn_sources WHERE node_id = ?').run(nodeId);
    const stmt = db.prepare(`INSERT INTO learn_sources (id, node_id, url, title, kind) VALUES (@id, @node_id, @url, @title, @kind)`);
    for (const src of sources) {
      stmt.run({ ...src, node_id: nodeId });
    }
    // Sync to learn_nodes.grounding_json
    const node = db.prepare('SELECT grounding_json FROM learn_nodes WHERE id = ?').get(nodeId) as any;
    if (node) {
      const gJson = JSON.parse(node.grounding_json || '[]');
      // Merge sources into grounding_json structure
      // ...
      db.prepare('UPDATE learn_nodes SET grounding_json = ? WHERE id = ?').run(JSON.stringify(gJson), nodeId);
    }
  });
  txn();
}
```

#### 2. UI Component (`src/components/learn/NodeSourcesPanel.tsx`)
Create a slide-over panel triggered by a "Sources" badge on each node in `ReaderView.tsx`. Uses shadcn `Sheet`. Allows Add/Edit/Delete of `id | Title | URL`. Validates URL format and ID regex `^[a-z0-9-]{1,32}$`.

---

### Engineering B: Non-AI Visualization Pipeline
*Addresses: "Learn more from other tools... visualizations... not requiring AI image generation."*

#### 1. Visual Catalog (`src/services/learn/visualCatalog.ts`)
*New file.*
```typescript
// src/services/learn/visualCatalog.ts
export const VISUAL_CATALOG = [
  {
    id: 'mermaid-flow',
    type: 'diagram',
    title: 'System Architecture (Mermaid)',
    description: 'Best for pipelines, state machines, and data flow.',
    snippet: '```mermaid\ngraph TD\n  A-->B\n```'
  },
  {
    id: 'vega-scatter',
    type: 'chart',
    title: 'Data Distribution (Vega-Lite)',
    description: 'Best for profiling data, latency distributions, and correlations.',
    snippet: '::: chart\n{"$schema": "..."}\n:::'
  },
  // ... add Unsplash, ReactBits snippets ...
];
```
Integrate into `CreateLessonDialog` advanced mode as a "Visual Assets" picker that injects the snippet into the prompt context.

---

### Engineering C: Full Expanded Profile + STT
*Addresses: "Full expanded mode on the profile opener... speech to text."*

#### 1. Panel Layout (`src/components/learn/LearnerProfilePanel.tsx`)
Replace `max-w-2xl` with a responsive full-screen grid when expanded.

```tsx
// src/components/learn/LearnerProfilePanel.tsx (Diff)
- className={`${expanded ? 'w-full max-w-2xl' : 'w-80'} h-full bg-zinc-900 ...`}
+ className={`${expanded ? 'w-full max-w-none' : 'w-80'} h-full bg-zinc-900 ...`}
+ <div className={cn("grid gap-8 p-8", expanded ? "grid-cols-2" : "grid-cols-1")}>
```

#### 2. VoiceInputWrapper Integration
Wrap the Knowledge Base `statement` and `keywords` textareas.
```tsx
<VoiceInputWrapper>
  <textarea 
    value={newEntry.statement} 
    onChange={e => setNewEntry({...newEntry, statement: e.target.value})}
    className="w-full h-32 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-sm"
    placeholder="What do you already know about this topic?"
  />
</VoiceInputWrapper>
```

---

### Engineering D: Bidirectional Context Brain
*Addresses: "Connect to the main central brain... adjust the prompt."*

#### 1. Prompt Injection (`src/services/learn/index.ts` in `learn:buildPrompt`)
```typescript
// src/services/learn/index.ts (Inside learn:buildPrompt handler)
let brainContext = '';
try {
  // Check if brain is initialized
  const stats = contextBrain.getBrainStats();
  if (stats.episodes > 0) {
    const query = `${params.topic || ''} ${params.userInput || ''}`;
    const results = contextBrain.retrieve(query, ['keyword', 'graph']);
    if (results.entities.length > 0 || results.facts.length > 0) {
      brainContext = `\n\n## Learner Context (from Context Brain)\n`;
      brainContext += `The learner has existing knowledge/entities related to: ${results.entities.map(e => e.label).join(', ')}.\n`;
      brainContext += `Relevant facts: ${results.facts.map(f => `${f.predicate} ${f.object}`).join('; ')}.\n`;
      brainContext += `Use this to calibrate depth and avoid re-teaching known concepts.`;
    }
  }
} catch (err) {
  console.warn('[buildPrompt] Brain retrieval failed (non-fatal):', err);
}
systemPrompt += brainContext;
```

---

## 4. BUILD & VERIFICATION COMMANDS

Because learn services compile per-file, run these exact commands after editing:

```bash
# 1. Rebuild touched Learn Services (LF line endings required)
npx esbuild "src/services/learn/parseLessonMarkdown.ts" --outfile="dist-electron/services/learn/parseLessonMarkdown.js" --format=cjs --platform=node --target=node22
npx esbuild "src/services/learn/promptLibrary.ts" --outfile="dist-electron/services/learn/promptLibrary.js" --format=cjs --platform=node --target=node22
npx esbuild "src/services/learn/index.ts" --outfile="dist-electron/services/learn/index.js" --format=cjs --platform=node --target=node22
npx esbuild "src/services/learn/db/repo.ts" --outfile="dist-electron/services/learn/db/repo.js" --format=cjs --platform=node --target=node22
npx esbuild "src/services/learn/visualCatalog.ts" --outfile="dist-electron/services/learn/visualCatalog.js" --format=cjs --platform=node --target=node22

# 2. Rebuild Main Process (CRLF line endings)
node scripts/rebuild-main.mjs

# 3. Rebuild Renderer
npx vite build
```

---

## 5. CONSOLE STAMPS

Add these to the top of new/modified renderer components:
- `AnnotatedCodeBlock.tsx`: `console.log('%c[AnnotatedCodeBlock] v1.0 loaded', 'color: #fbbf24; font-weight: bold');`
- `AnnotatedMathBlock.tsx`: `console.log('%c[AnnotatedMathBlock] v1.0 loaded', 'color: #fbbf24; font-weight: bold');`
- `NodeSourcesPanel.tsx`: `console.log('%c[NodeSourcesPanel] v1.0 loaded', 'color: #fbbf24; font-weight: bold');`
- `VisualCatalogPicker.tsx`: `console.log('%c[VisualCatalog] v1.0 loaded', 'color: #fbbf24; font-weight: bold');`

---

## 6. KNOWN RISKS & INVARIANTS PRESERVED

1. **Parser Strictness**: The new `::: annotated-code` block must not break the existing regex for standard ` ``` ` code blocks. The parser must check for `::: annotated-code` *before* falling through to standard block parsing.
2. **Grounding Sync**: `updateSourcesForNode` uses a transaction to ensure `learn_sources` and `learn_nodes.grounding_json` never drift out of sync.
3. **Brain Fallback**: `contextBrain.retrieve()` is wrapped in try/catch. If the Context Brain tables are empty or uninitialized, the prompt generation proceeds normally without the context block.
4. **STT Fallback**: `VoiceInputWrapper` gracefully degrades to a standard textarea if the cloud API and Windows native STT both fail to initialize.

---

## 7. DEFERRED ITEMS

1. **Full MathJax/KaTeX SVG Pointer Overlays**: While `annotated-math` logic is defined, rendering precise SVG hit-boxes over complex LaTeX fractions requires a dedicated KaTeX plugin. *Deferred to v2.1; initial implementation uses standard markdown lists below the math block for variable mapping.*
2. **Automated Code Execution Sandboxing**: Running the generated C code directly in the browser (via WebAssembly/WASI) for live syntax testing. *Deferred due to heavy WASM bundle size constraints; currently relies on the user's local `learn:runCode` IPC.*