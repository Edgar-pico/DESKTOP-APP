// src/main/security/hardening.js
const { app, shell, session } = require('electron');
const { URL } = require('url');

// 🔒 configura aquí los destinos permitidos (http/https)
const ALLOWED_EXTERNAL_ORIGINS = new Set([
  'https://github.com',
  'https://learn.microsoft.com',
  'https://www.google.com',
  'https://google.com'
  // agrega los que realmente uses
]);

// CSP para tu HTML (mejor si también pones <meta http-equiv="Content-Security-Policy" ...> en index.html)
const DEFAULT_CSP =
  "default-src 'self'; " +
  "script-src 'self'; " +                 // evita eval/inline
  "style-src 'self' 'unsafe-inline'; " +  // 'unsafe-inline' solo si usas CSS inline
  "img-src 'self' data: blob:; " +
  "font-src 'self' data:; " +
  "connect-src 'self' http://localhost https://*; " + // ajusta si llamas APIs
  "frame-src 'none'; " +
  "object-src 'none'; " +
  "base-uri 'self'; " +
  "form-action 'self'";

function isAllowedExternal(url) {
  try {
    const u = new URL(url);
    const origin = `${u.protocol}//${u.host}`;
    return ALLOWED_EXTERNAL_ORIGINS.has(origin);
  } catch {
    return false;
  }
}

/**
 * Llama esta función una sola vez al arrancar la app (desde main.js).
 */
function applyHardening() {
  // 1) Permisos del renderer (cámara, micrófono, notificaciones, etc.)
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    // Permite solo lo que realmente uses
    const ALLOWED = new Set([
      // 'notifications',
      // 'media',
    ]);
    callback(ALLOWED.has(permission));
  });

  // 2) Bloquea navegación a sitios externos dentro de tus webContents
  app.on('web-contents-created', (_evt, contents) => {
    // a) bloquear "arrastres" o cambios de ubicación (will-navigate)
    contents.on('will-navigate', (event, url) => {
    if (!isLocal(url) && !isAllowedExternal(url)) {
        console.log('[BLOCKED navigation]', url);
        event.preventDefault();
    } else {
        console.log('[ALLOWED navigation]', url);
    }
    });

    // b) bloquear window.open (new-window) salvo que tú lo abras explícitamente
    contents.setWindowOpenHandler(({ url }) => {
      // abre en navegador externo solo si está en whitelist
      if (isAllowedExternal(url)) {
        shell.openExternal(url);
      }
      return { action: 'deny' };
    });

    // c) intercepta clicks a enlaces externos (target=_blank, etc.)
    contents.on('new-window', (e, url) => {
      e.preventDefault();
      if (isAllowedExternal(url)) shell.openExternal(url);
    });
  });

  // 3) CSP por cabecera (para http/https). Para file:// usa meta tag en HTML
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = details.responseHeaders || {};
    // Solo añade CSP si es un documento HTML
    if (isHTML(details)) {
      headers['Content-Security-Policy'] = [DEFAULT_CSP];
    }
    callback({ responseHeaders: headers });
  });

  // 4) Bloquea solicitudes a dominios no deseados (fetch/xhr/img/etc.)
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const { url, resourceType } = details;

    // Permite recursos locales (file://)
    if (url.startsWith('file://')) return callback({ cancel: false });

    // Permite data: y blob: (para imágenes generadas, etc.)
    if (url.startsWith('data:') || url.startsWith('blob:')) {
      return callback({ cancel: false });
    }

    // Para http/https, restringe según tu lógica
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // Si es navegación principal (mainFrame) y no está permitido → bloquea
      if (resourceType === 'mainFrame' && !isAllowedExternal(url)) {
        return callback({ cancel: true });
      }
      // Para recursos secundarios, puedes ser más permisivo o también whitelistear
      return callback({ cancel: false });
    }

    // Por defecto, bloquea esquemas raros
    callback({ cancel: true });
  });

  // 5) Deshabilitar atajos peligrosos en producción (DevTools, reload forzado, etc.)
  if (!app.isPackaged) return; // solo en producción
  app.on('browser-window-created', (_e, win) => {
  win.webContents.on('before-input-event', (event, input) => {
    const key = (input.key || '').toLowerCase();
    const ctrlOrCmd = input.control || input.meta;

    // Bloquear F12 y Ctrl/Cmd+R (pero permitir Ctrl/Cmd+Shift+I)
    const isBlockedShortcut =
      input.key === 'F12' ||
      (key === 'r' && ctrlOrCmd); // bloquea reload forzado

    if (isBlockedShortcut) event.preventDefault();
  });

  // Opcional: sigue cerrando DevTools si se abren por menú u otro (o eliminar si quieres permitir)
  win.webContents.on('devtools-opened', () => {
    // si quieres permitir inspección con Ctrl+Shift+I, comenta o borra la línea siguiente
    // win.webContents.closeDevTools();
  });

  // Opcional: bloquear menú contextual (inspeccionar)
  // win.webContents.on('context-menu', (e) => e.preventDefault());
});
}

/**
 * Endurece una ventana específica (llámalo inmediatamente después de crearla).
 */
function secureWindow(win) {
  if (!win || win.isDestroyed()) return;

  // Quita menús si no los usas
  win.setMenuBarVisibility(true);

  // Evita arrastrar archivos y que los cargue el webContents
  win.webContents.on('will-attach-webview', (event, webPreferences) => {
    // Bloquea webviews por defecto
    event.preventDefault();
  });

  // Limpia navegación fuera de tu app
  win.webContents.on('will-navigate', (e, url) => {
    if (!isLocal(url)) e.preventDefault();
  });
}

/**
 * Usa siempre esto en lugar de shell.openExternal directo.
 */
async function openExternalSafe(url) {
  if (isAllowedExternal(url)) {
    return shell.openExternal(url);
  }
  // Ignora o registra intento
  return false;
}

// Helpers
function isLocal(url) {
  return url.startsWith('file://') || url.startsWith('app://');
}
function isHTML(details) {
  const ct = (details.responseHeaders?.['content-type'] || details.responseHeaders?.['Content-Type'] || [''])[0];
  return typeof ct === 'string' && ct.includes('text/html');
}

module.exports = {
  applyHardening,
  secureWindow,
  openExternalSafe,
  DEFAULT_CSP,
  ALLOWED_EXTERNAL_ORIGINS,
  isAllowedExternal,
};
