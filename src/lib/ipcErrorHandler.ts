// IPC error interceptor - catches 500 errors from Electron main process
// and triggers the error recovery UI

import { triggerGlobalError } from '../components/ErrorBoundary';

type ApiFn = (...args: any[]) => Promise<any>;

interface IpcError extends Error {
  statusCode?: number;
  code?: string;
  detail?: string;
}

// Track if we're already showing the error UI to avoid duplicates
let errorUiActive = false;
let lastIpcError: IpcError | null = null;
let reloadCooldown = false;

export function isIpcError(error: unknown): error is IpcError {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes('500') || 
           msg.includes('internal server error') ||
           msg.includes('ipc') ||
           msg.includes('invoke') ||
           (error as any).statusCode === 500 ||
           (error as any).code === 'INTERNAL_ERROR';
  }
  return false;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const ipcErr = error as IpcError;
    if (ipcErr.statusCode === 500) {
      return `Internal Server Error (500): ${ipcErr.message || 'The server encountered an unexpected condition'}`;
    }
    if (ipcErr.detail) {
      return ipcErr.detail;
    }
    return error.message;
  }
  return String(error);
}

export function handleIpcError(error: unknown): void {
  const msg = getErrorMessage(error);
  
  // Deduplicate - only show if different from last error
  if (lastIpcError?.message === msg && Date.now() - (lastIpcError._timestamp || 0) < 5000) {
    return;
  }
  
  lastIpcError = error instanceof Error ? error as IpcError : new Error(String(error)) as IpcError;
  lastIpcError._timestamp = Date.now();
  
  console.error('[IPC Error Handler] Caught IPC error:', error);
  
  // Trigger the global error boundary
  if (error instanceof Error) {
    triggerGlobalError(error);
  } else {
    triggerGlobalError(new Error(String(error)));
  }
  
  // Set a flag that the error UI should check
  errorUiActive = true;
  
  // Store in localStorage for persistence across renders
  try {
    localStorage.setItem('deskflow-last-ipc-error', msg);
    localStorage.setItem('deskflow-ipc-error-time', Date.now().toString());
  } catch {
    // localStorage might be unavailable
  }
}

// Create a wrapped version of any API function that catches errors
export function wrapApiCall<T extends ApiFn>(apiFn: T, name: string): T {
  return ((...args: any[]) => {
    return apiFn(...args).catch((error: unknown) => {
      if (isIpcError(error) || (error as any)?.statusCode === 500) {
        handleIpcError(error);
      }
      throw error;
    }) as any;
  }) as T;
}

// Recovery function - called from the error UI
export function recoverFromIpcError(): void {
  // Prevent rapid reload loops with cooldown
  if (reloadCooldown) {
    console.warn('[IPC Error Handler] Reload cooldown active, skipping reload');
    return;
  }
  
  reloadCooldown = true;
  errorUiActive = false;
  lastIpcError = null;
  
  // Clear stored error BEFORE reloading
  try {
    localStorage.removeItem('deskflow-last-ipc-error');
    localStorage.removeItem('deskflow-ipc-error-time');
  } catch {
    // ignore
  }
  
  // Set cooldown to prevent instant re-trigger
  setTimeout(() => { reloadCooldown = false; }, 3000);
  
  // Reload the window
  window.location.reload();
}

// Check if there's a stored IPC error from before
// IMPORTANT: Callers should clear the storage after reading to prevent loops
export function checkStoredIpcError(): string | null {
  try {
    const msg = localStorage.getItem('deskflow-last-ipc-error');
    const timeStr = localStorage.getItem('deskflow-ipc-error-time');
    if (msg && timeStr) {
      const time = parseInt(timeStr, 10);
      // Only show if error is recent (within 30 seconds)
      if (Date.now() - time < 30000) {
        return msg;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Clear stored error - call this when you've handled the error
export function clearStoredIpcError(): void {
  try {
    localStorage.removeItem('deskflow-last-ipc-error');
    localStorage.removeItem('deskflow-ipc-error-time');
  } catch {
    // ignore
  }
}
