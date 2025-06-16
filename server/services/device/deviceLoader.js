require('dotenv').config();
const axios = require('axios');
//const mqttClient = require('../../mqtt/mqttClient');
const { registryDevices } = require('./deviceRegistry');

const NODE_RED_URL = process.env.NODE_RED_URL;
const MAX_RETRIES = 20;
const RETRY_DELAY = 3000; // milisegundos

const waitForNodeRed = async () => {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await axios.get(`${NODE_RED_URL}/config/devices`);
      return res;
    } catch (err) {
        console.warn(`🕐 Node-RED aún no está disponible. Intento ${attempt}/${MAX_RETRIES}`);
        await new Promise(res => setTimeout(res, RETRY_DELAY));
    }
  }
  throw new Error('Timeout esperando a Node-RED');
};

const loadDevicesFromNodeRed = async () => {
  try {
    //const res = await axios.get(`${NODE_RED_URL}/config/devices`);
    const res = await waitForNodeRed();

    console.log("A registrar los dispositivo:",res.data.devices);

    if (res.data) {
        registryDevices(res.data.devices);

        console.log('✅ Dispositivos cargados desde Node-RED');

        //mqttClient.initMqtt(io);
    }
    } catch (err) {
        console.error('❌ Error cargando dispositivos desde Node-RED:', err.message);
    }
};

module.exports = { loadDevicesFromNodeRed };