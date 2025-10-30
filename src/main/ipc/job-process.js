const { ipcMain } = require('electron');
const { sql, getPool, executeQuery } = require('../services/db');
const { getCurrentSession } = require('./auth.ipc');

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

// Sesión
function mustAuth() {
  const s = getCurrentSession?.();
  if (!s) throw new Error('No autenticado');
  return s;
}
function sessArea() {
  const s = getCurrentSession?.();
  return String(s?.Area || '').trim();
}

// Handlers JobProcess
function registerJobProcessIpc() {
  // Registrar (Deburr/Quality). Deburr: requiere Buenas/Scrap; Supply: prohibido
  ipcMain.handle('jobProcess:scanRegister', async (_event, payload) => {
    mustAuth();
    const areaSess = sessArea();
    if (areaSess === 'Supply Chain') throw new Error('Supply Chain no puede registrar trabajos.');

    const job       = String(payload?.job ?? '').trim();
    const qty       = Number.parseInt(payload?.qty ?? 0, 10);
    const usuarioId = String(payload?.usuarioId ?? '').trim();
    const piezasOk  = payload?.piezasBuenas != null ? Number.parseInt(payload.piezasBuenas, 10) : null;
    const piezasNg  = payload?.piezasMalas  != null ? Number.parseInt(payload.piezasMalas, 10)  : null;

    // Forzar área por sesión
    const area = areaSess === 'Deburr' ? 'Deburr'
               : areaSess === 'Quality' ? 'Quality'
               : String(payload?.area ?? '').trim();

    if (!job) throw new Error('Parámetro job es requerido');
    if (!area) throw new Error('Parámetro area es requerido');
    if (!Number.isInteger(qty) || qty < 1) throw new Error('Cantidad inválida');
    if (!usuarioId) throw new Error('Parámetro usuarioId es requerido');

    try {
      const pool = await getPool();
      const r = await pool.request()
        .input('Job',           sql.VarChar(20), job)
        .input('Area',          sql.VarChar(20), area)
        .input('QtyIngresada',  sql.Int, qty)
        .input('UsuarioId',     sql.VarChar(10), usuarioId)
        .input('PiezasBuenas',  sql.Int, piezasOk) // Deburr: requerido (validado en SP)
        .input('PiezasMalas',   sql.Int, piezasNg) // Deburr: requerido (validado en SP)
        .execute('dbo.JobProcess_ScanRegister');

      return r?.recordset?.[0] || null;
    } catch (err) {
      throw new Error(err?.message || String(err));
    }
  });

  // Listar (filtra por área según sesión: Deburr/Quality; Supply puede ver todas)
  /**
   * payload:
   * - Array => statusList (compat)
   * - Object => { statusList?: string[]|string, areaList?: string[]|string }
   */
  ipcMain.handle('jobProcess:list', async (_event, payload = null) => {
    mustAuth();
    const areaSess = sessArea();

    let statusList = [];
    let areaList = [];

    if (Array.isArray(payload)) {
      statusList = normalizeArray(payload);
    } else if (payload && typeof payload === 'object') {
      statusList = normalizeArray(payload.statusList);
      areaList   = normalizeArray(payload.areaList);
    }

    // Forzar área por sesión
    if (areaSess === 'Deburr') {
      areaList = ['Deburr'];
    } else if (areaSess === 'Quality') {
      areaList = ['Quality'];
    } // Supply Chain: sin restricción adicional

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

  // Cambio de estatus (reglas por rol). Deburr: solo 'En proceso'; Supply: prohibido; Quality: En proceso/Detenido/Completado
  // payload: { items: [{ job, area, piezasBuenas?, piezasMalas?, motivo? }], newStatus, usuarioId }
  ipcMain.handle('jobProcess:changeStatus', async (_event, payload) => {
    mustAuth();
    const areaSess = sessArea();

    const newStatus = String(payload?.newStatus ?? '').trim();
    const usuarioId = String(payload?.usuarioId ?? '').trim();
    const items = Array.isArray(payload?.items) ? payload.items : [];

    const allowedGlobal = new Set(['En proceso', 'Completado', 'Detenido']);
    if (!allowedGlobal.has(newStatus)) throw new Error('newStatus inválido');
    if (!usuarioId) throw new Error('usuarioId requerido');
    if (!items.length) throw new Error('items vacío');

    if (areaSess === 'Supply Chain') {
      throw new Error('Supply Chain no puede cambiar estatus.');
    }

    // Reglas por sesión
    if (areaSess === 'Deburr') {
      if (newStatus !== 'En proceso') {
        throw new Error('Deburr solo puede establecer "En proceso".');
      }
      // Forzar área Deburr en todos los items
      for (const it of items) it.area = 'Deburr';
    } else if (areaSess === 'Quality') {
      const allowedQuality = new Set(['En proceso', 'Completado', 'Detenido']);
      if (!allowedQuality.has(newStatus)) throw new Error('newStatus inválido para Quality');
    }

    // Regla cruzada: Completado solo Quality
    if (newStatus === 'Completado' && items.some(it => String(it?.area).trim() !== 'Quality')) {
      throw new Error('Solo el área "Quality" puede marcar "Completado".');
    }

    const pool = await getPool();
    const result = { affected: 0, errors: [] };

    for (const it of items) {
      const job = String(it?.job ?? '').trim();
      const area = String(it?.area ?? '').trim();
      const piezasBuenas = it?.piezasBuenas != null ? Number(it.piezasBuenas) : null;
      const piezasMalas  = it?.piezasMalas  != null ? Number(it.piezasMalas)  : null;
      const motivo       = it?.motivo != null ? String(it.motivo).trim() : null;

      if (!job || !area) {
        result.errors.push({ job, area, message: 'job/area requeridos' });
        continue;
      }

      try {
        const req = pool.request()
          .input('Job',          sql.VarChar(20), job)
          .input('Area',         sql.VarChar(20), area)
          .input('NuevoEstatus', sql.VarChar(20), newStatus)
          .input('UsuarioId',    sql.VarChar(10), usuarioId)
          .input('PiezasBuenas', sql.Int, piezasBuenas)
          .input('PiezasMalas',  sql.Int, piezasMalas)
          .input('Motivo',       sql.NVarChar(200), motivo);

        const r = await req.execute('dbo.JobProcess_ChangeStatus');
        if (r?.recordset?.length) result.affected += 1;
      } catch (err) {
        result.errors.push({ job, area, message: err?.message || String(err) });
      }
    }

    return result;
  });

  console.log('[IPC] JobProcess handlers registrados: scanRegister, list, changeStatus (con control por área de sesión)');
}

module.exports = { registerJobProcessIpc };