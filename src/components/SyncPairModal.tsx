import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check, RefreshCw, QrCode, Smartphone, Clock, ExternalLink } from "lucide-react";

interface SyncPairModalProps {
  open: boolean;
  onClose: () => void;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export default function SyncPairModal({ open, onClose }: SyncPairModalProps) {
  const [code, setCode] = useState<string | null>(null);
  const [syncUrl, setSyncUrl] = useState<string | null>(null);
  const [expiresAtMs, setExpiresAtMs] = useState<number>(0);
  const [countdown, setCountdown] = useState(0);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateCode = useCallback(async () => {
    setLoading(true);
    setError(null);
    setQrDataUrl(null);
    try {
      const result = await window.deskflowAPI.authPairGenerate();
      if (result.success && result.code && result.expiresAtMs && result.syncUrl) {
        setCode(result.code);
        setSyncUrl(result.syncUrl);
        setExpiresAtMs(result.expiresAtMs);
        setCountdown(result.expiresAtMs - Date.now());
        // Generate QR code using qrcode package
        const QRCode = await import("qrcode");
        const qrUrl = `${result.syncUrl}?code=${result.code}`;
        const dataUrl = await QRCode.toDataURL(qrUrl, {
          width: 200,
          margin: 2,
          color: { dark: "#ffffff", light: "#00000000" },
        });
        setQrDataUrl(dataUrl);
      } else {
        setError(result.error || "Failed to generate code");
      }
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Generate on open
  useEffect(() => {
    if (open && !code) {
      generateCode();
    }
  }, [open, code, generateCode]);

  // Countdown timer
  useEffect(() => {
    if (!open || expiresAtMs <= 0) return;
    timerRef.current = setInterval(() => {
      const remaining = expiresAtMs - Date.now();
      setCountdown(remaining > 0 ? remaining : 0);
      if (remaining <= 0) {
        clearInterval(timerRef.current!);
      }
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [open, expiresAtMs]);

  const handleCopy = useCallback(async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [code]);

  const handleClose = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCode(null);
    setSyncUrl(null);
    setExpiresAtMs(0);
    setCountdown(0);
    setCopied(false);
    setQrDataUrl(null);
    setError(null);
    onClose();
  }, [onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md rounded-xl border p-6"
            style={{
              backgroundColor: "var(--bg-primary, #0d0d0d)",
              borderColor: "var(--border, #1e1e1e)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg transition-colors"
              style={{ color: "var(--text-tertiary, #666)" }}
            >
              <X size={18} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: "var(--accent-primary, #f97316)15" }}
              >
                <Smartphone size={20} style={{ color: "var(--accent-primary, #f97316)" }} />
              </div>
              <div>
                <h2
                  className="text-lg font-semibold"
                  style={{ color: "var(--text-primary, #fff)" }}
                >
                  Pair Your Phone
                </h2>
                <p
                  className="text-xs"
                  style={{ color: "var(--text-tertiary, #666)" }}
                >
                  Scan this QR code with the DeskFlow mobile app
                </p>
              </div>
            </div>

            {/* QR Code */}
            {qrDataUrl ? (
              <div className="flex justify-center mb-4">
                <div
                  className="p-3 rounded-xl"
                  style={{
                    backgroundColor: "#ffffff",
                    boxShadow: "0 0 30px var(--accent-primary, #f97316)20",
                  }}
                >
                  <img src={qrDataUrl} alt="QR Code" width={200} height={200} />
                </div>
              </div>
            ) : loading ? (
              <div
                className="flex items-center justify-center h-48 rounded-xl mb-4"
                style={{ backgroundColor: "var(--bg-secondary, #141414)" }}
              >
                <RefreshCw size={24} className="animate-spin" style={{ color: "var(--text-tertiary, #666)" }} />
              </div>
            ) : null}

            {/* Code display */}
            {code && (
              <div className="mb-4">
                <div
                  className="flex items-center justify-center gap-2 p-3 rounded-xl font-mono text-2xl tracking-[0.3em] font-bold"
                  style={{
                    backgroundColor: "var(--bg-secondary, #141414)",
                    color: "var(--text-primary, #fff)",
                    border: `1px solid ${countdown > 0 ? "var(--accent-primary, #f97316)40" : "var(--border, #1e1e1e)"}`,
                  }}
                >
                  {code}
                  <button
                    onClick={handleCopy}
                    className="ml-2 p-1.5 rounded-lg transition-colors"
                    style={{
                      color: copied ? "#22c55e" : "var(--text-tertiary, #666)",
                    }}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            )}

            {/* Countdown */}
            {expiresAtMs > 0 && (
              <div
                className="flex items-center justify-center gap-2 mb-4 text-sm"
                style={{
                  color: countdown > 60000
                    ? "var(--text-tertiary, #666)"
                    : "#ef4444",
                }}
              >
                <Clock size={14} />
                <span>
                  {countdown > 0
                    ? `Expires in ${formatCountdown(countdown)}`
                    : "Code expired — generate a new one"}
                </span>
              </div>
            )}

            {/* Error */}
            {error && (
              <div
                className="text-sm text-center p-3 rounded-xl mb-4"
                style={{ backgroundColor: "#ef444420", color: "#ef4444" }}
              >
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={generateCode}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  backgroundColor: "var(--bg-secondary, #141414)",
                  color: "var(--text-primary, #fff)",
                  border: "1px solid var(--border, #1e1e1e)",
                }}
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                {code ? "Refresh Code" : "Generate Code"}
              </button>
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  backgroundColor: "var(--accent-primary, #f97316)",
                  color: "#ffffff",
                }}
              >
                Done
              </button>
            </div>

            {/* Instructions */}
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border, #1e1e1e)" }}>
              <p
                className="text-xs text-center"
                style={{ color: "var(--text-tertiary, #666)" }}
              >
                Open DeskFlow on your phone → tap <strong>Pair Device</strong> → scan this code or enter it manually
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
