const mqtt = require('mqtt');
const { getDevices, getDevicesByFirmware, getDeviceByTopic, setDeviceState } = require('../device/deviceRegistry');
const { getDeviceState } = require('../../services/device/deviceRegistry');

let client;
let io;

const pendingResponses = new Map();

const initMqtt = (_io) => {
  io = _io;
  
  const options = {
    reconnectPeriod: 5 * 1000, // Intentar reconectar cada 5 segundos
    connectTimeout: 10 * 1000, // Tiempo máximo de espera para conexión
    clientId: `Raspi.local_mqtt_client_${Math.random().toString(16).slice(2, 10)}`, // Evitar conflictos de cliente
    clean: true // false: el cliente recordará suscripciones previas, QoS 1 y 2 se entregan cuando reconecte
  };

  // Configuración del cliente MQTT
  client = mqtt.connect('mqtt://192.168.1.4', options); // Cambia por la IP del broker MQTT

  client.on('connect', () => {
    console.log('✅ Conectado al broker MQTT');

    //De momento integramos devices con espurna
    //porque no son reactivos a peticiones
    //a demanda, como sí ocurre con Tasmota (STATE --> RESULT )
    const mqttDevices = getDevicesByFirmware('espurna');

    console.log("Dispositivos ESPURNA:", mqttDevices);

    mqttDevices.forEach(device => {
      if (!device.id || !device.topics) return;

      //const relayTopic = device.id + device.topics.relay;
      //const statusTopic = device.id + device.topics.status;
      const statusTopic = device.topics.status;
      const relayTopic = device.topics.relay;

      client.subscribe(statusTopic, (err) => {
        if (!err) {
          console.log(`📡 Suscrito a status topic: ${statusTopic}`);
        } else {
          console.error('❌ Error al suscribirse al status del relé:', err);
        }
      });

      client.subscribe(relayTopic, (err) => {
        if (!err) {
          console.log(`📡 Suscrito a relay topic: ${relayTopic}`);
        } else {
          console.error('❌ Error al suscribirse al topic del relé:', err);
        }
      });
    });
  });

  // Unico listener global para los mensajes MQTT
  client.on('message', (topic, messageBuffer) => {
    const message = messageBuffer.toString();
    console.log(`📥 Mensaje recibido ${topic}:`, message);

    /*const allDevices = getDevices();
    console.log("Todos los dispositivos son:", allDevices.map(d => ({
      id: d.id,
      topics: d.topics
    })));*/

    console.log("Vamos a buscar por topic:", topic);

    const device = getDeviceByTopic(topic);

    console.log("Device getDeviceByTopic:", device);

    if(device)
    {
      if (topic === device.topics.status) {
        const isOnline = message === '1';

        console.log(`📶 Estado ONLINE del switch: ${isOnline}`);

        //Persistimos en memoria
        setDeviceState(device.id, { isOnline });

        if (io) {
          io.emit('switch-status', {
            deviceId: device.id,
            isOnline,
          });
        }
      }

      if (topic === device.topics.relay) {
        const state = message === '1';

        console.log(`💡 Cambio de estado del relé detectado: ${state}`);

        //Persistimos en memoria
        setDeviceState(device.id, { isOnline: true, relay: state });

        if (io) {
          io.emit('switch-status', {
            deviceId: device.id,
            state,
          });
        }
      }
    }

    // Si hay callback pendiente para el topic, ejecutarlo y quitarlo
    if (pendingResponses.has(topic)) {
      pendingResponses.get(topic)(message);
      pendingResponses.delete(topic);
    }
  });

  client.on('error', (err) => {
    console.error('❌ Error en la conexión MQTT:', err);
  });

  client.on('reconnect', () => {
    console.log('🔄 Intentando reconectar...');
  });

  client.on('offline', () => {
    console.warn('⚠️ Cliente MQTT está offline');
  });

  client.on('close', () => {
    console.warn('🔌 Conexión cerrada con el broker MQTT');
  });
};

