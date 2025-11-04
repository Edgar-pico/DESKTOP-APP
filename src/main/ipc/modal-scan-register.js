const path = require('path');
const { BrowserWindow, ipcMain } = require('electron');

function openScanRegisterModal(parent, payload) {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      parent,
      modal: true,
      show: false,
      width: 560,
      height: 520,
      resizable: false,
      minimizable: false,
      maximizable: false,
      title: 'Registrar Job',
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        preload: path.join(__dirname, '..', '..', 'preload', 'scan-register-modal.js'),
      },
    });

    const htmlPath = path.join(__dirname, '..', '..', 'renderer', 'modals', 'scan-register.html');
    win.loadFile(htmlPath).catch((e) => console.error('loadFile error:', e));

    win.once('ready-to-show', () => {
      win.show();
      win.webContents.send('scan-register:init', payload || {});
    });

    function onClose(ev, data) {
      if (ev.sender.id !== win.webContents.id) return;
      cleanup();
      if (!win.isDestroyed()) win.close();
      resolve(data || { confirmed: false });
    }
    function onClosed() {
      cleanup();
      resolve({ confirmed: false });
    }
    function cleanup() {
      ipcMain.removeListener('scan-register:close', onClose);
      win.removeListener('closed', onClosed);
    }

    ipcMain.on('scan-register:close', onClose);
    win.on('closed', onClosed);
  });
}

// NUEVO: modal simple para capturar buenas/scrap en Maquinados
function openMachiningCaptureModal(parent, payload) {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      parent,
      modal: true,
      show: false,
      width: 420,
      height: 340,
      resizable: false,
      minimizable: false,
      maximizable: false,
      title: 'Capturar producción',
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        preload: path.join(__dirname, '..', '..', 'preload', 'machining-capture-modal.js'),
      },
    });

    const htmlPath = path.join(__dirname, '..', '..', 'renderer', 'modals', 'machining-capture.html');
    win.loadFile(htmlPath).catch((e) => console.error('loadFile error:', e));

    win.once('ready-to-show', () => {
      win.show();
      win.webContents.send('machining-capture:init', payload || {});
    });

    function onClose(ev, data) {
      if (ev.sender.id !== win.webContents.id) return;
      cleanup();
      if (!win.isDestroyed()) win.close();
      resolve(data || { confirmed: false });
    }
    function onClosed() { cleanup(); resolve({ confirmed: false }); }
    function cleanup() {
      ipcMain.removeAllListeners('machining-capture:close');
      win.removeListener('closed', onClosed);
    }

    ipcMain.once('machining-capture:close', onClose);
    win.on('closed', onClosed);
  });
}

// NUEVO: modal prompt-number para pedir una cantidad
function openPromptNumberModal(parent, payload) {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      parent,
      modal: true,
      show: false,
      width: 380,
      height: 240,
      resizable: false,
      minimizable: false,
      maximizable: false,
      title: payload?.title || 'Cantidad',
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        preload: path.join(__dirname, '..', '..', 'preload', 'prompt-number-modal.js'),
      },
    });

    const htmlPath = path.join(__dirname, '..', '..', 'renderer', 'modals', 'prompt-number.html');
    win.loadFile(htmlPath).catch((e) => console.error('loadFile error:', e));

    win.once('ready-to-show', () => {
      win.show();
      win.webContents.send('prompt-number:init', payload || {});
    });

    function onClose(ev, data) {
      if (ev.sender.id !== win.webContents.id) return;
      cleanup();
      if (!win.isDestroyed()) win.close();
      resolve(data || { confirmed: false });
    }
    function onClosed() { cleanup(); resolve({ confirmed: false }); }
    function cleanup() {
      ipcMain.removeAllListeners('prompt-number:close');
      win.removeListener('closed', onClosed);
    }

    ipcMain.once('prompt-number:close', onClose);
    win.on('closed', onClosed);
  });
}

function registerModalScanRegisterIpc() {
  ipcMain.handle('modal:scan-register-open', async (event, payload) => {
    const parent = BrowserWindow.fromWebContents(event.sender);
    return openScanRegisterModal(parent, payload);
  });

  // NUEVOS handlers (no afectan el existente)
  ipcMain.handle('modal:machining-capture-open', async (event, payload) => {
    const parent = BrowserWindow.fromWebContents(event.sender);
    return openMachiningCaptureModal(parent, payload);
  });

  ipcMain.handle('modal:prompt-number-open', async (event, payload) => {
    const parent = BrowserWindow.fromWebContents(event.sender);
    return openPromptNumberModal(parent, payload);
  });
}

module.exports = { registerModalScanRegisterIpc };