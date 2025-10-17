const path = require('path');
const { BrowserWindow, ipcMain } = require('electron');

/**
 * Abre un modal para capturar y validar la cantidad de un Job.
 * El modal NO llama al SP; solo retorna { confirmed, job, qty }.
 * El parent debe luego ejecutar el SP con Área y UsuarioId de la sesión.
 * calidadWin.loadFile(path.join(__dirname, '../../renderer/calidad.html'));
 */
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
    win.loadFile(htmlPath).catch(() => {});

    // Enviar datos iniciales (por ejemplo, área desde el parent)
    win.once('ready-to-show', () => {
      win.show();
      win.webContents.send('scan-register:init', payload || {});
    });

    function onClose(ev, data) {
      // Asegura que el mensaje venga de este modal
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

function registerModalScanRegisterIpc() {
  ipcMain.handle('modal:scan-register-open', async (event, payload) => {
    const parent = BrowserWindow.fromWebContents(event.sender);
    return openScanRegisterModal(parent, payload);
  });
}

module.exports = { registerModalScanRegisterIpc };