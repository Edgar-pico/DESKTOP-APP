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
        .input('PiezasBuenas',  sql.Int, piezasOk)
        .input('PiezasMalas',   sql.Int, piezasNg)
        .execute('dbo.JobProcess_ScanRegister');

      return r?.recordset?.[0] || null;
    } catch (err) {
      throw new Error(err?.message || String(err));
    }
  });

  // Listar (filtra por área según sesión: Deburr/Quality; Supply puede ver todas)
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
    if (areaSess === 'Deburr') areaList = ['Deburr'];
    else if (areaSess === 'Quality') areaList = ['Quality'];

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

    // SELECT estable incluyendo Scrap Deburr inicial
    const selectCols = `
      Id, Job, PartNumber, Descripcion, Order_Qty, Area,
      PiezasBuenas, PiezasMalas, EnviadoCalidad, PendientePorEnviar,
      QC_Aceptadas, QC_Scrap, QC_PendienteInspeccion, Deburr_ScrapDetectadoCalidad,
      Deburr_ScrapInicial,
      Estatus, FechaRegistro, FechaActualizacion
    `;

    const query = `SELECT ${selectCols} FROM ${VIEW_NAME}${where} ORDER BY ${SAFE_ORDER_BY}`;
    const rows = await executeQuery(query, params);
    return rows || [];
  });

  // Enviar Deburr -> Calidad
  ipcMain.handle('jobProcess:sendToQuality', async (_event, payload) => {
    mustAuth();
    const areaSess = sessArea();
    if (areaSess !== 'Deburr') throw new Error('Solo Deburr puede enviar a Calidad.');

    const job = String(payload?.job ?? '').trim();
    const qty = Number.parseInt(payload?.qty ?? 0, 10);
    const usuarioId = String(payload?.usuarioId ?? '').trim();

    if (!job) throw new Error('job requerido');
    if (!Number.isInteger(qty) || qty < 1) throw new Error('Cantidad a enviar inválida');
    if (!usuarioId) throw new Error('usuarioId requerido');

    const pool = await getPool();
    const r = await pool.request()
      .input('Job',       sql.VarChar(20), job)
      .input('Qty',       sql.Int, qty)
      .input('UsuarioId', sql.VarChar(10), usuarioId)
      .execute('dbo.JobProcess_SendToQuality');

    return r?.recordset?.[0] || null;
  });

  // Reemplaza / actualiza el handler existente 'jobProcess:qualityInspect' por este bloque:

ipcMain.handle('jobProcess:qualityInspect', async (_event, payload) => {
  mustAuth();
  const areaSess = sessArea();
  if (areaSess !== 'Quality') throw new Error('Solo Quality puede registrar inspección.');

  const job = String(payload?.job ?? '').trim();
  const buenas = Number.parseInt(payload?.buenas ?? 0, 10);
  const malas  = Number.parseInt(payload?.malas  ?? 0, 10);
  const usuarioId = String(payload?.usuarioId ?? '').trim();
  const motivo = payload?.motivo != null ? String(payload.motivo).trim() : null;

  if (!job) throw new Error('job requerido');
  if (!Number.isInteger(buenas) || buenas < 0) throw new Error('Buenas inválidas');
  if (!Number.isInteger(malas)  || malas  < 0) throw new Error('Malas inválidas');
  if (!usuarioId) throw new Error('usuarioId requerido');

  const pool = await getPool();
  try {
    // Ejecuta el SP que ahora también actualiza JobProcess (calidad)
    const r = await pool.request()
      .input('Job',       sql.VarChar(20), job)
      .input('BuenasOk',  sql.Int, buenas)
      .input('MalasScrap',sql.Int, malas)
      .input('UsuarioId', sql.VarChar(10), usuarioId)
      .input('Motivo',    sql.NVarChar(200), motivo)
      .execute('dbo.JobProcess_QualityInspect');

    const summary = r?.recordset?.[0] || null;

    // Recuperar fila activa en JobProcess para Quality (ahora actualizada)
    const rows = await pool.request()
      .query(`SELECT TOP 1 * FROM dbo.JobProcess WHERE Job = @job AND Area='Quality' AND IsActive=1`,
        [{ name: 'job', type: sql.VarChar, value: job }]); // not using execute here to keep example simple

    // NOTE: some drivers accept parameterized .query differently; you can instead run execute('dbo.JobProcess_Get')
    // but here we return useful data for renderer:
    return { summary, jobProcess: rows?.recordset?.[0] || null };
  } catch (err) {
    throw new Error(err?.message || String(err));
  }
});


  // --- Añadir este handler cerca de los otros jobProcess: handlers (por ejemplo después de 'jobProcess:qualityInspect') ---

  // Enviar Retrabajo: Quality -> Deburr
