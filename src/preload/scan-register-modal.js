const { contextBridge, ipcRenderer } = require('electron');

// Nota: este preload es exclusivo del modal.
// Asume que existe un handler en main: ipcMain.handle('erp:getJobInfo', ...)

contextBridge.exposeInMainWorld('modal', {
  onInit: (cb) => ipcRenderer.once('scan-register:init', (_e, data) => cb?.(data)),
  getJobInfo: (job) => ipcRenderer.invoke('erp:getJobInfo', job),
  accept: (payload) => ipcRenderer.send('scan-register:close', { confirmed: true, ...payload }),
  cancel: () => ipcRenderer.send('scan-register:close', { confirmed: false }),
});