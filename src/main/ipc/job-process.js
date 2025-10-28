const { ipcMain } = require('electron');
const { sql, getPool, executeQuery } = require('../services/db');

// Utilidad para sanear identificadores tipo schema.nombre
function quoteIdent(name) {
  return String(name).split('.').map(p => `[${p.replace(/]/g, ']]')}]`).join('.');
}

// Hardcode seguro para despliegues múltiples (sin .env)
const VIEW_NAME = quoteIdent('dbo.vw_JobProcess_Base');
const SAFE_ORDER_BY = '[FechaRegistro] DESC';

// Helpers para filtros
function normalizeArray(a) {
  if (!a) return [];
  if (Array.isArray(a)) return a.map(String).map(s => s.trim()).filter(Boolean);
  if (typeof a === 'string') return [a.trim()].filter(Boolean);
  return [];
}
function buildInParams(values, baseName) {
  const params = [];
  const placeholders = values.map((_, i) => `@${baseName}${i}`).join(', ');
  values.forEach((v, i) => params.push({ name: `${baseName}${i}`, type: sql.VarChar, value: v }));
  return { placeholders, params };
}






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


  // NUEVO: listar registros desde la vista con filtros por Estatus y Área
  /**
   * Payload soportado:
   * - Array => se interpreta como statusList (compatibilidad)
   * - Objeto => { statusList?: string[]|string, areaList?: string[]|string }
   */
  ipcMain.handle('jobProcess:list', async (_event, payload = null) => {
    let statusList = [];
    let areaList = [];

    if (Array.isArray(payload)) {
      statusList = normalizeArray(payload);
    } else if (payload && typeof payload === 'object') {
      statusList = normalizeArray(payload.statusList);
      areaList   = normalizeArray(payload.areaList);
    }

    const clauses = [];
    const params = [];

    if (statusList.length > 0) {
      const { placeholders, params: p } = buildInParams(statusList, 's');
      clauses.push(`Estatus IN (${placeholders})`);
      params.push(...p);
    }
    if (areaList.length > 0) {
      const { placeholders, params: p } = buildInParams(areaList, 'a');
      clauses.push(`Area IN (${placeholders})`);
      params.push(...p);
    }

    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    const selectCols = `
      Id, Job, PartNumber, Descripcion, Order_Qty, Area,
      Qty_Real_Ingresada, Estatus, FechaRegistro, FechaActualizacion
    `;

    const query = `SELECT ${selectCols} FROM ${VIEW_NAME}${where} ORDER BY ${SAFE_ORDER_BY}`;
    const rows = await executeQuery(query, params);
    return rows || [];
  });


  console.log('[IPC] handler registrado: jobProcess:scanRegister');
}

module.exports = { registerJobProcessIpc };