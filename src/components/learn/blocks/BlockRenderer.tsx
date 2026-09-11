// BlockRenderer — dispatches to typed block components
// Unknown types render a graceful "unsupported block" placeholder

import React, { useState } from 'react';
import { FileCode2 } from 'lucide-react';
import type { LdocBlock } from '../../shared/learn/types';
import { ProseBlock } from './ProseBlock';
import { MathBlock } from './MathBlock';
import { MermaidBlock } from './MermaidBlock';
import { CodeBlock } from './CodeBlock';
import { AnnotatedCodeBlock } from './AnnotatedCodeBlock';
import { AnnotatedMathBlock } from './AnnotatedMathBlock';
import { ImageBlock } from './ImageBlock';
import { VideoBlock } from './VideoBlock';
import { QuizBlock } from './QuizBlock';
import { CalloutBlock } from './CalloutBlock';
import { LayerBlock } from './LayerBlock';
import { WidgetHost } from '../WidgetHost';
import { ChartBlock } from './ChartBlock';
import { TableBlock } from './TableBlock';
import { FlowBlock } from './FlowBlock';
import { FinChartBlock } from './FinChartBlock';
import { SvgBlock } from './SvgBlock';
import { TutorBlock } from './TutorBlock';
import { ProposalBlock } from './ProposalBlock';
import { ConversationBlock } from './ConversationBlock';
import { NotesBlock } from './NotesBlock';
import { HeatmapBlock } from './HeatmapBlock';
import { KnowledgeGraphBlock } from './KnowledgeGraphBlock';
import { FlashcardBlock } from './FlashcardBlock';
import { LayerRevealBlock } from './LayerRevealBlock';
import { ConceptMapBlock } from './ConceptMapBlock';
import { MasteryTimelineBlock } from './MasteryTimelineBlock';
import { WhiteboardBlock } from './WhiteboardBlock';
import { IllustrationBlock } from './IllustrationBlock';
import { AnimationBlock } from './AnimationBlock';
import { VideoAssetBlock } from './VideoAssetBlock';

interface BlockRendererProps {
  block: LdocBlock;
  onAsk?: (blockId: string, question: string) => void;
  onQuizSubmit?: (nodeId: string, blockId: string, response: string) => void;
  onQuizSkip?: (nodeId: string, blockId: string) => void;
  currentLevel?: string;
  nodeId?: string;
  onApproveProposal?: (blockId: string) => void;
  onRejectProposal?: (blockId: string, reason?: string) => void;
  onAddMessage?: (blockId: string, text: string) => void;
  onResolveConversation?: (blockId: string) => void;
  onAddNote?: (blockId: string, text: string) => void;
  onDeleteNote?: (noteId: string) => void;
  onTogglePin?: (noteId: string) => void;
  onIllustrationGenerated?: (blockId: string, imagePath: string) => void;
}

const VISUAL_TYPES = new Set(['mermaid', 'chart', 'flow', 'finchart', 'table', 'image', 'widget', 'svg', 'math', 'code', 'video', 'viz_heatmap', 'viz_graph', 'viz_timeline', 'viz_concept_map', 'whiteboard', 'illustration']);

