const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { secureWindow } = require('../security/hardening');

let pcaWin;

function createPCAWindow() {
  if (pcaWin && !pcaWin.isDestroyed()) return pcaWin;

  const preloadPath = path.resolve(__dirname, '../../preload/preload.js');
  console.log('[pcaWindow] preload:', preloadPath, 'exists:', fs.existsSync(preloadPath));

  pcaWin = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  secureWindow(pcaWin);
  pcaWin.loadFile(path.join(__dirname, '../../renderer/pca.html'));

  pcaWin.on('closed', () => {
    pcaWin = null;
  });

  return pcaWin;
}

function getPCAWindow() {
  return pcaWin || null;
}

module.exports = { createPCAWindow, getPCAWindow };