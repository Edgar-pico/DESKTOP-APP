document.addEventListener('DOMContentLoaded', async () => {
  try {
    const me = await window.api.auth.me();
    document.getElementById('me').textContent =
      me?.user ? `Usuario: ${me.user.Nombre || me.user.UserName} | Área: ${me.user.Area || '-'}` : 'Sin sesión';
  } catch {}

 document.getElementById('btnLogout')?.addEventListener('click', async () => {
  await window.api.auth.logout();
  await window.api.app.openLogin(); // cierra esta ventana y abre login
});

  const btnOpenRegister = document.getElementById('btnOpenRegister'); // ← referenciar botón
  btnOpenRegister?.addEventListener('click', onOpenRegister);
  document.getElementById('btnDeburrRefresh')?.addEventListener('click', loadDeburrList);

  // Acciones masivas
  const btnInProc = document.getElementById('btnSetInProcess');
  const btnComplete = document.getElementById('btnSetComplete');

  btnInProc?.addEventListener('click', () => bulkChange('En proceso'));

  if (btnComplete) {
    btnComplete.disabled = true;
    btnComplete.title = 'Completar solo puede hacerse en el área de Quality al recibir el material.';
    btnComplete.addEventListener('click', () => {
      setMsg('Completar solo puede hacerse en el área de Quality al recibir el material.');
    });
  }

  let highlightId = null;
  const selected = new Set();
  const lastRowsMap = new Map();

  await loadDeburrList();

  // Limpia el mensaje de error de Electron y deja solo el contenido útil
  function prettyError(err) {
    const raw = String(err?.message || err || '');
    return raw
      .replace(/^Error invoking remote method '.*?':\s*/i, '') // quita prefijo de ipc
      .replace(/^Error:\s*/i, '')                               // quita doble "Error:"
      .trim();
  }

  async function onOpenRegister() {
  if (btnOpenRegister) btnOpenRegister.disabled = true;
  try {
    const area = 'Deburr';
    const me = await window.api.auth.me();
    const usuarioId = me?.user?.UsuarioId || me?.user?.UserName;

    const res = await window.api.modal.openScanRegister({ area });
    if (res?.confirmed) {
      const { job, qty, piezasBuenas, piezasMalas } = res;
      const r = await window.api.jobProcess.scanRegister({
        job, area, qty, usuarioId,
        piezasBuenas, piezasMalas, // NUEVO
      });
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

  function setMsg(t) {
    const el = document.getElementById('deburrMsg');
    if (el) el.textContent = t || '';
  }

  // Filtros fijos: solo Deburr y estatus Activos (Almacenado + En proceso)
  function getFilters() {
    return {
      statusList: ['Almacenado', 'En proceso'],
      areaList: ['Deburr'],
      areaSelected: 'Deburr',
    };
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
    td.textContent = fmtDateCompact(val);
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
    tr.addEventListener('click', (e) => {
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

  function renderRows(rows) {
    const tbody = document.getElementById('deburrTbody');
    tbody.innerHTML = '';
    lastRowsMap.clear();

    if (!rows || rows.length === 0) {
      tbody.innerHTML = `<tr><td class="center" colspan="10">Sin registros</td></tr>`;
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
        r.Descripcion,
        r.Order_Qty,
        r.Area,
        r.Qty_Real_Ingresada,
        tdEstatus,
        tdFechaReg,
        tdFechaAct,
      ];

      for (const c of cells) {
        if (c instanceof HTMLElement) tr.appendChild(c);
        else {
          const td = document.createElement('td');
          td.textContent = c ?? '';
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

    // Limpia selección de ids que ya no existen
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
    if (selected.size === 0) {
      setMsg('Selecciona al menos un registro');
      return;
    }
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

      const res = await window.api.jobProcess.changeStatus({
        items,
        newStatus,
        usuarioId,
      });

      const ok = res?.affected ?? 0;
      const err = (res?.errors || []).length;
      setMsg(`Estatus actualizado a "${newStatus}" en ${ok} registro(s).${err ? ` Errores: ${err}.` : ''}`);
      await loadDeburrList();
    } catch (e) {
      setMsg(`Error al actualizar estatus: ${prettyError(e)}`);
    }
  }

  // No hay filtros, dejamos el helper por compatibilidad (no se usa)
  let t;
  function loadQuick() {
    clearTimeout(t);
    t = setTimeout(loadDeburrList, 200);
  }
});