export const BlockRenderer = React.memo(function BlockRenderer({ block, onAsk, onQuizSubmit, onQuizSkip, currentLevel, nodeId, onApproveProposal, onRejectProposal, onAddMessage, onResolveConversation, onAddNote, onDeleteNote, onTogglePin, onIllustrationGenerated }: BlockRendererProps) {
  const [showSource, setShowSource] = useState(false);
  const sharedProps = { block, onAsk };
  const isVisual = VISUAL_TYPES.has(block.type);
  const wrapper = isVisual ? 'max-w-4xl w-full mx-auto' : 'max-w-[68ch] mx-auto';

  const content = (() => {
    switch (block.type) {
      case 'prose':
        return <ProseBlock {...sharedProps} block={block} />;
      case 'math':
        return <MathBlock {...sharedProps} block={block} />;
      case 'mermaid':
        return <MermaidBlock {...sharedProps} block={block} />;
      case 'code':
        return <CodeBlock {...sharedProps} block={block} />;
      case 'annotated-code':
        return <AnnotatedCodeBlock block={block as any} activeRefId={activeRefId} onRefHover={onRefHover} onRefClick={onRefClick} />;
      case 'annotated-math':
        return <AnnotatedMathBlock block={block as any} activeRefId={activeRefId} onRefHover={onRefHover} onRefClick={onRefClick} />;
      case 'image':
        return <ImageBlock {...sharedProps} block={block} />;
      case 'video':
        return <VideoBlock {...sharedProps} block={block} />;
      case 'quiz':
        if (!onQuizSubmit || !nodeId) return null;
        return <QuizBlock block={block} onSubmit={(response) => onQuizSubmit(nodeId, block.id, response)} onSkip={onQuizSkip ? () => onQuizSkip(nodeId, block.id) : undefined} />;
      case 'callout':
        return <CalloutBlock {...sharedProps} block={block} />;
      case 'layer':
        return <LayerBlock block={block} currentLevel={currentLevel} onAsk={onAsk} onQuizSubmit={onQuizSubmit} nodeId={nodeId} />;
      case 'widget':
        return <WidgetHost block={block} />;
      case 'chart':
        return <ChartBlock {...sharedProps} block={block} />;
      case 'table':
        return <TableBlock {...sharedProps} block={block} />;
      case 'flow':
        return <FlowBlock {...sharedProps} block={block} />;
      case 'finchart':
        return <FinChartBlock {...sharedProps} block={block} />;
      case 'svg':
        return <SvgBlock {...sharedProps} block={block} />;
      case 'tutor':
        if (!nodeId) return null;
        return <TutorBlock block={block} nodeId={nodeId} onAsk={onAsk || (() => {})} />;
      case 'proposal':
        return <ProposalBlock block={block} onApprove={onApproveProposal} onReject={onRejectProposal} />;
      case 'conversation':
        if (!nodeId) return null;
        return <ConversationBlock block={block} nodeId={nodeId} onAddMessage={onAddMessage || (() => {})} onResolve={onResolveConversation} />;
      case 'notes':
        if (!nodeId) return null;
        return <NotesBlock block={block} nodeId={nodeId} onAddNote={onAddNote} onDeleteNote={onDeleteNote} onTogglePin={onTogglePin} />;
      case 'viz_heatmap':
        return <HeatmapBlock data={(block as any).meta?.data || []} meta={(block as any).meta || {}} />;
      case 'viz_graph':
        return <KnowledgeGraphBlock nodes={(block as any).meta?.nodes || []} edges={(block as any).meta?.edges || []} layout={(block as any).meta?.layout} />;
      case 'flashcard':
      case 'flashcard_occlusion':
        return <FlashcardBlock meta={(block as any).meta || {}} />;
      case 'layer_reveal':
        return <LayerRevealBlock meta={(block as any).meta || {}} currentMastery={currentLevel} />;
      case 'viz_concept_map':
        return <ConceptMapBlock meta={(block as any).meta || {}} />;
      case 'viz_timeline':
        return <MasteryTimelineBlock meta={(block as any).meta || {}} events={(block as any).meta?.events || []} series={(block as any).meta?.series || []} />;
      case 'whiteboard':
        return <WhiteboardBlock meta={(block as any).meta || {}} />;
      case 'illustration':
        return <IllustrationBlock meta={(block as any).meta || {}} nodeId={nodeId} onGenerated={(imagePath) => onIllustrationGenerated?.(block.id, imagePath)} />;
      case 'animation':
        return <AnimationBlock block={block as any} />;
      case 'video_asset':
        return <VideoAssetBlock block={block as any} nodeId={nodeId} />;
      default:
        return <UnsupportedBlock block={block} />;
    }
  })();

  if (isVisual) {
    return (
      <div className={wrapper}>
        <div className="relative group/block">
          {content}
          <button
            onClick={() => setShowSource(!showSource)}
            className="absolute -top-1 right-0 opacity-0 group-hover/block:opacity-100 transition-opacity p-1 rounded text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/60 z-10"
            title={showSource ? 'Hide source' : 'Show LDOC source'}
          >
            <FileCode2 className="w-3 h-3" />
          </button>
          {showSource && (
            <div className="mt-2 rounded-lg border border-zinc-800/60 bg-zinc-950/80 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800/50">
                <span className="text-[10px] font-mono text-zinc-500">block:{block.id}</span>
                <span className="text-[10px] font-mono text-zinc-600">{block.type}</span>
              </div>
              <pre className="p-3 text-[10px] font-mono leading-relaxed text-zinc-400 whitespace-pre overflow-x-auto max-h-48 overflow-y-auto">
                {JSON.stringify(block, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="relative group/block">
      {content}
      <button
        onClick={() => setShowSource(!showSource)}
        className="absolute -top-1 right-0 opacity-0 group-hover/block:opacity-100 transition-opacity p-1 rounded text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/60 z-10"
        title={showSource ? 'Hide source' : 'Show LDOC source'}
      >
        <FileCode2 className="w-3 h-3" />
      </button>
      {showSource && (
        <div className="mt-2 rounded-lg border border-zinc-800/60 bg-zinc-950/80 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800/50">
            <span className="text-[10px] font-mono text-zinc-500">block:{block.id}</span>
            <span className="text-[10px] font-mono text-zinc-600">{block.type}</span>
          </div>
          <pre className="p-3 text-[10px] font-mono leading-relaxed text-zinc-400 whitespace-pre overflow-x-auto max-h-48 overflow-y-auto">
            {JSON.stringify(block, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}, (prev, next) => {
  // Only re-render if the block reference changed or block content changed
  return prev.block.id === next.block.id
    && prev.block.type === next.block.type
    && (prev.block as any).md === (next.block as any).md
    && prev.currentLevel === next.currentLevel
    && prev.nodeId === next.nodeId;
});

function UnsupportedBlock({ block }: { block: any }) {
  return (
    <div className="my-4 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
      <div className="text-amber-400 text-sm">⚠️ Unsupported block type: <code>{block.type}</code></div>
    </div>
  );
}