ipcMain.handle('jobProcess:sendToRework', async (_event, payload) => {
  mustAuth();
  const areaSess = sessArea();
  if (areaSess !== 'Quality') throw new Error('Solo Quality puede enviar a Retrabajo.');

  const job = String(payload?.job ?? '').trim();
  const qty = Number.parseInt(payload?.qty ?? 0, 10);
  const usuarioId = String(payload?.usuarioId ?? '').trim();
  const motivo = payload?.motivo != null ? String(payload.motivo).trim() : null;

  if (!job) throw new Error('job requerido');
  if (!Number.isInteger(qty) || qty < 1) throw new Error('Cantidad inválida');
  if (!usuarioId) throw new Error('usuarioId requerido');

  try {
    const pool = await getPool();
    const r = await pool.request()
      .input('Job',         sql.VarChar(20), job)
      .input('FromArea',    sql.VarChar(20), 'Quality')     // fijo: Quality es el origen
      .input('QtyToRework', sql.Int, qty)
      .input('UsuarioId',   sql.VarChar(10), usuarioId)
      .input('Motivo',      sql.NVarChar(200), motivo)
      .execute('dbo.JobProcess_SendToRework');

    // El SP devuelve normalmente 2 resultsets (fila Deburr creada y estado/saldo de Quality).
    // Devuelvo recordsets para que el renderer pueda inspeccionar ambas filas si lo requiere.
    return r?.recordsets ?? r?.recordset ?? null;
  } catch (err) {
    throw new Error(err?.message || String(err));
  }
});




  // Cambio de estatus
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

    if (areaSess === 'Supply Chain') throw new Error('Supply Chain no puede cambiar estatus.');

    if (areaSess === 'Deburr') {
      if (newStatus !== 'En proceso') throw new Error('Deburr solo puede establecer "En proceso".');
      for (const it of items) it.area = 'Deburr';
    } else if (areaSess === 'Quality') {
      const allowedQuality = new Set(['En proceso', 'Completado', 'Detenido']);
      if (!allowedQuality.has(newStatus)) throw new Error('newStatus inválido para Quality');
    }

    // Validación para completar en Quality (sin depender de columnas nuevas)
    if (newStatus === 'Completado') {
      for (const it of items) {
        const area = String(it?.area || '').trim();
        if (area !== 'Quality') throw new Error('Solo el área "Quality" puede marcar "Completado".');

        const job = String(it?.job ?? '').trim();
        if (!job) continue;

        const rows = await executeQuery(
          `SELECT
             (SELECT ISNULL(PendientePorEnviar,0) FROM ${VIEW_NAME} WHERE Job=@job AND Area='Deburr')   AS PendientePorEnviar,
             (SELECT ISNULL(QC_PendienteInspeccion,0) FROM ${VIEW_NAME} WHERE Job=@job AND Area='Quality') AS QC_PendienteInspeccion,
             (SELECT ISNULL(QC_Aceptadas,0) FROM ${VIEW_NAME} WHERE Job=@job AND Area='Quality') AS QC_Aceptadas,
             (SELECT ISNULL(QC_Scrap,0) FROM ${VIEW_NAME} WHERE Job=@job AND Area='Quality') AS QC_Scrap`,
          [{ name: 'job', type: sql.VarChar, value: job }]
        );
        const row = rows?.[0] || {};
        const pendEnviar = Number(row.PendientePorEnviar ?? 0);
        const pendInsp   = Number(row.QC_PendienteInspeccion ?? 0);

        if (pendEnviar > 0) throw new Error(`Faltan ${pendEnviar} pzas por enviar desde Deburr.`);
        if (pendInsp   > 0) throw new Error(`Faltan ${pendInsp} pzas por inspeccionar en Calidad.`);

        if (it.piezasBuenas == null) it.piezasBuenas = Number(row.QC_Aceptadas ?? 0);
        if (it.piezasMalas  == null) it.piezasMalas  = Number(row.QC_Scrap ?? 0);
      }
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
        const r = await pool.request()
          .input('Job',          sql.VarChar(20), job)
          .input('Area',         sql.VarChar(20), area)
          .input('NuevoEstatus', sql.VarChar(20), newStatus)
          .input('UsuarioId',    sql.VarChar(10), usuarioId)
          .input('PiezasBuenas', sql.Int, piezasBuenas)
          .input('PiezasMalas',  sql.Int, piezasMalas)
          .input('Motivo',       sql.NVarChar(200), motivo)
          .execute('dbo.JobProcess_ChangeStatus');

        if (r?.recordset?.length) result.affected += 1;
      } catch (err) {
        result.errors.push({ job, area, message: err?.message || String(err) });
      }
    }

    return result;
  });




  console.log('[IPC] JobProcess handlers: scanRegister, list, sendToQuality, qualityInspect, changeStatus');
}

module.exports = { registerJobProcessIpc };