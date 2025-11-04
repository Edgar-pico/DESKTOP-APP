const { ipcMain } = require('electron');
const { sql, getPool, executeQuery } = require('../services/db');
const { getCurrentSession } = require('./auth.ipc');

function quoteIdent(name) {
  return String(name).split('.').map(p => `[${p.replace(/]/g, ']]')}]`).join('.');
}
const VIEW_NAME = quoteIdent('dbo.vw_JobProcess_Base');
const SAFE_ORDER_BY = '[FechaRegistro] DESC';

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

function mustAuth() {
  const s = getCurrentSession?.();
  if (!s) throw new Error('No autenticado');
  return s;
}
function sessArea() {
  const s = getCurrentSession?.();
  return String(s?.Area || '').trim();
}

function safeHandle(channel, handler) {
  try { ipcMain.removeHandler(channel); } catch {}
  ipcMain.handle(channel, handler);
}

function registerJobProcessIpc() {
  // Registrar (Deburr/Quality/PCA/Maquinados). Supply: prohibido
  safeHandle('jobProcess:scanRegister', async (_event, payload) => {
    mustAuth();
    const areaSess = sessArea();
    if (areaSess === 'Supply Chain') throw new Error('Supply Chain no puede registrar trabajos.');

    const job       = String(payload?.job ?? '').trim();
    const qty       = Number.parseInt(payload?.qty ?? 0, 10);
    const usuarioId = String(payload?.usuarioId ?? '').trim();
    const piezasOk  = payload?.piezasBuenas != null ? Number.parseInt(payload.piezasBuenas, 10) : null;
    const piezasNg  = payload?.piezasMalas  != null ? Number.parseInt(payload.piezasMalas, 10)  : null;

    let area = String(payload?.area ?? '').trim();
    if (areaSess === 'Deburr') area = 'Deburr';
    else if (areaSess === 'Quality') area = 'Quality';
    else if (areaSess === 'PCA') area = 'PCA';
    else if (['Maquinados','Maquinado','Machining'].includes(areaSess)) area = 'Maquinados';

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

  // Listar (forzar área por sesión)
  safeHandle('jobProcess:list', async (_event, payload = null) => {
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

    if (areaSess === 'Deburr') {
      areaList = ['Deburr'];
      if (!statusList.includes('Retrabajo')) statusList.push('Retrabajo');
    } else if (areaSess === 'Quality') {
      areaList = ['Quality'];
    } else if (areaSess === 'PCA') {
      areaList = ['PCA'];
    } else if (['Maquinados','Maquinado','Machining'].includes(areaSess)) {
      areaList = ['Maquinados'];
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

    // Intentar enriquecer con máquina asignada desde PCA (si existe la columna)
    const selectColsBase = `
      v.Id, v.Job, v.PartNumber, v.Descripcion, v.Order_Qty, v.Area,
      v.PiezasBuenas, v.PiezasMalas, v.EnviadoCalidad, v.PendientePorEnviar,
      v.QC_Aceptadas, v.QC_Scrap, v.QC_PendienteInspeccion, v.Deburr_ScrapDetectadoCalidad,
      v.Deburr_ScrapInicial,
      v.Estatus, v.FechaRegistro, v.FechaActualizacion, v.IsRework
    `;
    const queryWithMachine = `
      SELECT ${selectColsBase},
             pca.TargetMachine AS TargetMachine
      FROM ${VIEW_NAME} AS v
      OUTER APPLY (
        SELECT TOP 1 jp.TargetMachine
        FROM dbo.JobProcess jp
        WHERE jp.Job = v.Job AND jp.Area = 'PCA' AND jp.IsActive = 1
        ORDER BY jp.FechaRegistro DESC
      ) AS pca
      ${where}
      ORDER BY ${SAFE_ORDER_BY};
    `;
    const queryPlain = `
      SELECT ${selectColsBase}
      FROM ${VIEW_NAME} AS v
      ${where}
      ORDER BY ${SAFE_ORDER_BY};
    `;

    try {
      const rows = await executeQuery(queryWithMachine, params);
      return rows || [];
    } catch {
      // Si no existe TargetMachine, caer al query simple
      const rows = await executeQuery(queryPlain, params);
      return rows || [];
    }
  });

  // Enviar Deburr -> Calidad (intacto)
  safeHandle('jobProcess:sendToQuality', async (_event, payload) => {
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

  // Quality: inspección (intacto)
  safeHandle('jobProcess:qualityInspect', async (_event, payload) => {
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
      const r = await pool.request()
        .input('Job',       sql.VarChar(20), job)
        .input('BuenasOk',  sql.Int, buenas)
        .input('MalasScrap',sql.Int, malas)
        .input('UsuarioId', sql.VarChar(10), usuarioId)
        .input('Motivo',    sql.NVarChar(200), motivo)
        .execute('dbo.JobProcess_QualityInspect');

      const summary = r?.recordset?.[0] || null;

      const rows = await pool.request()
        .input('job', sql.VarChar(20), job)
        .query(`SELECT TOP 1 * FROM dbo.JobProcess WHERE Job = @job AND Area='Quality' AND IsActive=1`);

      return { summary, jobProcess: rows?.recordset?.[0] || null };
    } catch (err) {
      throw new Error(err?.message || String(err));
    }
  });

  // Enviar Retrabajo: Quality -> Deburr (intacto)
  safeHandle('jobProcess:sendToRework', async (_event, payload) => {
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
        .input('FromArea',    sql.VarChar(20), 'Quality')
        .input('QtyToRework', sql.Int, qty)
        .input('UsuarioId',   sql.VarChar(10), usuarioId)
        .input('Motivo',      sql.NVarChar(200), motivo)
        .execute('dbo.JobProcess_SendToRework');

      return r?.recordsets ?? r?.recordset ?? null;
    } catch (err) {
      throw new Error(err?.message || String(err));
    }
  });

  // Cambio de estatus (respetando reglas existentes)
  safeHandle('jobProcess:changeStatus', async (_event, payload) => {
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

    const pool = await getPool();
    const result = { affected: 0, errors: [] };

    for (const it of items) {
      const job = String(it?.job ?? '').trim();
      const area = String(it?.area ?? '').trim() || areaSess;
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

  // NUEVO: Capturar producción en Maquinados (solo Maquinados)
  safeHandle('jobProcess:machiningCapture', async (_event, payload) => {
    mustAuth();
    const areaSess = sessArea();
    if (!['Maquinados','Maquinado','Machining'].includes(areaSess)) {
      throw new Error('Solo Maquinados puede capturar producción.');
    }
    const job = String(payload?.job ?? '').trim();
    const buenas = Number.parseInt(payload?.buenas ?? 0, 10);
    const malas  = Number.parseInt(payload?.malas  ?? 0, 10);
    const usuarioId = String(payload?.usuarioId ?? '').trim();
    if (!job) throw new Error('job requerido');
    if (!Number.isInteger(buenas) || buenas < 0) throw new Error('Buenas inválidas');
    if (!Number.isInteger(malas)  || malas  < 0) throw new Error('Malas inválidas');
    if (!usuarioId) throw new Error('usuarioId requerido');

    const pool = await getPool();
    try {
      const r = await pool.request()
        .input('Job',       sql.VarChar(20), job)
        .input('BuenasOk',  sql.Int, buenas)
        .input('MalasScrap',sql.Int, malas)
        .input('UsuarioId', sql.VarChar(10), usuarioId)
        .execute('dbo.JobProcess_Machining_Capture');
      return r?.recordset?.[0] || null;
    } catch (err) {
      throw new Error(err?.message || String(err));
    }
  });

  // NUEVO: Enviar buenas de Maquinados -> Deburr (solo Maquinados)
  safeHandle('jobProcess:sendToDeburrFromMaquinados', async (_event, payload) => {
    mustAuth();
    const areaSess = sessArea();
    if (!['Maquinados','Maquinado','Machining'].includes(areaSess)) {
      throw new Error('Solo Maquinados puede enviar a Deburr.');
    }
    const job = String(payload?.job ?? '').trim();
    const qty = Number.parseInt(payload?.qty ?? 0, 10);
    const usuarioId = String(payload?.usuarioId ?? '').trim();
    if (!job) throw new Error('job requerido');
    if (!Number.isInteger(qty) || qty < 1) throw new Error('Cantidad inválida');
    if (!usuarioId) throw new Error('usuarioId requerido');

    const pool = await getPool();
    try {
      const r = await pool.request()
        .input('Job',       sql.VarChar(20), job)
        .input('Qty',       sql.Int, qty)
        .input('UsuarioId', sql.VarChar(10), usuarioId)
        .execute('dbo.JobProcess_SendToDeburrFromMaquinados');
      return r?.recordset?.[0] || null;
    } catch (err) {
      throw new Error(err?.message || String(err));
    }
  });

  // PCA: surtir a máquina (crea/actualiza PCA y asegura placeholder en Maquinados)
  safeHandle('jobProcess:assignToMachine', async (_event, payload) => {
    mustAuth();
    const areaSess = sessArea();
    if (!['PCA','Supply Chain'].includes(areaSess)) {
      throw new Error('No autorizado: solo PCA o Supply Chain pueden asignar a máquina.');
    }

    const job = String(payload?.job ?? '').trim();
    const machine = String(payload?.machine ?? '').trim();
    const usuarioId = String(payload?.usuarioId ?? '').trim();
    const qty = Number.parseInt(payload?.qty ?? 0, 10) || 0;

    if (!job) throw new Error('job requerido');
    if (!machine) throw new Error('machine requerido');
    if (!usuarioId) throw new Error('usuarioId requerido');

    const pool = await getPool();
    try {
      // Crea/actualiza fila PCA mediante el SP genérico
      const r = await pool.request()
        .input('Job',           sql.VarChar(20), job)
        .input('Area',          sql.VarChar(20), 'PCA')
        .input('QtyIngresada',  sql.Int, qty)
        .input('UsuarioId',     sql.VarChar(10), usuarioId)
        .input('PiezasBuenas',  sql.Int, null)
        .input('PiezasMalas',   sql.Int, null)
        .execute('dbo.JobProcess_ScanRegister');

      const pcaRow = r?.recordset?.[0];

      // Guardar máquina en PCA (si la columna existe)
      if (pcaRow?.Id) {
        try {
          await pool.request()
            .input('Id', sql.Int, pcaRow.Id)
            .input('TargetMachine', sql.VarChar(50), machine)
            .query('UPDATE dbo.JobProcess SET TargetMachine = @TargetMachine WHERE Id = @Id;');
        } catch (e) {
          if (!/Invalid column name 'TargetMachine'/i.test(e?.message || '')) throw e;
        }
      }

      // Asegurar placeholder en Maquinados si no existe activo
      const existsMaqui = await pool.request()
        .input('job', sql.VarChar(20), job)
        .query(`SELECT TOP 1 Id FROM dbo.JobProcess WHERE Job=@job AND Area='Maquinados' AND IsActive=1`);
      if (!existsMaqui?.recordset?.length && pcaRow) {
        const ins = await pool.request()
          .input('Job',        sql.VarChar(20), pcaRow.Job)
          .input('PartNumber', sql.VarChar(50), pcaRow.PartNumber)
          .input('Descripcion',sql.NVarChar(200), pcaRow.Descripcion)
          .input('Order_Qty',  sql.Int, pcaRow.Order_Qty)
          .input('UsuarioId',  sql.VarChar(10), usuarioId)
          .query(`
            INSERT INTO dbo.JobProcess
            (Job, PartNumber, Descripcion, Order_Qty, Area, Qty_Real_Ingresada, Estatus, UsuarioId, IsActive, IsRework, ReworkIter, ReworkReason, ReworkFromArea, PiezasBuenas, PiezasMalas${/* opcional TargetMachine */''})
            VALUES (@Job, @PartNumber, @Descripcion, @Order_Qty, 'Maquinados', 0, 'Almacenado', @UsuarioId, 1, 0, 0, NULL, NULL, 0, 0);
          `);

        // Si existe columna TargetMachine, replica la asignación en Maquinados
        try {
          await pool.request()
            .input('Job', sql.VarChar(20), pcaRow.Job)
            .input('TargetMachine', sql.VarChar(50), machine)
            .query(`UPDATE dbo.JobProcess SET TargetMachine=@TargetMachine WHERE Job=@Job AND Area='Maquinados' AND IsActive=1;`);
        } catch (e) {
          if (!/Invalid column name 'TargetMachine'/i.test(e?.message || '')) throw e;
        }
      }

      return { ok: true, jobProcess: pcaRow || null };
    } catch (err) {
      throw new Error(err?.message || String(err));
    }
  });

  // PCA: surtir Job a Maquinados con máquina (sin crear fila PCA)
  safeHandle('jobProcess:pcaSupplyToMachining', async (_event, payload) => {
    mustAuth();
    const areaSess = sessArea();
    if (areaSess !== 'PCA') throw new Error('Solo PCA puede surtir a Maquinados.');

    const job = String(payload?.job ?? '').trim();
    const machine = String(payload?.machine ?? '').trim();
    const usuarioId = String(payload?.usuarioId ?? '').trim();

    if (!job) throw new Error('job requerido');
    if (!machine) throw new Error('machine requerido');
    if (!usuarioId) throw new Error('usuarioId requerido');

    try {
      const pool = await getPool();
      const r = await pool.request()
        .input('Job',           sql.VarChar(20), job)
        .input('TargetMachine', sql.VarChar(50), machine)
        .input('UsuarioId',     sql.VarChar(10), usuarioId)
        .execute('dbo.JobProcess_PCA_SupplyToMachining');

      return r?.recordset?.[0] || null;
    } catch (err) {
      throw new Error(err?.message || String(err));
    }
  });


  console.log('[IPC] JobProcess handlers: scanRegister, list, sendToQuality, qualityInspect, sendToRework, changeStatus, machiningCapture, sendToDeburrFromMaquinados, assignToMachine');
}

module.exports = { registerJobProcessIpc };