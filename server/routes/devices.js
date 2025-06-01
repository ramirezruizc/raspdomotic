const express = require('express');
//const { publishAndWaitForResponse, publishMessage, getMqttRetainedValue } = require('../utils/mqttClient'); // Importa el cliente MQTT
const router = express.Router();
const axios = require('axios');
const { authMiddleware } = require('../middleware/auth'); // Importa el middleware
//const { io } = require('../index'); // Importamos io para emitir eventos
const { getDeviceById, getDeviceState } = require('../services/device/deviceRegistry');

const NODE_RED_URL = process.env.NODE_RED_URL;

// Mapeo de comandos de voz a tópicos y mensajes MQTT
const voiceCommands = {
    "llamar emergencias": { topic: "recovoz/llamada_emergencia", message: "true" },
    "desconectar alarma": { topic: "recovoz/desconectar_alarma", message: "false" },
    "conectar alarma": { topic: "recovoz/conectar_alarma", message: "true" },
    "encender salon frio": { topic: "recovoz/encender_salon1_frio", message: "000000FF00" },
    "encender salon": { topic: "recovoz/encender_salon1", message: "ON" },
    "apagar salon": { topic: "recovoz/apagar_salon1", message: "OFF" },
    "salon al 25%": { topic: "recovoz/salon1_X%", message: "25" },
    "salon al 50%": { topic: "recovoz/salon1_X%", message: "50" },
    "salon al 75%": { topic: "recovoz/salon1_X%", message: "75" },
    "salon al 100%": { topic: "recovoz/salon1_X%", message: "100" }
};

