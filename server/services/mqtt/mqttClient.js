  const mqtt = require('mqtt');
  const { getDevices, getDeviceById, getDevicesByFirmware, getDeviceByTopic, setDeviceState } = require('../device/deviceRegistry');
  const { getDeviceState } = require('../../services/device/deviceRegistry');

  let client;
  let io;

  //Estructura Map temporal para gestionar promesas
  const pendingResponses = new Map();
  const pendingRelayResponses = new Map();

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
      //porque no son reactivos a peticiones de consulta de estado
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
    // utilizado para capturar eventos producidos
    // una vez recuperados los devices tras un
    // apagado forzoso, a modo de tolerancia a fallos
    client.on('message', (topic, messageBuffer) => {
      const message = messageBuffer.toString();
      console.log(`📥 Mensaje recibido ${topic}:`, message);

      /*const allDevices = getDevices();
      console.log("Todos los dispositivos son:", allDevices.map(d => ({
        id: d.id,
        topics: d.topics
      })));*/

      const device = getDeviceByTopic(topic);

      console.log("Device getDeviceByTopic:", device);

      if(device)
      {
        //Topic para estado ON/OFF-LINE tipico de ESPURNA Switch
        if (device.firmware === 'espurna' && topic === device.topics.status) {
          const isOnline = message === '1';

          console.log(`📶 Estado ONLINE del switch ${device.name}: ${isOnline}`);

          //Persistimos en memoria
          setDeviceState(device.id, { isOnline });

          if (io) {
            io.emit('switch-status', {
              deviceId: device.id,
              isOnline,
            });
          }
        }

        //Topic para estado del rele 1/0 tipico de ESPURNA Switch
        if (device.firmware === 'espurna' && topic === device.topics.relay) {
          const state = message === '1';

          console.log(`🔌 Cambio de estado del relé ${device.name} detectado: ${state}`);

          //Persistimos en memoria
          setDeviceState(device.id, { isOnline: true, relay: state });

          // Resolver promesa si existiese
          const pending = pendingRelayResponses.get(device.topics.relay);

          if (pending && pending.expectedValue === state) {
            console.log("Promesa resuelta:", pending);
            pending.resolve();
          }

          if (io) {
            io.emit('switch-status', {
              deviceId: device.id,
              state,
            });
          }
        }

        //Topic para capturar mensajes RESULT tipico de TASMOTA
        if (device.firmware === 'tasmota' && topic === device.topics.result) {
          try {
            const payload = JSON.parse(message);
            //console.log("Payload:",payload);
            const power = payload.POWER || "OFF";
            //console.log("HSBColor:",payload.HSBColor);
            //const hsbColor = payload.HSBColor || "0,0,0";
            //const [h, s, b] = hsbColor.split(',').map(Number);

            console.log(`💡 Bombilla Tasmota actualizada: ${device.name} = ${power}`);

            if (pendingResponses.has(topic)) {
              const callback = pendingResponses.get(topic);
              callback(message);
              pendingResponses.delete(topic);
            }

            /*
            // Guardar estado en memoria
            setDeviceState(device.id, {
              power: powerState === "ON",
              hsbColor: { h, s, b },
              isOnline: true
            });ç
            */

            // Emitir a frontend vía WebSocket
            if (io) {
              io.emit('bulb-status', {
                deviceId: device.id,
                state: power === "ON",
                //hsbColor: { h, s, b }
              });
            }

          } catch (e) {
            console.error(`❌ Error al procesar mensaje Tasmota: ${message}`, e);
          }
        }
      }

      // Si hay callback pendiente para el topic, ejecutarlo y quitarlo
      // Gestión de promesas Tasmota
      if (pendingResponses.has(topic)) {
        console.log("Gestion de promesa TASMOTA");
        const callback = pendingResponses.get(topic);

        callback(message);
      }

      // Gestion de promesas ESPURNA (usa expectedValue)
      if (pendingRelayResponses.has(topic)) {
        console.log("Gestion de promesa ESPURNA");
        const pending = pendingRelayResponses.get(topic);

        const newState = message === "1";

        if (pending && pending.expectedValue === newState) {
          pending.resolve();
          pendingRelayResponses.delete(topic);
        } else {
            console.warn(` Esperado: ${pending?.expectedValue}, recibido: ${newState} en topic: ${topic}`);
        }
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
  const subscribePublishAndWaitForResponse = (commandTopic, responseTopic, message = '', timeout = 3000) => {
    return new Promise((resolve, reject) => {
      if (!client.connected) {
        clearTimeout(timer);
        return reject(new Error('🚫 Cliente MQTT no conectado'));
      }

      if (pendingResponses.has(responseTopic)) {
        return reject(new Error(`⛔ Ya existe una espera activa para el topic ${responseTopic}`));
      }

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
            pendingResponses.delete(responseTopic);
            resolve(parsed);
          } catch (err) {
            console.error("❌ Error al parsear mensaje MQTT:", err);
            pendingResponses.delete(responseTopic);
            reject(err)
          }
        });

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

  const waitForRelayChange = (deviceId, timeout = 3000) => {
    return new Promise((resolve, reject) => {
      const device = getDeviceById(deviceId);

      if (!device || !device.topics?.relay || !device.topics?.relaySet) {
          return reject(new Error("🔍 Dispositivo o tópicos no definidos"));
      }

      const relayTopic = device.topics.relay;
      const relaySetTopic = device.topics.relaySet;
      const currentValue = getDeviceState(deviceId)?.relay;
      const expectedValue = !currentValue;

      /*if (currentState === expectedValue) {
          return resolve(true); // ya está en el estado esperado
      }*/

      if (pendingRelayResponses.has(relayTopic)) {
        return reject(new Error("⛔ Ya existe una espera activa para este topic"));
      }

      const timer = setTimeout(() => {
        // Si no cambió tras el tiempo, asumimos offline
        setDeviceState(deviceId, { isOnline: false });

        if (io) {
          io.emit('switch-status', {
            deviceId,
            isOnline: false
          });
        }

        pendingRelayResponses.delete(relayTopic);
        reject(new Error("⏱️ Timeout esperando confirmación de cambio de relé"));
      }, timeout);

      // Guardar temporalmente un handler "activo"
      // Guardamos el handler para ser llamado desde el listener global
      pendingRelayResponses.set(relayTopic, {
        expectedValue,
        resolve: () => {
          clearTimeout(timer);
          pendingRelayResponses.delete(relayTopic);
          resolve(true);
        },
        reject: (err) => {
          clearTimeout(timer);
          pendingRelayResponses.delete(relayTopic);
          reject(err);
        }
      });

      publishMessage(relaySetTopic, expectedValue ? "1" : "0");

      /* SE VA A GESTIONAR DESDE LISTENER GLOBAL
      //Listenet local temporal
      client.on("message", listener);
      */
    });
  };

  const isConnected = () => client.connected;

  module.exports = { isConnected, initMqtt, publishMessage, subscribePublishAndWaitForResponse,
                    getMqttRetainedValue, waitForRelayChange };