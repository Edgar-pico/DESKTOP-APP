const { BrowserWindow } = require('electron');
const path = require('path');
const { secureWindow } = require('../security/hardening');

let loginWin;

function createLoginWindow() {
  if (loginWin && !loginWin.isDestroyed()) return loginWin;

  loginWin = new BrowserWindow({
    width: 420,
    height: 360,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, '../../preload/api/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  secureWindow(loginWin);
  loginWin.loadFile(path.join(__dirname, '../../renderer/login.html'));

  loginWin.on('closed', () => {
    loginWin = null;
  });

  return loginWin;
}

function getLoginWindow() {
  return loginWin || null;
}

module.exports = { createLoginWindow, getLoginWindow };