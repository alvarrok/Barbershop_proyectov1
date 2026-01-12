// server/controllers/serviceController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getServices = async (req, res) => {
    const services = await prisma.service.findMany({ orderBy: { id: 'asc'} });
    res.json(services);
};

const createService = async (req, res) => {
  try {
    // 1. Imprimimos en consola qué carajos está llegando (para verlo en los logs si falla)
    console.log("Datos recibidos:", req.body);

    const { nombre, minutos, duracionMinutos, duracion, precio, activo } = req.body;

    // 2. Lógica "Todoterreno": Agarramos el valor venga como venga
    const duracionFinal = minutos || duracionMinutos || duracion;

    // Si después de buscar en los 3 lados sigue vacío, ahí sí nos quejamos
    if (!duracionFinal) {
        console.log("Error: Falta la duración");
        return res.status(400).json({ error: 'Faltan los minutos (Revisar nombre del campo)' });
    }

    const newService = await prisma.service.create({
      data: {
        nombre: nombre,
        precio: parseFloat(precio),
        duracion: parseInt(duracionFinal), // Usamos la variable que encontramos
        activo: activo
      }
    });
    
    res.json(newService);
  } catch (error) {
    console.log("Error creando servicio:", error);
    res.status(500).json({ error: 'Error interno creando servicio' });
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