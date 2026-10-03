import { useEffect, useState, useCallback } from 'react';
import { RotateCcw, AlertTriangle, X } from 'lucide-react';
import { checkStoredIpcError, recoverFromIpcError, clearStoredIpcError } from '../lib/ipcErrorHandler';

export function ServerErrorBanner() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasCheckedStorage, setHasCheckedStorage] = useState(false);

  // Check for stored errors on mount and CLEAR them to prevent reload loops
  useEffect(() => {
    if (hasCheckedStorage) return;
    setHasCheckedStorage(true);
    
    const storedError = checkStoredIpcError();
    if (storedError) {
      // Clear the stored error so we don't loop on reload
      clearStoredIpcError();
      setErrorMessage(storedError);
      setIsVisible(true);
    }
  }, [hasCheckedStorage]);

  // Listen for new IPC errors from the global handler
  useEffect(() => {
    const handler = (error: Error) => {
      const msg = error.message.toLowerCase();
      if (msg.includes('500') || 
          msg.includes('internal server error') ||
          msg.includes('ipc') ||
          msg.includes('invoke')) {
        // Don't store - just show immediately
        setErrorMessage(error.message);
        setIsVisible(true);
      }
    };

    (window as any).__onServerErrorMessage = handler;

    return () => {
      delete (window as any).__onServerErrorMessage;
    };
  }, []);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    setErrorMessage(null);
    clearStoredIpcError();
  }, []);

  const handleReload = useCallback(() => {
    recoverFromIpcError();
  }, []);

  if (!isVisible || !errorMessage) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999]">
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
      
      <div style={{ animation: 'slideIn 0.3s ease-out' }}>
        <div className="bg-red-600/95 backdrop-blur-sm text-white px-4 py-3 flex items-center justify-between gap-4 shadow-lg border-b border-red-500/50">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <AlertTriangle className="w-5 h-5 shrink-0 text-red-200" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Internal Server Error (500)</p>
              <p className="text-xs text-red-100/80 truncate max-w-md">{errorMessage}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleDismiss}
              className="p-2 hover:bg-red-500/50 rounded-lg transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={handleReload}
              className="flex items-center gap-2 px-4 py-2 bg-white/15 hover:bg-white/25 rounded-lg transition-colors text-sm font-medium"
            >
              <RotateCcw className="w-4 h-4" />
              Reload Page
            </button>
          </div>
        </div>
        
        {/* Pulsing indicator */}
        <div className="fixed top-4 right-4">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" style={{
            animation: 'pulse 1.5s ease-in-out infinite'
          }} />
        </div>
      </div>
    </div>
  );
}
