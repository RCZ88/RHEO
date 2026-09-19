import { useState, useEffect, useCallback } from 'react';
import { Smartphone, Trash2, RefreshCw, Shield, ShieldOff, AlertTriangle, Monitor, Loader2, Link, Lock } from 'lucide-react';
import { GlassCard } from './GlassCard';
import SyncPairModal from './SyncPairModal';

interface Device {
  id: string;
  name: string;
  platform: string;
  created_at: string;
  last_seen: string;
  revoked: boolean;
}

export function DevicesPanel() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [showRevokeAllConfirm, setShowRevokeAllConfirm] = useState(false);
  const [showPairModal, setShowPairModal] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  const checkAuth = useCallback(async () => {
    const api = (window as any).deskflowAPI;
    if (!api?.authGetState) { setAuthChecked(true); return; }
    try {
      const state = await api.authGetState();
      setAuthenticated(!!state?.authenticated);
    } catch {
      setAuthenticated(false);
    } finally {
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const fetchDevices = useCallback(async () => {
    try {
      const api = (window as any).deskflowAPI;
      if (!api?.listDevices) return;
      const result = await api.listDevices();
      if (result.success) {
        setDevices(result.devices || []);
        setError('');
      } else {
        setError(result.error || 'Failed to load devices');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  // Auto-refresh every 30s
  useEffect(() => {
    const timer = setInterval(fetchDevices, 30_000);
    return () => clearInterval(timer);
  }, [fetchDevices]);

  const handleRevoke = async (deviceId: string) => {
    setRevokingId(deviceId);
    try {
      const api = (window as any).deskflowAPI;
      const result = await api.revokeDevice(deviceId);
      if (result.success) {
        await fetchDevices();
      } else {
        setError(result.error || 'Failed to revoke device');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to revoke device');
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAll = async () => {
    setRevokingAll(true);
    setShowRevokeAllConfirm(false);
    try {
      const api = (window as any).deskflowAPI;
      const result = await api.revokeAllDevices();
      if (result.success) {
        await fetchDevices();
      } else {
        setError(result.error || 'Failed to revoke all devices');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to revoke all devices');
    } finally {
      setRevokingAll(false);
    }
  };

  const activeDevices = devices.filter(d => !d.revoked);
  const revokedDevices = devices.filter(d => d.revoked);

  const formatTime = (iso: string) => {
    if (!iso) return 'Never';
    try {
      const d = new Date(iso);
      const now = Date.now();
      const diff = now - d.getTime();
      if (diff < 60_000) return 'Just now';
      if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
      if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
      return d.toLocaleDateString();
    } catch {
      return iso;
    }
  };

  const platformIcon = (platform: string) => {
    if (platform === 'android' || platform === 'ios') return <Smartphone className="w-3.5 h-3.5" />;
    return <Monitor className="w-3.5 h-3.5" />;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            Paired Devices
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            {activeDevices.length} active · {revokedDevices.length} revoked
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPairModal(true)}
            className="px-2.5 py-1 rounded-md text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 border border-emerald-500/20 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Link className="w-3 h-3" />
              Pair New Device
            </span>
          </button>
          <button
            onClick={fetchDevices}
            disabled={loading}
            className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {activeDevices.length > 0 && (
            <button
              onClick={() => setShowRevokeAllConfirm(true)}
              disabled={revokingAll}
              className="px-2.5 py-1 rounded-md text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 transition-colors disabled:opacity-40"
            >
              {revokingAll ? 'Revoking...' : 'Revoke All'}
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Revoke All Confirmation */}
      {showRevokeAllConfirm && (
        <div className="px-3 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="text-xs text-amber-300">
              Revoke all {activeDevices.length} active device{activeDevices.length !== 1 ? 's' : ''}? They will lose access immediately.
            </span>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            <button
              onClick={() => setShowRevokeAllConfirm(false)}
              className="px-2 py-1 rounded text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRevokeAll}
              className="px-2 py-1 rounded text-xs font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 transition-colors"
            >
              Revoke All
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && devices.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && devices.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          {authChecked && !authenticated ? (
            <>
              <div className="w-10 h-10 rounded-full bg-zinc-800/60 flex items-center justify-center mb-3">
                <Lock className="w-5 h-5 text-zinc-500" />
              </div>
              <p className="text-sm text-zinc-400">Authentication required</p>
              <p className="text-xs text-zinc-600 mt-1">
                Log in to pair and manage devices
              </p>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('settings:open-tab', { detail: 'auth' }))}
                className="mt-3 px-4 py-2 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors border border-zinc-700/50"
              >
                Go to Auth Settings
              </button>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-zinc-800/60 flex items-center justify-center mb-3">
                <Smartphone className="w-5 h-5 text-zinc-500" />
              </div>
              <p className="text-sm text-zinc-400">No devices paired</p>
              <p className="text-xs text-zinc-600 mt-1">Scan a QR code from the terminal to pair your phone</p>
            </>
          )}
        </div>
      )}

      {/* Active devices */}
      {activeDevices.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 px-1">
            <Shield className="w-3 h-3 text-emerald-500" />
            <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Active</span>
          </div>
          {activeDevices.map(device => (
            <GlassCard key={device.id} variant="compact" className="group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
                    {platformIcon(device.platform)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-100 truncate">{device.name || 'Unnamed Device'}</div>
                    <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                      <span className="capitalize">{device.platform || 'unknown'}</span>
                      <span>·</span>
                      <span>Last seen {formatTime(device.last_seen)}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleRevoke(device.id)}
                  disabled={revokingId === device.id}
                  className="p-1.5 rounded-md text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-40"
                  title="Revoke device"
                >
                  {revokingId === device.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Revoked devices */}
      {revokedDevices.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 px-1">
            <ShieldOff className="w-3 h-3 text-zinc-600" />
            <span className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider">Revoked</span>
          </div>
          {revokedDevices.map(device => (
            <div key={device.id} className="px-3 py-2 rounded-lg bg-zinc-900/30 border border-zinc-800/20 opacity-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-800/40 flex items-center justify-center text-zinc-600">
                  {platformIcon(device.platform)}
                </div>
                <div>
                  <div className="text-sm text-zinc-500 line-through">{device.name || 'Unnamed Device'}</div>
                  <div className="text-[11px] text-zinc-600 capitalize">{device.platform || 'unknown'}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pair Modal */}
      <SyncPairModal open={showPairModal} onClose={() => { setShowPairModal(false); fetchDevices(); }} />
    </div>
  );
}
