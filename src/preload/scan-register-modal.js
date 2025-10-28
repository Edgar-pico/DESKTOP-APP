const { contextBridge, ipcRenderer } = require('electron');

// Preload exclusivo del modal. Expone 'window.modal' al HTML del modal.
contextBridge.exposeInMainWorld('modal', {
  // Recibe datos iniciales (ej. área) al abrir el modal
  onInit: (cb) => ipcRenderer.once('scan-register:init', (_e, data) => cb?.(data)),
  // Consulta Job en ERP
  getJobInfo: (job) => ipcRenderer.invoke('erp:getJobInfo', job),
  // Cierra devolviendo datos
  accept: (payload) => ipcRenderer.send('scan-register:close', { confirmed: true, ...payload }),
  // Cierra cancelando
  cancel: () => ipcRenderer.send('scan-register:close', { confirmed: false }),
});