const { ipcMain, BrowserWindow } = require('electron');
const { registerMaterialsIPC } = require('./materials.ipc');
const { registerAuthIPC, getCurrentSession } = require('./auth.ipc');
const { isAllowedExternal } = require('../security/hardening');
const { createLoginWindow, getLoginWindow } = require('../windows/loginWindow');
const { createDeburrWindow, getDeburrWindow } = require('../windows/deburrWindow');
const { createCalidadWindow, getCalidadWindow } = require('../windows/calidadWindow');
const { createSupplyWindow, getSupplyWindow } = require('../windows/supplyWindow');

function nrm(s) { return String(s || '').trim().toLowerCase(); }

function registerAllIpc() {
  ipcMain.handle('ping', () => 'pong');
  registerMaterialsIPC();
  registerAuthIPC();

  ipcMain.handle('navigate-to-url', async (_e, url) => {
    try {
      const win = BrowserWindow.getFocusedWindow();
      if (!win) return false;
      if (isAllowedExternal(url)) { await win.loadURL(url); return true; }
      return false;
    } catch { return false; }
  });

  ipcMain.handle('app:open-main', async () => {
    const sess = getCurrentSession();
    if (!sess) throw new Error('No autenticado');

    const area = nrm(sess.Area);
    const user = nrm(sess.UserName);
    let win;

    if (area === 'supply chain' || area === 'supply' || user.includes('supply')) {
      win = createSupplyWindow();
    } else if (area === 'deburr' || user.includes('deburr')) {
      win = createDeburrWindow();
    } else if (area === 'quality' || user.includes('calidad') || user.includes('quality')) {
      win = createCalidadWindow();
    } else {
      win = createDeburrWindow();
    }

    const login = getLoginWindow?.();
    login && !login.isDestroyed() && login.close();
    return !!win;
  });

  // NUEVO: cierra TODAS las ventanas excepto el login recién creado
  ipcMain.handle('app:open-login', async () => {
    const login = createLoginWindow();
    const all = BrowserWindow.getAllWindows();
    for (const w of all) {
      if (w !== login && !w.isDestroyed()) w.close();
    }
    return !!login;
  });
}

module.exports = { registerAllIpc };