// server/controllers/barberController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. OBTENER LISTA (Solo los activos para el cliente, todos para el admin)
const getBarbers = async (req, res) => {
    try {
        // Si viene un query param ?todos=true devolvemos todos, si no, solo los activos
        const whereClause = req.query.todos === 'true' ? {} : { activo: true };
        const barbers = await prisma.barber.findMany({ where: whereClause });
        res.json(barbers);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener barberos' });
    }
};

// 2. CREAR BARBERO (Con nuevos datos)
const createBarber = async (req, res) => {
    try {
        const { nombre, dni, telefono, sexo, imagenUrl } = req.body;
        
        // Validar si ya existe el DNI
        const existing = await prisma.barber.findUnique({ where: { dni } });
        if(existing) return res.status(400).json({ error: 'El DNI ya está registrado' });

        const newBarber = await prisma.barber.create({
            data: { nombre, dni, telefono, sexo, imagenUrl, activo: true } 
        });
        res.json(newBarber);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Error al crear barbero' });
    }
};

// 3. ACTUALIZAR BARBERO (Para Modificar o Dar de Baja/Activar)
const updateBarber = async (req, res) => {
    const { id } = req.params;
    const data = req.body; // Puede venir { nombre: ... } o { activo: false }
    try {
        const updatedBarber = await prisma.barber.update({
            where: { id: parseInt(id) },
            data: data
        });
        res.json(updatedBarber);
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar barbero' });
    }
};

// 4. ELIMINAR FÍSICAMENTE (Hard Delete - Cuidado)
const deleteBarber = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.barber.delete({ where: { id: parseInt(id) } });
        res.json({ message: 'Barbero eliminado permanentemente' });
    } catch (error) {
        // Si falla es probablemente porque tiene citas asociadas
        res.status(400).json({ error: 'No se puede eliminar porque tiene historial de citas. Use "Dar de baja".' });
    }
};

module.exports = { getBarbers, createBarber, updateBarber, deleteBarber };