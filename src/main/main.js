const { app, BrowserWindow } = require('electron');
const { registerAllIpc } = require('./ipc');
const { createMainWindow } = require('./windows/mainWindow');
const { applyHardening } = require('./security/hardening');

require('dotenv').config(); // Carga variables de entorno desde el archivo .env
const db = require('./services/db');

  app.whenReady().then(() => {
    //applyHardening(); 
    registerAllIpc();
    createMainWindow();
  });

  app.on('activate', () => {
      if (createMainWindow && BrowserWindow?.getAllWindows?.()?.length === 0) {
      createMainWindow();
    }
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    } 
  })
