import React, { useState, useEffect, useCallback } from 'react';

interface BrowserProfile {
  id: number;
  browser_name: string;
  profile_id: string;
  profile_name: string;
  is_active: number;
  created_at: string;
  updated_at: string;
  browser_version: string;
  last_seen_at: string;
  total_duration_ms: number;
  is_connected: number;
  color_tag: string;
}

const PROFILE_COLORS = [
  '#22c55e', '#3b82f6', '#a855f7', '#ef4444',
  '#f59e0b', '#06b6d4', '#ec4899', '#10b981',
  '#6366f1', '#f97316', '#14b8a6', '#8b5cf6'
];

function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function relativeTime(dateStr: string): string {
  if (!dateStr) return 'never';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export default function BrowserProfileSettings() {
  const [profiles, setProfiles] = useState<BrowserProfile[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [loading, setLoading] = useState(true);

  const loadProfiles = useCallback(async () => {
    try {
      const api = (window as any).deskflowAPI;
      if (!api?.getBrowserProfiles) { setProfiles([]); return; }
      const data = await api.getBrowserProfiles();
      setProfiles(data || []);
    } catch (err) {
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  const handleToggle = async (profile: BrowserProfile) => {
    try {
      await (window as any).deskflowAPI.toggleBrowserProfile({
        profileId: profile.id,
        isActive: !profile.is_active
      });
      loadProfiles();
    } catch (err) {
      console.error('[BrowserProfileSettings] Toggle failed:', err);
    }
  };

  const handleRename = async (profile: BrowserProfile) => {
    if (!editName.trim()) return;
    try {
      await (window as any).deskflowAPI.renameBrowserProfile({
        profileId: profile.id,
        newName: editName.trim()
      });
      setEditingId(null);
      loadProfiles();
    } catch (err) {
      console.error('[BrowserProfileSettings] Rename failed:', err);
    }
  };

  const handleDelete = async (profile: BrowserProfile) => {
    if (!confirm(`Delete profile "${profile.profile_name}"? This cannot be undone.`)) return;
    try {
      await (window as any).deskflowAPI.deleteBrowserProfile({ profileId: profile.id });
      loadProfiles();
    } catch (err) {
      console.error('[BrowserProfileSettings] Delete failed:', err);
    }
  };

  const handleColorChange = async (profile: BrowserProfile, color: string) => {
    try {
      await (window as any).deskflowAPI.setBrowserProfileColor({
        profileId: profile.id,
        color
      });
      loadProfiles();
    } catch (err) {
      console.error('[BrowserProfileSettings] Color change failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-6 w-48 bg-white/5 rounded-lg animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-sky-500/10 mb-3">
          <svg className="w-6 h-6 text-sky-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A8.966 8.966 0 0 1 3 12c0-1.264.26-2.467.727-3.559" />
          </svg>
        </div>
        <p className="text-sm text-zinc-400 mb-1">No browser profiles detected yet</p>
        <p className="text-xs text-zinc-500">Install the DeskFlow Browser Bridge extension in Chrome, Brave, Edge, or Firefox. Each browser and profile appears here automatically once it starts reporting.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-3">
      <h3 className="text-sm font-semibold text-zinc-200 mb-3">Detected Browser Profiles</h3>
      {profiles.map(profile => (
        <div
          key={profile.id}
          className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
            profile.is_active
              ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05]'
              : 'bg-white/[0.01] border-white/[0.03] opacity-60'
          }`}
        >
          {/* Color indicator */}
          <div className="relative group">
            <div
              className="w-3 h-3 rounded-full cursor-pointer ring-2 ring-white/10"
              style={{ backgroundColor: profile.color_tag }}
              title="Click to change color"
            />
            <div className="absolute top-full left-0 mt-1 hidden group-hover:flex gap-1 bg-zinc-900 border border-white/10 rounded-lg p-1.5 z-10 shadow-xl">
              {PROFILE_COLORS.map(c => (
                <button
                  key={c}
                  className="w-4 h-4 rounded-full ring-1 ring-white/20 hover:ring-white/40 transition"
                  style={{ backgroundColor: c }}
                  onClick={() => handleColorChange(profile, c)}
                />
              ))}
            </div>
          </div>

          {/* Browser icon */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ backgroundColor: profile.color_tag + '22', color: profile.color_tag }}
          >
            {profile.browser_name[0]?.toUpperCase()}
          </div>

          {/* Profile info */}
          <div className="flex-1 min-w-0">
            {editingId === profile.id ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRename(profile);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="flex-1 bg-zinc-800 border border-white/10 rounded-md px-2 py-1 text-sm text-white outline-none focus:border-sky-500/50"
                  autoFocus
                />
                <button
                  onClick={() => handleRename(profile)}
                  className="text-xs text-sky-400 hover:text-sky-300"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div
                className="text-sm font-medium text-zinc-200 cursor-pointer hover:text-white truncate"
                onClick={() => { setEditingId(profile.id); setEditName(profile.profile_name); }}
                title="Click to rename"
              >
                {profile.profile_name}
              </div>
            )}
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-zinc-500">{profile.browser_name}</span>
              <span className="text-[10px] text-zinc-600">•</span>
              <span className="text-xs text-zinc-500" title={profile.profile_id}>
                {profile.profile_id.length > 16 ? profile.profile_id.slice(0, 16) + '…' : profile.profile_id}
              </span>
            </div>
          </div>

          {/* Status + duration */}
          <div className="text-right flex-shrink-0">
            <div className="flex items-center gap-1.5 justify-end">
              <span className="relative flex w-1.5 h-1.5">
                <span className={`absolute inset-0 rounded-full ${profile.is_connected ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                {profile.is_connected && (
                  <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60 motion-reduce:hidden" />
                )}
              </span>
              <span className="text-xs text-zinc-500">
                {profile.is_connected ? 'connected' : `last seen ${relativeTime(profile.last_seen_at)}`}
              </span>
            </div>
            <div className="text-xs text-zinc-600 mt-0.5">
              {formatDuration(profile.total_duration_ms)} tracked
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => handleToggle(profile)}
              className={`px-2 py-1 rounded-md text-xs font-medium transition ${
                profile.is_active
                  ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                  : 'bg-zinc-700/50 text-zinc-500 hover:bg-zinc-700'
              }`}
            >
              {profile.is_active ? 'Active' : 'Paused'}
            </button>
            <button
              onClick={() => handleDelete(profile)}
              className="p-1 rounded-md text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition"
              title="Delete profile"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          </div>
        </div>
      ))}

      <p className="text-[11px] text-zinc-600 mt-3 pt-3 border-t border-white/[0.04]">
        Profiles are auto-detected by the DeskFlow Browser Tracker extension. Install it in each browser to track multiple profiles independently.
      </p>
    </div>
  );
}
