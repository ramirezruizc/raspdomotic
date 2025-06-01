const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const { authMiddleware, isAdminMiddleware } = require('../middleware/auth');

/*
// Ruta para obtener los eventos dentro de un rango de fechas
router.get('/get-events', async (req, res) => {
  const { startDate, endDate } = req.query; // Fechas de inicio y fin

  try {
    const events = await Event.find({
      timestamp: { 
        $gte: new Date(startDate), 
        $lte: new Date(endDate)
      }
    }).populate('user', 'username');  // Opcional: incluir información del usuario

    res.json(events);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo eventos', error });
  }
});
*/

// Ruta para obtener los resultados de la consulta a BBDD
router.get('/summary', async (req, res) => {
  const { start, end, users, eventTypes } = req.query;

  console.log("Consulta en backend:", start, end, users, eventTypes);

  // Aseguramos que las fechas sean válidas
  if (!start || !end) {
    return res.status(400).json({ error: 'Faltan parámetros de fecha' });
  }

  const pipeline = [];

  // Paso 1: Filtro por rango de fechas
  pipeline.push({
    $match: {
      timestamp: {
        $gte: new Date(start),
        $lte: new Date(end),
      },
    },
  });

  // Paso 2 (opcional): Lookup para traer info del usuario si se filtrara por nombre
  const shouldFilterByUser = Array.isArray(users) && users.length > 0;
  if (shouldFilterByUser) {
    pipeline.push({
      $lookup: {
        from: 'users',          // Nombre de la colección relacionada
        localField: 'user',     // Campo en Event
        foreignField: '_id',    // Campo en User
        as: 'userInfo',         // Nombre del nuevo campo en los resultados
      },
    });

    // Convertimos userInfo de array a objeto
    pipeline.push({ $unwind: '$userInfo' });

    // Filtro por nombre de usuario
    pipeline.push({
      $match: {
        'userInfo.username': { $in: users },
      },
    });
  }

  // Paso 3 (opcional): Filtro por tipo de evento
  const shouldFilterByEventType = Array.isArray(eventTypes) && eventTypes.length > 0;
  if (shouldFilterByEventType) {
    pipeline.push({
      $match: {
        eventType: { $in: eventTypes },
      },
    });
  }

  // Paso 4: Agrupar por tipo de evento y contar
  pipeline.push({
    $group: {
      _id: '$eventType',
      count: { $sum: 1 },
    },
  });

  try {
    const summary = await Event.aggregate(pipeline);
    res.json(summary);
  } catch (error) {
    console.error('Error al obtener resultados de laconsulta:', error);
    res.status(500).json({ error: 'Error al obtener rresultados de la consulta' });
  }
});

// Ruta para registrar un evento (puede ser llamada desde algún lugar del backend)
router.post('/set-events', async (req, res) => {
  const { eventType, user, device, additionalInfo } = req.body;

  // Log para depuración
  console.log('📥 Evento recibido:');
  console.log('Tipo:', eventType);
  console.log('Usuario:', user);
  console.log('Dispositivo:', device);
  console.log('Info adicional:', additionalInfo);

  try {
    const newEvent = new Event({
      eventType,
      user,
      device,
      additionalInfo
    });

    await newEvent.save();
    res.status(201).json({ message: 'Evento registrado con éxito', event: newEvent });
  } catch (error) {
    res.status(500).json({ message: 'Error registrando evento', error });
  }
});

router.get('/event-types', async (req, res) => {
  try {
    const types = await Event.distinct('eventType');
    res.json(types);
  } catch (error) {
    console.error('Error fetching event types:', error);
    res.status(500).json({ error: 'Error al obtener tipos de evento' });
  }
});

module.exports = router;