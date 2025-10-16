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