// Publicación directa de mensajes, sin controles
// adicionales por sí mismo sallvo el error de publicación
const publishMessage = (topic, message) => {
  if (client.connected) {
    client.publish(topic, message, (err) => {
      if (err) {
        console.error('❌ Error al publicar mensaje:', err);
      } else {
        console.log(`📨 Mensaje publicado: ${topic} - ${message}`);
      }
    });
  } else {
    console.warn('⚠️ No se pudo publicar, cliente MQTT no está conectado');
  }
};

// Nuevo escenario: publicar y esperar respuesta
// Para una bombilla RGB con firmware TASMOTA
// Se conoce que tras la operación cmnd/xxx/STATE
// se recibe la respuesta en topic state stat/xxx/RESULT
// por ello se debe dar trato especial
const subscribePublishAndWaitForResponse = (commandTopic, responseTopic, message = '', timeout = 5000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingResponses.delete(responseTopic);
      reject(new Error('⏱️ Timeout esperando respuesta MQTT'));
    }, timeout);

    // Función para publicar una vez suscrito
    const publishAfterSubscribe = () => {
      // Registrar el callback de respuesta
      pendingResponses.set(responseTopic, (message) => {
        clearTimeout(timer);
        try {
          const parsed = JSON.parse(message.toString());
          resolve(parsed);
        } catch (err) {
          console.error("❌ Error al parsear mensaje MQTT:", err);
          reject(err)
        }
      });

      console.log(`📡 Publicando mensaje al topic: ${commandTopic} - ${message}`);

      // Publicar el mensaje una vez asegurada la suscripción
      publishMessage(commandTopic, message);
    };

    // Suscribirse primero, luego publicar
    client.subscribe(responseTopic, { qos: 0 }, (err, granted) => {
      if (err) {
        clearTimeout(timer);
        return reject(new Error('❌ Error al suscribirse al topic de respuesta'));
      }

      console.log(`📡 Suscrito al topic de respuesta: ${responseTopic}`);
      publishAfterSubscribe();
    });

    if (!client.connected) {
      clearTimeout(timer);
      return reject(new Error('🚫 Cliente MQTT no conectado'));
    }
  });
};

const getMqttRetainedValue = (topic, timeout = 3000) => {
  return new Promise((resolve, reject) => {
    const onMessage = (receivedTopic, messageBuffer) => {
      if (receivedTopic === topic) {
        const message = messageBuffer.toString();
        clearTimeout(timer);
        client.removeListener('message', onMessage);
        resolve(message);
      }
    };

    const timer = setTimeout(() => {
      client.removeListener('message', onMessage);
      reject(new Error("⏱️ Timeout esperando valor retenido MQTT"));
    }, timeout);f

    client.on('message', onMessage);
    client.subscribe(topic, { qos: 0 }, (err) => {
      if (err) {
        clearTimeout(timer);
        client.removeListener('message', onMessage);
        reject(new Error(`❌ Error al suscribirse al topic ${topic}`));
      }
    });
  });
};

const waitForRelayChange = (deviceId, expectedValue, timeout = 4000) => {
  return new Promise((resolve, reject) => {
    const currentState = getDeviceState(deviceId)?.relay;

    // Si ya está en ese estado, asumimos que no habrá cambio
    if (currentState === expectedValue) return resolve(true);

    const timer = setTimeout(() => {
      // Si no cambió tras el tiempo, asumimos offline
      setDeviceState(deviceId, { isOnline: false });

      if (io) {
        io.emit('switch-status', {
          deviceId,
          isOnline: false
        });
      }

      reject(new Error("⏱️ Timeout esperando confirmación de cambio de relé"));
    }, timeout);

    // Guardar temporalmente un listener "activo"
    const listener = (topic, messageBuffer) => {
      const message = messageBuffer.toString();
      const device = getDeviceByTopic(topic);

      if (device?.id === deviceId && topic === device.topics.relay) {
        const newState = message === "1";
        if (newState === expectedValue) {
          clearTimeout(timer);
          client.removeListener("message", listener);
          resolve(true);
        }
      }
    };

    client.on("message", listener);
  });
};

const isConnected = () => client.connected;

module.exports = { isConnected, initMqtt, publishMessage, subscribePublishAndWaitForResponse,
                  getMqttRetainedValue, waitForRelayChange };