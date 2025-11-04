const { contextBridge, ipcRenderer } = require('electron');

let state = { job: '' };

ipcRenderer.on('machining-capture:init', (_e, payload) => {
  state.job = String(payload?.job || '');
  const jobEl = document.getElementById('job');
  if (jobEl) jobEl.textContent = state.job;
});

function close(confirmed, data = {}) {
  ipcRenderer.send('machining-capture:close', { confirmed, ...data });
}

contextBridge.exposeInMainWorld('modalAPI', {
  submit: () => {
    const buenas = Number(document.getElementById('buenas')?.value || 0);
    const malas  = Number(document.getElementById('malas')?.value || 0);
    if (!Number.isInteger(buenas) || buenas < 0) {
      alert('Buenas inválidas'); return;
    }
    if (!Number.isInteger(malas) || malas < 0) {
      alert('Scrap inválido'); return;
    }
    close(true, { job: state.job, buenas, malas });
  },
  cancel: () => close(false),
});