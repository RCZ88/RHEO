export function getApi(): any | undefined {
  return (window as any).deskflowAPI;
}

export async function awaitApi(timeoutMs = 30000): Promise<any> {
  const start = Date.now();
  while (!(window as any).deskflowAPI) {
    const elapsed = Date.now() - start;
    if (elapsed > timeoutMs) {
      console.error('[awaitApi] deskflowAPI bridge not ready after', timeoutMs, 'ms — preload may have failed');
      throw new Error('deskflowAPI bridge not ready');
    }
    if (elapsed > 5000 && elapsed % 5000 < 100) {
      console.warn('[awaitApi] Still waiting for deskflowAPI bridge...', Math.round(elapsed / 1000) + 's');
    }
    await new Promise(r => setTimeout(r, 100));
  }
  return (window as any).deskflowAPI;
}
