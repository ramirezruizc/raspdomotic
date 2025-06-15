const cron = require('node-cron');
const DeviceSchedule = require('../../models/DeviceSchedule');
const { getDevices } = require('../../services/device/deviceRegistry');
const mqttClient = require('../../services/mqtt/mqttClient');

const manualOverrideMap = new Map(); // deviceId -> true (forzar override)
const lastAutoOnMap = new Map(); // deviceId -> timestamp

function isNowWithinSlot(slot) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [startHour, startMinute] = slot.start.split(':').map(Number);
  const [endHour, endMinute] = slot.end.split(':').map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  return currentMinutes >= start && currentMinutes <= end;
}

function getTodayCode() {
  const days = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  return days[new Date().getDay()];
}

// Permitir registrar un override desde cualquier parte del sistema
function setManualOverride(deviceId) {
    manualOverrideMap.set(deviceId, true);
    setTimeout(() => {
        manualOverrideMap.delete(deviceId);
    }, 1000 * 60 * 60); // override válido durante 1 hora
}

// Devuelve true si el override sigue siendo válido (< 1h)
function isOverrideActive(deviceId) {
  const ts = manualOverrideMap.get(deviceId);
  if (!ts) return false;
  const now = Date.now();
  return now - ts < 1000 * 60 * 60; // 1 hora
}

async function evaluateSchedules() {
    try {
        const now = new Date().toLocaleString('es-ES', {
            hour12: false,
            timeZone: 'Europe/Madrid'
        });

        console.log(`⏰ Evaluando planificación a las ${now}`);

        const todayCode = getTodayCode();
        console.log("📅 Día actual:", todayCode);

        const allSchedules = await DeviceSchedule.find({});
        console.log("🗂️ Planificaciones encontradas:", allSchedules.length);

        const allDevices = getDevices();
        console.log("🔎 Dispositivos registrados:", allDevices.length);

        for (const schedule of allSchedules) {
            console.log(`➡️ Evaluando planificación de ${schedule.deviceId}`);

            const device = allDevices.find(d => d.id === schedule.deviceId);

            if (!device) {
                console.warn(`⚠️ Dispositivo no encontrado en registro: ${schedule.deviceId}`);
                continue;
            }

            const topic = device.topics?.relaySet || device.topics?.backlog;
            
            if (!topic) {
                console.warn(`⚠️ Dispositivo ${device.id} sin topic de publicación válido`);
                continue;
            }

            const isActiveToday = schedule.days.includes(todayCode);
            const isInSlot = schedule.slots.some(isNowWithinSlot);
            const enforceOutsideSlot = schedule.enforceOutsideSlot === true;

            if (!isActiveToday) {
                console.log(`ℹ️ No aplica acción automática hoy para ${device.name}`);
                continue;
            }

            const protocol = device.protocol || 'mqtt';
            const firmware = device.firmware || '';
            const currentState = device.state?.relay ?? device.state?.power;

            const shouldTurnOn = isInSlot;
            const shouldTurnOff =
                (!isInSlot && lastAutoOnMap.has(device.id)) ||
                (!isInSlot && enforceOutsideSlot);

            const override = isOverrideActive(device.id);
            const action = shouldTurnOn ? 'ON' : (shouldTurnOff ? 'OFF' : null);

            console.log(`📊 ${device.name} → Activo hoy: ${isActiveToday}, dentro de franja: ${isInSlot}, override: ${override}, forzar apagado: ${enforceOutsideSlot}, estado actual: ${currentState}`);

            if (!action || override)
            {
                console.log(`✅ ${device.name} → Sin acción necesaria${override ? ' (override activo)' : ''}.`);
                continue;
            }

            const desiredBool = action === 'ON';

            //Si el estado actual ya es el deseado, no hacer nada
            if (currentState === desiredBool) {
                console.log(`✅ ${device.name} ya está en el estado deseado (${action}), no se hace nada.`);
                continue;
            }

            //Ejecutar acción planificada
            if (protocol === 'mqtt') {
                if (firmware === 'espurna') {
                    mqttClient.publishMessage(topic, desiredBool ? "1" : "0");
                } else if (firmware === 'tasmota') {
                    mqttClient.publishMessage(topic, `Backlog Power ${action}`);
                } else {
                    mqttClient.publishMessage(topic, action);
                }
            }

            // En el futuro, manejar protocolos no MQTT (ej: HTTP GET/POST directo)

            console.log(`📅 Acción enviada por planificación: ${device.name} → ${action}`);

            // Registrar auto encendido
            if (action === 'ON') {
                console.log(`💾 (lastAutoOnMap) Guardo acción por planificación: ${device.name} → ${action}`);
                lastAutoOnMap.set(device.id, Date.now());
            } else {
                console.log(`📝 (lastAutoOnMap) Borro acción por planificación: ${device.name} → ${action}`);
                lastAutoOnMap.delete(device.id); // se apaga, se borra el auto encendido
            }
        }
    } 
    catch (err) {
        console.error("❌ Error evaluando planificación:", err);
    }
}

function initScheduleExecutor() {
    console.log("🧠 Iniciando planificación automática...");
    cron.schedule('* * * * *', evaluateSchedules);
}

module.exports = {
    initScheduleExecutor,
    setManualOverride
};