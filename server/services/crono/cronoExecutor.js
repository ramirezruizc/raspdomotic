const DeviceCrono = require('../../models/DeviceCrono');
const DeviceSchedule = require('../../models/DeviceSchedule');
const { getDevices } = require('../../services/device/deviceRegistry');
const mqttClient = require('../../services/mqtt/mqttClient');

let ioInstance = null;

// Mapa en memoria de cronos activos { endAt, isCustom }
const activeCronos = new Map();

function setIo(io) {
  ioInstance = io;
}

async function loadActiveCronosFromDB() {
  const now = Date.now();
  const cronos = await DeviceCrono.find({});

  for (const crono of cronos) {
    const endAt = crono.startedAt.getTime() + crono.duration * 1000;
    if (endAt > now) {
      activeCronos.set(crono.deviceId, { 
        endAt,
        isCustom: crono.isCustom,
        duration: crono.duration,       // en segundos
        startedAt: crono.startedAt      // fecha/hora inicio
      });
    } else {
      await DeviceCrono.deleteOne({ _id: crono._id });
    }
  }

  console.log(`📥 Cronos activos cargados en memoria: ${activeCronos.size}`);
}

async function addCrono(deviceId, durationSeconds, isCustom = false) {
  const startedAt = new Date();
  const endAt = startedAt.getTime() + durationSeconds * 1000;

  activeCronos.set(deviceId, { 
    endAt, 
    isCustom, 
    duration: durationSeconds, 
    startedAt
  });

  await DeviceCrono.findOneAndUpdate(
    { deviceId },
    {
      deviceId,
      startedAt,
      duration: durationSeconds,
      isCustom
    },
    { upsert: true }
  );

  // Emitir evento a todos los clientes
  if (ioInstance) {
    ioInstance.emit('crono:update', {
      deviceId,
      active: true,
      remaining: durationSeconds,
      duration: durationSeconds,
      isCustom
    });
  }

  console.log(`🕒 [CRONO CREADO] ${deviceId} → duración: ${durationSeconds}s (${Math.round(durationSeconds/60)} min), isCustom: ${isCustom}`);
}

function getCrono(deviceId) {
  return activeCronos.get(deviceId) || null;
}

async function removeCrono(deviceId) {
  activeCronos.delete(deviceId);

  if (ioInstance) {
    ioInstance.emit('crono:update', {
      deviceId,
      active: false
    });
  }

  await DeviceCrono.deleteOne({ deviceId });
}

async function expireCronos() {
  const now = Date.now();

  // Log del estado actual del Map
  console.log("🗺️ Estado de activeCronos:", Array.from(activeCronos.entries()).map(([id, data]) => ({
    deviceId: id,
    endAt: new Date(data.endAt).toLocaleTimeString(),
    duration: data.duration,
    isCustom: data.isCustom
  })));

  for (const [deviceId, cronoData] of activeCronos.entries()) {
    if (now >= cronoData.endAt) {
      const device = getDevices().find(d => d.id === deviceId);

      if (!device) {
        await removeCrono(deviceId);
        console.log(`🔴 [CRONO BORRADO] ${deviceId} → no existe el dispositivo`);
        continue;
      }

      // Comprobar si está en franja activa
      const schedule = await DeviceSchedule.findOne({ deviceId });
      const todayCode = getTodayCode();
      const isActiveToday = schedule?.days.includes(todayCode);
      const isInSlot = schedule?.slots?.some(isNowWithinSlot);

      if (isActiveToday && isInSlot) {
        console.log(`🟡 [CRONO EXPIRADO] ${deviceId} → crono expirado pero dentro de franja activa → mantener encendido`);
        await removeCrono(deviceId);
        continue;
      }

      apagarDispositivo(device);
      console.log(`🕒 [CRONO EXPIRADO] ${deviceId} → crono expirado y apagado automáticamente`);
      await removeCrono(deviceId);
    }
  }
}

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

function apagarDispositivo(device) {
  const topic = device.topics?.relaySet || device.topics?.backlog;
  
  if (!topic) return;

  const firmware = device.firmware || '';
  const protocol = device.protocol || 'mqtt';

  if (protocol === 'mqtt') {
    if (firmware === 'espurna') {
      mqttClient.publishMessage(topic, "0");
    } else if (firmware === 'tasmota') {
      mqttClient.publishMessage(topic, "Backlog Power OFF");
    } else {
      mqttClient.publishMessage(topic, "OFF");
    }
  }
}

function initCronoExecutor(io) {
  if (io) setIo(io);

  console.log("🧠 Iniciando gestión de cronos...");

  loadActiveCronosFromDB()
    .then(() => {
      setInterval(expireCronos, 1000);
    })
    .catch(err => {
      console.error("❌ Error cargando cronos iniciales:", err);
    });
}

module.exports = { initCronoExecutor, addCrono, getCrono, removeCrono };