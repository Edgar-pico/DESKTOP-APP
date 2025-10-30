const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { secureWindow } = require('../security/hardening');
const { createLoginWindow } = require('./loginWindow'); // ← para volver al login al cerrar

let supplyWin;

function createSupplyWindow() {
  if (supplyWin && !supplyWin.isDestroyed()) return supplyWin;

  const preloadPath = path.resolve(__dirname, '../../preload/preload.js');
  console.log('[supplyWindow] preload:', preloadPath, 'exists:', fs.existsSync(preloadPath));

  supplyWin = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  secureWindow(supplyWin);
  supplyWin.loadFile(path.join(__dirname, '../../renderer/supply.html'));

  // Si el usuario cierra la ventana con la “X”, reabre el login
  supplyWin.on('closed', () => {
    createLoginWindow();
  });

  return supplyWin;
}

function getSupplyWindow() {
  return supplyWin || null;
}

module.exports = { createSupplyWindow, getSupplyWindow };