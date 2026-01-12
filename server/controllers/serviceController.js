// server/controllers/serviceController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getServices = async (req, res) => {
    const services = await prisma.service.findMany({ orderBy: { id: 'asc'} });
    res.json(services);
};

const createService = async (req, res) => {
  try {
    // 1. AQUI ESTABA EL ERROR:
    // El frontend manda "minutos", no "duracionMinutos".
    // Vamos a leer "minutos" del paquete que llega.
    const { nombre, minutos, precio, activo } = req.body;

    // Validación rápida para que no explote si llega vacío
    if (!minutos) {
        return res.status(400).json({ error: 'Faltan los minutos' });
    }

    const newService = await prisma.service.create({
      data: {
        nombre: nombre,
        precio: parseFloat(precio),
        
        // 2. ASIGNAMOS:
        // Campo Base de Datos (duracion) = Variable que recibimos (minutos)
        duracion: parseInt(minutos), 
        
        activo: activo
      }
    });
    
    res.json(newService);
  } catch (error) {
    console.log("Error creando servicio:", error);
    res.status(500).json({ error: 'Error creando servicio' });
  }
};

const deleteService = async (req, res) => {
    const { id } = req.params;
    // Ojo: Si borras un servicio con citas, Prisma podría quejarse. 
    // Lo mejor es marcarlo como "activo: false", pero aquí borraremos para simplificar.
    try {
        await prisma.service.delete({ where: { id: parseInt(id) } });
        res.json({ success: true });
    } catch (e) {
        res.status(400).json({ error: "No se puede eliminar un servicio que tiene citas históricas." });
    }
};

module.exports = { getServices, createService, deleteService };