import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, FolderOpen, Settings2 } from 'lucide-react';
import { PageShell } from '../components/PageShell';
import { TerminalLayout } from '../components/TerminalWindow';
import {
  CategoryBadge, ModelSwitcher, ConfigGenerator, StatusDot,
  ToolbarButton, Modal, SessionResourceStats, GroupPanel,
  WorkspacesPanel, Preset, Session, logOnce, formatDate,
  SESSION_CATEGORIES, SESSION_STATUS_STYLES, SUBPAGE_LABELS,
  GROUP_ACCENT_HEX, accentStyle, WS_ICON_BTN, WS_SELECT,
  TAB_ACTIVE, ACCENT_STRIP, ACCENT_TEXT, ACCENT_BORDER
} from './terminal';

// ── Helpers ──
function generateTerminalId(): string { return `term-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; }

// ── Main Export (Orchestrator) ──
export default function TerminalPage({ projectId: propProjectId, projectPath: propProjectPath, onCloseWorkspace }: { projectId?: string; projectPath?: string; onCloseWorkspace?: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(() => { const saved = localStorage.getItem('terminal-sidebarWidth'); return saved ? parseInt(saved) : 400; });
  const [isResizing, setIsResizing] = useState(false);
  type GroupKey = 'setup' | 'work' | 'insights' | 'studio' | 'conductor' | 'ai-gateway' | 'context' | 'handbook';
  const [activeGroup, setActiveGroup] = useState<GroupKey>(() => { const saved = localStorage.getItem('terminal-activeGroup'); return (saved as GroupKey) || 'setup'; });
  useEffect(() => { const group = (location.state as any)?.group; if (group) setActiveGroup(group); }, []);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const sessionsRef = useRef<Session[]>([]);
  const [showAddPreset, setShowAddPreset] = useState(false);
  const [newPreset, setNewPreset] = useState({ name: '', command: '', category: '' });
  const [showEditPreset, setShowEditPreset] = useState(false);
  const [editPreset, setEditPreset] = useState<Preset | null>(null);
  const [showFeaturesDialog, setShowFeaturesDialog] = useState(false);
  const [showGeneralistDialog, setShowGeneralistDialog] = useState(false);
  const [showNewSessionDialog, setShowNewSessionDialog] = useState(false);
  const [showImportSessionsDialog, setShowImportSessionsDialog] = useState(false);
  const [preferences, setPreferences] = useState<any>(null);
  const [modelReinjectThreshold, setModelReinjectThreshold] = useState(() => Number(localStorage.getItem('model-reinject-threshold')) || 10);
  const [modelDefaultTier, setModelDefaultTier] = useState<'top' | 'mid' | 'low'>(() => (localStorage.getItem('default-model-tier') as any) || 'mid');
  const [modelDebugMode, setModelDebugMode] = useState(() => localStorage.getItem('model-debug-mode') === 'true');
  const [openCodeSessionName, setOpenCodeSessionName] = useState('');
  const [newSessionAgent, setNewSessionAgent] = useState('claude');
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionMode, setNewSessionMode] = useState<'create' | 'initialize'>('create');
  const [newSessionTerminalMode, setNewSessionTerminalMode] = useState<'create' | 'select'>('create');
  const [newSessionSelectedTerminal, setNewSessionSelectedTerminal] = useState('');
  const [sendTargetSession, setSendTargetSession] = useState('');
  const [autoAssignConfig, setAutoAssignConfig] = useState<any>(null);
  const [crossSessionSyncEnabled, setCrossSessionSyncEnabled] = useState(() => localStorage.getItem('cross-session-sync-enabled') !== 'false');
  const [fileLockTTL, setFileLockTTL] = useState(() => Number(localStorage.getItem('file-lock-ttl')) || 300);
  const [contextBroadcastEnabled, setContextBroadcastEnabled] = useState(() => localStorage.getItem('context-broadcast-enabled') !== 'false');
  const [conflictWarningMode, setConflictWarningMode] = useState(() => localStorage.getItem('conflict-warning-mode') || 'both');
  const [syncCommandEnabled, setSyncCommandEnabled] = useState(() => localStorage.getItem('sync-command-enabled') !== 'false');
  const [thoughtProcessEnabled, setThoughtProcessEnabled] = useState(() => localStorage.getItem('thought-process-enabled') !== 'false');
  const [routingResult, setRoutingResult] = useState<any>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [showDisambiguation, setShowDisambiguation] = useState(false);
  const [disambiguationCandidates, setDisambiguationCandidates] = useState<any[]>([]);
  const [showRoutingToast, setShowRoutingToast] = useState(false);
  const [routingToastSession, setRoutingToastSession] = useState('');
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [showMessagesViewer, setShowMessagesViewer] = useState<string | null>(null);
  const [sessionToEdit, setSessionToEdit] = useState<Session | null>(null);
  const [selectedSessionDetail, setSelectedSessionDetail] = useState<string | null>(null);
  const [sessionMessages, setSessionMessages] = useState<any[]>([]);
  const [quotedReferences, setQuotedReferences] = useState<any[]>([]);
  const [sessionProblems, setSessionProblems] = useState<any[]>([]);
  const [sessionRequests, setSessionRequests] = useState<any[]>([]);
  const [messagesSearchQuery, setMessagesSearchQuery] = useState('');
  const [projects, setProjects] = useState<{ id: string; name: string; path: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState(propProjectId || '');
  const [hoveredPane, setHoveredPane] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<any>(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'7d' | '30d' | 'all'>('30d');
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsProblems, setAnalyticsProblems] = useState<any[]>([]);
  const [analyticsRequests, setAnalyticsRequests] = useState<any[]>([]);
  const [analyticsPromptHistory, setAnalyticsPromptHistory] = useState<any[]>([]);
  const [analyticsDailyStats, setAnalyticsDailyStats] = useState<any[]>([]);
  const [analyticsCodeStats, setAnalyticsCodeStats] = useState<any>(undefined);
  const [terminalBindings, setTerminalBindings] = useState<Record<string, any>>({});
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const [showInstructionInput, setShowInstructionInput] = useState(false);
  const [showInstructionPanel, setShowInstructionPanel] = useState(false);
  const [composeSkills, setComposeSkills] = useState<string[]>([]);
  const [terminalAnomalies, setTerminalAnomalies] = useState<Record<string, any>>({});
  const [cliUpdates, setCliUpdates] = useState<any[]>([]);
  const [resourceStats, setResourceStats] = useState<Record<string, any>>({});
  const [instructionText, setInstructionText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [terminalError, setTerminalError] = useState<string | null>(null);
  const [terminalErrorType, setTerminalErrorType] = useState<'error' | 'warning' | 'info'>('error');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveDialogName, setSaveDialogName] = useState('');
  const [showCloseWorkspaceDialog, setShowCloseWorkspaceDialog] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('default');
  const [showWorkspaceSaveAsDialog, setShowWorkspaceSaveAsDialog] = useState(false);
  const [workspaceSaveAsName, setWorkspaceSaveAsName] = useState('');
  const [showWorkspaceLoadDialog, setShowWorkspaceLoadDialog] = useState(false);
  const [workspaceList, setWorkspaceList] = useState<any[]>([]);
  const [workspaceListLoading, setWorkspaceListLoading] = useState(false);
  const [opencodeSessionExport, setOpencodeSessionExport] = useState<any>(null);
  const [loadingExport, setLoadingExport] = useState(false);
  const [fileConflicts, setFileConflicts] = useState<any[]>([]);
  const [terminalFileLocks, setTerminalFileLocks] = useState<Record<string, string[]>>({});
  const [touchedFiles, setTouchedFiles] = useState<any[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; message: string; onConfirm: () => void }>({ isOpen: false, message: '', onConfirm: () => {} });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; session: Session } | null>(null);
  const [draggedSessionId, setDraggedSessionId] = useState<string | null>(null);
  const [agentInitErrors, setAgentInitErrors] = useState<Record<string, any>>({});
  const [terminalAgentStatus, setTerminalAgentStatus] = useState<Record<string, any>>({});
  const [terminalCapturedSessionIds, setTerminalCapturedSessionIds] = useState<Record<string, string>>({});
  const [terminalTimeouts, setTerminalTimeouts] = useState<Record<string, boolean>>({});
  const showError = useCallback((msg: string, type: 'error' | 'warning' | 'info' = 'error') => { setTerminalError(msg); setTerminalErrorType(type); setTimeout(() => setTerminalError(null), 8000); }, []);
  const terminalTabsRef = useRef<any[]>([]);
  const controlsRef = useRef<any>(null);

  // ── Orchestrated Sub-components render ──
  return (
    <PageShell projectId={propProjectId} projectPath={propProjectPath} onCloseWorkspace={onCloseWorkspace}>
      <TerminalLayout terminalTabs={terminalTabsRef.current || []} activeTerminalId={activeTerminalId} onActiveTerminalChange={setActiveTerminalId} agentStatuses={terminalAgentStatus}>
        <div className="flex items-center gap-2">
          <StatusDot status="active" />
          <ToolbarButton variant="primary" icon={Plus} onClick={() => setShowNewSessionDialog(true)}>New Session</ToolbarButton>
          <ToolbarButton icon={FolderOpen} onClick={() => setShowImportSessionsDialog(true)}>Import</ToolbarButton>
          <ToolbarButton icon={Settings2} onClick={() => {}}>Settings</ToolbarButton>
          <ModelSwitcher terminalId="" agent="claude" />
          <ConfigGenerator agent="claude" baseDir="/tmp" />
        </div>
        <nav className="flex flex-col gap-1">
          {Object.entries(SUBPAGE_LABELS).map(([key, label]) => (
            <button key={key} className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800/50 rounded-lg transition-colors">
              <CategoryBadge category={key.includes('bug') ? 'bug-fix' : key.includes('feature') ? 'feature' : 'other'} />
              {label}
            </button>
          ))}
        </nav>
        <div className="space-y-2">
          {sessions.map((session) => (
            <div key={session.id} className="flex items-center justify-between p-2 rounded-lg bg-zinc-800/50">
              <div className="flex items-center gap-2">
                <StatusDot status={session.status} />
                <span className="text-xs text-zinc-200">{session.agent}</span>
              </div>
              <SessionResourceStats stats={resourceStats[session.id || '']} />
            </div>
          ))}
        </div>
        <Modal open={showNewSessionDialog} onClose={() => setShowNewSessionDialog(false)} title="New Session" width="max-w-lg">
          <p className="text-xs text-zinc-300">Create a new terminal session</p>
        </Modal>
        <Modal open={showImportSessionsDialog} onClose={() => setShowImportSessionsDialog(false)} title="Import Sessions" width="max-w-lg">
          <p className="text-xs text-zinc-300">Import session configurations</p>
        </Modal>
        <Modal open={showFeaturesDialog} onClose={() => setShowFeaturesDialog(false)} title="Workspace Features" width="max-w-2xl">
          <p className="text-xs text-zinc-300">Overview of all workspace features</p>
        </Modal>
        <WorkspaceDetailModal projectId={selectedProject} onClose={() => {}} onLoad={() => {}} onDelete={async () => {}} />
      </TerminalLayout>
    </PageShell>
  );
}
