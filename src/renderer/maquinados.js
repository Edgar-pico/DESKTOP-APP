document.addEventListener('DOMContentLoaded', async () => {
  const btnRegister = document.getElementById('btnRegister');
  const btnRefresh = document.getElementById('btnRefresh');
  const msg = document.getElementById('maquiMsg');
  const tbody = document.getElementById('maquiTbody');

  function setMsg(t){ if(msg) msg.textContent = t || ''; }

  btnRegister?.addEventListener('click', async () => {
    // Abrir modal similar al Deburr scanRegister (puedes reuse modal or implement quick prompt)
    const job = prompt('Job a registrar en Maquinados:');
    if (!job) return;
    const ok = parseInt(prompt('Buenas (OK):','0') || '0',10);
    const ng = parseInt(prompt('Scrap (NO OK):','0') || '0',10);
    const me = await window.api.auth.me();
    const usuarioId = me?.user?.UsuarioId || me?.user?.UserName || 'system';
    try {
      await window.api.jobProcess.scanRegister({ job, area: 'Maquinados', qty: ok + ng, usuarioId, piezasBuenas: ok, piezasMalas: ng });
      setMsg('Registrado');
      await loadList();
    } catch (e) { setMsg(String(e)); }
  });

  btnRefresh?.addEventListener('click', loadList);

  async function loadList(){
    try {
      const rows = await window.api.jobProcess.list({ statusList:['Almacenado','En proceso'], areaList:['Maquinados'] });
      tbody.innerHTML = '';
      if (!rows.length) { tbody.innerHTML = `<tr><td class="center" colspan="10">Sin registros</td></tr>`; return; }
      for(const r of rows){
        const tr = document.createElement('tr');
        const cells = [r.Id, r.Job, r.PartNumber, r.Descripcion, r.Order_Qty, r.Area, r.PiezasBuenas ?? 0, r.PiezasMalas ?? 0, r.Estatus ?? '', (new Date(r.FechaRegistro)).toLocaleString()];
        for(const c of cells){ const td = document.createElement('td'); td.textContent = c ?? ''; tr.appendChild(td); }
        tbody.appendChild(tr);
      }
    } catch (e) {
      tbody.innerHTML = `<tr><td class="center" colspan="10">Error: ${e?.message||e}</td></tr>`;
    }
  }

  await loadList();
});