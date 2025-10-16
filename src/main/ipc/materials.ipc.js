const { ipcMain } = require('electron');
const db = require('../services/db');

// LISTA con filtro y TOP (con los mismos nombres de canal que ya usabas)
function registerMaterialsIPC() {
  
  ipcMain.handle('db:vMaterials:list', async (_e, { top = 100, search = null } = {}) => {
    const sqlText = `
      SELECT TOP (@top) *
      FROM dbo.v_Materials
      WHERE (@search IS NULL)
         OR PartNumber       LIKE @search
         OR [Description]    LIKE @search
         OR Primary_Vendor   LIKE @search
         OR Family           LIKE @search
         OR WorkCenter       LIKE @search
         OR Buyer            LIKE @search
      ORDER BY PartNumber;
    `;
    const params = [
      { name: 'top',    type: db.sql.Int,      value: top },
      { name: 'search', type: db.sql.NVarChar, value: search ? `%${search}%` : null },
    ];
    return db.executeQuery(sqlText, params);
  });

  // GET exacto por PN (mantenemos el canal existente)
  ipcMain.handle('db:vMaterials:byPN', async (_e, pn) => {
    const sqlText = `SELECT * FROM dbo.v_Materials WHERE PartNumber = @pn;`;
    const params = [{ name: 'pn', type: db.sql.VarChar, value: pn }];
    return db.executeQuery(sqlText, params);
  });

  // (Opcional) Ejemplo de tu handler viejo de "db:getMaterials"
  ipcMain.handle('db:getMaterials', async () => {
    const query = `
      SELECT TOP 100 * 
      FROM Material
      WHERE Material = '146A8204-21';
    `;
    return db.executeQuery(query);
  });
}

module.exports = { registerMaterialsIPC };
