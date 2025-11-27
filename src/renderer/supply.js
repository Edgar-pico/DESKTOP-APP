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

  document.getElementById('btnRefresh')?.addEventListener('click', loadList);
  document.getElementById('selStatus')?.addEventListener('change', quickLoad);
  document.getElementById('selArea')?.addEventListener('change', quickLoad);

  await loadList();

  function setMsg(t) {
    const el = document.getElementById('supplyMsg');
    if (el) el.textContent = t || '';
  }

 // getFilters: incluir 'Retrabajo' en el grupo 'activos' por defecto
function getFilters() {
  const sVal = document.getElementById('selStatus').value;
  const aVal = document.getElementById('selArea').value;
  // ahora "activos" incluye Retrabajo también para que Supply vea reworks
  const statusMap = { activos: ['Almacenado', 'En proceso', 'Retrabajo'], todos: [] };
  const areaMap = { todas: [] };

  const statusList = statusMap[sVal] ?? [sVal];
  const areaList = aVal in areaMap ? areaMap[aVal] : [aVal];
  return { statusList, areaList };
}

  function fmtDate(val) {
    if (val == null) return '';
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    const pad = (n) => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
 // statusClass: añadir mapeo para 'Retrabajo'
function statusClass(s) {
  const key = String(s || '').toLowerCase();
  if (key === 'almacenado') return 'status-almacenado';
  if (key === 'en proceso') return 'status-en-proceso';
  if (key === 'detenido') return 'status-detenido';
  if (key === 'completado') return 'status-completado';
  if (key === 'retrabajo') return 'status-rework'; // <-- nuevo
  return 'status-default';
}

  // renderRows: priorizar IsRework para badge/estatus
function renderRows(rows) {
  const tbody = document.getElementById('supplyTbody');
  tbody.innerHTML = '';
  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td class="center" colspan="15">Sin registros</td></tr>`;
    return;
  }

  for (const r of rows) {
    const tr = document.createElement('tr');

    // Buenas/Scrap visibles por área
    const buenas = r.Area === 'Deburr'
      ? (r.PiezasBuenas ?? 0)
      : ((r.QC_Aceptadas ?? r.PiezasBuenas ?? 0));
    const scrapQa = r.Area === 'Deburr'
      ? (r.PiezasMalas ?? 0)
      : ((r.QC_Scrap ?? r.PiezasMalas ?? 0));

    // Scrap Deburr: preferimos el valor inicial declarado en Deburr; fallback a PiezasMalas si es fila Deburr
    const scrapDeburr = (r.Deburr_ScrapInicial != null)
      ? r.Deburr_ScrapInicial
      : (r.Area === 'Deburr' ? (r.PiezasMalas ?? 0) : 0);

    // Pendiente por enviar: solo el campo clásico (visible en Deburr)
    const penEnviar = r.PendientePorEnviar ?? 0;

    // Badge: priorizar IsRework (si existe)
    const tdStatus = document.createElement('td');
    const badge = document.createElement('span');
    const isRework = !!r.IsRework;
    const estText = isRework ? 'Retrabajo' : (r.Estatus ?? '');
    badge.className = `badge ${statusClass(estText)}`;
    badge.textContent = estText;
    tdStatus.appendChild(badge);

    const cells = [
      r.Id,
      r.Job,
      r.PartNumber,
      r.Descripcion,
      r.Order_Qty,
      r.Area,
      r.TargetMachine,
      buenas,
      scrapQa,
      scrapDeburr,
      r.EnviadoCalidad ?? 0,
      penEnviar,
      r.QC_PendienteInspeccion ?? 0,
      tdStatus,
      fmtDate(r.FechaRegistro),
      fmtDate(r.FechaActualizacion),
    ];

    for (const c of cells) {
      const td = document.createElement('td');
      if (c instanceof HTMLElement) {
        td.appendChild(c);
      } else {
        const text = c ?? '';
        td.textContent = text;
        td.title = String(text);
      }
      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }
}

  async function loadList() {
    try {
      const { statusList, areaList } = getFilters();
      const rows = await window.api.jobProcess.list({ statusList, areaList });
      renderRows(rows);
    } catch (e) {
      console.error('Supply load error:', e);
      setMsg(`No se pudieron cargar los registros: ${e?.message || e}`);
      renderRows([]);
    }
  }
  let t; function quickLoad(){ clearTimeout(t); t = setTimeout(loadList, 200); }
});