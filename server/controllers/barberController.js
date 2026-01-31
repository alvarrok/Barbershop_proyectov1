const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. Obtener lista
const getBarbers = async (req, res) => {
    try {
        const barbers = await prisma.barber.findMany({ where: { activo: true } });
        res.json(barbers);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener barberos' });
    }
};

// 2. Crear barbero (Con imagen)
const createBarber = async (req, res) => {
    try {
        const { nombre, telefono, imagenUrl } = req.body;
        const newBarber = await prisma.barber.create({
            data: { 
                nombre, 
                telefono,
                imagenUrl // Guardamos la URL
            } 
        });
        res.json(newBarber);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Error al crear barbero' });
    }
};

// 3. Eliminar barbero (Borrado lógico o físico si no tiene citas)
const deleteBarber = async (req, res) => {
    const { id } = req.params;
    try {
        // Opción: Borrado físico (solo si no tiene citas ligadas)
        // Para simplificar, lo desactivamos o borramos. 
        // Usaremos delete con try/catch por si tiene citas (Foreing Key constraint)
        try {
            await prisma.barber.delete({ where: { id: parseInt(id) } });
        } catch (fkError) {
            // Si falla porque tiene citas, lo desactivamos
            await prisma.barber.update({ 
                where: { id: parseInt(id) }, 
                data: { activo: false } 
            });
        }
        res.json({ message: 'Barbero eliminado/desactivado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar barbero' });
    }
};

module.exports = { getBarbers, createBarber, deleteBarber };