import React, { useEffect, useState } from 'react';
import { Copy, Check, Save, X, FileText, BookOpen } from 'lucide-react';

interface PromptDesignDialogProps {
  open: boolean;
  onClose: () => void;
  projectPath?: string;
  skillId?: string;
}

const PROMPT_PATH = 'docs/system-prompt-design/prompt.md';
const RESULT_PATH = 'docs/system-prompt-design/result.md';

const PromptDesignDialog: React.FC<PromptDesignDialogProps> = ({ open, onClose, projectPath }) => {
  const [promptContent, setPromptContent] = useState('');
  const [resultContent, setResultContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    setPromptContent('');
    setResultContent('');
    setSaved(false);
    setCopied(false);

    const load = async () => {
      try {
        const api = (window as any).deskflowAPI;
        const [promptResult, resultResult] = await Promise.all([
          api?.readAgentFileContent?.(PROMPT_PATH, projectPath),
          api?.readAgentFileContent?.(RESULT_PATH, projectPath),
        ]);
        if (promptResult?.success) setPromptContent(promptResult.data);
        if (resultResult?.success) setResultContent(resultResult.data);
        if (!promptResult?.success && !resultResult?.success) {
          setError('No prompt files found. Create a prompt.md first.');
        }
      } catch (e: any) {
        setError('Failed to load prompt files: ' + e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open, projectPath]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promptContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleSave = async () => {
    if (!resultContent.trim()) {
      setError('RESULT.md content cannot be empty');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const api = (window as any).deskflowAPI;
      const result = await api?.writeProjectFile?.(`agent/${RESULT_PATH}`, resultContent, projectPath);
      if (result?.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(result?.error || 'Failed to save RESULT.md');
      }
    } catch (e: any) {
      setError('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zinc-900 light:bg-[var(--ws-surface-raised)] rounded-xl w-full max-w-2xl max-h-[85vh] overflow-hidden border border-zinc-700 m-4 flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-sm font-medium text-zinc-100">Prompt Design</h2>
              <p className="text-[10px] text-zinc-500">Generate high-fidelity prompt specifications</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-zinc-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Prompt Design Brief */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-zinc-500" />
                Design Brief (prompt.md)
              </h3>
              <button
                onClick={handleCopy}
                className={`text-[10px] px-2 py-1 rounded flex items-center gap-1 ${copied ? 'bg-green-500/20 text-green-400' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <textarea
              readOnly
              value={loading ? 'Loading...' : promptContent}
              className="w-full h-48 bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-xs text-zinc-300 font-mono resize-none focus:outline-none"
            />
          </div>

          {/* RESULT.md */}
          <div>
            <h3 className="text-xs font-medium text-zinc-300 mb-2 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-zinc-500" />
              AI Output (RESULT.md)
            </h3>
            <textarea
              value={resultContent}
              onChange={e => setResultContent(e.target.value)}
              placeholder="Paste the AI's RESULT.md output here..."
              className="w-full h-48 bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-xs text-zinc-300 font-mono resize-none focus:outline-none focus:border-cyan-500/50 placeholder:text-zinc-600"
            />
          </div>

          {/* Workflow Info */}
          <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-3">
            <h4 className="text-[10px] font-medium text-zinc-400 mb-1">Workflow</h4>
            <ol className="text-[10px] text-zinc-500 space-y-0.5 list-decimal list-inside">
              <li>Load the design brief (prompt.md) from agent/docs/</li>
              <li>Copy the brief and send it to an AI to generate the RESULT</li>
              <li>Paste the AI's output into the RESULT.md field above</li>
              <li>Save — the RESULT.md is stored verbatim for reference</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-zinc-800 bg-zinc-800/30">
          <button onClick={onClose} className="px-3 py-1.5 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !resultContent.trim()}
            className={`px-3 py-1.5 text-xs rounded flex items-center gap-1.5 ${saved ? 'bg-green-500/20 text-green-400' : 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'} disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {saving ? (
              <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
            ) : saved ? (
              <Check className="w-3 h-3" />
            ) : (
              <Save className="w-3 h-3" />
            )}
            {saved ? 'Saved!' : 'Save RESULT.md'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromptDesignDialog;
