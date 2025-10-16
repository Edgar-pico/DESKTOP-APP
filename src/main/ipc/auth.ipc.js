// Autenticación básica con Argon2 en proceso main (sin pepper)
// Handlers: auth:login, auth:me, auth:logout, auth:changePassword, auth:register (opcional)

const { ipcMain } = require('electron');
const crypto = require('crypto');
const argon2 = require('argon2');
const db = require('../services/db');

// Sesión simple en memoria por WebContents
const sessionsByWC = new Map(); // wcId -> { UsuarioId, UserName, Nombre, Area, Activo }

// Utilidades
function safeUser(row) {
  return {
    UsuarioId: row.UsuarioId,
    UserName: row.UserName,
    Nombre: row.Nombre,
    Area: row.Area,
    Activo: !!row.Activo,
  };
}
const norm = (s) => String(s ?? '').trim();

// DB helpers
async function getUserByUserName(username) {
  const rows = await db.executeQuery(
    `
    SELECT TOP 1 UsuarioId, UserName, PasswordHash, Activo, Nombre, Area
    FROM dbo.UsuariosProduccion
    WHERE UserName = @u;
    `,
    [{ name: 'u', type: db.sql.NVarChar, value: username }]
  );
  return rows?.[0] || null;
}

async function updatePassword(username, newHash) {
  await db.executeQuery(
    `
    UPDATE dbo.UsuariosProduccion
    SET PasswordHash = @h
    WHERE UserName = @u;
    `,
    [
      { name: 'h', type: db.sql.NVarChar, value: newHash },
      { name: 'u', type: db.sql.NVarChar, value: username },
    ]
  );
}

// Argon2 helpers (parametrización razonable para escritorio)
async function hashPassword(plain) {
  return argon2.hash(plain, {
    type: argon2.argon2id,
    timeCost: 3,
    memoryCost: 2 ** 16,
    parallelism: 1,
  });
}
async function verifyHash(hash, plain) {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

// Sesión
function attachSession(event, userRow) {
  sessionsByWC.set(event.sender.id, safeUser(userRow));
}
function getSession(event) {
  return sessionsByWC.get(event.sender.id) || null;
}
function clearSession(event) {
  sessionsByWC.delete(event.sender.id);
}

// Registro de canales
function registerAuthIPC() {
  // Login
  ipcMain.handle('auth:login', async (event, payload) => {
    const username = norm(payload?.username);
    const password = String(payload?.password || '');
    if (!username || !password) return { ok: false, error: 'Usuario o contraseña inválidos' };

    const user = await getUserByUserName(username);
    // Respuesta genérica para no filtrar si existe o no
    const invalid = { ok: false, error: 'Usuario o contraseña inválidos' };

    if (!user?.Activo || !user?.PasswordHash) return invalid;

    const ok = await verifyHash(user.PasswordHash, password);
    if (!ok) return invalid;

    attachSession(event, user);
    return { ok: true, user: safeUser(user) };
  });

  // Usuario actual
  ipcMain.handle('auth:me', async (event) => {
    const sess = getSession(event);
    return { ok: !!sess, user: sess || null };
  });

  // Logout
  ipcMain.handle('auth:logout', async (event) => {
    clearSession(event);
    return { ok: true };
  });

  // Cambiar contraseña (requiere sesión)
  ipcMain.handle('auth:changePassword', async (event, payload) => {
    const sess = getSession(event);
    if (!sess) return { ok: false, error: 'No autenticado' };

    const oldPassword = String(payload?.oldPassword || '');
    const newPassword = String(payload?.newPassword || '');

    if (newPassword.length < 8) return { ok: false, error: 'La nueva contraseña debe tener al menos 8 caracteres.' };

    const user = await getUserByUserName(sess.UserName);
    if (!user?.PasswordHash) return { ok: false, error: 'Usuario no encontrado' };

    const ok = await verifyHash(user.PasswordHash, oldPassword);
    if (!ok) return { ok: false, error: 'Contraseña actual incorrecta' };

    const newHash = await hashPassword(newPassword);
    await updatePassword(sess.UserName, newHash);

    return { ok: true };
  });

  // Registrar usuario (opcional; útil para semillar)
  ipcMain.handle('auth:register', async (_event, payload) => {
    const username = norm(payload?.username);
    const password = String(payload?.password || '');
    const nombre = norm(payload?.nombre);
    const area = norm(payload?.area);
    if (!username || password.length < 8) return { ok: false, error: 'Usuario o contraseña inválidos' };

    const exists = await getUserByUserName(username);
    if (exists) return { ok: false, error: 'Usuario ya existe' };

    const hash = await hashPassword(password);
    await db.executeQuery(
      `
      INSERT INTO dbo.UsuariosProduccion (UsuarioId, UserName, Nombre, Area, Activo, PasswordHash, FechaAlta)
      VALUES (@id, @u, @n, @a, 1, @h, GETDATE());
      `,
      [
        { name: 'id', type: db.sql.NVarChar, value: payload?.usuarioId || crypto.randomUUID() },
        { name: 'u', type: db.sql.NVarChar, value: username },
        { name: 'n', type: db.sql.NVarChar, value: nombre || null },
        { name: 'a', type: db.sql.NVarChar, value: area || null },
        { name: 'h', type: db.sql.NVarChar, value: hash },
      ]
    );

    return { ok: true };
  });
}

module.exports = { registerAuthIPC };