import { useState, useEffect, useCallback, useRef } from 'react';
import { ModalOverlay } from './ModalOverlay';
import { GlassCard } from './GlassCard';
// Use browser-specific entry to avoid Node.js server-side canvas deps
import QRCode from 'qrcode/lib/browser';

interface PairPhoneModalProps {
  terminalId: string;
  terminalLabel?: string;
  onClose: () => void;
}

interface PairingResult {
  success: boolean;
  code?: string;
  terminalId?: string;
  expiresAt?: number;
  wsUrl?: string;
  syncUrl?: string;
  port?: number;
  error?: string;
}

const CODE_TTL_MS = 5 * 60_000;

export function PairPhoneModal({ terminalId, terminalLabel, onClose }: PairPhoneModalProps) {
  const [pairing, setPairing] = useState<PairingResult | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [connected, setConnected] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateCode = useCallback(async () => {
    setLoading(true);
    setError('');
    setCopied(false);
    try {
      console.log('[PairPhoneModal] calling pairGenerateCode with terminalId:', terminalId);
      const result = await (window as any).deskflowAPI.pairGenerateCode(terminalId);
      console.log('[PairPhoneModal] pairGenerateCode result:', JSON.stringify(result));
      if (!result.success) {
        setError(result.error || 'Failed to generate pairing code');
        setLoading(false);
        return;
      }
      setPairing(result);

      // Generate QR code — encodes HTTP sync server URL (port 8787) which mobile parses for BASE_URL + code
      const qrUrl = result.syncUrl;
      if (qrUrl) {
        console.log('[PairPhoneModal] generating QR for:', qrUrl);
        try {
          const qr = await QRCode.toDataURL(qrUrl, {
            width: 200,
            margin: 2,
            color: { dark: '#e4e4e7', light: '#18181b' }, // zinc-200 on zinc-900
          });
          console.log('[PairPhoneModal] QR generated successfully, length:', qr.length);
          setQrDataUrl(qr);
        } catch (qrErr: any) {
          console.error('[PairPhoneModal] QR generation failed:', qrErr?.message || qrErr);
          setQrDataUrl('');
        }
      } else {
        console.warn('[PairPhoneModal] no syncUrl in result — QR will be empty');
      }

      setLoading(false);
    } catch (err: any) {
      console.error('[PairPhoneModal] pairGenerateCode threw:', err?.message || err);
      setError(err.message || 'Failed to generate pairing code');
      setLoading(false);
    }
  }, [terminalId]);

  // Generate code on mount
  useEffect(() => {
    generateCode();
  }, [generateCode]);

  // Countdown timer
  useEffect(() => {
    if (!pairing?.expiresAt) return;

    const tick = () => {
      const remaining = Math.max(0, Math.floor((pairing.expiresAt! - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
      }
    };

    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [pairing?.expiresAt]);

  // Listen for phone connection
  useEffect(() => {
    const api = (window as any).deskflowAPI;
    if (!api.onRelayPaired) return;
    const unsub = api.onRelayPaired((data: { terminalId: string }) => {
      if (data.terminalId === terminalId) {
        setConnected(true);
      }
    });
    return () => unsub();
  }, [terminalId]);

  const handleCopy = async () => {
    if (!pairing?.code) return;
    try {
      await navigator.clipboard.writeText(pairing.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the code text
    }
  };

  const handleRevoke = async () => {
    if (pairing?.code) {
      await (window as any).deskflowAPI.pairRevoke(pairing.code);
    }
    onClose();
  };

  const handleRefresh = () => {
    generateCode();
  };

  const isExpired = secondsLeft <= 0;
  const formattedCode = pairing?.code
    ? `${pairing.code.slice(0, 4)}-${pairing.code.slice(4)}`
    : '';

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <ModalOverlay onClose={onClose}>
      <GlassCard variant="elevated" className="w-[380px] max-w-[90vw]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Pair Phone</h3>
            {terminalLabel && (
              <p className="text-[11px] text-zinc-500 mt-0.5">{terminalLabel}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors duration-150 active:scale-95"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin mb-3" />
            <p className="text-xs text-zinc-500">Generating pairing code...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8">
            <p className="text-xs text-red-400 mb-4 text-center">{error}</p>
            <button
              onClick={handleRefresh}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            {/* QR Code */}
            {connected ? (
              <div className="flex flex-col items-center justify-center py-6 mb-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mb-3">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-emerald-400">Phone Connected!</p>
                <p className="text-[11px] text-zinc-500 mt-1">Terminal streaming is active.</p>
              </div>
            ) : (
              qrDataUrl && (
                <div className="flex justify-center mb-4">
                  <div className={`p-2 rounded-lg bg-zinc-950 light:bg-[var(--ws-surface)] border border-zinc-800/60 ${isExpired ? 'opacity-30' : ''}`}>
                    <img src={qrDataUrl} alt="Pairing QR Code" width={180} height={180} className="block" />
                  </div>
                </div>
              )
            )}

            {/* Divider with "or enter code" */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-zinc-800" />
              <span className="text-[10px] text-zinc-600 uppercase tracking-wider">or enter code</span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>

            {/* Short Code */}
            <button
              onClick={handleCopy}
              disabled={isExpired}
              className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg border transition-all duration-150 ${
                isExpired
                  ? 'bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] border-zinc-800/30 opacity-50 cursor-not-allowed'
                  : 'bg-zinc-900 light:bg-[var(--ws-surface-raised)] border-zinc-800/60 hover:border-zinc-700 hover:bg-zinc-800/60 active:scale-[0.98] cursor-pointer'
              }`}
            >
              <span className="text-2xl font-mono font-bold tracking-[0.25em] text-zinc-100 select-all">
                {formattedCode}
              </span>
              {!isExpired && (
                <span className="text-[10px] text-zinc-500 ml-2">
                  {copied ? 'Copied!' : 'Click to copy'}
                </span>
              )}
            </button>

            {/* Timer */}
            <div className="flex items-center justify-center gap-2 mt-3 mb-4">
              {isExpired ? (
                <span className="text-xs text-red-400">Code expired</span>
              ) : (
                <>
                  <div className={`w-1.5 h-1.5 rounded-full ${secondsLeft < 60 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                  <span className={`text-xs tabular-nums ${secondsLeft < 60 ? 'text-red-400' : 'text-zinc-500'}`}>
                    Expires in {formatTime(secondsLeft)}
                  </span>
                </>
              )}
            </div>

            {/* Instructions */}
            <div className="bg-zinc-950 light:bg-[var(--ws-surface-50)] rounded-lg p-3 mb-4 border border-zinc-800/30">
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Open DeskFlow on your phone, go to <span className="text-zinc-400 font-medium">Settings → Pair Device</span>,
                and scan the QR code or enter the 8-character code. Both devices must be on the same network (e.g., Tailscale).
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {isExpired ? (
                <button
                  onClick={handleRefresh}
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] transition-colors"
                >
                  Generate New Code
                </button>
              ) : (
                <>
                  <button
                    onClick={handleRevoke}
                    className="px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
                  >
                    Revoke Code
                  </button>
                  <button
                    onClick={handleRefresh}
                    className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                  >
                    Generate New Code
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </GlassCard>
    </ModalOverlay>
  );
}
