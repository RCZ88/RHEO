import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { WS_ICON_BTN, accentStyle, ACCENT_STRIP } from './TerminalGrid';

export function Modal({ open, onClose, title, children, footer, width = 'max-w-md' }: { open: boolean; onClose: () => void; title: string; width?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[var(--z-overlay)] flex items-center justify-center p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} style={accentStyle('cyan')} className={`w-full ${width} rounded-xl border border-zinc-800/60 bg-zinc-900 animate-[ws-modal-in_250ms_cubic-bezier(0.2,0,0,1)]`}>
        <header className="flex items-center justify-between px-4 h-11 border-b border-zinc-800/60">
          <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
          <button onClick={onClose} className={WS_ICON_BTN}><X className="w-4 h-4" /></button>
        </header>
        <div className="p-5 space-y-3 text-xs text-zinc-300">{children}</div>
        {footer && <footer className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-800/60">{footer}</footer>}
      </div>
    </div>
  );
}

export function SectionCard({ accent, title, children }: { accent: string; title: string; children: React.ReactNode }) {
  return (
    <section style={accentStyle(accent)} className="rounded-xl ring-1 ring-inset ring-zinc-800/70 bg-zinc-900/50 backdrop-blur-sm">
      <header className="flex items-center gap-1.5 px-3 h-9 border-b border-zinc-800/60">
        <span className={`w-1.5 h-1.5 rounded-full ${ACCENT_STRIP[accent]}`} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{title}</span>
      </header>
      <div className="p-5 space-y-3">{children}</div>
    </section>
  );
}

export function TabPanel({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <div className="relative flex-1 min-h-0">
      <span className={`absolute left-0 top-0 bottom-0 w-0.5 ${ACCENT_STRIP[accent]} opacity-60`} />
      <div className="px-3 py-3 space-y-3">
        {children}
      </div>
    </div>
  );
}

interface WorkspaceDetailModalProps {
  projectId: string | null;
  onClose: () => void;
  onLoad: (name: string) => void;
  onDelete: (name: string) => Promise<void>;
}

export function WorkspaceDetailModal({ projectId, onClose, onLoad, onDelete }: WorkspaceDetailModalProps) {
  const [items, setItems] = useState<Array<{ name: string; isActive: boolean; updatedAt?: string }>>([]);

  useEffect(() => {
    if (!projectId || !window.deskflowAPI?.listWorkspaces) return;
    window.deskflowAPI.listWorkspaces({ projectId }).then((res: any) => {
      if (res?.success && Array.isArray(res.data)) setItems(res.data);
    }).catch(() => {});
  }, [projectId]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[var(--z-overlay)] flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-xl border border-zinc-800/60 bg-zinc-900 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-zinc-100">Saved Workspaces</h3>
          <button onClick={onClose} className={WS_ICON_BTN}><X className="w-4 h-4" /></button>
        </div>
        {items.map((w) => (
          <div key={w.name} className="flex items-center justify-between p-2 bg-zinc-800/50 rounded mb-2">
            <div>
              <span className="text-xs text-zinc-200">{w.name}</span>
              {w.isActive && <span className="ml-2 text-[9px] text-green-400">active</span>}
            </div>
            <div className="flex gap-1">
              <button onClick={() => { onLoad(w.name); onClose(); }} className="px-2 py-0.5 text-[10px] bg-green-600/50 text-green-200 rounded">Load</button>
              <button onClick={() => onDelete(w.name)} className="px-2 py-0.5 text-[10px] bg-rose-600/50 text-rose-200 rounded">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
