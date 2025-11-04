const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { secureWindow } = require('../security/hardening');

let maquinadosWin;

function createMaquinadosWindow() {
  if (maquinadosWin && !maquinadosWin.isDestroyed()) return maquinadosWin;

  const preloadPath = path.resolve(__dirname, '../../preload/preload.js');
  console.log('[maquinadosWindow] preload:', preloadPath, 'exists:', fs.existsSync(preloadPath));

  maquinadosWin = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  secureWindow(maquinadosWin);
  maquinadosWin.loadFile(path.join(__dirname, '../../renderer/maquinados.html'));

  maquinadosWin.on('closed', () => {
    maquinadosWin = null;
  });

  return maquinadosWin;
}

function getMaquinadosWindow() {
  return maquinadosWin || null;
}

module.exports = { createMaquinadosWindow, getMaquinadosWindow };