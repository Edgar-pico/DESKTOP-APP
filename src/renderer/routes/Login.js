// src/renderer/routes/Login.js
// Ejemplo simple de pantalla de login usando el bridge del preload

const $ = (s) => document.querySelector(s);

async function onLoginSubmit(e) {
  e?.preventDefault?.();
  const username = $('#username').value.trim();
  const password = $('#password').value;

  $('#status').textContent = 'Autenticando...';
  const res = await window.api.auth.login(username, password);

  if (!res.ok) {
    $('#status').textContent = res.error || 'Error';
    return;
  }

  $('#status').textContent = `Bienvenido, ${res.user?.Nombre || res.user?.UserName}`;
  // Aquí podrías navegar a tu vista principal
  // location.href = 'index.html'; // o tu router interno
}

function mount() {
  const root = document.getElementById('app');
  root.innerHTML = `
    <form id="loginForm">
      <h2>Iniciar sesión</h2>
      <label>Usuario</label>
      <input id="username" autocomplete="username" />
      <label>Contraseña</label>
      <input id="password" type="password" autocomplete="current-password" />
      <button type="submit">Entrar</button>
      <div id="status" style="margin-top:8px;color:#555"></div>
    </form>
  `;
  $('#loginForm').addEventListener('submit', onLoginSubmit);
}

document.addEventListener('DOMContentLoaded', mount);