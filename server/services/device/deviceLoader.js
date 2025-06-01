require('dotenv').config();
const axios = require('axios');
//const mqttClient = require('../../mqtt/mqttClient');
const { registryDevices } = require('./deviceRegistry');

const NODE_RED_URL = process.env.NODE_RED_URL;

const loadDevicesFromNodeRed = async () => {
  try {
    const res = await axios.get(`${NODE_RED_URL}/config/devices`);

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