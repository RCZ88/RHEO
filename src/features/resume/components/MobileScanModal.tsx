import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, X, QrCode, Wifi, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '../../../components/ui/button';

interface MobileScanModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (type: 'certification' | 'document' | 'credential') => void;
}

export function MobileScanModal({ open, onClose, onScan }: MobileScanModalProps) {
  const [pairing, setPairing] = useState(false);
  const [paired, setPaired] = useState(false);

  const handlePair = () => {
    setPairing(true);
    setTimeout(() => {
      setPairing(false);
      setPaired(true);
    }, 2000);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative bg-gradient-to-br from-zinc-900/95 to-zinc-800/90 backdrop-blur-xl border border-zinc-700/50 rounded-xl p-5 w-full max-w-sm shadow-2xl shadow-black/40 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />

            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-purple-500/15 flex items-center justify-center ring-1 ring-purple-500/20">
                  <Smartphone className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Mobile Scan</h3>
                  <p className="text-[10px] text-zinc-500">Scan certs & documents</p>
                </div>
              </div>
              <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-zinc-800/50">
                <X className="w-4 h-4" />
              </button>
            </div>

            {!paired ? (
              <div className="space-y-4">
                <div className="flex flex-col items-center py-6">
                  {pairing ? (
                    <Loader2 className="w-12 h-12 text-[var(--page-accent)] animate-spin mb-3" />
                  ) : (
                    <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-zinc-800/80 to-zinc-700/40 ring-1 ring-zinc-700 flex items-center justify-center mb-3">
                      <QrCode className="w-12 h-12 text-zinc-500" />
                    </div>
                  )}
                  <p className="text-sm text-zinc-300 text-center">
                    {pairing ? 'Waiting for phone...' : 'Scan QR code or tap to pair'}
                  </p>
                </div>

                <Button onClick={handlePair} disabled={pairing} className="w-full" size="lg">
                  <Wifi className="w-4 h-4 mr-2" /> Pair Phone
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-emerald-300 font-medium">Phone connected</span>
                </div>

                <p className="text-xs text-zinc-400 font-medium">Choose what to scan:</p>

                {[
                  { type: 'certification' as const, label: 'Certification', desc: 'AWS, Google Cloud, etc.', color: 'amber' },
                  { type: 'document' as const, label: 'Document', desc: 'Transcripts, letters', color: 'blue' },
                  { type: 'credential' as const, label: 'Credential', desc: 'Degrees, licenses', color: 'emerald' },
                ].map((item) => (
                  <motion.button
                    key={item.type}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onScan(item.type)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-gradient-to-br from-zinc-900/60 to-zinc-800/30 ring-1 ring-zinc-700/20 hover:ring-[var(--page-accent)]/30 hover:bg-[var(--page-accent-5)] transition-all duration-150 text-left"
                  >
                    <div className={`w-8 h-8 rounded-lg bg-${item.color}-500/15 flex items-center justify-center ring-1 ring-${item.color}-500/20`}>
                      <span className="text-sm font-bold text-white">{item.label[0]}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{item.label}</p>
                      <p className="text-[10px] text-zinc-500">{item.desc}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
