
document.addEventListener('DOMContentLoaded', async () => {
  // Mostrar usuario actual
  try {
    const me = await window.api.auth.me();
    document.getElementById('me').textContent =
      me?.user ? `Usuario: ${me.user.Nombre || me.user.UserName} | Área: ${me.user.Area || '-'}` : 'Sin sesión';
  } catch {}
  // Logout
  document.getElementById('btnLogout')?.addEventListener('click', async () => {
    await window.api.auth.logout();
    await window.api.app.openLogin();
  });
});

document.getElementById('btnOpenRegister')?.addEventListener('click', async () => {
  try {
    const me = await window.api.auth.me();
    const area = me?.user?.Area || 'Deburr';
    const usuarioId = me?.user?.UsuarioId || me?.user?.UserName;

    const res = await window.api.modal.openScanRegister({ area });
    if (res?.confirmed) {
      const { job, qty } = res;
      // Ejecuta el SP desde el parent con la sesión real (área y usuario NO vienen del modal)
      const r = await window.api.jobProcess.scanRegister({ job, area, qty, usuarioId });
      document.getElementById('deburrMsg').textContent =
        `OK: Job ${job} registrado con Qty ${qty} (Id ${r?.Id ?? '?'})`;
      // refresca listados si aplica...
    }
  } catch (e) {
    document.getElementById('deburrMsg').textContent = `Error: ${e?.message || e}`;
  }
});