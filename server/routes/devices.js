const express = require('express');
const { publishMessage } = require('../mqttClient'); // Importa el cliente MQTT
const router = express.Router();
const axios = require('axios');
const authMiddleware = require('../middleware/auth'); // Importa el middleware
const { io } = require('../index'); // Importamos io para emitir eventos

// Ruta para encender/apagar la bombilla
router.post('/toggle-bulb', authMiddleware, (req, res) => {
  const { state } = req.body; // Estado "ON" o "OFF"
  const topic = 'cmnd/tasmota/salon1/POWER'; // Cambia por el tópico de tu dispositivo Tasmota
  const message = state.toUpperCase(); // Convertir a mayúsculas para Tasmota

  publishMessage(topic, message);

  res.json({ success: true, message: `Bombilla ${state}` });
});

// Obtener el estado actual de la alarma desde Node-RED
router.get('/get-alarma', authMiddleware, async (req, res) => {
    try {
        const response = await axios.get('http://localhost:1880/get-alarma');
        res.json({ estado: response.data.estado });
    } catch (error) {
        console.error('Error al obtener el estado de la alarma:', error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// Cambiar el estado de la alarma
router.post('/set-alarma', authMiddleware, async (req, res) => {
    const { estado } = req.body;

    try {
        const response = await axios.post('http://localhost:1880/set-alarma', { estado });

        // Verificar si la respuesta de Node-RED contiene `success: true`
        if (response.data.success) {
            return res.json({ success: true, message: `Alarma actualizada a ${estado}` });
        } else {
            return res.status(400).json({ success: false, message: response.data.error || "Error desconocido en Node-RED" });
        }
        /*
        // Recupera la instancia de Socket.IO desde la app
        const io = req.app.get("io");
        if (!io) {
            console.error("Socket.IO no está disponible en la app");
            return res.status(500).json({ success: false, message: "Error interno del servidor" });
        }

        // Emitir el evento a todos los clientes conectados
        io.emit('alarma_actualizada', { estado });

        res.json({ message: `Alarma actualizada a ${estado}` });
        */
    } catch (error) {
        console.error('Error al actualizar la alarma:', error);
        res.status(500).json({ message: 'Error al comunicarse con Node-RED' });
    }
});

module.exports = router;
