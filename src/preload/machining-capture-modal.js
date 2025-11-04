const { contextBridge, ipcRenderer } = require('electron');

let state = { job: '', orderQty: 0 };

ipcRenderer.on('machining-capture:init', (_e, payload) => {
  state.job = String(payload?.job || '');
  state.orderQty = Number(payload?.orderQty || 0);
  const jobEl = document.getElementById('job');
  const oqEl  = document.getElementById('orderQty');
  if (jobEl) jobEl.textContent = state.job;
  if (oqEl)  oqEl.textContent  = String(state.orderQty);
});

function close(confirmed, data = {}) {
  ipcRenderer.send('machining-capture:close', { confirmed, job: state.job, ...data });
}

contextBridge.exposeInMainWorld('modalAPI', {
  submit: (data) => close(true, data),
  cancel: () => close(false),
});