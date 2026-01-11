// server/index.js
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

// Importar rutas y controladores
const appointmentRoutes = require('./routes/appointmentRoutes');
const serviceController = require('./controllers/serviceController');

// --- WHATSAPP SERVICE (Importar UNA sola vez) ---
const { initializeWhatsApp, sendMessage, getStatus } = require('./services/whatsappService');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = "mi_secreto_super_seguro";

// Middlewares
app.use(cors());
app.use(express.json());

// 1. INICIALIZAR WHATSAPP (Genera el QR)
initializeWhatsApp();

// --- RUTAS WHATSAPP ---
app.get('/api/whatsapp/status', (req, res) => {
    res.json(getStatus());
});

app.post('/api/send-whatsapp', async (req, res) => {
    const { phone, message } = req.body;
    
    if (!phone || !message) {
        return res.status(400).json({ error: 'Faltan datos (phone o message)' });
    }

    const result = await sendMessage(phone, message);
    
    if (result.success) {
        res.json({ message: 'Mensaje enviado correctamente' });
    } else {
        res.status(500).json({ error: 'Error al enviar mensaje', details: result });
    }
});

// --- RUTAS DE CITAS ---
app.use('/api/appointments', appointmentRoutes);

// --- RUTAS DE SERVICIOS (CRUD) ---
app.get('/api/services', serviceController.getServices);
app.post('/api/services', serviceController.createService);
app.delete('/api/services/:id', serviceController.deleteService);

// --- RUTA LOGIN ADMIN ---
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const admin = await prisma.admin.findUnique({ where: { email } });

    if (!admin || admin.password !== password) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign({ id: admin.id, name: admin.nombre }, SECRET_KEY, { expiresIn: '8h' });
    res.json({ token, user: admin.nombre });
});
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

// --- SALVAVIDAS: Evitar que el server muera si WhatsApp falla ---
process.on('uncaughtException', (err) => {
    console.error('🔥 Error no capturado (El servidor sigue vivo):', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥 Promesa rechazada sin manejo (El servidor sigue vivo):', reason);
});
// --- INICIAR SERVIDOR ---
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

