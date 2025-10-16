const sql = require('mssql');
require('dotenv').config(); // Carga variables de entorno desde el archivo .env

let pool;

async function getConfig () {
  return {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    port: parseInt(process.env.DB_PORT || '1433',10),
    database: process.env.DB_NAME,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true', // Convierte a booleano
      trustServerCertificate: process.env.DB_TRUST_CERT === 'true'  // Cambia a true si usas un certificado autofirmado
    },
    pool: {
      max: 10,
      min: 0,
        idleTimeoutMillis: 30000
        },
    };
}

async function getPool() {
  if (pool) {
    return pool;
  }
  const config = await getConfig();
  pool = await sql.connect(config);
    return pool;
}

async function executeQuery(query, params = []) {
    const p = await getPool();
    const request = p.request();
    for (const {name,type = sql.VarChar, value} of params) {
        request.input(name, type, value);
    }
    const result = await request.query(query);
    return result.recordset;
}

async function ping() {
    const rows = await executeQuery('SELECT 1 AS ok');
    return rows?rows[0].ok === 1 : false;
}

// al final de src/main/services/db.js
module.exports = {
  sql,
  getConfig,
  getPool,
  executeQuery,   // 👈 añade esto
  ping
};