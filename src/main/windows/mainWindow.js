const { BrowserWindow } = require('electron');
const path = require('path');
const { secureWindow } = require('../security/hardening');

let mainWin;

function createMainWindow() {
  if (mainWin && !mainWin.isDestroyed()) return mainWin;

  mainWin = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true, // importante para CSP y evitar ataques
      allowRunningInsecureContent: false, // bloquea HTTP en HTTPS
    }
  });

  secureWindow(mainWin);
  mainWin.loadFile(path.join(__dirname, '../../renderer/index.html'));
  return mainWin;
}

module.exports = { createMainWindow };
