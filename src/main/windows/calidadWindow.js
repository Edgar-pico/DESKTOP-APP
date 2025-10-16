const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { secureWindow } = require('../security/hardening');

let calidadWin;

function createCalidadWindow() {
  if (calidadWin && !calidadWin.isDestroyed()) return calidadWin;

  const preloadPath = path.resolve(__dirname, '../../preload/preload.js');
  console.log('[calidadWindow] preload:', preloadPath, 'exists:', fs.existsSync(preloadPath));

  calidadWin = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  secureWindow(calidadWin);
  calidadWin.loadFile(path.join(__dirname, '../../renderer/calidad.html'));
  return calidadWin;
}

function getCalidadWindow() {
  return calidadWin || null;
}

module.exports = { createCalidadWindow, getCalidadWindow };