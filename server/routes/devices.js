const express = require('express');
//const { publishAndWaitForResponse, publishMessage, getMqttRetainedValue } = require('../utils/mqttClient'); // Importa el cliente MQTT
const router = express.Router();
const axios = require('axios');
const { authMiddleware, isAdminMiddleware } = require('../middleware/auth'); // Importa el middleware
//const { io } = require('../index'); // Importamos io para emitir eventos
const { getDeviceById, getDeviceState } = require('../services/device/deviceRegistry');
const Device = require('../models/Device');
const { loadDevicesFromNodeRed } = require('../services/device/deviceLoader');

const NODE_RED_URL = process.env.NODE_RED_URL;

// Mapeo de comandos de voz a tópicos y mensajes MQTT
const voiceCommands = {
    "llamar emergencias": { topic: "recovoz/llamada_emergencia", message: "true", deviceId: "ALARM_DEVICE" },
    "desconectar alarma": { topic: "recovoz/desconectar_alarma", message: "false", deviceId: "ALARM_DEVICE" },
    "conectar alarma": { topic: "recovoz/conectar_alarma", message: "true", deviceId: "ALARM_DEVICE" },
    "encender salon frio": { topic: "recovoz/encender_salon1_frio", message: "000000FF00", deviceId: "TASMOTA_BULBRGB1" },
    "encender salon": { topic: "recovoz/encender_salon1", message: "ON", deviceId: "TASMOTA_BULBRGB1" },
    "apagar salon": { topic: "recovoz/apagar_salon1", message: "OFF", deviceId: "TASMOTA_BULBRGB1" },
    "salon al 25%": { topic: "recovoz/salon1_X%", message: "25", deviceId: "TASMOTA_BULBRGB1" },
    "salon al 50%": { topic: "recovoz/salon1_X%", message: "50", deviceId: "TASMOTA_BULBRGB1" },
    "salon al 75%": { topic: "recovoz/salon1_X%", message: "75", deviceId: "TASMOTA_BULBRGB1" },
    "salon al 100%": { topic: "recovoz/salon1_X%", message: "100", deviceId: "TASMOTA_BULBRGB1" }
};

