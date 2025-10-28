const { ipcMain } = require('electron');
const { sql, getPool } = require('../services/db');

// Handler para ejecutar el SP dbo.JobProcess_ScanRegister
function registerJobProcessIpc() {
  ipcMain.handle('jobProcess:scanRegister', async (_event, payload) => {
    const job = String(payload?.job ?? '').trim();
    const area = String(payload?.area ?? '').trim();
    const qty = Number.parseInt(payload?.qty ?? 0, 10);
    const usuarioId = String(payload?.usuarioId ?? '').trim();

    if (!job) throw new Error('Parámetro job es requerido');
    if (!area) throw new Error('Parámetro area es requerido');
    if (!Number.isInteger(qty) || qty < 1) throw new Error('Cantidad inválida');
    if (!usuarioId) throw new Error('Parámetro usuarioId es requerido');

    try {
      const pool = await getPool();
      const r = await pool.request()
        .input('Job', sql.VarChar(20), job)
        .input('Area', sql.VarChar(20), area)
        .input('QtyIngresada', sql.Int, qty)
        .input('UsuarioId', sql.VarChar(10), usuarioId)
        // Usa execute para Stored Procedure; si en tu entorno prefieres .query con EXEC, también funciona.
        .execute('dbo.JobProcess_ScanRegister');

      // Devuelve la primera fila insertada por el SP (SELECT final del SP)
      return r?.recordset?.[0] || null;
    } catch (err) {
      // Propaga el mensaje del SP (incluye códigos 5300x si aplica)
      throw new Error(err?.message || String(err));
    }
  });

  console.log('[IPC] handler registrado: jobProcess:scanRegister');
}

module.exports = { registerJobProcessIpc };