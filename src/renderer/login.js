document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const statusEl = document.getElementById('status');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    statusEl.textContent = 'Autenticando...';

    try {
      const res = await window.api.auth.login(username, password);
      if (!res?.ok) {
        statusEl.textContent = res?.error || 'Usuario o contraseña inválidos';
        return;
      }

      statusEl.textContent = `Bienvenido, ${res.user?.Nombre || res.user?.UserName}`;
      await window.api.app.openMain(); // abre index.html y cierra esta ventana
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'Error de autenticación';
    }
  });
});