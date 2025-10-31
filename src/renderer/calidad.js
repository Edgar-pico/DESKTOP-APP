document.addEventListener('DOMContentLoaded', async () => {
  // Helpers
  function prettyError(err) {
    const raw = String(err?.message || err || '');
    return raw
      .replace(/^Error invoking remote method '.*?':\s*/i, '')
      .replace(/^Uncaught (in promise )?Error:\s*/i, '')
      .replace(/^Error:\s*/i, '')
      .trim();
  }
  function setMsg(t) {
    const el = document.getElementById('qualityMsg');
    if (el) el.textContent = t || '';
  }
  function setSelCount(selected) {
    const el = document.getElementById('selCount');
    if (el) el.textContent = `${selected.size} seleccionados`;
  }
  function fmtDate(val) {
    try { return new Date(val).toLocaleString(); } catch { return String(val ?? ''); }
  }
  // Estado de la vista
  const selected = new Set();
  const lastRowsMap = new Map();

  // UI básico
  try {
    const me = await window.api.auth.me();
    document.getElementById('me').textContent =
      me?.user ? `Usuario: ${me.user.Nombre || me.user.UserName} | Área: ${me.user.Area || '-'}` : 'Sin sesión';
  } catch {}

  // Data
  async function loadList() {
    try {
      const rows = await window.api.jobProcess.list({ statusList: ['Almacenado', 'En proceso'], areaList: ['Quality'] });
      renderRows(rows);
    } catch (e) {
      setMsg(prettyError(e));
      renderRows([]);
    }
  }

  function renderRows(rows) {
    const tbody = document.getElementById('qualityTbody');
    tbody.innerHTML = '';
    lastRowsMap.clear();
    selected.clear();

    if (!rows || rows.length === 0) {
      tbody.innerHTML = `<tr><td class="center" colspan="9">Sin registros</td></tr>`;
      setSelCount(selected);
      return;
    }

    for (const r of rows) {
      lastRowsMap.set(r.Id, r);
      const tr = document.createElement('tr');
      tr.classList.add('row-clickable');
      tr.addEventListener('click', () => {
        if (selected.has(r.Id)) { selected.delete(r.Id); tr.classList.remove('row-selected'); }
        else { selected.add(r.Id); tr.classList.add('row-selected'); }
        setSelCount(selected);
      });

      const cols = [
        r.Job,
        r.PartNumber,
        r.Order_Qty ?? 0,
        r.EnviadoCalidad ?? 0,
        r.QC_Aceptadas ?? 0,
        r.QC_Scrap ?? 0,
        r.QC_PendienteInspeccion ?? 0,
        r.Estatus ?? '',
        fmtDate(r.FechaRegistro),
      ];
      for (const val of cols) {
        const td = document.createElement('td');
        td.textContent = val ?? '';
        td.title = String(val ?? '');
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }

    setSelCount(selected);
  }

  // Modal para inspección (sin prompts del navegador)
  function openInspectModal({ job, pendiente, defBuenas, defMalas }) {
    return new Promise((resolve) => {
      const overlay = document.getElementById('inspectModal');
      const okInput = document.getElementById('okInput');
      const ngInput = document.getElementById('ngInput');
      const help = document.getElementById('inspectHelp');
      const err = document.getElementById('inspectError');
      const btnOk = document.getElementById('inspectOk');
      const btnCancel = document.getElementById('inspectCancel');
      const titleEl = document.getElementById('inspectTitle');

      if (!overlay || !okInput || !ngInput || !help || !err || !btnOk || !btnCancel || !titleEl) {
        resolve(null); return;
      }

      titleEl.textContent = `Registrar inspección - Job ${job}`;
      okInput.value = String(defBuenas ?? pendiente);
      ngInput.value = String(defMalas ?? 0);
      help.textContent = `Pendiente por inspeccionar: ${pendiente} pzas. La suma no puede exceder el pendiente.`;
      err.textContent = '';

      function validate() {
        const b = parseInt(okInput.value, 10);
        const m = parseInt(ngInput.value, 10);
        if (!Number.isInteger(b) || b < 0) { err.textContent = 'Buenas debe ser ≥ 0.'; return false; }
        if (!Number.isInteger(m) || m < 0) { err.textContent = 'Scrap debe ser ≥ 0.'; return false; }
        const s = (Number.isInteger(b) ? b : 0) + (Number.isInteger(m) ? m : 0);
        if (s <= 0) { err.textContent = 'La suma debe ser > 0.'; return false; }
        if (s > pendiente) { err.textContent = `Excede el pendiente (${pendiente}).`; return false; }
        err.textContent = '';
        return true;
      }
      function cleanup(result) {
        overlay.hidden = true;
        overlay.setAttribute('aria-hidden', 'true');
        btnOk.removeEventListener('click', onOk);
        btnCancel.removeEventListener('click', onCancel);
        okInput.removeEventListener('keydown', onKey);
        ngInput.removeEventListener('keydown', onKey);
        document.removeEventListener('keydown', onEsc);
        resolve(result);
      }
      function onOk() {
        if (!validate()) return;
        const buenas = parseInt(okInput.value, 10) || 0;
        const malas = parseInt(ngInput.value, 10) || 0;
        cleanup({ buenas, malas });
      }
      function onCancel() { cleanup(null); }
      function onKey(e) { if (e.key === 'Enter') { e.preventDefault(); onOk(); } }
      function onEsc(e) { if (e.key === 'Escape') { e.preventDefault(); onCancel(); } }

      btnOk.addEventListener('click', onOk);
      btnCancel.addEventListener('click', onCancel);
      okInput.addEventListener('keydown', onKey);
      ngInput.addEventListener('keydown', onKey);
      document.addEventListener('keydown', onEsc);

      overlay.hidden = false;
      overlay.removeAttribute('aria-hidden');
      setTimeout(() => { okInput.focus(); okInput.select?.(); }, 0);
    });
  }

  async function onInspect() {
    if (selected.size !== 1) { setMsg('Selecciona 1 registro.'); return; }
    const id = Array.from(selected)[0];
    const r = lastRowsMap.get(id);
    if (!r) { setMsg('No se encontró el registro.'); return; }

    const pend = Number(r.QC_PendienteInspeccion ?? 0);
    if (pend <= 0) { setMsg('No hay piezas pendientes por inspeccionar.'); return; }

    try {
      const result = await openInspectModal({
        job: r.Job,
        pendiente: pend,
        defBuenas: pend,
        defMalas: 0,
      });
      if (!result) return;
      const { buenas, malas } = result;

      const me = await window.api.auth.me();
      const usuarioId = me?.user?.UsuarioId || me?.user?.UserName || 'system';
      await window.api.jobProcess.qualityInspect({ job: r.Job, buenas, malas, usuarioId });
      setMsg(`Inspección registrada. Buenas: ${buenas}, Scrap: ${malas}.`);
      await loadList();
    } catch (e) {
      setMsg(prettyError(e));
    }
  }

  async function onComplete() {
    if (selected.size === 0) { setMsg('Selecciona al menos un registro.'); return; }

    const items = Array.from(selected).map(id => {
      const r = lastRowsMap.get(id);
      return { job: r?.Job, area: 'Quality' };
    }).filter(x => x.job);

    try {
      const me = await window.api.auth.me();
      const usuarioId = me?.user?.UsuarioId || me?.user?.UserName || 'system';
      const res = await window.api.jobProcess.changeStatus({ items, newStatus: 'Completado', usuarioId });
      const ok = res?.affected ?? 0;
      const err = (res?.errors || []).length;
      const firstErrMsg = res?.errors?.[0]?.message ? ` Detalle: ${prettyError(res.errors[0].message)}` : '';
      setMsg(`Completados ${ok}. ${err ? `Errores: ${err}.${firstErrMsg}` : ''}`);
      await loadList();
    } catch (e) {
      setMsg(prettyError(e));
    }
  }

  // Enlaces de UI (después de definir funciones para evitar ReferenceError)
  document.getElementById('btnLogout')?.addEventListener('click', async () => {
    await window.api.auth.logout();
    await window.api.app.openLogin();
  });
  document.getElementById('btnQualityRefresh')?.addEventListener('click', loadList);
  document.getElementById('btnQualityInspect')?.addEventListener('click', onInspect);
  document.getElementById('btnQualityComplete')?.addEventListener('click', onComplete);

  // Primera carga
  await loadList();
});