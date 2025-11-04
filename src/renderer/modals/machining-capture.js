(function () {
  const jobEl = document.getElementById('job');
  const buenasEl = document.getElementById('buenas');
  const malasEl = document.getElementById('malas');
  const btnSave = document.getElementById('btnSave');
  const btnCancel = document.getElementById('btnCancel');

  // El preload envía 'machining-capture:init' y escribe el Job en #job.
  // Por si hubiera carrera, si #job está vacío tras un tick, reintenta leer atributo data-job si lo ponemos en futuro.
  // Aquí solo nos encargamos de eventos.
  btnCancel?.addEventListener('click', () => {
    window.modalAPI?.cancel?.();
  });

  btnSave?.addEventListener('click', () => {
    const buenas = Number(buenasEl?.value || 0);
    const malas  = Number(malasEl?.value  || 0);
    if (!Number.isInteger(buenas) || buenas < 0) {
      alert('Buenas inválidas'); return;
    }
    if (!Number.isInteger(malas) || malas < 0) {
      alert('Scrap inválido'); return;
    }
    // El preload ya guarda el job recibido; lo retorna él mismo en el close
    window.modalAPI?.submit?.({ buenas, malas });
  });
})();