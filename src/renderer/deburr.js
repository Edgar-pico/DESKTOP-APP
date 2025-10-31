document.addEventListener('DOMContentLoaded', async () => {
  try {
    const me = await window.api.auth.me();
    document.getElementById('me').textContent =
      me?.user ? `Usuario: ${me.user.Nombre || me.user.UserName} | Área: ${me.user.Area || '-'}` : 'Sin sesión';
  } catch {}

  // Referencias UI
  const btnOpenRegister   = document.getElementById('btnOpenRegister');
  const btnDeburrRefresh  = document.getElementById('btnDeburrRefresh');
  const btnInProc         = document.getElementById('btnSetInProcess');
  const btnSendToQuality  = document.getElementById('btnSendToQuality');
  const btnComplete       = document.getElementById('btnSetComplete');

  // Estado
  let highlightId = null;
  const selected = new Set();
  const lastRowsMap = new Map();

  // Helpers
  function prettyError(err) {
    const raw = String(err?.message || err || '');
    return raw.replace(/^Error invoking remote method '.*?':\s*/i, '').replace(/^Error:\s*/i, '').trim();
  }
  function setMsg(t) {
    const el = document.getElementById('deburrMsg');
    if (el) el.textContent = t || '';
  }
  function getFilters() {
    return { statusList: ['Almacenado', 'En proceso'], areaList: ['Deburr'], areaSelected: 'Deburr' };
  }
  function fmtDateCompact(val) {
    if (val == null) return '';
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function makeDateCell(val) {
    const td = document.createElement('td');
    td.className = 'cell-date';
    const txt = fmtDateCompact(val);
    td.textContent = txt;
    td.title = txt;
    try { td.title = new Date(val).toLocaleString(); } catch {}
    return td;
  }
  function statusClass(s) {
    const key = String(s || '').toLowerCase();
    if (key === 'almacenado') return 'status-almacenado';
    if (key === 'en proceso') return 'status-en-proceso';
    if (key === 'detenido') return 'status-detenido';
    if (key === 'completado') return 'status-completado';
    return '';
  }
  function updateSelCount() {
    const el = document.getElementById('selCount');
    if (el) el.textContent = `${selected.size} seleccionados`;
  }
  function attachRowSelect(tr, id) {
    tr.dataset.id = String(id);
    tr.classList.add('row-clickable');
    tr.addEventListener('click', () => {
      if (window.getSelection()?.toString()) return;
      if (selected.has(id)) {
        selected.delete(id);
        tr.classList.remove('row-selected');
      } else {
        selected.add(id);
        tr.classList.add('row-selected');
      }
      updateSelCount();
    });
  }

  // Funciones de UI/flujo
  async function onOpenRegister() {
    if (btnOpenRegister) btnOpenRegister.disabled = true;
    try {
      const area = 'Deburr';
      const me = await window.api.auth.me();
      const usuarioId = me?.user?.UsuarioId || me?.user?.UserName;

      const res = await window.api.modal.openScanRegister({ area });
      if (res?.confirmed) {
        const { job, qty, piezasBuenas, piezasMalas } = res;
        const r = await window.api.jobProcess.scanRegister({ job, area, qty, usuarioId, piezasBuenas, piezasMalas });
        setMsg(`OK: Job ${job} registrado. Buenas ${piezasBuenas}, Scrap ${piezasMalas} (Total ${qty}). Id ${r?.Id ?? '?'}`);
        highlightId = r?.Id ?? null;
        await loadDeburrList();
        if (highlightId) setTimeout(() => { highlightId = null; }, 4000);
      }
    } catch (e) {
      setMsg(`Error: ${prettyError(e)}`);
    } finally {
      if (btnOpenRegister) btnOpenRegister.disabled = false;
    }
  }

  function openQtyModal({ title, max, defValue }) {
    return new Promise((resolve) => {
      const overlay = document.getElementById('qtyModal');
      const input = document.getElementById('qtyInput');
      const help = document.getElementById('qtyHelp');
      const err = document.getElementById('qtyError');
      const btnOk = document.getElementById('qtyOk');
      const btnCancel = document.getElementById('qtyCancel');
      const titleEl = document.getElementById('qtyTitle');

      if (!overlay || !input || !btnOk || !btnCancel || !help || !err || !titleEl) { resolve(null); return; }

      titleEl.textContent = title || 'Enviar a Calidad';
      input.value = String(defValue ?? max ?? 1);
      input.min = '1';
      if (Number.isFinite(max)) input.max = String(max);
      help.textContent = `Pendiente por enviar: ${max ?? '-'} pzas`;
      err.textContent = '';

      function cleanup(result) {
        overlay.hidden = true;
        overlay.setAttribute('aria-hidden', 'true');
        btnOk.removeEventListener('click', onOk);
        btnCancel.removeEventListener('click', onCancel);
        input.removeEventListener('keydown', onKey);
        document.removeEventListener('keydown', onEsc);
        resolve(result);
      }
      function onOk() {
        const v = parseInt(input.value, 10);
        const m = Number(max ?? 0);
        if (!Number.isInteger(v) || v < 1) { err.textContent = 'Cantidad inválida.'; return; }
        if (m > 0 && v > m) { err.textContent = `No puedes enviar ${v}. Máximo permitido: ${m}.`; return; }
        cleanup(v);
      }
      function onCancel() { cleanup(null); }
      function onKey(e) { if (e.key === 'Enter') { e.preventDefault(); onOk(); } }
      function onEsc(e) { if (e.key === 'Escape') { e.preventDefault(); onCancel(); } }

      btnOk.addEventListener('click', onOk);
      btnCancel.addEventListener('click', onCancel);
      input.addEventListener('keydown', onKey);
      document.addEventListener('keydown', onEsc);

      overlay.hidden = false;
      overlay.removeAttribute('aria-hidden');
      setTimeout(() => { input.focus(); input.select?.(); }, 0);
    });
  }

  async function onSendToQuality() {
    if (selected.size !== 1) { setMsg('Selecciona 1 registro para enviar a Calidad.'); return; }
    const id = Array.from(selected)[0];
    const row = lastRowsMap.get(id);
    if (!row) { setMsg('No se encontró el registro.'); return; }

    const pendiente = Number(row.PendientePorEnviar ?? 0);
    if (pendiente <= 0) { setMsg('No hay piezas pendientes por enviar a Calidad.'); return; }

    try {
      const qty = await openQtyModal({
        title: `Enviar a Calidad - Job ${row.Job}`,
        max: pendiente,
        defValue: pendiente,
      });
      if (qty == null) return;

      const me = await window.api.auth.me();
      const usuarioId = me?.user?.UsuarioId || me?.user?.UserName || 'system';
      await window.api.jobProcess.sendToQuality({ job: row.Job, qty, usuarioId });
      setMsg(`Enviado ${qty} pzas del Job ${row.Job} a Calidad.`);
      await loadDeburrList();
    } catch (e) {
      setMsg(`Error al enviar a Calidad: ${prettyError(e)}`);
    }
  }

  function renderRows(rows) {
    const tbody = document.getElementById('deburrTbody');
    tbody.innerHTML = '';
    lastRowsMap.clear();

    if (!rows || rows.length === 0) {
      tbody.innerHTML = `<tr><td class="center" colspan="13">Sin registros</td></tr>`;
      return;
    }

    let scrolled = false;

    for (const r of rows) {
      lastRowsMap.set(r.Id, r);
      const tr = document.createElement('tr');

      const tdEstatus = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = `badge ${statusClass(r.Estatus)}`;
      badge.textContent = r.Estatus ?? '';
      tdEstatus.appendChild(badge);

      const tdFechaReg = makeDateCell(r.FechaRegistro);
      const tdFechaAct = makeDateCell(r.FechaActualizacion);

      const cells = [
        r.Id,
        r.Job,
        r.PartNumber,
        { value: r.Descripcion, className: 'wrap' },
        r.Order_Qty,
        r.Area,
        r.PiezasBuenas ?? 0,
        r.PiezasMalas ?? 0,
        r.EnviadoCalidad ?? 0,
        r.PendientePorEnviar ?? 0,
        tdEstatus,
        tdFechaReg,
        tdFechaAct,
      ];

      for (const c of cells) {
        if (c instanceof HTMLElement) tr.appendChild(c);
        else {
          const td = document.createElement('td');
          if (typeof c === 'object' && c !== null && 'value' in c) {
            td.textContent = c.value ?? '';
            if (c.className) td.classList.add(c.className);
            td.title = String(c.value ?? '');
          } else {
            td.textContent = c ?? '';
            td.title = String(c ?? '');
          }
          tr.appendChild(td);
        }
      }

      if (selected.has(r.Id)) tr.classList.add('row-selected');
      attachRowSelect(tr, r.Id);

      if (highlightId && r.Id === highlightId && !scrolled) {
        tr.classList.add('row-highlight');
        setTimeout(() => tr.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
        scrolled = true;
      }

      tbody.appendChild(tr);
    }

    for (const id of Array.from(selected)) {
      if (!lastRowsMap.has(id)) selected.delete(id);
    }
    updateSelCount();
  }

  async function loadDeburrList() {
    try {
      const { statusList, areaList } = getFilters();
      const rows = await window.api.jobProcess.list({ statusList, areaList });
      renderRows(rows);
    } catch (e) {
      console.error('Error cargando Deburr:', e);
      setMsg(`No se pudieron cargar los registros: ${prettyError(e)}`);
      renderRows([]);
    }
  }

  async function bulkChange(newStatus) {
    if (selected.size === 0) { setMsg('Selecciona al menos un registro'); return; }
    if (newStatus === 'Completado') {
      setMsg('Completar solo puede hacerse en el área de Quality al recibir el material.');
      return;
    }
    try {
      const me = await window.api.auth.me();
      const usuarioId = me?.user?.UsuarioId || me?.user?.UserName || 'system';
      const items = Array.from(selected).map(id => {
        const r = lastRowsMap.get(id);
        return { job: r?.Job, area: r?.Area };
      }).filter(it => it.job && it.area);

      const res = await window.api.jobProcess.changeStatus({ items, newStatus, usuarioId });
      const ok = res?.affected ?? 0;
      const err = (res?.errors || []).length;
      setMsg(`Estatus actualizado a "${newStatus}" en ${ok} registro(s).${err ? ` Errores: ${err}.` : ''}`);
      await loadDeburrList();
    } catch (e) {
      setMsg(`Error al actualizar estatus: ${prettyError(e)}`);
    }
  }

  // Cableado de eventos después de definir funciones (evita ReferenceError)
  document.getElementById('btnLogout')?.addEventListener('click', async () => {
    await window.api.auth.logout();
    await window.api.app.openLogin();
  });
  btnOpenRegister?.addEventListener('click', onOpenRegister);
  btnDeburrRefresh?.addEventListener('click', loadDeburrList);
  btnInProc?.addEventListener('click', () => bulkChange('En proceso'));
  btnSendToQuality?.addEventListener('click', onSendToQuality);

  if (btnComplete) {
    btnComplete.disabled = true;
    btnComplete.title = 'Completar solo puede hacerse en el área de Quality al recibir el material.';
    btnComplete.addEventListener('click', () => {
      setMsg('Completar solo puede hacerse en el área de Quality al recibir el material.');
    });
  }

  // Primera carga
  await loadDeburrList();
});