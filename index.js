const express = require('express');
const cors = require('cors');
require('dotenv').config();
const cron = require('node-cron');
const db = require('./db');
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken'); 
const multer = require('multer');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'mi_clave_secreta_galactica';

// --- CONFIGURACIÓN CRÍTICA DE CARGA (100MB) ---
// Esto permite que el servidor reciba archivos Base64 pesados desde el Frontend
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Configuración de Multer para formularios que no sean JSON
const upload = multer({ 
    limits: { fileSize: 100 * 1024 * 1024 } // 100 Megabytes
});

app.use(cors());

// --- CONFIGURACIÓN DE NODEMAILER ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'galacticamision@gmail.com', 
        pass: 'ugnz canv clxt biul' 
    }
});

const otpStorage = {}; 

// --- MIDDLEWARE: ADUANA ESPACIAL ---
const verificarToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ message: "No tienes permiso para entrar aquí" });
    try {
        const decoded = jwt.verify(token.split(" ")[1], JWT_SECRET);
        req.user_id = decoded.user_id; 
        next();
    } catch (err) {
        return res.status(401).json({ message: "Sesión expirada o inválida" });
    }
};

// --- 1. AUTENTICACIÓN Y SEGURIDAD ---

app.post('/api/auth/recuperar-otp', async (req, res) => {
    const { email } = req.body;
    try {
        const user = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (user.rows.length === 0) return res.status(404).json({ message: "El email no está registrado." });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        otpStorage[email] = { otp, expires: Date.now() + 600000 };

        const mailOptions = {
            from: '"STAR KID JOURNEY 🛰️" <galacticamision@gmail.com>',
            to: email,
            subject: '🔑 CÓDIGO DE ACCESO DE EMERGENCIA',
            html: `<div style="background-color: #0b0c10; color: #ffffff; padding: 40px; text-align: center; border: 2px solid #66fcf1; border-radius: 20px;">
                    <h1 style="color: #66fcf1;">S.O.S. GALÁCTICO</h1>
                    <p>Tu código de verificación es:</p>
                    <h2 style="font-size: 40px; letter-spacing: 10px;">${otp}</h2>
                   </div>`
        };
        await transporter.sendMail(mailOptions);
        res.json({ message: "Código enviado con éxito." });
    } catch (err) { res.status(500).json({ message: "Falla en la transmisión." }); }
});

app.post('/api/auth/reset-password-otp', async (req, res) => {
    const { email, otp, newPassword } = req.body;
    const record = otpStorage[email];
    if (!record || record.otp !== otp || Date.now() > record.expires) {
        return res.status(400).json({ message: "Código OTP inválido o caducado." });
    }
    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password = $1 WHERE email = $2', [hashedPassword, email]);
        delete otpStorage[email];
        res.json({ message: "Contraseña actualizada correctamente." });
    } catch (err) { res.status(500).json({ message: "Error al actualizar la base de datos." }); }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (user.rows.length === 0) return res.status(404).json({ message: "Usuario no encontrado." });
        const validPass = await bcrypt.compare(password, user.rows[0].password);
        if (!validPass) return res.status(401).json({ message: "La contraseña es incorrecta." });
        const token = jwt.sign({ user_id: user.rows[0].id }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token });
    } catch (err) { res.status(500).json({ message: "Error interno del servidor." }); }
});

app.post('/api/auth/registro', async (req, res) => {
    try {
        const { email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await db.query('INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id', [email, hashedPassword]);
        const userId = result.rows[0].id;
        const materiasOficiales = ['Pro. Textual', 'C. Naturales', 'Inglés', 'Tecnología', 'Matemáticas', 'Lenguaje', 'Sab. Mate', 'Plan L.', 'Sab. Natu', 'C. Sociales', 'Sab. Leng', 'Etic / Reli', 'Int. Emo', 'Sab. Soci'];
        for (let materia of materiasOficiales) {
            await db.query('INSERT INTO subjects (user_id, name) VALUES ($1, $2)', [userId, materia]);
        }
        res.json({ message: "Usuario creado con éxito." });
    } catch (err) { res.status(500).json({ message: "El correo ya está registrado." }); }
});

// --- 2. RUTAS DE DATOS (PROTEGIDAS) ---

app.get('/api/pilotos', verificarToken, async (req, res) => {
    try {
        const result = await db.query('SELECT id, kid_name, kid_photo_url, is_active FROM mission_config WHERE user_id = $1 ORDER BY id DESC', [req.user_id]);
        res.json(result.rows);
    } catch (err) { res.status(500).send('Error'); }
});

app.post('/api/registrar-piloto', verificarToken, async (req, res) => {
    try {
        const { kid_name, kid_photo_url } = req.body;
        await db.query('UPDATE mission_config SET is_active = FALSE WHERE user_id = $1', [req.user_id]);
        const result = await db.query('INSERT INTO mission_config (user_id, kid_name, kid_photo_url, is_active) VALUES ($1, $2, $3, TRUE) RETURNING *', [req.user_id, kid_name, kid_photo_url]);
        res.json(result.rows[0]);
    } catch (err) { res.status(500).send('Error'); }
});

app.delete('/api/pilotos/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM daily_scores WHERE mission_id = $1', [id]);
        await db.query('DELETE FROM mission_config WHERE id = $1 AND user_id = $2', [id, req.user_id]);
        res.json({ message: "Piloto eliminado." });
    } catch (err) { res.status(500).send('Error'); }
});

