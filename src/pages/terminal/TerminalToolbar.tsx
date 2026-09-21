import { React } from 'react';
import { SESSION_STATUS_STYLES, GROUP_ACCENT_HEX, WS_ICON_BTN, WS_SELECT, TAB_ACTIVE, ACCENT_STRIP, ACCENT_TEXT, ACCENT_BORDER, accentStyle } from './TerminalGrid';

export function StatusDot({ status, size }: { status?: string; size?: 'sm' | 'md' }) {
  const style = SESSION_STATUS_STYLES[status || 'active'] || SESSION_STATUS_STYLES.active;
  const dims = size === 'md' ? 'w-2.5 h-2.5' : 'w-1.5 h-1.5';
  return <span className={`${dims} rounded-full flex-shrink-0 ${style.dot}`} title={style.label} />;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`relative inline-flex items-center w-9 h-5 rounded-full shrink-0 transition-colors duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--page-accent)]/40 ${checked ? 'bg-[color:var(--page-accent)]' : 'bg-zinc-700'}`}>
      <span className={`inline-block w-4 h-4 rounded-full bg-white shadow-none transition-transform duration-150 ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

export function Pill({ active, onClick, dotClass, children }: { active: boolean; onClick: () => void; dotClass?: string; children: React.ReactNode }) {
  return <button onClick={onClick} className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-medium transition-colors duration-150 active:scale-95 border ${active ? 'bg-zinc-200 text-zinc-900 border-transparent' : 'bg-transparent text-zinc-400 border-zinc-800/60 hover:text-zinc-200 hover:border-zinc-700'}`}>{dotClass && <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />}{children}</button>;
}

export function Badge({ tone = 'zinc', children }: { tone?: 'zinc' | 'blue' | 'green'; children: React.ReactNode }) {
  const tones: Record<string, string> = { zinc: 'bg-zinc-800 text-zinc-300', blue: 'bg-blue-500/15 text-blue-300', green: 'bg-green-500/15 text-green-300' };
  return <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-medium ${tones[tone]}`}>{children}</span>;
}

export function ToolbarButton({ variant = 'secondary', icon: Icon, children, ...props }: { variant?: 'primary' | 'secondary'; icon?: React.ComponentType<any>; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-xl text-[11px] font-medium transition-colors duration-150 active:scale-95 ${variant === 'primary' ? 'bg-[color:var(--page-accent)] text-zinc-950 font-semibold ring-1 ring-inset ring-white/15 shadow-none shadow-black/40 hover:brightness-110' : 'bg-zinc-800/70 ring-1 ring-zinc-700/60 hover:bg-zinc-700/70 text-zinc-200 backdrop-blur-sm'}`}>{Icon && <Icon className="w-3.5 h-3.5" />}{children}</button>;
}
