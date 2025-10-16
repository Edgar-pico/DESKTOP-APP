const { ipcMain,BrowserWindow } = require('electron');
const { registerMaterialsIPC } = require('./materials.ipc');
const { registerAuthIPC } = require('./auth.ipc');
const {isAllowedExternal} = require('../security/hardening');
const { createMainWindow } = require('../windows/mainWindow');
const { getLoginWindow } = require('../windows/loginWindow');


function registerAllIpc() {
  // Ping básico para pruebas
  ipcMain.handle('ping', () => 'pong');

  // Registra módulos por dominio
  registerMaterialsIPC();
  registerAuthIPC();

   // Agregar el manejador para la navegación
      ipcMain.handle('navigate-to-url', async (event, url) => {
    try {
      const win = BrowserWindow.getFocusedWindow();
      if (!win) {
        console.error('No se encontró ventana activa');
        return false;
      }
      
      // Verificar si la URL está permitida
      if (isAllowedExternal(url)) {
        await win.loadURL(url);
        return true;
      } else {
        console.log('URL no permitida:', url);
        return false;
      }
    } catch (error) {
      console.error('Error en navegación:', error);
      return false;
    }
  });

  ipcMain.handle('app:open-main', async () => {
    createMainWindow();
    const login = getLoginWindow();
    if (login && !login.isDestroyed()) login.close();
    return true;
  });

}

module.exports = { registerAllIpc };
