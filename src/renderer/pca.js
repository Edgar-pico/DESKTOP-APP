document.addEventListener('DOMContentLoaded', async () => {
  const inputJob    = document.getElementById('inputJob');
  const selMachine  = document.getElementById('selMachine');
  const btnSearch   = document.getElementById('btnSearch');
  const btnAssign   = document.getElementById('btnAssign');
  const btnRefresh  = document.getElementById('btnRefresh');
  const btnLogout   = document.getElementById('btnLogout');   // <-- agregado
  const msgEl       = document.getElementById('statusMsg');
  const tbody       = document.getElementById('tblBody');
  const fltRadios   = document.querySelectorAll('input[name="fltMode"]');

  const msg = (t='') => { if (msgEl) msgEl.textContent = t; };

  let me = null;
  try { me = await window.api.auth.me(); } catch {}

  function isToday(isoOrDate) {
    const d = new Date(isoOrDate);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth() && d.getDate()===now.getDate();
  }

  function fmtDate(val) {
    if (val == null) return '';
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    const pad = (n) => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function currentFilter() {
    const r = Array.from(fltRadios).find(x => x.checked);
    return r ? r.value : 'all';
  }

  function applyFilter(rows) {
    const mode = currentFilter();
    const job = inputJob?.value?.trim();
    if (mode === 'byJob' && job) {
      return rows.filter(r => String(r.Job) === job);
    }
    if (mode === 'mineToday') {
      const myId = me?.user?.UsuarioId || me?.user?.UserName || '';
      return rows.filter(r => String(r.UsuarioId||'') === String(myId) && isToday(r.FechaRegistro));
    }
    return rows; // all
  }

  function render(rows) {
    tbody.innerHTML = '';
    if (!rows || rows.length === 0) { tbody.innerHTML = '<tr><td colspan="10">Sin registros</td></tr>'; return; }
    for (const r of rows) {
      const tr = document.createElement('tr');
      const cells = [
        r.Id, r.Job, r.PartNumber, r.Descripcion, r.Order_Qty, r.Area,
        r.PiezasBuenas ?? 0, r.TargetMachine ?? '', r.Estatus ?? '', fmtDate(r.FechaRegistro)
      ];
      for (const c of cells) {
        const td = document.createElement('td'); td.textContent = c ?? ''; tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
  }

  async function loadAll() {
    msg('Cargando...');
    try {
      // Trae todos los JobProcess activos de Maquinados; la UI decide cómo filtrarlos
      const rows = await window.api.jobProcess.list({ areaList:['Maquinados'], statusList:['Almacenado','En proceso'] });
      render(applyFilter(rows));
      msg('');
    } catch (e) {
      msg(`Error: ${e?.message || e}`);
      tbody.innerHTML = `<tr><td colspan="10">Error: ${e?.message || e}</td></tr>`;
    }
  }

  btnSearch?.addEventListener('click', async () => {
    const job = inputJob?.value?.trim();
    if (!job) { msg('Captura un Job'); return; }
    try {
      msg('Buscando en ERP...');
      const info = await window.api.erp.getJobInfo(job);
      if (!info || !info.Part_Number) { msg('No encontrado'); return; }
      msg(`Encontrado: PN ${info.Part_Number} | Qty ${info.Order_Quantity} | ${info.Status}`);
    } catch (e) {
      msg(`Error ERP: ${e?.message || e}`);
    }
  });

  btnAssign?.addEventListener('click', async () => {
    const job = inputJob?.value?.trim();
    const machine = selMachine?.value?.trim();
    if (!job) { msg('Job requerido'); return; }
    if (!machine) { msg('Máquina requerida'); return; }
    try {
      const me2 = await window.api.auth.me();
      const usuarioId = me2?.user?.UsuarioId || me2?.user?.UserName || 'system';
      msg('Surtiendo a Maquinados...');
      await window.api.jobProcess.pcaSupplyToMachining({ job, machine, usuarioId });
      msg(`Surtido a Maquinados. Máquina: ${machine}`);
      await loadAll();
    } catch (e) {
      msg(`Error: ${e?.message || e}`);
    }
  });

  btnRefresh?.addEventListener('click', loadAll);
  fltRadios.forEach(r => r.addEventListener('change', loadAll));

  // Cerrar sesión (FIX)
  btnLogout?.addEventListener('click', async () => {
    try {
      await window.api.auth.logout();
      await window.api.app.openLogin();
    } catch (e) {
      msg(`Error al cerrar sesión: ${e?.message || e}`);
    }
  });

  await loadAll();
});