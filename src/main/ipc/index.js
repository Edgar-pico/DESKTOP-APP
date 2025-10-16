const { ipcMain,BrowserWindow } = require('electron');
const { registerMaterialsIPC } = require('./materials.ipc');
const {isAllowedExternal} = require('../security/hardening');
const { registerAuthIPC } = require('./auth.ipc');


function registerAllIpc() {
  // Ping básico para pruebas
  ipcMain.handle('ping', () => 'pong');

  // Registra módulos por dominio
  registerMaterialsIPC();
    registerAuthIPCAuthIPC();

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
}

module.exports = { registerAllIpc };
