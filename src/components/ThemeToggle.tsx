import { useState, useEffect } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { type ThemePref, THEME_EVENT } from '../lib/theme';

interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ThemeToggle({ className = '', size = 'md' }: ThemeToggleProps) {
  const [pref, setPref] = useState<ThemePref>(() => {
    try {
      const v = localStorage.getItem('df-theme');
      if (v === 'light' || v === 'dark' || v === 'system') return v;
    } catch {}
    return 'dark';
  });

  useEffect(() => {
    const h = (e: CustomEvent) => {
      const p = e.detail?.pref;
      if (p === 'light' || p === 'dark' || p === 'system') setPref(p);
    };
    window.addEventListener(THEME_EVENT, h as EventListener);
    return () => window.removeEventListener(THEME_EVENT, h as EventListener);
  }, []);

  const cycle = () => {
    setPref(current => {
      const next: ThemePref = current === 'dark' ? 'light' : current === 'light' ? 'system' : 'dark';
      import('../lib/theme').then(m => m.setTheme(next));
      return next;
    });
  };

  const iconSize = size === 'sm' ? 14 : size === 'md' ? 16 : 18;
  const padClass = size === 'sm' ? 'p-1.5' : size === 'md' ? 'p-2' : 'p-2.5';

  const Icon = pref === 'light' ? Sun : pref === 'dark' ? Moon : Monitor;

  return (
    <button
      onClick={cycle}
      className={`group relative inline-flex items-center justify-center rounded-xl transition-all duration-200 ${padClass} ${
        pref === 'light'
          ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 light:bg-amber-50 light:text-amber-700 light:hover:bg-amber-100'
          : pref === 'dark'
          ? 'bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700/60 hover:text-zinc-200 light:bg-stone-100 light:text-stone-600 light:hover:bg-stone-200'
          : 'bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 light:bg-violet-50 light:text-violet-700 light:hover:bg-violet-100'
      } ${className}`}
      title={`Theme: ${pref.charAt(0).toUpperCase() + pref.slice(1)} (click to cycle)`}
    >
      <Icon size={iconSize} className="transition-transform duration-200 group-hover:scale-110" />
    </button>
  );
}
