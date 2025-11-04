document.addEventListener('DOMContentLoaded', async () => {
  const btnRegister = document.getElementById('btnRegister');
  const btnRefresh = document.getElementById('btnRefresh');
  const btnLogout = document.getElementById('btnLogout');
  const meEl = document.getElementById('me');
  const msg = document.getElementById('maquiMsg');
  const tbody = document.getElementById('maquiTbody');

  function setMsg(t){ if(msg) msg.textContent = t || ''; }

  // Mostrar usuario en la cabecera (igual que otras vistas)
  try {
    const me = await window.api.auth.me();
    if (me?.user) {
      meEl.textContent = `Usuario: ${me.user.Nombre || me.user.UserName} | Área: ${me.user.Area || '-'}`;
    } else {
      meEl.textContent = 'Sin sesión';
    }
  } catch (e) {
    meEl.textContent = 'Sin sesión';
  }

  // Logout: reutiliza el handler estándar
  btnLogout?.addEventListener('click', async () => {
    try {
      await window.api.auth.logout();
      await window.api.app.openLogin();
    } catch (e) {
      setMsg(`Error al cerrar sesión: ${String(e)}`);
    }
  });

  // Registrar Job: reusar el modal de registro ya usado por Deburr/Quality
  btnRegister?.addEventListener('click', async () => {
    try {
      const me = await window.api.auth.me();
      const usuarioId = me?.user?.UsuarioId || me?.user?.UserName || 'system';
      // Abrir modal (el modal devolverá un objeto con confirmed, job, qty, piezasBuenas, piezasMalas)
      const res = await window.api.modal.openScanRegister({ area: 'Maquinados' });
      if (!res?.confirmed) return;
      setMsg('Registrando...');
      await window.api.jobProcess.scanRegister({
        job: res.job,
        area: 'Maquinados',
        qty: Number(res.qty) || (Number(res.piezasBuenas || 0) + Number(res.piezasMalas || 0)),
        usuarioId,
        piezasBuenas: Number(res.piezasBuenas || 0),
        piezasMalas: Number(res.piezasMalas || 0),
      });
      setMsg('Registrado');
      await loadList();
    } catch (e) {
      setMsg(String(e));
    }
  });

  btnRefresh?.addEventListener('click', loadList);

  async function loadList(){
    try {
      setMsg('');
      const rows = await window.api.jobProcess.list({ statusList:['Almacenado','En proceso'], areaList:['Maquinados'] });
      tbody.innerHTML = '';
      if (!rows || !rows.length) { tbody.innerHTML = `<tr><td class="center" colspan="10">Sin registros</td></tr>`; return; }
      for(const r of rows){
        const tr = document.createElement('tr');
        // allow selection style if needed later
        tr.classList.add('row-clickable');
        tr.addEventListener('click', () => {
          tr.classList.toggle('row-selected');
        });
        const cells = [
          r.Id,
          r.Job,
          r.PartNumber,
          r.Descripcion,
          r.Order_Qty,
          r.Area,
          r.PiezasBuenas ?? 0,
          r.PiezasMalas ?? 0,
          r.Estatus ?? '',
          fmtDate(r.FechaRegistro)
        ];
        for(const c of cells){
          const td = document.createElement('td');
          td.textContent = c ?? '';
          td.title = String(c ?? '');
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
    } catch (e) {
      tbody.innerHTML = `<tr><td class="center" colspan="10">Error: ${e?.message||e}</td></tr>`;
    }
  }

  function fmtDate(val) {
    if (val == null) return '';
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    const pad = (n) => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // Primera carga
  await loadList();
});