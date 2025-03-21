const express = require('express');
const { publishMessage } = require('../mqttClient'); // Importa el cliente MQTT
const router = express.Router();
const axios = require('axios');
const authMiddleware = require('../middleware/auth'); // Importa el middleware
//const { io } = require('../index'); // Importamos io para emitir eventos

// Ruta para obtener los dispositivos del sistema
router.get('/get-devices', authMiddleware, async (req, res) => {
    try {
        const response = await axios.get('http://localhost:1880/config/devices');
        res.json({ success: response.data.success, devices: response.data.devices });
    } catch (error) {
        console.error('Error al obtener el estado de la bombilla:', error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// Ruta para encender/apagar la bombilla
router.post('/toggle-bulb', authMiddleware, async (req, res) => {
    const { estado } = req.body; // estado "ON" u "OFF"
    console.log("valor de bombilla", estado);
    const topic = 'cmnd/tasmota/salon1/POWER'; // Cambia por el tópico de tu dispositivo Tasmota
    const message = estado.toUpperCase(); // Convertir a mayúsculas para Tasmota

    try 
    {
        const response = await axios.post('http://localhost:1880/set-bulb', { estado });

        // Verificar si la respuesta de Node-RED contiene `success: true`
        if (response.data.success) {
            const io = req.app.get("io");

            if (!io) {
                console.error("❌ io no está disponible en req.app");
                return res.status(500).json({ message: "Error interno del servidor" });
            }

            publishMessage(topic, message);

            const bulbState = estado.toUpperCase() === "ON";

            io.emit("bulb-status", { state: bulbState });

            return res.json({ success: true, message: `Bombilla actualizada a ${bulbState}` });
        } else {
            return res.status(400).json({ success: false, message: response.data.error || "Error desconocido en Node-RED" });
        }
    }
    catch (error)
    {
        console.error('Error al actualizar el estado de la bombilla:', error);
        res.status(500).json({ message: 'Error al comunicarse con Node-RED' });
    }
});

// Ruta para obtener el estado de la bombilla
router.get('/get-bulb', authMiddleware, async (req, res) => {
    try {
        const response = await axios.get('http://localhost:1880/get-bulb');
        console.log("Estado recogido de Node-RED para la bombilla:", response.data.estado);
        res.json({ estado: response.data.estado });
    } catch (error) {
        console.error('Error al obtener el estado de la bombilla:', error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
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