module.exports = (mqttClient, io) => {
    // Ruta para obtener los dispositivos del sistema
    router.get('/get-devices', authMiddleware, async (req, res) => {
        try {
            const response = await axios.get(`${NODE_RED_URL}/config/devices`);
            res.json({ success: response.data.success, devices: response.data.devices });
        } catch (error) {
            console.error('Error al obtener el listado de dispositivos configurados:', error);
            res.status(500).json({ message: 'Error en el servidor' });
        }
    });

    // Ruta para obtener el estado de la bombilla
    router.get('/get-bulb', authMiddleware, async (req, res) => {
        try {
            const response = await axios.get(`${NODE_RED_URL}/get-bulb`);

            console.log("Respuesta GET de Bulb (NODE-Red):", response.data);

            const params = await mqttClient.subscribePublishAndWaitForResponse(
                'cmnd/tasmota/salon1/STATE', //comando para obtener los parámetros
                'stat/tasmota/salon1/RESULT' //topic donde se recibe la informacion
            );

            const hsbColor = params.HSBColor || '0,0,0';
            const [h, s, b] = hsbColor.split(',').map(Number);

            console.log("Respuesta GET de Bulb HSBColor (MQTT):", hsbColor);
            res.json({ estado: response.data.estado, hsbColor: { h, s, b } });
        } catch (error) {
            console.error('Error al obtener el estado de la bombilla:', error);
            res.status(500).json({ message: 'Error en el servidor' });
        }
    });

    // Ruta para encender/apagar la bombilla
    router.post('/toggle-bulb', authMiddleware, async (req, res) => {
        //const { estado } = req.body; // estado "ON" u "OFF"
        //const { estado, brillo, color } = req.body;
        const { estado, hsbColor } = req.body;
        console.log("valor de bombilla", estado);
        //const topic = 'cmnd/tasmota/salon1/POWER'; // Indicar el topico correspondiente de tasmota (salon1)
        //const message = estado.toUpperCase(); // Convertir a mayúsculas para Tasmota

        //const colorRGB = hexToRgb(color); // "#ffaa33" → "255,170,51"
        //const dimmerValue = Math.round(brillo); // 1–100
        //const command = `POWER ${powerState}; Dimmer ${dimmerValue}; Color ${colorRGB}`;
        const topic = 'cmnd/tasmota/salon1/backlog';

        const comandos = [];

        if (estado === "OFF") {
            comandos.push("Power OFF"); // Solo apagado
        } else {
            comandos.push("Power ON");
            //if (brillo !== undefined) comandos.push(`Dimmer ${brillo}`);
            
            /*if (color) {
            // Convertir #RRGGBB a formato de Tasmota (ej: "FF0000" sin #)
            const colorHex = color.replace("#", "").toUpperCase();
            comandos.push(`Color ${colorHex}`);
            }*/

            if (hsbColor && typeof hsbColor.h === 'number') {
                const { h, s, b } = hsbColor;
                comandos.push(`HSBColor ${h},${s},${b}`);
            }
        }

        const command = `Backlog ${comandos.join("; ")}`;

        console.log("Comando a Bulb (MQTT):", command);

        try 
        {
            const response = await axios.post(`${NODE_RED_URL}/set-bulb`, { estado });

            console.log("Respuesta POST de Bulb (NODE-Red):", estado);

            // Verificar si la respuesta de Node-RED contiene `success: true`
            if (response.data.success) {
                const io = req.app.get("io");

                if (!io) {
                    console.error("❌ io no está disponible en req.app");
                    return res.status(500).json({ message: "Error interno del servidor" });
                }

                mqttClient.publishMessage(topic, command);

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

    // Ruta para establecer brillo y color y, por tanto, encender la bombilla RGB
    router.post('/set-bulb-bright-color', authMiddleware, async (req, res) => {
        const { hsbColor } = req.body;
    
        if (!hsbColor || typeof hsbColor.h !== 'number' || typeof hsbColor.s !== 'number' || typeof hsbColor.b !== 'number') {
        return res.status(400).json({ success: false, message: 'HSB inválido' });
        }
    
        const payload = `${hsbColor.h},${hsbColor.s},${hsbColor.b}`;
    
        try {
            mqttClient.publishMessage('cmnd/tasmota/salon1/HSBColor', payload);

            console.log(`🎨 Cambiando color/brillo de bombilla: ${payload}`);

            const estado = "ON";

            const response = await axios.post(`${NODE_RED_URL}/set-bulb`, { estado });

            // Verificar si la respuesta de Node-RED contiene `success: true`
            if (response.data.success) {
                const io = req.app.get("io");

                if (!io) {
                    console.error("❌ io no está disponible en req.app");
                    return res.status(500).json({ message: "Error interno del servidor" });
                }

                io.emit("bulb-status", { state: true });

                return res.json({ success: true, message: "Bombilla actualizada a true" });
            } else {
                return res.status(400).json({ success: false, message: response.data.error || "Error desconocido en Node-RED" });
            }
        } catch (error) {
        console.error("❌ Error al enviar color:", error);
        res.status(500).json({ success: false, message: 'Error en el servidor' });
        }
    });

    // Ruta para la consulta del estado del Switch
    router.get("/get-switch", authMiddleware, async (req, res) => {
        console.log('Estado MQTT conectado:', mqttClient.isConnected());

        const { deviceId } = req.query;

        if (!mqttClient.isConnected()) {  
            return res.status(503).json({ message: "MQTT aún no conectado" });
        }
        
        try {
            const relay = mqttClient.getLastKnownSwitchState();
            console.log("getLastKnownSwitchState():", relay);
            const relayStatus = relay === true;
            const isOnline = true;

            if (relayStatus !== null) {
                res.json({ relayStatus: relayStatus, isOnline });
            } else {
                // Fallback de emergencia (opcional): intentar usar getMqttRetainedValue con cliente temporal
                // o devolver error si prefieres forzar una espera de mensaje real
                return res.status(503).json({ success: false, message: "Estado del relé no disponible aún" });
            }
        } catch (error) {
            console.error("❌ Error al obtener estado del switch:", error);
            res.status(500).json({ message: "Error en el servidor" });
        }
    });

    // Ruta POST para encender/apagar el Switch
    router.post("/toggle-switch", authMiddleware, async (req, res) => {
        const { estado } = req.body;
        const payload = estado === "ON" ? "1" : "0";
        const topic = "ESPURNA-SWITCH1/relay/0/set";

        try {
            // Enviar comando MQTT a ESPurna
            mqttClient.publishMessage(topic, payload);

            res.json({ success: true, message: `Switch actualizado a ${estado}` });
        } catch (error) {
            console.error("❌ Error al cambiar estado del switch:", error);
            res.status(500).json({ success: false, message: "Error en el servidor" });
        }
    });

    router.get("/:id/switch", authMiddleware, async (req, res) => {
        const { id } = req.params;
        console.log("ID de dispositivo:", id);

        try {
            const device = getDeviceById(id);
            console.log("Device:", device);
            
            if (!device) {
                return res.status(404).json({ message: "Dispositivo no encontrado" });
            }

            const { isOnline, relay } = getDeviceState(id);
            console.log("Online?:", isOnline);
            console.log("Encendido?:", relay);

            if (typeof relay === "boolean") {
                return res.json({
                    success: true,
                    deviceId: id,
                    relayStatus: relay,
                    isOnline: !!isOnline,
                });
            } else {
                return res.status(503).json({
                    success: false,
                    message: "Estado del relé no disponible aún",
                });
            }
        } catch (error) {
            console.error("❌ Error al obtener estado del switch:", error);
            res.status(500).json({ message: "Error en el servidor" });
        }
    });

    router.post("/:id/switch/toggle", authMiddleware, async (req, res) => {
        const { id } = req.params;

        const device = getDeviceById(id);
        
        if (!device) {
            return res.status(404).json({ success: false, message: "Dispositivo no encontrado" });
        }

        const current = getDeviceState(id)?.relay;

        if (typeof current !== "boolean") {
            return res.status(503).json({
            success: false,
            message: "Estado del relé no disponible aún",
            });
        }

        const newState = !current;
        const relaySetTopic = device.topics.relaySet;

        /*
        try {
            mqttClient.publishMessage(relaySetTopic, newState ? "1" : "0");
            return res.json({ success: true, newState });
        } catch (err) {
            console.error("❌ Error al publicar nuevo estado:", err);
            return res.status(500).json({ success: false, message: "Error al conmutar relé" });
        }
        */

        try {
            mqttClient.publishMessage(relaySetTopic, newState ? "1" : "0");

            await mqttClient.waitForRelayChange(id, newState); // aquí esperamos que el cambio ocurra
            return res.json({ success: true, newState });
        } catch (err) {
            console.error("❌ Fallo al conmutar o sin respuesta:", err);
            return res.status(500).json({ success: false, message: "El dispositivo no respondió" });
        }

    });

    // Obtener el estado actual de la alarma desde Node-RED
    router.get('/get-alarma', authMiddleware, async (req, res) => {
        try {
            const response = await axios.get(`${NODE_RED_URL}/get-alarma`);
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
            const response = await axios.post(`${NODE_RED_URL}/set-alarma`, { estado });

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

    // Obtener estado del aire acondicionado
    // Un problema conocido para MELCloud es
    // que su plataforma no sincroniza bien
    // y necesita de segunda comprobación
    // para asegurar el estado del dispositivo
    router.get('/get-ac', authMiddleware, async (req, res) => {
        try {
            // Primera petición a Node-RED
            const firstResponse = await axios.get(`${NODE_RED_URL}/get-ac`);
            const firstData = firstResponse.data;

            console.log("📡 Primera respuesta GET de A/C:", firstData);

            // Pequeña espera para permitir actualización interna en MELCloud
            await new Promise(resolve => setTimeout(resolve, 1200)); // ajusta si ves que necesita más

            // Segunda petición a Node-RED
            const secondResponse = await axios.get(`${NODE_RED_URL}/get-ac`);
            const secondData = secondResponse.data;

            console.log("📡 Segunda respuesta GET de A/C:", secondData);

            // Comparación superficial o profunda, según lo que definas como relevante
            const fieldsToCompare = ['power', 'mode', 'temperature', 'fanspeed'];

            const areEqual = fieldsToCompare.every(field =>
                firstData[field] === secondData[field]
            );

            if (areEqual) {
                console.log("✅ Respuesta consistente tras doble lectura.");
                return res.json(firstData);
            } else {
                console.warn("⚠️ Respuestas distintas, se usa segunda lectura.");
                return res.json(secondData);
            }
        } catch (error) {
            console.error("❌ Error al obtener AC:", error);
            return res.status(500).json({ success: false, message: "Error al comunicarse con Node-RED" });
        }
    });

    // Cambiar estado/configuración del aire acondicionado
    router.post('/set-ac', authMiddleware, async (req, res) => {
        const { power, mode, temperature, fanspeed } = req.body;
        console.log("Parámetros para A/C:",req.body);
        
        /*
        // Validaciones básicas
        if (typeof power !== 'boolean' || typeof temperature !== 'number' || !mode || !fanspeed) {
            return res.status(400).json({ success: false, message: "Parámetros inválidos" });
        }
        */

        try {
            const response = await axios.post(`${NODE_RED_URL}/set-ac`, {
                power,
                mode,
                temperature,
                fanspeed
            });

            console.log("Respuesta del A/C al POST:", response.data);

            return res.json(response.data);
        } catch (error) {
            console.error("❌ Error al actualizar AC:", error);
            return res.status(500).json({ success: false, message: "Error al comunicarse con Node-RED" });
        }
    });

    // Ruta para procesar comandos de voz
    router.post('/command', authMiddleware, (req, res) => {
        //const command = removeAccents(req.body.command.toLowerCase());

        //Comando ya normalizado desde cliente
        const command = req.body.command;

        if (voiceCommands[command]) {
            const { topic, message } = voiceCommands[command];
            publishMessage(topic, message);
            return res.json({ success: true, message: `✅ Comando ejecutado: ${command}` });
        } else {
            return res.status(400).json({ success: false, message: "❌ Comando no reconocido" });
        }
    });

  return router;
};

/*
// Métodos y funciones auxiliares
// Función para remover acentos
function removeAccents(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
*/

/*
function hexToRgb(hex) {
    const bigint = parseInt(hex.replace("#", ""), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `${r},${g},${b}`;
}
*/

//module.exports = router;