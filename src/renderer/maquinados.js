document.addEventListener('DOMContentLoaded', async () => {
  const btnCapture = document.getElementById('btnCapture');
  const btnInProcess = document.getElementById('btnInProcess');
  const btnSendDeburr = document.getElementById('btnSendDeburr');
  const btnRefresh = document.getElementById('btnRefresh');
  const btnLogout = document.getElementById('btnLogout');
  const meEl = document.getElementById('me');
  const msg = document.getElementById('maquiMsg');
  const tbody = document.getElementById('maquiTbody');

  function setMsg(t){ if(msg) msg.textContent = t || ''; }
  function fmtDate(val) {
    if (val == null) return '';
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    const pad = (n) => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  let selected = new Set(); // guarda Jobs seleccionados (por Job)

  function renderRows(rows){
    tbody.innerHTML = '';
    if (!rows || !rows.length) { tbody.innerHTML = `<tr><td class="center" colspan="12">Sin registros</td></tr>`; return; }
    for(const r of rows){
      const tr = document.createElement('tr');

      const selTd = document.createElement('td');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = selected.has(r.Job);
      cb.addEventListener('change', () => {
        if (cb.checked) selected.add(r.Job); else selected.delete(r.Job);
      });
      selTd.appendChild(cb);

      const cells = [
        selTd,
        r.Id,
        r.Job,
        r.PartNumber,
        r.Descripcion,
        r.Order_Qty,
        r.TargetMachine || '', // puede venir null si la columna no existe
        r.Area,
        r.PiezasBuenas ?? 0,
        r.PiezasMalas ?? 0,
        r.Estatus ?? '',
        fmtDate(r.FechaRegistro)
      ];

      for(const c of cells){
        const td = document.createElement('td');
        if (c instanceof HTMLElement) td.appendChild(c); else { td.textContent = c ?? ''; td.title = String(c ?? ''); }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
  }

  async function loadList(){
    try {
      setMsg('');
      selected.clear();
      const rows = await window.api.jobProcess.list({ statusList:['Almacenado','En proceso'], areaList:['Maquinados'] });
      renderRows(rows);
    } catch (e) {
      tbody.innerHTML = `<tr><td class="center" colspan="12">Error: ${e?.message||e}</td></tr>`;
    }
  }

  // Mostrar usuario
  try {
    const me = await window.api.auth.me();
    if (me?.user) {
      meEl.textContent = `Usuario: ${me.user.Nombre || me.user.UserName} | Área: ${me.user.Area || '-'}`;
    } else {
      meEl.textContent = 'Sin sesión';
    }
  } catch { meEl.textContent = 'Sin sesión'; }

  // Logout
  btnLogout?.addEventListener('click', async () => {
    try { await window.api.auth.logout(); await window.api.app.openLogin(); }
    catch (e) { setMsg(`Error al cerrar sesión: ${String(e)}`); }
  });

  // Capturar producción (buenas/scrap) para el Job seleccionado (uno)
  btnCapture?.addEventListener('click', async () => {
    try {
      if (selected.size !== 1) { setMsg('Selecciona un (1) Job para capturar.'); return; }
      const job = Array.from(selected)[0];
      const buenas = parseInt(prompt('Buenas (OK):','0') || '0', 10);
      const malas  = parseInt(prompt('Scrap (NO OK):','0') || '0', 10);
      if (isNaN(buenas) || buenas < 0 || isNaN(malas) || malas < 0) { setMsg('Valores inválidos'); return; }
      const me = await window.api.auth.me();
      const usuarioId = me?.user?.UsuarioId || me?.user?.UserName || 'system';
      setMsg('Guardando...');
      await window.api.jobProcess.machiningCapture({ job, buenas, malas, usuarioId });
      setMsg('Producción capturada.');
      await loadList();
    } catch (e) {
      setMsg(`Error: ${e?.message || e}`);
    }
  });

  // Poner en proceso (puede aceptar múltiples seleccionados)
  btnInProcess?.addEventListener('click', async () => {
    try {
      if (selected.size < 1) { setMsg('Selecciona al menos un Job'); return; }
      const items = Array.from(selected).map(job => ({ job, area: 'Maquinados' }));
      const me = await window.api.auth.me();
      const usuarioId = me?.user?.UsuarioId || me?.user?.UserName || 'system';
      setMsg('Actualizando estatus...');
      const res = await window.api.jobProcess.changeStatus({ newStatus: 'En proceso', usuarioId, items });
      if (res?.errors?.length) setMsg(`Hecho con errores: ${res.errors.length}`); else setMsg('Actualizado');
      await loadList();
    } catch (e) {
      setMsg(`Error: ${e?.message || e}`);
    }
  });

  // Enviar a Deburr (solo buenas) para un Job seleccionado
  btnSendDeburr?.addEventListener('click', async () => {
    try {
      if (selected.size !== 1) { setMsg('Selecciona un (1) Job'); return; }
      const qty = parseInt(prompt('Cantidad a enviar a Deburr (Buenas):','0') || '0', 10);
      if (!Number.isInteger(qty) || qty < 1) { setMsg('Cantidad inválida'); return; }
      const job = Array.from(selected)[0];
      const me = await window.api.auth.me();
      const usuarioId = me?.user?.UsuarioId || me?.user?.UserName || 'system';
      setMsg('Enviando...');
      await window.api.jobProcess.sendToDeburrFromMaquinados({ job, qty, usuarioId });
      setMsg('Enviado.');
      await loadList();
    } catch (e) {
      setMsg(`Error: ${e?.message || e}`);
    }
  });

  btnRefresh?.addEventListener('click', loadList);

  await loadList();
});