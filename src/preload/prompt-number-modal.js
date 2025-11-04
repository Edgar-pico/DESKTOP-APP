const { contextBridge, ipcRenderer } = require('electron');

let conf = { title:'', label:'Cantidad', min:0, max:null, step:1 };

ipcRenderer.on('prompt-number:init', (_e, payload) => {
  conf = { ...conf, ...(payload || {}) };
  // Configurar DOM desde el preload (evitamos inline JS)
  const titleEl = document.getElementById('title');
  const labelEl = document.getElementById('label');
  const input = document.getElementById('value');
  if (titleEl) titleEl.textContent = conf.title || 'Cantidad';
  if (labelEl) labelEl.textContent = conf.label || 'Cantidad';
  if (input) {
    if (conf.min != null) input.min = String(conf.min);
    if (conf.max != null) input.max = String(conf.max);
    input.step = String(conf.step || 1);
  }
});

function close(confirmed, data = {}) {
  ipcRenderer.send('prompt-number:close', { confirmed, ...data });
}

contextBridge.exposeInMainWorld('modalAPI', {
  submit: (data) => close(true, data),
  cancel: () => close(false),
});