const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, 
  ssl: {
    rejectUnauthorized: false
  }
});

pool.connect()
  .then(() => console.log('🚀 ¡SISTEMAS ONLINE! Conectado a la base de Neon.'))
  .catch((err) => {
    console.error('🔴 Error de conexión:', err.message);
  });

module.exports = pool;