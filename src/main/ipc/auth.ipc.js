const { ipcMain } = require('electron');
const crypto = require('crypto');
const argon2 = require('argon2');
const db = require('../services/db');

// Sesión global (una sola sesión activa en la app)
let currentSession = null; // { UsuarioId, UserName, Nombre, Area, Activo }

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

// DB helpers (usa VarChar en columnas VARCHAR y NVarChar en NVARCHAR)
async function getUserByUserName(username) {
  const rows = await db.executeQuery(
    `
    SELECT TOP 1 UsuarioId, UserName, PasswordHash, Activo, Nombre, Area
    FROM dbo.UsuariosProduccion
    WHERE UserName = @u;
    `,
    [{ name: 'u', type: db.sql.VarChar, value: username }] // UserName es VARCHAR(50)
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
      { name: 'h', type: db.sql.VarChar, value: newHash }, // PasswordHash es VARCHAR(255)
      { name: 'u', type: db.sql.VarChar, value: username }, // UserName es VARCHAR(50)
    ]
  );
}

// Argon2
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

// Accesores de sesión global
function setCurrentSession(userRow) {
  currentSession = safeUser(userRow);
}
function getCurrentSession() {
  return currentSession;
}
function clearCurrentSession() {
  currentSession = null;
}

// Registro de canales
function registerAuthIPC() {
  // Login
  ipcMain.handle('auth:login', async (_event, payload) => {
    const username = norm(payload?.username);
    const password = String(payload?.password || '');
    if (!username || !password) return { ok: false, error: 'Usuario o contraseña inválidos' };

    const user = await getUserByUserName(username);
    const invalid = { ok: false, error: 'Usuario o contraseña inválidos' };

    if (!user?.Activo || !user?.PasswordHash) return invalid;

    const ok = await verifyHash(user.PasswordHash, password);
    if (!ok) return invalid;

    setCurrentSession(user);
    return { ok: true, user: getCurrentSession() };
  });

  // Usuario actual (válido desde cualquier ventana)
  ipcMain.handle('auth:me', async () => {
    const sess = getCurrentSession();
    return { ok: !!sess, user: sess || null };
  });

  // Logout
  ipcMain.handle('auth:logout', async () => {
    clearCurrentSession();
    return { ok: true };
  });

  // Cambiar contraseña (requiere sesión)
  ipcMain.handle('auth:changePassword', async (_event, payload) => {
    const sess = getCurrentSession();
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

  // Registrar usuario (opcional; respeta tipos reales: id/u/a/h = VarChar, n = NVarChar)
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
      VALUES (@id, @u, @n, @a, 1, @h, SYSDATETIME());
      `,
      [
        { name: 'id', type: db.sql.VarChar, value: payload?.usuarioId || crypto.randomUUID() }, // UsuarioId = VARCHAR(10) (ajusta longitud al insertar)
        { name: 'u', type: db.sql.VarChar, value: username },  // UserName VARCHAR(50)
        { name: 'n', type: db.sql.NVarChar, value: nombre || null }, // Nombre NVARCHAR(100)
        { name: 'a', type: db.sql.VarChar, value: area || null },    // Area VARCHAR(20)
        { name: 'h', type: db.sql.VarChar, value: hash },            // PasswordHash VARCHAR(255)
      ]
    );

    return { ok: true };
  });
}

module.exports = { registerAuthIPC, getCurrentSession };