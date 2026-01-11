// server/controllers/serviceController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getServices = async (req, res) => {
    const services = await prisma.service.findMany({ orderBy: { id: 'asc'} });
    res.json(services);
};

const createService = async (req, res) => {
    const { nombre, duracion, precio } = req.body;
    const newService = await prisma.service.create({
        data: { 
            nombre, 
            duracionMinutos: parseInt(duracion), 
            precio: parseFloat(precio),
            activo: true 
        }
    });
    res.json(newService);
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