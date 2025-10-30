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

  // NUEVOS
  const $qtyOk = $('qtyOk');
  const $qtyScrap = $('qtyScrap');
  const $vTotal = $('vTotal');
  const $qtyMsg = $('qtyMsg');

  let init = { area: 'Deburr' };
  let preview = null; // { Job, Part_Number, Description, Order_Quantity, Status }

  function total() {
    const ok = parseInt($qtyOk.value, 10);
    const ng = parseInt($qtyScrap.value, 10);
    return (Number.isInteger(ok) ? ok : 0) + (Number.isInteger(ng) ? ng : 0);
  }

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

    // Defaults
    $qtyOk.value = '1';
    $qtyScrap.value = '0';
    $vTotal.textContent = '1';
    validate();
    $qtyOk.focus();
    $qtyOk.select?.();
  }

  function validate() {
    $jobMsg.textContent = '';
    $qtyMsg.textContent = '';
    let ok = true;

    const job = $job.value.trim();
    if (!job) ok = false;
    if (!preview) ok = false;

    const vOk = parseInt($qtyOk.value, 10);
    const vNg = parseInt($qtyScrap.value, 10);
    const sum = (Number.isInteger(vOk) ? vOk : 0) + (Number.isInteger(vNg) ? vNg : 0);
    $vTotal.textContent = String(sum);

    if (!Number.isInteger(vOk) || vOk < 0) { $qtyMsg.textContent = 'Buenas debe ser ≥ 0.'; ok = false; }
    else if (!Number.isInteger(vNg) || vNg < 0) { $qtyMsg.textContent = 'Scrap debe ser ≥ 0.'; ok = false; }
    else if (sum <= 0) { $qtyMsg.textContent = 'El total debe ser > 0.'; ok = false; }

    if (preview && Number.isInteger(preview.Order_Quantity) && sum > preview.Order_Quantity) {
      $qtyMsg.textContent = `Total no puede exceder Order_Qty (${preview.Order_Quantity}).`;
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
    if (!job) { $jobMsg.textContent = 'Capture un Job.'; return; }
    try {
      $info.textContent = 'Buscando en ERP...';
      const info = await window.modal.getJobInfo(job);
      if (!info) {
        $info.textContent = 'Job no encontrado.';
        $btnAceptar.disabled = true;
        return;
      }
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
  $job.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); buscar(); } });

  const onQtyInput = () => {
    const clamp = (el) => {
      let v = parseInt(el.value, 10);
      if (!Number.isInteger(v) || v < 0) v = 0;
      if (String(v) !== el.value) el.value = String(v);
    };
    clamp($qtyOk); clamp($qtyScrap);
    validate();
  };
  $qtyOk.addEventListener('input', onQtyInput);
  $qtyScrap.addEventListener('input', onQtyInput);
  [$qtyOk, $qtyScrap].forEach((el) => el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); if (validate()) $btnAceptar.click(); }
  }));

  $btnAceptar.addEventListener('click', () => {
    if (!validate()) return;
    window.modal.accept({
      job: $job.value.trim(),
      qty: total(),
      piezasBuenas: parseInt($qtyOk.value, 10) || 0,
      piezasMalas: parseInt($qtyScrap.value, 10) || 0,
    });
  });
  $btnCancelar.addEventListener('click', () => window.modal.cancel());
})();