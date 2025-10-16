document.addEventListener('DOMContentLoaded', async () => {
    try {
        const ping = await window.api.ping();
        console.log('Conexion exitosa',ping); // Debería imprimir 'pong'
        if (ping) {
            const materials = await window.api.getMaterials();
            console.table(materials);
        }
    } catch (error) {
        console.error('Error al conectar con la base de datos:', error);
    }
});

const esc = s => String(s ?? '');

function render(rows) {
  const tb = document.querySelector('#vmTable tbody');
  if (!tb) return;

  if (!Array.isArray(rows) || rows.length === 0) {
    tb.innerHTML = '<tr><td colspan="12">Sin resultados</td></tr>';
    return;
  }

  tb.innerHTML = rows.map(r => `
    <tr>
      <td>${esc(r.PartNumber)}</td>
      <td>${esc(r.Description)}</td>
      <td>${esc(r.Primary_Vendor)}</td>
      <td>${esc(r['Quantity_Per/s'])}</td>
      <td>${esc(r.Minimum)}</td>
      <td>${esc(r.Total_On_Hand_Qty)}</td>
      <td>${esc(r.Maximum)}</td>
      <td>${esc(r.ToMax)}</td>
      <td>${esc(r.Family)}</td>
      <td>${esc(r.WorkCenter)}</td>
      <td>${esc(r.Buyer)}</td>
      <td>${esc(r.Status)}</td>
    </tr>
  `).join('');
}

async function loadInitial(){
  document.getElementById('status').textContent = 'Cargando...';
  const rows = await window.api.vMaterialsList({ top: 100, search: null }); // 👈 sin 'term'
  render(rows);
  document.getElementById('status').textContent = `Mostrando ${rows.length}`;
}

async function onSearch(){
  const term = document.getElementById('search').value.trim();
  document.getElementById('status').textContent = 'Buscando...';
  const rows = await window.api.vMaterialsList({ top: 100, search: term || null });
  render(rows);
  document.getElementById('status').textContent = `Mostrando ${rows.length}`;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnSearch')?.addEventListener('click', onSearch);
  loadInitial();
});

const information = document.getElementById('info')
information.innerText = `This app is using Chrome (v${window.api.chrome()}), Node.js (v${window.api.node()}), and Electron (v${window.api.electron()})`


const func = async () => {
  const response = await window.api.ping()
  console.log(response) // prints out 'pong'
}

func()