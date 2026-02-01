// server/index.js
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

// --- IMPORTAR CONTROLADORES Y RUTAS ---
const appointmentRoutes = require('./routes/appointmentRoutes');
const serviceController = require('./controllers/serviceController');
const barberController = require('./controllers/barberController');

// --- WHATSAPP SERVICE ---
const { initializeWhatsApp, sendMessage, getStatus } = require('./services/whatsappService');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || "mi_secreto_super_seguro";

// --- MIDDLEWARES ---
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// --- AQUÍ ESTÁ LA CORRECCIÓN CLAVE ---
// Aumentamos el límite a 50mb para que entren las fotos en Base64
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- INICIALIZAR WHATSAPP ---
initializeWhatsApp();

// ==========================================
//                 RUTAS API
// ==========================================

// 1. AUTENTICACIÓN (LOGIN)
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const admin = await prisma.admin.findUnique({ where: { email } });
        if (!admin || admin.password !== password) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        const token = jwt.sign({ id: admin.id, name: admin.nombre }, SECRET_KEY, { expiresIn: '8h' });
        res.json({ token, user: admin.nombre });
    } catch (error) {
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// 2. WHATSAPP
app.get('/api/whatsapp/status', (req, res) => res.json(getStatus()));

app.post('/api/send-whatsapp', async (req, res) => {
    const { phone, message } = req.body;
    if (!phone || !message) return res.status(400).json({ error: 'Faltan datos' });

    const result = await sendMessage(phone, message);
    if (result.success) res.json({ message: 'Enviado' });
    else res.status(500).json({ error: 'Error al enviar', details: result });
});

// 3. CITAS
app.use('/api/appointments', appointmentRoutes);

// 4. SERVICIOS (CRUD)
app.get('/api/services', serviceController.getServices);
app.post('/api/services', serviceController.createService);
app.put('/api/services/:id', serviceController.updateService);
app.delete('/api/services/:id', serviceController.deleteService);

// 5. BARBEROS (CRUD)
app.get('/api/barbers', barberController.getBarbers);
app.post('/api/barbers', barberController.createBarber);
app.put('/api/barbers/:id', barberController.updateBarber);
app.delete('/api/barbers/:id', barberController.deleteBarber);


// ==========================================
//           MANEJO DE ERRORES
// ==========================================

process.on('uncaughtException', (err) => {
    console.error('🔥 Error crítico no capturado:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥 Promesa rechazada sin manejo:', reason);
});

// INICIAR SERVIDOR
app.listen(PORT, () => {
    console.log(`🚀 Servidor BarberShop listo en puerto ${PORT}`);
});