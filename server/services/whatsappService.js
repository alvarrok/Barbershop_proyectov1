const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

let qrImageUrl = null;
let connectionStatus = 'DISCONNECTED'; 
let client = null;

const initializeWhatsApp = () => {
    // Si ya existe un cliente, no creamos otro encima
    if (client) return;

    client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: { 
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            headless: true
        }
    });

    // 1. GENERACIÓN DE QR
    client.on('qr', async (qr) => {
        qrImageUrl = await qrcode.toDataURL(qr);
        connectionStatus = 'QR_READY';
        console.log('⚡ QR Generado, esperando escaneo...');
    });

    // 2. CONEXIÓN EXITOSA
    client.on('ready', () => {
        connectionStatus = 'READY';
        qrImageUrl = null;
        console.log('✅ WhatsApp Conectado y listo.');
    });

    // 3. AUTENTICACIÓN
    client.on('authenticated', () => {
        connectionStatus = 'AUTHENTICATED';
        console.log('🔑 Autenticado correctamente.');
    });

    // 4. FALLO DE AUTENTICACIÓN
    client.on('auth_failure', msg => {
        console.error('❌ Error de autenticación:', msg);
        connectionStatus = 'DISCONNECTED';
    });

    // 5. DESCONEXIÓN (AQUÍ ESTÁ LA SOLUCIÓN AL CRASH)
    client.on('disconnected', async (reason) => {
        console.log('⚠️ WhatsApp desconectado. Razón:', reason);
        connectionStatus = 'DISCONNECTED';
        qrImageUrl = null;

        // IMPORTANTE: Destruimos la sesión anterior para evitar conflictos
        try {
            await client.destroy();
        } catch (error) {
            console.log('Nota: El cliente ya estaba destruido.');
        }

        // Reiniciamos el cliente desde cero para generar nuevo QR
        console.log('🔄 Reiniciando cliente automáticamente...');
        client = null; // Limpiamos la variable
        initializeWhatsApp(); // Volvemos a iniciar
    });

    // Iniciar cliente
    client.initialize();
};

const getStatus = () => {
    return { status: connectionStatus, qr: qrImageUrl };
};

const sendMessage = async (phone, message) => {
    if (connectionStatus !== 'READY' || !client) {
        return { success: false, error: 'WhatsApp no conectado' };
    }
    try {
        const chatId = `51${phone}@c.us`; 
        await client.sendMessage(chatId, message);
        return { success: true };
    } catch (error) {
        console.error('Error enviando:', error);
        return { success: false, error };
    }
};

module.exports = { initializeWhatsApp, sendMessage, getStatus };