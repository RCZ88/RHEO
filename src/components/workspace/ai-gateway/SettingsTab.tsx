// AI Gateway — SettingsTab: engine state + how sessions are stored.
import { useState, useEffect } from 'react';
import { Cpu, ShieldCheck, FolderOpen } from 'lucide-react';
import { WorkspaceSection, WorkspaceCard } from '../_ds/containers';
import { gatewayApi } from './gatewayApi';

export function SettingsTab() {
  const [pw, setPw] = useState<{ available: boolean; error: string | null } | null>(null);

  useEffect(() => {
    gatewayApi.playwrightStatus().then((r) => { if (r.success && r.data) setPw(r.data); });
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <WorkspaceSection title="Engine">
        <WorkspaceCard variant="default">
          <div className="flex items-center gap-2 mb-1.5">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[12px] font-medium text-zinc-200">Browser engine</span>
            <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              pw?.available
                ? 'text-emerald-300 bg-emerald-500/15 ring-1 ring-emerald-500/30'
                : 'text-orange-300 bg-orange-500/15 ring-1 ring-orange-500/30'
            }`}>
              {pw ? (pw.available ? 'playwright ready' : 'unavailable') : 'checking…'}
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            The gateway drives provider web UIs with a real browser (persistent profile per provider,
            stealth patches, human-like typing). Prefer real Chrome when installed; falls back to the
            bundled Chromium; uses headless mode only when no display is present.
          </p>
          {pw && !pw.available && (
            <p className="text-[10px] text-orange-200/90 mt-1.5 font-mono break-words">{pw.error}</p>
          )}
        </WorkspaceCard>
      </WorkspaceSection>

      <WorkspaceSection title="Sessions & privacy">
        <WorkspaceCard variant="default">
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[12px] font-medium text-zinc-200">Encrypted vault</span>
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Login cookies and storage states are encrypted with AES-256-GCM before touching disk.
            The key comes from <span className="font-mono text-zinc-300">WEBUI_GATEWAY_MASTER_KEY</span> when
            set, otherwise a random local key file (0600) under the app userData <span className="font-mono text-zinc-300">ai-gateway/</span> folder.
            Nothing is committed to version control. Use “Clear session” per provider to wipe it.
          </p>
        </WorkspaceCard>
        <WorkspaceCard variant="default">
          <div className="flex items-center gap-2 mb-1.5">
            <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[12px] font-medium text-zinc-200">Profiles on disk</span>
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed font-mono break-words">
            &lt;userData&gt;/ai-gateway/profiles/&lt;provider&gt;/ — one persistent browser profile each.
            Delete a folder to force a fully fresh login.
          </p>
        </WorkspaceCard>
      </WorkspaceSection>

      <WorkspaceSection title="Relationship to External AI Bridge">
        <WorkspaceCard variant="default">
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            The <span className="text-zinc-200">External AI Bridge</span> (used in Content, Learn, Goals,
            Finance, Resume) builds format-only prompts you paste into your <em>existing</em> AI
            conversations, then parses the JSON you paste back — no browser needed. The{' '}
            <span className="text-zinc-200">AI Gateway</span> here is the automated counterpart: it controls
            the browser directly to send prompts and read responses. Use the Bridge when your conversation
            already has context; use the Gateway for hands-free queries against web-only models.
          </p>
        </WorkspaceCard>
      </WorkspaceSection>
    </div>
  );
}
