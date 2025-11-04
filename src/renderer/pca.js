document.addEventListener('DOMContentLoaded', async () => {
  const jobScan = document.getElementById('jobScan');
  const btnLookup = document.getElementById('btnLookup');
  const selMachine = document.getElementById('selMachine');
  const btnAssign = document.getElementById('btnAssign');
  const btnRefresh = document.getElementById('btnRefresh');
  const pcaMsg = document.getElementById('pcaMsg');
  const tbody = document.getElementById('pcaTbody');

  function setMsg(t){ if(pcaMsg) pcaMsg.textContent = t || ''; }

  // Cargar lista de máquinas (puedes reemplazar por llamada a API/erp)
  const machines = ['MILLAC1','MILLAC2','MILLAC3','DOOSAN1','DOOSAN2','ROUTER','VF3'];
  machines.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m; opt.textContent = m; selMachine.appendChild(opt);
  });

  btnLookup?.addEventListener('click', async () => {
    const job = String(jobScan.value || '').trim();
    if (!job) { setMsg('Job requerido'); return; }
    try {
      setMsg('Buscando en ERP...');
      const info = await window.api.erp.getJobInfo(job); // requiere handler erp:getJobInfo
      // mostrar info breve (puedes diseñar mejor)
      setMsg(info?.PartNumber ? `Encontrado: ${info.PartNumber} - ${info.Description}` : 'No encontrado');
    } catch (e) {
      setMsg(String(e));
    }
  });

  btnAssign?.addEventListener('click', async () => {
    const job = String(jobScan.value || '').trim();
    const machine = String(selMachine.value || '').trim();
    const me = await window.api.auth.me();
    const usuarioId = me?.user?.UsuarioId || me?.user?.UserName || 'system';
    if (!job || !machine) { setMsg('Job y máquina requeridos'); return; }
    try {
      setMsg('Asignando...');
      const res = await window.api.jobProcess.assignToMachine({ job, machine, usuarioId, qty: 0 });
      if (res?.ok) { setMsg('Asignado'); await loadList(); } else setMsg('Error asignando');
    } catch (e) { setMsg(String(e)); }
  });

  btnRefresh?.addEventListener('click', loadList);

  async function loadList(){
    try {
      const rows = await window.api.jobProcess.list({ statusList: ['Almacenado','En proceso','Retrabajo'], areaList: ['PCA'] });
      renderRows(rows);
    } catch (e) {
      tbody.innerHTML = `<tr><td class="center" colspan="10">Error: ${e?.message||e}</td></tr>`;
    }
  }

  function renderRows(rows){
    tbody.innerHTML = '';
    if (!rows || !rows.length) { tbody.innerHTML = `<tr><td class="center" colspan="10">Sin registros</td></tr>`; return; }
    for(const r of rows){
      const tr = document.createElement('tr');
      const cells = [
        r.Id, r.Job, r.PartNumber, r.Descripcion, r.Order_Qty,
        r.Area, r.PiezasBuenas ?? 0, r.TargetMachine ?? '', r.Estatus ?? '', (new Date(r.FechaRegistro)).toLocaleString()
      ];
      for(const c of cells){
        const td = document.createElement('td'); td.textContent = c ?? ''; tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
  }

  await loadList();
});