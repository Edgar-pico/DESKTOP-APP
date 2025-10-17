(function () {
  const $ = (id) => document.getElementById(id);
  const $job = $('job');
  const $btnBuscar = $('btnBuscar');
  const $btnAceptar = $('btnAceptar');
  const $btnCancelar = $('btnCancelar');
  const $jobMsg = $('jobMsg');
  const $info = $('info');
  const $datos = $('datos');
  const $vJob = $('vJob');
  const $vPart = $('vPart');
  const $vDesc = $('vDesc');
  const $vOrderQty = $('vOrderQty');
  const $vStatus = $('vStatus');
  const $qty = $('qty');
  const $qtyMsg = $('qtyMsg');

  let init = { area: 'Deburr' };
  let preview = null; // { Job, Part_Number, Description, Order_Quantity, Status }

  function setPreview(info) {
    preview = info || null;
    if (!info) {
      $datos.style.display = 'none';
      $info.textContent = 'Capture el Job y presione Buscar.';
      $btnAceptar.disabled = true;
      return;
    }
    $datos.style.display = '';
    $info.textContent = '';
    $vJob.textContent = info.Job || '';
    $vPart.textContent = info.Part_Number || '';
    $vDesc.textContent = info.Description || '';
    $vOrderQty.textContent = Number.isInteger(info.Order_Quantity) ? info.Order_Quantity : '';
    $vStatus.textContent = info.Status || '';
    if (Number.isInteger(info.Order_Quantity) && info.Order_Quantity > 0) {
      $qty.max = String(info.Order_Quantity);
    } else {
      $qty.removeAttribute('max');
    }
    $qty.value = '1';
    $qty.focus();
    $qty.select?.();
    validate();
  }

  function validate() {
    $jobMsg.textContent = '';
    $qtyMsg.textContent = '';
    let ok = true;

    const job = $job.value.trim();
    if (!job) { ok = false; }

    if (!preview) { ok = false; }

    const qty = parseInt($qty.value, 10);
    if (!Number.isInteger(qty) || qty < 1) {
      $qtyMsg.textContent = 'Cantidad debe ser entero ≥ 1.';
      ok = false;
    }
    if (preview && Number.isInteger(preview.Order_Quantity) && qty > preview.Order_Quantity) {
      $qtyMsg.textContent = `No puede exceder Order_Qty (${preview.Order_Quantity}).`;
      ok = false;
    }
    if (preview && preview.Status && String(preview.Status).toLowerCase() !== 'active') {
      $jobMsg.textContent = `El Job no está Active (Status: ${preview.Status}).`;
      ok = false;
    }

    $btnAceptar.disabled = !ok;
    return ok;
  }

  async function buscar() {
    const job = $job.value.trim();
    setPreview(null);
    if (!job) {
      $jobMsg.textContent = 'Capture un Job.';
      return;
    }
    try {
      $info.textContent = 'Buscando en ERP...';
      const info = await window.modal.getJobInfo(job); // requiere handler en main
      if (!info) {
        $info.textContent = 'Job no encontrado.';
        $btnAceptar.disabled = true;
        return;
      }
      // Normaliza la propiedad Job para mostrarla
      info.Job = info.Job || job;
      setPreview(info);
    } catch (e) {
      console.error('Error getJobInfo:', e);
      $info.textContent = 'No se pudo consultar el ERP.';
      $btnAceptar.disabled = true;
    }
  }

  window.modal.onInit((data) => {
    init = { ...init, ...(data || {}) };
    $job.focus();
    $job.select?.();
  });

  $btnBuscar.addEventListener('click', buscar);
  $job.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); buscar(); }
  });

  $qty.addEventListener('input', () => {
    let v = parseInt($qty.value, 10);
    if (!Number.isInteger(v) || v < 1) v = 1;
    const max = $qty.max ? parseInt($qty.max, 10) : undefined;
    if (Number.isInteger(max) && v > max) v = max;
    if (String(v) !== $qty.value) $qty.value = String(v);
    validate();
  });
  $qty.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (validate()) $btnAceptar.click();
    }
  });

  $btnAceptar.addEventListener('click', () => {
    if (!validate()) return;
    window.modal.accept({
      job: $job.value.trim(),
      qty: parseInt($qty.value, 10),
    });
  });
  $btnCancelar.addEventListener('click', () => window.modal.cancel());
})();