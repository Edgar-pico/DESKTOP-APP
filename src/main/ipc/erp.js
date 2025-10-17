const { ipcMain } = require('electron');
const sql = require('mssql'); // o tu wrapper

function registerErpIpc(poolOrGetter) {
  ipcMain.handle('erp:getJobInfo', async (_event, job) => {
    const pool = typeof poolOrGetter === 'function' ? await poolOrGetter() : poolOrGetter;
    const r = await pool.request()
      .input('job', sql.VarChar(20), String(job || '').trim())
      .query(`
        SELECT Job = j.Job,
               Part_Number = j.Part_Number,
               [Description] = j.[Description],
               Order_Quantity = j.Order_Quantity,
               [Status] = j.[Status]
        FROM PRODUCTION.dbo.Job AS j
        WHERE j.Job = @job
      `);
    return r.recordset[0] || null;
  });
}

module.exports = { registerErpIpc };