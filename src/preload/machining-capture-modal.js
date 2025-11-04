const { contextBridge, ipcRenderer } = require('electron');

let state = { job: '' };

// Recibe el init desde el proceso main y actualiza el contenido del DOM
ipcRenderer.on('machining-capture:init', (_e, payload) => {
  state.job = String(payload?.job || '');
  // Es seguro tocar el DOM desde el preload si el documento está listo (la señal se envía on ready-to-show)
  const jobEl = document.getElementById('job');
  if (jobEl) jobEl.textContent = state.job;
});

// Expone una API mínima al renderer (no requiere 'require')
function close(confirmed, data = {}) {
  // Incluimos el job en la respuesta por conveniencia
  ipcRenderer.send('machining-capture:close', { confirmed, job: state.job, ...data });
}

contextBridge.exposeInMainWorld('modalAPI', {
  submit: (data) => close(true, data),
  cancel: () => close(false),
});