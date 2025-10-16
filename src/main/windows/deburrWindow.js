const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { secureWindow } = require('../security/hardening');

let deburrWin;

function createDeburrWindow() {
  if (deburrWin && !deburrWin.isDestroyed()) return deburrWin;

  const preloadPath = path.resolve(__dirname, '../../preload/preload.js');
  console.log('[deburrWindow] preload:', preloadPath, 'exists:', fs.existsSync(preloadPath));

  deburrWin = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  secureWindow(deburrWin);
  deburrWin.loadFile(path.join(__dirname, '../../renderer/deburr.html'));
  return deburrWin;
}

function getDeburrWindow() {
  return deburrWin || null;
}

module.exports = { createDeburrWindow, getDeburrWindow };