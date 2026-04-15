const db = require('./db');

const setupDatabase = async () => {
  try {
    console.log("🧹 Limpiando escombros espaciales...");

    // Borrado total con CASCADE
    await db.query('DROP TABLE IF EXISTS daily_scores CASCADE;');
    await db.query('DROP TABLE IF EXISTS subjects CASCADE;');
    await db.query('DROP TABLE IF EXISTS mission_config CASCADE;');
    await db.query('DROP TABLE IF EXISTS users CASCADE;');
    
    console.log("✅ Sistema de archivos desintegrado.");

    // Reconstrucción
    await db.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.query(`
      CREATE TABLE mission_config (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        kid_name VARCHAR(100),
        kid_photo_url TEXT,
        is_active BOOLEAN DEFAULT FALSE,
        prize_1_img TEXT,
        prize_2_img TEXT,
        prize_3_img TEXT,
        prize_max_img TEXT
      );
    `);

    await db.query(`
      CREATE TABLE subjects (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        is_scorable BOOLEAN DEFAULT TRUE
      );
    `);

    await db.query(`
      CREATE TABLE daily_scores (
        id SERIAL PRIMARY KEY,
        mission_id INTEGER REFERENCES mission_config(id) ON DELETE CASCADE,
        subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
        day_of_week VARCHAR(20),
        points INTEGER DEFAULT 0,
        date_recorded DATE DEFAULT CURRENT_DATE
      );
    `);

    console.log("🌟 ¡Base de Datos Espacial reconstruida al 100%!");
    
    // Cerramos la conexión para que la terminal no se quede colgada
    process.exit(0);

  } catch (err) {
    console.error("❌ Error crítico en los motores de limpieza:", err);
    process.exit(1);
  }
};

setupDatabase();