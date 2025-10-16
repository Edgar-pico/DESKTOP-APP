const { ipcMain, BrowserWindow } = require('electron');
const { registerMaterialsIPC } = require('./materials.ipc');
const { registerAuthIPC, getCurrentSession } = require('./auth.ipc'); // <- aquí
const { isAllowedExternal } = require('../security/hardening');
const { createLoginWindow, getLoginWindow } = require('../windows/loginWindow');
const { createDeburrWindow, getDeburrWindow } = require('../windows/deburrWindow');
const { createCalidadWindow, getCalidadWindow } = require('../windows/calidadWindow');

function nrm(s) { return String(s || '').trim().toLowerCase(); }

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

 // Abrir ventana según el área/usuario de la sesión global
  ipcMain.handle('app:open-main', async () => {
    const sess = getCurrentSession();
    if (!sess) throw new Error('No autenticado');

    const area = nrm(sess.Area);
    const user = nrm(sess.UserName);
    let win;

    if (area === 'deburr' || user.includes('deburr')) {
      win = createDeburrWindow();
    } else if (area === 'quality' || user.includes('calidad') || user.includes('quality')) {
      win = createCalidadWindow();
    } else {
      win = createDeburrWindow(); // default
    }

    const login = getLoginWindow?.();
    if (login && !login.isDestroyed()) login.close();
    return !!win;
  });

  // Volver al login (cierra cualquier ventana principal abierta)
  ipcMain.handle('app:open-login', async () => {
    const login = createLoginWindow();
    const dw = getDeburrWindow?.();
    const cw = getCalidadWindow?.();
    dw && !dw.isDestroyed() && dw.close();
    cw && !cw.isDestroyed() && cw.close();
    return !!login;
  });

}

module.exports = { registerAllIpc };
