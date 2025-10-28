const { ipcMain } = require('electron');
const { sql, executeQuery } = require('../services/db');

// Handler para consultar el Job en el ERP (PRODUCTION.dbo.Job)
function registerErpIpc() {
  ipcMain.handle('erp:getJobInfo', async (_event, jobRaw) => {
    const job = String(jobRaw ?? '').trim();
    if (!job) return null;

    const rows = await executeQuery(
      `
      SELECT
        Job            = j.Job,
        Part_Number    = j.Part_Number,
        [Description]  = j.[Description],
        Order_Quantity = j.Order_Quantity,
        [Status]       = j.[Status]
      FROM PRODUCTION.dbo.Job AS j
      WHERE j.Job = @job
      `,
      [{ name: 'job', type: sql.VarChar(20), value: job }],
    );

    return rows?.[0] || null;
  });

  console.log('[IPC] handler registrado: erp:getJobInfo');
}

module.exports = { registerErpIpc };