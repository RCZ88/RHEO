import { useState, useEffect } from 'react';
import { Lock, LogIn, UserPlus, LogOut, Loader2, Check, X, ChevronRight } from 'lucide-react';
import { GlassCard } from './GlassCard';

interface AuthState {
  authenticated: boolean;
  userId: string | null;
  deviceId: string | null;
  syncUrl: string;
}

function AuthForm({ onSuccess }: { onSuccess?: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const api = (window as any).deskflowAPI;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!api) { setError('API not available'); return; }
    if (!email.trim() || !password.trim()) { setError('All fields required'); return; }
    if (mode === 'register' && password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const args = { email: email.trim(), password };
      const result = mode === 'login'
        ? await api.authLogin(args)
        : await api.authRegister(args);

      if (result.success) {
        setSuccess(mode === 'login' ? 'Logged in successfully' : 'Account created and logged in');
        onSuccess?.();
        setTimeout(() => { setSuccess(''); }, 3000);
      } else {
        setError(result.error || 'Authentication failed');
      }
    } catch (err: any) {
      setError(err.message || 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 flex items-center gap-2">
          <X className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-400 flex items-center gap-2">
          <Check className="w-3.5 h-3.5 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Toggle login/register */}
      <div className="flex rounded-lg border border-zinc-800/60 overflow-hidden">
        <button
          type="button"
          onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
          className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${mode === 'login' ? 'bg-zinc-800 text-zinc-100' : 'bg-transparent text-zinc-500 hover:text-zinc-300'}`}
        >
          Log in
        </button>
        <button
          type="button"
          onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
          className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${mode === 'register' ? 'bg-zinc-800 text-zinc-100' : 'bg-transparent text-zinc-500 hover:text-zinc-300'}`}
        >
          Create account
        </button>
      </div>

      <div className="space-y-2">
        <div>
          <label className="block text-[11px] text-zinc-500 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-800/60 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
          />
        </div>
        <div>
          <label className="block text-[11px] text-zinc-500 mb-1">
            {mode === 'login' ? 'Password' : 'Password (min 8 chars)'}
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={mode === 'login' ? 'Enter password' : 'Choose a password'}
            className="w-full px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-800/60 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
          />
        </div>
        {mode === 'register' && (
          <div>
            <label className="block text-[11px] text-zinc-500 mb-1">Confirm password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Repeat password"
              className="w-full px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-800/60 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
            />
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/20 transition-colors disabled:opacity-40"
      >
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {mode === 'login' ? 'Log in' : 'Create account'}
      </button>

      <p className="text-[11px] text-zinc-600 text-center">
        {mode === 'login'
          ? 'Don\'t have an account? '
          : 'Already have an account? '}
        <button
          type="button"
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setSuccess(''); }}
          className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
        >
          {mode === 'login' ? 'Create one' : 'Log in'}
        </button>
      </p>
    </form>
  );
}

