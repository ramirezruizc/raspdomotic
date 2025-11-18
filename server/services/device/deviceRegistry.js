let devices = [];
const deviceStatusMap = {}; // Almacena estados: { [deviceId]: { relay: true, isOnline: false } }

function registryDevices(newDevices) {
  devices = newDevices.map(device => {
    //Dispositivos ESPURNA
    if (device.firmware === 'espurna') {
      const base = device.id;
      const resolvedTopics = {};

      if (!device.topics) {
        console.warn(`⚠️ Dispositivo ESPURNA sin topics definidos: ${device.id}`);
        return device; // lo devolvemos sin modificar
      }

      //console.log("Paso por aqui");

      for (const [key, path] of Object.entries(device.topics)) {
        //console.log("Paso por aqui2");
        resolvedTopics[key] = base + path;
        console.log("resolvedTopics:", resolvedTopics);
      }

      const updatedDevice = {
        ...device,
        topics: resolvedTopics,
      };

      return updatedDevice;
    }

    //Dispositivos TASMOTA
    if (device.firmware === 'tasmota') {
      const base = device.id;
      const resolvedTopics = {};

      if (!device.topics) {
        console.warn(`⚠️ Dispositivo TASMOTA sin topics definidos: ${device.id}`);
        return device;
      }

      for (const [key, [prefix, suffix]] of Object.entries(device.topics)) {
        resolvedTopics[key] = `${prefix}${base}${suffix}`;
      }

      const updatedDevice = {
        ...device,
        topics: resolvedTopics,
      };

      return updatedDevice;
    }

    //DISPOSITIVOS POR ZIGBEE2MQTT. Mantener topics tal cual completios
    if (device.firmware === 'zigbee2mqtt' || device.firmware === 'custom') {
      if (!device.topics?.state) {
        console.warn(`⚠️ Z2M/custom sin topic 'state': ${device.id}`);
      }

      return { ...device, topics: { ...(device.topics || {}) } };
    }

    if (!device.topics) {
      console.warn(`⚠️ Dispositivo sin topics definidos: ${device.id}`);
    }

    return device;
  });
  
  console.log("✅ Dispositivos finales registrados:", devices);
}

function getDevices() {
  return devices;
}

function getDeviceById(id) {
  return devices.find(d => d.id === id);
}

function getDevicesByFirmware(firmware) {
  return devices.filter(d => d.firmware === firmware);
}

function getDevicesByProtocol(protocol) {
  return devices.filter(d => d.protocol === protocol);
}
  
function getDeviceByTopic(topic) {
  console.log("Topic buscado", topic);
  return devices.find(device =>
    device.topics && Object.values(device.topics).includes(topic)
  );
}

function getDeviceState(deviceId) {
  console.log("getDeviceState", deviceStatusMap[deviceId]);
  return deviceStatusMap[deviceId] || {};
}

function getAllDeviceStates() {
  return { ...deviceStatusMap };
}

function setDeviceState(deviceId, stateUpdate) {
  console.log(`Modificamos persistencia para: ${deviceId}`);
  console.log(`Modificamos a: ${stateUpdate}`);
  deviceStatusMap[deviceId] = {
    ...(deviceStatusMap[deviceId] || {}),
    ...stateUpdate,
  };
}

module.exports = { registryDevices, getDevices, getDeviceById, getDevicesByFirmware, getDevicesByProtocol, 
                    getDeviceByTopic, getDeviceState, getAllDeviceStates, setDeviceState };