module.exports = (mqttClient, io) => {
    // Ruta para obtener los dispositivos del sistema en funcion del RBAC
    router.get('/get-devices', authMiddleware, async (req, res) => {
        try {
            const response = await axios.get(`${NODE_RED_URL}/config/devices`);
            const nodeDevices = response.data.devices;

            const dbDevices = await Device.find({}, { _id: 0, id: 1, restricted: 1, accessRoles: 1 }).lean();
            const dbMap = Object.fromEntries(dbDevices.map(d => [d.id, d]));

            const userRoles = Array.isArray(req.user.role) ? req.user.role : (req.user.role ? [req.user.role] : []);

            // Si el usuario es admin, devolvemos todos los dispositivos sin filtrar
            if (userRoles.includes('admin')) {
            return res.json({
                success: true,
                devices: nodeDevices
            });
            }

            // Filtramos dispositivos para usuarios no admin
            const filteredDevices = nodeDevices.filter(nd => {
                const dbEntry = dbMap[nd.id];

                if (!dbEntry) {
                    return false;  // Si no hay entry en BBDD, el dispositivo está restringido
                }

                if (!dbEntry.restricted) {
                    return true;  // Si no está restringido, lo ve cualquiera
                }

                // Si está restringido, comprobamos los roles
                return dbEntry.accessRoles.some(role => userRoles.includes(role));
            });

            res.json({
            success: true,
            devices: filteredDevices
            });
        } catch (error) {
            console.error('❌ Error al obtener el listado de dispositivos configurados:', error);
            res.status(500).json({ message: 'Error en el servidor' });
        }
    });

    // Ruta para obtener el estado de la bombilla
    router.get('/get-bulb', authMiddleware, async (req, res) => {
        try {
            const response = await axios.get(`${NODE_RED_URL}/devices/get-bulb`);

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

    // Ruta para obtener el estado de la bombilla
    router.get('/:deviceId/bulbRGB/status', authMiddleware, async (req, res) => {
        try {
            const { deviceId } = req.params;
            const device = getDeviceById(deviceId);

            if (!device) return res.status(404).json({ message: "Dispositivo no encontrado" });

            /*
            const response = await axios.get(`${NODE_RED_URL}/devices/get-bulb`);

            console.log("Respuesta GET de Bulb (NODE-Red):", response.data);
            */

            const params = await mqttClient.subscribePublishAndWaitForResponse(
                device.topics.state, //comando para obtener los parámetros
                device.topics.result //topic donde se recibe la informacion
            );

            console.log(`Status de ${device.name} params: ${params}`);

            const power = params.POWER || "OFF";

            const hsbColor = params.HSBColor || '0,0,0';
            const [h, s, b] = hsbColor.split(',').map(Number);

            console.log("Respuesta GET de Bulb HSBColor (MQTT):", hsbColor);
            res.json({ power: power, hsbColor: { h, s, b } });
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
            const response = await axios.post(`${NODE_RED_URL}/devices/set-bulb`, { estado });

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

    // Ruta para encender/apagar la bombilla
    router.post('/:deviceId/bulbRGB/toggle', authMiddleware, async (req, res) => {
        const { deviceId } = req.params;
        const { power } = req.body;
        //const { power, hsbColor } = req.body;

        const device = getDeviceById(deviceId);
        if (!device) return res.status(404).json({ success: false, message: "Dispositivo no encontrado" });

        const comandos = [];

        if (power === "OFF") {
            comandos.push("Power OFF");
        } else {
            comandos.push("Power ON");

            /*
            if (hsbColor && typeof hsbColor.h === 'number') {
            const { h, s, b } = hsbColor;
            comandos.push(`HSBColor ${h},${s},${b}`);
            }
            */
        }

        const command = `Backlog ${comandos.join("; ")}`;
        const commandTopic = device.topics.backlog;
        const responseTopic = device.topics.result;

        try {
            /*
            const response = await axios.post(`${NODE_RED_URL}/devices/set-bulb`, { estado });

            if (!response.data.success) {
                return res.status(400).json({ success: false, message: response.data.error || "Error desconocido en Node-RED" });
            }
            */
           
            const io = req.app.get("io");
            if (!io) {
                console.error("❌ io no está disponible en req.app");
                return res.status(500).json({ message: "Error interno del servidor" });
            }

            //mqttClient.publishMessage(topic, command);
            const response = await mqttClient.subscribePublishAndWaitForResponse(
                commandTopic,
                responseTopic,
                command,
                3000
            );

            const success = response?.POWER?.toUpperCase() === power.toUpperCase();

            if (!success) {
                console.warn("⚠️ El dispositivo no respondió como se esperaba:", response);
                return res.status(408).json({ success: false, message: "Sin respuesta válida del dispositivo" });
            }

            const bulbState = power.toUpperCase() === "ON";

            io.emit("bulb-status", { deviceId, state: bulbState });

            return res.json({ success: true, message: `Bombilla ${deviceId} actualizada a ${bulbState}` });
        } catch (err) {
            console.error("❌ Error en toggle-bulb dinámico:", err);
            res.status(500).json({ message: "Error al comunicarse con Node-RED" });
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

            const response = await axios.post(`${NODE_RED_URL}/devices/set-bulb`, { estado });

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

    // Ruta para establecer brillo y color y, por tanto, encender la bombilla RGB
    router.post('/:deviceId/bulbRGB/set-color', authMiddleware, async (req, res) => {
        const { deviceId } = req.params;
        const { hsbColor } = req.body;

        const device = getDeviceById(deviceId);
        if (!device) return res.status(404).json({ success: false, message: "Dispositivo no encontrado" });


        if (!hsbColor || typeof hsbColor.h !== 'number' || typeof hsbColor.s !== 'number' || typeof hsbColor.b !== 'number') {
            return res.status(400).json({ success: false, message: 'HSB inválido' });
        }
    
        const payload = `${hsbColor.h},${hsbColor.s},${hsbColor.b}`;
        const topic = device.topics.hsbColor;
    
        try {
            mqttClient.publishMessage(topic, payload);

            console.log(`🎨 Cambiando color/brillo de bombilla: ${payload}`);

            //const response = await axios.post(`${NODE_RED_URL}/devices/set-bulb`, { estado });

            // Verificar si la respuesta de Node-RED contiene `success: true`
            //if (response.data.success) {
                const io = req.app.get("io");

                if (!io) {
                    console.error("❌ io no está disponible en req.app");
                    return res.status(500).json({ message: "Error interno del servidor" });
                }

                io.emit("bulb-status", { deviceId, state: true });

                return res.json({ success: true, message: `Color de bombilla ${deviceId} actualizado a ${payload}` });
            /*} else {
                return res.status(400).json({ success: false, message: response.data.error || "Error desconocido en Node-RED" });
            }*/
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
                // o devolver error si se prefiere forzar una espera de mensaje "real"
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

    // Ruta para la consulta del estado del Switch
    router.get("/:deviceId/switch/status", authMiddleware, async (req, res) => {
        const { deviceId } = req.params;
        console.log("ID de dispositivo:", deviceId);

        try {
            const device = getDeviceById(deviceId);
            console.log("Device:", device);
            
            if (!device) {
                return res.status(404).json({ message: "Dispositivo no encontrado" });
            }

            const { isOnline, relay } = getDeviceState(deviceId);
            console.log("Online?:", isOnline);
            console.log("Encendido?:", relay);

            if (typeof relay === "boolean") {
                return res.json({
                    success: true,
                    deviceId: deviceId,
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

    // Ruta POST para encender/apagar el Switch   
    router.post("/:deviceId/switch/toggle", authMiddleware, async (req, res) => {
        const { deviceId } = req.params;

        try {
            // Esperamos a que se produzca el cambio
            await mqttClient.waitForRelayChange(deviceId);
            return res.json({ success: true });
        } catch (err) {
            console.error("❌ Fallo al conmutar o sin respuesta:", err);
            return res.status(500).json({ success: false, message: "El dispositivo no respondió" });
        }
    });

    // Obtener el estado actual de la alarma desde Node-RED
    router.get('/get-alarma', authMiddleware, async (req, res) => {
        try {
            const response = await axios.get(`${NODE_RED_URL}/devices/get-alarma`);
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
            const response = await axios.post(`${NODE_RED_URL}/devices/set-alarma`, { estado });

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
    // y necesita de varias comprobaciones
    // para asegurar el estado del dispositivo
    router.get('/get-ac', authMiddleware, async (req, res) => {
        try {
            // Primera petición a Node-RED
            const firstResponse = await axios.get(`${NODE_RED_URL}/devices/get-ac`);
            const firstData = firstResponse.data;

            console.log("📡 Primera respuesta GET de A/C:", firstData);

            // Pequeña espera para permitir actualización interna en MELCloud
            await new Promise(resolve => setTimeout(resolve, 1200)); // ajusta si ves que necesita más

            // Segunda petición a Node-RED
            const secondResponse = await axios.get(`${NODE_RED_URL}/devices/get-ac`);
            const secondData = secondResponse.data;

            console.log("📡 Segunda respuesta GET de A/C:", secondData);

            // Comparación superficial o profunda, según lo que se defina como relevante
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
            const response = await axios.post(`${NODE_RED_URL}/devices/set-ac`, {
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

    // Obtener los dispositivos registrados en BBDD con sus accessRoles
    router.get('/get-device-access', authMiddleware, isAdminMiddleware, async (req, res) => {
        try {
            const devices = await Device.find({}, { _id: 0, id: 1, name: 1, type: 1, restricted: 1, accessRoles: 1 }).lean();
            
            res.json({
                success: true,
                devices
            });
        } catch (err) {
            console.error('❌ Error al obtener acceso de dispositivos:', err);
            res.status(500).json({ message: 'Error al obtener acceso de dispositivos' });
        }
    });


    // Cambiar restricciones de acceso de un dispositivo
    router.patch('/:deviceId/access-control', authMiddleware, isAdminMiddleware, async (req, res) => {
        try {
            const { deviceId } = req.params;
            const { accessRoles, name, restricted } = req.body;

            if (!Array.isArray(accessRoles)) {
                return res.status(400).json({ message: "El campo accessRoles debe ser un array" });
            }

            let device = await Device.findOne({ id: deviceId });

            if (device) {
                device.restricted = !!restricted;
                device.accessRoles = accessRoles;
                await device.save();
                return res.json({ success: true, message: "Acceso actualizado", device });
            } else {
                if (!name) {
                    return res.status(400).json({ message: "Falta el nombre del dispositivo para crear el registro" });
                }

                device = await Device.create({
                    id: deviceId,
                    name,
                    accessRoles,
                    restricted
                });

                return res.json({ success: true, message: "Dispositivo creado y acceso asignado", device });
            }

        } catch (err) {
            console.error("❌ Error en access-control:", err);
            res.status(500).json({ message: "Error al procesar la solicitud" });
        }
    });

    router.post('/load-from-nodered', authMiddleware, isAdminMiddleware, async (req, res) => {
        try {
            await loadDevicesFromNodeRed();
            res.json({ success: true, message: 'Dispositivos recargados desde Node-RED' });
        } catch (err) {
            console.error('❌ Error en load-from-nodered:', err);
            res.status(500).json({ message: 'Error al recargar dispositivos desde Node-RED' });
        }
    });

    // Ruta para procesar comandos de voz
    router.post('/command', authMiddleware, async(req, res) => {
        //const command = removeAccents(req.body.command.toLowerCase());

        //Comando ya normalizado desde cliente
        const command = req.body.command;

        if (!voiceCommands[command]) {
            return res.status(400).json({ success: false, message: "❌ Comando no reconocido" });
        }

        const { topic, message, deviceId } = voiceCommands[command];
        const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];

        // Si es admin, acceso total
        if (userRoles.includes('admin')) {
            mqttClient.publishMessage(topic, message);
            return res.json({ success: true, message: `✅ Comando ejecutado: ${command}` });
        }

        try {
            const device = await Device.findOne({ id: deviceId });

            // Si no existe en BBDD, asumimos que está restringido
            if (!device) {
            return res.status(403).json({ success: false, message: "⛔ Dispositivo no autorizado" });
            }

            // Si no está restringido, puede usarlo cualquiera
            if (!device.restricted) {
            mqttClient.publishMessage(topic, message);
            return res.json({ success: true, message: `✅ Comando ejecutado: ${command}` });
            }

            // Si está restringido, comprobamos que tenga alguno de los roles
            const hasAccess = device.accessRoles.some(role => userRoles.includes(role));

            if (!hasAccess) {
            return res.status(403).json({ success: false, message: "⛔ No tienes permiso para usar este dispositivo" });
            }

            mqttClient.publishMessage(topic, message);
            return res.json({ success: true, message: `✅ Comando ejecutado: ${command}` });

        } catch (error) {
            console.error("❌ Error en comando por voz:", error);
            res.status(500).json({ success: false, message: "Error en el servidor" });
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