// R-10 · Splash renderer preload — single IPC channel for splash↔main
// Exposes: getBootAnimationConfig(), onReplay(cb), sendComplete()
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('splashAPI', {
  getBootAnimationConfig: () => ipcRenderer.invoke('boot-animation-config'),
  onReplay: (cb) => ipcRenderer.on('replay-splash', () => cb()),
  sendComplete: () => ipcRenderer.invoke('splash-complete'),
});