app.put('/api/pilotos/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { kid_name } = req.body;
        await db.query('UPDATE mission_config SET kid_name = $1 WHERE id = $2 AND user_id = $3', [kid_name, id, req.user_id]);
        res.json({ message: "Piloto actualizado." });
    } catch (err) { res.status(500).send('Error'); }
});

app.post('/api/seleccionar-piloto', verificarToken, async (req, res) => {
    try {
        const { id } = req.body;
        await db.query('UPDATE mission_config SET is_active = FALSE WHERE user_id = $1', [req.user_id]);
        await db.query('UPDATE mission_config SET is_active = TRUE WHERE id = $1 AND user_id = $2', [id, req.user_id]);
        res.json({ message: "Piloto activado." });
    } catch (error) { res.status(500).send("Error"); }
});

app.get('/api/materias', verificarToken, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM subjects WHERE user_id = $1 AND is_scorable = TRUE ORDER BY name ASC', [req.user_id]);
        res.json(result.rows);
    } catch (err) { res.status(500).send('Error'); }
});

// --- RUTA DE PROGRESO CORREGIDA (SUMA DE PUNTOS DINÁMICA) ---
app.get('/api/progreso', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                mc.id as mission_id, 
                mc.kid_name, 
                mc.kid_photo_url, 
                COALESCE(SUM(ds.points), 0) as total_points 
            FROM mission_config mc 
            LEFT JOIN daily_scores ds ON mc.id = ds.mission_id 
            WHERE mc.user_id = $1 AND mc.is_active = TRUE 
            GROUP BY mc.id, mc.kid_name, mc.kid_photo_url;
        `;
        const result = await db.query(query, [req.user_id]);
        res.json(result.rows[0] || { message: "No hay misiones activas", total_points: 0 });
    } catch (err) { res.status(500).send('Error'); }
});

// --- RUTA DE PUNTAJES ---
app.put('/api/puntaje', verificarToken, async (req, res) => {
    try {
        const { mission_id, subject_id, day_of_week, points } = req.body;
        const existe = await db.query(
            'SELECT id FROM daily_scores WHERE mission_id = $1 AND subject_id = $2 AND day_of_week = $3',
            [mission_id, subject_id, day_of_week]
        );

        if (existe.rows.length > 0) {
            await db.query('UPDATE daily_scores SET points = $1 WHERE id = $2', [points, existe.rows[0].id]);
        } else {
            await db.query(
                'INSERT INTO daily_scores (mission_id, subject_id, day_of_week, points) VALUES ($1, $2, $3, $4)',
                [mission_id, subject_id, day_of_week, points]
            );
        }
        res.json({ message: "¡Puntaje registrado!" });
    } catch (err) { res.status(500).send('Error al guardar puntos'); }
});

// --- RUTA DE PREMIOS (USA UPLOAD.NONE PORQUE RECIBE BASE64 EN EL BODY) ---
app.post('/api/premios', verificarToken, upload.none(), async (req, res) => {
    try {
        const { prize_1, prize_2, prize_3, prize_max } = req.body;
        await db.query(
            `UPDATE mission_config SET prize_1_img = $1, prize_2_img = $2, prize_3_img = $3, prize_max_img = $4 WHERE user_id = $5 AND is_active = TRUE`, 
            [prize_1, prize_2, prize_3, prize_max, req.user_id]
        );
        res.json({ message: "Premios guardados con éxito." });
    } catch (err) { res.status(500).send('Error en la base de datos de premios'); }
});

app.get('/api/premios', verificarToken, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM mission_config WHERE user_id = $1 AND is_active = TRUE', [req.user_id]);
        res.json(result.rows[0]);
    } catch (err) { res.status(500).send('Error'); }
});

cron.schedule('0 0 * * 1', async () => { console.log("Reseteo semanal..."); }, { timezone: "America/Bogota" });

app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));
