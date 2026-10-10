import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import EmbeddedBrowser, { SITES } from '@/components/EmbeddedBrowser';

const AIS = [
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chat.openai.com/' },
  { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/' },
  { id: 'claude', name: 'Claude', url: 'https://claude.ai/' },
  { id: 'kimi', name: 'Kimi', url: 'https://www.kimi.com/' },
  { id: 'glm', name: 'GLM', url: 'https://chat.z.ai/' },
];

/**
 * "Ask free AI" bridge.
 *
 * Each provider now opens INSIDE the app by default (an embedded browser panel)
 * instead of throwing you out to a separate browser window. The external link
 * is still there, because a site that refuses an embedded session should never
 * be a dead end — you can always fall back to the real browser.
 */
export default function AIBridge({ compact = false, defaultUrl }: { compact?: boolean; defaultUrl?: string }) {
  const [inApp, setInApp] = useState(false);

  if (inApp) {
    return (
      <div className="space-y-2">
        <EmbeddedBrowser defaultUrl={defaultUrl} />
        <button
          onClick={() => setInApp(false)}
          className="text-[11px] text-white/40 hover:text-white underline underline-offset-2"
        >
          Back to provider list
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className={'grid gap-2 ' + (compact ? 'grid-cols-5' : 'grid-cols-2 sm:grid-cols-5')}>
        {AIS.map(a => (
          <div
            key={a.id}
            className={'group rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-all p-3 flex items-center gap-2 ' + (compact ? 'justify-center' : '')}
          >
            <button
              onClick={() => setInApp(true)}
              title={`Open ${a.name} inside the app`}
              className="flex items-center gap-2 min-w-0 flex-1"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-amber-300 to-violet-600 shrink-0" />
              <span className={compact ? 'text-[11px] font-semibold text-white/80 truncate' : 'text-xs font-semibold text-white truncate'}>
                {a.name}
              </span>
            </button>
            <a
              href={a.url}
              target="_blank"
              rel="noreferrer"
              title={`Open ${a.name} in your normal browser`}
              className="text-white/30 hover:text-white/70 transition-colors shrink-0"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        ))}
      </div>
      {!compact && (
        <p className="text-[11px] text-white/35 leading-relaxed">
          Click a provider to open it <span className="text-white/55">inside this window</span> — your sign-in is
          remembered. Use the ↗ icon to fall back to your normal browser.
        </p>
      )}
    </div>
  );
}

export { SITES };