const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

function loadEnv() {
  try {
    // Producción: resources/config/.env (dentro del paquete)
    const prodEnv = path.join(process.resourcesPath, 'config', '.env');
    if (fs.existsSync(prodEnv)) {
      dotenv.config({ path: prodEnv });
      return;
    }
    // Desarrollo: .env en la raíz del repo (ajusta si tu main cambia de carpeta)
    const devEnv = path.join(__dirname, '..', '..', '..', '.env');
    if (fs.existsSync(devEnv)) {
      dotenv.config({ path: devEnv });
    }
  } catch (e) {
    console.error('Error cargando .env:', e);
  }
}

module.exports = { loadEnv };