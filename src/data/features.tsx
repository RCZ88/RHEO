import React from 'react';
import type { Feature } from '../types/showcase';
import { ProseDemo } from '../components/showcase/demos/ProseDemo';
import { CodeDemo } from '../components/showcase/demos/CodeDemo';
import { MathDemo } from '../components/showcase/demos/MathDemo';
import { ImageDemo } from '../components/showcase/demos/ImageDemo';
import { VideoDemo } from '../components/showcase/demos/VideoDemo';
import { MermaidDemo } from '../components/showcase/demos/MermaidDemo';
import { ChartDemo } from '../components/showcase/demos/ChartDemo';
import { TableDemo } from '../components/showcase/demos/TableDemo';
import { FlowDemo } from '../components/showcase/demos/FlowDemo';
import { SvgDemo } from '../components/showcase/demos/SvgDemo';
import { FinChartDemo } from '../components/showcase/demos/FinChartDemo';
import { QuizMCQDemo } from '../components/showcase/demos/QuizMCQDemo';
import { QuizNumericDemo } from '../components/showcase/demos/QuizNumericDemo';
import { QuizOpenDemo } from '../components/showcase/demos/QuizOpenDemo';
import { FlashcardDemo } from '../components/showcase/demos/FlashcardDemo';
import { LayerRevealDemo } from '../components/showcase/demos/LayerRevealDemo';
import { HeatmapDemo } from '../components/showcase/demos/HeatmapDemo';
import { KnowledgeGraphDemo } from '../components/showcase/demos/KnowledgeGraphDemo';
import { ConceptMapDemo } from '../components/showcase/demos/ConceptMapDemo';
import { MasteryTimelineDemo } from '../components/showcase/demos/MasteryTimelineDemo';
import { IllustrationDemo } from '../components/showcase/demos/IllustrationDemo';
import { WhiteboardDemo } from '../components/showcase/demos/WhiteboardDemo';
import { TutorDemo } from '../components/showcase/demos/TutorDemo';
import { ProposalDemo } from '../components/showcase/demos/ProposalDemo';
import { ConversationDemo } from '../components/showcase/demos/ConversationDemo';
import { LayerMasteryDemo } from '../components/showcase/demos/LayerMasteryDemo';
import { CalloutDemo } from '../components/showcase/demos/CalloutDemo';
import { WidgetDemo } from '../components/showcase/demos/WidgetDemo';
import { NotesDemo } from '../components/showcase/demos/NotesDemo';
import { GroundingSourcesDemo } from '../components/showcase/demos/GroundingSourcesDemo';
import { KnowledgeIntakeDemo } from '../components/showcase/demos/KnowledgeIntakeDemo';
import { AIEditDemo } from '../components/showcase/demos/AIEditDemo';
import { ClarificationNotesDemo } from '../components/showcase/demos/ClarificationNotesDemo';

