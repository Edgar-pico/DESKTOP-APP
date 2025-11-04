(function () {
  const buenasEl = document.getElementById('buenas');
  const malasEl  = document.getElementById('malas');
  const btnSave  = document.getElementById('btnSave');
  const btnCancel= document.getElementById('btnCancel');

  function orderQty() {
    const oqText = document.getElementById('orderQty')?.textContent || '0';
    return Number(oqText);
  }

  btnCancel?.addEventListener('click', () => {
    window.modalAPI?.cancel?.();
  });

  btnSave?.addEventListener('click', () => {
    const buenas = Number(buenasEl?.value || 0);
    const malas  = Number(malasEl?.value  || 0);
    const oq = orderQty();

    if (!Number.isInteger(buenas) || buenas < 0) { alert('Buenas inválidas'); return; }
    if (!Number.isInteger(malas)  || malas  < 0) { alert('Scrap inválido'); return; }

    if ((buenas + malas) !== oq) {
      alert(`Buenas + Scrap (${buenas + malas}) debe ser exactamente OrderQty (${oq}).`);
      return;
    }

    window.modalAPI?.submit?.({ buenas, malas });
  });
})();