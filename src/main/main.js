const { app, BrowserWindow } = require('electron');
const { loadEnv } = require('./utils/loadEnv');
loadEnv(); // Cargar variables antes de usar DB u otros módulos

const { registerAllIpc } = require('./ipc');
const { createLoginWindow } = require('./windows/loginWindow');
const { applyHardening } = require('./security/hardening');

// Tu código existente...
require('dotenv').config(); // opcional: puedes quitar esta línea si usas loadEnv() arriba

const db = require('./services/db');

app.whenReady().then(() => {
  // applyHardening();
  registerAllIpc();
  createLoginWindow();
});

app.on('activate', () => {
  if (BrowserWindow?.getAllWindows?.()?.length === 0) {
    createLoginWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});