import { useEffect, useState, useCallback } from 'react';
import { Loader2, CheckCircle2, AlertCircle, Folder, Zap, FileText, X } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { LoadingState } from './LoadingState';
import { EmptyState } from './EmptyState';

interface AgentFile {
  name: string;
  path: string;
  isDirectory: boolean;
  content?: string;
}

export const FilesTab: React.FC<{ projectId?: string; projectPath?: string; projects?: { id: string; name: string; path: string }[]; onSelectProject?: (id: string) => void }> = ({ projectId, projectPath: propProjectPath, projects, onSelectProject }) => {
  const [files, setFiles] = useState<AgentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [initStatus, setInitStatus] = useState<'idle' | 'checking' | 'ready' | 'init-ok' | 'error'>('idle');
  const [fileChangedNotify, setFileChangedNotify] = useState<string | null>(null);

  useEffect(() => {
    if (!window.deskflowAPI?.onAgentFileChanged) return;
    const cleanup = window.deskflowAPI.onAgentFileChanged((data: { file: string; mtime: string }) => {
      setFileChangedNotify(`${data.file} updated`);
      setTimeout(() => setFileChangedNotify(null), 4000);
      loadFiles();
    });
    return () => cleanup?.();
  }, []);

  const project = projects?.find(p => p.id === projectId);
  const projectPath = propProjectPath || project?.path || '';

  const loadFiles = useCallback(async () => {
    if (!window.deskflowAPI || !projectPath) {
      setLoading(false);
      setInitStatus('idle');
      return;
    }
    setLoading(true);
    setError(null);
    setInitStatus('checking');
    try {
      const result = await window.deskflowAPI.readAgentFiles?.(projectPath);
      if (result?.success) {
        setFiles(result.data || []);
        setInitStatus('ready');
      } else {
        setError(result?.error || 'Failed to load files');
        setInitStatus('error');
      }
    } catch (e) {
      console.error('[FilesTab] Failed to load:', e);
      setError('Failed to load files');
      setInitStatus('error');
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  const handleSetup = async () => {
    if (!window.deskflowAPI || !projectPath || !projectId) return;
    setInitStatus('checking');
    try {
      const result = await window.deskflowAPI.trackerMindSetup?.('init-all', projectId);
      if (result?.success) {
        setInitStatus('init-ok');
        loadFiles();
      } else {
        setError(result?.error || 'Setup failed');
        setInitStatus('error');
      }
    } catch (e) {
      console.error('[FilesTab] Setup failed:', e);
      setError('Setup failed');
      setInitStatus('error');
    }
  };

  const loadFileContent = useCallback(async (file: AgentFile) => {
    if (!window.deskflowAPI || file.isDirectory || !projectPath) return;
    try {
      const result = await window.deskflowAPI.readAgentFile?.(file.path, projectPath);
      if (result?.success) {
        setFileContent(result.data);
      }
    } catch (e) {
      console.error('[FilesTab] Failed to load content:', e);
    }
  }, [projectPath]);

  useEffect(() => {
    loadFiles();
    const interval = setInterval(loadFiles, 10000);
    return () => clearInterval(interval);
  }, [loadFiles]);

  const handleFileClick = (file: AgentFile) => {
    setSelectedFile(file.name);
    loadFileContent(file);
  };

  const statusIcons: Record<string, React.ReactNode> = {
    'idle': <div className="w-1.5 h-1.5 rounded-full bg-zinc-500" />,
    'checking': <Loader2 className="w-3 h-3 text-yellow-400 animate-spin" />,
    'ready': <CheckCircle2 className="w-3 h-3 text-green-400" />,
    'init-ok': <CheckCircle2 className="w-3 h-3 text-green-400" />,
    'error': <AlertCircle className="w-3 h-3 text-red-400" />,
  };
  const statusLabels: Record<string, string> = {
    'idle': 'Not initialized',
    'checking': 'Checking...',
    'ready': 'Ready',
    'init-ok': 'Initialized',
    'error': 'Error'
  };

  const getFileCategory = (file: AgentFile): string => {
    if (file.isDirectory) return '';
    const sep = file.path.includes('\\') ? '\\' : '/';
    const parts = file.path.split(sep);
    if (parts.length === 1) return 'Root';
    return parts[0];
  };

  const groupedFiles = files.filter(f => !f.isDirectory).reduce<Record<string, AgentFile[]>>((acc, file) => {
    const cat = getFileCategory(file);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(file);
    return acc;
  }, {});

  const categoryOrder = ['Root', 'skills', 'docs', 'templates'];
  const sortedCategories = Object.keys(groupedFiles).sort((a, b) => {
    const ai = categoryOrder.indexOf(a);
    const bi = categoryOrder.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

  const categoryIcons: Record<string, React.ReactNode> = {
    'Root': <Folder className="w-3 h-3 text-zinc-500" />,
    'skills': <Zap className="w-3 h-3 text-amber-500" />,
    'docs': <FileText className="w-3 h-3 text-cyan-500" />,
    'templates': <FileText className="w-3 h-3 text-violet-500" />,
  };

  const closePreview = () => {
    setSelectedFile(null);
    setFileContent('');
  };

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          {statusIcons[initStatus]}
          <span className={`text-[10px] font-medium ${
            initStatus === 'error' ? 'text-red-400' :
            initStatus === 'checking' ? 'text-yellow-400' :
            initStatus === 'ready' || initStatus === 'init-ok' ? 'text-green-400' :
            'text-zinc-500'
          }`}>
            {statusLabels[initStatus]}
          </span>
        </div>
        {projectPath && (
          <span className="text-[10px] text-zinc-600">{files.filter(f => !f.isDirectory).length} files</span>
        )}
      </div>

      {projectPath ? (
        <GlassCard className="p-2 mb-2">
          <div className="flex items-center gap-2">
            <Folder className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] text-zinc-300 truncate" title={projectPath}>
                {project?.name || 'Project'}
              </div>
              <div className="text-[10px] text-zinc-500 truncate" title={projectPath}>
                {projectPath}
              </div>
            </div>
          </div>
        </GlassCard>
      ) : (
        <GlassCard className="p-3 mb-2 space-y-2">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3 h-3 text-yellow-400" />
            <span className="text-xs text-yellow-400">No project selected</span>
          </div>
          <div className="text-[10px] text-zinc-500">Select a project:</div>
          <select
            value=""
            onChange={(e) => { if (e.target.value) onSelectProject?.(e.target.value); }}
            className="w-full bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] border border-zinc-700/50 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-zinc-600"
          >
            <option value="">-- Choose project --</option>
            {projects?.filter(p => p.id).map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </GlassCard>
      )}

      {fileChangedNotify && (
        <div className="mb-2 px-2.5 py-1.5 bg-green-600/15 border border-green-500/25 rounded-lg text-[10px] text-green-300 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          {fileChangedNotify}
        </div>
      )}

      {loading ? (
        <LoadingState variant="spinner" />
      ) : error ? (
        <div className="flex items-center gap-1.5 text-[10px] text-rose-400 py-4 justify-center">
          <AlertCircle className="w-3 h-3" />
          {error}
        </div>
      ) : !projectPath ? (
        <div className="text-[11px] text-zinc-500 py-4 text-center">
          Select a project to view agent files
        </div>
      ) : files.length === 0 ? (
        <EmptyState icon={FileText} title="No agent files" description='Use the Setup button in the header to initialize.' />
      ) : (
        <div className="flex-1 overflow-y-auto pb-2">
          {sortedCategories.map(cat => (
            <div key={cat} className="mb-2">
              <div className="flex items-center gap-1.5 px-1 py-1 mb-1">
                {categoryIcons[cat] || <FileText className="w-3 h-3 text-zinc-500" />}
                <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                  {cat === 'Root' ? 'Infrastructure' : cat}
                </span>
                <span className="text-[10px] text-zinc-700 ml-auto">{groupedFiles[cat].length}</span>
              </div>
              {groupedFiles[cat].map(file => (
                <div
                  key={file.path}
                  onClick={() => handleFileClick(file)}
                  className={`p-2 rounded mb-0.5 cursor-pointer flex items-center gap-2 transition-colors duration-150 ${
                    selectedFile === file.name 
                      ? 'bg-zinc-700/70 border border-zinc-600/50' 
                      : 'bg-zinc-800/50 hover:bg-zinc-700/50'
                  }`}
                >
                  <FileText className={`w-3.5 h-3.5 flex-shrink-0 ${
                    file.name.endsWith('.md') ? 'text-cyan-500' :
                    file.name.endsWith('.json') ? 'text-amber-500' :
                    'text-zinc-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-zinc-200 truncate">{file.name}</div>
                    <div className="text-[10px] text-zinc-600 truncate">{file.path}</div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {selectedFile && fileContent && (
        <div className="absolute bottom-0 left-0 right-0 z-20 max-h-[45%] flex flex-col bg-zinc-900/95 light:bg-[var(--ws-surface-raised)] backdrop-blur-sm border-t border-zinc-700/50 rounded-t-lg shadow-2xl">
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-zinc-800/60 border-b border-zinc-700/30 rounded-t-lg flex-shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <FileText className={`w-3.5 h-3.5 flex-shrink-0 ${
                selectedFile.endsWith('.md') ? 'text-cyan-500' : 'text-zinc-500'
              }`} />
              <span className="text-[11px] text-zinc-300 truncate">{selectedFile}</span>
              <span className="text-[10px] text-zinc-600">{(fileContent.length / 1024).toFixed(1)} KB</span>
            </div>
            <button onClick={closePreview} className="p-0.5 hover:bg-zinc-700/50 rounded transition-colors flex-shrink-0">
              <X className="w-3.5 h-3.5 text-zinc-500" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2.5">
            {selectedFile.endsWith('.md') ? (
              <div className="space-y-1.5 text-xs">
                {fileContent.split('\n').map((line, i) => {
                  if (line.startsWith('# ')) return <h2 key={i} className="text-sm font-bold text-white pb-0.5">{line.slice(2)}</h2>;
                  if (line.startsWith('## ')) return <h3 key={i} className="text-xs font-semibold text-amber-300 pt-1">{line.slice(3)}</h3>;
                  if (line.startsWith('### ')) return <h4 key={i} className="text-[11px] font-semibold text-cyan-300 pt-0.5">{line.slice(4)}</h4>;
                  if (line.startsWith('- ')) return <div key={i} className="text-zinc-400 pl-3">• {line.slice(2)}</div>;
                  if (line.startsWith('> ')) return <div key={i} className="text-zinc-500 italic border-l-2 border-zinc-600 pl-2 py-0.5">{line.slice(2)}</div>;
                  if (line.startsWith('| ')) return <div key={i} className="text-zinc-400 font-mono text-[10px]">{line}</div>;
                  if (line.trim() === '---') return <hr key={i} className="border-zinc-700/50 my-1" />;
                  if (line.startsWith('```')) return null;
                  const codeMatch = line.match(/`([^`]+)`/);
                  if (codeMatch) {
                    const parts = line.split(/`([^`]+)`/);
                    return <p key={i} className="text-zinc-400">{parts.map((part, j) => j % 2 === 1 ? <code key={j} className="bg-zinc-800/80 px-1 rounded text-cyan-400 text-[10px]">{part}</code> : part)}</p>;
                  }
                  if (line.trim()) return <p key={i} className="text-zinc-400">{line}</p>;
                  return <div key={i} className="h-0.5" />;
                })}
              </div>
            ) : (
              <pre className="text-[10px] text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">
                {fileContent}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