export const features: Feature[] = [
  { id: 'prose', name: 'Prose', icon: '📝', category: 'text', description: 'Rich text with bold, italic, inline code, links, and blockquotes.', whenUsed: 'Explanations, definitions, and narrative content.', demo: <ProseDemo />, syntax: 'Plain text with **bold**, *italic*, `code`, and [links](url).' },
  { id: 'code', name: 'Code', icon: '💻', category: 'text', description: 'Syntax-highlighted code blocks with language labels.', whenUsed: 'Algorithms, implementations, and API examples.', demo: <CodeDemo />, syntax: '```python\ndef train(model, data):\n    ...\n```' },
  { id: 'math', name: 'Math', icon: '∑', category: 'text', description: 'LaTeX math rendering with KaTeX.', whenUsed: 'Derivations, loss functions, and formulas.', demo: <MathDemo />, syntax: '$$\\mathcal{L} = -\\sum y_i \\log(\\hat{y}_i)$$' },
  { id: 'image', name: 'Image', icon: '🖼️', category: 'text', description: 'Photos with captions and source attribution.', whenUsed: 'Diagrams, screenshots, and visual references.', demo: <ImageDemo />, syntax: '![Alt text](url)\nSource: Author | License' },
  { id: 'video', name: 'Video', icon: '▶️', category: 'text', description: 'Embedded video players for lectures and demos.', whenUsed: 'Video lectures, walkthroughs, demonstrations.', demo: <VideoDemo />, syntax: '<video src="lecture.mp4" controls />' },
  { id: 'mermaid', name: 'Mermaid', icon: '🧜', category: 'diagrams', description: 'Flowcharts, sequence diagrams, class diagrams, Gantt charts.', whenUsed: 'Architecture overviews and process flows.', demo: <MermaidDemo />, syntax: '```mermaid\ngraph TD\n    A --> B\n```' },
  { id: 'chart', name: 'Chart', icon: '📊', category: 'diagrams', description: 'Vega-Lite data visualizations — bar, line, scatter.', whenUsed: 'Training metrics, comparisons, data storytelling.', demo: <ChartDemo />, syntax: '::: chart {"mark":"line",...}\n:::' },
  { id: 'table', name: 'Table', icon: '📋', category: 'diagrams', description: 'Interactive data tables with sorting and filtering.', whenUsed: 'Comparing concepts, formulas, properties.', demo: <TableDemo />, syntax: '::: table\n- [Concept | field]\nrows:\n{"field":"value"}\n:::' },
  { id: 'flow', name: 'Flow', icon: '🌊', category: 'diagrams', description: 'Sankey and waterfall flow diagrams.', whenUsed: 'Data flow, resource allocation, pipelines.', demo: <FlowDemo />, syntax: '::: flow sankey\n- A -> B : 80\n:::' },
  { id: 'svg', name: 'SVG', icon: '🎨', category: 'diagrams', description: 'Custom SVG illustrations and vector graphics.', whenUsed: 'Custom diagrams, icons, visual explanations.', demo: <SvgDemo />, syntax: '::: figure\n{\'<svg>...</svg>\'}\n:::' },
  { id: 'finchart', name: 'FinChart', icon: '📈', category: 'diagrams', description: 'Financial candlestick and area charts.', whenUsed: 'Trading analysis, price history, market data.', demo: <FinChartDemo />, syntax: '::: finchart\n{"type":"candlestick",...}\n:::' },
  { id: 'quiz-mcq', name: 'Quiz (MCQ)', icon: '❓', category: 'interactive', description: 'Multiple choice questions with instant feedback.', whenUsed: 'Knowledge checks, comprehension validation.', demo: <QuizMCQDemo />, syntax: '::: quiz mcq L2\nQuestion?\n- [x] Correct\n- [ ] Wrong\n:::' },
  { id: 'quiz-numeric', name: 'Quiz (Numeric)', icon: '🔢', category: 'interactive', description: 'Number input questions with tolerance checking.', whenUsed: 'Calculations, parameter counts, quantitative answers.', demo: <QuizNumericDemo />, syntax: '::: quiz numeric L3\nHow many...?\nanswer: 8\n:::' },
  { id: 'quiz-open', name: 'Quiz (Open)', icon: '✍️', category: 'interactive', description: 'Free-text answers with AI rubric-based grading.', whenUsed: 'Explanations, essays, deep reasoning.', demo: <QuizOpenDemo />, syntax: '::: quiz open L4\nExplain...\nrubric: Must mention...\n:::' },
  { id: 'flashcard', name: 'Flashcard', icon: '🃏', category: 'interactive', description: '3D flip cards with FSRS spaced repetition.', whenUsed: 'Memorization, definitions, key concepts.', demo: <FlashcardDemo />, syntax: ':::flashcard {"deck_id":"..."}\nFront: Q?\nBack: A\n:::' },
  { id: 'layer-reveal', name: 'Layer Reveal', icon: '🧅', category: 'interactive', description: 'Step-by-step progressive disclosure.', whenUsed: 'Derivations, proofs, multi-step explanations.', demo: <LayerRevealDemo />, syntax: ':::layer_reveal {"title":"..."}\nStep 1: ...\nStep 2: ...\n:::' },
  { id: 'heatmap', name: 'Heatmap', icon: '🔥', category: 'visualization', description: 'GitHub-style study activity calendar.', whenUsed: 'Tracking learning streaks and study habits.', demo: <HeatmapDemo />, syntax: ':::viz_heatmap {"date_range":"last_90_days"}\n:::' },
  { id: 'knowledge-graph', name: 'Knowledge Graph', icon: '🕸️', category: 'visualization', description: 'Interactive force-directed node graph.', whenUsed: 'Relationships between topics and prerequisites.', demo: <KnowledgeGraphDemo />, syntax: ':::viz_graph {"layout":"force"}\n- node: A (L3)\n- edge: A -> B\n:::' },
  { id: 'concept-map', name: 'Concept Map', icon: '🌳', category: 'visualization', description: 'Collapsible hierarchical tree of concepts.', whenUsed: 'Syllabi, topic hierarchies, curriculum maps.', demo: <ConceptMapDemo />, syntax: ':::viz_concept_map {"title":"..."}\n- Root\n  - Child 1\n  - Child 2\n:::' },
  { id: 'mastery-timeline', name: 'Mastery Timeline', icon: '📅', category: 'visualization', description: 'Learning progression chart over time.', whenUsed: 'Tracking skill growth and milestones.', demo: <MasteryTimelineDemo />, syntax: ':::viz_timeline {"target_level":"L3"}\n2024-01-15: mastery @L2\n:::' },
  { id: 'illustration', name: 'Illustration', icon: '🎭', category: 'ai', description: 'AI-generated hand-drawn images (ian-xiaohei style).', whenUsed: 'Visual metaphors, chapter openers, concept art.', demo: <IllustrationDemo />, syntax: ':::illustration {"prompt":"...","concept":"..."}\n:::' },
  { id: 'whiteboard', name: 'Whiteboard', icon: '✏️', category: 'ai', description: 'Excalidraw-style drawing canvas.', whenUsed: 'Free-form drawing, scratch work, visual thinking.', demo: <WhiteboardDemo />, syntax: '::: whiteboard {"read_only":false}\n:::' },
  { id: 'tutor', name: 'Tutor', icon: '🎓', category: 'ai', description: 'AI Q&A panel for asking questions about content.', whenUsed: 'Triggered when learner asks a question inline.', demo: <TutorDemo />, syntax: 'IPC: learn:askTutor' },
  { id: 'proposal', name: 'Proposal', icon: '💡', category: 'ai', description: 'AI suggests edits with approve/reject buttons.', whenUsed: 'Triggered when AI suggests improvements.', demo: <ProposalDemo />, syntax: 'IPC: learn:createProposal' },
  { id: 'conversation', name: 'Conversation', icon: '💬', category: 'ai', description: 'Multi-turn AI dialogue with message history.', whenUsed: 'Socratic tutoring and extended discussions.', demo: <ConversationDemo />, syntax: 'IPC: learn:startConversation' },
  { id: 'layer', name: 'Layer (Mastery)', icon: '🔒', category: 'structure', description: 'Mastery-gated content that unlocks at higher levels.', whenUsed: 'Advanced topics requiring prerequisite mastery.', demo: <LayerMasteryDemo />, syntax: '::: layer L4 deeper\nAdvanced content...\n:::' },
  { id: 'callout', name: 'Callout', icon: '📢', category: 'structure', description: 'Info, warning, tip, and caution boxes.', whenUsed: 'Highlighting important notes and pitfalls.', demo: <CalloutDemo />, syntax: '::: callout warning\n**Misconception:** ...\n:::' },
  { id: 'widget', name: 'Widget', icon: '🧩', category: 'structure', description: 'Custom HTML/JS interactive elements.', whenUsed: 'Bespoke interactions not covered by other blocks.', demo: <WidgetDemo />, syntax: '::: html\n{\'<div>...</div>\'}\n:::' },
  { id: 'notes', name: 'Notes', icon: '📝', category: 'structure', description: 'User annotations and highlights on content.', whenUsed: 'Personal notes, bookmarks, study annotations.', demo: <NotesDemo />, syntax: 'IPC: learn:addNote' },
  { id: 'grounding-sources', name: 'Grounding Sources', icon: '🔗', category: 'structure', description: 'Edit references and source links per node for citation grounding.', whenUsed: 'Managing research papers, docs, and URLs that back up lesson content.', demo: <GroundingSourcesDemo />, syntax: 'IPC: learnGetSources / learnUpdateSources' },
  { id: 'knowledge-intake', name: 'Knowledge Intake', icon: '🧠', category: 'ai', description: 'Import what you know via survey Q&A, chat extraction, or topic-scoped analysis.', whenUsed: 'Bootstrapping your knowledge base before starting lessons.', demo: <KnowledgeIntakeDemo />, syntax: 'IPC: learn:aiChat (3 modes: survey / extract / topic-extract)' },
  { id: 'ai-edit', name: 'AI Edit', icon: '✨', category: 'ai', description: 'Select text and rewrite it with AI — simplify, expand, fix, or restructure.', whenUsed: 'Refining unclear passages, simplifying complex explanations.', demo: <AIEditDemo />, syntax: 'Selection toolbar → Edit → TutorPanel rewrites text' },
  { id: 'clarification-notes', name: 'Clarification Notes', icon: '💬', category: 'interactive', description: 'AI clarification Q&A saved as tagged notes in the lesson.', whenUsed: 'After AI asks clarifying questions during lesson generation.', demo: <ClarificationNotesDemo />, syntax: 'Notes tagged ["clarification"] on first node' },
];
