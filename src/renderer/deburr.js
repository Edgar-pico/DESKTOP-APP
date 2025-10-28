document.addEventListener('DOMContentLoaded', async () => {
  try {
    const me = await window.api.auth.me();
    document.getElementById('me').textContent =
      me?.user ? `Usuario: ${me.user.Nombre || me.user.UserName} | Área: ${me.user.Area || '-'}` : 'Sin sesión';
  } catch {}

  document.getElementById('btnLogout')?.addEventListener('click', async () => {
    await window.api.auth.logout();
    await window.api.app.openLogin();
  });

  document.getElementById('btnOpenRegister')?.addEventListener('click', onOpenRegister);
  document.getElementById('btnDeburrRefresh')?.addEventListener('click', loadDeburrList);

  document.getElementById('selStatus')?.addEventListener('change', loadQuick);
  document.getElementById('selArea')?.addEventListener('change', loadQuick);

  await loadDeburrList();

  async function onOpenRegister() {
    try {
      const me = await window.api.auth.me();
      const area = me?.user?.Area || 'Deburr';
      const usuarioId = me?.user?.UsuarioId || me?.user?.UserName;

      const res = await window.api.modal.openScanRegister({ area });
      if (res?.confirmed) {
        const { job, qty } = res;
        const r = await window.api.jobProcess.scanRegister({ job, area, qty, usuarioId });
        setMsg(`OK: Job ${job} registrado con Qty ${qty} (Id ${r?.Id ?? '?'})`);
        await loadDeburrList(); // refresco automático tras registrar
      }
    } catch (e) {
      setMsg(`Error: ${e?.message || e}`);
    }
  }

  function setMsg(t) {
    const el = document.getElementById('deburrMsg');
    if (el) el.textContent = t || '';
  }

  function getFilters() {
    const sVal = document.getElementById('selStatus').value;
    const aVal = document.getElementById('selArea').value;

    const statusMap = { activos: ['Almacenado', 'En proceso'], todos: [] };
    const areaMap = { todas: [] };

    const statusList = statusMap[sVal] ?? [sVal];
    const areaList = aVal in areaMap ? areaMap[aVal] : [aVal];

    return { statusList, areaList };
  }

  // Fecha compacta para que no choque. Tooltip con fecha completa.
  function fmtDateCompact(val) {
    if (val == null) return '';
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    const pad = (n) => String(n).padStart(2, '0');
    // YYYY-MM-DD HH:mm (sin segundos, sin AM/PM para hacerla más corta)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function makeDateCell(val) {
    const td = document.createElement('td');
    td.className = 'cell-date';
    td.textContent = fmtDateCompact(val);
    // Tooltip con la fecha local completa
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

  function renderRows(rows) {
    const tbody = document.getElementById('deburrTbody');
    tbody.innerHTML = '';

    if (!rows || rows.length === 0) {
      tbody.innerHTML = `<tr><td class="center" colspan="10">Sin registros</td></tr>`;
      return;
    }

    for (const r of rows) {
      const tr = document.createElement('tr');

      // Badge de estatus
      const tdEstatus = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = `badge ${statusClass(r.Estatus)}`;
      badge.textContent = r.Estatus ?? '';
      tdEstatus.appendChild(badge);

      // Fechas como celdas con clase .cell-date
      const tdFechaReg = makeDateCell(r.FechaRegistro);
      const tdFechaAct = makeDateCell(r.FechaActualizacion);

      const cells = [
        // Si ocultaste Id, inicia con Job; mantengo el orden de tu UI
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

      tbody.appendChild(tr);
    }
  }

  async function loadDeburrList() {
    try {
      const { statusList, areaList } = getFilters();
      const rows = await window.api.jobProcess.list({ statusList, areaList });
      renderRows(rows);
    } catch (e) {
      console.error('Error cargando Deburr:', e);
      setMsg(`No se pudieron cargar los registros: ${e?.message || e}`);
      renderRows([]);
    }
  }

  let t;
  function loadQuick() {
    clearTimeout(t);
    t = setTimeout(loadDeburrList, 200);
  }
});