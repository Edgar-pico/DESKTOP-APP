(function () {
  const titleEl = document.getElementById('title');
  const labelEl = document.getElementById('label');
  const inputEl = document.getElementById('value');
  const btnOk = document.getElementById('btnOk');
  const btnCancel = document.getElementById('btnCancel');

  // El preload ya escucha 'prompt-number:init' y configura título/label/min/max/step en el input
  // Aquí solo manejamos eventos
  btnCancel?.addEventListener('click', () => {
    window.modalAPI?.cancel?.();
  });

  btnOk?.addEventListener('click', () => {
    const value = Number(inputEl?.value || 0);
    if (!Number.isFinite(value)) { alert('Número inválido'); return; }
    window.modalAPI?.submit?.({ value });
  });
})();