function SyncUrlConfig({ syncUrl, onSave }: { syncUrl: string; onSave: (url: string) => void }) {
  const [url, setUrl] = useState(syncUrl);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (url.trim() && url !== syncUrl) {
      onSave(url.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-[11px] text-zinc-500 mb-1">
        Sync server URL
      </label>
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={e => { setUrl(e.target.value); setSaved(false); }}
          className="flex-1 px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-800/60 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors font-mono"
          placeholder="http://127.0.0.1:8787"
        />
        <button
          onClick={handleSave}
          disabled={saved || !url.trim() || url === syncUrl}
          className="px-3 py-2 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-40 flex items-center gap-1.5"
        >
          {saved ? <><Check className="w-3.5 h-3.5" /> Saved</> : 'Save'}
        </button>
      </div>
      <p className="text-[11px] text-zinc-600">
        The sync server your devices pair against. Default: <code className="text-zinc-500">http://127.0.0.1:8787</code>
      </p>
    </div>
  );
}

export function AuthSettings() {
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncUrl, setSyncUrl] = useState('http://127.0.0.1:8787');
  const [savingSync, setSavingSync] = useState(false);
  const [navigatingToDevices, setNavigatingToDevices] = useState(false);

  const api = (window as any).deskflowAPI;

  useEffect(() => {
    const fetchAuthState = async () => {
      if (!api?.authGetState) { setLoading(false); return; }
      try {
        const state = await api.authGetState();
        setAuthState(state);
        if (state.syncUrl) setSyncUrl(state.syncUrl);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchAuthState();
  }, [api]);

  const handleLogout = async () => {
    if (!api?.authLogout) return;
    try {
      await api.authLogout();
      setAuthState(null);
    } catch {}
    // re-fetch
    setTimeout(() => {
      if (api?.authGetState) {
        api.authGetState().then(s => { setAuthState(s); setSyncUrl(s?.syncUrl || 'http://127.0.0.1:8787'); }).catch(() => {});
      }
    }, 100);
  };

  const handleSyncUrlSave = async (url: string) => {
    setSavingSync(true);
    setSyncUrl(url);
    // Update via IPC
    if (api?.authUpdateSyncUrl) {
      try {
        await api.authUpdateSyncUrl(url);
      } catch {}
    }
    setSavingSync(false);
    // re-fetch to confirm
    if (api?.authGetState) {
      api.authGetState().then(s => setSyncUrl(s?.syncUrl || url)).catch(() => {});
    }
  };

  const handleGoToDevices = () => {
    setNavigatingToDevices(true);
    window.dispatchEvent(new CustomEvent('settings:open-tab', { detail: 'devices' }));
    setTimeout(() => setNavigatingToDevices(false), 1000);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            Sync & Authentication
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Pair devices and sync data across your machines
          </p>
        </div>
      </div>

      {/* Auth status card */}
      <GlassCard variant="compact" className="border-zinc-800/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {loading ? (
              <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
            ) : authState?.authenticated ? (
              <>
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-sm font-medium text-zinc-100">Authenticated</span>
                <span className="text-xs text-zinc-500">
                  User: {authState.userId}
                </span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-zinc-600" />
                <span className="text-sm font-medium text-zinc-400">Not authenticated</span>
                <span className="text-xs text-zinc-600">
                  Log in to pair devices and sync data
                </span>
              </>
            )}
          </div>
          {authState?.authenticated && (
            <button
              onClick={handleLogout}
              disabled={!api?.authLogout}
              className="p-1.5 rounded-md text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </GlassCard>

      {/* Login / Register form */}
      {authState?.authenticated ? (
        <GlassCard variant="compact" className="border-zinc-800/40">
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <Check className="w-4 h-4 text-emerald-400" />
            You are logged in. Use the{' '}
            <button
              onClick={handleGoToDevices}
              className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors underline underline-offset-2"
            >
              Devices tab
            </button>{' '}
            to pair your phone.
          </div>
        </GlassCard>
      ) : (
        <GlassCard variant="elevated" className="border-zinc-700/40">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="w-4 h-4 text-zinc-400" />
            <h4 className="text-sm font-semibold text-zinc-200">Authentication</h4>
          </div>
          <AuthForm onSuccess={() => { setAuthState(null); }} />
        </GlassCard>
      )}

      {/* Sync URL config */}
      <GlassCard variant="compact" className="border-zinc-800/40">
        <div className="flex items-center gap-2 mb-3">
          <ChevronRight className="w-4 h-4 text-zinc-500" />
          <h4 className="text-sm font-semibold text-zinc-200">Sync Server</h4>
        </div>
        <SyncUrlConfig syncUrl={syncUrl} onSave={handleSyncUrlSave} />
      </GlassCard>

      {/* Info */}
      <div className="text-[11px] text-zinc-600 leading-relaxed space-y-1">
        <p>
          Authentication is required to list paired devices and sync data.
          Create an account or log in above, then go to the{' '}
          <button
            onClick={handleGoToDevices}
            className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
          >
            Devices tab
          </button>{' '}
          to pair your phone.
        </p>
        <p>
          The sync server URL must point to a running DeskFlow sync server.
          If you're running the desktop app locally, the default{' '}
          <code className="text-zinc-500">http://127.0.0.1:8787</code> is correct.
        </p>
      </div>
    </div>
  );
}
